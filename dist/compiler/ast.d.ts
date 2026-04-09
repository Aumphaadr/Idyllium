export interface SourceLocation {
    readonly file: string;
    readonly line: number;
}
export interface PrimitiveType {
    readonly kind: 'PrimitiveType';
    readonly loc: SourceLocation;
    readonly name: 'int' | 'float' | 'string' | 'char' | 'bool' | 'void';
}
export interface ArrayType {
    readonly kind: 'ArrayType';
    readonly loc: SourceLocation;
    readonly elementType: TypeNode;
    readonly size: number;
}
export interface DynArrayType {
    readonly kind: 'DynArrayType';
    readonly loc: SourceLocation;
    readonly elementType: TypeNode;
}
export interface QualifiedType {
    readonly kind: 'QualifiedType';
    readonly loc: SourceLocation;
    readonly qualifier: string;
    readonly name: string;
}
export interface ClassType {
    readonly kind: 'ClassType';
    readonly loc: SourceLocation;
    readonly name: string;
}
export type TypeNode = PrimitiveType | ArrayType | DynArrayType | QualifiedType | ClassType;
export interface Program {
    readonly kind: 'Program';
    readonly loc: SourceLocation;
    readonly imports: UseDeclaration[];
    readonly declarations: TopLevelDecl[];
    readonly main: FunctionDecl;
}
export interface UseDeclaration {
    readonly kind: 'UseDeclaration';
    readonly loc: SourceLocation;
    readonly libraryName: string;
}
export type TopLevelDecl = FunctionDecl | ClassDecl;
export interface Parameter {
    readonly kind: 'Parameter';
    readonly loc: SourceLocation;
    readonly paramType: TypeNode;
    readonly name: string;
    readonly defaultValue: Expression | null;
}
export interface Argument {
    readonly loc: SourceLocation;
    readonly name: string | null;
    readonly value: Expression;
}
export interface VariableDecl {
    readonly kind: 'VariableDecl';
    readonly loc: SourceLocation;
    readonly varType: TypeNode;
    readonly name: string;
    readonly initializer: Expression | null;
    readonly constructorArgs: Argument[] | null;
}
export interface MultiVariableDecl {
    readonly kind: 'MultiVariableDecl';
    readonly loc: SourceLocation;
    readonly varType: TypeNode;
    readonly declarations: SingleVarDecl[];
}
export interface SingleVarDecl {
    readonly loc: SourceLocation;
    readonly name: string;
    readonly initializer: Expression | null;
    readonly constructorArgs: Argument[] | null;
}
export interface FunctionDecl {
    readonly kind: 'FunctionDecl';
    readonly loc: SourceLocation;
    readonly returnType: TypeNode;
    readonly name: string;
    readonly params: Parameter[];
    readonly body: Block;
}
export interface ClassDecl {
    readonly kind: 'ClassDecl';
    readonly loc: SourceLocation;
    readonly name: string;
    readonly parentClass: string | null;
    readonly parentModule: string | null;
    readonly members: ClassMember[];
}
export interface ClassField {
    readonly kind: 'ClassField';
    readonly loc: SourceLocation;
    readonly access: AccessModifier;
    readonly fieldType: TypeNode;
    readonly name: string;
    readonly initializer: Expression | null;
}
export interface ClassMethod {
    readonly kind: 'ClassMethod';
    readonly loc: SourceLocation;
    readonly access: AccessModifier;
    readonly returnType: TypeNode;
    readonly name: string;
    readonly params: Parameter[];
    readonly body: Block;
}
export interface ClassConstructor {
    readonly kind: 'ClassConstructor';
    readonly loc: SourceLocation;
    readonly access: AccessModifier;
    readonly className: string;
    readonly params: Parameter[];
    readonly body: Block;
}
export interface ClassDestructor {
    readonly kind: 'ClassDestructor';
    readonly loc: SourceLocation;
    readonly access: AccessModifier;
    readonly className: string;
    readonly body: Block;
}
export type AccessModifier = 'public' | 'private';
export type ClassMember = ClassField | ClassMethod | ClassConstructor | ClassDestructor;
export interface Block {
    readonly kind: 'Block';
    readonly loc: SourceLocation;
    readonly statements: Statement[];
}
export interface ExpressionStmt {
    readonly kind: 'ExpressionStmt';
    readonly loc: SourceLocation;
    readonly expression: Expression;
}
export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=';
export interface AssignmentStmt {
    readonly kind: 'AssignmentStmt';
    readonly loc: SourceLocation;
    readonly target: AssignmentTarget;
    readonly operator: AssignmentOperator;
    readonly value: Expression;
}
export type AssignmentTarget = IdentifierExpr | IndexAccessExpr | PropertyAccessExpr;
export interface IfStmt {
    readonly kind: 'IfStmt';
    readonly loc: SourceLocation;
    readonly condition: Expression;
    readonly thenBlock: Block;
    readonly elseIfClauses: ElseIfClause[];
    readonly elseBlock: Block | null;
}
export interface ElseIfClause {
    readonly loc: SourceLocation;
    readonly condition: Expression;
    readonly block: Block;
}
export interface WhileStmt {
    readonly kind: 'WhileStmt';
    readonly loc: SourceLocation;
    readonly condition: Expression;
    readonly body: Block;
}
export interface DoWhileStmt {
    readonly kind: 'DoWhileStmt';
    readonly loc: SourceLocation;
    readonly body: Block;
    readonly condition: Expression;
}
export interface ForStmt {
    readonly kind: 'ForStmt';
    readonly loc: SourceLocation;
    readonly init: VariableDecl;
    readonly condition: Expression;
    readonly update: AssignmentStmt;
    readonly body: Block;
}
export interface ReturnStmt {
    readonly kind: 'ReturnStmt';
    readonly loc: SourceLocation;
    readonly value: Expression | null;
}
export interface BreakStmt {
    readonly kind: 'BreakStmt';
    readonly loc: SourceLocation;
}
export interface ContinueStmt {
    readonly kind: 'ContinueStmt';
    readonly loc: SourceLocation;
}
export interface TryStmt {
    readonly kind: 'TryStmt';
    readonly loc: SourceLocation;
    readonly tryBlock: Block;
    readonly catchParam: Parameter | null;
    readonly catchBlock: Block;
}
export type Statement = VariableDecl | MultiVariableDecl | AssignmentStmt | ExpressionStmt | IfStmt | WhileStmt | DoWhileStmt | ForStmt | ReturnStmt | BreakStmt | ContinueStmt | TryStmt;
export interface IntLiteralExpr {
    readonly kind: 'IntLiteral';
    readonly loc: SourceLocation;
    readonly value: number;
}
export interface FloatLiteralExpr {
    readonly kind: 'FloatLiteral';
    readonly loc: SourceLocation;
    readonly value: number;
}
export interface StringLiteralExpr {
    readonly kind: 'StringLiteral';
    readonly loc: SourceLocation;
    readonly value: string;
}
export interface CharLiteralExpr {
    readonly kind: 'CharLiteral';
    readonly loc: SourceLocation;
    readonly value: string;
}
export interface BoolLiteralExpr {
    readonly kind: 'BoolLiteral';
    readonly loc: SourceLocation;
    readonly value: boolean;
}
export interface ArrayLiteralExpr {
    readonly kind: 'ArrayLiteral';
    readonly loc: SourceLocation;
    readonly elements: Expression[];
}
export interface IdentifierExpr {
    readonly kind: 'Identifier';
    readonly loc: SourceLocation;
    readonly name: string;
}
export interface ThisExpr {
    readonly kind: 'ThisExpr';
    readonly loc: SourceLocation;
}
export type BinaryOperator = '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '>' | '<=' | '>=' | 'and' | 'or' | 'xor';
export interface BinaryExpr {
    readonly kind: 'BinaryExpr';
    readonly loc: SourceLocation;
    readonly operator: BinaryOperator;
    readonly left: Expression;
    readonly right: Expression;
}
export interface UnaryMinusExpr {
    readonly kind: 'UnaryMinus';
    readonly loc: SourceLocation;
    readonly operand: Expression;
}
export interface NotExpr {
    readonly kind: 'NotExpr';
    readonly loc: SourceLocation;
    readonly argument: Expression;
}
export interface FunctionCallExpr {
    readonly kind: 'FunctionCall';
    readonly loc: SourceLocation;
    readonly callee: string;
    readonly args: Argument[];
}
export interface MethodCallExpr {
    readonly kind: 'MethodCall';
    readonly loc: SourceLocation;
    readonly object: Expression;
    readonly method: string;
    readonly args: Argument[];
}
export interface PropertyAccessExpr {
    readonly kind: 'PropertyAccess';
    readonly loc: SourceLocation;
    readonly object: Expression;
    readonly property: string;
}
export interface IndexAccessExpr {
    readonly kind: 'IndexAccess';
    readonly loc: SourceLocation;
    readonly object: Expression;
    readonly index: Expression;
}
export interface LambdaExpr {
    readonly kind: 'Lambda';
    readonly loc: SourceLocation;
    readonly returnType: TypeNode;
    readonly params: Parameter[];
    readonly body: Block;
}
export interface ConstructorCallExpr {
    readonly kind: 'ConstructorCall';
    readonly loc: SourceLocation;
    readonly className: string;
    readonly args: Argument[];
}
export type Expression = IntLiteralExpr | FloatLiteralExpr | StringLiteralExpr | CharLiteralExpr | BoolLiteralExpr | ArrayLiteralExpr | IdentifierExpr | ThisExpr | BinaryExpr | UnaryMinusExpr | NotExpr | FunctionCallExpr | MethodCallExpr | PropertyAccessExpr | IndexAccessExpr | LambdaExpr | ConstructorCallExpr;
export type AnyNode = PrimitiveType | ArrayType | DynArrayType | QualifiedType | ClassType | Program | UseDeclaration | VariableDecl | FunctionDecl | Parameter | ClassDecl | ClassField | ClassMethod | ClassConstructor | ClassDestructor | Block | ExpressionStmt | AssignmentStmt | IfStmt | WhileStmt | DoWhileStmt | ForStmt | ReturnStmt | BreakStmt | ContinueStmt | TryStmt | IntLiteralExpr | FloatLiteralExpr | StringLiteralExpr | CharLiteralExpr | BoolLiteralExpr | ArrayLiteralExpr | IdentifierExpr | ThisExpr | BinaryExpr | UnaryMinusExpr | NotExpr | FunctionCallExpr | MethodCallExpr | PropertyAccessExpr | IndexAccessExpr | LambdaExpr;
export declare function isExpression(node: {
    kind: string;
}): node is Expression;
export declare function isStatement(node: {
    kind: string;
}): node is Statement;
export declare function isAssignmentTarget(node: Expression): node is AssignmentTarget;
export declare function isPrimitiveType(t: TypeNode): t is PrimitiveType;
export declare function isNumericPrimitiveType(t: TypeNode): boolean;
export declare function loc(file: string, line: number): SourceLocation;
//# sourceMappingURL=ast.d.ts.map