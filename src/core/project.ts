import {
  AccessModifier,
  ArrayTypeNameNode,
  ClassDeclaration,
  FunctionDeclaration,
  Program,
  TypeName,
} from './ast';
import { DiagnosticBag, SourceRange } from './diagnostics';
import { Lexer } from './lexer';
import {
  UserModuleClassSpec,
  UserModuleExports,
  UserModuleFieldSpec,
  UserModuleMethodSpec,
  UserModuleRegistry,
  qualifiedUserClassName,
} from './modules';
import { Parser } from './parser';
import { FunctionSpec, StandardLibraryRegistry } from './stdlib/registry';
import { Token } from './tokens';
import {
  ERROR_TYPE,
  TypeRef,
  VOID,
  arrayType,
  classType,
  primitive,
  qualified,
} from './types';

const fs: any = require('fs');
const path: any = require('path');

export interface ModuleSource {
  readonly file: string;
  readonly source: string;
}

export interface ModuleLoadOptions {
  readonly sources?: Record<string, string>;
  readonly resolveModule?: (moduleName: string, fromFile: string) => ModuleSource | null;
}

export interface ParsedSource {
  readonly moduleName: string | null;
  readonly file: string;
  readonly source: string;
  readonly tokens: Token[];
  readonly ast: Program | null;
}

export interface LoadedModule {
  readonly name: string;
  readonly file: string;
  readonly source: string;
  readonly tokens: Token[];
  readonly ast: Program;
}

interface FunctionLikeDeclaration {
  readonly name: string;
  readonly parameters: FunctionDeclaration['parameters'];
  readonly returnType: FunctionDeclaration['returnType'];
}

export function parseSource(
  moduleName: string | null,
  file: string,
  source: string,
  diagnostics: DiagnosticBag,
): ParsedSource {
  const lexed = new Lexer(source, file).tokenize();
  addDiagnostics(diagnostics, lexed.diagnostics);

  const parsed = new Parser(lexed.tokens).parseProgram();
  addDiagnostics(diagnostics, parsed.diagnostics);

  return {
    moduleName,
    file,
    source,
    tokens: lexed.tokens,
    ast: parsed.program,
  };
}

export function addDiagnostics(target: DiagnosticBag, source: DiagnosticBag): void {
  for (const diagnostic of source.all()) {
    target.add(diagnostic.severity, diagnostic.range, diagnostic.message, diagnostic.code);
  }
}

export function loadUserModules(
  root: Program,
  rootFile: string,
  options: ModuleLoadOptions,
  stdlib: StandardLibraryRegistry,
  diagnostics: DiagnosticBag,
  output: LoadedModule[],
): void {
  const loaded = new Map<string, LoadedModule>();
  const loading: string[] = [];

  const loadImports = (program: Program, fromFile: string): void => {
    for (const importDecl of program.imports) {
      const moduleName = importDecl.moduleName;
      if (stdlib.hasModule(moduleName)) continue;
      loadModule(moduleName, fromFile, importDecl.range);
    }
  };

  const loadModule = (moduleName: string, fromFile: string, range: SourceRange): void => {
    if (loaded.has(moduleName)) return;

    const cycleStart = loading.indexOf(moduleName);
    if (cycleStart >= 0) {
      const cycle = [...loading.slice(cycleStart), moduleName].join(' -> ');
      diagnostics.error(range, `module import cycle detected: ${cycle}`);
      return;
    }

    const resolved = resolveUserModule(moduleName, fromFile, options);
    if (!resolved) {
      diagnostics.error(range, `module '${moduleName}' was not found`);
      return;
    }

    loading.push(moduleName);
    const parsed = parseSource(moduleName, resolved.file, resolved.source, diagnostics);
    if (parsed.ast) {
      loadImports(parsed.ast, resolved.file);
      const loadedModule: LoadedModule = {
        name: moduleName,
        file: resolved.file,
        source: resolved.source,
        tokens: parsed.tokens,
        ast: parsed.ast,
      };
      loaded.set(moduleName, loadedModule);
      output.push(loadedModule);
    }
    loading.pop();
  };

  loadImports(root, rootFile);
}

export function resolveUserModule(moduleName: string, fromFile: string, options: ModuleLoadOptions): ModuleSource | null {
  const custom = options.resolveModule?.(moduleName, fromFile);
  if (custom) return custom;

  const sourceFromMap = resolveUserModuleFromSources(moduleName, fromFile, options.sources);
  if (sourceFromMap) return sourceFromMap;

  const file = resolveUserModuleFile(moduleName, fromFile);
  if (!file) return null;
  return { file, source: fs.readFileSync(file, 'utf8') };
}

export function buildUserModuleRegistry(
  modules: readonly LoadedModule[],
  stdlib: StandardLibraryRegistry,
  diagnostics: DiagnosticBag,
): UserModuleRegistry {
  const userModuleRegistry = new UserModuleRegistry();
  for (const module of modules) {
    userModuleRegistry.register(collectModuleExports(module, stdlib, userModuleRegistry, diagnostics));
  }
  return userModuleRegistry;
}

export function collectModuleExports(
  module: LoadedModule,
  stdlib: StandardLibraryRegistry,
  userModules: UserModuleRegistry,
  diagnostics: DiagnosticBag,
): UserModuleExports {
  const functions = new Map<string, FunctionSpec>();
  const classes = new Map<string, UserModuleClassSpec>();
  const localClasses = new Set<string>();

  for (const declaration of module.ast.declarations) {
    if (declaration.kind === 'ClassDeclaration') {
      localClasses.add(declaration.name);
    }
  }

  for (const declaration of module.ast.declarations) {
    if (declaration.kind === 'FunctionDeclaration') {
      functions.set(
        declaration.name,
        functionSpecFromDeclaration(declaration, module.name, module.ast, localClasses, stdlib, userModules, diagnostics),
      );
    }

    if (declaration.kind === 'ClassDeclaration') {
      classes.set(
        declaration.name,
        classSpecFromDeclaration(declaration, module.name, module.ast, localClasses, stdlib, userModules, diagnostics),
      );
    }
  }

  return {
    name: module.name,
    file: module.file,
    functions,
    classes,
  };
}

function resolveUserModuleFromSources(
  moduleName: string,
  fromFile: string,
  sources: Record<string, string> | undefined,
): ModuleSource | null {
  if (!sources) return null;

  const candidates = [
    moduleName,
    `${moduleName}.idyl`,
    path.join(path.dirname(fromFile), `${moduleName}.idyl`),
  ];

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(sources, candidate)) {
      return { file: candidate, source: sources[candidate] };
    }
  }

  return null;
}

function resolveUserModuleFile(moduleName: string, fromFile: string): string | null {
  if (fromFile === 'main.idyl' || fromFile.trim() === '') return null;

  const candidate = path.join(path.dirname(fromFile), `${moduleName}.idyl`);
  if (!fs.existsSync(candidate)) return null;
  return candidate;
}

function functionSpecFromDeclaration(
  declaration: FunctionLikeDeclaration,
  moduleName: string,
  program: Program,
  localClasses: ReadonlySet<string>,
  stdlib: StandardLibraryRegistry,
  userModules: UserModuleRegistry,
  diagnostics: DiagnosticBag,
): FunctionSpec {
  const parameters = declaration.parameters.map((parameter) => ({
    name: parameter.name,
    type: resolveModuleExportType(parameter.paramType, moduleName, program, localClasses, stdlib, userModules, diagnostics),
  }));
  const returnType = resolveModuleExportType(declaration.returnType, moduleName, program, localClasses, stdlib, userModules, diagnostics);
  return { name: declaration.name, parameters, returnType };
}

function classSpecFromDeclaration(
  declaration: ClassDeclaration,
  moduleName: string,
  program: Program,
  localClasses: ReadonlySet<string>,
  stdlib: StandardLibraryRegistry,
  userModules: UserModuleRegistry,
  diagnostics: DiagnosticBag,
): UserModuleClassSpec {
  const qualifiedName = qualifiedUserClassName(moduleName, declaration.name);
  const fields: UserModuleFieldSpec[] = [];
  const methods: UserModuleMethodSpec[] = [];
  let constructorSpec: FunctionSpec | null = null;
  let constructorAccess: AccessModifier = 'public';

  for (const member of declaration.members) {
    if (member.kind === 'ClassFieldDeclaration') {
      const type = resolveModuleExportType(member.declaredType, moduleName, program, localClasses, stdlib, userModules, diagnostics);
      for (const field of member.fields) {
        fields.push({
          name: field.name,
          type,
          owner: qualifiedName,
          access: member.access,
          range: field.range,
        });
      }
    }

    if (member.kind === 'ClassMethodDeclaration') {
      const spec = functionSpecFromDeclaration(member, moduleName, program, localClasses, stdlib, userModules, diagnostics);
      methods.push({
        name: member.name,
        spec,
        owner: qualifiedName,
        access: member.access,
        isStatic: member.isStatic,
        range: member.range,
      });
    }

    if (member.kind === 'ConstructorDeclaration') {
      constructorSpec = {
        name: member.name,
        parameters: member.parameters.map((parameter) => ({
          name: parameter.name,
          type: resolveModuleExportType(parameter.paramType, moduleName, program, localClasses, stdlib, userModules, diagnostics),
        })),
        returnType: VOID,
      };
      constructorAccess = member.access;
    }
  }

  return {
    name: declaration.name,
    qualifiedName,
    baseName: declaration.baseName ? qualifiedUserClassName(moduleName, declaration.baseName) : null,
    fields,
    methods,
    constructorSpec,
    constructorAccess,
    range: declaration.range,
  };
}

function resolveModuleExportType(
  typeName: TypeName,
  moduleName: string,
  program: Program,
  localClasses: ReadonlySet<string>,
  stdlib: StandardLibraryRegistry,
  userModules: UserModuleRegistry,
  diagnostics: DiagnosticBag,
): TypeRef {
  if (typeName.kind === 'PrimitiveTypeName') {
    return primitive(typeName.name);
  }

  if (typeName.kind === 'ArrayTypeName') {
    return resolveModuleArrayType(typeName, moduleName, program, localClasses, stdlib, userModules, diagnostics);
  }

  if (typeName.kind === 'ClassTypeName') {
    return localClasses.has(typeName.name)
      ? classType(qualifiedUserClassName(moduleName, typeName.name))
      : classType(typeName.name);
  }

  if (!program.imports.some((item) => item.moduleName === typeName.moduleName)) {
    diagnostics.error(typeName.range, `'${typeName.moduleName}' is not imported (use 'use ${typeName.moduleName};')`);
    return ERROR_TYPE;
  }

  if (stdlib.hasModule(typeName.moduleName)) {
    return qualified(typeName.moduleName, typeName.name);
  }

  const importedModule = userModules.getModule(typeName.moduleName);
  const importedClass = importedModule?.classes.get(typeName.name);
  if (importedClass) return classType(importedClass.qualifiedName);

  diagnostics.error(typeName.range, `module '${typeName.moduleName}' has no type '${typeName.name}'`);
  return ERROR_TYPE;
}

function resolveModuleArrayType(
  typeName: ArrayTypeNameNode,
  moduleName: string,
  program: Program,
  localClasses: ReadonlySet<string>,
  stdlib: StandardLibraryRegistry,
  userModules: UserModuleRegistry,
  diagnostics: DiagnosticBag,
): TypeRef {
  return arrayType(
    resolveModuleExportType(typeName.elementType, moduleName, program, localClasses, stdlib, userModules, diagnostics),
    typeName.size,
    typeName.dynamic,
  );
}
