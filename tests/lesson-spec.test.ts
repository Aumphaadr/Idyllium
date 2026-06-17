import { compileIdyllium, runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');
const crypto: any = require('crypto');

interface LessonExample {
  readonly id: string;
  readonly codeFile: string;
  readonly sha256: string;
  readonly form: 'program' | 'module' | 'snippet';
  readonly expectation: 'reject' | 'unspecified';
}

interface LessonManifest {
  readonly version: number;
  readonly totalExamples: number;
  readonly contentSha256: string;
  readonly examples: readonly LessonExample[];
}

type LessonExpectationKind = 'compile_error' | 'runtime_error' | 'valid' | 'docs_only';

interface LessonExpectation {
  readonly kind: LessonExpectationKind;
  readonly diagnosticIncludes?: readonly string[];
  readonly reason?: string;
}

interface LessonExpectations {
  readonly version: number;
  readonly examples: Record<string, LessonExpectation>;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readManifest(file: string): LessonManifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as LessonManifest;
}

function readExpectations(file: string): LessonExpectations {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as LessonExpectations;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const specRoot = path.join(root, 'spec/lessons');
  const manifestPath = path.join(specRoot, 'manifest.json');
  const expectationsPath = path.join(specRoot, 'expectations.json');

  assert(fs.existsSync(manifestPath), 'missing spec/lessons/manifest.json; run npm run spec:extract');
  assert(fs.existsSync(expectationsPath), 'missing spec/lessons/expectations.json');

  const manifest = readManifest(manifestPath);
  const expectations = readExpectations(expectationsPath);
  assert(manifest.version === 1, `unsupported lesson spec version: ${manifest.version}`);
  assert(expectations.version === 1, `unsupported lesson expectations version: ${expectations.version}`);
  assert(manifest.totalExamples === manifest.examples.length, 'manifest totalExamples does not match examples length');
  assert(manifest.totalExamples > 0, 'lesson spec must contain at least one example');

  const seen = new Set<string>();
  const knownIds = new Set(manifest.examples.map((example) => example.id));
  for (const id of Object.keys(expectations.examples)) {
    assert(knownIds.has(id), `expectation references unknown lesson example: ${id}`);
  }

  let programs = 0;
  let runnablePrograms = 0;
  let acceptedRunnablePrograms = 0;
  let nonStandalone = 0;
  let compileErrors = 0;
  let runtimeErrors = 0;
  let validExpectations = 0;
  let docsOnly = 0;

  for (const example of manifest.examples) {
    assert(!seen.has(example.id), `duplicate lesson example id: ${example.id}`);
    seen.add(example.id);

    const codePath = path.join(specRoot, example.codeFile);
    assert(fs.existsSync(codePath), `missing frozen example file: ${example.codeFile}`);

    const code = fs.readFileSync(codePath, 'utf8');
    const actualHash = sha256(code);
    assert(actualHash === example.sha256, `hash mismatch for ${example.id}`);

    const expectation = expectations.examples[example.id];
    if (example.expectation === 'reject') {
      assert(expectation !== undefined, `teaching-error example has no explicit expectation: ${example.id}`);
    }

    if (expectation) {
      switch (expectation.kind) {
        case 'compile_error':
          assertCompileError(example, code, expectation);
          compileErrors++;
          break;
        case 'runtime_error':
          await assertRuntimeError(example, code, expectation);
          runtimeErrors++;
          break;
        case 'valid':
          assertCompiles(example, code);
          validExpectations++;
          break;
        case 'docs_only':
          docsOnly++;
          break;
      }
    }

    if (example.form === 'program') {
      programs++;
      if (!expectation || expectation.kind === 'valid') {
        runnablePrograms++;
        const compiled = compileIdyllium(code, { file: example.codeFile });
        if (compiled.success) acceptedRunnablePrograms++;
      }
    } else {
      nonStandalone++;
    }
  }

  const actualContentHash = sha256(manifest.examples.map((example) => `${example.id}:${example.sha256}`).join('\n'));
  assert(actualContentHash === manifest.contentSha256, 'manifest contentSha256 mismatch');

  console.log(
    `lesson spec: ${manifest.totalExamples} examples frozen, ${programs} standalone programs, ${nonStandalone} non-standalone snippets/modules`,
  );
  console.log(
    `lesson spec expectations: ${compileErrors} compile-error, ${runtimeErrors} runtime-error, ${validExpectations} valid, ${docsOnly} docs-only`,
  );
  console.log(
    `lesson spec coverage: current compiler accepts ${acceptedRunnablePrograms}/${programs} standalone programs (raw denominator includes expected errors/docs-only)`,
  );
  console.log(
    `lesson spec runnable coverage: current compiler accepts ${acceptedRunnablePrograms}/${runnablePrograms} valid-or-unspecified standalone programs`,
  );
}

function assertCompiles(example: LessonExample, code: string): void {
  const compiled = compileIdyllium(code, { file: example.codeFile });
  assert(compiled.success, `expected ${example.id} to compile, got:\n${compiled.diagnosticsText}`);
}

function assertCompileError(example: LessonExample, code: string, expectation: LessonExpectation): void {
  const compiled = compileIdyllium(code, { file: example.codeFile });
  assert(!compiled.success, `expected ${example.id} to fail compilation`);
  assertIncludes(example.id, compiled.diagnosticsText, expectation.diagnosticIncludes ?? []);
}

async function assertRuntimeError(example: LessonExample, code: string, expectation: LessonExpectation): Promise<void> {
  const result = await runIdyllium(code, {}, { file: example.codeFile });
  assert(result.compilation.success, `expected ${example.id} to compile before runtime error, got:\n${result.compilation.diagnosticsText}`);
  assert(!result.success, `expected ${example.id} to fail at runtime`);
  assert(result.runtimeError !== null, `expected ${example.id} to report a runtime error`);
  assertIncludes(example.id, result.runtimeError, expectation.diagnosticIncludes ?? []);
}

function assertIncludes(exampleId: string, text: string, needles: readonly string[]): void {
  for (const needle of needles) {
    assert(text.includes(needle), `expected ${exampleId} diagnostics to include ${JSON.stringify(needle)}, got:\n${text}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
