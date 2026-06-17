import {
  AccessModifier,
  AssignmentStatement,
  BinaryExpression,
  BreakStatement,
  CallExpression,
  ClassDeclaration,
  ClassFieldDeclaration,
  ClassMethodDeclaration,
  ContinueStatement,
  ConstructorDeclaration,
  DoWhileStatement,
  Expression,
  ForClauseStatement,
  ForStatement,
  FunctionExpression,
  FunctionDeclaration,
  IfStatement,
  IndexExpression,
  MemberExpression,
  Program,
  ReturnStatement,
  Statement,
  TypeName,
  VariableDeclaration,
  WhileStatement,
} from './ast';
import { DiagnosticBag, SourceRange } from './diagnostics';
import { UserModuleRegistry } from './modules';
import { FunctionSpec, PropertySpec, StandardLibraryRegistry, createDefaultStandardLibrary } from './stdlib/registry';
import {
  ANY_TYPE,
  BOOL,
  CHAR,
  ERROR_TYPE,
  FLOAT,
  INT,
  STRING,
  TypeRef,
  VOID,
  arrayType,
  classType,
  functionType,
  isAssignable,
  isIntegerLike,
  isNumeric,
  numericBinaryResult,
  primitive,
  qualified,
  sameType,
  typeToString,
} from './types';

export interface SemanticResult {
  readonly success: boolean;
  readonly diagnostics: DiagnosticBag;
}

interface SymbolInfo {
  readonly type: TypeRef;
  readonly range: SourceRange;
  readonly kind: 'variable' | 'parameter' | 'function';
}

interface AssignmentTargetInfo {
  readonly type: TypeRef;
  readonly property?: PropertySpec;
}

interface UserPropertySpec {
  readonly name: string;
  readonly type: TypeRef;
  readonly range: SourceRange;
  readonly owner: string;
  readonly access: AccessModifier;
}

interface UserMethodAccess {
  readonly name: string;
  readonly owner: string;
  readonly access: AccessModifier;
  readonly isStatic: boolean;
  readonly range: SourceRange;
}

interface UserClassInfo {
  readonly declaration: ClassDeclaration;
  readonly fields: Map<string, UserPropertySpec>;
  readonly methods: Map<string, FunctionSpec>;
  readonly methodDeclarations: Map<string, ClassMethodDeclaration>;
  readonly methodAccess: Map<string, UserMethodAccess>;
  readonly ownFields: Set<string>;
  readonly ownMethods: Set<string>;
  constructorSpec: FunctionSpec | null;
  constructorDeclaration: ConstructorDeclaration | null;
  membersRegistered: boolean;
  membersRegistering: boolean;
}

interface ClassContext {
  readonly className: string;
  readonly isStatic: boolean;
}

export class SemanticAnalyzer {
  private readonly diagnostics = new DiagnosticBag();
  private readonly imports = new Set<string>();
  private readonly userModules = new Set<string>();
  private readonly scopes: Array<Map<string, SymbolInfo>> = [new Map()];
  private readonly functions = new Map<string, FunctionDeclaration>();
  private readonly classes = new Map<string, UserClassInfo>();
  private readonly returnTypes: TypeRef[] = [];
  private readonly classContexts: ClassContext[] = [];
  private loopDepth = 0;

  constructor(
    private readonly stdlib: StandardLibraryRegistry = createDefaultStandardLibrary(),
    private readonly userModuleRegistry: UserModuleRegistry = new UserModuleRegistry(),
  ) {}

  analyze(program: Program): SemanticResult {
    for (const importDecl of program.imports) {
      this.imports.add(importDecl.moduleName);
      if (!this.stdlib.hasModule(importDecl.moduleName)) {
        if (this.userModuleRegistry.hasModule(importDecl.moduleName)) {
          this.registerImportedModuleClasses(importDecl.moduleName);
        } else {
          this.userModules.add(importDecl.moduleName);
        }
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        this.registerClass(declaration);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        this.registerClassMembers(declaration);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        this.registerFunction(declaration);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        this.analyzeClassDeclaration(declaration);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'VariableDeclaration') {
        this.analyzeVariableDeclaration(declaration, 'variable');
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        this.analyzeFunctionDeclaration(declaration);
      }
    }

    if (program.main) {
      this.returnTypes.push(VOID);
      this.analyzeStatement(program.main.body);
      this.returnTypes.pop();
    }

    return {
      success: !this.diagnostics.hasErrors(),
      diagnostics: this.diagnostics,
    };
  }

  private registerImportedModuleClasses(moduleName: string): void {
    const module = this.userModuleRegistry.getModule(moduleName);
    if (!module) return;

    for (const classSpec of module.classes.values()) {
      if (this.classes.has(classSpec.qualifiedName)) continue;

      const fields = new Map<string, UserPropertySpec>();
      const methods = new Map<string, FunctionSpec>();
      const methodAccess = new Map<string, UserMethodAccess>();

      for (const field of classSpec.fields) {
        fields.set(field.name, {
          name: field.name,
          type: field.type,
          range: field.range,
          owner: field.owner,
          access: field.access,
        });
      }

      for (const method of classSpec.methods) {
        methods.set(method.name, method.spec);
        methodAccess.set(method.name, {
          name: method.name,
          owner: method.owner,
          access: method.access,
          isStatic: method.isStatic,
          range: method.range,
        });
      }

      this.classes.set(classSpec.qualifiedName, {
        declaration: {
          kind: 'ClassDeclaration',
          name: classSpec.qualifiedName,
          baseName: classSpec.baseName,
          members: [],
          range: classSpec.range,
        },
        fields,
        methods,
        methodDeclarations: new Map(),
        methodAccess,
        ownFields: new Set(fields.keys()),
        ownMethods: new Set(methods.keys()),
        constructorSpec: classSpec.constructorSpec,
        constructorDeclaration: null,
        membersRegistered: true,
        membersRegistering: false,
      });
    }
  }

  private registerFunction(declaration: FunctionDeclaration): void {
    if (this.functions.has(declaration.name)) {
      this.diagnostics.error(declaration.range, `function '${declaration.name}' is already declared`);
      return;
    }

    this.functions.set(declaration.name, declaration);
    const parameters = declaration.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));
    const returnType = this.resolveTypeName(declaration.returnType);
    this.declare(declaration.name, functionType(parameters, returnType), 'function', declaration.range);
  }

  private analyzeFunctionDeclaration(declaration: FunctionDeclaration): void {
    const returnType = this.resolveTypeName(declaration.returnType);
    this.returnTypes.push(returnType);
    this.pushScope();

    for (const parameter of declaration.parameters) {
      const parameterType = this.resolveTypeName(parameter.paramType);
      this.declare(parameter.name, parameterType, 'parameter', parameter.range);
    }

    this.analyzeStatement(declaration.body);
    this.reportMissingReturn(returnType, declaration.body, declaration.range);
    this.popScope();
    this.returnTypes.pop();
  }

  private registerClass(declaration: ClassDeclaration): void {
    if (this.classes.has(declaration.name)) {
      this.diagnostics.error(declaration.range, `class '${declaration.name}' is already declared`);
      return;
    }

    if (this.stdlib.hasModule(declaration.name)) {
      this.diagnostics.error(declaration.range, `class '${declaration.name}' conflicts with a standard library module`);
      return;
    }

    this.classes.set(declaration.name, {
      declaration,
      fields: new Map(),
      methods: new Map(),
      methodDeclarations: new Map(),
      methodAccess: new Map(),
      ownFields: new Set(),
      ownMethods: new Set(),
      constructorSpec: null,
      constructorDeclaration: null,
      membersRegistered: false,
      membersRegistering: false,
    });
  }

  private registerClassMembers(declaration: ClassDeclaration): void {
    const info = this.classes.get(declaration.name);
    if (!info) return;
    if (info.membersRegistered) return;
    if (info.membersRegistering) {
      this.diagnostics.error(declaration.range, `class inheritance cycle involving '${declaration.name}'`);
      return;
    }

    info.membersRegistering = true;
    if (declaration.baseName) {
      const baseInfo = this.classes.get(declaration.baseName);
      if (!baseInfo) {
        this.diagnostics.error(declaration.range, `unknown base class '${declaration.baseName}'`);
      } else {
        this.registerClassMembers(baseInfo.declaration);
        this.inheritClassMembers(info, baseInfo);
      }
    }

    for (const member of declaration.members) {
      switch (member.kind) {
        case 'ClassFieldDeclaration':
          this.registerClassFields(info, member);
          break;
        case 'ClassMethodDeclaration':
          this.registerClassMethod(info, member);
          break;
        case 'ConstructorDeclaration':
          this.registerClassConstructor(info, member);
          break;
      }
    }
    info.membersRegistering = false;
    info.membersRegistered = true;
  }

  private inheritClassMembers(info: UserClassInfo, baseInfo: UserClassInfo): void {
    for (const [name, field] of baseInfo.fields) {
      info.fields.set(name, field);
    }
    for (const [name, method] of baseInfo.methods) {
      info.methods.set(name, method);
      const declaration = baseInfo.methodDeclarations.get(name);
      if (declaration) info.methodDeclarations.set(name, declaration);
      const access = baseInfo.methodAccess.get(name);
      if (access) info.methodAccess.set(name, access);
    }
  }

  private methodSignatureCanOverride(baseMethod: FunctionSpec, declaration: ClassMethodDeclaration): boolean {
    const parameters = declaration.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));
    const returnType = this.resolveTypeName(declaration.returnType);
    if (parameters.length !== baseMethod.parameters.length) return false;
    if (!sameType(returnType, baseMethod.returnType)) return false;
    return parameters.every((type, index) => sameType(type, baseMethod.parameters[index].type));
  }

  private registerClassFields(info: UserClassInfo, declaration: ClassFieldDeclaration): void {
    const fieldType = this.resolveTypeName(declaration.declaredType);
    if (sameType(fieldType, VOID)) {
      this.diagnostics.error(declaration.range, "class field type cannot be 'void'");
    }

    for (const field of declaration.fields) {
      if (info.fields.has(field.name) || info.methods.has(field.name)) {
        this.diagnostics.error(field.range, `class '${info.declaration.name}' already has member '${field.name}'`);
        continue;
      }
      info.fields.set(field.name, {
        name: field.name,
        type: fieldType,
        range: field.range,
        owner: info.declaration.name,
        access: declaration.access,
      });
      info.ownFields.add(field.name);
    }
  }

  private registerClassMethod(info: UserClassInfo, declaration: ClassMethodDeclaration): void {
    const inheritedField = info.fields.get(declaration.name);
    if (inheritedField && inheritedField.owner !== info.declaration.name) {
      this.diagnostics.error(declaration.range, `method '${declaration.name}' conflicts with inherited field '${inheritedField.owner}.${declaration.name}'`);
      return;
    }

    const inheritedMethod = info.methods.get(declaration.name);
    if (inheritedMethod && !this.methodSignatureCanOverride(inheritedMethod, declaration)) {
      this.diagnostics.error(declaration.range, `method '${info.declaration.name}.${declaration.name}' must match inherited method signature`);
      return;
    }

    if ((info.fields.has(declaration.name) && info.ownFields.has(declaration.name)) || (info.methods.has(declaration.name) && info.ownMethods.has(declaration.name))) {
      this.diagnostics.error(declaration.range, `class '${info.declaration.name}' already has member '${declaration.name}'`);
      return;
    }

    const parameters = declaration.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));
    const returnType = this.resolveTypeName(declaration.returnType);
    info.methods.set(declaration.name, {
      name: declaration.name,
      parameters: parameters.map((type, index) => ({ name: declaration.parameters[index].name, type })),
      returnType,
    });
    info.methodDeclarations.set(declaration.name, declaration);
    info.methodAccess.set(declaration.name, {
      name: declaration.name,
      owner: info.declaration.name,
      access: declaration.access,
      isStatic: declaration.isStatic,
      range: declaration.range,
    });
    info.ownMethods.add(declaration.name);
  }

  private registerClassConstructor(info: UserClassInfo, declaration: ConstructorDeclaration): void {
    if (declaration.name !== info.declaration.name) {
      this.diagnostics.error(declaration.range, `constructor name '${declaration.name}' must match class '${info.declaration.name}'`);
    }

    if (info.constructorSpec) {
      this.diagnostics.error(declaration.range, `class '${info.declaration.name}' already has a constructor`);
      return;
    }

    const parameters = declaration.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));
    info.constructorSpec = {
      name: declaration.name,
      parameters: parameters.map((type, index) => ({ name: declaration.parameters[index].name, type })),
      returnType: VOID,
    };
    info.constructorDeclaration = declaration;
  }

  private analyzeClassDeclaration(declaration: ClassDeclaration): void {
    const info = this.classes.get(declaration.name);
    if (!info) return;

    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        this.analyzeClassFieldInitializers(info, member);
      }
      if (member.kind === 'ClassMethodDeclaration') {
        this.analyzeClassMethod(info, member);
      }
      if (member.kind === 'ConstructorDeclaration') {
        this.analyzeClassConstructor(info, member);
      }
    }
  }

  private analyzeClassFieldInitializers(info: UserClassInfo, declaration: ClassFieldDeclaration): void {
    const fieldType = this.resolveTypeName(declaration.declaredType);
    for (const field of declaration.fields) {
      if (!field.initializer) continue;
      this.pushClassContext(info.declaration.name, false);
      this.pushScope();
      this.declare('this', classType(info.declaration.name), 'parameter', info.declaration.range);
      const initializerType = this.expressionType(field.initializer);
      if (!this.canAssign(fieldType, initializerType)) {
        this.diagnostics.error(
          field.initializer.range,
          `cannot assign '${typeToString(initializerType)}' value to '${typeToString(fieldType)}' field`,
        );
      }
      this.popScope();
      this.popClassContext();
    }
  }

  private analyzeClassMethod(info: UserClassInfo, declaration: ClassMethodDeclaration): void {
    const returnType = this.resolveTypeName(declaration.returnType);
    this.returnTypes.push(returnType);
    this.pushClassContext(info.declaration.name, declaration.isStatic);
    this.pushScope();

    if (!declaration.isStatic) {
      this.declare('this', classType(info.declaration.name), 'parameter', declaration.range);
    }

    for (const parameter of declaration.parameters) {
      const parameterType = this.resolveTypeName(parameter.paramType);
      this.declare(parameter.name, parameterType, 'parameter', parameter.range);
    }

    this.analyzeStatement(declaration.body);
    this.reportMissingReturn(returnType, declaration.body, declaration.range);
    this.popScope();
    this.popClassContext();
    this.returnTypes.pop();
  }

  private analyzeClassConstructor(info: UserClassInfo, declaration: ConstructorDeclaration): void {
    this.returnTypes.push(VOID);
    this.pushClassContext(info.declaration.name, false);
    this.pushScope();
    this.declare('this', classType(info.declaration.name), 'parameter', declaration.range);

    if (info.declaration.baseName) {
      const baseInfo = this.classes.get(info.declaration.baseName);
      const baseConstructor = baseInfo?.constructorSpec ?? {
        name: 'parent',
        parameters: [],
        returnType: VOID,
      };
      this.declare(
        'parent',
        functionType(baseConstructor.parameters.map((parameter) => parameter.type), VOID),
        'function',
        declaration.range,
      );
    }

    for (const parameter of declaration.parameters) {
      const parameterType = this.resolveTypeName(parameter.paramType);
      this.declare(parameter.name, parameterType, 'parameter', parameter.range);
    }

    this.analyzeStatement(declaration.body);
    this.popScope();
    this.popClassContext();
    this.returnTypes.pop();
  }

  private analyzeStatement(statement: Statement): void {
    switch (statement.kind) {
      case 'BlockStatement':
        this.pushScope();
        for (const child of statement.statements) {
          this.analyzeStatement(child);
        }
        this.popScope();
        return;
      case 'IfStatement':
        this.analyzeIfStatement(statement);
        return;
      case 'WhileStatement':
        this.analyzeWhileStatement(statement);
        return;
      case 'DoWhileStatement':
        this.analyzeDoWhileStatement(statement);
        return;
      case 'ForStatement':
        this.analyzeForStatement(statement);
        return;
      case 'BreakStatement':
        this.analyzeBreakStatement(statement);
        return;
      case 'ContinueStatement':
        this.analyzeContinueStatement(statement);
        return;
      case 'ReturnStatement':
        this.analyzeReturnStatement(statement);
        return;
      case 'VariableDeclaration':
        this.analyzeVariableDeclaration(statement, 'variable');
        return;
      case 'AssignmentStatement':
        this.analyzeAssignment(statement);
        return;
      case 'ExpressionStatement':
        this.expressionType(statement.expression);
        return;
    }
  }

  private analyzeIfStatement(statement: IfStatement): void {
    this.expectBoolCondition(statement.condition, 'if condition');
    this.analyzeStatement(statement.thenBranch);
    if (statement.elseBranch) {
      this.analyzeStatement(statement.elseBranch);
    }
  }

  private analyzeWhileStatement(statement: WhileStatement): void {
    this.expectBoolCondition(statement.condition, 'while condition');
    this.loopDepth++;
    this.analyzeStatement(statement.body);
    this.loopDepth--;
  }

  private analyzeDoWhileStatement(statement: DoWhileStatement): void {
    this.loopDepth++;
    this.analyzeStatement(statement.body);
    this.loopDepth--;
    this.expectBoolCondition(statement.condition, 'do-while condition');
  }

  private analyzeForStatement(statement: ForStatement): void {
    this.pushScope();
    if (statement.initializer) {
      this.analyzeForClause(statement.initializer);
    }
    if (statement.condition) {
      this.expectBoolCondition(statement.condition, 'for condition');
    }
    this.loopDepth++;
    this.analyzeStatement(statement.body);
    this.loopDepth--;
    if (statement.increment) {
      this.analyzeForClause(statement.increment);
    }
    this.popScope();
  }

  private analyzeForClause(statement: ForClauseStatement): void {
    switch (statement.kind) {
      case 'VariableDeclaration':
        this.analyzeVariableDeclaration(statement, 'variable');
        return;
      case 'AssignmentStatement':
        this.analyzeAssignment(statement);
        return;
      case 'ExpressionStatement':
        this.expressionType(statement.expression);
        return;
    }
  }

  private analyzeBreakStatement(statement: BreakStatement): void {
    if (this.loopDepth === 0) {
      this.diagnostics.error(statement.range, "'break' is only valid inside a loop");
    }
  }

  private analyzeContinueStatement(statement: ContinueStatement): void {
    if (this.loopDepth === 0) {
      this.diagnostics.error(statement.range, "'continue' is only valid inside a loop");
    }
  }

  private analyzeReturnStatement(statement: ReturnStatement): void {
    const expected = this.returnTypes[this.returnTypes.length - 1] ?? VOID;

    if (!statement.value) {
      if (!sameType(expected, VOID)) {
        this.diagnostics.error(statement.range, `return value of type '${typeToString(expected)}' is required`);
      }
      return;
    }

    const valueType = this.expressionType(statement.value);
    if (sameType(expected, VOID)) {
      this.diagnostics.error(statement.value.range, "void function cannot return a value");
      return;
    }

    if (!this.canAssign(expected, valueType)) {
      this.diagnostics.error(
        statement.value.range,
        `cannot return '${typeToString(valueType)}' value from '${typeToString(expected)}' function`,
      );
    }
  }

  private expectBoolCondition(expression: Expression, context: string): void {
    const conditionType = this.expressionType(expression);
    if (!sameType(conditionType, BOOL)) {
      this.diagnostics.error(
        expression.range,
        `${context} must be 'bool', got '${typeToString(conditionType)}'`,
      );
    }
  }

  private analyzeVariableDeclaration(
    statement: VariableDeclaration,
    kind: SymbolInfo['kind'],
  ): void {
    const declaredType = this.resolveTypeName(statement.declaredType);
    if (declaredType.kind === 'primitive' && declaredType.name === 'void') {
      this.diagnostics.error(statement.range, "cannot declare variable of type 'void'");
      return;
    }

    if (statement.initializer) {
      const initializerType = this.expressionType(statement.initializer);
      if (
        declaredType.kind === 'array'
        && initializerType.kind === 'array'
        && !declaredType.dynamic
        && !initializerType.dynamic
        && declaredType.size !== initializerType.size
      ) {
        this.diagnostics.error(
          statement.initializer.range,
          `array initializer has ${initializerType.size ?? 0} elements, but '${typeToString(declaredType)}' requires ${declaredType.size ?? 0}`,
        );
      }
      if (!this.canAssign(declaredType, initializerType)) {
        this.diagnostics.error(
          statement.initializer.range,
          `cannot assign '${typeToString(initializerType)}' value to '${typeToString(declaredType)}' variable`,
        );
      }
    }

    if (statement.constructorArgs) {
      this.analyzeConstructorArguments(statement, declaredType);
    }

    this.declare(statement.name, declaredType, kind, statement.range);
  }

  private analyzeConstructorArguments(statement: VariableDeclaration, declaredType: TypeRef): void {
    if (declaredType.kind === 'qualified' && declaredType.moduleName === 'json' && declaredType.name === 'Value') {
      const constructor = this.stdlib.getModuleFunction('json', 'Value');
      if (constructor) this.checkArgumentList(statement.constructorArgs ?? [], constructor, statement.range);
      return;
    }

    if (declaredType.kind !== 'class') {
      this.diagnostics.error(statement.range, `constructor-style declaration requires a class type, got '${typeToString(declaredType)}'`);
      for (const arg of statement.constructorArgs ?? []) this.expressionType(arg);
      return;
    }

    const info = this.classes.get(declaredType.name);
    if (!info) return;

    const constructor = info.constructorSpec;
    if (!constructor) {
      this.diagnostics.error(statement.range, `class '${declaredType.name}' has no constructor`);
      for (const arg of statement.constructorArgs ?? []) this.expressionType(arg);
      return;
    }

    if (
      info.constructorDeclaration?.access === 'private'
      && this.currentClassName() !== declaredType.name
    ) {
      this.diagnostics.error(
        statement.range,
        `constructor '${declaredType.name}' is private and can only be used inside class '${declaredType.name}'`,
      );
    }

    this.checkArgumentList(statement.constructorArgs ?? [], constructor, statement.range);
  }

  private resolveTypeName(typeName: TypeName): TypeRef {
    if (typeName.kind === 'PrimitiveTypeName') {
      return primitive(typeName.name);
    }

    if (typeName.kind === 'ArrayTypeName') {
      const elementType = this.resolveTypeName(typeName.elementType);
      if (sameType(elementType, VOID)) {
        this.diagnostics.error(typeName.elementType.range, "array element type cannot be 'void'");
      }
      if (!typeName.dynamic && (typeName.size === null || typeName.size < 0)) {
        this.diagnostics.error(typeName.range, 'array size must be a non-negative integer');
      }
      return arrayType(elementType, typeName.size, typeName.dynamic);
    }

    if (typeName.kind === 'ClassTypeName') {
      if (!this.classes.has(typeName.name)) {
        this.diagnostics.error(typeName.range, `unknown class '${typeName.name}'`);
        return ERROR_TYPE;
      }
      return classType(typeName.name);
    }

    if (!this.imports.has(typeName.moduleName)) {
      this.diagnostics.error(typeName.range, `'${typeName.moduleName}' is not imported (use 'use ${typeName.moduleName};')`);
      return ERROR_TYPE;
    }

    if (!this.stdlib.hasModule(typeName.moduleName)) {
      const module = this.userModuleRegistry.getModule(typeName.moduleName);
      if (!module) {
        if (this.userModules.has(typeName.moduleName)) return ANY_TYPE;
        this.diagnostics.error(typeName.range, `unknown type '${typeName.moduleName}.${typeName.name}'`);
        return ERROR_TYPE;
      }

      const classSpec = module.classes.get(typeName.name);
      if (!classSpec) {
        this.diagnostics.error(typeName.range, `module '${typeName.moduleName}' has no type '${typeName.name}'`);
        return ERROR_TYPE;
      }

      return classType(classSpec.qualifiedName);
    }

    if (!this.stdlib.hasQualifiedType(typeName.moduleName, typeName.name)) {
      this.diagnostics.error(typeName.range, `unknown type '${typeName.moduleName}.${typeName.name}'`);
      return ERROR_TYPE;
    }

    return qualified(typeName.moduleName, typeName.name);
  }

  private analyzeAssignment(statement: AssignmentStatement): void {
    const target = this.assignmentTargetInfo(statement.target);
    const targetType = target.type;
    const valueType = this.expressionType(statement.value);
    const assignedType = statement.operator === '='
      ? valueType
      : this.compoundAssignmentType(statement.operator, targetType, valueType, statement.range);

    if (statement.operator === '=' && target.property?.callbacks) {
      this.checkCallbackAssignment(target.property, valueType, statement.value.range);
    }

    if (!this.canAssign(targetType, assignedType)) {
      this.diagnostics.error(
        statement.value.range,
        `cannot assign '${typeToString(assignedType)}' value to '${typeToString(targetType)}' variable`,
      );
    }
  }

  private compoundAssignmentType(
    operator: Exclude<AssignmentStatement['operator'], '='>,
    targetType: TypeRef,
    valueType: TypeRef,
    range: SourceRange,
  ): TypeRef {
    const binaryOperator = operator.slice(0, 1);
    const result = this.binaryOperatorType(binaryOperator, targetType, valueType);
    if (result.kind === 'error') {
      this.diagnostics.error(
        range,
        `operator '${operator}' cannot be applied to '${typeToString(targetType)}' and '${typeToString(valueType)}'`,
      );
    }
    return result;
  }

  private assignmentTargetInfo(target: Expression): AssignmentTargetInfo {
    if (target.kind === 'IdentifierExpression') {
      const symbol = this.lookup(target.name);
      if (!symbol) {
        this.diagnostics.error(target.range, `variable '${target.name}' was not declared in this scope`);
        return { type: ERROR_TYPE };
      }
      if (symbol.kind === 'function') {
        this.diagnostics.error(target.range, `cannot assign to function '${target.name}'`);
        return { type: ERROR_TYPE };
      }
      return { type: symbol.type };
    }

    if (target.kind === 'MemberExpression') {
      const objectType = this.expressionType(target.object);
      if (objectType.kind === 'class') {
        const field = this.getClassField(objectType.name, target.name);
        if (!field) {
          this.diagnostics.error(target.range, `type '${typeToString(objectType)}' has no field '${target.name}'`);
          return { type: ERROR_TYPE };
        }
        this.checkClassMemberAccess(field, target.range);
        return { type: field.type };
      }

      const property = this.stdlib.getTypeProperty(objectType, target.name);
      if (!property) {
        this.diagnostics.error(target.range, `type '${typeToString(objectType)}' has no property '${target.name}'`);
        return { type: ERROR_TYPE };
      }
      if (property.readonly) {
        this.diagnostics.error(target.range, `property '${target.name}' is read-only`);
      }
      return { type: property.type, property };
    }

    if (target.kind === 'IndexExpression') {
      const objectType = this.expressionType(target.object);
      if (this.isStringType(objectType)) {
        this.expressionType(target.index);
        this.diagnostics.error(target.range, 'string characters are read-only');
        return { type: ERROR_TYPE };
      }
      return { type: this.indexExpressionType(target) };
    }

    this.diagnostics.error(target.range, 'assignment target must be a variable, object property, or array element');
    return { type: ERROR_TYPE };
  }

  private checkCallbackAssignment(property: PropertySpec, valueType: TypeRef, range: SourceRange): void {
    if (!property.callbacks || valueType.kind === 'error' || valueType.kind === 'any') return;

    if (valueType.kind !== 'function') {
      this.diagnostics.error(
        range,
        `callback property '${property.name}' expects a function, got '${typeToString(valueType)}'`,
      );
      return;
    }

    const matches = property.callbacks.some((signature) => {
      if (signature.parameters.length !== valueType.parameters.length) return false;
      if (!this.canAssign(signature.returnType, valueType.returnType)) return false;
      return signature.parameters.every((runtimeArgType, index) => (
        this.canAssign(valueType.parameters[index], runtimeArgType)
      ));
    });

    if (!matches) {
      const expected = property.callbacks.map((signature) => this.callbackSignatureText(signature.parameters, signature.returnType)).join(' or ');
      this.diagnostics.error(
        range,
        `callback property '${property.name}' expects ${expected}, got ${typeToString(valueType)}`,
      );
    }
  }

  private callbackSignatureText(parameters: readonly TypeRef[], returnType: TypeRef): string {
    return `function(${parameters.map(typeToString).join(', ')}): ${typeToString(returnType)}`;
  }

  private expressionType(expression: Expression): TypeRef {
    switch (expression.kind) {
      case 'LiteralExpression':
        return primitive(expression.valueType);
      case 'IdentifierExpression':
        return this.identifierType(expression.name, expression.range);
      case 'UnaryExpression':
        return this.unaryType(expression);
      case 'BinaryExpression':
        return this.binaryType(expression);
      case 'ArrayLiteralExpression':
        return this.arrayLiteralType(expression);
      case 'IndexExpression':
        return this.indexExpressionType(expression);
      case 'FunctionExpression':
        return this.functionExpressionType(expression);
      case 'CallExpression':
        return this.callType(expression);
      case 'MemberExpression':
        return this.memberType(expression);
    }
  }

  private functionExpressionType(expression: FunctionExpression): TypeRef {
    const returnType = this.resolveTypeName(expression.returnType);
    const parameters = expression.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));

    this.returnTypes.push(returnType);
    this.pushScope();

    for (let i = 0; i < expression.parameters.length; i++) {
      this.declare(expression.parameters[i].name, parameters[i], 'parameter', expression.parameters[i].range);
    }

    this.analyzeStatement(expression.body);
    this.reportMissingReturn(returnType, expression.body, expression.range);
    this.popScope();
    this.returnTypes.pop();

    return functionType(parameters, returnType);
  }

  private reportMissingReturn(returnType: TypeRef, body: Statement, range: SourceRange): void {
    if (sameType(returnType, VOID) || returnType.kind === 'error') return;
    if (this.statementAlwaysReturns(body)) return;
    this.diagnostics.error(range, `function with return type '${typeToString(returnType)}' must return a value`);
  }

  private statementAlwaysReturns(statement: Statement): boolean {
    switch (statement.kind) {
      case 'ReturnStatement':
        return true;
      case 'BlockStatement':
        return statement.statements.some((child) => this.statementAlwaysReturns(child));
      case 'IfStatement':
        return statement.elseBranch !== null
          && this.statementAlwaysReturns(statement.thenBranch)
          && this.statementAlwaysReturns(statement.elseBranch);
      default:
        return false;
    }
  }

  private arrayLiteralType(expression: Extract<Expression, { kind: 'ArrayLiteralExpression' }>): TypeRef {
    let elementType: TypeRef = ANY_TYPE;

    for (const element of expression.elements) {
      const currentType = this.expressionType(element);
      if (elementType.kind === 'any') {
        elementType = currentType;
        continue;
      }

      const merged = this.mergeArrayElementTypes(elementType, currentType);
      if (merged.kind === 'error') {
        this.diagnostics.error(
          element.range,
          `array element type '${typeToString(currentType)}' does not match '${typeToString(elementType)}'`,
        );
      } else {
        elementType = merged;
      }
    }

    return arrayType(elementType, expression.elements.length, false);
  }

  private mergeArrayElementTypes(left: TypeRef, right: TypeRef): TypeRef {
    if (this.canAssign(left, right)) return left;
    if (this.canAssign(right, left)) return right;
    if (isNumeric(left) && isNumeric(right)) {
      return sameType(left, FLOAT) || sameType(right, FLOAT) ? FLOAT : INT;
    }
    return ERROR_TYPE;
  }

  private indexExpressionType(expression: IndexExpression): TypeRef {
    const objectType = this.expressionType(expression.object);
    const indexType = this.expressionType(expression.index);

    if (!isIntegerLike(indexType)) {
      this.diagnostics.error(
        expression.index.range,
        `array index must be integer, got '${typeToString(indexType)}'`,
      );
    }

    if (this.isStringType(objectType)) {
      return CHAR;
    }

    if (objectType.kind !== 'array') {
      this.diagnostics.error(
        expression.object.range,
        `indexing requires an array or string, got '${typeToString(objectType)}'`,
      );
      return ERROR_TYPE;
    }

    return objectType.elementType;
  }

  private identifierType(name: string, range: SourceRange): TypeRef {
    const symbol = this.lookup(name);
    if (symbol) return symbol.type;

    if (this.stdlib.hasModule(name)) {
      if (!this.imports.has(name)) {
        this.diagnostics.error(range, `'${name}' is not imported (use 'use ${name};')`);
      }
      return ERROR_TYPE;
    }

    if (this.userModules.has(name)) {
      return ANY_TYPE;
    }

    if (this.classes.has(name)) {
      this.diagnostics.error(range, `class '${name}' cannot be used as a value`);
      return ERROR_TYPE;
    }

    if (name === 'this') {
      if (this.currentClassContext()?.isStatic) {
        this.diagnostics.error(range, "'this' cannot be used in a static method");
        return ERROR_TYPE;
      }

      this.diagnostics.error(range, "'this' can only be used inside a class");
      return ERROR_TYPE;
    }

    this.diagnostics.error(range, `'${name}' was not declared in this scope`);
    return ERROR_TYPE;
  }

  private unaryType(expression: Extract<Expression, { kind: 'UnaryExpression' }>): TypeRef {
    const operandType = this.expressionType(expression.operand);

    if (expression.operator === 'not') {
      if (!sameType(operandType, BOOL)) {
        this.diagnostics.error(expression.operand.range, `operator 'not' requires 'bool', got '${typeToString(operandType)}'`);
        return ERROR_TYPE;
      }
      return BOOL;
    }

    if (!isNumeric(operandType)) {
      this.diagnostics.error(expression.operand.range, `unary '-' requires numeric operand, got '${typeToString(operandType)}'`);
      return ERROR_TYPE;
    }
    return operandType;
  }

  private binaryType(expression: BinaryExpression): TypeRef {
    const left = this.expressionType(expression.left);
    const right = this.expressionType(expression.right);

    if (['and', 'or'].includes(expression.operator)) {
      if (!sameType(left, BOOL) || !sameType(right, BOOL)) {
        this.diagnostics.error(expression.range, `operator '${expression.operator}' requires bool operands`);
      }
      return BOOL;
    }

    if (['==', '!='].includes(expression.operator)) {
      if (!sameType(left, right) && !this.canAssign(left, right) && !this.canAssign(right, left)) {
        this.diagnostics.error(
          expression.range,
          `cannot compare '${typeToString(left)}' and '${typeToString(right)}'`,
        );
      }
      return BOOL;
    }

    if (['<', '<=', '>', '>='].includes(expression.operator)) {
      if (!isNumeric(left) || !isNumeric(right)) {
        this.diagnostics.error(expression.range, `comparison '${expression.operator}' requires numeric operands`);
      }
      return BOOL;
    }

    const result = this.binaryOperatorType(expression.operator, left, right);
    if (result.kind === 'error') {
      this.diagnostics.error(
        expression.range,
        `operator '${expression.operator}' cannot be applied to '${typeToString(left)}' and '${typeToString(right)}'`,
      );
    }
    return result;
  }

  private binaryOperatorType(operator: string, left: TypeRef, right: TypeRef): TypeRef {
    if (operator === '+' && left.kind === 'primitive' && right.kind === 'primitive') {
      if (left.name === 'string' && (right.name === 'string' || right.name === 'char')) {
        return STRING;
      }
      if (left.name === 'char' && right.name === 'string') {
        return STRING;
      }
    }

    return numericBinaryResult(operator, left, right);
  }

  private callType(expression: CallExpression): TypeRef {
    if (expression.callee.kind === 'IdentifierExpression' && this.isArrayGlobalFunction(expression.callee.name)) {
      return this.arrayGlobalFunctionType(expression.callee.name, expression);
    }

    const specialMathType = this.specialMathCallType(expression);
    if (specialMathType) return specialMathType;

    const resolved = this.resolveCall(expression);
    if (!resolved) {
      for (const arg of expression.args) this.expressionType(arg);
      return ERROR_TYPE;
    }

    this.checkArguments(expression, resolved);
    return resolved.returnType;
  }

  private isArrayGlobalFunction(name: string): boolean {
    return name === 'max' || name === 'min' || name === 'sum' || name === 'avg';
  }

  private arrayGlobalFunctionType(name: string, expression: CallExpression): TypeRef {
    if (expression.args.length !== 1) {
      this.diagnostics.error(expression.range, `'${name}' expects 1 argument, got ${expression.args.length}`);
      return ERROR_TYPE;
    }

    const argType = this.expressionType(expression.args[0]);
    if (argType.kind !== 'array') {
      this.diagnostics.error(
        expression.args[0].range,
        `'${name}' expects an array, got '${typeToString(argType)}'`,
      );
      return ERROR_TYPE;
    }

    if (!isNumeric(argType.elementType)) {
      this.diagnostics.error(
        expression.args[0].range,
        `'${name}' expects a numeric array, got '${typeToString(argType)}'`,
      );
      return ERROR_TYPE;
    }

    return name === 'avg' ? FLOAT : argType.elementType;
  }

  private specialMathCallType(expression: CallExpression): TypeRef | null {
    const callee = expression.callee;
    if (callee.kind !== 'MemberExpression' || callee.object.kind !== 'IdentifierExpression') {
      return null;
    }
    if (callee.object.name !== 'math') return null;

    if (callee.name === 'round' || callee.name === 'floor' || callee.name === 'ceil') {
      if (!this.imports.has('math')) {
        this.diagnostics.error(callee.object.range, "'math' is not imported (use 'use math;')");
        return ERROR_TYPE;
      }

      if (expression.args.length !== 1 && expression.args.length !== 2) {
        this.diagnostics.error(expression.range, `'${callee.name}' expects 1 or 2 arguments, got ${expression.args.length}`);
        return ERROR_TYPE;
      }

      const valueType = this.expressionType(expression.args[0]);
      if (!isNumeric(valueType)) {
        this.diagnostics.error(
          expression.args[0].range,
          `'${callee.name}' argument 1 expects numeric value, got '${typeToString(valueType)}'`,
        );
      }

      if (expression.args.length === 2) {
        const digitsType = this.expressionType(expression.args[1]);
        if (!isIntegerLike(digitsType)) {
          this.diagnostics.error(
            expression.args[1].range,
            `'${callee.name}' argument 2 expects integer value, got '${typeToString(digitsType)}'`,
          );
        }
        return FLOAT;
      }

      return INT;
    }

    if (callee.name === 'clamp') {
      if (!this.imports.has('math')) {
        this.diagnostics.error(callee.object.range, "'math' is not imported (use 'use math;')");
        return ERROR_TYPE;
      }

      if (expression.args.length !== 3) {
        this.diagnostics.error(expression.range, "'clamp' expects 3 arguments");
        return ERROR_TYPE;
      }

      const argTypes = expression.args.map((arg) => this.expressionType(arg));
      for (let i = 0; i < argTypes.length; i++) {
        if (!isNumeric(argTypes[i])) {
          this.diagnostics.error(
            expression.args[i].range,
            `'clamp' argument ${i + 1} expects numeric value, got '${typeToString(argTypes[i])}'`,
          );
        }
      }

      return argTypes.every((type) => isIntegerLike(type)) ? INT : FLOAT;
    }

    return null;
  }

  private resolveCall(expression: CallExpression): FunctionSpec | null {
    const callee = expression.callee;

    if (callee.kind === 'IdentifierExpression') {
      if (this.classes.has(callee.name)) {
        this.diagnostics.error(callee.range, `class '${callee.name}' cannot be called as a function; declare an object with '${callee.name} name(...)'`);
        return null;
      }

      const global = this.stdlib.getGlobalFunction(callee.name);
      if (global) return global;

      const symbol = this.lookup(callee.name);
      if (symbol?.type.kind === 'function') {
        return {
          name: callee.name,
          parameters: symbol.type.parameters.map((type, index) => ({ name: `arg${index + 1}`, type })),
          returnType: symbol.type.returnType,
        };
      }

      this.diagnostics.error(callee.range, `function '${callee.name}' was not declared in this scope`);
      return null;
    }

    if (callee.kind === 'MemberExpression' && callee.object.kind === 'IdentifierExpression') {
      const moduleName = callee.object.name;
      const module = this.stdlib.getModule(moduleName);
      if (module) {
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(callee.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return null;
        }

        const fn = this.stdlib.getModuleFunction(moduleName, callee.name);
        if (!fn) {
          this.diagnostics.error(callee.range, `'${moduleName}' has no function '${callee.name}'`);
          return null;
        }
        return fn;
      }

      const userModule = this.userModuleRegistry.getModule(moduleName);
      if (userModule) {
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(callee.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return null;
        }

        const fn = userModule.functions.get(callee.name);
        if (!fn) {
          this.diagnostics.error(callee.range, `module '${moduleName}' has no function '${callee.name}'`);
          return null;
        }
        return fn;
      }

      if (this.userModules.has(moduleName)) {
        return { name: callee.name, parameters: [], returnType: ANY_TYPE, variadic: true, variadicTypes: [ANY_TYPE] };
      }

      const classInfo = this.classes.get(moduleName);
      if (classInfo) {
        const method = classInfo.methods.get(callee.name);
        if (method) {
          const access = classInfo.methodAccess.get(callee.name);
          if (access?.isStatic) {
            this.checkClassMemberAccess(access, callee.range);
            return method;
          }
          this.diagnostics.error(callee.range, `instance method '${moduleName}.${callee.name}' must be called on an object`);
          return null;
        }

        if (classInfo.fields.has(callee.name)) {
          this.diagnostics.error(callee.range, `instance field '${moduleName}.${callee.name}' must be accessed through an object`);
          return null;
        }

        this.diagnostics.error(callee.range, `class '${moduleName}' has no static method '${callee.name}'`);
        return null;
      }
    }

    if (callee.kind === 'MemberExpression') {
      const objectType = this.expressionType(callee.object);
      if (this.isStringType(objectType)) {
        const method = this.stringMethodSpec(callee.name);
        if (method) return method;
        this.diagnostics.error(callee.range, `type 'string' has no method '${callee.name}'`);
        return null;
      }
      if (objectType.kind === 'array') {
        const method = this.arrayMethodSpec(objectType, callee.name);
        if (method) return method;
        this.reportUnknownArrayMethod(objectType, callee.name, callee.range);
        return null;
      }
      if (objectType.kind === 'class') {
        const method = this.getClassMethodInfo(objectType.name, callee.name);
        if (method) {
          this.checkClassMemberAccess(method.access, callee.range);
          return method.spec;
        }
        const staticMethod = this.getClassStaticMethodInfo(objectType.name, callee.name);
        if (staticMethod) {
          this.diagnostics.error(
            callee.range,
            `static method '${staticMethod.access.owner}.${staticMethod.access.name}' must be called on class '${staticMethod.access.owner}'`,
          );
          return null;
        }
        this.diagnostics.error(callee.range, `type '${typeToString(objectType)}' has no method '${callee.name}'`);
        return null;
      }
      const method = this.stdlib.getTypeMethod(objectType, callee.name);
      if (method) return method;
      this.diagnostics.error(callee.range, `type '${typeToString(objectType)}' has no method '${callee.name}'`);
      return null;
    }

    this.diagnostics.error(callee.range, 'only function and method calls are supported in this compiler slice');
    return null;
  }

  private checkArguments(expression: CallExpression, fn: FunctionSpec): void {
    this.checkArgumentList(expression.args, fn, expression.range);
  }

  private checkArgumentList(args: readonly Expression[], fn: FunctionSpec, range: SourceRange): void {
    const minArguments = fn.minArguments ?? fn.parameters.length;
    const maxArguments = fn.parameters.length;

    if (!fn.variadic && (args.length < minArguments || args.length > maxArguments)) {
      this.diagnostics.error(
        range,
        `'${fn.name}' expects ${argumentCountText(minArguments, maxArguments)} arguments, got ${args.length}`,
      );
      return;
    }

    if (fn.variadic && args.length < minArguments) {
      this.diagnostics.error(
        range,
        `'${fn.name}' expects at least ${minArguments} arguments, got ${args.length}`,
      );
      return;
    }

    for (let i = 0; i < args.length; i++) {
      const argType = this.expressionType(args[i]);
      const parameter = fn.parameters[i];
      if (parameter) {
        if (parameter.acceptedTypes) {
          const accepts = parameter.acceptedTypes.some((candidate) => this.canAssign(candidate, argType));
          if (!accepts) {
            this.diagnostics.error(
              args[i].range,
              `'${fn.name}' argument ${i + 1} expects ${parameter.acceptedDescription ?? parameter.acceptedTypes.map(typeToString).join(' or ')}, got '${typeToString(argType)}'`,
            );
          }
          continue;
        }

        if (!this.canAssign(parameter.type, argType)) {
          this.diagnostics.error(
            args[i].range,
            `'${fn.name}' argument ${i + 1} expects '${typeToString(parameter.type)}', got '${typeToString(argType)}'`,
          );
        }
        continue;
      }

      if (fn.variadicTypes && !fn.variadicTypes.some((candidate) => this.canAssign(candidate, argType))) {
        this.diagnostics.error(
          args[i].range,
          `'${fn.name}' does not accept argument of type '${typeToString(argType)}'`,
        );
      }
    }
  }

  private memberType(expression: MemberExpression): TypeRef {
    if (expression.object.kind === 'IdentifierExpression') {
      const moduleName = expression.object.name;
      const module = this.stdlib.getModule(moduleName);
      if (module) {
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(expression.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return ERROR_TYPE;
        }
        const constant = module.constants.get(expression.name);
        if (constant) return constant.type;
        const fn = module.functions.get(expression.name);
        if (fn) return functionType(fn.parameters.map((param) => param.type), fn.returnType);
        if (module.types.has(expression.name)) return ERROR_TYPE;
        this.diagnostics.error(expression.range, `'${moduleName}' has no member '${expression.name}'`);
        return ERROR_TYPE;
      }

      const userModule = this.userModuleRegistry.getModule(moduleName);
      if (userModule) {
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(expression.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return ERROR_TYPE;
        }

        const fn = userModule.functions.get(expression.name);
        if (fn) return functionType(fn.parameters.map((param) => param.type), fn.returnType);
        if (userModule.classes.has(expression.name)) return ERROR_TYPE;

        this.diagnostics.error(expression.range, `module '${moduleName}' has no member '${expression.name}'`);
        return ERROR_TYPE;
      }

      if (this.userModules.has(moduleName)) {
        return ANY_TYPE;
      }

      const classInfo = this.classes.get(moduleName);
      if (classInfo) {
        const method = classInfo.methods.get(expression.name);
        if (method) {
          const access = classInfo.methodAccess.get(expression.name);
          if (access?.isStatic) {
            this.checkClassMemberAccess(access, expression.range);
            return functionType(method.parameters.map((param) => param.type), method.returnType);
          }
          this.diagnostics.error(expression.range, `instance method '${moduleName}.${expression.name}' must be called on an object`);
          return ERROR_TYPE;
        }

        if (classInfo.fields.has(expression.name)) {
          this.diagnostics.error(expression.range, `instance field '${moduleName}.${expression.name}' must be accessed through an object`);
          return ERROR_TYPE;
        }

        this.diagnostics.error(expression.range, `class '${moduleName}' has no member '${expression.name}'`);
        return ERROR_TYPE;
      }
    }

    const objectType = this.expressionType(expression.object);
    if (this.isStringType(objectType)) {
      const method = this.stringMethodSpec(expression.name);
      if (method) return functionType(method.parameters.map((param) => param.type), method.returnType);
      this.diagnostics.error(expression.range, `type 'string' has no member '${expression.name}'`);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'array') {
      const method = this.arrayMethodSpec(objectType, expression.name);
      if (method) return functionType(method.parameters.map((param) => param.type), method.returnType);
      this.reportUnknownArrayMethod(objectType, expression.name, expression.range);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'class') {
      const field = this.getClassField(objectType.name, expression.name);
      if (field) {
        this.checkClassMemberAccess(field, expression.range);
        return field.type;
      }

      const method = this.getClassMethodInfo(objectType.name, expression.name);
      if (method) {
        this.checkClassMemberAccess(method.access, expression.range);
        return functionType(method.spec.parameters.map((param) => param.type), method.spec.returnType);
      }
      const staticMethod = this.getClassStaticMethodInfo(objectType.name, expression.name);
      if (staticMethod) {
        this.diagnostics.error(
          expression.range,
          `static method '${staticMethod.access.owner}.${staticMethod.access.name}' must be called on class '${staticMethod.access.owner}'`,
        );
        return ERROR_TYPE;
      }

      this.diagnostics.error(expression.range, `type '${typeToString(objectType)}' has no member '${expression.name}'`);
      return ERROR_TYPE;
    }

    const property = this.stdlib.getTypeProperty(objectType, expression.name);
    if (property) return property.type;

    const method = this.stdlib.getTypeMethod(objectType, expression.name);
    if (method) return functionType(method.parameters.map((param) => param.type), method.returnType);

    this.diagnostics.error(expression.range, `type '${typeToString(objectType)}' has no member '${expression.name}'`);
    return ERROR_TYPE;
  }

  private isStringType(type: TypeRef): boolean {
    return type.kind === 'primitive' && type.name === 'string';
  }

  private stringMethodSpec(name: string): FunctionSpec | null {
    switch (name) {
      case 'length':
        return { name, parameters: [], returnType: INT };
      case 'contains':
      case 'find':
      case 'count':
        return { name, parameters: [{ name: 'text', type: ANY_TYPE }], returnType: name === 'contains' ? BOOL : INT };
      case 'is_int':
      case 'is_float':
        return { name, parameters: [], returnType: BOOL };
      case 'to_upper':
      case 'to_lower':
      case 'trim':
        return { name, parameters: [], returnType: STRING };
      case 'substring':
        return { name, parameters: [{ name: 'start', type: INT }, { name: 'length', type: INT }], returnType: STRING };
      case 'replace':
        return { name, parameters: [{ name: 'old_text', type: STRING }, { name: 'new_text', type: STRING }], returnType: STRING };
      case 'split':
        return { name, parameters: [{ name: 'separator', type: STRING }], returnType: arrayType(STRING, null, true) };
      default:
        return null;
    }
  }

  private arrayMethodSpec(type: Extract<TypeRef, { kind: 'array' }>, name: string): FunctionSpec | null {
    const value = { name: 'value', type: type.elementType };
    const index = { name: 'index', type: INT };

    switch (name) {
      case 'length':
        return { name, parameters: [], returnType: INT };
      case 'contains':
        return { name, parameters: [value], returnType: BOOL };
      case 'find':
        return { name, parameters: [value], returnType: INT };
      case 'count':
        return { name, parameters: [value], returnType: INT };
      case 'reverse':
      case 'sort':
        return { name, parameters: [], returnType: VOID };
      case 'add':
        return type.dynamic ? { name, parameters: [value], returnType: VOID } : null;
      case 'remove_at':
      case 'resize':
        return type.dynamic ? { name, parameters: [{ name: 'size', type: INT }], returnType: VOID } : null;
      case 'insert':
        return type.dynamic ? { name, parameters: [index, value], returnType: VOID } : null;
      case 'join':
        return type.dynamic
          ? { name, parameters: [{ name: 'other', type: arrayType(type.elementType, null, true) }], returnType: VOID }
          : null;
      case 'clear':
        return type.dynamic ? { name, parameters: [], returnType: VOID } : null;
      case 'pop':
        return type.dynamic ? { name, parameters: [], returnType: type.elementType } : null;
      default:
        return null;
    }
  }

  private reportUnknownArrayMethod(type: Extract<TypeRef, { kind: 'array' }>, name: string, range: SourceRange): void {
    if (!type.dynamic && this.isDynamicArrayOnlyMethod(name)) {
      this.diagnostics.error(range, `method '${name}' is only available on 'dyn_array'`);
      return;
    }
    this.diagnostics.error(range, `type '${typeToString(type)}' has no method '${name}'`);
  }

  private isDynamicArrayOnlyMethod(name: string): boolean {
    return name === 'add'
      || name === 'remove_at'
      || name === 'resize'
      || name === 'insert'
      || name === 'join'
      || name === 'clear'
      || name === 'pop';
  }

  private getClassField(className: string, fieldName: string): UserPropertySpec | null {
    return this.classes.get(className)?.fields.get(fieldName) ?? null;
  }

  private getClassMethodInfo(className: string, methodName: string): { readonly spec: FunctionSpec; readonly access: UserMethodAccess } | null {
    const info = this.classes.get(className);
    if (!info) return null;
    const method = info.methods.get(methodName);
    if (!method) return null;
    const access = info.methodAccess.get(methodName);
    if (!access) return null;
    if (access.isStatic) return null;
    return { spec: method, access };
  }

  private getClassStaticMethodInfo(className: string, methodName: string): { readonly spec: FunctionSpec; readonly access: UserMethodAccess } | null {
    const info = this.classes.get(className);
    if (!info) return null;
    const method = info.methods.get(methodName);
    if (!method) return null;
    const access = info.methodAccess.get(methodName);
    if (!access) return null;
    if (!access.isStatic) return null;
    return { spec: method, access };
  }

  private checkClassMemberAccess(member: UserPropertySpec | UserMethodAccess, range: SourceRange): void {
    if (member.access === 'public') return;
    if (this.currentClassName() === member.owner) return;

    this.diagnostics.error(
      range,
      `member '${member.owner}.${member.name}' is private and can only be used inside class '${member.owner}'`,
    );
  }

  private canAssign(target: TypeRef, value: TypeRef): boolean {
    if (isAssignable(target, value)) return true;

    if (target.kind === 'class' && value.kind === 'class') {
      return this.classExtends(value.name, target.name);
    }

    if (target.kind === 'qualified' && value.kind === 'qualified') {
      return this.stdlib.typeExtends(value, target);
    }

    if (target.kind === 'array' && value.kind === 'array') {
      const sizeMatches = target.dynamic || (!value.dynamic && target.size === value.size);
      return sizeMatches && this.canAssign(target.elementType, value.elementType);
    }

    return false;
  }

  private classExtends(childName: string, parentName: string): boolean {
    let current = this.classes.get(childName);
    const seen = new Set<string>();

    while (current?.declaration.baseName) {
      const baseName = current.declaration.baseName;
      if (baseName === parentName) return true;
      if (seen.has(baseName)) return false;
      seen.add(baseName);
      current = this.classes.get(baseName);
    }

    return false;
  }

  private declare(
    name: string,
    type: TypeRef,
    kind: SymbolInfo['kind'],
    range: SourceRange,
  ): void {
    const scope = this.currentScope();
    if (scope.has(name)) {
      this.diagnostics.error(range, `'${name}' is already declared in this scope`);
      return;
    }
    scope.set(name, { type, kind, range });
  }

  private lookup(name: string): SymbolInfo | null {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const symbol = this.scopes[i].get(name);
      if (symbol) return symbol;
    }
    return null;
  }

  private pushScope(): void {
    this.scopes.push(new Map());
  }

  private popScope(): void {
    this.scopes.pop();
  }

  private pushClassContext(className: string, isStatic: boolean): void {
    this.classContexts.push({ className, isStatic });
  }

  private popClassContext(): void {
    this.classContexts.pop();
  }

  private currentClassName(): string | null {
    return this.currentClassContext()?.className ?? null;
  }

  private currentClassContext(): ClassContext | null {
    return this.classContexts[this.classContexts.length - 1] ?? null;
  }

  private currentScope(): Map<string, SymbolInfo> {
    return this.scopes[this.scopes.length - 1];
  }
}

function argumentCountText(minArguments: number, maxArguments: number): string {
  if (minArguments === maxArguments) return String(maxArguments);
  if (maxArguments === minArguments + 1) return `${minArguments} or ${maxArguments}`;
  return `${minArguments}-${maxArguments}`;
}
