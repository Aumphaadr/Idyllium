import {
  AccessModifier,
  AssignmentStatement,
  BinaryExpression,
  BreakStatement,
  CallArgument,
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
  MainFunction,
  MemberExpression,
  ParameterDeclaration,
  Program,
  ReturnStatement,
  Statement,
  TypeName,
  VariableDeclaration,
  WhileStatement,
} from './ast';
import { DiagnosticBag, SourceRange } from './diagnostics';
import { UserModuleRegistry } from './modules';
import { FunctionSpec, ParameterSpec, PropertySpec, StandardLibraryRegistry, createDefaultStandardLibrary } from './stdlib/registry';
import {
  ANY_TYPE,
  BOOL,
  CHAR,
  ERROR_TYPE,
  FLOAT,
  INT,
  NULL_TYPE,
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
  readonly tokens: readonly IdylliumSemanticToken[];
}

export type IdylliumSemanticTokenKind =
  | 'namespace'
  | 'class'
  | 'function'
  | 'method'
  | 'property'
  | 'variable'
  | 'parameter';

export type IdylliumSemanticTokenModifier = 'declaration' | 'readonly' | 'static' | 'defaultLibrary';

export interface IdylliumSemanticToken {
  readonly kind: IdylliumSemanticTokenKind;
  readonly range: SourceRange;
  readonly modifiers: readonly IdylliumSemanticTokenModifier[];
}

interface SymbolInfo {
  readonly type: TypeRef;
  readonly range: SourceRange;
  readonly kind: 'variable' | 'parameter' | 'function';
  readonly readonly: boolean;
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
  private readonly semanticTokens: IdylliumSemanticToken[] = [];
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
      this.markSemanticToken(
        'namespace',
        importDecl.moduleNameRange,
        this.stdlib.hasModule(importDecl.moduleName) ? ['defaultLibrary'] : [],
      );
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
      this.markSemanticToken('function', program.main.nameRange, ['declaration']);
      this.analyzeMainFunction(program.main);
    }

    return {
      success: !this.diagnostics.hasErrors(),
      diagnostics: this.diagnostics,
      tokens: deduplicateSemanticTokens(this.semanticTokens),
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
          nameRange: classSpec.range,
          baseName: classSpec.baseName,
          baseNameRange: null,
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
    this.markSemanticToken('function', declaration.nameRange, ['declaration']);
    if (this.functions.has(declaration.name)) {
      this.diagnostics.error(declaration.range, `function '${declaration.name}' is already declared`);
      return;
    }

    this.functions.set(declaration.name, declaration);
    const parameters = declaration.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));
    const returnType = this.resolveTypeName(declaration.returnType);
    this.declare(declaration.name, functionType(parameters, returnType, requiredParameterCount(declaration.parameters)), 'function', declaration.range);
  }

  private analyzeFunctionDeclaration(declaration: FunctionDeclaration): void {
    const returnType = this.resolveTypeName(declaration.returnType);
    this.returnTypes.push(returnType);
    this.pushScope();

    this.analyzeParameters(declaration.parameters);

    this.analyzeStatement(declaration.body);
    this.reportMissingReturn(returnType, declaration.body, declaration.range);
    this.popScope();
    this.returnTypes.pop();
  }

  private analyzeParameters(parameters: readonly ParameterDeclaration[]): TypeRef[] {
    const resolved: TypeRef[] = [];
    let sawDefault = false;

    for (const parameter of parameters) {
      this.markSemanticToken('parameter', parameter.nameRange, ['declaration']);
      const parameterType = this.resolveTypeName(parameter.paramType);
      resolved.push(parameterType);

      if (parameter.defaultValue) {
        sawDefault = true;
        const defaultType = this.expressionType(parameter.defaultValue);
        if (!this.canAssign(parameterType, defaultType)) {
          this.diagnostics.error(
            parameter.defaultValue.range,
            `default value for parameter '${parameter.name}' expects '${typeToString(parameterType)}', got '${typeToString(defaultType)}'`,
          );
        }
      } else if (sawDefault) {
        this.diagnostics.error(
          parameter.range,
          `parameter '${parameter.name}' without default value cannot follow a parameter with default value`,
        );
      }

      this.declare(parameter.name, parameterType, 'parameter', parameter.range);
    }

    return resolved;
  }

  private analyzeMainFunction(declaration: MainFunction): void {
    const returnType = this.resolveTypeName(declaration.returnType);
    if (declaration.parameters.length > 0) {
      this.diagnostics.error(declaration.parameters[0].range, "entry point 'main' cannot have parameters");
    }

    this.returnTypes.push(returnType);
    this.pushScope();

    this.analyzeParameters(declaration.parameters);

    this.analyzeStatement(declaration.body);
    this.reportMissingReturn(returnType, declaration.body, declaration.range);
    this.popScope();
    this.returnTypes.pop();
  }

  private registerClass(declaration: ClassDeclaration): void {
    this.markSemanticToken('class', declaration.nameRange, ['declaration']);
    if (declaration.baseNameRange) {
      this.markSemanticToken('class', declaration.baseNameRange);
    }
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
      this.markSemanticToken('property', field.nameRange, ['declaration']);
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
    this.markSemanticToken(
      'method',
      declaration.nameRange,
      declaration.isStatic ? ['declaration', 'static'] : ['declaration'],
    );
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
      minArguments: requiredParameterCount(declaration.parameters),
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
    this.markSemanticToken('method', declaration.nameRange, ['declaration']);
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
      minArguments: requiredParameterCount(declaration.parameters),
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

    this.analyzeParameters(declaration.parameters);

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
        functionType(
          baseConstructor.parameters.map((parameter) => parameter.type),
          VOID,
          baseConstructor.minArguments,
        ),
        'function',
        declaration.range,
      );
    }

    this.analyzeParameters(declaration.parameters);

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
    const modifiers: IdylliumSemanticTokenModifier[] = ['declaration'];
    if (statement.isConst) modifiers.push('readonly');
    this.markSemanticToken(kind === 'parameter' ? 'parameter' : 'variable', statement.nameRange, modifiers);
    const declaredType = this.resolveTypeName(statement.declaredType);
    if (declaredType.kind === 'primitive' && declaredType.name === 'void') {
      this.diagnostics.error(statement.range, "cannot declare variable of type 'void'");
      return;
    }

    if (statement.isConst && !statement.initializer && !statement.constructorArgs) {
      this.diagnostics.error(statement.nameRange, `constant '${statement.name}' must have an initializer`);
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

    this.declare(statement.name, declaredType, kind, statement.range, statement.isConst);
  }

  private analyzeConstructorArguments(statement: VariableDeclaration, declaredType: TypeRef): void {
    if (declaredType.kind === 'qualified' && declaredType.moduleName === 'json' && declaredType.name === 'Value') {
      const constructor = this.stdlib.getModuleFunction('json', 'Value');
      if (constructor) this.checkArgumentList(statement.constructorArgs ?? [], constructor, statement.range);
      return;
    }

    if (declaredType.kind !== 'class') {
      this.diagnostics.error(statement.range, `constructor-style declaration requires a class type, got '${typeToString(declaredType)}'`);
      for (const arg of statement.constructorArgs ?? []) this.expressionType(arg.value);
      return;
    }

    const info = this.classes.get(declaredType.name);
    if (!info) return;

    const constructor = info.constructorSpec;
    if (!constructor) {
      this.diagnostics.error(statement.range, `class '${declaredType.name}' has no constructor`);
      for (const arg of statement.constructorArgs ?? []) this.expressionType(arg.value);
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
      this.markSemanticToken('class', typeName.nameRange);
      if (!this.classes.has(typeName.name)) {
        this.diagnostics.error(typeName.range, `unknown class '${typeName.name}'`);
        return ERROR_TYPE;
      }
      return classType(typeName.name);
    }

    this.markSemanticToken(
      'namespace',
      typeName.moduleNameRange,
      this.stdlib.hasModule(typeName.moduleName) ? ['defaultLibrary'] : [],
    );
    this.markSemanticToken(
      'class',
      typeName.nameRange,
      this.stdlib.hasModule(typeName.moduleName) ? ['defaultLibrary'] : [],
    );

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
      this.markSymbolReference(symbol, target.range, target.name);
      if (symbol.kind === 'function') {
        this.diagnostics.error(target.range, `cannot assign to function '${target.name}'`);
        return { type: ERROR_TYPE };
      }
      if (symbol.readonly) {
        this.diagnostics.error(target.range, `cannot assign to constant '${target.name}'`);
      }
      return { type: symbol.type };
    }

    if (target.kind === 'MemberExpression') {
      if (target.object.kind === 'IdentifierExpression') {
        const moduleName = target.object.name;
        const stdlibConstant = this.stdlib.getModule(moduleName)?.constants.get(target.name);
        const userConstant = this.userModuleRegistry.getModule(moduleName)?.constants.get(target.name);
        const constant = stdlibConstant ?? userConstant;
        if (constant) {
          this.markSemanticToken(
            'namespace',
            target.object.range,
            stdlibConstant ? ['defaultLibrary'] : [],
          );
          this.markSemanticToken(
            'variable',
            target.nameRange,
            stdlibConstant ? ['readonly', 'defaultLibrary'] : ['readonly'],
          );
          this.diagnostics.error(target.range, `cannot assign to constant '${moduleName}.${target.name}'`);
          return { type: constant.type };
        }
      }

      const objectType = this.expressionType(target.object);
      if (objectType.kind === 'class') {
        const field = this.getClassField(objectType.name, target.name);
        if (!field) {
          this.diagnostics.error(target.range, `type '${typeToString(objectType)}' has no field '${target.name}'`);
          return { type: ERROR_TYPE };
        }
        this.markSemanticToken('property', target.nameRange);
        this.checkClassMemberAccess(field, target.range);
        return { type: field.type };
      }

      const property = this.stdlib.getTypeProperty(objectType, target.name);
      if (!property) {
        this.diagnostics.error(target.range, `type '${typeToString(objectType)}' has no property '${target.name}'`);
        return { type: ERROR_TYPE };
      }
      this.markSemanticToken('property', target.nameRange, ['defaultLibrary']);
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
        return expression.valueType === 'null' ? NULL_TYPE : primitive(expression.valueType);
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

    this.analyzeParameters(expression.parameters);

    this.analyzeStatement(expression.body);
    this.reportMissingReturn(returnType, expression.body, expression.range);
    this.popScope();
    this.returnTypes.pop();

    return functionType(parameters, returnType, requiredParameterCount(expression.parameters));
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
    if (left.kind === 'array' && right.kind === 'array') {
      const elementType = this.mergeArrayElementTypes(left.elementType, right.elementType);
      if (elementType.kind === 'error') return ERROR_TYPE;

      const sameStaticShape = !left.dynamic
        && !right.dynamic
        && left.size === right.size;
      return arrayType(
        elementType,
        sameStaticShape ? left.size : null,
        !sameStaticShape,
      );
    }
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
    if (symbol) {
      this.markSymbolReference(symbol, range, name);
      return symbol.type;
    }

    if (this.stdlib.hasModule(name)) {
      this.markSemanticToken('namespace', range, ['defaultLibrary']);
      if (!this.imports.has(name)) {
        this.diagnostics.error(range, `'${name}' is not imported (use 'use ${name};')`);
      }
      return ERROR_TYPE;
    }

    if (this.userModules.has(name)) {
      this.markSemanticToken('namespace', range);
      return ANY_TYPE;
    }

    if (this.classes.has(name)) {
      this.markSemanticToken('class', range);
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
      this.markSemanticToken('function', expression.callee.range, ['defaultLibrary']);
      return this.arrayGlobalFunctionType(expression.callee.name, expression);
    }

    const specialMathType = this.specialMathCallType(expression);
    if (specialMathType) return specialMathType;

    const resolved = this.resolveCall(expression);
    if (!resolved) {
      for (const arg of expression.args) this.expressionType(arg.value);
      return ERROR_TYPE;
    }

    this.checkArguments(expression, resolved);
    return resolved.returnType;
  }

  private isArrayGlobalFunction(name: string): boolean {
    return name === 'max' || name === 'min' || name === 'sum' || name === 'avg';
  }

  private arrayGlobalFunctionType(name: string, expression: CallExpression): TypeRef {
    const fn: FunctionSpec = { name, parameters: [{ name: 'array', type: ANY_TYPE }], returnType: ANY_TYPE };
    this.checkArgumentList(expression.args, fn, expression.range);
    const ordered = this.orderedArguments(expression.args, fn);
    const arg = ordered[0];
    if (!arg) {
      return ERROR_TYPE;
    }

    const argType = this.expressionType(arg.value);
    if (argType.kind !== 'array') {
      this.diagnostics.error(
        arg.range,
        `'${name}' expects an array, got '${typeToString(argType)}'`,
      );
      return ERROR_TYPE;
    }

    if (!isNumeric(argType.elementType)) {
      this.diagnostics.error(
        arg.range,
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

    this.markSemanticToken('namespace', callee.object.range, ['defaultLibrary']);
    this.markSemanticToken('function', callee.nameRange, ['defaultLibrary']);

    if (callee.name === 'round' || callee.name === 'floor' || callee.name === 'ceil') {
      if (!this.imports.has('math')) {
        this.diagnostics.error(callee.object.range, "'math' is not imported (use 'use math;')");
        return ERROR_TYPE;
      }

      const fn: FunctionSpec = {
        name: callee.name,
        parameters: [
          { name: 'value', type: FLOAT },
          { name: 'digits', type: INT },
        ],
        returnType: FLOAT,
        minArguments: 1,
      };
      this.checkArgumentList(expression.args, fn, expression.range);
      if (expression.args.length === 2) {
        return FLOAT;
      }

      return INT;
    }

    if (callee.name === 'clamp') {
      if (!this.imports.has('math')) {
        this.diagnostics.error(callee.object.range, "'math' is not imported (use 'use math;')");
        return ERROR_TYPE;
      }

      const fn: FunctionSpec = {
        name: 'clamp',
        parameters: [
          { name: 'min', type: FLOAT },
          { name: 'value', type: FLOAT },
          { name: 'max', type: FLOAT },
        ],
        returnType: FLOAT,
      };
      this.checkArgumentList(expression.args, fn, expression.range);
      const argTypes = expression.args.map((arg) => this.expressionType(arg.value));
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
      if (global) {
        this.markSemanticToken('function', callee.range, ['defaultLibrary']);
        return global;
      }

      const localFunction = this.functions.get(callee.name);
      if (localFunction) {
        this.markSemanticToken('function', callee.range);
        const parameters = localFunction.parameters.map((parameter) => ({
          name: parameter.name,
          type: this.resolveTypeName(parameter.paramType),
        }));
        return {
          name: callee.name,
          parameters,
          returnType: this.resolveTypeName(localFunction.returnType),
          minArguments: requiredParameterCount(localFunction.parameters),
        };
      }

      const symbol = this.lookup(callee.name);
      if (symbol?.type.kind === 'function') {
        this.markSymbolReference(symbol, callee.range, callee.name);
        return {
          name: callee.name,
          parameters: symbol.type.parameters.map((type, index) => ({ name: `arg${index + 1}`, type })),
          returnType: symbol.type.returnType,
          minArguments: symbol.type.minArguments,
        };
      }

      this.diagnostics.error(callee.range, `function '${callee.name}' was not declared in this scope`);
      return null;
    }

    if (callee.kind === 'MemberExpression' && callee.object.kind === 'IdentifierExpression') {
      const moduleName = callee.object.name;
      const module = this.stdlib.getModule(moduleName);
      if (module) {
        this.markSemanticToken('namespace', callee.object.range, ['defaultLibrary']);
        this.markSemanticToken('function', callee.nameRange, ['defaultLibrary']);
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
        this.markSemanticToken('namespace', callee.object.range);
        this.markSemanticToken('function', callee.nameRange);
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
        this.markSemanticToken('namespace', callee.object.range);
        this.markSemanticToken('function', callee.nameRange);
        return { name: callee.name, parameters: [], returnType: ANY_TYPE, variadic: true, variadicTypes: [ANY_TYPE] };
      }

      const classInfo = this.classes.get(moduleName);
      if (classInfo) {
        this.markSemanticToken('class', callee.object.range);
        this.markSemanticToken('method', callee.nameRange, ['static']);
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
        this.markSemanticToken('method', callee.nameRange);
        const method = this.stringMethodSpec(callee.name);
        if (method) return method;
        this.diagnostics.error(callee.range, `type 'string' has no method '${callee.name}'`);
        return null;
      }
      if (objectType.kind === 'array') {
        this.markSemanticToken('method', callee.nameRange);
        const method = this.arrayMethodSpec(objectType, callee.name);
        if (method) return method;
        this.reportUnknownArrayMethod(objectType, callee.name, callee.range);
        return null;
      }
      if (objectType.kind === 'class') {
        this.markSemanticToken('method', callee.nameRange);
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
      if (method) {
        this.markSemanticToken('method', callee.nameRange, ['defaultLibrary']);
        return method;
      }
      this.diagnostics.error(callee.range, `type '${typeToString(objectType)}' has no method '${callee.name}'`);
      return null;
    }

    this.diagnostics.error(callee.range, 'only function and method calls are supported in this compiler slice');
    return null;
  }

  private checkArguments(expression: CallExpression, fn: FunctionSpec): void {
    this.checkArgumentList(expression.args, fn, expression.range);
  }

  private checkArgumentList(args: readonly CallArgument[], fn: FunctionSpec, range: SourceRange): void {
    for (const arg of args) {
      if (arg.nameRange) this.markSemanticToken('parameter', arg.nameRange);
    }
    const minArguments = fn.minArguments ?? fn.parameters.length;
    const maxArguments = fn.parameters.length;

    const { resolved, providedCount, positionalCount } = this.resolveArguments(args, fn, range);
    const hasNamedArguments = args.some((arg) => arg.name !== null);

    if (!fn.variadic && positionalCount > maxArguments) {
      this.diagnostics.error(
        range,
        `'${fn.name}' expects ${argumentCountText(minArguments, maxArguments)} arguments, got ${args.length}`,
      );
    } else if (!fn.variadic && !hasNamedArguments && args.length < minArguments) {
      this.diagnostics.error(
        range,
        `'${fn.name}' expects ${argumentCountText(minArguments, maxArguments)} arguments, got ${args.length}`,
      );
    } else if (!fn.variadic) {
      for (let i = 0; i < minArguments; i++) {
        if (!resolved.some((item) => item.parameterIndex === i)) {
          this.diagnostics.error(range, `'${fn.name}' missing required argument '${fn.parameters[i].name}'`);
        }
      }
      if (providedCount > maxArguments) {
        this.diagnostics.error(
          range,
          `'${fn.name}' expects ${argumentCountText(minArguments, maxArguments)} arguments, got ${args.length}`,
        );
      }
    }

    if (fn.variadic && args.length < minArguments) {
      this.diagnostics.error(
        range,
        `'${fn.name}' expects at least ${minArguments} arguments, got ${args.length}`,
      );
    }

    for (const item of resolved) {
      const argType = this.expressionType(item.arg.value);
      const parameter = item.parameter;
      if (parameter) {
        if (parameter.acceptedTypes) {
          const accepts = parameter.acceptedTypes.some((candidate) => this.canAssign(candidate, argType));
          if (!accepts) {
            this.diagnostics.error(
              item.arg.range,
              this.argumentTypeError(fn, item, parameter.acceptedDescription ?? parameter.acceptedTypes.map(typeToString).join(' or '), argType),
            );
          }
          continue;
        }

        if (!this.canAssign(parameter.type, argType)) {
          this.diagnostics.error(
            item.arg.range,
            this.argumentTypeError(fn, item, `'${typeToString(parameter.type)}'`, argType),
          );
        }
        continue;
      }

      if (fn.variadicTypes && !fn.variadicTypes.some((candidate) => this.canAssign(candidate, argType))) {
        this.diagnostics.error(
          item.arg.range,
          `'${fn.name}' does not accept argument of type '${typeToString(argType)}'`,
        );
      }
    }
  }

  private resolveArguments(
    args: readonly CallArgument[],
    fn: FunctionSpec,
    range: SourceRange,
  ): {
    readonly resolved: Array<{
      readonly arg: CallArgument;
      readonly parameter: ParameterSpec | null;
      readonly parameterIndex: number | null;
      readonly argumentIndex: number;
    }>;
    readonly providedCount: number;
    readonly positionalCount: number;
  } {
    const resolved: Array<{
      readonly arg: CallArgument;
      readonly parameter: ParameterSpec | null;
      readonly parameterIndex: number | null;
      readonly argumentIndex: number;
    }> = [];
    const assigned = new Map<number, CallArgument>();
    let sawNamed = false;
    let positionalCount = 0;

    for (let argumentIndex = 0; argumentIndex < args.length; argumentIndex++) {
      const arg = args[argumentIndex];
      if (arg.name !== null) {
        sawNamed = true;
        if (fn.variadic) {
          this.diagnostics.error(arg.range, `'${fn.name}' does not support named arguments`);
          resolved.push({ arg, parameter: null, parameterIndex: null, argumentIndex });
          continue;
        }

        const parameterIndex = fn.parameters.findIndex((parameter) => parameter.name === arg.name);
        if (parameterIndex < 0) {
          this.diagnostics.error(arg.range, `'${fn.name}' has no argument named '${arg.name}'`);
          resolved.push({ arg, parameter: null, parameterIndex: null, argumentIndex });
          continue;
        }

        if (assigned.has(parameterIndex)) {
          this.diagnostics.error(arg.range, `'${fn.name}' argument '${arg.name}' was already provided`);
        }
        assigned.set(parameterIndex, arg);
        resolved.push({ arg, parameter: fn.parameters[parameterIndex], parameterIndex, argumentIndex });
        continue;
      }

      if (sawNamed) {
        this.diagnostics.error(arg.range, 'positional argument cannot follow named argument');
      }

      const parameterIndex = positionalCount;
      positionalCount += 1;
      const parameter = fn.parameters[parameterIndex] ?? null;
      if (parameter && assigned.has(parameterIndex)) {
        this.diagnostics.error(arg.range, `'${fn.name}' argument '${parameter.name}' was already provided`);
      }
      if (parameter) assigned.set(parameterIndex, arg);
      resolved.push({ arg, parameter, parameterIndex: parameter ? parameterIndex : null, argumentIndex });
    }

    return {
      resolved,
      providedCount: assigned.size,
      positionalCount,
    };
  }

  private orderedArguments(args: readonly CallArgument[], fn: FunctionSpec): CallArgument[] {
    if (!args.some((arg) => arg.name !== null)) return [...args];
    const ordered = new Array<CallArgument | null>(fn.parameters.length).fill(null);
    let positionalIndex = 0;

    for (const arg of args) {
      if (arg.name !== null) {
        const parameterIndex = fn.parameters.findIndex((parameter) => parameter.name === arg.name);
        if (parameterIndex >= 0) ordered[parameterIndex] = arg;
        continue;
      }
      if (positionalIndex < ordered.length) ordered[positionalIndex] = arg;
      positionalIndex += 1;
    }

    return ordered.filter((arg): arg is CallArgument => arg !== null);
  }

  private argumentTypeError(
    fn: FunctionSpec,
    item: { readonly arg: CallArgument; readonly parameter: ParameterSpec | null; readonly argumentIndex: number },
    expected: string,
    actual: TypeRef,
  ): string {
    const label = item.arg.name ? `argument '${item.arg.name}'` : `argument ${item.argumentIndex + 1}`;
    return `'${fn.name}' ${label} expects ${expected}, got '${typeToString(actual)}'`;
  }

  private memberType(expression: MemberExpression): TypeRef {
    if (expression.object.kind === 'IdentifierExpression') {
      const moduleName = expression.object.name;
      const module = this.stdlib.getModule(moduleName);
      if (module) {
        this.markSemanticToken('namespace', expression.object.range, ['defaultLibrary']);
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(expression.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return ERROR_TYPE;
        }
        const constant = module.constants.get(expression.name);
        if (constant) {
          this.markSemanticToken('variable', expression.nameRange, ['readonly', 'defaultLibrary']);
          return constant.type;
        }
        const fn = module.functions.get(expression.name);
        if (fn) {
          this.markSemanticToken('function', expression.nameRange, ['defaultLibrary']);
          return functionType(fn.parameters.map((param) => param.type), fn.returnType);
        }
        if (module.types.has(expression.name)) {
          this.markSemanticToken('class', expression.nameRange, ['defaultLibrary']);
          return ERROR_TYPE;
        }
        this.diagnostics.error(expression.range, `'${moduleName}' has no member '${expression.name}'`);
        return ERROR_TYPE;
      }

      const userModule = this.userModuleRegistry.getModule(moduleName);
      if (userModule) {
        this.markSemanticToken('namespace', expression.object.range);
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(expression.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return ERROR_TYPE;
        }

        const constant = userModule.constants.get(expression.name);
        if (constant) {
          this.markSemanticToken('variable', expression.nameRange, ['readonly']);
          return constant.type;
        }

        const fn = userModule.functions.get(expression.name);
        if (fn) {
          this.markSemanticToken('function', expression.nameRange);
          return functionType(fn.parameters.map((param) => param.type), fn.returnType);
        }
        if (userModule.classes.has(expression.name)) {
          this.markSemanticToken('class', expression.nameRange);
          return ERROR_TYPE;
        }

        this.diagnostics.error(expression.range, `module '${moduleName}' has no member '${expression.name}'`);
        return ERROR_TYPE;
      }

      if (this.userModules.has(moduleName)) {
        this.markSemanticToken('namespace', expression.object.range);
        this.markSemanticToken('property', expression.nameRange);
        return ANY_TYPE;
      }

      const classInfo = this.classes.get(moduleName);
      if (classInfo) {
        this.markSemanticToken('class', expression.object.range);
        const method = classInfo.methods.get(expression.name);
        if (method) {
          this.markSemanticToken('method', expression.nameRange, ['static']);
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
      if (method) {
        this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
        return functionType(method.parameters.map((param) => param.type), method.returnType);
      }
      this.diagnostics.error(expression.range, `type 'string' has no member '${expression.name}'`);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'array') {
      const method = this.arrayMethodSpec(objectType, expression.name);
      if (method) {
        this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
        return functionType(method.parameters.map((param) => param.type), method.returnType);
      }
      this.reportUnknownArrayMethod(objectType, expression.name, expression.range);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'class') {
      const field = this.getClassField(objectType.name, expression.name);
      if (field) {
        this.markSemanticToken('property', expression.nameRange);
        this.checkClassMemberAccess(field, expression.range);
        return field.type;
      }

      const method = this.getClassMethodInfo(objectType.name, expression.name);
      if (method) {
        this.markSemanticToken('method', expression.nameRange);
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
    if (property) {
      this.markSemanticToken('property', expression.nameRange, ['defaultLibrary']);
      return property.type;
    }

    const method = this.stdlib.getTypeMethod(objectType, expression.name);
    if (method) {
      this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
      return functionType(method.parameters.map((param) => param.type), method.returnType);
    }

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

    if (value.kind === 'null' && this.stdlib.typeAcceptsNull(target)) {
      return true;
    }

    if (target.kind === 'class' && value.kind === 'class') {
      return this.classExtends(value.name, target.name);
    }

    if (target.kind === 'qualified' && value.kind === 'qualified') {
      return this.stdlib.typeExtends(value, target);
    }

    if (target.kind === 'array' && value.kind === 'array') {
      const sizeMatches = target.dynamic || value.dynamic || target.size === value.size;
      return sizeMatches && this.canAssign(target.elementType, value.elementType);
    }

    return false;
  }

  private markSemanticToken(
    kind: IdylliumSemanticTokenKind,
    range: SourceRange,
    modifiers: readonly IdylliumSemanticTokenModifier[] = [],
  ): void {
    this.semanticTokens.push({ kind, range, modifiers: [...modifiers] });
  }

  private markSymbolReference(symbol: SymbolInfo, range: SourceRange, name: string): void {
    if (name === 'this') return;
    const kind: IdylliumSemanticTokenKind = symbol.kind === 'function'
      ? 'function'
      : symbol.kind === 'parameter'
        ? 'parameter'
        : 'variable';
    this.markSemanticToken(kind, range, symbol.readonly ? ['readonly'] : []);
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
    readonly = false,
  ): void {
    const scope = this.currentScope();
    if (scope.has(name)) {
      this.diagnostics.error(range, `'${name}' is already declared in this scope`);
      return;
    }
    scope.set(name, { type, kind, range, readonly });
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

function deduplicateSemanticTokens(tokens: readonly IdylliumSemanticToken[]): IdylliumSemanticToken[] {
  const byRange = new Map<string, IdylliumSemanticToken>();
  for (const token of tokens) {
    const { start, end } = token.range;
    const key = `${start.file}:${start.line}:${start.column}:${end.line}:${end.column}`;
    const existing = byRange.get(key);
    if (!existing) {
      byRange.set(key, token);
      continue;
    }
    if (existing.kind !== token.kind) continue;
    byRange.set(key, {
      ...existing,
      modifiers: [...new Set([...existing.modifiers, ...token.modifiers])],
    });
  }

  return [...byRange.values()].sort((left, right) => (
    left.range.start.line - right.range.start.line
    || left.range.start.column - right.range.start.column
    || left.range.end.line - right.range.end.line
    || left.range.end.column - right.range.end.column
  ));
}

function requiredParameterCount(parameters: readonly ParameterDeclaration[]): number {
  const firstDefault = parameters.findIndex((parameter) => parameter.defaultValue !== null);
  return firstDefault < 0 ? parameters.length : firstDefault;
}
