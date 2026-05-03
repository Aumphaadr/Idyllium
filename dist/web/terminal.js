"use strict";
// src/web/terminal.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Terminal = void 0;
const ANSI_COLORS = {
    // Стандартные цвета (тёмные)
    '30': '#555555', // чёрный
    '31': '#FF6B6B', // красный
    '32': '#69FF94', // зелёный
    '33': '#FFFFA5', // жёлтый
    '34': '#6B9FFF', // синий
    '35': '#FF6BFF', // малиновый (magenta)
    '36': '#6BFFFF', // голубой (cyan)
    '37': '#FFFFFF', // белый
    // Светлые цвета
    '90': '#888888', // серый (bright black)
    '91': '#FF8A8A', // светло-красный
    '92': '#8AFF8A', // светло-зелёный
    '93': '#FFFF8A', // светло-жёлтый
    '94': '#8AB4FF', // светло-синий
    '95': '#FF8AFF', // светло-малиновый
    '96': '#8AFFFF', // светло-голубой
    '97': '#FFFFFF', // ярко-белый
    // Стили текста
    '1': '__bold__', // жирный
    '2': '__dim__', // тусклый
    '3': '__italic__', // курсив
    '4': '__underline__', // подчёркнутый
    // Цвета фона
    '40': '#555555',
    '41': '#FF6B6B',
    '42': '#69FF94',
    '43': '#FFFFA5',
    '44': '#6B9FFF',
    '45': '#FF6BFF',
    '46': '#6BFFFF',
    '47': '#FFFFFF',
};
class Terminal {
    constructor(container) {
        this.currentColor = null;
        this.currentBold = false;
        this.currentItalic = false;
        this.currentUnderline = false;
        this.inputResolve = null;
        this.inputReject = null;
        this.container = container;
        this.container.innerHTML = '';
        this.container.classList.add('terminal-container');
        this.outputEl = document.createElement('div');
        this.outputEl.className = 'terminal-output';
        this.container.appendChild(this.outputEl);
        this.inputContainer = document.createElement('div');
        this.inputContainer.className = 'terminal-input-container';
        this.inputContainer.style.display = 'none';
        this.inputLabel = document.createElement('span');
        this.inputLabel.className = 'terminal-input-label';
        this.inputLabel.textContent = '> ';
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.className = 'terminal-input-field';
        this.inputField.spellcheck = false;
        this.inputContainer.appendChild(this.inputLabel);
        this.inputContainer.appendChild(this.inputField);
        this.container.appendChild(this.inputContainer);
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.inputResolve !== null) {
                const value = this.inputField.value;
                this.inputField.value = '';
                this.inputContainer.style.display = 'none';
                this.printRaw(`> ${value}\n`, '#888888');
                const resolve = this.inputResolve;
                this.inputResolve = null;
                this.inputReject = null;
                resolve(value);
            }
        });
    }
    print(text) {
        const segments = this.parseAnsi(text);
        for (const seg of segments) {
            switch (seg.type) {
                case 'color':
                    this.currentColor = seg.color;
                    break;
                case 'reset':
                    this.currentColor = null;
                    this.currentBold = false;
                    this.currentItalic = false;
                    this.currentUnderline = false;
                    break;
                case 'style':
                    if (seg.color === 'bold')
                        this.currentBold = true;
                    else if (seg.color === 'italic')
                        this.currentItalic = true;
                    else if (seg.color === 'underline')
                        this.currentUnderline = true;
                    break;
                case 'clear_screen':
                    this.outputEl.innerHTML = '';
                    break;
                case 'cursor_home':
                    break;
                case 'text':
                    this.printRaw(seg.text, this.currentColor);
                    break;
            }
        }
        this.scrollToBottom();
    }
    readLine() {
        return new Promise((resolve, reject) => {
            this.inputResolve = resolve;
            this.inputReject = reject;
            this.inputContainer.style.display = 'flex';
            this.inputField.focus();
            this.scrollToBottom();
        });
    }
    clear() {
        this.outputEl.innerHTML = '';
        this.currentColor = null;
        this.currentBold = false;
        this.currentItalic = false;
        this.currentUnderline = false;
        this.cancelInput();
    }
    printSystem(text, type = 'info') {
        const span = document.createElement('span');
        span.className = `terminal-system terminal-${type}`;
        span.textContent = text;
        this.outputEl.appendChild(span);
        this.scrollToBottom();
        return span;
    }
    cancelInput() {
        if (this.inputReject !== null) {
            this.inputContainer.style.display = 'none';
            const reject = this.inputReject;
            this.inputResolve = null;
            this.inputReject = null;
            this.inputField.value = '';
            reject(new Error('Input cancelled'));
        }
    }
    printRaw(text, color) {
        if (text.length === 0)
            return;
        const span = document.createElement('span');
        if (color)
            span.style.color = color;
        if (this.currentBold)
            span.style.fontWeight = 'bold';
        if (this.currentItalic)
            span.style.fontStyle = 'italic';
        if (this.currentUnderline)
            span.style.textDecoration = 'underline';
        span.textContent = text;
        span.style.whiteSpace = 'pre-wrap';
        this.outputEl.appendChild(span);
    }
    parseAnsi(text) {
        const segments = [];
        const regex = /\x1b\[([\d;]*)([A-Za-z])/g;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                segments.push({
                    type: 'text',
                    text: text.substring(lastIndex, match.index),
                    color: null,
                });
            }
            const params = match[1];
            const command = match[2];
            switch (command) {
                case 'm': {
                    const codes = params.split(';');
                    for (const code of codes) {
                        if (code === '0' || code === '') {
                            segments.push({ type: 'reset', text: '', color: null });
                        }
                        else if (ANSI_COLORS[code]) {
                            segments.push({ type: 'color', text: '', color: ANSI_COLORS[code] });
                        }
                        else if (code === '1') {
                            segments.push({ type: 'style', text: '', color: 'bold' });
                        }
                        else if (code === '3') {
                            segments.push({ type: 'style', text: '', color: 'italic' });
                        }
                        else if (code === '4') {
                            segments.push({ type: 'style', text: '', color: 'underline' });
                        }
                    }
                    break;
                }
                case 'J': {
                    segments.push({ type: 'clear_screen', text: '', color: null });
                    break;
                }
                case 'H': {
                    segments.push({ type: 'cursor_home', text: '', color: null });
                    break;
                }
                default:
                    break;
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            segments.push({
                type: 'text',
                text: text.substring(lastIndex),
                color: null,
            });
        }
        return segments;
    }
    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }
}
exports.Terminal = Terminal;
//# sourceMappingURL=terminal.js.map