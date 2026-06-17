import { compileIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

const MUST_COMPILE = [
  'spec/lessons/examples/cli/012_loops/001.idyl',
  'spec/lessons/examples/cli/012_loops/002.idyl',
  'spec/lessons/examples/cli/012_loops/003.idyl',
  'spec/lessons/examples/cli/012_loops/006.idyl',
  'spec/lessons/examples/cli/012_loops/007.idyl',
  'spec/lessons/examples/cli/022_functions/003.idyl',
  'spec/lessons/examples/cli/022_functions/005.idyl',
  'spec/lessons/examples/cli/028_recursion/001_sum.idyl',
  'spec/lessons/examples/cli/028_recursion/002_factorial.idyl',
];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const root = process.cwd();
  for (const relative of MUST_COMPILE) {
    const file = path.join(root, relative);
    const source = fs.readFileSync(file, 'utf8');
    const result = compileIdyllium(source, { file: relative });
    assert(result.success, `expected ${relative} to compile, got:\n${result.diagnosticsText}`);
  }

  console.log(`core lesson draft spec: ${MUST_COMPILE.length} loop/function/recursion examples compile`);
}

main();
