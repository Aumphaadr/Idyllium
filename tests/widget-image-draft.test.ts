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
  const imageLessonRoot = path.join(root, 'spec/lessons/examples/widgets/018_image');

  assertCompiles(path.join(imageLessonRoot, '001.idyl'));
  assertCompiles(path.join(imageLessonRoot, '002.idyl'));

  console.log('widget image draft spec: 2 examples compile');
}

main();
