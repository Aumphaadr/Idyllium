#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const sourceWebDir = path.join(rootDir, 'packages', 'web-ide');
const outputWebDir = path.join(distDir, 'web');
const outputAssetsDir = path.join(outputWebDir, 'assets');
const sourceWebAssetsDir = path.join(sourceWebDir, 'assets');
const sourceFontsDir = path.join(sourceWebDir, 'fonts');
const outputFontsDir = path.join(outputWebDir, 'fonts');
const monacoSourceDir = path.join(rootDir, 'node_modules', 'monaco-editor', 'min', 'vs');
const monacoOutputDir = path.join(outputWebDir, 'monaco', 'vs');
const rendererSourceDir = path.join(rootDir, 'packages', 'gui-renderer');
const rendererOutputDir = path.join(outputWebDir, 'gui-renderer');
const papaParseSource = path.join(rootDir, 'node_modules', 'papaparse', 'papaparse.min.js');
const markedSource = path.join(rootDir, 'node_modules', 'marked', 'lib', 'marked.umd.js');
const domPurifySource = path.join(rootDir, 'node_modules', 'dompurify', 'dist', 'purify.min.js');
const vendorOutputDir = path.join(outputWebDir, 'vendor');
const browserEntry = path.join(distDir, 'src', 'browser.js');
const sqlJsWasmSource = path.join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm');

if (!fs.existsSync(browserEntry)) {
  console.error('Browser entry was not found. Run npm run build first.');
  process.exit(1);
}

fs.rmSync(outputWebDir, { recursive: true, force: true });
fs.mkdirSync(outputAssetsDir, { recursive: true });

for (const item of ['index.html', 'app.css', 'sw-preview.js']) {
  fs.copyFileSync(path.join(sourceWebDir, item), path.join(outputWebDir, item));
}
// app.js не копируется, а собирается esbuild'ом из ES-модулей
// packages/web-ide/src/ (наивный линкер ушёл на пенсию 2026-08-29,
// когда ядро переехало на esbuild). Артефакт — прежний одиночный
// classic-скрипт: file:// и index.html не меняются.
fs.writeFileSync(path.join(outputWebDir, 'app.js'), bundleWebIdeApp(path.join(sourceWebDir, 'src', 'main.js')), 'utf8');
// Версия берётся из корневого package.json (единственный источник) и
// подставляется в шапку IDE скриптом version.js через version.json.
fs.copyFileSync(path.join(rootDir, 'packages', 'docs', 'version.js'), path.join(outputWebDir, 'version.js'));
const rootPackageVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(outputWebDir, 'version.json'), `${JSON.stringify({ version: rootPackageVersion }, null, 2)}\n`);
if (fs.existsSync(sourceFontsDir)) {
  fs.cpSync(sourceFontsDir, outputFontsDir, { recursive: true });
}
if (fs.existsSync(sourceWebAssetsDir)) {
  fs.cpSync(sourceWebAssetsDir, outputAssetsDir, { recursive: true });
}
if (!fs.existsSync(monacoSourceDir)) {
  console.error('Monaco editor was not found. Run npm install first.');
  process.exit(1);
}
fs.cpSync(monacoSourceDir, monacoOutputDir, { recursive: true });

fs.cpSync(rendererSourceDir, rendererOutputDir, { recursive: true });
if (!fs.existsSync(papaParseSource)) {
  console.error('Papa Parse was not found. Run npm install first.');
  process.exit(1);
}
if (!fs.existsSync(markedSource) || !fs.existsSync(domPurifySource)) {
  console.error('Markdown preview dependencies were not found. Run npm install first.');
  process.exit(1);
}
fs.mkdirSync(vendorOutputDir, { recursive: true });
fs.copyFileSync(papaParseSource, path.join(vendorOutputDir, 'papaparse.min.js'));
fs.copyFileSync(markedSource, path.join(vendorOutputDir, 'marked.umd.js'));
fs.copyFileSync(domPurifySource, path.join(vendorOutputDir, 'purify.min.js'));
// QR для «Поделиться» (1.6.1): кодер и декодер лежат рядом и грузятся лениво —
// только когда человек нажал «Показать QR» или «Открыть проект из QR-картинки».
for (const [name, source] of [
  ['qrcode.js', path.join(rootDir, 'node_modules', 'qrcode-generator', 'dist', 'qrcode.js')],
  ['jsQR.js', path.join(rootDir, 'node_modules', 'jsqr', 'dist', 'jsQR.js')],
]) {
  if (!fs.existsSync(source)) {
    console.error(`QR dependency was not found: ${name}. Run npm install first.`);
    process.exit(1);
  }
  fs.copyFileSync(source, path.join(vendorOutputDir, name));
}
// jsQR — Apache-2.0: копия лицензии едет рядом с файлом (у qrcode-generator MIT-шапка внутри самого файла).
fs.copyFileSync(path.join(rootDir, 'node_modules', 'jsqr', 'LICENSE'), path.join(vendorOutputDir, 'jsQR-LICENSE.txt'));
if (!fs.existsSync(sqlJsWasmSource)) {
  console.error('sql.js WASM was not found. Run npm install first.');
  process.exit(1);
}
fs.copyFileSync(sqlJsWasmSource, path.join(outputAssetsDir, 'sql-wasm-browser.wasm'));
fs.writeFileSync(path.join(outputWebDir, 'gui-preview.html'), guiPreviewHtml(), 'utf8');
const bundledCore = browserBundle(browserEntry);
validateBrowserBundle(bundledCore)
  .then(() => {
    fs.writeFileSync(path.join(outputAssetsDir, 'idyllium-web-core.js'), bundledCore, 'utf8');
    console.log(`Idyllium Web IDE built at ${path.relative(rootDir, outputWebDir)}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });

// Ядро для браузера собирает esbuild (замена самодельного бандлера,
// 2026-08-29): вход — тот же скомпилированный tsc dist/src/browser.js,
// выход — прежний одиночный classic-скрипт с глобалом Idyllium.
// Node-встроенные модули подменяются стабами из tools/browser-stubs/
// (перенос прежних заглушек), fontkit берётся браузерной сборкой через
// его собственное поле "browser". Без минификации (вердикт владельца):
// docs/ в git, диффы должны оставаться читаемыми; charset=utf8 — русские
// тексты ошибок хранятся буквами, не эскейпами.
function bundleWebIdeApp(entryFile) {
  const esbuild = require('esbuild');
  const result = esbuild.buildSync({
    entryPoints: [entryFile],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    banner: { js: '/* Собран tools/build-web-ide.js (esbuild) из packages/web-ide/src/ — править источники, не этот файл. */' },
    logLevel: 'warning',
  });
  if (result.errors.length > 0) {
    throw new Error(`esbuild failed on app.js: ${result.errors.map((error) => error.text).join('; ')}`);
  }
  return result.outputFiles[0].text;
}

function browserBundle(entryFile) {
  const esbuild = require('esbuild');
  const result = esbuild.buildSync({
    entryPoints: [entryFile],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Idyllium',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    // На странице Web IDE живёт AMD-загрузчик Monaco с глобальным `define`. UMD-библиотека,
    // которая первым делом спрашивает `define.amd` (qrcode-generator), зарегистрировалась бы
    // у него и НИЧЕГО не отдала бы ядру. Внутри бандла AMD нет — говорим это прямо.
    define: { 'define.amd': 'undefined' },
    alias: {
      buffer: path.join(__dirname, 'browser-stubs', 'buffer.js'),
      fs: path.join(__dirname, 'browser-stubs', 'fs.js'),
      path: path.join(__dirname, 'browser-stubs', 'path.js'),
    },
    banner: {
      js: [
        '/* Generated by tools/build-web-ide.js (esbuild) */',
        // Стаб process — как в прежнем бандлере: пути ядра считаются от
        // виртуального корня проекта.
        'if (typeof globalThis.process === "undefined") { globalThis.process = { cwd: function () { return "/workspace"; } }; }',
      ].join('\n'),
    },
    logLevel: 'warning',
  });
  if (result.errors.length > 0) {
    throw new Error(`esbuild failed: ${result.errors.map((error) => error.text).join('; ')}`);
  }
  return result.outputFiles[0].text;
}

async function validateBrowserBundle(source) {
  const amdDefine = function define() {};
  amdDefine.amd = {};
  const context = {
    ArrayBuffer,
    DataView,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    URL,
    clearTimeout,
    console,
    define: amdDefine,
    setTimeout,
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(source, context, {
    filename: 'idyllium-web-core.js',
    timeout: 10000,
  });
  if (!context.Idyllium || typeof context.Idyllium.prepareIdylliumBrowserProgram !== 'function') {
    throw new Error('Generated browser core did not expose prepareIdylliumBrowserProgram');
  }

  // Сквозная проба: собранное ядро обязано скомпилировать и ВЫПОЛНИТЬ
  // программу — сборщик, потерявший модуль рантайма, падает здесь, а не
  // у первого ученика (страж введён при переезде на esbuild, 2026-08-29).
  const prepared = await context.Idyllium.prepareIdylliumBrowserProgram({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': 'use console;\n\nmain() {\n    console.writeln("сборка жива: ", 2 + 2);\n}\n',
    },
  });
  if (!prepared.compilation.success) {
    throw new Error(`bundle smoke program does not compile: ${prepared.compilation.diagnosticsText}`);
  }
  await prepared.run();
  const output = prepared.runtime && typeof prepared.runtime.getOutput === 'function'
    ? prepared.runtime.getOutput()
    : null;
  if (output !== 'сборка жива: 4\n') {
    throw new Error(`bundle smoke program output mismatch: ${JSON.stringify(output)}`);
  }
}

function guiPreviewHtml() {
  const guiRenderer = require(path.join(rendererSourceDir, 'index.js'));
  return guiRenderer.renderGuiWebviewHtml({
    cssUri: 'gui-renderer/renderer.css',
    hostBootstrap: "window.IdylliumGuiHost = { postMessage: function(message) { var target = window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*'; parent.postMessage({ type: 'idylliumGuiEvent', message: message }, target); } };",
    nonce: 'idyllium-web',
    scriptUri: 'gui-renderer/renderer.js',
    state: { windows: [], canvases: [], modals: [], output: '' },
  });
}
