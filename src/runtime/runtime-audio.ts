// ─── audio: звук и музыка — модуль рантайма (этап Б, 2026-08-29) ───────────
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, finiteNumber, stringArgument } from './runtime-shared';
import { IdylliumAudioCommand, RuntimeFileSystem, RuntimeObjectState, defineValidatedRuntimeProperty } from './runtime-state';
import { rangeNumber } from './runtime-shared';
import { runtimeIsFile } from './runtime-fs';

// Тот же приём, что в ядре: в браузерном бандле Buffer приходит заглушкой.
const nodeBuffer: any = require('buffer').Buffer;

export function initializeAudioObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Sound' && typeName !== 'Music') return;

  obj.src = '';
  obj.resolved_path = '';
  obj.resource_uri = '';
  obj.is_loaded = false;
  obj.duration = 0;
  obj.is_playing = false;
  obj.__audioCommands = [];
  defineValidatedRuntimeProperty(obj, 'volume', 1, (value, file, line) => (
    rangeNumber(value, `${typeName}.volume`, 0, 1, file, line)
  ));

  obj.load_from_file = contextFunction((targetPath: unknown, file: string, line: number) => {
    const requestedPath = stringArgument(targetPath, `${typeName}.load_from_file() path`, file, line);
    const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
    if (!state.fileSystem.exists(resolvedPath)) {
      throw new IdylliumRuntimeError(file, line, `${typeName}.load_from_file() cannot load '${requestedPath}': file does not exist`);
    }
    if (!runtimeIsFile(state.fileSystem, resolvedPath, file, line, 'reading')) {
      throw new IdylliumRuntimeError(file, line, `${typeName}.load_from_file() cannot load '${requestedPath}': path is not a file`);
    }
    // Формат — по СОДЕРЖИМОМУ, как у картинок и шрифтов. Раньше сюда проходил
    // любой файл: duration оставался нулём, play() рапортовал is_playing, звука
    // не было, и ни одного слова об этом (AU1, находка методистов 2026-08-23).
    // Смотрим именно СИГНАТУРУ, а не длительность: у валидного WAV с пустыми
    // данными длительность тоже ноль, и отказывать ему было бы неправдой.
    if (!looksLikeAudio(state.fileSystem, resolvedPath)) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `${typeName}.load_from_file() cannot decode '${requestedPath}': unsupported audio format (WAV, MP3 and OGG are supported)`,
      );
    }
    obj.src = requestedPath;
    obj.resolved_path = resolvedPath;
    obj.resource_uri = state.fileSystem.resourceUri?.(resolvedPath) ?? '';
    obj.duration = audioDuration(state.fileSystem, resolvedPath);
    obj.is_loaded = true;
  });

  obj.play = contextFunction((file: string, line: number) => {
    assertAudioLoaded(obj, typeName, 'play', file, line);
    obj.is_playing = true;
    pushAudioCommand(obj, state, 'play');
  });
  obj.pause = () => {
    obj.is_playing = false;
    pushAudioCommand(obj, state, 'pause');
  };
  obj.resume = contextFunction((file: string, line: number) => {
    assertAudioLoaded(obj, typeName, 'resume', file, line);
    obj.is_playing = true;
    pushAudioCommand(obj, state, 'resume');
  });
  obj.stop = () => {
    obj.is_playing = false;
    if (typeName === 'Music') obj.position = 0;
    pushAudioCommand(obj, state, 'stop');
  };

  if (typeName === 'Music') {
    obj.loop = false;
    defineValidatedRuntimeProperty(
      obj,
      'position',
      0,
      (value, file, line) => {
        const position = finiteNumber(value, 'Music.position', file, line);
        const duration = typeof obj.duration === 'number' ? obj.duration : 0;
        if (position < 0) {
          throw new IdylliumRuntimeError(file, line, `Music.position must be non-negative, got ${position}`);
        }
        if (duration > 0 && position > duration) {
          throw new IdylliumRuntimeError(file, line, `Music.position must be between 0 and ${Math.floor(duration * 100) / 100}, got ${position}`);
        }
        return position;
      },
      () => pushAudioCommand(obj, state, 'seek'),
    );
  }

  state.audio.push(obj);
}

function pushAudioCommand(obj: RuntimeObject, state: RuntimeObjectState, action: IdylliumAudioCommand['action']): void {
  audioCommands(obj).push({ id: state.nextAudioCommandId++, action });
}

function assertAudioLoaded(obj: RuntimeObject, typeName: string, methodName: string, file: string, line: number): void {
  if (obj.is_loaded === true) return;
  throw new IdylliumRuntimeError(file, line, `${typeName}.${methodName}() cannot play audio before load_from_file()`);
}

export function audioCommands(obj: RuntimeObject): IdylliumAudioCommand[] {
  if (Array.isArray(obj.__audioCommands)) return obj.__audioCommands as IdylliumAudioCommand[];
  const commands: IdylliumAudioCommand[] = [];
  Object.defineProperty(obj, '__audioCommands', {
    value: commands,
    enumerable: false,
    configurable: true,
  });
  return commands;
}

/** Похож ли файл на звук — по сигнатуре первых байтов, как у картинок и
 *  шрифтов. Длительность для этого не годится: у валидного WAV без сэмплов
 *  она ноль. */

export function looksLikeAudio(fileSystem: RuntimeFileSystem, filePath: string): boolean {
  let bytes: any = null;
  try {
    if (fileSystem.readBytes) {
      bytes = nodeBuffer.from(fileSystem.readBytes(filePath));
    } else {
      const text = fileSystem.readText(filePath);
      const dataUrlMatch = /^data:audio\/[^;]+;base64,(.+)$/u.exec(text);
      // data:audio/... — уже объявленный звук, содержимое пришло из среды.
      if (dataUrlMatch) return true;
      bytes = nodeBuffer.from(text, 'binary');
    }
  } catch {
    return false;
  }
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 4) return false;

  const head = bytes.toString('ascii', 0, 4);
  if (head === 'RIFF' && bytes.length >= 12 && bytes.toString('ascii', 8, 12) === 'WAVE') return true;
  if (head === 'OggS') return true;
  if (head.startsWith('ID3')) return true;
  // Кадр MP3 без тега: синхрослово 11 единиц подряд.
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
  return false;
}

export function audioDuration(fileSystem: RuntimeFileSystem, filePath: string): number {
  try {
    if (fileSystem.readBytes) {
      const duration = encodedAudioDuration(nodeBuffer.from(fileSystem.readBytes(filePath)));
      if (duration > 0) return duration;
    }

    const text = fileSystem.readText(filePath);
    const dataUrlMatch = /^data:audio\/[^;]+;base64,(.+)$/u.exec(text);
    const bytes = dataUrlMatch
      ? nodeBuffer.from(dataUrlMatch[1], 'base64')
      : nodeBuffer.from(text, 'binary');
    return encodedAudioDuration(bytes);
  } catch {
    return 0;
  }
}

function encodedAudioDuration(bytes: any): number {
  return wavDuration(bytes) || mp3Duration(bytes);
}

function wavDuration(bytes: any): number {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 44) return 0;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return 0;
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  const bitsPerSample = bytes.readUInt16LE(34);
  const dataSize = bytes.readUInt32LE(40);
  const bytesPerSecond = sampleRate * Math.max(1, channels) * Math.max(1, bitsPerSample) / 8;
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return 0;
  return dataSize / bytesPerSecond;
}

function mp3Duration(bytes: any): number {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 4) return 0;

  let offset = 0;
  if (
    bytes.length >= 10
    && bytes[0] === 0x49
    && bytes[1] === 0x44
    && bytes[2] === 0x33
  ) {
    const tagSize = ((bytes[6] & 0x7f) << 21)
      | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7)
      | (bytes[9] & 0x7f);
    offset = 10 + tagSize + ((bytes[5] & 0x10) !== 0 ? 10 : 0);
  }

  const mpeg1Layer3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const baseSampleRates = [44100, 48000, 32000];
  let duration = 0;
  let frameCount = 0;

  while (offset + 4 <= bytes.length) {
    const second = bytes[offset + 1];
    if (bytes[offset] !== 0xff || (second & 0xe0) !== 0xe0) {
      offset++;
      continue;
    }

    const versionBits = (second >> 3) & 0x03;
    const layerBits = (second >> 1) & 0x03;
    const third = bytes[offset + 2];
    const bitrateIndex = (third >> 4) & 0x0f;
    const sampleRateIndex = (third >> 2) & 0x03;
    const padding = (third >> 1) & 0x01;
    if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      offset++;
      continue;
    }

    const mpeg1 = versionBits === 3;
    const bitrate = (mpeg1 ? mpeg1Layer3Bitrates : mpeg2Layer3Bitrates)[bitrateIndex] * 1000;
    const sampleRateDivisor = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 4;
    const sampleRate = baseSampleRates[sampleRateIndex] / sampleRateDivisor;
    const samplesPerFrame = mpeg1 ? 1152 : 576;
    const frameLength = Math.floor((mpeg1 ? 144 : 72) * bitrate / sampleRate) + padding;
    if (bitrate <= 0 || sampleRate <= 0 || frameLength <= 4 || offset + frameLength > bytes.length) {
      offset++;
      continue;
    }

    duration += samplesPerFrame / sampleRate;
    frameCount++;
    offset += frameLength;
  }

  return frameCount > 0 ? duration : 0;
}
