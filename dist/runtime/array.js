"use strict";
// src/runtime/array.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdylArray = exports.IdylRuntimeError = void 0;
class IdylRuntimeError extends Error {
    constructor(file, line, message) {
        const formatted = `${file}:${line}: runtime error: ${message}`;
        super(formatted);
        this.name = 'IdylRuntimeError';
        this.idylFile = file;
        this.idylLine = line;
    }
}
exports.IdylRuntimeError = IdylRuntimeError;
function tryCallDestructor(obj) {
    if (obj !== null && typeof obj === 'object') {
        const destructible = obj;
        if (typeof destructible.__destructor__ === 'function') {
            try {
                destructible.__destructor__();
            }
            catch (e) {
                console.warn('Destructor threw an error:', e);
            }
        }
    }
}
class IdylArray {
    constructor(data, fixed) {
        this.data = data;
        this.fixed = fixed;
    }
    static from(elements, expectedSize, fixed) {
        const arr = new IdylArray([...elements], fixed);
        return arr;
    }
    static filled(size, value, fixed) {
        const data = [];
        for (let i = 0; i < size; i++) {
            data.push(value);
        }
        return new IdylArray(data, fixed);
    }
    static generate(size, factory, fixed) {
        const data = [];
        for (let i = 0; i < size; i++) {
            data.push(factory());
        }
        return new IdylArray(data, fixed);
    }
    static empty(fixed) {
        return new IdylArray([], fixed);
    }
    get(index, file, line) {
        this.checkBounds(index, file, line);
        return this.data[index];
    }
    set(index, value, file, line) {
        this.checkBounds(index, file, line);
        const oldValue = this.data[index];
        if (oldValue !== value) {
            tryCallDestructor(oldValue);
        }
        this.data[index] = value;
    }
    checkBounds(index, file, line) {
        if (index < 0 || index >= this.data.length) {
            const valid = this.data.length > 0
                ? `valid indices 0-${this.data.length - 1}`
                : 'array is empty';
            throw new IdylRuntimeError(file, line, `array index ${index} out of bounds (size ${this.data.length}, ${valid})`);
        }
    }
    length() {
        return this.data.length;
    }
    contains(value) {
        return this.data.includes(value);
    }
    find(value) {
        return this.data.indexOf(value);
    }
    count(value) {
        let c = 0;
        for (const el of this.data) {
            if (el === value)
                c++;
        }
        return c;
    }
    reverse() {
        this.data.reverse();
    }
    sort() {
        this.data.sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number')
                return a - b;
            if (typeof a === 'string' && typeof b === 'string')
                return a.localeCompare(b);
            return 0;
        });
    }
    requireDynamic(method) {
        if (this.fixed) {
            throw new Error(`'${method}' is only available on dynamic arrays`);
        }
    }
    add(value) {
        this.requireDynamic('add');
        this.data.push(value);
    }
    removeAt(index, file, line) {
        this.requireDynamic('remove_at');
        this.checkBounds(index, file, line);
        const removed = this.data[index];
        tryCallDestructor(removed);
        this.data.splice(index, 1);
    }
    resize(newSize) {
        this.requireDynamic('resize');
        if (newSize < this.data.length) {
            for (let i = newSize; i < this.data.length; i++) {
                tryCallDestructor(this.data[i]);
            }
            this.data.length = newSize;
        }
        else {
            const def = this.data.length > 0 ? defaultOf(this.data[0]) : 0;
            while (this.data.length < newSize) {
                this.data.push(def);
            }
        }
    }
    insert(index, value) {
        this.requireDynamic('insert');
        this.data.splice(index, 0, value);
    }
    join(other) {
        this.requireDynamic('join');
        this.data.push(...other.data);
    }
    clear() {
        this.requireDynamic('clear');
        for (const item of this.data) {
            tryCallDestructor(item);
        }
        this.data.length = 0;
    }
    pop(file, line) {
        this.requireDynamic('pop');
        if (this.data.length === 0) {
            throw new IdylRuntimeError(file, line, 'cannot pop from empty array');
        }
        const item = this.data.pop();
        return item;
    }
    getData() {
        return this.data;
    }
    toString() {
        const inner = this.data.map(v => {
            if (typeof v === 'string')
                return `"${v}"`;
            if (v instanceof IdylArray)
                return v.toString();
            return String(v);
        }).join(', ');
        return `[${inner}]`;
    }
}
exports.IdylArray = IdylArray;
function defaultOf(sample) {
    if (typeof sample === 'number')
        return 0;
    if (typeof sample === 'string')
        return '';
    if (typeof sample === 'boolean')
        return false;
    return null;
}
//# sourceMappingURL=array.js.map