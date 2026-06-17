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
  return `${start.file}:${start.line}:${start.column}: ${diagnostic.severity}${code}: ${diagnostic.message}`;
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map(formatDiagnostic).join('\n');
}

export function pointRange(location: SourceLocation): SourceRange {
  return { start: location, end: location };
}
