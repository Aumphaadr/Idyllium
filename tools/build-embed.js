#!/usr/bin/env node
'use strict';

// Сборка embed-юнитов и раздела «Авторам» → dist/web/embed и dist/web/authors
// (оттуда docs:site уносит их на сайт вместе с Web IDE). Источники —
// packages/embed/: кадр юнита (frame.*), загрузчик <idyllium-unit> и
// конструктор юнитов. Ядро и Monaco не копируются: юниты берут их с того же
// сайта (../assets, ../monaco) — один кэш на IDE и юниты.
// Запускается после tools/build-web-ide.js (он чистит dist/web).

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'packages', 'embed');
const webDir = path.join(rootDir, 'dist', 'web');
const embedOut = path.join(webDir, 'embed');
const authorsOut = path.join(webDir, 'authors');
const version = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;

if (!fs.existsSync(path.join(webDir, 'assets', 'idyllium-web-core.js'))) {
  console.error('Web IDE build was not found. Run node tools/build-web-ide.js first.');
  process.exit(1);
}

function bundle(entry, outfile, format) {
  const result = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    format,
    platform: 'browser',
    target: ['es2020'],
    write: false,
    legalComments: 'none',
    banner: { js: `/* Idyllium ${version} — собрано tools/build-embed.js из packages/embed/; править источники. */` },
  });
  if (result.errors.length > 0) {
    throw new Error(`esbuild failed on ${entry}: ${result.errors.map((error) => error.text).join('; ')}`);
  }
  const code = result.outputFiles[0].text.split('__IDYLLIUM_VERSION__').join(version);
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  fs.writeFileSync(outfile, code, 'utf8');
  return code.length;
}

fs.rmSync(embedOut, { recursive: true, force: true });
fs.rmSync(authorsOut, { recursive: true, force: true });
fs.mkdirSync(embedOut, { recursive: true });

const sizes = {
  'embed/frame.js': bundle(path.join(sourceDir, 'src', 'frame.js'), path.join(embedOut, 'frame.js'), 'iife'),
  'embed/idyllium-unit.js': bundle(path.join(sourceDir, 'src', 'loader.js'), path.join(embedOut, 'idyllium-unit.js'), 'iife'),
};
for (const file of ['frame.html', 'frame.css']) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(embedOut, file));
}

const authorsSource = path.join(sourceDir, 'authors');
if (fs.existsSync(path.join(authorsSource, 'index.html'))) {
  fs.mkdirSync(authorsOut, { recursive: true });
  for (const file of fs.readdirSync(authorsSource)) {
    const from = path.join(authorsSource, file);
    if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(authorsOut, file));
  }
  // version.js ищет version.json рядом с последним скриптом страницы — кладём копию.
  fs.writeFileSync(path.join(authorsOut, 'version.json'), `${JSON.stringify({ version }, null, 2)}\n`);
  // Шапка «Авторам» — из единого источника шапки сайта.
  const siteNav = require(path.join(rootDir, 'dist', 'tools', 'site-nav.js'));
  const authorsShell = fs.readFileSync(path.join(authorsOut, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(authorsOut, 'index.html'), siteNav.injectSiteTopbar(authorsShell, 'authors', { prefix: '../', version }), 'utf8');
  if (fs.existsSync(path.join(sourceDir, 'src', 'authors.js'))) {
    sizes['authors/authors.js'] = bundle(path.join(sourceDir, 'src', 'authors.js'), path.join(authorsOut, 'authors.js'), 'iife');
  }
}

console.log(`Idyllium embed built: ${Object.entries(sizes).map(([name, size]) => `${name} ${(size / 1024).toFixed(1)} KB`).join(', ')}`);
