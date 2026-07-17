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
} from './image-service';

export function createBrowserImageService(): RuntimeImageService {
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
