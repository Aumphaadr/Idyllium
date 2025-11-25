# iast.py

from abc import ABC, abstractmethod
from typing import List, Optional

class Expr(ABC):
    """Базовый класс для выражений"""
    pass

class Stmt(ABC):
    """Базовый класс для операторов (statements)"""
    pass

# --- Выражения ---
class Literal(Expr):
    def __init__(self, value):
        self.value = value  # int, float, str, bool, или символ (str длины 1)

class Variable(Expr):
    def __init__(self, name: str):
        self.name = name

class Assign(Expr):
    def __init__(self, name: str, value: Expr):
        self.name = name
        self.value = value

class Binary(Expr):
    def __init__(self, left: Expr, operator: str, right: Expr):
        self.left = left
        self.operator = operator  # "+", "==", "and", и т.д.
        self.right = right

class Unary(Expr):
    def __init__(self, operator: str, right: Expr):
        self.operator = operator  # "-", "not"
        self.right = right

class Call(Expr):
    def __init__(self, callee: Expr, arguments: List[Expr]):
        self.callee = callee      # например, console.write
        self.arguments = arguments

class Get(Expr):
    """Доступ к свойству объекта: obj.property"""
    def __init__(self, object: Expr, name: str):
        self.object = object
        self.name = name

# --- Операторы ---
class VarDecl(Stmt):
    def __init__(self, type_name: str, name: str, initializer: Expr):
        self.type_name = type_name  # "int", "string" и т.д.
        self.name = name
        self.initializer = initializer

class ExprStmt(Stmt):
    """Выражение как отдельный оператор: вызов функции, присвоение и т.д."""
    def __init__(self, expr: Expr):
        self.expr = expr

class Block(Stmt):
    def __init__(self, statements: List[Stmt]):
        self.statements = statements

class IfStmt(Stmt):
    def __init__(self, condition: Expr, then_branch: Stmt, else_branch: Optional[Stmt]):
        self.condition = condition
        self.then_branch = then_branch
        self.else_branch = else_branch

class WhileStmt(Stmt):
    def __init__(self, condition: Expr, body: Stmt):
        self.condition = condition
        self.body = body

class FunctionDecl(Stmt):
    def __init__(self, name: str, return_type: str, params: List['Param'], body: Block):
        self.name = name
        self.return_type = return_type
        self.params = params
        self.body = body

class Param:
    def __init__(self, type_name: str, name: str):
        self.type_name = type_name
        self.name = name

class ReturnStmt(Stmt):
    def __init__(self, value: Optional[Expr]):
        self.value = value

class UseDecl(Stmt):
    def __init__(self, module_name: str):
        self.module_name = module_name

class Program:
    def __init__(self, imports: List[UseDecl], main_func: FunctionDecl):
        self.imports = imports
        self.main_func = main_func