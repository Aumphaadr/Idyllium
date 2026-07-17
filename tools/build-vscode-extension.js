#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'packages', 'vscode-idyllium');
const coreSourceDir = path.join(rootDir, 'dist', 'src');
const packagedCoreDir = path.join(extensionDir, 'server', 'dist', 'src');
const packagedNodeModulesDir = path.join(extensionDir, 'server', 'node_modules');
const rendererSourceDir = path.join(rootDir, 'packages', 'gui-renderer');
const packagedRendererDir = path.join(extensionDir, 'gui-renderer');

if (!fs.existsSync(coreSourceDir)) {
  console.error('Idyllium core build was not found. Run npm run build first.');
  process.exit(1);
}

if (!fs.existsSync(rendererSourceDir)) {
  console.error('Idyllium GUI renderer was not found.');
  process.exit(1);
}

fs.rmSync(path.join(extensionDir, 'server'), { recursive: true, force: true });
fs.mkdirSync(path.dirname(packagedCoreDir), { recursive: true });
fs.cpSync(coreSourceDir, packagedCoreDir, { recursive: true });

fs.mkdirSync(packagedNodeModulesDir, { recursive: true });
for (const dependency of [
  '@swc/helpers',
  'base64-js',
  'brotli',
  'clone',
  'dfa',
  'fast-deep-equal',
  'fontkit',
  'gifenc',
  'gifuct-js',
  'jpeg-js',
  'js-binary-schema-parser',
  'pako',
  'restructure',
  'sql.js',
  'tiny-inflate',
  'tslib',
  'unicode-properties',
  'unicode-trie',
  'upng-js',
  'webp-wasm',
]) {
  const source = path.join(rootDir, 'node_modules', dependency);
  if (!fs.existsSync(source)) {
    console.error(`Image dependency was not found: ${source}. Run npm install first.`);
    process.exit(1);
  }
  fs.cpSync(source, path.join(packagedNodeModulesDir, dependency), { recursive: true });
}

for (const [dependency, relativePath] of [
  ['gifuct-js', 'demo'],
  ['js-binary-schema-parser', 'example'],
  ['pako', 'dist'],
]) {
  fs.rmSync(path.join(packagedNodeModulesDir, dependency, relativePath), { recursive: true, force: true });
}

const packagedSqlJsDir = path.join(packagedNodeModulesDir, 'sql.js');
for (const item of fs.readdirSync(packagedSqlJsDir)) {
  if (item === 'dist' || item === 'LICENSE' || item === 'package.json') continue;
  fs.rmSync(path.join(packagedSqlJsDir, item), { recursive: true, force: true });
}
for (const item of fs.readdirSync(path.join(packagedSqlJsDir, 'dist'))) {
  if (item === 'sql-wasm.js' || item === 'sql-wasm.wasm') continue;
  fs.rmSync(path.join(packagedSqlJsDir, 'dist', item), { recursive: true, force: true });
}

fs.rmSync(packagedRendererDir, { recursive: true, force: true });
fs.cpSync(rendererSourceDir, packagedRendererDir, { recursive: true });

console.log(`Idyllium VS Code extension prepared at ${extensionDir}`);
console.log(`Core copied to ${path.relative(rootDir, packagedCoreDir)}`);
console.log(`GUI renderer copied to ${path.relative(rootDir, packagedRendererDir)}`);
