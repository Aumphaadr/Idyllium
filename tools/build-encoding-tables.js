#!/usr/bin/env node
'use strict';

// Генератор таблиц однобайтовых кодировок → src/runtime/encoding-tables.ts.
//
// Зачем генерат, а не TextDecoder в рантайме: TextDecoder зависит от ICU
// хоста. Node small-icu не знает почти ничего, full-icu не знает
// ISO-8859-16 и DOS-страницы кроме 866, а windows-125x в Node отдаёт для
// байтов 0x80..0x9F управляющие C1 вместо «€», «“» и Ђ — то есть CLI и
// браузер сегодня читали cp1252 по-разному (улов этого генератора,
// 2026-09-11). Таблицы Idyllium обязаны быть одинаковыми в CLI, Web IDE
// и VS Code, поэтому они лежат в исходниках.
//
// Источник данных — tools/encoding-sources/codepages.json: 34 страницы,
// снятые с кодеков Python (они собраны из официальных таблиц Unicode.org
// и Microsoft: незанятые позиции cp1252 0x81/0x8D/0x8F/0x90/0x9D, cp857
// D5/E7/F2 и т. п. там честно отсутствуют). Пересобрать JSON:
//   python3 tools/encoding-sources/dump-codepages.py
// Сверка: tools/encoding-sources/charsets-tables.mjs — таблицы проекта
// Charsets (из glibc iconv) для восьми страниц, которых нет в WHATWG;
// генератор требует их совпадения с JSON.
//
// Формат: строка из 128 символов для байтов 0x80..0xFF; U+FFFF — «позиция
// не занята». Нижняя половина у всех страниц — ASCII.
//
// Использование: node tools/build-encoding-tables.js [--check]
// --check — не писать, а сверить существующий файл (страж в тестах).

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourcesDir = path.join(__dirname, 'encoding-sources');
const outputPath = path.join(rootDir, 'src', 'runtime', 'encoding-tables.ts');
const UNASSIGNED = '￿';

const ORDER = [
  'cp437', 'cp850', 'cp852', 'cp855', 'cp857', 'cp866',
  'windows-1250', 'windows-1251', 'windows-1252', 'windows-1253', 'windows-1254',
  'windows-1255', 'windows-1256', 'windows-1257', 'windows-1258',
  'ascii', 'iso-8859-1', 'iso-8859-2', 'iso-8859-3', 'iso-8859-4', 'iso-8859-5',
  'iso-8859-6', 'iso-8859-7', 'iso-8859-8', 'iso-8859-9', 'iso-8859-10',
  'iso-8859-13', 'iso-8859-14', 'iso-8859-15', 'iso-8859-16',
  'koi8-r', 'koi8-u', 'mac-roman', 'mac-cyrillic',
];

async function main() {
  const pages = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'codepages.json'), 'utf8'));
  const charsets = await import(path.join(sourcesDir, 'charsets-tables.mjs'));
  const crossCheck = {
    cp437: charsets.CP437_HIGH,
    cp850: charsets.CP850_HIGH,
    cp852: charsets.CP852_HIGH,
    cp855: charsets.CP855_HIGH,
    cp857: charsets.CP857_HIGH,
    'iso-8859-1': charsets.LATIN1_HIGH,
    'iso-8859-16': charsets.ISO8859_16_HIGH,
    ascii: charsets.ASCII_HIGH,
  };

  const rows = [];
  for (const id of ORDER) {
    const high = pages[id];
    if (typeof high !== 'string' || Array.from(high).length !== 128) {
      throw new Error(`${id}: codepages.json must hold 128 characters`);
    }
    const reference = crossCheck[id];
    if (reference !== undefined) {
      const mismatches = [];
      const ours = Array.from(high);
      const theirs = Array.from(reference);
      for (let index = 0; index < 128; index += 1) {
        if (ours[index] !== theirs[index]) mismatches.push(`0x${(0x80 + index).toString(16)}`);
      }
      if (mismatches.length > 0) {
        throw new Error(`${id}: differs from the Charsets table at ${mismatches.join(', ')}`);
      }
    }
    rows.push([id, high]);
  }

  const escape = (text) => Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code >= 0x20 && code < 0x7f && char !== '\\' && char !== "'") return char;
      return `\\u${code.toString(16).padStart(4, '0')}`;
    })
    .join('');
  const generated = [
    '// ГЕНЕРАТ — не править руками: node tools/build-encoding-tables.js',
    '// Верхние половины (байты 0x80..0xFF) однобайтовых кодировок; U+FFFF —',
    '// позиция не занята. Источники и правила — в шапке генератора.',
    '',
    `export const ENCODING_UNASSIGNED = '\\uffff';`,
    '',
    '/** id кодировки → 128 символов для байтов 0x80..0xFF. Порядок — порядок семейств. */',
    'export const ENCODING_UPPER_HALVES: ReadonlyArray<readonly [string, string]> = [',
    ...rows.map(([id, high]) => `  ['${id}', '${escape(high)}'],`),
    '];',
    '',
  ].join('\n');

  if (process.argv.includes('--check')) {
    const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    if (existing !== generated) {
      console.error('encoding tables are stale: run node tools/build-encoding-tables.js');
      process.exit(1);
    }
    console.log(`encoding tables are fresh (${rows.length} pages)`);
    return;
  }
  fs.writeFileSync(outputPath, generated);
  console.log(`wrote ${path.relative(rootDir, outputPath)}: ${rows.length} pages`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
