// Общие разборщики блоков урока: <idyl-code-block> / <idyl-output-block> /
// <idyl-error-block>, модули многофайловых примеров и таблица причин
// «программу не запускать». Один источник для сверки выводов
// (check-lesson-outputs.ts) и запекания демонстраций (lesson-gui-demos.ts).

export interface LessonBlock {
  readonly kind: 'code' | 'output' | 'error';
  readonly start: number;
  readonly end: number;
  readonly inner: string;
}

const BLOCK_RE = /<(idyl-code-block|idyl-output-block|idyl-error-block)>\s*(?:<script type="text\/plain">)?([\s\S]*?)(?:<\/script>\s*)?<\/\1>/gu;

export function unescapeHtml(text: string): string {
  return text.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&amp;/gu, '&');
}

export function escapeHtml(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

export function normalizeText(text: string): string {
  return text.replace(/\r\n/gu, '\n').split('\n').map((line) => line.replace(/\s+$/u, '')).join('\n').trim();
}

export function parseBlocks(html: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(html)) !== null) {
    const kind = match[1] === 'idyl-code-block' ? 'code' : match[1] === 'idyl-output-block' ? 'output' : 'error';
    blocks.push({ kind, start: match.index, end: match.index + match[0].length, inner: match[2] });
  }
  return blocks;
}

/** Текст программы блока так, как его видит ученик (та же нормализация, что у IdylCodeBlock в app.js). */
export function blockCode(block: LessonBlock): string {
  return unescapeHtml(block.inner.replace(/^\n/u, '').replace(/\n\s*$/u, ''));
}

/** Почему программу нельзя запускать для сверки вывода; null — можно. */
export function skipReason(code: string): string | null {
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

export function moduleFileName(block: LessonBlock): string | null {
  if (block.kind !== 'code') return null;
  const header = MODULE_HEADER_RE.exec(blockCode(block).split('\n')[0] ?? '');
  if (!header || header[1] === 'main.idyl') return null;
  return header[1];
}

export function collectModuleSources(blocks: readonly LessonBlock[]): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const block of blocks) {
    const name = moduleFileName(block);
    if (name) sources[name] = blockCode(block);
  }
  return sources;
}
