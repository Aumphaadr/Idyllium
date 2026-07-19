'use strict';

(function () {
  const WORKSPACE_ROOT = '/workspace';
  const MAIN_FILE = WORKSPACE_ROOT + '/main.idyl';
  const MONACO_LANGUAGE_ID = 'idyllium';
  const DEFAULT_EDITOR_FONT_SIZE = 16;
  const DEFAULT_CONSOLE_FONT_SIZE = 13;
  const MIN_FONT_SIZE = 10;
  const MAX_FONT_SIZE = 32;
  const KEYWORDS = new Set([
    'and', 'break', 'catch', 'class', 'const', 'constructor', 'continue', 'destructor', 'do', 'else', 'extends',
    'false', 'for', 'function', 'if', 'not', 'or', 'parent', 'private', 'public', 'return', 'static',
    'this', 'true', 'null', 'try', 'use', 'while', 'xor',
  ]);
  const BUILTIN_TYPES = new Set([
    'array', 'bool', 'char', 'dyn_array', 'float', 'int', 'set', 'string', 'void',
  ]);
  const CLASS_NAMES = new Set([
    'Array', 'Button', 'Canvas', 'CheckBox', 'Circle', 'Color', 'ComboBox', 'Drawable', 'FloatSpinBox', 'Font', 'Frame',
    'Animation', 'Image', 'ImageBox', 'KeyboardEvent', 'Label', 'Line', 'LineEdit', 'Modal', 'MouseEvent', 'MouseScrollEvent', 'Music',
    'Database', 'Object', 'ProgressBar', 'RadioButton', 'Rectangle', 'Result', 'Slider', 'Sound', 'SpinBox', 'Sprite', 'Statement', 'Text',
    'Static', 'TextEdit', 'Timer', 'Value', 'Widget', 'Window',
  ]);
  const QUALIFIED_TYPES = new Set([
    ...CLASS_NAMES,
    'float32', 'float64', 'int8', 'int16', 'int32', 'int64',
    'istream', 'ostream', 'stamp', 'stream', 'uint8', 'uint16', 'uint32', 'uint64',
  ]);
  const SEMANTIC_TOKEN_TYPES = ['namespace', 'class', 'function', 'method', 'property', 'variable', 'parameter'];
  const SEMANTIC_TOKEN_MODIFIERS = ['declaration', 'readonly', 'static', 'defaultLibrary'];
  const CRC32_TABLE = buildCrc32Table();
  const PROJECT_DB_NAME = 'idyllium-web-ide';
  const PROJECT_DB_STORE = 'project';
  const PROJECT_CATALOG_KEY = 'project-catalog';
  const PROJECT_RECORD_PREFIX = 'project:';
  const PROJECT_STATE_KEY = 'autosave';
  const LAST_PROJECT_STORAGE_KEY = 'idyllium-web-last-project';
  const DEFAULT_PROJECT_NAME = 'Мой проект';
  const AUTOSAVE_DELAY_MS = 450;
  const LAYOUT_STORAGE_KEY = 'idyllium-web-layout';
  const FONT_SIZE_STORAGE_KEY = 'idyllium-web-editor-font-size';
  const CONSOLE_FONT_SIZE_STORAGE_KEY = 'idyllium-web-console-font-size';
  const CSV_ROW_RENDER_LIMIT = 500;
  const CSV_COLUMN_RENDER_LIMIT = 100;
  const JSON_NODE_RENDER_LIMIT = 5000;
  const JSON_DEPTH_RENDER_LIMIT = 64;
  const WEB_IDE_BASE_URL = detectWebIdeBaseUrl();
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
  const pendingGuiEvents = [];
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
  let monacoModelSyncDepth = 0;
  let editorFontSize = readSavedEditorFontSize();
  let consoleFontSize = readSavedConsoleFontSize();
  let runAbortController = null;
  let currentRuntimeFileSnapshot = null;
  let outputSyncTimer = null;
  let runSequence = 0;
  let previewGeneration = 0;
  let pendingConsoleInput = null;
  let consoleInputEchoes = [];
  let lastSnapshotJson = '';
  let lastRenderedRuntimeOutput = null;
  let fileEditState = null;
  let colorPickerState = { red: 34, green: 145, blue: 188, alpha: 1 };
  let currentProjectId = '';
  let currentProjectName = DEFAULT_PROJECT_NAME;
  let projectCatalog = [];
  let projectWriteQueue = Promise.resolve();
  let assetViewerGeneration = 0;
  let assetFontCounter = 0;
  let activeAssetFontFace = null;
  let activeAssetImageCleanup = null;
  let pendingUploadConflictResolve = null;
  const colorCopyTimers = new WeakMap();
  const browserAssetUrls = new Map();
  const structuredViewModes = new Map();
  const csvHeaderModes = new Map();

  const monacoHost = document.getElementById('monaco-editor');
  const assetViewer = document.getElementById('asset-viewer');
  const csvViewer = document.getElementById('csv-viewer');
  const jsonViewer = document.getElementById('json-viewer');
  const markdownViewer = document.getElementById('markdown-viewer');
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
  const structuredViewToggle = document.getElementById('structured-view-toggle');
  const structuredTextViewButton = document.getElementById('structured-text-view-button');
  const structuredDataViewButton = document.getElementById('structured-data-view-button');
  const newFileButton = document.getElementById('new-file-button');
  const newFolderButton = document.getElementById('new-folder-button');
  const fileContextMenu = document.getElementById('file-context-menu');
  const uploadButton = document.getElementById('upload-button');
  const uploadMenu = document.getElementById('upload-menu');
  const dropArea = document.getElementById('drop-area');
  const uploadInput = document.getElementById('upload-input');
  const uploadConflict = document.getElementById('upload-conflict');
  const uploadConflictName = document.getElementById('upload-conflict-name');
  const uploadConflictSkip = document.getElementById('upload-conflict-skip');
  const uploadConflictReplace = document.getElementById('upload-conflict-replace');
  const themeButton = document.getElementById('theme-button');
  const themeMenu = document.getElementById('theme-menu');
  const themeDarkButton = document.getElementById('theme-dark-button');
  const themeLightButton = document.getElementById('theme-light-button');
  const fontSizeDecrease = document.getElementById('font-size-decrease');
  const fontSizeIncrease = document.getElementById('font-size-increase');
  const fontSizeInput = document.getElementById('font-size-input');
  const consoleFontSizeDecrease = document.getElementById('console-font-size-decrease');
  const consoleFontSizeIncrease = document.getElementById('console-font-size-increase');
  const consoleFontSizeInput = document.getElementById('console-font-size-input');
  const colorPickerButton = document.getElementById('color-picker-button');
  const colorPickerMenu = document.getElementById('color-picker-menu');
  const fileAppMenuWrapper = document.getElementById('file-app-menu-wrapper');
  const fileAppMenuButton = document.getElementById('file-app-menu-button');
  const fileAppMenu = document.getElementById('file-app-menu');
  const fileAppMenuMain = document.getElementById('file-app-menu-main');
  const fileAppMenuPanel = document.getElementById('file-app-menu-panel');
  const currentProjectNameElement = document.getElementById('current-project-name');
  const editAppMenuWrapper = document.getElementById('edit-app-menu-wrapper');
  const editAppMenuButton = document.getElementById('edit-app-menu-button');
  const editAppMenu = document.getElementById('edit-app-menu');
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
  applyConsoleFontSize(consoleFontSize, false);
  applySavedLayout();
  updateColorPickerUi();

  runButton.addEventListener('click', runProgram);
  stopButton.addEventListener('click', () => stopProgram(false));
  formatButton.addEventListener('click', formatCurrentFile);
  structuredTextViewButton.addEventListener('click', () => setStructuredViewMode('text'));
  structuredDataViewButton.addEventListener('click', () => setStructuredViewMode('structured'));
  newFileButton.addEventListener('click', () => startCreateItemInline('file', WORKSPACE_ROOT));
  newFolderButton.addEventListener('click', () => startCreateItemInline('folder', WORKSPACE_ROOT));
  document.getElementById('download-project-button').addEventListener('click', downloadProject);
  uploadButton.addEventListener('click', toggleUploadMenu);
  dropArea.addEventListener('click', () => uploadInput.click());
  uploadConflictSkip.addEventListener('click', () => resolveUploadConflict(false));
  uploadConflictReplace.addEventListener('click', () => resolveUploadConflict(true));
  fileList.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest('.file-row')) return;
    event.preventDefault();
    openFileContextMenu({ type: 'folder', name: 'workspace', path: WORKSPACE_ROOT, children: [] }, event.clientX, event.clientY);
  });
  themeButton.addEventListener('click', toggleThemeMenu);
  fileAppMenuButton.addEventListener('click', toggleFileAppMenu);
  editAppMenuButton.addEventListener('click', toggleEditAppMenu);
  fileAppMenu.addEventListener('click', handleFileAppMenuClick);
  editAppMenu.addEventListener('click', handleEditAppMenuClick);
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
  consoleFontSizeDecrease.addEventListener('click', () => applyConsoleFontSize(consoleFontSize - 1));
  consoleFontSizeIncrease.addEventListener('click', () => applyConsoleFontSize(consoleFontSize + 1));
  consoleFontSizeInput.addEventListener('change', () => applyConsoleFontSize(Number(consoleFontSizeInput.value)));
  consoleFontSizeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      applyConsoleFontSize(Number(consoleFontSizeInput.value));
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
    if (!fileAppMenu.hidden && event.target instanceof Element && !event.target.closest('#file-app-menu-wrapper')) hideFileAppMenu();
    if (!editAppMenu.hidden && event.target instanceof Element && !event.target.closest('#edit-app-menu-wrapper')) hideEditAppMenu();
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
      hideFileAppMenu();
      hideEditAppMenu();
      hideUploadMenu();
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      forceSaveCurrentProject();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      hideFileAppMenu();
      startCreateItemInline('file', WORKSPACE_ROOT);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      hideFileAppMenu();
      uploadInput.click();
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
  guiFrame.addEventListener('load', markGuiFrameReady);

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'idylliumGuiEvent' || !data.message) return;
    if (data.message.type === 'rendererReady') {
      markGuiFrameReady();
      return;
    }
    if (data.message.type === 'closeApp') {
      stopProgram(false);
      return;
    }
    if (data.message.type !== 'guiEvent') return;
    enqueueGuiEvent(data.message).catch((error) => {
      setStatus('Ошибка события GUI', true);
      appendOutput(formatThrownError(error), 'output-error');
    });
  });
  window.addEventListener('beforeunload', revokeAllBrowserAssetUrls);

  // The iframe can finish loading while the larger compiler bundle is still
  // being evaluated, before this script has installed its load listener.
  try {
    if (guiFrame.contentDocument?.readyState === 'complete') markGuiFrameReady();
  } catch {
    // rendererReady remains the fallback if the preview ever becomes cross-origin.
  }

  initializeMonaco().finally(initializeIde);

  function markGuiFrameReady() {
    guiFrameReady = true;
    lastSnapshotJson = '';
    applyPreviewTheme();
    if (pendingSnapshot) postSnapshot(pendingSnapshot);
  }

  async function initializeMonaco() {
    await prepareMonacoFont();
    return new Promise((resolve) => {
      if (!window.require || !monacoHost) {
        enableLegacyEditor();
        resolve(false);
        return;
      }

      window.require.config({ paths: { vs: monacoBasePath() } });
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
          'semanticHighlighting.enabled': true,
          smoothScrolling: true,
          suggestOnTriggerCharacters: true,
          suggest: { showWords: false },
          tabSize: 4,
          wordBasedSuggestions: 'off',
        });
        monacoEditor.onDidChangeModelContent(() => {
          if (monacoModelSyncDepth === 0) saveCurrentEditor();
          scheduleMonacoDiagnostics();
        });
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, runProgram);
        monacoEditor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Space, () => {
          monacoEditor.trigger('keyboard', 'editor.action.triggerSuggest', {});
        });
        legacyEditor.hidden = true;
        monacoReady = true;
        refreshMonacoFontMetrics();
        if (document.fonts?.ready) {
          document.fonts.ready
            .then(refreshMonacoFontMetrics)
            .catch(() => {});
        }
        resolve(true);
      }, () => {
        enableLegacyEditor();
        resolve(false);
      });
    });
  }

  async function prepareMonacoFont() {
    if (!document.fonts || typeof document.fonts.load !== 'function') return;
    try {
      await Promise.race([
        document.fonts.load(`400 ${editorFontSize}px "Source Code Pro"`),
        new Promise((resolve) => window.setTimeout(resolve, 2000)),
      ]);
    } catch {
      // Monaco still has a platform monospace fallback when the webfont fails.
    }
  }

  function monacoBasePath() {
    return new URL('monaco/vs', WEB_IDE_BASE_URL).toString().replace(/\/$/u, '');
  }

  function detectWebIdeBaseUrl() {
    const currentScript = document.currentScript;
    if (currentScript && typeof currentScript.src === 'string' && currentScript.src) {
      return new URL('.', currentScript.src).toString();
    }

    const appScript = document.querySelector('script[src$="app.js"]');
    if (appScript && typeof appScript.src === 'string' && appScript.src) {
      return new URL('.', appScript.src).toString();
    }

    const url = new URL(window.location.href);
    if (!url.pathname.endsWith('/')) {
      if (/\.[^/]+$/u.test(url.pathname)) {
        url.pathname = url.pathname.replace(/[^/]*$/u, '');
      } else {
        url.pathname += '/';
      }
    }
    return url.toString();
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
          model.uri.path || currentFile,
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

  function hasOpenCallableFrame(source) {
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

  function calleeTextBeforeOffset(source, openParenIndex) {
    const fragment = source.slice(Math.max(0, openParenIndex - 160), openParenIndex);
    const match = /((?:[\p{L}_][\p{L}\p{N}_]*\s*\.\s*)?[\p{L}_][\p{L}\p{N}_]*)\s*$/u.exec(fragment);
    if (!match) return null;

    const text = match[1].trim();
    return ['if', 'while', 'for', 'function', 'main', 'constructor'].includes(text) ? null : text;
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

  function projectSignatureHelp(file, source, offset) {
    try {
      const normalized = normalizeWorkspacePath(file || currentFile);
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

  function projectSemanticTokens(file, source) {
    try {
      const normalized = normalizeWorkspacePath(file || currentFile);
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

  function encodeMonacoSemanticTokens(tokens) {
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

  function monacoCompletionKind(kind) {
    const monaco = window.monaco;
    if (kind === 'module') return monaco.languages.CompletionItemKind.Module;
    if (kind === 'function') return monaco.languages.CompletionItemKind.Function;
    if (kind === 'method') return monaco.languages.CompletionItemKind.Method;
    if (kind === 'constant') return monaco.languages.CompletionItemKind.Constant;
    if (kind === 'type') return monaco.languages.CompletionItemKind.Class;
    if (kind === 'property') return monaco.languages.CompletionItemKind.Property;
    if (kind === 'parameter') return monaco.languages.CompletionItemKind.Variable;
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

  function readSavedConsoleFontSize() {
    const raw = window.localStorage.getItem(CONSOLE_FONT_SIZE_STORAGE_KEY);
    if (raw === null) return DEFAULT_CONSOLE_FONT_SIZE;
    const saved = Number(raw);
    return normalizeConsoleFontSize(Number.isFinite(saved) ? saved : DEFAULT_CONSOLE_FONT_SIZE);
  }

  function normalizeEditorFontSize(value) {
    return normalizeFontSize(value, DEFAULT_EDITOR_FONT_SIZE);
  }

  function normalizeConsoleFontSize(value) {
    return normalizeFontSize(value, DEFAULT_CONSOLE_FONT_SIZE);
  }

  function normalizeFontSize(value, fallback) {
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return fallback;
    return clamp(rounded, MIN_FONT_SIZE, MAX_FONT_SIZE);
  }

  function editorLineHeight(fontSize) {
    return Math.max(18, Math.round(fontSize * 1.55));
  }

  function editorCharWidth(fontSize) {
    return fontSize * 0.61;
  }

  function consoleLineHeight(fontSize) {
    return Math.max(15, Math.round(fontSize * 1.45));
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
      refreshMonacoFontMetrics();
    }
    updateEditorVisuals();
  }

  function applyConsoleFontSize(value, persist = true) {
    consoleFontSize = normalizeConsoleFontSize(value);
    const lineHeight = consoleLineHeight(consoleFontSize);
    document.documentElement.style.setProperty('--console-font-size', `${consoleFontSize}px`);
    document.documentElement.style.setProperty('--console-line-height', `${lineHeight}px`);
    document.documentElement.style.setProperty('--console-control-height', `${Math.max(32, lineHeight + 13)}px`);
    consoleFontSizeInput.value = String(consoleFontSize);
    if (persist) window.localStorage.setItem(CONSOLE_FONT_SIZE_STORAGE_KEY, String(consoleFontSize));
  }

  function refreshMonacoFontMetrics() {
    if (!monacoReady || !monacoEditor || !window.monaco) return;
    window.monaco.editor.remeasureFonts?.();
    monacoEditor.layout();
    if (typeof monacoEditor.render === 'function') monacoEditor.render(true);
  }

  async function initializeIde() {
    try {
      const saved = await initializeProjectStorage();
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
    updateCurrentProjectUi();
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
      if (isCsvFile(file) && structuredViewModes.get(file) === 'table') {
        showCsvTable(file, item.content || '');
      } else if (isJsonFile(file) && structuredViewModes.get(file) === 'tree') {
        showJsonTree(file, item.content || '');
      } else if (isMarkdownFile(file) && structuredViewModes.get(file) === 'preview') {
        showMarkdownPreview(file, item.content || '');
      }
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
    updateStructuredViewToggle();
    renderFiles();
    scheduleAutosave();
  }

  function showTextEditor() {
    assetViewerGeneration++;
    releaseAssetViewerResources();
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
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

  function isCsvFile(file) {
    return /\.csv$/iu.test(file);
  }

  function isJsonFile(file) {
    return /\.json$/iu.test(file);
  }

  function isMarkdownFile(file) {
    return /\.(?:md|markdown)$/iu.test(file);
  }

  function structuredViewMode(file) {
    if (isCsvFile(file)) return 'table';
    if (isJsonFile(file)) return 'tree';
    if (isMarkdownFile(file)) return 'preview';
    return '';
  }

  function setStructuredViewMode(mode) {
    const item = files.get(currentFile);
    const structuredMode = structuredViewMode(currentFile);
    if (!item || item.kind !== 'text' || !structuredMode) return;

    if (mode === 'structured') {
      saveCurrentEditor();
      structuredViewModes.set(currentFile, structuredMode);
      if (structuredMode === 'table') showCsvTable(currentFile, item.content || '');
      else if (structuredMode === 'tree') showJsonTree(currentFile, item.content || '');
      else showMarkdownPreview(currentFile, item.content || '');
    } else {
      structuredViewModes.set(currentFile, 'text');
      showTextEditor();
      setEditorReadOnly(false);
      window.setTimeout(() => monacoEditor?.focus(), 0);
    }

    updateStructuredViewToggle();
  }

  function updateStructuredViewToggle() {
    if (!structuredViewToggle || !structuredTextViewButton || !structuredDataViewButton) return;
    const item = files.get(currentFile);
    const structuredMode = structuredViewMode(currentFile);
    const available = Boolean(item && item.kind === 'text' && structuredMode);
    const mode = available ? structuredViewModes.get(currentFile) || 'text' : 'text';
    const formatName = isCsvFile(currentFile) ? 'CSV' : isJsonFile(currentFile) ? 'JSON' : 'Markdown';

    structuredViewToggle.hidden = !available;
    structuredViewToggle.setAttribute('aria-label', `Режим просмотра ${formatName}`);
    structuredDataViewButton.textContent = structuredMode === 'table'
      ? 'Таблица'
      : structuredMode === 'tree'
        ? 'Дерево'
        : 'Просмотр';
    structuredTextViewButton.classList.toggle('active', mode === 'text');
    structuredDataViewButton.classList.toggle('active', mode === structuredMode);
    structuredTextViewButton.setAttribute('aria-pressed', String(mode === 'text'));
    structuredDataViewButton.setAttribute('aria-pressed', String(mode === structuredMode));
  }

  function showCsvTable(file, source) {
    assetViewerGeneration++;
    releaseAssetViewerResources();
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (!csvViewer) return;

    csvViewer.hidden = false;
    csvViewer.replaceChildren();
    renderCsvTable(file, source);
  }

  function renderCsvTable(file, source) {
    if (!csvViewer) return;
    if (!window.Papa || typeof window.Papa.parse !== 'function') {
      const unavailable = document.createElement('div');
      unavailable.className = 'csv-empty';
      unavailable.textContent = 'Не удалось загрузить модуль просмотра CSV';
      csvViewer.appendChild(unavailable);
      return;
    }

    const result = window.Papa.parse(source, {
      delimiter: '',
      newline: '',
      quoteChar: '"',
      escapeChar: '"',
      header: false,
      dynamicTyping: false,
      skipEmptyLines: false,
    });
    const rows = source.length === 0
      ? []
      : result.data.map((row) => (Array.isArray(row) ? row : [row]).map((value) => String(value ?? '')));

    if (/\r?\n$/u.test(source) && rows.length > 0 && rows.at(-1).every((value) => value === '')) {
      rows.pop();
    }

    let columnCount = 0;
    for (const row of rows) columnCount = Math.max(columnCount, row.length);
    const firstRowIsHeader = csvHeaderModes.get(file) ?? true;
    const dataRowCount = Math.max(0, rows.length - (firstRowIsHeader ? 1 : 0));
    const messages = csvMessages(result.errors || [], rows, columnCount);
    if (dataRowCount > CSV_ROW_RENDER_LIMIT) {
      messages.push({
        text: `Показаны первые ${CSV_ROW_RENDER_LIMIT} строк данных из ${dataRowCount}`,
        error: false,
      });
    }
    if (columnCount > CSV_COLUMN_RENDER_LIMIT) {
      messages.push({
        text: `Показаны первые ${CSV_COLUMN_RENDER_LIMIT} столбцов из ${columnCount}`,
        error: false,
      });
    }

    csvViewer.appendChild(createCsvToolbar(file, source, rows.length, columnCount, result.meta?.delimiter || '', firstRowIsHeader));
    if (messages.length > 0) csvViewer.appendChild(createCsvMessages(messages));

    if (rows.length === 0 || columnCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'csv-empty';
      empty.textContent = 'CSV-файл пуст';
      csvViewer.appendChild(empty);
      return;
    }

    csvViewer.appendChild(createCsvTable(rows, columnCount, firstRowIsHeader));
  }

  function createCsvToolbar(file, source, rowCount, columnCount, delimiter, firstRowIsHeader) {
    const toolbar = document.createElement('div');
    toolbar.className = 'csv-toolbar';

    const summary = document.createElement('div');
    summary.className = 'csv-summary';
    summary.textContent = `Строк: ${rowCount} · столбцов: ${columnCount} · разделитель: ${formatCsvDelimiter(delimiter)}`;
    toolbar.appendChild(summary);

    const option = document.createElement('label');
    option.className = 'csv-header-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = firstRowIsHeader;
    checkbox.disabled = rowCount === 0;
    checkbox.addEventListener('change', () => {
      csvHeaderModes.set(file, checkbox.checked);
      csvViewer.replaceChildren();
      renderCsvTable(file, source);
    });
    option.appendChild(checkbox);
    option.append('Первая строка — заголовки');
    toolbar.appendChild(option);
    return toolbar;
  }

  function createCsvMessages(messages) {
    const container = document.createElement('div');
    container.className = 'csv-messages';
    for (const message of messages.slice(0, 6)) {
      const item = document.createElement('p');
      item.className = 'csv-message' + (message.error ? ' csv-message-error' : '');
      item.textContent = message.text;
      container.appendChild(item);
    }
    if (messages.length > 6) {
      const rest = document.createElement('p');
      rest.className = 'csv-message';
      rest.textContent = `И ещё предупреждений: ${messages.length - 6}`;
      container.appendChild(rest);
    }
    return container;
  }

  function csvMessages(errors, rows, columnCount) {
    const messages = [];
    for (const error of errors) {
      if (error.code === 'UndetectableDelimiter' && columnCount <= 1) continue;
      messages.push({ text: formatCsvError(error), error: error.type === 'Quotes' });
    }

    const irregularRows = [];
    for (let index = 0; index < rows.length; index++) {
      if (rows[index].length !== columnCount) irregularRows.push(index + 1);
    }
    if (irregularRows.length > 0) {
      const shown = irregularRows.slice(0, 8).join(', ');
      const rest = irregularRows.length > 8 ? ` и ещё ${irregularRows.length - 8}` : '';
      messages.push({
        text: `В строках разное количество столбцов. Проверь строки: ${shown}${rest}`,
        error: false,
      });
    }
    return messages;
  }

  function formatCsvError(error) {
    const row = Number.isInteger(error.row) ? `Строка ${error.row + 1}: ` : '';
    const descriptions = {
      MissingQuotes: 'не закрыта двойная кавычка',
      InvalidQuotes: 'кавычка расположена неправильно',
      TooFewFields: 'слишком мало значений',
      TooManyFields: 'слишком много значений',
      UndetectableDelimiter: 'не удалось уверенно определить разделитель',
    };
    return row + (descriptions[error.code] || `ошибка CSV (${error.code || error.type || 'неизвестная'})`);
  }

  function formatCsvDelimiter(delimiter) {
    const names = {
      ',': 'запятая (,)',
      ';': 'точка с запятой (;)',
      '\t': 'табуляция',
      '|': 'вертикальная черта (|)',
    };
    return names[delimiter] || (delimiter ? `«${delimiter}»` : 'не определён');
  }

  function createCsvTable(rows, columnCount, firstRowIsHeader) {
    const scroll = document.createElement('div');
    scroll.className = 'csv-table-scroll';
    const table = document.createElement('table');
    table.className = 'csv-table';
    const renderedColumnCount = Math.min(columnCount, CSV_COLUMN_RENDER_LIMIT);

    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    appendCsvCell(headerRow, '#', 'th', 'csv-row-number');
    for (let column = 0; column < renderedColumnCount; column++) {
      const value = firstRowIsHeader ? rows[0]?.[column] || `Столбец ${column + 1}` : `Столбец ${column + 1}`;
      appendCsvCell(headerRow, value, 'th');
    }
    head.appendChild(headerRow);
    table.appendChild(head);

    const body = document.createElement('tbody');
    const firstDataIndex = firstRowIsHeader ? 1 : 0;
    const lastDataIndex = Math.min(rows.length, firstDataIndex + CSV_ROW_RENDER_LIMIT);
    for (let rowIndex = firstDataIndex; rowIndex < lastDataIndex; rowIndex++) {
      const rowElement = document.createElement('tr');
      appendCsvCell(rowElement, String(rowIndex - firstDataIndex + 1), 'th', 'csv-row-number');
      for (let column = 0; column < renderedColumnCount; column++) {
        appendCsvCell(rowElement, rows[rowIndex][column] || '', 'td');
      }
      body.appendChild(rowElement);
    }
    table.appendChild(body);
    scroll.appendChild(table);
    return scroll;
  }

  function appendCsvCell(row, value, tagName, className = '') {
    const cell = document.createElement(tagName);
    if (className) cell.className = className;
    if (tagName === 'th') cell.scope = className === 'csv-row-number' ? 'row' : 'col';
    cell.textContent = value;
    if (value.length > 120) cell.title = value.slice(0, 1000);
    row.appendChild(cell);
  }

  function showJsonTree(file, source) {
    assetViewerGeneration++;
    releaseAssetViewerResources();
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (!jsonViewer) return;

    jsonViewer.hidden = false;
    jsonViewer.replaceChildren();
    renderJsonTree(file, source);
  }

  function renderJsonTree(file, source) {
    if (!jsonViewer) return;
    if (source.trim().length === 0) {
      const empty = document.createElement('div');
      empty.className = 'json-empty';
      empty.textContent = 'JSON-файл пуст';
      jsonViewer.appendChild(empty);
      return;
    }

    let value;
    try {
      value = JSON.parse(source);
    } catch (error) {
      jsonViewer.appendChild(createJsonError(source, error));
      return;
    }

    const state = {
      count: 0,
      compositeCount: 0,
      truncated: false,
      limitMarkerCreated: false,
      depthTruncated: false,
    };
    const tree = document.createElement('div');
    tree.className = 'json-tree';
    tree.appendChild(createJsonNode(value, 'Корень', 'root', 0, state));

    jsonViewer.appendChild(createJsonToolbar(value, state));
    if (state.truncated || state.depthTruncated) {
      const warning = document.createElement('p');
      warning.className = 'json-render-warning';
      warning.textContent = state.truncated
        ? `Показаны первые ${JSON_NODE_RENDER_LIMIT} узлов. Полный JSON остаётся доступен в текстовом режиме.`
        : `Вложенность глубже ${JSON_DEPTH_RENDER_LIMIT} уровней скрыта. Полный JSON остаётся доступен в текстовом режиме.`;
      jsonViewer.appendChild(warning);
    }

    const scroll = document.createElement('div');
    scroll.className = 'json-tree-scroll';
    scroll.appendChild(tree);
    jsonViewer.appendChild(scroll);
  }

  function showMarkdownPreview(file, source) {
    assetViewerGeneration++;
    releaseAssetViewerResources();
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (assetViewer) {
      assetViewer.hidden = true;
      assetViewer.replaceChildren();
    }
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (!markdownViewer) return;

    markdownViewer.hidden = false;
    markdownViewer.replaceChildren();
    renderMarkdownPreview(file, source);
  }

  function renderMarkdownPreview(file, source) {
    if (!markdownViewer) return;
    if (!window.marked || typeof window.marked.parse !== 'function'
      || !window.DOMPurify || typeof window.DOMPurify.sanitize !== 'function') {
      appendMarkdownMessage('Не удалось загрузить модуль просмотра Markdown');
      return;
    }
    if (source.trim().length === 0) {
      appendMarkdownMessage('Markdown-файл пуст');
      return;
    }

    let rendered;
    try {
      rendered = window.marked.parse(source.replace(/^[\u200B-\u200F\uFEFF]/u, ''), {
        async: false,
        breaks: false,
        gfm: true,
      });
    } catch (error) {
      appendMarkdownMessage(`Markdown не удалось разобрать: ${error instanceof Error ? error.message : String(error)}`, true);
      return;
    }

    const documentElement = document.createElement('article');
    documentElement.className = 'markdown-document';
    documentElement.innerHTML = window.DOMPurify.sanitize(String(rendered), {
      FORBID_ATTR: ['style'],
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
      SANITIZE_NAMED_PROPS: true,
      USE_PROFILES: { html: true },
    });
    prepareMarkdownLinks(documentElement, file);
    prepareMarkdownImages(documentElement, file);
    markdownViewer.appendChild(documentElement);
  }

  function appendMarkdownMessage(message, error = false) {
    const element = document.createElement('div');
    element.className = `markdown-empty${error ? ' markdown-error' : ''}`;
    element.textContent = message;
    markdownViewer.appendChild(element);
  }

  function prepareMarkdownLinks(documentElement, file) {
    for (const link of documentElement.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href') || '';
      if (/^(?:https?:|mailto:)/iu.test(href)) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        continue;
      }
      if (href.startsWith('#')) continue;
      const target = markdownWorkspaceTarget(file, href);
      if (!target || !files.has(target)) {
        link.addEventListener('click', (event) => event.preventDefault());
        link.title = 'Файл не найден в текущем проекте';
        continue;
      }
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openFile(target);
      });
    }
  }

  function prepareMarkdownImages(documentElement, file) {
    for (const image of documentElement.querySelectorAll('img[src]')) {
      const source = image.getAttribute('src') || '';
      if (/^(?:https?:|data:|blob:)/iu.test(source)) continue;
      const target = markdownWorkspaceTarget(file, source);
      const item = target ? files.get(target) : null;
      if (!item || item.kind !== 'asset') continue;
      const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
      image.src = bytes.length > 0 ? bytesToDataUrl(target, bytes) : item.resourceUri || source;
    }
  }

  function markdownWorkspaceTarget(file, reference) {
    const pathOnly = String(reference).split(/[?#]/u, 1)[0];
    if (!pathOnly) return '';
    let decoded;
    try {
      decoded = decodeURIComponent(pathOnly);
    } catch {
      decoded = pathOnly;
    }
    if (decoded.startsWith('/')) return normalizeWorkspacePath(decoded);
    const parent = shortFileName(parentPath(file));
    return normalizeWorkspacePath(parent ? `${parent}/${decoded}` : decoded);
  }

  function createJsonToolbar(value, state) {
    const toolbar = document.createElement('div');
    toolbar.className = 'json-toolbar';

    const summary = document.createElement('div');
    summary.className = 'json-summary';
    summary.textContent = `${describeJsonRoot(value)} · показано узлов: ${state.count}`;
    toolbar.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'json-toolbar-actions';
    const expand = createJsonToolbarButton('Развернуть всё', () => {
      for (const details of jsonViewer.querySelectorAll('details')) details.open = true;
    });
    const collapse = createJsonToolbarButton('Свернуть всё', () => {
      for (const details of jsonViewer.querySelectorAll('details')) details.open = false;
    });
    expand.disabled = state.compositeCount === 0;
    collapse.disabled = state.compositeCount === 0;
    actions.append(expand, collapse);
    toolbar.appendChild(actions);
    return toolbar;
  }

  function createJsonToolbarButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'json-toolbar-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function createJsonNode(value, label, labelKind, depth, state) {
    state.count++;
    const node = document.createElement('div');
    node.className = 'json-node';
    const composite = value !== null && typeof value === 'object';

    if (!composite) {
      const line = document.createElement('div');
      line.className = 'json-node-line json-leaf';
      appendJsonLabel(line, label, labelKind);
      appendJsonPrimitive(line, value);
      node.appendChild(line);
      return node;
    }

    const keys = Array.isArray(value) ? value.map((_, index) => index) : Object.keys(value);
    const collectionKind = Array.isArray(value) ? 'array' : 'object';
    if (keys.length === 0 || depth >= JSON_DEPTH_RENDER_LIMIT) {
      const line = document.createElement('div');
      line.className = 'json-node-line json-leaf';
      appendJsonLabel(line, label, labelKind);
      appendJsonCollectionPreview(line, collectionKind, keys.length);
      if (depth >= JSON_DEPTH_RENDER_LIMIT && keys.length > 0) {
        state.depthTruncated = true;
        const hidden = document.createElement('span');
        hidden.className = 'json-meta';
        hidden.textContent = ' вложенность скрыта';
        line.appendChild(hidden);
      }
      node.appendChild(line);
      return node;
    }

    state.compositeCount++;
    const details = document.createElement('details');
    details.className = 'json-composite';
    details.open = depth === 0;
    const summary = document.createElement('summary');
    summary.className = 'json-node-line';
    appendJsonLabel(summary, label, labelKind);
    appendJsonCollectionPreview(summary, collectionKind, keys.length);
    details.appendChild(summary);

    const children = document.createElement('div');
    children.className = 'json-children';
    for (const key of keys) {
      if (state.count >= JSON_NODE_RENDER_LIMIT) {
        state.truncated = true;
        if (!state.limitMarkerCreated) {
          state.limitMarkerCreated = true;
          children.appendChild(createJsonLimitMarker());
        }
        break;
      }
      const child = Array.isArray(value)
        ? createJsonNode(value[key], `[${key}]`, 'index', depth + 1, state)
        : createJsonNode(value[key], key, 'key', depth + 1, state);
      children.appendChild(child);
    }
    details.appendChild(children);
    node.appendChild(details);
    return node;
  }

  function appendJsonLabel(parent, label, kind) {
    const key = document.createElement('span');
    key.className = kind === 'root' ? 'json-root-label' : kind === 'index' ? 'json-index' : 'json-key';
    key.textContent = kind === 'key' ? JSON.stringify(label) : label;
    parent.appendChild(key);

    const separator = document.createElement('span');
    separator.className = 'json-punctuation';
    separator.textContent = ': ';
    parent.appendChild(separator);
  }

  function appendJsonPrimitive(parent, value) {
    const type = value === null ? 'null' : typeof value;
    const rendered = type === 'string' ? JSON.stringify(value) : String(value);
    const token = document.createElement('span');
    token.className = `json-value json-value-${type}`;
    token.textContent = rendered;
    parent.appendChild(token);
  }

  function appendJsonCollectionPreview(parent, kind, count) {
    const punctuation = document.createElement('span');
    punctuation.className = 'json-punctuation';
    punctuation.textContent = kind === 'array'
      ? count === 0 ? '[]' : '[…]'
      : count === 0 ? '{}' : '{…}';
    parent.appendChild(punctuation);

    const meta = document.createElement('span');
    meta.className = 'json-meta';
    meta.textContent = kind === 'array'
      ? ` ${formatRussianCount(count, ['элемент', 'элемента', 'элементов'])}`
      : ` ${formatRussianCount(count, ['поле', 'поля', 'полей'])}`;
    parent.appendChild(meta);
  }

  function createJsonLimitMarker() {
    const marker = document.createElement('div');
    marker.className = 'json-node-line json-limit-marker';
    marker.textContent = 'Остальные узлы скрыты';
    return marker;
  }

  function describeJsonRoot(value) {
    if (Array.isArray(value)) {
      return `Корень: массив · ${formatRussianCount(value.length, ['элемент', 'элемента', 'элементов'])}`;
    }
    if (value !== null && typeof value === 'object') {
      return `Корень: объект · ${formatRussianCount(Object.keys(value).length, ['поле', 'поля', 'полей'])}`;
    }
    const names = {
      string: 'строка',
      number: 'число',
      boolean: 'логическое значение',
      null: 'null',
    };
    const type = value === null ? 'null' : typeof value;
    return `Корень: ${names[type] || type}`;
  }

  function formatRussianCount(count, forms) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
    return `${count} ${form}`;
  }

  function createJsonError(source, error) {
    const location = jsonErrorLocation(source, error);
    const card = document.createElement('div');
    card.className = 'json-error';

    const title = document.createElement('strong');
    title.textContent = 'JSON не удалось разобрать';
    card.appendChild(title);

    const description = document.createElement('p');
    description.textContent = `${location.label}${describeJsonSyntaxError(error)}`;
    card.appendChild(description);

    if (location.lineText !== '') {
      const snippet = document.createElement('pre');
      snippet.className = 'json-error-snippet';
      snippet.textContent = `${location.lineText}\n${' '.repeat(Math.max(0, location.column - 1))}^`;
      card.appendChild(snippet);
    }

    const hint = document.createElement('p');
    hint.className = 'json-error-hint';
    hint.textContent = 'Вернитесь в режим «Текст», исправьте JSON и откройте дерево снова.';
    card.appendChild(hint);
    return card;
  }

  function jsonErrorLocation(source, error) {
    const message = String(error?.message || '');
    const lineColumn = message.match(/line\s+(\d+)\s+column\s+(\d+)/iu);
    if (lineColumn) {
      const line = Number(lineColumn[1]);
      const column = Number(lineColumn[2]);
      return {
        line,
        column,
        lineText: source.split(/\r\n|\r|\n/u)[line - 1] || '',
        label: `Строка ${line}, столбец ${column}: `,
      };
    }

    const positionMatch = message.match(/position\s+(\d+)/iu);
    const position = positionMatch ? Number(positionMatch[1]) : source.length;
    const before = source.slice(0, position);
    const lines = before.split(/\r\n|\r|\n/u);
    const line = lines.length;
    const column = (lines.at(-1)?.length || 0) + 1;
    return {
      line,
      column,
      lineText: source.split(/\r\n|\r|\n/u)[line - 1] || '',
      label: `Строка ${line}, столбец ${column}: `,
    };
  }

  function describeJsonSyntaxError(error) {
    const message = String(error?.message || '');
    if (/unterminated string/iu.test(message)) return 'не закрыта двойная кавычка.';
    if (/end of JSON|unexpected end/iu.test(message)) return 'JSON неожиданно закончился. Проверьте закрывающие скобки и значения.';
    if (/property name|double-quoted/iu.test(message)) return 'ключ объекта должен находиться в двойных кавычках.';
    if (/expected ['"]?,['"]?|after property value|after array element/iu.test(message)) return 'между соседними значениями, полями или элементами нужна запятая.';
    if (/non-whitespace character after JSON|after JSON data/iu.test(message)) return 'после завершённого JSON обнаружены лишние символы.';
    return 'нарушен синтаксис JSON. Проверьте кавычки, запятые и скобки.';
  }

  function showAssetViewer(file, item) {
    if (monacoHost) monacoHost.hidden = true;
    if (legacyEditor) legacyEditor.hidden = true;
    if (csvViewer) {
      csvViewer.hidden = true;
      csvViewer.replaceChildren();
    }
    if (jsonViewer) {
      jsonViewer.hidden = true;
      jsonViewer.replaceChildren();
    }
    if (markdownViewer) {
      markdownViewer.hidden = true;
      markdownViewer.replaceChildren();
    }
    if (!assetViewer) return;

    assetViewer.hidden = false;
    assetViewer.replaceChildren();
    releaseAssetViewerResources();
    const generation = ++assetViewerGeneration;

    const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
    const detectedMime = detectAssetMimeType(file, bytes);
    const extensionMime = mimeTypeForFile(file);
    const isImage = detectedMime.startsWith('image/');
    const isAudio = detectedMime.startsWith('audio/');
    const isFont = detectedMime.startsWith('font/');
    const isSqlite = detectedMime === 'application/vnd.sqlite3';
    const alpha = isImage ? imageAlphaInfo(detectedMime, bytes) : 'нет';

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
    if (isSqlite) {
      addAssetDetail(details, 'Объекты', 'загрузка...');
      addAssetDetail(details, 'Версия схемы', 'загрузка...');
      addAssetDetail(details, 'Размер страницы', 'загрузка...');
      addAssetDetail(details, 'Страниц', 'загрузка...');
    } else if (isAudio) {
      addAssetDetail(details, 'Длительность', 'загрузка...');
    } else if (isFont) {
      addAssetDetail(details, 'Формат', fontFormatName(detectedMime));
      addAssetDetail(details, 'Состояние', 'загрузка...');
      addAssetDetail(details, 'Проверка символов', 'визуальная');
    } else {
      addAssetDetail(details, 'Ширина', isImage ? 'загрузка...' : 'нет');
      addAssetDetail(details, 'Высота', isImage ? 'загрузка...' : 'нет');
      addAssetDetail(details, 'Альфа-канал', alpha);
    }

    if (extensionMime !== detectedMime && detectedMime !== 'application/octet-stream') {
      addAssetDetail(details, 'Несовпадение типа', `${extensionMime} -> ${detectedMime}`, true);
    }

    if (isSqlite) {
      void renderSqliteAssetPreview(file, bytes, preview, details, generation);
      return;
    }

    if (isAudio) {
      const audio = document.createElement('audio');
      audio.className = 'asset-audio-player';
      audio.controls = true;
      audio.preload = 'metadata';
      audio.addEventListener('loadedmetadata', () => {
        updateAssetDetail(details, 'Длительность', formatDuration(audio.duration));
      });
      audio.addEventListener('error', () => {
        updateAssetDetail(details, 'Длительность', 'ошибка');
      });
      audio.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
      preview.classList.add('asset-preview-audio');
      preview.appendChild(audio);
      return;
    }

    if (isFont) {
      void renderFontAssetPreview(file, item, bytes, preview, details, generation);
      return;
    }

    if (!isImage) {
      const empty = document.createElement('div');
      empty.className = 'asset-preview-empty';
      empty.textContent = 'Предпросмотр для этого типа файла пока недоступен';
      preview.appendChild(empty);
      return;
    }

    renderImageAssetPreview(file, item, bytes, detectedMime, preview, details, generation);
  }

  async function renderSqliteAssetPreview(file, bytes, preview, details, generation) {
    preview.classList.add('asset-preview-sqlite');
    showSqliteViewerMessage(preview, 'Открываем базу данных...');

    if (typeof window.Idyllium?.inspectSqliteDatabaseInBrowser !== 'function'
      || typeof window.Idyllium?.previewSqliteObjectInBrowser !== 'function') {
      showSqliteViewerError(preview, 'Модуль просмотра SQLite не загрузился.');
      return;
    }

    try {
      const description = await window.Idyllium.inspectSqliteDatabaseInBrowser(bytes);
      if (!isCurrentAssetPreview(file, preview, generation)) return;

      updateAssetDetail(details, 'Объекты', String(description.objectCount));
      updateAssetDetail(details, 'Версия схемы', String(description.userVersion));
      updateAssetDetail(details, 'Размер страницы', formatBytes(description.pageSize));
      updateAssetDetail(details, 'Страниц', String(description.pageCount));
      preview.replaceChildren(createSqliteInspector(file, bytes, description, preview, generation));
    } catch (error) {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      updateAssetDetail(details, 'Объекты', 'ошибка');
      updateAssetDetail(details, 'Версия схемы', 'неизвестно');
      updateAssetDetail(details, 'Размер страницы', 'неизвестно');
      updateAssetDetail(details, 'Страниц', 'неизвестно');
      showSqliteViewerError(preview, sqliteInspectorError(error));
    }
  }

  function createSqliteInspector(file, bytes, description, preview, generation) {
    const inspector = document.createElement('div');
    inspector.className = 'sqlite-inspector';

    const sidebar = document.createElement('aside');
    sidebar.className = 'sqlite-sidebar';
    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'sqlite-sidebar-header';
    const sidebarTitle = document.createElement('strong');
    sidebarTitle.textContent = 'Объекты';
    const sidebarCount = document.createElement('span');
    sidebarCount.textContent = String(description.objectCount);
    sidebarHeader.append(sidebarTitle, sidebarCount);
    sidebar.appendChild(sidebarHeader);

    const objectList = document.createElement('div');
    objectList.className = 'sqlite-object-list';
    sidebar.appendChild(objectList);

    const content = document.createElement('section');
    content.className = 'sqlite-object-view';
    inspector.append(sidebar, content);

    if (description.objects.length === 0) {
      const emptyList = document.createElement('p');
      emptyList.className = 'sqlite-sidebar-empty';
      emptyList.textContent = 'Таблиц и представлений нет';
      objectList.appendChild(emptyList);
      showSqliteViewerMessage(content, 'База данных открылась, но пользовательских таблиц и представлений в ней пока нет.');
      return inspector;
    }

    const buttons = new Map();
    let selectedObject = null;
    let selectedTab = 'data';
    let selectionSequence = 0;
    const previewCache = new Map();

    const selectObject = (object) => {
      selectedObject = object;
      selectedTab = 'data';
      selectionSequence++;
      for (const [name, button] of buttons) button.classList.toggle('active', name === object.name);
      renderSelectedObject();
    };

    for (const object of description.objects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sqlite-object-button';
      button.title = object.name;

      const badge = document.createElement('span');
      badge.className = `sqlite-object-kind sqlite-object-kind-${object.kind}`;
      badge.textContent = object.kind === 'table' ? 'T' : 'V';
      badge.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'sqlite-object-name';
      name.textContent = object.name;
      button.append(badge, name);
      button.addEventListener('click', () => selectObject(object));
      objectList.appendChild(button);
      buttons.set(object.name, button);
    }

    if (description.truncatedObjectCount > 0) {
      const warning = document.createElement('p');
      warning.className = 'sqlite-sidebar-note';
      warning.textContent = `Скрыто объектов: ${description.truncatedObjectCount}`;
      sidebar.appendChild(warning);
    }
    if (description.hiddenSystemObjectCount > 0) {
      const note = document.createElement('p');
      note.className = 'sqlite-sidebar-note';
      note.textContent = `Системных таблиц скрыто: ${description.hiddenSystemObjectCount}`;
      sidebar.appendChild(note);
    }

    function renderSelectedObject() {
      if (!selectedObject) return;
      const object = selectedObject;
      const requestSequence = selectionSequence;
      content.replaceChildren();

      const header = document.createElement('header');
      header.className = 'sqlite-object-header';
      const identity = document.createElement('div');
      identity.className = 'sqlite-object-identity';
      const title = document.createElement('strong');
      title.textContent = object.name;
      const kind = document.createElement('span');
      kind.textContent = object.kind === 'table' ? 'Таблица' : 'Представление';
      identity.append(title, kind);

      const tabs = document.createElement('div');
      tabs.className = 'sqlite-object-tabs';
      tabs.setAttribute('role', 'tablist');
      const dataButton = createSqliteTabButton('Данные', 'data');
      const schemaButton = createSqliteTabButton('Схема', 'schema');
      tabs.append(dataButton, schemaButton);
      header.append(identity, tabs);
      content.appendChild(header);

      const body = document.createElement('div');
      body.className = 'sqlite-object-body';
      content.appendChild(body);

      function createSqliteTabButton(label, tab) {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'tab';
        button.textContent = label;
        button.addEventListener('click', () => {
          selectedTab = tab;
          updateTabs();
          renderTab();
        });
        return button;
      }

      function updateTabs() {
        for (const [button, tab] of [[dataButton, 'data'], [schemaButton, 'schema']]) {
          const active = selectedTab === tab;
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', String(active));
        }
      }

      function renderTab() {
        body.replaceChildren();
        if (selectedTab === 'schema') {
          renderSqliteSchema(body, object);
          return;
        }

        const cached = previewCache.get(object.name);
        if (cached) {
          renderSqliteData(body, cached);
          return;
        }

        showSqliteViewerMessage(body, 'Читаем строки...');
        void window.Idyllium.previewSqliteObjectInBrowser(bytes, object.name, 200)
          .then((result) => {
            previewCache.set(object.name, result);
            if (!isCurrentAssetPreview(file, preview, generation)
              || selectedObject?.name !== object.name
              || selectionSequence !== requestSequence
              || selectedTab !== 'data') return;
            body.replaceChildren();
            renderSqliteData(body, result);
          })
          .catch((error) => {
            if (!isCurrentAssetPreview(file, preview, generation)
              || selectedObject?.name !== object.name
              || selectionSequence !== requestSequence
              || selectedTab !== 'data') return;
            showSqliteViewerError(body, sqliteInspectorError(error));
          });
      }

      updateTabs();
      renderTab();
    }

    selectObject(description.objects[0]);
    return inspector;
  }

  function renderSqliteSchema(parent, object) {
    const scroll = document.createElement('div');
    scroll.className = 'sqlite-schema-scroll';

    const summary = document.createElement('p');
    summary.className = 'sqlite-schema-summary';
    summary.textContent = formatRussianCount(object.columns.length, ['столбец', 'столбца', 'столбцов']);
    scroll.appendChild(summary);

    if (object.sql) {
      const sqlLabel = document.createElement('div');
      sqlLabel.className = 'sqlite-schema-label';
      sqlLabel.textContent = 'SQL создания';
      const sql = document.createElement('pre');
      sql.className = 'sqlite-schema-sql';
      sql.textContent = object.sql;
      scroll.append(sqlLabel, sql);
    }

    if (object.columns.length > 0) {
      const tableScroll = document.createElement('div');
      tableScroll.className = 'sqlite-table-scroll sqlite-schema-table-scroll';
      const table = document.createElement('table');
      table.className = 'sqlite-table sqlite-schema-table';
      appendSqliteHeaderRow(table, ['#', 'Столбец', 'Тип', 'NOT NULL', 'DEFAULT', 'PK']);
      const body = document.createElement('tbody');
      for (const column of object.columns) {
        const row = document.createElement('tr');
        appendSqliteTextCell(row, String(column.index), 'th', 'sqlite-row-number');
        appendSqliteTextCell(row, column.name, 'td');
        appendSqliteTextCell(row, column.declaredType || 'не указан', 'td', column.declaredType ? '' : 'sqlite-muted-value');
        appendSqliteTextCell(row, column.notNull ? 'да' : 'нет', 'td');
        appendSqliteTextCell(row, column.defaultValue ?? 'нет', 'td', column.defaultValue === null ? 'sqlite-muted-value' : '');
        appendSqliteTextCell(row, column.primaryKeyPosition > 0 ? String(column.primaryKeyPosition) : 'нет', 'td', column.primaryKeyPosition > 0 ? '' : 'sqlite-muted-value');
        body.appendChild(row);
      }
      table.appendChild(body);
      tableScroll.appendChild(table);
      scroll.appendChild(tableScroll);
    }

    parent.appendChild(scroll);
  }

  function renderSqliteData(parent, result) {
    const summary = document.createElement('div');
    summary.className = 'sqlite-data-summary';
    const shown = result.rows.length;
    summary.textContent = `Строк: ${result.totalRows} · показано: ${shown}`;
    parent.appendChild(summary);

    if (result.truncatedRows || result.truncatedColumns) {
      const warning = document.createElement('p');
      warning.className = 'sqlite-preview-warning';
      const parts = [];
      if (result.truncatedRows) parts.push('показаны первые 200 строк');
      if (result.truncatedColumns) parts.push(`показаны первые ${result.columns.length} столбцов из ${result.totalColumns}`);
      warning.textContent = parts.join(' · ');
      parent.appendChild(warning);
    }

    if (result.columns.length === 0) {
      showSqliteViewerMessage(parent, 'У объекта нет доступных столбцов.');
      return;
    }

    const scroll = document.createElement('div');
    scroll.className = 'sqlite-table-scroll';
    const table = document.createElement('table');
    table.className = 'sqlite-table sqlite-data-table';
    appendSqliteHeaderRow(table, ['#', ...result.columns]);
    const body = document.createElement('tbody');
    for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex++) {
      const row = document.createElement('tr');
      appendSqliteTextCell(row, String(rowIndex + 1), 'th', 'sqlite-row-number');
      for (const value of result.rows[rowIndex]) appendSqliteValueCell(row, value);
      body.appendChild(row);
    }
    table.appendChild(body);
    scroll.appendChild(table);
    parent.appendChild(scroll);

    if (result.rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'sqlite-empty-table';
      empty.textContent = 'В таблице пока нет строк';
      scroll.appendChild(empty);
    }
  }

  function appendSqliteHeaderRow(table, labels) {
    const head = document.createElement('thead');
    const row = document.createElement('tr');
    for (let index = 0; index < labels.length; index++) {
      appendSqliteTextCell(row, labels[index], 'th', index === 0 ? 'sqlite-row-number' : '');
    }
    head.appendChild(row);
    table.appendChild(head);
  }

  function appendSqliteTextCell(row, value, tagName, className = '') {
    const cell = document.createElement(tagName);
    if (className) cell.className = className;
    cell.textContent = value;
    if (value.length > 120) cell.title = value.slice(0, 1000);
    row.appendChild(cell);
  }

  function appendSqliteValueCell(row, value) {
    const cell = document.createElement('td');
    if (value === null) {
      cell.className = 'sqlite-value-null';
      cell.textContent = 'null';
    } else if (value instanceof Uint8Array) {
      cell.className = 'sqlite-value-blob';
      cell.textContent = `<BLOB ${formatBytes(value.length)}>`;
    } else {
      cell.textContent = String(value);
      if (typeof value === 'number' || typeof value === 'bigint') cell.className = 'sqlite-value-number';
    }
    if (cell.textContent.length > 120) cell.title = cell.textContent.slice(0, 1000);
    row.appendChild(cell);
  }

  function showSqliteViewerMessage(parent, message) {
    parent.replaceChildren();
    const element = document.createElement('div');
    element.className = 'sqlite-viewer-message';
    element.textContent = message;
    parent.appendChild(element);
  }

  function showSqliteViewerError(parent, message) {
    parent.replaceChildren();
    const error = document.createElement('div');
    error.className = 'sqlite-viewer-error';
    const title = document.createElement('strong');
    title.textContent = 'Базу данных не удалось открыть';
    const detail = document.createElement('p');
    detail.textContent = message;
    error.append(title, detail);
    parent.appendChild(error);
  }

  function sqliteInspectorError(error) {
    const message = error instanceof Error ? error.message : String(error || 'неизвестная ошибка');
    if (/not a database|file is encrypted/iu.test(message)) {
      return 'Файл не является корректной SQLite-базой или повреждён.';
    }
    return message.replace(/^SQLite execution failed:\s*/iu, '');
  }

  function renderImageAssetPreview(file, item, bytes, detectedMime, preview, details, generation) {
    preview.classList.add('asset-preview-image');

    const toolbar = document.createElement('div');
    toolbar.className = 'asset-image-toolbar';

    const zoomOut = createAssetImageButton('zoom-out', 'Уменьшить');
    const scaleValue = document.createElement('output');
    scaleValue.className = 'asset-image-scale';
    scaleValue.value = '100%';
    scaleValue.textContent = '100%';
    scaleValue.setAttribute('aria-live', 'polite');
    const zoomIn = createAssetImageButton('zoom-in', 'Увеличить');
    const actualSize = document.createElement('button');
    actualSize.type = 'button';
    actualSize.className = 'asset-image-button asset-image-actual-size';
    actualSize.textContent = '1:1';
    actualSize.title = 'Исходный размер';
    actualSize.setAttribute('aria-label', 'Показать в исходном размере');
    const fit = createAssetImageButton('fit', 'Вписать в область');
    toolbar.append(zoomOut, scaleValue, zoomIn, actualSize, fit);

    const viewport = document.createElement('div');
    viewport.className = 'asset-image-viewport';
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', `Предпросмотр изображения ${shortFileName(file)}`);

    const image = document.createElement('img');
    image.alt = shortFileName(file);
    image.draggable = false;
    viewport.appendChild(image);
    preview.append(toolbar, viewport);

    const state = {
      scale: 1,
      panX: 0,
      panY: 0,
      naturalWidth: 1,
      naturalHeight: 1,
      fitted: true,
      pointerId: null,
      pointerX: 0,
      pointerY: 0,
      startPanX: 0,
      startPanY: 0,
    };
    const minScale = 0.01;
    const maxScale = 16;

    const applyTransform = () => {
      const bounds = viewport.getBoundingClientRect();
      const width = state.naturalWidth * state.scale;
      const height = state.naturalHeight * state.scale;
      const maxPanX = Math.max(0, (width - bounds.width) / 2);
      const maxPanY = Math.max(0, (height - bounds.height) / 2);
      state.panX = clamp(state.panX, -maxPanX, maxPanX);
      state.panY = clamp(state.panY, -maxPanY, maxPanY);

      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.left = `calc(50% + ${state.panX}px)`;
      image.style.top = `calc(50% + ${state.panY}px)`;
      scaleValue.value = `${Math.round(state.scale * 100)}%`;
      scaleValue.textContent = scaleValue.value;
      zoomOut.disabled = state.scale <= minScale + 0.0001;
      zoomIn.disabled = state.scale >= maxScale - 0.0001;
      viewport.classList.toggle('can-pan', maxPanX > 0 || maxPanY > 0);
    };

    const setScale = (nextScale, anchor = null) => {
      const previousScale = state.scale;
      const scale = clamp(nextScale, minScale, maxScale);
      if (Math.abs(scale - previousScale) < 0.0001) return;

      if (anchor) {
        const bounds = viewport.getBoundingClientRect();
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        const sourceX = (anchor.x - centerX - state.panX) / previousScale;
        const sourceY = (anchor.y - centerY - state.panY) / previousScale;
        state.panX = anchor.x - centerX - sourceX * scale;
        state.panY = anchor.y - centerY - sourceY * scale;
      }

      state.scale = scale;
      state.fitted = false;
      applyTransform();
    };

    const fitImage = () => {
      const bounds = viewport.getBoundingClientRect();
      const availableWidth = Math.max(1, bounds.width - 28);
      const availableHeight = Math.max(1, bounds.height - 28);
      state.scale = clamp(Math.min(
        availableWidth / state.naturalWidth,
        availableHeight / state.naturalHeight,
        1,
      ), minScale, maxScale);
      state.panX = 0;
      state.panY = 0;
      state.fitted = true;
      applyTransform();
    };

    zoomOut.addEventListener('click', () => setScale(state.scale / 1.25));
    zoomIn.addEventListener('click', () => setScale(state.scale * 1.25));
    actualSize.addEventListener('click', () => {
      state.scale = 1;
      state.panX = 0;
      state.panY = 0;
      state.fitted = false;
      applyTransform();
    });
    fit.addEventListener('click', fitImage);

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      setScale(state.scale * factor, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    }, { passive: false });

    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !viewport.classList.contains('can-pan')) return;
      event.preventDefault();
      state.pointerId = event.pointerId;
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      state.startPanX = state.panX;
      state.startPanY = state.panY;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('dragging');
    });

    viewport.addEventListener('pointermove', (event) => {
      if (state.pointerId !== event.pointerId) return;
      state.panX = state.startPanX + event.clientX - state.pointerX;
      state.panY = state.startPanY + event.clientY - state.pointerY;
      state.fitted = false;
      applyTransform();
    });

    const finishDragging = (event) => {
      if (state.pointerId !== event.pointerId) return;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      state.pointerId = null;
      viewport.classList.remove('dragging');
    };
    viewport.addEventListener('pointerup', finishDragging);
    viewport.addEventListener('pointercancel', finishDragging);
    viewport.addEventListener('lostpointercapture', (event) => {
      if (state.pointerId !== event.pointerId) return;
      state.pointerId = null;
      viewport.classList.remove('dragging');
    });

    image.addEventListener('load', () => {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      state.naturalWidth = Math.max(1, image.naturalWidth);
      state.naturalHeight = Math.max(1, image.naturalHeight);
      updateAssetDetail(details, 'Ширина', `${image.naturalWidth}px`);
      updateAssetDetail(details, 'Высота', `${image.naturalHeight}px`);
      window.requestAnimationFrame(fitImage);

      const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (!isCurrentAssetPreview(file, preview, generation)) {
              resizeObserver.disconnect();
              return;
            }
            if (state.fitted) fitImage();
            else applyTransform();
          })
        : null;
      resizeObserver?.observe(viewport);
      activeAssetImageCleanup = () => resizeObserver?.disconnect();
    });

    image.addEventListener('error', () => {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      preview.classList.remove('asset-preview-image');
      preview.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'asset-preview-empty';
      empty.textContent = 'Не удалось прочитать изображение';
      preview.appendChild(empty);
      updateAssetDetail(details, 'Ширина', 'ошибка');
      updateAssetDetail(details, 'Высота', 'ошибка');
    });

    image.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
  }

  function createAssetImageButton(icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button asset-image-button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.appendChild(createIcon(icon));
    return button;
  }

  async function renderFontAssetPreview(file, item, bytes, preview, details, generation) {
    preview.classList.add('asset-preview-font');

    const loading = document.createElement('div');
    loading.className = 'asset-preview-empty';
    loading.textContent = 'Загружаем шрифт...';
    preview.appendChild(loading);

    if (typeof FontFace !== 'function' || !document.fonts || typeof document.fonts.add !== 'function') {
      loading.textContent = 'Этот браузер не поддерживает предпросмотр шрифтов';
      updateAssetDetail(details, 'Состояние', 'не поддерживается');
      return;
    }

    const family = `IdylliumAssetPreview${++assetFontCounter}`;
    const source = bytes.length > 0
      ? bytes.slice().buffer
      : `url(${JSON.stringify(item.resourceUri || '')})`;

    try {
      const face = await new FontFace(family, source).load();
      if (!isCurrentAssetPreview(file, preview, generation)) return;

      document.fonts.add(face);
      activeAssetFontFace = face;
      updateAssetDetail(details, 'Состояние', 'загружен');
      preview.replaceChildren(createFontPreviewContent(family));
    } catch (error) {
      if (!isCurrentAssetPreview(file, preview, generation)) return;
      loading.textContent = 'Не удалось прочитать шрифт';
      loading.title = error instanceof Error ? error.message : String(error);
      updateAssetDetail(details, 'Состояние', 'ошибка загрузки');
    }
  }

  function createFontPreviewContent(family) {
    const content = document.createElement('div');
    content.className = 'asset-font-preview';
    content.style.setProperty('--asset-font-size', '36px');

    const toolbar = document.createElement('div');
    toolbar.className = 'asset-font-toolbar';

    const label = document.createElement('label');
    label.className = 'asset-font-size-label';
    label.textContent = 'Размер';

    const range = document.createElement('input');
    range.type = 'range';
    range.min = '12';
    range.max = '96';
    range.step = '1';
    range.value = '36';
    range.className = 'asset-font-size-range';
    range.setAttribute('aria-label', 'Размер текста предпросмотра');

    const value = document.createElement('output');
    value.className = 'asset-font-size-value';
    value.value = '36 px';
    value.textContent = '36 px';

    range.addEventListener('input', () => {
      const size = Number(range.value);
      content.style.setProperty('--asset-font-size', `${size}px`);
      value.value = `${size} px`;
      value.textContent = `${size} px`;
    });

    label.appendChild(range);
    label.appendChild(value);
    toolbar.appendChild(label);
    content.appendChild(toolbar);

    const samples = document.createElement('div');
    samples.className = 'asset-font-samples';
    const fontFamily = `"${family}", sans-serif`;
    const pangrams = [
      ['Русская панграмма', 'Съешь же ещё этих мягких французских булок, да выпей чаю.'],
      ['Английская панграмма', 'The quick brown fox jumps over the lazy dog.'],
      ['Цифры и знаки', '0123456789  + - * / = < >  ( ) [ ] { }'],
    ];

    for (const [caption, text] of pangrams) {
      const sample = document.createElement('section');
      sample.className = 'asset-font-sample';

      const heading = document.createElement('div');
      heading.className = 'asset-font-sample-label';
      heading.textContent = caption;
      sample.appendChild(heading);

      const line = document.createElement('div');
      line.className = 'asset-font-sample-text';
      line.style.fontFamily = fontFamily;
      line.textContent = text;
      sample.appendChild(line);
      samples.appendChild(sample);
    }

    content.appendChild(samples);

    const note = document.createElement('p');
    note.className = 'asset-font-note';
    note.textContent = 'Если в файле нет нужного символа, браузер может незаметно подставить его из запасного шрифта.';
    content.appendChild(note);
    return content;
  }

  function isCurrentAssetPreview(file, preview, generation) {
    return generation === assetViewerGeneration
      && currentFile === file
      && assetViewer
      && !assetViewer.hidden
      && assetViewer.contains(preview);
  }

  function releaseAssetViewerFont() {
    if (!activeAssetFontFace) return;
    if (document.fonts && typeof document.fonts.delete === 'function') {
      document.fonts.delete(activeAssetFontFace);
    }
    activeAssetFontFace = null;
  }

  function releaseAssetViewerResources() {
    releaseAssetViewerFont();
    activeAssetImageCleanup?.();
    activeAssetImageCleanup = null;
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
    const available = Boolean(item && item.kind === 'text' && currentFile.endsWith('.idyl'));
    formatButton.hidden = !available;
    formatButton.disabled = !available;
  }

  function saveCurrentEditor() {
    if (!editorReady) return;
    const item = files.get(currentFile);
    if (!item || item.kind !== 'text' || isEditorReadOnly()) return;
    if (monacoReady && monacoEditor) {
      const model = monacoEditor.getModel();
      if (!model || normalizeWorkspacePath(model.uri.path) !== currentFile) return;
    }
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
      const language = monacoLanguageForFile(file || currentFile);
      monacoModelSyncDepth++;
      try {
        let model = monaco.editor.getModel(uri);
        if (!model) {
          model = monaco.editor.createModel(value, language, uri);
        } else {
          if (model.getLanguageId() !== language) monaco.editor.setModelLanguage(model, language);
          if (model.getValue() !== value) model.setValue(value);
        }
        monacoEditor.setModel(model);
      } finally {
        monacoModelSyncDepth--;
      }
      window.setTimeout(() => {
        monacoEditor.layout();
        scheduleMonacoDiagnostics();
      }, 0);
      return;
    }

    editor.value = value;
  }

  function monacoLanguageForFile(file) {
    const name = String(file || '').toLowerCase();
    if (name.endsWith('.idyl')) return MONACO_LANGUAGE_ID;
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.xml')) return 'xml';
    if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
    if (name.endsWith('.css')) return 'css';
    if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
    return 'plaintext';
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
    if (node.kind === 'asset' && isSqliteFile(node.name)) return 'database';
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
      database: ['M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z', 'M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5', 'M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7'],
      folder: ['M3 6h7l2 2h9v11H3z'],
      'folder-open': ['M3 7h7l2 2h9l-2 10H3z', 'M3 7v12'],
      'zoom-in': ['M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', 'm21 21-4.35-4.35', 'M11 8v6', 'M8 11h6'],
      'zoom-out': ['M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', 'm21 21-4.35-4.35', 'M8 11h6'],
      fit: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2'],
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

    saveCurrentEditor();
    let lastPath = null;
    let loadedCurrentFile = false;
    let loadedCount = 0;
    let skippedCount = 0;
    for (const file of selected) {
      const loadedPath = await loadExternalFile(file);
      if (loadedPath) {
        if (loadedPath === currentFile) loadedCurrentFile = true;
        lastPath = loadedPath;
        loadedCount++;
      } else {
        skippedCount++;
      }
    }

    hideUploadMenu();
    if (loadedCurrentFile) editorReady = false;
    if (lastPath) openFile(lastPath);
    scheduleAutosave();
    const skippedText = skippedCount > 0 ? `, пропущено: ${skippedCount}` : '';
    setStatus(`Загружено файлов: ${loadedCount}${skippedText}`);
  }

  async function loadExternalFile(file) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      return importProjectZip(new Uint8Array(await file.arrayBuffer()));
    }

    const path = normalizeWorkspacePath(file.webkitRelativePath || file.name);
    if (path === WORKSPACE_ROOT || folders.has(path) || hasFileAncestor(path)) {
      setStatus(`Нельзя загрузить файл по пути «${shortFileName(path) || path}»`, true);
      return null;
    }
    if (files.has(path) && !await requestUploadReplacement(path)) return null;

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
    previewGeneration++;
    saveCurrentEditor();
    hideCompletions();
    output.textContent = '';
    consoleInputEchoes = [];
    lastRenderedRuntimeOutput = '';
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
            lastRenderedRuntimeOutput = '';
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
      currentRuntimeFileSnapshot = prepared.writtenFilesSnapshot;
      startOutputSync();
      await runRuntimeActionWithSnapshotPump(async () => {
        await prepared.run();
      });
      if (runId !== runSequence) return;
      syncRuntimeFilesFromSnapshot();
      syncRuntimeOutput();
      sendRuntimeSnapshot();
      if (runtimeHasGui(currentRuntime)) {
        startGuiLoop();
        setRunControls(false, true);
      } else {
        stopOutputSync();
        postEmptySnapshot();
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
    if (hadRuntime) {
      runSequence++;
      previewGeneration++;
      lastSnapshotJson = '';
    }
    if (runAbortController && !runAbortController.signal.aborted) runAbortController.abort();
    syncRuntimeFilesFromSnapshot();
    stopOutputSync();
    stopGuiLoop();
    pendingGuiEvents.length = 0;
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
    const rendered = renderRuntimeOutput(currentRuntime.getOutput());
    if (rendered === lastRenderedRuntimeOutput) return;
    lastRenderedRuntimeOutput = rendered;
    setOutputText(rendered, '', { ansi: true });
  }

  function syncRuntimeFilesFromSnapshot() {
    if (typeof currentRuntimeFileSnapshot !== 'function') return false;

    const snapshot = currentRuntimeFileSnapshot() || {};
    let changed = false;
    let currentFileChanged = false;
    let currentFileDeleted = false;

    for (const [rawPath, rawEntry] of Object.entries(snapshot)) {
      const path = normalizeWorkspacePath(rawPath);
      if (path === WORKSPACE_ROOT) continue;

      const entry = typeof rawEntry === 'string'
        ? { kind: 'file', content: rawEntry, resourceUri: '' }
        : rawEntry || {};

      if (entry.kind === 'deleted') {
        if (folders.has(path)) {
          if (currentFile === path || currentFile.startsWith(path + '/')) currentFileDeleted = true;
          removeProjectItem(path, 'folder');
          changed = true;
        } else if (files.has(path)) {
          if (currentFile === path) currentFileDeleted = true;
          removeProjectItem(path, 'file');
          changed = true;
        }
        continue;
      }

      if (entry.kind === 'directory') {
        if (!folders.has(path)) {
          addProjectFolder(path);
          changed = true;
        }
        continue;
      }

      if (entry.bytes instanceof Uint8Array) {
        const bytes = new Uint8Array(entry.bytes);
        const resourceUri = entry.resourceUri || bytesToDataUrl(path, bytes);
        const previous = files.get(path);
        const sameBytes = previous?.kind === 'asset' && equalBytes(previous.bytes, bytes);
        if (!sameBytes || previous.resourceUri !== resourceUri) {
          setProjectFile(path, { kind: 'asset', content: '', bytes, resourceUri });
          changed = true;
          if (path === currentFile) currentFileChanged = true;
        }
        continue;
      }

      const content = typeof entry.content === 'string' ? entry.content : '';
      const previous = files.get(path);
      if (!previous || previous.kind !== 'text' || previous.content !== content) {
        setProjectFile(path, { kind: 'text', content });
        changed = true;
        if (path === currentFile) currentFileChanged = true;
      }
    }

    if (!changed) return false;

    if (currentFileDeleted || !files.has(currentFile)) {
      if (files.size === 0) setProjectFile(MAIN_FILE, { kind: 'text', content: '' });
      currentFile = fallbackFilePath();
      editorReady = false;
      openFile(currentFile);
    } else if (currentFileChanged) {
      const item = files.get(currentFile);
      if (item && item.kind === 'text') {
        setEditorValue(item.content || '', currentFile);
        updateEditorVisuals();
        if (isCsvFile(currentFile) && structuredViewModes.get(currentFile) === 'table') {
          csvViewer.replaceChildren();
          renderCsvTable(currentFile, item.content || '');
        } else if (isJsonFile(currentFile) && structuredViewModes.get(currentFile) === 'tree') {
          jsonViewer.replaceChildren();
          renderJsonTree(currentFile, item.content || '');
        }
      } else if (item && item.kind === 'asset') {
        showAssetViewer(currentFile, item);
      }
    }

    renderFiles();
    scheduleAutosave();
    return true;
  }

  function equalBytes(left, right) {
    if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
      if (left[index] !== right[index]) return false;
    }
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
    if (runtime && typeof runtime.hasGui === 'function') return runtime.hasGui();
    return Boolean(runtime && (
      runtime.getWindows().length > 0
      || runtime.getCanvases().length > 0
      || runtime.getModals().length > 0
      || runtimeHasActiveAudio(runtime)
    ));
  }

  function runtimeHasActiveAudio(runtime) {
    if (!runtime || typeof runtime.getAudio !== 'function') return false;
    return runtime.getAudio().some((item) => item && item.properties && item.properties.is_playing === true);
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
    refreshBrowserAssetUrls();
    const result = {};
    for (const folder of folders) {
      result[folder] = { kind: 'directory' };
    }
    for (const [file, item] of files) {
      result[file] = item.kind === 'asset'
        ? {
            content: item.content || '',
            bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : undefined,
            resourceUri: browserAssetResourceUri(file, item),
          }
        : item.content;
    }
    return result;
  }

  function refreshBrowserAssetUrls() {
    for (const [path, cached] of browserAssetUrls) {
      if (files.get(path) === cached.item) continue;
      URL.revokeObjectURL(cached.url);
      browserAssetUrls.delete(path);
    }
  }

  function browserAssetResourceUri(path, item) {
    const cached = browserAssetUrls.get(path);
    if (cached && cached.item === item) return cached.url;
    if (cached) URL.revokeObjectURL(cached.url);

    const bytes = assetBytes(item);
    if (bytes.length === 0) return item.resourceUri || '';
    const type = detectAssetMimeType(path, bytes);
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    browserAssetUrls.set(path, { item, url });
    return url;
  }

  function revokeAllBrowserAssetUrls() {
    for (const cached of browserAssetUrls.values()) URL.revokeObjectURL(cached.url);
    browserAssetUrls.clear();
  }

  async function downloadProject() {
    try {
      await flushCurrentProjectState();
      await downloadProjectState(serializeProjectState(), currentProjectName);
      setStatus('Проект скачан');
    } catch (error) {
      setStatus('Не удалось скачать проект', true);
      appendOutput(formatThrownError(error), 'output-error');
    }
  }

  async function downloadStoredProject(projectId) {
    const entry = projectCatalog.find((project) => project.id === projectId);
    if (!entry) throw new Error('Проект не найден');
    if (projectId === currentProjectId) {
      await downloadProject();
      return;
    }
    const state = await readProjectDbValue(projectRecordKey(projectId));
    if (!state || !Array.isArray(state.files)) throw new Error(`Не удалось прочитать проект «${entry.name}»`);
    await downloadProjectState(state, entry.name);
    setStatus('Проект скачан');
  }

  async function downloadProjectState(state, name) {
    const blob = await createProjectZip(state);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeDownloadName(name)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeDownloadName(value) {
    const cleaned = String(value || '')
      .replace(/[\\/:*?"<>|]/gu, '_')
      .replace(/[.\s]+$/gu, '')
      .trim()
      .slice(0, 80);
    return cleaned || 'idyllium-project';
  }

  async function createProjectZip(state = serializeProjectState()) {
    const entries = [];
    const stateFolders = Array.isArray(state.folders) ? state.folders : [];
    const stateFiles = Array.isArray(state.files) ? state.files : [];
    for (const folder of stateFolders
      .map((path) => normalizeWorkspacePath(path))
      .filter((path) => path !== WORKSPACE_ROOT)
      .sort(pathSort)) {
      entries.push({ name: shortFileName(folder) + '/', bytes: new Uint8Array() });
    }
    for (const item of [...stateFiles].sort((left, right) => String(left.path).localeCompare(String(right.path)))) {
      const name = shortFileName(item.path);
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

  async function enqueueGuiEvent(message) {
    if (!message || message.type !== 'guiEvent') return;
    pendingGuiEvents.push(message);
    await drainGuiEvents();
  }

  async function drainGuiEvents() {
    if (!currentRuntime || guiBusy) return;
    guiBusy = true;
    try {
      while (currentRuntime && pendingGuiEvents.length > 0) {
        const message = pendingGuiEvents.shift();
        await runRuntimeActionWithSnapshotPump(async () => {
          await currentRuntime.dispatchGuiEvent(Number(message.objectId), String(message.eventName), message.payload || {});
        });
      }
    } finally {
      guiBusy = false;
    }
  }

  async function runRuntimeActionWithSnapshotPump(action) {
    let finished = false;
    let failure = null;
    const actionPromise = Promise.resolve()
      .then(action)
      .catch((error) => {
        failure = error;
      })
      .finally(() => {
        finished = true;
      });

    while (!finished) {
      await Promise.race([actionPromise, waitForSnapshotPump()]);
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      sendRuntimeSnapshot();
    }

    if (failure) throw failure;
  }

  function waitForSnapshotPump() {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 50);
    });
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
        const changed = await currentRuntime.stepGui(delta);
        syncRuntimeOutput();
        syncRuntimeFilesFromSnapshot();
        if (changed) sendRuntimeSnapshot();
        if (!runtimeHasGui(currentRuntime)) {
          finishCompletedRuntime();
        }
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
        if (pendingGuiEvents.length > 0) void drainGuiEvents();
      }
    }, intervalMs);
  }

  function stopGuiLoop() {
    if (guiTimer !== null) window.clearInterval(guiTimer);
    guiTimer = null;
  }

  function finishCompletedRuntime() {
    stopOutputSync();
    stopGuiLoop();
    currentRuntime = null;
    currentRuntimeFileSnapshot = null;
    runAbortController = null;
    setRunControls(false);
    if (!output.textContent) output.textContent = 'Программа Idyllium успешно завершилась.';
    setStatus('Готово');
    postEmptySnapshot();
  }

  function sendRuntimeSnapshot() {
    if (!currentRuntime) {
      postEmptySnapshot();
      return;
    }
    const windows = currentRuntime.getWindows();
    postSnapshot({
      audio: currentRuntime.getAudio ? currentRuntime.getAudio() : [],
      windows,
      canvases: windows.length > 0 ? [] : currentRuntime.getCanvases(),
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
    postSnapshot({ audio: [], windows: [], canvases: [], modals: [], output: '' });
  }

  function postSnapshot(snapshot) {
    const fullSnapshot = {
      ...snapshot,
      generation: previewGeneration,
    };
    pendingSnapshot = fullSnapshot;
    if (!guiFrameReady || !guiFrame.contentWindow) return;
    const snapshotJson = JSON.stringify(fullSnapshot);
    if (snapshotJson === lastSnapshotJson) return;
    lastSnapshotJson = snapshotJson;
    guiFrame.contentWindow.postMessage({
      type: 'snapshot',
      generation: fullSnapshot.generation,
      audio: fullSnapshot.audio || [],
      windows: fullSnapshot.windows,
      canvases: fullSnapshot.canvases,
      modals: fullSnapshot.modals,
      output: fullSnapshot.output,
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
    if (!currentProjectId) return;
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
    if (!currentProjectId) return;
    const projectId = currentProjectId;
    const state = serializeProjectState();
    const updatedAt = new Date().toISOString();
    state.savedAt = updatedAt;
    projectCatalog = projectCatalog.map((entry) => entry.id === projectId
      ? { ...entry, updatedAt }
      : entry);
    const catalog = serializeProjectCatalog();

    await enqueueProjectWrite(() => writeProjectDbBatch([
      [projectRecordKey(projectId), state],
      [PROJECT_CATALOG_KEY, catalog],
    ]));
  }

  async function forceSaveCurrentProject() {
    try {
      await flushCurrentProjectState();
      setStatus('Проект сохранён');
    } catch (error) {
      setStatus('Не удалось сохранить проект', true);
      appendOutput(formatThrownError(error), 'output-error');
    }
  }

  async function flushCurrentProjectState() {
    syncRuntimeFilesFromSnapshot();
    saveCurrentEditor();
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    await saveProjectState();
    await projectWriteQueue;
  }

  function enqueueProjectWrite(task) {
    const result = projectWriteQueue.then(task, task);
    projectWriteQueue = result.catch(() => {});
    return result;
  }

  async function initializeProjectStorage() {
    const storedCatalog = await readProjectDbValue(PROJECT_CATALOG_KEY);
    const legacyState = await readProjectDbValue(PROJECT_STATE_KEY);
    projectCatalog = normalizeProjectCatalog(storedCatalog);

    if (projectCatalog.length === 0) {
      const projectId = createProjectId();
      const now = new Date().toISOString();
      const state = legacyState && !isLegacyDefaultCanvasProject(legacyState)
        ? copySerializedProjectState(legacyState)
        : createDefaultProjectState();
      state.savedAt = now;
      projectCatalog = [{
        id: projectId,
        name: DEFAULT_PROJECT_NAME,
        createdAt: now,
        updatedAt: now,
      }];
      await writeProjectDbBatch([
        [projectRecordKey(projectId), state],
        [PROJECT_CATALOG_KEY, serializeProjectCatalog()],
      ], [PROJECT_STATE_KEY]);
    } else if (legacyState) {
      await writeProjectDbBatch([], [PROJECT_STATE_KEY]);
    }

    const preferredId = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
    const preferred = projectCatalog.find((entry) => entry.id === preferredId);
    const selected = preferred || [...projectCatalog].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    currentProjectId = selected.id;
    currentProjectName = selected.name;
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, currentProjectId);

    let state = await readProjectDbValue(projectRecordKey(currentProjectId));
    if (!state || !Array.isArray(state.files)) {
      state = createDefaultProjectState();
      await writeProjectDbBatch([
        [projectRecordKey(currentProjectId), state],
        [PROJECT_CATALOG_KEY, serializeProjectCatalog()],
      ]);
    }
    return state;
  }

  function createDefaultProjectState() {
    return {
      version: 2,
      currentFile: MAIN_FILE,
      savedAt: new Date().toISOString(),
      folders: [],
      expandedFolders: [],
      files: [
        {
          path: MAIN_FILE,
          kind: 'text',
          content: [
            'use console;',
            '',
            'main() {',
            '    console.writeln("Hello, World!");',
            '}',
          ].join('\n'),
          bytes: null,
          resourceUri: '',
        },
        {
          path: '/workspace/input.txt',
          kind: 'text',
          content: '42\n',
          bytes: null,
          resourceUri: '',
        },
      ],
    };
  }

  function copySerializedProjectState(state) {
    return {
      version: 2,
      currentFile: typeof state.currentFile === 'string' ? state.currentFile : MAIN_FILE,
      savedAt: new Date().toISOString(),
      folders: Array.isArray(state.folders) ? [...state.folders] : [],
      expandedFolders: Array.isArray(state.expandedFolders) ? [...state.expandedFolders] : [],
      files: Array.isArray(state.files) ? state.files.map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        content: entry.content || '',
        bytes: entry.bytes ? new Uint8Array(entry.bytes) : null,
        resourceUri: entry.resourceUri || '',
      })) : [],
    };
  }

  function normalizeProjectCatalog(value) {
    if (!value || !Array.isArray(value.projects)) return [];
    const seen = new Set();
    const result = [];
    for (const raw of value.projects) {
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const createdAt = validIsoDate(raw.createdAt) || new Date().toISOString();
      result.push({
        id,
        name: normalizeStoredProjectName(raw.name),
        createdAt,
        updatedAt: validIsoDate(raw.updatedAt) || createdAt,
      });
    }
    return result;
  }

  function serializeProjectCatalog() {
    return {
      version: 1,
      projects: projectCatalog.map((entry) => ({ ...entry })),
    };
  }

  function validIsoDate(value) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '';
    return value;
  }

  function normalizeStoredProjectName(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    return name || DEFAULT_PROJECT_NAME;
  }

  function createProjectId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function projectRecordKey(projectId) {
    return PROJECT_RECORD_PREFIX + projectId;
  }

  async function readProjectDbValue(key) {
    const db = await openProjectDb();
    try {
      return await idbRequest(db.transaction(PROJECT_DB_STORE, 'readonly')
        .objectStore(PROJECT_DB_STORE)
        .get(key));
    } finally {
      db.close();
    }
  }

  async function writeProjectDbBatch(entries, deleteKeys = []) {
    const db = await openProjectDb();
    try {
      const transaction = db.transaction(PROJECT_DB_STORE, 'readwrite');
      const completed = idbTransaction(transaction);
      const store = transaction.objectStore(PROJECT_DB_STORE);
      for (const [key, value] of entries) store.put(value, key);
      for (const key of deleteKeys) store.delete(key);
      await completed;
    } finally {
      db.close();
    }
  }

  function idbTransaction(transaction) {
    return new Promise((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve());
      transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction aborted')));
      transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed')));
    });
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
        bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : null,
        resourceUri: item.resourceUri || '',
      })),
    };
  }

  function restoreProjectState(state) {
    if (!state || !Array.isArray(state.files)) return;
    structuredViewModes.clear();
    csvHeaderModes.clear();
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

  async function createNewProject(name) {
    stopProgram(true);
    await flushCurrentProjectState();
    await storeAndActivateNewProject(name, createDefaultProjectState());
  }

  async function duplicateCurrentProject(name) {
    stopProgram(true);
    await flushCurrentProjectState();
    await storeAndActivateNewProject(name, serializeProjectState());
  }

  async function storeAndActivateNewProject(name, sourceState) {
    const error = projectNameError(name);
    if (error) throw new Error(error);
    const projectId = createProjectId();
    const now = new Date().toISOString();
    const state = copySerializedProjectState(sourceState);
    state.savedAt = now;
    const entry = {
      id: projectId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    projectCatalog = [...projectCatalog, entry];
    await enqueueProjectWrite(() => writeProjectDbBatch([
      [projectRecordKey(projectId), state],
      [PROJECT_CATALOG_KEY, serializeProjectCatalog()],
    ]));
    activateProject(entry, state);
    setStatus('Проект создан');
  }

  async function switchProject(projectId) {
    if (projectId === currentProjectId) {
      hideFileAppMenu();
      return;
    }
    stopProgram(true);
    await flushCurrentProjectState();
    const entry = projectCatalog.find((item) => item.id === projectId);
    if (!entry) throw new Error('Проект не найден');
    const state = await readProjectDbValue(projectRecordKey(projectId));
    if (!state || !Array.isArray(state.files)) throw new Error(`Не удалось прочитать проект «${entry.name}»`);
    activateProject(entry, state);
    setStatus('Проект открыт');
  }

  function activateProject(entry, state) {
    stopProgram(true);
    fileEditState = null;
    editorReady = false;
    disposeProjectMonacoModels();
    currentProjectId = entry.id;
    currentProjectName = entry.name;
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, currentProjectId);
    restoreProjectState(copySerializedProjectState(state));
    if (!files.has(currentFile)) currentFile = fallbackFilePath();
    renderFiles();
    openFile(currentFile);
    setOutputText('');
    postEmptySnapshot();
    updateCurrentProjectUi();
    hideFileAppMenu();
  }

  function disposeProjectMonacoModels() {
    if (!monacoReady || !window.monaco) return;
    if (monacoEditor) monacoEditor.setModel(null);
    for (const model of window.monaco.editor.getModels()) {
      if (model.uri.scheme === 'file' && model.uri.path.startsWith(WORKSPACE_ROOT + '/')) model.dispose();
    }
  }

  async function deleteCurrentProject() {
    const deletedId = currentProjectId;
    stopProgram(true);
    await flushCurrentProjectState();
    projectCatalog = projectCatalog.filter((entry) => entry.id !== deletedId);

    let nextEntry = [...projectCatalog].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    let nextState;
    const writes = [];
    if (!nextEntry) {
      const now = new Date().toISOString();
      nextEntry = {
        id: createProjectId(),
        name: DEFAULT_PROJECT_NAME,
        createdAt: now,
        updatedAt: now,
      };
      nextState = createDefaultProjectState();
      projectCatalog = [nextEntry];
      writes.push([projectRecordKey(nextEntry.id), nextState]);
    } else {
      nextState = await readProjectDbValue(projectRecordKey(nextEntry.id));
      if (!nextState || !Array.isArray(nextState.files)) {
        nextState = createDefaultProjectState();
        writes.push([projectRecordKey(nextEntry.id), nextState]);
      }
    }
    writes.push([PROJECT_CATALOG_KEY, serializeProjectCatalog()]);
    await enqueueProjectWrite(() => writeProjectDbBatch(writes, [projectRecordKey(deletedId)]));
    activateProject(nextEntry, nextState);
    setStatus('Проект удалён');
  }

  function projectNameError(value, ignoredProjectId = '') {
    const name = String(value || '').trim();
    if (!name) return 'Введите название проекта';
    if (name.length > 80) return 'Название не должно быть длиннее 80 символов';
    if (/[\u0000-\u001F\u007F]/u.test(name)) return 'В названии есть недопустимые управляющие символы';
    const duplicate = projectCatalog.some((entry) => entry.id !== ignoredProjectId
      && entry.name.localeCompare(name, 'ru', { sensitivity: 'accent' }) === 0);
    if (duplicate) return 'Проект с таким названием уже существует';
    return '';
  }

  function uniqueProjectName(base) {
    const initial = String(base || DEFAULT_PROJECT_NAME).trim() || DEFAULT_PROJECT_NAME;
    if (!projectNameError(initial)) return initial;
    let index = 2;
    while (projectNameError(`${initial} ${index}`)) index += 1;
    return `${initial} ${index}`;
  }

  function updateCurrentProjectUi() {
    if (currentProjectNameElement) currentProjectNameElement.textContent = currentProjectName;
    if (fileAppMenuButton) fileAppMenuButton.title = `Файл · ${currentProjectName}`;
    document.title = `${currentProjectName} · Idyllium Web IDE`;
  }

  function toggleUploadMenu() {
    uploadMenu.hidden ? showUploadMenu() : hideUploadMenu();
  }

  function showUploadMenu() {
    hideFileAppMenu();
    hideEditAppMenu();
    hideThemeMenu();
    hideColorPickerMenu();
    uploadMenu.hidden = false;
    uploadButton.setAttribute('aria-expanded', 'true');
  }

  function hideUploadMenu() {
    resolveUploadConflict(false);
    uploadMenu.hidden = true;
    uploadButton.setAttribute('aria-expanded', 'false');
    dropArea.classList.remove('drag-over');
  }

  function requestUploadReplacement(path) {
    showUploadMenu();
    dropArea.hidden = true;
    uploadConflict.hidden = false;
    uploadConflictName.textContent = shortFileName(path);
    return new Promise((resolve) => {
      pendingUploadConflictResolve = resolve;
      uploadConflictReplace.focus();
    });
  }

  function resolveUploadConflict(replace) {
    const resolve = pendingUploadConflictResolve;
    pendingUploadConflictResolve = null;
    uploadConflict.hidden = true;
    dropArea.hidden = false;
    if (resolve) resolve(replace);
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

    let fileListDragDepth = 0;
    fileList.addEventListener('dragenter', (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      fileListDragDepth += 1;
      fileList.classList.add('drag-over');
    });
    fileList.addEventListener('dragover', (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      fileList.classList.add('drag-over');
    });
    fileList.addEventListener('dragleave', (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      fileListDragDepth = Math.max(0, fileListDragDepth - 1);
      if (fileListDragDepth === 0) fileList.classList.remove('drag-over');
    });
    fileList.addEventListener('drop', (event) => {
      if (!isFileTransfer(event.dataTransfer)) return;
      event.preventDefault();
      fileListDragDepth = 0;
      fileList.classList.remove('drag-over');
      loadDroppedFiles(event.dataTransfer && event.dataTransfer.files);
    });
  }

  function isFileTransfer(dataTransfer) {
    if (!dataTransfer) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.length === 0 || types.includes('Files');
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
        const beforeWord = source.slice(0, index);
        const isDeclaredClass = /\b(?:class|extends)\s*$/u.test(beforeWord);
        const isTypePosition = /^[A-ZА-ЯЁ]/u.test(word)
          && /^\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$)/u.test(afterWord);
        if (KEYWORDS.has(word)) {
          html += span('tok-keyword', word);
        } else if (BUILTIN_TYPES.has(word) || CLASS_NAMES.has(word) || QUALIFIED_TYPES.has(word) || isDeclaredClass || isTypePosition) {
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

  function toggleFileAppMenu() {
    fileAppMenu.hidden ? showFileAppMenu() : hideFileAppMenu();
  }

  function showFileAppMenu() {
    hideEditAppMenu();
    hideUploadMenu();
    hideThemeMenu();
    hideColorPickerMenu();
    hideFileContextMenu();
    resetFileAppMenu();
    updateCurrentProjectUi();
    fileAppMenu.hidden = false;
    fileAppMenuButton.setAttribute('aria-expanded', 'true');
  }

  function hideFileAppMenu() {
    if (!fileAppMenu) return;
    fileAppMenu.hidden = true;
    fileAppMenuButton.setAttribute('aria-expanded', 'false');
    resetFileAppMenu();
  }

  function resetFileAppMenu() {
    if (!fileAppMenuMain || !fileAppMenuPanel) return;
    fileAppMenuMain.hidden = false;
    fileAppMenuPanel.hidden = true;
    fileAppMenuPanel.replaceChildren();
  }

  function handleFileAppMenuClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-file-command]');
    if (!button || !fileAppMenu.contains(button)) return;
    const command = button.dataset.fileCommand;
    executeFileAppCommand(command).catch(reportProjectOperationError);
  }

  async function executeFileAppCommand(command) {
    if (command === 'new-file') {
      hideFileAppMenu();
      startCreateItemInline('file', WORKSPACE_ROOT);
      return;
    }
    if (command === 'open-file') {
      hideFileAppMenu();
      uploadInput.click();
      return;
    }
    if (command === 'new-project') {
      showProjectNamePanel({
        title: 'Новый проект',
        initialValue: uniqueProjectName('Новый проект'),
        submitLabel: 'Создать',
        submit: createNewProject,
      });
      return;
    }
    if (command === 'open-project') {
      showProjectListPanel('Открыть проект', projectCatalog, switchProject, true);
      return;
    }
    if (command === 'save-project') {
      hideFileAppMenu();
      await forceSaveCurrentProject();
      return;
    }
    if (command === 'duplicate-project') {
      showProjectNamePanel({
        title: 'Дублировать проект',
        initialValue: uniqueProjectName(`${currentProjectName} (копия)`),
        submitLabel: 'Дублировать',
        submit: duplicateCurrentProject,
      });
      return;
    }
    if (command === 'delete-project') {
      showDeleteProjectPanel();
      return;
    }
    if (command === 'download-project') {
      hideFileAppMenu();
      await downloadProject();
      return;
    }
    if (command === 'download-other-project') {
      showProjectListPanel(
        'Скачать другой проект',
        projectCatalog.filter((entry) => entry.id !== currentProjectId),
        async (projectId) => {
          await downloadStoredProject(projectId);
          hideFileAppMenu();
        },
        false,
      );
    }
  }

  function showProjectNamePanel(options) {
    showFileAppMenuPanel(options.title);

    const form = document.createElement('form');
    form.className = 'app-menu-form';

    const label = document.createElement('label');
    label.className = 'app-menu-panel-label';
    label.textContent = 'Название проекта';
    form.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 80;
    input.value = options.initialValue;
    input.autocomplete = 'off';
    label.htmlFor = 'project-name-input';
    input.id = 'project-name-input';
    form.appendChild(input);

    const error = document.createElement('p');
    error.className = 'app-menu-error';
    error.setAttribute('aria-live', 'polite');
    form.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'app-menu-form-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Отмена';
    cancel.addEventListener('click', resetFileAppMenu);
    actions.appendChild(cancel);
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'primary';
    submit.textContent = options.submitLabel;
    actions.appendChild(submit);
    form.appendChild(actions);
    fileAppMenuPanel.appendChild(form);

    input.addEventListener('input', () => {
      input.classList.remove('invalid');
      error.textContent = '';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = projectNameError(input.value);
      if (message) {
        input.classList.add('invalid');
        error.textContent = message;
        input.focus();
        return;
      }
      input.disabled = true;
      submit.disabled = true;
      try {
        await options.submit(input.value.trim());
        hideFileAppMenu();
      } catch (operationError) {
        input.disabled = false;
        submit.disabled = false;
        input.classList.add('invalid');
        error.textContent = formatThrownError(operationError);
        input.focus();
      }
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  function showProjectListPanel(title, entries, select, markCurrent) {
    showFileAppMenuPanel(title);
    const list = document.createElement('div');
    list.className = 'project-menu-list';
    const sorted = [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'project-menu-empty';
      empty.textContent = 'Других проектов пока нет.';
      list.appendChild(empty);
    }
    for (const entry of sorted) {
      const button = document.createElement('button');
      button.type = 'button';
      const name = document.createElement('strong');
      name.textContent = entry.name;
      button.appendChild(name);
      const details = document.createElement('small');
      details.textContent = markCurrent && entry.id === currentProjectId
        ? 'Открыт сейчас'
        : `Изменён ${formatProjectDate(entry.updatedAt)}`;
      button.appendChild(details);
      button.disabled = Boolean(markCurrent && entry.id === currentProjectId);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await select(entry.id);
        } catch (error) {
          button.disabled = false;
          reportProjectOperationError(error);
        }
      });
      list.appendChild(button);
    }
    fileAppMenuPanel.appendChild(list);
  }

  function showDeleteProjectPanel() {
    showFileAppMenuPanel('Удалить проект');
    const copy = document.createElement('p');
    copy.className = 'project-delete-copy';
    copy.textContent = projectCatalog.length === 1
      ? `Удалить «${currentProjectName}»? Вместо него будет создан новый пустой проект.`
      : `Удалить «${currentProjectName}»? Это действие нельзя отменить.`;
    fileAppMenuPanel.appendChild(copy);

    const actions = document.createElement('div');
    actions.className = 'app-menu-form-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Нет';
    cancel.addEventListener('click', resetFileAppMenu);
    actions.appendChild(cancel);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'app-menu-danger';
    remove.textContent = 'Да, удалить';
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        await deleteCurrentProject();
        hideFileAppMenu();
      } catch (error) {
        remove.disabled = false;
        reportProjectOperationError(error);
      }
    });
    actions.appendChild(remove);
    fileAppMenuPanel.appendChild(actions);
  }

  function showFileAppMenuPanel(title) {
    fileAppMenuMain.hidden = true;
    fileAppMenuPanel.hidden = false;
    fileAppMenuPanel.replaceChildren();
    const header = document.createElement('div');
    header.className = 'app-menu-panel-header';
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '‹';
    back.title = 'Назад';
    back.setAttribute('aria-label', 'Назад');
    back.addEventListener('click', resetFileAppMenu);
    header.appendChild(back);
    const heading = document.createElement('strong');
    heading.textContent = title;
    header.appendChild(heading);
    fileAppMenuPanel.appendChild(header);
  }

  function formatProjectDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'недавно';
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function reportProjectOperationError(error) {
    setStatus('Операция с проектом не выполнена', true);
    appendOutput(formatThrownError(error), 'output-error');
  }

  function toggleEditAppMenu() {
    editAppMenu.hidden ? showEditAppMenu() : hideEditAppMenu();
  }

  function showEditAppMenu() {
    hideFileAppMenu();
    hideUploadMenu();
    hideThemeMenu();
    hideColorPickerMenu();
    hideFileContextMenu();
    updateEditMenuAvailability();
    editAppMenu.hidden = false;
    editAppMenuButton.setAttribute('aria-expanded', 'true');
  }

  function hideEditAppMenu() {
    if (!editAppMenu) return;
    editAppMenu.hidden = true;
    editAppMenuButton.setAttribute('aria-expanded', 'false');
  }

  function updateEditMenuAvailability() {
    const item = files.get(currentFile);
    const textFile = Boolean(item && item.kind === 'text');
    const model = monacoReady && monacoEditor ? monacoEditor.getModel() : null;
    for (const button of editAppMenu.querySelectorAll('[data-edit-command]')) {
      const command = button.dataset.editCommand;
      if (!textFile) {
        button.disabled = true;
      } else if (command === 'undo') {
        button.disabled = Boolean(model && !model.canUndo());
      } else if (command === 'redo') {
        button.disabled = Boolean(model && !model.canRedo());
      } else {
        button.disabled = false;
      }
    }
  }

  function handleEditAppMenuClick(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-edit-command]');
    if (!button || button.disabled) return;
    const command = button.dataset.editCommand;
    hideEditAppMenu();
    runEditorCommand(command);
  }

  function runEditorCommand(command) {
    if (monacoReady && monacoEditor) {
      const commands = {
        undo: 'undo',
        redo: 'redo',
        cut: 'editor.action.clipboardCutAction',
        copy: 'editor.action.clipboardCopyAction',
        paste: 'editor.action.clipboardPasteAction',
        find: 'actions.find',
        replace: 'editor.action.startFindReplaceAction',
        comment: 'editor.action.addCommentLine',
        uncomment: 'editor.action.removeCommentLine',
      };
      const editorCommand = commands[command];
      if (!editorCommand) return;
      monacoEditor.focus();
      monacoEditor.trigger('menu', editorCommand, null);
      return;
    }

    editor.focus();
    if (command === 'comment' || command === 'uncomment') {
      editLegacyComment(command === 'comment');
      return;
    }
    const legacyCommands = { undo: 'undo', redo: 'redo', cut: 'cut', copy: 'copy', paste: 'paste' };
    if (legacyCommands[command]) document.execCommand(legacyCommands[command]);
  }

  function editLegacyComment(addComment) {
    const source = editor.value;
    const start = source.lastIndexOf('\n', Math.max(0, editor.selectionStart - 1)) + 1;
    const nextLine = source.indexOf('\n', editor.selectionEnd);
    const end = nextLine === -1 ? source.length : nextLine;
    const replacement = source.slice(start, end).split('\n').map((line) => {
      if (addComment) return line.replace(/^(\s*)/u, '$1// ');
      return line.replace(/^(\s*)\/\/ ?/u, '$1');
    }).join('\n');
    editor.setRangeText(replacement, start, end, 'select');
    handleEditorInput();
  }

  function applySavedTheme() {
    const theme = window.localStorage.getItem('idyllium-web-theme') || 'dark';
    setTheme(theme === 'light' ? 'light' : 'dark');
  }

  function toggleThemeMenu() {
    themeMenu.hidden ? showThemeMenu() : hideThemeMenu();
  }

  function showThemeMenu() {
    hideFileAppMenu();
    hideEditAppMenu();
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
    hideFileAppMenu();
    hideEditAppMenu();
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
      || name.endsWith('.md')
      || name.endsWith('.markdown')
      || name.endsWith('.xml')
      || name.endsWith('.html')
      || name.endsWith('.htm')
      || name.endsWith('.css');
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
    if (name.endsWith('.idyl')) return 'text/x-idyllium';
    if (name.endsWith('.txt')) return 'text/plain';
    if (name.endsWith('.csv')) return 'text/csv';
    if (name.endsWith('.json')) return 'application/json';
    if (name.endsWith('.md') || name.endsWith('.markdown')) return 'text/markdown';
    if (name.endsWith('.xml')) return 'application/xml';
    if (name.endsWith('.html') || name.endsWith('.htm')) return 'text/html';
    if (name.endsWith('.css')) return 'text/css';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.svg')) return 'image/svg+xml';
    if (name.endsWith('.ttf')) return 'font/ttf';
    if (name.endsWith('.otf')) return 'font/otf';
    if (name.endsWith('.woff')) return 'font/woff';
    if (name.endsWith('.woff2')) return 'font/woff2';
    if (name.endsWith('.mp3')) return 'audio/mpeg';
    if (name.endsWith('.wav')) return 'audio/wav';
    if (name.endsWith('.ogg')) return 'audio/ogg';
    if (name.endsWith('.aac')) return 'audio/aac';
    if (name.endsWith('.m4a')) return 'audio/mp4';
    if (isSqliteFile(name)) return 'application/vnd.sqlite3';
    return 'application/octet-stream';
  }

  function detectAssetMimeType(fileName, bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return mimeTypeForFile(fileName);
    if (asciiBytes(bytes, 0, 16) === 'SQLite format 3\0') return 'application/vnd.sqlite3';
    if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) return 'image/png';
    if (hasBytes(bytes, [0xff, 0xd8, 0xff], 0)) return 'image/jpeg';
    const header6 = asciiBytes(bytes, 0, 6);
    if (header6 === 'GIF87a' || header6 === 'GIF89a') return 'image/gif';
    if (asciiBytes(bytes, 0, 4) === 'RIFF' && asciiBytes(bytes, 8, 4) === 'WEBP') return 'image/webp';
    if (asciiBytes(bytes, 0, 4) === 'RIFF' && asciiBytes(bytes, 8, 4) === 'WAVE') return 'audio/wav';
    if (hasBytes(bytes, [0x49, 0x44, 0x33], 0) || mp3FrameHeader(bytes)) return 'audio/mpeg';
    if (asciiBytes(bytes, 0, 4) === 'OggS') return 'audio/ogg';
    if (aacHeader(bytes)) return 'audio/aac';
    if (asciiBytes(bytes, 4, 4) === 'ftyp') return 'audio/mp4';
    if (hasBytes(bytes, [0x00, 0x01, 0x00, 0x00], 0) || asciiBytes(bytes, 0, 4) === 'true') return 'font/ttf';
    if (asciiBytes(bytes, 0, 4) === 'OTTO') return 'font/otf';
    if (asciiBytes(bytes, 0, 4) === 'wOFF') return 'font/woff';
    if (asciiBytes(bytes, 0, 4) === 'wOF2') return 'font/woff2';
    if (looksLikeSvg(bytes)) return 'image/svg+xml';
    return mimeTypeForFile(fileName);
  }

  function isSqliteFile(fileName) {
    return /\.(?:db|db3|sqlite|sqlite3)$/iu.test(fileName);
  }

  function fontFormatName(mime) {
    if (mime === 'font/ttf') return 'TTF';
    if (mime === 'font/otf') return 'OTF';
    if (mime === 'font/woff') return 'WOFF';
    if (mime === 'font/woff2') return 'WOFF2';
    return 'неизвестно';
  }

  function mp3FrameHeader(bytes) {
    return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  }

  function aacHeader(bytes) {
    return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
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

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return 'неизвестно';
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
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
