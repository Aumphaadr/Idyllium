// Сверяет <idyl-output-block> уроков с фактическим выводом компилятора.
// Каждый standalone-блок кода выполняется в памяти; следующий за ним
// output-блок сравнивается с реальным выводом. Ошибочные программы сверяются
// с <idyl-error-block>. Режим --fix переписывает расходящиеся output-блоки.
//
// У каждой программы свой лимит времени (--timeout, по умолчанию 15 секунд):
// пример, который ждёт вечно — поднятый веб-сервер, канал, долгий сетевой
// запрос, — снимается по abortSignal, называется в отчёте и не мешает
// остальным. Без этого один такой блок вешал весь прогон молча.
//
// Использование:
//   node dist/tools/check-lesson-outputs.js [--root packages/docs/manual-content] [--fix] [--timeout 15]

import { compileIdyllium, createMemoryRuntimeFileSystem, runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

interface LessonBlock {
  readonly kind: 'code' | 'output' | 'error';
  readonly start: number;
  readonly end: number;
  readonly inner: string;
}

const BLOCK_RE = /<(idyl-code-block|idyl-output-block|idyl-error-block)>\s*(?:<script type="text\/plain">)?([\s\S]*?)(?:<\/script>\s*)?<\/\1>/gu;

function unescapeHtml(text: string): string {
  return text.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&amp;/gu, '&');
}

function escapeHtml(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/gu, '\n').split('\n').map((line) => line.replace(/\s+$/u, '')).join('\n').trim();
}

function parseBlocks(html: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(html)) !== null) {
    const kind = match[1] === 'idyl-code-block' ? 'code' : match[1] === 'idyl-output-block' ? 'output' : 'error';
    blocks.push({ kind, start: match.index, end: match.index + match[0].length, inner: match[2] });
  }
  return blocks;
}

function skipReason(code: string): string | null {
  if (!/\bmain\s*\(/u.test(code)) return 'not a standalone program';
  if (/console\.get_/u.test(code)) return 'needs interactive input';
  if (/\btime\.now\s*\(/u.test(code)) return 'uses time.now()';
  if (/\brandom\./u.test(code) && !/set_seed/u.test(code)) return 'unseeded random';
  if (/\btime\.sleep\s*\(/u.test(code)) return 'uses time.sleep()';
  if (/\bon_(?:mouse|key)_/u.test(code)) return 'output depends on interactive events';
  return null;
}

// Блок, начинающийся с комментария «// имя.idyl», — модуль многофайлового
// примера: он попадает в sources урока, чтобы соседние блоки могли его
// подключить через use.
const MODULE_HEADER_RE = /^\/\/\s*([\w-]+\.idyl)\b/u;

function moduleFileName(block: LessonBlock): string | null {
  if (block.kind !== 'code') return null;
  const code = unescapeHtml(block.inner.replace(/^\n/u, '').replace(/\n\s*$/u, ''));
  const header = MODULE_HEADER_RE.exec(code.split('\n')[0] ?? '');
  if (!header || header[1] === 'main.idyl') return null;
  return header[1];
}

function collectModuleSources(blocks: readonly LessonBlock[]): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const block of blocks) {
    const name = moduleFileName(block);
    if (name) sources[name] = unescapeHtml(block.inner.replace(/^\n/u, '').replace(/\n\s*$/u, ''));
  }
  return sources;
}

interface TimedRun {
  readonly result: Awaited<ReturnType<typeof runIdyllium>> | null;
  readonly timedOut: boolean;
}

/** Запускает программу урока с лимитом времени. Рантайм умеет останавливаться
 *  по abortSignal — сначала просим его вежливо, а гонка с таймером страхует на
 *  случай, если программа зависла там, где сигнал не проверяется. */
async function runWithTimeout(
  code: string,
  runtimeOptions: Record<string, unknown>,
  compileOptions: Record<string, unknown>,
  timeoutMs: number,
): Promise<TimedRun> {
  const controller = new AbortController();
  let timer: any = null;
  const guard = new Promise<TimedRun>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      // Даём рантайму мгновение свернуться по сигналу, потом уходим без него.
      setTimeout(() => resolve({ result: null, timedOut: true }), 250);
    }, timeoutMs);
  });

  const run = (async (): Promise<TimedRun> => {
    const result = await runIdyllium(
      code,
      { ...runtimeOptions, abortSignal: controller.signal } as any,
      compileOptions as any,
    );
    return { result, timedOut: false };
  })();

  const outcome = await Promise.race([run, guard]);
  if (timer !== null) clearTimeout(timer);
  // Программа, брошенная по таймауту, могла упасть позже — её отказ никому
  // не нужен, но и падать процессу из-за него нельзя.
  run.catch(() => {});
  // Рантайм послушался сигнала и снялся сам: для отчёта это тот же таймаут,
  // просто снятие прошло вежливо.
  if (!outcome.timedOut && outcome.result?.runtimeError?.includes('program was stopped')) {
    return { result: null, timedOut: true };
  }
  return outcome;
}

async function main(): Promise<void> {
  const rootArg = process.argv.includes('--root')
    ? process.argv[process.argv.indexOf('--root') + 1]
    : 'packages/docs/manual-content';
  const fix = process.argv.includes('--fix');
  // Лимит на ОДНУ программу. Без него один пример, который ждёт вечно
  // (поднятый веб-сервер, канал, долгий сетевой запрос), вешал весь прогон:
  // инструмент молчал часами и не называл виновника.
  const timeoutArg = process.argv.includes('--timeout')
    ? Number(process.argv[process.argv.indexOf('--timeout') + 1])
    : 15;
  const timeoutMs = Number.isFinite(timeoutArg) && timeoutArg > 0 ? timeoutArg * 1000 : 15000;
  const root = path.resolve(process.cwd(), rootArg);

  const files: string[] = [];
  (function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.name.endsWith('.html')) files.push(absolute);
    }
  })(root);
  files.sort();

  let checkedOutputs = 0;
  let checkedErrors = 0;
  let fixed = 0;
  const diffs: string[] = [];
  const errorDiffs: string[] = [];
  const infos: string[] = [];
  const timeouts: string[] = [];

  const assetsRoot = path.resolve(process.cwd(), 'packages', 'docs', 'book-assets');
  const assetEntries: Record<string, { bytes: Uint8Array }> = {};
  if (fs.existsSync(assetsRoot)) {
    for (const name of fs.readdirSync(assetsRoot)) {
      assetEntries[name] = { bytes: new Uint8Array(fs.readFileSync(path.join(assetsRoot, name))) };
    }
  }

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8') as string;
    const relative = path.relative(process.cwd(), file);
    let changed = false;

    // Одна файловая система на весь урок: блоки часто продолжают друг друга
    // (создали файл — читаем его в следующем примере). Ассеты книги доступны
    // программам так же, как в проекте ученика.
    const lessonDir = path.dirname(file);
    const seeded: Record<string, any> = {};
    for (const [name, entry] of Object.entries(assetEntries)) {
      seeded[path.join(lessonDir, name)] = entry;
    }
    const fileSystem = createMemoryRuntimeFileSystem(seeded, lessonDir);
    // url.open() в примере не должен открывать браузер разработчика:
    // подменяем открывалку на пустую.
    const urlOpener = { open(): void {} };
    const moduleSources = collectModuleSources(parseBlocks(html));

    // Пересчитываем блоки после каждой правки: --fix смещает позиции.
    for (let index = 0; ; index++) {
      const blocks = parseBlocks(html);
      if (index >= blocks.length) break;
      const block = blocks[index];
      if (block.kind !== 'code') continue;

      const code = unescapeHtml(block.inner.replace(/^\n/u, '').replace(/\n\s*$/u, ''));
      const reason = skipReason(code);
      if (reason) continue;

      // Ожидаемый output/error-блок может отделяться модульными блоками
      // (программа → её модуль b.idyl → error-блок): перешагиваем их. Но модуль
      // с собственным main() — сам программа: он заберёт СВОЙ error-блок, и
      // перешагивать через него нельзя (иначе предыдущий пример украдёт блок).
      let nextIndex = index + 1;
      while (
        blocks[nextIndex]?.kind === 'code'
        && moduleFileName(blocks[nextIndex]) !== null
        && !/\bmain\s*\(/u.test(unescapeHtml(blocks[nextIndex].inner))
      ) nextIndex += 1;
      let next = blocks[nextIndex];
      // В задачниках ожидаемый вывод стоит ПЕРЕД программой: сначала «что
      // должно получиться», потом код задания. Значит блок после программы —
      // это уже вывод СЛЕДУЮЩЕГО задания, и сверять с ним нельзя (иначе
      // рождаются призрачные расхождения со сдвигом на одно задание).
      // Признак границы — заголовок задания между блоками.
      if (next !== undefined && /class="task-(?:item|group)"/u.test(html.slice(block.end, next.start))) {
        next = undefined as unknown as LessonBlock;
      }
      const run = await runWithTimeout(code, { fileSystem, urlOpener }, { file: 'main.idyl', sources: moduleSources }, timeoutMs);
      if (run.timedOut) {
        timeouts.push(`${relative}: программа не завершилась за ${Math.round(timeoutMs / 1000)} с — проверка блока пропущена (первая строка: ${code.split('\n').find((line) => line.trim() !== '') ?? ''})`);
        continue;
      }
      const result = run.result!;

      if (!result.compilation.success) {
        if (next?.kind === 'error') {
          checkedErrors += 1;
          const expected = normalizeText(unescapeHtml(next.inner));
          const actual = normalizeText(result.compilation.diagnosticsText);
          if (expected !== actual) {
            errorDiffs.push(`${relative}: error-block\n  в уроке : ${expected.split('\n').join(' | ')}\n  фактически: ${actual.split('\n').join(' | ')}`);
          }
        } else {
          infos.push(`${relative}: блок не компилируется (нет error-блока — вероятно, фрагмент или многофайловый пример): ${result.compilation.diagnosticsText.split('\n')[0]}`);
        }
        continue;
      }

      if (!result.success) {
        if (next?.kind === 'error') {
          checkedErrors += 1;
          const expected = normalizeText(unescapeHtml(next.inner));
          const actual = normalizeText(result.runtimeError ?? '');
          if (expected !== actual) {
            errorDiffs.push(`${relative}: error-block (runtime)\n  в уроке : ${expected.split('\n').join(' | ')}\n  фактически: ${actual.split('\n').join(' | ')}`);
          }
        }
        continue;
      }

      if (next?.kind === 'error') {
        // Программа успешна, а урок обещает ошибку. Возможно, урок учит
        // ситуации «соседнего файла НЕТ» — а мы его материализовали из
        // sources. Перепроверяем в мире без модулей: совпало — засчитано.
        checkedErrors += 1;
        const expected = normalizeText(unescapeHtml(next.inner));
        const bareRun = await runWithTimeout(code, { fileSystem, urlOpener }, { file: 'main.idyl' }, timeoutMs);
        if (bareRun.timedOut) {
          timeouts.push(`${relative}: повторная проверка без модулей не завершилась за ${Math.round(timeoutMs / 1000)} с`);
          continue;
        }
        const bare = bareRun.result!;
        const bareActual = normalizeText(
          bare.compilation.success ? (bare.runtimeError ?? '') : bare.compilation.diagnosticsText,
        );
        if (bareActual !== expected) {
          errorDiffs.push(`${relative}: error-block\n  в уроке : ${expected.split('\n').join(' | ')}\n  фактически: программа выполняется успешно, ошибки нет`);
        }
        continue;
      }
      if (next?.kind !== 'output') continue;
      if (/<span\b/u.test(next.inner)) continue; // оформленный вывод (ANSI-цвета)
      checkedOutputs += 1;
      const expected = normalizeText(unescapeHtml(next.inner));
      const actual = normalizeText(result.output);
      if (expected === actual) continue;

      if (fix) {
        const replacement = `<idyl-output-block>${escapeHtml(actual)}</idyl-output-block>`;
        html = html.slice(0, next.start) + replacement + html.slice(next.end);
        changed = true;
        fixed += 1;
      } else {
        diffs.push(`${relative}: output-block\n  в уроке : ${expected.split('\n').join(' | ')}\n  фактически: ${actual.split('\n').join(' | ')}`);
      }
    }

    if (changed) fs.writeFileSync(file, html, 'utf8');
  }

  console.log(`lesson outputs: проверено output-блоков ${checkedOutputs}, error-блоков ${checkedErrors}${fix ? `, исправлено ${fixed}` : ''}${timeouts.length > 0 ? `, пропущено по времени ${timeouts.length}` : ''}`);
  if (timeouts.length > 0) {
    console.log(`\n--- Не уложились в ${Math.round(timeoutMs / 1000)} с (${timeouts.length}) ---`);
    for (const line of timeouts) console.log(line);
  }
  if (diffs.length > 0) {
    console.log(`\n--- Расхождения вывода (${diffs.length}) ---`);
    for (const diff of diffs) console.log(diff);
  }
  if (errorDiffs.length > 0) {
    console.log(`\n--- Расхождения текстов ошибок (${errorDiffs.length}) ---`);
    for (const diff of errorDiffs) console.log(diff);
  }
  if (infos.length > 0) {
    console.log(`\n--- К сведению (${infos.length}) ---`);
    for (const info of infos) console.log(info);
  }
  if (!fix && diffs.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
