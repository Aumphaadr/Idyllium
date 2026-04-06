// src/compiler/analyzer.ts

import {
    Program, UseDeclaration, TopLevelDecl,
    FunctionDecl, ClassDecl, ClassMember, ClassField, ClassMethod,
    ClassConstructor, ClassDestructor,
    Block, Statement, VariableDecl, AssignmentStmt, MultiVariableDecl,
    ExpressionStmt, IfStmt, WhileStmt, DoWhileStmt, ForStmt,
    ReturnStmt, BreakStmt, ContinueStmt, TryStmt,
    Expression, BinaryExpr, UnaryMinusExpr, NotExpr,
    IntLiteralExpr, FloatLiteralExpr, StringLiteralExpr,
    CharLiteralExpr, BoolLiteralExpr, ArrayLiteralExpr,
    IdentifierExpr, ThisExpr,
    FunctionCallExpr, MethodCallExpr,
    PropertyAccessExpr, IndexAccessExpr,
    LambdaExpr, ConstructorCallExpr,
    TypeNode, Parameter, Argument,
    SourceLocation,
} from './ast';

import {
    ResolvedType, FunctionParam,
    INT_TYPE, FLOAT_TYPE, STRING_TYPE, CHAR_TYPE,
    BOOL_TYPE, VOID_TYPE, ERROR_TYPE,
    makeArrayType, makeDynArrayType, makeClassType,
    makeQualifiedType, makeFunctionType,
    typeToString, typesEqual, isAssignable,
    isNumeric, isArrayLike, isDynArray, isError, isVoid,
    getElementType, isNumericArray,
    arithmeticResultType, comparisonResultType, logicalResultType,
    QualifiedRT,
    FIXED_INT_TYPES, FIXED_FLOAT_TYPES,
} from './resolved-types';

import {
    Scope, ScopeKind, SymbolInfo, SymbolKind,
    ClassInfo, FieldInfo, MethodInfo, ConstructorInfo,
} from './scope';

import {
    isGuiWidget,
    findWidgetProperty,
    findWidgetMethod,
    WidgetProperty,
} from '../compiler/stdlib/gui';

import { ErrorCollector } from './errors';
import { RESERVED_BUILTINS } from './tokens';
import { FileResolver } from '../index';
import { Lexer } from './lexer';
import { Parser } from './parser';

interface UserModule {
    name: string;
    functions: ReadonlyMap<string, ResolvedType>;
    classes: ReadonlyMap<string, ClassInfo>;
    ast: Program;
}

export interface SemanticInfo {
    readonly expressionTypes: ReadonlyMap<Expression, ResolvedType>;
    readonly classes: ReadonlyMap<string, ClassInfo>;
    readonly importedLibraries: ReadonlySet<string>;
    readonly userModules: ReadonlyMap<string, UserModuleInfo>;
}

export interface UserModuleInfo {
    readonly name: string;
    readonly functions: ReadonlyMap<string, ResolvedType>;
    readonly classes: ReadonlyMap<string, ClassInfo>;
    readonly ast: Program;
}

const KNOWN_LIBRARIES: ReadonlySet<string> = new Set([
    'console', 'math', 'random', 'time', 'file', 'gui', 'xanadu', 'types', 'encoding',
]);

export class Analyzer {

    private readonly errors: ErrorCollector;
    private scope: Scope;

    private readonly typeMap: Map<Expression, ResolvedType> = new Map();

    private readonly classRegistry: Map<string, ClassInfo> = new Map();

    private readonly importedLibs: Set<string> = new Set();

    private readonly userFunctions: Map<string, ResolvedType> = new Map();

    private readonly userModules: Map<string, UserModule> = new Map();
    private readonly fileResolver: FileResolver | null;
    private readonly analyzedFiles: Set<string> = new Set();

    private readonly file: string;

    constructor(file: string, errors: ErrorCollector, fileResolver: FileResolver | null = null) {
        this.file = file;
        this.errors = errors;
        this.fileResolver = fileResolver;
        this.scope = new Scope('global', null);
    }

    analyze(program: Program): SemanticInfo {
        for (const imp of program.imports) {
            this.analyzeImport(imp);
        }

        for (const decl of program.declarations) {
            if (decl.kind === 'FunctionDecl') {
                this.registerFunction(decl);
            } else if (decl.kind === 'ClassDecl') {
                this.registerClass(decl);
            }
        }
        this.registerFunction(program.main);

        for (const decl of program.declarations) {
            if (decl.kind === 'FunctionDecl') {
                this.analyzeFunctionBody(decl);
            } else if (decl.kind === 'ClassDecl') {
                this.analyzeClassBodies(decl);
            }
        }
        this.analyzeFunctionBody(program.main);

        return {
            expressionTypes: this.typeMap,
            classes: this.classRegistry,
            importedLibraries: this.importedLibs,
            userModules: this.userModules,
        };
    }

    private pushScope(kind: ScopeKind, returnType?: ResolvedType | null, className?: string | null): void {
        this.scope = new Scope(
            kind,
            this.scope,
            returnType ?? null,
            className ?? null,
        );
    }

    private popScope(): void {
        if (this.scope.parent !== null) {
            this.scope = this.scope.parent;
        }
    }

    private declareSymbol(
        name: string, type: ResolvedType, kind: SymbolKind, loc: SourceLocation,
    ): void {
        if (RESERVED_BUILTINS.has(name)) {
            this.errors.addError(loc.file, loc.line,
                `'${name}' is a reserved built-in name and cannot be redefined`);
            return;
        }

        const existing = this.scope.lookupLocal(name);
        if (existing !== null) {
            this.errors.addError(loc.file, loc.line,
                `redefinition of '${name}'`);
            return;
        }

        this.scope.declare({ name, type, kind, loc });
    }

    private error(loc: SourceLocation, msg: string): void {
        this.errors.addError(loc.file, loc.line, msg);
    }

    private warning(loc: SourceLocation, msg: string): void {
        this.errors.addWarning(loc.file, loc.line, msg);
    }

    private analyzeImport(imp: UseDeclaration): void {
        if (this.importedLibs.has(imp.libraryName)) {
            this.warning(imp.loc, `library '${imp.libraryName}' is already imported`);
            return;
        }

        if (KNOWN_LIBRARIES.has(imp.libraryName)) {
            this.importedLibs.add(imp.libraryName);
            this.scope.declare({
                name: imp.libraryName,
                type: VOID_TYPE,
                kind: 'library',
                loc: imp.loc,
            });
            return;
        }

        if (this.fileResolver) {
            const moduleContent = this.fileResolver.resolve(imp.libraryName);
            
            if (moduleContent === null) {
                this.error(imp.loc, 
                    `cannot find module '${imp.libraryName}' (looked for ${imp.libraryName}.idyl)`);
                return;
            }

            if (this.analyzedFiles.has(imp.libraryName)) {
                this.error(imp.loc, `circular import detected: '${imp.libraryName}'`);
                return;
            }

            const userModule = this.analyzeUserModule(imp.libraryName, moduleContent, imp.loc);
            if (userModule) {
                this.userModules.set(imp.libraryName, userModule);
                this.importedLibs.add(imp.libraryName);
                
                this.scope.declare({
                    name: imp.libraryName,
                    type: VOID_TYPE,
                    kind: 'library',
                    loc: imp.loc,
                });
            }
        } else {
            this.warning(imp.loc, 
                `user library '${imp.libraryName}' cannot be verified (no file resolver)`);
            this.importedLibs.add(imp.libraryName);
            this.scope.declare({
                name: imp.libraryName,
                type: VOID_TYPE,
                kind: 'library',
                loc: imp.loc,
            });
        }
    }

    private analyzeUserModule(
        moduleName: string,
        source: string,
        importLoc: SourceLocation
    ): UserModuleInfo | null {
        const moduleFile = `${moduleName}.idyl`;
    
        const moduleErrors = new ErrorCollector(100);
    
        const lexer = new Lexer(source, moduleFile, moduleErrors);
        const tokens = lexer.tokenize();
    
        if (moduleErrors.hasErrors()) {
            for (const err of moduleErrors.getErrors()) {
                this.errors.addError(err.file, err.line, err.message);
            }
            return null;
        }
    
        const parser = new Parser(tokens, moduleFile, moduleErrors, true);
        const ast = parser.parse();
    
        if (moduleErrors.hasErrors()) {
            for (const err of moduleErrors.getErrors()) {
                this.errors.addError(err.file, err.line, err.message);
            }
            return null;
        }
    
        for (const imp of ast.imports) {
            if (!this.importedLibs.has(imp.libraryName) && !this.userModules.has(imp.libraryName)) {
                this.analyzeImport(imp);
            }
        }
    
        const functions = new Map<string, ResolvedType>();
        const classes = new Map<string, ClassInfo>();
    
        for (const decl of ast.declarations) {
            if (decl.kind === 'FunctionDecl') {
                const returnType = this.resolveType(decl.returnType);
                const paramTypes: FunctionParam[] = decl.params.map(p => ({
                    name: p.name,
                    type: this.resolveType(p.paramType),
                    hasDefault: p.defaultValue !== null,
                }));
    
                const funcType = makeFunctionType(paramTypes, returnType);
                functions.set(decl.name, funcType);
            }
        }
    
        const classDecls = ast.declarations.filter(d => d.kind === 'ClassDecl') as ClassDecl[];
        const sortedClasses = this.sortClassesByDependency(classDecls, moduleName);
    
        for (const decl of sortedClasses) {
            const classInfo = this.buildModuleClassInfo(decl, moduleName);
            classes.set(decl.name, classInfo);
        }
    
        return {
            name: moduleName,
            functions,
            classes,
            ast,
        };
    }
    
    private sortClassesByDependency(classes: ClassDecl[], moduleName: string): ClassDecl[] {
        const result: ClassDecl[] = [];
        const added = new Set<string>();
        const classMap = new Map<string, ClassDecl>();
    
        for (const cls of classes) {
            classMap.set(cls.name, cls);
        }
    
        const addWithDeps = (cls: ClassDecl): void => {
            if (added.has(cls.name)) return;
            if (cls.parentClass !== null && cls.parentModule === null) {
                const parent = classMap.get(cls.parentClass);
                if (parent) {
                    addWithDeps(parent);
                }
            }
    
            added.add(cls.name);
            result.push(cls);
        };
    
        for (const cls of classes) {
            addWithDeps(cls);
        }
    
        return result;
    }

    private buildModuleClassInfo(decl: ClassDecl, moduleName: string): ClassInfo {
        const fields = new Map<string, FieldInfo>();
        const methods = new Map<string, MethodInfo>();
        const constructors: ConstructorInfo[] = [];
        let hasDestructor = false;
    
        if (decl.parentClass !== null) {
            let parentInfo: ClassInfo | undefined;
    
            if (decl.parentModule !== null) {
                const parentModule = this.userModules.get(decl.parentModule);
                parentInfo = parentModule?.classes.get(decl.parentClass);
            } else {
                const currentModule = this.userModules.get(moduleName);
                parentInfo = currentModule?.classes.get(decl.parentClass);
                
                if (!parentInfo) {
                    parentInfo = this.classRegistry.get(decl.parentClass);
                }
            }
    
            if (parentInfo) {
                for (const [name, field] of parentInfo.fields) {
                    fields.set(name, field);
                }
                for (const [name, method] of parentInfo.methods) {
                    methods.set(name, method);
                }
            }
        }
    
        for (const member of decl.members) {
            switch (member.kind) {
                case 'ClassField': {
                    fields.set(member.name, {
                        name: member.name,
                        type: this.resolveType(member.fieldType),
                        access: member.access,
                    });
                    break;
                }
                case 'ClassMethod': {
                    const params = member.params.map(p => ({
                        name: p.name,
                        typeNode: p.paramType,
                        hasDefault: p.defaultValue !== null,
                    }));
                    methods.set(member.name, {
                        name: member.name,
                        returnTypeNode: member.returnType,
                        params,
                        access: member.access,
                    });
                    break;
                }
                case 'ClassConstructor': {
                    const params: FunctionParam[] = member.params.map(p => ({
                        name: p.name,
                        type: this.resolveType(p.paramType),
                        hasDefault: p.defaultValue !== null,
                    }));
                    constructors.push({ params, access: member.access });
                    break;
                }
                case 'ClassDestructor': {
                    hasDestructor = true;
                    break;
                }
            }
        }
    
        return {
            name: decl.name,
            parentName: decl.parentClass,
            parentModule: decl.parentModule,
            fields,
            methods,
            constructors,
            hasDestructor,
            loc: decl.loc,
        };
    }

    private resolveType(node: TypeNode): ResolvedType {
        switch (node.kind) {
            case 'PrimitiveType':
                switch (node.name) {
                    case 'int':    return INT_TYPE;
                    case 'float':  return FLOAT_TYPE;
                    case 'string': return STRING_TYPE;
                    case 'char':   return CHAR_TYPE;
                    case 'bool':   return BOOL_TYPE;
                    case 'void':   return VOID_TYPE;
                }
                break;
    
            case 'ArrayType': {
                const elem = this.resolveType(node.elementType);
                return makeArrayType(elem, node.size);
            }
    
            case 'DynArrayType': {
                const elem = this.resolveType(node.elementType);
                return makeDynArrayType(elem);
            }
    
            case 'ClassType': {
                if (!this.classRegistry.has(node.name)) {
                    this.error(node.loc, `unknown type '${node.name}'`);
                    return ERROR_TYPE;
                }
                return makeClassType(node.name);
            }
    
            case 'QualifiedType': {
                if (node.qualifier === 'gui' || node.qualifier === 'xanadu') {
                    if (isGuiWidget(node.name)) {
                        return makeQualifiedType(node.qualifier, node.name);
                    }
                    this.error(node.loc, `unknown GUI widget '${node.name}'`);
                    return ERROR_TYPE;
                }
            
                if (node.qualifier === 'types') {
                    if (!this.importedLibs.has('types')) {
                        this.error(node.loc,
                            `'types' is not imported (use 'use types;')`);
                        return ERROR_TYPE;
                    }
                    if (FIXED_INT_TYPES.has(node.name) || FIXED_FLOAT_TYPES.has(node.name)) {
                        return makeQualifiedType(node.qualifier, node.name);
                    }
                    this.error(node.loc, `unknown type 'types.${node.name}'`);
                    return ERROR_TYPE;
                }
            
                if (!this.importedLibs.has(node.qualifier)) {
                    this.error(node.loc,
                        `'${node.qualifier}' is not imported (use 'use ${node.qualifier};')`);
                    return ERROR_TYPE;
                }
                return makeQualifiedType(node.qualifier, node.name);
            }
        }
    
        return ERROR_TYPE;
    }

    private registerFunction(decl: FunctionDecl): void {
        const returnType = this.resolveType(decl.returnType);
        const paramTypes: FunctionParam[] = decl.params.map(p => ({
            name: p.name,
            type: this.resolveType(p.paramType),
            hasDefault: p.defaultValue !== null,
        }));

        const funcType = makeFunctionType(paramTypes, returnType);
        this.userFunctions.set(decl.name, funcType);

        this.declareSymbol(decl.name, funcType, 'function', decl.loc);
    }

    private analyzeFunctionBody(decl: FunctionDecl): void {
        const returnType = this.resolveType(decl.returnType);

        this.pushScope('function', returnType);

        for (const param of decl.params) {
            const pType = this.resolveType(param.paramType);
            this.declareSymbol(param.name, pType, 'parameter', param.loc);

            if (param.defaultValue !== null) {
                const defType = this.inferType(param.defaultValue);
                if (!isAssignable(pType, defType)) {
                    this.error(param.loc,
                        `default value of type '${typeToString(defType)}' cannot be assigned to parameter '${param.name}' of type '${typeToString(pType)}'`);
                }
            }
        }

        this.analyzeBlock(decl.body);

        this.popScope();
    }

    private registerClass(decl: ClassDecl): void {
        if (decl.parentClass !== null) {
            if (decl.parentModule !== null) {
                if (!this.importedLibs.has(decl.parentModule)) {
                    this.error(decl.loc,
                        `module '${decl.parentModule}' is not imported`);
                } else {
                    const userModule = this.userModules.get(decl.parentModule);
                    if (userModule && !userModule.classes.has(decl.parentClass)) {
                        this.error(decl.loc,
                            `class '${decl.parentClass}' not found in module '${decl.parentModule}'`);
                    }
                }
            } else {
                if (!this.classRegistry.has(decl.parentClass)) {
                    this.error(decl.loc,
                        `parent class '${decl.parentClass}' is not defined`);
                }
            }
        }
    
        const fields = new Map<string, FieldInfo>();
        const methods = new Map<string, MethodInfo>();
        const constructors: ConstructorInfo[] = [];
        let hasDestructor = false;
    
        if (decl.parentClass !== null) {
            let parent: ClassInfo | undefined;
    
            if (decl.parentModule !== null) {
                const userModule = this.userModules.get(decl.parentModule);
                parent = userModule?.classes.get(decl.parentClass);
            } else {
                parent = this.classRegistry.get(decl.parentClass);
            }
    
            if (parent) {
                for (const [name, field] of parent.fields) {
                    fields.set(name, field);
                }
                for (const [name, method] of parent.methods) {
                    methods.set(name, method);
                }
            }
        }
    
        for (const member of decl.members) {
            switch (member.kind) {
                case 'ClassField': {
                    if (fields.has(member.name)) {
                        this.error(member.loc,
                            `field '${member.name}' already declared in class '${decl.name}'`);
                    }
                    fields.set(member.name, {
                        name: member.name,
                        type: this.resolveType(member.fieldType),
                        access: member.access,
                    });
                    break;
                }
                case 'ClassMethod': {
                    const params = member.params.map(p => ({
                        name: p.name,
                        typeNode: p.paramType,
                        hasDefault: p.defaultValue !== null,
                    }));
                    methods.set(member.name, {
                        name: member.name,
                        returnTypeNode: member.returnType,
                        params,
                        access: member.access,
                    });
                    break;
                }
                case 'ClassConstructor': {
                    const params: FunctionParam[] = member.params.map(p => ({
                        name: p.name,
                        type: this.resolveType(p.paramType),
                        hasDefault: p.defaultValue !== null,
                    }));
                    constructors.push({ params, access: member.access });
                    break;
                }
                case 'ClassDestructor': {
                    if (hasDestructor) {
                        this.error(member.loc,
                            `class '${decl.name}' already has a destructor`);
                    }
                    hasDestructor = true;
                    break;
                }
            }
        }
    
        const info: ClassInfo = {
            name: decl.name,
            parentName: decl.parentClass,
            parentModule: decl.parentModule,
            fields,
            methods,
            constructors,
            hasDestructor,
            loc: decl.loc,
        };
    
        this.classRegistry.set(decl.name, info);
        this.declareSymbol(decl.name, makeClassType(decl.name), 'class', decl.loc);
    }

    private getModuleClasses(moduleName: string): Map<string, ClassInfo> | null {
        // TODO: расширить UserModuleInfo для хранения классов
        // Пока возвращаем null
        return null;
    }

    private resolveMethodInfo(methodInfo: MethodInfo): { returnType: ResolvedType; paramTypes: FunctionParam[] } | null {
        const returnType = this.resolveType(methodInfo.returnTypeNode);
        if (isError(returnType)) {
            return null;
        }
    
        const paramTypes: FunctionParam[] = [];
        for (const p of methodInfo.params) {
            const paramType = this.resolveType(p.typeNode);
            if (isError(paramType)) {
                return null;
            }
            paramTypes.push({
                name: p.name,
                type: paramType,
                hasDefault: p.hasDefault,
            });
        }
    
        return { returnType, paramTypes };
    }

    private analyzeClassBodies(decl: ClassDecl): void {
        const classInfo = this.classRegistry.get(decl.name);
        if (!classInfo) return;

        for (const member of decl.members) {
            if (member.kind === 'ClassMethod') {
                this.analyzeClassMethod(decl.name, member, classInfo);
            } else if (member.kind === 'ClassConstructor') {
                this.analyzeClassConstructor(decl.name, member, classInfo);
            } else if (member.kind === 'ClassDestructor') {
                this.analyzeClassDestructor(decl.name, member, classInfo);
            } else if (member.kind === 'ClassField' && member.initializer !== null) {
                const initType = this.inferType(member.initializer);
                const fieldType = this.resolveType(member.fieldType);
                if (!isAssignable(fieldType, initType)) {
                    this.error(member.loc,
                        `cannot assign '${typeToString(initType)}' to field '${member.name}' of type '${typeToString(fieldType)}'`);
                }
            }
        }
    }

    private analyzeClassMethod(
        className: string, method: ClassMethod, classInfo: ClassInfo,
    ): void {
        const methodInfo = classInfo.methods.get(method.name);
        if (!methodInfo) return;
    
        const resolvedMethod = this.resolveMethodInfo(methodInfo);
        if (resolvedMethod === null) {
            return;
        }
        const { returnType, paramTypes } = resolvedMethod;
    
        this.pushScope('method', returnType, className);
    
        this.scope.declare({
            name: 'this',
            type: makeClassType(className),
            kind: 'variable',
            loc: method.loc,
        });
    
        for (let i = 0; i < method.params.length; i++) {
            const param = method.params[i];
            const resolvedParamType = paramTypes[i].type;
            
            this.declareSymbol(param.name, resolvedParamType, 'parameter', param.loc);
            
            if (param.defaultValue !== null) {
                const defType = this.inferType(param.defaultValue);
                if (!isAssignable(resolvedParamType, defType)) {
                    this.error(param.loc,
                        `default value type '${typeToString(defType)}' incompatible with parameter type '${typeToString(resolvedParamType)}'`);
                }
            }
        }
    
        this.analyzeBlock(method.body);
        
        this.popScope();
    }

    private analyzeClassConstructor(
        className: string, ctor: ClassConstructor, classInfo: ClassInfo,
    ): void {
        this.pushScope('constructor', VOID_TYPE, className);

        this.scope.declare({
            name: 'this',
            type: makeClassType(className),
            kind: 'variable',
            loc: ctor.loc,
        });

        for (const param of ctor.params) {
            const pType = this.resolveType(param.paramType);
            this.declareSymbol(param.name, pType, 'parameter', param.loc);
        }

        this.analyzeBlock(ctor.body);
        this.popScope();
    }

    private analyzeClassDestructor(
        className: string, dtor: ClassDestructor, classInfo: ClassInfo,
    ): void {
        this.pushScope('method', VOID_TYPE, className);

        this.scope.declare({
            name: 'this',
            type: makeClassType(className),
            kind: 'variable',
            loc: dtor.loc,
        });

        this.analyzeBlock(dtor.body);
        this.popScope();
    }

    private analyzeBlock(block: Block): void {
        for (const stmt of block.statements) {
            this.analyzeStatement(stmt);
        }
    }

    private analyzeStatement(stmt: Statement): void {
        switch (stmt.kind) {
            case 'VariableDecl':      this.analyzeVarDecl(stmt);       break;
            case 'MultiVariableDecl': this.analyzeMultiVarDecl(stmt);  break;
            case 'AssignmentStmt':    this.analyzeAssignment(stmt);    break;
            case 'ExpressionStmt':    this.analyzeExprStmt(stmt);      break;
            case 'IfStmt':            this.analyzeIf(stmt);            break;
            case 'WhileStmt':         this.analyzeWhile(stmt);         break;
            case 'DoWhileStmt':       this.analyzeDoWhile(stmt);       break;
            case 'ForStmt':           this.analyzeFor(stmt);           break;
            case 'ReturnStmt':        this.analyzeReturn(stmt);        break;
            case 'BreakStmt':         this.analyzeBreak(stmt);         break;
            case 'ContinueStmt':      this.analyzeContinue(stmt);      break;
            case 'TryStmt':           this.analyzeTry(stmt);           break;
        }
    }

    private analyzeVarDecl(decl: VariableDecl): void {
        const varType = this.resolveType(decl.varType);
    
        if (isVoid(varType)) {
            this.error(decl.loc, "cannot declare variable of type 'void'");
            return;
        }
    
        if (decl.initializer !== null) {
            const initType = this.inferType(decl.initializer);
    
            if (!isAssignable(varType, initType)) {
                this.error(decl.loc,
                    `cannot assign '${typeToString(initType)}' value to '${typeToString(varType)}' variable`);
            }
    
            if (varType.tag === 'array' && decl.initializer.kind === 'ArrayLiteral') {
                const expectedSize = varType.size;
                const actualSize = decl.initializer.elements.length;
                if (actualSize !== expectedSize) {
                    this.error(decl.loc,
                        `array initialization has ${actualSize} elements, expected ${expectedSize}`);
                }
            }
        }
    
        if (decl.constructorArgs !== null) {
            if (varType.tag === 'class') {
                this.checkConstructorCall(varType.name, decl.constructorArgs, decl.loc);
            } else if (varType.tag === 'qualified') {
                const userModule = this.userModules.get(varType.qualifier);
                if (userModule) {
                    const classInfo = userModule.classes.get(varType.name);
                    if (classInfo) {
                        this.checkModuleConstructorCall(classInfo, decl.constructorArgs, decl.loc);
                    } else {
                        this.error(decl.loc,
                            `class '${varType.name}' not found in module '${varType.qualifier}'`);
                    }
                } else {
                    this.error(decl.loc,
                        `constructor arguments are only valid for class types`);
                }
            } else {
                this.error(decl.loc,
                    `constructor arguments are only valid for class types`);
            }
        }
    
        this.declareSymbol(decl.name, varType, 'variable', decl.loc);
    }

    private analyzeMultiVarDecl(decl: MultiVariableDecl): void {
        const varType = this.resolveType(decl.varType);
    
        if (isVoid(varType)) {
            this.error(decl.loc, "cannot declare variable of type 'void'");
            return;
        }
    
        for (const d of decl.declarations) {
            if (d.initializer !== null) {
                const initType = this.inferType(d.initializer);
    
                if (!isAssignable(varType, initType)) {
                    this.error(d.loc,
                        `cannot assign '${typeToString(initType)}' value to '${typeToString(varType)}' variable`);
                }
    
                if (varType.tag === 'array' && d.initializer.kind === 'ArrayLiteral') {
                    const expectedSize = varType.size;
                    const actualSize = d.initializer.elements.length;
                    if (actualSize !== expectedSize) {
                        this.error(d.loc,
                            `array initialization has ${actualSize} elements, expected ${expectedSize}`);
                    }
                }
            }
    
            if (d.constructorArgs !== null) {
                if (varType.tag === 'class') {
                    this.checkConstructorCall(varType.name, d.constructorArgs, d.loc);
                } else {
                    this.error(d.loc,
                        `constructor arguments are only valid for class types`);
                }
            }
    
            this.declareSymbol(d.name, varType, 'variable', d.loc);
        }
    }

    private checkModuleConstructorCall(
        classInfo: ClassInfo, args: Argument[], loc: SourceLocation,
    ): void {
        if (classInfo.constructors.length === 0) {
            if (args.length > 0) {
                this.error(loc,
                    `class '${classInfo.name}' has no constructor that accepts arguments`);
            }
            return;
        }
    
        const matching = classInfo.constructors.find(c => {
            const reordered = this.reorderArgsByParams(args, c.params);
            const reorderedTypes = reordered.map(a => this.typeMap.get(a.value) ?? this.inferType(a.value));
            return this.isCallCompatible(c.params, reorderedTypes);
        });
    
        if (!matching) {
            this.error(loc,
                `no matching constructor for '${classInfo.name}' with ${args.length} argument(s)`);
        }
    }

    private analyzeAssignment(stmt: AssignmentStmt): void {
        const targetType = this.inferType(stmt.target);
        let valueType = this.inferType(stmt.value);

        if (stmt.operator !== '=') {
            const arithOp = stmt.operator[0] as '+' | '-' | '*' | '/';
            const resultType = arithmeticResultType(targetType, valueType, arithOp);
            if (resultType === null) {
                this.error(stmt.loc,
                    `operator '${stmt.operator}' not defined for '${typeToString(targetType)}' and '${typeToString(valueType)}'`);
                return;
            }
            valueType = resultType;
        }

        if (!isAssignable(targetType, valueType)) {
            this.error(stmt.loc,
                `cannot assign '${typeToString(valueType)}' to '${typeToString(targetType)}'`);
        }
    }

    private analyzeExprStmt(stmt: ExpressionStmt): void {
        this.inferType(stmt.expression);
    }

    private analyzeIf(stmt: IfStmt): void {
        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);

        this.pushScope('block');
        this.analyzeBlock(stmt.thenBlock);
        this.popScope();

        for (const clause of stmt.elseIfClauses) {
            const eiCondType = this.inferType(clause.condition);
            this.checkBoolCondition(eiCondType, clause.condition, clause.loc);
            this.pushScope('block');
            this.analyzeBlock(clause.block);
            this.popScope();
        }

        if (stmt.elseBlock !== null) {
            this.pushScope('block');
            this.analyzeBlock(stmt.elseBlock);
            this.popScope();
        }
    }

    private analyzeWhile(stmt: WhileStmt): void {
        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);

        this.pushScope('loop');
        this.analyzeBlock(stmt.body);
        this.popScope();
    }

    private analyzeDoWhile(stmt: DoWhileStmt): void {
        this.pushScope('loop');
        this.analyzeBlock(stmt.body);
        this.popScope();

        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);
    }

    private analyzeFor(stmt: ForStmt): void {
        this.pushScope('loop');

        this.analyzeVarDecl(stmt.init);

        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);

        this.analyzeAssignment(stmt.update);
        this.analyzeBlock(stmt.body);

        this.popScope();
    }

    private analyzeReturn(stmt: ReturnStmt): void {
        const expected = this.scope.getReturnType();

        if (expected === null) {
            this.error(stmt.loc, "'return' outside of function");
            return;
        }

        if (stmt.value === null) {
            if (!isVoid(expected)) {
                this.error(stmt.loc,
                    `'${typeToString(expected)}' function must return a value`);
            }
        } else {
            const valType = this.inferType(stmt.value);
            if (isVoid(expected)) {
                this.error(stmt.loc, "'void' function cannot return a value");
            } else if (!isAssignable(expected, valType)) {
                this.error(stmt.loc,
                    `cannot return '${typeToString(valType)}' from '${typeToString(expected)}' function`);
            }
        }
    }

    private analyzeBreak(stmt: BreakStmt): void {
        if (!this.scope.isInsideLoop()) {
            this.error(stmt.loc, "'break' is only valid inside a loop");
        }
    }

    private analyzeContinue(stmt: ContinueStmt): void {
        if (!this.scope.isInsideLoop()) {
            this.error(stmt.loc, "'continue' is only valid inside a loop");
        }
    }

    private analyzeTry(stmt: TryStmt): void {
        this.pushScope('block');
        this.analyzeBlock(stmt.tryBlock);
        this.popScope();
    
        this.pushScope('block');
    
        if (stmt.catchParam !== null) {
            const paramType = this.resolveType(stmt.catchParam.paramType);
            
            if (paramType.tag !== 'string' && !isError(paramType)) {
                this.error(stmt.catchParam.loc,
                    `catch parameter must be of type 'string', got '${typeToString(paramType)}'`);
            }
    
            this.declareSymbol(
                stmt.catchParam.name,
                STRING_TYPE,
                'parameter',
                stmt.catchParam.loc
            );
        }
    
        this.analyzeBlock(stmt.catchBlock);
        this.popScope();
    }

    private checkBoolCondition(
        condType: ResolvedType, condExpr: Expression, loc: SourceLocation,
    ): void {
        if (isError(condType)) return;
        if (condType.tag !== 'bool') {
            this.error(loc,
                `condition must be 'bool', found '${typeToString(condType)}'`);
        }
    }

    private widgetPropTypeToResolved(typeStr: string): ResolvedType {
        switch (typeStr) {
            case 'int':      return INT_TYPE;
            case 'float':    return FLOAT_TYPE;
            case 'string':   return STRING_TYPE;
            case 'bool':     return BOOL_TYPE;
            case 'void':     return VOID_TYPE;
            case 'function': return makeFunctionType([], VOID_TYPE);
            case 'Widget':   return makeQualifiedType('gui', 'Widget');
            default:         return ERROR_TYPE;
        }
    }

    private inferType(expr: Expression): ResolvedType {
        const t = this.inferTypeInner(expr);
        this.typeMap.set(expr, t);
        return t;
    }

    private inferTypeInner(expr: Expression): ResolvedType {
        switch (expr.kind) {
            case 'IntLiteral':      return INT_TYPE;
            case 'FloatLiteral':    return FLOAT_TYPE;
            case 'StringLiteral':   return STRING_TYPE;
            case 'CharLiteral':     return CHAR_TYPE;
            case 'BoolLiteral':     return BOOL_TYPE;
    
            case 'ArrayLiteral':      return this.inferArrayLiteral(expr);
            case 'Identifier':        return this.inferIdentifier(expr);
            case 'ThisExpr':          return this.inferThis(expr);
            case 'BinaryExpr':        return this.inferBinary(expr);
            case 'UnaryMinus':        return this.inferUnaryMinus(expr);
            case 'NotExpr':           return this.inferNot(expr);
            case 'FunctionCall':      return this.inferFunctionCall(expr);
            case 'MethodCall':        return this.inferMethodCall(expr);
            case 'PropertyAccess':    return this.inferPropertyAccess(expr);
            case 'IndexAccess':       return this.inferIndexAccess(expr);
            case 'Lambda':            return this.inferLambda(expr);
            case 'ConstructorCall':   return this.inferConstructorCall(expr);
        }
    }

    private inferArrayLiteral(expr: ArrayLiteralExpr): ResolvedType {
        if (expr.elements.length === 0) {
            return ERROR_TYPE;
        }

        const firstType = this.inferType(expr.elements[0]);
        for (let i = 1; i < expr.elements.length; i++) {
            const elemType = this.inferType(expr.elements[i]);
            if (!isError(firstType) && !isError(elemType) && !typesEqual(firstType, elemType)) {
                if (!(firstType.tag === 'float' && elemType.tag === 'int') &&
                    !(firstType.tag === 'int' && elemType.tag === 'float')) {
                    this.error(expr.elements[i].loc,
                        `array element type '${typeToString(elemType)}' does not match first element type '${typeToString(firstType)}'`);
                }
            }
        }

        let elemType = firstType;
        if (firstType.tag === 'int') {
            for (const el of expr.elements) {
                const t = this.typeMap.get(el);
                if (t && t.tag === 'float') {
                    elemType = FLOAT_TYPE;
                    break;
                }
            }
        }

        return makeDynArrayType(elemType);
    }

    private inferIdentifier(expr: IdentifierExpr): ResolvedType {
        const sym = this.scope.lookup(expr.name);
        if (sym === null) {
            this.error(expr.loc, `'${expr.name}' was not declared in this scope`);
            return ERROR_TYPE;
        }
        return sym.type;
    }

    private inferThis(expr: ThisExpr): ResolvedType {
        const className = this.scope.getClassName();
        if (className === null) {
            this.error(expr.loc, "'this' can only be used inside a class method");
            return ERROR_TYPE;
        }
        return makeClassType(className);
    }

    private inferBinary(expr: BinaryExpr): ResolvedType {
        const leftType = this.inferType(expr.left);
        const rightType = this.inferType(expr.right);

        if (expr.operator === '+' || expr.operator === '-' ||
            expr.operator === '*' || expr.operator === '/') {
            const result = arithmeticResultType(leftType, rightType, expr.operator);
            if (result === null) {
                this.error(expr.loc,
                    `operator '${expr.operator}' not defined for '${typeToString(leftType)}' and '${typeToString(rightType)}'`);
                return ERROR_TYPE;
            }
            return result;
        }

        if (expr.operator === '==' || expr.operator === '!=' ||
            expr.operator === '<' || expr.operator === '>' ||
            expr.operator === '<=' || expr.operator === '>=') {
            const result = comparisonResultType(leftType, rightType, expr.operator);
            if (result === null) {
                this.error(expr.loc,
                    `cannot compare '${typeToString(leftType)}' with '${typeToString(rightType)}'`);
                return ERROR_TYPE;
            }
            return result;
        }

        if (expr.operator === 'and' || expr.operator === 'or' || expr.operator === 'xor') {
            const result = logicalResultType(leftType, rightType);
            if (result === null) {
                this.error(expr.loc,
                    `operator '${expr.operator}' requires 'bool' operands, got '${typeToString(leftType)}' and '${typeToString(rightType)}'`);
                return ERROR_TYPE;
            }
            return result;
        }

        return ERROR_TYPE;
    }

    private inferUnaryMinus(expr: UnaryMinusExpr): ResolvedType {
        const operandType = this.inferType(expr.operand);
        if (isError(operandType)) return ERROR_TYPE;
        if (!isNumeric(operandType)) {
            this.error(expr.loc,
                `unary '-' requires numeric operand, got '${typeToString(operandType)}'`);
            return ERROR_TYPE;
        }
        return operandType;
    }

    private inferNot(expr: NotExpr): ResolvedType {
        const argType = this.inferType(expr.argument);
        if (isError(argType)) return BOOL_TYPE;
        if (argType.tag !== 'bool') {
            this.error(expr.loc,
                `'not()' requires 'bool' argument, got '${typeToString(argType)}'`);
        }
        return BOOL_TYPE;
    }

    private inferFunctionCall(expr: FunctionCallExpr): ResolvedType {
        const classInfo = this.classRegistry.get(expr.callee);
        if (classInfo) {
            this.checkConstructorCall(expr.callee, expr.args, expr.loc);
            return makeClassType(expr.callee);
        }

        const builtinResult = this.tryBuiltinFunction(expr);
        if (builtinResult !== null) return builtinResult;
    
        const sym = this.scope.lookup(expr.callee);
        if (sym === null) {
            this.error(expr.loc,
                `function '${expr.callee}' was not declared in this scope`);
            return ERROR_TYPE;
        }
    
        if (sym.type.tag !== 'function') {
            this.error(expr.loc,
                `'${expr.callee}' is not a function`);
            return ERROR_TYPE;
        }
    
        this.checkArguments(expr.callee, sym.type.paramTypes, expr.args, expr.loc);
        return sym.type.returnType;
    }

    private inferMethodCall(expr: MethodCallExpr): ResolvedType {
        if (expr.object.kind === 'Identifier') {
            const sym = this.scope.lookup(expr.object.name);
            if (sym !== null && sym.kind === 'library') {
                this.typeMap.set(expr.object, VOID_TYPE);
                return this.resolveLibraryCall(
                    sym.name, expr.method, expr.args, expr.loc);
            }
        }
    
        const objType = this.inferType(expr.object);
    
        if (isError(objType)) return ERROR_TYPE;
    
        if (objType.tag === 'string') {
            return this.resolveStringMethod(expr.method, expr.args, expr.loc);
        }
    
        if (isArrayLike(objType)) {
            return this.resolveArrayMethod(
                objType, expr.method, expr.args, expr.loc);
        }
    
        if (objType.tag === 'qualified') {
            const userModule = this.userModules.get(objType.qualifier);
            if (userModule) {
                const classInfo = userModule.classes.get(objType.name);
                if (classInfo) {
                    return this.resolveModuleClassMethod(
                        objType.qualifier, classInfo, expr.method, expr.args, expr.loc);
                }
            }
            
            return this.resolveQualifiedMethod(
                objType, expr.method, expr.args, expr.loc);
        }
    
        if (objType.tag === 'class') {
            return this.resolveClassMethod(
                objType.name, expr.method, expr.args, expr.loc);
        }
    
        this.error(expr.loc,
            `type '${typeToString(objType)}' has no methods`);
        return ERROR_TYPE;
    }

    private inferConstructorCall(expr: ConstructorCallExpr): ResolvedType {
        const cls = this.classRegistry.get(expr.className);
        if (!cls) {
            this.error(expr.loc, `unknown class '${expr.className}'`);
            return ERROR_TYPE;
        }
    
        this.checkConstructorCall(expr.className, expr.args, expr.loc);
        
        return makeClassType(expr.className);
    }

    private resolveModuleClassMethod(
        moduleName: string,
        classInfo: ClassInfo,
        methodName: string,
        args: Argument[],
        loc: SourceLocation,
    ): ResolvedType {
        const methodInfo = classInfo.methods.get(methodName);
        if (!methodInfo) {
            this.error(loc,
                `'${moduleName}.${classInfo.name}' has no method '${methodName}'`);
            return ERROR_TYPE;
        }
    
        if (methodInfo.access === 'private') {
            this.error(loc, `'${methodName}' is private in this context`);
        }
    
        const resolvedMethod = this.resolveMethodInfo(methodInfo);
        if (resolvedMethod === null) {
            this.error(loc, `cannot resolve types for method '${methodName}'`);
            return ERROR_TYPE;
        }
    
        const { returnType, paramTypes } = resolvedMethod;
    
        this.checkArguments(methodName, paramTypes, args, loc);
    
        return returnType;
    }

    private inferPropertyAccess(expr: PropertyAccessExpr): ResolvedType {
        if (expr.object.kind === 'Identifier') {
            const sym = this.scope.lookup(expr.object.name);
            if (sym !== null && sym.kind === 'library') {
                this.typeMap.set(expr.object, VOID_TYPE);
                return this.resolveLibraryProperty(
                    sym.name, expr.property, expr.loc);
            }
        }
    
        const objType = this.inferType(expr.object);
        if (isError(objType)) return ERROR_TYPE;
    
        if (objType.tag === 'class') {
            return this.resolveClassFieldOrMethod(objType.name, expr.property, expr.loc);
        }
    
        if (objType.tag === 'qualified') {
            const userModule = this.userModules.get(objType.qualifier);
            if (userModule) {
                const classInfo = userModule.classes.get(objType.name);
                if (classInfo) {
                    return this.resolveModuleClassField(
                        objType.qualifier, classInfo, expr.property, expr.loc);
                }
            }
            
            return this.resolveQualifiedProperty(
                objType, expr.property, expr.loc);
        }
    
        this.error(expr.loc,
            `type '${typeToString(objType)}' has no property '${expr.property}'`);
        return ERROR_TYPE;
    }

    private resolveModuleClassField(
        moduleName: string,
        classInfo: ClassInfo,
        fieldName: string,
        loc: SourceLocation,
    ): ResolvedType {
        const field = classInfo.fields.get(fieldName);
        if (field) {
            if (field.access === 'private') {
                this.error(loc, `'${fieldName}' is private in this context`);
            }
            return field.type;
        }

        const methodInfo = classInfo.methods.get(fieldName);
        if (methodInfo) {
            if (methodInfo.access === 'private') {
                this.error(loc, `'${fieldName}' is private in this context`);
            }
    
            const resolvedMethod = this.resolveMethodInfo(methodInfo);
            if (resolvedMethod === null) {
                return ERROR_TYPE;
            }
    
            return makeFunctionType(resolvedMethod.paramTypes, resolvedMethod.returnType);
        }
    
        this.error(loc,
            `'${moduleName}.${classInfo.name}' has no field or method '${fieldName}'`);
        return ERROR_TYPE;
    }

    private inferIndexAccess(expr: IndexAccessExpr): ResolvedType {
        const objType = this.inferType(expr.object);
        const indexType = this.inferType(expr.index);

        if (isError(objType)) return ERROR_TYPE;

        if (!isError(indexType) && indexType.tag !== 'int') {
            this.error(expr.index.loc,
                `index must be 'int', found '${typeToString(indexType)}'`);
        }

        const elemType = getElementType(objType);
        if (elemType !== null) return elemType;

        if (objType.tag === 'string') return CHAR_TYPE;

        this.error(expr.loc,
            `type '${typeToString(objType)}' is not indexable`);
        return ERROR_TYPE;
    }

    private inferLambda(expr: LambdaExpr): ResolvedType {
        const returnType = this.resolveType(expr.returnType);
        const params: FunctionParam[] = expr.params.map(p => ({
            name: p.name,
            type: this.resolveType(p.paramType),
            hasDefault: p.defaultValue !== null,
        }));

        this.pushScope('function', returnType);

        for (const param of expr.params) {
            const pType = this.resolveType(param.paramType);
            this.declareSymbol(param.name, pType, 'parameter', param.loc);
        }

        this.analyzeBlock(expr.body);
        this.popScope();

        return makeFunctionType(params, returnType);
    }

    private tryBuiltinFunction(expr: FunctionCallExpr): ResolvedType | null {
        const argTypes = expr.args.map(a => this.inferType(a.value));

        switch (expr.callee) {
            case 'div': {
                this.expectArgCount('div', expr.args, 2, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int')
                    this.error(expr.loc, "'div' requires 'int' arguments");
                if (argTypes.length >= 2 && argTypes[1].tag !== 'int')
                    this.error(expr.loc, "'div' requires 'int' arguments");
                return INT_TYPE;
            }

            case 'mod': {
                this.expectArgCount('mod', expr.args, 2, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int')
                    this.error(expr.loc, "'mod' requires 'int' arguments");
                if (argTypes.length >= 2 && argTypes[1].tag !== 'int')
                    this.error(expr.loc, "'mod' requires 'int' arguments");
                return INT_TYPE;
            }

            case 'to_int': {
                this.expectArgCount('to_int', expr.args, 1, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' &&
                    argTypes[0].tag !== 'float' && argTypes[0].tag !== 'char') {
                    this.error(expr.loc,
                        `'to_int' expects 'string', 'float', or 'char' argument, got '${typeToString(argTypes[0])}'`);
                }
                return INT_TYPE;
            }

            case 'to_float': {
                this.expectArgCount('to_float', expr.args, 1, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' &&
                    argTypes[0].tag !== 'int') {
                    this.error(expr.loc,
                        `'to_float' expects 'string' or 'int' argument, got '${typeToString(argTypes[0])}'`);
                }
                return FLOAT_TYPE;
            }

            case 'to_string': {
                this.expectArgCount('to_string', expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (t.tag !== 'int' && t.tag !== 'float' &&
                        t.tag !== 'bool' && t.tag !== 'char' && !isError(t)) {
                        this.error(expr.loc,
                            `'to_string' cannot convert '${typeToString(t)}' to string`);
                    }
                }
                return STRING_TYPE;
            }

            case 'max':
            case 'min': {
                this.expectArgCount(expr.callee, expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (!isNumericArray(t) && !isError(t)) {
                        this.error(expr.loc,
                            `'${expr.callee}' requires a numeric array argument`);
                        return ERROR_TYPE;
                    }
                    const elem = getElementType(t);
                    return elem ?? ERROR_TYPE;
                }
                return ERROR_TYPE;
            }

            case 'sum': {
                this.expectArgCount('sum', expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (!isNumericArray(t) && !isError(t)) {
                        this.error(expr.loc,
                            "'sum' requires a numeric array argument");
                        return ERROR_TYPE;
                    }
                    const elem = getElementType(t);
                    return elem ?? ERROR_TYPE;
                }
                return ERROR_TYPE;
            }

            case 'avg': {
                this.expectArgCount('avg', expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (!isNumericArray(t) && !isError(t)) {
                        this.error(expr.loc,
                            "'avg' requires a numeric array argument");
                    }
                }
                return FLOAT_TYPE;
            }

            default:
                return null;
        }
    }

    private resolveLibraryCall(
        libName: string, funcName: string, args: Argument[], loc: SourceLocation,
    ): ResolvedType {
        const argTypes = args.map(a => this.inferType(a.value));

        switch (libName) {
            case 'console': return this.resolveConsoleCall(funcName, args, argTypes, loc);
            case 'math':    return this.resolveMathCall(funcName, args, argTypes, loc);
            case 'random':  return this.resolveRandomCall(funcName, args, argTypes, loc);
            case 'time':    return this.resolveTimeCall(funcName, args, argTypes, loc);
            case 'file':    return this.resolveFileCall(funcName, args, argTypes, loc);
            case 'encoding': return this.resolveEncodingCall(funcName, args, argTypes, loc);
        }

        const userModule = this.userModules.get(libName);
        if (userModule) {
            const funcType = userModule.functions.get(funcName);
            if (!funcType) {
                this.error(loc, `module '${libName}' has no function '${funcName}'`);
                return ERROR_TYPE;
            }

            if (funcType.tag !== 'function') {
                this.error(loc, `'${libName}.${funcName}' is not a function`);
                return ERROR_TYPE;
            }

            this.checkArguments(`${libName}.${funcName}`, funcType.paramTypes, args, loc);
            return funcType.returnType;
        }

        this.error(loc, `library '${libName}' has no function '${funcName}'`);
        return ERROR_TYPE;
    }

    getUserModules(): ReadonlyMap<string, UserModule> {
        return this.userModules;
    }

    private resolveConsoleCall(
        func: string, args: Argument[], argTypes: ResolvedType[], loc: SourceLocation,
    ): ResolvedType {
        switch (func) {
            case 'write':
            case 'writeln':
                return VOID_TYPE;

            case 'get_int':
                this.expectArgCount('console.get_int', args, 0, loc);
                return INT_TYPE;

            case 'get_float':
                this.expectArgCount('console.get_float', args, 0, loc);
                return FLOAT_TYPE;

            case 'get_string':
                this.expectArgCount('console.get_string', args, 0, loc);
                return STRING_TYPE;

            case 'set_precision':
                this.expectArgCount('console.set_precision', args, 1, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int') {
                    this.error(loc, "'console.set_precision' expects 'int' argument");
                }
                return VOID_TYPE;

            default:
                this.error(loc, `'console' has no function '${func}'`);
                return ERROR_TYPE;
        }
    }

    private resolveMathCall(
        func: string, args: Argument[], argTypes: ResolvedType[], loc: SourceLocation,
    ): ResolvedType {
        switch (func) {
            case 'abs': {
                this.expectArgCount('math.abs', args, 1, loc);
                if (argTypes.length >= 1 && !isNumeric(argTypes[0]) && !isError(argTypes[0])) {
                    this.error(loc, "'math.abs' requires numeric argument");
                }
                return (argTypes.length >= 1 && argTypes[0].tag === 'int') ? INT_TYPE : FLOAT_TYPE;
            }

            case 'round':
            case 'floor':
            case 'ceil': {
                if (args.length < 1 || args.length > 2) {
                    this.error(loc, `'math.${func}' expects 1 or 2 arguments, got ${args.length}`);
                }
                if (argTypes.length >= 1 && !isNumeric(argTypes[0]) && !isError(argTypes[0])) {
                    this.error(loc, `'math.${func}' requires numeric first argument`);
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'int' && !isError(argTypes[1])) {
                    this.error(loc, `'math.${func}' precision must be 'int'`);
                }
                return args.length >= 2 ? FLOAT_TYPE : INT_TYPE;
            }

            case 'pow':
                this.expectArgCount('math.pow', args, 2, loc);
                this.expectNumericArgs('math.pow', argTypes, loc);
                return FLOAT_TYPE;

            case 'sqrt':
                this.expectArgCount('math.sqrt', args, 1, loc);
                this.expectNumericArgs('math.sqrt', argTypes, loc);
                return FLOAT_TYPE;

            case 'clamp': {
                this.expectArgCount('math.clamp', args, 3, loc);
                this.expectNumericArgs('math.clamp', argTypes, loc);
                const allInt = argTypes.every(t => t.tag === 'int' || isError(t));
                return allInt ? INT_TYPE : FLOAT_TYPE;
            }

            case 'sin': case 'cos': case 'tan':
            case 'asin': case 'acos': case 'atan':
            case 'to_radians': case 'to_degrees':
            case 'log': case 'log10':
                this.expectArgCount(`math.${func}`, args, 1, loc);
                this.expectNumericArgs(`math.${func}`, argTypes, loc);
                return FLOAT_TYPE;

            default:
                this.error(loc, `'math' has no function '${func}'`);
                return ERROR_TYPE;
        }
    }

    private resolveRandomCall(
        func: string, args: Argument[], argTypes: ResolvedType[], loc: SourceLocation,
    ): ResolvedType {
        switch (func) {
            case 'create_int':
                this.expectArgCount('random.create_int', args, 2, loc);
                this.expectAllType('random.create_int', argTypes, INT_TYPE, loc);
                return INT_TYPE;

            case 'create_float':
                this.expectArgCount('random.create_float', args, 2, loc);
                this.expectNumericArgs('random.create_float', argTypes, loc);
                return FLOAT_TYPE;

            case 'choose_from': {
                this.expectArgCount('random.choose_from', args, 1, loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (t.tag === 'string') return CHAR_TYPE;
                    const elem = getElementType(t);
                    if (elem !== null) return elem;
                    if (!isError(t)) {
                        this.error(loc,
                            "'random.choose_from' expects string or array argument");
                    }
                }
                return ERROR_TYPE;
            }

            case 'set_seed':
                this.expectArgCount('random.set_seed', args, 1, loc);
                this.expectAllType('random.set_seed', argTypes, INT_TYPE, loc);
                return VOID_TYPE;

            default:
                this.error(loc, `'random' has no function '${func}'`);
                return ERROR_TYPE;
        }
    }

    private resolveTimeCall(
        func: string, args: Argument[], argTypes: ResolvedType[], loc: SourceLocation,
    ): ResolvedType {
        switch (func) {
            case 'now':
                this.expectArgCount('time.now', args, 0, loc);
                return makeQualifiedType('time', 'stamp');

            case 'sleep':
                this.expectArgCount('time.sleep', args, 1, loc);
                this.expectNumericArgs('time.sleep', argTypes, loc);
                return VOID_TYPE;

            case 'from_unix':
                this.expectArgCount('time.from_unix', args, 1, loc);
                this.expectAllType('time.from_unix', argTypes, INT_TYPE, loc);
                return makeQualifiedType('time', 'stamp');

            default:
                this.error(loc, `'time' has no function '${func}'`);
                return ERROR_TYPE;
        }
    }

    private resolveFileCall(
        func: string, args: Argument[], argTypes: ResolvedType[], loc: SourceLocation,
    ): ResolvedType {
        switch (func) {
            case 'open': {
                this.expectArgCount('file.open', args, 2, loc);
                
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' && !isError(argTypes[0])) {
                    this.error(loc, "'file.open' first argument must be a string (filename)");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !isError(argTypes[1])) {
                    this.error(loc, "'file.open' second argument must be a string (mode)");
                }
    
                if (args.length >= 2) {
                    const modeArg = args[1].value;
                    if (modeArg.kind === 'StringLiteral') {
                        const mode = modeArg.value;
                        if (mode === 'read') {
                            return makeQualifiedType('file', 'istream');
                        } else if (mode === 'write' || mode === 'append') {
                            return makeQualifiedType('file', 'ostream');
                        } else {
                            this.error(loc, 
                                `'file.open' mode must be "read", "write", or "append", got "${mode}"`);
                            return ERROR_TYPE;
                        }
                    }
                }
    
                return makeQualifiedType('file', 'stream');
            }
    
            default:
                this.error(loc, `'file' has no function '${func}'`);
                return ERROR_TYPE;
        }
    }

    private resolveEncodingCall(
        func: string, args: Argument[], argTypes: ResolvedType[], loc: SourceLocation,
    ): ResolvedType {
        switch (func) {
            case 'char_to_int':
                this.expectArgCount('encoding.char_to_int', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'char' && argTypes[0].tag !== 'string' && !isError(argTypes[0])) {
                    this.error(loc, "'encoding.char_to_int' first argument must be a char or string");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !isError(argTypes[1])) {
                    this.error(loc, "'encoding.char_to_int' second argument must be a string (encoding name)");
                }
                return INT_TYPE;
    
            case 'int_to_char':
                this.expectArgCount('encoding.int_to_char', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int' && !isError(argTypes[0])) {
                    this.error(loc, "'encoding.int_to_char' first argument must be an int");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !isError(argTypes[1])) {
                    this.error(loc, "'encoding.int_to_char' second argument must be a string (encoding name)");
                }
                return CHAR_TYPE;
    
            case 'encode':
                this.expectArgCount('encoding.encode', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' && !isError(argTypes[0])) {
                    this.error(loc, "'encoding.encode' first argument must be a string");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !isError(argTypes[1])) {
                    this.error(loc, "'encoding.encode' second argument must be a string (encoding name)");
                }
                return makeDynArrayType(INT_TYPE);
    
            case 'decode':
                this.expectArgCount('encoding.decode', args, 2, loc);
                if (argTypes.length >= 1 && !isArrayLike(argTypes[0]) && !isError(argTypes[0])) {
                    this.error(loc, "'encoding.decode' first argument must be an array of int");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !isError(argTypes[1])) {
                    this.error(loc, "'encoding.decode' second argument must be a string (encoding name)");
                }
                return STRING_TYPE;
    
            case 'list_encodings':
                this.expectArgCount('encoding.list_encodings', args, 0, loc);
                return makeDynArrayType(STRING_TYPE);
    
            default:
                this.error(loc, `'encoding' has no function '${func}'`);
                return ERROR_TYPE;
        }
    }

    private resolveLibraryProperty(
        libName: string, propName: string, loc: SourceLocation,
    ): ResolvedType {
        if (libName === 'math') {
            if (propName === 'pi' || propName === 'e') return FLOAT_TYPE;
        }

        this.error(loc, `'${libName}' has no property '${propName}'`);
        return ERROR_TYPE;
    }

    private resolveStringMethod(
        method: string, args: Argument[], loc: SourceLocation,
    ): ResolvedType {
        const argTypes = args.map(a => this.inferType(a.value));

        switch (method) {
            case 'length':
                this.expectArgCount('.length', args, 0, loc);
                return INT_TYPE;

            case 'contains':
                this.expectArgCount('.contains', args, 1, loc);
                if (argTypes.length >= 1 &&
                    argTypes[0].tag !== 'string' && argTypes[0].tag !== 'char' &&
                    !isError(argTypes[0])) {
                    this.error(loc, "'.contains' expects 'string' or 'char' argument");
                }
                return BOOL_TYPE;

            case 'find':
                this.expectArgCount('.find', args, 1, loc);
                return INT_TYPE;

            case 'count':
                this.expectArgCount('.count', args, 1, loc);
                return INT_TYPE;

            case 'to_upper':
            case 'to_lower':
                this.expectArgCount(`.${method}`, args, 0, loc);
                return STRING_TYPE;

            case 'substring':
                if (args.length < 1 || args.length > 2) {
                    this.error(loc, "'.substring' expects 1 or 2 arguments");
                }
                return STRING_TYPE;

            case 'replace':
                this.expectArgCount('.replace', args, 2, loc);
                return STRING_TYPE;

            case 'split':
                this.expectArgCount('.split', args, 1, loc);
                return makeDynArrayType(STRING_TYPE);

            case 'trim':
                this.expectArgCount('.trim', args, 0, loc);
                return STRING_TYPE;

            case 'is_int':
            case 'is_float':
                this.expectArgCount(`.${method}`, args, 0, loc);
                return BOOL_TYPE;

            default:
                this.error(loc, `type 'string' has no method '${method}'`);
                return ERROR_TYPE;
        }
    }

    private resolveArrayMethod(
        arrType: ResolvedType, method: string, args: Argument[], loc: SourceLocation,
    ): ResolvedType {
        const argTypes = args.map(a => this.inferType(a.value));
        const elemType = getElementType(arrType) ?? ERROR_TYPE;
        const dynamic = isDynArray(arrType);

        switch (method) {
            case 'length':
                this.expectArgCount('.length', args, 0, loc);
                return INT_TYPE;

            case 'contains':
                this.expectArgCount('.contains', args, 1, loc);
                if (argTypes.length >= 1 && !isAssignable(elemType, argTypes[0])) {
                    this.error(loc,
                        `'.contains' argument type '${typeToString(argTypes[0])}' does not match element type '${typeToString(elemType)}'`);
                }
                return BOOL_TYPE;

            case 'find':
                this.expectArgCount('.find', args, 1, loc);
                return INT_TYPE;

            case 'count':
                this.expectArgCount('.count', args, 1, loc);
                return INT_TYPE;

            case 'reverse':
                this.expectArgCount('.reverse', args, 0, loc);
                return VOID_TYPE;

            case 'sort':
                this.expectArgCount('.sort', args, 0, loc);
                if (!isNumeric(elemType) && elemType.tag !== 'string' && !isError(elemType)) {
                    this.error(loc, "'.sort' only works on numeric or string arrays");
                }
                return VOID_TYPE;

            case 'add':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.add', args, 1, loc);
                if (argTypes.length >= 1 && !isAssignable(elemType, argTypes[0])) {
                    this.error(loc,
                        `cannot add '${typeToString(argTypes[0])}' to array of '${typeToString(elemType)}'`);
                }
                return VOID_TYPE;

            case 'remove_at':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.remove_at', args, 1, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int') {
                    this.error(loc, "'.remove_at' expects 'int' index");
                }
                return VOID_TYPE;

            case 'resize':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.resize', args, 1, loc);
                return VOID_TYPE;

            case 'insert':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.insert', args, 2, loc);
                return VOID_TYPE;

            case 'join':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.join', args, 1, loc);
                return VOID_TYPE;

            case 'clear':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.clear', args, 0, loc);
                return VOID_TYPE;

            case 'pop':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.pop', args, 0, loc);
                return elemType;

            default:
                this.error(loc,
                    `type '${typeToString(arrType)}' has no method '${method}'`);
                return ERROR_TYPE;
        }
    }

    private requireDynamic(method: string, isDyn: boolean, loc: SourceLocation): void {
        if (!isDyn) {
            this.error(loc,
                `'.${method}' is only available on dynamic arrays (dyn_array)`);
        }
    }

    private resolveQualifiedMethod(
        objType: QualifiedRT, method: string, args: Argument[], loc: SourceLocation,
    ): ResolvedType {
        const argTypes = args.map(a => this.inferType(a.value));
    
        if (objType.qualifier === 'gui' || objType.qualifier === 'xanadu') {
            const widgetMethod = findWidgetMethod(objType.name, method);
            if (widgetMethod) {
                if (args.length !== widgetMethod.params.length) {
                    this.error(loc,
                        `'${method}' expects ${widgetMethod.params.length} argument(s), got ${args.length}`);
                }
                return this.widgetPropTypeToResolved(widgetMethod.returnType);
            }
            this.error(loc, `'${objType.qualifier}.${objType.name}' has no method '${method}'`);
            return ERROR_TYPE;
        }
    
        if (objType.qualifier === 'time' && objType.name === 'stamp') {
            switch (method) {
                case 'year': case 'month': case 'day':
                case 'hour': case 'minute': case 'second':
                case 'week_day': case 'unix':
                    this.expectArgCount(`.${method}`, args, 0, loc);
                    return INT_TYPE;
                default:
                    this.error(loc, `'time.stamp' has no method '${method}'`);
                    return ERROR_TYPE;
            }
        }
    
        if (objType.qualifier === 'file') {
            if (objType.name === 'istream' || objType.name === 'stream') {
                switch (method) {
                    case 'read_line':
                        this.expectArgCount('.read_line', args, 0, loc);
                        return STRING_TYPE;
                    case 'has_next_line':
                        this.expectArgCount('.has_next_line', args, 0, loc);
                        return BOOL_TYPE;
                    case 'close':
                        this.expectArgCount('.close', args, 0, loc);
                        return VOID_TYPE;
                    default:
                        this.error(loc, `'file.istream' has no method '${method}'`);
                        return ERROR_TYPE;
                }
            }
            if (objType.name === 'ostream') {
                switch (method) {
                    case 'write_line':
                        return VOID_TYPE;
                    case 'close':
                        this.expectArgCount('.close', args, 0, loc);
                        return VOID_TYPE;
                    default:
                        this.error(loc, `'file.ostream' has no method '${method}'`);
                        return ERROR_TYPE;
                }
            }
        }
    
        if (objType.qualifier === 'types') {
            if (FIXED_INT_TYPES.has(objType.name) || FIXED_FLOAT_TYPES.has(objType.name)) {
                switch (method) {
                    case 'to_bin':
                    case 'to_hex':
                        this.expectArgCount(`.${method}`, args, 0, loc);
                        return STRING_TYPE;
                    case 'get':
                        this.expectArgCount('.get', args, 0, loc);
                        return FIXED_INT_TYPES.has(objType.name) ? INT_TYPE : FLOAT_TYPE;
                    case 'set':
                        this.expectArgCount('.set', args, 1, loc);
                        return VOID_TYPE;
                    case 'get_min':
                    case 'get_max':
                    case 'get_bits':
                        this.expectArgCount(`.${method}`, args, 0, loc);
                        return INT_TYPE;
                    default:
                        this.error(loc, `'${typeToString(objType)}' has no method '${method}'`);
                        return ERROR_TYPE;
                }
            }
        }
    
        this.error(loc, `'${typeToString(objType)}' has no method '${method}'`);
        return ERROR_TYPE;
    }

    private resolveQualifiedProperty(
        objType: QualifiedRT, prop: string, loc: SourceLocation,
    ): ResolvedType {
        if (objType.qualifier === 'gui' || objType.qualifier === 'xanadu') {
            const widgetProp = findWidgetProperty(objType.name, prop);
            if (widgetProp) {
                return this.widgetPropTypeToResolved(widgetProp.type);
            }
            this.error(loc, `'${objType.qualifier}.${objType.name}' has no property '${prop}'`);
            return ERROR_TYPE;
        }
    
        this.error(loc, `'${typeToString(objType)}' has no property '${prop}'`);
        return ERROR_TYPE;
    }

    private resolveClassField(
        className: string, fieldName: string, loc: SourceLocation,
    ): ResolvedType {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return ERROR_TYPE;
        }

        const field = cls.fields.get(fieldName);
        if (!field) {
            this.error(loc,
                `'class ${className}' has no field '${fieldName}'`);
            return ERROR_TYPE;
        }

        if (field.access === 'private') {
            const currentClass = this.scope.getClassName();
            if (currentClass !== className) {
                this.error(loc, `'${fieldName}' is private in this context`);
            }
        }

        return field.type;
    }

    private resolveClassMethod(
        className: string, methodName: string, args: Argument[], loc: SourceLocation,
    ): ResolvedType {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return ERROR_TYPE;
        }
    
        const methodInfo = cls.methods.get(methodName);
        if (!methodInfo) {
            this.error(loc,
                `'class ${className}' has no method '${methodName}'`);
            return ERROR_TYPE;
        }
    
        if (methodInfo.access === 'private') {
            const currentClass = this.scope.getClassName();
            if (currentClass !== className) {
                this.error(loc, `'${methodName}' is private in this context`);
            }
        }
    
        const resolvedMethod = this.resolveMethodInfo(methodInfo);
        if (resolvedMethod === null) {
            this.error(loc, `cannot resolve types for method '${methodName}'`);
            return ERROR_TYPE;
        }
    
        const { returnType, paramTypes } = resolvedMethod;
    
        this.checkArguments(methodName, paramTypes, args, loc);
    
        return returnType;
    }

    private resolveClassFieldOrMethod(
        className: string, memberName: string, loc: SourceLocation,
    ): ResolvedType {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return ERROR_TYPE;
        }
    
        const field = cls.fields.get(memberName);
        if (field) {
            if (field.access === 'private') {
                const currentClass = this.scope.getClassName();
                if (currentClass !== className) {
                    this.error(loc, `'${memberName}' is private in this context`);
                }
            }
            return field.type;
        }
    
        const methodInfo = cls.methods.get(memberName);
        if (methodInfo) {
            if (methodInfo.access === 'private') {
                const currentClass = this.scope.getClassName();
                if (currentClass !== className) {
                    this.error(loc, `'${memberName}' is private in this context`);
                }
            }
            
            const resolvedMethod = this.resolveMethodInfo(methodInfo);
            if (resolvedMethod === null) {
                return ERROR_TYPE;
            }
            
            return makeFunctionType(resolvedMethod.paramTypes, resolvedMethod.returnType);
        }
    
        this.error(loc,
            `'class ${className}' has no field or method '${memberName}'`);
        return ERROR_TYPE;
    }

    private checkConstructorCall(
        className: string, args: Argument[], loc: SourceLocation,
    ): void {
        const cls = this.classRegistry.get(className);
        if (!cls) return;
    
        if (cls.constructors.length === 0) {
            if (args.length > 0) {
                this.error(loc,
                    `class '${className}' has no constructor that accepts arguments`);
            }
            return;
        }
    
        const argTypes = args.map(a => this.inferType(a.value));
        const matching = cls.constructors.find(c => {
            const reordered = this.reorderArgsByParams(args, c.params);
            const reorderedTypes = reordered.map(a => this.typeMap.get(a.value) ?? this.inferType(a.value));
            return this.isCallCompatible(c.params, reorderedTypes);
        });
    
        if (!matching) {
            this.error(loc,
                `no matching constructor for '${className}' with ${args.length} argument(s)`);
        }
    }

    private checkArguments(
        funcName: string,
        params: FunctionParam[],
        args: Argument[],
        loc: SourceLocation,
    ): void {
        const minArgs = params.filter(p => !p.hasDefault).length;
        const maxArgs = params.length;
    
        if (args.length < minArgs || args.length > maxArgs) {
            if (minArgs === maxArgs) {
                this.error(loc,
                    `function '${funcName}' expects ${minArgs} argument(s), got ${args.length}`);
            } else {
                this.error(loc,
                    `function '${funcName}' expects ${minArgs} to ${maxArgs} argument(s), got ${args.length}`);
            }
            return;
        }
    
        const paramNames = params.map(p => p.name);
        for (const arg of args) {
            if (arg.name !== null) {
                if (!paramNames.includes(arg.name)) {
                    this.error(arg.loc,
                        `function '${funcName}' has no parameter named '${arg.name}'`);
                    return;
                }
            }
        }
    
        const reordered = this.reorderArgsByParams(args, params);
    
        for (let i = 0; i < reordered.length && i < params.length; i++) {
            const argType = this.typeMap.get(reordered[i].value) ?? this.inferType(reordered[i].value);
            if (!isAssignable(params[i].type, argType)) {
                this.error(reordered[i].loc,
                    `cannot convert '${typeToString(argType)}' to '${typeToString(params[i].type)}' for argument ${i + 1} of '${funcName}'`);
            }
        }
    }

    private reorderArgsByParams(
        args: Argument[],
        params: FunctionParam[],
    ): Argument[] {
        const hasNamed = args.some(a => a.name !== null);
        if (!hasNamed) {
            return args;
        }
    
        const paramNames = params.map(p => p.name);
        const result: Argument[] = new Array(paramNames.length);
        const usedIndices = new Set<number>();
    
        for (const arg of args) {
            if (arg.name !== null) {
                const idx = paramNames.indexOf(arg.name);
                if (idx !== -1) {
                    result[idx] = arg;
                    usedIndices.add(idx);
                }
            }
        }
    
        let nextSlot = 0;
        for (const arg of args) {
            if (arg.name === null) {
                while (usedIndices.has(nextSlot) && nextSlot < paramNames.length) {
                    nextSlot++;
                }
                if (nextSlot < paramNames.length) {
                    result[nextSlot] = arg;
                    usedIndices.add(nextSlot);
                    nextSlot++;
                }
            }
        }
    
        return result.filter(a => a !== undefined);
    }

    private isCallCompatible(params: FunctionParam[], argTypes: ResolvedType[]): boolean {
        const minArgs = params.filter(p => !p.hasDefault).length;
        if (argTypes.length < minArgs || argTypes.length > params.length) return false;

        for (let i = 0; i < argTypes.length; i++) {
            if (!isAssignable(params[i].type, argTypes[i])) return false;
        }
        return true;
    }

    private expectArgCount(
        name: string, args: Argument[], expected: number, loc: SourceLocation,
    ): void {
        if (args.length !== expected) {
            this.error(loc,
                `'${name}' expects ${expected} argument(s), got ${args.length}`);
        }
    }

    private expectNumericArgs(
        name: string, argTypes: ResolvedType[], loc: SourceLocation,
    ): void {
        for (let i = 0; i < argTypes.length; i++) {
            if (!isNumeric(argTypes[i]) && !isError(argTypes[i])) {
                this.error(loc,
                    `'${name}' argument ${i + 1} must be numeric, got '${typeToString(argTypes[i])}'`);
            }
        }
    }

    private expectAllType(
        name: string, argTypes: ResolvedType[], expected: ResolvedType, loc: SourceLocation,
    ): void {
        for (let i = 0; i < argTypes.length; i++) {
            if (!isError(argTypes[i]) && !typesEqual(argTypes[i], expected)) {
                this.error(loc,
                    `'${name}' argument ${i + 1} must be '${typeToString(expected)}', got '${typeToString(argTypes[i])}'`);
            }
        }
    }
}