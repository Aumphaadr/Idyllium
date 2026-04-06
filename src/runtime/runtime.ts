// src/runtime/runtime.ts

import { IdylRuntimeError, IdylArray } from './array';
import { FixedInt, FixedFloat, typesFactory } from './types';
import { createEncodingModule } from './encoding';
import { createGuiModule } from './gui/index';

export { IdylRuntimeError, IdylArray };
export { FixedInt, FixedFloat, typesFactory };

function defaultOf(sample: unknown): unknown {
    if (typeof sample === 'number') return 0;
    if (typeof sample === 'string') return '';
    if (typeof sample === 'boolean') return false;
    return null;
}

function idylDiv(a: number, b: number, file: string, line: number): number {
    if (b === 0) {
        throw new IdylRuntimeError(file, line, 'division by zero');
    }
    return Math.trunc(a / b);
}

function idylMod(a: number, b: number, file: string, line: number): number {
    if (b === 0) {
        throw new IdylRuntimeError(file, line, 'division by zero (mod)');
    }
    return a % b;
}

function idylToInt(value: unknown, file: string, line: number): number {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        if (isNaN(n)) {
            throw new IdylRuntimeError(file, line,
                `'to_int' cannot convert "${value}" to integer`);
        }
        return n;
    }
    throw new IdylRuntimeError(file, line,
        `'to_int' received unsupported type`);
}

function idylToFloat(value: unknown, file: string, line: number): number {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const n = parseFloat(value);
        if (isNaN(n)) {
            throw new IdylRuntimeError(file, line,
                `'to_float' cannot convert "${value}" to float`);
        }
        return n;
    }
    throw new IdylRuntimeError(file, line,
        `'to_float' received unsupported type`);
}

function idylToString(value: unknown): string {
    if (value instanceof IdylArray) return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
}

function idylMax(arr: IdylArray<number>): number {
    const data = arr.getData();
    if (data.length === 0) return 0;
    let m = data[0];
    for (let i = 1; i < data.length; i++) {
        if (data[i] > m) m = data[i];
    }
    return m;
}

function idylMin(arr: IdylArray<number>): number {
    const data = arr.getData();
    if (data.length === 0) return 0;
    let m = data[0];
    for (let i = 1; i < data.length; i++) {
        if (data[i] < m) m = data[i];
    }
    return m;
}

function idylSum(arr: IdylArray<number>): number {
    const data = arr.getData();
    let s = 0;
    for (const v of data) s += v;
    return s;
}

function idylAvg(arr: IdylArray<number>): number {
    const data = arr.getData();
    if (data.length === 0) return 0;
    let s = 0;
    for (const v of data) s += v;
    return s / data.length;
}

function strCharAt(s: string, index: number, file: string, line: number): string {
    if (index < 0 || index >= s.length) {
        const valid = s.length > 0
            ? `valid indices 0-${s.length - 1}`
            : 'string is empty';
        throw new IdylRuntimeError(file, line,
            `string index ${index} out of bounds (length ${s.length}, ${valid})`);
    }
    return s[index];
}

function strContains(s: string, search: string): boolean {
    return s.includes(search);
}

function strFind(s: string, search: string): number {
    return s.indexOf(search);
}

function strCount(s: string, search: string): number {
    if (search.length === 0) return 0;
    let count = 0;
    let pos = 0;
    while (true) {
        const idx = s.indexOf(search, pos);
        if (idx === -1) break;
        count++;
        pos = idx + search.length;
    }
    return count;
}

function strSubstring(s: string, start: number, count?: number): string {
    if (start < 0) start = 0;
    if (count === undefined) {
        return s.substring(start);
    }
    return s.substring(start, start + count);
}

function strReplace(s: string, oldStr: string, newStr: string): string {
    return s.split(oldStr).join(newStr);
}

function strSplit(s: string, delimiter: string): IdylArray<string> {
    const parts = s.split(delimiter);
    return IdylArray.from(parts, -1, false);
}

function strTrim(s: string): string {
    return s.replace(/^[\s\n\r\t\0]+|[\s\n\r\t\0]+$/g, '');
}

function strIsInt(s: string): boolean {
    return /^-?\d+$/.test(s.trim());
}

function strIsFloat(s: string): boolean {
    const trimmed = s.trim();
    if (trimmed === '') return false;
    const n = Number(trimmed);
    return !isNaN(n) && isFinite(n);
}

export interface ConsoleIO {
    print(text: string): void;
    readLine(): Promise<string>;
}

function createConsoleModule(io: ConsoleIO) {
    let precision: number | null = null;

    function formatValue(v: unknown): string {
        if (v instanceof IdylArray) return v.toString();
        if (v instanceof FixedInt) return v.get().toString();
        if (v instanceof FixedFloat) {
            const val = v.get();
            if (precision !== null) {
                return Number(val.toFixed(precision)).toString();
            }
            return val.toString();
        }
        if (typeof v === 'number' && precision !== null) {
            return Number(v.toFixed(precision)).toString();
        }
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        return String(v);
    }

    return {
        write(...args: unknown[]): void {
            const text = args.map(formatValue).join('');
            io.print(text);
        },

        writeln(...args: unknown[]): void {
            const text = args.map(formatValue).join('') + '\n';
            io.print(text);
        },

        async getInt(file: string, line: number): Promise<number> {
            const raw = await io.readLine();
            const trimmed = raw.trim();
            const n = parseInt(trimmed, 10);
            if (isNaN(n) || !(/^-?\d+$/.test(trimmed))) {
                throw new IdylRuntimeError(file, line,
                    `cannot convert input to 'int' (expected integer, got "${trimmed}")`);
            }
            return n;
        },

        async getFloat(file: string, line: number): Promise<number> {
            const raw = await io.readLine();
            const trimmed = raw.trim();
            const n = parseFloat(trimmed);
            if (isNaN(n)) {
                throw new IdylRuntimeError(file, line,
                    `cannot convert input to 'float' (expected number, got "${trimmed}")`);
            }
            return n;
        },

        async getString(): Promise<string> {
            return io.readLine();
        },

        setPrecision(digits: number): void {
            precision = digits > 0 ? digits : null;
        },
    };
}

function createMathModule() {
    return {
        pi: Math.PI,
        e: Math.E,

        abs(x: number): number {
            return Math.abs(x);
        },

        round(x: number, digits?: number): number {
            if (digits === undefined) return Math.round(x);
            const factor = Math.pow(10, digits);
            return Math.round(x * factor) / factor;
        },

        floor(x: number, digits?: number): number {
            if (digits === undefined) return Math.floor(x);
            const factor = Math.pow(10, digits);
            return Math.floor(x * factor) / factor;
        },

        ceil(x: number, digits?: number): number {
            if (digits === undefined) return Math.ceil(x);
            const factor = Math.pow(10, digits);
            return Math.ceil(x * factor) / factor;
        },

        pow(base: number, exp: number): number {
            return Math.pow(base, exp);
        },

        sqrt(x: number, file: string, line: number): number {
            if (x < 0) {
                throw new IdylRuntimeError(file, line,
                    `math.sqrt argument must be >= 0 (got ${x})`);
            }
            return Math.sqrt(x);
        },

        clamp(min: number, val: number, max: number): number {
            return Math.max(min, Math.min(val, max));
        },

        asin(x: number, file: string, line: number): number {
            if (x < -1 || x > 1) {
                throw new IdylRuntimeError(file, line,
                    `math.asin argument must be between -1 and 1 (got ${x})`);
            }
            return Math.asin(x);
        },

        acos(x: number, file: string, line: number): number {
            if (x < -1 || x > 1) {
                throw new IdylRuntimeError(file, line,
                    `math.acos argument must be between -1 and 1 (got ${x})`);
            }
            return Math.acos(x);
        },

        toRadians(deg: number): number {
            return deg * (Math.PI / 180);
        },

        toDegrees(rad: number): number {
            return rad * (180 / Math.PI);
        },

        log(x: number, file: string, line: number): number {
            if (x <= 0) {
                throw new IdylRuntimeError(file, line,
                    `math.log argument must be > 0 (got ${x})`);
            }
            return Math.log(x);
        },

        log10(x: number, file: string, line: number): number {
            if (x <= 0) {
                throw new IdylRuntimeError(file, line,
                    `math.log10 argument must be > 0 (got ${x})`);
            }
            return Math.log10(x);
        },
    };
}

function mulberry32(seed: number): () => number {
    let state = seed | 0;
    return function (): number {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createRandomModule() {
    let rng = mulberry32(Date.now() ^ (Math.random() * 0xFFFFFFFF));

    return {
        createInt(min: number, max: number): number {
            return Math.floor(rng() * (max - min + 1)) + min;
        },

        createFloat(min: number, max: number): number {
            return rng() * (max - min) + min;
        },

        chooseFrom(source: string | IdylArray<unknown>): unknown {
            if (typeof source === 'string') {
                if (source.length === 0) return '\0';
                const idx = Math.floor(rng() * source.length);
                return source[idx];
            }
            const data = source.getData();
            if (data.length === 0) return null;
            const idx = Math.floor(rng() * data.length);
            return data[idx];
        },

        setSeed(seed: number): void {
            rng = mulberry32(seed);
        },
    };
}

class TimeStamp {
    private readonly date: Date;

    constructor(date: Date) {
        this.date = date;
    }

    year(): number   { return this.date.getFullYear(); }
    month(): number  { return this.date.getMonth() + 1; }
    day(): number    { return this.date.getDate(); }
    hour(): number   { return this.date.getHours(); }
    minute(): number { return this.date.getMinutes(); }
    second(): number { return this.date.getSeconds(); }

    weekDay(): number { return this.date.getDay(); }

    unix(): number {
        return Math.floor(this.date.getTime() / 1000);
    }

    toString(): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const d = this.date;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
               `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
}

function createTimeModule() {
    return {
        now(): TimeStamp {
            return new TimeStamp(new Date());
        },

        async sleep(seconds: number): Promise<void> {
            return new Promise(resolve =>
                setTimeout(resolve, Math.max(0, seconds * 1000)));
        },

        fromUnix(timestamp: number): TimeStamp {
            return new TimeStamp(new Date(timestamp * 1000));
        },
    };
}

export interface VirtualFS {
    read(filename: string): string | null;
    write(filename: string, content: string): void;
    exists(filename: string): boolean;
}

export class InMemoryFS implements VirtualFS {
    private files: Map<string, string> = new Map();

    preload(filename: string, content: string): void {
        this.files.set(filename, content);
    }

    read(filename: string): string | null {
        return this.files.get(filename) ?? null;
    }

    write(filename: string, content: string): void {
        this.files.set(filename, content);
    }

    exists(filename: string): boolean {
        return this.files.has(filename);
    }
}

class FileInputStream {
    private lines: string[];
    private pos: number = 0;

    constructor(content: string) {
        this.lines = content.split('\n');
    }

    readLine(): string {
        if (this.pos >= this.lines.length) return '';
        const line = this.lines[this.pos];
        this.pos++;
        if (this.pos < this.lines.length) {
            return line + '\n';
        }
        return line;
    }

    hasNextLine(): boolean {
        return this.pos < this.lines.length;
    }

    close(): void {
    }
}

class FileOutputStream {
    private buffer: string = '';
    private readonly fs: VirtualFS;
    private readonly filename: string;

    constructor(fs: VirtualFS, filename: string, append: boolean = false) {
        this.fs = fs;
        this.filename = filename;
        
        if (append) {
            const existing = fs.read(filename);
            if (existing !== null) {
                this.buffer = existing;
            }
        }
    }

    writeLine(...args: unknown[]): void {
        for (const arg of args) {
            this.buffer += String(arg);
        }
    }

    close(): void {
        this.fs.write(this.filename, this.buffer);
    }
}

function createFileModule(fs: VirtualFS) {
    return {
        open(
            filename: string, mode: string, file: string, line: number,
        ): FileInputStream | FileOutputStream {
            if (mode === 'read') {
                const content = fs.read(filename);
                if (content === null) {
                    throw new IdylRuntimeError(file, line,
                        `cannot open file "${filename}" for reading (file not found)`);
                }
                return new FileInputStream(content);
            }
            if (mode === 'write') {
                return new FileOutputStream(fs, filename, false);
            }
            if (mode === 'append') {
                return new FileOutputStream(fs, filename, true);
            }
            throw new IdylRuntimeError(file, line,
                `unknown file mode "${mode}" (expected "read", "write", or "append")`);
        },
    };
}

export interface IdylRuntime {
    IdylArray: typeof IdylArray;
    div:       typeof idylDiv;
    mod:       typeof idylMod;
    toInt:     typeof idylToInt;
    toFloat:   typeof idylToFloat;
    toString_: typeof idylToString;
    max:       typeof idylMax;
    min:       typeof idylMin;
    sum:       typeof idylSum;
    avg:       typeof idylAvg;
    strCharAt:    typeof strCharAt;
    strContains:  typeof strContains;
    strFind:      typeof strFind;
    strCount:     typeof strCount;
    strSubstring: typeof strSubstring;
    strReplace:   typeof strReplace;
    strSplit:     typeof strSplit;
    strTrim:      typeof strTrim;
    strIsInt:     typeof strIsInt;
    strIsFloat:   typeof strIsFloat;
    console: ReturnType<typeof createConsoleModule>;
    math:    ReturnType<typeof createMathModule>;
    random:  ReturnType<typeof createRandomModule>;
    time:    ReturnType<typeof createTimeModule>;
    file:    ReturnType<typeof createFileModule>;
    gui:     ReturnType<typeof createGuiModule>;
    types: typeof typesFactory;
    encoding: ReturnType<typeof createEncodingModule>;
}

export interface RuntimeOptions {
    console: ConsoleIO;
    fs?: VirtualFS;
}

export function createRuntime(options: RuntimeOptions): IdylRuntime {
    const fs = options.fs ?? new InMemoryFS();

    return {
        IdylArray,

        div:       idylDiv,
        mod:       idylMod,
        toInt:     idylToInt,
        toFloat:   idylToFloat,
        toString_: idylToString,
        max:       idylMax,
        min:       idylMin,
        sum:       idylSum,
        avg:       idylAvg,

        strCharAt,
        strContains,
        strFind,
        strCount,
        strSubstring,
        strReplace,
        strSplit,
        strTrim,
        strIsInt,
        strIsFloat,

        console: createConsoleModule(options.console),
        math:    createMathModule(),
        random:  createRandomModule(),
        time:    createTimeModule(),
        file:    createFileModule(fs),
        gui:     createGuiModule(),
        types: typesFactory,
        encoding: createEncodingModule(),
    };
}