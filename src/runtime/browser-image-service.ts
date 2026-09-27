import {
  RuntimeDecodedAnimation,
  RuntimeDecodedImage,
  RuntimeImageFormat,
  RuntimeImageService,
  RuntimeRasterImage,
  decodeBmp,
  decodeGif,
  decodePng,
  encodeApng,
  encodeGif,
  encodePng,
  imageMimeType,
  bytesToDataUri,
} from './image-service';

export interface BrowserImageServiceOptions {
  /**
   * Адрес шрифта холста по умолчанию (Source Code Pro рендерера). Снимок холста to_static/export_to_file —
   * SVG-картинка, внешних шрифтов она не грузит; текст, рисованный шрифтом по умолчанию, хост встраивает
   * в снимок data-URI, иначе он ушёл бы в sans-serif и расходился с экраном (1.6.4).
   */
  readonly defaultCanvasFontUrl?: string;
}

const DEFAULT_CANVAS_FONT_FAMILY = 'IdylliumCanvasDefault';

function fontFormatByUrl(url: string): { mime: string; format: string } {
  const lower = url.toLowerCase().split(/[?#]/u)[0];
  if (lower.endsWith('.ttf')) return { mime: 'font/ttf', format: 'truetype' };
  if (lower.endsWith('.otf')) return { mime: 'font/otf', format: 'opentype' };
  if (lower.endsWith('.woff')) return { mime: 'font/woff', format: 'woff' };
  return { mime: 'font/woff2', format: 'woff2' };
}

export function createBrowserImageService(options: BrowserImageServiceOptions = {}): RuntimeImageService {
  let defaultFontStyle: Promise<string> | null = null;
  const defaultCanvasFontStyle = (): Promise<string> => {
    const url = options.defaultCanvasFontUrl;
    if (!url) return Promise.resolve('');
    if (!defaultFontStyle) {
      defaultFontStyle = (async () => {
        try {
          const response = await fetch(url);
          if (!response.ok) return '';
          const { mime, format } = fontFormatByUrl(url);
          const uri = bytesToDataUri(new Uint8Array(await response.arrayBuffer()), mime);
          return `<defs><style>@font-face{font-family:'${DEFAULT_CANVAS_FONT_FAMILY}';src:url(${uri}) format('${format}');}</style></defs>`;
        } catch {
          return ''; // шрифт не достался — текст пойдёт запасным семейством, как и раньше
        }
      })();
    }
    return defaultFontStyle;
  };
  return {
    async decodeStatic(bytes: Uint8Array, format: RuntimeImageFormat): Promise<RuntimeDecodedImage> {
      if (format === 'png' || format === 'apng') {
        const decoded = decodePng(bytes);
        if (decoded.frames.length !== 1) throw new Error('the file contains an animation, not a static image');
        return { ...decoded.frames[0], format: decoded.format };
      }
      if (format === 'gif') {
        const decoded = decodeGif(bytes);
        if (decoded.frames.length !== 1) throw new Error('the file contains an animation, not a static image');
        return { ...decoded.frames[0], format };
      }
      if (format === 'bmp') return decodeBmp(bytes);
      if (format === 'unknown') throw new Error('unsupported image format');
      const decoded = await decodeWithCanvas(bytes, imageMimeType(format));
      return { ...decoded, format };
    },

    async encodeStatic(image: RuntimeRasterImage, format: RuntimeImageFormat): Promise<Uint8Array> {
      if (format === 'png' || format === 'apng') return encodePng(image);
      if (format === 'gif') {
        return encodeGif({ width: image.width, height: image.height, format: 'gif', frames: [{ ...image, duration: 0.1 }] });
      }
      if (format !== 'jpeg' && format !== 'webp') throw new Error(`cannot encode '${format}' static image`);
      return encodeWithCanvas(image, imageMimeType(format));
    },

    async decodeAnimation(bytes: Uint8Array, format: RuntimeImageFormat): Promise<RuntimeDecodedAnimation> {
      if (format === 'gif') return decodeGif(bytes);
      if (format === 'png' || format === 'apng') return decodePng(bytes);
      throw new Error(`'${format}' is not a supported animation format`);
    },

    async encodeAnimation(animation: RuntimeDecodedAnimation, format: RuntimeImageFormat): Promise<Uint8Array> {
      if (format === 'gif') return encodeGif(animation);
      if (format === 'png' || format === 'apng') return encodeApng(animation);
      throw new Error(`cannot encode '${format}' animation`);
    },

    async rasterizeSvg(
      svgText: string,
      width: number,
      height: number,
      sourceWidth: number,
      sourceHeight: number,
    ): Promise<RuntimeRasterImage> {
      if (typeof document === 'undefined' || typeof Image === 'undefined') {
        throw new Error('SVG rasterization needs a browser host');
      }
      // Режим «SVG как <img>»: браузер не исполняет скрипты и не грузит
      // внешние ресурсы из такого SVG — безопасность by design. Шрифт холста по
      // умолчанию поэтому встраивается data-URI, если текст им рисован.
      let svg = svgText;
      if (svgText.includes(DEFAULT_CANVAS_FONT_FAMILY)) {
        const style = await defaultCanvasFontStyle();
        if (style !== '') svg = svg.replace(/<svg\b[^>]*>/u, (tag) => tag + style);
      }
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const uri = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = uri;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('the browser could not render the SVG'));
        });

        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('2D canvas is unavailable');
        context.clearRect(0, 0, width, height);

        // Вписывание без искажений: масштаб по меньшей стороне, поля прозрачны.
        const aspectWidth = sourceWidth > 0 ? sourceWidth : width;
        const aspectHeight = sourceHeight > 0 ? sourceHeight : height;
        const scale = Math.min(width / aspectWidth, height / aspectHeight);
        const drawWidth = Math.max(1, Math.round(aspectWidth * scale));
        const drawHeight = Math.max(1, Math.round(aspectHeight * scale));
        const offsetX = Math.round((width - drawWidth) / 2);
        const offsetY = Math.round((height - drawHeight) / 2);
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

        const data = context.getImageData(0, 0, width, height).data;
        return { width, height, pixels: new Uint8Array(data) };
      } finally {
        URL.revokeObjectURL(uri);
      }
    },
  };
}

async function decodeWithCanvas(bytes: Uint8Array, mimeType: string): Promise<RuntimeRasterImage> {
  const blob = new Blob([exactArrayBuffer(bytes)], { type: mimeType });
  const bitmapFactory = (globalThis as any).createImageBitmap;
  if (typeof bitmapFactory === 'function') {
    const bitmap = await bitmapFactory(blob);
    try {
      return pixelsFromDrawable(bitmap, Number(bitmap.width), Number(bitmap.height));
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('this runtime cannot decode browser images');
  }
  const uri = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = uri;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('the browser could not decode the image'));
    });
    return pixelsFromDrawable(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(uri);
  }
}

function pixelsFromDrawable(drawable: any, width: number, height: number): RuntimeRasterImage {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('decoded image has invalid dimensions');
  }
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable');
  context.clearRect(0, 0, width, height);
  context.drawImage(drawable, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  return { width, height, pixels: new Uint8Array(data) };
}

async function encodeWithCanvas(image: RuntimeRasterImage, mimeType: string): Promise<Uint8Array> {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is unavailable');
  const pixels = new Uint8ClampedArray(image.pixels);
  context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);

  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: mimeType, quality: 0.92 });
    ensureEncodedMimeType(blob, mimeType);
    return new Uint8Array(await blob.arrayBuffer());
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value: Blob | null) => {
      if (value) resolve(value);
      else reject(new Error(`the browser cannot encode '${mimeType}'`));
    }, mimeType, 0.92);
  });
  ensureEncodedMimeType(blob, mimeType);
  return new Uint8Array(await blob.arrayBuffer());
}

function ensureEncodedMimeType(blob: Blob, expected: string): void {
  if (blob.type && blob.type.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`the browser cannot encode '${expected}' (returned '${blob.type}' instead)`);
  }
}

function createCanvas(width: number, height: number): any {
  const OffscreenCanvasClass = (globalThis as any).OffscreenCanvas;
  if (typeof OffscreenCanvasClass === 'function') return new OffscreenCanvasClass(width, height);
  if (typeof document === 'undefined') throw new Error('2D canvas is unavailable');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
