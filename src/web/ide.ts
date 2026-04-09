// src/web/ide.ts

declare const JSZip: any;

import { compileIdyllium, runIdyllium } from '../index';
import { Editor } from './editor';
import { Terminal } from './terminal';
import { BrowserFS } from './fs/browser-fs';
import { FileTree } from './fs/file-tree';
import { Tabs } from './fs/tabs';
import { getFileName } from './fs/types';

let editor: Editor | null = null;
let terminal: Terminal | null = null;
let fs: BrowserFS | null = null;
let fileTree: FileTree | null = null;
let tabs: Tabs | null = null;

let currentFilePath: string | null = null;
let isRunning = false;
let abortController: AbortController | null = null;

export function init(): void {
    const fileTreeContainer = document.getElementById('file-tree');
    const tabsContainer = document.getElementById('tabs-container');
    const editorContainer = document.getElementById('editor-container');
    const terminalContainer = document.getElementById('terminal-body');

    if (!fileTreeContainer || !tabsContainer || !editorContainer || !terminalContainer) {
        console.error('Required containers not found');
        return;
    }

    fs = new BrowserFS();

    fileTree = new FileTree(fileTreeContainer, fs, {
        onFileSelect: handleFileSelect,
        onFileCreate: handleFileCreate,
        onFileDelete: handleFileDelete,
        onFileRename: handleFileRename,
        onUpload: handleUploadFiles,
        onDownload: handleDownloadProject,
    });

    tabs = new Tabs(tabsContainer, {
        onTabSelect: handleTabSelect,
        onTabClose: handleTabClose,
    });

    editor = new Editor(editorContainer, {
        initialValue: '',
        tabSize: 4,
        fontSize: 15,
    });

    setupEditorChangeListener();

    terminal = new Terminal(terminalContainer);
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
        
        if (guiPanel) guiPanel.style.display = 'none';
        if (guiOutput) guiOutput.innerHTML = '';
        if (guiResizer) guiResizer.style.display = 'none';
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

function setupEditorChangeListener(): void {
    if (!editor) return;

    const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement;
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

function handleFileSelect(path: string): void {
    if (!fs || !editor || !tabs) return;

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

function handleFileCreate(path: string): void {
    handleFileSelect(path);
}

function handleFileDelete(path: string): void {
    if (!tabs) return;
    tabs.removeTabsForPath(path);
    
    if (currentFilePath === path || currentFilePath?.startsWith(path + '/')) {
        currentFilePath = null;
        editor?.setValue('');
    }
}

function handleFileRename(oldPath: string, newPath: string): void {
    if (!tabs) return;
    tabs.updateTabPath(oldPath, newPath);
    
    if (currentFilePath === oldPath) {
        currentFilePath = newPath;
    }
}

function handleTabSelect(path: string): void {
    handleFileSelect(path);
}

function handleTabClose(path: string): void {
    if (currentFilePath === path) {
        const activeTab = tabs?.getActiveTab();
        if (activeTab) {
            handleFileSelect(activeTab);
        } else {
            currentFilePath = null;
            editor?.setValue('');
        }
    }
}

function saveCurrentFile(): void {
    if (!currentFilePath || !editor || !fs || !tabs) return;

    const content = editor.getValue();
    fs.writeFile(currentFilePath, content);
    tabs.setModified(currentFilePath, false);
    
    terminal?.printSystem(`💾 Сохранено: ${currentFilePath}\n`, 'success');
}

function saveCurrentFileIfNeeded(): void {
    if (!currentFilePath || !editor || !fs) return;

    const currentContent = fs.readFile(currentFilePath) ?? '';
    const editorContent = editor.getValue();

    if (editorContent !== currentContent) {
        fs.writeFile(currentFilePath, editorContent);
        tabs?.setModified(currentFilePath, false);
    }
}

function handleSave(): void {
    if (!currentFilePath) {
        terminal?.printSystem('⚠️ Нет открытого файла для сохранения\n', 'info');
        return;
    }
    saveCurrentFile();
}

async function handleRun(): Promise<void> {
    if (!editor || !terminal || !fs || isRunning) return;

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
        if (guiOutput) guiOutput.innerHTML = '';
    }
    if (guiResizer) guiResizer.style.display = 'none';

    isRunning = true;
    abortController = new AbortController();
    updateButtons();

    terminal.clear();
    editor.clearErrors();
    
    const compilingMsg = terminal.printSystem('⏳ Компиляция...\n', 'info');

    try {
        const runtimeFS = {
            read: (filename: string): string | null => {
                let content = fs!.readFile('/' + filename);
                if (content === null) {
                    content = fs!.readFile(filename);
                }
                if (content === null && !filename.endsWith('.idyl')) {
                    content = fs!.readFile('/' + filename + '.idyl');
                    if (content === null) {
                        content = fs!.readFile(filename + '.idyl');
                    }
                }
                return content;
            },
            write: (filename: string, content: string): void => {
                const path = filename.startsWith('/') ? filename : '/' + filename;
                fs!.writeFile(path, content);
            },
            exists: (filename: string): boolean => {
                return fs!.exists('/' + filename) || fs!.exists(filename);
            },
        };

        const result = await runIdyllium(mainContent, { 
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
        } else if (!result.compilation.success) {
            terminal.printSystem('❌ Ошибки компиляции:\n\n', 'error');
            const errorLines: number[] = [];
            for (const err of result.compilation.errors) {
                terminal.printSystem(`  ${err.file}:${err.line}: ${err.message}\n`, 'error');
                if (err.file === 'main.idyl' && currentFilePath === '/main.idyl') {
                    errorLines.push(err.line);
                }
            }
            editor.highlightErrors(errorLines);
        } else if (!result.success) {
            terminal.printSystem(`❌ ${result.runtimeError}\n`, 'error');
        } else {
            terminal.printSystem(`✅ Готово (${result.executionTimeMs.toFixed(1)} мс)\n`, 'success');
        }
    } catch (err: unknown) {
        compilingMsg.remove();
        
        if ((err as Error).message !== 'Input cancelled') {
            terminal.printSystem(`❌ Ошибка: ${(err as Error).message}\n`, 'error');
        }
    }

    isRunning = false;
    abortController = null;
    updateButtons();
}

function handleStop(): void {
    if (!isRunning || !terminal) return;

    terminal.cancelInput();
    abortController?.abort();
    isRunning = false;
    abortController = null;
    updateButtons();

    terminal.printSystem('\n⛔ Выполнение прервано.\n', 'info');
}

async function handleDownloadProject(): Promise<void> {
    if (!fs) return;

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
    } catch (e) {
        terminal?.printSystem(`❌ Ошибка создания ZIP: ${(e as Error).message}\n`, 'error');
    }
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleUploadFiles(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.idyl,.txt,.json,.md,.csv,.xml,.html,.css,.js,.zip';

    input.onchange = async () => {
        const files = input.files;
        if (!files || !fs) return;

        let count = 0;
        for (const file of Array.from(files)) {
            try {
                if (file.name.endsWith('.zip')) {
                    count += await handleZipUpload(file);
                } else {
                    const content = await readFileAsText(file);
                    fs.writeFile('/' + file.name, content);
                    count++;
                }
            } catch (e) {
                terminal?.printSystem(`❌ Не удалось загрузить ${file.name}: ${(e as Error).message}\n`, 'error');
            }
        }

        if (count > 0) {
            terminal?.printSystem(`📂 Загружено файлов: ${count}\n`, 'success');
            fileTree?.render();
        }
    };

    input.click();
}

async function handleZipUpload(file: File): Promise<number> {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip не загружен');
    }

    const zip = await JSZip.loadAsync(file);
    let count = 0;

    for (const [path, zipEntry] of Object.entries(zip.files)) {
        const entry = zipEntry as any;
        
        if (entry.dir) continue;
        if (path.startsWith('.') || path.startsWith('__MACOSX')) continue;

        try {
            const content = await entry.async('string');
            const normalizedPath = path.startsWith('/') ? path : '/' + path;
            fs!.writeFile(normalizedPath, content);
            count++;
        } catch (e) {
            console.warn(`Не удалось извлечь ${path}:`, e);
        }
    }

    return count;
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function updateButtons(): void {
    const runBtn = document.getElementById('btn-run') as HTMLButtonElement | null;
    const stopBtn = document.getElementById('btn-stop') as HTMLButtonElement | null;

    if (runBtn) {
        runBtn.disabled = isRunning;
        runBtn.textContent = isRunning ? '⏳ Выполняется...' : '▶ Запустить';
    }
    if (stopBtn) {
        stopBtn.disabled = !isRunning;
    }
}

function initResizers(): void {
    initHorizontalResizer('resizer-sidebar', 'sidebar', 'editor-panel', 150, 400);
    initHorizontalResizer('resizer-output', 'editor-panel', 'output-panel', 200, 600, true);
}

function initHorizontalResizer(
    resizerId: string,
    leftId: string,
    rightId: string,
    minWidth: number,
    maxWidth: number,
    resizeRight: boolean = false
): void {
    const resizer = document.getElementById(resizerId);
    const leftPanel = document.getElementById(leftId);
    const rightPanel = document.getElementById(rightId);

    if (!resizer || !leftPanel || !rightPanel) return;

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
        if (!isResizing) return;

        const delta = e.clientX - startX;
        let newWidth: number;

        if (resizeRight) {
            newWidth = startWidth - delta;
        } else {
            newWidth = startWidth + delta;
        }

        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        if (resizeRight) {
            rightPanel.style.width = `${newWidth}px`;
        } else {
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

function initGuiTerminalResizer(): void {
    const resizer = document.getElementById('resizer-gui-terminal');
    const guiPanel = document.getElementById('gui-panel');
    const terminalBody = document.getElementById('terminal-body');
    const outputPanel = document.getElementById('output-panel');

    if (!resizer || !guiPanel || !terminalBody || !outputPanel) return;

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
        if (!isResizing) return;

        const delta = e.clientY - startY;
        const newHeight = Math.max(100, Math.min(
            outputPanel.offsetHeight - 150,
            startHeight + delta
        ));

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