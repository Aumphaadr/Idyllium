// ─── Embed-юнит: формулы проверки ──────────────────────────────────────────
// Язык формул — подмножество выражений Idyllium: and / or / not / xor,
// сравнения, арифметика, строки в кавычках, функции abs/round/mod/div/…
// плюс значения теста в фигурных скобках: {in1}, {out2}, {line1}, {outs},
// {lines}, {ins}, {output}. Свой разборщик, без eval: страницы с CSP не
// ломаются, а опечатка автора даёт ошибку словами с позицией.

export type FormulaValue = number | string | boolean;

export class FormulaError extends Error {
  constructor(
    readonly code: string,
    readonly params: Readonly<Record<string, string | number>> = {},
  ) {
    super(code);
    this.name = 'FormulaError';
  }
}

/** Значения одного прогона, к которым обращаются фигурные скобки. */
export interface FormulaScope {
  readonly ins: readonly string[];
  readonly outs: readonly string[];
  readonly lines: readonly string[];
  readonly output: string;
  readonly tolerance: number;
}

type Node =
  | { readonly type: 'literal'; readonly value: FormulaValue }
  | { readonly type: 'slot'; readonly family: 'in' | 'out' | 'line'; readonly index: number; readonly at: number }
  | { readonly type: 'count'; readonly family: 'ins' | 'outs' | 'lines' }
  | { readonly type: 'output' }
  | { readonly type: 'unary'; readonly op: 'not' | '-'; readonly operand: Node }
  | { readonly type: 'binary'; readonly op: string; readonly left: Node; readonly right: Node; readonly at: number }
  | { readonly type: 'call'; readonly name: string; readonly args: readonly Node[]; readonly at: number };

interface Tok {
  readonly kind: 'number' | 'string' | 'word' | 'slot' | 'op' | 'end';
  readonly text: string;
  readonly at: number;
}

const OPERATORS = ['==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '(', ')', ','];

function tokenize(source: string): Tok[] {
  const tokens: Tok[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/u.test(char)) { index += 1; continue; }
    if (/[0-9]/u.test(char)) {
      const match = /^[0-9]+(?:\.[0-9]+)?/u.exec(source.slice(index))!;
      tokens.push({ kind: 'number', text: match[0], at: index });
      index += match[0].length;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = index + 1;
      let value = '';
      while (end < source.length && source[end] !== char) {
        if (source[end] === '\\' && end + 1 < source.length) {
          const next = source[end + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          end += 2;
          continue;
        }
        value += source[end];
        end += 1;
      }
      if (end >= source.length) throw new FormulaError('formula.string-open', { at: index + 1 });
      tokens.push({ kind: 'string', text: value, at: index });
      index = end + 1;
      continue;
    }
    if (char === '{') {
      const end = source.indexOf('}', index);
      if (end < 0) throw new FormulaError('formula.slot-open', { at: index + 1 });
      tokens.push({ kind: 'slot', text: source.slice(index + 1, end).trim(), at: index });
      index = end + 1;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(source.slice(index))!;
      tokens.push({ kind: 'word', text: match[0], at: index });
      index += match[0].length;
      continue;
    }
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ kind: 'op', text: operator, at: index });
      index += operator.length;
      continue;
    }
    // Привычки из других языков — подсказкой, как это делает компилятор.
    if (source.startsWith('&&', index)) throw new FormulaError('formula.use-word', { at: index + 1, got: '&&', use: 'and' });
    if (source.startsWith('||', index)) throw new FormulaError('formula.use-word', { at: index + 1, got: '||', use: 'or' });
    if (char === '!') throw new FormulaError('formula.use-word', { at: index + 1, got: '!', use: 'not' });
    if (char === '=') throw new FormulaError('formula.use-word', { at: index + 1, got: '=', use: '==' });
    if (char === '%') throw new FormulaError('formula.use-word', { at: index + 1, got: '%', use: 'mod(a, b)' });
    throw new FormulaError('formula.unexpected-char', { at: index + 1, got: char });
  }
  tokens.push({ kind: 'end', text: '', at: source.length });
  return tokens;
}

const FUNCTIONS: Readonly<Record<string, readonly [number, number]>> = {
  abs: [1, 1], round: [1, 2], floor: [1, 1], ceil: [1, 1], sqrt: [1, 1], pow: [2, 2],
  min: [2, 2], max: [2, 2], mod: [2, 2], div: [2, 2],
  to_int: [1, 1], to_float: [1, 1], to_string: [1, 1],
  length: [1, 1], contains: [2, 2], lower: [1, 1], upper: [1, 1],
};

class Parser {
  private position = 0;

  constructor(private readonly tokens: readonly Tok[]) {}

  parse(): Node {
    const node = this.parseOr();
    const rest = this.peek();
    if (rest.kind !== 'end') throw new FormulaError('formula.unexpected', { at: rest.at + 1, got: rest.text });
    return node;
  }

  private peek(): Tok { return this.tokens[this.position]; }
  private take(): Tok { return this.tokens[this.position++]; }
  private isWord(text: string): boolean { const tok = this.peek(); return tok.kind === 'word' && tok.text === text; }
  private isOp(text: string): boolean { const tok = this.peek(); return tok.kind === 'op' && tok.text === text; }

  private parseOr(): Node {
    let left = this.parseXor();
    while (this.isWord('or')) {
      const at = this.take().at;
      left = { type: 'binary', op: 'or', left, right: this.parseXor(), at };
    }
    return left;
  }

  private parseXor(): Node {
    let left = this.parseAnd();
    while (this.isWord('xor')) {
      const at = this.take().at;
      left = { type: 'binary', op: 'xor', left, right: this.parseAnd(), at };
    }
    return left;
  }

  private parseAnd(): Node {
    let left = this.parseNot();
    while (this.isWord('and')) {
      const at = this.take().at;
      left = { type: 'binary', op: 'and', left, right: this.parseNot(), at };
    }
    return left;
  }

  private parseNot(): Node {
    if (this.isWord('not')) {
      this.take();
      return { type: 'unary', op: 'not', operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): Node {
    const left = this.parseSum();
    const tok = this.peek();
    if (tok.kind === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(tok.text)) {
      this.take();
      return { type: 'binary', op: tok.text, left, right: this.parseSum(), at: tok.at };
    }
    return left;
  }

  private parseSum(): Node {
    let left = this.parseProduct();
    while (this.isOp('+') || this.isOp('-')) {
      const tok = this.take();
      left = { type: 'binary', op: tok.text, left, right: this.parseProduct(), at: tok.at };
    }
    return left;
  }

  private parseProduct(): Node {
    let left = this.parseUnary();
    while (this.isOp('*') || this.isOp('/')) {
      const tok = this.take();
      left = { type: 'binary', op: tok.text, left, right: this.parseUnary(), at: tok.at };
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.isOp('-')) {
      this.take();
      return { type: 'unary', op: '-', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const tok = this.take();
    if (tok.kind === 'number') return { type: 'literal', value: Number(tok.text) };
    if (tok.kind === 'string') return { type: 'literal', value: tok.text };
    if (tok.kind === 'slot') return this.slot(tok);
    if (tok.kind === 'op' && tok.text === '(') {
      const inner = this.parseOr();
      if (!this.isOp(')')) throw new FormulaError('formula.paren-open', { at: tok.at + 1 });
      this.take();
      return inner;
    }
    if (tok.kind === 'word') {
      if (tok.text === 'true') return { type: 'literal', value: true };
      if (tok.text === 'false') return { type: 'literal', value: false };
      const arity = FUNCTIONS[tok.text];
      if (!arity) throw new FormulaError('formula.unknown-word', { at: tok.at + 1, got: tok.text });
      if (!this.isOp('(')) throw new FormulaError('formula.call-paren', { at: tok.at + 1, name: tok.text });
      this.take();
      const args: Node[] = [];
      if (!this.isOp(')')) {
        args.push(this.parseOr());
        while (this.isOp(',')) {
          this.take();
          args.push(this.parseOr());
        }
      }
      if (!this.isOp(')')) throw new FormulaError('formula.paren-open', { at: tok.at + 1 });
      this.take();
      if (args.length < arity[0] || args.length > arity[1]) {
        throw new FormulaError('formula.arity', { at: tok.at + 1, name: tok.text, got: args.length });
      }
      return { type: 'call', name: tok.text, args, at: tok.at };
    }
    if (tok.kind === 'end') throw new FormulaError('formula.ended', { at: tok.at + 1 });
    throw new FormulaError('formula.unexpected', { at: tok.at + 1, got: tok.text });
  }

  private slot(tok: Tok): Node {
    if (tok.text === 'output') return { type: 'output' };
    if (tok.text === 'ins' || tok.text === 'outs' || tok.text === 'lines') return { type: 'count', family: tok.text };
    const match = /^(in|out|line)([1-9][0-9]*)$/u.exec(tok.text);
    if (!match) throw new FormulaError('formula.slot-name', { at: tok.at + 1, got: `{${tok.text}}` });
    return { type: 'slot', family: match[1] as 'in' | 'out' | 'line', index: Number(match[2]), at: tok.at };
  }
}

export interface CompiledFormula {
  readonly source: string;
  /** Наибольшие номера, к которым обращается формула: {out3} → outs: 3. */
  readonly uses: { readonly ins: number; readonly outs: number; readonly lines: number };
  evaluate(scope: FormulaScope): FormulaValue;
}

export function compileFormula(source: string): CompiledFormula {
  const root = new Parser(tokenize(source)).parse();
  const uses = { ins: 0, outs: 0, lines: 0 };
  const walk = (node: Node): void => {
    if (node.type === 'slot') {
      const key = node.family === 'in' ? 'ins' : node.family === 'out' ? 'outs' : 'lines';
      uses[key] = Math.max(uses[key], node.index);
    } else if (node.type === 'unary') walk(node.operand);
    else if (node.type === 'binary') { walk(node.left); walk(node.right); }
    else if (node.type === 'call') node.args.forEach(walk);
  };
  walk(root);
  return { source, uses, evaluate: (scope) => evaluate(root, scope) };
}

/** Значение из вывода: похожее на число — число, иначе строка. */
export function coerceToken(token: string): FormulaValue {
  return /^[+-]?[0-9]+(?:\.[0-9]+)?$/u.test(token) ? Number(token) : token;
}

function asNumber(value: FormulaValue, at: number): number {
  if (typeof value === 'number') return value;
  throw new FormulaError('formula.not-number', { at: at + 1, got: String(value) });
}

function asBool(value: FormulaValue): boolean {
  if (typeof value === 'boolean') return value;
  throw new FormulaError('formula.not-bool', { got: String(value) });
}

function sameValue(left: FormulaValue, right: FormulaValue, tolerance: number): boolean {
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= tolerance;
  if (typeof left === 'boolean' || typeof right === 'boolean') return left === right;
  return String(left) === String(right);
}

function evaluate(node: Node, scope: FormulaScope): FormulaValue {
  switch (node.type) {
    case 'literal': return node.value;
    case 'output': return scope.output;
    case 'count': return scope[node.family].length;
    case 'slot': {
      const list = node.family === 'in' ? scope.ins : node.family === 'out' ? scope.outs : scope.lines;
      const value = list[node.index - 1];
      if (value === undefined) {
        throw new FormulaError(`formula.slot-missing-${node.family}`, { index: node.index, have: list.length });
      }
      return node.family === 'line' ? value : coerceToken(value);
    }
    case 'unary':
      return node.op === 'not' ? !asBool(evaluate(node.operand, scope)) : -asNumber(evaluate(node.operand, scope), 0);
    case 'binary': {
      if (node.op === 'and') return asBool(evaluate(node.left, scope)) && asBool(evaluate(node.right, scope));
      if (node.op === 'or') return asBool(evaluate(node.left, scope)) || asBool(evaluate(node.right, scope));
      const left = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);
      switch (node.op) {
        case 'xor': return asBool(left) !== asBool(right);
        case '==': return sameValue(left, right, scope.tolerance);
        case '!=': return !sameValue(left, right, scope.tolerance);
        case '<': return asNumber(left, node.at) < asNumber(right, node.at);
        case '<=': return asNumber(left, node.at) <= asNumber(right, node.at) + scope.tolerance;
        case '>': return asNumber(left, node.at) > asNumber(right, node.at);
        case '>=': return asNumber(left, node.at) + scope.tolerance >= asNumber(right, node.at);
        case '+': return typeof left === 'string' || typeof right === 'string' ? String(left) + String(right) : asNumber(left, node.at) + asNumber(right, node.at);
        case '-': return asNumber(left, node.at) - asNumber(right, node.at);
        case '*': return asNumber(left, node.at) * asNumber(right, node.at);
        default: {
          const divisor = asNumber(right, node.at);
          if (divisor === 0) throw new FormulaError('formula.division-by-zero', { at: node.at + 1 });
          return asNumber(left, node.at) / divisor;
        }
      }
    }
    default: {
      const args = node.args.map((arg) => evaluate(arg, scope));
      const num = (index: number): number => asNumber(args[index], node.at);
      switch (node.name) {
        case 'abs': return Math.abs(num(0));
        case 'round': {
          if (args.length === 1) return Math.round(num(0));
          const factor = Math.pow(10, num(1));
          return Math.round(num(0) * factor) / factor;
        }
        case 'floor': return Math.floor(num(0));
        case 'ceil': return Math.ceil(num(0));
        case 'sqrt': return Math.sqrt(num(0));
        case 'pow': return Math.pow(num(0), num(1));
        case 'min': return Math.min(num(0), num(1));
        case 'max': return Math.max(num(0), num(1));
        case 'mod': {
          if (num(1) === 0) throw new FormulaError('formula.division-by-zero', { at: node.at + 1 });
          return num(0) - Math.floor(num(0) / num(1)) * num(1);
        }
        case 'div': {
          if (num(1) === 0) throw new FormulaError('formula.division-by-zero', { at: node.at + 1 });
          return Math.floor(num(0) / num(1));
        }
        case 'to_int': return Math.trunc(Number(args[0]));
        case 'to_float': return Number(args[0]);
        case 'to_string': return String(args[0]);
        case 'length': return Array.from(String(args[0])).length;
        case 'contains': return String(args[0]).includes(String(args[1]));
        case 'lower': return String(args[0]).toLowerCase();
        default: return String(args[0]).toUpperCase();
      }
    }
  }
}
