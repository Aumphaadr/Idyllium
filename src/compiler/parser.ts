// src/compiler/parser.ts

import {
    Token, TokenType, KEYWORDS,
    tokenTypeName, tokenDisplayValue,
} from './tokens';

import { ErrorCollector } from './errors';

import {
    SourceLocation, loc,
    TypeNode, PrimitiveType, ArrayType, DynArrayType,
    QualifiedType, ClassType,
    Program, UseDeclaration, TopLevelDecl,
    Parameter, Argument,
    VariableDecl, SingleVarDecl, FunctionDecl,
    ClassDecl, ClassMember, ClassField, ClassMethod,
    ClassConstructor, ClassDestructor, AccessModifier,
    Block, Statement, ExpressionStmt, AssignmentStmt,
    AssignmentOperator, AssignmentTarget,
    IfStmt, ElseIfClause, WhileStmt, DoWhileStmt, ForStmt,
    ReturnStmt, BreakStmt, ContinueStmt, TryStmt,
    Expression, BinaryOperator, BinaryExpr,
    IntLiteralExpr, FloatLiteralExpr, StringLiteralExpr,
    CharLiteralExpr, BoolLiteralExpr, ArrayLiteralExpr,
    IdentifierExpr, ThisExpr,
    UnaryMinusExpr, NotExpr,
    FunctionCallExpr, MethodCallExpr,
    PropertyAccessExpr, IndexAccessExpr,
    LambdaExpr,
    isAssignmentTarget,
} from './ast';

function getBinaryPrecedence(type: TokenType): number {
    switch (type) {
        case TokenType.KW_OR:
        case TokenType.KW_XOR:
        case TokenType.PIPEPIPE:
            return 10;
        case TokenType.KW_AND:
        case TokenType.AMPAMP:
            return 20;
        case TokenType.EQ:
        case TokenType.NEQ:
            return 30;
        case TokenType.LT:
        case TokenType.GT:
        case TokenType.LTE:
        case TokenType.GTE:
            return 40;
        case TokenType.PLUS:
        case TokenType.MINUS:
            return 50;
        case TokenType.STAR:
        case TokenType.SLASH:
            return 60;
        default:
            return -1;
    }
}

function tokenToBinaryOp(type: TokenType): BinaryOperator {
    switch (type) {
        case TokenType.PLUS:    return '+';
        case TokenType.MINUS:   return '-';
        case TokenType.STAR:    return '*';
        case TokenType.SLASH:   return '/';
        case TokenType.EQ:      return '==';
        case TokenType.NEQ:     return '!=';
        case TokenType.LT:      return '<';
        case TokenType.GT:      return '>';
        case TokenType.LTE:     return '<=';
        case TokenType.GTE:     return '>=';
        case TokenType.KW_AND:
        case TokenType.AMPAMP:
            return 'and';
        case TokenType.KW_OR:
        case TokenType.PIPEPIPE:
            return 'or';
        case TokenType.KW_XOR:  return 'xor';
        default:
            throw new Error(`Internal: not a binary operator: ${type}`);
    }
}

function isTypeStart(type: TokenType): boolean {
    switch (type) {
        case TokenType.KW_INT:
        case TokenType.KW_FLOAT:
        case TokenType.KW_STRING:
        case TokenType.KW_CHAR:
        case TokenType.KW_BOOL:
        case TokenType.KW_VOID:
        case TokenType.KW_ARRAY:
        case TokenType.KW_DYN_ARRAY:
        case TokenType.IDENTIFIER:
            return true;
        default:
            return false;
    }
}

function isAssignmentOp(type: TokenType): AssignmentOperator | null {
    switch (type) {
        case TokenType.ASSIGN:       return '=';
        case TokenType.PLUS_ASSIGN:  return '+=';
        case TokenType.MINUS_ASSIGN: return '-=';
        case TokenType.STAR_ASSIGN:  return '*=';
        case TokenType.SLASH_ASSIGN: return '/=';
        default:                     return null;
    }
}

export class Parser {

    private readonly tokens: Token[];
    private readonly file: string;
    private readonly errors: ErrorCollector;
    private readonly isLibrary: boolean;

    private pos: number = 0;

    constructor(
        tokens: Token[], 
        file: string, 
        errors: ErrorCollector,
        isLibrary: boolean = false
    ) {
        this.tokens = tokens;
        this.file = file;
        this.errors = errors;
        this.isLibrary = isLibrary;
    }

    private current(): Token {
        return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
    }

    private currentType(): TokenType {
        return this.current().type;
    }

    private currentLine(): number {
        return this.current().line;
    }

    private isAtEnd(): boolean {
        return this.currentType() === TokenType.EOF;
    }

    private peek(offset: number = 0): Token {
        const idx = this.pos + offset;
        return idx < this.tokens.length
            ? this.tokens[idx]
            : this.tokens[this.tokens.length - 1];
    }

    private advance(): Token {
        const tok = this.current();
        if (!this.isAtEnd()) this.pos++;
        return tok;
    }

    private expect(type: TokenType, contextMsg?: string): Token | null {
        if (this.currentType() === type) {
            return this.advance();
        }
        const where = contextMsg ? ` ${contextMsg}` : '';
        this.errors.addError(
            this.file,
            this.currentLine(),
            `expected ${tokenTypeName(type)} but found ${tokenDisplayValue(this.current())}${where}`,
        );
        return null;
    }

    private match(type: TokenType): boolean {
        if (this.currentType() === type) {
            this.advance();
            return true;
        }
        return false;
    }

    private here(): SourceLocation {
        return loc(this.file, this.currentLine());
    }

    private locOf(token: Token): SourceLocation {
        return loc(token.file, token.line);
    }

    private synchronize(): void {
        while (!this.isAtEnd()) {
            if (this.currentType() === TokenType.SEMICOLON) {
                this.advance();
                return;
            }

            if (this.currentType() === TokenType.RBRACE) {
                return;
            }

            switch (this.currentType()) {
                case TokenType.KW_INT:
                case TokenType.KW_FLOAT:
                case TokenType.KW_STRING:
                case TokenType.KW_CHAR:
                case TokenType.KW_BOOL:
                case TokenType.KW_VOID:
                case TokenType.KW_ARRAY:
                case TokenType.KW_DYN_ARRAY:
                case TokenType.KW_IF:
                case TokenType.KW_WHILE:
                case TokenType.KW_DO:
                case TokenType.KW_FOR:
                case TokenType.KW_RETURN:
                case TokenType.KW_BREAK:
                case TokenType.KW_CONTINUE:
                case TokenType.KW_CLASS:
                case TokenType.KW_USE:
                case TokenType.KW_FUNCTION:
                    return;
                default:
                    break;
            }

            this.advance();
        }
    }

    parse(): Program {
        const programLoc = this.here();

        const imports = this.parseImports();

        const declarations: TopLevelDecl[] = [];
        let main: FunctionDecl | null = null;

        while (!this.isAtEnd()) {
            if (this.currentType() === TokenType.KW_MAIN && this.peek(1).type === TokenType.LPAREN) {
                if (main !== null) {
                    this.errors.addError(this.file, this.currentLine(),
                        "only one 'main()' function is allowed per program");
                }
                main = this.parseMainShort();
                continue;
            }

            if (this.looksLikeFunctionDecl()) {
                const funcDecl = this.parseFunctionDecl();
                if (funcDecl === null) continue;

                if (funcDecl.name === 'main') {
                    if (main !== null) {
                        this.errors.addError(this.file, funcDecl.loc.line,
                            "only one 'main()' function is allowed per program");
                    }
                    main = funcDecl;
                } else {
                    declarations.push(funcDecl);
                }
                continue;
            }

            if (this.currentType() === TokenType.KW_CLASS) {
                const classDecl = this.parseClassDecl();
                if (classDecl !== null) {
                    declarations.push(classDecl);
                }
                continue;
            }

            this.errors.addError(this.file, this.currentLine(),
                `unexpected ${tokenDisplayValue(this.current())} at top level`);
            this.advance();
        }

        if (main === null) {
            if (!this.isLibrary) {
                this.errors.addError(this.file, this.currentLine(),
                    "no 'main()' function found");
            }
            main = {
                kind: 'FunctionDecl',
                loc: programLoc,
                returnType: { kind: 'PrimitiveType', loc: programLoc, name: 'void' },
                name: 'main',
                params: [],
                body: { kind: 'Block', loc: programLoc, statements: [] },
            };
        }

        return {
            kind: 'Program',
            loc: programLoc,
            imports,
            declarations,
            main,
        };
    }

    private parseImports(): UseDeclaration[] {
        const imports: UseDeclaration[] = [];

        while (this.currentType() === TokenType.KW_USE) {
            const useLoc = this.here();
            this.advance();

            const nameTok = this.expect(TokenType.IDENTIFIER, "after 'use'");
            if (nameTok === null) {
                this.synchronize();
                continue;
            }

            this.expect(TokenType.SEMICOLON, "after library name");

            imports.push({
                kind: 'UseDeclaration',
                loc: useLoc,
                libraryName: nameTok.value,
            });
        }

        return imports;
    }

    private looksLikeFunctionDecl(): boolean {
        if (!isTypeStart(this.currentType())) return false;

        const saved = this.pos;
        const result = this.trySkipType() && this.currentType() === TokenType.KW_FUNCTION;
        this.pos = saved;
        return result;
    }

    private trySkipType(): boolean {
        switch (this.currentType()) {
            case TokenType.KW_INT:
            case TokenType.KW_FLOAT:
            case TokenType.KW_STRING:
            case TokenType.KW_CHAR:
            case TokenType.KW_BOOL:
            case TokenType.KW_VOID:
                this.pos++;
                return true;

            case TokenType.KW_ARRAY:
                this.pos++;
                if (this.currentType() !== TokenType.LT) return false;
                this.pos++;
                if (!this.trySkipType()) return false;
                if (this.currentType() !== TokenType.COMMA) return false;
                this.pos++;
                if (this.currentType() !== TokenType.INT_LITERAL) return false;
                this.pos++;
                if (this.currentType() !== TokenType.GT) return false;
                this.pos++;
                return true;

            case TokenType.KW_DYN_ARRAY:
                this.pos++;
                if (this.currentType() !== TokenType.LT) return false;
                this.pos++;
                if (!this.trySkipType()) return false;
                if (this.currentType() !== TokenType.GT) return false;
                this.pos++;
                return true;

            case TokenType.IDENTIFIER:
                this.pos++;
                if (this.currentType() === TokenType.DOT &&
                    this.peek(1).type === TokenType.IDENTIFIER) {
                    this.pos += 2;
                }
                return true;

            default:
                return false;
        }
    }

    private looksLikeVarDecl(): boolean {
        if (!isTypeStart(this.currentType())) return false;

        if (this.currentType() === TokenType.IDENTIFIER) {
            const next = this.peek(1).type;
            if (next === TokenType.IDENTIFIER) return true;
            if (next === TokenType.DOT &&
                this.peek(2).type === TokenType.IDENTIFIER &&
                this.peek(3).type === TokenType.IDENTIFIER) return true;
            return false;
        }

        return true;
    }

    private parseType(): TypeNode | null {
        const typeLoc = this.here();

        switch (this.currentType()) {
            case TokenType.KW_INT:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'int' };
            case TokenType.KW_FLOAT:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'float' };
            case TokenType.KW_STRING:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'string' };
            case TokenType.KW_CHAR:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'char' };
            case TokenType.KW_BOOL:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'bool' };
            case TokenType.KW_VOID:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'void' };
        }

        if (this.currentType() === TokenType.KW_ARRAY) {
            return this.parseArrayType();
        }

        if (this.currentType() === TokenType.KW_DYN_ARRAY) {
            return this.parseDynArrayType();
        }

        if (this.currentType() === TokenType.IDENTIFIER) {
            const ident = this.advance();

            if (this.currentType() === TokenType.DOT &&
                this.peek(1).type === TokenType.IDENTIFIER) {
                this.advance();
                const name = this.advance();
                return {
                    kind: 'QualifiedType',
                    loc: typeLoc,
                    qualifier: ident.value,
                    name: name.value,
                };
            }

            return {
                kind: 'ClassType',
                loc: typeLoc,
                name: ident.value,
            };
        }

        this.errors.addError(this.file, this.currentLine(),
            `expected type but found ${tokenDisplayValue(this.current())}`);
        return null;
    }

    private parseArrayType(): ArrayType | null {
        const typeLoc = this.here();
        this.advance();

        if (!this.expect(TokenType.LT, "after 'array'")) return null;

        const elementType = this.parseType();
        if (elementType === null) return null;

        if (!this.expect(TokenType.COMMA, "in array type")) return null;

        const sizeTok = this.expect(TokenType.INT_LITERAL, "for array size");
        if (sizeTok === null) return null;
        const size = parseInt(sizeTok.value, 10);

        if (size <= 0) {
            this.errors.addError(this.file, sizeTok.line,
                `array size must be a positive integer (got ${size})`);
        }

        if (!this.expect(TokenType.GT, "after array size")) return null;

        return {
            kind: 'ArrayType',
            loc: typeLoc,
            elementType,
            size: Math.max(size, 1),
        };
    }

    private parseDynArrayType(): DynArrayType | null {
        const typeLoc = this.here();
        this.advance();

        if (!this.expect(TokenType.LT, "after 'dyn_array'")) return null;

        const elementType = this.parseType();
        if (elementType === null) return null;

        if (!this.expect(TokenType.GT, "after element type")) return null;

        return {
            kind: 'DynArrayType',
            loc: typeLoc,
            elementType,
        };
    }

    private parseMainShort(): FunctionDecl {
        const mainLoc = this.here();
        this.advance();

        this.expect(TokenType.LPAREN, "after 'main'");
        this.expect(TokenType.RPAREN, "in 'main()'");

        const body = this.parseBlock();

        return {
            kind: 'FunctionDecl',
            loc: mainLoc,
            returnType: { kind: 'PrimitiveType', loc: mainLoc, name: 'void' },
            name: 'main',
            params: [],
            body,
        };
    }

    private parseFunctionDecl(): FunctionDecl | null {
        const funcLoc = this.here();

        const returnType = this.parseType();
        if (returnType === null) {
            this.synchronize();
            return null;
        }

        this.expect(TokenType.KW_FUNCTION, "in function declaration");

        let name: string;
        if (this.currentType() === TokenType.KW_MAIN) {
            name = 'main';
            this.advance();
        } else {
            const nameTok = this.expect(TokenType.IDENTIFIER, "for function name");
            if (nameTok === null) {
                this.synchronize();
                return null;
            }
            name = nameTok.value;
        }

        if (!this.expect(TokenType.LPAREN, `after function name '${name}'`)) {
            this.synchronize();
            return null;
        }
        const params = this.parseParameterList();
        this.expect(TokenType.RPAREN, "after parameters");

        const body = this.parseBlock();

        return {
            kind: 'FunctionDecl',
            loc: funcLoc,
            returnType,
            name,
            params,
            body,
        };
    }

    private parseParameterList(): Parameter[] {
        const params: Parameter[] = [];

        if (this.currentType() === TokenType.RPAREN) {
            return params;
        }

        while (true) {
            const param = this.parseOneParameter();
            if (param !== null) {
                params.push(param);
            }

            if (!this.match(TokenType.COMMA)) break;
        }

        return params;
    }

    private parseOneParameter(): Parameter | null {
        const paramLoc = this.here();

        const paramType = this.parseType();
        if (paramType === null) return null;

        const nameTok = this.expect(TokenType.IDENTIFIER, "for parameter name");
        if (nameTok === null) return null;

        let defaultValue: Expression | null = null;
        if (this.match(TokenType.ASSIGN)) {
            defaultValue = this.parseExpression();
        }

        return {
            kind: 'Parameter',
            loc: paramLoc,
            paramType,
            name: nameTok.value,
            defaultValue,
        };
    }

    private parseClassDecl(): ClassDecl | null {
        const classLoc = this.here();
        this.advance();
    
        const nameTok = this.expect(TokenType.IDENTIFIER, "for class name");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        const className = nameTok.value;
    
        let parentClass: string | null = null;
        let parentModule: string | null = null;
    
        if (this.match(TokenType.KW_EXTENDS)) {
            const firstTok = this.expect(TokenType.IDENTIFIER, "after 'extends'");
            if (firstTok !== null) {
                if (this.match(TokenType.DOT)) {
                    const classNameTok = this.expect(TokenType.IDENTIFIER, "for parent class name");
                    if (classNameTok !== null) {
                        parentModule = firstTok.value;
                        parentClass = classNameTok.value;
                    }
                } else {
                    parentClass = firstTok.value;
                }
            }
        }
    
        if (!this.expect(TokenType.LBRACE, `after class name '${className}'`)) {
            this.synchronize();
            return null;
        }
    
        const members = this.parseClassBody(className);
    
        this.expect(TokenType.RBRACE, `at end of class '${className}'`);
    
        this.match(TokenType.SEMICOLON);
    
        return {
            kind: 'ClassDecl',
            loc: classLoc,
            name: className,
            parentClass,
            parentModule,
            members,
        };
    }

    private parseClassBody(className: string): ClassMember[] {
        const members: ClassMember[] = [];
        let currentAccess: AccessModifier = 'public';
        let currentStatic: boolean = false;

        while (!this.isAtEnd() && this.currentType() !== TokenType.RBRACE) {
            if ((this.currentType() === TokenType.KW_PUBLIC ||
                 this.currentType() === TokenType.KW_PRIVATE) &&
                this.peek(1).type === TokenType.COLON) {
                currentAccess = this.currentType() === TokenType.KW_PUBLIC ? 'public' : 'private';
                this.advance();
                this.advance();
                currentStatic = false;
                continue;
            }

            // Parse 'static' modifier
            let isStatic = false;
            if (this.currentType() === TokenType.KW_STATIC) {
                isStatic = true;
                this.advance();
            }

            if (this.currentType() === TokenType.KW_CONSTRUCTOR) {
                if (isStatic) {
                    this.errors.addError(this.file, this.currentLine(),
                        "constructors cannot be static");
                }
                const ctor = this.parseConstructor(className, currentAccess);
                if (ctor !== null) members.push(ctor);
                continue;
            }

            if (this.currentType() === TokenType.KW_DESTRUCTOR) {
                if (isStatic) {
                    this.errors.addError(this.file, this.currentLine(),
                        "destructors cannot be static");
                }
                const dtor = this.parseDestructor(className, currentAccess);
                if (dtor !== null) members.push(dtor);
                continue;
            }

            if (this.looksLikeFunctionDecl()) {
                const method = this.parseClassMethod(currentAccess, isStatic);
                if (method !== null) members.push(method);
                continue;
            }

            if (isTypeStart(this.currentType())) {
                const fields = this.parseClassFields(currentAccess, isStatic);
                members.push(...fields);
                continue;
            }

            this.errors.addError(this.file, this.currentLine(),
                `unexpected ${tokenDisplayValue(this.current())} in class body`);
            this.advance();
        }

        return members;
    }

    private parseClassFields(access: AccessModifier, isStatic: boolean = false): ClassField[] {
        const fieldLoc = this.here();
        const fieldType = this.parseType();
        if (fieldType === null) {
            this.synchronize();
            return [];
        }

        const fields: ClassField[] = [];

        while (true) {
            const nameTok = this.expect(TokenType.IDENTIFIER, "for field name");
            if (nameTok === null) {
                this.synchronize();
                return fields;
            }

            let initializer: Expression | null = null;
            if (this.match(TokenType.ASSIGN)) {
                initializer = this.parseExpression();
            }

            fields.push({
                kind: 'ClassField',
                loc: this.locOf(nameTok),
                access,
                isStatic,
                fieldType,
                name: nameTok.value,
                initializer,
            });

            if (!this.match(TokenType.COMMA)) break;
        }

        this.expect(TokenType.SEMICOLON, "after field declaration");
        return fields;
    }

    private parseClassMethod(access: AccessModifier, isStatic: boolean = false): ClassMethod | null {
        const methodLoc = this.here();

        const returnType = this.parseType();
        if (returnType === null) {
            this.synchronize();
            return null;
        }

        this.expect(TokenType.KW_FUNCTION, "in method declaration");

        const nameTok = this.expect(TokenType.IDENTIFIER, "for method name");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }

        this.expect(TokenType.LPAREN, `after method name '${nameTok.value}'`);
        const params = this.parseParameterList();
        this.expect(TokenType.RPAREN, "after method parameters");

        const body = this.parseBlock();

        return {
            kind: 'ClassMethod',
            loc: methodLoc,
            access,
            isStatic,
            returnType,
            name: nameTok.value,
            params,
            body,
        };
    }

    private parseConstructor(className: string, access: AccessModifier): ClassConstructor | null {
        const ctorLoc = this.here();
        this.advance();

        const nameTok = this.expect(TokenType.IDENTIFIER, "after 'constructor'");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        if (nameTok.value !== className) {
            this.errors.addError(this.file, nameTok.line,
                `constructor name '${nameTok.value}' does not match class name '${className}'`);
        }

        this.expect(TokenType.LPAREN, "after constructor name");
        const params = this.parseParameterList();
        this.expect(TokenType.RPAREN, "after constructor parameters");

        const blockLoc = this.here();
        if (!this.expect(TokenType.LBRACE, "to open constructor body")) {
            return {
                kind: 'ClassConstructor',
                loc: ctorLoc,
                access,
                className,
                params,
                parentArgs: null,
                body: { kind: 'Block', loc: blockLoc, statements: [] },
            };
        }

        let parentArgs: Argument[] | null = null;

        if (this.currentType() === TokenType.KW_PARENT &&
            this.peek(1).type === TokenType.LPAREN) {
            const parentLoc = this.here();
            this.advance(); // skip 'parent'
            this.advance(); // skip '('
            parentArgs = this.parseArgumentList();
            this.expect(TokenType.RPAREN, "after parent() arguments");
            this.expect(TokenType.SEMICOLON, "after parent() call");
        }

        const statements: Statement[] = [];
        while (!this.isAtEnd() && this.currentType() !== TokenType.RBRACE) {
            const stmt = this.parseStatement();
            if (stmt !== null) {
                statements.push(stmt);
            }
        }
        this.expect(TokenType.RBRACE, "to close constructor body");

        const body: Block = {
            kind: 'Block',
            loc: blockLoc,
            statements,
        };

        return {
            kind: 'ClassConstructor',
            loc: ctorLoc,
            access,
            className,
            params,
            parentArgs,
            body,
        };
    }

    private parseDestructor(className: string, access: AccessModifier): ClassDestructor | null {
        const dtorLoc = this.here();
        this.advance();

        if (!this.expect(TokenType.TILDE, "before destructor name")) {
            this.synchronize();
            return null;
        }

        const nameTok = this.expect(TokenType.IDENTIFIER, "after '~'");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        if (nameTok.value !== className) {
            this.errors.addError(this.file, nameTok.line,
                `destructor name '${nameTok.value}' does not match class name '${className}'`);
        }

        this.expect(TokenType.LPAREN, "after destructor name");
        this.expect(TokenType.RPAREN, "destructor cannot have parameters");

        const body = this.parseBlock();

        return {
            kind: 'ClassDestructor',
            loc: dtorLoc,
            access,
            className,
            body,
        };
    }

    private parseBlock(): Block {
        const blockLoc = this.here();

        if (!this.expect(TokenType.LBRACE, "to open block")) {
            return { kind: 'Block', loc: blockLoc, statements: [] };
        }

        const statements: Statement[] = [];

        while (!this.isAtEnd() && this.currentType() !== TokenType.RBRACE) {
            const stmt = this.parseStatement();
            if (stmt !== null) {
                statements.push(stmt);
            }
        }

        this.expect(TokenType.RBRACE, "to close block");

        return {
            kind: 'Block',
            loc: blockLoc,
            statements,
        };
    }

    private parseStatement(): Statement | null {
        switch (this.currentType()) {
            case TokenType.KW_IF:
                return this.parseIfStmt();

            case TokenType.KW_WHILE:
                return this.parseWhileStmt();

            case TokenType.KW_DO:
                return this.parseDoWhileStmt();

            case TokenType.KW_FOR:
                return this.parseForStmt();

            case TokenType.KW_RETURN:
                return this.parseReturnStmt();

            case TokenType.KW_BREAK: {
                const breakLoc = this.here();
                this.advance();
                this.expect(TokenType.SEMICOLON, "after 'break'");
                return { kind: 'BreakStmt', loc: breakLoc };
            }

            case TokenType.KW_CONTINUE: {
                const contLoc = this.here();
                this.advance();
                this.expect(TokenType.SEMICOLON, "after 'continue'");
                return { kind: 'ContinueStmt', loc: contLoc };
            }

            case TokenType.KW_TRY:
                return this.parseTryStmt();

            default:
                break;
        }

        if (this.looksLikeVarDecl()) {
            return this.parseVarDeclStatement();
        }

        return this.parseAssignmentOrExprStmt();
    }

    private parseVarDeclStatement(): Statement | null {
        const declLoc = this.here();

        const varType = this.parseType();
        if (varType === null) {
            this.synchronize();
            return null;
        }

        const declarations: Array<{
            loc: SourceLocation;
            name: string;
            initializer: Expression | null;
            constructorArgs: Argument[] | null;
        }> = [];

        while (true) {
            const nameTok = this.expect(TokenType.IDENTIFIER, "for variable name");
            if (nameTok === null) {
                this.synchronize();
                return null;
            }

            let initializer: Expression | null = null;
            let constructorArgs: Argument[] | null = null;

            if (this.match(TokenType.ASSIGN)) {
                initializer = this.parseExpression();
            } else if (this.currentType() === TokenType.LPAREN) {
                this.advance();
                constructorArgs = this.parseArgumentList();
                this.expect(TokenType.RPAREN, "after constructor arguments");
            }

            declarations.push({
                loc: this.locOf(nameTok),
                name: nameTok.value,
                initializer,
                constructorArgs,
            });

            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }

        this.expect(TokenType.SEMICOLON, "after variable declaration");

        if (declarations.length === 1) {
            const d = declarations[0];
            return {
                kind: 'VariableDecl',
                loc: d.loc,
                varType,
                name: d.name,
                initializer: d.initializer,
                constructorArgs: d.constructorArgs,
            };
        }

        return {
            kind: 'MultiVariableDecl',
            loc: declLoc,
            varType,
            declarations,
        };
    }

    private parseOneVarDecl(varType: TypeNode, declLoc: SourceLocation): VariableDecl | null {
        const nameTok = this.expect(TokenType.IDENTIFIER, "for variable name");
        if (nameTok === null) {
            return null;
        }

        let initializer: Expression | null = null;
        let constructorArgs: Argument[] | null = null;

        if (this.match(TokenType.ASSIGN)) {
            initializer = this.parseExpression();
        } else if (this.currentType() === TokenType.LPAREN) {
            this.advance();
            constructorArgs = this.parseArgumentList();
            this.expect(TokenType.RPAREN, "after constructor arguments");
        }

        return {
            kind: 'VariableDecl',
            loc: this.locOf(nameTok),
            varType,
            name: nameTok.value,
            initializer,
            constructorArgs,
        };
    }

    private parseAssignmentOrExprStmt(): Statement | null {
        const stmtLoc = this.here();

        const expr = this.parseExpression();
        if (expr === null) {
            this.synchronize();
            return null;
        }

        const assignOp = isAssignmentOp(this.currentType());

        if (assignOp !== null) {
            if (!isAssignmentTarget(expr)) {
                this.errors.addError(this.file, stmtLoc.line,
                    'invalid assignment target');
                this.advance();
                this.parseExpression();
                this.expect(TokenType.SEMICOLON, "after assignment");
                return null;
            }

            this.advance();

            const value = this.parseExpression();
            if (value === null) {
                this.synchronize();
                return null;
            }

            this.expect(TokenType.SEMICOLON, "after assignment");

            return {
                kind: 'AssignmentStmt',
                loc: stmtLoc,
                target: expr as AssignmentTarget,
                operator: assignOp,
                value,
            };
        }

        this.expect(TokenType.SEMICOLON, "after expression");

        return {
            kind: 'ExpressionStmt',
            loc: stmtLoc,
            expression: expr,
        };
    }

    private parseIfStmt(): IfStmt {
        const ifLoc = this.here();
        this.advance();

        if (this.currentType() !== TokenType.LPAREN) {
            this.errors.addError(this.file, this.currentLine(),
                "missing '(' after 'if'");
        }

        const condition = this.parseParenthesizedCondition();
        const thenBlock = this.parseBlock();

        const elseIfClauses: ElseIfClause[] = [];
        let elseBlock: Block | null = null;

        while (this.currentType() === TokenType.KW_ELSE) {
            const elseLoc = this.here();
            this.advance();

            if (this.currentType() === TokenType.KW_IF) {
                this.advance();

                const elseIfCondition = this.parseParenthesizedCondition();
                const elseIfBlock = this.parseBlock();

                elseIfClauses.push({
                    loc: elseLoc,
                    condition: elseIfCondition,
                    block: elseIfBlock,
                });
            } else if (this.currentType() === TokenType.LPAREN) {
                this.errors.addError(this.file, this.currentLine(),
                    "'else' cannot have a condition, use 'else if' instead");
                this.parseParenthesizedCondition();
                elseBlock = this.parseBlock();
                break;
            } else {
                elseBlock = this.parseBlock();
                break;
            }
        }

        return {
            kind: 'IfStmt',
            loc: ifLoc,
            condition,
            thenBlock,
            elseIfClauses,
            elseBlock,
        };
    }

    private parseParenthesizedCondition(): Expression {
        this.expect(TokenType.LPAREN, "before condition");

        if (this.currentType() === TokenType.RPAREN) {
            this.errors.addError(this.file, this.currentLine(),
                'condition cannot be empty');
            this.advance();
            return { kind: 'BoolLiteral', loc: this.here(), value: false };
        }

        const expr = this.parseExpression();

        this.expect(TokenType.RPAREN, "after condition");

        return expr ?? { kind: 'BoolLiteral', loc: this.here(), value: false };
    }

    private parseWhileStmt(): WhileStmt {
        const whileLoc = this.here();
        this.advance();

        const condition = this.parseParenthesizedCondition();
        const body = this.parseBlock();

        return {
            kind: 'WhileStmt',
            loc: whileLoc,
            condition,
            body,
        };
    }

    private parseDoWhileStmt(): DoWhileStmt {
        const doLoc = this.here();
        this.advance();

        const body = this.parseBlock();

        this.expect(TokenType.KW_WHILE, "after 'do' block");
        const condition = this.parseParenthesizedCondition();
        this.expect(TokenType.SEMICOLON, "after 'do-while' condition");

        return {
            kind: 'DoWhileStmt',
            loc: doLoc,
            body,
            condition,
        };
    }

    private parseForStmt(): ForStmt {
        const forLoc = this.here();
        this.advance();

        this.expect(TokenType.LPAREN, "after 'for'");

        const initLoc = this.here();
        const initType = this.parseType();
        if (initType === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }
        const initDecl = this.parseOneVarDecl(initType, initLoc);
        if (initDecl === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }

        this.expect(TokenType.SEMICOLON, "after 'for' initialization");

        const condition = this.parseExpression();
        if (condition === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }

        this.expect(TokenType.SEMICOLON, "after 'for' condition");

        const updateLoc = this.here();
        const updateExpr = this.parseExpression();
        if (updateExpr === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }

        const updateOp = isAssignmentOp(this.currentType());
        if (updateOp === null) {
            this.errors.addError(this.file, this.currentLine(),
                "expected assignment operator in 'for' update");
            this.synchronize();
            return this.dummyFor(forLoc);
        }

        if (!isAssignmentTarget(updateExpr)) {
            this.errors.addError(this.file, updateLoc.line,
                "invalid assignment target in 'for' update");
        }

        this.advance();

        const updateValue = this.parseExpression();
        if (updateValue === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }

        const update: AssignmentStmt = {
            kind: 'AssignmentStmt',
            loc: updateLoc,
            target: updateExpr as AssignmentTarget,
            operator: updateOp,
            value: updateValue,
        };

        this.expect(TokenType.RPAREN, "after 'for' clauses");

        const body = this.parseBlock();

        return {
            kind: 'ForStmt',
            loc: forLoc,
            init: initDecl,
            condition,
            update,
            body,
        };
    }

    private dummyFor(forLoc: SourceLocation): ForStmt {
        return {
            kind: 'ForStmt',
            loc: forLoc,
            init: {
                kind: 'VariableDecl', loc: forLoc,
                varType: { kind: 'PrimitiveType', loc: forLoc, name: 'int' },
                name: '_dummy', initializer: null, constructorArgs: null,
            },
            condition: { kind: 'BoolLiteral', loc: forLoc, value: false },
            update: {
                kind: 'AssignmentStmt', loc: forLoc,
                target: { kind: 'Identifier', loc: forLoc, name: '_dummy' },
                operator: '=',
                value: { kind: 'IntLiteral', loc: forLoc, value: 0 },
            },
            body: { kind: 'Block', loc: forLoc, statements: [] },
        };
    }

    private parseReturnStmt(): ReturnStmt {
        const retLoc = this.here();
        this.advance();

        let value: Expression | null = null;

        if (this.currentType() !== TokenType.SEMICOLON) {
            value = this.parseExpression();
        }

        this.expect(TokenType.SEMICOLON, "after 'return'");

        return {
            kind: 'ReturnStmt',
            loc: retLoc,
            value,
        };
    }

    private parseTryStmt(): TryStmt {
        const tryLoc = this.here();
        this.advance();
    
        const tryBlock = this.parseBlock();
    
        if (!this.expect(TokenType.KW_CATCH, "after 'try' block")) {
            return {
                kind: 'TryStmt',
                loc: tryLoc,
                tryBlock,
                catchParam: null,
                catchBlock: { kind: 'Block', loc: this.here(), statements: [] },
            };
        }
    
        let catchParam: Parameter | null = null;
    
        if (this.currentType() === TokenType.LPAREN) {
            this.advance();
    
            const paramLoc = this.here();
            const paramType = this.parseType();
            
            if (paramType !== null) {
                const nameTok = this.expect(TokenType.IDENTIFIER, "for catch parameter name");
                if (nameTok !== null) {
                    catchParam = {
                        kind: 'Parameter',
                        loc: paramLoc,
                        paramType,
                        name: nameTok.value,
                        defaultValue: null,
                    };
                }
            }
    
            this.expect(TokenType.RPAREN, "after catch parameter");
        }
    
        const catchBlock = this.parseBlock();
    
        return {
            kind: 'TryStmt',
            loc: tryLoc,
            tryBlock,
            catchParam,
            catchBlock,
        };
    }

    private parseExpression(): Expression | null {
        return this.parseBinaryExpr(0);
    }

    private parseBinaryExpr(minPrec: number): Expression | null {
        let left = this.parseUnary();
        if (left === null) return null;

        while (true) {
            const prec = getBinaryPrecedence(this.currentType());
            if (prec < minPrec) break;

            const opToken = this.advance();
            const op = tokenToBinaryOp(opToken.type);

            const right = this.parseBinaryExpr(prec + 1);
            if (right === null) return left;

            left = {
                kind: 'BinaryExpr',
                loc: this.locOf(opToken),
                operator: op,
                left,
                right,
            };
        }

        return left;
    }

    private parseUnary(): Expression | null {
        if (this.currentType() === TokenType.MINUS) {
            const minusLoc = this.here();
            this.advance();
    
            const operand = this.parseUnary();
            if (operand === null) return null;
    
            return {
                kind: 'UnaryMinus',
                loc: minusLoc,
                operand,
            };
        }

        if (this.currentType() === TokenType.KW_NOT) {
            const notLoc = this.here();
            this.advance();
    
            if (!this.expect(TokenType.LPAREN, "after 'not'")) {
                return null;
            }
    
            const argument = this.parseExpression();
            if (argument === null) return null;
    
            this.expect(TokenType.RPAREN, "after 'not' argument");
    
            return {
                kind: 'NotExpr',
                loc: notLoc,
                argument,
            };
        }

        if (this.currentType() === TokenType.BANG) {
            const bangLoc = this.here();
            this.advance();
    
            const operand = this.parseUnary();
            if (operand === null) return null;
    
            return {
                kind: 'NotExpr',
                loc: bangLoc,
                argument: operand,
            };
        }

        return this.parsePostfix();
    }

    private parsePostfix(): Expression | null {
        let expr = this.parsePrimary();
        if (expr === null) return null;

        while (true) {
            if (this.currentType() === TokenType.LPAREN && expr.kind === 'Identifier') {
                expr = this.finishFunctionCall(expr as IdentifierExpr);
                continue;
            }

            if (this.currentType() === TokenType.DOT) {
                this.advance();
    
                const nameTok = this.expect(TokenType.IDENTIFIER, "after '.'");
                if (nameTok === null) return expr;
    
                if (this.currentType() === TokenType.LPAREN) {
                    this.advance();
                    const args = this.parseArgumentList();
                    this.expect(TokenType.RPAREN, "after method arguments");
    
                    expr = {
                        kind: 'MethodCall',
                        loc: this.locOf(nameTok),
                        object: expr,
                        method: nameTok.value,
                        args,
                    };
                } else {
                    expr = {
                        kind: 'PropertyAccess',
                        loc: this.locOf(nameTok),
                        object: expr,
                        property: nameTok.value,
                    };
                }
                continue;
            }
    
            if (this.currentType() === TokenType.LBRACKET) {
                const bracketLoc = this.here();
                this.advance();
    
                const index = this.parseExpression();
                if (index === null) {
                    this.synchronize();
                    return expr;
                }
    
                this.expect(TokenType.RBRACKET, "after index");
    
                expr = {
                    kind: 'IndexAccess',
                    loc: bracketLoc,
                    object: expr,
                    index,
                };
                continue;
            }
    
            break;
        }
    
        return expr;
    }

    private finishFunctionCall(callee: IdentifierExpr): FunctionCallExpr {
        this.advance();
        const args = this.parseArgumentList();
        this.expect(TokenType.RPAREN, "after function arguments");

        return {
            kind: 'FunctionCall',
            loc: callee.loc,
            callee: callee.name,
            args,
        };
    }

    private parsePrimary(): Expression | null {
        const tok = this.current();

        switch (tok.type) {
            case TokenType.INT_LITERAL:
                this.advance();
                return {
                    kind: 'IntLiteral',
                    loc: this.locOf(tok),
                    value: parseInt(tok.value, 10),
                };

            case TokenType.FLOAT_LITERAL:
                this.advance();
                return {
                    kind: 'FloatLiteral',
                    loc: this.locOf(tok),
                    value: parseFloat(tok.value),
                };

            case TokenType.STRING_LITERAL:
                this.advance();
                return {
                    kind: 'StringLiteral',
                    loc: this.locOf(tok),
                    value: tok.value,
                };

            case TokenType.CHAR_LITERAL:
                this.advance();
                return {
                    kind: 'CharLiteral',
                    loc: this.locOf(tok),
                    value: tok.value,
                };

            case TokenType.KW_TRUE:
                this.advance();
                return { kind: 'BoolLiteral', loc: this.locOf(tok), value: true };

            case TokenType.KW_FALSE:
                this.advance();
                return { kind: 'BoolLiteral', loc: this.locOf(tok), value: false };

            case TokenType.KW_THIS:
                this.advance();
                return { kind: 'ThisExpr', loc: this.locOf(tok) };

            case TokenType.KW_DIV:
            case TokenType.KW_MOD: {
                const funcName = tok.value;
                this.advance();
                if (!this.expect(TokenType.LPAREN, `after '${funcName}'`)) return null;
                const args = this.parseArgumentList();
                this.expect(TokenType.RPAREN, `after '${funcName}' arguments`);
                return {
                    kind: 'FunctionCall',
                    loc: this.locOf(tok),
                    callee: funcName,
                    args,
                };
            }

            case TokenType.LBRACKET:
                return this.parseArrayLiteral();

            case TokenType.LPAREN: {
                this.advance();
                const inner = this.parseExpression();
                this.expect(TokenType.RPAREN, "after expression");
                return inner;
            }

            case TokenType.IDENTIFIER:
                this.advance();
                return {
                    kind: 'Identifier',
                    loc: this.locOf(tok),
                    name: tok.value,
                };

            case TokenType.KW_VOID:
            case TokenType.KW_INT:
            case TokenType.KW_FLOAT:
            case TokenType.KW_STRING:
            case TokenType.KW_CHAR:
            case TokenType.KW_BOOL:
                if (this.peek(1).type === TokenType.KW_FUNCTION) {
                    return this.parseLambda();
                }
                break;
            
            case TokenType.KW_PARENT:
                this.errors.addError(this.file, this.currentLine(),
                    "'parent()' can only be used as the first statement in a constructor");
                this.advance();
                return null;

            default:
                break;
        }

        this.errors.addError(this.file, this.currentLine(),
            `expected expression but found ${tokenDisplayValue(this.current())}`);
        this.advance();
        return null;
    }

    private parseArrayLiteral(): ArrayLiteralExpr {
        const arrLoc = this.here();
        this.advance();

        const elements: Expression[] = [];

        if (this.currentType() !== TokenType.RBRACKET) {
            while (true) {
                const elem = this.parseExpression();
                if (elem !== null) {
                    elements.push(elem);
                }
                if (!this.match(TokenType.COMMA)) break;
            }
        }

        this.expect(TokenType.RBRACKET, "after array elements");

        return {
            kind: 'ArrayLiteral',
            loc: arrLoc,
            elements,
        };
    }

    private parseLambda(): LambdaExpr | null {
        const lambdaLoc = this.here();

        const returnType = this.parseType();
        if (returnType === null) return null;

        this.expect(TokenType.KW_FUNCTION, "in lambda expression");
        this.expect(TokenType.LPAREN, "after 'function' in lambda");
        const params = this.parseParameterList();
        this.expect(TokenType.RPAREN, "after lambda parameters");

        const body = this.parseBlock();

        return {
            kind: 'Lambda',
            loc: lambdaLoc,
            returnType,
            params,
            body,
        };
    }

    private parseArgumentList(): Argument[] {
        const args: Argument[] = [];

        if (this.currentType() === TokenType.RPAREN) {
            return args;
        }

        while (true) {
            const argLoc = this.here();
            let name: string | null = null;

            if (this.currentType() === TokenType.IDENTIFIER &&
                this.peek(1).type === TokenType.ASSIGN) {
                name = this.current().value;
                this.advance();
                this.advance();
            }

            const value = this.parseExpression();
            if (value === null) break;

            args.push({
                loc: argLoc,
                name,
                value,
            });

            if (!this.match(TokenType.COMMA)) break;
        }

        return args;
    }
}