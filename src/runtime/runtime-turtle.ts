// ─── turtle: черепашья графика — модуль рантайма (этап Б, 2026-08-29) ──────
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, finiteNumber, intArgument, stringArgument } from './runtime-shared';
import { IdylliumColor, valueOps } from './runtime-values';
import { IdylliumDrawableSnapshot, RuntimeObjectState, TurtleEntry, TurtleFieldState, canvasCommands, defineValidatedRuntimeProperty, objectFactory } from './runtime-state';
import { colorBlack, colorToCss } from './runtime-values';
import { errorMessage } from './runtime-shared';

export const TURTLE_FRAME_MS = 25;

export function ensureTurtleField(state: RuntimeObjectState): TurtleFieldState {
  if (state.turtleField) return state.turtleField;

  const field: TurtleFieldState = {
    window: null,
    canvas: null,
    turtles: [],
    entries: [],
    width: 600,
    height: 600,
    bgColor: '#ffffff',
  };
  state.turtleField = field;

  if (state.turtlePlatform !== 'cli') {
    // Окно и канва рождаются фабрикой ядра (шов objectFactory): черепаший
    // модуль не знает устройства gui-инициализации.
    const window = objectFactory.create('gui', 'Window', state);
    window.title = 'Черепашье поле';
    window.width = field.width;
    window.height = field.height;
    window.__shown = true;

    const canvas = objectFactory.create('gui', 'Canvas', state);
    canvas.x = 0;
    canvas.y = 0;
    canvas.width = field.width;
    canvas.height = field.height;
    canvas.__parent = window;
    (window.__children as RuntimeObject[]).push(canvas);

    field.window = window;
    field.canvas = canvas;
  }

  rebuildTurtleFieldCommands(state);
  return field;
}

function turtleToCanvasX(field: TurtleFieldState, x: number): number {
  return field.width / 2 + x;
}

function turtleToCanvasY(field: TurtleFieldState, y: number): number {
  return field.height / 2 - y;
}

export function turtleCss(value: unknown): string {
  return value instanceof IdylliumColor ? value.toCss() : '#000000';
}

export function rebuildTurtleFieldCommands(state: RuntimeObjectState): void {
  const field = state.turtleField;
  if (!field || !field.canvas) return;
  const commands = canvasCommands(field.canvas);
  commands.length = 0;
  commands.push({ kind: 'clear', color: field.bgColor });
  for (const entry of field.entries) {
    commands.push({ kind: 'draw', object: turtleEntrySnapshot(entry, field) });
  }
  for (const turtle of field.turtles) {
    if (turtle.visible !== true) continue;
    commands.push({ kind: 'draw', object: turtleSpriteSnapshot(turtle, field) });
  }
}

function turtleEntrySnapshot(entry: TurtleEntry, field: TurtleFieldState): IdylliumDrawableSnapshot {
  if (entry.kind === 'line') {
    return {
      type: 'drawable.Line',
      properties: {
        x1: turtleToCanvasX(field, entry.x1),
        y1: turtleToCanvasY(field, entry.y1),
        x2: turtleToCanvasX(field, entry.x2),
        y2: turtleToCanvasY(field, entry.y2),
        color: entry.color,
        thickness: entry.width,
      },
    };
  }
  if (entry.kind === 'dot') {
    const radius = entry.size / 2;
    return {
      type: 'drawable.Circle',
      properties: {
        x: turtleToCanvasX(field, entry.x) - radius,
        y: turtleToCanvasY(field, entry.y) - radius,
        radius,
        fill_color: entry.color,
        border_width: 0,
      },
    };
  }
  if (entry.kind === 'poly') {
    const points: number[] = [];
    for (let i = 0; i + 1 < entry.points.length; i += 2) {
      points.push(turtleToCanvasX(field, entry.points[i]), turtleToCanvasY(field, entry.points[i + 1]));
    }
    return { type: 'turtle.Path', properties: { points, fill_color: entry.color } };
  }
  return {
    type: 'drawable.Text',
    properties: {
      x: turtleToCanvasX(field, entry.x) + 6,
      y: turtleToCanvasY(field, entry.y) - 18,
      text: entry.text,
      text_color: entry.color,
      font_size: 14,
    },
  };
}

function turtleSpriteSnapshot(turtle: RuntimeObject, field: TurtleFieldState): IdylliumDrawableSnapshot {
  const x = Number(turtle.x);
  const y = Number(turtle.y);
  const rad = (Number(turtle.heading) * Math.PI) / 180;
  const size = 12;
  const corners = [
    [x + Math.cos(rad) * size, y + Math.sin(rad) * size],
    [x + Math.cos(rad + 2.5) * size * 0.8, y + Math.sin(rad + 2.5) * size * 0.8],
    [x + Math.cos(rad - 2.5) * size * 0.8, y + Math.sin(rad - 2.5) * size * 0.8],
  ];
  const points: number[] = [];
  for (const [px, py] of corners) {
    points.push(turtleToCanvasX(field, px), turtleToCanvasY(field, py));
  }
  return {
    type: 'turtle.Path',
    properties: { points, fill_color: turtleCss(turtle.pen_color), border_color: '#ffffff', border_width: 1 },
  };
}

export function turtleAnimationSteps(state: RuntimeObjectState, speed: number, magnitude: number): number {
  if (state.turtlePlatform === 'cli' || speed <= 0) return 1;
  const perFrame = speed * speed * 1.4 + 3;
  return Math.max(1, Math.min(120, Math.ceil(Math.abs(magnitude) / perFrame)));
}

export function normalizeTurtleHeading(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Прищёлкивает координату к 6 знакам: после cos(90°) ребёнок должен видеть
 *  x = 0, а не 4.9e-15. Микронная точность глазу неотличима. */

function snapTurtleCoordinate(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function initializeTurtleObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Turtle') return;
  const field = ensureTurtleField(state);

  obj.x = 0;
  obj.y = 0;
  obj.heading = 0;
  obj.is_down = true;
  obj.__turtleFill = null;

  defineValidatedRuntimeProperty(obj, 'pen_color', colorBlack(), (value) => value, () => rebuildTurtleFieldCommands(state));
  defineValidatedRuntimeProperty(obj, 'fill_color', colorBlack(), (value) => value);
  defineValidatedRuntimeProperty(obj, 'pen_width', 2, (value, file, line) => {
    const width = Math.trunc(Number(value));
    if (!Number.isFinite(width) || width < 1 || width > 100) {
      throw new IdylliumRuntimeError(file, line, `Turtle.pen_width must be between 1 and 100, got ${String(value)}`);
    }
    return width;
  });
  defineValidatedRuntimeProperty(obj, 'speed', 6, (value, file, line) => {
    const speed = Math.trunc(Number(value));
    if (!Number.isFinite(speed) || speed < 0 || speed > 10) {
      throw new IdylliumRuntimeError(file, line, `Turtle.speed must be between 0 and 10, got ${String(value)}`);
    }
    return speed;
  });
  defineValidatedRuntimeProperty(obj, 'visible', true, (value) => value === true, () => rebuildTurtleFieldCommands(state));

  obj.forward = contextFunction(async (distance: unknown, file: string, line: number) => {
    const length = Number(distance);
    const rad = (Number(obj.heading) * Math.PI) / 180;
    await turtleTravel(
      state,
      obj,
      snapTurtleCoordinate(Number(obj.x) + Math.cos(rad) * length),
      snapTurtleCoordinate(Number(obj.y) + Math.sin(rad) * length),
      file,
      line,
    );
  });
  obj.back = contextFunction(async (distance: unknown, file: string, line: number) => {
    const length = -Number(distance);
    const rad = (Number(obj.heading) * Math.PI) / 180;
    await turtleTravel(
      state,
      obj,
      snapTurtleCoordinate(Number(obj.x) + Math.cos(rad) * length),
      snapTurtleCoordinate(Number(obj.y) + Math.sin(rad) * length),
      file,
      line,
    );
  });
  obj.left = contextFunction(async (angle: unknown, file: string, line: number) => {
    await turtleTurn(state, obj, Number(angle), file, line);
  });
  obj.right = contextFunction(async (angle: unknown, file: string, line: number) => {
    await turtleTurn(state, obj, -Number(angle), file, line);
  });
  obj.set_heading = contextFunction(async (angle: unknown, file: string, line: number) => {
    const target = normalizeTurtleHeading(Number(angle));
    // Кратчайшая дуга: доворот в диапазоне (-180, 180].
    const delta = ((target - Number(obj.heading) + 540) % 360) - 180;
    await turtleTurn(state, obj, delta, file, line);
    // Финальный угол выставляем точно — без накопленной дробной пыли.
    obj.heading = target;
    rebuildTurtleFieldCommands(state);
  });
  obj.goto = contextFunction(async (x: unknown, y: unknown, file: string, line: number) => {
    await turtleTravel(state, obj, Number(x), Number(y), file, line);
  });
  obj.home = contextFunction(async (file: string, line: number) => {
    await turtleTravel(state, obj, 0, 0, file, line);
    obj.heading = 0;
    rebuildTurtleFieldCommands(state);
  });
  obj.pen_up = contextFunction((_file: string, _line: number) => {
    obj.is_down = false;
  });
  obj.pen_down = contextFunction((_file: string, _line: number) => {
    obj.is_down = true;
  });
  obj.dot = contextFunction((size: unknown, file: string, line: number) => {
    const diameter = size === undefined ? 8 : Math.trunc(Number(size));
    if (!Number.isFinite(diameter) || diameter < 1 || diameter > 400) {
      throw new IdylliumRuntimeError(file, line, `Turtle.dot() size must be between 1 and 400, got ${String(size)}`);
    }
    field.entries.push({ kind: 'dot', x: Number(obj.x), y: Number(obj.y), size: diameter, color: turtleCss(obj.pen_color) });
    rebuildTurtleFieldCommands(state);
  });
  obj.write = contextFunction((text: unknown, _file: string, _line: number) => {
    field.entries.push({ kind: 'text', x: Number(obj.x), y: Number(obj.y), text: String(text), color: turtleCss(obj.pen_color) });
    rebuildTurtleFieldCommands(state);
  });
  obj.begin_fill = contextFunction((file: string, line: number) => {
    if (obj.__turtleFill) {
      throw new IdylliumRuntimeError(file, line, 'begin_fill() is already active — call end_fill() first');
    }
    obj.__turtleFill = { points: [Number(obj.x), Number(obj.y)], insertIndex: field.entries.length };
  });
  obj.end_fill = contextFunction((file: string, line: number) => {
    const fill = obj.__turtleFill as { points: number[]; insertIndex: number } | null;
    if (!fill) {
      throw new IdylliumRuntimeError(file, line, 'end_fill() without begin_fill()');
    }
    obj.__turtleFill = null;
    if (fill.points.length >= 6) {
      // Заливка ложится ПОД свой контур: вставляем её туда, где контур начался.
      field.entries.splice(fill.insertIndex, 0, { kind: 'poly', points: fill.points, color: turtleCss(obj.fill_color) });
    }
    rebuildTurtleFieldCommands(state);
  });
  obj.to_string = () => (
    `turtle.Turtle(x: ${Math.round(Number(obj.x))}, y: ${Math.round(Number(obj.y))}, heading: ${Math.round(Number(obj.heading))})`
  );

  field.turtles.push(obj);
  rebuildTurtleFieldCommands(state);
}

export function createTurtleModule(state: RuntimeObjectState): Record<string, unknown> {
  return {
    setup: contextFunction((width: unknown, height: unknown, file: string, line: number) => {
      const w = Math.trunc(Number(width));
      const h = Math.trunc(Number(height));
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 100 || w > 2000 || h > 2000) {
        throw new IdylliumRuntimeError(file, line, `turtle.setup() expects sizes between 100 and 2000, got ${String(width)}×${String(height)}`);
      }
      const field = ensureTurtleField(state);
      field.width = w;
      field.height = h;
      if (field.window) {
        field.window.width = w;
        field.window.height = h;
      }
      if (field.canvas) {
        field.canvas.width = w;
        field.canvas.height = h;
      }
      rebuildTurtleFieldCommands(state);
    }),
    title: contextFunction((text: unknown, _file: string, _line: number) => {
      const field = ensureTurtleField(state);
      if (field.window) field.window.title = String(text);
    }),
    bg_color: contextFunction((value: unknown, file: string, line: number) => {
      const field = ensureTurtleField(state);
      field.bgColor = colorToCss(value, 'turtle.bg_color() color', file, line);
      rebuildTurtleFieldCommands(state);
    }),
    clear: contextFunction((_file: string, _line: number) => {
      const field = ensureTurtleField(state);
      field.entries.length = 0;
      rebuildTurtleFieldCommands(state);
    }),
    save_svg: contextFunction((pathValue: unknown, file: string, line: number) => {
      const field = ensureTurtleField(state);
      const requestedPath = stringArgument(pathValue, 'turtle.save_svg() path', file, line);
      const resolved = state.fileSystem.resolvePath(requestedPath, file);
      try {
        state.fileSystem.writeText(resolved, turtleSvg(field));
      } catch (error) {
        const reason = errorMessage(error);
        const shown = state.fileSystem.humanizePaths?.(reason) ?? reason;
        throw new IdylliumRuntimeError(file, line, `turtle.save_svg() cannot write '${requestedPath}': ${shown}`);
      }
    }),
  };
}

export function turtleSvg(field: TurtleFieldState): string {
  const fmt = (value: number): string => String(Math.round(value * 100) / 100);
  const escapeXml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${field.width}" height="${field.height}" viewBox="0 0 ${field.width} ${field.height}">`);
  parts.push(`<rect width="100%" height="100%" fill="${field.bgColor}"/>`);
  for (const entry of field.entries) {
    if (entry.kind === 'line') {
      parts.push(`<line x1="${fmt(turtleToCanvasX(field, entry.x1))}" y1="${fmt(turtleToCanvasY(field, entry.y1))}" x2="${fmt(turtleToCanvasX(field, entry.x2))}" y2="${fmt(turtleToCanvasY(field, entry.y2))}" stroke="${entry.color}" stroke-width="${entry.width}" stroke-linecap="round"/>`);
    } else if (entry.kind === 'dot') {
      parts.push(`<circle cx="${fmt(turtleToCanvasX(field, entry.x))}" cy="${fmt(turtleToCanvasY(field, entry.y))}" r="${fmt(entry.size / 2)}" fill="${entry.color}"/>`);
    } else if (entry.kind === 'poly') {
      const points: string[] = [];
      for (let i = 0; i + 1 < entry.points.length; i += 2) {
        points.push(`${fmt(turtleToCanvasX(field, entry.points[i]))},${fmt(turtleToCanvasY(field, entry.points[i + 1]))}`);
      }
      parts.push(`<polygon points="${points.join(' ')}" fill="${entry.color}"/>`);
    } else {
      parts.push(`<text x="${fmt(turtleToCanvasX(field, entry.x) + 6)}" y="${fmt(turtleToCanvasY(field, entry.y) - 6)}" fill="${entry.color}" font-size="14" font-family="sans-serif">${escapeXml(entry.text)}</text>`);
    }
  }
  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

export async function turtleTravel(
  state: RuntimeObjectState,
  obj: RuntimeObject,
  targetX: number,
  targetY: number,
  file: string,
  line: number,
): Promise<void> {
  const field = ensureTurtleField(state);
  const startX = Number(obj.x);
  const startY = Number(obj.y);
  const distance = Math.hypot(targetX - startX, targetY - startY);
  const steps = turtleAnimationSteps(state, Number(obj.speed), distance);

  let entry: Extract<TurtleEntry, { kind: 'line' }> | null = null;
  if (obj.is_down === true && distance > 0) {
    entry = {
      kind: 'line',
      x1: startX,
      y1: startY,
      x2: startX,
      y2: startY,
      color: turtleCss(obj.pen_color),
      width: Number(obj.pen_width),
    };
    field.entries.push(entry);
  }

  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    obj.x = startX + (targetX - startX) * t;
    obj.y = startY + (targetY - startY) * t;
    if (entry) {
      entry.x2 = Number(obj.x);
      entry.y2 = Number(obj.y);
    }
    rebuildTurtleFieldCommands(state);
    if (step < steps) await turtleFrame(state, file, line);
  }

  obj.x = targetX;
  obj.y = targetY;
  if (entry) {
    entry.x2 = targetX;
    entry.y2 = targetY;
  }
  const fill = obj.__turtleFill as { points: number[] } | null;
  if (fill) fill.points.push(targetX, targetY);
  rebuildTurtleFieldCommands(state);
}

export async function turtleTurn(
  state: RuntimeObjectState,
  obj: RuntimeObject,
  deltaDeg: number,
  file: string,
  line: number,
): Promise<void> {
  ensureTurtleField(state);
  const start = Number(obj.heading);
  // Повороты анимируем вчетверо бодрее движения: угол «легче» пикселя.
  const steps = turtleAnimationSteps(state, Number(obj.speed), deltaDeg / 4);
  for (let step = 1; step <= steps; step++) {
    obj.heading = normalizeTurtleHeading(start + deltaDeg * (step / steps));
    rebuildTurtleFieldCommands(state);
    if (step < steps) await turtleFrame(state, file, line);
  }
}

export async function turtleFrame(state: RuntimeObjectState, file: string, line: number): Promise<void> {
  state.stopCheck?.(file, line);
  await new Promise((resolve) => setTimeout(resolve, TURTLE_FRAME_MS));
  state.stopCheck?.(file, line);
}
