// src/compiler/codegen.ts

import {
    Program, UseDeclaration, TopLevelDecl,
    FunctionDecl, ClassDecl, ClassMember, ClassField, ClassMethod,
    ClassConstructor, ClassDestructor,
    Block, Statement, VariableDecl, AssignmentStmt,
    MultiVariableDecl,
    ExpressionStmt, IfStmt, WhileStmt, DoWhileStmt, ForStmt,
    ReturnStmt, BreakStmt, ContinueStmt, TryStmt,
    Expression, BinaryExpr, UnaryMinusExpr, NotExpr,
    IntLiteralExpr, FloatLiteralExpr, StringLiteralExpr,
    CharLiteralExpr, BoolLiteralExpr, ArrayLiteralExpr,
    IdentifierExpr, ThisExpr,
    FunctionCallExpr, MethodCallExpr, ConstructorCallExpr, ParentCallExpr,
    PropertyAccessExpr, IndexAccessExpr,
    LambdaExpr,
    TypeNode, Parameter, Argument,
    SourceLocation,
} from './ast';

import {
    ResolvedType,
    INT_TYPE, FLOAT_TYPE, STRING_TYPE, CHAR_TYPE,
    BOOL_TYPE, VOID_TYPE, ERROR_TYPE,
    typeToString, isNumeric, isArrayLike, isDynArray,
    isError, isVoid, getElementType,
} from './resolved-types';

import { SemanticInfo, type UserModuleInfo } from './analyzer';
import { FIXED_INT_TYPES, FIXED_FLOAT_TYPES } from './resolved-types';

function isFixedType(type: ResolvedType): boolean {
    if (type.tag !== 'qualified') return false;
    if (type.qualifier !== 'types') return false;
    return FIXED_INT_TYPES.has(type.name) || FIXED_FLOAT_TYPES.has(type.name);
}

function getFixedTypeName(type: ResolvedType): string | null {
    if (type.tag !== 'qualified') return null;
    if (type.qualifier !== 'types') return null;
    if (FIXED_INT_TYPES.has(type.name) || FIXED_FLOAT_TYPES.has(type.name)) {
        return type.name;
    }
    return null;
}

function $loc(loc: SourceLocation): string {
    return `"${loc.file}",${loc.line}`;
}

function escapeJSString(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\0/g, '\\0')
        .replace(/\x1b/g, '\\x1b');
}

const JS_RESERVED = new Set([
    'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case',
    'catch', 'char', 'class', 'const', 'continue', 'debugger', 'default',
    'delete', 'do', 'double', 'else', 'enum', 'eval', 'export', 'extends',
    'false', 'final', 'finally', 'float', 'for', 'function', 'goto', 'if',
    'implements', 'import', 'in', 'instanceof', 'int', 'interface', 'let',
    'long', 'native', 'new', 'null', 'package', 'private', 'protected',
    'public', 'return', 'short', 'static', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'transient', 'true', 'try', 'typeof', 'var',
    'void', 'volatile', 'while', 'with', 'yield',
    'undefined', 'NaN', 'Infinity', 'console', 'Math', 'Array', 'Object',
    'String', 'Number', 'Boolean', 'Symbol', 'Promise',
]);

function safeName(name: string): string {
    if (JS_RESERVED.has(name)) return `_${name}`;
    return name;
}

export class CodeGenerator {

    private readonly info: SemanticInfo;
    private readonly program: Program;
    private output: string[] = [];
    private indentLevel: number = 0;
    private readonly indentStr: string = '  ';

    private readonly functionParams: Map<string, string[]> = new Map();
    private readonly methodParams: Map<string, string[]> = new Map();

    constructor(info: SemanticInfo, program: Program) {
        this.info = info;
        this.program = program;
        this.buildParamsCache();
    }

    private buildParamsCache(): void {
        for (const decl of this.program.declarations) {
            if (decl.kind === 'FunctionDecl') {
                this.functionParams.set(decl.name, decl.params.map(p => p.name));
            } else if (decl.kind === 'ClassDecl') {
                for (const member of decl.members) {
                    if (member.kind === 'ClassMethod') {
                        const key = `${decl.name}.${member.name}`;
                        this.methodParams.set(key, member.params.map(p => p.name));
                    } else if (member.kind === 'ClassConstructor') {
                        const key = `${decl.name}.__constructor__`;
                        this.methodParams.set(key, member.params.map(p => p.name));
                    }
                }
            }
        }

        this.functionParams.set('main', this.program.main.params.map(p => p.name));

        for (const [moduleName, moduleInfo] of this.info.userModules) {
            for (const decl of moduleInfo.ast.declarations) {
                if (decl.kind === 'FunctionDecl') {
                    const key = `${moduleName}.${decl.name}`;
                    this.functionParams.set(key, decl.params.map(p => p.name));
                } else if (decl.kind === 'ClassDecl') {
                    for (const member of decl.members) {
                        if (member.kind === 'ClassMethod') {
                            const key = `${moduleName}.${decl.name}.${member.name}`;
                            this.methodParams.set(key, member.params.map(p => p.name));
                        } else if (member.kind === 'ClassConstructor') {
                            const key = `${moduleName}.${decl.name}.__constructor__`;
                            this.methodParams.set(key, member.params.map(p => p.name));
                        }
                    }
                }
            }
        }
    }

    private reorderArguments(args: Argument[], paramNames: string[]): Argument[] {
        const hasNamed = args.some(a => a.name !== null);
        if (!hasNamed) {
            return args;
        }
    
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

    generate(program: Program): string {
        this.output = [];

        this.emit('(async function($rt) {');
        this.indent();

        for (const [moduleName, moduleInfo] of this.info.userModules) {
            this.genUserModule(moduleName, moduleInfo);
        }

        for (const decl of program.declarations) {
            if (decl.kind === 'FunctionDecl') {
                this.genFunctionDecl(decl);
                this.emitLine('');
            } else if (decl.kind === 'ClassDecl') {
                this.genClassDecl(decl);
                this.emitLine('');
            }
        }

        this.genFunctionDecl(program.main);
        this.emitLine('');

        this.emit('await main();');

        this.dedent();
        this.emit('})');

        return this.output.join('\n');
    }

    private getFunctionParams(name: string): string[] | null {
        return null;
    }

    private genUserModule(moduleName: string, moduleInfo: UserModuleInfo): void {
        this.emitLine('');
        this.emit(`// ─── Module: ${moduleName} ───`);
    
        const safeMod = safeName(moduleName);
        this.emit(`const ${safeMod} = {};`);
    
        for (const decl of moduleInfo.ast.declarations) {
            if (decl.kind === 'ClassDecl') {
                this.genModuleClass(safeMod, decl);
            }
        }
    
        for (const decl of moduleInfo.ast.declarations) {
            if (decl.kind === 'FunctionDecl') {
                const funcName = safeName(decl.name);
                const params = decl.params.map(p => this.genParamWithDefault(p)).join(', ');
    
                this.emit(`${safeMod}.${funcName} = async function(${params}) {`);
                this.indent();
                this.genBlockBody(decl.body);
                this.dedent();
                this.emit('};');
            }
        }
    
        this.emitLine('');
    }
    
    private genModuleClass(moduleName: string, decl: ClassDecl): void {
        const className = safeName(decl.name);
    
        let ext = '';
        if (decl.parentClass) {
            if (decl.parentModule) {
                ext = ` extends ${safeName(decl.parentModule)}.${safeName(decl.parentClass)}`;
            } else {
                ext = ` extends ${moduleName}.${safeName(decl.parentClass)}`;
            }
        }
    
        this.emit(`${moduleName}.${className} = class${ext} {`);
        this.indent();
    
        const ctors = decl.members.filter(m => m.kind === 'ClassConstructor') as ClassConstructor[];
        const fields = decl.members.filter(m => m.kind === 'ClassField') as ClassField[];
        const dtor = decl.members.find(m => m.kind === 'ClassDestructor') as ClassDestructor | undefined;
    
        if (ctors.length > 0) {
            this.genConstructor(ctors[0], fields, decl.parentClass !== null);
        } else {
            this.genDefaultConstructor(fields, decl.parentClass !== null);
        }
    
        for (const member of decl.members) {
            if (member.kind === 'ClassMethod') {
                this.genClassMethod(member);
            }
        }
    
        if (dtor) {
            this.genDestructor(dtor);
        }
    
        this.dedent();
        this.emit('};');
    }

    private genModuleFunction(moduleName: string, decl: FunctionDecl): void {
        const name = safeName(decl.name);
        const params = decl.params.map(p => this.genParamWithDefault(p)).join(', ');
    
        this.emit(`${safeName(moduleName)}.${name} = async function(${params}) {`);
        this.indent();
        this.genBlockBody(decl.body);
        this.dedent();
        this.emit('};');
    }

    private emit(code: string): void {
        this.output.push(this.currentIndent() + code);
    }

    private emitLine(code: string): void {
        this.output.push(code);
    }

    private emitRaw(code: string): void {
        this.output.push(code);
    }

    private indent(): void {
        this.indentLevel++;
    }

    private dedent(): void {
        this.indentLevel = Math.max(0, this.indentLevel - 1);
    }

    private currentIndent(): string {
        return this.indentStr.repeat(this.indentLevel);
    }

    private typeOf(expr: Expression): ResolvedType {
        return this.info.expressionTypes.get(expr) ?? ERROR_TYPE;
    }

    private defaultValue(type: TypeNode): string {
        switch (type.kind) {
            case 'PrimitiveType':
                switch (type.name) {
                    case 'int':    return '0';
                    case 'float':  return '0.0';
                    case 'bool':   return 'false';
                    case 'char':   return '"\\0"';
                    case 'string': return '""';
                    case 'void':   return 'undefined';
                }
                break;
                
            case 'ArrayType': {
                if (this.needsFactory(type.elementType)) {
                    const factory = this.defaultValueFactory(type.elementType);
                    return `$rt.IdylArray.generate(${type.size}, ${factory}, true)`;
                }
                const elemDefault = this.defaultValue(type.elementType);
                return `$rt.IdylArray.filled(${type.size}, ${elemDefault}, true)`;
            }
    
            case 'DynArrayType':
                return `$rt.IdylArray.empty(false)`;
                
            case 'ClassType':
                return `new ${safeName(type.name)}()`;
                
            case 'QualifiedType':
                if (type.qualifier === 'gui' || type.qualifier === 'xanadu') {
                    return `new $rt.gui.${type.name}()`;
                }
                if (type.qualifier === 'types') {
                    if (FIXED_INT_TYPES.has(type.name) || FIXED_FLOAT_TYPES.has(type.name)) {
                        return `$rt.types.${type.name}(0)`;
                    }
                }
                if (this.info.userModules.has(type.qualifier)) {
                    return `new ${safeName(type.qualifier)}.${safeName(type.name)}()`;
                }
                return 'null';
        }
        return 'undefined';
    }

    private needsFactory(type: TypeNode): boolean {
        switch (type.kind) {
            case 'ClassType':
                return true;
            case 'QualifiedType':
                if (type.qualifier === 'gui' || type.qualifier === 'xanadu') return true;
                if (this.info.userModules.has(type.qualifier)) return true;
                return false;
            case 'ArrayType':
            case 'DynArrayType':
                return true;
            default:
                return false;
        }
    }
    
    private defaultValueFactory(type: TypeNode): string {
        switch (type.kind) {
            case 'ClassType':
                return `() => new ${safeName(type.name)}()`;
            case 'QualifiedType':
                if (type.qualifier === 'gui' || type.qualifier === 'xanadu') {
                    return `() => new $rt.gui.${type.name}()`;
                }
                if (type.qualifier === 'types') {
                    if (FIXED_INT_TYPES.has(type.name) || FIXED_FLOAT_TYPES.has(type.name)) {
                        return `() => $rt.types.${type.name}(0)`;
                    }
                }
                if (this.info.userModules.has(type.qualifier)) {
                    return `() => new ${safeName(type.qualifier)}.${safeName(type.name)}()`;
                }
                return `() => null`;
            case 'ArrayType':
                if (this.needsFactory(type.elementType)) {
                    const innerFactory = this.defaultValueFactory(type.elementType);
                    return `() => $rt.IdylArray.generate(${type.size}, ${innerFactory}, true)`;
                }
                return `() => $rt.IdylArray.filled(${type.size}, ${this.defaultValue(type.elementType)}, true)`;
            case 'DynArrayType':
                return `() => $rt.IdylArray.empty(false)`;
            default:
                return `() => ${this.defaultValue(type)}`;
        }
    }

    private genFunctionDecl(decl: FunctionDecl): void {
        const name = safeName(decl.name);
        const params = decl.params.map(p => this.genParamWithDefault(p)).join(', ');

        this.emit(`async function ${name}(${params}) {`);
        this.indent();
        this.genBlockBody(decl.body);
        this.dedent();
        this.emit('}');
    }

    private genParamWithDefault(param: Parameter): string {
        const name = safeName(param.name);
        if (param.defaultValue !== null) {
            return `${name} = ${this.genExpr(param.defaultValue)}`;
        }
        return name;
    }

    private genClassDecl(decl: ClassDecl): void {
        const name = safeName(decl.name);
    
        let ext = '';
        if (decl.parentClass) {
            if (decl.parentModule) {
                ext = ` extends ${safeName(decl.parentModule)}.${safeName(decl.parentClass)}`;
            } else {
                ext = ` extends ${safeName(decl.parentClass)}`;
            }
        }
    
        this.emit(`class ${name}${ext} {`);
        this.indent();
    
        const ctors = decl.members.filter(m => m.kind === 'ClassConstructor') as ClassConstructor[];
        const fields = decl.members.filter(m => m.kind === 'ClassField') as ClassField[];
        const dtor = decl.members.find(m => m.kind === 'ClassDestructor') as ClassDestructor | undefined;
    
        if (ctors.length > 0) {
            this.genConstructor(ctors[0], fields, decl.parentClass !== null);
        } else {
            this.genDefaultConstructor(fields, decl.parentClass !== null);
        }
    
        for (const member of decl.members) {
            if (member.kind === 'ClassMethod') {
                this.genClassMethod(member);
            }
        }
    
        if (dtor) {
            this.genDestructor(dtor);
        }
    
        this.dedent();
        this.emit('}');

        const staticFields = fields.filter(f => f.isStatic);
        for (const field of staticFields) {
            const val = field.initializer !== null
                ? this.genExpr(field.initializer)
                : this.defaultValue(field.fieldType);
            this.emit(`${name}.${safeName(field.name)} = ${val};`);
        }
    }

    private genDefaultConstructor(fields: ClassField[], hasParent: boolean): void {
        const instanceFields = fields.filter(f => !f.isStatic);
        this.emit('constructor() {');
        this.indent();
        if (hasParent) {
            this.emit('super();');
        }
        for (const field of instanceFields) {
            const val = field.initializer !== null
                ? this.genExpr(field.initializer)
                : this.defaultValue(field.fieldType);
            this.emit(`this.${safeName(field.name)} = ${val};`);
        }
        this.dedent();
        this.emit('}');
    }

    private genConstructor(
        ctor: ClassConstructor, fields: ClassField[], hasParent: boolean,
    ): void {
        const instanceFields = fields.filter(f => !f.isStatic);
        const params = ctor.params.map(p => this.genParamWithDefault(p)).join(', ');
        this.emit(`constructor(${params}) {`);
        this.indent();

        if (ctor.parentArgs !== null) {
            const parentParamNames = this.resolveParentConstructorParams(ctor);
            const reorderedArgs = parentParamNames
                ? this.reorderArguments(ctor.parentArgs, parentParamNames)
                : ctor.parentArgs;
            const args = reorderedArgs.map(a => this.genExpr(a.value)).join(', ');
            this.emit(`super(${args});`);
        } else if (hasParent) {
            this.emit('super();');
        }

        for (const field of instanceFields) {
            const val = field.initializer !== null
                ? this.genExpr(field.initializer)
                : this.defaultValue(field.fieldType);
            this.emit(`this.${safeName(field.name)} = ${val};`);
        }
        this.genBlockBody(ctor.body);
        this.dedent();
        this.emit('}');
    }

    private resolveParentConstructorParams(ctor: ClassConstructor): string[] | null {
        for (const decl of this.program.declarations) {
            if (decl.kind === 'ClassDecl' && decl.name === ctor.className) {
                if (decl.parentClass) {
                    const key = decl.parentModule
                        ? `${decl.parentModule}.${decl.parentClass}.__constructor__`
                        : `${decl.parentClass}.__constructor__`;
                    return this.methodParams.get(key) || null;
                }
            }
        }
        return null;
    }

    private genClassMethod(method: ClassMethod): void {
        const name = safeName(method.name);
        const params = method.params.map(p => this.genParamWithDefault(p)).join(', ');
        const staticPrefix = method.isStatic ? 'static ' : '';
        this.emit(`${staticPrefix}async ${name}(${params}) {`);
        this.indent();
        this.genBlockBody(method.body);
        this.dedent();
        this.emit('}');
    }

    private genDestructor(dtor: ClassDestructor): void {
        this.emit('async __destructor__() {');
        this.indent();
        this.genBlockBody(dtor.body);
        this.dedent();
        this.emit('}');
    }

    private genBlockBody(block: Block): void {
        for (const stmt of block.statements) {
            this.genStatement(stmt);
        }
    }

    private genBlock(block: Block): void {
        this.emit('{');
        this.indent();
        this.genBlockBody(block);
        this.dedent();
        this.emit('}');
    }

    private genStatement(stmt: Statement): void {
        switch (stmt.kind) {
            case 'VariableDecl':    this.genVarDecl(stmt);       break;
            case 'MultiVariableDecl': this.genMultiVarDecl(stmt);  break; 
            case 'AssignmentStmt':  this.genAssignment(stmt);    break;
            case 'ExpressionStmt':  this.genExprStmt(stmt);      break;
            case 'IfStmt':          this.genIf(stmt);            break;
            case 'WhileStmt':       this.genWhile(stmt);         break;
            case 'DoWhileStmt':     this.genDoWhile(stmt);       break;
            case 'ForStmt':         this.genFor(stmt);           break;
            case 'ReturnStmt':      this.genReturn(stmt);        break;
            case 'BreakStmt':       this.emit('break;');         break;
            case 'ContinueStmt':    this.emit('continue;');      break;
            case 'TryStmt':         this.genTry(stmt);           break;
        }
    }

    private genVarDecl(decl: VariableDecl): void {
        const name = safeName(decl.name);
    
        if (decl.varType.kind === 'QualifiedType') {
            const qt = decl.varType;
            if (qt.qualifier === 'gui' || qt.qualifier === 'xanadu') {
                this.emit(`let ${name} = new $rt.gui.${qt.name}();`);
                return;
            }
    
            if (qt.qualifier === 'types' &&
                (FIXED_INT_TYPES.has(qt.name) || FIXED_FLOAT_TYPES.has(qt.name))) {
                if (decl.initializer !== null) {
                    const initValue = this.genExpr(decl.initializer);
                    this.emit(`let ${name} = $rt.types.${qt.name}(${initValue});`);
                } else {
                    this.emit(`let ${name} = $rt.types.${qt.name}(0);`);
                }
                return;
            }
    
            if (this.info.userModules.has(qt.qualifier)) {
                if (decl.constructorArgs !== null) {
                    const paramNames = this.methodParams.get(
                        `${qt.qualifier}.${qt.name}.__constructor__`
                    ) || [];
                    const reorderedArgs = this.reorderArguments(decl.constructorArgs, paramNames);
                    const args = reorderedArgs.map(a => this.genExpr(a.value)).join(', ');
                    this.emit(`let ${name} = new ${safeName(qt.qualifier)}.${safeName(qt.name)}(${args});`);
                } else {
                    this.emit(`let ${name} = new ${safeName(qt.qualifier)}.${safeName(qt.name)}();`);
                }
                return;
            }
        }
    
        if (decl.initializer !== null) {
            const value = this.genExpr(decl.initializer);
            const initType = this.typeOf(decl.initializer);
    
            if (decl.varType.kind === 'ArrayType') {
                this.emit(`let ${name} = $rt.IdylArray.from(${value}, ${decl.varType.size}, true);`);
            } else if (decl.varType.kind === 'DynArrayType') {
                if (this.isArrayReturningExpression(decl.initializer)) {
                    this.emit(`let ${name} = ${value};`);
                } else {
                    this.emit(`let ${name} = $rt.IdylArray.from(${value}, -1, false);`);
                }
            } else {
                this.emit(`let ${name} = ${value};`);
            }
        } else if (decl.constructorArgs !== null) {
            const typeName = decl.varType.kind === 'ClassType'
                ? safeName(decl.varType.name) : 'Object';
            
            const paramNames = this.methodParams.get(
                `${decl.varType.kind === 'ClassType' ? decl.varType.name : ''}.__constructor__`
            ) || [];
            const reorderedArgs = this.reorderArguments(decl.constructorArgs, paramNames);
            const args = reorderedArgs.map(a => this.genExpr(a.value)).join(', ');
            
            this.emit(`let ${name} = new ${typeName}(${args});`);
        } else {
            const val = this.defaultValue(decl.varType);
            this.emit(`let ${name} = ${val};`);
        }
    }
    
    private isArrayReturningExpression(expr: Expression): boolean {
        if (expr.kind === 'MethodCall') {
            const objType = this.typeOf(expr.object);
            if (objType.tag === 'string') {
                if (expr.method === 'split') {
                    return true;
                }
            }

            if (isArrayLike(objType)) {
                return false;
            }
        }
        
        if (expr.kind === 'FunctionCall') {
            return false;
        }
        
        return false;
    }

    private genMultiVarDecl(decl: MultiVariableDecl): void {
        for (const d of decl.declarations) {
            const name = safeName(d.name);
    
            if (decl.varType.kind === 'QualifiedType') {
                const qt = decl.varType;
                if (qt.qualifier === 'gui' || qt.qualifier === 'xanadu') {
                    this.emit(`let ${name} = new $rt.gui.${qt.name}();`);
                    continue;
                }
    
                if (qt.qualifier === 'types' &&
                    (FIXED_INT_TYPES.has(qt.name) || FIXED_FLOAT_TYPES.has(qt.name))) {
                    if (d.initializer !== null) {
                        const initValue = this.genExpr(d.initializer);
                        this.emit(`let ${name} = $rt.types.${qt.name}(${initValue});`);
                    } else {
                        this.emit(`let ${name} = $rt.types.${qt.name}(0);`);
                    }
                    continue;
                }
    
                if (this.info.userModules.has(qt.qualifier)) {
                    if (d.constructorArgs !== null) {
                        const paramNames = this.methodParams.get(
                            `${qt.qualifier}.${qt.name}.__constructor__`
                        ) || [];
                        const reorderedArgs = this.reorderArguments(d.constructorArgs, paramNames);
                        const args = reorderedArgs.map(a => this.genExpr(a.value)).join(', ');
                        this.emit(`let ${name} = new ${safeName(qt.qualifier)}.${safeName(qt.name)}(${args});`);
                    } else {
                        this.emit(`let ${name} = new ${safeName(qt.qualifier)}.${safeName(qt.name)}();`);
                    }
                    continue;
                }
            }
    
            if (d.initializer !== null) {
                const value = this.genExpr(d.initializer);
    
                if (decl.varType.kind === 'ArrayType') {
                    this.emit(`let ${name} = $rt.IdylArray.from(${value}, ${decl.varType.size}, true);`);
                } else if (decl.varType.kind === 'DynArrayType') {
                    if (this.isArrayReturningExpression(d.initializer)) {
                        this.emit(`let ${name} = ${value};`);
                    } else {
                        this.emit(`let ${name} = $rt.IdylArray.from(${value}, -1, false);`);
                    }
                } else {
                    this.emit(`let ${name} = ${value};`);
                }
            } else if (d.constructorArgs !== null) {
                const typeName = decl.varType.kind === 'ClassType'
                    ? safeName(decl.varType.name) : 'Object';
    
                const paramNames = this.methodParams.get(
                    `${decl.varType.kind === 'ClassType' ? decl.varType.name : ''}.__constructor__`
                ) || [];
                const reorderedArgs = this.reorderArguments(d.constructorArgs, paramNames);
                const args = reorderedArgs.map(a => this.genExpr(a.value)).join(', ');
    
                this.emit(`let ${name} = new ${typeName}(${args});`);
            } else {
                const val = this.defaultValue(decl.varType);
                this.emit(`let ${name} = ${val};`);
            }
        }
    }

    private genAssignment(stmt: AssignmentStmt): void {
        const targetType = this.typeOf(stmt.target);
        
        if (isFixedType(targetType)) {
            const target = this.genAssignTarget(stmt.target);
            const value = this.genExpr(stmt.value);
            
            if (stmt.operator === '=') {
                this.emit(`${target}.set(${value});`);
            } else {
                const op = stmt.operator[0];
                this.emit(`${target}.set(${target}.get() ${op} ${value});`);
            }
            return;
        }

        // String index assignment: str[i] = ch  →  str = $rt.strSetChar(str, i, ch, loc)
        if (stmt.target.kind === 'IndexAccess') {
            const objType = this.typeOf(stmt.target.object);

            if (objType.tag === 'string') {
                const obj = this.genAssignTarget(stmt.target.object);
                const idx = this.genExpr(stmt.target.index);
                const val = this.genExpr(stmt.value);
                const loc = $loc(stmt.loc);
                this.emit(`${obj} = $rt.strSetChar(${obj}, ${idx}, ${val}, ${loc});`);
                return;
            }

            if (isArrayLike(objType)) {
                const obj = this.genExpr(stmt.target.object);
                const idx = this.genExpr(stmt.target.index);
                const val = this.genExpr(stmt.value);
                const loc = $loc(stmt.loc);
    
                if (stmt.operator === '=') {
                    this.emit(`${obj}.set(${idx}, ${val}, ${loc});`);
                } else {
                    const op = stmt.operator[0];
                    this.emit(`${obj}.set(${idx}, (${obj}.get(${idx}, ${loc}) ${op} ${val}), ${loc});`);
                }
                return;
            }
        }

        // Array-to-array assignment: copy via $rt.IdylArray.from()
        if (stmt.operator === '=' && isArrayLike(targetType)) {
            const target = this.genAssignTarget(stmt.target);
            const value = this.genExpr(stmt.value);
            const fixed = targetType.tag === 'array' ? 'true' : 'false';
            const size = targetType.tag === 'array' ? (targetType as any).size : -1;
            this.emit(`${target} = $rt.IdylArray.from(${value}, ${size}, ${fixed});`);
            return;
        }
    
        const target = this.genAssignTarget(stmt.target);
        const value = this.genExpr(stmt.value);
        this.emit(`${target} ${stmt.operator} ${value};`);
    }

    private genAssignTarget(target: Expression): string {
        switch (target.kind) {
            case 'Identifier':
                return safeName(target.name);

            case 'PropertyAccess': {
                const obj = this.genExpr(target.object);
                return `${obj}.${safeName(target.property)}`;
            }

            case 'IndexAccess': {
                const obj = this.genExpr(target.object);
                const idx = this.genExpr(target.index);
                const objType = this.typeOf(target.object);

                if (isArrayLike(objType)) {
                    return `${obj}.set(${idx}, ${$loc(target.loc)})`;
                }
                return `${obj}[${idx}]`;
            }

            default:
                return '/* invalid target */';
        }
    }

    private genExprStmt(stmt: ExpressionStmt): void {
        const expr = this.genExpr(stmt.expression);
        this.emit(`${expr};`);
    }

    private genIf(stmt: IfStmt): void {
        this.emit(`if (${this.genExpr(stmt.condition)}) {`);
        this.indent();
        this.genBlockBody(stmt.thenBlock);
        this.dedent();

        for (const clause of stmt.elseIfClauses) {
            this.emit(`} else if (${this.genExpr(clause.condition)}) {`);
            this.indent();
            this.genBlockBody(clause.block);
            this.dedent();
        }

        if (stmt.elseBlock !== null) {
            this.emit('} else {');
            this.indent();
            this.genBlockBody(stmt.elseBlock);
            this.dedent();
        }

        this.emit('}');
    }

    private genWhile(stmt: WhileStmt): void {
        this.emit(`while (${this.genExpr(stmt.condition)}) {`);
        this.indent();
        this.genBlockBody(stmt.body);
        this.dedent();
        this.emit('}');
    }

    private genDoWhile(stmt: DoWhileStmt): void {
        this.emit('do {');
        this.indent();
        this.genBlockBody(stmt.body);
        this.dedent();
        this.emit(`} while (${this.genExpr(stmt.condition)});`);
    }

    private genFor(stmt: ForStmt): void {
        const initName = safeName(stmt.init.name);
        
        let initVal: string;
        
        if (stmt.init.varType.kind === 'QualifiedType') {
            const qt = stmt.init.varType;
            if (qt.qualifier === 'types' && 
                (FIXED_INT_TYPES.has(qt.name) || FIXED_FLOAT_TYPES.has(qt.name))) {
                const rawVal = stmt.init.initializer !== null
                    ? this.genExpr(stmt.init.initializer) : '0';
                initVal = `$rt.types.${qt.name}(${rawVal})`;
            } else {
                initVal = stmt.init.initializer !== null
                    ? this.genExpr(stmt.init.initializer) : '0';
            }
        } else {
            initVal = stmt.init.initializer !== null
                ? this.genExpr(stmt.init.initializer) : '0';
        }
    
        const cond = this.genExpr(stmt.condition);
    
        const updateTargetType = this.typeOf(stmt.update.target);
        let updateExpr: string;
        
        if (isFixedType(updateTargetType)) {
            const target = this.genAssignTarget(stmt.update.target);
            const value = this.genExpr(stmt.update.value);
            
            if (stmt.update.operator === '=') {
                updateExpr = `${target}.set(${value})`;
            } else {
                const op = stmt.update.operator[0];
                updateExpr = `${target}.set(${target}.get() ${op} ${value})`;
            }
        } else {
            const updTarget = this.genAssignTarget(stmt.update.target);
            const updValue = this.genExpr(stmt.update.value);
            const updOp = stmt.update.operator;
            updateExpr = `${updTarget} ${updOp} ${updValue}`;
        }
    
        this.emit(`for (let ${initName} = ${initVal}; ${cond}; ${updateExpr}) {`);
        this.indent();
        this.genBlockBody(stmt.body);
        this.dedent();
        this.emit('}');
    }

    private genReturn(stmt: ReturnStmt): void {
        if (stmt.value !== null) {
            this.emit(`return ${this.genExpr(stmt.value)};`);
        } else {
            this.emit('return;');
        }
    }

    private genTry(stmt: TryStmt): void {
        this.emit('try {');
        this.indent();
        this.genBlockBody(stmt.tryBlock);
        this.dedent();
    
        if (stmt.catchParam !== null) {
            const paramName = safeName(stmt.catchParam.name);
            this.emit(`} catch (__err) {`);
            this.indent();
            this.emit(`let ${paramName} = __err instanceof Error ? __err.message : String(__err);`);
            this.genBlockBody(stmt.catchBlock);
            this.dedent();
        } else {
            this.emit('} catch (__err) {');
            this.indent();
            this.genBlockBody(stmt.catchBlock);
            this.dedent();
        }
    
        this.emit('}');
    }

    private genExpr(expr: Expression): string {
        switch (expr.kind) {
            case 'IntLiteral':      return this.genIntLiteral(expr);
            case 'FloatLiteral':    return this.genFloatLiteral(expr);
            case 'StringLiteral':   return this.genStringLiteral(expr);
            case 'CharLiteral':     return this.genCharLiteral(expr);
            case 'BoolLiteral':     return expr.value ? 'true' : 'false';
            case 'ArrayLiteral':    return this.genArrayLiteral(expr);
            case 'Identifier':      return this.genIdentifier(expr);
            case 'ThisExpr':        return 'this';
            case 'BinaryExpr':      return this.genBinary(expr);
            case 'UnaryMinus':      return this.genUnaryMinus(expr);
            case 'NotExpr':         return this.genNot(expr);
            case 'FunctionCall':    return this.genFunctionCall(expr);
            case 'MethodCall':      return this.genMethodCall(expr);
            case 'PropertyAccess':  return this.genPropertyAccess(expr);
            case 'IndexAccess':     return this.genIndexAccess(expr);
            case 'Lambda':          return this.genLambda(expr);
            case 'ConstructorCall': return this.genConstructorCall(expr);
            case 'ParentCall': return this.genParentCall(expr);
        }
    }

    private genIntLiteral(expr: IntLiteralExpr): string {
        return expr.value.toString();
    }

    private genFloatLiteral(expr: FloatLiteralExpr): string {
        const value = expr.value;
    
        const str = value.toString();
        
        if (str.includes('e') || str.includes('E')) {
            const cleaned = str.replace(/\.0(?=[eE])/, '');
            return cleaned;
        }
        
        return str.includes('.') ? str : str + '.0';
    }

    private genStringLiteral(expr: StringLiteralExpr): string {
        return `"${escapeJSString(expr.value)}"`;
    }

    private genCharLiteral(expr: CharLiteralExpr): string {
        return `"${escapeJSString(expr.value)}"`;
    }

    private genArrayLiteral(expr: ArrayLiteralExpr): string {
        const elems = expr.elements.map(e => this.genExpr(e)).join(', ');
        return `[${elems}]`;
    }

    private genIdentifier(expr: IdentifierExpr): string {
        return safeName(expr.name);
    }

    private genBinary(expr: BinaryExpr): string {
        const left = this.genExpr(expr.left);
        const right = this.genExpr(expr.right);
        const leftType = this.typeOf(expr.left);
        const rightType = this.typeOf(expr.right);
    
        const leftFixed = isFixedType(leftType);
        const rightFixed = isFixedType(rightType);
    
        if (leftFixed || rightFixed) {
            const leftVal = leftFixed ? `${left}.get()` : left;
            const rightVal = rightFixed ? `${right}.get()` : right;
    
            let jsOp: string;
            switch (expr.operator) {
                case '+':   jsOp = '+';   break;
                case '-':   jsOp = '-';   break;
                case '*':   jsOp = '*';   break;
                case '/':   jsOp = '/';   break;
                case '==':  jsOp = '==='; break;
                case '!=':  jsOp = '!=='; break;
                case '<':   jsOp = '<';   break;
                case '>':   jsOp = '>';   break;
                case '<=':  jsOp = '<=';  break;
                case '>=':  jsOp = '>=';  break;
                case 'and': jsOp = '&&';  break;
                case 'or':  jsOp = '||';  break;
                case 'xor':
                    return `(${leftVal} !== ${rightVal})`;
                default:
                    jsOp = expr.operator;
            }
    
            return `(${leftVal} ${jsOp} ${rightVal})`;
        }

        // Array comparison
        if ((expr.operator === '==' || expr.operator === '!=') &&
            isArrayLike(leftType) && isArrayLike(rightType)) {
            const eq = `$rt.arraysEqual(${left}, ${right})`;
            return expr.operator === '==' ? eq : `(!${eq})`;
        }
    
        let jsOp: string;
        switch (expr.operator) {
            case '+':   jsOp = '+';   break;
            case '-':   jsOp = '-';   break;
            case '*':   jsOp = '*';   break;
            case '/':   jsOp = '/';   break;
            case '==':  jsOp = '==='; break;
            case '!=':  jsOp = '!=='; break;
            case '<':   jsOp = '<';   break;
            case '>':   jsOp = '>';   break;
            case '<=':  jsOp = '<=';  break;
            case '>=':  jsOp = '>=';  break;
            case 'and': jsOp = '&&';  break;
            case 'or':  jsOp = '||';  break;
            case 'xor':
                return `(${left} !== ${right})`;
            default:
                jsOp = expr.operator;
        }
    
        return `(${left} ${jsOp} ${right})`;
    }

    private genUnaryMinus(expr: UnaryMinusExpr): string {
        return `(-(${this.genExpr(expr.operand)}))`;
    }

    private genNot(expr: NotExpr): string {
        return `(!(${this.genExpr(expr.argument)}))`;
    }

    private genFunctionCall(expr: FunctionCallExpr): string {
        if (this.info.classes.has(expr.callee)) {
            const paramNames = this.methodParams.get(`${expr.callee}.__constructor__`) || [];
            const reorderedArgs = this.reorderArguments(expr.args, paramNames);
            const args = this.genArgList(reorderedArgs);
            return `new ${safeName(expr.callee)}(${args})`;
        }
    
        const paramNames = this.functionParams.get(expr.callee);
        const reorderedArgs = paramNames 
            ? this.reorderArguments(expr.args, paramNames)
            : expr.args;
        const args = this.genArgList(reorderedArgs);
    
        switch (expr.callee) {
            case 'div':
                return `$rt.div(${args}, ${$loc(expr.loc)})`;
            case 'mod':
                return `$rt.mod(${args}, ${$loc(expr.loc)})`;
            case 'to_int':
                return `$rt.toInt(${args}, ${$loc(expr.loc)})`;
            case 'to_float':
                return `$rt.toFloat(${args}, ${$loc(expr.loc)})`;
            case 'to_string':
                return `$rt.toString_(${args})`;
            case 'max':
                return `$rt.max(${args})`;
            case 'min':
                return `$rt.min(${args})`;
            case 'sum':
                return `$rt.sum(${args})`;
            case 'avg':
                return `$rt.avg(${args})`;
            case 'not':
                return `(!(${args}))`;
        }
    
        const name = safeName(expr.callee);
        return `(await ${name}(${args}))`;
    }

    private genConstructorCall(expr: ConstructorCallExpr): string {
        const args = this.genArgList(expr.args);
        return `new ${safeName(expr.className)}(${args})`;
    }

    private genParentCall(expr: ParentCallExpr): string {
        const args = expr.args.map(a => this.genExpr(a.value)).join(', ');
        return `super(${args})`;
    }

    private genMethodCall(expr: MethodCallExpr): string {
        if (expr.object.kind === 'Identifier') {
            const libName = expr.object.name;
    
            if (this.info.importedLibraries.has(libName)) {
                const paramNames = this.functionParams.get(`${libName}.${expr.method}`);
                const reorderedArgs = paramNames
                    ? this.reorderArguments(expr.args, paramNames)
                    : expr.args;
                const args = this.genArgList(reorderedArgs);
                return this.genLibraryCall(libName, expr.method, args, expr);
            }
        }
    
        const obj = this.genExpr(expr.object);
        const objType = this.typeOf(expr.object);
    
        if (objType.tag === 'string') {
            const args = this.genArgList(expr.args);
            return this.genStringMethodCall(obj, expr.method, args, expr);
        }
    
        if (isArrayLike(objType)) {
            const args = this.genArgList(expr.args);
            return this.genArrayMethodCall(obj, expr.method, args, expr);
        }
    
        if (objType.tag === 'qualified') {
            if (this.info.userModules.has(objType.qualifier)) {
                const userModule = this.info.userModules.get(objType.qualifier);
                if (userModule?.classes.has(objType.name)) {
                    const paramNames = this.methodParams.get(
                        `${objType.qualifier}.${objType.name}.${expr.method}`
                    );
                    const reorderedArgs = paramNames
                        ? this.reorderArguments(expr.args, paramNames)
                        : expr.args;
                    const args = this.genArgList(reorderedArgs);
                    return `(await ${obj}.${safeName(expr.method)}(${args}))`;
                }
            }
    
            const args = this.genArgList(expr.args);
            return this.genQualifiedMethodCall(obj, objType, expr.method, args, expr);
        }
    
        if (objType.tag === 'class') {
            const paramNames = this.methodParams.get(`${objType.name}.${expr.method}`);
            const reorderedArgs = paramNames
                ? this.reorderArguments(expr.args, paramNames)
                : expr.args;
            const args = this.genArgList(reorderedArgs);
            return `(await ${obj}.${safeName(expr.method)}(${args}))`;
        }
    
        const args = this.genArgList(expr.args);
        return `(await ${obj}.${safeName(expr.method)}(${args}))`;
    }

    private genLibraryCall(
        lib: string, func: string, args: string, expr: MethodCallExpr,
    ): string {
        switch (lib) {
            case 'console':
                switch (func) {
                    case 'write':
                        return `(await $rt.console.write(${args}))`;
                    case 'writeln':
                        return `(await $rt.console.writeln(${args}))`;
                    case 'get_int':
                        return `(await $rt.console.getInt(${$loc(expr.loc)}))`;
                    case 'get_float':
                        return `(await $rt.console.getFloat(${$loc(expr.loc)}))`;
                    case 'get_string':
                        return `(await $rt.console.getString())`;
                    case 'set_precision':
                        return `$rt.console.setPrecision(${args})`;
                }
                break;

            case 'math':
                switch (func) {
                    case 'abs':          return `$rt.math.abs(${args})`;
                    case 'round':        return `$rt.math.round(${args})`;
                    case 'floor':        return `$rt.math.floor(${args})`;
                    case 'ceil':         return `$rt.math.ceil(${args})`;
                    case 'pow':          return `$rt.math.pow(${args})`;
                    case 'sqrt':         return `$rt.math.sqrt(${args}, ${$loc(expr.loc)})`;
                    case 'clamp':        return `$rt.math.clamp(${args})`;
                    case 'sin':          return `Math.sin(${args})`;
                    case 'cos':          return `Math.cos(${args})`;
                    case 'tan':          return `Math.tan(${args})`;
                    case 'asin':         return `$rt.math.asin(${args}, ${$loc(expr.loc)})`;
                    case 'acos':         return `$rt.math.acos(${args}, ${$loc(expr.loc)})`;
                    case 'atan':         return `Math.atan(${args})`;
                    case 'to_radians':   return `$rt.math.toRadians(${args})`;
                    case 'to_degrees':   return `$rt.math.toDegrees(${args})`;
                    case 'log':          return `$rt.math.log(${args}, ${$loc(expr.loc)})`;
                    case 'log10':        return `$rt.math.log10(${args}, ${$loc(expr.loc)})`;
                }
                break;

            case 'random':
                switch (func) {
                    case 'create_int':   return `$rt.random.createInt(${args})`;
                    case 'create_float': return `$rt.random.createFloat(${args})`;
                    case 'choose_from':  return `$rt.random.chooseFrom(${args})`;
                    case 'set_seed':     return `$rt.random.setSeed(${args})`;
                }
                break;

            case 'time':
                switch (func) {
                    case 'now':       return `$rt.time.now()`;
                    case 'sleep':     return `(await $rt.time.sleep(${args}))`;
                    case 'from_unix': return `$rt.time.fromUnix(${args})`;
                }
                break;

            case 'file':
                switch (func) {
                    case 'open': return `$rt.file.open(${args}, ${$loc(expr.loc)})`;
                }
                break;
            
            case 'encoding':
                switch (func) {
                    case 'char_to_int':
                        return `$rt.encoding.charToInt(${args}, ${$loc(expr.loc)})`;
                    case 'int_to_char':
                        return `$rt.encoding.intToChar(${args}, ${$loc(expr.loc)})`;
                    case 'encode':
                        return `$rt.encoding.encode(${args}, ${$loc(expr.loc)})`;
                    case 'decode':
                        return `$rt.encoding.decode(${args}, ${$loc(expr.loc)})`;
                    case 'list_encodings':
                        return `$rt.encoding.listEncodings()`;
                }
                break;

            case 'types':
                switch (func) {
                    case 'from_bin':
                        return `$rt.types.fromBin(${args})`;
                    case 'from_hex':
                        return `$rt.types.fromHex(${args})`;
                }
                break;
        }

        if (this.info.userModules.has(lib)) {
            return `(await ${safeName(lib)}.${safeName(func)}(${args}))`;
        }

        return `$rt.${lib}.${func}(${args})`;
    }

    private genStringMethodCall(
        obj: string, method: string, args: string, expr: MethodCallExpr,
    ): string {
        switch (method) {
            case 'length':      return `${obj}.length`;
            case 'contains':    return `$rt.strContains(${obj}, ${args})`;
            case 'find':        return `$rt.strFind(${obj}, ${args})`;
            case 'count':       return `$rt.strCount(${obj}, ${args})`;
            case 'to_upper':    return `${obj}.toUpperCase()`;
            case 'to_lower':    return `${obj}.toLowerCase()`;
            case 'substring':   return `$rt.strSubstring(${obj}, ${args})`;
            case 'replace':     return `$rt.strReplace(${obj}, ${args})`;
            case 'split':       return `$rt.strSplit(${obj}, ${args})`;
            case 'trim':        return `$rt.strTrim(${obj})`;
            case 'is_int':      return `$rt.strIsInt(${obj})`;
            case 'is_float':    return `$rt.strIsFloat(${obj})`;
        }
        return `${obj}.${method}(${args})`;
    }

    private genArrayMethodCall(
        obj: string, method: string, args: string, expr: MethodCallExpr,
    ): string {
        switch (method) {
            case 'length':      return `${obj}.length()`;
            case 'add':         return `${obj}.add(${args})`;
            case 'remove_at':   return `${obj}.removeAt(${args}, ${$loc(expr.loc)})`;
            case 'contains':    return `${obj}.contains(${args})`;
            case 'find':        return `${obj}.find(${args})`;
            case 'count':       return `${obj}.count(${args})`;
            case 'reverse':     return `${obj}.reverse()`;
            case 'sort':        return `${obj}.sort()`;
            case 'resize':      return `${obj}.resize(${args})`;
            case 'insert':      return `${obj}.insert(${args})`;
            case 'join':        return `${obj}.join(${args})`;
            case 'clear':       return `${obj}.clear()`;
            case 'pop':         return `${obj}.pop(${$loc(expr.loc)})`;
        }
        return `${obj}.${method}(${args})`;
    }

    private genQualifiedMethodCall(
        obj: string, objType: { qualifier: string; name: string },
        method: string, args: string, expr: MethodCallExpr,
    ): string {
        if (objType.qualifier === 'time' && objType.name === 'stamp') {
            switch (method) {
                case 'year':     return `${obj}.year()`;
                case 'month':    return `${obj}.month()`;
                case 'day':      return `${obj}.day()`;
                case 'hour':     return `${obj}.hour()`;
                case 'minute':   return `${obj}.minute()`;
                case 'second':   return `${obj}.second()`;
                case 'week_day': return `${obj}.weekDay()`;
                case 'unix':     return `${obj}.unix()`;
            }
        }

        if (objType.qualifier === 'file') {
            switch (method) {
                case 'read_line':     return `${obj}.readLine()`;
                case 'has_next_line': return `${obj}.hasNextLine()`;
                case 'write_line':    return `${obj}.writeLine(${args})`;
                case 'close':         return `${obj}.close()`;
            }
        }

        if (objType.qualifier === 'types') {
            switch (method) {
                case 'to_bin': return `${obj}.toBin()`;
                case 'to_hex': return `${obj}.toHex()`;
                case 'get':    return `${obj}.get()`;
                case 'set':    return `${obj}.set(${args})`;
                case 'get_min': return `${obj}.getMin()`;
                case 'get_max': return `${obj}.getMax()`;
                case 'get_bits': return `${obj}.getBits()`;
            }
        }

        return `${obj}.${method}(${args})`;
    }

    private genPropertyAccess(expr: PropertyAccessExpr): string {
        if (expr.object.kind === 'Identifier') {
            const libName = expr.object.name;
            if (this.info.importedLibraries.has(libName)) {
                if (libName === 'math') {
                    if (expr.property === 'pi') return 'Math.PI';
                    if (expr.property === 'e') return 'Math.E';
                }
                return `$rt.${libName}.${expr.property}`;
            }
        }
    
        const obj = this.genExpr(expr.object);
        const objType = this.typeOf(expr.object);
        
        if (objType.tag === 'class') {
            const cls = this.info.classes.get(objType.name);
            if (cls && cls.methods.has(expr.property)) {
                return `${obj}.${safeName(expr.property)}.bind(${obj})`;
            }
        }
        
        return `${obj}.${safeName(expr.property)}`;
    }

    private genIndexAccess(expr: IndexAccessExpr): string {
        const obj = this.genExpr(expr.object);
        const idx = this.genExpr(expr.index);
        const objType = this.typeOf(expr.object);
    
        if (isArrayLike(objType)) {
            return `${obj}.get(${idx}, ${$loc(expr.loc)})`;
        }
    
        if (objType.tag === 'string') {
            return `$rt.strCharAt(${obj}, ${idx}, ${$loc(expr.loc)})`;
        }
    
        if (expr.object.kind === 'PropertyAccess' || expr.object.kind === 'Identifier') {
            return `${obj}.get(${idx}, ${$loc(expr.loc)})`;
        }
    
        return `${obj}[${idx}]`;
    }

    private genLambda(expr: LambdaExpr): string {
        const params = expr.params.map(p => this.genParamWithDefault(p)).join(', ');
        const body = this.genLambdaBody(expr.body);
        return `(async function(${params}) {\n${body}\n${this.currentIndent()}})`;
    }

    private genLambdaBody(block: Block): string {
        const saved = this.output;
        this.output = [];
        this.indent();
        this.genBlockBody(block);
        this.dedent();
        const result = this.output.join('\n');
        this.output = saved;
        return result;
    }

    private genArgList(args: Argument[]): string {
        return args.map(a => this.genExpr(a.value)).join(', ');
    }
}