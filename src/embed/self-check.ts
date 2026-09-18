// ─── Embed-юнит: самопроверка для конструктора ─────────────────────────────
// Конструктор не выпускает брак: перед выдачей HTML он сам гоняет проверки
// и показывает светофор. Красное — юнит сломан (решение автора не проходит,
// формула не разбирается); жёлтое — стоит подумать (заготовка уже решает
// задачу, random без сида, время в выводе).
import { Lexer } from '../core/lexer';
import { CheckOptions, Reason, UnitRunner, checkUnit, compileRules, expandTests, runUnitProgram } from './checker';
import { FormulaError } from './formula';
import { InputKind, findSurvivingMutants, probeInputKinds, testsLackFraction } from './probes';
import { UnitConfig, UnitProblem } from './unit-model';

export interface SelfCheckIssue {
  readonly severity: 'error' | 'warning' | 'ok';
  readonly code: string;
  readonly params: Readonly<Record<string, string | number>>;
  /** Вложенная причина (почему не прошёл тест) — форматируется отдельно. */
  readonly reason?: Reason | null;
  /** Готовый тест, закрывающий дыру, — конструктор добавляет его по кнопке. */
  readonly suggestTest?: readonly string[];
}

export interface SelfCheckReport {
  readonly issues: readonly SelfCheckIssue[];
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
  /** Ответы решения автора по тестам — автор видит числа рядом с тестами. */
  readonly solutionAnswers: ReadonlyArray<{ readonly input: string; readonly answer: string }>;
  /** Как решение автора читает вводы (зонд): конструктор предлагает дробные случайные для float. */
  readonly inputKinds: readonly InputKind[];
}

function usesWord(source: string, ...words: string[]): boolean {
  const lexemes = new Lexer(source, 'main.idyl').tokenize().tokens.map((token) => token.lexeme);
  return words.every((word) => lexemes.includes(word));
}

function usesCall(source: string, moduleName: string, functionName: string): boolean {
  const tokens = new Lexer(source, 'main.idyl').tokenize().tokens;
  return tokens.some((token, index) => (
    token.lexeme === moduleName && tokens[index + 1]?.lexeme === '.' && tokens[index + 2]?.lexeme === functionName
  ));
}

export async function selfCheckUnit(
  config: UnitConfig,
  configProblems: readonly UnitProblem[],
  runner: UnitRunner,
  options: CheckOptions = {},
): Promise<SelfCheckReport> {
  const issues: SelfCheckIssue[] = configProblems.map((problem) => ({
    severity: problem.severity, code: problem.code, params: problem.params,
  }));
  const solutionAnswers: Array<{ input: string; answer: string }> = [];
  let inputKinds: InputKind[] = [];
  const add = (severity: SelfCheckIssue['severity'], code: string, params: SelfCheckIssue['params'] = {}, reason: Reason | null = null): void => {
    issues.push({ severity, code, params, reason });
  };

  // Формулы разбираются?
  let formulasOk = true;
  try {
    compileRules(config);
  } catch (error) {
    formulasOk = false;
    if (error instanceof FormulaError) add('error', 'self.formula', {}, { code: error.code, params: error.params });
    else add('error', 'self.formula', {}, { code: 'formula.crashed', params: { text: String(error) } });
  }

  const hasCheck = config.check.kind !== 'none';
  if (!hasCheck) add('warning', 'self.no-check');

  // Заготовка: компилируется? (пустая — не ошибка: автор так решил)
  const sources: Array<readonly [string, string]> = [['starter', config.starter], ['solution', config.solution]];
  for (const [which, source] of sources) {
    if (source.trim() === '') continue;
    if (usesWord(source, 'random') && usesCall(source, 'random', 'set_seed') === false && /\buse\s+random\s*;/u.test(source)) {
      add('warning', 'self.random-no-seed', { which });
    }
    if (usesCall(source, 'time', 'now')) add('warning', 'self.time-now', { which });
    if (usesCall(source, 'time', 'sleep')) add('warning', 'self.time-sleep', { which });
  }

  if (hasCheck && formulasOk) {
    // Решение автора обязано пройти.
    if (config.solution.trim() === '') {
      add('warning', 'self.no-solution');
    } else {
      const report = await checkUnit(config, config.solution, runner, options);
      if (report.blocker) add('error', 'self.solution-blocked', {}, report.blocker);
      else if (report.firstFailure) {
        add('error', 'self.solution-fails', { input: report.firstFailure.input, answer: report.firstFailure.answer }, report.firstFailure.reason);
      } else {
        add('ok', 'self.solution-passes', { total: report.total });
        // Решение исправно — проверяем сами тесты: хватает ли их, чтобы поймать «почти верное» решение.
        inputKinds = await probeInputKinds(config, runner, options);
        inputKinds.forEach((kind, index) => {
          if (kind === 'float' && testsLackFraction(config, index)) add('warning', 'self.tests-no-fraction', { index: index + 1 });
        });
        for (const mutant of await findSurvivingMutants(config, inputKinds, runner, options)) {
          issues.push({
            severity: 'warning', code: 'self.mutant-survives', reason: null, suggestTest: mutant.input,
            params: { line: mutant.line, was: mutant.was, now: mutant.now, input: mutant.input.join(' ') },
          });
        }
      }
      // Ответы эталона по фиксированным тестам — чтобы автор видел числа.
      const fixedInputs = expandTests(config.tests.filter((test) => 'in' in test), config.inputs);
      for (const inputs of fixedInputs.slice(0, 20)) {
        const run = await runUnitProgram(runner, config.solution, inputs, config, options);
        solutionAnswers.push({ input: inputs.join(' '), answer: run.failure ? '—' : run.answer.replace(/\s+$/u, '') });
      }
    }
    // Заготовка НЕ должна проходить: иначе задача уже решена выданным кодом.
    if (config.starter.trim() !== '') {
      const report = await checkUnit(config, config.starter, runner, options);
      if (report.verdict === 'solved') add('warning', 'self.starter-passes');
    }
  }

  // Заготовка с ошибкой компиляции — часто замысел («допишите условие»), поэтому жёлтое.
  if (config.starter.trim() !== '') {
    const run = await runUnitProgram(runner, config.starter, [], { libs: config.libs, inputs: 'some' }, { ...options, timeoutMs: Math.min(options.timeoutMs ?? 3000, 3000) });
    if (run.failure?.code === 'run.compile') add('warning', 'self.starter-broken');
  }

  return {
    issues,
    hasErrors: issues.some((issue) => issue.severity === 'error'),
    hasWarnings: issues.some((issue) => issue.severity === 'warning'),
    solutionAnswers,
    inputKinds,
  };
}
