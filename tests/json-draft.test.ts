import { compileIdyllium, runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

interface RuntimeErrorCase {
  readonly file: string;
  readonly includes: string;
}

const ERROR_CASES: readonly RuntimeErrorCase[] = [
  {
    file: 'spec/lessons/examples/json/005_errors/001_missing_key.idyl',
    includes: "runtime error: json object has no key 'age'",
  },
  {
    file: 'spec/lessons/examples/json/005_errors/002_wrong_type.idyl',
    includes: 'runtime error: json value is string, expected int',
  },
  {
    file: 'spec/lessons/examples/json/005_errors/003_array_bounds.idyl',
    includes: 'runtime error: json array index 5 out of bounds (size 3, valid indices 0-2)',
  },
];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function collectIdylliumFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectIdylliumFiles(absolute));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.idyl')) {
      result.push(absolute);
    }
  }
  return result.sort();
}

async function main(): Promise<void> {
  const root = process.cwd();
  const specRoot = path.join(root, 'spec/lessons/examples/json');
  const errorFiles = new Set(ERROR_CASES.map((item) => path.join(root, item.file)));
  const files = collectIdylliumFiles(specRoot);

  let validFiles = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    const compiled = compileIdyllium(source, { file: relative });
    assert(compiled.success, `expected ${relative} to compile, got:\n${compiled.diagnosticsText}`);
    if (!errorFiles.has(file)) validFiles++;
  }

  for (const errorCase of ERROR_CASES) {
    const file = path.join(root, errorCase.file);
    const source = fs.readFileSync(file, 'utf8');
    const result = await runIdyllium(source, {}, { file });
    assert(result.compilation.success, `expected ${errorCase.file} to compile, got:\n${result.compilation.diagnosticsText}`);
    assert(!result.success, `expected ${errorCase.file} to fail at runtime`);
    const runtimeError = result.runtimeError;
    if (runtimeError === null) throw new Error(`expected ${errorCase.file} to report runtime error`);
    assert(
      runtimeError.includes(errorCase.includes),
      `expected ${errorCase.file} error to include ${JSON.stringify(errorCase.includes)}, got:\n${runtimeError}`,
    );
  }

  console.log(`json draft spec: ${validFiles} valid examples compile, ${ERROR_CASES.length} runtime-error examples checked`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
