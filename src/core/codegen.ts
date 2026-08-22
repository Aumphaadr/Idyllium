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
import { TypeRef, arrayType, qualified, typeToString } from './types';
import { ParameterSpec, createDefaultStandardLibrary } from './stdlib/registry';

export interface CodegenResult {
  readonly jsCode: string;
}

export interface JavaScriptGeneratorOptions {
  readonly userModuleNames?: ReadonlySet<string>;
  /**
   * Типы узлов AST, вычисленные семантическим анализатором, — единственный
   * источник выведенных типов для кодогена. Без карты генератор знает только
   * объявленные типы (аннотации в AST) и не выводит ничего сам.
   */
  readonly nodeTypes?: ReadonlyMap<Expression, TypeRef>;
  /** Классы с контрактом equals (короткие имена) — для статической диспетчеризации '==' и поиска в массивах. */
  readonly equalsContractClasses?: ReadonlySet<string>;
  /** «Пустые поля» по классам (короткое имя → поля с `= null`) — для охраняемых чтений. */
  readonly nullableClassFields?: ReadonlyMap<string, ReadonlySet<string>>;
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
  private functionParameters = new Map<string, readonly ParameterDeclaration[]>();
  private classMethodParameters = new Map<string, readonly ParameterDeclaration[]>();
  private classEventParameters = new Map<string, readonly ParameterDeclaration[]>();
  private classBaseNames = new Map<string, string | null>();
  private classConstructorParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleFunctionParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleClassMethodParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleClassConstructorParameters = new Map<string, readonly ParameterDeclaration[]>();
  private moduleClassNames = new Set<string>();
  private returnTypes: TypeName[] = [];
  private classFieldInitializerDepth = 0;
  /** Имя модуля, чьи объявления сейчас генерируются, — для квалифицированной метки классов. */
  private currentModuleName: string | null = null;
  private readonly userModuleNames: ReadonlySet<string>;
  private readonly nodeTypes: ReadonlyMap<Expression, TypeRef>;
  private readonly equalsContractClasses: ReadonlySet<string>;
  private readonly nullableClassFields: ReadonlyMap<string, ReadonlySet<string>>;
  private readonly stdlib = createDefaultStandardLibrary();

  constructor(options: JavaScriptGeneratorOptions = {}) {
    this.userModuleNames = options.userModuleNames ?? new Set();
    this.nodeTypes = options.nodeTypes ?? new Map();
    this.equalsContractClasses = options.equalsContractClasses ?? new Set();
    this.nullableClassFields = options.nullableClassFields ?? new Map();
  }

  /** Чтение «пустого поля» (room.guest, где guest объявлен с `= null`): описание или null. */
  private nullableFieldRead(expression: Expression): { objectJs: string; field: string; className: string } | null {
    if (expression.kind !== 'MemberExpression') return null;
    const bare = this.bareClassName(this.typeOf(expression.object));
    if (!bare || !this.nullableClassFields.get(bare)?.has(expression.name)) return null;
    return { objectJs: this.expression(expression.object), field: expression.name, className: bare };
  }

  /** Сырое чтение операнда: для сравнения с null и контрактного '==' охрана не ставится. */
  private rawOperand(expression: Expression): string {
    const nullable = this.nullableFieldRead(expression);
    return nullable ? `${nullable.objectJs}.${nullable.field}` : this.expression(expression);
  }

  /** Короткое имя класса из TypeRef: у импортированных модульных классов
   *  kind 'class' с точечным именем («hotel.Room») — слоты и карты живут
   *  по последнему сегменту. */
  private bareClassName(type: TypeRef | null): string | null {
    if (!type) return null;
    if (type.kind === 'class') {
      const dot = type.name.lastIndexOf('.');
      return dot >= 0 ? type.name.slice(dot + 1) : type.name;
    }
    if (type.kind === 'qualified' && !this.stdlib.hasModule(type.moduleName)) {
      return type.name;
    }
    return null;
  }

  /** Короткое имя пользовательского класса с контрактом equals; null для прочих типов. */
  private contractClassBareName(type: TypeRef | null): string | null {
    const bare = this.bareClassName(type);
    return bare !== null && this.equalsContractClasses.has(bare) ? bare : null;
  }

  /** Класс-лист массива с контрактом (сквозь вложенные массивы); null иначе. */
  private contractLeafOfArray(type: TypeRef | null): string | null {
    if (!type || type.kind !== 'array') return null;
    let element: TypeRef = type.elementType;
    while (element.kind === 'array') element = element.elementType;
    return this.contractClassBareName(element);
  }

  private typeOf(expression: Expression): TypeRef | null {
    return this.nodeTypes.get(expression) ?? null;
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

    this.currentModuleName = null;
    this.prepareProgramState(program);
    this.emitProgramDeclarations(program, lines, 1);

    if (program.main) {
      lines.push('  async function main() {');
      this.returnTypes.push(program.main.returnType);
      this.emitBlock(program.main.body, lines, 2);
      this.returnTypes.pop();
      lines.push('  }');
      // void-овая main ничего не возвращает — и генерируется как прежде.
      lines.push(this.isVoidType(program.main.returnType)
        ? '  await main();'
        : '  $rt.core.setExitValue(await main());');
    }

    lines.push('};');
    return { jsCode: lines.join('\n') };
  }

  private emitModule(module: ModuleProgram, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}$rt.modules.${module.name} = await (async function() {`);
    this.currentModuleName = module.name;
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
    this.functionParameters = new Map();
    this.classMethodParameters = new Map();
    this.classEventParameters = new Map();
    this.classBaseNames = new Map();
    this.classConstructorParameters = new Map();
    for (const declaration of program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        this.functionParameters.set(declaration.name, declaration.parameters);
      }
      if (declaration.kind !== 'ClassDeclaration') continue;
      this.classBaseNames.set(declaration.name, declaration.baseName ?? null);
      for (const member of declaration.members) {
        if (member.kind === 'ClassMethodDeclaration') {
          this.classMethodParameters.set(this.classMemberKey(declaration.name, member.name), member.parameters);
        }
        if (member.kind === 'ClassEventDeclaration') {
          this.classEventParameters.set(this.classMemberKey(declaration.name, member.name), member.parameters);
        }
        if (member.kind === 'ConstructorDeclaration') {
          this.classConstructorParameters.set(declaration.name, member.parameters);
        }
      }
    }
    this.returnTypes = [];
  }

  private prepareModuleSignatures(modules: readonly ModuleProgram[]): void {
    this.moduleFunctionParameters = new Map();
    this.moduleClassMethodParameters = new Map();
    this.moduleClassConstructorParameters = new Map();
    this.moduleClassNames = new Set();

    for (const module of modules) {
      for (const declaration of module.program.declarations) {
        if (declaration.kind === 'FunctionDeclaration') {
          this.moduleFunctionParameters.set(`${module.name}.${declaration.name}`, declaration.parameters);
          continue;
        }

        if (declaration.kind !== 'ClassDeclaration') continue;
        this.moduleClassNames.add(`${module.name}.${declaration.name}`);
        for (const member of declaration.members) {
          if (member.kind === 'ClassMethodDeclaration') {
            this.moduleClassMethodParameters.set(`${module.name}.${this.classMemberKey(declaration.name, member.name)}`, member.parameters);
          }
          if (member.kind === 'ConstructorDeclaration') {
            this.moduleClassConstructorParameters.set(`${module.name}.${declaration.name}`, member.parameters);
          }
        }
      }
    }
  }

  private emitProgramDeclarations(program: Program, lines: string[], indent: number): void {
    // Примитивные файловые константы объявляются РАНЬШЕ классов: инициализаторы
    // статиков исполняются при объявлении класса и читают эти константы
    // (сырой TDZ «Cannot access ... before initialization» — находка 2026-08-22).
    const isPrimitiveConst = (declaration: Program['declarations'][number]): boolean =>
      declaration.kind === 'VariableDeclaration'
      && declaration.isConst
      && declaration.declaredType.kind === 'PrimitiveTypeName';
    for (const declaration of program.declarations) {
      if (isPrimitiveConst(declaration)) {
        this.emitVariableDeclaration(declaration as VariableDeclaration, lines, indent);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        this.emitClassDeclaration(declaration, lines, indent);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'VariableDeclaration' && !isPrimitiveConst(declaration)) {
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
    for (const statement of block.statements) {
      this.emitStatement(statement, lines, indent);
    }
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
        lines.push(`${pad}${this.expression(statement.expression)};`);
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

  /**
   * Обёртка учёта глубины вокруг тела пользовательской функции.
   * Строка входа стоит ДО try: если предел превышен, кадр не состоялся и его
   * finally выполняться не должен — рантайм в этом случае правит счётчик сам.
   */
  private isVoidType(type: TypeName): boolean {
    return type.kind === 'PrimitiveTypeName' && type.name === 'void';
  }

  private emitCallGuardOpen(lines: string[], indent: number, name: string, range: SourceRange): void {
    const pad = '  '.repeat(indent);
    const file = JSON.stringify(range.start.file);
    lines.push(`${pad}const __idylYield = $rt.core.enterCall(${JSON.stringify(name)}, ${file}, ${range.start.line});`);
    lines.push(`${pad}if (__idylYield) await __idylYield;`);
    lines.push(`${pad}try {`);
  }

  private emitCallGuardClose(lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}} finally { $rt.core.leaveCall(); }`);
  }

  private emitFunctionDeclaration(declaration: FunctionDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}async function ${declaration.name}(${params}) {`);
    this.emitCallGuardOpen(lines, indent + 1, declaration.name, declaration.nameRange ?? declaration.range);
    this.returnTypes.push(declaration.returnType);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 2);
    this.emitParameterCasts(declaration.parameters, lines, indent + 2);
    this.emitBlock(declaration.body, lines, indent + 2);
    this.returnTypes.pop();
    this.emitCallGuardClose(lines, indent + 1);
    lines.push(`${pad}}`);
  }

  private emitClassDeclaration(declaration: ClassDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const classObjectName = this.classObjectName(declaration.name);

    lines.push(`${pad}const ${classObjectName} = {};`);
    lines.push(`${pad}async function ${this.classDefaultFactoryName(declaration.name)}() {`);
    // Метка класса — квалифицированная для модульных классов («zoo.Lion»):
    // её читают type_name() и тексты ошибок рантайма.
    const typeTag = this.currentModuleName ? `${this.currentModuleName}.${declaration.name}` : declaration.name;
    if (declaration.baseName) {
      lines.push(`${pad}  const self = await ${this.classDefaultFactoryName(declaration.baseName)}();`);
      lines.push(`${pad}  self.__idylliumType = ${JSON.stringify(typeTag)};`);
    } else {
      lines.push(`${pad}  const self = { __idylliumType: ${JSON.stringify(typeTag)} };`);
    }

    for (const member of declaration.members) {
      if (member.kind === 'ClassMethodDeclaration' && !member.isStatic) {
        this.emitInstanceMethod(declaration.name, member, lines, indent + 1);
      }
      if (member.kind === 'ClassEventDeclaration') {
        // Событие без подписчика — null: запуск тогда молча ничего не делает.
        lines.push(`${'  '.repeat(indent + 1)}self.${member.name} = null;`);
      }
    }

    this.classFieldInitializerDepth += 1;
    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration' && !member.isStatic) {
        this.emitClassFieldDefaults(member, lines, indent + 1);
      }
    }
    this.classFieldInitializerDepth -= 1;

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
    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration' && member.isStatic) {
        this.emitStaticFieldDefaults(declaration.name, member, lines, indent);
      }
    }
  }

  // Статическое поле (и класс-константа) — слот на объекте класса,
  // инициализатор выполняется один раз при объявлении класса.
  private emitStaticFieldDefaults(className: string, declaration: ClassFieldDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    for (const field of declaration.fields) {
      const rawValue = field.initializer
        ? this.expression(field.initializer)
        : this.defaultValue(declaration.declaredType);
      const value = field.initializer
        ? this.valueForType(rawValue, declaration.declaredType, field.initializer.range)
        : this.castForType(rawValue, declaration.declaredType);
      lines.push(`${pad}${this.classObjectName(className)}.${field.name} = ${value};`);
    }
  }

  private emitClassFieldDefaults(declaration: ClassFieldDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    for (const field of declaration.fields) {
      const rawValue = field.initializer
        ? this.expression(field.initializer)
        : this.defaultValue(declaration.declaredType);
      const value = field.initializer
        ? this.valueForType(rawValue, declaration.declaredType, field.initializer.range)
        : this.castForType(rawValue, declaration.declaredType);
      lines.push(`${pad}self.${field.name} = ${value};`);
    }
  }

  /** Контрактный equals хранится в слоте со своим классом (equals$Cat):
   *  контракты не наследуются, у семьи классов сосуществуют свои версии,
   *  а '==' диспетчеризуется статически — по типу, через который смотрят. */
  private isContractEqualsDeclaration(className: string, declaration: ClassMethodDeclaration): boolean {
    return declaration.name === 'equals'
      && !declaration.isStatic
      && declaration.parameters.length === 1
      && this.typeNameToString(declaration.parameters[0].paramType) === className;
  }

  private emitInstanceMethod(className: string, declaration: ClassMethodDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    if (this.isContractEqualsDeclaration(className, declaration)) {
      lines.push(`${pad}self[${JSON.stringify(`equals$${className}`)}] = async function(${params}) {`);
      this.emitCallGuardOpen(lines, indent + 1, `${className}.equals`, declaration.nameRange ?? declaration.range);
      this.returnTypes.push(declaration.returnType);
      this.emitParameterDefaults(declaration.parameters, lines, indent + 2);
      this.emitParameterCasts(declaration.parameters, lines, indent + 2);
      this.emitBlock(declaration.body, lines, indent + 2);
      this.returnTypes.pop();
      this.emitCallGuardClose(lines, indent + 1);
      lines.push(`${pad}};`);
      return;
    }
    lines.push(`${pad}self.${declaration.name} = async function(${params}) {`);
    this.emitCallGuardOpen(lines, indent + 1, `${className}.${declaration.name}`, declaration.nameRange ?? declaration.range);
    this.returnTypes.push(declaration.returnType);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 2);
    this.emitParameterCasts(declaration.parameters, lines, indent + 2);
    this.emitBlock(declaration.body, lines, indent + 2);
    this.returnTypes.pop();
    this.emitCallGuardClose(lines, indent + 1);
    lines.push(`${pad}};`);
  }

  private emitStaticMethod(className: string, declaration: ClassMethodDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}${this.classObjectName(className)}.${declaration.name} = async function(${params}) {`);
    this.emitCallGuardOpen(lines, indent + 1, `${className}.${declaration.name}`, declaration.nameRange ?? declaration.range);
    this.returnTypes.push(declaration.returnType);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 2);
    this.emitParameterCasts(declaration.parameters, lines, indent + 2);
    this.emitBlock(declaration.body, lines, indent + 2);
    this.returnTypes.pop();
    this.emitCallGuardClose(lines, indent + 1);
    lines.push(`${pad}};`);
  }

  private emitConstructorCall(className: string, declaration: ConstructorDeclaration, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const params = declaration.parameters.map((parameter) => parameter.name).join(', ');
    lines.push(`${pad}await (async function(${params}) {`);
    this.emitCallGuardOpen(lines, indent + 1, `${className}.constructor`, declaration.range);
    this.emitParameterDefaults(declaration.parameters, lines, indent + 2);
    this.emitParameterCasts(declaration.parameters, lines, indent + 2);
    this.emitBlock(declaration.body, lines, indent + 2);
    this.emitCallGuardClose(lines, indent + 1);
    lines.push(`${pad}}).apply(self, __args);`);
  }

  private emitAssignment(statement: AssignmentStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}${this.assignmentCode(statement)};`);
  }

  private emitWhileStatement(statement: WhileStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}while (${this.expression(statement.condition)}) {`);
    this.emitLoopTick(statement.range, lines, indent + 1);
    this.emitStatementBody(statement.body, lines, indent + 1);
    lines.push(`${pad}}`);
  }

  private emitDoWhileStatement(statement: DoWhileStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    lines.push(`${pad}do {`);
    this.emitLoopTick(statement.range, lines, indent + 1);
    this.emitStatementBody(statement.body, lines, indent + 1);
    lines.push(`${pad}} while (${this.expression(statement.condition)});`);
  }

  private emitForStatement(statement: ForStatement, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const initializer = statement.initializer ? this.forClauseCode(statement.initializer) : '';
    const condition = statement.condition ? this.expression(statement.condition) : '';
    const increment = statement.increment ? this.forClauseCode(statement.increment) : '';
    lines.push(`${pad}for (${initializer}; ${condition}; ${increment}) {`);
    this.emitLoopTick(statement.range, lines, indent + 1);
    this.emitStatementBody(statement.body, lines, indent + 1);
    lines.push(`${pad}}`);
  }

  // Кооперативная точка остановки в начале каждой итерации: без неё тугой цикл
  // нельзя прервать сигналом abort ни в WebIDE, ни в VS Code, ни по Ctrl+C.
  private emitLoopTick(range: { start: { file: string; line: number } }, lines: string[], indent: number): void {
    const pad = '  '.repeat(indent);
    const location = `${JSON.stringify(range.start.file)}, ${range.start.line}`;
    lines.push(`${pad}{ const __idyl_tick = $rt.core.tick(${location}); if (__idyl_tick !== null) await __idyl_tick; }`);
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
    return `${statement.isConst ? 'const' : 'let'} ${statement.name} = ${value}`;
  }

  private assignmentCode(statement: AssignmentStatement): string {
    const targetType = this.typeOf(statement.target);
    if (statement.operator === '=') {
      if (statement.target.kind === 'IndexExpression') {
        const value = this.valueForOptionalTypeRef(this.expression(statement.value), targetType, statement.value.range);
        return `$rt.array.set(${this.expression(statement.target.object)}, ${this.expression(statement.target.index)}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      }
      if (statement.target.kind === 'MemberExpression') {
        const value = this.valueForOptionalTypeRef(this.expression(statement.value), targetType, statement.value.range);
        return `$rt.setProperty(${this.expression(statement.target.object)}, ${JSON.stringify(statement.target.name)}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      }
      return `${this.expression(statement.target)} = ${this.valueForOptionalTypeRef(this.expression(statement.value), targetType, statement.value.range)}`;
    }

    if (statement.target.kind === 'IndexExpression') {
      const object = this.expression(statement.target.object);
      const index = this.expression(statement.target.index);
      const current = `$rt.array.get(${object}, ${index}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
      const rawValue = this.compoundAssignmentValue(statement.operator, current, this.expression(statement.value), statement.range);
      const value = this.valueForOptionalTypeRef(rawValue, targetType, statement.range);
      return `$rt.array.set(${object}, ${index}, ${value}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
    }

    const target = this.expression(statement.target);
    const value = this.expression(statement.value);
    const rawAssignedValue = this.compoundAssignmentValue(statement.operator, target, value, statement.range);
    if (statement.target.kind === 'MemberExpression') {
      const assignedValue = this.valueForOptionalTypeRef(rawAssignedValue, targetType, statement.range);
      return `$rt.setProperty(${this.expression(statement.target.object)}, ${JSON.stringify(statement.target.name)}, ${assignedValue}, ${JSON.stringify(statement.target.range.start.file)}, ${statement.target.range.start.line})`;
    }
    return `${target} = ${this.valueForOptionalTypeRef(rawAssignedValue, targetType, statement.range)}`;
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
        // 'this' всегда компилируется в лексический self фабрики/инициализатора
        // класса: метод остаётся привязанным к своему объекту, даже когда его
        // сохранили как значение (obj.method → колбэк) и вызвали отдельно.
        if (expression.name === 'this') return 'self';
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
    this.emitCallGuardOpen(lines, 1, 'function', expression.range);
    this.returnTypes.push(expression.returnType);
    this.emitParameterDefaults(expression.parameters, lines, 2);
    this.emitParameterCasts(expression.parameters, lines, 2);
    this.emitBlock(expression.body, lines, 2);
    this.returnTypes.pop();
    this.emitCallGuardClose(lines, 1);
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
    if (expression.operator === '==' || expression.operator === '!=') {
      // «Пустое поле» против null: проверка присутствия читает поле сыро
      // (охрана здесь была бы ложным срабатыванием на законной проверке).
      const leftIsNullLiteral = expression.left.kind === 'LiteralExpression' && expression.left.valueType === 'null';
      const rightIsNullLiteral = expression.right.kind === 'LiteralExpression' && expression.right.valueType === 'null';
      if ((leftIsNullLiteral && this.nullableFieldRead(expression.right))
        || (rightIsNullLiteral && this.nullableFieldRead(expression.left))) {
        const rawLeft = leftIsNullLiteral ? left : this.rawOperand(expression.left);
        const rawRight = rightIsNullLiteral ? right : this.rawOperand(expression.right);
        return `$rt.core.binary(${JSON.stringify(expression.operator)}, ${rawLeft}, ${rawRight}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      // Объекты с контрактом equals: '==' — awaited-вызов слота левого
      // СТАТИЧЕСКОГО типа; остальные сравнения остаются синхронными.
      // «Пустые поля» читаются сыро: null-ветку берёт на себя диспетчер.
      const leftType = this.typeOf(expression.left);
      const contractClass = this.contractClassBareName(leftType);
      if (contractClass && this.contractClassBareName(this.typeOf(expression.right))) {
        const call = `(await $rt.core.equalsObjects(${this.rawOperand(expression.left)}, ${this.rawOperand(expression.right)}, ${JSON.stringify(`equals$${contractClass}`)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line}))`;
        return expression.operator === '==' ? call : `(!${call})`;
      }
      const leftLeaf = this.contractLeafOfArray(leftType);
      if (leftLeaf && this.contractLeafOfArray(this.typeOf(expression.right))) {
        const call = `(await $rt.core.equalsObjectArrays(${left}, ${right}, ${JSON.stringify(`equals$${leftLeaf}`)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line}))`;
        return expression.operator === '==' ? call : `(!${call})`;
      }
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
      if (callee.name === 'type_name' && expression.args.length === 1) {
        // Гибрид: значения и массивы известны статически — строка-константа
        // в записи ошибок компилятора; объекты — рантайм-метка (актуальный
        // класс, даже если смотрят через базовое окно).
        const argNode = expression.args[0].value;
        const argType = this.typeOf(argNode);
        if (argType && argType.kind !== 'class' && argType.kind !== 'qualified' && argType.kind !== 'runtime-error') {
          return JSON.stringify(typeToString(argType));
        }
        // «Пустое поле» читается сыро: type_name(пустота) — «null», не ошибка.
        return `$rt.core.typeName(${this.rawOperand(argNode)})`;
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
      const receiverType = this.typeOf(callee.object);
      if (receiverType?.kind === 'class') {
        const eventParameters = this.lookupClassEventParameters(receiverType.name, callee.name);
        if (eventParameters) {
          // Семантика уже гарантировала запуск только изнутри класса через this.
          const ordered = this.orderedCallArguments(expression.args, eventParameters.map((parameter) => parameter.name));
          const args = ordered.map((arg) => (arg ? this.expression(arg.value) : 'undefined')).join(', ');
          const target = this.expression(callee.object);
          return `(${target}.${callee.name} ? ${target}.${callee.name}(${args}) : undefined)`;
        }
      }
      const typesRuntimeName = this.typesRuntimeNameOf(receiverType);
      if (typesRuntimeName && (callee.name === 'to_bin' || callee.name === 'to_hex')) {
        return `$rt.types.${callee.name}(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)})`;
      }
      if (typesRuntimeName && (callee.name === 'shift_left' || callee.name === 'shift_right')) {
        const [bits] = this.methodCallArgs(callee.name, expression.args, receiverType);
        return `$rt.types.${callee.name}(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)}, ${bits}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (typesRuntimeName && (callee.name === 'bit_and' || callee.name === 'bit_or' || callee.name === 'bit_xor')) {
        const [mask] = this.methodCallArgs(callee.name, expression.args, receiverType);
        return `$rt.types.${callee.name}(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)}, ${mask}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }
      if (typesRuntimeName && callee.name === 'bit_not') {
        return `$rt.types.bit_not(${this.expression(callee.object)}, ${JSON.stringify(typesRuntimeName)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
      }

      // Поиск в массивах объектов идёт через контракт equals элемента —
      // длина фиксируется на входе, сравнение зовёт слот статического типа.
      if (receiverType?.kind === 'array' && ['contains', 'find', 'count'].includes(callee.name)) {
        const leaf = this.contractLeafOfArray(receiverType);
        if (leaf) {
          const args = this.methodCallArgs(callee.name, expression.args, receiverType).join(', ');
          return `$rt.array.searchWith(${this.expression(callee.object)}, ${args}, ${JSON.stringify(`equals$${leaf}`)}, ${JSON.stringify(callee.name)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
        }
      }

      // Контракт equals: статическая диспетчеризация по типу получателя.
      if (callee.name === 'equals' && expression.args.length === 1) {
        const contractClass = this.contractClassBareName(receiverType);
        if (contractClass) {
          const args = this.methodCallArgs(callee.name, expression.args, receiverType).join(', ');
          return `$rt.callMethod(${this.expression(callee.object)}, ${JSON.stringify(`equals$${contractClass}`)}, [${args}], ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
        }
      }

      const args = this.methodCallArgs(callee.name, expression.args, receiverType).join(', ');
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
    // Чтение «пустого поля» охраняется: пустота не выходит в мир молча.
    const nullable = this.nullableFieldRead(expression);
    if (nullable) {
      return `$rt.core.expectPresent(${nullable.objectJs}.${nullable.field}, ${JSON.stringify(nullable.field)}, ${JSON.stringify(nullable.className)}, ${JSON.stringify(expression.range.start.file)}, ${expression.range.start.line})`;
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

  private defaultValue(type: TypeName): string {
    const runtimeTypeName = this.typesRuntimeName(type);
    if (runtimeTypeName) return `$rt.types.cast(0, ${JSON.stringify(runtimeTypeName)})`;

    if (type.kind === 'ArrayTypeName') {
      const size = type.dynamic ? 0 : type.size ?? 0;
      return `await $rt.array.createAsync(${size}, async () => ${this.defaultValue(type.elementType)}, ${type.dynamic ? 'true' : 'false'})`;
    }

    if (type.kind === 'ClassTypeName') {
      // Объявление без аргументов НИКОГДА не зовёт конструктор — поля
      // получают дефолтные значения. Конструктор вызывается только явно:
      // Hero v = Hero(...) или Hero v(...). Единое правило для одиночных
      // переменных, элементов массивов и полей-композиций (решение
      // владельца, 2026-08-14).
      return `await ${this.classDefaultFactoryName(type.name)}()`;
    }

    if (type.kind === 'QualifiedTypeName') {
      if (this.userModuleNames.has(type.moduleName)) {
        return `await $rt.modules.${type.moduleName}.${this.exportedClassDefaultName(type.name)}()`;
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

  private lookupClassEventParameters(className: string, eventName: string): readonly ParameterDeclaration[] | undefined {
    let current: string | null | undefined = className;
    while (current) {
      const parameters = this.classEventParameters.get(this.classMemberKey(current, eventName));
      if (parameters) return parameters;
      current = this.classBaseNames.get(current) ?? null;
    }
    return undefined;
  }

  private methodParameterNames(methodName: string, receiverType: TypeRef | null): readonly string[] | undefined {
    if (!receiverType) return undefined;
    if (receiverType.kind === 'class') {
      return this.classMethodParameters.get(this.classMemberKey(receiverType.name, methodName))?.map((parameter) => parameter.name);
    }
    if (receiverType.kind === 'qualified' && this.userModuleNames.has(receiverType.moduleName)) {
      return this.moduleClassMethodParameters.get(`${receiverType.moduleName}.${this.classMemberKey(receiverType.name, methodName)}`)?.map((parameter) => parameter.name);
    }
    if (receiverType.kind === 'array') {
      return this.arrayMethodParameterNames(methodName);
    }

    return this.stdlib.getTypeMethod(receiverType, methodName)?.parameters.map((parameter) => parameter.name)
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

  private stringMethodParameterNames(receiverType: TypeRef, methodName: string): readonly string[] | undefined {
    if (receiverType.kind !== 'primitive' || receiverType.name !== 'string') return undefined;
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

  private typesRuntimeNameOf(type: TypeRef | null): string | null {
    if (type?.kind !== 'qualified') return null;
    if (type.moduleName !== 'types') return null;
    return TYPE_RUNTIME_NAMES.has(type.name) ? type.name : null;
  }

  private valueForOptionalTypeRef(value: string, type: TypeRef | null, range: SourceRange): string {
    return type ? this.valueForTypeRef(value, type, range) : value;
  }

  private methodCallArgs(methodName: string, args: readonly CallArgument[], receiverType: TypeRef | null): string[] {
    const orderedArgs = this.orderedCallArguments(args, this.methodParameterNames(methodName, receiverType));
    if (receiverType?.kind !== 'array') {
      const method = receiverType ? this.stdlib.getTypeMethod(receiverType, methodName) : undefined;
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
          ? this.valueForTypeRef(this.expression(arg.value), receiverType.elementType, arg.value.range)
          : arg ? this.expression(arg.value) : 'undefined'
      ));
    }

    if (methodName === 'insert') {
      return orderedArgs.map((arg, index) => (
        index === 1 && arg
          ? this.valueForTypeRef(this.expression(arg.value), receiverType.elementType, arg.value.range)
          : arg ? this.expression(arg.value) : 'undefined'
      ));
    }

    if (methodName === 'join') {
      return orderedArgs.map((arg, index) => {
        if (!arg) return 'undefined';
        if (index !== 0) return this.expression(arg.value);
        return this.valueForTypeRef(this.expression(arg.value), arrayType(receiverType.elementType, null, true), arg.value.range);
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
        `, async () => ${this.defaultValue(type.elementType)}`,
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
      if (this.userModuleNames.has(type.moduleName)) {
        return `await $rt.modules.${type.moduleName}.${this.exportedClassDefaultName(type.name)}()`;
      }
      if (type.moduleName === 'colors' && type.name === 'Color') return '$rt.modules.colors.TRANSPARENT';
      return `$rt.createObject(${JSON.stringify(type.moduleName)}, ${JSON.stringify(type.name)})`;
    }
    if (type.kind === 'class') {
      return `await ${this.classDefaultFactoryName(type.name)}()`;
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
