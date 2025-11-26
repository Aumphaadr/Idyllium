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
        self.variables = {}
        self.errors = []
        self.global_function_names = set()
        self.user_libraries = set()

    def analyze(self, program: Program, user_libraries: set = None):
        self.modules = {imp.module_name for imp in program.imports}
        self.user_libraries = user_libraries or set()
        self.global_function_names = {func.name for func in program.global_functions}
        for func in program.global_functions:
            self.visit_function(func)
        self.visit_function(program.main_func)
        if self.errors:
            raise self.errors[0]

    def visit_function(self, func: FunctionDecl):
        saved_vars = self.variables
        self.variables = {}
        for param in func.params:
            self.variables[param.name] = VarInfo(param.type_name, param.name)
        for stmt in func.body.statements:
            self.visit_stmt(stmt)
        self.variables = saved_vars

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
        if decl.name in {"main", "use", "if", "else", "while", "return", "console"}:
            self.errors.append(SemanticError(f"Нельзя использовать '{decl.name}' как имя переменной", None))
            return
        if decl.name in self.variables:
            self.errors.append(SemanticError(f"Переменная '{decl.name}' уже объявлена", None))
            return
        init_type = self._infer_type(decl.initializer)
        if init_type is None:
            return
        if not self._is_compatible(decl.type_name, init_type):
            self.errors.append(SemanticError(
                f"Нельзя присвоить значение типа '{init_type}' переменной типа '{decl.type_name}'",
                None
            ))
            return
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
        if expected == "float" and actual == "int":
            return True
        return False

    def _check_call(self, call: Call) -> Optional[str]:
        if isinstance(call.callee, Get) and isinstance(call.callee.object, Variable):
            module = call.callee.object.name
            method = call.callee.name

            if module == "console":
                if method == "get_int":
                    if len(call.arguments) != 0:
                        self.errors.append(SemanticError("console.get_int() не принимает аргументов", None))
                    return "int"
                elif method == "get_float":
                    if len(call.arguments) != 0:
                        self.errors.append(SemanticError("console.get_float() не принимает аргументов", None))
                    return "float"
                elif method == "get_string":
                    if len(call.arguments) != 0:
                        self.errors.append(SemanticError("console.get_string() не принимает аргументов", None))
                    return "string"
                elif method == "write":
                    for arg in call.arguments:
                        self.visit_expr(arg)
                    return "void"
                else:
                    self.errors.append(SemanticError(f"Неизвестный метод 'console.{method}'", None))
                    return None

            elif module in self.user_libraries:
                for arg in call.arguments:
                    self.visit_expr(arg)
                return "void"

            else:
                self.errors.append(SemanticError(f"Неизвестный модуль '{module}' (не подключён через 'use')", None))
                return None

        elif isinstance(call.callee, Variable):
            func_name = call.callee.name

            if func_name in {"to_string", "to_int", "to_float"}:
                if len(call.arguments) != 1:
                    self.errors.append(SemanticError(f"{func_name}() требует ровно один аргумент", None))
                    return None
                arg_type = self.visit_expr(call.arguments[0])
                return {"to_string": "string", "to_int": "int", "to_float": "float"}[func_name]

            elif func_name in self.global_function_names:
                for arg in call.arguments:
                    self.visit_expr(arg)
                return "void"

            else:
                self.errors.append(SemanticError(f"Неизвестная функция '{func_name}'", None))
                return None

        else:
            self.errors.append(SemanticError("Некорректный вызов функции", None))
            return None

class VarInfo:
    def __init__(self, type_name: str, name: str):
        self.type_name = type_name
        self.name = name