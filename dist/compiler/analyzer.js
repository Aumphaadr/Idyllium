"use strict";
// src/compiler/analyzer.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Analyzer = void 0;
const resolved_types_1 = require("./resolved-types");
const scope_1 = require("./scope");
const gui_1 = require("../compiler/stdlib/gui");
const errors_1 = require("./errors");
const tokens_1 = require("./tokens");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const KNOWN_LIBRARIES = new Set([
    'console', 'math', 'random', 'time', 'file', 'gui', 'xanadu', 'types', 'encoding',
]);
class Analyzer {
    constructor(file, errors, fileResolver = null) {
        this.typeMap = new Map();
        this.classRegistry = new Map();
        this.importedLibs = new Set();
        this.userFunctions = new Map();
        this.userModules = new Map();
        this.analyzedFiles = new Set();
        this.file = file;
        this.errors = errors;
        this.fileResolver = fileResolver;
        this.scope = new scope_1.Scope('global', null);
    }
    analyze(program) {
        for (const imp of program.imports) {
            this.analyzeImport(imp);
        }
        for (const decl of program.declarations) {
            if (decl.kind === 'FunctionDecl') {
                this.registerFunction(decl);
            }
            else if (decl.kind === 'ClassDecl') {
                this.registerClass(decl);
            }
        }
        this.registerFunction(program.main);
        for (const decl of program.declarations) {
            if (decl.kind === 'FunctionDecl') {
                this.analyzeFunctionBody(decl);
            }
            else if (decl.kind === 'ClassDecl') {
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
    pushScope(kind, returnType, className) {
        this.scope = new scope_1.Scope(kind, this.scope, returnType ?? null, className ?? null);
    }
    popScope() {
        if (this.scope.parent !== null) {
            this.scope = this.scope.parent;
        }
    }
    declareSymbol(name, type, kind, loc) {
        if (tokens_1.RESERVED_BUILTINS.has(name)) {
            this.errors.addError(loc.file, loc.line, `'${name}' is a reserved built-in name and cannot be redefined`);
            return;
        }
        const existing = this.scope.lookupLocal(name);
        if (existing !== null) {
            this.errors.addError(loc.file, loc.line, `redefinition of '${name}'`);
            return;
        }
        this.scope.declare({ name, type, kind, loc });
    }
    error(loc, msg) {
        this.errors.addError(loc.file, loc.line, msg);
    }
    warning(loc, msg) {
        this.errors.addWarning(loc.file, loc.line, msg);
    }
    analyzeImport(imp) {
        if (this.importedLibs.has(imp.libraryName)) {
            this.warning(imp.loc, `library '${imp.libraryName}' is already imported`);
            return;
        }
        if (KNOWN_LIBRARIES.has(imp.libraryName)) {
            this.importedLibs.add(imp.libraryName);
            this.scope.declare({
                name: imp.libraryName,
                type: resolved_types_1.VOID_TYPE,
                kind: 'library',
                loc: imp.loc,
            });
            return;
        }
        if (this.fileResolver) {
            const moduleContent = this.fileResolver.resolve(imp.libraryName);
            if (moduleContent === null) {
                this.error(imp.loc, `cannot find module '${imp.libraryName}' (looked for ${imp.libraryName}.idyl)`);
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
                    type: resolved_types_1.VOID_TYPE,
                    kind: 'library',
                    loc: imp.loc,
                });
            }
        }
        else {
            this.warning(imp.loc, `user library '${imp.libraryName}' cannot be verified (no file resolver)`);
            this.importedLibs.add(imp.libraryName);
            this.scope.declare({
                name: imp.libraryName,
                type: resolved_types_1.VOID_TYPE,
                kind: 'library',
                loc: imp.loc,
            });
        }
    }
    analyzeUserModule(moduleName, source, importLoc) {
        const moduleFile = `${moduleName}.idyl`;
        const moduleErrors = new errors_1.ErrorCollector(100);
        const lexer = new lexer_1.Lexer(source, moduleFile, moduleErrors);
        const tokens = lexer.tokenize();
        if (moduleErrors.hasErrors()) {
            for (const err of moduleErrors.getErrors()) {
                this.errors.addError(err.file, err.line, err.message);
            }
            return null;
        }
        const parser = new parser_1.Parser(tokens, moduleFile, moduleErrors, true);
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
        const functions = new Map();
        const classes = new Map();
        for (const decl of ast.declarations) {
            if (decl.kind === 'FunctionDecl') {
                const returnType = this.resolveType(decl.returnType);
                const paramTypes = decl.params.map(p => ({
                    name: p.name,
                    type: this.resolveType(p.paramType),
                    hasDefault: p.defaultValue !== null,
                }));
                const funcType = (0, resolved_types_1.makeFunctionType)(paramTypes, returnType);
                functions.set(decl.name, funcType);
            }
        }
        const classDecls = ast.declarations.filter(d => d.kind === 'ClassDecl');
        const sortedClasses = this.sortClassesByDependency(classDecls, moduleName);
        for (const decl of sortedClasses) {
            const classInfo = this.buildModuleClassInfo(decl, moduleName);
            classes.set(decl.name, classInfo);
            this.classRegistry.set(`${moduleName}.${decl.name}`, classInfo);
        }
        return {
            name: moduleName,
            functions,
            classes,
            ast,
        };
    }
    sortClassesByDependency(classes, moduleName) {
        const result = [];
        const added = new Set();
        const classMap = new Map();
        for (const cls of classes) {
            classMap.set(cls.name, cls);
        }
        const addWithDeps = (cls) => {
            if (added.has(cls.name))
                return;
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
    buildModuleClassInfo(decl, moduleName) {
        const fields = new Map();
        const methods = new Map();
        const constructors = [];
        let hasDestructor = false;
        if (decl.parentClass !== null) {
            let parentInfo;
            if (decl.parentModule !== null) {
                const parentModule = this.userModules.get(decl.parentModule);
                parentInfo = parentModule?.classes.get(decl.parentClass);
            }
            else {
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
                    const fieldType = this.resolveTypeInModuleContext(member.fieldType, moduleName);
                    fields.set(member.name, {
                        name: member.name,
                        type: fieldType,
                        access: member.access,
                        isStatic: member.isStatic,
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
                        isStatic: member.isStatic,
                    });
                    break;
                }
                case 'ClassConstructor': {
                    const params = member.params.map(p => ({
                        name: p.name,
                        type: this.resolveTypeInModuleContext(p.paramType, moduleName),
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
    resolveTypeInModuleContext(node, moduleName) {
        switch (node.kind) {
            case 'PrimitiveType':
                switch (node.name) {
                    case 'int': return resolved_types_1.INT_TYPE;
                    case 'float': return resolved_types_1.FLOAT_TYPE;
                    case 'string': return resolved_types_1.STRING_TYPE;
                    case 'char': return resolved_types_1.CHAR_TYPE;
                    case 'bool': return resolved_types_1.BOOL_TYPE;
                    case 'void': return resolved_types_1.VOID_TYPE;
                }
                break;
            case 'ArrayType': {
                const elem = this.resolveTypeInModuleContext(node.elementType, moduleName);
                return (0, resolved_types_1.makeArrayType)(elem, node.size);
            }
            case 'DynArrayType': {
                const elem = this.resolveTypeInModuleContext(node.elementType, moduleName);
                return (0, resolved_types_1.makeDynArrayType)(elem);
            }
            case 'ClassType': {
                const currentModule = this.userModules.get(moduleName);
                if (currentModule?.classes.has(node.name)) {
                    return (0, resolved_types_1.makeQualifiedType)(moduleName, node.name);
                }
                if (this.classRegistry.has(node.name)) {
                    return (0, resolved_types_1.makeClassType)(node.name);
                }
                return resolved_types_1.ERROR_TYPE;
            }
            case 'QualifiedType': {
                if (node.qualifier === 'gui' || node.qualifier === 'xanadu') {
                    if ((0, gui_1.isGuiWidget)(node.name)) {
                        return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
                    }
                    return resolved_types_1.ERROR_TYPE;
                }
                if (node.qualifier === 'types') {
                    if (resolved_types_1.FIXED_INT_TYPES.has(node.name) || resolved_types_1.FIXED_FLOAT_TYPES.has(node.name)) {
                        return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
                    }
                    return resolved_types_1.ERROR_TYPE;
                }
                const userModule = this.userModules.get(node.qualifier);
                if (userModule?.classes.has(node.name)) {
                    return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
                }
                return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
            }
        }
        return resolved_types_1.ERROR_TYPE;
    }
    resolveType(node) {
        switch (node.kind) {
            case 'PrimitiveType':
                switch (node.name) {
                    case 'int': return resolved_types_1.INT_TYPE;
                    case 'float': return resolved_types_1.FLOAT_TYPE;
                    case 'string': return resolved_types_1.STRING_TYPE;
                    case 'char': return resolved_types_1.CHAR_TYPE;
                    case 'bool': return resolved_types_1.BOOL_TYPE;
                    case 'void': return resolved_types_1.VOID_TYPE;
                }
                break;
            case 'ArrayType': {
                const elem = this.resolveType(node.elementType);
                return (0, resolved_types_1.makeArrayType)(elem, node.size);
            }
            case 'DynArrayType': {
                const elem = this.resolveType(node.elementType);
                return (0, resolved_types_1.makeDynArrayType)(elem);
            }
            case 'ClassType': {
                if (!this.classRegistry.has(node.name)) {
                    this.error(node.loc, `unknown type '${node.name}'`);
                    return resolved_types_1.ERROR_TYPE;
                }
                return (0, resolved_types_1.makeClassType)(node.name);
            }
            case 'QualifiedType': {
                if (node.qualifier === 'gui' || node.qualifier === 'xanadu') {
                    if ((0, gui_1.isGuiWidget)(node.name)) {
                        return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
                    }
                    this.error(node.loc, `unknown GUI widget '${node.name}'`);
                    return resolved_types_1.ERROR_TYPE;
                }
                if (node.qualifier === 'types') {
                    if (!this.importedLibs.has('types')) {
                        this.error(node.loc, `'types' is not imported (use 'use types;')`);
                        return resolved_types_1.ERROR_TYPE;
                    }
                    if (resolved_types_1.FIXED_INT_TYPES.has(node.name) || resolved_types_1.FIXED_FLOAT_TYPES.has(node.name)) {
                        return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
                    }
                    this.error(node.loc, `unknown type 'types.${node.name}'`);
                    return resolved_types_1.ERROR_TYPE;
                }
                if (this.userModules.has(node.qualifier)) {
                    const userModule = this.userModules.get(node.qualifier);
                    if (userModule.classes.has(node.name)) {
                        return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
                    }
                    this.error(node.loc, `class '${node.name}' not found in module '${node.qualifier}'`);
                    return resolved_types_1.ERROR_TYPE;
                }
                if (!this.importedLibs.has(node.qualifier)) {
                    this.error(node.loc, `'${node.qualifier}' is not imported (use 'use ${node.qualifier};')`);
                    return resolved_types_1.ERROR_TYPE;
                }
                return (0, resolved_types_1.makeQualifiedType)(node.qualifier, node.name);
            }
        }
        return resolved_types_1.ERROR_TYPE;
    }
    registerFunction(decl) {
        const returnType = this.resolveType(decl.returnType);
        const paramTypes = decl.params.map(p => ({
            name: p.name,
            type: this.resolveType(p.paramType),
            hasDefault: p.defaultValue !== null,
        }));
        const funcType = (0, resolved_types_1.makeFunctionType)(paramTypes, returnType);
        this.userFunctions.set(decl.name, funcType);
        this.declareSymbol(decl.name, funcType, 'function', decl.loc);
    }
    analyzeFunctionBody(decl) {
        const returnType = this.resolveType(decl.returnType);
        this.pushScope('function', returnType);
        for (const param of decl.params) {
            const pType = this.resolveType(param.paramType);
            this.declareSymbol(param.name, pType, 'parameter', param.loc);
            if (param.defaultValue !== null) {
                const defType = this.inferType(param.defaultValue);
                if (!(0, resolved_types_1.isAssignable)(pType, defType)) {
                    this.error(param.loc, `default value of type '${(0, resolved_types_1.typeToString)(defType)}' cannot be assigned to parameter '${param.name}' of type '${(0, resolved_types_1.typeToString)(pType)}'`);
                }
            }
        }
        this.analyzeBlock(decl.body);
        this.popScope();
    }
    isClassReference(expr) {
        if (expr.kind !== 'Identifier')
            return null;
        const sym = this.scope.lookup(expr.name);
        if (sym !== null && sym.kind === 'class') {
            return expr.name;
        }
        return null;
    }
    registerClass(decl) {
        if (decl.parentClass !== null) {
            if (decl.parentModule !== null) {
                if (!this.importedLibs.has(decl.parentModule)) {
                    this.error(decl.loc, `module '${decl.parentModule}' is not imported`);
                }
                else {
                    const userModule = this.userModules.get(decl.parentModule);
                    if (userModule && !userModule.classes.has(decl.parentClass)) {
                        this.error(decl.loc, `class '${decl.parentClass}' not found in module '${decl.parentModule}'`);
                    }
                }
            }
            else {
                if (!this.classRegistry.has(decl.parentClass)) {
                    this.error(decl.loc, `parent class '${decl.parentClass}' is not defined`);
                }
            }
        }
        const fields = new Map();
        const methods = new Map();
        const constructors = [];
        let hasDestructor = false;
        if (decl.parentClass !== null) {
            let parent;
            if (decl.parentModule !== null) {
                const userModule = this.userModules.get(decl.parentModule);
                parent = userModule?.classes.get(decl.parentClass);
            }
            else {
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
                        this.error(member.loc, `field '${member.name}' already declared in class '${decl.name}'`);
                    }
                    fields.set(member.name, {
                        name: member.name,
                        type: this.resolveType(member.fieldType),
                        access: member.access,
                        isStatic: member.isStatic,
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
                        isStatic: member.isStatic,
                    });
                    break;
                }
                case 'ClassConstructor': {
                    const params = member.params.map(p => ({
                        name: p.name,
                        type: this.resolveType(p.paramType),
                        hasDefault: p.defaultValue !== null,
                    }));
                    constructors.push({ params, access: member.access });
                    break;
                }
                case 'ClassDestructor': {
                    if (hasDestructor) {
                        this.error(member.loc, `class '${decl.name}' already has a destructor`);
                    }
                    hasDestructor = true;
                    break;
                }
            }
        }
        const info = {
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
        this.declareSymbol(decl.name, (0, resolved_types_1.makeClassType)(decl.name), 'class', decl.loc);
    }
    getModuleClasses(moduleName) {
        // TODO: расширить UserModuleInfo для хранения классов
        // Пока возвращаем null
        return null;
    }
    resolveMethodInfo(methodInfo) {
        const returnType = this.resolveType(methodInfo.returnTypeNode);
        if ((0, resolved_types_1.isError)(returnType)) {
            return null;
        }
        const paramTypes = [];
        for (const p of methodInfo.params) {
            const paramType = this.resolveType(p.typeNode);
            if ((0, resolved_types_1.isError)(paramType)) {
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
    checkParentConstructorArgs(className, args, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls || cls.parentName === null) {
            this.error(loc, `'parent()' used in class '${className}' which has no parent class`);
            return;
        }
        let parentInfo;
        if (cls.parentModule !== null) {
            const userModule = this.userModules.get(cls.parentModule);
            parentInfo = userModule?.classes.get(cls.parentName);
        }
        else {
            parentInfo = this.classRegistry.get(cls.parentName);
        }
        if (!parentInfo)
            return;
        for (const a of args) {
            this.inferType(a.value);
        }
        if (parentInfo.constructors.length === 0) {
            if (args.length > 0) {
                this.error(loc, `parent class '${cls.parentName}' has no constructor that accepts arguments`);
            }
            return;
        }
        const matching = parentInfo.constructors.find(c => {
            const reordered = this.reorderArgsByParams(args, c.params);
            const reorderedTypes = reordered.map(a => this.typeMap.get(a.value) ?? this.inferType(a.value));
            return this.isCallCompatible(c.params, reorderedTypes);
        });
        if (!matching) {
            this.error(loc, `no matching parent constructor for '${cls.parentName}' with ${args.length} argument(s)`);
        }
    }
    analyzeClassBodies(decl) {
        const classInfo = this.classRegistry.get(decl.name);
        if (!classInfo)
            return;
        for (const member of decl.members) {
            if (member.kind === 'ClassMethod') {
                this.analyzeClassMethod(decl.name, member, classInfo);
            }
            else if (member.kind === 'ClassConstructor') {
                this.analyzeClassConstructor(decl.name, member, classInfo);
            }
            else if (member.kind === 'ClassDestructor') {
                this.analyzeClassDestructor(decl.name, member, classInfo);
            }
            else if (member.kind === 'ClassField' && member.initializer !== null) {
                const initType = this.inferType(member.initializer);
                const fieldType = this.resolveType(member.fieldType);
                if (!(0, resolved_types_1.isAssignable)(fieldType, initType)) {
                    this.error(member.loc, `cannot assign '${(0, resolved_types_1.typeToString)(initType)}' to field '${member.name}' of type '${(0, resolved_types_1.typeToString)(fieldType)}'`);
                }
            }
        }
    }
    analyzeClassMethod(className, method, classInfo) {
        const methodInfo = classInfo.methods.get(method.name);
        if (!methodInfo)
            return;
        const resolvedMethod = this.resolveMethodInfo(methodInfo);
        if (resolvedMethod === null) {
            return;
        }
        const { returnType, paramTypes } = resolvedMethod;
        this.pushScope('method', returnType, className);
        this.scope.declare({
            name: 'this',
            type: (0, resolved_types_1.makeClassType)(className),
            kind: 'variable',
            loc: method.loc,
        });
        for (let i = 0; i < method.params.length; i++) {
            const param = method.params[i];
            const resolvedParamType = paramTypes[i].type;
            this.declareSymbol(param.name, resolvedParamType, 'parameter', param.loc);
            if (param.defaultValue !== null) {
                const defType = this.inferType(param.defaultValue);
                if (!(0, resolved_types_1.isAssignable)(resolvedParamType, defType)) {
                    this.error(param.loc, `default value type '${(0, resolved_types_1.typeToString)(defType)}' incompatible with parameter type '${(0, resolved_types_1.typeToString)(resolvedParamType)}'`);
                }
            }
        }
        this.analyzeBlock(method.body);
        this.popScope();
    }
    analyzeClassConstructor(className, ctor, classInfo) {
        this.pushScope('constructor', resolved_types_1.VOID_TYPE, className);
        this.scope.declare({
            name: 'this',
            type: (0, resolved_types_1.makeClassType)(className),
            kind: 'variable',
            loc: ctor.loc,
        });
        for (const param of ctor.params) {
            const pType = this.resolveType(param.paramType);
            this.declareSymbol(param.name, pType, 'parameter', param.loc);
        }
        if (ctor.parentArgs !== null) {
            this.checkParentConstructorArgs(className, ctor.parentArgs, ctor.loc);
        }
        else {
            const cls = this.classRegistry.get(className);
            if (cls && cls.parentName !== null) {
                let parentInfo;
                if (cls.parentModule !== null) {
                    const userModule = this.userModules.get(cls.parentModule);
                    parentInfo = userModule?.classes.get(cls.parentName);
                }
                else {
                    parentInfo = this.classRegistry.get(cls.parentName);
                }
                if (parentInfo && parentInfo.constructors.length > 0) {
                    const hasDefaultCtor = parentInfo.constructors.some(c => c.params.every(p => p.hasDefault));
                    if (!hasDefaultCtor) {
                        this.warning(ctor.loc, `constructor of '${className}' does not call 'parent()'; parent class '${cls.parentName}' has a non-default constructor`);
                    }
                }
            }
        }
        this.analyzeBlock(ctor.body);
        this.popScope();
    }
    analyzeClassDestructor(className, dtor, classInfo) {
        this.pushScope('method', resolved_types_1.VOID_TYPE, className);
        this.scope.declare({
            name: 'this',
            type: (0, resolved_types_1.makeClassType)(className),
            kind: 'variable',
            loc: dtor.loc,
        });
        this.analyzeBlock(dtor.body);
        this.popScope();
    }
    analyzeBlock(block) {
        for (const stmt of block.statements) {
            this.analyzeStatement(stmt);
        }
    }
    analyzeStatement(stmt) {
        switch (stmt.kind) {
            case 'VariableDecl':
                this.analyzeVarDecl(stmt);
                break;
            case 'MultiVariableDecl':
                this.analyzeMultiVarDecl(stmt);
                break;
            case 'AssignmentStmt':
                this.analyzeAssignment(stmt);
                break;
            case 'ExpressionStmt':
                this.analyzeExprStmt(stmt);
                break;
            case 'IfStmt':
                this.analyzeIf(stmt);
                break;
            case 'WhileStmt':
                this.analyzeWhile(stmt);
                break;
            case 'DoWhileStmt':
                this.analyzeDoWhile(stmt);
                break;
            case 'ForStmt':
                this.analyzeFor(stmt);
                break;
            case 'ReturnStmt':
                this.analyzeReturn(stmt);
                break;
            case 'BreakStmt':
                this.analyzeBreak(stmt);
                break;
            case 'ContinueStmt':
                this.analyzeContinue(stmt);
                break;
            case 'TryStmt':
                this.analyzeTry(stmt);
                break;
        }
    }
    analyzeVarDecl(decl) {
        const varType = this.resolveType(decl.varType);
        if ((0, resolved_types_1.isVoid)(varType)) {
            this.error(decl.loc, "cannot declare variable of type 'void'");
            return;
        }
        if (decl.initializer !== null) {
            const initType = this.inferType(decl.initializer);
            if (!(0, resolved_types_1.isAssignable)(varType, initType)) {
                this.error(decl.loc, `cannot assign '${(0, resolved_types_1.typeToString)(initType)}' value to '${(0, resolved_types_1.typeToString)(varType)}' variable`);
            }
            if (varType.tag === 'array' && decl.initializer.kind === 'ArrayLiteral') {
                const expectedSize = varType.size;
                const actualSize = decl.initializer.elements.length;
                if (actualSize !== expectedSize) {
                    this.error(decl.loc, `array initialization has ${actualSize} elements, expected ${expectedSize}`);
                }
            }
        }
        if (decl.constructorArgs !== null) {
            if (varType.tag === 'class') {
                this.checkConstructorCall(varType.name, decl.constructorArgs, decl.loc);
            }
            else if (varType.tag === 'qualified') {
                const userModule = this.userModules.get(varType.qualifier);
                if (userModule) {
                    const classInfo = userModule.classes.get(varType.name);
                    if (classInfo) {
                        this.checkModuleConstructorCall(classInfo, decl.constructorArgs, decl.loc);
                    }
                    else {
                        this.error(decl.loc, `class '${varType.name}' not found in module '${varType.qualifier}'`);
                    }
                }
                else {
                    this.error(decl.loc, `constructor arguments are only valid for class types`);
                }
            }
            else {
                this.error(decl.loc, `constructor arguments are only valid for class types`);
            }
        }
        this.declareSymbol(decl.name, varType, 'variable', decl.loc);
    }
    analyzeMultiVarDecl(decl) {
        const varType = this.resolveType(decl.varType);
        if ((0, resolved_types_1.isVoid)(varType)) {
            this.error(decl.loc, "cannot declare variable of type 'void'");
            return;
        }
        for (const d of decl.declarations) {
            if (d.initializer !== null) {
                const initType = this.inferType(d.initializer);
                if (!(0, resolved_types_1.isAssignable)(varType, initType)) {
                    this.error(d.loc, `cannot assign '${(0, resolved_types_1.typeToString)(initType)}' value to '${(0, resolved_types_1.typeToString)(varType)}' variable`);
                }
                if (varType.tag === 'array' && d.initializer.kind === 'ArrayLiteral') {
                    const expectedSize = varType.size;
                    const actualSize = d.initializer.elements.length;
                    if (actualSize !== expectedSize) {
                        this.error(d.loc, `array initialization has ${actualSize} elements, expected ${expectedSize}`);
                    }
                }
            }
            if (d.constructorArgs !== null) {
                if (varType.tag === 'class') {
                    this.checkConstructorCall(varType.name, d.constructorArgs, d.loc);
                }
                else {
                    this.error(d.loc, `constructor arguments are only valid for class types`);
                }
            }
            this.declareSymbol(d.name, varType, 'variable', d.loc);
        }
    }
    checkModuleConstructorCall(classInfo, args, loc) {
        if (classInfo.constructors.length === 0) {
            if (args.length > 0) {
                this.error(loc, `class '${classInfo.name}' has no constructor that accepts arguments`);
            }
            return;
        }
        const matching = classInfo.constructors.find(c => {
            const reordered = this.reorderArgsByParams(args, c.params);
            const reorderedTypes = reordered.map(a => this.typeMap.get(a.value) ?? this.inferType(a.value));
            return this.isCallCompatible(c.params, reorderedTypes);
        });
        if (!matching) {
            this.error(loc, `no matching constructor for '${classInfo.name}' with ${args.length} argument(s)`);
        }
    }
    analyzeAssignment(stmt) {
        const targetType = this.inferType(stmt.target);
        let valueType = this.inferType(stmt.value);
        if (stmt.operator !== '=') {
            const arithOp = stmt.operator[0];
            const resultType = (0, resolved_types_1.arithmeticResultType)(targetType, valueType, arithOp);
            if (resultType === null) {
                this.error(stmt.loc, `operator '${stmt.operator}' not defined for '${(0, resolved_types_1.typeToString)(targetType)}' and '${(0, resolved_types_1.typeToString)(valueType)}'`);
                return;
            }
            valueType = resultType;
        }
        if (!(0, resolved_types_1.isAssignable)(targetType, valueType)) {
            this.error(stmt.loc, `cannot assign '${(0, resolved_types_1.typeToString)(valueType)}' to '${(0, resolved_types_1.typeToString)(targetType)}'`);
        }
    }
    analyzeExprStmt(stmt) {
        this.inferType(stmt.expression);
    }
    analyzeIf(stmt) {
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
    analyzeWhile(stmt) {
        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);
        this.pushScope('loop');
        this.analyzeBlock(stmt.body);
        this.popScope();
    }
    analyzeDoWhile(stmt) {
        this.pushScope('loop');
        this.analyzeBlock(stmt.body);
        this.popScope();
        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);
    }
    analyzeFor(stmt) {
        this.pushScope('loop');
        this.analyzeVarDecl(stmt.init);
        const condType = this.inferType(stmt.condition);
        this.checkBoolCondition(condType, stmt.condition, stmt.loc);
        this.analyzeAssignment(stmt.update);
        this.analyzeBlock(stmt.body);
        this.popScope();
    }
    analyzeReturn(stmt) {
        const expected = this.scope.getReturnType();
        if (expected === null) {
            this.error(stmt.loc, "'return' outside of function");
            return;
        }
        if (stmt.value === null) {
            if (!(0, resolved_types_1.isVoid)(expected)) {
                this.error(stmt.loc, `'${(0, resolved_types_1.typeToString)(expected)}' function must return a value`);
            }
        }
        else {
            const valType = this.inferType(stmt.value);
            if ((0, resolved_types_1.isVoid)(expected)) {
                this.error(stmt.loc, "'void' function cannot return a value");
            }
            else if (!(0, resolved_types_1.isAssignable)(expected, valType)) {
                this.error(stmt.loc, `cannot return '${(0, resolved_types_1.typeToString)(valType)}' from '${(0, resolved_types_1.typeToString)(expected)}' function`);
            }
        }
    }
    analyzeBreak(stmt) {
        if (!this.scope.isInsideLoop()) {
            this.error(stmt.loc, "'break' is only valid inside a loop");
        }
    }
    analyzeContinue(stmt) {
        if (!this.scope.isInsideLoop()) {
            this.error(stmt.loc, "'continue' is only valid inside a loop");
        }
    }
    analyzeTry(stmt) {
        this.pushScope('block');
        this.analyzeBlock(stmt.tryBlock);
        this.popScope();
        this.pushScope('block');
        if (stmt.catchParam !== null) {
            const paramType = this.resolveType(stmt.catchParam.paramType);
            if (paramType.tag !== 'string' && !(0, resolved_types_1.isError)(paramType)) {
                this.error(stmt.catchParam.loc, `catch parameter must be of type 'string', got '${(0, resolved_types_1.typeToString)(paramType)}'`);
            }
            this.declareSymbol(stmt.catchParam.name, resolved_types_1.STRING_TYPE, 'parameter', stmt.catchParam.loc);
        }
        this.analyzeBlock(stmt.catchBlock);
        this.popScope();
    }
    checkBoolCondition(condType, condExpr, loc) {
        if ((0, resolved_types_1.isError)(condType))
            return;
        if (condType.tag !== 'bool') {
            this.error(loc, `condition must be 'bool', found '${(0, resolved_types_1.typeToString)(condType)}'`);
        }
    }
    widgetPropTypeToResolved(typeStr) {
        switch (typeStr) {
            case 'int': return resolved_types_1.INT_TYPE;
            case 'float': return resolved_types_1.FLOAT_TYPE;
            case 'string': return resolved_types_1.STRING_TYPE;
            case 'bool': return resolved_types_1.BOOL_TYPE;
            case 'void': return resolved_types_1.VOID_TYPE;
            case 'function': return (0, resolved_types_1.makeFunctionType)([], resolved_types_1.VOID_TYPE);
            case 'Widget': return (0, resolved_types_1.makeQualifiedType)('gui', 'Widget');
            default: return resolved_types_1.ERROR_TYPE;
        }
    }
    inferType(expr) {
        const t = this.inferTypeInner(expr);
        this.typeMap.set(expr, t);
        return t;
    }
    inferTypeInner(expr) {
        switch (expr.kind) {
            case 'IntLiteral': return resolved_types_1.INT_TYPE;
            case 'FloatLiteral': return resolved_types_1.FLOAT_TYPE;
            case 'StringLiteral': return resolved_types_1.STRING_TYPE;
            case 'CharLiteral': return resolved_types_1.CHAR_TYPE;
            case 'BoolLiteral': return resolved_types_1.BOOL_TYPE;
            case 'ArrayLiteral': return this.inferArrayLiteral(expr);
            case 'Identifier': return this.inferIdentifier(expr);
            case 'ThisExpr': return this.inferThis(expr);
            case 'BinaryExpr': return this.inferBinary(expr);
            case 'UnaryMinus': return this.inferUnaryMinus(expr);
            case 'NotExpr': return this.inferNot(expr);
            case 'FunctionCall': return this.inferFunctionCall(expr);
            case 'MethodCall': return this.inferMethodCall(expr);
            case 'PropertyAccess': return this.inferPropertyAccess(expr);
            case 'IndexAccess': return this.inferIndexAccess(expr);
            case 'Lambda': return this.inferLambda(expr);
            case 'ConstructorCall': return this.inferConstructorCall(expr);
            case 'ParentCall': return this.inferParentCall(expr);
        }
    }
    inferArrayLiteral(expr) {
        if (expr.elements.length === 0) {
            return resolved_types_1.ERROR_TYPE;
        }
        const firstType = this.inferType(expr.elements[0]);
        for (let i = 1; i < expr.elements.length; i++) {
            const elemType = this.inferType(expr.elements[i]);
            if (!(0, resolved_types_1.isError)(firstType) && !(0, resolved_types_1.isError)(elemType) && !(0, resolved_types_1.typesEqual)(firstType, elemType)) {
                if (!(firstType.tag === 'float' && elemType.tag === 'int') &&
                    !(firstType.tag === 'int' && elemType.tag === 'float')) {
                    this.error(expr.elements[i].loc, `array element type '${(0, resolved_types_1.typeToString)(elemType)}' does not match first element type '${(0, resolved_types_1.typeToString)(firstType)}'`);
                }
            }
        }
        let elemType = firstType;
        if (firstType.tag === 'int') {
            for (const el of expr.elements) {
                const t = this.typeMap.get(el);
                if (t && t.tag === 'float') {
                    elemType = resolved_types_1.FLOAT_TYPE;
                    break;
                }
            }
        }
        return (0, resolved_types_1.makeDynArrayType)(elemType);
    }
    inferIdentifier(expr) {
        const sym = this.scope.lookup(expr.name);
        if (sym === null) {
            this.error(expr.loc, `'${expr.name}' was not declared in this scope`);
            return resolved_types_1.ERROR_TYPE;
        }
        return sym.type;
    }
    inferThis(expr) {
        const className = this.scope.getClassName();
        if (className === null) {
            this.error(expr.loc, "'this' can only be used inside a class method");
            return resolved_types_1.ERROR_TYPE;
        }
        return (0, resolved_types_1.makeClassType)(className);
    }
    inferBinary(expr) {
        const leftType = this.inferType(expr.left);
        const rightType = this.inferType(expr.right);
        if (expr.operator === '+' || expr.operator === '-' ||
            expr.operator === '*' || expr.operator === '/') {
            const result = (0, resolved_types_1.arithmeticResultType)(leftType, rightType, expr.operator);
            if (result === null) {
                this.error(expr.loc, `operator '${expr.operator}' not defined for '${(0, resolved_types_1.typeToString)(leftType)}' and '${(0, resolved_types_1.typeToString)(rightType)}'`);
                return resolved_types_1.ERROR_TYPE;
            }
            return result;
        }
        if (expr.operator === '==' || expr.operator === '!=' ||
            expr.operator === '<' || expr.operator === '>' ||
            expr.operator === '<=' || expr.operator === '>=') {
            const result = (0, resolved_types_1.comparisonResultType)(leftType, rightType, expr.operator);
            if (result === null) {
                this.error(expr.loc, `cannot compare '${(0, resolved_types_1.typeToString)(leftType)}' with '${(0, resolved_types_1.typeToString)(rightType)}'`);
                return resolved_types_1.ERROR_TYPE;
            }
            return result;
        }
        if (expr.operator === 'and' || expr.operator === 'or' || expr.operator === 'xor') {
            const result = (0, resolved_types_1.logicalResultType)(leftType, rightType);
            if (result === null) {
                this.error(expr.loc, `operator '${expr.operator}' requires 'bool' operands, got '${(0, resolved_types_1.typeToString)(leftType)}' and '${(0, resolved_types_1.typeToString)(rightType)}'`);
                return resolved_types_1.ERROR_TYPE;
            }
            return result;
        }
        return resolved_types_1.ERROR_TYPE;
    }
    inferUnaryMinus(expr) {
        const operandType = this.inferType(expr.operand);
        if ((0, resolved_types_1.isError)(operandType))
            return resolved_types_1.ERROR_TYPE;
        if (!(0, resolved_types_1.isNumeric)(operandType)) {
            this.error(expr.loc, `unary '-' requires numeric operand, got '${(0, resolved_types_1.typeToString)(operandType)}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        return operandType;
    }
    inferNot(expr) {
        const argType = this.inferType(expr.argument);
        if ((0, resolved_types_1.isError)(argType))
            return resolved_types_1.BOOL_TYPE;
        if (argType.tag !== 'bool') {
            this.error(expr.loc, `'not()' requires 'bool' argument, got '${(0, resolved_types_1.typeToString)(argType)}'`);
        }
        return resolved_types_1.BOOL_TYPE;
    }
    inferFunctionCall(expr) {
        const classInfo = this.classRegistry.get(expr.callee);
        if (classInfo) {
            this.checkConstructorCall(expr.callee, expr.args, expr.loc);
            return (0, resolved_types_1.makeClassType)(expr.callee);
        }
        const builtinResult = this.tryBuiltinFunction(expr);
        if (builtinResult !== null)
            return builtinResult;
        const sym = this.scope.lookup(expr.callee);
        if (sym === null) {
            this.error(expr.loc, `function '${expr.callee}' was not declared in this scope`);
            return resolved_types_1.ERROR_TYPE;
        }
        if (sym.type.tag !== 'function') {
            this.error(expr.loc, `'${expr.callee}' is not a function`);
            return resolved_types_1.ERROR_TYPE;
        }
        this.checkArguments(expr.callee, sym.type.paramTypes, expr.args, expr.loc);
        return sym.type.returnType;
    }
    inferMethodCall(expr) {
        if (expr.object.kind === 'Identifier') {
            const sym = this.scope.lookup(expr.object.name);
            if (sym !== null && sym.kind === 'library') {
                this.typeMap.set(expr.object, resolved_types_1.VOID_TYPE);
                return this.resolveLibraryCall(sym.name, expr.method, expr.args, expr.loc);
            }
            // Static method call: ClassName.method()
            if (sym !== null && sym.kind === 'class') {
                this.typeMap.set(expr.object, sym.type);
                return this.resolveStaticMethodCall(sym.name, expr.method, expr.args, expr.loc);
            }
        }
        const objType = this.inferType(expr.object);
        if ((0, resolved_types_1.isError)(objType))
            return resolved_types_1.ERROR_TYPE;
        if (objType.tag === 'string') {
            return this.resolveStringMethod(expr.method, expr.args, expr.loc);
        }
        if ((0, resolved_types_1.isArrayLike)(objType)) {
            return this.resolveArrayMethod(objType, expr.method, expr.args, expr.loc);
        }
        if (objType.tag === 'qualified') {
            const userModule = this.userModules.get(objType.qualifier);
            if (userModule) {
                const classInfo = userModule.classes.get(objType.name);
                if (classInfo) {
                    return this.resolveModuleClassMethod(objType.qualifier, classInfo, expr.method, expr.args, expr.loc);
                }
            }
            return this.resolveQualifiedMethod(objType, expr.method, expr.args, expr.loc);
        }
        if (objType.tag === 'class') {
            return this.resolveClassMethod(objType.name, expr.method, expr.args, expr.loc);
        }
        this.error(expr.loc, `type '${(0, resolved_types_1.typeToString)(objType)}' has no methods`);
        return resolved_types_1.ERROR_TYPE;
    }
    inferParentCall(expr) {
        if (!this.scope.isInsideConstructor()) {
            this.error(expr.loc, "'parent()' can only be used inside a class constructor");
            return resolved_types_1.ERROR_TYPE;
        }
        const className = this.scope.getClassName();
        if (className === null) {
            this.error(expr.loc, "'parent()' can only be used inside a class constructor");
            return resolved_types_1.ERROR_TYPE;
        }
        this.checkParentConstructorArgs(className, expr.args, expr.loc);
        return resolved_types_1.VOID_TYPE;
    }
    resolveStaticMethodCall(className, methodName, args, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        const methodInfo = cls.methods.get(methodName);
        if (!methodInfo) {
            this.error(loc, `class '${className}' has no method '${methodName}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        if (!methodInfo.isStatic) {
            this.error(loc, `'${methodName}' is not a static method of '${className}'; create an instance first`);
            return resolved_types_1.ERROR_TYPE;
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
            return resolved_types_1.ERROR_TYPE;
        }
        this.checkArguments(methodName, resolvedMethod.paramTypes, args, loc);
        return resolvedMethod.returnType;
    }
    resolveStaticFieldAccess(className, fieldName, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        const field = cls.fields.get(fieldName);
        if (field) {
            if (!field.isStatic) {
                this.error(loc, `'${fieldName}' is not a static field of '${className}'; create an instance first`);
                return resolved_types_1.ERROR_TYPE;
            }
            if (field.access === 'private') {
                const currentClass = this.scope.getClassName();
                if (currentClass !== className) {
                    this.error(loc, `'${fieldName}' is private in this context`);
                }
            }
            return field.type;
        }
        const methodInfo = cls.methods.get(fieldName);
        if (methodInfo) {
            if (!methodInfo.isStatic) {
                this.error(loc, `'${fieldName}' is not a static member of '${className}'; create an instance first`);
                return resolved_types_1.ERROR_TYPE;
            }
            if (methodInfo.access === 'private') {
                const currentClass = this.scope.getClassName();
                if (currentClass !== className) {
                    this.error(loc, `'${fieldName}' is private in this context`);
                }
            }
            const resolvedMethod = this.resolveMethodInfo(methodInfo);
            if (resolvedMethod === null)
                return resolved_types_1.ERROR_TYPE;
            return (0, resolved_types_1.makeFunctionType)(resolvedMethod.paramTypes, resolvedMethod.returnType);
        }
        this.error(loc, `class '${className}' has no static member '${fieldName}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    inferConstructorCall(expr) {
        const cls = this.classRegistry.get(expr.className);
        if (!cls) {
            this.error(expr.loc, `unknown class '${expr.className}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        this.checkConstructorCall(expr.className, expr.args, expr.loc);
        return (0, resolved_types_1.makeClassType)(expr.className);
    }
    resolveModuleClassMethod(moduleName, classInfo, methodName, args, loc) {
        const methodInfo = classInfo.methods.get(methodName);
        if (!methodInfo) {
            this.error(loc, `'${moduleName}.${classInfo.name}' has no method '${methodName}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        if (methodInfo.access === 'private') {
            this.error(loc, `'${methodName}' is private in this context`);
        }
        const resolvedMethod = this.resolveMethodInfo(methodInfo);
        if (resolvedMethod === null) {
            this.error(loc, `cannot resolve types for method '${methodName}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        const { returnType, paramTypes } = resolvedMethod;
        this.checkArguments(methodName, paramTypes, args, loc);
        return returnType;
    }
    inferPropertyAccess(expr) {
        if (expr.object.kind === 'Identifier') {
            const sym = this.scope.lookup(expr.object.name);
            if (sym !== null && sym.kind === 'library') {
                this.typeMap.set(expr.object, resolved_types_1.VOID_TYPE);
                return this.resolveLibraryProperty(sym.name, expr.property, expr.loc);
            }
            // Static field access: ClassName.field
            if (sym !== null && sym.kind === 'class') {
                this.typeMap.set(expr.object, sym.type);
                return this.resolveStaticFieldAccess(sym.name, expr.property, expr.loc);
            }
        }
        const objType = this.inferType(expr.object);
        if ((0, resolved_types_1.isError)(objType))
            return resolved_types_1.ERROR_TYPE;
        if (objType.tag === 'class') {
            return this.resolveClassFieldOrMethod(objType.name, expr.property, expr.loc);
        }
        if (objType.tag === 'qualified') {
            const userModule = this.userModules.get(objType.qualifier);
            if (userModule) {
                const classInfo = userModule.classes.get(objType.name);
                if (classInfo) {
                    return this.resolveModuleClassField(objType.qualifier, classInfo, expr.property, expr.loc);
                }
            }
            return this.resolveQualifiedProperty(objType, expr.property, expr.loc);
        }
        this.error(expr.loc, `type '${(0, resolved_types_1.typeToString)(objType)}' has no property '${expr.property}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    resolveModuleClassField(moduleName, classInfo, fieldName, loc) {
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
                return resolved_types_1.ERROR_TYPE;
            }
            return (0, resolved_types_1.makeFunctionType)(resolvedMethod.paramTypes, resolvedMethod.returnType);
        }
        this.error(loc, `'${moduleName}.${classInfo.name}' has no field or method '${fieldName}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    inferIndexAccess(expr) {
        const objType = this.inferType(expr.object);
        const indexType = this.inferType(expr.index);
        if ((0, resolved_types_1.isError)(objType))
            return resolved_types_1.ERROR_TYPE;
        if (!(0, resolved_types_1.isError)(indexType) && indexType.tag !== 'int') {
            this.error(expr.index.loc, `index must be 'int', found '${(0, resolved_types_1.typeToString)(indexType)}'`);
        }
        const elemType = (0, resolved_types_1.getElementType)(objType);
        if (elemType !== null)
            return elemType;
        if (objType.tag === 'string')
            return resolved_types_1.CHAR_TYPE;
        this.error(expr.loc, `type '${(0, resolved_types_1.typeToString)(objType)}' is not indexable`);
        return resolved_types_1.ERROR_TYPE;
    }
    inferLambda(expr) {
        const returnType = this.resolveType(expr.returnType);
        const params = expr.params.map(p => ({
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
        return (0, resolved_types_1.makeFunctionType)(params, returnType);
    }
    tryBuiltinFunction(expr) {
        const argTypes = expr.args.map(a => this.inferType(a.value));
        switch (expr.callee) {
            case 'div': {
                this.expectArgCount('div', expr.args, 2, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int')
                    this.error(expr.loc, "'div' requires 'int' arguments");
                if (argTypes.length >= 2 && argTypes[1].tag !== 'int')
                    this.error(expr.loc, "'div' requires 'int' arguments");
                return resolved_types_1.INT_TYPE;
            }
            case 'mod': {
                this.expectArgCount('mod', expr.args, 2, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int')
                    this.error(expr.loc, "'mod' requires 'int' arguments");
                if (argTypes.length >= 2 && argTypes[1].tag !== 'int')
                    this.error(expr.loc, "'mod' requires 'int' arguments");
                return resolved_types_1.INT_TYPE;
            }
            case 'to_int': {
                this.expectArgCount('to_int', expr.args, 1, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' &&
                    argTypes[0].tag !== 'float' && argTypes[0].tag !== 'char') {
                    this.error(expr.loc, `'to_int' expects 'string', 'float', or 'char' argument, got '${(0, resolved_types_1.typeToString)(argTypes[0])}'`);
                }
                return resolved_types_1.INT_TYPE;
            }
            case 'to_float': {
                this.expectArgCount('to_float', expr.args, 1, expr.loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' &&
                    argTypes[0].tag !== 'int') {
                    this.error(expr.loc, `'to_float' expects 'string' or 'int' argument, got '${(0, resolved_types_1.typeToString)(argTypes[0])}'`);
                }
                return resolved_types_1.FLOAT_TYPE;
            }
            case 'to_string': {
                this.expectArgCount('to_string', expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (t.tag !== 'int' && t.tag !== 'float' &&
                        t.tag !== 'bool' && t.tag !== 'char' && !(0, resolved_types_1.isError)(t)) {
                        this.error(expr.loc, `'to_string' cannot convert '${(0, resolved_types_1.typeToString)(t)}' to string`);
                    }
                }
                return resolved_types_1.STRING_TYPE;
            }
            case 'max':
            case 'min': {
                this.expectArgCount(expr.callee, expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (!(0, resolved_types_1.isNumericArray)(t) && !(0, resolved_types_1.isError)(t)) {
                        this.error(expr.loc, `'${expr.callee}' requires a numeric array argument`);
                        return resolved_types_1.ERROR_TYPE;
                    }
                    const elem = (0, resolved_types_1.getElementType)(t);
                    return elem ?? resolved_types_1.ERROR_TYPE;
                }
                return resolved_types_1.ERROR_TYPE;
            }
            case 'sum': {
                this.expectArgCount('sum', expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (!(0, resolved_types_1.isNumericArray)(t) && !(0, resolved_types_1.isError)(t)) {
                        this.error(expr.loc, "'sum' requires a numeric array argument");
                        return resolved_types_1.ERROR_TYPE;
                    }
                    const elem = (0, resolved_types_1.getElementType)(t);
                    return elem ?? resolved_types_1.ERROR_TYPE;
                }
                return resolved_types_1.ERROR_TYPE;
            }
            case 'avg': {
                this.expectArgCount('avg', expr.args, 1, expr.loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (!(0, resolved_types_1.isNumericArray)(t) && !(0, resolved_types_1.isError)(t)) {
                        this.error(expr.loc, "'avg' requires a numeric array argument");
                    }
                }
                return resolved_types_1.FLOAT_TYPE;
            }
            default:
                return null;
        }
    }
    resolveLibraryCall(libName, funcName, args, loc) {
        const argTypes = args.map(a => this.inferType(a.value));
        switch (libName) {
            case 'console': return this.resolveConsoleCall(funcName, args, argTypes, loc);
            case 'math': return this.resolveMathCall(funcName, args, argTypes, loc);
            case 'random': return this.resolveRandomCall(funcName, args, argTypes, loc);
            case 'time': return this.resolveTimeCall(funcName, args, argTypes, loc);
            case 'file': return this.resolveFileCall(funcName, args, argTypes, loc);
            case 'encoding': return this.resolveEncodingCall(funcName, args, argTypes, loc);
            case 'types': return this.resolveTypesCall(funcName, args, argTypes, loc);
        }
        const userModule = this.userModules.get(libName);
        if (userModule) {
            const funcType = userModule.functions.get(funcName);
            if (!funcType) {
                this.error(loc, `module '${libName}' has no function '${funcName}'`);
                return resolved_types_1.ERROR_TYPE;
            }
            if (funcType.tag !== 'function') {
                this.error(loc, `'${libName}.${funcName}' is not a function`);
                return resolved_types_1.ERROR_TYPE;
            }
            this.checkArguments(`${libName}.${funcName}`, funcType.paramTypes, args, loc);
            return funcType.returnType;
        }
        this.error(loc, `library '${libName}' has no function '${funcName}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    getUserModules() {
        return this.userModules;
    }
    resolveConsoleCall(func, args, argTypes, loc) {
        switch (func) {
            case 'write':
            case 'writeln':
                // Check that no raw class instances are passed
                for (let i = 0; i < argTypes.length; i++) {
                    const t = argTypes[i];
                    if (t.tag === 'class') {
                        const cls = this.classRegistry.get(t.name);
                        const hasToString = cls?.methods.has('to_string') ?? false;
                        if (!hasToString) {
                            this.error(args[i].loc, `cannot print object of class '${t.name}' directly; define a 'string function to_string()' method or convert to string first`);
                        }
                    }
                }
                return resolved_types_1.VOID_TYPE;
            case 'get_int':
                this.expectArgCount('console.get_int', args, 0, loc);
                return resolved_types_1.INT_TYPE;
            case 'get_float':
                this.expectArgCount('console.get_float', args, 0, loc);
                return resolved_types_1.FLOAT_TYPE;
            case 'get_string':
                this.expectArgCount('console.get_string', args, 0, loc);
                return resolved_types_1.STRING_TYPE;
            case 'set_precision':
                this.expectArgCount('console.set_precision', args, 1, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int') {
                    this.error(loc, "'console.set_precision' expects 'int' argument");
                }
                return resolved_types_1.VOID_TYPE;
            default:
                this.error(loc, `'console' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveMathCall(func, args, argTypes, loc) {
        switch (func) {
            case 'abs': {
                this.expectArgCount('math.abs', args, 1, loc);
                if (argTypes.length >= 1 && !(0, resolved_types_1.isNumeric)(argTypes[0]) && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'math.abs' requires numeric argument");
                }
                return (argTypes.length >= 1 && argTypes[0].tag === 'int') ? resolved_types_1.INT_TYPE : resolved_types_1.FLOAT_TYPE;
            }
            case 'round':
            case 'floor':
            case 'ceil': {
                if (args.length < 1 || args.length > 2) {
                    this.error(loc, `'math.${func}' expects 1 or 2 arguments, got ${args.length}`);
                }
                if (argTypes.length >= 1 && !(0, resolved_types_1.isNumeric)(argTypes[0]) && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, `'math.${func}' requires numeric first argument`);
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'int' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, `'math.${func}' precision must be 'int'`);
                }
                return args.length >= 2 ? resolved_types_1.FLOAT_TYPE : resolved_types_1.INT_TYPE;
            }
            case 'pow':
                this.expectArgCount('math.pow', args, 2, loc);
                this.expectNumericArgs('math.pow', argTypes, loc);
                return resolved_types_1.FLOAT_TYPE;
            case 'sqrt':
                this.expectArgCount('math.sqrt', args, 1, loc);
                this.expectNumericArgs('math.sqrt', argTypes, loc);
                return resolved_types_1.FLOAT_TYPE;
            case 'clamp': {
                this.expectArgCount('math.clamp', args, 3, loc);
                this.expectNumericArgs('math.clamp', argTypes, loc);
                const allInt = argTypes.every(t => t.tag === 'int' || (0, resolved_types_1.isError)(t));
                return allInt ? resolved_types_1.INT_TYPE : resolved_types_1.FLOAT_TYPE;
            }
            case 'sin':
            case 'cos':
            case 'tan':
            case 'asin':
            case 'acos':
            case 'atan':
            case 'to_radians':
            case 'to_degrees':
            case 'log':
            case 'log10':
                this.expectArgCount(`math.${func}`, args, 1, loc);
                this.expectNumericArgs(`math.${func}`, argTypes, loc);
                return resolved_types_1.FLOAT_TYPE;
            default:
                this.error(loc, `'math' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveRandomCall(func, args, argTypes, loc) {
        switch (func) {
            case 'create_int':
                this.expectArgCount('random.create_int', args, 2, loc);
                this.expectAllType('random.create_int', argTypes, resolved_types_1.INT_TYPE, loc);
                return resolved_types_1.INT_TYPE;
            case 'create_float':
                this.expectArgCount('random.create_float', args, 2, loc);
                this.expectNumericArgs('random.create_float', argTypes, loc);
                return resolved_types_1.FLOAT_TYPE;
            case 'choose_from': {
                this.expectArgCount('random.choose_from', args, 1, loc);
                if (argTypes.length >= 1) {
                    const t = argTypes[0];
                    if (t.tag === 'string')
                        return resolved_types_1.CHAR_TYPE;
                    const elem = (0, resolved_types_1.getElementType)(t);
                    if (elem !== null)
                        return elem;
                    if (!(0, resolved_types_1.isError)(t)) {
                        this.error(loc, "'random.choose_from' expects string or array argument");
                    }
                }
                return resolved_types_1.ERROR_TYPE;
            }
            case 'set_seed':
                this.expectArgCount('random.set_seed', args, 1, loc);
                this.expectAllType('random.set_seed', argTypes, resolved_types_1.INT_TYPE, loc);
                return resolved_types_1.VOID_TYPE;
            default:
                this.error(loc, `'random' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveTimeCall(func, args, argTypes, loc) {
        switch (func) {
            case 'now':
                this.expectArgCount('time.now', args, 0, loc);
                return (0, resolved_types_1.makeQualifiedType)('time', 'stamp');
            case 'sleep':
                this.expectArgCount('time.sleep', args, 1, loc);
                this.expectNumericArgs('time.sleep', argTypes, loc);
                return resolved_types_1.VOID_TYPE;
            case 'from_unix':
                this.expectArgCount('time.from_unix', args, 1, loc);
                this.expectAllType('time.from_unix', argTypes, resolved_types_1.INT_TYPE, loc);
                return (0, resolved_types_1.makeQualifiedType)('time', 'stamp');
            default:
                this.error(loc, `'time' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveFileCall(func, args, argTypes, loc) {
        switch (func) {
            case 'open': {
                this.expectArgCount('file.open', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'file.open' first argument must be a string (filename)");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, "'file.open' second argument must be a string (mode)");
                }
                if (args.length >= 2) {
                    const modeArg = args[1].value;
                    if (modeArg.kind === 'StringLiteral') {
                        const mode = modeArg.value;
                        if (mode === 'read') {
                            return (0, resolved_types_1.makeQualifiedType)('file', 'istream');
                        }
                        else if (mode === 'write' || mode === 'append') {
                            return (0, resolved_types_1.makeQualifiedType)('file', 'ostream');
                        }
                        else {
                            this.error(loc, `'file.open' mode must be "read", "write", or "append", got "${mode}"`);
                            return resolved_types_1.ERROR_TYPE;
                        }
                    }
                }
                return (0, resolved_types_1.makeQualifiedType)('file', 'stream');
            }
            default:
                this.error(loc, `'file' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveEncodingCall(func, args, argTypes, loc) {
        switch (func) {
            case 'char_to_int':
                this.expectArgCount('encoding.char_to_int', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'char' && argTypes[0].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'encoding.char_to_int' first argument must be a char or string");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, "'encoding.char_to_int' second argument must be a string (encoding name)");
                }
                return resolved_types_1.INT_TYPE;
            case 'int_to_char':
                this.expectArgCount('encoding.int_to_char', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int' && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'encoding.int_to_char' first argument must be an int");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, "'encoding.int_to_char' second argument must be a string (encoding name)");
                }
                return resolved_types_1.CHAR_TYPE;
            case 'encode':
                this.expectArgCount('encoding.encode', args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'encoding.encode' first argument must be a string");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, "'encoding.encode' second argument must be a string (encoding name)");
                }
                return (0, resolved_types_1.makeDynArrayType)(resolved_types_1.INT_TYPE);
            case 'decode':
                this.expectArgCount('encoding.decode', args, 2, loc);
                if (argTypes.length >= 1 && !(0, resolved_types_1.isArrayLike)(argTypes[0]) && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'encoding.decode' first argument must be an array of int");
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, "'encoding.decode' second argument must be a string (encoding name)");
                }
                return resolved_types_1.STRING_TYPE;
            case 'list_encodings':
                this.expectArgCount('encoding.list_encodings', args, 0, loc);
                return (0, resolved_types_1.makeDynArrayType)(resolved_types_1.STRING_TYPE);
            default:
                this.error(loc, `'encoding' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveTypesCall(func, args, argTypes, loc) {
        switch (func) {
            case 'from_bin':
            case 'from_hex': {
                this.expectArgCount(`types.${func}`, args, 2, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, `'types.${func}' first argument must be a string`);
                }
                if (argTypes.length >= 2 && argTypes[1].tag !== 'string' && !(0, resolved_types_1.isError)(argTypes[1])) {
                    this.error(loc, `'types.${func}' second argument must be a string (type name)`);
                }
                if (args.length >= 2 && args[1].value.kind === 'StringLiteral') {
                    const typeName = args[1].value.value;
                    if (!resolved_types_1.FIXED_INT_TYPES.has(typeName) && !resolved_types_1.FIXED_FLOAT_TYPES.has(typeName)) {
                        this.error(loc, `'types.${func}' unknown type '${typeName}'. Valid types: int8, int16, int32, int64, uint8, uint16, uint32, uint64, float32, float64`);
                    }
                    return (0, resolved_types_1.makeQualifiedType)('types', typeName);
                }
                return resolved_types_1.INT_TYPE;
            }
            default:
                this.error(loc, `'types' has no function '${func}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveLibraryProperty(libName, propName, loc) {
        if (libName === 'math') {
            if (propName === 'pi' || propName === 'e')
                return resolved_types_1.FLOAT_TYPE;
        }
        this.error(loc, `'${libName}' has no property '${propName}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    resolveStringMethod(method, args, loc) {
        const argTypes = args.map(a => this.inferType(a.value));
        switch (method) {
            case 'length':
                this.expectArgCount('.length', args, 0, loc);
                return resolved_types_1.INT_TYPE;
            case 'contains':
                this.expectArgCount('.contains', args, 1, loc);
                if (argTypes.length >= 1 &&
                    argTypes[0].tag !== 'string' && argTypes[0].tag !== 'char' &&
                    !(0, resolved_types_1.isError)(argTypes[0])) {
                    this.error(loc, "'.contains' expects 'string' or 'char' argument");
                }
                return resolved_types_1.BOOL_TYPE;
            case 'find':
                this.expectArgCount('.find', args, 1, loc);
                return resolved_types_1.INT_TYPE;
            case 'count':
                this.expectArgCount('.count', args, 1, loc);
                return resolved_types_1.INT_TYPE;
            case 'to_upper':
            case 'to_lower':
                this.expectArgCount(`.${method}`, args, 0, loc);
                return resolved_types_1.STRING_TYPE;
            case 'substring':
                if (args.length < 1 || args.length > 2) {
                    this.error(loc, "'.substring' expects 1 or 2 arguments");
                }
                return resolved_types_1.STRING_TYPE;
            case 'replace':
                this.expectArgCount('.replace', args, 2, loc);
                return resolved_types_1.STRING_TYPE;
            case 'split':
                this.expectArgCount('.split', args, 1, loc);
                return (0, resolved_types_1.makeDynArrayType)(resolved_types_1.STRING_TYPE);
            case 'trim':
                this.expectArgCount('.trim', args, 0, loc);
                return resolved_types_1.STRING_TYPE;
            case 'is_int':
            case 'is_float':
                this.expectArgCount(`.${method}`, args, 0, loc);
                return resolved_types_1.BOOL_TYPE;
            default:
                this.error(loc, `type 'string' has no method '${method}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    resolveArrayMethod(arrType, method, args, loc) {
        const argTypes = args.map(a => this.inferType(a.value));
        const elemType = (0, resolved_types_1.getElementType)(arrType) ?? resolved_types_1.ERROR_TYPE;
        const dynamic = (0, resolved_types_1.isDynArray)(arrType);
        switch (method) {
            case 'length':
                this.expectArgCount('.length', args, 0, loc);
                return resolved_types_1.INT_TYPE;
            case 'contains':
                this.expectArgCount('.contains', args, 1, loc);
                if (argTypes.length >= 1 && !(0, resolved_types_1.isAssignable)(elemType, argTypes[0])) {
                    this.error(loc, `'.contains' argument type '${(0, resolved_types_1.typeToString)(argTypes[0])}' does not match element type '${(0, resolved_types_1.typeToString)(elemType)}'`);
                }
                return resolved_types_1.BOOL_TYPE;
            case 'find':
                this.expectArgCount('.find', args, 1, loc);
                return resolved_types_1.INT_TYPE;
            case 'count':
                this.expectArgCount('.count', args, 1, loc);
                return resolved_types_1.INT_TYPE;
            case 'reverse':
                this.expectArgCount('.reverse', args, 0, loc);
                return resolved_types_1.VOID_TYPE;
            case 'sort':
                this.expectArgCount('.sort', args, 0, loc);
                if (!(0, resolved_types_1.isNumeric)(elemType) && elemType.tag !== 'string' && !(0, resolved_types_1.isError)(elemType)) {
                    this.error(loc, "'.sort' only works on numeric or string arrays");
                }
                return resolved_types_1.VOID_TYPE;
            case 'add':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.add', args, 1, loc);
                if (argTypes.length >= 1 && !(0, resolved_types_1.isAssignable)(elemType, argTypes[0])) {
                    this.error(loc, `cannot add '${(0, resolved_types_1.typeToString)(argTypes[0])}' to array of '${(0, resolved_types_1.typeToString)(elemType)}'`);
                }
                return resolved_types_1.VOID_TYPE;
            case 'remove_at':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.remove_at', args, 1, loc);
                if (argTypes.length >= 1 && argTypes[0].tag !== 'int') {
                    this.error(loc, "'.remove_at' expects 'int' index");
                }
                return resolved_types_1.VOID_TYPE;
            case 'resize':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.resize', args, 1, loc);
                return resolved_types_1.VOID_TYPE;
            case 'insert':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.insert', args, 2, loc);
                return resolved_types_1.VOID_TYPE;
            case 'join':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.join', args, 1, loc);
                return resolved_types_1.VOID_TYPE;
            case 'clear':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.clear', args, 0, loc);
                return resolved_types_1.VOID_TYPE;
            case 'pop':
                this.requireDynamic(method, dynamic, loc);
                this.expectArgCount('.pop', args, 0, loc);
                return elemType;
            default:
                this.error(loc, `type '${(0, resolved_types_1.typeToString)(arrType)}' has no method '${method}'`);
                return resolved_types_1.ERROR_TYPE;
        }
    }
    requireDynamic(method, isDyn, loc) {
        if (!isDyn) {
            this.error(loc, `'.${method}' is only available on dynamic arrays (dyn_array)`);
        }
    }
    resolveQualifiedMethod(objType, method, args, loc) {
        const argTypes = args.map(a => this.inferType(a.value));
        if (objType.qualifier === 'gui' || objType.qualifier === 'xanadu') {
            const widgetMethod = (0, gui_1.findWidgetMethod)(objType.name, method);
            if (widgetMethod) {
                if (args.length !== widgetMethod.params.length) {
                    this.error(loc, `'${method}' expects ${widgetMethod.params.length} argument(s), got ${args.length}`);
                }
                return this.widgetPropTypeToResolved(widgetMethod.returnType);
            }
            this.error(loc, `'${objType.qualifier}.${objType.name}' has no method '${method}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        if (objType.qualifier === 'time' && objType.name === 'stamp') {
            switch (method) {
                case 'year':
                case 'month':
                case 'day':
                case 'hour':
                case 'minute':
                case 'second':
                case 'week_day':
                case 'unix':
                    this.expectArgCount(`.${method}`, args, 0, loc);
                    return resolved_types_1.INT_TYPE;
                default:
                    this.error(loc, `'time.stamp' has no method '${method}'`);
                    return resolved_types_1.ERROR_TYPE;
            }
        }
        if (objType.qualifier === 'file') {
            if (objType.name === 'istream' || objType.name === 'stream') {
                switch (method) {
                    case 'read_line':
                        this.expectArgCount('.read_line', args, 0, loc);
                        return resolved_types_1.STRING_TYPE;
                    case 'has_next_line':
                        this.expectArgCount('.has_next_line', args, 0, loc);
                        return resolved_types_1.BOOL_TYPE;
                    case 'close':
                        this.expectArgCount('.close', args, 0, loc);
                        return resolved_types_1.VOID_TYPE;
                    default:
                        this.error(loc, `'file.istream' has no method '${method}'`);
                        return resolved_types_1.ERROR_TYPE;
                }
            }
            if (objType.name === 'ostream') {
                switch (method) {
                    case 'write_line':
                        return resolved_types_1.VOID_TYPE;
                    case 'close':
                        this.expectArgCount('.close', args, 0, loc);
                        return resolved_types_1.VOID_TYPE;
                    default:
                        this.error(loc, `'file.ostream' has no method '${method}'`);
                        return resolved_types_1.ERROR_TYPE;
                }
            }
        }
        if (objType.qualifier === 'types') {
            if (resolved_types_1.FIXED_INT_TYPES.has(objType.name) || resolved_types_1.FIXED_FLOAT_TYPES.has(objType.name)) {
                switch (method) {
                    case 'to_bin':
                    case 'to_hex':
                        this.expectArgCount(`.${method}`, args, 0, loc);
                        return resolved_types_1.STRING_TYPE;
                    case 'get':
                        this.expectArgCount('.get', args, 0, loc);
                        return resolved_types_1.FIXED_INT_TYPES.has(objType.name) ? resolved_types_1.INT_TYPE : resolved_types_1.FLOAT_TYPE;
                    case 'set':
                        this.expectArgCount('.set', args, 1, loc);
                        return resolved_types_1.VOID_TYPE;
                    case 'get_min':
                    case 'get_max':
                    case 'get_bits':
                        this.expectArgCount(`.${method}`, args, 0, loc);
                        return resolved_types_1.INT_TYPE;
                    default:
                        this.error(loc, `'${(0, resolved_types_1.typeToString)(objType)}' has no method '${method}'`);
                        return resolved_types_1.ERROR_TYPE;
                }
            }
        }
        this.error(loc, `'${(0, resolved_types_1.typeToString)(objType)}' has no method '${method}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    resolveQualifiedProperty(objType, prop, loc) {
        if (objType.qualifier === 'gui' || objType.qualifier === 'xanadu') {
            const widgetProp = (0, gui_1.findWidgetProperty)(objType.name, prop);
            if (widgetProp) {
                return this.widgetPropTypeToResolved(widgetProp.type);
            }
            this.error(loc, `'${objType.qualifier}.${objType.name}' has no property '${prop}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        this.error(loc, `'${(0, resolved_types_1.typeToString)(objType)}' has no property '${prop}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    resolveClassField(className, fieldName, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        const field = cls.fields.get(fieldName);
        if (!field) {
            this.error(loc, `'class ${className}' has no field '${fieldName}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        if (field.access === 'private') {
            const currentClass = this.scope.getClassName();
            if (currentClass !== className) {
                this.error(loc, `'${fieldName}' is private in this context`);
            }
        }
        return field.type;
    }
    resolveClassMethod(className, methodName, args, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return resolved_types_1.ERROR_TYPE;
        }
        const methodInfo = cls.methods.get(methodName);
        if (!methodInfo) {
            this.error(loc, `'class ${className}' has no method '${methodName}'`);
            return resolved_types_1.ERROR_TYPE;
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
            return resolved_types_1.ERROR_TYPE;
        }
        const { returnType, paramTypes } = resolvedMethod;
        this.checkArguments(methodName, paramTypes, args, loc);
        return returnType;
    }
    resolveClassFieldOrMethod(className, memberName, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls) {
            this.error(loc, `unknown class '${className}'`);
            return resolved_types_1.ERROR_TYPE;
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
                return resolved_types_1.ERROR_TYPE;
            }
            return (0, resolved_types_1.makeFunctionType)(resolvedMethod.paramTypes, resolvedMethod.returnType);
        }
        this.error(loc, `'class ${className}' has no field or method '${memberName}'`);
        return resolved_types_1.ERROR_TYPE;
    }
    checkConstructorCall(className, args, loc) {
        const cls = this.classRegistry.get(className);
        if (!cls)
            return;
        if (cls.constructors.length === 0) {
            if (args.length > 0) {
                this.error(loc, `class '${className}' has no constructor that accepts arguments`);
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
            this.error(loc, `no matching constructor for '${className}' with ${args.length} argument(s)`);
        }
    }
    checkArguments(funcName, params, args, loc) {
        const minArgs = params.filter(p => !p.hasDefault).length;
        const maxArgs = params.length;
        if (args.length < minArgs || args.length > maxArgs) {
            if (minArgs === maxArgs) {
                this.error(loc, `function '${funcName}' expects ${minArgs} argument(s), got ${args.length}`);
            }
            else {
                this.error(loc, `function '${funcName}' expects ${minArgs} to ${maxArgs} argument(s), got ${args.length}`);
            }
            return;
        }
        const paramNames = params.map(p => p.name);
        for (const arg of args) {
            if (arg.name !== null) {
                if (!paramNames.includes(arg.name)) {
                    this.error(arg.loc, `function '${funcName}' has no parameter named '${arg.name}'`);
                    return;
                }
            }
        }
        const reordered = this.reorderArgsByParams(args, params);
        for (let i = 0; i < reordered.length && i < params.length; i++) {
            const argType = this.typeMap.get(reordered[i].value) ?? this.inferType(reordered[i].value);
            if (!(0, resolved_types_1.isAssignable)(params[i].type, argType)) {
                this.error(reordered[i].loc, `cannot convert '${(0, resolved_types_1.typeToString)(argType)}' to '${(0, resolved_types_1.typeToString)(params[i].type)}' for argument ${i + 1} of '${funcName}'`);
            }
        }
    }
    reorderArgsByParams(args, params) {
        const hasNamed = args.some(a => a.name !== null);
        if (!hasNamed) {
            return args;
        }
        const paramNames = params.map(p => p.name);
        const result = new Array(paramNames.length);
        const usedIndices = new Set();
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
    isCallCompatible(params, argTypes) {
        const minArgs = params.filter(p => !p.hasDefault).length;
        if (argTypes.length < minArgs || argTypes.length > params.length)
            return false;
        for (let i = 0; i < argTypes.length; i++) {
            if (!(0, resolved_types_1.isAssignable)(params[i].type, argTypes[i]))
                return false;
        }
        return true;
    }
    expectArgCount(name, args, expected, loc) {
        if (args.length !== expected) {
            this.error(loc, `'${name}' expects ${expected} argument(s), got ${args.length}`);
        }
    }
    expectNumericArgs(name, argTypes, loc) {
        for (let i = 0; i < argTypes.length; i++) {
            if (!(0, resolved_types_1.isNumeric)(argTypes[i]) && !(0, resolved_types_1.isError)(argTypes[i])) {
                this.error(loc, `'${name}' argument ${i + 1} must be numeric, got '${(0, resolved_types_1.typeToString)(argTypes[i])}'`);
            }
        }
    }
    expectAllType(name, argTypes, expected, loc) {
        for (let i = 0; i < argTypes.length; i++) {
            if (!(0, resolved_types_1.isError)(argTypes[i]) && !(0, resolved_types_1.typesEqual)(argTypes[i], expected)) {
                this.error(loc, `'${name}' argument ${i + 1} must be '${(0, resolved_types_1.typeToString)(expected)}', got '${(0, resolved_types_1.typeToString)(argTypes[i])}'`);
            }
        }
    }
}
exports.Analyzer = Analyzer;
//# sourceMappingURL=analyzer.js.map