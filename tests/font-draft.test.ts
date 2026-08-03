import { compileIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const root = path.join(process.cwd(), 'spec/some_fonts');
  const examples = fs.readdirSync(root)
    .filter((name: string) => name.endsWith('.idyl'))
    .sort();

  for (const name of examples) {
    const file = path.join(root, name);
    const result = compileIdyllium(fs.readFileSync(file, 'utf8'), { file });
    assert(result.success, `expected ${file} to compile, got:\n${result.diagnosticsText}`);
  }

  assert(examples.length === 4, `expected 4 font draft examples, got ${examples.length}`);
  console.log(`font draft spec: ${examples.length} examples compile`);
}

main();
