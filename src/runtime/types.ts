// src/runtime/types.ts

import { IdylRuntimeError } from './array';

export class FixedInt {
    private value: number;
    private readonly bits: number;
    private readonly signed: boolean;
    private readonly min: number;
    private readonly max: number;
    private readonly modv: number;

    constructor(bits: number, signed: boolean, initial: number = 0) {
        this.bits = bits;
        this.signed = signed;
        
        if (signed) {
            this.min = -(2 ** (bits - 1));
            this.max = 2 ** (bits - 1) - 1;
            this.modv = 2 ** bits;
        } else {
            this.min = 0;
            this.max = 2 ** bits - 1;
            this.modv = 2 ** bits;
        }
        
        this.value = this.wrap(Math.trunc(initial));
    }

    private wrap(n: number): number {
        n = Math.trunc(n);
        
        if (this.signed) {
            n = ((n % this.modv) + this.modv) % this.modv;
            if (n > this.max) {
                n = n - this.modv;
            }
            return n;
        } else {
            return ((n % this.modv) + this.modv) % this.modv;
        }
    }

    get(): number {
        return this.value;
    }

    set(n: number): void {
        this.value = this.wrap(n);
    }

    add(other: number | FixedInt): FixedInt {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return new FixedInt(this.bits, this.signed, this.value + otherVal);
    }

    sub(other: number | FixedInt): FixedInt {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return new FixedInt(this.bits, this.signed, this.value - otherVal);
    }

    mul(other: number | FixedInt): FixedInt {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return new FixedInt(this.bits, this.signed, this.value * otherVal);
    }

    div(other: number | FixedInt): FixedInt {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        if (otherVal === 0) {
            throw new Error('Division by zero');
        }
        return new FixedInt(this.bits, this.signed, Math.trunc(this.value / otherVal));
    }

    mod(other: number | FixedInt): FixedInt {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        if (otherVal === 0) {
            throw new Error('Division by zero');
        }
        return new FixedInt(this.bits, this.signed, this.value % otherVal);
    }

    eq(other: number | FixedInt): boolean {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value === otherVal;
    }

    ne(other: number | FixedInt): boolean {
        return !this.eq(other);
    }

    lt(other: number | FixedInt): boolean {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value < otherVal;
    }

    le(other: number | FixedInt): boolean {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value <= otherVal;
    }

    gt(other: number | FixedInt): boolean {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value > otherVal;
    }

    ge(other: number | FixedInt): boolean {
        const otherVal = other instanceof FixedInt ? other.get() : other;
        return this.value >= otherVal;
    }

    toBin(): string {
        if (this.value >= 0) {
            return this.value.toString(2).padStart(this.bits, '0');
        } else {
            const positive = this.modv + this.value;
            return positive.toString(2).padStart(this.bits, '0');
        }
    }

    toHex(): string {
        const hexDigits = Math.ceil(this.bits / 4);
        if (this.value >= 0) {
            return this.value.toString(16).toUpperCase().padStart(hexDigits, '0');
        } else {
            const positive = this.modv + this.value;
            return positive.toString(16).toUpperCase().padStart(hexDigits, '0');
        }
    }

    getMin(): number { return this.min; }
    getMax(): number { return this.max; }
    getBits(): number { return this.bits; }
    isSigned(): boolean { return this.signed; }

    valueOf(): number {
        return this.value;
    }

    toString(): string {
        return this.value.toString();
    }
}

export class FixedFloat {
    private value: number;
    private readonly bits: 32 | 64;

    constructor(bits: 32 | 64, initial: number = 0) {
        this.bits = bits;
        this.value = this.truncate(initial);
    }

    private truncate(n: number): number {
        if (this.bits === 32) {
            const arr = new Float32Array(1);
            arr[0] = n;
            return arr[0];
        } else {
            return n;
        }
    }

    get(): number {
        return this.value;
    }

    set(n: number): void {
        this.value = this.truncate(n);
    }

    add(other: number | FixedFloat): FixedFloat {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value + otherVal);
    }

    sub(other: number | FixedFloat): FixedFloat {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value - otherVal);
    }

    mul(other: number | FixedFloat): FixedFloat {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value * otherVal);
    }

    div(other: number | FixedFloat): FixedFloat {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return new FixedFloat(this.bits, this.value / otherVal);
    }

    eq(other: number | FixedFloat): boolean {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value === otherVal;
    }

    ne(other: number | FixedFloat): boolean {
        return !this.eq(other);
    }

    lt(other: number | FixedFloat): boolean {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value < otherVal;
    }

    le(other: number | FixedFloat): boolean {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value <= otherVal;
    }

    gt(other: number | FixedFloat): boolean {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value > otherVal;
    }

    ge(other: number | FixedFloat): boolean {
        const otherVal = other instanceof FixedFloat ? other.get() : other;
        return this.value >= otherVal;
    }

    toHex(): string {
        if (this.bits === 32) {
            const view = new DataView(new ArrayBuffer(4));
            view.setFloat32(0, this.value);
            return view.getUint32(0).toString(16).toUpperCase().padStart(8, '0');
        } else {
            const view = new DataView(new ArrayBuffer(8));
            view.setFloat64(0, this.value);
            const high = view.getUint32(0).toString(16).toUpperCase().padStart(8, '0');
            const low = view.getUint32(4).toString(16).toUpperCase().padStart(8, '0');
            return high + low;
        }
    }

    toBin(): string {
        const hex = this.toHex();
        return hex.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    }

    getBits(): number { return this.bits; }
    getPrecision(): number {
        return this.bits === 32 ? 7 : 15;
    }

    valueOf(): number {
        return this.value;
    }

    toString(): string {
        return this.value.toString();
    }
}

export const typesFactory = {
    int8:    (v: number = 0) => new FixedInt(8, true, v),
    int16:   (v: number = 0) => new FixedInt(16, true, v),
    int32:   (v: number = 0) => new FixedInt(32, true, v),
    int64:   (v: number = 0) => new FixedInt(64, true, v),
    uint8:   (v: number = 0) => new FixedInt(8, false, v),
    uint16:  (v: number = 0) => new FixedInt(16, false, v),
    uint32:  (v: number = 0) => new FixedInt(32, false, v),
    uint64:  (v: number = 0) => new FixedInt(64, false, v),
    float32: (v: number = 0) => new FixedFloat(32, v),
    float64: (v: number = 0) => new FixedFloat(64, v),
};