"use strict";
// src/web/autocomplete.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Autocomplete = void 0;
const KIND_ICONS = {
    keyword: '🔑',
    type: '📦',
    function: '⚡',
    method: '🔧',
    variable: '📌',
    property: '🏷️',
    library: '📚',
    snippet: '✨',
};
class Autocomplete {
    constructor(parent) {
        this.items = [];
        this.filteredItems = [];
        this.selectedIndex = 0;
        this.visible = false;
        this.onSelectCallback = null;
        this.onCancelCallback = null;
        this.isSelecting = false;
        this.lastSelectedTime = 0;
        this.container = document.createElement('div');
        this.container.className = 'autocomplete-container';
        this.container.style.display = 'none';
        this.container.style.position = 'absolute';
        this.list = document.createElement('div');
        this.list.className = 'autocomplete-list';
        this.container.appendChild(this.list);
        parent.appendChild(this.container);
    }
    show(items, x, y, filter, onSelect, onCancel) {
        this.items = items;
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;
        this.selectedIndex = 0;
        this.isSelecting = false;
        this.applyFilter(filter);
        if (this.filteredItems.length === 0) {
            this.hide();
            return;
        }
        this.container.style.left = `${Math.max(0, x)}px`;
        this.container.style.top = `${y}px`;
        this.container.style.display = 'block';
        this.visible = true;
        this.render();
    }
    hide() {
        this.container.style.display = 'none';
        this.visible = false;
        this.selectedIndex = 0;
        this.isSelecting = false;
        if (this.onCancelCallback) {
            this.onCancelCallback();
            this.onCancelCallback = null;
        }
    }
    isVisible() {
        return this.visible;
    }
    updateFilter(text) {
        this.applyFilter(text);
        if (this.filteredItems.length === 0) {
            this.hide();
        }
        else {
            this.render();
        }
    }
    applyFilter(text) {
        const lower = text.toLowerCase();
        if (lower.length === 0) {
            this.filteredItems = [...this.items];
        }
        else {
            this.filteredItems = this.items.filter(item => item.label.toLowerCase().startsWith(lower));
        }
        this.filteredItems.sort((a, b) => {
            const aExact = a.label.toLowerCase() === lower;
            const bExact = b.label.toLowerCase() === lower;
            if (aExact && !bExact)
                return -1;
            if (!aExact && bExact)
                return 1;
            return a.label.length - b.label.length;
        });
        if (this.selectedIndex >= this.filteredItems.length) {
            this.selectedIndex = 0;
        }
    }
    moveUp() {
        if (this.filteredItems.length === 0)
            return;
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.render();
        this.scrollToSelected();
    }
    moveDown() {
        if (this.filteredItems.length === 0)
            return;
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this.render();
        this.scrollToSelected();
    }
    selectCurrent() {
        const now = Date.now();
        if (this.isSelecting || (now - this.lastSelectedTime) < 300) {
            console.log('selectCurrent: blocked (already selecting or too soon)');
            return null;
        }
        if (this.filteredItems.length === 0)
            return null;
        this.isSelecting = true;
        this.lastSelectedTime = now;
        const item = this.filteredItems[this.selectedIndex];
        this.visible = false;
        this.container.style.display = 'none';
        if (this.onSelectCallback) {
            this.onSelectCallback(item);
        }
        setTimeout(() => {
            this.isSelecting = false;
        }, 500);
        return item;
    }
    render() {
        this.list.innerHTML = '';
        const maxItems = 8;
        for (let i = 0; i < Math.min(this.filteredItems.length, maxItems); i++) {
            const item = this.filteredItems[i];
            const el = document.createElement('div');
            el.className = 'autocomplete-item' + (i === this.selectedIndex ? ' selected' : '');
            el.dataset.index = String(i);
            const icon = KIND_ICONS[item.kind] || '📄';
            const detail = item.detail
                ? `<span class="autocomplete-detail">${this.escape(item.detail)}</span>`
                : '';
            el.innerHTML = `
                <span class="autocomplete-icon">${icon}</span>
                <span class="autocomplete-label">${this.escape(item.label)}</span>
                ${detail}
            `;
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectedIndex = i;
                this.selectCurrent();
            });
            this.list.appendChild(el);
        }
        if (this.filteredItems.length > maxItems) {
            const more = document.createElement('div');
            more.className = 'autocomplete-more';
            more.textContent = `ещё ${this.filteredItems.length - maxItems}...`;
            this.list.appendChild(more);
        }
    }
    scrollToSelected() {
        const selected = this.list.querySelector('.autocomplete-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }
    escape(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
exports.Autocomplete = Autocomplete;
//# sourceMappingURL=autocomplete.js.map