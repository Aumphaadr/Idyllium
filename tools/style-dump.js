const path = require('path');
const fs = require('fs');
const DIST = process.env.IDYLLIUM_DIST || path.resolve(__dirname, '../dist/src');
const { compileIdyllium, createRuntime } = require(DIST);
const file = path.resolve(process.argv[2]);
process.chdir(path.dirname(file));
(async () => {
  const compilation = compileIdyllium(fs.readFileSync(file, 'utf8'), { file });
  if (!compilation.success) { console.log(compilation.diagnosticsText); process.exit(1); }
  const runtime = createRuntime();
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  await (await new AsyncFunction(compilation.jsCode)())(runtime);
  const walk = (nodes) => { for (const n of nodes || []) {
    const p = n.properties || {};
    console.log(`${n.type}#${n.id} text=${JSON.stringify(p.text || '')}`);
    console.log(`   style      = ${JSON.stringify(p.style || '')}`);
    console.log(`   принято    = ${JSON.stringify(p.style_declarations || [])}`);
    if (p.style_hover) console.log(`   hover      = ${JSON.stringify(p.style_hover_declarations || [])}`);
    if (p.style_active) console.log(`   active     = ${JSON.stringify(p.style_active_declarations || [])}`);
    if (p.hint) console.log(`   hint       = ${JSON.stringify(p.hint)}`);
    walk(n.children);
  } };
  for (const w of runtime.getWindows()) walk(w.children);
})();
