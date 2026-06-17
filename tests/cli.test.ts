import { runCli, CliIO } from '../src/cli';

const path: any = require('path');

interface CliRunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runTestCli(
  args: readonly string[],
  files: ReadonlyMap<string, string>,
  input: readonly string[] = [],
): Promise<CliRunResult> {
  let stdout = '';
  let stderr = '';
  const pendingInput = [...input];
  const cwd = '/work';

  const io: CliIO = {
    cwd() {
      return cwd;
    },
    readFile(file: string) {
      const normalized = normalizeFile(file);
      const source = files.get(normalized);
      if (source === undefined) throw new Error(`file was not found: ${normalized}`);
      return source;
    },
    stdout(text: string) {
      stdout += text;
    },
    stderr(text: string) {
      stderr += text;
    },
    async readLine() {
      return pendingInput.shift() ?? '';
    },
  };

  const code = await runCli(args, io);
  return { code, stdout, stderr };
}

function fileMap(entries: readonly [string, string][]): Map<string, string> {
  return new Map(entries.map(([file, source]) => [normalizeFile(file), source]));
}

function normalizeFile(file: string): string {
  return path.normalize(file);
}

test('cli check reports success', async () => {
  const result = await runTestCli(['check', 'main.idyl'], fileMap([
    ['/work/main.idyl', [
      'main() {',
      '    int value = 42;',
      '}',
    ].join('\n')],
  ]));

  assert(result.code === 0, `unexpected exit code: ${result.code}\n${result.stderr}`);
  assert(result.stdout === 'main.idyl: ok\n', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
  assert(result.stderr === '', `unexpected stderr: ${result.stderr}`);
});

test('cli run writes console output and reads input', async () => {
  const result = await runTestCli(['run', 'main.idyl'], fileMap([
    ['/work/main.idyl', [
      'use console;',
      '',
      'main() {',
      '    string name = console.get_string();',
      '    console.write("Hello, ", name);',
      '}',
    ].join('\n')],
  ]), ['Mira']);

  assert(result.code === 0, `unexpected exit code: ${result.code}\n${result.stderr}`);
  assert(result.stdout === 'Hello, Mira', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
  assert(result.stderr === '', `unexpected stderr: ${result.stderr}`);
});

test('cli run resolves sibling modules', async () => {
  const result = await runTestCli(['run', 'src/main.idyl'], fileMap([
    ['/work/src/main.idyl', [
      'use console;',
      'use helper;',
      '',
      'main() {',
      '    console.write(helper.answer());',
      '}',
    ].join('\n')],
    ['/work/src/helper.idyl', [
      'int function answer() {',
      '    return 42;',
      '}',
    ].join('\n')],
  ]));

  assert(result.code === 0, `unexpected exit code: ${result.code}\n${result.stderr}`);
  assert(result.stdout === '42', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
  assert(result.stderr === '', `unexpected stderr: ${result.stderr}`);
});

test('cli check returns readable diagnostics', async () => {
  const result = await runTestCli(['check', 'main.idyl'], fileMap([
    ['/work/main.idyl', [
      'main() {',
      '    int value = 1.5;',
      '}',
    ].join('\n')],
  ]));

  assert(result.code === 1, `unexpected exit code: ${result.code}`);
  assert(result.stdout === '', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
  assert(result.stderr.includes("main.idyl:2"), `expected file position, got:\n${result.stderr}`);
  assert(result.stderr.includes("cannot assign 'float'"), `expected type diagnostic, got:\n${result.stderr}`);
});

test('cli run returns readable runtime errors', async () => {
  const result = await runTestCli(['run', 'main.idyl'], fileMap([
    ['/work/main.idyl', [
      'use console;',
      '',
      'main() {',
      '    dyn_array<int> values = [1, 2, 3];',
      '    console.write(values[5]);',
      '}',
    ].join('\n')],
  ]));

  assert(result.code === 1, `unexpected exit code: ${result.code}`);
  assert(result.stdout === '', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
  assert(
    result.stderr.includes('main.idyl:5: runtime error: array index 5 out of bounds'),
    `unexpected stderr:\n${result.stderr}`,
  );
});

test('cli run returns readable numeric input errors', async () => {
  const result = await runTestCli(['run', 'main.idyl'], fileMap([
    ['/work/main.idyl', [
      'use console;',
      '',
      'main() {',
      '    int age = console.get_int();',
      '}',
    ].join('\n')],
  ]), ['fgf']);

  assert(result.code === 1, `unexpected exit code: ${result.code}`);
  assert(result.stdout === '', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
  assert(
    result.stderr.includes('main.idyl:4: runtime error: cannot convert input to \'int\' (expected integer, got "fgf")'),
    `unexpected stderr:\n${result.stderr}`,
  );
});

async function main(): Promise<void> {
  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
      console.log(`ok - ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${item.name}`);
      console.error(error);
    }
  }

  console.log(`\npassed: ${passed}`);
  console.log(`failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
