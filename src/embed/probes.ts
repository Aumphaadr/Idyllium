// ─── Embed-юнит: зонды конструктора ────────────────────────────────────────
// Проверяющий честно гоняет тесты автора — и потому силён ровно настолько,
// насколько сильны тесты. Зонды усиливают ТЕСТЫ, а не движок:
//   1) зонд типов — какие вводы решение автора читает как int / float / string;
//   2) пробные мутанты — решение автора слегка портится (`>=` → `>`, `0` → `-1`,
//      «двойник на целых» `>= 0` → `> -1`); мутант, прошедший проверку, — дыра
//      в тестах. Сообщаем только о дырах, для которых нашёлся различающий ввод:
//      так отсекаются мутанты-эквиваленты, а автор получает готовый тест.
// Всё это — советы (жёлтое): выдачу кода они не блокируют.
import { Lexer } from '../core/lexer';
import { Token, TokenKind } from '../core/tokens';
import { CheckOptions, UnitRunner, checkUnit, expandTests, inputLines, runUnitProgram } from './checker';
import { UnitConfig } from './unit-model';

export type InputKind = 'int' | 'float' | 'string';

export interface SurvivingMutant {
  readonly line: number;
  /** Строка решения до и после порчи — словами автора. */
  readonly was: string;
  readonly now: string;
  /** Ввод, на котором решение и мутант расходятся, а решение проходит проверку. */
  readonly input: readonly string[];
}

const MAX_PROBED_INPUTS = 8;
const MAX_MUTANTS = 40;
const MAX_REPORTED = 3;
const MUTANT_TIMEOUT_MS = 1000;
const BUDGET_MS = 5000;

/** Один и тот же ряд «случайных» чисел для каждого мутанта: совет не мигает от запуска к запуску. */
function seededRandom(): () => number {
  let state = 0x1d711;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function baseInputs(config: UnitConfig): string[] {
  return expandTests(config.tests, config.inputs, seededRandom())[0] ?? [];
}

/** Подменяем i-й ввод на «0.5» и на «абв» и смотрим, отказалось ли чтение. */
export async function probeInputKinds(config: UnitConfig, runner: UnitRunner, options: CheckOptions = {}): Promise<InputKind[]> {
  if (config.inputs === 'none' || config.solution.trim() === '') return [];
  const base = baseInputs(config);
  const limits = { ...options, timeoutMs: MUTANT_TIMEOUT_MS, interactive: undefined };
  const plain = await runUnitProgram(runner, config.solution, base, config, limits);
  const count = Math.min(plain.insRead.length, base.length, MAX_PROBED_INPUTS);
  const kinds: InputKind[] = [];
  for (let index = 0; index < count; index += 1) {
    const failureWith = async (value: string): Promise<string> => {
      const inputs = base.slice();
      inputs[index] = value;
      return (await runUnitProgram(runner, config.solution, inputs, config, limits)).failure?.code ?? '';
    };
    if (await failureWith('0.5') === 'run.input-type-int') kinds.push('int');
    else if (await failureWith('абв') === 'run.input-type-float') kinds.push('float');
    else kinds.push('string');
  }
  return kinds;
}

/** Вводы №index во всех тестах целые? (Дробные случайные считаются дробными.) */
export function testsLackFraction(config: UnitConfig, index: number): boolean {
  let seen = false;
  for (const test of config.tests) {
    if ('random' in test) {
      if (index >= test.random) continue;
      seen = true;
      if (test.kind === 'float') return false;
    } else {
      const value = inputLines(test.in)[index];
      if (value === undefined) continue;
      seen = true;
      if (/\.\d*[1-9]/u.test(value)) return false;
    }
  }
  return seen;
}

// ─── мутанты ───────────────────────────────────────────────────────────────

interface Mutant {
  readonly line: number;
  readonly was: string;
  readonly now: string;
  readonly source: string;
  /** Числа, около которых стоит искать различающий ввод. */
  readonly around: readonly number[];
}

const SWAP: Readonly<Record<string, string>> = { '>=': '>', '>': '>=', '<=': '<', '<': '<=', '==': '!=', '!=': '==' };
// «Двойник на целых»: на целых числах неотличим от оригинала, на дробных — отличим.
const TWIN_RIGHT: Readonly<Record<string, readonly [string, number]>> = { '>=': ['>', -1], '>': ['>=', 1], '<=': ['<', 1], '<': ['<=', -1] };
const TWIN_LEFT: Readonly<Record<string, readonly [string, number]>> = { '<=': ['<', -1], '<': ['<=', 1], '>=': ['>', 1], '>': ['>=', -1] };
const COMPARISONS = new Set<TokenKind>([
  TokenKind.Greater, TokenKind.GreaterEqual, TokenKind.Less, TokenKind.LessEqual, TokenKind.EqualEqual, TokenKind.BangEqual,
]);

function buildMutants(source: string, withTwins: boolean): Mutant[] {
  const tokens = new Lexer(source, 'main.idyl').tokenize().tokens;
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) if (source[index] === '\n') lineStarts.push(index + 1);
  const startOf = (token: Token): number => lineStarts[token.range.start.line - 1] + token.range.start.column - 1;
  const endOf = (token: Token): number => startOf(token) + token.lexeme.length;
  const lineText = (text: string, line: number): string => (text.split('\n')[line - 1] ?? '').trim();
  const result: Mutant[] = [];
  // Порча записывается дважды: «красиво» для показа автору и со скобками для компилятора (`> (-1)`).
  const push = (line: number, from: number, to: number, pretty: string, safe: string, around: readonly number[]): void => {
    if (result.length >= MAX_MUTANTS) return;
    const shown = source.slice(0, from) + pretty + source.slice(to);
    result.push({ line, was: lineText(source, line), now: lineText(shown, line), source: source.slice(0, from) + safe + source.slice(to), around });
  };
  const safeNumber = (value: number): string => (value < 0 ? `(${value})` : String(value));

  tokens.forEach((token, index) => {
    if (!COMPARISONS.has(token.kind)) return;
    const op = token.lexeme;
    const line = token.range.start.line;
    // Число справа: `x >= 0`, `x > -1`.
    const minus = tokens[index + 1]?.kind === TokenKind.Minus && tokens[index + 2]?.kind === TokenKind.IntLiteral;
    const rightToken = minus ? tokens[index + 2] : tokens[index + 1];
    const right = rightToken?.kind === TokenKind.IntLiteral ? (minus ? -1 : 1) * Number(rightToken.lexeme) : null;
    // Число слева: `0 <= x`.
    const leftToken = tokens[index - 1];
    const left = right === null && leftToken?.kind === TokenKind.IntLiteral ? Number(leftToken.lexeme) : null;
    const anchor = right ?? left;
    const near = anchor === null ? [] : [anchor, anchor - 1, anchor + 1, anchor - 0.5, anchor + 0.5];

    push(line, startOf(token), endOf(token), SWAP[op], SWAP[op], near);
    if (right !== null && Number.isSafeInteger(right)) {
      const from = startOf(tokens[index + 1]);
      const to = endOf(rightToken);
      for (const delta of [-1, 1]) push(line, from, to, String(right + delta), safeNumber(right + delta), near);
      if (withTwins && TWIN_RIGHT[op]) {
        const [twinOp, delta] = TWIN_RIGHT[op];
        push(line, startOf(token), to, `${twinOp} ${right + delta}`, `${twinOp} ${safeNumber(right + delta)}`, near);
      }
    } else if (left !== null && Number.isSafeInteger(left)) {
      for (const delta of [-1, 1]) if (left + delta >= 0) push(line, startOf(leftToken), endOf(leftToken), String(left + delta), String(left + delta), near);
      if (withTwins && TWIN_LEFT[op] && left + TWIN_LEFT[op][1] >= 0) {
        const [twinOp, delta] = TWIN_LEFT[op];
        push(line, startOf(leftToken), endOf(token), `${left + delta} ${twinOp}`, `${left + delta} ${twinOp}`, near);
      }
    }
  });
  return result;
}

/** Вводы-кандидаты: одно значение подменено числом «около границы» либо все числа сделаны равными. */
function candidateInputs(base: readonly string[], kinds: readonly InputKind[], around: readonly number[]): string[][] {
  const result: string[][] = [];
  const seen = new Set<string>();
  const offer = (inputs: string[]): void => {
    const key = inputs.join(' ');
    if (!seen.has(key) && key !== base.join(' ')) { seen.add(key); result.push(inputs); }
  };
  const fits = (value: number, kind: InputKind | undefined): boolean => kind === 'float' || (kind === 'int' && Number.isInteger(value));
  for (const value of around) {
    base.forEach((_item, index) => {
      if (!fits(value, kinds[index])) return;
      const inputs = base.slice();
      inputs[index] = String(value);
      offer(inputs);
    });
  }
  const numeric = base.map((_item, index) => kinds[index] === 'int' || kinds[index] === 'float');
  if (numeric.filter(Boolean).length >= 2) {
    const values = [...around, ...base.filter((_item, index) => numeric[index]).map(Number)].filter((value) => Number.isFinite(value));
    for (const value of values) {
      if (base.some((_item, index) => numeric[index] && !fits(value, kinds[index]))) continue;
      offer(base.map((item, index) => (numeric[index] ? String(value) : item)));
    }
  }
  return result.slice(0, 24);
}

/**
 * Мутанты решения автора, которых нынешние тесты не ловят, — вместе с вводом,
 * который их ловит. Звать только когда само решение проверку проходит.
 */
export async function findSurvivingMutants(
  config: UnitConfig,
  kinds: readonly InputKind[],
  runner: UnitRunner,
  options: CheckOptions = {},
): Promise<SurvivingMutant[]> {
  if (config.inputs === 'none' || config.check.kind === 'none' || config.solution.trim() === '') return [];
  const deadline = Date.now() + BUDGET_MS;
  const limits = { ...options, timeoutMs: MUTANT_TIMEOUT_MS, interactive: undefined, onProgress: undefined };
  const verdict = async (unit: UnitConfig, code: string): Promise<'solved' | 'failed'> => (
    (await checkUnit(unit, code, runner, { ...limits, random: seededRandom() })).verdict
  );
  const base = baseInputs(config);
  const found: SurvivingMutant[] = [];
  const accepted: Array<{ in: string[] }> = [];

  for (const mutant of buildMutants(config.solution, kinds.includes('float'))) {
    if (found.length >= MAX_REPORTED || Date.now() > deadline) break;
    if (await verdict(config, mutant.source) === 'failed') continue;               // тесты его ловят
    if (accepted.length > 0 && await verdict({ ...config, tests: accepted }, mutant.source) === 'failed') continue; // уже предложенный тест ловит
    for (const inputs of candidateInputs(base, kinds, mutant.around)) {
      if (Date.now() > deadline) break;
      const single: UnitConfig = { ...config, tests: [{ in: inputs }] };
      if (await verdict(single, mutant.source) === 'solved') continue;
      if (await verdict(single, config.solution) === 'failed') continue;           // тест, на котором падает и оригинал, — не тест
      accepted.push({ in: inputs });
      found.push({ line: mutant.line, was: mutant.was, now: mutant.now, input: inputs });
      break;
    }
  }
  return found;
}
