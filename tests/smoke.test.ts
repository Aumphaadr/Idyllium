import { compileIdyllium, runIdyllium, IdylliumLanguageService, IdylliumProject, compileProject, createRuntime, formatIdyllium, runIdylliumInBrowser } from '../src';

const fs: any = require('fs');
const os: any = require('os');
const path: any = require('path');

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertCompiles(source: string): void {
  const result = compileIdyllium(source);
  assert(result.success, `expected compilation success, got:\n${result.diagnosticsText}`);
}

function assertFails(source: string, expected: string): void {
  const result = compileIdyllium(source);
  assert(!result.success, 'expected compilation failure');
  assert(
    result.diagnosticsText.toLowerCase().includes(expected.toLowerCase()),
    `expected diagnostic containing "${expected}", got:\n${result.diagnosticsText}`,
  );
}

async function assertRuntimeFails(source: string, expected: string): Promise<void> {
  const result = await runIdyllium(source, {}, { file: 'main.idyl' });
  assert(!result.success, 'expected runtime failure');
  assert(result.runtimeError !== null, 'expected runtime error text');
  assert(
    result.runtimeError.includes(expected),
    `expected runtime error containing "${expected}", got:\n${result.runtimeError}`,
  );
}

function explicitProperties(properties: Readonly<Record<string, unknown>>): string[] {
  return Array.isArray(properties.__explicit_properties) ? properties.__explicit_properties as string[] : [];
}

async function runWithInspectableRuntime(source: string, compileOptions: Parameters<typeof compileIdyllium>[1] = {}) {
  const compilation = compileIdyllium(source, compileOptions);
  assert(compilation.success, compilation.diagnosticsText);
  assert(compilation.jsCode !== null, 'expected generated JavaScript');

  const runtime = createRuntime();
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  await program(runtime);
  return { runtime, compilation };
}

test('hello world runs', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      console.write("Hello, World!", '\\n');
      console.write("русский");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Hello, World!\nрусский', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('variables and assignment run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      int money = 20000;
      console.write("У вас ", money, " денег\\n");
      money = 25000;
      console.write("У вас ", money, " денег\\n");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'У вас 20000 денег\nУ вас 25000 денег\n',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('division always has float type', () => {
  assertCompiles(`
    main() {
      int A = 37;
      int B = 10;
      float C = A / B;
    }
  `);

  assertFails(`
    main() {
      int A = 37;
      int B = 10;
      int C = A / B;
    }
  `, "cannot assign 'float'");
});

test('int rejects float initializer', () => {
  assertFails(`
    main() {
      int B = 1.7;
    }
  `, "cannot assign 'float'");
});

test('compound assignment operators run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      int count = 1;
      count += 4;
      count -= 2;
      count *= 3;

      float ratio = 9.0;
      ratio /= 2;

      string text = "Hi";
      text += '!';

      array<int, 2> nums = [10, 20];
      nums[0] += 5;

      int total = 0;
      for (int i = 0; i < 3; i += 1) {
        total += i;
      }

      console.write(count, ":", ratio, ":", text, ":", nums[0], ":", total);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '9:4.5:Hi!:15:3', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('compound assignment diagnostics are readable', () => {
  assertFails(`
    main() {
      int value = 9;
      value /= 2;
    }
  `, "cannot assign 'float' value to 'int' variable");

  assertFails(`
    main() {
      bool flag = true;
      flag += 1;
    }
  `, "operator '+=' cannot be applied");
});

test('compound division uses runtime division errors', async () => {
  const source = [
    'main() {',
    '    float value = 9.0;',
    '    value /= 0;',
    '}',
  ].join('\n');

  const result = await runIdyllium(source, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected runtime failure');
  assert(
    result.runtimeError === 'main.idyl:3: runtime error: division by zero',
    `unexpected runtime error: ${JSON.stringify(result.runtimeError)}`,
  );
});

test('div and mod run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      console.write(div(38, 10), ' ', mod(38, 10));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '3 8', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('to_float converts strings and reports runtime errors', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      float value = to_float("1.6");
      console.write(value);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '1.6', `unexpected output: ${JSON.stringify(result.output)}`);

  const failed = await runIdyllium(`
    main() {
      float value = to_float("not a number");
    }
  `);

  assert(!failed.success, 'expected runtime failure');
  const runtimeError = failed.runtimeError;
  assert(runtimeError !== null, 'expected runtime error text');
  assert(runtimeError.includes("'to_float' cannot convert 'not a number' to float"), runtimeError);

  await assertRuntimeFails(`
    main() {
      int value = to_int("12abc");
    }
  `, "'to_int' cannot convert '12abc' to int");

  await assertRuntimeFails(`
    main() {
      float value = to_float("3.14abc");
    }
  `, "'to_float' cannot convert '3.14abc' to float");
});

test('math helpers and ansi escape run', async () => {
  const result = await runIdyllium(`
    use console;
    use math;

    main() {
      float x = 3.6789;
      int rounded = math.round(15.9);
      int volume = math.clamp(0, 115, 100);

      console.write(
        "\\e[31m", ":",
        rounded, ":",
        math.round(x, 2), ":",
        math.floor(x, 2), ":",
        math.ceil(x, 2), ":",
        volume, ":",
        math.round(math.sin(math.pi / 2), 4), ":",
        math.round(math.to_degrees(math.pi), 2)
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '\x1b[31m:16:3.68:3.67:3.68:100:1:180', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('console clear removes previous output', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      console.writeln("before");
      console.clear();
      console.write("after");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'after', `unexpected output after clear: ${JSON.stringify(result.output)}`);
});

test('stdlib runtime validation is readable', async () => {
  await assertRuntimeFails([
    'use math;',
    '',
    'main() {',
    '    float value = math.sqrt(-1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: math.sqrt() expects a non-negative number, got -1');

  await assertRuntimeFails([
    'use math;',
    '',
    'main() {',
    '    float value = math.log(0);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: math.log() expects a positive number, got 0');

  await assertRuntimeFails([
    'use random;',
    '',
    'main() {',
    '    int value = random.create_int(10, 1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: random.create_int() min must be less than or equal to max');

  await assertRuntimeFails([
    'use random;',
    '',
    'main() {',
    '    float value = random.create_float(5, 5);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: random.create_float() min must be less than max');

  await assertRuntimeFails([
    'use colors;',
    '',
    'main() {',
    '    colors.Color value = colors.RGB(999, -20, 300);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: colors.RGB() red must be between 0 and 255, got 999');

  await assertRuntimeFails([
    'use console;',
    '',
    'main() {',
    '    console.set_precision(-1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: console.set_precision() must be between 0 and 25, got -1');
});

test('random seed is deterministic', async () => {
  const result = await runIdyllium(`
    use console;
    use random;

    main() {
      random.set_seed(400);
      int first = random.create_int(0, 99);
      int second = random.create_int(0, 99);

      random.set_seed(400);
      console.write(first, ":", second, ":", random.create_int(0, 99), ":", random.create_int(0, 99));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const parts = result.output.split(':');
  assert(parts.length === 4, `unexpected output: ${JSON.stringify(result.output)}`);
  assert(parts[0] === parts[2] && parts[1] === parts[3], `seeded random was not deterministic: ${result.output}`);
});

test('time and file modules run in headless runtime', async () => {
  const sleepResult = await runIdyllium([
    'use time;',
    '',
    'main() {',
    '    time.sleep(0);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(sleepResult.success, sleepResult.runtimeError ?? sleepResult.compilation.diagnosticsText);

  await assertRuntimeFails([
    'use time;',
    '',
    'main() {',
    '    time.sleep(-1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: time.sleep() seconds must be non-negative, got -1');

  const fileResult = await runIdyllium([
    'use console;',
    'use file;',
    '',
    'main() {',
    '    console.write(file.exists("001.idyl"), ":", file.exists("missing.idyl"));',
    '}',
  ].join('\n'), {}, { file: 'spec/lessons/examples/cli/001_hello/001.idyl' });

  assert(fileResult.success, fileResult.runtimeError ?? fileResult.compilation.diagnosticsText);
  assert(fileResult.output === 'true:false', `unexpected file.exists output: ${JSON.stringify(fileResult.output)}`);
});

test('time sleep can be stopped by abort signal', async () => {
  const controller = new AbortController();
  const resultPromise = runIdyllium(`
    use console;
    use time;

    main() {
      console.write("start");
      time.sleep(5);
      console.write("end");
    }
  `, { abortSignal: controller.signal }, { file: 'main.idyl' });

  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  const result = await resultPromise;
  assert(!result.success, 'expected stopped program to fail');
  assert(result.output === 'start', `expected only streamed output before sleep, got ${result.output}`);
  assert(result.runtimeError?.includes('program was stopped') === true, `expected stopped runtime error, got ${result.runtimeError}`);
});

test('time stamp methods run', async () => {
  const result = await runIdyllium([
    'use console;',
    'use time;',
    '',
    'main() {',
    '    time.stamp birth = time.from_unix(946684800);',
    '    console.write(',
    '        birth, ":",',
    '        birth.year(), ":", birth.month(), ":", birth.day(), ":",',
    '        birth.hour(), ":", birth.minute(), ":", birth.second(), ":",',
    '        birth.week_day(), ":", birth.unix()',
    '    );',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '2000-01-01 00:00:00:2000:1:1:0:0:0:6:946684800',
    `unexpected time stamp output: ${JSON.stringify(result.output)}`,
  );
});

test('file streams read and write relative to source file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'Кирка\nМеч', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string first = fin.read_line();',
      '    string second = fin.read_line();',
      '    bool has_more = fin.has_next_line();',
      '    fin.close();',
      '',
      '    file.ostream fout = file.open("output.txt", "write");',
      '    fout.write_line(first);',
      '    fout.write_line(second, "\\n", "Готово");',
      '    fout.close();',
      '',
      '    console.write(first, second, ":", has_more, ":", file.exists("output.txt"));',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(result.output === 'Кирка\nМеч:false:true', `unexpected file stream output: ${JSON.stringify(result.output)}`);
    assert(fs.readFileSync(path.join(dir, 'output.txt'), 'utf8') === 'Кирка\nМеч\nГотово', 'unexpected written file content');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('file stream read_all reads remaining text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'one\ntwo\nthree', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string first = fin.read_line();',
      '    string rest = fin.read_all();',
      '    bool has_more = fin.has_next_line();',
      '    fin.close();',
      '    console.write(first, "|", rest, "|", has_more);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(result.output === 'one\n|two\nthree|false', `unexpected output: ${JSON.stringify(result.output)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('file read lines keep newline characters visible inside arrays', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'Кирка\nТопор\nМеч', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string line1 = fin.read_line();',
      '    string line2 = fin.read_line();',
      '    string line3 = fin.read_line();',
      '    fin.close();',
      '',
      '    array<string, 3> tools = [line1, line2, line3];',
      '    console.write(tools);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(
      result.output === '["Кирка\\n", "Топор\\n", "Меч"]',
      `unexpected inspected file lines: ${JSON.stringify(result.output)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json module parses validates and extracts values', async () => {
  const source = [
    'use console;',
    'use json;',
    '',
    'main() {',
    '    string text = "{\\"name\\":\\"Ada\\",\\"age\\":12,\\"active\\":true,\\"items\\":[1,\\"two\\",null],\\"address\\":{\\"city\\":\\"London\\"}}";',
    '    bool valid = json.is_valid(text);',
    '    json.Value root_value = json.parse(text);',
    '    json.Object root = root_value.to_object();',
    '    string name = root.get("name").to_string();',
    '    int age = root.get("age").to_int();',
    '    bool active = root.get("active").to_bool();',
    '    json.Array items = root.get("items").to_array();',
    '    string second = items.at(1).to_string();',
    '    bool third_is_null = items.at(2).is_null();',
    '    json.Object address = root.get("address").to_object();',
    '    console.write(valid, ":", name, ":", age, ":", active, ":", second, ":", third_is_null, ":", address.get("city").to_string());',
    '}',
  ].join('\n');

  const result = await runIdyllium(source);
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:Ada:12:true:two:true:London', `unexpected JSON output: ${JSON.stringify(result.output)}`);
});

test('json module creates serializes and writes values', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-json-'));
  const sourceFile = path.join(dir, 'main.idyl');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      'use json;',
      '',
      'main() {',
      '    json.Object root;',
      '    json.Value name("John Doe");',
      '    root.add("name", name);',
      '    root.add("wife", json.NULL);',
      '',
      '    if (root.has("wife")) {',
      '        root.set("wife", json.Value("Jane Doe"));',
      '    }',
      '',
      '    json.Array numbers;',
      '    numbers.add(json.Value(1));',
      '    numbers.add(json.Value("two"));',
      '    root.add("items", json.Value(numbers));',
      '',
      '    string compact = root.to_json();',
      '    string pretty = root.to_pretty_json();',
      '',
      '    file.ostream f = file.open("output.json", "write");',
      '    f.write_line(root.to_pretty_json(4));',
      '    f.close();',
      '',
      '    console.write(compact, "\\n", pretty);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(
      result.output === '{"name":"John Doe","wife":"Jane Doe","items":[1,"two"]}\n{\n  "name": "John Doe",\n  "wife": "Jane Doe",\n  "items": [\n    1,\n    "two"\n  ]\n}',
      `unexpected JSON serialization: ${JSON.stringify(result.output)}`,
    );
    assert(
      fs.readFileSync(path.join(dir, 'output.json'), 'utf8') === '{\n    "name": "John Doe",\n    "wife": "Jane Doe",\n    "items": [\n        1,\n        "two"\n    ]\n}',
      'unexpected JSON file content',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json module runtime errors are readable', async () => {
  await assertRuntimeFails([
    'use json;',
    '',
    'main() {',
    '    json.Value value = json.Value(42);',
    '    string text = value.to_string();',
    '}',
  ].join('\n'), 'main.idyl:5: runtime error: json value is number, expected string');

  await assertRuntimeFails([
    'use json;',
    '',
    'main() {',
    '    json.Array values;',
    '    values.add(json.Value(1));',
    '    values.at(3);',
    '}',
  ].join('\n'), 'main.idyl:6: runtime error: json array index 3 out of bounds (size 1, valid indices 0-0)');
});

test('file stream runtime errors are readable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'empty.txt'), '', 'utf8');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'Line', 'utf8');

  try {
    const pastEnd = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("empty.txt", "read");',
      '    string line = fin.read_line();',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!pastEnd.success, 'expected runtime failure');
    assert(pastEnd.runtimeError !== null, 'expected runtime error text');
    assert(
      pastEnd.runtimeError.includes(`${sourceFile}:5: runtime error: istream.read_line() cannot read past end of file`),
      `unexpected file runtime error: ${JSON.stringify(pastEnd.runtimeError)}`,
    );

    const readAfterClose = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    fin.close();',
      '    string line = fin.read_line();',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!readAfterClose.success, 'expected runtime failure');
    assert(readAfterClose.runtimeError !== null, 'expected runtime error text');
    assert(
      readAfterClose.runtimeError.includes(`${sourceFile}:6: runtime error: istream.read_line() cannot be used after close()`),
      `unexpected read-after-close error: ${JSON.stringify(readAfterClose.runtimeError)}`,
    );

    const writeAfterClose = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.ostream fout = file.open("output.txt", "write");',
      '    fout.close();',
      '    fout.write_line("Oops");',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!writeAfterClose.success, 'expected runtime failure');
    assert(writeAfterClose.runtimeError !== null, 'expected runtime error text');
    assert(
      writeAfterClose.runtimeError.includes(`${sourceFile}:6: runtime error: ostream.write_line() cannot be used after close()`),
      `unexpected write-after-close error: ${JSON.stringify(writeAfterClose.runtimeError)}`,
    );

    const badMode = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "append");',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!badMode.success, 'expected runtime failure');
    assert(badMode.runtimeError !== null, 'expected runtime error text');
    assert(
      badMode.runtimeError.includes(`${sourceFile}:4: runtime error: file.open() mode must be 'read' or 'write', got 'append'`),
      `unexpected bad mode error: ${JSON.stringify(badMode.runtimeError)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

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

test('browser runtime returns written virtual project files', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use file;',
        '',
        'main() {',
        '    file.ostream fout = file.open("output.txt", "write");',
        '    fout.write_line("Привет, мир!", \'\\n\');',
        '    fout.write_line("Файл создан с помощью Idyllium!");',
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

test('browser runtime snapshots drawable asset resource uris', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use colors;',
        'use drawable;',
        'use gui;',
        '',
        'main() {',
        '    gui.Window win;',
        '    gui.Image image;',
        '    image.load_from_file("cat.png");',
        '    image.resize_mode = "fill";',
        '    win.add_child(image);',
        '    win.show();',
        '',
        '    drawable.Font font;',
        '    font.load_from_file("lobster.ttf");',
        '',
        '    drawable.Text text;',
        '    text.font = font;',
        '    text.text = "123";',
        '    text.text_color = colors.WHITE;',
        '',
        '    gui.Canvas canvas;',
        '    canvas.draw(text);',
        '}',
      ].join('\n'),
      '/workspace/lobster.ttf': {
        content: '',
        resourceUri: 'blob:idyllium-font',
      },
      '/workspace/cat.png': {
        content: '',
        resourceUri: 'blob:idyllium-cat',
      },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const draw = result.canvases[0]?.commands.find((command) => command.kind === 'draw');
  const font = draw?.object?.properties.font as { properties?: Record<string, unknown> } | undefined;
  assert(font?.properties?.resource_uri === 'blob:idyllium-font', `expected font resource uri, got ${JSON.stringify(draw)}`);
  const image = result.windows[0]?.children.find((widget) => widget.type === 'gui.Image');
  assert(image?.properties.resource_uri === 'blob:idyllium-cat', `expected image resource uri, got ${JSON.stringify(image)}`);
  assert(image?.properties.resize_mode === 'fill', `expected image resize mode, got ${JSON.stringify(image)}`);
});

test('static and dynamic arrays run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<int, 3> nums = [10, 20, 30];
      nums[1] = 25;

      dyn_array<int> values = [1, 2];
      values.add(3);
      values.insert(1, 9);
      int removed = values.pop();
      values.remove_at(0);
      values.resize(4);

      console.write(nums[1], ":", nums.length(), ":", values, ":", removed);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '25:3:[9, 2, 0, 0]:3', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('arrays quote and escape string values', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<string, 3> tools = ["Кирка\\n", "Топор\\n", "Меч"];
      console.write(tools, ":", "Кирка\\n");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '["Кирка\\n", "Топор\\n", "Меч"]:Кирка\n',
    `unexpected escaped array output: ${JSON.stringify(result.output)}`,
  );
});

test('array aggregate functions run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<int, 4> nums = [10, 5, 8, 12];
      dyn_array<float> vals = [1.5, 2.0, 3.5];

      console.write(max(nums), " ", sum(nums), " ", avg(nums), " ", max(vals));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '12 35 8.75 3.5', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('array diagnostics are readable', () => {
  assertFails(`
    main() {
      dyn_array<int> arr = [1, 2, 3];
      int value = arr[1.5];
    }
  `, 'array index must be integer');

  assertFails(`
    main() {
      array<int, 2> arr = [1, 2];
      arr.add(3);
    }
  `, "only available on 'dyn_array'");

  assertFails(`
    main() {
      array<string, 2> words = ["кот", "собака"];
      string word = max(words);
    }
  `, "expects a numeric array");
});

test('array out of bounds runtime error is readable', async () => {
  const source = [
    'use console;',
    '',
    'main() {',
    '    dyn_array<int> arr = [44, 35, 122];',
    '    console.write(arr[5]);',
    '}',
  ].join('\n');

  const result = await runIdyllium(source, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected runtime failure');
  assert(
    result.runtimeError === 'main.idyl:5: runtime error: array index 5 out of bounds (size 3, valid indices 0-2)',
    `unexpected runtime error: ${JSON.stringify(result.runtimeError)}`,
  );
});

test('string methods and character indexing run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      string bird = "Гусь";
      string word = "Привет";
      string data = "яблоко,банан,апельсин";
      dyn_array<string> fruits = data.split(",");

      console.write(
        bird.length(), ":", bird[2], ":",
        word.to_upper(), ":", word.to_lower(), ":",
        "Кот и кот и ещё кот".replace("кот", "пёс"), ":",
        "aBcDeFgHiJk".substring(1, 3), ":",
        "абракадабра".count("абра"), ":",
        "Кот и собака".find("собака"), ":",
        "Hello".contains('e'), ":",
        "123".is_int(), ":", "12.5".is_float(), ":",
        fruits
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '4:с:ПРИВЕТ:привет:Кот и пёс и ещё пёс:BcD:2:6:true:true:true:["яблоко", "банан", "апельсин"]',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('string indexing errors are readable', async () => {
  const source = [
    'use console;',
    '',
    'main() {',
    '    string p = "Гусь";',
    '    console.write(p[4]);',
    '}',
  ].join('\n');

  const result = await runIdyllium(source, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected runtime failure');
  assert(
    result.runtimeError === 'main.idyl:5: runtime error: string index 4 out of bounds (length 4, valid indices 0-3)',
    `unexpected runtime error: ${JSON.stringify(result.runtimeError)}`,
  );
});

test('string characters are read-only', () => {
  assertFails(`
    main() {
      string text = "abc";
      text[0] = 'x';
    }
  `, 'string characters are read-only');
});

test('console input works inside initializers', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      string name = console.get_string();
      console.write("Hello, ", name);
    }
  `, { input: ['Ada'] });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Hello, Ada', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('console numeric input errors are readable', async () => {
  const intResult = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    int age = console.get_int();',
    '}',
  ].join('\n'), { input: ['fgf'] }, { file: 'main.idyl' });

  assert(!intResult.success, 'expected int input runtime failure');
  assert(
    intResult.runtimeError === 'main.idyl:4: runtime error: cannot convert input to \'int\' (expected integer, got "fgf")',
    `unexpected runtime error: ${JSON.stringify(intResult.runtimeError)}`,
  );

  const floatResult = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    float temp = console.get_float();',
    '}',
  ].join('\n'), { input: ['erter'] }, { file: 'main.idyl' });

  assert(!floatResult.success, 'expected float input runtime failure');
  assert(
    floatResult.runtimeError === 'main.idyl:4: runtime error: cannot convert input to \'float\' (expected number, got "erter")',
    `unexpected runtime error: ${JSON.stringify(floatResult.runtimeError)}`,
  );
});

test('encoding helpers run and report readable errors', async () => {
  const result = await runIdyllium(`
    use console;
    use encoding;

    main() {
      dyn_array<int> ascii = encoding.encode("Hi", "ascii");
      dyn_array<int> win = encoding.encode("Ёж", "windows-1251");
      dyn_array<int> koi = encoding.encode("Ёж", "koi8-r");
      string text = encoding.decode([72, 101, 108, 108, 111], "ascii");
      string roundtrip = encoding.decode(encoding.encode("Привет", "windows-1251"), "windows-1251");

      console.write(
        encoding.char_to_int('A', "utf-8"), ":",
        encoding.char_to_int('Я', "windows-1251"), ":",
        encoding.char_to_int('Я', "koi8-r"), ":",
        encoding.int_to_char(192, "windows-1251"), ":",
        ascii, ":", win, ":", koi, ":",
        text, ":", roundtrip
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '65:223:241:А:[72, 105]:[168, 230]:[179, 214]:Hello:Привет',
    `unexpected encoding output: ${JSON.stringify(result.output)}`,
  );

  await assertRuntimeFails(`
    use encoding;

    main() {
      int code = encoding.char_to_int('Ю', "ascii");
    }
  `, "character 'Ю' is not valid ASCII");

  await assertRuntimeFails(`
    use encoding;

    main() {
      int code = encoding.char_to_int('A', "cp866");
    }
  `, "unknown encoding 'cp866'");
});

test('types integer values wrap at typed boundaries', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    void function take(types.int8 arg) {
      console.write(arg);
    }

    types.uint8 function wrap_return(int value) {
      return value;
    }

    main() {
      types.uint8 n = 253;
      n = n + 1;
      n = n + 1;
      n = n + 1;

      types.uint8 k = -11;
      types.uint8 m = 260;

      types.uint8 a = 200;
      types.uint16 b = 65500;
      types.uint16 c = a + b;
      types.uint8 d = b - a;
      int plain = a + 10;

      dyn_array<types.uint8> values = [250];
      values.add(260);
      values[0] += 10;

      console.write(n, ":", k, ":", m, ":", c, ":", d, ":", plain, ":", values, ":", wrap_return(260), ":");
      int value = 130;
      take(value);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '0:245:4:164:20:210:[4, 4]:4:-126', `unexpected types output: ${JSON.stringify(result.output)}`);
});

test('types binary and hexadecimal helpers run', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 u = 221;
      types.int8 s = -35;
      types.uint8 from_bin_u = types.from_bin("10100011", "uint8");
      types.int8 from_bin_s = types.from_bin("10100011", "int8");
      types.uint8 from_hex_u = types.from_hex("A3", "uint8");
      types.int8 from_hex_s = types.from_hex("A3", "int8");

      console.write(
        u.to_bin(), ":", s.to_bin(), ":",
        u.to_hex(), ":", s.to_hex(), ":",
        from_bin_u, ":", from_bin_s, ":",
        from_hex_u, ":", from_hex_s
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '11011101:11011101:DD:DD:163:-93:163:-93', `unexpected types bits output: ${JSON.stringify(result.output)}`);
});

test('types float32 and float64 preserve different precision', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      console.set_precision(25);
      types.float32 a = 0.1 + 0.2;
      types.float64 b = 0.1 + 0.2;
      console.write(a, ":", b);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '0.30000001192092896:0.30000000000000004',
    `unexpected float types output: ${JSON.stringify(result.output)}`,
  );
});

test('types integer values reject implicit float assignment', () => {
  assertFails(`
    use types;

    main() {
      types.uint8 n = 1.5;
    }
  `, "cannot assign 'float' value to 'types.uint8' variable");
});

test('types integer values accept explicit to_int conversion from float', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 n = to_int(260.9);
      console.write(n);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '4', `unexpected explicit to_int output: ${JSON.stringify(result.output)}`);
});

test('colors factories produce Color values', async () => {
  const result = await runIdyllium(`
    use console;
    use colors;

    main() {
      colors.Color first = colors.RGB(34, 145, 188);
      colors.Color second = colors.HEX("#2291bc");
      colors.Color transparent;

      console.write(first, '\\n', second, '\\n', transparent);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '#2291bc\n#2291bc\nrgba(0, 0, 0, 0)',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('colors constants are Color values', async () => {
  const result = await runIdyllium(`
    use console;
    use colors;

    main() {
      colors.Color text = colors.WHITE;
      console.write(text);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '#ffffff', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('colors.Color is a strict value type', () => {
  assertFails(`
    use colors;

    main() {
      colors.Color c = "#2291bc";
    }
  `, "cannot assign 'string' value to 'colors.Color'");

  assertFails(`
    main() {
      colors.Color c = colors.RGB(34, 145, 188);
    }
  `, "is not imported");
});

test('while and do-while loops run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      int count = 1;
      while (count <= 3) {
        console.write(count);
        count = count + 1;
      }

      int guess = 0;
      do {
        guess = guess + 1;
      } while (guess < 2);

      console.write(":", guess);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '123:2', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('for loop with break and continue runs', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      for (int i = 1; i <= 5; i = i + 1) {
        if (i == 2) {
          continue;
        }
        if (i == 5) {
          break;
        }
        console.write(i);
      }
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '134', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('functions return values', async () => {
  const result = await runIdyllium(`
    use console;

    int function modul_chisla(int chislo) {
      int res = chislo;
      if (chislo < 0) {
        res = -chislo;
      }
      return res;
    }

    main() {
      console.write(modul_chisla(-23), " ", modul_chisla(-40));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '23 40', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('recursive functions run', async () => {
  const result = await runIdyllium(`
    use console;

    int function factorial(int n) {
      if (n <= 1) {
        return 1;
      }
      return n * factorial(n - 1);
    }

    int function sum_to(int n) {
      if (n <= 1) {
        return n;
      }
      return n + sum_to(n - 1);
    }

    main() {
      console.write(factorial(5), ":", sum_to(5));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '120:15', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user classes fields methods this and constructors run', async () => {
  const result = await runIdyllium(`
    use console;

    class Cat {
      string name;

      constructor Cat(string ex_name) {
        this.name = ex_name;
      }

      void function meow() {
        console.writeln(this.name, " мяукнул!");
      }

      string function to_string() {
        return "Cat(" + this.name + ")";
      }
    }

    main() {
      Cat cat1("Барсик");
      Cat cat2("Мурка");
      cat1.meow();
      cat2.meow();
      console.writeln(cat1);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Барсик мяукнул!\nМурка мяукнул!\nCat(Барсик)\n', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user class diagnostics are readable', () => {
  assertFails(`
    class Cat {
      string name;
      void function meow() {}
    }

    main() {
      Cat.meow();
      string n = Cat.name;
    }
  `, "instance method 'Cat.meow' must be called on an object");

  assertFails(`
    class Animal {
      constructor Animal(string name) {}
    }

    main() {
      Animal animal(42);
    }
  `, "'Animal' argument 1 expects 'string', got 'int'");
});

test('inheritance parent constructors and polymorphic dispatch run', async () => {
  const result = await runIdyllium(`
    use console;

    class Animal {
      string name;

      constructor Animal(string ex_name) {
        this.name = ex_name;
      }

      void function speak() {
        console.writeln("...");
      }
    }

    class Dog extends Animal {
      constructor Dog(string ex_name) {
        parent(ex_name);
      }

      void function speak() {
        console.writeln(this.name, " гавкнул");
      }
    }

    main() {
      Dog dog("Рекс");
      Animal animal = dog;
      animal.speak();
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Рекс гавкнул\n', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user function parameters accept subclass objects', async () => {
  const result = await runIdyllium(`
    use console;

    class Animal {
      string name;

      constructor Animal(string ex_name) {
        this.name = ex_name;
      }

      void function speak() {
        console.writeln("...");
      }
    }

    class Cat extends Animal {
      constructor Cat(string ex_name) {
        parent(ex_name);
      }

      void function speak() {
        console.writeln(this.name, " мяукнул");
      }
    }

    void function ask_to_speak(Animal animal) {
      animal.speak();
    }

    main() {
      Cat cat("Барсик");
      ask_to_speak(cat);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Барсик мяукнул\n', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('private class members are available only inside owner class', async () => {
  const result = await runIdyllium(`
    use console;

    class Hero {
      private:
      int hp;

      void function clamp_hp() {
        if (this.hp > 100) {
          this.hp = 100;
        }
      }

      public:
      string name;

      constructor Hero(string ex_name, int ex_hp) {
        this.name = ex_name;
        this.hp = ex_hp;
        this.clamp_hp();
      }

      void function heal(int amount) {
        this.hp += amount;
        this.clamp_hp();
      }

      int function get_hp() {
        return this.hp;
      }
    }

    main() {
      Hero hero("Воин", 40);
      hero.heal(75);
      console.write(hero.name, ":", hero.get_hp());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Воин:100', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(`
    class BankAccount {
      private:
      int balance;
    }

    main() {
      BankAccount acc;
      acc.balance = 1000;
    }
  `, "member 'BankAccount.balance' is private and can only be used inside class 'BankAccount'");

  assertFails(`
    class Hero {
      private:
      void function secret() {}
    }

    main() {
      Hero hero;
      hero.secret();
    }
  `, "member 'Hero.secret' is private and can only be used inside class 'Hero'");

  assertFails(`
    class Animal {
      private:
      int age;
    }

    class Dog extends Animal {
      public:
      void function grow() {
        this.age += 1;
      }
    }
  `, "member 'Animal.age' is private and can only be used inside class 'Animal'");
});

test('static method diagnostics are readable', () => {
  assertFails(`
    use console;

    class Cat {
      string name;

      static void function meow() {
        console.writeln(this.name);
      }
    }
  `, "'this' cannot be used in a static method");

  assertFails(`
    class MathUtils {
      static int function square(int x) {
        return x * x;
      }
    }

    main() {
      MathUtils m;
      int y = m.square(5);
    }
  `, "static method 'MathUtils.square' must be called on class 'MathUtils'");
});

test('user modules expose functions and classes across files', async () => {
  const result = await runIdyllium(`
    use console;
    use math_tools;
    use rect;

    main() {
      rect.Rect r;
      r.width = 20;
      r.height = 30;
      console.write(math_tools.square(5), ":", r.getArea());
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function square(int x) {
          return x * x;
        }
      `,
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

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '25:600', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user module diagnostics are checked across files', () => {
  const badArgument = compileIdyllium(`
    use math_tools;

    main() {
      int value = math_tools.square("5");
    }
  `, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function square(int x) {
          return x * x;
        }
      `,
    },
  });

  assert(!badArgument.success, 'expected module argument type failure');
  assert(
    badArgument.diagnosticsText.includes("'square' argument 1 expects 'int', got 'string'"),
    `unexpected diagnostics:\n${badArgument.diagnosticsText}`,
  );

  const cycle = compileIdyllium(`
    use a;

    main() {}
  `, {
    file: 'main.idyl',
    sources: {
      'a.idyl': 'use b;',
      'b.idyl': 'use a;',
    },
  });

  assert(!cycle.success, 'expected module cycle failure');
  assert(cycle.diagnosticsText.includes('module import cycle detected: a -> b -> a'), `unexpected diagnostics:\n${cycle.diagnosticsText}`);
});

test('constructor calls are not expressions', () => {
  assertFails(`
    class Animal {
      string name;
    }

    class Dog extends Animal {}

    main() {
      Animal animal = Dog("Рекс");
    }
  `, "class 'Dog' cannot be called as a function");
});

test('inline callback functions compile and run in headless gui runtime', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    main() {
      gui.Button btn;
      btn.text = "Start";
      int clicks = 0;

      btn.on_click = void function(gui.Button sender) {
        clicks += 1;
        sender.text = to_string(clicks);
      };

      console.write(btn.text);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Start', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('named functions can be assigned as gui and canvas callbacks', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    void function on_click(gui.Button sender) {
      sender.text = "Clicked";
    }

    void function on_update(gui.Canvas canvas, float delta_time) {
      canvas.clear();
    }

    main() {
      gui.Button btn;
      gui.Canvas canvas;

      btn.on_click = on_click;
      canvas.on_update = on_update;

      console.write("callbacks");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'callbacks', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('gui widget registry covers lesson widgets in headless runtime', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    main() {
      gui.Window win;
      gui.SpinBox spin;
      gui.FloatSpinBox fspin;
      gui.Slider slider;
      gui.CheckBox cb;
      gui.RadioButton rb;
      gui.ComboBox combo;
      gui.Frame frame;
      gui.Image image;
      gui.Modal modal;

      image.resize_mode = "fit";

      spin.value = 5;
      spin.min = 0;
      spin.max = 10;
      spin.step = 1;
      spin.on_change = void function() {};

      fspin.value = 0.5;
      fspin.step = 0.1;

      slider.value = 50;
      slider.visible = true;

      cb.text = "Agree";
      cb.is_checked = true;
      rb.text = "Choice";
      rb.group = "A";
      rb.is_selected = true;

      combo.add_item("One");
      combo.add_item("Two");
      combo.selected_index = 1;
      combo.on_change = void function() {};

      frame.title = "Group";
      frame.add_child(spin);
      modal.title = "Hello";
      modal.message = "World";
      modal.confirm_text = "OK";
      modal.cancel_text = "Cancel";
      modal.on_confirm = void function(gui.Modal sender) {};
      modal.show_alert();

      win.add_child(frame);
      win.add_child(image);
      win.add_child(combo);
      console.write(spin.value, ":", fspin.value, ":", slider.value, ":", cb.is_checked, ":", rb.is_selected, ":", image.resize_mode, ":", modal.get_input_value());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '5:0.5:50:true:true:fit:', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('gui widgets have useful default sizes', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Label label;
      gui.Button button;
      gui.LineEdit line;
      gui.TextEdit text;
      gui.ProgressBar progress;
      gui.SpinBox spin;
      gui.FloatSpinBox float_spin;
      gui.Slider slider;
      gui.CheckBox checkbox;
      gui.RadioButton radio;
      gui.ComboBox combo;
      gui.Frame frame;
      gui.Canvas canvas;
      gui.Image image;

      win.add_child(label);
      win.add_child(button);
      win.add_child(line);
      win.add_child(text);
      win.add_child(progress);
      win.add_child(spin);
      win.add_child(float_spin);
      win.add_child(slider);
      win.add_child(checkbox);
      win.add_child(radio);
      win.add_child(combo);
      win.add_child(frame);
      win.add_child(canvas);
      win.add_child(image);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  assert(window.properties.width === 640 && window.properties.height === 420, `unexpected default window size: ${JSON.stringify(window.properties)}`);

  const sizes = new Map(window.children.map((widget) => [
    widget.type,
    [widget.properties.width, widget.properties.height],
  ]));

  assert(JSON.stringify(sizes.get('gui.Label')) === JSON.stringify([120, 24]), 'expected default Label size');
  assert(JSON.stringify(sizes.get('gui.Button')) === JSON.stringify([120, 32]), 'expected default Button size');
  assert(JSON.stringify(sizes.get('gui.LineEdit')) === JSON.stringify([180, 28]), 'expected default LineEdit size');
  assert(JSON.stringify(sizes.get('gui.TextEdit')) === JSON.stringify([240, 120]), 'expected default TextEdit size');
  assert(JSON.stringify(sizes.get('gui.ProgressBar')) === JSON.stringify([200, 24]), 'expected default ProgressBar size');
  assert(JSON.stringify(sizes.get('gui.SpinBox')) === JSON.stringify([100, 28]), 'expected default SpinBox size');
  assert(JSON.stringify(sizes.get('gui.FloatSpinBox')) === JSON.stringify([120, 28]), 'expected default FloatSpinBox size');
  assert(JSON.stringify(sizes.get('gui.Slider')) === JSON.stringify([200, 28]), 'expected default Slider size');
  assert(JSON.stringify(sizes.get('gui.CheckBox')) === JSON.stringify([180, 24]), 'expected default CheckBox size');
  assert(JSON.stringify(sizes.get('gui.RadioButton')) === JSON.stringify([180, 24]), 'expected default RadioButton size');
  assert(JSON.stringify(sizes.get('gui.ComboBox')) === JSON.stringify([180, 30]), 'expected default ComboBox size');
  assert(JSON.stringify(sizes.get('gui.Frame')) === JSON.stringify([220, 140]), 'expected default Frame size');
  assert(JSON.stringify(sizes.get('gui.Canvas')) === JSON.stringify([300, 150]), 'expected default Canvas size');
  assert(JSON.stringify(sizes.get('gui.Image')) === JSON.stringify([160, 120]), 'expected default Image size');
});

test('progress bar exposes text background and foreground colors', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;
    use colors;

    main() {
      gui.Window win;
      gui.ProgressBar progress;
      progress.value = 65;
      progress.text_color = colors.RGB(102, 14, 28);
      progress.background_color = colors.RGB(255, 232, 236);
      progress.foreground_color = colors.RGB(248, 150, 165);
      win.add_child(progress);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  const progress = window.children.find((widget) => widget.type === 'gui.ProgressBar');

  assert(progress !== undefined, 'expected ProgressBar widget');
  assert(progress?.properties.text_color === '#660e1c', `unexpected ProgressBar text color: ${JSON.stringify(progress)}`);
  assert(progress?.properties.background_color === '#ffe8ec', `unexpected ProgressBar background color: ${JSON.stringify(progress)}`);
  assert(progress?.properties.foreground_color === '#f896a5', `unexpected ProgressBar foreground color: ${JSON.stringify(progress)}`);
  assert(explicitProperties(progress.properties).includes('text_color'), 'expected ProgressBar text_color to be explicit');
  assert(explicitProperties(progress.properties).includes('background_color'), 'expected ProgressBar background_color to be explicit');
  assert(explicitProperties(progress.properties).includes('foreground_color'), 'expected ProgressBar foreground_color to be explicit');
  assert(!explicitProperties(progress.properties).includes('fill_color'), 'expected legacy fill_color to remain default');
});

test('gui color inheritance metadata tracks explicit widget colors', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;
    use colors;

    main() {
      gui.Window win;
      win.text_color = colors.RED;

      gui.Label root_label;
      root_label.text = "red by inheritance";

      gui.Frame frame;
      frame.text_color = colors.GREEN;

      gui.Label inherited_label;
      inherited_label.text = "green by inheritance";

      gui.Label black_label;
      black_label.text = "black explicitly";
      black_label.text_color = colors.BLACK;

      frame.add_child(inherited_label);
      frame.add_child(black_label);
      win.add_child(root_label);
      win.add_child(frame);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  const rootLabel = window.children.find((widget) => widget.type === 'gui.Label');
  const frame = window.children.find((widget) => widget.type === 'gui.Frame');
  const inheritedLabel = frame?.children.find((widget) => widget.properties.text === 'green by inheritance');
  const blackLabel = frame?.children.find((widget) => widget.properties.text === 'black explicitly');

  assert(window.properties.text_color === '#ff0000', `unexpected window text color: ${JSON.stringify(window.properties)}`);
  assert(explicitProperties(window.properties).includes('text_color'), 'expected window text_color to be explicit');
  assert(rootLabel?.properties.text_color === '#000000', `unexpected root label default color: ${JSON.stringify(rootLabel)}`);
  assert(!explicitProperties(rootLabel.properties).includes('text_color'), 'expected root label text_color to be default, not explicit');
  assert(frame?.properties.text_color === '#00ff00', `unexpected frame text color: ${JSON.stringify(frame)}`);
  assert(explicitProperties(frame.properties).includes('text_color'), 'expected frame text_color to be explicit');
  assert(inheritedLabel?.properties.text_color === '#000000', `unexpected inherited label default color: ${JSON.stringify(inheritedLabel)}`);
  assert(!explicitProperties(inheritedLabel.properties).includes('text_color'), 'expected inherited label text_color to be default, not explicit');
  assert(blackLabel?.properties.text_color === '#000000', `unexpected explicit black label color: ${JSON.stringify(blackLabel)}`);
  assert(explicitProperties(blackLabel.properties).includes('text_color'), 'expected black label text_color to be explicit');
});

test('callback function body diagnostics are checked', () => {
  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.on_click = void function(gui.Button sender) {
        sender.unknown_property = "nope";
      };
    }
  `, "has no property 'unknown_property'");
});

test('callback signatures are checked', () => {
  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.on_click = void function(gui.Label sender) {
        sender.text = "wrong";
      };
    }
  `, "callback property 'on_click' expects function(): void or function(gui.Button): void");
});

test('gui widget polymorphism works for variables callbacks and add_child', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    void function move_left(gui.Widget widget) {
      widget.x = 12;
    }

    main() {
      gui.Window win;
      gui.Button btn;
      gui.Label label;

      btn.x = 7;
      btn.on_click = void function(gui.Widget sender) {
        sender.y = 34;
      };

      gui.Widget current = btn;
      move_left(label);
      win.add_child(btn);
      win.add_child(label);
      console.write(current.x, ":", label.x);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '7:12', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('add_child accepts widgets but rejects modal dialogs', () => {
  assertCompiles(`
    use gui;

    main() {
      gui.Window win;
      gui.Frame frame;
      gui.Button btn;

      frame.add_child(btn);
      win.add_child(frame);
    }
  `);

  assertFails(`
    use gui;

    main() {
      gui.Window win;
      gui.Modal modal;
      win.add_child(modal);
    }
  `, "'add_child' argument 1 expects gui widget, got 'gui.Modal'");
});

test('canvas draw accepts drawable objects only', () => {
  assertCompiles(`
    use gui;
    use drawable;

    main() {
      gui.Canvas canvas;
      drawable.Rectangle rect;
      drawable.Circle circle;
      drawable.Line line;
      drawable.Sprite sprite;
      drawable.Text text;

      canvas.draw(rect);
      canvas.draw(circle);
      canvas.draw(line);
      canvas.draw(sprite);
      canvas.draw(text);
    }
  `);

  assertFails(`
    use gui;
    use drawable;

    main() {
      gui.Canvas canvas;
      drawable.Texture texture;
      canvas.draw(texture);
    }
  `, "'draw' argument 1 expects drawable object, got 'drawable.Texture'");
});

test('headless canvas records drawable commands', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use console;
    use drawable;
    use gui;

    main() {
      gui.Canvas canvas;
      canvas.width = 320;
      canvas.height = 200;

      drawable.Rectangle rect;
      rect.x = 10;
      rect.y = 20;
      rect.width = 30;
      rect.height = 40;
      rect.fill_color = colors.RGB(34, 145, 188);
      rect.move(5, -5);
      rect.rotate(15);
      rect.rotate(5);

      drawable.Circle circle;
      circle.x = 50;
      circle.y = 60;
      circle.radius = 15;
      circle.border_color = colors.RED;
      circle.move(-10, 5);

      drawable.Line line;
      line.x1 = 1;
      line.y1 = 2;
      line.x2 = 90;
      line.y2 = 30;
      line.color = colors.GREEN;
      line.thickness = 4;
      line.move(3, 4);

      drawable.Sprite sprite;
      sprite.x = 100;
      sprite.y = 120;
      sprite.set_scale(0.5, 2.0);
      sprite.move(5, -10);

      drawable.Text text;
      text.text = "Score";
      text.x = 7;
      text.y = 8;
      text.text_color = colors.WHITE;
      text.move(2, 3);

      canvas.clear();
      canvas.fill(colors.RGB(1, 2, 3));
      canvas.draw(rect);
      canvas.draw(circle);
      canvas.draw(line);
      canvas.draw(sprite);
      canvas.draw(text);

      console.write(canvas);
    }
  `);

  assert(result.runtime.getOutput() === 'gui.Canvas(commands: 7)', `unexpected canvas output: ${JSON.stringify(result.runtime.getOutput())}`);
  const canvases = result.runtime.getCanvases();
  assert(canvases.length === 1, `expected one canvas, got ${canvases.length}`);
  const canvas = canvases[0];
  assert(canvas.properties.width === 320 && canvas.properties.height === 200, `unexpected canvas properties: ${JSON.stringify(canvas.properties)}`);
  assert(canvas.commands.length === 7, `expected 7 canvas commands, got ${canvas.commands.length}`);
  assert(canvas.commands[0].kind === 'clear' && canvas.commands[0].color === '#000000', 'expected black clear command');
  assert(canvas.commands[1].kind === 'fill' && canvas.commands[1].color === '#010203', 'expected fill command color');
  assert(canvas.commands[2].object?.type === 'drawable.Rectangle', `unexpected first draw object: ${JSON.stringify(canvas.commands[2])}`);
  assert(canvas.commands[2].object?.properties.fill_color === '#2291bc', 'expected rectangle fill color snapshot');
  assert(canvas.commands[2].object?.properties.x === 15 && canvas.commands[2].object?.properties.y === 15, 'expected moved rectangle position');
  assert(canvas.commands[2].object?.properties.rotation === 20, 'expected rectangle rotation snapshot');
  assert(canvas.commands[3].object?.type === 'drawable.Circle', `unexpected second draw object: ${JSON.stringify(canvas.commands[3])}`);
  assert(canvas.commands[3].object?.properties.x === 40 && canvas.commands[3].object?.properties.y === 65, 'expected moved circle position');
  assert(canvas.commands[4].object?.type === 'drawable.Line', `unexpected third draw object: ${JSON.stringify(canvas.commands[4])}`);
  assert(canvas.commands[4].object?.properties.color === '#00ff00', 'expected line color snapshot');
  assert(canvas.commands[4].object?.properties.thickness === 4, 'expected line thickness snapshot');
  assert(canvas.commands[4].object?.properties.x1 === 4 && canvas.commands[4].object?.properties.y1 === 6, 'expected moved line start');
  assert(canvas.commands[4].object?.properties.x2 === 93 && canvas.commands[4].object?.properties.y2 === 34, 'expected moved line end');
  assert(canvas.commands[5].object?.properties.x === 105 && canvas.commands[5].object?.properties.y === 110, 'expected moved sprite position');
  assert(canvas.commands[5].object?.properties.scale_x === 0.5 && canvas.commands[5].object?.properties.scale_y === 2, 'expected sprite scale');
  assert(canvas.commands[6].object?.properties.text === 'Score', 'expected text snapshot');
  assert(canvas.commands[6].object?.properties.x === 9 && canvas.commands[6].object?.properties.y === 11, 'expected moved text position');
});

test('gui window show initializes canvas callbacks and snapshots widget tree', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    void function init(gui.Canvas canvas) {
      canvas.fill(colors.RGB(10, 20, 30));
    }

    void function update(gui.Canvas canvas, float delta_time) {
      drawable.Rectangle rect;
      rect.x = 4;
      rect.y = 5;
      rect.width = 6;
      rect.height = 7;
      rect.fill_color = colors.GREEN;
      canvas.draw(rect);
    }

    main() {
      gui.Window win;
      win.width = 200;
      win.height = 120;
      win.title = "Canvas window";

      gui.Frame frame;
      frame.x = 10;
      frame.y = 20;

      gui.Canvas canvas;
      canvas.width = 100;
      canvas.height = 80;
      canvas.on_init = init;
      canvas.on_update = update;

      frame.add_child(canvas);
      win.add_child(frame);
      win.show();
    }
  `);

  const windows = result.runtime.getWindows();
  assert(windows.length === 1, `expected one window, got ${windows.length}`);
  assert(windows[0].properties.title === 'Canvas window', `unexpected window snapshot: ${JSON.stringify(windows[0])}`);
  assert(windows[0].children[0].type === 'gui.Frame', `expected frame child, got ${windows[0].children[0]?.type}`);
  const canvas = windows[0].children[0].children[0].canvas;
  assert(canvas !== undefined, 'expected canvas snapshot inside frame');
  assert(canvas.commands.length === 2, `expected init fill and first update draw, got ${canvas.commands.length}`);
  assert(canvas.commands[0].kind === 'fill' && canvas.commands[0].color === '#0a141e', 'expected init fill command');
  assert(canvas.commands[1].object?.type === 'drawable.Rectangle', `expected update rectangle draw, got ${JSON.stringify(canvas.commands[1])}`);
});

test('gui step keeps static canvas commands when no update callback exists', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    main() {
      gui.Canvas canvas;
      drawable.Rectangle rect;
      rect.x = 10;
      rect.y = 20;
      rect.width = 30;
      rect.height = 40;
      rect.fill_color = colors.BLUE;
      canvas.draw(rect);
    }
  `);

  await result.runtime.stepGui(0.016);
  const canvas = result.runtime.getCanvases()[0];
  assert(canvas.commands.length === 1, `expected static draw command to remain, got ${canvas.commands.length}`);
  assert(canvas.commands[0].object?.properties.x === 10, `unexpected static canvas snapshot: ${JSON.stringify(canvas)}`);
});

test('gui canvas events update state and next frame snapshot', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    drawable.Rectangle player;

    void function init(gui.Canvas canvas) {
      player.x = 10;
      player.y = 20;
      player.width = 30;
      player.height = 40;
      player.fill_color = colors.WHITE;
    }

    void function on_key_pressed(gui.Canvas canvas, gui.KeyboardEvent e) {
      if (e.key == "D") {
        player.x += 5;
      }
    }

    void function on_mouse_scroll(gui.Canvas canvas, gui.MouseScrollEvent e) {
      player.y += e.delta;
    }

    void function update(gui.Canvas canvas, float delta_time) {
      canvas.clear();
      canvas.draw(player);
    }

    main() {
      gui.Window win;
      gui.Canvas canvas;
      canvas.on_init = init;
      canvas.on_key_pressed = on_key_pressed;
      canvas.on_mouse_scroll = on_mouse_scroll;
      canvas.on_update = update;
      win.add_child(canvas);
      win.show();
    }
  `);

  const canvasId = result.runtime.getCanvases()[0]?.id;
  assert(typeof canvasId === 'number', 'expected canvas id');

  let draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.x === 10 && draw.object.properties.y === 20, `unexpected initial draw snapshot: ${JSON.stringify(draw)}`);

  await result.runtime.dispatchGuiEvent(canvasId, 'key_pressed', { key: 'D' });
  await result.runtime.stepGui(0.016);
  draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.x === 15, `expected key event to move player, got ${JSON.stringify(draw)}`);

  await result.runtime.dispatchGuiEvent(canvasId, 'mouse_scroll', { x: 3, y: 4, delta: -2 });
  await result.runtime.stepGui(0.016);
  draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.y === 18, `expected mouse scroll to move player, got ${JSON.stringify(draw)}`);
});

test('gui widget events update properties and callbacks', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;

      gui.Label status;
      status.text = "ready";

      gui.Button btn;
      btn.text = "press";
      btn.on_click = void function(gui.Button sender) {
        sender.text = "pressed";
        status.text = "button";
      };

      gui.LineEdit input;
      input.on_change = void function() {
        status.text = input.text;
      };

      gui.Slider slider;
      slider.min = 0;
      slider.max = 10;
      slider.value = 3;
      slider.on_change = void function() {
        status.text = "slider:" + to_string(slider.value);
      };

      gui.CheckBox cb;
      cb.text = "yes";
      cb.on_change = void function() {
        if (cb.is_checked) {
          status.text = "checked";
        } else {
          status.text = "unchecked";
        }
      };

      gui.RadioButton rb1;
      rb1.text = "A";
      rb1.is_selected = true;
      gui.RadioButton rb2;
      rb2.text = "B";
      rb2.on_change = void function() {
        status.text = "radio:" + rb2.text;
      };

      gui.ComboBox combo;
      combo.add_item("Red");
      combo.add_item("Green");
      combo.add_item("Blue");
      combo.on_change = void function() {
        status.text = "combo:" + combo.selected_text;
      };

      win.add_child(status);
      win.add_child(btn);
      win.add_child(input);
      win.add_child(slider);
      win.add_child(cb);
      win.add_child(rb1);
      win.add_child(rb2);
      win.add_child(combo);
      win.show();
    }
  `);

  const widget = (type: string, text?: string) => {
    const found = result.runtime.getWindows()[0].children.find((item) => (
      item.type === type && (text === undefined || item.properties.text === text)
    ));
    assert(found !== undefined, `expected widget ${type} ${text ?? ''}`);
    return found;
  };
  const status = () => widget('gui.Label');

  await result.runtime.dispatchGuiEvent(widget('gui.Button').id, 'click', {});
  assert(widget('gui.Button').properties.text === 'pressed', 'expected button callback to mutate sender');
  assert(status().properties.text === 'button', `unexpected status after button: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.LineEdit').id, 'change', { text: 'Ada' });
  assert(widget('gui.LineEdit').properties.text === 'Ada', 'expected LineEdit text to update');
  assert(status().properties.text === 'Ada', `unexpected status after input: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.Slider').id, 'change', { value: 7 });
  assert(widget('gui.Slider').properties.value === 7, 'expected Slider value to update');
  assert(status().properties.text === 'slider:7', `unexpected status after slider: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.CheckBox').id, 'change', { is_checked: true });
  assert(widget('gui.CheckBox').properties.is_checked === true, 'expected CheckBox state to update');
  assert(status().properties.text === 'checked', `unexpected status after checkbox: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.RadioButton', 'B').id, 'change', { is_selected: true });
  assert(widget('gui.RadioButton', 'A').properties.is_selected === false, 'expected default radio group to unselect sibling');
  assert(widget('gui.RadioButton', 'B').properties.is_selected === true, 'expected selected radio button');
  assert(status().properties.text === 'radio:B', `unexpected status after radio: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.ComboBox').id, 'change', { selected_index: 2 });
  const combo = widget('gui.ComboBox');
  assert(combo.properties.selected_index === 2, 'expected ComboBox selected_index to update');
  assert(combo.properties.selected_text === 'Blue', `expected ComboBox selected_text, got ${combo.properties.selected_text}`);
  assert(combo.items?.join(',') === 'Red,Green,Blue', `expected ComboBox items snapshot, got ${JSON.stringify(combo.items)}`);
  assert(status().properties.text === 'combo:Blue', `unexpected status after combo: ${JSON.stringify(status())}`);
});

test('gui timers tick during gui steps', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Label label;
      label.text = "0";

      gui.Timer timer;
      timer.interval = 100;
      int ticks = 0;

      timer.on_tick = void function(gui.Timer sender) {
        ticks += 1;
        label.text = to_string(ticks);
        if (ticks == 3) {
          sender.stop();
        }
      };

      timer.start();
      win.add_child(label);
      win.show();
    }
  `);

  const label = () => result.runtime.getWindows()[0].children[0];
  await result.runtime.stepGui(0.25);
  assert(label().properties.text === '2', `expected two timer ticks, got ${JSON.stringify(label())}`);
  await result.runtime.stepGui(0.10);
  assert(label().properties.text === '3', `expected third timer tick, got ${JSON.stringify(label())}`);
  await result.runtime.stepGui(0.50);
  assert(label().properties.text === '3', `expected stopped timer to stay at 3, got ${JSON.stringify(label())}`);
});

test('gui modals snapshot close and run callbacks', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;

      gui.Label label;
      label.text = "ready";

      gui.Button confirm_btn;
      confirm_btn.text = "confirm";
      confirm_btn.on_click = void function() {
        gui.Modal modal;
        modal.title = "Question";
        modal.message = "Continue?";
        modal.confirm_text = "Yes";
        modal.cancel_text = "No";
        modal.on_confirm = void function(gui.Modal sender) {
          label.text = "confirmed";
        };
        modal.on_cancel = void function(gui.Modal sender) {
          label.text = "cancelled";
        };
        modal.show_confirm();
      };

      gui.Button input_btn;
      input_btn.text = "input";
      input_btn.on_click = void function() {
        gui.Modal modal;
        modal.title = "Name";
        modal.message = "Your name?";
        modal.confirm_text = "Save";
        modal.cancel_text = "Cancel";
        modal.on_confirm = void function(gui.Modal sender) {
          label.text = "Hello, " + sender.get_input_value();
        };
        modal.show_input();
      };

      win.add_child(label);
      win.add_child(confirm_btn);
      win.add_child(input_btn);
      win.show();
    }
  `);

  const widget = (type: string, text?: string) => {
    const found = result.runtime.getWindows()[0].children.find((item) => (
      item.type === type && (text === undefined || item.properties.text === text)
    ));
    assert(found !== undefined, `expected widget ${type} ${text ?? ''}`);
    return found;
  };
  const label = () => widget('gui.Label');

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'confirm').id, 'click', {});
  let modals = result.runtime.getModals();
  assert(modals.length === 1, `expected one confirm modal, got ${modals.length}`);
  assert(modals[0].mode === 'confirm' && modals[0].properties.title === 'Question', `unexpected confirm modal: ${JSON.stringify(modals[0])}`);

  await result.runtime.dispatchGuiEvent(modals[0].id, 'modal_cancel', {});
  assert(result.runtime.getModals().length === 0, 'expected confirm modal to close after cancel');
  assert(label().properties.text === 'cancelled', `expected cancel callback, got ${JSON.stringify(label())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'input').id, 'click', {});
  modals = result.runtime.getModals();
  assert(modals.length === 1 && modals[0].mode === 'input', `expected input modal, got ${JSON.stringify(modals)}`);

  await result.runtime.dispatchGuiEvent(modals[0].id, 'modal_confirm', { input_value: 'Ada' });
  assert(result.runtime.getModals().length === 0, 'expected input modal to close after confirm');
  assert(label().properties.text === 'Hello, Ada', `expected input callback to read value, got ${JSON.stringify(label())}`);
});

test('drawable asset loading reports readable runtime errors', async () => {
  await assertRuntimeFails([
    'use drawable;',
    '',
    'main() {',
    '    drawable.Texture texture;',
    '    texture.load_from_file("missing-player.png");',
    '}',
  ].join('\n'), "main.idyl:5: runtime error: Texture.load_from_file() cannot load 'missing-player.png': file does not exist");

  await assertRuntimeFails([
    'use gui;',
    '',
    'main() {',
    '    gui.Image image;',
    '    image.load_from_file("missing-cat.png");',
    '}',
  ].join('\n'), "main.idyl:5: runtime error: Image.load_from_file() cannot load 'missing-cat.png': file does not exist");
});

test('button does not accept placeholder or font_size', () => {
  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.placeholder = "Nope";
    }
  `, "has no property 'placeholder'");

  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.font_size = 20;
    }
  `, "has no property 'font_size'");
});

test('unicode identifiers are valid', async () => {
  const result = await runIdyllium(`
    use console;

    int function имя_функции(int входные_данные) {
      int выходные_данные = входные_данные + 1;
      return выходные_данные;
    }

    main() {
      console.write(имя_функции(41));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '42', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('return and loop control diagnostics', () => {
  assertFails(`
    main() {
      break;
    }
  `, 'only valid inside a loop');

  assertFails(`
    int function bad() {
      return "nope";
    }

    main() {}
  `, "cannot return 'string'");

  assertFails(`
    int function missing_return(int value) {
      int doubled = value * 2;
    }

    main() {}
  `, "function with return type 'int' must return a value");
});

test('console must be imported', () => {
  assertFails(`
    main() {
      console.write("Nope");
    }
  `, "is not imported");
});

test('stdlib registry powers completions', () => {
  const service = new IdylliumLanguageService();
  const source = 'use console;\nmain() {\n  console.';
  const completions = service.completions({ source, offset: source.length });
  assert(completions.some((item) => item.name === 'write'), 'expected console.write completion');
});

test('colors registry powers completions', () => {
  const service = new IdylliumLanguageService();
  const source = 'use colors;\nmain() {\n  colors.';
  const completions = service.completions({ source, offset: source.length });
  assert(completions.some((item) => item.name === 'Color' && item.kind === 'type'), 'expected colors.Color completion');
  assert(completions.some((item) => item.name === 'RGB'), 'expected colors.RGB completion');
  assert(completions.some((item) => item.name === 'WHITE'), 'expected colors.WHITE completion');
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

  const stringObjectPrefix = 'main() {\n  string text = "abc";\n  text.';
  const stringObjectProject = new IdylliumProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': stringObjectPrefix,
    },
  });
  const stringObjectCompletions = stringObjectProject.completions({ file: 'main.idyl', offset: stringObjectPrefix.length });
  assert(stringObjectCompletions.some((item) => item.name === 'replace' && item.kind === 'method'), 'expected text.replace completion');

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

async function runTests(): Promise<void> {
  for (const item of tests) {
    try {
      await item.fn();
      passed++;
      console.log(`ok - ${item.name}`);
    } catch (error: unknown) {
      failed++;
      console.log(`not ok - ${item.name}`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\npassed: ${passed}`);
  console.log(`failed: ${failed}`);
  if (failed > 0) {
    throw new Error(`${failed} smoke tests failed`);
  }
}

void runTests();
