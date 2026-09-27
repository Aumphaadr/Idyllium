// Стражи стилевой базы сайта (спека Idyllium-backstage/tech/spec/some_style_base/01 §5.9, этап 7).
// Каждый страж печатает найденное; исключения перечислены здесь же словами. Изначально стражи были
// отчётными (вердикт владельца 2026-09-26, §9.10), с 2026-09-27 — падающие (FAILING): нарушение вне
// исключений валит тесты. Свежесть генератов сторожит отдельный падающий страж
// (design-tokens.test.ts), контраст ролей — там же отчётом, набор стилей на каждой странице и
// запрет шапки/базы в разделах — smoke-tooling.test.ts.
import { assert, test, runTests } from './smoke-harness';

const fs: any = require('fs');
const path: any = require('path');
const tokens: any = require(path.resolve(process.cwd(), 'packages', 'design', 'tokens.js'));

// Падающий режим включён 2026-09-27 (хвосты этапа 7): отчёт был нулевым по всем стражам.
const FAILING = true;

/** Источники стилей сайта: слой и роль (см. §5.2 спеки). Чужие домены (кадр юнита, рендерер) —
 *  самодостаточные файлы со своей системой: их литералы и глобальные селекторы разрешены, но считаются. */
const SOURCES: ReadonlyArray<{ file: string; layer: 'tokens' | 'base' | 'content' | 'components' | 'sections' | 'fixes' | 'foreign' }> = [
  { file: 'packages/web-ide/assets/site-tokens.css', layer: 'tokens' },
  { file: 'packages/web-ide/assets/site-base.css', layer: 'base' },
  { file: 'packages/fonts/fonts.css', layer: 'base' },
  { file: 'packages/web-ide/assets/site-content.css', layer: 'content' },
  { file: 'packages/web-ide/assets/site-components.css', layer: 'components' },
  { file: 'packages/web-ide/assets/color-picker.css', layer: 'components' },
  { file: 'packages/web-ide/app.css', layer: 'sections' },
  { file: 'packages/docs-book/app.css', layer: 'sections' },
  { file: 'packages/docs-reference/app.css', layer: 'sections' },
  { file: 'packages/docs-site/docs-shell.css', layer: 'sections' },
  { file: 'packages/docs-site/handouts.css', layer: 'sections' },
  { file: 'packages/docs-site/about.css', layer: 'sections' },
  { file: 'packages/docs-site/stub.css', layer: 'sections' },
  { file: 'packages/docs-site/not-found.css', layer: 'sections' },
  { file: 'packages/embed/authors/authors.css', layer: 'sections' },
  { file: 'packages/gui-designer/designer.css', layer: 'sections' },
  { file: 'packages/web-ide/monaco-fixes.css', layer: 'fixes' },
  { file: 'packages/embed/frame.css', layer: 'foreign' },
  { file: 'packages/gui-renderer/renderer.css', layer: 'foreign' },
];

/** Префиксы компонентов: класс с таким префиксом определяется только в файле компонентов
 *  (color- — генератор цвета, свой файл; hl- — словарь подсветки). */
const COMPONENT_PREFIXES: ReadonlyArray<{ prefix: string; file: string }> = [
  { prefix: 'ui-', file: 'packages/web-ide/assets/site-components.css' },
  { prefix: 'hl-', file: 'packages/web-ide/assets/site-components.css' },
  { prefix: 'color-picker', file: 'packages/web-ide/assets/color-picker.css' },
  { prefix: 'color-slider', file: 'packages/web-ide/assets/color-picker.css' },
];

interface Rule { selector: string; body: string; line: number; media: string | null }

function read(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

/** Текст без генерированных блоков (@tokens:*, @shared:*) и комментариев; переводы строк сохраняются. */
function handWritten(css: string): string {
  return css
    .replace(/\/\* @(?:tokens|shared):[a-z-]+:start \*\/[\s\S]*?\/\* @(?:tokens|shared):[a-z-]+:end \*\//gu, (block) => block.replace(/[^\n]/gu, ''))
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ''));
}

/** Правила файла: селектор, тело, строка, ближайший @media. @layer/@media разворачиваются, @font-face/@keyframes — нет. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const walk = (text: string, offset: number, media: string | null): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 0;
      let close = open;
      while (close < text.length) {
        if (text[close] === '{') depth += 1;
        else if (text[close] === '}') { depth -= 1; if (depth === 0) break; }
        close += 1;
      }
      const body = text.slice(open + 1, close);
      const line = css.slice(0, offset + i + (text.slice(i, open).search(/\S/u))).split('\n').length;
      if (head.startsWith('@')) {
        if (/^@(?:layer|media|supports|container)\b/u.test(head)) {
          walk(body, offset + open + 1, head.startsWith('@media') ? head : media);
        } else if (!/^@(?:font-face|keyframes|-webkit-keyframes|import|charset)\b/u.test(head)) {
          out.push({ selector: head, body, line, media });
        }
      } else if (head) {
        out.push({ selector: head, body, line, media });
      }
      i = close + 1;
    }
  };
  walk(handWritten(css), 0, null);
  return out;
}

function report(title: string, items: readonly string[], allowedNote = ''): void {
  const head = `  ${title}: ${items.length}${allowedNote ? ` (${allowedNote})` : ''}`;
  console.log(items.length === 0 ? `${head} — чисто` : `${head}\n    ${items.slice(0, 40).join('\n    ')}${items.length > 40 ? `\n    … ещё ${items.length - 40}` : ''}`);
  if (FAILING) assert(items.length === 0, `${title}: ${items.length} нарушений`);
}

const sources = SOURCES.map((source) => ({ ...source, css: read(source.file), rules: rules(read(source.file)) }));
const bySite = sources.filter((source) => source.layer !== 'foreign' && source.layer !== 'tokens');

test('стиль П1: литералы цвета — только в источнике токенов (отчёт)', () => {
  // Разрешено: генерат (исключён), файл поправок Monaco, чужие домены (темы окна программы, кадр);
  // физические цвета шкал генератора цвета (#000000/#ff0000/…: это ось канала, не палитра) и
  // константы смешивания #000000/#ffffff внутри color-mix(); тёмное поле единственной ручной
  // имитации (кот на WASD — цвет холста программы, не сайта).
  const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/gu;
  const allowed = (file: string, line: string): boolean => {
    if (file.endsWith('color-picker.css') && /linear-gradient\(|var\(--preview-rgb/u.test(line)) return true;
    if (/color-mix\([^)]*#(?:000000|ffffff)\b/u.test(line)) return true;
    if (file.endsWith('site-content.css') && /canvas-sprite-surface|rgb\(20, 24, 32\)|rgba\(255, 255, 255, 0\.58\)/u.test(line)) return true;
    return false;
  };
  const found: string[] = [];
  for (const source of bySite) {
    if (source.layer === 'fixes') continue;
    handWritten(source.css).split('\n').forEach((line, index) => {
      const hits = line.match(literal);
      if (!hits || allowed(source.file, line)) return;
      found.push(`${source.file}:${index + 1}: ${hits.join(' ')}`);
    });
  }
  report('П1 литералы цвета вне токенов', found, 'кроме шкал генератора цвета, констант color-mix и поля кота');
});

test('стиль П2: !important — только в поправках сторонних библиотек (отчёт)', () => {
  // Разрешено: monaco-fixes.css; [hidden] в базе (атрибут обязан побеждать любой display);
  // чужие домены — свои файлы.
  const found: string[] = [];
  for (const source of bySite) {
    if (source.layer === 'fixes') continue;
    handWritten(source.css).split('\n').forEach((line, index) => {
      if (!line.includes('!important')) return;
      if (source.layer === 'base' && /display: none !important/u.test(line)) return;
      found.push(`${source.file}:${index + 1}`);
    });
  }
  report('П2 !important вне monaco-fixes.css', found, 'кроме [hidden] базы');
});

test('стиль П3: глобальные селекторы элементов — только в базе (отчёт)', () => {
  // Селектор без класса, id и атрибута (button, table, a, h2 …) вне базы; в слое содержимого
  // допустим только под .prose/.docs-section — там он не глобальный.
  const found: string[] = [];
  for (const source of bySite) {
    if (source.layer === 'base') continue;
    for (const rule of source.rules) {
      for (const part of rule.selector.split(',')) {
        const selector = part.trim();
        if (!selector || selector.startsWith('@')) continue;
        if (/[.#[]/u.test(selector) || /:root|:where|:is\(/u.test(selector)) continue;
        if (/^(?:from|to|\d+%)$/u.test(selector)) continue;
        found.push(`${source.file}:${rule.line}: ${selector}`);
      }
    }
  }
  report('П3 глобальные селекторы вне базы', found);
});

/** Свойства раскладки: только их разделу можно писать компоненту (§5.2 — «раздел побеждает компонент
 *  только там, где ему это разрешено (раскладка)»); вид компонента (цвет, шрифт, рамка) — нет. */
const LAYOUT_PROPS = new Set([
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'flex', 'flex-grow', 'flex-shrink', 'flex-basis',
  'align-self', 'justify-self', 'order', 'grid-area', 'grid-column', 'grid-row', 'margin', 'margin-top', 'margin-right',
  'margin-bottom', 'margin-left', 'margin-inline', 'margin-block', 'position', 'top', 'right', 'bottom', 'left', 'inset', 'display',
]);

function onlyLayout(body: string): boolean {
  const props = body.split(';').map((declaration) => declaration.split(':')[0].trim()).filter(Boolean);
  return props.length > 0 && props.every((prop) => LAYOUT_PROPS.has(prop));
}

test('стиль П4: класс компонента — в одном файле; разделы не стилизуют компоненты (отчёт)', () => {
  const found: string[] = [];
  for (const source of bySite) {
    for (const rule of source.rules) {
      for (const cls of rule.selector.match(/\.[a-zA-Z_][\w-]*/gu) ?? []) {
        const name = cls.slice(1);
        const owner = COMPONENT_PREFIXES.find((entry) => name.startsWith(entry.prefix));
        if (!owner || owner.file === source.file) continue;
        if (onlyLayout(rule.body)) continue; // раскладка компонента внутри раздела — можно
        found.push(`${source.file}:${rule.line}: ${cls} — ${rule.body.trim().split(/\s*;\s*/u).filter(Boolean).map((d) => d.split(':')[0]).join(', ')}`);
      }
    }
  }
  report('П4 классы компонентов вне своего файла (не раскладка)', found, 'ui-, hl-, color-picker/color-slider');
});

test('стиль П5: каждая var() определена в токенах или в своём файле (отчёт)', () => {
  const tokensCss = read('packages/web-ide/assets/site-tokens.css');
  const defined = new Set((tokensCss.match(/--[\w-]+(?=\s*:)/gu) ?? []));
  const found: string[] = [];
  for (const source of bySite) {
    const local = new Set(source.css.match(/--[\w-]+(?=\s*:)/gu) ?? []);
    handWritten(source.css).split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/var\((--[\w-]+)/gu)) {
        const name = match[1];
        if (defined.has(name) || local.has(name)) continue;
        // Переменные-параметры, которые ставит скрипт или разметка: --depth у строки файла, --preview-* у
        // генератора цвета, размеры панелей IDE от разделителей и баннера гостя, шрифт в просмотре ассета.
        if (/^--(?:depth|preview-|vscode-|guest-banner-height|files-width|runtime-width|output-height|asset-font-)/u.test(name)) continue;
        found.push(`${source.file}:${index + 1}: ${name}`);
      }
    });
  }
  report('П5 висячие var()', found, 'кроме параметров скриптов: --depth, --preview-*, размеры панелей IDE, шрифт ассета');
});

test('стиль П6: ширины @media — из шкалы; z-index — из шкалы или локальный 1–5 (отчёт)', () => {
  const scale = new Set<number>(Object.values(tokens.breakpoints as Record<string, number>));
  const found: string[] = [];
  for (const source of bySite) {
    handWritten(source.css).split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/(min|max)-width:\s*(\d+)px/gu)) {
        if (!/@media/u.test(line)) continue;
        const width = Number(match[2]);
        // min-width — следующая точка после max: шкала + 1.
        const ok = scale.has(width) || (match[1] === 'min' && scale.has(width - 1));
        if (!ok) found.push(`${source.file}:${index + 1}: ${match[0]}`);
      }
      for (const match of line.matchAll(/z-index:\s*(-?\d+)/gu)) {
        const value = Number(match[1]);
        if (value >= 0 && value <= 5) continue;
        found.push(`${source.file}:${index + 1}: z-index ${value}`);
      }
    });
  }
  report(`П6 ширины @media вне шкалы (${[...scale].sort((a, b) => a - b).join('/')}) и z-index вне шкалы`, found);
});

test('стиль П7: уроки без <style>, без цветов, style="" — только геометрия (отчёт)', () => {
  const root = path.resolve(process.cwd(), 'packages', 'docs', 'manual-content');
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(full, 'utf8') as string;
      const relative = path.relative(process.cwd(), full);
      if (/<style\b/u.test(html)) found.push(`${relative}: <style>`);
      for (const match of html.matchAll(/ style="([^"]*)"/gu)) {
        const declarations = match[1];
        if (/color|background|border(?!-radius)|fill|stroke|font|shadow|opacity/u.test(declarations)) found.push(`${relative}: style="${declarations}"`);
      }
    }
  };
  walk(root);
  report('П7 стили и цвета в уроках', found);
});

test('стиль П9: @font-face — только в fonts.css; лишних шрифтов на сайте нет (отчёт)', () => {
  const found: string[] = [];
  for (const source of bySite) {
    if (source.file === 'packages/fonts/fonts.css') continue;
    if (/@font-face/u.test(handWritten(source.css))) found.push(`${source.file}: @font-face`);
  }
  // Чужие домены объявляют свои @font-face сами (кадр — свой файл на чужой странице, рендерер — шрифт холста).
  const referenced = ['packages/fonts/fonts.css', 'packages/embed/frame.css', 'packages/gui-renderer/renderer.css'].map(read).join('\n');
  const fontsDir = path.resolve(process.cwd(), 'packages', 'fonts');
  for (const name of fs.readdirSync(fontsDir) as string[]) {
    if (!/\.(?:woff2?|ttf|otf)$/u.test(name)) continue;
    if (!referenced.includes(name)) found.push(`packages/fonts/${name}: файл шрифта никто не подключает`);
  }
  report('П9 @font-face вне fonts.css и неиспользуемые шрифты', found, 'кадр и рендерер — свои');
});

test('стиль: сводка по источникам', () => {
  const lines = sources.map((source) => `${source.file.padEnd(52)} ${source.layer.padEnd(10)} правил ${String(source.rules.length).padStart(4)}`);
  console.log(`  ${lines.join('\n  ')}`);
  assert(sources.every((source) => source.rules.length > 0 || source.layer === 'tokens' || /@font-face/u.test(source.css)), 'у каждого источника есть правила');
});

void runTests();
