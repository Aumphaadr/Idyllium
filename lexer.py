# lexer.py
import re
from tokens import TokenType, Token

KEYWORDS = {
    "use": TokenType.USE,
    "main": TokenType.MAIN,
    "int": TokenType.INT,
    "float": TokenType.FLOAT,
    "bool": TokenType.BOOL,
    "char": TokenType.CHAR,
    "string": TokenType.STRING_TYPE,
    "void": TokenType.VOID,
    "if": TokenType.IF,
    "else": TokenType.ELSE,
    "while": TokenType.WHILE,
    "for": TokenType.FOR,
    "return": TokenType.RETURN,
    "function": TokenType.FUNCTION,
    "and": TokenType.AND,
    "or": TokenType.OR,
    "not": TokenType.NOT,
    "true": TokenType.TRUE,
    "false": TokenType.FALSE,
}

class Lexer:
    def __init__(self, source: str):
        self.source = source
        self.tokens = []
        self.start = 0
        self.current = 0
        self.line = 1
        self.col = 1

    def tokenize(self) -> list[Token]:
        while not self._is_at_end():
            self.start = self.current
            self._scan_token()
        self.tokens.append(Token(TokenType.EOF, "", self.line, self.col))
        return self.tokens

    def _is_at_end(self) -> bool:
        return self.current >= len(self.source)

    def _advance(self) -> str:
        char = self.source[self.current]
        self.current += 1
        self.col += 1
        if char == '\n':
            self.line += 1
            self.col = 1
        return char

    def _peek(self) -> str:
        if self._is_at_end():
            return '\0'
        return self.source[self.current]

    def _peek_next(self) -> str:
        if self.current + 1 >= len(self.source):
            return '\0'
        return self.source[self.current + 1]

    def _add_token(self, type: TokenType):
        text = self.source[self.start:self.current]
        self.tokens.append(Token(type, text, self.line, self.col - (self.current - self.start)))

    def _scan_token(self):
        c = self._advance()

        # Пробелы и переносы строк
        if c in (' ', '\r', '\t'):
            return
        if c == '\n':
            return

        # Односимвольные токены
        if c == '(':
            self._add_token(TokenType.LPAREN)
        elif c == ')':
            self._add_token(TokenType.RPAREN)
        elif c == '{':
            self._add_token(TokenType.LBRACE)
        elif c == '}':
            self._add_token(TokenType.RBRACE)
        elif c == '[':
            self._add_token(TokenType.LBRACKET)
        elif c == ']':
            self._add_token(TokenType.RBRACKET)
        elif c == ',':
            self._add_token(TokenType.COMMA)
        elif c == ';':
            self._add_token(TokenType.SEMICOLON)
        elif c == '.':
            self._add_token(TokenType.DOT)
        elif c == '-':
            self._add_token(TokenType.MINUS)
        elif c == '+':
            self._add_token(TokenType.PLUS)
        elif c == '*':
            self._add_token(TokenType.STAR)

        # Операторы, требующие проверки следующего символа
        elif c == '/':
            if self._peek() == '/':
                # комментарий до конца строки
                while self._peek() != '\n' and not self._is_at_end():
                    self._advance()
            else:
                self._add_token(TokenType.SLASH)
        elif c == '=':
            if self._peek() == '=':
                self._advance()
                self._add_token(TokenType.EQ)
            else:
                self._add_token(TokenType.ASSIGN)
        elif c == '!':
            if self._peek() == '=':
                self._advance()
                self._add_token(TokenType.NE)
            else:
                raise self._error("Недопустимый символ '!'")
        elif c == '<':
            if self._peek() == '=':
                self._advance()
                self._add_token(TokenType.LE)
            else:
                self._add_token(TokenType.LT)
        elif c == '>':
            if self._peek() == '=':
                self._advance()
                self._add_token(TokenType.GE)
            else:
                self._add_token(TokenType.GT)

        # Строки и символы
        elif c == '"':
            self._string()
        elif c == "'":
            self._char()

        # Числа
        elif c.isdigit():
            self._number()

        # Идентификаторы и ключевые слова
        elif c.isalpha() or c == '_':
            self._identifier()

        else:
            raise self._error(f"Недопустимый символ: {c}")

    def _string(self):
        while self._peek() != '"' and not self._is_at_end():
            if self._peek() == '\n':
                self.line += 1
            self._advance()
        if self._is_at_end():
            raise self._error("Незакрытая строка")
        self._advance()  # закрывающая кавычка
        value = self.source[self.start+1:self.current-1]
        self.tokens.append(Token(TokenType.STRING_LITERAL, value, self.line, self.col - (self.current - self.start)))

    def _char(self):
        if self._is_at_end():
            raise self._error("Незакрытый символ")
        
        start_col = self.col  # для корректного расчёта колонки ошибки

        # Проверяем, начинается ли символ с обратного слеша
        if self._peek() == '\\':
            self._advance()  # забираем '\'
            escape_char = self._advance()  # забираем следующий символ

            # Обработка стандартных escape-последовательностей
            if escape_char == 'n':
                char_value = '\n'
            elif escape_char == 't':
                char_value = '\t'
            elif escape_char == 'r':
                char_value = '\r'
            elif escape_char == '\\':
                char_value = '\\'
            elif escape_char == '\'':
                char_value = '\''
            elif escape_char == '"':
                char_value = '"'
            else:
                raise self._error(f"Неизвестная escape-последовательность: \\{escape_char}")

            # Проверяем, что после этого идёт закрывающая кавычка
            if self._peek() != "'":
                raise self._error("Символ должен заканчиваться одинарной кавычкой")
            self._advance()  # забираем закрывающую кавычку

            # Сохраняем раскодированный символ
            self.tokens.append(Token(TokenType.CHAR_LITERAL, char_value, self.line, start_col))

        else:
            # Обычный символ (ровно один)
            char_value = self._advance()
            if char_value == '\n':
                raise self._error("Символ не может содержать перенос строки")
            if self._peek() != "'":
                raise self._error("Символ должен содержать ровно один символ и заканчиваться кавычкой")
            self._advance()  # закрывающая кавычка
            self.tokens.append(Token(TokenType.CHAR_LITERAL, char_value, self.line, start_col))

    def _number(self):
        while self._peek().isdigit():
            self._advance()
        # Проверка на float
        if self._peek() == '.' and self._peek_next().isdigit():
            self._advance()  # точка
            while self._peek().isdigit():
                self._advance()
            self.tokens.append(Token(TokenType.FLOAT_LITERAL, self.source[self.start:self.current], self.line, self.col - (self.current - self.start)))
        else:
            self.tokens.append(Token(TokenType.INTEGER, self.source[self.start:self.current], self.line, self.col - (self.current - self.start)))

    def _identifier(self):
        while self._peek().isalnum() or self._peek() == '_':
            self._advance()
        text = self.source[self.start:self.current]
        token_type = KEYWORDS.get(text, TokenType.IDENTIFIER)
        self._add_token(token_type)

    def _error(self, message: str) -> Exception:
        return SyntaxError(f"[Строка {self.line}, колонка {self.col}] {message}")