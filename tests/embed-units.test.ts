// Смоук embed-юнитов (1.6.0): модель, формулы, проверяющий, самопроверка,
// выдача HTML. Три примера владельца — прямоугольник, круг, цикл — и
// «везучее» решение, ради которого проверка идёт набором тестов.
import { createUnitRunner, embed } from '../src/browser';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const RECT_GOOD = `use console;
main() {
    console.write("Ширина: ");
    int w = console.get_int();
    console.write("Высота: ");
    int h = console.get_int();
    console.writeln((w + h) * 2);
    console.writeln(w * h);
}`;
const RECT_LUCKY = `use console;
main() {
    int w = console.get_int();
    int h = console.get_int();
    console.writeln(w * 4);
    console.writeln(w * w);
}`;
const CIRCLE_GOOD = `use console;
main() {
    console.write("Введите радиус круга: ");
    int R = console.get_int();
    if (R >= 0) {
        console.writeln(3.14 * R * R);
    }
    else {
        console.writeln("Ошибка");
    }
}`;
const CIRCLE_ONE_BRANCH = `use console;
main() {
    int R = console.get_int();
    console.writeln(3.14 * R * R);
}`;
const LOOP_STARTER = `use console;

main() {
    for (int i = ; i < ; i = i + 1) {
        console.writeln(i);
    }
}`;
const LOOP_GOOD = `use console;
main() {
    for (int i = 10; i < 16; i = i + 1) {
        console.writeln(i);
    }
}`;
const LOOP_CHEAT = `use console;
main() {
    console.writeln(10);
    console.writeln(11);
    console.writeln(12);
    console.writeln(13);
    console.writeln(14);
    console.writeln(15);
}`;

const tests: Array<readonly [string, () => Promise<void> | void]> = [];
const test = (name: string, body: () => Promise<void> | void): void => { tests.push([name, body]); };

const runner = createUnitRunner();
const rectConfig = embed.normalizeUnitConfig({
  id: 'rect',
  title: 'Прямоугольник',
  tests: [{ in: '1 1' }, { in: '3 5' }, { in: '10 2' }, { random: 2, range: [1, 100], times: 4 }],
  check: { kind: 'formula', rules: [{ when: '', expr: '{out1} == ({in1} + {in2}) * 2 and {out2} == {in1} * {in2} and {outs} == 2' }] },
  solution: RECT_GOOD,
}).config;

test('formulas speak Idyllium and refuse foreign habits in words', () => {
  const scope = { ins: ['3', '5'], outs: ['16', '15', 'Ошибка'], lines: ['16', '15 Ошибка'], output: '16\n15 Ошибка\n', tolerance: 1e-6 };
  const value = (source: string) => embed.compileFormula(source).evaluate(scope);
  assert(value('{out1} == ({in1} + {in2}) * 2 and {out2} == {in1} * {in2}') === true, 'rectangle formula');
  assert(value('abs({out1} - 3.14 * {in1} * {in1}) < 100 and not ({outs} == 2)') === true, 'abs / not');
  assert(value('{out3} == "Ошибка" or false') === true, 'string comparison');
  assert(value('{line2} == "15 Ошибка" and {lines} == 2 and {ins} == 2') === true, 'lines and counts');
  assert(value('mod({out1}, 5) == 1 and div({out1}, 5) == 3 and round(3.14159, 2) == 3.14') === true, 'functions');
  assert(value('contains({output}, "Ошибка") and length("кот") == 3 and upper("a") == "A"') === true, 'string functions');
  assert(value('0.1 + 0.2 == 0.3') === true, 'float tolerance');
  assert(embed.compileFormula('{out3} == 1 and {in2} > 0').uses.outs === 3, 'uses.outs');
  const refuses = (source: string, code: string): void => {
    try {
      embed.compileFormula(source).evaluate(scope);
    } catch (error) {
      assert(error instanceof embed.FormulaError && error.code === code, `${source}: expected ${code}, got ${(error as Error).message}`);
      return;
    }
    throw new Error(`${source}: expected refusal ${code}`);
  };
  refuses('{out1} == 1 && {out2} == 2', 'formula.use-word');
  refuses('{out1} = 1', 'formula.use-word');
  refuses('{result} == 1', 'formula.slot-name');
  refuses('{out9} == 1', 'formula.slot-missing-out');
  refuses('sin({out1}) == 1', 'formula.unknown-word');
  refuses('({out1} == 1', 'formula.paren-open');
  refuses('{out3} < 5', 'formula.not-number');
  assert(embed.unitText('ru', 'formula.slot-missing-out', { index: 9, have: 3 }) === 'В ответе нет значения {out9}: программа вывела значений — 3.', 'nested placeholder text');
});

test('prompts before input never reach the answer', () => {
  const answer = embed.answerFromTranscript([
    { kind: 'out', text: 'Калькулятор\n' },
    { kind: 'out', text: 'Введите ' },
    { kind: 'out', text: 'радиус: ' },
    { kind: 'in', text: '2' },
    { kind: 'out', text: '12.56\n' },
  ]);
  assert(answer === 'Калькулятор\n12.56\n', `answer: ${JSON.stringify(answer)}`);
  assert(JSON.stringify(embed.answerLines('10 \n11\n\n')) === '["10","11"]', 'lines trim trailing blanks');
});

test('rectangle: the good solution passes, the lucky one is caught', async () => {
  const good = await embed.checkUnit(rectConfig, RECT_GOOD, runner);
  assert(good.verdict === 'solved' && good.total === 7 && good.passed === 7, `good: ${JSON.stringify(good)}`);
  const lucky = await embed.checkUnit(rectConfig, RECT_LUCKY, runner);
  assert(lucky.verdict === 'failed' && lucky.firstFailure?.input === '3 5' && lucky.firstFailure.answer === '12\n9', `lucky: ${JSON.stringify(lucky.firstFailure)}`);
  assert(lucky.results[0].passed, 'the lucky input 1 1 passes — that is the whole point');
  assert(embed.reasonText('ru', lucky.firstFailure.reason).startsWith('Не выполнено условие:'), 'reason text');
});

test('circle: both branches are checked through "when" rules', async () => {
  const config = embed.normalizeUnitConfig({
    id: 'circle',
    tests: [{ in: '2' }, { in: '0' }, { in: '-3' }],
    check: { kind: 'formula', rules: [
      { when: '{in1} >= 0', expr: 'abs({out1} - 3.14 * {in1} * {in1}) < 0.001' },
      { when: '{in1} < 0', expr: '{out1} == "Ошибка"' },
    ] },
  }).config;
  const good = await embed.checkUnit(config, CIRCLE_GOOD, runner);
  assert(good.verdict === 'solved' && good.total === 3, `good circle: ${JSON.stringify(good)}`);
  const half = await embed.checkUnit(config, CIRCLE_ONE_BRANCH, runner);
  assert(half.verdict === 'failed' && half.firstFailure?.input === '-3', `one-branch circle: ${JSON.stringify(half.firstFailure)}`);
});

test('loop: exact output, no input, and code rules catch six writelns', async () => {
  const config = embed.normalizeUnitConfig({
    id: 'loop', inputs: 'none', starter: LOOP_STARTER,
    check: { kind: 'expect', output: '10\n11\n12\n13\n14\n15' },
    code: { require: ['for'], maxCalls: { writeln: 1 } },
  }).config;
  const good = await embed.checkUnit(config, LOOP_GOOD, runner);
  assert(good.verdict === 'solved' && good.total === 1, `loop: ${JSON.stringify(good)}`);
  const cheat = await embed.checkUnit(config, LOOP_CHEAT, runner);
  assert(cheat.blocker?.code === 'code.require', `cheat blocker: ${JSON.stringify(cheat.blocker)}`);
  const broken = await embed.checkUnit(config, LOOP_STARTER, runner);
  assert(broken.blocker?.code === 'run.compile', `starter must not compile: ${JSON.stringify(broken.blocker)}`);
  const reads = await embed.checkUnit(config, 'use console;\nmain() {\n    for (int i = 0; i < 1; i = i + 1) { int x = console.get_int(); }\n}', runner);
  assert(reads.firstFailure?.reason?.code === 'run.input-forbidden', `reading without input: ${JSON.stringify(reads.firstFailure)}`);
});

test('editor.format (the Format button) defaults to on and travels in both embed forms', () => {
  const base = { format: 1, id: 'a', check: { kind: 'none' } };
  assert(embed.normalizeUnitConfig(base).config.editor.format === true, 'default');
  const off = embed.normalizeUnitConfig({ ...base, editor: { format: false } }).config;
  assert(off.editor.format === false, 'explicit off');
  assert((embed.decodeUnitFromHash(embed.encodeUnitForHash(embed.publicUnitConfig(off))) as { editor: { format: boolean } }).editor.format === false, 'iframe-only form carries it');
  assert(embed.renderUnitMarkup(off, 'https://example.org/').includes('"format": false'), 'full form carries it');
});

test('editor.autocomplete defaults to on and survives normalization only as a boolean', () => {
  const base = { format: 1, id: 'a', check: { kind: 'none' } };
  assert(embed.normalizeUnitConfig(base).config.editor.autocomplete === true, 'default');
  assert(embed.normalizeUnitConfig({ ...base, editor: { autocomplete: false } }).config.editor.autocomplete === false, 'explicit off');
  assert(embed.normalizeUnitConfig({ ...base, editor: { autocomplete: 'no' } }).config.editor.autocomplete === true, 'anything but false is on');
  const packed = embed.encodeUnitForHash(embed.publicUnitConfig(embed.normalizeUnitConfig({ ...base, editor: { autocomplete: false } }).config));
  assert((embed.decodeUnitFromHash(packed) as { editor: { autocomplete: boolean } }).editor.autocomplete === false, 'the iframe-only form carries the setting');
});

const CIRCLE_SOLUTION = 'use console;\n\nmain() {\n    float R = console.get_float();\n    if (R >= 0) {\n        console.writeln(3.14 * R * R);\n    } else {\n        console.writeln("Ошибка");\n    }\n}\n';
const CIRCLE_UNIT = {
  format: 1, id: 'circle', solution: CIRCLE_SOLUTION,
  tests: [{ in: '2' }, { in: '0' }, { in: '-3' }, { random: 1, range: [-50, 50], times: 4 }],
  check: { kind: 'formula', rules: [
    { when: '{in1} >= 0', expr: 'abs({out1} - 3.14 * {in1} * {in1}) < 0.001' },
    { when: '{in1} < 0', expr: '{out1} == "Ошибка"' },
  ] },
};

test('probes: integer-only tests let "R > -1" through; the self-check finds the hole and the test that closes it', async () => {
  const runner = createUnitRunner();
  const weak = embed.normalizeUnitConfig(CIRCLE_UNIT);
  const almost = CIRCLE_SOLUTION.replace('R >= 0', 'R > -1');
  assert((await embed.checkUnit(weak.config, almost, runner)).verdict === 'solved', 'the owner\'s case: integer tests cannot tell the two apart');

  const report = await embed.selfCheckUnit(weak.config, weak.problems, runner);
  assert(JSON.stringify(report.inputKinds) === '["float"]', `input kinds probed from the solution: ${JSON.stringify(report.inputKinds)}`);
  assert(report.issues.some((issue) => issue.code === 'self.tests-no-fraction'), 'float input with integer-only tests is a warning');
  const holes = report.issues.filter((issue) => issue.code === 'self.mutant-survives');
  assert(holes.some((issue) => String(issue.params.now).includes('R > -1') && issue.suggestTest?.join(' ') === '-0.5'), `the twin mutant is reported with a fractional test: ${JSON.stringify(holes.map((issue) => issue.params))}`);
  assert(!report.hasErrors, 'probes never block the author');

  const strong = embed.normalizeUnitConfig({ ...CIRCLE_UNIT, tests: [...CIRCLE_UNIT.tests, ...holes.map((issue) => ({ in: [...(issue.suggestTest ?? [])] }))] });
  const after = await embed.selfCheckUnit(strong.config, strong.problems, runner);
  assert(!after.issues.some((issue) => issue.severity === 'warning'), `suggested tests close every hole: ${JSON.stringify(after.issues)}`);
  assert((await embed.checkUnit(strong.config, almost, runner)).verdict === 'failed', '"R > -1" no longer passes');

  // Ученик, прочитавший радиус через get_int, слышит причину словами, а не текстом рантайма.
  const viaInt = await embed.checkUnit(strong.config, CIRCLE_SOLUTION.replace('float R = console.get_float()', 'int R = console.get_int()'), runner);
  assert(viaInt.firstFailure?.reason?.code === 'run.input-type-int', `input refused by get_int has its own reason: ${JSON.stringify(viaInt.firstFailure?.reason)}`);
  assert(embed.reasonText('ru', viaInt.firstFailure?.reason).includes('ждала целое число, а во вводе было «-0.5»'), 'and says it in words');
});

test('probes: no false alarms on equivalent mutants; fractional random tests', async () => {
  const runner = createUnitRunner();
  const max = embed.normalizeUnitConfig({
    format: 1, id: 'max', tests: [{ in: '3 5' }, { in: '9 4' }], check: { kind: 'reference' },
    solution: 'use console;\nmain() {\n    int a = console.get_int();\n    int b = console.get_int();\n    if (a > b) {\n        console.writeln(a);\n    } else {\n        console.writeln(b);\n    }\n}\n',
  });
  const report = await embed.selfCheckUnit(max.config, max.problems, runner);
  assert(JSON.stringify(report.inputKinds) === '["int","int"]', 'both inputs are read as int');
  assert(!report.issues.some((issue) => issue.severity === 'warning'), `"a > b" vs "a >= b" print the same — silence: ${JSON.stringify(report.issues)}`);

  const floats = embed.normalizeUnitConfig({ format: 1, id: 'f', check: { kind: 'none' }, tests: [{ random: 2, range: [-1, 1], times: 3, kind: 'float', digits: 2 }, { random: 1, range: [1, 9], times: 1 }] });
  assert(floats.problems.every((problem) => problem.severity !== 'error'), 'a float random test is a valid test');
  const expanded = embed.expandTests(floats.config.tests, 'some');
  assert(expanded.length === 4 && expanded.slice(0, 3).every((inputs) => inputs.length === 2 && inputs.every((value) => /^-?\d\.\d\d$/u.test(value))), `two decimals each: ${JSON.stringify(expanded)}`);
  assert(/^\d$/u.test(expanded[3][0]), 'a test without "kind" stays integer');
  assert(embed.normalizeUnitConfig({ format: 1, id: 'f', check: { kind: 'none' }, tests: [{ random: 1, range: [0.5, 2], times: 1 }] }).problems.some((problem) => problem.code === 'config.test-range'), 'an integer test still refuses a fractional range');
});

test('reference mode compares answers, limits stop runaway programs, libraries are fenced', async () => {
  const config = embed.normalizeUnitConfig({
    id: 'ref', tests: [{ in: '2 3' }, { random: 2, range: [1, 50], times: 3 }],
    check: { kind: 'reference' }, solution: RECT_GOOD,
  }).config;
  const good = await embed.checkUnit(config, 'use console;\nmain() {\n    int a = console.get_int();\n    int b = console.get_int();\n    console.writeln(2 * a + 2 * b);\n    console.writeln(b * a);\n}', runner);
  assert(good.verdict === 'solved' && good.total === 4, `reference: ${JSON.stringify(good)}`);
  const wrong = await embed.checkUnit(config, RECT_LUCKY, runner);
  assert(wrong.firstFailure?.reason?.code === 'check.value' && wrong.firstFailure.expected === '10\n6', `reference mismatch: ${JSON.stringify(wrong.firstFailure)}`);

  const forever = await embed.runUnitProgram(runner, 'use console;\nmain() {\n    while (true) { }\n}', [], config, { timeoutMs: 300 });
  assert(forever.failure?.code === 'run.timeout', `timeout: ${JSON.stringify(forever.failure)}`);
  const flood = await embed.runUnitProgram(runner, 'use console;\nmain() {\n    while (true) { console.writeln("спам"); }\n}', [], config, { outputLimit: 2000 });
  assert(flood.failure?.code === 'run.output-limit', `flood: ${JSON.stringify(flood.failure)}`);
  const hungry = await embed.runUnitProgram(runner, RECT_GOOD, ['5'], config);
  assert(hungry.failure?.code === 'run.input-exhausted', `hungry: ${JSON.stringify(hungry.failure)}`);
  const gui = await embed.runUnitProgram(runner, 'use gui;\nmain() {\n    gui.Window w;\n}', [], config);
  assert(gui.failure?.code === 'run.compile' && String(gui.failure.params.text).includes("library 'gui' is not available in this unit"), `gui fence: ${JSON.stringify(gui.failure)}`);
  const narrow = await embed.runUnitProgram(runner, 'use math;\nmain() {\n}', [], { libs: ['console'], inputs: 'some' });
  assert(String(narrow.failure?.params.text).includes("library 'math' is not available"), 'author-narrowed libraries');
  // time.sleep в юните живой (вердикт владельца): короткая пауза просто проходит.
  const sleepy = await embed.runUnitProgram(runner, 'use console;\nuse time;\nmain() {\n    time.sleep(0.05);\n    console.writeln("проснулся");\n}', [], config);
  assert(sleepy.failure === null && sleepy.ms >= 40, `sleep is real: ${JSON.stringify(sleepy.failure)} ${sleepy.ms}ms`);
});

test('manual run gets a soft hint, not a verdict', async () => {
  const run = await embed.runUnitProgram(runner, RECT_LUCKY, ['1', '1'], rectConfig);
  assert(await embed.judgeManualRun(rectConfig, run, runner) === 'matches', 'lucky input matches this run');
  const other = await embed.runUnitProgram(runner, RECT_LUCKY, ['3', '5'], rectConfig);
  assert(await embed.judgeManualRun(rectConfig, other, runner) === 'differs', 'other input differs');
});

test('self-check is a traffic light for the author', async () => {
  const ok = await embed.selfCheckUnit(rectConfig, [], runner);
  assert(!ok.hasErrors && ok.issues.some((issue) => issue.code === 'self.solution-passes'), `self-check ok: ${JSON.stringify(ok.issues)}`);
  assert(ok.solutionAnswers[1].input === '3 5' && ok.solutionAnswers[1].answer === '16\n15', `solution answers: ${JSON.stringify(ok.solutionAnswers)}`);

  const typo = embed.normalizeUnitConfig({ ...rectConfig, check: { kind: 'formula', rules: [{ when: '', expr: '{out1} == ({in1} + {in2}) * 3' }] } });
  const red = await embed.selfCheckUnit(typo.config, typo.problems, runner);
  assert(red.hasErrors && red.issues.some((issue) => issue.code === 'self.solution-fails'), `typo in formula must be red: ${JSON.stringify(red.issues)}`);

  const solved = embed.normalizeUnitConfig({ ...rectConfig, starter: RECT_GOOD });
  const yellow = await embed.selfCheckUnit(solved.config, solved.problems, runner);
  assert(yellow.issues.some((issue) => issue.code === 'self.starter-passes'), 'starter that already passes is yellow');

  const dice = embed.normalizeUnitConfig({ id: 'dice', inputs: 'none', check: { kind: 'expect', output: '4' }, starter: 'use console;\nuse random;\nmain() {\n    console.writeln(random.create_int(1, 6));\n}', solution: 'use console;\nuse random;\nuse time;\nmain() {\n    random.set_seed(429);\n    time.sleep(0.01);\n    console.writeln(random.create_int(1, 6));\n}' });
  const advice = await embed.selfCheckUnit(dice.config, dice.problems, runner);
  assert(advice.issues.some((issue) => issue.code === 'self.random-no-seed' && issue.params.which === 'starter'), 'random without seed warns for the starter');
  assert(!advice.issues.some((issue) => issue.code === 'self.random-no-seed' && issue.params.which === 'solution'), 'seeded solution does not warn');
  assert(advice.issues.some((issue) => issue.code === 'self.time-sleep'), 'sleep advice');

  const bad = embed.normalizeUnitConfig({ format: 9, libs: ['console', 'gui'], tests: [{ random: 2, range: [9, 1], times: 1 }], check: { kind: 'formula', rules: [] }, hooks: { solved: 'alert(1)' } });
  const codes = bad.problems.map((problem) => problem.code);
  for (const code of ['config.format-newer', 'config.lib-unavailable', 'config.test-range', 'config.formula-empty', 'config.hook-name']) {
    assert(codes.includes(code), `expected ${code} in ${codes.join(', ')}`);
  }
  assert(bad.config.hooks.solved === '', 'a malformed hook name is dropped');
});

test('markup: two forms, the author solution never leaks, the address round-trips', () => {
  const full = embed.renderUnitMarkup({ ...rectConfig, hooks: { solved: 'lms.report', failed: '', check: '' } });
  assert(full.includes('<idyllium-unit id="rect" on-solved="lms.report">') && full.includes('<script type="text/idyllium">'), `full form: ${full}`);
  assert(!full.includes('console.writeln((w + h) * 2)'), 'formula mode must not leak the solution');
  const tricky = embed.renderUnitMarkup(embed.normalizeUnitConfig({ id: 't', starter: 'use console;\nmain() {\n    console.writeln("</script>");\n}' }).config);
  assert(!/<\/script>"\)/u.test(tricky), 'closing script tag inside the starter is defused');
  const iframe = embed.renderUnitIframe(rectConfig);
  assert(iframe.includes('sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"') && iframe.includes('embed/frame.html#unit='), `iframe form: ${iframe}`);
  const encoded = /#unit=([A-Za-z0-9_-]+)/u.exec(iframe)![1];
  const decoded = embed.normalizeUnitConfig(embed.decodeUnitFromHash(encoded)).config;
  assert(decoded.title === 'Прямоугольник' && decoded.solution === '' && decoded.tests.length === 4, `round trip: ${JSON.stringify(decoded)}`);
  const reference = embed.renderUnitMarkup(embed.normalizeUnitConfig({ id: 'r', check: { kind: 'reference' }, solution: RECT_GOOD, tests: [{ in: '1 2' }] }).config);
  assert(reference.includes('data-role="solution"'), 'reference mode ships the solution, and says so');
  assert(embed.slugifyUnitId('Площадь круга №2') === 'ploschad-kruga-2', `slug: ${embed.slugifyUnitId('Площадь круга №2')}`);
});

(async () => {
  let failed = 0;
  for (const [name, body] of tests) {
    try {
      await body();
      console.log(`ok - ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`not ok - ${name}`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
  console.log(`\npassed: ${tests.length - failed}`);
  console.log(`failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
})();
