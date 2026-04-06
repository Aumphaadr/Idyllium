// src/compiler/lexer.ts

import { Token, TokenType, KEYWORDS } from './tokens';
import { ErrorCollector }             from './errors';

export class Lexer {

    private readonly source: string;
    private readonly file:   string;
    private readonly errors: ErrorCollector;

    private pos: number = 0;

    private line: number = 1;

    private startLine: number = 1;

    private tokens: Token[] = [];

    constructor(source: string, file: string, errors: ErrorCollector) {
        this.source = source;
        this.file   = file;
        this.errors = errors;
    }

    tokenize(): Token[] {
        while (!this.isAtEnd()) {
            this.skipWhitespaceAndComments();

            if (this.isAtEnd()) break;

            this.startLine = this.line;

            this.scanToken();
        }

        this.tokens.push({
            type:  TokenType.EOF,
            value: '',
            line:  this.line,
            file:  this.file,
        });

        return this.tokens;
    }

    private isAtEnd(): boolean {
        return this.pos >= this.source.length;
    }

    private peek(): string {
        return this.isAtEnd() ? '\0' : this.source[this.pos];
    }

    private peekNext(): string {
        return this.pos + 1 >= this.source.length
            ? '\0'
            : this.source[this.pos + 1];
    }

    private advance(): string {
        const ch = this.source[this.pos];
        this.pos++;
        if (ch === '\n') this.line++;
        return ch;
    }

    private match(expected: string): boolean {
        if (this.isAtEnd() || this.source[this.pos] !== expected) return false;
        this.advance();
        return true;
    }

    private emit(type: TokenType, value: string): void {
        this.tokens.push({
            type,
            value,
            line: this.startLine,
            file: this.file,
        });
    }

    private skipWhitespaceAndComments(): void {
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

    private scanBlockComment(): void {
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

    private scanToken(): void {
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
                if (this.match('=')) this.emit(TokenType.PLUS_ASSIGN,  '+=');
                else                 this.emit(TokenType.PLUS,         '+');
                break;

            case '-':
                if (this.match('=')) this.emit(TokenType.MINUS_ASSIGN, '-=');
                else                 this.emit(TokenType.MINUS,        '-');
                break;

            case '*':
                if (this.match('=')) this.emit(TokenType.STAR_ASSIGN,  '*=');
                else                 this.emit(TokenType.STAR,         '*');
                break;

            case '/':
                if (this.match('=')) this.emit(TokenType.SLASH_ASSIGN, '/=');
                else                 this.emit(TokenType.SLASH,        '/');
                break;

            case '=':
                if (this.match('=')) this.emit(TokenType.EQ,     '==');
                else                 this.emit(TokenType.ASSIGN, '=');
                break;

            case '!':
                if (this.match('=')) {
                    this.emit(TokenType.NEQ, '!=');
                } else {
                    this.emit(TokenType.BANG, '!');
                }
                break;
            
            case '&':
                if (this.match('&')) {
                    this.emit(TokenType.AMPAMP, '&&');
                } else {
                    this.errors.addError(
                        this.file,
                        this.startLine,
                        "illegal character '&' (did you mean '&&' or 'and'?)",
                    );
                }
                break;
            
            case '|':
                if (this.match('|')) {
                    this.emit(TokenType.PIPEPIPE, '||');
                } else {
                    this.errors.addError(
                        this.file,
                        this.startLine,
                        "illegal character '|' (did you mean '||' or 'or'?)",
                    );
                }
                break;

            case '<':
                if (this.match('=')) this.emit(TokenType.LTE, '<=');
                else                 this.emit(TokenType.LT,  '<');
                break;

            case '>':
                if (this.match('=')) this.emit(TokenType.GTE, '>=');
                else                 this.emit(TokenType.GT,  '>');
                break;

            case '(': this.emit(TokenType.LPAREN,    '('); break;
            case ')': this.emit(TokenType.RPAREN,    ')'); break;
            case '{': this.emit(TokenType.LBRACE,    '{'); break;
            case '}': this.emit(TokenType.RBRACE,    '}'); break;
            case '[': this.emit(TokenType.LBRACKET,  '['); break;
            case ']': this.emit(TokenType.RBRACKET,  ']'); break;
            case ',': this.emit(TokenType.COMMA,     ','); break;
            case ';': this.emit(TokenType.SEMICOLON, ';'); break;
            case '.': this.emit(TokenType.DOT,       '.'); break;
            case ':': this.emit(TokenType.COLON,     ':'); break;
            case '~': this.emit(TokenType.TILDE,     '~'); break;

            default:
                this.errors.addError(
                    this.file,
                    this.startLine,
                    `illegal character '${ch}'`,
                );
                break;
        }
    }

    private scanString(): void {
        this.advance();

        let value = '';

        while (!this.isAtEnd() && this.peek() !== '"') {

            if (this.peek() === '\n') {
                this.errors.addError(
                    this.file, this.startLine, 'unclosed string literal',
                );
                return;
            }

            if (this.peek() === '\\') {
                const esc = this.scanEscapeSequence();
                if (esc !== null) value += esc;
                continue;
            }

            value += this.advance();
        }

        if (this.isAtEnd()) {
            this.errors.addError(
                this.file, this.startLine, 'unclosed string literal',
            );
            return;
        }

        this.advance();
        this.emit(TokenType.STRING_LITERAL, value);
    }

    private scanChar(): void {
        this.advance();
    
        if (!this.isAtEnd() && this.peek() === "'") {
            this.advance();
            this.errors.addError(
                this.file, this.startLine, 'empty character literal',
            );
            return;
        }
    
        if (this.isAtEnd() || this.peek() === '\n') {
            this.errors.addError(
                this.file, this.startLine, 'unclosed character literal',
            );
            return;
        }
    
        let value: string;
    
        if (this.peek() === '\\') {
            const esc = this.scanEscapeSequence();
            value = esc !== null ? esc : '\0';
        } else {
            value = this.advance();
        }
    
        if (!this.isAtEnd() && this.peek() === "'") {
            this.advance();
            this.emit(TokenType.CHAR_LITERAL, value);
            return;
        }
    
        let fullContent = value;
        while (!this.isAtEnd() && this.peek() !== "'" && this.peek() !== '\n') {
            if (this.peek() === '\\') {
                const esc = this.scanEscapeSequence();
                fullContent += esc ?? '';
            } else {
                fullContent += this.advance();
            }
        }
    
        if (!this.isAtEnd() && this.peek() === "'") {
            this.advance();
        }
    
        if (fullContent.length > 1) {
            this.errors.addError(
                this.file,
                this.startLine,
                `character literal must contain exactly one character (got ${fullContent.length}); use double quotes for strings: "${this.escapeForMessage(fullContent)}"`,
            );
        }
    }
    
    private escapeForMessage(s: string): string {
        let result = '';
        for (const ch of s) {
            switch (ch) {
                case '\x1b': result += '\\e'; break;
                case '\n':   result += '\\n'; break;
                case '\t':   result += '\\t'; break;
                case '\0':   result += '\\0'; break;
                case '\\':   result += '\\\\'; break;
                case '"':    result += '\\"'; break;
                default:     result += ch; break;
            }
        }
        return result;
    }

    private scanEscapeSequence(): string | null {
        this.advance();

        if (this.isAtEnd()) {
            this.errors.addError(
                this.file,
                this.line,
                'unexpected end of file in escape sequence',
            );
            return null;
        }

        const esc = this.advance();

        switch (esc) {
            case 'n':  return '\n';
            case 't':  return '\t';
            case '0':  return '\0';
            case '\\': return '\\';
            case '"':  return '"';
            case "'":  return "'";
            case 'e':  return '\x1b';
            default:
                this.errors.addError(
                    this.file,
                    this.startLine,
                    `unknown escape sequence '\\${esc}'`,
                );
                return esc;
        }
    }

    private scanNumber(): void {
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
                this.errors.addError(this.file, this.startLine,
                    `expected digits after exponent, got '${this.peek()}'`);
            }
            while (!this.isAtEnd() && this.isDigit(this.peek())) {
                numStr += this.advance();
            }
        }
    
        if (numStr.split('.').length > 2) {
            this.errors.addError(this.file, this.startLine,
                `invalid numeric literal: '${numStr}'`);
        }
    
        if (isFloat) {
            this.emit(TokenType.FLOAT_LITERAL, numStr);
        } else {
            this.emit(TokenType.INT_LITERAL, numStr);
        }
    
        if (!this.isAtEnd() && this.isIdentStart(this.peek())) {
            let suffix = '';
            while (!this.isAtEnd() && this.isIdentPart(this.peek())) {
                suffix += this.advance();
            }
            this.errors.addError(this.file, this.startLine,
                `invalid suffix '${suffix}' on numeric literal`);
        }
    }

    private scanIdentifier(): void {
        let name = '';

        while (!this.isAtEnd() && this.isIdentPart(this.peek())) {
            name += this.advance();
        }

        const kwType = KEYWORDS[name];
        if (kwType !== undefined) {
            this.emit(kwType, name);
        } else {
            this.emit(TokenType.IDENTIFIER, name);
        }
    }

    private isDigit(ch: string): boolean {
        return ch >= '0' && ch <= '9';
    }

    private isIdentStart(ch: string): boolean {
        if (ch === '_') return true;
        if (ch >= 'a' && ch <= 'z') return true;
        if (ch >= 'A' && ch <= 'Z') return true;

        const code = ch.charCodeAt(0);
        if (code > 127) {
            return /^\p{L}$/u.test(ch);
        }

        return false;
    }

    private isIdentPart(ch: string): boolean {
        return this.isIdentStart(ch) || this.isDigit(ch);
    }
}