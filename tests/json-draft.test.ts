import { compileIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// Черновой страж раздела: все program-примеры json lessons из манифеста
// извлечения обязаны компилироваться (кроме помеченных как ожидаемо
// ошибочные). Пути не зашиты — перенумерация уроков тест не ломает.
function main(): void {
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'spec/lessons/manifest.json'), 'utf8'));
  const expectations = JSON.parse(fs.readFileSync(path.join(root, 'tests/lesson-expectations.json'), 'utf8'));

  const examples = manifest.examples.filter((example: any) => (
    example.section === 'json'
    && example.form === 'program'
    && example.expectation !== 'reject'
  )).filter((example: any) => {
    const marked = expectations.examples[example.id];
    return !marked || marked.kind === 'valid' || marked.kind === 'runtime_error';
  });

  assert(examples.length > 0, 'no json lessons examples found in the manifest');

  for (const example of examples) {
    const file = path.join(root, 'spec/lessons', example.codeFile);
    const source = fs.readFileSync(file, 'utf8');
    const result = compileIdyllium(source, { file: example.codeFile });
    assert(result.success, `expected ${example.id} to compile, got:\n${result.diagnosticsText}`);
  }

  console.log(`json lessons draft spec: ${examples.length} examples compile`);
}

main();
