import { SourceRange } from './diagnostics';
import { PrimitiveTypeName } from './types';

export type TypeName = PrimitiveTypeNameNode | QualifiedTypeNameNode | ClassTypeNameNode | ArrayTypeNameNode;

export interface PrimitiveTypeNameNode {
  readonly kind: 'PrimitiveTypeName';
  readonly name: PrimitiveTypeName;
  readonly range: SourceRange;
}

export interface QualifiedTypeNameNode {
  readonly kind: 'QualifiedTypeName';
  readonly moduleName: string;
  readonly moduleNameRange: SourceRange;
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly range: SourceRange;
}

export interface ClassTypeNameNode {
  readonly kind: 'ClassTypeName';
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly range: SourceRange;
}

export interface ArrayTypeNameNode {
  readonly kind: 'ArrayTypeName';
  readonly elementType: TypeName;
  readonly size: number | null;
  readonly dynamic: boolean;
  readonly range: SourceRange;
}

export interface Program {
  readonly kind: 'Program';
  readonly imports: ImportDeclaration[];
  readonly declarations: TopLevelDeclaration[];
  readonly main: MainFunction | null;
  readonly range: SourceRange;
}

export type TopLevelDeclaration = VariableDeclaration | FunctionDeclaration | ClassDeclaration;

export interface ImportDeclaration {
  readonly kind: 'ImportDeclaration';
  readonly moduleName: string;
  readonly moduleNameRange: SourceRange;
  readonly range: SourceRange;
}

export interface MainFunction {
  readonly kind: 'MainFunction';
  readonly nameRange: SourceRange;
  readonly returnType: TypeName;
  readonly parameters: ParameterDeclaration[];
  readonly body: BlockStatement;
  readonly range: SourceRange;
}

export type Statement =
  | BlockStatement
  | IfStatement
  | TryStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | BreakStatement
  | ContinueStatement
  | ReturnStatement
  | VariableDeclaration
  | AssignmentStatement
  | ExpressionStatement;

export interface BlockStatement {
  readonly kind: 'BlockStatement';
  readonly statements: Statement[];
  readonly range: SourceRange;
}

export interface VariableDeclaration {
  readonly kind: 'VariableDeclaration';
  readonly isConst: boolean;
  readonly declaredType: TypeName;
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly initializer: Expression | null;
  readonly constructorArgs: CallArgument[] | null;
  readonly range: SourceRange;
}

export interface AssignmentStatement {
  readonly kind: 'AssignmentStatement';
  readonly target: Expression;
  readonly operator: '=' | '+=' | '-=' | '*=' | '/=';
  readonly value: Expression;
  readonly range: SourceRange;
}

export interface IfStatement {
  readonly kind: 'IfStatement';
  readonly condition: Expression;
  readonly thenBranch: Statement;
  readonly elseBranch: Statement | null;
  readonly range: SourceRange;
}

export interface CatchClause {
  readonly kind: 'CatchClause';
  readonly name: string | null;
  readonly nameRange: SourceRange | null;
  readonly body: BlockStatement;
  readonly range: SourceRange;
}

export interface TryStatement {
  readonly kind: 'TryStatement';
  readonly tryBlock: BlockStatement;
  readonly catchClause: CatchClause | null;
  readonly finallyBlock: BlockStatement | null;
  readonly range: SourceRange;
}

export type ForClauseStatement = VariableDeclaration | AssignmentStatement | ExpressionStatement;

export interface WhileStatement {
  readonly kind: 'WhileStatement';
  readonly condition: Expression;
  readonly body: Statement;
  readonly range: SourceRange;
}

export interface DoWhileStatement {
  readonly kind: 'DoWhileStatement';
  readonly body: Statement;
  readonly condition: Expression;
  readonly range: SourceRange;
}

export interface ForStatement {
  readonly kind: 'ForStatement';
  readonly initializer: ForClauseStatement | null;
  readonly condition: Expression | null;
  readonly increment: ForClauseStatement | null;
  readonly body: Statement;
  readonly range: SourceRange;
}

export interface BreakStatement {
  readonly kind: 'BreakStatement';
  readonly range: SourceRange;
}

export interface ContinueStatement {
  readonly kind: 'ContinueStatement';
  readonly range: SourceRange;
}

export interface ReturnStatement {
  readonly kind: 'ReturnStatement';
  readonly value: Expression | null;
  readonly range: SourceRange;
}

export interface FunctionDeclaration {
  readonly kind: 'FunctionDeclaration';
  readonly returnType: TypeName;
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly parameters: ParameterDeclaration[];
  readonly body: BlockStatement;
  readonly range: SourceRange;
}

export interface ClassDeclaration {
  readonly kind: 'ClassDeclaration';
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly baseName: string | null;
  readonly baseNameRange: SourceRange | null;
  readonly members: ClassMember[];
  readonly range: SourceRange;
}

export type ClassMember = ClassFieldDeclaration | ClassMethodDeclaration | ConstructorDeclaration;
export type AccessModifier = 'public' | 'private';

export interface ClassFieldDeclaration {
  readonly kind: 'ClassFieldDeclaration';
  readonly declaredType: TypeName;
  readonly fields: FieldDeclarator[];
  readonly access: AccessModifier;
  readonly range: SourceRange;
}

export interface FieldDeclarator {
  readonly kind: 'FieldDeclarator';
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly initializer: Expression | null;
  readonly range: SourceRange;
}

export interface ClassMethodDeclaration {
  readonly kind: 'ClassMethodDeclaration';
  readonly returnType: TypeName;
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly parameters: ParameterDeclaration[];
  readonly body: BlockStatement;
  readonly isStatic: boolean;
  readonly access: AccessModifier;
  readonly range: SourceRange;
}

export interface ConstructorDeclaration {
  readonly kind: 'ConstructorDeclaration';
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly parameters: ParameterDeclaration[];
  readonly body: BlockStatement;
  readonly access: AccessModifier;
  readonly range: SourceRange;
}

export interface ParameterDeclaration {
  readonly kind: 'ParameterDeclaration';
  readonly paramType: TypeName;
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly defaultValue: Expression | null;
  readonly range: SourceRange;
}

export interface ExpressionStatement {
  readonly kind: 'ExpressionStatement';
  readonly expression: Expression;
  readonly range: SourceRange;
}

export type Expression =
  | LiteralExpression
  | IdentifierExpression
  | UnaryExpression
  | BinaryExpression
  | ArrayLiteralExpression
  | IndexExpression
  | FunctionExpression
  | CallExpression
  | MemberExpression;

export interface LiteralExpression {
  readonly kind: 'LiteralExpression';
  readonly value: string | number | boolean | null;
  readonly valueType: PrimitiveTypeName | 'null';
  readonly sourceText?: string;
  readonly range: SourceRange;
}

export interface IdentifierExpression {
  readonly kind: 'IdentifierExpression';
  readonly name: string;
  readonly range: SourceRange;
}

export interface UnaryExpression {
  readonly kind: 'UnaryExpression';
  readonly operator: '-' | 'not';
  readonly operand: Expression;
  readonly range: SourceRange;
}

export interface BinaryExpression {
  readonly kind: 'BinaryExpression';
  readonly operator: '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or';
  readonly left: Expression;
  readonly right: Expression;
  readonly range: SourceRange;
}

export interface ArrayLiteralExpression {
  readonly kind: 'ArrayLiteralExpression';
  readonly elements: Expression[];
  readonly range: SourceRange;
}

export interface IndexExpression {
  readonly kind: 'IndexExpression';
  readonly object: Expression;
  readonly index: Expression;
  readonly range: SourceRange;
}

export interface FunctionExpression {
  readonly kind: 'FunctionExpression';
  readonly returnType: TypeName;
  readonly parameters: ParameterDeclaration[];
  readonly body: BlockStatement;
  readonly range: SourceRange;
}

export interface CallExpression {
  readonly kind: 'CallExpression';
  readonly callee: Expression;
  readonly args: CallArgument[];
  readonly range: SourceRange;
}

export interface CallArgument {
  readonly kind: 'CallArgument';
  readonly name: string | null;
  readonly nameRange: SourceRange | null;
  readonly value: Expression;
  readonly range: SourceRange;
}

export interface MemberExpression {
  readonly kind: 'MemberExpression';
  readonly object: Expression;
  readonly name: string;
  readonly nameRange: SourceRange;
  readonly range: SourceRange;
}
