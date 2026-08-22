// Драйвер GUI-программ: компилирует, запускает, шлёт события виджетам
// и печатает состояние. Использование:
//   node gui-drive.js program.idyl '[{"type":"gui.Button","event":"click"}, ...]'
// Шаг: {type, index?, text?, event, payload?}
const path = require('path');
const fs = require('fs');
// Путь к сборке компилятора: по умолчанию — dist рядом с корнем репозитория.
const DIST = process.env.IDYLLIUM_DIST || path.resolve(__dirname, '../dist/src');
const { compileIdyllium, createRuntime } = require(DIST);

const file = path.resolve(process.argv[2]);
const steps = JSON.parse(process.argv[3] || '[]');
process.chdir(path.dirname(file));

function flatten(nodes, out = []) {
  for (const n of nodes || []) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

function show(runtime, note) {
  const wins = runtime.getWindows();
  const modals = typeof runtime.getModals === 'function' ? (runtime.getModals() || []) : [];
  console.log(`--- ${note} (окон: ${wins.length}${modals.length ? `, диалогов: ${modals.length}` : ''})`);
  for (const m of modals) {
    const p = m.properties || m;
    console.log(`  ${m.type || 'gui.Modal'}#${m.id}: title=${JSON.stringify(p.title || '')} message=${JSON.stringify(p.message || '')} mode=${JSON.stringify(p.mode || m.mode || '')}`);
  }
  for (const w of wins) {
    for (const n of flatten(w.children)) {
      const p = n.properties || {};
      const bits = [];
      for (const k of ['text', 'value', 'is_checked', 'is_selected', 'selected_index', 'selected_text', 'font_size', 'text_color', 'background_color', 'foreground_color', 'placeholder', 'echo_mode', 'visible', 'enabled', 'x', 'y']) {
        if (p[k] !== undefined && p[k] !== '' && p[k] !== null) bits.push(`${k}=${JSON.stringify(p[k])}`);
      }
      console.log(`  ${n.type}#${n.id}: ${bits.join(' ')}`);
    }
  }
}

function pick(runtime, step) {
  const all = [];
  for (const w of runtime.getWindows()) flatten(w.children, all);
  // Модалки живут не в дереве окна — их отдаёт отдельный список.
  if (typeof runtime.getModals === 'function') {
    for (const m of runtime.getModals() || []) all.push(m);
  }
  const byType = all.filter((n) => n.type === step.type);
  if (step.text !== undefined) {
    const hit = byType.find((n) => (n.properties || {}).text === step.text);
    if (!hit) throw new Error(`не найден ${step.type} с text=${step.text}`);
    return hit;
  }
  const hit = byType[step.index || 0];
  if (!hit) throw new Error(`не найден ${step.type} #${step.index || 0}`);
  return hit;
}

(async () => {
  const source = fs.readFileSync(file, 'utf8');
  const compilation = compileIdyllium(source, { file });
  if (!compilation.success) { console.log(compilation.diagnosticsText); process.exit(1); }
  const runtime = createRuntime();
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const program = await new AsyncFunction(compilation.jsCode)();
  await program(runtime);
  show(runtime, 'старт');
  for (const [i, step] of steps.entries()) {
    // Шаг-время: {"tick": секунды} прокручивает таймеры и холсты, как это делает хост.
    if (typeof step.tick === 'number') {
      try {
        await runtime.stepGui(step.tick);
        show(runtime, `шаг ${i + 1}: прошло ${step.tick} с`);
      } catch (error) {
        // Ошибка внутри тика в Web IDE снимает всю программу — здесь просто
        // печатаем её и продолжаем, чтобы было видно состояние окна.
        console.log(`--- шаг ${i + 1}: прошло ${step.tick} с`);
        console.log(`  !! ОШИБКА В ТИКЕ: ${error && error.message ? error.message : String(error)}`);
        show(runtime, 'состояние после ошибки');
      }
      continue;
    }
    const target = pick(runtime, step);
    const note = `шаг ${i + 1}: ${step.event} → ${step.type}#${target.id} ${JSON.stringify(step.payload || {})}`;
    try {
      await runtime.dispatchGuiEvent(target.id, step.event, step.payload || {});
      show(runtime, note);
    } catch (error) {
      console.log(`--- ${note}`);
      console.log(`  !! ОШИБКА: ${error && error.message ? error.message : String(error)}`);
      show(runtime, 'состояние после ошибки');
    }
  }
  const out = runtime.getOutput ? runtime.getOutput() : null;
  if (out) console.log('--- вывод консоли:\n' + (typeof out === 'string' ? out : JSON.stringify(out)));
})();
