// ─── Embed-юнит: проверяющий ───────────────────────────────────────────────
// «Проверить» прогоняет программу ученика на наборе тестов автора и к каждому
// применяет правила (формулы / точный вывод / эталонное решение). Один ручной
// запуск вердикта не даёт: «везучий» ввод 1 1 пропускает неверную программу,
// а ветвление в одном запуске проходит одну ветку (исследование 01).
//
// Чистый модуль: исполнитель программ приходит параметром (`UnitRunner`),
// поэтому проверяющий одинаково живёт в кадре юнита, в конструкторе и в
// node-смоуках.
import { Lexer } from '../core/lexer';
import { TokenKind } from '../core/tokens';
import { CompiledFormula, FormulaError, coerceToken, compileFormula } from './formula';
import { UNIT_OUTPUT_LIMIT, UNIT_TEST_TIMEOUT_MS, UnitConfig, UnitTestSpec } from './unit-model';

export interface UnitRunRequest {
  readonly source: string;
  readonly libs: readonly string[];
  readonly console: {
    write(text: string): void;
    readLine(): Promise<string>;
    clear(): void;
  };
  readonly abortSignal: {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void): void;
    removeEventListener(type: 'abort', listener: () => void): void;
  };
}

export interface UnitRunOutcome {
  readonly success: boolean;
  /** Текст диагностик компиляции, если программа не собралась. */
  readonly compileErrors: string | null;
  readonly runtimeError: string | null;
}

export type UnitRunner = (request: UnitRunRequest) => Promise<UnitRunOutcome>;

export interface Reason {
  readonly code: string;
  readonly params: Readonly<Record<string, string | number>>;
}

export interface TranscriptItem {
  readonly kind: 'out' | 'in';
  readonly text: string;
}

export interface UnitRun {
  readonly inputs: readonly string[];
  readonly insRead: readonly string[];
  readonly transcript: readonly TranscriptItem[];
  /** Вывод без приглашений ко вводу. */
  readonly answer: string;
  readonly outs: readonly string[];
  readonly lines: readonly string[];
  readonly rawOutput: string;
  /** null — программа отработала; иначе причина словами-кодами. */
  readonly failure: Reason | null;
  readonly ms: number;
}

export interface TestResult {
  readonly index: number;
  readonly input: string;
  readonly answer: string;
  readonly passed: boolean;
  readonly reason: Reason | null;
  /** Ожидаемый ответ, если его можно назвать (точный вывод, эталон). */
  readonly expected: string | null;
}

export interface CheckReport {
  readonly verdict: 'solved' | 'failed';
  readonly passed: number;
  readonly total: number;
  readonly results: readonly TestResult[];
  readonly firstFailure: TestResult | null;
  /** Причина провала до тестов: компиляция, требования к коду, конфигурация. */
  readonly blocker: Reason | null;
}

// ─── стенограмма и ответы ──────────────────────────────────────────────────

/**
 * Ответ без приглашений: текст, висящий на текущей строке в момент чтения
 * ввода, — приглашение («Введите радиус: ») и в ответ не идёт.
 */
export function answerFromTranscript(transcript: readonly TranscriptItem[]): string {
  let answer = '';
  let pendingLine = '';
  for (const item of transcript) {
    if (item.kind === 'in') {
      pendingLine = '';
      continue;
    }
    pendingLine += item.text;
    const lastBreak = pendingLine.lastIndexOf('\n');
    if (lastBreak >= 0) {
      answer += pendingLine.slice(0, lastBreak + 1);
      pendingLine = pendingLine.slice(lastBreak + 1);
    }
  }
  return answer + pendingLine;
}

export function answerTokens(answer: string): string[] {
  return answer.split(/\s+/u).filter(Boolean);
}

export function answerLines(answer: string): string[] {
  const lines = answer.replace(/\r\n?/gu, '\n').split('\n').map((line) => line.replace(/\s+$/u, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// ─── один прогон ───────────────────────────────────────────────────────────

class InputExhausted extends Error {}
class InputForbidden extends Error {}

export interface RunLimits {
  readonly timeoutMs?: number;
  readonly outputLimit?: number;
  /**
   * Живой запуск («Запустить»): ввод спрашивается у человека, вывод сразу
   * уходит на экран, таймаута нет (ученик думает над вводом) — есть «Стоп».
   */
  readonly interactive?: {
    readLine(): Promise<string>;
    write(text: string): void;
    clear(): void;
    /** Юнит получает рубильник остановки до старта программы. */
    onStopReady(stop: () => void): void;
  };
}

export async function runUnitProgram(
  runner: UnitRunner,
  source: string,
  inputs: readonly string[],
  config: Pick<UnitConfig, 'libs' | 'inputs'>,
  limits: RunLimits = {},
): Promise<UnitRun> {
  const interactive = limits.interactive ?? null;
  const timeoutMs = limits.timeoutMs ?? (interactive ? 0 : UNIT_TEST_TIMEOUT_MS);
  const outputLimit = limits.outputLimit ?? UNIT_OUTPUT_LIMIT;
  const transcript: TranscriptItem[] = [];
  const queue = [...inputs];
  const insRead: string[] = [];
  let rawOutput = '';
  let aborted = false;
  let stopReason: 'timeout' | 'output' | 'stopped' | null = null;
  const listeners = new Set<() => void>();
  const abort = (reason: 'timeout' | 'output' | 'stopped'): void => {
    if (aborted) return;
    aborted = true;
    stopReason = reason;
    for (const listener of [...listeners]) listener();
  };
  const timer = timeoutMs > 0 ? setTimeout(() => abort('timeout'), timeoutMs) : null;
  interactive?.onStopReady(() => abort('stopped'));
  let inputProblem: 'exhausted' | 'forbidden' | null = null;
  const started = Date.now();

  let outcome: UnitRunOutcome;
  try {
    outcome = await runner({
      source,
      libs: config.libs,
      abortSignal: {
        get aborted() { return aborted; },
        addEventListener(_type, listener) { listeners.add(listener); },
        removeEventListener(_type, listener) { listeners.delete(listener); },
      },
      console: {
        write(text: string): void {
          rawOutput += text;
          transcript.push({ kind: 'out', text });
          interactive?.write(text);
          if (rawOutput.length > outputLimit) abort('output');
        },
        readLine(): Promise<string> {
          if (interactive) {
            return interactive.readLine().then((value) => {
              insRead.push(value);
              transcript.push({ kind: 'in', text: value });
              return value;
            });
          }
          if (config.inputs === 'none') {
            inputProblem = 'forbidden';
            return Promise.reject(new InputForbidden('the task has no input'));
          }
          if (queue.length === 0) {
            inputProblem = 'exhausted';
            return Promise.reject(new InputExhausted('the test has no more input'));
          }
          const value = String(queue.shift());
          insRead.push(value);
          transcript.push({ kind: 'in', text: value });
          return Promise.resolve(value);
        },
        clear(): void {
          // console.clear() стирает экран, но не историю ответа: проверяется всё выведенное.
          interactive?.clear();
        },
      },
    });
  } finally {
    if (timer !== null) clearTimeout(timer);
  }

  let failure: Reason | null = null;
  if (outcome.compileErrors !== null) {
    failure = { code: 'run.compile', params: { text: outcome.compileErrors } };
  } else if (stopReason === 'timeout') {
    failure = { code: 'run.timeout', params: { seconds: Math.round(timeoutMs / 1000) } };
  } else if (stopReason === 'stopped') {
    failure = { code: 'run.stopped', params: {} };
  } else if (stopReason === 'output') {
    failure = { code: 'run.output-limit', params: { limit: outputLimit } };
  } else if (inputProblem === 'forbidden') {
    failure = { code: 'run.input-forbidden', params: {} };
  } else if (inputProblem === 'exhausted') {
    failure = { code: 'run.input-exhausted', params: { given: inputs.length } };
  } else if (!outcome.success) {
    // Чтение не приняло ввод («2.5» в get_int) — говорим словами, а не текстом рантайма.
    const refused = /cannot convert input to '(int|float)' \(expected \w+, got ("(?:[^"\\]|\\.)*")\)/u.exec(outcome.runtimeError ?? '');
    let got = '';
    try { got = refused ? String(JSON.parse(refused[2])) : ''; } catch (_error) { got = refused ? refused[2] : ''; }
    failure = refused
      ? { code: `run.input-type-${refused[1]}`, params: { got } }
      : { code: 'run.runtime', params: { text: outcome.runtimeError ?? '' } };
  }

  const answer = answerFromTranscript(transcript);
  return {
    inputs,
    insRead,
    transcript,
    answer,
    outs: answerTokens(answer),
    lines: answerLines(answer),
    rawOutput,
    failure,
    ms: Date.now() - started,
  };
}

// ─── тесты ─────────────────────────────────────────────────────────────────

export function inputLines(spec: string | readonly string[]): string[] {
  return typeof spec === 'string' ? spec.split(/\s+/u).filter(Boolean) : spec.map((line) => String(line));
}

/** Разворачивает описание тестов во входы; случайные — через переданный генератор. */
export function expandTests(tests: readonly UnitTestSpec[], inputs: 'some' | 'none', random: () => number = Math.random): string[][] {
  if (inputs === 'none') return [[]];
  const result: string[][] = [];
  for (const test of tests) {
    if ('random' in test) {
      const [low, high] = test.range;
      for (let round = 0; round < test.times; round += 1) {
        const values: string[] = [];
        for (let index = 0; index < test.random; index += 1) {
          values.push(test.kind === 'float'
            ? (low + random() * (high - low)).toFixed(test.digits ?? 1)
            : String(low + Math.floor(random() * (high - low + 1))));
        }
        result.push(values);
      }
    } else {
      result.push(inputLines(test.in));
    }
  }
  return result.length === 0 ? [[]] : result;
}

// ─── требования к коду ─────────────────────────────────────────────────────

export function checkCodeRules(source: string, rules: UnitConfig['code']): Reason | null {
  if (rules.require.length === 0 && rules.forbid.length === 0 && Object.keys(rules.maxCalls).length === 0) return null;
  const tokens = new Lexer(source, 'main.idyl').tokenize().tokens;
  const words = new Set(tokens.map((token) => token.lexeme));
  for (const word of rules.require) {
    if (!words.has(word)) return { code: 'code.require', params: { word } };
  }
  for (const word of rules.forbid) {
    if (words.has(word)) return { code: 'code.forbid', params: { word } };
  }
  for (const [name, limit] of Object.entries(rules.maxCalls)) {
    let calls = 0;
    tokens.forEach((token, index) => {
      if (token.kind === TokenKind.Identifier && token.lexeme === name && tokens[index + 1]?.kind === TokenKind.LeftParen) calls += 1;
    });
    if (calls > limit) return { code: 'code.max-calls', params: { name, limit, got: calls } };
  }
  return null;
}

// ─── правила ───────────────────────────────────────────────────────────────

interface CompiledRule {
  readonly when: CompiledFormula | null;
  readonly expr: CompiledFormula;
}

export function compileRules(config: UnitConfig): CompiledRule[] {
  if (config.check.kind !== 'formula') return [];
  return config.check.rules.map((rule) => ({
    when: rule.when === '' ? null : compileFormula(rule.when),
    expr: compileFormula(rule.expr),
  }));
}

function formulaReason(error: unknown): Reason {
  if (error instanceof FormulaError) return { code: error.code, params: error.params };
  return { code: 'formula.crashed', params: { text: String((error as Error)?.message ?? error) } };
}

function compareToReference(run: UnitRun, reference: UnitRun, tolerance: number): Reason | null {
  if (run.outs.length !== reference.outs.length) {
    return { code: 'check.count', params: { got: run.outs.length, expected: reference.outs.length } };
  }
  for (let index = 0; index < reference.outs.length; index += 1) {
    const got = coerceToken(run.outs[index]);
    const expected = coerceToken(reference.outs[index]);
    const same = typeof got === 'number' && typeof expected === 'number'
      ? Math.abs(got - expected) <= tolerance
      : String(got) === String(expected);
    if (!same) return { code: 'check.value', params: { index: index + 1, got: run.outs[index] } };
  }
  return null;
}

function compareToExpected(run: UnitRun, expectedOutput: string): Reason | null {
  const expected = answerLines(expectedOutput);
  const got = run.lines;
  for (let index = 0; index < Math.max(expected.length, got.length); index += 1) {
    if (got[index] !== expected[index]) {
      if (got[index] === undefined) return { code: 'check.line-missing', params: { line: index + 1 } };
      if (expected[index] === undefined) return { code: 'check.line-extra', params: { line: index + 1, got: got[index] } };
      return { code: 'check.line', params: { line: index + 1, got: got[index] } };
    }
  }
  return null;
}

/** Правила одного прогона: null — сошлось; причина — не сошлось; 'unchecked' — ни одно правило не применимо. */
function judgeRun(
  run: UnitRun,
  config: UnitConfig,
  rules: readonly CompiledRule[],
  reference: UnitRun | null,
): Reason | null | 'unchecked' {
  if (run.failure) return run.failure;
  if (config.check.kind === 'expect') return compareToExpected(run, config.check.output);
  if (config.check.kind === 'reference') {
    if (!reference || reference.failure) return { code: 'check.reference-broken', params: {} };
    return compareToReference(run, reference, config.check.tolerance);
  }
  if (config.check.kind !== 'formula') return 'unchecked';
  const scope = { ins: run.insRead, outs: run.outs, lines: run.lines, output: run.answer, tolerance: config.check.tolerance };
  let applied = 0;
  for (const rule of rules) {
    try {
      if (rule.when !== null && rule.when.evaluate(scope) !== true) continue;
      applied += 1;
      if (rule.expr.evaluate(scope) !== true) return { code: 'check.rule', params: { rule: rule.expr.source } };
    } catch (error) {
      return formulaReason(error);
    }
  }
  return applied === 0 ? 'unchecked' : null;
}

export interface CheckOptions extends RunLimits {
  readonly random?: () => number;
  /** Ход проверки для интерфейса: тест index из total начат. */
  readonly onProgress?: (index: number, total: number) => void;
}

export async function checkUnit(config: UnitConfig, code: string, runner: UnitRunner, options: CheckOptions = {}): Promise<CheckReport> {
  const blocked = (blocker: Reason): CheckReport => ({ verdict: 'failed', passed: 0, total: 0, results: [], firstFailure: null, blocker });
  if (config.check.kind === 'none') return blocked({ code: 'check.none', params: {} });

  let rules: CompiledRule[];
  try {
    rules = compileRules(config);
  } catch (error) {
    return blocked(formulaReason(error));
  }
  const codeProblem = checkCodeRules(code, config.code);
  if (codeProblem) return blocked(codeProblem);

  const tests = expandTests(config.tests, config.inputs, options.random);
  const results: TestResult[] = [];
  for (let index = 0; index < tests.length; index += 1) {
    const inputs = tests[index];
    options.onProgress?.(index + 1, tests.length);
    const run = await runUnitProgram(runner, code, inputs, config, options);
    if (run.failure?.code === 'run.compile') return blocked(run.failure);
    const reference = config.check.kind === 'reference'
      ? await runUnitProgram(runner, config.solution, inputs, config, options)
      : null;
    const verdict = judgeRun(run, config, rules, reference);
    const expected = config.check.kind === 'expect'
      ? answerLines(config.check.output).join('\n')
      : reference && !reference.failure ? reference.answer.replace(/\s+$/u, '') : null;
    if (verdict === 'unchecked') continue;
    results.push({
      index: index + 1,
      input: inputs.join(' '),
      answer: run.answer.replace(/\s+$/u, ''),
      passed: verdict === null,
      reason: verdict,
      expected,
    });
    // Таймаут дорог (10 с): после него остальные тесты не гоняем.
    if (verdict !== null && verdict.code === 'run.timeout') break;
  }
  if (results.length === 0) return blocked({ code: 'check.nothing-applied', params: {} });
  const passed = results.filter((item) => item.passed).length;
  const firstFailure = results.find((item) => !item.passed) ?? null;
  return { verdict: firstFailure ? 'failed' : 'solved', passed, total: results.length, results, firstFailure, blocker: null };
}

/**
 * Мягкая подсказка после обычного запуска: сходится ли ЭТОТ запуск с условием.
 * 'unknown' — сказать нечего (нет правил, программа упала, правило не применимо).
 */
export async function judgeManualRun(config: UnitConfig, run: UnitRun, runner: UnitRunner, options: CheckOptions = {}): Promise<'matches' | 'differs' | 'unknown'> {
  if (config.check.kind === 'none' || run.failure) return 'unknown';
  try {
    const reference = config.check.kind === 'reference'
      ? await runUnitProgram(runner, config.solution, run.insRead, config, options)
      : null;
    const verdict = judgeRun(run, config, compileRules(config), reference);
    if (verdict === 'unchecked') return 'unknown';
    return verdict === null ? 'matches' : 'differs';
  } catch {
    return 'unknown';
  }
}
