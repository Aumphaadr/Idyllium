"use strict";
// src/compiler/lexer.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const tokens_1 = require("./tokens");
class Lexer {
    constructor(source, file, errors) {
        this.pos = 0;
        this.line = 1;
        this.startLine = 1;
        this.tokens = [];
        this.source = source;
        this.file = file;
        this.errors = errors;
    }
    tokenize() {
        while (!this.isAtEnd()) {
            this.skipWhitespaceAndComments();
            if (this.isAtEnd())
                break;
            this.startLine = this.line;
            this.scanToken();
        }
        this.tokens.push({
            type: tokens_1.TokenType.EOF,
            value: '',
            line: this.line,
            file: this.file,
        });
        return this.tokens;
    }
    isAtEnd() {
        return this.pos >= this.source.length;
    }
    peek() {
        return this.isAtEnd() ? '\0' : this.source[this.pos];
    }
    peekNext() {
        return this.pos + 1 >= this.source.length
            ? '\0'
            : this.source[this.pos + 1];
    }
    advance() {
        const ch = this.source[this.pos];
        this.pos++;
        if (ch === '\n')
            this.line++;
        return ch;
    }
    match(expected) {
        if (this.isAtEnd() || this.source[this.pos] !== expected)
            return false;
        this.advance();
        return true;
    }
    emit(type, value) {
        this.tokens.push({
            type,
            value,
            line: this.startLine,
            file: this.file,
        });
    }
    skipWhitespaceAndComments() {
        while (!this.isAtEnd()) {
            const ch = this.peek();
            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
                this.advance();
                continue;
            }
            if (ch === '/' && this.peekNext() === '/') {
                this.advance();
                this.advance();
                while (!this.isAtEnd() && this.peek() !== '\n') {
                    this.advance();
                }
                continue;
            }
            if (ch === '/' && this.peekNext() === '*') {
                this.scanBlockComment();
                continue;
            }
            break;
        }
    }
    scanBlockComment() {
        const openLine = this.line;
        this.advance();
        this.advance();
        while (!this.isAtEnd()) {
            if (this.peek() === '*' && this.peekNext() === '/') {
                this.advance();
                this.advance();
                return;
            }
            this.advance();
        }
        this.errors.addError(this.file, openLine, 'unclosed block comment');
    }
    scanToken() {
        const ch = this.peek();
        if (ch === '"') {
            this.scanString();
            return;
        }
        if (ch === "'") {
            this.scanChar();
            return;
        }
        if (this.isDigit(ch)) {
            this.scanNumber();
            return;
        }
        if (this.isIdentStart(ch)) {
            this.scanIdentifier();
            return;
        }
        this.advance();
        switch (ch) {
            case '+':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.PLUS_ASSIGN, '+=');
                else
                    this.emit(tokens_1.TokenType.PLUS, '+');
                break;
            case '-':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.MINUS_ASSIGN, '-=');
                else
                    this.emit(tokens_1.TokenType.MINUS, '-');
                break;
            case '*':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.STAR_ASSIGN, '*=');
                else
                    this.emit(tokens_1.TokenType.STAR, '*');
                break;
            case '/':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.SLASH_ASSIGN, '/=');
                else
                    this.emit(tokens_1.TokenType.SLASH, '/');
                break;
            case '=':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.EQ, '==');
                else
                    this.emit(tokens_1.TokenType.ASSIGN, '=');
                break;
            case '!':
                if (this.match('=')) {
                    this.emit(tokens_1.TokenType.NEQ, '!=');
                }
                else {
                    this.emit(tokens_1.TokenType.BANG, '!');
                }
                break;
            case '&':
                if (this.match('&')) {
                    this.emit(tokens_1.TokenType.AMPAMP, '&&');
                }
                else {
                    this.errors.addError(this.file, this.startLine, "illegal character '&' (did you mean '&&' or 'and'?)");
                }
                break;
            case '|':
                if (this.match('|')) {
                    this.emit(tokens_1.TokenType.PIPEPIPE, '||');
                }
                else {
                    this.errors.addError(this.file, this.startLine, "illegal character '|' (did you mean '||' or 'or'?)");
                }
                break;
            case '<':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.LTE, '<=');
                else
                    this.emit(tokens_1.TokenType.LT, '<');
                break;
            case '>':
                if (this.match('='))
                    this.emit(tokens_1.TokenType.GTE, '>=');
                else
                    this.emit(tokens_1.TokenType.GT, '>');
                break;
            case '(':
                this.emit(tokens_1.TokenType.LPAREN, '(');
                break;
            case ')':
                this.emit(tokens_1.TokenType.RPAREN, ')');
                break;
            case '{':
                this.emit(tokens_1.TokenType.LBRACE, '{');
                break;
            case '}':
                this.emit(tokens_1.TokenType.RBRACE, '}');
                break;
            case '[':
                this.emit(tokens_1.TokenType.LBRACKET, '[');
                break;
            case ']':
                this.emit(tokens_1.TokenType.RBRACKET, ']');
                break;
            case ',':
                this.emit(tokens_1.TokenType.COMMA, ',');
                break;
            case ';':
                this.emit(tokens_1.TokenType.SEMICOLON, ';');
                break;
            case '.':
                this.emit(tokens_1.TokenType.DOT, '.');
                break;
            case ':':
                this.emit(tokens_1.TokenType.COLON, ':');
                break;
            case '~':
                this.emit(tokens_1.TokenType.TILDE, '~');
                break;
            default:
                this.errors.addError(this.file, this.startLine, `illegal character '${ch}'`);
                break;
        }
    }
    scanString() {
        this.advance();
        let value = '';
        while (!this.isAtEnd() && this.peek() !== '"') {
            if (this.peek() === '\n') {
                this.errors.addError(this.file, this.startLine, 'unclosed string literal');
                return;
            }
            if (this.peek() === '\\') {
                const esc = this.scanEscapeSequence();
                if (esc !== null)
                    value += esc;
                continue;
            }
            value += this.advance();
        }
        if (this.isAtEnd()) {
            this.errors.addError(this.file, this.startLine, 'unclosed string literal');
            return;
        }
        this.advance();
        this.emit(tokens_1.TokenType.STRING_LITERAL, value);
    }
    scanChar() {
        this.advance();
        if (!this.isAtEnd() && this.peek() === "'") {
            this.advance();
            this.errors.addError(this.file, this.startLine, 'empty character literal');
            return;
        }
        if (this.isAtEnd() || this.peek() === '\n') {
            this.errors.addError(this.file, this.startLine, 'unclosed character literal');
            return;
        }
        let value;
        if (this.peek() === '\\') {
            const esc = this.scanEscapeSequence();
            value = esc !== null ? esc : '\0';
        }
        else {
            value = this.advance();
        }
        if (!this.isAtEnd() && this.peek() === "'") {
            this.advance();
            this.emit(tokens_1.TokenType.CHAR_LITERAL, value);
            return;
        }
        let fullContent = value;
        while (!this.isAtEnd() && this.peek() !== "'" && this.peek() !== '\n') {
            if (this.peek() === '\\') {
                const esc = this.scanEscapeSequence();
                fullContent += esc ?? '';
            }
            else {
                fullContent += this.advance();
            }
        }
        if (!this.isAtEnd() && this.peek() === "'") {
            this.advance();
        }
        if (fullContent.length > 1) {
            this.errors.addError(this.file, this.startLine, `character literal must contain exactly one character (got ${fullContent.length}); use double quotes for strings: "${this.escapeForMessage(fullContent)}"`);
        }
    }
    escapeForMessage(s) {
        let result = '';
        for (const ch of s) {
            switch (ch) {
                case '\x1b':
                    result += '\\e';
                    break;
                case '\n':
                    result += '\\n';
                    break;
                case '\t':
                    result += '\\t';
                    break;
                case '\0':
                    result += '\\0';
                    break;
                case '\\':
                    result += '\\\\';
                    break;
                case '"':
                    result += '\\"';
                    break;
                default:
                    result += ch;
                    break;
            }
        }
        return result;
    }
    scanEscapeSequence() {
        this.advance();
        if (this.isAtEnd()) {
            this.errors.addError(this.file, this.line, 'unexpected end of file in escape sequence');
            return null;
        }
        const esc = this.advance();
        switch (esc) {
            case 'n': return '\n';
            case 't': return '\t';
            case '0': return '\0';
            case '\\': return '\\';
            case '"': return '"';
            case "'": return "'";
            case 'e': return '\x1b';
            default:
                this.errors.addError(this.file, this.startLine, `unknown escape sequence '\\${esc}'`);
                return esc;
        }
    }
    scanNumber() {
        let numStr = '';
        let isFloat = false;
        while (!this.isAtEnd() && this.isDigit(this.peek())) {
            numStr += this.advance();
        }
        if (!this.isAtEnd() && this.peek() === '.' && this.isDigit(this.peekNext())) {
            isFloat = true;
            numStr += this.advance();
            while (!this.isAtEnd() && this.isDigit(this.peek())) {
                numStr += this.advance();
            }
        }
        if (!this.isAtEnd() && (this.peek() === 'e' || this.peek() === 'E')) {
            isFloat = true;
            numStr += this.advance();
            if (this.peek() === '+' || this.peek() === '-') {
                numStr += this.advance();
            }
            if (!this.isDigit(this.peek())) {
                this.errors.addError(this.file, this.startLine, `expected digits after exponent, got '${this.peek()}'`);
            }
            while (!this.isAtEnd() && this.isDigit(this.peek())) {
                numStr += this.advance();
            }
        }
        if (numStr.split('.').length > 2) {
            this.errors.addError(this.file, this.startLine, `invalid numeric literal: '${numStr}'`);
        }
        if (isFloat) {
            this.emit(tokens_1.TokenType.FLOAT_LITERAL, numStr);
        }
        else {
            this.emit(tokens_1.TokenType.INT_LITERAL, numStr);
        }
        if (!this.isAtEnd() && this.isIdentStart(this.peek())) {
            let suffix = '';
            while (!this.isAtEnd() && this.isIdentPart(this.peek())) {
                suffix += this.advance();
            }
            this.errors.addError(this.file, this.startLine, `invalid suffix '${suffix}' on numeric literal`);
        }
    }
    scanIdentifier() {
        let name = '';
        while (!this.isAtEnd() && this.isIdentPart(this.peek())) {
            name += this.advance();
        }
        const kwType = tokens_1.KEYWORDS[name];
        if (kwType !== undefined) {
            this.emit(kwType, name);
        }
        else {
            this.emit(tokens_1.TokenType.IDENTIFIER, name);
        }
    }
    isDigit(ch) {
        return ch >= '0' && ch <= '9';
    }
    isIdentStart(ch) {
        if (ch === '_')
            return true;
        if (ch >= 'a' && ch <= 'z')
            return true;
        if (ch >= 'A' && ch <= 'Z')
            return true;
        const code = ch.charCodeAt(0);
        if (code > 127) {
            return /^\p{L}$/u.test(ch);
        }
        return false;
    }
    isIdentPart(ch) {
        return this.isIdentStart(ch) || this.isDigit(ch);
    }
}
exports.Lexer = Lexer;
//# sourceMappingURL=lexer.js.map