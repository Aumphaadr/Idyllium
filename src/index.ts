// src/index.ts

import { Lexer } from './compiler/lexer';
import { Parser } from './compiler/parser';
import { Analyzer, SemanticInfo } from './compiler/analyzer';
import { CodeGenerator } from './compiler/codegen';
import { ErrorCollector, CompileError } from './compiler/errors';
import { Program } from './compiler/ast';
import { Token } from './compiler/tokens';
import {
    createRuntime,
    IdylRuntime,
    ConsoleIO,
    RuntimeOptions,
    VirtualFS,
    InMemoryFS,
    IdylRuntimeError,
} from './runtime/runtime';

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

export function compileIdyllium(
    source: string,
    file: string = 'main.idyl',
    fileResolver?: FileResolver
): CompileResult {
    const errors = new ErrorCollector(100);
    let tokens: Token[] = [];
    let ast: Program | null = null;
    let semanticInfo: SemanticInfo | null = null;
    let jsCode: string | null = null;

    const lexer = new Lexer(source, file, errors);
    tokens = lexer.tokenize();

    if (!errors.isOverflow()) {
        const parser = new Parser(tokens, file, errors);
        ast = parser.parse();
    }

    if (ast !== null && !errors.isOverflow()) {
        const analyzer = new Analyzer(file, errors, fileResolver ?? null);
        semanticInfo = analyzer.analyze(ast);
    }

    if (ast !== null && semanticInfo !== null && !errors.hasErrors()) {
        const codegen = new CodeGenerator(semanticInfo, ast);
        jsCode = codegen.generate(ast);
    }

    return {
        success: !errors.hasErrors(),
        jsCode,
        errors: errors.getErrors(),
        warnings: errors.getWarnings(),
        diagnostics: errors.format(),
        tokens,
        ast,
        semanticInfo,
    };
}

export async function runIdyllium(
    source: string,
    options?: Partial<RuntimeOptions>,
    file: string = 'main.idyl',
): Promise<RunResult> {

    let fileResolver: FileResolver | undefined;
    if (options?.fs) {
        fileResolver = {
            resolve(moduleName: string): string | null {
                const fileName = moduleName.endsWith('.idyl') 
                    ? moduleName 
                    : `${moduleName}.idyl`;
                return options.fs!.read(fileName);
            }
        };
    }

    const compilation = compileIdyllium(source, file, fileResolver);

    if (!compilation.success || compilation.jsCode === null) {
        return {
            success: false,
            runtimeError: null,
            output: '',
            executionTimeMs: 0,
            compilation,
        };
    }

    let outputBuffer = '';

    const defaultConsoleIO: ConsoleIO = {
        print(text: string): void {
            outputBuffer += text;
        },
        readLine(): Promise<string> {
            return Promise.resolve('');
        },
    };

    const consoleIO = options?.console ?? defaultConsoleIO;

    const wrappedConsoleIO: ConsoleIO = {
        print(text: string): void {
            outputBuffer += text;
            consoleIO.print(text);
        },
        readLine(): Promise<string> {
            return consoleIO.readLine();
        },
    };

    const finalConsoleIO = options?.console
        ? wrappedConsoleIO
        : defaultConsoleIO;

    const runtime = createRuntime({
        console: finalConsoleIO,
        fs: options?.fs,
    });

    const startTime = performance.now();
    let runtimeError: string | null = null;

    try {
        const AsyncFunction = Object.getPrototypeOf(
            async function () {}
        ).constructor;

        const executor = new AsyncFunction('$rt', `
            const __fn = ${compilation.jsCode};
            return __fn($rt);
        `);

        await executor(runtime);

    } catch (err: unknown) {
        if (err instanceof IdylRuntimeError) {
            runtimeError = err.message;
        } else if (err instanceof Error) {
            runtimeError = `internal error: ${err.message}`;
        } else {
            runtimeError = `unknown error: ${String(err)}`;
        }
    }

    const executionTimeMs = performance.now() - startTime;

    return {
        success: runtimeError === null,
        runtimeError,
        output: outputBuffer,
        executionTimeMs,
        compilation,
    };
}

export async function quickRun(source: string, file?: string): Promise<string> {
    const result = await runIdyllium(source, undefined, file);

    if (!result.compilation.success) {
        throw new Error(
            `Compilation failed:\n${result.compilation.diagnostics}`
        );
    }

    if (!result.success) {
        throw new Error(result.runtimeError ?? 'Unknown runtime error');
    }

    return result.output;
}

export interface IdylSession {
    compile(source: string, file?: string): CompileResult;
    run(source: string, file?: string): Promise<RunResult>;
    readonly fs: VirtualFS;
}

export function createSession(options: Partial<RuntimeOptions> = {}): IdylSession {
    const fs = options.fs ?? new InMemoryFS();

    return {
        compile(source: string, file: string = 'main.idyl'): CompileResult {
            const fileResolver: FileResolver = {
                resolve(moduleName: string): string | null {
                    const fileName = moduleName.endsWith('.idyl') 
                        ? moduleName 
                        : `${moduleName}.idyl`;
                    return fs.read(fileName);
                }
            };
            return compileIdyllium(source, file, fileResolver);
        },

        async run(source: string, file: string = 'main.idyl'): Promise<RunResult> {
            return runIdyllium(source, { ...options, fs }, file);
        },

        fs,
    };
}

export { ErrorCollector, CompileError, ErrorSeverity } from './compiler/errors';
export { Token, TokenType, tokenTypeName } from './compiler/tokens';
export { Program } from './compiler/ast';
export { SemanticInfo } from './compiler/analyzer';
export {
    createRuntime,
    IdylRuntime,
    ConsoleIO,
    RuntimeOptions,
    VirtualFS,
    InMemoryFS,
    IdylRuntimeError,
} from './runtime/runtime';