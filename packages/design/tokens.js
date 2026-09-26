'use strict';

// Единый источник токенов дизайна сайта Idyllium (1.6.4). Спека —
// Idyllium-backstage/tech/spec/some_style_base/01, вердикты владельца §9 (2026-09-26):
// палитра документная, подсветка кода — палитра Monaco, одна тема на весь сайт.
//
// Отсюда tools/build-tokens.js собирает (всё — генерат, править только этот файл):
//   packages/web-ide/assets/site-tokens.css  — переменные для всех страниц (слой tokens);
//   packages/web-ide/src/design-tokens.js    — те же значения для JS (темы Monaco);
//   блоки между маркерами /* @tokens:…:start */ … /* @tokens:…:end */ в packages/embed/frame.css
//   (кадр юнита живёт на чужих страницах одним файлом) и packages/gui-renderer/renderer.css
//   (рамка предпросмотра окна программы).
//
// Правила. Цвет, размер, слой, тень, длительность живут ТОЛЬКО здесь; в файлах разделов —
// var(--…). Каждая цветовая роль обязана иметь значение в обеих темах: [тёмная, светлая].
// Компоненты пользуются ролями (bg, panel, text, accent…), а не оттенками.

const fonts = {
  sans: '"Geologica", system-ui, -apple-system, "Segoe UI", Inter, Arial, sans-serif',
  mono: '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

/** Цветовые роли → [тёмная, светлая]. */
const color = {
  // поверхности
  bg: ['#0c0515', '#ece8f2'],
  panel: ['#151020', '#f7f4fb'],
  'panel-raised': ['#1c1629', '#e9e2f0'],
  'panel-soft': ['#241d34', '#ded6e8'],
  'panel-active': ['#2d2346', '#d6cce3'],
  'panel-active-hover': ['#372b55', '#cbbfdb'],
  'code-bg': ['#100b1a', '#f2edf7'],
  'topbar-bg': ['rgba(12, 5, 21, 0.92)', 'rgba(246, 242, 251, 0.92)'],
  scene: ['#1a1326', '#dfd8e8'],
  backdrop: ['rgba(6, 2, 12, 0.55)', 'rgba(33, 26, 46, 0.35)'],
  // текст
  text: ['#f2eaf7', '#211a2e'],
  'text-soft': ['#c9bdd6', '#463b56'],
  'text-muted': ['#8e819d', '#6d637b'],
  'on-accent': ['#0c0515', '#ffffff'],
  'on-solid': ['#ffffff', '#ffffff'],
  // рамки
  border: ['#342846', '#c8bed5'],
  'border-soft': ['rgba(255, 255, 255, 0.08)', 'rgba(33, 26, 46, 0.14)'],
  // акцент
  accent: ['#87bfff', '#275f9e'],
  'accent-strong': ['#a3ceff', '#1d4d82'],
  'accent-soft': ['rgba(135, 191, 255, 0.12)', 'rgba(39, 95, 158, 0.13)'],
  // статусы: текст и подложка (светлые значения — контраст текста не ниже 4,5)
  success: ['#8bd58f', '#1d7a45'],
  'success-bg': ['rgba(139, 213, 143, 0.14)', 'rgba(29, 122, 69, 0.12)'],
  warning: ['#f5d98b', '#8a6100'],
  'warning-bg': ['rgba(245, 217, 139, 0.14)', 'rgba(138, 97, 0, 0.12)'],
  danger: ['#f38ba8', '#b3261e'],
  'danger-bg': ['rgba(243, 139, 168, 0.14)', 'rgba(179, 38, 30, 0.10)'],
  info: ['#b9d4ff', '#234b73'],
  'info-bg': ['rgba(135, 191, 255, 0.12)', 'rgba(39, 95, 158, 0.13)'],
  // действия
  run: ['#179f5b', '#177b49'],
  'run-hover': ['#1fba6d', '#12683d'],
  stop: ['#c7728a', '#931f19'],
  'stop-hover': ['#f38ba8', '#b3261e'],
  // служебные
  focus: ['#87bfff', '#275f9e'],
  selection: ['rgba(135, 191, 255, 0.28)', 'rgba(39, 95, 158, 0.22)'],
};

/** Редактор кода: Monaco в IDE и лёгкий редактор кадра. Прозрачные значения — hex8: годятся и CSS, и Monaco. */
const editor = {
  bg: color['code-bg'],
  text: color.text,
  muted: ['#777088', '#77717f'],
  caret: ['#ffffff', '#211a2e'],
  selection: ['#87bfff45', '#275f9e38'],
  'selection-inactive': ['#87bfff24', '#275f9e1c'],
  'line-highlight': ['#ffffff07', '#275f9e0b'],
  'indent-guide': ['#2a2038', '#c4c0ca'],
  'indent-guide-active': ['#4a405c', '#9c95a4'],
  'bracket-match-bg': color['panel-soft'],
  'bracket-match-border': ['#87bfff66', '#275f9e88'],
  'widget-bg': color['panel-raised'],
  'widget-border': color.border,
  'suggest-highlight': color['accent-strong'],
  'suggest-selected': ['#37405e', '#c2c8e0'],
};

/** Подсветка кода — палитра Monaco (вердикт §9.2): одна для Monaco, учебника, справочника, конструктора и кадра. */
const syntax = {
  keyword: ['#b892ff', '#8d3f75'],
  type: ['#63b3ff', '#1d659a'],
  class: ['#59d4b8', '#1b745c'],
  function: ['#e4d87e', '#76620f'],
  object: ['#8bdfff', '#0d667f'],
  string: ['#d99a6c', '#87481f'],
  number: ['#c5d979', '#5b7027'],
  comment: ['#6ba36f', '#477237'],
  brackets: ['#d0d6e6', '#445253'],
  'json-key': ['#8bdfff', '#0d667f'],
  constant: ['#f5d98b', '#87481f'],
  variable: color.text,
};

/** Тема окна программы «idyllium» (gui.Window.theme) — палитра сайта в окне ученика (стилевая база,
 *  этап 6: значения берутся отсюда сборкой в renderer.css, ручной копии нет). Тема одна, светлой
 *  пары у неё нет; оттенки без роли в палитре (рамка, поля, кнопка) заданы числами здесь. */
const windowTheme = {
  'window-bg': color.panel[0],
  'window-text': color.text[0],
  'titlebar-bg': color['panel-raised'][0],
  'titlebar-text': color.text[0],
  'titlebar-border': color.border[0],
  border: '#3d3154',
  'control-bg': '#1f1830',
  'control-text': color.text[0],
  'control-hover': '#2c2440',
  'button-bg': 'linear-gradient(180deg, #2a2240, #211a33)',
  'button-text': color.text[0],
  'frame-bg': 'rgba(135, 191, 255, 0.06)',
  track: 'rgba(135, 191, 255, 0.14)',
  accent: color.accent[0],
  'accent-soft': 'rgba(135, 191, 255, 0.32)',
  'accent-text': color.bg[0],
  muted: '#a396b8',
  link: '#9fd0ff',
  'link-hover': '#ffffff',
  'label-shadow': 'rgba(0, 0, 0, 0.55)',
  'color-scheme': 'dark',
  radius: '7px',
  // На тёмном фиолетовом серость выглядит грязно: гасим сильнее, обесцвечиваем мягче.
  'disabled-opacity': '0.45',
  'disabled-grayscale': '55%',
};

/** 16 цветов ANSI консоли (эталон — Web IDE). */
const ansi = {
  black: ['#59606d', '#24292f'],
  red: ['#ff6b6b', '#b3261e'],
  green: ['#77d787', '#17691f'],
  yellow: ['#f2d35e', '#7a5800'],
  blue: ['#71a7ff', '#1247a4'],
  magenta: ['#f38ba8', '#99236d'],
  cyan: ['#67d9e8', '#156970'],
  white: ['#edf3ff', '#57606a'],
  'bright-black': ['#8b93a3', '#57606a'],
  'bright-red': ['#ff8f8f', '#b93737'],
  'bright-green': ['#9af5aa', '#1c7032'],
  'bright-yellow': ['#ffe382', '#855c00'],
  'bright-blue': ['#99c2ff', '#0550ae'],
  'bright-magenta': ['#ffadd2', '#7440c7'],
  'bright-cyan': ['#8ef5ff', '#176b72'],
  'bright-white': ['#ffffff', '#5c6570'],
};

const shadow = {
  raised: ['0 2px 7px rgba(0, 0, 0, 0.42)', '0 2px 7px rgba(39, 30, 54, 0.22)'],
  popup: ['0 18px 44px rgba(0, 0, 0, 0.32)', '0 18px 44px rgba(39, 30, 54, 0.16)'],
  floating: ['0 18px 44px rgba(0, 0, 0, 0.34)', '0 18px 44px rgba(39, 30, 54, 0.18)'],
  dialog: ['0 24px 60px rgba(0, 0, 0, 0.45)', '0 24px 60px rgba(39, 30, 54, 0.22)'],
};

/** Шкалы (не зависят от темы). */
const fontSize = [11, 12, 13, 14, 16, 18, 21, 24, 32, 40];
const lineHeight = { tight: '1.3', ui: '1.45', text: '1.6', prose: '1.68' };
const space = [2, 4, 6, 8, 12, 16, 20, 24, 32];
const radius = { 4: '4px', 6: '6px', 8: '8px', 12: '12px', pill: '999px' };
const z = { sticky: 20, drawer: 40, topbar: 50, menu: 60, popover: 200, floating: 250, dialog: 300, lens: 400 };
const duration = { fast: '120ms', base: '160ms', slow: '250ms' };
const layout = { 'topbar-height': '56px', 'sidebar-width': '330px', 'toc-width': '236px' };

/** Плотность страницы: документы читают как книгу, инструменты устроены как приложение. */
const density = {
  prose: { 'font-size-body': '18px', 'line-height-body': lineHeight.prose },
  app: { 'font-size-body': '14px', 'line-height-body': lineHeight.ui },
};

/** Точки перелома, px. В @media переменные не работают — значения сторожит тест (tests/style-guards.test.ts):
 *  phone — телефон; small — узкий телефон/половина экрана; compact — планшет в портрете; narrow — скрытие
 *  боковой колонки документов; medium — узкая шапка IDE и конструктор; wide — оглавление документов. */
const breakpoints = { phone: 480, small: 640, compact: 720, narrow: 820, medium: 980, wide: 1200 };

module.exports = { fonts, color, editor, syntax, windowTheme, ansi, shadow, fontSize, lineHeight, space, radius, z, duration, layout, density, breakpoints };
