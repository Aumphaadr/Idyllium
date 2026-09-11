// ─── Состояние рантайма, свойства объектов, хост-интерфейсы, типы снимков ──
// Хребет декомпозиции (этап Б, 2026-08-29): интерфейс состояния и фундамент
// свойств вынесены из runtime.ts; содержимое — как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, RuntimePropertySetter, defineRuntimeGetter, isPlainObject } from './runtime-shared';
import { RuntimeSqliteService } from './sqlite-service';
import { RuntimeFontMetricsService } from './font-metrics-service';
import { RuntimeImageService } from './image-service';
import { RuntimeChannelService } from './channel-service';
import { RuntimeNetworkService } from './network-service';

export interface ConsoleIO {
  write(text: string): void;
  readLine(): Promise<string>;
  clear(): void;
}

export interface RuntimeAbortSignal {
  readonly aborted: boolean;
  addEventListener?(type: 'abort', listener: () => void, options?: { readonly once?: boolean }): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
}

export interface RuntimeUrlOpener {
  open(address: string): void | Promise<void>;
}

export interface RuntimeFileSystem {
  resolvePath(requestedPath: string, sourceFile: string): string;
  /** Заменяет абсолютный корень проекта в тексте на относительную форму — для сообщений об ошибках. */
  humanizePaths?(text: string): string;
  exists(filePath: string): boolean;
  isFile(filePath: string): boolean;
  isDirectory(filePath: string): boolean;
  readText(filePath: string): string;
  writeText(filePath: string, text: string): void;
  appendText(filePath: string, text: string): void;
  createDirectory?(filePath: string, parents: boolean): void;
  listDirectory?(filePath: string): readonly string[];
  copy?(sourcePath: string, destinationPath: string): void;
  rename?(sourcePath: string, destinationPath: string): void;
  remove?(filePath: string, recursive: boolean): void;
  readBytes?(filePath: string): Uint8Array;
  writeBytes?(filePath: string, bytes: Uint8Array, resourceUri?: string): void;
  /** Дозапись байтов в конец (потоки записи в однобайтовых кодировках). */
  appendBytes?(filePath: string, bytes: Uint8Array): void;
  resourceUri?(filePath: string): string | null;
  snapshot?(): Record<string, MemoryRuntimeFile>;
  writtenFilesSnapshot?(): Record<string, MemoryRuntimeFile>;
}

export interface MemoryRuntimeFile {
  readonly content?: string;
  readonly bytes?: Uint8Array;
  readonly kind?: 'file' | 'directory' | 'deleted';
  readonly resourceUri?: string;
}

export interface IdylliumDrawableSnapshot {
  readonly type: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface IdylliumCanvasCommand {
  readonly kind: 'clear' | 'fill' | 'draw';
  readonly color?: string;
  readonly object?: IdylliumDrawableSnapshot;
}

export interface IdylliumCanvasSnapshot {
  readonly id: number;
  readonly type: 'gui.Canvas';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly commands: readonly IdylliumCanvasCommand[];
}

export interface IdylliumAudioCommand {
  readonly id: number;
  readonly action: 'play' | 'pause' | 'resume' | 'stop' | 'seek';
}

export interface IdylliumAudioSnapshot {
  readonly id: number;
  readonly type: 'audio.Sound' | 'audio.Music';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly commands: readonly IdylliumAudioCommand[];
}

export interface IdylliumGuiWidgetSnapshot {
  readonly id: number;
  readonly type: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly children: readonly IdylliumGuiWidgetSnapshot[];
  readonly canvas?: IdylliumCanvasSnapshot;
  readonly items?: readonly string[];
  /** gui.Table: заголовки и строки. */
  readonly columns?: readonly string[];
  readonly rows?: ReadonlyArray<readonly string[]>;
  /** gui.BarChart / gui.PieChart: пары «подпись — значение». */
  readonly entries?: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  /** gui.LineChart: точки по порядку. */
  readonly points?: readonly number[];
}

export interface IdylliumWindowSnapshot extends IdylliumGuiWidgetSnapshot {
  readonly type: 'gui.Window';
}

export interface IdylliumModalSnapshot {
  readonly id: number;
  readonly type: 'gui.Modal';
  readonly mode: 'alert' | 'confirm' | 'input';
  readonly properties: Readonly<Record<string, unknown>>;
}

export type TurtleEntry =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { kind: 'dot'; x: number; y: number; size: number; color: string }
  | { kind: 'poly'; points: number[]; color: string }
  | { kind: 'text'; x: number; y: number; text: string; color: string };

export interface TurtleFieldState {
  window: RuntimeObject | null;
  canvas: RuntimeObject | null;
  turtles: RuntimeObject[];
  entries: TurtleEntry[];
  width: number;
  height: number;
  bgColor: string;
}

export interface RuntimeObjectState {
  readonly objects: RuntimeObject[];
  readonly audio: RuntimeObject[];
  readonly canvases: RuntimeObject[];
  readonly fileSystem: RuntimeFileSystem;
  readonly fontMetricsService: RuntimeFontMetricsService;
  readonly imageService?: RuntimeImageService;
  readonly sqliteService?: RuntimeSqliteService;
  readonly modals: RuntimeObject[];
  readonly timers: RuntimeObject[];
  readonly windows: RuntimeObject[];
  /** Почтовые отделения channel.Post; открытое отделение держит программу живой. */
  readonly channelPosts: RuntimeObject[];
  readonly channelService?: RuntimeChannelService;
  /** Сетевой сервис — общий для http-клиента и web.Server. */
  readonly networkService?: RuntimeNetworkService;
  readonly abortSignal?: RuntimeAbortSignal;
  /** Печать в консоль программы (банер web.Server, аварии обработчиков). */
  consoleWrite?: (text: string) => void;
  /** Входящие письма; доставляются обработчикам в stepGui — как GUI-события. */
  readonly channelMailbox: { readonly post: RuntimeObject; readonly text: string }[];
  nextAudioCommandId: number;
  nextObjectId: number;
  /** Предупреждения выключены программой (system.set_warnings(false)). */
  warningsDisabled: boolean;
  /** Сколько окон создано за жизнь программы (close их не вычитает). */
  windowsCreated: number;
  /** Хоть одно окно было показано — даже если потом закрыто. */
  anyWindowEverShown: boolean;
  /** Открытые потоки записи — для предупреждения о незакрытом файле. */
  readonly openOutputStreams: Map<RuntimeObject, string>;
  /** Черепашье поле; создаётся лениво первой черепахой или командой turtle.*. */
  turtleField: TurtleFieldState | null;
  /** 'cli' | 'web' | 'vscode' — в CLI черепаха работает без окна и без анимации. */
  readonly turtlePlatform: string;
  /** Проверка «программу остановили» — для длинных анимационных циклов. */
  stopCheck?: (file: string, line: number) => void;
}

export function createRuntimeErrorValue(error: IdylliumRuntimeError): RuntimeObject {
  const file = publicRuntimeErrorFile(error.file);
  const result: RuntimeObject = {
    __idylliumType: 'RuntimeError',
    to_string: () => `${file}:${error.line}: runtime error: ${error.detail}`,
  };
  defineRuntimeGetter(result, 'message', () => error.detail);
  defineRuntimeGetter(result, 'file', () => file);
  defineRuntimeGetter(result, 'line', () => error.line);
  return result;
}

export function publicRuntimeErrorFile(file: string): string {
  const normalized = file.replace(/\\/gu, '/');
  if (normalized.startsWith('/workspace/')) return normalized.slice('/workspace/'.length);
  if (normalized.startsWith('workspace/')) return normalized.slice('workspace/'.length);
  return normalized;
}

export function defineTrackedRuntimeProperty(obj: RuntimeObject, name: string, defaultValue: unknown): void {
  const values = trackedRuntimePropertyValues(obj);
  values[name] = defaultValue;
  Object.defineProperty(obj, name, {
    enumerable: true,
    configurable: true,
    get() {
      return values[name];
    },
    set(value: unknown) {
      values[name] = value;
      explicitRuntimeProperties(obj).add(name);
    },
  });
}

export function setTrackedRuntimePropertyDefault(obj: RuntimeObject, name: string, value: unknown): void {
  const values = obj.__trackedPropertyValues;
  if (isPlainObject(values) && Object.prototype.hasOwnProperty.call(values, name)) {
    values[name] = value;
    return;
  }
  defineTrackedRuntimeProperty(obj, name, value);
}

export function trackedRuntimePropertyValues(obj: RuntimeObject): Record<string, unknown> {
  if (isPlainObject(obj.__trackedPropertyValues)) return obj.__trackedPropertyValues as Record<string, unknown>;
  // Без прототипа — по той же причине, что и таблица сеттеров.
  const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(obj, '__trackedPropertyValues', {
    value: values,
    enumerable: false,
    configurable: true,
  });
  return values;
}

export function explicitRuntimeProperties(obj: RuntimeObject): Set<string> {
  if (obj.__explicitProperties instanceof Set) return obj.__explicitProperties as Set<string>;
  const properties = new Set<string>();
  Object.defineProperty(obj, '__explicitProperties', {
    value: properties,
    enumerable: false,
    configurable: true,
  });
  return properties;
}

export function runtimePropertySetters(obj: RuntimeObject): Record<string, RuntimePropertySetter> {
  if (isPlainObject(obj.__runtimePropertySetters)) return obj.__runtimePropertySetters as Record<string, RuntimePropertySetter>;
  // Таблица БЕЗ прототипа: иначе setters['toString'] отдавал функцию из
  // Object.prototype, и запись в поле с таким именем молча пропадала.
  const setters: Record<string, RuntimePropertySetter> = Object.create(null) as Record<string, RuntimePropertySetter>;
  Object.defineProperty(obj, '__runtimePropertySetters', {
    value: setters,
    enumerable: false,
    configurable: true,
  });
  return setters;
}

export function defineValidatedRuntimeProperty(
  obj: RuntimeObject,
  name: string,
  defaultValue: unknown,
  validator: (value: unknown, file: string, line: number) => unknown,
  afterSet?: (value: unknown, file: string, line: number) => void,
): void {
  const values = trackedRuntimePropertyValues(obj);
  values[name] = defaultValue;
  runtimePropertySetters(obj)[name] = (value: unknown, file: string, line: number) => {
    const validated = validator(value, file, line);
    values[name] = validated;
    explicitRuntimeProperties(obj).add(name);
    afterSet?.(validated, file, line);
  };
  Object.defineProperty(obj, name, {
    enumerable: true,
    configurable: true,
    get() {
      return values[name];
    },
    set(value: unknown) {
      const validated = validator(value, 'runtime', 0);
      values[name] = validated;
      explicitRuntimeProperties(obj).add(name);
      afterSet?.(validated, 'runtime', 0);
    },
  });
}

// Строгое строковое перечисление виджета: опечатка в режиме — громкая ошибка,
// а не молчаливый откат к умолчанию (жанр LineEdit.echo_mode; зачистка
// по заказу владельца 2026-08-22). IdySS-наклейки style сюда не относятся.

export function defineEnumRuntimeProperty(
  obj: RuntimeObject,
  name: string,
  ownerLabel: string,
  defaultValue: string,
  accepted: readonly string[],
  afterSet?: (value: unknown, file: string, line: number) => void,
): void {
  defineValidatedRuntimeProperty(obj, name, defaultValue, (value, file, line) => {
    if (typeof value !== 'string' || !accepted.includes(value)) {
      const shown = accepted.map((item) => `'${item}'`);
      const list = `${shown.slice(0, -1).join(', ')} or ${shown[shown.length - 1]}`;
      throw new IdylliumRuntimeError(file, line, `${ownerLabel}.${name} must be ${list}, got '${String(value)}'`);
    }
    return value;
  }, afterSet);
}

export function canvasCommands(canvas: RuntimeObject): IdylliumCanvasCommand[] {
  const commands = canvas.__commands;
  if (Array.isArray(commands)) return commands as IdylliumCanvasCommand[];
  canvas.__commands = [];
  return canvas.__commands as IdylliumCanvasCommand[];
}

/**
 * Фабрика библиотечных объектов живёт в ядре (createPlainRuntimeObject — она
 * знает про все семейства). Модули получают её инъекцией при загрузке ядра —
 * тот же шов, что ValueOperations в runtime-values: разрыв цикла модулей.
 */
export interface RuntimeObjectFactory {
  create(moduleName: string, typeName: string, state: RuntimeObjectState): RuntimeObject;
}

export const objectFactory: RuntimeObjectFactory = {
  create() {
    throw new Error('runtime core is not loaded: object factory is not registered');
  },
};

export function registerObjectFactory(factory: RuntimeObjectFactory): void {
  objectFactory.create = factory.create;
}
