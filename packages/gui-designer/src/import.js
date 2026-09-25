'use strict';

// Открыть любой main.idyl в идиоме конструктора (третий заход, 1.6.3): разбор НАСТОЯЩИМ
// парсером ядра (AST программы), а не строкой макета. Понимает то, что пишет сам генератор:
// use gui / colors / fonts; в main() — gui.Window, виджеты каталога, свойства-константы
// (числа, строки, bool, colors.HEX / RGB / RGBA / именованные цвета, шрифт по имени),
// fonts.Font + load_from_file, add_child / add_tab, данные (add_item, set_columns, add_row,
// add_value, add_slice), заготовки обработчиков (тело теряется), tabs.selected_index —
// страница для предпросмотра, win.show(). Всё остальное — «чужое»: собирается списком строк
// и в макет не попадает, решает пользователь. Нет main() или окна — честный отказ.
// CommonJS: модуль делят страница конструктора и тесты.

const { WIDGETS, TAB_PAGE_TYPE, widgetDefinition, propertyOf, eventsOf, nameProblem, freeName } = require('./widgets');
const { MODEL_VERSION, normalizeHex } = require('./codegen');
const { flattenTree } = require('./model-ops');

const KNOWN_MODULES = new Set(['gui', 'colors', 'fonts']);

class ImportRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportRefusal';
  }
}

function hex2(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

/** Таблица именованных цветов: массив [name, r, g, b, alpha?] (COLOR_CONSTANTS ядра) → name → #hex. */
function buildColorTable(constants) {
  const table = new Map();
  for (const entry of Array.isArray(constants) ? constants : []) {
    const [name, red, green, blue, alpha] = entry;
    if (typeof name !== 'string') continue;
    table.set(name, `#${hex2(red)}${hex2(green)}${hex2(blue)}${alpha === undefined ? '' : hex2(alpha * 255)}`);
  }
  return table;
}

function isIdentifier(node, name) {
  return Boolean(node) && node.kind === 'IdentifierExpression' && (name === undefined || node.name === name);
}

function memberOf(node) {
  if (!node || node.kind !== 'MemberExpression' || !isIdentifier(node.object)) return null;
  return { object: node.object.name, name: node.name };
}

function numberOf(node) {
  if (!node) return null;
  if (node.kind === 'LiteralExpression' && typeof node.value === 'number') return node.value;
  if (node.kind === 'UnaryExpression' && node.operator === '-') {
    const inner = numberOf(node.operand);
    return inner === null ? null : -inner;
  }
  return null;
}

function stringOf(node) {
  return node && node.kind === 'LiteralExpression' && typeof node.value === 'string' ? node.value : null;
}

function isInteger(node) {
  return numberOf(node) !== null && Number.isInteger(numberOf(node)) && !(node.kind === 'LiteralExpression' && node.valueType === 'float');
}

/**
 * @param program  AST программы (compileIdyllium(...).ast)
 * @param options  { source?: string, colorConstants?: COLOR_CONSTANTS ядра }
 * @returns { model, previewTabs, foreign: [{ line, text, why }], notes: string[] }
 */
function importProgram(program, options = {}) {
  if (!program || program.kind !== 'Program') throw new ImportRefusal('это не программа Idyllium');
  if (!program.main) throw new ImportRefusal('в файле нет main() — конструктор открывает программу с окном');
  const sourceLines = String(options.source || '').split('\n');
  const colors = buildColorTable(options.colorConstants);
  const foreign = [];
  const notes = [];
  const lineText = (range) => (sourceLines[range.start.line - 1] || '').trim();
  const reject = (node, why) => {
    const line = node.range.start.line;
    if (!foreign.some((item) => item.line === line)) foreign.push({ line, text: lineText(node.range), why });
  };

  for (const declaration of program.imports) {
    if (!KNOWN_MODULES.has(declaration.moduleName)) reject(declaration, `библиотека ${declaration.moduleName} конструктору не нужна`);
  }
  for (const declaration of program.declarations) reject(declaration, 'объявления вне main() конструктор не хранит');

  let windowName = null;
  const windowModel = { name: 'win', props: {}, handlers: [] };
  const widgets = new Map(); // имя → виджет модели (+ служебное added)
  const fonts = new Map();   // имя → { name, file }
  const previewTabs = {};
  const childOrder = new Map(); // родитель (id | null) → [виджеты] в порядке add_child / add_tab
  let nextId = 1;

  const ownerOf = (name) => {
    if (name === windowName) return { kind: 'window', type: 'Window', target: windowModel };
    if (widgets.has(name)) return { kind: 'widget', type: widgets.get(name).type, target: widgets.get(name) };
    if (fonts.has(name)) return { kind: 'font', target: fonts.get(name) };
    return null;
  };

  const colorOf = (node) => {
    const member = memberOf(node);
    if (member && member.object === 'colors' && colors.has(member.name)) return colors.get(member.name);
    if (node && node.kind === 'CallExpression') {
      const callee = memberOf(node.callee);
      const args = node.args.map((argument) => argument.value);
      if (callee && callee.object === 'colors') {
        if (callee.name === 'HEX' && args.length === 1 && stringOf(args[0]) !== null && /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/u.test(stringOf(args[0]))) return normalizeHex(stringOf(args[0]));
        if (callee.name === 'RGB' && args.length === 3 && args.every((arg) => numberOf(arg) !== null)) return `#${args.map((arg) => hex2(numberOf(arg))).join('')}`;
        if (callee.name === 'RGBA' && args.length === 4 && args.every((arg) => numberOf(arg) !== null)) {
          const alpha = numberOf(args[3]);
          return `#${args.slice(0, 3).map((arg) => hex2(numberOf(arg))).join('')}${hex2(Math.max(0, Math.min(1, alpha)) * 255)}`;
        }
      }
    }
    return null;
  };

  /** Значение свойства по каталогу; null — не константа из идиомы. */
  const valueOf = (prop, node) => {
    switch (prop.kind) {
      case 'string': return stringOf(node);
      case 'enum': { const text = stringOf(node); return text !== null && prop.values.includes(text) ? text : null; }
      case 'int': return isInteger(node) ? numberOf(node) : null;
      case 'float': return numberOf(node);
      case 'bool': return node && node.kind === 'LiteralExpression' && typeof node.value === 'boolean' ? node.value : null;
      case 'color': return colorOf(node);
      case 'font': return isIdentifier(node) && fonts.has(node.name) ? node.name : null;
      default: return null;
    }
  };

  const addTo = (parentId, item) => {
    if (!childOrder.has(parentId)) childOrder.set(parentId, []);
    childOrder.get(parentId).push(item);
    item.parent = parentId;
    item.__added = true;
  };

  const handleDeclaration = (statement) => {
    const type = statement.declaredType;
    if (!type || type.kind !== 'QualifiedTypeName' || statement.initializer || statement.constructorArgs) { reject(statement, 'переменная не из идиомы конструктора'); return; }
    if (type.moduleName === 'gui' && type.name === 'Window') {
      if (windowName !== null) { reject(statement, 'второе окно — конструктор собирает одно'); return; }
      windowName = statement.name;
      if (!nameProblem(statement.name, [])) windowModel.name = statement.name;
      return;
    }
    if (type.moduleName === 'gui' && WIDGETS[type.name]) {
      widgets.set(statement.name, { id: nextId++, type: type.name, name: statement.name, parent: null, props: {}, handlers: [], __added: false });
      return;
    }
    if (type.moduleName === 'fonts' && type.name === 'Font') {
      fonts.set(statement.name, { name: statement.name, file: null, node: statement });
      return;
    }
    reject(statement, `тип ${type.moduleName}.${type.name} конструктор не знает`);
  };

  const handleAssignment = (statement) => {
    const target = memberOf(statement.target);
    if (!target || statement.operator !== '=') { reject(statement, 'присваивание не из идиомы конструктора'); return; }
    const owner = ownerOf(target.object);
    if (!owner) { reject(statement, `переменная ${target.object} конструктору неизвестна`); return; }
    if (owner.kind === 'font') { reject(statement, 'у шрифта конструктор свойств не редактирует'); return; }
    const event = eventsOf(owner.type).find((known) => known.name === target.name);
    if (event) {
      if (!statement.value || statement.value.kind !== 'FunctionExpression') { reject(statement, 'обработчик не функцией-заготовкой'); return; }
      if (!owner.target.handlers.includes(event.name)) owner.target.handlers.push(event.name);
      for (const inner of statement.value.body.statements) reject(inner, `тело обработчика ${target.object}.${target.name}: код конструктор не хранит, только заготовку`);
      return;
    }
    if (owner.kind === 'widget' && owner.type === 'TabWidget' && target.name === 'selected_index') {
      const index = numberOf(statement.value);
      if (index !== null && Number.isInteger(index) && index >= 0) { previewTabs[owner.target.id] = index; return; }
      reject(statement, 'selected_index не числом');
      return;
    }
    const prop = propertyOf(owner.type, target.name);
    if (!prop) { reject(statement, `свойство ${target.name} конструктор не редактирует`); return; }
    const value = valueOf(prop, statement.value);
    if (value === null) { reject(statement, `${target.object}.${target.name}: значение не константа (${prop.kind})`); return; }
    owner.target.props[prop.name] = value;
  };

  const handleCall = (statement) => {
    const call = statement.expression;
    const callee = call && call.kind === 'CallExpression' ? memberOf(call.callee) : null;
    if (!callee) { reject(statement, 'вызов не из идиомы конструктора'); return; }
    const args = call.args.map((argument) => argument.value);
    const owner = ownerOf(callee.object);
    if (!owner) { reject(statement, `переменная ${callee.object} конструктору неизвестна`); return; }
    if (owner.kind === 'font') {
      if (callee.name === 'load_from_file' && args.length === 1 && stringOf(args[0]) !== null) { owner.target.file = stringOf(args[0]); return; }
      reject(statement, 'у шрифта конструктор знает только load_from_file("файл")');
      return;
    }
    if (owner.kind === 'window') {
      if (callee.name === 'show' && args.length === 0) return;
      if (callee.name === 'add_child' && args.length === 1 && isIdentifier(args[0]) && widgets.has(args[0].name)) { addTo(null, widgets.get(args[0].name)); return; }
      reject(statement, `${callee.object}.${callee.name}: у окна конструктор знает add_child и show`);
      return;
    }
    const item = owner.target;
    const def = widgetDefinition(item.type);
    if (callee.name === 'add_child' && def.container === 'children' && args.length === 1 && isIdentifier(args[0]) && widgets.has(args[0].name)) {
      addTo(item.id, widgets.get(args[0].name));
      return;
    }
    if (callee.name === 'add_tab' && def.container === 'tabs' && args.length === 2 && stringOf(args[0]) !== null && isIdentifier(args[1]) && widgets.has(args[1].name)) {
      const page = widgets.get(args[1].name);
      if (page.type !== TAB_PAGE_TYPE) { reject(statement, `страница вкладок ${page.name} — не рамка (Frame)`); return; }
      page.tabTitle = stringOf(args[0]);
      addTo(item.id, page);
      return;
    }
    if (def.data) {
      const shape = def.data.shape;
      const strings = args.map(stringOf);
      const numbers = args.map(numberOf);
      if (!item.data) item.data = shape === 'strings' ? { items: [] } : shape === 'table' ? { columns: [], rows: [] } : shape === 'entries' ? { entries: [] } : { points: [] };
      if (shape === 'strings' && callee.name === def.data.method && args.length === 1 && strings[0] !== null) { item.data.items.push(strings[0]); return; }
      if (shape === 'table' && callee.name === 'set_columns' && args.length > 0 && strings.every((text) => text !== null)) { item.data.columns = strings; return; }
      if (shape === 'table' && callee.name === 'add_row' && args.length > 0 && strings.every((text) => text !== null)) { item.data.rows.push(strings); return; }
      if (shape === 'entries' && callee.name === def.data.method && args.length === 2 && strings[0] !== null && numbers[1] !== null) { item.data.entries.push({ label: strings[0], value: numbers[1] }); return; }
      if (shape === 'numbers' && callee.name === def.data.method && args.length === 1 && numbers[0] !== null) { item.data.points.push(numbers[0]); return; }
    }
    reject(statement, `${callee.object}.${callee.name}: метод не из идиомы конструктора`);
  };

  for (const statement of program.main.body.statements) {
    if (statement.kind === 'VariableDeclaration') handleDeclaration(statement);
    else if (statement.kind === 'AssignmentStatement') handleAssignment(statement);
    else if (statement.kind === 'ExpressionStatement') handleCall(statement);
    else reject(statement, 'конструкция не из идиомы конструктора');
  }

  if (windowName === null) throw new ImportRefusal('в main() нет gui.Window — конструктор собирает окно');

  // Шрифты без файла — пропускаем, свойства на них снимаем.
  const readyFonts = [];
  for (const font of fonts.values()) {
    if (font.file === null) {
      notes.push(`шрифт ${font.name} объявлен без load_from_file — пропущен`);
      reject(font.node, 'шрифт без файла');
      continue;
    }
    readyFonts.push({ name: font.name, file: font.file });
  }
  const readyNames = new Set(readyFonts.map((font) => font.name));
  const dropFont = (props) => { if (props.font !== undefined && !readyNames.has(props.font)) delete props.font; };
  dropFont(windowModel.props);

  // Не добавленные в окно виджеты — ставим в окно и говорим об этом.
  for (const item of widgets.values()) {
    dropFont(item.props);
    if (!item.__added) {
      notes.push(`${item.name} (gui.${item.type}) не добавлен в окно через add_child — поставлен в окно`);
      addTo(null, item);
    }
  }

  // Имена: как в файле, если каталог их принимает.
  const model = { version: MODEL_VERSION, window: windowModel, widgets: [...widgets.values()] };
  if (readyFonts.length > 0) model.fonts = readyFonts;
  const taken = [windowModel.name];
  for (const item of model.widgets) {
    if (nameProblem(item.name, taken)) {
      const fresh = freeName(widgetDefinition(item.type).defaultName, taken);
      notes.push(`имя ${item.name} в конструкторе занято — переименован в ${fresh}`);
      item.name = fresh;
    }
    taken.push(item.name);
  }
  // Порядок братьев — порядок add_child / add_tab (он же порядок слоёв), родитель раньше детей.
  model.widgets = flattenTree(model, childOrder);
  for (const item of model.widgets) delete item.__added;
  foreign.sort((a, b) => a.line - b.line);
  return { model, previewTabs, foreign, notes };
}

module.exports = { importProgram, ImportRefusal, buildColorTable };
