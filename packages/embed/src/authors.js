// Конструктор юнитов (/authors/): форма → конфигурация → живой предпросмотр,
// самопроверка-светофор, две формы HTML для вставки, импорт и экспорт
// файла .idyunit. Задуман для учителя и методиста, которым незачем знать
// слово iframe: всё, что можно проверить за автора, проверяется здесь.

const api = window.Idyllium;
const embed = api.embed;
const DRAFT_KEY = 'idyllium-authors-draft';
const $ = (id) => document.getElementById(id);

const EXAMPLE = {
  title: 'Прямоугольник',
  statement: 'Считайте с консоли ширину и высоту прямоугольника. Выведите сначала его периметр, затем площадь — каждое число с новой строки.',
  starter: 'use console;\n\nmain() {\n    console.write("Hello, World!", \'\\n\');\n}\n',
  tests: [{ in: '3 5' }, { in: '10 2' }, { random: 2, range: [1, 100], times: 3 }],
  check: { kind: 'formula', rules: [{ when: '', expr: '{out1} == ({in1} + {in2}) * 2 and {out2} == {in1} * {in2} and {outs} == 2' }], tolerance: 1e-6 },
  solution: 'use console;\n\nmain() {\n    int w = console.get_int();\n    int h = console.get_int();\n    console.writeln((w + h) * 2);\n    console.writeln(w * h);\n}\n',
};

let state = embed.normalizeUnitConfig(EXAMPLE).config;
let idTouched = false;
let outputKind = 'full';
let previewUnit = null;
let inputKinds = [];       // как решение автора читает вводы (зонд самопроверки)
let lastFocusedFormula = null;
let selfCheckTimer = 0;
let selfCheckRun = 0;
let solutionAnswers = [];

// ─── состояние ↔ форма ─────────────────────────────────────────────────────

function starterKind(starter) {
  if (starter === '') return 'empty';
  if (starter === embed.STARTER_MINIMAL) return 'minimal';
  return 'custom';
}

function writeForm() {
  $('title').value = state.title;
  $('unit-id').value = state.id;
  $('statement').value = state.statement;
  document.querySelectorAll('input[name="starter-kind"]').forEach((radio) => { radio.checked = radio.value === starterKind(state.starter); });
  $('starter').value = state.starter;
  $('starter').disabled = starterKind(state.starter) !== 'custom';
  $('rows').value = state.editor.rows;
  $('console-rows').value = state.editor.consoleRows;
  $('font-size').value = state.editor.fontSize;
  $('theme').value = state.editor.theme;
  $('editor-mode').value = state.editor.mode;
  $('autocomplete').checked = state.editor.autocomplete;
  $('format-button').checked = state.editor.format;
  $('lang').value = state.lang;
  $('branding').checked = state.feedback.branding;
  $('soft-hint').checked = state.feedback.softRunHint;
  $('reveal').checked = state.feedback.reveal;
  $('share-code').checked = state.feedback.shareCode;
  document.querySelectorAll('input[name="inputs"]').forEach((radio) => { radio.checked = radio.value === state.inputs; });
  $('tests-block').hidden = state.inputs === 'none';
  $('expect').value = state.check.kind === 'expect' ? state.check.output : $('expect').value;
  $('tolerance').value = String('tolerance' in state.check ? state.check.tolerance : 1e-6);
  $('require').value = state.code.require.join(' ');
  $('forbid').value = state.code.forbid.join(' ');
  $('max-calls').value = Object.entries(state.code.maxCalls).map(([name, limit]) => `${name}:${limit}`).join(' ');
  $('solution').value = state.solution;
  $('hook-solved').value = state.hooks.solved;
  $('hook-failed').value = state.hooks.failed;
  $('hook-check').value = state.hooks.check;
  renderLibs();
  renderTests();
  renderRules();
  renderCheckTabs();
}

function renderLibs() {
  const host = $('libs');
  host.innerHTML = '';
  for (const name of embed.UNIT_LIBRARIES) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.libs.includes(name);
    box.disabled = name === 'console';
    box.addEventListener('change', () => {
      const libs = new Set(state.libs);
      if (box.checked) libs.add(name); else libs.delete(name);
      update({ libs: embed.UNIT_LIBRARIES.filter((item) => libs.has(item)) });
    });
    label.append(box, document.createTextNode(name));
    host.append(label);
  }
}

function renderTests() {
  const host = $('tests');
  host.innerHTML = '';
  state.tests.forEach((test, index) => {
    const row = document.createElement('div');
    row.className = 'test-row';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn remove';
    remove.textContent = '×';
    remove.title = 'Убрать тест';
    remove.addEventListener('click', () => update({ tests: state.tests.filter((_, position) => position !== index) }, true));
    const replace = (next) => update({ tests: state.tests.map((item, position) => (position === index ? next : item)) });
    if ('random' in test) {
      const mini = (text) => { const span = document.createElement('span'); span.className = 'label-mini'; span.textContent = text; return span; };
      const field = (value, onInput) => {
        const input = document.createElement('input');
        input.type = 'number'; input.className = 'small'; input.value = value;
        if (test.kind === 'float') input.step = 'any';
        input.addEventListener('input', () => onInput(Number(input.value)));
        return input;
      };
      row.append(
        mini('случайных чисел'), field(test.random, (value) => replace({ ...test, random: value })),
        mini('от'), field(test.range[0], (value) => replace({ ...test, range: [value, test.range[1]] })),
        mini('до'), field(test.range[1], (value) => replace({ ...test, range: [test.range[0], value] })),
        mini('раз'), field(test.times, (value) => replace({ ...test, times: value })),
      );
      // Целые или дробные: дробные нужны задачам, где ввод читается через get_float.
      const kind = document.createElement('select');
      kind.className = 'kind';
      kind.title = 'Какие числа подставлять';
      for (const [value, text] of [['int', 'целые'], ['float', 'дробные']]) kind.append(new Option(text, value));
      kind.value = test.kind === 'float' ? 'float' : 'int';
      kind.addEventListener('input', () => {
        const { kind: _kind, digits: _digits, ...plain } = test;
        const next = kind.value === 'float'
          ? { ...plain, kind: 'float', digits: 1 }
          : { ...plain, range: [Math.ceil(test.range[0]), Math.floor(test.range[1])] };
        update({ tests: state.tests.map((item, position) => (position === index ? next : item)) }, true);
      });
      row.append(kind, remove);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'ввод через пробел: 3 5';
      input.value = Array.isArray(test.in) ? test.in.join(' ') : test.in;
      input.addEventListener('input', () => replace({ in: input.value }));
      row.append(input);
      const known = solutionAnswers.find((item) => item.input === embed.inputLines(test.in).join(' '));
      if (known) {
        const answer = document.createElement('span');
        answer.className = 'answer';
        answer.title = 'Ответ решения автора на этот тест';
        answer.textContent = `→ ${known.answer.replace(/\n/gu, ' ⏎ ')}`;
        row.append(answer);
      }
      row.append(remove);
    }
    host.append(row);
  });
}

function renderRules() {
  const host = $('rules');
  host.innerHTML = '';
  // Рисуем черновики, а не нормализованные правила: пустая строка остаётся на месте.
  const rules = state.check.kind === 'formula' ? ruleDrafts : [];
  rules.forEach((rule, index) => {
    const row = document.createElement('div');
    row.className = 'rule-row';
    const when = document.createElement('input');
    when.className = 'when';
    when.placeholder = 'когда (пусто — всегда)';
    when.value = rule.when;
    const expr = document.createElement('input');
    expr.placeholder = 'условие: {out1} == {in1} * 2';
    expr.value = rule.expr;
    const commit = () => setRules(currentRules().map((item, position) => (position === index ? { when: when.value, expr: expr.value } : item)));
    for (const input of [when, expr]) {
      input.addEventListener('input', commit);
      input.addEventListener('focus', () => { lastFocusedFormula = input; });
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn remove';
    remove.textContent = '×';
    remove.addEventListener('click', () => setRules(currentRules().filter((_, position) => position !== index), true));
    row.append(when, expr, remove);
    host.append(row);
  });
}

// Правила редактируются «сырыми»: пустая строка условия не должна исчезать из
// формы посреди набора, поэтому рядом с нормализованным состоянием живёт черновик.
let ruleDrafts = [];
function currentRules() { return ruleDrafts; }
function setRules(rules, rerender = false) {
  ruleDrafts = rules;
  update({ check: { kind: 'formula', rules, tolerance: Number($('tolerance').value) || 1e-6 } }, rerender);
}

function renderCheckTabs() {
  document.querySelectorAll('[data-check]').forEach((tab) => tab.classList.toggle('active', tab.dataset.check === state.check.kind));
  document.querySelectorAll('[data-body]').forEach((body) => { body.hidden = body.dataset.body !== state.check.kind; });
}

/** Меняет состояние через нормализацию модели и обновляет всё производное. */
function update(patch, rerender = false) {
  const merged = { ...state, ...patch, idyllium: window.IdylliumUnit.version };
  const normalized = embed.normalizeUnitConfig(merged);
  state = normalized.config;
  if (rerender) { renderTests(); renderRules(); renderCheckTabs(); $('tests-block').hidden = state.inputs === 'none'; }
  saveDraft();
  refreshMarkup();
  schedulePreview();
  scheduleSelfCheck(normalized.problems);
}

// ─── предпросмотр, разметка, самопроверка ──────────────────────────────────

let previewTimer = 0;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const config = embed.publicUnitConfig(state);
    // Тема «как у ученика» в предпросмотре следует теме этой страницы, а не
    // системной: иначе на тёмной странице окажется светлый юнит. В разметку
    // для вставки это не попадает.
    if (!config.editor || !config.editor.theme || config.editor.theme === 'auto') {
      config.editor = { ...config.editor, theme: document.body.classList.contains('light-theme') ? 'light' : 'dark' };
    }
    if (!previewUnit) {
      previewUnit = window.IdylliumUnit.create($('preview'), { ...config, id: `${config.id}-preview` });
    } else {
      previewUnit.configure({ ...config, id: `${config.id}-preview` });
    }
  }, 400);
}

function refreshMarkup() {
  $('markup').value = outputKind === 'iframe' ? embed.renderUnitIframe(state) : embed.renderUnitMarkup(state);
}

function issueLine(issue) {
  const item = document.createElement('div');
  item.className = `issue issue-${issue.severity}`;
  const body = document.createElement('div');
  body.textContent = embed.unitText('ru', issue.code, issue.params);
  if (issue.reason) {
    const small = document.createElement('small');
    small.textContent = embed.reasonText('ru', issue.reason);
    body.append(small);
  }
  if (issue.suggestTest) {
    // Дыра в тестах найдена вместе с тестом, который её закрывает.
    const fix = document.createElement('button');
    fix.type = 'button';
    fix.className = 'btn btn-fix';
    fix.textContent = `+ тест «${issue.suggestTest.join(' ')}»`;
    fix.title = 'Добавить этот тест в список';
    fix.addEventListener('click', () => update({ tests: [...state.tests, { in: issue.suggestTest.join(' ') }] }, true));
    body.append(fix);
  }
  item.append(body);
  return item;
}

function scheduleSelfCheck(problems) {
  clearTimeout(selfCheckTimer);
  selfCheckTimer = setTimeout(async () => {
    selfCheckRun += 1;
    const run = selfCheckRun;
    const host = $('selfcheck');
    const report = await embed.selfCheckUnit(state, problems, api.createUnitRunner(), { timeoutMs: 10000 });
    if (run !== selfCheckRun) return; // пока проверяли, автор уже поменял форму
    host.innerHTML = '';
    if (report.issues.length === 0) {
      const calm = document.createElement('p');
      calm.className = 'hint';
      calm.textContent = 'Замечаний нет.';
      host.append(calm);
    }
    const order = { error: 0, warning: 1, ok: 2 };
    [...report.issues].sort((left, right) => order[left.severity] - order[right.severity]).forEach((issue) => host.append(issueLine(issue)));
    solutionAnswers = [...report.solutionAnswers];
    inputKinds = [...report.inputKinds];
    renderTestsKeepingFocus();
    $('copy').dataset.blocked = report.hasErrors ? '1' : '';
  }, 900);
}

function renderTestsKeepingFocus() {
  if ($('tests').contains(document.activeElement)) return; // не выдёргиваем поле из-под курсора
  renderTests();
}

// ─── файл и черновик ───────────────────────────────────────────────────────

function saveDraft() {
  try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, ruleDrafts, idTouched })); } catch (_error) { /* нет хранилища */ }
}

function loadUnit(raw, note) {
  const normalized = embed.normalizeUnitConfig({ ...raw, idyllium: window.IdylliumUnit.version });
  state = normalized.config;
  ruleDrafts = state.check.kind === 'formula' ? state.check.rules.map((rule) => ({ ...rule })) : [];
  idTouched = true;
  solutionAnswers = [];
  writeForm();
  refreshMarkup();
  schedulePreview();
  scheduleSelfCheck(normalized.problems);
  saveDraft();
  $('file-note').textContent = note;
}

$('save-file').addEventListener('click', () => {
  const blob = new Blob([`${JSON.stringify(state, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${state.id || 'unit'}.idyunit`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  $('file-note').textContent = `Сохранено: ${link.download} (решение автора — внутри файла)`;
});
$('open-file').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async () => {
  const file = $('file-input').files[0];
  if (!file) return;
  try {
    loadUnit(JSON.parse(await file.text()), `Открыт: ${file.name}`);
  } catch (error) {
    $('file-note').textContent = `Не удалось прочитать ${file.name}: это не файл юнита (${error.message})`;
  }
  $('file-input').value = '';
});
$('new-unit').addEventListener('click', () => loadUnit({ starter: embed.STARTER_MINIMAL, check: { kind: 'none' } }, 'Новый юнит'));

// ─── события формы ─────────────────────────────────────────────────────────

$('title').addEventListener('input', () => {
  const patch = { title: $('title').value };
  if (!idTouched) {
    patch.id = embed.slugifyUnitId($('title').value) || 'unit';
    $('unit-id').value = patch.id;
  }
  update(patch);
});
$('unit-id').addEventListener('input', () => { idTouched = true; update({ id: $('unit-id').value }); });
$('unit-id').addEventListener('blur', () => { $('unit-id').value = state.id; });
$('statement').addEventListener('input', () => update({ statement: $('statement').value }));
document.querySelectorAll('input[name="starter-kind"]').forEach((radio) => radio.addEventListener('change', () => {
  const kind = radio.value;
  const starter = kind === 'empty' ? '' : kind === 'minimal' ? embed.STARTER_MINIMAL : ($('starter').value || EXAMPLE.starter);
  $('starter').value = starter;
  $('starter').disabled = kind !== 'custom';
  update({ starter });
}));
$('starter').addEventListener('input', () => update({ starter: $('starter').value }));
const editorPatch = () => ({
  editor: {
    rows: Number($('rows').value), consoleRows: Number($('console-rows').value), fontSize: Number($('font-size').value),
    theme: $('theme').value, mode: $('editor-mode').value, autocomplete: $('autocomplete').checked, format: $('format-button').checked,
  },
});
for (const id of ['rows', 'console-rows', 'font-size', 'theme', 'editor-mode', 'autocomplete', 'format-button']) $(id).addEventListener('input', () => update(editorPatch()));
$('lang').addEventListener('input', () => update({ lang: $('lang').value }));
const feedbackPatch = () => ({
  feedback: { branding: $('branding').checked, softRunHint: $('soft-hint').checked, reveal: $('reveal').checked, shareCode: $('share-code').checked },
});
for (const id of ['branding', 'soft-hint', 'reveal', 'share-code']) $(id).addEventListener('change', () => update(feedbackPatch()));
document.querySelectorAll('input[name="inputs"]').forEach((radio) => radio.addEventListener('change', () => update({ inputs: radio.value }, true)));
$('add-test').addEventListener('click', () => update({ tests: [...state.tests, { in: '' }] }, true));
$('add-random').addEventListener('click', () => {
  // Зонд уже знает, сколько значений и какого типа читает решение автора.
  const float = inputKinds.includes('float');
  const test = { random: inputKinds.length || 2, range: [1, 100], times: 3, ...(float ? { kind: 'float', digits: 1 } : {}) };
  update({ tests: [...state.tests, test] }, true);
});

document.querySelectorAll('[data-check]').forEach((tab) => tab.addEventListener('click', () => {
  const kind = tab.dataset.check;
  const tolerance = Number($('tolerance').value) || 1e-6;
  if (kind === 'formula') {
    if (ruleDrafts.length === 0) ruleDrafts = [{ when: '', expr: '' }];
    update({ check: { kind, rules: ruleDrafts, tolerance } }, true);
  } else if (kind === 'expect') update({ check: { kind, output: $('expect').value } }, true);
  else if (kind === 'reference') update({ check: { kind, tolerance } }, true);
  else update({ check: { kind: 'none' } }, true);
}));
$('add-rule').addEventListener('click', () => setRules([...currentRules(), { when: '', expr: '' }], true));
$('tolerance').addEventListener('input', () => {
  const tolerance = Number($('tolerance').value);
  if (!Number.isFinite(tolerance) || tolerance < 0) return;
  if (state.check.kind === 'formula') update({ check: { ...state.check, rules: ruleDrafts, tolerance } });
  else if (state.check.kind === 'reference') update({ check: { kind: 'reference', tolerance } });
});
$('expect').addEventListener('input', () => update({ check: { kind: 'expect', output: $('expect').value } }));
$('expect-from-solution').addEventListener('click', async () => {
  if (state.solution.trim() === '') { $('file-note').textContent = 'Сначала впишите решение автора (блок 8).'; return; }
  const inputs = embed.expandTests(state.tests, state.inputs)[0] || [];
  const run = await embed.runUnitProgram(api.createUnitRunner(), state.solution, inputs, state);
  if (run.failure) { $('file-note').textContent = embed.reasonText('ru', run.failure); return; }
  $('expect').value = run.answer.replace(/\s+$/u, '');
  update({ check: { kind: 'expect', output: $('expect').value } });
});
$('tokens').addEventListener('click', (event) => {
  const token = event.target.closest('[data-token]');
  if (!token || !lastFocusedFormula || !document.body.contains(lastFocusedFormula)) return;
  const input = lastFocusedFormula;
  input.setRangeText(token.dataset.token, input.selectionStart, input.selectionEnd, 'end');
  input.dispatchEvent(new Event('input'));
  input.focus();
});

const wordsOf = (value) => value.split(/[\s,]+/u).filter(Boolean);
const codePatch = () => {
  const maxCalls = {};
  for (const pair of wordsOf($('max-calls').value)) {
    const [name, limit] = pair.split(':');
    if (name && /^\d+$/u.test(limit || '')) maxCalls[name] = Number(limit);
  }
  return { code: { require: wordsOf($('require').value), forbid: wordsOf($('forbid').value), maxCalls } };
};
for (const id of ['require', 'forbid', 'max-calls']) $(id).addEventListener('input', () => update(codePatch()));
$('solution').addEventListener('input', () => update({ solution: $('solution').value }));
$('solution-from-preview').addEventListener('click', async () => {
  if (!previewUnit) return;
  $('solution').value = await previewUnit.getCode();
  update({ solution: $('solution').value });
});
$('preview-from-solution').addEventListener('click', () => { if (previewUnit) previewUnit.setCode(state.solution); });
for (const [id, key] of [['hook-solved', 'solved'], ['hook-failed', 'failed'], ['hook-check', 'check']]) {
  $(id).addEventListener('input', () => update({ hooks: { ...state.hooks, [key]: $(id).value.trim() } }));
}

document.querySelectorAll('[data-out]').forEach((tab) => tab.addEventListener('click', () => {
  outputKind = tab.dataset.out;
  document.querySelectorAll('[data-out]').forEach((item) => item.classList.toggle('active', item === tab));
  refreshMarkup();
}));
$('copy').addEventListener('click', async () => {
  if ($('copy').dataset.blocked === '1' && $('copy').dataset.armed !== '1') {
    $('copy').dataset.armed = '1';
    $('copy-note').textContent = 'В самопроверке есть красное. Нажмите ещё раз, если всё равно хотите скопировать.';
    return;
  }
  $('copy').dataset.armed = '';
  try {
    await navigator.clipboard.writeText($('markup').value);
    $('copy-note').textContent = 'Скопировано.';
  } catch (_error) {
    $('markup').select();
    $('copy-note').textContent = 'Выделено — нажмите Ctrl+C.';
  }
});

// Пояснялки «(?)»: на сенсорных экранах открываются касанием.
document.addEventListener('click', (event) => {
  const tip = event.target.closest('.tip');
  document.querySelectorAll('.tip.open').forEach((item) => { if (item !== tip) item.classList.remove('open'); });
  if (tip) { event.preventDefault(); tip.classList.toggle('open'); }
});
document.querySelectorAll('.tip').forEach((tip) => tip.setAttribute('tabindex', '0'));

// Тема общая с учебником и задачником: тот же ключ и тот же класс на body.
const THEME_KEY = 'idyllium-docs-theme';
function applyTheme(light) {
  document.body.classList.toggle('light-theme', light);
  const hint = light ? 'Тёмная тема' : 'Светлая тема';
  $('theme-toggle').title = hint;
  $('theme-toggle').setAttribute('aria-label', hint);
}
try { applyTheme(window.localStorage.getItem(THEME_KEY) === 'light'); } catch (_error) { applyTheme(false); }
$('theme-toggle').addEventListener('click', () => {
  const light = !document.body.classList.contains('light-theme');
  applyTheme(light);
  try { window.localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch (_error) { /* не страшно */ }
  // Предпросмотр перекрашивается сразу, командой: пересборка юнита тут не нужна.
  if (previewUnit && state.editor.theme === 'auto') previewUnit.setTheme(light ? 'light' : 'dark');
});

// ─── старт ─────────────────────────────────────────────────────────────────

(function start() {
  let restored = null;
  try { restored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_error) { restored = null; }
  if (restored && restored.state) {
    loadUnit(restored.state, 'Восстановлен черновик из этого браузера');
    ruleDrafts = Array.isArray(restored.ruleDrafts) && state.check.kind === 'formula' ? restored.ruleDrafts : ruleDrafts;
    idTouched = Boolean(restored.idTouched);
    renderRules();
  } else {
    loadUnit(EXAMPLE, 'Пример: можно править его или начать «Новый юнит»');
    idTouched = false;
  }
})();
