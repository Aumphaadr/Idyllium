// src/web/fs/browser-fs.ts

import {
    FileSystem,
    FSEntry,
    FSFile,
    FSDirectory,
    normalizePath,
    getParentPath,
    getFileName,
    joinPath,
    isTextFile,
} from './types';

const STORAGE_KEY = 'idyllium-fs';

export class BrowserFS implements FileSystem {
    private entries: Map<string, FSEntry> = new Map();
    private changeListeners: Array<(path: string, type: 'create' | 'update' | 'delete' | 'rename') => void> = [];

    constructor() {
        this.initializeRoot();
        this.loadFromStorage();
    }

    private initializeRoot(): void {
        if (!this.entries.has('/')) {
            this.entries.set('/', {
                name: '',
                type: 'directory',
                path: '/',
                parent: null,
                expanded: true,
            } as FSDirectory);
        }
    }

    private loadFromStorage(): void {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.deserialize(saved);
            } else {
                this.createDefaultProject();
            }
        } catch (e) {
            console.warn('Failed to load FS from storage:', e);
            this.createDefaultProject();
        }
    }

    private createDefaultProject(): void {
        const defaultCode = `use console;
use math;

main() {
    console.write("Добро пожаловать в Idyllium!\\n");
}
`;
        this.writeFile('/main.idyl', defaultCode);
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, this.serialize());
        } catch (e) {
            console.warn('Failed to save FS to storage:', e);
        }
    }

    private emit(path: string, type: 'create' | 'update' | 'delete' | 'rename'): void {
        for (const listener of this.changeListeners) {
            listener(path, type);
        }
    }

    readFile(path: string): string | null {
        const normalized = normalizePath(path);
        const entry = this.entries.get(normalized);
        if (entry && entry.type === 'file') {
            return (entry as FSFile).content;
        }
        return null;
    }

    writeFile(path: string, content: string): void {
        const normalized = normalizePath(path);

        const parent = getParentPath(normalized);
        if (parent && !this.exists(parent)) {
            this.mkdirRecursive(parent);
        }

        const existing = this.entries.get(normalized);
        const isNew = !existing;

        const file: FSFile = {
            name: getFileName(normalized),
            type: 'file',
            path: normalized,
            parent: parent,
            content: content,
            modified: false,
        };

        this.entries.set(normalized, file);
        this.saveToStorage();
        this.emit(normalized, isNew ? 'create' : 'update');
    }

    exists(path: string): boolean {
        return this.entries.has(normalizePath(path));
    }

    isDirectory(path: string): boolean {
        const entry = this.entries.get(normalizePath(path));
        return entry?.type === 'directory';
    }

    isFile(path: string): boolean {
        const entry = this.entries.get(normalizePath(path));
        return entry?.type === 'file';
    }

    mkdir(path: string): boolean {
        const normalized = normalizePath(path);
        
        if (this.exists(normalized)) {
            return false;
        }

        const parent = getParentPath(normalized);
        if (parent && !this.exists(parent)) {
            return false;
        }

        const dir: FSDirectory = {
            name: getFileName(normalized),
            type: 'directory',
            path: normalized,
            parent: parent,
            expanded: false,
        };

        this.entries.set(normalized, dir);
        this.saveToStorage();
        this.emit(normalized, 'create');
        return true;
    }

    private mkdirRecursive(path: string): void {
        const normalized = normalizePath(path);
        if (this.exists(normalized)) return;

        const parent = getParentPath(normalized);
        if (parent && !this.exists(parent)) {
            this.mkdirRecursive(parent);
        }

        this.mkdir(normalized);
    }

    readdir(path: string): FSEntry[] {
        const normalized = normalizePath(path);
        const entries: FSEntry[] = [];

        for (const entry of this.entries.values()) {
            if (entry.parent === normalized) {
                entries.push(entry);
            }
        }

        entries.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return entries;
    }

    rename(oldPath: string, newPath: string): boolean {
        const oldNorm = normalizePath(oldPath);
        const newNorm = normalizePath(newPath);

        if (!this.exists(oldNorm)) return false;
        if (this.exists(newNorm)) return false;

        const entry = this.entries.get(oldNorm)!;
        
        if (entry.type === 'directory') {
            this.renameDirectory(oldNorm, newNorm);
        } else {
            this.entries.delete(oldNorm);
            const newEntry: FSFile = {
                ...(entry as FSFile),
                name: getFileName(newNorm),
                path: newNorm,
                parent: getParentPath(newNorm),
            };
            this.entries.set(newNorm, newEntry);
        }

        this.saveToStorage();
        this.emit(newNorm, 'rename');
        return true;
    }

    private renameDirectory(oldPath: string, newPath: string): void {
        const entry = this.entries.get(oldPath)!;
        this.entries.delete(oldPath);

        const newDir: FSDirectory = {
            ...(entry as FSDirectory),
            name: getFileName(newPath),
            path: newPath,
            parent: getParentPath(newPath),
        };
        this.entries.set(newPath, newDir);

        const toUpdate: Array<[string, FSEntry]> = [];
        for (const [path, e] of this.entries) {
            if (path.startsWith(oldPath + '/')) {
                toUpdate.push([path, e]);
            }
        }

        for (const [oldChildPath, childEntry] of toUpdate) {
            this.entries.delete(oldChildPath);
            const newChildPath = newPath + oldChildPath.substring(oldPath.length);
            const updated = {
                ...childEntry,
                path: newChildPath,
                parent: getParentPath(newChildPath),
            };
            this.entries.set(newChildPath, updated as FSEntry);
        }
    }

    delete(path: string): boolean {
        const normalized = normalizePath(path);
        
        if (!this.exists(normalized)) return false;
        if (normalized === '/') return false;

        const entry = this.entries.get(normalized)!;

        if (entry.type === 'directory') {
            const toDelete: string[] = [];
            for (const p of this.entries.keys()) {
                if (p === normalized || p.startsWith(normalized + '/')) {
                    toDelete.push(p);
                }
            }
            for (const p of toDelete) {
                this.entries.delete(p);
            }
        } else {
            this.entries.delete(normalized);
        }

        this.saveToStorage();
        this.emit(normalized, 'delete');
        return true;
    }

    move(srcPath: string, destDir: string): boolean {
        const srcNorm = normalizePath(srcPath);
        const destNorm = normalizePath(destDir);
        
        if (!this.exists(srcNorm)) return false;
        if (!this.isDirectory(destNorm)) return false;

        const fileName = getFileName(srcNorm);
        const newPath = joinPath(destNorm, fileName);

        return this.rename(srcNorm, newPath);
    }

    copy(srcPath: string, destDir: string): boolean {
        const srcNorm = normalizePath(srcPath);
        const destNorm = normalizePath(destDir);

        if (!this.exists(srcNorm)) return false;
        if (!this.isDirectory(destNorm)) return false;

        const entry = this.entries.get(srcNorm)!;
        
        if (entry.type === 'file') {
            const fileName = getFileName(srcNorm);
            const newPath = joinPath(destNorm, fileName);
            this.writeFile(newPath, (entry as FSFile).content);
            return true;
        }

        return this.copyDirectory(srcNorm, destNorm);
    }

    private copyDirectory(srcPath: string, destDir: string): boolean {
        const dirName = getFileName(srcPath);
        const newDirPath = joinPath(destDir, dirName);
        
        this.mkdir(newDirPath);

        const children = this.readdir(srcPath);
        for (const child of children) {
            if (child.type === 'file') {
                this.writeFile(
                    joinPath(newDirPath, child.name),
                    (child as FSFile).content
                );
            } else {
                this.copyDirectory(child.path, newDirPath);
            }
        }

        return true;
    }

    getEntry(path: string): FSEntry | null {
        return this.entries.get(normalizePath(path)) ?? null;
    }

    getAllFiles(): FSFile[] {
        const files: FSFile[] = [];
        for (const entry of this.entries.values()) {
            if (entry.type === 'file') {
                files.push(entry as FSFile);
            }
        }
        return files;
    }

    serialize(): string {
        const data: Array<{ path: string; type: string; content?: string; expanded?: boolean }> = [];
        
        for (const entry of this.entries.values()) {
            if (entry.path === '/') continue; // корень не сериализуем
            
            if (entry.type === 'file') {
                data.push({
                    path: entry.path,
                    type: 'file',
                    content: (entry as FSFile).content,
                });
            } else {
                data.push({
                    path: entry.path,
                    type: 'directory',
                    expanded: (entry as FSDirectory).expanded,
                });
            }
        }

        return JSON.stringify(data);
    }

    deserialize(data: string): void {
        try {
            const parsed = JSON.parse(data) as Array<{ path: string; type: string; content?: string; expanded?: boolean }>;
            
            this.entries.clear();
            this.initializeRoot();

            const dirs = parsed.filter(e => e.type === 'directory').sort((a, b) => 
                a.path.split('/').length - b.path.split('/').length
            );
            
            for (const d of dirs) {
                const dir: FSDirectory = {
                    name: getFileName(d.path),
                    type: 'directory',
                    path: d.path,
                    parent: getParentPath(d.path),
                    expanded: d.expanded ?? false,
                };
                this.entries.set(d.path, dir);
            }

            for (const f of parsed.filter(e => e.type === 'file')) {
                const file: FSFile = {
                    name: getFileName(f.path),
                    type: 'file',
                    path: f.path,
                    parent: getParentPath(f.path),
                    content: f.content ?? '',
                    modified: false,
                };
                this.entries.set(f.path, file);
            }
        } catch (e) {
            console.error('Failed to deserialize FS:', e);
        }
    }

    onChange(callback: (path: string, type: 'create' | 'update' | 'delete' | 'rename') => void): void {
        this.changeListeners.push(callback);
    }

    toggleDirectory(path: string): void {
        const normalized = normalizePath(path);
        const entry = this.entries.get(normalized);
        if (entry && entry.type === 'directory') {
            (entry as FSDirectory).expanded = !(entry as FSDirectory).expanded;
            this.saveToStorage();
        }
    }

    setFileModified(path: string, modified: boolean): void {
        const normalized = normalizePath(path);
        const entry = this.entries.get(normalized);
        if (entry && entry.type === 'file') {
            (entry as FSFile).modified = modified;
        }
    }

    exportAsJSON(): string {
        return this.serialize();
    }

    importFromJSON(json: string): void {
        this.deserialize(json);
        this.saveToStorage();
        this.emit('/', 'update');
    }

    clear(): void {
        this.entries.clear();
        this.initializeRoot();
        this.createDefaultProject();
        this.saveToStorage();
        this.emit('/', 'update');
    }
}