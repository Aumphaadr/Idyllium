'use strict';

// Модель макета → программа на Idyllium в идиоме учебника (1.6.3). Пишутся ТОЛЬКО явно
// выставленные свойства; порядок — объявление виджета, его свойства, дети (для Frame),
// add_child в родителя; вкладки — страницы-Frame и add_tab, как в уроке «Вкладки».
// Обработчики не генерируются; по галочке — пустые заготовки перед win.show().
// CommonJS: модуль делят страница конструктора и тесты.

const { WINDOW_PROPS, widgetDefinition, propertyOf } = require('./widgets');

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
    case 'enum':
    case 'string':
    default:
      return `"${escapeString(value)}"`;
  }
}

function normalizeHex(value) {
  const text = String(value || '').trim();
  const match = /^#?([0-9a-fA-F]{6})$/u.exec(text);
  return match ? `#${match[1].toLowerCase()}` : '#000000';
}

/** Свойство считается заданным, если оно есть в props и не равно null/undefined/''. */
function hasValue(props, name) {
  return props && props[name] !== undefined && props[name] !== null && props[name] !== '';
}

function childrenOf(model, parentId) {
  return model.widgets.filter((item) => item.parent === parentId);
}

function usesColors(model) {
  const check = (type, props) => Object.keys(props || {}).some((name) => {
    const prop = propertyOf(type, name);
    return prop && prop.kind === 'color' && hasValue(props, name);
  });
  if (check('Window', model.window.props)) return true;
  return model.widgets.some((item) => check(item.type, item.props));
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

/**
 * @param model  { window: { name, props }, widgets: [{ id, type, name, parent, props, tabTitle? }] }
 * @param options { handlers?: boolean, previewTabs?: Record<id, index>, embedModel?: boolean }
 */
function generateCode(model, options = {}) {
  const indent = '    ';
  const lines = ['use gui;'];
  if (usesColors(model)) lines.push('use colors;');
  lines.push('', 'main() {');

  const win = model.window;
  lines.push(`${indent}gui.Window ${win.name};`);
  lines.push(...propertyLines(indent, win.name, 'Window', win.props));

  const handlerLines = [];
  const emitWidget = (item, parentName) => {
    const def = widgetDefinition(item.type);
    lines.push('');
    lines.push(`${indent}gui.${item.type} ${item.name};`);
    const skip = [];
    const props = { ...item.props };
    if (def.container === 'tabs') {
      // Для предпросмотра показываем страницу, которую сейчас правят; в код ученика это не попадает.
      const previewIndex = options.previewTabs && options.previewTabs[item.id];
      if (previewIndex !== undefined && previewIndex !== null) props.selected_index = previewIndex;
    }
    lines.push(...propertyLines(indent, item.name, item.type, props, skip));
    if (def.container === 'tabs' && props.selected_index !== undefined && props.selected_index !== null && !hasValue(item.props, 'selected_index')) {
      // selected_index не в каталоге свойств — пишем сами (только для предпросмотра).
      lines.push(`${indent}${item.name}.selected_index = ${Math.round(Number(props.selected_index))};`);
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
    if (options.handlers) {
      for (const event of def.events) {
        handlerLines.push('', `${indent}${item.name}.${event.name} = void function() {`, `${indent}${indent}// ${event.comment}`, `${indent}};`);
      }
    }
  };

  for (const item of childrenOf(model, null)) emitWidget(item, win.name);

  lines.push(...handlerLines);
  lines.push('', `${indent}${win.name}.show();`, '}');
  let code = `${lines.join('\n')}\n`;
  if (options.embedModel) code += `\n${MODEL_COMMENT_PREFIX} ${JSON.stringify(stripModel(model))}\n`;
  return code;
}

/** Модель без служебных полей — то, что кладём в файл. */
function stripModel(model) {
  return {
    version: MODEL_VERSION,
    window: { name: model.window.name, props: { ...model.window.props } },
    widgets: model.widgets.map((item) => {
      const copy = { id: item.id, type: item.type, name: item.name, parent: item.parent, props: { ...item.props } };
      if (item.tabTitle !== undefined) copy.tabTitle = item.tabTitle;
      return copy;
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

module.exports = {
  MODEL_VERSION,
  MODEL_COMMENT_PREFIX,
  generateCode,
  formatValue,
  normalizeHex,
  stripModel,
  extractEmbeddedModel,
  stripEmbeddedModel,
  childrenOf,
};
