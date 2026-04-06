// src/compiler/errors.ts

export enum ErrorSeverity {
    ERROR   = 'error',
    WARNING = 'warning',
}

export interface CompileError {
    readonly file: string;
    readonly line: number;
    readonly severity: ErrorSeverity;
    readonly message: string;
}

export class ErrorCollector {
    private diagnostics: CompileError[] = [];
    private maxErrors: number;

    constructor(maxErrors: number = 100) {
        this.maxErrors = maxErrors;
    }

    addError(file: string, line: number, message: string): void {
        if (this.maxErrors > 0 && this.errorCount() >= this.maxErrors) {
            return;
        }
        this.diagnostics.push({
            file,
            line,
            severity: ErrorSeverity.ERROR,
            message,
        });
    }

    addWarning(file: string, line: number, message: string): void {
        this.diagnostics.push({
            file,
            line,
            severity: ErrorSeverity.WARNING,
            message,
        });
    }

    hasErrors(): boolean {
        return this.diagnostics.some(d => d.severity === ErrorSeverity.ERROR);
    }

    errorCount(): number {
        return this.diagnostics.filter(d => d.severity === ErrorSeverity.ERROR).length;
    }

    totalCount(): number {
        return this.diagnostics.length;
    }

    getAll(): CompileError[] {
        return [...this.diagnostics];
    }

    getErrors(): CompileError[] {
        return this.diagnostics.filter(d => d.severity === ErrorSeverity.ERROR);
    }

    getWarnings(): CompileError[] {
        return this.diagnostics.filter(d => d.severity === ErrorSeverity.WARNING);
    }

    isOverflow(): boolean {
        return this.maxErrors > 0 && this.errorCount() >= this.maxErrors;
    }

    static formatOne(err: CompileError): string {
        return `${err.file}:${err.line}: ${err.severity}: ${err.message}`;
    }

    format(): string {
        const sorted = [...this.diagnostics].sort((a, b) => {
            if (a.file !== b.file) return a.file.localeCompare(b.file);
            return a.line - b.line;
        });
        let result = sorted.map(ErrorCollector.formatOne).join('\n');
        if (this.isOverflow()) {
            result += `\n... too many errors (limit: ${this.maxErrors})`;
        }
        return result;
    }

    clear(): void {
        this.diagnostics = [];
    }
}