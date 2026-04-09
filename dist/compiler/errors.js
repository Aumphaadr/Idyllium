"use strict";
// src/compiler/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCollector = exports.ErrorSeverity = void 0;
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["WARNING"] = "warning";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
class ErrorCollector {
    constructor(maxErrors = 100) {
        this.diagnostics = [];
        this.maxErrors = maxErrors;
    }
    addError(file, line, message) {
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
    addWarning(file, line, message) {
        this.diagnostics.push({
            file,
            line,
            severity: ErrorSeverity.WARNING,
            message,
        });
    }
    hasErrors() {
        return this.diagnostics.some(d => d.severity === ErrorSeverity.ERROR);
    }
    errorCount() {
        return this.diagnostics.filter(d => d.severity === ErrorSeverity.ERROR).length;
    }
    totalCount() {
        return this.diagnostics.length;
    }
    getAll() {
        return [...this.diagnostics];
    }
    getErrors() {
        return this.diagnostics.filter(d => d.severity === ErrorSeverity.ERROR);
    }
    getWarnings() {
        return this.diagnostics.filter(d => d.severity === ErrorSeverity.WARNING);
    }
    isOverflow() {
        return this.maxErrors > 0 && this.errorCount() >= this.maxErrors;
    }
    static formatOne(err) {
        return `${err.file}:${err.line}: ${err.severity}: ${err.message}`;
    }
    format() {
        const sorted = [...this.diagnostics].sort((a, b) => {
            if (a.file !== b.file)
                return a.file.localeCompare(b.file);
            return a.line - b.line;
        });
        let result = sorted.map(ErrorCollector.formatOne).join('\n');
        if (this.isOverflow()) {
            result += `\n... too many errors (limit: ${this.maxErrors})`;
        }
        return result;
    }
    clear() {
        this.diagnostics = [];
    }
}
exports.ErrorCollector = ErrorCollector;
//# sourceMappingURL=errors.js.map