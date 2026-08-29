#!/usr/bin/env node
'use strict';

// Одна команда владельца: npm run deploy
// Выкатывает сайт БЕЗ gh и токенов — чистой git-моделью: force-пуш
// текущего HEAD в служебную ветку deploy, на которую подписан
// .github/workflows/deploy.yml. Ветка deploy на origin — честный
// указатель «какой коммит сейчас опубликован».
// Перед пушем — проверки, чтобы на сайт не уехало не то.

const { execFileSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : '';
    console.error(`git ${args[0]} не удался${stderr ? `:\n${stderr}` : ''}`);
    process.exit(1);
  }
};

// 1. docs/ не имеет незакоммиченных правок: деплой берёт docs/ из КОММИТА,
//    и локальные правки молча остались бы за бортом — честнее отказать.
const dirtyDocs = git('status', '--porcelain', '--', 'docs/');
if (dirtyDocs) {
  console.error('в docs/ есть незакоммиченные изменения — они НЕ попали бы на сайт.');
  console.error('Соберите (npm run docs:site), закоммитьте и повторите:');
  console.error(dirtyDocs.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
}

// 2. HEAD запушен в origin/main: сайт должен соответствовать коду,
//    который видит методическая команда.
const head = git('rev-parse', 'HEAD');
git('fetch', '--quiet', 'origin', 'main');
const remoteContainsHead = git('branch', '-r', '--contains', head, '--list', 'origin/main');
if (!remoteContainsHead) {
  console.error('текущий HEAD не запушен в origin/main — сначала git push, затем деплой');
  process.exit(1);
}

git('push', '--force', 'origin', 'HEAD:refs/heads/deploy');
console.log(`деплой запущен: ${head.slice(0, 7)} уехал в ветку deploy — GitHub Actions выкатывает docs/ на Pages.`);
console.log('следить: https://github.com/Aumphaadr/Idyllium/actions');
