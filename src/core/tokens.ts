import { SourceRange } from './diagnostics';

export enum TokenKind {
  IntLiteral = 'IntLiteral',
  FloatLiteral = 'FloatLiteral',
  StringLiteral = 'StringLiteral',
  CharLiteral = 'CharLiteral',
  Identifier = 'Identifier',

  KwUse = 'KwUse',
  KwMain = 'KwMain',
  KwFunction = 'KwFunction',
  KwInt = 'KwInt',
  KwFloat = 'KwFloat',
  KwString = 'KwString',
  KwChar = 'KwChar',
  KwBool = 'KwBool',
  KwVoid = 'KwVoid',
  KwIf = 'KwIf',
  KwElse = 'KwElse',
  KwWhile = 'KwWhile',
  KwDo = 'KwDo',
  KwFor = 'KwFor',
  KwBreak = 'KwBreak',
  KwContinue = 'KwContinue',
  KwReturn = 'KwReturn',
  KwConst = 'KwConst',
  KwAnd = 'KwAnd',
  KwOr = 'KwOr',
  KwNot = 'KwNot',
  KwTrue = 'KwTrue',
  KwFalse = 'KwFalse',
  KwNull = 'KwNull',
  KwDiv = 'KwDiv',
  KwMod = 'KwMod',
  KwArray = 'KwArray',
  KwDynArray = 'KwDynArray',
  KwClass = 'KwClass',
  KwConstructor = 'KwConstructor',
  KwThis = 'KwThis',
  KwStatic = 'KwStatic',
  KwExtends = 'KwExtends',
  KwPrivate = 'KwPrivate',
  KwPublic = 'KwPublic',
  KwDestructor = 'KwDestructor',

  LeftParen = 'LeftParen',
  RightParen = 'RightParen',
  LeftBrace = 'LeftBrace',
  RightBrace = 'RightBrace',
  LeftBracket = 'LeftBracket',
  RightBracket = 'RightBracket',
  Comma = 'Comma',
  Semicolon = 'Semicolon',
  Dot = 'Dot',
  Colon = 'Colon',
  Tilde = 'Tilde',

  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Equal = 'Equal',
  PlusEqual = 'PlusEqual',
  MinusEqual = 'MinusEqual',
  StarEqual = 'StarEqual',
  SlashEqual = 'SlashEqual',
  EqualEqual = 'EqualEqual',
  BangEqual = 'BangEqual',
  Less = 'Less',
  LessEqual = 'LessEqual',
  Greater = 'Greater',
  GreaterEqual = 'GreaterEqual',

  EndOfFile = 'EndOfFile',
  Bad = 'Bad',
}

export interface Token {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly literal: string | number | boolean | null;
  readonly range: SourceRange;
}

export const KEYWORDS: Readonly<Record<string, TokenKind>> = {
  use: TokenKind.KwUse,
  main: TokenKind.KwMain,
  function: TokenKind.KwFunction,
  int: TokenKind.KwInt,
  float: TokenKind.KwFloat,
  string: TokenKind.KwString,
  char: TokenKind.KwChar,
  bool: TokenKind.KwBool,
  void: TokenKind.KwVoid,
  if: TokenKind.KwIf,
  else: TokenKind.KwElse,
  while: TokenKind.KwWhile,
  do: TokenKind.KwDo,
  for: TokenKind.KwFor,
  break: TokenKind.KwBreak,
  continue: TokenKind.KwContinue,
  return: TokenKind.KwReturn,
  const: TokenKind.KwConst,
  and: TokenKind.KwAnd,
  or: TokenKind.KwOr,
  not: TokenKind.KwNot,
  true: TokenKind.KwTrue,
  false: TokenKind.KwFalse,
  null: TokenKind.KwNull,
  div: TokenKind.KwDiv,
  mod: TokenKind.KwMod,
  array: TokenKind.KwArray,
  dyn_array: TokenKind.KwDynArray,
  class: TokenKind.KwClass,
  constructor: TokenKind.KwConstructor,
  this: TokenKind.KwThis,
  static: TokenKind.KwStatic,
  extends: TokenKind.KwExtends,
  private: TokenKind.KwPrivate,
  public: TokenKind.KwPublic,
  destructor: TokenKind.KwDestructor,
};

export function tokenDisplay(kind: TokenKind): string {
  switch (kind) {
    case TokenKind.IntLiteral:
      return 'integer';
    case TokenKind.FloatLiteral:
      return 'float';
    case TokenKind.StringLiteral:
      return 'string';
    case TokenKind.CharLiteral:
      return 'char';
    case TokenKind.Identifier:
      return 'identifier';
    case TokenKind.EndOfFile:
      return 'end of file';
    default:
      return `'${kind}'`;
  }
}
