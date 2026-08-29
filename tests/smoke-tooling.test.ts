// Смоук: инструменты — completions, семантические токены, форматтер, project API,
// сборка сайта, синхронность копий, браузерный хост.
// Разнесено из smoke.test.ts 2026-08-29 (11,9 тыс. строк); тела тестов — дословно.
import {
  BufferRef,
  IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS,
  IDYLLIUM_SEMANTIC_TOKEN_TYPES,
  IDYLLIUM_VERSION,
  IdylliumLanguageService,
  IdylliumProject,
  assert,
  assertCompiles,
  assertFails,
  assertRuntimeFails,
  compileIdyllium,
  compileProject,
  createDefaultStandardLibrary,
  createMemoryChannelBus,
  createMemoryNetworkService,
  createMemoryRuntimeFileSystem,
  createNodeImageService,
  createRuntime,
  explicitProperties,
  formatIdyllium,
  fs,
  os,
  parseIdylliumStyle,
  path,
  runIdyllium,
  runIdylliumInBrowser,
  runTests,
  runWithInspectableRuntime,
  runWithMemoryFiles,
  scaleRaster,
  test,
  tinyMp3Bytes,
  tinyTtfHeader,
  tinyWavBinary,
} from './smoke-harness';

test('browser runtime reads virtual project files', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use console;',
        'use file;',
        '',
        'main() {',
        '    file.istream fin = file.open("input.txt", "read");',
        '    string line = fin.read_line();',
        '    fin.close();',
        '    console.write(line);',
        '}',
      ].join('\n'),
      '/workspace/input.txt': 'Кирка\n',
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Кирка\n', `unexpected browser output: ${JSON.stringify(result.output)}`);
});

test('browser runtime refuses a missing entry file instead of running emptiness', async () => {
  // Находка владельца 2026-08-29: без main.idyl проект «успешно выполнялся» —
  // отсутствующий стартовый файл молча становился пустым исходником.
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/helper.idyl': 'use console;\n',
    },
  });
  assert(!result.success, 'missing entry file must not "run successfully"');
  assert(
    result.compilation.diagnosticsText.includes("entry file 'main.idyl' was not found in the project"),
    `missing entry wording: ${result.compilation.diagnosticsText}`,
  );

  // Признак «в файле нет main()» — им хосты отличают модуль от программы.
  const moduleOnly = compileIdyllium('use console;\n\nint function twice(int x) {\n    return x * 2;\n}\n', { file: 'helper.idyl' });
  assert(moduleOnly.success, moduleOnly.diagnosticsText);
  assert(!moduleOnly.ast?.main, 'module-only file must expose no main in its ast');
  const withMain = compileIdyllium('main() {\n}\n', { file: 'main.idyl' });
  assert(Boolean(withMain.ast?.main), 'program with main() must expose it in the ast');
});

test('browser runtime returns written virtual project files', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use file;',
        '',
        'main() {',
        '    file.ostream fout = file.open("output.txt", "write");',
        '    fout.write_line("Привет, мир!");',
        '    fout.write("Файл создан с помощью Idyllium!");',
        '    fout.close();',
        '}',
      ].join('\n'),
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const output = result.files['/workspace/output.txt'];
  assert(typeof output !== 'string', 'expected structured output file');
  assert(output?.content === 'Привет, мир!\nФайл создан с помощью Idyllium!', `unexpected written file: ${JSON.stringify(output)}`);
  const writtenOutput = result.writtenFiles['/workspace/output.txt'];
  assert(typeof writtenOutput !== 'string', 'expected structured written output file');
  assert(writtenOutput?.content === output.content, `unexpected written snapshot: ${JSON.stringify(result.writtenFiles)}`);
  assert(!('/workspace/main.idyl' in result.writtenFiles), 'source file must not be reported as written');
});

test('language service exposes constructor signatures and class semantic tokens', () => {
  const source = `
    use geometry;

    class Hero {
      constructor Hero(string name, int hp = 100) {}
    }

    main() {
      Hero local = Hero(name="Mira");
      geometry.Point point = geometry.Point(x=10, y=20);
    }
  `;
  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': source,
      'geometry.idyl': `
        class Point {
          constructor Point(int x, int y = 0) {}
        }
      `,
    },
  });

  const localOffset = source.indexOf('Hero(name=') + 'Hero('.length;
  const localSignature = project.signatureHelp({ file: 'main.idyl', offset: localOffset });
  assert(!!localSignature?.signatures[0].label.includes('Hero(name: string, hp: int = ...)'), 'expected local constructor signature');

  const moduleOffset = source.indexOf('geometry.Point(x=') + 'geometry.Point('.length;
  const moduleSignature = project.signatureHelp({ file: 'main.idyl', offset: moduleOffset });
  assert(!!moduleSignature?.signatures[0].label.includes('Point(x: int, [y: int])'), 'expected module constructor signature');

  const constructorCallOffset = source.lastIndexOf('Hero(name=');
  const classToken = project.semanticTokens('main.idyl').find((token) => (
    token.kind === 'class'
    && token.range.start.line === source.slice(0, constructorCallOffset).split('\n').length
  ));
  assert(!!classToken, 'expected constructor callee to be a class semantic token');
});

test('stdlib registry powers completions', () => {
  const service = new IdylliumLanguageService();
  const source = 'use console;\nmain() {\n  console.';
  const completions = service.completions({ source, offset: source.length });
  assert(completions.some((item) => item.name === 'write'), 'expected console.write completion');
});

test('json completions use language null instead of legacy NULL', () => {
  const service = new IdylliumLanguageService();
  const source = 'use json;\nmain() {\n  json.';
  const completions = service.completions({ source, offset: source.length });

  assert(completions.some((item) => item.name === 'Value' && item.kind === 'type'), 'expected json.Value completion');
  assert(completions.some((item) => item.name === 'parse'), 'expected json.parse completion');
  assert(!completions.some((item) => item.name === 'NULL'), 'json.NULL must not remain in completions');
});

test('stdlib registry exposes reference metadata', () => {
  const registry = createDefaultStandardLibrary();
  const imageModule = registry.listModuleSpecs().find((module) => module.name === 'image');
  const desaturate = imageModule?.types.get('Static')?.methods.get('desaturate');

  assert(imageModule !== undefined, 'expected image module metadata');
  assert(desaturate?.parameters[0]?.defaultValue === '1.0', 'expected documented desaturate default');
  assert(registry.listGlobalFunctions().some((fn) => fn.name === 'to_int'), 'expected global function metadata');
});

test('colors registry powers completions', () => {
  const service = new IdylliumLanguageService();
  const source = 'use colors;\nmain() {\n  colors.';
  const completions = service.completions({ source, offset: source.length });
  assert(completions.some((item) => item.name === 'Color' && item.kind === 'type'), 'expected colors.Color completion');
  assert(completions.some((item) => item.name === 'RGB'), 'expected colors.RGB completion');
  assert(completions.some((item) => item.name === 'WHITE'), 'expected colors.WHITE completion');
  assert(completions.some((item) => item.name === 'MAGENTA'), 'expected colors.MAGENTA completion');
  assert(completions.some((item) => item.name === 'DARK_GREEN'), 'expected colors.DARK_GREEN completion');
  assert(completions.some((item) => item.name === 'LIGHT_GRAY'), 'expected colors.LIGHT_GRAY completion');
});

test('language service completes structured catch error members', () => {
  const source = [
    'main() {',
    '    try {',
    '        float value = 1 / 0;',
    '    } catch (problem) {',
    '        string message = problem.message;',
    '    }',
    '}',
  ].join('\n');
  const project = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': source },
  });
  const offset = source.indexOf('problem.message') + 'problem.'.length;
  const items = project.completions({ file: '/workspace/main.idyl', offset });

  assert(items.some((item) => item.name === 'message' && item.kind === 'property'), 'expected RuntimeError.message completion');
  assert(items.some((item) => item.name === 'file' && item.kind === 'property'), 'expected RuntimeError.file completion');
  assert(items.some((item) => item.name === 'line' && item.kind === 'property'), 'expected RuntimeError.line completion');
  assert(items.some((item) => item.name === 'to_string' && item.kind === 'method'), 'expected RuntimeError.to_string completion');
});

test('image registry powers resource completions', () => {
  const moduleSource = 'use image;\nmain() {\n  image.';
  const moduleProject = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': moduleSource },
  });
  const moduleItems = moduleProject.completions({ file: '/workspace/main.idyl', offset: moduleSource.length });
  assert(moduleItems.some((item) => item.name === 'Static' && item.kind === 'type'), 'expected image.Static completion');
  assert(moduleItems.some((item) => item.name === 'Animation' && item.kind === 'type'), 'expected image.Animation completion');

  const valueSource = 'use image;\nmain() {\n  image.Static picture;\n  picture.';
  const valueProject = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': valueSource },
  });
  const valueItems = valueProject.completions({ file: '/workspace/main.idyl', offset: valueSource.length });
  assert(valueItems.some((item) => item.name === 'scale'), 'expected image.Static.scale completion');
  assert(valueItems.some((item) => item.name === 'with_opacity'), 'expected image.Static.with_opacity completion');
});

test('fonts registry powers shared font completions', () => {
  const moduleSource = 'use fonts;\nmain() {\n  fonts.';
  const moduleProject = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': moduleSource },
  });
  const moduleItems = moduleProject.completions({ file: '/workspace/main.idyl', offset: moduleSource.length });
  assert(moduleItems.some((item) => item.name === 'Font' && item.kind === 'type'), 'expected fonts.Font completion');

  const valueSource = 'use fonts;\nmain() {\n  fonts.Font heading;\n  heading.';
  const valueProject = new IdylliumProject({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': valueSource },
  });
  const valueItems = valueProject.completions({ file: '/workspace/main.idyl', offset: valueSource.length });
  assert(valueItems.some((item) => item.name === 'load_from_file'), 'expected fonts.Font.load_from_file completion');
  assert(valueItems.some((item) => item.name === 'format'), 'expected fonts.Font.format completion');
});

test('formatter normalizes indentation without touching braces in text', () => {
  const source = [
    'use console;   ',
    '',
    'class Demo {',
    'private:',
    'int value;',
    'public:',
    'void function show() {',
    'if (this.value > 0) {',
    'console.writeln("{ok}"); // comment with { brace',
    '} else {',
    'console.writeln("no");',
    '}',
    '}',
    '}',
    '',
    'main() {',
    'Demo demo;',
    'demo.show();',
    '}',
  ].join('\n');

  const expected = [
    'use console;',
    '',
    'class Demo {',
    '    private:',
    '    int value;',
    '    public:',
    '    void function show() {',
    '        if (this.value > 0) {',
    '            console.writeln("{ok}"); // comment with { brace',
    '        } else {',
    '            console.writeln("no");',
    '        }',
    '    }',
    '}',
    '',
    'main() {',
    '    Demo demo;',
    '    demo.show();',
    '}',
  ].join('\n');

  assert(formatIdyllium(source) === expected, `unexpected formatted source:\n${formatIdyllium(source)}`);
});

test('project API compiles files and powers user module completions', () => {
  const mainSource = `
    use console;
    use rect;
    use my_cvs;

    main() {
      rect.Rect r;
      my_cvs.
    }
  `;
  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': mainSource,
      'rect.idyl': `
        class Rect {
          float width;
          float height;

          float function getArea() {
            return this.width * this.height;
          }
        }
      `,
      'my_cvs.idyl': `
        use gui;

        void function on_update(gui.Canvas canvas, float delta_time) {
          canvas.clear();
        }
      `,
    },
  });

  const useSource = 'use ';
  const useProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': useSource,
      'rect.idyl': 'class Rect {}',
    },
  });
  const moduleCompletions = useProject.completions({ file: 'main.idyl', offset: useSource.length });
  assert(moduleCompletions.some((item) => item.name === 'rect' && item.kind === 'module'), 'expected rect module completion');

  const rectPrefix = 'use rect;\nmain() {\n  rect.';
  const rectProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': rectPrefix,
      'rect.idyl': 'class Rect {}',
    },
  });
  const rectCompletions = rectProject.completions({ file: 'main.idyl', offset: rectPrefix.length });
  assert(rectCompletions.some((item) => item.name === 'Rect' && item.kind === 'type'), 'expected rect.Rect completion');

  const rectObjectPrefix = 'use rect;\nmain() {\n  rect.Rect r;\n  r.';
  const rectObjectProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': rectObjectPrefix,
      'rect.idyl': `
        class Rect {
          float width;
          float height;

          float function getArea() {
            return this.width * this.height;
          }
        }
      `,
    },
  });
  const rectObjectCompletions = rectObjectProject.completions({ file: 'main.idyl', offset: rectObjectPrefix.length });
  assert(rectObjectCompletions.some((item) => item.name === 'width' && item.kind === 'property'), 'expected r.width completion');
  assert(rectObjectCompletions.some((item) => item.name === 'getArea' && item.kind === 'method'), 'expected r.getArea completion');

  const canvasObjectPrefix = 'use gui;\nmain() {\n  gui.Canvas canvas;\n  canvas.';
  const canvasObjectProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': canvasObjectPrefix,
    },
  });
  const canvasObjectCompletions = canvasObjectProject.completions({ file: 'main.idyl', offset: canvasObjectPrefix.length });
  assert(canvasObjectCompletions.some((item) => item.name === 'draw' && item.kind === 'method'), 'expected canvas.draw completion');
  assert(canvasObjectCompletions.some((item) => item.name === 'x' && item.kind === 'property'), 'expected inherited canvas.x completion');
  assert(canvasObjectCompletions.some((item) => item.name === 'on_update' && item.kind === 'property'), 'expected canvas.on_update completion');

  const arrayObjectPrefix = 'main() {\n  dyn_array<int> values = [1, 2];\n  values.';
  const arrayObjectProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': arrayObjectPrefix,
    },
  });
  const arrayObjectCompletions = arrayObjectProject.completions({ file: 'main.idyl', offset: arrayObjectPrefix.length });
  assert(arrayObjectCompletions.some((item) => item.name === 'add' && item.detail === 'add(value: int): void'), 'expected values.add completion');
  assert(arrayObjectCompletions.some((item) => item.name === 'length' && item.kind === 'property' && item.detail === 'length: int'), 'expected values.length property completion');

  const stringObjectPrefix = 'main() {\n  string text = "abc";\n  text.';
  const stringObjectProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': stringObjectPrefix,
    },
  });
  const stringObjectCompletions = stringObjectProject.completions({ file: 'main.idyl', offset: stringObjectPrefix.length });
  assert(stringObjectCompletions.some((item) => item.name === 'replace' && item.kind === 'method'), 'expected text.replace completion');
  assert(stringObjectCompletions.some((item) => item.name === 'length' && item.kind === 'property' && item.detail === 'length: int'), 'expected text.length property completion');

  const consoleHoverSource = 'use console;\nmain() {\n  console.write("Hi");\n}';
  const consoleHoverProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': consoleHoverSource },
  });
  const consoleHover = consoleHoverProject.hover({
    file: 'main.idyl',
    offset: consoleHoverSource.indexOf('write') + 1,
  });
  assert(consoleHover?.detail.includes('write(') === true, `expected console.write hover, got ${consoleHover?.detail}`);

  const variableHover = canvasObjectProject.hover({
    file: 'main.idyl',
    offset: canvasObjectPrefix.indexOf('canvas') + 1,
  });
  assert(variableHover?.detail === 'canvas: gui.Canvas', `expected canvas variable hover, got ${variableHover?.detail}`);

  const typesHoverSource = 'use types;\nmain() {\n  types.uint8 n = 1;\n}';
  const typesHoverProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': typesHoverSource },
  });
  const typesHover = typesHoverProject.hover({
    file: 'main.idyl',
    offset: typesHoverSource.indexOf('uint8') + 1,
  });
  assert(typesHover?.detail === 'type types.uint8', `expected types.uint8 hover, got ${typesHover?.detail}`);

  const fileSignatureSource = 'use file;\nmain() {\n  file.istream fin = file.open("input.txt", ';
  const fileSignatureProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': fileSignatureSource },
  });
  const fileSignature = fileSignatureProject.signatureHelp({ file: 'main.idyl', offset: fileSignatureSource.length });
  assert(fileSignature !== null, 'expected file.open signature help');
  assert(fileSignature.signatures[0].label === 'open(path: string, mode: string): any', `unexpected file.open signature: ${fileSignature.signatures[0].label}`);
  assert(fileSignature.activeParameter === 1, `expected second active parameter, got ${fileSignature.activeParameter}`);

  const arraySignatureSource = 'main() {\n  dyn_array<int> values = [1, 2];\n  values.add(';
  const arraySignatureProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': arraySignatureSource },
  });
  const arraySignature = arraySignatureProject.signatureHelp({ file: 'main.idyl', offset: arraySignatureSource.length });
  assert(arraySignature !== null, 'expected values.add signature help');
  assert(arraySignature.signatures[0].label === 'add(value: int): void', `unexpected values.add signature: ${arraySignature.signatures[0].label}`);

  const stringSignatureSource = 'main() {\n  string text = "abc";\n  string updated = text.replace("a", ';
  const stringSignatureProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': stringSignatureSource },
  });
  const stringSignature = stringSignatureProject.signatureHelp({ file: 'main.idyl', offset: stringSignatureSource.length });
  assert(stringSignature !== null, 'expected text.replace signature help');
  assert(stringSignature.signatures[0].label === 'replace(old_text: string, new_text: string): string', `unexpected text.replace signature: ${stringSignature.signatures[0].label}`);
  assert(stringSignature.activeParameter === 1, `expected replace second active parameter, got ${stringSignature.activeParameter}`);

  const namedArgSource = `
    int function sub(int left, int right = 10) {
      return left - right;
    }

    main() {
      int a = sub();
    }
  `;
  const namedArgProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': namedArgSource },
  });
  const namedArgCompletions = namedArgProject.completions({ file: 'main.idyl', offset: namedArgSource.lastIndexOf('sub(') + 'sub('.length });
  assert(namedArgCompletions.some((item) => item.name === 'left=' && item.kind === 'parameter'), 'expected left= argument completion');
  assert(namedArgCompletions.some((item) => item.name === 'right=' && item.kind === 'parameter'), 'expected right= argument completion');

  const remainingArgSource = namedArgSource.replace('sub();', 'sub(right=50, left=20);');
  const remainingArgProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': remainingArgSource },
  });
  const remainingArgCompletions = remainingArgProject.completions({
    file: 'main.idyl',
    offset: remainingArgSource.indexOf('right=50, ') + 'right=50, '.length,
  });
  assert(remainingArgCompletions.some((item) => item.name === 'left='), 'expected remaining left= argument completion');
  assert(!remainingArgCompletions.some((item) => item.name === 'right='), 'right= should not be suggested twice');

  const namedSignatureSource = namedArgSource.replace('sub();', 'sub(right=50);');
  const namedSignatureProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': namedSignatureSource },
  });
  const namedSignature = namedSignatureProject.signatureHelp({
    file: 'main.idyl',
    offset: namedSignatureSource.indexOf('right=') + 'right='.length,
  });
  assert(namedSignature !== null, 'expected named argument signature help');
  assert(namedSignature.activeParameter === 1, `expected right active parameter, got ${namedSignature.activeParameter}`);

  const variadicArgSource = 'use console;\nmain() {\n  console.write();\n}';
  const variadicArgProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': variadicArgSource },
  });
  const variadicArgCompletions = variadicArgProject.completions({ file: 'main.idyl', offset: variadicArgSource.indexOf('write(') + 'write('.length });
  assert(!variadicArgCompletions.some((item) => item.kind === 'parameter'), 'variadic functions should not suggest named arguments');

  const definitionSource = [
    'use helper;',
    '',
    'class Hero {',
    '    public:',
    '    string name;',
    '    void function say() {}',
    '}',
    '',
    'int function twice(int value) {',
    '    return value * 2;',
    '}',
    '',
    'main() {',
    '    int answer = twice(helper.square(4));',
    '    Hero hero;',
    '    hero.say();',
    '}',
  ].join('\n');
  const definitionProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': definitionSource,
      'helper.idyl': 'int function square(int value) { return value * value; }',
    },
  });
  const helperModuleDefinition = definitionProject.definition({
    file: 'main.idyl',
    offset: definitionSource.indexOf('helper') + 1,
  });
  assert(helperModuleDefinition?.file === 'helper.idyl', `expected helper module definition, got ${helperModuleDefinition?.file}`);

  const squareDefinition = definitionProject.definition({
    file: 'main.idyl',
    offset: definitionSource.indexOf('square') + 1,
  });
  assert(squareDefinition?.file === 'helper.idyl', `expected helper.square definition, got ${squareDefinition?.file}`);
  assert(squareDefinition?.range.start.line === 1, `expected helper.square line 1, got ${squareDefinition?.range.start.line}`);

  const twiceDefinition = definitionProject.definition({
    file: 'main.idyl',
    offset: definitionSource.lastIndexOf('twice') + 1,
  });
  assert(twiceDefinition?.range.start.line === 9, `expected twice definition line 9, got ${twiceDefinition?.range.start.line}`);

  const answerDefinition = definitionProject.definition({
    file: 'main.idyl',
    offset: definitionSource.lastIndexOf('answer') + 1,
  });
  assert(answerDefinition?.range.start.line === 14, `expected answer definition line 14, got ${answerDefinition?.range.start.line}`);

  const heroClassDefinition = definitionProject.definition({
    file: 'main.idyl',
    offset: definitionSource.lastIndexOf('Hero') + 1,
  });
  assert(heroClassDefinition?.range.start.line === 3, `expected Hero definition line 3, got ${heroClassDefinition?.range.start.line}`);

  const sayDefinition = definitionProject.definition({
    file: 'main.idyl',
    offset: definitionSource.lastIndexOf('say') + 1,
  });
  assert(sayDefinition?.range.start.line === 6, `expected hero.say definition line 6, got ${sayDefinition?.range.start.line}`);

  const myCvsOffset = mainSource.indexOf('my_cvs.') + 'my_cvs.'.length;
  const myCvsCompletions = project.completions({ file: 'main.idyl', offset: myCvsOffset });
  assert(myCvsCompletions.some((item) => item.name === 'on_update' && item.kind === 'function'), 'expected my_cvs.on_update completion');

  const symbols = project.documentSymbols('rect.idyl');
  assert(symbols.some((item) => item.name === 'Rect' && item.kind === 'class'), 'expected Rect document symbol');
  assert(symbols.some((item) => item.name === 'getArea' && item.kind === 'method'), 'expected getArea document symbol');
});

test('single-source metadata stays in sync across packages', () => {
  const root = process.cwd();
  const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const extensionPackage = JSON.parse(
    fs.readFileSync(path.join(root, 'packages/vscode-idyllium/package.json'), 'utf8'),
  );

  // Версия: единственный источник — корневой package.json.
  assert(
    extensionPackage.version === rootPackage.version,
    `extension version ${extensionPackage.version} must match root ${rootPackage.version} (run npm run build:vscode)`,
  );
  const ideHtml = fs.readFileSync(path.join(root, 'packages/web-ide/index.html'), 'utf8');
  assert(!/v\d+\.\d+\.\d+/u.test(ideHtml), 'web IDE index.html must not hardcode a version (version.js provides it)');
  assert(ideHtml.includes('version.js'), 'web IDE index.html must load version.js');

  // Легенда семантических токенов: package.json расширения соответствует ядру.
  const scopes = extensionPackage.contributes?.semanticTokenScopes?.[0]?.scopes ?? {};
  const baseKeys = new Set<string>();
  for (const key of Object.keys(scopes)) {
    const [type, modifier] = key.split('.', 2);
    baseKeys.add(type);
    if (modifier !== undefined) {
      assert(
        (IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS as readonly string[]).includes(modifier),
        `semanticTokenScopes key '${key}' uses unknown modifier '${modifier}'`,
      );
    }
  }
  for (const type of IDYLLIUM_SEMANTIC_TOKEN_TYPES) {
    assert(baseKeys.has(type), `semanticTokenScopes must map core token type '${type}'`);
  }
  for (const type of baseKeys) {
    assert(
      (IDYLLIUM_SEMANTIC_TOKEN_TYPES as readonly string[]).includes(type),
      `semanticTokenScopes maps unknown token type '${type}'`,
    );
  }

  // Копия gui-renderer в расширении кладётся сборкой (npm run build:vscode)
  // и в git больше не живёт (2026-08-29). На чистом клоне её нет — это
  // норма; но если она лежит, то обязана быть байт-в-байт равной источнику,
  // иначе package:vscode упакует в VSIX протухший рендерер.
  const rendererSource = path.join(root, 'packages/gui-renderer');
  const rendererCopy = path.join(root, 'packages/vscode-idyllium/gui-renderer');
  if (!fs.existsSync(rendererCopy)) return;
  const walk = (dir: string): string[] => {
    const output: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) output.push(...walk(absolute));
      else output.push(absolute);
    }
    return output;
  };
  const sourceFiles = walk(rendererSource).map((file: string) => path.relative(rendererSource, file)).sort();
  const copyFiles = walk(rendererCopy).map((file: string) => path.relative(rendererCopy, file)).sort();
  assert(
    JSON.stringify(sourceFiles) === JSON.stringify(copyFiles),
    `gui-renderer copies list different files (run npm run build:vscode):\n${sourceFiles.join(', ')}\nvs\n${copyFiles.join(', ')}`,
  );
  for (const relative of sourceFiles) {
    const left = fs.readFileSync(path.join(rendererSource, relative));
    const right = fs.readFileSync(path.join(rendererCopy, relative));
    assert(left.equals(right), `gui-renderer copy differs from source: ${relative} (run npm run build:vscode)`);
  }
});

test('VSIX themes distinguish namespaces from classes like Web IDE', () => {
  const extensionRoot = path.resolve(process.cwd(), 'packages', 'vscode-idyllium');
  const readJson = (relativePath: string) => JSON.parse(
    fs.readFileSync(path.join(extensionRoot, relativePath), 'utf8'),
  );
  const dark = readJson('themes/idyllium-dark-color-theme.json');
  const light = readJson('themes/idyllium-light-color-theme.json');
  const manifest = readJson('package.json');
  const grammarText = fs.readFileSync(
    path.join(extensionRoot, 'syntaxes', 'idyllium.tmLanguage.json'),
    'utf8',
  );

  assert(dark.semanticTokenColors.namespace === '#8bdfff', 'unexpected dark namespace color');
  assert(dark.semanticTokenColors.class === '#59d4b8', 'unexpected dark class color');
  assert(light.semanticTokenColors.namespace === '#0d667f', 'unexpected light namespace color');
  assert(light.semanticTokenColors.class === '#1b745c', 'unexpected light class color');
  assert(light.colors['editor.background'] === '#d9d6df', 'VSIX light editor must match the subdued Web IDE surface');
  assert(dark.semanticTokenColors.namespace !== dark.semanticTokenColors.class, 'dark namespace and class colors must differ');
  assert(light.semanticTokenColors.namespace !== light.semanticTokenColors.class, 'light namespace and class colors must differ');
  assert(!grammarText.includes('support.module.idyllium'), 'legacy module scope must not remain in VSIX grammar');
  assert(grammarText.includes('entity.name.namespace.idyllium'), 'expected namespace TextMate scope');
  assert(
    manifest.contributes.configurationDefaults['[idyllium]']['editor.semanticHighlighting.enabled'] === true,
    'semantic highlighting must be enabled for Idyllium documents',
  );
  const tokenScopes = manifest.contributes.semanticTokenScopes[0].scopes;
  assert(tokenScopes.namespace.includes('entity.name.namespace.idyllium'), 'expected namespace semantic fallback scope');
  assert(tokenScopes.class.includes('entity.name.type.class.idyllium'), 'expected class semantic fallback scope');
});

test('Web IDE default project is minimal and light surfaces are subdued', () => {
  const webIdeRoot = path.resolve(process.cwd(), 'packages', 'web-ide');
  // app.js больше не лежит в git — он собирается линкером из src/;
  // гард смотрит на собранный текст, заодно проверяя саму сборку.
  const { linkWebIdeApp } = require(path.resolve(process.cwd(), 'tools', 'link-web-ide-app.js'));
  const appSource: string = linkWebIdeApp(path.join(webIdeRoot, 'src'));
  const cssSource = fs.readFileSync(path.join(webIdeRoot, 'app.css'), 'utf8');
  const initialFilesStart = appSource.indexOf('const files = new Map([');
  const initialFilesEnd = appSource.indexOf('const folders = new Set', initialFilesStart);
  const factoryStart = appSource.indexOf('function createDefaultProjectState()');
  const factoryEnd = appSource.indexOf('function copySerializedProjectState', factoryStart);

  assert(initialFilesStart >= 0 && initialFilesEnd > initialFilesStart, 'expected initial Web IDE file map');
  assert(factoryStart >= 0 && factoryEnd > factoryStart, 'expected default project factory');
  assert(!appSource.slice(initialFilesStart, initialFilesEnd).includes('input.txt'), 'initial project must not contain input.txt');
  assert(!appSource.slice(factoryStart, factoryEnd).includes('input.txt'), 'new project must not contain input.txt');
  assert(cssSource.includes('--bg: #d2cfd7;'), 'expected subdued light page background');
  assert(cssSource.includes('--panel-raised: #e7e4ea;'), 'expected subdued light raised surface');
  assert(cssSource.includes('--editor-bg: #d9d6df;'), 'expected subdued light editor surface');
  assert(cssSource.includes('--output-bg: #cfccd5;'), 'expected subdued light console surface');
});

test('Web IDE linker enforces its module subset and keeps leaves before main', () => {
  const os = require('os') as typeof import('os');
  const { linkWebIdeApp } = require(path.resolve(process.cwd(), 'tools', 'link-web-ide-app.js'));
  const makeSrc = (files: Record<string, string>): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-linker-'));
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    return dir;
  };
  const expectFailure = (files: Record<string, string>, fragment: string): void => {
    const dir = makeSrc(files);
    let message = '';
    try {
      linkWebIdeApp(dir);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    assert(message.includes(fragment), `linker must refuse with "${fragment}", got: ${message}`);
  };

  const goodDir = makeSrc({
    'main.js': "import { greet } from './leaf.js';\nfunction start() { greet(); }\nstart();\n",
    'leaf.js': 'export function greet() { return 1; }\n',
  });
  const bundle: string = linkWebIdeApp(goodDir);
  fs.rmSync(goodDir, { recursive: true, force: true });
  assert(bundle.indexOf('src/leaf.js') < bundle.indexOf('src/main.js'), 'leaf module must be linked before main');
  assert(!/^\s*(import[\s('"]|export[\s{])/m.test(bundle), 'linked bundle must not contain module keywords');

  expectFailure({
    'main.js': "import './a.js';\nimport './b.js';\n",
    'a.js': 'export const twin = 1;\n',
    'b.js': 'export const twin = 2;\n',
  }, "export the name 'twin' twice");
  expectFailure({
    'main.js': "import './a.js';\n",
    'a.js': "import './main.js';\nexport const loop = 1;\n",
  }, 'cycle');
  expectFailure({
    'main.js': "import './a.js';\n",
    'a.js': 'export default 5;\n',
  }, 'unsupported export form');
  expectFailure({
    'main.js': "import { missing } from './a.js';\n",
    'a.js': 'export const present = 1;\n',
  }, 'does not export it');
});

test('project semantic tokens follow resolved symbols instead of identifier casing', () => {
  const source = [
    'use colors;',
    'use json;',
    '',
    'class Player {',
    '    string name;',
    '',
    '    void function set_name(string value) {',
    '        this.name = value;',
    '    }',
    '}',
    '',
    'int function score(int level) {',
    '    int A = level;',
    '    return A;',
    '}',
    '',
    'main() {',
    '    json.Object root;',
    '    Player player;',
    '    player.set_name("Liam");',
    '    root.add("color", json.Value(colors.RED));',
    '    score(3);',
    '}',
  ].join('\n');
  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': source },
  });
  const tokens = project.semanticTokens('main.idyl');
  const lines = source.split('\n');
  const tokenText = (token: typeof tokens[number]) => {
    const { start, end } = token.range;
    assert(start.line === end.line, 'semantic identifier token must stay on one line');
    return lines[start.line - 1].slice(start.column - 1, end.column - 1);
  };
  const matching = (text: string, kind: typeof tokens[number]['kind']) => (
    tokens.filter((token) => token.kind === kind && tokenText(token) === text)
  );

  assert(matching('json', 'namespace').length >= 3, 'expected imported and referenced json namespace tokens');
  assert(matching('Object', 'class').length === 1, 'expected json.Object class token');
  assert(matching('Player', 'class').length === 2, 'expected Player declaration and type reference');
  assert(matching('set_name', 'method').length === 2, 'expected method declaration and call tokens');
  assert(matching('name', 'property').length === 2, 'expected field declaration and access tokens');
  assert(matching('value', 'parameter').length === 2, 'expected parameter declaration and reference tokens');
  assert(matching('A', 'variable').length === 2, 'uppercase variable must remain a variable');
  assert(matching('A', 'class').length === 0, 'uppercase variable must not be classified as a class');
  assert(matching('score', 'function').length === 2, 'expected function declaration and call tokens');
  assert(matching('add', 'method').length === 1, 'expected stdlib method token');
  const red = matching('RED', 'variable');
  assert(red.length === 1 && red[0].modifiers.includes('readonly'), 'expected readonly colors.RED token');
});

test('language tooling marks named constants as readonly', () => {
  const source = [
    'use console;',
    '',
    'const int LIMIT = 3;',
    '',
    'main() {',
    '    const string title = "Idyllium";',
    '    int value = LIMIT;',
    '    console.writeln(title, value);',
    '}',
  ].join('\n');
  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': source },
  });
  const lines = source.split('\n');
  const tokens = project.semanticTokens('main.idyl');
  const tokenText = (token: typeof tokens[number]) => (
    lines[token.range.start.line - 1].slice(token.range.start.column - 1, token.range.end.column - 1)
  );
  const constantTokens = tokens.filter((token) => (
    token.kind === 'variable'
    && (tokenText(token) === 'LIMIT' || tokenText(token) === 'title')
  ));

  assert(constantTokens.length === 4, `expected four constant tokens, got ${constantTokens.length}`);
  assert(constantTokens.every((token) => token.modifiers.includes('readonly')), 'all constant tokens must be readonly');
  assert(constantTokens.filter((token) => token.modifiers.includes('declaration')).length === 2, 'expected two constant declarations');

  const hover = project.hover({ file: 'main.idyl', offset: source.lastIndexOf('title') + 1 });
  assert(hover?.detail === 'const title: string', `unexpected const hover: ${hover?.detail}`);

  const symbols = project.documentSymbols('main.idyl');
  const limit = symbols.find((symbol) => symbol.name === 'LIMIT');
  assert(limit?.kind === 'constant', `expected constant document symbol, got ${limit?.kind}`);
});

test('project semantic tokens resolve classes and methods across user modules', () => {
  const source = [
    'use shapes;',
    'main() {',
    '    shapes.Box box;',
    '    box.area();',
    '}',
  ].join('\n');
  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': source,
      'shapes.idyl': [
        'class Box {',
        '    float function area() {',
        '        return 0.0;',
        '    }',
        '}',
      ].join('\n'),
    },
  });
  const lines = source.split('\n');
  const tokens = project.semanticTokens('main.idyl');
  const has = (text: string, kind: typeof tokens[number]['kind']) => tokens.some((token) => {
    if (token.kind !== kind || token.range.start.line !== token.range.end.line) return false;
    return lines[token.range.start.line - 1].slice(token.range.start.column - 1, token.range.end.column - 1) === text;
  });

  assert(has('shapes', 'namespace'), 'expected user module namespace token');
  assert(has('Box', 'class'), 'expected imported user class token');
  assert(has('box', 'variable'), 'expected imported class variable token');
  assert(has('area', 'method'), 'expected imported class method token');
});

test('project API returns diagnostics per file', () => {
  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': `
        use broken;

        main() {}
      `,
      'broken.idyl': `
        int function bad() {
          return "oops";
        }
      `,
    },
  });

  const allDiagnostics = project.diagnostics();
  assert(allDiagnostics.some((item) => item.range.start.file === 'broken.idyl'), 'expected diagnostics from broken.idyl');

  const brokenDiagnostics = project.diagnostics('broken.idyl');
  assert(brokenDiagnostics.length > 0, 'expected filtered diagnostics for broken.idyl');
  assert(
    brokenDiagnostics.every((item) => item.range.start.file === 'broken.idyl'),
    `expected only broken.idyl diagnostics, got ${brokenDiagnostics.map((item) => item.range.start.file).join(', ')}`,
  );
  assert(
    brokenDiagnostics.some((item) => item.message.includes("cannot return 'string' value from 'int' function")),
    'expected readable return type diagnostic',
  );

  const compiled = compileProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': 'use helper;\nmain() { int x = helper.answer(); }',
      'helper.idyl': 'int function answer() { return 42; }',
    },
  });
  assert(compiled.success, compiled.diagnosticsText);
});

test('clean URLs are baked for every book, tasks and reference route', () => {
  // Чистые адреса (/book/console/setup) работают только потому, что сборка
  // печёт настоящий файл на каждый маршрут. Тест сторожит выпадение страниц.
  const docsRoot = path.resolve(process.cwd(), 'docs');

  for (const site of ['book', 'tasks']) {
    const manifestPath = path.join(docsRoot, site, 'lessons.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const section of manifest.sections) {
      for (const lesson of section.lessons) {
        const pagePath = path.join(docsRoot, site, section.id, `${lesson.id}.html`);
        assert(fs.existsSync(pagePath), `missing baked page: ${site}/${section.id}/${lesson.id}.html`);
        const page = fs.readFileSync(pagePath, 'utf8');
        assert(page.includes('<base href="../">'), `baked page lacks <base>: ${pagePath}`);
        assert(page.includes(`<title>${lesson.title}`), `baked page lacks lesson title: ${pagePath}`);
      }
    }
  }

  // Справочник: у модуля с типами страница испечена дважды (gui.html и
  // gui/index.html) — какое правило GitHub Pages победит для /reference/gui,
  // не документировано, а оба исхода должны вести на страницу модуля.
  const api = JSON.parse(fs.readFileSync(path.join(docsRoot, 'reference', 'api.json'), 'utf8'));
  for (const module of api.modules) {
    assert(
      fs.existsSync(path.join(docsRoot, 'reference', `${module.name}.html`)),
      `missing reference module page: ${module.name}.html`,
    );
    if (module.types.length > 0) {
      assert(
        fs.existsSync(path.join(docsRoot, 'reference', module.name, 'index.html')),
        `missing duplicate module page: ${module.name}/index.html`,
      );
    }
    for (const type of module.types) {
      assert(
        fs.existsSync(path.join(docsRoot, 'reference', module.name, `${type.name}.html`)),
        `missing reference type page: ${module.name}/${type.name}.html`,
      );
    }
  }
  for (const page of api.language) {
    assert(
      fs.existsSync(path.join(docsRoot, 'reference', 'language', `${page.id}.html`)),
      `missing language page: language/${page.id}.html`,
    );
  }
  assert(fs.existsSync(path.join(docsRoot, 'reference', 'globals.html')), 'missing globals.html');
});

test('handouts page is baked with every manifest file present', () => {
  const docsRoot = path.resolve(process.cwd(), 'docs');
  const manifest = JSON.parse(fs.readFileSync(
    path.resolve(process.cwd(), 'packages', 'docs', 'handouts', 'handouts.json'), 'utf8'));
  const page = fs.readFileSync(path.join(docsRoot, 'handouts', 'index.html'), 'utf8');
  assert(page.includes('noindex'), 'handouts page must be closed from search engines');

  const seen = new Set<string>();
  for (const category of manifest.categories) {
    assert(category.id && category.title, 'every handouts tab needs an id and a title');
    assert(page.includes(`data-tab="${category.id}"`), `tab is missing from the page: ${category.id}`);
    for (const group of category.groups) {
      for (const item of group.items) {
        assert(!seen.has(item.file), `handout listed twice: ${item.file}`);
        seen.add(item.file);
        assert(
          fs.existsSync(path.join(docsRoot, 'handouts', 'files', item.file)),
          `handout file missing from the site: ${item.file}`,
        );
        assert(page.includes(encodeURIComponent(item.file)), `handout not listed on the page: ${item.file}`);
        assert(item.note.trim().length > 0, `handout has no description: ${item.file}`);
      }
    }
  }

  // Ни один выложенный файл не должен потеряться мимо вкладок: единственное
  // исключение — тексты лицензий, они висят ссылкой на своём шрифте.
  const sourceRoot = path.resolve(process.cwd(), 'packages', 'docs', 'handouts');
  for (const entry of fs.readdirSync(sourceRoot)) {
    if (entry === 'handouts.json' || entry.endsWith('-OFL.txt')) continue;
    assert(seen.has(entry), `handout file is not listed in any tab: ${entry}`);
  }
});

test('completions resolve postfix chains: array cells, call results, literals', () => {
  const complete = (source: string) => {
    const project = new IdylliumProject({ entryFile: 'main.idyl', files: { 'main.idyl': source } });
    return project.completions({ file: 'main.idyl', offset: source.length });
  };
  const has = (items: ReturnType<typeof complete>, name: string) => items.some((item) => item.name === name);

  // Ячейка массива видит члены типа элемента.
  const cell = complete('main() {\n    array<string, 3> sm;\n    sm[0].');
  assert(has(cell, 'to_upper') && has(cell, 'length'), 'array cell must expose string members');

  // Ячейка матрицы: первый индекс — методы массива, второй — методы строки.
  const row = complete('main() {\n    array<array<string, 2>, 2> m;\n    m[0].');
  assert(has(row, 'sort') && !has(row, 'add'), 'matrix row must expose fixed-array members');
  const deepCell = complete('main() {\n    array<array<string, 2>, 2> m;\n    m[0][1].');
  assert(has(deepCell, 'split'), 'matrix cell must expose string members');

  // Результат вызова функции модуля.
  const decoded = complete('use encoding;\nmain() {\n    dyn_array<int> utf;\n    string x = encoding.decode(utf, "windows-1251").');
  assert(has(decoded, 'to_upper'), 'module function result must expose string members');

  // Результат метода строки + индекс поверх него.
  const splitResult = complete('main() {\n    string s = "a;b";\n    s.split(";").');
  assert(has(splitResult, 'add') && has(splitResult, 'pop'), 'split result must expose dyn_array members');
  const splitCell = complete('main() {\n    string s = "a;b";\n    s.split(";")[0].');
  assert(has(splitCell, 'trim'), 'split result cell must expose string members');

  // Результат локальной функции и строковый литерал в корне цепочки.
  const local = complete('\nstring function greet() {\n    return "hi";\n}\n\nmain() {\n    greet().');
  assert(has(local, 'to_lower'), 'local function result must expose string members');
  const literal = complete('main() {\n    "a,b".split(",").');
  assert(has(literal, 'add'), 'string literal chain must expose dyn_array members');

  // Одиночные имена работают как раньше.
  const plain = complete('main() {\n    string s = "ab";\n    s.');
  assert(has(plain, 'split'), 'plain string variable must keep member completions');

  // Курсор посреди файла: после точки есть ещё код — цепочка всё равно видна.
  const completeAt = (source: string, marker: string) => {
    const project = new IdylliumProject({ entryFile: 'main.idyl', files: { 'main.idyl': source } });
    return project.completions({ file: 'main.idyl', offset: source.indexOf(marker) + marker.length });
  };
  const midFile = completeAt('main() {\n    array<string, 3> sm;\n    sm[0].\n    int x = 1;\n}\n', 'sm[0].');
  assert(has(midFile, 'to_upper'), 'chain completions must work mid-file');

  // Недописанное имя члена после точки не сбрасывает контекст цепочки.
  const partial = completeAt('main() {\n    array<string, 3> sm;\n    sm[0].le\n    int x = 1;\n}\n', 'sm[0].le');
  assert(has(partial, 'length'), 'partial member word must keep chain completions');

  // Точка внутри строки или комментария не открывает члены.
  const inString = completeAt('main() {\n    string s = "file.\n}\n', '"file.');
  assert(inString.length === 0, 'dot inside a string literal must not complete members');
  const inComment = completeAt('main() {\n    // sm[0].\n    int x = 1;\n}\n', 'sm[0].');
  assert(inComment.length === 0, 'dot inside a comment must not complete members');

  // Ховер по члену цепочки.
  const hoverSource = 'main() {\n    array<string, 3> sm;\n    int n = sm[0].length;\n}\n';
  const hoverProject = new IdylliumProject({ entryFile: 'main.idyl', files: { 'main.idyl': hoverSource } });
  const hover = hoverProject.hover({ file: 'main.idyl', offset: hoverSource.indexOf('.length') + 2 });
  assert(hover !== null && hover.detail.includes('int'), `expected chain member hover, got ${hover?.detail}`);
});

test('completions offer local variables, functions, and global builtins by name', () => {
  const source = 'int function double_it(int x) {\n    return x * 2;\n}\n\nmain() {\n    int very_long_name = 25;\n    very_';
  const project = new IdylliumProject({ entryFile: 'main.idyl', files: { 'main.idyl': source } });
  const items = project.completions({ file: 'main.idyl', offset: source.length });

  const variable = items.find((item) => item.name === 'very_long_name');
  assert(variable !== undefined, 'variable name must be offered');
  assert(variable!.kind === 'variable' && variable!.detail.includes('int'), `unexpected variable item: ${variable!.kind} / ${variable!.detail}`);
  assert(
    items.some((item) => item.name === 'double_it' && item.kind === 'function'),
    'local function must be offered',
  );
  assert(items.some((item) => item.name === 'sum'), 'global builtin functions must be offered');
});

test('unfinished identifiers are not painted as class names by semantic tokens', () => {
  const tokensFor = (source: string) => {
    const project = new IdylliumProject({ entryFile: 'main.idyl', files: { 'main.idyl': source } });
    return project.semanticTokens('main.idyl');
  };

  // Недописанное имя в начале строки: `wi` + `win` со следующей строки
  // разбираются как объявление с классовым типом `wi` — краситься не должно.
  const midWord = tokensFor('use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 400;\n    wi\n    win.theme = "idyllium";\n}\n');
  assert(
    !midWord.some((token) => token.range.start.line === 6 && token.kind === 'class'),
    'unfinished identifier must not be a class token',
  );

  // Недописанный член после точки: `win.them` выглядит как квалифицированный
  // тип — ни class, ни namespace ставить нельзя.
  const midMember = tokensFor('use gui;\n\nmain() {\n    gui.Window win;\n    win.them\n}\n');
  assert(
    !midMember.some((token) => token.range.start.line === 5 && (token.kind === 'class' || token.kind === 'namespace')),
    'unfinished member must not be class/namespace tokens',
  );

  // Настоящий тип по-прежнему красится.
  const valid = tokensFor('use gui;\n\nmain() {\n    gui.Window win;\n    win.title = "ok";\n}\n');
  assert(
    valid.some((token) => token.range.start.line === 4 && token.kind === 'class'),
    'valid gui.Window must keep its class token',
  );
});

void runTests();
