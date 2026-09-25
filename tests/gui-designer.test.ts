// Страж «Конструктора GUI» (1.6.3): каталог виджетов не расходится с реестром языка
// (свойства, типы, ВСЕ события), генератор кода выдаёт программу, которая компилируется
// и выполняется — с любыми заготовками обработчиков, имена проверяются словами языка,
// сверка файла с макетом называет ручные правки, собранная страница несёт общую шапку.
import { compileIdyllium, createMemoryRuntimeFileSystem, runIdyllium } from '../src';
import { defaultGuiWidgetSize } from '../src/runtime/runtime-gui';
import { assert, test, runTests } from './smoke-harness';

const fs: any = require('fs');
const path: any = require('path');
// Тесты выполняются из dist/tests — модули конструктора берём от корня репозитория.
const widgets: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'widgets.js'));
const codegen: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'codegen.js'));

// Умолчания каталога, которые инспектор показывает подсказкой-плейсхолдером, обязаны
// совпадать с рантаймом: «по умолчанию 13» должно быть правдой (пункт владельца 2026-09-26
// про пустой font_size у gui.Window).
test('gui-designer: window defaults in the catalogue match the runtime', async () => {
  const defaults = widgets.WINDOW_PROPS.filter((prop: any) => prop.default !== undefined && prop.kind !== 'enum');
  assert(defaults.some((prop: any) => prop.name === 'font_size'), 'font_size must carry its default in WINDOW_PROPS');
  const lines = defaults.map((prop: any) => `    console.writeln("${prop.name}");\n    console.writeln(win.${prop.name});`).join('\n');
  const result = await runIdyllium(`use gui;\nuse console;\nmain() {\n    gui.Window win;\n${lines}\n    win.show();\n}\n`, {}, { file: 'main.idyl' });
  assert(result.success && result.runtimeError === null, `probe must run: ${result.runtimeError ?? result.compilation.diagnosticsText}`);
  const output = result.output.split('\n');
  for (const prop of defaults) {
    const at = output.indexOf(prop.name);
    assert(at !== -1 && output[at + 1] === String(prop.default), `runtime default of Window.${prop.name} must be ${prop.default}, got: ${result.output}`);
  }
});

// Рантайм велит «set min and max first»: у счётчиков, ползунка и индикатора границы
// пишутся раньше значения, иначе `value = 20; min = 15;` падал бы словами на сцене.
test('gui-designer: range widgets write min and max before value', async () => {
  const model: any = { version: codegen.MODEL_VERSION, window: { name: 'win', props: {} }, widgets: [
    { id: 1, type: 'SpinBox', name: 'spin1', parent: null, props: { x: 10, y: 10, min: 15, max: 30, value: 20 } },
    { id: 2, type: 'Slider', name: 'slider1', parent: null, props: { x: 10, y: 50, value: 500, max: 1000 } },
  ] };
  const code = codegen.generateCode(model);
  assert(code.indexOf('spin1.min = 15;') < code.indexOf('spin1.value = 20;') && code.indexOf('spin1.max = 30;') < code.indexOf('spin1.value = 20;'), `min/max before value:\n${code}`);
  const result = await runIdyllium(code, {}, { file: 'main.idyl' });
  assert(result.success && result.runtimeError === null, `range program must run: ${result.runtimeError ?? result.compilation.diagnosticsText}\n${code}`);
});

const modelOps: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'model-ops.js'));
const importer: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'import.js'));
import { COLOR_CONSTANTS } from '../src';

// Третий заход: открыть ЛЮБОЙ main.idyl в идиоме конструктора — парсер ядра → модель. Раунд-трип:
// код кухонной мойки, разобранный заново, порождает тот же код (данные, вкладки, заготовки, шрифт).
test('gui-designer: a generated program parsed back gives the same program', () => {
  const model = kitchenSinkModel();
  const preview = codegen.generateCode(model, { previewTabs: { [model.widgets.find((w: any) => w.type === 'TabWidget').id]: 1 } });
  const compiled = compileIdyllium(preview, { file: 'main.idyl' });
  assert(Boolean(compiled.success && compiled.ast), `kitchen sink must compile: ${compiled.diagnosticsText}`);
  const imported = importer.importProgram(compiled.ast, { source: preview, colorConstants: COLOR_CONSTANTS });
  assert(imported.foreign.length === 0, `nothing in the designer's own output is foreign: ${JSON.stringify(imported.foreign)}`);
  assert(imported.notes.length === 0, `no notes on a clean round trip: ${imported.notes.join('; ')}`);
  const again = codegen.generateCode(imported.model, {});
  const expected = codegen.generateCode(model, {});
  assert(again === expected, `round trip must reproduce the program\n--- expected ---\n${expected}\n--- got ---\n${again}`);
  const tabs = imported.model.widgets.find((w: any) => w.type === 'TabWidget');
  assert(imported.previewTabs[tabs.id] === 1, 'selected_index of the tab widget becomes the preview page, not a property');
  assert(imported.model.fonts && imported.model.fonts[0].file === 'Lobster-Regular.ttf', 'fonts.Font + load_from_file come back as a model font');
});

test('gui-designer: foreign constructs are listed by line, the rest is imported', () => {
  const source = `use gui;
use colors;
use console;

main() {
    gui.Window win;
    win.title = "Проба";
    win.background_color = colors.TEAL;

    gui.Button button1;
    button1.text = "Жми";
    button1.text_color = colors.RGB(255, 0, 0);
    button1.width = 100 + 20;
    win.add_child(button1);

    gui.Label label1;
    label1.text = "Забытая";

    button1.on_click = void function() {
        console.writeln("щёлк");
    };
    for (int i = 0; i < 3; i = i + 1) {
        console.writeln(i);
    }
    win.show();
}
`;
  const compiled = compileIdyllium(source, { file: 'main.idyl' });
  assert(Boolean(compiled.success && compiled.ast), `probe must compile: ${compiled.diagnosticsText}`);
  const imported = importer.importProgram(compiled.ast, { source, colorConstants: COLOR_CONSTANTS });
  const lines = imported.foreign.map((entry: any) => entry.line);
  assert(JSON.stringify(lines) === JSON.stringify([3, 13, 20, 22]), `foreign lines are use console, the sum, the handler body and the loop: ${JSON.stringify(imported.foreign)}`);
  assert(imported.foreign[1].text === 'button1.width = 100 + 20;', 'the foreign line carries its source text');
  const code = codegen.generateCode(imported.model, {});
  assert(code.includes('win.background_color = colors.HEX("#008080");'), `colour constants become HEX: ${code}`);
  assert(code.includes('button1.text_color = colors.HEX("#ff0000");'), `colors.RGB becomes HEX: ${code}`);
  assert(!code.includes('button1.width'), 'a computed value is not a property of the model');
  assert(code.includes('button1.on_click = void function() {'), 'the handler survives as an empty stub');
  assert(code.includes('win.add_child(label1);'), 'a widget never added is placed into the window');
  assert(imported.notes.some((note: string) => note.includes('label1')), `and the note says so: ${imported.notes.join('; ')}`);
});

test('gui-designer: import refuses programs without main() or without a window, in words', () => {
  const refusal = (source: string) => {
    const compiled = compileIdyllium(source, { file: 'main.idyl' });
    assert(Boolean(compiled.success && compiled.ast), `probe must compile: ${compiled.diagnosticsText}`);
    try { importer.importProgram(compiled.ast, { source }); } catch (error: any) { return error.name === 'ImportRefusal' ? error.message : `wrong error: ${error.message}`; }
    return null;
  };
  assert(String(refusal('use console;\nmain() {\n    console.writeln("нет окна");\n}\n')).includes('нет gui.Window'), 'no window → refusal names the window');
  assert(refusal('use gui;\nmain() {\n    gui.Window win;\n    win.show();\n}\n') === null, 'a bare window is a valid layout');
});

test('gui-designer: tree moves keep the rules of the scene', () => {
  const model: any = { version: 1, window: { name: 'win', props: {}, handlers: [] }, widgets: [
    { id: 1, type: 'Frame', name: 'frame1', parent: null, props: { x: 10, y: 10 }, handlers: [] },
    { id: 2, type: 'Button', name: 'button1', parent: null, props: { x: 200, y: 10 }, handlers: [] },
    { id: 3, type: 'Label', name: 'label1', parent: 1, props: { x: 5, y: 5 }, handlers: [] },
    { id: 4, type: 'TabWidget', name: 'tabs1', parent: null, props: { x: 10, y: 200 }, handlers: [] },
    { id: 5, type: 'Frame', name: 'page1', parent: 4, props: { x: 8, y: 8 }, handlers: [], tabTitle: 'Первая' },
  ] };
  const order = () => model.widgets.map((w: any) => `${w.name}@${w.parent === null ? 'win' : w.parent}`).join(' ');
  assert(modelOps.moveSubtree(model, 2, { parent: null, before: 1 }).ok, 'move before a sibling');
  assert(order().startsWith('button1@win frame1@win label1@1'), `button goes first, frame keeps its child: ${order()}`);
  assert(modelOps.moveSubtree(model, 2, { parent: 1, before: 3 }).ok, 'move into the frame before its child');
  assert(order() === 'frame1@win button1@1 label1@1 tabs1@win page1@4', `into the frame, before label: ${order()}`);
  const cycle = modelOps.moveSubtree(model, 1, { parent: 1, before: null });
  assert(!cycle.ok && cycle.reason.includes('внутрь самого себя'), `no cycles: ${JSON.stringify(cycle)}`);
  const notContainer = modelOps.moveSubtree(model, 3, { parent: 2, before: null });
  assert(!notContainer.ok && notContainer.reason.includes('не контейнер'), `a button is not a container: ${JSON.stringify(notContainer)}`);
  const lastPage = modelOps.moveSubtree(model, 5, { parent: null, before: null });
  assert(!lastPage.ok && lastPage.reason.includes('хотя бы одна страница'), `the last page stays: ${JSON.stringify(lastPage)}`);
  const intoTabs = modelOps.moveSubtree(model, 1, { parent: 4, before: null });
  assert(intoTabs.ok && model.widgets.find((w: any) => w.id === 1).tabTitle === 'Вкладка 2', `a frame dropped into tabs becomes a page: ${JSON.stringify(intoTabs)} ${order()}`);
  const nonFrame = modelOps.moveSubtree(model, 2, { parent: 4, before: null });
  assert(!nonFrame.ok && nonFrame.reason.includes('только рамка'), `only frames become pages: ${JSON.stringify(nonFrame)}`);
  assert(modelOps.moveSubtree(model, 5, { parent: null, before: null }).ok && model.widgets.find((w: any) => w.id === 5).tabTitle === undefined, 'a page dragged out of the tabs is a plain frame again');
  const generated = codegen.generateCode(model, {});
  assert(compileIdyllium(generated, { file: 'main.idyl' }).success, `the moved layout still compiles:\n${generated}`);
});

test('gui-designer: alignment and distribution move against the first selected box', () => {
  const boxes = [
    { id: 1, left: 100, top: 50, width: 80, height: 30 },
    { id: 2, left: 140, top: 120, width: 40, height: 20 },
    { id: 3, left: 300, top: 200, width: 60, height: 60 },
  ];
  const by = (moves: any[], id: number) => moves.find((m) => m.id === id);
  const left = modelOps.alignBoxes(boxes, 'left');
  assert(by(left, 2).dx === -40 && by(left, 3).dx === -200 && !by(left, 1), `left aligns to the anchor: ${JSON.stringify(left)}`);
  const right = modelOps.alignBoxes(boxes, 'right');
  assert(!by(right, 2) || by(right, 2).dx === 0, `box 2 already ends at the anchor's right edge: ${JSON.stringify(right)}`);
  assert(by(right, 3).dx === -180, `box 3 moves so its right edge is 180: ${JSON.stringify(right)}`);
  const middle = modelOps.alignBoxes(boxes, 'middle');
  assert(by(middle, 2).dy === -65 && by(middle, 3).dy === -165, `middle: centres meet at 65: ${JSON.stringify(middle)}`);
  const same = modelOps.alignBoxes(boxes, 'same-width');
  assert(by(same, 2).width === 80 && by(same, 3).width === 80, `same width as the anchor: ${JSON.stringify(same)}`);
  const spread = modelOps.alignBoxes(boxes, 'distribute-h');
  // Крайние стоят: 100–180 и 300–360; между ними 120 свободного места на два промежутка.
  assert(spread.length === 1 && by(spread, 2).dx === 80, `the middle box gets equal gaps: ${JSON.stringify(spread)}`);
  assert(modelOps.alignBoxes(boxes.slice(0, 2), 'distribute-v').length === 0, 'distribution needs three boxes');
  assert(modelOps.selectionRoots({ widgets: [{ id: 1, parent: null }, { id: 2, parent: 1 }, { id: 3, parent: null }] }, [1, 2, 3]).join(',') === '1,3', 'roots drop children of selected parents');
});

test('gui-designer: a font from a project file becomes fonts.Font and runs', async () => {
  const model: any = { version: 1, window: { name: 'win', props: { font: 'font1' }, handlers: [] }, fonts: [{ name: 'font1', file: 'Lobster-Regular.ttf' }], widgets: [
    { id: 1, type: 'Label', name: 'label1', parent: null, props: { text: 'Привет', font: 'font1', font_size: 24 }, handlers: [] },
  ] };
  const code = codegen.generateCode(model, {});
  assert(code.includes('use fonts;') && code.includes('fonts.Font font1;') && code.includes('font1.load_from_file("Lobster-Regular.ttf");') && code.includes('label1.font = font1;'), `font idiom as in the lesson:\n${code}`);
  assert(code.indexOf('font1.load_from_file') < code.indexOf('gui.Window win;'), 'fonts are declared before the window');
  await assertRuns('font', code);
  const stripped = codegen.withoutMissingFonts(model, () => false);
  assert(stripped.missing.length === 1 && !codegen.generateCode(stripped.model, {}).includes('fonts'), 'without the file the preview code has no fonts at all');
  assert(JSON.stringify(codegen.stripModel(model).fonts) === JSON.stringify(model.fonts), 'the saved layout keeps font names and files');
});

function sampleValue(prop: any, index: number): unknown {
  switch (prop.kind) {
    case 'int': return Math.max(prop.min ?? 0, 10 + index);
    case 'float': return 1.5 + index;
    case 'bool': return true;
    case 'color': return '#2291bc';
    case 'font': return 'font1';
    case 'enum': return prop.values[prop.values.length - 1];
    default:
      // Стили — настоящие пары IdySS: рантайм их проверяет при запуске.
      if (prop.group === 'style') return 'background-color: teal; color: white; border-radius: 6px;';
      return `Текст "в кавычках" №${index}\nвторая строка`;
  }
}

/** Макет со всеми виджетами и всеми свойствами: Frame с ребёнком, вкладки с двумя страницами. */
function kitchenSinkModel(): any {
  const model: any = { version: codegen.MODEL_VERSION, window: { name: 'win', props: {}, handlers: ['on_close'] }, widgets: [] };
  widgets.WINDOW_PROPS.forEach((prop: any, index: number) => { model.window.props[prop.name] = sampleValue(prop, index); });
  model.window.props.width = 900;
  model.window.props.height = 700;
  // Шрифт из файла проекта: переменная fonts.Font, файл — фикстура тестов.
  model.fonts = [{ name: 'font1', file: 'Lobster-Regular.ttf' }];
  let id = 1;
  const add = (type: string, parent: number | null, extra: Record<string, unknown> = {}) => {
    const def = widgets.widgetDefinition(type);
    const props: Record<string, unknown> = {};
    def.props.forEach((prop: any, index: number) => { props[prop.name] = sampleValue(prop, index); });
    props.visible = true;
    // Диапазон должен быть согласован: значение внутри [min, max] (иначе рантайм честно откажет).
    if (def.props.some((prop: any) => prop.name === 'min')) { props.min = 10; props.max = 90; props.value = 50; }
    props.enabled = true;
    const item: any = { id: id++, type, name: widgets.freeName(def.defaultName, model.widgets.map((w: any) => w.name)), parent, props, handlers: def.events.map((event: any) => event.name), ...extra };
    // Данные — пункты, колонки и строки, значения, точки: то, что задаётся методами.
    if (def.data) {
      const sample: Record<string, any> = {
        strings: { items: ['Красный', 'Зелёный', 'Синий "в кавычках"'] },
        table: { columns: ['Имя', 'Класс'], rows: [['Мира', 'маг'], ['Кай'], ['Ника', 'жрица', 'лишнее']] },
        entries: { entries: [{ label: 'Мира', value: 340 }, { label: 'Кай', value: 12.5 }] },
        numbers: { points: [1, 2.5, 3] },
      };
      item.data = sample[def.data.shape];
    }
    model.widgets.push(item);
    return item;
  };
  for (const def of widgets.WIDGET_TYPES) {
    const item = add(def.type, null);
    if (def.container === 'children') add('Button', item.id);
    if (def.container === 'tabs') {
      const page1 = add('Frame', item.id, { tabTitle: 'Первая' });
      add('Label', page1.id);
      const page2 = add('Frame', item.id, { tabTitle: 'Вторая' });
      add('CheckBox', page2.id);
    }
  }
  return model;
}

const FONT_FIXTURE = new Uint8Array(fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'fonts', 'Lobster-Regular.ttf')));

async function assertRuns(label: string, code: string): Promise<void> {
  const compiled = compileIdyllium(code, { file: '/workspace/main.idyl' });
  assert(compiled.success, `${label}: generated code must compile, got:\n${compiled.diagnosticsText}\n--- code ---\n${code}`);
  const fileSystem = createMemoryRuntimeFileSystem({ '/workspace/main.idyl': code, '/workspace/Lobster-Regular.ttf': { bytes: FONT_FIXTURE } }, '/workspace');
  const result = await runIdyllium(code, { fileSystem }, { file: '/workspace/main.idyl' });
  assert(result.success && result.runtimeError === null, `${label}: generated program must run, got: ${result.runtimeError}\n--- code ---\n${code}`);
}

test('gui designer: the widget catalogue matches the language registry, events included', () => {
  const api = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'docs', 'reference', 'api.json'), 'utf8'));
  const gui = api.modules.find((module: any) => module.name === 'gui');
  assert(gui, 'gui module is missing from docs/reference/api.json');
  const typesByName = new Map<string, any>(gui.types.map((type: any) => [type.name, type]));
  const expectedKinds: Record<string, string[]> = { int: ['int'], float: ['float'], bool: ['bool'], string: ['string'], enum: ['string'], color: ['colors.Color'], font: ['fonts.Font'] };
  const check = (typeName: string, props: any[], events: any[]) => {
    const type = typesByName.get(typeName);
    assert(type, `gui.${typeName} is not a registry type`);
    const registryProps = new Map<string, any>(type.properties.map((prop: any) => [prop.name, prop]));
    for (const prop of props) {
      const registryProp = registryProps.get(prop.name);
      assert(registryProp, `gui.${typeName}.${prop.name} is in the designer catalogue but not in the registry`);
      assert(expectedKinds[prop.kind].includes(registryProp.type), `gui.${typeName}.${prop.name}: designer kind '${prop.kind}' vs registry type '${registryProp.type}'`);
      assert(!registryProp.readonly, `gui.${typeName}.${prop.name} is read-only in the registry — the designer must not offer it`);
    }
    // Каждое событие реестра — галочка в инспекторе, и ничего сверх реестра.
    const registryEvents = type.properties.map((prop: any) => prop.name).filter((name: string) => name.startsWith('on_')).sort();
    const catalogueEvents = events.map((event: any) => event.name).sort();
    assert(JSON.stringify(registryEvents) === JSON.stringify(catalogueEvents), `gui.${typeName}: registry events ${registryEvents.join(', ')} vs designer ${catalogueEvents.join(', ')}`);
  };
  check('Window', widgets.WINDOW_PROPS, widgets.WINDOW_EVENTS);
  for (const def of widgets.WIDGET_TYPES) {
    check(def.type, def.props, def.events);
    const size = defaultGuiWidgetSize(def.type);
    assert(size.width === def.size.width && size.height === def.size.height, `gui.${def.type}: palette size ${def.size.width}×${def.size.height} differs from the runtime default ${size.width}×${size.height}`);
    for (const prop of def.props) assert(widgets.PROPERTY_GROUPS.some(([group]: [string, string]) => group === prop.group), `gui.${def.type}.${prop.name}: unknown inspector group '${prop.group}'`);
  }
});

test('gui designer: generated programs compile and run for every widget and every handler stub', async () => {
  const model = kitchenSinkModel();
  const plain = codegen.generateCode(model, {});
  await assertRuns('plain', plain);
  // У ComboBox selected_index — обычное свойство; у вкладок его пишет только предпросмотр.
  assert(!plain.includes('tabs1.selected_index'), 'the exported code must not carry the designer\'s preview tab selection');
  // Страницы — Frame с tabTitle; имена им даёт модель, add_tab пишется как в уроке «Вкладки».
  const tabs = model.widgets.find((item: any) => item.type === 'TabWidget');
  const pages = model.widgets.filter((item: any) => item.parent === tabs.id);
  assert(pages.length === 2, 'the kitchen sink has two tab pages');
  for (const page of pages) {
    assert(plain.includes(`${tabs.name}.add_tab("${page.tabTitle}", ${page.name});`), `tabs are added as in the textbook lesson, got: ${plain.split('\n').filter((line: string) => line.includes('add_tab')).join(' | ')}`);
  }
  assert(plain.includes('frame1.add_child(button2);'), 'a Frame child is added to the frame, not to the window');
  assert(plain.includes('combo_box1.add_item("Красный");') && plain.includes('combo_box1.add_item("Синий \\"в кавычках\\"");'), 'ComboBox items become add_item calls');
  assert(plain.includes('table1.set_columns("Имя", "Класс");') && plain.includes('table1.add_row("Кай", "");') && plain.includes('table1.add_row("Ника", "жрица");'), 'table rows are padded or cut to the column count');
  assert(plain.includes('bar_chart1.add_value("Кай", 12.5);') && plain.includes('pie_chart1.add_slice("Мира", 340.0);') && plain.includes('line_chart1.add_value(2.5);'), 'chart data becomes add_value / add_slice calls');
  const recoveredData = codegen.extractEmbeddedModel(codegen.generateCode(model, { embedModel: true })).widgets.find((w: any) => w.type === 'Table').data;
  assert(recoveredData && recoveredData.columns.length === 2, 'widget data survives the round trip');
  assert(plain.startsWith('use gui;\nuse colors;\nuse fonts;\n\nmain() {\n'), 'the program opens with use gui / use colors / use fonts and main()');
  assert(plain.trimEnd().endsWith('win.show();\n}'), 'the program ends with win.show()');
  // Галочки заготовок стоят у всех — каждая заготовка реестра в коде, включая параметры событий холста и окно.
  assert(plain.includes('button1.on_click = void function() {'), 'handler stubs use the textbook form');
  assert(plain.includes('canvas1.on_mouse_pressed = void function(gui.Canvas canvas, gui.MouseEvent evt) {'), 'canvas stubs carry the canvas and the event, as in the canvas lessons');
  assert(plain.includes('canvas1.on_update = void function(gui.Canvas canvas, float delta_time) {'), 'on_update carries the frame time');
  assert(plain.includes('win.on_close = void function() {'), 'the window can have a handler stub too');

  const noHandlers = codegen.generateCode({ ...model, window: { ...model.window, handlers: [] }, widgets: model.widgets.map((w: any) => ({ ...w, handlers: [] })) }, {});
  await assertRuns('no handlers', noHandlers);
  assert(!noHandlers.includes('void function'), 'without ticks there are no stubs');

  const preview = codegen.generateCode(model, { previewTabs: { [model.widgets.find((w: any) => w.type === 'TabWidget').id]: 1 } });
  await assertRuns('preview', preview);
  assert(preview.includes('tabs1.selected_index = 1;'), 'the preview shows the page being edited');

  const embedded = codegen.generateCode(model, { embedModel: true });
  await assertRuns('embedded', embedded);
  const recovered = codegen.extractEmbeddedModel(embedded);
  assert(recovered && recovered.widgets.length === model.widgets.length, 'the embedded model comes back from the file');
  assert(recovered.widgets.find((w: any) => w.name === 'button1').handlers.includes('on_click'), 'handler ticks survive the round trip');
  assert(codegen.stripEmbeddedModel(embedded) === plain, 'the code above the model line is the plain program');

  // Каждый виджет по одному, со всеми своими заготовками — чтобы отказ называл конкретный тип.
  for (const def of widgets.WIDGET_TYPES) {
    const single: any = { version: 1, window: { name: 'win', props: { title: 'Окно', width: 640, height: 420 }, handlers: [] }, fonts: [{ name: 'font1', file: 'Lobster-Regular.ttf' }], widgets: [] };
    const props: Record<string, unknown> = {};
    def.props.forEach((prop: any, index: number) => { props[prop.name] = sampleValue(prop, index); });
    if (def.props.some((prop: any) => prop.name === 'min')) { props.min = 10; props.max = 90; props.value = 50; }
    single.widgets.push({ id: 1, type: def.type, name: `${def.defaultName}1`, parent: null, props, handlers: def.events.map((event: any) => event.name) });
    if (def.container === 'tabs') {
      single.widgets.push({ id: 2, type: 'Frame', name: 'page1', parent: 1, props: { x: 8, y: 8 }, tabTitle: 'Вкладка 1' });
    }
    await assertRuns(def.type, codegen.generateCode(single, {}));
  }

  // Пустой макет — тоже программа.
  await assertRuns('empty', codegen.generateCode({ version: 1, window: { name: 'win', props: { title: 'Окно', width: 640, height: 420 } }, widgets: [] }, {}));
});

test('gui designer: names, values and the file-vs-model difference report', () => {
  assert(widgets.nameProblem('button1', []) === null, 'button1 is a fine name');
  assert(widgets.nameProblem('кнопка_1', []) === null, 'Cyrillic identifiers are legal in the language');
  for (const keyword of ['event', 'class', 'map', 'int', 'main', 'use']) {
    assert(widgets.nameProblem(keyword, []) !== null, `keyword ${keyword} must be refused`);
  }
  assert(widgets.nameProblem('win', []) !== null, 'the window name is taken');
  assert(widgets.nameProblem('1button', []) !== null, 'a name cannot start with a digit');
  assert(widgets.nameProblem('my button', []) !== null, 'a name cannot contain spaces');
  assert(widgets.nameProblem('button1', ['button1']) !== null, 'duplicates are refused');
  assert(widgets.freeName('button', ['button1', 'button2']) === 'button3', 'free names count up');
  assert(codegen.formatValue('string', 'a "b"\nc') === '"a \\"b\\"\\nc"', 'strings are escaped for the language');
  assert(codegen.formatValue('float', 2) === '2.0', 'floats always carry a decimal point');
  assert(codegen.formatValue('color', '2291BC') === 'colors.HEX("#2291bc")', 'colours become colors.HEX');

  // Сверка: ручной обработчик в файле — назван диапазоном строк; удалённая строка макета — посчитана.
  const model: any = { version: 1, window: { name: 'win', props: { title: 'Окно', width: 300, height: 200 } }, widgets: [
    { id: 1, type: 'Button', name: 'go', parent: null, props: { x: 20, y: 20, text: 'Go' } },
  ] };
  const generated = codegen.generateCode(model, {});
  const edited = generated
    .replace('    win.show();', '    go.on_click = void function() {\n        go.text = "Готово";\n    };\n\n    win.show();')
    .replace('    go.text = "Go";\n', '');
  const difference = codegen.codeDifference(edited, generated);
  assert(difference.extraLines === 3 && difference.extraRanges.length === 1, `the hand-written handler is one range of 3 lines, got ${JSON.stringify(difference)}`);
  assert(difference.extraRanges[0].first.startsWith('go.on_click = void function()'), 'the range is named by its first line');
  assert(difference.missingLines.length === 1 && difference.missingLines[0] === 'go.text = "Go";', 'the deleted model line is reported');
  const same = codegen.codeDifference(generated, generated);
  assert(same.extraLines === 0 && same.missingLines.length === 0, 'an untouched file has no difference');
});

test('gui designer: the built page is a real section with the shared header, not a stub', () => {
  const root = path.resolve(process.cwd(), 'docs', 'gui-designer');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('class="site-topbar"') && html.includes('class="topbar-badge">Конструктор GUI<'), 'the designer page carries the shared header');
  assert(html.includes('src="designer.js"') && fs.existsSync(path.join(root, 'designer.js')), 'the designer script is built and referenced');
  assert(html.includes('src="../assets/idyllium-web-core.js"') && fs.existsSync(path.resolve(process.cwd(), 'docs', 'assets', 'idyllium-web-core.js')), 'the designer uses the browser core');
  assert(html.includes('src="../gui-preview.html"') && fs.existsSync(path.resolve(process.cwd(), 'docs', 'gui-preview.html')), 'the scene is the real preview frame');
  assert(!html.includes('stub-note'), 'the stub text is gone');
  assert(html.includes('id="split-palette"') && html.includes('id="split-code"') && html.includes('id="split-tree"'), 'panels have resizers');
  assert(html.includes('id="dialog"'), 'the designer has its own dialog instead of the browser confirm');
  const script = fs.readFileSync(path.join(root, 'designer.js'), 'utf8');
  assert(script.includes('runIdylliumInBrowser'), 'the scene is a real run of the generated program');
  assert(script.includes('color-eyedropper-button'), 'colours use the site\'s own colour generator with the eyedropper');
});

void runTests();
