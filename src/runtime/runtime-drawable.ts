// ─── drawable и fonts: фигуры, спрайты, шрифты, геометрия (этап Б) ─────────
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, finiteNumber, intArgument, isRuntimeObject, stringArgument } from './runtime-shared';
import { IdylliumColor, valueOps } from './runtime-values';
import { RuntimeObjectState, defineTrackedRuntimeProperty, defineValidatedRuntimeProperty, objectFactory, setTrackedRuntimePropertyDefault } from './runtime-state';
import { colorBlack, colorTransparent, colorWhite } from './runtime-values';
import { DrawableCollisionShape, DrawableTransform, capsuleCollisionShape, collisionShapeContains, collisionShapesIntersect, rectangleCollisionShape, circleCollisionShape } from './drawable-geometry';
import { RuntimeTextMetrics } from './font-metrics-service';
import { bytesToDataUri } from './image-service';
import { errorMessage } from './runtime-shared';
import { runtimeIsFile } from './runtime-fs';
import { readRuntimeBytes, runtimeImageResource } from './runtime-image';

export function initializeDrawableObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName === 'Rectangle') {
    obj.x = 0;
    obj.y = 0;
    obj.width = 0;
    obj.height = 0;
    obj.fill_color = colorTransparent();
    obj.border_width = 0;
    defineTrackedRuntimeProperty(obj, 'border_color', colorTransparent());
    attachPositionMove(obj, 'Rectangle');
    attachDrawableTransform(obj, 'Rectangle');
  }

  if (typeName === 'Circle') {
    obj.x = 0;
    obj.y = 0;
    obj.radius = 0;
    obj.fill_color = colorTransparent();
    obj.border_width = 0;
    defineTrackedRuntimeProperty(obj, 'border_color', colorTransparent());
    attachPositionMove(obj, 'Circle');
    attachDrawableTransform(obj, 'Circle');
  }

  if (typeName === 'Line') {
    obj.x1 = 0;
    obj.y1 = 0;
    obj.x2 = 0;
    obj.y2 = 0;
    obj.color = colorWhite();
    obj.thickness = 1;
    attachLineMove(obj);
  }

  if (typeName === 'Font') {
    initializeFontObject(obj, typeName, state);
  }

  if (typeName === 'Sprite') {
    obj.image = null;
    obj.x = 0;
    obj.y = 0;
    obj.scale_x = 1;
    obj.scale_y = 1;
    obj.set_image = contextFunction((image: unknown, file: string, line: number) => {
      obj.image = runtimeImageResource(image, 'Sprite.set_image()', file, line);
    });
    obj.set_scale = contextFunction((x: unknown, y: unknown, file: string, line: number) => {
      obj.scale_x = finiteNumber(x, 'Sprite.set_scale() x', file, line);
      obj.scale_y = finiteNumber(y, 'Sprite.set_scale() y', file, line);
    });
    attachPositionMove(obj, 'Sprite');
    attachDrawableTransform(obj, 'Sprite');
  }

  if (typeName === 'Text') {
    obj.font = createDefaultDrawableFont(state);
    obj.text = '';
    obj.x = 0;
    obj.y = 0;
    obj.font_size = 16;
    obj.text_color = colorWhite();
    attachPositionMove(obj, 'Text');
    attachDrawableTransform(obj, 'Text');
    obj.get_width = contextFunction((file: string, line: number) => (
      drawableTextMetrics(obj, 'Text.get_width()', file, line, state).width
    ));
    obj.get_height = contextFunction((file: string, line: number) => (
      drawableTextMetrics(obj, 'Text.get_height()', file, line, state).height
    ));
  }

  if (['Rectangle', 'Circle', 'Line', 'Sprite', 'Text'].includes(typeName)) {
    obj.__idylliumDrawable = true;
    attachDrawableGeometry(obj, typeName, state);
  }
}

export type RuntimeFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

export function initializeFontObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Font') return;

  obj.src = '';
  obj.path = '';
  obj.resolved_path = '';
  obj.resource_uri = '';
  obj.format = '';
  obj.is_loaded = false;
  Object.defineProperty(obj, '__fontBytes', {
    configurable: true,
    enumerable: false,
    value: null,
    writable: true,
  });
  obj.load_from_file = contextFunction((targetPath: unknown, file: string, line: number) => {
    const requestedPath = stringArgument(targetPath, 'Font.load_from_file() path', file, line);
    const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
    if (!state.fileSystem.exists(resolvedPath)) {
      throw new IdylliumRuntimeError(file, line, `Font.load_from_file() cannot load '${requestedPath}': file does not exist`);
    }
    if (!runtimeIsFile(state.fileSystem, resolvedPath, file, line, 'reading')) {
      throw new IdylliumRuntimeError(file, line, `Font.load_from_file() cannot load '${requestedPath}': path is not a file`);
    }

    const bytes = readRuntimeBytes(state.fileSystem, resolvedPath, file, line, 'Font.load_from_file()');
    const format = detectFontFormat(bytes);
    if (format === null) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `Font.load_from_file() cannot decode '${requestedPath}': unsupported font format (expected TTF, OTF, WOFF, or WOFF2)`,
      );
    }

    obj.src = requestedPath;
    obj.path = requestedPath;
    obj.resolved_path = resolvedPath;
    const existingResourceUri = state.fileSystem.resourceUri?.(resolvedPath) || '';
    obj.resource_uri = existingResourceUri && !existingResourceUri.startsWith('data:')
      ? existingResourceUri
      : bytesToDataUri(bytes, fontMimeType(format));
    obj.__fontBytes = bytes;
    obj.format = format;
    obj.is_builtin = false;
    obj.is_loaded = true;
  });
}

export function createDefaultDrawableFont(state: RuntimeObjectState): RuntimeObject {
  const font = objectFactory.create('fonts', 'Font', state);
  font.src = '<Idyllium default font>';
  font.format = 'woff2';
  font.is_loaded = true;
  font.is_builtin = true;
  return font;
}

export function detectFontFormat(bytes: Uint8Array): RuntimeFontFormat | null {
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) {
    return 'ttf';
  }

  const signature = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  if (signature === 'true') return 'ttf';
  if (signature === 'OTTO') return 'otf';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'wOF2') return 'woff2';
  return null;
}

export function fontMimeType(format: RuntimeFontFormat): string {
  if (format === 'ttf') return 'font/ttf';
  if (format === 'otf') return 'font/otf';
  if (format === 'woff') return 'font/woff';
  return 'font/woff2';
}

function attachPositionMove(obj: RuntimeObject, typeName: string): void {
  obj.move = contextFunction((dx: unknown, dy: unknown, file: string, line: number) => {
    obj.x = finiteNumber(obj.x, `${typeName}.move() current x`, file, line)
      + finiteNumber(dx, `${typeName}.move() dx`, file, line);
    obj.y = finiteNumber(obj.y, `${typeName}.move() current y`, file, line)
      + finiteNumber(dy, `${typeName}.move() dy`, file, line);
  });
}

function attachLineMove(obj: RuntimeObject): void {
  obj.move = contextFunction((dx: unknown, dy: unknown, file: string, line: number) => {
    const deltaX = finiteNumber(dx, 'Line.move() dx', file, line);
    const deltaY = finiteNumber(dy, 'Line.move() dy', file, line);
    obj.x1 = finiteNumber(obj.x1, 'Line.move() current x1', file, line) + deltaX;
    obj.y1 = finiteNumber(obj.y1, 'Line.move() current y1', file, line) + deltaY;
    obj.x2 = finiteNumber(obj.x2, 'Line.move() current x2', file, line) + deltaX;
    obj.y2 = finiteNumber(obj.y2, 'Line.move() current y2', file, line) + deltaY;
  });
}

function attachDrawableTransform(obj: RuntimeObject, typeName: string): void {
  obj.origin_x = 0;
  obj.origin_y = 0;
  obj.rotation = 0;
  obj.set_origin = contextFunction((x: unknown, y: unknown, file: string, line: number) => {
    obj.origin_x = finiteNumber(x, `${typeName}.set_origin() x`, file, line);
    obj.origin_y = finiteNumber(y, `${typeName}.set_origin() y`, file, line);
  });
  obj.rotate = contextFunction((angle: unknown, file: string, line: number) => {
    obj.rotation = finiteNumber(obj.rotation, `${typeName}.rotate() current rotation`, file, line)
      + finiteNumber(angle, `${typeName}.rotate() angle`, file, line);
  });
}

export function attachDrawableGeometry(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  obj.contains = contextFunction((x: unknown, y: unknown, file: string, line: number) => {
    const point = {
      x: finiteNumber(x, `${typeName}.contains() x`, file, line),
      y: finiteNumber(y, `${typeName}.contains() y`, file, line),
    };
    return collisionShapeContains(drawableCollisionShape(obj, `${typeName}.contains()`, file, line, state), point);
  });
  obj.collides_with = contextFunction((other: unknown, file: string, line: number) => {
    if (!isDrawableObject(other)) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `${typeName}.collides_with() expects drawable object, got '${valueOps.typeName(other)}'`,
      );
    }
    return collisionShapesIntersect(
      drawableCollisionShape(obj, `${typeName}.collides_with()`, file, line, state),
      drawableCollisionShape(other, `${typeName}.collides_with()`, file, line, state),
    );
  });
}

export function drawableCollisionShape(
  obj: RuntimeObject,
  operation: string,
  file: string,
  line: number,
  state: RuntimeObjectState,
): DrawableCollisionShape | null {
  const typeName = String(obj.__idylliumType ?? 'drawable.Drawable');

  if (typeName === 'drawable.Rectangle') {
    return rectangleCollisionShape(
      drawableTransform(obj, 'Rectangle', 1, 1, file, line),
      finiteNumber(obj.width, `${operation} Rectangle.width`, file, line),
      finiteNumber(obj.height, `${operation} Rectangle.height`, file, line),
    );
  }

  if (typeName === 'drawable.Circle') {
    return circleCollisionShape(
      drawableTransform(obj, 'Circle', 1, 1, file, line),
      finiteNumber(obj.radius, `${operation} Circle.radius`, file, line),
    );
  }

  if (typeName === 'drawable.Line') {
    return capsuleCollisionShape(
      {
        x: finiteNumber(obj.x1, `${operation} Line.x1`, file, line),
        y: finiteNumber(obj.y1, `${operation} Line.y1`, file, line),
      },
      {
        x: finiteNumber(obj.x2, `${operation} Line.x2`, file, line),
        y: finiteNumber(obj.y2, `${operation} Line.y2`, file, line),
      },
      finiteNumber(obj.thickness, `${operation} Line.thickness`, file, line),
    );
  }

  if (typeName === 'drawable.Sprite') {
    const image = obj.image;
    if (!isRuntimeObject(image) || image.is_loaded !== true) {
      throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect Sprite geometry before an image is loaded`);
    }
    return rectangleCollisionShape(
      drawableTransform(
        obj,
        'Sprite',
        finiteNumber(obj.scale_x, `${operation} Sprite.scale_x`, file, line),
        finiteNumber(obj.scale_y, `${operation} Sprite.scale_y`, file, line),
        file,
        line,
      ),
      finiteNumber(image.width, `${operation} Sprite image width`, file, line),
      finiteNumber(image.height, `${operation} Sprite image height`, file, line),
    );
  }

  if (typeName === 'drawable.Text') {
    const metrics = drawableTextMetrics(obj, operation, file, line, state);
    return rectangleCollisionShape(
      drawableTransform(obj, 'Text', 1, 1, file, line),
      metrics.width,
      metrics.height,
    );
  }

  throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect unsupported '${typeName}' geometry`);
}

export function drawableTextMetrics(
  obj: RuntimeObject,
  operation: string,
  file: string,
  line: number,
  state: RuntimeObjectState,
): RuntimeTextMetrics {
  const font = obj.font;
  if (!isRuntimeObject(font) || font.is_loaded !== true) {
    throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect Text geometry before a font is loaded`);
  }
  const text = String(obj.text ?? '');
  const fontSize = finiteNumber(obj.font_size, `${operation} Text.font_size`, file, line);
  try {
    return font.is_builtin === true
      ? state.fontMetricsService.measureDefault(text, fontSize)
      : state.fontMetricsService.measure(runtimeFontBytes(font, operation, file, line), text, fontSize);
  } catch (error) {
    if (error instanceof IdylliumRuntimeError) throw error;
    throw new IdylliumRuntimeError(file, line, `${operation} cannot measure Text: ${errorMessage(error)}`);
  }
}

export function runtimeFontBytes(font: RuntimeObject, operation: string, file: string, line: number): Uint8Array {
  const bytes = font.__fontBytes;
  if (bytes instanceof Uint8Array) return bytes;
  throw new IdylliumRuntimeError(file, line, `${operation} cannot inspect Text geometry without font bytes`);
}

export function drawableTransform(
  obj: RuntimeObject,
  typeName: string,
  scaleX: number,
  scaleY: number,
  file: string,
  line: number,
): DrawableTransform {
  return {
    x: finiteNumber(obj.x, `${typeName} x`, file, line),
    y: finiteNumber(obj.y, `${typeName} y`, file, line),
    originX: finiteNumber(obj.origin_x, `${typeName} origin_x`, file, line),
    originY: finiteNumber(obj.origin_y, `${typeName} origin_y`, file, line),
    rotation: finiteNumber(obj.rotation, `${typeName} rotation`, file, line),
    scaleX,
    scaleY,
  };
}

export function isDrawableObject(value: unknown): value is RuntimeObject {
  return isRuntimeObject(value) && value.__idylliumDrawable === true;
}
