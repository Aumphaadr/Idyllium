// IdySS — стилевой мини-язык виджетов (путь QSS): строка вида
// "color: red; border-radius: 12px;" разбирается в список проверенных пар.
// Главный контракт: ошибки МОЛЧАТ. Неизвестное свойство или кривое значение
// просто отбрасываются — как в настоящем CSS. Санитизация встроена в
// конструкцию: в снапшот (и затем на element.style) попадают только пары,
// прошедшие словарь и белые списки форм значений; произвольный CSS-текст
// никогда никуда не вставляется.

export interface IdylliumStyleDeclaration {
  readonly property: string;
  readonly value: string;
}

// Именованные цвета — РОВНО палитра библиотеки colors (green = #00FF00,
// а не CSS-легаси): один словарь цветов на весь Idyllium.
const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  'dark-red': '#800000',
  green: '#00FF00',
  'dark-green': '#008000',
  blue: '#0000FF',
  'dark-blue': '#000080',
  yellow: '#FFFF00',
  olive: '#808000',
  cyan: '#00FFFF',
  teal: '#008080',
  magenta: '#FF00FF',
  purple: '#800080',
  gray: '#808080',
  'light-gray': '#C0C0C0',
  transparent: 'transparent',
};

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/u;
const RGB_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/u;
const RGBA_RE = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+|1\.0+)\s*\)$/u;

function colorValue(raw: string): string | null {
  const value = raw.toLowerCase();
  const named = NAMED_COLORS[value];
  if (named) return named;
  if (HEX_COLOR_RE.test(value)) return value;

  const rgb = RGB_RE.exec(value);
  if (rgb) {
    const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (channels.some((channel) => channel > 255)) return null;
    return `rgb(${channels.join(', ')})`;
  }

  const rgba = RGBA_RE.exec(value);
  if (rgba) {
    const channels = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const alpha = Number(rgba[4]);
    if (channels.some((channel) => channel > 255) || alpha > 1) return null;
    return `rgba(${channels.join(', ')}, ${alpha})`;
  }

  return null;
}

function pixelValue(min: number, max: number): (raw: string) => string | null {
  return (raw: string) => {
    const match = /^(\d{1,4})(px)?$/u.exec(raw);
    if (!match) return null;
    const amount = Number(match[1]);
    if (amount < min || amount > max) return null;
    return `${amount}px`;
  };
}

function keywordValue(...allowed: string[]): (raw: string) => string | null {
  return (raw: string) => {
    const value = raw.toLowerCase();
    return allowed.includes(value) ? value : null;
  };
}

// Градиенты: строгое подмножество CSS — linear-gradient с направлением
// «to сторона» или углом Ndeg и radial-gradient без параметров формы.
// Каждая цветовая остановка проходит через общий валидатор цвета, поэтому
// url(), var() и прочий посторонний CSS внутрь не просачиваются.
const GRADIENT_DIRECTIONS = new Set([
  'to top', 'to bottom', 'to left', 'to right',
  'to top left', 'to top right', 'to bottom left', 'to bottom right',
]);
const GRADIENT_ANGLE_RE = /^(\d{1,3})deg$/u;
const GRADIENT_STOP_PERCENT_RE = /^(\d{1,3})%$/u;

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

function gradientStop(raw: string): string | null {
  const pieces = raw.split(/\s+/u);
  if (pieces.length === 1) return colorValue(pieces[0]);
  // rgb(...)/rgba(...) содержат пробелы после запятых — собираем цвет обратно
  // и допускаем один процентный хвост.
  const last = pieces[pieces.length - 1];
  const percent = GRADIENT_STOP_PERCENT_RE.exec(last);
  const colorText = percent ? pieces.slice(0, -1).join(' ') : pieces.join(' ');
  const color = colorValue(colorText);
  if (!color) return null;
  if (!percent) return color;
  if (Number(percent[1]) > 100) return null;
  return `${color} ${percent[1]}%`;
}

function gradientValue(raw: string): string | null {
  const match = /^(linear|radial)-gradient\((.+)\)$/u.exec(raw.trim().toLowerCase());
  if (!match) return null;
  const kind = match[1];
  const parts = splitTopLevel(match[2]);
  if (parts.length < 2) return null;

  const normalized: string[] = [];
  let stopsStart = 0;

  if (kind === 'linear') {
    const first = parts[0].replace(/\s+/gu, ' ');
    const angle = GRADIENT_ANGLE_RE.exec(first);
    if (GRADIENT_DIRECTIONS.has(first)) {
      normalized.push(first);
      stopsStart = 1;
    } else if (angle) {
      if (Number(angle[1]) > 360) return null;
      normalized.push(`${angle[1]}deg`);
      stopsStart = 1;
    }
  }

  const stops = parts.slice(stopsStart);
  if (stops.length < 2 || stops.length > 8) return null;
  for (const stop of stops) {
    const value = gradientStop(stop);
    if (value === null) return null;
    normalized.push(value);
  }

  return `${kind}-gradient(${normalized.join(', ')})`;
}

function opacityValue(raw: string): string | null {
  if (!/^(0|1|0?\.\d+|1\.0+)$/u.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) return null;
  return String(amount);
}

// Словарь v1: свойство попадает сюда, только если его эффект мгновенно виден
// и не ломает геометрию превью. Всё вне словаря молча игнорируется.
const STYLE_PROPERTIES: Readonly<Record<string, (raw: string) => string | null>> = {
  color: colorValue,
  'background-color': colorValue,
  // Только градиентные формы; сплошной цвет — через background-color.
  background: gradientValue,
  'border-color': colorValue,
  'border-width': pixelValue(0, 20),
  'border-radius': pixelValue(0, 100),
  'border-style': keywordValue('solid', 'dashed', 'dotted', 'none'),
  'font-size': pixelValue(6, 96),
  'font-weight': keywordValue('normal', 'bold'),
  'font-style': keywordValue('normal', 'italic'),
  'text-align': keywordValue('left', 'center', 'right'),
  opacity: opacityValue,
  padding: pixelValue(0, 40),
};

const parseCache = new Map<string, readonly IdylliumStyleDeclaration[]>();

export function parseIdylliumStyle(text: string): readonly IdylliumStyleDeclaration[] {
  if (typeof text !== 'string' || text.trim() === '') return [];

  const cached = parseCache.get(text);
  if (cached) return cached;

  const declarations: IdylliumStyleDeclaration[] = [];
  for (const chunk of text.split(';')) {
    const colonIndex = chunk.indexOf(':');
    if (colonIndex < 0) continue;
    const property = chunk.slice(0, colonIndex).trim().toLowerCase();
    const rawValue = chunk.slice(colonIndex + 1).trim();
    const validator = STYLE_PROPERTIES[property];
    if (!validator || rawValue === '') continue;
    const value = validator(rawValue);
    if (value === null) continue;
    declarations.push({ property, value });
  }

  if (parseCache.size > 256) parseCache.clear();
  parseCache.set(text, declarations);
  return declarations;
}
