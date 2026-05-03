import { BrowserFS } from './browser-fs';
export interface FileTreeCallbacks {
    onFileSelect: (path: string) => void;
    onFileCreate: (path: string) => void;
    onFileDelete: (path: string) => void;
    onFileRename: (oldPath: string, newPath: string) => void;
    onUpload?: () => void;
    onDownload?: () => void;
}
export * from '../modal';
export declare class FileTree {
    private container;
    private fs;
    private callbacks;
    private selectedPath;
    private contextMenu;
    constructor(container: HTMLElement, fs: BrowserFS, callbacks: FileTreeCallbacks);
    render(): void;
    private renderDirectory;
    private createTreeItem;
    private getIcon;
    private selectFile;
    setSelectedPath(path: string | null): void;
    private showContextMenu;
    private hideContextMenu;
    private promptNewFile;
    private promptNewFolder;
    private promptRename;
    private promptDelete;
    private getParentPath;
    private normalizePath;
    private mkdirRecursive;
    private downloadFile;
    private draggedPath;
    private onDragStart;
    private onDragOver;
    private onDragLeave;
    private onDrop;
    private escapeHTML;
}
//# sourceMappingURL=file-tree.d.ts.map