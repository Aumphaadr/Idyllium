import { SemanticInfo } from './compiler/analyzer';
import { CompileError } from './compiler/errors';
import { Program } from './compiler/ast';
import { Token } from './compiler/tokens';
import { RuntimeOptions, VirtualFS } from './runtime/runtime';
export interface FileResolver {
    resolve(moduleName: string): string | null;
}
export interface CompileResult {
    readonly success: boolean;
    readonly jsCode: string | null;
    readonly errors: CompileError[];
    readonly warnings: CompileError[];
    readonly diagnostics: string;
    readonly tokens: Token[];
    readonly ast: Program | null;
    readonly semanticInfo: SemanticInfo | null;
}
export interface RunResult {
    readonly success: boolean;
    readonly runtimeError: string | null;
    readonly output: string;
    readonly executionTimeMs: number;
    readonly compilation: CompileResult;
}
export declare function compileIdyllium(source: string, file?: string, fileResolver?: FileResolver): CompileResult;
export declare function runIdyllium(source: string, options?: Partial<RuntimeOptions>, file?: string): Promise<RunResult>;
export declare function quickRun(source: string, file?: string): Promise<string>;
export interface IdylSession {
    compile(source: string, file?: string): CompileResult;
    run(source: string, file?: string): Promise<RunResult>;
    readonly fs: VirtualFS;
}
export declare function createSession(options?: Partial<RuntimeOptions>): IdylSession;
export { ErrorCollector, CompileError, ErrorSeverity } from './compiler/errors';
export { Token, TokenType, tokenTypeName } from './compiler/tokens';
export { Program } from './compiler/ast';
export { SemanticInfo } from './compiler/analyzer';
export { createRuntime, IdylRuntime, ConsoleIO, RuntimeOptions, VirtualFS, InMemoryFS, IdylRuntimeError, } from './runtime/runtime';
//# sourceMappingURL=index.d.ts.map