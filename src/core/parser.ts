import {
  AccessModifier,
  ArrayLiteralExpression,
  ArrayTypeNameNode,
  AssignmentStatement,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  ClassDeclaration,
  ClassFieldDeclaration,
  ClassMethodDeclaration,
  ClassTypeNameNode,
  CallArgument,
  CallExpression,
  ConstructorDeclaration,
  ContinueStatement,
  DoWhileStatement,
  Expression,
  ExpressionStatement,
  ForClauseStatement,
  ForStatement,
  FunctionExpression,
  FunctionDeclaration,
  IdentifierExpression,
  IfStatement,
  IndexExpression,
  ImportDeclaration,
  LiteralExpression,
  MainFunction,
  MemberExpression,
  ParameterDeclaration,
  Program,
  ReturnStatement,
  Statement,
  TypeName,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from './ast';
import { DiagnosticBag, SourceRange } from './diagnostics';
import { Token, TokenKind, tokenDisplay } from './tokens';
import { PrimitiveTypeName } from './types';

export interface ParseResult {
  readonly program: Program | null;
  readonly diagnostics: DiagnosticBag;
}

export class Parser {
  private readonly diagnostics = new DiagnosticBag();
  private current = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parseProgram(): ParseResult {
    const start = this.peek().range.start;
    const imports: ImportDeclaration[] = [];
    const topLevelDeclarations: Array<ClassDeclaration | FunctionDeclaration | VariableDeclaration> = [];
    let main: MainFunction | null = null;

    while (this.match(TokenKind.KwUse)) {
      imports.push(this.parseImport(this.previous()));
    }

    while (!this.isAtEnd()) {
      if (this.check(TokenKind.KwClass)) {
        topLevelDeclarations.push(this.parseClassDeclaration());
        continue;
      }

      if (this.check(TokenKind.KwMain)) {
        if (main !== null) {
          this.error(this.peek().range, "entry point 'main' is already declared");
        }
        main = this.parseMainFunction();
        continue;
      }

      if (this.check(TokenKind.KwConst)) {
        topLevelDeclarations.push(this.parseVariableDeclaration());
        continue;
      }

      if (this.checkTypeStart()) {
        const declaration = this.parseTopLevelDeclaration();
        if (declaration.kind === 'FunctionDeclaration' && declaration.name === 'main') {
          if (main !== null) {
            this.error(declaration.range, "entry point 'main' is already declared");
          }
          main = this.mainFromFunctionDeclaration(declaration);
          continue;
        }
        topLevelDeclarations.push(declaration);
        continue;
      }

      this.error(this.peek().range, `unexpected token ${tokenDisplay(this.peek().kind)} at top level`);
      this.advance();
    }

    const end = main?.range.end
      ?? topLevelDeclarations[topLevelDeclarations.length - 1]?.range.end
      ?? imports[imports.length - 1]?.range.end
      ?? this.peek().range.end;

    return {
      program: {
        kind: 'Program',
        imports,
        declarations: topLevelDeclarations,
        main,
        range: { start, end },
      },
      diagnostics: this.diagnostics,
    };
  }

  private parseImport(useToken: Token): ImportDeclaration {
    const moduleToken = this.consume(TokenKind.Identifier, 'expected library name after use');
    this.consume(TokenKind.Semicolon, "expected ';' after use declaration");
    return {
      kind: 'ImportDeclaration',
      moduleName: moduleToken.lexeme,
      moduleNameRange: moduleToken.range,
      range: { start: useToken.range.start, end: this.previous().range.end },
    };
  }

  private parseMainFunction(): MainFunction | null {
    const main = this.consume(TokenKind.KwMain, "expected 'main' entry point");
    if (main.kind !== TokenKind.KwMain) return null;

    this.consume(TokenKind.LeftParen, "expected '(' after main");
    this.consume(TokenKind.RightParen, "expected ')' after main");
    const body = this.parseBlock();

    return {
      kind: 'MainFunction',
      nameRange: main.range,
      returnType: this.voidTypeName(main.range),
      parameters: [],
      body,
      range: { start: main.range.start, end: body.range.end },
    };
  }

  private mainFromFunctionDeclaration(declaration: FunctionDeclaration): MainFunction {
    return {
      kind: 'MainFunction',
      nameRange: declaration.nameRange,
      returnType: declaration.returnType,
      parameters: declaration.parameters,
      body: declaration.body,
      range: declaration.range,
    };
  }

  private parseTopLevelDeclaration(): FunctionDeclaration | VariableDeclaration {
    const declaredType = this.parseTypeName();
    if (this.match(TokenKind.KwFunction)) {
      return this.finishFunctionDeclaration(declaredType);
    }
    return this.finishVariableDeclaration(declaredType, false, declaredType.range.start);
  }

  private finishFunctionDeclaration(returnType: TypeName): FunctionDeclaration {
    const name = this.consumeFunctionName();
    this.consume(TokenKind.LeftParen, "expected '(' after function name");
    const parameters = this.parseParameterList();
    const body = this.parseBlock();
    return {
      kind: 'FunctionDeclaration',
      returnType,
      name: name.lexeme,
      nameRange: name.range,
      parameters,
      body,
      range: { start: returnType.range.start, end: body.range.end },
    };
  }

  private consumeFunctionName(): Token {
    if (this.check(TokenKind.Identifier, TokenKind.KwMain)) return this.advance();
    this.error(this.peek().range, 'expected function name');
    return {
      kind: TokenKind.Identifier,
      lexeme: '',
      literal: null,
      range: this.peek().range,
    };
  }

  private voidTypeName(range: SourceRange): TypeName {
    return {
      kind: 'PrimitiveTypeName',
      name: 'void',
      range,
    };
  }

  private parseBlock(): BlockStatement {
    const leftBrace = this.consume(TokenKind.LeftBrace, "expected '{' to start a block");
    const statements: Statement[] = [];

    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    const rightBrace = this.consume(TokenKind.RightBrace, "expected '}' to close a block");
    return {
      kind: 'BlockStatement',
      statements,
      range: { start: leftBrace.range.start, end: rightBrace.range.end },
    };
  }

  private parseStatement(): Statement {
    if (this.check(TokenKind.KwConst)) {
      return this.parseVariableDeclaration();
    }

    if (this.checkTypeStart()) {
      return this.parseVariableDeclaration();
    }

    if (this.check(TokenKind.KwIf)) {
      return this.parseIfStatement();
    }

    if (this.check(TokenKind.KwWhile)) {
      return this.parseWhileStatement();
    }

    if (this.check(TokenKind.KwDo)) {
      return this.parseDoWhileStatement();
    }

    if (this.check(TokenKind.KwFor)) {
      return this.parseForStatement();
    }

    if (this.check(TokenKind.KwBreak)) {
      return this.parseBreakStatement();
    }

    if (this.check(TokenKind.KwContinue)) {
      return this.parseContinueStatement();
    }

    if (this.check(TokenKind.KwReturn)) {
      return this.parseReturnStatement();
    }

    if (this.check(TokenKind.LeftBrace)) {
      return this.parseBlock();
    }

    if (this.check(TokenKind.KwElse)) {
      const elseToken = this.advance();
      this.error(
        elseToken.range,
        "'else' has no matching 'if'; without braces an if branch contains only one statement (wrap multiple statements in '{ ... }')",
      );
      return this.parseStatement();
    }

    return this.parseExpressionStatement();
  }

  private parseVariableDeclaration(): VariableDeclaration {
    const constToken = this.match(TokenKind.KwConst) ? this.previous() : null;
    const declaredType = this.parseTypeName();
    return this.finishVariableDeclaration(
      declaredType,
      constToken !== null,
      constToken?.range.start ?? declaredType.range.start,
    );
  }

  private finishVariableDeclaration(
    declaredType: TypeName,
    isConst: boolean,
    start: SourceRange['start'],
  ): VariableDeclaration {
    const name = this.consume(TokenKind.Identifier, 'expected variable name');
    let initializer: Expression | null = null;
    let constructorArgs: CallArgument[] | null = null;

    if (this.match(TokenKind.Equal)) {
      initializer = this.parseExpression();
    } else if (this.match(TokenKind.LeftParen)) {
      constructorArgs = this.parseArgumentListAfterLeftParen();
    }

    const semicolon = this.consume(TokenKind.Semicolon, "expected ';' after variable declaration");
    return {
      kind: 'VariableDeclaration',
      isConst,
      declaredType,
      name: name.lexeme,
      nameRange: name.range,
      initializer,
      constructorArgs,
      range: { start, end: semicolon.range.end },
    };
  }

  private parseClassDeclaration(): ClassDeclaration {
    const classToken = this.consume(TokenKind.KwClass, "expected 'class'");
    const name = this.consume(TokenKind.Identifier, 'expected class name');
    let baseName: string | null = null;
    let baseNameRange: SourceRange | null = null;

    if (this.match(TokenKind.KwExtends)) {
      const base = this.consume(TokenKind.Identifier, 'expected base class name after extends');
      baseName = base.lexeme;
      baseNameRange = base.range;
    }

    const leftBrace = this.consume(TokenKind.LeftBrace, "expected '{' to start class body");
    const members: ClassDeclaration['members'] = [];
    let currentAccess: AccessModifier = 'public';

    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.KwPrivate, TokenKind.KwPublic)) {
        const access = this.advance();
        this.consume(TokenKind.Colon, "expected ':' after access modifier");
        currentAccess = access.kind === TokenKind.KwPrivate ? 'private' : 'public';
        continue;
      }

      if (this.check(TokenKind.KwDestructor)) {
        const destructor = this.advance();
        this.error(destructor.range, 'destructors are not supported yet');
        this.synchronizeClassMember();
        continue;
      }

      if (this.check(TokenKind.KwConst)) {
        const token = this.advance();
        this.error(token.range, 'const class fields are not supported; use a top-level or local constant');
        continue;
      }

      const isStatic = this.match(TokenKind.KwStatic);
      if (this.check(TokenKind.KwConstructor)) {
        if (isStatic) {
          this.error(this.previous().range, 'constructors cannot be static');
        }
        members.push(this.parseConstructorDeclaration(currentAccess));
        continue;
      }

      if (this.checkTypeStart()) {
        const declaredType = this.parseTypeName();
        if (this.match(TokenKind.KwFunction)) {
          members.push(this.finishClassMethodDeclaration(declaredType, isStatic, currentAccess));
        } else {
          if (isStatic) {
            this.error(declaredType.range, 'static fields are not supported yet');
          }
          members.push(this.finishClassFieldDeclaration(declaredType, currentAccess));
        }
        continue;
      }

      this.error(this.peek().range, `unexpected token ${tokenDisplay(this.peek().kind)} in class body`);
      this.advance();
    }

    const rightBrace = this.consume(TokenKind.RightBrace, "expected '}' to close class body");
    return {
      kind: 'ClassDeclaration',
      name: name.lexeme,
      nameRange: name.range,
      baseName,
      baseNameRange,
      members,
      range: { start: classToken.range.start, end: rightBrace.range.end },
    };
  }

  private finishClassFieldDeclaration(declaredType: TypeName, access: AccessModifier): ClassFieldDeclaration {
    const fields: ClassFieldDeclaration['fields'] = [];

    do {
      const name = this.consume(TokenKind.Identifier, 'expected field name');
      const initializer = this.match(TokenKind.Equal) ? this.parseExpression() : null;
      fields.push({
        kind: 'FieldDeclarator',
        name: name.lexeme,
        nameRange: name.range,
        initializer,
        range: { start: name.range.start, end: (initializer ?? name).range.end },
      });
    } while (this.match(TokenKind.Comma));

    const semicolon = this.consume(TokenKind.Semicolon, "expected ';' after field declaration");
    return {
      kind: 'ClassFieldDeclaration',
      declaredType,
      fields,
      access,
      range: { start: declaredType.range.start, end: semicolon.range.end },
    };
  }

  private finishClassMethodDeclaration(returnType: TypeName, isStatic: boolean, access: AccessModifier): ClassMethodDeclaration {
    const name = this.consume(TokenKind.Identifier, 'expected method name');
    this.consume(TokenKind.LeftParen, "expected '(' after method name");
    const parameters = this.parseParameterList();
    const body = this.parseBlock();
    return {
      kind: 'ClassMethodDeclaration',
      returnType,
      name: name.lexeme,
      nameRange: name.range,
      parameters,
      body,
      isStatic,
      access,
      range: { start: returnType.range.start, end: body.range.end },
    };
  }

  private parseConstructorDeclaration(access: AccessModifier): ConstructorDeclaration {
    const constructorToken = this.consume(TokenKind.KwConstructor, "expected 'constructor'");
    const name = this.consume(TokenKind.Identifier, 'expected constructor class name');
    this.consume(TokenKind.LeftParen, "expected '(' after constructor name");
    const parameters = this.parseParameterList();
    const body = this.parseBlock();
    return {
      kind: 'ConstructorDeclaration',
      name: name.lexeme,
      nameRange: name.range,
      parameters,
      body,
      access,
      range: { start: constructorToken.range.start, end: body.range.end },
    };
  }

  private parseParameterList(): ParameterDeclaration[] {
    const parameters: ParameterDeclaration[] = [];
    if (!this.check(TokenKind.RightParen)) {
      do {
        parameters.push(this.parseParameterDeclaration());
      } while (this.match(TokenKind.Comma));
    }

    this.consume(TokenKind.RightParen, "expected ')' after parameters");
    return parameters;
  }

  private parseParameterDeclaration(): ParameterDeclaration {
    if (this.match(TokenKind.KwConst)) {
      this.error(this.previous().range, 'const parameters are not supported');
    }
    const paramType = this.parseTypeName();
    const paramName = this.consume(TokenKind.Identifier, 'expected parameter name');
    const defaultValue = this.match(TokenKind.Equal) ? this.parseExpression() : null;
    return {
      kind: 'ParameterDeclaration',
      paramType,
      name: paramName.lexeme,
      nameRange: paramName.range,
      defaultValue,
      range: { start: paramType.range.start, end: (defaultValue ?? paramName).range.end },
    };
  }

  private synchronizeClassMember(): void {
    while (!this.isAtEnd() && !this.check(TokenKind.Semicolon, TokenKind.RightBrace)) {
      this.advance();
    }
    if (this.check(TokenKind.Semicolon)) this.advance();
  }

  private parseExpressionStatement(): ExpressionStatement | AssignmentStatement {
    return this.parseAssignmentOrExpressionStatement(true);
  }

  private parseAssignmentOrExpressionStatement(consumeSemicolon: boolean): ExpressionStatement | AssignmentStatement {
    const expression = this.parseExpression();
    const assignmentOperator = this.matchAssignmentOperator();
    if (assignmentOperator) {
      const value = this.parseExpression();
      const end = consumeSemicolon
        ? this.consume(TokenKind.Semicolon, "expected ';' after assignment").range.end
        : value.range.end;
      return {
        kind: 'AssignmentStatement',
        target: expression,
        operator: this.assignmentOperatorText(assignmentOperator.kind),
        value,
        range: { start: expression.range.start, end },
      };
    }

    const end = consumeSemicolon
      ? this.consume(TokenKind.Semicolon, "expected ';' after expression").range.end
      : expression.range.end;
    return {
      kind: 'ExpressionStatement',
      expression,
      range: { start: expression.range.start, end },
    };
  }

  private matchAssignmentOperator(): Token | null {
    if (this.match(
      TokenKind.Equal,
      TokenKind.PlusEqual,
      TokenKind.MinusEqual,
      TokenKind.StarEqual,
      TokenKind.SlashEqual,
    )) {
      return this.previous();
    }
    return null;
  }

  private assignmentOperatorText(kind: TokenKind): AssignmentStatement['operator'] {
    switch (kind) {
      case TokenKind.PlusEqual:
        return '+=';
      case TokenKind.MinusEqual:
        return '-=';
      case TokenKind.StarEqual:
        return '*=';
      case TokenKind.SlashEqual:
        return '/=';
      default:
        return '=';
    }
  }

  private parseIfStatement(): IfStatement {
    const ifToken = this.consume(TokenKind.KwIf, "expected 'if'");
    this.consume(TokenKind.LeftParen, "expected '(' after if");
    const condition = this.parseExpression();
    this.consume(TokenKind.RightParen, "expected ')' after if condition");
    const thenBranch = this.parseStatement();
    const elseBranch = this.match(TokenKind.KwElse)
      ? this.parseStatement()
      : null;
    return {
      kind: 'IfStatement',
      condition,
      thenBranch,
      elseBranch,
      range: { start: ifToken.range.start, end: (elseBranch ?? thenBranch).range.end },
    };
  }

  private parseWhileStatement(): WhileStatement {
    const whileToken = this.consume(TokenKind.KwWhile, "expected 'while'");
    this.consume(TokenKind.LeftParen, "expected '(' after while");
    const condition = this.parseExpression();
    this.consume(TokenKind.RightParen, "expected ')' after while condition");
    const body = this.parseStatement();
    return {
      kind: 'WhileStatement',
      condition,
      body,
      range: { start: whileToken.range.start, end: body.range.end },
    };
  }

  private parseDoWhileStatement(): DoWhileStatement {
    const doToken = this.consume(TokenKind.KwDo, "expected 'do'");
    const body = this.parseStatement();
    this.consume(TokenKind.KwWhile, "expected 'while' after do body");
    this.consume(TokenKind.LeftParen, "expected '(' after while");
    const condition = this.parseExpression();
    this.consume(TokenKind.RightParen, "expected ')' after do-while condition");
    const semicolon = this.consume(TokenKind.Semicolon, "expected ';' after do-while");
    return {
      kind: 'DoWhileStatement',
      body,
      condition,
      range: { start: doToken.range.start, end: semicolon.range.end },
    };
  }

  private parseForStatement(): ForStatement {
    const forToken = this.consume(TokenKind.KwFor, "expected 'for'");
    this.consume(TokenKind.LeftParen, "expected '(' after for");

    const initializer = this.parseForInitializer();

    let condition: Expression | null = null;
    if (!this.check(TokenKind.Semicolon)) {
      condition = this.parseExpression();
    }
    this.consume(TokenKind.Semicolon, "expected ';' after for condition");

    let increment: ForClauseStatement | null = null;
    if (!this.check(TokenKind.RightParen)) {
      increment = this.parseAssignmentOrExpressionStatement(false);
    }
    this.consume(TokenKind.RightParen, "expected ')' after for clauses");

    const body = this.parseStatement();
    return {
      kind: 'ForStatement',
      initializer,
      condition,
      increment,
      body,
      range: { start: forToken.range.start, end: body.range.end },
    };
  }

  private parseForInitializer(): ForClauseStatement | null {
    if (this.match(TokenKind.Semicolon)) {
      return null;
    }

    if (this.check(TokenKind.KwConst) || this.checkTypeStart()) {
      return this.parseVariableDeclaration();
    }

    return this.parseAssignmentOrExpressionStatement(true);
  }

  private parseBreakStatement(): BreakStatement {
    const token = this.consume(TokenKind.KwBreak, "expected 'break'");
    const semicolon = this.consume(TokenKind.Semicolon, "expected ';' after break");
    return {
      kind: 'BreakStatement',
      range: { start: token.range.start, end: semicolon.range.end },
    };
  }

  private parseContinueStatement(): ContinueStatement {
    const token = this.consume(TokenKind.KwContinue, "expected 'continue'");
    const semicolon = this.consume(TokenKind.Semicolon, "expected ';' after continue");
    return {
      kind: 'ContinueStatement',
      range: { start: token.range.start, end: semicolon.range.end },
    };
  }

  private parseReturnStatement(): ReturnStatement {
    const token = this.consume(TokenKind.KwReturn, "expected 'return'");
    const value = this.check(TokenKind.Semicolon) ? null : this.parseExpression();
    const semicolon = this.consume(TokenKind.Semicolon, "expected ';' after return");
    return {
      kind: 'ReturnStatement',
      value,
      range: { start: token.range.start, end: semicolon.range.end },
    };
  }

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let expression = this.parseAnd();
    while (this.match(TokenKind.KwOr)) {
      const operator = this.previous();
      const right = this.parseAnd();
      expression = this.binary(expression, operator, right);
    }
    return expression;
  }

  private parseAnd(): Expression {
    let expression = this.parseEquality();
    while (this.match(TokenKind.KwAnd)) {
      const operator = this.previous();
      const right = this.parseEquality();
      expression = this.binary(expression, operator, right);
    }
    return expression;
  }

  private parseEquality(): Expression {
    let expression = this.parseComparison();
    while (this.match(TokenKind.EqualEqual, TokenKind.BangEqual)) {
      const operator = this.previous();
      const right = this.parseComparison();
      expression = this.binary(expression, operator, right);
    }
    return expression;
  }

  private parseComparison(): Expression {
    let expression = this.parseTerm();
    while (this.match(TokenKind.Less, TokenKind.LessEqual, TokenKind.Greater, TokenKind.GreaterEqual)) {
      const operator = this.previous();
      const right = this.parseTerm();
      expression = this.binary(expression, operator, right);
    }
    return expression;
  }

  private parseTerm(): Expression {
    let expression = this.parseFactor();
    while (this.match(TokenKind.Plus, TokenKind.Minus)) {
      const operator = this.previous();
      const right = this.parseFactor();
      expression = this.binary(expression, operator, right);
    }
    return expression;
  }

  private parseFactor(): Expression {
    let expression = this.parseUnary();
    while (this.match(TokenKind.Star, TokenKind.Slash)) {
      const operator = this.previous();
      const right = this.parseUnary();
      expression = this.binary(expression, operator, right);
    }
    return expression;
  }

  private parseUnary(): Expression {
    if (this.match(TokenKind.Minus, TokenKind.KwNot)) {
      const operator = this.previous();
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpression',
        operator: operator.kind === TokenKind.KwNot ? 'not' : '-',
        operand,
        range: { start: operator.range.start, end: operand.range.end },
      } satisfies UnaryExpression;
    }
    return this.parseCall();
  }

  private parseCall(): Expression {
    let expression = this.parsePrimary();

    while (true) {
      if (this.match(TokenKind.Dot)) {
        const name = this.consume(TokenKind.Identifier, "expected member name after '.'");
        expression = {
          kind: 'MemberExpression',
          object: expression,
          name: name.lexeme,
          nameRange: name.range,
          range: { start: expression.range.start, end: name.range.end },
        } satisfies MemberExpression;
        continue;
      }

      if (this.match(TokenKind.LeftParen)) {
        const args: CallArgument[] = [];
        if (!this.check(TokenKind.RightParen)) {
          do {
            args.push(this.parseCallArgument());
          } while (this.match(TokenKind.Comma));
        }
        const rightParen = this.consume(TokenKind.RightParen, "expected ')' after arguments");
        expression = {
          kind: 'CallExpression',
          callee: expression,
          args,
          range: { start: expression.range.start, end: rightParen.range.end },
        } satisfies CallExpression;
        continue;
      }

      if (this.match(TokenKind.LeftBracket)) {
        const index = this.parseExpression();
        const rightBracket = this.consume(TokenKind.RightBracket, "expected ']' after array index");
        expression = {
          kind: 'IndexExpression',
          object: expression,
          index,
          range: { start: expression.range.start, end: rightBracket.range.end },
        } satisfies IndexExpression;
        continue;
      }

      break;
    }

    return expression;
  }

  private parsePrimary(): Expression {
    if (this.checkTypeStart()) {
      const returnType = this.parseTypeName();
      if (!this.match(TokenKind.KwFunction)) {
        this.error(returnType.range, "expected 'function' after callback return type");
        return {
          kind: 'LiteralExpression',
          value: 0,
          valueType: 'int',
          range: returnType.range,
        };
      }
      return this.finishFunctionExpression(returnType);
    }

    if (this.match(TokenKind.IntLiteral)) {
      return this.literal(this.previous(), 'int');
    }
    if (this.match(TokenKind.FloatLiteral)) {
      return this.literal(this.previous(), 'float');
    }
    if (this.match(TokenKind.StringLiteral)) {
      return this.literal(this.previous(), 'string');
    }
    if (this.match(TokenKind.CharLiteral)) {
      return this.literal(this.previous(), 'char');
    }
    if (this.match(TokenKind.KwTrue, TokenKind.KwFalse)) {
      return this.literal(this.previous(), 'bool');
    }
    if (this.match(TokenKind.KwNull)) {
      return this.literal(this.previous(), 'null');
    }
    if (this.match(TokenKind.LeftBracket)) {
      const leftBracket = this.previous();
      const elements: Expression[] = [];
      if (!this.check(TokenKind.RightBracket)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenKind.Comma));
      }
      const rightBracket = this.consume(TokenKind.RightBracket, "expected ']' after array literal");
      return {
        kind: 'ArrayLiteralExpression',
        elements,
        range: { start: leftBracket.range.start, end: rightBracket.range.end },
      } satisfies ArrayLiteralExpression;
    }
    if (this.match(TokenKind.Identifier, TokenKind.KwDiv, TokenKind.KwMod, TokenKind.KwThis)) {
      const token = this.previous();
      return {
        kind: 'IdentifierExpression',
        name: token.lexeme,
        range: token.range,
      } satisfies IdentifierExpression;
    }
    if (this.match(TokenKind.LeftParen)) {
      const expression = this.parseExpression();
      const rightParen = this.consume(TokenKind.RightParen, "expected ')' after expression");
      return {
        ...expression,
        range: { start: expression.range.start, end: rightParen.range.end },
      };
    }

    const token = this.advance();
    this.error(token.range, `expected expression, got ${tokenDisplay(token.kind)}`);
    return {
      kind: 'LiteralExpression',
      value: 0,
      valueType: 'int',
      range: token.range,
    };
  }

  private finishFunctionExpression(returnType: TypeName): FunctionExpression {
    this.consume(TokenKind.LeftParen, "expected '(' after function");
    const parameters = this.parseParameterList();
    const body = this.parseBlock();
    return {
      kind: 'FunctionExpression',
      returnType,
      parameters,
      body,
      range: { start: returnType.range.start, end: body.range.end },
    };
  }

  private literal(token: Token, valueType: LiteralExpression['valueType']): LiteralExpression {
    return {
      kind: 'LiteralExpression',
      value: token.literal as string | number | boolean | null,
      valueType,
      sourceText: token.lexeme,
      range: token.range,
    };
  }

  private binary(left: Expression, operator: Token, right: Expression): BinaryExpression {
    return {
      kind: 'BinaryExpression',
      operator: this.operatorText(operator.kind),
      left,
      right,
      range: { start: left.range.start, end: right.range.end },
    };
  }

  private operatorText(kind: TokenKind): BinaryExpression['operator'] {
    switch (kind) {
      case TokenKind.Plus:
        return '+';
      case TokenKind.Minus:
        return '-';
      case TokenKind.Star:
        return '*';
      case TokenKind.Slash:
        return '/';
      case TokenKind.EqualEqual:
        return '==';
      case TokenKind.BangEqual:
        return '!=';
      case TokenKind.Less:
        return '<';
      case TokenKind.LessEqual:
        return '<=';
      case TokenKind.Greater:
        return '>';
      case TokenKind.GreaterEqual:
        return '>=';
      case TokenKind.KwAnd:
        return 'and';
      case TokenKind.KwOr:
        return 'or';
      default:
        return '+';
    }
  }

  private parseTypeName(): TypeName {
    const start = this.peek();
    if (this.match(TokenKind.KwArray, TokenKind.KwDynArray)) {
      const keyword = this.previous();
      const dynamic = keyword.kind === TokenKind.KwDynArray;
      this.consume(TokenKind.Less, "expected '<' after array type name");
      const elementType = this.parseTypeName();
      let size: number | null = null;

      if (dynamic) {
        this.consume(TokenKind.Greater, "expected '>' after dyn_array element type");
      } else {
        this.consume(TokenKind.Comma, "expected ',' after array element type");
        const sizeToken = this.consume(TokenKind.IntLiteral, 'expected array size');
        size = typeof sizeToken.literal === 'number' ? sizeToken.literal : 0;
        this.consume(TokenKind.Greater, "expected '>' after array size");
      }

      return {
        kind: 'ArrayTypeName',
        elementType,
        size,
        dynamic,
        range: { start: start.range.start, end: this.previous().range.end },
      } satisfies ArrayTypeNameNode;
    }

    if (this.checkTypeKeyword()) {
      const token = this.advance();
      return {
        kind: 'PrimitiveTypeName',
        name: this.typeNameFromToken(token.kind),
        range: token.range,
      };
    }

    const moduleToken = this.consume(TokenKind.Identifier, 'expected type name');
    if (!this.match(TokenKind.Dot)) {
      return {
        kind: 'ClassTypeName',
        name: moduleToken.lexeme,
        nameRange: moduleToken.range,
        range: moduleToken.range,
      } satisfies ClassTypeNameNode;
    }
    const nameToken = this.consume(TokenKind.Identifier, 'expected type name after module name');
    return {
      kind: 'QualifiedTypeName',
      moduleName: moduleToken.lexeme,
      moduleNameRange: moduleToken.range,
      name: nameToken.lexeme,
      nameRange: nameToken.range,
      range: { start: start.range.start, end: nameToken.range.end },
    };
  }

  private typeNameFromToken(kind: TokenKind): PrimitiveTypeName {
    switch (kind) {
      case TokenKind.KwInt:
        return 'int';
      case TokenKind.KwFloat:
        return 'float';
      case TokenKind.KwString:
        return 'string';
      case TokenKind.KwChar:
        return 'char';
      case TokenKind.KwBool:
        return 'bool';
      case TokenKind.KwVoid:
        return 'void';
      default:
        return 'void';
    }
  }

  private checkTypeKeyword(): boolean {
    return this.check(
      TokenKind.KwInt,
      TokenKind.KwFloat,
      TokenKind.KwString,
      TokenKind.KwChar,
      TokenKind.KwBool,
      TokenKind.KwVoid,
    );
  }

  private checkTypeStart(): boolean {
    return this.checkTypeKeyword()
      || this.check(TokenKind.KwArray, TokenKind.KwDynArray)
      || (
        this.check(TokenKind.Identifier)
        && this.checkNext(TokenKind.Dot)
        && this.checkAhead(2, TokenKind.Identifier)
        && (this.checkAhead(3, TokenKind.Identifier) || this.checkAhead(3, TokenKind.KwFunction))
      )
      || (
        this.check(TokenKind.Identifier)
        && (this.checkNext(TokenKind.Identifier) || this.checkNext(TokenKind.KwFunction))
      );
  }

  private parseArgumentListAfterLeftParen(): CallArgument[] {
    const args: CallArgument[] = [];
    if (!this.check(TokenKind.RightParen)) {
      do {
        args.push(this.parseCallArgument());
      } while (this.match(TokenKind.Comma));
    }
    this.consume(TokenKind.RightParen, "expected ')' after arguments");
    return args;
  }

  private parseCallArgument(): CallArgument {
    if (this.check(TokenKind.Identifier) && this.checkNext(TokenKind.Equal)) {
      const name = this.advance();
      this.consume(TokenKind.Equal, "expected '=' after argument name");
      const value = this.parseExpression();
      return {
        kind: 'CallArgument',
        name: name.lexeme,
        nameRange: name.range,
        value,
        range: { start: name.range.start, end: value.range.end },
      };
    }

    const value = this.parseExpression();
    return {
      kind: 'CallArgument',
      name: null,
      nameRange: null,
      value,
      range: value.range,
    };
  }

  private match(...kinds: TokenKind[]): boolean {
    if (!this.check(...kinds)) return false;
    this.advance();
    return true;
  }

  private consume(kind: TokenKind, message: string): Token {
    if (this.check(kind)) return this.advance();
    this.error(this.peek().range, message);
    return {
      kind,
      lexeme: '',
      literal: null,
      range: this.peek().range,
    };
  }

  private check(...kinds: TokenKind[]): boolean {
    if (this.isAtEnd()) return kinds.includes(TokenKind.EndOfFile);
    return kinds.includes(this.peek().kind);
  }

  private checkNext(kind: TokenKind): boolean {
    return this.checkAhead(1, kind);
  }

  private checkAhead(offset: number, kind: TokenKind): boolean {
    if (this.current + offset >= this.tokens.length) return false;
    return this.tokens[this.current + offset].kind === kind;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.EndOfFile;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private error(range: SourceRange, message: string): void {
    this.diagnostics.error(range, message);
  }
}
