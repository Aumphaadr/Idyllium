import { DiagnosticBag, SourceLocation, SourceRange } from './diagnostics';
import { KEYWORDS, Token, TokenKind } from './tokens';

export interface LexResult {
  readonly tokens: Token[];
  readonly diagnostics: DiagnosticBag;
}

export class Lexer {
  private readonly tokens: Token[] = [];
  private readonly diagnostics = new DiagnosticBag();
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(
    private readonly source: string,
    private readonly file = 'main.idyl',
  ) {}

  tokenize(): LexResult {
    while (!this.isAtEnd()) {
      this.scanToken();
    }

    const location = this.location();
    this.tokens.push({
      kind: TokenKind.EndOfFile,
      lexeme: '',
      literal: null,
      range: { start: location, end: location },
    });

    return {
      tokens: this.tokens,
      diagnostics: this.diagnostics,
    };
  }

  private scanToken(): void {
    const start = this.location();
    const char = this.advance();

    switch (char) {
      case '(':
        this.addSimple(TokenKind.LeftParen, start);
        return;
      case ')':
        this.addSimple(TokenKind.RightParen, start);
        return;
      case '{':
        this.addSimple(TokenKind.LeftBrace, start);
        return;
      case '}':
        this.addSimple(TokenKind.RightBrace, start);
        return;
      case '[':
        this.addSimple(TokenKind.LeftBracket, start);
        return;
      case ']':
        this.addSimple(TokenKind.RightBracket, start);
        return;
      case ',':
        this.addSimple(TokenKind.Comma, start);
        return;
      case ';':
        this.addSimple(TokenKind.Semicolon, start);
        return;
      case '.':
        this.addSimple(TokenKind.Dot, start);
        return;
      case ':':
        this.addSimple(TokenKind.Colon, start);
        return;
      case '~':
        this.addSimple(TokenKind.Tilde, start);
        return;
      case '+':
        this.addSimple(this.match('=') ? TokenKind.PlusEqual : TokenKind.Plus, start);
        return;
      case '-':
        this.addSimple(this.match('=') ? TokenKind.MinusEqual : TokenKind.Minus, start);
        return;
      case '*':
        this.addSimple(this.match('=') ? TokenKind.StarEqual : TokenKind.Star, start);
        return;
      case '/':
        if (this.match('/')) {
          this.skipLineComment();
          return;
        }
        if (this.match('*')) {
          this.skipBlockComment(start);
          return;
        }
        this.addSimple(this.match('=') ? TokenKind.SlashEqual : TokenKind.Slash, start);
        return;
      case '=':
        this.addSimple(this.match('=') ? TokenKind.EqualEqual : TokenKind.Equal, start);
        return;
      case '!':
        if (this.match('=')) {
          this.addSimple(TokenKind.BangEqual, start);
          return;
        }
        this.bad(start, "unexpected character '!'");
        return;
      case '<':
        this.addSimple(this.match('=') ? TokenKind.LessEqual : TokenKind.Less, start);
        return;
      case '>':
        this.addSimple(this.match('=') ? TokenKind.GreaterEqual : TokenKind.Greater, start);
        return;
      case '"':
        this.scanString(start);
        return;
      case "'":
        this.scanChar(start);
        return;
      case ' ':
      case '\r':
      case '\t':
        return;
      case '\n':
        return;
      default:
        if (this.isDigit(char)) {
          this.scanNumber(start, char);
          return;
        }
        if (this.isIdentifierStart(char)) {
          this.scanIdentifier(start, char);
          return;
        }
        this.bad(start, `unexpected character '${char}'`);
    }
  }

  private scanNumber(start: SourceLocation, first: string): void {
    let text = first;
    while (this.isDigit(this.peek())) {
      text += this.advance();
    }

    let isFloat = false;
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      isFloat = true;
      text += this.advance();
      while (this.isDigit(this.peek())) {
        text += this.advance();
      }
    }

    this.tokens.push({
      kind: isFloat ? TokenKind.FloatLiteral : TokenKind.IntLiteral,
      lexeme: text,
      literal: isFloat ? Number.parseFloat(text) : Number.parseInt(text, 10),
      range: this.rangeFrom(start),
    });
  }

  private scanIdentifier(start: SourceLocation, first: string): void {
    let text = first;
    while (this.isIdentifierPart(this.peek())) {
      text += this.advance();
    }

    const kind = KEYWORDS[text] ?? TokenKind.Identifier;
    let literal: string | boolean | null = null;
    if (kind === TokenKind.KwTrue) literal = true;
    if (kind === TokenKind.KwFalse) literal = false;

    this.tokens.push({
      kind,
      lexeme: text,
      literal,
      range: this.rangeFrom(start),
    });
  }

  private scanString(start: SourceLocation): void {
    let value = '';

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        this.bad(start, 'string literal cannot contain a raw newline');
        return;
      }
      value += this.scanEscapedCharacter(start);
    }

    if (this.isAtEnd()) {
      this.bad(start, 'unterminated string literal');
      return;
    }

    this.advance();
    this.tokens.push({
      kind: TokenKind.StringLiteral,
      lexeme: this.sourceSlice(start),
      literal: value,
      range: this.rangeFrom(start),
    });
  }

  private scanChar(start: SourceLocation): void {
    let value = '';

    while (!this.isAtEnd() && this.peek() !== "'") {
      if (this.peek() === '\n') {
        this.bad(start, 'char literal cannot contain a raw newline');
        return;
      }
      value += this.scanEscapedCharacter(start);
    }

    if (this.isAtEnd()) {
      this.bad(start, 'unterminated char literal');
      return;
    }

    this.advance();

    if (Array.from(value).length !== 1) {
      this.diagnostics.error(this.rangeFrom(start), 'char literal must contain exactly one character');
    }

    this.tokens.push({
      kind: TokenKind.CharLiteral,
      lexeme: this.sourceSlice(start),
      literal: value,
      range: this.rangeFrom(start),
    });
  }

  private scanEscapedCharacter(start: SourceLocation): string {
    const char = this.advance();
    if (char !== '\\') {
      return char;
    }

    if (this.isAtEnd()) {
      this.bad(start, 'unfinished escape sequence');
      return '';
    }

    const escaped = this.advance();
    switch (escaped) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case 'e':
        return '\x1b';
      case '\\':
        return '\\';
      case '"':
        return '"';
      case "'":
        return "'";
      case '0':
        return '\0';
      default:
        this.diagnostics.error(this.rangeFrom(start), `unknown escape sequence '\\${escaped}'`);
        return escaped;
    }
  }

  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private skipBlockComment(start: SourceLocation): void {
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }
    this.diagnostics.error(this.rangeFrom(start), 'unterminated block comment');
  }

  private addSimple(kind: TokenKind, start: SourceLocation): void {
    this.tokens.push({
      kind,
      lexeme: this.sourceSlice(start),
      literal: null,
      range: this.rangeFrom(start),
    });
  }

  private bad(start: SourceLocation, message: string): void {
    const range = this.rangeFrom(start);
    this.diagnostics.error(range, message);
    this.tokens.push({
      kind: TokenKind.Bad,
      lexeme: this.sourceSlice(start),
      literal: null,
      range,
    });
  }

  private advance(): string {
    const char = this.source[this.index] ?? '\0';
    this.index++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private match(expected: string): boolean {
    if (this.peek() !== expected) return false;
    this.advance();
    return true;
  }

  private peek(): string {
    return this.source[this.index] ?? '\0';
  }

  private peekNext(): string {
    return this.source[this.index + 1] ?? '\0';
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  private location(): SourceLocation {
    return {
      file: this.file,
      line: this.line,
      column: this.column,
    };
  }

  private rangeFrom(start: SourceLocation): SourceRange {
    return {
      start,
      end: this.location(),
    };
  }

  private sourceSlice(start: SourceLocation): string {
    const absoluteStart = this.absoluteIndexFor(start);
    return this.source.slice(absoluteStart, this.index);
  }

  private absoluteIndexFor(location: SourceLocation): number {
    let line = 1;
    let column = 1;
    for (let i = 0; i < this.source.length; i++) {
      if (line === location.line && column === location.column) return i;
      if (this.source[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    return this.source.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isIdentifierStart(char: string): boolean {
    return char === '_' || /^\p{L}$/u.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return this.isIdentifierStart(char) || /^\p{N}$/u.test(char);
  }
}
