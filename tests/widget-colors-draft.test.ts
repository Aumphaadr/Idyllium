import { compileIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertCompiles(file: string): void {
  const source = fs.readFileSync(file, 'utf8');
  const result = compileIdyllium(source, { file });
  assert(result.success, `expected ${file} to compile, got:\n${result.diagnosticsText}`);
}

function main(): void {
  const root = process.cwd();
  const colorLessonRoot = path.join(root, 'spec/lessons/examples/widgets/017_colors');

  assertCompiles(path.join(colorLessonRoot, '001.idyl'));
  assertCompiles(path.join(colorLessonRoot, '002.idyl'));
  assertCompiles(path.join(colorLessonRoot, '003_legacy.idyl'));
  assertCompiles(path.join(colorLessonRoot, '004_progressbar.idyl'));

  console.log('widget colors draft spec: 4 examples compile');
}

main();
