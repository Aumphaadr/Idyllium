import { compileProject, runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readExample(root: string, lesson: string, block: string): string {
  return fs.readFileSync(path.join(root, 'spec/lessons/examples', lesson, `${block}.idyl`), 'utf8');
}

// Многофайловые уроки учебника: standalone-блоки таких уроков закреплены в
// tests/lesson-expectations.json как compile_error ("module ... was not found"),
// а здесь проверяется, что вместе они собираются как проект.
const MULTI_FILE_LESSONS: ReadonlyArray<{
  readonly lesson: string;
  readonly files: Readonly<Record<string, string>>;
}> = [
  { lesson: 'canvas/modules', files: { 'main.idyl': '001', 'scene.idyl': '002' } },
  { lesson: 'console/libs', files: { 'draw.idyl': '001', 'main.idyl': '002' } },
  { lesson: 'oop/modules', files: { 'rect.idyl': '001', 'main.idyl': '002' } },
];

async function main(): Promise<void> {
  const root = process.cwd();

  for (const entry of MULTI_FILE_LESSONS) {
    const files: Record<string, string> = {};
    for (const [fileName, block] of Object.entries(entry.files)) {
      files[fileName] = readExample(root, entry.lesson, block);
    }
    const result = compileProject({ entryFile: 'main.idyl', files });
    assert(result.success, `lesson project ${entry.lesson} did not compile:\n${result.diagnosticsText}`);
  }

  const gameRoot = path.join(root, 'tests/fixtures/projects/canvas-game');
  const gameFiles: Record<string, string> = {};
  for (const name of fs.readdirSync(gameRoot).filter((file: string) => file.endsWith('.idyl'))) {
    gameFiles[name] = fs.readFileSync(path.join(gameRoot, name), 'utf8');
  }
  assert(gameFiles['main.idyl'] !== undefined, 'canvas-game fixture must contain main.idyl');
  const game = compileProject({ entryFile: 'main.idyl', files: gameFiles });
  assert(game.success, `canvas-game fixture did not compile:\n${game.diagnosticsText}`);

  // Константы, экспортируемые пользовательским модулем, работают между файлами.
  const constantsLib = [
    'const int MAX_LEVEL = 10;',
    'const string TITLE = "Idyllium";',
  ].join('\n');
  const constantsMain = [
    'use console;',
    'use limits;',
    '',
    'main() {',
    '    console.write(limits.TITLE, ":", limits.MAX_LEVEL);',
    '}',
  ].join('\n');
  const constantsProject = compileProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': constantsMain, 'limits.idyl': constantsLib },
  });
  assert(constantsProject.success, `module constants project did not compile:\n${constantsProject.diagnosticsText}`);

  const constantsRun = await runIdyllium(constantsMain, {}, {
    file: 'main.idyl',
    sources: { 'limits.idyl': constantsLib },
  });
  assert(constantsRun.success, constantsRun.runtimeError ?? constantsRun.compilation.diagnosticsText);
  assert(constantsRun.output === 'Idyllium:10', `unexpected module constants output: ${JSON.stringify(constantsRun.output)}`);

  const reassignment = await runIdyllium([
    'use limits;',
    '',
    'main() {',
    '    limits.MAX_LEVEL = 99;',
    '}',
  ].join('\n'), {}, { file: 'main.idyl', sources: { 'limits.idyl': constantsLib } });
  assert(!reassignment.compilation.success, 'assigning to an imported module constant must be rejected');
  assert(
    reassignment.compilation.diagnosticsText.includes('cannot assign to constant'),
    `unexpected module constant diagnostic:\n${reassignment.compilation.diagnosticsText}`,
  );

  console.log(`project fixtures: ${MULTI_FILE_LESSONS.length} lesson projects, canvas game and module constants pass`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
