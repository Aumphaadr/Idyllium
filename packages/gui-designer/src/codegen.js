'use strict';

// Модель макета → программа на Idyllium в идиоме учебника (1.6.3). Пишутся ТОЛЬКО явно
// выставленные свойства; порядок — объявление виджета, его свойства, дети (для Frame),
// add_child в родителя; вкладки — страницы-Frame и add_tab, как в уроке «Вкладки».
// Заготовки обработчиков — по галочкам на каждое событие каждого виджета (item.handlers),
// перед win.show(). CommonJS: модуль делят страница конструктора и тесты.

const { WINDOW_PROPS, widgetDefinition, propertyOf, eventsOf } = require('./widgets');

const MODEL_VERSION = 1;
const MODEL_COMMENT_PREFIX = '// gui-designer:';

function escapeString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '\\t');
}

function formatValue(kind, value) {
  switch (kind) {
    case 'int':
      return String(Math.round(Number(value)));
    case 'float': {
      const number = Number(value);
      const text = String(number);
      return /[.eE]/u.test(text) ? text : `${text}.0`;
    }
    case 'bool':
      return value ? 'true' : 'false';
    case 'color':
      return `colors.HEX("${escapeString(normalizeHex(value))}")`;
    case 'font':
      return String(value); // имя переменной fonts.Font
    case 'enum':
    case 'string':
    default:
      return `"${escapeString(value)}"`;
  }
}

/** #rrggbb или #rrggbbaa (colors.HEX понимает оба); чужой текст — чёрный. */
function normalizeHex(value) {
  const text = String(value || '').trim();
  const match = /^#?([0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/u.exec(text);
  return match ? `#${match[1].toLowerCase()}` : '#000000';
}

/** Свойство считается заданным, если оно есть в props и не равно null/undefined/''. */
function hasValue(props, name) {
  return props && props[name] !== undefined && props[name] !== null && props[name] !== '';
}

function childrenOf(model, parentId) {
  return model.widgets.filter((item) => item.parent === parentId);
}

/** Шрифты макета: [{ name, file }] — переменные fonts.Font, загруженные из файлов проекта. */
function fontsOf(model) {
  return Array.isArray(model.fonts) ? model.fonts.filter((font) => font && typeof font.name === 'string' && typeof font.file === 'string') : [];
}

function usesColors(model) {
  const check = (type, props) => Object.keys(props || {}).some((name) => {
    const prop = propertyOf(type, name);
    return prop && prop.kind === 'color' && hasValue(props, name);
  });
  if (check('Window', model.window.props)) return true;
  return model.widgets.some((item) => check(item.type, item.props));
}

/** Данные виджета (пункты, колонки и строки, значения, точки) — вызовами методов, как в уроках. */
function dataLines(indent, ownerName, type, data) {
  const def = widgetDefinition(type);
  if (!def.data || !data) return [];
  const lines = [];
  const text = (value) => `"${escapeString(value)}"`;
  const number = (value) => formatValue('float', value);
  if (def.data.shape === 'strings') {
    for (const item of Array.isArray(data.items) ? data.items : []) lines.push(`${indent}${ownerName}.${def.data.method}(${text(item)});`);
  } else if (def.data.shape === 'table') {
    const columns = Array.isArray(data.columns) ? data.columns.map(String) : [];
    if (columns.length > 0) {
      lines.push(`${indent}${ownerName}.set_columns(${columns.map(text).join(', ')});`);
      for (const row of Array.isArray(data.rows) ? data.rows : []) {
        // Таблица сторожит число ячеек — ряд подгоняем под колонки: лишнее отрезаем, недостающее — пустые.
        const cells = columns.map((_, index) => (Array.isArray(row) && row[index] !== undefined ? String(row[index]) : ''));
        lines.push(`${indent}${ownerName}.add_row(${cells.map(text).join(', ')});`);
      }
    }
  } else if (def.data.shape === 'entries') {
    for (const entry of Array.isArray(data.entries) ? data.entries : []) {
      lines.push(`${indent}${ownerName}.${def.data.method}(${text(entry.label)}, ${number(entry.value)});`);
    }
  } else if (def.data.shape === 'numbers') {
    for (const point of Array.isArray(data.points) ? data.points : []) lines.push(`${indent}${ownerName}.${def.data.method}(${number(point)});`);
  }
  return lines;
}

function propertyLines(indent, ownerName, type, props, skip = []) {
  const lines = [];
  const catalogue = type === 'Window' ? WINDOW_PROPS : widgetDefinition(type).props;
  for (const prop of catalogue) {
    if (skip.includes(prop.name) || !hasValue(props, prop.name)) continue;
    lines.push(`${indent}${ownerName}.${prop.name} = ${formatValue(prop.kind, props[prop.name])};`);
  }
  return lines;
}

/** Какие заготовки писать: options.handlers === true — все события (тесты), иначе — по галочкам. */
function handlersFor(owner, type, options) {
  const events = eventsOf(type);
  if (options.handlers === true) return events;
  const chosen = Array.isArray(owner.handlers) ? owner.handlers : [];
  return events.filter((event) => chosen.includes(event.name));
}

function handlerStub(indent, ownerName, event) {
  return ['', `${indent}${ownerName}.${event.name} = void function(${event.params || ''}) {`, `${indent}${indent}// ${event.comment}`, `${indent}};`];
}

/**
 * @param model  { window: { name, props, handlers? }, widgets: [{ id, type, name, parent, props, tabTitle?, handlers? }] }
 * @param options { handlers?: true, previewTabs?: Record<id, index>, embedModel?: boolean }
 */
function generateCode(model, options = {}) {
  const indent = '    ';
  const lines = ['use gui;'];
  if (usesColors(model)) lines.push('use colors;');
  const fonts = fontsOf(model);
  if (fonts.length > 0) lines.push('use fonts;');
  lines.push('', 'main() {');

  // Шрифты — до окна: как в уроке «Шрифты», fonts.Font + load_from_file, потом присвоение.
  for (const font of fonts) {
    lines.push(`${indent}fonts.Font ${font.name};`);
    lines.push(`${indent}${font.name}.load_from_file("${escapeString(font.file)}");`);
  }
  if (fonts.length > 0) lines.push('');

  const win = model.window;
  lines.push(`${indent}gui.Window ${win.name};`);
  lines.push(...propertyLines(indent, win.name, 'Window', win.props));

  const handlerLines = [];
  const emitWidget = (item, parentName) => {
    const def = widgetDefinition(item.type);
    lines.push('');
    lines.push(`${indent}gui.${item.type} ${item.name};`);
    lines.push(...propertyLines(indent, item.name, item.type, item.props));
    lines.push(...dataLines(indent, item.name, item.type, item.data));
    if (def.container === 'tabs') {
      // Для предпросмотра показываем страницу, которую сейчас правят; в код ученика это не попадает.
      const previewIndex = options.previewTabs && options.previewTabs[item.id];
      if (previewIndex !== undefined && previewIndex !== null) {
        lines.push(`${indent}${item.name}.selected_index = ${Math.round(Number(previewIndex))};`);
      }
    }
    const children = childrenOf(model, item.id);
    if (def.container === 'children') {
      for (const child of children) emitWidget(child, item.name);
    } else if (def.container === 'tabs') {
      for (const page of children) {
        emitWidget(page, null);
        lines.push(`${indent}${item.name}.add_tab("${escapeString(page.tabTitle || '')}", ${page.name});`);
      }
    }
    if (parentName) lines.push(`${indent}${parentName}.add_child(${item.name});`);
    for (const event of handlersFor(item, item.type, options)) handlerLines.push(...handlerStub(indent, item.name, event));
  };

  for (const item of childrenOf(model, null)) emitWidget(item, win.name);
  for (const event of handlersFor(win, 'Window', options)) handlerLines.push(...handlerStub(indent, win.name, event));

  lines.push(...handlerLines);
  lines.push('', `${indent}${win.name}.show();`, '}');
  let code = `${lines.join('\n')}\n`;
  if (options.embedModel) code += `\n${MODEL_COMMENT_PREFIX} ${JSON.stringify(stripModel(model))}\n`;
  return code;
}

/** Модель без служебных полей — то, что кладём в файл. */
function stripModel(model) {
  const withHandlers = (target, copy) => {
    if (Array.isArray(target.handlers) && target.handlers.length > 0) copy.handlers = [...target.handlers];
    return copy;
  };
  const fonts = fontsOf(model).map((font) => ({ name: font.name, file: font.file }));
  return {
    version: MODEL_VERSION,
    window: withHandlers(model.window, { name: model.window.name, props: { ...model.window.props } }),
    ...(fonts.length > 0 ? { fonts } : {}),
    widgets: model.widgets.map((item) => {
      const copy = { id: item.id, type: item.type, name: item.name, parent: item.parent, props: { ...item.props } };
      if (item.tabTitle !== undefined) copy.tabTitle = item.tabTitle;
      if (item.data && Object.keys(item.data).length > 0) copy.data = JSON.parse(JSON.stringify(item.data));
      return withHandlers(item, copy);
    }),
  };
}

/** Макет из файла main.idyl с комментарием (или null, если комментария нет). */
function extractEmbeddedModel(text) {
  const line = String(text).split('\n').map((item) => item.trim()).find((item) => item.startsWith(MODEL_COMMENT_PREFIX));
  if (!line) return null;
  return JSON.parse(line.slice(MODEL_COMMENT_PREFIX.length).trim());
}

/** Код файла без строки макета — чтобы сверить с тем, что генерирует модель. */
function stripEmbeddedModel(text) {
  return String(text).split('\n').filter((item) => !item.trim().startsWith(MODEL_COMMENT_PREFIX)).join('\n').replace(/\n+$/u, '\n');
}

/**
 * Чем файл отличается от того, что породил бы макет: строки файла, которых макет не знает
 * (они пропадут при пересборке), и строки макета, которых в файле нет (их удалили руками).
 * Сравнение построчное, без учёта отступов и пустых строк; результат — диапазоны строк файла.
 */
function codeDifference(fileCode, regeneratedCode) {
  const normalize = (line) => line.trim();
  const fileLines = String(fileCode).split('\n');
  const generatedCounts = new Map();
  for (const line of String(regeneratedCode).split('\n')) {
    const key = normalize(line);
    if (key === '') continue;
    generatedCounts.set(key, (generatedCounts.get(key) || 0) + 1);
  }
  const extra = []; // { line: номер (с 1), text }
  fileLines.forEach((line, index) => {
    const key = normalize(line);
    if (key === '') return;
    const left = generatedCounts.get(key) || 0;
    if (left > 0) generatedCounts.set(key, left - 1);
    else extra.push({ line: index + 1, text: line.trimEnd() });
  });
  const ranges = [];
  for (const item of extra) {
    const last = ranges[ranges.length - 1];
    if (last && item.line === last.to + 1) {
      last.to = item.line;
      last.count++;
    } else {
      ranges.push({ from: item.line, to: item.line, count: 1, first: item.text.trim() });
    }
  }
  const missing = [...generatedCounts.entries()].filter(([, count]) => count > 0).map(([text]) => text);
  return { extraRanges: ranges, extraLines: extra.length, missingLines: missing };
}

/**
 * Копия макета без шрифтов, файлов которых нет (hasFile(file) → false): предпросмотр не должен
 * падать на load_from_file, а честно показать окно без шрифта. Возвращает { model, missing }.
 */
function withoutMissingFonts(model, hasFile) {
  const missing = fontsOf(model).filter((font) => !hasFile(font.file));
  if (missing.length === 0) return { model, missing: [] };
  const gone = new Set(missing.map((font) => font.name));
  const strip = (props) => {
    const copy = { ...props };
    if (gone.has(copy.font)) delete copy.font;
    return copy;
  };
  return {
    model: {
      ...model,
      fonts: fontsOf(model).filter((font) => !gone.has(font.name)),
      window: { ...model.window, props: strip(model.window.props) },
      widgets: model.widgets.map((item) => ({ ...item, props: strip(item.props) })),
    },
    missing,
  };
}

module.exports = {
  MODEL_VERSION,
  fontsOf,
  withoutMissingFonts,
  MODEL_COMMENT_PREFIX,
  generateCode,
  formatValue,
  normalizeHex,
  stripModel,
  extractEmbeddedModel,
  stripEmbeddedModel,
  codeDifference,
  childrenOf,
};
