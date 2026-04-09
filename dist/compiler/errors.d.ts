export declare enum ErrorSeverity {
    ERROR = "error",
    WARNING = "warning"
}
export interface CompileError {
    readonly file: string;
    readonly line: number;
    readonly severity: ErrorSeverity;
    readonly message: string;
}
export declare class ErrorCollector {
    private diagnostics;
    private maxErrors;
    constructor(maxErrors?: number);
    addError(file: string, line: number, message: string): void;
    addWarning(file: string, line: number, message: string): void;
    hasErrors(): boolean;
    errorCount(): number;
    totalCount(): number;
    getAll(): CompileError[];
    getErrors(): CompileError[];
    getWarnings(): CompileError[];
    isOverflow(): boolean;
    static formatOne(err: CompileError): string;
    format(): string;
    clear(): void;
}
//# sourceMappingURL=errors.d.ts.map