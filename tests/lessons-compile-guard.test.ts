import { compileIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// Страж учебника: КАЖДЫЙ program-пример КАЖДОЙ секции из манифеста
// извлечения обязан компилироваться, кроме явно помеченных как ошибочные.
// Закрывает дыру lesson-spec: непомеченные программы там только считаются
// (сводка «accepts N/M»), и сломанный правкой компилятора пример урока
// оставался бы незамеченным. Обобщение семи посекционных драфтов
// методической команды (from_docs_team/2026-08-21) на все секции разом.
function main(): void {
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'spec/lessons/manifest.json'), 'utf8'));
  const expectations = JSON.parse(fs.readFileSync(path.join(root, 'tests/lesson-expectations.json'), 'utf8'));

  const examples = manifest.examples.filter((example: any) => (
    example.form === 'program'
    && example.expectation !== 'reject'
  )).filter((example: any) => {
    const marked = expectations.examples[example.id];
    return !marked || marked.kind === 'valid' || marked.kind === 'runtime_error';
  });

  assert(examples.length > 0, 'no lesson program examples found in the manifest');

  const bySection = new Map<string, number>();
  for (const example of examples) {
    const file = path.join(root, 'spec/lessons', example.codeFile);
    const source = fs.readFileSync(file, 'utf8');
    const result = compileIdyllium(source, { file: example.codeFile });
    assert(result.success, `expected ${example.id} to compile, got:\n${result.diagnosticsText}`);
    bySection.set(example.section, (bySection.get(example.section) ?? 0) + 1);
  }

  const summary = [...bySection.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([section, count]) => `${section} ${count}`)
    .join(', ');
  console.log(`lessons compile guard: ${examples.length} examples compile (${summary})`);
}

main();
