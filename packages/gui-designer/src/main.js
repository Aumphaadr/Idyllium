// Конструктор GUI Idyllium (1.6.3). Спека — Idyllium-backstage/tech/spec/some_gui_designer/01,
// вердикты владельца 2026-09-25 (§8) и замечания по первой пробе (§9): сцена — НАСТОЯЩИЙ прогон
// сгенерированной программы в кадре gui-preview.html (том же, что у Web IDE), поверх него
// прозрачный слой с рамками и ручками; имена латиницей (button1…); заготовки обработчиков —
// галочками на каждое событие каждого виджета; сетка 5 px с выключателем; панели тянутся
// сплиттерами; в инспекторе всегда видно имя свойства, перевод — при наведении.
// Модель хранит только явно выставленные свойства; код — идиома учебника (src/codegen.js).
import { WIDGETS, WINDOW_PROPS, PALETTE_GROUPS, PROPERTY_GROUPS, TAB_PAGE_TYPE, ICON_NAMES, widgetDefinition, propertyOf, eventsOf, nameProblem, freeName } from './widgets.js';
import { MODEL_VERSION, generateCode, normalizeHex, stripModel, extractEmbeddedModel, stripEmbeddedModel, codeDifference, childrenOf, fontsOf, withoutMissingFonts } from './codegen.js';
import { ALIGN_MODES, moveSubtree, selectionRoots, alignBoxes } from './model-ops.js';
import { importProgram } from './import.js';
import { createColorPicker } from '../../web-ide/src/color-picker.js';
import { zipBytes } from '../../web-ide/src/zip-write.js';

const STORAGE_KEY = 'idyllium-gui-designer';
const FILES_DB_NAME = 'idyllium-gui-designer-files'; // байты файлов шрифтов — в IndexedDB, макет их знает по именам
const FILES_DB_STORE = 'files';
const THEME_KEY = 'idyllium-docs-theme';
const CLIPBOARD_MARK = 'idyllium-gui-designer-clipboard:';
const WINDOW_TITLE_HEIGHT = 28;
const MIN_SIZE = 8;

const api = window.Idyllium;
const $ = (id) => document.getElementById(id);
const els = {
  designer: $('designer'), palette: $('palette-groups'), scene: $('scene'), preview: $('preview'), overlay: $('overlay'), inline: $('inline-editor'),
  tree: $('tree'), inspector: $('inspector'), inspectorTitle: $('inspector-title'), code: $('code'), status: $('status'),
  undo: $('undo'), redo: $('redo'), newDesign: $('new-design'), gridToggle: $('grid-toggle'), gridSize: $('grid-size'),
  embedToggle: $('embed-model-toggle'), openIde: $('open-ide'), copyCode: $('copy-code'), downloadCode: $('download-code'),
  saveModel: $('save-model'), openModel: $('open-model'), openModelInput: $('open-model-input'), contextMenu: $('context-menu'),
  stagePane: $('stage-pane'), codePane: $('code-pane'), codeCollapse: $('code-collapse'), moreMenu: $('more-menu'),
  dialog: $('dialog'), dialogTitle: $('dialog-title'), dialogBody: $('dialog-body'), dialogOk: $('dialog-ok'), dialogCancel: $('dialog-cancel'),
  fontInput: $('font-file-input'),
};

// ─── состояние ───────────────────────────────────────────────────────────────
let model = null;
let selectedId = null;          // id «главного» виджета выделения или null (выбрано окно)
let selection = new Set();      // все выделенные виджеты (порядок вставки = порядок выделения; первый — опора выравнивания)
let treeDrag = null;            // перетаскивание строки дерева: { id, startX, startY, moved, target, ghost }
let marquee = null;             // рамка выделения на сцене (элемент)
let fontFiles = new Map();      // имя файла шрифта → Uint8Array (IndexedDB + память)
let pendingFontTarget = null;   // куда присвоить добавляемый шрифт: { id: виджет|null, prop }
let history = [];
let future = [];
let ui = { grid: true, gridSize: 5, embedModel: false, codeCollapsed: false, layout: { palette: 236, side: 340, code: 232, tree: 34 } };
let previewTabs = {};           // id вкладок → индекс страницы, которую правят
let lastRects = new Map();      // id → {left, top, width, height} в координатах сцены
let lastOrigins = new Map();    // id → {left, top}: точка отсчёта x/y виджета в координатах сцены (из кадра)
let tabOrigins = new Map();     // id вкладок → точка отсчёта их страниц (ниже полосы вкладок)
let contentRect = null;         // прямоугольник содержимого окна
let frameReady = false;
let runToken = 0;
let runTimer = null;
let memoryClipboard = null;
let dragging = null;            // { kind: 'move'|'resize'|'place', ... }
let colorPanel = null;          // общий генератор цвета — живая модалка
let colorBinding = null;        // { id: виджет|null, prop, before: снимок, dirty }

function newModel() {
  return {
    version: MODEL_VERSION,
    window: { name: 'win', props: { title: 'Окно', width: 640, height: 420 }, handlers: [] },
    widgets: [],
  };
}

function widgetById(id) {
  return model.widgets.find((item) => item.id === id) || null;
}

function nextId() {
  return model.widgets.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function takenNames() {
  return [model.window.name, ...model.widgets.map((item) => item.name), ...fontsOf(model).map((font) => font.name)];
}

/** Выделение после отмены/загрузки: только живые виджеты. */
function pruneSelection() {
  selection = new Set([...selection].filter((id) => widgetById(id)));
  if (selectedId !== null && !widgetById(selectedId)) selectedId = selection.size > 0 ? [...selection][selection.size - 1] : null;
}

function descendants(id) {
  const result = [];
  const walk = (parentId) => {
    for (const child of childrenOf(model, parentId)) {
      result.push(child);
      walk(child.id);
    }
  };
  walk(id);
  return result;
}

function isAncestor(maybeAncestorId, id) {
  let current = widgetById(id);
  while (current && current.parent !== null) {
    if (current.parent === maybeAncestorId) return true;
    current = widgetById(current.parent);
  }
  return false;
}

// ─── история ─────────────────────────────────────────────────────────────────
function snapshot() {
  return JSON.stringify(stripModel(model));
}

function applyChange(mutate, { silent = false } = {}) {
  const before = snapshot();
  mutate();
  const after = snapshot();
  if (after !== before) {
    history.push(before);
    if (history.length > 200) history.shift();
    future = [];
  }
  refresh({ silent });
}

function undo() {
  if (history.length === 0) return;
  future.push(snapshot());
  model = JSON.parse(history.pop());
  pruneSelection();
  refresh();
}

function redo() {
  if (future.length === 0) return;
  history.push(snapshot());
  model = JSON.parse(future.pop());
  pruneSelection();
  refresh();
}

// ─── хранение ────────────────────────────────────────────────────────────────
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: stripModel(model), ui, previewTabs }));
  } catch (error) { /* приватный режим — макет живёт до перезагрузки */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const loaded = validateModel(saved.model);
    if (!loaded) return false;
    model = loaded;
    const savedUi = saved.ui || {};
    ui = { ...ui, ...savedUi, layout: { ...ui.layout, ...(savedUi.layout || {}) } };
    previewTabs = saved.previewTabs || {};
    return true;
  } catch (error) {
    return false;
  }
}

/** Модель из файла/хранилища — с проверкой, чтобы чужой JSON не уронил конструктор. */
function validateModel(raw) {
  if (!raw || typeof raw !== 'object' || !raw.window || !Array.isArray(raw.widgets)) return null;
  const result = { version: MODEL_VERSION, window: { name: 'win', props: {}, handlers: [] }, widgets: [] };
  if (typeof raw.window.name === 'string' && !nameProblem(raw.window.name, [])) result.window.name = raw.window.name;
  result.window.props = cleanProps('Window', raw.window.props);
  result.window.handlers = cleanHandlers('Window', raw.window.handlers);
  const ids = new Set();
  for (const item of raw.widgets) {
    if (!item || typeof item !== 'object' || !WIDGETS[item.type] || typeof item.id !== 'number' || ids.has(item.id)) continue;
    ids.add(item.id);
    const widget = {
      id: item.id,
      type: item.type,
      name: typeof item.name === 'string' && !nameProblem(item.name, []) ? item.name : `${WIDGETS[item.type].defaultName}${item.id}`,
      parent: typeof item.parent === 'number' ? item.parent : null,
      props: cleanProps(item.type, item.props),
      handlers: cleanHandlers(item.type, item.handlers),
    };
    if (typeof item.tabTitle === 'string') widget.tabTitle = item.tabTitle;
    const data = cleanData(item.type, item.data);
    if (data) widget.data = data;
    result.widgets.push(widget);
  }
  for (const widget of result.widgets) {
    if (widget.parent !== null && !ids.has(widget.parent)) widget.parent = null;
  }
  const names = new Set();
  for (const widget of result.widgets) {
    if (names.has(widget.name) || widget.name === result.window.name) widget.name = freeName(WIDGETS[widget.type].defaultName, [...names, result.window.name]);
    names.add(widget.name);
  }
  // Шрифты: имя переменной + имя файла; свойство font без такого шрифта снимается.
  const fonts = [];
  for (const font of Array.isArray(raw.fonts) ? raw.fonts : []) {
    if (!font || typeof font.name !== 'string' || typeof font.file !== 'string' || font.file.trim() === '') continue;
    if (nameProblem(font.name, [result.window.name, ...names, ...fonts.map((known) => known.name)])) continue;
    fonts.push({ name: font.name, file: font.file });
  }
  if (fonts.length > 0) result.fonts = fonts;
  const fontNames = new Set(fonts.map((font) => font.name));
  const dropUnknownFont = (props) => { if (props.font !== undefined && !fontNames.has(props.font)) delete props.font; };
  dropUnknownFont(result.window.props);
  for (const widget of result.widgets) dropUnknownFont(widget.props);
  return result;
}

function cleanProps(type, props) {
  const result = {};
  if (!props || typeof props !== 'object') return result;
  for (const [name, value] of Object.entries(props)) {
    const prop = propertyOf(type, name);
    if (!prop || value === null || value === undefined || value === '') continue;
    if ((prop.kind === 'int' || prop.kind === 'float') && !Number.isFinite(Number(value))) continue;
    if (prop.kind === 'enum' && !prop.values.includes(value)) continue;
    if (prop.kind === 'font' && typeof value !== 'string') continue;
    result[name] = prop.kind === 'bool' ? Boolean(value) : prop.kind === 'int' ? Math.round(Number(value)) : prop.kind === 'float' ? Number(value) : prop.kind === 'color' ? normalizeHex(value) : String(value);
  }
  return result;
}

/** Данные виджета (пункты, колонки и строки, значения, точки) — только нужной формы. */
function cleanData(type, raw) {
  const def = WIDGETS[type];
  if (!def || !def.data || !raw || typeof raw !== 'object') return null;
  const strings = (list) => (Array.isArray(list) ? list.filter((item) => typeof item === 'string' || typeof item === 'number').map(String) : []);
  const numbers = (list) => (Array.isArray(list) ? list.map(Number).filter((item) => Number.isFinite(item)) : []);
  switch (def.data.shape) {
    case 'strings': return { items: strings(raw.items) };
    case 'table': return { columns: strings(raw.columns), rows: (Array.isArray(raw.rows) ? raw.rows : []).map((row) => strings(row)) };
    case 'entries': return { entries: (Array.isArray(raw.entries) ? raw.entries : []).filter((entry) => entry && typeof entry === 'object').map((entry) => ({ label: String(entry.label ?? ''), value: Number.isFinite(Number(entry.value)) ? Number(entry.value) : 0 })) };
    case 'numbers': return { points: numbers(raw.points) };
    default: return null;
  }
}

/** Стартовые данные нового виджета — чтобы список, таблица и диаграмма сразу были видны на сцене. */
function sampleData(def) {
  switch (def.data && def.data.shape) {
    case 'strings': return { items: ['Пункт 1', 'Пункт 2', 'Пункт 3'] };
    case 'table': return { columns: ['Имя', 'Значение'], rows: [['Мира', '12'], ['Кай', '9']] };
    case 'entries': return { entries: [{ label: 'Мира', value: 340 }, { label: 'Кай', value: 120 }, { label: 'Ника', value: 210 }] };
    case 'numbers': return { points: [3, 5, 4, 8, 6] };
    default: return null;
  }
}

function cleanHandlers(type, handlers) {
  if (!Array.isArray(handlers)) return [];
  const known = eventsOf(type).map((event) => event.name);
  return handlers.filter((name) => known.includes(name));
}

// ─── тема страницы и кадра ───────────────────────────────────────────────────
function applyTheme(light) {
  document.body.classList.toggle('light-theme', light);
  const toggle = $('theme-toggle');
  if (toggle) {
    const hint = light ? 'Тёмная тема' : 'Светлая тема';
    toggle.title = hint;
    toggle.setAttribute('aria-label', hint);
  }
  postToPreview({ type: 'theme', theme: light ? 'light' : 'dark' });
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (error) { /* нет хранилища */ }
  applyTheme(saved === 'light');
  const toggle = $('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* нет хранилища */ }
      applyTheme(next === 'light');
    });
  }
}

// ─── диалог вместо браузерного confirm ───────────────────────────────────────
let dialogResolve = null;

function showDialog({ title, body, ok = 'Да', cancel = 'Отмена' }) {
  els.dialogTitle.textContent = title;
  els.dialogBody.replaceChildren();
  if (typeof body === 'string') {
    const paragraph = document.createElement('p');
    paragraph.textContent = body;
    els.dialogBody.appendChild(paragraph);
  } else {
    els.dialogBody.appendChild(body);
  }
  els.dialogOk.textContent = ok;
  els.dialogCancel.textContent = cancel;
  els.dialogCancel.hidden = cancel === null;
  els.dialog.hidden = false;
  els.dialogOk.focus();
  return new Promise((resolve) => { dialogResolve = resolve; });
}

function closeDialog(result) {
  if (!dialogResolve) return;
  const resolve = dialogResolve;
  dialogResolve = null;
  els.dialog.hidden = true;
  resolve(result);
}

// ─── кадр предпросмотра: прогон программы ────────────────────────────────────
function postToPreview(message) {
  if (!els.preview.contentWindow) return;
  els.preview.contentWindow.postMessage(message, '*');
}

function previewDocument() {
  try {
    return els.preview.contentDocument || null;
  } catch (error) {
    return null;
  }
}

function currentCode(forPreview) {
  if (!forPreview) return generateCode(model, { embedModel: ui.embedModel });
  // Предпросмотр: шрифты, файлов которых нет в этом браузере, не грузим — окно покажется без них.
  return generateCode(withoutMissingFonts(model, (file) => fontFiles.has(file)).model, { previewTabs });
}

/** Файлы для прогона предпросмотра: программа + байты шрифтов, которые у нас есть. */
function previewFiles(code) {
  const files = { 'main.idyl': code };
  for (const font of fontsOf(model)) {
    const bytes = fontFiles.get(font.file);
    if (bytes) files[font.file] = { bytes };
  }
  return files;
}

function scheduleRun(delay = 60) {
  if (runTimer) clearTimeout(runTimer);
  runTimer = setTimeout(() => { runTimer = null; void runPreview(); }, delay);
}

async function runPreview() {
  if (!api || typeof api.runIdylliumInBrowser !== 'function') {
    setStatus('Ядро Idyllium не загрузилось — предпросмотр недоступен', true);
    return;
  }
  const token = ++runToken;
  const code = currentCode(true);
  let result;
  try {
    result = await api.runIdylliumInBrowser({ entryFile: 'main.idyl', files: previewFiles(code) });
  } catch (error) {
    if (token !== runToken) return;
    setStatus(`Предпросмотр не удался: ${error instanceof Error ? error.message : String(error)}`, true);
    return;
  }
  if (token !== runToken) return;
  if (!result.compilation.success) {
    // Так быть не должно: генератор обязан выдавать компилируемый код. Говорим честно.
    setStatus(`Ошибка генератора кода — сообщите автору: ${String(result.compilation.diagnosticsText || '').split('\n')[0]}`, true);
    return;
  }
  if (result.runtimeError) {
    // Например, неверный IdySS в поле «Стиль»: программа макета отказала — теми же словами, что и в IDE.
    setStatus(`Программа макета упала: ${result.runtimeError}`, true);
    return;
  }
  postToPreview({ type: 'snapshot', generation: 1, audio: [], windows: result.windows, canvases: [], modals: [], output: '' });
  const lineCount = code.split('\n').length - 1;
  const missingFonts = withoutMissingFonts(model, (file) => fontFiles.has(file)).missing;
  const fontsNote = missingFonts.length > 0 ? ` · нет файла шрифта: ${missingFonts.map((font) => font.file).join(', ')} — выберите его заново в свойстве font` : '';
  setStatus(`Программа макета скомпилирована и запущена: ${lineCount} строк, виджетов: ${model.widgets.length}${fontsNote}`, missingFonts.length > 0);
  requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle('is-error', isError);
}

// ─── геометрия: прямоугольники виджетов из DOM кадра ─────────────────────────
function widgetElements(container) {
  // applyWidgetBox рендерера ставит left каждому виджету; подписи рамок и полосы вкладок — нет.
  // instanceof HTMLElement здесь не годится: элементы кадра — из другого окна (своя реализация классов).
  return Array.from(container.children).filter((el) => el.nodeType === 1 && el.style && el.style.left !== '');
}

function syncOverlay() {
  const doc = previewDocument();
  const rects = new Map();
  const origins = new Map();
  const tabs = new Map();
  contentRect = null;
  if (doc) {
    const frameBox = els.preview.getBoundingClientRect();
    const sceneBox = els.scene.getBoundingClientRect();
    const toScene = (box) => ({
      left: box.left + frameBox.left - sceneBox.left,
      top: box.top + frameBox.top - sceneBox.top,
      width: box.width,
      height: box.height,
    });
    const content = doc.querySelector('.window > .content');
    if (content) {
      contentRect = toScene(content.getBoundingClientRect());
      const matchChildren = (container, parentId) => {
        const items = childrenOf(model, parentId);
        const elements = widgetElements(container);
        const remember = (widget, element) => {
          const box = toScene(element.getBoundingClientRect());
          rects.set(widget.id, box);
          // Откуда считаются x/y этого виджета на самом деле: у детей рамки — за её бордюром,
          // у страницы вкладок — под полосой вкладок. Из кадра, а не из догадок.
          origins.set(widget.id, { left: box.left - Number(widget.props.x || 0), top: box.top - Number(widget.props.y || 0) });
        };
        items.forEach((item, index) => {
          const el = elements[index];
          if (!el) return;
          remember(item, el);
          const def = widgetDefinition(item.type);
          if (def.container === 'children') matchChildren(el, item.id);
          if (def.container === 'tabs') {
            // Рендерер показывает одну страницу — ту, что выбрана; остальные страницы без прямоугольника.
            const pages = childrenOf(model, item.id);
            const shown = Math.min(Math.max(previewTabs[item.id] || 0, 0), Math.max(pages.length - 1, 0));
            const pageHost = el.querySelector('.tabpage');
            const pageElement = pageHost ? widgetElements(pageHost)[0] : null;
            const page = pages[shown];
            if (page && pageElement) {
              remember(page, pageElement);
              tabs.set(item.id, origins.get(page.id));
              matchChildren(pageElement, page.id);
            }
          }
        });
      };
      matchChildren(content, null);
    }
    // Кадр высотой со своё содержимое — прокручивается сцена, а не он.
    const wanted = Math.max(320, doc.documentElement.scrollHeight);
    if (Math.abs(els.preview.offsetHeight - wanted) > 2) {
      els.preview.style.height = `${wanted}px`;
      requestAnimationFrame(syncOverlay);
      return;
    }
  }
  lastRects = rects;
  lastOrigins = origins;
  tabOrigins = tabs;
  renderOverlay();
}

function rectOf(id) {
  return lastRects.get(id) || null;
}

/** Контейнер под точкой сцены: самый глубокий Frame или страница вкладок, иначе окно (null). */
function containerAt(sceneX, sceneY, excludeId = null) {
  let best = null;
  for (const item of model.widgets) {
    const def = widgetDefinition(item.type);
    if (def.container !== 'children') continue;
    if (excludeId !== null && (item.id === excludeId || isAncestor(excludeId, item.id))) continue;
    const rect = rectOf(item.id);
    if (!rect || sceneX < rect.left || sceneY < rect.top || sceneX > rect.left + rect.width || sceneY > rect.top + rect.height) continue;
    if (!best || isAncestor(best.id, item.id)) best = item;
  }
  return best ? best.id : null;
}

function containerOrigin(containerId) {
  if (containerId === null) return contentRect ? { left: contentRect.left, top: contentRect.top } : { left: 0, top: WINDOW_TITLE_HEIGHT };
  // Вкладки: страницы стоят под полосой вкладок — отсчёт снят с показанной страницы в кадре.
  if (tabOrigins.has(containerId)) return tabOrigins.get(containerId);
  const rect = rectOf(containerId);
  if (!rect) return { left: 0, top: 0 };
  const item = widgetById(containerId);
  // Дети Frame стоят внутри его рамки: смещение на толщину границы, которую рендерер рисует border-ом.
  const border = item && item.props.border_width !== undefined ? Number(item.props.border_width) : 1;
  return { left: rect.left + border, top: rect.top + border };
}

function snap(value) {
  if (!ui.grid) return Math.round(value);
  return Math.round(value / ui.gridSize) * ui.gridSize;
}

// ─── оверлей ─────────────────────────────────────────────────────────────────
function renderOverlay() {
  const overlay = els.overlay;
  overlay.replaceChildren();
  if (contentRect) {
    if (ui.grid) {
      const grid = document.createElement('div');
      grid.className = 'overlay-grid';
      const step = Math.max(ui.gridSize, 20);
      grid.style.left = `${contentRect.left}px`;
      grid.style.top = `${contentRect.top}px`;
      grid.style.width = `${contentRect.width}px`;
      grid.style.height = `${contentRect.height}px`;
      grid.style.backgroundSize = `${step}px ${step}px`;
      overlay.appendChild(grid);
    }
    const windowBox = document.createElement('div');
    windowBox.className = 'overlay-window';
    windowBox.dataset.container = 'window';
    windowBox.style.left = `${contentRect.left}px`;
    windowBox.style.top = `${contentRect.top}px`;
    windowBox.style.width = `${contentRect.width}px`;
    windowBox.style.height = `${contentRect.height}px`;
    overlay.appendChild(windowBox);
  }
  // Порядок рамок — порядок отрисовки: родитель, затем его дети, братья по порядку добавления.
  // Так поздний виджет верхнего уровня ложится ПОВЕРХ раннего вместе с его детьми — как на экране.
  const ordered = [];
  const visit = (parentId) => { for (const child of childrenOf(model, parentId)) { ordered.push(child); visit(child.id); } };
  visit(null);
  for (const item of ordered) {
    const rect = rectOf(item.id);
    if (!rect) continue;
    const box = document.createElement('div');
    box.className = 'overlay-widget';
    box.dataset.id = String(item.id);
    if (selection.has(item.id)) box.classList.add('is-selected');
    if (item.id === selectedId) box.classList.add('is-primary');
    if (item.props.visible === false) box.classList.add('is-hidden');
    if (item.tabTitle !== undefined) box.classList.add('is-page'); // страница вкладок: выделяется, но не отрывается
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.title = `${item.name}: gui.${item.type}`;
    overlay.appendChild(box);
    // Ручки размера и подпись — только у одиночного выделения; у группы двигают всех разом.
    if (item.id === selectedId && selection.size <= 1) {
      for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        const knob = document.createElement('div');
        knob.className = 'overlay-handle';
        knob.dataset.handle = handle;
        knob.dataset.id = String(item.id);
        const x = handle.includes('w') ? 0 : handle.includes('e') ? rect.width : rect.width / 2;
        const y = handle.includes('n') ? 0 : handle.includes('s') ? rect.height : rect.height / 2;
        knob.style.left = `${rect.left + x}px`;
        knob.style.top = `${rect.top + y}px`;
        overlay.appendChild(knob);
      }
      const label = document.createElement('div');
      label.className = 'overlay-label';
      label.textContent = `${item.name} · ${Math.round(item.props.x || 0)}, ${Math.round(item.props.y || 0)} · ${Math.round(rect.width)}×${Math.round(rect.height)}`;
      label.style.left = `${rect.left}px`;
      label.style.top = `${rect.top - 20}px`;
      overlay.appendChild(label);
    }
  }
}

function depthOf(item) {
  let depth = 0;
  let current = item;
  while (current && current.parent !== null) {
    depth++;
    current = widgetById(current.parent);
  }
  return depth;
}

function capturePointer(event) {
  try { els.overlay.setPointerCapture(event.pointerId); } catch (error) { /* синтетическое событие без pointerId */ }
}

function scenePoint(event) {
  const box = els.scene.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function sizeOf(item) {
  const def = widgetDefinition(item.type);
  return {
    width: item.props.width !== undefined ? Number(item.props.width) : def.size.width,
    height: item.props.height !== undefined ? Number(item.props.height) : def.size.height,
  };
}

/** Выделение: обычный щелчок — один виджет; toggle (Ctrl/Shift) — добавить или снять; null — окно. */
function select(id, { toggle = false, add = false } = {}) {
  if (id === null) {
    selection = new Set();
    selectedId = null;
  } else if (toggle) {
    if (selection.has(id)) {
      selection.delete(id);
      selectedId = selection.size > 0 ? [...selection][selection.size - 1] : null;
    } else {
      selection.add(id);
      selectedId = id;
    }
  } else if (add) {
    selection.add(id);
    selectedId = id;
  } else {
    selection = new Set([id]);
    selectedId = id;
  }
  renderTree();
  renderInspector();
  renderOverlay();
}

function selectMany(ids) {
  selection = new Set(ids.filter((id) => widgetById(id)));
  selectedId = selection.size > 0 ? [...selection][selection.size - 1] : null;
  renderTree();
  renderInspector();
  renderOverlay();
}

/** Корни выделения без страниц вкладок — то, что двигают, копируют и удаляют разом. */
function movableRoots() {
  return selectionRoots(model, [...selection]).filter((id) => { const item = widgetById(id); return item && item.tabTitle === undefined; });
}

els.overlay.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  hideContextMenu();
  finishInlineEdit(true);
  const target = event.target instanceof HTMLElement ? event.target : null;
  const point = scenePoint(event);
  if (target && target.classList.contains('overlay-handle')) {
    const id = Number(target.dataset.id);
    const item = widgetById(id);
    if (!item) return;
    const size = sizeOf(item);
    dragging = {
      kind: 'resize', id, handle: target.dataset.handle, start: point,
      origin: { x: Number(item.props.x || 0), y: Number(item.props.y || 0), width: size.width, height: size.height },
      before: snapshot(), moved: false,
    };
    capturePointer(event);
    event.preventDefault();
    return;
  }
  if (target && target.classList.contains('overlay-widget')) {
    const id = Number(target.dataset.id);
    const item = widgetById(id);
    if (!item) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Ctrl/Shift+щелчок — добавить к выделению или снять; без перетаскивания.
      select(id, { toggle: true });
      els.overlay.focus();
      event.preventDefault();
      return;
    }
    if (!selection.has(id)) select(id);
    else if (selectedId !== id) { selectedId = id; renderTree(); renderInspector(); renderOverlay(); }
    if (item.tabTitle !== undefined) { els.overlay.focus(); return; } // страницу вкладок не оторвать
    // Группа едет вместе: корни выделения (ребёнок выделенной рамки едет с рамкой, не сам по себе).
    const ids = movableRoots().includes(id) ? movableRoots() : [id];
    dragging = {
      kind: 'move', id, ids, start: point,
      origins: new Map(ids.map((rootId) => { const root = widgetById(rootId); return [rootId, { x: Number(root.props.x || 0), y: Number(root.props.y || 0) }]; })),
      before: snapshot(), moved: false, rect: rectOf(id),
    };
    capturePointer(event);
    event.preventDefault();
    return;
  }
  // Щелчок по пустому месту — выбрано окно; протяжка — рамка выделения.
  if (selectedId !== null || selection.size > 0) select(null);
  dragging = { kind: 'marquee', start: point, moved: false };
  capturePointer(event);
  els.overlay.focus();
});

function marqueeRect(point) {
  const left = Math.min(dragging.start.x, point.x);
  const top = Math.min(dragging.start.y, point.y);
  return { left, top, width: Math.abs(point.x - dragging.start.x), height: Math.abs(point.y - dragging.start.y) };
}

function updateMarquee(point) {
  const rect = marqueeRect(point);
  if (!marquee) {
    marquee = document.createElement('div');
    marquee.className = 'overlay-marquee';
    els.scene.appendChild(marquee);
  }
  marquee.style.left = `${rect.left}px`;
  marquee.style.top = `${rect.top}px`;
  marquee.style.width = `${rect.width}px`;
  marquee.style.height = `${rect.height}px`;
  // В выделение попадает всё, что задела рамка (кроме страниц вкладок), в порядке отрисовки.
  const hit = [];
  for (const item of model.widgets) {
    if (item.tabTitle !== undefined) continue;
    const box = rectOf(item.id);
    if (!box) continue;
    const overlaps = box.left < rect.left + rect.width && box.left + box.width > rect.left && box.top < rect.top + rect.height && box.top + box.height > rect.top;
    if (overlaps) hit.push(item.id);
  }
  const same = hit.length === selection.size && hit.every((id) => selection.has(id));
  if (!same) selectMany(hit);
}

function removeMarquee() {
  if (marquee) marquee.remove();
  marquee = null;
}

els.overlay.addEventListener('pointermove', (event) => {
  if (!dragging || dragging.kind === 'place') return;
  const point = scenePoint(event);
  const dx = point.x - dragging.start.x;
  const dy = point.y - dragging.start.y;
  if (!dragging.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
  dragging.moved = true;
  if (dragging.kind === 'marquee') { updateMarquee(point); return; }
  const item = widgetById(dragging.id);
  if (!item) return;
  if (dragging.kind === 'move') {
    const single = dragging.ids.length === 1;
    const origin = dragging.origins.get(item.id);
    let nx = origin.x + dx;
    let ny = origin.y + dy;
    if (event.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) ny = origin.y; else nx = origin.x;
    }
    // Контейнер под курсором (окно, рамка, страница вкладок): одиночный виджет переезжает в него сразу,
    // координаты пересчитываются от его угла — так можно вытащить ребёнка из рамки через любой край.
    // Группа контейнер не меняет: каждый едет в своём родителе.
    const target = single ? containerAt(point.x, point.y, item.id) : item.parent;
    if (single && target !== item.parent) {
      const oldOrigin = containerOrigin(item.parent);
      const newOrigin = containerOrigin(target);
      dragging.origins.set(item.id, { x: origin.x + (oldOrigin.left - newOrigin.left), y: origin.y + (oldOrigin.top - newOrigin.top) });
      item.parent = target;
      model.widgets = [...model.widgets.filter((other) => other.id !== item.id), item];
      nx = dragging.origins.get(item.id).x + dx;
      ny = dragging.origins.get(item.id).y + dy;
      renderTree();
    }
    item.props.x = Math.max(0, snap(nx));
    item.props.y = Math.max(0, snap(ny));
    for (const rootId of dragging.ids) {
      if (rootId === item.id) continue;
      const root = widgetById(rootId);
      const rootOrigin = dragging.origins.get(rootId);
      if (!root || !rootOrigin) continue;
      root.props.x = Math.max(0, snap(rootOrigin.x + (event.shiftKey && Math.abs(dx) <= Math.abs(dy) ? 0 : dx)));
      root.props.y = Math.max(0, snap(rootOrigin.y + (event.shiftKey && Math.abs(dx) > Math.abs(dy) ? 0 : dy)));
      moveOverlayBox(root);
    }
    for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
    if (single) {
      const targetBox = target === null
        ? els.overlay.querySelector('.overlay-window')
        : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
      if (targetBox) targetBox.classList.add('is-drop-target');
    }
  } else {
    const o = dragging.origin;
    let { x, y, width, height } = o;
    const h = dragging.handle;
    if (h.includes('e')) width = Math.max(MIN_SIZE, snap(o.width + dx));
    if (h.includes('s')) height = Math.max(MIN_SIZE, snap(o.height + dy));
    if (h.includes('w')) {
      const nx = Math.min(snap(o.x + dx), o.x + o.width - MIN_SIZE);
      width = o.width + (o.x - nx);
      x = nx;
    }
    if (h.includes('n')) {
      const ny = Math.min(snap(o.y + dy), o.y + o.height - MIN_SIZE);
      height = o.height + (o.y - ny);
      y = ny;
    }
    item.props.x = Math.max(0, x);
    item.props.y = Math.max(0, y);
    item.props.width = width;
    item.props.height = height;
  }
  moveOverlayBox(item);
  renderCode();
  scheduleRun(60);
});

/** Во время перетаскивания рамка едет сразу, картинка кадра догоняет после прогона. */
function moveOverlayBox(item) {
  const rect = rectOf(item.id);
  // Отсчёт этого виджета из кадра (точен для страниц вкладок и детей рамок); контейнер — запасной путь.
  const origin = lastOrigins.get(item.id) || containerOrigin(item.parent);
  const size = sizeOf(item);
  const next = { left: origin.left + Number(item.props.x || 0), top: origin.top + Number(item.props.y || 0), width: size.width, height: size.height };
  if (!rect) return;
  lastRects.set(item.id, next);
  // Дети едут вместе с родителем.
  for (const child of descendants(item.id)) {
    const childRect = rectOf(child.id);
    if (childRect) lastRects.set(child.id, { ...childRect, left: childRect.left + (next.left - rect.left), top: childRect.top + (next.top - rect.top) });
  }
  renderOverlay();
}

function finishDrag(event) {
  if (!dragging || dragging.kind === 'place') return;
  const drag = dragging;
  dragging = null;
  if (drag.kind === 'marquee') { removeMarquee(); return; }
  for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
  if (!drag.moved) return;
  const after = snapshot();
  if (after !== drag.before) {
    history.push(drag.before);
    future = [];
  }
  refresh();
}

els.overlay.addEventListener('pointerup', finishDrag);
els.overlay.addEventListener('pointercancel', finishDrag);

els.overlay.addEventListener('dblclick', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('.overlay-widget') : null;
  if (!target) return;
  const item = widgetById(Number(target.dataset.id));
  if (!item) return;
  const textProp = ['text', 'title'].find((name) => propertyOf(item.type, name));
  if (!textProp) return;
  startInlineEdit(item, textProp);
});

// ─── правка текста прямо на виджете ─────────────────────────────────────────
let inlineEdit = null;

function startInlineEdit(item, propName) {
  const rect = rectOf(item.id);
  if (!rect) return;
  inlineEdit = { id: item.id, prop: propName };
  const input = els.inline;
  input.hidden = false;
  input.value = item.props[propName] !== undefined ? String(item.props[propName]) : '';
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top}px`;
  input.style.width = `${Math.max(rect.width, 80)}px`;
  input.style.height = `${Math.max(rect.height, 24)}px`;
  input.focus();
  input.select();
}

function finishInlineEdit(commit) {
  if (!inlineEdit) return;
  const edit = inlineEdit;
  inlineEdit = null;
  els.inline.hidden = true;
  if (!commit) return;
  const value = els.inline.value;
  applyChange(() => {
    const item = widgetById(edit.id);
    if (!item) return;
    if (value === '') delete item.props[edit.prop]; else item.props[edit.prop] = value;
  });
}

els.inline.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); finishInlineEdit(true); els.overlay.focus(); }
  if (event.key === 'Escape') { event.preventDefault(); finishInlineEdit(false); els.overlay.focus(); }
});
els.inline.addEventListener('blur', () => finishInlineEdit(true));

// ─── палитра ─────────────────────────────────────────────────────────────────
function renderPalette() {
  els.palette.replaceChildren();
  for (const group of PALETTE_GROUPS) {
    const title = document.createElement('div');
    title.className = 'palette-group-title';
    title.textContent = group.title;
    els.palette.appendChild(title);
    for (const type of group.types) {
      const def = WIDGETS[type];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-item';
      button.dataset.type = type;
      // Виден тип как в коде (gui.SpinBox); русское название и подсказка — при наведении.
      button.title = def.hint ? `${def.label} — ${def.hint}` : def.label;
      const icon = document.createElement('span');
      icon.className = 'palette-icon';
      icon.dataset.icon = def.icon;
      if (window.IdylliumIcons && window.IdylliumIcons.has(def.icon)) {
        icon.appendChild(window.IdylliumIcons.element(def.icon, { size: 18 }));
        button.classList.add('has-icon');
      }
      const label = document.createElement('span');
      label.textContent = type;
      button.append(icon, label);
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        startPlacing(type, event);
      });
      els.palette.appendChild(button);
    }
  }
}

let ghost = null;

function startPlacing(type, event) {
  hideContextMenu();
  dragging = { kind: 'place', type, startX: event.clientX, startY: event.clientY, moved: false };
  const onMove = (move) => {
    if (!dragging || dragging.kind !== 'place') return;
    if (!dragging.moved && Math.hypot(move.clientX - dragging.startX, move.clientY - dragging.startY) < 4) return;
    dragging.moved = true;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'palette-ghost';
      ghost.textContent = `${WIDGETS[type].label} (${type})`;
      document.body.appendChild(ghost);
    }
    ghost.style.left = `${move.clientX + 12}px`;
    ghost.style.top = `${move.clientY + 12}px`;
    const point = scenePointFromClient(move.clientX, move.clientY);
    for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
    if (point) {
      const target = containerAt(point.x, point.y);
      const targetBox = target === null ? els.overlay.querySelector('.overlay-window') : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
      if (targetBox) targetBox.classList.add('is-drop-target');
    }
  };
  const onUp = (up) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (ghost) { ghost.remove(); ghost = null; }
    for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
    const wasMoved = dragging && dragging.moved;
    dragging = null;
    const point = scenePointFromClient(up.clientX, up.clientY);
    if (wasMoved) {
      if (point && insideWindow(point)) addWidget(type, point);
      return;
    }
    addWidget(type, null); // щелчок — в свободное место
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function scenePointFromClient(clientX, clientY) {
  const box = els.scene.getBoundingClientRect();
  if (clientX < box.left || clientY < box.top || clientX > box.right || clientY > box.bottom) return null;
  return { x: clientX - box.left, y: clientY - box.top };
}

function insideWindow(point) {
  return contentRect && point.x >= contentRect.left && point.y >= contentRect.top && point.x <= contentRect.left + contentRect.width && point.y <= contentRect.top + contentRect.height;
}

function addWidget(type, point) {
  const def = widgetDefinition(type);
  applyChange(() => {
    const id = nextId();
    const name = freeName(def.defaultName, takenNames());
    const item = { id, type, name, parent: null, props: {}, handlers: [] };
    let parent = null;
    let x;
    let y;
    if (point) {
      parent = containerAt(point.x, point.y);
      const origin = containerOrigin(parent);
      x = snap(point.x - origin.left - def.size.width / 2);
      y = snap(point.y - origin.top - def.size.height / 2);
    } else {
      // Свободное место каскадом: ниже последнего виджета верхнего уровня.
      const top = childrenOf(model, null);
      const last = top[top.length - 1];
      x = 20;
      y = last ? snap(Number(last.props.y || 0) + sizeOf(last).height + 12) : 20;
    }
    item.parent = parent;
    item.props.x = Math.max(0, x);
    item.props.y = Math.max(0, y);
    for (const prop of def.props) {
      if (prop.initial !== undefined) item.props[prop.name] = prop.initial;
    }
    const data = sampleData(def);
    if (data) item.data = data;
    model.widgets.push(item);
    if (def.container === 'tabs') {
      addTabPage(item, 'Вкладка 1');
      addTabPage(item, 'Вкладка 2');
      previewTabs[item.id] = 0;
    }
    selectedId = id;
    selection = new Set([id]);
  });
}

function addTabPage(tabs, title) {
  const id = nextId();
  const size = sizeOf(tabs);
  const page = {
    id,
    type: TAB_PAGE_TYPE,
    name: freeName('page', takenNames()),
    parent: tabs.id,
    props: { x: 8, y: 8, width: Math.max(MIN_SIZE, size.width - 16), height: Math.max(MIN_SIZE, size.height - 50) },
    handlers: [],
    tabTitle: title,
  };
  model.widgets.push(page);
  return page;
}

// ─── дерево ──────────────────────────────────────────────────────────────────
function renderTree() {
  els.tree.replaceChildren();
  els.tree.appendChild(treeRow({ name: model.window.name, type: 'Window', id: null, depth: 0 }));
  const walk = (parentId, depth) => {
    for (const item of childrenOf(model, parentId)) {
      els.tree.appendChild(treeRow({ item, depth }));
      walk(item.id, depth + 1);
    }
  };
  walk(null, 1);
}

function treeRow({ item, depth, id, name, type }) {
  const row = document.createElement('div');
  row.className = 'tree-row';
  row.setAttribute('role', 'treeitem');
  const widgetId = item ? item.id : id;
  row.dataset.id = widgetId === null ? '' : String(widgetId);
  row.style.paddingLeft = `${8 + depth * 16}px`;
  if (widgetId === selectedId || (item && selection.has(item.id))) row.classList.add('is-selected');
  if (widgetId === selectedId) row.classList.add('is-primary');
  if (item && item.props.visible === false) row.classList.add('is-hidden');
  if (window.IdylliumIcons) {
    const iconName = item ? WIDGETS[item.type].icon : 'section-designer';
    row.appendChild(window.IdylliumIcons.element(iconName, { size: 14, className: 'tree-icon' }));
  }
  const nameEl = document.createElement('span');
  nameEl.className = 'tree-name';
  nameEl.textContent = item ? item.name : name;
  const typeEl = document.createElement('span');
  typeEl.className = 'tree-type';
  typeEl.textContent = item ? (item.tabTitle !== undefined ? `вкладка «${item.tabTitle}»` : `gui.${item.type}`) : `gui.${type}`;
  row.append(nameEl, typeEl);
  row.addEventListener('click', (event) => {
    if (treeDrag && treeDrag.moved) return; // это был перенос, не щелчок
    if (item && item.tabTitle !== undefined) {
      // Щелчок по странице вкладки — показать её в предпросмотре.
      const pages = childrenOf(model, item.parent);
      previewTabs[item.parent] = pages.indexOf(item);
      persist();
      scheduleRun(0);
    }
    if (item && (event.ctrlKey || event.metaKey || event.shiftKey)) select(widgetId, { toggle: true });
    else select(widgetId);
  });
  if (item) row.addEventListener('pointerdown', (event) => startTreeDrag(event, item));
  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    select(widgetId);
    if (item) showContextMenu(event.clientX, event.clientY, item);
  });
  return row;
}

// ─── перенос строк дерева мышью ──────────────────────────────────────────────
// Указательные события, не HTML5 DnD: те же правила, что у переноса на сцене, плюс порядок
// братьев. Верхняя четверть строки — «перед», нижняя — «после», середина контейнера — «внутрь».
function startTreeDrag(event, item) {
  if (event.button !== 0) return;
  treeDrag = { id: item.id, startX: event.clientX, startY: event.clientY, moved: false, target: null, ghost: null };
  const clearMarks = () => {
    for (const row of els.tree.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into, .is-drop-invalid')) {
      row.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into', 'is-drop-invalid');
    }
  };
  const onMove = (move) => {
    if (!treeDrag) return;
    if (!treeDrag.moved && Math.hypot(move.clientX - treeDrag.startX, move.clientY - treeDrag.startY) < 4) return;
    if (!treeDrag.moved) {
      treeDrag.moved = true;
      hideContextMenu();
      treeDrag.ghost = document.createElement('div');
      treeDrag.ghost.className = 'palette-ghost';
      treeDrag.ghost.textContent = `${item.name} (${item.type})`;
      document.body.appendChild(treeDrag.ghost);
      document.body.classList.add('is-tree-dragging');
    }
    treeDrag.ghost.style.left = `${move.clientX + 12}px`;
    treeDrag.ghost.style.top = `${move.clientY + 12}px`;
    clearMarks();
    treeDrag.target = null;
    // Строку ищем по геометрии, а не elementFromPoint: над деревом может лежать что угодно (призрак, оверлей).
    const row = [...els.tree.querySelectorAll('.tree-row')].find((candidate) => {
      const box = candidate.getBoundingClientRect();
      return move.clientX >= box.left && move.clientX <= box.right && move.clientY >= box.top && move.clientY <= box.bottom;
    }) || null;
    if (!row) return;
    const overId = row.dataset.id === '' ? null : Number(row.dataset.id);
    const over = overId === null ? null : widgetById(overId);
    const box = row.getBoundingClientRect();
    const quarter = box.height / 4;
    let where;
    if (overId === null) where = 'into';
    else if (move.clientY < box.top + quarter) where = 'before';
    else if (move.clientY > box.bottom - quarter) where = 'after';
    else where = over && widgetDefinition(over.type).container ? 'into' : 'after';
    let target;
    if (where === 'into') target = { parent: overId, before: null };
    else {
      const siblings = childrenOf(model, over.parent);
      const index = siblings.indexOf(over);
      target = { parent: over.parent, before: where === 'before' ? over.id : (siblings[index + 1] ? siblings[index + 1].id : null) };
    }
    // Сухой прогон на копии: правила переноса те же, что и у самого переноса.
    const probe = JSON.parse(JSON.stringify(stripModel(model)));
    const verdict = moveSubtree(probe, item.id, target);
    if (!verdict.ok) {
      row.classList.add('is-drop-invalid');
      treeDrag.ghost.textContent = `${item.name}: ${verdict.reason}`;
      return;
    }
    treeDrag.ghost.textContent = `${item.name} (${item.type})`;
    row.classList.add(`is-drop-${where}`);
    treeDrag.target = target;
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    clearMarks();
    const drag = treeDrag;
    if (drag && drag.ghost) drag.ghost.remove();
    document.body.classList.remove('is-tree-dragging');
    if (!drag || !drag.moved) { treeDrag = null; return; }
    if (drag.target) {
      applyChange(() => {
        const verdict = moveSubtree(model, drag.id, drag.target);
        if (!verdict.ok) { setStatus(verdict.reason, true); return; }
        const moved = widgetById(drag.id);
        if (moved && moved.tabTitle !== undefined) previewTabs[moved.parent] = childrenOf(model, moved.parent).indexOf(moved);
        selection = new Set([drag.id]);
        selectedId = drag.id;
      });
    }
    // Щелчок после переноса не должен сбросить выделение: снимаем флаг после события click.
    setTimeout(() => { treeDrag = null; }, 0);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// ─── контекстное меню ────────────────────────────────────────────────────────
function showContextMenu(x, y, item) {
  const menu = els.contextMenu;
  menu.replaceChildren();
  const add = (label, action, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', () => { hideContextMenu(); action(); });
    menu.appendChild(button);
  };
  const separator = () => {
    const line = document.createElement('div');
    line.className = 'context-separator';
    menu.appendChild(line);
  };
  const isPage = item.tabTitle !== undefined;
  add('Переименовать', () => focusNameField());
  if (!isPage) add('Дублировать (Ctrl+D)', () => { if (!selection.has(item.id)) select(item.id); duplicateSelection(); });
  if (widgetDefinition(item.type).container === 'tabs') add('Добавить вкладку', () => applyChange(() => { addTabPage(item, `Вкладка ${childrenOf(model, item.id).length + 1}`); }));
  separator();
  const siblings = childrenOf(model, item.parent);
  const index = siblings.indexOf(item);
  add(isPage ? 'Вкладку левее' : 'Раньше в порядке добавления (ниже по слою)', () => reorder(item.id, -1), index <= 0);
  add(isPage ? 'Вкладку правее' : 'Позже в порядке добавления (выше по слою)', () => reorder(item.id, 1), index >= siblings.length - 1);
  separator();
  const doomed = selection.has(item.id) && selection.size > 1 ? [...selection] : [item.id];
  add(doomed.length > 1 ? `Удалить выделенные (${doomed.length})` : 'Удалить (Delete)', () => deleteWidgets(doomed));
  menu.hidden = false;
  const margin = 8;
  menu.style.left = `${Math.min(x, window.innerWidth - menu.offsetWidth - margin)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - margin)}px`;
}

function hideContextMenu() {
  els.contextMenu.hidden = true;
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('#context-menu')) hideContextMenu();
  if (event.target instanceof Element && !event.target.closest('#more-menu')) els.moreMenu.open = false;
});

els.overlay.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = event.target instanceof HTMLElement ? event.target.closest('.overlay-widget') : null;
  if (!target) return;
  const item = widgetById(Number(target.dataset.id));
  if (!item) return;
  select(item.id);
  showContextMenu(event.clientX, event.clientY, item);
});

function reorder(id, direction) {
  applyChange(() => {
    const item = widgetById(id);
    if (!item) return;
    const siblings = childrenOf(model, item.parent);
    const index = siblings.indexOf(item);
    const other = siblings[index + direction];
    if (!other) return;
    const a = model.widgets.indexOf(item);
    const b = model.widgets.indexOf(other);
    model.widgets[a] = other;
    model.widgets[b] = item;
    if (item.tabTitle !== undefined) previewTabs[item.parent] = index + direction;
  });
}

function deleteWidgets(ids) {
  applyChange(() => {
    const doomed = new Set();
    let fallback = null;
    for (const id of ids) {
      const item = widgetById(id);
      if (!item) continue;
      if (item.tabTitle !== undefined) {
        const pages = childrenOf(model, item.parent).filter((page) => !doomed.has(page.id));
        if (pages.length <= 1) { setStatus('У вкладок должна остаться хотя бы одна страница', true); continue; }
        previewTabs[item.parent] = 0;
      }
      doomed.add(id);
      for (const child of descendants(id)) doomed.add(child.id);
      if (fallback === null) fallback = item.parent;
    }
    if (doomed.size === 0) return;
    model.widgets = model.widgets.filter((other) => !doomed.has(other.id));
    selection = new Set();
    selectedId = fallback !== null && widgetById(fallback) && !doomed.has(fallback) ? fallback : null;
    if (selectedId !== null) selection.add(selectedId);
  });
}

function deleteWidget(id) {
  deleteWidgets([id]);
}

function duplicateSelection() {
  const roots = movableRoots();
  if (roots.length === 0) return;
  pastePayload(copyPayload(roots), { offset: 10 });
}

// ─── копирование ─────────────────────────────────────────────────────────────
/** Полезная нагрузка буфера: корни выделения и все их потомки (страницы вкладок — вместе с вкладками). */
function copyPayload(rootIds) {
  const ids = Array.isArray(rootIds) ? rootIds : [rootIds];
  const widgets = [];
  for (const id of ids) {
    const item = widgetById(id);
    if (!item) continue;
    for (const widget of [item, ...descendants(id)]) if (!widgets.some((known) => known.id === widget.id)) widgets.push(JSON.parse(JSON.stringify(widget)));
  }
  return { roots: ids.filter((id) => widgets.some((widget) => widget.id === id)), widgets };
}

function pastePayload(payload, { offset = 10 } = {}) {
  if (!payload || !Array.isArray(payload.widgets) || payload.widgets.length === 0) return;
  const rootIds = Array.isArray(payload.roots) ? payload.roots : [payload.root !== undefined ? payload.root : payload.widgets[0].id];
  applyChange(() => {
    const idMap = new Map();
    const taken = takenNames();
    const pastedRoots = [];
    for (const source of payload.widgets) {
      if (!WIDGETS[source.type]) continue;
      idMap.set(source.id, nextId() + idMap.size);
    }
    for (const source of payload.widgets) {
      if (!idMap.has(source.id)) continue;
      const isRoot = rootIds.includes(source.id);
      // Корень вставляется туда же, где оригинал, если родитель ещё есть; иначе — в окно.
      const rootParent = source.parent !== null && widgetById(source.parent) && !idMap.has(source.parent) ? source.parent : null;
      const copy = {
        id: idMap.get(source.id),
        type: source.type,
        name: freeName(WIDGETS[source.type].defaultName, taken),
        parent: isRoot ? rootParent : (idMap.get(source.parent) ?? rootParent),
        props: cleanProps(source.type, source.props),
        handlers: cleanHandlers(source.type, source.handlers),
      };
      const copiedData = cleanData(source.type, source.data);
      if (copiedData) copy.data = copiedData;
      if (source.tabTitle !== undefined) copy.tabTitle = String(source.tabTitle);
      if (isRoot) {
        copy.props.x = Number(copy.props.x || 0) + offset;
        copy.props.y = Number(copy.props.y || 0) + offset;
        pastedRoots.push(copy.id);
      }
      taken.push(copy.name);
      model.widgets.push(copy);
    }
    selection = new Set(pastedRoots);
    selectedId = pastedRoots.length > 0 ? pastedRoots[pastedRoots.length - 1] : selectedId;
  });
}

async function copySelection() {
  const roots = movableRoots();
  if (roots.length === 0) return;
  memoryClipboard = copyPayload(roots);
  try {
    await navigator.clipboard.writeText(CLIPBOARD_MARK + JSON.stringify(memoryClipboard));
  } catch (error) { /* без системного буфера — вставка из памяти страницы */ }
  setStatus(`Скопировано: ${roots.map((id) => widgetById(id).name).join(', ')}`);
}

document.addEventListener('paste', (event) => {
  if (isTextField(document.activeElement)) return;
  const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
  if (text.startsWith(CLIPBOARD_MARK)) {
    try {
      pastePayload(JSON.parse(text.slice(CLIPBOARD_MARK.length)));
      event.preventDefault();
      return;
    } catch (error) { /* не наш JSON */ }
  }
  if (memoryClipboard) {
    pastePayload(memoryClipboard);
    event.preventDefault();
  }
});

function isTextField(element) {
  return element instanceof Element && element.matches('input, textarea, select, [contenteditable="true"]');
}

// ─── инспектор ───────────────────────────────────────────────────────────────
function renderInspector() {
  const container = els.inspector;
  container.replaceChildren();
  if (selection.size > 1) { renderGroupInspector(container); return; }
  const item = selectedId !== null ? widgetById(selectedId) : null;
  const props = item ? item.props : model.window.props;
  const def = item ? widgetDefinition(item.type) : null;
  const type = item ? item.type : 'Window';
  els.inspectorTitle.textContent = item ? `${item.name}: gui.${item.type}` : `${model.window.name}: gui.Window`;

  // Имя.
  const nameGroup = groupBox('Имя');
  const nameField = document.createElement('div');
  nameField.className = 'field is-explicit';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'name';
  nameLabel.title = 'Имя переменной в коде';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'name-field';
  nameInput.value = item ? item.name : model.window.name;
  nameInput.spellcheck = false;
  const nameNote = document.createElement('div');
  nameNote.className = 'field-note';
  nameNote.hidden = true;
  nameInput.addEventListener('input', () => {
    const others = takenNames().filter((name) => name !== (item ? item.name : model.window.name));
    const problem = nameProblem(nameInput.value.trim(), others);
    nameInput.classList.toggle('is-invalid', Boolean(problem));
    nameNote.hidden = !problem;
    nameNote.textContent = problem || '';
  });
  const commitName = () => {
    const value = nameInput.value.trim();
    const others = takenNames().filter((name) => name !== (item ? item.name : model.window.name));
    if (nameProblem(value, others)) return;
    applyChange(() => {
      if (item) widgetById(item.id).name = value; else model.window.name = value;
    });
  };
  nameInput.addEventListener('change', commitName);
  nameInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } });
  nameField.append(nameLabel, nameInput, document.createElement('span'));
  nameGroup.append(nameField, nameNote);
  container.appendChild(nameGroup);

  if (item && item.tabTitle !== undefined) {
    const tabGroup = groupBox('Вкладка');
    tabGroup.appendChild(textField('заголовок', 'Заголовок вкладки — первый аргумент add_tab', item.tabTitle, (value) => applyChange(() => { widgetById(item.id).tabTitle = value; })));
    container.appendChild(tabGroup);
  }

  if (def && def.container === 'tabs') container.appendChild(tabsEditor(item));

  const catalogue = item ? def.props : WINDOW_PROPS;
  for (const [groupId, groupTitle] of PROPERTY_GROUPS) {
    const groupProps = catalogue.filter((prop) => prop.group === groupId);
    if (groupProps.length === 0) continue;
    const box = groupBox(groupTitle);
    for (const prop of groupProps) box.appendChild(propertyField(prop, props, (value) => setProperty(item, prop, value), item));
    container.appendChild(box);
  }

  if (item && def.data) container.appendChild(dataEditor(item, def));
  if (!item) container.appendChild(fontsEditor());

  // Заготовки обработчиков — по галочке на каждое событие типа (замечание владельца 2026-09-25).
  const events = eventsOf(type);
  if (events.length > 0) {
    const box = groupBox('Заготовки обработчиков');
    const owner = item || model.window;
    for (const event of events) {
      const row = document.createElement('label');
      row.className = 'event-row';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.dataset.event = event.name;
      check.checked = Array.isArray(owner.handlers) && owner.handlers.includes(event.name);
      check.addEventListener('change', () => applyChange(() => {
        const target = item ? widgetById(item.id) : model.window;
        const list = new Set(Array.isArray(target.handlers) ? target.handlers : []);
        if (check.checked) list.add(event.name); else list.delete(event.name);
        target.handlers = events.map((known) => known.name).filter((name) => list.has(name));
      }));
      const code = document.createElement('code');
      code.textContent = event.name + (event.params ? `(${event.params})` : '()');
      const hint = document.createElement('small');
      hint.textContent = event.comment;
      row.title = `В код добавится пустая функция: ${event.comment}`;
      row.append(check, code, hint);
      box.appendChild(row);
    }
    container.appendChild(box);
  }
  if (def && def.hint) {
    const note = document.createElement('p');
    note.className = 'inspector-empty';
    note.textContent = def.hint;
    container.appendChild(note);
  }
}

/** Несколько виджетов: список, выравнивание по опоре (первый выделенный), распределение, одна ширина/высота, удаление. */
function renderGroupInspector(container) {
  const ids = [...selection].filter((id) => widgetById(id));
  const anchor = widgetById(ids[0]);
  els.inspectorTitle.textContent = `Выбрано: ${ids.length}`;
  const box = groupBox('Выделение');
  const list = document.createElement('p');
  list.className = 'inspector-empty';
  list.textContent = `${ids.map((id) => widgetById(id).name).join(', ')}. Опора выравнивания — ${anchor.name} (выделен первым); двигать всех — мышью или стрелками.`;
  box.appendChild(list);
  const grid = document.createElement('div');
  grid.className = 'align-grid';
  for (const [mode, label] of Object.entries(ALIGN_MODES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.align = mode;
    button.textContent = label;
    button.disabled = mode.startsWith('distribute') && ids.length < 3;
    button.title = button.disabled ? 'Распределение — от трёх виджетов' : `Выровнять ${label}`;
    button.addEventListener('click', () => alignSelection(mode));
    grid.appendChild(button);
  }
  box.appendChild(grid);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'inspector-action';
  remove.textContent = `Удалить выделенные (${ids.length})`;
  remove.addEventListener('click', () => deleteWidgets(ids));
  box.appendChild(remove);
  container.appendChild(box);
}

/** Выравнивание по прямоугольникам сцены: смещение прибавляется к x/y относительно родителя. */
function alignSelection(mode) {
  const ids = [...selection].filter((id) => { const item = widgetById(id); return item && item.tabTitle === undefined && rectOf(id); });
  const boxes = ids.map((id) => ({ id, ...rectOf(id) }));
  const moves = alignBoxes(boxes, mode);
  if (moves.length === 0) return;
  applyChange(() => {
    for (const move of moves) {
      const item = widgetById(move.id);
      if (!item) continue;
      if (move.dx) item.props.x = Math.max(0, Math.round(Number(item.props.x || 0) + move.dx));
      if (move.dy) item.props.y = Math.max(0, Math.round(Number(item.props.y || 0) + move.dy));
      if (move.width !== undefined) item.props.width = Math.max(MIN_SIZE, Math.round(move.width));
      if (move.height !== undefined) item.props.height = Math.max(MIN_SIZE, Math.round(move.height));
    }
  });
}

/** Шрифты из файлов — группа в свойствах окна: список переменных fonts.Font, добавить, убрать. */
function fontsEditor() {
  const box = groupBox('Шрифты из файлов');
  const fonts = fontsOf(model);
  if (fonts.length === 0) {
    const note = document.createElement('p');
    note.className = 'inspector-empty';
    note.textContent = 'Пока нет. Файл TTF, OTF, WOFF или WOFF2 станет переменной fonts.Font, а виджет получит свойство font.';
    box.appendChild(note);
  }
  for (const font of fonts) {
    const row = document.createElement('div');
    row.className = 'font-row';
    const name = document.createElement('code');
    name.textContent = font.name;
    const file = document.createElement('span');
    file.className = 'font-file';
    file.textContent = font.file + (fontFiles.has(font.file) ? '' : ' — файла нет, выберите заново');
    file.title = font.file;
    if (!fontFiles.has(font.file)) row.classList.add('is-missing');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'field-reset';
    remove.title = 'Убрать шрифт из макета (виджеты вернутся к шрифту по умолчанию)';
    if (window.IdylliumIcons) remove.appendChild(window.IdylliumIcons.element('close', { size: 12 })); else remove.textContent = '×';
    remove.style.visibility = 'visible';
    remove.addEventListener('click', () => removeFont(font.name));
    row.append(name, file, remove);
    box.appendChild(row);
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'inspector-action';
  add.id = 'add-font-button';
  add.textContent = 'Добавить шрифт из файла…';
  add.addEventListener('click', () => { pendingFontTarget = null; els.fontInput.click(); });
  box.appendChild(add);
  return box;
}

function removeFont(fontName) {
  applyChange(() => {
    model.fonts = fontsOf(model).filter((font) => font.name !== fontName);
    if (model.window.props.font === fontName) delete model.window.props.font;
    for (const item of model.widgets) if (item.props.font === fontName) delete item.props.font;
  });
}

// ─── файлы шрифтов: байты в памяти и IndexedDB, макет знает только имена ────
function openFilesDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB недоступен')); return; }
    const request = window.indexedDB.open(FILES_DB_NAME, 1);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILES_DB_STORE)) db.createObjectStore(FILES_DB_STORE);
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB open failed')));
  });
}

async function restoreFontFiles() {
  try {
    const db = await openFilesDb();
    const entries = await new Promise((resolve, reject) => {
      const store = db.transaction(FILES_DB_STORE, 'readonly').objectStore(FILES_DB_STORE);
      const keys = store.getAllKeys();
      const values = store.getAll();
      values.addEventListener('success', () => resolve(keys.result.map((key, index) => [key, values.result[index]])));
      values.addEventListener('error', () => reject(values.error));
    });
    for (const [name, value] of entries) {
      if (typeof name === 'string' && value && value.bytes) fontFiles.set(name, new Uint8Array(value.bytes));
    }
    db.close();
  } catch (error) { /* без IndexedDB шрифты живут до перезагрузки */ }
}

async function storeFontFile(name, bytes) {
  try {
    const db = await openFilesDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_DB_STORE, 'readwrite');
      tx.objectStore(FILES_DB_STORE).put({ bytes }, name);
      tx.addEventListener('complete', resolve);
      tx.addEventListener('error', () => reject(tx.error));
    });
    db.close();
  } catch (error) { /* память страницы всё равно держит байты */ }
}

/** Формат по содержимому — как Font.load_from_file() в рантайме: TTF, OTF, WOFF, WOFF2. */
function fontFormatOf(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'ttf';
  if (tag === 'wOFF') return 'woff';
  if (tag === 'wOF2') return 'woff2';
  return null;
}

async function addFontFile(file, target) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!fontFormatOf(bytes)) {
    setStatus(`«${file.name}» — не шрифт: нужен TTF, OTF, WOFF или WOFF2`, true);
    return;
  }
  const fileName = file.name;
  fontFiles.set(fileName, bytes);
  void storeFontFile(fileName, bytes);
  applyChange(() => {
    let font = fontsOf(model).find((known) => known.file === fileName);
    if (!font) {
      font = { name: freeName('font', takenNames()), file: fileName };
      model.fonts = [...fontsOf(model), font];
    }
    if (target) {
      const owner = target.id === null ? model.window : widgetById(target.id);
      if (owner) owner.props[target.prop] = font.name;
    }
  });
  setStatus(`Шрифт «${fileName}» добавлен в макет как ${fontsOf(model).find((known) => known.file === fileName).name}`);
}

function groupBox(title) {
  const box = document.createElement('div');
  box.className = 'inspector-group';
  const head = document.createElement('div');
  head.className = 'inspector-group-title';
  head.textContent = title;
  box.appendChild(head);
  return box;
}

function textField(label, title, value, onCommit) {
  const field = document.createElement('div');
  field.className = 'field is-explicit';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.title = title;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.addEventListener('change', () => onCommit(input.value));
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit(input.value); } });
  field.append(labelEl, input, document.createElement('span'));
  return field;
}

function propertyField(prop, props, onChange, item) {
  const field = document.createElement('div');
  field.className = 'field';
  field.dataset.prop = prop.name;
  const explicit = props[prop.name] !== undefined && props[prop.name] !== null && props[prop.name] !== '';
  if (explicit) field.classList.add('is-explicit');
  // Всегда видно имя свойства как в коде; перевод — подсказкой при наведении.
  const label = document.createElement('label');
  label.textContent = prop.name;
  const typeNames = { int: 'int', float: 'float', bool: 'bool', string: 'string', enum: 'string', color: 'colors.Color', font: 'fonts.Font' };
  const typeNote = prop.kind === 'enum' ? `${typeNames.enum}: ${prop.values.join(' | ')}` : typeNames[prop.kind] || prop.kind;
  label.title = `${prop.name} (${typeNote}) — ${prop.label}${prop.default !== undefined ? `; по умолчанию ${prop.default}` : ''}`;
  let control;
  if (prop.kind === 'bool') {
    const wrap = document.createElement('div');
    wrap.className = 'field-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = explicit ? Boolean(props[prop.name]) : Boolean(prop.default);
    input.title = prop.label;
    input.addEventListener('change', () => onChange(input.checked === Boolean(prop.default) ? null : input.checked));
    wrap.append(input);
    control = wrap;
  } else if (prop.kind === 'enum' && prop.name === 'icon') {
    // Имя значка: сетка значков с поиском (список на 117 строк в <select> нечитаем, а его полоса прокрутки — не наша).
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-choice';
    const current = explicit ? String(props[prop.name]) : String(prop.default);
    if (window.IdylliumIcons && window.IdylliumIcons.has(current)) button.appendChild(window.IdylliumIcons.element(current, { size: 18 }));
    const name = document.createElement('span');
    name.textContent = current;
    button.appendChild(name);
    button.title = 'Выбрать значок из набора';
    button.addEventListener('click', () => openIconPicker(button, current, (picked) => onChange(picked === prop.default ? null : picked)));
    control = button;
  } else if (prop.kind === 'font') {
    // Шрифт из файла: переменные fonts.Font макета или новый файл — он станет переменной сам.
    const select = document.createElement('select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'по умолчанию';
    select.appendChild(none);
    for (const font of fontsOf(model)) {
      const option = document.createElement('option');
      option.value = font.name;
      option.textContent = `${font.name} — ${font.file}`;
      select.appendChild(option);
    }
    const add = document.createElement('option');
    add.value = '__add__';
    add.textContent = 'Добавить шрифт из файла…';
    select.appendChild(add);
    select.value = explicit ? String(props[prop.name]) : '';
    select.addEventListener('change', () => {
      if (select.value === '__add__') {
        pendingFontTarget = { id: item ? item.id : null, prop: prop.name };
        select.value = explicit ? String(props[prop.name]) : '';
        els.fontInput.click();
        return;
      }
      onChange(select.value === '' ? null : select.value);
    });
    control = select;
  } else if (prop.kind === 'enum') {
    // Только настоящие значения; выбор умолчания снимает свойство (строка уйдёт из кода).
    const select = document.createElement('select');
    for (const value of prop.values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = explicit ? String(props[prop.name]) : String(prop.default ?? prop.values[0]);
    select.addEventListener('change', () => onChange(select.value === prop.default ? null : select.value));
    control = select;
  } else if (prop.kind === 'color') {
    const wrap = document.createElement('div');
    wrap.className = 'field-color';
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.title = 'Открыть генератор цвета';
    if (explicit) {
      swatch.classList.add('is-set');
      swatch.style.background = normalizeHex(props[prop.name]);
    }
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.placeholder = 'по умолчанию';
    hex.value = explicit ? normalizeHex(props[prop.name]) : '';
    hex.spellcheck = false;
    swatch.addEventListener('click', () => openColorPanel({ item, prop, initial: explicit ? normalizeHex(props[prop.name]) : null }, swatch));
    const commitHex = () => {
      const value = hex.value.trim();
      if (value === '') { onChange(null); return; }
      if (!/^#?[0-9a-fA-F]{6}$/u.test(value)) { hex.classList.add('is-invalid'); return; }
      onChange(normalizeHex(value));
    };
    hex.addEventListener('change', commitHex);
    hex.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitHex(); } });
    wrap.append(swatch, hex);
    control = wrap;
  } else if (prop.kind === 'int' || prop.kind === 'float') {
    const wrap = document.createElement('div');
    wrap.className = 'number-control';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.title = 'Меньше';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = prop.kind === 'int' ? '1' : 'any';
    if (prop.min !== undefined) input.min = String(prop.min);
    if (prop.max !== undefined) input.max = String(prop.max);
    input.placeholder = prop.default !== undefined ? String(prop.default) : '';
    input.value = explicit ? String(props[prop.name]) : '';
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.title = 'Больше';
    const commit = (raw) => {
      if (String(raw).trim() === '') { onChange(null); return; }
      const number = Number(raw);
      if (!Number.isFinite(number)) { input.classList.add('is-invalid'); return; }
      let value = prop.kind === 'int' ? Math.round(number) : number;
      if (prop.min !== undefined) value = Math.max(prop.min, value);
      if (prop.max !== undefined) value = Math.min(prop.max, value);
      onChange(value);
    };
    const current = () => (input.value.trim() === '' ? Number(effectiveDefault(prop, item)) : Number(input.value));
    minus.addEventListener('click', () => commit(current() - (prop.kind === 'int' ? 1 : 0.1)));
    plus.addEventListener('click', () => commit(current() + (prop.kind === 'int' ? 1 : 0.1)));
    input.addEventListener('change', () => commit(input.value));
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit(input.value); } });
    wrap.append(minus, input, plus);
    control = wrap;
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'по умолчанию';
    input.value = explicit ? String(props[prop.name]) : '';
    input.spellcheck = false;
    const commit = () => onChange(input.value.trim() === '' ? null : input.value);
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    control = input;
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'field-reset';
  reset.title = 'Вернуть значение по умолчанию (строка уйдёт из кода)';
  if (window.IdylliumIcons) reset.appendChild(window.IdylliumIcons.element('close', { size: 12 })); else reset.textContent = '×';
  reset.addEventListener('click', () => onChange(null));
  field.append(label, control, reset);
  return field;
}

/** Значение числового свойства, когда оно не задано: размер — из умолчаний виджета, прочее — из каталога. */
function effectiveDefault(prop, item) {
  if (item && (prop.name === 'width' || prop.name === 'height')) return sizeOf(item)[prop.name];
  if (!item && (prop.name === 'width' || prop.name === 'height')) return prop.default;
  return prop.default !== undefined ? prop.default : 0;
}

function setProperty(item, prop, value) {
  applyChange(() => {
    const target = item ? widgetById(item.id) : model.window;
    if (!target) return;
    if (value === null || value === undefined || value === '') {
      delete target.props[prop.name];
      return;
    }
    if (prop.kind === 'int') value = Math.round(Number(value));
    if (prop.kind === 'float') value = Number(value);
    if (prop.kind === 'bool') value = Boolean(value);
    if (prop.kind === 'color') value = normalizeHex(value);
    target.props[prop.name] = value;
  });
}

// ─── генератор цвета: одна живая модалка (общий компонент Web IDE) ───────────
// Открывается пунктом «Инструменты → Генератор цвета» (свободно: строки кода с «Копировать»)
// и щелчком по цветовому свойству (привязка: цвет летит в свойство вживую; закрытие или
// переход к другому свойству — одна запись в отмены; ничего не крутили — ничего не записано).
function ensureColorPanel() {
  if (colorPanel) return colorPanel;
  const host = document.createElement('div');
  host.id = 'color-panel';
  host.hidden = true;
  document.body.appendChild(host);
  colorPanel = createColorPicker({
    host,
    alpha: true,
    codes: true,
    floating: { title: 'Генератор цвета', storageKey: 'idyllium-color-picker-designer', onClose: () => finishColorBinding() },
    onChange: (state) => {
      if (!colorBinding) return;
      const owner = colorBinding.id === null ? model.window : widgetById(colorBinding.id);
      if (!owner) return;
      colorBinding.dirty = true;
      owner.props[colorBinding.prop] = state.hex;
      renderCode();
      scheduleRun(60);
      const field = document.querySelector(`#inspector .field[data-prop="${colorBinding.prop}"] .color-swatch`);
      if (field) { field.style.background = state.hex; field.classList.add('is-set'); }
    },
    onCopy: async (text, button) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(button, 'Скопировано ✓');
      } catch (error) {
        flash(button, 'Не удалось');
      }
    },
  });
  document.addEventListener('pointerdown', (event) => {
    if (!colorPanel.isOpen() || colorPanel.isPinned() || !(event.target instanceof Element)) return;
    if (host.contains(event.target) || event.target.closest('#color-picker-button, [data-role="color-picker-button"], .color-swatch')) return;
    if (colorPanel.isEyedropperActive()) return;
    colorPanel.close();
  });
  return colorPanel;
}

function openColorPanel(binding, anchor) {
  const panel = ensureColorPanel();
  if (colorBinding) finishColorBinding();
  if (binding) {
    const ownerName = binding.item ? binding.item.name : model.window.name;
    colorBinding = { id: binding.item ? binding.item.id : null, prop: binding.prop.name, before: snapshot(), dirty: false };
    panel.setTitle(`${ownerName}.${binding.prop.name}`);
    panel.setHex(binding.initial || '#808080', { quiet: true });
  } else {
    panel.setTitle('Генератор цвета');
  }
  if (panel.isOpen()) return;
  const rect = anchor ? anchor.getBoundingClientRect() : null;
  panel.open(rect ? { left: rect.left - 470, top: rect.top - 8 } : undefined);
}

function finishColorBinding() {
  if (!colorBinding) return;
  const binding = colorBinding;
  colorBinding = null;
  if (colorPanel) colorPanel.setTitle('Генератор цвета');
  if (!binding.dirty) return;
  const after = snapshot();
  if (after !== binding.before) {
    history.push(binding.before);
    future = [];
  }
  refresh();
}

// ─── данные виджета: пункты, колонки и строки, значения, точки ──────────────
function dataEditor(item, def) {
  const box = groupBox(def.data.title);
  const shape = def.data.shape;
  const data = item.data || {};
  const commit = (next) => applyChange(() => { const target = widgetById(item.id); if (target) target.data = cleanData(item.type, next); });
  const stringList = (list, onCommit, placeholder) => {
    const wrap = document.createElement('div');
    wrap.className = 'data-editor';
    list.forEach((value, index) => {
      const row = document.createElement('div');
      row.className = 'data-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value;
      input.placeholder = placeholder;
      const save = () => { const next = [...list]; next[index] = input.value; onCommit(next); };
      input.addEventListener('change', save);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); save(); } });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'data-remove';
      remove.title = 'Убрать';
      if (window.IdylliumIcons) remove.appendChild(window.IdylliumIcons.element('close', { size: 12 })); else remove.textContent = '×';
      remove.addEventListener('click', () => onCommit(list.filter((_, other) => other !== index)));
      row.append(input, remove);
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'data-add';
    add.textContent = '+ Добавить';
    add.addEventListener('click', () => onCommit([...list, `${placeholder} ${list.length + 1}`]));
    wrap.appendChild(add);
    return wrap;
  };
  if (shape === 'strings') {
    box.appendChild(stringList(data.items || [], (items) => commit({ items }), 'Пункт'));
  } else if (shape === 'table') {
    const columnsTitle = document.createElement('div');
    columnsTitle.className = 'data-subtitle';
    columnsTitle.textContent = 'Колонки';
    box.appendChild(columnsTitle);
    box.appendChild(stringList(data.columns || [], (columns) => commit({ ...data, columns }), 'Колонка'));
    const rowsTitle = document.createElement('div');
    rowsTitle.className = 'data-subtitle';
    rowsTitle.textContent = 'Строки: по одной на строку, ячейки через «;»';
    box.appendChild(rowsTitle);
    const textarea = document.createElement('textarea');
    textarea.className = 'data-textarea';
    textarea.rows = 4;
    textarea.spellcheck = false;
    textarea.value = (data.rows || []).map((row) => row.join('; ')).join('\n');
    textarea.addEventListener('change', () => {
      const rows = textarea.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => line.split(';').map((cell) => cell.trim()));
      commit({ ...data, rows });
    });
    box.appendChild(textarea);
  } else if (shape === 'entries') {
    const entries = data.entries || [];
    const wrap = document.createElement('div');
    wrap.className = 'data-editor';
    entries.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'data-row data-row-entry';
      const label = document.createElement('input');
      label.type = 'text';
      label.value = entry.label;
      label.placeholder = 'подпись';
      const value = document.createElement('input');
      value.type = 'number';
      value.step = 'any';
      value.value = String(entry.value);
      value.placeholder = 'число';
      const save = () => { const next = entries.map((other, i) => (i === index ? { label: label.value, value: Number(value.value) || 0 } : other)); commit({ entries: next }); };
      for (const input of [label, value]) {
        input.addEventListener('change', save);
        input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); save(); } });
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'data-remove';
      remove.title = 'Убрать';
      if (window.IdylliumIcons) remove.appendChild(window.IdylliumIcons.element('close', { size: 12 })); else remove.textContent = '×';
      remove.addEventListener('click', () => commit({ entries: entries.filter((_, other) => other !== index) }));
      row.append(label, value, remove);
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'data-add';
    add.textContent = '+ Добавить';
    add.addEventListener('click', () => commit({ entries: [...entries, { label: `Подпись ${entries.length + 1}`, value: 1 }] }));
    wrap.appendChild(add);
    box.appendChild(wrap);
  } else if (shape === 'numbers') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'data-numbers';
    input.spellcheck = false;
    input.placeholder = 'числа через пробел: 3 5 4.5';
    input.value = (data.points || []).join(' ');
    const save = () => commit({ points: input.value.split(/[\s,;]+/u).map((part) => part.replace(',', '.')).map(Number).filter((n) => Number.isFinite(n)) });
    input.addEventListener('change', save);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); save(); } });
    box.appendChild(input);
  }
  const note = document.createElement('p');
  note.className = 'inspector-empty';
  note.textContent = shape === 'table'
    ? 'В коде: set_columns(…) и add_row(…) — строка подгоняется под число колонок.'
    : `В коде: ${def.data.method}(…) на каждое значение.`;
  box.appendChild(note);
  return box;
}

// ─── выбор значка gui.Icon: сетка с поиском ──────────────────────────────────
let iconPicker = null;

function openIconPicker(anchor, current, onPick) {
  if (!iconPicker) {
    const root = document.createElement('div');
    root.className = 'icon-picker';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Выбор значка');
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'icon-picker-search';
    search.placeholder = 'поиск по имени: play, file, arrow…';
    search.spellcheck = false;
    const grid = document.createElement('div');
    grid.className = 'icon-picker-grid';
    root.append(search, grid);
    document.body.appendChild(root);
    iconPicker = { root, search, grid, session: null };
    const close = () => { root.hidden = true; iconPicker.session = null; };
    const renderGrid = () => {
      const query = search.value.trim().toLowerCase();
      grid.replaceChildren();
      for (const name of ICON_NAMES) {
        if (query && !name.includes(query)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-picker-item';
        if (iconPicker.session && name === iconPicker.session.current) button.classList.add('is-current');
        button.title = name;
        if (window.IdylliumIcons) button.appendChild(window.IdylliumIcons.element(name, { size: 20 }));
        const label = document.createElement('span');
        label.textContent = name;
        button.appendChild(label);
        button.addEventListener('click', () => { const session = iconPicker.session; close(); if (session) session.onPick(name); });
        grid.appendChild(button);
      }
      if (grid.childElementCount === 0) {
        const empty = document.createElement('p');
        empty.className = 'inspector-empty';
        empty.textContent = 'Такого значка нет';
        grid.appendChild(empty);
      }
    };
    iconPicker.renderGrid = renderGrid;
    search.addEventListener('input', renderGrid);
    search.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    document.addEventListener('pointerdown', (event) => {
      if (root.hidden || !(event.target instanceof Node) || root.contains(event.target)) return;
      if (iconPicker.session && iconPicker.session.anchor.contains(event.target)) return;
      close();
    });
    document.addEventListener('keydown', (event) => { if (!root.hidden && event.key === 'Escape') close(); });
  }
  const { root, search } = iconPicker;
  iconPicker.session = { anchor, current, onPick };
  search.value = '';
  iconPicker.renderGrid();
  root.hidden = false;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + root.offsetWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - root.offsetWidth - 8);
  if (top + root.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - root.offsetHeight - 6);
  root.style.left = `${left}px`;
  root.style.top = `${top}px`;
  search.focus();
}

function tabsEditor(tabs) {
  const box = groupBox('Вкладки');
  const list = document.createElement('div');
  list.className = 'tabs-editor';
  const pages = childrenOf(model, tabs.id);
  const shown = Math.min(Math.max(previewTabs[tabs.id] || 0, 0), Math.max(pages.length - 1, 0));
  pages.forEach((page, index) => {
    const row = document.createElement('div');
    row.className = 'tabs-row';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'shown-tab';
    radio.checked = index === shown;
    radio.title = 'Показать эту вкладку на сцене';
    radio.addEventListener('change', () => { previewTabs[tabs.id] = index; persist(); scheduleRun(0); renderTree(); });
    const title = document.createElement('input');
    title.type = 'text';
    title.value = page.tabTitle || '';
    title.placeholder = 'заголовок вкладки';
    const commit = () => applyChange(() => { const target = widgetById(page.id); if (target) target.tabTitle = title.value; });
    title.addEventListener('change', commit);
    title.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tabs-remove';
    remove.textContent = '×';
    remove.title = 'Удалить вкладку вместе с содержимым';
    remove.disabled = pages.length <= 1;
    remove.addEventListener('click', () => deleteWidget(page.id));
    row.append(radio, title, remove);
    list.appendChild(row);
  });
  box.appendChild(list);
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'tabs-add';
  add.textContent = '+ Добавить вкладку';
  add.addEventListener('click', () => applyChange(() => {
    const target = widgetById(tabs.id);
    if (!target) return;
    addTabPage(target, `Вкладка ${childrenOf(model, tabs.id).length + 1}`);
    previewTabs[tabs.id] = childrenOf(model, tabs.id).length - 1;
  }));
  box.appendChild(add);
  return box;
}

function focusNameField() {
  const input = $('name-field');
  if (input) { input.focus(); input.select(); }
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── код ─────────────────────────────────────────────────────────────────────
function renderCode() {
  els.code.innerHTML = highlight(currentCode(false));
}

function highlight(code) {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(\/\/[^\n]*)/gu, '<span class="cm">$1</span>')
    .replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;)/gu, '<span class="str">$1</span>')
    .replace(/\b(use|main|void|function)\b/gu, '<span class="kw">$1</span>')
    .replace(/\b(gui|colors)\.([A-Z][A-Za-z]*)\b/gu, '$1.<span class="ty">$2</span>')
    .replace(/\.(add_child|add_tab|show|HEX)\(/gu, '.<span class="fn">$1</span>(')
    .replace(/\b(\d+(?:\.\d+)?)\b(?![^<]*>)/gu, '<span class="num">$1</span>');
}

async function copyCode() {
  const code = currentCode(false);
  try {
    await navigator.clipboard.writeText(code);
    flash(els.copyCode, 'Скопировано ✓');
  } catch (error) {
    flash(els.copyCode, 'Не удалось — выделите код и Ctrl+C');
    els.code.focus();
    const range = document.createRange();
    range.selectNodeContents(els.code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function flash(button, text) {
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.textContent = text;
  setTimeout(() => { button.textContent = original; }, 1800);
}

function downloadText(name, text, type) {
  const blob = new Blob([text], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadCode() {
  const code = currentCode(false);
  const fonts = fontsOf(model).filter((font) => fontFiles.has(font.file));
  if (fonts.length === 0) {
    downloadText('main.idyl', code, 'text/plain;charset=utf-8');
    flash(els.downloadCode, 'Скачано ✓');
    return;
  }
  // Со шрифтами — ZIP проекта: main.idyl и файлы шрифтов; Web IDE открывает его через «Открыть проект».
  const entries = [{ name: 'main.idyl', bytes: new TextEncoder().encode(code) }, ...fonts.map((font) => ({ name: font.file, bytes: fontFiles.get(font.file) }))];
  const blob = new Blob([zipBytes(entries)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gui-project.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash(els.downloadCode, 'Скачано ✓');
}

/** Отпечаток файла для описи ссылки «Поделиться» — как в Web IDE (первые 8 байт SHA-256). */
async function fingerprint(bytes) {
  if (!window.crypto || !window.crypto.subtle) return '';
  const digest = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest.subarray(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openInIde() {
  const share = api && api.share;
  if (!share || typeof share.encodeProjectLink !== 'function') {
    setStatus('Ядро Idyllium не загрузилось — скопируйте код и вставьте в Web IDE вручную', true);
    return;
  }
  const code = currentCode(false);
  const title = String(model.window.props.title || 'Макет окна');
  // Ссылка несёт только текст; шрифты идут описью «имя, размер, отпечаток» — IDE попросит файл.
  const assets = [];
  for (const font of fontsOf(model)) {
    const bytes = fontFiles.get(font.file);
    if (!bytes) continue;
    const sha = await fingerprint(bytes);
    if (sha) assets.push({ path: font.file, size: bytes.length, sha });
  }
  let fragment;
  try {
    fragment = share.encodeProjectLink({
      name: `Конструктор GUI: ${title}`,
      from: '',
      idyllium: api.IDYLLIUM_VERSION || '',
      current: 'main.idyl',
      files: [{ path: 'main.idyl', text: code }],
      assets,
    });
  } catch (error) {
    setStatus(`Не удалось собрать ссылку: ${error instanceof Error ? error.message : String(error)}`, true);
    return;
  }
  const url = `${new URL('../', window.location.href).href}#${fragment}`;
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) setStatus('Браузер не открыл вкладку — разрешите всплывающие окна для этого сайта', true);
  else if (assets.length > 0) setStatus(`Web IDE открыт; файлы шрифтов по ссылке не передаются — добавьте их в проект (Файлы → Загрузить): ${assets.map((asset) => asset.path).join(', ')}`);
}

function saveModelFile() {
  downloadText('gui-design.json', `${JSON.stringify(stripModel(model), null, 2)}\n`, 'application/json;charset=utf-8');
  flash(els.saveModel, 'Сохранено ✓');
}

async function openModelFile(file) {
  const text = await file.text();
  let loaded = null;
  let loadedTabs = {};
  let report = null;
  if (file.name.toLowerCase().endsWith('.json')) {
    try { loaded = validateModel(JSON.parse(text)); } catch (error) { loaded = null; }
    if (!loaded) { setStatus(`«${file.name}» — не макет конструктора`, true); return; }
  } else {
    let embedded = null;
    try { embedded = extractEmbeddedModel(text); } catch (error) { embedded = null; }
    if (embedded) {
      loaded = validateModel(embedded);
      if (!loaded) { setStatus(`Строка макета в «${file.name}» повреждена`, true); return; }
      // Честность: если код правили руками после конструктора, макет отстал от кода — говорим, ЧТО именно пропадёт.
      const fileCode = stripEmbeddedModel(text);
      const difference = codeDifference(fileCode, generateCode(loaded, {}));
      if (difference.extraLines > 0 || difference.missingLines.length > 0) report = difference;
    } else {
      // Без строки макета — разбор настоящим парсером ядра (третий заход): любой файл в идиоме конструктора.
      const imported = await importIdylFile(file.name, text);
      if (!imported) return;
      loaded = imported.model;
      loadedTabs = imported.previewTabs;
    }
  }
  if (report) {
    const body = document.createElement('div');
    const intro = document.createElement('p');
    intro.textContent = `Код в «${file.name}» правили руками после конструктора. Макет откроется, но эти правки в него не попадут — при следующей пересборке их не будет:`;
    body.appendChild(intro);
    if (report.extraRanges.length > 0) {
      const list = document.createElement('ul');
      for (const range of report.extraRanges.slice(0, 12)) {
        const li = document.createElement('li');
        const where = range.from === range.to ? `строка ${range.from}` : `строки ${range.from}–${range.to} (${range.count})`;
        li.innerHTML = `${escapeHtml(where)}: <code>${escapeHtml(range.first.slice(0, 70))}</code>${range.count > 1 ? ' …' : ''}`;
        list.appendChild(li);
      }
      if (report.extraRanges.length > 12) {
        const li = document.createElement('li');
        li.textContent = `…и ещё ${report.extraRanges.length - 12} мест`;
        list.appendChild(li);
      }
      body.appendChild(list);
    }
    if (report.missingLines.length > 0) {
      const note = document.createElement('p');
      note.textContent = `Кроме того, в файле нет ${report.missingLines.length} строк макета (их удалили) — макет их вернёт.`;
      body.appendChild(note);
    }
    const proceed = await showDialog({ title: 'Файл отличается от макета', body, ok: 'Открыть макет', cancel: 'Отмена' });
    if (!proceed) return;
  }
  applyChange(() => {
    model = loaded;
    selectedId = null;
    selection = new Set();
    previewTabs = loadedTabs || {};
  });
  const missingFonts = withoutMissingFonts(model, (name) => fontFiles.has(name)).missing;
  const fontsNote = missingFonts.length > 0 ? `; нет файлов шрифтов: ${missingFonts.map((font) => font.file).join(', ')} — выберите их заново` : '';
  setStatus(`Открыт макет из «${file.name}»: виджетов ${model.widgets.length}${report ? ' (ручные правки кода в макет не вошли)' : ''}${fontsNote}`, Boolean(report) || missingFonts.length > 0);
}

/**
 * Файл .idyl без строки макета: компилятор ядра → AST → модель. Не компилируется или нет окна —
 * честный отказ; чужие строки (код обработчиков, условия, циклы, вычисления) перечисляются с
 * номерами, и открыть макет без них решает пользователь. Возвращает { model, previewTabs } или null.
 */
async function importIdylFile(fileName, text) {
  if (!api || typeof api.compileIdyllium !== 'function') {
    setStatus('Ядро Idyllium не загрузилось — открыть .idyl без строки макета нельзя', true);
    return null;
  }
  const compiled = api.compileIdyllium(text, { file: fileName });
  if (!compiled.success || !compiled.ast) {
    const first = String(compiled.diagnosticsText || '').split('\n').find((line) => line.includes('error')) || String(compiled.diagnosticsText || '').split('\n')[0];
    setStatus(`«${fileName}» не компилируется — конструктор открывает только рабочую программу: ${first}`, true);
    return null;
  }
  let imported;
  try {
    imported = importProgram(compiled.ast, { source: text, colorConstants: api.COLOR_CONSTANTS || [] });
  } catch (error) {
    if (error && error.name === 'ImportRefusal') { setStatus(`«${fileName}»: ${error.message}`, true); return null; }
    throw error;
  }
  const loaded = validateModel(imported.model);
  if (!loaded) { setStatus(`«${fileName}»: не удалось собрать макет из программы`, true); return null; }
  if (imported.foreign.length > 0 || imported.notes.length > 0) {
    const body = document.createElement('div');
    const intro = document.createElement('p');
    intro.textContent = imported.foreign.length > 0
      ? `Конструктор понимает окно, виджеты, свойства-константы, add_child и add_tab, данные списков и диаграмм, пустые заготовки обработчиков. В «${fileName}» есть и другое — в макет оно не попадёт, а при пересборке кода этих строк не будет:`
      : `В «${fileName}» есть, что поправить:`;
    body.appendChild(intro);
    if (imported.foreign.length > 0) {
      const list = document.createElement('ul');
      for (const entry of imported.foreign.slice(0, 12)) {
        const li = document.createElement('li');
        li.innerHTML = `строка ${entry.line}: <code>${escapeHtml(entry.text.slice(0, 70))}</code> — ${escapeHtml(entry.why)}`;
        list.appendChild(li);
      }
      if (imported.foreign.length > 12) {
        const li = document.createElement('li');
        li.textContent = `…и ещё ${imported.foreign.length - 12} строк`;
        list.appendChild(li);
      }
      body.appendChild(list);
    }
    for (const note of imported.notes) {
      const p = document.createElement('p');
      p.textContent = note;
      body.appendChild(p);
    }
    const proceed = await showDialog({ title: 'Файл не целиком в идиоме конструктора', body, ok: 'Открыть макет', cancel: 'Отмена' });
    if (!proceed) return null;
  }
  return { model: loaded, previewTabs: imported.previewTabs || {} };
}

// ─── сплиттеры ───────────────────────────────────────────────────────────────
function applyLayout() {
  const layout = ui.layout;
  els.designer.style.setProperty('--palette-w', `${layout.palette}px`);
  els.designer.style.setProperty('--side-w', `${layout.side}px`);
  els.designer.style.setProperty('--code-h', `${layout.code}px`);
  els.designer.style.setProperty('--tree-h', `${layout.tree}%`);
  els.designer.classList.toggle('is-code-collapsed', Boolean(ui.codeCollapsed));
  els.codeCollapse.textContent = ui.codeCollapsed ? 'Развернуть' : 'Свернуть';
}

function installSplitter(id, { horizontal, onMove }) {
  const splitter = $(id);
  splitter.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    splitter.classList.add('is-dragging');
    document.body.classList.add(horizontal ? 'is-resizing-rows' : 'is-resizing');
    const start = { x: event.clientX, y: event.clientY, layout: { ...ui.layout } };
    const move = (moveEvent) => onMove(start, moveEvent.clientX - start.x, moveEvent.clientY - start.y);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      splitter.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing', 'is-resizing-rows');
      persist();
      requestAnimationFrame(syncOverlay);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

function installSplitters() {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  installSplitter('split-palette', { horizontal: false, onMove: (start, dx) => { ui.layout.palette = clamp(start.layout.palette + dx, 150, 420); applyLayout(); } });
  installSplitter('split-side', { horizontal: false, onMove: (start, dx) => { ui.layout.side = clamp(start.layout.side - dx, 240, 560); applyLayout(); } });
  installSplitter('split-code', { horizontal: true, onMove: (start, _dx, dy) => { ui.layout.code = clamp(start.layout.code - dy, 44, window.innerHeight - 260); applyLayout(); } });
  installSplitter('split-tree', {
    horizontal: true,
    onMove: (start, _dx, dy) => {
      const sideHeight = $('side').clientHeight || 1;
      ui.layout.tree = clamp(start.layout.tree + (dy / sideHeight) * 100, 12, 80);
      applyLayout();
    },
  });
}

// ─── обновление всего ────────────────────────────────────────────────────────
function refresh({ silent = false } = {}) {
  els.undo.disabled = history.length === 0;
  els.redo.disabled = future.length === 0;
  pruneSelection();
  const withFonts = fontsOf(model).some((font) => fontFiles.has(font.file));
  els.downloadCode.textContent = withFonts ? 'Скачать проект (.zip)' : 'Скачать main.idyl';
  els.downloadCode.title = withFonts ? 'main.idyl и файлы шрифтов одним архивом — Web IDE откроет его через «Открыть проект»' : '';
  renderTree();
  renderInspector();
  renderCode();
  renderOverlay();
  persist();
  if (!silent) scheduleRun(0);
}

// ─── клавиатура ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', (event) => {
  if (!els.dialog.hidden) {
    if (event.key === 'Escape') closeDialog(false);
    return;
  }
  if (isTextField(document.activeElement) && document.activeElement !== els.overlay) return;
  if (iconPicker && !iconPicker.root.hidden) return;
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); return; }
  if (ctrl && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) { event.preventDefault(); redo(); return; }
  if (ctrl && event.key.toLowerCase() === 'c') { void copySelection(); return; }
  if (ctrl && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelection(); return; }
  if (ctrl && event.key.toLowerCase() === 'a') { event.preventDefault(); selectMany(model.widgets.filter((item) => item.tabTitle === undefined).map((item) => item.id)); return; }
  if (event.key === 'Escape') { hideContextMenu(); select(null); return; }
  if (selection.size === 0) return;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteWidgets([...selection]); return; }
  const step = event.shiftKey ? 10 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[event.key]) {
    event.preventDefault();
    const [dx, dy] = moves[event.key];
    const roots = movableRoots();
    if (roots.length === 0) return;
    applyChange(() => {
      for (const id of roots) {
        const target = widgetById(id);
        if (!target) continue;
        target.props.x = Math.max(0, Number(target.props.x || 0) + dx);
        target.props.y = Math.max(0, Number(target.props.y || 0) + dy);
      }
    });
  }
});

// ─── запуск ──────────────────────────────────────────────────────────────────
function initControls() {
  for (const button of document.querySelectorAll('#color-picker-button, [data-role="color-picker-button"]')) {
    button.addEventListener('click', () => openColorPanel(null, button));
  }
  els.undo.addEventListener('click', undo);
  els.redo.addEventListener('click', redo);
  els.newDesign.addEventListener('click', async () => {
    if (model.widgets.length > 0) {
      const ok = await showDialog({ title: 'Новый макет', body: 'Начать пустой макет? Текущий останется только в отменах (Ctrl+Z).', ok: 'Начать новый' });
      if (!ok) return;
    }
    applyChange(() => { model = newModel(); selectedId = null; previewTabs = {}; });
  });
  els.dialogOk.addEventListener('click', () => closeDialog(true));
  els.dialogCancel.addEventListener('click', () => closeDialog(false));
  els.dialog.addEventListener('click', (event) => { if (event.target === els.dialog) closeDialog(false); });
  els.gridToggle.checked = ui.grid;
  els.gridSize.textContent = String(ui.gridSize);
  els.gridToggle.addEventListener('change', () => { ui.grid = els.gridToggle.checked; persist(); renderOverlay(); });
  els.embedToggle.checked = ui.embedModel;
  els.embedToggle.addEventListener('change', () => { ui.embedModel = els.embedToggle.checked; persist(); renderCode(); });
  els.openIde.addEventListener('click', () => { void openInIde(); });
  els.fontInput.addEventListener('change', () => {
    const file = els.fontInput.files && els.fontInput.files[0];
    els.fontInput.value = '';
    const target = pendingFontTarget;
    pendingFontTarget = null;
    if (file) void addFontFile(file, target);
  });
  els.copyCode.addEventListener('click', () => { void copyCode(); });
  els.downloadCode.addEventListener('click', downloadCode);
  els.saveModel.addEventListener('click', saveModelFile);
  els.openModel.addEventListener('click', () => els.openModelInput.click());
  els.openModelInput.addEventListener('change', () => {
    const file = els.openModelInput.files && els.openModelInput.files[0];
    els.openModelInput.value = '';
    if (file) void openModelFile(file);
  });
  els.codeCollapse.addEventListener('click', () => { ui.codeCollapsed = !ui.codeCollapsed; persist(); applyLayout(); requestAnimationFrame(syncOverlay); });
  applyLayout();
  installSplitters();
  window.addEventListener('resize', () => syncOverlay());
  els.stagePane.addEventListener('scroll', () => renderOverlay());
}

function watchPreviewFrame() {
  const attach = () => {
    const doc = previewDocument();
    if (!doc || !doc.getElementById('stage')) return false;
    const toolbar = doc.querySelector('.toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const observer = new MutationObserver(() => requestAnimationFrame(syncOverlay));
    observer.observe(doc.getElementById('stage'), { childList: true, subtree: true, attributes: true });
    frameReady = true;
    applyTheme(document.body.classList.contains('light-theme'));
    scheduleRun(0);
    return true;
  };
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'idylliumGuiEvent' && data.message && data.message.type === 'rendererReady') {
      if (!frameReady) attach();
    }
  });
  els.preview.addEventListener('load', () => { if (!frameReady) attach(); });
  if (!frameReady) attach();
}

async function main() {
  if (!restore()) model = newModel();
  if (window.IdylliumIcons) window.IdylliumIcons.mountAll(document);
  initTheme();
  renderPalette();
  initControls();
  await restoreFontFiles();
  watchPreviewFrame();
  refresh({ silent: true });
  setStatus('Загрузка предпросмотра…');
}

void main();
