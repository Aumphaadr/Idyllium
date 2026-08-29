'use strict';
// Браузерный стаб node:fs — файлов Node в браузере нет, попытки честно
// падают словами; existsSync отвечает false (fontkit щупает файлы шрифтов).

function unavailable() {
  throw new Error('Node fs is not available in the browser');
}

module.exports = {
  appendFileSync: unavailable,
  existsSync: function existsSync() { return false; },
  readFileSync: unavailable,
  statSync: unavailable,
  writeFileSync: unavailable,
};
