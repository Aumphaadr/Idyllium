// ─── image: картинки, битмапы, анимации — модуль рантайма (этап Б) ─────────
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, defineRuntimeGetter, errorMessage, intArgument, integerNumber, stringArgument } from './runtime-shared';
import { IdylliumArray, IdylliumColor, valueOps } from './runtime-values';
import { RuntimeFileSystem, RuntimeObjectState, objectFactory } from './runtime-state';
import {
  RuntimeAnimationFrame,
  RuntimeDecodedAnimation,
  RuntimeImageFormat,
  RuntimeImageService,
  RuntimeRasterImage,
  bytesToDataUri,
  cloneRaster,
  cropRaster,
  desaturateRaster,
  detectImageFormat,
  imageFormatFromPath,
  imageMimeType,
  opacityRaster,
  rasterHasAlpha,
  rotateRaster,
  scaleRaster,
  tintRaster,
} from './image-service';
import { finiteNumber, isRuntimeObject, optionalNumberContext, rangeNumber, splitContextArgs, validRange } from './runtime-shared';
import { colorTransparent } from './runtime-values';

export interface StoredStaticImage {
  readonly raster: RuntimeRasterImage;
  readonly sourceBytes?: Uint8Array;
}

export interface StoredBitmap {
  readonly raster: RuntimeRasterImage;
  alphaPixelCount: number;
}

export interface StoredAnimation {
  readonly animation: RuntimeDecodedAnimation;
  readonly sourceBytes?: Uint8Array;
}

// ---------------------------------------------------------------------------
// Черепашья графика (модуль turtle)
//
// Вся черепаха — это display list (entries) в математических координатах:
// центр поля (0,0), Y вверх, 0° = восток, положительные углы против часовой.
// Поле лениво создаёт обычные gui.Window + gui.Canvas (без on_update — команды
// персистентны) и транслирует entries в готовый Canvas-протокол; рендереру
// нужен один новый случай 'turtle.Path' для заливок и спрайта черепашки.
// В CLI поле headless: окна нет, display list живёт «в уме» ради save_svg.
// ---------------------------------------------------------------------------

export function initializeImageObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  obj.src = '';
  obj.resolved_path = '';
  obj.resource_uri = '';
  obj.width = 0;
  obj.height = 0;
  obj.format = '';
  obj.has_alpha = false;
  obj.is_loaded = false;
  if (typeName === 'Bitmap') obj.is_created = false;

  if (typeName === 'Vector') {
    obj.src = '';
    obj.width = 0;
    obj.height = 0;
    obj.is_loaded = false;

    obj.load_from_file = contextFunction((targetPath: unknown, file: string, line: number) => {
      const requestedPath = stringArgument(targetPath, 'Vector.load_from_file() path', file, line);
      const resolvedPath = resolveImageInputPath(requestedPath, file, line, state, 'Vector.load_from_file()');
      if (!state.fileSystem.exists(resolvedPath) || !state.fileSystem.isFile(resolvedPath)) {
        throw new IdylliumRuntimeError(file, line, `Vector.load_from_file() cannot load '${requestedPath}': file does not exist`);
      }
      let text: string;
      try {
        text = state.fileSystem.readText(resolvedPath);
      } catch (error) {
        throw imageRuntimeError(file, line, `Vector.load_from_file() cannot load '${requestedPath}'`, error);
      }
      if (!/<svg[\s>]/iu.test(text)) {
        throw new IdylliumRuntimeError(file, line, `Vector.load_from_file() cannot decode '${requestedPath}': not an SVG document (expected <svg...>)`);
      }

      const passport = svgPassport(text);
      obj.__vectorSvg = text;
      obj.src = requestedPath;
      obj.width = passport.width;
      obj.height = passport.height;
      obj.is_loaded = true;
    });

    obj.to_static = contextFunction(async (...callArgs: unknown[]) => {
      const line = callArgs.pop() as number;
      const file = callArgs.pop() as string;
      const widthValue = callArgs[0];
      const heightValue = callArgs.length > 1 ? callArgs[1] : undefined;
      const svgText = obj.__vectorSvg;
      if (typeof svgText !== 'string') {
        throw new IdylliumRuntimeError(file, line, 'Vector.to_static() before load_from_file() — load an SVG first');
      }
      const targetWidth = Math.trunc(Number(widthValue));
      if (!Number.isFinite(targetWidth) || targetWidth < 1 || targetWidth > 4096) {
        throw new IdylliumRuntimeError(file, line, `Vector.to_static() size must be between 1 and 4096, got ${String(widthValue)}`);
      }
      const rawHeight = heightValue === undefined || heightValue === null ? 0 : Math.trunc(Number(heightValue));
      if (!Number.isFinite(rawHeight) || rawHeight < 0 || rawHeight > 4096) {
        throw new IdylliumRuntimeError(file, line, `Vector.to_static() size must be between 1 and 4096, got ${String(heightValue)}`);
      }
      const sourceWidth = Math.max(1, Number(obj.width));
      const sourceHeight = Math.max(1, Number(obj.height));
      // height опущен — считаем из пропорций родного размера.
      const targetHeight = rawHeight === 0
        ? Math.min(4096, Math.max(1, Math.round((targetWidth * sourceHeight) / sourceWidth)))
        : rawHeight;

      const service = imageService(state, file, line);
      if (typeof service.rasterizeSvg !== 'function') {
        throw new IdylliumRuntimeError(file, line, 'Vector.to_static() is not available in the console host — run the program in the Web IDE or VS Code');
      }
      try {
        const raster = await service.rasterizeSvg(svgText, targetWidth, targetHeight, sourceWidth, sourceHeight);
        return await createGeneratedStaticImage(raster, String(obj.src ?? ''), state, file, line);
      } catch (error) {
        if (error instanceof IdylliumRuntimeError) throw error;
        throw imageRuntimeError(file, line, `Vector.to_static() cannot rasterize '${String(obj.src ?? '')}'`, error);
      }
    });

    obj.to_string = () => (
      obj.is_loaded === true
        ? `image.Vector(${obj.src}, ${obj.width}×${obj.height})`
        : 'image.Vector(not loaded)'
    );
  }

  if (typeName === 'Static') {
    obj.load_from_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const requestedPath = stringArgument(targetPath, 'Static.load_from_file() path', file, line);
      const resolvedPath = resolveImageInputPath(requestedPath, file, line, state, 'Static.load_from_file()');
      const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Static.load_from_file()');
      const format = detectImageFormat(bytes);
      if (format === 'unknown') {
        throw new IdylliumRuntimeError(file, line, `Static.load_from_file() cannot decode '${requestedPath}': unsupported image format`);
      }
      const service = imageService(state, file, line);
      try {
        const decoded = await service.decodeStatic(bytes, format);
        setLoadedStaticImage(obj, decoded, bytes, requestedPath, resolvedPath, state);
      } catch (error) {
        throw imageRuntimeError(file, line, `Static.load_from_file() cannot decode '${requestedPath}'`, error);
      }
    });

    obj.scale = contextFunction(async (x: unknown, y: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.scale()', file, line);
      const scaleX = finiteNumber(x, 'Static.scale() x', file, line);
      const scaleY = finiteNumber(y, 'Static.scale() y', file, line);
      if (scaleX === 0 || scaleY === 0) {
        throw new IdylliumRuntimeError(file, line, `Static.scale() factors cannot be zero (got ${scaleX}, ${scaleY})`);
      }
      ensureImageSize(
        Math.max(1, Math.round(source.raster.width * Math.abs(scaleX))),
        Math.max(1, Math.round(source.raster.height * Math.abs(scaleY))),
        'Static.scale()',
        file,
        line,
      );
      return createGeneratedStaticImage(scaleRaster(source.raster, scaleX, scaleY), String(obj.src), state, file, line);
    });

    obj.rotate = contextFunction(async (angle: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.rotate()', file, line);
      const degrees = integerNumber(angle, 'Static.rotate() angle', file, line);
      if (degrees % 90 !== 0) {
        throw new IdylliumRuntimeError(file, line, `Static.rotate() angle must be divisible by 90, got ${degrees}`);
      }
      return createGeneratedStaticImage(rotateRaster(source.raster, degrees), String(obj.src), state, file, line);
    });

    obj.tint = contextFunction(async (color: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.tint()', file, line);
      if (!(color instanceof IdylliumColor)) {
        throw new IdylliumRuntimeError(file, line, `Static.tint() color must be colors.Color`);
      }
      return createGeneratedStaticImage(
        tintRaster(source.raster, color.red, color.green, color.blue),
        String(obj.src),
        state,
        file,
        line,
      );
    });

    obj.with_opacity = contextFunction(async (value: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.with_opacity()', file, line);
      const opacityValue = rangeNumber(value, 'Static.with_opacity() opacity', 0, 1, file, line);
      return createGeneratedStaticImage(opacityRaster(source.raster, opacityValue), String(obj.src), state, file, line);
    });

    obj.desaturate = contextFunction(async (
      amountOrFile: number | string,
      fileOrLine: string | number,
      maybeLine?: number,
    ) => {
      const context = optionalNumberContext(amountOrFile, fileOrLine, maybeLine);
      const source = storedStaticImage(obj, 'Static.desaturate()', context.file, context.line);
      const amount = context.value === undefined
        ? 1
        : rangeNumber(context.value, 'Static.desaturate() amount', 0, 1, context.file, context.line);
      return createGeneratedStaticImage(
        desaturateRaster(source.raster, amount),
        String(obj.src),
        state,
        context.file,
        context.line,
      );
    });

    obj.crop = contextFunction(async (
      x: unknown,
      y: unknown,
      width: unknown,
      height: unknown,
      file: string,
      line: number,
    ) => {
      const source = storedStaticImage(obj, 'Static.crop()', file, line);
      const cropX = integerNumber(x, 'Static.crop() x', file, line);
      const cropY = integerNumber(y, 'Static.crop() y', file, line);
      const cropWidth = integerNumber(width, 'Static.crop() width', file, line);
      const cropHeight = integerNumber(height, 'Static.crop() height', file, line);
      if (cropX < 0 || cropY < 0 || cropWidth <= 0 || cropHeight <= 0) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Static.crop() expects non-negative coordinates and positive size, got (${cropX}, ${cropY}, ${cropWidth}, ${cropHeight})`,
        );
      }
      if (cropX + cropWidth > source.raster.width || cropY + cropHeight > source.raster.height) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Static.crop() rectangle (${cropX}, ${cropY}, ${cropWidth}, ${cropHeight}) is outside image bounds ${source.raster.width}x${source.raster.height}`,
        );
      }
      return createGeneratedStaticImage(
        cropRaster(source.raster, cropX, cropY, cropWidth, cropHeight),
        String(obj.src),
        state,
        file,
        line,
      );
    });

    obj.export_to_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const source = storedStaticImage(obj, 'Static.export_to_file()', file, line);
      const requestedPath = stringArgument(targetPath, 'Static.export_to_file() path', file, line);
      const outputFormat = imageFormatFromPath(requestedPath);
      if (!['png', 'jpeg', 'webp', 'gif'].includes(outputFormat)) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Static.export_to_file() cannot determine a supported format from '${requestedPath}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const bytes = await service.encodeStatic(source.raster, outputFormat);
        writeRuntimeImageBytes(requestedPath, bytes, outputFormat, state, file, line, 'Static.export_to_file()');
      } catch (error) {
        throw imageRuntimeError(file, line, `Static.export_to_file() cannot write '${requestedPath}'`, error);
      }
    });
  }

  if (typeName === 'Bitmap') {
    obj.create = contextFunction((...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const width = integerNumber(values[0], 'Bitmap.create() width', file, line);
      const height = integerNumber(values[1], 'Bitmap.create() height', file, line);
      ensureImageSize(width, height, 'Bitmap.create()', file, line);
      const fillColor = values.length >= 3
        ? bitmapColor(values[2], 'Bitmap.create() fill', file, line)
        : colorTransparent();
      const raster = filledRaster(width, height, fillColor);
      setBitmapRaster(obj, raster, '', 'rgba');
    });

    obj.load_from_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const requestedPath = stringArgument(targetPath, 'Bitmap.load_from_file() path', file, line);
      const resolvedPath = resolveImageInputPath(requestedPath, file, line, state, 'Bitmap.load_from_file()');
      const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Bitmap.load_from_file()');
      const format = detectImageFormat(bytes);
      if (format === 'unknown') {
        throw new IdylliumRuntimeError(file, line, `Bitmap.load_from_file() cannot decode '${requestedPath}': unsupported image format`);
      }
      const service = imageService(state, file, line);
      try {
        const decoded = await service.decodeStatic(bytes, format);
        setBitmapRaster(obj, decoded, requestedPath, decoded.format, resolvedPath);
      } catch (error) {
        throw imageRuntimeError(file, line, `Bitmap.load_from_file() cannot decode '${requestedPath}'`, error);
      }
    });

    obj.create_from_image = contextFunction((sourceValue: unknown, file: string, line: number) => {
      if (!isRuntimeObject(sourceValue) || sourceValue.__idylliumType !== 'image.Static') {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Bitmap.create_from_image() source must be image.Static, got '${valueOps.typeName(sourceValue)}'`,
        );
      }
      const source = storedStaticImage(sourceValue, 'Bitmap.create_from_image()', file, line);
      setBitmapRaster(
        obj,
        source.raster,
        String(sourceValue.src ?? ''),
        String(sourceValue.format ?? 'png'),
        String(sourceValue.resolved_path ?? ''),
      );
    });

    obj.get_pixel = contextFunction((xValue: unknown, yValue: unknown, file: string, line: number) => {
      const stored = storedBitmap(obj, 'Bitmap.get_pixel()', file, line);
      const index = bitmapPixelIndex(stored.raster, xValue, yValue, 'Bitmap.get_pixel()', file, line);
      return IdylliumColor.RGBA(
        stored.raster.pixels[index],
        stored.raster.pixels[index + 1],
        stored.raster.pixels[index + 2],
        stored.raster.pixels[index + 3] / 255,
        file,
        line,
      );
    });

    obj.set_pixel = contextFunction((
      xValue: unknown,
      yValue: unknown,
      colorValue: unknown,
      file: string,
      line: number,
    ) => {
      const stored = storedBitmap(obj, 'Bitmap.set_pixel()', file, line);
      const index = bitmapPixelIndex(stored.raster, xValue, yValue, 'Bitmap.set_pixel()', file, line);
      setBitmapPixel(stored, index, bitmapColor(colorValue, 'Bitmap.set_pixel() color', file, line));
      obj.has_alpha = stored.alphaPixelCount > 0;
    });

    obj.fill = contextFunction((colorValue: unknown, file: string, line: number) => {
      const stored = storedBitmap(obj, 'Bitmap.fill()', file, line);
      const fillColor = bitmapColor(colorValue, 'Bitmap.fill() color', file, line);
      const replacement = filledRaster(stored.raster.width, stored.raster.height, fillColor);
      stored.raster.pixels.set(replacement.pixels);
      stored.alphaPixelCount = fillColor.alpha < 1 ? stored.raster.width * stored.raster.height : 0;
      obj.has_alpha = stored.alphaPixelCount > 0;
    });

    obj.fill_rect = contextFunction((
      xValue: unknown,
      yValue: unknown,
      widthValue: unknown,
      heightValue: unknown,
      colorValue: unknown,
      file: string,
      line: number,
    ) => {
      const stored = storedBitmap(obj, 'Bitmap.fill_rect()', file, line);
      const x = integerNumber(xValue, 'Bitmap.fill_rect() x', file, line);
      const y = integerNumber(yValue, 'Bitmap.fill_rect() y', file, line);
      const width = integerNumber(widthValue, 'Bitmap.fill_rect() width', file, line);
      const height = integerNumber(heightValue, 'Bitmap.fill_rect() height', file, line);
      if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Bitmap.fill_rect() expects non-negative coordinates and positive size, got (${x}, ${y}, ${width}, ${height})`,
        );
      }
      if (x + width > stored.raster.width || y + height > stored.raster.height) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Bitmap.fill_rect() rectangle (${x}, ${y}, ${width}, ${height}) is outside bitmap bounds ${stored.raster.width}x${stored.raster.height}`,
        );
      }
      const fillColor = bitmapColor(colorValue, 'Bitmap.fill_rect() color', file, line);
      for (let row = y; row < y + height; row++) {
        for (let column = x; column < x + width; column++) {
          setBitmapPixel(stored, (row * stored.raster.width + column) * 4, fillColor);
        }
      }
      obj.has_alpha = stored.alphaPixelCount > 0;
    });

    obj.to_static = contextFunction(async (file: string, line: number) => {
      const stored = storedBitmap(obj, 'Bitmap.to_static()', file, line);
      return createGeneratedStaticImage(stored.raster, String(obj.src ?? ''), state, file, line);
    });

    obj.export_to_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const stored = storedBitmap(obj, 'Bitmap.export_to_file()', file, line);
      const requestedPath = stringArgument(targetPath, 'Bitmap.export_to_file() path', file, line);
      const outputFormat = imageFormatFromPath(requestedPath);
      if (!['png', 'jpeg', 'webp', 'gif'].includes(outputFormat)) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Bitmap.export_to_file() cannot determine a supported format from '${requestedPath}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const bytes = await service.encodeStatic(stored.raster, outputFormat);
        writeRuntimeImageBytes(requestedPath, bytes, outputFormat, state, file, line, 'Bitmap.export_to_file()');
      } catch (error) {
        throw imageRuntimeError(file, line, `Bitmap.export_to_file() cannot write '${requestedPath}'`, error);
      }
    });
  }

  if (typeName === 'Animation') {
    obj.frame_count = 0;
    obj.frame_duration = 0;
    obj.has_uniform_frame_duration = true;

    obj.load_from_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const requestedPath = stringArgument(targetPath, 'Animation.load_from_file() path', file, line);
      const resolvedPath = resolveImageInputPath(requestedPath, file, line, state, 'Animation.load_from_file()');
      const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Animation.load_from_file()');
      const format = detectImageFormat(bytes);
      if (format !== 'gif' && format !== 'apng') {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Animation.load_from_file() expects GIF or APNG data, got '${format}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const animation = await service.decodeAnimation(bytes, format);
        if (animation.frames.length < 2) {
          throw new Error('the file contains only one frame; use image.Static instead');
        }
        setLoadedAnimation(obj, animation, bytes, requestedPath, resolvedPath, state);
      } catch (error) {
        throw imageRuntimeError(file, line, `Animation.load_from_file() cannot decode '${requestedPath}'`, error);
      }
    });

    obj.get_frame = contextFunction(async (index: unknown, file: string, line: number) => {
      const source = storedAnimation(obj, 'Animation.get_frame()', file, line);
      const frameIndex = imageFrameIndex(source.animation.frames, index, 'Animation.get_frame()', file, line);
      return createGeneratedStaticImage(source.animation.frames[frameIndex], String(obj.src), state, file, line);
    });

    obj.get_frame_duration = contextFunction((index: unknown, file: string, line: number) => {
      const source = storedAnimation(obj, 'Animation.get_frame_duration()', file, line);
      const frameIndex = imageFrameIndex(source.animation.frames, index, 'Animation.get_frame_duration()', file, line);
      return source.animation.frames[frameIndex].duration;
    });

    obj.create_from_frames = contextFunction(async (
      framesValue: unknown,
      durationValue: unknown,
      file: string,
      line: number,
    ) => {
      if (!(framesValue instanceof IdylliumArray)) {
        throw new IdylliumRuntimeError(file, line, `Animation.create_from_frames() frames must be dyn_array<image.Static>`);
      }
      const values = framesValue.values();
      if (values.length < 2) {
        throw new IdylliumRuntimeError(file, line, `Animation.create_from_frames() expects at least 2 frames, got ${values.length}`);
      }
      const duration = finiteNumber(durationValue, 'Animation.create_from_frames() frame_duration', file, line);
      if (duration <= 0) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Animation.create_from_frames() frame_duration must be greater than 0, got ${duration}`,
        );
      }
      const frames: RuntimeAnimationFrame[] = [];
      let expectedWidth = 0;
      let expectedHeight = 0;
      values.forEach((value, index) => {
        if (!isRuntimeObject(value) || value.__idylliumType !== 'image.Static') {
          throw new IdylliumRuntimeError(
            file,
            line,
            `Animation.create_from_frames() item ${index} must be image.Static, got '${valueOps.typeName(value)}'`,
          );
        }
        const stored = storedStaticImage(value, 'Animation.create_from_frames()', file, line);
        if (index === 0) {
          expectedWidth = stored.raster.width;
          expectedHeight = stored.raster.height;
        } else if (stored.raster.width !== expectedWidth || stored.raster.height !== expectedHeight) {
          throw new IdylliumRuntimeError(
            file,
            line,
            `Animation.create_from_frames() frame ${index} has size ${stored.raster.width}x${stored.raster.height}, expected ${expectedWidth}x${expectedHeight}`,
          );
        }
        frames.push({ ...cloneRaster(stored.raster), duration });
      });
      const animation: RuntimeDecodedAnimation = {
        width: expectedWidth,
        height: expectedHeight,
        format: 'gif',
        frames,
      };
      const service = imageService(state, file, line);
      try {
        const encoded = await service.encodeAnimation(animation, 'gif');
        setGeneratedAnimation(obj, animation, encoded);
      } catch (error) {
        throw imageRuntimeError(file, line, 'Animation.create_from_frames() cannot encode animation', error);
      }
    });

    obj.export_to_file = contextFunction(async (targetPath: unknown, file: string, line: number) => {
      const source = storedAnimation(obj, 'Animation.export_to_file()', file, line);
      const requestedPath = stringArgument(targetPath, 'Animation.export_to_file() path', file, line);
      const pathFormat = imageFormatFromPath(requestedPath);
      const outputFormat: RuntimeImageFormat = pathFormat === 'png' ? 'apng' : pathFormat;
      if (outputFormat !== 'gif' && outputFormat !== 'apng') {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Animation.export_to_file() expects .gif, .png or .apng output path, got '${requestedPath}'`,
        );
      }
      const service = imageService(state, file, line);
      try {
        const bytes = await service.encodeAnimation(source.animation, outputFormat);
        writeRuntimeImageBytes(requestedPath, bytes, outputFormat, state, file, line, 'Animation.export_to_file()');
      } catch (error) {
        throw imageRuntimeError(file, line, `Animation.export_to_file() cannot write '${requestedPath}'`, error);
      }
    });
  }
}

function setLoadedStaticImage(
  obj: RuntimeObject,
  decoded: RuntimeRasterImage & { readonly format: RuntimeImageFormat },
  sourceBytes: Uint8Array,
  requestedPath: string,
  resolvedPath: string,
  state: RuntimeObjectState,
): void {
  obj.__imageStatic = { raster: cloneRaster(decoded), sourceBytes: new Uint8Array(sourceBytes) } satisfies StoredStaticImage;
  setImageMetadata(obj, decoded, decoded.format, requestedPath, resolvedPath, imageResourceUri(state, resolvedPath, sourceBytes, decoded.format));
}

function setLoadedAnimation(
  obj: RuntimeObject,
  animation: RuntimeDecodedAnimation,
  sourceBytes: Uint8Array,
  requestedPath: string,
  resolvedPath: string,
  state: RuntimeObjectState,
): void {
  obj.__imageAnimation = { animation: cloneAnimation(animation), sourceBytes: new Uint8Array(sourceBytes) } satisfies StoredAnimation;
  setImageMetadata(
    obj,
    { width: animation.width, height: animation.height, pixels: animation.frames[0].pixels },
    animation.format,
    requestedPath,
    resolvedPath,
    imageResourceUri(state, resolvedPath, sourceBytes, animation.format),
  );
  obj.has_alpha = animation.frames.some((frame) => rasterHasAlpha(frame));
  setAnimationMetadata(obj, animation.frames);
}

function setGeneratedAnimation(obj: RuntimeObject, animation: RuntimeDecodedAnimation, encoded: Uint8Array): void {
  obj.__imageAnimation = { animation: cloneAnimation(animation), sourceBytes: new Uint8Array(encoded) } satisfies StoredAnimation;
  setImageMetadata(
    obj,
    { width: animation.width, height: animation.height, pixels: animation.frames[0].pixels },
    'gif',
    '',
    '',
    bytesToDataUri(encoded, imageMimeType('gif')),
  );
  obj.has_alpha = animation.frames.some((frame) => rasterHasAlpha(frame));
  setAnimationMetadata(obj, animation.frames);
}

export function setImageMetadata(
  obj: RuntimeObject,
  image: RuntimeRasterImage,
  format: RuntimeImageFormat,
  src: string,
  resolvedPath: string,
  resourceUri: string,
): void {
  obj.src = src;
  obj.resolved_path = resolvedPath;
  obj.resource_uri = resourceUri;
  obj.width = image.width;
  obj.height = image.height;
  obj.format = format;
  obj.has_alpha = rasterHasAlpha(image);
  obj.is_loaded = true;
}

function setAnimationMetadata(obj: RuntimeObject, frames: readonly RuntimeAnimationFrame[]): void {
  const firstDuration = frames[0]?.duration ?? 0;
  obj.frame_count = frames.length;
  obj.frame_duration = firstDuration;
  obj.has_uniform_frame_duration = frames.every((frame) => Math.abs(frame.duration - firstDuration) < 0.0000001);
}

export function storedStaticImage(obj: RuntimeObject, methodName: string, file: string, line: number): StoredStaticImage {
  const stored = obj.__imageStatic as StoredStaticImage | undefined;
  if (obj.is_loaded === true && stored?.raster) return stored;
  throw new IdylliumRuntimeError(file, line, `${methodName} cannot be used before load_from_file()`);
}

export function storedBitmap(obj: RuntimeObject, methodName: string, file: string, line: number): StoredBitmap {
  const stored = obj.__imageBitmap as StoredBitmap | undefined;
  if (obj.is_created === true && stored?.raster) return stored;
  throw new IdylliumRuntimeError(file, line, `${methodName} cannot be used before create(), load_from_file(), or create_from_image()`);
}

function setBitmapRaster(
  obj: RuntimeObject,
  source: RuntimeRasterImage,
  src: string,
  format: string,
  resolvedPath = '',
): void {
  const raster = cloneRaster(source);
  obj.__imageBitmap = {
    raster,
    alphaPixelCount: countAlphaPixels(raster),
  } satisfies StoredBitmap;
  obj.src = src;
  obj.resolved_path = resolvedPath;
  obj.resource_uri = '';
  obj.width = raster.width;
  obj.height = raster.height;
  obj.format = format;
  obj.has_alpha = rasterHasAlpha(raster);
  obj.is_loaded = true;
  obj.is_created = true;
}

function bitmapColor(value: unknown, argumentName: string, file: string, line: number): IdylliumColor {
  if (value instanceof IdylliumColor) return value;
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be colors.Color`);
}

function filledRaster(width: number, height: number, color: IdylliumColor): RuntimeRasterImage {
  const pixels = new Uint8Array(width * height * 4);
  const alpha = Math.round(color.alpha * 255);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color.red;
    pixels[index + 1] = color.green;
    pixels[index + 2] = color.blue;
    pixels[index + 3] = alpha;
  }
  return { width, height, pixels };
}

function bitmapPixelIndex(
  raster: RuntimeRasterImage,
  xValue: unknown,
  yValue: unknown,
  methodName: string,
  file: string,
  line: number,
): number {
  const x = integerNumber(xValue, `${methodName} x`, file, line);
  const y = integerNumber(yValue, `${methodName} y`, file, line);
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `${methodName} coordinates (${x}, ${y}) are outside bitmap bounds ${raster.width}x${raster.height}`,
    );
  }
  return (y * raster.width + x) * 4;
}

function setBitmapPixel(stored: StoredBitmap, index: number, color: IdylliumColor): void {
  const oldHasAlpha = stored.raster.pixels[index + 3] < 255;
  const alpha = Math.round(color.alpha * 255);
  const newHasAlpha = alpha < 255;
  if (oldHasAlpha && !newHasAlpha) stored.alphaPixelCount -= 1;
  if (!oldHasAlpha && newHasAlpha) stored.alphaPixelCount += 1;
  stored.raster.pixels[index] = color.red;
  stored.raster.pixels[index + 1] = color.green;
  stored.raster.pixels[index + 2] = color.blue;
  stored.raster.pixels[index + 3] = alpha;
}

function countAlphaPixels(raster: RuntimeRasterImage): number {
  let count = 0;
  for (let index = 3; index < raster.pixels.length; index += 4) {
    if (raster.pixels[index] < 255) count += 1;
  }
  return count;
}

export function storedAnimation(obj: RuntimeObject, methodName: string, file: string, line: number): StoredAnimation {
  const stored = obj.__imageAnimation as StoredAnimation | undefined;
  if (obj.is_loaded === true && stored?.animation) return stored;
  throw new IdylliumRuntimeError(file, line, `${methodName} cannot be used before loading or creating an animation`);
}

function cloneAnimation(animation: RuntimeDecodedAnimation): RuntimeDecodedAnimation {
  return {
    width: animation.width,
    height: animation.height,
    format: animation.format,
    frames: animation.frames.map((frame) => ({ ...cloneRaster(frame), duration: frame.duration })),
  };
}

function imageFrameIndex(
  frames: readonly RuntimeAnimationFrame[],
  value: unknown,
  methodName: string,
  file: string,
  line: number,
): number {
  const index = integerNumber(value, `${methodName} index`, file, line);
  if (index < 0 || index >= frames.length) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `${methodName} frame index ${index} out of bounds (frame count ${frames.length}, valid indices ${validRange(frames.length)})`,
    );
  }
  return index;
}

export function resolveImageInputPath(
  requestedPath: string,
  file: string,
  line: number,
  state: RuntimeObjectState,
  methodName: string,
): string {
  const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
  if (!state.fileSystem.exists(resolvedPath)) {
    throw new IdylliumRuntimeError(file, line, `${methodName} cannot load '${requestedPath}': file does not exist`);
  }
  if (!state.fileSystem.isFile(resolvedPath)) {
    throw new IdylliumRuntimeError(file, line, `${methodName} cannot load '${requestedPath}': path is not a file`);
  }
  return resolvedPath;
}

/** Родные размеры SVG: viewBox приоритетнее атрибутов width/height.
 *  Числа с единицами («300px») читаются по числовому префиксу. */

export function svgPassport(svgText: string): { width: number; height: number } {
  const openTag = /<svg\b[^>]*>/iu.exec(svgText)?.[0] ?? '';
  const attribute = (name: string): string => (
    new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'iu').exec(openTag)?.[1] ?? ''
  );
  const viewBox = attribute('viewBox').trim().split(/[\s,]+/u).map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: Math.round(viewBox[2]), height: Math.round(viewBox[3]) };
  }
  const numericPrefix = (value: string): number => Number.parseFloat(value);
  const width = numericPrefix(attribute('width'));
  const height = numericPrefix(attribute('height'));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  // Безразмерный SVG: паспорт условный, растрирование всё равно работает.
  return { width: 300, height: 150 };
}

export function readRuntimeBytes(
  fileSystem: RuntimeFileSystem,
  resolvedPath: string,
  file: string,
  line: number,
  methodName: string,
): Uint8Array {
  if (!fileSystem.readBytes) {
    throw new IdylliumRuntimeError(file, line, `${methodName} requires binary file support in this runtime`);
  }
  try {
    return fileSystem.readBytes(resolvedPath);
  } catch (error) {
    throw imageRuntimeError(file, line, `${methodName} cannot read '${resolvedPath}'`, error);
  }
}

export function writeRuntimeImageBytes(
  requestedPath: string,
  bytes: Uint8Array,
  format: RuntimeImageFormat,
  state: RuntimeObjectState,
  file: string,
  line: number,
  methodName: string,
): void {
  if (!state.fileSystem.writeBytes) {
    throw new IdylliumRuntimeError(file, line, `${methodName} requires binary file support in this runtime`);
  }
  const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
  state.fileSystem.writeBytes(resolvedPath, bytes, bytesToDataUri(bytes, imageMimeType(format)));
}

export function imageResourceUri(
  state: RuntimeObjectState,
  resolvedPath: string,
  bytes: Uint8Array,
  format: RuntimeImageFormat,
): string {
  return state.fileSystem.resourceUri?.(resolvedPath) || bytesToDataUri(bytes, imageMimeType(format));
}

export function imageService(state: RuntimeObjectState, file: string, line: number): RuntimeImageService {
  if (state.imageService) return state.imageService;
  throw new IdylliumRuntimeError(file, line, 'image processing is unavailable in this runtime');
}

export function runtimeImageResource(value: unknown, methodName: string, file: string, line: number): RuntimeObject {
  if (!isRuntimeObject(value) || !['image.Static', 'image.Animation'].includes(String(value.__idylliumType))) {
    throw new IdylliumRuntimeError(file, line, `${methodName} expects image.Static or image.Animation, got '${valueOps.typeName(value)}'`);
  }
  if (value.is_loaded !== true) {
    throw new IdylliumRuntimeError(file, line, `${methodName} cannot use an image before it is loaded or created`);
  }
  return value;
}

export function ensureImageSize(width: number, height: number, operation: string, file: string, line: number): void {
  const pixelCount = width * height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || pixelCount > 25_000_000) {
    throw new IdylliumRuntimeError(file, line, `${operation} result size ${width}x${height} is invalid or too large`);
  }
}

export function imageRuntimeError(file: string, line: number, prefix: string, error: unknown): IdylliumRuntimeError {
  if (error instanceof IdylliumRuntimeError) return error;
  return new IdylliumRuntimeError(file, line, `${prefix}: ${errorMessage(error)}`);
}

export async function createGeneratedStaticImage(
  raster: RuntimeRasterImage,
  sourcePath: string,
  state: RuntimeObjectState,
  file: string,
  line: number,
): Promise<RuntimeObject> {
  ensureImageSize(raster.width, raster.height, 'image transformation', file, line);
  const service = imageService(state, file, line);
  try {
    const encoded = await service.encodeStatic(raster, 'png');
    const result = objectFactory.create('image', 'Static', state);
    result.__imageStatic = { raster: cloneRaster(raster), sourceBytes: encoded } satisfies StoredStaticImage;
    setImageMetadata(result, raster, 'png', sourcePath, '', bytesToDataUri(encoded, imageMimeType('png')));
    return result;
  } catch (error) {
    throw imageRuntimeError(file, line, 'image transformation cannot create its result', error);
  }
}
