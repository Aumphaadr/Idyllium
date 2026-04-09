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
export declare const ALLOWED_EXTENSIONS: Set<string>;
export declare function getExtension(filename: string): string;
export declare function isTextFile(filename: string): boolean;
export declare function normalizePath(path: string): string;
export declare function getParentPath(path: string): string | null;
export declare function getFileName(path: string): string;
export declare function joinPath(...parts: string[]): string;
//# sourceMappingURL=types.d.ts.map