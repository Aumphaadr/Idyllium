# analyzer.py
from iast import *
from typing import Dict, Optional

class SemanticError(Exception):
    def __init__(self, message: str, line: int = None):
        self.message = message
        self.line = line
        super().__init__(message)

class SemanticAnalyzer:
    def __init__(self):
        # Таблица символов: имя переменной → информация о ней
        self.variables: Dict[str, 'VarInfo'] = {}
        self.errors: list[SemanticError] = []

    def analyze(self, program: Program):
        # Анализ импортов (пока просто запоминаем)
        self.modules = {imp.module_name for imp in program.imports}
        
        # Анализ main()
        self.visit_function(program.main_func)
        
        if self.errors:
            # Бросаем первую ошибку (можно собрать все)
            raise self.errors[0]

    def visit_function(self, func: FunctionDecl):
        # Начинаем новый scope (для main — глобальный)
        self.variables = {}
        for stmt in func.body.statements:
            self.visit_stmt(stmt)

    def visit_stmt(self, stmt: Stmt):
        if isinstance(stmt, VarDecl):
            self.visit_var_decl(stmt)
        elif isinstance(stmt, ExprStmt):
            self.visit_expr(stmt.expr)
        elif isinstance(stmt, Block):
            for s in stmt.statements:
                self.visit_stmt(s)
        elif isinstance(stmt, IfStmt):
            self.visit_expr(stmt.condition)
            self.visit_stmt(stmt.then_branch)
            if stmt.else_branch:
                self.visit_stmt(stmt.else_branch)
        elif isinstance(stmt, WhileStmt):
            self.visit_expr(stmt.condition)
            self.visit_stmt(stmt.body)
        elif isinstance(stmt, ReturnStmt):
            if stmt.value:
                self.visit_expr(stmt.value)

    def visit_var_decl(self, decl: VarDecl):
        # 1. Проверка: имя не является ключевым словом или зарезервированным
        if decl.name in {"main", "use", "if", "else", "while", "return", "console"}:
            self.errors.append(SemanticError(f"Нельзя использовать '{decl.name}' как имя переменной", None))
            return

        # 2. Проверка: переменная с таким именем уже есть?
        if decl.name in self.variables:
            self.errors.append(SemanticError(f"Переменная '{decl.name}' уже объявлена", None))
            return

        # 3. Определяем тип инициализатора
        init_type = self._infer_type(decl.initializer)
        if init_type is None:
            # Ошибка уже добавлена в _infer_type
            return

        # 4. Проверка совместимости типов
        if not self._is_compatible(decl.type_name, init_type):
            self.errors.append(SemanticError(
                f"Нельзя присвоить значение типа '{init_type}' переменной типа '{decl.type_name}'",
                None
            ))
            return

        # 5. Регистрируем переменную
        self.variables[decl.name] = VarInfo(decl.type_name, decl.name)

    def visit_expr(self, expr: Expr) -> Optional[str]:
        if isinstance(expr, Literal):
            return self._literal_type(expr.value)
        elif isinstance(expr, Variable):
            if expr.name not in self.variables:
                self.errors.append(SemanticError(f"Переменная '{expr.name}' не объявлена", None))
                return None
            return self.variables[expr.name].type_name
        elif isinstance(expr, Assign):
            # Проверка: переменная существует
            if expr.name not in self.variables:
                self.errors.append(SemanticError(f"Переменная '{expr.name}' не объявлена", None))
                return None
            target_type = self.variables[expr.name].type_name
            value_type = self.visit_expr(expr.value)
            if value_type and not self._is_compatible(target_type, value_type):
                self.errors.append(SemanticError(
                    f"Нельзя присвоить значение типа '{value_type}' переменной типа '{target_type}'",
                    None
                ))
            return target_type
        elif isinstance(expr, Binary):
            left_type = self.visit_expr(expr.left)
            right_type = self.visit_expr(expr.right)
            # Упрощённая проверка: для арифметики — числа, для сравнения — совместимые типы
            if expr.operator in {"+", "-", "*", "/"}:
                if left_type not in {"int", "float"} or right_type not in {"int", "float"}:
                    self.errors.append(SemanticError("Операторы +, -, *, / требуют числовых операндов", None))
            return "bool" if expr.operator in {"==", "!=", "<", "<=", ">", ">="} else left_type
        elif isinstance(expr, Unary):
            operand_type = self.visit_expr(expr.right)
            if expr.operator == "-" and operand_type not in {"int", "float"}:
                self.errors.append(SemanticError("Унарный минус применим только к числам", None))
            elif expr.operator == "not" and operand_type != "bool":
                self.errors.append(SemanticError("Оператор 'not' применим только к логическим значениям", None))
            return operand_type
        elif isinstance(expr, Call):
            return self._check_call(expr)
        elif isinstance(expr, Get):
            obj_type = self.visit_expr(expr.object)
            if obj_type == "string" and expr.name == "length":
                return "int"
            # Для console — обрабатываем отдельно в _check_call
            return None
        return None

    def _infer_type(self, expr: Expr) -> Optional[str]:
        return self.visit_expr(expr)

    def _literal_type(self, value) -> str:
        if isinstance(value, bool):
            return "bool"
        elif isinstance(value, int):
            return "int"
        elif isinstance(value, float):
            return "float"
        elif isinstance(value, str):
            return "char" if len(value) == 1 else "string"
        return "unknown"

    def _is_compatible(self, expected: str, actual: str) -> bool:
        if expected == actual:
            return True
        # Допустимо: int → float
        if expected == "float" and actual == "int":
            return True
        # Символ — это строка длины 1, но в Idyllium они разные типы
        # (можно разрешить char → string, но пока запретим для строгости)
        return False

    def _check_call(self, call: Call) -> Optional[str]:
        # Обработка console.get_int(), console.get_float(), console.get_string()
        if isinstance(call.callee, Get) and isinstance(call.callee.object, Variable):
            module = call.callee.object.name
            func_name = call.callee.name

            if module == "console":
                if func_name == "get_int":
                    if len(call.arguments) != 0:
                        self.errors.append(SemanticError("console.get_int() не принимает аргументов", None))
                    return "int"
                elif func_name == "get_float":
                    if len(call.arguments) != 0:
                        self.errors.append(SemanticError("console.get_float() не принимает аргументов", None))
                    return "float"
                elif func_name == "get_string":
                    if len(call.arguments) != 0:
                        self.errors.append(SemanticError("console.get_string() не принимает аргументов", None))
                    return "string"
                elif func_name == "write":
                    # Проверяем аргументы (пока без типов)
                    for arg in call.arguments:
                        self.visit_expr(arg)
                    return "void"
            else:
                self.errors.append(SemanticError(f"Неизвестный модуль '{module}'", None))
                return None

        # Обработка to_string, to_int, to_float
        if isinstance(call.callee, Variable):
            func_name = call.callee.name
            if func_name in {"to_string", "to_int", "to_float"}:
                if len(call.arguments) != 1:
                    self.errors.append(SemanticError(f"{func_name}() требует ровно один аргумент", None))
                    return None
                arg_type = self.visit_expr(call.arguments[0])
                # Возвращаемый тип
                return_type_map = {
                    "to_string": "string",
                    "to_int": "int",
                    "to_float": "float"
                }
                return return_type_map[func_name]
        
        # Улучшенное сообщение об ошибке: показываем имя функции
        if isinstance(call.callee, Variable):
            func_name_repr = call.callee.name
            self.errors.append(SemanticError(f"Неизвестная функция '{func_name_repr}'", None))
        elif isinstance(call.callee, Get):
            if isinstance(call.callee.object, Variable):
                full_name = f"{call.callee.object.name}.{call.callee.name}"
                self.errors.append(SemanticError(f"Неизвестная функция или метод '{full_name}'", None))
            else:
                # Очень редкий случай
                self.errors.append(SemanticError("Неизвестная функция (некорректный вызов)", None))
        else:
            # Например, Binary или Literal как функция
            self.errors.append(SemanticError("Некорректный вызов функции: выражение не является именем функции", None))
        
        return None

# Вспомогательный класс для хранения информации о переменной
class VarInfo:
    def __init__(self, type_name: str, name: str):
        self.type_name = type_name
        self.name = name