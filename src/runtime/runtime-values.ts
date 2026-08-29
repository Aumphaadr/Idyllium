// Значения-классы Idyllium: цвет, момент времени, массив — фундамент,
// не зависящий от состояния рантайма. Вынесено из runtime.ts 2026-08-29.
import { IdylliumRuntimeError } from './runtime-errors';
import { ContextualRuntimeFunction, byteRange, finiteNumber, integerNumber, rangeNumber, stringArgument } from './runtime-shared';

/**
 * Операции над значениями (равенство, сравнение, печать, имя типа) живут в
 * ядре рантайма — они знают про json- и sqlite-значения. Классы получают их
 * инъекцией при загрузке ядра: единственный шов, разрывающий цикл модулей.
 */
export interface ValueOperations {
  equals(left: unknown, right: unknown): boolean;
  compare(left: unknown, right: unknown): number;
  inspect(value: unknown): string;
  typeName(value: unknown): string;
  isNull(value: unknown): boolean;
}

const notLoaded = (): never => {
  throw new Error('runtime core is not loaded: value operations are not registered');
};

export const valueOps: ValueOperations = {
  equals: notLoaded,
  compare: notLoaded,
  inspect: notLoaded,
  typeName: notLoaded,
  isNull: notLoaded,
};

export function registerValueOperations(ops: ValueOperations): void {
  Object.assign(valueOps, ops);
}

export class IdylliumColor {
  private constructor(
    readonly red: number,
    readonly green: number,
    readonly blue: number,
    readonly alpha: number,
  ) {}

  static RGB(red: number, green: number, blue: number, file = 'colors', line = 0): IdylliumColor {
    return new IdylliumColor(
      channel(red, 'colors.RGB() red', file, line),
      channel(green, 'colors.RGB() green', file, line),
      channel(blue, 'colors.RGB() blue', file, line),
      1,
    );
  }

  static RGBA(red: number, green: number, blue: number, alpha: number, file = 'colors', line = 0): IdylliumColor {
    return new IdylliumColor(
      channel(red, 'colors.RGBA() red', file, line),
      channel(green, 'colors.RGBA() green', file, line),
      channel(blue, 'colors.RGBA() blue', file, line),
      opacity(alpha, 'colors.RGBA() alpha', file, line),
    );
  }

  static HEX(value: string, file = 'colors', line = 0): IdylliumColor {
    if (typeof value !== 'string') {
      throw new IdylliumRuntimeError(file, line, `colors.HEX() expects string, got '${String(value)}'`);
    }
    const normalized = value.trim();
    const match = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u.exec(normalized);
    if (!match) {
      throw new IdylliumRuntimeError(file, line, `invalid HEX color '${value}'`);
    }

    const hex = match[1];
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return IdylliumColor.RGBA(red, green, blue, alpha, file, line);
  }

  static HSL(hue: number, saturation: number, lightness: number, file = 'colors', line = 0): IdylliumColor {
    const h = percentRange(hue, 'colors.HSL() hue', 0, 360, file, line);
    const s = percent(saturation, 'colors.HSL() saturation', file, line);
    const l = percent(lightness, 'colors.HSL() lightness', file, line);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let red = 0;
    let green = 0;
    let blue = 0;

    if (h < 60) {
      red = c;
      green = x;
    } else if (h < 120) {
      red = x;
      green = c;
    } else if (h < 180) {
      green = c;
      blue = x;
    } else if (h < 240) {
      green = x;
      blue = c;
    } else if (h < 300) {
      red = x;
      blue = c;
    } else {
      red = c;
      blue = x;
    }

    return IdylliumColor.RGB(
      Math.round((red + m) * 255),
      Math.round((green + m) * 255),
      Math.round((blue + m) * 255),
      file,
      line,
    );
  }

  callMethod(name: string, args: readonly unknown[], file: string, line: number): IdylliumColor {
    switch (name) {
      case 'with_red':
        return IdylliumColor.RGBA(
          channel(args[0], 'colors.Color.with_red() value', file, line),
          this.green,
          this.blue,
          this.alpha,
          file,
          line,
        );
      case 'with_green':
        return IdylliumColor.RGBA(
          this.red,
          channel(args[0], 'colors.Color.with_green() value', file, line),
          this.blue,
          this.alpha,
          file,
          line,
        );
      case 'with_blue':
        return IdylliumColor.RGBA(
          this.red,
          this.green,
          channel(args[0], 'colors.Color.with_blue() value', file, line),
          this.alpha,
          file,
          line,
        );
      case 'with_alpha':
        return IdylliumColor.RGBA(
          this.red,
          this.green,
          this.blue,
          opacity(args[0], 'colors.Color.with_alpha() value', file, line),
          file,
          line,
        );
      case 'with_rgb':
        return IdylliumColor.RGBA(
          channel(args[0], 'colors.Color.with_rgb() red', file, line),
          channel(args[1], 'colors.Color.with_rgb() green', file, line),
          channel(args[2], 'colors.Color.with_rgb() blue', file, line),
          this.alpha,
          file,
          line,
        );
      case 'with_rgba':
        return IdylliumColor.RGBA(
          channel(args[0], 'colors.Color.with_rgba() red', file, line),
          channel(args[1], 'colors.Color.with_rgba() green', file, line),
          channel(args[2], 'colors.Color.with_rgba() blue', file, line),
          opacity(args[3], 'colors.Color.with_rgba() alpha', file, line),
          file,
          line,
        );
      default:
        throw new IdylliumRuntimeError(file, line, `colors.Color has no method '${name}'`);
    }
  }

  toHex(): string {
    return `#${hex(this.red)}${hex(this.green)}${hex(this.blue)}`;
  }

  toCss(): string {
    if (this.alpha === 1) return this.toHex();
    return `rgba(${this.red}, ${this.green}, ${this.blue}, ${trimFloat(this.alpha)})`;
  }

  toString(): string {
    return this.toCss();
  }
}

interface TimeStampComponents {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly weekDay: number;
}

const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>();

const weekDayNumbers: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export class IdylliumTimeStamp {
  readonly timezone: string;
  private readonly components: TimeStampComponents;
  private readonly epochMs: number;

  constructor(
    unixSeconds: number,
    timezone: unknown = 'UTC',
    file = 'time',
    line = 0,
  ) {
    this.epochMs = Math.round(unixSeconds * 1000);
    this.timezone = normalizeTimeZone(timezone, 'time.stamp timezone', file, line);
    this.components = timeStampComponents(Math.floor(this.epochMs / 1000), this.timezone, file, line);
  }

  static now(timezone: unknown, file: string, line: number): IdylliumTimeStamp {
    return new IdylliumTimeStamp(Date.now() / 1000, timezone, file, line);
  }

  static fromUnix(seconds: unknown, timezone: unknown, file: string, line: number): IdylliumTimeStamp {
    const unixSeconds = finiteNumber(seconds, 'time.from_unix() seconds', file, line);
    return new IdylliumTimeStamp(unixSeconds, timezone, file, line);
  }

  // time.create(год, месяц, день[, час, минута, секунда, миллисекунда, зона]):
  // компоненты — местное время УКАЗАННОЙ зоны. Инстант ищется двухпроходной
  // коррекцией смещения (стандартный приём для IANA-зон с переводами часов).
  static create(values: readonly unknown[], file: string, line: number): IdylliumTimeStamp {
    const component = (index: number, name: string, min: number, max: number, fallback: number): number => {
      if (values[index] === undefined) return fallback;
      const value = integerNumber(values[index], `time.create() ${name}`, file, line);
      return byteRange(value, `time.create() ${name}`, min, max, file, line);
    };

    const year = component(0, 'year', 1, 9999, 0);
    const month = component(1, 'month', 1, 12, 0);
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const day = component(2, 'day', 1, 31, 0);
    if (day > monthDays[month - 1]) {
      const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      throw new IdylliumRuntimeError(file, line, `time.create() date ${iso} does not exist`);
    }
    const hour = component(3, 'hour', 0, 23, 0);
    const minute = component(4, 'minute', 0, 59, 0);
    const second = component(5, 'second', 0, 59, 0);
    const millisecond = component(6, 'millisecond', 0, 999, 0);
    const timezone = normalizeTimeZone(values[7] ?? 'UTC', 'time.create() timezone', file, line);

    // Стеночное время как «UTC-заготовка» (setUTCFullYear — из-за причуды
    // Date.UTC с годами 0–99).
    const wall = new Date(Date.UTC(2000, month - 1, day, hour, minute, second, millisecond));
    wall.setUTCFullYear(year);
    const wallMs = wall.getTime();

    const offsetAt = (instantMs: number): number => {
      const parts = timeStampComponents(Math.floor(instantMs / 1000), timezone, file, line);
      const partsWall = new Date(Date.UTC(2000, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
      partsWall.setUTCFullYear(parts.year);
      return partsWall.getTime() - Math.floor(instantMs / 1000) * 1000;
    };

    const firstGuess = wallMs - offsetAt(wallMs);
    const epochMs = wallMs - offsetAt(firstGuess);
    return new IdylliumTimeStamp(epochMs / 1000, timezone, file, line);
  }

  get year(): number {
    return this.components.year;
  }

  get month(): number {
    return this.components.month;
  }

  get day(): number {
    return this.components.day;
  }

  get hour(): number {
    return this.components.hour;
  }

  get minute(): number {
    return this.components.minute;
  }

  get second(): number {
    return this.components.second;
  }

  get week_day(): number {
    return this.components.weekDay;
  }

  get unix(): number {
    return Math.floor(this.epochMs / 1000);
  }

  /** Момент в миллисекундах — для равенства и порядка штампов (пояс не участвует). */
  get instantMs(): number {
    return this.epochMs;
  }

  get millisecond(): number {
    return this.epochMs - Math.floor(this.epochMs / 1000) * 1000;
  }

  in_timezone(timezone: unknown, file: string, line: number): IdylliumTimeStamp {
    return new IdylliumTimeStamp(this.epochMs / 1000, timezone, file, line);
  }

  to_string(): string {
    return [
      this.year.toString().padStart(4, '0'),
      '-',
      this.month.toString().padStart(2, '0'),
      '-',
      this.day.toString().padStart(2, '0'),
      ' ',
      this.hour.toString().padStart(2, '0'),
      ':',
      this.minute.toString().padStart(2, '0'),
      ':',
      this.second.toString().padStart(2, '0'),
    ].join('');
  }

  toString(): string {
    return this.to_string();
  }

}

// Метод с контекстом file/line: пометка живёт рядом с классом (сцепка
// перенесена сюда при выносе contextFunction в runtime-shared).

(IdylliumTimeStamp.prototype.in_timezone as ContextualRuntimeFunction).__idylliumPassContext = true;

export function normalizeTimeZone(value: unknown, argumentName: string, file: string, line: number): string {
  const requested = stringArgument(value, argumentName, file, line);
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: requested }).resolvedOptions().timeZone;
  } catch {
    throw new IdylliumRuntimeError(file, line, `${argumentName} is unknown, got ${JSON.stringify(requested)}`);
  }
}

export function timeStampComponents(
  unixSeconds: number,
  timezone: string,
  file: string,
  line: number,
): TimeStampComponents {
  const date = new Date(unixSeconds * 1000);
  if (!Number.isFinite(date.getTime())) {
    throw new IdylliumRuntimeError(file, line, `time.stamp unix value is outside the supported date range, got ${unixSeconds}`);
  }

  let formatter = timeZoneFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US-u-nu-latn', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    timeZoneFormatters.set(timezone, formatter);
  }

  const values = new Map<string, string>(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const numberPart = (name: string): number => Number.parseInt(values.get(name) ?? '', 10);
  const weekDay = weekDayNumbers[values.get('weekday') ?? ''];
  const components: TimeStampComponents = {
    year: numberPart('year'),
    month: numberPart('month'),
    day: numberPart('day'),
    hour: numberPart('hour'),
    minute: numberPart('minute'),
    second: numberPart('second'),
    weekDay,
  };
  if (Object.values(components).some((value) => !Number.isInteger(value))) {
    throw new IdylliumRuntimeError(file, line, `time.stamp cannot represent unix value ${unixSeconds} in timezone '${timezone}'`);
  }
  return components;
}

export type IdylliumArrayDefaultFactory = () => unknown | Promise<unknown>;

export class IdylliumArray {
  constructor(
    private readonly items: unknown[],
    private readonly dynamic: boolean,
    private readonly staticSize: number | null,
    private readonly defaultFactory: IdylliumArrayDefaultFactory,
  ) {
    if (!dynamic && staticSize !== null && items.length !== staticSize) {
      throw new IdylliumRuntimeError('array', 0, `array initializer has ${items.length} elements, but static array requires ${staticSize}`);
    }
  }

  static create(size: number, defaultFactory: () => unknown, dynamic: boolean): IdylliumArray {
    assertCreatableArraySize(size);
    const normalizedSize = Math.max(0, Math.trunc(Number(size)));
    return new IdylliumArray(
      Array.from({ length: normalizedSize }, () => defaultFactory()),
      dynamic,
      dynamic ? null : normalizedSize,
      defaultFactory,
    );
  }

  static async createAsync(
    size: number,
    defaultFactory: IdylliumArrayDefaultFactory,
    dynamic: boolean,
  ): Promise<IdylliumArray> {
    assertCreatableArraySize(size);
    const normalizedSize = Math.max(0, Math.trunc(Number(size)));
    const items: unknown[] = [];
    for (let index = 0; index < normalizedSize; index += 1) {
      items.push(await defaultFactory());
    }
    return new IdylliumArray(items, dynamic, dynamic ? null : normalizedSize, defaultFactory);
  }

  static from(
    values: unknown[],
    dynamic: boolean,
    staticSize: number | null,
    defaultFactory: IdylliumArrayDefaultFactory,
  ): IdylliumArray {
    return new IdylliumArray([...values], dynamic, dynamic ? null : staticSize, defaultFactory);
  }

  /**
   * Перемешанная копия того же вида (dyn остаётся dyn, фиксированный — той
   * же длины). Источник случайности передаёт вызывающий — случайные числа
   * живут в модуле random и подчиняются его сиду (random.shuffle, 2026-08-29).
   */
  shuffledCopy(pickIndex: (bound: number) => number): IdylliumArray {
    const items = [...this.items];
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapWith = pickIndex(index + 1);
      const held = items[index];
      items[index] = items[swapWith];
      items[swapWith] = held;
    }
    return new IdylliumArray(items, this.dynamic, this.dynamic ? null : this.staticSize, this.defaultFactory);
  }

  static convert(
    value: unknown,
    dynamic: boolean,
    staticSize: number | null,
    defaultFactory: IdylliumArrayDefaultFactory,
    convertElement: (value: unknown) => unknown,
    targetType: string,
    file: string,
    line: number,
  ): IdylliumArray {
    if (!(value instanceof IdylliumArray)) {
      throw new IdylliumRuntimeError(file, line, `cannot convert '${valueOps.typeName(value)}' to '${targetType}'`);
    }

    const actualSize = value.items.length;
    if (!dynamic && staticSize !== null && actualSize !== staticSize) {
      // Без внутреннего слова dyn_array: ученик писал литерал или массив,
      // а не «динамический массив» из механики конвертера (E13).
      throw new IdylliumRuntimeError(
        file,
        line,
        `the value has ${actualSize} element${actualSize === 1 ? '' : 's'}, but '${targetType}' needs ${staticSize}`,
      );
    }

    return new IdylliumArray(
      value.items.map(convertElement),
      dynamic,
      dynamic ? null : staticSize,
      defaultFactory,
    );
  }

  get(index: unknown, file: string, line: number): unknown {
    return this.items[this.validIndex(index, file, line)];
  }

  set(index: unknown, value: unknown, file: string, line: number): void {
    this.items[this.validIndex(index, file, line)] = value;
  }

  get length(): number {
    return this.items.length;
  }

  contains(value: unknown): boolean {
    return this.items.some((item) => valueOps.equals(item, value));
  }

  find(value: unknown): number {
    return this.items.findIndex((item) => valueOps.equals(item, value));
  }

  count(value: unknown): number {
    return this.items.filter((item) => valueOps.equals(item, value)).length;
  }

  reverse(): void {
    this.items.reverse();
  }

  sort(): void {
    if (this.items.every((item) => typeof item === 'number' || typeof item === 'bigint')) {
      this.items.sort((left, right) => valueOps.compare(left as number | bigint, right as number | bigint));
      return;
    }
    this.items.sort((left, right) => valueOps.inspect(left).localeCompare(valueOps.inspect(right)));
  }

  add(value: unknown, file: string, line: number): void {
    this.expectDynamic('add', file, line);
    this.items.push(value);
  }

  remove_at(index: unknown, file: string, line: number): void {
    this.expectDynamic('remove_at', file, line);
    this.items.splice(this.validIndex(index, file, line), 1);
  }

  async resize(size: unknown, file: string, line: number): Promise<void> {
    this.expectDynamic('resize', file, line);
    const normalizedSize = this.validSize(size, file, line);
    while (this.items.length < normalizedSize) {
      this.items.push(await this.defaultFactory());
    }
    this.items.length = normalizedSize;
  }

  insert(index: unknown, value: unknown, file: string, line: number): void {
    this.expectDynamic('insert', file, line);
    const normalizedIndex = this.validInsertIndex(index, file, line);
    this.items.splice(normalizedIndex, 0, value);
  }

  join(other: unknown, file: string, line: number): void {
    this.expectDynamic('join', file, line);
    if (!(other instanceof IdylliumArray)) {
      throw new IdylliumRuntimeError(file, line, `join() expects an array, got '${String(other)}'`);
    }
    this.items.push(...other.items);
  }

  clear(file: string, line: number): void {
    this.expectDynamic('clear', file, line);
    this.items.length = 0;
  }

  pop(file: string, line: number): unknown {
    this.expectDynamic('pop', file, line);
    if (this.items.length === 0) {
      throw new IdylliumRuntimeError(file, line, 'cannot pop from empty array');
    }
    return this.items.pop();
  }

  callMethod(name: string, args: readonly unknown[], file: string, line: number): unknown {
    switch (name) {
      case 'contains':
        return this.contains(args[0]);
      case 'find':
        return this.find(args[0]);
      case 'count':
        return this.count(args[0]);
      case 'reverse':
        return this.reverse();
      case 'sort':
        return this.sort();
      case 'add':
        return this.add(args[0], file, line);
      case 'remove_at':
        return this.remove_at(args[0], file, line);
      case 'resize':
        return this.resize(args[0], file, line);
      case 'insert':
        return this.insert(args[0], args[1], file, line);
      case 'join':
        return this.join(args[0], file, line);
      case 'clear':
        return this.clear(file, line);
      case 'pop':
        return this.pop(file, line);
      default:
        throw new IdylliumRuntimeError(file, line, `array has no method '${name}'`);
    }
  }

  values(): readonly unknown[] {
    return this.items;
  }

  toString(): string {
    return valueOps.inspect(this);
  }

  toInspectString(): string {
    return `[${this.items.map((item) => valueOps.inspect(item)).join(', ')}]`;
  }

  private validIndex(value: unknown, file: string, line: number): number {
    const index = integerNumber(value, 'array index', file, line);
    if (index < 0 || index >= this.items.length) {
      throw new IdylliumRuntimeError(file, line, `array index ${index} out of bounds (size ${this.items.length}, valid indices ${this.validIndexRange()})`);
    }
    return index;
  }

  private validInsertIndex(value: unknown, file: string, line: number): number {
    const index = integerNumber(value, 'array insert index', file, line);
    if (index < 0 || index > this.items.length) {
      throw new IdylliumRuntimeError(file, line, `array insert index ${index} out of bounds (size ${this.items.length}, valid indices 0-${this.items.length})`);
    }
    return index;
  }

  private validSize(value: unknown, file: string, line: number): number {
    const size = integerNumber(value, 'array size', file, line);
    if (size < 0) {
      throw new IdylliumRuntimeError(file, line, `array size must be non-negative, got ${size}`);
    }
    return size;
  }

  private validIndexRange(): string {
    if (this.items.length === 0) return 'none';
    return `0-${this.items.length - 1}`;
  }

  private expectDynamic(methodName: string, file: string, line: number): void {
    if (!this.dynamic) {
      throw new IdylliumRuntimeError(file, line, `array method '${methodName}' is only available on dyn_array`);
    }
  }
}

// Массив таких размеров не создать ни в одной машине класса — честный отказ
// вместо сырого JS «Invalid array length» (находка ломателей 2026-08-22).
export const MAX_CREATABLE_ARRAY_SIZE = 100_000_000;

export function assertCreatableArraySize(size: number | bigint): void {
  const asNumber = typeof size === 'bigint' ? Number(size) : size;
  if (!Number.isFinite(asNumber) || asNumber > MAX_CREATABLE_ARRAY_SIZE) {
    throw new IdylliumRuntimeError('program', 0, `array size ${String(size)} is too large to create (maximum ${MAX_CREATABLE_ARRAY_SIZE})`);
  }
}

export function channel(value: unknown, argumentName: string, file: string, line: number): number {
  const number = integerNumber(value, argumentName, file, line);
  if (number < 0 || number > 255) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be between 0 and 255, got ${number}`);
  }
  return number;
}

export function opacity(value: unknown, argumentName: string, file: string, line: number): number {
  return rangeNumber(value, argumentName, 0, 1, file, line);
}

export function percent(value: number, argumentName: string, file: string, line: number): number {
  return percentRange(value, argumentName, 0, 100, file, line) / 100;
}

export function percentRange(value: number, argumentName: string, min: number, max: number, file: string, line: number): number {
  return rangeNumber(value, argumentName, min, max, file, line);
}

export function hex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

export function trimFloat(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export function expectArray(value: unknown, file: string, line: number): IdylliumArray {
  if (value instanceof IdylliumArray) return value;
  throw new IdylliumRuntimeError(file, line, `expected array, got '${String(value)}'`);
}

export function colorToCss(value: unknown, argumentName: string, file: string, line: number): string {
  if (value instanceof IdylliumColor) return value.toCss();
  throw new IdylliumRuntimeError(file, line, `${argumentName} must be colors.Color`);
}

export function colorBlack(): IdylliumColor {
  return IdylliumColor.RGB(0, 0, 0);
}

export function colorWhite(): IdylliumColor {
  return IdylliumColor.RGB(255, 255, 255);
}

export function colorBlue(): IdylliumColor {
  return IdylliumColor.RGB(0, 0, 255);
}

export function colorGray(): IdylliumColor {
  return IdylliumColor.RGB(180, 180, 180);
}

export function colorLightGray(): IdylliumColor {
  return IdylliumColor.RGB(239, 239, 239);
}

export function colorVeryLightGray(): IdylliumColor {
  return IdylliumColor.RGB(245, 245, 245);
}

export function colorTransparent(): IdylliumColor {
  return IdylliumColor.RGBA(0, 0, 0, 0);
}
