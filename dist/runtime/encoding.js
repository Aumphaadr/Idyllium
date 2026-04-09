"use strict";
// src/runtime/encoding.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEncodingModule = createEncodingModule;
const array_1 = require("./array");
const WIN1251_TO_UNICODE = [
    0x0402, 0x0403, 0x201A, 0x0453, 0x201E, 0x2026, 0x2020, 0x2021,
    0x20AC, 0x2030, 0x0409, 0x2039, 0x040A, 0x040C, 0x040B, 0x040F,
    0x0452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
    0x0098, 0x2122, 0x0459, 0x203A, 0x045A, 0x045C, 0x045B, 0x045F,
    0x00A0, 0x040E, 0x045E, 0x0408, 0x00A4, 0x0490, 0x00A6, 0x00A7,
    0x0401, 0x00A9, 0x0404, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x0407,
    0x00B0, 0x00B1, 0x0406, 0x0456, 0x0491, 0x00B5, 0x00B6, 0x00B7,
    0x0451, 0x2116, 0x0454, 0x00BB, 0x0458, 0x0405, 0x0455, 0x0457,
    0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417,
    0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F,
    0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427,
    0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F,
    0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437,
    0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F,
    0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447,
    0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F,
];
const UNICODE_TO_WIN1251 = new Map();
for (let i = 0; i < 128; i++) {
    UNICODE_TO_WIN1251.set(i, i);
}
for (let i = 0; i < WIN1251_TO_UNICODE.length; i++) {
    UNICODE_TO_WIN1251.set(WIN1251_TO_UNICODE[i], 128 + i);
}
const KOI8R_TO_UNICODE = [
    0x2500, 0x2502, 0x250C, 0x2510, 0x2514, 0x2518, 0x251C, 0x2524,
    0x252C, 0x2534, 0x253C, 0x2580, 0x2584, 0x2588, 0x258C, 0x2590,
    0x2591, 0x2592, 0x2593, 0x2320, 0x25A0, 0x2219, 0x221A, 0x2248,
    0x2264, 0x2265, 0x00A0, 0x2321, 0x00B0, 0x00B2, 0x00B7, 0x00F7,
    0x2550, 0x2551, 0x2552, 0x0451, 0x2553, 0x2554, 0x2555, 0x2556,
    0x2557, 0x2558, 0x2559, 0x255A, 0x255B, 0x255C, 0x255D, 0x255E,
    0x255F, 0x2560, 0x2561, 0x0401, 0x2562, 0x2563, 0x2564, 0x2565,
    0x2566, 0x2567, 0x2568, 0x2569, 0x256A, 0x256B, 0x256C, 0x00A9,
    0x044E, 0x0430, 0x0431, 0x0446, 0x0434, 0x0435, 0x0444, 0x0433,
    0x0445, 0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E,
    0x043F, 0x044F, 0x0440, 0x0441, 0x0442, 0x0443, 0x0436, 0x0432,
    0x044C, 0x044B, 0x0437, 0x0448, 0x044D, 0x0449, 0x0447, 0x044A,
    0x042E, 0x0410, 0x0411, 0x0426, 0x0414, 0x0415, 0x0424, 0x0413,
    0x0425, 0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E,
    0x041F, 0x042F, 0x0420, 0x0421, 0x0422, 0x0423, 0x0416, 0x0412,
    0x042C, 0x042B, 0x0417, 0x0428, 0x042D, 0x0429, 0x0427, 0x042A,
];
const UNICODE_TO_KOI8R = new Map();
for (let i = 0; i < 128; i++) {
    UNICODE_TO_KOI8R.set(i, i);
}
for (let i = 0; i < KOI8R_TO_UNICODE.length; i++) {
    UNICODE_TO_KOI8R.set(KOI8R_TO_UNICODE[i], 128 + i);
}
const ISO8859_5_TO_UNICODE = [
    0x00A0, 0x0401, 0x0402, 0x0403, 0x0404, 0x0405, 0x0406, 0x0407,
    0x0408, 0x0409, 0x040A, 0x040B, 0x040C, 0x00AD, 0x040E, 0x040F,
    0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417,
    0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F,
    0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427,
    0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F,
    0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437,
    0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F,
    0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447,
    0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F,
    0x2116, 0x0451, 0x0452, 0x0453, 0x0454, 0x0455, 0x0456, 0x0457,
    0x0458, 0x0459, 0x045A, 0x045B, 0x045C, 0x00A7, 0x045E, 0x045F,
];
const UNICODE_TO_ISO8859_5 = new Map();
for (let i = 0; i < 160; i++) {
    UNICODE_TO_ISO8859_5.set(i, i);
}
for (let i = 0; i < ISO8859_5_TO_UNICODE.length; i++) {
    UNICODE_TO_ISO8859_5.set(ISO8859_5_TO_UNICODE[i], 160 + i);
}
const ENCODINGS = new Set([
    'utf-8', 'utf-16', 'ascii', 'windows-1251', 'iso-8859-5', 'koi8-r'
]);
function validateEncoding(encoding, file, line) {
    if (!ENCODINGS.has(encoding.toLowerCase())) {
        throw new Error(`${file}:${line}: runtime error: unknown encoding '${encoding}'`);
    }
}
function charToInt(char, encoding, file, line) {
    validateEncoding(encoding, file, line);
    if (char.length === 0) {
        return 0;
    }
    const codePoint = char.codePointAt(0) ?? 0;
    const enc = encoding.toLowerCase();
    switch (enc) {
        case 'utf-8':
        case 'utf-16':
            return codePoint;
        case 'ascii':
            if (codePoint > 127) {
                throw new Error(`${file}:${line}: runtime error: character '${char}' (U+${codePoint.toString(16).toUpperCase()}) is not valid ASCII`);
            }
            return codePoint;
        case 'windows-1251': {
            const code = UNICODE_TO_WIN1251.get(codePoint);
            if (code === undefined) {
                throw new Error(`${file}:${line}: runtime error: character '${char}' (U+${codePoint.toString(16).toUpperCase()}) is not representable in Windows-1251`);
            }
            return code;
        }
        case 'koi8-r': {
            const code = UNICODE_TO_KOI8R.get(codePoint);
            if (code === undefined) {
                throw new Error(`${file}:${line}: runtime error: character '${char}' (U+${codePoint.toString(16).toUpperCase()}) is not representable in KOI8-R`);
            }
            return code;
        }
        case 'iso-8859-5': {
            const code = UNICODE_TO_ISO8859_5.get(codePoint);
            if (code === undefined) {
                throw new Error(`${file}:${line}: runtime error: character '${char}' (U+${codePoint.toString(16).toUpperCase()}) is not representable in ISO-8859-5`);
            }
            return code;
        }
        default:
            return codePoint;
    }
}
function intToChar(code, encoding, file, line) {
    validateEncoding(encoding, file, line);
    const enc = encoding.toLowerCase();
    switch (enc) {
        case 'utf-8':
        case 'utf-16':
            return String.fromCodePoint(code);
        case 'ascii':
            if (code < 0 || code > 127) {
                throw new Error(`${file}:${line}: runtime error: code ${code} is not valid ASCII (0-127)`);
            }
            return String.fromCharCode(code);
        case 'windows-1251':
            if (code < 0 || code > 255) {
                throw new Error(`${file}:${line}: runtime error: code ${code} is out of range for Windows-1251 (0-255)`);
            }
            if (code < 128) {
                return String.fromCharCode(code);
            }
            return String.fromCodePoint(WIN1251_TO_UNICODE[code - 128]);
        case 'koi8-r':
            if (code < 0 || code > 255) {
                throw new Error(`${file}:${line}: runtime error: code ${code} is out of range for KOI8-R (0-255)`);
            }
            if (code < 128) {
                return String.fromCharCode(code);
            }
            return String.fromCodePoint(KOI8R_TO_UNICODE[code - 128]);
        case 'iso-8859-5':
            if (code < 0 || code > 255) {
                throw new Error(`${file}:${line}: runtime error: code ${code} is out of range for ISO-8859-5 (0-255)`);
            }
            if (code < 160) {
                return String.fromCharCode(code);
            }
            return String.fromCodePoint(ISO8859_5_TO_UNICODE[code - 160]);
        default:
            return String.fromCodePoint(code);
    }
}
function encode(text, encoding, file, line) {
    validateEncoding(encoding, file, line);
    const enc = encoding.toLowerCase();
    const codes = [];
    switch (enc) {
        case 'utf-8': {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(text);
            for (const byte of bytes) {
                codes.push(byte);
            }
            break;
        }
        case 'utf-16': {
            for (let i = 0; i < text.length; i++) {
                codes.push(text.charCodeAt(i));
            }
            break;
        }
        case 'ascii':
        case 'windows-1251':
        case 'koi8-r':
        case 'iso-8859-5': {
            for (const char of text) {
                codes.push(charToInt(char, encoding, file, line));
            }
            break;
        }
    }
    return codes;
}
function decode(codes, encoding, file, line) {
    validateEncoding(encoding, file, line);
    const enc = encoding.toLowerCase();
    const data = codes instanceof array_1.IdylArray ? codes.getData() : codes;
    switch (enc) {
        case 'utf-8': {
            const bytes = new Uint8Array(data);
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(bytes);
        }
        case 'utf-16': {
            return String.fromCharCode(...data);
        }
        case 'ascii':
        case 'windows-1251':
        case 'koi8-r':
        case 'iso-8859-5': {
            let result = '';
            for (const code of data) {
                result += intToChar(code, encoding, file, line);
            }
            return result;
        }
        default:
            return '';
    }
}
function listEncodings() {
    return [...ENCODINGS];
}
function createEncodingModule() {
    return {
        charToInt,
        intToChar,
        encode,
        decode,
        listEncodings,
    };
}
//# sourceMappingURL=encoding.js.map