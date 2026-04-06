// src/web/autocomplete.ts

export interface CompletionItem {
    label: string;
    kind: CompletionKind;
    detail?: string;
    insertText?: string;
    needsSemicolon?: boolean;
}

export type CompletionKind = 
    | 'keyword'
    | 'type'
    | 'function'
    | 'method'
    | 'variable'
    | 'property'
    | 'library'
    | 'snippet';

const KIND_ICONS: Record<CompletionKind, string> = {
    keyword: '🔑',
    type: '📦',
    function: '⚡',
    method: '🔧',
    variable: '📌',
    property: '🏷️',
    library: '📚',
    snippet: '✨',
};

export class Autocomplete {
    private container: HTMLElement;
    private list: HTMLElement;
    private items: CompletionItem[] = [];
    private filteredItems: CompletionItem[] = [];
    private selectedIndex: number = 0;
    private visible: boolean = false;
    private onSelectCallback: ((item: CompletionItem) => void) | null = null;
    private onCancelCallback: (() => void) | null = null;
    
    private isSelecting: boolean = false;
    private lastSelectedTime: number = 0;

    constructor(parent: HTMLElement) {
        this.container = document.createElement('div');
        this.container.className = 'autocomplete-container';
        this.container.style.display = 'none';
        this.container.style.position = 'absolute';

        this.list = document.createElement('div');
        this.list.className = 'autocomplete-list';
        this.container.appendChild(this.list);

        parent.appendChild(this.container);
    }

    show(
        items: CompletionItem[],
        x: number,
        y: number,
        filter: string,
        onSelect: (item: CompletionItem) => void,
        onCancel: () => void
    ): void {
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

    hide(): void {
        this.container.style.display = 'none';
        this.visible = false;
        this.selectedIndex = 0;
        this.isSelecting = false;
        if (this.onCancelCallback) {
            this.onCancelCallback();
            this.onCancelCallback = null;
        }
    }

    isVisible(): boolean {
        return this.visible;
    }

    updateFilter(text: string): void {
        this.applyFilter(text);
        if (this.filteredItems.length === 0) {
            this.hide();
        } else {
            this.render();
        }
    }

    private applyFilter(text: string): void {
        const lower = text.toLowerCase();
        
        if (lower.length === 0) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter(item =>
                item.label.toLowerCase().startsWith(lower)
            );
        }

        this.filteredItems.sort((a, b) => {
            const aExact = a.label.toLowerCase() === lower;
            const bExact = b.label.toLowerCase() === lower;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            return a.label.length - b.label.length;
        });

        if (this.selectedIndex >= this.filteredItems.length) {
            this.selectedIndex = 0;
        }
    }

    moveUp(): void {
        if (this.filteredItems.length === 0) return;
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.render();
        this.scrollToSelected();
    }

    moveDown(): void {
        if (this.filteredItems.length === 0) return;
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
        this.render();
        this.scrollToSelected();
    }

    selectCurrent(): CompletionItem | null {
        const now = Date.now();
        if (this.isSelecting || (now - this.lastSelectedTime) < 300) {
            console.log('selectCurrent: blocked (already selecting or too soon)');
            return null;
        }
        
        if (this.filteredItems.length === 0) return null;
        
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

    private render(): void {
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

    private scrollToSelected(): void {
        const selected = this.list.querySelector('.autocomplete-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    private escape(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}