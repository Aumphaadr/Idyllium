const pako = require('pako') as {
  inflate(data: Uint8Array): Uint8Array;
};
const fontkit = require('fontkit') as {
  create(data: Uint8Array): FontkitFont;
};

import {
  DEFAULT_FONT_ADVANCE,
  DEFAULT_FONT_UNITS_PER_EM,
  defaultFontHasCodePoint,
} from './default-font-metrics';

export interface RuntimeTextMetrics {
  readonly width: number;
  readonly height: number;
}

export interface RuntimeFontMetricsService {
  measure(bytes: Uint8Array, text: string, fontSize: number): RuntimeTextMetrics;
  measureDefault(text: string, fontSize: number): RuntimeTextMetrics;
}

interface ParsedFontMetrics {
  readonly unitsPerEm: number;
  readonly advanceForCodePoint: (codePoint: number) => number | null;
}

interface FontkitGlyph {
  readonly id: number;
  readonly advanceWidth: number;
}

interface FontkitFont {
  readonly unitsPerEm: number;
  hasGlyphForCodePoint(codePoint: number): boolean;
  glyphForCodePoint(codePoint: number): FontkitGlyph;
}

export function createRuntimeFontMetricsService(): RuntimeFontMetricsService {
  const cache = new WeakMap<Uint8Array, ParsedFontMetrics>();
  return {
    measure(bytes, text, fontSize) {
      let font = cache.get(bytes);
      if (!font) {
        font = parseFontMetrics(bytes);
        cache.set(bytes, font);
      }
      return measureWithFont(font, text, fontSize, 'loaded font');
    },
    measureDefault(text, fontSize) {
      return measureWithFont({
        unitsPerEm: DEFAULT_FONT_UNITS_PER_EM,
        advanceForCodePoint: (codePoint) => defaultFontHasCodePoint(codePoint) ? DEFAULT_FONT_ADVANCE : null,
      }, text, fontSize, 'default font');
    },
  };
}

function measureWithFont(
  font: ParsedFontMetrics,
  text: string,
  fontSize: number,
  fontDescription: string,
): RuntimeTextMetrics {
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new Error(`font size must be greater than 0, got ${fontSize}`);
  }

  let advance = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) as number;
    if (codePoint === 10 || codePoint === 13) {
      throw new Error('multiline drawable.Text geometry is not supported');
    }
    const glyphAdvance = font.advanceForCodePoint(codePoint);
    if (glyphAdvance === null) {
      throw new Error(`${fontDescription} does not contain character ${formatCodePoint(codePoint)}`);
    }
    advance += glyphAdvance;
  }

  return {
    width: advance * fontSize / font.unitsPerEm,
    height: fontSize,
  };
}

function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

function parseFontMetrics(bytes: Uint8Array): ParsedFontMetrics {
  const signature = tag(bytes, 0);
  if (signature === 'wOF2') {
    return readWoff2Metrics(bytes);
  }
  const tables = signature === 'wOFF' ? readWoffTables(bytes) : readSfntTables(bytes);
  const head = requiredTable(tables, 'head');
  const hhea = requiredTable(tables, 'hhea');
  const hmtx = requiredTable(tables, 'hmtx');
  const maxp = requiredTable(tables, 'maxp');
  const cmap = requiredTable(tables, 'cmap');

  const unitsPerEm = uint16(head, 18);
  const glyphCount = uint16(maxp, 4);
  const longMetricCount = uint16(hhea, 34);
  if (unitsPerEm <= 0) throw new Error('font head table has invalid unitsPerEm');
  if (glyphCount <= 0) throw new Error('font maxp table has no glyphs');
  if (longMetricCount <= 0 || longMetricCount > glyphCount) {
    throw new Error('font hhea table has invalid horizontal metric count');
  }

  const advances: number[] = [];
  let lastAdvance = 0;
  for (let index = 0; index < longMetricCount; index += 1) {
    lastAdvance = uint16(hmtx, index * 4);
    advances.push(lastAdvance);
  }
  while (advances.length < glyphCount) advances.push(lastAdvance);
  const glyphIndexLookup = cmapGlyphLookup(cmap);

  return {
    unitsPerEm,
    advanceForCodePoint: (codePoint) => {
      const glyphIndex = glyphIndexLookup(codePoint);
      if (glyphIndex === null || glyphIndex === 0) return null;
      const advance = advances[glyphIndex];
      if (advance === undefined) {
        throw new Error(`font maps ${formatCodePoint(codePoint)} to invalid glyph ${glyphIndex}`);
      }
      return advance;
    },
  };
}

function readWoff2Metrics(bytes: Uint8Array): ParsedFontMetrics {
  let font: FontkitFont;
  try {
    font = fontkit.create(bytes);
  } catch (error) {
    throw new Error(`cannot decode WOFF2 font: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Number.isFinite(font.unitsPerEm) || font.unitsPerEm <= 0) {
    throw new Error('WOFF2 font has invalid unitsPerEm');
  }
  return {
    unitsPerEm: font.unitsPerEm,
    advanceForCodePoint: (codePoint) => {
      if (!font.hasGlyphForCodePoint(codePoint)) return null;
      const glyph = font.glyphForCodePoint(codePoint);
      if (!glyph || glyph.id === 0 || !Number.isFinite(glyph.advanceWidth)) return null;
      return glyph.advanceWidth;
    },
  };
}

function readSfntTables(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const signature = tag(bytes, 0);
  if (signature !== '\u0000\u0001\u0000\u0000' && signature !== 'true' && signature !== 'OTTO') {
    throw new Error('unsupported sfnt font signature');
  }
  const tableCount = uint16(bytes, 4);
  const result = new Map<string, Uint8Array>();
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    const tableTag = tag(bytes, record);
    const offset = uint32(bytes, record + 8);
    const length = uint32(bytes, record + 12);
    result.set(tableTag, byteSlice(bytes, offset, length));
  }
  return result;
}

function readWoffTables(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const tableCount = uint16(bytes, 12);
  const result = new Map<string, Uint8Array>();
  for (let index = 0; index < tableCount; index += 1) {
    const record = 44 + index * 20;
    const tableTag = tag(bytes, record);
    const offset = uint32(bytes, record + 4);
    const compressedLength = uint32(bytes, record + 8);
    const originalLength = uint32(bytes, record + 12);
    const compressed = byteSlice(bytes, offset, compressedLength);
    const table = compressedLength === originalLength ? compressed : pako.inflate(compressed);
    if (table.length !== originalLength) {
      throw new Error(`WOFF table '${tableTag}' has invalid decompressed length`);
    }
    result.set(tableTag, table);
  }
  return result;
}

function requiredTable(tables: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array {
  const table = tables.get(name);
  if (!table) throw new Error(`font does not contain required '${name}' table`);
  return table;
}

function cmapGlyphLookup(cmap: Uint8Array): (codePoint: number) => number | null {
  const recordCount = uint16(cmap, 2);
  let selected: { readonly offset: number; readonly format: number; readonly score: number } | null = null;
  for (let index = 0; index < recordCount; index += 1) {
    const record = 4 + index * 8;
    const platform = uint16(cmap, record);
    const encoding = uint16(cmap, record + 2);
    const offset = uint32(cmap, record + 4);
    const format = uint16(cmap, offset);
    const score = cmapScore(platform, encoding, format);
    if (score > 0 && (!selected || score > selected.score)) selected = { offset, format, score };
  }
  if (!selected) throw new Error('font cmap table has no supported Unicode mapping');
  if (selected.format === 12) return cmapFormat12Lookup(cmap, selected.offset);
  return cmapFormat4Lookup(cmap, selected.offset);
}

function cmapScore(platform: number, encoding: number, format: number): number {
  if (format !== 4 && format !== 12) return 0;
  if (platform === 3 && encoding === 10 && format === 12) return 500;
  if (platform === 0 && format === 12) return 450;
  if (platform === 3 && (encoding === 1 || encoding === 0) && format === 4) return 400;
  if (platform === 0 && format === 4) return 350;
  return 0;
}

function cmapFormat12Lookup(cmap: Uint8Array, offset: number): (codePoint: number) => number | null {
  const groupCount = uint32(cmap, offset + 12);
  return (codePoint) => {
    let low = 0;
    let high = groupCount - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const group = offset + 16 + middle * 12;
      const start = uint32(cmap, group);
      const end = uint32(cmap, group + 4);
      if (codePoint < start) {
        high = middle - 1;
      } else if (codePoint > end) {
        low = middle + 1;
      } else {
        return uint32(cmap, group + 8) + codePoint - start;
      }
    }
    return null;
  };
}

function cmapFormat4Lookup(cmap: Uint8Array, offset: number): (codePoint: number) => number | null {
  const segmentCount = uint16(cmap, offset + 6) / 2;
  const endCodes = offset + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const deltas = startCodes + segmentCount * 2;
  const rangeOffsets = deltas + segmentCount * 2;

  return (codePoint) => {
    if (codePoint > 0xffff) return null;
    for (let index = 0; index < segmentCount; index += 1) {
      const end = uint16(cmap, endCodes + index * 2);
      if (codePoint > end) continue;
      const start = uint16(cmap, startCodes + index * 2);
      if (codePoint < start) return null;
      const delta = int16(cmap, deltas + index * 2);
      const rangeOffsetAddress = rangeOffsets + index * 2;
      const rangeOffset = uint16(cmap, rangeOffsetAddress);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyphAddress = rangeOffsetAddress + rangeOffset + (codePoint - start) * 2;
      const glyph = uint16(cmap, glyphAddress);
      return glyph === 0 ? null : (glyph + delta) & 0xffff;
    }
    return null;
  };
}

function byteSlice(bytes: Uint8Array, offset: number, length: number): Uint8Array {
  requireRange(bytes, offset, length);
  return bytes.slice(offset, offset + length);
}

function tag(bytes: Uint8Array, offset: number): string {
  requireRange(bytes, offset, 4);
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function uint16(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 2);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, false);
}

function int16(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 2);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt16(offset, false);
}

function uint32(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 4);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function requireRange(bytes: Uint8Array, offset: number, length: number): void {
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error(`font table is truncated at byte ${offset}`);
  }
}
