#!/usr/bin/env node
'use strict';

// Вырезает из CHANGELOG.md блок одной версии — описание для GitHub-релиза.
// Использование: node tools/release-notes.js [версия]
// Без аргумента берётся версия из package.json (единственный источник).
// Печатает блок в stdout; если блока нет — честный отказ с кодом 1
// (релиз без записи в CHANGELOG нарушал бы канон ведения истории).

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const version = process.argv[2]
  || JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;

const changelog = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');
const lines = changelog.split('\n');
const headingPattern = /^## (\d+\.\d+\.\d+)\b/;

let start = -1;
for (let index = 0; index < lines.length; index += 1) {
  const match = lines[index].match(headingPattern);
  if (match && match[1] === version) {
    start = index;
    break;
  }
}
if (start < 0) {
  console.error(`CHANGELOG.md has no section for version ${version} — add it before releasing`);
  process.exit(1);
}

let end = lines.length;
for (let index = start + 1; index < lines.length; index += 1) {
  if (headingPattern.test(lines[index])) {
    end = index;
    break;
  }
}

// Заголовок версии в тело релиза не дублируется (имя релиза его уже несёт);
// хвостовые разделители убираются.
const body = lines.slice(start + 1, end).join('\n').replace(/^\n+/, '').replace(/[\n-]+$/, '').replace(/\n---\s*$/, '');
process.stdout.write(body + '\n');
