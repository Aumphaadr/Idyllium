'use strict';

// Сборка токенов дизайна (1.6.4; спека Idyllium-backstage/tech/spec/some_style_base/01, вердикты §9).
// Источник — packages/design/tokens.js (единственное место, где живут цвета, размеры, слои, тени).
// Отсюда собираются четыре вещи, все генерируемые (в git ради страниц и CI; править — только источник):
//   packages/web-ide/assets/site-tokens.css — переменные для всех страниц сайта: слой tokens, обе темы,
//                                             плотность; подключается первым (tools/site-nav.ts);
//   packages/web-ide/src/design-tokens.js   — те же значения для JS: темы Monaco в Web IDE;
//   packages/embed/frame.css                — блок между /* @tokens:frame:start */ … end */: кадр юнита
//                                             живёт на чужих страницах одним файлом и не может грузить
//                                             site-tokens.css, поэтому значения вписываются числами;
//   packages/gui-renderer/renderer.css      — блок между /* @tokens:renderer:start */ … end */: рамка
//                                             предпросмотра окна программы (в VS Code — --vscode-*);
//                                             блок @tokens:renderer-theme — тема окна «idyllium»;
//   packages/vscode-idyllium/themes/*.json  — цветовые темы VS Code: те же редактор и подсветка, что у
//                                             Monaco в Web IDE (этап 6 стилевой базы);
//   кадр юнита также получает из site-components.css словарь подсветки .hl-* (@shared:hl), кнопки
//                                             (@shared:buttons) и поле (@shared:fields) — без ручных копий.
// Запуск: node tools/build-tokens.js (стоит в npm run build перед tsc). Модуль экспортирует generate()
// для стража tests/design-tokens.test.ts — он сверяет файлы в репозитории со свежей генерацией.

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const tokens = require(path.join(rootDir, 'packages', 'design', 'tokens.js'));

const THEMES = ['dark', 'light'];
const GROUPS = [
  ['color', tokens.color],
  ['editor', tokens.editor],
  ['syntax', tokens.syntax],
  ['ansi', tokens.ansi],
  ['shadow', tokens.shadow],
];
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function validate() {
  for (const [group, table] of GROUPS) {
    for (const [name, pair] of Object.entries(table)) {
      if (!NAME_PATTERN.test(name)) throw new Error(`tokens: ${group}.${name} — имя из строчных латинских букв, цифр и дефисов`);
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`tokens: ${group}.${name} — нужна пара [тёмная, светлая]`);
      for (const value of pair) {
        if (typeof value !== 'string' || value.trim() === '') throw new Error(`tokens: ${group}.${name} — пустое значение`);
      }
    }
  }
}

/** Переменные, зависящие от темы: [имя без «--», значение]. */
function themedPairs(themeIndex) {
  const out = [];
  for (const [group, table] of GROUPS) {
    for (const [name, pair] of Object.entries(table)) out.push([`${group}-${name}`, pair[themeIndex]]);
  }
  return out;
}

/** Переменные, общие для тем: шрифты и шкалы. */
function staticPairs() {
  const out = [['font-sans', tokens.fonts.sans], ['font-mono', tokens.fonts.mono]];
  for (const size of tokens.fontSize) out.push([`fs-${size}`, `${size}px`]);
  for (const [name, value] of Object.entries(tokens.lineHeight)) out.push([`lh-${name}`, value]);
  for (const step of tokens.space) out.push([`space-${step}`, `${step}px`]);
  for (const [name, value] of Object.entries(tokens.radius)) out.push([`radius-${name}`, value]);
  for (const [name, value] of Object.entries(tokens.z)) out.push([`z-${name}`, String(value)]);
  for (const [name, value] of Object.entries(tokens.duration)) out.push([`duration-${name}`, value]);
  for (const [name, value] of Object.entries(tokens.layout)) out.push([name, value]);
  return out;
}

/** Все имена переменных, которые объявляет site-tokens.css (для стражей). */
function cssVariableNames() {
  const names = new Set();
  for (const [name] of staticPairs()) names.add(`--${name}`);
  for (const [name] of themedPairs(0)) names.add(`--${name}`);
  for (const name of Object.keys(tokens.density.prose)) names.add(`--${name}`);
  return [...names];
}

const declarations = (pairs, indent) => pairs.map(([name, value]) => `${indent}--${name}: ${value};`).join('\n');

function siteTokensCss() {
  return `/* ГЕНЕРАТ: node tools/build-tokens.js из packages/design/tokens.js — не править руками.
   Токены дизайна сайта Idyllium (1.6.4): роли цвета в обеих темах, редактор, подсветка кода, ANSI,
   тени, шкалы размеров и слоёв, плотность. Подключается первым на каждой странице (tools/site-nav.ts)
   и объявляет порядок слоёв каскада. Тема — html[data-theme] (assets/site-theme.js),
   плотность — html[data-density]: prose (документы) или app (инструменты). */
@layer tokens, base, content, components, sections;

@layer tokens {
  :root {
    color-scheme: dark;
${declarations(staticPairs(), '    ')}
${declarations(Object.entries(tokens.density.prose), '    ')}
${declarations(themedPairs(0), '    ')}
  }

  html[data-theme="light"] {
    color-scheme: light;
${declarations(themedPairs(1), '    ')}
  }

  html[data-density="app"] {
${declarations(Object.entries(tokens.density.app), '    ')}
  }
}
`;
}

function designTokensJs() {
  const table = (pairs) => Object.fromEntries(pairs);
  const body = JSON.stringify({
    dark: table(themedPairs(0)),
    light: table(themedPairs(1)),
    static: table(staticPairs()),
    breakpoints: tokens.breakpoints,
  }, null, 2);
  return `// ГЕНЕРАТ: node tools/build-tokens.js из packages/design/tokens.js — не править руками.
// Токены дизайна для JS (темы Monaco в Web IDE). Имена — как CSS-переменные без «--».
export const DESIGN_TOKENS = Object.freeze(${body});

/** Значение токена темы: token('dark', 'syntax-keyword') → '#b892ff'. */
export function token(theme, name) {
  const table = DESIGN_TOKENS[theme === 'light' ? 'light' : 'dark'];
  if (!(name in table)) throw new Error('design token is missing: ' + name);
  return table[name];
}
`;
}

/** Меняет содержимое между маркерами; маркеры остаются на своих строках. */
function replaceBlock(text, name, body, relative, kind = 'tokens') {
  const start = `/* @${kind}:${name}:start */`;
  const end = `/* @${kind}:${name}:end */`;
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from < 0 || to < 0 || to < from) throw new Error(`${relative}: нет маркеров ${start} … ${end}`);
  return `${text.slice(0, from + start.length)}\n${body}\n${text.slice(to)}`;
}

// Кадр юнита — самодостаточный файл на чужой странице: site-tokens.css он не грузит, поэтому
// получает ВСЕ токены сайта числами под общими именами (--color-*, --editor-*, --syntax-*, --ansi-*,
// шкалы) — и тогда общие блоки компонентов (кнопки, поле) ложатся в него как есть (этап 6–7).
// Рамка предпросмотра окна программы (стол, заголовок окна) — палитра сайта; в VS Code свои --vscode-*.
const RENDERER_VARS = [
  ['panel', 'color-bg'], ['text', 'color-text'], ['muted', 'color-text-muted'], ['border', 'color-border'], ['accent', 'color-accent'],
  ['preview-window-border', 'color-border'], ['preview-titlebar-bg', 'color-panel-raised'],
  ['preview-titlebar-border', 'color-border'], ['preview-titlebar-text', 'color-text'],
];
const RENDERER_SHADOW = ['rgba(0, 0, 0, 0.42)', 'rgba(39, 30, 54, 0.22)'];

function mapped(vars, themeIndex, indent) {
  const table = Object.fromEntries(themedPairs(themeIndex));
  return vars.map(([legacy, tokenName]) => {
    if (!(tokenName in table)) throw new Error(`build-tokens: нет токена ${tokenName} для --${legacy}`);
    return `${indent}--${legacy}: ${table[tokenName]};`;
  }).join('\n');
}

function frameBlock() {
  return `/* ГЕНЕРАТ (tools/build-tokens.js из packages/design/tokens.js): токены сайта под общими именами, тёмная тема — по умолчанию. */
body {
  color-scheme: dark;
${declarations(staticPairs(), '  ')}
${declarations(Object.entries(tokens.density.app), '  ')}
${declarations(themedPairs(0), '  ')}
}

body.theme-light {
  color-scheme: light;
${declarations(themedPairs(1), '  ')}
}`;
}

function rendererBlock() {
  return `/* ГЕНЕРАТ (tools/build-tokens.js из packages/design/tokens.js): рамка предпросмотра в палитре сайта. */
body.theme-dark {
${mapped(RENDERER_VARS, 0, '  ')}
  --preview-window-shadow: ${RENDERER_SHADOW[0]};
}
body.theme-light {
${mapped(RENDERER_VARS, 1, '  ')}
  --preview-window-shadow: ${RENDERER_SHADOW[1]};
}`;
}

// Тема окна программы «idyllium» — из группы windowTheme источника (одна тема, значения — как есть).
function rendererThemeBlock() {
  const lines = Object.entries(tokens.windowTheme).map(([name, value]) => `  --w-${name}: ${value};`);
  return `/* ГЕНЕРАТ (tools/build-tokens.js из packages/design/tokens.js, группа windowTheme): палитра сайта в окне ученика. */
.window.theme-idyllium,
.modal-backdrop.theme-idyllium {
${lines.join('\n')}
}`;
}

// Темы VS Code — тот же редактор и та же подсветка, что у Monaco в Web IDE (monaco-grammar.js):
// цвета редактора из группы editor, слова — из syntax; семантические токены и TextMate-области
// раскрашены одинаково, чтобы базовая раскраска и раскраска компилятора совпадали.
function vscodeTheme(theme) {
  const index = theme === 'light' ? 1 : 0;
  const t = Object.fromEntries(themedPairs(index));
  const colors = {
    'editor.background': t['editor-bg'],
    'editor.foreground': t['editor-text'],
    'editorLineNumber.foreground': t['editor-muted'],
    'editorLineNumber.activeForeground': t['syntax-brackets'],
    'editorCursor.foreground': t['editor-caret'],
    'editor.selectionBackground': t['editor-selection'],
    'editor.inactiveSelectionBackground': t['editor-selection-inactive'],
    'editor.lineHighlightBackground': t['editor-line-highlight'],
    'editor.lineHighlightBorder': '#00000000',
  };
  for (let level = 1; level <= 6; level += 1) colors[`editorBracketHighlight.foreground${level}`] = t['syntax-brackets'];
  Object.assign(colors, {
    'editorBracketMatch.background': t['editor-bracket-match-bg'],
    'editorBracketMatch.border': t['editor-bracket-match-border'],
    'editorIndentGuide.background1': t['editor-indent-guide'],
    'editorIndentGuide.activeBackground1': t['editor-indent-guide-active'],
  });
  for (const value of Object.values(colors)) {
    if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/u.test(value)) throw new Error(`build-tokens: тема VS Code ждёт hex-цвет, получила ${value}`);
  }
  const rule = (scope, tokenName, extra = {}) => ({ scope, settings: { foreground: t[tokenName], ...extra } });
  return `${JSON.stringify({
    $schema: 'vscode://schemas/color-theme',
    name: theme === 'light' ? 'Idyllium Light' : 'Idyllium Dark',
    type: theme,
    semanticHighlighting: true,
    colors,
    semanticTokenColors: {
      namespace: t['syntax-object'],
      class: t['syntax-class'],
      function: t['syntax-function'],
      method: t['syntax-function'],
      property: t['syntax-object'],
      variable: t['syntax-variable'],
      parameter: t['syntax-object'],
      'variable.readonly': t['syntax-object'],
    },
    tokenColors: [
      rule(['keyword.control.idyllium', 'keyword.control.import.idyllium', 'keyword.declaration.idyllium', 'keyword.operator.logical.idyllium', 'constant.language.idyllium', 'variable.language.idyllium'], 'syntax-keyword'),
      rule(['storage.type.primitive.idyllium'], 'syntax-type'),
      rule(['entity.name.type.class.idyllium'], 'syntax-class'),
      rule(['entity.name.function.idyllium', 'entity.name.function.member.idyllium'], 'syntax-function'),
      rule(['entity.name.namespace.idyllium', 'variable.other.member.idyllium', 'variable.other.idyllium'], 'syntax-object'),
      rule(['string.quoted.double.idyllium', 'string.quoted.single.idyllium', 'constant.character.escape.idyllium'], 'syntax-string'),
      rule(['constant.numeric.idyllium'], 'syntax-number'),
      rule(['comment.block.idyllium', 'comment.line.double-slash.idyllium'], 'syntax-comment', { fontStyle: 'italic' }),
      rule(['keyword.operator.idyllium', 'punctuation.idyllium', 'punctuation.accessor.idyllium'], 'syntax-brackets'),
    ],
  }, null, 2)}\n`;
}

// Общий блок компонентов из site-components.css (между /* @имя:start */ и /* @имя:end */), без отступа слоя:
// словарь подсветки .hl-*, семейство кнопок .ui-button, поле .ui-field — кадр юнита берёт их как есть.
function sharedBlock(name, title) {
  const relative = 'packages/web-ide/assets/site-components.css';
  const css = fs.readFileSync(path.join(rootDir, relative), 'utf8');
  const start = css.indexOf(`/* @${name}:start */`);
  const end = css.indexOf(`/* @${name}:end */`);
  if (start < 0 || end < 0 || end < start) throw new Error(`${relative}: нет маркеров /* @${name}:start */ … /* @${name}:end */`);
  const body = css.slice(css.indexOf('\n', start) + 1, end).split('\n').map((line) => line.replace(/^ {2}/u, '')).join('\n').trim();
  return `/* ГЕНЕРАТ (tools/build-tokens.js из ${relative}): ${title}. */\n${body}`;
}

function generate() {
  validate();
  const outputs = {
    'packages/web-ide/assets/site-tokens.css': siteTokensCss(),
    'packages/web-ide/src/design-tokens.js': designTokensJs(),
    'packages/vscode-idyllium/themes/idyllium-dark-color-theme.json': vscodeTheme('dark'),
    'packages/vscode-idyllium/themes/idyllium-light-color-theme.json': vscodeTheme('light'),
  };
  const frame = 'packages/embed/frame.css';
  let frameCss = fs.readFileSync(path.join(rootDir, frame), 'utf8');
  frameCss = replaceBlock(frameCss, 'frame', frameBlock(), frame);
  frameCss = replaceBlock(frameCss, 'hl', sharedBlock('hl', 'словарь подсветки сайта, один на всех'), frame, 'shared');
  frameCss = replaceBlock(frameCss, 'buttons', sharedBlock('buttons', 'кнопки сайта — те же, что в IDE и учебнике'), frame, 'shared');
  outputs[frame] = replaceBlock(frameCss, 'fields', sharedBlock('fields', 'поле ввода сайта'), frame, 'shared');
  const renderer = 'packages/gui-renderer/renderer.css';
  let rendererCss = fs.readFileSync(path.join(rootDir, renderer), 'utf8');
  rendererCss = replaceBlock(rendererCss, 'renderer', rendererBlock(), renderer);
  outputs[renderer] = replaceBlock(rendererCss, 'renderer-theme', rendererThemeBlock(), renderer);
  return outputs;
}

function write() {
  const outputs = generate();
  let changed = 0;
  for (const [relative, content] of Object.entries(outputs)) {
    const target = path.join(rootDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const previous = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (previous !== content) {
      fs.writeFileSync(target, content, 'utf8');
      changed++;
    }
  }
  const roles = GROUPS.reduce((sum, [, table]) => sum + Object.keys(table).length, 0);
  console.log(`Idyllium design tokens: ${roles} colour roles, ${staticPairs().length} scale values → ${Object.keys(outputs).length} files${changed ? ` (${changed} updated)` : ' (up to date)'}`);
}

module.exports = { generate, tokens, THEMES, themedPairs, staticPairs, cssVariableNames };

if (require.main === module) write();
