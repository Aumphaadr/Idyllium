const nodeFs: any = require('fs');
const nodePath: any = require('path');
const nodeBuffer: any = require('buffer').Buffer;

import {
  RuntimeAnimationFrame,
  RuntimeDecodedAnimation,
  RuntimeImageFormat,
  RuntimeImageService,
  RuntimeRasterImage,
  bytesToDataUri,
  cloneRaster,
  cropRaster,
  desaturateRaster,
  detectImageFormat,
  imageFormatFromPath,
  imageMimeType,
  opacityRaster,
  rasterHasAlpha,
  rotateRaster,
  scaleRaster,
  tintRaster,
} from './image-service';
import {
  RuntimeSqliteBindable,
  RuntimeSqliteDatabase,
  RuntimeSqliteExecution,
  RuntimeSqliteService,
  RuntimeSqliteTypedBinding,
  RuntimeSqliteValue,
} from './sqlite-service';
import {
  DrawableCollisionShape,
  DrawableTransform,
  capsuleCollisionShape,
  circleCollisionShape,
  collisionShapeContains,
  collisionShapesIntersect,
  rectangleCollisionShape,
} from './drawable-geometry';
import {
  RuntimeFontMetricsService,
  RuntimeTextMetrics,
  createRuntimeFontMetricsService,
} from './font-metrics-service';

export class IdylliumRuntimeError extends Error {
  constructor(
    readonly file: string,
    readonly line: number,
    message: string,
  ) {
    super(`${file}:${line}: runtime error: ${message}`);
    this.name = 'IdylliumRuntimeError';
  }
}

export class IdylliumColor {
  private constructor(
    readonly red: number,
    readonly green: number,
    readonly blue: number,
    readonly alpha: number,
  ) {}

  static RGB(red: number, green: number, blue: number, file = 'colors', line = 0): IdylliumColor {
    return new IdylliumColor(
      channel(red, 'colors.RGB() red', file, line),
      channel(green, 'colors.RGB() green', file, line),
      channel(blue, 'colors.RGB() blue', file, line),
      1,
    );
  }

  static RGBA(red: number, green: number, blue: number, alpha: number, file = 'colors', line = 0): IdylliumColor {
    return new IdylliumColor(
      channel(red, 'colors.RGBA() red', file, line),
      channel(green, 'colors.RGBA() green', file, line),
      channel(blue, 'colors.RGBA() blue', file, line),
      opacity(alpha, 'colors.RGBA() alpha', file, line),
    );
  }

  static HEX(value: string, file = 'colors', line = 0): IdylliumColor {
    if (typeof value !== 'string') {
      throw new IdylliumRuntimeError(file, line, `colors.HEX() expects string, got '${String(value)}'`);
    }
    const normalized = value.trim();
    const match = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u.exec(normalized);
    if (!match) {
      throw new IdylliumRuntimeError(file, line, `invalid HEX color '${value}'`);
    }

    const hex = match[1];
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return IdylliumColor.RGBA(red, green, blue, alpha, file, line);
  }

  static HSL(hue: number, saturation: number, lightness: number, file = 'colors', line = 0): IdylliumColor {
    const h = percentRange(hue, 'colors.HSL() hue', 0, 360, file, line);
    const s = percent(saturation, 'colors.HSL() saturation', file, line);
    const l = percent(lightness, 'colors.HSL() lightness', file, line);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let red = 0;
    let green = 0;
    let blue = 0;

    if (h < 60) {
      red = c;
      green = x;
    } else if (h < 120) {
      red = x;
      green = c;
    } else if (h < 180) {
      green = c;
      blue = x;
    } else if (h < 240) {
      green = x;
      blue = c;
    } else if (h < 300) {
      red = x;
      blue = c;
    } else {
      red = c;
      blue = x;
    }

    return IdylliumColor.RGB(
      Math.round((red + m) * 255),
      Math.round((green + m) * 255),
      Math.round((blue + m) * 255),
      file,
      line,
    );
  }

  toHex(): string {
    return `#${hex(this.red)}${hex(this.green)}${hex(this.blue)}`;
  }

  toCss(): string {
    if (this.alpha === 1) return this.toHex();
    return `rgba(${this.red}, ${this.green}, ${this.blue}, ${trimFloat(this.alpha)})`;
  }

  toString(): string {
    return this.toCss();
  }
}

export class IdylliumTimeStamp {
  constructor(private readonly unixSeconds: number) {}

  static now(): IdylliumTimeStamp {
    return new IdylliumTimeStamp(Math.floor(Date.now() / 1000));
  }

  static fromUnix(seconds: number, file: string, line: number): IdylliumTimeStamp {
    return new IdylliumTimeStamp(integerNumber(seconds, 'time.from_unix() seconds', file, line));
  }

  year(): number {
    return this.date().getUTCFullYear();
  }

  month(): number {
    return this.date().getUTCMonth() + 1;
  }

  day(): number {
    return this.date().getUTCDate();
  }

  hour(): number {
    return this.date().getUTCHours();
  }

  minute(): number {
    return this.date().getUTCMinutes();
  }

  second(): number {
    return this.date().getUTCSeconds();
  }

  week_day(): number {
    return this.date().getUTCDay();
  }

  unix(): number {
    return this.unixSeconds;
  }

  to_string(): string {
    return [
      this.year().toString().padStart(4, '0'),
      '-',
      this.month().toString().padStart(2, '0'),
      '-',
      this.day().toString().padStart(2, '0'),
      ' ',
      this.hour().toString().padStart(2, '0'),
      ':',
      this.minute().toString().padStart(2, '0'),
      ':',
      this.second().toString().padStart(2, '0'),
    ].join('');
  }

  toString(): string {
    return this.to_string();
  }

  private date(): Date {
    return new Date(this.unixSeconds * 1000);
  }
}

export class IdylliumArray {
  constructor(
    private readonly items: unknown[],
    private readonly dynamic: boolean,
    private readonly staticSize: number | null,
    private readonly defaultFactory: () => unknown,
  ) {
    if (!dynamic && staticSize !== null && items.length !== staticSize) {
      throw new IdylliumRuntimeError('array', 0, `array initializer has ${items.length} elements, but static array requires ${staticSize}`);
    }
  }

  static create(size: number, defaultFactory: () => unknown, dynamic: boolean): IdylliumArray {
    const normalizedSize = Math.max(0, Math.trunc(size));
    return new IdylliumArray(
      Array.from({ length: normalizedSize }, () => defaultFactory()),
      dynamic,
      dynamic ? null : normalizedSize,
      defaultFactory,
    );
  }

  static from(
    values: unknown[],
    dynamic: boolean,
    staticSize: number | null,
    defaultFactory: () => unknown,
  ): IdylliumArray {
    return new IdylliumArray([...values], dynamic, dynamic ? null : staticSize, defaultFactory);
  }

  static convert(
    value: unknown,
    dynamic: boolean,
    staticSize: number | null,
    defaultFactory: () => unknown,
    convertElement: (value: unknown) => unknown,
    targetType: string,
    file: string,
    line: number,
  ): IdylliumArray {
    if (!(value instanceof IdylliumArray)) {
      throw new IdylliumRuntimeError(file, line, `cannot convert '${runtimeTypeName(value)}' to '${targetType}'`);
    }

    const actualSize = value.items.length;
    if (!dynamic && staticSize !== null && actualSize !== staticSize) {
      const sourceType = value.dynamic ? 'dyn_array' : 'array';
      throw new IdylliumRuntimeError(
        file,
        line,
        `cannot convert ${sourceType} of size ${actualSize} to '${targetType}' (expected size ${staticSize})`,
      );
    }

    return new IdylliumArray(
      value.items.map(convertElement),
      dynamic,
      dynamic ? null : staticSize,
      defaultFactory,
    );
  }

  get(index: unknown, file: string, line: number): unknown {
    return this.items[this.validIndex(index, file, line)];
  }

  set(index: unknown, value: unknown, file: string, line: number): void {
    this.items[this.validIndex(index, file, line)] = value;
  }

  length(): number {
    return this.items.length;
  }

  contains(value: unknown): boolean {
    return this.items.some((item) => runtimeEquals(item, value));
  }

  find(value: unknown): number {
    return this.items.findIndex((item) => runtimeEquals(item, value));
  }

  count(value: unknown): number {
    return this.items.filter((item) => runtimeEquals(item, value)).length;
  }

  reverse(): void {
    this.items.reverse();
  }

  sort(): void {
    if (this.items.every((item) => typeof item === 'number' || typeof item === 'bigint')) {
      this.items.sort((left, right) => runtimeCompare(left as number | bigint, right as number | bigint));
      return;
    }
    this.items.sort((left, right) => formatForInspect(left).localeCompare(formatForInspect(right)));
  }

  add(value: unknown, file: string, line: number): void {
    this.expectDynamic('add', file, line);
    this.items.push(value);
  }

  remove_at(index: unknown, file: string, line: number): void {
    this.expectDynamic('remove_at', file, line);
    this.items.splice(this.validIndex(index, file, line), 1);
  }

  resize(size: unknown, file: string, line: number): void {
    this.expectDynamic('resize', file, line);
    const normalizedSize = this.validSize(size, file, line);
    while (this.items.length < normalizedSize) {
      this.items.push(this.defaultFactory());
    }
    this.items.length = normalizedSize;
  }

  insert(index: unknown, value: unknown, file: string, line: number): void {
    this.expectDynamic('insert', file, line);
    const normalizedIndex = this.validInsertIndex(index, file, line);
    this.items.splice(normalizedIndex, 0, value);
  }

  join(other: unknown, file: string, line: number): void {
    this.expectDynamic('join', file, line);
    if (!(other instanceof IdylliumArray)) {
      throw new IdylliumRuntimeError(file, line, `join() expects an array, got '${String(other)}'`);
    }
    this.items.push(...other.items);
  }

  clear(file: string, line: number): void {
    this.expectDynamic('clear', file, line);
    this.items.length = 0;
  }

  pop(file: string, line: number): unknown {
    this.expectDynamic('pop', file, line);
    if (this.items.length === 0) {
      throw new IdylliumRuntimeError(file, line, 'cannot pop from empty array');
    }
    return this.items.pop();
  }

  callMethod(name: string, args: readonly unknown[], file: string, line: number): unknown {
    switch (name) {
      case 'length':
        return this.length();
      case 'contains':
        return this.contains(args[0]);
      case 'find':
        return this.find(args[0]);
      case 'count':
        return this.count(args[0]);
      case 'reverse':
        return this.reverse();
      case 'sort':
        return this.sort();
      case 'add':
        return this.add(args[0], file, line);
      case 'remove_at':
        return this.remove_at(args[0], file, line);
      case 'resize':
        return this.resize(args[0], file, line);
      case 'insert':
        return this.insert(args[0], args[1], file, line);
      case 'join':
        return this.join(args[0], file, line);
      case 'clear':
        return this.clear(file, line);
      case 'pop':
        return this.pop(file, line);
      default:
        throw new IdylliumRuntimeError(file, line, `array has no method '${name}'`);
    }
  }

  values(): readonly unknown[] {
    return this.items;
  }

  toString(): string {
    return formatForInspect(this);
  }

  toInspectString(): string {
    return `[${this.items.map(formatForInspect).join(', ')}]`;
  }

  private validIndex(value: unknown, file: string, line: number): number {
    const index = integerNumber(value, 'array index', file, line);
    if (index < 0 || index >= this.items.length) {
      throw new IdylliumRuntimeError(file, line, `array index ${index} out of bounds (size ${this.items.length}, valid indices ${this.validIndexRange()})`);
    }
    return index;
  }

  private validInsertIndex(value: unknown, file: string, line: number): number {
    const index = integerNumber(value, 'array insert index', file, line);
    if (index < 0 || index > this.items.length) {
      throw new IdylliumRuntimeError(file, line, `array insert index ${index} out of bounds (size ${this.items.length}, valid indices 0-${this.items.length})`);
    }
    return index;
  }

  private validSize(value: unknown, file: string, line: number): number {
    const size = integerNumber(value, 'array size', file, line);
    if (size < 0) {
      throw new IdylliumRuntimeError(file, line, `array size must be non-negative, got ${size}`);
    }
    return size;
  }

  private validIndexRange(): string {
    if (this.items.length === 0) return 'none';
    return `0-${this.items.length - 1}`;
  }

  private expectDynamic(methodName: string, file: string, line: number): void {
    if (!this.dynamic) {
      throw new IdylliumRuntimeError(file, line, `array method '${methodName}' is only available on dyn_array`);
    }
  }
}

type JsonRuntimeKind = 'null' | 'string' | 'int' | 'float' | 'bool' | 'object' | 'array';

type JsonRuntimeValue = Record<string, unknown> & {
  __idylliumType: 'json.Value' | 'json.Object' | 'json.Array';
  __jsonKind: JsonRuntimeKind;
  __jsonValue?: unknown;
  __jsonEntries?: Map<string, JsonRuntimeValue>;
  __jsonItems?: JsonRuntimeValue[];
};

function createJsonValue(value?: unknown, file = 'json', line = 0): JsonRuntimeValue {
  if (value === undefined || value === null) return createJsonPrimitive('null', null);
  if (isJsonRuntimeValue(value)) return value;
  if (typeof value === 'string') return createJsonPrimitive('string', value);
  if (typeof value === 'boolean') return createJsonPrimitive('bool', value);
  if (typeof value === 'number') {
    const number = finiteNumber(value, 'json.Value() value', file, line);
    return createJsonPrimitive(Number.isInteger(number) ? 'int' : 'float', number);
  }
  throw new IdylliumRuntimeError(file, line, `json.Value() cannot convert '${runtimeTypeName(value)}' to json.Value`);
}

function createJsonObject(entries: Map<string, JsonRuntimeValue> = new Map()): JsonRuntimeValue {
  const obj = createJsonBase('json.Object', 'object');
  Object.defineProperty(obj, '__jsonEntries', {
    value: entries,
    enumerable: false,
    configurable: true,
  });
  obj.length = () => entries.size;
  obj.has = contextFunction((key: unknown, file: string, line: number) => entries.has(stringArgument(key, 'json.Object.has() key', file, line)));
  obj.get = contextFunction((key: unknown, file: string, line: number) => {
    const name = stringArgument(key, 'json.Object.get() key', file, line);
    if (!entries.has(name)) {
      throw new IdylliumRuntimeError(file, line, `json object has no key '${name}'`);
    }
    return entries.get(name);
  });
  obj.add = contextFunction((key: unknown, value: unknown, file: string, line: number) => {
    const name = stringArgument(key, 'json.Object.add() key', file, line);
    if (entries.has(name)) {
      throw new IdylliumRuntimeError(file, line, `json object already has key '${name}'`);
    }
    entries.set(name, expectJsonValue(value, 'json.Object.add() value', file, line));
  });
  obj.set = contextFunction((key: unknown, value: unknown, file: string, line: number) => {
    const name = stringArgument(key, 'json.Object.set() key', file, line);
    if (!entries.has(name)) {
      throw new IdylliumRuntimeError(file, line, `json object has no key '${name}'`);
    }
    entries.set(name, expectJsonValue(value, 'json.Object.set() value', file, line));
  });
  obj.remove = contextFunction((key: unknown, file: string, line: number) => {
    const name = stringArgument(key, 'json.Object.remove() key', file, line);
    if (!entries.delete(name)) {
      throw new IdylliumRuntimeError(file, line, `json object has no key '${name}'`);
    }
  });
  obj.keys = () => IdylliumArray.from([...entries.keys()], true, null, () => '');
  return obj;
}

function createJsonArray(items: JsonRuntimeValue[] = []): JsonRuntimeValue {
  const obj = createJsonBase('json.Array', 'array');
  Object.defineProperty(obj, '__jsonItems', {
    value: items,
    enumerable: false,
    configurable: true,
  });
  obj.length = () => items.length;
  obj.at = contextFunction((index: unknown, file: string, line: number) => items[jsonArrayIndex(items, index, 'json.Array.at()', file, line)]);
  obj.set = contextFunction((index: unknown, value: unknown, file: string, line: number) => {
    items[jsonArrayIndex(items, index, 'json.Array.set()', file, line)] = expectJsonValue(value, 'json.Array.set() value', file, line);
  });
  obj.add = contextFunction((value: unknown, file: string, line: number) => {
    items.push(expectJsonValue(value, 'json.Array.add() value', file, line));
  });
  obj.insert = contextFunction((index: unknown, value: unknown, file: string, line: number) => {
    items.splice(jsonArrayInsertIndex(items, index, file, line), 0, expectJsonValue(value, 'json.Array.insert() value', file, line));
  });
  obj.pop = contextFunction((file: string, line: number) => {
    if (items.length === 0) throw new IdylliumRuntimeError(file, line, 'json.Array.pop() cannot pop from empty array');
    return items.pop();
  });
  obj.remove = contextFunction((index: unknown, file: string, line: number) => {
    items.splice(jsonArrayIndex(items, index, 'json.Array.remove()', file, line), 1);
  });
  obj.clear = () => {
    items.length = 0;
  };
  return obj;
}

function createJsonPrimitive(kind: Exclude<JsonRuntimeKind, 'object' | 'array'>, value: unknown): JsonRuntimeValue {
  const obj = createJsonBase('json.Value', kind);
  obj.__jsonValue = value;
  return obj;
}

function createJsonBase(typeName: JsonRuntimeValue['__idylliumType'], kind: JsonRuntimeKind): JsonRuntimeValue {
  const obj: JsonRuntimeValue = {
    __idylliumType: typeName,
    __jsonKind: kind,
  };
  obj.is_null = () => obj.__jsonKind === 'null';
  obj.is_string = () => obj.__jsonKind === 'string';
  obj.is_int = () => obj.__jsonKind === 'int';
  obj.is_float = () => obj.__jsonKind === 'int' || obj.__jsonKind === 'float';
  obj.is_bool = () => obj.__jsonKind === 'bool';
  obj.is_object = () => obj.__jsonKind === 'object';
  obj.is_array = () => obj.__jsonKind === 'array';
  obj.to_string = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'string') return obj.__jsonValue as string;
    throwJsonExpected(obj, 'string', file, line);
  });
  obj.to_int = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'int') return obj.__jsonValue as number;
    throwJsonExpected(obj, 'int', file, line);
  });
  obj.to_float = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'int' || obj.__jsonKind === 'float') return obj.__jsonValue as number;
    throwJsonExpected(obj, 'number', file, line);
  });
  obj.to_bool = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'bool') return obj.__jsonValue as boolean;
    throwJsonExpected(obj, 'bool', file, line);
  });
  obj.to_object = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'object') return jsonObjectValue(obj);
    throwJsonExpected(obj, 'object', file, line);
  });
  obj.to_array = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'array') return jsonArrayValue(obj);
    throwJsonExpected(obj, 'array', file, line);
  });
  obj.set_null = () => setJsonPrimitiveValue(obj, 'null', null);
  obj.set_string = contextFunction((value: unknown, file: string, line: number) => {
    setJsonPrimitiveValue(obj, 'string', stringArgument(value, 'json.Value.set_string() value', file, line));
  });
  obj.set_int = contextFunction((value: unknown, file: string, line: number) => {
    setJsonPrimitiveValue(obj, 'int', integerNumber(value, 'json.Value.set_int() value', file, line));
  });
  obj.set_float = contextFunction((value: unknown, file: string, line: number) => {
    setJsonPrimitiveValue(obj, 'float', finiteNumber(value, 'json.Value.set_float() value', file, line));
  });
  obj.set_bool = contextFunction((value: unknown, file: string, line: number) => {
    if (typeof value !== 'boolean') {
      throw new IdylliumRuntimeError(file, line, `json.Value.set_bool() value must be bool, got '${runtimeTypeName(value)}'`);
    }
    setJsonPrimitiveValue(obj, 'bool', value);
  });
  obj.set_object = contextFunction((value: unknown, file: string, line: number) => {
    setJsonNestedValue(obj, 'object', expectJsonKind(value, 'object', 'json.Value.set_object() value', file, line));
  });
  obj.set_array = contextFunction((value: unknown, file: string, line: number) => {
    setJsonNestedValue(obj, 'array', expectJsonKind(value, 'array', 'json.Value.set_array() value', file, line));
  });
  obj.to_json = () => jsonSerialize(obj, 0);
  obj.to_pretty_json = contextFunction((indentOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
    const context = optionalNumberContext(indentOrFile, fileOrLine, maybeLine);
    const indent = context.value === undefined ? 2 : jsonIndent(context.value, context.file, context.line);
    return jsonSerialize(obj, indent);
  });
  obj.toString = () => jsonSerialize(obj, 0);
  return obj;
}

function parseJsonValue(text: string, file: string, line: number): JsonRuntimeValue {
  try {
    return nativeToJsonRuntime(JSON.parse(text));
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `json.parse() invalid JSON: ${errorMessage(error)}`);
  }
}

function nativeToJsonRuntime(value: unknown): JsonRuntimeValue {
  if (value === null) return createJsonValue();
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return createJsonValue(value);
  if (Array.isArray(value)) return createJsonArray(value.map(nativeToJsonRuntime));
  if (isPlainObject(value)) {
    const entries = new Map<string, JsonRuntimeValue>();
    for (const [key, item] of Object.entries(value)) {
      entries.set(key, nativeToJsonRuntime(item));
    }
    return createJsonObject(entries);
  }
  return createJsonValue();
}

function jsonRuntimeToNative(value: JsonRuntimeValue): unknown {
  switch (value.__jsonKind) {
    case 'object': {
      if (isJsonRuntimeValue(value.__jsonValue)) return jsonRuntimeToNative(value.__jsonValue);
      const result: Record<string, unknown> = {};
      for (const [key, item] of jsonEntries(value)) {
        result[key] = jsonRuntimeToNative(item);
      }
      return result;
    }
    case 'array':
      if (isJsonRuntimeValue(value.__jsonValue)) return jsonRuntimeToNative(value.__jsonValue);
      return jsonItems(value).map(jsonRuntimeToNative);
    case 'null':
      return null;
    default:
      return value.__jsonValue;
  }
}

function jsonSerialize(value: JsonRuntimeValue, indent: number): string {
  return JSON.stringify(jsonRuntimeToNative(value), null, indent);
}

function isJsonRuntimeValue(value: unknown): value is JsonRuntimeValue {
  return isPlainObject(value)
    && typeof value.__idylliumType === 'string'
    && ['json.Value', 'json.Object', 'json.Array'].includes(value.__idylliumType)
    && typeof value.__jsonKind === 'string';
}

function expectJsonValue(value: unknown, argumentName: string, file: string, line: number): JsonRuntimeValue {
  if (isJsonRuntimeValue(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} expects json.Value, got '${runtimeTypeName(value)}'`);
}

function expectJsonKind(value: unknown, kind: 'object' | 'array', argumentName: string, file: string, line: number): JsonRuntimeValue {
  const jsonValue = expectJsonValue(value, argumentName, file, line);
  if (jsonValue.__jsonKind === kind) return jsonValue;
  throw new IdylliumRuntimeError(file, line, `${argumentName} expects json.${kind === 'object' ? 'Object' : 'Array'}, got json.${jsonKindText(jsonValue)}`);
}

function jsonObjectValue(value: JsonRuntimeValue): JsonRuntimeValue {
  return isJsonRuntimeValue(value.__jsonValue) ? value.__jsonValue : value;
}

function jsonArrayValue(value: JsonRuntimeValue): JsonRuntimeValue {
  return isJsonRuntimeValue(value.__jsonValue) ? value.__jsonValue : value;
}

function setJsonPrimitiveValue(target: JsonRuntimeValue, kind: Exclude<JsonRuntimeKind, 'object' | 'array'>, value: unknown): void {
  target.__jsonKind = kind;
  target.__jsonValue = value;
}

function setJsonNestedValue(target: JsonRuntimeValue, kind: 'object' | 'array', value: JsonRuntimeValue): void {
  target.__jsonKind = kind;
  target.__jsonValue = value;
}

function jsonEntries(value: JsonRuntimeValue): Map<string, JsonRuntimeValue> {
  return value.__jsonEntries instanceof Map ? value.__jsonEntries : new Map();
}

function jsonItems(value: JsonRuntimeValue): JsonRuntimeValue[] {
  return Array.isArray(value.__jsonItems) ? value.__jsonItems : [];
}

function jsonArrayIndex(items: readonly JsonRuntimeValue[], value: unknown, operationName: string, file: string, line: number): number {
  const index = integerNumber(value, `${operationName} index`, file, line);
  if (index < 0 || index >= items.length) {
    throw new IdylliumRuntimeError(file, line, `json array index ${index} out of bounds (size ${items.length}, valid indices ${validRange(items.length)})`);
  }
  return index;
}

function jsonArrayInsertIndex(items: readonly JsonRuntimeValue[], value: unknown, file: string, line: number): number {
  const index = integerNumber(value, 'json.Array.insert() index', file, line);
  if (index < 0 || index > items.length) {
    throw new IdylliumRuntimeError(file, line, `json array insert index ${index} out of bounds (size ${items.length}, valid indices 0-${items.length})`);
  }
  return index;
}

function jsonIndent(value: unknown, file: string, line: number): number {
  const indent = integerNumber(value, 'json.to_pretty_json() indent', file, line);
  if (indent < 0 || indent > 16) {
    throw new IdylliumRuntimeError(file, line, `json.to_pretty_json() indent must be between 0 and 16, got ${indent}`);
  }
  return indent;
}

function throwJsonExpected(value: JsonRuntimeValue, expected: string, file: string, line: number): never {
  throw new IdylliumRuntimeError(file, line, `json value is ${jsonKindText(value)}, expected ${expected}`);
}

function jsonKindText(value: JsonRuntimeValue): string {
  if (value.__jsonKind === 'int' || value.__jsonKind === 'float') return 'number';
  return value.__jsonKind;
}

type SqliteRuntimeKind = 'null' | 'integer' | 'real' | 'text' | 'blob';

type SqliteRuntimeValueObject = Record<string, unknown> & {
  __idylliumType: 'sqlite.Value';
  __sqliteKind: SqliteRuntimeKind;
  __sqliteValue: RuntimeSqliteValue;
};

interface SqliteRuntimeDatabaseState {
  engine: RuntimeSqliteDatabase | null;
  path: string;
  resolvedPath: string;
  isOpen: boolean;
  inTransaction: boolean;
  readonly runtime: RuntimeObjectState;
  readonly statements: Set<SqliteRuntimeStatementState>;
}

interface SqliteRuntimeStatementState {
  readonly database: SqliteRuntimeDatabaseState | null;
  readonly sql: string;
  readonly parameterNames: ReadonlySet<string>;
  readonly bindings: Map<string, RuntimeSqliteBindable>;
  isOpen: boolean;
}

interface SqliteRuntimeResultState {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly RuntimeSqliteValue[])[];
  isOpen: boolean;
  cursor: number;
}

function createSqliteValue(value: unknown = null, file = 'sqlite', line = 0): SqliteRuntimeValueObject {
  if (isSqliteRuntimeValue(value)) return value;

  let kind: SqliteRuntimeKind;
  let stored: RuntimeSqliteValue;
  if (value === null || isRuntimeNullValue(value)) {
    kind = 'null';
    stored = null;
  } else if (typeof value === 'bigint') {
    kind = 'integer';
    stored = value;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    kind = Number.isInteger(value) ? 'integer' : 'real';
    stored = value;
  } else if (typeof value === 'string') {
    kind = 'text';
    stored = value;
  } else if (typeof value === 'boolean') {
    kind = 'integer';
    stored = value ? 1n : 0n;
  } else if (value instanceof Uint8Array) {
    kind = 'blob';
    stored = new Uint8Array(value);
  } else {
    throw new IdylliumRuntimeError(file, line, `cannot convert '${runtimeTypeName(value)}' to sqlite.Value`);
  }

  const obj: SqliteRuntimeValueObject = {
    __idylliumType: 'sqlite.Value',
    __sqliteKind: kind,
    __sqliteValue: stored,
  };
  obj.is_null = () => obj.__sqliteKind === 'null';
  obj.is_int = () => obj.__sqliteKind === 'integer';
  obj.is_float = () => obj.__sqliteKind === 'real';
  obj.is_string = () => obj.__sqliteKind === 'text';
  obj.to_int = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToInt(obj, callFile, callLine));
  obj.to_int64 = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToInt64(obj, callFile, callLine));
  obj.to_float = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToFloat(obj, callFile, callLine));
  obj.to_string = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToString(obj, callFile, callLine));
  obj.to_bool = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToBool(obj, callFile, callLine));
  return obj;
}

function isSqliteRuntimeValue(value: unknown): value is SqliteRuntimeValueObject {
  return isPlainObject(value)
    && value.__idylliumType === 'sqlite.Value'
    && typeof value.__sqliteKind === 'string';
}

function sqliteValueToInt(value: SqliteRuntimeValueObject, file: string, line: number): number {
  expectSqliteValueKind(value, 'integer', 'int', file, line);
  const integer = value.__sqliteValue;
  if (typeof integer === 'number') {
    if (Number.isSafeInteger(integer)) return integer;
  } else if (typeof integer === 'bigint') {
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (integer >= min && integer <= max) return Number(integer);
  }
  throw new IdylliumRuntimeError(file, line, 'sqlite integer is outside the int range; use to_int64()');
}

function sqliteValueToInt64(value: SqliteRuntimeValueObject, file: string, line: number): bigint {
  expectSqliteValueKind(value, 'integer', 'int64', file, line);
  return typeof value.__sqliteValue === 'bigint'
    ? value.__sqliteValue
    : BigInt(value.__sqliteValue as number);
}

function sqliteValueToFloat(value: SqliteRuntimeValueObject, file: string, line: number): number {
  if (value.__sqliteKind !== 'integer' && value.__sqliteKind !== 'real') {
    throwSqliteValueExpected(value, 'float', file, line);
  }
  return Number(value.__sqliteValue);
}

function sqliteValueToString(value: SqliteRuntimeValueObject, file: string, line: number): string {
  expectSqliteValueKind(value, 'text', 'string', file, line);
  return value.__sqliteValue as string;
}

function sqliteValueToBool(value: SqliteRuntimeValueObject, file: string, line: number): boolean {
  expectSqliteValueKind(value, 'integer', 'bool (integer 0 or 1)', file, line);
  if (value.__sqliteValue === 0 || value.__sqliteValue === 0n) return false;
  if (value.__sqliteValue === 1 || value.__sqliteValue === 1n) return true;
  throw new IdylliumRuntimeError(
    file,
    line,
    `sqlite value is integer ${String(value.__sqliteValue)}, expected bool (integer 0 or 1)`,
  );
}

function expectSqliteValueKind(
  value: SqliteRuntimeValueObject,
  kind: SqliteRuntimeKind,
  expected: string,
  file: string,
  line: number,
): void {
  if (value.__sqliteKind === kind) return;
  throwSqliteValueExpected(value, expected, file, line);
}

function throwSqliteValueExpected(
  value: SqliteRuntimeValueObject,
  expected: string,
  file: string,
  line: number,
): never {
  throw new IdylliumRuntimeError(file, line, `sqlite value is ${value.__sqliteKind}, expected ${expected}`);
}

async function openSqliteDatabase(
  pathValue: unknown,
  file: string,
  line: number,
  runtime: RuntimeObjectState,
): Promise<RuntimeObject> {
  const requestedPath = stringArgument(pathValue, 'sqlite.open() path', file, line);
  if (requestedPath.trim() === '') {
    throw new IdylliumRuntimeError(file, line, 'sqlite.open() path must not be empty');
  }
  if (!runtime.sqliteService) {
    throw new IdylliumRuntimeError(file, line, 'sqlite runtime is unavailable');
  }

  const resolvedPath = runtime.fileSystem.resolvePath(requestedPath, file);
  const parentPath = runtimeDirname(resolvedPath);
  try {
    if (runtime.fileSystem.exists(resolvedPath) && !runtime.fileSystem.isFile(resolvedPath)) {
      throw new Error('path is not a file');
    }
    if (!runtime.fileSystem.exists(parentPath) || !runtime.fileSystem.isDirectory(parentPath)) {
      throw new Error(`parent directory does not exist: ${parentPath}`);
    }
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite.open() cannot open '${requestedPath}': ${errorMessage(error)}`);
  }

  const existed = runtime.fileSystem.exists(resolvedPath);
  let bytes: Uint8Array | undefined;
  if (existed) {
    try {
      bytes = runtime.fileSystem.readBytes
        ? runtime.fileSystem.readBytes(resolvedPath)
        : new TextEncoder().encode(runtime.fileSystem.readText(resolvedPath));
    } catch (error) {
      throw new IdylliumRuntimeError(file, line, `sqlite.open() cannot read '${requestedPath}': ${errorMessage(error)}`);
    }
  }

  let engine: RuntimeSqliteDatabase;
  try {
    engine = await runtime.sqliteService.open(bytes);
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite.open() cannot open '${requestedPath}': ${errorMessage(error)}`);
  }

  const obj = createClosedSqliteDatabase(runtime);
  const state = sqliteDatabaseState(obj);
  state.engine = engine;
  state.path = requestedPath;
  state.resolvedPath = resolvedPath;
  state.isOpen = true;

  if (!existed) persistSqliteDatabase(state, file, line);
  return obj;
}

function createClosedSqliteDatabase(runtime: RuntimeObjectState): RuntimeObject {
  const state: SqliteRuntimeDatabaseState = {
    engine: null,
    path: '',
    resolvedPath: '',
    isOpen: false,
    inTransaction: false,
    runtime,
    statements: new Set(),
  };
  const obj: RuntimeObject = { __idylliumType: 'sqlite.Database' };
  Object.defineProperty(obj, '__sqliteDatabaseState', { value: state });
  defineRuntimeGetter(obj, 'path', () => state.path);
  defineRuntimeGetter(obj, 'is_open', () => state.isOpen);
  defineRuntimeGetter(obj, 'in_transaction', () => state.inTransaction);

  obj.execute = contextFunction((sql: unknown, file: string, line: number) => (
    executeSqliteDatabase(state, sql, new Map(), file, line)
  ));
  obj.prepare = contextFunction((sql: unknown, file: string, line: number) => (
    createSqliteStatement(state, sql, file, line)
  ));
  obj.exec_script = contextFunction((sql: unknown, file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    const source = stringArgument(sql, 'sqlite.Database.exec_script() sql', file, line);
    try {
      engine.executeScript(source);
      if (!state.inTransaction) persistSqliteDatabase(state, file, line);
    } catch (error) {
      if (error instanceof IdylliumRuntimeError) throw error;
      throw new IdylliumRuntimeError(file, line, `sqlite script execution failed: ${errorMessage(error)}`);
    }
  });
  obj.begin_transaction = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (state.inTransaction) {
      throw new IdylliumRuntimeError(file, line, 'sqlite database already has an active transaction');
    }
    executeSqliteTransaction(engine, 'BEGIN TRANSACTION', 'begin', file, line);
    state.inTransaction = true;
  });
  obj.commit = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (!state.inTransaction) {
      throw new IdylliumRuntimeError(file, line, 'sqlite database has no active transaction to commit');
    }
    executeSqliteTransaction(engine, 'COMMIT', 'commit', file, line);
    state.inTransaction = false;
    persistSqliteDatabase(state, file, line);
  });
  obj.rollback = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (!state.inTransaction) {
      throw new IdylliumRuntimeError(file, line, 'sqlite database has no active transaction to roll back');
    }
    executeSqliteTransaction(engine, 'ROLLBACK', 'rollback', file, line);
    state.inTransaction = false;
  });
  obj.close = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (state.inTransaction) {
      executeSqliteTransaction(engine, 'ROLLBACK', 'rollback while closing', file, line);
      state.inTransaction = false;
    }
    for (const statement of state.statements) statement.isOpen = false;
    state.statements.clear();
    engine.close();
    state.engine = null;
    state.isOpen = false;
  });
  return obj;
}

function sqliteDatabaseState(obj: RuntimeObject): SqliteRuntimeDatabaseState {
  return obj.__sqliteDatabaseState as SqliteRuntimeDatabaseState;
}

function assertSqliteDatabaseOpen(
  state: SqliteRuntimeDatabaseState,
  file: string,
  line: number,
): RuntimeSqliteDatabase {
  if (!state.isOpen || !state.engine) {
    throw new IdylliumRuntimeError(file, line, 'sqlite database is already closed');
  }
  return state.engine;
}

function persistSqliteDatabase(state: SqliteRuntimeDatabaseState, file: string, line: number): void {
  const engine = assertSqliteDatabaseOpen(state, file, line);
  if (!state.runtime.fileSystem.writeBytes) {
    throw new IdylliumRuntimeError(file, line, 'sqlite cannot save a database: binary file writing is unavailable');
  }
  try {
    state.runtime.fileSystem.writeBytes(state.resolvedPath, engine.export());
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite cannot save '${state.path}': ${errorMessage(error)}`);
  }
}

function executeSqliteTransaction(
  engine: RuntimeSqliteDatabase,
  sql: string,
  operation: string,
  file: string,
  line: number,
): void {
  try {
    engine.execute(sql);
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite ${operation} failed: ${errorMessage(error)}`);
  }
}

function createSqliteStatement(
  database: SqliteRuntimeDatabaseState,
  sqlValue: unknown,
  file: string,
  line: number,
): RuntimeObject {
  assertSqliteDatabaseOpen(database, file, line);
  const sql = stringArgument(sqlValue, 'sqlite.Database.prepare() sql', file, line);
  const parameterNames = scanSqliteParameters(sql, file, line);
  const state: SqliteRuntimeStatementState = {
    database,
    sql,
    parameterNames,
    bindings: new Map(),
    isOpen: true,
  };
  database.statements.add(state);
  return createSqliteStatementObject(state);
}

function createClosedSqliteStatement(): RuntimeObject {
  return createSqliteStatementObject({
    database: null,
    sql: '',
    parameterNames: new Set(),
    bindings: new Map(),
    isOpen: false,
  });
}

function createSqliteStatementObject(state: SqliteRuntimeStatementState): RuntimeObject {
  const obj: RuntimeObject = { __idylliumType: 'sqlite.Statement' };
  defineRuntimeGetter(obj, 'sql', () => state.sql);
  defineRuntimeGetter(obj, 'is_open', () => state.isOpen);

  obj.bind = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(state, name, sqliteBindingFromValue(value, file, line), file, line);
  });
  obj.bind_int = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(
      state,
      name,
      sqliteTypedBinding('integer', runtimeInteger(value, 'sqlite.Statement.bind_int() value', file, line)),
      file,
      line,
    );
  });
  obj.bind_int64 = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(
      state,
      name,
      sqliteTypedBinding('integer', runtimeInteger(value, 'sqlite.Statement.bind_int64() value', file, line)),
      file,
      line,
    );
  });
  obj.bind_float = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(
      state,
      name,
      sqliteTypedBinding('real', finiteNumber(value, 'sqlite.Statement.bind_float() value', file, line)),
      file,
      line,
    );
  });
  obj.bind_string = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(state, name, stringArgument(value, 'sqlite.Statement.bind_string() value', file, line), file, line);
  });
  obj.bind_bool = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    if (typeof value !== 'boolean') {
      throw new IdylliumRuntimeError(file, line, 'sqlite.Statement.bind_bool() value must be bool');
    }
    bindSqliteStatement(state, name, sqliteTypedBinding('integer', value ? 1 : 0), file, line);
  });
  obj.bind_null = contextFunction((name: unknown, file: string, line: number) => {
    bindSqliteStatement(state, name, null, file, line);
  });
  obj.execute = contextFunction((file: string, line: number) => {
    const database = assertSqliteStatementOpen(state, file, line);
    return executeSqliteDatabase(database, state.sql, state.bindings, file, line);
  });
  obj.clear_bindings = contextFunction((file: string, line: number) => {
    assertSqliteStatementOpen(state, file, line);
    state.bindings.clear();
  });
  obj.close = contextFunction((file: string, line: number) => {
    const database = assertSqliteStatementOpen(state, file, line);
    state.isOpen = false;
    database.statements.delete(state);
    state.bindings.clear();
  });
  return obj;
}

function sqliteBindingFromValue(value: unknown, file: string, line: number): RuntimeSqliteBindable {
  if (value === null || isRuntimeNullValue(value)) return null;

  if (isSqliteRuntimeValue(value)) {
    if (value.__sqliteKind === 'null') return null;
    if (value.__sqliteKind === 'integer') {
      return sqliteTypedBinding('integer', value.__sqliteValue as number | bigint);
    }
    if (value.__sqliteKind === 'real') {
      return sqliteTypedBinding('real', value.__sqliteValue as number);
    }
    if (value.__sqliteKind === 'text') return value.__sqliteValue as string;
    if (value.__sqliteValue instanceof Uint8Array) return new Uint8Array(value.__sqliteValue);
  }

  if (typeof value === 'bigint') return sqliteTypedBinding('integer', value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return sqliteTypedBinding(Number.isInteger(value) ? 'integer' : 'real', value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return sqliteTypedBinding('integer', value ? 1 : 0);
  if (value instanceof Uint8Array) return new Uint8Array(value);

  throw new IdylliumRuntimeError(
    file,
    line,
    `sqlite.Statement.bind() cannot bind '${runtimeTypeName(value)}'; expected int, float, string, bool, null, or sqlite.Value`,
  );
}

function sqliteTypedBinding(
  storageClass: RuntimeSqliteTypedBinding['storageClass'],
  value: number | bigint,
): RuntimeSqliteTypedBinding {
  return { storageClass, value };
}

function assertSqliteStatementOpen(
  state: SqliteRuntimeStatementState,
  file: string,
  line: number,
): SqliteRuntimeDatabaseState {
  if (!state.isOpen || !state.database) {
    throw new IdylliumRuntimeError(file, line, 'sqlite statement is already closed');
  }
  assertSqliteDatabaseOpen(state.database, file, line);
  return state.database;
}

function bindSqliteStatement(
  state: SqliteRuntimeStatementState,
  nameValue: unknown,
  value: RuntimeSqliteBindable,
  file: string,
  line: number,
): void {
  assertSqliteStatementOpen(state, file, line);
  const name = stringArgument(nameValue, 'sqlite parameter name', file, line);
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `sqlite parameter name must be written without ':' and contain only letters, digits, and '_', got '${name}'`,
    );
  }
  if (!state.parameterNames.has(name)) {
    throw new IdylliumRuntimeError(file, line, `sqlite statement has no parameter ':${name}'`);
  }
  state.bindings.set(name, value);
}

function executeSqliteDatabase(
  state: SqliteRuntimeDatabaseState,
  sqlValue: unknown,
  bindings: ReadonlyMap<string, RuntimeSqliteBindable>,
  file: string,
  line: number,
): RuntimeObject {
  const engine = assertSqliteDatabaseOpen(state, file, line);
  const sql = stringArgument(sqlValue, 'sqlite execute() sql', file, line);
  const parameters = scanSqliteParameters(sql, file, line);
  for (const name of parameters) {
    if (!bindings.has(name)) {
      throw new IdylliumRuntimeError(file, line, `sqlite statement has unbound parameter ':${name}'`);
    }
  }
  const keyword = sqliteLeadingKeyword(sql);
  if (['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'].includes(keyword)) {
    throw new IdylliumRuntimeError(
      file,
      line,
      'use begin_transaction(), commit(), or rollback() instead of transaction SQL in execute()',
    );
  }

  const sqliteBindings: Record<string, RuntimeSqliteBindable> = {};
  for (const [name, value] of bindings) sqliteBindings[`:${name}`] = value;

  let execution: RuntimeSqliteExecution;
  try {
    execution = engine.execute(sql, sqliteBindings);
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite execution failed: ${errorMessage(error)}`);
  }
  if (!state.inTransaction) persistSqliteDatabase(state, file, line);
  return createSqliteResult(execution);
}

function createSqliteResult(execution: RuntimeSqliteExecution): RuntimeObject {
  const state: SqliteRuntimeResultState = {
    columns: [...execution.columns],
    rows: execution.rows.map((row) => [...row]),
    isOpen: true,
    cursor: -1,
  };
  const obj: RuntimeObject = { __idylliumType: 'sqlite.Result' };
  Object.defineProperty(obj, '__sqliteResultState', { value: state });
  defineRuntimeGetter(obj, 'is_open', () => state.isOpen);
  defineRuntimeGetter(obj, 'has_rows', () => state.columns.length > 0);
  defineRuntimeGetter(obj, 'affected_rows', () => execution.affectedRows);
  defineRuntimeGetter(obj, 'last_insert_id', () => createSqliteValue(execution.lastInsertId));

  obj.next = contextFunction((file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    const nextIndex = state.cursor + 1;
    if (nextIndex >= state.rows.length) {
      state.cursor = state.rows.length;
      return false;
    }
    state.cursor = nextIndex;
    return true;
  });
  obj.get = contextFunction((column: unknown, file: string, line: number) => (
    createSqliteValue(sqliteResultColumn(state, column, file, line))
  ));
  obj.is_null = contextFunction((column: unknown, file: string, line: number) => (
    sqliteResultColumn(state, column, file, line) === null
  ));
  obj.get_int = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToInt(value, file, line));
  });
  obj.get_int64 = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToInt64(value, file, line));
  });
  obj.get_float = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToFloat(value, file, line));
  });
  obj.get_string = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToString(value, file, line));
  });
  obj.get_bool = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToBool(value, file, line));
  });
  obj.column_count = contextFunction((file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    return state.columns.length;
  });
  obj.column_name = contextFunction((index: unknown, file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    const columnIndex = integerNumber(index, 'sqlite.Result.column_name() index', file, line);
    if (columnIndex < 0 || columnIndex >= state.columns.length) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `sqlite column index ${columnIndex} out of bounds (size ${state.columns.length}, valid indices ${validRange(state.columns.length)})`,
      );
    }
    return state.columns[columnIndex];
  });
  obj.close = contextFunction((file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    state.isOpen = false;
    state.cursor = state.rows.length;
  });
  return obj;
}

function createClosedSqliteResult(): RuntimeObject {
  const result = createSqliteResult({ columns: [], rows: [], affectedRows: 0, lastInsertId: null });
  (result.__sqliteResultState as SqliteRuntimeResultState).isOpen = false;
  return result;
}

function assertSqliteResultOpen(state: SqliteRuntimeResultState, file: string, line: number): void {
  if (!state.isOpen) throw new IdylliumRuntimeError(file, line, 'sqlite result is already closed');
}

function sqliteResultColumn(
  state: SqliteRuntimeResultState,
  columnValue: unknown,
  file: string,
  line: number,
): RuntimeSqliteValue {
  assertSqliteResultOpen(state, file, line);
  if (state.cursor < 0 || state.cursor >= state.rows.length) {
    throw new IdylliumRuntimeError(file, line, 'sqlite result has no current row; call next() first');
  }
  const column = stringArgument(columnValue, 'sqlite result column', file, line);
  const matching = state.columns
    .map((name, index) => ({ name, index }))
    .filter((item) => item.name === column);
  if (matching.length === 0) {
    throw new IdylliumRuntimeError(file, line, `sqlite result has no column '${column}'`);
  }
  if (matching.length > 1) {
    throw new IdylliumRuntimeError(file, line, `sqlite result column '${column}' is ambiguous; use SQL aliases`);
  }
  return state.rows[state.cursor][matching[0].index];
}

function sqliteColumnConversion<T>(
  state: SqliteRuntimeResultState,
  column: string,
  file: string,
  line: number,
  convert: (value: SqliteRuntimeValueObject) => T,
): T {
  const value = createSqliteValue(sqliteResultColumn(state, column, file, line));
  try {
    return convert(value);
  } catch (error) {
    if (error instanceof IdylliumRuntimeError) {
      const detail = error.message.replace(/^.*?:\d+: runtime error: /u, '');
      throw new IdylliumRuntimeError(file, line, detail.replace(/^sqlite value/u, `sqlite column '${column}'`));
    }
    throw error;
  }
}

function defineRuntimeGetter(obj: RuntimeObject, name: string, getter: () => unknown): void {
  Object.defineProperty(obj, name, {
    enumerable: true,
    configurable: true,
    get: getter,
  });
}

function scanSqliteParameters(sql: string, file: string, line: number): ReadonlySet<string> {
  const names = new Set<string>();
  let mode: 'normal' | 'single' | 'double' | 'backtick' | 'bracket' | 'line-comment' | 'block-comment' = 'normal';

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1] ?? '';

    if (mode === 'line-comment') {
      if (char === '\n') mode = 'normal';
      continue;
    }
    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = 'normal';
        index += 1;
      }
      continue;
    }
    if (mode === 'single' || mode === 'double' || mode === 'backtick') {
      const closing = mode === 'single' ? "'" : mode === 'double' ? '"' : '`';
      if (char === closing) {
        if (next === closing) index += 1;
        else mode = 'normal';
      }
      continue;
    }
    if (mode === 'bracket') {
      if (char === ']') mode = 'normal';
      continue;
    }

    if (char === '-' && next === '-') {
      mode = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      mode = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'") {
      mode = 'single';
      continue;
    }
    if (char === '"') {
      mode = 'double';
      continue;
    }
    if (char === '`') {
      mode = 'backtick';
      continue;
    }
    if (char === '[') {
      mode = 'bracket';
      continue;
    }
    if (char === ':' && /^[\p{L}_]$/u.test(next)) {
      let end = index + 2;
      while (end < sql.length && /^[\p{L}\p{N}_]$/u.test(sql[end])) end += 1;
      names.add(sql.slice(index + 1, end));
      index = end - 1;
      continue;
    }
    if (char === '?' || char === '@' || char === '$') {
      throw new IdylliumRuntimeError(
        file,
        line,
        `unsupported SQLite parameter '${char}'; use named parameters such as ':name'`,
      );
    }
  }
  return names;
}

function sqliteLeadingKeyword(sql: string): string {
  const withoutComments = sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/u, '');
  return /^[A-Za-z]+/u.exec(withoutComments)?.[0].toUpperCase() ?? '';
}

export interface ConsoleIO {
  write(text: string): void;
  readLine(): Promise<string>;
  clear(): void;
}

export interface RuntimeAbortSignal {
  readonly aborted: boolean;
  addEventListener?(type: 'abort', listener: () => void, options?: { readonly once?: boolean }): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
}

export interface RuntimeOptions {
  readonly console?: Partial<ConsoleIO>;
  readonly input?: readonly string[];
  readonly fileSystem?: RuntimeFileSystem;
  readonly projectRoot?: string;
  readonly fontMetricsService?: RuntimeFontMetricsService;
  readonly imageService?: RuntimeImageService;
  readonly sqliteService?: RuntimeSqliteService;
  readonly abortSignal?: RuntimeAbortSignal;
}

export interface RuntimeFileSystem {
  resolvePath(requestedPath: string, sourceFile: string): string;
  exists(filePath: string): boolean;
  isFile(filePath: string): boolean;
  isDirectory(filePath: string): boolean;
  readText(filePath: string): string;
  writeText(filePath: string, text: string): void;
  appendText(filePath: string, text: string): void;
  createDirectory?(filePath: string, parents: boolean): void;
  listDirectory?(filePath: string): readonly string[];
  copy?(sourcePath: string, destinationPath: string): void;
  rename?(sourcePath: string, destinationPath: string): void;
  remove?(filePath: string, recursive: boolean): void;
  readBytes?(filePath: string): Uint8Array;
  writeBytes?(filePath: string, bytes: Uint8Array, resourceUri?: string): void;
  resourceUri?(filePath: string): string | null;
  snapshot?(): Record<string, MemoryRuntimeFile>;
  writtenFilesSnapshot?(): Record<string, MemoryRuntimeFile>;
}

export interface MemoryRuntimeFile {
  readonly content?: string;
  readonly bytes?: Uint8Array;
  readonly kind?: 'file' | 'directory' | 'deleted';
  readonly resourceUri?: string;
}

export function createMemoryRuntimeFileSystem(
  entries: Readonly<Record<string, string | MemoryRuntimeFile>> = {},
  cwd = '/workspace',
): RuntimeFileSystem {
  const files = new Map<string, { content: string; bytes?: Uint8Array; resourceUri: string | null }>();
  const directories = new Set<string>();
  const touchedPaths = new Set<string>();
  const normalizedCwd = normalizeMemoryPath(cwd);
  addMemoryDirectory(directories, '/');
  addMemoryDirectory(directories, normalizedCwd);

  for (const [rawPath, rawEntry] of Object.entries(entries)) {
    const filePath = normalizeMemoryPath(rawPath, normalizedCwd);
    if (typeof rawEntry !== 'string' && rawEntry.kind === 'directory') {
      addMemoryDirectory(directories, filePath);
      continue;
    }

    addMemoryDirectory(directories, memoryDirname(filePath));
    files.set(filePath, {
      content: typeof rawEntry === 'string' ? rawEntry : rawEntry.content ?? '',
      bytes: typeof rawEntry === 'string' || !rawEntry.bytes ? undefined : new Uint8Array(rawEntry.bytes),
      resourceUri: typeof rawEntry === 'string' ? null : rawEntry.resourceUri ?? null,
    });
  }

  return {
    resolvePath(requestedPath: string, sourceFile: string): string {
      const sourceDirectory = sourceFile.trim() === '' ? normalizedCwd : memoryDirname(normalizeMemoryPath(sourceFile, normalizedCwd));
      return normalizeMemoryPath(requestedPath, sourceDirectory);
    },
    exists(filePath: string): boolean {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      return files.has(normalized) || directories.has(normalized);
    },
    isFile(filePath: string): boolean {
      return files.has(normalizeMemoryPath(filePath, normalizedCwd));
    },
    isDirectory(filePath: string): boolean {
      return directories.has(normalizeMemoryPath(filePath, normalizedCwd));
    },
    readText(filePath: string): string {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      const file = files.get(normalized);
      if (!file) throw new Error(`file does not exist: ${normalized}`);
      return file.content;
    },
    writeText(filePath: string, text: string): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file write');
      const parent = memoryDirname(normalized);
      if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
      if (directories.has(normalized)) throw new Error(`path is a directory: ${normalized}`);
      files.set(normalized, { content: text, resourceUri: null });
      touchedPaths.add(normalized);
    },
    appendText(filePath: string, text: string): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file write');
      const file = files.get(normalized);
      if (!file) throw new Error(`file does not exist: ${normalized}`);
      files.set(normalized, { content: file.content + text, resourceUri: null });
      touchedPaths.add(normalized);
    },
    createDirectory(filePath: string, parents: boolean): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file.create_directory()');
      if (files.has(normalized) || directories.has(normalized)) {
        throw new Error(`path already exists: ${normalized}`);
      }

      if (!parents) {
        const parent = memoryDirname(normalized);
        if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
        directories.add(normalized);
        touchedPaths.add(normalized);
        return;
      }

      const missing: string[] = [];
      let current = normalized;
      while (!directories.has(current)) {
        assertMemoryProjectPath(current, normalizedCwd, 'file.create_directory()');
        if (files.has(current)) throw new Error(`path is a file: ${current}`);
        missing.push(current);
        const parent = memoryDirname(current);
        if (parent === current) break;
        current = parent;
      }
      for (const directory of missing.reverse()) {
        directories.add(directory);
        touchedPaths.add(directory);
      }
    },
    listDirectory(filePath: string): readonly string[] {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      if (!directories.has(normalized)) {
        if (files.has(normalized)) throw new Error(`path is not a directory: ${normalized}`);
        throw new Error(`directory does not exist: ${normalized}`);
      }
      const names = new Set<string>();
      for (const directory of directories) {
        if (directory !== normalized && memoryDirname(directory) === normalized) {
          names.add(memoryBasename(directory));
        }
      }
      for (const file of files.keys()) {
        if (memoryDirname(file) === normalized) names.add(memoryBasename(file));
      }
      return [...names].sort((left, right) => left.localeCompare(right));
    },
    copy(sourcePath: string, destinationPath: string): void {
      const source = normalizeMemoryPath(sourcePath, normalizedCwd);
      const destination = normalizeMemoryPath(destinationPath, normalizedCwd);
      assertMemoryProjectPath(source, normalizedCwd, 'file.copy()');
      assertMemoryProjectPath(destination, normalizedCwd, 'file.copy()');
      assertMemoryMovableSource(source, normalizedCwd, 'file.copy()');
      assertMemoryDestinationAvailable(files, directories, destination);
      assertMemoryDestinationParent(directories, destination);

      const sourceFile = files.get(source);
      if (sourceFile) {
        files.set(destination, cloneMemoryFile(sourceFile));
        touchedPaths.add(destination);
        return;
      }
      if (!directories.has(source)) throw new Error(`path does not exist: ${source}`);
      if (destination.startsWith(`${source}/`)) {
        throw new Error('cannot copy a directory inside itself');
      }

      const prefix = `${source}/`;
      const copiedDirectories = [...directories]
        .filter((directory) => directory === source || directory.startsWith(prefix))
        .sort((left, right) => left.length - right.length);
      const copiedFiles = [...files.entries()].filter(([file]) => file.startsWith(prefix));
      for (const directory of copiedDirectories) {
        const target = `${destination}${directory.slice(source.length)}`;
        directories.add(target);
        touchedPaths.add(target);
      }
      for (const [file, value] of copiedFiles) {
        const target = `${destination}${file.slice(source.length)}`;
        files.set(target, cloneMemoryFile(value));
        touchedPaths.add(target);
      }
    },
    rename(sourcePath: string, destinationPath: string): void {
      const source = normalizeMemoryPath(sourcePath, normalizedCwd);
      const destination = normalizeMemoryPath(destinationPath, normalizedCwd);
      assertMemoryProjectPath(source, normalizedCwd, 'file.rename()');
      assertMemoryProjectPath(destination, normalizedCwd, 'file.rename()');
      assertMemoryMovableSource(source, normalizedCwd, 'file.rename()');
      assertMemoryDestinationAvailable(files, directories, destination);
      assertMemoryDestinationParent(directories, destination);

      const sourceFile = files.get(source);
      if (sourceFile) {
        files.delete(source);
        files.set(destination, sourceFile);
        touchedPaths.add(source);
        touchedPaths.add(destination);
        return;
      }
      if (!directories.has(source)) throw new Error(`path does not exist: ${source}`);
      if (destination.startsWith(`${source}/`)) {
        throw new Error('cannot move a directory inside itself');
      }

      const prefix = `${source}/`;
      const movedDirectories = [...directories]
        .filter((directory) => directory === source || directory.startsWith(prefix));
      const movedFiles = [...files.entries()].filter(([file]) => file.startsWith(prefix));
      for (const [file] of movedFiles) {
        files.delete(file);
        touchedPaths.add(file);
      }
      for (const directory of movedDirectories) {
        directories.delete(directory);
        touchedPaths.add(directory);
      }
      for (const directory of movedDirectories.sort((left, right) => left.length - right.length)) {
        const target = `${destination}${directory.slice(source.length)}`;
        directories.add(target);
        touchedPaths.add(target);
      }
      for (const [file, value] of movedFiles) {
        const target = `${destination}${file.slice(source.length)}`;
        files.set(target, value);
        touchedPaths.add(target);
      }
    },
    remove(filePath: string, recursive: boolean): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'file.remove()');
      assertMemoryMovableSource(normalized, normalizedCwd, 'file.remove()');
      if (files.delete(normalized)) {
        touchedPaths.add(normalized);
        return;
      }
      if (!directories.has(normalized)) throw new Error(`path does not exist: ${normalized}`);

      const prefix = `${normalized}/`;
      const childFiles = [...files.keys()].filter((file) => file.startsWith(prefix));
      const childDirectories = [...directories].filter((directory) => directory.startsWith(prefix));
      if (!recursive && (childFiles.length > 0 || childDirectories.length > 0)) {
        throw new Error(`directory is not empty: ${normalized}`);
      }
      for (const file of childFiles) {
        files.delete(file);
        touchedPaths.add(file);
      }
      for (const directory of childDirectories.sort((left, right) => right.length - left.length)) {
        directories.delete(directory);
        touchedPaths.add(directory);
      }
      directories.delete(normalized);
      touchedPaths.add(normalized);
    },
    readBytes(filePath: string): Uint8Array {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      const file = files.get(normalized);
      if (!file) throw new Error(`file does not exist: ${normalized}`);
      if (file.bytes) return new Uint8Array(file.bytes);
      return new TextEncoder().encode(file.content);
    },
    writeBytes(filePath: string, bytes: Uint8Array, resourceUri?: string): void {
      const normalized = normalizeMemoryPath(filePath, normalizedCwd);
      assertMemoryProjectPath(normalized, normalizedCwd, 'binary file write');
      const parent = memoryDirname(normalized);
      if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
      if (directories.has(normalized)) throw new Error(`path is a directory: ${normalized}`);
      files.set(normalized, {
        content: '',
        bytes: new Uint8Array(bytes),
        resourceUri: resourceUri ?? null,
      });
      touchedPaths.add(normalized);
    },
    resourceUri(filePath: string): string | null {
      return files.get(normalizeMemoryPath(filePath, normalizedCwd))?.resourceUri ?? null;
    },
    snapshot(): Record<string, MemoryRuntimeFile> {
      const result: Record<string, MemoryRuntimeFile> = {};
      for (const directory of [...directories].sort()) {
        result[directory] = { kind: 'directory' };
      }
      for (const [filePath, file] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        result[filePath] = {
          kind: 'file',
          content: file.content,
          bytes: file.bytes ? new Uint8Array(file.bytes) : undefined,
          resourceUri: file.resourceUri ?? undefined,
        };
      }
      return result;
    },
    writtenFilesSnapshot(): Record<string, MemoryRuntimeFile> {
      const result: Record<string, MemoryRuntimeFile> = {};
      for (const filePath of [...touchedPaths].sort()) {
        const file = files.get(filePath);
        if (file) {
          result[filePath] = {
            kind: 'file',
            content: file.content,
            bytes: file.bytes ? new Uint8Array(file.bytes) : undefined,
            resourceUri: file.resourceUri ?? undefined,
          };
        } else if (directories.has(filePath)) {
          result[filePath] = { kind: 'directory' };
        } else {
          result[filePath] = { kind: 'deleted' };
        }
      }
      return result;
    },
  };
}

export interface IdylliumDrawableSnapshot {
  readonly type: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface IdylliumCanvasCommand {
  readonly kind: 'clear' | 'fill' | 'draw';
  readonly color?: string;
  readonly object?: IdylliumDrawableSnapshot;
}

export interface IdylliumCanvasSnapshot {
  readonly id: number;
  readonly type: 'gui.Canvas';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly commands: readonly IdylliumCanvasCommand[];
}

export interface IdylliumAudioCommand {
  readonly id: number;
  readonly action: 'play' | 'pause' | 'resume' | 'stop';
}

export interface IdylliumAudioSnapshot {
  readonly id: number;
  readonly type: 'audio.Sound' | 'audio.Music';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly commands: readonly IdylliumAudioCommand[];
}

export interface IdylliumGuiWidgetSnapshot {
  readonly id: number;
  readonly type: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly children: readonly IdylliumGuiWidgetSnapshot[];
  readonly canvas?: IdylliumCanvasSnapshot;
  readonly items?: readonly string[];
}

export interface IdylliumWindowSnapshot extends IdylliumGuiWidgetSnapshot {
  readonly type: 'gui.Window';
}

export interface IdylliumModalSnapshot {
  readonly id: number;
  readonly type: 'gui.Modal';
  readonly mode: 'alert' | 'confirm' | 'input';
  readonly properties: Readonly<Record<string, unknown>>;
}

type ContextualRuntimeFunction = ((...args: any[]) => unknown) & {
  __idylliumPassContext?: true;
};

function contextFunction(fn: (...args: any[]) => unknown): ContextualRuntimeFunction {
  const callable = fn as ContextualRuntimeFunction;
  callable.__idylliumPassContext = true;
  return callable;
}

export interface IdylliumRuntime {
  readonly console: {
    write(...values: unknown[]): Promise<void>;
    writeln(...values: unknown[]): Promise<void>;
    clear(): Promise<void>;
    get_int(file?: string, line?: number): Promise<number>;
    get_float(file?: string, line?: number): Promise<number>;
    get_string(): Promise<string>;
    set_precision(file: string, line: number, digits: number): Promise<void>;
  };
  readonly core: {
    binary(operator: string, left: unknown, right: unknown, file: string, line: number): unknown;
    negate(value: unknown): number | bigint;
    divide(left: unknown, right: unknown, file: string, line: number): number;
    div(left: unknown, right: unknown, file: string, line: number): number | bigint;
    mod(left: unknown, right: unknown, file: string, line: number): number | bigint;
    to_int(value: unknown, file: string, line: number): number | bigint;
    to_float(value: unknown, file: string, line: number): number;
    to_string(value: unknown): string;
  };
  readonly array: {
    create(size: number, defaultFactory: () => unknown, dynamic: boolean): IdylliumArray;
    from(values: unknown[], dynamic: boolean, staticSize: number | null, defaultFactory: () => unknown): IdylliumArray;
    convert(
      value: unknown,
      dynamic: boolean,
      staticSize: number | null,
      defaultFactory: () => unknown,
      convertElement: (value: unknown) => unknown,
      targetType: string,
      file: string,
      line: number,
    ): IdylliumArray;
    get(array: unknown, index: unknown, file: string, line: number): unknown;
    set(array: unknown, index: unknown, value: unknown, file: string, line: number): void;
    max(array: unknown, file: string, line: number): number | bigint;
    min(array: unknown, file: string, line: number): number | bigint;
    sum(array: unknown, file: string, line: number): number | bigint;
    avg(array: unknown, file: string, line: number): number;
  };
  readonly types: {
    cast(value: unknown, typeName: string): number | bigint;
    to_bin(value: unknown, typeName: string): string;
    to_hex(value: unknown, typeName: string): string;
    shift_left(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint;
    shift_right(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint;
  };
  readonly modules: {
    readonly math: Record<string, unknown>;
    readonly random: Record<string, unknown>;
    readonly time: Record<string, unknown>;
    readonly file: Record<string, unknown>;
    readonly types: Record<string, unknown>;
    readonly encoding: Record<string, unknown>;
    readonly json: Record<string, unknown>;
    readonly sqlite: Record<string, unknown>;
    readonly audio: Record<string, unknown>;
    readonly image: Record<string, unknown>;
    readonly gui: Record<string, unknown>;
    readonly colors: Record<string, unknown>;
  };
  createObject(moduleName: string, typeName: string): Record<string, unknown>;
  convertNullable(moduleName: string, typeName: string, value: unknown, file: string, line: number): unknown;
  setProperty(target: unknown, propertyName: string, value: unknown, file: string, line: number): unknown;
  callModuleFunction(moduleName: string, functionName: string, args: readonly unknown[], file: string, line: number): unknown;
  callMethod(target: unknown, methodName: string, args: readonly unknown[], file: string, line: number): unknown;
  getOutput(): string;
  getAudio(): readonly IdylliumAudioSnapshot[];
  getCanvases(): readonly IdylliumCanvasSnapshot[];
  getWindows(): readonly IdylliumWindowSnapshot[];
  getModals(): readonly IdylliumModalSnapshot[];
  hasGui(): boolean;
  stepGui(deltaTime?: number): Promise<boolean>;
  dispatchGuiEvent(canvasId: number, eventName: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

function defaultRuntimeImageService(): RuntimeImageService | undefined {
  const nodeProcess = typeof process === 'object' ? process as any : null;
  if (!nodeProcess?.versions?.node) return undefined;
  try {
    // Keep the Node codec out of the browser bundle; browser.ts injects its own service.
    const dynamicRequire = eval('require') as (request: string) => any;
    return dynamicRequire('./node-image-service').createNodeImageService();
  } catch {
    return undefined;
  }
}

function defaultRuntimeSqliteService(): RuntimeSqliteService | undefined {
  const nodeProcess = typeof process === 'object' ? process as any : null;
  if (!nodeProcess?.versions?.node) return undefined;
  try {
    // Keep sql.js and its Node loader out of the browser bundle.
    const dynamicRequire = eval('require') as (request: string) => any;
    return dynamicRequire('./node-sqlite-service').createNodeSqliteService();
  } catch {
    return undefined;
  }
}

export function createRuntime(options: RuntimeOptions = {}): IdylliumRuntime {
  let output = '';
  let precision: number | null = null;
  let randomSeed: number | null = null;
  const input = [...(options.input ?? [])];
  const fileSystem = options.fileSystem ?? createNodeRuntimeFileSystem(options.projectRoot);
  const runtimeObjects: RuntimeObjectState = {
    objects: [],
    audio: [],
    canvases: [],
    fileSystem,
    fontMetricsService: options.fontMetricsService ?? createRuntimeFontMetricsService(),
    imageService: options.imageService ?? defaultRuntimeImageService(),
    sqliteService: options.sqliteService ?? defaultRuntimeSqliteService(),
    modals: [],
    timers: [],
    windows: [],
    nextAudioCommandId: 1,
    nextObjectId: 1,
  };

  const io: ConsoleIO = {
    write(text: string): void {
      output += text;
      options.console?.write?.(text);
    },
    clear(): void {
      output = '';
      options.console?.clear?.();
    },
    async readLine(): Promise<string> {
      if (options.console?.readLine) {
        return options.console.readLine();
      }
      return input.shift() ?? '';
    },
  };

  async function formatConsoleValue(value: unknown): Promise<string> {
    if (isJsonRuntimeValue(value)) {
      return formatForConsole(value, precision);
    }
    if (value !== null && typeof value === 'object') {
      const method = (value as Record<string, unknown>).to_string;
      if (typeof method === 'function') {
        const result = await method.apply(value);
        return formatForConsole(result, precision);
      }
    }
    return formatForConsole(value, precision);
  }

  async function formatConsoleValues(values: readonly unknown[]): Promise<string> {
    const parts: string[] = [];
    for (const value of values) {
      parts.push(await formatConsoleValue(value));
    }
    return parts.join('');
  }

  function createInputFile(filePath: string, sourceFile: string, line: number): Record<string, unknown> {
    if (!fileSystem.exists(filePath)) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for reading: file does not exist`);
    }
    if (!runtimeIsFile(fileSystem, filePath, sourceFile, line, 'reading')) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for reading: path is not a file`);
    }

    let content: string;
    let lines: string[];
    try {
      content = fileSystem.readText(filePath);
      lines = splitFileLines(content);
    } catch (error) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for reading: ${errorMessage(error)}`);
    }

    let index = 0;
    let closed = false;
    const stream: Record<string, unknown> = {
      __idylliumType: 'file.istream',
      is_open: true,
      read_line: contextFunction((file: string, callLine: number) => {
        expectOpen(!closed, 'istream.read_line()', file, callLine);
        if (index >= lines.length) {
          throw new IdylliumRuntimeError(file, callLine, 'istream.read_line() cannot read past end of file');
        }
        return lines[index++];
      }),
      read_all: contextFunction((file: string, callLine: number) => {
        expectOpen(!closed, 'istream.read_all()', file, callLine);
        const rest = lines.slice(index).join('');
        index = lines.length;
        return rest;
      }),
      has_next_line: contextFunction((file: string, callLine: number) => {
        expectOpen(!closed, 'istream.has_next_line()', file, callLine);
        return index < lines.length;
      }),
      close: () => {
        closed = true;
        stream.is_open = false;
      },
    };
    return stream;
  }

  function createOutputFile(filePath: string, sourceFile: string, line: number): Record<string, unknown> {
    const parent = runtimeDirname(filePath);
    if (!fileSystem.exists(parent)) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for writing: directory does not exist`);
    }
    if (!runtimeIsDirectory(fileSystem, parent, sourceFile, line, 'writing')) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for writing: parent path is not a directory`);
    }

    try {
      fileSystem.writeText(filePath, '');
    } catch (error) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for writing: ${errorMessage(error)}`);
    }

    let closed = false;
    const stream: Record<string, unknown> = {
      __idylliumType: 'file.ostream',
      is_open: true,
      write_line: contextFunction(async (...rawArgs: unknown[]) => {
        const { values, file, line: callLine } = splitContextArgs(rawArgs);
        expectOpen(!closed, 'ostream.write_line()', file, callLine);
        fileSystem.appendText(filePath, await formatConsoleValues(values));
      }),
      close: () => {
        closed = true;
        stream.is_open = false;
      },
    };
    return stream;
  }

  const core = {
    binary(operator: string, left: unknown, right: unknown, file: string, line: number): unknown {
      return runtimeBinary(operator, left, right, file, line);
    },
    negate(value: unknown): number | bigint {
      return runtimeNegate(value);
    },
    divide(left: unknown, right: unknown, file: string, line: number): number {
      return runtimeDivide(left, right, file, line);
    },
    div(left: unknown, right: unknown, file: string, line: number): number | bigint {
      return runtimeIntegerDivision(left, right, file, line);
    },
    mod(left: unknown, right: unknown, file: string, line: number): number | bigint {
      return runtimeModulo(left, right, file, line);
    },
    to_int(value: unknown, file: string, line: number): number | bigint {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') {
        return Math.trunc(finiteNumber(value, "'to_int' value", file, line));
      }
      if (typeof value === 'string') {
        return parseIntegerText(value, "'to_int'", file, line);
      }
      throw new IdylliumRuntimeError(file, line, `'to_int' cannot convert '${String(value)}' to int`);
    },
    to_float(value: unknown, file: string, line: number): number {
      if (typeof value === 'number' || typeof value === 'bigint') {
        return finiteNumber(value, "'to_float' value", file, line);
      }
      if (typeof value === 'string') {
        return parseFloatText(value, "'to_float'", file, line);
      }
      throw new IdylliumRuntimeError(file, line, `'to_float' cannot convert '${String(value)}' to float`);
    },
    to_string(value: unknown): string {
      return formatForConsole(value, precision);
    },
  };

  const array = {
    create(size: number, defaultFactory: () => unknown, dynamic: boolean): IdylliumArray {
      return IdylliumArray.create(size, defaultFactory, dynamic);
    },
    from(
      values: unknown[],
      dynamic: boolean,
      staticSize: number | null,
      defaultFactory: () => unknown,
    ): IdylliumArray {
      return IdylliumArray.from(values, dynamic, staticSize, defaultFactory);
    },
    convert(
      value: unknown,
      dynamic: boolean,
      staticSize: number | null,
      defaultFactory: () => unknown,
      convertElement: (value: unknown) => unknown,
      targetType: string,
      file: string,
      line: number,
    ): IdylliumArray {
      return IdylliumArray.convert(
        value,
        dynamic,
        staticSize,
        defaultFactory,
        convertElement,
        targetType,
        file,
        line,
      );
    },
    get(value: unknown, index: unknown, file: string, line: number): unknown {
      if (typeof value === 'string') return stringCharAt(value, index, file, line);
      return expectArray(value, file, line).get(index, file, line);
    },
    set(value: unknown, index: unknown, item: unknown, file: string, line: number): void {
      if (typeof value === 'string') {
        throw new IdylliumRuntimeError(file, line, 'string characters are read-only');
      }
      expectArray(value, file, line).set(index, item, file, line);
    },
    max(value: unknown, file: string, line: number): number | bigint {
      const values = numericValues(value, 'max', file, line);
      return values.reduce((best, item) => runtimeCompare(item, best) > 0 ? item : best);
    },
    min(value: unknown, file: string, line: number): number | bigint {
      const values = numericValues(value, 'min', file, line);
      return values.reduce((best, item) => runtimeCompare(item, best) < 0 ? item : best);
    },
    sum(value: unknown, file: string, line: number): number | bigint {
      return numericValues(value, 'sum', file, line)
        .reduce<number | bigint>((total, item) => runtimeAdd(total, item), 0);
    },
    avg(value: unknown, file: string, line: number): number {
      const values = numericValues(value, 'avg', file, line);
      const total = values.reduce<number | bigint>((sum, item) => runtimeAdd(sum, item), 0);
      return Number(total) / values.length;
    },
  };

  const types = {
    cast(value: unknown, typeName: string): number | bigint {
      return castTypesValue(value, typeName);
    },
    to_bin(value: unknown, typeName: string): string {
      return typesToBin(value, typeName);
    },
    to_hex(value: unknown, typeName: string): string {
      return typesToHex(value, typeName);
    },
    shift_left(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint {
      return typesShift(value, typeName, bits, 'left', file, line);
    },
    shift_right(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint {
      return typesShift(value, typeName, bits, 'right', file, line);
    },
  };

  return {
    console: {
      async write(...values: unknown[]): Promise<void> {
        io.write(await formatConsoleValues(values));
      },
      async writeln(...values: unknown[]): Promise<void> {
        io.write(`${await formatConsoleValues(values)}\n`);
      },
      async clear(): Promise<void> {
        io.clear();
      },
      async get_int(file = 'console', line = 0): Promise<number> {
        const inputText = await io.readLine();
        const normalized = inputText.trim();
        if (!/^[+-]?\d+$/u.test(normalized)) {
          throw new IdylliumRuntimeError(file, line, `cannot convert input to 'int' (expected integer, got ${JSON.stringify(inputText)})`);
        }
        return Number.parseInt(normalized, 10);
      },
      async get_float(file = 'console', line = 0): Promise<number> {
        const inputText = await io.readLine();
        const normalized = inputText.trim();
        if (!/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))$/u.test(normalized)) {
          throw new IdylliumRuntimeError(file, line, `cannot convert input to 'float' (expected number, got ${JSON.stringify(inputText)})`);
        }
        return Number.parseFloat(normalized);
      },
      async get_string(): Promise<string> {
        return io.readLine();
      },
      async set_precision(file: string, line: number, digits: number): Promise<void> {
        precision = precisionDigits(digits, 'console.set_precision()', file, line);
      },
    },
    core,
    array,
    types,
    modules: {
      math: {
        pi: Math.PI,
        e: Math.E,
        abs: contextFunction((value: number, file: string, line: number) => Math.abs(finiteNumber(value, 'math.abs() value', file, line))),
        sqrt: contextFunction((value: number, file: string, line: number) => {
          const number = finiteNumber(value, 'math.sqrt() value', file, line);
          if (number < 0) throw new IdylliumRuntimeError(file, line, `math.sqrt() expects a non-negative number, got ${number}`);
          return Math.sqrt(number);
        }),
        round: contextFunction((value: number, digitsOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
          const context = optionalNumberContext(digitsOrFile, fileOrLine, maybeLine);
          return roundWithPrecision(value, context.value, context.file, context.line);
        }),
        floor: contextFunction((value: number, digitsOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
          const context = optionalNumberContext(digitsOrFile, fileOrLine, maybeLine);
          return floorWithPrecision(value, context.value, context.file, context.line);
        }),
        ceil: contextFunction((value: number, digitsOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
          const context = optionalNumberContext(digitsOrFile, fileOrLine, maybeLine);
          return ceilWithPrecision(value, context.value, context.file, context.line);
        }),
        pow: contextFunction((value: number, power: number, file: string, line: number) => {
          const result = Math.pow(
            finiteNumber(value, 'math.pow() value', file, line),
            finiteNumber(power, 'math.pow() power', file, line),
          );
          return finiteMathResult(result, 'math.pow()', file, line);
        }),
        clamp: contextFunction((min: number, value: number, max: number, file: string, line: number) => {
          const lower = finiteNumber(min, 'math.clamp() min', file, line);
          const current = finiteNumber(value, 'math.clamp() value', file, line);
          const upper = finiteNumber(max, 'math.clamp() max', file, line);
          if (lower > upper) {
            throw new IdylliumRuntimeError(file, line, `math.clamp() min must be less than or equal to max (got min ${lower}, max ${upper})`);
          }
          return Math.min(upper, Math.max(lower, current));
        }),
        sin: contextFunction((radians: number, file: string, line: number) => Math.sin(finiteNumber(radians, 'math.sin() radians', file, line))),
        cos: contextFunction((radians: number, file: string, line: number) => Math.cos(finiteNumber(radians, 'math.cos() radians', file, line))),
        tan: contextFunction((radians: number, file: string, line: number) => finiteMathResult(Math.tan(finiteNumber(radians, 'math.tan() radians', file, line)), 'math.tan()', file, line)),
        asin: contextFunction((value: number, file: string, line: number) => {
          const number = rangeNumber(value, 'math.asin() value', -1, 1, file, line);
          return Math.asin(number);
        }),
        acos: contextFunction((value: number, file: string, line: number) => {
          const number = rangeNumber(value, 'math.acos() value', -1, 1, file, line);
          return Math.acos(number);
        }),
        log: contextFunction((value: number, file: string, line: number) => {
          const number = finiteNumber(value, 'math.log() value', file, line);
          if (number <= 0) throw new IdylliumRuntimeError(file, line, `math.log() expects a positive number, got ${number}`);
          return Math.log(number);
        }),
        log10: contextFunction((value: number, file: string, line: number) => {
          const number = finiteNumber(value, 'math.log10() value', file, line);
          if (number <= 0) throw new IdylliumRuntimeError(file, line, `math.log10() expects a positive number, got ${number}`);
          return Math.log10(number);
        }),
        to_radians: contextFunction((degrees: number, file: string, line: number) => finiteNumber(degrees, 'math.to_radians() degrees', file, line) * Math.PI / 180),
        to_degrees: contextFunction((radians: number, file: string, line: number) => finiteNumber(radians, 'math.to_degrees() radians', file, line) * 180 / Math.PI),
      },
      random: {
        create_int: contextFunction((min: number, max: number, file: string, line: number) => {
          const low = integerNumber(min, 'random.create_int() min', file, line);
          const high = integerNumber(max, 'random.create_int() max', file, line);
          if (low > high) {
            throw new IdylliumRuntimeError(file, line, `random.create_int() min must be less than or equal to max (got min ${low}, max ${high})`);
          }
          return Math.floor(randomUnit() * (high - low + 1)) + low;
        }),
        create_float: contextFunction((min: number, max: number, file: string, line: number) => {
          const low = finiteNumber(min, 'random.create_float() min', file, line);
          const high = finiteNumber(max, 'random.create_float() max', file, line);
          if (low >= high) {
            throw new IdylliumRuntimeError(file, line, `random.create_float() min must be less than max (got min ${low}, max ${high})`);
          }
          return randomUnit() * (high - low) + low;
        }),
        set_seed: contextFunction((seed: number, file: string, line: number) => {
          const value = integerNumber(seed, 'random.set_seed() seed', file, line);
          if (value < 0) throw new IdylliumRuntimeError(file, line, `random.set_seed() seed must be non-negative, got ${value}`);
          randomSeed = value >>> 0;
        }),
      },
      time: {
        sleep: contextFunction((seconds: number, file: string, line: number) => {
          const duration = finiteNumber(seconds, 'time.sleep() seconds', file, line);
          if (duration < 0) {
            throw new IdylliumRuntimeError(file, line, `time.sleep() seconds must be non-negative, got ${duration}`);
          }
          return waitForRuntimeDelay(duration * 1000, file, line);
        }),
        now: contextFunction(() => IdylliumTimeStamp.now()),
        from_unix: contextFunction((seconds: number, file: string, line: number) => IdylliumTimeStamp.fromUnix(seconds, file, line)),
      },
      file: {
        exists: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.exists() path', file, line);
          return fileSystem.exists(fileSystem.resolvePath(requestedPath, file));
        }),
        is_file: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.is_file() path', file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          try {
            return fileSystem.exists(resolvedPath) && fileSystem.isFile(resolvedPath);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.is_file() cannot inspect '${requestedPath}': ${errorMessage(error)}`);
          }
        }),
        is_directory: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.is_directory() path', file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          try {
            return fileSystem.exists(resolvedPath) && fileSystem.isDirectory(resolvedPath);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.is_directory() cannot inspect '${requestedPath}': ${errorMessage(error)}`);
          }
        }),
        create_directory: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const requestedPath = stringArgument(values[0], 'file.create_directory() path', file, line);
          const parents = values.length >= 2
            ? booleanArgument(values[1], 'file.create_directory() parents', file, line)
            : false;
          if (!fileSystem.createDirectory) {
            throw new IdylliumRuntimeError(file, line, 'file.create_directory() is not supported by this runtime');
          }
          try {
            fileSystem.createDirectory(fileSystem.resolvePath(requestedPath, file), parents);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.create_directory() cannot create '${requestedPath}': ${errorMessage(error)}`);
          }
        }),
        list_directory: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.list_directory() path', file, line);
          if (!fileSystem.listDirectory) {
            throw new IdylliumRuntimeError(file, line, 'file.list_directory() is not supported by this runtime');
          }
          try {
            const names = fileSystem.listDirectory(fileSystem.resolvePath(requestedPath, file));
            return IdylliumArray.from([...names], true, null, () => '');
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.list_directory() cannot inspect '${requestedPath}': ${errorMessage(error)}`);
          }
        }),
        copy: contextFunction((sourcePath: string, destinationPath: string, file: string, line: number) => {
          const source = stringArgument(sourcePath, 'file.copy() source', file, line);
          const destination = stringArgument(destinationPath, 'file.copy() destination', file, line);
          if (!fileSystem.copy) {
            throw new IdylliumRuntimeError(file, line, 'file.copy() is not supported by this runtime');
          }
          try {
            fileSystem.copy(
              fileSystem.resolvePath(source, file),
              fileSystem.resolvePath(destination, file),
            );
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.copy() cannot copy '${source}' to '${destination}': ${errorMessage(error)}`);
          }
        }),
        rename: contextFunction((sourcePath: string, destinationPath: string, file: string, line: number) => {
          const source = stringArgument(sourcePath, 'file.rename() source', file, line);
          const destination = stringArgument(destinationPath, 'file.rename() destination', file, line);
          if (!fileSystem.rename) {
            throw new IdylliumRuntimeError(file, line, 'file.rename() is not supported by this runtime');
          }
          try {
            fileSystem.rename(
              fileSystem.resolvePath(source, file),
              fileSystem.resolvePath(destination, file),
            );
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.rename() cannot rename '${source}' to '${destination}': ${errorMessage(error)}`);
          }
        }),
        remove: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const requestedPath = stringArgument(values[0], 'file.remove() path', file, line);
          const recursive = values.length >= 2
            ? booleanArgument(values[1], 'file.remove() recursive', file, line)
            : false;
          if (!fileSystem.remove) {
            throw new IdylliumRuntimeError(file, line, 'file.remove() is not supported by this runtime');
          }
          try {
            fileSystem.remove(fileSystem.resolvePath(requestedPath, file), recursive);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.remove() cannot remove '${requestedPath}': ${errorMessage(error)}`);
          }
        }),
        open: contextFunction((targetPath: string, mode: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.open() path', file, line);
          const openMode = stringArgument(mode, 'file.open() mode', file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          if (openMode === 'read') return createInputFile(resolvedPath, file, line);
          if (openMode === 'write') return createOutputFile(resolvedPath, file, line);
          throw new IdylliumRuntimeError(file, line, `file.open() mode must be 'read' or 'write', got '${openMode}'`);
        }),
      },
      types: {
        from_bin: contextFunction((bits: string, typeName: string, file: string, line: number) => typesFromBin(bits, typeName, file, line)),
        from_hex: contextFunction((hex: string, typeName: string, file: string, line: number) => typesFromHex(hex, typeName, file, line)),
      },
      encoding: {
        list_encodings: contextFunction(() => IdylliumArray.from(['ascii', 'utf-8', 'windows-1251', 'koi8-r'], true, null, () => '')),
        char_to_int: contextFunction((character: string, encoding: string, file: string, line: number) => (
          encodingCharToInt(character, encoding, file, line)
        )),
        int_to_char: contextFunction((code: number, encoding: string, file: string, line: number) => (
          encodingIntToChar(code, encoding, file, line)
        )),
        encode: contextFunction((text: string, encoding: string, file: string, line: number) => (
          IdylliumArray.from(encodingEncode(text, encoding, file, line), true, null, () => 0)
        )),
        decode: contextFunction((codes: unknown, encoding: string, file: string, line: number) => (
          encodingDecode(codes, encoding, file, line)
        )),
      },
      json: {
        is_valid: contextFunction((text: unknown, file: string, line: number) => {
          const source = stringArgument(text, 'json.is_valid() text', file, line);
          try {
            JSON.parse(source);
            return true;
          } catch {
            return false;
          }
        }),
        parse: contextFunction((text: unknown, file: string, line: number) => (
          parseJsonValue(stringArgument(text, 'json.parse() text', file, line), file, line)
        )),
        Value: contextFunction((valueOrFile: unknown, fileOrLine: string | number, maybeLine?: number) => {
          if (maybeLine === undefined) {
            return createJsonValue(undefined, valueOrFile as string, fileOrLine as number);
          }
          return createJsonValue(valueOrFile, fileOrLine as string, maybeLine);
        }),
      },
      sqlite: {
        open: contextFunction(async (path: unknown, file: string, line: number) => (
          openSqliteDatabase(path, file, line, runtimeObjects)
        )),
      },
      audio: {},
      image: {},
      gui: {},
      colors: {
        RGB: contextFunction((red: number, green: number, blue: number, file: string, line: number) => IdylliumColor.RGB(red, green, blue, file, line)),
        RGBA: contextFunction((red: number, green: number, blue: number, alpha: number, file: string, line: number) => IdylliumColor.RGBA(red, green, blue, alpha, file, line)),
        HEX: contextFunction((value: string, file: string, line: number) => IdylliumColor.HEX(value, file, line)),
        HSL: contextFunction((hue: number, saturation: number, lightness: number, file: string, line: number) => IdylliumColor.HSL(hue, saturation, lightness, file, line)),
        BLACK: IdylliumColor.RGB(0, 0, 0),
        WHITE: IdylliumColor.RGB(255, 255, 255),
        RED: IdylliumColor.RGB(255, 0, 0),
        GREEN: IdylliumColor.RGB(0, 255, 0),
        BLUE: IdylliumColor.RGB(0, 0, 255),
        TRANSPARENT: IdylliumColor.RGBA(0, 0, 0, 0),
      },
    },
    createObject(moduleName: string, typeName: string): Record<string, unknown> {
      throwIfRuntimeStopped('', 0);
      return createPlainRuntimeObject(moduleName, typeName, runtimeObjects);
    },
    convertNullable(moduleName: string, typeName: string, value: unknown, file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      if (moduleName === 'json' && typeName === 'Value') {
        return createJsonValue(value, file, line);
      }
      if (moduleName === 'sqlite' && typeName === 'Value') {
        return createSqliteValue(value, file, line);
      }
      throw new IdylliumRuntimeError(file, line, `type '${moduleName}.${typeName}' does not support null`);
    },
    setProperty(target: unknown, propertyName: string, value: unknown, file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      if (target === null || typeof target !== 'object') {
        throw new IdylliumRuntimeError(file, line, `cannot set property '${propertyName}' on '${runtimeTypeName(target)}'`);
      }

      const obj = target as RuntimeObject;
      const setters = runtimePropertySetters(obj);
      const setter = setters[propertyName];
      if (setter) {
        setter(value, file, line);
        return value;
      }

      obj[propertyName] = value;
      return value;
    },
    callModuleFunction(moduleName: string, functionName: string, args: readonly unknown[], file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      const module = (this.modules as Record<string, Record<string, unknown>>)[moduleName];
      if (!module) throw new IdylliumRuntimeError(file, line, `module '${moduleName}' was not found`);
      const fn = module[functionName];
      if (typeof fn !== 'function') {
        throw new IdylliumRuntimeError(file, line, `module '${moduleName}' has no function '${functionName}'`);
      }
      const callable = fn as ContextualRuntimeFunction;
      return callable.__idylliumPassContext ? callable(...args, file, line) : callable(...args);
    },
    callMethod(target: unknown, methodName: string, args: readonly unknown[], file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      if (target instanceof IdylliumArray) {
        return target.callMethod(methodName, args, file, line);
      }

      if (typeof target === 'string') {
        return callStringMethod(target, methodName, args, file, line);
      }

      if (target !== null && typeof target === 'object') {
        const method = (target as Record<string, unknown>)[methodName];
        if (typeof method === 'function') {
          const callable = method as ContextualRuntimeFunction;
          return callable.__idylliumPassContext ? callable.apply(target, [...args, file, line]) : callable.apply(target, [...args]);
        }
      }

      throw new IdylliumRuntimeError(file, line, `object has no method '${methodName}'`);
    },
    getOutput(): string {
      return output;
    },
    getAudio(): readonly IdylliumAudioSnapshot[] {
      return runtimeObjects.audio.map(audioSnapshot);
    },
    getCanvases(): readonly IdylliumCanvasSnapshot[] {
      return runtimeObjects.canvases.map(canvasSnapshot);
    },
    getWindows(): readonly IdylliumWindowSnapshot[] {
      return runtimeObjects.windows.map(windowSnapshot);
    },
    getModals(): readonly IdylliumModalSnapshot[] {
      return runtimeObjects.modals.map(modalSnapshot);
    },
    hasGui(): boolean {
      return runtimeObjects.windows.length > 0
        || runtimeObjects.canvases.length > 0
        || runtimeObjects.modals.length > 0
        || runtimeObjects.audio.some((item) => item.is_playing === true);
    },
    async stepGui(deltaTime = 0): Promise<boolean> {
      throwIfRuntimeStopped('', 0);
      let changed = false;
      for (const timer of runtimeObjects.timers) {
        if (await stepGuiTimer(timer, deltaTime)) changed = true;
      }

      for (const canvas of runtimeObjects.canvases) {
        const onUpdate = canvas.on_update;
        if (typeof onUpdate === 'function') {
          canvas.__commands = [];
          await onUpdate(canvas, deltaTime);
          changed = true;
        }
      }
      return changed;
    },
    async dispatchGuiEvent(canvasId: number, eventName: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
      throwIfRuntimeStopped('', 0);
      const target = runtimeObjects.objects.find((item) => item.__idylliumObjectId === canvasId);
      if (!target) return;

      applyGuiEventPayload(target, eventName, payload, runtimeObjects);
      const callbackName = guiCallbackName(target, eventName);
      if (!callbackName) return;
      const callback = target[callbackName];
      if (typeof callback !== 'function') return;
      if (target.__idylliumType === 'gui.Canvas') {
        await callback(target, guiEventObject(eventName, payload));
        return;
      }
      await callback(target);
    },
  };

  function randomUnit(): number {
    if (randomSeed === null) return Math.random();
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 0x100000000;
  }

  function waitForRuntimeDelay(milliseconds: number, file: string, line: number): Promise<void> {
    const signal = options.abortSignal;
    if (!signal) return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    if (signal.aborted) return Promise.reject(runtimeStoppedError(file, line));

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const cleanup = () => {
        if (timer !== null) clearTimeout(timer);
        signal.removeEventListener?.('abort', onAbort);
      };
      const settle = (error?: IdylliumRuntimeError) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const onAbort = () => settle(runtimeStoppedError(file, line));

      timer = setTimeout(() => settle(), milliseconds);
      signal.addEventListener?.('abort', onAbort, { once: true });
    });
  }

  function throwIfRuntimeStopped(file: string, line: number): void {
    if (options.abortSignal?.aborted) throw runtimeStoppedError(file, line);
  }

  function runtimeStoppedError(file: string, line: number): IdylliumRuntimeError {
    return new IdylliumRuntimeError(file || 'main.idyl', line || 1, 'program was stopped');
  }
}

function expectArray(value: unknown, file: string, line: number): IdylliumArray {
  if (value instanceof IdylliumArray) return value;
  throw new IdylliumRuntimeError(file, line, `expected array, got '${String(value)}'`);
}

function numericValues(value: unknown, functionName: string, file: string, line: number): Array<number | bigint> {
  const array = expectArray(value, file, line);
  const values = array.values();
  if (values.length === 0) {
    throw new IdylliumRuntimeError(file, line, `'${functionName}' cannot be used with an empty array`);
  }

  for (const item of values) {
    if (typeof item !== 'number' && typeof item !== 'bigint') {
      throw new IdylliumRuntimeError(file, line, `'${functionName}' expects a numeric array`);
    }
  }

  return values as Array<number | bigint>;
}

function runtimeBinary(operator: string, left: unknown, right: unknown, file: string, line: number): unknown {
  if (operator === '==') return runtimeEquals(left, right);
  if (operator === '!=') return !runtimeEquals(left, right);

  if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
    return `${String(left)}${String(right)}`;
  }

  const numericLeft = runtimeNumber(left, `operator '${operator}' left operand`, file, line);
  const numericRight = runtimeNumber(right, `operator '${operator}' right operand`, file, line);
  switch (operator) {
    case '+':
      return runtimeAdd(numericLeft, numericRight);
    case '-':
      return runtimeSubtract(numericLeft, numericRight);
    case '*':
      return runtimeMultiply(numericLeft, numericRight);
    case '/':
      return runtimeDivide(numericLeft, numericRight, file, line);
    case '<':
      return runtimeCompare(numericLeft, numericRight) < 0;
    case '<=':
      return runtimeCompare(numericLeft, numericRight) <= 0;
    case '>':
      return runtimeCompare(numericLeft, numericRight) > 0;
    case '>=':
      return runtimeCompare(numericLeft, numericRight) >= 0;
    default:
      throw new IdylliumRuntimeError(file, line, `unknown binary operator '${operator}'`);
  }
}

function runtimeNegate(value: unknown): number | bigint {
  return typeof value === 'bigint' ? -value : -(value as number);
}

function runtimeAdd(left: number | bigint, right: number | bigint): number | bigint {
  const integers = exactIntegerPair(left, right);
  return integers ? integers[0] + integers[1] : Number(left) + Number(right);
}

function runtimeSubtract(left: number | bigint, right: number | bigint): number | bigint {
  const integers = exactIntegerPair(left, right);
  return integers ? integers[0] - integers[1] : Number(left) - Number(right);
}

function runtimeMultiply(left: number | bigint, right: number | bigint): number | bigint {
  const integers = exactIntegerPair(left, right);
  return integers ? integers[0] * integers[1] : Number(left) * Number(right);
}

function runtimeDivide(left: unknown, right: unknown, file: string, line: number): number {
  const dividend = runtimeNumber(left, 'division left operand', file, line);
  const divisor = runtimeNumber(right, 'division right operand', file, line);
  if (divisor === 0 || divisor === 0n) throw new IdylliumRuntimeError(file, line, 'division by zero');
  return Number(dividend) / Number(divisor);
}

function runtimeIntegerDivision(left: unknown, right: unknown, file: string, line: number): number | bigint {
  const dividend = runtimeNumber(left, 'div() left operand', file, line);
  const divisor = runtimeNumber(right, 'div() right operand', file, line);
  if (divisor === 0 || divisor === 0n) throw new IdylliumRuntimeError(file, line, 'division by zero');
  const integers = exactIntegerPair(dividend, divisor);
  return integers ? integers[0] / integers[1] : Math.trunc(Number(dividend) / Number(divisor));
}

function runtimeModulo(left: unknown, right: unknown, file: string, line: number): number | bigint {
  const dividend = runtimeNumber(left, 'mod() left operand', file, line);
  const divisor = runtimeNumber(right, 'mod() right operand', file, line);
  if (divisor === 0 || divisor === 0n) throw new IdylliumRuntimeError(file, line, 'division by zero');
  const integers = exactIntegerPair(dividend, divisor);
  return integers ? integers[0] % integers[1] : Number(dividend) % Number(divisor);
}

function runtimeCompare(left: number | bigint, right: number | bigint): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function runtimeEquals(left: unknown, right: unknown): boolean {
  const leftIsNull = left === null || isRuntimeNullValue(left);
  const rightIsNull = right === null || isRuntimeNullValue(right);
  if (leftIsNull || rightIsNull) return leftIsNull && rightIsNull;

  if (left instanceof IdylliumArray || right instanceof IdylliumArray) {
    if (!(left instanceof IdylliumArray) || !(right instanceof IdylliumArray)) return false;
    const leftValues = left.values();
    const rightValues = right.values();
    return leftValues.length === rightValues.length
      && leftValues.every((value, index) => runtimeEquals(value, rightValues[index]));
  }
  if (typeof left === 'bigint' && typeof right === 'number' && Number.isInteger(right)) {
    return left === BigInt(right);
  }
  if (typeof right === 'bigint' && typeof left === 'number' && Number.isInteger(left)) {
    return BigInt(left) === right;
  }
  return Object.is(left, right) || left === right;
}

function isRuntimeNullValue(value: unknown): boolean {
  return (isJsonRuntimeValue(value) && value.__jsonKind === 'null')
    || (isSqliteRuntimeValue(value) && value.__sqliteKind === 'null');
}

function exactIntegerPair(left: number | bigint, right: number | bigint): readonly [bigint, bigint] | null {
  if (typeof left !== 'bigint' && typeof right !== 'bigint') return null;
  if (typeof left === 'number' && !Number.isInteger(left)) return null;
  if (typeof right === 'number' && !Number.isInteger(right)) return null;
  return [BigInt(left), BigInt(right)];
}

function runtimeNumber(value: unknown, argumentName: string, file: string, line: number): number | bigint {
  if (typeof value === 'bigint') return value;
  return finiteNumber(value, argumentName, file, line);
}

function callStringMethod(
  value: string,
  methodName: string,
  args: readonly unknown[],
  file: string,
  line: number,
): unknown {
  switch (methodName) {
    case 'length':
      return Array.from(value).length;
    case 'contains':
      return findInString(value, searchText(args[0], methodName, file, line)) >= 0;
    case 'find':
      return findInString(value, searchText(args[0], methodName, file, line));
    case 'count':
      return countInString(value, searchText(args[0], methodName, file, line));
    case 'is_int':
      return /^[+-]?\d+$/u.test(value.trim());
    case 'is_float':
      return /^[+-]?(?:\d+\.\d+|\d+\.|\.\d+)$/u.test(value.trim());
    case 'to_upper':
      return value.toLocaleUpperCase();
    case 'to_lower':
      return value.toLocaleLowerCase();
    case 'substring':
      return substringByCharacters(
        value,
        intArgument(args[0], 'substring start', file, line),
        intArgument(args[1], 'substring length', file, line),
        file,
        line,
      );
    case 'replace':
      return replaceAllText(
        value,
        stringArgument(args[0], 'replace old_text', file, line),
        stringArgument(args[1], 'replace new_text', file, line),
        file,
        line,
      );
    case 'split':
      return splitString(value, stringArgument(args[0], 'split separator', file, line));
    case 'trim':
      return value.trim();
    default:
      throw new IdylliumRuntimeError(file, line, `type 'string' has no method '${methodName}'`);
  }
}

function stringCharAt(value: string, rawIndex: unknown, file: string, line: number): string {
  const chars = Array.from(value);
  const index = integerNumber(rawIndex, 'string index', file, line);
  if (index < 0 || index >= chars.length) {
    throw new IdylliumRuntimeError(file, line, `string index ${index} out of bounds (length ${chars.length}, valid indices ${validRange(chars.length)})`);
  }
  return chars[index];
}

function searchText(value: unknown, methodName: string, file: string, line: number): string {
  if (typeof value === 'string') return value;
  throw new IdylliumRuntimeError(file, line, `string method '${methodName}' expects string or char`);
}

function stringArgument(value: unknown, argumentName: string, file: string, line: number): string {
  if (typeof value === 'string') return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be string`);
}

function resolveRuntimePath(requestedPath: string, sourceFile: string): string {
  if (nodePath.isAbsolute(requestedPath)) return nodePath.normalize(requestedPath);
  const base = sourceFile.trim() === '' ? process.cwd() : nodePath.dirname(sourceFile);
  return nodePath.resolve(base, requestedPath);
}

function createNodeRuntimeFileSystem(projectRoot?: string): RuntimeFileSystem {
  let mutationRoot = projectRoot ? nodePath.resolve(projectRoot) : null;
  const mutationPath = (filePath: string, operation: string): string => (
    assertNodeProjectPath(mutationRoot ?? process.cwd(), filePath, operation)
  );
  return {
    resolvePath(requestedPath: string, sourceFile: string): string {
      if (!mutationRoot) {
        mutationRoot = sourceFile.trim() !== '' && nodePath.isAbsolute(sourceFile)
          ? nodePath.dirname(nodePath.normalize(sourceFile))
          : process.cwd();
      }
      return resolveRuntimePath(requestedPath, sourceFile);
    },
    exists(filePath: string): boolean {
      return nodeFs.existsSync(filePath);
    },
    isFile(filePath: string): boolean {
      return nodeFs.statSync(filePath).isFile();
    },
    isDirectory(filePath: string): boolean {
      return nodeFs.statSync(filePath).isDirectory();
    },
    readText(filePath: string): string {
      return nodeFs.readFileSync(filePath, 'utf8');
    },
    writeText(filePath: string, text: string): void {
      nodeFs.writeFileSync(mutationPath(filePath, 'file write'), text, 'utf8');
    },
    appendText(filePath: string, text: string): void {
      nodeFs.appendFileSync(mutationPath(filePath, 'file write'), text, 'utf8');
    },
    createDirectory(filePath: string, parents: boolean): void {
      const target = mutationPath(filePath, 'file.create_directory()');
      if (nodeFs.existsSync(target)) throw new Error(`path already exists: ${target}`);
      nodeFs.mkdirSync(target, { recursive: parents });
    },
    listDirectory(filePath: string): readonly string[] {
      if (!nodeFs.existsSync(filePath)) throw new Error(`directory does not exist: ${filePath}`);
      if (!nodeFs.statSync(filePath).isDirectory()) throw new Error(`path is not a directory: ${filePath}`);
      return nodeFs.readdirSync(filePath).sort((left: string, right: string) => left.localeCompare(right));
    },
    copy(sourcePath: string, destinationPath: string): void {
      const root = mutationRoot ?? process.cwd();
      const source = mutationPath(sourcePath, 'file.copy()');
      const destination = mutationPath(destinationPath, 'file.copy()');
      assertNodeMovableSource(root, source, 'file.copy()');
      assertNodeDestination(destination);
      assertNodeTreeHasNoSymlinks(source, 'file.copy()');
      if (nodeFs.statSync(source).isDirectory() && isNodePathWithin(source, destination)) {
        throw new Error('cannot copy a directory inside itself');
      }
      copyNodeEntry(source, destination);
    },
    rename(sourcePath: string, destinationPath: string): void {
      const root = mutationRoot ?? process.cwd();
      const source = mutationPath(sourcePath, 'file.rename()');
      const destination = mutationPath(destinationPath, 'file.rename()');
      assertNodeMovableSource(root, source, 'file.rename()');
      assertNodeDestination(destination);
      assertNodeTreeHasNoSymlinks(source, 'file.rename()');
      if (nodeFs.statSync(source).isDirectory() && isNodePathWithin(source, destination)) {
        throw new Error('cannot move a directory inside itself');
      }
      nodeFs.renameSync(source, destination);
    },
    remove(filePath: string, recursive: boolean): void {
      const root = mutationRoot ?? process.cwd();
      const target = mutationPath(filePath, 'file.remove()');
      assertNodeMovableSource(root, target, 'file.remove()');
      assertNodeTreeHasNoSymlinks(target, 'file.remove()');
      const stat = nodeFs.statSync(target);
      if (stat.isDirectory()) {
        if (recursive) nodeFs.rmSync(target, { recursive: true, force: false });
        else nodeFs.rmdirSync(target);
      } else if (stat.isFile()) {
        nodeFs.unlinkSync(target);
      } else {
        throw new Error(`unsupported file-system object: ${target}`);
      }
    },
    readBytes(filePath: string): Uint8Array {
      return new Uint8Array(nodeFs.readFileSync(filePath));
    },
    writeBytes(filePath: string, bytes: Uint8Array): void {
      nodeFs.writeFileSync(mutationPath(filePath, 'binary file write'), bytes);
    },
    resourceUri(filePath: string): string {
      return filePath;
    },
  };
}

function runtimeDirname(filePath: string): string {
  return filePath.includes('\\') ? memoryDirname(filePath) : nodePath.dirname(filePath);
}

function runtimeIsFile(
  fileSystem: RuntimeFileSystem,
  filePath: string,
  sourceFile: string,
  line: number,
  mode: 'reading' | 'writing',
): boolean {
  try {
    return fileSystem.isFile(filePath);
  } catch (error) {
    throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for ${mode}: ${errorMessage(error)}`);
  }
}

function runtimeIsDirectory(
  fileSystem: RuntimeFileSystem,
  filePath: string,
  sourceFile: string,
  line: number,
  mode: 'reading' | 'writing',
): boolean {
  try {
    return fileSystem.isDirectory(filePath);
  } catch (error) {
    throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for ${mode}: ${errorMessage(error)}`);
  }
}

function normalizeMemoryPath(value: string, base = '/workspace'): string {
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

function memoryDirname(filePath: string): string {
  const normalized = normalizeMemoryPath(filePath);
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}

function memoryBasename(filePath: string): string {
  const normalized = normalizeMemoryPath(filePath);
  if (normalized === '/') return '/';
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function assertMemoryProjectPath(filePath: string, root: string, operation: string): void {
  if (filePath === root || filePath.startsWith(`${root}/`)) return;
  throw new Error(`${operation} path is outside the project: ${filePath}`);
}

function assertMemoryMovableSource(filePath: string, root: string, operation: string): void {
  if (filePath === root) throw new Error(`${operation} cannot modify the project root`);
}

function assertMemoryDestinationAvailable(
  files: ReadonlyMap<string, unknown>,
  directories: ReadonlySet<string>,
  destination: string,
): void {
  if (files.has(destination) || directories.has(destination)) {
    throw new Error(`destination already exists: ${destination}`);
  }
}

function assertMemoryDestinationParent(directories: ReadonlySet<string>, destination: string): void {
  const parent = memoryDirname(destination);
  if (!directories.has(parent)) throw new Error(`directory does not exist: ${parent}`);
}

function cloneMemoryFile(
  file: { content: string; bytes?: Uint8Array; resourceUri: string | null },
): { content: string; bytes?: Uint8Array; resourceUri: string | null } {
  return {
    content: file.content,
    bytes: file.bytes ? new Uint8Array(file.bytes) : undefined,
    resourceUri: file.resourceUri,
  };
}

function assertNodeProjectPath(root: string, filePath: string, operation: string): string {
  const candidate = nodePath.resolve(filePath);
  if (!isNodePathWithin(root, candidate)) {
    throw new Error(`${operation} path is outside the project: ${candidate}`);
  }

  let existing = candidate;
  while (!nodeFs.existsSync(existing)) {
    const parent = nodePath.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  const realRoot = nodeFs.realpathSync(root);
  const realExisting = nodeFs.realpathSync(existing);
  if (!isNodePathWithin(realRoot, realExisting)) {
    throw new Error(`${operation} path escapes the project through a symbolic link: ${candidate}`);
  }
  return candidate;
}

function isNodePathWithin(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !nodePath.isAbsolute(relative));
}

function assertNodeMovableSource(root: string, source: string, operation: string): void {
  if (source === root) throw new Error(`${operation} cannot modify the project root`);
  if (!nodeFs.existsSync(source)) throw new Error(`path does not exist: ${source}`);
}

function assertNodeDestination(destination: string): void {
  if (nodeFs.existsSync(destination)) throw new Error(`destination already exists: ${destination}`);
  const parent = nodePath.dirname(destination);
  if (!nodeFs.existsSync(parent)) throw new Error(`directory does not exist: ${parent}`);
  if (!nodeFs.statSync(parent).isDirectory()) throw new Error(`path is not a directory: ${parent}`);
}

function assertNodeTreeHasNoSymlinks(filePath: string, operation: string): void {
  const stat = nodeFs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`${operation} does not support symbolic links: ${filePath}`);
  if (!stat.isDirectory()) return;
  for (const name of nodeFs.readdirSync(filePath)) {
    assertNodeTreeHasNoSymlinks(nodePath.join(filePath, name), operation);
  }
}

function copyNodeEntry(source: string, destination: string): void {
  const stat = nodeFs.lstatSync(source);
  if (stat.isDirectory()) {
    nodeFs.mkdirSync(destination);
    for (const name of nodeFs.readdirSync(source)) {
      copyNodeEntry(nodePath.join(source, name), nodePath.join(destination, name));
    }
    return;
  }
  if (stat.isFile()) {
    nodeFs.copyFileSync(source, destination);
    return;
  }
  throw new Error(`unsupported file-system object: ${source}`);
}

function addMemoryDirectory(directories: Set<string>, directory: string): void {
  const normalized = normalizeMemoryPath(directory);
  if (directories.has(normalized)) return;
  const parent = memoryDirname(normalized);
  if (parent !== normalized) addMemoryDirectory(directories, parent);
  directories.add(normalized);
}

function splitFileLines(source: string): string[] {
  if (source.length === 0) return [];
  const matches = source.match(/.*(?:\r\n|\n|$)/gu) ?? [];
  return matches.filter((line, index) => line.length > 0 || index < matches.length - 1);
}

function splitContextArgs(args: readonly unknown[]): { values: readonly unknown[]; file: string; line: number } {
  const file = args[args.length - 2];
  const line = args[args.length - 1];
  return {
    values: args.slice(0, -2),
    file: typeof file === 'string' ? file : 'runtime',
    line: typeof line === 'number' ? line : 0,
  };
}

function expectOpen(isOpen: boolean, operationName: string, file: string, line: number): void {
  if (!isOpen) {
    throw new IdylliumRuntimeError(file, line, `${operationName} cannot be used after close()`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function intArgument(value: unknown, argumentName: string, file: string, line: number): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be int`);
}

function booleanArgument(value: unknown, argumentName: string, file: string, line: number): boolean {
  if (typeof value === 'boolean') return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be bool`);
}

function findInString(value: string, needle: string): number {
  const chars = Array.from(value);
  const needleChars = Array.from(needle);
  if (needleChars.length === 0) return 0;

  for (let i = 0; i <= chars.length - needleChars.length; i++) {
    if (needleChars.every((char, offset) => chars[i + offset] === char)) {
      return i;
    }
  }

  return -1;
}

function countInString(value: string, needle: string): number {
  const chars = Array.from(value);
  const needleChars = Array.from(needle);
  if (needleChars.length === 0) return 0;

  let count = 0;
  let index = 0;
  while (index <= chars.length - needleChars.length) {
    if (needleChars.every((char, offset) => chars[index + offset] === char)) {
      count++;
      index += needleChars.length;
    } else {
      index++;
    }
  }
  return count;
}

function substringByCharacters(value: string, start: number, length: number, file: string, line: number): string {
  const chars = Array.from(value);
  if (start < 0) {
    throw new IdylliumRuntimeError(file, line, `substring start must be non-negative, got ${start}`);
  }
  if (length < 0) {
    throw new IdylliumRuntimeError(file, line, `substring length must be non-negative, got ${length}`);
  }
  if (start > chars.length) {
    throw new IdylliumRuntimeError(file, line, `substring start ${start} out of bounds (length ${chars.length}, valid indices ${validRange(chars.length)})`);
  }
  return chars.slice(start, start + length).join('');
}

function replaceAllText(value: string, oldText: string, newText: string, file: string, line: number): string {
  if (oldText.length === 0) {
    throw new IdylliumRuntimeError(file, line, 'replace old_text must not be empty');
  }
  return value.split(oldText).join(newText);
}

function splitString(value: string, separator: string): IdylliumArray {
  const parts = separator.length === 0 ? Array.from(value) : value.split(separator);
  return IdylliumArray.from(parts, true, null, () => '');
}

type RuntimeEncoding = 'ascii' | 'utf-8' | 'windows-1251' | 'koi8-r';

interface SingleByteEncoding {
  readonly charToByte: ReadonlyMap<string, number>;
  readonly byteToChar: ReadonlyMap<number, string>;
}

const WINDOWS_1251_ENCODING = buildSingleByteEncoding([
  [0xA8, '\u0401'],
  [0xB8, '\u0451'],
  ...sequentialEntries(0xC0, '\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042C\u042D\u042E\u042F'),
  ...sequentialEntries(0xE0, '\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F'),
]);

const KOI8_R_ENCODING = buildSingleByteEncoding([
  [0xA3, '\u0451'],
  [0xB3, '\u0401'],
  ...sequentialEntries(0xC0, '\u044E\u0430\u0431\u0446\u0434\u0435\u0444\u0433\u0445\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F\u044F\u0440\u0441\u0442\u0443\u0436\u0432\u044C\u044B\u0437\u0448\u044D\u0449\u0447\u044A'),
  ...sequentialEntries(0xE0, '\u042E\u0410\u0411\u0426\u0414\u0415\u0424\u0413\u0425\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u042F\u0420\u0421\u0422\u0423\u0416\u0412\u042C\u042B\u0417\u0428\u042D\u0429\u0427\u042A'),
]);

function encodingCharToInt(character: unknown, encoding: unknown, file: string, line: number): number {
  const char = singleCharacter(character, 'encoding.char_to_int() character', file, line);
  const name = normalizeEncoding(encoding, file, line);

  if (name === 'ascii') return asciiCode(char, file, line);
  if (name === 'utf-8') return char.codePointAt(0) ?? 0;
  return singleByteCharToInt(char, name === 'windows-1251' ? WINDOWS_1251_ENCODING : KOI8_R_ENCODING, name, file, line);
}

function encodingIntToChar(code: unknown, encoding: unknown, file: string, line: number): string {
  const value = integerNumber(code, 'encoding.int_to_char() code', file, line);
  const name = normalizeEncoding(encoding, file, line);

  if (name === 'ascii') {
    byteRange(value, 'encoding.int_to_char() code', 0, 127, file, line);
    return String.fromCodePoint(value);
  }
  if (name === 'utf-8') {
    if (value < 0 || value > 0x10FFFF) {
      throw new IdylliumRuntimeError(file, line, `encoding.int_to_char() code must be between 0 and 1114111, got ${value}`);
    }
    return String.fromCodePoint(value);
  }

  return singleByteIntToChar(value, name === 'windows-1251' ? WINDOWS_1251_ENCODING : KOI8_R_ENCODING, name, file, line);
}

function encodingEncode(text: unknown, encoding: unknown, file: string, line: number): number[] {
  const value = stringArgument(text, 'encoding.encode() text', file, line);
  const name = normalizeEncoding(encoding, file, line);

  if (name === 'ascii') return Array.from(value).map((char) => asciiCode(char, file, line));
  if (name === 'utf-8') return [...nodeBuffer.from(value, 'utf8')];

  const table = name === 'windows-1251' ? WINDOWS_1251_ENCODING : KOI8_R_ENCODING;
  return Array.from(value).map((char) => singleByteCharToInt(char, table, name, file, line));
}

function encodingDecode(codes: unknown, encoding: unknown, file: string, line: number): string {
  const array = expectArray(codes, file, line);
  const name = normalizeEncoding(encoding, file, line);
  const bytes = array.values().map((code) => integerNumber(code, 'encoding.decode() code', file, line));

  if (name === 'ascii') {
    return bytes.map((code) => {
      byteRange(code, 'encoding.decode() code', 0, 127, file, line);
      return String.fromCodePoint(code);
    }).join('');
  }

  if (name === 'utf-8') {
    for (const code of bytes) {
      byteRange(code, 'encoding.decode() code', 0, 255, file, line);
    }
    return nodeBuffer.from(bytes).toString('utf8');
  }

  const table = name === 'windows-1251' ? WINDOWS_1251_ENCODING : KOI8_R_ENCODING;
  return bytes.map((code) => singleByteIntToChar(code, table, name, file, line)).join('');
}

function normalizeEncoding(value: unknown, file: string, line: number): RuntimeEncoding {
  const name = stringArgument(value, 'encoding name', file, line).toLowerCase();
  if (name === 'ascii') return 'ascii';
  if (name === 'utf-8' || name === 'utf8') return 'utf-8';
  if (name === 'windows-1251' || name === 'cp1251' || name === 'win1251') return 'windows-1251';
  if (name === 'koi8-r' || name === 'koi8r') return 'koi8-r';
  throw new IdylliumRuntimeError(file, line, `unknown encoding '${value}'`);
}

function singleCharacter(value: unknown, argumentName: string, file: string, line: number): string {
  const text = stringArgument(value, argumentName, file, line);
  const chars = Array.from(text);
  if (chars.length !== 1) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must contain exactly one character, got ${JSON.stringify(text)}`);
  }
  return chars[0];
}

function asciiCode(char: string, file: string, line: number): number {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 127) return code;
  throw new IdylliumRuntimeError(file, line, `character '${char}' is not valid ASCII`);
}

function singleByteCharToInt(char: string, table: SingleByteEncoding, encoding: RuntimeEncoding, file: string, line: number): number {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 127) return code;
  const byte = table.charToByte.get(char);
  if (byte !== undefined) return byte;
  throw new IdylliumRuntimeError(file, line, `character '${char}' is not valid ${encoding}`);
}

function singleByteIntToChar(code: number, table: SingleByteEncoding, encoding: RuntimeEncoding, file: string, line: number): string {
  byteRange(code, 'encoding code', 0, 255, file, line);
  if (code <= 127) return String.fromCodePoint(code);
  const char = table.byteToChar.get(code);
  if (char !== undefined) return char;
  throw new IdylliumRuntimeError(file, line, `byte ${code} is not valid ${encoding}`);
}

function byteRange(value: number, argumentName: string, min: number, max: number, file: string, line: number): number {
  if (value < min || value > max) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between ${min} and ${max}, got ${value}`);
  }
  return value;
}

function buildSingleByteEncoding(entries: readonly (readonly [number, string])[]): SingleByteEncoding {
  const charToByte = new Map<string, number>();
  const byteToChar = new Map<number, string>();
  for (const [byte, char] of entries) {
    charToByte.set(char, byte);
    byteToChar.set(byte, char);
  }
  return { charToByte, byteToChar };
}

function sequentialEntries(start: number, chars: string): Array<readonly [number, string]> {
  return Array.from(chars).map((char, index) => [start + index, char] as const);
}

type RuntimeTypesName = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'int64' | 'uint64' | 'float32' | 'float64';

interface RuntimeTypesSpec {
  readonly kind: 'integer' | 'float';
  readonly bits: number;
  readonly signed: boolean;
}

const RUNTIME_TYPES: Record<RuntimeTypesName, RuntimeTypesSpec> = {
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

function castTypesValue(value: unknown, typeName: string): number | bigint {
  const name = normalizeRuntimeTypesName(typeName, 'types', 0);
  const spec = RUNTIME_TYPES[name];

  if (spec.kind === 'float') {
    if (typeof value !== 'number') {
      throw new IdylliumRuntimeError('types', 0, `types.${name} value must be a number, got '${String(value)}'`);
    }
    const number = value;
    return name === 'float32' ? Math.fround(number) : number;
  }

  const integer = runtimeInteger(value, `types.${name} value`, 'types', 0);
  if (spec.bits === 64) return wrapBigInteger(integer, spec);
  return wrapInteger(integer, spec);
}

function typesToBin(value: unknown, typeName: string): string {
  const name = normalizeRuntimeTypesName(typeName, 'types', 0);
  const spec = RUNTIME_TYPES[name];
  if (spec.kind === 'float') {
    return bytesToBinary(floatBytes(Number(castTypesValue(value, name)), name));
  }

  return integerToUnsigned(value, name).toString(2).padStart(spec.bits, '0');
}

function typesToHex(value: unknown, typeName: string): string {
  const name = normalizeRuntimeTypesName(typeName, 'types', 0);
  const spec = RUNTIME_TYPES[name];
  if (spec.kind === 'float') {
    return bytesToHex(floatBytes(Number(castTypesValue(value, name)), name));
  }

  return integerToUnsigned(value, name).toString(16).padStart(spec.bits / 4, '0').toUpperCase();
}

function typesShift(
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

  const source = typesToBin(value, name);
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
  return castTypesValue(BigInt(`0b${shifted}`), name);
}

function typesFromBin(bits: unknown, typeName: unknown, file: string, line: number): number | bigint {
  const name = normalizeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  const normalized = normalizedBinary(bits, spec.bits, file, line);
  if (spec.kind === 'float') {
    return floatFromBytes(binaryToBytes(normalized), name);
  }
  return castTypesValue(BigInt(`0b${normalized}`), name);
}

function typesFromHex(hex: unknown, typeName: unknown, file: string, line: number): number | bigint {
  const name = normalizeTypesName(typeName, file, line);
  const spec = RUNTIME_TYPES[name];
  const normalized = normalizedHex(hex, spec.bits, file, line);
  if (spec.kind === 'float') {
    return floatFromBytes(hexToBytes(normalized), name);
  }
  return castTypesValue(BigInt(`0x${normalized}`), name);
}

function normalizeTypesName(value: unknown, file: string, line: number): RuntimeTypesName {
  return normalizeRuntimeTypesName(stringArgument(value, 'types type name', file, line), file, line);
}

function normalizeRuntimeTypesName(value: string, file: string, line: number): RuntimeTypesName {
  const name = value.trim().toLowerCase().replace(/^types\./u, '');
  if (Object.prototype.hasOwnProperty.call(RUNTIME_TYPES, name)) {
    return name as RuntimeTypesName;
  }
  throw new IdylliumRuntimeError(file, line, `unknown types numeric type '${value}'`);
}

function wrapInteger(value: bigint, spec: RuntimeTypesSpec): number {
  const modulo = 1n << BigInt(spec.bits);
  let wrapped = ((value % modulo) + modulo) % modulo;
  const signBit = 1n << BigInt(spec.bits - 1);
  if (spec.signed && wrapped >= signBit) {
    wrapped -= modulo;
  }
  return Number(wrapped);
}

function wrapBigInteger(value: bigint, spec: RuntimeTypesSpec): bigint {
  const modulo = 1n << BigInt(spec.bits);
  let wrapped = ((value % modulo) + modulo) % modulo;
  const signBit = 1n << BigInt(spec.bits - 1);
  if (spec.signed && wrapped >= signBit) wrapped -= modulo;
  return wrapped;
}

function integerToUnsigned(value: unknown, typeName: RuntimeTypesName): number | bigint {
  const spec = RUNTIME_TYPES[typeName];
  const casted = castTypesValue(value, typeName);
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

function bytesToBinary(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(2).padStart(8, '0')).join('');
}

function bytesToHex(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function floatBytes(value: number, typeName: RuntimeTypesName): number[] {
  if (typeName === 'float32') {
    const buffer = nodeBuffer.alloc(4);
    buffer.writeFloatBE(Math.fround(value), 0);
    return [...buffer];
  }

  const buffer = nodeBuffer.alloc(8);
  buffer.writeDoubleBE(value, 0);
  return [...buffer];
}

function floatFromBytes(bytes: readonly number[], typeName: RuntimeTypesName): number {
  const buffer = nodeBuffer.from(bytes);
  if (typeName === 'float32') return Math.fround(buffer.readFloatBE(0));
  return buffer.readDoubleBE(0);
}

function roundWithPrecision(value: number, digits: number | undefined, file: string, line: number): number {
  const number = finiteNumber(value, 'math.round() value', file, line);
  if (digits === undefined) return Math.round(number);
  const safeDigits = precisionDigits(digits, 'math.round() digits', file, line);
  const factor = 10 ** safeDigits;
  return Number((Math.round(number * factor) / factor).toFixed(safeDigits));
}

function floorWithPrecision(value: number, digits: number | undefined, file: string, line: number): number {
  const number = finiteNumber(value, 'math.floor() value', file, line);
  if (digits === undefined) return Math.floor(number);
  const safeDigits = precisionDigits(digits, 'math.floor() digits', file, line);
  const factor = 10 ** safeDigits;
  return Number((Math.floor(number * factor) / factor).toFixed(safeDigits));
}

function ceilWithPrecision(value: number, digits: number | undefined, file: string, line: number): number {
  const number = finiteNumber(value, 'math.ceil() value', file, line);
  if (digits === undefined) return Math.ceil(number);
  const safeDigits = precisionDigits(digits, 'math.ceil() digits', file, line);
  const factor = 10 ** safeDigits;
  return Number((Math.ceil(number * factor) / factor).toFixed(safeDigits));
}

function parseIntegerText(value: string, functionName: string, file: string, line: number): number {
  const normalized = value.trim();
  if (!/^[+-]?\d+$/u.test(normalized)) {
    throw new IdylliumRuntimeError(file, line, `${functionName} cannot convert '${value}' to int`);
  }
  return Number.parseInt(normalized, 10);
}

function parseFloatText(value: string, functionName: string, file: string, line: number): number {
  const normalized = value.trim();
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))$/u.test(normalized)) {
    throw new IdylliumRuntimeError(file, line, `${functionName} cannot convert '${value}' to float`);
  }
  return Number.parseFloat(normalized);
}

function finiteNumber(value: unknown, argumentName: string, file: string, line: number): number {
  if (typeof value === 'bigint') {
    const converted = Number(value);
    if (Number.isFinite(converted)) return converted;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be a finite number, got '${String(value)}'`);
}

function runtimeInteger(value: unknown, argumentName: string, file: string, line: number): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be an integer, got '${String(value)}'`);
}

function integerNumber(value: unknown, argumentName: string, file: string, line: number): number {
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

function precisionDigits(value: unknown, argumentName: string, file: string, line: number): number {
  const digits = integerNumber(value, argumentName, file, line);
  if (digits < 0 || digits > 25) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between 0 and 25, got ${digits}`);
  }
  return digits;
}

function optionalNumberContext(
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

function rangeNumber(value: unknown, argumentName: string, min: number, max: number, file: string, line: number): number {
  const number = finiteNumber(value, argumentName, file, line);
  if (number < min || number > max) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between ${min} and ${max}, got ${number}`);
  }
  return number;
}

function finiteMathResult(value: number, functionName: string, file: string, line: number): number {
  if (Number.isFinite(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${functionName} result is not a finite number`);
}

function validRange(length: number): string {
  if (length === 0) return 'none';
  return `0-${length - 1}`;
}

function formatForConsole(value: unknown, precision: number | null): string {
  if (value instanceof IdylliumArray) return value.toInspectString();
  if (isJsonRuntimeValue(value)) return jsonSerialize(value, 0);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && precision !== null) {
    return Number(value.toFixed(precision)).toString();
  }
  return String(value);
}

function formatForInspect(value: unknown): string {
  if (value instanceof IdylliumArray) return value.toInspectString();
  if (isJsonRuntimeValue(value)) return jsonSerialize(value, 0);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function runtimeStat(filePath: string, sourceFile: string, line: number, mode: 'reading' | 'writing'): any {
  try {
    return nodeFs.statSync(filePath);
  } catch (error) {
    throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${filePath}' for ${mode}: ${errorMessage(error)}`);
  }
}

interface RuntimeObjectState {
  readonly objects: RuntimeObject[];
  readonly audio: RuntimeObject[];
  readonly canvases: RuntimeObject[];
  readonly fileSystem: RuntimeFileSystem;
  readonly fontMetricsService: RuntimeFontMetricsService;
  readonly imageService?: RuntimeImageService;
  readonly sqliteService?: RuntimeSqliteService;
  readonly modals: RuntimeObject[];
  readonly timers: RuntimeObject[];
  readonly windows: RuntimeObject[];
  nextAudioCommandId: number;
  nextObjectId: number;
}

type RuntimeObject = Record<string, unknown>;
type RuntimePropertySetter = (value: unknown, file: string, line: number) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function defineTrackedRuntimeProperty(obj: RuntimeObject, name: string, defaultValue: unknown): void {
  const values = trackedRuntimePropertyValues(obj);
  values[name] = defaultValue;
  Object.defineProperty(obj, name, {
    enumerable: true,
    configurable: true,
    get() {
      return values[name];
    },
    set(value: unknown) {
      values[name] = value;
      explicitRuntimeProperties(obj).add(name);
    },
  });
}

function setTrackedRuntimePropertyDefault(obj: RuntimeObject, name: string, value: unknown): void {
  const values = obj.__trackedPropertyValues;
  if (isPlainObject(values) && Object.prototype.hasOwnProperty.call(values, name)) {
    values[name] = value;
    return;
  }
  defineTrackedRuntimeProperty(obj, name, value);
}

function trackedRuntimePropertyValues(obj: RuntimeObject): Record<string, unknown> {
  if (isPlainObject(obj.__trackedPropertyValues)) return obj.__trackedPropertyValues as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  Object.defineProperty(obj, '__trackedPropertyValues', {
    value: values,
    enumerable: false,
    configurable: true,
  });
  return values;
}

function explicitRuntimeProperties(obj: RuntimeObject): Set<string> {
  if (obj.__explicitProperties instanceof Set) return obj.__explicitProperties as Set<string>;
  const properties = new Set<string>();
  Object.defineProperty(obj, '__explicitProperties', {
    value: properties,
    enumerable: false,
    configurable: true,
  });
  return properties;
}

function runtimePropertySetters(obj: RuntimeObject): Record<string, RuntimePropertySetter> {
  if (isPlainObject(obj.__runtimePropertySetters)) return obj.__runtimePropertySetters as Record<string, RuntimePropertySetter>;
  const setters: Record<string, RuntimePropertySetter> = {};
  Object.defineProperty(obj, '__runtimePropertySetters', {
    value: setters,
    enumerable: false,
    configurable: true,
  });
  return setters;
}

function defineValidatedRuntimeProperty(
  obj: RuntimeObject,
  name: string,
  defaultValue: unknown,
  validator: (value: unknown, file: string, line: number) => unknown,
): void {
  const values = trackedRuntimePropertyValues(obj);
  values[name] = defaultValue;
  runtimePropertySetters(obj)[name] = (value: unknown, file: string, line: number) => {
    values[name] = validator(value, file, line);
    explicitRuntimeProperties(obj).add(name);
  };
  Object.defineProperty(obj, name, {
    enumerable: true,
    configurable: true,
    get() {
      return values[name];
    },
    set(value: unknown) {
      values[name] = validator(value, 'runtime', 0);
      explicitRuntimeProperties(obj).add(name);
    },
  });
}

function createPlainRuntimeObject(moduleName: string, typeName: string, state: RuntimeObjectState): RuntimeObject {
  if (moduleName === 'json') {
    if (typeName === 'Value') return createJsonValue();
    if (typeName === 'Object') return createJsonObject();
    if (typeName === 'Array') return createJsonArray();
  }

  if (moduleName === 'sqlite') {
    if (typeName === 'Value') return createSqliteValue();
    if (typeName === 'Database') return createClosedSqliteDatabase(state);
    if (typeName === 'Statement') return createClosedSqliteStatement();
    if (typeName === 'Result') return createClosedSqliteResult();
  }

  const obj: Record<string, unknown> = {
    __idylliumObjectId: state.nextObjectId++,
    __idylliumType: `${moduleName}.${typeName}`,
  };
  state.objects.push(obj);

  if (moduleName === 'gui') {
    initializeGuiObject(obj, typeName, state);
  }

  if (moduleName === 'drawable') {
    initializeDrawableObject(obj, typeName, state);
  }

  if (moduleName === 'fonts') {
    initializeFontObject(obj, typeName, state);
  }

  if (moduleName === 'audio') {
    initializeAudioObject(obj, typeName, state);
  }

  if (moduleName === 'image') {
    initializeImageObject(obj, typeName, state);
  }

  return obj;
}

function initializeGuiObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (isGuiWidget(typeName)) {
    obj.x = 0;
    obj.y = 0;
    const size = defaultGuiWidgetSize(typeName);
    obj.width = size.width;
    obj.height = size.height;
    obj.visible = true;
    defineTrackedRuntimeProperty(obj, 'text_color', colorBlack());
    defineTrackedRuntimeProperty(obj, 'background_color', colorTransparent());
    defineTrackedRuntimeProperty(obj, 'font', null);
  }

  if (typeName === 'Window' || typeName === 'Frame') {
    obj.__children = [];
    obj.add_child = contextFunction((child: unknown, file: string, line: number) => {
      if (!isRuntimeObject(child)) {
        throw new IdylliumRuntimeError(file, line, `add_child() expects gui widget, got '${String(child)}'`);
      }
      child.__parent = obj;
      (obj.__children as RuntimeObject[]).push(child);
    });
  }

  if (typeName === 'Window') {
    obj.title = '';
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorWhite());
    obj.show = async () => {
      obj.__shown = true;
      for (const child of obj.__children as RuntimeObject[] ?? []) {
        await initializeGuiChild(child);
      }
    };
    state.windows.push(obj);
  }

  if (typeName === 'Canvas') {
    obj.framerate_limit = 60;
    obj.__commands = [];
    obj.clear = contextFunction((_file: string, _line: number) => {
      canvasCommands(obj).push({ kind: 'clear', color: '#000000' });
    });
    obj.fill = contextFunction((color: unknown, file: string, line: number) => {
      canvasCommands(obj).push({ kind: 'fill', color: colorToCss(color, 'Canvas.fill() color', file, line) });
    });
    obj.draw = contextFunction((target: unknown, file: string, line: number) => {
      if (!isDrawableObject(target)) {
        throw new IdylliumRuntimeError(file, line, `Canvas.draw() expects drawable object, got '${runtimeTypeName(target)}'`);
      }
      canvasCommands(obj).push({ kind: 'draw', object: drawableSnapshot(target) });
    });
    obj.to_string = () => `gui.Canvas(commands: ${canvasCommands(obj).length})`;
    state.canvases.push(obj);
  }

  if (typeName === 'Timer') {
    obj.interval = 1000;
    obj.__running = false;
    obj.__elapsedMs = 0;
    obj.start = () => {
      obj.__running = true;
      obj.__elapsedMs = 0;
    };
    obj.stop = () => {
      obj.__running = false;
    };
    state.timers.push(obj);
  }

  if (typeName === 'Label') {
    obj.text = '';
    obj.font_size = 12;
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorTransparent());
    obj.border_color = colorTransparent();
  }

  if (typeName === 'Button') {
    obj.text = '';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorLightGray());
    obj.border_color = colorGray();
  }

  if (typeName === 'Frame') {
    obj.title = '';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorVeryLightGray());
    obj.border_color = colorGray();
    obj.border_width = 1;
  }

  if (typeName === 'ImageBox') {
    obj.image = null;
    obj.resize_mode = 'fit';
    obj.set_image = contextFunction((image: unknown, file: string, line: number) => {
      obj.image = runtimeImageResource(image, 'ImageBox.set_image()', file, line);
    });
  }

  if (typeName === 'LineEdit') {
    obj.text = '';
    obj.placeholder = '';
    obj.font_size = 12;
    obj.echo_mode = 'normal';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorWhite());
    obj.border_color = colorGray();
  }

  if (typeName === 'TextEdit') {
    obj.text = '';
    obj.placeholder = '';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorWhite());
    obj.border_color = colorGray();
  }

  if (typeName === 'ProgressBar') {
    obj.value = 0;
    obj.min = 0;
    obj.max = 100;
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorVeryLightGray());
    setTrackedRuntimePropertyDefault(obj, 'foreground_color', colorBlue());
    obj.border_color = colorGray();
  }

  if (typeName === 'SpinBox' || typeName === 'Slider') {
    obj.value = 0;
    obj.min = 0;
    obj.max = 100;
    obj.step = 1;
  }

  if (typeName === 'FloatSpinBox') {
    obj.value = 0;
    obj.min = 0;
    obj.max = 100;
    obj.step = 1;
  }

  if (typeName === 'CheckBox') {
    obj.text = '';
    obj.is_checked = false;
  }

  if (typeName === 'RadioButton') {
    obj.text = '';
    obj.group = '';
    obj.is_selected = false;
  }

  if (typeName === 'ComboBox') {
    const items: string[] = [];
    obj.__items = items;
    obj.__selected_index = -1;
    defineComboBoxProperties(obj, items);
    obj.add_item = (text: string) => {
      items.push(text);
      if (obj.selected_index === -1) {
        obj.selected_index = 0;
      }
    };
    obj.clear_items = () => {
      items.length = 0;
      obj.selected_index = -1;
    };
  }

  if (typeName === 'Modal') {
    obj.title = '';
    obj.message = '';
    obj.confirm_text = 'OK';
    obj.cancel_text = 'Cancel';
    obj.__input_value = '';
    obj.show_alert = () => showModal(obj, 'alert', state);
    obj.show_confirm = () => showModal(obj, 'confirm', state);
    obj.show_input = () => {
      obj.__input_value = '';
      showModal(obj, 'input', state);
    };
    obj.get_input_value = () => obj.__input_value;
  }
}

function defaultGuiWidgetSize(typeName: string): { width: number; height: number } {
  switch (typeName) {
    case 'Window':
      return { width: 640, height: 420 };
    case 'Canvas':
      return { width: 300, height: 150 };
    case 'Label':
      return { width: 120, height: 24 };
    case 'Button':
      return { width: 120, height: 32 };
    case 'Frame':
      return { width: 220, height: 140 };
    case 'ImageBox':
      return { width: 160, height: 120 };
    case 'LineEdit':
      return { width: 180, height: 28 };
    case 'TextEdit':
      return { width: 240, height: 120 };
    case 'ProgressBar':
      return { width: 200, height: 24 };
    case 'SpinBox':
      return { width: 100, height: 28 };
    case 'FloatSpinBox':
      return { width: 120, height: 28 };
    case 'Slider':
      return { width: 200, height: 28 };
    case 'CheckBox':
    case 'RadioButton':
      return { width: 180, height: 24 };
    case 'ComboBox':
      return { width: 180, height: 30 };
    default:
      return { width: 120, height: 32 };
  }
}

function showModal(obj: RuntimeObject, mode: 'alert' | 'confirm' | 'input', state: RuntimeObjectState): void {
  obj.__modalMode = mode;
  if (!state.modals.includes(obj)) {
    state.modals.push(obj);
  }
}

function defineComboBoxProperties(obj: RuntimeObject, items: string[]): void {
  Object.defineProperty(obj, 'selected_index', {
    enumerable: true,
    configurable: true,
    get() {
      return obj.__selected_index;
    },
    set(value: unknown) {
      obj.__selected_index = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : -1;
    },
  });

  Object.defineProperty(obj, 'selected_text', {
    enumerable: true,
    configurable: true,
    get() {
      const index = obj.__selected_index;
      return typeof index === 'number' && index >= 0 ? items[index] ?? '' : '';
    },
    set(_value: unknown) {
      // selected_text is derived from selected_index and ComboBox items.
    },
  });
}

function initializeDrawableObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName === 'Rectangle') {
    obj.x = 0;
    obj.y = 0;
    obj.width = 0;
    obj.height = 0;
    obj.fill_color = colorTransparent();
    obj.border_width = 0;
    obj.border_color = colorTransparent();
    attachPositionMove(obj, 'Rectangle');
    attachDrawableTransform(obj, 'Rectangle');
  }

  if (typeName === 'Circle') {
    obj.x = 0;
    obj.y = 0;
    obj.radius = 0;
    obj.fill_color = colorTransparent();
    obj.border_width = 0;
    obj.border_color = colorTransparent();
    attachPositionMove(obj, 'Circle');
    attachDrawableTransform(obj, 'Circle');
  }

  if (typeName === 'Line') {
    obj.x1 = 0;
    obj.y1 = 0;
    obj.x2 = 0;
    obj.y2 = 0;
    obj.color = colorWhite();
    obj.thickness = 1;
    attachLineMove(obj);
  }

  if (typeName === 'Font') {
    initializeFontObject(obj, typeName, state);
  }

  if (typeName === 'Sprite') {
    obj.image = null;
    obj.x = 0;
    obj.y = 0;
    obj.scale_x = 1;
    obj.scale_y = 1;
    obj.set_image = contextFunction((image: unknown, file: string, line: number) => {
      obj.image = runtimeImageResource(image, 'Sprite.set_image()', file, line);
    });
    obj.set_scale = contextFunction((x: unknown, y: unknown, file: string, line: number) => {
      obj.scale_x = finiteNumber(x, 'Sprite.set_scale() x', file, line);
      obj.scale_y = finiteNumber(y, 'Sprite.set_scale() y', file, line);
    });
    attachPositionMove(obj, 'Sprite');
    attachDrawableTransform(obj, 'Sprite');
  }

  if (typeName === 'Text') {
    obj.font = createDefaultDrawableFont(state);
    obj.text = '';
    obj.x = 0;
    obj.y = 0;
    obj.font_size = 16;
    obj.text_color = colorWhite();
    attachPositionMove(obj, 'Text');
    attachDrawableTransform(obj, 'Text');
    obj.get_width = contextFunction((file: string, line: number) => (
      drawableTextMetrics(obj, 'Text.get_width()', file, line, state).width
    ));
    obj.get_height = contextFunction((file: string, line: number) => (
      drawableTextMetrics(obj, 'Text.get_height()', file, line, state).height
    ));
  }

  if (['Rectangle', 'Circle', 'Line', 'Sprite', 'Text'].includes(typeName)) {
    obj.__idylliumDrawable = true;
    attachDrawableGeometry(obj, typeName, state);
  }
}

type RuntimeFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

function initializeFontObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Font') return;

  obj.src = '';
  obj.path = '';
  obj.resolved_path = '';
  obj.resource_uri = '';
  obj.format = '';
  obj.is_loaded = false;
  Object.defineProperty(obj, '__fontBytes', {
    configurable: true,
    enumerable: false,
    value: null,
    writable: true,
  });
  obj.load_from_file = contextFunction((targetPath: unknown, file: string, line: number) => {
    const requestedPath = stringArgument(targetPath, 'Font.load_from_file() path', file, line);
    const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
    if (!state.fileSystem.exists(resolvedPath)) {
      throw new IdylliumRuntimeError(file, line, `Font.load_from_file() cannot load '${requestedPath}': file does not exist`);
    }
    if (!runtimeIsFile(state.fileSystem, resolvedPath, file, line, 'reading')) {
      throw new IdylliumRuntimeError(file, line, `Font.load_from_file() cannot load '${requestedPath}': path is not a file`);
    }

    const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Font.load_from_file()');
    const format = detectFontFormat(bytes);
    if (format === null) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `Font.load_from_file() cannot decode '${requestedPath}': unsupported font format (expected TTF, OTF, WOFF, or WOFF2)`,
      );
    }

    obj.src = requestedPath;
    obj.path = requestedPath;
    obj.resolved_path = resolvedPath;
    const existingResourceUri = state.fileSystem.resourceUri?.(resolvedPath) || '';
    obj.resource_uri = existingResourceUri && !existingResourceUri.startsWith('data:')
      ? existingResourceUri
      : bytesToDataUri(bytes, fontMimeType(format));
    obj.__fontBytes = bytes;
    obj.format = format;
    obj.is_builtin = false;
    obj.is_loaded = true;
  });
}

function createDefaultDrawableFont(state: RuntimeObjectState): RuntimeObject {
  const font = createPlainRuntimeObject('fonts', 'Font', state);
  font.src = '<Idyllium default font>';
  font.format = 'woff2';
  font.is_loaded = true;
  font.is_builtin = true;
  return font;
}

function detectFontFormat(bytes: Uint8Array): RuntimeFontFormat | null {
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) {
    return 'ttf';
  }

  const signature = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  if (signature === 'true') return 'ttf';
  if (signature === 'OTTO') return 'otf';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'wOF2') return 'woff2';
  return null;
}

function fontMimeType(format: RuntimeFontFormat): string {
  if (format === 'ttf') return 'font/ttf';
  if (format === 'otf') return 'font/otf';
  if (format === 'woff') return 'font/woff';
  return 'font/woff2';
}

interface StoredStaticImage {
  readonly raster: RuntimeRasterImage;
  readonly sourceBytes?: Uint8Array;
}

interface StoredAnimation {
  readonly animation: RuntimeDecodedAnimation;
  readonly sourceBytes?: Uint8Array;
}

function initializeImageObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  obj.src = '';
  obj.resolved_path = '';
  obj.resource_uri = '';
  obj.width = 0;
  obj.height = 0;
  obj.format = '';
  obj.has_alpha = false;
  obj.is_loaded = false;

  if (typeName === 'Static') {
    obj.load_from_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const requestedPath = stringArgument(targetPath, 'Static.load_from_file() path', file, line);
      const resolvedPath = resolveImageInputPath(requestedPath, file, line, state, 'Static.load_from_file()');
      const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Static.load_from_file()');
      const format = detectImageFormat(bytes);
      if (format === 'unknown') {
        throw new IdylliumRuntimeError(file, line, `Static.load_from_file() cannot decode '${requestedPath}': unsupported image format`);
      }
      const service = imageService(state, file, line);
      try {
        const decoded = await service.decodeStatic(bytes, format);
        setLoadedStaticImage(obj, decoded, bytes, requestedPath, resolvedPath, state);
      } catch (error) {
        throw imageRuntimeError(file, line, `Static.load_from_file() cannot decode '${requestedPath}'`, error);
      }
    });

    obj.scale = contextFunction(async (x: unknown, y: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.scale()', file, line);
      const scaleX = finiteNumber(x, 'Static.scale() x', file, line);
      const scaleY = finiteNumber(y, 'Static.scale() y', file, line);
      if (scaleX === 0 || scaleY === 0) {
        throw new IdylliumRuntimeError(file, line, `Static.scale() factors cannot be zero (got ${scaleX}, ${scaleY})`);
      }
      ensureImageSize(
        Math.max(1, Math.round(source.raster.width * Math.abs(scaleX))),
        Math.max(1, Math.round(source.raster.height * Math.abs(scaleY))),
        'Static.scale()',
        file,
        line,
      );
      return createGeneratedStaticImage(scaleRaster(source.raster, scaleX, scaleY), String(obj.src), state, file, line);
    });

    obj.rotate = contextFunction(async (angle: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.rotate()', file, line);
      const degrees = integerNumber(angle, 'Static.rotate() angle', file, line);
      if (degrees % 90 !== 0) {
        throw new IdylliumRuntimeError(file, line, `Static.rotate() angle must be divisible by 90, got ${degrees}`);
      }
      return createGeneratedStaticImage(rotateRaster(source.raster, degrees), String(obj.src), state, file, line);
    });

    obj.tint = contextFunction(async (color: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.tint()', file, line);
      if (!(color instanceof IdylliumColor)) {
        throw new IdylliumRuntimeError(file, line, `Static.tint() color must be colors.Color`);
      }
      return createGeneratedStaticImage(
        tintRaster(source.raster, color.red, color.green, color.blue),
        String(obj.src),
        state,
        file,
        line,
      );
    });

    obj.with_opacity = contextFunction(async (value: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.with_opacity()', file, line);
      const opacityValue = rangeNumber(value, 'Static.with_opacity() opacity', 0, 1, file, line);
      return createGeneratedStaticImage(opacityRaster(source.raster, opacityValue), String(obj.src), state, file, line);
    });

    obj.desaturate = contextFunction(async (
      amountOrFile: number | string,
      fileOrLine: string | number,
      maybeLine?: number,
    ) => {
      const context = optionalNumberContext(amountOrFile, fileOrLine, maybeLine);
      const source = storedStaticImage(obj, 'Static.desaturate()', context.file, context.line);
      const amount = context.value === undefined
        ? 1
        : rangeNumber(context.value, 'Static.desaturate() amount', 0, 1, context.file, context.line);
      return createGeneratedStaticImage(
        desaturateRaster(source.raster, amount),
        String(obj.src),
        state,
        context.file,
        context.line,
      );
    });

    obj.crop = contextFunction(async (
      x: unknown,
      y: unknown,
      width: unknown,
      height: unknown,
      file: string,
      line: number,
    ) => {
      const source = storedStaticImage(obj, 'Static.crop()', file, line);
      const cropX = integerNumber(x, 'Static.crop() x', file, line);
      const cropY = integerNumber(y, 'Static.crop() y', file, line);
      const cropWidth = integerNumber(width, 'Static.crop() width', file, line);
      const cropHeight = integerNumber(height, 'Static.crop() height', file, line);
      if (cropX < 0 || cropY < 0 || cropWidth <= 0 || cropHeight <= 0) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Static.crop() expects non-negative coordinates and positive size, got (${cropX}, ${cropY}, ${cropWidth}, ${cropHeight})`,
        );
      }
      if (cropX + cropWidth > source.raster.width || cropY + cropHeight > source.raster.height) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Static.crop() rectangle (${cropX}, ${cropY}, ${cropWidth}, ${cropHeight}) is outside image bounds ${source.raster.width}x${source.raster.height}`,
        );
      }
      return createGeneratedStaticImage(
        cropRaster(source.raster, cropX, cropY, cropWidth, cropHeight),
        String(obj.src),
        state,
        file,
        line,
      );
    });

    obj.export_to_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.export_to_file()', file, line);
      const requestedPath = stringArgument(targetPath, 'Static.export_to_file() path', file, line);
      const outputFormat = imageFormatFromPath(requestedPath);
      if (!['png', 'jpeg', 'webp', 'gif'].includes(outputFormat)) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Static.export_to_file() cannot determine a supported format from '${requestedPath}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const bytes = await service.encodeStatic(source.raster, outputFormat);
        writeRuntimeImageBytes(requestedPath, bytes, outputFormat, state, file, line, 'Static.export_to_file()');
      } catch (error) {
        throw imageRuntimeError(file, line, `Static.export_to_file() cannot write '${requestedPath}'`, error);
      }
    });
  }

  if (typeName === 'Animation') {
    obj.frame_count = 0;
    obj.frame_duration = 0;
    obj.has_uniform_frame_duration = true;

    obj.load_from_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const requestedPath = stringArgument(targetPath, 'Animation.load_from_file() path', file, line);
      const resolvedPath = resolveImageInputPath(requestedPath, file, line, state, 'Animation.load_from_file()');
      const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Animation.load_from_file()');
      const format = detectImageFormat(bytes);
      if (format !== 'gif' && format !== 'apng') {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Animation.load_from_file() expects GIF or APNG data, got '${format}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const animation = await service.decodeAnimation(bytes, format);
        if (animation.frames.length < 2) {
          throw new Error('the file contains only one frame; use image.Static instead');
        }
        setLoadedAnimation(obj, animation, bytes, requestedPath, resolvedPath, state);
      } catch (error) {
        throw imageRuntimeError(file, line, `Animation.load_from_file() cannot decode '${requestedPath}'`, error);
      }
    });

    obj.get_frame = contextFunction(async (index: unknown, file: string, line: number) => {
      const source = storedAnimation(obj, 'Animation.get_frame()', file, line);
      const frameIndex = imageFrameIndex(source.animation.frames, index, 'Animation.get_frame()', file, line);
      return createGeneratedStaticImage(source.animation.frames[frameIndex], String(obj.src), state, file, line);
    });

    obj.get_frame_duration = contextFunction((index: unknown, file: string, line: number) => {
      const source = storedAnimation(obj, 'Animation.get_frame_duration()', file, line);
      const frameIndex = imageFrameIndex(source.animation.frames, index, 'Animation.get_frame_duration()', file, line);
      return source.animation.frames[frameIndex].duration;
    });

    obj.create_from_frames = contextFunction(async (
      framesValue: unknown,
      durationValue: unknown,
      file: string,
      line: number,
    ) => {
      if (!(framesValue instanceof IdylliumArray)) {
        throw new IdylliumRuntimeError(file, line, `Animation.create_from_frames() frames must be dyn_array<image.Static>`);
      }
      const values = framesValue.values();
      if (values.length < 2) {
        throw new IdylliumRuntimeError(file, line, `Animation.create_from_frames() expects at least 2 frames, got ${values.length}`);
      }
      const duration = finiteNumber(durationValue, 'Animation.create_from_frames() frame_duration', file, line);
      if (duration <= 0) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Animation.create_from_frames() frame_duration must be greater than 0, got ${duration}`,
        );
      }
      const frames: RuntimeAnimationFrame[] = [];
      let expectedWidth = 0;
      let expectedHeight = 0;
      values.forEach((value, index) => {
        if (!isRuntimeObject(value) || value.__idylliumType !== 'image.Static') {
          throw new IdylliumRuntimeError(
            file,
            line,
            `Animation.create_from_frames() item ${index} must be image.Static, got '${runtimeTypeName(value)}'`,
          );
        }
        const stored = storedStaticImage(value, 'Animation.create_from_frames()', file, line);
        if (index === 0) {
          expectedWidth = stored.raster.width;
          expectedHeight = stored.raster.height;
        } else if (stored.raster.width !== expectedWidth || stored.raster.height !== expectedHeight) {
          throw new IdylliumRuntimeError(
            file,
            line,
            `Animation.create_from_frames() frame ${index} has size ${stored.raster.width}x${stored.raster.height}, expected ${expectedWidth}x${expectedHeight}`,
          );
        }
        frames.push({ ...cloneRaster(stored.raster), duration });
      });
      const animation: RuntimeDecodedAnimation = {
        width: expectedWidth,
        height: expectedHeight,
        format: 'gif',
        frames,
      };
      const service = imageService(state, file, line);
      try {
        const encoded = await service.encodeAnimation(animation, 'gif');
        setGeneratedAnimation(obj, animation, encoded);
      } catch (error) {
        throw imageRuntimeError(file, line, 'Animation.create_from_frames() cannot encode animation', error);
      }
    });

    obj.export_to_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const source = storedAnimation(obj, 'Animation.export_to_file()', file, line);
      const requestedPath = stringArgument(targetPath, 'Animation.export_to_file() path', file, line);
      const pathFormat = imageFormatFromPath(requestedPath);
      const outputFormat: RuntimeImageFormat = pathFormat === 'png' ? 'apng' : pathFormat;
      if (outputFormat !== 'gif' && outputFormat !== 'apng') {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Animation.export_to_file() expects .gif, .png or .apng output path, got '${requestedPath}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const bytes = await service.encodeAnimation(source.animation, outputFormat);
        writeRuntimeImageBytes(requestedPath, bytes, outputFormat, state, file, line, 'Animation.export_to_file()');
      } catch (error) {
        throw imageRuntimeError(file, line, `Animation.export_to_file() cannot write '${requestedPath}'`, error);
      }
    });
  }
}

function setLoadedStaticImage(
  obj: RuntimeObject,
  decoded: RuntimeRasterImage & { readonly format: RuntimeImageFormat },
  sourceBytes: Uint8Array,
  requestedPath: string,
  resolvedPath: string,
  state: RuntimeObjectState,
): void {
  obj.__imageStatic = { raster: cloneRaster(decoded), sourceBytes: new Uint8Array(sourceBytes) } satisfies StoredStaticImage;
  setImageMetadata(obj, decoded, decoded.format, requestedPath, resolvedPath, imageResourceUri(state, resolvedPath, sourceBytes, decoded.format));
}

async function createGeneratedStaticImage(
  raster: RuntimeRasterImage,
  sourcePath: string,
  state: RuntimeObjectState,
  file: string,
  line: number,
): Promise<RuntimeObject> {
  ensureImageSize(raster.width, raster.height, 'image transformation', file, line);
  const service = imageService(state, file, line);
  try {
    const encoded = await service.encodeStatic(raster, 'png');
    const result = createPlainRuntimeObject('image', 'Static', state);
    result.__imageStatic = { raster: cloneRaster(raster), sourceBytes: encoded } satisfies StoredStaticImage;
    setImageMetadata(result, raster, 'png', sourcePath, '', bytesToDataUri(encoded, imageMimeType('png')));
    return result;
  } catch (error) {
    throw imageRuntimeError(file, line, 'image transformation cannot create its result', error);
  }
}

function setLoadedAnimation(
  obj: RuntimeObject,
  animation: RuntimeDecodedAnimation,
  sourceBytes: Uint8Array,
  requestedPath: string,
  resolvedPath: string,
  state: RuntimeObjectState,
): void {
  obj.__imageAnimation = { animation: cloneAnimation(animation), sourceBytes: new Uint8Array(sourceBytes) } satisfies StoredAnimation;
  setImageMetadata(
    obj,
    { width: animation.width, height: animation.height, pixels: animation.frames[0].pixels },
    animation.format,
    requestedPath,
    resolvedPath,
    imageResourceUri(state, resolvedPath, sourceBytes, animation.format),
  );
  obj.has_alpha = animation.frames.some((frame) => rasterHasAlpha(frame));
  setAnimationMetadata(obj, animation.frames);
}

function setGeneratedAnimation(obj: RuntimeObject, animation: RuntimeDecodedAnimation, encoded: Uint8Array): void {
  obj.__imageAnimation = { animation: cloneAnimation(animation), sourceBytes: new Uint8Array(encoded) } satisfies StoredAnimation;
  setImageMetadata(
    obj,
    { width: animation.width, height: animation.height, pixels: animation.frames[0].pixels },
    'gif',
    '',
    '',
    bytesToDataUri(encoded, imageMimeType('gif')),
  );
  obj.has_alpha = animation.frames.some((frame) => rasterHasAlpha(frame));
  setAnimationMetadata(obj, animation.frames);
}

function setImageMetadata(
  obj: RuntimeObject,
  image: RuntimeRasterImage,
  format: RuntimeImageFormat,
  src: string,
  resolvedPath: string,
  resourceUri: string,
): void {
  obj.src = src;
  obj.resolved_path = resolvedPath;
  obj.resource_uri = resourceUri;
  obj.width = image.width;
  obj.height = image.height;
  obj.format = format;
  obj.has_alpha = rasterHasAlpha(image);
  obj.is_loaded = true;
}

function setAnimationMetadata(obj: RuntimeObject, frames: readonly RuntimeAnimationFrame[]): void {
  const firstDuration = frames[0]?.duration ?? 0;
  obj.frame_count = frames.length;
  obj.frame_duration = firstDuration;
  obj.has_uniform_frame_duration = frames.every((frame) => Math.abs(frame.duration - firstDuration) < 0.0000001);
}

function storedStaticImage(obj: RuntimeObject, methodName: string, file: string, line: number): StoredStaticImage {
  const stored = obj.__imageStatic as StoredStaticImage | undefined;
  if (obj.is_loaded === true && stored?.raster) return stored;
  throw new IdylliumRuntimeError(file, line, `${methodName} cannot be used before load_from_file()`);
}

function storedAnimation(obj: RuntimeObject, methodName: string, file: string, line: number): StoredAnimation {
  const stored = obj.__imageAnimation as StoredAnimation | undefined;
  if (obj.is_loaded === true && stored?.animation) return stored;
  throw new IdylliumRuntimeError(file, line, `${methodName} cannot be used before loading or creating an animation`);
}

function cloneAnimation(animation: RuntimeDecodedAnimation): RuntimeDecodedAnimation {
  return {
    width: animation.width,
    height: animation.height,
    format: animation.format,
    frames: animation.frames.map((frame) => ({ ...cloneRaster(frame), duration: frame.duration })),
  };
}

function imageFrameIndex(
  frames: readonly RuntimeAnimationFrame[],
  value: unknown,
  methodName: string,
  file: string,
  line: number,
): number {
  const index = integerNumber(value, `${methodName} index`, file, line);
  if (index < 0 || index >= frames.length) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `${methodName} frame index ${index} out of bounds (frame count ${frames.length}, valid indices ${validRange(frames.length)})`,
    );
  }
  return index;
}

function resolveImageInputPath(
  requestedPath: string,
  file: string,
  line: number,
  state: RuntimeObjectState,
  methodName: string,
): string {
  const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
  if (!state.fileSystem.exists(resolvedPath)) {
    throw new IdylliumRuntimeError(file, line, `${methodName} cannot load '${requestedPath}': file does not exist`);
  }
  if (!state.fileSystem.isFile(resolvedPath)) {
    throw new IdylliumRuntimeError(file, line, `${methodName} cannot load '${requestedPath}': path is not a file`);
  }
  return resolvedPath;
}

function readRuntimeBytes(
  fileSystem: RuntimeFileSystem,
  resolvedPath: string,
  file: string,
  line: number,
  methodName: string,
): Uint8Array {
  if (!fileSystem.readBytes) {
    throw new IdylliumRuntimeError(file, line, `${methodName} requires binary file support in this runtime`);
  }
  try {
    return fileSystem.readBytes(resolvedPath);
  } catch (error) {
    throw imageRuntimeError(file, line, `${methodName} cannot read '${resolvedPath}'`, error);
  }
}

function writeRuntimeImageBytes(
  requestedPath: string,
  bytes: Uint8Array,
  format: RuntimeImageFormat,
  state: RuntimeObjectState,
  file: string,
  line: number,
  methodName: string,
): void {
  if (!state.fileSystem.writeBytes) {
    throw new IdylliumRuntimeError(file, line, `${methodName} requires binary file support in this runtime`);
  }
  const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
  state.fileSystem.writeBytes(resolvedPath, bytes, bytesToDataUri(bytes, imageMimeType(format)));
}

function imageResourceUri(
  state: RuntimeObjectState,
  resolvedPath: string,
  bytes: Uint8Array,
  format: RuntimeImageFormat,
): string {
  return state.fileSystem.resourceUri?.(resolvedPath) || bytesToDataUri(bytes, imageMimeType(format));
}

function imageService(state: RuntimeObjectState, file: string, line: number): RuntimeImageService {
  if (state.imageService) return state.imageService;
  throw new IdylliumRuntimeError(file, line, 'image processing is unavailable in this runtime');
}

function runtimeImageResource(value: unknown, methodName: string, file: string, line: number): RuntimeObject {
  if (!isRuntimeObject(value) || !['image.Static', 'image.Animation'].includes(String(value.__idylliumType))) {
    throw new IdylliumRuntimeError(file, line, `${methodName} expects image.Static or image.Animation, got '${runtimeTypeName(value)}'`);
  }
  if (value.is_loaded !== true) {
    throw new IdylliumRuntimeError(file, line, `${methodName} cannot use an image before it is loaded or created`);
  }
  return value;
}

function ensureImageSize(width: number, height: number, operation: string, file: string, line: number): void {
  const pixelCount = width * height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || pixelCount > 25_000_000) {
    throw new IdylliumRuntimeError(file, line, `${operation} result size ${width}x${height} is invalid or too large`);
  }
}

function imageRuntimeError(file: string, line: number, prefix: string, error: unknown): IdylliumRuntimeError {
  if (error instanceof IdylliumRuntimeError) return error;
  return new IdylliumRuntimeError(file, line, `${prefix}: ${errorMessage(error)}`);
}

function attachPositionMove(obj: RuntimeObject, typeName: string): void {
  obj.move = contextFunction((dx: unknown, dy: unknown, file: string, line: number) => {
    obj.x = finiteNumber(obj.x, `${typeName}.move() current x`, file, line)
      + finiteNumber(dx, `${typeName}.move() dx`, file, line);
    obj.y = finiteNumber(obj.y, `${typeName}.move() current y`, file, line)
      + finiteNumber(dy, `${typeName}.move() dy`, file, line);
  });
}

function attachLineMove(obj: RuntimeObject): void {
  obj.move = contextFunction((dx: unknown, dy: unknown, file: string, line: number) => {
    const deltaX = finiteNumber(dx, 'Line.move() dx', file, line);
    const deltaY = finiteNumber(dy, 'Line.move() dy', file, line);
    obj.x1 = finiteNumber(obj.x1, 'Line.move() current x1', file, line) + deltaX;
    obj.y1 = finiteNumber(obj.y1, 'Line.move() current y1', file, line) + deltaY;
    obj.x2 = finiteNumber(obj.x2, 'Line.move() current x2', file, line) + deltaX;
    obj.y2 = finiteNumber(obj.y2, 'Line.move() current y2', file, line) + deltaY;
  });
}

function attachDrawableTransform(obj: RuntimeObject, typeName: string): void {
  obj.origin_x = 0;
  obj.origin_y = 0;
  obj.rotation = 0;
  obj.set_origin = contextFunction((x: unknown, y: unknown, file: string, line: number) => {
    obj.origin_x = finiteNumber(x, `${typeName}.set_origin() x`, file, line);
    obj.origin_y = finiteNumber(y, `${typeName}.set_origin() y`, file, line);
  });
  obj.rotate = contextFunction((angle: unknown, file: string, line: number) => {
    obj.rotation = finiteNumber(obj.rotation, `${typeName}.rotate() current rotation`, file, line)
      + finiteNumber(angle, `${typeName}.rotate() angle`, file, line);
  });
}

function attachDrawableGeometry(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  obj.contains = contextFunction((x: unknown, y: unknown, file: string, line: number) => {
    const point = {
      x: finiteNumber(x, `${typeName}.contains() x`, file, line),
      y: finiteNumber(y, `${typeName}.contains() y`, file, line),
    };
    return collisionShapeContains(drawableCollisionShape(obj, `${typeName}.contains()`, file, line, state), point);
  });
  obj.intersects = contextFunction((other: unknown, file: string, line: number) => {
    if (!isDrawableObject(other)) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `${typeName}.intersects() expects drawable object, got '${runtimeTypeName(other)}'`,
      );
    }
    return collisionShapesIntersect(
      drawableCollisionShape(obj, `${typeName}.intersects()`, file, line, state),
      drawableCollisionShape(other, `${typeName}.intersects()`, file, line, state),
    );
  });
}

function drawableCollisionShape(
  obj: RuntimeObject,
  operation: string,
  file: string,
  line: number,
  state: RuntimeObjectState,
): DrawableCollisionShape | null {
  const typeName = String(obj.__idylliumType ?? 'drawable.Drawable');

  if (typeName === 'drawable.Rectangle') {
    return rectangleCollisionShape(
      drawableTransform(obj, 'Rectangle', 1, 1, file, line),
      finiteNumber(obj.width, `${operation} Rectangle.width`, file, line),
      finiteNumber(obj.height, `${operation} Rectangle.height`, file, line),
    );
  }

  if (typeName === 'drawable.Circle') {
    return circleCollisionShape(
      drawableTransform(obj, 'Circle', 1, 1, file, line),
      finiteNumber(obj.radius, `${operation} Circle.radius`, file, line),
    );
  }

  if (typeName === 'drawable.Line') {
    return capsuleCollisionShape(
      {
        x: finiteNumber(obj.x1, `${operation} Line.x1`, file, line),
        y: finiteNumber(obj.y1, `${operation} Line.y1`, file, line),
      },
      {
        x: finiteNumber(obj.x2, `${operation} Line.x2`, file, line),
        y: finiteNumber(obj.y2, `${operation} Line.y2`, file, line),
      },
      finiteNumber(obj.thickness, `${operation} Line.thickness`, file, line),
    );
  }

  if (typeName === 'drawable.Sprite') {
    const image = obj.image;
    if (!isRuntimeObject(image) || image.is_loaded !== true) {
      throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect Sprite geometry before an image is loaded`);
    }
    return rectangleCollisionShape(
      drawableTransform(
        obj,
        'Sprite',
        finiteNumber(obj.scale_x, `${operation} Sprite.scale_x`, file, line),
        finiteNumber(obj.scale_y, `${operation} Sprite.scale_y`, file, line),
        file,
        line,
      ),
      finiteNumber(image.width, `${operation} Sprite image width`, file, line),
      finiteNumber(image.height, `${operation} Sprite image height`, file, line),
    );
  }

  if (typeName === 'drawable.Text') {
    const metrics = drawableTextMetrics(obj, operation, file, line, state);
    return rectangleCollisionShape(
      drawableTransform(obj, 'Text', 1, 1, file, line),
      metrics.width,
      metrics.height,
    );
  }

  throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect unsupported '${typeName}' geometry`);
}

function drawableTextMetrics(
  obj: RuntimeObject,
  operation: string,
  file: string,
  line: number,
  state: RuntimeObjectState,
): RuntimeTextMetrics {
  const font = obj.font;
  if (!isRuntimeObject(font) || font.is_loaded !== true) {
    throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect Text geometry before a font is loaded`);
  }
  const text = String(obj.text ?? '');
  const fontSize = finiteNumber(obj.font_size, `${operation} Text.font_size`, file, line);
  try {
    return font.is_builtin === true
      ? state.fontMetricsService.measureDefault(text, fontSize)
      : state.fontMetricsService.measure(runtimeFontBytes(font, operation, file, line), text, fontSize);
  } catch (error) {
    if (error instanceof IdylliumRuntimeError) throw error;
    throw new IdylliumRuntimeError(file, line, `${operation} cannot measure Text: ${errorMessage(error)}`);
  }
}

function runtimeFontBytes(font: RuntimeObject, operation: string, file: string, line: number): Uint8Array {
  const bytes = font.__fontBytes;
  if (bytes instanceof Uint8Array) return bytes;
  throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect Text geometry without font bytes`);
}

function drawableTransform(
  obj: RuntimeObject,
  typeName: string,
  scaleX: number,
  scaleY: number,
  file: string,
  line: number,
): DrawableTransform {
  return {
    x: finiteNumber(obj.x, `${typeName} x`, file, line),
    y: finiteNumber(obj.y, `${typeName} y`, file, line),
    originX: finiteNumber(obj.origin_x, `${typeName} origin_x`, file, line),
    originY: finiteNumber(obj.origin_y, `${typeName} origin_y`, file, line),
    rotation: finiteNumber(obj.rotation, `${typeName} rotation`, file, line),
    scaleX,
    scaleY,
  };
}

function initializeAudioObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Sound' && typeName !== 'Music') return;

  obj.src = '';
  obj.resolved_path = '';
  obj.resource_uri = '';
  obj.is_loaded = false;
  obj.duration = 0;
  obj.is_playing = false;
  obj.__audioCommands = [];
  defineValidatedRuntimeProperty(obj, 'volume', 1, (value, file, line) => (
    rangeNumber(value, `${typeName}.volume`, 0, 1, file, line)
  ));

  obj.load_from_file = contextFunction((targetPath: unknown, file: string, line: number) => {
    const requestedPath = stringArgument(targetPath, `${typeName}.load_from_file() path`, file, line);
    const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
    if (!state.fileSystem.exists(resolvedPath)) {
      throw new IdylliumRuntimeError(file, line, `${typeName}.load_from_file() cannot load '${requestedPath}': file does not exist`);
    }
    if (!runtimeIsFile(state.fileSystem, resolvedPath, file, line, 'reading')) {
      throw new IdylliumRuntimeError(file, line, `${typeName}.load_from_file() cannot load '${requestedPath}': path is not a file`);
    }
    obj.src = requestedPath;
    obj.resolved_path = resolvedPath;
    obj.resource_uri = state.fileSystem.resourceUri?.(resolvedPath) ?? '';
    obj.duration = audioDuration(state.fileSystem, resolvedPath);
    obj.is_loaded = true;
  });

  obj.play = contextFunction((file: string, line: number) => {
    assertAudioLoaded(obj, typeName, 'play', file, line);
    obj.is_playing = true;
    pushAudioCommand(obj, state, 'play');
  });
  obj.pause = () => {
    obj.is_playing = false;
    pushAudioCommand(obj, state, 'pause');
  };
  obj.resume = contextFunction((file: string, line: number) => {
    assertAudioLoaded(obj, typeName, 'resume', file, line);
    obj.is_playing = true;
    pushAudioCommand(obj, state, 'resume');
  });
  obj.stop = () => {
    obj.is_playing = false;
    if (typeName === 'Music') obj.position = 0;
    pushAudioCommand(obj, state, 'stop');
  };

  if (typeName === 'Music') {
    obj.loop = false;
    defineValidatedRuntimeProperty(obj, 'position', 0, (value, file, line) => {
      const position = finiteNumber(value, 'Music.position', file, line);
      const duration = typeof obj.duration === 'number' ? obj.duration : 0;
      if (position < 0) {
        throw new IdylliumRuntimeError(file, line, `Music.position must be non-negative, got ${position}`);
      }
      if (duration > 0 && position > duration) {
        throw new IdylliumRuntimeError(file, line, `Music.position must be between 0 and ${duration}, got ${position}`);
      }
      return position;
    });
  }

  state.audio.push(obj);
}

function pushAudioCommand(obj: RuntimeObject, state: RuntimeObjectState, action: IdylliumAudioCommand['action']): void {
  audioCommands(obj).push({ id: state.nextAudioCommandId++, action });
}

function assertAudioLoaded(obj: RuntimeObject, typeName: string, methodName: string, file: string, line: number): void {
  if (obj.is_loaded === true) return;
  throw new IdylliumRuntimeError(file, line, `${typeName}.${methodName}() cannot play audio before load_from_file()`);
}

function audioCommands(obj: RuntimeObject): IdylliumAudioCommand[] {
  if (Array.isArray(obj.__audioCommands)) return obj.__audioCommands as IdylliumAudioCommand[];
  const commands: IdylliumAudioCommand[] = [];
  Object.defineProperty(obj, '__audioCommands', {
    value: commands,
    enumerable: false,
    configurable: true,
  });
  return commands;
}

function audioDuration(fileSystem: RuntimeFileSystem, filePath: string): number {
  try {
    const text = fileSystem.readText(filePath);
    const dataUrlMatch = /^data:audio\/[^;]+;base64,(.+)$/u.exec(text);
    if (dataUrlMatch) return wavDuration(nodeBuffer.from(dataUrlMatch[1], 'base64'));
    return wavDuration(nodeBuffer.from(text, 'binary'));
  } catch {
    return 0;
  }
}

function wavDuration(bytes: any): number {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 44) return 0;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return 0;
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  const bitsPerSample = bytes.readUInt16LE(34);
  const dataSize = bytes.readUInt32LE(40);
  const bytesPerSecond = sampleRate * Math.max(1, channels) * Math.max(1, bitsPerSample) / 8;
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return 0;
  return dataSize / bytesPerSecond;
}

function isGuiWidget(typeName: string): boolean {
  return typeName === 'Window'
    || typeName === 'Widget'
    || typeName === 'Canvas'
    || typeName === 'Label'
    || typeName === 'Button'
    || typeName === 'Frame'
    || typeName === 'ImageBox'
    || typeName === 'LineEdit'
    || typeName === 'TextEdit'
    || typeName === 'ProgressBar'
    || typeName === 'SpinBox'
    || typeName === 'FloatSpinBox'
    || typeName === 'Slider'
    || typeName === 'CheckBox'
    || typeName === 'RadioButton'
    || typeName === 'ComboBox';
}

function isRuntimeObject(value: unknown): value is RuntimeObject {
  return value !== null && typeof value === 'object';
}

function isDrawableObject(value: unknown): value is RuntimeObject {
  return isRuntimeObject(value) && value.__idylliumDrawable === true;
}

function canvasCommands(canvas: RuntimeObject): IdylliumCanvasCommand[] {
  const commands = canvas.__commands;
  if (Array.isArray(commands)) return commands as IdylliumCanvasCommand[];
  canvas.__commands = [];
  return canvas.__commands as IdylliumCanvasCommand[];
}

async function initializeGuiChild(child: RuntimeObject): Promise<void> {
  if (child.__idylliumType === 'gui.Canvas') {
    const onInit = child.on_init;
    if (typeof onInit === 'function') {
      await onInit(child);
    }

    const onUpdate = child.on_update;
    if (typeof onUpdate === 'function') {
      await onUpdate(child, 0);
    }
  }

  for (const nested of child.__children as RuntimeObject[] ?? []) {
    await initializeGuiChild(nested);
  }
}

function canvasSnapshot(canvas: RuntimeObject): IdylliumCanvasSnapshot {
  return {
    id: runtimeObjectId(canvas),
    type: 'gui.Canvas',
    properties: objectPropertiesSnapshot(canvas),
    commands: canvasCommands(canvas).map((command) => ({ ...command })),
  };
}

function audioSnapshot(audio: RuntimeObject): IdylliumAudioSnapshot {
  return {
    id: runtimeObjectId(audio),
    type: audio.__idylliumType === 'audio.Music' ? 'audio.Music' : 'audio.Sound',
    properties: objectPropertiesSnapshot(audio),
    commands: audioCommands(audio).map((command) => ({ ...command })),
  };
}

function windowSnapshot(window: RuntimeObject): IdylliumWindowSnapshot {
  return {
    id: runtimeObjectId(window),
    type: 'gui.Window',
    properties: objectPropertiesSnapshot(window),
    children: widgetChildrenSnapshot(window),
  };
}

function modalSnapshot(modal: RuntimeObject): IdylliumModalSnapshot {
  const mode = modal.__modalMode === 'confirm' || modal.__modalMode === 'input' ? modal.__modalMode : 'alert';
  return {
    id: runtimeObjectId(modal),
    type: 'gui.Modal',
    mode,
    properties: objectPropertiesSnapshot(modal),
  };
}

function widgetSnapshot(widget: RuntimeObject): IdylliumGuiWidgetSnapshot {
  const type = String(widget.__idylliumType ?? 'gui.Widget');
  return {
    id: runtimeObjectId(widget),
    type,
    properties: objectPropertiesSnapshot(widget),
    children: widgetChildrenSnapshot(widget),
    canvas: type === 'gui.Canvas' ? canvasSnapshot(widget) : undefined,
    items: type === 'gui.ComboBox' && Array.isArray(widget.__items) ? [...widget.__items] as string[] : undefined,
  };
}

function widgetChildrenSnapshot(widget: RuntimeObject): readonly IdylliumGuiWidgetSnapshot[] {
  const children = widget.__children;
  if (!Array.isArray(children)) return [];
  return (children as RuntimeObject[]).map(widgetSnapshot);
}

function drawableSnapshot(value: RuntimeObject): IdylliumDrawableSnapshot {
  return {
    type: String(value.__idylliumType ?? 'drawable.Drawable'),
    properties: objectPropertiesSnapshot(value),
  };
}

function objectPropertiesSnapshot(value: RuntimeObject): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('__') || typeof item === 'function') continue;
    result[key] = snapshotValue(item);
  }
  if (value.__explicitProperties instanceof Set && value.__explicitProperties.size > 0) {
    result.__explicit_properties = [...value.__explicitProperties].sort();
  }
  return result;
}

function runtimeObjectId(value: RuntimeObject): number {
  return typeof value.__idylliumObjectId === 'number' ? value.__idylliumObjectId : 0;
}

function snapshotValue(value: unknown): unknown {
  if (value instanceof IdylliumColor) return value.toCss();
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof IdylliumArray) return value.values().map(snapshotValue);
  if (isRuntimeObject(value)) {
    return {
      type: String(value.__idylliumType ?? 'object'),
      properties: objectPropertiesSnapshot(value),
    };
  }
  return value;
}

function colorToCss(value: unknown, argumentName: string, file: string, line: number): string {
  if (value instanceof IdylliumColor) return value.toCss();
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be colors.Color`);
}

function colorBlack(): IdylliumColor {
  return IdylliumColor.RGB(0, 0, 0);
}

function colorWhite(): IdylliumColor {
  return IdylliumColor.RGB(255, 255, 255);
}

function colorBlue(): IdylliumColor {
  return IdylliumColor.RGB(0, 0, 255);
}

function colorGray(): IdylliumColor {
  return IdylliumColor.RGB(180, 180, 180);
}

function colorLightGray(): IdylliumColor {
  return IdylliumColor.RGB(239, 239, 239);
}

function colorVeryLightGray(): IdylliumColor {
  return IdylliumColor.RGB(245, 245, 245);
}

function colorTransparent(): IdylliumColor {
  return IdylliumColor.RGBA(0, 0, 0, 0);
}

async function stepGuiTimer(timer: RuntimeObject, deltaTime: number): Promise<boolean> {
  if (timer.__running !== true) return false;
  const callback = timer.on_tick;
  if (typeof callback !== 'function') return false;

  const interval = typeof timer.interval === 'number' && Number.isFinite(timer.interval)
    ? Math.max(1, Math.trunc(timer.interval))
    : 1000;
  const elapsed = (typeof timer.__elapsedMs === 'number' ? timer.__elapsedMs : 0) + Math.max(0, deltaTime * 1000);
  timer.__elapsedMs = elapsed;
  let changed = false;

  while (timer.__running === true && typeof timer.__elapsedMs === 'number' && timer.__elapsedMs >= interval) {
    timer.__elapsedMs -= interval;
    await callback(timer);
    changed = true;
  }
  return changed;
}

function applyGuiEventPayload(
  target: RuntimeObject,
  eventName: string,
  payload: Readonly<Record<string, unknown>>,
  state: RuntimeObjectState,
): void {
  if (target.__idylliumType === 'audio.Music' && eventName === 'finished') {
    target.is_playing = false;
    return;
  }

  if (target.__idylliumType === 'audio.Sound' && eventName === 'sound_finished') {
    target.is_playing = false;
    return;
  }

  if (eventName === 'modal_confirm' || eventName === 'modal_cancel') {
    if (typeof payload.input_value === 'string') {
      target.__input_value = payload.input_value;
    }
    closeModal(target, state);
    return;
  }

  if (eventName !== 'change') return;

  switch (target.__idylliumType) {
    case 'gui.LineEdit':
    case 'gui.TextEdit':
      target.text = typeof payload.text === 'string' ? payload.text : '';
      return;
    case 'gui.SpinBox':
    case 'gui.Slider':
      target.value = eventNumber(payload.value);
      return;
    case 'gui.FloatSpinBox':
      target.value = eventFloat(payload.value);
      return;
    case 'gui.CheckBox':
      target.is_checked = payload.is_checked === true;
      return;
    case 'gui.RadioButton':
      if (payload.is_selected === true) {
        selectRadioButton(target, state);
      }
      return;
    case 'gui.ComboBox':
      target.selected_index = eventNumber(payload.selected_index);
      return;
    default:
      return;
  }
}

function selectRadioButton(target: RuntimeObject, state: RuntimeObjectState): void {
  const group = typeof target.group === 'string' ? target.group : '';
  const parent = target.__parent;

  for (const item of state.objects) {
    if (item === target || item.__idylliumType !== 'gui.RadioButton') continue;
    const itemGroup = typeof item.group === 'string' ? item.group : '';
    const sameNamedGroup = group !== '' && itemGroup === group;
    const sameParentDefaultGroup = group === '' && itemGroup === '' && item.__parent === parent;
    if (sameNamedGroup || sameParentDefaultGroup) {
      item.is_selected = false;
    }
  }

  target.is_selected = true;
}

function closeModal(target: RuntimeObject, state: RuntimeObjectState): void {
  const index = state.modals.indexOf(target);
  if (index >= 0) {
    state.modals.splice(index, 1);
  }
  target.__modalMode = '';
}

function guiCallbackName(target: RuntimeObject, eventName: string): string | null {
  if (eventName === 'click') return 'on_click';
  if (eventName === 'change') return 'on_change';
  if (target.__idylliumType === 'gui.Modal' && eventName === 'modal_confirm') return 'on_confirm';
  if (target.__idylliumType === 'gui.Modal' && eventName === 'modal_cancel') return 'on_cancel';
  if (target.__idylliumType === 'audio.Music' && eventName === 'finished') return 'on_finished';

  if (target.__idylliumType !== 'gui.Canvas') return null;

  switch (eventName) {
    case 'key_pressed':
      return 'on_key_pressed';
    case 'key_released':
      return 'on_key_released';
    case 'mouse_pressed':
      return 'on_mouse_pressed';
    case 'mouse_released':
      return 'on_mouse_released';
    case 'mouse_move':
      return 'on_mouse_move';
    case 'mouse_scroll':
      return 'on_mouse_scroll';
    default:
      return null;
  }
}

function guiEventObject(eventName: string, payload: Readonly<Record<string, unknown>>): RuntimeObject {
  if (eventName === 'key_pressed' || eventName === 'key_released') {
    return {
      __idylliumType: 'gui.KeyboardEvent',
      key: typeof payload.key === 'string' ? payload.key : '',
    };
  }

  if (eventName === 'mouse_scroll') {
    return {
      __idylliumType: 'gui.MouseScrollEvent',
      x: eventNumber(payload.x),
      y: eventNumber(payload.y),
      delta: eventNumber(payload.delta),
    };
  }

  return {
    __idylliumType: 'gui.MouseEvent',
    x: eventNumber(payload.x),
    y: eventNumber(payload.y),
    mouse_button: typeof payload.mouse_button === 'string' ? payload.mouse_button : '',
  };
}

function eventNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function eventFloat(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function runtimeTypeName(value: unknown): string {
  if (isRuntimeObject(value) && typeof value.__idylliumType === 'string') return value.__idylliumType;
  if (typeof value === 'bigint') return 'int';
  return String(value);
}

function channel(value: number, argumentName: string, file: string, line: number): number {
  const number = integerNumber(value, argumentName, file, line);
  if (number < 0 || number > 255) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between 0 and 255, got ${number}`);
  }
  return number;
}

function opacity(value: number, argumentName: string, file: string, line: number): number {
  return rangeNumber(value, argumentName, 0, 1, file, line);
}

function percent(value: number, argumentName: string, file: string, line: number): number {
  return percentRange(value, argumentName, 0, 100, file, line) / 100;
}

function percentRange(value: number, argumentName: string, min: number, max: number, file: string, line: number): number {
  return rangeNumber(value, argumentName, min, max, file, line);
}

function hex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function trimFloat(value: number): string {
  return Number(value.toFixed(4)).toString();
}
