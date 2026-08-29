#!/usr/bin/env node
'use strict';

// Одна команда владельца: npm run release:github
// Вешает тег vX.Y.Z (версия — из package.json, её называет только владелец)
// на текущий HEAD и пушит его; дальше GitHub Actions сам собирает VSIX,
// берёт описание из CHANGELOG.md и публикует Release (workflows/release.yml),
// а заодно выкатывает сайт (workflows/deploy.yml).
// Перед пушем — честные проверки, чтобы облако не упало на полпути.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();

const version = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
const tag = `v${version}`;

// 1. Блок версии в CHANGELOG.md существует (иначе релизу нечем описаться).
execFileSync(process.execPath, [path.join(__dirname, 'release-notes.js'), version], { cwd: rootDir, stdio: ['ignore', 'ignore', 'inherit'] });

// 2. Тега ещё нет — ни локально, ни на origin.
if (git('tag', '--list', tag)) {
  console.error(`тег ${tag} уже существует локально — релиз этой версии уже выпускался`);
  process.exit(1);
}
if (git('ls-remote', '--tags', 'origin', tag)) {
  console.error(`тег ${tag} уже существует на origin — релиз этой версии уже выпускался`);
  process.exit(1);
}

// 3. HEAD запушен: тег должен указывать на коммит, который есть на origin
//    (релиз из незапушенного состояния собрал бы в облаке другой код).
const head = git('rev-parse', 'HEAD');
git('fetch', 'origin', 'main');
const remoteContainsHead = git('branch', '-r', '--contains', head, '--list', 'origin/main');
if (!remoteContainsHead) {
  console.error('текущий HEAD не запушен в origin/main — сначала git push, затем релиз');
  process.exit(1);
}

git('tag', tag);
git('push', 'origin', tag);
console.log(`тег ${tag} отправлен — GitHub Actions собирает VSIX, публикует релиз «Idyllium-${version}» и выкатывает сайт.`);
console.log(`следить: https://github.com/Aumphaadr/Idyllium/actions`);
