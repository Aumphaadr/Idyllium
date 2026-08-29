'use strict';

// Наивный линкер исходников Web IDE: на входе — честные ES-модули в
// packages/web-ide/src/ (import/export проверяются), на выходе — прежний
// одиночный classic-скрипт app.js (IIFE), чтобы IDE продолжала открываться
// и с file://, а docs/ и VSIX не меняли форму. Поддерживается ровно то
// подмножество модулей, для которого склейка эквивалентна модульному
// исполнению: статические импорты соседей, префиксные экспорты объявлений,
// уникальные имена, без циклов. Всё вне подмножества — громкий отказ.
// Пункт бэклога про esbuild позже заменит этот линкер целиком.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const IMPORT_LINE = /^import\s+(?:\{([^}]*)\}\s+from\s+)?'\.\/([A-Za-z0-9_-]+\.js)';\s*$/;
const EXPORT_LINE = /^export\s+(?:async\s+function|function|const|let|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

function linkWebIdeApp(srcDir) {
  const modules = new Map(); // имя файла → { lines, imports: Map<имя файла, string[]>, exports: Set }
  const visiting = [];
  const order = [];

  function loadModule(fileName) {
    if (modules.has(fileName)) return;
    if (visiting.includes(fileName)) {
      throw new Error(`Web IDE sources import each other in a cycle: ${[...visiting, fileName].join(' -> ')}`);
    }
    const filePath = path.join(srcDir, fileName);
    if (!fs.existsSync(filePath)) {
      const importer = visiting.length > 0 ? visiting[visiting.length - 1] : '(entry)';
      throw new Error(`Web IDE source module was not found: ${fileName} (imported from ${importer})`);
    }
    visiting.push(fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split('\n');
    const imports = new Map();
    const exportedNames = new Set();
    let importsEnded = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const importMatch = line.match(IMPORT_LINE);
      if (importMatch) {
        if (importsEnded) {
          throw new Error(`${fileName}:${index + 1}: import lines must stay at the top of the module`);
        }
        const target = importMatch[2];
        const names = importMatch[1]
          ? importMatch[1].split(',').map((name) => name.trim()).filter(Boolean)
          : [];
        imports.set(target, (imports.get(target) || []).concat(names));
        lines[index] = '';
        continue;
      }
      if (/^import[\s('"]/.test(line)) {
        throw new Error(`${fileName}:${index + 1}: unsupported import form (only "import { a, b } from './x.js';" and "import './x.js';" are linkable)`);
      }
      if (line.trim() !== '' && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith(' *')) {
        importsEnded = true;
      }
      const exportMatch = line.match(EXPORT_LINE);
      if (exportMatch) {
        exportedNames.add(exportMatch[1]);
        lines[index] = line.slice('export '.length);
        continue;
      }
      if (/^export[\s{]/.test(line)) {
        throw new Error(`${fileName}:${index + 1}: unsupported export form (only "export function/const/let/class <name>" declarations are linkable)`);
      }
    }

    for (const target of imports.keys()) loadModule(target);
    visiting.pop();
    modules.set(fileName, { lines, imports, exports: exportedNames });
    order.push(fileName);
  }

  loadModule('main.js');

  // Импортированные имена должны существовать у целей, публичные имена — не повторяться.
  const nameOwners = new Map();
  for (const [fileName, moduleInfo] of modules) {
    for (const name of moduleInfo.exports) {
      const owner = nameOwners.get(name);
      if (owner) throw new Error(`Web IDE sources export the name '${name}' twice: ${owner} and ${fileName}`);
      nameOwners.set(name, fileName);
    }
  }
  for (const [fileName, moduleInfo] of modules) {
    for (const [target, names] of moduleInfo.imports) {
      for (const name of names) {
        if (!modules.get(target).exports.has(name)) {
          throw new Error(`${fileName} imports '${name}' from ${target}, but ${target} does not export it`);
        }
      }
    }
  }

  const pieces = order.map((fileName) => {
    const body = modules.get(fileName).lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    return `  // ── src/${fileName} ──\n${body}\n`;
  });
  const bundle = `/* Собран tools/link-web-ide-app.js из packages/web-ide/src/ — править источники, не этот файл. */\n'use strict';\n\n(function () {\n${pieces.join('\n')}}());\n`;

  try {
    new vm.Script(bundle, { filename: 'app.js' });
  } catch (error) {
    throw new Error(`linked Web IDE app.js does not parse: ${error.message}`);
  }
  const leftover = bundle.split('\n').findIndex((line) => /^\s*(import[\s('"]|export[\s{])/.test(line));
  if (leftover >= 0) {
    throw new Error(`linked Web IDE app.js still contains a module keyword at line ${leftover + 1}`);
  }
  return bundle;
}

module.exports = { linkWebIdeApp };
