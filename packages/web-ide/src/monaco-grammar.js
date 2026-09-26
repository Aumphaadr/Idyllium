// Грамматика Idyllium для Monaco: регистрация языка, конфигурация, Monarch-
// токенизатор и темы — БЕЗ зависимостей от Web IDE. Общий источник для IDE
// (monaco-lang.js) и embed-юнитов (packages/embed/src/frame.js): подсветка
// в юните на чужом сайте обязана совпадать с подсветкой в IDE.

import { KEYWORDS, BUILTIN_TYPES, CLASS_NAMES, QUALIFIED_TYPES } from './idyllium-highlight.js';
import { DESIGN_TOKENS } from './design-tokens.js';

export const MONACO_LANGUAGE_ID = 'idyllium';

export function registerIdylliumGrammar(monaco) {
  monaco.languages.register({
    id: MONACO_LANGUAGE_ID,
    extensions: ['.idyl'],
    aliases: ['Idyllium', 'idyllium'],
  });
  monaco.languages.setLanguageConfiguration(MONACO_LANGUAGE_ID, {
    comments: { lineComment: '//' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{\s*(?:\/\/.*)?$/u,
      decreaseIndentPattern: /^\s*\}/u,
    },
    onEnterRules: [
      {
        beforeText: /^.*\{\s*$/u,
        afterText: /^\s*\}/u,
        action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
      },
      {
        beforeText: /^.*\{\s*$/u,
        action: { indentAction: monaco.languages.IndentAction.Indent },
      },
    ],
    wordPattern: /[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u,
  });
  monaco.languages.setMonarchTokensProvider(MONACO_LANGUAGE_ID, {
    keywords: [...KEYWORDS],
    builtinTypes: [...BUILTIN_TYPES],
    classNames: [...CLASS_NAMES],
    qualifiedTypes: [...QUALIFIED_TYPES],
    tokenizer: {
      root: [
        [/\/\/.*$/u, 'comment'],
        [/\/\*/u, { token: 'comment', next: '@blockComment' }],
        [/"(?:\\.|[^"\\])*"/u, 'string'],
        [/'(?:\\.|[^'\\])*'/u, 'string'],
        [/\b\d+(?:\.\d+)?\b/u, 'number'],
        [/(class|extends)(\s+)([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)/u, [
          'keyword.idyllium',
          '',
          'className.idyllium',
        ]],
        [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*(?=\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$))/u, 'className.idyllium'],
        [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*(?=\s*\()/u, {
          cases: {
            '@keywords': 'keyword.idyllium',
            '@builtinTypes': 'typeName.idyllium',
            '@classNames': 'className.idyllium',
            '@default': 'function.idyllium',
          },
        }],
        [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u, {
          cases: {
            '@keywords': 'keyword.idyllium',
            '@builtinTypes': 'typeName.idyllium',
            '@classNames': 'className.idyllium',
            '@default': 'object.idyllium',
          },
        }],
        [/\./u, { token: 'brackets.idyllium', next: '@afterDot' }],
        [/==|!=|<=|>=|\+=|-=|\*=|\/=/u, 'brackets.idyllium'],
        [/[+\-*/<>=!{}()[\];,.:~]/u, 'brackets.idyllium'],
      ],
      afterDot: [
        [/\s+/u, ''],
        [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*(?=\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$))/u, {
          token: 'className.idyllium',
          next: '@pop',
        }],
        [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*(?=\s*\()/u, {
          cases: {
            '@qualifiedTypes': { token: 'className.idyllium', next: '@pop' },
            '@classNames': { token: 'className.idyllium', next: '@pop' },
            '@default': { token: 'function.idyllium', next: '@pop' },
          },
        }],
        [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u, {
          cases: {
            '@qualifiedTypes': { token: 'className.idyllium', next: '@pop' },
            '@classNames': { token: 'className.idyllium', next: '@pop' },
            '@default': { token: 'object.idyllium', next: '@pop' },
          },
        }],
        [/./u, { token: 'brackets.idyllium', next: '@pop' }],
      ],
      blockComment: [
        [/[^*/]+/u, 'comment'],
        [/\*\//u, { token: 'comment', next: '@pop' }],
        [/./u, 'comment'],
      ],
    },
  });
}

// Темы Monaco — из единого источника токенов (packages/design/tokens.js → src/design-tokens.js,
// стилевая база 1.6.4): та же палитра и та же подсветка, что в учебнике, справочнике, конструкторе
// и кадре юнита. Правило цвета Monaco берёт шесть шестнадцатеричных цифр без «#».
function monacoTheme(name) {
  const t = DESIGN_TOKENS[name];
  const fg = (tokenName) => t[tokenName].replace('#', '');
  const brackets = fg('syntax-brackets');
  const colors = {
    'focusBorder': '#00000000',
    'editor.background': t['editor-bg'],
    'editor.foreground': t['editor-text'],
    'editorLineNumber.foreground': t['editor-muted'],
    'editorLineNumber.activeForeground': t['syntax-brackets'],
    'editorCursor.foreground': t['editor-caret'],
    'editor.selectionBackground': t['editor-selection'],
    'editor.inactiveSelectionBackground': t['editor-selection-inactive'],
    'editor.lineHighlightBackground': t['editor-line-highlight'],
    'editor.lineHighlightBorder': '#00000000',
    'editorBracketMatch.background': t['editor-bracket-match-bg'],
    'editorBracketMatch.border': t['editor-bracket-match-border'],
    'editorIndentGuide.background1': t['editor-indent-guide'],
    'editorIndentGuide.activeBackground1': t['editor-indent-guide-active'],
    'editorGutter.background': t['editor-bg'],
    'editorSuggestWidget.background': t['editor-widget-bg'],
    'editorSuggestWidget.border': t['editor-widget-border'],
    'editorSuggestWidget.foreground': t['editor-text'],
    'editorSuggestWidget.highlightForeground': t['editor-suggest-highlight'],
    'editorSuggestWidget.selectedBackground': t['editor-suggest-selected'],
    'editorWidget.background': t['editor-widget-bg'],
    'editorWidget.border': t['editor-widget-border'],
  };
  for (let level = 1; level <= 6; level += 1) colors[`editorBracketHighlight.foreground${level}`] = t['syntax-brackets'];
  return {
    base: name === 'light' ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.idyllium', foreground: fg('syntax-keyword') },
      { token: 'typeName.idyllium', foreground: fg('syntax-type') },
      { token: 'className.idyllium', foreground: fg('syntax-class') },
      { token: 'function.idyllium', foreground: fg('syntax-function') },
      { token: 'object.idyllium', foreground: fg('syntax-object') },
      { token: 'namespace', foreground: fg('syntax-object') },
      { token: 'class', foreground: fg('syntax-class') },
      { token: 'function', foreground: fg('syntax-function') },
      { token: 'method', foreground: fg('syntax-function') },
      { token: 'property', foreground: fg('syntax-object') },
      { token: 'variable', foreground: fg('syntax-variable') },
      { token: 'parameter', foreground: fg('syntax-object') },
      { token: 'variable.readonly', foreground: fg('syntax-object') },
      { token: 'brackets.idyllium', foreground: brackets },
      { token: 'string.key.json', foreground: fg('syntax-json-key') },
      { token: 'string.value.json', foreground: fg('syntax-string') },
      { token: 'number.json', foreground: fg('syntax-number') },
      { token: 'keyword.json', foreground: fg('syntax-keyword') },
      { token: 'delimiter.bracket.json', foreground: brackets },
      { token: 'delimiter.array.json', foreground: brackets },
      { token: 'delimiter.colon.json', foreground: brackets },
      { token: 'delimiter.comma.json', foreground: brackets },
      { token: 'comment.line.json', foreground: fg('syntax-comment'), fontStyle: 'italic' },
      { token: 'comment.block.json', foreground: fg('syntax-comment'), fontStyle: 'italic' },
      { token: 'string', foreground: fg('syntax-string') },
      { token: 'number', foreground: fg('syntax-number') },
      { token: 'comment', foreground: fg('syntax-comment'), fontStyle: 'italic' },
    ],
    colors,
  };
}

export function defineIdylliumThemes(monaco) {
  monaco.editor.defineTheme('idyllium-dark', monacoTheme('dark'));
  monaco.editor.defineTheme('idyllium-light', monacoTheme('light'));
}
