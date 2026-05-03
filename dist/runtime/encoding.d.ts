import { IdylArray } from './array';
declare function charToInt(char: string, encoding: string, file: string, line: number): number;
declare function intToChar(code: number, encoding: string, file: string, line: number): string;
declare function encode(text: string, encoding: string, file: string, line: number): number[];
declare function decode(codes: IdylArray<number> | number[], encoding: string, file: string, line: number): string;
declare function listEncodings(): string[];
export declare function createEncodingModule(): {
    charToInt: typeof charToInt;
    intToChar: typeof intToChar;
    encode: typeof encode;
    decode: typeof decode;
    listEncodings: typeof listEncodings;
};
export {};
//# sourceMappingURL=encoding.d.ts.map