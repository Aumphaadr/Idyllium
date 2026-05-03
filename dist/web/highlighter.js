"use strict";
// src/web/highlighter.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = tokenize;
exports.highlightToHTML = highlightToHTML;
const KEYWORDS = new Set([
    'use', 'if', 'else', 'while', 'do', 'for', 'break', 'continue', 'return',
    'try', 'catch',
    'function', 'class', 'extends', 'this', 'constructor', 'destructor',
    'public', 'private', 'static', 'parent',
    'and', 'or', 'xor', 'not',
    'true', 'false',
]);
const TYPES = new Set([
    'int', 'float', 'string', 'char', 'bool', 'void',
    'array', 'dyn_array', 'set',
]);
const QUALIFIED_TYPES = new Set([
    'istream', 'ostream', 'stream', 'stamp',
    'Window', 'Button', 'Label', 'SpinBox', 'FloatSpinBox',
    'LineEdit', 'CheckBox', 'ProgressBar', 'TextEdit',
    'ComboBox', 'Slider', 'Frame', 'Timer', 'Modal',
    'int8', 'int16', 'int32', 'int64',
    'uint8', 'uint16', 'uint32', 'uint64',
    'float32', 'float64',
]);
function extractClassNames(source) {
    const classNames = new Set();
    const regex = /\bclass\s+([A-Z][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        classNames.add(match[1]);
    }
    return classNames;
}
function isDigit(ch) {
    return ch >= '0' && ch <= '9';
}
function isIdentStart(ch) {
    return /^[a-zA-Z_\u00C0-\u024F\u0400-\u04FF]$/.test(ch);
}
function isIdentPart(ch) {
    return /^[a-zA-Z0-9_\u00C0-\u024F\u0400-\u04FF]$/.test(ch);
}
function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}
function extractImportedModules(source) {
    const modules = new Set();
    const regex = /\buse\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
        modules.add(match[1]);
    }
    return modules;
}
function isPascalCase(name) {
    return name.length > 0 && name[0] >= 'A' && name[0] <= 'Z';
}
function tokenize(source) {
    const tokens = [];
    let pos = 0;
    const len = source.length;
    const userClasses = extractClassNames(source);
    const importedModules = extractImportedModules(source);
    function peekNonWhitespace(startPos) {
        let p = startPos;
        while (p < len && isWhitespace(source[p])) {
            p++;
        }
        return p < len ? source[p] : '';
    }
    function lastSignificantToken() {
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i].category !== 'plain') {
                return tokens[i];
            }
        }
        return null;
    }
    function tokenBeforeDot() {
        let dotFound = false;
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i].category === 'plain')
                continue;
            if (tokens[i].text === '.') {
                dotFound = true;
                continue;
            }
            if (dotFound) {
                return tokens[i];
            }
        }
        return null;
    }
    while (pos < len) {
        const ch = source[pos];
        if (isWhitespace(ch)) {
            let text = '';
            while (pos < len && isWhitespace(source[pos])) {
                text += source[pos];
                pos++;
            }
            tokens.push({ text, category: 'plain' });
            continue;
        }
        if (ch === '/' && source[pos + 1] === '/') {
            let text = '';
            while (pos < len && source[pos] !== '\n') {
                text += source[pos];
                pos++;
            }
            tokens.push({ text, category: 'comment' });
            continue;
        }
        if (ch === '/' && source[pos + 1] === '*') {
            let text = '/*';
            pos += 2;
            while (pos < len) {
                if (source[pos] === '*' && source[pos + 1] === '/') {
                    text += '*/';
                    pos += 2;
                    break;
                }
                text += source[pos];
                pos++;
            }
            tokens.push({ text, category: 'comment' });
            continue;
        }
        if (ch === '"') {
            let text = '"';
            pos++;
            while (pos < len && source[pos] !== '"') {
                if (source[pos] === '\\' && pos + 1 < len) {
                    text += source[pos] + source[pos + 1];
                    pos += 2;
                }
                else if (source[pos] === '\n') {
                    break;
                }
                else {
                    text += source[pos];
                    pos++;
                }
            }
            if (pos < len && source[pos] === '"') {
                text += '"';
                pos++;
            }
            tokens.push({ text, category: 'string' });
            continue;
        }
        if (ch === "'") {
            let text = "'";
            pos++;
            while (pos < len && source[pos] !== "'") {
                if (source[pos] === '\\' && pos + 1 < len) {
                    text += source[pos] + source[pos + 1];
                    pos += 2;
                }
                else if (source[pos] === '\n') {
                    break;
                }
                else {
                    text += source[pos];
                    pos++;
                }
            }
            if (pos < len && source[pos] === "'") {
                text += "'";
                pos++;
            }
            tokens.push({ text, category: 'string' });
            continue;
        }
        if (isDigit(ch)) {
            let text = '';
            while (pos < len && (isDigit(source[pos]) || source[pos] === '.')) {
                text += source[pos];
                pos++;
            }
            tokens.push({ text, category: 'number' });
            continue;
        }
        if (isIdentStart(ch)) {
            let text = '';
            while (pos < len && isIdentPart(source[pos])) {
                text += source[pos];
                pos++;
            }
            let category = 'object';
            const nextChar = peekNonWhitespace(pos);
            const lastTok = lastSignificantToken();
            const afterDot = lastTok !== null && lastTok.text === '.';
            if (afterDot) {
                const beforeDot = tokenBeforeDot();
                const isAfterModule = beforeDot !== null && importedModules.has(beforeDot.text);
                if (QUALIFIED_TYPES.has(text)) {
                    category = 'className';
                }
                else if (isAfterModule && isPascalCase(text)) {
                    category = 'className';
                }
                else if (nextChar === '(') {
                    category = 'function';
                }
                else {
                    category = 'object';
                }
            }
            else if (TYPES.has(text)) {
                category = 'typeName';
            }
            else if (KEYWORDS.has(text)) {
                category = 'keyword';
            }
            else if (userClasses.has(text)) {
                category = 'className';
            }
            else if (nextChar === '(') {
                category = 'function';
            }
            tokens.push({ text, category });
            continue;
        }
        const twoChar = source.substring(pos, pos + 2);
        if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/='].includes(twoChar)) {
            tokens.push({ text: twoChar, category: 'brackets' });
            pos += 2;
            continue;
        }
        if ('+-*/<>=!{}[]();,.:~'.includes(ch)) {
            tokens.push({ text: ch, category: 'brackets' });
            pos++;
            continue;
        }
        tokens.push({ text: ch, category: 'plain' });
        pos++;
    }
    return tokens;
}
function highlightToHTML(source) {
    const tokens = tokenize(source);
    let html = '';
    for (const tok of tokens) {
        const escaped = escapeHTML(tok.text);
        if (tok.category === 'plain') {
            html += escaped;
        }
        else {
            html += `<span class="hl-${tok.category}">${escaped}</span>`;
        }
    }
    return html;
}
function escapeHTML(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
//# sourceMappingURL=highlighter.js.map