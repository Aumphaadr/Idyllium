export interface CompletionItem {
    label: string;
    kind: CompletionKind;
    detail?: string;
    insertText?: string;
    needsSemicolon?: boolean;
}
export type CompletionKind = 'keyword' | 'type' | 'function' | 'method' | 'variable' | 'property' | 'library' | 'snippet';
export declare class Autocomplete {
    private container;
    private list;
    private items;
    private filteredItems;
    private selectedIndex;
    private visible;
    private onSelectCallback;
    private onCancelCallback;
    private isSelecting;
    private lastSelectedTime;
    constructor(parent: HTMLElement);
    show(items: CompletionItem[], x: number, y: number, filter: string, onSelect: (item: CompletionItem) => void, onCancel: () => void): void;
    hide(): void;
    isVisible(): boolean;
    updateFilter(text: string): void;
    private applyFilter;
    moveUp(): void;
    moveDown(): void;
    selectCurrent(): CompletionItem | null;
    private render;
    private scrollToSelected;
    private escape;
}
//# sourceMappingURL=autocomplete.d.ts.map