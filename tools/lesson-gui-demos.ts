// Запекание демонстраций уроков: <idyl-gui-demo> → снимок окон настоящего
// рантайма (стилевая база 1.6.4, этап 5; спека Idyllium-backstage/tech/spec/
// some_lesson_demos/01, вердикты §9).
//
// Программа демо — своя (<script type="text/plain"> внутри элемента) или
// ближайший предыдущий <idyl-code-block> урока (модули «// имя.idyl» между
// ними перешагиваются, но кладутся в sources). Программа компилируется и
// выполняется без браузера; затем прокручивается смоделированное время
// (step="секунды") и события (events='[…]' в формате tools/gui-drive.js), и
// снимок getWindows()/getCanvases()/getModals() вписывается в урок JSON-ом:
//   <idyl-gui-demo data-frame-width="…" data-frame-height="…">
//     <script type="application/json">{…}</script>
//   </idyl-gui-demo>
// На странице снимок рисует настоящий рендерер в кадре gui-demo.html (элемент
// <idyl-gui-demo> в packages/docs-book/app.js) — тот же код, что предпросмотр
// Web IDE: совпадение с тем, что увидит ученик, гарантировано по построению.
//
// Любой отказ — падение сборки словами: урок, номер демо, причина (канон:
// тихое враньё недопустимо). Файлы программы (ассеты книги, по files="…" —
// раздатка и шрифты) лежат в памяти; их адреса на сайте попадают в снимок
// свойством resource_uri, которое читает рендерер.
import {
  IdylliumRuntime,
  IdylliumRuntimeError,
  compileIdyllium,
  createMemoryRuntimeFileSystem,
  createRuntime,
  describeRuntimeError,
  guiPreviewIntervalMs,
} from '../src';
import { LessonBlock, blockCode, collectModuleSources, moduleFileName, parseBlocks, unescapeHtml } from './lesson-blocks';

const fs: any = require('fs');

export interface GuiDemoFile {
  /** Имя, под которым файл видит программа (лежит рядом с main.idyl). */
  readonly name: string;
  /** Откуда взять байты. */
  readonly path: string;
  /** Адрес файла на сайте относительно кадра gui-demo.html (корень сайта). */
  readonly resourceUri: string;
}

export interface GuiDemoBakeOptions {
  /** Имя урока для сообщений об ошибках. */
  readonly lessonLabel: string;
  /** Файлы, доступные каждой программе демо (ассеты книги). */
  readonly files: readonly GuiDemoFile[];
  /** Файлы по запросу files="имя,имя" (раздатка, шрифты); null — такого файла нет. */
  readonly resolveFile: (name: string) => GuiDemoFile | null;
  /** Предел времени на одну программу, мс (по умолчанию 15 с). */
  readonly timeoutMs?: number;
}

export interface GuiDemoBakeResult {
  readonly html: string;
  /** Сколько демо запечено. */
  readonly count: number;
}

interface DemoEventStep {
  readonly tick?: number;
  readonly type?: string;
  readonly index?: number;
  readonly text?: string;
  readonly event?: string;
  readonly payload?: Record<string, unknown>;
}

interface WidgetLike {
  readonly id: number;
  readonly type: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly children?: readonly WidgetLike[];
}

const DEMO_RE = /<idyl-gui-demo\b([^>]*)>([\s\S]*?)<\/idyl-gui-demo>/gu;
const OWN_PROGRAM_RE = /<script\s+type="text\/plain">([\s\S]*?)<\/script>/u;
const ATTRIBUTE_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
const DEFAULT_TIMEOUT_MS = 15000;
/** Виртуальная папка программы: файлы демо лежат в ней, как в проекте ученика. */
const DEMO_DIR = '/lesson';

// Геометрия окна в кадре — как в renderer.js (WINDOW_TITLEBAR_HEIGHT, WINDOW_FRAME_BORDER,
// WINDOW_LAYOUT_GAP и раскладка layoutWindows): окна с явными x/y стоят по координатам,
// остальные — в строчку с промежутком.
const WINDOW_TITLEBAR_HEIGHT = 28;
const WINDOW_FRAME_BORDER = 1;
const WINDOW_LAYOUT_GAP = 18;

export async function bakeLessonGuiDemos(html: string, options: GuiDemoBakeOptions): Promise<GuiDemoBakeResult> {
  DEMO_RE.lastIndex = 0;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = DEMO_RE.exec(html)) !== null) matches.push(match);
  if (matches.length === 0) return { html, count: 0 };

  const blocks = parseBlocks(html);
  const moduleSources = collectModuleSources(blocks);
  let output = '';
  let cursor = 0;
  let number = 0;
  for (const found of matches) {
    number += 1;
    const attributes = parseAttributes(found[1]);
    const label = `${options.lessonLabel}: демо №${number}`;
    const program = programForDemo(found[2], found.index, blocks, label);
    const refusal = demoRefusal(program.code, attributes);
    if (refusal) throw new Error(`${label} (${program.label}): ${refusal}`);

    const snapshot = await runDemoProgram(program.code, moduleSources, attributes, options, `${label} (${program.label})`);
    const frame = frameSize(snapshot);
    if (!frame) throw new Error(`${label} (${program.label}): программа не показала ни окна, ни холста, ни диалога — демо нечего рисовать`);

    const serialized = JSON.stringify(snapshot).replace(/</gu, '\\u003c');
    const keptAttributes = found[1].replace(/\s+data-frame-(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gu, '').replace(/\s+$/u, '');
    const replacement = `<idyl-gui-demo${keptAttributes} data-frame-width="${frame.width}" data-frame-height="${frame.height}">`
      + `<script type="application/json">${serialized}</script></idyl-gui-demo>`;
    output += html.slice(cursor, found.index) + replacement;
    cursor = found.index + found[0].length;
  }
  output += html.slice(cursor);
  return { html: output, count: matches.length };
}

function parseAttributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  ATTRIBUTE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_RE.exec(source)) !== null) {
    result[match[1].toLowerCase()] = unescapeHtml(match[2] ?? match[3] ?? '');
  }
  return result;
}

interface DemoProgram {
  readonly code: string;
  /** Откуда программа — для сообщений об ошибках. */
  readonly label: string;
}

function programForDemo(inner: string, demoStart: number, blocks: readonly LessonBlock[], label: string): DemoProgram {
  const own = OWN_PROGRAM_RE.exec(inner);
  if (own) {
    return { code: unescapeHtml(own[1].replace(/^\n/u, '').replace(/\n\s*$/u, '')), label: 'своя программа' };
  }
  const codeBlocks = blocks.filter((block) => block.kind === 'code');
  for (let index = codeBlocks.length - 1; index >= 0; index -= 1) {
    const block = codeBlocks[index];
    if (block.end > demoStart) continue;
    // Модуль многофайлового примера перед демо — часть программы, а не она сама.
    if (moduleFileName(block) !== null) continue;
    return { code: blockCode(block), label: `блок кода №${index + 1}` };
  }
  throw new Error(`${label}: перед демо нет ни одного блока кода, а своей программы у демо нет`);
}

/** Почему программу нельзя запечь; null — можно. Таблица уже, чем у сверки выводов:
 *  обработчики мыши и клавиш снимку не мешают (снимается начальное состояние). */
function demoRefusal(code: string, attributes: Record<string, string>): string | null {
  if (!/\bmain\s*\(/u.test(code)) return 'в программе нет main() — это фрагмент, а не программа; дайте демо свою программу';
  if (/console\.get_/u.test(code)) return 'программа читает ввод с консоли (console.get_…) — без ученика ей нечего прочитать';
  if (/\btime\.now\s*\(/u.test(code)) return 'снимок зависел бы от текущего времени (time.now) и менялся бы от сборки к сборке';
  if (/\brandom\./u.test(code) && !/set_seed/u.test(code) && attributes.seed === undefined) {
    return 'случайность без зерна: снимок менялся бы от сборки к сборке — задайте демо seed="число" (в копию программы для снимка встанет random.set_seed) или дайте ему свою программу';
  }
  return null;
}

/** seed="число": в копию программы для снимка первой строкой main() встаёт random.set_seed(число) —
 *  текст урока не меняется, а снимок от сборки к сборке одинаков. */
function withSeed(code: string, attributes: Record<string, string>, label: string): string {
  if (attributes.seed === undefined) return code;
  const seed = Number(attributes.seed);
  if (!Number.isInteger(seed)) throw new Error(`${label}: seed="${attributes.seed}" — ожидалось целое число`);
  const mainRe = /^([ \t]*)main\s*\(\s*\)\s*\{[ \t]*\n/mu;
  const match = mainRe.exec(code);
  if (!match) throw new Error(`${label}: seed задан, а строки «main() {» в программе не нашлось`);
  const indent = `${match[1]}    `;
  return code.slice(0, match.index + match[0].length) + `${indent}random.set_seed(${seed});\n` + code.slice(match.index + match[0].length);
}

async function runDemoProgram(
  code: string,
  moduleSources: Record<string, string>,
  attributes: Record<string, string>,
  options: GuiDemoBakeOptions,
  label: string,
): Promise<Record<string, unknown>> {
  const compilation = compileIdyllium(withSeed(code, attributes, label), { file: 'main.idyl', sources: moduleSources });
  if (!compilation.success || !compilation.jsCode) {
    throw new Error(`${label}: программа не компилируется:\n${compilation.diagnosticsText}`);
  }

  const seeded: Record<string, { bytes: Uint8Array; resourceUri: string }> = {};
  const seed = (file: GuiDemoFile): void => {
    seeded[`${DEMO_DIR}/${file.name}`] = { bytes: new Uint8Array(fs.readFileSync(file.path)), resourceUri: file.resourceUri };
  };
  for (const file of options.files) seed(file);
  for (const name of (attributes.files ?? '').split(',').map((item) => item.trim()).filter(Boolean)) {
    const file = options.resolveFile(name);
    if (!file) throw new Error(`${label}: файл '${name}' из files="…" не найден ни в раздатке, ни среди шрифтов сайта`);
    seed(file);
  }

  const controller = new AbortController();
  const runtime = createRuntime({
    fileSystem: createMemoryRuntimeFileSystem(seeded, DEMO_DIR),
    // Ссылки урока не должны открывать браузер на машине сборки.
    urlOpener: { open(): void {} },
    abortSignal: controller.signal,
    // Демо показывает то, что увидит ученик в Web IDE: в консольной платформе
    // черепаха не открывает окно «Черепашье поле».
    platform: 'web',
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const work = (async (): Promise<void> => {
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const factory = new AsyncFunction(compilation.jsCode);
    const program = await factory();
    try {
      await program(runtime);
    } catch (error) {
      // system.exit() — обычное завершение; всё прочее — авария примера.
      if (!(error instanceof IdylliumRuntimeError && error.kind === 'exit')) {
        throw new Error(`${label}: программа упала:\n${describeRuntimeError(error, 'main.idyl')}`);
      }
    }
    const step = Number(attributes.step ?? '0');
    if (!Number.isFinite(step) || step < 0) throw new Error(`${label}: step="${attributes.step}" — ожидались секунды, неотрицательное число`);
    if (step > 0) await advanceGuiTime(runtime, step, label);
    if (attributes.events) await dispatchDemoEvents(runtime, attributes.events, label);
  })();

  let timer: any = null;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label}: программа не завершила main() за ${Math.round(timeoutMs / 1000)} с — демо снимается сразу после main(), бесконечный цикл там недопустим`));
    }, timeoutMs);
  });
  try {
    await Promise.race([work, guard]);
  } finally {
    if (timer !== null) clearTimeout(timer);
    // Программа, брошенная по таймауту, может отказать позже — процесс сборки это не касается.
    work.catch(() => {});
  }

  const windows = runtime.getWindows();
  return {
    windows,
    // Как в Web IDE: отдельные холсты показываются, только когда окон нет.
    canvases: windows.length > 0 ? [] : runtime.getCanvases(),
    modals: runtime.getModals(),
    // Звук в кадре демо не играет (спека §5): список аудио пуст.
    audio: [],
  };
}

/** Прокручивает таймеры и холсты на step секунд кадрами той же длительности, что и предпросмотр IDE. */
async function advanceGuiTime(runtime: IdylliumRuntime, seconds: number, label: string): Promise<void> {
  const totalMs = Math.round(seconds * 1000);
  const intervalMs = guiPreviewIntervalMs(runtime.getWindows(), runtime.getCanvases());
  let elapsedMs = 0;
  while (elapsedMs < totalMs) {
    const deltaMs = Math.min(intervalMs, totalMs - elapsedMs);
    try {
      await runtime.stepGui(deltaMs / 1000);
    } catch (error) {
      throw new Error(`${label}: ошибка через ${(elapsedMs + deltaMs) / 1000} с смоделированного времени:\n${describeRuntimeError(error, 'main.idyl')}`);
    }
    elapsedMs += deltaMs;
  }
}

async function dispatchDemoEvents(runtime: IdylliumRuntime, source: string, label: string): Promise<void> {
  let steps: DemoEventStep[];
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not an array');
    steps = parsed as DemoEventStep[];
  } catch {
    throw new Error(`${label}: events="…" — ожидался JSON-массив шагов [{"type":"gui.Button","text":"…","event":"click"}, {"tick": 0.5}]`);
  }
  for (const [index, step] of steps.entries()) {
    const stepLabel = `${label}, шаг событий ${index + 1}`;
    if (typeof step.tick === 'number') {
      await advanceGuiTime(runtime, step.tick, stepLabel);
      continue;
    }
    if (!step.type || !step.event) throw new Error(`${stepLabel}: у шага нужны type и event (или tick)`);
    const target = pickWidget(runtime, step, stepLabel);
    try {
      await runtime.dispatchGuiEvent(target.id, step.event, step.payload ?? {});
    } catch (error) {
      throw new Error(`${stepLabel}: обработчик ${step.event} у ${step.type} упал:\n${describeRuntimeError(error, 'main.idyl')}`);
    }
  }
}

function pickWidget(runtime: IdylliumRuntime, step: DemoEventStep, label: string): WidgetLike {
  const all: WidgetLike[] = [];
  const visit = (nodes: readonly WidgetLike[] | undefined): void => {
    for (const node of nodes ?? []) {
      all.push(node);
      visit(node.children);
    }
  };
  visit(runtime.getWindows() as unknown as readonly WidgetLike[]);
  // Диалоги живут не в дереве окна — их отдаёт отдельный список.
  for (const modal of runtime.getModals()) all.push(modal as unknown as WidgetLike);
  const byType = all.filter((node) => node.type === step.type);
  if (step.text !== undefined) {
    const hit = byType.find((node) => node.properties.text === step.text);
    if (!hit) throw new Error(`${label}: не найден ${step.type} с text=${JSON.stringify(step.text)}`);
    return hit;
  }
  const hit = byType[step.index ?? 0];
  if (!hit) throw new Error(`${label}: не найден ${step.type} №${(step.index ?? 0) + 1}`);
  return hit;
}

interface FrameSize {
  readonly width: number;
  readonly height: number;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Размер кадра: окна — по раскладке рендерера, холсты без окон — столбиком с промежутком. */
function frameSize(snapshot: Record<string, unknown>): FrameSize | null {
  const size = contentFrameSize(snapshot);
  const modals = snapshot.modals as readonly unknown[];
  if (!size || modals.length === 0) return size;
  // Диалог рисуется поверх кадра (.modal-dialog: до 420 px шириной, поля 24 px, заголовок,
  // текст, поле ввода и кнопки): маленькое окно не должно обрезать его.
  return { width: Math.max(size.width, MODAL_FRAME_MIN.width), height: Math.max(size.height, MODAL_FRAME_MIN.height) };
}

const MODAL_FRAME_MIN: FrameSize = { width: 468, height: 300 };

function contentFrameSize(snapshot: Record<string, unknown>): FrameSize | null {
  const windows = snapshot.windows as readonly WidgetLike[];
  const canvases = snapshot.canvases as readonly WidgetLike[];
  const modals = snapshot.modals as readonly unknown[];
  if (windows.length > 0) {
    let cursorX = 0;
    let right = 0;
    let bottom = 0;
    for (const win of windows) {
      const width = positiveNumber(win.properties.width, 640) + WINDOW_FRAME_BORDER * 2;
      const height = positiveNumber(win.properties.height, 420) + WINDOW_TITLEBAR_HEIGHT + WINDOW_FRAME_BORDER * 2;
      const explicit = win.properties.__explicit_properties;
      const positioned = Array.isArray(explicit) && (explicit.includes('x') || explicit.includes('y'));
      let x: number;
      let y: number;
      if (positioned) {
        x = numberValue(win.properties.x);
        y = numberValue(win.properties.y);
      } else {
        x = cursorX;
        y = 0;
        cursorX += width + WINDOW_LAYOUT_GAP;
      }
      right = Math.max(right, x + width);
      bottom = Math.max(bottom, y + height);
    }
    return { width: Math.ceil(right), height: Math.ceil(bottom) };
  }
  if (canvases.length > 0) {
    let width = 0;
    let height = 0;
    for (const canvas of canvases) {
      width = Math.max(width, positiveNumber(canvas.properties.width, 640));
      height += positiveNumber(canvas.properties.height, 420);
    }
    height += WINDOW_LAYOUT_GAP * (canvases.length - 1);
    return { width: Math.ceil(width), height: Math.ceil(height) };
  }
  // Диалог без окна: кадр под .modal-dialog рендерера.
  if (modals.length > 0) return MODAL_FRAME_MIN;
  return null;
}
