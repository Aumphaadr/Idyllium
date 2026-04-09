export interface Tab {
    path: string;
    name: string;
    modified: boolean;
}
export interface TabsCallbacks {
    onTabSelect: (path: string) => void;
    onTabClose: (path: string) => void;
}
export declare class Tabs {
    private wrapper;
    private tabs;
    private activeTab;
    private callbacks;
    constructor(container: HTMLElement, callbacks: TabsCallbacks);
    openTab(path: string): void;
    closeTab(path: string): boolean;
    closeAllTabs(): void;
    setModified(path: string, modified: boolean): void;
    getActiveTab(): string | null;
    isOpen(path: string): boolean;
    hasModified(): boolean;
    updateTabPath(oldPath: string, newPath: string): void;
    removeTabsForPath(path: string): void;
    getTabs(): Tab[];
    private render;
    private createTabElement;
    private getFileIcon;
    private escapeHTML;
}
//# sourceMappingURL=tabs.d.ts.map