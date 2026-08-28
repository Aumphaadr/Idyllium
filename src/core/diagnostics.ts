export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface SourceRange {
  readonly start: SourceLocation;
  readonly end: SourceLocation;
}

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly range: SourceRange;
  readonly code?: string;
}

export class DiagnosticBag {
  private readonly diagnostics: Diagnostic[] = [];

  error(range: SourceRange, message: string, code?: string): void {
    this.add('error', range, message, code);
  }

  warning(range: SourceRange, message: string, code?: string): void {
    this.add('warning', range, message, code);
  }

  info(range: SourceRange, message: string, code?: string): void {
    this.add('info', range, message, code);
  }

  add(
    severity: DiagnosticSeverity,
    range: SourceRange,
    message: string,
    code?: string,
  ): void {
    // Внутренний плейсхолдер испорченного типа наружу не выходит НИКОГДА
    // (вердикт владельца 2026-08-23). Он появляется только там, где о настоящей
    // ошибке уже сказано (неизвестное имя, чужой член, неведомый тип), поэтому
    // такое сообщение — всегда эхо первого, и человеку оно ничего не объясняет.
    if (message.includes('<error>')) return;
    this.diagnostics.push({ severity, range, message, code });
  }

  hasErrors(): boolean {
    return this.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  }

  all(): Diagnostic[] {
    return [...this.diagnostics];
  }

  errors(): Diagnostic[] {
    return this.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  }
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const { start } = diagnostic.range;
  const code = diagnostic.code ? ` ${diagnostic.code}` : '';
  // Человеку ошибки компиляции показываются как «compile error», предупреждения
  // — «compile warning»: симметрия с «runtime error» / «runtime warning»
  // (вердикт владельца 2026-08-28). Внутренняя severity остаётся короткой.
  const label = diagnostic.severity === 'error'
    ? 'compile error'
    : diagnostic.severity === 'warning'
      ? 'compile warning'
      : diagnostic.severity;
  return `${start.file}:${start.line}:${start.column}: ${label}${code}: ${diagnostic.message}`;
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map(formatDiagnostic).join('\n');
}

export function pointRange(location: SourceLocation): SourceRange {
  return { start: location, end: location };
}
