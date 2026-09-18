// Язык Idyllium в Monaco: регистрация, конфигурация, темы, провайдеры
// (completions/подписи/семантические токены) и мапперы диагностик.
// Жизненный цикл редактора остаётся в ядре.

import { MONACO_LANGUAGE_ID, registerIdylliumGrammar, defineIdylliumThemes } from './monaco-grammar.js';
import { MAIN_FILE, normalizeWorkspacePath } from './workspace-paths.js';
import { files } from './project-store.js';
import { viewerHost } from './viewer-host.js';
import { setStatus } from './console-output.js';
import { textSourceMap } from './run-preview.js';

export { MONACO_LANGUAGE_ID };

export const SEMANTIC_TOKEN_TYPES = [...window.Idyllium.IDYLLIUM_SEMANTIC_TOKEN_TYPES];

export const SEMANTIC_TOKEN_MODIFIERS = [...window.Idyllium.IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS];

export function registerMonacoIdyllium() {
  const monaco = window.monaco;
  if (!monaco || monaco.languages.getLanguages().some((language) => language.id === MONACO_LANGUAGE_ID)) return;

  registerIdylliumGrammar(monaco);
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
  defineIdylliumThemes(window.monaco);
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
