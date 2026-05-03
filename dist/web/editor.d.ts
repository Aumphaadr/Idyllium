export interface EditorOptions {
    initialValue?: string;
    tabSize?: number;
    fontSize?: number;
    lineHeight?: number;
}
export declare class Editor {
    private container;
    private wrapper;
    private lineNumbers;
    private textarea;
    private highlight;
    private pre;
    private tabSize;
    private fontSize;
    private lineHeight;
    private undoStack;
    private redoStack;
    private lastSavedValue;
    private autocomplete;
    private autocompleteActive;
    private suppressAutocomplete;
    private lastInsertTime;
    constructor(container: HTMLElement, options?: EditorOptions);
    private normalizeKey;
    private getCurrentLineIndent;
    private handlePaste;
    private checkAutocompleteContext;
    getValue(): string;
    setValue(value: string): void;
    focus(): void;
    setFontSize(size: number): void;
    setLineHeight(height: number): void;
    highlightErrors(lines: number[]): void;
    clearErrors(): void;
    formatCode(): void;
    private formatIdylliumCode;
    private applyStyles;
    private onInput;
    private updateHighlight;
    private updateLineNumbers;
    private syncScroll;
    private triggerAutocomplete;
    private showAutocomplete;
    private getCaretPosition;
    private insertCompletion;
    private onKeyDown;
    private pushUndo;
    private undo;
    private redo;
}
//# sourceMappingURL=editor.d.ts.map