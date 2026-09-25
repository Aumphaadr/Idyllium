'use strict';

// Единый набор иконок Idyllium (1.6.3; ТЗ — Idyllium-backstage/tech/spec/some_gui_designer/02).
// Источник — packages/icons/svg/<имя>.svg (набор владельца, обводка Пантографом). Отсюда
// собираются четыре вещи, все генерируемые (в git ради tsc и CI, править — только источник):
//   src/icon-names.ts             — имена (реестр и рантайм gui.Icon: без разметки, чтобы ядро не толстело);
//   src/icons.ts                  — имена + разметка + iconSvg() (сборщики сайта, VS Code);
//   packages/gui-renderer/icons.js — window.IdylliumIcons для рендерера, Web IDE, страниц сайта, конструктора;
//   packages/icons/icons.json     — то же для CommonJS (каталог конструктора, тесты).
// Нормализация: только <path> (и <g transform>), viewBox приводится к 0 0 20 20, цвет — только
// currentColor; текст, картинки, скрипты и чужие цвета — отказ сборки словами.
// Запуск: node tools/build-icons.js (стоит первым в npm run build). Модуль экспортирует generate()
// для стража tests/icons.test.ts — он сверяет файлы в репозитории со свежей генерацией.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'packages', 'icons', 'svg');
const VIEWBOX = '0 0 20 20';
const NAME_PATTERN = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|widget-[A-Z][A-Za-z]*)$/u;

function fail(name, message) {
  throw new Error(`icons: ${name}.svg — ${message}`);
}

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}="([^"]*)"`, 'u').exec(tag);
  return match ? match[1] : null;
}

/** Внутренняя разметка значка на сетке 20×20: только пути с currentColor. */
function normalizeSvg(name, text) {
  if (!NAME_PATTERN.test(name)) fail(name, 'имя — строчные латинские буквы, цифры и дефис (или widget-<Тип>)');
  for (const forbidden of ['<text', '<image', '<script', '<style', '<use', '<foreignObject', 'xlink:href']) {
    if (text.includes(forbidden)) fail(name, `запрещённый элемент ${forbidden}`);
  }
  const root = /<svg\b[^>]*>/u.exec(text);
  if (!root) fail(name, 'нет корневого <svg>');
  const viewBox = attribute(root[0], 'viewBox');
  if (!viewBox) fail(name, 'нет viewBox');
  const box = viewBox.trim().split(/[\s,]+/u).map(Number);
  if (box.length !== 4 || box.some((value) => !Number.isFinite(value)) || box[2] <= 0 || box[3] <= 0) fail(name, `странный viewBox «${viewBox}»`);

  const parts = [];
  const groups = []; // открытые <g transform="…">
  const tokens = text.matchAll(/<(\/?)(g|path)\b([^>]*?)(\/?)>/gu);
  for (const token of tokens) {
    const [, closing, tag, attrs, selfClosing] = token;
    if (tag === 'g') {
      if (closing) {
        if (groups.length > 0) parts.push('</g>');
        groups.pop();
      } else {
        const transform = attribute(attrs, 'transform');
        groups.push(transform);
        if (transform) parts.push(`<g transform="${transform}">`);
      }
      continue;
    }
    if (closing) continue;
    const d = attribute(attrs, 'd');
    if (!d) fail(name, '<path> без атрибута d');
    const fill = attribute(attrs, 'fill');
    const stroke = attribute(attrs, 'stroke');
    if (fill && !['currentColor', 'none', '#000', '#000000', 'black'].includes(fill)) fail(name, `зашитый цвет заливки ${fill}`);
    if (stroke && !['currentColor', 'none', '#000', '#000000', 'black'].includes(stroke)) fail(name, `зашитый цвет обводки ${stroke}`);
    let pathTag = `<path d="${d.replace(/\s+/gu, ' ').trim()}"`;
    if (fill === 'none') {
      pathTag += ' fill="none"';
      if (stroke) {
        pathTag += ' stroke="currentColor"';
        const strokeWidth = attribute(attrs, 'stroke-width');
        if (strokeWidth) pathTag += ` stroke-width="${strokeWidth}"`;
        const lineCap = attribute(attrs, 'stroke-linecap');
        if (lineCap) pathTag += ` stroke-linecap="${lineCap}"`;
        const lineJoin = attribute(attrs, 'stroke-linejoin');
        if (lineJoin) pathTag += ` stroke-linejoin="${lineJoin}"`;
      }
    } else {
      pathTag += ' fill="currentColor"';
      const fillRule = attribute(attrs, 'fill-rule');
      if (fillRule) pathTag += ` fill-rule="${fillRule}"`;
    }
    parts.push(`${pathTag}/>`);
    if (!selfClosing) {
      // <path …></path> — закрывающий тег просто пропустим при следующем совпадении
    }
  }
  const drawn = parts.filter((part) => part.startsWith('<path')).length;
  if (drawn === 0) fail(name, 'нет ни одного <path>');
  let markup = parts.join('');
  // Чужая сетка (сырой экспорт Inkscape) — приводим к 20×20 масштабом и сдвигом.
  const [minX, minY, width, height] = box;
  if (viewBox.trim() !== VIEWBOX) {
    const scale = 20 / Math.max(width, height);
    const offsetX = (Math.max(width, height) - width) / 2 - minX;
    const offsetY = (Math.max(width, height) - height) / 2 - minY;
    const round = (value) => Number(value.toFixed(6));
    markup = `<g transform="scale(${round(scale)}) translate(${round(offsetX)} ${round(offsetY)})">${markup}</g>`;
  }
  return markup;
}

function generate() {
  if (!fs.existsSync(sourceDir)) throw new Error(`icons: нет папки ${path.relative(rootDir, sourceDir)}`);
  const names = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4)).sort();
  if (names.length === 0) throw new Error('icons: набор пуст');
  const markup = {};
  for (const name of names) {
    markup[name] = normalizeSvg(name, fs.readFileSync(path.join(sourceDir, `${name}.svg`), 'utf8'));
  }
  const header = '/* Сгенерировано tools/build-icons.js из packages/icons/svg — не править руками; запуск: node tools/build-icons.js */';
  const namesLiteral = names.map((name) => `'${name}'`).join(', ');

  const iconNamesTs = `${header}
export const ICON_VIEWBOX = '${VIEWBOX}';
export const ICON_NAMES = [${namesLiteral}] as const;
export type IconName = (typeof ICON_NAMES)[number];
export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value);
}
`;

  const markupTs = names.map((name) => `  '${name}': ${JSON.stringify(markup[name])},`).join('\n');
  const iconsTs = `${header}
import { ICON_NAMES, ICON_VIEWBOX, isIconName } from './icon-names';
import type { IconName } from './icon-names';

export { ICON_NAMES, ICON_VIEWBOX, isIconName };
export type { IconName };

/** Внутренняя разметка каждого значка (пути на сетке ${VIEWBOX}, цвет — currentColor). */
export const ICON_MARKUP: Readonly<Record<IconName, string>> = {
${markupTs}
};

export interface IconSvgOptions {
  readonly size?: number;
  readonly className?: string;
  readonly title?: string;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Готовый <svg> значка: размер в px (по умолчанию 16), классы icon и icon-<имя>, подпись — <title>. */
export function iconSvg(name: IconName, options: IconSvgOptions = {}): string {
  const size = options.size ?? 16;
  const className = \`icon icon-\${name}\${options.className ? \` \${options.className}\` : ''}\`;
  const title = options.title ? \`<title>\${escapeAttribute(options.title)}</title>\` : '';
  const aria = options.title ? \`role="img" aria-label="\${escapeAttribute(options.title)}"\` : 'aria-hidden="true"';
  return \`<svg class="\${className}" viewBox="\${ICON_VIEWBOX}" width="\${size}" height="\${size}" fill="currentColor" \${aria} focusable="false">\${title}\${ICON_MARKUP[name]}</svg>\`;
}
`;

  const markupJs = names.map((name) => `    '${name}': ${JSON.stringify(markup[name])}`).join(',\n');
  const iconsJs = `${header}
(function (global) {
  'use strict';
  var VIEWBOX = '${VIEWBOX}';
  var MARKUP = {
${markupJs}
  };
  var NAMES = Object.keys(MARKUP);

  function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function has(name) {
    return Object.prototype.hasOwnProperty.call(MARKUP, name);
  }

  /** Готовый <svg> значка строкой: size — px (16), className — добавочные классы, title — подпись. */
  function svg(name, options) {
    options = options || {};
    if (!has(name)) return '';
    var size = options.size || 16;
    var className = 'icon icon-' + name + (options.className ? ' ' + options.className : '');
    var title = options.title ? '<title>' + escapeAttribute(options.title) + '</title>' : '';
    var aria = options.title ? 'role="img" aria-label="' + escapeAttribute(options.title) + '"' : 'aria-hidden="true"';
    return '<svg class="' + className + '" viewBox="' + VIEWBOX + '" width="' + size + '" height="' + size + '" fill="currentColor" ' + aria + ' focusable="false">' + title + MARKUP[name] + '</svg>';
  }

  /** Тот же значок DOM-элементом (в чужом документе — передайте options.document). */
  function element(name, options) {
    options = options || {};
    var doc = options.document || global.document;
    var host = doc.createElement('span');
    host.innerHTML = svg(name, options);
    return host.firstElementChild || host;
  }

  /** Заменяет все <i data-icon="имя" data-size="20"> внутри root готовыми <svg>. */
  function mountAll(root) {
    root = root || global.document;
    var placeholders = root.querySelectorAll ? root.querySelectorAll('[data-icon]') : [];
    for (var index = 0; index < placeholders.length; index += 1) {
      var placeholder = placeholders[index];
      var name = placeholder.getAttribute('data-icon');
      if (!has(name)) continue;
      var size = Number(placeholder.getAttribute('data-size')) || 16;
      var icon = element(name, { size: size, className: placeholder.className || '', title: placeholder.getAttribute('data-title') || '', document: placeholder.ownerDocument });
      placeholder.replaceWith(icon);
    }
  }

  global.IdylliumIcons = { viewBox: VIEWBOX, names: NAMES, markup: MARKUP, has: has, svg: svg, element: element, mountAll: mountAll };
})(typeof window !== 'undefined' ? window : globalThis);
`;

  const iconsJson = `${JSON.stringify({ viewBox: VIEWBOX, names, markup }, null, 1)}\n`;
  const namesJson = `${JSON.stringify(names, null, 1)}\n`;
  return {
    'src/icon-names.ts': iconNamesTs,
    'src/icons.ts': iconsTs,
    'packages/gui-renderer/icons.js': iconsJs,
    'packages/icons/icons.json': iconsJson,
    'packages/icons/icon-names.json': namesJson,
  };
}

function write() {
  const outputs = generate();
  let changed = 0;
  for (const [relative, content] of Object.entries(outputs)) {
    const target = path.join(rootDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (previous !== content) {
      fs.writeFileSync(target, content, 'utf8');
      changed++;
    }
  }
  const count = Object.keys(JSON.parse(outputs['packages/icons/icons.json']).markup).length;
  console.log(`Idyllium icons: ${count} icons → 5 files${changed ? ` (${changed} updated)` : ' (up to date)'}`);
}

module.exports = { generate, normalizeSvg, VIEWBOX, sourceDir };

if (require.main === module) write();
