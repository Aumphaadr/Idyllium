const gifuct: any = require('gifuct-js');
const gifenc: any = require('gifenc');
const upng: any = require('upng-js');

export type RuntimeImageFormat = 'png' | 'apng' | 'jpeg' | 'gif' | 'bmp' | 'webp' | 'unknown';

export interface RuntimeRasterImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
}

export interface RuntimeAnimationFrame extends RuntimeRasterImage {
  readonly duration: number;
}

export interface RuntimeDecodedImage extends RuntimeRasterImage {
  readonly format: RuntimeImageFormat;
}

export interface RuntimeDecodedAnimation {
  readonly width: number;
  readonly height: number;
  readonly format: RuntimeImageFormat;
  readonly frames: readonly RuntimeAnimationFrame[];
}

export interface RuntimeImageService {
  decodeStatic(bytes: Uint8Array, format: RuntimeImageFormat): Promise<RuntimeDecodedImage>;
  encodeStatic(image: RuntimeRasterImage, format: RuntimeImageFormat): Promise<Uint8Array>;
  decodeAnimation(bytes: Uint8Array, format: RuntimeImageFormat): Promise<RuntimeDecodedAnimation>;
  encodeAnimation(animation: RuntimeDecodedAnimation, format: RuntimeImageFormat): Promise<Uint8Array>;
}

export function detectImageFormat(bytes: Uint8Array): RuntimeImageFormat {
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) {
    return pngHasAnimationControl(bytes) ? 'apng' : 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (asciiAt(bytes, 0, 6) === 'GIF87a' || asciiAt(bytes, 0, 6) === 'GIF89a') return 'gif';
  if (asciiAt(bytes, 0, 2) === 'BM') return 'bmp';
  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') return 'webp';
  return 'unknown';
}

export function imageMimeType(format: RuntimeImageFormat): string {
  switch (format) {
    case 'png':
    case 'apng':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function imageFormatFromPath(filePath: string): RuntimeImageFormat {
  const dot = filePath.lastIndexOf('.');
  const extension = dot >= 0 ? filePath.slice(dot + 1).toLowerCase() : '';
  if (extension === 'png') return 'png';
  if (extension === 'apng') return 'apng';
  if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
  if (extension === 'gif') return 'gif';
  if (extension === 'bmp') return 'bmp';
  if (extension === 'webp') return 'webp';
  return 'unknown';
}

export function rasterHasAlpha(image: RuntimeRasterImage): boolean {
  for (let index = 3; index < image.pixels.length; index += 4) {
    if (image.pixels[index] < 255) return true;
  }
  return false;
}

export function cloneRaster(image: RuntimeRasterImage): RuntimeRasterImage {
  return {
    width: image.width,
    height: image.height,
    pixels: new Uint8Array(image.pixels),
  };
}

export function scaleRaster(image: RuntimeRasterImage, scaleX: number, scaleY: number): RuntimeRasterImage {
  const width = Math.max(1, Math.round(image.width * Math.abs(scaleX)));
  const height = Math.max(1, Math.round(image.height * Math.abs(scaleY)));
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    let sourceY = Math.min(image.height - 1, Math.floor(y * image.height / height));
    if (scaleY < 0) sourceY = image.height - 1 - sourceY;
    for (let x = 0; x < width; x++) {
      let sourceX = Math.min(image.width - 1, Math.floor(x * image.width / width));
      if (scaleX < 0) sourceX = image.width - 1 - sourceX;
      copyPixel(image.pixels, (sourceY * image.width + sourceX) * 4, pixels, (y * width + x) * 4);
    }
  }

  return { width, height, pixels };
}

export function rotateRaster(image: RuntimeRasterImage, angle: number): RuntimeRasterImage {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 0) return cloneRaster(image);
  const width = normalized === 180 ? image.width : image.height;
  const height = normalized === 180 ? image.height : image.width;
  const pixels = new Uint8Array(width * height * 4);

  for (let sourceY = 0; sourceY < image.height; sourceY++) {
    for (let sourceX = 0; sourceX < image.width; sourceX++) {
      let targetX = 0;
      let targetY = 0;
      if (normalized === 90) {
        targetX = image.height - 1 - sourceY;
        targetY = sourceX;
      } else if (normalized === 180) {
        targetX = image.width - 1 - sourceX;
        targetY = image.height - 1 - sourceY;
      } else {
        targetX = sourceY;
        targetY = image.width - 1 - sourceX;
      }
      copyPixel(image.pixels, (sourceY * image.width + sourceX) * 4, pixels, (targetY * width + targetX) * 4);
    }
  }

  return { width, height, pixels };
}

export function tintRaster(
  image: RuntimeRasterImage,
  red: number,
  green: number,
  blue: number,
): RuntimeRasterImage {
  const result = cloneRaster(image);
  for (let index = 0; index < result.pixels.length; index += 4) {
    const luminance = Math.round(
      result.pixels[index] * 0.2126
      + result.pixels[index + 1] * 0.7152
      + result.pixels[index + 2] * 0.0722,
    );
    result.pixels[index] = Math.round(luminance * red / 255);
    result.pixels[index + 1] = Math.round(luminance * green / 255);
    result.pixels[index + 2] = Math.round(luminance * blue / 255);
  }
  return result;
}

export function opacityRaster(image: RuntimeRasterImage, opacity: number): RuntimeRasterImage {
  const result = cloneRaster(image);
  for (let index = 3; index < result.pixels.length; index += 4) {
    result.pixels[index] = Math.round(result.pixels[index] * opacity);
  }
  return result;
}

export function desaturateRaster(image: RuntimeRasterImage, amount: number): RuntimeRasterImage {
  const result = cloneRaster(image);
  for (let index = 0; index < result.pixels.length; index += 4) {
    const luminance = Math.round(
      result.pixels[index] * 0.2126
      + result.pixels[index + 1] * 0.7152
      + result.pixels[index + 2] * 0.0722,
    );
    result.pixels[index] = Math.round(result.pixels[index] + (luminance - result.pixels[index]) * amount);
    result.pixels[index + 1] = Math.round(result.pixels[index + 1] + (luminance - result.pixels[index + 1]) * amount);
    result.pixels[index + 2] = Math.round(result.pixels[index + 2] + (luminance - result.pixels[index + 2]) * amount);
  }
  return result;
}

export function cropRaster(
  image: RuntimeRasterImage,
  x: number,
  y: number,
  width: number,
  height: number,
): RuntimeRasterImage {
  const pixels = new Uint8Array(width * height * 4);
  for (let targetY = 0; targetY < height; targetY++) {
    const sourceStart = ((y + targetY) * image.width + x) * 4;
    const sourceEnd = sourceStart + width * 4;
    pixels.set(image.pixels.subarray(sourceStart, sourceEnd), targetY * width * 4);
  }
  return { width, height, pixels };
}

export function decodePng(bytes: Uint8Array): RuntimeDecodedAnimation {
  const decoded = upng.decode(exactArrayBuffer(bytes));
  const rgbaFrames = upng.toRGBA8(decoded) as ArrayBuffer[];
  const delays = Array.isArray(decoded.frames)
    ? decoded.frames.map((frame: any) => positiveFrameDuration(Number(frame.delay) / 1000))
    : [];
  const frames = rgbaFrames.map((buffer, index) => ({
    width: Number(decoded.width),
    height: Number(decoded.height),
    pixels: new Uint8Array(buffer),
    duration: delays[index] ?? 0.1,
  }));
  return {
    width: Number(decoded.width),
    height: Number(decoded.height),
    format: frames.length > 1 ? 'apng' : 'png',
    frames,
  };
}

export function decodeGif(bytes: Uint8Array): RuntimeDecodedAnimation {
  const parsed = gifuct.parseGIF(exactArrayBuffer(bytes));
  const sourceFrames = gifuct.decompressFrames(parsed, true) as any[];
  const width = Number(parsed.lsd.width);
  const height = Number(parsed.lsd.height);
  let canvas = new Uint8Array(width * height * 4);
  let previousFrame: any = null;
  let previousRestore: Uint8Array | null = null;
  const frames: RuntimeAnimationFrame[] = [];

  for (const frame of sourceFrames) {
    if (previousFrame) {
      if (previousFrame.disposalType === 2) clearFrameRectangle(canvas, width, height, previousFrame.dims);
      if (previousFrame.disposalType === 3 && previousRestore) canvas = new Uint8Array(previousRestore);
    }

    const restore = frame.disposalType === 3 ? new Uint8Array(canvas) : null;
    compositeGifPatch(canvas, width, height, frame);
    frames.push({
      width,
      height,
      pixels: new Uint8Array(canvas),
      duration: positiveFrameDuration(Number(frame.delay) / 1000),
    });
    previousFrame = frame;
    previousRestore = restore;
  }

  return { width, height, format: 'gif', frames };
}

export function decodeBmp(bytes: Uint8Array): RuntimeDecodedImage {
  if (bytes.length < 54 || asciiAt(bytes, 0, 2) !== 'BM') throw new Error('invalid BMP header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pixelOffset = view.getUint32(10, true);
  const dibSize = view.getUint32(14, true);
  if (dibSize < 40) throw new Error('unsupported BMP header');
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const planes = view.getUint16(26, true);
  const bits = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  if (width <= 0 || rawHeight === 0 || planes !== 1 || (bits !== 24 && bits !== 32) || compression !== 0) {
    throw new Error('only uncompressed 24-bit and 32-bit BMP images are supported');
  }
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const stride = Math.floor((bits * width + 31) / 32) * 4;
  if (pixelOffset + stride * height > bytes.length) throw new Error('BMP pixel data is incomplete');
  const pixels = new Uint8Array(width * height * 4);
  let anyNonZeroAlpha = false;

  for (let y = 0; y < height; y++) {
    const sourceY = topDown ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const source = pixelOffset + sourceY * stride + x * bits / 8;
      const target = (y * width + x) * 4;
      pixels[target] = bytes[source + 2];
      pixels[target + 1] = bytes[source + 1];
      pixels[target + 2] = bytes[source];
      pixels[target + 3] = bits === 32 ? bytes[source + 3] : 255;
      if (bits === 32 && bytes[source + 3] !== 0) anyNonZeroAlpha = true;
    }
  }
  if (bits === 32 && !anyNonZeroAlpha) {
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  }
  return { width, height, pixels, format: 'bmp' };
}

export function encodePng(image: RuntimeRasterImage): Uint8Array {
  const encoded = upng.encode([exactArrayBuffer(image.pixels)], image.width, image.height, 0);
  return new Uint8Array(encoded);
}

export function encodeApng(animation: RuntimeDecodedAnimation): Uint8Array {
  const buffers = animation.frames.map((frame) => exactArrayBuffer(frame.pixels));
  const delays = animation.frames.map((frame) => Math.max(1, Math.round(frame.duration * 1000)));
  return new Uint8Array(upng.encode(buffers, animation.width, animation.height, 0, delays));
}

export function encodeGif(animation: RuntimeDecodedAnimation): Uint8Array {
  const encoder = gifenc.GIFEncoder();
  animation.frames.forEach((frame, index) => {
    const transparent = rasterHasAlpha(frame);
    const format = transparent ? 'rgba4444' : 'rgb565';
    const palette = gifenc.quantize(frame.pixels, 256, transparent
      ? { format, oneBitAlpha: true }
      : { format });
    const indexed = gifenc.applyPalette(frame.pixels, palette, format);
    let transparentIndex = 0;
    if (transparent) {
      const found = palette.findIndex((color: number[]) => color.length >= 4 && color[3] === 0);
      if (found >= 0) transparentIndex = found;
    }
    encoder.writeFrame(indexed, animation.width, animation.height, {
      palette,
      delay: Math.max(1, Math.round(frame.duration * 1000)),
      repeat: index === 0 ? 0 : undefined,
      transparent,
      transparentIndex,
    });
  });
  encoder.finish();
  return new Uint8Array(encoder.bytes());
}

export function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
      binary += String.fromCharCode(...chunk);
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  }
  const BufferClass: any = require('buffer').Buffer;
  return `data:${mimeType};base64,${BufferClass.from(bytes).toString('base64')}`;
}

function pngHasAnimationControl(bytes: Uint8Array): boolean {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = asciiAt(bytes, offset + 4, 4);
    if (type === 'acTL') return true;
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return false;
}

function compositeGifPatch(canvas: Uint8Array, width: number, height: number, frame: any): void {
  const dims = frame.dims || {};
  const patch = frame.patch as Uint8Array;
  const frameWidth = Number(dims.width) || 0;
  const frameHeight = Number(dims.height) || 0;
  const left = Number(dims.left) || 0;
  const top = Number(dims.top) || 0;
  for (let y = 0; y < frameHeight; y++) {
    const targetY = top + y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < frameWidth; x++) {
      const targetX = left + x;
      if (targetX < 0 || targetX >= width) continue;
      const source = (y * frameWidth + x) * 4;
      if (patch[source + 3] === 0) continue;
      copyPixel(patch, source, canvas, (targetY * width + targetX) * 4);
    }
  }
}

function clearFrameRectangle(canvas: Uint8Array, width: number, height: number, dims: any): void {
  const left = Math.max(0, Number(dims.left) || 0);
  const top = Math.max(0, Number(dims.top) || 0);
  const right = Math.min(width, left + (Number(dims.width) || 0));
  const bottom = Math.min(height, top + (Number(dims.height) || 0));
  for (let y = top; y < bottom; y++) {
    canvas.fill(0, (y * width + left) * 4, (y * width + right) * 4);
  }
}

function positiveFrameDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0.1;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function copyPixel(source: Uint8Array, sourceOffset: number, target: Uint8Array, targetOffset: number): void {
  target[targetOffset] = source[sourceOffset];
  target[targetOffset + 1] = source[sourceOffset + 1];
  target[targetOffset + 2] = source[sourceOffset + 2];
  target[targetOffset + 3] = source[sourceOffset + 3];
}

function hasBytes(bytes: Uint8Array, expected: readonly number[], offset: number): boolean {
  if (offset < 0 || offset + expected.length > bytes.length) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset + length > bytes.length) return '';
  let value = '';
  for (let index = 0; index < length; index++) value += String.fromCharCode(bytes[offset + index]);
  return value;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}
