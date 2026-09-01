import {
  AccessModifier,
  AssignmentStatement,
  BinaryExpression,
  BreakStatement,
  CallArgument,
  CallExpression,
  ClassDeclaration,
  ClassEventDeclaration,
  ClassFieldDeclaration,
  ClassMethodDeclaration,
  ContinueStatement,
  ConstructorDeclaration,
  DoWhileStatement,
  Expression,
  ExpressionStatement,
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
  TryStatement,
  TypeName,
  VariableDeclaration,
  WhileStatement,
} from './ast';
import { DiagnosticBag, SourceRange } from './diagnostics';
import { UserModuleClassSpec, UserModuleRegistry } from './modules';
import { FunctionSpec, ParameterSpec, PropertySpec, StandardLibraryRegistry, createDefaultStandardLibrary } from './stdlib/registry';
import {
  ANY_TYPE,
  BOOL,
  CHAR,
  ERROR_TYPE,
  FLOAT,
  INT,
  NULL_TYPE,
  RUNTIME_ERROR_VALUE,
  STRING,
  TypeRef,
  VOID,
  arrayType,
  classType,
  functionType,
  isAssignable,
  isIntegerLike,
  isFloatLike,
  isNumeric,
  isTypesNumeric,
  numericBinaryResult,
  primitive,
  qualified,
  sameType,
  typeToString,
} from './types';

// Кириллические буквы, неотличимые на глаз от латинских. Идентификаторы на
// кириллице легальны, поэтому смесь алфавитов в имени — не ошибка сама по
// себе; но когда имя «не объявлено», двойник по этой таблице — почти
// наверняка настоящая причина.
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p',
  с: 'c', т: 't', у: 'y', х: 'x',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P',
  С: 'C', Т: 'T', У: 'Y', Х: 'X',
};

function normalizeHomoglyphs(name: string): string {
  let result = '';
  for (const char of name) {
    result += HOMOGLYPHS[char] ?? char;
  }
  return result;
}

/** Контракты сравнения: одна форма (public, нестатический, один параметр
 *  своего класса, bool) — три имени. less обслуживает '<' и '>=',
 *  greater — '>' и '<=' (вердикт владельца 2026-09-01: пара, не один метод). */
const COMPARISON_CONTRACT_NAMES = ['equals', 'less', 'greater'] as const;
type ComparisonContractName = (typeof COMPARISON_CONTRACT_NAMES)[number];

export interface SemanticResult {
  readonly success: boolean;
  readonly diagnostics: DiagnosticBag;
  readonly tokens: readonly IdylliumSemanticToken[];
  /** Типы, вычисленные для узлов AST, — единственный источник типов для кодогена. */
  readonly nodeTypes: ReadonlyMap<Expression, TypeRef>;
  /** Классы (по коротким именам), объявившие контракт equals, — кодогену для статической диспетчеризации '=='. */
  readonly equalsContractClasses: ReadonlySet<string>;
  readonly lessContractClasses: ReadonlySet<string>;
  readonly greaterContractClasses: ReadonlySet<string>;
  /** «Пустые поля» по классам (короткое имя → имена полей) — кодогену для охраняемых чтений. */
  readonly nullableClassFields: ReadonlyMap<string, ReadonlySet<string>>;
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

// Единственный источник истины для легенды семантических токенов:
// расширение VS Code и Web IDE строят свои легенды из этих массивов.
export const IDYLLIUM_SEMANTIC_TOKEN_TYPES: readonly IdylliumSemanticTokenKind[] = [
  'namespace', 'class', 'function', 'method', 'property', 'variable', 'parameter',
];

export const IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS: readonly IdylliumSemanticTokenModifier[] = [
  'declaration', 'readonly', 'static', 'defaultLibrary',
];

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
  /** Значение целочисленной константы, если оно вычислимо на компиляции. */
  constantValue?: number;
  /** Имя — для предупреждения о неиспользованной переменной при закрытии скоупа. */
  name?: string;
  /** Хоть одно обращение по имени после объявления. */
  used?: boolean;
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
  /** «Пустое поле»: объектное поле с явным `= null` — может быть пустым по замыслу автора класса. */
  readonly nullable?: boolean;
  /** Статическое поле — одно на класс, доступ по имени класса. */
  readonly isStatic?: boolean;
  /** Класс-константа: const в теле класса, присваивание запрещено. */
  readonly isConst?: boolean;
  /** Значение целочисленной класс-константы — годится размером массива. */
  readonly constantValue?: number;
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
  readonly events: Map<string, FunctionSpec>;
  readonly eventAccess: Map<string, UserMethodAccess>;
  readonly ownFields: Set<string>;
  readonly ownMethods: Set<string>;
  readonly ownEvents: Set<string>;
  constructorSpec: FunctionSpec | null;
  constructorDeclaration: ConstructorDeclaration | null;
  constructorAccess: AccessModifier;
  constructorOwner: string;
  membersRegistered: boolean;
  membersRegistering: boolean;
  /** База-виджет из белого списка (extends gui.Button): члены берутся из stdlib-реестра. */
  builtinBase?: TypeRef;
}

/** Виджеты, от которых можно наследовать свой класс (вердикт владельца
 *  2026-08-22). Window/Canvas/Timer/диалоги живут в state-списках рантайма
 *  своей жизнью — им наследники не положены. */
const EXTENDABLE_WIDGETS = new Set([
  'Button', 'Label', 'Frame', 'CheckBox', 'RadioButton', 'LineEdit',
  'TextEdit', 'ProgressBar', 'Slider', 'SpinBox', 'ComboBox', 'ImageBox',
]);

/** Библиотечные типы, у которых текстовый вид есть, но реестр о нём молчит:
 *  рантайм вешает to_string прямо на объект (runtime.ts), а colors.Color
 *  печатается своим кодом (#010203 — класс IdylliumColor). Список сверяется
 *  с рантаймом смоуком «printable library types match the runtime» — если в
 *  библиотеке появится новый тип с to_string, тест назовёт его.
 *  Остальные объекты библиотеки печати не подлежат: раньше в консоль уезжало
 *  JS-нутро '[object Object]'. Ячейки types.* и типы с to_string в реестре
 *  (time.stamp, json/sqlite.Value) разрешены своими признаками. */
const PRINTABLE_LIBRARY_OBJECTS = new Set([
  'colors.Color',
  'turtle.Turtle',
  'image.Vector',
  'gui.Canvas', 'gui.Table', 'gui.BarChart', 'gui.LineChart', 'gui.PieChart',
  'channel.Post',
  'web.Server', 'web.Request', 'web.Response',
  'http.Response',
]);

interface ClassContext {
  readonly className: string;
  readonly isStatic: boolean;
  readonly inConstructor: boolean;
}

export class SemanticAnalyzer {
  private readonly diagnostics = new DiagnosticBag();
  private readonly semanticTokens: IdylliumSemanticToken[] = [];
  private readonly nodeTypes = new Map<Expression, TypeRef>();
  private readonly imports = new Set<string>();
  private readonly moduleInheritanceDone = new Set<string>();
  private readonly userModules = new Set<string>();
  private readonly scopes: Array<Map<string, SymbolInfo>> = [new Map()];
  private readonly functions = new Map<string, FunctionDeclaration>();
  private readonly classes = new Map<string, UserClassInfo>();
  /** Короткие имена классов с контрактом equals (локальные и импортированные модульные). */
  private readonly equalsContractClasses = new Set<string>();
  private readonly lessContractClasses = new Set<string>();
  private readonly greaterContractClasses = new Set<string>();
  /** «Пустые поля» по классам (короткое имя → поля с явным `= null`). */
  private readonly nullableClassFields = new Map<string, Set<string>>();
  // Значения файловых int-констант: собираются до анализа сигнатур, чтобы
  // array<int, L> работал в параметрах функций и полях классов.
  private readonly fileConstants = new Map<string, number>();
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

    this.collectFileConstants(program);

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

    this.checkEndlessDefaultChains(program);

    for (const declaration of program.declarations) {
      if (declaration.kind === 'FunctionDeclaration') {
        this.registerFunction(declaration);
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === 'VariableDeclaration') {
        this.analyzeVariableDeclaration(declaration, 'variable');
      }
    }

    // Тела методов и конструкторов анализируются ПОСЛЕ объявления файловых
    // переменных и констант: методы классов, как и глобальные функции,
    // должны видеть const W = 60 и прочие top-level символы.
    for (const declaration of program.declarations) {
      if (declaration.kind === 'ClassDeclaration') {
        this.analyzeClassDeclaration(declaration);
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
      nodeTypes: this.nodeTypes,
      equalsContractClasses: this.equalsContractClasses,
      lessContractClasses: this.lessContractClasses,
      greaterContractClasses: this.greaterContractClasses,
      nullableClassFields: this.nullableClassFields,
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
          isStatic: field.isStatic,
          isConst: field.isConst,
          constantValue: field.constantValue,
          nullable: field.nullable === true,
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

      const events = new Map<string, FunctionSpec>();
      const eventAccess = new Map<string, UserMethodAccess>();
      for (const event of classSpec.events ?? []) {
        events.set(event.name, event.spec);
        eventAccess.set(event.name, {
          name: event.name,
          owner: event.owner,
          access: event.access,
          isStatic: false,
          range: event.range,
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
        events,
        eventAccess,
        ownFields: new Set(fields.keys()),
        ownMethods: new Set(methods.keys()),
        ownEvents: new Set(events.keys()),
        constructorSpec: classSpec.constructorSpec,
        constructorDeclaration: null,
        constructorAccess: classSpec.constructorAccess,
        constructorOwner: classSpec.qualifiedName,
        membersRegistered: true,
        membersRegistering: false,
      });
    }

    // Второй проход: наследство внутри модуля. Зеркало несёт только СВОИ члены
    // класса, а снаружи потомок обязан выглядеть ровно так же, как внутри
    // модуля — иначе публичные поля/методы базы «пропадают», а виджет-наследник
    // перестаёт быть виджетом (add_child отказывал). Проход по модулю —
    // ровно один раз: он умеет звать себя для чужих модулей.
    if (this.moduleInheritanceDone.has(moduleName)) return;
    this.moduleInheritanceDone.add(moduleName);
    for (const classSpec of module.classes.values()) {
      if (!classSpec.baseName) continue;
      const info = this.classes.get(classSpec.qualifiedName);
      if (!info || info.declaration.members.length > 0) continue;
      this.inheritImportedModuleClass(info, classSpec.baseName, new Set([classSpec.qualifiedName]));
    }
  }

  // Тянет члены базы в зеркало импортированного класса: база может быть другим
  // классом модуля (рекурсивно — дед тоже), классом иного модуля или виджетом.
  private inheritImportedModuleClass(info: UserClassInfo, baseName: string, guard: Set<string>): void {
    if (guard.has(baseName)) return;
    guard.add(baseName);

    if (baseName.startsWith('gui.')) {
      const widgetName = baseName.slice(4);
      if (EXTENDABLE_WIDGETS.has(widgetName)) info.builtinBase = qualified('gui', widgetName);
      return;
    }

    // База из ЧУЖОГО модуля — подтягиваем его зеркало. Свой модуль повторно не
    // трогаем: несуществующая база внутри модуля так роняла компилятор в
    // бесконечную рекурсию (улов ломателей).
    const dot = baseName.indexOf('.');
    const baseModuleName = dot > 0 ? baseName.slice(0, dot) : '';
    if (baseModuleName !== '' && !this.classes.has(baseName)) {
      this.registerImportedModuleClasses(baseModuleName);
    }
    const baseInfo = this.classes.get(baseName);
    if (!baseInfo) return;

    const baseSpecName = baseInfo.declaration.baseName;
    if (baseSpecName && !baseInfo.builtinBase) {
      this.inheritImportedModuleClass(baseInfo, baseSpecName, guard);
    }
    this.inheritClassMembers(info, baseInfo);
    if (baseInfo.builtinBase) info.builtinBase = baseInfo.builtinBase;
  }

  private registerFunction(declaration: FunctionDeclaration): void {
    this.markSemanticToken('function', declaration.nameRange, ['declaration']);
    if (this.functions.has(declaration.name)) {
      this.diagnostics.error(declaration.range, `function '${declaration.name}' is already declared`);
      return;
    }

    // Свою функцию нельзя назвать 'parent': в конструкторе наследника это имя
    // — вызов конструктора базы, и файловая функция создавала бы
    // двусмысленность (вызов уходил бы то в базу, то в функцию). Проверка
    // живёт здесь, а не в checkReservedName: служебное объявление самого
    // parent в скоупе конструктора должно проходить свободно.
    if (declaration.name === 'parent') {
      this.diagnostics.error(declaration.nameRange, `function 'parent' conflicts with the base class constructor call`);
      return;
    }

    if (!this.checkReservedName(declaration.name, 'function', declaration.nameRange)) return;

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
    if (this.refuseInternalName(declaration.name, 'class', declaration.range)) return;
    if (this.classes.has(declaration.name)) {
      this.diagnostics.error(declaration.range, `class '${declaration.name}' is already declared`);
      return;
    }

    if (this.stdlib.hasModule(declaration.name)) {
      this.diagnostics.error(declaration.range, `class '${declaration.name}' conflicts with a standard library module`);
      return;
    }

    // Имя подключённого пользовательского модуля закрыто и для классов —
    // по той же причине, что и библиотечное.
    if (this.imports.has(declaration.name)) {
      this.diagnostics.error(declaration.range, `class '${declaration.name}' conflicts with the module '${declaration.name}'`);
      return;
    }

    if (this.stdlib.getGlobalFunction(declaration.name)) {
      this.diagnostics.error(declaration.range, `class '${declaration.name}' conflicts with a built-in function`);
      return;
    }

    this.classes.set(declaration.name, {
      declaration,
      fields: new Map(),
      methods: new Map(),
      methodDeclarations: new Map(),
      methodAccess: new Map(),
      events: new Map(),
      eventAccess: new Map(),
      ownFields: new Set(),
      ownMethods: new Set(),
      ownEvents: new Set(),
      constructorSpec: null,
      constructorDeclaration: null,
      constructorAccess: 'public',
      constructorOwner: declaration.name,
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
      if (baseInfo) {
        this.registerClassMembers(baseInfo.declaration);
        this.inheritClassMembers(info, baseInfo);
      } else if (declaration.baseName.startsWith('gui.')) {
        const widgetName = declaration.baseName.slice(4);
        if (!this.imports.has('gui')) {
          // Виджетная база — такое же обращение к модулю, как 'gui.Button b;'.
          this.diagnostics.error(declaration.baseNameRange ?? declaration.range, "'gui' is not imported (use 'use gui;')");
        } else if (EXTENDABLE_WIDGETS.has(widgetName)) {
          info.builtinBase = qualified('gui', widgetName);
        } else {
          this.diagnostics.error(
            declaration.baseNameRange ?? declaration.range,
            `'${declaration.baseName}' cannot be extended — only ordinary widgets can: ${[...EXTENDABLE_WIDGETS].map((name) => `gui.${name}`).join(', ')}`,
          );
        }
      } else if (declaration.baseName.includes('.')) {
        const dot = declaration.baseName.indexOf('.');
        const moduleName = declaration.baseName.slice(0, dot);
        if (this.stdlib.getModule(moduleName)) {
          this.diagnostics.error(declaration.baseNameRange ?? declaration.range, `'${declaration.baseName}' cannot be extended — only gui widgets and your own classes can be base classes`);
        } else if (!this.imports.has(moduleName)) {
          // Тот же ответ, что и на 'zoo.Lion l;' без use: забытый импорт
          // называется забытым импортом, а не «неизвестной базой».
          this.diagnostics.error(declaration.baseNameRange ?? declaration.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
        } else {
          this.diagnostics.error(declaration.range, `unknown base class '${declaration.baseName}'`);
        }
      } else {
        this.diagnostics.error(declaration.range, `unknown base class '${declaration.baseName}'`);
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
        case 'ClassEventDeclaration':
          this.registerClassEvent(info, member);
          break;
        case 'ConstructorDeclaration':
          this.registerClassConstructor(info, member);
          break;
      }
    }
    info.membersRegistering = false;
    info.membersRegistered = true;
  }

  /**
   * Поле, тип которого (прямо, через цепочку полей, фиксированные массивы или
   * наследование) снова требует построить этот же класс, заставляет фабрику
   * умолчаний строить бесконечную цепочку объектов — рантайм взрывался бы
   * переполнением стека. Честная ошибка компиляции вместо взрыва.
   * dyn_array безопасен: его умолчание — пустой список.
   */
  private checkEndlessDefaultChains(program: Program): void {
    // Классы, которые фабрика умолчаний класса строит обязательно:
    // база (фабрика потомка зовёт фабрику базы) + собственные поля.
    const requiredClasses = (type: TypeRef, out: string[]): void => {
      if (type.kind === 'class' && this.classes.has(type.name)) out.push(type.name);
      else if (type.kind === 'array' && !type.dynamic) requiredClasses(type.elementType, out);
    };

    const reaches = (from: string, target: string, path: string[]): boolean => {
      if (path.includes(from)) return false; // чужой цикл — о нём скажет своё поле
      path.push(from);
      const info = this.classes.get(from);
      if (!info) { path.pop(); return false; }
      const next: string[] = [];
      if (info.declaration.baseName && this.classes.has(info.declaration.baseName)) {
        next.push(info.declaration.baseName);
      }
      for (const fieldName of info.ownFields) {
        const field = info.fields.get(fieldName);
        // «Пустое поле» цепочку обрывает: фабрике нечего строить.
        // Статики тоже: они живут на классе и в фабрику объекта не входят.
        if (field && field.nullable !== true && field.isStatic !== true) requiredClasses(field.type, next);
      }
      for (const candidate of next) {
        if (candidate === target) return true;
        if (reaches(candidate, target, path)) return true;
      }
      path.pop();
      return false;
    };

    for (const declaration of program.declarations) {
      if (declaration.kind !== 'ClassDeclaration') continue;
      const info = this.classes.get(declaration.name);
      if (!info) continue;
      for (const fieldName of info.ownFields) {
        const field = info.fields.get(fieldName);
        if (!field || field.nullable === true || field.isStatic === true) continue;
        const targets: string[] = [];
        requiredClasses(field.type, targets);
        for (const target of targets) {
          if (target === declaration.name) {
            this.diagnostics.error(
              field.range,
              `field '${fieldName}' of class '${declaration.name}' creates an endless chain of default objects — creating a '${declaration.name}' would create another '${declaration.name}' inside it`,
            );
            break;
          }
          const path: string[] = [];
          if (reaches(target, declaration.name, path)) {
            this.diagnostics.error(
              field.range,
              `field '${fieldName}' of class '${declaration.name}' creates an endless chain of default objects — creating a '${declaration.name}' would create a '${target}', which creates a '${declaration.name}' again`,
            );
            break;
          }
        }
      }
    }
  }

  // ВАЖНО о порядке: у локальных классов наследство приезжает ДО собственных
  // членов, а у зеркала импортированного модуля — ПОСЛЕ. Поэтому своё чужим не
  // перекрываем: иначе переопределение уезжало бы наружу с сигнатурой и
  // доступом базы (улов ломателей — 'undefined' в выводе и дыра в private).
  private inheritClassMembers(info: UserClassInfo, baseInfo: UserClassInfo): void {
    for (const [name, field] of baseInfo.fields) {
      if (info.ownFields.has(name)) continue;
      info.fields.set(name, field);
      // «Пустое поле» наследуется вместе с охраной: карта для кодогена
      // пополняется и под именем потомка — иначе доступ через окно наследника
      // обходил бы стража (находка адверсариальной проверки).
      if (field.nullable === true) {
        let set = this.nullableClassFields.get(info.declaration.name);
        if (!set) {
          set = new Set<string>();
          this.nullableClassFields.set(info.declaration.name, set);
        }
        set.add(name);
      }
    }
    for (const [name, method] of baseInfo.methods) {
      if (info.ownMethods.has(name)) continue;
      info.methods.set(name, method);
      const declaration = baseInfo.methodDeclarations.get(name);
      if (declaration) info.methodDeclarations.set(name, declaration);
      const access = baseInfo.methodAccess.get(name);
      if (access) info.methodAccess.set(name, access);
    }
    for (const [name, event] of baseInfo.events) {
      if (info.ownEvents.has(name)) continue;
      info.events.set(name, event);
      const access = baseInfo.eventAccess.get(name);
      if (access) info.eventAccess.set(name, access);
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
      if (this.refuseInternalName(field.name, 'field', field.range)) continue;
      if (info.fields.has(field.name) || info.methods.has(field.name)) {
        this.diagnostics.error(field.range, `class '${info.declaration.name}' already has member '${field.name}'`);
        continue;
      }
      const fieldClash = this.widgetMemberClash(info, field.name);
      if (fieldClash) {
        this.diagnostics.error(field.range, `'${field.name}' is already a member of ${typeToString(fieldClash)} — pick another name`);
        continue;
      }
      // «Пустое поле»: объектное поле с явным `= null` — единственная форма,
      // в которой классы принимают пустоту (модель A, spec/some_null).
      const isNullInitializer = field.initializer?.kind === 'LiteralExpression'
        && field.initializer.valueType === 'null';
      const nullable = isNullInitializer && this.userClassBareName(fieldType) !== null;
      const constantValue = declaration.isConst && field.initializer
        ? this.foldConstInt(field.initializer) ?? undefined
        : undefined;
      info.fields.set(field.name, {
        name: field.name,
        type: fieldType,
        range: field.range,
        owner: info.declaration.name,
        access: declaration.access,
        nullable,
        isStatic: declaration.isStatic,
        isConst: declaration.isConst,
        constantValue,
      });
      info.ownFields.add(field.name);
      if (nullable) {
        let set = this.nullableClassFields.get(info.declaration.name);
        if (!set) {
          set = new Set<string>();
          this.nullableClassFields.set(info.declaration.name, set);
        }
        set.add(field.name);
      }
    }
  }

  private registerClassMethod(info: UserClassInfo, declaration: ClassMethodDeclaration): void {
    this.markSemanticToken(
      'method',
      declaration.nameRange,
      declaration.isStatic ? ['declaration', 'static'] : ['declaration'],
    );
    if (this.refuseInternalName(declaration.name, 'method', declaration.range)) return;
    const inheritedField = info.fields.get(declaration.name);
    if (inheritedField && inheritedField.owner !== info.declaration.name) {
      this.diagnostics.error(declaration.range, `method '${declaration.name}' conflicts with inherited field '${inheritedField.owner}.${declaration.name}'`);
      return;
    }

    // Событие базы и метод потомка — одно имя на двоих: раньше метод молча
    // занимал место события, и запуск события уходил в чужое тело.
    const inheritedEvent = info.events.get(declaration.name);
    if (inheritedEvent && !info.ownEvents.has(declaration.name)) {
      const owner = info.eventAccess.get(declaration.name)?.owner ?? info.declaration.name;
      this.diagnostics.error(declaration.range, `method '${declaration.name}' conflicts with inherited event '${owner}.${declaration.name}'`);
      return;
    }

    const inheritedMethod = info.methods.get(declaration.name);
    const inheritedAccess = info.methodAccess.get(declaration.name);
    if (inheritedMethod && inheritedAccess && inheritedAccess.owner !== info.declaration.name) {
      // Приватный метод — внутреннее дело своего класса: подменять его снаружи
      // нельзя (иначе механика базы молча меняется под ней самой).
      if (inheritedAccess.access === 'private') {
        this.diagnostics.error(
          declaration.range,
          `method '${declaration.name}' is private in class '${inheritedAccess.owner}' and cannot be overridden — pick another name`,
        );
        return;
      }
      // Потомок не смеет прятать то, что база обещала всем: через переменную
      // базового типа такой «приватный» метод всё равно звался бы снаружи.
      if (declaration.access === 'private') {
        this.diagnostics.error(
          declaration.range,
          `method '${info.declaration.name}.${declaration.name}' cannot be private — it overrides a public method of class '${inheritedAccess.owner}'`,
        );
        return;
      }
    }

    if (inheritedMethod && !this.methodSignatureCanOverride(inheritedMethod, declaration)) {
      // Контрактное исключение: методы-контракты не наследуются, у каждого
      // класса — своя версия со СВОИМ типом параметра (equals(Cat) при
      // базовом equals(Animal) — законно). Диспетчеризация — статическая.
      if (!(declaration.name === 'equals' && this.isEqualsContractShape(info, declaration))) {
        this.diagnostics.error(declaration.range, `method '${info.declaration.name}.${declaration.name}' must match inherited method signature`);
        return;
      }
    }

    // Умолчания параметров принадлежат обещанию базы: если база разрешала звать
    // метод без аргумента, потомок обязан это разрешение сохранить — иначе вызов
    // через переменную базового типа отдавал в тело потомка пустоту. Спрашиваем
    // ПОСЛЕ сверки сигнатур: у метода с другим числом или типом параметров речь
    // не об умолчаниях, и говорить про «умолчание, которое есть в базе» было бы
    // враньём — такого параметра там нет вовсе (O39, находка методистов).
    if (inheritedMethod && inheritedAccess && inheritedAccess.owner !== info.declaration.name) {
      const required = requiredParameterCount(declaration.parameters);
      const baseRequired = inheritedMethod.minArguments ?? inheritedMethod.parameters.length;
      if (required > baseRequired) {
        const parameter = declaration.parameters[baseRequired];
        this.diagnostics.error(
          parameter?.range ?? declaration.range,
          `parameter '${parameter?.name ?? ''}' of '${info.declaration.name}.${declaration.name}' must keep the default value it has in class '${inheritedAccess.owner}' — that class allows calling '${declaration.name}' with ${baseRequired} argument${baseRequired === 1 ? '' : 's'}`,
        );
        return;
      }
    }

    if ((info.fields.has(declaration.name) && info.ownFields.has(declaration.name)) || (info.methods.has(declaration.name) && info.ownMethods.has(declaration.name))) {
      this.diagnostics.error(declaration.range, `class '${info.declaration.name}' already has member '${declaration.name}'`);
      return;
    }
    const methodClash = this.widgetMemberClash(info, declaration.name);
    if (methodClash) {
      this.diagnostics.error(declaration.range, `'${declaration.name}' is already a member of ${typeToString(methodClash)} — pick another name`);
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

    if (COMPARISON_CONTRACT_NAMES.includes(declaration.name as ComparisonContractName)
      && this.isEqualsContractShape(info, declaration)) {
      if (declaration.parameters[0].defaultValue) {
        this.diagnostics.error(declaration.parameters[0].range, `'${declaration.name}' contract parameter cannot have a default value`);
      }
      if (declaration.access === 'public') {
        this.comparisonContractSet(declaration.name as ComparisonContractName).add(info.declaration.name);
      }
    }
  }

  private comparisonContractSet(contract: ComparisonContractName): Set<string> {
    if (contract === 'less') return this.lessContractClasses;
    if (contract === 'greater') return this.greaterContractClasses;
    return this.equalsContractClasses;
  }

  /** Объявлен ли публичный контракт equals В САМОМ классе — по имени, в том
   *  числе точечному ('zoo.Lion'). Реестр коротких имён заполняется лениво,
   *  поэтому модульные классы смотрим прямо в спецификации модуля: иначе
   *  страж «контракт не наследуется» молчал через границу модуля и ученик
   *  получал рантайм-«object has no method 'equals'» (улов ломателей). */
  private classDeclaresEqualsContract(className: string, contract: ComparisonContractName = 'equals'): boolean {
    const dot = className.indexOf('.');
    if (dot > 0) {
      const moduleName = className.slice(0, dot);
      const bareName = className.slice(dot + 1);
      const classSpec = this.userModuleRegistry.getModule(moduleName)?.classes.get(bareName);
      const method = classSpec?.methods.find((item) => item.name === contract);
      return method !== undefined
        && !method.isStatic
        && method.access === 'public'
        && method.spec.parameters.length === 1
        && sameType(method.spec.returnType, BOOL);
    }
    return this.comparisonContractSet(contract).has(className);
  }

  /** Форма контракта equals: нестатический, ровно один параметр СВОЕГО класса, возвращает bool. */
  private isEqualsContractShape(info: UserClassInfo, declaration: ClassMethodDeclaration): boolean {
    if (declaration.isStatic) return false;
    if (declaration.parameters.length !== 1) return false;
    const parameterType = this.resolveTypeName(declaration.parameters[0].paramType);
    if (parameterType.kind !== 'class' || parameterType.name !== info.declaration.name) return false;
    return sameType(this.resolveTypeName(declaration.returnType), BOOL);
  }

  /** Есть ли у типа (класс или модульный класс) публичный контракт сравнения, объявленный в нём самом. */
  private typeOwnsEqualsContract(type: TypeRef, contract: ComparisonContractName = 'equals'): boolean {
    const bare = this.userClassBareName(type);
    if (!bare) return false;
    if (type.kind === 'class') {
      // Импортированный модульный класс живёт с точечным именем («hotel.Room»)
      // — контракт смотрим в реестре модуля.
      const dot = type.name.indexOf('.');
      if (dot > 0) {
        const moduleName = type.name.slice(0, dot);
        const className = type.name.slice(dot + 1);
        const classSpec = this.userModuleRegistry.getModule(moduleName)?.classes.get(className);
        const method = classSpec?.methods.find((item) => item.name === contract);
        const ok = method !== undefined
          && !method.isStatic
          && method.access === 'public'
          && method.spec.parameters.length === 1
          && sameType(method.spec.returnType, BOOL);
        if (ok) this.comparisonContractSet(contract).add(className);
        return ok;
      }
      return this.comparisonContractSet(contract).has(bare);
    }
    // Модульный класс: по спецификации модуля (короткое имя параметра —
    // модульная семантика уже проверила форму при компиляции модуля).
    if (type.kind === 'qualified' && this.userModuleRegistry.hasModule(type.moduleName)) {
      const classSpec = this.userModuleRegistry.getModule(type.moduleName)?.classes.get(type.name);
      const method = classSpec?.methods.find((item) => item.name === contract);
      const ok = method !== undefined
        && !method.isStatic
        && method.access === 'public'
        && method.spec.parameters.length === 1
        && sameType(method.spec.returnType, BOOL);
      if (ok) this.comparisonContractSet(contract).add(type.name);
      return ok;
    }
    return false;
  }

  /** Выражение-доступ к «пустому полю» (nullable): room.guest, где guest объявлен с `= null`. */
  private nullableFieldAccess(expression: Expression): boolean {
    if (expression.kind !== 'MemberExpression') return false;
    const objectType = this.nodeTypes.get(expression.object) ?? null;
    if (!objectType) return false;
    if (objectType.kind === 'class') {
      return this.classes.get(objectType.name)?.fields.get(expression.name)?.nullable === true;
    }
    if (objectType.kind === 'qualified' && this.userModuleRegistry.hasModule(objectType.moduleName)) {
      const classSpec = this.userModuleRegistry.getModule(objectType.moduleName)?.classes.get(objectType.name);
      const field = classSpec?.fields.find((item) => item.name === expression.name);
      return field?.nullable === true;
    }
    return false;
  }

  /** Короткое имя пользовательского класса (локального или модульного); null для прочих типов. */
  private userClassBareName(type: TypeRef): string | null {
    if (type.kind === 'class') return type.name;
    if (type.kind === 'qualified' && this.userModuleRegistry.hasModule(type.moduleName)) {
      return this.userModuleRegistry.getModule(type.moduleName)?.classes.has(type.name) ? type.name : null;
    }
    return null;
  }

  /** Класс-лист массива (сквозь вложенные массивы); null, если элементы — не пользовательские классы. */
  private arrayLeafClass(type: TypeRef): TypeRef | null {
    if (type.kind !== 'array') return null;
    let element: TypeRef = type.elementType;
    while (element.kind === 'array') element = element.elementType;
    return this.userClassBareName(element) !== null ? element : null;
  }

  private registerClassEvent(info: UserClassInfo, declaration: ClassEventDeclaration): void {
    this.markSemanticToken('property', declaration.nameRange, ['declaration']);

    if (this.refuseInternalName(declaration.name, 'event', declaration.range)) return;
    if (info.fields.has(declaration.name) || info.methods.has(declaration.name) || info.events.has(declaration.name)) {
      const inherited = !info.ownFields.has(declaration.name)
        && !info.ownMethods.has(declaration.name)
        && !info.ownEvents.has(declaration.name);
      this.diagnostics.error(
        declaration.range,
        inherited
          ? `event '${declaration.name}' conflicts with an inherited member`
          : `class '${info.declaration.name}' already has member '${declaration.name}'`,
      );
      return;
    }

    // Событие тоже занимает имя: 'event on_click' у наследника кнопки подменял
    // контракт клика, 'event text' — уничтожал свойство.
    const eventClash = this.widgetMemberClash(info, declaration.name);
    if (eventClash) {
      this.diagnostics.error(declaration.range, `'${declaration.name}' is already a member of ${typeToString(eventClash)} — pick another name`);
      return;
    }

    const parameters = declaration.parameters.map((parameter) => this.resolveTypeName(parameter.paramType));
    info.events.set(declaration.name, {
      name: declaration.name,
      parameters: parameters.map((type, index) => ({ name: declaration.parameters[index].name, type })),
      returnType: VOID,
    });
    info.eventAccess.set(declaration.name, {
      name: declaration.name,
      owner: info.declaration.name,
      access: declaration.access,
      isStatic: false,
      range: declaration.range,
    });
    info.ownEvents.add(declaration.name);
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
    info.constructorAccess = declaration.access;
  }

  private analyzeClassDeclaration(declaration: ClassDeclaration): void {
    const info = this.classes.get(declaration.name);
    if (!info) return;

    const seenStatics = new Set<string>();
    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        this.analyzeClassFieldInitializers(info, member, seenStatics);
      }
      if (member.kind === 'ClassMethodDeclaration') {
        this.analyzeClassMethod(info, member);
      }
      if (member.kind === 'ConstructorDeclaration') {
        this.analyzeClassConstructor(info, member);
      }
    }
  }

  private analyzeClassFieldInitializers(
    info: UserClassInfo,
    declaration: ClassFieldDeclaration,
    seenStatics: Set<string>,
  ): void {
    const fieldType = this.resolveTypeName(declaration.declaredType);
    for (const field of declaration.fields) {
      if (declaration.isStatic && field.initializer) {
        this.checkStaticInitializerReferences(field.initializer, info, seenStatics, field.name);
      }
      if (declaration.isStatic) seenStatics.add(field.name);
      if (!field.initializer) continue;
      this.pushClassContext(info.declaration.name, declaration.isStatic);
      this.pushScope();
      // У статических полей и класс-констант нет объекта — this не объявляем.
      if (!declaration.isStatic) {
        this.declare('this', classType(info.declaration.name), 'parameter', info.declaration.range);
      }
      const initializerType = this.expressionType(field.initializer);
      const nullableField = info.fields.get(field.name)?.nullable === true
        && initializerType.kind === 'null';
      if (!nullableField && !this.canAssign(fieldType, initializerType)) {
        this.diagnostics.error(
          field.initializer.range,
          `cannot assign '${typeToString(initializerType)}' value to '${typeToString(fieldType)}' field`,
        );
      }
      this.popScope();
      this.popClassContext();
    }
  }

  /** Инициализаторы статиков исполняются при объявлении класса — форвард-ссылки
   *  давали бы сырой TDZ или тихий undefined (находка ломателей 2026-08-22). */
  private checkStaticInitializerReferences(
    expression: Expression,
    info: UserClassInfo,
    seenStatics: ReadonlySet<string>,
    fieldName: string,
  ): void {
    const classOrder = [...this.classes.keys()];
    const currentIndex = classOrder.indexOf(info.declaration.name);
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (typeof node !== 'object' || node === null) return;
      const kind = (node as { kind?: unknown }).kind;
      if (typeof kind !== 'string') return;
      // Тело функции-значения исполняется позже объявления класса — там можно всё.
      if (kind === 'FunctionExpression') return;
      if (kind === 'MemberExpression') {
        const member = node as Extract<Expression, { kind: 'MemberExpression' }>;
        if (member.object.kind === 'IdentifierExpression') {
          const className = member.object.name;
          if (className === info.declaration.name) {
            const target = info.fields.get(member.name);
            if (target?.isStatic && !seenStatics.has(member.name)) {
              const kindWord = target.isConst ? 'class constant' : 'static field';
              this.diagnostics.error(member.range, `${kindWord} '${className}.${member.name}' is used before its declaration — declare it above '${className}.${fieldName}'`);
            }
          } else if (this.classes.has(className)) {
            const otherIndex = classOrder.indexOf(className);
            if (otherIndex > currentIndex) {
              this.diagnostics.error(member.range, `class '${className}' is declared later in the file — move it above '${info.declaration.name}' to use '${className}.${member.name}' here`);
            }
          }
        }
      }
      if (kind === 'IdentifierExpression') {
        const identifier = node as Extract<Expression, { kind: 'IdentifierExpression' }>;
        const symbol = this.lookup(identifier.name);
        // Файловые ПЕРЕМЕННЫЕ создаются после классов — статикам они не видны.
        if (symbol && symbol.kind === 'variable' && !symbol.readonly) {
          this.diagnostics.error(identifier.range, `static initializer cannot use variable '${identifier.name}' — file variables are created after classes; use a constant`);
        }
      }
      for (const value of Object.values(node)) visit(value);
    };
    visit(expression);
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
    this.pushClassContext(info.declaration.name, false, true);
    this.pushScope();
    this.declare('this', classType(info.declaration.name), 'parameter', declaration.range);

    if (info.builtinBase) {
      // У виджета нет конструктора — parent() наследнику не положен.
      for (const call of this.findParentCalls(declaration.body)) {
        this.diagnostics.error(call.range, `${typeToString(info.builtinBase)} has no constructor — configure the widget's properties instead of calling parent()`);
      }
    } else if (info.declaration.baseName) {
      const baseInfo = this.classes.get(info.declaration.baseName);
      // База не нашлась — про неё уже сказано («unknown base class»); parent()
      // тогда не объявляем вовсе, а его вызов молчит (см. вызовной путь):
      // фантом «'parent' expects 0 arguments» только уводил бы в сторону.
      if (baseInfo) {
        // Приватный конструктор базы закрыт и для потомка: наследование — не
        // лазейка мимо 'private'.
        if (baseInfo.constructorAccess === 'private') {
          for (const call of this.findParentCalls(declaration.body)) {
            this.diagnostics.error(
              call.range,
              `constructor '${info.declaration.baseName}' is private and can only be used inside class '${baseInfo.constructorOwner}'`,
            );
          }
        }
        const baseConstructor = baseInfo.constructorSpec ?? {
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
    }

    this.analyzeParameters(declaration.parameters);

    this.analyzeStatement(declaration.body);
    this.popScope();
    this.popClassContext();
    this.returnTypes.pop();
  }

  private analyzeStatement(statement: Statement): void {
    switch (statement.kind) {
      case 'BlockStatement': {
        this.pushScope();
        let leftAbove: 'return' | 'break' | 'continue' | null = null;
        let unreachableReported = false;
        for (const child of statement.statements) {
          // Код после return/break/continue не выполнится никогда. Это
          // предупреждение, а не ошибка (вердикт владельца 2026-08-28), и оно
          // одно на блок: ругаться на каждую следующую строку — шум.
          if (leftAbove !== null && !unreachableReported) {
            unreachableReported = true;
            const reason = leftAbove === 'return'
              ? 'the function returns above'
              : leftAbove === 'break'
                ? 'the loop stops above'
                : 'the loop restarts above';
            this.diagnostics.warning(child.range, `this line can never run — ${reason}`, 'code-never-runs');
          }
          this.analyzeStatement(child);
          if (child.kind === 'ReturnStatement') leftAbove = 'return';
          else if (child.kind === 'BreakStatement') leftAbove = 'break';
          else if (child.kind === 'ContinueStatement') leftAbove = 'continue';
        }
        this.popScope();
        return;
      }
      case 'IfStatement':
        this.analyzeIfStatement(statement);
        return;
      case 'TryStatement':
        this.analyzeTryStatement(statement);
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
        this.analyzeExpressionStatement(statement);
        return;
    }
  }

  // Метод или функция без скобок: «v.info;» молча не делает ничего, а
  // «console.writeln;» и вовсе ронял рантайм. Значений-функций в языке нет,
  // поэтому функциональный тип у выражения-statement — всегда забытые скобки.
  /**
   * Библиотечный вызов, чей результат выбрасывать заведомо бессмысленно
   * (реестровый флажок resultMustBeUsed): random.shuffle возвращает копию,
   * строка-соло в питоньей привычке молча не делает ничего.
   */
  private mustUseLibraryCallName(root: CallExpression): string | null {
    const spec = this.resolveCall(root);
    if (!spec?.resultMustBeUsed) return null;
    const callee = root.callee;
    if (callee.kind === 'MemberExpression' && callee.object.kind === 'IdentifierExpression') {
      return `${callee.object.name}.${callee.name}`;
    }
    return spec.name;
  }

  private analyzeExpressionStatement(statement: ExpressionStatement): void {
    const type = this.expressionType(statement.expression);

    if (type.kind !== 'function') {
      const root = statement.expression;
      if (root.kind === 'CallExpression') {
        // Вызов работу выполняет; но если СВОЯ функция или метод вернули
        // значение, а строка его выбросила — предупреждаем. Библиотеку не
        // трогаем: db.execute("INSERT …") законно игнорирует свой Result.
        const droppedName = !sameType(type, VOID) && type.kind !== 'error'
          ? this.userCallName(root) ?? this.mustUseLibraryCallName(root)
          : null;
        if (droppedName !== null) {
          this.diagnostics.warning(
            statement.range,
            `the value returned by '${droppedName}' is not used`,
            'result-not-used',
          );
        }
      } else if (type.kind !== 'error') {
        // Выражение без единого вызова в корне: посчитано и выброшено.
        // Предупреждение, а не ошибка (вердикт владельца 2026-08-28): код,
        // который делает ничего, не наказывается — как и «a = a + 0».
        this.diagnostics.warning(statement.range, 'this line computes a value and does not use it', 'statement-does-nothing');
      }
      return;
    }

    const name = statement.expression.kind === 'MemberExpression' || statement.expression.kind === 'IdentifierExpression'
      ? statement.expression.name
      : null;
    this.diagnostics.error(
      statement.range,
      name !== null
        ? `'${name}' is not called — add '()' to call it`
        : "this expression names a function but does not call it — add '()'",
    );
  }

  /** Есть ли внутри выражения действие: вызов (эффект очевиден) или
   *  индексация (испытание границы — arr[5] может честно упасть). */
  private containsCall(expression: Expression): boolean {
    if (expression.kind === 'CallExpression' || expression.kind === 'IndexExpression') return true;
    for (const value of Object.values(expression)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'kind' in item && this.containsCall(item as Expression)) return true;
        }
      } else if (value && typeof value === 'object' && 'kind' in value && this.containsCall(value as Expression)) {
        return true;
      }
    }
    return false;
  }

  /** Имя пользовательской функции или метода класса у вызова; null для
   *  библиотеки и всего, что не удалось узнать. Нужен предупреждению о
   *  выброшенном результате: у СВОИХ функций возврат осмыслен, а библиотека
   *  сама решает, обязателен ли её результат. */
  private userCallName(call: Extract<Expression, { kind: 'CallExpression' }>): string | null {
    const callee = call.callee;
    if (callee.kind === 'IdentifierExpression') {
      return this.functions.has(callee.name) ? callee.name : null;
    }
    if (callee.kind === 'MemberExpression') {
      const objectType = this.nodeTypes.get(callee.object);
      if (objectType?.kind === 'class' && this.getClassMethodInfo(objectType.name, callee.name)) {
        return callee.name;
      }
      // Функция ПОЛЬЗОВАТЕЛЬСКОГО модуля — такая же своя, как локальная:
      // mathmod.calc() с выброшенным результатом варнится (улов ломателей).
      if (callee.object.kind === 'IdentifierExpression'
        && this.userModuleRegistry.hasModule(callee.object.name)
        && this.userModuleRegistry.getModule(callee.object.name)?.functions.has(callee.name)) {
        return callee.name;
      }
    }
    return null;
  }

  /**
   * Сравнение двух целых литералов решено ещё до запуска: `1 > 0` — всегда
   * true (хотелка владельца 2026-08-29, то же правило condition-always-same).
   * Только int-литералы: дробные ловит float-equality, строки/символы в
   * условиях детских программ не живут.
   */
  private literalComparisonVerdict(condition: Expression): boolean | null {
    if (condition.kind !== 'BinaryExpression') return null;
    const { left, right, operator } = condition;
    if (left.kind !== 'LiteralExpression' || right.kind !== 'LiteralExpression') return null;
    if (left.valueType !== 'int' || right.valueType !== 'int') return null;
    const a = BigInt(left.value as number | bigint | string);
    const b = BigInt(right.value as number | bigint | string);
    switch (operator) {
      case '==': return a === b;
      case '!=': return a !== b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
      default: return null;
    }
  }

  private warnConstantCondition(condition: Expression): void {
    const verdict = this.literalComparisonVerdict(condition);
    if (verdict === null) return;
    this.diagnostics.warning(
      condition.range,
      verdict ? 'this condition is always true' : 'this condition is always false',
      'condition-always-same',
    );
  }

  private analyzeIfStatement(statement: IfStatement): void {
    // Литеральное условие: if ничего не решает. Предупреждение, не ошибка —
    // «временно всегда включено» бывает приёмом отладки.
    if (statement.condition.kind === 'LiteralExpression' && statement.condition.valueType === 'bool') {
      this.diagnostics.warning(
        statement.condition.range,
        statement.condition.value === true ? 'this condition is always true' : 'this condition is always false',
        'condition-always-same',
      );
    }
    this.warnConstantCondition(statement.condition);
    this.expectBoolCondition(statement.condition, 'if condition');
    this.analyzeStatement(statement.thenBranch);
    if (statement.elseBranch) {
      this.analyzeStatement(statement.elseBranch);
    }
  }

  private analyzeTryStatement(statement: TryStatement): void {
    this.analyzeStatement(statement.tryBlock);

    if (statement.catchClause) {
      this.pushScope();
      if (statement.catchClause.name && statement.catchClause.nameRange) {
        this.markSemanticToken('variable', statement.catchClause.nameRange, ['declaration', 'readonly']);
        this.declare(
          statement.catchClause.name,
          RUNTIME_ERROR_VALUE,
          'variable',
          statement.catchClause.nameRange,
          true,
        );
      }
      this.analyzeStatement(statement.catchClause.body);
      this.popScope();
    }

    if (statement.finallyBlock) {
      this.analyzeStatement(statement.finallyBlock);
    }
  }

  private analyzeWhileStatement(statement: WhileStatement): void {
    // while (false) — тело не выполнится никогда. while (true) — законный
    // вечный цикл с break, о нём молчим.
    if (statement.condition.kind === 'LiteralExpression'
      && statement.condition.valueType === 'bool'
      && statement.condition.value === false) {
      this.diagnostics.warning(statement.condition.range, 'this condition is always false', 'condition-always-same');
    }
    this.warnConstantCondition(statement.condition);
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
        this.analyzeExpressionStatement(statement);
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
    // Имя класса — не имя переменной: кодоген обращается к классам по имени,
    // и тень превращалась бы в тихий хайджек (находка ломателей 2026-08-22).
    if (this.classes.has(statement.name)) {
      this.diagnostics.error(statement.nameRange, `name '${statement.name}' is already used by a class`);
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
      this.checkNestedArrayInitializer(declaredType, statement.initializer);
    }

    if (statement.constructorArgs) {
      this.analyzeConstructorArguments(statement, declaredType);
    }

    this.declare(statement.name, declaredType, kind, statement.range, statement.isConst);
    // Инициализатор с вызовом — не бездействие: `file.open(...)` создаёт файл,
    // `console.get_int()` читает ввод. Такую переменную «неиспользованной»
    // не объявляем, даже если её имя больше не встретится.
    if ((statement.initializer && this.containsCall(statement.initializer)) || statement.constructorArgs) {
      const declared = this.currentScope().get(statement.name);
      if (declared) declared.used = true;
    }

    // Целочисленная константа с вычислимым значением пригодна как размер
    // массива: array<int, L>.
    if (statement.isConst && statement.initializer
      && declaredType.kind === 'primitive' && declaredType.name === 'int') {
      const value = this.foldConstInt(statement.initializer);
      const symbol = this.currentScope().get(statement.name);
      if (value !== null && symbol) symbol.constantValue = value;
    }
  }

  // Вложенные ряды инициализатора сверяются с размером на компиляции — иначе
  // несоответствие доезжало бы до рантайма текстом про внутренний dyn_array,
  // которого ученик не писал (E13).
  private checkNestedArrayInitializer(declaredType: TypeRef, initializer: Expression): void {
    if (declaredType.kind !== 'array' || declaredType.dynamic) return;
    if (initializer.kind !== 'ArrayLiteralExpression') return;
    const elementType = declaredType.elementType;
    if (elementType.kind !== 'array' || elementType.dynamic || elementType.size === null) return;
    initializer.elements.forEach((element, index) => {
      if (element.kind !== 'ArrayLiteralExpression') return;
      if (element.elements.length !== elementType.size) {
        this.diagnostics.error(
          element.range,
          `row ${index + 1} of the initializer has ${element.elements.length} value${element.elements.length === 1 ? '' : 's'}, but '${typeToString(elementType)}' needs ${elementType.size}`,
        );
        return;
      }
      this.checkNestedArrayInitializer(elementType, element);
    });
  }

  private analyzeConstructorArguments(statement: VariableDeclaration, declaredType: TypeRef): void {
    // Тип, у чьего модуля есть одноимённая функция-конструктор (json.Value),
    // принимает конструкторные аргументы объявления через неё — признак
    // читается из реестра, а не из захардкоженной пары имён.
    if (declaredType.kind === 'qualified' && this.stdlib.getModuleFunction(declaredType.moduleName, declaredType.name)) {
      const constructor = this.stdlib.getModuleFunction(declaredType.moduleName, declaredType.name);
      if (constructor) this.checkArgumentList(statement.constructorArgs ?? [], constructor, statement.range);
      return;
    }

    if (declaredType.kind !== 'class') {
      this.diagnostics.error(statement.range, `constructor-style declaration requires a class type, got '${typeToString(declaredType)}'`);
      for (const arg of statement.constructorArgs ?? []) this.expressionType(arg.value);
      return;
    }

    const constructor = this.classConstructorCallSpec(declaredType.name, statement.range);
    if (constructor) this.checkArgumentList(statement.constructorArgs ?? [], constructor, statement.range);
  }

  private classConstructorCallSpec(className: string, range: SourceRange): FunctionSpec | null {
    const info = this.classes.get(className);
    if (!info) return null;

    if (
      info.constructorAccess === 'private'
      && this.currentClassName() !== info.constructorOwner
    ) {
      this.diagnostics.error(
        range,
        `constructor '${className}' is private and can only be used inside class '${info.constructorOwner}'`,
      );
    }

    if (!info.constructorSpec) {
      return {
        name: className,
        parameters: [],
        returnType: classType(className),
      };
    }

    return {
      ...info.constructorSpec,
      name: className,
      returnType: classType(className),
    };
  }

  // Сворачивает константное int-выражение: литералы, ссылки на константы,
  // унарный минус и + - * (деление всегда float — не участвует).
  private foldConstInt(expression: Expression): number | null {
    if (expression.kind === 'LiteralExpression') {
      return expression.valueType === 'int' && typeof expression.value === 'number'
        ? expression.value
        : null;
    }
    if (expression.kind === 'IdentifierExpression') {
      const symbol = this.lookup(expression.name);
      if (symbol?.constantValue !== undefined) return symbol.constantValue;
      return this.fileConstants.get(expression.name) ?? null;
    }
    if (expression.kind === 'MemberExpression' && expression.object.kind === 'IdentifierExpression') {
      // Класс-константа как компайл-время значение: Hero.MAX_LEVEL.
      const field = this.classes.get(expression.object.name)?.fields.get(expression.name);
      if (field?.isConst && field.constantValue !== undefined) return field.constantValue;
      return null;
    }
    if (expression.kind === 'UnaryExpression' && expression.operator === '-') {
      const operand = this.foldConstInt(expression.operand);
      return operand === null ? null : -operand;
    }
    if (expression.kind === 'BinaryExpression') {
      const left = this.foldConstInt(expression.left);
      const right = this.foldConstInt(expression.right);
      if (left === null || right === null) return null;
      if (expression.operator === '+') return left + right;
      if (expression.operator === '-') return left - right;
      if (expression.operator === '*') return left * right;
      return null;
    }
    return null;
  }

  private collectFileConstants(program: Program): void {
    for (const declaration of program.declarations) {
      if (declaration.kind !== 'VariableDeclaration' || !declaration.isConst) continue;
      if (declaration.declaredType.kind !== 'PrimitiveTypeName' || declaration.declaredType.name !== 'int') continue;
      if (!declaration.initializer) continue;
      const value = this.foldConstInt(declaration.initializer);
      if (value !== null) this.fileConstants.set(declaration.name, value);
    }
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
      // Размер-выражение: array<int, SIZE*SIZE>. Считаем на компиляции тем же
      // фолдером, что и одиночные константы; если посчитать нельзя — говорим
      // прямо, что именно требуется, вместо каскада про '>'.
      // Точная жалоба на размер уже сказана? Тогда общая («must be a
      // non-negative integer») — эхо, и человеку она ничего не добавляет.
      let sizeReported = false;
      if (!typeName.dynamic && typeName.sizeExpression !== null && typeName.size === null) {
        const sizeRange = typeName.sizeRange ?? typeName.range;
        const folded = this.foldConstInt(typeName.sizeExpression);
        sizeReported = true;
        if (folded === null) {
          this.diagnostics.error(
            sizeRange,
            "array size must be known before the program runs: write a number, a constant declared with 'const', or their sum, difference or product",
          );
        } else if (folded < 0) {
          this.diagnostics.error(sizeRange, `array size must be non-negative, got ${folded}`);
        } else {
          typeName.size = folded;
          sizeReported = false;
        }
      }
      if (!typeName.dynamic && typeName.sizeName !== null && typeName.size === null) {
        // Размер задан именованной константой: array<int, L> — либо
        // классовой, через точку: array<int, Hero.MAX_LEVEL>.
        const sizeRange = typeName.sizeRange ?? typeName.range;
        let symbol = null;
        let value;
        const dot = typeName.sizeName.indexOf('.');
        if (dot > 0) {
          const className = typeName.sizeName.slice(0, dot);
          const constantName = typeName.sizeName.slice(dot + 1);
          const classInfo = this.classes.get(className);
          const field = classInfo?.fields.get(constantName);
          if (classInfo && field) {
            if (!field.isConst) {
              sizeReported = true;
            this.diagnostics.error(sizeRange, `array size '${typeName.sizeName}' is not a constant — only a class constant (const) works as a size`);
              return arrayType(elementType, null, false);
            }
            if (!sameType(field.type, INT)) {
              sizeReported = true;
            this.diagnostics.error(sizeRange, `array size constant '${typeName.sizeName}' must be an int constant, got '${typeToString(field.type)}'`);
              return arrayType(elementType, null, false);
            }
            if (field.constantValue === undefined) {
              sizeReported = true;
            this.diagnostics.error(sizeRange, `array size constant '${typeName.sizeName}' must be initialized with a constant expression`);
              return arrayType(elementType, null, false);
            }
          } else if (classInfo) {
            sizeReported = true;
            this.diagnostics.error(sizeRange, `class '${className}' has no constant '${constantName}'`);
            return arrayType(elementType, null, false);
          }
          value = field?.isConst ? field.constantValue : undefined;
        } else {
          symbol = this.lookup(typeName.sizeName);
          value = symbol?.constantValue ?? this.fileConstants.get(typeName.sizeName);
        }
        if (value === undefined) {
          sizeReported = true;
          if (symbol) {
            this.diagnostics.error(
              sizeRange,
              `array size '${typeName.sizeName}' must be an integer constant declared with 'const'`,
            );
          } else {
            sizeReported = true;
            this.diagnostics.error(sizeRange, `array size constant '${typeName.sizeName}' was not declared`);
          }
        } else if (value < 0) {
          sizeReported = true;
          this.diagnostics.error(sizeRange, `array size constant '${typeName.sizeName}' must be non-negative, got ${value}`);
        } else {
          this.markSemanticToken('variable', sizeRange, ['readonly']);
          // Кодоген читает то же поле size — вписываем разрешённое значение.
          typeName.size = value;
        }
      }
      if (!sizeReported && !typeName.dynamic && (typeName.size === null || typeName.size < 0)) {
        this.diagnostics.error(typeName.range, 'array size must be a non-negative integer');
      }
      // Предел создаваемого массива (см. assertCreatableArraySize в рантайме):
      // известный на компиляции гигантский размер отклоняется здесь же.
      if (!typeName.dynamic && typeName.size !== null && typeName.size > 100_000_000) {
        this.diagnostics.error(typeName.range, `array size ${typeName.size} is too large (maximum 100000000)`);
      }
      return arrayType(elementType, typeName.size, typeName.dynamic);
    }

    if (typeName.kind === 'ClassTypeName') {
      if (!this.classes.has(typeName.name)) {
        // Не красим неизвестное имя как класс: чаще всего это недописанный
        // идентификатор, который парсер принял за тип объявления.
        this.diagnostics.error(typeName.range, `unknown class '${typeName.name}'`);
        return ERROR_TYPE;
      }
      this.markSemanticToken('class', typeName.nameRange);
      return classType(typeName.name);
    }

    // Красим только реально существующие модули и типы: недописанная строка
    // вида `win.them` тоже попадает сюда как «квалифицированный тип», и
    // безусловная раскраска превращала обычные имена в зелёные имена классов.
    const isStdlibModule = this.stdlib.hasModule(typeName.moduleName);
    const userModuleSpec = this.userModuleRegistry.getModule(typeName.moduleName);
    const isKnownModule = isStdlibModule || userModuleSpec !== undefined || this.userModules.has(typeName.moduleName);
    const isKnownType = isStdlibModule
      ? this.stdlib.hasQualifiedType(typeName.moduleName, typeName.name)
      : userModuleSpec
        ? userModuleSpec.classes.has(typeName.name)
        : this.userModules.has(typeName.moduleName);

    if (isKnownModule) {
      this.markSemanticToken('namespace', typeName.moduleNameRange, isStdlibModule ? ['defaultLibrary'] : []);
    }
    if (isKnownType) {
      this.markSemanticToken('class', typeName.nameRange, isStdlibModule ? ['defaultLibrary'] : []);
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
        // Модуль не загрузился (цикл импорта, нет файла) — причина уже названа
        // в месте use; «нет такого типа» было бы враньём: тип там есть.
        if (!this.userModuleRegistry.isUnavailable(typeName.moduleName)) {
          this.diagnostics.error(typeName.range, `module '${typeName.moduleName}' has no type '${typeName.name}'`);
        }
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
    // «a = a» ничего не делает — предупреждение того же семейства, что и
    // «a + 1;»: бездействие не запрещено, о нём предупреждают.
    if (
      statement.operator === '='
      && statement.target.kind === 'IdentifierExpression'
      && statement.value.kind === 'IdentifierExpression'
      && statement.target.name === statement.value.name
    ) {
      this.diagnostics.warning(statement.range, 'assigning a variable to itself changes nothing', 'self-assignment');
    }

    const target = this.assignmentTargetInfo(statement.target);
    const targetType = target.type;
    // Тип цели присваивания нужен кодогену (касты types.*, конверсия массивов),
    // а через expressionType цель не проходит — фиксируем явно.
    this.nodeTypes.set(statement.target, targetType);
    const valueType = this.expressionType(statement.value);
    const assignedType = statement.operator === '='
      ? valueType
      : this.compoundAssignmentType(statement.operator, targetType, valueType, statement.range);

    if (statement.operator === '=' && target.property?.callbacks) {
      this.checkCallbackAssignment(target.property, valueType, statement.value.range);
    }

    // «Пустому полю» можно присвоить null («гость выехал»); прочим — нет.
    if (assignedType.kind === 'null' && statement.operator === '='
      && statement.target.kind === 'MemberExpression' && this.nullableFieldAccess(statement.target)) {
      return;
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
        this.diagnostics.error(target.range, this.notDeclaredMessage(target.name, 'variable '));
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
        const targetClassInfo = this.classes.get(moduleName);
        const staticField = targetClassInfo?.fields.get(target.name);
        if (staticField?.isStatic) {
          this.markSemanticToken('class', target.object.range);
          this.markSemanticToken('property', target.nameRange, staticField.isConst ? ['static', 'readonly'] : ['static']);
          if (staticField.isConst) {
            this.diagnostics.error(target.range, `cannot assign to class constant '${staticField.owner}.${target.name}'`);
            return { type: staticField.type };
          }
          if (staticField.owner !== moduleName) {
            this.diagnostics.error(target.range, `static field '${staticField.owner}.${target.name}' is not inherited — write '${staticField.owner}.${target.name}'`);
            return { type: staticField.type };
          }
          this.checkClassMemberAccess(staticField, target.range);
          return { type: staticField.type };
        }
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

      // Запись в статик модульного класса: zoo.Lion.pride = ...
      const moduleStatic = this.moduleClassStaticContext(target.object);
      if (moduleStatic) {
        const { moduleName, className, classSpec } = moduleStatic;
        const qualifiedClass = `${moduleName}.${className}`;
        const field = classSpec.fields.find((item) => item.name === target.name);
        if (field?.isStatic) {
          this.markSemanticToken('property', target.nameRange, field.isConst ? ['static', 'readonly'] : ['static']);
          if (field.isConst) {
            this.diagnostics.error(target.range, `cannot assign to class constant '${qualifiedClass}.${target.name}'`);
            return { type: field.type };
          }
          if (field.access === 'private') {
            this.diagnostics.error(target.range, `member '${qualifiedClass}.${target.name}' is private and can only be used inside class '${qualifiedClass}'`);
            return { type: field.type };
          }
          return { type: field.type };
        }
        if (field) {
          this.diagnostics.error(target.range, `instance field '${qualifiedClass}.${target.name}' must be accessed through an object`);
          return { type: ERROR_TYPE };
        }
        if (classSpec.methods.some((item) => item.name === target.name)) {
          this.diagnostics.error(target.range, `cannot assign to method '${qualifiedClass}.${target.name}'`);
          return { type: ERROR_TYPE };
        }
        this.diagnostics.error(target.range, `class '${qualifiedClass}' has no member '${target.name}'`);
        return { type: ERROR_TYPE };
      }

      const objectType = this.expressionType(target.object);
      // Тип объекта уже ошибочен — ошибка отзвучала выше, эхо с '<error>' молчит.
      if (objectType.kind === 'error') return { type: ERROR_TYPE };
      if (this.isBuiltinLengthProperty(objectType, target.name)) {
        this.markSemanticToken('property', target.nameRange, ['readonly', 'defaultLibrary']);
        this.diagnostics.error(target.range, "property 'length' is read-only");
        return { type: INT };
      }
      const runtimeErrorProperty = this.runtimeErrorPropertySpec(objectType, target.name);
      if (runtimeErrorProperty) {
        this.markSemanticToken('property', target.nameRange, ['readonly', 'defaultLibrary']);
        this.diagnostics.error(target.range, `property '${target.name}' is read-only`);
        return { type: runtimeErrorProperty.type, property: runtimeErrorProperty };
      }
      if (objectType.kind === 'class') {
        const eventInfo = this.getClassEventInfo(objectType.name, target.name);
        if (eventInfo) {
          this.markSemanticToken('property', target.nameRange);
          this.checkClassMemberAccess(eventInfo.access, target.range);
          const parameterTypes = eventInfo.spec.parameters.map((parameter) => parameter.type);
          // Синтетический PropertySpec включает валидацию как у колбэков
          // виджетов: обработчик без параметров или с полной сигнатурой.
          return {
            type: ANY_TYPE,
            property: {
              name: target.name,
              type: ANY_TYPE,
              callbacks: [
                { parameters: [], returnType: VOID },
                ...(parameterTypes.length > 0 ? [{ parameters: parameterTypes, returnType: VOID }] : []),
              ],
            },
          };
        }
        const field = this.getClassField(objectType.name, target.name);
        if (!field) {
          const builtinBase = this.builtinBaseOf(objectType.name);
          const property = builtinBase ? this.stdlib.getTypeProperty(builtinBase, target.name) : undefined;
          if (property) {
            this.markSemanticToken('property', target.nameRange, ['defaultLibrary']);
            if (property.readonly) {
              this.diagnostics.error(target.range, `property '${target.name}' is read-only`);
            }
            return { type: property.type, property };
          }
          this.diagnostics.error(target.range, `type '${typeToString(objectType)}' has no field '${target.name}'`);
          return { type: ERROR_TYPE };
        }
        this.markSemanticToken('property', target.nameRange);
        if (field.isStatic) {
          const kindWord = field.isConst ? 'class constant' : 'static field';
          this.diagnostics.error(target.range, `${kindWord} '${field.owner}.${target.name}' must be accessed through class '${field.owner}'`);
          return { type: field.type };
        }
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
      if (objectType.kind === 'error') {
        this.expressionType(target.index);
        return { type: ERROR_TYPE };
      }
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
    const type = this.computeExpressionType(expression);
    this.nodeTypes.set(expression, type);
    return type;
  }

  private computeExpressionType(expression: Expression): TypeRef {
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
      case 'TryStatement':
        if (statement.finallyBlock && this.statementAlwaysReturns(statement.finallyBlock)) return true;
        if (!statement.catchClause) return this.statementAlwaysReturns(statement.tryBlock);
        return this.statementAlwaysReturns(statement.tryBlock)
          && this.statementAlwaysReturns(statement.catchClause.body);
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
    if (objectType.kind === 'error') return ERROR_TYPE;

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
      } else {
        // Голое имя модуля как значение (например, console.writeln(console))
        // раньше молча утекало в JS и печатало «[object console]».
        this.diagnostics.error(range, `module '${name}' cannot be used as a value`);
      }
      return ERROR_TYPE;
    }

    if (this.userModules.has(name)) {
      this.markSemanticToken('namespace', range);
      this.diagnostics.error(range, `module '${name}' cannot be used as a value`);
      return ERROR_TYPE;
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

    this.diagnostics.error(range, this.notDeclaredMessage(name));
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

    if (['and', 'xor', 'or'].includes(expression.operator)) {
      if (!sameType(left, BOOL) || !sameType(right, BOOL)) {
        this.diagnostics.error(expression.range, `operator '${expression.operator}' requires bool operands`);
      }
      return BOOL;
    }

    if (['==', '!='].includes(expression.operator)) {
      // Дробные почти никогда не равны в точности (0.1 + 0.2 != 0.3) —
      // предупреждаем, но не мешаем: сравнение законно.
      // Хватает ОДНОГО дробного операнда: `average == 4` сравнивает в float
      // (int повышается), и точного равенства почти никогда нет (улов
      // ломателей 2026-08-28 — классический детский случай).
      if ((isFloatLike(left) && isNumeric(right)) || (isNumeric(left) && isFloatLike(right))) {
        this.diagnostics.warning(
          expression.range,
          `two float numbers are compared with '${expression.operator}' — they are almost never exactly equal`,
          'float-equality',
        );
      }
      // «flag == true» — сравнение, которое ничего не меняет: результат и есть
      // сам flag. Только литерал true: «== false» меняет смысл, его не трогаем.
      const trueLiteral = (node: Expression): boolean => node.kind === 'LiteralExpression'
        && node.valueType === 'bool' && node.value === true;
      if (expression.operator === '=='
        && sameType(left, BOOL) && sameType(right, BOOL)
        && (trueLiteral(expression.left) || trueLiteral(expression.right))) {
        this.diagnostics.warning(expression.range, "comparing a bool with 'true' changes nothing", 'compared-with-true');
      }
      // Голый null с голым null — мёртвое выражение (всегда true/false).
      if (left.kind === 'null' && right.kind === 'null') {
        this.diagnostics.error(expression.range, "cannot compare 'null' and 'null'");
        return BOOL;
      }
      // «Пустое поле» против null — законная проверка присутствия.
      if ((left.kind === 'null' && this.nullableFieldAccess(expression.right))
        || (right.kind === 'null' && this.nullableFieldAccess(expression.left))) {
        return BOOL;
      }
      // Объекты пользовательских классов сравниваются ТОЛЬКО через контракт
      // equals; диспетчеризация статическая — контракт выбирает левый операнд.
      const leftClass = this.userClassBareName(left);
      const rightClass = this.userClassBareName(right);
      if (leftClass !== null || rightClass !== null) {
        if (leftClass === null || rightClass === null) {
          this.diagnostics.error(
            expression.range,
            `cannot compare '${typeToString(left)}' and '${typeToString(right)}'`,
          );
        } else if (!this.typeOwnsEqualsContract(left)) {
          this.diagnostics.error(
            expression.range,
            `cannot compare objects of class '${typeToString(left)}' with '${expression.operator}' — declare 'bool function equals(${typeToString(left)} other)' in class '${typeToString(left)}' and the comparison will use it${left.kind === 'class' ? this.contractShapeIssue(left.name, 'equals') : ''}`,
          );
        } else if (!sameType(left, right) && !this.canAssign(left, right)) {
          this.diagnostics.error(
            expression.range,
            `cannot compare '${typeToString(left)}' and '${typeToString(right)}' with '${expression.operator}' — '${typeToString(left)}.equals' accepts a '${typeToString(left)}', got '${typeToString(right)}'`,
          );
        }
        return BOOL;
      }
      const leftLeaf = this.arrayLeafClass(left);
      const rightLeaf = this.arrayLeafClass(right);
      if (leftLeaf !== null || rightLeaf !== null) {
        if (leftLeaf === null || rightLeaf === null
          || (!sameType(left, right) && !this.canAssign(left, right) && !this.canAssign(right, left))) {
          this.diagnostics.error(
            expression.range,
            `cannot compare '${typeToString(left)}' and '${typeToString(right)}'`,
          );
        } else if (!this.typeOwnsEqualsContract(leftLeaf)) {
          this.diagnostics.error(
            expression.range,
            `cannot compare arrays of '${typeToString(leftLeaf)}' objects with '${expression.operator}' — declare 'bool function equals(${typeToString(leftLeaf)} other)' in class '${typeToString(leftLeaf)}' and the comparison will use it`,
          );
        }
        return BOOL;
      }
      if (!sameType(left, right) && !this.canAssign(left, right) && !this.canAssign(right, left)) {
        this.diagnostics.error(
          expression.range,
          `cannot compare '${typeToString(left)}' and '${typeToString(right)}'`,
        );
      }
      return BOOL;
    }

    if (['<', '<=', '>', '>='].includes(expression.operator)) {
      // Порядок моментов времени: оба операнда time.stamp — сравнение по моменту.
      const isStamp = (type: TypeRef): boolean =>
        type.kind === 'qualified' && type.moduleName === 'time' && type.name === 'stamp';
      if (isStamp(left) && isStamp(right)) return BOOL;
      // Объекты упорядочиваются контрактами: less обслуживает '<' и '>='
      // (второй — отрицанием), greater — '>' и '<='.
      const leftOrderClass = this.userClassBareName(left);
      const rightOrderClass = this.userClassBareName(right);
      if (leftOrderClass !== null || rightOrderClass !== null) {
        const contract: ComparisonContractName =
          expression.operator === '<' || expression.operator === '>=' ? 'less' : 'greater';
        if (leftOrderClass === null || rightOrderClass === null) {
          this.diagnostics.error(
            expression.range,
            `cannot compare '${typeToString(left)}' and '${typeToString(right)}'`,
          );
        } else if (!this.typeOwnsEqualsContract(left, contract)) {
          this.diagnostics.error(
            expression.range,
            `cannot order objects of class '${typeToString(left)}' with '${expression.operator}' — declare 'bool function ${contract}(${typeToString(left)} other)' in class '${typeToString(left)}' and '${expression.operator}' will use it${left.kind === 'class' ? this.contractShapeIssue(left.name, contract) : ''}`,
          );
        } else if (!sameType(left, right) && !this.canAssign(left, right)) {
          this.diagnostics.error(
            expression.range,
            `cannot compare '${typeToString(left)}' and '${typeToString(right)}' with '${expression.operator}' — '${typeToString(left)}.${contract}' accepts a '${typeToString(left)}', got '${typeToString(right)}'`,
          );
        }
        return BOOL;
      }
      if (!isNumeric(left) || !isNumeric(right)) {
        if (expression.left.kind === 'UnaryExpression' && expression.left.operator === 'not') {
          // Жадный 'not' схватил только соседа, и сравнивается уже bool —
          // подсказываем скобки, а не жалуемся на типы (E8).
          const operand = expression.left.operand;
          const shown = operand.kind === 'IdentifierExpression' ? operand.name : '…';
          this.diagnostics.error(
            expression.range,
            `'not' takes only what stands right after it — write 'not (${shown} ${expression.operator} …)' to negate the whole comparison`,
          );
        } else {
          this.diagnostics.error(
            expression.range,
            `comparison '${expression.operator}' requires numeric operands, got '${typeToString(left)}' and '${typeToString(right)}'`,
          );
        }
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
    const resolved = this.resolveCall(expression);
    if (!resolved) {
      for (const arg of expression.args) this.expressionType(arg.value);
      return ERROR_TYPE;
    }

    this.checkArguments(expression, resolved);
    return this.ruleAdjustedReturnType(resolved, expression);
  }

  /**
   * Типовые правила из реестра (FunctionSpec.returnTypeRule) — прежние
   * спец-ветки по именам math/random/агрегатов сведены в декларативные
   * пометки спеков; здесь их единственный интерпретатор.
   */
  private ruleAdjustedReturnType(fn: FunctionSpec, expression: CallExpression): TypeRef {
    switch (fn.returnTypeRule) {
      case undefined:
        return fn.returnType;
      case 'int-without-digits':
        return expression.args.length >= 2 ? FLOAT : INT;
      case 'match-integer-argument': {
        const argument = this.orderedArguments(expression.args, fn)[0];
        if (!argument) return ERROR_TYPE;
        return isIntegerLike(this.expressionType(argument.value)) ? INT : FLOAT;
      }
      case 'int-when-all-integer-numeric': {
        const argTypes = expression.args.map((arg) => this.expressionType(arg.value));
        for (let i = 0; i < argTypes.length; i++) {
          if (!isNumeric(argTypes[i])) {
            this.diagnostics.error(
              expression.args[i].range,
              `'${fn.name}' argument ${i + 1} expects numeric value, got '${typeToString(argTypes[i])}'`,
            );
          }
        }
        return argTypes.every((type) => isIntegerLike(type)) ? INT : FLOAT;
      }
      case 'numeric-array-aggregate': {
        const argument = this.orderedArguments(expression.args, fn)[0];
        if (!argument) return ERROR_TYPE;
        const argType = this.expressionType(argument.value);
        if (argType.kind !== 'array') {
          // Не-массив уже отвергла общая приёмка по acceptedTypes реестра
          // («argument 1 expects numeric array, got …») — молчим, не дублируем.
          return ERROR_TYPE;
        }
        if (!isNumeric(argType.elementType)) {
          this.diagnostics.error(
            argument.range,
            `'${fn.name}' expects a numeric array, got '${typeToString(argType)}'`,
          );
          return ERROR_TYPE;
        }
        // Именно ссылка на ANY_TYPE: sameType с ANY совместим со всем подряд.
        return fn.returnType === ANY_TYPE ? argType.elementType : fn.returnType;
      }
      case 'element-of-collection': {
        const argument = this.orderedArguments(expression.args, fn)[0];
        if (!argument) return ERROR_TYPE;
        const collectionType = this.expressionType(argument.value);
        if (sameType(collectionType, STRING)) return CHAR;
        if (collectionType.kind === 'array') return collectionType.elementType;
        return ERROR_TYPE;
      }
      // Результат — того же типа, что аргумент-коллекция: random.shuffle
      // возвращает перемешанную копию строки/массива (fixed остаётся fixed).
      case 'same-as-argument': {
        const argument = this.orderedArguments(expression.args, fn)[0];
        if (!argument) return ERROR_TYPE;
        const argumentType = this.expressionType(argument.value);
        if (sameType(argumentType, STRING) || argumentType.kind === 'array') return argumentType;
        return ERROR_TYPE;
      }
    }
  }

  private resolveCall(expression: CallExpression): FunctionSpec | null {
    const callee = expression.callee;

    if (callee.kind === 'IdentifierExpression') {
      if (this.classes.has(callee.name)) {
        this.markSemanticToken('class', callee.range);
        return this.classConstructorCallSpec(callee.name, callee.range);
      }

      const global = this.stdlib.getGlobalFunction(callee.name);
      if (global) {
        if (this.shadowsBuiltInFunction(callee.name, callee.range)) return null;
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

      // parent(): вместо общего «функция не объявлена» — что именно не так.
      const contextClass = this.currentClassName();
      const contextInfo = contextClass !== null ? this.classes.get(contextClass) : undefined;
      if (callee.name === 'parent' && contextInfo) {
        if (contextInfo.builtinBase) {
          // В конструкторе про это уже сказано целевым текстом (banParent).
          if (!this.currentClassContext()?.inConstructor) {
            this.diagnostics.error(
              callee.range,
              `${typeToString(contextInfo.builtinBase)} has no constructor — configure the widget's properties instead of calling parent()`,
            );
          }
          return null;
        }
        const baseName = contextInfo.declaration.baseName;
        // База не нашлась — про неё уже сказано («unknown base class»).
        if (baseName && !this.classes.has(baseName)) return null;
        this.diagnostics.error(
          callee.range,
          baseName
            ? `parent() runs the constructor of the base class and can only be called in the constructor of class '${contextClass}'`
            : `class '${contextClass}' has no base class — parent() needs 'extends'`,
        );
        return null;
      }
      this.diagnostics.error(callee.range, this.notDeclaredMessage(callee.name, 'function '));
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
        if (!this.imports.has(moduleName)) {
          this.diagnostics.error(callee.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
          return null;
        }

        const classSpec = userModule.classes.get(callee.name);
        if (classSpec) {
          this.markSemanticToken('class', callee.nameRange);
          return this.classConstructorCallSpec(classSpec.qualifiedName, callee.range);
        }

        const fn = userModule.functions.get(callee.name);
        if (!fn) {
          this.diagnostics.error(callee.range, `module '${moduleName}' has no function '${callee.name}'`);
          return null;
        }
        this.markSemanticToken('function', callee.nameRange);
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
            if (access.owner !== moduleName) {
              this.diagnostics.error(callee.range, `static method '${access.owner}.${callee.name}' is not inherited — call '${access.owner}.${callee.name}()'`);
              return null;
            }
            this.checkClassMemberAccess(access, callee.range);
            return method;
          }
          this.diagnostics.error(callee.range, `instance method '${moduleName}.${callee.name}' must be called on an object`);
          return null;
        }

        const calledField = classInfo.fields.get(callee.name);
        if (calledField?.isStatic) {
          const kindWord = calledField.isConst ? 'class constant' : 'static field';
          this.diagnostics.error(callee.range, `'${moduleName}.${callee.name}' is a ${kindWord}, not a method`);
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
      // Вызов статик-метода модульного класса: zoo.Lion.roar(...)
      const moduleStatic = this.moduleClassStaticContext(callee.object);
      if (moduleStatic) {
        const { moduleName, className, classSpec } = moduleStatic;
        const qualifiedClass = `${moduleName}.${className}`;
        const method = classSpec.methods.find((item) => item.name === callee.name);
        if (method) {
          this.markSemanticToken('method', callee.nameRange, ['static']);
          if (!method.isStatic) {
            this.diagnostics.error(callee.range, `instance method '${qualifiedClass}.${callee.name}' must be called on an object`);
            return null;
          }
          if (method.access === 'private') {
            this.diagnostics.error(callee.range, `member '${qualifiedClass}.${callee.name}' is private and can only be used inside class '${qualifiedClass}'`);
            return null;
          }
          return method.spec;
        }
        const field = classSpec.fields.find((item) => item.name === callee.name);
        if (field?.isStatic) {
          const kindWord = field.isConst ? 'class constant' : 'static field';
          this.diagnostics.error(callee.range, `'${qualifiedClass}.${callee.name}' is a ${kindWord}, not a method`);
          return null;
        }
        const inherited = this.moduleBaseStaticMember(moduleName, classSpec, callee.name);
        if (inherited?.isMethod) {
          this.diagnostics.error(callee.range, `static method '${moduleName}.${inherited.ownerClass}.${callee.name}' is not inherited — call '${moduleName}.${inherited.ownerClass}.${callee.name}()'`);
          return null;
        }
        this.diagnostics.error(callee.range, `class '${qualifiedClass}' has no static method '${callee.name}'`);
        return null;
      }
      const objectType = this.expressionType(callee.object);
      if (objectType.kind === 'error') return null;
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
        if (method) {
          const leaf = this.arrayLeafClass(objectType);
          if (leaf !== null && ['contains', 'find', 'count'].includes(callee.name)
            && !this.typeOwnsEqualsContract(leaf)) {
            this.diagnostics.error(
              callee.range,
              `${callee.name}() cannot search for '${typeToString(leaf)}' objects — declare 'bool function equals(${typeToString(leaf)} other)' in class '${typeToString(leaf)}' and the search will use it`,
            );
            return null;
          }
          if (leaf !== null && callee.name === 'sort' && !this.typeOwnsEqualsContract(leaf, 'less')) {
            this.diagnostics.error(
              callee.range,
              `sort() cannot order '${typeToString(leaf)}' objects — declare 'bool function less(${typeToString(leaf)} other)' in class '${typeToString(leaf)}' and sort() will use it${leaf.kind === 'class' ? this.contractShapeIssue(leaf.name, 'less') : ''}`,
            );
            return null;
          }
          return method;
        }
        this.reportUnknownArrayMethod(objectType, callee.name, callee.range);
        return null;
      }
      if (objectType.kind === 'runtime-error') {
        this.markSemanticToken('method', callee.nameRange, ['defaultLibrary']);
        if (callee.name === 'to_string') {
          return { name: 'to_string', parameters: [], returnType: STRING };
        }
        this.diagnostics.error(callee.range, `type 'RuntimeError' has no method '${callee.name}'`);
        return null;
      }
      if (objectType.kind === 'class') {
        const eventInfo = this.getClassEventInfo(objectType.name, callee.name);
        if (eventInfo) {
          this.markSemanticToken('property', callee.nameRange);
          const context = this.classContexts.length > 0 ? this.classContexts[this.classContexts.length - 1] : null;
          const firedOnThis = callee.object.kind === 'IdentifierExpression' && callee.object.name === 'this';
          const insideOwner = context !== null && !context.isStatic
            && (context.className === eventInfo.access.owner || this.classExtends(context.className, eventInfo.access.owner));
          if (!firedOnThis || !insideOwner) {
            this.diagnostics.error(
              callee.range,
              `event '${callee.name}' can only be fired inside class '${eventInfo.access.owner}' (through 'this')`,
            );
            return null;
          }
          return eventInfo.spec;
        }
        this.markSemanticToken('method', callee.nameRange);
        const method = this.getClassMethodInfo(objectType.name, callee.name);
        if (method) {
          // Контракт equals живёт в слоте своего класса и НЕ наследуется:
          // компилятор обязан отказать сам, а не отправлять в рантайм за
          // «object has no method 'equals'» (E17, находка методистов).
          if (COMPARISON_CONTRACT_NAMES.includes(callee.name as ComparisonContractName)
            && method.access.owner !== objectType.name
            && this.classDeclaresEqualsContract(method.access.owner, callee.name as ComparisonContractName)
            && !this.classDeclaresEqualsContract(objectType.name, callee.name as ComparisonContractName)) {
            this.diagnostics.error(callee.range, `'${callee.name}' is a contract and is not inherited — declare 'bool function ${callee.name}(${objectType.name} other)' in class '${objectType.name}' and the call will use it`);
            return null;
          }
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
        const builtinBase = this.builtinBaseOf(objectType.name);
        if (builtinBase) {
          const widgetMethod = this.stdlib.getTypeMethod(builtinBase, callee.name);
          if (widgetMethod) {
            this.markSemanticToken('method', callee.nameRange, ['defaultLibrary']);
            return widgetMethod;
          }
        }
        const unimportedMethodOwner = this.unimportedOwnerModule(objectType);
        this.diagnostics.error(
          callee.range,
          unimportedMethodOwner !== null
            ? `'${unimportedMethodOwner}' is not imported (use 'use ${unimportedMethodOwner};')`
            : `type '${typeToString(objectType)}' has no method '${callee.name}'`,
        );
        return null;
      }
      const method = this.stdlib.getTypeMethod(objectType, callee.name);
      if (method) {
        this.markSemanticToken('method', callee.nameRange, ['defaultLibrary']);
        return method;
      }
      const unimportedCalleeOwner = this.unimportedOwnerModule(objectType);
      this.diagnostics.error(
        callee.range,
        unimportedCalleeOwner !== null
          ? `'${unimportedCalleeOwner}' is not imported (use 'use ${unimportedCalleeOwner};')`
          : `type '${typeToString(objectType)}' has no method '${callee.name}'`,
      );
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
      if (fn.printsValues) {
        // Функция как значение в печати — почти всегда забытые скобки;
        // без запрета консоль показала бы сгенерированный код (кухню).
        if (argType.kind === 'function') {
          const value = item.arg.value;
          const functionName = value.kind === 'IdentifierExpression'
            ? value.name
            : value.kind === 'MemberExpression' ? value.name : null;
          this.diagnostics.error(
            item.arg.range,
            functionName !== null
              ? `cannot print function '${functionName}' — add '()' with its arguments to call it and print the result`
              : "cannot print a function — add '()' with its arguments to call it and print the result",
          );
          continue;
        }
        const printableError = this.printableTypeError(argType);
        if (printableError) {
          this.diagnostics.error(item.arg.range, printableError);
          continue;
        }
      }
      const parameter = item.parameter;
      if (parameter) {
        if (parameter.exactType) {
          if (!sameType(parameter.type, argType)) {
            this.diagnostics.error(
              item.arg.range,
              this.argumentTypeError(fn, item, `'${typeToString(parameter.type)}'`, argType),
            );
          }
          continue;
        }

        if (parameter.rejectsClassObjects) {
          const classType = this.userClassBareName(argType) !== null
            ? argType
            : this.arrayLeafClass(argType);
          if (classType !== null) {
            this.diagnostics.error(
              item.arg.range,
              `json.Value() cannot wrap an object of class '${typeToString(classType)}' — build a json.Object from its fields instead`,
            );
            continue;
          }
          if (argType.kind === 'function') {
            this.diagnostics.error(
              item.arg.range,
              "json.Value() cannot wrap a function — call it with '()' and wrap the result",
            );
            continue;
          }
        }

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

  // Печать значений: объект пользовательского класса можно печатать только при
  // наличии публичного `string function to_string()` без параметров — аналог
  // __str__ из Python. Массивы объектов не печатаются даже с to_string():
  // инспекция массива синхронна и метод вызвать не может.
  private printableTypeError(type: TypeRef): string | null {
    if (type.kind === 'function') {
      return "cannot print a function — add '()' with its arguments to call it and print the result";
    }
    if (type.kind === 'class') {
      if (this.classHasPublicToString(type.name)) return null;
      return `cannot print object of class '${type.name}' directly — declare 'string function to_string()' in class '${type.name}' and printing will use it${this.contractShapeIssue(type.name, 'to_string')}`;
    }
    // Библиотечный объект без текстового вида: раньше в консоль уезжало
    // JS-нутро «[object Object]». Значения библиотеки (colors.Color,
    // time.stamp, json.Value, sqlite.Value) печатаются как печатались.
    if (type.kind === 'qualified' && this.stdlib.hasModule(type.moduleName)) {
      // Значения библиотеки печатаются собой: числовые ячейки types.*, цвет,
      // и всё, у чего в реестре есть to_string (time.stamp, json/sqlite.Value).
      if (isTypesNumeric(type)) return null;
      if (this.stdlib.getTypeMethod(type, 'to_string')) return null;
      if (PRINTABLE_LIBRARY_OBJECTS.has(typeToString(type))) return null;
      return `cannot print an object of type '${typeToString(type)}' directly — library objects have no text form; print one of its properties instead`;
    }
    if (type.kind === 'qualified' && this.userModuleRegistry.hasModule(type.moduleName)) {
      const classSpec = this.userModuleRegistry.getModule(type.moduleName)?.classes.get(type.name);
      if (!classSpec) return null;
      const method = classSpec.methods.find((item) => item.name === 'to_string');
      const printable = method !== undefined
        && !method.isStatic
        && method.access === 'public'
        && method.spec.parameters.length === 0
        && sameType(method.spec.returnType, STRING);
      return printable ? null : `cannot print object of class '${type.moduleName}.${type.name}' directly — declare 'string function to_string()' in class '${type.name}' and printing will use it`;
    }
    if (type.kind === 'array') {
      const element = type.elementType;
      // Контракт to_string элемента открывает и печать массива: рантайм
      // собирает представления элементов асинхронно (вердикт владельца
      // 2026-08-22 — симметрия со сравнением массивов через equals).
      if (element.kind === 'class') {
        if (this.classHasPublicToString(element.name)) return null;
        return `cannot print an array of '${element.name}' objects directly — declare 'string function to_string()' in class '${element.name}' and printing will use it${this.contractShapeIssue(element.name, 'to_string')}`;
      }
      if (element.kind === 'qualified' && this.userModuleRegistry.hasModule(element.moduleName)) {
        if (this.printableTypeError(element) === null) return null;
        return `cannot print an array of '${element.moduleName}.${element.name}' objects directly — declare 'string function to_string()' in class '${element.name}' and printing will use it`;
      }
      return this.printableTypeError(element);
    }
    return null;
  }

  /**
   * Почему одноимённый метод НЕ считается контрактом — хвост для диагностик.
   * Четыре разные порчи формы (private, чужой тип, не тот возврат, static)
   * давали неотличимые ошибки — методисты мерили цену в «полчаса сверки
   * по буквам» (2026-08-21).
   */
  private contractShapeIssue(className: string, methodName: 'equals' | 'less' | 'greater' | 'to_string'): string {
    const info = this.classes.get(className);
    if (!info || !info.ownMethods.has(methodName)) return '';
    const spec = info.methods.get(methodName);
    const access = info.methodAccess.get(methodName);
    const issues: string[] = [];
    if (access !== undefined && access.access !== 'public') issues.push('it is private');
    if (access !== undefined && access.isStatic) issues.push('it is static');
    if (methodName !== 'to_string') {
      if (!spec || spec.parameters.length !== 1) {
        issues.push(`it must take exactly one parameter of type '${className}'`);
      } else if (!(spec.parameters[0].type.kind === 'class' && spec.parameters[0].type.name === className)) {
        issues.push(`its parameter is '${typeToString(spec.parameters[0].type)}' instead of '${className}'`);
      }
      if (spec && !sameType(spec.returnType, BOOL)) {
        issues.push(`it returns '${typeToString(spec.returnType)}' instead of 'bool'`);
      }
    } else {
      if (spec && spec.parameters.length > 0) issues.push('it must take no parameters');
      if (spec && !sameType(spec.returnType, STRING)) {
        issues.push(`it returns '${typeToString(spec.returnType)}' instead of 'string'`);
      }
    }
    if (issues.length === 0) return '';
    return ` (class '${className}' has '${methodName}', but ${issues.join(', ')})`;
  }

  private classHasPublicToString(className: string): boolean {
    const info = this.classes.get(className);
    if (!info) return false;
    // Контракты не наследуются: to_string должен быть объявлен в самом классе.
    if (!info.ownMethods.has('to_string')) return false;
    const spec = info.methods.get('to_string');
    if (!spec || spec.parameters.length > 0) return false;
    if (!sameType(spec.returnType, STRING)) return false;
    const access = info.methodAccess.get('to_string');
    if (access === undefined) return true;
    return access.access === 'public' && !access.isStatic;
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
          this.diagnostics.error(expression.range, `type '${moduleName}.${expression.name}' cannot be used as a value`);
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
          this.diagnostics.error(expression.range, `class '${moduleName}.${expression.name}' cannot be used as a value`);
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
            if (access.owner !== moduleName) {
              this.diagnostics.error(expression.range, `static method '${access.owner}.${expression.name}' is not inherited — call '${access.owner}.${expression.name}()'`);
              return ERROR_TYPE;
            }
            this.checkClassMemberAccess(access, expression.range);
            return functionType(method.parameters.map((param) => param.type), method.returnType);
          }
          this.diagnostics.error(expression.range, `instance method '${moduleName}.${expression.name}' must be called on an object`);
          return ERROR_TYPE;
        }

        const field = classInfo.fields.get(expression.name);
        if (field) {
          if (field.isStatic) {
            this.markSemanticToken('property', expression.nameRange, field.isConst ? ['static', 'readonly'] : ['static']);
            if (field.owner !== moduleName) {
              const kindWord = field.isConst ? 'class constant' : 'static field';
              this.diagnostics.error(expression.range, `${kindWord} '${field.owner}.${expression.name}' is not inherited — write '${field.owner}.${expression.name}'`);
              return ERROR_TYPE;
            }
            this.checkClassMemberAccess(field, expression.range);
            return field.type;
          }
          this.diagnostics.error(expression.range, `instance field '${moduleName}.${expression.name}' must be accessed through an object`);
          return ERROR_TYPE;
        }

        this.diagnostics.error(expression.range, `class '${moduleName}' has no member '${expression.name}'`);
        return ERROR_TYPE;
      }
    }

    // Статики модульного класса: zoo.Lion.pride / zoo.Lion.MAX_AGE / zoo.Lion.roar
    const moduleStatic = this.moduleClassStaticContext(expression.object);
    if (moduleStatic) {
      const { moduleName, className, classSpec } = moduleStatic;
      const qualifiedClass = `${moduleName}.${className}`;
      const field = classSpec.fields.find((item) => item.name === expression.name);
      if (field) {
        if (field.isStatic) {
          this.markSemanticToken('property', expression.nameRange, field.isConst ? ['static', 'readonly'] : ['static']);
          if (field.access === 'private') {
            this.diagnostics.error(expression.range, `member '${qualifiedClass}.${expression.name}' is private and can only be used inside class '${qualifiedClass}'`);
            return ERROR_TYPE;
          }
          return field.type;
        }
        this.diagnostics.error(expression.range, `instance field '${qualifiedClass}.${expression.name}' must be accessed through an object`);
        return ERROR_TYPE;
      }
      const method = classSpec.methods.find((item) => item.name === expression.name);
      if (method) {
        this.markSemanticToken('method', expression.nameRange, ['static']);
        if (!method.isStatic) {
          this.diagnostics.error(expression.range, `instance method '${qualifiedClass}.${expression.name}' must be called on an object`);
          return ERROR_TYPE;
        }
        if (method.access === 'private') {
          this.diagnostics.error(expression.range, `member '${qualifiedClass}.${expression.name}' is private and can only be used inside class '${qualifiedClass}'`);
          return ERROR_TYPE;
        }
        return functionType(method.spec.parameters.map((param) => param.type), method.spec.returnType);
      }
      const inherited = this.moduleBaseStaticMember(moduleName, classSpec, expression.name);
      if (inherited) {
        const kindWord = inherited.isMethod ? 'static method' : inherited.isConst ? 'class constant' : 'static field';
        this.diagnostics.error(expression.range, `${kindWord} '${moduleName}.${inherited.ownerClass}.${expression.name}' is not inherited — write '${moduleName}.${inherited.ownerClass}.${expression.name}'`);
        return ERROR_TYPE;
      }
      this.diagnostics.error(expression.range, `class '${qualifiedClass}' has no member '${expression.name}'`);
      return ERROR_TYPE;
    }

    const objectType = this.expressionType(expression.object);
    if (objectType.kind === 'error') return ERROR_TYPE;
    if (this.isStringType(objectType)) {
      if (expression.name === 'length') {
        this.markSemanticToken('property', expression.nameRange, ['readonly', 'defaultLibrary']);
        return INT;
      }
      const method = this.stringMethodSpec(expression.name);
      if (method) {
        this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
        return functionType(method.parameters.map((param) => param.type), method.returnType);
      }
      this.diagnostics.error(expression.range, `type 'string' has no member '${expression.name}'`);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'array') {
      if (expression.name === 'length') {
        this.markSemanticToken('property', expression.nameRange, ['readonly', 'defaultLibrary']);
        return INT;
      }
      const method = this.arrayMethodSpec(objectType, expression.name);
      if (method) {
        this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
        return functionType(method.parameters.map((param) => param.type), method.returnType);
      }
      this.reportUnknownArrayMethod(objectType, expression.name, expression.range);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'runtime-error') {
      const property = this.runtimeErrorPropertySpec(objectType, expression.name);
      if (property) {
        this.markSemanticToken('property', expression.nameRange, ['readonly', 'defaultLibrary']);
        return property.type;
      }
      if (expression.name === 'to_string') {
        this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
        return functionType([], STRING);
      }
      this.diagnostics.error(expression.range, `type 'RuntimeError' has no member '${expression.name}'`);
      return ERROR_TYPE;
    }

    if (objectType.kind === 'class') {
      const eventInfo = this.getClassEventInfo(objectType.name, expression.name);
      if (eventInfo) {
        this.markSemanticToken('property', expression.nameRange);
        this.diagnostics.error(
          expression.range,
          `event '${expression.name}' cannot be read as a value; assign a handler or fire it inside class '${eventInfo.access.owner}'`,
        );
        return ERROR_TYPE;
      }
      const field = this.getClassField(objectType.name, expression.name);
      if (field) {
        this.markSemanticToken('property', expression.nameRange);
        if (field.isStatic) {
          const kindWord = field.isConst ? 'class constant' : 'static field';
          this.diagnostics.error(expression.range, `${kindWord} '${field.owner}.${expression.name}' must be accessed through class '${field.owner}'`);
          return ERROR_TYPE;
        }
        this.checkClassMemberAccess(field, expression.range);
        return field.type;
      }

      const method = this.getClassMethodInfo(objectType.name, expression.name);
      if (method) {
        this.markSemanticToken('method', expression.nameRange);
        if (expression.name === 'equals'
          && method.access.owner !== objectType.name
          && this.classDeclaresEqualsContract(method.access.owner)
          && !this.classDeclaresEqualsContract(objectType.name)) {
          this.diagnostics.error(expression.range, `'equals' is a contract and is not inherited — declare 'bool function equals(${objectType.name} other)' in class '${objectType.name}' and the call will use it`);
          return ERROR_TYPE;
        }
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

      // Наследник виджета: свойства и методы базы — из stdlib-реестра.
      const builtinBase = this.builtinBaseOf(objectType.name);
      if (builtinBase) {
        const property = this.stdlib.getTypeProperty(builtinBase, expression.name);
        if (property) {
          this.markSemanticToken('property', expression.nameRange, ['defaultLibrary']);
          return property.type;
        }
        const widgetMethod = this.stdlib.getTypeMethod(builtinBase, expression.name);
        if (widgetMethod) {
          this.markSemanticToken('method', expression.nameRange, ['defaultLibrary']);
          return functionType(widgetMethod.parameters.map((param) => param.type), widgetMethod.returnType);
        }
      }

      const unimported = this.unimportedOwnerModule(objectType);
      this.diagnostics.error(
        expression.range,
        unimported !== null
          ? `'${unimported}' is not imported (use 'use ${unimported};')`
          : `type '${typeToString(objectType)}' has no member '${expression.name}'`,
      );
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

    const unimportedOwner = this.unimportedOwnerModule(objectType);
    this.diagnostics.error(
      expression.range,
      unimportedOwner !== null
        ? `'${unimportedOwner}' is not imported (use 'use ${unimportedOwner};')`
        : `type '${typeToString(objectType)}' has no member '${expression.name}'`,
    );
    return ERROR_TYPE;
  }

  /** Модуль-владелец типа, который в этом файле не подключён. Поиск члена в
   *  таком типе проваливается по единственной причине — забытому use, и
   *  говорить «нет такого члена» было бы неправдой: член там есть (O38,
   *  находка методистов 2026-08-23). Ловушка коварна тем, что имя модуля в
   *  тексте программы может не встречаться вовсе — тип приезжает по цепочке
   *  точек из чужого класса. */
  private unimportedOwnerModule(type: TypeRef): string | null {
    let moduleName: string | null = null;
    if (type.kind === 'qualified') {
      moduleName = type.moduleName;
    } else if (type.kind === 'class') {
      const dot = type.name.indexOf('.');
      if (dot > 0) moduleName = type.name.slice(0, dot);
    }
    if (moduleName === null || moduleName === '') return null;
    return this.imports.has(moduleName) ? null : moduleName;
  }

  private isStringType(type: TypeRef): boolean {
    return type.kind === 'primitive' && type.name === 'string';
  }

  private isBuiltinLengthProperty(type: TypeRef, name: string): boolean {
    return name === 'length' && (this.isStringType(type) || type.kind === 'array');
  }

  private runtimeErrorPropertySpec(type: TypeRef, name: string): PropertySpec | null {
    if (type.kind !== 'runtime-error') return null;
    if (name === 'message' || name === 'file') {
      return { name, type: STRING, readonly: true };
    }
    if (name === 'line') {
      return { name, type: INT, readonly: true };
    }
    return null;
  }

  private stringMethodSpec(name: string): FunctionSpec | null {
    return stringMemberMethodSpec(name);
  }

  private arrayMethodSpec(type: Extract<TypeRef, { kind: 'array' }>, name: string): FunctionSpec | null {
    return arrayMemberMethodSpec(type, name);
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

  private getClassEventInfo(className: string, eventName: string): { readonly spec: FunctionSpec; readonly access: UserMethodAccess } | null {
    const info = this.classes.get(className);
    if (!info) return null;
    const spec = info.events.get(eventName);
    const access = info.eventAccess.get(eventName);
    if (!spec || !access) return null;
    return { spec, access };
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

  /** Объект вида module.Class (zoo.Lion) — контекст статического доступа
   *  к членам класса пользовательского модуля. */
  private moduleClassStaticContext(objectExpression: Expression): {
    readonly moduleName: string;
    readonly className: string;
    readonly classSpec: UserModuleClassSpec;
  } | null {
    if (objectExpression.kind !== 'MemberExpression') return null;
    if (objectExpression.object.kind !== 'IdentifierExpression') return null;
    const moduleName = objectExpression.object.name;
    const module = this.userModuleRegistry.getModule(moduleName);
    const classSpec = module?.classes.get(objectExpression.name);
    if (!module || !classSpec) return null;
    if (!this.imports.has(moduleName)) {
      this.diagnostics.error(objectExpression.object.range, `'${moduleName}' is not imported (use 'use ${moduleName};')`);
    }
    this.markSemanticToken('namespace', objectExpression.object.range);
    this.markSemanticToken('class', objectExpression.nameRange);
    // Тип «объекта»-класса — квалифицированный: кодоген по нему находит
    // имена параметров статических методов модульного класса.
    this.nodeTypes.set(objectExpression, qualified(moduleName, objectExpression.name));
    return { moduleName, className: objectExpression.name, classSpec };
  }

  /** Статик-член в цепочке наследования модульного класса — для честного
   *  «is not inherited» вместо «has no member». */
  private moduleBaseStaticMember(
    moduleName: string,
    classSpec: UserModuleClassSpec,
    memberName: string,
  ): { readonly ownerClass: string; readonly isConst: boolean; readonly isMethod: boolean } | null {
    const module = this.userModuleRegistry.getModule(moduleName);
    let baseName = classSpec.baseName;
    while (baseName) {
      const base = module?.classes.get(baseName);
      if (!base) return null;
      const field = base.fields.find((item) => item.name === memberName);
      if (field?.isStatic) return { ownerClass: baseName, isConst: field.isConst === true, isMethod: false };
      const method = base.methods.find((item) => item.name === memberName);
      if (method?.isStatic) return { ownerClass: baseName, isConst: false, isMethod: true };
      baseName = base.baseName;
    }
    return null;
  }

  /** Виджет-база класса (по цепочке локальных наследований); null для обычных классов. */
  // Все вызовы parent() в теле конструктора — для запретов, у которых свой
  // текст (виджет без конструктора, приватный конструктор базы).
  private findParentCalls(body: unknown): Array<Extract<Expression, { kind: 'CallExpression' }>> {
    const found: Array<Extract<Expression, { kind: 'CallExpression' }>> = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node !== 'object' || node === null) return;
      if ((node as { kind?: unknown }).kind === 'CallExpression') {
        const call = node as Extract<Expression, { kind: 'CallExpression' }>;
        if (call.callee.kind === 'IdentifierExpression' && call.callee.name === 'parent') found.push(call);
      }
      Object.values(node).forEach(walk);
    };
    walk(body);
    return found;
  }

  // Имя занято виджетом-предком? Смотрим ВСЮ цепочку: у внука кнопки поле
  // 'text' так же незаконно, как у прямого наследника, — иначе int тихо ляжет
  // в строгое строковое свойство.
  private widgetMemberClash(info: UserClassInfo, name: string): TypeRef | null {
    const base = info.builtinBase
      ?? (info.declaration.baseName ? this.builtinBaseOf(info.declaration.baseName) : null);
    if (!base) return null;
    const taken = this.stdlib.getTypeProperty(base, name) || this.stdlib.getTypeMethod(base, name);
    return taken ? base : null;
  }

  private builtinBaseOf(className: string): TypeRef | null {
    let info = this.classes.get(className);
    const guard = new Set<string>();
    while (info && !guard.has(info.declaration.name)) {
      guard.add(info.declaration.name);
      if (info.builtinBase) return info.builtinBase;
      if (!info.declaration.baseName) return null;
      info = this.classes.get(info.declaration.baseName);
    }
    return null;
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

    // Наследник виджета живёт всюду, где ждут его виджет-базу или gui.Widget.
    if (target.kind === 'qualified' && value.kind === 'class') {
      const builtinBase = this.builtinBaseOf(value.name);
      if (builtinBase && builtinBase.kind === 'qualified') {
        if (sameType(target, builtinBase)) return true;
        if (target.moduleName === 'gui' && target.name === 'Widget') return true;
      }
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
    if (!this.checkReservedName(name, kind, range)) return;
    scope.set(name, { type, kind, range, readonly, name, used: false });
  }

  // Имя библиотеки занимать под своё нельзя никому: запись `console.write`
  // разбирается как обращение к модулю, поэтому слово `console` означало бы
  // сразу две вещи — и выбирал бы между ними не ученик, а компилятор.
  //
  // Имена функций — встроенных и своих — закрыты и для переменных с
  // параметрами (вердикт владельца 2026-08-28): переменная `greet` не мешала
  // самой себе, но делала невозможным вызов `greet()` — и такой вызов падал в
  // рантайме на языке JavaScript, а не Idyllium. Затенение не «ничего не
  // делает» — оно ломает вызовы, поэтому это ошибка объявления.
  /**
   * Страховочный второй эшелон: если имя встроенной функции всё же оказалось
   * занято символом-не-функцией, вызов по нему не должен тихо звать встроенную
   * поверх символа ученика. Основной запрет живёт в checkReservedName.
   */
  private shadowsBuiltInFunction(name: string, range: SourceRange): boolean {
    const symbol = this.lookup(name);
    if (!symbol || symbol.type.kind === 'function') return false;
    this.diagnostics.error(range, `${symbol.kind} '${name}' hides the built-in function '${name}'`);
    return true;
  }

  /** Имена, начинающиеся с '__', принадлежат языку: под ними живут внутренние
   *  метки объектов и переменные сгенерированного кода. Без запрета поле
   *  '__proto__' молча теряло значение (в JS это вход в прототип). */
  private refuseInternalName(name: string, what: string, range: SourceRange): boolean {
    if (!name.startsWith('__')) return false;
    this.diagnostics.error(range, `names starting with '__' are reserved by the language — pick another name for ${what} '${name}'`);
    return true;
  }

  private checkReservedName(name: string, kind: SymbolInfo['kind'], range: SourceRange): boolean {
    if (name.startsWith('__')) {
      this.diagnostics.error(range, `names starting with '__' are reserved by the language — pick another name for ${kind} '${name}'`);
      return false;
    }
    if (this.stdlib.hasModule(name)) {
      this.diagnostics.error(range, `${kind} '${name}' conflicts with a standard library module`);
      return false;
    }
    // Имя подключённого пользовательского модуля закрыто по той же причине,
    // что и библиотечное: после `use helper;` запись `helper.boost(...)`
    // означает модуль, и одноимённая переменная тихо раздваивала бы имя
    // (обращение к полю шло в объект, вызов — в модуль).
    if (this.imports.has(name) && !this.stdlib.hasModule(name)) {
      this.diagnostics.error(range, `${kind} '${name}' conflicts with the module '${name}'`);
      return false;
    }
    if (kind === 'function' && this.stdlib.getGlobalFunction(name)) {
      this.diagnostics.error(range, `${kind} '${name}' conflicts with a built-in function`);
      return false;
    }
    if (kind !== 'function') {
      if (this.stdlib.getGlobalFunction(name)) {
        this.diagnostics.error(range, `${kind} '${name}' conflicts with the built-in function '${name}'`);
        return false;
      }
      if (this.functions.has(name)) {
        this.diagnostics.error(range, `${kind} '${name}' conflicts with the function '${name}'`);
        return false;
      }
      // Видимый символ-функция — это ещё и 'parent' в конструкторе наследника:
      // переменная с таким именем делала бы вызов parent(...) невозможным, а
      // порядок «вызов выше объявления» падал в рантайме на языке JavaScript.
      // Ищем руками, без lookup(): проверка имени — не использование символа.
      // Останавливаемся на ближайшем найденном: переменная поверх переменной —
      // обычное законное затенение вложенных областей.
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        const existing = this.scopes[i].get(name);
        if (existing) {
          if (existing.type.kind === 'function') {
            this.diagnostics.error(range, `${kind} '${name}' conflicts with the function '${name}'`);
            return false;
          }
          break;
        }
      }
    }
    return true;
  }

  /** Ищет в видимых областях имя, совпадающее с искомым после замены
   *  кириллических букв на латинские двойники: опечатку «cоunt» с русской „о"
   *  глазом не найти, компилятор обязан подсказать. */
  private homoglyphTwin(name: string): string | null {
    const normalized = normalizeHomoglyphs(name);
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      for (const candidate of this.scopes[i].keys()) {
        if (candidate !== name && normalizeHomoglyphs(candidate) === normalized) {
          return candidate;
        }
      }
    }
    return null;
  }

  private notDeclaredMessage(name: string, prefix = ''): string {
    const twin = this.homoglyphTwin(name);
    if (twin !== null) {
      return `${prefix}'${name}' was not declared in this scope — but '${twin}' is: the two names mix Russian and English letters that look alike`;
    }
    return `${prefix}'${name}' was not declared in this scope`;
  }

  private lookup(name: string): SymbolInfo | null {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const symbol = this.scopes[i].get(name);
      if (symbol) {
        symbol.used = true;
        return symbol;
      }
    }
    return null;
  }

  private pushScope(): void {
    this.scopes.push(new Map());
  }

  private popScope(): void {
    const scope = this.scopes.pop();
    if (!scope) return;
    // Неиспользованная ЛОКАЛЬНАЯ переменная — предупреждение (вердикт владельца
    // 2026-08-28: код, который ничего не делает, не наказывается — о нём
    // предупреждают). Параметры и функции не трогаем: неиспользованный параметр
    // законен у переопределений, а функции живут в глобальном скоупе.
    for (const symbol of scope.values()) {
      if (symbol.kind !== 'variable' || symbol.used || symbol.name === undefined) continue;
      // Только примитивы: объект класса и виджет СОЗДАЮТСЯ по-настоящему
      // (конструктор, регистрация в рантайме), массив — заготовка данных;
      // их объявление — уже действие, а не бездействие.
      if (symbol.type.kind !== 'primitive') continue;
      this.diagnostics.warning(symbol.range, `variable '${symbol.name}' is never used`, 'unused-variable');
    }
  }

  private pushClassContext(className: string, isStatic: boolean, inConstructor = false): void {
    this.classContexts.push({ className, isStatic, inConstructor });
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

/** Типизированные спеки встроенных методов строк — источник истины и для
 *  анализатора, и для языкового сервиса (автодополнение, ховер). */
export function stringMemberMethodSpec(name: string): FunctionSpec | null {
  switch (name) {
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

/** Типизированные спеки встроенных методов массивов (см. stringMemberMethodSpec). */
export function arrayMemberMethodSpec(type: Extract<TypeRef, { kind: 'array' }>, name: string): FunctionSpec | null {
  const value = { name: 'value', type: type.elementType };
  const index = { name: 'index', type: INT };

  switch (name) {
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
