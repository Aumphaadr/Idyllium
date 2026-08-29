import { createDefaultStandardLibrary } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── Страж AI-справки (задача бэклога, 2026-08-29) ───────────────────────────
// docs/ai/idyllium-ai-reference.md — рукописный документ для ИИ-ассистентов
// учеников, и он тихо протухал при росте stdlib (в перечне зарезервированных
// модулей когда-то не оказалось web/http/channel/xml; system жил без
// «use system;»). Полная генерация сознательно НЕ делается — документ
// методический; вместо неё двусторонняя сверка с реестром:
//   1) всё, что объявлено в реестре, обязано быть упомянуто в справке;
//   2) все «модульные вызовы» в справке обязаны существовать в реестре
//      (ловит переименования и удаления), кроме раздела «Do Not Generate» —
//      там нарочно неправильные строки.
// Механические перечни (@generated-якоря) освежает сборка сайта.

// Обе языковые версии справки живут на одних рельсах (просьба владельца,
// 2026-08-29): русский перевод протухал сильнее английского — при первом
// прогоне в нём не было целых разделов 1.5.3/1.5.4 (xml, предупреждения,
// выросший словарь IdySS) и стояло уже НЕВЕРНОЕ правило про имена функций.
const REFERENCES = [
  { file: 'packages/docs/ai/idyllium-ai-reference.md', doNotGenerate: '## 30. Do Not Generate These' },
  { file: 'packages/docs/ai/ru/idyllium-ai-reference.md', doNotGenerate: '## 30. Так порождать нельзя' },
];

function sectionFreeText(document: string, heading: string, file: string): string {
  // Раздел «Do Not Generate These» полон нарочно неправильных вызовов —
  // обратная проверка его пропускает (до следующего заголовка «## »).
  const start = document.indexOf(heading);
  assert(start >= 0, `the "Do Not Generate" section disappeared from ${file}`);
  const end = document.indexOf('\n## ', start + 1);
  return document.slice(0, start) + (end >= 0 ? document.slice(end) : '');
}

function checkReference(reference: { file: string; doNotGenerate: string }): void {
  const document = fs.readFileSync(path.resolve(process.cwd(), reference.file), 'utf8');
  const registry = createDefaultStandardLibrary();
  const modules = registry.listModuleSpecs();
  const globals = registry.listGlobalFunctions();

  // Страж не задремал: реестр действительно прочитан.
  assert(modules.length >= 20, `suspiciously few stdlib modules: ${modules.length}`);
  assert(globals.length >= 8, `suspiciously few global functions: ${globals.length}`);

  const hasWord = (name: string): boolean => (
    new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'u').test(document)
  );

  // 1. Полнота: каждое имя реестра упомянуто в справке.
  const missing: string[] = [];
  for (const moduleSpec of modules) {
    if (!document.includes(`use ${moduleSpec.name};`)) {
      missing.push(`module ${moduleSpec.name} (no "use ${moduleSpec.name};" block)`);
    }
    for (const [functionName] of moduleSpec.functions) {
      if (!document.includes(`${moduleSpec.name}.${functionName}(`) && !document.includes(`${functionName}(`)) {
        missing.push(`${moduleSpec.name}.${functionName}()`);
      }
    }
    for (const [typeName, typeSpec] of moduleSpec.types) {
      if (!hasWord(`${moduleSpec.name}.${typeName}`) && !hasWord(typeName)) {
        missing.push(`type ${moduleSpec.name}.${typeName}`);
      }
      for (const [methodName] of typeSpec.methods ?? new Map()) {
        if (!document.includes(`${methodName}(`)) {
          missing.push(`${moduleSpec.name}.${typeName}.${methodName}()`);
        }
      }
      for (const [propertyName] of typeSpec.properties ?? new Map()) {
        if (!hasWord(propertyName)) {
          missing.push(`${moduleSpec.name}.${typeName}.${propertyName}`);
        }
      }
    }
  }
  for (const globalFunction of globals) {
    if (!document.includes(`${globalFunction.name}(`)) {
      missing.push(`global ${globalFunction.name}()`);
    }
  }
  assert(
    missing.length === 0,
    `${reference.file} does not mention ${missing.length} registry name(s) — the document went stale:\n`
    + missing.join('\n'),
  );
  console.log(`ok - ${reference.file}: every registry name is mentioned (${modules.length} modules, ${globals.length} globals)`);

  // 2. Обратная сторона: модульные вызовы в справке существуют в реестре.
  const moduleByName = new Map(modules.map((moduleSpec) => [moduleSpec.name, moduleSpec]));
  const checkedText = sectionFreeText(document, reference.doNotGenerate, reference.file);
  const phantom: string[] = [];
  const callPattern = /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\(/gu;
  for (const match of checkedText.matchAll(callPattern)) {
    const moduleSpec = moduleByName.get(match[1]);
    if (!moduleSpec) continue; // не имя модуля — переменная в примере
    if (!moduleSpec.functions.has(match[2]) && !moduleSpec.types.has(match[2])) {
      phantom.push(`${match[1]}.${match[2]}()`);
    }
  }
  const uniquePhantom = [...new Set(phantom)];
  assert(
    uniquePhantom.length === 0,
    `${reference.file} mentions module calls that do not exist in the registry (renamed or removed?):\n`
    + uniquePhantom.join('\n'),
  );
  console.log(`ok - ${reference.file}: no phantom module calls outside "Do Not Generate"`);

  // 3. Перечень модулей между @generated-якорями соответствует реестру
  //    (его освежает docs:site; тест ловит «сборку не запустили»).
  const begin = document.indexOf('<!-- @generated:stdlib-module-names -->');
  const end = document.indexOf('<!-- /@generated:stdlib-module-names -->');
  assert(begin >= 0 && end > begin, 'the @generated:stdlib-module-names anchors disappeared');
  const block = document.slice(begin, end);
  const listed = (block.match(/^[a-z][a-z0-9_ ]*$/gmu) ?? []).join(' ').split(/\s+/u).filter(Boolean).sort();
  const expected = modules.map((moduleSpec) => moduleSpec.name).sort();
  assert(
    JSON.stringify(listed) === JSON.stringify(expected),
    `${reference.file}: reserved module list drifted from the registry (run npm run docs:site):\nlisted: ${listed.join(' ')}\nregistry: ${expected.join(' ')}`,
  );
  console.log(`ok - ${reference.file}: reserved module list matches the registry (${expected.length} names)`);
}

try {
  for (const reference of REFERENCES) checkReference(reference);
  console.log(`\npassed: ${REFERENCES.length * 3}`);
  console.log('failed: 0');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
