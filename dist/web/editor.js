"use strict";
// src/web/editor.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Editor = void 0;
const highlighter_1 = require("./highlighter");
const autocomplete_1 = require("./autocomplete");
const completion_provider_1 = require("./completion-provider");
const PAIRS = {
    '(': ')',
    '{': '}',
    '[': ']',
    '"': '"',
    "'": "'",
};
const OPENING = new Set(Object.keys(PAIRS));
const CLOSING = new Set(Object.values(PAIRS));
class Editor {
    constructor(container, options = {}) {
        this.undoStack = [];
        this.redoStack = [];
        this.lastSavedValue = '';
        this.autocompleteActive = false;
        this.suppressAutocomplete = false;
        this.lastInsertTime = 0;
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
        this.autocomplete = new autocomplete_1.Autocomplete(this.wrapper);
        this.applyStyles();
        this.textarea.addEventListener('input', () => this.onInput());
        this.textarea.addEventListener('scroll', () => this.syncScroll());
        this.textarea.addEventListener('keydown', (e) => this.onKeyDown(e));
        this.textarea.addEventListener('paste', (e) => this.handlePaste(e));
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
                const ctx = (0, completion_provider_1.parseCompletionContext)(value, pos);
                if (ctx.currentWord.length === 0 && ctx.afterDot === null) {
                    this.autocomplete.hide();
                }
            }
        });
        this.textarea.addEventListener('click', () => {
            this.checkAutocompleteContext();
        });
        const initial = options.initialValue ?? '';
        this.textarea.value = initial;
        this.lastSavedValue = initial;
        this.pushUndo();
        this.updateHighlight();
        this.updateLineNumbers();
    }
    getCurrentLineIndent(pos) {
        const value = this.textarea.value;
        let lineStart = pos;
        while (lineStart > 0 && value[lineStart - 1] !== '\n') {
            lineStart--;
        }
        let indent = '';
        let i = lineStart;
        while (i < value.length && (value[i] === ' ' || value[i] === '\t')) {
            indent += value[i];
            i++;
        }
        return indent;
    }
    handlePaste(e) {
        e.preventDefault();
        const pastedText = e.clipboardData?.getData('text/plain') || '';
        if (!pastedText)
            return;
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;
        const newValue = value.substring(0, start) + pastedText + value.substring(end);
        this.textarea.value = newValue;
        this.textarea.selectionStart = this.textarea.selectionEnd = start + pastedText.length;
        this.updateHighlight();
        this.updateLineNumbers();
        this.pushUndo();
        setTimeout(() => {
            this.formatCode();
        }, 10);
    }
    checkAutocompleteContext() {
        if (!this.autocomplete.isVisible())
            return;
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = (0, completion_provider_1.parseCompletionContext)(value, pos);
        if (ctx.currentWord.length < 2 && ctx.afterDot === null) {
            this.autocomplete.hide();
            this.autocompleteActive = false;
        }
    }
    getValue() {
        return this.textarea.value;
    }
    setValue(value) {
        this.textarea.value = value;
        this.pushUndo();
        this.updateHighlight();
        this.updateLineNumbers();
    }
    focus() {
        this.textarea.focus();
    }
    setFontSize(size) {
        this.fontSize = size;
        this.applyStyles();
        this.updateLineNumbers();
    }
    setLineHeight(height) {
        this.lineHeight = height;
        this.applyStyles();
        this.updateLineNumbers();
    }
    highlightErrors(lines) {
        this.lineNumbers.querySelectorAll('.line-error').forEach(el => {
            el.classList.remove('line-error');
        });
        for (const line of lines) {
            const lineEl = this.lineNumbers.children[line - 1];
            if (lineEl) {
                lineEl.classList.add('line-error');
            }
        }
    }
    clearErrors() {
        this.lineNumbers.querySelectorAll('.line-error').forEach(el => {
            el.classList.remove('line-error');
        });
    }
    formatCode() {
        const code = this.getValue();
        const formatted = this.formatIdylliumCode(code);
        if (formatted !== code) {
            const cursorPos = this.textarea.selectionStart;
            this.setValue(formatted);
            const newCursorPos = Math.min(cursorPos, formatted.length);
            this.textarea.selectionStart = this.textarea.selectionEnd = newCursorPos;
            this.updateHighlight();
            this.updateLineNumbers();
            this.pushUndo();
        }
    }
    formatIdylliumCode(code) {
        const lines = code.split('\n');
        const formattedLines = [];
        let indentLevel = 0;
        const indentStr = ' '.repeat(this.tabSize);
        const shouldIncreaseIndent = (line) => {
            const trimmed = line.trim();
            if (trimmed.endsWith('{'))
                return true;
            if (trimmed.startsWith('if ') && trimmed.endsWith('{'))
                return true;
            if (trimmed.startsWith('else') && trimmed.endsWith('{'))
                return true;
            if (trimmed.startsWith('for ') && trimmed.endsWith('{'))
                return true;
            if (trimmed.startsWith('while ') && trimmed.endsWith('{'))
                return true;
            if (trimmed.startsWith('function ') && trimmed.endsWith('{'))
                return true;
            if (trimmed.startsWith('class ') && trimmed.endsWith('{'))
                return true;
            return false;
        };
        const shouldDecreaseIndent = (line) => {
            const trimmed = line.trim();
            if (trimmed === '}')
                return true;
            if (trimmed.startsWith('}') && !trimmed.startsWith('} else'))
                return true;
            return false;
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed === '') {
                formattedLines.push('');
                continue;
            }
            if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                formattedLines.push(indentStr.repeat(indentLevel) + trimmed);
                continue;
            }
            let currentIndent = indentLevel;
            if (shouldDecreaseIndent(line)) {
                currentIndent = Math.max(0, indentLevel - 1);
            }
            let formattedLine = indentStr.repeat(currentIndent) + trimmed;
            if (trimmed === '} else {') {
                formattedLine = indentStr.repeat(Math.max(0, indentLevel - 1)) + '} else {';
            }
            formattedLines.push(formattedLine);
            if (shouldIncreaseIndent(line)) {
                indentLevel++;
            }
            else if (shouldDecreaseIndent(line) && trimmed !== '} else {') {
                indentLevel = Math.max(0, indentLevel - 1);
            }
        }
        return formattedLines.map(line => line.replace(/\s+$/, '')).join('\n');
    }
    applyStyles() {
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
    onInput() {
        if (this.suppressAutocomplete) {
            return;
        }
        this.updateHighlight();
        this.updateLineNumbers();
        this.pushUndo();
        this.triggerAutocomplete();
    }
    updateHighlight() {
        const code = this.textarea.value;
        this.highlight.innerHTML = (0, highlighter_1.highlightToHTML)(code) + '\n ';
    }
    updateLineNumbers() {
        const lines = this.textarea.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) {
            html += `<div class="line-number">${i}</div>`;
        }
        this.lineNumbers.innerHTML = html;
    }
    syncScroll() {
        this.pre.scrollTop = this.textarea.scrollTop;
        this.pre.scrollLeft = this.textarea.scrollLeft;
        this.lineNumbers.scrollTop = this.textarea.scrollTop;
    }
    triggerAutocomplete() {
        if (this.suppressAutocomplete) {
            return;
        }
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = (0, completion_provider_1.parseCompletionContext)(value, pos);
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
        }
        else if (this.autocomplete.isVisible()) {
            this.autocomplete.hide();
        }
    }
    showAutocomplete() {
        if (this.suppressAutocomplete) {
            return;
        }
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = (0, completion_provider_1.parseCompletionContext)(value, pos);
        const items = (0, completion_provider_1.getCompletions)(ctx);
        if (items.length === 0) {
            this.autocomplete.hide();
            return;
        }
        const coords = this.getCaretPosition();
        this.autocomplete.show(items, coords.x, coords.y, ctx.currentWord, (item) => {
            this.insertCompletion(item);
        }, () => {
            this.autocompleteActive = false;
        });
        this.autocompleteActive = true;
    }
    getCaretPosition() {
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
    insertCompletion(item) {
        const now = Date.now();
        if (this.suppressAutocomplete || (now - this.lastInsertTime) < 500) {
            return;
        }
        this.lastInsertTime = now;
        this.suppressAutocomplete = true;
        const value = this.textarea.value;
        const pos = this.textarea.selectionStart;
        const ctx = (0, completion_provider_1.parseCompletionContext)(value, pos);
        let wordStart = pos;
        while (wordStart > 0 && /[a-zA-Z0-9_]/.test(value[wordStart - 1])) {
            wordStart--;
        }
        let afterDot = false;
        if (wordStart > 0 && value[wordStart - 1] === '.') {
            afterDot = true;
        }
        let finalText;
        let cursorPos;
        if (afterDot) {
            const label = item.label;
            const insert = item.insertText ?? '';
            if (insert === '()') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            }
            else if (insert === '($0)') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            }
            else {
                finalText = label + insert;
                if (insert.includes('$0')) {
                    const offset = insert.indexOf('$0');
                    finalText = label + insert.replace('$0', '');
                    cursorPos = wordStart + label.length + offset;
                }
                else if (insert.startsWith('(')) {
                    cursorPos = wordStart + label.length + 1;
                }
                else {
                    cursorPos = wordStart + finalText.length;
                }
            }
        }
        else {
            const label = item.label;
            const insert = item.insertText ?? '';
            if (insert === '()') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            }
            else if (insert === '($0)') {
                finalText = label + '()';
                cursorPos = wordStart + finalText.length - 1;
            }
            else {
                finalText = label + insert;
                if (insert.includes('$0')) {
                    const offset = insert.indexOf('$0');
                    finalText = label + insert.replace('$0', '');
                    cursorPos = wordStart + label.length + offset;
                }
                else if (insert.startsWith('(')) {
                    cursorPos = wordStart + label.length + 1;
                }
                else {
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
        }, 500);
        this.textarea.focus();
    }
    onKeyDown(e) {
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
            }
            else {
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
            if (hasSelection) {
                const selectedText = value.substring(start, end);
                const lines = selectedText.split('\n');
                if (e.shiftKey) {
                    const unindentedLines = lines.map(line => {
                        let removed = 0;
                        let i = 0;
                        while (i < line.length && removed < this.tabSize && (line[i] === ' ' || line[i] === '\t')) {
                            if (line[i] === '\t') {
                                removed = this.tabSize;
                            }
                            else {
                                removed++;
                            }
                            i++;
                        }
                        return line.substring(i);
                    });
                    const newText = unindentedLines.join('\n');
                    this.textarea.value = value.substring(0, start) + newText + value.substring(end);
                    this.textarea.selectionStart = start;
                    this.textarea.selectionEnd = start + newText.length;
                }
                else {
                    const indentedLines = lines.map(line => spaces + line);
                    const newText = indentedLines.join('\n');
                    this.textarea.value = value.substring(0, start) + newText + value.substring(end);
                    this.textarea.selectionStart = start;
                    this.textarea.selectionEnd = start + newText.length;
                }
            }
            else {
                this.textarea.value = value.substring(0, start) + spaces + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + this.tabSize;
            }
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
            }
            else {
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
            }
            else {
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
    pushUndo() {
        const current = this.textarea.value;
        if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== current) {
            this.undoStack.push(current);
            if (this.undoStack.length > 100) {
                this.undoStack.shift();
            }
            this.redoStack = [];
        }
    }
    undo() {
        if (this.undoStack.length > 1) {
            const current = this.undoStack.pop();
            this.redoStack.push(current);
            const prev = this.undoStack[this.undoStack.length - 1];
            this.textarea.value = prev;
            this.updateHighlight();
            this.updateLineNumbers();
        }
    }
    redo() {
        if (this.redoStack.length > 0) {
            const next = this.redoStack.pop();
            this.undoStack.push(next);
            this.textarea.value = next;
            this.updateHighlight();
            this.updateLineNumbers();
        }
    }
}
exports.Editor = Editor;
//# sourceMappingURL=editor.js.map