# tokens.py
from enum import Enum

class TokenType(Enum):
    # Ключевые слова
    USE = "use"
    MAIN = "main"
    INT = "int"
    FLOAT = "float"
    BOOL = "bool"
    CHAR = "char"
    STRING_TYPE = "string"  # чтобы не путать с STRING_LITERAL
    VOID = "void"
    IF = "if"
    ELSE = "else"
    WHILE = "while"
    FOR = "for"
    RETURN = "return"
    FUNCTION = "function"  # для "void function draw()"
    TRUE = "true"
    FALSE = "false"

    # Символы
    LPAREN = "("
    RPAREN = ")"
    LBRACE = "{"
    RBRACE = "}"
    LBRACKET = "["
    RBRACKET = "]"
    DOT = "."
    COMMA = ","
    SEMICOLON = ";"
    COLON = ":"  # на будущее (например, для типов)

    # Операторы
    ASSIGN = "="
    PLUS = "+"
    MINUS = "-"
    STAR = "*"
    SLASH = "/"
    LT = "<"
    GT = ">"
    LE = "<="
    GE = ">="
    EQ = "=="
    NE = "!="
    AND = "and"
    OR = "or"
    NOT = "not"

    # Литералы
    IDENTIFIER = "IDENTIFIER"
    INTEGER = "INTEGER"
    FLOAT_LITERAL = "FLOAT_LITERAL"
    STRING_LITERAL = "STRING_LITERAL"
    CHAR_LITERAL = "CHAR_LITERAL"

    # Прочее
    EOF = "EOF"

class Token:
    def __init__(self, type: TokenType, lexeme: str, line: int, col: int):
        self.type = type
        self.lexeme = lexeme
        self.line = line
        self.col = col

    def __repr__(self):
        if self.type in (TokenType.IDENTIFIER, TokenType.INTEGER,
                         TokenType.FLOAT_LITERAL, TokenType.STRING_LITERAL,
                         TokenType.CHAR_LITERAL):
            return f"{self.type.name}({self.lexeme!r})"
        return self.type.name