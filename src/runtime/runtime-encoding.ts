// ─── Кодировки: Unicode, байты, кодовые страницы — модуль рантайма ─────────
// 1.5.7 (спека some_encoding_growth/01, вердикты владельца 2026-09-11):
// 34 однобайтовые страницы из генерата encoding-tables.ts (одинаковые на всех
// хостах — TextDecoder больше не источник), UTF-8/16/32 своим кодом, формы
// «с BOM» отдельными именами, строгость по умолчанию и safe=false для потерь,
// спутники is_valid/convert/guess и транспортный Base64.
import { IdylliumRuntimeError } from './runtime-errors';
import { byteRange, integerNumber, stringArgument } from './runtime-shared';
import { expectArray } from './runtime-values';
import { ENCODING_UNASSIGNED, ENCODING_UPPER_HALVES } from './encoding-tables';

// Тот же приём, что в ядре: в браузерном бандле Buffer приходит заглушкой,
// поэтому UTF-8 кодируется через TextEncoder, а не Buffer.
const utf8Encoder = new TextEncoder();

export type EncodingKind = 'sbcs' | 'utf-8' | 'utf-16' | 'utf-32';

export interface EncodingSpec {
  readonly id: string;
  readonly family: string;
  readonly kind: EncodingKind;
  /** Для форм Unicode: порядок байтов; null — «с BOM» (читать метку, писать LE + метку). */
  readonly bigEndian?: boolean | null;
  readonly aliases: readonly string[];
}

interface SingleByteTable {
  readonly byteToChar: ReadonlyArray<string | null>;
  readonly charToByte: ReadonlyMap<string, number>;
}

const FAMILY_DOS = 'DOS';
const FAMILY_WINDOWS = 'Windows';
const FAMILY_ISO = 'ISO 8859 и ASCII';
const FAMILY_KOI_MAC = 'КОИ-8 и Macintosh';
const FAMILY_UNICODE = 'Формы Unicode';

function sbcsSpec(id: string, family: string, aliases: readonly string[]): EncodingSpec {
  return { id, family, kind: 'sbcs', aliases };
}

const DOS_PAGES = ['437', '850', '852', '855', '857', '866'];
const WINDOWS_PAGES = ['1250', '1251', '1252', '1253', '1254', '1255', '1256', '1257', '1258'];
const ISO_PAGES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '14', '15', '16'];
// Latin-N по номенклатуре ISO: latin1 = 8859-1 … latin10 = 8859-16.
const LATIN_NUMBERS: Readonly<Record<string, string>> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '9': '5', '10': '6', '13': '7', '14': '8', '15': '9', '16': '10',
};

export const ENCODINGS: readonly EncodingSpec[] = [
  ...DOS_PAGES.map((page) => sbcsSpec(`cp${page}`, FAMILY_DOS, [`ibm${page}`, `dos${page}`, `ibm-${page}`, `cp-${page}`])),
  ...WINDOWS_PAGES.map((page) => sbcsSpec(`windows-${page}`, FAMILY_WINDOWS, [`cp${page}`, `win${page}`, `cp-${page}`, `win-${page}`, `windows${page}`])),
  sbcsSpec('ascii', FAMILY_ISO, ['us-ascii', 'ansi_x3.4-1968']),
  ...ISO_PAGES.map((page) => sbcsSpec(`iso-8859-${page}`, FAMILY_ISO, [
    `iso8859-${page}`, `iso_8859-${page}`, `iso8859${page}`, `8859-${page}`,
    ...(LATIN_NUMBERS[page] ? [`latin${LATIN_NUMBERS[page]}`, `latin-${LATIN_NUMBERS[page]}`] : []),
  ])),
  sbcsSpec('koi8-r', FAMILY_KOI_MAC, ['koi8r', 'koi8', 'koi-8']),
  sbcsSpec('koi8-u', FAMILY_KOI_MAC, ['koi8u']),
  sbcsSpec('mac-roman', FAMILY_KOI_MAC, ['macintosh', 'macroman', 'mac']),
  sbcsSpec('mac-cyrillic', FAMILY_KOI_MAC, ['x-mac-cyrillic', 'maccyrillic', 'mac-cyr']),
  { id: 'utf-8', family: FAMILY_UNICODE, kind: 'utf-8', aliases: ['utf8', 'unicode-1-1-utf-8'] },
  { id: 'utf-16', family: FAMILY_UNICODE, kind: 'utf-16', bigEndian: null, aliases: ['utf16', 'ucs-2', 'unicode'] },
  { id: 'utf-16le', family: FAMILY_UNICODE, kind: 'utf-16', bigEndian: false, aliases: ['utf16le', 'utf-16-le'] },
  { id: 'utf-16be', family: FAMILY_UNICODE, kind: 'utf-16', bigEndian: true, aliases: ['utf16be', 'utf-16-be'] },
  { id: 'utf-32', family: FAMILY_UNICODE, kind: 'utf-32', bigEndian: null, aliases: ['utf32', 'ucs-4'] },
  { id: 'utf-32le', family: FAMILY_UNICODE, kind: 'utf-32', bigEndian: false, aliases: ['utf32le', 'utf-32-le'] },
  { id: 'utf-32be', family: FAMILY_UNICODE, kind: 'utf-32', bigEndian: true, aliases: ['utf32be', 'utf-32-be'] },
];

const ENCODING_BY_NAME: ReadonlyMap<string, EncodingSpec> = (() => {
  const map = new Map<string, EncodingSpec>();
  for (const spec of ENCODINGS) {
    map.set(spec.id, spec);
    for (const alias of spec.aliases) map.set(alias, spec);
  }
  return map;
})();

const SINGLE_BYTE_TABLES: ReadonlyMap<string, SingleByteTable> = (() => {
  const map = new Map<string, SingleByteTable>();
  for (const [id, high] of ENCODING_UPPER_HALVES) {
    const chars = Array.from(high);
    const byteToChar: Array<string | null> = [];
    const charToByte = new Map<string, number>();
    for (let byte = 0; byte < 0x80; byte += 1) {
      const char = String.fromCharCode(byte);
      byteToChar.push(char);
      charToByte.set(char, byte);
    }
    for (let index = 0; index < 128; index += 1) {
      const char = chars[index] === ENCODING_UNASSIGNED ? null : chars[index];
      byteToChar.push(char);
      // Первым выигрывает младший байт — важно там, где символ встречается дважды.
      if (char !== null && !charToByte.has(char)) charToByte.set(char, 0x80 + index);
    }
    map.set(id, { byteToChar, charToByte });
  }
  return map;
})();

/** Имена в порядке семейств — так печатается encoding.list_encodings(). */
export function listEncodingNames(): string[] {
  return ENCODINGS.map((spec) => spec.id);
}

export function encodingFamily(id: string): string {
  return ENCODING_BY_NAME.get(id)?.family ?? '';
}

/** Подпись кодировки в ошибках: ASCII заглавными (так учит урок), остальные — id. */
function encodingLabel(spec: EncodingSpec): string {
  return spec.id === 'ascii' ? 'ASCII' : spec.id;
}

function editDistance(left: string, right: string): number {
  const previous: number[] = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const held = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = held;
    }
  }
  return previous[right.length];
}

/** Ближайшее известное имя для подсказки «did you mean» — или null. */
function closestEncodingName(name: string): string | null {
  const compact = name.replace(/[\s_-]/gu, '');
  let best: string | null = null;
  let bestDistance = 3;
  for (const spec of ENCODINGS) {
    for (const candidate of [spec.id, ...spec.aliases]) {
      const distance = Math.min(
        editDistance(name, candidate),
        editDistance(compact, candidate.replace(/[\s_-]/gu, '')),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = spec.id;
      }
    }
  }
  return best;
}

export function normalizeEncoding(value: unknown, file: string, line: number): EncodingSpec {
  const raw = stringArgument(value, 'encoding name', file, line);
  const name = raw.trim().toLowerCase();
  const spec = ENCODING_BY_NAME.get(name);
  if (spec) return spec;
  const closest = closestEncodingName(name);
  const hint = closest ? ` — did you mean '${closest}'?` : ' — see encoding.list_encodings()';
  throw new IdylliumRuntimeError(file, line, `unknown encoding '${raw}'${hint}`);
}

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

export function singleCharacter(value: unknown, argumentName: string, file: string, line: number): string {
  const text = stringArgument(value, argumentName, file, line);
  const characters = Array.from(text);
  if (characters.length !== 1) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be a single character, got ${JSON.stringify(text)}`);
  }
  return characters[0];
}

export function isUnicodeScalarValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff);
}

export function formatByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

// Байт классической замены при encode с safe=false: знак вопроса — именно
// его подставляли Windows-программы вместо непредставимых символов.
const REPLACEMENT_BYTE = 63;
const REPLACEMENT_CHAR = '�';

// ─── текст → байты ─────────────────────────────────────────────────────────

export class EncodingFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncodingFailure';
  }
}

/** Кодирует уже проверенную строку; при safe=true бросает EncodingFailure с
 *  текстом причины без имени функции — вызывающий оборачивает в свой жанр. */
export function encodeText(text: string, spec: EncodingSpec, safe: boolean): number[] {
  const characters = Array.from(text);
  if (spec.kind === 'utf-8') {
    for (let index = 0; index < characters.length; index += 1) {
      const codepoint = characters[index].codePointAt(0) ?? 0;
      if (!isUnicodeScalarValue(codepoint)) {
        if (!safe) { characters[index] = '?'; continue; }
        throw new EncodingFailure(`invalid Unicode character at position ${index}`);
      }
    }
    return Array.from(utf8Encoder.encode(characters.join('')));
  }
  if (spec.kind === 'utf-16' || spec.kind === 'utf-32') {
    const bigEndian = spec.bigEndian === true;
    const bytes: number[] = [];
    if (spec.bigEndian === null) {
      // Форма «с BOM»: метка порядка байтов + little-endian (как «Unicode» в Блокноте).
      bytes.push(...(spec.kind === 'utf-16' ? [0xff, 0xfe] : [0xff, 0xfe, 0x00, 0x00]));
    }
    for (let index = 0; index < characters.length; index += 1) {
      let codepoint = characters[index].codePointAt(0) ?? 0;
      if (!isUnicodeScalarValue(codepoint)) {
        if (!safe) codepoint = REPLACEMENT_BYTE;
        else throw new EncodingFailure(`invalid Unicode character at position ${index}`);
      }
      if (spec.kind === 'utf-32') {
        const quad = [(codepoint >>> 24) & 0xff, (codepoint >>> 16) & 0xff, (codepoint >>> 8) & 0xff, codepoint & 0xff];
        bytes.push(...(bigEndian ? quad : quad.reverse()));
        continue;
      }
      const units = codepoint > 0xffff
        ? [0xd800 + ((codepoint - 0x10000) >> 10), 0xdc00 + ((codepoint - 0x10000) & 0x3ff)]
        : [codepoint];
      for (const unit of units) bytes.push(...(bigEndian ? [unit >> 8, unit & 0xff] : [unit & 0xff, unit >> 8]));
    }
    return bytes;
  }
  const table = SINGLE_BYTE_TABLES.get(spec.id)!;
  return characters.map((char, index) => {
    const byte = table.charToByte.get(char);
    if (byte !== undefined) return byte;
    if (!safe) return REPLACEMENT_BYTE;
    throw new EncodingFailure(`character '${char}' is not valid ${encodingLabel(spec)} at position ${index}`);
  });
}

export function encodingEncode(text: unknown, encoding: unknown, safe: boolean, file: string, line: number): number[] {
  const value = stringArgument(text, 'encoding.encode() text', file, line);
  const spec = normalizeEncoding(encoding, file, line);
  try {
    return encodeText(value, spec, safe);
  } catch (error) {
    if (error instanceof EncodingFailure) {
      throw new IdylliumRuntimeError(file, line, spec.kind === 'utf-8' ? `encoding.encode() ${error.message}` : error.message);
    }
    throw error;
  }
}

// ─── байты → текст ─────────────────────────────────────────────────────────

/** Раскодирует байты; при safe=true бросает EncodingFailure. UTF-8 BOM НЕ
 *  пропускается — decode буквален; файлы снимают метку сами (readTextBytes). */
export function decodeBytes(bytes: readonly number[], spec: EncodingSpec, safe: boolean): string {
  if (spec.kind === 'utf-8') return decodeUtf8Bytes(bytes, safe);
  if (spec.kind === 'utf-16') return decodeUtf16(bytes, spec, safe);
  if (spec.kind === 'utf-32') return decodeUtf32(bytes, spec, safe);
  const table = SINGLE_BYTE_TABLES.get(spec.id)!;
  let out = '';
  for (let index = 0; index < bytes.length; index += 1) {
    const char = table.byteToChar[bytes[index]];
    if (char !== null && char !== undefined) {
      out += char;
      continue;
    }
    if (!safe) {
      out += REPLACEMENT_CHAR;
      continue;
    }
    throw new EncodingFailure(`byte ${bytes[index]} is not valid ${encodingLabel(spec)} at index ${index}`);
  }
  return out;
}

export function encodingDecode(codes: unknown, encoding: unknown, safe: boolean, file: string, line: number): string {
  const array = expectArray(codes, file, line);
  const spec = normalizeEncoding(encoding, file, line);
  const bytes = array.values().map((code: unknown, index: number) => {
    const value = integerNumber(code, `encoding.decode() byte at index ${index}`, file, line);
    return byteRange(value, `encoding.decode() byte at index ${index}`, 0, 255, file, line);
  });
  try {
    return decodeBytes(bytes, spec, safe);
  } catch (error) {
    if (error instanceof EncodingFailure) {
      throw new IdylliumRuntimeError(file, line, spec.kind === 'sbcs' ? error.message : `encoding.decode() ${error.message}`);
    }
    throw error;
  }
}

function invalidUtf8(bytes: readonly number[], index: number, reason: string): never {
  const shown = index < bytes.length ? ` (${formatByte(bytes[index])})` : '';
  throw new EncodingFailure(`invalid UTF-8 at byte ${index}${shown}: ${reason}`);
}

export function decodeUtf8Bytes(bytes: readonly number[], safe: boolean): string {
  let out = '';
  let index = 0;
  // safe=false: ромбик на КАЖДЫЙ негодный байт — байт 1251-текста, прочитанный
  // как UTF-8, даёт ровно один �, и «Нормальный» из 10 байт — 10 ромбиков (урок).
  const fail = (at: number, reason: string, _skip: number): void => {
    if (!safe) {
      out += REPLACEMENT_CHAR;
      index = (reason === 'invalid continuation byte' ? at - 1 : at) + 1;
      if (index <= at - 1) index = at;
      return;
    }
    invalidUtf8(bytes, at, reason);
  };
  while (index < bytes.length) {
    const lead = bytes[index];
    if (lead < 0x80) {
      out += String.fromCharCode(lead);
      index += 1;
      continue;
    }
    let need = 0;
    let codepoint = 0;
    // Допустимый диапазон ВТОРОГО байта зависит от лидера (WHATWG): так
    // избыточные (E0 80 80) и суррогатные (ED A0 80) последовательности
    // ловятся на первом же продолжающем байте.
    let secondLow = 0x80;
    let secondHigh = 0xbf;
    if (lead >= 0xc2 && lead <= 0xdf) { need = 1; codepoint = lead & 0x1f; }
    else if (lead >= 0xe0 && lead <= 0xef) {
      need = 2; codepoint = lead & 0x0f;
      if (lead === 0xe0) secondLow = 0xa0;
      if (lead === 0xed) secondHigh = 0x9f;
    }
    else if (lead >= 0xf0 && lead <= 0xf4) {
      need = 3; codepoint = lead & 0x07;
      if (lead === 0xf0) secondLow = 0x90;
      if (lead === 0xf4) secondHigh = 0x8f;
    }
    else { fail(index, 'invalid leading byte', 1); continue; }
    if (index + need >= bytes.length) { fail(index, 'incomplete sequence', bytes.length - index); continue; }
    let broken = false;
    for (let offset = 1; offset <= need; offset += 1) {
      const next = bytes[index + offset];
      const low = offset === 1 ? secondLow : 0x80;
      const high = offset === 1 ? secondHigh : 0xbf;
      if (next < low || next > high) {
        fail(index + offset, 'invalid continuation byte', offset);
        broken = true;
        break;
      }
      codepoint = (codepoint << 6) | (next & 0x3f);
    }
    if (broken) continue;
    const overlong = (need === 1 && codepoint < 0x80) || (need === 2 && codepoint < 0x800) || (need === 3 && codepoint < 0x10000);
    if (overlong) { fail(index, 'overlong sequence', need + 1); continue; }
    if (codepoint >= 0xd800 && codepoint <= 0xdfff) { fail(index, 'surrogate code point', need + 1); continue; }
    if (codepoint > 0x10ffff) { fail(index, 'code point beyond Unicode', need + 1); continue; }
    out += String.fromCodePoint(codepoint);
    index += need + 1;
  }
  return out;
}

/** Совместимость с прежним именем: строгий/мягкий разбор UTF-8 в жанре decode(). */
export function decodeUtf8(bytes: readonly number[], safe: boolean, file: string, line: number): string {
  try {
    return decodeUtf8Bytes(bytes, safe);
  } catch (error) {
    if (error instanceof EncodingFailure) throw new IdylliumRuntimeError(file, line, `encoding.decode() ${error.message}`);
    throw error;
  }
}

function decodeUtf16(bytes: readonly number[], spec: EncodingSpec, safe: boolean): string {
  let bigEndian = spec.bigEndian === true;
  let start = 0;
  if (spec.bigEndian === null) {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) { bigEndian = false; start = 2; }
    else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) { bigEndian = true; start = 2; }
    else if (bytes.length === 0) return '';
    else if (safe) throw new EncodingFailure('utf-16 needs a byte order mark — use utf-16le or utf-16be for bytes without one');
    else bigEndian = false;
  }
  let out = '';
  for (let index = start; index < bytes.length; index += 2) {
    if (index + 1 >= bytes.length) {
      if (!safe) { out += REPLACEMENT_CHAR; break; }
      throw new EncodingFailure(`invalid ${spec.id} at byte ${index}: half of a code unit`);
    }
    const unit = bigEndian ? (bytes[index] << 8) | bytes[index + 1] : (bytes[index + 1] << 8) | bytes[index];
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const nextIndex = index + 2;
      const next = nextIndex + 1 < bytes.length
        ? (bigEndian ? (bytes[nextIndex] << 8) | bytes[nextIndex + 1] : (bytes[nextIndex + 1] << 8) | bytes[nextIndex])
        : -1;
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += String.fromCharCode(unit, next);
        index += 2;
        continue;
      }
    }
    if (unit >= 0xd800 && unit <= 0xdfff) {
      if (!safe) { out += REPLACEMENT_CHAR; continue; }
      throw new EncodingFailure(`invalid ${spec.id} at byte ${index}: lone surrogate`);
    }
    out += String.fromCharCode(unit);
  }
  return out;
}

function decodeUtf32(bytes: readonly number[], spec: EncodingSpec, safe: boolean): string {
  let bigEndian = spec.bigEndian === true;
  let start = 0;
  if (spec.bigEndian === null) {
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) { bigEndian = false; start = 4; }
    else if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff) { bigEndian = true; start = 4; }
    else if (bytes.length === 0) return '';
    else if (safe) throw new EncodingFailure('utf-32 needs a byte order mark — use utf-32le or utf-32be for bytes without one');
    else bigEndian = false;
  }
  let out = '';
  for (let index = start; index < bytes.length; index += 4) {
    if (index + 3 >= bytes.length) {
      if (!safe) { out += REPLACEMENT_CHAR; break; }
      throw new EncodingFailure(`invalid ${spec.id} at byte ${index}: part of a code unit`);
    }
    const quad = bytes.slice(index, index + 4);
    const ordered = bigEndian ? quad : [...quad].reverse();
    const codepoint = ((ordered[0] << 24) >>> 0) + (ordered[1] << 16) + (ordered[2] << 8) + ordered[3];
    if (!isUnicodeScalarValue(codepoint)) {
      if (!safe) { out += REPLACEMENT_CHAR; continue; }
      throw new EncodingFailure(`invalid ${spec.id} at byte ${index}: code point ${codepoint} is outside Unicode`);
    }
    out += String.fromCodePoint(codepoint);
  }
  return out;
}

// ─── спутники ──────────────────────────────────────────────────────────────

export function encodingIsValid(codes: unknown, encoding: unknown, file: string, line: number): boolean {
  const array = expectArray(codes, file, line);
  const spec = normalizeEncoding(encoding, file, line);
  const bytes = array.values().map((code: unknown, index: number) => {
    const value = integerNumber(code, `encoding.is_valid() byte at index ${index}`, file, line);
    return byteRange(value, `encoding.is_valid() byte at index ${index}`, 0, 255, file, line);
  });
  try {
    decodeBytes(bytes, spec, true);
    return true;
  } catch (error) {
    if (error instanceof EncodingFailure) return false;
    throw error;
  }
}

export function encodingConvert(codes: unknown, from: unknown, to: unknown, safe: boolean, file: string, line: number): number[] {
  const text = encodingDecode(codes, from, safe, file, line);
  const target = normalizeEncoding(to, file, line);
  try {
    return encodeText(text, target, safe);
  } catch (error) {
    if (error instanceof EncodingFailure) throw new IdylliumRuntimeError(file, line, `encoding.convert() ${error.message}`);
    throw error;
  }
}

// Кириллические страницы, между которыми угадывает guess(). Порядок —
// приоритет при одинаковой расшифровке (текст из одних строчных букв в
// windows-1251 и mac-cyrillic — одни и те же байты).
const GUESS_CANDIDATES = ['windows-1251', 'koi8-r', 'cp866', 'mac-cyrillic', 'iso-8859-5', 'koi8-u'];

function isRussianLetter(code: number): boolean {
  return (code >= 0x0410 && code <= 0x044f) || code === 0x0401 || code === 0x0451;
}

// Є І Ї Ґ и строчные: буквы, но в русском тексте редкие — 1251-байты,
// прочитанные как mac-cyrillic, подсовывают их вместо заглавных.
function isUkrainianLetter(code: number): boolean {
  return (code >= 0x0404 && code <= 0x0407) || (code >= 0x0454 && code <= 0x0457) || code === 0x0490 || code === 0x0491;
}


function isCyrillicLowercase(code: number): boolean {
  return (code >= 0x0430 && code <= 0x044f) || code === 0x0451 || (code >= 0x0454 && code <= 0x0457) || code === 0x0491;
}

function isRussianTypography(code: number): boolean {
  return code === 0x00ab || code === 0x00bb || code === 0x2014 || code === 0x2013 || code === 0x2026
    || code === 0x201c || code === 0x201d || code === 0x2116 || code === 0x00a0 || code === 0x00b0;
}

/** Похожесть расшифровки на русский текст: доля «русских» символов среди
 *  не-ASCII, умноженная на правдоподобие регистра (1251-байты, прочитанные
 *  как KOI8-R, дают текст ИЗ ЗАГЛАВНЫХ вперемешку — так ловится подмена). */
function cyrillicScore(text: string): number {
  let good = 0;
  let bad = 0;
  let letters = 0;
  let lowercase = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) continue;
    if (isRussianLetter(code)) {
      good += 1;
      letters += 1;
      if (isCyrillicLowercase(code)) lowercase += 1;
    } else if (isUkrainianLetter(code)) {
      good += 0.3;
      bad += 0.7;
      letters += 1;
      if (isCyrillicLowercase(code)) lowercase += 1;
    } else if (isRussianTypography(code)) {
      good += 1;
    } else {
      bad += 1;
    }
  }
  const total = good + bad;
  if (total < 4) return 0; // по двум буквам не гадают
  // Чужой символ — сильная улика: доля в квадрате, чтобы одна «Ќ» вместо
  // заглавной заметно роняла кандидата.
  const share = (good / total) * (good / total);
  const caseShare = letters === 0 ? 1 : lowercase / letters;
  return share * (0.5 + 0.5 * caseShare);
}

/** Угадывает кодировку байтов: "ascii", "utf-8", одна из кириллических
 *  страниц — или "" когда уверенности нет. Никогда не выдаёт себя за знание. */
export function guessEncodingOfBytes(bytes: readonly number[]): string {
  if (bytes.length === 0) return '';
  // Метки порядка байтов узнаются раньше всего: файл «Unicode» из Блокнота —
  // это utf-16 с BOM, а не «похоже на windows-1251».
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0 && bytes[3] === 0) return 'utf-32';
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 0xfe && bytes[3] === 0xff) return 'utf-32';
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return 'utf-16';
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes.every((byte) => byte < 0x80)) return 'ascii';
  // Нулевой байт в тексте не встречается — это двоичные данные или UTF-16/32 без метки.
  if (bytes.includes(0)) return '';
  try {
    decodeUtf8Bytes(bytes, true);
    return 'utf-8';
  } catch (error) {
    if (!(error instanceof EncodingFailure)) throw error;
  }
  const ranked = GUESS_CANDIDATES.map((id) => {
    const text = decodeBytes(bytes, ENCODING_BY_NAME.get(id)!, false);
    return { id, text, score: cyrillicScore(text) };
  }).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (best.score < 0.8) return '';
  const rival = ranked.find((item) => item !== best && item.score >= best.score - 0.05 && item.text !== best.text);
  return rival ? '' : best.id;
}

export function encodingGuess(codes: unknown, file: string, line: number): string {
  const array = expectArray(codes, file, line);
  const bytes = array.values().map((code: unknown, index: number) => {
    const value = integerNumber(code, `encoding.guess() byte at index ${index}`, file, line);
    return byteRange(value, `encoding.guess() byte at index ${index}`, 0, 255, file, line);
  });
  return guessEncodingOfBytes(bytes);
}

// ─── Base64: транспортное кодирование байтов, не кодировка символов ────────

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: readonly number[]): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64_ALPHABET[(triple >> 18) & 63] + BASE64_ALPHABET[(triple >> 12) & 63];
    out += b === undefined ? '=' : BASE64_ALPHABET[(triple >> 6) & 63];
    out += c === undefined ? '=' : BASE64_ALPHABET[triple & 63];
  }
  return out;
}

export function base64ToBytes(text: string, file: string, line: number): number[] {
  const clean = text.replace(/\s+/gu, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  let padding = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (char === '=') {
      padding += 1;
      continue;
    }
    if (padding > 0) {
      throw new IdylliumRuntimeError(file, line, `encoding.from_base64() unexpected character '${char}' after padding at position ${index}`);
    }
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) {
      throw new IdylliumRuntimeError(file, line, `encoding.from_base64() invalid Base64 character '${char}' at position ${index}`);
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  if ((clean.length % 4 !== 0) || padding > 2) {
    throw new IdylliumRuntimeError(file, line, 'encoding.from_base64() text length must be a multiple of 4 (pad with = if needed)');
  }
  return bytes;
}

// ─── файлы: чтение и запись байтов в кодировке ────────────────────────────

/** Текст из байтов файла: строго; UTF-8 BOM пропускается (метка — не данные). */
export function decodeFileBytes(bytes: readonly number[], spec: EncodingSpec): string {
  if (spec.kind === 'utf-8' && bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodeBytes(bytes.slice(3), spec, true);
  }
  return decodeBytes(bytes, spec, true);
}

/** Подсказка для ошибки чтения файла: на что похожи байты (или ''). */
export function guessFileEncoding(bytes: readonly number[]): string {
  return guessEncodingOfBytes(bytes.length > 4096 ? bytes.slice(0, 4096) : bytes);
}
