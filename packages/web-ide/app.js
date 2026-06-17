'use strict';

(function () {
  const WORKSPACE_ROOT = '/workspace';
  const MAIN_FILE = WORKSPACE_ROOT + '/main.idyl';
  const MONACO_LANGUAGE_ID = 'idyllium';
  const DEFAULT_EDITOR_FONT_SIZE = 16;
  const MIN_EDITOR_FONT_SIZE = 10;
  const MAX_EDITOR_FONT_SIZE = 32;
  const KEYWORDS = new Set([
    'and', 'break', 'catch', 'class', 'constructor', 'continue', 'destructor', 'do', 'else', 'extends',
    'false', 'for', 'function', 'if', 'not', 'or', 'parent', 'private', 'public', 'return', 'static',
    'this', 'true', 'try', 'use', 'while', 'xor',
  ]);
  const BUILTIN_TYPES = new Set([
    'array', 'bool', 'char', 'dyn_array', 'float', 'int', 'set', 'string', 'void',
  ]);
  const CLASS_NAMES = new Set([
    'Button', 'Canvas', 'CheckBox', 'Circle', 'Color', 'ComboBox', 'FloatSpinBox', 'Font', 'Frame',
    'Image', 'Label', 'Line', 'LineEdit', 'Modal', 'ProgressBar', 'RadioButton', 'Rectangle', 'Slider', 'SpinBox', 'Sprite', 'Text',
    'TextEdit', 'Texture', 'Timer', 'Window',
  ]);
  const QUALIFIED_TYPES = new Set([
    'Array',
    'Button', 'Canvas', 'CheckBox', 'Circle', 'Color', 'ComboBox', 'FloatSpinBox', 'Font', 'Frame', 'Label',
    'Image', 'Line', 'LineEdit', 'Modal', 'ProgressBar', 'RadioButton', 'Rectangle', 'Slider', 'SpinBox', 'Sprite',
    'Object', 'Text', 'TextEdit', 'Texture', 'Timer', 'Value', 'Window', 'float32', 'float64', 'int8', 'int16', 'int32',
    'int64', 'istream', 'ostream', 'stamp', 'stream', 'uint8', 'uint16', 'uint32', 'uint64',
  ]);
  const CRC32_TABLE = buildCrc32Table();
  const PROJECT_DB_NAME = 'idyllium-web-ide';
  const PROJECT_DB_STORE = 'project';
  const PROJECT_STATE_KEY = 'autosave';
  const AUTOSAVE_DELAY_MS = 450;
  const LAYOUT_STORAGE_KEY = 'idyllium-web-layout';
  const FONT_SIZE_STORAGE_KEY = 'idyllium-web-editor-font-size';
  const COLOR_PICKER_CHANNELS = ['red', 'green', 'blue', 'alpha'];
  const ANSI_FOREGROUND_CLASSES = new Map([
    [30, 'ansi-fg-black'],
    [31, 'ansi-fg-red'],
    [32, 'ansi-fg-green'],
    [33, 'ansi-fg-yellow'],
    [34, 'ansi-fg-blue'],
    [35, 'ansi-fg-magenta'],
    [36, 'ansi-fg-cyan'],
    [37, 'ansi-fg-white'],
    [90, 'ansi-fg-bright-black'],
    [91, 'ansi-fg-bright-red'],
    [92, 'ansi-fg-bright-green'],
    [93, 'ansi-fg-bright-yellow'],
    [94, 'ansi-fg-bright-blue'],
    [95, 'ansi-fg-bright-magenta'],
    [96, 'ansi-fg-bright-cyan'],
    [97, 'ansi-fg-bright-white'],
  ]);

  const files = new Map([
    [MAIN_FILE, {
      kind: 'text',
      content: [
        'use console;',
        '',
        'main() {',
        '    console.writeln("Hello, World!");',
        '}',
      ].join('\n'),
    }],
    ['/workspace/input.txt', {
      kind: 'text',
      content: '42\n',
    }],
  ]);
  const folders = new Set([WORKSPACE_ROOT]);
  const expandedFolders = new Set([WORKSPACE_ROOT]);

  let currentFile = MAIN_FILE;
  let currentRuntime = null;
  let guiTimer = null;
  let lastTick = Date.now();
  let guiBusy = false;
  let guiFrameReady = false;
  let pendingSnapshot = null;
  let completionItems = [];
  let completionIndex = 0;
  let completionStart = 0;
  let editorReady = false;
  let saveTimer = null;
  let diagnosticsTimer = null;
  let monacoEditor = null;
  let monacoReady = false;
  let editorFontSize = readSavedEditorFontSize();
  let runAbortController = null;
  let currentRuntimeFileSnapshot = null;
  let outputSyncTimer = null;
  let runSequence = 0;
  let pendingConsoleInput = null;
  let consoleInputEchoes = [];
  let lastSnapshotJson = '';
  let fileEditState = null;
  let colorPickerState = { red: 34, green: 145, blue: 188, alpha: 1 };
  const colorCopyTimers = new WeakMap();

  const monacoHost = document.getElementById('monaco-editor');
  const assetViewer = document.getElementById('asset-viewer');
  const legacyEditor = document.getElementById('legacy-editor');
  const editor = document.getElementById('editor');
  const highlight = document.querySelector('#highlight code');
  const lineNumbers = document.getElementById('line-numbers');
  const completionPopup = document.getElementById('completion-popup');
  const editorTitle = document.getElementById('editor-title');
  const fileList = document.getElementById('file-list');
  const output = document.getElementById('output');
  const consoleInputPanel = document.getElementById('console-input-panel');
  const consoleInput = document.getElementById('console-input');
  const consoleInputSubmit = document.getElementById('console-input-submit');
  const status = document.getElementById('status');
  const guiFrame = document.getElementById('gui-frame');
  const workspace = document.querySelector('.workspace');
  const runtimePane = document.querySelector('.runtime-pane');
  const runtimeRowResizer = document.getElementById('runtime-row-resizer');
  const runButton = document.getElementById('run-button');
  const stopButton = document.getElementById('stop-button');
  const formatButton = document.getElementById('format-button');
  const newFileButton = document.getElementById('new-file-button');
  const newFolderButton = document.getElementById('new-folder-button');
  const fileContextMenu = document.getElementById('file-context-menu');
  const uploadButton = document.getElementById('upload-button');
  const uploadMenu = document.getElementById('upload-menu');
  const dropArea = document.getElementById('drop-area');
  const uploadInput = document.getElementById('upload-input');
  const themeButton = document.getElementById('theme-button');
  const themeMenu = document.getElementById('theme-menu');
  const themeDarkButton = document.getElementById('theme-dark-button');
  const themeLightButton = document.getElementById('theme-light-button');
  const fontSizeDecrease = document.getElementById('font-size-decrease');
  const fontSizeIncrease = document.getElementById('font-size-increase');
  const fontSizeInput = document.getElementById('font-size-input');
  const colorPickerButton = document.getElementById('color-picker-button');
  const colorPickerMenu = document.getElementById('color-picker-menu');
  const colorPreview = document.getElementById('color-preview');
  const colorRgbCode = document.getElementById('color-rgb-code');
  const colorHexCode = document.getElementById('color-hex-code');
  const colorSliders = {
    red: document.getElementById('color-red-slider'),
    green: document.getElementById('color-green-slider'),
    blue: document.getElementById('color-blue-slider'),
    alpha: document.getElementById('color-alpha-slider'),
  };
  const colorInputs = {
    red: document.getElementById('color-red-input'),
    green: document.getElementById('color-green-input'),
    blue: document.getElementById('color-blue-input'),
    alpha: document.getElementById('color-alpha-input'),
  };

  applySavedTheme();
  applyEditorFontSize(editorFontSize, false);
  applySavedLayout();
  updateColorPickerUi();

  runButton.addEventListener('click', runProgram);
  stopButton.addEventListener('click', () => stopProgram(false));
  formatButton.addEventListener('click', formatCurrentFile);
  newFileButton.addEventListener('click', () => startCreateItemInline('file', WORKSPACE_ROOT));
  newFolderButton.addEventListener('click', () => startCreateItemInline('folder', WORKSPACE_ROOT));
  document.getElementById('download-project-button').addEventListener('click', downloadProject);
  uploadButton.addEventListener('click', toggleUploadMenu);
  dropArea.addEventListener('click', () => uploadInput.click());
  fileList.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest('.file-row')) return;
    event.preventDefault();
    openFileContextMenu({ type: 'folder', name: 'workspace', path: WORKSPACE_ROOT, children: [] }, event.clientX, event.clientY);
  });
  themeButton.addEventListener('click', toggleThemeMenu);
  colorPickerButton.addEventListener('click', toggleColorPickerMenu);
  themeDarkButton.addEventListener('click', () => {
    setTheme('dark');
    hideThemeMenu();
  });
  themeLightButton.addEventListener('click', () => {
    setTheme('light');
    hideThemeMenu();
  });
  fontSizeDecrease.addEventListener('click', () => applyEditorFontSize(editorFontSize - 1));
  fontSizeIncrease.addEventListener('click', () => applyEditorFontSize(editorFontSize + 1));
  fontSizeInput.addEventListener('change', () => applyEditorFontSize(Number(fontSizeInput.value)));
  fontSizeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      applyEditorFontSize(Number(fontSizeInput.value));
      event.preventDefault();
    }
  });
  installColorPicker();
  consoleInputSubmit.addEventListener('click', submitConsoleInput);
  consoleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitConsoleInput();
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      stopProgram(false);
      event.preventDefault();
    }
  });
  uploadInput.addEventListener('change', () => {
    loadDroppedFiles(uploadInput.files);
    uploadInput.value = '';
  });
  installDropArea();
  document.addEventListener('click', (event) => {
    if (!uploadMenu.hidden && event.target instanceof Element && !event.target.closest('.upload-wrapper')) hideUploadMenu();
    if (!themeMenu.hidden && event.target instanceof Element && !event.target.closest('.theme-wrapper')) hideThemeMenu();
    if (!colorPickerMenu.hidden && event.target instanceof Element && !event.target.closest('.color-picker-wrapper')) hideColorPickerMenu();
    if (!fileContextMenu.hidden && event.target instanceof Element && !event.target.closest('.file-context-menu') && !event.target.closest('.file-menu-button')) hideFileContextMenu();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!runButton.disabled) runProgram();
      return;
    }
    if (event.key === 'Escape') {
      hideFileContextMenu();
      hideThemeMenu();
      hideColorPickerMenu();
      hideUploadMenu();
    }
  });
  installColumnResizers();
  installRuntimeRowResizer();
  editor.addEventListener('input', handleEditorInput);
  editor.addEventListener('keydown', handleEditorKeydown);
  editor.addEventListener('click', () => {
    hideCompletions();
    updateEditorVisuals();
  });
  editor.addEventListener('scroll', syncEditorScroll);
  editor.addEventListener('blur', () => {
    window.setTimeout(hideCompletions, 120);
  });
  guiFrame.addEventListener('load', () => {
    guiFrameReady = true;
    applyPreviewTheme();
    if (pendingSnapshot) postSnapshot(pendingSnapshot);
  });

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'idylliumGuiEvent' || !data.message) return;
    if (data.message.type === 'closeApp') {
      stopProgram(false);
      return;
    }
    if (data.message.type !== 'guiEvent') return;
    handleGuiEvent(data.message).catch((error) => {
      setStatus('Ошибка события GUI', true);
      appendOutput(formatThrownError(error), 'output-error');
    });
  });

  initializeMonaco().finally(initializeIde);

  function initializeMonaco() {
    return new Promise((resolve) => {
      if (!window.require || !monacoHost) {
        enableLegacyEditor();
        resolve(false);
        return;
      }

      window.require.config({ paths: { vs: 'monaco/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        registerMonacoIdyllium();
        monacoEditor = window.monaco.editor.create(monacoHost, {
          value: '',
          language: MONACO_LANGUAGE_ID,
          theme: currentMonacoTheme(),
          automaticLayout: true,
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoIndent: 'full',
          bracketPairColorization: { enabled: false },
          cursorBlinking: 'smooth',
          detectIndentation: false,
          fontFamily: '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: editorFontSize,
          fontLigatures: false,
          formatOnPaste: false,
          guides: {
            bracketPairs: false,
            bracketPairsHorizontal: false,
            highlightActiveIndentation: false,
            indentation: true,
          },
          insertSpaces: true,
          lineHeight: editorLineHeight(editorFontSize),
          minimap: { enabled: false },
          padding: { top: 10, bottom: 8 },
          quickSuggestions: false,
          renderWhitespace: 'selection',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          suggestOnTriggerCharacters: true,
          suggest: { showWords: false },
          tabSize: 4,
          wordBasedSuggestions: 'off',
        });
        monacoEditor.onDidChangeModelContent(() => {
          saveCurrentEditor();
          scheduleMonacoDiagnostics();
        });
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, runProgram);
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Space, () => {
          monacoEditor.trigger('keyboard', 'editor.action.triggerSuggest', {});
        });
        legacyEditor.hidden = true;
        monacoReady = true;
        resolve(true);
      }, () => {
        enableLegacyEditor();
        resolve(false);
      });
    });
  }

  function enableLegacyEditor() {
    monacoReady = false;
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = false;
  }

  function registerMonacoIdyllium() {
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
          [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*/u, 'className.idyllium'],
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
      triggerCharacters: ['.', ' '],
      provideCompletionItems(model, position, context) {
        const request = monacoCompletionRequest(model, position, context);
        if (!request) return { suggestions: [] };

        const items = projectCompletions(model.uri.path || currentFile, model.getValue(), request.requestOffset)
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
    monaco.languages.registerDocumentFormattingEditProvider(MONACO_LANGUAGE_ID, {
      provideDocumentFormattingEdits(model) {
        return [{
          range: model.getFullModelRange(),
          text: window.Idyllium.formatIdyllium(model.getValue()),
        }];
      },
    });
    defineMonacoThemes();
  }

  function defineMonacoThemes() {
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
        { token: 'brackets.idyllium', foreground: 'd0d6e6' },
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
        { token: 'brackets.idyllium', foreground: '445253' },
        { token: 'string', foreground: '87481f' },
        { token: 'number', foreground: '5b7027' },
        { token: 'comment', foreground: '477237', fontStyle: 'italic' },
      ],
      colors: {
        'focusBorder': '#00000000',
        'editor.background': '#f2edf7',
        'editor.foreground': '#1d2230',
        'editorLineNumber.foreground': '#7b7489',
        'editorLineNumber.activeForeground': '#3f3850',
        'editorCursor.foreground': '#1d2230',
        'editor.selectionBackground': '#275f9e2e',
        'editor.inactiveSelectionBackground': '#275f9e18',
        'editor.lineHighlightBackground': '#275f9e0b',
        'editor.lineHighlightBorder': '#00000000',
        'editorBracketHighlight.foreground1': '#445253',
        'editorBracketHighlight.foreground2': '#445253',
        'editorBracketHighlight.foreground3': '#445253',
        'editorBracketHighlight.foreground4': '#445253',
        'editorBracketHighlight.foreground5': '#445253',
        'editorBracketHighlight.foreground6': '#445253',
        'editorBracketMatch.background': '#e2dcea',
        'editorBracketMatch.border': '#90849f',
        'editorIndentGuide.background1': '#d8d0e1',
        'editorIndentGuide.activeBackground1': '#aaa0b8',
        'editorGutter.background': '#f2edf7',
        'editorSuggestWidget.background': '#fbf9fd',
        'editorSuggestWidget.border': '#c8bed5',
        'editorSuggestWidget.foreground': '#1d2230',
        'editorSuggestWidget.highlightForeground': '#275f9e',
        'editorSuggestWidget.selectedBackground': '#e2ebf6',
        'editorWidget.background': '#fbf9fd',
        'editorWidget.border': '#c8bed5',
      },
    });
  }

  function completionRangeForMonaco(model, position) {
    const word = model.getWordUntilPosition(position);
    return new window.monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  }

  function monacoCompletionRequest(model, position, context) {
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

    const memberMatch = /([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)\.\s*([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)?$/u.exec(prefix);
    if (memberMatch) {
      const memberPrefix = memberMatch[2] || '';
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

    if (!manual) return null;

    return {
      kind: 'manual',
      prefix: '',
      requestOffset: offset,
      range: completionRangeForMonaco(model, position),
    };
  }

  function projectCompletions(file, source, offset) {
    try {
      const normalized = normalizeWorkspacePath(file || currentFile);
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

  function monacoCompletionKind(kind) {
    const monaco = window.monaco;
    if (kind === 'module') return monaco.languages.CompletionItemKind.Module;
    if (kind === 'function') return monaco.languages.CompletionItemKind.Function;
    if (kind === 'method') return monaco.languages.CompletionItemKind.Method;
    if (kind === 'constant') return monaco.languages.CompletionItemKind.Constant;
    if (kind === 'type') return monaco.languages.CompletionItemKind.Class;
    if (kind === 'property') return monaco.languages.CompletionItemKind.Property;
    return monaco.languages.CompletionItemKind.Text;
  }

  function scheduleMonacoDiagnostics() {
    if (!monacoReady || !monacoEditor) return;
    if (diagnosticsTimer !== null) window.clearTimeout(diagnosticsTimer);
    diagnosticsTimer = window.setTimeout(() => {
      diagnosticsTimer = null;
      updateMonacoDiagnostics();
    }, 250);
  }

  function updateMonacoDiagnostics() {
    if (!monacoReady || !monacoEditor) return;
    const monaco = window.monaco;
    const model = monacoEditor.getModel();
    if (!model) return;
    if (!currentFile.endsWith('.idyl')) {
      monaco.editor.setModelMarkers(model, 'idyllium', []);
      return;
    }

    try {
      saveCurrentEditor();
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: textSourceMap(),
      });
      const markers = project.diagnostics(currentFile).map((diagnostic) => diagnosticToMonacoMarker(diagnostic));
      monaco.editor.setModelMarkers(model, 'idyllium', markers);
    } catch (_error) {
      monaco.editor.setModelMarkers(model, 'idyllium', []);
    }
  }

  function diagnosticToMonacoMarker(diagnostic) {
    const monaco = window.monaco;
    const startLine = Math.max(1, diagnostic.range.start.line);
    const startColumn = Math.max(1, diagnostic.range.start.column);
    const endLine = Math.max(startLine, diagnostic.range.end.line);
    let endColumn = Math.max(1, diagnostic.range.end.column);
    if (endLine === startLine && endColumn <= startColumn) endColumn = startColumn + 1;

    return {
      severity: diagnosticSeverityToMonaco(diagnostic.severity),
      message: diagnostic.message,
      startLineNumber: startLine,
      startColumn,
      endLineNumber: endLine,
      endColumn,
      code: diagnostic.code || undefined,
      source: 'Idyllium',
    };
  }

  function diagnosticSeverityToMonaco(severity) {
    const MarkerSeverity = window.monaco.MarkerSeverity;
    if (severity === 'warning') return MarkerSeverity.Warning;
    if (severity === 'info') return MarkerSeverity.Info;
    return MarkerSeverity.Error;
  }

  function currentMonacoTheme() {
    return document.body.classList.contains('theme-light') ? 'idyllium-light' : 'idyllium-dark';
  }

  function readSavedEditorFontSize() {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw === null) return DEFAULT_EDITOR_FONT_SIZE;
    const saved = Number(raw);
    return normalizeEditorFontSize(Number.isFinite(saved) ? saved : DEFAULT_EDITOR_FONT_SIZE);
  }

  function normalizeEditorFontSize(value) {
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return DEFAULT_EDITOR_FONT_SIZE;
    return clamp(rounded, MIN_EDITOR_FONT_SIZE, MAX_EDITOR_FONT_SIZE);
  }

  function editorLineHeight(fontSize) {
    return Math.max(18, Math.round(fontSize * 1.55));
  }

  function editorCharWidth(fontSize) {
    return fontSize * 0.61;
  }

  function applyEditorFontSize(value, persist = true) {
    editorFontSize = normalizeEditorFontSize(value);
    document.documentElement.style.setProperty('--editor-font-size', `${editorFontSize}px`);
    document.documentElement.style.setProperty('--editor-line-height', `${editorLineHeight(editorFontSize)}px`);
    fontSizeInput.value = String(editorFontSize);
    if (persist) window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(editorFontSize));
    if (monacoReady && monacoEditor) {
      monacoEditor.updateOptions({
        fontSize: editorFontSize,
        lineHeight: editorLineHeight(editorFontSize),
      });
    }
    updateEditorVisuals();
  }

  async function initializeIde() {
    try {
      const saved = await loadProjectState();
      if (saved && !isLegacyDefaultCanvasProject(saved)) {
        restoreProjectState(saved);
        setStatus('Проект восстановлен');
      }
    } catch (error) {
      setStatus('Не удалось восстановить проект', true);
      appendOutput(formatThrownError(error), 'output-error');
    }

    renderFiles();
    if (!files.has(currentFile)) currentFile = fallbackFilePath();
    openFile(currentFile);
    postEmptySnapshot();
  }

  function renderFiles() {
    syncFoldersFromFiles();
    fileList.replaceChildren();
    for (const node of projectTree().children) renderTreeNode(node, 0);
  }

  function renderTreeNode(node, depth) {
    const editing = fileEditState && fileEditState.path === node.path;
    const row = document.createElement('div');
    row.className = 'file-row file-row-' + node.type + (node.path === currentFile ? ' active' : '');
    row.style.setProperty('--depth', String(depth));
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openFileContextMenu(node, event.clientX, event.clientY);
    });

    if (editing) {
      row.appendChild(createInlineFileEditor(node));
      fileList.appendChild(row);
      window.setTimeout(() => focusInlineFileEditor(node.path), 0);
      if (node.type !== 'folder' || !expandedFolders.has(node.path)) return;
      for (const child of node.children) renderTreeNode(child, depth + 1);
      return;
    }

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'file-main-button';
    main.appendChild(createIcon(nodeIconName(node)));

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = node.name;
    main.appendChild(name);

    main.addEventListener('click', () => {
      if (node.type === 'folder') {
        toggleFolder(node.path);
        return;
      }
      openFile(node.path);
    });
    row.appendChild(main);

    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'file-menu-button';
    menu.title = 'действия';
    menu.setAttribute('aria-label', `действия: ${node.name}`);
    menu.appendChild(createIcon('menu'));
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
      const rect = menu.getBoundingClientRect();
      openFileContextMenu(node, rect.right + 4, rect.top);
    });
    row.appendChild(menu);

    fileList.appendChild(row);

    if (node.type !== 'folder' || !expandedFolders.has(node.path)) return;
    for (const child of node.children) renderTreeNode(child, depth + 1);
  }

  function openFile(file) {
    saveCurrentEditor();
    currentFile = file;
    const item = files.get(file);
    editorTitle.textContent = shortFileName(file);
    editorReady = true;
    hideCompletions();

    if (item && item.kind === 'text') {
      showTextEditor();
      setEditorValue(item.content || '', file);
      setEditorReadOnly(false);
      updateEditorVisuals();
    } else if (item && item.kind === 'asset') {
      showAssetViewer(file, item);
      setEditorReadOnly(true);
      setStatus('Открыт ассет');
    } else {
      showTextEditor();
      setEditorValue('', file);
      setEditorReadOnly(true);
      updateEditorVisuals();
    }

    updateFormatButton();
    renderFiles();
    scheduleAutosave();
  }

  function showTextEditor() {
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (monacoReady && monacoHost) {
      monacoHost.hidden = false;
      if (legacyEditor) legacyEditor.hidden = true;
      window.setTimeout(() => monacoEditor?.layout(), 0);
      return;
    }
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = false;
  }

  function showAssetViewer(file, item) {
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (!assetViewer) return;

    assetViewer.hidden = false;
    assetViewer.replaceChildren();

    const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
    const detectedMime = detectAssetMimeType(file, bytes);
    const extensionMime = mimeTypeForFile(file);
    const alpha = imageAlphaInfo(detectedMime, bytes);

    const preview = document.createElement('div');
    preview.className = 'asset-preview';
    assetViewer.appendChild(preview);

    const details = document.createElement('dl');
    details.className = 'asset-details';
    assetViewer.appendChild(details);

    addAssetDetail(details, 'Файл', shortFileName(file));
    addAssetDetail(details, 'Размер файла', formatBytes(bytes.length));
    addAssetDetail(details, 'Тип по расширению', extensionMime);
    addAssetDetail(details, 'Фактический тип', detectedMime);
    addAssetDetail(details, 'Ширина', 'загрузка...');
    addAssetDetail(details, 'Высота', 'загрузка...');
    addAssetDetail(details, 'Альфа-канал', alpha);

    if (extensionMime !== detectedMime && detectedMime !== 'application/octet-stream') {
      addAssetDetail(details, 'Несовпадение типа', `${extensionMime} -> ${detectedMime}`, true);
    }

    if (!detectedMime.startsWith('image/')) {
      const empty = document.createElement('div');
      empty.className = 'asset-preview-empty';
      empty.textContent = 'Предпросмотр для этого типа файла пока недоступен';
      preview.appendChild(empty);
      updateAssetDetail(details, 'Ширина', 'нет');
      updateAssetDetail(details, 'Высота', 'нет');
      return;
    }

    const image = document.createElement('img');
    image.alt = shortFileName(file);
    image.addEventListener('load', () => {
      updateAssetDetail(details, 'Ширина', `${image.naturalWidth}px`);
      updateAssetDetail(details, 'Высота', `${image.naturalHeight}px`);
    });
    image.addEventListener('error', () => {
      preview.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'asset-preview-empty';
      empty.textContent = 'Не удалось прочитать изображение';
      preview.appendChild(empty);
      updateAssetDetail(details, 'Ширина', 'ошибка');
      updateAssetDetail(details, 'Высота', 'ошибка');
    });
    image.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
    preview.appendChild(image);
  }

  function addAssetDetail(parent, label, value, warning = false) {
    const item = document.createElement('div');
    item.className = 'asset-detail' + (warning ? ' asset-detail-warning' : '');
    item.dataset.assetDetail = label;

    const term = document.createElement('dt');
    term.textContent = label;
    item.appendChild(term);

    const description = document.createElement('dd');
    description.textContent = value;
    item.appendChild(description);

    parent.appendChild(item);
  }

  function updateAssetDetail(parent, label, value) {
    for (const item of parent.querySelectorAll('.asset-detail')) {
      if (item.dataset.assetDetail !== label) continue;
      const description = item.querySelector('dd');
      if (description) description.textContent = value;
      return;
    }
  }

  function updateFormatButton() {
    if (!formatButton) return;
    const item = files.get(currentFile);
    formatButton.disabled = !(item && item.kind === 'text' && currentFile.endsWith('.idyl'));
  }

  function saveCurrentEditor() {
    if (!editorReady) return;
    const item = files.get(currentFile);
    if (!item || item.kind !== 'text' || isEditorReadOnly()) return;
    const value = getEditorValue();
    if (item.content === value) return;
    item.content = value;
    scheduleAutosave();
  }

  function handleEditorInput() {
    saveCurrentEditor();
    updateEditorVisuals();
    if (!monacoReady) refreshCompletions(false);
  }

  function updateEditorVisuals() {
    if (monacoReady) {
      scheduleMonacoDiagnostics();
      return;
    }
    const source = editor.value;
    highlight.innerHTML = currentFile.endsWith('.idyl') ? highlightIdyllium(source) : escapeHtml(source);
    const lines = Math.max(1, source.split('\n').length);
    lineNumbers.textContent = Array.from({ length: lines }, (_item, index) => String(index + 1)).join('\n');
    syncEditorScroll();
  }

  function syncEditorScroll() {
    if (monacoReady) return;
    const pre = document.getElementById('highlight');
    pre.scrollTop = editor.scrollTop;
    pre.scrollLeft = editor.scrollLeft;
    lineNumbers.scrollTop = editor.scrollTop;
  }

  function getEditorValue() {
    return monacoReady && monacoEditor ? monacoEditor.getValue() : editor.value;
  }

  function setEditorValue(value, file) {
    if (monacoReady && monacoEditor) {
      const monaco = window.monaco;
      const uri = monaco.Uri.parse('file://' + normalizeWorkspacePath(file || currentFile));
      const language = file && file.endsWith('.idyl') ? MONACO_LANGUAGE_ID : 'plaintext';
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel(value, language, uri);
      } else {
        if (model.getLanguageId() !== language) monaco.editor.setModelLanguage(model, language);
        if (model.getValue() !== value) model.setValue(value);
      }
      monacoEditor.setModel(model);
      window.setTimeout(() => {
        monacoEditor.layout();
        scheduleMonacoDiagnostics();
      }, 0);
      return;
    }

    editor.value = value;
  }

  function setEditorReadOnly(readOnly) {
    if (monacoReady && monacoEditor) {
      monacoEditor.updateOptions({ readOnly });
    }
    editor.disabled = readOnly;
  }

  function isEditorReadOnly() {
    return monacoReady && monacoEditor ? Boolean(monacoEditor.getOption(window.monaco.editor.EditorOption.readOnly)) : editor.disabled;
  }

  function createInlineFileEditor(node) {
    const wrapper = document.createElement('div');
    wrapper.className = 'file-main-button file-inline-editor';
    wrapper.appendChild(createIcon(nodeIconName(node)));

    const input = document.createElement('input');
    input.className = 'file-name-input';
    input.type = 'text';
    input.value = fileEditState.value || node.name;
    input.dataset.editPath = node.path;
    input.setAttribute('aria-label', 'имя файла или папки');
    input.addEventListener('input', () => {
      fileEditState.value = input.value;
      updateInlineFileEditorValidity(input);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        commitInlineFileEdit(input);
        event.preventDefault();
      }
      if (event.key === 'Escape') {
        cancelInlineFileEdit();
        event.preventDefault();
      }
    });
    input.addEventListener('blur', () => commitInlineFileEdit(input));
    wrapper.appendChild(input);
    updateInlineFileEditorValidity(input);
    return wrapper;
  }

  function focusInlineFileEditor(path) {
    const input = [...fileList.querySelectorAll('.file-name-input')]
      .find((item) => item.dataset.editPath === path);
    if (!input) return;
    input.focus();
    input.select();
  }

  function startCreateItemInline(type, parent) {
    cancelInlineFileEdit();
    parent = normalizeWorkspacePath(parent || WORKSPACE_ROOT);
    const baseName = type === 'folder' ? 'new_folder' : 'new_file.idyl';
    const path = uniqueChildPath(parent, baseName);
    if (type === 'folder') addProjectFolder(path);
    else setProjectFile(path, { kind: 'text', content: '' });
    expandedFolders.add(parent);
    fileEditState = { mode: 'create', type, path, value: basename(path), temporary: true };
    renderFiles();
  }

  function startRenameItemInline(path, type) {
    cancelInlineFileEdit();
    path = normalizeWorkspacePath(path);
    fileEditState = { mode: 'rename', type, path, value: basename(path), temporary: false };
    renderFiles();
  }

  function startDuplicateItemInline(path, type) {
    cancelInlineFileEdit();
    path = normalizeWorkspacePath(path);
    const newPath = uniqueCopyPath(path);
    if (!copyProjectItem(path, type, newPath)) return;
    expandedFolders.add(parentPath(newPath));
    fileEditState = { mode: 'duplicate', type, path: newPath, value: basename(newPath), temporary: true };
    renderFiles();
  }

  function commitInlineFileEdit(input) {
    if (!fileEditState) return;
    const name = input.value.trim();
    if (!name) {
      if (fileEditState.temporary) cancelInlineFileEdit();
      else {
        input.classList.add('invalid');
        window.setTimeout(() => input.focus(), 0);
      }
      return;
    }

    if (inlineFileNameError(name, fileEditState)) {
      input.classList.add('invalid');
      window.setTimeout(() => input.focus(), 0);
      return;
    }

    const state = fileEditState;
    const newPath = normalizeWorkspacePath(shortFileName(parentPath(state.path)) + '/' + name);
    fileEditState = null;
    if (newPath === state.path) {
      if (state.temporary) {
        if (state.type === 'file') openFile(state.path);
        else renderFiles();
        setStatus(state.mode === 'duplicate'
          ? (state.type === 'folder' ? 'Папка дублирована' : 'Файл дублирован')
          : (state.type === 'folder' ? 'Папка создана' : 'Файл создан'));
        scheduleAutosave();
        return;
      }
      renderFiles();
      return;
    }

    renameProjectItem(state.path, state.type, newPath);
    if (state.type === 'file') openFile(newPath);
  }

  function cancelInlineFileEdit() {
    if (!fileEditState) return;
    const state = fileEditState;
    fileEditState = null;
    if (state.temporary) removeProjectItem(state.path, state.type);
    renderFiles();
  }

  function updateInlineFileEditorValidity(input) {
    if (!fileEditState) return;
    input.classList.toggle('invalid', Boolean(inlineFileNameError(input.value.trim(), fileEditState)));
  }

  function inlineFileNameError(name, state) {
    if (!name || name === '.' || name === '..') return 'empty';
    if (/[\\/]/u.test(name) || /[\u0000-\u001f]/u.test(name)) return 'invalid';
    const path = normalizeWorkspacePath(shortFileName(parentPath(state.path)) + '/' + name);
    if (path !== state.path && (files.has(path) || folders.has(path))) return 'conflict';
    if (hasFileAncestor(path)) return 'invalid';
    return '';
  }

  function uniqueChildPath(parent, baseName) {
    parent = normalizeWorkspacePath(parent || WORKSPACE_ROOT);
    const dot = baseName.lastIndexOf('.');
    const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
    const ext = dot > 0 ? baseName.slice(dot) : '';
    let index = 0;
    while (true) {
      const suffix = index === 0 ? '' : String(index + 1);
      const candidate = normalizeWorkspacePath(shortFileName(parent) + '/' + stem + suffix + ext);
      if (!files.has(candidate) && !folders.has(candidate)) return candidate;
      index++;
    }
  }

  function copyProjectItem(path, type, newPath) {
    path = normalizeWorkspacePath(path);
    newPath = normalizeWorkspacePath(newPath);
    if (!validateAvailableItemPath(newPath)) return false;
    saveCurrentEditor();

    if (type === 'file') {
      const item = files.get(path);
      if (!item) {
        setStatus('Файл не найден', true);
        return false;
      }
      setProjectFile(newPath, cloneFileItem(item));
      return true;
    }

    if (!folders.has(path)) {
      setStatus('Папка не найдена', true);
      return false;
    }
    if (newPath.startsWith(path + '/')) {
      setStatus('Нельзя дублировать папку внутрь самой себя', true);
      return false;
    }

    const prefix = path + '/';
    addProjectFolder(newPath);
    for (const folder of [...folders].filter((folder) => folder.startsWith(prefix))) {
      addProjectFolder(newPath + folder.slice(path.length));
    }
    for (const [file, item] of [...files.entries()].filter(([file]) => file.startsWith(prefix))) {
      setProjectFile(newPath + file.slice(path.length), cloneFileItem(item));
    }
    return true;
  }

  function createProjectFile(path, content) {
    path = normalizeWorkspacePath(path);
    if (!validateAvailableItemPath(path)) return;
    setProjectFile(path, { kind: 'text', content });
    expandedFolders.add(parentPath(path));
    openFile(path);
    setStatus('Файл создан');
    scheduleAutosave();
  }

  function createProjectFolder(path) {
    path = normalizeWorkspacePath(path);
    if (!validateAvailableItemPath(path)) return;
    addProjectFolder(path);
    expandedFolders.add(parentPath(path));
    renderFiles();
    setStatus('Папка создана');
    scheduleAutosave();
  }

  function renameProjectItem(path, type, newPath) {
    path = normalizeWorkspacePath(path);
    newPath = normalizeWorkspacePath(newPath);
    if (path === newPath) {
      return;
    }
    if (!validateAvailableItemPath(newPath)) return;
    saveCurrentEditor();

    if (type === 'file') {
      const item = files.get(path);
      if (!item) {
        setStatus('Файл не найден', true);
        return;
      }
      files.delete(path);
      setProjectFile(newPath, cloneFileItem(item));
      if (currentFile === path) currentFile = newPath;
      expandedFolders.add(parentPath(newPath));
      openFile(currentFile);
      setStatus('Файл переименован');
      scheduleAutosave();
      return;
    }

    if (!folders.has(path)) {
      setStatus('Папка не найдена', true);
      return;
    }
    if (newPath.startsWith(path + '/')) {
      setStatus('Нельзя переместить папку внутрь самой себя', true);
      return;
    }

    const prefix = path + '/';
    const movedFolders = [...folders]
      .filter((folder) => folder === path || folder.startsWith(prefix))
      .map((folder) => newPath + folder.slice(path.length));
    const movedFiles = [...files.entries()]
      .filter(([file]) => file.startsWith(prefix))
      .map(([file, item]) => [newPath + file.slice(path.length), cloneFileItem(item)]);

    for (const folder of [...folders]) {
      if (folder === path || folder.startsWith(prefix)) folders.delete(folder);
    }
    for (const file of [...files.keys()]) {
      if (file.startsWith(prefix)) files.delete(file);
    }
    for (const folder of movedFolders) addProjectFolder(folder);
    for (const [file, item] of movedFiles) setProjectFile(file, item);

    for (const folder of [...expandedFolders]) {
      if (folder === path || folder.startsWith(prefix)) {
        expandedFolders.delete(folder);
        expandedFolders.add(newPath + folder.slice(path.length));
      }
    }
    expandedFolders.add(parentPath(newPath));
    if (currentFile.startsWith(prefix)) currentFile = newPath + currentFile.slice(path.length);

    openFile(currentFile);
    setStatus('Папка переименована');
    scheduleAutosave();
  }

  function duplicateProjectItem(path, type, newPath) {
    path = normalizeWorkspacePath(path);
    newPath = normalizeWorkspacePath(newPath);
    if (!validateAvailableItemPath(newPath)) return;
    saveCurrentEditor();

    if (type === 'file') {
      const item = files.get(path);
      if (!item) {
        setStatus('Файл не найден', true);
        return;
      }
      setProjectFile(newPath, cloneFileItem(item));
      expandedFolders.add(parentPath(newPath));
      openFile(newPath);
      setStatus('Файл дублирован');
      scheduleAutosave();
      return;
    }

    if (!folders.has(path)) {
      setStatus('Папка не найдена', true);
      return;
    }
    if (newPath.startsWith(path + '/')) {
      setStatus('Нельзя дублировать папку внутрь самой себя', true);
      return;
    }

    const prefix = path + '/';
    addProjectFolder(newPath);
    for (const folder of [...folders].filter((folder) => folder.startsWith(prefix))) {
      addProjectFolder(newPath + folder.slice(path.length));
    }
    for (const [file, item] of [...files.entries()].filter(([file]) => file.startsWith(prefix))) {
      setProjectFile(newPath + file.slice(path.length), cloneFileItem(item));
    }
    expandedFolders.add(parentPath(newPath));
    renderFiles();
    setStatus('Папка дублирована');
    scheduleAutosave();
  }

  function openDeleteConfirm(path, type, left, top) {
    fileContextMenu.replaceChildren();
    const label = document.createElement('div');
    label.className = 'file-delete-prompt';
    label.textContent = 'Удалить?';
    fileContextMenu.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'file-delete-actions';
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.textContent = 'Да';
    yes.addEventListener('click', () => {
      hideFileContextMenu();
      deleteProjectItem(path, type);
    });
    const no = document.createElement('button');
    no.type = 'button';
    no.textContent = 'Нет';
    no.addEventListener('click', hideFileContextMenu);
    actions.append(yes, no);
    fileContextMenu.appendChild(actions);
    positionFileContextMenu(left, top);
  }

  function deleteProjectItem(path, type) {
    path = normalizeWorkspacePath(path);
    saveCurrentEditor();
    removeProjectItem(path, type);

    if (files.size === 0) setProjectFile(MAIN_FILE, { kind: 'text', content: '' });
    if (!files.has(currentFile)) currentFile = fallbackFilePath();
    editorReady = false;
    openFile(currentFile);
    setStatus(type === 'folder' ? 'Папка удалена' : 'Файл удалён');
    scheduleAutosave();
  }

  function removeProjectItem(path, type) {
    path = normalizeWorkspacePath(path);
    if (type === 'folder') {
      const prefix = path + '/';
      for (const file of [...files.keys()]) {
        if (file.startsWith(prefix)) files.delete(file);
      }
      for (const folder of [...folders]) {
        if (folder === path || folder.startsWith(prefix)) folders.delete(folder);
      }
      for (const folder of [...expandedFolders]) {
        if (folder === path || folder.startsWith(prefix)) expandedFolders.delete(folder);
      }
      return;
    }

    files.delete(path);
  }

  function openFileContextMenu(node, left, top) {
    fileContextMenu.replaceChildren();
    const actions = node.path === WORKSPACE_ROOT
      ? [
          ['Новый файл', () => startCreateItemInline('file', WORKSPACE_ROOT)],
          ['Новая папка', () => startCreateItemInline('folder', WORKSPACE_ROOT)],
        ]
      : node.type === 'folder'
      ? [
          ['Новый файл', () => startCreateItemInline('file', node.path)],
          ['Новая папка', () => startCreateItemInline('folder', node.path)],
          ['Переименовать', () => startRenameItemInline(node.path, 'folder')],
          ['Дублировать', () => startDuplicateItemInline(node.path, 'folder')],
          ['Удалить', () => openDeleteConfirm(node.path, 'folder', left, top)],
        ]
      : [
          ['Переименовать', () => startRenameItemInline(node.path, 'file')],
          ['Дублировать', () => startDuplicateItemInline(node.path, 'file')],
          ['Удалить', () => openDeleteConfirm(node.path, 'file', left, top)],
        ];

    for (const [label, action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        hideFileContextMenu();
        action();
      });
      fileContextMenu.appendChild(button);
    }

    positionFileContextMenu(left, top);
  }

  function positionFileContextMenu(left, top) {
    fileContextMenu.hidden = false;
    const margin = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rect = fileContextMenu.getBoundingClientRect();
    fileContextMenu.style.left = clamp(left, margin, Math.max(margin, viewportWidth - rect.width - margin)) + 'px';
    fileContextMenu.style.top = clamp(top, margin, Math.max(margin, viewportHeight - rect.height - margin)) + 'px';
  }

  function hideFileContextMenu() {
    fileContextMenu.hidden = true;
  }

  function toggleFolder(path) {
    path = normalizeWorkspacePath(path);
    if (expandedFolders.has(path)) {
      expandedFolders.delete(path);
    } else {
      expandedFolders.add(path);
    }
    renderFiles();
    scheduleAutosave();
  }

  function projectTree() {
    const root = { type: 'folder', name: 'workspace', path: WORKSPACE_ROOT, children: [] };
    const nodes = new Map([[WORKSPACE_ROOT, root]]);

    const ensureNodeFolder = (path) => {
      path = normalizeWorkspacePath(path);
      if (nodes.has(path)) return nodes.get(path);
      const parent = ensureNodeFolder(parentPath(path));
      const node = { type: 'folder', name: basename(path), path, children: [] };
      nodes.set(path, node);
      parent.children.push(node);
      return node;
    };

    for (const folder of [...folders].sort(pathSort)) {
      if (folder !== WORKSPACE_ROOT) ensureNodeFolder(folder);
    }
    for (const [file, item] of [...files.entries()].sort(([left], [right]) => pathSort(left, right))) {
      const parent = ensureNodeFolder(parentPath(file));
      parent.children.push({
        type: 'file',
        name: basename(file),
        path: file,
        kind: item.kind,
        children: [],
      });
    }

    sortTreeChildren(root);
    return root;
  }

  function sortTreeChildren(node) {
    node.children.sort((left, right) => {
      if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
      return left.name.localeCompare(right.name, 'ru');
    });
    for (const child of node.children) {
      if (child.type === 'folder') sortTreeChildren(child);
    }
  }

  function nodeIconName(node) {
    if (node.type === 'folder') return expandedFolders.has(node.path) ? 'folder-open' : 'folder';
    return node.kind === 'asset' ? 'asset' : 'file';
  }

  function createIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');

    if (name === 'menu') {
      for (const y of [6, 12, 18]) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', '1.5');
        circle.setAttribute('fill', 'currentColor');
        svg.appendChild(circle);
      }
      return svg;
    }

    const paths = {
      file: ['M6 3h8l4 4v14H6z', 'M14 3v5h5'],
      asset: ['M5 4h14v16H5z', 'M8 15l3-3 2 2 2-3 3 4', 'M9 8h.01'],
      folder: ['M3 6h7l2 2h9v11H3z'],
      'folder-open': ['M3 7h7l2 2h9l-2 10H3z', 'M3 7v12'],
    };

    for (const d of paths[name] || paths.file) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  function setProjectFile(path, item) {
    path = normalizeWorkspacePath(path);
    ensureParentFolders(path);
    files.set(path, item);
  }

  function addProjectFolder(path) {
    path = normalizeWorkspacePath(path);
    if (path === WORKSPACE_ROOT) return;
    const parts = shortFileName(path).split('/');
    let current = WORKSPACE_ROOT;
    for (const part of parts) {
      current = current === WORKSPACE_ROOT ? WORKSPACE_ROOT + '/' + part : current + '/' + part;
      folders.add(current);
    }
  }

  function syncFoldersFromFiles() {
    folders.add(WORKSPACE_ROOT);
    for (const file of files.keys()) ensureParentFolders(file);
  }

  function ensureParentFolders(path) {
    const parent = parentPath(path);
    if (parent !== WORKSPACE_ROOT) addProjectFolder(parent);
    folders.add(WORKSPACE_ROOT);
  }

  function validateAvailableItemPath(path) {
    path = normalizeWorkspacePath(path);
    if (path === WORKSPACE_ROOT) {
      setStatus('Нужно указать имя внутри проекта', true);
      return false;
    }
    if (files.has(path) || folders.has(path)) {
      setStatus('Такое имя уже занято', true);
      return false;
    }
    if (hasFileAncestor(path)) {
      setStatus('Внутри файла нельзя создать элемент', true);
      return false;
    }
    return true;
  }

  function resolveNewItemPath(parent, input) {
    input = String(input).trim();
    if (input.startsWith(WORKSPACE_ROOT + '/') || input.startsWith('/')) return normalizeWorkspacePath(input);
    parent = normalizeWorkspacePath(parent || WORKSPACE_ROOT);
    const base = parent === WORKSPACE_ROOT ? '' : shortFileName(parent) + '/';
    return normalizeWorkspacePath(base + input);
  }

  function resolveRenamePath(path, input) {
    input = String(input).trim();
    if (input.includes('/') || input.startsWith(WORKSPACE_ROOT + '/') || input.startsWith('/')) {
      return normalizeWorkspacePath(input);
    }
    return normalizeWorkspacePath(shortFileName(parentPath(path)) + '/' + input);
  }

  function uniqueCopyPath(path) {
    path = normalizeWorkspacePath(path);
    const parent = parentPath(path);
    const name = basename(path);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let index = 0;
    while (true) {
      const suffix = index === 0 ? '_copy' : `_copy${index + 1}`;
      const candidate = normalizeWorkspacePath(shortFileName(parent) + '/' + stem + suffix + ext);
      if (!files.has(candidate) && !folders.has(candidate)) return candidate;
      index++;
    }
  }

  function cloneFileItem(item) {
    return {
      kind: item.kind,
      content: item.content || '',
      bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : undefined,
      resourceUri: item.resourceUri || '',
    };
  }

  function hasFileAncestor(path) {
    let parent = parentPath(path);
    while (parent !== WORKSPACE_ROOT) {
      if (files.has(parent)) return true;
      parent = parentPath(parent);
    }
    return false;
  }

  function fallbackFilePath() {
    if (files.has(MAIN_FILE)) return MAIN_FILE;
    return [...files.keys()].sort(pathSort)[0] || MAIN_FILE;
  }

  function pathSort(left, right) {
    return left.localeCompare(right, 'ru');
  }

  async function loadDroppedFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) return;

    let lastPath = null;
    for (const file of selected) {
      lastPath = await loadExternalFile(file);
    }

    hideUploadMenu();
    if (lastPath) openFile(lastPath);
    scheduleAutosave();
    setStatus(`Загружено файлов: ${selected.length}`);
  }

  async function loadExternalFile(file) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      return importProjectZip(new Uint8Array(await file.arrayBuffer()));
    }

    const path = normalizeWorkspacePath(file.webkitRelativePath || file.name);
    if (isEditableTextFile(file)) {
      setProjectFile(path, {
        kind: 'text',
        content: await readFileAsText(file),
      });
      return path;
    }

    setProjectFile(path, {
      kind: 'asset',
      content: '',
      bytes: new Uint8Array(await file.arrayBuffer()),
      resourceUri: await readFileAsDataUrl(file),
    });
    return path;
  }

  async function runProgram() {
    stopProgram(true);
    const runId = ++runSequence;
    saveCurrentEditor();
    hideCompletions();
    output.textContent = '';
    consoleInputEchoes = [];
    lastSnapshotJson = '';
    const controller = new AbortController();
    runAbortController = controller;
    setRunControls(true);
    setStatus('Запуск...');
    postEmptySnapshot();

    try {
      const prepared = await window.Idyllium.prepareIdylliumBrowserProgram({
        entryFile: MAIN_FILE,
        files: browserFiles(),
        abortSignal: controller.signal,
        console: {
          clear() {
            consoleInputEchoes = [];
            output.replaceChildren();
          },
          async readLine() {
            return requestConsoleInput(controller.signal);
          },
        },
      });
      if (runId !== runSequence) return;

      if (!prepared.compilation.success || !prepared.runtime) {
        setOutputText(formatDiagnosticText(prepared.compilation.diagnosticsText), 'output-error');
        setStatus('Ошибка компиляции', true);
        runAbortController = null;
        currentRuntimeFileSnapshot = null;
        setRunControls(false);
        return;
      }

      currentRuntime = prepared.runtime;
      currentRuntimeFileSnapshot = prepared.fileSystemSnapshot;
      startOutputSync();
      await prepared.run();
      if (runId !== runSequence) return;
      syncRuntimeFilesFromSnapshot();
      syncRuntimeOutput();
      sendRuntimeSnapshot();
      if (runtimeHasGui(currentRuntime)) {
        startGuiLoop();
        setRunControls(false, true);
      } else {
        stopOutputSync();
        if (!output.textContent) output.textContent = 'Программа Idyllium успешно завершилась.';
        runAbortController = null;
        setRunControls(false);
      }
      setStatus('Готово');
    } catch (error) {
      if (runId !== runSequence) return;
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      stopOutputSync();
      const wasStopped = controller.signal.aborted;
      appendOutput(formatThrownError(error), wasStopped ? 'output-soft-error' : 'output-error');
      setStatus(wasStopped ? 'Остановлено' : 'Ошибка запуска', !wasStopped);
      currentRuntime = null;
      currentRuntimeFileSnapshot = null;
      postEmptySnapshot();
    }
    if (!runtimeHasGui(currentRuntime)) {
      runAbortController = null;
      currentRuntimeFileSnapshot = null;
      setRunControls(false);
    }
  }

  function stopProgram(silent = false) {
    const hadRuntime = Boolean(currentRuntime || runAbortController);
    if (hadRuntime) runSequence++;
    if (runAbortController && !runAbortController.signal.aborted) runAbortController.abort();
    syncRuntimeFilesFromSnapshot();
    stopOutputSync();
    stopGuiLoop();
    clearPendingConsoleInput();
    currentRuntime = null;
    currentRuntimeFileSnapshot = null;
    runAbortController = null;
    postEmptySnapshot();
    setRunControls(false);
    if (!silent && hadRuntime) {
      appendOutput('Приложение остановлено пользователем', 'output-soft-error');
      setStatus('Остановлено');
    }
  }

  function setRunControls(active, keepStopAvailable = false) {
    runButton.disabled = active;
    stopButton.disabled = !(active || keepStopAvailable);
  }

  function startOutputSync() {
    stopOutputSync();
    syncRuntimeOutput();
    outputSyncTimer = window.setInterval(syncRuntimeOutput, 100);
  }

  function stopOutputSync() {
    if (outputSyncTimer !== null) window.clearInterval(outputSyncTimer);
    outputSyncTimer = null;
  }

  function syncRuntimeOutput() {
    if (!currentRuntime) return;
    setOutputText(renderRuntimeOutput(currentRuntime.getOutput()), '', { ansi: true });
  }

  function syncRuntimeFilesFromSnapshot() {
    if (typeof currentRuntimeFileSnapshot !== 'function') return false;

    const snapshot = currentRuntimeFileSnapshot() || {};
    let changed = false;
    let currentFileChanged = false;

    for (const [rawPath, rawEntry] of Object.entries(snapshot)) {
      const path = normalizeWorkspacePath(rawPath);
      if (path === WORKSPACE_ROOT) continue;

      const entry = typeof rawEntry === 'string'
        ? { kind: 'file', content: rawEntry, resourceUri: '' }
        : rawEntry || {};

      if (entry.kind === 'directory') {
        if (!folders.has(path)) {
          addProjectFolder(path);
          changed = true;
        }
        continue;
      }

      if (entry.resourceUri) continue;

      const content = typeof entry.content === 'string' ? entry.content : '';
      const previous = files.get(path);
      if (!previous || previous.kind !== 'text' || previous.content !== content) {
        setProjectFile(path, { kind: 'text', content });
        changed = true;
        if (path === currentFile) currentFileChanged = true;
      }
    }

    if (!changed) return false;

    if (currentFileChanged) {
      const item = files.get(currentFile);
      if (item && item.kind === 'text') {
        setEditorValue(item.content || '', currentFile);
        updateEditorVisuals();
      }
    }

    renderFiles();
    scheduleAutosave();
    return true;
  }

  function renderRuntimeOutput(runtimeOutput) {
    if (consoleInputEchoes.length === 0) return runtimeOutput;
    let rendered = '';
    let cursor = 0;
    const echoes = [...consoleInputEchoes].sort((left, right) => (
      left.offset === right.offset ? left.order - right.order : left.offset - right.offset
    ));
    for (const echo of echoes) {
      const offset = clamp(echo.offset, cursor, runtimeOutput.length);
      rendered += runtimeOutput.slice(cursor, offset) + echo.text;
      cursor = offset;
    }
    return rendered + runtimeOutput.slice(cursor);
  }

  function runtimeHasGui(runtime) {
    return Boolean(runtime && (
      runtime.getWindows().length > 0
      || runtime.getCanvases().length > 0
      || runtime.getModals().length > 0
    ));
  }

  function requestConsoleInput(signal) {
    if (signal.aborted) return Promise.reject(new Error('program was stopped'));
    if (pendingConsoleInput) {
      pendingConsoleInput.reject(new Error('program was stopped'));
      clearPendingConsoleInput();
    }

    consoleInput.value = '';
    consoleInputPanel.hidden = false;
    window.setTimeout(() => consoleInput.focus(), 0);

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new Error('program was stopped'));
        clearPendingConsoleInput();
      };
      pendingConsoleInput = {
        resolve,
        reject,
        onAbort,
        signal,
        outputOffset: currentRuntime ? currentRuntime.getOutput().length : 0,
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function submitConsoleInput() {
    if (!pendingConsoleInput) return;
    const value = consoleInput.value;
    const pending = pendingConsoleInput;
    consoleInputEchoes.push({
      offset: pending.outputOffset,
      order: consoleInputEchoes.length,
      text: value + '\n',
    });
    clearPendingConsoleInput();
    syncRuntimeOutput();
    pending.resolve(value);
  }

  function clearPendingConsoleInput() {
    if (pendingConsoleInput) {
      pendingConsoleInput.signal.removeEventListener('abort', pendingConsoleInput.onAbort);
    }
    pendingConsoleInput = null;
    consoleInput.value = '';
    consoleInputPanel.hidden = true;
  }

  function formatCurrentFile() {
    if (!currentFile.endsWith('.idyl') || isEditorReadOnly()) {
      setStatus('Форматирование доступно только для .idyl', true);
      return;
    }
    const formatted = window.Idyllium.formatIdyllium(getEditorValue());
    setEditorValue(formatted, currentFile);
    saveCurrentEditor();
    updateEditorVisuals();
    setStatus('Код отформатирован');
  }

  function browserFiles() {
    const result = {};
    for (const folder of folders) {
      result[folder] = { kind: 'directory' };
    }
    for (const [file, item] of files) {
      result[file] = item.kind === 'asset'
        ? { content: item.content || '', resourceUri: item.resourceUri }
        : item.content;
    }
    return result;
  }

  async function downloadProject() {
    saveCurrentEditor();
    try {
      const blob = await createProjectZip();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'idyllium-project.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Проект скачан');
    } catch (error) {
      setStatus('Не удалось скачать проект', true);
      appendOutput(formatThrownError(error), 'output-error');
    }
  }

  async function createProjectZip() {
    const entries = [];
    syncFoldersFromFiles();
    for (const folder of [...folders].filter((path) => path !== WORKSPACE_ROOT).sort(pathSort)) {
      entries.push({ name: shortFileName(folder) + '/', bytes: new Uint8Array() });
    }
    for (const [file, item] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const name = shortFileName(file);
      const bytes = item.kind === 'asset'
        ? assetBytes(item)
        : new TextEncoder().encode(item.content || '');
      entries.push({ name, bytes });
    }
    return new Blob([zipBytes(entries)], { type: 'application/zip' });
  }

  function importProjectZip(bytes) {
    const entries = unzipStoredEntries(bytes);
    if (entries.length === 0) throw new Error('ZIP-архив не содержит файлов');

    saveCurrentEditor();
    stopGuiLoop();
    currentRuntime = null;
    files.clear();
    folders.clear();
    folders.add(WORKSPACE_ROOT);
    expandedFolders.clear();
    expandedFolders.add(WORKSPACE_ROOT);

    let firstPath = null;
    for (const entry of entries) {
      const path = normalizeWorkspacePath(entry.name);
      if (entry.directory) {
        addProjectFolder(path);
        continue;
      }
      if (!firstPath) firstPath = path;
      if (isEditableTextName(entry.name)) {
        setProjectFile(path, {
          kind: 'text',
          content: new TextDecoder('utf-8').decode(entry.bytes),
        });
      } else {
        setProjectFile(path, {
          kind: 'asset',
          content: '',
          bytes: entry.bytes,
          resourceUri: bytesToDataUrl(entry.name, entry.bytes),
        });
      }
    }

    editorReady = false;
    if (files.size === 0) setProjectFile(MAIN_FILE, { kind: 'text', content: '' });
    currentFile = files.has(MAIN_FILE) ? MAIN_FILE : firstPath || MAIN_FILE;
    renderFiles();
    postEmptySnapshot();
    setStatus('Проект импортирован из ZIP');
    return currentFile;
  }

  function assetBytes(item) {
    if (item.bytes instanceof Uint8Array) return item.bytes;
    if (item.resourceUri && item.resourceUri.startsWith('data:')) return dataUrlBytes(item.resourceUri);
    return new TextEncoder().encode(item.content || '');
  }

  function zipBytes(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = new TextEncoder().encode(entry.name);
      const data = entry.bytes;
      const crc = crc32(data);
      const localHeader = zipHeader(30);
      localHeader.setUint32(0, 0x04034b50, true);
      localHeader.setUint16(4, 20, true);
      localHeader.setUint16(6, 0x0800, true);
      localHeader.setUint16(8, 0, true);
      localHeader.setUint16(10, dosTime().time, true);
      localHeader.setUint16(12, dosTime().date, true);
      localHeader.setUint32(14, crc, true);
      localHeader.setUint32(18, data.length, true);
      localHeader.setUint32(22, data.length, true);
      localHeader.setUint16(26, nameBytes.length, true);
      localHeader.setUint16(28, 0, true);

      chunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);

      const centralHeader = zipHeader(46);
      centralHeader.setUint32(0, 0x02014b50, true);
      centralHeader.setUint16(4, 20, true);
      centralHeader.setUint16(6, 20, true);
      centralHeader.setUint16(8, 0x0800, true);
      centralHeader.setUint16(10, 0, true);
      centralHeader.setUint16(12, dosTime().time, true);
      centralHeader.setUint16(14, dosTime().date, true);
      centralHeader.setUint32(16, crc, true);
      centralHeader.setUint32(20, data.length, true);
      centralHeader.setUint32(24, data.length, true);
      centralHeader.setUint16(28, nameBytes.length, true);
      centralHeader.setUint16(30, 0, true);
      centralHeader.setUint16(32, 0, true);
      centralHeader.setUint16(34, 0, true);
      centralHeader.setUint16(36, 0, true);
      centralHeader.setUint32(38, 0, true);
      centralHeader.setUint32(42, offset, true);

      central.push(new Uint8Array(centralHeader.buffer), nameBytes);
      offset += localHeader.byteLength + nameBytes.length + data.length;
    }

    const centralOffset = offset;
    const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = zipHeader(22);
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, centralOffset, true);
    end.setUint16(20, 0, true);

    return concatBytes([...chunks, ...central, new Uint8Array(end.buffer)]);
  }

  function textSourceMap() {
    const result = new Map();
    for (const [file, item] of files) {
      if (item.kind === 'text' && file.endsWith('.idyl')) result.set(file, item.content);
    }
    return result;
  }

  async function handleGuiEvent(message) {
    if (!currentRuntime || guiBusy || !message || message.type !== 'guiEvent') return;
    guiBusy = true;
    try {
      await currentRuntime.dispatchGuiEvent(Number(message.objectId), String(message.eventName), message.payload || {});
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      sendRuntimeSnapshot();
    } finally {
      guiBusy = false;
    }
  }

  function startGuiLoop() {
    if (!currentRuntime) return;
    lastTick = Date.now();
    const intervalMs = guiLoopIntervalMs(currentRuntime);
    guiTimer = window.setInterval(async () => {
      if (!currentRuntime || guiBusy) return;
      guiBusy = true;
      try {
        const now = Date.now();
        const delta = Math.max(0, (now - lastTick) / 1000);
        lastTick = now;
        await currentRuntime.stepGui(delta);
        syncRuntimeOutput();
        syncRuntimeFilesFromSnapshot();
        sendRuntimeSnapshot();
      } catch (error) {
        stopOutputSync();
        appendOutput(formatThrownError(error), 'output-error');
        setStatus('Ошибка GUI-шага', true);
        stopGuiLoop();
        currentRuntime = null;
        runAbortController = null;
        setRunControls(false);
        postEmptySnapshot();
      } finally {
        guiBusy = false;
      }
    }, intervalMs);
  }

  function stopGuiLoop() {
    if (guiTimer !== null) window.clearInterval(guiTimer);
    guiTimer = null;
  }

  function sendRuntimeSnapshot() {
    if (!currentRuntime) {
      postEmptySnapshot();
      return;
    }
    postSnapshot({
      windows: currentRuntime.getWindows(),
      canvases: currentRuntime.getCanvases(),
      modals: currentRuntime.getModals(),
      output: '',
    });
  }

  function guiLoopIntervalMs(runtime) {
    const candidates = [];
    const collectCanvas = (canvas) => {
      const limit = Number(canvas && canvas.properties && canvas.properties.framerate_limit);
      if (Number.isFinite(limit) && limit > 0) candidates.push(limit);
    };
    for (const canvas of runtime.getCanvases()) collectCanvas(canvas);
    const visitWidget = (widget) => {
      if (!widget) return;
      if (widget.canvas) collectCanvas(widget.canvas);
      for (const child of widget.children || []) visitWidget(child);
    };
    for (const win of runtime.getWindows()) visitWidget(win);
    const fps = Math.max(1, Math.min(60, candidates.length > 0 ? Math.max(...candidates) : 30));
    return Math.max(16, Math.round(1000 / fps));
  }

  function postEmptySnapshot() {
    postSnapshot({ windows: [], canvases: [], modals: [], output: '' });
  }

  function postSnapshot(snapshot) {
    pendingSnapshot = snapshot;
    if (!guiFrameReady || !guiFrame.contentWindow) return;
    const snapshotJson = JSON.stringify(snapshot);
    if (snapshotJson === lastSnapshotJson) return;
    lastSnapshotJson = snapshotJson;
    guiFrame.contentWindow.postMessage({
      type: 'snapshot',
      windows: snapshot.windows,
      canvases: snapshot.canvases,
      modals: snapshot.modals,
      output: snapshot.output,
    }, '*');
  }

  function setOutputText(text, className = '', options = {}) {
    output.replaceChildren();
    if (!className) {
      if (options.ansi) {
        appendAnsiText(output, text);
      } else {
        output.textContent = text;
      }
      return;
    }
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    output.appendChild(span);
  }

  function appendOutput(text, className = '', options = {}) {
    if (output.textContent) output.appendChild(document.createTextNode('\n'));
    if (!className) {
      if (options.ansi) {
        appendAnsiText(output, text);
      } else {
        output.appendChild(document.createTextNode(text));
      }
      return;
    }
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    output.appendChild(span);
  }

  function appendAnsiText(parent, text) {
    for (const node of ansiTextNodes(String(text))) {
      parent.appendChild(node);
    }
  }

  function ansiTextNodes(text) {
    let foregroundClass = '';
    let bold = false;
    let buffer = '';
    const nodes = [];

    const flush = () => {
      if (!buffer) return;
      if (!foregroundClass && !bold) {
        nodes.push(document.createTextNode(buffer));
      } else {
        const span = document.createElement('span');
        span.className = [foregroundClass, bold ? 'ansi-bold' : ''].filter(Boolean).join(' ');
        span.textContent = buffer;
        nodes.push(span);
      }
      buffer = '';
    };

    for (let index = 0; index < text.length;) {
      if (text.charCodeAt(index) !== 27 || text[index + 1] !== '[') {
        buffer += text[index];
        index += 1;
        continue;
      }

      const end = findAnsiEnd(text, index + 2);
      if (end === -1) {
        index += 1;
        continue;
      }

      flush();
      const command = text[end];
      const rawParams = text.slice(index + 2, end);
      const params = rawParams.length === 0 ? [0] : rawParams.split(';').map((part) => Number(part || 0));

      if (command === 'm') {
        for (const param of params) {
          if (param === 0) {
            foregroundClass = '';
            bold = false;
          } else if (param === 1) {
            bold = true;
          } else if (param === 22) {
            bold = false;
          } else if (param === 39) {
            foregroundClass = '';
          } else if (ANSI_FOREGROUND_CLASSES.has(param)) {
            foregroundClass = ANSI_FOREGROUND_CLASSES.get(param);
          }
        }
      } else if (command === 'J' && params.some((param) => param === 2 || param === 3)) {
        nodes.length = 0;
        buffer = '';
      }

      index = end + 1;
    }

    flush();
    return nodes;
  }

  function findAnsiEnd(text, start) {
    for (let index = start; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 0x40 && code <= 0x7e) return index;
    }
    return -1;
  }

  function setStatus(text, isError = false) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('error', isError);
  }

  function applySavedLayout() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) || '{}');
      if (typeof saved.filesWidth === 'number') workspace.style.setProperty('--files-width', `${saved.filesWidth}px`);
      if (typeof saved.runtimeWidth === 'number') workspace.style.setProperty('--runtime-width', `${saved.runtimeWidth}px`);
      if (typeof saved.outputHeight === 'number') runtimePane.style.setProperty('--output-height', `${saved.outputHeight}px`);
    } catch (_error) {
      // Invalid user layout data can be ignored safely.
    }
  }

  function installColumnResizers() {
    for (const resizer of document.querySelectorAll('.column-resizer')) {
      resizer.addEventListener('pointerdown', (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        target.setPointerCapture(event.pointerId);
        target.classList.add('dragging');
        const type = target.dataset.resizer;

        const onMove = (moveEvent) => {
          const rect = workspace.getBoundingClientRect();
          const current = currentLayoutWidths();
          const minFiles = 150;
          const minEditor = 280;
          const minRuntime = 300;

          if (type === 'files') {
            const maxFiles = rect.width - current.runtimeWidth - minEditor - 12;
            const filesWidth = clamp(moveEvent.clientX - rect.left, minFiles, Math.max(minFiles, maxFiles));
            workspace.style.setProperty('--files-width', `${filesWidth}px`);
          }

          if (type === 'runtime') {
            const maxRuntime = rect.width - current.filesWidth - minEditor - 12;
            const runtimeWidth = clamp(rect.right - moveEvent.clientX, minRuntime, Math.max(minRuntime, maxRuntime));
            workspace.style.setProperty('--runtime-width', `${runtimeWidth}px`);
          }
        };

        const onUp = () => {
          target.classList.remove('dragging');
          target.releasePointerCapture(event.pointerId);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          saveLayoutWidths();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        event.preventDefault();
      });
    }
  }

  function installRuntimeRowResizer() {
    if (!runtimeRowResizer || !runtimePane) return;
    runtimeRowResizer.addEventListener('pointerdown', (event) => {
      runtimeRowResizer.setPointerCapture(event.pointerId);
      runtimeRowResizer.classList.add('dragging');

      const onMove = (moveEvent) => {
        const rect = runtimePane.getBoundingClientRect();
        const minOutput = 90;
        const minPreview = 160;
        const maxOutput = Math.max(minOutput, rect.height - minPreview - 6);
        const outputHeight = clamp(moveEvent.clientY - rect.top, minOutput, maxOutput);
        runtimePane.style.setProperty('--output-height', `${outputHeight}px`);
      };

      const onUp = () => {
        runtimeRowResizer.classList.remove('dragging');
        runtimeRowResizer.releasePointerCapture(event.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        saveLayoutWidths();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      event.preventDefault();
    });
  }

  function currentLayoutWidths() {
    const columns = getComputedStyle(workspace).gridTemplateColumns.split(/\s+/u).map((value) => Number.parseFloat(value));
    const rows = runtimePane ? getComputedStyle(runtimePane).gridTemplateRows.split(/\s+/u).map((value) => Number.parseFloat(value)) : [];
    return {
      filesWidth: columns[0] || 220,
      runtimeWidth: columns[4] || Math.max(300, workspace.getBoundingClientRect().width * 0.42),
      outputHeight: rows[0] || Math.max(120, (runtimePane?.getBoundingClientRect().height || 400) * 0.32),
    };
  }

  function saveLayoutWidths() {
    const current = currentLayoutWidths();
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(current));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function scheduleAutosave() {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      saveProjectState().catch((error) => {
        setStatus('Автосохранение не удалось', true);
        appendOutput(formatThrownError(error), 'output-error');
      });
    }, AUTOSAVE_DELAY_MS);
  }

  async function saveProjectState() {
    const db = await openProjectDb();
    await idbRequest(db.transaction(PROJECT_DB_STORE, 'readwrite')
      .objectStore(PROJECT_DB_STORE)
      .put(serializeProjectState(), PROJECT_STATE_KEY));
    db.close();
  }

  async function loadProjectState() {
    const db = await openProjectDb();
    const state = await idbRequest(db.transaction(PROJECT_DB_STORE, 'readonly')
      .objectStore(PROJECT_DB_STORE)
      .get(PROJECT_STATE_KEY));
    db.close();
    return state || null;
  }

  function serializeProjectState() {
    syncFoldersFromFiles();
    return {
      version: 2,
      currentFile,
      savedAt: new Date().toISOString(),
      folders: [...folders].filter((path) => path !== WORKSPACE_ROOT).sort(pathSort),
      expandedFolders: [...expandedFolders].filter((path) => path !== WORKSPACE_ROOT).sort(pathSort),
      files: [...files.entries()].map(([path, item]) => ({
        path,
        kind: item.kind,
        content: item.content || '',
        bytes: item.bytes instanceof Uint8Array ? item.bytes : null,
        resourceUri: item.resourceUri || '',
      })),
    };
  }

  function restoreProjectState(state) {
    if (!state || !Array.isArray(state.files)) return;
    files.clear();
    folders.clear();
    folders.add(WORKSPACE_ROOT);
    expandedFolders.clear();
    expandedFolders.add(WORKSPACE_ROOT);
    if (Array.isArray(state.folders)) {
      for (const folder of state.folders) addProjectFolder(folder);
    }
    if (Array.isArray(state.expandedFolders)) {
      for (const folder of state.expandedFolders) expandedFolders.add(normalizeWorkspacePath(folder));
    }
    for (const entry of state.files) {
      const path = normalizeWorkspacePath(entry.path || '');
      if (!path || path === WORKSPACE_ROOT) continue;
      if (entry.kind === 'asset') {
        setProjectFile(path, {
          kind: 'asset',
          content: entry.content || '',
          bytes: entry.bytes ? new Uint8Array(entry.bytes) : undefined,
          resourceUri: entry.resourceUri || '',
        });
      } else {
        setProjectFile(path, {
          kind: 'text',
          content: entry.content || '',
        });
      }
    }
    if (files.size === 0) {
      setProjectFile(MAIN_FILE, { kind: 'text', content: '' });
    }
    currentFile = typeof state.currentFile === 'string' ? normalizeWorkspacePath(state.currentFile) : MAIN_FILE;
  }

  function isLegacyDefaultCanvasProject(state) {
    if (!state || !Array.isArray(state.files)) return false;
    const main = state.files.find((entry) => normalizeWorkspacePath(entry.path || '') === MAIN_FILE);
    if (!main || typeof main.content !== 'string') return false;
    return main.content.includes('win.title = "Idyllium Canvas";')
      && main.content.includes('title.text = "Привет, Canvas!";')
      && main.content.includes('drawable.Rectangle rect;');
  }

  function openProjectDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB недоступен в этом браузере'));
        return;
      }
      const request = window.indexedDB.open(PROJECT_DB_NAME, 1);
      request.addEventListener('upgradeneeded', () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECT_DB_STORE)) db.createObjectStore(PROJECT_DB_STORE);
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error || new Error('IndexedDB open failed')));
    });
  }

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed')));
    });
  }

  function toggleUploadMenu() {
    uploadMenu.hidden ? showUploadMenu() : hideUploadMenu();
  }

  function showUploadMenu() {
    hideThemeMenu();
    hideColorPickerMenu();
    uploadMenu.hidden = false;
    uploadButton.setAttribute('aria-expanded', 'true');
  }

  function hideUploadMenu() {
    uploadMenu.hidden = true;
    uploadButton.setAttribute('aria-expanded', 'false');
    dropArea.classList.remove('drag-over');
  }

  function installDropArea() {
    for (const eventName of ['dragenter', 'dragover']) {
      dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropArea.classList.add('drag-over');
      });
    }
    for (const eventName of ['dragleave', 'drop']) {
      dropArea.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropArea.classList.remove('drag-over');
      });
    }
    dropArea.addEventListener('drop', (event) => {
      loadDroppedFiles(event.dataTransfer && event.dataTransfer.files);
    });
  }

  function handleEditorKeydown(event) {
    if (event.ctrlKey && event.key === 'Enter') {
      runProgram();
      event.preventDefault();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      refreshCompletions(true);
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape' && !completionPopup.hidden) {
      hideCompletions();
      event.preventDefault();
      return;
    }

    if (!completionPopup.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      moveCompletion(event.key === 'ArrowDown' ? 1 : -1);
      event.preventDefault();
      return;
    }

    if (!completionPopup.hidden && (event.key === 'Enter' || event.key === 'Tab')) {
      acceptCompletion();
      event.preventDefault();
      return;
    }

    if (event.key === 'Tab') {
      insertText('    ');
      hideCompletions();
      event.preventDefault();
    }
  }

  function refreshCompletions(manual) {
    if (!currentFile.endsWith('.idyl') || editor.disabled) {
      hideCompletions();
      return;
    }

    const token = completionToken();
    if (!manual && !token.afterDot && token.prefix.length < 2) {
      hideCompletions();
      return;
    }

    let items = [];
    try {
      const project = new window.Idyllium.IdylliumProject({
        entryFile: MAIN_FILE,
        files: textSourceMap(),
      });
      items = project.completions({
        file: currentFile,
        offset: token.requestOffset,
      });
    } catch (_error) {
      hideCompletions();
      return;
    }

    if (token.prefix) {
      const prefix = token.prefix.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().startsWith(prefix));
    }

    completionItems = deduplicateCompletions(items).slice(0, 40);
    completionStart = token.start;
    completionIndex = 0;
    if (completionItems.length === 0) {
      hideCompletions();
      return;
    }
    renderCompletions();
  }

  function completionToken() {
    const offset = editor.selectionStart;
    const prefix = editor.value.slice(0, offset);
    const memberMatch = /([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)\.\s*([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)?$/u.exec(prefix);
    if (memberMatch) {
      const word = memberMatch[2] || '';
      return {
        afterDot: true,
        prefix: word,
        requestOffset: offset - word.length,
        start: offset - word.length,
      };
    }

    const wordMatch = /([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)$/u.exec(prefix);
    const word = wordMatch ? wordMatch[1] : '';
    return {
      afterDot: false,
      prefix: word,
      requestOffset: offset,
      start: offset - word.length,
    };
  }

  function renderCompletions() {
    completionPopup.replaceChildren();
    completionItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'completion-item' + (index === completionIndex ? ' active' : '');
      row.addEventListener('mousedown', (event) => {
        completionIndex = index;
        acceptCompletion();
        event.preventDefault();
      });

      const name = document.createElement('span');
      name.textContent = item.name;
      row.appendChild(name);

      const detail = document.createElement('span');
      detail.className = 'completion-detail';
      detail.textContent = item.detail || item.kind || '';
      row.appendChild(detail);
      completionPopup.appendChild(row);
    });

    const position = cursorPopupPosition();
    completionPopup.style.left = position.left + 'px';
    completionPopup.style.top = position.top + 'px';
    completionPopup.hidden = false;
  }

  function moveCompletion(delta) {
    completionIndex = (completionIndex + delta + completionItems.length) % completionItems.length;
    renderCompletions();
  }

  function acceptCompletion() {
    const item = completionItems[completionIndex];
    if (!item) return;
    const end = editor.selectionStart;
    editor.setRangeText(item.name, completionStart, end, 'end');
    saveCurrentEditor();
    updateEditorVisuals();
    hideCompletions();
  }

  function hideCompletions() {
    completionPopup.hidden = true;
    completionItems = [];
  }

  function cursorPopupPosition() {
    const before = editor.value.slice(0, editor.selectionStart);
    const lines = before.split('\n');
    const line = lines.length - 1;
    const column = Array.from(lines[lines.length - 1]).length;
    return {
      left: Math.max(8, 14 + column * editorCharWidth(editorFontSize) - editor.scrollLeft),
      top: Math.max(8, 14 + (line + 1) * editorLineHeight(editorFontSize) - editor.scrollTop),
    };
  }

  function deduplicateCompletions(items) {
    const byName = new Map();
    for (const item of items) {
      if (!byName.has(item.name)) byName.set(item.name, item);
    }
    return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  function insertText(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(text, start, end, 'end');
    saveCurrentEditor();
    updateEditorVisuals();
  }

  function highlightIdyllium(source) {
    let html = '';
    let index = 0;
    while (index < source.length) {
      const rest = source.slice(index);
      const comment = /^\/\/[^\n]*/u.exec(rest);
      if (comment) {
        html += span('tok-comment', comment[0]);
        index += comment[0].length;
        continue;
      }

      const string = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/u.exec(rest);
      if (string) {
        html += span('tok-string', string[0]);
        index += string[0].length;
        continue;
      }

      const number = /^\b\d+(?:\.\d+)?\b/u.exec(rest);
      if (number) {
        html += span('tok-number', number[0]);
        index += number[0].length;
        continue;
      }

      const member = /^(\.)([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)/u.exec(rest);
      if (member) {
        html += escapeHtml(member[1]) + span('tok-property', member[2]);
        index += member[0].length;
        continue;
      }

      const identifier = /^[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u.exec(rest);
      if (identifier) {
        const word = identifier[0];
        const afterWord = source.slice(index + word.length);
        if (KEYWORDS.has(word)) {
          html += span('tok-keyword', word);
        } else if (BUILTIN_TYPES.has(word) || CLASS_NAMES.has(word) || QUALIFIED_TYPES.has(word) || /^[A-ZА-ЯЁ]/u.test(word)) {
          html += span('tok-type', word);
        } else if (/^\s*\(/u.test(afterWord)) {
          html += span('tok-function', word);
        } else {
          html += escapeHtml(word);
        }
        index += word.length;
        continue;
      }

      html += escapeHtml(source[index]);
      index++;
    }
    return html.endsWith('\n') ? html + ' ' : html;
  }

  function span(className, text) {
    return '<span class="' + className + '">' + escapeHtml(text) + '</span>';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function applySavedTheme() {
    const theme = window.localStorage.getItem('idyllium-web-theme') || 'dark';
    setTheme(theme === 'light' ? 'light' : 'dark');
  }

  function toggleThemeMenu() {
    themeMenu.hidden ? showThemeMenu() : hideThemeMenu();
  }

  function showThemeMenu() {
    hideUploadMenu();
    hideColorPickerMenu();
    themeMenu.hidden = false;
    themeButton.setAttribute('aria-expanded', 'true');
  }

  function hideThemeMenu() {
    themeMenu.hidden = true;
    themeButton.setAttribute('aria-expanded', 'false');
  }

  function installColorPicker() {
    for (const channel of COLOR_PICKER_CHANNELS) {
      colorSliders[channel].addEventListener('input', () => {
        setColorPickerComponent(channel, Number(colorSliders[channel].value));
      });
      colorInputs[channel].addEventListener('change', () => {
        setColorPickerComponent(channel, Number(colorInputs[channel].value));
      });
      colorInputs[channel].addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          setColorPickerComponent(channel, Number(colorInputs[channel].value));
          colorInputs[channel].blur();
          event.preventDefault();
        }
      });
    }

    for (const button of document.querySelectorAll('.color-step-button')) {
      button.addEventListener('click', () => {
        const channel = button.dataset.colorChannel;
        const step = Number(button.dataset.colorStep);
        if (!COLOR_PICKER_CHANNELS.includes(channel) || !Number.isFinite(step)) return;
        setColorPickerComponent(channel, colorPickerState[channel] + step);
      });
    }

    const copyRgbButton = document.getElementById('copy-rgb-button');
    const copyHexButton = document.getElementById('copy-hex-button');
    copyRgbButton.addEventListener('click', () => copyColorText(colorRgbCode.textContent, copyRgbButton));
    copyHexButton.addEventListener('click', () => copyColorText(colorHexCode.textContent, copyHexButton));
  }

  function toggleColorPickerMenu() {
    colorPickerMenu.hidden ? showColorPickerMenu() : hideColorPickerMenu();
  }

  function showColorPickerMenu() {
    hideUploadMenu();
    hideThemeMenu();
    colorPickerMenu.hidden = false;
    colorPickerButton.setAttribute('aria-expanded', 'true');
  }

  function hideColorPickerMenu() {
    colorPickerMenu.hidden = true;
    colorPickerButton.setAttribute('aria-expanded', 'false');
  }

  function setColorPickerComponent(channel, rawValue) {
    if (!Number.isFinite(rawValue)) {
      updateColorPickerUi();
      return;
    }
    colorPickerState = {
      ...colorPickerState,
      [channel]: normalizeColorPickerValue(channel, rawValue),
    };
    updateColorPickerUi();
  }

  function normalizeColorPickerValue(channel, value) {
    if (channel === 'alpha') return Math.round(clamp(value, 0, 1) * 100) / 100;
    return Math.round(clamp(value, 0, 255));
  }

  function updateColorPickerUi() {
    const red = normalizeColorPickerValue('red', colorPickerState.red);
    const green = normalizeColorPickerValue('green', colorPickerState.green);
    const blue = normalizeColorPickerValue('blue', colorPickerState.blue);
    const alpha = normalizeColorPickerValue('alpha', colorPickerState.alpha);
    colorPickerState = { red, green, blue, alpha };

    colorSliders.red.value = String(red);
    colorSliders.green.value = String(green);
    colorSliders.blue.value = String(blue);
    colorSliders.alpha.value = formatAlpha(alpha);
    colorInputs.red.value = String(red);
    colorInputs.green.value = String(green);
    colorInputs.blue.value = String(blue);
    colorInputs.alpha.value = formatAlpha(alpha);

    const rgb = `rgb(${red}, ${green}, ${blue})`;
    const rgba = `rgba(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
    colorPreview.style.setProperty('--preview-rgb', rgb);
    colorPreview.style.setProperty('--preview-rgba', rgba);

    colorRgbCode.textContent = alpha >= 1
      ? `colors.RGB(${red}, ${green}, ${blue})`
      : `colors.RGBA(${red}, ${green}, ${blue}, ${formatAlpha(alpha)})`;
    colorHexCode.textContent = `colors.HEX("${colorPickerHex(red, green, blue, alpha)}")`;
  }

  function colorPickerHex(red, green, blue, alpha) {
    const base = `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
    return alpha >= 1 ? base : base + componentToHex(Math.round(alpha * 255));
  }

  function componentToHex(value) {
    return normalizeColorPickerValue('red', value).toString(16).padStart(2, '0');
  }

  function formatAlpha(value) {
    const rounded = normalizeColorPickerValue('alpha', value);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/u, '').replace(/\.$/u, '');
  }

  async function copyColorText(text, button) {
    const value = String(text || '');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        copyTextFallback(value);
      }
      showColorCopyButtonState(button, 'Скопировано', 'copy-success');
    } catch (_error) {
      showColorCopyButtonState(button, 'Ошибка', 'copy-error');
    }
  }

  function copyTextFallback(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('copy command failed');
  }

  function showColorCopyButtonState(button, text, className) {
    const previousTimer = colorCopyTimers.get(button);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    button.textContent = text;
    button.classList.remove('copy-success', 'copy-error');
    button.classList.add(className);
    const timer = window.setTimeout(() => {
      button.textContent = 'Копировать';
      button.classList.remove('copy-success', 'copy-error');
      colorCopyTimers.delete(button);
    }, 1000);
    colorCopyTimers.set(button, timer);
  }

  function setTheme(theme) {
    const dark = theme !== 'light';
    document.body.classList.toggle('theme-dark', dark);
    document.body.classList.toggle('theme-light', !dark);
    themeDarkButton.classList.toggle('active', dark);
    themeLightButton.classList.toggle('active', !dark);
    window.localStorage.setItem('idyllium-web-theme', dark ? 'dark' : 'light');
    if (monacoReady && window.monaco) window.monaco.editor.setTheme(currentMonacoTheme());
    applyPreviewTheme();
  }

  function applyPreviewTheme() {
    guiFrame.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--preview-bg').trim();
    if (!guiFrame.contentWindow) return;
    guiFrame.contentWindow.postMessage({
      type: 'theme',
      theme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
    }, '*');
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', () => reject(reader.error || new Error('file read failed')));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')));
      reader.addEventListener('error', () => reject(reader.error || new Error('file read failed')));
      reader.readAsText(file, 'utf-8');
    });
  }

  function isEditableTextFile(file) {
    return isEditableTextName(file.name, file.type);
  }

  function isEditableTextName(fileName, mimeType = '') {
    if (mimeType.startsWith('text/')) return true;
    const name = fileName.toLowerCase();
    return name.endsWith('.idyl')
      || name.endsWith('.txt')
      || name.endsWith('.csv')
      || name.endsWith('.json')
      || name.endsWith('.md');
  }

  function unzipStoredEntries(bytes) {
    const entries = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    while (offset + 4 <= bytes.length) {
      const signature = view.getUint32(offset, true);
      if (signature === 0x02014b50 || signature === 0x06054b50) break;
      if (signature !== 0x04034b50) throw new Error('ZIP-архив имеет неподдерживаемый формат');
      if (offset + 30 > bytes.length) throw new Error('ZIP-архив повреждён');

      const flags = view.getUint16(offset + 6, true);
      const method = view.getUint16(offset + 8, true);
      const expectedCrc = view.getUint32(offset + 14, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLength + extraLength;
      const dataEnd = dataStart + compressedSize;

      if ((flags & 0x0008) !== 0) throw new Error('ZIP-архив с data descriptor пока не поддерживается');
      if (method !== 0) throw new Error('Поддерживается только ZIP без сжатия. Скачанный из IDE проект можно импортировать обратно.');
      if (dataEnd > bytes.length) throw new Error('ZIP-архив повреждён');

      const name = new TextDecoder('utf-8').decode(bytes.slice(nameStart, nameStart + nameLength));
      const data = bytes.slice(dataStart, dataEnd);
      if (data.length !== uncompressedSize) throw new Error(`Файл ${name} в ZIP имеет неверный размер`);
      if (crc32(data) !== expectedCrc) throw new Error(`Файл ${name} в ZIP повреждён`);
      entries.push({ name, bytes: data, directory: name.endsWith('/') });

      offset = dataEnd;
    }
    return entries;
  }

  function bytesToDataUrl(fileName, bytes) {
    return bytesToDataUrlWithMime(mimeTypeForFile(fileName), bytes);
  }

  function bytesToDataUrlWithMime(mime, bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.slice(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }

  function mimeTypeForFile(fileName) {
    const name = fileName.toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.svg')) return 'image/svg+xml';
    if (name.endsWith('.ttf')) return 'font/ttf';
    if (name.endsWith('.otf')) return 'font/otf';
    if (name.endsWith('.woff')) return 'font/woff';
    if (name.endsWith('.woff2')) return 'font/woff2';
    return 'application/octet-stream';
  }

  function detectAssetMimeType(fileName, bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return mimeTypeForFile(fileName);
    if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) return 'image/png';
    if (hasBytes(bytes, [0xff, 0xd8, 0xff], 0)) return 'image/jpeg';
    const header6 = asciiBytes(bytes, 0, 6);
    if (header6 === 'GIF87a' || header6 === 'GIF89a') return 'image/gif';
    if (asciiBytes(bytes, 0, 4) === 'RIFF' && asciiBytes(bytes, 8, 4) === 'WEBP') return 'image/webp';
    if (looksLikeSvg(bytes)) return 'image/svg+xml';
    return mimeTypeForFile(fileName);
  }

  function imageAlphaInfo(mime, bytes) {
    if (mime === 'image/jpeg') return 'нет';
    if (mime === 'image/svg+xml') return 'возможно';
    if (mime === 'image/png') return pngAlphaInfo(bytes);
    if (mime === 'image/gif') return gifAlphaInfo(bytes);
    if (mime === 'image/webp') return webpAlphaInfo(bytes);
    if (mime.startsWith('image/')) return 'неизвестно';
    return 'нет';
  }

  function pngAlphaInfo(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 33 || !hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) {
      return 'неизвестно';
    }
    const colorType = bytes[25];
    if (colorType === 4 || colorType === 6) return 'есть';
    return pngHasTransparencyChunk(bytes) ? 'есть' : 'нет';
  }

  function pngHasTransparencyChunk(bytes) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = readUint32(bytes, offset);
      const type = asciiBytes(bytes, offset + 4, 4);
      if (type === 'tRNS') return true;
      if (type === 'IEND') return false;
      offset += 12 + length;
    }
    return false;
  }

  function gifAlphaInfo(bytes) {
    for (let index = 0; index + 5 < bytes.length; index++) {
      if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) {
        if ((bytes[index + 3] & 0x01) === 0x01) return 'есть';
      }
    }
    return 'нет';
  }

  function webpAlphaInfo(bytes) {
    if (asciiBytes(bytes, 0, 4) !== 'RIFF' || asciiBytes(bytes, 8, 4) !== 'WEBP') return 'неизвестно';
    if (asciiBytes(bytes, 12, 4) === 'VP8X' && bytes.length > 20) {
      return (bytes[20] & 0x10) === 0x10 ? 'есть' : 'нет';
    }
    return 'неизвестно';
  }

  function looksLikeSvg(bytes) {
    const sample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart().toLowerCase();
    return sample.startsWith('<svg') || sample.startsWith('<?xml') && sample.includes('<svg');
  }

  function hasBytes(bytes, expected, offset) {
    if (bytes.length < offset + expected.length) return false;
    return expected.every((byte, index) => bytes[offset + index] === byte);
  }

  function asciiBytes(bytes, offset, length) {
    if (bytes.length < offset + length) return '';
    let text = '';
    for (let index = 0; index < length; index++) text += String.fromCharCode(bytes[offset + index]);
    return text;
  }

  function readUint32(bytes, offset) {
    if (bytes.length < offset + 4) return 0;
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  function formatBytes(size) {
    if (!Number.isFinite(size) || size < 0) return 'неизвестно';
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${trimFileSize(size / 1024)} КБ`;
    return `${trimFileSize(size / (1024 * 1024))} МБ`;
  }

  function trimFileSize(value) {
    return value >= 10 ? value.toFixed(1) : value.toFixed(2);
  }

  function dataUrlBytes(value) {
    const comma = value.indexOf(',');
    if (comma < 0) return new Uint8Array();
    const meta = value.slice(0, comma);
    const data = value.slice(comma + 1);
    if (meta.includes(';base64')) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(data));
  }

  function zipHeader(size) {
    return new DataView(new ArrayBuffer(size));
  }

  function dosTime() {
    const now = new Date();
    return {
      time: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
      date: ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
    };
  }

  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
      crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function buildCrc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) {
        value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  function normalizeWorkspacePath(path) {
    const input = String(path).replace(/\\/g, '/');
    const raw = input === WORKSPACE_ROOT
      ? ''
      : input.startsWith(WORKSPACE_ROOT + '/')
        ? input.slice((WORKSPACE_ROOT + '/').length)
      : input.replace(/^\/+/, '');
    const parts = raw.split('/');
    const normalized = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        normalized.pop();
        continue;
      }
      normalized.push(part);
    }
    return normalized.length === 0 ? WORKSPACE_ROOT : WORKSPACE_ROOT + '/' + normalized.join('/');
  }

  function shortFileName(file) {
    const path = normalizeWorkspacePath(file);
    return path === WORKSPACE_ROOT ? '' : path.slice((WORKSPACE_ROOT + '/').length);
  }

  function basename(path) {
    const short = shortFileName(path);
    const parts = short.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'workspace';
  }

  function parentPath(path) {
    path = normalizeWorkspacePath(path);
    if (path === WORKSPACE_ROOT) return WORKSPACE_ROOT;
    const short = shortFileName(path);
    const parts = short.split('/').filter(Boolean);
    parts.pop();
    return parts.length === 0 ? WORKSPACE_ROOT : normalizeWorkspacePath(parts.join('/'));
  }

  function formatThrownError(error) {
    const text = error instanceof Error ? error.message : String(error);
    return formatDiagnosticText(text);
  }

  function formatDiagnosticText(text) {
    return String(text)
      .replaceAll(WORKSPACE_ROOT + '/', '')
      .replace(/(^|\n)([^:\n]+):(\d+):\d+:(?=\s)/gu, '$1$2:$3:');
  }
}());
