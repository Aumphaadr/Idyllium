import { IdylRuntimeError, IdylArray } from './array';
import { FixedInt, FixedFloat, typesFactory } from './types';
import { createEncodingModule } from './encoding';
import { createGuiModule } from './gui/index';
export { IdylRuntimeError, IdylArray };
export { FixedInt, FixedFloat, typesFactory };
declare function idylDiv(a: number, b: number, file: string, line: number): number;
declare function idylMod(a: number, b: number, file: string, line: number): number;
declare function idylToInt(value: unknown, file: string, line: number): number;
declare function idylToFloat(value: unknown, file: string, line: number): number;
declare function idylToString(value: unknown): string;
declare function idylMax(arr: IdylArray<number>): number;
declare function idylMin(arr: IdylArray<number>): number;
declare function idylSum(arr: IdylArray<number>): number;
declare function idylAvg(arr: IdylArray<number>): number;
declare function strCharAt(s: string, index: number, file: string, line: number): string;
declare function strContains(s: string, search: string): boolean;
declare function strFind(s: string, search: string): number;
declare function strCount(s: string, search: string): number;
declare function strSubstring(s: string, start: number, count?: number): string;
declare function strReplace(s: string, oldStr: string, newStr: string): string;
declare function strSplit(s: string, delimiter: string): IdylArray<string>;
declare function strTrim(s: string): string;
declare function strIsInt(s: string): boolean;
declare function strIsFloat(s: string): boolean;
export interface ConsoleIO {
    print(text: string): void;
    readLine(): Promise<string>;
}
declare function createConsoleModule(io: ConsoleIO): {
    write(...args: unknown[]): void;
    writeln(...args: unknown[]): void;
    getInt(file: string, line: number): Promise<number>;
    getFloat(file: string, line: number): Promise<number>;
    getString(): Promise<string>;
    setPrecision(digits: number): void;
};
declare function createMathModule(): {
    pi: number;
    e: number;
    abs(x: number): number;
    round(x: number, digits?: number): number;
    floor(x: number, digits?: number): number;
    ceil(x: number, digits?: number): number;
    pow(base: number, exp: number): number;
    sqrt(x: number, file: string, line: number): number;
    clamp(min: number, val: number, max: number): number;
    asin(x: number, file: string, line: number): number;
    acos(x: number, file: string, line: number): number;
    toRadians(deg: number): number;
    toDegrees(rad: number): number;
    log(x: number, file: string, line: number): number;
    log10(x: number, file: string, line: number): number;
};
declare function createRandomModule(): {
    createInt(min: number, max: number): number;
    createFloat(min: number, max: number): number;
    chooseFrom(source: string | IdylArray<unknown>): unknown;
    setSeed(seed: number): void;
};
declare class TimeStamp {
    private readonly date;
    constructor(date: Date);
    year(): number;
    month(): number;
    day(): number;
    hour(): number;
    minute(): number;
    second(): number;
    weekDay(): number;
    unix(): number;
    toString(): string;
}
declare function createTimeModule(): {
    now(): TimeStamp;
    sleep(seconds: number): Promise<void>;
    fromUnix(timestamp: number): TimeStamp;
};
export interface VirtualFS {
    read(filename: string): string | null;
    write(filename: string, content: string): void;
    exists(filename: string): boolean;
}
export declare class InMemoryFS implements VirtualFS {
    private files;
    preload(filename: string, content: string): void;
    read(filename: string): string | null;
    write(filename: string, content: string): void;
    exists(filename: string): boolean;
}
declare class FileInputStream {
    private lines;
    private pos;
    constructor(content: string);
    readLine(): string;
    hasNextLine(): boolean;
    close(): void;
}
declare class FileOutputStream {
    private buffer;
    private readonly fs;
    private readonly filename;
    constructor(fs: VirtualFS, filename: string, append?: boolean);
    writeLine(...args: unknown[]): void;
    close(): void;
}
declare function createFileModule(fs: VirtualFS): {
    open(filename: string, mode: string, file: string, line: number): FileInputStream | FileOutputStream;
};
export interface IdylRuntime {
    IdylArray: typeof IdylArray;
    div: typeof idylDiv;
    mod: typeof idylMod;
    toInt: typeof idylToInt;
    toFloat: typeof idylToFloat;
    toString_: typeof idylToString;
    max: typeof idylMax;
    min: typeof idylMin;
    sum: typeof idylSum;
    avg: typeof idylAvg;
    strCharAt: typeof strCharAt;
    strContains: typeof strContains;
    strFind: typeof strFind;
    strCount: typeof strCount;
    strSubstring: typeof strSubstring;
    strReplace: typeof strReplace;
    strSplit: typeof strSplit;
    strTrim: typeof strTrim;
    strIsInt: typeof strIsInt;
    strIsFloat: typeof strIsFloat;
    console: ReturnType<typeof createConsoleModule>;
    math: ReturnType<typeof createMathModule>;
    random: ReturnType<typeof createRandomModule>;
    time: ReturnType<typeof createTimeModule>;
    file: ReturnType<typeof createFileModule>;
    gui: ReturnType<typeof createGuiModule>;
    types: typeof typesFactory;
    encoding: ReturnType<typeof createEncodingModule>;
}
export interface RuntimeOptions {
    console: ConsoleIO;
    fs?: VirtualFS;
}
export declare function createRuntime(options: RuntimeOptions): IdylRuntime;
//# sourceMappingURL=runtime.d.ts.map