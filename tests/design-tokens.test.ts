// Страж единого источника токенов дизайна (стилевая база 1.6.4, спека
// Idyllium-backstage/tech/spec/some_style_base/01 §5.9). Падающая часть — свежесть генерата:
// site-tokens.css, design-tokens.js, блоки в frame.css / renderer.css (включая тему окна «idyllium» и
// словарь подсветки кадра) и темы VS Code обязаны совпадать со свежей генерацией из
// packages/design/tokens.js (как у значков) — иначе цвета расходятся молча.
// Отчётная часть (вердикт владельца 2026-09-26: стражи стиля пока отчётные) — контраст текстовых
// ролей на поверхностях в обеих темах.
import { assert, test, runTests } from './smoke-harness';

const fs: any = require('fs');
const path: any = require('path');
const builder: any = require(path.resolve(process.cwd(), 'tools', 'build-tokens.js'));

function read(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

test('design tokens: generated files match the source', () => {
  const outputs = builder.generate() as Record<string, string>;
  const files = Object.keys(outputs);
  assert(files.length === 6, `expected 6 generated targets (tokens css/js, frame, renderer, two VS Code themes), got ${files.length}`);
  for (const relative of files) {
    assert(read(relative) === outputs[relative], `${relative} is stale — run node tools/build-tokens.js`);
  }
});

test('design tokens: every colour role has both themes in one format', () => {
  const colour = /^(?:#[0-9a-f]{6}(?:[0-9a-f]{2})?|rgba?\([0-9., ]+\))$/u;
  const { color, editor, syntax, ansi } = builder.tokens;
  for (const [group, table] of Object.entries({ color, editor, syntax, ansi }) as Array<[string, Record<string, string[]>]>) {
    for (const [name, pair] of Object.entries(table)) {
      assert(Array.isArray(pair) && pair.length === 2, `${group}.${name}: needs [dark, light]`);
      for (const value of pair) assert(colour.test(value), `${group}.${name}: unexpected colour syntax '${value}'`);
    }
  }
  const css = read('packages/web-ide/assets/site-tokens.css');
  assert(css.startsWith('/* ГЕНЕРАТ') && css.includes('@layer tokens, base, content, components, sections;'), 'site-tokens.css must open with the layer order');
  for (const name of builder.cssVariableNames() as string[]) assert(css.includes(`${name}:`), `site-tokens.css must define ${name}`);
  assert(css.includes('html[data-theme="light"]') && css.includes('html[data-density="app"]'), 'site-tokens.css must carry the light theme and the app density');
});

function channel(hex: string, at: number): number {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('design tokens: text roles keep contrast on surfaces (report)', () => {
  const { color } = builder.tokens as { color: Record<string, string[]> };
  const textRoles = ['text', 'text-soft', 'text-muted', 'success', 'warning', 'danger', 'info', 'accent'];
  const surfaces = ['bg', 'panel', 'panel-raised', 'panel-soft', 'code-bg'];
  const low: string[] = [];
  ['dark', 'light'].forEach((theme, index) => {
    for (const role of textRoles) {
      for (const surface of surfaces) {
        const ratio = contrast(color[role][index], color[surface][index]);
        if (ratio < 4.5) low.push(`${theme}: ${role} на ${surface} — ${ratio.toFixed(2)}`);
      }
    }
  });
  // Блок ошибки урока в светлой теме раньше имел 2,1 (§4.2 спеки): у --danger не было светлого значения.
  assert(contrast(color.danger[1], color.panel[1]) >= 4.5, 'light danger text must be readable on a panel');
  assert(contrast(color.success[1], color.panel[1]) >= 4.5, 'light success text must be readable on a panel');
  console.log(low.length === 0
    ? '  контраст: все текстовые роли ≥ 4,5 на всех поверхностях'
    : `  контраст ниже 4,5 (отчёт, ${low.length}):\n    ${low.join('\n    ')}`);
});

void runTests();
