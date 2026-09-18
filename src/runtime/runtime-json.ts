// ─── JSON: значения, парсер и сериализация — модуль рантайма ───────────────
// Вынесено из runtime.ts при декомпозиции 2026-08-29; содержимое — как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { contextFunction, defineRuntimeGetter, errorMessage, exactIntegerResult, finiteNumber, intArgument, integerNumber, isPlainObject, optionalNumberContext, stringArgument, validRange } from './runtime-shared';
import { IdylliumArray, IdylliumTimeStamp, valueOps } from './runtime-values';

type JsonRuntimeKind = 'null' | 'string' | 'int' | 'float' | 'bool' | 'object' | 'array';

export type JsonRuntimeValue = Record<string, unknown> & {
  __idylliumType: 'json.Value' | 'json.Object' | 'json.Array';
  __jsonKind: JsonRuntimeKind;
  __jsonValue?: unknown;
  __jsonEntries?: Map<string, JsonRuntimeValue>;
  __jsonItems?: JsonRuntimeValue[];
};

export function createJsonValue(value?: unknown, file = 'json', line = 0): JsonRuntimeValue {
  if (value === undefined || value === null) return createJsonPrimitive('null', null);
  if (isJsonRuntimeValue(value)) return value;
  if (typeof value === 'string') return createJsonPrimitive('string', value);
  if (typeof value === 'boolean') return createJsonPrimitive('bool', value);
  if (typeof value === 'bigint') return createJsonPrimitive('int', value);
  if (typeof value === 'number') {
    const number = finiteNumber(value, 'json.Value() value', file, line);
    return createJsonPrimitive(Number.isInteger(number) ? 'int' : 'float', number);
  }
  throw new IdylliumRuntimeError(file, line, `json.Value() cannot convert '${valueOps.typeName(value)}' to json.Value`);
}

export function createJsonObject(entries: Map<string, JsonRuntimeValue> = new Map()): JsonRuntimeValue {
  const obj = createJsonBase('json.Object', 'object');
  Object.defineProperty(obj, '__jsonEntries', {
    value: entries,
    enumerable: false,
    configurable: true,
  });
  defineRuntimeGetter(obj, 'length', () => entries.size);
  obj.has = contextFunction((key: unknown, file: string, line: number) => entries.has(stringArgument(key, 'json.Object.has() key', file, line)));
  obj.get = contextFunction((key: unknown, file: string, line: number) => {
    const name = stringArgument(key, 'json.Object.get() key', file, line);
    if (!entries.has(name)) {
      throw new IdylliumRuntimeError(file, line, `json object has no key '${name}'`);
    }
    const found = entries.get(name)!;
    // Адрес для отказов типа («json value "hero.stats.level" is string, expected int»): путь от
    // корня копится по мере спуска — get() дописывает ключ, at() — номер. В данные не попадает.
    rememberJsonPath(found, jsonPathOf(obj) === '' ? name : `${jsonPathOf(obj)}.${name}`);
    return found;
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

export function createJsonArray(items: JsonRuntimeValue[] = []): JsonRuntimeValue {
  const obj = createJsonBase('json.Array', 'array');
  Object.defineProperty(obj, '__jsonItems', {
    value: items,
    enumerable: false,
    configurable: true,
  });
  defineRuntimeGetter(obj, 'length', () => items.length);
  obj.at = contextFunction((index: unknown, file: string, line: number) => {
    const position = jsonArrayIndex(items, index, 'json.Array.at()', file, line);
    const found = items[position];
    rememberJsonPath(found, `${jsonPathOf(obj)}[${position}]`);
    return found;
  });
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
    // int точен на любом размере (канон 2026-08-22) — у to_int() нет потолка;
    // границы остались только у ЯЧЕЕК to_int64()/to_uint64().
    const integer = jsonIntegerValue(obj, 'int', file, line);
    if (typeof integer === 'number') return integer;
    return exactIntegerResult(integer);
  });
  obj.to_int64 = contextFunction((file: string, line: number) => {
    const integer = jsonIntegerAsBigInt(obj, 'int64', file, line);
    const minimum = -(1n << 63n);
    const maximum = (1n << 63n) - 1n;
    if (integer < minimum || integer > maximum) {
      throw new IdylliumRuntimeError(file, line, `json integer ${integer} is outside the types.int64 range`);
    }
    return integer;
  });
  obj.to_uint64 = contextFunction((file: string, line: number) => {
    const integer = jsonIntegerAsBigInt(obj, 'uint64', file, line);
    const maximum = (1n << 64n) - 1n;
    if (integer < 0n || integer > maximum) {
      throw new IdylliumRuntimeError(file, line, `json integer ${integer} is outside the types.uint64 range`);
    }
    return integer;
  });
  obj.to_float = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'int' || obj.__jsonKind === 'float') {
      const number = Number(obj.__jsonValue);
      if (Number.isFinite(number)) return number;
      throw new IdylliumRuntimeError(file, line, `json number ${String(obj.__jsonValue)} is outside the float range`);
    }
    throwJsonExpected(obj, 'float', file, line);
  });
  obj.to_bool = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'bool') return obj.__jsonValue as boolean;
    throwJsonExpected(obj, 'bool', file, line);
  });
  obj.to_object = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'object') return inheritJsonPath(jsonObjectValue(obj), obj);
    throwJsonExpected(obj, 'object', file, line);
  });
  obj.to_array = contextFunction((file: string, line: number) => {
    if (obj.__jsonKind === 'array') return inheritJsonPath(jsonArrayValue(obj), obj);
    throwJsonExpected(obj, 'array', file, line);
  });
  obj.set_null = () => setJsonPrimitiveValue(obj, 'null', null);
  obj.set_string = contextFunction((value: unknown, file: string, line: number) => {
    setJsonPrimitiveValue(obj, 'string', stringArgument(value, 'json.Value.set_string() value', file, line));
  });
  obj.set_int = contextFunction((value: unknown, file: string, line: number) => {
    setJsonPrimitiveValue(obj, 'int', jsonIntegerArgument(value, 'json.Value.set_int() value', file, line));
  });
  obj.set_float = contextFunction((value: unknown, file: string, line: number) => {
    setJsonPrimitiveValue(obj, 'float', finiteNumber(value, 'json.Value.set_float() value', file, line));
  });
  obj.set_bool = contextFunction((value: unknown, file: string, line: number) => {
    if (typeof value !== 'boolean') {
      throw new IdylliumRuntimeError(file, line, `json.Value.set_bool() value must be bool, got '${valueOps.typeName(value)}'`);
    }
    setJsonPrimitiveValue(obj, 'bool', value);
  });
  obj.set_object = contextFunction((value: unknown, file: string, line: number) => {
    setJsonNestedValue(obj, 'object', expectJsonKind(value, 'object', 'json.Value.set_object() value', file, line));
  });
  obj.set_array = contextFunction((value: unknown, file: string, line: number) => {
    setJsonNestedValue(obj, 'array', expectJsonKind(value, 'array', 'json.Value.set_array() value', file, line));
  });
  obj.to_json = contextFunction((file: string, line: number) => jsonSerialize(obj, 0, file, line));
  obj.to_pretty_json = contextFunction((indentOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
    const context = optionalNumberContext(indentOrFile, fileOrLine, maybeLine);
    const indent = context.value === undefined ? 2 : jsonIndent(context.value, context.file, context.line);
    return jsonSerialize(obj, indent, context.file, context.line);
  });
  obj.toString = () => jsonSerialize(obj, 0, 'json', 0);
  return obj;
}

export function parseJsonValue(text: string, file: string, line: number): JsonRuntimeValue {
  try {
    return new ExactJsonParser(text).parse();
  } catch (error) {
    if (error instanceof RangeError) {
      // «Maximum call stack size exceeded» из V8 — жаргон движка
      throw new IdylliumRuntimeError(file, line, 'json.parse() invalid JSON: the text is nested too deeply');
    }
    throw new IdylliumRuntimeError(file, line, `json.parse() invalid JSON: ${errorMessage(error)}`);
  }
}

export class ExactJsonParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): JsonRuntimeValue {
    this.skipWhitespace();
    if (this.index >= this.source.length) this.fail('expected a JSON value');
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.source.length) this.fail(`unexpected character ${JSON.stringify(this.source[this.index])}`);
    return value;
  }

  private parseValue(): JsonRuntimeValue {
    this.skipWhitespace();
    const character = this.source[this.index];
    if (character === '"') return createJsonValue(this.parseString());
    if (character === '{') return this.parseObject();
    if (character === '[') return this.parseArray();
    if (character === 't') return this.parseLiteral('true', createJsonValue(true));
    if (character === 'f') return this.parseLiteral('false', createJsonValue(false));
    if (character === 'n') return this.parseLiteral('null', createJsonValue());
    if (character === '-' || (character >= '0' && character <= '9')) return this.parseNumber();
    if (character === undefined) this.fail('expected a JSON value');
    this.fail(`unexpected character ${JSON.stringify(character)}`);
  }

  private parseObject(): JsonRuntimeValue {
    this.index++;
    this.skipWhitespace();
    const entries = new Map<string, JsonRuntimeValue>();
    if (this.consume('}')) return createJsonObject(entries);

    while (true) {
      if (this.source[this.index] !== '"') this.fail('expected a string key');
      const key = this.parseString();
      this.skipWhitespace();
      if (!this.consume(':')) this.fail("expected ':' after object key");
      // Дубль ключа — громко, как у Object.add: раньше последний молча затирал первый.
      if (entries.has(key)) this.fail(`key ${JSON.stringify(key)} is repeated in one object`);
      entries.set(key, this.parseValue());
      this.skipWhitespace();
      if (this.consume('}')) return createJsonObject(entries);
      if (!this.consume(',')) this.fail("expected ',' or '}' after object value");
      this.skipWhitespace();
    }
  }

  private parseArray(): JsonRuntimeValue {
    this.index++;
    this.skipWhitespace();
    const items: JsonRuntimeValue[] = [];
    if (this.consume(']')) return createJsonArray(items);

    while (true) {
      items.push(this.parseValue());
      this.skipWhitespace();
      if (this.consume(']')) return createJsonArray(items);
      if (!this.consume(',')) this.fail("expected ',' or ']' after array value");
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index++;
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (character === '"') {
        this.index++;
        try {
          return JSON.parse(this.source.slice(start, this.index)) as string;
        } catch {
          this.fail('invalid string escape');
        }
      }
      if (character === '\\') {
        this.index += 2;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) this.fail('unescaped control character in string');
      this.index++;
    }
    this.fail('unterminated string');
  }

  private parseNumber(): JsonRuntimeValue {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(this.source.slice(this.index));
    if (!match) this.fail('invalid number');
    const token = match[0];
    this.index += token.length;

    if (!/[.eE]/u.test(token)) {
      const exact = BigInt(token);
      if (exact >= BigInt(Number.MIN_SAFE_INTEGER) && exact <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return createJsonPrimitive('int', Number(exact));
      }
      return createJsonPrimitive('int', exact);
    }

    const number = Number(token);
    if (!Number.isFinite(number)) this.fail(`number ${token} is outside the supported float range`);
    return createJsonPrimitive(Number.isInteger(number) ? 'int' : 'float', number);
  }

  private parseLiteral(text: string, value: JsonRuntimeValue): JsonRuntimeValue {
    if (!this.source.startsWith(text, this.index)) this.fail(`expected '${text}'`);
    this.index += text.length;
    return value;
  }

  private consume(character: string): boolean {
    if (this.source[this.index] !== character) return false;
    this.index++;
    return true;
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length && /[\u0009\u000a\u000d\u0020]/u.test(this.source[this.index])) {
      this.index++;
    }
  }

  private fail(message: string): never {
    const prefix = this.source.slice(0, this.index);
    const line = prefix.split('\n').length;
    const lastNewline = prefix.lastIndexOf('\n');
    const column = this.index - lastNewline;
    throw new Error(`${message} at line ${line}, column ${column}`);
  }
}

export function jsonSerialize(value: JsonRuntimeValue, indent: number, file: string, line: number): string {
  return jsonSerializeValue(value, indent, 0, new Set(), file, line);
}

function jsonSerializeValue(
  value: JsonRuntimeValue,
  indent: number,
  depth: number,
  stack: Set<JsonRuntimeValue>,
  file: string,
  line: number,
): string {
  if (value.__jsonKind === 'null') return 'null';
  if (value.__jsonKind === 'string') return JSON.stringify(value.__jsonValue);
  if (value.__jsonKind === 'bool') return value.__jsonValue ? 'true' : 'false';
  if (value.__jsonKind === 'int') return String(value.__jsonValue);
  if (value.__jsonKind === 'float') {
    const serialized = JSON.stringify(value.__jsonValue);
    if (serialized !== undefined) return serialized;
    throw new IdylliumRuntimeError(file, line, `cannot serialize JSON number ${String(value.__jsonValue)}`);
  }

  const nested = isJsonRuntimeValue(value.__jsonValue) ? value.__jsonValue : value;
  if (stack.has(nested)) throw new IdylliumRuntimeError(file, line, 'cannot serialize cyclic JSON value');
  stack.add(nested);
  try {
    if (value.__jsonKind === 'array') {
      const items = jsonItems(nested).map((item) => jsonSerializeValue(item, indent, depth + 1, stack, file, line));
      return jsonSerializeCollection('[', ']', items, indent, depth);
    }
    const entries = [...jsonEntries(nested)].map(([key, item]) => {
      const separator = indent > 0 ? ': ' : ':';
      return `${JSON.stringify(key)}${separator}${jsonSerializeValue(item, indent, depth + 1, stack, file, line)}`;
    });
    return jsonSerializeCollection('{', '}', entries, indent, depth);
  } finally {
    stack.delete(nested);
  }
}

function jsonSerializeCollection(open: string, close: string, items: readonly string[], indent: number, depth: number): string {
  if (items.length === 0) return `${open}${close}`;
  if (indent === 0) return `${open}${items.join(',')}${close}`;
  const innerPadding = ' '.repeat(indent * (depth + 1));
  const outerPadding = ' '.repeat(indent * depth);
  return `${open}\n${innerPadding}${items.join(`,\n${innerPadding}`)}\n${outerPadding}${close}`;
}

export function isJsonRuntimeValue(value: unknown): value is JsonRuntimeValue {
  return isPlainObject(value)
    && typeof value.__idylliumType === 'string'
    && ['json.Value', 'json.Object', 'json.Array'].includes(value.__idylliumType)
    && typeof value.__jsonKind === 'string';
}

export function expectJsonValue(value: unknown, argumentName: string, file: string, line: number): JsonRuntimeValue {
  if (isJsonRuntimeValue(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} expects json.Value, got '${valueOps.typeName(value)}'`);
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

export function jsonEntries(value: JsonRuntimeValue): Map<string, JsonRuntimeValue> {
  return value.__jsonEntries instanceof Map ? value.__jsonEntries : new Map();
}

export function jsonItems(value: JsonRuntimeValue): JsonRuntimeValue[] {
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

function jsonPathOf(value: JsonRuntimeValue): string {
  return typeof value.__jsonKeyHint === 'string' ? value.__jsonKeyHint : '';
}

function rememberJsonPath(value: JsonRuntimeValue, path: string): void {
  Object.defineProperty(value, '__jsonKeyHint', { value: path, enumerable: false, configurable: true, writable: true });
}

/** Value и его вид-контейнер (to_object/to_array) бывают разными узлами: адрес переезжает следом. */
function inheritJsonPath(container: JsonRuntimeValue, source: JsonRuntimeValue): JsonRuntimeValue {
  if (container !== source && jsonPathOf(source) !== '') rememberJsonPath(container, jsonPathOf(source));
  return container;
}

function throwJsonExpected(value: JsonRuntimeValue, expected: string, file: string, line: number): never {
  // Словами языка (int/float, не «number») и с адресом значения, если до него дошли через get()/at():
  // «json value "hero.items[1]" is string, expected int».
  const path = jsonPathOf(value);
  const hint = path === '' ? '' : ` ${JSON.stringify(path)}`;
  // to_string() — распаковщик строки, а не «текстовый вид»: подсказываем, где текстовый вид взять.
  const advice = expected === 'string' && value.__jsonKind !== 'null' && value.__jsonKind !== 'object' && value.__jsonKind !== 'array'
    ? ' — to_string() only unpacks a string; the text of any value is to_string(value)'
    : '';
  throw new IdylliumRuntimeError(file, line, `json value${hint} is ${jsonKindText(value)}, expected ${expected}${advice}`);
}

function jsonKindText(value: JsonRuntimeValue): string {
  return value.__jsonKind;
}

export function jsonIntegerValue(
  value: JsonRuntimeValue,
  expected: string,
  file: string,
  line: number,
): number | bigint {
  if (value.__jsonKind !== 'int') throwJsonExpected(value, expected, file, line);
  const integer = value.__jsonValue;
  if (typeof integer === 'bigint') return integer;
  if (typeof integer === 'number' && Number.isInteger(integer)) return integer;
  throw new IdylliumRuntimeError(file, line, 'json integer contains an invalid runtime value');
}

export function jsonIntegerAsBigInt(value: JsonRuntimeValue, expected: string, file: string, line: number): bigint {
  const integer = jsonIntegerValue(value, expected, file, line);
  return typeof integer === 'bigint' ? integer : BigInt(integer);
}

function jsonIntegerArgument(value: unknown, argumentName: string, file: string, line: number): number | bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be int, got '${String(value)}'`);
}
