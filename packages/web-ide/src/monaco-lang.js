// Язык Idyllium в Monaco: регистрация, конфигурация, темы, провайдеры
// (completions/подписи/семантические токены) и мапперы диагностик.
// Жизненный цикл редактора остаётся в ядре.

import { KEYWORDS, BUILTIN_TYPES, CLASS_NAMES, QUALIFIED_TYPES } from './idyllium-highlight.js';
import { MAIN_FILE, normalizeWorkspacePath } from './workspace-paths.js';
import { files } from './project-store.js';
import { viewerHost } from './viewer-host.js';
import { setStatus } from './console-output.js';
import { textSourceMap } from './run-preview.js';

export const MONACO_LANGUAGE_ID = 'idyllium';

export const SEMANTIC_TOKEN_TYPES = [...window.Idyllium.IDYLLIUM_SEMANTIC_TOKEN_TYPES];

export const SEMANTIC_TOKEN_MODIFIERS = [...window.Idyllium.IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS];

export function registerMonacoIdyllium() {
  const monaco = window.monaco;
  if (!monaco || monaco.languages.getLanguages().some((language) => language.id === MONACO_LANGUAGE_ID)) return;

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
  monaco.languages.registerCompletionItemProvider(MONACO_LANGUAGE_ID, {
    triggerCharacters: ['.', ' ', '(', ','],
    provideCompletionItems(model, position, context) {
      const request = monacoCompletionRequest(model, position, context);
      if (!request) return { suggestions: [] };

      const items = projectCompletions(model.uri.path || viewerHost.currentFile(), model.getValue(), request.requestOffset)
        .filter((item) => {
          if (request.kind === 'use' && item.kind !== 'module') return false;
          if (!request.prefix) return true;
          return item.name.toLowerCase().startsWith(request.prefix.toLowerCase());
        })
        .map((item) => ({
          label: item.name,
          kind: monacoCompletionKind(item.kind),
          detail: item.detail || item.kind,
          filterText: item.name,
          insertText: item.name,
          range: request.range,
        }));
      return { suggestions: items };
    },
  });
  monaco.languages.registerDocumentSemanticTokensProvider(MONACO_LANGUAGE_ID, {
    getLegend() {
      return {
        tokenTypes: SEMANTIC_TOKEN_TYPES,
        tokenModifiers: SEMANTIC_TOKEN_MODIFIERS,
      };
    },
    provideDocumentSemanticTokens(model) {
      return {
        data: encodeMonacoSemanticTokens(projectSemanticTokens(model.uri.path, model.getValue())),
      };
    },
    releaseDocumentSemanticTokens() {},
  });
  monaco.languages.registerSignatureHelpProvider(MONACO_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ['(', ',', '='],
    signatureHelpRetriggerCharacters: [',', '='],
    provideSignatureHelp(model, position) {
      const help = projectSignatureHelp(
        model.uri.path || viewerHost.currentFile(),
        model.getValue(),
        model.getOffsetAt(position),
      );
      if (!help) return null;
      return {
        value: {
          signatures: help.signatures.map((signature) => ({
            label: signature.label,
            documentation: signature.documentation,
            parameters: signature.parameters.map((parameter) => ({
              label: parameter.label,
              documentation: parameter.documentation,
            })),
          })),
          activeSignature: help.activeSignature,
          activeParameter: help.activeParameter,
        },
        dispose() {},
      };
    },
  });
  monaco.languages.registerDocumentFormattingEditProvider(MONACO_LANGUAGE_ID, {
    provideDocumentFormattingEdits(model) {
      return [{
        range: model.getFullModelRange(),
        text: window.Idyllium.formatIdyllium(model.getValue()),
      }];
    },
  });

  // Сообщения диагностик — на английском, а hover Монако глух: текст не
  // выделить, не скопировать, в переводчик не унести (находка владельца
  // 2026-08-28). Лампочка (Ctrl+.) на подчёркнутой строке даёт три действия
  // для КАЖДОЙ диагностики — и предупреждения, и ошибки.
  monaco.editor.registerCommand('idyllium.copyDiagnostic', (_accessor, message) => {
    const text = String(message || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setStatus('Сообщение скопировано'),
        () => setStatus('Не удалось скопировать', true),
      );
    }
  });
  monaco.editor.registerCommand('idyllium.translateDiagnosticGoogle', (_accessor, message) => {
    window.open('https://translate.google.com/?sl=en&tl=ru&op=translate&text=' + encodeURIComponent(String(message || '')), '_blank', 'noopener');
  });
  monaco.editor.registerCommand('idyllium.translateDiagnosticYandex', (_accessor, message) => {
    window.open('https://translate.yandex.ru/?source_lang=en&target_lang=ru&text=' + encodeURIComponent(String(message || '')), '_blank', 'noopener');
  });
  monaco.languages.registerCodeActionProvider(MONACO_LANGUAGE_ID, {
    provideCodeActions(model, range, context) {
      const actions = [];
      for (const marker of context.markers || []) {
        if (typeof marker.message !== 'string' || marker.message === '') continue;
        const label = marker.severity === monaco.MarkerSeverity.Warning ? 'предупреждения' : 'сообщения об ошибке';
        actions.push({
          title: 'Скопировать текст ' + label,
          kind: 'quickfix',
          diagnostics: [marker],
          command: { id: 'idyllium.copyDiagnostic', title: 'copy', arguments: [marker.message] },
        });
        actions.push({
          title: 'Перевести в Google Переводчике',
          kind: 'quickfix',
          diagnostics: [marker],
          command: { id: 'idyllium.translateDiagnosticGoogle', title: 'translate', arguments: [marker.message] },
        });
        actions.push({
          title: 'Перевести в Яндекс Переводчике',
          kind: 'quickfix',
          diagnostics: [marker],
          command: { id: 'idyllium.translateDiagnosticYandex', title: 'translate', arguments: [marker.message] },
        });
      }
      return { actions, dispose() {} };
    },
  });
  defineMonacoThemes();
}

export function defineMonacoThemes() {
  const monaco = window.monaco;
  monaco.editor.defineTheme('idyllium-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.idyllium', foreground: 'b892ff' },
      { token: 'typeName.idyllium', foreground: '63b3ff' },
      { token: 'className.idyllium', foreground: '59d4b8' },
      { token: 'function.idyllium', foreground: 'e4d87e' },
      { token: 'object.idyllium', foreground: '8bdfff' },
      { token: 'namespace', foreground: '8bdfff' },
      { token: 'class', foreground: '59d4b8' },
      { token: 'function', foreground: 'e4d87e' },
      { token: 'method', foreground: 'e4d87e' },
      { token: 'property', foreground: '8bdfff' },
      { token: 'variable', foreground: 'f0ecf8' },
      { token: 'parameter', foreground: '8bdfff' },
      { token: 'variable.readonly', foreground: '8bdfff' },
      { token: 'brackets.idyllium', foreground: 'd0d6e6' },
      { token: 'string.key.json', foreground: '8bdfff' },
      { token: 'string.value.json', foreground: 'd99a6c' },
      { token: 'number.json', foreground: 'c5d979' },
      { token: 'keyword.json', foreground: 'b892ff' },
      { token: 'delimiter.bracket.json', foreground: 'd0d6e6' },
      { token: 'delimiter.array.json', foreground: 'd0d6e6' },
      { token: 'delimiter.colon.json', foreground: 'd0d6e6' },
      { token: 'delimiter.comma.json', foreground: 'd0d6e6' },
      { token: 'comment.line.json', foreground: '6ba36f', fontStyle: 'italic' },
      { token: 'comment.block.json', foreground: '6ba36f', fontStyle: 'italic' },
      { token: 'string', foreground: 'd99a6c' },
      { token: 'number', foreground: 'c5d979' },
      { token: 'comment', foreground: '6ba36f', fontStyle: 'italic' },
    ],
    colors: {
      'focusBorder': '#00000000',
      'editor.background': '#120a1d',
      'editor.foreground': '#f0ecf8',
      'editorLineNumber.foreground': '#777088',
      'editorLineNumber.activeForeground': '#d0d6e6',
      'editorCursor.foreground': '#ffffff',
      'editor.selectionBackground': '#6aa4ff45',
      'editor.inactiveSelectionBackground': '#6aa4ff24',
      'editor.lineHighlightBackground': '#ffffff07',
      'editor.lineHighlightBorder': '#00000000',
      'editorBracketHighlight.foreground1': '#d0d6e6',
      'editorBracketHighlight.foreground2': '#d0d6e6',
      'editorBracketHighlight.foreground3': '#d0d6e6',
      'editorBracketHighlight.foreground4': '#d0d6e6',
      'editorBracketHighlight.foreground5': '#d0d6e6',
      'editorBracketHighlight.foreground6': '#d0d6e6',
      'editorBracketMatch.background': '#21182c',
      'editorBracketMatch.border': '#6aa4ff66',
      'editorIndentGuide.background1': '#2a2038',
      'editorIndentGuide.activeBackground1': '#4a405c',
      'editorGutter.background': '#120a1d',
      'editorSuggestWidget.background': '#1d1528',
      'editorSuggestWidget.border': '#342a43',
      'editorSuggestWidget.foreground': '#f0ecf8',
      'editorSuggestWidget.highlightForeground': '#8ec2ff',
      'editorSuggestWidget.selectedBackground': '#273956',
      'editorWidget.background': '#1d1528',
      'editorWidget.border': '#342a43',
    },
  });
  monaco.editor.defineTheme('idyllium-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword.idyllium', foreground: '8d3f75' },
      { token: 'typeName.idyllium', foreground: '1d659a' },
      { token: 'className.idyllium', foreground: '1b745c' },
      { token: 'function.idyllium', foreground: '76620f' },
      { token: 'object.idyllium', foreground: '0d667f' },
      { token: 'namespace', foreground: '0d667f' },
      { token: 'class', foreground: '1b745c' },
      { token: 'function', foreground: '76620f' },
      { token: 'method', foreground: '76620f' },
      { token: 'property', foreground: '0d667f' },
      { token: 'variable', foreground: '1d2230' },
      { token: 'parameter', foreground: '0d667f' },
      { token: 'variable.readonly', foreground: '0d667f' },
      { token: 'brackets.idyllium', foreground: '445253' },
      { token: 'string.key.json', foreground: '0d667f' },
      { token: 'string.value.json', foreground: '87481f' },
      { token: 'number.json', foreground: '5b7027' },
      { token: 'keyword.json', foreground: '8d3f75' },
      { token: 'delimiter.bracket.json', foreground: '445253' },
      { token: 'delimiter.array.json', foreground: '445253' },
      { token: 'delimiter.colon.json', foreground: '445253' },
      { token: 'delimiter.comma.json', foreground: '445253' },
      { token: 'comment.line.json', foreground: '477237', fontStyle: 'italic' },
      { token: 'comment.block.json', foreground: '477237', fontStyle: 'italic' },
      { token: 'string', foreground: '87481f' },
      { token: 'number', foreground: '5b7027' },
      { token: 'comment', foreground: '477237', fontStyle: 'italic' },
    ],
    colors: {
      'focusBorder': '#00000000',
      'editor.background': '#d9d6df',
      'editor.foreground': '#252730',
      'editorLineNumber.foreground': '#77717f',
      'editorLineNumber.activeForeground': '#47424f',
      'editorCursor.foreground': '#23252c',
      'editor.selectionBackground': '#315f8c38',
      'editor.inactiveSelectionBackground': '#315f8c1c',
      'editor.lineHighlightBackground': '#275f9e0b',
      'editor.lineHighlightBorder': '#00000000',
      'editorBracketHighlight.foreground1': '#445253',
      'editorBracketHighlight.foreground2': '#445253',
      'editorBracketHighlight.foreground3': '#445253',
      'editorBracketHighlight.foreground4': '#445253',
      'editorBracketHighlight.foreground5': '#445253',
      'editorBracketHighlight.foreground6': '#445253',
      'editorBracketMatch.background': '#c6c2cd',
      'editorBracketMatch.border': '#827a8d',
      'editorIndentGuide.background1': '#c4c0ca',
      'editorIndentGuide.activeBackground1': '#9c95a4',
      'editorGutter.background': '#d9d6df',
      'editorSuggestWidget.background': '#e7e4ea',
      'editorSuggestWidget.border': '#aaa3b2',
      'editorSuggestWidget.foreground': '#252730',
      'editorSuggestWidget.highlightForeground': '#315f8c',
      'editorSuggestWidget.selectedBackground': '#c8d3df',
      'editorWidget.background': '#e7e4ea',
      'editorWidget.border': '#aaa3b2',
    },
  });
}

export function completionRangeForMonaco(model, position) {
  const word = model.getWordUntilPosition(position);
  return new window.monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
}

export function monacoCompletionRequest(model, position, context) {
  const monaco = window.monaco;
  const offset = model.getOffsetAt(position);
  const prefix = model.getValue().slice(0, offset);
  const manual = context && context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke;

  const useMatch = /\buse\s+([A-Za-z_0-9]*)$/u.exec(prefix);
  if (useMatch) {
    return {
      kind: 'use',
      prefix: useMatch[1] || '',
      requestOffset: offset,
      range: completionRangeForMonaco(model, position),
    };
  }

  // Перед точкой может стоять любая постфиксная цепочка: имя, `sm[0]`,
  // `f(...)`, литерал. Разбором занимается языковой сервис — здесь только
  // распознаём сам контекст «точка + недописанное имя члена».
  const memberMatch = /[\p{L}\p{N}_\])"']\s*\.\s*([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)?$/u.exec(prefix);
  if (memberMatch) {
    const memberPrefix = memberMatch[1] || '';
    return {
      kind: 'member',
      prefix: memberPrefix,
      requestOffset: Math.max(0, offset - memberPrefix.length),
      range: new monaco.Range(
        position.lineNumber,
        Math.max(1, position.column - memberPrefix.length),
        position.lineNumber,
        position.column,
      ),
    };
  }

  const triggerCharacter = context && context.triggerCharacter;
  if ((triggerCharacter === '(' || triggerCharacter === ',' || triggerCharacter === ' ') && hasOpenCallableFrame(prefix)) {
    return {
      kind: 'argument',
      prefix: '',
      requestOffset: offset,
      range: completionRangeForMonaco(model, position),
    };
  }

  if (!manual) return null;

  return {
    kind: 'manual',
    prefix: '',
    requestOffset: offset,
    range: completionRangeForMonaco(model, position),
  };
}

export function hasOpenCallableFrame(source) {
  const frames = [];
  let squareDepth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (char === '/' && next === '*') {
      i += 2;
      while (i + 1 < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) break;
        i++;
      }
      continue;
    }

    if (char === '[') squareDepth++;
    if (char === ']') squareDepth = Math.max(0, squareDepth - 1);
    if (char === '(') {
      frames.push(calleeTextBeforeOffset(source, i) !== null);
      continue;
    }
    if (char === ')') {
      frames.pop();
      continue;
    }
    if (char === ',' && squareDepth === 0 && frames.length > 0) continue;
  }

  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i]) return true;
  }
  return false;
}

export function calleeTextBeforeOffset(source, openParenIndex) {
  const fragment = source.slice(Math.max(0, openParenIndex - 160), openParenIndex);
  const match = /((?:[\p{L}_][\p{L}\p{N}_]*\s*\.\s*)?[\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(fragment);
  if (!match) return null;

  const text = match[1].trim();
  return ['if', 'while', 'for', 'function', 'main', 'constructor'].includes(text) ? null : text;
}

export function projectCompletions(file, source, offset) {
  try {
    const normalized = normalizeWorkspacePath(file || viewerHost.currentFile());
    const projectFiles = textSourceMap();
    projectFiles.set(normalized, source);
    const project = new window.Idyllium.IdylliumProject({
      entryFile: MAIN_FILE,
      files: projectFiles,
    });
    return deduplicateCompletions(project.completions({ file: normalized, offset })).slice(0, 80);
  } catch (_error) {
    return [];
  }
}

export function projectSignatureHelp(file, source, offset) {
  try {
    const normalized = normalizeWorkspacePath(file || viewerHost.currentFile());
    const projectFiles = textSourceMap();
    projectFiles.set(normalized, source);
    const project = new window.Idyllium.IdylliumProject({
      entryFile: MAIN_FILE,
      files: projectFiles,
    });
    return project.signatureHelp({ file: normalized, offset });
  } catch (_error) {
    return null;
  }
}

export function projectSemanticTokens(file, source) {
  try {
    const normalized = normalizeWorkspacePath(file || viewerHost.currentFile());
    const projectFiles = textSourceMap();
    projectFiles.set(normalized, source);
    const project = new window.Idyllium.IdylliumProject({
      entryFile: MAIN_FILE,
      files: projectFiles,
    });
    return project.semanticTokens(normalized);
  } catch (_error) {
    return [];
  }
}

export function encodeMonacoSemanticTokens(tokens) {
  const sorted = [...tokens]
    .filter((token) => token.range.start.line === token.range.end.line)
    .sort((left, right) => (
      left.range.start.line - right.range.start.line
      || left.range.start.column - right.range.start.column
    ));
  const data = [];
  let previousLine = 0;
  let previousCharacter = 0;

  for (const token of sorted) {
    const line = Math.max(0, token.range.start.line - 1);
    const character = Math.max(0, token.range.start.column - 1);
    const length = Math.max(0, token.range.end.column - token.range.start.column);
    const tokenType = SEMANTIC_TOKEN_TYPES.indexOf(token.kind);
    if (length === 0 || tokenType < 0) continue;

    const deltaLine = line - previousLine;
    const deltaCharacter = deltaLine === 0 ? character - previousCharacter : character;
    let modifierMask = 0;
    for (const modifier of token.modifiers || []) {
      const index = SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier);
      if (index >= 0) modifierMask |= (1 << index);
    }
    data.push(deltaLine, deltaCharacter, length, tokenType, modifierMask);
    previousLine = line;
    previousCharacter = character;
  }

  return new Uint32Array(data);
}

export function monacoCompletionKind(kind) {
  const monaco = window.monaco;
  if (kind === 'module') return monaco.languages.CompletionItemKind.Module;
  if (kind === 'function') return monaco.languages.CompletionItemKind.Function;
  if (kind === 'method') return monaco.languages.CompletionItemKind.Method;
  if (kind === 'constant') return monaco.languages.CompletionItemKind.Constant;
  if (kind === 'type') return monaco.languages.CompletionItemKind.Class;
  if (kind === 'property') return monaco.languages.CompletionItemKind.Property;
  if (kind === 'parameter') return monaco.languages.CompletionItemKind.Variable;
  if (kind === 'variable') return monaco.languages.CompletionItemKind.Variable;
  return monaco.languages.CompletionItemKind.Text;
}

// Общая для Monaco и легаси-попапа дедупликация подсказок.
export function deduplicateCompletions(items) {
  const byName = new Map();
  for (const item of items) {
    if (!byName.has(item.name)) byName.set(item.name, item);
  }
  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}
