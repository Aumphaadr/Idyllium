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
export const guestBanner = document.getElementById('guest-banner');
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
// Фабрика SVG-значков интерфейса (дерево файлов, кнопки просмотрщиков).
export function createIcon(name) {
  // Единый набор иконок сайта (1.6.3): window.IdylliumIcons из gui-renderer/icons.js.
  // Старые имена IDE → имена набора; без набора — пустой svg, чтобы вёрстка не поехала.
  const ICON_NAMES = {
    file: 'file', asset: 'file-image', database: 'file-database', folder: 'folder', 'folder-open': 'folder-open',
    'zoom-in': 'zoom-in', 'zoom-out': 'zoom-out', fit: 'fit', menu: 'more',
  };
  const icons = window.IdylliumIcons;
  const iconName = ICON_NAMES[name] || name;
  if (icons && icons.has(iconName)) return icons.element(iconName, { size: 16 });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}
