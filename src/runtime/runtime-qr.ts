// ─── Библиотека qr (1.6.2): QR-код как массив, как картинка и как текст ────
// Спека Idyllium-backstage/tech/spec/some_qr_library/01 (вердикты владельца
// 2026-09-18): функции без классов — encode (матрица клеток), to_static
// (готовая картинка), fits/capacity (проверка до отказа), decode/has_code
// (чтение с картинки).
//
// Запись — qrcode-generator, чтение — jsQR; обе чистый JS без DOM, поэтому
// библиотека одинакова в CLI, Web IDE и VS Code.
//
// ГЛАВНАЯ ЛОВУШКА (находка прогона): у кодера байтовый режим по умолчанию берёт
// младший байт символа — «Привет» кодируется без ошибки, а читается мусором.
// Поэтому UTF-8 включён всегда, и ёмкость считается в БАЙТАХ: русская буква —
// два байта, эмодзи — четыре.
import { RuntimeObject, contextFunction, splitContextArgs } from './runtime-shared';
import { IdylliumArray, valueOps } from './runtime-values';
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObjectState } from './runtime-state';
import { RuntimeRasterImage } from './image-service';
import { createGeneratedStaticImage, storedBitmap, storedStaticImage } from './runtime-image';

interface QrCodeBuilder {
  addData(text: string, mode: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
}

type QrCodeFactory = ((typeNumber: number, level: string) => QrCodeBuilder) & {
  stringToBytes: (text: string) => number[];
  stringToBytesFuncs: Record<string, (text: string) => number[]>;
};

/** Node отдаёт CommonJS-вариант пакета (сама функция), сборщик браузерного ядра — ESM (функция в `default`). */
function unwrapDefault<T>(loaded: unknown): T {
  const wrapped = loaded as { default?: T } | null;
  return (wrapped && typeof wrapped === 'object' && wrapped.default !== undefined ? wrapped.default : loaded) as T;
}

const createQrCode = unwrapDefault<QrCodeFactory>(require('qrcode-generator'));
createQrCode.stringToBytes = createQrCode.stringToBytesFuncs['UTF-8'];

const readQrCode = unwrapDefault<(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => { data: string } | null>(require('jsqr'));

type QrLevel = 'L' | 'M' | 'Q' | 'H';

/** Сколько байт вмещает самый большой код (версия 40) на каждом уровне коррекции. */
const QR_CAPACITY_BYTES: Readonly<Record<QrLevel, number>> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

/** Уровень называют и буквой стандарта, и словом (вердикт владельца). */
const QR_LEVEL_NAMES: Readonly<Record<string, QrLevel>> = {
  L: 'L', M: 'M', Q: 'Q', H: 'H',
  low: 'L', medium: 'M', quartile: 'Q', high: 'H',
};

const QR_QUIET_ZONE = 4;
const QR_MAX_PICTURE_SIDE = 4096;

function qrLevel(value: unknown, methodName: string, file: string, line: number): QrLevel {
  if (value === undefined) return 'M';
  const level = typeof value === 'string' ? QR_LEVEL_NAMES[value] : undefined;
  if (level) return level;
  const got = typeof value === 'string' ? JSON.stringify(value) : `'${valueOps.typeName(value)}'`;
  throw new IdylliumRuntimeError(
    file,
    line,
    `${methodName} level must be "L", "M", "Q", "H" or "low", "medium", "quartile", "high", got ${got}`,
  );
}

function qrText(value: unknown, methodName: string, file: string, line: number): string {
  if (typeof value === 'string') return value;
  throw new IdylliumRuntimeError(file, line, `${methodName} text must be string, got '${valueOps.typeName(value)}'`);
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function buildQrCode(text: string, level: QrLevel, methodName: string, file: string, line: number): QrCodeBuilder {
  const bytes = utf8Length(text);
  const limit = QR_CAPACITY_BYTES[level];
  if (bytes > limit) {
    const advice = level === 'L' ? 'shorten the text' : 'shorten the text or use a lower level';
    throw new IdylliumRuntimeError(
      file,
      line,
      `${methodName} text is too long for level "${level}": ${bytes} bytes, the limit is ${limit} — ${advice}`,
    );
  }
  const code = createQrCode(0, level);
  code.addData(text, 'Byte');
  code.make();
  return code;
}

function qrPictureRaster(code: QrCodeBuilder, scale: number): RuntimeRasterImage {
  const modules = code.getModuleCount();
  const side = (modules + QR_QUIET_ZONE * 2) * scale;
  const pixels = new Uint8Array(side * side * 4).fill(255);
  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (!code.isDark(row, column)) continue;
      for (let y = 0; y < scale; y += 1) {
        let at = (((row + QR_QUIET_ZONE) * scale + y) * side + (column + QR_QUIET_ZONE) * scale) * 4;
        for (let x = 0; x < scale; x += 1, at += 4) {
          pixels[at] = 0;
          pixels[at + 1] = 0;
          pixels[at + 2] = 0;
        }
      }
    }
  }
  return { width: side, height: side, pixels };
}

function pictureRaster(picture: unknown, methodName: string, file: string, line: number): RuntimeRasterImage {
  const object = picture as RuntimeObject | null;
  const type = object && typeof object === 'object' ? object.__idylliumType : undefined;
  if (type === 'image.Static') return storedStaticImage(object as RuntimeObject, methodName, file, line).raster;
  if (type === 'image.Bitmap') return storedBitmap(object as RuntimeObject, methodName, file, line).raster;
  throw new IdylliumRuntimeError(file, line, `${methodName} picture must be image.Static or image.Bitmap, got '${valueOps.typeName(picture)}'`);
}

function readPicture(raster: RuntimeRasterImage): string | null {
  const pixels = new Uint8ClampedArray(raster.pixels.buffer, raster.pixels.byteOffset, raster.pixels.byteLength);
  // Код бывает и светлым по тёмному (снимок тёмной консоли) — пробуем оба прочтения.
  const found = readQrCode(pixels, raster.width, raster.height, { inversionAttempts: 'attemptBoth' });
  return found ? found.data : null;
}

export function createQrModule(state: RuntimeObjectState): Record<string, unknown> {
  return {
    encode: contextFunction((...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const text = qrText(values[0], 'qr.encode()', file, line);
      const code = buildQrCode(text, qrLevel(values[1], 'qr.encode()', file, line), 'qr.encode()', file, line);
      const modules = code.getModuleCount();
      const rows: IdylliumArray[] = [];
      for (let row = 0; row < modules; row += 1) {
        const cells: boolean[] = [];
        for (let column = 0; column < modules; column += 1) cells.push(code.isDark(row, column));
        rows.push(IdylliumArray.from(cells, true, null, () => false));
      }
      return IdylliumArray.from(rows, true, null, () => IdylliumArray.from([], true, null, () => false));
    }),
    to_static: contextFunction(async (...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const text = qrText(values[0], 'qr.to_static()', file, line);
      const scale = values[1] === undefined ? 8 : Number(values[1]);
      if (!Number.isInteger(scale) || scale < 1 || scale > 64) {
        throw new IdylliumRuntimeError(file, line, `qr.to_static() scale must be between 1 and 64, got ${String(values[1])}`);
      }
      const code = buildQrCode(text, qrLevel(values[2], 'qr.to_static()', file, line), 'qr.to_static()', file, line);
      const side = (code.getModuleCount() + QR_QUIET_ZONE * 2) * scale;
      if (side > QR_MAX_PICTURE_SIDE) {
        const fits = Math.floor(QR_MAX_PICTURE_SIDE / (code.getModuleCount() + QR_QUIET_ZONE * 2));
        throw new IdylliumRuntimeError(
          file,
          line,
          `qr.to_static() picture would be ${side} px wide, the limit is ${QR_MAX_PICTURE_SIDE} — for this text use a scale of ${fits} or less`,
        );
      }
      return createGeneratedStaticImage(qrPictureRaster(code, scale), 'qr', state, file, line);
    }),
    fits: contextFunction((...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const text = qrText(values[0], 'qr.fits()', file, line);
      return utf8Length(text) <= QR_CAPACITY_BYTES[qrLevel(values[1], 'qr.fits()', file, line)];
    }),
    capacity: contextFunction((...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      return QR_CAPACITY_BYTES[qrLevel(values[0], 'qr.capacity()', file, line)];
    }),
    decode: contextFunction((picture: unknown, file: string, line: number) => {
      const text = readPicture(pictureRaster(picture, 'qr.decode()', file, line));
      if (text === null) throw new IdylliumRuntimeError(file, line, 'qr.decode() found no QR code in the picture — check qr.has_code() first');
      return text;
    }),
    has_code: contextFunction((picture: unknown, file: string, line: number) => (
      readPicture(pictureRaster(picture, 'qr.has_code()', file, line)) !== null
    )),
  };
}
