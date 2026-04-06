// src/web/completion-provider.ts

import { CompletionItem, CompletionKind } from './autocomplete';

const KEYWORDS: CompletionItem[] = [
    { label: 'if', kind: 'keyword', detail: 'условие' },
    { label: 'else', kind: 'keyword', detail: 'иначе' },
    { label: 'while', kind: 'keyword', detail: 'цикл' },
    { label: 'for', kind: 'keyword', detail: 'цикл' },
    { label: 'do', kind: 'keyword', detail: 'цикл do-while' },
    { label: 'return', kind: 'keyword', detail: 'возврат', needsSemicolon: true },
    { label: 'break', kind: 'keyword', detail: 'выход из цикла', needsSemicolon: true },
    { label: 'continue', kind: 'keyword', detail: 'следующая итерация', needsSemicolon: true },
    { label: 'function', kind: 'keyword', detail: 'объявление функции' },
    { label: 'class', kind: 'keyword', detail: 'объявление класса' },
    { label: 'extends', kind: 'keyword', detail: 'наследование' },
    { label: 'this', kind: 'keyword', detail: 'текущий объект' },
    { label: 'constructor', kind: 'keyword', detail: 'конструктор' },
    { label: 'destructor', kind: 'keyword', detail: 'деструктор' },
    { label: 'public', kind: 'keyword', detail: 'публичный доступ' },
    { label: 'private', kind: 'keyword', detail: 'приватный доступ' },
    { label: 'use', kind: 'keyword', detail: 'импорт', needsSemicolon: true },
    { label: 'try', kind: 'keyword', detail: 'блок try-catch' },
    { label: 'catch', kind: 'keyword', detail: 'обработка ошибки' },
    { label: 'and', kind: 'keyword', detail: 'логическое И' },
    { label: 'or', kind: 'keyword', detail: 'логическое ИЛИ' },
    { label: 'xor', kind: 'keyword', detail: 'исключающее ИЛИ' },
    { label: 'not', kind: 'keyword', detail: 'логическое НЕ' },
    { label: 'true', kind: 'keyword', detail: 'истина' },
    { label: 'false', kind: 'keyword', detail: 'ложь' },
];

const TYPES: CompletionItem[] = [
    { label: 'int', kind: 'type', detail: 'целое число' },
    { label: 'float', kind: 'type', detail: 'дробное число' },
    { label: 'string', kind: 'type', detail: 'строка' },
    { label: 'char', kind: 'type', detail: 'символ' },
    { label: 'bool', kind: 'type', detail: 'логический тип' },
    { label: 'void', kind: 'type', detail: 'пустой тип' },
    { label: 'array', kind: 'type', detail: 'статический массив' },
    { label: 'dyn_array', kind: 'type', detail: 'динамический массив' },
];

const BUILTIN_FUNCTIONS: CompletionItem[] = [
    { label: 'div', kind: 'function', detail: '(a, b) → int', insertText: '($0)' },
    { label: 'mod', kind: 'function', detail: '(a, b) → int', insertText: '($0)' },
    { label: 'to_int', kind: 'function', detail: '(value) → int', insertText: '($0)' },
    { label: 'to_float', kind: 'function', detail: '(value) → float', insertText: '($0)' },
    { label: 'to_string', kind: 'function', detail: '(value) → string', insertText: '($0)' },
    { label: 'max', kind: 'function', detail: '(array) → число', insertText: '($0)' },
    { label: 'min', kind: 'function', detail: '(array) → число', insertText: '($0)' },
    { label: 'sum', kind: 'function', detail: '(array) → число', insertText: '($0)' },
    { label: 'avg', kind: 'function', detail: '(array) → float', insertText: '($0)' },
];

const LIBRARIES: CompletionItem[] = [
    { label: 'console', kind: 'library', detail: 'ввод/вывод', needsSemicolon: true },
    { label: 'math', kind: 'library', detail: 'математика', needsSemicolon: true },
    { label: 'random', kind: 'library', detail: 'случайные числа', needsSemicolon: true },
    { label: 'time', kind: 'library', detail: 'время', needsSemicolon: true },
    { label: 'file', kind: 'library', detail: 'работа с файлами', needsSemicolon: true },
    { label: 'types', kind: 'library', detail: 'типы фиксированной разрядности', needsSemicolon: true },
    { label: 'encoding', kind: 'library', detail: 'кодировки', needsSemicolon: true },
    { label: 'gui', kind: 'library', detail: 'графический интерфейс', needsSemicolon: true },
];

const LIBRARY_METHODS: Record<string, CompletionItem[]> = {
    console: [
        { label: 'write', kind: 'method', detail: '(...args) → void', insertText: '($0)' },
        { label: 'writeln', kind: 'method', detail: '(...args) → void', insertText: '($0)' },
        { label: 'get_int', kind: 'method', detail: '() → int', insertText: '()' },
        { label: 'get_float', kind: 'method', detail: '() → float', insertText: '()' },
        { label: 'get_string', kind: 'method', detail: '() → string', insertText: '()' },
        { label: 'set_precision', kind: 'method', detail: '(digits) → void', insertText: '($0)' },
    ],
    math: [
        { label: 'abs', kind: 'method', detail: '(x) → число', insertText: '($0)' },
        { label: 'round', kind: 'method', detail: '(x, digits?) → число', insertText: '($0)' },
        { label: 'floor', kind: 'method', detail: '(x) → int', insertText: '($0)' },
        { label: 'ceil', kind: 'method', detail: '(x) → int', insertText: '($0)' },
        { label: 'pow', kind: 'method', detail: '(base, exp) → float', insertText: '($0)' },
        { label: 'sqrt', kind: 'method', detail: '(x) → float', insertText: '($0)' },
        { label: 'sin', kind: 'method', detail: '(x) → float', insertText: '($0)' },
        { label: 'cos', kind: 'method', detail: '(x) → float', insertText: '($0)' },
        { label: 'tan', kind: 'method', detail: '(x) → float', insertText: '($0)' },
        { label: 'clamp', kind: 'method', detail: '(min, val, max) → число', insertText: '($0)' },
        { label: 'pi', kind: 'property', detail: '3.14159...' },
        { label: 'e', kind: 'property', detail: '2.71828...' },
    ],
    random: [
        { label: 'create_int', kind: 'method', detail: '(min, max) → int', insertText: '($0)' },
        { label: 'create_float', kind: 'method', detail: '(min, max) → float', insertText: '($0)' },
        { label: 'choose_from', kind: 'method', detail: '(array|string) → элемент', insertText: '($0)' },
        { label: 'set_seed', kind: 'method', detail: '(seed) → void', insertText: '($0)' },
    ],
    time: [
        { label: 'now', kind: 'method', detail: '() → time.stamp', insertText: '()' },
        { label: 'sleep', kind: 'method', detail: '(seconds) → void', insertText: '($0)' },
        { label: 'from_unix', kind: 'method', detail: '(timestamp) → time.stamp', insertText: '($0)' },
    ],
    file: [
        { label: 'open', kind: 'method', detail: '(path, mode) → stream  // mode: "read"|"write"|"append"', insertText: '($0)' },
    ],
    encoding: [
        { label: 'char_to_int', kind: 'method', detail: '(char, encoding) → int', insertText: '($0)' },
        { label: 'int_to_char', kind: 'method', detail: '(code, encoding) → char', insertText: '($0)' },
        { label: 'encode', kind: 'method', detail: '(text, encoding) → array', insertText: '($0)' },
        { label: 'decode', kind: 'method', detail: '(codes, encoding) → string', insertText: '($0)' },
        { label: 'list_encodings', kind: 'method', detail: '() → array', insertText: '()' },
    ],
    gui: [
        { label: 'Window', kind: 'type', detail: 'окно' },
        { label: 'Button', kind: 'type', detail: 'кнопка' },
        { label: 'Label', kind: 'type', detail: 'текстовая метка' },
        { label: 'SpinBox', kind: 'type', detail: 'числовое поле (int)' },
        { label: 'FloatSpinBox', kind: 'type', detail: 'числовое поле (float)' },
        { label: 'LineEdit', kind: 'type', detail: 'текстовое поле' },
        { label: 'CheckBox', kind: 'type', detail: 'чекбокс' },
        { label: 'ProgressBar', kind: 'type', detail: 'прогресс-бар' },
        { label: 'TextEdit', kind: 'type', detail: 'многострочное поле' },
        { label: 'ComboBox', kind: 'type', detail: 'выпадающий список' },
        { label: 'Slider', kind: 'type', detail: 'слайдер' },
        { label: 'Frame', kind: 'type', detail: 'рамка-контейнер' },
    ],
};

const STRING_METHODS: CompletionItem[] = [
    { label: 'length', kind: 'method', detail: '() → int', insertText: '()' },
    { label: 'contains', kind: 'method', detail: '(substr) → bool', insertText: '($0)' },
    { label: 'find', kind: 'method', detail: '(substr) → int', insertText: '($0)' },
    { label: 'substring', kind: 'method', detail: '(start, count?) → string', insertText: '($0)' },
    { label: 'replace', kind: 'method', detail: '(old, new) → string', insertText: '($0)' },
    { label: 'split', kind: 'method', detail: '(delimiter) → array', insertText: '($0)' },
    { label: 'trim', kind: 'method', detail: '() → string', insertText: '()' },
    { label: 'to_upper', kind: 'method', detail: '() → string', insertText: '()' },
    { label: 'to_lower', kind: 'method', detail: '() → string', insertText: '()' },
    { label: 'is_int', kind: 'method', detail: '() → bool', insertText: '()' },
    { label: 'is_float', kind: 'method', detail: '() → bool', insertText: '()' },
];

const ARRAY_METHODS: CompletionItem[] = [
    { label: 'length', kind: 'method', detail: '() → int', insertText: '()' },
    { label: 'add', kind: 'method', detail: '(element) → void', insertText: '($0)' },
    { label: 'remove_at', kind: 'method', detail: '(index) → void', insertText: '($0)' },
    { label: 'contains', kind: 'method', detail: '(value) → bool', insertText: '($0)' },
    { label: 'find', kind: 'method', detail: '(value) → int', insertText: '($0)' },
    { label: 'count', kind: 'method', detail: '(value) → int', insertText: '($0)' },
    { label: 'reverse', kind: 'method', detail: '() → void', insertText: '()' },
    { label: 'sort', kind: 'method', detail: '() → void', insertText: '()' },
    { label: 'pop', kind: 'method', detail: '() → элемент', insertText: '()' },
    { label: 'clear', kind: 'method', detail: '() → void', insertText: '()' },
];

const GUI_WIDGET_MEMBERS: Record<string, CompletionItem[]> = {
    Window: [
        { label: 'title', kind: 'property', detail: 'string' },
        { label: 'width', kind: 'property', detail: 'int' },
        { label: 'height', kind: 'property', detail: 'int' },
        { label: 'x', kind: 'property', detail: 'int' },
        { label: 'y', kind: 'property', detail: 'int' },
        { label: 'visible', kind: 'property', detail: 'bool' },
        { label: 'show', kind: 'method', detail: '() → void', insertText: '()' },
        { label: 'hide', kind: 'method', detail: '() → void', insertText: '()' },
        { label: 'add_child', kind: 'method', detail: '(widget) → void', insertText: '($0)' },
    ],
    Button: [
        { label: 'text', kind: 'property', detail: 'string' },
        { label: 'enabled', kind: 'property', detail: 'bool' },
        { label: 'on_click', kind: 'property', detail: 'function' },
        { label: 'x', kind: 'property', detail: 'int' },
        { label: 'y', kind: 'property', detail: 'int' },
        { label: 'width', kind: 'property', detail: 'int' },
        { label: 'height', kind: 'property', detail: 'int' },
        { label: 'visible', kind: 'property', detail: 'bool' },
        { label: 'show', kind: 'method', detail: '() → void', insertText: '()' },
        { label: 'hide', kind: 'method', detail: '() → void', insertText: '()' },
    ],
    Label: [
        { label: 'text', kind: 'property', detail: 'string' },
        { label: 'font_size', kind: 'property', detail: 'int' },
        { label: 'color', kind: 'property', detail: 'string' },
        { label: 'x', kind: 'property', detail: 'int' },
        { label: 'y', kind: 'property', detail: 'int' },
        { label: 'width', kind: 'property', detail: 'int' },
        { label: 'height', kind: 'property', detail: 'int' },
        { label: 'visible', kind: 'property', detail: 'bool' },
    ],
    SpinBox: [
        { label: 'value', kind: 'property', detail: 'int' },
        { label: 'min', kind: 'property', detail: 'int' },
        { label: 'max', kind: 'property', detail: 'int' },
        { label: 'step', kind: 'property', detail: 'int' },
        { label: 'on_change', kind: 'property', detail: 'function' },
        { label: 'x', kind: 'property', detail: 'int' },
        { label: 'y', kind: 'property', detail: 'int' },
        { label: 'width', kind: 'property', detail: 'int' },
    ],
};

interface ParsedClass {
    name: string;
    fields: Array<{ name: string; type: string }>;
    methods: Array<{ name: string; returnType: string; params: string }>;
    parent: string | null;
}

interface ParsedVariable {
    name: string;
    type: string;
}

interface ParsedCode {
    classes: Map<string, ParsedClass>;
    variables: Map<string, string>;
    functions: Set<string>;
    currentClassName: string | null;
}

function parseCode(text: string, cursorPos: number): ParsedCode {
    const result: ParsedCode = {
        classes: new Map(),
        variables: new Map(),
        functions: new Set(),
        currentClassName: null,
    };

    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let match;
    
    while ((match = classRegex.exec(text)) !== null) {
        const className = match[1];
        const parentClass = match[2] || null;
        const classBody = match[3];
        
        if (cursorPos >= match.index && cursorPos <= match.index + match[0].length) {
            result.currentClassName = className;
        }
        
        const fields: Array<{ name: string; type: string }> = [];
        const methods: Array<{ name: string; returnType: string; params: string }> = [];
        
        const fieldRegex = /(?:public|private)?\s*([\w.<>,\s]+?)\s+(\w+)\s*[;,]/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
            const type = fieldMatch[1].trim();
            const name = fieldMatch[2];
            if (!type.includes('function')) {
                fields.push({ name, type });
            }
        }
        
        const methodRegex = /(\w+)\s+function\s+(\w+)\s*\(([^)]*)\)/g;
        let methodMatch;
        while ((methodMatch = methodRegex.exec(classBody)) !== null) {
            methods.push({
                returnType: methodMatch[1],
                name: methodMatch[2],
                params: methodMatch[3],
            });
        }
        
        result.classes.set(className, {
            name: className,
            fields,
            methods,
            parent: parentClass,
        });
    }

    const varRegex = /(?:^|[;{}])\s*([\w.]+(?:<[\w,\s]+>)?)\s+(\w+)\s*[;=(\[]/gm;
    while ((match = varRegex.exec(text)) !== null) {
        const type = match[1].trim();
        const name = match[2];
        if (!result.variables.has(name) && !isKeyword(type)) {
            result.variables.set(name, type);
        }
    }

    const funcRegex = /(\w+)\s+function\s+(\w+)\s*\(/g;
    while ((match = funcRegex.exec(text)) !== null) {
        result.functions.add(match[2]);
    }

    return result;
}

function isKeyword(word: string): boolean {
    const keywords = new Set([
        'if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue',
        'function', 'class', 'extends', 'this', 'constructor', 'destructor',
        'public', 'private', 'use', 'try', 'catch', 'and', 'or', 'xor', 'not',
        'true', 'false', 'main'
    ]);
    return keywords.has(word);
}

function resolveExpressionType(
    expr: string, 
    parsed: ParsedCode
): string | null {
    expr = expr.trim();
    
    if (expr === 'this') {
        return parsed.currentClassName;
    }
    
    if (parsed.variables.has(expr)) {
        return parsed.variables.get(expr)!;
    }
    
    if (expr.startsWith('"') || expr.startsWith("'")) {
        return 'string';
    }
    
    if (/^\d+$/.test(expr)) {
        return 'int';
    }
    if (/^\d+\.\d+$/.test(expr)) {
        return 'float';
    }
    
    if (expr.includes('.')) {
        const parts = expr.split('.');
        let currentType: string | null = resolveExpressionType(parts[0], parsed);
        
        for (let i = 1; i < parts.length && currentType; i++) {
            currentType = resolveMemberType(currentType, parts[i], parsed);
        }
        
        return currentType;
    }
    
    return null;
}

function resolveMemberType(
    baseType: string, 
    member: string, 
    parsed: ParsedCode
): string | null {
    if (baseType.startsWith('gui.')) {
        const widgetName = baseType.substring(4);
        const members = GUI_WIDGET_MEMBERS[widgetName];
        if (members) {
            const found = members.find(m => m.label === member);
            if (found && found.detail) {
                return found.detail;
            }
        }
        return null;
    }
    
    const cls = parsed.classes.get(baseType);
    if (cls) {
        const field = cls.fields.find(f => f.name === member);
        if (field) return field.type;
        
        const method = cls.methods.find(m => m.name === member);
        if (method) return `function:${method.returnType}`;
    }
    
    return null;
}

function getCompletionsForType(type: string, parsed: ParsedCode): CompletionItem[] {
    if (!type) return [];
    
    if (LIBRARY_METHODS[type]) {
        return LIBRARY_METHODS[type];
    }
    
    if (type.startsWith('gui.')) {
        const widgetName = type.substring(4);
        return GUI_WIDGET_MEMBERS[widgetName] || getDefaultWidgetMembers();
    }
    
    if (type === 'string') {
        return STRING_METHODS;
    }
    
    if (type === 'array' || type === 'dyn_array' || 
        type.startsWith('array<') || type.startsWith('dyn_array<')) {
        return ARRAY_METHODS;
    }
    
    const cls = parsed.classes.get(type);
    if (cls) {
        return getClassMembers(cls, parsed);
    }
    
    return [];
}

function getDefaultWidgetMembers(): CompletionItem[] {
    return [
        { label: 'x', kind: 'property', detail: 'int' },
        { label: 'y', kind: 'property', detail: 'int' },
        { label: 'width', kind: 'property', detail: 'int' },
        { label: 'height', kind: 'property', detail: 'int' },
        { label: 'visible', kind: 'property', detail: 'bool' },
        { label: 'show', kind: 'method', detail: '() → void', insertText: '()' },
        { label: 'hide', kind: 'method', detail: '() → void', insertText: '()' },
    ];
}

function getClassMembers(cls: ParsedClass, parsed: ParsedCode): CompletionItem[] {
    const items: CompletionItem[] = [];
    
    for (const field of cls.fields) {
        items.push({
            label: field.name,
            kind: 'property',
            detail: field.type,
        });
    }
    
    for (const method of cls.methods) {
        items.push({
            label: method.name,
            kind: 'method',
            detail: `(${method.params}) → ${method.returnType}`,
            insertText: method.params ? '($0)' : '()',
        });
    }
    
    if (cls.parent) {
        const parentCls = parsed.classes.get(cls.parent);
        if (parentCls) {
            const parentMembers = getClassMembers(parentCls, parsed);
            for (const member of parentMembers) {
                if (!items.some(i => i.label === member.label)) {
                    items.push(member);
                }
            }
        }
    }
    
    return items;
}

export interface CompletionContext {
    textBefore: string;
    fullText: string;
    currentWord: string;
    lineText: string;
    afterDot: string | null;
    cursorPos: number;
}

function extractImports(text: string): Set<string> {
    const imports = new Set<string>();
    const regex = /\buse\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        imports.add(match[1]);
    }
    return imports;
}

export function getCompletions(ctx: CompletionContext): CompletionItem[] {
    const parsed = parseCode(ctx.fullText, ctx.cursorPos);
    
    if (ctx.afterDot !== null) {
        const exprType = resolveExpressionType(ctx.afterDot, parsed);
        
        if (exprType) {
            return getCompletionsForType(exprType, parsed);
        }
        
        if (LIBRARY_METHODS[ctx.afterDot]) {
            return LIBRARY_METHODS[ctx.afterDot];
        }
        
        return [];
    }

    if (ctx.textBefore.match(/use\s+$/)) {
        return LIBRARIES;
    }

    const items: CompletionItem[] = [];
    
    items.push(...KEYWORDS);
    items.push(...TYPES);
    items.push(...BUILTIN_FUNCTIONS);

    const imports = extractImports(ctx.fullText);
    for (const lib of imports) {
        if (LIBRARY_METHODS[lib]) {
            items.push({
                label: lib,
                kind: 'library',
                detail: 'импортированный модуль',
            });
        } else {
            items.push({
                label: lib,
                kind: 'library',
                detail: 'модуль',
            });
        }
    }

    for (const [name, cls] of parsed.classes) {
        items.push({
            label: name,
            kind: 'type',
            detail: cls.parent ? `extends ${cls.parent}` : 'класс',
        });
    }

    for (const funcName of parsed.functions) {
        if (!items.some(i => i.label === funcName)) {
            items.push({
                label: funcName,
                kind: 'function',
                detail: 'функция',
                insertText: '($0)',
            });
        }
    }

    for (const [varName, varType] of parsed.variables) {
        if (!items.some(i => i.label === varName)) {
            items.push({
                label: varName,
                kind: 'variable',
                detail: varType,
            });
        }
    }

    return items;
}

export function parseCompletionContext(
    text: string,
    cursorPos: number
): CompletionContext {
    const textBefore = text.substring(0, cursorPos);
    
    const lastNewline = textBefore.lastIndexOf('\n');
    const lineText = textBefore.substring(lastNewline + 1);

    let currentWord = '';
    let i = cursorPos - 1;
    while (i >= 0 && /[a-zA-Z0-9_]/.test(text[i])) {
        currentWord = text[i] + currentWord;
        i--;
    }
    
    let afterDot: string | null = null;
    let beforeWordPos = cursorPos - currentWord.length - 1;
    
    if (beforeWordPos >= 0 && text[beforeWordPos] === '.') {
        let exprEnd = beforeWordPos;
        let exprStart = exprEnd - 1;
        
        let parenDepth = 0;
        while (exprStart >= 0) {
            const ch = text[exprStart];
            
            if (ch === ')') {
                parenDepth++;
            } else if (ch === '(') {
                if (parenDepth > 0) {
                    parenDepth--;
                } else {
                    break;
                }
            } else if (parenDepth === 0) {
                if (/[a-zA-Z0-9_.]/.test(ch)) {
                    // продолжаем
                } else {
                    break;
                }
            }
            
            exprStart--;
        }
        
        afterDot = text.substring(exprStart + 1, exprEnd).trim();
        afterDot = afterDot.replace(/\([^)]*\)/g, '');
    }

    return {
        textBefore,
        fullText: text,
        currentWord,
        lineText,
        afterDot,
        cursorPos,
    };
}