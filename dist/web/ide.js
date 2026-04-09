"use strict";
// src/web/ide.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
const index_1 = require("../index");
const editor_1 = require("./editor");
const terminal_1 = require("./terminal");
const browser_fs_1 = require("./fs/browser-fs");
const file_tree_1 = require("./fs/file-tree");
const tabs_1 = require("./fs/tabs");
let editor = null;
let terminal = null;
let fs = null;
let fileTree = null;
let tabs = null;
let currentFilePath = null;
let isRunning = false;
let abortController = null;
function init() {
    const fileTreeContainer = document.getElementById('file-tree');
    const tabsContainer = document.getElementById('tabs-container');
    const editorContainer = document.getElementById('editor-container');
    const terminalContainer = document.getElementById('terminal-body');
    if (!fileTreeContainer || !tabsContainer || !editorContainer || !terminalContainer) {
        console.error('Required containers not found');
        return;
    }
    fs = new browser_fs_1.BrowserFS();
    fileTree = new file_tree_1.FileTree(fileTreeContainer, fs, {
        onFileSelect: handleFileSelect,
        onFileCreate: handleFileCreate,
        onFileDelete: handleFileDelete,
        onFileRename: handleFileRename,
        onUpload: handleUploadFiles,
        onDownload: handleDownloadProject,
    });
    tabs = new tabs_1.Tabs(tabsContainer, {
        onTabSelect: handleTabSelect,
        onTabClose: handleTabClose,
    });
    editor = new editor_1.Editor(editorContainer, {
        initialValue: '',
        tabSize: 4,
        fontSize: 15,
    });
    setupEditorChangeListener();
    terminal = new terminal_1.Terminal(terminalContainer);
    terminal.printSystem('Idyllium IDE готова к работе.\n', 'info');
    terminal.printSystem('Выберите файл для редактирования или создайте новый.\n\n', 'info');
    document.getElementById('btn-run')?.addEventListener('click', handleRun);
    document.getElementById('btn-stop')?.addEventListener('click', handleStop);
    document.getElementById('btn-save')?.addEventListener('click', handleSave);
    document.getElementById('btn-collapse-sidebar')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const expandBtn = document.getElementById('btn-expand-sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
        }
        if (expandBtn) {
            expandBtn.classList.add('visible');
        }
    });
    document.getElementById('btn-docs')?.addEventListener('click', () => {
        window.open('lessons/docs.html', '_blank');
    });
    document.getElementById('btn-expand-sidebar')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const expandBtn = document.getElementById('btn-expand-sidebar');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
        }
        if (expandBtn) {
            expandBtn.classList.remove('visible');
        }
    });
    document.getElementById('btn-clear-output')?.addEventListener('click', () => {
        terminal?.clear();
    });
    document.getElementById('btn-close-gui')?.addEventListener('click', () => {
        const guiPanel = document.getElementById('gui-panel');
        const guiOutput = document.getElementById('gui-output');
        const guiResizer = document.getElementById('resizer-gui-terminal');
        if (guiPanel)
            guiPanel.style.display = 'none';
        if (guiOutput)
            guiOutput.innerHTML = '';
        if (guiResizer)
            guiResizer.style.display = 'none';
    });
    const formatBtn = document.getElementById('btn-format');
    if (formatBtn) {
        formatBtn.addEventListener('click', () => {
            if (editor) {
                editor.formatCode();
                terminal?.printSystem('✨ Код отформатирован\n', 'success');
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            if (editor) {
                editor.formatCode();
                terminal?.printSystem('✨ Код отформатирован\n', 'success');
            }
        }
    });
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleSave();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleRun();
            return;
        }
    }, { capture: true });
    document.getElementById('btn-close-gui')?.addEventListener('click', () => {
        const guiPanel = document.getElementById('gui-panel');
        if (guiPanel) {
            guiPanel.style.display = 'none';
            const guiOutput = document.getElementById('gui-output');
            if (guiOutput) {
                guiOutput.innerHTML = '';
            }
        }
    });
    window.addEventListener('beforeunload', (e) => {
        if (tabs?.hasModified()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    initResizers();
    initGuiTerminalResizer();
    if (fs.exists('/main.idyl')) {
        handleFileSelect('/main.idyl');
    }
}
function setupEditorChangeListener() {
    if (!editor)
        return;
    const textarea = document.querySelector('.editor-textarea');
    if (textarea) {
        let lastValue = textarea.value;
        textarea.addEventListener('input', () => {
            if (currentFilePath && tabs) {
                const currentContent = fs?.readFile(currentFilePath) ?? '';
                const isModified = textarea.value !== currentContent;
                tabs.setModified(currentFilePath, isModified);
            }
        });
    }
}
function handleFileSelect(path) {
    if (!fs || !editor || !tabs)
        return;
    saveCurrentFileIfNeeded();
    tabs.openTab(path);
    const content = fs.readFile(path);
    if (content !== null) {
        currentFilePath = path;
        editor.setValue(content);
        editor.clearErrors();
        editor.focus();
        fileTree?.setSelectedPath(path);
    }
}
function handleFileCreate(path) {
    handleFileSelect(path);
}
function handleFileDelete(path) {
    if (!tabs)
        return;
    tabs.removeTabsForPath(path);
    if (currentFilePath === path || currentFilePath?.startsWith(path + '/')) {
        currentFilePath = null;
        editor?.setValue('');
    }
}
function handleFileRename(oldPath, newPath) {
    if (!tabs)
        return;
    tabs.updateTabPath(oldPath, newPath);
    if (currentFilePath === oldPath) {
        currentFilePath = newPath;
    }
}
function handleTabSelect(path) {
    handleFileSelect(path);
}
function handleTabClose(path) {
    if (currentFilePath === path) {
        const activeTab = tabs?.getActiveTab();
        if (activeTab) {
            handleFileSelect(activeTab);
        }
        else {
            currentFilePath = null;
            editor?.setValue('');
        }
    }
}
function saveCurrentFile() {
    if (!currentFilePath || !editor || !fs || !tabs)
        return;
    const content = editor.getValue();
    fs.writeFile(currentFilePath, content);
    tabs.setModified(currentFilePath, false);
    terminal?.printSystem(`💾 Сохранено: ${currentFilePath}\n`, 'success');
}
function saveCurrentFileIfNeeded() {
    if (!currentFilePath || !editor || !fs)
        return;
    const currentContent = fs.readFile(currentFilePath) ?? '';
    const editorContent = editor.getValue();
    if (editorContent !== currentContent) {
        fs.writeFile(currentFilePath, editorContent);
        tabs?.setModified(currentFilePath, false);
    }
}
function handleSave() {
    if (!currentFilePath) {
        terminal?.printSystem('⚠️ Нет открытого файла для сохранения\n', 'info');
        return;
    }
    saveCurrentFile();
}
async function handleRun() {
    if (!editor || !terminal || !fs || isRunning)
        return;
    saveCurrentFileIfNeeded();
    const mainContent = fs.readFile('/main.idyl');
    if (mainContent === null) {
        terminal.printSystem('❌ Файл /main.idyl не найден\n', 'error');
        return;
    }
    const guiPanel = document.getElementById('gui-panel');
    const guiResizer = document.getElementById('resizer-gui-terminal');
    if (guiPanel) {
        guiPanel.style.display = 'none';
        const guiOutput = document.getElementById('gui-output');
        if (guiOutput)
            guiOutput.innerHTML = '';
    }
    if (guiResizer)
        guiResizer.style.display = 'none';
    isRunning = true;
    abortController = new AbortController();
    updateButtons();
    terminal.clear();
    editor.clearErrors();
    const compilingMsg = terminal.printSystem('⏳ Компиляция...\n', 'info');
    try {
        const runtimeFS = {
            read: (filename) => {
                let content = fs.readFile('/' + filename);
                if (content === null) {
                    content = fs.readFile(filename);
                }
                if (content === null && !filename.endsWith('.idyl')) {
                    content = fs.readFile('/' + filename + '.idyl');
                    if (content === null) {
                        content = fs.readFile(filename + '.idyl');
                    }
                }
                return content;
            },
            write: (filename, content) => {
                const path = filename.startsWith('/') ? filename : '/' + filename;
                fs.writeFile(path, content);
            },
            exists: (filename) => {
                return fs.exists('/' + filename) || fs.exists(filename);
            },
        };
        const result = await (0, index_1.runIdyllium)(mainContent, {
            console: terminal,
            fs: runtimeFS,
        }, 'main.idyl');
        if (result.compilation.success && result.compilation.jsCode) {
            console.log('=== Generated JS Code ===');
            console.log(result.compilation.jsCode);
            console.log('=========================');
        }
        compilingMsg.remove();
        if (abortController?.signal.aborted) {
            terminal.printSystem('⛔ Выполнение прервано.\n', 'info');
        }
        else if (!result.compilation.success) {
            terminal.printSystem('❌ Ошибки компиляции:\n\n', 'error');
            const errorLines = [];
            for (const err of result.compilation.errors) {
                terminal.printSystem(`  ${err.file}:${err.line}: ${err.message}\n`, 'error');
                if (err.file === 'main.idyl' && currentFilePath === '/main.idyl') {
                    errorLines.push(err.line);
                }
            }
            editor.highlightErrors(errorLines);
        }
        else if (!result.success) {
            terminal.printSystem(`❌ ${result.runtimeError}\n`, 'error');
        }
        else {
            terminal.printSystem(`✅ Готово (${result.executionTimeMs.toFixed(1)} мс)\n`, 'success');
        }
    }
    catch (err) {
        compilingMsg.remove();
        if (err.message !== 'Input cancelled') {
            terminal.printSystem(`❌ Ошибка: ${err.message}\n`, 'error');
        }
    }
    isRunning = false;
    abortController = null;
    updateButtons();
}
function handleStop() {
    if (!isRunning || !terminal)
        return;
    terminal.cancelInput();
    abortController?.abort();
    isRunning = false;
    abortController = null;
    updateButtons();
    terminal.printSystem('\n⛔ Выполнение прервано.\n', 'info');
}
async function handleDownloadProject() {
    if (!fs)
        return;
    if (typeof JSZip === 'undefined') {
        const data = fs.exportAsJSON();
        const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, 'idyllium-project.json');
        terminal?.printSystem('📦 Проект сохранён как JSON (JSZip не загружен)\n', 'info');
        return;
    }
    try {
        const zip = new JSZip();
        const allFiles = fs.getAllFiles();
        for (const file of allFiles) {
            const path = file.path.startsWith('/') ? file.path.substring(1) : file.path;
            zip.file(path, file.content);
        }
        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        downloadBlob(blob, 'idyllium-project.zip');
        terminal?.printSystem(`📦 Проект сохранён как ZIP (${allFiles.length} файлов)\n`, 'success');
    }
    catch (e) {
        terminal?.printSystem(`❌ Ошибка создания ZIP: ${e.message}\n`, 'error');
    }
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function handleUploadFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.idyl,.txt,.json,.md,.csv,.xml,.html,.css,.js,.zip';
    input.onchange = async () => {
        const files = input.files;
        if (!files || !fs)
            return;
        let count = 0;
        for (const file of Array.from(files)) {
            try {
                if (file.name.endsWith('.zip')) {
                    count += await handleZipUpload(file);
                }
                else {
                    const content = await readFileAsText(file);
                    fs.writeFile('/' + file.name, content);
                    count++;
                }
            }
            catch (e) {
                terminal?.printSystem(`❌ Не удалось загрузить ${file.name}: ${e.message}\n`, 'error');
            }
        }
        if (count > 0) {
            terminal?.printSystem(`📂 Загружено файлов: ${count}\n`, 'success');
            fileTree?.render();
        }
    };
    input.click();
}
async function handleZipUpload(file) {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip не загружен');
    }
    const zip = await JSZip.loadAsync(file);
    let count = 0;
    for (const [path, zipEntry] of Object.entries(zip.files)) {
        const entry = zipEntry;
        if (entry.dir)
            continue;
        if (path.startsWith('.') || path.startsWith('__MACOSX'))
            continue;
        try {
            const content = await entry.async('string');
            const normalizedPath = path.startsWith('/') ? path : '/' + path;
            fs.writeFile(normalizedPath, content);
            count++;
        }
        catch (e) {
            console.warn(`Не удалось извлечь ${path}:`, e);
        }
    }
    return count;
}
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
function updateButtons() {
    const runBtn = document.getElementById('btn-run');
    const stopBtn = document.getElementById('btn-stop');
    if (runBtn) {
        runBtn.disabled = isRunning;
        runBtn.textContent = isRunning ? '⏳ Выполняется...' : '▶ Запустить';
    }
    if (stopBtn) {
        stopBtn.disabled = !isRunning;
    }
}
function initResizers() {
    initHorizontalResizer('resizer-sidebar', 'sidebar', 'editor-panel', 150, 400);
    initHorizontalResizer('resizer-output', 'editor-panel', 'output-panel', 200, 600, true);
}
function initHorizontalResizer(resizerId, leftId, rightId, minWidth, maxWidth, resizeRight = false) {
    const resizer = document.getElementById(resizerId);
    const leftPanel = document.getElementById(leftId);
    const rightPanel = document.getElementById(rightId);
    if (!resizer || !leftPanel || !rightPanel)
        return;
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = resizeRight ? rightPanel.offsetWidth : leftPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing)
            return;
        const delta = e.clientX - startX;
        let newWidth;
        if (resizeRight) {
            newWidth = startWidth - delta;
        }
        else {
            newWidth = startWidth + delta;
        }
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        if (resizeRight) {
            rightPanel.style.width = `${newWidth}px`;
        }
        else {
            leftPanel.style.width = `${newWidth}px`;
        }
    });
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}
function initGuiTerminalResizer() {
    const resizer = document.getElementById('resizer-gui-terminal');
    const guiPanel = document.getElementById('gui-panel');
    const terminalBody = document.getElementById('terminal-body');
    const outputPanel = document.getElementById('output-panel');
    if (!resizer || !guiPanel || !terminalBody || !outputPanel)
        return;
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = guiPanel.offsetHeight;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing)
            return;
        const delta = e.clientY - startY;
        const newHeight = Math.max(100, Math.min(outputPanel.offsetHeight - 150, startHeight + delta));
        guiPanel.style.height = `${newHeight}px`;
    });
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}
//# sourceMappingURL=ide.js.map