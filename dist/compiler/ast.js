"use strict";
// src/compiler/ast.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExpression = isExpression;
exports.isStatement = isStatement;
exports.isAssignmentTarget = isAssignmentTarget;
exports.isPrimitiveType = isPrimitiveType;
exports.isNumericPrimitiveType = isNumericPrimitiveType;
exports.loc = loc;
const EXPRESSION_KINDS = new Set([
    'IntLiteral',
    'FloatLiteral',
    'StringLiteral',
    'CharLiteral',
    'BoolLiteral',
    'ArrayLiteral',
    'Identifier',
    'ThisExpr',
    'BinaryExpr',
    'UnaryMinus',
    'NotExpr',
    'FunctionCall',
    'MethodCall',
    'PropertyAccess',
    'IndexAccess',
    'Lambda',
    'ConstructorCall',
    'ParentCall',
]);
const STATEMENT_KINDS = new Set([
    'VariableDecl',
    'MultiVariableDecl',
    'AssignmentStmt',
    'ExpressionStmt',
    'IfStmt',
    'WhileStmt',
    'DoWhileStmt',
    'ForStmt',
    'ReturnStmt',
    'BreakStmt',
    'ContinueStmt',
    'TryStmt',
]);
function isExpression(node) {
    return EXPRESSION_KINDS.has(node.kind);
}
function isStatement(node) {
    return STATEMENT_KINDS.has(node.kind);
}
function isAssignmentTarget(node) {
    return node.kind === 'Identifier'
        || node.kind === 'IndexAccess'
        || node.kind === 'PropertyAccess';
}
function isPrimitiveType(t) {
    return t.kind === 'PrimitiveType';
}
function isNumericPrimitiveType(t) {
    return t.kind === 'PrimitiveType'
        && (t.name === 'int' || t.name === 'float');
}
function loc(file, line) {
    return { file, line };
}
//# sourceMappingURL=ast.js.map