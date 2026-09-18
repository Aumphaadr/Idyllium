// «Поделиться»: проект в ссылке (1.6.1). Спека —
// Idyllium-backstage/tech/spec/some_share_links/01.
//
// Отправитель: диалог собирает адрес `…/#p1=<данные>` из ТЕКСТА проекта
// (кодек — в общем ядре, window.Idyllium.share) и показывает «светофор» длины:
// узкое место — не браузер, а мессенджер, который режет длинные сообщения.
// Нетекстовые файлы едут описью (имя, размер, отпечаток); тяжёлый проект
// честнее отправить файлом — кнопка рядом.
//
// Получатель: ссылка открывается гостем — «Работа по ссылке». Свой открытый
// проект не трогается, в хранилище ничего не пишется, пока человек сам не
// нажмёт «Сохранить к себе»; чужой код сам не запускается. Недостающие файлы
// ищутся по отпечатку: в проектах самого получателя и в раздатке сайта.

import { files } from './project-store.js';
import { assetBytes, bytesToDataUrl, formatBytes } from './binary-format.js';
import { WORKSPACE_ROOT, MAIN_FILE, normalizeWorkspacePath, shortFileName } from './workspace-paths.js';
import { setStatus, appendOutput } from './console-output.js';

const FROM_STORAGE_KEY = 'idyllium-web-ide:share-from';
const SCOPE_STORAGE_KEY = 'idyllium-web-ide:share-scope';
const HANDOUTS_URL = 'handouts/';
// Ёмкость QR-кода (версия 40, коррекция L, байтовый режим) — проверено прогоном: 2953 входит, 2954 нет.
const QR_MAX_CHARS = 2953;
// Плотный код камера с экрана уже не берёт — но картинкой-файлом он читается при любой плотности.
const QR_CAMERA_COMFORT_CHARS = 1200;

const PROBLEM_TEXT = {
  'not-a-share-link': 'В адресе нет проекта.',
  'newer-format': 'Эта ссылка сделана более новой версией Idyllium. Обновите страницу (Ctrl+F5) — и попробуйте ещё раз.',
  'too-long': 'Ссылка слишком длинная — это не похоже на проект.',
  broken: 'Ссылка неполная или повреждена: похоже, её разрезали при пересылке. Попросите автора прислать проект файлом.',
  'too-big': 'Проект по ссылке слишком большой — такой открывать не станем.',
  'bad-content': 'В ссылке лежит не проект Idyllium.',
};

const VERDICT_TEXT = {
  everywhere: ['ok', 'Пройдёт везде: мессенджеры, почта, чат класса.'],
  'one-message': ['warn', 'Влезет в одно сообщение Telegram и VK. В Discord (предел 2000) — нет.'],
  'file-only': ['bad', 'Длиннее одного сообщения Telegram и VK (4096): мессенджер разрежет ссылку, и она сломается. Отправьте проект файлом или ссылку — почтой.'],
};

function shareApi() {
  const api = window.Idyllium && window.Idyllium.share;
  if (!api) throw new Error('Ядро Idyllium ещё не загрузилось — попробуйте через секунду');
  return api;
}

async function fingerprint(bytes) {
  if (!window.crypto || !window.crypto.subtle) return '';
  const digest = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest.subarray(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function versionIsNewer(theirs, ours) {
  const parts = (text) => String(text).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(theirs);
  const right = parts(ours);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return false;
}

const vendorLoads = new Map();

/**
 * Кодер и декодер QR грузятся лениво: большинству посетителей они не нужны вовсе.
 * Обе библиотеки — UMD, а на странице живёт AMD-загрузчик Monaco с глобальным
 * `define`: обычный <script> зарегистрировал бы их там и ничего не отдал. Поэтому
 * исполняем текст как CommonJS-модуль в собственной области, глобалы не трогая.
 */
function loadVendor(file) {
  if (!vendorLoads.has(file)) {
    vendorLoads.set(file, (async () => {
      const response = await fetch(`${siteBaseUrl()}vendor/${file}`);
      if (!response.ok) throw new Error('Не удалось загрузить модуль QR-кодов — проверьте соединение');
      const moduleObject = { exports: {} };
      new Function('module', 'exports', 'define', await response.text())(moduleObject, moduleObject.exports, undefined);
      const loaded = moduleObject.exports;
      return typeof loaded === 'function' ? loaded : loaded.default;
    })().catch((error) => { vendorLoads.delete(file); throw error; }));
  }
  return vendorLoads.get(file);
}

/** QR-код ссылки на холсте: чёрное на белом в любой теме, поля в 4 модуля — по стандарту. */
async function drawQr(canvas, text, targetPixels) {
  const qrcode = await loadVendor('qrcode.js');
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  const modules = qr.getModuleCount();
  const quiet = 4;
  const scale = Math.max(2, Math.min(10, Math.floor(targetPixels / (modules + quiet * 2))));
  const size = (modules + quiet * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (qr.isDark(row, column)) ctx.fillRect((column + quiet) * scale, (row + quiet) * scale, scale, scale);
    }
  }
  return { modules, size };
}

/** Текст из QR-кода на картинке; null — кода не нашлось. */
async function readQrFromBlob(blob) {
  const jsQR = await loadVendor('jsQR.js');
  const bitmap = await createImageBitmap(blob);
  // Снимок экрана 4K декодеру ни к чему: уменьшаем до разумного, плотный код при этом ещё читается.
  const limit = 2400;
  const ratio = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
  for (const factor of [ratio, Math.min(1, ratio * 2), ratio / 2].filter((value, index, list) => value > 0 && list.indexOf(value) === index)) {
    const width = Math.max(1, Math.round(bitmap.width * factor));
    const height = Math.max(1, Math.round(bitmap.height * factor));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const found = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'attemptBoth' });
    if (found && found.data) return found.data;
  }
  return null;
}

function siteBaseUrl() {
  return new URL('./', window.location.href.split('#')[0]).href;
}

function readStored(key) {
  try { return window.localStorage.getItem(key) || ''; } catch (_error) { return ''; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch (_error) { /* без хранилища — без памяти */ }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * host — то, что модулю нужно от ядра IDE:
 *   modal, banner                     — DOM-узлы;
 *   saveCurrentEditor(), currentFile(), projectName(), idylliumVersion()
 *   createProjectZip(), downloadBlob(blob, name), safeDownloadName(text)
 *   copyText(text, doneMessage)
 *   activateGuestState(state), leaveGuest(), saveGuest(name)
 *   uniqueProjectName(base), readOtherProjects() → Promise<state[]>
 *   hideMenus()
 */
export function setupShare(host) {
  let guest = null; // { name, from, idyllium, missing: [{path,size}], restored: number }

  // ─── отправитель ─────────────────────────────────────────────────────────

  async function collectProject(scope, from) {
    host.saveCurrentEditor();
    const current = host.currentFile();
    const textFiles = [];
    const assets = [];
    for (const [path, item] of [...files.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
      const short = shortFileName(path);
      if (scope === 'file' && path !== current) continue;
      if (item.kind === 'asset') {
        const bytes = assetBytes(item);
        assets.push({ path: short, size: bytes.length, sha: await fingerprint(bytes) });
      } else {
        textFiles.push({ path: short, text: item.content || '' });
      }
    }
    return {
      name: scope === 'file' ? shortFileName(current) : host.projectName(),
      from,
      idyllium: host.idylliumVersion(),
      current: shortFileName(current),
      files: textFiles,
      assets: assets.filter((asset) => asset.sha !== ''),
    };
  }

  async function knownHandouts() {
    try {
      const response = await fetch(`${siteBaseUrl()}${HANDOUTS_URL}fingerprints.json`, { cache: 'force-cache' });
      if (!response.ok) return {};
      return await response.json();
    } catch (_error) {
      return {}; // офлайн-копия или локальная сборка без раздатки — просто не знаем
    }
  }

  /** Ответ прямо на кнопке: строка статуса IDE лежит под модалкой, её не видно. */
  function flashButton(button, text, ok) {
    if (button.dataset.label === undefined) button.dataset.label = button.textContent;
    window.clearTimeout(Number(button.dataset.timer || 0));
    button.textContent = text;
    button.classList.toggle('is-done', ok);
    button.classList.toggle('is-failed', !ok);
    button.dataset.timer = String(window.setTimeout(() => {
      button.textContent = button.dataset.label;
      button.classList.remove('is-done', 'is-failed');
    }, 2200));
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_error) {
      // нет разрешения — пробуем старым способом
    }
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch (_error) { done = false; }
    scratch.remove();
    return done;
  }

  /**
   * Диалог «Поделиться»: три карточки — три ответа на вопрос «как именно я хочу
   * поделиться»: ZIP-архивом, ссылкой, QR-кодом (вердикт владельца 2026-09-18).
   */
  async function openShareDialog() {
    host.hideMenus();
    const api = shareApi();
    const currentItem = files.get(host.currentFile());
    const canShareFile = Boolean(currentItem && currentItem.kind !== 'asset');
    let scope = readStored(SCOPE_STORAGE_KEY) === 'file' && canShareFile ? 'file' : 'project';

    host.modal.replaceChildren();
    const card = element('div', 'file-props-card share-card');
    const head = element('div', 'share-head');
    head.appendChild(element('h3', 'file-props-title', 'Поделиться'));
    const closeButton = element('button', 'share-close', 'Закрыть');
    closeButton.type = 'button';
    head.appendChild(closeButton);
    card.appendChild(head);

    const ways = element('div', 'share-ways');
    card.appendChild(ways);

    // ── 1. ZIP-архивом ──
    const zipWay = element('section', 'share-way');
    zipWay.appendChild(element('h4', 'share-way-title', 'ZIP-архивом'));
    zipWay.appendChild(element('p', 'share-way-lead',
      'В архив войдут все файлы проекта: программы, картинки, музыка, шрифты, базы данных — всё как у вас, с папками.'));
    zipWay.appendChild(element('p', 'share-way-lead',
      'Получатель открывает архив в Web IDE: «Файл → Открыть файл». Это единственный способ, которому не важен размер проекта.'));
    const zipSize = element('p', 'share-way-fact');
    zipWay.appendChild(zipSize);
    const zipButtons = element('div', 'share-way-actions');
    const downloadButton = element('button', 'share-primary', 'Скачать проект');
    downloadButton.type = 'button';
    zipButtons.appendChild(downloadButton);
    let zipFileForShare = null;
    const systemShareButton = element('button', '', 'Отправить…');
    systemShareButton.type = 'button';
    systemShareButton.title = 'Системное «Поделиться»: архив уходит прямо в мессенджер или почту';
    // Кнопка появляется, только если браузер умеет отдавать файлы в системное «Поделиться»
    // (телефоны, Safari, Chrome под Windows и ChromeOS). Именно ДОБАВЛЯЕТСЯ, а не прячется
    // атрибутом hidden: общий стиль IDE `button { display: inline-flex }` этот атрибут перебивает —
    // так кнопка и оказалась на виду мёртвой (находка владельца).
    zipWay.appendChild(zipButtons);

    // ── 2. Ссылкой ──
    const linkWay = element('section', 'share-way share-way-link');
    linkWay.appendChild(element('h4', 'share-way-title', 'Ссылкой'));
    linkWay.appendChild(element('p', 'share-way-lead',
      'Текст проекта упакован прямо в ссылку: получатель открывает её — и проект собирается у него. '
      + 'Сервера нет: код видят только те, кому вы её отправите.'));

    const scopeRow = element('div', 'share-scope');
    const scopeButtons = {};
    for (const [value, label] of [['project', 'Весь проект'], ['file', `Только ${shortFileName(host.currentFile())}`]]) {
      const button = element('button', 'share-scope-button', label);
      button.type = 'button';
      button.disabled = value === 'file' && !canShareFile;
      button.addEventListener('click', () => { scope = value; writeStored(SCOPE_STORAGE_KEY, scope); refresh(); });
      scopeButtons[value] = button;
      scopeRow.appendChild(button);
    }
    linkWay.appendChild(scopeRow);

    const fromLabel = element('label', 'share-field');
    fromLabel.appendChild(element('span', '', 'От кого (необязательно)'));
    const fromInput = element('input');
    fromInput.type = 'text';
    fromInput.maxLength = 60;
    fromInput.placeholder = 'Петя И., 7Б';
    fromInput.value = readStored(FROM_STORAGE_KEY);
    fromLabel.appendChild(fromInput);
    linkWay.appendChild(fromLabel);

    const linkBox = element('textarea', 'share-link');
    linkBox.readOnly = true;
    linkBox.rows = 4;
    linkBox.spellcheck = false;
    linkBox.addEventListener('focus', () => linkBox.select());
    linkWay.appendChild(linkBox);
    const verdictLine = element('p', 'share-verdict');
    linkWay.appendChild(verdictLine);
    const assetsNote = element('div', 'share-assets');
    linkWay.appendChild(assetsNote);
    const linkButtons = element('div', 'share-way-actions');
    const copyButton = element('button', 'share-primary', 'Скопировать ссылку');
    copyButton.type = 'button';
    linkButtons.appendChild(copyButton);
    linkWay.appendChild(linkButtons);

    // ── 3. QR-кодом ──
    const qrWay = element('section', 'share-way');
    qrWay.appendChild(element('h4', 'share-way-title', 'QR-кодом'));
    qrWay.appendChild(element('p', 'share-way-lead', 'Та же ссылка, только картинкой: её не разрежет мессенджер и можно показать с экрана.'));
    const qrStage = element('div', 'share-qr-stage');
    const canvas = element('canvas', 'share-qr-canvas');
    const qrEmpty = element('p', 'share-qr-empty');
    qrStage.append(canvas, qrEmpty);
    qrWay.appendChild(qrStage);
    const qrNote = element('p', 'share-way-fact');
    qrWay.appendChild(qrNote);
    const qrButtons = element('div', 'share-way-actions');
    const saveImage = element('button', '', 'Скачать картинку');
    saveImage.type = 'button';
    const copyImage = element('button', 'share-primary', 'Скопировать картинку');
    copyImage.type = 'button';
    const canCopyImage = Boolean(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
    if (canCopyImage) qrButtons.appendChild(copyImage);
    else saveImage.classList.add('share-primary');
    qrButtons.appendChild(saveImage);
    qrWay.appendChild(qrButtons);

    ways.append(zipWay, linkWay, qrWay);

    let refreshToken = 0;
    const handoutsPromise = knownHandouts();

    async function refreshQr(link, token) {
      const showEmpty = (text) => {
        canvas.hidden = true;
        qrEmpty.hidden = false;
        qrEmpty.textContent = text;
        qrNote.textContent = '';
        saveImage.disabled = true;
        copyImage.disabled = true;
      };
      if (link === '') { showEmpty('Кода нет: сначала нужна ссылка.'); return; }
      if (link.length > QR_MAX_CHARS) {
        showEmpty(`В QR-код помещается до ${QR_MAX_CHARS.toLocaleString('ru-RU')} символов, а в ссылке ${link.length.toLocaleString('ru-RU')}. Такой проект отправляют ZIP-архивом.`);
        return;
      }
      try {
        await drawQr(canvas, link, 720);
      } catch (error) {
        if (token === refreshToken) showEmpty(error instanceof Error ? error.message : String(error));
        return;
      }
      if (token !== refreshToken) return;
      canvas.hidden = false;
      qrEmpty.hidden = true;
      saveImage.disabled = false;
      copyImage.disabled = false;
      qrNote.textContent = link.length <= QR_CAMERA_COMFORT_CHARS
        ? 'Код можно считать камерой телефона прямо с экрана — откроется Web IDE с этим проектом.'
        : 'Код плотный: камера с экрана его, скорее всего, не возьмёт — отправляйте картинкой. Получатель откроет её через «Файл → Открыть проект из QR-картинки…»; пережатие в мессенджере код выдерживает.';
    }

    async function refresh() {
      const token = ++refreshToken;
      for (const [value, button] of Object.entries(scopeButtons)) button.classList.toggle('is-active', value === scope);
      let project;
      let link;
      try {
        project = await collectProject(scope, fromInput.value.trim());
        if (project.files.length === 0) throw new Error('В проекте нет текстовых файлов — ссылкой отправлять нечего. Отправьте проект ZIP-архивом.');
        link = `${siteBaseUrl()}#${api.encodeProjectLink(project)}`;
      } catch (error) {
        if (token !== refreshToken) return;
        linkBox.value = '';
        copyButton.disabled = true;
        assetsNote.replaceChildren();
        verdictLine.className = 'share-verdict is-bad';
        verdictLine.textContent = error instanceof api.ShareLinkError
          ? 'Проект слишком велик для ссылки — отправьте его ZIP-архивом.'
          : (error instanceof Error ? error.message : String(error));
        await refreshQr('', token);
        return;
      }
      if (token !== refreshToken) return;
      linkBox.value = link;
      copyButton.disabled = false;
      const [tone, text] = VERDICT_TEXT[api.shareLengthVerdict(link.length)];
      verdictLine.className = `share-verdict is-${tone}`;
      verdictLine.textContent = `${link.length.toLocaleString('ru-RU')} символов. ${text}`;
      const qrDone = refreshQr(link, token);

      assetsNote.replaceChildren();
      if (project.assets.length > 0) {
        const handouts = await handoutsPromise;
        if (token !== refreshToken) return;
        const own = project.assets.filter((asset) => !handouts[asset.sha]);
        const total = project.assets.length;
        const summary = own.length === 0
          ? `Картинки, звук и другие нетекстовые файлы (${total}) в ссылку не кладутся — и не нужно: все они из раздатки сайта, у получателя скачаются сами.`
          : `Нетекстовые файлы (${total}) в ссылку не кладутся. Из раздатки сайта — ${total - own.length}, они скачаются у получателя сами. `
            + `Своих файлов — ${own.length}: получатель увидит проект без них, если таких файлов нет в его собственных проектах. Надёжнее — ZIP-архивом.`;
        assetsNote.appendChild(element('p', own.length === 0 ? 'share-assets-note' : 'share-assets-note is-warn', summary));
        if (own.length > 0) {
          const list = element('ul', 'share-assets-list');
          for (const asset of own.slice(0, 6)) list.appendChild(element('li', '', `${asset.path} · ${formatBytes(asset.size)}`));
          if (own.length > 6) list.appendChild(element('li', '', `…и ещё ${own.length - 6}`));
          assetsNote.appendChild(list);
        }
      }
      await qrDone;
    }

    // Архив собираем заранее: и размер показать, и системное «Поделиться» должно
    // сработать прямо в клике — после долгого await браузер счёл бы жест потерянным.
    const zipReady = host.createProjectZip().then((blob) => {
      const name = `${host.safeDownloadName(host.projectName())}.zip`;
      zipSize.textContent = `Размер архива: ${formatBytes(blob.size)}.`;
      try {
        const file = new File([blob], name, { type: 'application/zip' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          zipFileForShare = file;
          zipButtons.appendChild(systemShareButton);
        }
      } catch (_error) {
        // нет File/canShare — остаётся скачивание
      }
      return { blob, name };
    });

    downloadButton.addEventListener('click', () => {
      zipReady.then(({ blob, name }) => {
        host.downloadBlob(blob, name);
        flashButton(downloadButton, 'Скачано ✓', true);
      }, () => flashButton(downloadButton, 'Не удалось собрать архив', false));
    });
    systemShareButton.addEventListener('click', () => {
      if (!zipFileForShare) return;
      navigator.share({ files: [zipFileForShare], title: host.projectName() }).then(
        () => flashButton(systemShareButton, 'Отправлено ✓', true),
        (error) => { if (!error || error.name !== 'AbortError') flashButton(systemShareButton, 'Не вышло — скачайте архив', false); },
      );
    });
    copyButton.addEventListener('click', async () => {
      const done = await copyTextToClipboard(linkBox.value);
      flashButton(copyButton, done ? 'Скопировано ✓' : 'Не удалось — выделите и Ctrl+C', done);
      if (!done) { linkBox.focus(); linkBox.select(); }
    });
    saveImage.addEventListener('click', () => canvas.toBlob((blob) => {
      if (!blob) { flashButton(saveImage, 'Не удалось', false); return; }
      host.downloadBlob(blob, `${host.safeDownloadName(host.projectName())}-qr.png`);
      flashButton(saveImage, 'Скачано ✓', true);
    }, 'image/png'));
    copyImage.addEventListener('click', () => canvas.toBlob((blob) => {
      if (!blob) { flashButton(copyImage, 'Не удалось', false); return; }
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]).then(
        () => flashButton(copyImage, 'Скопировано ✓', true),
        () => flashButton(copyImage, 'Браузер не дал — скачайте', false),
      );
    }, 'image/png'));
    fromInput.addEventListener('input', () => { writeStored(FROM_STORAGE_KEY, fromInput.value.trim()); refresh(); });
    closeButton.addEventListener('click', () => { host.modal.hidden = true; });

    host.modal.appendChild(card);
    host.modal.hidden = false;
    copyButton.focus();
    await refresh();
  }

  // ─── получатель ──────────────────────────────────────────────────────────

  /** «Открыть проект из QR-картинки»: файл, вставка из буфера (Ctrl+V) или перетаскивание в окошко. */
  function openQrReader() {
    host.hideMenus();
    host.modal.replaceChildren();
    const card = element('div', 'file-props-card share-reader-card');
    card.appendChild(element('h3', 'file-props-title', 'Открыть проект из QR-картинки'));
    card.appendChild(element('p', 'share-lead',
      'Вам прислали проект QR-кодом? Выберите картинку, вставьте её из буфера (Ctrl+V) или перетащите сюда. '
      + 'Подойдёт и снимок экрана, на котором виден код.'));
    const drop = element('div', 'share-qr-drop', 'Перетащите картинку сюда или нажмите Ctrl+V');
    drop.tabIndex = 0;
    card.appendChild(drop);
    const verdict = element('p', 'share-verdict');
    verdict.hidden = true;
    card.appendChild(verdict);
    const picker = element('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.hidden = true;
    card.appendChild(picker);
    const actions = element('div', 'file-props-actions share-actions');
    const choose = element('button', 'share-primary', 'Выбрать картинку…');
    choose.type = 'button';
    const close = element('button', '', 'Закрыть');
    close.type = 'button';
    actions.append(choose, close);
    card.appendChild(actions);

    const say = (tone, text) => { verdict.hidden = false; verdict.className = `share-verdict is-${tone}`; verdict.textContent = text; };
    const finish = () => {
      document.removeEventListener('paste', onPaste, true);
      host.modal.hidden = true;
    };
    async function take(blob) {
      if (!blob || !String(blob.type).startsWith('image/')) { say('bad', 'Это не картинка.'); return; }
      say('warn', 'Ищу QR-код на картинке…');
      let text;
      try {
        text = await readQrFromBlob(blob);
      } catch (error) {
        say('bad', error instanceof Error ? error.message : String(error));
        return;
      }
      if (text === null) { say('bad', 'QR-кода на картинке не нашлось. Если это фотография экрана — попросите прислать сам файл картинки.'); return; }
      const hashAt = text.indexOf('#');
      const fragment = hashAt >= 0 ? text.slice(hashAt) : '';
      if (!shareApi().looksLikeProjectLink(fragment)) { say('bad', `В этом QR-коде не проект Idyllium, а: ${text.slice(0, 120)}`); return; }
      finish();
      // Дальше — тот же путь, что у ссылки из адресной строки.
      if (window.location.hash === fragment) await openFromAddress(); else window.location.hash = fragment;
    }
    function onPaste(event) {
      // Окошко могли закрыть щелчком по фону или Esc — тогда вставка снова принадлежит редактору.
      if (host.modal.hidden || !host.modal.contains(card)) { document.removeEventListener('paste', onPaste, true); return; }
      const item = [...(event.clipboardData ? event.clipboardData.items : [])].find((entry) => entry.type.startsWith('image/'));
      if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      take(item.getAsFile());
    }

    document.addEventListener('paste', onPaste, true);
    choose.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => take(picker.files[0]));
    close.addEventListener('click', finish);
    drop.addEventListener('dragover', (event) => { event.preventDefault(); event.stopPropagation(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation(); // иначе IDE добавит картинку в проект — здесь она нужна не за этим
      drop.classList.remove('is-over');
      take(event.dataTransfer && event.dataTransfer.files[0]);
    });

    host.modal.appendChild(card);
    host.modal.hidden = false;
    choose.focus();
  }

  /** Байты по отпечатку: сначала собственные проекты, потом раздатка сайта. */
  async function findAssetBytes(notes) {
    const found = new Map();
    const wanted = new Map(notes.map((note) => [note.sha, note]));
    if (wanted.size === 0) return found;

    try {
      for (const state of await host.readOtherProjects()) {
        for (const entry of Array.isArray(state.files) ? state.files : []) {
          if (entry.kind !== 'asset' || wanted.size === found.size) continue;
          const bytes = assetBytes(entry);
          // Хеш — дорогая операция: считаем только у файлов подходящего размера.
          const candidates = [...wanted.values()].filter((note) => !found.has(note.sha) && note.size === bytes.length);
          if (candidates.length === 0) continue;
          const sha = await fingerprint(bytes);
          if (wanted.has(sha) && !found.has(sha)) found.set(sha, bytes);
        }
      }
    } catch (_error) {
      // хранилище недоступно — остаётся раздатка
    }

    if (found.size < wanted.size) {
      const handouts = await knownHandouts();
      for (const note of wanted.values()) {
        const known = handouts[note.sha];
        if (found.has(note.sha) || !known || typeof known.file !== 'string') continue;
        try {
          const response = await fetch(`${siteBaseUrl()}${HANDOUTS_URL}files/${encodeURIComponent(known.file)}`);
          if (!response.ok) continue;
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (await fingerprint(bytes) === note.sha) found.set(note.sha, bytes);
        } catch (_error) {
          // нет сети — файл останется в списке недостающих
        }
      }
    }
    return found;
  }

  async function openFromAddress() {
    const fragment = window.location.hash;
    let api;
    try { api = shareApi(); } catch (_error) { return false; }
    if (!api.looksLikeProjectLink(fragment)) return false;

    let project;
    try {
      project = api.decodeProjectLink(fragment);
    } catch (error) {
      const text = error instanceof api.ShareLinkError ? PROBLEM_TEXT[error.problem] : 'Ссылку не удалось прочитать.';
      setStatus('Проект по ссылке не открылся', true);
      appendOutput(`${text}\n`, 'output-error');
      clearAddress();
      return false;
    }

    setStatus('Открываю проект по ссылке…');
    const bytesBySha = await findAssetBytes(project.assets);
    const stateFiles = project.files.map((file) => ({
      path: normalizeWorkspacePath(file.path), kind: 'text', content: file.text, bytes: null, resourceUri: '',
    }));
    const missing = [];
    for (const note of project.assets) {
      const bytes = bytesBySha.get(note.sha);
      if (!bytes) { missing.push(note); continue; }
      stateFiles.push({
        path: normalizeWorkspacePath(note.path), kind: 'asset', content: '', bytes, resourceUri: bytesToDataUrl(note.path, bytes),
      });
    }
    const folderSet = new Set();
    for (const entry of stateFiles) {
      const parts = shortFileName(entry.path).split('/');
      parts.pop();
      for (let depth = 1; depth <= parts.length; depth += 1) folderSet.add(`${WORKSPACE_ROOT}/${parts.slice(0, depth).join('/')}`);
    }

    guest = {
      name: project.name || 'Проект по ссылке',
      from: project.from,
      idyllium: project.idyllium,
      missing,
      restored: project.assets.length - missing.length,
    };
    host.activateGuestState({
      version: 2,
      currentFile: normalizeWorkspacePath(project.current) || MAIN_FILE,
      savedAt: new Date().toISOString(),
      folders: [...folderSet],
      expandedFolders: [...folderSet],
      files: stateFiles,
    }, guest.from ? `${guest.name} — ${guest.from}` : guest.name);
    renderBanner();
    setStatus('Открыт проект по ссылке — у вас он пока не сохранён');
    return true;
  }

  function clearAddress() {
    if (window.location.hash === '') return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function syncBannerHeight() {
    // Рабочая область считает свою высоту от окна: баннер отдаёт ей своё место.
    document.documentElement.style.setProperty('--guest-banner-height', host.banner.hidden ? '0px' : `${host.banner.offsetHeight}px`);
    window.dispatchEvent(new Event('idyllium-layout-changed'));
  }

  function renderBanner() {
    host.banner.replaceChildren();
    if (!guest) {
      host.banner.hidden = true;
      syncBannerHeight();
      return;
    }
    const text = element('div', 'guest-banner-text');
    text.appendChild(element('strong', '', 'Работа по ссылке'));
    text.appendChild(element('span', '', ` · «${guest.name}»${guest.from ? ` — от: ${guest.from}` : ''} · у вас не сохранена`));
    const details = [];
    const ownVersion = host.idylliumVersion();
    if (guest.idyllium && ownVersion && versionIsNewer(guest.idyllium, ownVersion)) {
      // Старее — не беда: язык читает старые программы. Новее — у получателя залежалая копия сайта.
      details.push(`Автор работал в Idyllium ${guest.idyllium}, у вас ${ownVersion} — если программа не собирается, обновите страницу (Ctrl+F5).`);
    }
    if (guest.restored > 0) details.push(`Файлов восстановлено по отпечатку (раздатка сайта и ваши проекты): ${guest.restored}.`);
    if (guest.missing.length > 0) {
      const names = guest.missing.slice(0, 5).map((note) => `${note.path} (${formatBytes(note.size)})`).join(', ');
      details.push(`Не хватает файлов: ${names}${guest.missing.length > 5 ? ` и ещё ${guest.missing.length - 5}` : ''}. `
        + 'В ссылке едет только текст — попросите автора прислать проект файлом.');
    }
    if (details.length > 0) text.appendChild(element('p', guest.missing.length > 0 ? 'guest-banner-details is-warn' : 'guest-banner-details', details.join(' ')));

    const buttons = element('div', 'guest-banner-actions');
    const save = element('button', 'share-primary', 'Сохранить к себе');
    save.type = 'button';
    save.addEventListener('click', () => {
      const base = guest.from ? `${guest.name} — ${guest.from}` : guest.name;
      host.saveGuest(host.uniqueProjectName(base)).catch((error) => setStatus(error instanceof Error ? error.message : String(error), true));
    });
    const close = element('button', '', 'Закрыть');
    close.type = 'button';
    close.title = 'Вернуться к своему проекту; работа по ссылке не сохранится';
    close.addEventListener('click', () => host.leaveGuest().catch((error) => setStatus(error instanceof Error ? error.message : String(error), true)));
    buttons.append(save, close);
    host.banner.append(text, buttons);
    host.banner.hidden = false;
    syncBannerHeight();
  }

  /** Ядро сообщает: гость закончился (сохранён, закрыт или открыт другой проект). */
  function guestEnded() {
    if (!guest) return;
    guest = null;
    clearAddress();
    renderBanner();
  }

  window.addEventListener('hashchange', () => { openFromAddress().catch(() => {}); });
  window.addEventListener('resize', () => { if (guest) syncBannerHeight(); });

  return { openShareDialog, openQrReader, openFromAddress, guestEnded, isGuest: () => guest !== null };
}
