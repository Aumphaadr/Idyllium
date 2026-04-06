// src/web/fs/types.ts

export type FSNodeType = 'file' | 'directory';

export interface FSNode {
    name: string;
    type: FSNodeType;
    path: string;
    parent: string | null;
}

export interface FSFile extends FSNode {
    type: 'file';
    content: string;
    modified: boolean;
}

export interface FSDirectory extends FSNode {
    type: 'directory';
    expanded: boolean;
}

export type FSEntry = FSFile | FSDirectory;

export interface FileSystem {
    readFile(path: string): string | null;
    writeFile(path: string, content: string): void;
    
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
    isFile(path: string): boolean;
    
    mkdir(path: string): boolean;
    readdir(path: string): FSEntry[];
    
    rename(oldPath: string, newPath: string): boolean;
    delete(path: string): boolean;
    move(srcPath: string, destDir: string): boolean;
    copy(srcPath: string, destDir: string): boolean;
    
    getEntry(path: string): FSEntry | null;
    getAllFiles(): FSFile[];
    
    serialize(): string;
    deserialize(data: string): void;
    
    onChange(callback: (path: string, type: 'create' | 'update' | 'delete' | 'rename') => void): void;
}

export const ALLOWED_EXTENSIONS = new Set([
    '.idyl',
    '.txt', 
    '.json',
    '.md',
    '.csv',
    '.xml',
    '.html',
    '.css',
    '.js',
]);

export function getExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot) : '';
}

export function isTextFile(filename: string): boolean {
    const ext = getExtension(filename);
    return ext === '' || ALLOWED_EXTENSIONS.has(ext);
}

export function normalizePath(path: string): string {
    let normalized = path.replace(/\/+/g, '/');
    if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

export function getParentPath(path: string): string | null {
    const normalized = normalizePath(path);
    if (normalized === '/') return null;
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash === 0 ? '/' : normalized.substring(0, lastSlash);
}

export function getFileName(path: string): string {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return normalized.substring(lastSlash + 1);
}

export function joinPath(...parts: string[]): string {
    return normalizePath(parts.join('/'));
}