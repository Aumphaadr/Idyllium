// Смоук библиотеки qr (1.6.2): запись, чтение, UTF-8, уровни, отказы словами.
import { runWithMemoryFiles } from './smoke-harness';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tests: Array<readonly [string, () => Promise<void>]> = [];
const test = (name: string, body: () => Promise<void>): void => { tests.push([name, body]); };

const MANY = [
  'string function many(string piece, int count) {',
  '    string result = "";',
  '    for (int i = 0; i < count; i = i + 1) {',
  '        result = result + piece;',
  '    }',
  '    return result;',
  '}',
  '',
];

async function output(lines: readonly string[]): Promise<string[]> {
  const result = await runWithMemoryFiles(['use colors;', 'use console;', 'use image;', 'use qr;', '', ...MANY, 'main() {', ...lines, '}'].join('\n'), {});
  return result.runtime.getOutput().split('\n');
}

test('encode gives a square table of cells, and the table is the same every time', async () => {
  const lines = await output([
    '    dyn_array<dyn_array<bool>> grid = qr.encode("Idyllium");',
    '    console.writeln(grid.length, " ", grid[0].length, " ", grid[20].length);',
    '    console.writeln(grid[0]);',
    '    console.writeln(grid == qr.encode("Idyllium", "medium"), " ", grid == qr.encode("Idyllium", "L"));',
    '    console.writeln(qr.encode("Idyllium", "L").length, " ", qr.encode("Idyllium", "high").length, " ", qr.encode("").length);',
  ]);
  assert(lines[0] === '21 21 21', `a short text is a 21×21 code: ${lines[0]}`);
  // Угловой «глаз» — семь тёмных клеток подряд: по нему сканер и находит код.
  assert(lines[1] === '[true, true, true, true, true, true, true, false, false, false, false, true, true, false, true, true, true, true, true, true, true]',
    `the first row must be deterministic (lessons quote it): ${lines[1]}`);
  assert(lines[2] === 'true false', `a level word equals its letter, another level is another table: ${lines[2]}`);
  assert(lines[3] === '21 25 21', `a higher level needs a bigger code: ${lines[3]}`);
});

test('Russian text and emoji survive the trip through a picture (UTF-8 always)', async () => {
  // Кодер по умолчанию берёт младший байт символа: «Привет» кодируется без ошибки и читается
  // мусором. Это тихое враньё — страж первым делом.
  const lines = await output([
    '    image.Static picture = qr.to_static("Привет, мир! 🐸", 4, "Q");',
    '    console.writeln(picture.width, "x", picture.height, " ", qr.has_code(picture));',
    '    console.writeln(qr.decode(picture));',
    '    image.Bitmap canvas;',
    '    canvas.create_from_image(qr.to_static("из битмапа"));',
    '    console.writeln(qr.decode(canvas));',
    '    console.writeln(qr.has_code(picture.scale(0.5, 0.5)));',
  ]);
  assert(/^\d+x\d+ true$/u.test(lines[0]), `the picture is square and readable: ${lines[0]}`);
  assert(lines[1] === 'Привет, мир! 🐸', `UTF-8 must come back intact: ${JSON.stringify(lines[1])}`);
  assert(lines[2] === 'из битмапа', `image.Bitmap is readable too: ${JSON.stringify(lines[2])}`);
  assert(lines[3] === 'true', `a picture scaled down twice still reads: ${lines[3]}`);
});

test('capacity is counted in bytes, and fits() agrees with encode() to the byte', async () => {
  const lines = await output([
    '    console.writeln(qr.capacity(), " ", qr.capacity("L"), " ", qr.capacity("M"), " ", qr.capacity("quartile"), " ", qr.capacity("H"));',
    '    console.writeln(qr.fits(many("a", 2331)), " ", qr.fits(many("a", 2332)), " ", qr.fits(many("я", 1165)), " ", qr.fits(many("я", 1166)));',
    '    console.writeln(qr.encode(many("a", 2953), "low").length, " ", qr.encode(many("a", 1273), "high").length);',
    '    try { dyn_array<dyn_array<bool>> g = qr.encode(many("я", 1200)); } catch (err) { console.writeln(err.message); }',
    '    try { dyn_array<dyn_array<bool>> g = qr.encode(many("a", 2954), "L"); } catch (err) { console.writeln(err.message); }',
  ]);
  assert(lines[0] === '2331 2953 2331 1663 1273', `capacities by level: ${lines[0]}`);
  assert(lines[1] === 'true false true false', `a Russian letter is two bytes: ${lines[1]}`);
  assert(lines[2] === '177 177', `the promised capacity really fits the biggest code: ${lines[2]}`);
  assert(lines[3] === 'qr.encode() text is too long for level "M": 2400 bytes, the limit is 2331 — shorten the text or use a lower level', lines[3]);
  assert(lines[4] === 'qr.encode() text is too long for level "L": 2954 bytes, the limit is 2953 — shorten the text', lines[4]);
});

test('refusals speak in words', async () => {
  const lines = await output([
    '    try { dyn_array<dyn_array<bool>> g = qr.encode("x", "X"); } catch (err) { console.writeln(err.message); }',
    '    try { int n = qr.capacity("Low"); } catch (err) { console.writeln(err.message); }',
    '    try { image.Static p = qr.to_static("x", 0); } catch (err) { console.writeln(err.message); }',
    '    try { image.Static p = qr.to_static(many("a", 2000), 64, "L"); } catch (err) { console.writeln(err.message); }',
    '    image.Bitmap blank;',
    '    blank.create(80, 80);',
    '    console.writeln(qr.has_code(blank));',
    '    try { string s = qr.decode(blank); } catch (err) { console.writeln(err.message); }',
    '    image.Static unloaded;',
    '    try { string s = qr.decode(unloaded); } catch (err) { console.writeln(err.message); }',
  ]);
  assert(lines[0] === 'qr.encode() level must be "L", "M", "Q", "H" or "low", "medium", "quartile", "high", got "X"', lines[0]);
  assert(lines[1] === 'qr.capacity() level must be "L", "M", "Q", "H" or "low", "medium", "quartile", "high", got "Low"', lines[1]);
  assert(lines[2] === 'qr.to_static() scale must be between 1 and 64, got 0', lines[2]);
  assert(lines[3] === 'qr.to_static() picture would be 10048 px wide, the limit is 4096 — for this text use a scale of 26 or less', lines[3]);
  assert(lines[4] === 'false', `an empty picture has no code: ${lines[4]}`);
  assert(lines[5] === 'qr.decode() found no QR code in the picture — check qr.has_code() first', lines[5]);
  assert(lines[6] === 'qr.decode() cannot be used before load_from_file()', lines[6]);
});

test('a damaged code still reads at level H — and does not at level L', async () => {
  // Опыт для урока про помехоустойчивость: закрашиваем квадрат посреди кода.
  const lines = await output([
    '    string text = "Idyllium: код, который переживает кляксу";',
    '    image.Bitmap strong;',
    '    strong.create_from_image(qr.to_static(text, 6, "H"));',
    '    image.Bitmap weak;',
    '    weak.create_from_image(qr.to_static(text, 6, "L"));',
    '    strong.fill_rect(div(strong.width, 2) - 42, div(strong.height, 2) - 42, 84, 84, colors.RED);',
    '    weak.fill_rect(div(weak.width, 2) - 42, div(weak.height, 2) - 42, 84, 84, colors.RED);',
    '    console.writeln(qr.has_code(strong), " ", qr.has_code(weak));',
  ]);
  assert(lines[0] === 'true false', `level H survives a blot that kills level L: ${lines[0]}`);
});

(async () => {
  let failed = 0;
  for (const [name, body] of tests) {
    try {
      await body();
      console.log(`ok - ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`not ok - ${name}`);
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
  console.log(`\npassed: ${tests.length - failed}`);
  console.log(`failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
})();
