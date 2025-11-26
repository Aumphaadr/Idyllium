# parser.py
from tokens import TokenType, Token
from iast import *
from typing import List, Optional

BUILTIN_MODULES = {"console", "random", "time", "file"}

class Parser:
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.current = 0

    def parse(self) -> Program:
        imports = []
        while self._check(TokenType.USE):
            self._advance()
            module_token = self._consume(TokenType.IDENTIFIER, "Ожидалось имя модуля после 'use'")
            self._consume(TokenType.SEMICOLON, "Ожидалась ';' после имени модуля")
            imports.append(UseDecl(module_token.lexeme))

        global_functions = []
        while self._check(TokenType.VOID, TokenType.INT, TokenType.FLOAT, TokenType.STRING_TYPE, TokenType.BOOL):
            func = self._function_decl(is_main=False)
            global_functions.append(func)

        if not self._check(TokenType.MAIN):
            raise self._error(self._peek(), "Ожидалась функция 'main'")
        main_func = self._function_decl(is_main=True)

        if not self._is_at_end():
            raise self._error(self._peek(), "Ожидался конец файла после main()")

        return Program(imports, global_functions, main_func)

    def parse_as_library(self) -> List[FunctionDecl]:
        functions = []
        while not self._is_at_end():
            if self._check(TokenType.USE):
                self._advance()
                self._consume(TokenType.IDENTIFIER, "Ожидалось имя модуля после 'use'")
                self._consume(TokenType.SEMICOLON, "Ожидалась ';' после имени модуля")
            elif self._check(TokenType.VOID, TokenType.INT, TokenType.FLOAT, TokenType.STRING_TYPE, TokenType.BOOL):
                func = self._function_decl(is_main=False)
                functions.append(func)
            else:
                token = self._peek()
                raise self._error(token, "В библиотеке разрешены только функции и директивы 'use'")
        return functions

    def _closest_match(self, word: str, candidates: list) -> str:
        def levenshtein(a, b):
            if len(a) < len(b):
                return levenshtein(b, a)
            if len(b) == 0:
                return len(a)
            previous_row = list(range(len(b) + 1))
            for i, c1 in enumerate(a):
                current_row = [i + 1]
                for j, c2 in enumerate(b):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            return previous_row[-1]
        best_match = None
        best_distance = 3
        for cand in candidates:
            dist = levenshtein(word.lower(), cand.lower())
            if dist < best_distance:
                best_distance = dist
                best_match = cand
        return best_match

    def _match(self, *types: TokenType) -> bool:
        for t in types:
            if self._check(t):
                self._advance()
                return True
        return False

    def _check(self, *types: TokenType) -> bool:
        if self._is_at_end():
            return False
        return self._peek().type in types

    def _advance(self) -> Token:
        if not self._is_at_end():
            self.current += 1
        return self._previous()

    def _is_at_end(self) -> bool:
        return self._peek().type == TokenType.EOF

    def _peek(self) -> Token:
        return self.tokens[self.current]

    def _previous(self) -> Token:
        return self.tokens[self.current - 1]

    def _consume(self, type: TokenType, message: str) -> Token:
        if self._check(type):
            return self._advance()
        found_token = self._peek()
        if found_token.type == TokenType.EOF:
            found_repr = "конец файла"
        else:
            if found_token.type in (
                TokenType.INT, TokenType.FLOAT, TokenType.BOOL, TokenType.CHAR,
                TokenType.STRING_TYPE, TokenType.VOID, TokenType.IF, TokenType.ELSE,
                TokenType.WHILE, TokenType.RETURN, TokenType.TRUE, TokenType.FALSE,
                TokenType.USE, TokenType.MAIN, TokenType.FUNCTION
            ):
                found_repr = f"'{found_token.lexeme}'"
            elif found_token.type in (
                TokenType.ASSIGN, TokenType.PLUS, TokenType.MINUS, TokenType.STAR,
                TokenType.SLASH, TokenType.EQ, TokenType.NE, TokenType.LT, TokenType.LE,
                TokenType.GT, TokenType.GE, TokenType.AND, TokenType.OR, TokenType.NOT,
                TokenType.LPAREN, TokenType.RPAREN, TokenType.LBRACE, TokenType.RBRACE,
                TokenType.LBRACKET, TokenType.RBRACKET, TokenType.DOT, TokenType.COMMA,
                TokenType.SEMICOLON, TokenType.COLON
            ):
                found_repr = f"'{found_token.lexeme}'"
            else:
                found_repr = f"'{found_token.lexeme}'"
        raise self._error(found_token, f"{message}, но найдено: {found_repr}")

    def _error(self, token: Token, message: str) -> SyntaxError:
        return SyntaxError(f"[{token.filename}:{token.line}] {message}")

    def _function_decl(self, is_main: bool = False) -> FunctionDecl:
        if is_main:
            self._consume(TokenType.MAIN, "Ожидалось 'main'")
            self._consume(TokenType.LPAREN, "Ожидалась '(' после main")
            self._consume(TokenType.RPAREN, "Ожидалась ')' после (")
        else:
            ret_type = self._consume_type()
            self._consume(TokenType.FUNCTION, "Ожидалось 'function'")
            name = self._consume(TokenType.IDENTIFIER, "Ожидалось имя функции").lexeme
            self._consume(TokenType.LPAREN, "Ожидалась '(' после имени функции")
            params = []
            if not self._check(TokenType.RPAREN):
                param_type = self._consume_type()
                param_name_token = self._consume(TokenType.IDENTIFIER, "Ожидалось имя параметра")
                params.append(Param(param_type, param_name_token.lexeme))
            self._consume(TokenType.RPAREN, "Ожидалась ')' после параметров")
            body = self._block()
            return FunctionDecl(name, ret_type, params, body)
        body = self._block()
        return FunctionDecl("main", "void", [], body)

    def _consume_type(self) -> str:
        if self._match(TokenType.VOID):
            return "void"
        elif self._match(TokenType.INT):
            return "int"
        elif self._match(TokenType.FLOAT):
            return "float"
        elif self._match(TokenType.BOOL):
            return "bool"
        elif self._match(TokenType.CHAR):
            return "char"
        elif self._match(TokenType.STRING_TYPE):
            return "string"
        else:
            bad_token = self._peek()
            if bad_token.type == TokenType.IDENTIFIER:
                bad_name = bad_token.lexeme
                known_types = ["int", "float", "bool", "char", "string", "void"]
                suggestion = self._closest_match(bad_name, known_types)
                if suggestion:
                    raise self._error(bad_token, f"Неизвестный тип '{bad_name}'. Возможно, вы имели в виду '{suggestion}'?")
                else:
                    raise self._error(bad_token, f"Неизвестный тип '{bad_name}'")
            else:
                raise self._error(bad_token, "Ожидалось имя типа")

    def _block(self) -> Block:
        self._consume(TokenType.LBRACE, "Ожидалась '{'")
        statements = []
        while not self._check(TokenType.RBRACE) and not self._is_at_end():
            statements.append(self._declaration())
        self._consume(TokenType.RBRACE, "Ожидалась '}'")
        return Block(statements)

    def _next_token_is_identifier_or_semicolon(self) -> bool:
        if self.current + 1 >= len(self.tokens):
            return False
        next_next = self.tokens[self.current + 1]
        return next_next.type in (TokenType.IDENTIFIER, TokenType.SEMICOLON)

    def _parse_var_decl(self) -> Stmt:
        type_token = self._advance()
        name = self._consume(TokenType.IDENTIFIER, "Ожидалось имя переменной").lexeme
        if self._match(TokenType.ASSIGN):
            initializer = self._expression()
        else:
            type_name = type_token.type.value
            default_values = {
                "int": Literal(0),
                "float": Literal(0.0),
                "bool": Literal(False),
                "char": Literal('\0'),
                "string": Literal(""),
            }
            if type_name not in default_values:
                raise self._error(type_token, f"Тип '{type_token.lexeme}' не поддерживает объявление без инициализации")
            initializer = default_values[type_name]
        self._consume(TokenType.SEMICOLON, "Ожидалась ';' в конце объявления")
        return VarDecl(type_name, name, initializer)

    def _declaration(self) -> Stmt:
        if self._check(TokenType.INT, TokenType.FLOAT, TokenType.BOOL,
                      TokenType.CHAR, TokenType.STRING_TYPE, TokenType.VOID):
            return self._parse_var_decl()
        if self._check(TokenType.IDENTIFIER):
            if self._next_token_is_identifier_or_semicolon():
                bad_token = self._advance()
                suggestion = self._closest_match(bad_token.lexeme, ["int", "float", "bool", "char", "string", "void"])
                if suggestion:
                    raise self._error(bad_token, f"Неизвестный тип '{bad_token.lexeme}'. Возможно, вы имели в виду '{suggestion}'?")
                else:
                    raise self._error(bad_token, f"Неизвестный тип '{bad_token.lexeme}'")
        return self._statement()

    def _statement(self) -> Stmt:
        if self._match(TokenType.IF):
            self._consume(TokenType.LPAREN, "Ожидалась '(' после if")
            condition = self._expression()
            self._consume(TokenType.RPAREN, "Ожидалась ')' после условия")
            then_branch = self._statement()
            else_branch = None
            if self._match(TokenType.ELSE):
                else_branch = self._statement()
            return IfStmt(condition, then_branch, else_branch)
        if self._match(TokenType.WHILE):
            self._consume(TokenType.LPAREN, "Ожидалась '(' после while")
            condition = self._expression()
            self._consume(TokenType.RPAREN, "Ожидалась ')' после условия")
            body = self._statement()
            return WhileStmt(condition, body)
        if self._match(TokenType.RETURN):
            value = None
            if not self._check(TokenType.SEMICOLON):
                value = self._expression()
            self._consume(TokenType.SEMICOLON, "Ожидалась ';' после return")
            return ReturnStmt(value)
        if self._check(TokenType.LBRACE):
            return self._block()
        expr = self._expression()
        self._consume(TokenType.SEMICOLON, "Ожидалась ';' после выражения")
        return ExprStmt(expr)

    def _expression(self) -> Expr:
        return self._assignment()

    def _assignment(self) -> Expr:
        expr = self._logical_or()
        if self._match(TokenType.ASSIGN):
            if not isinstance(expr, Variable):
                raise self._error(self._previous(), "Присваивание возможно только переменной")
            value = self._assignment()
            return Assign(expr.name, value)
        return expr

    def _logical_or(self) -> Expr:
        expr = self._logical_and()
        while self._match(TokenType.OR):
            operator = "or"
            right = self._logical_and()
            expr = Binary(expr, operator, right)
        return expr

    def _logical_and(self) -> Expr:
        expr = self._equality()
        while self._match(TokenType.AND):
            operator = "and"
            right = self._equality()
            expr = Binary(expr, operator, right)
        return expr

    def _equality(self) -> Expr:
        expr = self._comparison()
        while self._match(TokenType.EQ, TokenType.NE):
            operator = "==" if self._previous().type == TokenType.EQ else "!="
            right = self._comparison()
            expr = Binary(expr, operator, right)
        return expr

    def _comparison(self) -> Expr:
        expr = self._term()
        while self._match(TokenType.LT, TokenType.LE, TokenType.GT, TokenType.GE):
            op_token = self._previous()
            op_map = {TokenType.LT: "<", TokenType.LE: "<=", TokenType.GT: ">", TokenType.GE: ">="}
            operator = op_map[op_token.type]
            right = self._term()
            expr = Binary(expr, operator, right)
        return expr

    def _term(self) -> Expr:
        expr = self._factor()
        while self._match(TokenType.PLUS, TokenType.MINUS):
            operator = "+" if self._previous().type == TokenType.PLUS else "-"
            right = self._factor()
            expr = Binary(expr, operator, right)
        return expr

    def _factor(self) -> Expr:
        expr = self._unary()
        while self._match(TokenType.STAR, TokenType.SLASH):
            operator = "*" if self._previous().type == TokenType.STAR else "/"
            right = self._unary()
            expr = Binary(expr, operator, right)
        return expr

    def _unary(self) -> Expr:
        if self._match(TokenType.NOT, TokenType.MINUS):
            operator = "not" if self._previous().type == TokenType.NOT else "-"
            right = self._unary()
            if operator == "-":
                return Binary(Literal(0), "-", right)
            else:
                return Unary(operator, right)
        return self._call()

    def _call(self) -> Expr:
        expr = self._primary()
        while True:
            if self._match(TokenType.LPAREN):
                arguments = []
                if not self._check(TokenType.RPAREN):
                    arguments.append(self._expression())
                    while self._match(TokenType.COMMA):
                        arguments.append(self._expression())
                self._consume(TokenType.RPAREN, "Ожидалась ')' после аргументов")
                expr = Call(expr, arguments)
            elif self._match(TokenType.DOT):
                name = self._consume(TokenType.IDENTIFIER, "Ожидалось имя свойства после '.'")
                expr = Get(expr, name.lexeme)
            else:
                break
        return expr

    def _primary(self) -> Expr:
        if self._match(TokenType.INTEGER):
            return Literal(int(self._previous().lexeme))
        if self._match(TokenType.FLOAT_LITERAL):
            return Literal(float(self._previous().lexeme))
        if self._match(TokenType.STRING_LITERAL):
            return Literal(self._previous().lexeme)
        if self._match(TokenType.CHAR_LITERAL):
            return Literal(self._previous().lexeme)
        if self._match(TokenType.TRUE):
            return Literal(True)
        if self._match(TokenType.FALSE):
            return Literal(False)
        if self._match(TokenType.IDENTIFIER):
            return Variable(self._previous().lexeme)
        if self._match(TokenType.LPAREN):
            expr = self._expression()
            self._consume(TokenType.RPAREN, "Ожидалась ')' после выражения")
            return expr
        raise self._error(self._peek(), "Ожидалось выражение")