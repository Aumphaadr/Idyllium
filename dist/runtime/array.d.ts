export declare class IdylRuntimeError extends Error {
    readonly idylFile: string;
    readonly idylLine: number;
    constructor(file: string, line: number, message: string);
}
export declare class IdylArray<T> {
    private data;
    private readonly fixed;
    private constructor();
    static from<T>(elements: T[], expectedSize: number, fixed: boolean): IdylArray<T>;
    static filled<T>(size: number, value: T, fixed: boolean): IdylArray<T>;
    static generate<T>(size: number, factory: () => T, fixed: boolean): IdylArray<T>;
    static empty<T>(fixed: boolean): IdylArray<T>;
    get(index: number, file: string, line: number): T;
    set(index: number, value: T, file: string, line: number): void;
    private checkBounds;
    length(): number;
    contains(value: T): boolean;
    find(value: T): number;
    count(value: T): number;
    reverse(): void;
    sort(): void;
    private requireDynamic;
    add(value: T): void;
    removeAt(index: number, file: string, line: number): void;
    resize(newSize: number): void;
    insert(index: number, value: T): void;
    join(other: IdylArray<T>): void;
    clear(): void;
    pop(file: string, line: number): T;
    getData(): readonly T[];
    toString(): string;
}
//# sourceMappingURL=array.d.ts.map