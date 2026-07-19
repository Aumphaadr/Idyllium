import {
  compileIdyllium,
  runIdyllium,
  runIdylliumInBrowser,
} from '../src';

const fs: any = require('fs');
const os: any = require('os');
const path: any = require('path');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  await testMemoryFileSystemLifecycle();
  await testMemoryRenameSnapshot();
  await testSafeRemovalErrors();
  await testNodeProjectBoundary();
  testStreamPropertyIsReadonly();
  console.log('file-system draft tests: ok');
}

async function testMemoryFileSystemLifecycle(): Promise<void> {
  const source = [
    'use console;',
    'use file;',
    '',
    'main() {',
    '    file.create_directory("data/players", parents=true);',
    '    file.ostream fout = file.open("data/players/liam.txt", "write");',
    '    fout.write_line("Liam;12");',
    '    console.writeln(fout.is_open);',
    '    fout.close();',
    '    console.writeln(fout.is_open);',
    '',
    '    file.copy("data", "backup");',
    '    file.rename("backup", "archive");',
    '    console.writeln(file.is_file("archive/players/liam.txt"));',
    '    console.writeln(file.list_directory("archive/players"));',
    '',
    '    file.remove("data", recursive=true);',
    '    file.remove("archive", recursive=true);',
    '    console.writeln(file.exists("data"));',
    '}',
  ].join('\n');

  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: { '/workspace/main.idyl': source },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'true\nfalse\ntrue\n["liam.txt"]\nfalse\n',
    `unexpected file-system output: ${JSON.stringify(result.output)}`,
  );
  assert(!('/workspace/data' in result.files), 'removed data directory remained in full snapshot');
  assert(!('/workspace/archive' in result.files), 'removed archive directory remained in full snapshot');
  assert(
    entryKind(result.writtenFiles['/workspace/data']) === 'deleted',
    `expected data tombstone, got ${JSON.stringify(result.writtenFiles['/workspace/data'])}`,
  );
  assert(
    entryKind(result.writtenFiles['/workspace/archive/players/liam.txt']) === 'deleted',
    'expected recursively removed copied file tombstone',
  );
}

async function testMemoryRenameSnapshot(): Promise<void> {
  const source = [
    'use file;',
    '',
    'main() {',
    '    file.rename("old", "renamed");',
    '}',
  ].join('\n');

  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': source,
      '/workspace/old': { kind: 'directory' },
      '/workspace/old/data.txt': 'value',
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(entryKind(result.writtenFiles['/workspace/old']) === 'deleted', 'missing old directory tombstone');
  assert(entryKind(result.writtenFiles['/workspace/old/data.txt']) === 'deleted', 'missing old file tombstone');
  assert(entryKind(result.writtenFiles['/workspace/renamed']) === 'directory', 'missing renamed directory snapshot');
  const renamed = result.writtenFiles['/workspace/renamed/data.txt'];
  assert(typeof renamed !== 'string' && renamed?.content === 'value', 'renamed file content was not preserved');
}

async function testSafeRemovalErrors(): Promise<void> {
  const nonRecursive = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use file;',
        'main() {',
        '    file.remove("data");',
        '}',
      ].join('\n'),
      '/workspace/data/value.txt': '42',
    },
  });
  assert(!nonRecursive.success, 'non-recursive removal unexpectedly deleted a non-empty directory');
  assert(
    nonRecursive.runtimeError?.includes('directory is not empty'),
    `unexpected non-recursive removal error: ${nonRecursive.runtimeError}`,
  );

  const overwrite = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use file;',
        'main() {',
        '    file.copy("first.txt", "second.txt");',
        '}',
      ].join('\n'),
      '/workspace/first.txt': 'first',
      '/workspace/second.txt': 'second',
    },
  });
  assert(!overwrite.success, 'copy unexpectedly overwrote an existing file');
  assert(overwrite.runtimeError?.includes('destination already exists'), `unexpected copy error: ${overwrite.runtimeError}`);
}

async function testNodeProjectBoundary(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-file-system-'));
  const project = path.join(root, 'project');
  const outside = path.join(root, 'outside.txt');
  fs.mkdirSync(project);
  fs.writeFileSync(outside, 'keep me', 'utf8');

  try {
    const sourceFile = path.join(project, 'main.idyl');
    const source = [
      'use file;',
      'main() {',
      '    file.create_directory("nested/items", parents=true);',
      '    file.ostream fout = file.open("nested/items/value.txt", "write");',
      '    fout.write_line(42);',
      '    fout.close();',
      '    file.copy("nested", "copy");',
      '    file.rename("copy", "archive");',
      '}',
    ].join('\n');
    fs.writeFileSync(sourceFile, source, 'utf8');
    const success = await runIdyllium(source, { projectRoot: project }, { file: sourceFile });
    assert(success.success, success.runtimeError ?? success.compilation.diagnosticsText);
    assert(fs.readFileSync(path.join(project, 'archive/items/value.txt'), 'utf8') === '42\n', 'Node copy lost file contents');

    const escapeSource = [
      'use file;',
      'main() {',
      '    file.remove("../outside.txt");',
      '}',
    ].join('\n');
    const escaped = await runIdyllium(escapeSource, { projectRoot: project }, { file: sourceFile });
    assert(!escaped.success, 'file.remove() escaped the project root');
    assert(escaped.runtimeError?.includes('outside the project'), `unexpected boundary error: ${escaped.runtimeError}`);
    assert(fs.readFileSync(outside, 'utf8') === 'keep me', 'outside file was modified');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testStreamPropertyIsReadonly(): void {
  const source = [
    'use file;',
    'main() {',
    '    file.istream fin = file.open("input.txt", "read");',
    '    fin.is_open = false;',
    '}',
  ].join('\n');
  const compilation = compileIdyllium(source, { file: '/workspace/main.idyl' });
  assert(!compilation.success, 'file stream is_open property unexpectedly remained writable');
  assert(compilation.diagnosticsText.includes('read-only'), `unexpected readonly diagnostic: ${compilation.diagnosticsText}`);
}

function entryKind(entry: unknown): string | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined;
  return (entry as { readonly kind?: string }).kind;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
