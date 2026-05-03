"use strict";
// src/web/fs/browser-fs.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserFS = void 0;
const types_1 = require("./types");
const STORAGE_KEY = 'idyllium-fs';
class BrowserFS {
    constructor() {
        this.entries = new Map();
        this.changeListeners = [];
        this.initializeRoot();
        this.loadFromStorage();
    }
    initializeRoot() {
        if (!this.entries.has('/')) {
            this.entries.set('/', {
                name: '',
                type: 'directory',
                path: '/',
                parent: null,
                expanded: true,
            });
        }
    }
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.deserialize(saved);
            }
            else {
                this.createDefaultProject();
            }
        }
        catch (e) {
            console.warn('Failed to load FS from storage:', e);
            this.createDefaultProject();
        }
    }
    createDefaultProject() {
        const defaultCode = `use console;
use math;

main() {
    console.write("Добро пожаловать в Idyllium!\\n");
}
`;
        this.writeFile('/main.idyl', defaultCode);
    }
    saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, this.serialize());
        }
        catch (e) {
            console.warn('Failed to save FS to storage:', e);
        }
    }
    emit(path, type) {
        for (const listener of this.changeListeners) {
            listener(path, type);
        }
    }
    readFile(path) {
        const normalized = (0, types_1.normalizePath)(path);
        const entry = this.entries.get(normalized);
        if (entry && entry.type === 'file') {
            return entry.content;
        }
        return null;
    }
    writeFile(path, content) {
        const normalized = (0, types_1.normalizePath)(path);
        const parent = (0, types_1.getParentPath)(normalized);
        if (parent && !this.exists(parent)) {
            this.mkdirRecursive(parent);
        }
        const existing = this.entries.get(normalized);
        const isNew = !existing;
        const file = {
            name: (0, types_1.getFileName)(normalized),
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
    exists(path) {
        return this.entries.has((0, types_1.normalizePath)(path));
    }
    isDirectory(path) {
        const entry = this.entries.get((0, types_1.normalizePath)(path));
        return entry?.type === 'directory';
    }
    isFile(path) {
        const entry = this.entries.get((0, types_1.normalizePath)(path));
        return entry?.type === 'file';
    }
    mkdir(path) {
        const normalized = (0, types_1.normalizePath)(path);
        if (this.exists(normalized)) {
            return false;
        }
        const parent = (0, types_1.getParentPath)(normalized);
        if (parent && !this.exists(parent)) {
            return false;
        }
        const dir = {
            name: (0, types_1.getFileName)(normalized),
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
    mkdirRecursive(path) {
        const normalized = (0, types_1.normalizePath)(path);
        if (this.exists(normalized))
            return;
        const parent = (0, types_1.getParentPath)(normalized);
        if (parent && !this.exists(parent)) {
            this.mkdirRecursive(parent);
        }
        this.mkdir(normalized);
    }
    readdir(path) {
        const normalized = (0, types_1.normalizePath)(path);
        const entries = [];
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
    rename(oldPath, newPath) {
        const oldNorm = (0, types_1.normalizePath)(oldPath);
        const newNorm = (0, types_1.normalizePath)(newPath);
        if (!this.exists(oldNorm))
            return false;
        if (this.exists(newNorm))
            return false;
        const entry = this.entries.get(oldNorm);
        if (entry.type === 'directory') {
            this.renameDirectory(oldNorm, newNorm);
        }
        else {
            this.entries.delete(oldNorm);
            const newEntry = {
                ...entry,
                name: (0, types_1.getFileName)(newNorm),
                path: newNorm,
                parent: (0, types_1.getParentPath)(newNorm),
            };
            this.entries.set(newNorm, newEntry);
        }
        this.saveToStorage();
        this.emit(newNorm, 'rename');
        return true;
    }
    renameDirectory(oldPath, newPath) {
        const entry = this.entries.get(oldPath);
        this.entries.delete(oldPath);
        const newDir = {
            ...entry,
            name: (0, types_1.getFileName)(newPath),
            path: newPath,
            parent: (0, types_1.getParentPath)(newPath),
        };
        this.entries.set(newPath, newDir);
        const toUpdate = [];
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
                parent: (0, types_1.getParentPath)(newChildPath),
            };
            this.entries.set(newChildPath, updated);
        }
    }
    delete(path) {
        const normalized = (0, types_1.normalizePath)(path);
        if (!this.exists(normalized))
            return false;
        if (normalized === '/')
            return false;
        const entry = this.entries.get(normalized);
        if (entry.type === 'directory') {
            const toDelete = [];
            for (const p of this.entries.keys()) {
                if (p === normalized || p.startsWith(normalized + '/')) {
                    toDelete.push(p);
                }
            }
            for (const p of toDelete) {
                this.entries.delete(p);
            }
        }
        else {
            this.entries.delete(normalized);
        }
        this.saveToStorage();
        this.emit(normalized, 'delete');
        return true;
    }
    move(srcPath, destDir) {
        const srcNorm = (0, types_1.normalizePath)(srcPath);
        const destNorm = (0, types_1.normalizePath)(destDir);
        if (!this.exists(srcNorm))
            return false;
        if (!this.isDirectory(destNorm))
            return false;
        const fileName = (0, types_1.getFileName)(srcNorm);
        const newPath = (0, types_1.joinPath)(destNorm, fileName);
        return this.rename(srcNorm, newPath);
    }
    copy(srcPath, destDir) {
        const srcNorm = (0, types_1.normalizePath)(srcPath);
        const destNorm = (0, types_1.normalizePath)(destDir);
        if (!this.exists(srcNorm))
            return false;
        if (!this.isDirectory(destNorm))
            return false;
        const entry = this.entries.get(srcNorm);
        if (entry.type === 'file') {
            const fileName = (0, types_1.getFileName)(srcNorm);
            const newPath = (0, types_1.joinPath)(destNorm, fileName);
            this.writeFile(newPath, entry.content);
            return true;
        }
        return this.copyDirectory(srcNorm, destNorm);
    }
    copyDirectory(srcPath, destDir) {
        const dirName = (0, types_1.getFileName)(srcPath);
        const newDirPath = (0, types_1.joinPath)(destDir, dirName);
        this.mkdir(newDirPath);
        const children = this.readdir(srcPath);
        for (const child of children) {
            if (child.type === 'file') {
                this.writeFile((0, types_1.joinPath)(newDirPath, child.name), child.content);
            }
            else {
                this.copyDirectory(child.path, newDirPath);
            }
        }
        return true;
    }
    getEntry(path) {
        return this.entries.get((0, types_1.normalizePath)(path)) ?? null;
    }
    getAllFiles() {
        const files = [];
        for (const entry of this.entries.values()) {
            if (entry.type === 'file') {
                files.push(entry);
            }
        }
        return files;
    }
    serialize() {
        const data = [];
        for (const entry of this.entries.values()) {
            if (entry.path === '/')
                continue; // корень не сериализуем
            if (entry.type === 'file') {
                data.push({
                    path: entry.path,
                    type: 'file',
                    content: entry.content,
                });
            }
            else {
                data.push({
                    path: entry.path,
                    type: 'directory',
                    expanded: entry.expanded,
                });
            }
        }
        return JSON.stringify(data);
    }
    deserialize(data) {
        try {
            const parsed = JSON.parse(data);
            this.entries.clear();
            this.initializeRoot();
            const dirs = parsed.filter(e => e.type === 'directory').sort((a, b) => a.path.split('/').length - b.path.split('/').length);
            for (const d of dirs) {
                const dir = {
                    name: (0, types_1.getFileName)(d.path),
                    type: 'directory',
                    path: d.path,
                    parent: (0, types_1.getParentPath)(d.path),
                    expanded: d.expanded ?? false,
                };
                this.entries.set(d.path, dir);
            }
            for (const f of parsed.filter(e => e.type === 'file')) {
                const file = {
                    name: (0, types_1.getFileName)(f.path),
                    type: 'file',
                    path: f.path,
                    parent: (0, types_1.getParentPath)(f.path),
                    content: f.content ?? '',
                    modified: false,
                };
                this.entries.set(f.path, file);
            }
        }
        catch (e) {
            console.error('Failed to deserialize FS:', e);
        }
    }
    onChange(callback) {
        this.changeListeners.push(callback);
    }
    toggleDirectory(path) {
        const normalized = (0, types_1.normalizePath)(path);
        const entry = this.entries.get(normalized);
        if (entry && entry.type === 'directory') {
            entry.expanded = !entry.expanded;
            this.saveToStorage();
        }
    }
    setFileModified(path, modified) {
        const normalized = (0, types_1.normalizePath)(path);
        const entry = this.entries.get(normalized);
        if (entry && entry.type === 'file') {
            entry.modified = modified;
        }
    }
    exportAsJSON() {
        return this.serialize();
    }
    importFromJSON(json) {
        this.deserialize(json);
        this.saveToStorage();
        this.emit('/', 'update');
    }
    clear() {
        this.entries.clear();
        this.initializeRoot();
        this.createDefaultProject();
        this.saveToStorage();
        this.emit('/', 'update');
    }
}
exports.BrowserFS = BrowserFS;
//# sourceMappingURL=browser-fs.js.map