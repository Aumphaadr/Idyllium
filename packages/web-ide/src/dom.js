// Элементы страницы Web IDE — единожды найденные ссылки; жили в шапке
// main.js и исполняются в том же порядке (скрипт грузится после разметки).

export const monacoHost = document.getElementById('monaco-editor');
export const assetViewer = document.getElementById('asset-viewer');
export const csvViewer = document.getElementById('csv-viewer');
export const jsonViewer = document.getElementById('json-viewer');
export const markdownViewer = document.getElementById('markdown-viewer');
export const legacyEditor = document.getElementById('legacy-editor');
export const editor = document.getElementById('editor');
export const highlight = document.querySelector('#highlight code');
export const lineNumbers = document.getElementById('line-numbers');
export const completionPopup = document.getElementById('completion-popup');
export const editorTitle = document.getElementById('editor-title');
export const fileList = document.getElementById('file-list');
export const output = document.getElementById('output');
export const consoleInputPanel = document.getElementById('console-input-panel');
export const consoleInput = document.getElementById('console-input');
export const consoleInputSubmit = document.getElementById('console-input-submit');
export const status = document.getElementById('status');
export const guiFrame = document.getElementById('gui-frame');

export const workspace = document.querySelector('.workspace');
export const runtimePane = document.querySelector('.runtime-pane');
export const runtimeRowResizer = document.getElementById('runtime-row-resizer');
export const runButton = document.getElementById('run-button');
export const stopButton = document.getElementById('stop-button');
export const formatButton = document.getElementById('format-button');
export const structuredViewToggle = document.getElementById('structured-view-toggle');
export const structuredTextViewButton = document.getElementById('structured-text-view-button');
export const structuredDataViewButton = document.getElementById('structured-data-view-button');
export const newFileButton = document.getElementById('new-file-button');
export const newFolderButton = document.getElementById('new-folder-button');
export const fileContextMenu = document.getElementById('file-context-menu');
export const filePropsModal = document.getElementById('file-props-modal');
export const uploadButton = document.getElementById('upload-button');
export const uploadMenu = document.getElementById('upload-menu');
export const dropArea = document.getElementById('drop-area');
export const uploadInput = document.getElementById('upload-input');
export const uploadConflict = document.getElementById('upload-conflict');
export const uploadConflictName = document.getElementById('upload-conflict-name');
export const uploadConflictSkip = document.getElementById('upload-conflict-skip');
export const uploadConflictReplace = document.getElementById('upload-conflict-replace');
export const themeButton = document.getElementById('theme-button');
export const themeMenu = document.getElementById('theme-menu');
export const themeDarkButton = document.getElementById('theme-dark-button');
export const themeLightButton = document.getElementById('theme-light-button');
export const fontSizeDecrease = document.getElementById('font-size-decrease');
export const fontSizeIncrease = document.getElementById('font-size-increase');
export const fontSizeInput = document.getElementById('font-size-input');
export const consoleFontSizeDecrease = document.getElementById('console-font-size-decrease');
export const consoleFontSizeIncrease = document.getElementById('console-font-size-increase');
export const consoleFontSizeInput = document.getElementById('console-font-size-input');
export const autocompleteToggle = document.getElementById('autocomplete-toggle');
export const colorPickerButton = document.getElementById('color-picker-button');
export const colorPickerMenu = document.getElementById('color-picker-menu');
export const fileAppMenuWrapper = document.getElementById('file-app-menu-wrapper');
export const fileAppMenuButton = document.getElementById('file-app-menu-button');
export const fileAppMenu = document.getElementById('file-app-menu');
export const fileAppMenuMain = document.getElementById('file-app-menu-main');
export const fileAppMenuPanel = document.getElementById('file-app-menu-panel');
export const currentProjectNameElement = document.getElementById('current-project-name');
export const editAppMenuWrapper = document.getElementById('edit-app-menu-wrapper');
export const editAppMenuButton = document.getElementById('edit-app-menu-button');
export const editAppMenu = document.getElementById('edit-app-menu');
export const colorPreview = document.getElementById('color-preview');
export const colorRgbCode = document.getElementById('color-rgb-code');
export const colorHexCode = document.getElementById('color-hex-code');
export const colorSliders = {
  red: document.getElementById('color-red-slider'),
  green: document.getElementById('color-green-slider'),
  blue: document.getElementById('color-blue-slider'),
  alpha: document.getElementById('color-alpha-slider'),
};
export const colorInputs = {
  red: document.getElementById('color-red-input'),
  green: document.getElementById('color-green-input'),
  blue: document.getElementById('color-blue-input'),
  alpha: document.getElementById('color-alpha-input'),
};

// Фабрика SVG-значков интерфейса (дерево файлов, кнопки просмотрщиков).
export function createIcon(name) {
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
