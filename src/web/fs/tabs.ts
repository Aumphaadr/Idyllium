// src/web/fs/tabs.ts

import { getFileName, getExtension } from './types';

export interface Tab {
    path: string;
    name: string;
    modified: boolean;
}

export interface TabsCallbacks {
    onTabSelect: (path: string) => void;
    onTabClose: (path: string) => void;
}

export class Tabs {
    private container: HTMLElement;
    private tabs: Tab[] = [];
    private activeTab: string | null = null;
    private callbacks: TabsCallbacks;

    constructor(container: HTMLElement, callbacks: TabsCallbacks) {
        this.container = container;
        this.container.className = 'tabs-container';
        this.callbacks = callbacks;
        this.render();
    }

    openTab(path: string): void {
        const existing = this.tabs.find(t => t.path === path);
        if (existing) {
            this.activeTab = path;
            this.render();
            return;
        }

        const tab: Tab = {
            path,
            name: getFileName(path),
            modified: false,
        };

        this.tabs.push(tab);
        this.activeTab = path;
        this.render();
    }

    closeTab(path: string): boolean {
        const index = this.tabs.findIndex(t => t.path === path);
        if (index === -1) return false;

        const tab = this.tabs[index];
        
        if (tab.modified) {
            if (!confirm(`Файл "${tab.name}" имеет несохранённые изменения. Закрыть без сохранения?`)) {
                return false;
            }
        }

        this.tabs.splice(index, 1);

        if (this.activeTab === path) {
            if (this.tabs.length > 0) {
                const newIndex = Math.min(index, this.tabs.length - 1);
                this.activeTab = this.tabs[newIndex].path;
                this.callbacks.onTabSelect(this.activeTab);
            } else {
                this.activeTab = null;
            }
        }

        this.render();
        return true;
    }

    closeAllTabs(): void {
        const modified = this.tabs.filter(t => t.modified);
        if (modified.length > 0) {
            if (!confirm(`${modified.length} файл(ов) имеют несохранённые изменения. Закрыть все?`)) {
                return;
            }
        }

        this.tabs = [];
        this.activeTab = null;
        this.render();
    }

    setModified(path: string, modified: boolean): void {
        const tab = this.tabs.find(t => t.path === path);
        if (tab) {
            tab.modified = modified;
            this.render();
        }
    }

    getActiveTab(): string | null {
        return this.activeTab;
    }

    isOpen(path: string): boolean {
        return this.tabs.some(t => t.path === path);
    }

    hasModified(): boolean {
        return this.tabs.some(t => t.modified);
    }

    updateTabPath(oldPath: string, newPath: string): void {
        const tab = this.tabs.find(t => t.path === oldPath);
        if (tab) {
            tab.path = newPath;
            tab.name = getFileName(newPath);
            if (this.activeTab === oldPath) {
                this.activeTab = newPath;
            }
            this.render();
        }
    }

    removeTabsForPath(path: string): void {
        this.tabs = this.tabs.filter(t => {
            if (t.path === path || t.path.startsWith(path + '/')) {
                if (this.activeTab === t.path) {
                    this.activeTab = null;
                }
                return false;
            }
            return true;
        });

        if (this.activeTab === null && this.tabs.length > 0) {
            this.activeTab = this.tabs[0].path;
            this.callbacks.onTabSelect(this.activeTab);
        }

        this.render();
    }

    getTabs(): Tab[] {
        return [...this.tabs];
    }

    private render(): void {
        this.container.innerHTML = '';

        if (this.tabs.length === 0) {
            this.container.innerHTML = '<div class="tabs-empty">Нет открытых файлов</div>';
            return;
        }

        const tabsWrapper = document.createElement('div');
        tabsWrapper.className = 'tabs-wrapper';

        for (const tab of this.tabs) {
            const tabEl = this.createTabElement(tab);
            tabsWrapper.appendChild(tabEl);
        }

        this.container.appendChild(tabsWrapper);
    }

    private createTabElement(tab: Tab): HTMLElement {
        const el = document.createElement('div');
        el.className = 'tab';
        if (tab.path === this.activeTab) {
            el.classList.add('active');
        }
        if (tab.modified) {
            el.classList.add('modified');
        }

        const icon = this.getFileIcon(tab.name);
        const modifiedDot = tab.modified ? '<span class="tab-modified-dot">●</span>' : '';

        el.innerHTML = `
            <span class="tab-icon">${icon}</span>
            <span class="tab-name">${this.escapeHTML(tab.name)}</span>
            ${modifiedDot}
            <button class="tab-close" title="Закрыть">×</button>
        `;

        el.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('tab-close')) return;
            this.activeTab = tab.path;
            this.render();
            this.callbacks.onTabSelect(tab.path);
        });

        el.querySelector('.tab-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.closeTab(tab.path)) {
                this.callbacks.onTabClose(tab.path);
            }
        });

        el.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                if (this.closeTab(tab.path)) {
                    this.callbacks.onTabClose(tab.path);
                }
            }
        });

        return el;
    }

    private getFileIcon(filename: string): string {
        const ext = getExtension(filename);
        const icons: Record<string, string> = {
            '.idyl': '📜',
            '.txt': '📄',
            '.json': '📋',
            '.md': '📝',
            '.csv': '📊',
            '.xml': '📰',
            '.html': '🌐',
            '.css': '🎨',
            '.js': '⚡',
        };
        return icons[ext] ?? '📄';
    }

    private escapeHTML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}