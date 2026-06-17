import { Program } from '../core/ast';
import { JavaScriptGenerator } from '../core/codegen';
import { Diagnostic, DiagnosticBag, formatDiagnostics } from '../core/diagnostics';
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
import { RuntimeOptions, createRuntime } from './runtime';

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

  if (ast && !diagnostics.hasErrors()) {
    for (const module of modules) {
      const semantics = new SemanticAnalyzer(stdlib, userModuleRegistry).analyze(module.ast);
      addDiagnostics(diagnostics, semantics.diagnostics);
    }

    const semantics = new SemanticAnalyzer(stdlib, userModuleRegistry).analyze(ast);
    addDiagnostics(diagnostics, semantics.diagnostics);
  }

  if (ast && !diagnostics.hasErrors()) {
    jsCode = new JavaScriptGenerator({
      userModuleNames: new Set(modules.map((module) => module.name)),
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
    };
  } catch (error) {
    return {
      success: false,
      output: runtime.getOutput(),
      runtimeError: error instanceof Error ? error.message : String(error),
      compilation,
    };
  }
}
