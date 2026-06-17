export interface FormatIdylliumOptions {
  readonly indentSize?: number;
  readonly insertSpaces?: boolean;
  readonly trimTrailingWhitespace?: boolean;
  readonly insertFinalNewline?: boolean;
}

interface BraceScanState {
  inBlockComment: boolean;
}

export function formatIdyllium(source: string, options: FormatIdylliumOptions = {}): string {
  const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
  const normalized = source.replace(/\r\n?/gu, '\n');
  const hadFinalNewline = normalized.endsWith('\n');
  const rawLines = normalized.split('\n');
  const contentLines = hadFinalNewline ? rawLines.slice(0, -1) : rawLines;

  const indentSize = Math.max(1, Math.trunc(options.indentSize ?? 4));
  const indentText = options.insertSpaces === false ? '\t' : ' '.repeat(indentSize);
  const trimTrailingWhitespace = options.trimTrailingWhitespace ?? true;
  const insertFinalNewline = options.insertFinalNewline ?? hadFinalNewline;

  let indent = 0;
  const state: BraceScanState = { inBlockComment: false };
  const formatted: string[] = [];

  for (const rawLine of contentLines) {
    const line = trimTrailingWhitespace ? rawLine.replace(/[ \t]+$/u, '') : rawLine;
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      formatted.push('');
      continue;
    }

    const leadingClosers = leadingClosingBraces(trimmed);
    const lineIndent = Math.max(0, indent - leadingClosers);
    formatted.push(`${indentText.repeat(lineIndent)}${trimmed}`);

    const scan = braceBalance(trimmed, state.inBlockComment);
    state.inBlockComment = scan.inBlockComment;
    indent = Math.max(0, indent + scan.balance);
  }

  let result = formatted.join(lineEnding);
  if (insertFinalNewline) result += lineEnding;
  return result;
}

function leadingClosingBraces(line: string): number {
  let count = 0;
  while (line[count] === '}') count++;
  return count;
}

function braceBalance(line: string, inBlockComment: boolean): { balance: number; inBlockComment: boolean } {
  let balance = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && next === '/') break;
    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') balance++;
    if (char === '}') balance--;
  }

  return { balance, inBlockComment };
}
