// Страж «Конструктора GUI» (1.6.3): каталог виджетов не расходится с реестром языка,
// генератор кода выдаёт программу, которая компилируется и выполняется, имена
// проверяются словами языка, собранная страница несёт общую шапку и свой скрипт.
import { compileIdyllium, createMemoryRuntimeFileSystem, runIdyllium } from '../src';
import { defaultGuiWidgetSize } from '../src/runtime/runtime-gui';
import { assert, test } from './smoke-harness';

const fs: any = require('fs');
const path: any = require('path');
// Тесты выполняются из dist/tests — модули конструктора берём от корня репозитория.
const widgets: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'widgets.js'));
const codegen: any = require(path.resolve(process.cwd(), 'packages', 'gui-designer', 'src', 'codegen.js'));

function sampleValue(prop: any, index: number): unknown {
  switch (prop.kind) {
    case 'int': return Math.max(prop.min ?? 0, 10 + index);
    case 'float': return 1.5 + index;
    case 'bool': return true;
    case 'color': return '#2291bc';
    case 'enum': return prop.values[prop.values.length - 1];
    default: return `Текст "в кавычках" №${index}\nвторая строка`;
  }
}

/** Макет со всеми виджетами и всеми свойствами: Frame с ребёнком, вкладки с двумя страницами. */
function kitchenSinkModel(): any {
  const model: any = { version: codegen.MODEL_VERSION, window: { name: 'win', props: {} }, widgets: [] };
  widgets.WINDOW_PROPS.forEach((prop: any, index: number) => { model.window.props[prop.name] = sampleValue(prop, index); });
  model.window.props.width = 900;
  model.window.props.height = 700;
  let id = 1;
  const add = (type: string, parent: number | null, extra: Record<string, unknown> = {}) => {
    const def = widgets.widgetDefinition(type);
    const props: Record<string, unknown> = {};
    def.props.forEach((prop: any, index: number) => { props[prop.name] = sampleValue(prop, index); });
    props.visible = true;
    props.enabled = true;
    const item: any = { id: id++, type, name: widgets.freeName(def.defaultName, model.widgets.map((w: any) => w.name)), parent, props, ...extra };
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

async function assertRuns(label: string, code: string): Promise<void> {
  const compiled = compileIdyllium(code, { file: '/workspace/main.idyl' });
  assert(compiled.success, `${label}: generated code must compile, got:\n${compiled.diagnosticsText}\n--- code ---\n${code}`);
  const fileSystem = createMemoryRuntimeFileSystem({ '/workspace/main.idyl': code }, '/workspace');
  const result = await runIdyllium(code, { fileSystem }, { file: '/workspace/main.idyl' });
  assert(result.success && result.runtimeError === null, `${label}: generated program must run, got: ${result.runtimeError}\n--- code ---\n${code}`);
}

test('gui designer: the widget catalogue matches the language registry', () => {
  const api = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'docs', 'reference', 'api.json'), 'utf8'));
  const gui = api.modules.find((module: any) => module.name === 'gui');
  assert(gui, 'gui module is missing from docs/reference/api.json');
  const typesByName = new Map<string, any>(gui.types.map((type: any) => [type.name, type]));
  const expectedKinds: Record<string, string[]> = { int: ['int'], float: ['float'], bool: ['bool'], string: ['string'], enum: ['string'], color: ['colors.Color'] };
  const check = (typeName: string, props: any[]) => {
    const type = typesByName.get(typeName);
    assert(type, `gui.${typeName} is not a registry type`);
    const registryProps = new Map<string, any>(type.properties.map((prop: any) => [prop.name, prop]));
    for (const prop of props) {
      const registryProp = registryProps.get(prop.name);
      assert(registryProp, `gui.${typeName}.${prop.name} is in the designer catalogue but not in the registry`);
      assert(expectedKinds[prop.kind].includes(registryProp.type), `gui.${typeName}.${prop.name}: designer kind '${prop.kind}' vs registry type '${registryProp.type}'`);
      assert(!registryProp.readonly, `gui.${typeName}.${prop.name} is read-only in the registry — the designer must not offer it`);
    }
  };
  check('Window', widgets.WINDOW_PROPS);
  for (const def of widgets.WIDGET_TYPES) {
    check(def.type, def.props);
    const size = defaultGuiWidgetSize(def.type);
    assert(size.width === def.size.width && size.height === def.size.height, `gui.${def.type}: palette size ${def.size.width}×${def.size.height} differs from the runtime default ${size.width}×${size.height}`);
    for (const event of def.events) {
      assert(type_has(typesByName.get(def.type), event.name), `gui.${def.type}.${event.name} is not a registry property`);
    }
  }
  function type_has(type: any, name: string): boolean {
    return type.properties.some((prop: any) => prop.name === name);
  }
});

test('gui designer: generated programs compile and run for every widget, with and without handler stubs', async () => {
  const model = kitchenSinkModel();
  const plain = codegen.generateCode(model, {});
  await assertRuns('plain', plain);
  assert(!plain.includes('selected_index'), 'the exported code must not carry the designer\'s preview tab selection');
  assert(plain.includes('tabs1.add_tab("Первая", page1);') && plain.includes('tabs1.add_tab("Вторая", page2);'), 'tabs are added as in the textbook lesson');
  assert(plain.includes('frame1.add_child(button2);'), 'a Frame child is added to the frame, not to the window');
  assert(plain.startsWith('use gui;\nuse colors;\n\nmain() {\n'), 'the program opens with use gui / use colors and main()');
  assert(plain.trimEnd().endsWith('win.show();\n}'), 'the program ends with win.show()');

  const withHandlers = codegen.generateCode(model, { handlers: true });
  await assertRuns('handlers', withHandlers);
  assert(withHandlers.includes('button1.on_click = void function() {'), 'handler stubs use the textbook form');

  const preview = codegen.generateCode(model, { previewTabs: { [model.widgets.find((w: any) => w.type === 'TabWidget').id]: 1 } });
  await assertRuns('preview', preview);
  assert(preview.includes('tabs1.selected_index = 1;'), 'the preview shows the page being edited');

  const embedded = codegen.generateCode(model, { embedModel: true });
  await assertRuns('embedded', embedded);
  const recovered = codegen.extractEmbeddedModel(embedded);
  assert(recovered && recovered.widgets.length === model.widgets.length, 'the embedded model comes back from the file');
  assert(codegen.stripEmbeddedModel(embedded) === plain, 'the code above the model line is the plain program');

  // Каждый виджет по одному — чтобы отказ называл конкретный тип.
  for (const def of widgets.WIDGET_TYPES) {
    const single: any = { version: 1, window: { name: 'win', props: { title: 'Окно', width: 640, height: 420 } }, widgets: [] };
    const props: Record<string, unknown> = {};
    def.props.forEach((prop: any, index: number) => { props[prop.name] = sampleValue(prop, index); });
    single.widgets.push({ id: 1, type: def.type, name: `${def.defaultName}1`, parent: null, props });
    if (def.container === 'tabs') {
      single.widgets.push({ id: 2, type: 'Frame', name: 'page1', parent: 1, props: { x: 8, y: 8 }, tabTitle: 'Вкладка 1' });
    }
    await assertRuns(def.type, codegen.generateCode(single, { handlers: true }));
  }

  // Пустой макет — тоже программа.
  await assertRuns('empty', codegen.generateCode({ version: 1, window: { name: 'win', props: { title: 'Окно', width: 640, height: 420 } }, widgets: [] }, {}));
});

test('gui designer: only language-valid, unique, non-keyword names are accepted', () => {
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
});

test('gui designer: the built page is a real section with the shared header, not a stub', () => {
  const root = path.resolve(process.cwd(), 'docs', 'gui-designer');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('class="site-topbar"') && html.includes('class="topbar-badge">Конструктор GUI<'), 'the designer page carries the shared header');
  assert(html.includes('src="designer.js"') && fs.existsSync(path.join(root, 'designer.js')), 'the designer script is built and referenced');
  assert(html.includes('src="../assets/idyllium-web-core.js"') && fs.existsSync(path.resolve(process.cwd(), 'docs', 'assets', 'idyllium-web-core.js')), 'the designer uses the browser core');
  assert(html.includes('src="../gui-preview.html"') && fs.existsSync(path.resolve(process.cwd(), 'docs', 'gui-preview.html')), 'the scene is the real preview frame');
  assert(!html.includes('stub-note'), 'the stub text is gone');
  const script = fs.readFileSync(path.join(root, 'designer.js'), 'utf8');
  assert(script.includes('runIdylliumInBrowser'), 'the scene is a real run of the generated program');
});
