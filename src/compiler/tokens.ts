// src/compliler/tokens.ts

export enum TokenType {
    INT_LITERAL,
    FLOAT_LITERAL,
    STRING_LITERAL,
    CHAR_LITERAL,

    KW_INT,
    KW_FLOAT,
    KW_STRING,
    KW_CHAR,
    KW_BOOL,
    KW_VOID,
    KW_ARRAY,
    KW_DYN_ARRAY,

    KW_IF,
    KW_ELSE,
    KW_WHILE,
    KW_DO,
    KW_FOR,
    KW_BREAK,
    KW_CONTINUE,
    KW_RETURN,
    KW_TRY,
    KW_CATCH,

    KW_FUNCTION,
    KW_MAIN,
    KW_USE,

    KW_AND,
    KW_OR,
    KW_XOR,
    KW_NOT,
    AMPAMP,
    PIPEPIPE,
    BANG,

    KW_TRUE,
    KW_FALSE,

    KW_CLASS,
    KW_EXTENDS,
    KW_THIS,
    KW_CONSTRUCTOR,
    KW_DESTRUCTOR,
    KW_PUBLIC,
    KW_PRIVATE,

    KW_DIV,
    KW_MOD,

    PLUS,
    MINUS,
    STAR,
    SLASH,

    ASSIGN,
    PLUS_ASSIGN,
    MINUS_ASSIGN,
    STAR_ASSIGN,
    SLASH_ASSIGN,

    EQ,
    NEQ,
    LT,
    GT,
    LTE,
    GTE,

    LPAREN,
    RPAREN,
    LBRACE,
    RBRACE,
    LBRACKET,
    RBRACKET,
    COMMA,
    SEMICOLON,
    DOT,
    COLON,
    TILDE,

    IDENTIFIER,

    EOF,
}

export interface Token {
    readonly type: TokenType;
    readonly value: string;
    readonly line: number;
    readonly file: string;
}

export const KEYWORDS: Readonly<Record<string, TokenType>> = {
    'int':          TokenType.KW_INT,
    'float':        TokenType.KW_FLOAT,
    'string':       TokenType.KW_STRING,
    'char':         TokenType.KW_CHAR,
    'bool':         TokenType.KW_BOOL,
    'void':         TokenType.KW_VOID,
    'array':        TokenType.KW_ARRAY,
    'dyn_array':    TokenType.KW_DYN_ARRAY,

    'if':           TokenType.KW_IF,
    'else':         TokenType.KW_ELSE,
    'while':        TokenType.KW_WHILE,
    'do':           TokenType.KW_DO,
    'for':          TokenType.KW_FOR,
    'break':        TokenType.KW_BREAK,
    'continue':     TokenType.KW_CONTINUE,
    'return':       TokenType.KW_RETURN,
    'try':          TokenType.KW_TRY,
    'catch':        TokenType.KW_CATCH,

    'function':     TokenType.KW_FUNCTION,
    'main':         TokenType.KW_MAIN,
    'use':          TokenType.KW_USE,

    'and':          TokenType.KW_AND,
    'or':           TokenType.KW_OR,
    'xor':          TokenType.KW_XOR,
    'not':          TokenType.KW_NOT,

    'true':         TokenType.KW_TRUE,
    'false':        TokenType.KW_FALSE,

    'class':        TokenType.KW_CLASS,
    'extends':      TokenType.KW_EXTENDS,
    'this':         TokenType.KW_THIS,
    'constructor':  TokenType.KW_CONSTRUCTOR,
    'destructor':   TokenType.KW_DESTRUCTOR,
    'public':       TokenType.KW_PUBLIC,
    'private':      TokenType.KW_PRIVATE,

    'div':          TokenType.KW_DIV,
    'mod':          TokenType.KW_MOD,
};

export const RESERVED_BUILTINS: ReadonlySet<string> = new Set([
    'to_int',
    'to_float',
    'to_string',
    'max',
    'min',
    'sum',
    'avg',
]);

const TOKEN_DISPLAY: Record<TokenType, string> = {
    [TokenType.INT_LITERAL]:    'integer',
    [TokenType.FLOAT_LITERAL]:  'number',
    [TokenType.STRING_LITERAL]: 'string',
    [TokenType.CHAR_LITERAL]:   'character',

    [TokenType.KW_INT]:         "'int'",
    [TokenType.KW_FLOAT]:       "'float'",
    [TokenType.KW_STRING]:      "'string'",
    [TokenType.KW_CHAR]:        "'char'",
    [TokenType.KW_BOOL]:        "'bool'",
    [TokenType.KW_VOID]:        "'void'",
    [TokenType.KW_ARRAY]:       "'array'",
    [TokenType.KW_DYN_ARRAY]:   "'dyn_array'",

    [TokenType.KW_IF]:          "'if'",
    [TokenType.KW_ELSE]:        "'else'",
    [TokenType.KW_WHILE]:       "'while'",
    [TokenType.KW_DO]:          "'do'",
    [TokenType.KW_FOR]:         "'for'",
    [TokenType.KW_BREAK]:       "'break'",
    [TokenType.KW_CONTINUE]:    "'continue'",
    [TokenType.KW_RETURN]:      "'return'",
    [TokenType.KW_TRY]:         "'try'",
    [TokenType.KW_CATCH]:       "'catch'",

    [TokenType.KW_FUNCTION]:    "'function'",
    [TokenType.KW_MAIN]:        "'main'",
    [TokenType.KW_USE]:         "'use'",

    [TokenType.KW_AND]:         "'and'",
    [TokenType.KW_OR]:          "'or'",
    [TokenType.KW_XOR]:         "'xor'",
    [TokenType.KW_NOT]:         "'not'",
    [TokenType.AMPAMP]:         "'&&'",
    [TokenType.PIPEPIPE]:       "'||'",
    [TokenType.BANG]:           "'!'",
    [TokenType.KW_TRUE]:        "'true'",
    [TokenType.KW_FALSE]:       "'false'",

    [TokenType.KW_CLASS]:       "'class'",
    [TokenType.KW_EXTENDS]:     "'extends'",
    [TokenType.KW_THIS]:        "'this'",
    [TokenType.KW_CONSTRUCTOR]: "'constructor'",
    [TokenType.KW_DESTRUCTOR]:  "'destructor'",
    [TokenType.KW_PUBLIC]:      "'public'",
    [TokenType.KW_PRIVATE]:     "'private'",

    [TokenType.KW_DIV]:         "'div'",
    [TokenType.KW_MOD]:         "'mod'",

    [TokenType.PLUS]:           "'+'",
    [TokenType.MINUS]:          "'-'",
    [TokenType.STAR]:           "'*'",
    [TokenType.SLASH]:          "'/'",

    [TokenType.ASSIGN]:         "'='",
    [TokenType.PLUS_ASSIGN]:    "'+='",
    [TokenType.MINUS_ASSIGN]:   "'-='",
    [TokenType.STAR_ASSIGN]:    "'*='",
    [TokenType.SLASH_ASSIGN]:   "'/='",

    [TokenType.EQ]:             "'=='",
    [TokenType.NEQ]:            "'!='",
    [TokenType.LT]:             "'<'",
    [TokenType.GT]:             "'>'",
    [TokenType.LTE]:            "'<='",
    [TokenType.GTE]:            "'>='",

    [TokenType.LPAREN]:         "'('",
    [TokenType.RPAREN]:         "')'",
    [TokenType.LBRACE]:         "'{'",
    [TokenType.RBRACE]:         "'}'",
    [TokenType.LBRACKET]:       "'['",
    [TokenType.RBRACKET]:       "']'",
    [TokenType.COMMA]:          "','",
    [TokenType.SEMICOLON]:      "';'",
    [TokenType.DOT]:            "'.'",
    [TokenType.COLON]:          "':'",
    [TokenType.TILDE]:          "'~'",

    [TokenType.IDENTIFIER]:     'identifier',
    [TokenType.EOF]:            'end of file',
};

export function tokenTypeName(type: TokenType): string {
    return TOKEN_DISPLAY[type] ?? 'unknown';
}

export function tokenDisplayValue(token: Token): string {
    switch (token.type) {
        case TokenType.IDENTIFIER:
            return `'${token.value}'`;
        case TokenType.INT_LITERAL:
        case TokenType.FLOAT_LITERAL:
            return token.value;
        case TokenType.STRING_LITERAL:
            return `"${token.value}"`;
        case TokenType.CHAR_LITERAL:
            return `'${token.value}'`;
        default:
            return tokenTypeName(token.type);
    }
}