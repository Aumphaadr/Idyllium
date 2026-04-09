"use strict";
// src/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdylRuntimeError = exports.InMemoryFS = exports.createRuntime = exports.tokenTypeName = exports.TokenType = exports.ErrorSeverity = exports.ErrorCollector = void 0;
exports.compileIdyllium = compileIdyllium;
exports.runIdyllium = runIdyllium;
exports.quickRun = quickRun;
exports.createSession = createSession;
const lexer_1 = require("./compiler/lexer");
const parser_1 = require("./compiler/parser");
const analyzer_1 = require("./compiler/analyzer");
const codegen_1 = require("./compiler/codegen");
const errors_1 = require("./compiler/errors");
const runtime_1 = require("./runtime/runtime");
function compileIdyllium(source, file = 'main.idyl', fileResolver) {
    const errors = new errors_1.ErrorCollector(100);
    let tokens = [];
    let ast = null;
    let semanticInfo = null;
    let jsCode = null;
    const lexer = new lexer_1.Lexer(source, file, errors);
    tokens = lexer.tokenize();
    if (!errors.isOverflow()) {
        const parser = new parser_1.Parser(tokens, file, errors);
        ast = parser.parse();
    }
    if (ast !== null && !errors.isOverflow()) {
        const analyzer = new analyzer_1.Analyzer(file, errors, fileResolver ?? null);
        semanticInfo = analyzer.analyze(ast);
    }
    if (ast !== null && semanticInfo !== null && !errors.hasErrors()) {
        const codegen = new codegen_1.CodeGenerator(semanticInfo, ast);
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
async function runIdyllium(source, options, file = 'main.idyl') {
    let fileResolver;
    if (options?.fs) {
        fileResolver = {
            resolve(moduleName) {
                const fileName = moduleName.endsWith('.idyl')
                    ? moduleName
                    : `${moduleName}.idyl`;
                return options.fs.read(fileName);
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
    const defaultConsoleIO = {
        print(text) {
            outputBuffer += text;
        },
        readLine() {
            return Promise.resolve('');
        },
    };
    const consoleIO = options?.console ?? defaultConsoleIO;
    const wrappedConsoleIO = {
        print(text) {
            outputBuffer += text;
            consoleIO.print(text);
        },
        readLine() {
            return consoleIO.readLine();
        },
    };
    const finalConsoleIO = options?.console
        ? wrappedConsoleIO
        : defaultConsoleIO;
    const runtime = (0, runtime_1.createRuntime)({
        console: finalConsoleIO,
        fs: options?.fs,
    });
    const startTime = performance.now();
    let runtimeError = null;
    try {
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const executor = new AsyncFunction('$rt', `
            const __fn = ${compilation.jsCode};
            return __fn($rt);
        `);
        await executor(runtime);
    }
    catch (err) {
        if (err instanceof runtime_1.IdylRuntimeError) {
            runtimeError = err.message;
        }
        else if (err instanceof Error) {
            runtimeError = `internal error: ${err.message}`;
        }
        else {
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
async function quickRun(source, file) {
    const result = await runIdyllium(source, undefined, file);
    if (!result.compilation.success) {
        throw new Error(`Compilation failed:\n${result.compilation.diagnostics}`);
    }
    if (!result.success) {
        throw new Error(result.runtimeError ?? 'Unknown runtime error');
    }
    return result.output;
}
function createSession(options = {}) {
    const fs = options.fs ?? new runtime_1.InMemoryFS();
    return {
        compile(source, file = 'main.idyl') {
            const fileResolver = {
                resolve(moduleName) {
                    const fileName = moduleName.endsWith('.idyl')
                        ? moduleName
                        : `${moduleName}.idyl`;
                    return fs.read(fileName);
                }
            };
            return compileIdyllium(source, file, fileResolver);
        },
        async run(source, file = 'main.idyl') {
            return runIdyllium(source, { ...options, fs }, file);
        },
        fs,
    };
}
var errors_2 = require("./compiler/errors");
Object.defineProperty(exports, "ErrorCollector", { enumerable: true, get: function () { return errors_2.ErrorCollector; } });
Object.defineProperty(exports, "ErrorSeverity", { enumerable: true, get: function () { return errors_2.ErrorSeverity; } });
var tokens_1 = require("./compiler/tokens");
Object.defineProperty(exports, "TokenType", { enumerable: true, get: function () { return tokens_1.TokenType; } });
Object.defineProperty(exports, "tokenTypeName", { enumerable: true, get: function () { return tokens_1.tokenTypeName; } });
var runtime_2 = require("./runtime/runtime");
Object.defineProperty(exports, "createRuntime", { enumerable: true, get: function () { return runtime_2.createRuntime; } });
Object.defineProperty(exports, "InMemoryFS", { enumerable: true, get: function () { return runtime_2.InMemoryFS; } });
Object.defineProperty(exports, "IdylRuntimeError", { enumerable: true, get: function () { return runtime_2.IdylRuntimeError; } });
//# sourceMappingURL=index.js.map