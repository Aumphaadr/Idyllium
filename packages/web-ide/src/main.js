// Ядро Web IDE: состояние, редакторы, дерево проекта, запуск программ.
// Исторически файл жил одним IIFE, поэтому тело пока с отступом в два
// пробела; темы постепенно выезжают в соседние модули src/*.js.
// Собирается esbuild-ом в classic-скрипт app.js (tools/build-web-ide.js).

import { WORKSPACE_ROOT, MAIN_FILE, normalizeWorkspacePath, shortFileName, basename, parentPath, itemName, studentPath, formatThrownError, formatDiagnosticText } from './workspace-paths.js';
import { KEYWORDS, BUILTIN_TYPES, CLASS_NAMES, QUALIFIED_TYPES, highlightIdyllium, escapeHtml } from './idyllium-highlight.js';
import { zipBytes, unzipEntries } from './zip.js';
import { appendAnsiText } from './ansi.js';
import { bytesToDataUrl, bytesToDataUrlWithMime, mimeTypeForFile, detectAssetMimeType, isSqliteFile, fontFormatName, imageAlphaInfo, formatBytes, formatDuration, dataUrlBytes, assetBytes } from './binary-format.js';
import { files } from './project-store.js';
import { clamp } from './num-util.js';
import { registerViewerHost } from './viewer-host.js';
import { renderCsvTable, renderJsonTree, renderMarkdownPreview, csvHeaderModes, structuredViewModes, isCsvFile, isJsonFile, isMarkdownFile, isSvgFile, structuredViewMode } from './viewer-structured.js';
import { showAssetViewer, releaseAssetViewerResources, invalidateAssetPreview } from './viewer-assets.js';
import { setupColorEyedropper } from './color-eyedropper.js';
import { setOutputText, appendOutput, setStatus } from './console-output.js';
import { MONACO_LANGUAGE_ID, registerMonacoIdyllium, defineMonacoThemes, monacoCompletionRequest, projectCompletions, projectSignatureHelp, projectSemanticTokens, encodeMonacoSemanticTokens, deduplicateCompletions, SEMANTIC_TOKEN_TYPES, SEMANTIC_TOKEN_MODIFIERS } from './monaco-lang.js';
import { runProgram, stopProgram, stopGuiLoop, markGuiFrameReady, enqueueGuiEvent, postEmptySnapshot, previewTargetOrigin, updateRunButton, setRunControls, submitConsoleInput, syncRuntimeFilesFromSnapshot, revokeAllBrowserAssetUrls, currentRuntime, formatCurrentFile, textSourceMap, registerRunHost, browserAssetUrls } from './run-preview.js';
import { monacoHost, assetViewer, csvViewer, jsonViewer, markdownViewer, legacyEditor, editor, highlight, lineNumbers, completionPopup, editorTitle, fileList, output, consoleInputPanel, consoleInput, consoleInputSubmit, status, guiFrame, workspace, runtimePane, runtimeRowResizer, runButton, stopButton, formatButton, structuredViewToggle, structuredTextViewButton, structuredDataViewButton, newFileButton, newFolderButton, fileContextMenu, filePropsModal, uploadButton, uploadMenu, dropArea, uploadInput, uploadConflict, uploadConflictName, uploadConflictSkip, uploadConflictReplace, themeButton, themeMenu, themeDarkButton, themeLightButton, fontSizeDecrease, fontSizeIncrease, fontSizeInput, consoleFontSizeDecrease, consoleFontSizeIncrease, consoleFontSizeInput, colorPickerButton, colorPickerMenu, fileAppMenuWrapper, fileAppMenuButton, fileAppMenu, fileAppMenuMain, fileAppMenuPanel, currentProjectNameElement, editAppMenuWrapper, editAppMenuButton, editAppMenu, colorPreview, colorRgbCode, colorHexCode, colorSliders, colorInputs, createIcon } from './dom.js';

  const DEFAULT_EDITOR_FONT_SIZE = 16;
  const DEFAULT_CONSOLE_FONT_SIZE = 13;
  const MIN_FONT_SIZE = 10;
  const MAX_FONT_SIZE = 32;
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
  const WEB_IDE_BASE_URL = detectWebIdeBaseUrl();
  const COLOR_PICKER_CHANNELS = ['red', 'green', 'blue', 'alpha'];
  const folders = new Set([WORKSPACE_ROOT]);
  const expandedFolders = new Set([WORKSPACE_ROOT]);

  let currentFile = MAIN_FILE;
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
  let fileEditState = null;
  // Внутренний drag-n-drop дерева файлов: что тащим (пути мира workspace).
  let internalDragPath = null;
  let internalDragType = 'file';
  let colorPickerState = { red: 34, green: 145, blue: 188, alpha: 1 };
  let currentProjectId = '';
  let currentProjectName = DEFAULT_PROJECT_NAME;
  let projectCatalog = [];
  let projectWriteQueue = Promise.resolve();
  let pendingUploadConflictResolve = null;
  const colorCopyTimers = new WeakMap();
  registerViewerHost({ openFile, currentFile: () => currentFile });
  registerRunHost({
    saveCurrentEditor,
    hideCompletions,
    getEditorValue,
    setEditorValue,
    isEditorReadOnly,
    updateEditorVisuals,
    editorReady: () => editorReady,
    scheduleAutosave,
    renderFiles,
    addProjectFolder,
    setProjectFile,
    removeProjectItem,
    fallbackFilePath,
    // Рантайм удалил текущий файл: перескочить на живой и сбросить редактор.
    resetToFallbackFile: () => {
      currentFile = fallbackFilePath();
      editorReady = false;
      openFile(currentFile);
    },
    applyPreviewTheme,
    folders,
  });
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
  filePropsModal.addEventListener('click', (event) => {
    if (event.target === filePropsModal) hideFileProperties();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!runButton.disabled) runProgram();
      return;
    }
    if (event.key === 'Escape') {
      hideFileProperties();
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
    if (previewTargetOrigin !== '*' && event.origin !== previewTargetOrigin) return;
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
      // Машинный code и source в маркер НЕ кладём: Monaco приклеивает их к
      // тексту хинта одной строкой («…falseIdyllium(unused-variable)»), а
      // показ кодов людям ждёт отдельного вердикта владельца (2026-08-29).
      // Инструментам коды доступны через structured diagnostics компилятора.
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

    // Внутренний перенос: строку можно утащить в папку или на пустое место
    // списка (в корень). Внешние броски файлов с компьютера это не трогает.
    row.draggable = true;
    row.addEventListener('dragstart', (event) => {
      internalDragPath = node.path;
      internalDragType = node.type === 'folder' ? 'folder' : 'file';
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', node.name);
      }
    });
    row.addEventListener('dragend', () => {
      internalDragPath = null;
      clearMoveTargetHighlight();
    });
    if (node.type === 'folder') {
      row.addEventListener('dragover', (event) => {
        if (!internalDragPath || internalDragPath === node.path) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-target');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-target');
      });
      row.addEventListener('drop', (event) => {
        if (!internalDragPath) return;
        event.preventDefault();
        event.stopPropagation();
        const dragged = internalDragPath;
        const draggedType = internalDragType;
        internalDragPath = null;
        clearMoveTargetHighlight();
        moveProjectItemTo(dragged, draggedType, node.path);
      });
    }

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
      } else if (isSvgFile(file) && (structuredViewModes.get(file) || 'image') === 'image') {
        // SVG по умолчанию открывается КАРТИНКОЙ (кнопка «Код» вернёт исходник):
        // черепашьи узоры и любые svg-файлы хочется сначала увидеть.
        showSvgImagePreview(file, item.content || '');
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
    updateRunButton();
    updateStructuredViewToggle();
    renderFiles();
    scheduleAutosave();
  }

  function showTextEditor() {
    invalidateAssetPreview();
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

  function showSvgImagePreview(file, source) {
    const bytes = new TextEncoder().encode(source);
    showAssetViewer(file, { kind: 'asset', content: '', bytes });
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
      else if (structuredMode === 'image') showSvgImagePreview(currentFile, item.content || '');
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
    // SVG по умолчанию открыт картинкой — переключатель должен это показывать.
    const defaultMode = structuredMode === 'image' ? 'image' : 'text';
    const mode = available ? structuredViewModes.get(currentFile) || defaultMode : 'text';
    const formatName = isCsvFile(currentFile)
      ? 'CSV'
      : isJsonFile(currentFile)
        ? 'JSON'
        : isSvgFile(currentFile)
          ? 'SVG'
          : 'Markdown';

    structuredViewToggle.hidden = !available;
    structuredViewToggle.setAttribute('aria-label', `Режим просмотра ${formatName}`);
    structuredDataViewButton.textContent = structuredMode === 'table'
      ? 'Таблица'
      : structuredMode === 'tree'
        ? 'Дерево'
        : structuredMode === 'image'
          ? 'Картинка'
          : 'Просмотр';
    structuredTextViewButton.classList.toggle('active', mode === 'text');
    structuredDataViewButton.classList.toggle('active', mode === structuredMode);
    structuredTextViewButton.setAttribute('aria-pressed', String(mode === 'text'));
    structuredDataViewButton.setAttribute('aria-pressed', String(mode === structuredMode));
  }

  function showCsvTable(file, source) {
    invalidateAssetPreview();
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

  function showJsonTree(file, source) {
    invalidateAssetPreview();
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

  function showMarkdownPreview(file, source) {
    invalidateAssetPreview();
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

  function renameProjectItem(path, type, newPath, doneMessage) {
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
      setStatus(doneMessage || 'Файл переименован');
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
    setStatus(doneMessage || 'Папка переименована');
    scheduleAutosave();
  }

  // Перенос строки дерева в папку (или в корень) внутренним drag-n-drop.
  function moveProjectItemTo(sourcePath, type, targetFolder) {
    sourcePath = normalizeWorkspacePath(sourcePath);
    targetFolder = normalizeWorkspacePath(targetFolder);
    if (targetFolder !== WORKSPACE_ROOT && !folders.has(targetFolder)) {
      setStatus('Папка не найдена', true);
      return;
    }
    if (parentPath(sourcePath) === targetFolder) return;
    if (type === 'folder' && (targetFolder === sourcePath || targetFolder.startsWith(sourcePath + '/'))) {
      setStatus('Нельзя переместить папку внутрь самой себя', true);
      return;
    }
    expandedFolders.add(targetFolder);
    renameProjectItem(
      sourcePath,
      type,
      targetFolder + '/' + itemName(sourcePath),
      type === 'folder' ? 'Папка перемещена' : 'Файл перемещён',
    );
  }

  function clearMoveTargetHighlight() {
    for (const element of fileList.querySelectorAll('.drag-target')) {
      element.classList.remove('drag-target');
    }
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
          ['Свойства', () => showFileProperties(WORKSPACE_ROOT, 'folder')],
        ]
      : node.type === 'folder'
      ? [
          ['Новый файл', () => startCreateItemInline('file', node.path)],
          ['Новая папка', () => startCreateItemInline('folder', node.path)],
          ['Переименовать', () => startRenameItemInline(node.path, 'folder')],
          ['Дублировать', () => startDuplicateItemInline(node.path, 'folder')],
          ['Копировать имя', () => copyProjectItemText(itemName(node.path), 'Имя скопировано')],
          ['Копировать путь', () => copyProjectItemText(studentPath(node.path), 'Путь скопирован')],
          ['Свойства', () => showFileProperties(node.path, 'folder')],
          ['Удалить', () => openDeleteConfirm(node.path, 'folder', left, top)],
        ]
      : [
          ['Переименовать', () => startRenameItemInline(node.path, 'file')],
          ['Дублировать', () => startDuplicateItemInline(node.path, 'file')],
          ['Скачать', () => downloadProjectFile(node.path)],
          ['Копировать имя', () => copyProjectItemText(itemName(node.path), 'Имя скопировано')],
          ['Копировать путь', () => copyProjectItemText(studentPath(node.path), 'Путь скопирован')],
          ['Свойства', () => showFileProperties(node.path, 'file')],
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

  function copyProjectItemText(text, doneMessage) {
    const fallbackCopy = () => {
      const scratch = document.createElement('textarea');
      scratch.value = text;
      scratch.style.position = 'fixed';
      scratch.style.opacity = '0';
      document.body.appendChild(scratch);
      scratch.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
      scratch.remove();
      setStatus(copied ? doneMessage : 'Не удалось скопировать', !copied);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => setStatus(doneMessage), fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  // ── «Свойства» файла и папки ──────────────────────────────────────────

  function fileItemByteSize(item) {
    if (!item) return null;
    if (item.bytes instanceof Uint8Array) return item.bytes.length;
    if (typeof item.content === 'string') return new TextEncoder().encode(item.content).length;
    return null;
  }

  function formatByteSize(size) {
    if (size === null) return 'неизвестно';
    if (size < 1024) return `${size} Б`;
    const units = [['КБ', 1024], ['МБ', 1024 * 1024], ['ГБ', 1024 * 1024 * 1024]];
    for (let i = units.length - 1; i >= 0; i -= 1) {
      if (size >= units[i][1]) {
        const value = size / units[i][1];
        return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace('.', ',')} ${units[i][0]} (${size.toLocaleString('ru-RU')} Б)`;
      }
    }
    return `${size} Б`;
  }

  const FILE_EXTENSION_TYPES = {
    idyl: 'программа Idyllium',
    txt: 'текстовый файл',
    md: 'текст с разметкой (Markdown)',
    html: 'веб-страница (HTML)',
    css: 'таблица стилей (CSS)',
    js: 'скрипт JavaScript',
    json: 'данные JSON',
    csv: 'таблица (CSV)',
    svg: 'векторная картинка (SVG)',
    png: 'картинка (PNG)',
    jpg: 'картинка (JPEG)',
    jpeg: 'картинка (JPEG)',
    gif: 'картинка (GIF)',
    webp: 'картинка (WebP)',
    bmp: 'картинка (BMP)',
    ico: 'значок (ICO)',
    wav: 'звук (WAV)',
    mp3: 'звук (MP3)',
    ogg: 'звук (OGG)',
    ttf: 'шрифт (TTF)',
    otf: 'шрифт (OTF)',
    woff: 'шрифт (WOFF)',
    woff2: 'шрифт (WOFF2)',
    db: 'база данных SQLite',
    sqlite: 'база данных SQLite',
    zip: 'архив ZIP',
    pdf: 'документ PDF',
  };

  function extensionTypeLabel(name) {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return 'без расширения';
    const extension = name.slice(dot + 1).toLowerCase();
    return FILE_EXTENSION_TYPES[extension] || `неизвестное расширение «.${extension}»`;
  }

  // Двоичные файлы проекта живут с kind 'asset' и телом в bytes;
  // всё остальное — текст (никакого kind 'binary' в IDE нет).
  function isBinaryFileItem(item) {
    return Boolean(item) && item.bytes instanceof Uint8Array;
  }

  // «Истинный тип» — по содержимому: магические байты для двоичных файлов,
  // текст — как есть. Ученик видит, когда расширение врёт.
  function sniffContentType(item) {
    if (!item) return 'неизвестно';
    if (!isBinaryFileItem(item)) {
      const content = item.content || '';
      if (/^\s*<svg[\s>]/iu.test(content)) return 'векторная картинка (SVG)';
      return 'текст (UTF-8)';
    }
    const bytes = item.bytes;
    if (bytes.length === 0) return 'двоичные данные';
    const ascii = (start, text) => {
      for (let i = 0; i < text.length; i += 1) {
        if (bytes[start + i] !== text.charCodeAt(i)) return false;
      }
      return true;
    };
    if (bytes[0] === 0x89 && ascii(1, 'PNG')) return 'картинка (PNG)';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'картинка (JPEG)';
    if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'картинка (GIF)';
    if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'картинка (WebP)';
    if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'звук (WAV)';
    if (ascii(0, 'BM')) return 'картинка (BMP)';
    if (ascii(0, 'OggS')) return 'звук (OGG)';
    if (ascii(0, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'звук (MP3)';
    if (ascii(0, 'SQLite format 3')) return 'база данных SQLite';
    if (ascii(0, 'PK') && bytes[2] === 3 && bytes[3] === 4) return 'архив ZIP';
    if (ascii(0, '%PDF')) return 'документ PDF';
    if (ascii(0, 'OTTO')) return 'шрифт (OTF)';
    if (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return 'шрифт (TTF)';
    if (ascii(0, 'wOFF')) return 'шрифт (WOFF)';
    if (ascii(0, 'wOF2')) return 'шрифт (WOFF2)';
    if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'значок (ICO)';
    return 'двоичные данные';
  }

  // Расширения текстового жанра: текст внутри них — норма, не тревога.
  const TEXTUAL_EXTENSIONS = new Set(['idyl', 'txt', 'md', 'html', 'css', 'js', 'json', 'csv', 'svg']);

  // Предупреждение «файл выглядит не тем, чем назван»: текст в CSS — норма,
  // текст в «картинке (JPEG)» и PNG-байты под именем .jpeg — тревога.
  function filePropsMismatchNote(path, item) {
    const name = itemName(path);
    const extensionLabel = extensionTypeLabel(name);
    if (extensionLabel === 'без расширения' || extensionLabel.startsWith('неизвестное')) return null;
    const contentLabel = sniffContentType(item);
    if (!isBinaryFileItem(item)) {
      const dot = name.lastIndexOf('.');
      const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
      if (TEXTUAL_EXTENSIONS.has(extension)) return null;
    } else if (extensionLabel === contentLabel) {
      return null;
    }
    return `Расширение обещает «${extensionLabel}», а внутри — «${contentLabel}»: файл выглядит не тем, чем назван.`;
  }

  function folderSummary(path) {
    const prefix = path === WORKSPACE_ROOT ? WORKSPACE_ROOT + '/' : path + '/';
    let fileCount = 0;
    let totalSize = 0;
    let sizeKnown = true;
    for (const [file, item] of files.entries()) {
      if (!file.startsWith(prefix)) continue;
      fileCount += 1;
      const size = fileItemByteSize(item);
      if (size === null) sizeKnown = false;
      else totalSize += size;
    }
    let folderCount = 0;
    for (const folder of folders) {
      if (folder.startsWith(prefix)) folderCount += 1;
    }
    return { fileCount, folderCount, totalSize: sizeKnown ? totalSize : null };
  }

  function showFileProperties(path, type) {
    path = normalizeWorkspacePath(path);
    const rows = [];
    let title = itemName(path);
    if (type === 'file') {
      const item = files.get(path);
      if (!item) {
        setStatus('Файл не найден', true);
        return;
      }
      rows.push(['Имя', itemName(path)]);
      rows.push(['Путь', studentPath(path)]);
      rows.push(['Размер', formatByteSize(fileItemByteSize(item))]);
      rows.push(['Тип по расширению', extensionTypeLabel(itemName(path))]);
      rows.push(['Истинный тип', sniffContentType(item)]);
      if (!isBinaryFileItem(item) && typeof item.content === 'string') {
        rows.push(['Строк', String(item.content === '' ? 0 : item.content.split('\n').length)]);
        rows.push(['Символов', String(Array.from(item.content).length)]);
      }
    } else {
      const isRoot = path === WORKSPACE_ROOT;
      title = isRoot ? 'Проект' : itemName(path);
      const summary = folderSummary(path);
      rows.push(['Имя', isRoot ? 'проект (корень)' : itemName(path)]);
      if (!isRoot) rows.push(['Путь', studentPath(path)]);
      rows.push(['Файлов внутри', String(summary.fileCount)]);
      rows.push(['Папок внутри', String(summary.folderCount)]);
      rows.push(['Суммарный размер', formatByteSize(summary.totalSize)]);
    }

    filePropsModal.replaceChildren();
    const card = document.createElement('div');
    card.className = 'file-props-card';

    const heading = document.createElement('h3');
    heading.className = 'file-props-title';
    heading.textContent = title;
    card.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'file-props-table';
    for (const [label, value] of rows) {
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = label;
      const valueCell = document.createElement('td');
      valueCell.textContent = value;
      row.append(labelCell, valueCell);
      table.appendChild(row);
    }
    card.appendChild(table);

    if (type === 'file') {
      const mismatch = filePropsMismatchNote(path, files.get(path));
      if (mismatch) {
        const note = document.createElement('p');
        note.className = 'file-props-note';
        note.textContent = mismatch;
        card.appendChild(note);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'file-props-actions';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Закрыть';
    close.addEventListener('click', hideFileProperties);
    actions.appendChild(close);
    card.appendChild(actions);

    filePropsModal.appendChild(card);
    filePropsModal.hidden = false;
    close.focus();
  }

  function hideFileProperties() {
    filePropsModal.hidden = true;
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

  // Снимок entries обязан случиться СИНХРОННО в обработчике drop —
  // после первого await браузер отзывает DataTransferItem.
  function snapshotDroppedEntries(dataTransfer) {
    const items = dataTransfer && dataTransfer.items;
    if (!items) return null;
    const entries = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry) entries.push(entry);
    }
    return entries.length > 0 ? entries : null;
  }

  // Бросили папку с компьютера — обходим её целиком и переносим дерево
  // в проект как есть; плоский бросок файлов идёт прежним путём.
  async function loadDroppedTransfer(entries, plainFiles) {
    if (!entries || !entries.some((entry) => entry.isDirectory)) {
      await loadDroppedFiles(plainFiles);
      return;
    }

    const collected = [];
    const folderPaths = [];
    const walk = async (entry, prefix) => {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        collected.push({ file, path: prefix + file.name });
        return;
      }
      if (!entry.isDirectory) return;
      const folderPath = prefix + entry.name;
      folderPaths.push(folderPath);
      const reader = entry.createReader();
      // readEntries отдаёт пачками (обычно по 100) — читаем до пустой.
      while (true) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child, folderPath + '/');
      }
    };
    for (const entry of entries) await walk(entry, '');

    saveCurrentEditor();
    for (const folderPath of folderPaths) {
      const normalized = normalizeWorkspacePath(folderPath);
      addProjectFolder(normalized);
      expandedFolders.add(normalized);
    }
    let lastPath = null;
    let loadedCurrentFile = false;
    let loadedCount = 0;
    let skippedCount = 0;
    for (const item of collected) {
      const loadedPath = await loadExternalFile(item.file, item.path);
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
    else renderFiles();
    scheduleAutosave();
    const skippedText = skippedCount > 0 ? `, пропущено: ${skippedCount}` : '';
    setStatus(`Загружено файлов: ${loadedCount} (папок: ${folderPaths.length})${skippedText}`);
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

  async function loadExternalFile(file, explicitPath) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      // Провал импорта — словами в панель вывода, а не Uncaught в консоль
      // браузера (находка владельца 2026-08-29: закинул обычный ZIP и не
      // увидел в интерфейсе ничего).
      try {
        return importProjectZip(new Uint8Array(await file.arrayBuffer()));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendOutput(`ZIP «${file.name}» не импортирован: ${message}`, 'output-error');
        setStatus(`ZIP не импортирован`, true);
        return null;
      }
    }

    const path = normalizeWorkspacePath(explicitPath || file.webkitRelativePath || file.name);
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

  // ─── Сервер-репетиция: мост web.Server → SW-песочница ────────────────────
  // Ученический web.Server в браузере слушает не порт, а Service Worker:
  // тот перехватывает <scope>preview/<порт>/... и спрашивает ответ у этой
  // вкладки. Сайт ученика видит только этот браузер — это репетиция.
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

  function downloadProjectFile(path) {
    path = normalizeWorkspacePath(path);
    if (path === currentFile) saveCurrentEditor();

    const item = files.get(path);
    if (!item) {
      setStatus('Файл не найден', true);
      return;
    }

    const bytes = item.kind === 'asset'
      ? assetBytes(item)
      : new TextEncoder().encode(item.content || '');
    const mime = item.kind === 'asset'
      ? detectAssetMimeType(path, bytes)
      : `${mimeTypeForFile(path)};charset=utf-8`;
    downloadBlob(new Blob([bytes], { type: mime }), basename(path));
    setStatus('Файл скачан');
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
    downloadBlob(blob, `${safeDownloadName(name)}.zip`);
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
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
    const entries = unzipEntries(bytes);
    if (entries.length === 0) throw new Error('ZIP-архив не содержит файлов');

    saveCurrentEditor();
    // Полная тихая остановка вместо ручного гашения пары полей: импорт
    // проекта обязан отпустить и цикл кадров, и контроллер прерывания.
    stopProgram(true);
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
            '    console.write("Hello, World!", \'\\n\');',
            '}',
          ].join('\n'),
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
      const entries = snapshotDroppedEntries(event.dataTransfer);
      loadDroppedTransfer(entries, event.dataTransfer && event.dataTransfer.files);
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
      const entries = snapshotDroppedEntries(event.dataTransfer);
      loadDroppedTransfer(entries, event.dataTransfer && event.dataTransfer.files);
    });

    // Внутренний перенос: строку дерева можно утащить в папку (или на пустое
    // место списка — в корень). Механика пути — та же, что у переименования.
    fileList.addEventListener('dragover', (event) => {
      if (!internalDragPath) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });
    fileList.addEventListener('drop', (event) => {
      if (!internalDragPath) return;
      event.preventDefault();
      const dragged = internalDragPath;
      const draggedType = internalDragType;
      internalDragPath = null;
      clearMoveTargetHighlight();
      moveProjectItemTo(dragged, draggedType, WORKSPACE_ROOT);
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
    // Цепочки перед точкой (`sm[0].`, `f(...).`) разбирает языковой сервис —
    // здесь распознаём только контекст «точка + недописанное имя члена».
    const memberMatch = /[\p{L}\p{N}_\])"']\s*\.\s*([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)?$/u.exec(prefix);
    if (memberMatch) {
      const word = memberMatch[1] || '';
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

  function insertText(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(text, start, end, 'end');
    saveCurrentEditor();
    updateEditorVisuals();
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

    setupColorEyedropper((picked) => {
      colorPickerState = { ...colorPickerState, red: picked.red, green: picked.green, blue: picked.blue };
      updateColorPickerUi();
    });
  }

  // Пипетка: свой внутривкладочный механизм — без нативного EyeDropper
  // (на Linux/X11 тот захватывает экран покадрово: дикие тормоза, потерянный
  // пик). Клик ЛКМ берёт цвет пикселя страницы: у <img> и <canvas> — честный
  // пиксель через канву, у прочих элементов — фоновый цвет по computed style;
  // same-origin iframe (GUI-превью) прозрачен для пипетки. Esc/ПКМ — отмена.
  // Альфа не трогается. Работает во всех браузерах.
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
    }, previewTargetOrigin);
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
      || name.endsWith('.svg')
      || name.endsWith('.html')
      || name.endsWith('.htm')
      || name.endsWith('.css');
  }
