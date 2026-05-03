import { Token } from './tokens';
import { ErrorCollector } from './errors';
export declare class Lexer {
    private readonly source;
    private readonly file;
    private readonly errors;
    private pos;
    private line;
    private startLine;
    private tokens;
    constructor(source: string, file: string, errors: ErrorCollector);
    tokenize(): Token[];
    private isAtEnd;
    private peek;
    private peekNext;
    private advance;
    private match;
    private emit;
    private skipWhitespaceAndComments;
    private scanBlockComment;
    private scanToken;
    private scanString;
    private scanChar;
    private escapeForMessage;
    private scanEscapeSequence;
    private scanNumber;
    private scanIdentifier;
    private isDigit;
    private isIdentStart;
    private isIdentPart;
}
//# sourceMappingURL=lexer.d.ts.map