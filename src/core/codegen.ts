import {
  AssignmentStatement,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallArgument,
  CallExpression,
  ClassDeclaration,
  ClassFieldDeclaration,
  ClassMethodDeclaration,
  ConstructorDeclaration,
  ContinueStatement,
  DoWhileStatement,
  Expression,
  ExpressionStatement,
  ForClauseStatement,
  ForStatement,
  FunctionDeclaration,
  MemberExpression,
  ParameterDeclaration,
  Program,
  ReturnStatement,
  Statement,
  TypeName,
  TryStatement,
  VariableDeclaration,
  WhileStatement,
} from './ast';
import { SourceRange } from './diagnostics';
import { TypeRef, arrayType, primitive, qualified, typeToString } from './types';
import { ParameterSpec, createDefaultStandardLibrary } from './stdlib/registry';

export interface CodegenResult {
  readonly jsCode: string;
}

export interface JavaScriptGeneratorOptions {
  readonly userModuleNames?: ReadonlySet<string>;
}

export interface ModuleProgram {
  readonly name: string;
  readonly program: Program;
}

export interface GenerateOptions {
  readonly modules?: readonly ModuleProgram[];
}

export class JavaScriptGenerator {
  private importedModules = new Set<string>();
  private userClassNames = new Set<string>();
  private classFields = new Map<string, Map<string, TypeName>>();
  private functionParameters = new Map<string, readonly ParameterDeclaration[]>();
  private classMethodParameters = new Map<string, readonly ParameterDeclaration[]>();
  private classConstructorParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleFunctionParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleClassMethodParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleClassConstructorParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleClassNames = new Set<string>();
  private moduleClassFields = new Map<string, Map<string, TypeName>>();
  private scopes: Array<Map<string, TypeName>> = [new Map()];
  private currentClassNames: string[] = [];
  private returnTypes: TypeName[] = [];
  private classFieldInitializerDepth = 0;
  private readonly userModuleNames: ReadonlySet<string>;
  private readonly stdlib = createDefaultStandardLibrary();

  constructor(options: JavaScriptGeneratorOptions = {}) {
    this.userModuleNames = options.userModuleNames ?? new Set();
  }

  generate(program: Program, options: GenerateOptions = {}): CodegenResult {
    const modules = options.modules ?? [];
    this.prepareModuleSignatures(modules);
    this.importedModules = new Set(program.imports.map((item) => item.moduleName));
    this.userClassNames = new Set(program.declarations
      .filter((item): item is ClassDeclaration => item.kind === 'ClassDeclaration')
      .map((item) => item.name));
    const lines: string[] = [];
    lines.push('return async function __idylliumProgram($rt) {');

    for (const module of modules) {
      this.emitModule(module, lines, 1);
    }

    this.prepareProgramState(program);
    this.emitProgramDeclarations(program, lines, 1);

    if (program.main) {
      lines.push('  async function main() {');
      this.returnTypes.push(program.main.returnType);
      this.emitBlock(program.main.body, lines, 2);
      this.returnTypes.pop();
      lines.push('  }');
      lines.push('  await main();');
    }

    lines.push('};');
    return { jsCode: lines.join('\n') };
  }

  private emitModule(module: ModuleProgram, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}$rt.modules.${module.name} = await (async function() {`);
    this.prepareProgramState(module.program);
    this.emitProgramDeclarations(module.program, lines, indent + 1);
    lines.push(`${pad}  return {`);
    for (const declaration of module.program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        lines.push(`${pad}    ${JSON.stringify(declaration.name)}: ${declaration.name},`);
      }
      if (declaration.kind === 'VariableDeclaration') {
        lines.push(`${pad}    ${JSON.stringify(declaration.name)}: ${declaration.name},`);
      }
      if (declaration.kind === 'ClassDeclaration') {
        lines.push(`${pad}    ${JSON.stringify(declaration.name)}: ${this.classObjectName(declaration.name)},`);
        lines.push(`${pad}    ${JSON.stringify(this.exportedClassCreateName(declaration.name))}: ${this.classCreateFactoryName(declaration.name)},`);
        lines.push(`${pad}    ${JSON.stringify(this.exportedClassDefaultName(declaration.name))}: ${this.classDefaultFactoryName(declaration.name)},`);
      }
    }
    lines.push(`${pad}  };`);
    lines.push(`${pad}})();`);
  }

  private prepareProgramState(program: Program): void {
    this.importedModules = new Set(program.imports.map((item) => item.moduleName));
    this.userClassNames = new Set(program.declarations
      .filter((item): item is ClassDeclaration => item.kind === 'ClassDeclaration')
      .map((item) => item.name));
    this.classFields = new Map();
    this.functionParameters = new Map();
    this.classMethodParameters = new Map();
    this.classConstructorParameters = new Map();
    const ownClassFields = new Map<string, Map<string, TypeName>>();
    for (const declaration of program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        this.functionParameters.set(declaration.name, declaration.parameters);
      }
      if (declaration.kind !== 'ClassDeclaration') continue;
      const fields = new Map<string, TypeName>();
      for (const member of declaration.members) {
        if (member.kind === 'ClassFieldDeclaration') {
          for (const field of member.fields) fields.set(field.name, member.declaredType);
        }
        if (member.kind === 'ClassMethodDeclaration') {
          this.classMethodParameters.set(this.classMemberKey(declaration.name, member.name), member.parameters);
        }
        if (member.kind === 'ConstructorDeclaration') {
          this.classConstructorParameters.set(declaration.name, member.parameters);
        }
      }
      ownClassFields.set(declaration.name, fields);
    }

    const collectFields = (className: string, seen = new Set<string>()): Map<string, TypeName> => {
      if (this.classFields.has(className)) return this.classFields.get(className) ?? new Map();
      if (seen.has(className)) return ownClassFields.get(className) ?? new Map();
      seen.add(className);

      const declaration = program.declarations.find((item): item is ClassDeclaration => (
        item.kind === 'ClassDeclaration' && item.name === className
      ));
      const fields = new Map<string, TypeName>();
      if (declaration?.baseName) {
        for (const [name, type] of collectFields(declaration.baseName, seen)) {
          fields.set(name, type);
        }
      }
      for (const [name, type] of ownClassFields.get(className) ?? new Map()) {
        fields.set(name, type);
      }
      this.classFields.set(className, fields);
      return fields;
    };

    for (const className of ownClassFields.keys()) {
      collectFields(className);
    }
    this.scopes = [new Map()];
    this.currentClassNames = [];
    this.returnTypes = [];
  }

  private prepareModuleSignatures(modules: readonly ModuleProgram[]): void {
    this.moduleFunctionParameters = new Map();
    this.moduleClassMethodParameters = new Map();
    this.moduleClassConstructorParameters = new Map();
    this.moduleClassNames = new Set();
    this.moduleClassFields = new Map();

    for (const module of modules) {
      const declarations = new Map<string, ClassDeclaration>();
      const ownFields = new Map<string, Map<string, TypeName>>();
      for (const declaration of module.program.declarations) {
        if (declaration.kind === 'FunctionDeclaration') {
          this.moduleFunctionParameters.set(`${module.name}.${declaration.name}`, declaration.parameters);
          continue;
        }

        if (declaration.kind !== 'ClassDeclaration') continue;
        this.moduleClassNames.add(`${module.name}.${declaration.name}`);
        declarations.set(declaration.name, declaration);
        const fields = new Map<string, TypeName>();
        for (const member of declaration.members) {
          if (member.kind === 'ClassFieldDeclaration') {
            for (const field of member.fields) fields.set(field.name, member.declaredType);
          }
          if (member.kind === 'ClassMethodDeclaration') {
            this.moduleClassMethodParameters.set(`${module.name}.${this.classMemberKey(declaration.name, member.name)}`, member.parameters);
          }
          if (member.kind === 'ConstructorDeclaration') {
            this.moduleClassConstructorParameters.set(`${module.name}.${declaration.name}`, member.parameters);
          }
        }
        ownFields.set(declaration.name, fields);
      }

      const collectFields = (className: string, seen = new Set<string>()): Map<string, TypeName> => {
        const key = `${module.name}.${className}`;
        const cached = this.moduleClassFields.get(key);
        if (cached) return cached;
        if (seen.has(className)) return ownFields.get(className) ?? new Map();
        seen.add(className);

        const fields = new Map<string, TypeName>();
        const declaration = declarations.get(className);
        if (declaration?.baseName) {
          for (const [name, type] of collectFields(declaration.baseName, seen)) fields.set(name, type);
        }
        for (const [name, type] of ownFields.get(className) ?? new Map()) fields.set(name, type);
        this.moduleClassFields.set(key, fields);
        return fields;
      };

      for (const className of declarations.keys()) {
        collectFields(className);
      }
    }
  }

  private emitProgramDeclarations(program: Program, lines: string[], indent: number): void {

    for (const declaration of program.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        this.emitClassDeclaration(declaration, lines, indent);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'VariableDeclaration') {
        this.emitVariableDeclaration(declaration, lines, indent);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        this.emitFunctionDeclaration(declaration, lines, indent);
      }
    }
  }

  private emitBlock(block: BlockStatement, lines: string[], indent: number): void {
    this.pushScope();
    for (const statement of block.statements) {
      this.emitStatement(statement, lines, indent);
    }
    this.popScope();
  }

  private emitStatement(statement: Statement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    switch (statement.kind) {
      case 'BlockStatement':
        lines.push(`${pad}{`);
        this.emitBlock(statement, lines, indent + 1);
        lines.push(`${pad}}`);
        return;
      case 'IfStatement':
        lines.push(`${pad}if (${this.expression(statement.condition)}) {`);
        this.emitStatementBody(statement.thenBranch, lines, indent + 1);
        if (statement.elseBranch) {
          lines.push(`${pad}} else {`);
          this.emitStatementBody(statement.elseBranch, lines, indent + 1);
        }
        lines.push(`${pad}}`);
        return;
      case 'TryStatement':
        this.emitTryStatement(statement, lines, indent);
        return;
      case 'WhileStatement':
        this.emitWhileStatement(statement, lines, indent);
        return;
      case 'DoWhileStatement':
        this.emitDoWhileStatement(statement, lines, indent);
        return;
      case 'ForStatement':
        this.emitForStatement(statement, lines, indent);
        return;
      case 'BreakStatement':
        this.emitBreakStatement(statement, lines, indent);
        return;
      case 'ContinueStatement':
        this.emitContinueStatement(statement, lines, indent);
        return;
      case 'ReturnStatement':
        this.emitReturnStatement(statement, lines, indent);
        return;
      case 'VariableDeclaration':
        this.emitVariableDeclaration(statement, lines, indent);
        return;
      case 'AssignmentStatement':
        this.emitAssignment(statement, lines, indent);
        return;
      case 'ExpressionStatement':
        lines.push(`${pad}${this.maybeAwait(statement.expression)};`);
        return;
    }
  }

  private emitStatementBody(statement: Statement, lines: string[], indent: number): void {
    if (statement.kind === 'BlockStatement') {
      this.emitBlock(statement, lines, indent);
      return;
    }
    this.emitStatement(statement, lines, indent);
  }

  private emitVariableDeclaration(statement: VariableDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}${this.variableDeclarationCode(statement)};`);
  }

  private emitTryStatement(statement: TryStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}try {`);
    this.emitBlock(statement.tryBlock, lines, indent + 1);

    if (statement.catchClause) {
      lines.push(`${pad}} catch ($caught) {`);
      if (statement.catchClause.name) {
        lines.push(`${pad}  const ${statement.catchClause.name} = $rt.errors.catchValue($caught);`);
      } else {
        lines.push(`${pad}  $rt.errors.catchValue($caught);`);
      }
      this.emitBlock(statement.catchClause.body, lines, indent + 1);
    }

    if (statement.finallyBlock) {
      lines.push(`${pad}} finally {`);
      this.emitBlock(statement.finallyBlock, lines, indent + 1);
    }

    lines.push(`${pad}}`);
  }

  private emitFunctionDeclaration(declaration: FunctionDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}async function ${declaration.name}(${params}) {`);
    this.pushScope();
    this.returnTypes.push(declaration.returnType);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 1);
    this.emitParameterCasts(declaration.parameters, lines, indent + 1);
    this.emitBlock(declaration.body, lines, indent + 1);
    this.returnTypes.pop();
    this.popScope();
    lines.push(`${pad}}`);
  }

  private emitClassDeclaration(declaration: ClassDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const classObjectName = this.classObjectName(declaration.name);

    lines.push(`${pad}const ${classObjectName} = {};`);
    lines.push(`${pad}async function ${this.classDefaultFactoryName(declaration.name)}() {`);
    if (declaration.baseName) {
      lines.push(`${pad}  const self = await ${this.classDefaultFactoryName(declaration.baseName)}();`);
      lines.push(`${pad}  self.__idylliumType = ${JSON.stringify(declaration.name)};`);
    } else {
      lines.push(`${pad}  const self = { __idylliumType: ${JSON.stringify(declaration.name)} };`);
    }

    for (const member of declaration.members) {
      if (member.kind === 'ClassMethodDeclaration' && !member.isStatic) {
        this.emitInstanceMethod(declaration.name, member, lines, indent + 1);
      }
    }

    this.currentClassNames.push(declaration.name);
    this.classFieldInitializerDepth += 1;
    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        this.emitClassFieldDefaults(member, lines, indent + 1);
      }
    }
    this.classFieldInitializerDepth -= 1;
    this.currentClassNames.pop();

    lines.push(`${pad}  return self;`);
    lines.push(`${pad}}`);
    const constructor = declaration.members.find((member): member is ConstructorDeclaration => member.kind === 'ConstructorDeclaration');
    lines.push(`${pad}async function ${this.classInitFunctionName(declaration.name)}(self, ...__args) {`);
    if (constructor) {
      if (declaration.baseName) {
        lines.push(`${pad}  const parent = async (...__parentArgs) => {`);
        lines.push(`${pad}    await ${this.classInitFunctionName(declaration.baseName)}(self, ...__parentArgs);`);
        lines.push(`${pad}  };`);
      }
      this.emitConstructorCall(declaration.name, constructor, lines, indent + 1);
    }
    lines.push(`${pad}}`);
    lines.push(`${pad}async function ${this.classCreateFactoryName(declaration.name)}(...__args) {`);
    lines.push(`${pad}  const self = await ${this.classDefaultFactoryName(declaration.name)}();`);
    lines.push(`${pad}  await ${this.classInitFunctionName(declaration.name)}(self, ...__args);`);
    lines.push(`${pad}  return self;`);
    lines.push(`${pad}}`);

    for (const member of declaration.members) {
      if (member.kind === 'ClassMethodDeclaration' && member.isStatic) {
        this.emitStaticMethod(declaration.name, member, lines, indent);
      }
    }
  }

  private emitClassFieldDefaults(declaration: ClassFieldDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    for (const field of declaration.fields) {
      const rawValue = field.initializer
        ? this.expression(field.initializer)
        : this.defaultValue(declaration.declaredType, false);
      const value = field.initializer
        ? this.valueForType(rawValue, declaration.declaredType, field.initializer.range)
        : this.castForType(rawValue, declaration.declaredType);
      lines.push(`${pad}self.${field.name} = ${value};`);
    }
  }

  private emitInstanceMethod(className: string, declaration: ClassMethodDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}self.${declaration.name} = async function(${params}) {`);
    this.pushScope();
    this.currentClassNames.push(className);
    this.returnTypes.push(declaration.returnType);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 1);
    this.emitParameterCasts(declaration.parameters, lines, indent + 1);
    this.emitBlock(declaration.body, lines, indent + 1);
    this.returnTypes.pop();
    this.currentClassNames.pop();
    this.popScope();
    lines.push(`${pad}};`);
  }

  private emitStaticMethod(className: string, declaration: ClassMethodDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}${this.classObjectName(className)}.${declaration.name} = async function(${params}) {`);
    this.pushScope();
    this.currentClassNames.push(className);
    this.returnTypes.push(declaration.returnType);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 1);
    this.emitParameterCasts(declaration.parameters, lines, indent + 1);
    this.emitBlock(declaration.body, lines, indent + 1);
    this.returnTypes.pop();
    this.currentClassNames.pop();
    this.popScope();
    lines.push(`${pad}};`);
  }

  private emitConstructorCall(className: string, declaration: ConstructorDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}await (async function(${params}) {`);
    this.pushScope();
    this.currentClassNames.push(className);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 1);
    this.emitParameterCasts(declaration.parameters, lines, indent + 1);
    this.emitBlock(declaration.body, lines, indent + 1);
    this.currentClassNames.pop();
    this.popScope();
    lines.push(`${pad}}).apply(self, __args);`);
  }

  private emitAssignment(statement: AssignmentStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}${this.assignmentCode(statement)};`);
  }

  private emitWhileStatement(statement: WhileStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}while (${this.expression(statement.condition)}) {`);
    this.emitStatementBody(statement.body, lines, indent + 1);
    lines.push(`${pad}}`);
  }

  private emitDoWhileStatement(statement: DoWhileStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}do {`);
    this.emitStatementBody(statement.body, lines, indent + 1);
    lines.push(`${pad}} while (${this.expression(statement.condition)});`);
  }

  private emitForStatement(statement: ForStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    this.pushScope();
    const initializer = statement.initializer ? this.forClauseCode(statement.initializer) : '';
    const condition = statement.condition ? this.expression(statement.condition) : '';
    const increment = statement.increment ? this.forClauseCode(statement.increment) : '';
    lines.push(`${pad}for (${initializer}; ${condition}; ${increment}) {`);
    this.emitStatementBody(statement.body, lines, indent + 1);
    lines.push(`${pad}}`);
    this.popScope();
  }

  private emitBreakStatement(_statement: BreakStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}break;`);
  }

  private emitContinueStatement(_statement: ContinueStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}continue;`);
  }

  private emitReturnStatement(statement: ReturnStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const rawValue = statement.value ? this.expression(statement.value) : '';
    const returnType = this.returnTypes[this.returnTypes.length - 1] ?? null;
    const value = statement.value
      ? ` ${returnType ? this.valueForType(rawValue, returnType, statement.value.range) : rawValue}`
      : '';
    lines.push(`${pad}return${value};`);
  }

  private forClauseCode(statement: ForClauseStatement): string {
    switch (statement.kind) {
      case 'VariableDeclaration':
        return this.variableDeclarationCode(statement);
      case 'AssignmentStatement':
        return this.assignmentCode(statement);
      case 'ExpressionStatement':
        return this.expression(statement.expression);
    }
  }

  private variableDeclarationCode(statement: VariableDeclaration): string {
    const rawValue = statement.initializer
      ? this.expression(statement.initializer)
      : statement.constructorArgs
        ? this.constructorInitializer(statement)
        : this.defaultValue(statement.declaredType);
    const value = statement.initializer
      ? this.valueForType(rawValue, statement.declaredType, statement.initializer.range)
      : this.castForType(rawValue, statement.declaredType);
    this.declareType(statement.name, statement.declaredType);
    return `${statement.isConst ? 'const' : 'let'} ${statement.name} = ${value}`;
  }

  private assignmentCode(statement: AssignmentStatement): string {
    const targetType = this.targetTypeName(statement.target);
    if (statement.operator === '=') {
      if (statement.target.kind === 'IndexExpression') {
        const value = this.valueForType(this.expression(statement.value), targetType, statement.value.range);
        return `$rt.array.set(${this.expression(statement.target.object)}, ${this.expression(statement.target.index)}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      }
      if (statement.target.kind === 'MemberExpression') {
        const value = this.valueForType(this.expression(statement.value), targetType, statement.value.range);
        return `$rt.setProperty(${this.expression(statement.target.object)}, ${JSON.stringify(statement.target.name)}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      }
      return `${this.expression(statement.target)} = ${this.valueForType(this.expression(statement.value), targetType, statement.value.range)}`;
    }

    if (statement.target.kind === 'IndexExpression') {
      const object = this.expression(statement.target.object);
      const index = this.expression(statement.target.index);
      const current = `$rt.array.get(${object}, ${index}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      const rawValue = this.compoundAssignmentValue(statement.operator, current, this.expression(statement.value), statement.range);
      const value = this.valueForType(rawValue, targetType, statement.range);
      return `$rt.array.set(${object}, ${index}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
    }

    const target = this.expression(statement.target);
    const value = this.expression(statement.value);
    const rawAssignedValue = this.compoundAssignmentValue(statement.operator, target, value, statement.range);
    if (statement.target.kind === 'MemberExpression') {
      const assignedValue = this.valueForType(rawAssignedValue, targetType, statement.range);
      return `$rt.setProperty(${this.expression(statement.target.object)}, ${JSON.stringify(statement.target.name)}, ${assignedValue}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
    }
    return `${target} = ${this.valueForType(rawAssignedValue, targetType, statement.range)}`;
  }

  private compoundAssignmentValue(
    operator: Exclude<AssignmentStatement['operator'], '='>,
    target: string,
    value: string,
    range: AssignmentStatement['range'],
  ): string {
    const binaryOperator = operator.slice(0, 1);
    if (binaryOperator === '/') {
      return `$rt.core.divide(${target}, ${value}, ${JSON.stringify(range.start.file)}, ${range.start.line})`;
    }
    return `$rt.core.binary(${JSON.stringify(binaryOperator)}, ${target}, ${value}, ${JSON.stringify(range.start.file)}, ${range.start.line})`;
  }

  private maybeAwait(expression: Expression): string {
    return this.expression(expression);
  }

  private expression(expression: Expression): string {
    switch (expression.kind) {
      case 'LiteralExpression':
        if (
          expression.valueType === 'int'
          && typeof expression.value === 'number'
          && !Number.isSafeInteger(expression.value)
        ) {
          return `BigInt(${JSON.stringify(expression.sourceText ?? String(expression.value))})`;
        }
        return JSON.stringify(expression.value);
      case 'IdentifierExpression':
        if (expression.name === 'this') return this.classFieldInitializerDepth > 0 ? 'self' : 'this';
        if (this.userClassNames.has(expression.name)) return this.classObjectName(expression.name);
        return expression.name;
      case 'UnaryExpression':
        return expression.operator === 'not'
          ? `(!${this.expression(expression.operand)})`
          : `$rt.core.negate(${this.expression(expression.operand)})`;
      case 'BinaryExpression':
        return this.binaryExpression(expression);
      case 'ArrayLiteralExpression':
        return this.arrayLiteralExpression(expression, true, null, '() => 0');
      case 'IndexExpression':
        return `$rt.array.get(${this.expression(expression.object)}, ${this.expression(expression.index)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      case 'FunctionExpression':
        return this.functionExpression(expression);
      case 'CallExpression':
        return `(await ${this.callExpression(expression)})`;
      case 'MemberExpression':
        return this.memberExpression(expression);
    }
  }

  private functionExpression(expression: Extract<Expression, { kind: 'FunctionExpression' }>): string {
    const params = expression.parameters.map((parameter) => parameter.name).join(', ');
    const lines = [`(async function(${params}) {`];
    this.pushScope();
    this.returnTypes.push(expression.returnType);
    this.emitParameterDefaults(expression.parameters, lines, 1);
    this.emitParameterCasts(expression.parameters, lines, 1);
    this.emitBlock(expression.body, lines, 1);
    this.returnTypes.pop();
    this.popScope();
    lines.push('})');
    return lines.join('\n');
  }

  private binaryExpression(expression: BinaryExpression): string {
    const left = this.expression(expression.left);
    const right = this.expression(expression.right);
    if (expression.operator === '/') {
      return `$rt.core.divide(${left}, ${right}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
    }
    if (expression.operator === 'and') {
      return `(${left} && ${right})`;
    }
    if (expression.operator === 'or') {
      return `(${left} || ${right})`;
    }
    if (expression.operator === 'xor') {
      return `(${left} !== ${right})`;
    }
    return `$rt.core.binary(${JSON.stringify(expression.operator)}, ${left}, ${right}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
  }

  private callExpression(expression: CallExpression): string {
    const callee = expression.callee;

    if (callee.kind === 'IdentifierExpression') {
      if (this.userClassNames.has(callee.name)) {
        const args = this.callArgumentValues(
          expression.args,
          this.classConstructorParameters.get(callee.name)?.map((parameter) => parameter.name),
        ).join(', ');
        return `${this.classCreateFactoryName(callee.name)}(${args})`;
      }
      if (callee.name === 'max' || callee.name === 'min' || callee.name === 'sum' || callee.name === 'avg') {
        const args = this.callArgumentValues(expression.args, ['array']).join(', ');
        return `$rt.array.${callee.name}(${args}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (callee.name === 'div' || callee.name === 'mod' || callee.name === 'to_int' || callee.name === 'to_float') {
        const args = this.callArgumentValues(expression.args, this.stdlib.getGlobalFunction(callee.name)?.parameters.map((parameter) => parameter.name)).join(', ');
        return `$rt.core.${callee.name}(${args}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (callee.name === 'to_string') {
        const args = this.callArgumentValues(expression.args, this.stdlib.getGlobalFunction(callee.name)?.parameters.map((parameter) => parameter.name)).join(', ');
        return `$rt.core.to_string(${args})`;
      }
    }

    if (callee.kind === 'MemberExpression' && callee.object.kind === 'IdentifierExpression') {
      const moduleName = callee.object.name;
      if (this.moduleClassNames.has(`${moduleName}.${callee.name}`)) {
        const args = this.callArgumentValues(
          expression.args,
          this.moduleClassConstructorParameters.get(`${moduleName}.${callee.name}`)?.map((parameter) => parameter.name),
        ).join(', ');
        return `$rt.modules.${moduleName}.${this.exportedClassCreateName(callee.name)}(${args})`;
      }
      if (this.importedModules.has(moduleName) && moduleName === 'console') {
        const args = this.callArgumentValues(expression.args, this.stdlib.getModuleFunction(moduleName, callee.name)?.parameters.map((parameter) => parameter.name)).join(', ');
        if (callee.name === 'get_int' || callee.name === 'get_float') {
          return `$rt.console.${callee.name}(${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
        }
        if (callee.name === 'set_precision') {
          return `$rt.console.set_precision(${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line}, ${args})`;
        }
        return `$rt.console.${callee.name}(${args})`;
      }
      if (this.importedModules.has(moduleName)) {
        const args = this.userModuleNames.has(moduleName)
          ? this.callArgumentValues(expression.args, this.moduleFunctionParameterNames(moduleName, callee.name)).join(', ')
          : this.stdlibCallArgumentValues(
            expression.args,
            this.stdlib.getModuleFunction(moduleName, callee.name)?.parameters,
          ).join(', ');
        if (!this.userModuleNames.has(moduleName)) {
          return `$rt.callModuleFunction(${JSON.stringify(moduleName)}, ${JSON.stringify(callee.name)}, [${args}], ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
        }
        return `$rt.modules.${moduleName}.${callee.name}(${args})`;
      }
    }

    if (callee.kind === 'MemberExpression') {
      const typeName = this.expressionTypeName(callee.object);
      const typesRuntimeName = this.typesRuntimeName(typeName);
      if (typesRuntimeName && (callee.name === 'to_bin' || callee.name === 'to_hex')) {
        return `$rt.types.${callee.name}(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)})`;
      }
      if (typesRuntimeName && (callee.name === 'shift_left' || callee.name === 'shift_right')) {
        const [bits] = this.methodCallArgs(callee.name, expression.args, typeName);
        return `$rt.types.${callee.name}(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)}, ${bits}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (typesRuntimeName && (callee.name === 'bit_and' || callee.name === 'bit_or' || callee.name === 'bit_xor')) {
        const [mask] = this.methodCallArgs(callee.name, expression.args, typeName);
        return `$rt.types.${callee.name}(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)}, ${mask}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (typesRuntimeName && callee.name === 'bit_not') {
        return `$rt.types.bit_not(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }

      const args = this.methodCallArgs(callee.name, expression.args, typeName).join(', ');
      return `$rt.callMethod(${this.expression(callee.object)}, ${JSON.stringify(callee.name)}, [${args}], ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
    }

    return `${this.expression(callee)}(${this.callArgumentValues(expression.args, this.callableParameterNames(callee)).join(', ')})`;
  }

  private memberExpression(expression: MemberExpression): string {
    if (expression.object.kind === 'IdentifierExpression') {
      const moduleName = expression.object.name;
      if (this.importedModules.has(moduleName)) {
        return `$rt.modules.${moduleName}.${expression.name}`;
      }
      if (this.userClassNames.has(moduleName)) {
        return `${this.classObjectName(moduleName)}.${expression.name}`;
      }
    }
    return `${this.expression(expression.object)}.${expression.name}`;
  }

  private constructorInitializer(statement: VariableDeclaration): string {
    if (statement.declaredType.kind === 'QualifiedTypeName' && this.userModuleNames.has(statement.declaredType.moduleName)) {
      const args = this.callArgumentValues(statement.constructorArgs ?? [], this.constructorParameterNames(statement.declaredType)).join(', ');
      return `await $rt.modules.${statement.declaredType.moduleName}.${this.exportedClassCreateName(statement.declaredType.name)}(${args})`;
    }
    if (
      statement.declaredType.kind === 'QualifiedTypeName'
      && statement.declaredType.moduleName === 'json'
      && statement.declaredType.name === 'Value'
    ) {
      const args = this.callArgumentValues(
        statement.constructorArgs ?? [],
        this.stdlib.getModuleFunction('json', 'Value')?.parameters.map((parameter) => parameter.name),
      ).join(', ');
      return `$rt.callModuleFunction("json", "Value", [${args}], ${JSON.stringify(statement.range.start.file)}, ${statement.range.start.line})`;
    }
    if (statement.declaredType.kind !== 'ClassTypeName') return this.defaultValue(statement.declaredType);
    const args = this.callArgumentValues(statement.constructorArgs ?? [], this.constructorParameterNames(statement.declaredType)).join(', ');
    return `await ${this.classCreateFactoryName(statement.declaredType.name)}(${args})`;
  }

  private arrayLiteralExpression(
    expression: Extract<Expression, { kind: 'ArrayLiteralExpression' }>,
    dynamic: boolean,
    staticSize: number | null,
    defaultFactory: string,
    elementType: TypeName | null = null,
  ): string {
    const values = expression.elements
      .map((element) => this.castForType(this.expression(element), elementType))
      .join(', ');
    const size = staticSize === null ? 'null' : String(staticSize);
    return `$rt.array.from([${values}], ${dynamic ? 'true' : 'false'}, ${size}, ${defaultFactory})`;
  }

  private defaultValue(type: TypeName, runConstructor = true): string {
    const runtimeTypeName = this.typesRuntimeName(type);
    if (runtimeTypeName) return `$rt.types.cast(0, ${JSON.stringify(runtimeTypeName)})`;

    if (type.kind === 'ArrayTypeName') {
      const size = type.dynamic ? 0 : type.size ?? 0;
      return `await $rt.array.createAsync(${size}, async () => ${this.defaultValue(type.elementType, false)}, ${type.dynamic ? 'true' : 'false'})`;
    }

    if (type.kind === 'ClassTypeName') {
      return runConstructor
        ? `await ${this.classCreateFactoryName(type.name)}()`
        : `await ${this.classDefaultFactoryName(type.name)}()`;
    }

    if (type.kind === 'QualifiedTypeName') {
      if (this.userModuleNames.has(type.moduleName)) {
        return runConstructor
          ? `await $rt.modules.${type.moduleName}.${this.exportedClassCreateName(type.name)}()`
          : `await $rt.modules.${type.moduleName}.${this.exportedClassDefaultName(type.name)}()`;
      }
      if (type.moduleName === 'colors' && type.name === 'Color') {
        return '$rt.modules.colors.TRANSPARENT';
      }
      return `$rt.createObject(${JSON.stringify(type.moduleName)}, ${JSON.stringify(type.name)})`;
    }

    switch (type.name) {
      case 'string':
        return JSON.stringify('');
      case 'char':
        return JSON.stringify('\0');
      case 'bool':
        return 'false';
      default:
        return '0';
    }
  }

  private classDefaultFactoryName(className: string): string {
    return `__idyl_default_${className}`;
  }

  private classCreateFactoryName(className: string): string {
    return `__idyl_create_${className}`;
  }

  private classInitFunctionName(className: string): string {
    return `__idyl_init_${className}`;
  }

  private classObjectName(className: string): string {
    return `__idyl_class_${className}`;
  }

  private exportedClassCreateName(className: string): string {
    return `__create_${className}`;
  }

  private exportedClassDefaultName(className: string): string {
    return `__default_${className}`;
  }

  private emitParameterCasts(parameters: readonly ParameterDeclaration[], lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    for (const parameter of parameters) {
      this.declareType(parameter.name, parameter.paramType);
      const value = this.valueForType(parameter.name, parameter.paramType, parameter.range);
      if (value !== parameter.name) {
        lines.push(`${pad}${parameter.name} = ${value};`);
      }
    }
  }

  private emitParameterDefaults(parameters: readonly ParameterDeclaration[], lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    for (const parameter of parameters) {
      if (!parameter.defaultValue) continue;
      lines.push(`${pad}if (${parameter.name} === undefined) {`);
      lines.push(`${pad}  ${parameter.name} = ${this.expression(parameter.defaultValue)};`);
      lines.push(`${pad}}`);
    }
  }

  private callArgumentValues(args: readonly CallArgument[], parameterNames?: readonly string[]): string[] {
    return this.orderedCallArguments(args, parameterNames).map((arg) => (
      arg ? this.expression(arg.value) : 'undefined'
    ));
  }

  private stdlibCallArgumentValues(
    args: readonly CallArgument[],
    parameters?: readonly ParameterSpec[],
  ): string[] {
    const orderedArgs = this.orderedCallArguments(args, parameters?.map((parameter) => parameter.name));
    return orderedArgs.map((arg, index) => {
      if (!arg) return 'undefined';
      const value = this.expression(arg.value);
      const parameter = parameters?.[index];
      return parameter ? this.valueForTypeRef(value, parameter.type, arg.value.range) : value;
    });
  }

  private orderedCallArguments(args: readonly CallArgument[], parameterNames?: readonly string[]): Array<CallArgument | null> {
    if (!args.some((arg) => arg.name !== null) || !parameterNames) return [...args];

    const ordered = new Array<CallArgument | null>(parameterNames.length).fill(null);
    let positionalIndex = 0;
    let lastProvidedIndex = -1;

    for (const arg of args) {
      if (arg.name !== null) {
        const parameterIndex = parameterNames.indexOf(arg.name);
        if (parameterIndex >= 0) {
          ordered[parameterIndex] = arg;
          lastProvidedIndex = Math.max(lastProvidedIndex, parameterIndex);
        }
        continue;
      }

      if (positionalIndex < ordered.length) {
        ordered[positionalIndex] = arg;
        lastProvidedIndex = Math.max(lastProvidedIndex, positionalIndex);
      }
      positionalIndex += 1;
    }

    if (lastProvidedIndex < 0) return [];
    return ordered.slice(0, lastProvidedIndex + 1);
  }

  private callableParameterNames(callee: Expression): readonly string[] | undefined {
    if (callee.kind === 'IdentifierExpression') {
      return this.functionParameters.get(callee.name)?.map((parameter) => parameter.name)
        ?? this.stdlib.getGlobalFunction(callee.name)?.parameters.map((parameter) => parameter.name);
    }
    return undefined;
  }

  private moduleFunctionParameterNames(moduleName: string, functionName: string): readonly string[] | undefined {
    if (this.userModuleNames.has(moduleName)) {
      return this.moduleFunctionParameters.get(`${moduleName}.${functionName}`)?.map((parameter) => parameter.name);
    }
    return this.stdlib.getModuleFunction(moduleName, functionName)?.parameters.map((parameter) => parameter.name);
  }

  private constructorParameterNames(type: TypeName): readonly string[] | undefined {
    if (type.kind === 'ClassTypeName') {
      return this.classConstructorParameters.get(type.name)?.map((parameter) => parameter.name);
    }
    if (type.kind === 'QualifiedTypeName' && this.userModuleNames.has(type.moduleName)) {
      return this.moduleClassConstructorParameters.get(`${type.moduleName}.${type.name}`)?.map((parameter) => parameter.name);
    }
    return undefined;
  }

  private methodParameterNames(methodName: string, receiverType: TypeName | null): readonly string[] | undefined {
    if (!receiverType) return undefined;
    if (receiverType.kind === 'ClassTypeName') {
      return this.classMethodParameters.get(this.classMemberKey(receiverType.name, methodName))?.map((parameter) => parameter.name);
    }
    if (receiverType.kind === 'QualifiedTypeName' && this.userModuleNames.has(receiverType.moduleName)) {
      return this.moduleClassMethodParameters.get(`${receiverType.moduleName}.${this.classMemberKey(receiverType.name, methodName)}`)?.map((parameter) => parameter.name);
    }
    if (receiverType.kind === 'ArrayTypeName') {
      return this.arrayMethodParameterNames(methodName);
    }

    const typeRef = this.typeRefFromTypeName(receiverType);
    if (!typeRef) return this.stringMethodParameterNames(receiverType, methodName);
    return this.stdlib.getTypeMethod(typeRef, methodName)?.parameters.map((parameter) => parameter.name)
      ?? this.stringMethodParameterNames(receiverType, methodName);
  }

  private arrayMethodParameterNames(methodName: string): readonly string[] | undefined {
    switch (methodName) {
      case 'contains':
      case 'find':
      case 'count':
      case 'add':
        return ['value'];
      case 'remove_at':
        return ['index'];
      case 'resize':
        return ['size'];
      case 'insert':
        return ['index', 'value'];
      case 'join':
        return ['other'];
      default:
        return [];
    }
  }

  private stringMethodParameterNames(receiverType: TypeName, methodName: string): readonly string[] | undefined {
    if (receiverType.kind !== 'PrimitiveTypeName' || receiverType.name !== 'string') return undefined;
    switch (methodName) {
      case 'contains':
      case 'find':
      case 'count':
        return ['text'];
      case 'substring':
        return ['start', 'length'];
      case 'replace':
        return ['old_text', 'new_text'];
      case 'split':
        return ['separator'];
      default:
        return [];
    }
  }

  private typeRefFromTypeName(type: TypeName): TypeRef | null {
    if (type.kind === 'PrimitiveTypeName') return primitive(type.name);
    if (type.kind === 'QualifiedTypeName') return qualified(type.moduleName, type.name);
    if (type.kind === 'ArrayTypeName') {
      const elementType = this.typeRefFromTypeName(type.elementType);
      return elementType ? arrayType(elementType, type.size, type.dynamic) : null;
    }
    return null;
  }

  private methodCallArgs(methodName: string, args: readonly CallArgument[], receiverType: TypeName | null): string[] {
    const orderedArgs = this.orderedCallArguments(args, this.methodParameterNames(methodName, receiverType));
    if (receiverType?.kind !== 'ArrayTypeName') {
      const typeRef = receiverType ? this.typeRefFromTypeName(receiverType) : null;
      const method = typeRef ? this.stdlib.getTypeMethod(typeRef, methodName) : undefined;
      return orderedArgs.map((arg, index) => {
        if (!arg) return 'undefined';
        const value = this.expression(arg.value);
        const parameter = method?.parameters[index];
        return parameter ? this.valueForTypeRef(value, parameter.type, arg.value.range) : value;
      });
    }

    if (methodName === 'add' || methodName === 'contains' || methodName === 'find' || methodName === 'count') {
      return orderedArgs.map((arg, index) => (
        index === 0 && arg
          ? this.valueForType(this.expression(arg.value), receiverType.elementType, arg.value.range)
          : arg ? this.expression(arg.value) : 'undefined'
      ));
    }

    if (methodName === 'insert') {
      return orderedArgs.map((arg, index) => (
        index === 1 && arg
          ? this.valueForType(this.expression(arg.value), receiverType.elementType, arg.value.range)
          : arg ? this.expression(arg.value) : 'undefined'
      ));
    }

    if (methodName === 'join') {
      return orderedArgs.map((arg, index) => {
        if (!arg) return 'undefined';
        if (index !== 0) return this.expression(arg.value);
        const targetType: TypeName = {
          kind: 'ArrayTypeName',
          elementType: receiverType.elementType,
          size: null,
          dynamic: true,
          range: arg.value.range,
        };
        return this.valueForType(this.expression(arg.value), targetType, arg.value.range);
      });
    }

    return orderedArgs.map((arg) => (arg ? this.expression(arg.value) : 'undefined'));
  }

  private classMemberKey(className: string, memberName: string): string {
    return `${className}.${memberName}`;
  }

  private valueForType(value: string, type: TypeName | null, range: SourceRange): string {
    if (type?.kind === 'ArrayTypeName') {
      const size = type.dynamic ? 'null' : String(type.size ?? 0);
      const convertedElement = this.valueForType('__array_item', type.elementType, range);
      return [
        '$rt.array.convert(',
        value,
        `, ${type.dynamic ? 'true' : 'false'}`,
        `, ${size}`,
        `, async () => ${this.defaultValue(type.elementType, false)}`,
        `, (__array_item) => ${convertedElement}`,
        `, ${JSON.stringify(this.typeNameToString(type))}`,
        `, ${JSON.stringify(range.start.file)}`,
        `, ${range.start.line})`,
      ].join('');
    }
    if (type?.kind === 'QualifiedTypeName') {
      const typeRef = qualified(type.moduleName, type.name);
      if (this.stdlib.typeAcceptsNull(typeRef)) {
        return this.nullableValue(value, type.moduleName, type.name, range);
      }
    }
    return this.castForType(value, type);
  }

  private valueForTypeRef(value: string, type: TypeRef, range: SourceRange): string {
    if (type.kind === 'array') {
      const size = type.dynamic ? 'null' : String(type.size ?? 0);
      const convertedElement = this.valueForTypeRef('__array_item', type.elementType, range);
      return [
        '$rt.array.convert(',
        value,
        `, ${type.dynamic ? 'true' : 'false'}`,
        `, ${size}`,
        `, async () => ${this.defaultValueForTypeRef(type.elementType)}`,
        `, (__array_item) => ${convertedElement}`,
        `, ${JSON.stringify(typeToString(type))}`,
        `, ${JSON.stringify(range.start.file)}`,
        `, ${range.start.line})`,
      ].join('');
    }

    if (type.kind === 'qualified' && type.moduleName === 'types' && TYPE_RUNTIME_NAMES.has(type.name)) {
      return `$rt.types.cast(${value}, ${JSON.stringify(type.name)})`;
    }
    if (type.kind === 'qualified' && this.stdlib.typeAcceptsNull(type)) {
      return this.nullableValue(value, type.moduleName, type.name, range);
    }
    return value;
  }

  private nullableValue(value: string, moduleName: string, typeName: string, range: SourceRange): string {
    return `$rt.convertNullable(${JSON.stringify(moduleName)}, ${JSON.stringify(typeName)}, ${value}, ${JSON.stringify(range.start.file)}, ${range.start.line})`;
  }

  private typeNameToString(type: TypeName): string {
    if (type.kind === 'PrimitiveTypeName' || type.kind === 'ClassTypeName') return type.name;
    if (type.kind === 'QualifiedTypeName') return `${type.moduleName}.${type.name}`;
    if (type.dynamic) return `dyn_array<${this.typeNameToString(type.elementType)}>`;
    return `array<${this.typeNameToString(type.elementType)}, ${type.size ?? '?'}>`;
  }

  private defaultValueForTypeRef(type: TypeRef): string {
    if (type.kind === 'array') {
      const size = type.dynamic ? 0 : type.size ?? 0;
      return `await $rt.array.createAsync(${size}, async () => ${this.defaultValueForTypeRef(type.elementType)}, ${type.dynamic ? 'true' : 'false'})`;
    }
    if (type.kind === 'qualified' && type.moduleName === 'types' && TYPE_RUNTIME_NAMES.has(type.name)) {
      return `$rt.types.cast(0, ${JSON.stringify(type.name)})`;
    }
    if (type.kind === 'qualified') {
      if (type.moduleName === 'colors' && type.name === 'Color') return '$rt.modules.colors.TRANSPARENT';
      return `$rt.createObject(${JSON.stringify(type.moduleName)}, ${JSON.stringify(type.name)})`;
    }
    if (type.kind === 'primitive') {
      if (type.name === 'string') return JSON.stringify('');
      if (type.name === 'char') return JSON.stringify('\0');
      if (type.name === 'bool') return 'false';
      return '0';
    }
    return 'null';
  }

  private castForType(value: string, type: TypeName | null): string {
    const runtimeName = this.typesRuntimeName(type);
    if (!runtimeName) return value;
    return `$rt.types.cast(${value}, ${JSON.stringify(runtimeName)})`;
  }

  private typesRuntimeName(type: TypeName | null): string | null {
    if (type?.kind !== 'QualifiedTypeName') return null;
    if (type.moduleName !== 'types') return null;
    return TYPE_RUNTIME_NAMES.has(type.name) ? type.name : null;
  }

  private targetTypeName(expression: Expression): TypeName | null {
    if (expression.kind === 'IndexExpression') {
      const objectType = this.expressionTypeName(expression.object);
      return objectType?.kind === 'ArrayTypeName' ? objectType.elementType : null;
    }
    return this.expressionTypeName(expression);
  }

  private expressionTypeName(expression: Expression): TypeName | null {
    switch (expression.kind) {
      case 'IdentifierExpression':
        return this.lookupType(expression.name);
      case 'MemberExpression':
        return this.memberTypeName(expression);
      case 'IndexExpression': {
        const objectType = this.expressionTypeName(expression.object);
        return objectType?.kind === 'ArrayTypeName' ? objectType.elementType : null;
      }
      case 'CallExpression': {
        if (expression.callee.kind === 'IdentifierExpression' && this.userClassNames.has(expression.callee.name)) {
          return {
            kind: 'ClassTypeName',
            name: expression.callee.name,
            nameRange: expression.callee.range,
            range: expression.callee.range,
          };
        }
        if (
          expression.callee.kind === 'MemberExpression'
          && expression.callee.object.kind === 'IdentifierExpression'
          && this.moduleClassNames.has(`${expression.callee.object.name}.${expression.callee.name}`)
        ) {
          return {
            kind: 'QualifiedTypeName',
            moduleName: expression.callee.object.name,
            moduleNameRange: expression.callee.object.range,
            name: expression.callee.name,
            nameRange: expression.callee.nameRange,
            range: expression.callee.range,
          };
        }
        if (expression.callee.kind !== 'MemberExpression') return null;
        if (![
          'shift_left',
          'shift_right',
          'bit_and',
          'bit_or',
          'bit_xor',
          'bit_not',
        ].includes(expression.callee.name)) return null;
        const objectType = this.expressionTypeName(expression.callee.object);
        return this.typesRuntimeName(objectType) ? objectType : null;
      }
      default:
        return null;
    }
  }

  private memberTypeName(expression: MemberExpression): TypeName | null {
    if (expression.object.kind === 'IdentifierExpression' && expression.object.name === 'this') {
      const className = this.currentClassNames[this.currentClassNames.length - 1] ?? null;
      return className ? this.classFields.get(className)?.get(expression.name) ?? null : null;
    }

    const objectType = this.expressionTypeName(expression.object);
    if (objectType?.kind === 'ClassTypeName') {
      return this.classFields.get(objectType.name)?.get(expression.name) ?? null;
    }
    if (objectType?.kind === 'QualifiedTypeName' && this.userModuleNames.has(objectType.moduleName)) {
      return this.moduleClassFields
        .get(`${objectType.moduleName}.${objectType.name}`)
        ?.get(expression.name) ?? null;
    }
    return null;
  }

  private declareType(name: string, type: TypeName): void {
    this.scopes[this.scopes.length - 1].set(name, type);
  }

  private lookupType(name: string): TypeName | null {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const type = this.scopes[i].get(name);
      if (type) return type;
    }
    return null;
  }

  private pushScope(): void {
    this.scopes.push(new Map());
  }

  private popScope(): void {
    this.scopes.pop();
  }
}

const TYPE_RUNTIME_NAMES = new Set([
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
  'int64',
  'uint64',
  'float32',
  'float64',
]);
