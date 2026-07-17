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
} from './image-service';

const jpeg: any = require('jpeg-js');
const webp: any = require('webp-wasm');

export function createNodeImageService(): RuntimeImageService {
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
      if (format === 'webp') {
        const decoded = await webp.decode(bytes);
        return {
          width: Number(decoded.width),
          height: Number(decoded.height),
          pixels: new Uint8Array(decoded.data),
          format,
        };
      }
      if (format !== 'jpeg') throw new Error('unsupported image format');
      const decoded = jpeg.decode(bytes, {
        useTArray: true,
        formatAsRGBA: true,
        maxResolutionInMP: 25,
        maxMemoryUsageInMB: 256,
      });
      return {
        width: Number(decoded.width),
        height: Number(decoded.height),
        pixels: new Uint8Array(decoded.data),
        format,
      };
    },

    async encodeStatic(image: RuntimeRasterImage, format: RuntimeImageFormat): Promise<Uint8Array> {
      if (format === 'png') return encodePng(image);
      if (format === 'gif') {
        return encodeGif({ width: image.width, height: image.height, format: 'gif', frames: [{ ...image, duration: 0.1 }] });
      }
      if (format === 'jpeg') {
        return new Uint8Array(jpeg.encode({
          data: image.pixels,
          width: image.width,
          height: image.height,
        }, 92).data);
      }
      if (format === 'webp') {
        const encoded = await webp.encode({
          data: new Uint8ClampedArray(image.pixels),
          width: image.width,
          height: image.height,
        }, { quality: 100, lossless: 1, exact: 1 });
        return new Uint8Array(encoded);
      }
      throw new Error(`cannot encode '${format}' static image`);
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
