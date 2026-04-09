import { FileSystem, FSEntry, FSFile } from './types';
export declare class BrowserFS implements FileSystem {
    private entries;
    private changeListeners;
    constructor();
    private initializeRoot;
    private loadFromStorage;
    private createDefaultProject;
    private saveToStorage;
    private emit;
    readFile(path: string): string | null;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
    isFile(path: string): boolean;
    mkdir(path: string): boolean;
    private mkdirRecursive;
    readdir(path: string): FSEntry[];
    rename(oldPath: string, newPath: string): boolean;
    private renameDirectory;
    delete(path: string): boolean;
    move(srcPath: string, destDir: string): boolean;
    copy(srcPath: string, destDir: string): boolean;
    private copyDirectory;
    getEntry(path: string): FSEntry | null;
    getAllFiles(): FSFile[];
    serialize(): string;
    deserialize(data: string): void;
    onChange(callback: (path: string, type: 'create' | 'update' | 'delete' | 'rename') => void): void;
    toggleDirectory(path: string): void;
    setFileModified(path: string, modified: boolean): void;
    exportAsJSON(): string;
    importFromJSON(json: string): void;
    clear(): void;
}
//# sourceMappingURL=browser-fs.d.ts.map