import { createMemoryChannelBus, createMemoryNetworkService, createMemoryRuntimeFileSystem, runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

interface LessonExample {
  readonly id: string;
  readonly section: string;
  readonly codeFile: string;
  readonly form: 'program' | 'module' | 'snippet';
}

interface LessonManifest {
  readonly examples: readonly LessonExample[];
}

interface LessonExpectations {
  readonly examples: Record<string, { readonly kind: string }>;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Разделы учебника, программы которых самодостаточны и должны не только
// компилироваться (это проверяет lesson-spec), но и успешно выполняться.
const RUNTIME_SECTIONS = ['sqlite', 'json', 'network'] as const;

// Сетевые программы учебника ходят через мок с записанными ответами живой
// раздатки — живая сеть в тестах не используется никогда (дорожная карта).
function bookNetworkService() {
  const guildJson = fs.readFileSync(
    path.join(process.cwd(), 'packages/docs/handouts/guild.json'), 'utf8');
  const handouts = 'https://aumphaadr.github.io/Idyllium/handouts/files/';
  return createMemoryNetworkService({
    [`${handouts}guild.json`]: {
      status: 200,
      body: guildJson,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
    [`${handouts}ghost.json`]: { status: 404, body: 'Not Found' },
  });
}

// Программы, читающие файлы данных проекта, которых нет в голом рантайме.
const SKIP: Readonly<Record<string, string>> = {
  'sqlite.scripts.004': 'reads setup.sql from the project directory',
  'json.intro.003': 'reads save.txt from the project directory',
  'json.intro.004': 'reads names.txt from the project directory',
  'json.reading.001': 'reads player.json from the project directory',
};

async function main(): Promise<void> {
  const root = process.cwd();
  const specRoot = path.join(root, 'spec/lessons');
  const manifestPath = path.join(specRoot, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'missing spec/lessons/manifest.json; run npm run spec:extract');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as LessonManifest;
  const expectations = JSON.parse(
    fs.readFileSync(path.join(root, 'tests/lesson-expectations.json'), 'utf8'),
  ) as LessonExpectations;

  let executed = 0;
  let skipped = 0;
  for (const example of manifest.examples) {
    if (!RUNTIME_SECTIONS.includes(example.section as (typeof RUNTIME_SECTIONS)[number])) continue;
    if (example.form !== 'program') continue;
    const entry = expectations.examples[example.id];
    if (entry && entry.kind !== 'valid') continue;
    if (SKIP[example.id]) { skipped++; continue; }

    const codePath = path.join(specRoot, example.codeFile);
    const code = fs.readFileSync(codePath, 'utf8');
    const fileSystem = createMemoryRuntimeFileSystem({ [codePath]: code }, path.dirname(codePath));
    // Книжная программа не должна открывать браузер на машине разработчика,
    // а сетевые примеры ходят в мок, не в живой интернет.
    const result = await runIdyllium(
      code,
      {
        fileSystem,
        urlOpener: { open() {} },
        networkService: bookNetworkService(),
        // Каналу нужна хоть какая-то комната: партнёров в тесте нет,
        // но open()/send() должны отработать как в Web IDE.
        channelService: createMemoryChannelBus().service(),
      },
      { file: codePath },
    );
    assert(
      result.success,
      `book program ${example.id} failed at runtime:\n${result.runtimeError ?? result.compilation.diagnosticsText}`,
    );
    executed++;
  }

  assert(executed > 0, 'expected at least one runnable book program');
  console.log(`lesson runtime: ${executed} book programs executed (${RUNTIME_SECTIONS.join(', ')}), ${skipped} skipped (project data files)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
