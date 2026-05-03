"use strict";
// src/runtime/runtime.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryFS = exports.typesFactory = exports.FixedFloat = exports.FixedInt = exports.IdylArray = exports.IdylRuntimeError = void 0;
exports.createRuntime = createRuntime;
const array_1 = require("./array");
Object.defineProperty(exports, "IdylRuntimeError", { enumerable: true, get: function () { return array_1.IdylRuntimeError; } });
Object.defineProperty(exports, "IdylArray", { enumerable: true, get: function () { return array_1.IdylArray; } });
const types_1 = require("./types");
Object.defineProperty(exports, "FixedInt", { enumerable: true, get: function () { return types_1.FixedInt; } });
Object.defineProperty(exports, "FixedFloat", { enumerable: true, get: function () { return types_1.FixedFloat; } });
Object.defineProperty(exports, "typesFactory", { enumerable: true, get: function () { return types_1.typesFactory; } });
const encoding_1 = require("./encoding");
const index_1 = require("./gui/index");
function defaultOf(sample) {
    if (typeof sample === 'number')
        return 0;
    if (typeof sample === 'string')
        return '';
    if (typeof sample === 'boolean')
        return false;
    return null;
}
function idylDiv(a, b, file, line) {
    if (b === 0) {
        throw new array_1.IdylRuntimeError(file, line, 'division by zero');
    }
    return Math.trunc(a / b);
}
function idylMod(a, b, file, line) {
    if (b === 0) {
        throw new array_1.IdylRuntimeError(file, line, 'division by zero (mod)');
    }
    return a % b;
}
function idylToInt(value, file, line) {
    if (typeof value === 'number') {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const n = parseInt(value, 10);
        if (isNaN(n)) {
            throw new array_1.IdylRuntimeError(file, line, `'to_int' cannot convert "${value}" to integer`);
        }
        return n;
    }
    throw new array_1.IdylRuntimeError(file, line, `'to_int' received unsupported type`);
}
function idylToFloat(value, file, line) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const n = parseFloat(value);
        if (isNaN(n)) {
            throw new array_1.IdylRuntimeError(file, line, `'to_float' cannot convert "${value}" to float`);
        }
        return n;
    }
    throw new array_1.IdylRuntimeError(file, line, `'to_float' received unsupported type`);
}
function idylToString(value) {
    if (value instanceof array_1.IdylArray)
        return value.toString();
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    return String(value);
}
function idylMax(arr) {
    const data = arr.getData();
    if (data.length === 0)
        return 0;
    let m = data[0];
    for (let i = 1; i < data.length; i++) {
        if (data[i] > m)
            m = data[i];
    }
    return m;
}
function idylMin(arr) {
    const data = arr.getData();
    if (data.length === 0)
        return 0;
    let m = data[0];
    for (let i = 1; i < data.length; i++) {
        if (data[i] < m)
            m = data[i];
    }
    return m;
}
function idylSum(arr) {
    const data = arr.getData();
    let s = 0;
    for (const v of data)
        s += v;
    return s;
}
function idylAvg(arr) {
    const data = arr.getData();
    if (data.length === 0)
        return 0;
    let s = 0;
    for (const v of data)
        s += v;
    return s / data.length;
}
function strCharAt(s, index, file, line) {
    if (index < 0 || index >= s.length) {
        const valid = s.length > 0
            ? `valid indices 0-${s.length - 1}`
            : 'string is empty';
        throw new array_1.IdylRuntimeError(file, line, `string index ${index} out of bounds (length ${s.length}, ${valid})`);
    }
    return s[index];
}
function strSetChar(s, index, ch, file, line) {
    if (index < 0 || index >= s.length) {
        const valid = s.length > 0
            ? `valid indices 0-${s.length - 1}`
            : 'string is empty';
        throw new array_1.IdylRuntimeError(file, line, `string index ${index} out of bounds (length ${s.length}, ${valid})`);
    }
    return s.substring(0, index) + ch[0] + s.substring(index + 1);
}
function arraysEqual(a, b) {
    if (a instanceof array_1.IdylArray && b instanceof array_1.IdylArray) {
        const dataA = a.getData();
        const dataB = b.getData();
        if (dataA.length !== dataB.length)
            return false;
        for (let i = 0; i < dataA.length; i++) {
            const elA = dataA[i];
            const elB = dataB[i];
            if (elA instanceof array_1.IdylArray || elB instanceof array_1.IdylArray) {
                if (!arraysEqual(elA, elB))
                    return false;
            }
            else if (elA !== elB) {
                return false;
            }
        }
        return true;
    }
    return a === b;
}
function strContains(s, search) {
    return s.includes(search);
}
function strFind(s, search) {
    return s.indexOf(search);
}
function strCount(s, search) {
    if (search.length === 0)
        return 0;
    let count = 0;
    let pos = 0;
    while (true) {
        const idx = s.indexOf(search, pos);
        if (idx === -1)
            break;
        count++;
        pos = idx + search.length;
    }
    return count;
}
function strSubstring(s, start, count) {
    if (start < 0)
        start = 0;
    if (count === undefined) {
        return s.substring(start);
    }
    return s.substring(start, start + count);
}
function strReplace(s, oldStr, newStr) {
    return s.split(oldStr).join(newStr);
}
function strSplit(s, delimiter) {
    const parts = s.split(delimiter);
    return array_1.IdylArray.from(parts, -1, false);
}
function strTrim(s) {
    return s.replace(/^[\s\n\r\t\0]+|[\s\n\r\t\0]+$/g, '');
}
function strIsInt(s) {
    return /^-?\d+$/.test(s.trim());
}
function strIsFloat(s) {
    const trimmed = s.trim();
    if (trimmed === '')
        return false;
    const n = Number(trimmed);
    return !isNaN(n) && isFinite(n);
}
function createConsoleModule(io) {
    let precision = null;
    async function formatValueAsync(v) {
        if (v === null || v === undefined)
            return 'null';
        if (v instanceof array_1.IdylArray)
            return v.toString();
        if (v instanceof types_1.FixedInt)
            return v.get().toString();
        if (v instanceof types_1.FixedFloat) {
            const val = v.get();
            if (precision !== null) {
                return Number(val.toFixed(precision)).toString();
            }
            return val.toString();
        }
        if (typeof v === 'number' && precision !== null) {
            return Number(v.toFixed(precision)).toString();
        }
        if (typeof v === 'boolean')
            return v ? 'true' : 'false';
        if (typeof v === 'string')
            return v;
        if (typeof v === 'object') {
            const obj = v;
            if (typeof obj.to_string === 'function') {
                try {
                    const result = await obj.to_string();
                    return String(result);
                }
                catch (e) {
                    // Fall through to error
                }
            }
            const className = v.constructor?.name ?? 'Object';
            throw new array_1.IdylRuntimeError('runtime', 0, `cannot print object of class '${className}' directly; define a 'string function to_string()' method`);
        }
        return String(v);
    }
    return {
        async write(...args) {
            const parts = [];
            for (const v of args) {
                parts.push(await formatValueAsync(v));
            }
            io.print(parts.join(''));
        },
        async writeln(...args) {
            const parts = [];
            for (const v of args) {
                parts.push(await formatValueAsync(v));
            }
            io.print(parts.join('') + '\n');
        },
        async getInt(file, line) {
            const raw = await io.readLine();
            const trimmed = raw.trim();
            const n = parseInt(trimmed, 10);
            if (isNaN(n) || !(/^-?\d+$/.test(trimmed))) {
                throw new array_1.IdylRuntimeError(file, line, `cannot convert input to 'int' (expected integer, got "${trimmed}")`);
            }
            return n;
        },
        async getFloat(file, line) {
            const raw = await io.readLine();
            const trimmed = raw.trim();
            const n = parseFloat(trimmed);
            if (isNaN(n)) {
                throw new array_1.IdylRuntimeError(file, line, `cannot convert input to 'float' (expected number, got "${trimmed}")`);
            }
            return n;
        },
        async getString() {
            return io.readLine();
        },
        setPrecision(digits) {
            precision = digits > 0 ? digits : null;
        },
    };
}
function createMathModule() {
    return {
        pi: Math.PI,
        e: Math.E,
        abs(x) {
            return Math.abs(x);
        },
        round(x, digits) {
            if (digits === undefined)
                return Math.round(x);
            const factor = Math.pow(10, digits);
            return Math.round(x * factor) / factor;
        },
        floor(x, digits) {
            if (digits === undefined)
                return Math.floor(x);
            const factor = Math.pow(10, digits);
            return Math.floor(x * factor) / factor;
        },
        ceil(x, digits) {
            if (digits === undefined)
                return Math.ceil(x);
            const factor = Math.pow(10, digits);
            return Math.ceil(x * factor) / factor;
        },
        pow(base, exp) {
            return Math.pow(base, exp);
        },
        sqrt(x, file, line) {
            if (x < 0) {
                throw new array_1.IdylRuntimeError(file, line, `math.sqrt argument must be >= 0 (got ${x})`);
            }
            return Math.sqrt(x);
        },
        clamp(min, val, max) {
            return Math.max(min, Math.min(val, max));
        },
        asin(x, file, line) {
            if (x < -1 || x > 1) {
                throw new array_1.IdylRuntimeError(file, line, `math.asin argument must be between -1 and 1 (got ${x})`);
            }
            return Math.asin(x);
        },
        acos(x, file, line) {
            if (x < -1 || x > 1) {
                throw new array_1.IdylRuntimeError(file, line, `math.acos argument must be between -1 and 1 (got ${x})`);
            }
            return Math.acos(x);
        },
        toRadians(deg) {
            return deg * (Math.PI / 180);
        },
        toDegrees(rad) {
            return rad * (180 / Math.PI);
        },
        log(x, file, line) {
            if (x <= 0) {
                throw new array_1.IdylRuntimeError(file, line, `math.log argument must be > 0 (got ${x})`);
            }
            return Math.log(x);
        },
        log10(x, file, line) {
            if (x <= 0) {
                throw new array_1.IdylRuntimeError(file, line, `math.log10 argument must be > 0 (got ${x})`);
            }
            return Math.log10(x);
        },
    };
}
function mulberry32(seed) {
    let state = seed | 0;
    return function () {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function createRandomModule() {
    let rng = mulberry32(Date.now() ^ (Math.random() * 0xFFFFFFFF));
    return {
        createInt(min, max) {
            return Math.floor(rng() * (max - min + 1)) + min;
        },
        createFloat(min, max) {
            return rng() * (max - min) + min;
        },
        chooseFrom(source) {
            if (typeof source === 'string') {
                if (source.length === 0)
                    return '\0';
                const idx = Math.floor(rng() * source.length);
                return source[idx];
            }
            const data = source.getData();
            if (data.length === 0)
                return null;
            const idx = Math.floor(rng() * data.length);
            return data[idx];
        },
        setSeed(seed) {
            rng = mulberry32(seed);
        },
    };
}
async function initValueDeep(value) {
    if (value instanceof array_1.IdylArray) {
        await value.initElementsDeep(async (item) => await initValueDeep(item));
        return value;
    }
    if (value !== null && typeof value === 'object') {
        const obj = value;
        if (typeof obj.__init__ === 'function') {
            await obj.__init__();
        }
    }
    return value;
}
class TimeStamp {
    constructor(date) {
        this.date = date;
    }
    year() { return this.date.getFullYear(); }
    month() { return this.date.getMonth() + 1; }
    day() { return this.date.getDate(); }
    hour() { return this.date.getHours(); }
    minute() { return this.date.getMinutes(); }
    second() { return this.date.getSeconds(); }
    weekDay() { return this.date.getDay(); }
    unix() {
        return Math.floor(this.date.getTime() / 1000);
    }
    toString() {
        const pad = (n) => n.toString().padStart(2, '0');
        const d = this.date;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
            `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
}
function createTimeModule() {
    return {
        now() {
            return new TimeStamp(new Date());
        },
        async sleep(seconds) {
            return new Promise(resolve => setTimeout(resolve, Math.max(0, seconds * 1000)));
        },
        fromUnix(timestamp) {
            return new TimeStamp(new Date(timestamp * 1000));
        },
    };
}
class InMemoryFS {
    constructor() {
        this.files = new Map();
    }
    preload(filename, content) {
        this.files.set(filename, content);
    }
    read(filename) {
        return this.files.get(filename) ?? null;
    }
    write(filename, content) {
        this.files.set(filename, content);
    }
    exists(filename) {
        return this.files.has(filename);
    }
}
exports.InMemoryFS = InMemoryFS;
class FileInputStream {
    constructor(content) {
        this.pos = 0;
        this.lines = content.split('\n');
    }
    readLine() {
        if (this.pos >= this.lines.length)
            return '';
        const line = this.lines[this.pos];
        this.pos++;
        if (this.pos < this.lines.length) {
            return line + '\n';
        }
        return line;
    }
    hasNextLine() {
        return this.pos < this.lines.length;
    }
    close() {
    }
}
class FileOutputStream {
    constructor(fs, filename, append = false) {
        this.buffer = '';
        this.fs = fs;
        this.filename = filename;
        if (append) {
            const existing = fs.read(filename);
            if (existing !== null) {
                this.buffer = existing;
            }
        }
    }
    writeLine(...args) {
        for (const arg of args) {
            this.buffer += String(arg);
        }
    }
    close() {
        this.fs.write(this.filename, this.buffer);
    }
}
function createFileModule(fs) {
    return {
        open(filename, mode, file, line) {
            if (mode === 'read') {
                const content = fs.read(filename);
                if (content === null) {
                    throw new array_1.IdylRuntimeError(file, line, `cannot open file "${filename}" for reading (file not found)`);
                }
                return new FileInputStream(content);
            }
            if (mode === 'write') {
                return new FileOutputStream(fs, filename, false);
            }
            if (mode === 'append') {
                return new FileOutputStream(fs, filename, true);
            }
            throw new array_1.IdylRuntimeError(file, line, `unknown file mode "${mode}" (expected "read", "write", or "append")`);
        },
    };
}
function createRuntime(options) {
    const fs = options.fs ?? new InMemoryFS();
    return {
        IdylArray: array_1.IdylArray,
        initValueDeep,
        div: idylDiv,
        mod: idylMod,
        toInt: idylToInt,
        toFloat: idylToFloat,
        toString_: idylToString,
        max: idylMax,
        min: idylMin,
        sum: idylSum,
        avg: idylAvg,
        strCharAt,
        strSetChar,
        arraysEqual,
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
        math: createMathModule(),
        random: createRandomModule(),
        time: createTimeModule(),
        file: createFileModule(fs),
        gui: (0, index_1.createGuiModule)(),
        types: types_1.typesFactory,
        encoding: (0, encoding_1.createEncodingModule)(),
    };
}
//# sourceMappingURL=runtime.js.map