import { runCli, CliIO } from '../src/cli';
import { compileIdyllium } from '../src';

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
): Promise<CliRunResult> {
  let stdout = '';
  let stderr = '';
  const cwd = '/work';

  const io: CliIO = {
    cwd() {
      return cwd;
    },
    readFile(file: string) {
      const normalized = path.normalize(file);
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
      return '';
    },
  };

  const code = await runCli(args, io);
  return { code, stdout, stderr };
}

function fileMap(entries: readonly [string, string][]): Map<string, string> {
  return new Map(entries.map(([file, source]) => [path.normalize(file), source]));
}

test('enabled compiles on every widget kind', () => {
  const widgets = [
    'Button', 'Label', 'ProgressBar', 'LineEdit', 'TextEdit', 'SpinBox',
    'FloatSpinBox', 'Slider', 'CheckBox', 'RadioButton', 'ComboBox',
    'Frame', 'ImageBox', 'TabWidget',
    'Table', 'BarChart', 'LineChart', 'PieChart',
  ];
  const body = widgets
    .map((name, index) => [
      `    gui.${name} w${index};`,
      `    w${index}.enabled = false;`,
      `    w${index}.enabled = true;`,
    ].join('\n'))
    .join('\n');
  const source = `use gui;\n\nmain() {\n${body}\n}\n`;
  const result = compileIdyllium(source, { file: 'main.idyl' });
  assert(result.success, `expected enabled to compile on all widgets, got:\n${result.diagnosticsText}`);
});

test('enabled rejects non-bool values', () => {
  const source = [
    'use gui;',
    '',
    'main() {',
    '    gui.Button btn;',
    '    btn.enabled = 5;',
    '}',
  ].join('\n');
  const result = compileIdyllium(source, { file: 'main.idyl' });
  assert(!result.success, 'expected enabled = 5 to fail compilation');
  assert(
    result.diagnosticsText.includes("cannot assign 'int' value to 'bool' variable"),
    `unexpected diagnostics:\n${result.diagnosticsText}`,
  );
});

test('enabled defaults to true and is readable', async () => {
  const result = await runTestCli(['run', 'main.idyl'], fileMap([
    ['/work/main.idyl', [
      'use console;',
      'use gui;',
      '',
      'main() {',
      '    gui.Button btn;',
      '    console.writeln(btn.enabled);',
      '    btn.enabled = false;',
      '    console.writeln(btn.enabled);',
      '}',
    ].join('\n')],
  ]));

  assert(result.code === 0, `unexpected exit code: ${result.code}\n${result.stderr}`);
  assert(result.stdout === 'true\nfalse\n', `unexpected stdout: ${JSON.stringify(result.stdout)}`);
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
