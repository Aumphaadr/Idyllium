import { ClassDeclaration, FunctionDeclaration, Program, Statement, TypeName } from '../core/ast';
import { Diagnostic, DiagnosticBag, SourceRange, formatDiagnostics } from '../core/diagnostics';
import { UserModuleClassSpec } from '../core/modules';
import { IdylliumSemanticToken, SemanticAnalyzer } from '../core/semantics';
import {
  LoadedModule,
  ModuleLoadOptions,
  addDiagnostics,
  buildUserModuleRegistry,
  loadUserModules,
  parseSource,
} from '../core/project';
import { createDefaultStandardLibrary, CompletionItem, FunctionSpec, StandardLibraryRegistry } from '../core/stdlib/registry';
import { qualified, typeToString } from '../core/types';
import { compileIdyllium, CompileResult } from '../runtime/run';

const path: any = require('path');

export interface IdylliumProjectOptions {
  readonly entryFile: string;
  readonly files: ReadonlyMap<string, string> | Record<string, string>;
  readonly stdlib?: StandardLibraryRegistry;
}

export interface ProjectCompletionRequest {
  readonly file: string;
  readonly offset: number;
}

export interface ProjectHoverRequest {
  readonly file: string;
  readonly offset: number;
}

export interface IdylliumHover {
  readonly detail: string;
  readonly range: SourceRange;
}

export interface ProjectSignatureHelpRequest {
  readonly file: string;
  readonly offset: number;
}

export interface IdylliumSignatureHelp {
  readonly signatures: readonly IdylliumSignature[];
  readonly activeSignature: number;
  readonly activeParameter: number;
}

export interface IdylliumSignature {
  readonly label: string;
  readonly parameters: readonly IdylliumSignatureParameter[];
  readonly documentation?: string;
  readonly allowsNamedArguments?: boolean;
}

export interface IdylliumSignatureParameter {
  readonly name?: string;
  readonly label: string;
  readonly documentation?: string;
}

export interface IdylliumDocumentSymbol {
  readonly name: string;
  readonly kind: 'class' | 'constructor' | 'field' | 'function' | 'method' | 'variable' | 'constant';
  readonly detail: string;
  readonly range: SourceRange;
}

export interface ProjectDefinitionRequest {
  readonly file: string;
  readonly offset: number;
}

export interface IdylliumDefinition {
  readonly file: string;
  readonly range: SourceRange;
}

interface ProjectIndex {
  readonly diagnostics: Diagnostic[];
  readonly diagnosticsText: string;
  readonly root: Program | null;
  readonly modules: readonly LoadedModule[];
  readonly userModules: ReturnType<typeof buildUserModuleRegistry>;
  readonly variables: ReadonlyMap<string, VariableInfo>;
  readonly functions: ReadonlyMap<string, FunctionDeclaration>;
  readonly localClasses: ReadonlyMap<string, ClassDeclaration>;
  readonly userModuleDeclarations: ReadonlyMap<string, ModuleDeclarationIndex>;
  readonly semanticTokens: readonly IdylliumSemanticToken[];
}

interface VariableInfo {
  readonly name: string;
  readonly typeName: TypeName;
  readonly range: SourceRange;
  readonly isConst: boolean;
}

interface ModuleDeclarationIndex {
  readonly file: string;
  readonly functions: ReadonlyMap<string, SourceRange>;
  readonly constants: ReadonlyMap<string, SourceRange>;
  readonly classes: ReadonlyMap<string, ClassDeclaration>;
}

export class IdylliumProject {
  private readonly entryFile: string;
  private readonly files: Map<string, string>;
  private readonly stdlib: StandardLibraryRegistry;

  constructor(options: IdylliumProjectOptions) {
    this.entryFile = normalizeFile(options.entryFile);
    this.files = normalizeFiles(options.files);
    this.stdlib = options.stdlib ?? createDefaultStandardLibrary();
  }

  compile(entryFile = this.entryFile): CompileResult {
    const file = normalizeFile(entryFile);
    const source = this.files.get(file) ?? '';
    return compileIdyllium(source, {
      file,
      stdlib: this.stdlib,
      sources: this.sourcesRecord(),
      resolveModule: this.resolveModule,
    });
  }

  diagnostics(file?: string): Diagnostic[] {
    const result = this.compile();
    if (!file) return result.diagnostics;

    const normalized = normalizeFile(file);
    return result.diagnostics.filter((diagnostic) => normalizeFile(diagnostic.range.start.file) === normalized);
  }

  completions(request: ProjectCompletionRequest): CompletionItem[] {
    const file = normalizeFile(request.file);
    const source = this.files.get(file) ?? '';
    const prefix = source.slice(0, request.offset);
    const index = this.index(file);

    const argumentCompletions = this.argumentNameCompletions(index, source, request.offset);
    if (argumentCompletions.length > 0) return argumentCompletions;

    const memberMatch = /([A-Za-z_][A-Za-z0-9_]*)\.\s*$/.exec(prefix);
    if (memberMatch) {
      const moduleName = memberMatch[1];
      const stdlibMembers = this.stdlib.listModuleMembers(moduleName);
      if (stdlibMembers.length > 0) return stdlibMembers;
      const userModuleMembers = this.listUserModuleMembers(index, moduleName);
      if (userModuleMembers.length > 0) return userModuleMembers;
      return this.listVariableMembers(index, moduleName);
    }

    if (/\buse\s+[A-Za-z_0-9]*$/.test(prefix)) {
      return [
        ...this.stdlib.listModules(),
        ...this.listProjectModules(),
      ].sort((left, right) => left.name.localeCompare(right.name));
    }

    return [
      ...this.stdlib.listModules(),
      ...this.listProjectModules(),
      { name: 'main', kind: 'function', detail: 'main()' },
      { name: 'int', kind: 'type', detail: 'type int' },
      { name: 'float', kind: 'type', detail: 'type float' },
      { name: 'string', kind: 'type', detail: 'type string' },
      { name: 'char', kind: 'type', detail: 'type char' },
      { name: 'bool', kind: 'type', detail: 'type bool' },
    ];
  }

  hover(request: ProjectHoverRequest): IdylliumHover | null {
    const file = normalizeFile(request.file);
    const source = this.files.get(file) ?? '';
    const word = wordAtOffset(source, request.offset);
    if (!word) return null;

    const index = this.index(file);
    const member = memberContext(source, word.start);
    if (member) {
      const item = this.memberHoverItem(index, member.objectName, word.text);
      if (item) return hoverFromWord(source, file, word, item.detail);
    }

    const variable = index.variables.get(word.text);
    if (variable) {
      return hoverFromWord(
        source,
        file,
        word,
        `${variable.isConst ? 'const ' : ''}${variable.name}: ${typeNameText(variable.typeName)}`,
      );
    }

    if (this.stdlib.hasModule(word.text)) {
      return hoverFromWord(source, file, word, `module ${word.text}`);
    }

    const projectModule = this.listProjectModules().find((item) => item.name === word.text);
    if (projectModule) {
      return hoverFromWord(source, file, word, projectModule.detail);
    }

    const localClass = index.localClasses.get(word.text);
    if (localClass) {
      return hoverFromWord(source, file, word, `class ${word.text}`);
    }

    const primitive = primitiveTypeHover(word.text);
    if (primitive) {
      return hoverFromWord(source, file, word, primitive);
    }

    return null;
  }

  signatureHelp(request: ProjectSignatureHelpRequest): IdylliumSignatureHelp | null {
    const file = normalizeFile(request.file);
    const source = this.files.get(file) ?? '';
    const call = activeCallAtOffset(source, request.offset);
    if (!call) return null;

    const index = this.index(file);
    const signatures = this.signatureCandidates(index, call.calleeText);
    if (signatures.length === 0) return null;

    const maxParameter = Math.max(0, signatures[0].parameters.length - 1);
    return {
      signatures,
      activeSignature: 0,
      activeParameter: Math.min(activeParameterForCall(call, signatures[0]), maxParameter),
    };
  }

  definition(request: ProjectDefinitionRequest): IdylliumDefinition | null {
    const file = normalizeFile(request.file);
    const source = this.files.get(file) ?? '';
    const word = wordAtOffset(source, request.offset);
    if (!word) return null;

    const index = this.index(file);
    const member = memberContext(source, word.start);
    if (member) {
      return this.memberDefinition(index, member.objectName, word.text);
    }

    const useModule = useModuleNameAtWord(source, word);
    if (useModule) {
      return this.moduleDefinition(file, useModule);
    }

    const variable = index.variables.get(word.text);
    if (variable) return { file: normalizeFile(variable.range.start.file), range: variable.range };

    const localFunction = index.functions.get(word.text);
    if (localFunction) return { file: normalizeFile(localFunction.range.start.file), range: localFunction.range };

    const localClass = index.localClasses.get(word.text);
    if (localClass) return { file: normalizeFile(localClass.range.start.file), range: localClass.range };

    return null;
  }

  documentSymbols(file: string): IdylliumDocumentSymbol[] {
    const normalized = normalizeFile(file);
    const source = this.files.get(normalized);
    if (source === undefined) return [];

    const diagnostics = new DiagnosticBag();
    const parsed = parseSource(null, normalized, source, diagnostics);
    if (!parsed.ast) return [];

    const symbols: IdylliumDocumentSymbol[] = [];
    for (const declaration of parsed.ast.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        symbols.push({ name: declaration.name, kind: 'class', detail: `class ${declaration.name}`, range: declaration.range });
        symbols.push(...this.classMemberSymbols(declaration));
      }
      if (declaration.kind === 'FunctionDeclaration') {
        symbols.push({ name: declaration.name, kind: 'function', detail: functionDetail(declaration.name, declaration.parameters.length), range: declaration.range });
      }
      if (declaration.kind === 'VariableDeclaration') {
        symbols.push({
          name: declaration.name,
          kind: declaration.isConst ? 'constant' : 'variable',
          detail: `${declaration.isConst ? 'const ' : ''}${declaration.name}: ${typeNameText(declaration.declaredType)}`,
          range: declaration.range,
        });
      }
    }

    if (parsed.ast.main) {
      symbols.push({
        name: 'main',
        kind: 'function',
        detail: callableDetail('main', [], typeNameText(parsed.ast.main.returnType)),
        range: parsed.ast.main.range,
      });
    }

    return symbols;
  }

  semanticTokens(file: string): readonly IdylliumSemanticToken[] {
    const normalized = normalizeFile(file);
    if (!this.files.has(normalized)) return [];
    return this.index(normalized).semanticTokens.filter(
      (token) => normalizeFile(token.range.start.file) === normalized,
    );
  }

  private index(file: string): ProjectIndex {
    const diagnostics = new DiagnosticBag();
    const source = this.files.get(file) ?? '';
    const root = parseSource(null, file, source, diagnostics);
    const modules: LoadedModule[] = [];

    if (root.ast) {
      loadUserModules(root.ast, file, this.moduleLoadOptions(), this.stdlib, diagnostics, modules);
    }

    const userModules = buildUserModuleRegistry(modules, this.stdlib, diagnostics);
    const semanticTokens = root.ast
      ? new SemanticAnalyzer(this.stdlib, userModules).analyze(root.ast).tokens
      : [];
    const allDiagnostics = diagnostics.all();
    return {
      diagnostics: allDiagnostics,
      diagnosticsText: formatDiagnostics(allDiagnostics),
      root: root.ast,
      modules,
      userModules,
      variables: root.ast ? collectVariables(root.ast) : new Map(),
      functions: root.ast ? collectFunctions(root.ast) : new Map(),
      localClasses: root.ast ? collectLocalClasses(root.ast) : new Map(),
      userModuleDeclarations: collectUserModuleDeclarations(modules),
      semanticTokens,
    };
  }

  private listUserModuleMembers(index: ProjectIndex, moduleName: string): CompletionItem[] {
    const module = index.userModules.getModule(moduleName);
    if (!module) return [];

    const classes = [...module.classes.values()].map((item) => ({
      name: item.name,
      kind: 'type' as const,
      detail: `type ${moduleName}.${item.name}`,
    }));
    const functions = [...module.functions.values()].map((item) => ({
      name: item.name,
      kind: 'function' as const,
      detail: signatureDetail(item),
    }));
    const constants = [...module.constants.values()].map((item) => ({
      name: item.name,
      kind: 'constant' as const,
      detail: `const ${moduleName}.${item.name}: ${typeToString(item.type)}`,
    }));

    return [...classes, ...constants, ...functions].sort((left, right) => left.name.localeCompare(right.name));
  }

  private listProjectModules(): CompletionItem[] {
    const modules: CompletionItem[] = [];
    for (const file of this.files.keys()) {
      if (file === this.entryFile || !file.endsWith('.idyl')) continue;
      modules.push({
        name: moduleNameFromFile(file),
        kind: 'module',
        detail: `module ${moduleNameFromFile(file)}`,
      });
    }
    return modules;
  }

  private listVariableMembers(index: ProjectIndex, variableName: string): CompletionItem[] {
    const variable = index.variables.get(variableName);
    if (!variable) return [];

    if (variable.typeName.kind === 'QualifiedTypeName') {
      if (this.stdlib.hasQualifiedType(variable.typeName.moduleName, variable.typeName.name)) {
        return this.stdlib.listTypeMembers(qualified(variable.typeName.moduleName, variable.typeName.name));
      }

      const module = index.userModules.getModule(variable.typeName.moduleName);
      const classSpec = module?.classes.get(variable.typeName.name);
      if (classSpec) return userClassMemberCompletions(classSpec);
    }

    if (variable.typeName.kind === 'ClassTypeName') {
      const classDeclaration = index.localClasses.get(variable.typeName.name);
      if (classDeclaration) return localClassMemberCompletions(classDeclaration);
    }

    if (variable.typeName.kind === 'ArrayTypeName') {
      return arrayMemberCompletions(variable.typeName);
    }

    if (variable.typeName.kind === 'PrimitiveTypeName' && variable.typeName.name === 'string') {
      return stringMemberCompletions();
    }

    return [];
  }

  private memberHoverItem(index: ProjectIndex, objectName: string, memberName: string): CompletionItem | null {
    const stdlibMember = this.stdlib.listModuleMembers(objectName).find((item) => item.name === memberName);
    if (stdlibMember) return stdlibMember;

    const userModuleMember = this.listUserModuleMembers(index, objectName).find((item) => item.name === memberName);
    if (userModuleMember) return userModuleMember;

    return this.listVariableMembers(index, objectName).find((item) => item.name === memberName) ?? null;
  }

  private signatureCandidates(index: ProjectIndex, calleeText: string): IdylliumSignature[] {
    const normalized = calleeText.replace(/\s+/gu, '');
    const memberMatch = /^([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}_][\p{L}\p{N}_]*)$/u.exec(normalized);
    if (memberMatch) {
      const [, objectName, memberName] = memberMatch;
      const moduleFunction = this.stdlib.getModuleFunction(objectName, memberName);
      if (moduleFunction) return [signatureFromFunctionSpec(moduleFunction)];

      const userModuleFunction = index.userModules.getModule(objectName)?.functions.get(memberName);
      if (userModuleFunction) return [signatureFromFunctionSpec(userModuleFunction)];

      const member = this.memberHoverItem(index, objectName, memberName);
      return member && member.kind === 'method' ? [signatureFromDetail(member.detail)] : [];
    }

    const globalFunction = this.stdlib.getGlobalFunction(normalized);
    if (globalFunction) return [signatureFromFunctionSpec(globalFunction)];

    const localFunction = index.functions.get(normalized);
    if (localFunction) return [signatureFromFunctionDeclaration(localFunction)];

    return [];
  }

  private argumentNameCompletions(index: ProjectIndex, source: string, offset: number): CompletionItem[] {
    const call = activeCallAtOffset(source, offset);
    if (!call) return [];

    const signature = this.signatureCandidates(index, call.calleeText)[0];
    if (!signature || signature.allowsNamedArguments === false) return [];

    const prefix = argumentNamePrefix(call.activeArgumentText);
    if (prefix === null) return [];

    const used = usedNamedArgumentNames(call);
    return signature.parameters
      .filter((parameter) => parameter.name && !used.has(parameter.name))
      .filter((parameter) => parameter.name?.toLowerCase().startsWith(prefix.toLowerCase()))
      .map((parameter) => ({
        name: `${parameter.name}=`,
        kind: 'parameter' as const,
        detail: `argument ${parameter.label}`,
      }));
  }

  private memberDefinition(index: ProjectIndex, objectName: string, memberName: string): IdylliumDefinition | null {
    const module = index.userModuleDeclarations.get(objectName);
    if (module) {
      const constantRange = module.constants.get(memberName);
      if (constantRange) return { file: normalizeFile(constantRange.start.file), range: constantRange };
      const functionRange = module.functions.get(memberName);
      if (functionRange) return { file: normalizeFile(functionRange.start.file), range: functionRange };
      const classDeclaration = module.classes.get(memberName);
      if (classDeclaration) return { file: normalizeFile(classDeclaration.range.start.file), range: classDeclaration.range };
    }

    const variable = index.variables.get(objectName);
    if (!variable) return null;

    if (variable.typeName.kind === 'ClassTypeName') {
      const classDeclaration = index.localClasses.get(variable.typeName.name);
      const member = classDeclaration ? localClassMemberDeclaration(classDeclaration, memberName) : null;
      if (member) return { file: normalizeFile(member.start.file), range: member };
    }

    if (variable.typeName.kind === 'QualifiedTypeName') {
      const declaration = this.userModuleClassMemberDeclaration(index, variable.typeName.moduleName, variable.typeName.name, memberName);
      if (declaration) return { file: normalizeFile(declaration.start.file), range: declaration };
    }

    return null;
  }

  private userModuleClassMemberDeclaration(
    index: ProjectIndex,
    moduleName: string,
    className: string,
    memberName: string,
  ): SourceRange | null {
    const module = index.userModuleDeclarations.get(moduleName);
    const classDeclaration = module?.classes.get(className);
    return classDeclaration ? localClassMemberDeclaration(classDeclaration, memberName) : null;
  }

  private moduleDefinition(fromFile: string, moduleName: string): IdylliumDefinition | null {
    const resolved = this.resolveModule(moduleName, fromFile);
    if (!resolved) return null;

    return {
      file: normalizeFile(resolved.file),
      range: {
        start: { file: normalizeFile(resolved.file), line: 1, column: 1 },
        end: { file: normalizeFile(resolved.file), line: 1, column: 1 },
      },
    };
  }

  private classMemberSymbols(declaration: ClassDeclaration): IdylliumDocumentSymbol[] {
    const symbols: IdylliumDocumentSymbol[] = [];
    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        for (const field of member.fields) {
          symbols.push({ name: field.name, kind: 'field', detail: `${field.name}: ${typeNameText(member.declaredType)}`, range: field.range });
        }
      }
      if (member.kind === 'ClassMethodDeclaration') {
        symbols.push({ name: member.name, kind: 'method', detail: functionDetail(member.name, member.parameters.length), range: member.range });
      }
      if (member.kind === 'ConstructorDeclaration') {
        symbols.push({ name: member.name, kind: 'constructor', detail: functionDetail(member.name, member.parameters.length), range: member.range });
      }
    }
    return symbols;
  }

  private moduleLoadOptions(): ModuleLoadOptions {
    return {
      sources: this.sourcesRecord(),
      resolveModule: this.resolveModule,
    };
  }

  private readonly resolveModule = (moduleName: string, fromFile: string) => {
    const candidate = normalizeFile(path.join(path.dirname(fromFile), `${moduleName}.idyl`));
    const source = this.files.get(candidate);
    if (source === undefined) return null;
    return { file: candidate, source };
  };

  private sourcesRecord(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [file, source] of this.files) {
      result[file] = source;
    }
    return result;
  }
}

export function compileProject(options: IdylliumProjectOptions): CompileResult {
  return new IdylliumProject(options).compile();
}

function collectVariables(program: Program): Map<string, VariableInfo> {
  const variables = new Map<string, VariableInfo>();

  for (const declaration of program.declarations) {
    if (declaration.kind === 'VariableDeclaration') {
      variables.set(declaration.name, {
        name: declaration.name,
        typeName: declaration.declaredType,
        range: declaration.range,
        isConst: declaration.isConst,
      });
    }
    if (declaration.kind === 'FunctionDeclaration') {
      for (const parameter of declaration.parameters) {
        variables.set(parameter.name, {
          name: parameter.name,
          typeName: parameter.paramType,
          range: parameter.range,
          isConst: false,
        });
      }
      collectStatementVariables(declaration.body, variables);
    }
    if (declaration.kind === 'ClassDeclaration') {
      for (const member of declaration.members) {
        if (member.kind === 'ClassMethodDeclaration') {
          for (const parameter of member.parameters) {
            variables.set(parameter.name, {
              name: parameter.name,
              typeName: parameter.paramType,
              range: parameter.range,
              isConst: false,
            });
          }
          collectStatementVariables(member.body, variables);
        }
        if (member.kind === 'ConstructorDeclaration') {
          for (const parameter of member.parameters) {
            variables.set(parameter.name, {
              name: parameter.name,
              typeName: parameter.paramType,
              range: parameter.range,
              isConst: false,
            });
          }
          collectStatementVariables(member.body, variables);
        }
      }
    }
  }

  if (program.main) {
    collectStatementVariables(program.main.body, variables);
  }

  return variables;
}

function collectFunctions(program: Program): Map<string, FunctionDeclaration> {
  const functions = new Map<string, FunctionDeclaration>();
  for (const declaration of program.declarations) {
    if (declaration.kind === 'FunctionDeclaration') {
      functions.set(declaration.name, declaration);
    }
  }
  return functions;
}

function collectStatementVariables(statement: Statement, variables: Map<string, VariableInfo>): void {
  if (statement.kind === 'VariableDeclaration') {
    variables.set(statement.name, {
      name: statement.name,
      typeName: statement.declaredType,
      range: statement.range,
      isConst: statement.isConst,
    });
    return;
  }

  if (statement.kind === 'BlockStatement') {
    for (const child of statement.statements) collectStatementVariables(child, variables);
    return;
  }

  if (statement.kind === 'IfStatement') {
    collectStatementVariables(statement.thenBranch, variables);
    if (statement.elseBranch) collectStatementVariables(statement.elseBranch, variables);
    return;
  }

  if (statement.kind === 'WhileStatement' || statement.kind === 'DoWhileStatement') {
    collectStatementVariables(statement.body, variables);
    return;
  }

  if (statement.kind === 'ForStatement') {
    if (statement.initializer?.kind === 'VariableDeclaration') collectStatementVariables(statement.initializer, variables);
    collectStatementVariables(statement.body, variables);
    if (statement.increment?.kind === 'VariableDeclaration') collectStatementVariables(statement.increment, variables);
  }
}

function collectLocalClasses(program: Program): Map<string, ClassDeclaration> {
  const classes = new Map<string, ClassDeclaration>();
  for (const declaration of program.declarations) {
    if (declaration.kind === 'ClassDeclaration') classes.set(declaration.name, declaration);
  }
  return classes;
}

function collectUserModuleDeclarations(modules: readonly LoadedModule[]): Map<string, ModuleDeclarationIndex> {
  const result = new Map<string, ModuleDeclarationIndex>();
  for (const module of modules) {
    const functions = new Map<string, SourceRange>();
    const constants = new Map<string, SourceRange>();
    const classes = new Map<string, ClassDeclaration>();

    for (const declaration of module.ast.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        functions.set(declaration.name, declaration.range);
      }
      if (declaration.kind === 'VariableDeclaration' && declaration.isConst) {
        constants.set(declaration.name, declaration.nameRange);
      }
      if (declaration.kind === 'ClassDeclaration') {
        classes.set(declaration.name, declaration);
      }
    }

    result.set(module.name, {
      file: normalizeFile(module.file),
      functions,
      constants,
      classes,
    });
  }
  return result;
}

function localClassMemberDeclaration(declaration: ClassDeclaration, memberName: string): SourceRange | null {
  for (const member of declaration.members) {
    if (member.kind === 'ClassFieldDeclaration') {
      const field = member.fields.find((item) => item.name === memberName);
      if (field) return field.range;
    }
    if (member.kind === 'ClassMethodDeclaration' && member.name === memberName) {
      return member.range;
    }
    if (member.kind === 'ConstructorDeclaration' && member.name === memberName) {
      return member.range;
    }
  }
  return null;
}

function localClassMemberCompletions(declaration: ClassDeclaration): CompletionItem[] {
  const items = new Map<string, CompletionItem>();
  for (const member of declaration.members) {
    if (member.kind === 'ClassFieldDeclaration' && member.access === 'public') {
      for (const field of member.fields) {
        items.set(field.name, {
          name: field.name,
          kind: 'property',
          detail: `${field.name}: ${typeNameText(member.declaredType)}`,
        });
      }
    }

    if (member.kind === 'ClassMethodDeclaration' && member.access === 'public' && !member.isStatic) {
      items.set(member.name, {
        name: member.name,
        kind: 'method',
        detail: callableDetail(member.name, member.parameters.map(parameterDetail), typeNameText(member.returnType)),
      });
    }
  }
  return [...items.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function userClassMemberCompletions(classSpec: UserModuleClassSpec): CompletionItem[] {
  const items = new Map<string, CompletionItem>();
  for (const field of classSpec.fields) {
    if (field.access !== 'public') continue;
    items.set(field.name, {
      name: field.name,
      kind: 'property',
      detail: `${field.name}: ${typeToString(field.type)}`,
    });
  }

  for (const method of classSpec.methods) {
    if (method.access !== 'public' || method.isStatic) continue;
    items.set(method.name, {
      name: method.name,
      kind: 'method',
      detail: signatureDetail(method.spec),
    });
  }

  return [...items.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function stringMemberCompletions(): CompletionItem[] {
  return [
    { name: 'length', kind: 'method', detail: 'length(): int' },
    { name: 'contains', kind: 'method', detail: 'contains(text: string): bool' },
    { name: 'find', kind: 'method', detail: 'find(text: string): int' },
    { name: 'count', kind: 'method', detail: 'count(text: string): int' },
    { name: 'is_int', kind: 'method', detail: 'is_int(): bool' },
    { name: 'is_float', kind: 'method', detail: 'is_float(): bool' },
    { name: 'to_upper', kind: 'method', detail: 'to_upper(): string' },
    { name: 'to_lower', kind: 'method', detail: 'to_lower(): string' },
    { name: 'substring', kind: 'method', detail: 'substring(start: int, length: int): string' },
    { name: 'replace', kind: 'method', detail: 'replace(old_text: string, new_text: string): string' },
    { name: 'split', kind: 'method', detail: 'split(separator: string): dyn_array<string>' },
    { name: 'trim', kind: 'method', detail: 'trim(): string' },
  ];
}

function arrayMemberCompletions(typeName: Extract<TypeName, { kind: 'ArrayTypeName' }>): CompletionItem[] {
  const element = typeNameText(typeName.elementType);
  const items: CompletionItem[] = [
    { name: 'length', kind: 'method', detail: 'length(): int' },
    { name: 'contains', kind: 'method', detail: `contains(value: ${element}): bool` },
    { name: 'find', kind: 'method', detail: `find(value: ${element}): int` },
    { name: 'count', kind: 'method', detail: `count(value: ${element}): int` },
    { name: 'reverse', kind: 'method', detail: 'reverse(): void' },
    { name: 'sort', kind: 'method', detail: 'sort(): void' },
  ];

  if (typeName.dynamic) {
    items.push(
      { name: 'add', kind: 'method', detail: `add(value: ${element}): void` },
      { name: 'remove_at', kind: 'method', detail: 'remove_at(index: int): void' },
      { name: 'resize', kind: 'method', detail: 'resize(size: int): void' },
      { name: 'insert', kind: 'method', detail: `insert(index: int, value: ${element}): void` },
      { name: 'join', kind: 'method', detail: `join(other: dyn_array<${element}>): void` },
      { name: 'clear', kind: 'method', detail: 'clear(): void' },
      { name: 'pop', kind: 'method', detail: `pop(): ${element}` },
    );
  }

  return items.sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeFiles(files: ReadonlyMap<string, string> | Record<string, string>): Map<string, string> {
  const result = new Map<string, string>();
  if (files instanceof Map) {
    for (const [file, source] of files) {
      result.set(normalizeFile(file), source);
    }
    return result;
  }

  for (const [file, source] of Object.entries(files)) {
    result.set(normalizeFile(file), source);
  }
  return result;
}

function normalizeFile(file: string): string {
  return path.normalize(file);
}

function moduleNameFromFile(file: string): string {
  return path.basename(file, '.idyl');
}

function signatureDetail(fn: FunctionSpec): string {
  const parameters = fn.parameters.map((param) => `${param.name}: ${typeToString(param.type)}`);
  if (fn.variadic) {
    parameters.push(fn.variadicTypes?.length === 1 ? `...values: ${typeToString(fn.variadicTypes[0])}` : '...values');
  }
  return callableDetail(fn.name, parameters, typeToString(fn.returnType));
}

function functionDetail(name: string, arity: number): string {
  const params = Array.from({ length: arity }, (_, index) => `arg${index + 1}`).join(', ');
  return `${name}(${params})`;
}

function callableDetail(name: string, parameters: readonly string[], returnType: string): string {
  return `${name}(${parameters.join(', ')}): ${returnType}`;
}

interface ActiveCall {
  readonly calleeText: string;
  readonly activeParameter: number;
  readonly activeArgumentText: string;
  readonly previousArgumentTexts: readonly string[];
}

interface CallFrame {
  readonly calleeText: string | null;
  readonly openParenIndex: number;
  currentArgumentStart: number;
  activeParameter: number;
}

function activeCallAtOffset(source: string, offset: number): ActiveCall | null {
  const safeOffset = Math.max(0, Math.min(source.length, offset));
  const frames: CallFrame[] = [];
  let squareDepth = 0;

  for (let i = 0; i < safeOffset; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '/' && next === '/') {
      i = skipLineComment(source, i + 2);
      continue;
    }
    if (char === '/' && next === '*') {
      i = skipBlockComment(source, i + 2);
      continue;
    }
    if (char === '"' || char === "'") {
      i = skipQuotedText(source, i, char, safeOffset);
      continue;
    }

    if (char === '[') squareDepth++;
    if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    if (char === '(') {
      frames.push({
        calleeText: calleeTextBefore(source, i),
        openParenIndex: i,
        currentArgumentStart: i + 1,
        activeParameter: 0,
      });
      continue;
    }

    if (char === ')') {
      frames.pop();
      continue;
    }

    if (char === ',' && squareDepth === 0 && frames.length > 0) {
      const frame = frames[frames.length - 1];
      frame.activeParameter++;
      frame.currentArgumentStart = i + 1;
    }
  }

  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i];
    if (frame.calleeText) {
      const argumentSource = source.slice(frame.openParenIndex + 1, safeOffset);
      return {
        calleeText: frame.calleeText,
        activeParameter: frame.activeParameter,
        activeArgumentText: source.slice(frame.currentArgumentStart, safeOffset),
        previousArgumentTexts: splitTopLevelArguments(argumentSource).slice(0, -1),
      };
    }
  }

  return null;
}

function splitTopLevelArguments(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let squareDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '/' && next === '/') {
      i = skipLineComment(text, i + 2);
      continue;
    }
    if (char === '/' && next === '*') {
      i = skipBlockComment(text, i + 2);
      continue;
    }
    if (char === '"' || char === "'") {
      i = skipQuotedText(text, i, char, text.length);
      continue;
    }

    if (char === '(') parenDepth++;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') squareDepth++;
    if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    if (char === ',' && parenDepth === 0 && squareDepth === 0) {
      result.push(text.slice(start, i));
      start = i + 1;
    }
  }

  result.push(text.slice(start));
  return result;
}

function calleeTextBefore(source: string, openParenIndex: number): string | null {
  const fragment = source.slice(Math.max(0, openParenIndex - 160), openParenIndex);
  const match = /((?:[\p{L}_][\p{L}\p{N}_]*\s*\.\s*)?[\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(fragment);
  if (!match) return null;

  const text = match[1].trim();
  if (CALL_LIKE_KEYWORDS.has(text)) return null;
  return text;
}

function skipLineComment(source: string, index: number): number {
  let i = index;
  while (i < source.length && source[i] !== '\n') i++;
  return i;
}

function skipBlockComment(source: string, index: number): number {
  let i = index;
  while (i + 1 < source.length) {
    if (source[i] === '*' && source[i + 1] === '/') return i + 1;
    i++;
  }
  return source.length;
}

function skipQuotedText(source: string, quoteStart: number, quote: string, limit: number): number {
  let i = quoteStart + 1;
  while (i < limit) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i;
    i++;
  }
  return limit;
}

function signatureFromFunctionSpec(fn: FunctionSpec): IdylliumSignature {
  const minArguments = fn.minArguments ?? fn.parameters.length;
  const parameters: IdylliumSignatureParameter[] = fn.parameters.map((param, index) => {
    const label = `${param.name}: ${typeToString(param.type)}`;
    return {
      name: param.name,
      label: index >= minArguments ? `[${label}]` : label,
    };
  });
  if (fn.variadic) {
    parameters.push({
      name: undefined,
      label: fn.variadicTypes?.length === 1 ? `...values: ${typeToString(fn.variadicTypes[0])}` : '...values',
    });
  }

  return {
    label: signatureDetail(fn),
    parameters,
    documentation: fn.documentation,
    allowsNamedArguments: !fn.variadic,
  };
}

function signatureFromFunctionDeclaration(declaration: FunctionDeclaration): IdylliumSignature {
  const parameters = declaration.parameters.map((parameter) => ({
    name: parameter.name,
    label: parameterDetail(parameter),
  }));

  return {
    label: callableDetail(
      declaration.name,
      parameters.map((parameter) => parameter.label),
      typeNameText(declaration.returnType),
    ),
    parameters,
    allowsNamedArguments: true,
  };
}

function parameterDetail(parameter: FunctionDeclaration['parameters'][number]): string {
  return `${parameter.name}: ${typeNameText(parameter.paramType)}${parameter.defaultValue ? ' = ...' : ''}`;
}

function signatureFromDetail(detail: string): IdylliumSignature {
  const open = detail.indexOf('(');
  const close = detail.indexOf(')', open + 1);
  const parametersText = open >= 0 && close >= open ? detail.slice(open + 1, close).trim() : '';
  const parameters = parametersText.length === 0
    ? []
    : splitSignatureParameters(parametersText).map((label) => ({
      name: parameterNameFromLabel(label),
      label,
    }));

  return {
    label: detail,
    parameters,
    allowsNamedArguments: !parameters.some((parameter) => parameter.label.trim().startsWith('...')),
  };
}

function activeParameterForCall(call: ActiveCall, signature: IdylliumSignature): number {
  const named = namedArgumentName(call.activeArgumentText);
  if (named) {
    const namedIndex = signature.parameters.findIndex((parameter) => parameter.name === named);
    if (namedIndex >= 0) return namedIndex;
  }

  const hasNamedArguments = call.previousArgumentTexts.some((text) => namedArgumentName(text) !== null);
  if (hasNamedArguments && argumentNamePrefix(call.activeArgumentText) !== null) {
    const used = usedNamedArgumentNames(call);
    const availableIndex = signature.parameters.findIndex((parameter) => parameter.name && !used.has(parameter.name));
    if (availableIndex >= 0) return availableIndex;
  }

  return call.activeParameter;
}

function argumentNamePrefix(text: string): string | null {
  const trimmed = text.trimStart();
  if (topLevelEqualsIndex(trimmed) >= 0) return null;

  const match = /^([\p{L}_][\p{L}\p{N}_]*)?$/u.exec(trimmed);
  return match ? (match[1] ?? '') : null;
}

function namedArgumentName(text: string): string | null {
  const trimmed = text.trimStart();
  const equals = topLevelEqualsIndex(trimmed);
  if (equals < 0) return null;

  const name = trimmed.slice(0, equals).trim();
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) ? name : null;
}

function usedNamedArgumentNames(call: ActiveCall): Set<string> {
  const used = new Set<string>();
  for (const argumentText of call.previousArgumentTexts) {
    const name = namedArgumentName(argumentText);
    if (name) used.add(name);
  }

  const current = namedArgumentName(call.activeArgumentText);
  if (current) used.add(current);
  return used;
}

function topLevelEqualsIndex(text: string): number {
  let parenDepth = 0;
  let squareDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '/' && next === '/') {
      i = skipLineComment(text, i + 2);
      continue;
    }
    if (char === '/' && next === '*') {
      i = skipBlockComment(text, i + 2);
      continue;
    }
    if (char === '"' || char === "'") {
      i = skipQuotedText(text, i, char, text.length);
      continue;
    }

    if (char === '(') parenDepth++;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') squareDepth++;
    if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    if (char === '=' && parenDepth === 0 && squareDepth === 0) return i;
  }

  return -1;
}

function parameterNameFromLabel(label: string): string | undefined {
  const cleaned = label.trim().replace(/^\[/u, '').replace(/\]$/u, '').replace(/^\.\.\./u, '');
  const colon = cleaned.indexOf(':');
  if (colon < 0) return undefined;

  const name = cleaned.slice(0, colon).trim();
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) ? name : undefined;
}

function splitSignatureParameters(text: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '<') depth++;
    if (char === '>') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      result.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(text.slice(start).trim());
  return result.filter(Boolean);
}

const CALL_LIKE_KEYWORDS = new Set([
  'if',
  'while',
  'for',
  'function',
  'main',
  'constructor',
]);

interface SourceWord {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

function wordAtOffset(source: string, offset: number): SourceWord | null {
  const safeOffset = Math.max(0, Math.min(source.length, offset));
  let start = safeOffset;
  let end = safeOffset;

  if (start > 0 && !isIdentifierChar(source[start]) && isIdentifierChar(source[start - 1])) {
    start--;
    end--;
  }

  while (start > 0 && isIdentifierChar(source[start - 1])) start--;
  while (end < source.length && isIdentifierChar(source[end])) end++;

  if (start === end) return null;
  return {
    text: source.slice(start, end),
    start,
    end,
  };
}

function memberContext(source: string, wordStart: number): { readonly objectName: string } | null {
  let dot = wordStart - 1;
  while (dot >= 0 && /\s/u.test(source[dot])) dot--;
  if (source[dot] !== '.') return null;

  let end = dot;
  let start = end;
  while (start > 0 && /\s/u.test(source[start - 1])) start--;
  end = start;
  while (start > 0 && isIdentifierChar(source[start - 1])) start--;
  if (start === end) return null;
  return { objectName: source.slice(start, end) };
}

function useModuleNameAtWord(source: string, word: SourceWord): string | null {
  const lineStart = source.lastIndexOf('\n', word.start - 1) + 1;
  const beforeWord = source.slice(lineStart, word.start);
  if (!/^\s*use\s+$/u.test(beforeWord)) return null;

  const afterWord = source.slice(word.end);
  if (!/^\s*(?:;|$)/u.test(afterWord)) return null;
  return word.text;
}

function hoverFromWord(source: string, file: string, word: SourceWord, detail: string): IdylliumHover {
  return {
    detail,
    range: {
      start: sourceLocationAtOffset(source, file, word.start),
      end: sourceLocationAtOffset(source, file, word.end),
    },
  };
}

function sourceLocationAtOffset(source: string, file: string, offset: number): SourceRange['start'] {
  const safeOffset = Math.max(0, Math.min(source.length, offset));
  let line = 1;
  let column = 1;

  for (let i = 0; i < safeOffset; i++) {
    if (source[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { file, line, column };
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

function primitiveTypeHover(text: string): string | null {
  if (['int', 'float', 'string', 'char', 'bool', 'void'].includes(text)) {
    return `type ${text}`;
  }
  return null;
}

function typeNameText(typeName: TypeName): string {
  if (typeName.kind === 'PrimitiveTypeName') return typeName.name;
  if (typeName.kind === 'ClassTypeName') return typeName.name;
  if (typeName.kind === 'QualifiedTypeName') return `${typeName.moduleName}.${typeName.name}`;
  if (typeName.kind === 'ArrayTypeName') {
    const element = typeNameText(typeName.elementType);
    return typeName.dynamic ? `dyn_array<${element}>` : `array<${element}, ${typeName.size ?? '?'}>`;
  }
  return 'unknown';
}
