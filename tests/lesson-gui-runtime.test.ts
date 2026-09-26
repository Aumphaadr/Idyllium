import {
  IdylliumRuntimeError,
  RuntimeFileSystem,
  compileIdyllium,
  createMemoryRuntimeFileSystem,
  createRuntime,
  describeRuntimeError,
} from '../src';

const fs: any = require('fs');
const path: any = require('path');

interface LessonExample {
  readonly id: string;
  readonly section: string;
  readonly lessonPath: string;
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

// Страж GUI-уроков (бэклог: «GUI-примеры уроков запускать, а не только
// компилировать»; спека some_lesson_demos/01 §4.6). Каждая program-программа
// разделов «Виджеты», «Черепаха», «Холст» выполняется без браузера, как её
// выполняет сборка сайта для демонстраций, а затем прокручивается пять шагов
// по 0,2 с смоделированного времени — срабатывают таймеры и on_update холстов.
// Падение — с именем примера. Демо в уроках покрывают только программы с демо;
// этот тест — все программы разделов.
const GUI_SECTIONS = ['widgets', 'turtle', 'canvas'] as const;
const STEP_SECONDS = 0.2;
const STEPS = 5;
const TIMEOUT_MS = 15000;

// Нарочные демонстрации ошибок помечены в lesson-expectations.json (kind ≠ valid)
// и сюда не попадают; здесь — программы, которым в голом рантайме нечем ответить.
const SKIP: Readonly<Record<string, string>> = {
  'turtle.svg.003': 'Vector.to_static() rasterises SVG in the browser host only — not available in Node',
};

// Файлы рядом с программой — как их видит ученик: ассеты книги, шрифт Lobster и те файлы
// раздатки, которые программы разделов загружают по имени (урок велит скачать их с /handouts/).
function lessonFiles(root: string, programs: readonly string[]): Record<string, { bytes: Uint8Array }> {
  const entries: Record<string, { bytes: Uint8Array }> = {};
  const seed = (name: string, file: string): void => {
    if (fs.existsSync(file)) entries[`/lesson/${name}`] = { bytes: new Uint8Array(fs.readFileSync(file)) };
  };
  const assetsRoot = path.join(root, 'packages/docs/book-assets');
  for (const name of ['cat.png', 'walk.gif', 'click.wav', 'theme.mp3']) seed(name, path.join(assetsRoot, name));
  seed('Lobster-Regular.ttf', path.join(root, 'packages/fonts/Lobster-Regular.ttf'));
  const handoutsRoot = path.join(root, 'packages/docs/handouts');
  for (const code of programs) {
    for (const match of code.matchAll(/load_from_file\("([^"/\\]+)"\)/gu)) {
      if (!entries[`/lesson/${match[1]}`]) seed(match[1], path.join(handoutsRoot, match[1]));
    }
  }
  return entries;
}

async function runGuiProgram(code: string, fileSystem: RuntimeFileSystem, label: string): Promise<void> {
  const compilation = compileIdyllium(code, { file: 'main.idyl' });
  assert(compilation.success && !!compilation.jsCode, `${label} does not compile:\n${compilation.diagnosticsText}`);

  const controller = new AbortController();
  const runtime = createRuntime({
    fileSystem,
    urlOpener: { open() {} },
    abortSignal: controller.signal,
    platform: 'web',
  });

  const work = (async (): Promise<void> => {
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const program = await new AsyncFunction(compilation.jsCode)();
    try {
      await program(runtime);
    } catch (error) {
      if (error instanceof IdylliumRuntimeError && error.kind === 'exit') return;
      throw new Error(`${label} failed at runtime:\n${describeRuntimeError(error, 'main.idyl')}`);
    }
    for (let step = 0; step < STEPS; step += 1) {
      try {
        await runtime.stepGui(STEP_SECONDS);
      } catch (error) {
        throw new Error(`${label} failed after ${((step + 1) * STEP_SECONDS).toFixed(1)} s of GUI time:\n${describeRuntimeError(error, 'main.idyl')}`);
      }
    }
  })();

  let timer: any = null;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} did not return from main() within ${TIMEOUT_MS / 1000} s`));
    }, TIMEOUT_MS);
  });
  try {
    await Promise.race([work, guard]);
  } finally {
    if (timer !== null) clearTimeout(timer);
    work.catch(() => {});
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const specRoot = path.join(root, 'generated/lesson-spec');
  const manifestPath = path.join(specRoot, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'missing generated/lesson-spec/manifest.json; run npm run spec:extract');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as LessonManifest;
  const expectations = JSON.parse(
    fs.readFileSync(path.join(root, 'tests/lesson-expectations.json'), 'utf8'),
  ) as LessonExpectations;
  const guiExamples = manifest.examples.filter((example) =>
    GUI_SECTIONS.includes(example.section as (typeof GUI_SECTIONS)[number]) && example.form === 'program');
  const files = lessonFiles(root, guiExamples.map((example) => fs.readFileSync(path.join(specRoot, example.codeFile), 'utf8')));
  // Одна файловая система на урок, как у сверки выводов: примеры продолжают друг
  // друга (save_svg в одном, load_from_file в следующем).
  const fileSystems = new Map<string, RuntimeFileSystem>();
  const lessonFileSystem = (lessonPath: string): RuntimeFileSystem => {
    let fileSystem = fileSystems.get(lessonPath);
    if (!fileSystem) {
      fileSystem = createMemoryRuntimeFileSystem(files, '/lesson');
      fileSystems.set(lessonPath, fileSystem);
    }
    return fileSystem;
  };

  let executed = 0;
  let skipped = 0;
  const failures: string[] = [];
  const bySection = new Map<string, number>();
  for (const example of guiExamples) {
    const entry = expectations.examples[example.id];
    if (entry && entry.kind !== 'valid') continue;
    if (SKIP[example.id]) { skipped++; continue; }

    const code = fs.readFileSync(path.join(specRoot, example.codeFile), 'utf8');
    try {
      await runGuiProgram(code, lessonFileSystem(example.lessonPath), `book program ${example.id}`);
    } catch (error) {
      // Собираем все падения разом: страж должен назвать каждый сломанный пример, а не первый.
      failures.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    executed++;
    bySection.set(example.section, (bySection.get(example.section) ?? 0) + 1);
  }

  assert(failures.length === 0, `${failures.length} GUI program(s) failed:\n\n${failures.join('\n\n')}`);
  assert(executed > 0, 'expected at least one runnable GUI program');
  const summary = [...bySection.entries()].map(([section, count]) => `${section}: ${count}`).join(', ');
  console.log(`lesson gui runtime: ${executed} GUI programs executed and stepped (${summary}), ${skipped} skipped`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
