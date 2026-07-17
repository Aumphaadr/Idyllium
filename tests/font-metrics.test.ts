import { createRuntimeFontMetricsService } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function close(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-8, `${message}: expected ${expected}, got ${actual}`);
}

const service = createRuntimeFontMetricsService();
const lobster = new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'spec/some_fonts/Lobster-Regular.ttf')));

const latin = service.measure(lobster, 'Hello', 40);
close(latin.width, 80.88, 'Lobster Latin advance width');
close(latin.height, 40, 'Lobster text box height');

const cyrillic = service.measure(lobster, 'Привет', 40);
close(cyrillic.width, 129.84, 'Lobster Cyrillic advance width');

let missingGlyphError = '';
try {
  service.measure(lobster, '🧭', 40);
} catch (error) {
  missingGlyphError = error instanceof Error ? error.message : String(error);
}
assert(missingGlyphError.includes('does not contain character'), `unexpected missing glyph error: ${missingGlyphError}`);

const woff2 = new Uint8Array(fs.readFileSync(path.join(
  process.cwd(),
  'packages/web-ide/fonts/SourceCodePro-Regular.woff2',
)));
const woff2Latin = service.measure(woff2, 'Hello', 16);
close(woff2Latin.width, 48, 'Source Code Pro WOFF2 Latin advance width');
close(woff2Latin.height, 16, 'Source Code Pro WOFF2 text box height');

const woff2Cyrillic = service.measure(woff2, 'Привет', 20);
close(woff2Cyrillic.width, 72, 'Source Code Pro WOFF2 Cyrillic advance width');

const defaultFont = service.measureDefault('Hello, мир!', 20);
close(defaultFont.width, 132, 'default Canvas font advance width');
close(defaultFont.height, 20, 'default Canvas font text box height');

console.log('font metrics: exact TTF/WOFF2 advances, Cyrillic, missing glyph and default font pass');
