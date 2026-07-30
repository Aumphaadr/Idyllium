import { Expression, Program } from '../core/ast';
import { JavaScriptGenerator } from '../core/codegen';
import { Diagnostic, DiagnosticBag, formatDiagnostics } from '../core/diagnostics';
import { TypeRef } from '../core/types';
import {
  LoadedModule,
  ModuleLoadOptions,
  addDiagnostics,
  buildUserModuleRegistry,
  loadUserModules,
  parseSource,
} from '../core/project';
import { SemanticAnalyzer } from '../core/semantics';
import { StandardLibraryRegistry, createDefaultStandardLibrary } from '../core/stdlib/registry';
import { Token } from '../core/tokens';
import { IdylliumRuntimeError, RuntimeOptions, createRuntime } from './runtime';

export type { ModuleSource } from '../core/project';

export interface CompileOptions extends ModuleLoadOptions {
  readonly file?: string;
  readonly stdlib?: StandardLibraryRegistry;
}

export interface CompileResult {
  readonly success: boolean;
  readonly jsCode: string | null;
  readonly diagnostics: Diagnostic[];
  readonly diagnosticsText: string;
  readonly tokens: Token[];
  readonly ast: Program | null;
}

export interface RunResult {
  readonly success: boolean;
  readonly output: string;
  readonly runtimeError: string | null;
  readonly compilation: CompileResult;
  /** Текст результата main() или system.exit(); null — программа ничего не вернула. */
  readonly exitText: string | null;
  /** Целый код завершения, если он был целым; иначе null. */
  readonly exitCode: number | null;
}

export function compileIdyllium(source: string, options: CompileOptions = {}): CompileResult {
  const file = options.file ?? 'main.idyl';
  const stdlib = options.stdlib ?? createDefaultStandardLibrary();
  const diagnostics = new DiagnosticBag();

  const root = parseSource(null, file, source, diagnostics);

  let ast = root.ast;
  let jsCode: string | null = null;
  const modules: LoadedModule[] = [];

  if (ast && !diagnostics.hasErrors()) {
    loadUserModules(ast, file, options, stdlib, diagnostics, modules);
  }

  const userModuleRegistry = buildUserModuleRegistry(modules, stdlib, diagnostics);

  const nodeTypes = new Map<Expression, TypeRef>();
  if (ast && !diagnostics.hasErrors()) {
    for (const module of modules) {
      const semantics = new SemanticAnalyzer(stdlib, userModuleRegistry).analyze(module.ast);
      addDiagnostics(diagnostics, semantics.diagnostics);
      for (const [node, type] of semantics.nodeTypes) nodeTypes.set(node, type);
    }

    const semantics = new SemanticAnalyzer(stdlib, userModuleRegistry).analyze(ast);
    addDiagnostics(diagnostics, semantics.diagnostics);
    for (const [node, type] of semantics.nodeTypes) nodeTypes.set(node, type);
  }

  if (ast && !diagnostics.hasErrors()) {
    jsCode = new JavaScriptGenerator({
      userModuleNames: new Set(modules.map((module) => module.name)),
      nodeTypes,
    }).generate(ast, { modules: modules.map((module) => ({ name: module.name, program: module.ast })) }).jsCode;
  }

  if (diagnostics.hasErrors()) {
    ast = root.ast;
  }

  const allDiagnostics = diagnostics.all();
  return {
    success: !diagnostics.hasErrors(),
    jsCode,
    diagnostics: allDiagnostics,
    diagnosticsText: formatDiagnostics(allDiagnostics),
    tokens: root.tokens,
    ast,
  };
}

export async function runIdyllium(
  source: string,
  runtimeOptions: RuntimeOptions = {},
  compileOptions: CompileOptions = {},
): Promise<RunResult> {
  const compilation = compileIdyllium(source, compileOptions);
  if (!compilation.success || !compilation.jsCode) {
    return {
      success: false,
      output: '',
      runtimeError: null,
      compilation,
      exitText: null,
      exitCode: null,
    };
  }

  const runtime = createRuntime(runtimeOptions);

  try {
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const factory = new AsyncFunction(compilation.jsCode);
    const program = await factory();
    await program(runtime);
    return {
      success: true,
      output: runtime.getOutput(),
      runtimeError: null,
      compilation,
      exitText: await runtime.getExitText(),
      exitCode: runtime.getExitCode(),
    };
  } catch (error) {
    // system.exit() — не авария, а обычное завершение: программа сама так решила.
    if (error instanceof IdylliumRuntimeError && error.kind === 'exit') {
      return {
        success: true,
        output: runtime.getOutput(),
        runtimeError: null,
        compilation,
        exitText: await runtime.getExitText(),
        exitCode: runtime.getExitCode(),
      };
    }
    return {
      success: false,
      output: runtime.getOutput(),
      runtimeError: describeRuntimeError(error, compileOptions.file ?? 'main.idyl'),
      compilation,
      exitText: null,
      exitCode: null,
    };
  }
}

/**
 * Превращает произвольную ошибку исполнения в текст для ученика.
 * Ошибки Idyllium уже несут `file:line`; сырые V8-ошибки (переполнение стека
 * при бесконечной рекурсии) переводятся в формат Idyllium с подсказкой.
 */
export function describeRuntimeError(error: unknown, entryFile: string): string {
  if (error instanceof RangeError && /call stack|stack size/iu.test(error.message)) {
    const name = dominantStackFunction(error.stack);
    const hint = name
      ? `check the recursion in function '${name}' — it needs a stop condition`
      : 'check for a recursion without a stop condition';
    return `${entryFile}: runtime error: maximum call depth exceeded (${hint})`;
  }
  return error instanceof Error ? error.message : String(error);
}

function dominantStackFunction(stack: string | undefined): string | null {
  const skipped = new Set(['eval', 'anonymous', 'Object', 'AsyncFunction', 'processTicksAndRejections', 'main']);
  const counts = new Map<string, number>();
  for (const match of String(stack ?? '').matchAll(/^\s*at ([A-Za-z_$][\w$]*) /gmu)) {
    const name = match[1];
    if (name.startsWith('__idyl') || skipped.has(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 1;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}
