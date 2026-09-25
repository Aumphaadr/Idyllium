// Генератор цвета — один компонент на Web IDE («Инструменты → Генератор цвета») и Конструктор GUI
// (тот же пункт меню и свойства-цвета). 1.6.3, по замечаниям владельца: два режима — RGB и HSL —
// переключателем наверху, ползунков всегда четыре (R/G/B/A или H/S/L/A; без альфы — три); строки
// кода по режиму: в RGB — colors.RGB и colors.HEX, в HSL — colors.HSL; панель — живая модалка:
// крестик, перетаскивание за полотно, кнопка «поверх» (не закрывается щелчками мимо); положение,
// режим и «поверх» помнит localStorage. Предпросмотр — логотип на шахматке (CSS), пипетка — общий
// модуль color-eyedropper.js. Истина состояния — RGB(+A); HSL считается от него и кэшируется,
// чтобы тон не «плыл» при нулевой насыщенности.
import { setupColorEyedropper } from './color-eyedropper.js';
import { clamp } from './num-util.js';

const RGB_CHANNELS = [
  ['red', 'R', 'Красный, 0–255'],
  ['green', 'G', 'Зелёный, 0–255'],
  ['blue', 'B', 'Синий, 0–255'],
];
const HSL_CHANNELS = [
  ['hue', 'H', 'Тон, 0–360°', 360],
  ['saturation', 'S', 'Насыщенность, 0–100 %', 100],
  ['lightness', 'L', 'Светлота, 0–100 %', 100],
];

export function rgbToHsl(red, green, blue) {
  const r = clamp(red, 0, 255) / 255;
  const g = clamp(green, 0, 255) / 255;
  const b = clamp(blue, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue: Math.round(hue) % 360, saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
}

export function hslToRgb(hue, saturation, lightness) {
  const h = ((clamp(hue, 0, 360) % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { red: Math.round((r + m) * 255), green: Math.round((g + m) * 255), blue: Math.round((b + m) * 255) };
}

function byte(value) {
  return Math.round(clamp(Number(value) || 0, 0, 255));
}

function componentToHex(value) {
  return byte(value).toString(16).padStart(2, '0');
}

export function formatAlpha(value) {
  const rounded = Math.round(clamp(Number(value), 0, 1) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/u, '').replace(/\.$/u, '');
}

/** #rrggbb, а при прозрачности — #rrggbbaa (colors.HEX понимает оба). */
export function colorHex({ red, green, blue, alpha = 1 }) {
  const base = `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
  return alpha >= 1 ? base : base + componentToHex(Math.round(alpha * 255));
}

export function parseHex(text) {
  const match = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/u.exec(String(text || '').trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
    alpha: match[2] ? Math.round((parseInt(match[2], 16) / 255) * 100) / 100 : 1,
  };
}

function readStorage(key) {
  try {
    const raw = key ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writeStorage(key, patch) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ ...readStorage(key), ...patch }));
  } catch (error) { /* приватный режим */ }
}

function channelRow({ channel, letter, title, max, step, sliderClass }) {
  const row = document.createElement('label');
  row.className = 'color-channel-row';
  row.dataset.channel = channel;
  row.title = title;
  const label = document.createElement('span');
  label.textContent = letter;
  const slider = document.createElement('input');
  slider.id = `color-${channel}-slider`;
  slider.className = `color-slider ${sliderClass}`;
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(max);
  slider.step = String(step);
  const control = document.createElement('span');
  control.className = `color-number-control${channel === 'alpha' ? ' color-alpha-control' : ''}`;
  const minus = document.createElement('button');
  minus.className = 'color-step-button';
  minus.type = 'button';
  minus.dataset.colorChannel = channel;
  minus.dataset.colorStep = String(-step);
  minus.setAttribute('aria-label', `Уменьшить ${letter}`);
  minus.textContent = '−';
  const input = document.createElement('input');
  input.id = `color-${channel}-input`;
  input.type = 'number';
  input.min = '0';
  input.max = String(max);
  input.step = String(step);
  input.setAttribute('aria-label', `Значение ${letter}`);
  const plus = document.createElement('button');
  plus.className = 'color-step-button';
  plus.type = 'button';
  plus.dataset.colorChannel = channel;
  plus.dataset.colorStep = String(step);
  plus.setAttribute('aria-label', `Увеличить ${letter}`);
  plus.textContent = '+';
  control.append(minus, input, plus);
  row.append(label, slider, control);
  return { row, slider, input, minus, plus };
}

/**
 * @param options {
 *   host, alpha?: boolean, codes?: boolean, initial?, onChange?(state), onCopy?(text, button),
 *   floating?: { title, storageKey?, onClose?() }   — живая модалка: заголовок, «поверх», крестик, перетаскивание
 * }
 * Возвращает { element, getState, setState, getHex, setHex, setTitle, open, close, isOpen, isPinned, isEyedropperActive }.
 */
export function createColorPicker(options) {
  const host = options.host;
  const withAlpha = options.alpha !== false;
  const withCodes = options.codes !== false;
  const floating = options.floating || null;
  const storageKey = floating && floating.storageKey ? floating.storageKey : '';
  const saved = readStorage(storageKey);
  let mode = saved.mode === 'hsl' ? 'hsl' : 'rgb';
  let pinned = Boolean(saved.pinned);
  let state = { red: 34, green: 145, blue: 188, alpha: 1, ...(options.initial || {}) };
  let hsl = rgbToHsl(state.red, state.green, state.blue);

  host.replaceChildren();
  host.classList.add('color-picker-panel');
  if (floating) host.classList.add('is-floating');

  // ── заголовок: название, режим, «поверх», крестик ──
  const head = document.createElement('div');
  head.className = 'color-picker-head';
  const title = document.createElement('span');
  title.className = 'color-picker-title';
  title.textContent = floating ? floating.title : 'Генератор цвета';
  const modes = document.createElement('div');
  modes.className = 'color-mode-switch';
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Режим');
  const modeButtons = {};
  for (const [key, label, hint] of [['rgb', 'RGB', 'Красный, зелёный, синий'], ['hsl', 'HSL', 'Тон, насыщенность, светлота']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-mode-button';
    button.dataset.mode = key;
    button.textContent = label;
    button.title = hint;
    button.addEventListener('click', () => setMode(key));
    modes.appendChild(button);
    modeButtons[key] = button;
  }
  head.append(title, modes);
  let pinButton = null;
  if (floating) {
    pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'color-picker-pin';
    pinButton.title = 'Поверх: не закрывать окно щелчками мимо';
    pinButton.setAttribute('aria-pressed', String(pinned));
    pinButton.textContent = 'поверх';
    pinButton.addEventListener('click', () => {
      pinned = !pinned;
      pinButton.setAttribute('aria-pressed', String(pinned));
      host.classList.toggle('is-pinned', pinned);
      writeStorage(storageKey, { pinned });
    });
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'color-picker-close';
    closeButton.title = 'Закрыть';
    closeButton.setAttribute('aria-label', 'Закрыть генератор цвета');
    const icons = typeof window !== 'undefined' ? window.IdylliumIcons : null;
    if (icons && icons.has('close')) closeButton.appendChild(icons.element('close', { size: 14 })); else closeButton.textContent = '×';
    closeButton.addEventListener('click', () => close());
    head.append(pinButton, closeButton);
    host.classList.toggle('is-pinned', pinned);
  }
  host.appendChild(head);

  // ── ползунки: RGB(+A) и HSL(+A), видна одна четвёрка ──
  const grid = document.createElement('div');
  grid.className = 'color-picker-grid';
  const controls = document.createElement('div');
  controls.className = 'color-picker-controls';
  const rows = {};
  const groups = { rgb: [], hsl: [] };
  for (const [channel, letter, hint] of RGB_CHANNELS) {
    const part = channelRow({ channel, letter, title: hint, max: 255, step: 1, sliderClass: `color-slider-${channel}` });
    rows[channel] = part;
    groups.rgb.push(part.row);
    controls.appendChild(part.row);
  }
  for (const [channel, letter, hint, max] of HSL_CHANNELS) {
    const part = channelRow({ channel, letter, title: hint, max, step: 1, sliderClass: `color-slider-${channel}` });
    rows[channel] = part;
    groups.hsl.push(part.row);
    controls.appendChild(part.row);
  }
  if (withAlpha) {
    const part = channelRow({ channel: 'alpha', letter: 'A', title: 'Прозрачность, 0–1 (1 — непрозрачный)', max: 1, step: 0.01, sliderClass: 'color-slider-alpha' });
    rows.alpha = part;
    controls.appendChild(part.row);
  }
  grid.appendChild(controls);

  const previewWrap = document.createElement('div');
  previewWrap.className = 'color-preview-wrap';
  const preview = document.createElement('div');
  preview.id = 'color-preview';
  preview.className = 'color-preview';
  preview.setAttribute('aria-label', 'Выбранный цвет');
  const eyedropper = document.createElement('button');
  eyedropper.id = 'color-eyedropper-button';
  eyedropper.className = 'color-eyedropper-button';
  eyedropper.type = 'button';
  eyedropper.title = 'Пипетка: кликните по нужному пикселю страницы (Esc — отмена)';
  const iconsApi = typeof window !== 'undefined' ? window.IdylliumIcons : null;
  if (iconsApi && iconsApi.has('eyedropper')) eyedropper.appendChild(iconsApi.element('eyedropper', { size: 16 }));
  const eyedropperLabel = document.createElement('span');
  eyedropperLabel.textContent = 'Пипетка';
  eyedropper.appendChild(eyedropperLabel);
  previewWrap.append(preview, eyedropper);
  grid.appendChild(previewWrap);
  host.appendChild(grid);

  // ── строки кода по режиму ──
  const codes = {};
  const codeRows = {};
  if (withCodes) {
    const list = document.createElement('div');
    list.className = 'color-code-list';
    for (const [key, label] of [['rgb', 'RGB'], ['hex', 'HEX'], ['hsl', 'HSL']]) {
      const row = document.createElement('div');
      row.className = 'color-code-row';
      row.dataset.code = key;
      const name = document.createElement('span');
      name.textContent = label;
      const code = document.createElement('code');
      code.id = `color-${key}-code`;
      const copy = document.createElement('button');
      copy.id = `copy-${key}-button`;
      copy.type = 'button';
      copy.textContent = 'Копировать';
      copy.addEventListener('click', () => { if (options.onCopy) options.onCopy(code.textContent, copy); });
      row.append(name, code, copy);
      list.appendChild(row);
      codes[key] = code;
      codeRows[key] = row;
    }
    host.appendChild(list);
  }

  function normalized(next) {
    return {
      red: byte(next.red),
      green: byte(next.green),
      blue: byte(next.blue),
      alpha: withAlpha ? Math.round(clamp(Number(next.alpha), 0, 1) * 100) / 100 : 1,
    };
  }

  function applyMode() {
    for (const row of groups.rgb) row.hidden = mode !== 'rgb';
    for (const row of groups.hsl) row.hidden = mode !== 'hsl';
    for (const [key, button] of Object.entries(modeButtons)) {
      button.classList.toggle('is-active', key === mode);
      button.setAttribute('aria-pressed', String(key === mode));
    }
    if (withCodes) {
      codeRows.rgb.hidden = mode !== 'rgb';
      codeRows.hex.hidden = mode !== 'rgb';
      codeRows.hsl.hidden = mode !== 'hsl';
    }
  }

  function setMode(next) {
    mode = next === 'hsl' ? 'hsl' : 'rgb';
    writeStorage(storageKey, { mode });
    applyMode();
  }

  function render() {
    for (const [channel] of RGB_CHANNELS) {
      rows[channel].slider.value = String(state[channel]);
      if (document.activeElement !== rows[channel].input) rows[channel].input.value = String(state[channel]);
    }
    for (const [channel] of HSL_CHANNELS) {
      rows[channel].slider.value = String(hsl[channel]);
      if (document.activeElement !== rows[channel].input) rows[channel].input.value = String(hsl[channel]);
    }
    if (withAlpha) {
      rows.alpha.slider.value = formatAlpha(state.alpha);
      if (document.activeElement !== rows.alpha.input) rows.alpha.input.value = formatAlpha(state.alpha);
    }
    // Фон ползунков HSL — что получится, если двигать именно его при прочих равных.
    const at = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;
    const midLight = hsl.lightness === 0 || hsl.lightness === 100 ? 50 : hsl.lightness;
    rows.hue.slider.style.background = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => at(h, Math.max(hsl.saturation, 30), midLight)).join(', ')})`;
    rows.saturation.slider.style.background = `linear-gradient(to right, ${at(hsl.hue, 0, midLight)}, ${at(hsl.hue, 100, midLight)})`;
    rows.lightness.slider.style.background = `linear-gradient(to right, ${at(hsl.hue, hsl.saturation, 0)}, ${at(hsl.hue, hsl.saturation, 50)}, ${at(hsl.hue, hsl.saturation, 100)})`;
    // Предпросмотр — через переменные: CSS кладёт цвет на шахматку с логотипом.
    preview.style.setProperty('--preview-rgb', `rgb(${state.red}, ${state.green}, ${state.blue})`);
    preview.style.setProperty('--preview-rgba', `rgba(${state.red}, ${state.green}, ${state.blue}, ${formatAlpha(state.alpha)})`);
    if (withCodes) {
      codes.rgb.textContent = state.alpha >= 1
        ? `colors.RGB(${state.red}, ${state.green}, ${state.blue})`
        : `colors.RGBA(${state.red}, ${state.green}, ${state.blue}, ${formatAlpha(state.alpha)})`;
      codes.hex.textContent = `colors.HEX("${colorHex(state)}")`;
      codes.hsl.textContent = `colors.HSL(${hsl.hue}, ${hsl.saturation}, ${hsl.lightness})`;
    }
  }

  let silent = false;
  function commit(next, { fromHsl = false } = {}) {
    state = normalized({ ...state, ...next });
    if (!fromHsl) hsl = rgbToHsl(state.red, state.green, state.blue);
    render();
    if (!silent && options.onChange) options.onChange({ ...state, hsl: { ...hsl }, hex: colorHex(state) });
  }

  function setRgbChannel(channel, raw) {
    const value = Number(raw);
    if (!Number.isFinite(value)) { render(); return; }
    commit({ [channel]: value });
  }

  function setHslChannel(channel, raw) {
    const value = Number(raw);
    if (!Number.isFinite(value)) { render(); return; }
    const max = channel === 'hue' ? 360 : 100;
    hsl = { ...hsl, [channel]: Math.round(clamp(value, 0, max)) };
    commit(hslToRgb(hsl.hue, hsl.saturation, hsl.lightness), { fromHsl: true });
  }

  for (const [channel] of RGB_CHANNELS) {
    rows[channel].slider.addEventListener('input', () => setRgbChannel(channel, rows[channel].slider.value));
    rows[channel].input.addEventListener('change', () => setRgbChannel(channel, rows[channel].input.value));
    rows[channel].minus.addEventListener('click', () => setRgbChannel(channel, state[channel] - 1));
    rows[channel].plus.addEventListener('click', () => setRgbChannel(channel, state[channel] + 1));
  }
  for (const [channel] of HSL_CHANNELS) {
    rows[channel].slider.addEventListener('input', () => setHslChannel(channel, rows[channel].slider.value));
    rows[channel].input.addEventListener('change', () => setHslChannel(channel, rows[channel].input.value));
    rows[channel].minus.addEventListener('click', () => setHslChannel(channel, hsl[channel] - 1));
    rows[channel].plus.addEventListener('click', () => setHslChannel(channel, hsl[channel] + 1));
  }
  if (withAlpha) {
    rows.alpha.slider.addEventListener('input', () => setRgbChannel('alpha', rows.alpha.slider.value));
    rows.alpha.input.addEventListener('change', () => setRgbChannel('alpha', rows.alpha.input.value));
    rows.alpha.minus.addEventListener('click', () => setRgbChannel('alpha', state.alpha - 0.01));
    rows.alpha.plus.addEventListener('click', () => setRgbChannel('alpha', state.alpha + 0.01));
  }
  for (const part of Object.values(rows)) {
    part.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        part.input.dispatchEvent(new Event('change'));
        part.input.blur();
        event.preventDefault();
      }
    });
  }

  // Пипетка берёт RGB с любого места страницы (и кадра предпросмотра); альфу не трогает.
  setupColorEyedropper((picked) => {
    if (!picked) return;
    commit({ red: picked.red, green: picked.green, blue: picked.blue });
  });

  // ── живая модалка: перетаскивание за полотно, положение в памяти ──
  function place(position) {
    if (!floating) return;
    const width = host.offsetWidth || 460;
    const height = host.offsetHeight || 320;
    const left = clamp(position.left, 4, Math.max(4, window.innerWidth - width - 4));
    const top = clamp(position.top, 4, Math.max(4, window.innerHeight - height - 4));
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;
  }
  if (floating) {
    host.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      // Хватать можно за заголовок и за пустое полотно, но не за ползунки, поля, кнопки и код.
      if (target && target.closest('input, button, select, textarea, code, .color-preview')) return;
      const rect = host.getBoundingClientRect();
      const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      host.classList.add('is-dragging');
      const move = (moveEvent) => place({ left: moveEvent.clientX - offset.x, top: moveEvent.clientY - offset.y });
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        host.classList.remove('is-dragging');
        writeStorage(storageKey, { left: parseFloat(host.style.left), top: parseFloat(host.style.top) });
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      event.preventDefault();
    });
    window.addEventListener('resize', () => { if (!host.hidden) place({ left: parseFloat(host.style.left) || 0, top: parseFloat(host.style.top) || 0 }); });
  }

  function open(anchorPosition) {
    host.hidden = false;
    if (floating) {
      const stored = readStorage(storageKey);
      if (Number.isFinite(stored.left) && Number.isFinite(stored.top)) place({ left: stored.left, top: stored.top });
      else if (anchorPosition) place(anchorPosition);
      else place({ left: window.innerWidth - (host.offsetWidth || 460) - 24, top: 80 });
    }
  }

  function close() {
    if (host.hidden) return;
    host.hidden = true;
    if (floating && floating.onClose) floating.onClose();
  }

  applyMode();
  render();

  return {
    element: host,
    getState: () => ({ ...state, hsl: { ...hsl }, hex: colorHex(state) }),
    setState: (next, { quiet = false } = {}) => { silent = quiet; try { commit(next); } finally { silent = false; } },
    getHex: () => colorHex(state),
    setHex: (text, { quiet = false } = {}) => {
      const parsed = parseHex(text);
      if (!parsed) return false;
      silent = quiet;
      try { commit(withAlpha ? parsed : { red: parsed.red, green: parsed.green, blue: parsed.blue }); } finally { silent = false; }
      return true;
    },
    setTitle: (text) => { title.textContent = text; },
    getMode: () => mode,
    setMode,
    open,
    close,
    isOpen: () => !host.hidden,
    isPinned: () => pinned,
    isEyedropperActive: () => eyedropper.classList.contains('eyedropper-active'),
  };
}
