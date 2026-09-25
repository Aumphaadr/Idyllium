const nodeFs: any = require('fs');
const nodePath: any = require('path');
const nodeBuffer: any = require('buffer').Buffer;

// ─── Декомпозиция (2026-08-29): фундамент вынесен в соседние модули; этот
// файл остаётся фасадом — внешние импортеры ничего не заметили. ───
import { IdylliumRuntimeError } from './runtime-errors';
import {
  ContextualRuntimeFunction,
  RuntimeObject,
  RuntimePropertySetter,
  booleanArgument,
  contextFunction,
  defineRuntimeGetter,
  errorMessage,
  expectOpen,
  finiteNumber,
  intArgument,
  integerNumber,
  isPlainObject,
  optionalNumberContext,
  precisionDigits,
  rangeNumber,
  runtimeInteger,
  splitContextArgs,
  stringArgument,
  byteRange,
  exactIntegerResult,
  validRange,
  runtimeDirname,
  memoryDirname,
  normalizeMemoryPath,
  isRuntimeObject,
} from './runtime-shared';

export { IdylliumRuntimeError };
export { IdylliumColor, IdylliumTimeStamp, IdylliumArray, IdylliumMap, IdylliumSet } from './runtime-values';
export { IdylliumComplex } from './runtime-complex';
import { IdylliumComplex } from './runtime-complex';
import {
  IdylliumColor,
  IdylliumTimeStamp,
  IdylliumArray,
  IdylliumArrayDefaultFactory,
  MAX_CREATABLE_ARRAY_SIZE,
  assertCreatableArraySize,
  channel,
  hex,
  normalizeTimeZone,
  opacity,
  percent,
  percentRange,
  timeStampComponents,
  trimFloat,
  registerValueOperations,
  expectArray,
  expectMap,
  IdylliumMap,
  expectSet,
  IdylliumSet,
} from './runtime-values';
import { createXmlNode, parseXmlDocument } from './runtime-xml';
import { createCsvTable, csvParseSeparator, isCsvRuntimeTable, parseCsvTable, serializeCsvTable } from './runtime-csv';
import { ExactJsonParser, JsonRuntimeValue, createJsonArray, createJsonObject, createJsonValue, expectJsonValue, isJsonRuntimeValue, jsonEntries, jsonIntegerAsBigInt, jsonIntegerValue, jsonItems, jsonSerialize, parseJsonValue } from './runtime-json';
import { SqliteRuntimeDatabaseState, SqliteRuntimeValueObject, createBlankSqliteResult, createClosedSqliteDatabase, createClosedSqliteStatement, createSqliteResult, createSqliteValue, executeSqliteDatabase, isSqliteRuntimeValue, openSqliteDatabase, persistSqliteDatabase, sqliteDatabaseState, sqliteValueToString } from './runtime-sqlite';
import { EncodingFailure, EncodingSpec, base64ToBytes, bytesToBase64, decodeFileBytes, encodeText, encodingCharToCodepoint, encodingCodepointToChar, encodingConvert, encodingDecode, encodingEncode, encodingGuess, encodingIsValid, guessFileEncoding, listEncodingNames, normalizeEncoding } from './runtime-encoding';
import { RUNTIME_TYPES, RuntimeTypesName, bytesToBinary, bytesToHex, castTypesValue, floatBytes, floatFromBytes, normalizeRuntimeTypesName, normalizeTypesName, typesBitwise, typesFromBin, typesFromHex, typesShift, typesToBin, typesToHex, wrapBigInteger, wrapInteger } from './runtime-types';
import {
  ConsoleIO,
  IdylliumAudioCommand,
  IdylliumAudioSnapshot,
  IdylliumCanvasCommand,
  IdylliumCanvasSnapshot,
  CanvasSnapshotOptions,
  IdylliumDrawableSnapshot,
  IdylliumGuiWidgetSnapshot,
  IdylliumModalSnapshot,
  IdylliumWindowSnapshot,
  MemoryRuntimeFile,
  RuntimeAbortSignal,
  RuntimeFileSystem,
  RuntimeObjectState,
  RuntimeUrlOpener,
  TurtleEntry,
  TurtleFieldState,
  createRuntimeErrorValue,
  defineEnumRuntimeProperty,
  defineTrackedRuntimeProperty,
  defineValidatedRuntimeProperty,
  explicitRuntimeProperties,
  publicRuntimeErrorFile,
  runtimePropertySetters,
  setTrackedRuntimePropertyDefault,
  trackedRuntimePropertyValues,
  canvasCommands,
  registerObjectFactory,
} from './runtime-state';
export {
  ConsoleIO,
  IdylliumAudioCommand,
  IdylliumAudioSnapshot,
  IdylliumCanvasCommand,
  IdylliumCanvasSnapshot,
  IdylliumDrawableSnapshot,
  IdylliumGuiWidgetSnapshot,
  IdylliumModalSnapshot,
  IdylliumWindowSnapshot,
  MemoryRuntimeFile,
  RuntimeAbortSignal,
  RuntimeFileSystem,
  RuntimeUrlOpener,
} from './runtime-state';
import { createMemoryRuntimeFileSystem, createNodeRuntimeFileSystem, memoryBasename, resolveRuntimePath, runtimeStat, runtimeIsDirectory, runtimeIsFile } from './runtime-fs';
export { createMemoryRuntimeFileSystem } from './runtime-fs';
import { colorBlack, colorBlue, colorGray, colorLightGray, colorToCss, colorTransparent, colorVeryLightGray, colorWhite } from './runtime-values';
import { initializeWebObject, renderWebTemplate, webTextResponse } from './runtime-web';
import { closeChannelPost, initializeChannelPost } from './runtime-channel';
import { audioCommands, audioDuration, initializeAudioObject, looksLikeAudio } from './runtime-audio';
import { initializeMelodyObject } from './runtime-melody';
import { createQrModule } from './runtime-qr';
import { StoredBitmap, initializeImageObject, imageResourceUri, imageService, readRuntimeBytes, runtimeImageResource, storedAnimation, storedBitmap, storedStaticImage, svgPassport, imageRuntimeError, resolveImageInputPath , setImageMetadata, ensureImageSize, writeRuntimeImageBytes, StoredStaticImage, createGeneratedStaticImage } from './runtime-image';
import { COLOR_CONSTANTS } from './color-constants';
import { RuntimeFontFormat, attachDrawableGeometry, createDefaultDrawableFont, detectFontFormat, drawableCollisionShape, drawableTextMetrics, drawableTransform, fontMimeType, initializeDrawableObject, initializeFontObject, isDrawableObject, runtimeFontBytes } from './runtime-drawable';
import { applyGuiEventPayload, canvasKeepsProgramAlive, closeModal, defaultGuiWidgetSize, eventFloat, eventNumber, guiCallbackName, guiEventObject, guiObjectUsesFontSize, initializeGuiChild, initializeGuiObject, isGuiWidget, refuseWidgetCycle, selectRadioButton, showModal, widgetEventsBlocked } from './runtime-gui';
import { audioSnapshot, canvasCaptureRegion, canvasSnapshot, canvasToSvg, withKnownCanvases, drawableSnapshot, modalSnapshot, objectPropertiesSnapshot, runtimeObjectId, snapshotValue, widgetSnapshot, windowSnapshot } from './runtime-snapshots';
import { createTurtleModule, ensureTurtleField, initializeTurtleObject, rebuildTurtleFieldCommands, turtleAnimationSteps, turtleSvg , TURTLE_FRAME_MS, normalizeTurtleHeading, turtleCss, turtleFrame, turtleTravel, turtleTurn } from './runtime-turtle';


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
import {
  RuntimeHttpServerRequest,
  RuntimeHttpServerResponse,
  RuntimeNetworkError,
  RuntimeNetworkRequest,
  RuntimeNetworkService,
  createFetchNetworkService,
} from './network-service';
import { RuntimeChannelConnection, RuntimeChannelService } from './channel-service';
import {
  RuntimeSqliteBindable,
  RuntimeSqliteDatabase,
  RuntimeSqliteExecution,
  RuntimeSqliteService,
  RuntimeSqliteTypedBinding,
  RuntimeSqliteValue,
} from './sqlite-service';
import {
  DrawableCollisionShape,
  DrawableTransform,
  capsuleCollisionShape,
  circleCollisionShape,
  collisionShapeContains,
  collisionShapesIntersect,
  rectangleCollisionShape,
} from './drawable-geometry';
import {
  RuntimeFontMetricsService,
  RuntimeTextMetrics,
  createRuntimeFontMetricsService,
} from './font-metrics-service';
import { parseIdylliumStyle } from './style';
import { hashAdler32, hashCrc32, hashFnv1a, hashSha256Bytes, hashSha256Hex } from './hash';

export const IDYLLIUM_VERSION = '1.6.3';

/** Где выполняется программа, если хост не сказал явно. */
function defaultRuntimePlatform(): string {
  const nodeProcess = typeof process === 'object' ? process as { versions?: { node?: string } } : null;
  return nodeProcess?.versions?.node ? 'cli' : 'web';
}

/** Предел глубины вызовов по умолчанию; меняется system.set_recursion_depth(). */
export const DEFAULT_RECURSION_DEPTH = 20000;
export const MIN_RECURSION_DEPTH = 10;
// Верхняя граница — по памяти, а не по стеку: кадр Idyllium стоит около
// килобайта, так что 200000 кадров это ~190 МБ. Больше вкладка браузера
// уже не переживёт, и честнее отказать заранее.
export const MAX_RECURSION_DEPTH = 200000;

export function clampRecursionDepth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RECURSION_DEPTH;
  return Math.min(MAX_RECURSION_DEPTH, Math.max(MIN_RECURSION_DEPTH, Math.trunc(value)));
}











export interface RuntimeOptions {
  readonly console?: Partial<ConsoleIO>;
  readonly input?: readonly string[];
  readonly fileSystem?: RuntimeFileSystem;
  readonly projectRoot?: string;
  readonly fontMetricsService?: RuntimeFontMetricsService;
  readonly imageService?: RuntimeImageService;
  readonly sqliteService?: RuntimeSqliteService;
  /** Открывалка ссылок: WebIDE и VS Code внедряют свою, CLI берёт системную. */
  readonly urlOpener?: RuntimeUrlOpener;
  /** Сетевой сервис (библиотека http). Node и браузер получают fetch-реализацию по умолчанию; тесты подставляют createMemoryNetworkService. */
  readonly networkService?: RuntimeNetworkService;
  /** Почтовый канал (библиотека channel). Web IDE — BroadcastChannel, VS Code — шина extension host, тесты — createMemoryChannelBus. Без сервиса open() честно отказывает (CLI). */
  readonly channelService?: RuntimeChannelService;
  readonly abortSignal?: RuntimeAbortSignal;
  /** Стартовый предел глубины вызовов; программа может поменять его через system. */
  readonly maxRecursionDepth?: number;
  /** Где выполняется программа: 'cli' | 'web' | 'vscode'. Видно из system.platform(). */
  readonly platform?: string;
}















export interface IdylliumRuntime {
  readonly console: {
    write(...values: unknown[]): Promise<void>;
    writeln(...values: unknown[]): Promise<void>;
    clear(): Promise<void>;
    get_int(file?: string, line?: number): Promise<number | bigint>;
    get_float(file?: string, line?: number): Promise<number>;
    get_string(): Promise<string>;
    set_precision(file: string, line: number, digits: number): Promise<void>;
  };
  readonly core: {
    tick(file: string, line: number): Promise<void> | null;
    binary(operator: string, left: unknown, right: unknown, file: string, line: number, mode?: 'float'): unknown;
    toFloat(value: unknown, file: string, line: number): number;
    typeName(value: unknown): string;
    expectPresent(value: unknown, fieldName: string, className: string, file: string, line: number): unknown;
    equalsObjects(left: unknown, right: unknown, slot: string, file: string, line: number): Promise<boolean>;
    orderObjects(left: unknown, right: unknown, slot: string, contract: string, file: string, line: number): Promise<boolean>;
    arithmeticObjects(left: unknown, right: unknown, slot: string, contract: string, sign: string, file: string, line: number): Promise<unknown>;
    oppositeObject(operand: unknown, slot: string, file: string, line: number): Promise<unknown>;
    equalsObjectArrays(left: unknown, right: unknown, slot: string, file: string, line: number): Promise<boolean>;
    equalsObjectMaps(left: unknown, right: unknown, slot: string, file: string, line: number): Promise<boolean>;
    negate(value: unknown): number | bigint;
    divide(left: unknown, right: unknown, file: string, line: number): number;
    div(left: unknown, right: unknown, file: string, line: number): number | bigint;
    mod(left: unknown, right: unknown, file: string, line: number): number | bigint;
    to_int(value: unknown, file: string, line: number): number | bigint;
    to_float(value: unknown, file: string, line: number): number;
    to_string(value: unknown): Promise<string>;
    enterCall(name: string, file: string, line: number): Promise<void> | null;
    leaveCall(): void;
    setExitValue(value: unknown): void;
  };
  readonly array: {
    create(size: number, defaultFactory: () => unknown, dynamic: boolean): IdylliumArray;
    createAsync(size: number, defaultFactory: IdylliumArrayDefaultFactory, dynamic: boolean): Promise<IdylliumArray>;
    from(values: unknown[], dynamic: boolean, staticSize: number | null, defaultFactory: IdylliumArrayDefaultFactory): IdylliumArray;
    convert(
      value: unknown,
      dynamic: boolean,
      staticSize: number | null,
      defaultFactory: IdylliumArrayDefaultFactory,
      convertElement: (value: unknown) => unknown,
      targetType: string,
      file: string,
      line: number,
    ): IdylliumArray;
    get(array: unknown, index: unknown, file: string, line: number): unknown;
    set(array: unknown, index: unknown, value: unknown, file: string, line: number): void;
    max(array: unknown, file: string, line: number): number | bigint;
    min(array: unknown, file: string, line: number): number | bigint;
    sum(array: unknown, file: string, line: number): number | bigint | IdylliumComplex;
    avg(array: unknown, file: string, line: number): number | IdylliumComplex;
    searchWith(array: unknown, value: unknown, slot: string, mode: string, file: string, line: number): Promise<boolean | number>;
    sortObjects(array: unknown, slot: string, file: string, line: number): Promise<void>;
    sumObjects(array: unknown, slot: string, file: string, line: number): Promise<unknown>;
  };
  readonly set: {
    create(): IdylliumSet;
    fromValues(values: readonly unknown[]): IdylliumSet;
    convert(value: unknown, targetType: string, file: string, line: number): IdylliumSet;
  };
  readonly map: {
    create(): IdylliumMap;
    fromPairs(pairs: readonly (readonly [unknown, unknown])[]): IdylliumMap;
    convert(value: unknown, convertValue: (value: unknown) => unknown, targetType: string, file: string, line: number): IdylliumMap;
    get(map: unknown, key: unknown, file: string, line: number): unknown;
    set(map: unknown, key: unknown, value: unknown, file: string, line: number): void;
  };
  readonly types: {
    cast(value: unknown, typeName: string, file?: string, line?: number): number | bigint;
    to_bin(value: unknown, typeName: string, file?: string, line?: number): string;
    to_hex(value: unknown, typeName: string, file?: string, line?: number): string;
    shift_left(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint;
    shift_right(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint;
    bit_and(value: unknown, typeName: string, mask: unknown, file: string, line: number): number | bigint;
    bit_or(value: unknown, typeName: string, mask: unknown, file: string, line: number): number | bigint;
    bit_xor(value: unknown, typeName: string, mask: unknown, file: string, line: number): number | bigint;
    bit_not(value: unknown, typeName: string, file: string, line: number): number | bigint;
  };
  readonly errors: {
    catchValue(error: unknown): Record<string, unknown>;
  };
  readonly modules: {
    readonly system: Record<string, unknown>;
    readonly math: Record<string, unknown>;
    readonly random: Record<string, unknown>;
    readonly time: Record<string, unknown>;
    readonly file: Record<string, unknown>;
    readonly types: Record<string, unknown>;
    readonly encoding: Record<string, unknown>;
    readonly hash: Record<string, unknown>;
    readonly qr: Record<string, unknown>;
    readonly url: Record<string, unknown>;
    readonly channel: Record<string, unknown>;
    readonly web: Record<string, unknown>;
  readonly http: Record<string, unknown>;
    readonly json: Record<string, unknown>;
    readonly xml: Record<string, unknown>;
    readonly csv: Record<string, unknown>;
    readonly sqlite: Record<string, unknown>;
    readonly audio: Record<string, unknown>;
    readonly image: Record<string, unknown>;
    readonly gui: Record<string, unknown>;
    readonly turtle: Record<string, unknown>;
    readonly colors: Record<string, unknown>;
  };
  createObject(moduleName: string, typeName: string): Record<string, unknown>;
  tagClassInstance(self: Record<string, unknown>, tag: string): Record<string, unknown>;
  convertNullable(moduleName: string, typeName: string, value: unknown, file: string, line: number): unknown;
  setProperty(target: unknown, propertyName: string, value: unknown, file: string, line: number): unknown;
  callModuleFunction(moduleName: string, functionName: string, args: readonly unknown[], file: string, line: number): unknown;
  callMethod(target: unknown, methodName: string, args: readonly unknown[], file: string, line: number): unknown;
  getOutput(): string;
  getExitText(): Promise<string | null>;
  getExitCode(): number | null;
  /** Предупреждения конца программы: окно не показано, виджет не добавлен,
   *  файл не закрыт. Пустой список, если всё в порядке или предупреждения
   *  выключены программой (system.set_warnings(false)). */
  collectProgramEndWarnings(): readonly string[];
  getAudio(): readonly IdylliumAudioSnapshot[];
  /** Без параметров — полные списки команд; с `knownCanvases` — хвосты для хоста-рендерера. */
  getCanvases(options?: CanvasSnapshotOptions): readonly IdylliumCanvasSnapshot[];
  getWindows(options?: CanvasSnapshotOptions): readonly IdylliumWindowSnapshot[];
  getModals(): readonly IdylliumModalSnapshot[];
  hasGui(): boolean;
  /** Есть ли открытые почтовые отделения channel.Post. */
  hasOpenChannels(): boolean;
  stepGui(deltaTime?: number): Promise<boolean>;
  dispatchGuiEvent(canvasId: number, eventName: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

function defaultRuntimeUrlOpener(): RuntimeUrlOpener | undefined {
  const nodeProcess = typeof process === 'object' ? process as any : null;
  if (!nodeProcess?.versions?.node) return undefined;
  try {
    // Node-специфичный child_process держим вне браузерного бандла;
    // browser.ts и расширение VS Code внедряют свои открывалки.
    const dynamicRequire = eval('require') as (request: string) => any;
    return dynamicRequire('./node-url-opener').createNodeUrlOpener();
  } catch {
    return undefined;
  }
}

function defaultRuntimeNetworkService(): RuntimeNetworkService | undefined {
  // Глобальный fetch есть в Node ≥18 и в любом браузере; CORS-подсказки
  // включает только браузерная сборка (src/browser.ts).
  const service = createFetchNetworkService();
  const nodeProcess = typeof process === 'object' ? process as unknown as { versions?: { node?: string } } : null;
  if (!service || !nodeProcess?.versions?.node) return service;
  try {
    // Серверная половина (web.Server) есть только у node-хостов; загрузка
    // через eval('require') держит node:http вне браузерного бандла.
    const dynamicRequire = eval('require') as (request: string) => { createNodeHttpListen(): RuntimeNetworkService['listen'] };
    return { fetch: (request) => service.fetch(request), listen: dynamicRequire('./node-http-server').createNodeHttpListen() };
  } catch {
    return service;
  }
}

function defaultRuntimeImageService(): RuntimeImageService | undefined {
  const nodeProcess = typeof process === 'object' ? process as any : null;
  if (!nodeProcess?.versions?.node) return undefined;
  try {
    // Keep the Node codec out of the browser bundle; browser.ts injects its own service.
    const dynamicRequire = eval('require') as (request: string) => any;
    return dynamicRequire('./node-image-service').createNodeImageService();
  } catch {
    return undefined;
  }
}

function defaultRuntimeSqliteService(): RuntimeSqliteService | undefined {
  const nodeProcess = typeof process === 'object' ? process as any : null;
  if (!nodeProcess?.versions?.node) return undefined;
  try {
    // Keep sql.js and its Node loader out of the browser bundle.
    const dynamicRequire = eval('require') as (request: string) => any;
    return dynamicRequire('./node-sqlite-service').createNodeSqliteService();
  } catch {
    return undefined;
  }
}

export function createRuntime(options: RuntimeOptions = {}): IdylliumRuntime {
  let output = '';
  // По умолчанию float печатается с точностью до 8 знаков после запятой
  // (хвостовые нули отбрасываются); console.set_precision() меняет точность.
  let precision: number | null = 8;
  // Таймаут библиотеки http; живёт до return, иначе TDZ (функции хойстятся, let — нет).
  let httpTimeoutSeconds = 10;
  let randomSeed: number | null = null;
  // Собственное 32-битное состояние mulberry32; set_seed() сбрасывает его
  // вместе с LCG, чтобы прогоны с сидом были воспроизводимы.
  let mulberryState: number | null = null;
  const input = [...(options.input ?? [])];
  const fileSystem = options.fileSystem ?? createNodeRuntimeFileSystem(options.projectRoot);
  const humanizeFsPaths = (text: string): string => fileSystem.humanizePaths?.(text) ?? text;
  const runtimeObjects: RuntimeObjectState = {
    objects: [],
    audio: [],
    canvases: [],
    fileSystem,
    fontMetricsService: options.fontMetricsService ?? createRuntimeFontMetricsService(),
    imageService: options.imageService ?? defaultRuntimeImageService(),
    sqliteService: options.sqliteService ?? defaultRuntimeSqliteService(),
    modals: [],
    timers: [],
    windows: [],
    channelPosts: [],
    channelService: options.channelService,
    networkService: options.networkService ?? defaultRuntimeNetworkService(),
    abortSignal: options.abortSignal,
    channelMailbox: [],
    nextAudioCommandId: 1,
    nextObjectId: 1,
    warningsDisabled: false,
    windowsCreated: 0,
    anyWindowEverShown: false,
    openOutputStreams: new Map(),
    turtleField: null,
    turtlePlatform: String(options.platform ?? defaultRuntimePlatform()),
  };
  runtimeObjects.stopCheck = (file, line) => throwIfRuntimeStopped(file, line);
  // Stop-кнопка закрывает почтовые отделения: BroadcastChannel не должен
  // переживать остановленную программу.
  options.abortSignal?.addEventListener?.('abort', () => {
    for (const post of runtimeObjects.channelPosts) closeChannelPost(post);
  }, { once: true });

  const io: ConsoleIO = {
    write(text: string): void {
      output += text;
      options.console?.write?.(text);
    },
    clear(): void {
      output = '';
      options.console?.clear?.();
    },
    async readLine(): Promise<string> {
      if (options.console?.readLine) {
        return options.console.readLine();
      }
      return input.shift() ?? '';
    },
  };
  runtimeObjects.consoleWrite = (text) => io.write(text);

  function formatSqliteValueForPrint(value: { __sqliteKind: string; __sqliteValue?: unknown }, quoted: boolean): string {
    if (value.__sqliteKind === 'null') return 'null';
    const stored = value.__sqliteValue;
    return quoted ? formatForInspect(stored) : formatForConsole(stored, precision);
  }

  async function formatConsoleValue(value: unknown): Promise<string> {
    if (isJsonRuntimeValue(value)) {
      return formatForConsole(value, precision);
    }
    // Комплексное число печатается как число: части округляются по console.set_precision.
    if (value instanceof IdylliumComplex) return value.format(precision);
    // Значение из базы печатается своим естественным видом (7, 2.5, текст, null) — как
    // json.Value. Строгим остаётся to_string(): раньше печать шла через него и падала на
    // любом нестроковом значении с адресом «sqlite:0:».
    if (isSqliteRuntimeValue(value)) return formatSqliteValueForPrint(value, false);
    // Массив объектов с контрактом to_string: представления элементов
    // собираются асинхронно (инспектор массива синхронный и сам метод
    // ученика позвать не может) — жанр equalsObjectArrays. Вложенность
    // проходится насквозь: у таблицы объектов внутренние ряды раньше
    // печатались JS-нутром '[object Object]'.
    if ((value instanceof IdylliumArray || value instanceof IdylliumMap) && (await collectionHoldsContractObjects(value))) {
      return await formatCollectionWithContracts(value);
    }
    if (value !== null && typeof value === 'object') {
      const method = (value as Record<string, unknown>).to_string;
      if (typeof method === 'function') {
        const result = await method.apply(value);
        return formatForConsole(result, precision);
      }
    }
    return formatForConsole(value, precision);
  }

  // Есть ли в коллекции (массив/словарь, на любой глубине) объект с
  // контрактом to_string.
  async function collectionHoldsContractObjects(collection: IdylliumArray | IdylliumMap): Promise<boolean> {
    const items = collection instanceof IdylliumArray
      ? collection.values()
      : collection.entriesList().map((entry) => entry.value);
    for (const item of items) {
      if (item instanceof IdylliumArray || item instanceof IdylliumMap) {
        if (await collectionHoldsContractObjects(item)) return true;
        continue;
      }
      if (item !== null && typeof item === 'object'
        && typeof (item as Record<string, unknown>).to_string === 'function') return true;
    }
    return false;
  }

  async function formatItemWithContracts(item: unknown): Promise<string> {
    if (item instanceof IdylliumArray || item instanceof IdylliumMap) return formatCollectionWithContracts(item);
    // Числа в массиве — без кавычек: [1 + 2i, -i], как [1.5, 2].
    if (item instanceof IdylliumComplex) return item.format(precision);
    if (isSqliteRuntimeValue(item)) return formatSqliteValueForPrint(item, true);
    const method = item !== null && typeof item === 'object'
      ? (item as Record<string, unknown>).to_string
      : undefined;
    return typeof method === 'function'
      ? formatForInspect(await (method as () => Promise<unknown>).apply(item))
      : formatForInspect(item);
  }

  async function formatCollectionWithContracts(collection: IdylliumArray | IdylliumMap): Promise<string> {
    if (collection instanceof IdylliumArray) {
      const parts: string[] = [];
      for (const item of collection.values()) parts.push(await formatItemWithContracts(item));
      return `[${parts.join(', ')}]`;
    }
    const parts: string[] = [];
    for (const entry of collection.entriesList()) {
      parts.push(`${formatForInspect(entry.key)}: ${await formatItemWithContracts(entry.value)}`);
    }
    return `{${parts.join(', ')}}`;
  }

  async function formatConsoleValues(values: readonly unknown[]): Promise<string> {
    const parts: string[] = [];
    for (const value of values) {
      parts.push(await formatConsoleValue(value));
    }
    return parts.join('');
  }

  /** Байты файла: readBytes хоста либо UTF-8 текста (память-ФС хранит текст строкой). */
  function readFileBytes(filePath: string): number[] {
    if (fileSystem.readBytes) return Array.from(fileSystem.readBytes(filePath));
    return Array.from(new TextEncoder().encode(fileSystem.readText(filePath)));
  }

  /** Текст файла в кодировке — строго: чужая кодировка не превращается в ромбики
   *  молча, а называется вместе с подсказкой, на что похожи байты. */
  function decodeFileText(bytes: number[], encodingSpec: EncodingSpec, functionName: string, shownPath: string, sourceFile: string, line: number): string {
    try {
      return decodeFileBytes(bytes, encodingSpec);
    } catch (error) {
      if (!(error instanceof EncodingFailure)) throw error;
      const guessed = guessFileEncoding(bytes);
      const recipe = functionName === 'csv.read()'
        ? `csv.read(path, encoding="${guessed}")`
        : `file.open(path, "read", "${guessed}")`;
      const hint = guessed !== '' && guessed !== encodingSpec.id
        ? ` — the file looks like ${guessed}; open it with ${recipe}`
        : '';
      throw new IdylliumRuntimeError(sourceFile, line, `${functionName} cannot read '${shownPath}' as ${encodingSpec.id}: ${error.message}${hint}`);
    }
  }

  function createInputFile(filePath: string, sourceFile: string, line: number, encodingSpec: EncodingSpec): Record<string, unknown> {
    const shownPath = humanizeFsPaths(filePath);
    let fileExists: boolean;
    try {
      fileExists = fileSystem.exists(filePath);
    } catch (error) {
      // страж песочницы (path is outside the project) — в детской обёртке
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for reading: ${humanizeFsPaths(errorMessage(error))}`);
    }
    if (!fileExists) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for reading: file does not exist`);
    }
    if (!runtimeIsFile(fileSystem, filePath, sourceFile, line, 'reading', shownPath)) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for reading: path is not a file`);
    }

    let rawBytes: number[];
    try {
      rawBytes = readFileBytes(filePath);
    } catch (error) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for reading: ${humanizeFsPaths(errorMessage(error))}`);
    }
    const characters = Array.from(decodeFileText(rawBytes, encodingSpec, 'file.open()', shownPath, sourceFile, line));

    let offset = 0;
    let closed = false;
    const readRemaining = () => {
      const result = characters.slice(offset).join('');
      offset = characters.length;
      return result;
    };
    const stream: Record<string, unknown> = {
      __idylliumType: 'file.istream',
      is_open: true,
      read: contextFunction((...rawArgs: unknown[]) => {
        const { values, file, line: callLine } = splitContextArgs(rawArgs);
        expectOpen(!closed, 'istream.read()', file, callLine);
        if (values.length === 0) return readRemaining();

        const count = integerNumber(values[0], 'istream.read() count', file, callLine);
        if (count < 0) {
          throw new IdylliumRuntimeError(file, callLine, `istream.read() count must be non-negative, got ${count}`);
        }
        const end = Math.min(characters.length, offset + count);
        const result = characters.slice(offset, end).join('');
        offset = end;
        return result;
      }),
      read_line: contextFunction((file: string, callLine: number) => {
        expectOpen(!closed, 'istream.read_line()', file, callLine);
        if (offset >= characters.length) {
          throw new IdylliumRuntimeError(file, callLine, 'istream.read_line() cannot read past end of file');
        }
        let end = offset;
        while (end < characters.length) {
          const character = characters[end++];
          if (character === '\n') break;
          if (character === '\r') {
            if (characters[end] === '\n') end++;
            break;
          }
        }
        const result = characters.slice(offset, end).join('');
        offset = end;
        return result;
      }),
      read_all: contextFunction((file: string, callLine: number) => {
        expectOpen(!closed, 'istream.read_all()', file, callLine);
        return readRemaining();
      }),
      has_next_line: contextFunction((file: string, callLine: number) => {
        expectOpen(!closed, 'istream.has_next_line()', file, callLine);
        return offset < characters.length;
      }),
      close: () => {
        closed = true;
        stream.is_open = false;
      },
    };
    return stream;
  }

  function createOutputFile(filePath: string, sourceFile: string, line: number, append = false, encodingSpec?: EncodingSpec): Record<string, unknown> {
    const shownPath = humanizeFsPaths(filePath);
    // Запись не в UTF-8: текст кодируется строго и дописывается байтами.
    const appendEncoded = (text: string, methodName: string, file: string, callLine: number): void => {
      if (!encodingSpec || encodingSpec.kind === 'utf-8') {
        fileSystem.appendText(filePath, text);
        return;
      }
      let bytes: number[];
      try {
        bytes = encodeText(text, encodingSpec, true);
      } catch (error) {
        if (!(error instanceof EncodingFailure)) throw error;
        throw new IdylliumRuntimeError(file, callLine, `${methodName} ${error.message}`);
      }
      if (fileSystem.appendBytes) {
        fileSystem.appendBytes(filePath, Uint8Array.from(bytes));
      } else if (fileSystem.writeBytes) {
        fileSystem.writeBytes(filePath, Uint8Array.from([...readFileBytes(filePath), ...bytes]));
      } else {
        throw new IdylliumRuntimeError(file, callLine, `${methodName} requires binary file support in this runtime`);
      }
    };
    // Режим 'append' дозаписывает в конец: существующее содержимое не
    // стирается, отсутствующий файл создаётся пустым.
    const action = append ? 'appending' : 'writing';
    const parent = runtimeDirname(filePath);
    if (!fileSystem.exists(parent)) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for ${action}: directory does not exist`);
    }
    if (!runtimeIsDirectory(fileSystem, parent, sourceFile, line, action, shownPath)) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for ${action}: parent path is not a directory`);
    }

    try {
      if (!append) {
        fileSystem.writeText(filePath, '');
      } else if (!fileSystem.exists(filePath)) {
        fileSystem.writeText(filePath, '');
      } else if (!fileSystem.isFile(filePath)) {
        throw new Error('path is not a file');
      }
    } catch (error) {
      throw new IdylliumRuntimeError(sourceFile, line, `file.open() cannot open '${shownPath}' for ${action}: ${humanizeFsPaths(errorMessage(error))}`);
    }

    let closed = false;
    const stream: Record<string, unknown> = {
      __idylliumType: 'file.ostream',
      is_open: true,
      write: contextFunction(async (...rawArgs: unknown[]) => {
        const { values, file, line: callLine } = splitContextArgs(rawArgs);
        expectOpen(!closed, 'ostream.write()', file, callLine);
        appendEncoded(await formatConsoleValues(values), 'ostream.write()', file, callLine);
      }),
      write_line: contextFunction(async (...rawArgs: unknown[]) => {
        const { values, file, line: callLine } = splitContextArgs(rawArgs);
        expectOpen(!closed, 'ostream.write_line()', file, callLine);
        appendEncoded(`${await formatConsoleValues(values)}\n`, 'ostream.write_line()', file, callLine);
      }),
      close: () => {
        closed = true;
        stream.is_open = false;
        runtimeObjects.openOutputStreams.delete(stream);
      },
    };
    // Открытый поток записи попадает в реестр: если программа кончится, не
    // закрыв его, — рантайм-предупреждение (данные при этом целы).
    runtimeObjects.openOutputStreams.set(stream, shownPath);
    return stream;
  }

  // Кооперативная остановка циклов: щедрый быстрый путь (инкремент счётчика),
  // раз в LOOP_TICK_CHECK_MASK+1 итераций — проверка сигнала, и не чаще
  // LOOP_YIELD_INTERVAL_MS — уступка хосту, чтобы обработчик Stop успел
  // выставить abort даже при полностью занятом цикле event loop.
  const LOOP_TICK_CHECK_MASK = 1023;
  const LOOP_YIELD_INTERVAL_MS = 25;
  let loopTickCounter = 0;
  let lastLoopYieldAt = Date.now();

  // ─── Глубина вызовов ──────────────────────────────────────────────────
  // Idyllium считает глубину сам, а не полагается на стек JavaScript: тот
  // кончается на разной отметке в Node и в браузере, разворачивается с мусором
  // от V8 в stderr и не ловится try/catch. Свой счётчик делает предел
  // свойством языка и превращает переполнение в обычную runtime error.
  //
  // Уступка раз в CALL_YIELD_MASK+1 кадров глубины — не оптимизация, а
  // единственное, что вообще позволяет уйти за физический стек: приостановка
  // async-функции разворачивает всю цепочку вызовов в кучу, и спуск
  // продолжается с почти пустого стека. Программа, не уходящая глубже 511
  // кадров (то есть любая обычная), это условие ни разу не выполнит.
  const CALL_YIELD_MASK = 511;
  const MICROTASK_YIELD = Promise.resolve();
  let callDepth = 0;
  let maxCallDepth = clampRecursionDepth(options.maxRecursionDepth ?? DEFAULT_RECURSION_DEPTH);
  let lastCallYieldAt = Date.now();

  // Результат main(): показывается хостом после завершения программы.
  let exitValue: unknown = undefined;
  let hasExitValue = false;
  let loopYieldChannel: { port1: { onmessage: (() => void) | null }; port2: { postMessage(value: unknown): void } } | null = null;
  let pendingLoopYieldResolve: (() => void) | null = null;

  function yieldToHost(): Promise<void> {
    const scheduler = globalThis as {
      setImmediate?: (callback: () => void) => void;
      MessageChannel?: new () => NonNullable<typeof loopYieldChannel>;
    };
    if (typeof scheduler.setImmediate === 'function') {
      const setImmediateFn = scheduler.setImmediate;
      return new Promise<void>((resolve) => setImmediateFn(resolve));
    }
    if (typeof scheduler.MessageChannel === 'function') {
      if (loopYieldChannel === null) {
        loopYieldChannel = new scheduler.MessageChannel();
        loopYieldChannel.port1.onmessage = () => {
          const resolve = pendingLoopYieldResolve;
          pendingLoopYieldResolve = null;
          resolve?.();
        };
      }
      return new Promise<void>((resolve) => {
        pendingLoopYieldResolve = resolve;
        loopYieldChannel?.port2.postMessage(null);
      });
    }
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  const core = {
    tick(file: string, line: number): Promise<void> | null {
      loopTickCounter = (loopTickCounter + 1) | 0;
      if ((loopTickCounter & LOOP_TICK_CHECK_MASK) !== 0) return null;
      throwIfRuntimeStopped(file, line);
      const now = Date.now();
      if (now - lastLoopYieldAt < LOOP_YIELD_INTERVAL_MS) return null;
      lastLoopYieldAt = now;
      return yieldToHost().then(() => throwIfRuntimeStopped(file, line));
    },
    binary(operator: string, left: unknown, right: unknown, file: string, line: number, mode?: 'float'): unknown {
      return runtimeBinary(operator, left, right, file, line, mode);
    },
    // Кодоген ставит эту границу везде, где значение кладётся в float-цель
    // (объявление, присваивание, параметр, return): int-гигант за пределами
    // double не «проносит» точную величину во float-переменную, а честно
    // отказывает; обычные числа проходят как были.
    toFloat(value: unknown, file: string, line: number): number {
      const numeric = runtimeNumber(value, 'float value', file, line);
      if (typeof numeric === 'number') return numeric;
      const result = Number(numeric);
      if (!Number.isFinite(result)) {
        throw new IdylliumRuntimeError(file, line, "value is outside the 'float' range");
      }
      return result;
    },
    // Имя типа для объектов — рантайм-метка (актуальный класс); значения
    // подставляются кодогеном статически и сюда обычно не доходят.
    typeName(value: unknown): string {
      if (value === null) return 'null';
      if (value instanceof IdylliumColor) return 'colors.Color';
      if (value instanceof IdylliumTimeStamp) return 'time.stamp';
      if (value instanceof IdylliumComplex) return 'math.Complex';
      if (value instanceof IdylliumArray) return 'array';
      if (value instanceof IdylliumMap) return 'map';
      if (value instanceof IdylliumSet) return 'set';
      if (typeof value === 'object' && typeof (value as Record<string, unknown>).__idylliumType === 'string') {
        // Наследник виджета носит рантайм-тип базы, а СВОЁ имя — в __idylliumClass.
        if (typeof (value as Record<string, unknown>).__idylliumClass === 'string') {
          return (value as Record<string, unknown>).__idylliumClass as string;
        }
        return (value as Record<string, unknown>).__idylliumType as string;
      }
      if (typeof value === 'string') return 'string';
      if (typeof value === 'boolean') return 'bool';
      if (typeof value === 'bigint') return 'int';
      if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
      return 'unknown';
    },
    // Страж «пустого поля»: пустота не выходит в мир молча.
    expectPresent(value: unknown, fieldName: string, className: string, file: string, line: number): unknown {
      if (value === null || value === undefined) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `field '${fieldName}' of class '${className}' is empty (null) — check it with '!= null' before using it`,
        );
      }
      return value;
    },
    // '==' объектов с контрактом equals: awaited-вызов слота статического типа.
    // «Пустые поля» сравниваются и между собой: пустота равна только пустоте.
    async equalsObjects(left: unknown, right: unknown, slot: string, file: string, line: number): Promise<boolean> {
      if (left === null || right === null) return left === null && right === null;
      const contract = (left as Record<string, unknown> | null)?.[slot];
      if (typeof contract !== 'function') {
        throw new IdylliumRuntimeError(file, line, "comparison found an object without the 'equals' contract");
      }
      return (await (contract as (other: unknown) => Promise<unknown>)(right)) === true;
    },
    // Контракты порядка (less/greater): null упорядочивать нечем — честная
    // ошибка, в отличие от equals, где null == null осмысленно истинен.
    async orderObjects(left: unknown, right: unknown, slot: string, contract: string, file: string, line: number): Promise<boolean> {
      if (left === null || right === null) {
        throw new IdylliumRuntimeError(file, line, 'comparison found null instead of an object');
      }
      const method = (left as Record<string, unknown>)[slot];
      if (typeof method !== 'function') {
        throw new IdylliumRuntimeError(file, line, `comparison found an object without the '${contract}' contract`);
      }
      return (await (method as (other: unknown) => Promise<unknown>)(right)) === true;
    },
    // Арифметические контракты (plus/minus/multiply/divide): слот класса ЛЕВОГО
    // операнда; результат — что вернул контракт (тип проверен компилятором).
    async arithmeticObjects(left: unknown, right: unknown, slot: string, contract: string, sign: string, file: string, line: number): Promise<unknown> {
      if (left === null || left === undefined) {
        throw new IdylliumRuntimeError(file, line, `'${sign}' found null instead of an object`);
      }
      const method = (left as Record<string, unknown>)[slot];
      if (typeof method !== 'function') {
        throw new IdylliumRuntimeError(file, line, `'${sign}' found an object without the '${contract}' contract`);
      }
      return (method as (other: unknown) => Promise<unknown>)(right);
    },
    async oppositeObject(operand: unknown, slot: string, file: string, line: number): Promise<unknown> {
      if (operand === null || operand === undefined) {
        throw new IdylliumRuntimeError(file, line, "unary '-' found null instead of an object");
      }
      const method = (operand as Record<string, unknown>)[slot];
      if (typeof method !== 'function') {
        throw new IdylliumRuntimeError(file, line, "unary '-' found an object without the 'opposite' contract");
      }
      return (method as () => Promise<unknown>)();
    },
    async equalsObjectArrays(left: unknown, right: unknown, slot: string, file: string, line: number): Promise<boolean> {
      return equalsArrayCellsWith(
        expectArray(left, file, line),
        expectArray(right, file, line),
        slot,
        file,
        line,
      );
    },
    async equalsObjectMaps(left: unknown, right: unknown, slot: string, file: string, line: number): Promise<boolean> {
      return equalsMapEntriesWith(
        expectMap(left, file, line),
        expectMap(right, file, line),
        slot,
        file,
        line,
      );
    },
    negate(value: unknown): number | bigint {
      return runtimeNegate(value);
    },
    divide(left: unknown, right: unknown, file: string, line: number): number {
      return runtimeDivide(left, right, file, line);
    },
    div(left: unknown, right: unknown, file: string, line: number): number | bigint {
      return runtimeIntegerDivision(left, right, file, line);
    },
    mod(left: unknown, right: unknown, file: string, line: number): number | bigint {
      return runtimeModulo(left, right, file, line);
    },
    to_int(value: unknown, file: string, line: number): number | bigint {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') {
        return Math.trunc(finiteNumber(value, "'to_int' value", file, line));
      }
      if (typeof value === 'string') {
        return parseIntegerText(value, "'to_int'", file, line);
      }
      throw new IdylliumRuntimeError(file, line, `'to_int' cannot convert '${String(value)}' to int`);
    },
    to_float(value: unknown, file: string, line: number): number {
      if (typeof value === 'number' || typeof value === 'bigint') {
        return finiteNumber(value, "'to_float' value", file, line);
      }
      if (typeof value === 'string') {
        return parseFloatText(value, "'to_float'", file, line);
      }
      throw new IdylliumRuntimeError(file, line, `'to_float' cannot convert '${String(value)}' to float`);
    },
    async to_string(value: unknown): Promise<string> {
      // Как и console.write: у объекта с публичным to_string() вызывается он.
      return formatConsoleValue(value);
    },
    /**
     * Вход в пользовательскую функцию. Возвращает промис, если пора уступить
     * управление (кодогенерация тогда его ждёт), и null на быстром пути.
     */
    enterCall(name: string, file: string, line: number): Promise<void> | null {
      callDepth++;
      if (callDepth > maxCallDepth) {
        // Кадр не состоялся — его finally не выполнится, счётчик правим сами.
        callDepth--;
        throw new IdylliumRuntimeError(
          file,
          line,
          `recursion depth limit of ${maxCallDepth} exceeded in function '${name}'`,
        );
      }
      if ((callDepth & CALL_YIELD_MASK) !== 0) return null;

      throwIfRuntimeStopped(file, line);
      const now = Date.now();
      if (now - lastCallYieldAt < LOOP_YIELD_INTERVAL_MS) {
        // Дешёвая уступка микрозадаче: стек разворачивается, хост не дышит.
        return MICROTASK_YIELD;
      }
      lastCallYieldAt = now;
      // Изредка уступаем по-настоящему, чтобы кнопка «Стоп» успела сработать.
      return yieldToHost().then(() => throwIfRuntimeStopped(file, line));
    },
    leaveCall(): void {
      if (callDepth > 0) callDepth--;
    },
    setExitValue(value: unknown): void {
      exitValue = value;
      hasExitValue = true;
    },
  };

  const array = {
    create(size: number, defaultFactory: () => unknown, dynamic: boolean): IdylliumArray {
      return IdylliumArray.create(size, defaultFactory, dynamic);
    },
    createAsync(
      size: number,
      defaultFactory: IdylliumArrayDefaultFactory,
      dynamic: boolean,
    ): Promise<IdylliumArray> {
      return IdylliumArray.createAsync(size, defaultFactory, dynamic);
    },
    from(
      values: unknown[],
      dynamic: boolean,
      staticSize: number | null,
      defaultFactory: IdylliumArrayDefaultFactory,
    ): IdylliumArray {
      return IdylliumArray.from(values, dynamic, staticSize, defaultFactory);
    },
    convert(
      value: unknown,
      dynamic: boolean,
      staticSize: number | null,
      defaultFactory: IdylliumArrayDefaultFactory,
      convertElement: (value: unknown) => unknown,
      targetType: string,
      file: string,
      line: number,
    ): IdylliumArray {
      return IdylliumArray.convert(
        value,
        dynamic,
        staticSize,
        defaultFactory,
        convertElement,
        targetType,
        file,
        line,
      );
    },
    get(value: unknown, index: unknown, file: string, line: number): unknown {
      if (typeof value === 'string') return stringCharAt(value, index, file, line);
      return expectArray(value, file, line).get(index, file, line);
    },
    set(value: unknown, index: unknown, item: unknown, file: string, line: number): void {
      if (typeof value === 'string') {
        throw new IdylliumRuntimeError(file, line, 'string characters are read-only');
      }
      expectArray(value, file, line).set(index, item, file, line);
    },
    // Поиск в массиве объектов через контракт equals элемента. Длина
    // фиксируется на входе: дописанное обработчиком в хвост не проверяется.
    // Сортировка массива объектов по контракту less (стабильная): равные по
    // контракту элементы сохраняют исходный порядок — важно для витрин ООП.
    async sortObjects(value: unknown, slot: string, file: string, line: number): Promise<void> {
      const array = expectArray(value, file, line);
      await array.sortWithComparator(async (left, right) => {
        if (left === null || right === null) {
          throw new IdylliumRuntimeError(file, line, 'sort() found null instead of an object');
        }
        const method = (left as Record<string, unknown>)[slot];
        if (typeof method !== 'function') {
          throw new IdylliumRuntimeError(file, line, "sort() found an object without the 'less' contract");
        }
        return (await (method as (other: unknown) => Promise<unknown>)(right)) === true;
      });
    },
    async searchWith(value: unknown, target: unknown, slot: string, mode: string, file: string, line: number): Promise<boolean | number> {
      const array = expectArray(value, file, line);
      const snapshot = array.values();
      let matches = 0;
      for (let index = 0; index < snapshot.length; index += 1) {
        const item = snapshot[index] as Record<string, unknown> | null;
        const isCollection = item instanceof IdylliumArray || item instanceof IdylliumMap;
        if (!isCollection && typeof item?.[slot] !== 'function') {
          throw new IdylliumRuntimeError(file, line, `${mode}() found an element without the 'equals' contract`);
        }
        const equal = await equalsCellWith(item, target, slot, file, line);
        if (equal) {
          if (mode === 'contains') return true;
          if (mode === 'find') return index;
          matches += 1;
        }
      }
      if (mode === 'contains') return false;
      if (mode === 'find') return -1;
      return matches;
    },
    max(value: unknown, file: string, line: number): number | bigint {
      const values = numericValues(value, 'max', file, line);
      return values.reduce((best, item) => runtimeCompare(item, best) > 0 ? item : best);
    },
    min(value: unknown, file: string, line: number): number | bigint {
      const values = numericValues(value, 'min', file, line);
      return values.reduce((best, item) => runtimeCompare(item, best) < 0 ? item : best);
    },
    sum(value: unknown, file: string, line: number): number | bigint | IdylliumComplex {
      const complex = complexSum(value, 'sum', file, line);
      if (complex) return complex;
      return numericValues(value, 'sum', file, line)
        .reduce<number | bigint>((total, item) => runtimeAdd(total, item), 0);
    },
    avg(value: unknown, file: string, line: number): number | IdylliumComplex {
      const complex = complexSum(value, 'avg', file, line);
      if (complex) return complex.divide(expectArray(value, file, line).values().length, file, line);
      const values = numericValues(value, 'avg', file, line);
      const total = values.reduce<number | bigint>((sum, item) => runtimeAdd(sum, item), 0);
      return Number(total) / values.length;
    },
    // sum() объектов: складываем контрактом plus, начиная с первого элемента —
    // «нуля» у класса нет, поэтому пустой массив — честная ошибка, как у чисел.
    async sumObjects(value: unknown, slot: string, file: string, line: number): Promise<unknown> {
      const items = expectArray(value, file, line).values();
      if (items.length === 0) {
        throw new IdylliumRuntimeError(file, line, "'sum' cannot be used with an empty array");
      }
      let total = items[0];
      for (const item of items.slice(1)) {
        if (total === null || total === undefined) {
          throw new IdylliumRuntimeError(file, line, 'sum() found null instead of an object');
        }
        const method = (total as Record<string, unknown>)[slot];
        if (typeof method !== 'function') {
          throw new IdylliumRuntimeError(file, line, "sum() found an object without the 'plus' contract");
        }
        total = await (method as (other: unknown) => Promise<unknown>).call(total, item);
      }
      return total;
    },
  };

  const set = {
    create(): IdylliumSet {
      return IdylliumSet.create();
    },
    fromValues(values: readonly unknown[]): IdylliumSet {
      return IdylliumSet.fromValues(values);
    },
    convert(value: unknown, targetType: string, file: string, line: number): IdylliumSet {
      return IdylliumSet.convert(value, targetType, file, line);
    },
  };

  const map = {
    create(): IdylliumMap {
      return IdylliumMap.create();
    },
    fromPairs(pairs: readonly (readonly [unknown, unknown])[]): IdylliumMap {
      return IdylliumMap.fromPairs(pairs);
    },
    convert(value: unknown, convertValue: (value: unknown) => unknown, targetType: string, file: string, line: number): IdylliumMap {
      return IdylliumMap.convert(value, convertValue, targetType, file, line);
    },
    get(value: unknown, key: unknown, file: string, line: number): unknown {
      return expectMap(value, file, line).get(key, file, line);
    },
    set(value: unknown, key: unknown, item: unknown, file: string, line: number): void {
      expectMap(value, file, line).set(key, item);
    },
  };

  const types = {
    cast(value: unknown, typeName: string, file = 'types', line = 0): number | bigint {
      return castTypesValue(value, typeName, file, line);
    },
    to_bin(value: unknown, typeName: string, file = 'types', line = 0): string {
      return typesToBin(value, typeName, file, line);
    },
    to_hex(value: unknown, typeName: string, file = 'types', line = 0): string {
      return typesToHex(value, typeName, file, line);
    },
    shift_left(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint {
      return typesShift(value, typeName, bits, 'left', file, line);
    },
    shift_right(value: unknown, typeName: string, bits: unknown, file: string, line: number): number | bigint {
      return typesShift(value, typeName, bits, 'right', file, line);
    },
    bit_and(value: unknown, typeName: string, mask: unknown, file: string, line: number): number | bigint {
      return typesBitwise(value, typeName, mask, 'and', file, line);
    },
    bit_or(value: unknown, typeName: string, mask: unknown, file: string, line: number): number | bigint {
      return typesBitwise(value, typeName, mask, 'or', file, line);
    },
    bit_xor(value: unknown, typeName: string, mask: unknown, file: string, line: number): number | bigint {
      return typesBitwise(value, typeName, mask, 'xor', file, line);
    },
    bit_not(value: unknown, typeName: string, file: string, line: number): number | bigint {
      return typesBitwise(value, typeName, null, 'not', file, line);
    },
  };

  return {
    console: {
      async write(...values: unknown[]): Promise<void> {
        io.write(await formatConsoleValues(values));
      },
      async writeln(...values: unknown[]): Promise<void> {
        io.write(`${await formatConsoleValues(values)}\n`);
      },
      async clear(): Promise<void> {
        io.clear();
      },
      async get_int(file = 'console', line = 0): Promise<number | bigint> {
        const inputText = await io.readLine();
        const normalized = inputText.trim();
        if (!/^[+-]?\d+$/u.test(normalized)) {
          throw new IdylliumRuntimeError(file, line, `cannot convert input to 'int' (expected integer, got ${JSON.stringify(inputText)})`);
        }
        // Ввод длиннее safe-диапазона не теряет разряды: тот же канон
        // «int точен на любом размере», что у to_int.
        return exactIntegerResult(BigInt(normalized.replace(/^\+/u, '')));
      },
      async get_float(file = 'console', line = 0): Promise<number> {
        const inputText = await io.readLine();
        const normalized = inputText.trim();
        if (!/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))$/u.test(normalized)) {
          throw new IdylliumRuntimeError(file, line, `cannot convert input to 'float' (expected number, got ${JSON.stringify(inputText)})`);
        }
        return Number.parseFloat(normalized);
      },
      async get_string(): Promise<string> {
        return io.readLine();
      },
      async set_precision(file: string, line: number, digits: number): Promise<void> {
        precision = precisionDigits(digits, 'console.set_precision()', file, line);
      },
    },
    core,
    array,
    map,
    set,
    types,
    errors: {
      catchValue(error: unknown): RuntimeObject {
        if (!(error instanceof IdylliumRuntimeError) || error.kind !== 'program') throw error;
        return createRuntimeErrorValue(error);
      },
    },
    modules: {
      system: {
        set_recursion_depth: contextFunction((value: unknown, file: string, line: number) => {
          const requested = integerNumber(value, 'system.set_recursion_depth()', file, line);
          if (requested < MIN_RECURSION_DEPTH || requested > MAX_RECURSION_DEPTH) {
            throw new IdylliumRuntimeError(
              file,
              line,
              `system.set_recursion_depth() expects a value between ${MIN_RECURSION_DEPTH} and ${MAX_RECURSION_DEPTH}, got ${requested}`,
            );
          }
          maxCallDepth = requested;
        }),
        recursion_depth: () => maxCallDepth,
        // Выключатель предупреждений — сознательно запрятан сюда (вердикт
        // владельца 2026-08-28); один универсальный метод с bool-аргументом
        // (доработка 2026-08-28): гасит и возвращает РАНТАЙМ-предупреждения
        // этой программы; предупреждения компиляции уже напечатаны и им
        // не подвластны.
        set_warnings: contextFunction((value: unknown, file: string, line: number) => {
          if (typeof value !== 'boolean') {
            throw new IdylliumRuntimeError(file, line, `system.set_warnings() expects 'bool', got '${runtimeTypeName(value)}'`);
          }
          runtimeObjects.warningsDisabled = !value;
        }),
        exit: contextFunction((code: unknown, file: string, line: number) => {
          const value = code === undefined ? 0 : integerNumber(code, 'system.exit()', file, line);
          exitValue = value;
          hasExitValue = true;
          // Особый род ошибки: разворачивает стек, выполняя finally, но не
          // ловится ученическим try/catch — иначе выход можно было бы отменить.
          throw new IdylliumRuntimeError(file, line, `program exited with code ${value}`, 'exit');
        }),
        platform: () => String(options.platform ?? defaultRuntimePlatform()),
        version: () => IDYLLIUM_VERSION,
      },
      math: {
        pi: Math.PI,
        e: Math.E,
        abs: contextFunction((value: number | bigint | IdylliumComplex, file: string, line: number) => {
          if (value instanceof IdylliumComplex) return value.abs();
          if (typeof value === 'bigint') return value < 0n ? -value : value;
          return Math.abs(finiteNumber(value, 'math.abs() value', file, line));
        }),
        sqrt: contextFunction((value: number | IdylliumComplex, file: string, line: number) => {
          if (value instanceof IdylliumComplex) return value.sqrt();
          const number = finiteNumber(value, 'math.sqrt() value', file, line);
          if (number < 0) throw new IdylliumRuntimeError(file, line, `math.sqrt() expects a non-negative number, got ${number}`);
          return Math.sqrt(number);
        }),
        round: contextFunction((value: number, digitsOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
          const context = optionalNumberContext(digitsOrFile, fileOrLine, maybeLine);
          return roundWithPrecision(value, context.value, context.file, context.line);
        }),
        floor: contextFunction((value: number, digitsOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
          const context = optionalNumberContext(digitsOrFile, fileOrLine, maybeLine);
          return floorWithPrecision(value, context.value, context.file, context.line);
        }),
        ceil: contextFunction((value: number, digitsOrFile: number | string, fileOrLine: string | number, maybeLine?: number) => {
          const context = optionalNumberContext(digitsOrFile, fileOrLine, maybeLine);
          return ceilWithPrecision(value, context.value, context.file, context.line);
        }),
        pow: contextFunction((value: number | IdylliumComplex, power: number | IdylliumComplex, file: string, line: number) => {
          if (value instanceof IdylliumComplex || power instanceof IdylliumComplex) {
            return IdylliumComplex.from(value, 'math.pow() value', file, line).pow(power, file, line);
          }
          const result = Math.pow(
            finiteNumber(value, 'math.pow() value', file, line),
            finiteNumber(power, 'math.pow() power', file, line),
          );
          return finiteMathResult(result, 'math.pow()', file, line);
        }),
        clamp: contextFunction((min: number, value: number, max: number, file: string, line: number) => {
          const lower = finiteNumber(min, 'math.clamp() min', file, line);
          const current = finiteNumber(value, 'math.clamp() value', file, line);
          const upper = finiteNumber(max, 'math.clamp() max', file, line);
          if (lower > upper) {
            throw new IdylliumRuntimeError(file, line, `math.clamp() min must be less than or equal to max (got min ${lower}, max ${upper})`);
          }
          return Math.min(upper, Math.max(lower, current));
        }),
        sin: contextFunction((radians: number | IdylliumComplex, file: string, line: number) => (radians instanceof IdylliumComplex ? radians.sin(file, line) : Math.sin(finiteNumber(radians, 'math.sin() radians', file, line)))),
        cos: contextFunction((radians: number | IdylliumComplex, file: string, line: number) => (radians instanceof IdylliumComplex ? radians.cos(file, line) : Math.cos(finiteNumber(radians, 'math.cos() radians', file, line)))),
        tan: contextFunction((radians: number | IdylliumComplex, file: string, line: number) => (radians instanceof IdylliumComplex ? radians.tan(file, line) : finiteMathResult(Math.tan(finiteNumber(radians, 'math.tan() radians', file, line)), 'math.tan()', file, line))),
        asin: contextFunction((value: number, file: string, line: number) => {
          const number = rangeNumber(value, 'math.asin() value', -1, 1, file, line);
          return Math.asin(number);
        }),
        acos: contextFunction((value: number, file: string, line: number) => {
          const number = rangeNumber(value, 'math.acos() value', -1, 1, file, line);
          return Math.acos(number);
        }),
        atan: contextFunction((value: number, file: string, line: number) => Math.atan(finiteNumber(value, 'math.atan() value', file, line))),
        atan2: contextFunction((y: number, x: number, file: string, line: number) => Math.atan2(
          finiteNumber(y, 'math.atan2() y', file, line),
          finiteNumber(x, 'math.atan2() x', file, line),
        )),
        log: contextFunction((value: number | IdylliumComplex, file: string, line: number) => {
          if (value instanceof IdylliumComplex) return value.ln(file, line);
          const number = finiteNumber(value, 'math.log() value', file, line);
          if (number <= 0) throw new IdylliumRuntimeError(file, line, `math.log() expects a positive number, got ${number}`);
          return Math.log(number);
        }),
        log10: contextFunction((value: number, file: string, line: number) => {
          const number = finiteNumber(value, 'math.log10() value', file, line);
          if (number <= 0) throw new IdylliumRuntimeError(file, line, `math.log10() expects a positive number, got ${number}`);
          return Math.log10(number);
        }),
        to_radians: contextFunction((degrees: number, file: string, line: number) => finiteNumber(degrees, 'math.to_radians() degrees', file, line) * Math.PI / 180),
        to_degrees: contextFunction((radians: number, file: string, line: number) => finiteNumber(radians, 'math.to_degrees() radians', file, line) * 180 / Math.PI),
        gcd: contextFunction((a: unknown, b: unknown, file: string, line: number) => exactIntegerResult(bigGcd(
          runtimeInteger(a, 'math.gcd() a', file, line),
          runtimeInteger(b, 'math.gcd() b', file, line),
        ))),
        lcm: contextFunction((a: unknown, b: unknown, file: string, line: number) => {
          const x = bigAbs(runtimeInteger(a, 'math.lcm() a', file, line));
          const y = bigAbs(runtimeInteger(b, 'math.lcm() b', file, line));
          if (x === 0n || y === 0n) return 0;
          return exactIntegerResult((x / bigGcd(x, y)) * y);
        }),
        factorial: contextFunction((n: unknown, file: string, line: number) => {
          const count = integerNumber(n, 'math.factorial() n', file, line);
          if (count < 0 || count > 10000) {
            throw new IdylliumRuntimeError(file, line, `math.factorial() n must be between 0 and 10000, got ${count}`);
          }
          let result = 1n;
          for (let factor = 2n; factor <= BigInt(count); factor += 1n) result *= factor;
          return exactIntegerResult(result);
        }),
        is_prime: contextFunction((n: unknown, file: string, line: number) => {
          const value = runtimeInteger(n, 'math.is_prime() n', file, line);
          if (value > IS_PRIME_EXACT_LIMIT) {
            throw new IdylliumRuntimeError(file, line, `math.is_prime() n must be at most ${IS_PRIME_EXACT_LIMIT}, got ${value}`);
          }
          return bigIsPrime(value);
        }),
        divisors: contextFunction((n: unknown, file: string, line: number) => {
          const value = integerNumber(n, 'math.divisors() n', file, line);
          if (value < 1) {
            throw new IdylliumRuntimeError(file, line, `math.divisors() n must be a positive number, got ${value}`);
          }
          const small: number[] = [];
          const large: number[] = [];
          for (let candidate = 1; candidate * candidate <= value; candidate += 1) {
            if (value % candidate === 0) {
              small.push(candidate);
              if (candidate * candidate !== value) large.push(value / candidate);
            }
          }
          return IdylliumArray.from([...small, ...large.reverse()], true, null, () => 0);
        }),
        sign: contextFunction((value: unknown, file: string, line: number) => {
          if (typeof value === 'bigint') return value < 0n ? -1 : value > 0n ? 1 : 0;
          const number = finiteNumber(value, 'math.sign() value', file, line);
          return number < 0 ? -1 : number > 0 ? 1 : 0;
        }),
        hypot: contextFunction((a: unknown, b: unknown, file: string, line: number) => finiteMathResult(Math.hypot(
          finiteNumber(a, 'math.hypot() a', file, line),
          finiteNumber(b, 'math.hypot() b', file, line),
        ), 'math.hypot()', file, line)),
        // ── комплексные числа ──
        I: new IdylliumComplex(0, 1),
        // Оба аргумента необязательны — контекст file/line приходит хвостом, разбираем его штатно.
        Complex: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          return new IdylliumComplex(
            values[0] === undefined ? 0 : finiteNumber(values[0], 'math.Complex() re', file, line),
            values[1] === undefined ? 0 : finiteNumber(values[1], 'math.Complex() im', file, line),
          );
        }),
        polar: contextFunction((modulus: unknown, argument: unknown, file: string, line: number) => {
          const r = finiteNumber(modulus, 'math.polar() modulus', file, line);
          if (r < 0) {
            throw new IdylliumRuntimeError(file, line, `math.polar() modulus cannot be negative, got ${r} — a negative sign belongs to the argument (add math.pi)`);
          }
          return IdylliumComplex.polar(r, finiteNumber(argument, 'math.polar() argument', file, line));
        }),
        // Граница типа: число становится комплексным (лестница int → float → math.Complex).
        toComplex: (value: unknown, file: string, line: number) => IdylliumComplex.from(value, 'math.Complex value', file, line),
        complexBinary: (operator: string, left: unknown, right: unknown, file: string, line: number) => {
          const z = IdylliumComplex.from(left, `operator '${operator}' left operand`, file, line);
          if (operator === '+') return z.plus(right, file, line);
          if (operator === '-') return z.minus(right, file, line);
          if (operator === '*') return z.multiply(right, file, line);
          return z.divide(right, file, line);
        },
        complexOpposite: (value: unknown) => (value as IdylliumComplex).opposite(),
      },
      random: {
        create_int: contextFunction((min: number, max: number, file: string, line: number) => {
          const low = integerNumber(min, 'random.create_int() min', file, line);
          const high = integerNumber(max, 'random.create_int() max', file, line);
          if (low > high) {
            throw new IdylliumRuntimeError(file, line, `random.create_int() min must be less than or equal to max (got min ${low}, max ${high})`);
          }
          return Math.floor(randomUnit() * (high - low + 1)) + low;
        }),
        create_float: contextFunction((min: number, max: number, file: string, line: number) => {
          const low = finiteNumber(min, 'random.create_float() min', file, line);
          const high = finiteNumber(max, 'random.create_float() max', file, line);
          if (low >= high) {
            throw new IdylliumRuntimeError(file, line, `random.create_float() min must be less than max (got min ${low}, max ${high})`);
          }
          return randomUnitInclusive() * (high - low) + low;
        }),
        choose_from: contextFunction((collection: unknown, file: string, line: number) => {
          if (typeof collection === 'string') {
            const characters = Array.from(collection);
            if (characters.length === 0) {
              throw new IdylliumRuntimeError(file, line, 'random.choose_from() cannot choose from an empty string');
            }
            return characters[Math.floor(randomUnit() * characters.length)];
          }

          if (collection instanceof IdylliumArray) {
            if (collection.length === 0) {
              throw new IdylliumRuntimeError(file, line, 'random.choose_from() cannot choose from an empty array');
            }
            return collection.get(Math.floor(randomUnit() * collection.length), file, line);
          }

          throw new IdylliumRuntimeError(
            file,
            line,
            `random.choose_from() expects a string or array, got '${runtimeTypeName(collection)}'`,
          );
        }),
        // Перемешанная копия (Фишер–Йетс); оригинал не меняется — массивы в
        // языке значения, и функция обязана вернуть результат. Строка режется
        // по видимым символам, как в choose_from (сурогатные пары не рвутся).
        shuffle: contextFunction((collection: unknown, file: string, line: number) => {
          const pickIndex = (bound: number): number => Math.floor(randomUnit() * bound);
          if (typeof collection === 'string') {
            const characters = Array.from(collection);
            for (let index = characters.length - 1; index > 0; index -= 1) {
              const swapWith = pickIndex(index + 1);
              const held = characters[index];
              characters[index] = characters[swapWith];
              characters[swapWith] = held;
            }
            return characters.join('');
          }
          if (collection instanceof IdylliumArray) {
            return collection.shuffledCopy(pickIndex);
          }
          throw new IdylliumRuntimeError(
            file,
            line,
            `random.shuffle() expects a string or array, got '${runtimeTypeName(collection)}'`,
          );
        }),
        set_seed: contextFunction((seed: number, file: string, line: number) => {
          if (typeof seed === 'bigint' || (typeof seed === 'number' && !Number.isSafeInteger(seed) && Number.isFinite(seed))) {
            throw new IdylliumRuntimeError(file, line, `random.set_seed() seed must be between 0 and 9007199254740991, got ${String(seed)}`);
          }
          const value = integerNumber(seed, 'random.set_seed() seed', file, line);
          if (value < 0) throw new IdylliumRuntimeError(file, line, `random.set_seed() seed must be non-negative, got ${value}`);
          randomSeed = value >>> 0;
          mulberryState = value >>> 0;
        }),
        mulberry32: contextFunction(() => {
          if (mulberryState === null) {
            mulberryState = Math.floor(Math.random() * 0x100000000) >>> 0;
          }
          // Классический mulberry32 (Tommy Ettinger, public domain) — тот самый
          // «математический огород», который городят в языках без готового random.
          mulberryState = (mulberryState + 0x6D2B79F5) >>> 0;
          let t = mulberryState;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return (t ^ (t >>> 14)) >>> 0;
        }),
      },
      time: {
        sleep: contextFunction((seconds: number, file: string, line: number) => {
          const duration = finiteNumber(seconds, 'time.sleep() seconds', file, line);
          if (duration < 0) {
            throw new IdylliumRuntimeError(file, line, `time.sleep() seconds must be non-negative, got ${duration}`);
          }
          return waitForRuntimeDelay(duration * 1000, file, line);
        }),
        now: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          return IdylliumTimeStamp.now(values[0] ?? 'UTC', file, line);
        }),
        from_unix: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          return IdylliumTimeStamp.fromUnix(values[0], values[1] ?? 'UTC', file, line);
        }),
        create: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          return IdylliumTimeStamp.create(values, file, line);
        }),
      },
      file: {
        exists: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.exists() path', file, line);
          try {
            return fileSystem.exists(fileSystem.resolvePath(requestedPath, file));
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.exists() cannot inspect '${requestedPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        is_file: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.is_file() path', file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          try {
            return fileSystem.exists(resolvedPath) && fileSystem.isFile(resolvedPath);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.is_file() cannot inspect '${requestedPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        is_directory: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.is_directory() path', file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          try {
            return fileSystem.exists(resolvedPath) && fileSystem.isDirectory(resolvedPath);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.is_directory() cannot inspect '${requestedPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        create_directory: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const requestedPath = stringArgument(values[0], 'file.create_directory() path', file, line);
          const parents = values.length >= 2
            ? booleanArgument(values[1], 'file.create_directory() parents', file, line)
            : false;
          if (!fileSystem.createDirectory) {
            throw new IdylliumRuntimeError(file, line, 'file.create_directory() is not supported by this runtime');
          }
          try {
            fileSystem.createDirectory(fileSystem.resolvePath(requestedPath, file), parents);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.create_directory() cannot create '${requestedPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        list_directory: contextFunction((targetPath: string, file: string, line: number) => {
          const requestedPath = stringArgument(targetPath, 'file.list_directory() path', file, line);
          if (!fileSystem.listDirectory) {
            throw new IdylliumRuntimeError(file, line, 'file.list_directory() is not supported by this runtime');
          }
          try {
            const names = fileSystem.listDirectory(fileSystem.resolvePath(requestedPath, file));
            return IdylliumArray.from([...names], true, null, () => '');
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.list_directory() cannot inspect '${requestedPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        copy: contextFunction((sourcePath: string, destinationPath: string, file: string, line: number) => {
          const source = stringArgument(sourcePath, 'file.copy() source', file, line);
          const destination = stringArgument(destinationPath, 'file.copy() destination', file, line);
          if (!fileSystem.copy) {
            throw new IdylliumRuntimeError(file, line, 'file.copy() is not supported by this runtime');
          }
          try {
            fileSystem.copy(
              fileSystem.resolvePath(source, file),
              fileSystem.resolvePath(destination, file),
            );
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.copy() cannot copy '${source}' to '${destination}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        rename: contextFunction((sourcePath: string, destinationPath: string, file: string, line: number) => {
          const source = stringArgument(sourcePath, 'file.rename() source', file, line);
          const destination = stringArgument(destinationPath, 'file.rename() destination', file, line);
          if (!fileSystem.rename) {
            throw new IdylliumRuntimeError(file, line, 'file.rename() is not supported by this runtime');
          }
          try {
            fileSystem.rename(
              fileSystem.resolvePath(source, file),
              fileSystem.resolvePath(destination, file),
            );
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.rename() cannot rename '${source}' to '${destination}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        remove: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const requestedPath = stringArgument(values[0], 'file.remove() path', file, line);
          const recursive = values.length >= 2
            ? booleanArgument(values[1], 'file.remove() recursive', file, line)
            : false;
          if (!fileSystem.remove) {
            throw new IdylliumRuntimeError(file, line, 'file.remove() is not supported by this runtime');
          }
          try {
            fileSystem.remove(fileSystem.resolvePath(requestedPath, file), recursive);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, `file.remove() cannot remove '${requestedPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
        open: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const requestedPath = stringArgument(values[0], 'file.open() path', file, line);
          const openMode = stringArgument(values[1], 'file.open() mode', file, line);
          // Третий аргумент — кодировка файла (1.5.7); без него — UTF-8, строго.
          const encodingSpec = normalizeEncoding(values[2] === undefined ? 'utf-8' : values[2], file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          if (openMode === 'read') return createInputFile(resolvedPath, file, line, encodingSpec);
          if (openMode === 'write') return createOutputFile(resolvedPath, file, line, false, encodingSpec);
          if (openMode === 'append') return createOutputFile(resolvedPath, file, line, true, encodingSpec);
          throw new IdylliumRuntimeError(file, line, `file.open() mode must be 'read', 'write' or 'append', got '${openMode}'`);
        }),
      },
      types: {
        INT8_MIN: -128,
        INT8_MAX: 127,
        UINT8_MAX: 255,
        INT16_MIN: -32768,
        INT16_MAX: 32767,
        UINT16_MAX: 65535,
        INT32_MIN: -2147483648,
        INT32_MAX: 2147483647,
        UINT32_MAX: 4294967295,
        // 64-битные границы — BigInt: обычный int Idyllium хранит их точно.
        INT64_MIN: -9223372036854775808n,
        INT64_MAX: 9223372036854775807n,
        UINT64_MAX: 18446744073709551615n,
        from_bin: contextFunction((bits: string, typeName: string, file: string, line: number) => typesFromBin(bits, typeName, file, line)),
        from_hex: contextFunction((hex: string, typeName: string, file: string, line: number) => typesFromHex(hex, typeName, file, line)),
      },
      http: {
        get: contextFunction(async (address: unknown, file: string, line: number) => (
          httpRequest('GET', address, undefined, 'http.get()', file, line)
        )),
        post: contextFunction(async (address: unknown, body: unknown, file: string, line: number) => {
          const bodyText = stringArgument(body, 'http.post() body', file, line);
          return httpRequest('POST', address, bodyText, 'http.post()', file, line);
        }),
        set_timeout: contextFunction((seconds: unknown, file: string, line: number) => {
          const value = integerNumber(seconds, 'http.set_timeout() seconds', file, line);
          if (value < 1 || value > 300) {
            throw new IdylliumRuntimeError(file, line, `http.set_timeout() expects seconds from 1 to 300, got ${value}`);
          }
          httpTimeoutSeconds = value;
        }),
      },
      url: {
        open: contextFunction(async (address: unknown, file: string, line: number) => {
          const target = urlAddress(address, 'url.open()', file, line);
          const scheme = target.protocol.replace(/:$/u, '');
          // Только http/https: file:// открыл бы локальные файлы, а
          // javascript:/data: исполнили бы посторонний код по клику.
          if (scheme !== 'http' && scheme !== 'https') {
            throw new IdylliumRuntimeError(file, line, `url.open() supports only http and https addresses, got '${scheme}'`);
          }
          const opener = options.urlOpener ?? defaultRuntimeUrlOpener();
          if (!opener) {
            throw new IdylliumRuntimeError(file, line, 'url.open() is not supported by this runtime');
          }
          try {
            await opener.open(target.href);
          } catch (error) {
            throw new IdylliumRuntimeError(file, line, String((error as Error)?.message ?? error));
          }
        }),
        scheme: contextFunction((address: unknown, file: string, line: number) => (
          urlAddress(address, 'url.scheme()', file, line).protocol.replace(/:$/u, '')
        )),
        host: contextFunction((address: unknown, file: string, line: number) => (
          urlAddress(address, 'url.host()', file, line).hostname
        )),
        path: contextFunction((address: unknown, file: string, line: number) => (
          readableUrlPart(urlAddress(address, 'url.path()', file, line).pathname)
        )),
        query: contextFunction((address: unknown, file: string, line: number) => (
          urlAddress(address, 'url.query()', file, line).search.replace(/^\?/u, '')
        )),
        fragment: contextFunction((address: unknown, file: string, line: number) => (
          readableUrlPart(urlAddress(address, 'url.fragment()', file, line).hash.replace(/^#/u, ''))
        )),
        port: contextFunction((address: unknown, file: string, line: number) => {
          const parsed = urlAddress(address, 'url.port()', file, line);
          if (parsed.port !== '') return Number.parseInt(parsed.port, 10);
          // Порт не написан — сообщаем стандартный для протокола, а не 0:
          // так честнее отвечает на вопрос «куда пойдёт запрос».
          if (parsed.protocol === 'https:') return 443;
          if (parsed.protocol === 'http:') return 80;
          return 0;
        }),
        query_value: contextFunction((address: unknown, name: unknown, file: string, line: number) => {
          const parsed = urlAddress(address, 'url.query_value()', file, line);
          const key = stringArgument(name, 'url.query_value() name', file, line);
          return parsed.searchParams.get(key) ?? '';
        }),
        encode: contextFunction((text: unknown, file: string, line: number) => (
          encodeURIComponent(stringArgument(text, 'url.encode() text', file, line))
        )),
        decode: contextFunction((text: unknown, file: string, line: number) => {
          const value = stringArgument(text, 'url.decode() text', file, line);
          try {
            return decodeURIComponent(value);
          } catch {
            throw new IdylliumRuntimeError(file, line, `url.decode() got a broken percent-encoded string: ${JSON.stringify(value)}`);
          }
        }),
        is_valid: contextFunction((address: unknown, file: string, line: number) => {
          const value = stringArgument(address, 'url.is_valid() address', file, line);
          return parseUrlOrNull(value) !== null;
        }),
      },
      hash: {
        crc32: contextFunction((data: unknown, file: string, line: number) => hashCrc32(hashInputBytes(data, 'hash.crc32()', file, line))),
        fnv1a: contextFunction((data: unknown, file: string, line: number) => hashFnv1a(hashInputBytes(data, 'hash.fnv1a()', file, line))),
        adler32: contextFunction((data: unknown, file: string, line: number) => hashAdler32(hashInputBytes(data, 'hash.adler32()', file, line))),
        sha256: contextFunction((data: unknown, file: string, line: number) => hashSha256Hex(hashInputBytes(data, 'hash.sha256()', file, line))),
        sha256_bytes: contextFunction((data: unknown, file: string, line: number) => (
          IdylliumArray.from(hashSha256Bytes(hashInputBytes(data, 'hash.sha256_bytes()', file, line)), true, null, () => 0)
        )),
      },
      qr: createQrModule(runtimeObjects),
      encoding: {
        list_encodings: contextFunction(() => IdylliumArray.from(listEncodingNames(), true, null, () => '')),
        char_to_codepoint: contextFunction((character: string, file: string, line: number) => (
          encodingCharToCodepoint(character, file, line)
        )),
        codepoint_to_char: contextFunction((codepoint: number, file: string, line: number) => (
          encodingCodepointToChar(codepoint, file, line)
        )),
        encode: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const safe = values[2] === undefined ? true : booleanArgument(values[2], 'encoding.encode() safe', file, line);
          return IdylliumArray.from(encodingEncode(values[0], values[1], safe, file, line), true, null, () => 0);
        }),
        decode: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const safe = values[2] === undefined ? true : booleanArgument(values[2], 'encoding.decode() safe', file, line);
          return encodingDecode(values[0], values[1], safe, file, line);
        }),
        is_valid: contextFunction((codes: unknown, encoding: unknown, file: string, line: number) => (
          encodingIsValid(codes, encoding, file, line)
        )),
        convert: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const safe = values[3] === undefined ? true : booleanArgument(values[3], 'encoding.convert() safe', file, line);
          return IdylliumArray.from(encodingConvert(values[0], values[1], values[2], safe, file, line), true, null, () => 0);
        }),
        guess: contextFunction((codes: unknown, file: string, line: number) => encodingGuess(codes, file, line)),
        to_base64: contextFunction((codes: unknown, file: string, line: number) => {
          const array = expectArray(codes, file, line);
          const bytes = array.values().map((code: unknown, index: number) => {
            const value = integerNumber(code, `encoding.to_base64() byte at index ${index}`, file, line);
            return byteRange(value, `encoding.to_base64() byte at index ${index}`, 0, 255, file, line);
          });
          return bytesToBase64(bytes);
        }),
        from_base64: contextFunction((text: unknown, file: string, line: number) => (
          IdylliumArray.from(base64ToBytes(stringArgument(text, 'encoding.from_base64() text', file, line), file, line), true, null, () => 0)
        )),
      },
      json: {
        is_valid: contextFunction((text: unknown, file: string, line: number) => {
          const source = stringArgument(text, 'json.is_valid() text', file, line);
          try {
            new ExactJsonParser(source).parse();
            return true;
          } catch {
            return false;
          }
        }),
        parse: contextFunction((text: unknown, file: string, line: number) => (
          parseJsonValue(stringArgument(text, 'json.parse() text', file, line), file, line)
        )),
        Value: contextFunction((valueOrFile: unknown, fileOrLine: string | number, maybeLine?: number) => {
          if (maybeLine === undefined) {
            return createJsonValue(undefined, valueOrFile as string, fileOrLine as number);
          }
          return createJsonValue(valueOrFile, fileOrLine as string, maybeLine);
        }),
      },
      xml: {
        parse_xml: contextFunction((text: unknown, file: string, line: number) => (
          parseXmlDocument(stringArgument(text, 'xml.parse_xml() text', file, line), false, file, line)
        )),
        parse_html: contextFunction((text: unknown, file: string, line: number) => (
          parseXmlDocument(stringArgument(text, 'xml.parse_html() text', file, line), true, file, line)
        )),
      },
      csv: {
        parse: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const text = stringArgument(values[0], 'csv.parse() text', file, line);
          return parseCsvTable(text, csvParseSeparator(values[1], 'csv.parse()', file, line), 'csv.parse()', file, line);
        }),
        read: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const requestedPath = stringArgument(values[0], 'csv.read() path', file, line);
          const separator = csvParseSeparator(values[1], 'csv.read()', file, line);
          const encodingSpec = normalizeEncoding(values[2] === undefined ? 'utf-8' : values[2], file, line);
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          const shownPath = humanizeFsPaths(resolvedPath);
          let rawBytes: number[];
          try {
            if (!fileSystem.exists(resolvedPath)) {
              throw new IdylliumRuntimeError(file, line, `csv.read() cannot read '${shownPath}': file does not exist`);
            }
            if (!fileSystem.isFile(resolvedPath)) {
              throw new IdylliumRuntimeError(file, line, `csv.read() cannot read '${shownPath}': path is not a file`);
            }
            rawBytes = readFileBytes(resolvedPath);
          } catch (error) {
            if (error instanceof IdylliumRuntimeError) throw error;
            throw new IdylliumRuntimeError(file, line, `csv.read() cannot read '${shownPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
          const text = decodeFileText(rawBytes, encodingSpec, 'csv.read()', shownPath, file, line);
          return parseCsvTable(text, separator, 'csv.read()', file, line);
        }),
        write: contextFunction((...rawArgs: unknown[]) => {
          const { values, file, line } = splitContextArgs(rawArgs);
          const targetPath = values[0];
          const table = values[1];
          const encodingSpec = normalizeEncoding(values[2] === undefined ? 'utf-8' : values[2], file, line);
          const requestedPath = stringArgument(targetPath, 'csv.write() path', file, line);
          if (!isCsvRuntimeTable(table)) {
            throw new IdylliumRuntimeError(file, line, `csv.write() expects a csv.Table, got '${runtimeTypeName(table)}'`);
          }
          const resolvedPath = fileSystem.resolvePath(requestedPath, file);
          const shownPath = humanizeFsPaths(resolvedPath);
          const parent = runtimeDirname(resolvedPath);
          try {
            if (!fileSystem.exists(parent)) {
              throw new IdylliumRuntimeError(file, line, `csv.write() cannot write '${shownPath}': directory does not exist`);
            }
            if (fileSystem.exists(resolvedPath) && !fileSystem.isFile(resolvedPath)) {
              throw new IdylliumRuntimeError(file, line, `csv.write() cannot write '${shownPath}': path is not a file`);
            }
            const csvText = serializeCsvTable(table);
            if (encodingSpec.kind === 'utf-8') {
              fileSystem.writeText(resolvedPath, csvText);
            } else {
              if (!fileSystem.writeBytes) throw new IdylliumRuntimeError(file, line, 'csv.write() requires binary file support in this runtime');
              let bytes: number[];
              try {
                bytes = encodeText(csvText, encodingSpec, true);
              } catch (error) {
                if (!(error instanceof EncodingFailure)) throw error;
                throw new IdylliumRuntimeError(file, line, `csv.write() ${error.message}`);
              }
              fileSystem.writeBytes(resolvedPath, Uint8Array.from(bytes));
            }
          } catch (error) {
            if (error instanceof IdylliumRuntimeError) throw error;
            throw new IdylliumRuntimeError(file, line, `csv.write() cannot write '${shownPath}': ${humanizeFsPaths(errorMessage(error))}`);
          }
        }),
      },
      sqlite: {
        open: contextFunction(async (path: unknown, file: string, line: number) => (
          openSqliteDatabase(path, file, line, runtimeObjects)
        )),
      },
      audio: {},
      image: {},
      gui: {},
      channel: {},
      web: {},
      turtle: createTurtleModule(runtimeObjects),
      colors: {
        RGB: contextFunction((red: number, green: number, blue: number, file: string, line: number) => IdylliumColor.RGB(red, green, blue, file, line)),
        RGBA: contextFunction((red: number, green: number, blue: number, alpha: number, file: string, line: number) => IdylliumColor.RGBA(red, green, blue, alpha, file, line)),
        HEX: contextFunction((value: string, file: string, line: number) => IdylliumColor.HEX(value, file, line)),
        HSL: contextFunction((hue: number, saturation: number, lightness: number, file: string, line: number) => IdylliumColor.HSL(hue, saturation, lightness, file, line)),
        // Именованные цвета — из одной таблицы с справочником и конструктором (color-constants.ts).
        ...Object.fromEntries(COLOR_CONSTANTS.map(([name, red, green, blue, alpha]) => [name, alpha === undefined ? IdylliumColor.RGB(red, green, blue) : IdylliumColor.RGBA(red, green, blue, alpha)])),
      },
    },
    createObject(moduleName: string, typeName: string): Record<string, unknown> {
      throwIfRuntimeStopped('', 0);
      return createPlainRuntimeObject(moduleName, typeName, runtimeObjects);
    },
    // Метка экземпляра класса. Если база (по всей цепочке, в том числе через
    // модули) — виджет, рантайм-тип 'gui.X' НЕПРИКОСНОВЕНЕН: по нему живут
    // рендерер и строгие сверки (радиогруппы, Canvas, Table). Имя класса тогда
    // едет отдельной меткой, её читают type_name() и тексты ошибок.
    tagClassInstance(self: Record<string, unknown>, tag: string): Record<string, unknown> {
      const inherited = self.__idylliumType;
      if (typeof inherited === 'string' && inherited.startsWith('gui.')) {
        self.__idylliumClass = tag;
      } else {
        self.__idylliumType = tag;
      }
      return self;
    },
    convertNullable(moduleName: string, typeName: string, value: unknown, file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      if (moduleName === 'json' && typeName === 'Value') {
        return createJsonValue(value, file, line);
      }
      if (moduleName === 'sqlite' && typeName === 'Value') {
        return createSqliteValue(value, file, line);
      }
      throw new IdylliumRuntimeError(file, line, `type '${moduleName}.${typeName}' does not support null`);
    },
    setProperty(target: unknown, propertyName: string, value: unknown, file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      if (target === null || typeof target !== 'object') {
        throw new IdylliumRuntimeError(file, line, `cannot set property '${propertyName}' on '${runtimeTypeName(target)}'`);
      }

      const obj = target as RuntimeObject;
      const setters = runtimePropertySetters(obj);
      const setter = setters[propertyName];
      if (setter) {
        setter(value, file, line);
        return value;
      }

      // Программная запись is_selected = true у радиокнопки снимает соседей
      // группы — так же, как клик: урок обещает «одна группа по умолчанию»,
      // и рантайм держит слово обоими путями (находка методистов 2026-08-21).
      if (propertyName === 'is_selected' && value === true && obj.__idylliumType === 'gui.RadioButton') {
        selectRadioButton(obj, runtimeObjects);
        return value;
      }

      obj[propertyName] = value;
      return value;
    },
    callModuleFunction(moduleName: string, functionName: string, args: readonly unknown[], file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      const module = (this.modules as Record<string, Record<string, unknown>>)[moduleName];
      if (!module) throw new IdylliumRuntimeError(file, line, `module '${moduleName}' was not found`);
      const fn = module[functionName];
      if (typeof fn !== 'function') {
        throw new IdylliumRuntimeError(file, line, `module '${moduleName}' has no function '${functionName}'`);
      }
      const callable = fn as ContextualRuntimeFunction;
      return callable.__idylliumPassContext ? callable(...args, file, line) : callable(...args);
    },
    callMethod(target: unknown, methodName: string, args: readonly unknown[], file: string, line: number): unknown {
      throwIfRuntimeStopped(file, line);
      if (target instanceof IdylliumArray) {
        return target.callMethod(methodName, args, file, line);
      }

      if (target instanceof IdylliumMap) {
        return target.callMethod(methodName, args, file, line);
      }

      if (target instanceof IdylliumSet) {
        return target.callMethod(methodName, args, file, line);
      }

      if (target instanceof IdylliumColor) {
        return target.callMethod(methodName, args, file, line);
      }

      if (typeof target === 'string') {
        return callStringMethod(target, methodName, args, file, line);
      }

      if (target !== null && typeof target === 'object') {
        const method = (target as Record<string, unknown>)[methodName];
        if (typeof method === 'function') {
          const callable = method as ContextualRuntimeFunction;
          return callable.__idylliumPassContext ? callable.apply(target, [...args, file, line]) : callable.apply(target, [...args]);
        }
      }

      throw new IdylliumRuntimeError(file, line, `object has no method '${methodName}'`);
    },
    getOutput(): string {
      return output;
    },
    /** Текст результата main() (или system.exit()); null — программа ничего не вернула. */
    async getExitText(): Promise<string | null> {
      if (!hasExitValue) return null;
      const text = await formatConsoleValue(exitValue);
      // Строку берём в кавычки: «завершилась с кодом готово» спотыкается,
      // «с кодом "готово"» читается.
      return typeof exitValue === 'string' ? JSON.stringify(exitValue) : text;
    },
    /** Целый код завершения, если он был целым; иначе null. */
    // Предупреждения конца программы (вердикты владельца 2026-08-28):
    // лаконичные, «что случилось», слова переживают машинный перевод.
    collectProgramEndWarnings(): readonly string[] {
      if (runtimeObjects.warningsDisabled) return [];
      const warnings: string[] = [];

      // Счётчики ЖИЗНИ программы, а не снимок windows: close() убирает окно
      // из списка, и по снимку показанное-и-закрытое окно выглядело бы
      // непоказанным, а закрытое непоказанное — несуществующим (улов
      // ломателей 2026-08-28).
      if (runtimeObjects.windowsCreated > 0 && !runtimeObjects.anyWindowEverShown) {
        warnings.push('runtime warning: the program finished without showing a window');
      }

      // Виджет без родителя, не лежащий ни в одном окне. Window/Timer живут
      // своей жизнью; диалоги и холст — тоже не «потерянные кнопки».
      // Если хоть одно окно ПОКАЗАНО, о сиротах молчим: в живом хосте
      // обработчик события может добавить виджет позже, и ложная тревога
      // хуже пропуска (канон владельца).
      if (!runtimeObjects.anyWindowEverShown) {
        const orphanSkip = new Set(['gui.Window', 'gui.Timer', 'gui.Canvas', 'gui.Modal', 'gui.Sender']);
        for (const obj of runtimeObjects.objects) {
          const typeName = typeof obj.__idylliumType === 'string' ? obj.__idylliumType : '';
          if (!typeName.startsWith('gui.') || orphanSkip.has(typeName)) continue;
          if (obj.__parent !== undefined && obj.__parent !== null) continue;
          warnings.push(`runtime warning: a widget ('${typeName}') was created but never added to a window`);
        }
      }

      for (const shownPath of runtimeObjects.openOutputStreams.values()) {
        warnings.push(`runtime warning: file '${shownPath}' was not closed`);
      }

      return warnings;
    },
    getExitCode(): number | null {
      if (!hasExitValue) return null;
      if (typeof exitValue === 'number' && Number.isInteger(exitValue)) return exitValue;
      if (typeof exitValue === 'bigint') return Number(exitValue);
      return null;
    },
    getAudio(): readonly IdylliumAudioSnapshot[] {
      return runtimeObjects.audio.map(audioSnapshot);
    },
    getCanvases(options?: CanvasSnapshotOptions): readonly IdylliumCanvasSnapshot[] {
      return withKnownCanvases(options, () => runtimeObjects.canvases.map(canvasSnapshot));
    },
    getWindows(options?: CanvasSnapshotOptions): readonly IdylliumWindowSnapshot[] {
      return withKnownCanvases(options, () => runtimeObjects.windows.map(windowSnapshot));
    },
    getModals(): readonly IdylliumModalSnapshot[] {
      return runtimeObjects.modals.map(modalSnapshot);
    },
    /** Есть ли открытые почтовые отделения channel.Post — хостам для «программа слушает письма». */
    hasOpenChannels(): boolean {
      return runtimeObjects.channelPosts.some((post) => post.is_open === true);
    },
    hasGui(): boolean {
      // Только ПОКАЗАННЫЕ окна держат программу живой: созданное-но-не-
      // показанное окно раньше уводило Web IDE в вечную GUI-петлю с пустым
      // экраном — и глушило рантайм-варнинг «окно не показано», ради которого
      // всё и затевалось (находка владельца 2026-08-28).
      return runtimeObjects.windows.some((win) => win.__shown === true)
        || runtimeObjects.canvases.some((canvas) => canvasKeepsProgramAlive(canvas))
        || runtimeObjects.modals.length > 0
        || runtimeObjects.audio.some((item) => item.is_playing === true)
        // Открытое почтовое отделение держит программу живой (жанр окна):
        // письма могут прийти в любой момент, пока канал не закрыт.
        || runtimeObjects.channelPosts.some((post) => post.is_open === true);
    },
    async stepGui(deltaTime = 0): Promise<boolean> {
      throwIfRuntimeStopped('', 0);
      let changed = false;
      // Почта доставляется первой: письма ждали дольше всех.
      while (runtimeObjects.channelMailbox.length > 0) {
        const mail = runtimeObjects.channelMailbox.shift();
        if (!mail) break;
        const handler = mail.post.on_message;
        if (mail.post.is_open === true && typeof handler === 'function') {
          await handler(mail.text);
          changed = true;
        }
      }
      for (const timer of runtimeObjects.timers) {
        if (await stepGuiTimer(timer, deltaTime)) changed = true;
      }

      for (const canvas of runtimeObjects.canvases) {
        const onUpdate = canvas.on_update;
        if (typeof onUpdate === 'function') {
          // Кадр ничего не стирает сам: рисунок копится, очищают clear()/fill() (1.6.1).
          await onUpdate(canvas, deltaTime);
          changed = true;
        }
      }
      return changed;
    },
    async dispatchGuiEvent(canvasId: number, eventName: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
      throwIfRuntimeStopped('', 0);
      const target = runtimeObjects.objects.find((item) => item.__idylliumObjectId === canvasId);
      if (!target) return;
      // Выключенный или скрытый виджет не принимает событий — как и содержимое
      // выключенного/скрытого контейнера (учебник и справочник обещают каскад).
      // Рендерер блокирует это на экране; здесь — вторая линия обороны на
      // случай гонки «клик пришёл в тот же момент, когда программа выключила
      // виджет».
      if (widgetEventsBlocked(target)) return;

      const deselectedRadios = target.__idylliumType === 'gui.RadioButton' && eventName === 'change'
        ? runtimeObjects.objects.filter((item) => (
          item !== target && item.__idylliumType === 'gui.RadioButton' && item.is_selected === true
        ))
        : [];

      applyGuiEventPayload(target, eventName, payload, runtimeObjects);
      if (target.__idylliumType === 'gui.Window' && eventName === 'window_close') {
        // Крестик закрывает СВОЁ окно, как в настоящих ОС, — но сначала
        // спрашивает on_close: обработчик, вернувший false, оставляет окно
        // открытым («сохранить перед выходом?»). close() из кода обработчик
        // не зовёт: программа уже всё решила сама — и может закрыть окно из
        // ответа на свой же вопрос. Программа живёт, пока показано хоть одно
        // окно: завершение с последним обеспечивает hasGui().
        const onClose = target.on_close;
        const verdict = typeof onClose === 'function' ? await onClose(target) : true;
        if (verdict !== false && typeof target.close === 'function') target.close();
        return;
      }
      const callbackName = guiCallbackName(target, eventName);
      if (callbackName) {
        const callback = target[callbackName];
        if (typeof callback === 'function') {
          if (target.__idylliumType === 'gui.Canvas') {
            await callback(target, guiEventObject(eventName, payload));
            return;
          }
          await callback(target);
        }
      }

      // Выбор радиокнопки снимает выбор с соседей по группе — их on_change
      // тоже должен сработать (с is_selected == false).
      for (const sibling of deselectedRadios) {
        if (sibling.is_selected !== false) continue;
        const siblingCallback = sibling.on_change;
        if (typeof siblingCallback === 'function') await siblingCallback(sibling);
      }
    },
  };

  // ─── Библиотека http (1.4.0): клиент поверх RuntimeNetworkService ───────

  async function httpRequest(
    method: 'GET' | 'POST',
    address: unknown,
    body: string | undefined,
    methodName: string,
    file: string,
    line: number,
  ): Promise<Record<string, unknown>> {
    const target = urlAddress(address, methodName, file, line);
    const scheme = target.protocol.replace(/:$/u, '');
    if (scheme !== 'http' && scheme !== 'https') {
      throw new IdylliumRuntimeError(file, line, `${methodName} supports only http and https addresses, got '${scheme}'`);
    }
    const service = runtimeObjects.networkService;
    if (!service) {
      throw new IdylliumRuntimeError(file, line, `${methodName} is not supported by this runtime`);
    }
    const request: RuntimeNetworkRequest = {
      method,
      url: target.href,
      headers: method === 'POST' ? { 'content-type': 'text/plain; charset=utf-8' } : undefined,
      body,
      timeoutMs: httpTimeoutSeconds * 1000,
    };
    try {
      const response = await service.fetch(request);
      return createHttpResponse(response.status, response.headers, response.text);
    } catch (error) {
      if (error instanceof RuntimeNetworkError) {
        if (error.kind === 'timeout') {
          throw new IdylliumRuntimeError(file, line, `${methodName} timed out after ${httpTimeoutSeconds} seconds for '${target.href}'`);
        }
        if (error.kind === 'blocked') {
          throw new IdylliumRuntimeError(file, line, `${methodName} was blocked by the browser for '${target.href}': the site does not allow browser requests (CORS) — this address works in console runs`);
        }
        throw new IdylliumRuntimeError(file, line, `${methodName} cannot reach '${target.href}': ${error.message}`);
      }
      throw new IdylliumRuntimeError(file, line, `${methodName} cannot reach '${target.href}': ${String((error as Error)?.message ?? error)}`);
    }
  }

  function createHttpResponse(
    status: number,
    headers: Readonly<Record<string, string>>,
    text: string,
  ): Record<string, unknown> {
    const response: Record<string, unknown> = {
      __idylliumType: 'http.Response',
      status,
      ok: status >= 200 && status <= 299,
      text,
      header: contextFunction((name: unknown, file: string, line: number) => {
        const key = stringArgument(name, 'Response.header() name', file, line).toLowerCase();
        return headers[key] ?? '';
      }),
      to_string: () => `http.Response(status: ${status})`,
    };
    return response;
  }

  // Засеянный поток — mulberry32 (как и одноимённая учебная функция): его
  // скрамблер размешивает сид с ПЕРВОГО же вызова. Прежний голый LCG делал
  // первый бросок линейной функцией сида (шаг 1664525/2^32 ≈ 0.000388):
  // create_int(1,6) давал 2 для всех сидов 0–250, а set_seed(time.now().unix)
  // между запусками почти не менял грань — находка методистов 2026-08-22.
  function seededRandomStep(): number {
    randomSeed = ((randomSeed as number) + 0x6D2B79F5) >>> 0;
    let t = randomSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  function randomUnit(): number {
    if (randomSeed === null) return Math.random();
    return seededRandomStep() / 0x100000000;
  }

  // Для create_float: единичный интервал ВКЛЮЧАЯ 1.0, чтобы max был достижим
  // (как в Python). Нельзя делить с create_int: там unit 1.0 дал бы выход за max.
  function randomUnitInclusive(): number {
    if (randomSeed === null) return Math.floor(Math.random() * 0x100000000) / 0xffffffff;
    return seededRandomStep() / 0xffffffff;
  }

  function waitForRuntimeDelay(milliseconds: number, file: string, line: number): Promise<void> {
    const signal = options.abortSignal;
    if (!signal) return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    if (signal.aborted) return Promise.reject(runtimeStoppedError(file, line));

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const cleanup = () => {
        if (timer !== null) clearTimeout(timer);
        signal.removeEventListener?.('abort', onAbort);
      };
      const settle = (error?: IdylliumRuntimeError) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve();
      };
      const onAbort = () => settle(runtimeStoppedError(file, line));

      timer = setTimeout(() => settle(), milliseconds);
      signal.addEventListener?.('abort', onAbort, { once: true });
    });
  }

  function throwIfRuntimeStopped(file: string, line: number): void {
    if (options.abortSignal?.aborted) throw runtimeStoppedError(file, line);
  }

  function runtimeStoppedError(file: string, line: number): IdylliumRuntimeError {
    return new IdylliumRuntimeError(file || 'main.idyl', line || 1, 'program was stopped', 'cancelled');
  }
}


/** Массив с комплексными числами: сумма как math.Complex (вещественные соседи входят как z с нулевой мнимой частью); null — чисел-комплексов нет. */
function complexSum(value: unknown, functionName: string, file: string, line: number): IdylliumComplex | null {
  const values = expectArray(value, file, line).values();
  if (!values.some((item) => item instanceof IdylliumComplex)) return null;
  if (values.length === 0) {
    throw new IdylliumRuntimeError(file, line, `'${functionName}' cannot be used with an empty array`);
  }
  let total = new IdylliumComplex(0, 0);
  for (const item of values) total = total.plus(item, file, line);
  return total;
}

function numericValues(value: unknown, functionName: string, file: string, line: number): Array<number | bigint> {
  const array = expectArray(value, file, line);
  const values = array.values();
  if (values.length === 0) {
    throw new IdylliumRuntimeError(file, line, `'${functionName}' cannot be used with an empty array`);
  }

  for (const item of values) {
    if (typeof item !== 'number' && typeof item !== 'bigint') {
      throw new IdylliumRuntimeError(file, line, `'${functionName}' expects a numeric array`);
    }
  }

  return values as Array<number | bigint>;
}



// mode 'float' приходит из кодогена, когда СТАТИЧЕСКИЙ тип результата — float:
// рантайм по значениям не отличит «float, ставший целым» от int, а точное
// BigInt-повышение — привилегия int; float живёт строго в double и на
// переполнении честно падает (находка методистов 2026-08-29: a = a * 10.0
// в цикле печатал 401-значную «простыню» вместо ошибки диапазона).
function runtimeBinary(operator: string, left: unknown, right: unknown, file: string, line: number, mode?: 'float'): unknown {
  if (operator === '==') return runtimeEquals(left, right, file, line);
  if (operator === '!=') return !runtimeEquals(left, right, file, line);

  // Порядок моментов времени: штампы сравниваются по instantMs, пояс не участвует.
  if (left instanceof IdylliumTimeStamp && right instanceof IdylliumTimeStamp
    && ['<', '<=', '>', '>='].includes(operator)) {
    if (operator === '<') return left.instantMs < right.instantMs;
    if (operator === '<=') return left.instantMs <= right.instantMs;
    if (operator === '>') return left.instantMs > right.instantMs;
    return left.instantMs >= right.instantMs;
  }

  if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
    return `${String(left)}${String(right)}`;
  }

  const numericLeft = runtimeNumber(left, `operator '${operator}' left operand`, file, line);
  const numericRight = runtimeNumber(right, `operator '${operator}' right operand`, file, line);
  // Результат-число обязан быть конечным: молчаливый Infinity отравлял бы
  // соседние строки и печатался сырым JS-словом (находка ломателей).
  const finiteResult = (value: number | bigint): number | bigint => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new IdylliumRuntimeError(file, line, `operator '${operator}' result is outside the float range`);
    }
    return value;
  };
  switch (operator) {
    case '+':
      return finiteResult(runtimeAdd(numericLeft, numericRight, mode));
    case '-':
      return finiteResult(runtimeSubtract(numericLeft, numericRight, mode));
    case '*':
      return finiteResult(runtimeMultiply(numericLeft, numericRight, mode));
    case '/':
      return finiteResult(runtimeDivide(numericLeft, numericRight, file, line));
    case '<':
      return runtimeCompare(numericLeft, numericRight) < 0;
    case '<=':
      return runtimeCompare(numericLeft, numericRight) <= 0;
    case '>':
      return runtimeCompare(numericLeft, numericRight) > 0;
    case '>=':
      return runtimeCompare(numericLeft, numericRight) >= 0;
    default:
      throw new IdylliumRuntimeError(file, line, `unknown binary operator '${operator}'`);
  }
}

function runtimeNegate(value: unknown): number | bigint {
  return typeof value === 'bigint' ? -value : -(value as number);
}

function runtimeAdd(left: number | bigint, right: number | bigint, mode?: 'float'): number | bigint {
  if (mode === 'float') return Number(left) + Number(right);
  const integers = exactIntegerPair(left, right);
  if (integers) return exactIntegerResult(integers[0] + integers[1]);
  const raw = Number(left) + Number(right);
  if (integerPrecisionLost(left, right, raw)) {
    return exactIntegerResult(BigInt(left as number) + BigInt(right as number));
  }
  return raw;
}

// Целочисленный результат за пределами 2^53 пересчитывается через BigInt:
// int обязан оставаться точным, а double тут молча врёт в младших разрядах.
function integerPrecisionLost(left: number | bigint, right: number | bigint, raw: number): boolean {
  return typeof left === 'number' && typeof right === 'number'
    && Number.isInteger(left) && Number.isInteger(right)
    && !Number.isSafeInteger(raw);
}


function runtimeSubtract(left: number | bigint, right: number | bigint, mode?: 'float'): number | bigint {
  if (mode === 'float') return Number(left) - Number(right);
  const integers = exactIntegerPair(left, right);
  if (integers) return exactIntegerResult(integers[0] - integers[1]);
  const raw = Number(left) - Number(right);
  if (integerPrecisionLost(left, right, raw)) {
    return exactIntegerResult(BigInt(left as number) - BigInt(right as number));
  }
  return raw;
}

function runtimeMultiply(left: number | bigint, right: number | bigint, mode?: 'float'): number | bigint {
  if (mode === 'float') return Number(left) * Number(right);
  const integers = exactIntegerPair(left, right);
  if (integers) return exactIntegerResult(integers[0] * integers[1]);
  const raw = Number(left) * Number(right);
  if (integerPrecisionLost(left, right, raw)) {
    return exactIntegerResult(BigInt(left as number) * BigInt(right as number));
  }
  return raw;
}

function runtimeDivide(left: unknown, right: unknown, file: string, line: number): number {
  const dividend = runtimeNumber(left, 'division left operand', file, line);
  const divisor = runtimeNumber(right, 'division right operand', file, line);
  if (divisor === 0 || divisor === 0n) throw new IdylliumRuntimeError(file, line, 'division by zero');
  const result = Number(dividend) / Number(divisor);
  // Молчаливый Infinity отравлял бы соседние строки и печатался сырым
  // JS-словом — честная ошибка на месте (находка ломателей 2026-08-22).
  if (!Number.isFinite(result)) {
    throw new IdylliumRuntimeError(file, line, "operator '/' result is outside the float range");
  }
  return result;
}

function runtimeIntegerDivision(left: unknown, right: unknown, file: string, line: number): number | bigint {
  const dividend = runtimeNumber(left, 'div() left operand', file, line);
  const divisor = runtimeNumber(right, 'div() right operand', file, line);
  if (divisor === 0 || divisor === 0n) throw new IdylliumRuntimeError(file, line, 'division by zero');
  const integers = exactIntegerPair(dividend, divisor);
  // Деление с округлением ВНИЗ (1.6.1), а не к нулю: div(-7, 2) = -4. Пара к
  // mod() ниже — вместе они держат a == div(a, b) * b + mod(a, b).
  if (integers) {
    const quotient = integers[0] / integers[1];
    const remainder = integers[0] % integers[1];
    return remainder !== 0n && (remainder < 0n) !== (integers[1] < 0n) ? quotient - 1n : quotient;
  }
  return Math.floor(Number(dividend) / Number(divisor));
}

function runtimeModulo(left: unknown, right: unknown, file: string, line: number): number | bigint {
  const dividend = runtimeNumber(left, 'mod() left operand', file, line);
  const divisor = runtimeNumber(right, 'mod() right operand', file, line);
  if (divisor === 0 || divisor === 0n) throw new IdylliumRuntimeError(file, line, 'division by zero');
  const integers = exactIntegerPair(dividend, divisor);
  // Остаток со знаком ДЕЛИТЕЛЯ (1.6.1): при положительном делителе он никогда
  // не отрицателен — mod(-3, 360) = 357, mod(-3, 2) = 1. Так считают Python и
  // школьная математика; «как в C» (знак делимого) ломало и углы, и индексы по
  // кругу, и проверку чётности отрицательных.
  if (integers) {
    const remainder = integers[0] % integers[1];
    return remainder !== 0n && (remainder < 0n) !== (integers[1] < 0n) ? remainder + integers[1] : remainder;
  }
  const remainder = Number(dividend) % Number(divisor);
  return remainder !== 0 && (remainder < 0) !== (Number(divisor) < 0) ? remainder + Number(divisor) : remainder;
}

function runtimeCompare(left: number | bigint, right: number | bigint): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function runtimeEquals(left: unknown, right: unknown, file = 'program', line = 0): boolean {
  const leftIsNull = left === null || isRuntimeNullValue(left);
  const rightIsNull = right === null || isRuntimeNullValue(right);
  if (leftIsNull || rightIsNull) return leftIsNull && rightIsNull;

  // Комплексные — значения: равенство по частям; вещественное входит как z с нулевой мнимой частью.
  if (left instanceof IdylliumComplex) return left.equals(right);
  if (right instanceof IdylliumComplex) return right.equals(left);

  if (left instanceof IdylliumColor || right instanceof IdylliumColor) {
    if (!(left instanceof IdylliumColor) || !(right instanceof IdylliumColor)) return false;
    return left.red === right.red
      && left.green === right.green
      && left.blue === right.blue
      && left.alpha === right.alpha;
  }

  // Штампы времени — значения: равенство по моменту, пояс не участвует
  // («момент один — представления разные», урок о часовых поясах).
  if (left instanceof IdylliumTimeStamp || right instanceof IdylliumTimeStamp) {
    if (!(left instanceof IdylliumTimeStamp) || !(right instanceof IdylliumTimeStamp)) return false;
    return left.instantMs === right.instantMs;
  }

  // JSON-значения — значения: данные сравниваются по содержимому (рекурсивно).
  if (isJsonRuntimeValue(left) || isJsonRuntimeValue(right)) {
    if (!isJsonRuntimeValue(left) || !isJsonRuntimeValue(right)) return false;
    return jsonRuntimeValueEquals(left, right, file, line, new Set());
  }

  // SQL-значения — значения: род + содержимое (integer и real — численно, как в SQL).
  if (isSqliteRuntimeValue(left) || isSqliteRuntimeValue(right)) {
    if (!isSqliteRuntimeValue(left) || !isSqliteRuntimeValue(right)) return false;
    return sqliteRuntimeValueEquals(left, right);
  }

  if (left instanceof IdylliumArray || right instanceof IdylliumArray) {
    if (!(left instanceof IdylliumArray) || !(right instanceof IdylliumArray)) return false;
    const leftValues = left.values();
    const rightValues = right.values();
    return leftValues.length === rightValues.length
      && leftValues.every((value, index) => runtimeEquals(value, rightValues[index], file, line));
  }
  if (left instanceof IdylliumSet || right instanceof IdylliumSet) {
    if (!(left instanceof IdylliumSet) || !(right instanceof IdylliumSet)) return false;
    return left.length === right.length && left.items().every((item) => right.has(item));
  }
  if (left instanceof IdylliumMap || right instanceof IdylliumMap) {
    if (!(left instanceof IdylliumMap) || !(right instanceof IdylliumMap)) return false;
    if (left.length !== right.length) return false;
    return left.entriesList().every((entry) => right.has(entry.key)
      && runtimeEquals(entry.value, right.getOr(entry.key, undefined), file, line));
  }
  if (typeof left === 'bigint' && typeof right === 'number' && Number.isInteger(right)) {
    return left === BigInt(right);
  }
  if (typeof right === 'bigint' && typeof left === 'number' && Number.isInteger(left)) {
    return BigInt(left) === right;
  }
  return Object.is(left, right) || left === right;
}

function numericJsonEquals(left: unknown, right: unknown): boolean {
  if (typeof left === 'bigint' || typeof right === 'bigint') {
    const l = typeof left === 'bigint' ? left : Number.isInteger(left as number) ? BigInt(left as number) : null;
    const r = typeof right === 'bigint' ? right : Number.isInteger(right as number) ? BigInt(right as number) : null;
    if (l !== null && r !== null) return l === r;
    return Number(left) === Number(right);
  }
  return Number(left) === Number(right);
}

/** Содержимое-равенство JSON-значений; цикл — честная ошибка (жанр to_json). */
function jsonRuntimeValueEquals(
  left: JsonRuntimeValue,
  right: JsonRuntimeValue,
  file: string,
  line: number,
  visiting: Set<JsonRuntimeValue>,
): boolean {
  if (left === right) return true;
  if (visiting.has(left) || visiting.has(right)) {
    throw new IdylliumRuntimeError(file, line, 'cannot compare cyclic JSON value');
  }
  const leftKind = left.__jsonKind;
  const rightKind = right.__jsonKind;
  if (leftKind === 'int' || leftKind === 'float') {
    if (rightKind !== 'int' && rightKind !== 'float') return false;
    return numericJsonEquals(left.__jsonValue, right.__jsonValue);
  }
  if (leftKind !== rightKind) return false;
  if (leftKind === 'string' || leftKind === 'bool') {
    return left.__jsonValue === right.__jsonValue;
  }
  if (leftKind === 'null') return true;
  visiting.add(left);
  visiting.add(right);
  try {
    if (leftKind === 'object') {
      const leftEntries = left.__jsonEntries ?? new Map<string, JsonRuntimeValue>();
      const rightEntries = right.__jsonEntries ?? new Map<string, JsonRuntimeValue>();
      if (leftEntries.size !== rightEntries.size) return false;
      for (const [key, value] of leftEntries) {
        const other = rightEntries.get(key);
        if (!other || !jsonRuntimeValueEquals(value, other, file, line, visiting)) return false;
      }
      return true;
    }
    const leftItems = left.__jsonItems ?? [];
    const rightItems = right.__jsonItems ?? [];
    if (leftItems.length !== rightItems.length) return false;
    return leftItems.every((value, index) => jsonRuntimeValueEquals(value, rightItems[index], file, line, visiting));
  } finally {
    visiting.delete(left);
    visiting.delete(right);
  }
}

/** Структурное сравнение массивов объектов: ячейки — через контракт equals. */
async function equalsArrayCellsWith(
  left: IdylliumArray,
  right: IdylliumArray,
  slot: string,
  file: string,
  line: number,
): Promise<boolean> {
  const leftValues = left.values();
  const rightValues = right.values();
  if (leftValues.length !== rightValues.length) return false;
  for (let index = 0; index < leftValues.length; index += 1) {
    if (!(await equalsCellWith(leftValues[index], rightValues[index], slot, file, line))) return false;
  }
  return true;
}

/** Словари с объектами-значениями: по содержимому, без учёта порядка,
 *  значения — через контракт equals (жанр equalsArrayCellsWith). */
async function equalsMapEntriesWith(
  left: IdylliumMap,
  right: IdylliumMap,
  slot: string,
  file: string,
  line: number,
): Promise<boolean> {
  if (left.length !== right.length) return false;
  for (const entry of left.entriesList()) {
    if (!right.has(entry.key)) return false;
    if (!(await equalsCellWith(entry.value, right.getOr(entry.key, undefined), slot, file, line))) return false;
  }
  return true;
}

/** Одна ячейка коллекции: вложенная коллекция — рекурсивно, объект — контрактом. */
async function equalsCellWith(leftItem: unknown, rightItem: unknown, slot: string, file: string, line: number): Promise<boolean> {
  if (leftItem instanceof IdylliumArray || rightItem instanceof IdylliumArray) {
    if (!(leftItem instanceof IdylliumArray) || !(rightItem instanceof IdylliumArray)) return false;
    return equalsArrayCellsWith(leftItem, rightItem, slot, file, line);
  }
  if (leftItem instanceof IdylliumMap || rightItem instanceof IdylliumMap) {
    if (!(leftItem instanceof IdylliumMap) || !(rightItem instanceof IdylliumMap)) return false;
    return equalsMapEntriesWith(leftItem, rightItem, slot, file, line);
  }
  const contract = (leftItem as Record<string, unknown> | null)?.[slot];
  if (typeof contract !== 'function') {
    throw new IdylliumRuntimeError(file, line, "comparison found an object without the 'equals' contract");
  }
  return (await (contract as (other: unknown) => Promise<unknown>)(rightItem)) === true;
}

function sqliteRuntimeValueEquals(left: SqliteRuntimeValueObject, right: SqliteRuntimeValueObject): boolean {
  const leftKind = left.__sqliteKind;
  const rightKind = right.__sqliteKind;
  if (leftKind === 'integer' || leftKind === 'real') {
    if (rightKind !== 'integer' && rightKind !== 'real') return false;
    return numericJsonEquals(left.__sqliteValue, right.__sqliteValue);
  }
  if (leftKind !== rightKind) return false;
  if (leftKind === 'blob') {
    const leftBytes = left.__sqliteValue as Uint8Array;
    const rightBytes = right.__sqliteValue as Uint8Array;
    return leftBytes.length === rightBytes.length
      && leftBytes.every((byte, index) => byte === rightBytes[index]);
  }
  return left.__sqliteValue === right.__sqliteValue;
}


function exactIntegerPair(left: number | bigint, right: number | bigint): readonly [bigint, bigint] | null {
  if (typeof left !== 'bigint' && typeof right !== 'bigint') return null;
  if (typeof left === 'number' && !Number.isInteger(left)) return null;
  if (typeof right === 'number' && !Number.isInteger(right)) return null;
  return [BigInt(left), BigInt(right)];
}

// Инъекция операций в классы-значения (см. ValueOperations в runtime-values):
// сами функции ниже знают про json и sqlite, напрямую из values их не
// импортировать — получился бы цикл модулей.
function isRuntimeNullValue(value: unknown): boolean {
  return (isJsonRuntimeValue(value) && value.__jsonKind === 'null')
    || (isSqliteRuntimeValue(value) && value.__sqliteKind === 'null');
}

registerValueOperations({
  equals: runtimeEquals,
  compare: runtimeCompare,
  inspect: formatForInspect,
  typeName: runtimeTypeName,
  isNull: isRuntimeNullValue,
});


function runtimeNumber(value: unknown, argumentName: string, file: string, line: number): number | bigint {
  if (typeof value === 'bigint') return value;
  return finiteNumber(value, argumentName, file, line);
}

function callStringMethod(
  value: string,
  methodName: string,
  args: readonly unknown[],
  file: string,
  line: number,
): unknown {
  switch (methodName) {
    case 'length':
      return Array.from(value).length;
    case 'contains':
      return findInString(value, searchText(args[0], methodName, file, line)) >= 0;
    case 'find':
      return findInString(value, searchText(args[0], methodName, file, line));
    case 'count':
      return countInString(value, searchText(args[0], methodName, file, line));
    case 'is_int':
      return INT_TEXT_PATTERN.test(value.trim());
    case 'is_float':
      return FLOAT_TEXT_PATTERN.test(value.trim());
    case 'to_upper':
      return value.toLocaleUpperCase();
    case 'to_lower':
      return value.toLocaleLowerCase();
    case 'substring':
      return substringByCharacters(
        value,
        intArgument(args[0], 'substring start', file, line),
        intArgument(args[1], 'substring length', file, line),
        file,
        line,
      );
    case 'replace':
      return replaceAllText(
        value,
        stringArgument(args[0], 'replace old_text', file, line),
        stringArgument(args[1], 'replace new_text', file, line),
        file,
        line,
      );
    case 'split':
      return splitString(value, stringArgument(args[0], 'split separator', file, line));
    case 'trim':
      return value.trim();
    default:
      throw new IdylliumRuntimeError(file, line, `type 'string' has no method '${methodName}'`);
  }
}

function stringCharAt(value: string, rawIndex: unknown, file: string, line: number): string {
  const chars = Array.from(value);
  const index = integerNumber(rawIndex, 'string index', file, line);
  if (index < 0 || index >= chars.length) {
    throw new IdylliumRuntimeError(file, line, `string index ${index} out of bounds (length ${chars.length}, valid indices ${validRange(chars.length)})`);
  }
  return chars[index];
}

function searchText(value: unknown, methodName: string, file: string, line: number): string {
  if (typeof value === 'string') return value;
  throw new IdylliumRuntimeError(file, line, `string method '${methodName}' expects string or char`);
}




























function findInString(value: string, needle: string): number {
  const chars = Array.from(value);
  const needleChars = Array.from(needle);
  if (needleChars.length === 0) return 0;

  for (let i = 0; i <= chars.length - needleChars.length; i++) {
    if (needleChars.every((char, offset) => chars[i + offset] === char)) {
      return i;
    }
  }

  return -1;
}

function countInString(value: string, needle: string): number {
  const chars = Array.from(value);
  const needleChars = Array.from(needle);
  if (needleChars.length === 0) return 0;

  let count = 0;
  let index = 0;
  while (index <= chars.length - needleChars.length) {
    if (needleChars.every((char, offset) => chars[index + offset] === char)) {
      count++;
      index += needleChars.length;
    } else {
      index++;
    }
  }
  return count;
}

function substringByCharacters(value: string, start: number, length: number, file: string, line: number): string {
  const chars = Array.from(value);
  if (start < 0) {
    throw new IdylliumRuntimeError(file, line, `substring start must be non-negative, got ${start}`);
  }
  if (length < 0) {
    throw new IdylliumRuntimeError(file, line, `substring length must be non-negative, got ${length}`);
  }
  if (start > chars.length) {
    throw new IdylliumRuntimeError(file, line, `substring start ${start} out of bounds (length ${chars.length}, valid indices ${validRange(chars.length)})`);
  }
  return chars.slice(start, start + length).join('');
}

function replaceAllText(value: string, oldText: string, newText: string, file: string, line: number): string {
  if (oldText.length === 0) {
    throw new IdylliumRuntimeError(file, line, 'replace old_text must not be empty');
  }
  return value.split(oldText).join(newText);
}

function splitString(value: string, separator: string): IdylliumArray {
  const parts = separator.length === 0 ? Array.from(value) : value.split(separator);
  return IdylliumArray.from(parts, true, null, () => '');
}


function parseUrlOrNull(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

// Путь и якорь читает человек, поэтому проценты разворачиваем обратно в
// буквы: /wiki/%D0%98... снова становится /wiki/Идиллия. Строка запроса
// остаётся сырой — её разбирает query_value.
function readableUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function urlAddress(address: unknown, functionName: string, file: string, line: number): URL {
  const value = stringArgument(address, `${functionName} address`, file, line);
  const parsed = parseUrlOrNull(value);
  if (!parsed) {
    throw new IdylliumRuntimeError(file, line, `${functionName} got an address it cannot understand: ${JSON.stringify(value)}`);
  }
  return parsed;
}

// Вход хеш-функций: строка (берём её UTF-8-байты) или массив байтов 0..255.
function hashInputBytes(data: unknown, functionName: string, file: string, line: number): number[] {
  if (typeof data === 'string') return [...nodeBuffer.from(data, 'utf8')];
  if (data instanceof IdylliumArray) {
    return data.values().map((value, index) => {
      const byte = integerNumber(value, `${functionName} byte at index ${index}`, file, line);
      return byteRange(byte, `${functionName} byte at index ${index}`, 0, 255, file, line);
    });
  }
  throw new IdylliumRuntimeError(
    file,
    line,
    `${functionName} expects a string or a byte array, got '${runtimeTypeName(data)}'`,
  );
}









































function roundWithPrecision(value: number, digits: number | undefined, file: string, line: number): number {
  const number = finiteNumber(value, 'math.round() value', file, line);
  if (digits === undefined) return Math.round(number);
  const safeDigits = precisionDigits(digits, 'math.round() digits', file, line);
  const factor = 10 ** safeDigits;
  return Number((Math.round(number * factor) / factor).toFixed(safeDigits));
}

function floorWithPrecision(value: number, digits: number | undefined, file: string, line: number): number {
  const number = finiteNumber(value, 'math.floor() value', file, line);
  if (digits === undefined) return Math.floor(number);
  const safeDigits = precisionDigits(digits, 'math.floor() digits', file, line);
  const factor = 10 ** safeDigits;
  return Number((Math.floor(number * factor) / factor).toFixed(safeDigits));
}

function ceilWithPrecision(value: number, digits: number | undefined, file: string, line: number): number {
  const number = finiteNumber(value, 'math.ceil() value', file, line);
  if (digits === undefined) return Math.ceil(number);
  const safeDigits = precisionDigits(digits, 'math.ceil() digits', file, line);
  const factor = 10 ** safeDigits;
  return Number((Math.ceil(number * factor) / factor).toFixed(safeDigits));
}

// Контракт стражей: "x".is_int()/"x".is_float() истинны РОВНО тогда, когда
// to_int(x)/to_float(x) сработают — поэтому предикаты общие с парсерами.
const INT_TEXT_PATTERN = /^[+-]?\d+$/u;
const FLOAT_TEXT_PATTERN = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))$/u;

function parseIntegerText(value: string, functionName: string, file: string, line: number): number | bigint {
  const normalized = value.trim();
  if (!INT_TEXT_PATTERN.test(normalized)) {
    throw new IdylliumRuntimeError(file, line, `${functionName} cannot convert '${value}' to int`);
  }
  // int точен на любом размере (канон 2026-08-22): длинная строка парсится
  // через BigInt — Number.parseInt терял бы младшие разряды молча.
  // (BigInt не признаёт ведущий '+', паттерн его разрешает — срезаем.)
  return exactIntegerResult(BigInt(normalized.replace(/^\+/u, '')));
}

function parseFloatText(value: string, functionName: string, file: string, line: number): number {
  const normalized = value.trim();
  if (!FLOAT_TEXT_PATTERN.test(normalized)) {
    throw new IdylliumRuntimeError(file, line, `${functionName} cannot convert '${value}' to float`);
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    throw new IdylliumRuntimeError(file, line, `${functionName} cannot convert '${value}' to float: the value is outside the float range`);
  }
  return parsed;
}







function bigAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bigGcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a);
  let y = bigAbs(b);
  while (y !== 0n) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x;
}

function bigModPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

// Детерминированный Миллер — Рабин: с этими двенадцатью основаниями ответ
// ТОЧЕН для всех n < 3 317 044 064 679 887 385 961 981 (Sorenson & Webster,
// 2015). Выше — честный отказ, а не «скорее всего простое».
const IS_PRIME_WITNESSES: readonly bigint[] = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
const IS_PRIME_EXACT_LIMIT = 3317044064679887385961980n;

function bigIsPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const witness of IS_PRIME_WITNESSES) {
    if (n === witness) return true;
    if (n % witness === 0n) return false;
  }
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r += 1n;
  }
  witnessLoop: for (const witness of IS_PRIME_WITNESSES) {
    let x = bigModPow(witness, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1n; i < r; i += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) continue witnessLoop;
    }
    return false;
  }
  return true;
}

function finiteMathResult(value: number, functionName: string, file: string, line: number): number {
  if (Number.isFinite(value)) return value;
  throw new IdylliumRuntimeError(file, line, `${functionName} result is not a finite number`);
}


// Арифметика языка бесконечность не производит (переполнение — ошибка),
// но ячейки библиотеки types живут по машинным правилам и могут держать
// IEEE-бесконечность или NaN (сдвиг битов, каст гиганта). Печать говорит
// словами C-мира — 'inf'/'-inf'/'nan', а не сырым JS-«Infinity»
// (хвост float-канона, 2026-08-29).
function nonFiniteWord(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  return value > 0 ? 'inf' : '-inf';
}

function formatForConsole(value: unknown, precision: number | null): string {
  if (value instanceof IdylliumArray) return value.toInspectString();
  if (value instanceof IdylliumMap) return value.toInspectString();
  if (value instanceof IdylliumSet) return value.toInspectString();
  if (isJsonRuntimeValue(value)) return jsonSerialize(value, 0, 'json', 0);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && !Number.isFinite(value)) return nonFiniteWord(value);
  if (typeof value === 'number' && precision !== null) {
    const rounded = Number(value.toFixed(precision));
    // Ненулевое число, округлившееся в 0 (например 3e-36 при точности 8),
    // показываем научной записью — иначе оно стало бы непечатаемым.
    if (rounded === 0 && value !== 0) return String(value);
    return rounded.toString();
  }
  return String(value);
}

function formatForInspect(value: unknown): string {
  if (value instanceof IdylliumArray) return value.toInspectString();
  if (value instanceof IdylliumMap) return value.toInspectString();
  if (value instanceof IdylliumSet) return value.toInspectString();
  if (isJsonRuntimeValue(value)) return jsonSerialize(value, 0, 'json', 0);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && !Number.isFinite(value)) return nonFiniteWord(value);
  return String(value);
}













function createPlainRuntimeObject(moduleName: string, typeName: string, state: RuntimeObjectState): RuntimeObject {
  // 'time.stamp t;' без вызова — честный ноль эпохи, а не пустой объект,
  // печатавшийся JS-нутром '[object Object]'.
  if (moduleName === 'time' && typeName === 'stamp') {
    return new IdylliumTimeStamp(0) as unknown as RuntimeObject;
  }
  // 'math.Complex z;' без вызова — честный ноль.
  if (moduleName === 'math' && typeName === 'Complex') {
    return new IdylliumComplex(0, 0) as unknown as RuntimeObject;
  }

  if (moduleName === 'json') {
    if (typeName === 'Value') return createJsonValue();
    if (typeName === 'Object') return createJsonObject();
    if (typeName === 'Array') return createJsonArray();
  }

  if (moduleName === 'sqlite') {
    if (typeName === 'Value') return createSqliteValue();
    if (typeName === 'Database') return createClosedSqliteDatabase(state);
    if (typeName === 'Statement') return createClosedSqliteStatement();
    if (typeName === 'Result') return createBlankSqliteResult();
  }

  // 'xml.Node n;' без инициализации — честный пустой документ со всеми
  // методами, а не голый объект, печатавший 'undefined' и падавший на
  // n.tag.length языком JavaScript (улов ломателя 2026-08-28).
  if (moduleName === 'xml' && typeName === 'Node') {
    return createXmlNode('#document', false) as unknown as RuntimeObject;
  }

  // 'csv.Table t;' без вызова — честная пустая таблица с разделителем ';'.
  if (moduleName === 'csv' && typeName === 'Table') {
    return createCsvTable() as unknown as RuntimeObject;
  }

  const obj: Record<string, unknown> = {
    __idylliumObjectId: state.nextObjectId++,
    __idylliumType: `${moduleName}.${typeName}`,
  };
  state.objects.push(obj);

  if (moduleName === 'gui') {
    initializeGuiObject(obj, typeName, state);
  }

  if (moduleName === 'drawable') {
    initializeDrawableObject(obj, typeName, state);
  }

  if (moduleName === 'fonts') {
    initializeFontObject(obj, typeName, state);
  }

  if (moduleName === 'audio') {
    initializeAudioObject(obj, typeName, state);
    initializeMelodyObject(obj, typeName, state);
  }

  if (moduleName === 'image') {
    initializeImageObject(obj, typeName, state);
  }

  if (moduleName === 'turtle') {
    initializeTurtleObject(obj, typeName, state);
  }

  if (moduleName === 'channel') {
    initializeChannelPost(obj, typeName, state);
  }

  if (moduleName === 'web') {
    initializeWebObject(obj, typeName, state);
  }

  initializeResultObjectDefaults(obj, moduleName, typeName);

  return obj;
}

/** Пустая заготовка «объекта-ответа». Такие типы приходят из вызова
 *  (http.get(), обработчик web-маршрута), но объявить их пустыми язык
 *  разрешает — и тогда заготовка обязана быть ПОЛНОЙ формой своего типа:
 *  и свойства, и методы. Иначе выходило кривобоко — blank.status давал 0,
 *  а blank.header(...) падал «object has no method» (находка методистов
 *  2026-08-23). Пустые ответы отдают пустые строки — ровно то же, что
 *  настоящий ответ отдаёт на неизвестное имя. */
// Инъекция фабрики объектов в модули (см. RuntimeObjectFactory в
// runtime-state): сама фабрика знает про все семейства и живёт здесь.
registerObjectFactory({ create: createPlainRuntimeObject });

function initializeResultObjectDefaults(obj: RuntimeObject, moduleName: string, typeName: string): void {
  if (moduleName === 'http' && typeName === 'Response') {
    obj.status = 0;
    obj.ok = false;
    obj.text = '';
    obj.header = contextFunction((name: unknown, file: string, line: number) => {
      stringArgument(name, 'Response.header() name', file, line);
      return '';
    });
    obj.to_string = () => 'http.Response(status: 0)';
    return;
  }
  if (moduleName === 'web' && typeName === 'Request') {
    obj.path = '';
    obj.body = '';
    for (const method of ['query', 'param', 'form'] as const) {
      obj[method] = contextFunction((name: unknown, file: string, line: number) => {
        stringArgument(name, `web.Request.${method}() name`, file, line);
        return '';
      });
    }
    obj.to_string = () => 'web.Request( )';
    return;
  }
  if (moduleName === 'web' && typeName === 'Response') {
    obj.status = 0;
    // Отвечать этой заготовке некому: сервер выдаёт настоящий ответ в
    // обработчик. Молча проглотить отправку было бы враньём.
    for (const method of ['send', 'send_json', 'send_template', 'redirect'] as const) {
      obj[method] = contextFunction((_value: unknown, file: string, line: number) => {
        throw new IdylliumRuntimeError(
          file,
          line,
          `web.Response.${method}() has nothing to answer: this response is a blank one — the server passes a real response into your on_get()/on_post() handler`,
        );
      });
    }
    obj.to_string = () => 'web.Response';
  }
}

// ─── web.Server: свой веб-сервер (Flask-жанр) ──────────────────────────────





























































































































async function stepGuiTimer(timer: RuntimeObject, deltaTime: number): Promise<boolean> {
  if (timer.__running !== true) return false;
  const callback = timer.on_tick;
  if (typeof callback !== 'function') return false;

  const interval = typeof timer.interval === 'number' && Number.isFinite(timer.interval)
    ? Math.max(1, Math.trunc(timer.interval))
    : 1000;
  const elapsed = (typeof timer.__elapsedMs === 'number' ? timer.__elapsedMs : 0) + Math.max(0, deltaTime * 1000);
  timer.__elapsedMs = elapsed;
  let changed = false;

  while (timer.__running === true && typeof timer.__elapsedMs === 'number' && timer.__elapsedMs >= interval) {
    timer.__elapsedMs -= interval;
    await callback(timer);
    changed = true;
  }
  return changed;
}









function runtimeTypeName(value: unknown): string {
  // Наследник виджета носит виджетный __idylliumType (для рендера и механики),
  // а СВОЁ имя — в __idylliumClass: его и говорим человеку.
  if (isRuntimeObject(value) && typeof value.__idylliumClass === 'string') return value.__idylliumClass;
  if (isRuntimeObject(value) && typeof value.__idylliumType === 'string') return value.__idylliumType;
  if (value instanceof IdylliumMap) return 'map';
  if (value instanceof IdylliumSet) return 'set';
  if (typeof value === 'bigint') return 'int';
  return String(value);
}






