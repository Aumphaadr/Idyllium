#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'packages', 'vscode-idyllium');
const coreSourceDir = path.join(rootDir, 'dist', 'src');
const packagedCoreDir = path.join(extensionDir, 'server', 'dist', 'src');
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

fs.rmSync(packagedRendererDir, { recursive: true, force: true });
fs.cpSync(rendererSourceDir, packagedRendererDir, { recursive: true });

console.log(`Idyllium VS Code extension prepared at ${extensionDir}`);
console.log(`Core copied to ${path.relative(rootDir, packagedCoreDir)}`);
console.log(`GUI renderer copied to ${path.relative(rootDir, packagedRendererDir)}`);
