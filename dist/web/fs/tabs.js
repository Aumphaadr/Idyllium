"use strict";
// src/web/fs/tabs.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = void 0;
const types_1 = require("./types");
class Tabs {
    constructor(container, callbacks) {
        this.tabs = [];
        this.activeTab = null;
        let wrapper = container.querySelector('.tabs-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'tabs-wrapper';
            container.insertBefore(wrapper, container.firstChild);
        }
        this.wrapper = wrapper;
        this.callbacks = callbacks;
        this.render();
    }
    openTab(path) {
        const existing = this.tabs.find(t => t.path === path);
        if (existing) {
            this.activeTab = path;
            this.render();
            return;
        }
        const tab = {
            path,
            name: (0, types_1.getFileName)(path),
            modified: false,
        };
        this.tabs.push(tab);
        this.activeTab = path;
        this.render();
    }
    closeTab(path) {
        const index = this.tabs.findIndex(t => t.path === path);
        if (index === -1)
            return false;
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
            }
            else {
                this.activeTab = null;
            }
        }
        this.render();
        return true;
    }
    closeAllTabs() {
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
    setModified(path, modified) {
        const tab = this.tabs.find(t => t.path === path);
        if (tab) {
            tab.modified = modified;
            this.render();
        }
    }
    getActiveTab() {
        return this.activeTab;
    }
    isOpen(path) {
        return this.tabs.some(t => t.path === path);
    }
    hasModified() {
        return this.tabs.some(t => t.modified);
    }
    updateTabPath(oldPath, newPath) {
        const tab = this.tabs.find(t => t.path === oldPath);
        if (tab) {
            tab.path = newPath;
            tab.name = (0, types_1.getFileName)(newPath);
            if (this.activeTab === oldPath) {
                this.activeTab = newPath;
            }
            this.render();
        }
    }
    removeTabsForPath(path) {
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
    getTabs() {
        return [...this.tabs];
    }
    render() {
        this.wrapper.innerHTML = '';
        if (this.tabs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tabs-empty';
            empty.textContent = 'Нет открытых файлов';
            this.wrapper.appendChild(empty);
            return;
        }
        for (const tab of this.tabs) {
            const tabEl = this.createTabElement(tab);
            this.wrapper.appendChild(tabEl);
        }
    }
    createTabElement(tab) {
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
            if (e.target.classList.contains('tab-close'))
                return;
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
    getFileIcon(filename) {
        const ext = (0, types_1.getExtension)(filename);
        const icons = {
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
    escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
exports.Tabs = Tabs;
//# sourceMappingURL=tabs.js.map