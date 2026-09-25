// ─── Снимки: окна, виджеты, холсты (включая SVG), звук (этап Б) ────────────
import { RuntimeObject, isRuntimeObject } from './runtime-shared';
import { IdylliumArray, IdylliumColor, IdylliumTimeStamp, colorToCss, valueOps } from './runtime-values';
import { IdylliumAudioSnapshot, IdylliumCanvasSnapshot, IdylliumDrawableSnapshot, IdylliumGuiWidgetSnapshot, IdylliumModalSnapshot, IdylliumWindowSnapshot, RuntimeObjectState, CanvasSnapshotOptions, IdylliumCanvasCommand, canvasCommands } from './runtime-state';
import { isDrawableObject, drawableTransform, runtimeFontBytes } from './runtime-drawable';
import { isGuiWidget } from './runtime-gui';
import { storedStaticImage, storedAnimation, storedBitmap } from './runtime-image';
import { audioCommands } from './runtime-audio';
import { detectImageFormat, imageMimeType } from './image-service';
import { parseIdylliumStyle } from './style';
import { IdylliumRuntimeError } from './runtime-errors';

// Что хост уже показал — на время одного снимка (снимок окна спускается к холсту через
// несколько функций; протаскивать параметр через все было бы шумнее, чем эта переменная).
let knownCanvases: CanvasSnapshotOptions['knownCanvases'] | undefined;

export function withKnownCanvases<T>(options: CanvasSnapshotOptions | undefined, take: () => T): T {
  const before = knownCanvases;
  knownCanvases = options?.knownCanvases;
  try {
    return take();
  } finally {
    knownCanvases = before;
  }
}

export function canvasSnapshot(canvas: RuntimeObject): IdylliumCanvasSnapshot {
  const id = runtimeObjectId(canvas);
  const all = canvasCommands(canvas);
  const epoch = typeof canvas.__commandsEpoch === 'number' ? canvas.__commandsEpoch : 0;
  const known = knownCanvases?.[id];
  // Хвост — только если хост показал начало ЭТОГО ЖЕ списка. Анимированный спрайт рендерер
  // перерисовывает сам, по кадрам анимации, — такому холсту нужен весь список.
  const from = known && known.epoch === epoch && known.count >= 0 && known.count <= all.length && !canvasHasAnimation(canvas, all, epoch)
    ? known.count
    : 0;
  return {
    id,
    type: 'gui.Canvas',
    properties: objectPropertiesSnapshot(canvas),
    commands: (from === 0 ? all : all.slice(from)).map((command) => ({ ...command })),
    commandsFrom: from,
    total: all.length,
    epoch,
  };
}

/** Есть ли в списке анимированный спрайт. Список только растёт в пределах эпохи — просматриваем лишь новое. */
function canvasHasAnimation(canvas: RuntimeObject, all: readonly IdylliumCanvasCommand[], epoch: number): boolean {
  let scan = canvas.__animationScan as { epoch: number; scanned: number; found: boolean } | undefined;
  if (!scan || scan.epoch !== epoch || scan.scanned > all.length) {
    scan = { epoch, scanned: 0, found: false };
    canvas.__animationScan = scan;
  }
  for (; scan.scanned < all.length && !scan.found; scan.scanned += 1) {
    if (commandIsAnimated(all[scan.scanned])) scan.found = true;
  }
  if (scan.found) scan.scanned = all.length;
  return scan.found;
}

function commandIsAnimated(command: IdylliumCanvasCommand): boolean {
  const image = command.object?.properties.image as { type?: unknown } | undefined;
  return image !== undefined && image !== null && image.type === 'image.Animation';
}

// ─── Снимки холста (1.3.6) ─────────────────────────────────────────────────
// Canvas умеет отдать текущую картинку: save_svg сериализует display list в
// SVG (работает везде, включая консольный запуск — жанр turtle.save_svg),
// to_static растрирует тот же SVG через optional rasterizeSvg (браузерные
// хосты), export_to_file — сахар поверх to_static. Область по умолчанию —
// весь холст; нули ширины/высоты означают «до края».

interface CanvasCaptureRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

export function canvasCaptureRegion(
  canvas: RuntimeObject,
  values: readonly unknown[],
  methodName: string,
  file: string,
  line: number,
): CanvasCaptureRegion {
  const canvasWidth = Math.max(1, Math.round(Number(canvas.width) || 0));
  const canvasHeight = Math.max(1, Math.round(Number(canvas.height) || 0));
  const num = (value: unknown, index: number): number => {
    if (value === undefined || value === null) return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new IdylliumRuntimeError(file, line, `${methodName} region argument ${index + 1} must be a number`);
    }
    return Math.round(parsed);
  };
  const rawX = num(values[0], 0);
  const rawY = num(values[1], 1);
  const rawWidth = num(values[2], 2);
  const rawHeight = num(values[3], 3);

  const x = Math.min(Math.max(0, rawX), canvasWidth);
  const y = Math.min(Math.max(0, rawY), canvasHeight);
  const width = rawWidth <= 0 ? canvasWidth - x : Math.min(rawWidth, canvasWidth - x);
  const height = rawHeight <= 0 ? canvasHeight - y : Math.min(rawHeight, canvasHeight - y);
  if (width <= 0 || height <= 0) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `${methodName} region is empty (canvas is ${canvasWidth}x${canvasHeight}, requested x=${rawX}, y=${rawY}, width=${rawWidth}, height=${rawHeight})`,
    );
  }
  return { x, y, width, height, canvasWidth, canvasHeight };
}

function canvasSvgEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function canvasSvgNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 100) / 100;
}

function canvasSvgColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function canvasSpriteHref(imageSnapshot: unknown, state: RuntimeObjectState): string | null {
  if (!imageSnapshot || typeof imageSnapshot !== 'object') return null;
  const properties = (imageSnapshot as { properties?: Record<string, unknown> }).properties ?? {};
  const src = typeof properties.src === 'string' ? properties.src : '';
  if (src === '') return null;
  try {
    const resolved = state.fileSystem.resolvePath(src, '');
    if (!state.fileSystem.exists(resolved) || !state.fileSystem.isFile(resolved)) return null;
    const bytes = state.fileSystem.readBytes
      ? state.fileSystem.readBytes(resolved)
      : new TextEncoder().encode(state.fileSystem.readText(resolved));
    const format = detectImageFormat(bytes);
    const mime = imageMimeType(format);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as { Buffer?: { from(data: Uint8Array): { toString(encoding: string): string } } }).Buffer
        ? (globalThis as any).Buffer.from(bytes).toString('base64')
        : null;
    if (base64 === null) return null;
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

function canvasDrawableToSvg(object: IdylliumDrawableSnapshot, state: RuntimeObjectState): string {
  const props = object.properties ?? {};
  const n = canvasSvgNumber;
  const transform = (scaleX = 1, scaleY = 1): string => {
    const parts = [`translate(${n(props.x)} ${n(props.y)})`];
    const rotation = n(props.rotation, 0);
    if (rotation !== 0) parts.push(`rotate(${rotation})`);
    if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX} ${scaleY})`);
    return parts.join(' ');
  };
  const originX = n(props.origin_x);
  const originY = n(props.origin_y);

  if (object.type === 'drawable.Rectangle') {
    const width = Math.max(0, n(props.width));
    const height = Math.max(0, n(props.height));
    const fill = canvasSvgColor(props.fill_color, 'rgba(0, 0, 0, 0)');
    const parts = [`<rect x="${-originX}" y="${-originY}" width="${width}" height="${height}" fill="${fill}"/>`];
    const borderWidth = n(props.border_width, 0);
    if (borderWidth > 0) {
      parts.push(`<rect x="${-originX}" y="${-originY}" width="${width}" height="${height}" fill="none" stroke="${canvasSvgColor(props.border_color, 'rgba(0, 0, 0, 0)')}" stroke-width="${borderWidth}"/>`);
    }
    return `<g transform="${transform()}">${parts.join('')}</g>`;
  }

  if (object.type === 'drawable.Circle') {
    const radius = Math.max(0, n(props.radius));
    const fill = canvasSvgColor(props.fill_color, 'rgba(0, 0, 0, 0)');
    const parts = [`<circle cx="${radius - originX}" cy="${radius - originY}" r="${radius}" fill="${fill}"/>`];
    const borderWidth = n(props.border_width, 0);
    if (borderWidth > 0) {
      parts.push(`<circle cx="${radius - originX}" cy="${radius - originY}" r="${radius}" fill="none" stroke="${canvasSvgColor(props.border_color, 'rgba(0, 0, 0, 0)')}" stroke-width="${borderWidth}"/>`);
    }
    return `<g transform="${transform()}">${parts.join('')}</g>`;
  }

  if (object.type === 'drawable.Line') {
    const thickness = n(props.thickness, 1);
    if (thickness <= 0) return '';
    return `<line x1="${n(props.x1)}" y1="${n(props.y1)}" x2="${n(props.x2)}" y2="${n(props.y2)}" stroke="${canvasSvgColor(props.color, '#ffffff')}" stroke-width="${thickness}" stroke-linecap="round"/>`;
  }

  if (object.type === 'drawable.Text') {
    const fontSize = Math.max(1, n(props.font_size, 16));
    const text = typeof props.text === 'string' ? props.text : String(props.text ?? '');
    // Кастомные шрифты внутри SVG-картинки недоступны (svg-as-img не грузит
    // внешние ресурсы) — честный фоллбек на sans-serif.
    return `<g transform="${transform()}"><text x="${-originX}" y="${-originY}" font-size="${fontSize}" font-family="sans-serif" dominant-baseline="text-before-edge" fill="${canvasSvgColor(props.text_color, '#ffffff')}">${canvasSvgEscape(text)}</text></g>`;
  }

  if (object.type === 'turtle.Path') {
    const raw = Array.isArray(props.points) ? props.points : [];
    if (raw.length < 6) return '';
    const points: string[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
      points.push(`${n(raw[i])},${n(raw[i + 1])}`);
    }
    const borderWidth = n(props.border_width, 0);
    const stroke = borderWidth > 0
      ? ` stroke="${canvasSvgColor(props.border_color, '#000000')}" stroke-width="${borderWidth}"`
      : '';
    return `<polygon points="${points.join(' ')}" fill="${canvasSvgColor(props.fill_color, 'rgba(0, 0, 0, 0)')}"${stroke}/>`;
  }

  if (object.type === 'drawable.Sprite') {
    const scaleX = n(props.scale_x, 1);
    const scaleY = n(props.scale_y, 1);
    const imageSnapshot = props.image as { properties?: Record<string, unknown> } | undefined;
    const resource = imageSnapshot?.properties ?? {};
    const width = Math.max(1, n(resource.width, 64));
    const height = Math.max(1, n(resource.height, 64));
    const href = canvasSpriteHref(imageSnapshot, state);
    if (href !== null) {
      return `<g transform="${transform(scaleX, scaleY)}"><image x="${-originX}" y="${-originY}" width="${width}" height="${height}" href="${href}" preserveAspectRatio="none"/></g>`;
    }
    // Файл не читается — плейсхолдер, как в живом рендерере.
    const label = canvasSvgEscape(typeof resource.src === 'string' && resource.src !== '' ? resource.src : 'sprite');
    return `<g transform="${transform(scaleX, scaleY)}">`
      + `<rect x="${-originX}" y="${-originY}" width="${width}" height="${height}" fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.55)"/>`
      + `<text x="${-originX + 6}" y="${-originY + 6}" font-size="12" font-family="sans-serif" dominant-baseline="text-before-edge" fill="rgba(255, 255, 255, 0.75)">${label}</text></g>`;
  }

  return '';
}

export function canvasToSvg(canvas: RuntimeObject, region: CanvasCaptureRegion, state: RuntimeObjectState): string {
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${region.width}" height="${region.height}" viewBox="${region.x} ${region.y} ${region.width} ${region.height}">`);
  // Основа как в живом рендерере: background_color холста, а без него (или с прозрачным) — чёрный.
  // clear() возвращает к той же основе, цвет из команды не читается — иначе файл расходился бы с экраном.
  const background = canvas.background_color;
  const base = background instanceof IdylliumColor && background.alpha > 0 ? background.toCss() : '#000000';
  const wholeCanvas = (fill: string): string => `<rect x="0" y="0" width="${region.canvasWidth}" height="${region.canvasHeight}" fill="${fill}"/>`;
  parts.push(wholeCanvas(canvasSvgColor(base, '#000000')));
  for (const command of canvasCommands(canvas)) {
    if (command.kind === 'clear') parts.push(wholeCanvas(canvasSvgColor(base, '#000000')));
    if (command.kind === 'fill') parts.push(wholeCanvas(canvasSvgColor(command.color, '#000000')));
    if (command.kind === 'draw' && command.object) {
      const svg = canvasDrawableToSvg(command.object, state);
      if (svg !== '') parts.push(svg);
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export function audioSnapshot(audio: RuntimeObject): IdylliumAudioSnapshot {
  return {
    id: runtimeObjectId(audio),
    type: audio.__idylliumType === 'audio.Music' ? 'audio.Music' : 'audio.Sound',
    properties: objectPropertiesSnapshot(audio),
    commands: audioCommands(audio).map((command) => ({ ...command })),
  };
}

export function windowSnapshot(window: RuntimeObject): IdylliumWindowSnapshot {
  return {
    id: runtimeObjectId(window),
    type: 'gui.Window',
    properties: objectPropertiesSnapshot(window),
    children: widgetChildrenSnapshot(window),
  };
}

export function modalSnapshot(modal: RuntimeObject): IdylliumModalSnapshot {
  const mode = modal.__modalMode === 'confirm' || modal.__modalMode === 'input' ? modal.__modalMode : 'alert';
  return {
    id: runtimeObjectId(modal),
    type: 'gui.Modal',
    mode,
    properties: objectPropertiesSnapshot(modal),
  };
}

export function widgetSnapshot(widget: RuntimeObject): IdylliumGuiWidgetSnapshot {
  const type = String(widget.__idylliumType ?? 'gui.Widget');
  return {
    id: runtimeObjectId(widget),
    type,
    properties: objectPropertiesSnapshot(widget),
    children: widgetChildrenSnapshot(widget),
    canvas: type === 'gui.Canvas' ? canvasSnapshot(widget) : undefined,
    items: type === 'gui.ComboBox' && Array.isArray(widget.__items) ? [...widget.__items] as string[] : undefined,
    columns: type === 'gui.Table' && Array.isArray(widget.__columns) ? [...widget.__columns] as string[] : undefined,
    rows: type === 'gui.Table' && Array.isArray(widget.__rows)
      ? (widget.__rows as string[][]).map((row) => [...row])
      : undefined,
    entries: (type === 'gui.BarChart' || type === 'gui.PieChart') && Array.isArray(widget.__entries)
      ? (widget.__entries as { label: string; value: number }[]).map((entry) => ({ ...entry }))
      : undefined,
    points: type === 'gui.LineChart' && Array.isArray(widget.__points) ? [...widget.__points] as number[] : undefined,
  };
}

function widgetChildrenSnapshot(widget: RuntimeObject): readonly IdylliumGuiWidgetSnapshot[] {
  const children = widget.__children;
  if (!Array.isArray(children)) return [];
  return (children as RuntimeObject[]).map(widgetSnapshot);
}

export function drawableSnapshot(value: RuntimeObject): IdylliumDrawableSnapshot {
  return {
    type: String(value.__idylliumType ?? 'drawable.Drawable'),
    properties: objectPropertiesSnapshot(value),
  };
}

// Сторож циклов снимка. Наследник виджета впервые вешает ПОЛЬЗОВАТЕЛЬСКИЕ поля
// прямо на рантайм-виджет, поэтому два виджета могут ссылаться друг на друга
// (или на себя) — без сторожа пара objectPropertiesSnapshot/snapshotValue
// уходила в бесконечную рекурсию и роняла предпросмотр голым JS-стеком.

const snapshotSeen = new Set<unknown>();

export function objectPropertiesSnapshot(value: RuntimeObject): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  // Сам объект — уже «в работе»: поле, ведущее обратно к нему, дальше не пойдёт.
  const alreadySeen = snapshotSeen.has(value);
  if (!alreadySeen) snapshotSeen.add(value);
  try {
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith('__') || typeof item === 'function') continue;
      result[key] = snapshotValue(item);
    }
    if (Array.isArray(value.__tabTitles)) {
      result.tab_titles = [...(value.__tabTitles as string[])];
    }
    if (typeof value.style === 'string' && value.style.trim() !== '') {
      // IdySS: в браузер уезжают только провалидированные пары — рендерер
      // строк не разбирает и произвольный CSS не видит.
      result.style_declarations = parseIdylliumStyle(value.style);
    }
    if (typeof value.style_hover === 'string' && value.style_hover.trim() !== '') {
      result.style_hover_declarations = parseIdylliumStyle(value.style_hover);
    }
    if (typeof value.style_active === 'string' && value.style_active.trim() !== '') {
      result.style_active_declarations = parseIdylliumStyle(value.style_active);
    }
    if (typeof value.style_disabled === 'string' && value.style_disabled.trim() !== '') {
      result.style_disabled_declarations = parseIdylliumStyle(value.style_disabled);
    }
    if (value.__explicitProperties instanceof Set && value.__explicitProperties.size > 0) {
      result.__explicit_properties = [...value.__explicitProperties].sort();
    }
    return result;
  } finally {
    if (!alreadySeen) snapshotSeen.delete(value);
  }
}

export function runtimeObjectId(value: RuntimeObject): number {
  return typeof value.__idylliumObjectId === 'number' ? value.__idylliumObjectId : 0;
}

export function snapshotValue(value: unknown): unknown {
  if (value instanceof IdylliumColor) return value.toCss();
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof IdylliumArray) return value.values().map(snapshotValue);
  if (isRuntimeObject(value)) {
    // Уже встреченный объект второй раз в снимок не разворачиваем: цикл
    // ссылок отмечается ссылкой на тип, а не бесконечной рекурсией.
    if (snapshotSeen.has(value)) {
      return { type: String(value.__idylliumType ?? 'object'), properties: {}, cyclic: true };
    }
    snapshotSeen.add(value);
    try {
      return {
        type: String(value.__idylliumType ?? 'object'),
        properties: objectPropertiesSnapshot(value),
      };
    } finally {
      snapshotSeen.delete(value);
    }
  }
  return value;
}
