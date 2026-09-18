// Смоук «проекта в ссылке» (1.6.1): кодек `#p1=` — туда и обратно, потолки,
// обрезанная мессенджером ссылка, чужой формат, грязные пути и подписи.
import { share } from '../src/browser';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tests: Array<readonly [string, () => void]> = [];
const test = (name: string, body: () => void): void => { tests.push([name, body]); };

const SNAKE = [
  'use console;',
  '',
  'main() {',
  '    console.writeln("Привет, учитель! Это «Змейка» 🐍");',
  '}',
  '',
].join('\n');

function problemOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof share.ShareLinkError ? error.problem : `other: ${String(error)}`;
  }
  return 'no error';
}

test('a project survives the round trip through the address', () => {
  const link = share.encodeProjectLink({
    name: 'Змейка',
    from: 'Петя И., 7Б',
    idyllium: '1.6.1',
    current: 'lib/field.idyl',
    files: [{ path: 'main.idyl', text: SNAKE }, { path: 'lib/field.idyl', text: 'int size = 20;\n' }],
    assets: [{ path: 'hero.png', size: 3412, sha: '3f9a1c2b4d5e6f70' }],
  });
  assert(/^p1=[A-Za-z0-9_-]+$/u.test(link), `the link must be url-safe: ${link.slice(0, 40)}…`);
  const back = share.decodeProjectLink(`#${link}`);
  assert(back.name === 'Змейка' && back.from === 'Петя И., 7Б' && back.idyllium === '1.6.1', `labels: ${JSON.stringify(back)}`);
  assert(back.files.length === 2 && back.files[0].text === SNAKE, 'the text must come back byte for byte (Cyrillic and emoji too)');
  assert(back.current === 'lib/field.idyl', `the open file is remembered: ${back.current}`);
  assert(back.assets.length === 1 && back.assets[0].sha === '3f9a1c2b4d5e6f70' && back.assets[0].size === 3412, 'asset notes ride along');
});

test('compression keeps an ordinary program within one messenger message', () => {
  const big = Array.from({ length: 120 }, (_, index) => `    console.writeln("Строка номер ${index}: сумма равна ", ${index} + ${index * 2});`).join('\n');
  const source = `use console;\n\nmain() {\n${big}\n}\n`;
  const link = share.encodeProjectLink({ name: '', from: '', idyllium: '', current: '', files: [{ path: 'main.idyl', text: source }], assets: [] });
  assert(source.length > 7000, 'the probe program is a big one');
  assert(link.length < share.SHARE_LENGTH_ONE_MESSAGE, `a ${source.length}-char program packs into ${link.length} chars`);
  assert(share.shareLengthVerdict(1999) === 'everywhere' && share.shareLengthVerdict(4000) === 'one-message' && share.shareLengthVerdict(5000) === 'file-only', 'length traffic light');
});

test('a link cut by a messenger says so instead of opening garbage', () => {
  const link = share.encodeProjectLink({ name: 'x', from: '', idyllium: '', current: '', files: [{ path: 'main.idyl', text: SNAKE.repeat(20) }], assets: [] });
  assert(problemOf(() => share.decodeProjectLink(link.slice(0, link.length - 25))) === 'broken', 'a truncated link is broken');
  assert(problemOf(() => share.decodeProjectLink(link.slice(0, 40))) === 'broken', 'a stub of a link is broken');
  const flipped = link.slice(0, 30) + (link[30] === 'A' ? 'B' : 'A') + link.slice(31);
  assert(problemOf(() => share.decodeProjectLink(flipped)) === 'broken', 'a damaged character is caught by the checksum');
  // Перенос строки посреди ссылки (почтовый клиент) — не поломка.
  const wrapped = `${link.slice(0, 50)}\n  ${link.slice(50)}`;
  assert(share.decodeProjectLink(wrapped).files[0].path === 'main.idyl', 'whitespace inside the link is forgiven');
});

test('foreign and future addresses are told apart', () => {
  assert(problemOf(() => share.decodeProjectLink('#unit=abc')) === 'not-a-share-link', 'a unit address is not a project');
  assert(problemOf(() => share.decodeProjectLink('#p2=abc')) === 'newer-format', 'a future format is named as such');
  assert(share.looksLikeProjectLink('#p1=abc') && share.looksLikeProjectLink('p7=x') && !share.looksLikeProjectLink('#settings'), 'address sniffing');
});

test('hostile content is refused or defused', () => {
  const pack = (raw: unknown): string => {
    // Собираем ссылку в обход нормализации — как это сделал бы злоумышленник.
    const pako = require('pako') as { deflateRaw(data: Uint8Array): Uint8Array };
    const json = new TextEncoder().encode(JSON.stringify(raw));
    let crc = 0xffffffff;
    for (const byte of json) {
      crc ^= byte;
      for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const packed = pako.deflateRaw(json);
    const payload = new Uint8Array(4 + packed.length);
    payload.set([(crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255]);
    payload.set(packed, 4);
    return `p1=${share.bytesToBase64Url(payload)}`;
  };
  assert(problemOf(() => share.decodeProjectLink(pack({ files: [{ path: '../../etc/passwd', text: 'x' }] }))) === 'bad-content', 'a path with .. is refused');
  assert(problemOf(() => share.decodeProjectLink(pack({ files: [] }))) === 'bad-content', 'a project without files is refused');
  assert(problemOf(() => share.decodeProjectLink(pack({ files: [{ path: 'a.idyl', text: 'x' }, { path: 'a.idyl', text: 'y' }] }))) === 'bad-content', 'a repeated path is refused');
  // Бомба: три мегабайта нулей сжимаются в три килобайта — потолок распаковки держит.
  assert(problemOf(() => share.decodeProjectLink(pack({ files: [{ path: 'a.idyl', text: '0'.repeat(3 * 1024 * 1024) }] }))) === 'too-big', 'a decompression bomb hits the ceiling');
  const labelled = share.decodeProjectLink(pack({ name: 'Игра\n<b>жирно</b>', from: 'x'.repeat(500), files: [{ path: '/lib//util.idyl', text: '' }] }));
  assert(!labelled.name.includes('\n') && labelled.from.length === 60, `labels are single-line and bounded: ${JSON.stringify(labelled.name)}`);
  assert(labelled.files[0].path === 'lib/util.idyl', `paths are normalized: ${labelled.files[0].path}`);
});

test('a link travels as a QR picture: 2953 characters is the ceiling, and the picture reads back', () => {
  // Те же библиотеки, что Web IDE кладёт в vendor/: кодер и декодер обязаны сходиться
  // и на самом плотном коде (версия 40). Порог 2953 зашит в интерфейс — страж держит его честным.
  const qrcode = require('qrcode-generator') as (type: number, level: string) => {
    addData(text: string, mode: string): void; make(): void; getModuleCount(): number; isDark(row: number, column: number): boolean;
  };
  const jsQR = require('jsqr') as (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const linkOf = (length: number): string => {
    let text = 'https://aumphaadr.github.io/Idyllium/#p1=';
    let seed = 7;
    while (text.length < length) { seed = (seed * 1103515245 + 12345) % 2147483648; text += alphabet[seed % 64]; }
    return text;
  };
  const picture = (text: string, scale: number): { data: Uint8ClampedArray; size: number } => {
    const qr = qrcode(0, 'L');
    qr.addData(text, 'Byte');
    qr.make();
    const modules = qr.getModuleCount();
    const size = (modules + 8) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let row = 0; row < modules; row += 1) for (let column = 0; column < modules; column += 1) {
      if (!qr.isDark(row, column)) continue;
      for (let y = 0; y < scale; y += 1) for (let x = 0; x < scale; x += 1) {
        const at = (((row + 4) * scale + y) * size + (column + 4) * scale + x) * 4;
        data[at] = 0; data[at + 1] = 0; data[at + 2] = 0;
      }
    }
    return { data, size };
  };
  for (const length of [300, 2953]) {
    const text = linkOf(length);
    const { data, size } = picture(text, 3);
    const found = jsQR(data, size, size);
    assert(found !== null && found.data === text, `a ${length}-char link must read back from its QR picture`);
  }
  let overflow = false;
  try { picture(linkOf(2954), 2); } catch { overflow = true; }
  assert(overflow, '2954 characters must not fit: the interface promises exactly 2953');
});

let failed = 0;
for (const [name, body] of tests) {
  try {
    body();
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
