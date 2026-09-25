'use strict';

// Сборка «Конструктора GUI» → dist/web/gui-designer (спека Idyllium-backstage/
// tech/spec/some_gui_designer/01, вердикты владельца 2026-09-25). Страница живёт
// рядом с Web IDE и пользуется её ядром (assets/idyllium-web-core.js) и кадром
// предпросмотра (gui-preview.html): сцена конструктора — настоящий прогон
// сгенерированной программы, а не макет. Шапка — из единого источника site-nav.

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'packages', 'gui-designer');
const webDir = path.join(rootDir, 'dist', 'web');
const outDir = path.join(webDir, 'gui-designer');
const siteNav = require(path.join(rootDir, 'dist', 'tools', 'site-nav.js'));
const version = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;

for (const required of ['assets/idyllium-web-core.js', 'gui-preview.html', 'gui-renderer/renderer.js']) {
  if (!fs.existsSync(path.join(webDir, required))) {
    console.error(`Web IDE build is incomplete: ${required} is missing. Run node tools/build-web-ide.js first.`);
    process.exit(1);
  }
}

const result = esbuild.buildSync({
  entryPoints: [path.join(sourceDir, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  banner: { js: `/* Idyllium ${version} — Конструктор GUI; собрано tools/build-gui-designer.js из packages/gui-designer/; править источники. */` },
});
if (result.errors.length > 0) {
  throw new Error(`esbuild failed on gui-designer: ${result.errors.map((error) => error.text).join('; ')}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'designer.js'), result.outputFiles[0].text.split('__IDYLLIUM_VERSION__').join(version), 'utf8');
fs.copyFileSync(path.join(sourceDir, 'designer.css'), path.join(outDir, 'designer.css'));
const shell = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'index.html'),
  siteNav.injectSiteTopbar(shell, 'gui-designer', { prefix: '../', version }),
  'utf8',
);
console.log(`Idyllium GUI designer built: gui-designer/designer.js ${(result.outputFiles[0].text.length / 1024).toFixed(1)} KB`);
