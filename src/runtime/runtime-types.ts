// ─── types: машинные ячейки фиксированной ширины — модуль рантайма ─────────
// Вынесено из runtime.ts при декомпозиции 2026-08-29; содержимое — как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { runtimeInteger, stringArgument } from './runtime-shared';

// Тот же приём, что в ядре: в браузерном бандле Buffer приходит заглушкой.
const nodeBuffer: any = require('buffer').Buffer;

export type RuntimeTypesName = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'int64' | 'uint64' | 'float32' | 'float64';

interface RuntimeTypesSpec {
  readonly kind: 'integer' | 'float';
  readonly bits: number;
  readonly signed: boolean;
}

export const RUNTIME_TYPES: Record<RuntimeTypesName, RuntimeTypesSpec> = {
  int8: { kind: 'integer', bits: 8, signed: true },
  uint8: { kind: 'integer', bits: 8, signed: false },
  int16: { kind: 'integer', bits: 16, signed: true },
  uint16: { kind: 'integer', bits: 16, signed: false },
  int32: { kind: 'integer', bits: 32, signed: true },
  uint32: { kind: 'integer', bits: 32, signed: false },
  int64: { kind: 'integer', bits: 64, signed: true },
  uint64: { kind: 'integer', bits: 64, signed: false },
  float32: { kind: 'float', bits: 32, signed: true },
  float64: { kind: 'float', bits: 64, signed: true },
};

export function castTypesValue(value: unknown, typeName: string, file = 'types', line = 0): number | bigint {
  const name = normalizeRuntimeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];

  if (spec.kind === 'float') {
    // Большой int приходит как bigint — это тоже число ученика; отказ по
    // typeof говорил «must be a number, got '10000000000000000'» и сам себе
    // противоречил (находка методистов 2026-08-29). Значение за пределами
    // разрядности честно становится IEEE-бесконечностью — ячейки types живут
    // по машинным правилам (сдвиг битов легально даёт inf-паттерн, есть тест).
    if (typeof value !== 'number' && typeof value !== 'bigint') {
      throw new IdylliumRuntimeError(file, line, `types.${name} value must be a number, got '${String(value)}'`);
    }
    const number = Number(value);
    return name === 'float32' ? Math.fround(number) : number;
  }

  const integer = runtimeInteger(value, `types.${name} value`, file, line);
  if (spec.bits === 64) return wrapBigInteger(integer, spec);
  return wrapInteger(integer, spec);
}

export function typesToBin(value: unknown, typeName: string, file = 'types', line = 0): string {
  const name = normalizeRuntimeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  if (spec.kind === 'float') {
    return bytesToBinary(floatBytes(Number(castTypesValue(value, name, file, line)), name));
  }

  return integerToUnsigned(value, name, file, line).toString(2).padStart(spec.bits, '0');
}

export function typesToHex(value: unknown, typeName: string, file = 'types', line = 0): string {
  const name = normalizeRuntimeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  if (spec.kind === 'float') {
    return bytesToHex(floatBytes(Number(castTypesValue(value, name, file, line)), name));
  }

  return integerToUnsigned(value, name, file, line).toString(16).padStart(spec.bits / 4, '0').toUpperCase();
}

export function typesShift(
  value: unknown,
  typeName: string,
  bitCount: unknown,
  direction: 'left' | 'right',
  file: string,
  line: number,
): number | bigint {
  const name = normalizeRuntimeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  const method = `types.${name}.shift_${direction}()`;
  const requestedAmount = runtimeInteger(bitCount, `${method} bit count`, file, line);
  const effectiveDirection = requestedAmount < 0n
    ? direction === 'left' ? 'right' : 'left'
    : direction;
  const amount = requestedAmount < 0n ? -requestedAmount : requestedAmount;

  const source = typesToBin(value, name, file, line);
  let shifted: string;
  if (amount >= BigInt(spec.bits)) {
    shifted = '0'.repeat(spec.bits);
  } else {
    const count = Number(amount);
    shifted = effectiveDirection === 'left'
      ? source.slice(count) + '0'.repeat(count)
      : '0'.repeat(count) + source.slice(0, source.length - count);
  }

  if (spec.kind === 'float') return floatFromBytes(binaryToBytes(shifted), name);
  return castTypesValue(BigInt(`0b${shifted}`), name, file, line);
}

export function typesBitwise(
  value: unknown,
  typeName: string,
  mask: unknown,
  operator: 'and' | 'or' | 'xor' | 'not',
  file: string,
  line: number,
): number | bigint {
  const name = normalizeRuntimeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  const valueBits = BigInt(`0b${typesToBin(value, name, file, line)}`);
  const cellMask = (1n << BigInt(spec.bits)) - 1n;
  let resultBits: bigint;

  if (operator === 'not') {
    resultBits = (~valueBits) & cellMask;
  } else {
    const maskName = unsignedTypesName(spec.bits);
    const normalizedMask = BigInt(`0b${typesToBin(mask, maskName, file, line)}`);
    if (operator === 'and') resultBits = valueBits & normalizedMask;
    else if (operator === 'or') resultBits = valueBits | normalizedMask;
    else resultBits = valueBits ^ normalizedMask;
  }

  const result = resultBits.toString(2).padStart(spec.bits, '0');
  if (spec.kind === 'float') return floatFromBytes(binaryToBytes(result), name);
  return castTypesValue(resultBits, name, file, line);
}

function unsignedTypesName(bits: number): RuntimeTypesName {
  if (bits === 8) return 'uint8';
  if (bits === 16) return 'uint16';
  if (bits === 32) return 'uint32';
  return 'uint64';
}

export function typesFromBin(bits: unknown, typeName: unknown, file: string, line: number): number | bigint {
  const name = normalizeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  const normalized = normalizedBinary(bits, spec.bits, file, line);
  if (spec.kind === 'float') {
    return floatFromBytes(binaryToBytes(normalized), name);
  }
  return castTypesValue(BigInt(`0b${normalized}`), name, file, line);
}

export function typesFromHex(hex: unknown, typeName: unknown, file: string, line: number): number | bigint {
  const name = normalizeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  const normalized = normalizedHex(hex, spec.bits, file, line);
  if (spec.kind === 'float') {
    return floatFromBytes(hexToBytes(normalized), name);
  }
  return castTypesValue(BigInt(`0x${normalized}`), name, file, line);
}

export function normalizeTypesName(value: unknown, file: string, line: number): RuntimeTypesName {
  return normalizeRuntimeTypesName(stringArgument(value, 'types type name', file, line), file, line);
}

export function normalizeRuntimeTypesName(value: string, file: string, line: number): RuntimeTypesName {
  const name = value.trim().toLowerCase().replace(/^types\./u, '');
  if (Object.prototype.hasOwnProperty.call(RUNTIME_TYPES, name)) {
    return name as RuntimeTypesName;
  }
  throw new IdylliumRuntimeError(file, line, `unknown types numeric type '${value}'`);
}

export function wrapInteger(value: bigint, spec: RuntimeTypesSpec): number {
  const modulo = 1n << BigInt(spec.bits);
  let wrapped = ((value % modulo) + modulo) % modulo;
  const signBit = 1n << BigInt(spec.bits - 1);
  if (spec.signed && wrapped >= signBit) {
    wrapped -= modulo;
  }
  return Number(wrapped);
}

export function wrapBigInteger(value: bigint, spec: RuntimeTypesSpec): bigint {
  const modulo = 1n << BigInt(spec.bits);
  let wrapped = ((value % modulo) + modulo) % modulo;
  const signBit = 1n << BigInt(spec.bits - 1);
  if (spec.signed && wrapped >= signBit) wrapped -= modulo;
  return wrapped;
}

function integerToUnsigned(value: unknown, typeName: RuntimeTypesName, file = 'types', line = 0): number | bigint {
  const spec = RUNTIME_TYPES[typeName];
  const casted = castTypesValue(value, typeName, file, line);
  if (spec.kind !== 'integer') return casted;
  if (typeof casted === 'bigint') {
    return casted < 0n ? casted + (1n << BigInt(spec.bits)) : casted;
  }
  return casted < 0 ? casted + 2 ** spec.bits : casted;
}

function normalizedBinary(value: unknown, bits: number, file: string, line: number): string {
  const text = stringArgument(value, 'types.from_bin() bits', file, line).trim();
  if (!/^[01]+$/u.test(text)) {
    throw new IdylliumRuntimeError(file, line, `types.from_bin() expects binary digits, got ${JSON.stringify(text)}`);
  }
  if (text.length > bits) {
    throw new IdylliumRuntimeError(file, line, `types.from_bin() expects at most ${bits} bits, got ${text.length}`);
  }
  return text.padStart(bits, '0');
}

function normalizedHex(value: unknown, bits: number, file: string, line: number): string {
  const text = stringArgument(value, 'types.from_hex() hex', file, line).trim().replace(/^0x/iu, '');
  if (!/^[0-9a-fA-F]+$/u.test(text)) {
    throw new IdylliumRuntimeError(file, line, `types.from_hex() expects hexadecimal digits, got ${JSON.stringify(text)}`);
  }
  const digits = bits / 4;
  if (text.length > digits) {
    throw new IdylliumRuntimeError(file, line, `types.from_hex() expects at most ${digits} hex digits, got ${text.length}`);
  }
  return text.padStart(digits, '0').toUpperCase();
}

function binaryToBytes(bits: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return bytes;
}

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

export function bytesToBinary(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(2).padStart(8, '0')).join('');
}

export function bytesToHex(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function floatBytes(value: number, typeName: RuntimeTypesName): number[] {
  if (typeName === 'float32') {
    const buffer = nodeBuffer.alloc(4);
    buffer.writeFloatBE(Math.fround(value), 0);
    return [...buffer];
  }

  const buffer = nodeBuffer.alloc(8);
  buffer.writeDoubleBE(value, 0);
  return [...buffer];
}

export function floatFromBytes(bytes: readonly number[], typeName: RuntimeTypesName): number {
  const buffer = nodeBuffer.from(bytes);
  if (typeName === 'float32') return Math.fround(buffer.readFloatBE(0));
  return buffer.readDoubleBE(0);
}
