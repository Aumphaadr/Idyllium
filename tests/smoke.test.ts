import { compileIdyllium, runIdyllium, IdylliumLanguageService, IdylliumProject, compileProject, createRuntime, createMemoryRuntimeFileSystem, createNodeImageService, createDefaultStandardLibrary, formatIdyllium, runIdylliumInBrowser } from '../src';
import { scaleRaster } from '../src/runtime/image-service';

const fs: any = require('fs');
const os: any = require('os');
const path: any = require('path');
const BufferRef: any = require('buffer').Buffer;

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

async function runWithMemoryFiles(source: string, files: Record<string, string>) {
  const compilation = compileIdyllium(source, { file: '/workspace/main.idyl' });
  assert(compilation.success, compilation.diagnosticsText);
  assert(compilation.jsCode !== null, 'expected generated JavaScript');

  const runtime = createRuntime({
    fileSystem: createMemoryRuntimeFileSystem(files),
  });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  await program(runtime);
  return { runtime, compilation };
}

function tinyWavBinary(): string {
  const bytes = BufferRef.alloc(44);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36, 4);
  bytes.write('WAVE', 8, 'ascii');
  bytes.write('fmt ', 12, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(8000, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(0, 40);
  return bytes.toString('binary');
}

function tinyTtfHeader(): Uint8Array {
  return new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
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

test('local and global named constants run', async () => {
  const result = await runIdyllium(`
    use console;

    const int BASE_SCORE = 40;

    main() {
      const int BONUS = 2;
      console.writeln(BASE_SCORE + BONUS);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '42\n', `unexpected output: ${JSON.stringify(result.output)}`);
  assert(result.compilation.jsCode?.includes('const BASE_SCORE = 40') === true, 'expected global JavaScript const');
  assert(result.compilation.jsCode?.includes('const BONUS = 2') === true, 'expected local JavaScript const');
});

test('named constants require an initializer and reject reassignment', () => {
  assertFails(`
    main() {
      const int answer;
    }
  `, "constant 'answer' must have an initializer");

  assertFails(`
    main() {
      const int answer = 42;
      answer = 64;
    }
  `, "cannot assign to constant 'answer'");

  assertFails(`
    main() {
      const int answer = 42;
      answer += 1;
    }
  `, "cannot assign to constant 'answer'");

  assertFails(`
    class Rules {
      const int LIMIT = 10;
    }
  `, 'const class fields are not supported');

  assertFails(`
    void function show(const int value) {}
  `, 'const parameters are not supported');
});

test('const arrays keep a readonly binding but mutable elements', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      const array<int, 2> values = [10, 20];
      values[0] = 42;
      console.writeln(values);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '[42, 20]\n', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(`
    main() {
      const array<int, 2> values = [10, 20];
      values = [30, 40];
    }
  `, "cannot assign to constant 'values'");
});

test('const objects keep a readonly binding but mutable fields', async () => {
  const result = await runIdyllium(`
    use console;

    class Box {
      int value;

      constructor Box(int initial) {
        this.value = initial;
      }
    }

    main() {
      const Box box(10);
      box.value = 42;
      console.writeln(box.value);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '42\n', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(`
    class Box {
      constructor Box() {}
    }

    main() {
      const Box first();
      Box second;
      first = second;
    }
  `, "cannot assign to constant 'first'");
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

test('language null works with explicitly nullable library types', async () => {
  const result = await runIdyllium([
    'use console;',
    'use json;',
    '',
    'json.Value function optional_value(bool empty) {',
    '    if (empty) {',
    '        return null;',
    '    }',
    '    return json.Value("ready");',
    '}',
    '',
    'void function print_null(json.Value value = null) {',
    '    console.write(value == null);',
    '}',
    '',
    'main() {',
    '    json.Value first = null;',
    '    json.Value second = optional_value(true);',
    '    dyn_array<json.Value> values = [null];',
    '    values.add(null);',
    '',
    '    json.Object root;',
    '    root.add("missing", null);',
    '',
    '    print_null();',
    '    console.write(":", first == null, ":", null == second);',
    '    console.write(":", values[0] == null, ":", values[1].is_null());',
    '    console.write(":", root.get("missing") == null);',
    '',
    '    first = json.Value("text");',
    '    console.write(":", first == null);',
    '}',
  ].join('\n'));

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:true:true:true:true:true:false', `unexpected null output: ${JSON.stringify(result.output)}`);
});

test('language null rejects non-nullable types', () => {
  assertFails(`
    main() {
      int number = null;
    }
  `, "cannot assign 'null' value to 'int' variable");

  assertFails(`
    use json;

    main() {
      json.Object object = null;
    }
  `, "cannot assign 'null' value to 'json.Object' variable");

  assertFails(`
    main() {
      bool same = 42 == null;
    }
  `, "cannot compare 'int' and 'null'");

  assertFails(`
    int function bad() {
      return null;
    }

    main() {}
  `, "cannot return 'null' value from 'int' function");
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
      '    root.add("wife", null);',
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
        'use fonts;',
        'use gui;',
        'use image;',
        '',
        'main() {',
        '    gui.Window win;',
        '    image.Static cat;',
        '    cat.load_from_file("cat.png");',
        '    gui.ImageBox picture;',
        '    picture.set_image(cat);',
        '    picture.resize_mode = "fill";',
        '    win.add_child(picture);',
        '    win.show();',
        '',
        '    fonts.Font font;',
        '    font.load_from_file("lobster.ttf");',
        '    win.font = font;',
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
        bytes: tinyTtfHeader(),
        resourceUri: 'blob:idyllium-font',
      },
      '/workspace/cat.png': {
        content: '',
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'my_images/cat.png'))),
        resourceUri: 'blob:idyllium-cat',
      },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const draw = result.canvases[0]?.commands.find((command) => command.kind === 'draw');
  const font = draw?.object?.properties.font as { type?: string; properties?: Record<string, unknown> } | undefined;
  assert(font?.properties?.resource_uri === 'blob:idyllium-font', `expected font resource uri, got ${JSON.stringify(draw)}`);
  assert(font?.properties?.format === 'ttf', `expected detected TTF format, got ${JSON.stringify(font)}`);
  assert(font?.type === 'fonts.Font', `expected canonical fonts.Font snapshot, got ${JSON.stringify(font)}`);
  const windowFont = result.windows[0]?.properties.font as { type?: string; properties?: Record<string, unknown> } | undefined;
  assert(windowFont?.type === 'fonts.Font', `expected Window to use fonts.Font, got ${JSON.stringify(windowFont)}`);
  assert(explicitProperties(result.windows[0]?.properties ?? {}).includes('font'), 'expected Window font to be explicit');
  const imageBox = result.windows[0]?.children.find((widget) => widget.type === 'gui.ImageBox');
  const image = imageBox?.properties.image as { properties?: Record<string, unknown> } | undefined;
  assert(image?.properties?.resource_uri === 'blob:idyllium-cat', `expected image resource uri, got ${JSON.stringify(imageBox)}`);
  assert(imageBox?.properties.resize_mode === 'fill', `expected image resize mode, got ${JSON.stringify(imageBox)}`);
});

test('drawable.Font legacy alias is rejected', () => {
  assertFails(`
    use drawable;

    main() {
      drawable.Font old_font;
    }
  `, "unknown type 'drawable.Font'");
});

test('font resource metadata is read-only', () => {
  assertFails(`
    use fonts;

    main() {
      fonts.Font font;
      font.format = "ttf";
    }
  `, "property 'format' is read-only");
});

test('font loading detects all supported formats by contents', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use console;',
        'use fonts;',
        '',
        'main() {',
        '    fonts.Font ttf;',
        '    fonts.Font otf;',
        '    fonts.Font woff;',
        '    fonts.Font woff2;',
        '    ttf.load_from_file("first.bin");',
        '    otf.load_from_file("second.bin");',
        '    woff.load_from_file("third.bin");',
        '    woff2.load_from_file("fourth.bin");',
        '    console.writeln(ttf.format, ",", otf.format, ",", woff.format, ",", woff2.format);',
        '}',
      ].join('\n'),
      '/workspace/first.bin': { content: '', bytes: tinyTtfHeader() },
      '/workspace/second.bin': { content: '', bytes: new TextEncoder().encode('OTTOfont') },
      '/workspace/third.bin': { content: '', bytes: new TextEncoder().encode('wOFFfont') },
      '/workspace/fourth.bin': { content: '', bytes: new TextEncoder().encode('wOF2font') },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'ttf,otf,woff,woff2\n', `unexpected font formats: ${JSON.stringify(result.output)}`);
});

test('font loading rejects unsupported file contents', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use fonts;',
        '',
        'main() {',
        '    fonts.Font broken;',
        '    broken.load_from_file("broken.ttf");',
        '}',
      ].join('\n'),
      '/workspace/broken.ttf': {
        content: 'this is not a font',
        bytes: new TextEncoder().encode('this is not a font'),
        resourceUri: 'blob:idyllium-broken-font',
      },
    },
  });

  assert(!result.success, 'expected unsupported font to fail at runtime');
  assert(
    result.runtimeError?.includes('unsupported font format') === true,
    `unexpected font runtime error: ${result.runtimeError}`,
  );
});

test('image resources transform export and build animations', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': `
        use console;
        use image;

        main() {
          image.Static source;
          source.load_from_file("cat.png");

          image.Static mirrored = source.scale(-1, 1);
          image.Static rotated = source.rotate(90);
          image.Static cropped = source.crop(10, 10, 20, 30);
          mirrored.export_to_file("mirrored.png");

          dyn_array<image.Static> frames = [source, mirrored];
          image.Animation created;
          created.create_from_frames(frames, 0.1);
          created.export_to_file("created.gif");

          image.Animation loaded;
          loaded.load_from_file("created.gif");
          image.Static second = loaded.get_frame(1);

          console.write(
            mirrored.width, "x", mirrored.height, ":",
            rotated.width, "x", rotated.height, ":",
            cropped.width, "x", cropped.height, ":",
            loaded.frame_count, ":", loaded.frame_duration, ":",
            loaded.has_uniform_frame_duration, ":",
            second.width, "x", second.height
          );
        }
      `,
      '/workspace/cat.png': {
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'my_images/cat.png'))),
      },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '112x100:100x112:20x30:2:0.1:true:112x100', `unexpected image output: ${JSON.stringify(result.output)}`);
  const mirrored = result.writtenFiles['/workspace/mirrored.png'];
  const animation = result.writtenFiles['/workspace/created.gif'];
  assert(typeof mirrored !== 'string' && mirrored?.bytes instanceof Uint8Array && mirrored.bytes.length > 0, 'expected exported PNG bytes');
  assert(typeof animation !== 'string' && animation?.bytes instanceof Uint8Array && animation.bytes.length > 0, 'expected exported GIF bytes');
});

test('node image service round-trips jpeg and webp images', async () => {
  const service = createNodeImageService();
  const source = {
    width: 2,
    height: 1,
    pixels: new Uint8Array([
      255, 20, 30, 255,
      10, 200, 40, 128,
    ]),
  };
  const webpBytes = await service.encodeStatic(source, 'webp');
  const webpImage = await service.decodeStatic(webpBytes, 'webp');
  const jpegBytes = await service.encodeStatic(source, 'jpeg');
  const jpegImage = await service.decodeStatic(jpegBytes, 'jpeg');

  assert(webpBytes.length > 0, 'expected encoded WebP bytes');
  assert(webpImage.format === 'webp', `expected WebP format, got ${webpImage.format}`);
  assert(webpImage.width === 2 && webpImage.height === 1, `unexpected WebP size ${webpImage.width}x${webpImage.height}`);
  assert(webpImage.pixels.length === 8, `unexpected WebP pixel count ${webpImage.pixels.length}`);

  assert(jpegBytes.length > 0, 'expected encoded JPEG bytes');
  assert(jpegImage.format === 'jpeg', `expected JPEG format, got ${jpegImage.format}`);
  assert(jpegImage.width === 2 && jpegImage.height === 1, `unexpected JPEG size ${jpegImage.width}x${jpegImage.height}`);
  assert(jpegImage.pixels.length === 8, `unexpected JPEG pixel count ${jpegImage.pixels.length}`);
});

test('negative image scale mirrors pixels on both axes', () => {
  const horizontal = scaleRaster({
    width: 2,
    height: 1,
    pixels: new Uint8Array([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]),
  }, -1, 1);
  assert(
    JSON.stringify([...horizontal.pixels]) === JSON.stringify([
      0, 0, 255, 255,
      255, 0, 0, 255,
    ]),
    `unexpected horizontal mirror: ${JSON.stringify([...horizontal.pixels])}`,
  );

  const vertical = scaleRaster({
    width: 1,
    height: 2,
    pixels: new Uint8Array([
      20, 40, 60, 255,
      100, 120, 140, 255,
    ]),
  }, 1, -1);
  assert(
    JSON.stringify([...vertical.pixels]) === JSON.stringify([
      100, 120, 140, 255,
      20, 40, 60, 255,
    ]),
    `unexpected vertical mirror: ${JSON.stringify([...vertical.pixels])}`,
  );
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

test('arrays use value semantics for assignments parameters and returns', async () => {
  const result = await runIdyllium(`
    use console;

    array<int, 3> function changed(array<int, 3> values) {
      values[0] = 90;
      return values;
    }

    main() {
      array<int, 3> original = [1, 2, 3];
      array<int, 3> assigned = original;
      assigned[1] = 80;

      array<int, 3> returned = changed(original);
      console.write(original, ":", assigned, ":", returned);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '[1, 2, 3]:[1, 80, 3]:[90, 2, 3]',
    `unexpected array value output: ${JSON.stringify(result.output)}`,
  );
});

test('static and dynamic arrays convert by value in both directions', async () => {
  const result = await runIdyllium(`
    use console;

    array<int, 20> function repeat_to_20(dyn_array<int> arr) {
      dyn_array<int> tmp;
      while (tmp.length() < 20) {
        tmp.join(arr);
      }
      tmp.resize(20);

      array<int, 20> result = tmp;
      return result;
    }

    main() {
      array<int, 3> source = [34, 59, 20];
      dyn_array<int> repeated = repeat_to_20(source);
      repeated.add(77);

      console.writeln(source);
      console.writeln(repeated);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '[34, 59, 20]',
      '[34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 77]',
      '',
    ].join('\n'),
    `unexpected converted array output: ${JSON.stringify(result.output)}`,
  );
});

test('dynamic arrays can satisfy fixed array parameters after a size check', async () => {
  const result = await runIdyllium(`
    use console;

    array<int, 4> function changed(array<int, 4> values) {
      values[0] = 40;
      return values;
    }

    main() {
      dyn_array<int> source = [1, 2, 3, 4];
      array<int, 4> result = changed(source);
      console.write(source, ":", result);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '[1, 2, 3, 4]:[40, 2, 3, 4]', `unexpected fixed parameter output: ${JSON.stringify(result.output)}`);
});

test('nested static and dynamic arrays convert recursively', async () => {
  const result = await runIdyllium(`
    use console;

    dyn_array<dyn_array<int>> function touch(dyn_array<dyn_array<int>> matrix) {
      matrix[0][0] += 100;
      matrix[0].add(9);
      return matrix;
    }

    main() {
      dyn_array<array<int, 3>> first = [[1, 2, 3], [4, 5, 6]];
      array<dyn_array<int>, 2> second = [[10], [20, 30]];
      array<array<int, 2>, 2> third = [[40, 41], [50, 51]];

      dyn_array<dyn_array<int>> first_result = touch(first);
      dyn_array<dyn_array<int>> second_result = touch(second);
      dyn_array<dyn_array<int>> third_result = touch(third);

      console.writeln(first, ":", first_result);
      console.writeln(second, ":", second_result);
      console.writeln(third, ":", third_result);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '[[1, 2, 3], [4, 5, 6]]:[[101, 2, 3, 9], [4, 5, 6]]',
      '[[10], [20, 30]]:[[110, 9], [20, 30]]',
      '[[40, 41], [50, 51]]:[[140, 41, 9], [50, 51]]',
      '',
    ].join('\n'),
    `unexpected nested conversion output: ${JSON.stringify(result.output)}`,
  );
});

test('array value comparisons are structural', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<array<int, 2>, 3> fixed = [[1, 2], [3, 4], [1, 2]];
      dyn_array<dyn_array<int>> dynamic = [[1, 2], [3, 4], [1, 2]];

      console.write(
        fixed == dynamic, ":",
        fixed.contains([1, 2]), ":",
        fixed.find([3, 4]), ":",
        fixed.count([1, 2])
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:true:1:2', `unexpected array comparison output: ${JSON.stringify(result.output)}`);
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

  assertFails(`
    main() {
      array<int, 2> source = [1, 2];
      array<int, 3> target = source;
    }
  `, "cannot assign 'array<int, 2>' value to 'array<int, 3>' variable");

  assertFails(`
    main() {
      array<string, 2> source = ["1", "2"];
      dyn_array<int> target = source;
    }
  `, "cannot assign 'array<string, 2>' value to 'dyn_array<int>' variable");
});

test('dynamic to static array conversion errors are readable', async () => {
  await assertRuntimeFails(`
    main() {
      dyn_array<int> source = [1, 2, 3];
      array<int, 4> target = source;
    }
  `, "cannot convert dyn_array of size 3 to 'array<int, 4>' (expected size 4)");

  await assertRuntimeFails(`
    main() {
      dyn_array<dyn_array<int>> source = [[1, 2], [3]];
      array<array<int, 2>, 2> target = source;
    }
  `, "cannot convert dyn_array of size 1 to 'array<int, 2>' (expected size 2)");

  await assertRuntimeFails(`
    void function expects_four(array<int, 4> values) {
    }

    main() {
      dyn_array<int> source = [1, 2];
      expects_four(source);
    }
  `, "cannot convert dyn_array of size 2 to 'array<int, 4>' (expected size 4)");
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

test('types bit shifts use fixed-width zero-filled cells', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 right_source = types.from_bin("00101011", "uint8");
      types.uint8 shifted_right = right_source.shift_right(bits=3);

      types.int8 left_source = types.from_bin("11000101", "int8");
      types.int8 shifted_left = left_source.shift_left(3);

      types.int8 negative = types.from_bin("10000000", "int8");
      types.int8 lost_sign = negative.shift_right(1);

      types.int8 positive = types.from_bin("01000000", "int8");
      types.int8 gained_sign = positive.shift_left(1);

      types.uint8 zero = right_source.shift_left(12);
      types.uint8 chained = right_source.shift_left(1).shift_right(1);

      console.write(
        shifted_right.to_bin(), ":", shifted_right, ":",
        shifted_left.to_bin(), ":", shifted_left, ":",
        lost_sign.to_bin(), ":", lost_sign, ":",
        gained_sign.to_bin(), ":", gained_sign, ":",
        zero.to_bin(), ":", zero, ":", chained.to_bin()
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '00000101:5:00101000:40:01000000:64:10000000:-128:00000000:0:00101011',
    `unexpected fixed-width shift output: ${JSON.stringify(result.output)}`,
  );
});

test('types float shifts reinterpret shifted IEEE bit cells', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.float32 f32 = 4.5;
      types.float32 f32_left = f32.shift_left(3);
      types.float32 f32_right = f32.shift_right(3);
      types.float32 f32_zero = f32.shift_right(100);
      types.float32 finite = 1.5;
      types.float32 infinity = finite.shift_left(1);

      types.float64 f64 = 4.5;
      types.float64 f64_left = f64.shift_left(3);
      types.float64 f64_zero = f64.shift_left(64);

      console.writeln(f32.to_bin());
      console.writeln(f32_left.to_bin());
      console.writeln(f32_right.to_bin());
      console.writeln(f32_zero.to_bin());
      console.writeln(infinity.to_bin());
      console.writeln(f64_left.to_bin());
      console.writeln(f64_zero.to_bin());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '01000000100100000000000000000000',
      '00000100100000000000000000000000',
      '00001000000100100000000000000000',
      '00000000000000000000000000000000',
      '01111111100000000000000000000000',
      '0000000010010000000000000000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000000000000000000000000000',
      '',
    ].join('\n'),
    `unexpected float shift output: ${JSON.stringify(result.output)}`,
  );
});

test('types negative bit counts reverse shift direction', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 value = types.from_bin("00101011", "uint8");
      types.uint8 left_negative = value.shift_left(-3);
      types.uint8 right_negative = value.shift_right(-3);
      types.uint8 erased = value.shift_right(-12);

      types.float32 number = 4.5;
      types.float32 float_left_negative = number.shift_left(-3);
      types.float32 float_right_negative = number.shift_right(-3);

      console.writeln(left_negative.to_bin());
      console.writeln(right_negative.to_bin());
      console.writeln(erased.to_bin());
      console.writeln(float_left_negative.to_bin());
      console.writeln(float_right_negative.to_bin());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '00000101',
      '01011000',
      '00000000',
      '00001000000100100000000000000000',
      '00000100100000000000000000000000',
      '',
    ].join('\n'),
    `unexpected negative shift output: ${JSON.stringify(result.output)}`,
  );
});

test('types int64 and uint64 preserve exact values and wrap', async () => {
  const result = await runIdyllium(`
    use console;
    use math;
    use types;

    main() {
      types.uint64 exact = 9007199254740993;
      types.uint64 added = exact + 10;
      types.uint64 maximum = 18446744073709551615;
      types.uint64 wrapped = maximum + 1;

      types.int64 signed_maximum = 9223372036854775807;
      types.int64 signed_minimum = signed_maximum + 1;
      types.int64 minus_one = types.from_hex("FFFFFFFFFFFFFFFF", "int64");
      types.uint64 parsed = types.from_bin(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "uint64"
      );
      types.uint64 index = 1;
      array<string, 2> names = ["zero", "one"];

      console.write(
        exact, ":", added, ":", wrapped, ":",
        signed_minimum, ":", minus_one, ":", parsed, ":",
        exact < added, ":", maximum.to_hex(), ":",
        names[index], ":", math.sqrt(index + 80), ":", div(maximum, 3)
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '9007199254740993:9007199254741003:0:-9223372036854775808:-1:18446744073709551615:true:FFFFFFFFFFFFFFFF:one:9:6148914691236517205',
    `unexpected 64-bit types output: ${JSON.stringify(result.output)}`,
  );
});

test('types int64 values cross gui snapshot boundaries', async () => {
  const { runtime } = await runWithInspectableRuntime(`
    use gui;
    use types;

    main() {
      types.int64 left = 120;

      gui.Window win;
      win.x = left;
      win.show();
    }
  `);

  const snapshot = runtime.getWindows();
  assert(JSON.stringify(snapshot).includes('"x":120'), 'expected bigint-backed coordinate in serializable gui snapshot');
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

test('typed main returns a value but program ignores it', async () => {
  const result = await runIdyllium(`
    use console;

    string function main() {
      console.write("typed main");
      return "ignored";
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'typed main', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('typed main can use any normal return type', () => {
  assertCompiles(`
    array<int, 2> function main() {
      array<int, 2> values = [10, 20];
      return values;
    }
  `);

  assertCompiles(`
    class Cat {
      public:
      string name;
    }

    Cat function main() {
      Cat cat;
      cat.name = "Мурка";
      return cat;
    }
  `);

  assertCompiles(`
    void function main() {
    }
  `);
});

test('typed main diagnostics are readable', () => {
  assertFails(`
    int function main() {
    }
  `, "function with return type 'int' must return a value");

  assertFails(`
    int function main(int exit_code) {
      return exit_code;
    }
  `, "entry point 'main' cannot have parameters");

  assertFails(`
    main() {
    }

    string function main() {
      return "again";
    }
  `, "entry point 'main' is already declared");
});

test('default arguments run for functions methods and constructors', async () => {
  const result = await runIdyllium(`
    use console;

    int function sub(int left, int right = 10) {
      return left - right;
    }

    int function add_twice(int first, int second = first) {
      return first + second;
    }

    class Counter {
      int value;

      constructor Counter(int start = 5) {
        this.value = start;
      }

      void function add(int amount = 1) {
        this.value += amount;
      }

      int function get() {
        return this.value;
      }
    }

    main() {
      Counter a();
      a.add();
      a.add(4);

      Counter b(10);
      b.add();

      console.write(sub(50), ":", sub(50, 30), ":", add_twice(7), ":", a.get(), ":", b.get());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '40:20:14:10:11', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('default argument diagnostics are readable', () => {
  assertFails(`
    void function greet(string name = "Мира", string suffix) {
    }

    main() {}
  `, "parameter 'suffix' without default value cannot follow a parameter with default value");

  assertFails(`
    void function print_num(int value = "сорок два") {
    }

    main() {}
  `, "default value for parameter 'value' expects 'int', got 'string'");

  assertFails(`
    int function sub(int left, int right = 10) {
      return left - right;
    }

    main() {
      int value = sub();
    }
  `, "'sub' expects 1 or 2 arguments, got 0");
});

test('named arguments run for functions stdlib methods and constructors', async () => {
  const result = await runIdyllium(`
    use colors;
    use console;
    use math;

    int function sub(int left, int right = 10) {
      return left - right;
    }

    class Counter {
      int value;

      constructor Counter(int start = 5) {
        this.value = start;
      }

      void function add(int amount = 1) {
        this.value += amount;
      }
    }

    main() {
      Counter counter(start=20);
      counter.add(amount=3);

      string text = "кот и пёс";
      string replaced = text.replace(new_text="дракон", old_text="пёс");
      colors.Color color = colors.RGB(blue=30, red=10, green=20);
      gui_dummy(color);

      console.write(
        sub(right=50, left=30), ":",
        sub(50, right=5), ":",
        math.clamp(max=10, min=0, value=25), ":",
        div(right=4, left=21), ":",
        replaced, ":",
        counter.value
      );
    }

    void function gui_dummy(colors.Color value) {
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '-20:45:10:5:кот и дракон:23', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('named arguments work across user modules', async () => {
  const result = await runIdyllium(`
    use console;
    use math_tools;

    main() {
      console.write(math_tools.sub(right=50, left=30), ":", math_tools.sub(30));
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function sub(int left, int right = 10) {
          return left - right;
        }
      `,
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '-20:20', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('named argument diagnostics are readable', () => {
  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(left=50, 30);
    }
  `, 'positional argument cannot follow named argument');

  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(50, left=30);
    }
  `, "'sub' argument 'left' was already provided");

  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(left=30);
    }
  `, "'sub' missing required argument 'right'");

  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(start=30);
    }
  `, "'sub' has no argument named 'start'");

  assertFails(`
    use console;

    main() {
      console.write(value=42);
    }
  `, "'write' does not support named arguments");
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
      console.write(math_tools.square(), ":", math_tools.square(5), ":", r.getArea());
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function square(int x = 4) {
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
  assert(result.output === '16:25:600', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user modules expose readonly named constants', async () => {
  const mainSource = [
    'use console;',
    'use config;',
    '',
    'main() {',
    '    console.writeln(config.MAX_PLAYERS);',
    '}',
  ].join('\n');
  const configSource = 'const int MAX_PLAYERS = 8;\n';
  const result = await runIdyllium(mainSource, {}, {
    file: 'main.idyl',
    sources: { 'config.idyl': configSource },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '8\n', `unexpected module constant output: ${JSON.stringify(result.output)}`);

  const assignment = compileIdyllium(`
    use config;

    main() {
      config.MAX_PLAYERS = 10;
    }
  `, {
    file: 'main.idyl',
    sources: { 'config.idyl': configSource },
  });
  assert(!assignment.success, 'expected imported constant assignment failure');
  assert(
    assignment.diagnosticsText.includes("cannot assign to constant 'config.MAX_PLAYERS'"),
    `unexpected imported constant diagnostic:\n${assignment.diagnosticsText}`,
  );

  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': mainSource, 'config.idyl': configSource },
  });
  const completionOffset = mainSource.indexOf('config.MAX_PLAYERS') + 'config.'.length;
  const completions = project.completions({ file: 'main.idyl', offset: completionOffset });
  assert(
    completions.some((item) => item.name === 'MAX_PLAYERS' && item.kind === 'constant'),
    'expected imported constant completion',
  );
  const definition = project.definition({
    file: 'main.idyl',
    offset: mainSource.indexOf('MAX_PLAYERS') + 1,
  });
  assert(definition?.file === 'config.idyl', `expected config.idyl definition, got ${definition?.file}`);
  assert(definition?.range.start.line === 1, `expected constant definition on line 1, got ${definition?.range.start.line}`);
});

test('array fields on imported user classes keep value semantics', async () => {
  const result = await runIdyllium(`
    use console;
    use storage;

    main() {
      storage.Holder holder;
      array<int, 2> source = [1, 2];

      holder.values = source;
      source[0] = 9;
      holder.values.add(3);

      console.write(source, ":", holder.values);
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'storage.idyl': `
        class Holder {
          dyn_array<int> values;
        }
      `,
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '[9, 2]:[1, 2, 3]', `unexpected module array field output: ${JSON.stringify(result.output)}`);
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
      gui.ImageBox image_box;
      gui.Modal modal;

      image_box.resize_mode = "fit";

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
      win.add_child(image_box);
      win.add_child(combo);
      console.write(spin.value, ":", fspin.value, ":", slider.value, ":", cb.is_checked, ":", rb.is_selected, ":", image_box.resize_mode, ":", modal.get_input_value());
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
      gui.ImageBox image_box;

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
      win.add_child(image_box);
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
  assert(JSON.stringify(sizes.get('gui.ImageBox')) === JSON.stringify([160, 120]), 'expected default ImageBox size');
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
  assert(!('fill_color' in progress.properties), 'expected ProgressBar fill_color legacy property to be absent');
});

test('removed widget color legacy properties are rejected', () => {
  assertFails(`
    use colors;
    use gui;

    main() {
      gui.ProgressBar progress;
      progress.fill_color = colors.RED;
    }
  `, "has no property 'fill_color'");

  assertFails(`
    use gui;

    main() {
      gui.Label label;
      label.color = "#ff0000";
    }
  `, "has no property 'color'");
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
    use image;

    main() {
      gui.Canvas canvas;
      image.Static picture;
      canvas.draw(picture);
    }
  `, "'draw' argument 1 expects drawable object, got 'image.Static'");
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
  const defaultTextFont = canvas.commands[6].object?.properties.font as {
    properties?: Record<string, unknown>;
  } | undefined;
  assert(defaultTextFont?.properties?.is_builtin === true, `expected bundled Text font, got ${JSON.stringify(defaultTextFont)}`);
  assert(defaultTextFont?.properties?.format === 'woff2', `expected bundled WOFF2 font, got ${JSON.stringify(defaultTextFont)}`);
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

  const changed = await result.runtime.stepGui(0.016);
  assert(changed === false, 'expected a static Canvas GUI step to stay unchanged');
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
  assert(await result.runtime.stepGui(0.016), 'expected Canvas on_update to change the GUI snapshot');
  draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.x === 15, `expected key event to move player, got ${JSON.stringify(draw)}`);

  await result.runtime.dispatchGuiEvent(canvasId, 'mouse_scroll', { x: 3, y: 4, delta: -2 });
  assert(await result.runtime.stepGui(0.016), 'expected Canvas on_update after mouse scroll');
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
  assert(await result.runtime.stepGui(0.25), 'expected timer ticks to change GUI state');
  assert(label().properties.text === '2', `expected two timer ticks, got ${JSON.stringify(label())}`);
  assert(await result.runtime.stepGui(0.10), 'expected the final timer tick to change GUI state');
  assert(label().properties.text === '3', `expected third timer tick, got ${JSON.stringify(label())}`);
  assert(await result.runtime.stepGui(0.50) === false, 'expected a stopped timer GUI step to stay unchanged');
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

test('image asset loading reports readable runtime errors', async () => {
  await assertRuntimeFails([
    'use image;',
    '',
    'main() {',
    '    image.Static picture;',
    '    picture.load_from_file("missing-player.png");',
    '}',
  ].join('\n'), "main.idyl:5: runtime error: Static.load_from_file() cannot load 'missing-player.png': file does not exist");

  assertFails(`
    use gui;

    main() {
      gui.ImageBox picture;
      picture.load_from_file("cat.png");
    }
  `, "type 'gui.ImageBox' has no method 'load_from_file'");
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

test('audio module records sound and music commands', async () => {
  const result = await runWithMemoryFiles(`
    use audio;

    main() {
      audio.Sound click;
      click.load_from_file("click.wav");
      click.volume = 0.5;
      click.play();
      click.pause();
      click.resume();
      click.stop();

      audio.Music music;
      music.load_from_file("theme.wav");
      music.volume = 0.25;
      music.loop = true;
      music.position = 0.0;
      music.play();
    }
  `, {
    '/workspace/click.wav': tinyWavBinary(),
    '/workspace/theme.wav': tinyWavBinary(),
  });

  const audio = result.runtime.getAudio();
  assert(audio.length === 2, `expected two audio objects, got ${JSON.stringify(audio)}`);
  const sound = audio.find((item) => item.type === 'audio.Sound');
  const music = audio.find((item) => item.type === 'audio.Music');
  assert(sound !== undefined, 'expected audio.Sound snapshot');
  assert(music !== undefined, 'expected audio.Music snapshot');
  assert(sound.properties.src === 'click.wav', `unexpected sound src: ${JSON.stringify(sound.properties)}`);
  assert(sound.properties.volume === 0.5, `unexpected sound volume: ${JSON.stringify(sound.properties)}`);
  assert(sound.commands.map((command) => command.action).join(',') === 'play,pause,resume,stop', `unexpected sound commands: ${JSON.stringify(sound.commands)}`);
  assert(music.properties.loop === true, `unexpected music loop: ${JSON.stringify(music.properties)}`);
  assert(music.properties.volume === 0.25, `unexpected music volume: ${JSON.stringify(music.properties)}`);
  assert(music.commands.map((command) => command.action).join(',') === 'play', `unexpected music commands: ${JSON.stringify(music.commands)}`);
});

test('audio load and property errors are readable', async () => {
  await assertRuntimeFails(`
    use audio;

    main() {
      audio.Sound click;
      click.load_from_file("missing.wav");
    }
  `, "Sound.load_from_file() cannot load 'missing.wav': file does not exist");

  const compilation = compileIdyllium(`
    use audio;

    main() {
      audio.Sound click;
      click.load_from_file("click.wav");
      click.volume = 1.5;
    }
  `, { file: '/workspace/main.idyl' });
  assert(compilation.success && compilation.jsCode !== null, compilation.diagnosticsText);

  const runtime = createRuntime({
    fileSystem: createMemoryRuntimeFileSystem({ '/workspace/click.wav': tinyWavBinary() }),
  });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  try {
    await program(runtime);
    throw new Error('expected audio volume runtime error');
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    assert(text.includes('Sound.volume must be between 0 and 1'), `unexpected audio volume error: ${text}`);
  }
});

test('audio music finished event runs callback', async () => {
  const result = await runWithMemoryFiles(`
    use audio;
    use console;

    main() {
      audio.Music intro;
      intro.load_from_file("intro.wav");
      intro.on_finished = void function(audio.Music current) {
        console.writeln("finished: ", current.src);
      };
      intro.play();
    }
  `, {
    '/workspace/intro.wav': tinyWavBinary(),
  });

  const music = result.runtime.getAudio().find((item) => item.type === 'audio.Music');
  assert(music !== undefined, 'expected music snapshot');
  await result.runtime.dispatchGuiEvent(music.id, 'finished', {});
  assert(result.runtime.getOutput() === 'finished: intro.wav\n', `unexpected on_finished output: ${JSON.stringify(result.runtime.getOutput())}`);
  const updated = result.runtime.getAudio().find((item) => item.id === music.id);
  assert(updated?.properties.is_playing === false, `expected finished music to stop playing, got ${JSON.stringify(updated)}`);
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
