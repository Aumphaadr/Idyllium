// src/web/fs/file-tree.ts

import { BrowserFS } from './browser-fs';
import { FSEntry, FSFile, FSDirectory, getFileName, getExtension } from './types';
import { showInputModal, showConfirmModal } from '../modal';

export interface FileTreeCallbacks {
    onFileSelect: (path: string) => void;
    onFileCreate: (path: string) => void;
    onFileDelete: (path: string) => void;
    onFileRename: (oldPath: string, newPath: string) => void;
    onUpload?: () => void;
    onDownload?: () => void;
}
export * from '../modal';

const FILE_ICONS: Record<string, string> = {
    '.idyl': '📜',
    '.txt': '📄',
    '.json': '📋',
    '.md': '📝',
    '.csv': '📊',
    '.xml': '📰',
    '.html': '🌐',
    '.css': '🎨',
    '.js': '⚡',
    'default': '📄',
    'folder': '📁',
    'folder-open': '📂',
};

export class FileTree {
    private container: HTMLElement;
    private fs: BrowserFS;
    private callbacks: FileTreeCallbacks;
    private selectedPath: string | null = null;
    private contextMenu: HTMLElement | null = null;

    constructor(container: HTMLElement, fs: BrowserFS, callbacks: FileTreeCallbacks) {
        this.container = container;
        this.fs = fs;
        this.callbacks = callbacks;

        this.container.className = 'file-tree';
        this.render();

        this.fs.onChange(() => this.render());

        document.addEventListener('click', () => this.hideContextMenu());
    }

    render(): void {
        this.container.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'file-tree-header';
        header.innerHTML = `
            <span class="file-tree-title">ПРОЕКТ</span>
            <div class="file-tree-actions">
                <button class="file-tree-btn" title="Загрузить файлы" data-action="upload">📂</button>
                <button class="file-tree-btn" title="Скачать проект" data-action="download">📦</button>
                <button class="file-tree-btn" title="Новый файл" data-action="new-file">+📄</button>
                <button class="file-tree-btn" title="Новая папка" data-action="new-folder">+📁</button>
            </div>
        `;
        this.container.appendChild(header);
    
        header.querySelector('[data-action="upload"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onUpload?.();
        });
    
        header.querySelector('[data-action="download"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.callbacks.onDownload?.();
        });
    
        header.querySelector('[data-action="new-file"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.promptNewFile('/');
        });
    
        header.querySelector('[data-action="new-folder"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.promptNewFolder('/');
        });
    
        const tree = document.createElement('div');
        tree.className = 'file-tree-content';
        this.renderDirectory('/', tree, 0);
        this.container.appendChild(tree);
    }

    private renderDirectory(path: string, parent: HTMLElement, depth: number): void {
        const entries = this.fs.readdir(path);

        for (const entry of entries) {
            const item = this.createTreeItem(entry, depth);
            parent.appendChild(item);

            if (entry.type === 'directory' && (entry as FSDirectory).expanded) {
                this.renderDirectory(entry.path, parent, depth + 1);
            }
        }
    }

    private createTreeItem(entry: FSEntry, depth: number): HTMLElement {
        const item = document.createElement('div');
        item.className = 'file-tree-item';
        if (entry.path === this.selectedPath) {
            item.classList.add('selected');
        }
        item.style.paddingLeft = `${12 + depth * 16}px`;
        item.dataset.path = entry.path;
    
        const icon = this.getIcon(entry);
        const name = entry.name;
        const modified = entry.type === 'file' && (entry as FSFile).modified ? ' •' : '';
    
        item.innerHTML = `
            <span class="file-tree-icon">${icon}</span>
            <span class="file-tree-name">${this.escapeHTML(name)}${modified}</span>
            <span class="file-tree-item-spacer"></span>
            <button class="file-tree-item-menu" title="Действия">⋮</button>
        `;
    
        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('file-tree-item-menu')) {
                return;
            }
            e.stopPropagation();
            if (entry.type === 'directory') {
                this.fs.toggleDirectory(entry.path);
                this.render();
            } else {
                this.selectFile(entry.path);
            }
        });

        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (entry.type === 'file') {
                this.callbacks.onFileSelect(entry.path);
            }
        });
    
        const menuBtn = item.querySelector('.file-tree-item-menu') as HTMLElement;
        menuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = menuBtn.getBoundingClientRect();
            this.showContextMenu(rect.right, rect.bottom, entry);
        });
    
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e.clientX, e.clientY, entry);
        });
    
        item.draggable = true;
        item.addEventListener('dragstart', (e) => this.onDragStart(e, entry));
        item.addEventListener('dragover', (e) => this.onDragOver(e, entry));
        item.addEventListener('drop', (e) => this.onDrop(e, entry));
        item.addEventListener('dragleave', (e) => this.onDragLeave(e));
    
        return item;
    }

    private getIcon(entry: FSEntry): string {
        if (entry.type === 'directory') {
            return (entry as FSDirectory).expanded ? FILE_ICONS['folder-open'] : FILE_ICONS['folder'];
        }
        const ext = getExtension(entry.name);
        return FILE_ICONS[ext] ?? FILE_ICONS['default'];
    }

    private selectFile(path: string): void {
        this.selectedPath = path;
        this.render();
        this.callbacks.onFileSelect(path);
    }

    setSelectedPath(path: string | null): void {
        this.selectedPath = path;
        this.render();
    }

    private showContextMenu(x: number, y: number, entry: FSEntry): void {
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'file-tree-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        const items: Array<{ label: string; action: () => void }> = [];

        if (entry.type === 'directory') {
            items.push({ label: '📄 Новый файл', action: () => this.promptNewFile(entry.path) });
            items.push({ label: '📁 Новая папка', action: () => this.promptNewFolder(entry.path) });
            items.push({ label: '─────', action: () => {} });
        }

        items.push({ label: '✏️ Переименовать', action: () => this.promptRename(entry) });
        items.push({ label: '🗑️ Удалить', action: () => this.promptDelete(entry) });

        if (entry.type === 'file') {
            items.push({ label: '─────', action: () => {} });
            items.push({ label: '💾 Скачать', action: () => this.downloadFile(entry.path) });
        }

        for (const item of items) {
            const el = document.createElement('div');
            el.className = 'file-tree-context-item';
            if (item.label === '─────') {
                el.className = 'file-tree-context-separator';
            } else {
                el.textContent = item.label;
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hideContextMenu();
                    item.action();
                });
            }
            menu.appendChild(el);
        }

        document.body.appendChild(menu);
        this.contextMenu = menu;

        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 8}px`;
        }
    }

    private hideContextMenu(): void {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    private async promptNewFile(parentPath: string): Promise<void> {
        const result = await showInputModal({
            title: 'Новый файл',
            placeholder: 'путь/имя_файла',
            defaultValue: '',
            confirmText: 'Создать',
            showExtensionHint: true,
        });
    
        if (!result.confirmed || !result.value) return;

        let inputPath = result.value;
        let fullPath: string;
        
        if (inputPath.startsWith('/')) {
            fullPath = inputPath;
        } else {
            fullPath = parentPath === '/' 
                ? `/${inputPath}` 
                : `${parentPath}/${inputPath}`;
        }
    
        fullPath = this.normalizePath(fullPath);
        
        if (this.fs.exists(fullPath)) {
            alert('Файл с таким именем уже существует');
            return;
        }
    
        const fileParent = this.getParentPath(fullPath);
        if (fileParent && fileParent !== '/' && !this.fs.exists(fileParent)) {
            this.mkdirRecursive(fileParent);
        }
    
        this.fs.writeFile(fullPath, '');
        this.callbacks.onFileCreate(fullPath);
        this.selectFile(fullPath);
    }

    private async promptNewFolder(parentPath: string): Promise<void> {
        const result = await showInputModal({
            title: 'Новая папка',
            placeholder: 'путь/имя_папки',
            defaultValue: '',
            confirmText: 'Создать',
            showExtensionHint: false,
        });
    
        if (!result.confirmed || !result.value) return;
    
        let inputPath = result.value;
        let fullPath: string;
        
        if (inputPath.startsWith('/')) {
            fullPath = inputPath;
        } else {
            fullPath = parentPath === '/' 
                ? `/${inputPath}` 
                : `${parentPath}/${inputPath}`;
        }
    
        fullPath = this.normalizePath(fullPath);
        
        if (this.fs.exists(fullPath)) {
            alert('Папка с таким именем уже существует');
            return;
        }
    
        this.mkdirRecursive(fullPath);
        this.render();
    }

    private async promptRename(entry: FSEntry): Promise<void> {
        const displayPath = entry.path.startsWith('/') 
            ? entry.path.substring(1) 
            : entry.path;
        
        const result = await showInputModal({
            title: 'Переименовать',
            placeholder: 'новый/путь/имя',
            defaultValue: displayPath,
            confirmText: 'Переименовать',
            showExtensionHint: false,
        });
    
        if (!result.confirmed || !result.value || result.value === displayPath) return;
    
        let newPath = result.value;
        if (!newPath.startsWith('/')) {
            newPath = '/' + newPath;
        }
    
        if (this.fs.exists(newPath)) {
            alert('Элемент с таким путём уже существует');
            return;
        }
    
        const parentPath = this.getParentPath(newPath);
        if (parentPath && parentPath !== '/' && !this.fs.exists(parentPath)) {
            this.mkdirRecursive(parentPath);
        }
    
        const oldPath = entry.path;
        this.fs.rename(oldPath, newPath);
        this.callbacks.onFileRename(oldPath, newPath);
        
        if (this.selectedPath === oldPath) {
            this.selectedPath = newPath;
        }
        this.render();
    }

    private async promptDelete(entry: FSEntry): Promise<void> {
        const type = entry.type === 'directory' ? 'папку' : 'файл';
        
        const confirmed = await showConfirmModal(
            'Удалить ' + type,
            `Вы уверены, что хотите удалить ${type} "${entry.name}"?`,
            'Удалить',
            'Отмена'
        );
    
        if (!confirmed) return;
    
        const path = entry.path;
        this.fs.delete(path);
        this.callbacks.onFileDelete(path);
    
        if (this.selectedPath === path || this.selectedPath?.startsWith(path + '/')) {
            this.selectedPath = null;
        }
        this.render();
    }

    private getParentPath(path: string): string | null {
        const normalized = this.normalizePath(path);
        if (normalized === '/') return null;
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash === 0 ? '/' : normalized.substring(0, lastSlash);
    }
    
    private normalizePath(path: string): string {
        let normalized = path.replace(/\/+/g, '/');
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }
    
    private mkdirRecursive(path: string): void {
        const normalized = this.normalizePath(path);
        if (this.fs.exists(normalized)) return;
    
        const parent = this.getParentPath(normalized);
        if (parent && !this.fs.exists(parent)) {
            this.mkdirRecursive(parent);
        }
    
        this.fs.mkdir(normalized);
    }

    private downloadFile(path: string): void {
        const content = this.fs.readFile(path);
        if (content === null) return;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = getFileName(path);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private draggedPath: string | null = null;

    private onDragStart(e: DragEvent, entry: FSEntry): void {
        this.draggedPath = entry.path;
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', entry.path);
        (e.target as HTMLElement).classList.add('dragging');
    }

    private onDragOver(e: DragEvent, entry: FSEntry): void {
        if (entry.type !== 'directory') return;
        if (this.draggedPath === entry.path) return;
        if (this.draggedPath && entry.path.startsWith(this.draggedPath + '/')) return;

        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        (e.target as HTMLElement).classList.add('drag-over');
    }

    private onDragLeave(e: DragEvent): void {
        (e.target as HTMLElement).classList.remove('drag-over');
    }

    private onDrop(e: DragEvent, targetEntry: FSEntry): void {
        e.preventDefault();
        (e.target as HTMLElement).classList.remove('drag-over');

        if (!this.draggedPath) return;
        if (targetEntry.type !== 'directory') return;

        this.fs.move(this.draggedPath, targetEntry.path);
        this.draggedPath = null;
        this.render();
    }

    private escapeHTML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}