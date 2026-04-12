// src/runtime/array.ts

export class IdylRuntimeError extends Error {
    readonly idylFile: string;
    readonly idylLine: number;

    constructor(file: string, line: number, message: string) {
        const formatted = `${file}:${line}: runtime error: ${message}`;
        super(formatted);
        this.name = 'IdylRuntimeError';
        this.idylFile = file;
        this.idylLine = line;
    }
}

interface Destructible {
    __destructor__?: () => void;
}

function tryCallDestructor(obj: unknown): void {
    if (obj !== null && typeof obj === 'object') {
        const destructible = obj as Destructible;
        if (typeof destructible.__destructor__ === 'function') {
            try {
                destructible.__destructor__();
            } catch (e) {
                console.warn('Destructor threw an error:', e);
            }
        }
    }
}

export class IdylArray<T> {

    private data: T[];
    private readonly fixed: boolean;

    private constructor(data: T[], fixed: boolean) {
        this.data = data;
        this.fixed = fixed;
    }

    static from<T>(elements: T[] | IdylArray<T>, expectedSize: number, fixed: boolean): IdylArray<T> {
        if (elements instanceof IdylArray) {
            return new IdylArray<T>([...elements.getData()], fixed);
        }
        const arr = new IdylArray<T>([...elements], fixed);
        return arr;
    }

    static filled<T>(size: number, value: T, fixed: boolean): IdylArray<T> {
        const data: T[] = [];
        for (let i = 0; i < size; i++) {
            data.push(value);
        }
        return new IdylArray<T>(data, fixed);
    }

    static generate<T>(size: number, factory: () => T, fixed: boolean): IdylArray<T> {
        const data: T[] = [];
        for (let i = 0; i < size; i++) {
            data.push(factory());
        }
        return new IdylArray<T>(data, fixed);
    }

    static empty<T>(fixed: boolean): IdylArray<T> {
        return new IdylArray<T>([], fixed);
    }

    get(index: number, file: string, line: number): T {
        this.checkBounds(index, file, line);
        return this.data[index];
    }

    set(index: number, value: T, file: string, line: number): void {
        this.checkBounds(index, file, line);
        const oldValue = this.data[index];
        if (oldValue !== value) {
            tryCallDestructor(oldValue);
        }
        this.data[index] = value;
    }

    private checkBounds(index: number, file: string, line: number): void {
        if (index < 0 || index >= this.data.length) {
            const valid = this.data.length > 0
                ? `valid indices 0-${this.data.length - 1}`
                : 'array is empty';
            throw new IdylRuntimeError(file, line,
                `array index ${index} out of bounds (size ${this.data.length}, ${valid})`);
        }
    }

    length(): number {
        return this.data.length;
    }

    contains(value: T): boolean {
        return this.data.includes(value);
    }

    find(value: T): number {
        return this.data.indexOf(value);
    }

    count(value: T): number {
        let c = 0;
        for (const el of this.data) {
            if (el === value) c++;
        }
        return c;
    }

    reverse(): void {
        this.data.reverse();
    }

    sort(): void {
        this.data.sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') return a - b;
            if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
            return 0;
        });
    }

    private requireDynamic(method: string): void {
        if (this.fixed) {
            throw new Error(`'${method}' is only available on dynamic arrays`);
        }
    }

    add(value: T): void {
        this.requireDynamic('add');
        this.data.push(value);
    }

    removeAt(index: number, file: string, line: number): void {
        this.requireDynamic('remove_at');
        this.checkBounds(index, file, line);
        
        const removed = this.data[index];
        tryCallDestructor(removed);
        
        this.data.splice(index, 1);
    }

    resize(newSize: number): void {
        this.requireDynamic('resize');
        if (newSize < this.data.length) {
            for (let i = newSize; i < this.data.length; i++) {
                tryCallDestructor(this.data[i]);
            }
            this.data.length = newSize;
        } else {
            const def = this.data.length > 0 ? defaultOf(this.data[0]) : 0;
            while (this.data.length < newSize) {
                this.data.push(def as T);
            }
        }
    }

    insert(index: number, value: T): void {
        this.requireDynamic('insert');
        this.data.splice(index, 0, value);
    }

    join(other: IdylArray<T>): void {
        this.requireDynamic('join');
        this.data.push(...other.data);
    }

    clear(): void {
        this.requireDynamic('clear');
        for (const item of this.data) {
            tryCallDestructor(item);
        }
        this.data.length = 0;
    }

    pop(file: string, line: number): T {
        this.requireDynamic('pop');
        if (this.data.length === 0) {
            throw new IdylRuntimeError(file, line,
                'cannot pop from empty array');
        }
        const item = this.data.pop()!;
        return item;
    }

    getData(): readonly T[] {
        return this.data;
    }

    toString(): string {
        const inner = this.data.map(v => {
            if (typeof v === 'string') return `"${v}"`;
            if (v instanceof IdylArray) return v.toString();
            return String(v);
        }).join(', ');
        return `[${inner}]`;
    }
}

function defaultOf(sample: unknown): unknown {
    if (typeof sample === 'number') return 0;
    if (typeof sample === 'string') return '';
    if (typeof sample === 'boolean') return false;
    return null;
}