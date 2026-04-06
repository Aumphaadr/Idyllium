// src/web/editor.ts

import { highlightToHTML } from './highlighter';
import { Autocomplete, CompletionItem } from './autocomplete';
import { getCompletions, parseCompletionContext } from './completion-provider';

export interface EditorOptions {
    initialValue?: string;
    tabSize?: number;
    fontSize?: number;
    lineHeight?: number;
}

const PAIRS: Record<string, string> = {
    '(': ')',
    '{': '}',
    '[': ']',
    '"': '"',
    "'": "'",
};

const OPENING = new Set(Object.keys(PAIRS));
const CLOSING = new Set(Object.values(PAIRS));

export class Editor {
    private container: HTMLElement;
    private wrapper: HTMLElement;
    private lineNumbers: HTMLElement;
    private textarea: HTMLTextAreaElement;
    private highlight: HTMLElement;
    private pre: HTMLPreElement;

    private tabSize: number;
    private fontSize: number;
    private lineHeight: number;

    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private lastSavedValue: string = '';

    private autocomplete: Autocomplete;
    private autocompleteActive: boolean = false;
    private suppressAutocomplete: boolean = false;
    private lastInsertTime: number = 0;

    constructor(container: HTMLElement, options: EditorOptions = {}) {
        this.container = container;
        this.tabSize = options.tabSize ?? 4;
        this.fontSize = options.fontSize ?? 15;
        this.lineHeight = options.lineHeight ?? 1.6;

        this.container.innerHTML = '';
        this.container.classList.add('editor-container');

        this.lineNumbers = document.createElement('div');
        this.lineNumbers.className = 'editor-line-numbers';
        this.container.appendChild(this.lineNumbers);

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'editor-wrapper';
        this.container.appendChild(this.wrapper);

        this.pre = document.createElement('pre');
        this.pre.className = 'editor-highlight';
        this.highlight = document.createElement('code');
        this.pre.appendChild(this.highlight);
        this.wrapper.appendChild(this.pre);

        this.textarea = document.createElement('textarea');
        this.textarea.className = 'editor-textarea';
        this.textarea.spellcheck = false;
        this.textarea.autocomplete = 'off';
        this.textarea.setAttribute('autocapitalize', 'off');
        this.textarea.setAttribute('autocorrect', 'off');
        this.wrapper.appendChild(this.textarea);

        this.autocomplete = new Autocomplete(this.wrapper);

        this.applyStyles();

        this.textarea.addEventListener('input', () => this.onInput());
        this.textarea.addEventListener('scroll', () => this.syncScroll());
        this.textarea.addEventListener('keydown', (e) => this.onKeyDown(e));

        this.textarea.addEventListener('keyup', (e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 
                 'PageUp', 'PageDown'].includes(e.key)) {
                this.checkAutocompleteContext();
            }
        });

        this.textarea.addEventListener('blur', () => {
            setTimeout(() => {
                if (!this.autocompleteActive) {
                    this.autocomplete.hide();
                }
            }, 150);
        });
        
        this.textarea.addEventListener('mouseup', () => {
            if (this.autocomplete.isVisible()) {
                const value = this.textarea.value;
                const pos = this.textarea.selectionStart;
                const ctx = parseCompletionContext(value, pos);
                
                if (ctx.currentWord.length === 0 && ctx.afterDot === null) {
                    this.autocomplete.hide();
                }
            }
        });

        this.textarea.addEventListener('click', () => {
            this.checkAutocompleteContext();
        });
        
        this.textarea.addEventListener('keyup', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(e.key)) {
                this.checkAutocompleteContext();
            }
        });

        const initial = options.initialValue ?? '';
        this.textarea.value = initial;
        this.lastSavedValue = initial;
        this.pushUndo();
        this.updateHighlight();
        this.updateLineNumbers();
    }

    private checkAutocompleteContext(): void {
        if (!this.autocomplete.isVisible()) return;
        
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = parseCompletionContext(value, pos);
        
        if (ctx.currentWord.length < 2 && ctx.afterDot === null) {
            this.autocomplete.hide();
            this.autocompleteActive = false;
        }
    }

    getValue(): string {
        return this.textarea.value;
    }

    setValue(value: string): void {
        this.textarea.value = value;
        this.pushUndo();
        this.updateHighlight();
        this.updateLineNumbers();
    }

    focus(): void {
        this.textarea.focus();
    }

    setFontSize(size: number): void {
        this.fontSize = size;
        this.applyStyles();
        this.updateLineNumbers();
    }

    setLineHeight(height: number): void {
        this.lineHeight = height;
        this.applyStyles();
        this.updateLineNumbers();
    }

    highlightErrors(lines: number[]): void {
        this.lineNumbers.querySelectorAll('.line-error').forEach(el => {
            el.classList.remove('line-error');
        });

        for (const line of lines) {
            const lineEl = this.lineNumbers.children[line - 1] as HTMLElement | undefined;
            if (lineEl) {
                lineEl.classList.add('line-error');
            }
        }
    }

    clearErrors(): void {
        this.lineNumbers.querySelectorAll('.line-error').forEach(el => {
            el.classList.remove('line-error');
        });
    }

    private applyStyles(): void {
        const fontFamily = "'Source Code Pro', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace";
        const styles = `
            font-family: ${fontFamily};
            font-size: ${this.fontSize}px;
            line-height: ${this.lineHeight};
            tab-size: ${this.tabSize};
        `;

        this.textarea.style.cssText += styles;
        this.pre.style.cssText += styles;
        this.lineNumbers.style.cssText += `
            font-family: ${fontFamily};
            font-size: ${this.fontSize}px;
            line-height: ${this.lineHeight};
        `;
    }

    private onInput(): void {
        if (this.suppressAutocomplete) {
            return;
        }
        
        this.updateHighlight();
        this.updateLineNumbers();
        this.pushUndo();
        this.triggerAutocomplete();
    }

    private updateHighlight(): void {
        const code = this.textarea.value;
        this.highlight.innerHTML = highlightToHTML(code) + '\n ';
    }

    private updateLineNumbers(): void {
        const lines = this.textarea.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) {
            html += `<div class="line-number">${i}</div>`;
        }
        this.lineNumbers.innerHTML = html;
    }

    private syncScroll(): void {
        this.pre.scrollTop = this.textarea.scrollTop;
        this.pre.scrollLeft = this.textarea.scrollLeft;
        this.lineNumbers.scrollTop = this.textarea.scrollTop;
    }

    private triggerAutocomplete(): void {
        if (this.suppressAutocomplete) {
            return;
        }
        
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = parseCompletionContext(value, pos);

        const charBefore = pos > 0 ? value[pos - 1] : '';
        const charAfter = pos < value.length ? value[pos] : '';
        
        if (charBefore === '(' && charAfter === ')') {
            if (this.autocomplete.isVisible()) {
                this.autocomplete.hide();
            }
            return;
        }
    
        if (ctx.currentWord.length >= 2 || ctx.afterDot !== null) {
            this.showAutocomplete();
        } else if (this.autocomplete.isVisible()) {
            this.autocomplete.hide();
        }
    }

    private showAutocomplete(): void {
        if (this.suppressAutocomplete) {
            return;
        }
        
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = parseCompletionContext(value, pos);
    
        const items = getCompletions(ctx);
        if (items.length === 0) {
            this.autocomplete.hide();
            return;
        }

        const coords = this.getCaretPosition();
        
        this.autocomplete.show(
            items,
            coords.x,
            coords.y,
            ctx.currentWord,
            (item) => {
                this.insertCompletion(item);
            },
            () => {
                this.autocompleteActive = false;
            }
        );
        this.autocompleteActive = true;
    }

    private getCaretPosition(): { x: number; y: number } {
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        
        const textBefore = value.substring(0, pos);
        const lines = textBefore.split('\n');
        const lineNumber = lines.length;
        const column = lines[lines.length - 1].length;

        const lineHeightPx = this.fontSize * this.lineHeight;
        const charWidthPx = this.fontSize * 0.6;

        const y = (lineNumber * lineHeightPx) - this.textarea.scrollTop + 4;
        const x = (column * charWidthPx) - this.textarea.scrollLeft + 12;

        return { x, y };
    }

    private insertCompletion(item: CompletionItem): void {
        const now = Date.now();
        if (this.suppressAutocomplete || (now - this.lastInsertTime) < 500) {
            console.log('insertCompletion: blocked (too soon)');
            return;
        }
        this.lastInsertTime = now;
        this.suppressAutocomplete = true;
        
        console.log('=== insertCompletion ===');
        console.log('item.label:', item.label);
        console.log('item.insertText:', item.insertText);
        console.log('item.needsSemicolon:', item.needsSemicolon);
        
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = parseCompletionContext(value, pos);
        
        console.log('value:', value);
        console.log('pos:', pos);
        console.log('ctx.currentWord:', ctx.currentWord);
        console.log('ctx.afterDot:', ctx.afterDot);
    
        let wordStart = pos;
        while (wordStart > 0 && /[a-zA-Z0-9_]/.test(value[wordStart - 1])) {
            wordStart--;
        }
    
        let afterDot = false;
        if (wordStart > 0 && value[wordStart - 1] === '.') {
            afterDot = true;
        }
    
        let finalText: string;
        let cursorPos: number;
    
        if (afterDot) {
            const label = item.label;
            const insert = item.insertText ?? '';
            
            if (insert === '()') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            } else if (insert === '($0)') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            } else {
                finalText = label + insert;
                if (insert.includes('$0')) {
                    const offset = insert.indexOf('$0');
                    finalText = label + insert.replace('$0', '');
                    cursorPos = wordStart + label.length + offset;
                } else if (insert.startsWith('(')) {
                    cursorPos = wordStart + label.length + 1;
                } else {
                    cursorPos = wordStart + finalText.length;
                }
            }
        } else {
            const label = item.label;
            const insert = item.insertText ?? '';
            
            if (insert === '()') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            } else if (insert === '($0)') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            } else {
                finalText = label + insert;
                if (insert.includes('$0')) {
                    const offset = insert.indexOf('$0');
                    finalText = label + insert.replace('$0', '');
                    cursorPos = wordStart + label.length + offset;
                } else if (insert.startsWith('(')) {
                    cursorPos = wordStart + label.length + 1;
                } else {
                    cursorPos = wordStart + finalText.length;
                }
            }
        }
    
        let needsSemicolon = item.needsSemicolon === true;
        
        if (needsSemicolon) {
            const charAfterCursor = value[pos];
            if (charAfterCursor !== ';') {
                finalText = finalText + ';';
                if (cursorPos === wordStart + finalText.length - 1) {
                    cursorPos = wordStart + finalText.length;
                }
            }
        }
    
        this.textarea.value = 
            value.substring(0, wordStart) + 
            finalText + 
            value.substring(pos);
    
        this.textarea.selectionStart = this.textarea.selectionEnd = cursorPos;
        
        this.autocomplete.hide();
        this.autocompleteActive = false;
        this.updateHighlight();
        this.updateLineNumbers();
        this.pushUndo();
        
        setTimeout(() => {
            this.suppressAutocomplete = false;
            console.log('Autocomplete re-enabled');
        }, 500);
        
        this.textarea.focus();
    }

    private onKeyDown(e: KeyboardEvent): void {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;
        const hasSelection = start !== end;

        if (e.key === 'Home' && !e.ctrlKey && !e.metaKey && !this.autocomplete.isVisible()) {
            e.preventDefault();
            let lineStart = start;
            while (lineStart > 0 && value[lineStart - 1] !== '\n') {
                lineStart--;
            }
            
            let firstNonSpace = lineStart;
            while (firstNonSpace < value.length && 
                   value[firstNonSpace] !== '\n' &&
                   (value[firstNonSpace] === ' ' || value[firstNonSpace] === '\t')) {
                firstNonSpace++;
            }
            
            const target = (start === firstNonSpace) ? lineStart : firstNonSpace;
            
            if (e.shiftKey) {
                this.textarea.setSelectionRange(target, end);
            } else {
                this.textarea.setSelectionRange(target, target);
            }
            
            return;
        }

        if (this.autocomplete.isVisible()) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.autocomplete.moveUp();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.autocomplete.moveDown();
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                
                if (this.suppressAutocomplete) {
                    console.log('onKeyDown: suppressed, skipping');
                    return;
                }
                
                const selected = this.autocomplete.selectCurrent();
                if (selected) {
                    this.insertCompletion(selected);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.autocomplete.hide();
                this.autocompleteActive = false;
                return;
            }
        }

        if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            this.showAutocomplete();
            return;
        }

        if (e.key === 'Tab' && !this.autocomplete.isVisible()) {
            e.preventDefault();
            const spaces = ' '.repeat(this.tabSize);
            this.textarea.value = value.substring(0, start) + spaces + value.substring(end);
            this.textarea.selectionStart = this.textarea.selectionEnd = start + this.tabSize;
            this.onInput();
            return;
        }

        if (e.key === 'Enter' && !this.autocomplete.isVisible()) {
            e.preventDefault();

            let lineStart = start;
            while (lineStart > 0 && value[lineStart - 1] !== '\n') {
                lineStart--;
            }

            let indent = '';
            let i = lineStart;
            while (i < value.length && (value[i] === ' ' || value[i] === '\t')) {
                indent += value[i];
                i++;
            }

            const charBefore = start > 0 ? value[start - 1] : '';
            const charAfter = start < value.length ? value[start] : '';

            if (charBefore === '{') {
                indent += ' '.repeat(this.tabSize);
            }

            let insertion = '\n' + indent;

            if (charBefore === '{' && charAfter === '}') {
                const baseIndent = indent.substring(0, Math.max(0, indent.length - this.tabSize));
                insertion = '\n' + indent + '\n' + baseIndent;
                this.textarea.value = 
                    value.substring(0, start) + insertion + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 1 + indent.length;
            } else {
                this.textarea.value = 
                    value.substring(0, start) + insertion + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + insertion.length;
            }

            this.onInput();
            return;
        }

        if (OPENING.has(e.key)) {
            const open = e.key;
            const close = PAIRS[open];

            if ((open === '"' || open === "'") && value[start] === open && !hasSelection) {
                e.preventDefault();
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
                return;
            }

            e.preventDefault();

            if (hasSelection) {
                const selected = value.substring(start, end);
                this.textarea.value = 
                    value.substring(0, start) + open + selected + close + value.substring(end);
                this.textarea.selectionStart = start + 1;
                this.textarea.selectionEnd = end + 1;
            } else {
                this.textarea.value = 
                    value.substring(0, start) + open + close + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
            }

            this.onInput();
            return;
        }

        if (CLOSING.has(e.key) && !hasSelection) {
            const close = e.key;
            if (value[start] === close) {
                e.preventDefault();
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 1;
                return;
            }
        }

        if (e.key === 'Backspace' && !hasSelection && start > 0) {
            const charBefore = value[start - 1];
            const charAfter = value[start];

            if (OPENING.has(charBefore) && PAIRS[charBefore] === charAfter) {
                e.preventDefault();
                this.textarea.value = 
                    value.substring(0, start - 1) + value.substring(start + 1);
                this.textarea.selectionStart = this.textarea.selectionEnd = start - 1;
                this.onInput();
                return;
            }
        }

        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
            return;
        }

        if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
            e.preventDefault();
            this.redo();
            return;
        }
    }

    private pushUndo(): void {
        const current = this.textarea.value;
        if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== current) {
            this.undoStack.push(current);
            if (this.undoStack.length > 100) {
                this.undoStack.shift();
            }
            this.redoStack = [];
        }
    }

    private undo(): void {
        if (this.undoStack.length > 1) {
            const current = this.undoStack.pop()!;
            this.redoStack.push(current);
            const prev = this.undoStack[this.undoStack.length - 1];
            this.textarea.value = prev;
            this.updateHighlight();
            this.updateLineNumbers();
        }
    }

    private redo(): void {
        if (this.redoStack.length > 0) {
            const next = this.redoStack.pop()!;
            this.undoStack.push(next);
            this.textarea.value = next;
            this.updateHighlight();
            this.updateLineNumbers();
        }
    }
}