// Общий фундамент модулей рантайма: контекстные функции, проверки аргументов,
// свойства-геттеры. Вынесено из runtime.ts при декомпозиции 2026-08-29.
// Тот же приём, что в ядре: в браузерном бандле require('path') отдаёт заглушку.
const nodePath: any = require('path');

import { IdylliumRuntimeError } from './runtime-errors';

export type ContextualRuntimeFunction = ((...args: any[]) => unknown) & {
  __idylliumPassContext?: true;
};

export function contextFunction(fn: (...args: any[]) => unknown): ContextualRuntimeFunction {
  const callable = fn as ContextualRuntimeFunction;
  callable.__idylliumPassContext = true;
  return callable;
}


export function splitContextArgs(args: readonly unknown[]): { values: readonly unknown[]; file: string; line: number } {
  const file = args[args.length - 2];
  const line = args[args.length - 1];
  return {
    values: args.slice(0, -2),
    file: typeof file === 'string' ? file : 'runtime',
    line: typeof line === 'number' ? line : 0,
  };
}

export function expectOpen(isOpen: boolean, operationName: string, file: string, line: number): void {
  if (!isOpen) {
    throw new IdylliumRuntimeError(file, line, `${operationName} cannot be used after close()`);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function intArgument(value: unknown, argumentName: string, file: string, line: number): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be int`);
}

export function booleanArgument(value: unknown, argumentName: string, file: string, line: number): boolean {
  if (typeof value === 'boolean') return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be bool`);
}

export function stringArgument(value: unknown, argumentName: string, file: string, line: number): string {
  if (typeof value === 'string') return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be string`);
}

export function defineRuntimeGetter(obj: RuntimeObject, name: string, getter: () => unknown): void {
  Object.defineProperty(obj, name, {
    enumerable: true,
    configurable: true,
    get: getter,
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function finiteNumber(value: unknown, argumentName: string, file: string, line: number): number {
  if (typeof value === 'bigint') {
    const converted = Number(value);
    if (Number.isFinite(converted)) return converted;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be a finite number, got '${String(value)}'`);
}

export function runtimeInteger(value: unknown, argumentName: string, file: string, line: number): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be an integer, got '${String(value)}'`);
}

export function integerNumber(value: unknown, argumentName: string, file: string, line: number): number {
  if (typeof value === 'bigint') {
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (value >= min && value <= max) return Number(value);
    throw new IdylliumRuntimeError(file, line, `${argumentName} is outside the supported index range, got ${value}`);
  }
  const number = finiteNumber(value, argumentName, file, line);
  if (Number.isInteger(number)) return number;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be int, got ${number}`);
}

export function rangeNumber(value: unknown, argumentName: string, min: number, max: number, file: string, line: number): number {
  const number = finiteNumber(value, argumentName, file, line);
  if (number < min || number > max) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between ${min} and ${max}, got ${number}`);
  }
  return number;
}

export function precisionDigits(value: unknown, argumentName: string, file: string, line: number): number {
  const digits = integerNumber(value, argumentName, file, line);
  if (digits < 0 || digits > 25) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between 0 and 25, got ${digits}`);
  }
  return digits;
}

export function optionalNumberContext(
  valueOrFile: number | string,
  fileOrLine: string | number,
  maybeLine: number | undefined,
): { value: number | undefined; file: string; line: number } {
  if (maybeLine === undefined) {
    return {
      value: undefined,
      file: valueOrFile as string,
      line: fileOrLine as number,
    };
  }

  return {
    value: valueOrFile as number,
    file: fileOrLine as string,
    line: maybeLine,
  };
}

export type RuntimeObject = Record<string, unknown>;

export type RuntimePropertySetter = (value: unknown, file: string, line: number) => void;

export function byteRange(value: number, argumentName: string, min: number, max: number, file: string, line: number): number {
  if (value < min || value > max) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between ${min} and ${max}, got ${value}`);
  }
  return value;
}

export function exactIntegerResult(result: bigint): number | bigint {
  return result >= -9007199254740991n && result <= 9007199254740991n ? Number(result) : result;
}

export function validRange(length: number): string {
  if (length === 0) return 'none';
  return `0-${length - 1}`;
}

export function runtimeDirname(filePath: string): string {
  return filePath.includes('\\') ? memoryDirname(filePath) : nodePath.dirname(filePath);
}

export function memoryDirname(filePath: string): string {
  const normalized = normalizeMemoryPath(filePath);
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}

export function normalizeMemoryPath(value: string, base = '/workspace'): string {
  const raw = value.replace(/\\/gu, '/');
  const parts = (raw.startsWith('/') ? raw : `${base}/${raw}`).split('/');
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return `/${normalized.join('/')}`;
}

export function isRuntimeObject(value: unknown): value is RuntimeObject {
  return value !== null && typeof value === 'object';
}
