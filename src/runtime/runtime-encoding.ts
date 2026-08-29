// ─── Кодировки: Unicode, байты, однобайтовые таблицы — модуль рантайма ─────
// Вынесено из runtime.ts при декомпозиции 2026-08-29; содержимое — как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { byteRange, integerNumber, stringArgument } from './runtime-shared';
import { expectArray } from './runtime-values';

// Тот же приём, что в ядре: в браузерном бандле Buffer приходит заглушкой.
const nodeBuffer: any = require('buffer').Buffer;

export type RuntimeEncoding = 'ascii' | 'utf-8' | 'windows-1251' | 'koi8-r' | 'cp866' | 'cp437' | 'windows-1252' | 'windows-1254';

interface SingleByteEncoding {
  readonly charToByte: ReadonlyMap<string, number>;
  readonly byteToChar: ReadonlyMap<number, string>;
}

// Верхняя половина CP437 (байты 0x80–0xFF) из эталонного кодека;
// нижняя половина совпадает с ASCII.

const CP437_HIGH_HALF = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00A0';

// Однобайтовые таблицы. Всё, кроме CP437, строится из WHATWG TextDecoder
// (стандартные лейблы, одинаковые в браузере и Node); CP437 в WHATWG-стандарт
// не входит — его верхняя половина зашита литералом из эталонного кодека.

export const SINGLE_BYTE_ENCODINGS: ReadonlyMap<string, SingleByteEncoding> = new Map([
  ['windows-1251', buildSingleByteEncoding('windows-1251')],
  ['koi8-r', buildSingleByteEncoding('koi8-r')],
  ['cp866', buildSingleByteEncoding('ibm866')],
  ['windows-1252', buildSingleByteEncoding('windows-1252')],
  ['windows-1254', buildSingleByteEncoding('windows-1254')],
  ['cp437', buildCp437Encoding()],
]);

// Разбор адреса общий для всех функций url: единый источник ошибки, если
// строка не похожа на адрес.

export function encodingCharToCodepoint(character: unknown, file: string, line: number): number {
  const char = singleCharacter(character, 'encoding.char_to_codepoint() character', file, line);
  const codepoint = char.codePointAt(0) ?? 0;
  if (!isUnicodeScalarValue(codepoint)) {
    throw new IdylliumRuntimeError(file, line, `encoding.char_to_codepoint() character is not a Unicode scalar value`);
  }
  return codepoint;
}

export function encodingCodepointToChar(codepoint: unknown, file: string, line: number): string {
  const value = integerNumber(codepoint, 'encoding.codepoint_to_char() codepoint', file, line);
  if (!isUnicodeScalarValue(value)) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `encoding.codepoint_to_char() codepoint must be a Unicode scalar value between 0 and 1114111, got ${value}`,
    );
  }
  return String.fromCodePoint(value);
}

// Байт классической замены при encode с safe=false: знак вопроса — именно
// его подставляли Windows-программы вместо непредставимых символов.

const REPLACEMENT_BYTE = 63;

export function encodingEncode(text: unknown, encoding: unknown, safe: boolean, file: string, line: number): number[] {
  const value = stringArgument(text, 'encoding.encode() text', file, line);
  const name = normalizeEncoding(encoding, file, line);

  const characters = Array.from(value);
  if (name === 'ascii') {
    return characters.map((char, index) => {
      const code = char.codePointAt(0) ?? 0;
      if (code <= 127) return code;
      if (!safe) return REPLACEMENT_BYTE;
      return asciiCode(char, file, line, index);
    });
  }
  if (name === 'utf-8') {
    for (let index = 0; index < characters.length; index++) {
      const codepoint = characters[index].codePointAt(0) ?? 0;
      if (!isUnicodeScalarValue(codepoint)) {
        if (!safe) { characters[index] = '?'; continue; }
        throw new IdylliumRuntimeError(file, line, `encoding.encode() invalid Unicode character at position ${index}`);
      }
    }
    return [...nodeBuffer.from(characters.join(''), 'utf8')];
  }

  const table = SINGLE_BYTE_ENCODINGS.get(name);
  if (!table) throw new IdylliumRuntimeError(file, line, `unknown encoding '${name}'`);
  return characters.map((char, index) => {
    if (!safe && !table.charToByte.has(char)) return REPLACEMENT_BYTE;
    return singleByteCharToInt(char, table, name, file, line, index);
  });
}

export function encodingDecode(codes: unknown, encoding: unknown, safe: boolean, file: string, line: number): string {
  const array = expectArray(codes, file, line);
  const name = normalizeEncoding(encoding, file, line);
  const bytes = array.values().map((code: any, index: number) => {
    const value = integerNumber(code, `encoding.decode() byte at index ${index}`, file, line);
    return byteRange(value, `encoding.decode() byte at index ${index}`, 0, 255, file, line);
  });

  if (name === 'ascii') {
    return bytes.map((code: any, index: number) => {
      if (code > 127 && !safe) return '\uFFFD';
      byteRange(code, `encoding.decode() ASCII byte at index ${index}`, 0, 127, file, line);
      return String.fromCodePoint(code);
    }).join('');
  }

  if (name === 'utf-8') {
    return decodeUtf8(bytes, safe, file, line);
  }

  const table = SINGLE_BYTE_ENCODINGS.get(name);
  if (!table) throw new IdylliumRuntimeError(file, line, `unknown encoding '${name}'`);
  return bytes.map((code: any, index: number) => singleByteIntToChar(code, table, name, file, line, index)).join('');
}

export function normalizeEncoding(value: unknown, file: string, line: number): RuntimeEncoding {
  const name = stringArgument(value, 'encoding name', file, line).toLowerCase();
  if (name === 'ascii') return 'ascii';
  if (name === 'utf-8' || name === 'utf8') return 'utf-8';
  if (name === 'windows-1251' || name === 'cp1251' || name === 'win1251') return 'windows-1251';
  if (name === 'koi8-r' || name === 'koi8r') return 'koi8-r';
  if (name === 'cp866' || name === 'ibm866' || name === 'dos866') return 'cp866';
  if (name === 'cp437' || name === 'ibm437' || name === 'dos437') return 'cp437';
  if (name === 'windows-1252' || name === 'cp1252' || name === 'win1252') return 'windows-1252';
  if (name === 'windows-1254' || name === 'cp1254' || name === 'win1254') return 'windows-1254';
  throw new IdylliumRuntimeError(file, line, `unknown encoding '${value}'`);
}

export function singleCharacter(value: unknown, argumentName: string, file: string, line: number): string {
  const text = stringArgument(value, argumentName, file, line);
  const chars = Array.from(text);
  if (chars.length !== 1) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must contain exactly one character, got ${JSON.stringify(text)}`);
  }
  return chars[0];
}

function asciiCode(char: string, file: string, line: number, position?: number): number {
  const code = char.codePointAt(0) ?? 0;
  if (code <= 127) return code;
  const suffix = position === undefined ? '' : ` at position ${position}`;
  throw new IdylliumRuntimeError(file, line, `character '${char}' is not valid ASCII${suffix}`);
}

function singleByteCharToInt(
  char: string,
  table: SingleByteEncoding,
  encoding: RuntimeEncoding,
  file: string,
  line: number,
  position?: number,
): number {
  const byte = table.charToByte.get(char);
  if (byte !== undefined) return byte;
  const suffix = position === undefined ? '' : ` at position ${position}`;
  throw new IdylliumRuntimeError(file, line, `character '${char}' is not valid ${encoding}${suffix}`);
}

function singleByteIntToChar(
  code: number,
  table: SingleByteEncoding,
  encoding: RuntimeEncoding,
  file: string,
  line: number,
  position?: number,
): string {
  const char = table.byteToChar.get(code);
  if (char !== undefined) return char;
  const suffix = position === undefined ? '' : ` at index ${position}`;
  throw new IdylliumRuntimeError(file, line, `byte ${code} is not valid ${encoding}${suffix}`);
}

function buildSingleByteEncoding(label: 'windows-1251' | 'koi8-r' | 'ibm866' | 'windows-1252' | 'windows-1254'): SingleByteEncoding {
  const charToByte = new Map<string, number>();
  const byteToChar = new Map<number, string>();
  const decoder = new TextDecoder(label, { fatal: true });
  for (let byte = 0; byte <= 255; byte++) {
    const char = decoder.decode(Uint8Array.of(byte));
    charToByte.set(char, byte);
    byteToChar.set(byte, char);
  }
  return { charToByte, byteToChar };
}

function buildCp437Encoding(): SingleByteEncoding {
  const charToByte = new Map<string, number>();
  const byteToChar = new Map<number, string>();
  const high = Array.from(CP437_HIGH_HALF);
  for (let byte = 0; byte <= 255; byte++) {
    const char = byte < 0x80 ? String.fromCharCode(byte) : high[byte - 0x80];
    if (!charToByte.has(char)) charToByte.set(char, byte);
    byteToChar.set(byte, char);
  }
  return { charToByte, byteToChar };
}

export function isUnicodeScalarValue(value: number): boolean {
  return value >= 0 && value <= 0x10FFFF && !(value >= 0xD800 && value <= 0xDFFF);
}

export function decodeUtf8(bytes: readonly number[], safe: boolean, file: string, line: number): string {
  let result = '';
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index];
    if (first <= 0x7F) {
      result += String.fromCodePoint(first);
      index++;
      continue;
    }

    let length = 0;
    let codepoint = 0;
    let secondMin = 0x80;
    let secondMax = 0xBF;
    if (first >= 0xC2 && first <= 0xDF) {
      length = 2;
      codepoint = first & 0x1F;
    } else if (first >= 0xE0 && first <= 0xEF) {
      length = 3;
      codepoint = first & 0x0F;
      if (first === 0xE0) secondMin = 0xA0;
      if (first === 0xED) secondMax = 0x9F;
    } else if (first >= 0xF0 && first <= 0xF4) {
      length = 4;
      codepoint = first & 0x07;
      if (first === 0xF0) secondMin = 0x90;
      if (first === 0xF4) secondMax = 0x8F;
    } else {
      // safe=false: негодный байт превращается в один символ замены,
      // разбор продолжается со следующего байта.
      if (!safe) { result += '\uFFFD'; index++; continue; }
      invalidUtf8(bytes, index, 'invalid leading byte', file, line);
    }

    if (index + length > bytes.length) {
      if (!safe) { result += '\uFFFD'; index++; continue; }
      invalidUtf8(bytes, index, 'incomplete sequence', file, line);
    }
    let broken = false;
    for (let offset = 1; offset < length; offset++) {
      const byte = bytes[index + offset];
      const min = offset === 1 ? secondMin : 0x80;
      const max = offset === 1 ? secondMax : 0xBF;
      if (byte < min || byte > max) {
        if (!safe) { broken = true; break; }
        invalidUtf8(bytes, index + offset, 'invalid continuation byte', file, line);
      }
      codepoint = (codepoint << 6) | (byte & 0x3F);
    }
    if (broken) {
      result += '\uFFFD';
      index++;
      continue;
    }

    result += String.fromCodePoint(codepoint);
    index += length;
  }
  return result;
}

function invalidUtf8(bytes: readonly number[], index: number, reason: string, file: string, line: number): never {
  const byte = bytes[index];
  const suffix = byte === undefined ? '' : ` (${formatByte(byte)})`;
  throw new IdylliumRuntimeError(file, line, `encoding.decode() invalid UTF-8 at byte ${index}${suffix}: ${reason}`);
}

export function formatByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}
