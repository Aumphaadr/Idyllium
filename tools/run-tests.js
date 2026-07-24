#!/usr/bin/env node
'use strict';
// Запускает все tests/*.test.ts (их скомпилированные dist-версии) без ручного
// списка в package.json: новый тестовый файл подхватывается автоматически.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const testsDir = path.join(rootDir, 'tests');
const distTestsDir = path.join(rootDir, 'dist', 'tests');

const names = fs.readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => name.replace(/\.ts$/u, '.js'))
  .sort((left, right) => {
    // smoke первым: он самый широкий и информативный при поломках
    if (left === 'smoke.test.js') return -1;
    if (right === 'smoke.test.js') return 1;
    return left.localeCompare(right);
  });

for (const name of names) {
  const compiled = path.join(distTestsDir, name);
  if (!fs.existsSync(compiled)) {
    console.error(`missing compiled test ${name}; run npm run build`);
    process.exit(1);
  }
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [compiled], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nall ${names.length} test files passed`);
