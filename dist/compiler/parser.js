"use strict";
// src/compiler/parser.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const tokens_1 = require("./tokens");
const ast_1 = require("./ast");
function getBinaryPrecedence(type) {
    switch (type) {
        case tokens_1.TokenType.KW_OR:
        case tokens_1.TokenType.KW_XOR:
        case tokens_1.TokenType.PIPEPIPE:
            return 10;
        case tokens_1.TokenType.KW_AND:
        case tokens_1.TokenType.AMPAMP:
            return 20;
        case tokens_1.TokenType.EQ:
        case tokens_1.TokenType.NEQ:
            return 30;
        case tokens_1.TokenType.LT:
        case tokens_1.TokenType.GT:
        case tokens_1.TokenType.LTE:
        case tokens_1.TokenType.GTE:
            return 40;
        case tokens_1.TokenType.PLUS:
        case tokens_1.TokenType.MINUS:
            return 50;
        case tokens_1.TokenType.STAR:
        case tokens_1.TokenType.SLASH:
            return 60;
        default:
            return -1;
    }
}
function tokenToBinaryOp(type) {
    switch (type) {
        case tokens_1.TokenType.PLUS: return '+';
        case tokens_1.TokenType.MINUS: return '-';
        case tokens_1.TokenType.STAR: return '*';
        case tokens_1.TokenType.SLASH: return '/';
        case tokens_1.TokenType.EQ: return '==';
        case tokens_1.TokenType.NEQ: return '!=';
        case tokens_1.TokenType.LT: return '<';
        case tokens_1.TokenType.GT: return '>';
        case tokens_1.TokenType.LTE: return '<=';
        case tokens_1.TokenType.GTE: return '>=';
        case tokens_1.TokenType.KW_AND:
        case tokens_1.TokenType.AMPAMP:
            return 'and';
        case tokens_1.TokenType.KW_OR:
        case tokens_1.TokenType.PIPEPIPE:
            return 'or';
        case tokens_1.TokenType.KW_XOR: return 'xor';
        default:
            throw new Error(`Internal: not a binary operator: ${type}`);
    }
}
function isTypeStart(type) {
    switch (type) {
        case tokens_1.TokenType.KW_INT:
        case tokens_1.TokenType.KW_FLOAT:
        case tokens_1.TokenType.KW_STRING:
        case tokens_1.TokenType.KW_CHAR:
        case tokens_1.TokenType.KW_BOOL:
        case tokens_1.TokenType.KW_VOID:
        case tokens_1.TokenType.KW_ARRAY:
        case tokens_1.TokenType.KW_DYN_ARRAY:
        case tokens_1.TokenType.IDENTIFIER:
            return true;
        default:
            return false;
    }
}
function isAssignmentOp(type) {
    switch (type) {
        case tokens_1.TokenType.ASSIGN: return '=';
        case tokens_1.TokenType.PLUS_ASSIGN: return '+=';
        case tokens_1.TokenType.MINUS_ASSIGN: return '-=';
        case tokens_1.TokenType.STAR_ASSIGN: return '*=';
        case tokens_1.TokenType.SLASH_ASSIGN: return '/=';
        default: return null;
    }
}
class Parser {
    constructor(tokens, file, errors, isLibrary = false) {
        this.pos = 0;
        this.tokens = tokens;
        this.file = file;
        this.errors = errors;
        this.isLibrary = isLibrary;
    }
    current() {
        return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
    }
    currentType() {
        return this.current().type;
    }
    currentLine() {
        return this.current().line;
    }
    isAtEnd() {
        return this.currentType() === tokens_1.TokenType.EOF;
    }
    peek(offset = 0) {
        const idx = this.pos + offset;
        return idx < this.tokens.length
            ? this.tokens[idx]
            : this.tokens[this.tokens.length - 1];
    }
    advance() {
        const tok = this.current();
        if (!this.isAtEnd())
            this.pos++;
        return tok;
    }
    expect(type, contextMsg) {
        if (this.currentType() === type) {
            return this.advance();
        }
        const where = contextMsg ? ` ${contextMsg}` : '';
        this.errors.addError(this.file, this.currentLine(), `expected ${(0, tokens_1.tokenTypeName)(type)} but found ${(0, tokens_1.tokenDisplayValue)(this.current())}${where}`);
        return null;
    }
    match(type) {
        if (this.currentType() === type) {
            this.advance();
            return true;
        }
        return false;
    }
    here() {
        return (0, ast_1.loc)(this.file, this.currentLine());
    }
    locOf(token) {
        return (0, ast_1.loc)(token.file, token.line);
    }
    synchronize() {
        while (!this.isAtEnd()) {
            if (this.currentType() === tokens_1.TokenType.SEMICOLON) {
                this.advance();
                return;
            }
            if (this.currentType() === tokens_1.TokenType.RBRACE) {
                return;
            }
            switch (this.currentType()) {
                case tokens_1.TokenType.KW_INT:
                case tokens_1.TokenType.KW_FLOAT:
                case tokens_1.TokenType.KW_STRING:
                case tokens_1.TokenType.KW_CHAR:
                case tokens_1.TokenType.KW_BOOL:
                case tokens_1.TokenType.KW_VOID:
                case tokens_1.TokenType.KW_ARRAY:
                case tokens_1.TokenType.KW_DYN_ARRAY:
                case tokens_1.TokenType.KW_IF:
                case tokens_1.TokenType.KW_WHILE:
                case tokens_1.TokenType.KW_DO:
                case tokens_1.TokenType.KW_FOR:
                case tokens_1.TokenType.KW_RETURN:
                case tokens_1.TokenType.KW_BREAK:
                case tokens_1.TokenType.KW_CONTINUE:
                case tokens_1.TokenType.KW_CLASS:
                case tokens_1.TokenType.KW_USE:
                case tokens_1.TokenType.KW_FUNCTION:
                    return;
                default:
                    break;
            }
            this.advance();
        }
    }
    parse() {
        const programLoc = this.here();
        const imports = this.parseImports();
        const declarations = [];
        let main = null;
        while (!this.isAtEnd()) {
            if (this.currentType() === tokens_1.TokenType.KW_MAIN && this.peek(1).type === tokens_1.TokenType.LPAREN) {
                if (main !== null) {
                    this.errors.addError(this.file, this.currentLine(), "only one 'main()' function is allowed per program");
                }
                main = this.parseMainShort();
                continue;
            }
            if (this.looksLikeFunctionDecl()) {
                const funcDecl = this.parseFunctionDecl();
                if (funcDecl === null)
                    continue;
                if (funcDecl.name === 'main') {
                    if (main !== null) {
                        this.errors.addError(this.file, funcDecl.loc.line, "only one 'main()' function is allowed per program");
                    }
                    main = funcDecl;
                }
                else {
                    declarations.push(funcDecl);
                }
                continue;
            }
            if (this.currentType() === tokens_1.TokenType.KW_CLASS) {
                const classDecl = this.parseClassDecl();
                if (classDecl !== null) {
                    declarations.push(classDecl);
                }
                continue;
            }
            this.errors.addError(this.file, this.currentLine(), `unexpected ${(0, tokens_1.tokenDisplayValue)(this.current())} at top level`);
            this.advance();
        }
        if (main === null) {
            if (!this.isLibrary) {
                this.errors.addError(this.file, this.currentLine(), "no 'main()' function found");
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
    parseImports() {
        const imports = [];
        while (this.currentType() === tokens_1.TokenType.KW_USE) {
            const useLoc = this.here();
            this.advance();
            const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "after 'use'");
            if (nameTok === null) {
                this.synchronize();
                continue;
            }
            this.expect(tokens_1.TokenType.SEMICOLON, "after library name");
            imports.push({
                kind: 'UseDeclaration',
                loc: useLoc,
                libraryName: nameTok.value,
            });
        }
        return imports;
    }
    looksLikeFunctionDecl() {
        if (!isTypeStart(this.currentType()))
            return false;
        const saved = this.pos;
        const result = this.trySkipType() && this.currentType() === tokens_1.TokenType.KW_FUNCTION;
        this.pos = saved;
        return result;
    }
    trySkipType() {
        switch (this.currentType()) {
            case tokens_1.TokenType.KW_INT:
            case tokens_1.TokenType.KW_FLOAT:
            case tokens_1.TokenType.KW_STRING:
            case tokens_1.TokenType.KW_CHAR:
            case tokens_1.TokenType.KW_BOOL:
            case tokens_1.TokenType.KW_VOID:
                this.pos++;
                return true;
            case tokens_1.TokenType.KW_ARRAY:
                this.pos++;
                if (this.currentType() !== tokens_1.TokenType.LT)
                    return false;
                this.pos++;
                if (!this.trySkipType())
                    return false;
                if (this.currentType() !== tokens_1.TokenType.COMMA)
                    return false;
                this.pos++;
                if (this.currentType() !== tokens_1.TokenType.INT_LITERAL)
                    return false;
                this.pos++;
                if (this.currentType() !== tokens_1.TokenType.GT)
                    return false;
                this.pos++;
                return true;
            case tokens_1.TokenType.KW_DYN_ARRAY:
                this.pos++;
                if (this.currentType() !== tokens_1.TokenType.LT)
                    return false;
                this.pos++;
                if (!this.trySkipType())
                    return false;
                if (this.currentType() !== tokens_1.TokenType.GT)
                    return false;
                this.pos++;
                return true;
            case tokens_1.TokenType.IDENTIFIER:
                this.pos++;
                if (this.currentType() === tokens_1.TokenType.DOT &&
                    this.peek(1).type === tokens_1.TokenType.IDENTIFIER) {
                    this.pos += 2;
                }
                return true;
            default:
                return false;
        }
    }
    looksLikeVarDecl() {
        if (!isTypeStart(this.currentType()))
            return false;
        if (this.currentType() === tokens_1.TokenType.IDENTIFIER) {
            const next = this.peek(1).type;
            if (next === tokens_1.TokenType.IDENTIFIER)
                return true;
            if (next === tokens_1.TokenType.DOT &&
                this.peek(2).type === tokens_1.TokenType.IDENTIFIER &&
                this.peek(3).type === tokens_1.TokenType.IDENTIFIER)
                return true;
            return false;
        }
        return true;
    }
    parseType() {
        const typeLoc = this.here();
        switch (this.currentType()) {
            case tokens_1.TokenType.KW_INT:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'int' };
            case tokens_1.TokenType.KW_FLOAT:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'float' };
            case tokens_1.TokenType.KW_STRING:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'string' };
            case tokens_1.TokenType.KW_CHAR:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'char' };
            case tokens_1.TokenType.KW_BOOL:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'bool' };
            case tokens_1.TokenType.KW_VOID:
                this.advance();
                return { kind: 'PrimitiveType', loc: typeLoc, name: 'void' };
        }
        if (this.currentType() === tokens_1.TokenType.KW_ARRAY) {
            return this.parseArrayType();
        }
        if (this.currentType() === tokens_1.TokenType.KW_DYN_ARRAY) {
            return this.parseDynArrayType();
        }
        if (this.currentType() === tokens_1.TokenType.IDENTIFIER) {
            const ident = this.advance();
            if (this.currentType() === tokens_1.TokenType.DOT &&
                this.peek(1).type === tokens_1.TokenType.IDENTIFIER) {
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
        this.errors.addError(this.file, this.currentLine(), `expected type but found ${(0, tokens_1.tokenDisplayValue)(this.current())}`);
        return null;
    }
    parseArrayType() {
        const typeLoc = this.here();
        this.advance();
        if (!this.expect(tokens_1.TokenType.LT, "after 'array'"))
            return null;
        const elementType = this.parseType();
        if (elementType === null)
            return null;
        if (!this.expect(tokens_1.TokenType.COMMA, "in array type"))
            return null;
        const sizeTok = this.expect(tokens_1.TokenType.INT_LITERAL, "for array size");
        if (sizeTok === null)
            return null;
        const size = parseInt(sizeTok.value, 10);
        if (size <= 0) {
            this.errors.addError(this.file, sizeTok.line, `array size must be a positive integer (got ${size})`);
        }
        if (!this.expect(tokens_1.TokenType.GT, "after array size"))
            return null;
        return {
            kind: 'ArrayType',
            loc: typeLoc,
            elementType,
            size: Math.max(size, 1),
        };
    }
    parseDynArrayType() {
        const typeLoc = this.here();
        this.advance();
        if (!this.expect(tokens_1.TokenType.LT, "after 'dyn_array'"))
            return null;
        const elementType = this.parseType();
        if (elementType === null)
            return null;
        if (!this.expect(tokens_1.TokenType.GT, "after element type"))
            return null;
        return {
            kind: 'DynArrayType',
            loc: typeLoc,
            elementType,
        };
    }
    parseMainShort() {
        const mainLoc = this.here();
        this.advance();
        this.expect(tokens_1.TokenType.LPAREN, "after 'main'");
        this.expect(tokens_1.TokenType.RPAREN, "in 'main()'");
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
    parseFunctionDecl() {
        const funcLoc = this.here();
        const returnType = this.parseType();
        if (returnType === null) {
            this.synchronize();
            return null;
        }
        this.expect(tokens_1.TokenType.KW_FUNCTION, "in function declaration");
        let name;
        if (this.currentType() === tokens_1.TokenType.KW_MAIN) {
            name = 'main';
            this.advance();
        }
        else {
            const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for function name");
            if (nameTok === null) {
                this.synchronize();
                return null;
            }
            name = nameTok.value;
        }
        if (!this.expect(tokens_1.TokenType.LPAREN, `after function name '${name}'`)) {
            this.synchronize();
            return null;
        }
        const params = this.parseParameterList();
        this.expect(tokens_1.TokenType.RPAREN, "after parameters");
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
    parseParameterList() {
        const params = [];
        if (this.currentType() === tokens_1.TokenType.RPAREN) {
            return params;
        }
        while (true) {
            const param = this.parseOneParameter();
            if (param !== null) {
                params.push(param);
            }
            if (!this.match(tokens_1.TokenType.COMMA))
                break;
        }
        return params;
    }
    parseOneParameter() {
        const paramLoc = this.here();
        const paramType = this.parseType();
        if (paramType === null)
            return null;
        const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for parameter name");
        if (nameTok === null)
            return null;
        let defaultValue = null;
        if (this.match(tokens_1.TokenType.ASSIGN)) {
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
    parseClassDecl() {
        const classLoc = this.here();
        this.advance();
        const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for class name");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        const className = nameTok.value;
        let parentClass = null;
        let parentModule = null;
        if (this.match(tokens_1.TokenType.KW_EXTENDS)) {
            const firstTok = this.expect(tokens_1.TokenType.IDENTIFIER, "after 'extends'");
            if (firstTok !== null) {
                if (this.match(tokens_1.TokenType.DOT)) {
                    const classNameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for parent class name");
                    if (classNameTok !== null) {
                        parentModule = firstTok.value;
                        parentClass = classNameTok.value;
                    }
                }
                else {
                    parentClass = firstTok.value;
                }
            }
        }
        if (!this.expect(tokens_1.TokenType.LBRACE, `after class name '${className}'`)) {
            this.synchronize();
            return null;
        }
        const members = this.parseClassBody(className);
        this.expect(tokens_1.TokenType.RBRACE, `at end of class '${className}'`);
        this.match(tokens_1.TokenType.SEMICOLON);
        return {
            kind: 'ClassDecl',
            loc: classLoc,
            name: className,
            parentClass,
            parentModule,
            members,
        };
    }
    parseClassBody(className) {
        const members = [];
        let currentAccess = 'public';
        while (!this.isAtEnd() && this.currentType() !== tokens_1.TokenType.RBRACE) {
            if ((this.currentType() === tokens_1.TokenType.KW_PUBLIC ||
                this.currentType() === tokens_1.TokenType.KW_PRIVATE) &&
                this.peek(1).type === tokens_1.TokenType.COLON) {
                currentAccess = this.currentType() === tokens_1.TokenType.KW_PUBLIC ? 'public' : 'private';
                this.advance();
                this.advance();
                continue;
            }
            if (this.currentType() === tokens_1.TokenType.KW_CONSTRUCTOR) {
                const ctor = this.parseConstructor(className, currentAccess);
                if (ctor !== null)
                    members.push(ctor);
                continue;
            }
            if (this.currentType() === tokens_1.TokenType.KW_DESTRUCTOR) {
                const dtor = this.parseDestructor(className, currentAccess);
                if (dtor !== null)
                    members.push(dtor);
                continue;
            }
            if (this.looksLikeFunctionDecl()) {
                const method = this.parseClassMethod(currentAccess);
                if (method !== null)
                    members.push(method);
                continue;
            }
            if (isTypeStart(this.currentType())) {
                const fields = this.parseClassFields(currentAccess);
                members.push(...fields);
                continue;
            }
            this.errors.addError(this.file, this.currentLine(), `unexpected ${(0, tokens_1.tokenDisplayValue)(this.current())} in class body`);
            this.advance();
        }
        return members;
    }
    parseClassFields(access) {
        const fieldLoc = this.here();
        const fieldType = this.parseType();
        if (fieldType === null) {
            this.synchronize();
            return [];
        }
        const fields = [];
        while (true) {
            const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for field name");
            if (nameTok === null) {
                this.synchronize();
                return fields;
            }
            let initializer = null;
            if (this.match(tokens_1.TokenType.ASSIGN)) {
                initializer = this.parseExpression();
            }
            fields.push({
                kind: 'ClassField',
                loc: this.locOf(nameTok),
                access,
                fieldType,
                name: nameTok.value,
                initializer,
            });
            if (!this.match(tokens_1.TokenType.COMMA))
                break;
        }
        this.expect(tokens_1.TokenType.SEMICOLON, "after field declaration");
        return fields;
    }
    parseClassMethod(access) {
        const methodLoc = this.here();
        const returnType = this.parseType();
        if (returnType === null) {
            this.synchronize();
            return null;
        }
        this.expect(tokens_1.TokenType.KW_FUNCTION, "in method declaration");
        const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for method name");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        this.expect(tokens_1.TokenType.LPAREN, `after method name '${nameTok.value}'`);
        const params = this.parseParameterList();
        this.expect(tokens_1.TokenType.RPAREN, "after method parameters");
        const body = this.parseBlock();
        return {
            kind: 'ClassMethod',
            loc: methodLoc,
            access,
            returnType,
            name: nameTok.value,
            params,
            body,
        };
    }
    parseConstructor(className, access) {
        const ctorLoc = this.here();
        this.advance();
        const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "after 'constructor'");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        if (nameTok.value !== className) {
            this.errors.addError(this.file, nameTok.line, `constructor name '${nameTok.value}' does not match class name '${className}'`);
        }
        this.expect(tokens_1.TokenType.LPAREN, "after constructor name");
        const params = this.parseParameterList();
        this.expect(tokens_1.TokenType.RPAREN, "after constructor parameters");
        const body = this.parseBlock();
        return {
            kind: 'ClassConstructor',
            loc: ctorLoc,
            access,
            className,
            params,
            body,
        };
    }
    parseDestructor(className, access) {
        const dtorLoc = this.here();
        this.advance();
        if (!this.expect(tokens_1.TokenType.TILDE, "before destructor name")) {
            this.synchronize();
            return null;
        }
        const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "after '~'");
        if (nameTok === null) {
            this.synchronize();
            return null;
        }
        if (nameTok.value !== className) {
            this.errors.addError(this.file, nameTok.line, `destructor name '${nameTok.value}' does not match class name '${className}'`);
        }
        this.expect(tokens_1.TokenType.LPAREN, "after destructor name");
        this.expect(tokens_1.TokenType.RPAREN, "destructor cannot have parameters");
        const body = this.parseBlock();
        return {
            kind: 'ClassDestructor',
            loc: dtorLoc,
            access,
            className,
            body,
        };
    }
    parseBlock() {
        const blockLoc = this.here();
        if (!this.expect(tokens_1.TokenType.LBRACE, "to open block")) {
            return { kind: 'Block', loc: blockLoc, statements: [] };
        }
        const statements = [];
        while (!this.isAtEnd() && this.currentType() !== tokens_1.TokenType.RBRACE) {
            const stmt = this.parseStatement();
            if (stmt !== null) {
                statements.push(stmt);
            }
        }
        this.expect(tokens_1.TokenType.RBRACE, "to close block");
        return {
            kind: 'Block',
            loc: blockLoc,
            statements,
        };
    }
    parseStatement() {
        switch (this.currentType()) {
            case tokens_1.TokenType.KW_IF:
                return this.parseIfStmt();
            case tokens_1.TokenType.KW_WHILE:
                return this.parseWhileStmt();
            case tokens_1.TokenType.KW_DO:
                return this.parseDoWhileStmt();
            case tokens_1.TokenType.KW_FOR:
                return this.parseForStmt();
            case tokens_1.TokenType.KW_RETURN:
                return this.parseReturnStmt();
            case tokens_1.TokenType.KW_BREAK: {
                const breakLoc = this.here();
                this.advance();
                this.expect(tokens_1.TokenType.SEMICOLON, "after 'break'");
                return { kind: 'BreakStmt', loc: breakLoc };
            }
            case tokens_1.TokenType.KW_CONTINUE: {
                const contLoc = this.here();
                this.advance();
                this.expect(tokens_1.TokenType.SEMICOLON, "after 'continue'");
                return { kind: 'ContinueStmt', loc: contLoc };
            }
            case tokens_1.TokenType.KW_TRY:
                return this.parseTryStmt();
            default:
                break;
        }
        if (this.looksLikeVarDecl()) {
            return this.parseVarDeclStatement();
        }
        return this.parseAssignmentOrExprStmt();
    }
    parseVarDeclStatement() {
        const declLoc = this.here();
        const varType = this.parseType();
        if (varType === null) {
            this.synchronize();
            return null;
        }
        const declarations = [];
        while (true) {
            const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for variable name");
            if (nameTok === null) {
                this.synchronize();
                return null;
            }
            let initializer = null;
            let constructorArgs = null;
            if (this.match(tokens_1.TokenType.ASSIGN)) {
                initializer = this.parseExpression();
            }
            else if (this.currentType() === tokens_1.TokenType.LPAREN) {
                this.advance();
                constructorArgs = this.parseArgumentList();
                this.expect(tokens_1.TokenType.RPAREN, "after constructor arguments");
            }
            declarations.push({
                loc: this.locOf(nameTok),
                name: nameTok.value,
                initializer,
                constructorArgs,
            });
            if (!this.match(tokens_1.TokenType.COMMA)) {
                break;
            }
        }
        this.expect(tokens_1.TokenType.SEMICOLON, "after variable declaration");
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
    parseOneVarDecl(varType, declLoc) {
        const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for variable name");
        if (nameTok === null) {
            return null;
        }
        let initializer = null;
        let constructorArgs = null;
        if (this.match(tokens_1.TokenType.ASSIGN)) {
            initializer = this.parseExpression();
        }
        else if (this.currentType() === tokens_1.TokenType.LPAREN) {
            this.advance();
            constructorArgs = this.parseArgumentList();
            this.expect(tokens_1.TokenType.RPAREN, "after constructor arguments");
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
    parseAssignmentOrExprStmt() {
        const stmtLoc = this.here();
        const expr = this.parseExpression();
        if (expr === null) {
            this.synchronize();
            return null;
        }
        const assignOp = isAssignmentOp(this.currentType());
        if (assignOp !== null) {
            if (!(0, ast_1.isAssignmentTarget)(expr)) {
                this.errors.addError(this.file, stmtLoc.line, 'invalid assignment target');
                this.advance();
                this.parseExpression();
                this.expect(tokens_1.TokenType.SEMICOLON, "after assignment");
                return null;
            }
            this.advance();
            const value = this.parseExpression();
            if (value === null) {
                this.synchronize();
                return null;
            }
            this.expect(tokens_1.TokenType.SEMICOLON, "after assignment");
            return {
                kind: 'AssignmentStmt',
                loc: stmtLoc,
                target: expr,
                operator: assignOp,
                value,
            };
        }
        this.expect(tokens_1.TokenType.SEMICOLON, "after expression");
        return {
            kind: 'ExpressionStmt',
            loc: stmtLoc,
            expression: expr,
        };
    }
    parseIfStmt() {
        const ifLoc = this.here();
        this.advance();
        if (this.currentType() !== tokens_1.TokenType.LPAREN) {
            this.errors.addError(this.file, this.currentLine(), "missing '(' after 'if'");
        }
        const condition = this.parseParenthesizedCondition();
        const thenBlock = this.parseBlock();
        const elseIfClauses = [];
        let elseBlock = null;
        while (this.currentType() === tokens_1.TokenType.KW_ELSE) {
            const elseLoc = this.here();
            this.advance();
            if (this.currentType() === tokens_1.TokenType.KW_IF) {
                this.advance();
                const elseIfCondition = this.parseParenthesizedCondition();
                const elseIfBlock = this.parseBlock();
                elseIfClauses.push({
                    loc: elseLoc,
                    condition: elseIfCondition,
                    block: elseIfBlock,
                });
            }
            else if (this.currentType() === tokens_1.TokenType.LPAREN) {
                this.errors.addError(this.file, this.currentLine(), "'else' cannot have a condition, use 'else if' instead");
                this.parseParenthesizedCondition();
                elseBlock = this.parseBlock();
                break;
            }
            else {
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
    parseParenthesizedCondition() {
        this.expect(tokens_1.TokenType.LPAREN, "before condition");
        if (this.currentType() === tokens_1.TokenType.RPAREN) {
            this.errors.addError(this.file, this.currentLine(), 'condition cannot be empty');
            this.advance();
            return { kind: 'BoolLiteral', loc: this.here(), value: false };
        }
        const expr = this.parseExpression();
        this.expect(tokens_1.TokenType.RPAREN, "after condition");
        return expr ?? { kind: 'BoolLiteral', loc: this.here(), value: false };
    }
    parseWhileStmt() {
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
    parseDoWhileStmt() {
        const doLoc = this.here();
        this.advance();
        const body = this.parseBlock();
        this.expect(tokens_1.TokenType.KW_WHILE, "after 'do' block");
        const condition = this.parseParenthesizedCondition();
        this.expect(tokens_1.TokenType.SEMICOLON, "after 'do-while' condition");
        return {
            kind: 'DoWhileStmt',
            loc: doLoc,
            body,
            condition,
        };
    }
    parseForStmt() {
        const forLoc = this.here();
        this.advance();
        this.expect(tokens_1.TokenType.LPAREN, "after 'for'");
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
        this.expect(tokens_1.TokenType.SEMICOLON, "after 'for' initialization");
        const condition = this.parseExpression();
        if (condition === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }
        this.expect(tokens_1.TokenType.SEMICOLON, "after 'for' condition");
        const updateLoc = this.here();
        const updateExpr = this.parseExpression();
        if (updateExpr === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }
        const updateOp = isAssignmentOp(this.currentType());
        if (updateOp === null) {
            this.errors.addError(this.file, this.currentLine(), "expected assignment operator in 'for' update");
            this.synchronize();
            return this.dummyFor(forLoc);
        }
        if (!(0, ast_1.isAssignmentTarget)(updateExpr)) {
            this.errors.addError(this.file, updateLoc.line, "invalid assignment target in 'for' update");
        }
        this.advance();
        const updateValue = this.parseExpression();
        if (updateValue === null) {
            this.synchronize();
            return this.dummyFor(forLoc);
        }
        const update = {
            kind: 'AssignmentStmt',
            loc: updateLoc,
            target: updateExpr,
            operator: updateOp,
            value: updateValue,
        };
        this.expect(tokens_1.TokenType.RPAREN, "after 'for' clauses");
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
    dummyFor(forLoc) {
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
    parseReturnStmt() {
        const retLoc = this.here();
        this.advance();
        let value = null;
        if (this.currentType() !== tokens_1.TokenType.SEMICOLON) {
            value = this.parseExpression();
        }
        this.expect(tokens_1.TokenType.SEMICOLON, "after 'return'");
        return {
            kind: 'ReturnStmt',
            loc: retLoc,
            value,
        };
    }
    parseTryStmt() {
        const tryLoc = this.here();
        this.advance();
        const tryBlock = this.parseBlock();
        if (!this.expect(tokens_1.TokenType.KW_CATCH, "after 'try' block")) {
            return {
                kind: 'TryStmt',
                loc: tryLoc,
                tryBlock,
                catchParam: null,
                catchBlock: { kind: 'Block', loc: this.here(), statements: [] },
            };
        }
        let catchParam = null;
        if (this.currentType() === tokens_1.TokenType.LPAREN) {
            this.advance();
            const paramLoc = this.here();
            const paramType = this.parseType();
            if (paramType !== null) {
                const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "for catch parameter name");
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
            this.expect(tokens_1.TokenType.RPAREN, "after catch parameter");
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
    parseExpression() {
        return this.parseBinaryExpr(0);
    }
    parseBinaryExpr(minPrec) {
        let left = this.parseUnary();
        if (left === null)
            return null;
        while (true) {
            const prec = getBinaryPrecedence(this.currentType());
            if (prec < minPrec)
                break;
            const opToken = this.advance();
            const op = tokenToBinaryOp(opToken.type);
            const right = this.parseBinaryExpr(prec + 1);
            if (right === null)
                return left;
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
    parseUnary() {
        if (this.currentType() === tokens_1.TokenType.MINUS) {
            const minusLoc = this.here();
            this.advance();
            const operand = this.parseUnary();
            if (operand === null)
                return null;
            return {
                kind: 'UnaryMinus',
                loc: minusLoc,
                operand,
            };
        }
        if (this.currentType() === tokens_1.TokenType.KW_NOT) {
            const notLoc = this.here();
            this.advance();
            if (!this.expect(tokens_1.TokenType.LPAREN, "after 'not'")) {
                return null;
            }
            const argument = this.parseExpression();
            if (argument === null)
                return null;
            this.expect(tokens_1.TokenType.RPAREN, "after 'not' argument");
            return {
                kind: 'NotExpr',
                loc: notLoc,
                argument,
            };
        }
        if (this.currentType() === tokens_1.TokenType.BANG) {
            const bangLoc = this.here();
            this.advance();
            const operand = this.parseUnary();
            if (operand === null)
                return null;
            return {
                kind: 'NotExpr',
                loc: bangLoc,
                argument: operand,
            };
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let expr = this.parsePrimary();
        if (expr === null)
            return null;
        while (true) {
            if (this.currentType() === tokens_1.TokenType.LPAREN && expr.kind === 'Identifier') {
                expr = this.finishFunctionCall(expr);
                continue;
            }
            if (this.currentType() === tokens_1.TokenType.DOT) {
                this.advance();
                const nameTok = this.expect(tokens_1.TokenType.IDENTIFIER, "after '.'");
                if (nameTok === null)
                    return expr;
                if (this.currentType() === tokens_1.TokenType.LPAREN) {
                    this.advance();
                    const args = this.parseArgumentList();
                    this.expect(tokens_1.TokenType.RPAREN, "after method arguments");
                    expr = {
                        kind: 'MethodCall',
                        loc: this.locOf(nameTok),
                        object: expr,
                        method: nameTok.value,
                        args,
                    };
                }
                else {
                    expr = {
                        kind: 'PropertyAccess',
                        loc: this.locOf(nameTok),
                        object: expr,
                        property: nameTok.value,
                    };
                }
                continue;
            }
            if (this.currentType() === tokens_1.TokenType.LBRACKET) {
                const bracketLoc = this.here();
                this.advance();
                const index = this.parseExpression();
                if (index === null) {
                    this.synchronize();
                    return expr;
                }
                this.expect(tokens_1.TokenType.RBRACKET, "after index");
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
    finishFunctionCall(callee) {
        this.advance();
        const args = this.parseArgumentList();
        this.expect(tokens_1.TokenType.RPAREN, "after function arguments");
        return {
            kind: 'FunctionCall',
            loc: callee.loc,
            callee: callee.name,
            args,
        };
    }
    parsePrimary() {
        const tok = this.current();
        switch (tok.type) {
            case tokens_1.TokenType.INT_LITERAL:
                this.advance();
                return {
                    kind: 'IntLiteral',
                    loc: this.locOf(tok),
                    value: parseInt(tok.value, 10),
                };
            case tokens_1.TokenType.FLOAT_LITERAL:
                this.advance();
                return {
                    kind: 'FloatLiteral',
                    loc: this.locOf(tok),
                    value: parseFloat(tok.value),
                };
            case tokens_1.TokenType.STRING_LITERAL:
                this.advance();
                return {
                    kind: 'StringLiteral',
                    loc: this.locOf(tok),
                    value: tok.value,
                };
            case tokens_1.TokenType.CHAR_LITERAL:
                this.advance();
                return {
                    kind: 'CharLiteral',
                    loc: this.locOf(tok),
                    value: tok.value,
                };
            case tokens_1.TokenType.KW_TRUE:
                this.advance();
                return { kind: 'BoolLiteral', loc: this.locOf(tok), value: true };
            case tokens_1.TokenType.KW_FALSE:
                this.advance();
                return { kind: 'BoolLiteral', loc: this.locOf(tok), value: false };
            case tokens_1.TokenType.KW_THIS:
                this.advance();
                return { kind: 'ThisExpr', loc: this.locOf(tok) };
            case tokens_1.TokenType.KW_DIV:
            case tokens_1.TokenType.KW_MOD: {
                const funcName = tok.value;
                this.advance();
                if (!this.expect(tokens_1.TokenType.LPAREN, `after '${funcName}'`))
                    return null;
                const args = this.parseArgumentList();
                this.expect(tokens_1.TokenType.RPAREN, `after '${funcName}' arguments`);
                return {
                    kind: 'FunctionCall',
                    loc: this.locOf(tok),
                    callee: funcName,
                    args,
                };
            }
            case tokens_1.TokenType.LBRACKET:
                return this.parseArrayLiteral();
            case tokens_1.TokenType.LPAREN: {
                this.advance();
                const inner = this.parseExpression();
                this.expect(tokens_1.TokenType.RPAREN, "after expression");
                return inner;
            }
            case tokens_1.TokenType.IDENTIFIER:
                this.advance();
                return {
                    kind: 'Identifier',
                    loc: this.locOf(tok),
                    name: tok.value,
                };
            case tokens_1.TokenType.KW_VOID:
            case tokens_1.TokenType.KW_INT:
            case tokens_1.TokenType.KW_FLOAT:
            case tokens_1.TokenType.KW_STRING:
            case tokens_1.TokenType.KW_CHAR:
            case tokens_1.TokenType.KW_BOOL:
                if (this.peek(1).type === tokens_1.TokenType.KW_FUNCTION) {
                    return this.parseLambda();
                }
                break;
            default:
                break;
        }
        this.errors.addError(this.file, this.currentLine(), `expected expression but found ${(0, tokens_1.tokenDisplayValue)(this.current())}`);
        this.advance();
        return null;
    }
    parseArrayLiteral() {
        const arrLoc = this.here();
        this.advance();
        const elements = [];
        if (this.currentType() !== tokens_1.TokenType.RBRACKET) {
            while (true) {
                const elem = this.parseExpression();
                if (elem !== null) {
                    elements.push(elem);
                }
                if (!this.match(tokens_1.TokenType.COMMA))
                    break;
            }
        }
        this.expect(tokens_1.TokenType.RBRACKET, "after array elements");
        return {
            kind: 'ArrayLiteral',
            loc: arrLoc,
            elements,
        };
    }
    parseLambda() {
        const lambdaLoc = this.here();
        const returnType = this.parseType();
        if (returnType === null)
            return null;
        this.expect(tokens_1.TokenType.KW_FUNCTION, "in lambda expression");
        this.expect(tokens_1.TokenType.LPAREN, "after 'function' in lambda");
        const params = this.parseParameterList();
        this.expect(tokens_1.TokenType.RPAREN, "after lambda parameters");
        const body = this.parseBlock();
        return {
            kind: 'Lambda',
            loc: lambdaLoc,
            returnType,
            params,
            body,
        };
    }
    parseArgumentList() {
        const args = [];
        if (this.currentType() === tokens_1.TokenType.RPAREN) {
            return args;
        }
        while (true) {
            const argLoc = this.here();
            let name = null;
            if (this.currentType() === tokens_1.TokenType.IDENTIFIER &&
                this.peek(1).type === tokens_1.TokenType.ASSIGN) {
                name = this.current().value;
                this.advance();
                this.advance();
            }
            const value = this.parseExpression();
            if (value === null)
                break;
            args.push({
                loc: argLoc,
                name,
                value,
            });
            if (!this.match(tokens_1.TokenType.COMMA))
                break;
        }
        return args;
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map