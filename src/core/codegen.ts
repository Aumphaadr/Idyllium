import {
  AssignmentStatement,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
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
  VariableDeclaration,
  WhileStatement,
} from './ast';

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
  private scopes: Array<Map<string, TypeName>> = [new Map()];
  private currentClassNames: string[] = [];
  private returnTypes: TypeName[] = [];
  private readonly userModuleNames: ReadonlySet<string>;

  constructor(options: JavaScriptGeneratorOptions = {}) {
    this.userModuleNames = options.userModuleNames ?? new Set();
  }

  generate(program: Program, options: GenerateOptions = {}): CodegenResult {
    const modules = options.modules ?? [];
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
      this.emitBlock(program.main.body, lines, 2);
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
    const ownClassFields = new Map<string, Map<string, TypeName>>();
    for (const declaration of program.declarations) {
      if (declaration.kind !== 'ClassDeclaration') continue;
      const fields = new Map<string, TypeName>();
      for (const member of declaration.members) {
        if (member.kind !== 'ClassFieldDeclaration') continue;
        for (const field of member.fields) fields.set(field.name, member.declaredType);
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

  private emitFunctionDeclaration(declaration: FunctionDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}async function ${declaration.name}(${params}) {`);
    this.pushScope();
    this.returnTypes.push(declaration.returnType);
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
    lines.push(`${pad}function ${this.classDefaultFactoryName(declaration.name)}() {`);
    if (declaration.baseName) {
      lines.push(`${pad}  const self = ${this.classDefaultFactoryName(declaration.baseName)}();`);
      lines.push(`${pad}  self.__idylliumType = ${JSON.stringify(declaration.name)};`);
    } else {
      lines.push(`${pad}  const self = { __idylliumType: ${JSON.stringify(declaration.name)} };`);
    }

    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        this.emitClassFieldDefaults(member, lines, indent + 1);
      }
    }

    for (const member of declaration.members) {
      if (member.kind === 'ClassMethodDeclaration' && !member.isStatic) {
        this.emitInstanceMethod(declaration.name, member, lines, indent + 1);
      }
    }

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
    lines.push(`${pad}  const self = ${this.classDefaultFactoryName(declaration.name)}();`);
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
      const value = this.castForType(rawValue, declaration.declaredType);
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
      ? ` ${returnType ? this.castForType(rawValue, returnType) : rawValue}`
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
      ? this.initializerExpression(statement.initializer, statement.declaredType)
      : statement.constructorArgs
        ? this.constructorInitializer(statement)
        : this.defaultValue(statement.declaredType);
    const value = this.castForType(rawValue, statement.declaredType);
    this.declareType(statement.name, statement.declaredType);
    return `let ${statement.name} = ${value}`;
  }

  private assignmentCode(statement: AssignmentStatement): string {
    const targetType = this.targetTypeName(statement.target);
    if (statement.operator === '=') {
      if (statement.target.kind === 'IndexExpression') {
        const value = this.castForType(this.expression(statement.value), targetType);
        return `$rt.array.set(${this.expression(statement.target.object)}, ${this.expression(statement.target.index)}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      }
      return `${this.expression(statement.target)} = ${this.castForType(this.expression(statement.value), targetType)}`;
    }

    if (statement.target.kind === 'IndexExpression') {
      const object = this.expression(statement.target.object);
      const index = this.expression(statement.target.index);
      const current = `$rt.array.get(${object}, ${index}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      const rawValue = this.compoundAssignmentValue(statement.operator, current, this.expression(statement.value), statement.range);
      const value = this.castForType(rawValue, targetType);
      return `$rt.array.set(${object}, ${index}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
    }

    const target = this.expression(statement.target);
    const value = this.expression(statement.value);
    const rawAssignedValue = this.compoundAssignmentValue(statement.operator, target, value, statement.range);
    return `${target} = ${this.castForType(rawAssignedValue, targetType)}`;
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
    return `(${target} ${binaryOperator} ${value})`;
  }

  private maybeAwait(expression: Expression): string {
    return this.expression(expression);
  }

  private expression(expression: Expression): string {
    switch (expression.kind) {
      case 'LiteralExpression':
        return JSON.stringify(expression.value);
      case 'IdentifierExpression':
        if (expression.name === 'this') return 'this';
        if (this.userClassNames.has(expression.name)) return this.classObjectName(expression.name);
        return expression.name;
      case 'UnaryExpression':
        return expression.operator === 'not'
          ? `(!${this.expression(expression.operand)})`
          : `(-${this.expression(expression.operand)})`;
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
    return `(${left} ${expression.operator} ${right})`;
  }

  private callExpression(expression: CallExpression): string {
    const callee = expression.callee;

    if (callee.kind === 'IdentifierExpression') {
      const args = expression.args.map((arg) => this.expression(arg)).join(', ');
      if (callee.name === 'max' || callee.name === 'min' || callee.name === 'sum' || callee.name === 'avg') {
        return `$rt.array.${callee.name}(${args}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (callee.name === 'div' || callee.name === 'mod' || callee.name === 'to_int' || callee.name === 'to_float') {
        return `$rt.core.${callee.name}(${args}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (callee.name === 'to_string') {
        return `$rt.core.to_string(${args})`;
      }
    }

    if (callee.kind === 'MemberExpression' && callee.object.kind === 'IdentifierExpression') {
      const args = expression.args.map((arg) => this.expression(arg)).join(', ');
      const moduleName = callee.object.name;
      if (this.importedModules.has(moduleName) && moduleName === 'console') {
        if (callee.name === 'get_int' || callee.name === 'get_float') {
          return `$rt.console.${callee.name}(${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
        }
        if (callee.name === 'set_precision') {
          return `$rt.console.set_precision(${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line}, ${args})`;
        }
        return `$rt.console.${callee.name}(${args})`;
      }
      if (this.importedModules.has(moduleName)) {
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

      const args = this.methodCallArgs(callee.name, expression.args, typeName).join(', ');
      return `$rt.callMethod(${this.expression(callee.object)}, ${JSON.stringify(callee.name)}, [${args}], ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
    }

    return `${this.expression(callee)}(${expression.args.map((arg) => this.expression(arg)).join(', ')})`;
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

  private initializerExpression(expression: Expression, declaredType: TypeName): string {
    if (expression.kind === 'ArrayLiteralExpression' && declaredType.kind === 'ArrayTypeName') {
      return this.arrayLiteralExpression(
        expression,
        declaredType.dynamic,
        declaredType.dynamic ? null : declaredType.size,
        `() => ${this.defaultValue(declaredType.elementType, false)}`,
        declaredType.elementType,
      );
    }
    return this.expression(expression);
  }

  private constructorInitializer(statement: VariableDeclaration): string {
    if (statement.declaredType.kind === 'QualifiedTypeName' && this.userModuleNames.has(statement.declaredType.moduleName)) {
      const args = (statement.constructorArgs ?? []).map((arg) => this.expression(arg)).join(', ');
      return `await $rt.modules.${statement.declaredType.moduleName}.${this.exportedClassCreateName(statement.declaredType.name)}(${args})`;
    }
    if (
      statement.declaredType.kind === 'QualifiedTypeName'
      && statement.declaredType.moduleName === 'json'
      && statement.declaredType.name === 'Value'
    ) {
      const args = (statement.constructorArgs ?? []).map((arg) => this.expression(arg)).join(', ');
      return `$rt.callModuleFunction("json", "Value", [${args}], ${JSON.stringify(statement.range.start.file)}, ${statement.range.start.line})`;
    }
    if (statement.declaredType.kind !== 'ClassTypeName') return this.defaultValue(statement.declaredType);
    const args = (statement.constructorArgs ?? []).map((arg) => this.expression(arg)).join(', ');
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

  private defaultValue(type: TypeName, allowAwait = true): string {
    const runtimeTypeName = this.typesRuntimeName(type);
    if (runtimeTypeName) return `$rt.types.cast(0, ${JSON.stringify(runtimeTypeName)})`;

    if (type.kind === 'ArrayTypeName') {
      const size = type.dynamic ? 0 : type.size ?? 0;
      return `$rt.array.create(${size}, () => ${this.defaultValue(type.elementType, false)}, ${type.dynamic ? 'true' : 'false'})`;
    }

    if (type.kind === 'ClassTypeName') {
      return allowAwait
        ? `await ${this.classCreateFactoryName(type.name)}()`
        : `${this.classDefaultFactoryName(type.name)}()`;
    }

    if (type.kind === 'QualifiedTypeName') {
      if (this.userModuleNames.has(type.moduleName)) {
        return allowAwait
          ? `await $rt.modules.${type.moduleName}.${this.exportedClassCreateName(type.name)}()`
          : `$rt.modules.${type.moduleName}.${this.exportedClassDefaultName(type.name)}()`;
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
      const value = this.castForType(parameter.name, parameter.paramType);
      if (value !== parameter.name) {
        lines.push(`${pad}${parameter.name} = ${value};`);
      }
    }
  }

  private methodCallArgs(methodName: string, args: readonly Expression[], receiverType: TypeName | null): string[] {
    if (receiverType?.kind !== 'ArrayTypeName') {
      return args.map((arg) => this.expression(arg));
    }

    if (methodName === 'add' || methodName === 'contains' || methodName === 'find' || methodName === 'count') {
      return args.map((arg, index) => (
        index === 0 ? this.castForType(this.expression(arg), receiverType.elementType) : this.expression(arg)
      ));
    }

    if (methodName === 'insert') {
      return args.map((arg, index) => (
        index === 1 ? this.castForType(this.expression(arg), receiverType.elementType) : this.expression(arg)
      ));
    }

    return args.map((arg) => this.expression(arg));
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
    if (objectType?.kind !== 'ClassTypeName') return null;
    return this.classFields.get(objectType.name)?.get(expression.name) ?? null;
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
  'float32',
  'float64',
]);
