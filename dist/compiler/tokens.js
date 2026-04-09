"use strict";
// src/compliler/tokens.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESERVED_BUILTINS = exports.KEYWORDS = exports.TokenType = void 0;
exports.tokenTypeName = tokenTypeName;
exports.tokenDisplayValue = tokenDisplayValue;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["INT_LITERAL"] = 0] = "INT_LITERAL";
    TokenType[TokenType["FLOAT_LITERAL"] = 1] = "FLOAT_LITERAL";
    TokenType[TokenType["STRING_LITERAL"] = 2] = "STRING_LITERAL";
    TokenType[TokenType["CHAR_LITERAL"] = 3] = "CHAR_LITERAL";
    TokenType[TokenType["KW_INT"] = 4] = "KW_INT";
    TokenType[TokenType["KW_FLOAT"] = 5] = "KW_FLOAT";
    TokenType[TokenType["KW_STRING"] = 6] = "KW_STRING";
    TokenType[TokenType["KW_CHAR"] = 7] = "KW_CHAR";
    TokenType[TokenType["KW_BOOL"] = 8] = "KW_BOOL";
    TokenType[TokenType["KW_VOID"] = 9] = "KW_VOID";
    TokenType[TokenType["KW_ARRAY"] = 10] = "KW_ARRAY";
    TokenType[TokenType["KW_DYN_ARRAY"] = 11] = "KW_DYN_ARRAY";
    TokenType[TokenType["KW_IF"] = 12] = "KW_IF";
    TokenType[TokenType["KW_ELSE"] = 13] = "KW_ELSE";
    TokenType[TokenType["KW_WHILE"] = 14] = "KW_WHILE";
    TokenType[TokenType["KW_DO"] = 15] = "KW_DO";
    TokenType[TokenType["KW_FOR"] = 16] = "KW_FOR";
    TokenType[TokenType["KW_BREAK"] = 17] = "KW_BREAK";
    TokenType[TokenType["KW_CONTINUE"] = 18] = "KW_CONTINUE";
    TokenType[TokenType["KW_RETURN"] = 19] = "KW_RETURN";
    TokenType[TokenType["KW_TRY"] = 20] = "KW_TRY";
    TokenType[TokenType["KW_CATCH"] = 21] = "KW_CATCH";
    TokenType[TokenType["KW_FUNCTION"] = 22] = "KW_FUNCTION";
    TokenType[TokenType["KW_MAIN"] = 23] = "KW_MAIN";
    TokenType[TokenType["KW_USE"] = 24] = "KW_USE";
    TokenType[TokenType["KW_AND"] = 25] = "KW_AND";
    TokenType[TokenType["KW_OR"] = 26] = "KW_OR";
    TokenType[TokenType["KW_XOR"] = 27] = "KW_XOR";
    TokenType[TokenType["KW_NOT"] = 28] = "KW_NOT";
    TokenType[TokenType["AMPAMP"] = 29] = "AMPAMP";
    TokenType[TokenType["PIPEPIPE"] = 30] = "PIPEPIPE";
    TokenType[TokenType["BANG"] = 31] = "BANG";
    TokenType[TokenType["KW_TRUE"] = 32] = "KW_TRUE";
    TokenType[TokenType["KW_FALSE"] = 33] = "KW_FALSE";
    TokenType[TokenType["KW_CLASS"] = 34] = "KW_CLASS";
    TokenType[TokenType["KW_EXTENDS"] = 35] = "KW_EXTENDS";
    TokenType[TokenType["KW_THIS"] = 36] = "KW_THIS";
    TokenType[TokenType["KW_CONSTRUCTOR"] = 37] = "KW_CONSTRUCTOR";
    TokenType[TokenType["KW_DESTRUCTOR"] = 38] = "KW_DESTRUCTOR";
    TokenType[TokenType["KW_PUBLIC"] = 39] = "KW_PUBLIC";
    TokenType[TokenType["KW_PRIVATE"] = 40] = "KW_PRIVATE";
    TokenType[TokenType["KW_DIV"] = 41] = "KW_DIV";
    TokenType[TokenType["KW_MOD"] = 42] = "KW_MOD";
    TokenType[TokenType["PLUS"] = 43] = "PLUS";
    TokenType[TokenType["MINUS"] = 44] = "MINUS";
    TokenType[TokenType["STAR"] = 45] = "STAR";
    TokenType[TokenType["SLASH"] = 46] = "SLASH";
    TokenType[TokenType["ASSIGN"] = 47] = "ASSIGN";
    TokenType[TokenType["PLUS_ASSIGN"] = 48] = "PLUS_ASSIGN";
    TokenType[TokenType["MINUS_ASSIGN"] = 49] = "MINUS_ASSIGN";
    TokenType[TokenType["STAR_ASSIGN"] = 50] = "STAR_ASSIGN";
    TokenType[TokenType["SLASH_ASSIGN"] = 51] = "SLASH_ASSIGN";
    TokenType[TokenType["EQ"] = 52] = "EQ";
    TokenType[TokenType["NEQ"] = 53] = "NEQ";
    TokenType[TokenType["LT"] = 54] = "LT";
    TokenType[TokenType["GT"] = 55] = "GT";
    TokenType[TokenType["LTE"] = 56] = "LTE";
    TokenType[TokenType["GTE"] = 57] = "GTE";
    TokenType[TokenType["LPAREN"] = 58] = "LPAREN";
    TokenType[TokenType["RPAREN"] = 59] = "RPAREN";
    TokenType[TokenType["LBRACE"] = 60] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 61] = "RBRACE";
    TokenType[TokenType["LBRACKET"] = 62] = "LBRACKET";
    TokenType[TokenType["RBRACKET"] = 63] = "RBRACKET";
    TokenType[TokenType["COMMA"] = 64] = "COMMA";
    TokenType[TokenType["SEMICOLON"] = 65] = "SEMICOLON";
    TokenType[TokenType["DOT"] = 66] = "DOT";
    TokenType[TokenType["COLON"] = 67] = "COLON";
    TokenType[TokenType["TILDE"] = 68] = "TILDE";
    TokenType[TokenType["IDENTIFIER"] = 69] = "IDENTIFIER";
    TokenType[TokenType["EOF"] = 70] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
exports.KEYWORDS = {
    'int': TokenType.KW_INT,
    'float': TokenType.KW_FLOAT,
    'string': TokenType.KW_STRING,
    'char': TokenType.KW_CHAR,
    'bool': TokenType.KW_BOOL,
    'void': TokenType.KW_VOID,
    'array': TokenType.KW_ARRAY,
    'dyn_array': TokenType.KW_DYN_ARRAY,
    'if': TokenType.KW_IF,
    'else': TokenType.KW_ELSE,
    'while': TokenType.KW_WHILE,
    'do': TokenType.KW_DO,
    'for': TokenType.KW_FOR,
    'break': TokenType.KW_BREAK,
    'continue': TokenType.KW_CONTINUE,
    'return': TokenType.KW_RETURN,
    'try': TokenType.KW_TRY,
    'catch': TokenType.KW_CATCH,
    'function': TokenType.KW_FUNCTION,
    'main': TokenType.KW_MAIN,
    'use': TokenType.KW_USE,
    'and': TokenType.KW_AND,
    'or': TokenType.KW_OR,
    'xor': TokenType.KW_XOR,
    'not': TokenType.KW_NOT,
    'true': TokenType.KW_TRUE,
    'false': TokenType.KW_FALSE,
    'class': TokenType.KW_CLASS,
    'extends': TokenType.KW_EXTENDS,
    'this': TokenType.KW_THIS,
    'constructor': TokenType.KW_CONSTRUCTOR,
    'destructor': TokenType.KW_DESTRUCTOR,
    'public': TokenType.KW_PUBLIC,
    'private': TokenType.KW_PRIVATE,
    'div': TokenType.KW_DIV,
    'mod': TokenType.KW_MOD,
};
exports.RESERVED_BUILTINS = new Set([
    'to_int',
    'to_float',
    'to_string',
    'max',
    'min',
    'sum',
    'avg',
]);
const TOKEN_DISPLAY = {
    [TokenType.INT_LITERAL]: 'integer',
    [TokenType.FLOAT_LITERAL]: 'number',
    [TokenType.STRING_LITERAL]: 'string',
    [TokenType.CHAR_LITERAL]: 'character',
    [TokenType.KW_INT]: "'int'",
    [TokenType.KW_FLOAT]: "'float'",
    [TokenType.KW_STRING]: "'string'",
    [TokenType.KW_CHAR]: "'char'",
    [TokenType.KW_BOOL]: "'bool'",
    [TokenType.KW_VOID]: "'void'",
    [TokenType.KW_ARRAY]: "'array'",
    [TokenType.KW_DYN_ARRAY]: "'dyn_array'",
    [TokenType.KW_IF]: "'if'",
    [TokenType.KW_ELSE]: "'else'",
    [TokenType.KW_WHILE]: "'while'",
    [TokenType.KW_DO]: "'do'",
    [TokenType.KW_FOR]: "'for'",
    [TokenType.KW_BREAK]: "'break'",
    [TokenType.KW_CONTINUE]: "'continue'",
    [TokenType.KW_RETURN]: "'return'",
    [TokenType.KW_TRY]: "'try'",
    [TokenType.KW_CATCH]: "'catch'",
    [TokenType.KW_FUNCTION]: "'function'",
    [TokenType.KW_MAIN]: "'main'",
    [TokenType.KW_USE]: "'use'",
    [TokenType.KW_AND]: "'and'",
    [TokenType.KW_OR]: "'or'",
    [TokenType.KW_XOR]: "'xor'",
    [TokenType.KW_NOT]: "'not'",
    [TokenType.AMPAMP]: "'&&'",
    [TokenType.PIPEPIPE]: "'||'",
    [TokenType.BANG]: "'!'",
    [TokenType.KW_TRUE]: "'true'",
    [TokenType.KW_FALSE]: "'false'",
    [TokenType.KW_CLASS]: "'class'",
    [TokenType.KW_EXTENDS]: "'extends'",
    [TokenType.KW_THIS]: "'this'",
    [TokenType.KW_CONSTRUCTOR]: "'constructor'",
    [TokenType.KW_DESTRUCTOR]: "'destructor'",
    [TokenType.KW_PUBLIC]: "'public'",
    [TokenType.KW_PRIVATE]: "'private'",
    [TokenType.KW_DIV]: "'div'",
    [TokenType.KW_MOD]: "'mod'",
    [TokenType.PLUS]: "'+'",
    [TokenType.MINUS]: "'-'",
    [TokenType.STAR]: "'*'",
    [TokenType.SLASH]: "'/'",
    [TokenType.ASSIGN]: "'='",
    [TokenType.PLUS_ASSIGN]: "'+='",
    [TokenType.MINUS_ASSIGN]: "'-='",
    [TokenType.STAR_ASSIGN]: "'*='",
    [TokenType.SLASH_ASSIGN]: "'/='",
    [TokenType.EQ]: "'=='",
    [TokenType.NEQ]: "'!='",
    [TokenType.LT]: "'<'",
    [TokenType.GT]: "'>'",
    [TokenType.LTE]: "'<='",
    [TokenType.GTE]: "'>='",
    [TokenType.LPAREN]: "'('",
    [TokenType.RPAREN]: "')'",
    [TokenType.LBRACE]: "'{'",
    [TokenType.RBRACE]: "'}'",
    [TokenType.LBRACKET]: "'['",
    [TokenType.RBRACKET]: "']'",
    [TokenType.COMMA]: "','",
    [TokenType.SEMICOLON]: "';'",
    [TokenType.DOT]: "'.'",
    [TokenType.COLON]: "':'",
    [TokenType.TILDE]: "'~'",
    [TokenType.IDENTIFIER]: 'identifier',
    [TokenType.EOF]: 'end of file',
};
function tokenTypeName(type) {
    return TOKEN_DISPLAY[type] ?? 'unknown';
}
function tokenDisplayValue(token) {
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
//# sourceMappingURL=tokens.js.map