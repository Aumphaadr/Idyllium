"use strict";
// src/runtime/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.typesFactory = exports.FixedFloat = exports.FixedInt = void 0;
class FixedInt {
    constructor(bits, signed, initial = 0) {
        this.bits = bits;
        this.signed = signed;
        if (signed) {
            this.min = -(2 ** (bits - 1));
            this.max = 2 ** (bits - 1) - 1;
            this.modv = 2 ** bits;
        }
        else {
            this.min = 0;
            this.max = 2 ** bits - 1;
            this.modv = 2 ** bits;
        }
        this.value = this.wrap(Math.trunc(initial));
    }
    wrap(n) {
        n = Math.trunc(n);
        if (this.signed) {
            n = ((n % this.modv) + this.modv) % this.modv;
            if (n > this.max) {
                n = n - this.modv;
            }
            return n;
        }
        else {
            return ((n % this.modv) + this.modv) % this.modv;
        }
    }
    get() {
        return this.value;
    }
    set(n) {
        this.value = this.wrap(n);
    }
    add(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return new FixedInt(this.bits, this.signed, this.value + otherVal);
    }
    sub(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return new FixedInt(this.bits, this.signed, this.value - otherVal);
    }
    mul(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return new FixedInt(this.bits, this.signed, this.value * otherVal);
    }
    div(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        if (otherVal === 0) {
            throw new Error('Division by zero');
        }
        return new FixedInt(this.bits, this.signed, Math.trunc(this.value / otherVal));
    }
    mod(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        if (otherVal === 0) {
            throw new Error('Division by zero');
        }
        return new FixedInt(this.bits, this.signed, this.value % otherVal);
    }
    eq(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value === otherVal;
    }
    ne(other) {
        return !this.eq(other);
    }
    lt(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value < otherVal;
    }
    le(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value <= otherVal;
    }
    gt(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value > otherVal;
    }
    ge(other) {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value >= otherVal;
    }
    toBin() {
        if (this.value >= 0) {
            return this.value.toString(2).padStart(this.bits, '0');
        }
        else {
            const positive = this.modv + this.value;
            return positive.toString(2).padStart(this.bits, '0');
        }
    }
    toHex() {
        const hexDigits = Math.ceil(this.bits / 4);
        if (this.value >= 0) {
            return this.value.toString(16).toUpperCase().padStart(hexDigits, '0');
        }
        else {
            const positive = this.modv + this.value;
            return positive.toString(16).toUpperCase().padStart(hexDigits, '0');
        }
    }
    getMin() { return this.min; }
    getMax() { return this.max; }
    getBits() { return this.bits; }
    isSigned() { return this.signed; }
    valueOf() {
        return this.value;
    }
    toString() {
        return this.value.toString();
    }
}
exports.FixedInt = FixedInt;
class FixedFloat {
    constructor(bits, initial = 0) {
        this.bits = bits;
        this.value = this.truncate(initial);
    }
    truncate(n) {
        if (this.bits === 32) {
            const arr = new Float32Array(1);
            arr[0] = n;
            return arr[0];
        }
        else {
            return n;
        }
    }
    get() {
        return this.value;
    }
    set(n) {
        this.value = this.truncate(n);
    }
    add(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value + otherVal);
    }
    sub(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value - otherVal);
    }
    mul(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value * otherVal);
    }
    div(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value / otherVal);
    }
    eq(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value === otherVal;
    }
    ne(other) {
        return !this.eq(other);
    }
    lt(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value < otherVal;
    }
    le(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value <= otherVal;
    }
    gt(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value > otherVal;
    }
    ge(other) {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value >= otherVal;
    }
    toHex() {
        if (this.bits === 32) {
            const view = new DataView(new ArrayBuffer(4));
            view.setFloat32(0, this.value);
            return view.getUint32(0).toString(16).toUpperCase().padStart(8, '0');
        }
        else {
            const view = new DataView(new ArrayBuffer(8));
            view.setFloat64(0, this.value);
            const high = view.getUint32(0).toString(16).toUpperCase().padStart(8, '0');
            const low = view.getUint32(4).toString(16).toUpperCase().padStart(8, '0');
            return high + low;
        }
    }
    toBin() {
        const hex = this.toHex();
        return hex.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    }
    getBits() { return this.bits; }
    getPrecision() {
        return this.bits === 32 ? 7 : 15;
    }
    valueOf() {
        return this.value;
    }
    toString() {
        return this.value.toString();
    }
}
exports.FixedFloat = FixedFloat;
function fromBin(binStr, typeName) {
    const cleaned = binStr.trim().replace(/^0b/i, '');
    const value = parseInt(cleaned, 2);
    if (isNaN(value)) {
        throw new Error(`Invalid binary string: "${binStr}"`);
    }
    return createFixedFromValue(value, typeName);
}
function fromHex(hexStr, typeName) {
    const cleaned = hexStr.trim().replace(/^0x/i, '');
    const value = parseInt(cleaned, 16);
    if (isNaN(value)) {
        throw new Error(`Invalid hexadecimal string: "${hexStr}"`);
    }
    return createFixedFromValue(value, typeName);
}
function createFixedFromValue(value, typeName) {
    switch (typeName) {
        case 'int8': return new FixedInt(8, true, value);
        case 'int16': return new FixedInt(16, true, value);
        case 'int32': return new FixedInt(32, true, value);
        case 'int64': return new FixedInt(64, true, value);
        case 'uint8': return new FixedInt(8, false, value);
        case 'uint16': return new FixedInt(16, false, value);
        case 'uint32': return new FixedInt(32, false, value);
        case 'uint64': return new FixedInt(64, false, value);
        case 'float32': return new FixedFloat(32, value);
        case 'float64': return new FixedFloat(64, value);
        default:
            throw new Error(`Unknown type: "${typeName}"`);
    }
}
exports.typesFactory = {
    int8: (v = 0) => new FixedInt(8, true, v),
    int16: (v = 0) => new FixedInt(16, true, v),
    int32: (v = 0) => new FixedInt(32, true, v),
    int64: (v = 0) => new FixedInt(64, true, v),
    uint8: (v = 0) => new FixedInt(8, false, v),
    uint16: (v = 0) => new FixedInt(16, false, v),
    uint32: (v = 0) => new FixedInt(32, false, v),
    uint64: (v = 0) => new FixedInt(64, false, v),
    float32: (v = 0) => new FixedFloat(32, v),
    float64: (v = 0) => new FixedFloat(64, v),
    fromBin,
    fromHex,
};
//# sourceMappingURL=types.js.map