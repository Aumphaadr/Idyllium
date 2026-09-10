// ─── audio.Melody: сочинённый звук — модуль рантайма ────────────────────────
// Исследование tech/spec/some_music/01 (вердикты владельца 2026-09-10,
// вариант А): ноты копятся в объекте, клип рендерится чистым TypeScript
// (синус/квадрат/треугольник/пила с огибающей против щелчков) в WAV и едет
// по СУЩЕСТВУЮЩЕМУ пути звуков — снимок жанра audio.Sound с data-URI, тот же
// рендерер, тот же <audio>. Хосты не знают о синтезе ничего; CLI безголовый,
// как Sound, но export_to_file пишет настоящий файл — «программа сочиняет
// звук» работает и в консольном курсе.
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, finiteNumber, integerNumber, rangeNumber, stringArgument } from './runtime-shared';
import { RuntimeObjectState, defineEnumRuntimeProperty, defineValidatedRuntimeProperty } from './runtime-state';
import { audioCommands } from './runtime-audio';
import { bytesToDataUri } from './image-service';

export const MELODY_SAMPLE_RATE = 22050;
export const MELODY_MAX_SECONDS = 30;
export const MELODY_MAX_NOTES = 2000;
const MELODY_INSTRUMENTS = ['sine', 'square', 'triangle', 'saw'] as const;

interface MelodyNote {
  /** Частота в герцах; 0 — пауза. */
  frequency: number;
  beats: number;
}

type MelodyObject = RuntimeObject & {
  __idylliumType: 'audio.Melody';
  __melodyNotes: MelodyNote[];
  __melodyDirty: boolean;
};

// Полутон от «до» для сольфеджио и латиницы. «си» — B (не немецкое H).
const NOTE_SEMITONES: Readonly<Record<string, number>> = {
  'до': 0, 'ре': 2, 'ми': 4, 'фа': 5, 'соль': 7, 'ля': 9, 'си': 11,
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};
const NOTE_PATTERN = /^(до|ре|ми|фа|соль|ля|си|[a-g])([#♯b♭]?)([0-8])?$/u;

export const MELODY_NOTE_HINT = 'write до, ре, ми, фа, соль, ля, си (or C…B), then an octave digit and # or b, like "фа#5"';

/** Частота ноты по имени: «ля4» → 440. null — имя не разобрано. */
export function melodyNoteFrequency(rawName: string): number | null {
  const name = rawName.trim().toLowerCase();
  const match = NOTE_PATTERN.exec(name);
  if (!match) return null;
  const semitone = NOTE_SEMITONES[match[1]];
  const accidental = match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0;
  const octave = match[3] === undefined ? 4 : Number(match[3]);
  const midi = (octave + 1) * 12 + semitone + accidental;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function melodyNotes(obj: RuntimeObject): MelodyNote[] {
  return (obj as MelodyObject).__melodyNotes;
}

function melodySeconds(obj: RuntimeObject, tempo = Number(obj.tempo)): number {
  const beats = melodyNotes(obj).reduce((sum, note) => sum + note.beats, 0);
  return beats * 60 / tempo;
}

function invalidateMelody(obj: RuntimeObject): void {
  (obj as MelodyObject).__melodyDirty = true;
}

function beatsArgument(value: unknown, argumentName: string, file: string, line: number): number {
  const beats = finiteNumber(value, argumentName, file, line);
  if (beats <= 0) throw new IdylliumRuntimeError(file, line, `${argumentName} must be positive, got ${beats}`);
  return beats;
}

function appendNote(obj: RuntimeObject, note: MelodyNote, methodName: string, file: string, line: number): void {
  const notes = melodyNotes(obj);
  if (notes.length >= MELODY_MAX_NOTES) {
    throw new IdylliumRuntimeError(file, line, `${methodName} the melody cannot hold more than ${MELODY_MAX_NOTES} notes`);
  }
  const seconds = melodySeconds(obj) + note.beats * 60 / Number(obj.tempo);
  if (seconds > MELODY_MAX_SECONDS) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `${methodName} the melody would be ${formatSeconds(seconds)} seconds long — the limit is ${MELODY_MAX_SECONDS}; split it into several melodies`,
    );
  }
  notes.push(note);
  invalidateMelody(obj);
}

function formatSeconds(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// ─── синтез ────────────────────────────────────────────────────────────────

function waveSample(instrument: string, phase: number): number {
  switch (instrument) {
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    case 'saw': return 2 * phase - 1;
    default: return Math.sin(2 * Math.PI * phase);
  }
}

/** PCM 16 бит моно. Огибающая фиксированная: атака 10 мс, спад к 70 % за
 *  100 мс, затухание 30 мс в конце ноты — без щелчков на стыках. */
export function renderMelodyWav(notes: readonly MelodyNote[], tempo: number, instrument: string): Uint8Array {
  const rate = MELODY_SAMPLE_RATE;
  const counts = notes.map((note) => Math.max(1, Math.round(note.beats * 60 / tempo * rate)));
  const total = counts.reduce((sum, count) => sum + count, 0);
  const bytes = new Uint8Array(44 + total * 2);
  const view = new DataView(bytes.buffer);
  let offset = 44;
  notes.forEach((note, index) => {
    const count = counts[index];
    const seconds = count / rate;
    for (let i = 0; i < count; i += 1) {
      let sample = 0;
      if (note.frequency > 0) {
        const t = i / rate;
        const phase = (t * note.frequency) % 1;
        const attack = Math.min(1, t / 0.01);
        const decay = t < 0.1 ? 1 - 0.3 * (t / 0.1) : 0.7;
        const release = Math.min(1, (seconds - t) / 0.03);
        sample = waveSample(instrument, phase) * attack * decay * release * 0.8;
      }
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    }
  });
  const dataSize = total * 2;
  const ascii = (at: number, text: string) => { for (let i = 0; i < text.length; i += 1) bytes[at + i] = text.charCodeAt(i); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, dataSize, true);
  return bytes;
}

function renderIfNeeded(obj: RuntimeObject, methodName: string, file: string, line: number): Uint8Array {
  const notes = melodyNotes(obj);
  if (notes.length === 0) {
    throw new IdylliumRuntimeError(file, line, `${methodName} the melody is empty — add notes first`);
  }
  const bytes = renderMelodyWav(notes, Number(obj.tempo), String(obj.instrument));
  if ((obj as MelodyObject).__melodyDirty || typeof obj.resource_uri !== 'string' || obj.resource_uri === '') {
    obj.resource_uri = bytesToDataUri(bytes, 'audio/wav');
    (obj as MelodyObject).__melodyDirty = false;
  }
  return bytes;
}

// ─── объект ────────────────────────────────────────────────────────────────

export function initializeMelodyObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Melody') return;
  const melody = obj as MelodyObject;
  melody.__melodyNotes = [];
  melody.__melodyDirty = true;
  obj.resource_uri = '';
  obj.is_playing = false;
  obj.loop = false;
  defineEnumRuntimeProperty(obj, 'instrument', 'Melody', 'sine', MELODY_INSTRUMENTS, () => invalidateMelody(obj));
  defineValidatedRuntimeProperty(obj, 'tempo', 120, (value, file, line) => {
    const tempo = rangeNumber(value, 'Melody.tempo', 20, 400, file, line);
    const seconds = melodySeconds(obj, tempo);
    if (seconds > MELODY_MAX_SECONDS) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `Melody.tempo ${tempo} would make the melody ${formatSeconds(seconds)} seconds long — the limit is ${MELODY_MAX_SECONDS}`,
      );
    }
    return tempo;
  }, () => invalidateMelody(obj));
  defineValidatedRuntimeProperty(obj, 'volume', 1, (value, file, line) => (
    rangeNumber(value, 'Melody.volume', 0, 1, file, line)
  ));
  Object.defineProperty(obj, 'duration', {
    enumerable: true,
    configurable: true,
    get: () => Math.round(melodySeconds(obj) * 1000) / 1000,
  });

  obj.add_note = contextFunction((name: unknown, beats: unknown, file: string, line: number) => {
    const noteName = stringArgument(name, 'Melody.add_note() note', file, line);
    const frequency = melodyNoteFrequency(noteName);
    if (frequency === null) {
      throw new IdylliumRuntimeError(file, line, `Melody.add_note() unknown note '${noteName}' — ${MELODY_NOTE_HINT}`);
    }
    appendNote(obj, { frequency, beats: beatsArgument(beats, 'Melody.add_note() beats', file, line) }, 'Melody.add_note()', file, line);
  });
  obj.add_rest = contextFunction((beats: unknown, file: string, line: number) => {
    appendNote(obj, { frequency: 0, beats: beatsArgument(beats, 'Melody.add_rest() beats', file, line) }, 'Melody.add_rest()', file, line);
  });
  obj.add_frequency = contextFunction((frequency: unknown, beats: unknown, file: string, line: number) => {
    const hertz = rangeNumber(frequency, 'Melody.add_frequency() frequency', 20, 20000, file, line);
    appendNote(obj, { frequency: hertz, beats: beatsArgument(beats, 'Melody.add_frequency() beats', file, line) }, 'Melody.add_frequency()', file, line);
  });
  // Мелодия текстом (жанр QBasic PLAY): «до ре ми:2 - соль5»; «|» — украшение.
  obj.add_notes = contextFunction((text: unknown, file: string, line: number) => {
    const source = stringArgument(text, 'Melody.add_notes() text', file, line);
    const parsed: MelodyNote[] = [];
    for (const token of source.split(/\s+/u)) {
      if (token === '' || token === '|') continue;
      const colon = token.indexOf(':');
      const head = colon < 0 ? token : token.slice(0, colon);
      const tail = colon < 0 ? '1' : token.slice(colon + 1);
      const beats = Number(tail);
      if (tail === '' || !Number.isFinite(beats) || beats <= 0) {
        throw new IdylliumRuntimeError(file, line, `Melody.add_notes() cannot read '${token}' — the length after ':' must be a positive number, like "до:2"`);
      }
      if (head === '-') {
        parsed.push({ frequency: 0, beats });
        continue;
      }
      const frequency = melodyNoteFrequency(head);
      if (frequency === null) {
        throw new IdylliumRuntimeError(file, line, `Melody.add_notes() cannot read '${token}' — ${MELODY_NOTE_HINT}; '-' is a rest`);
      }
      parsed.push({ frequency, beats });
    }
    for (const note of parsed) appendNote(obj, note, 'Melody.add_notes()', file, line);
  });
  obj.transpose = contextFunction((semitones: unknown, file: string, line: number) => {
    const shift = integerNumber(semitones, 'Melody.transpose() semitones', file, line);
    if (shift < -48 || shift > 48) {
      throw new IdylliumRuntimeError(file, line, `Melody.transpose() semitones must be between -48 and 48, got ${shift}`);
    }
    const factor = Math.pow(2, shift / 12);
    for (const note of melodyNotes(obj)) {
      if (note.frequency > 0) note.frequency *= factor;
    }
    invalidateMelody(obj);
  });
  obj.clear = contextFunction(() => {
    melody.__melodyNotes = [];
    invalidateMelody(obj);
  });

  obj.play = contextFunction((file: string, line: number) => {
    renderIfNeeded(obj, 'Melody.play()', file, line);
    obj.is_playing = true;
    audioCommands(obj).push({ id: state.nextAudioCommandId++, action: 'play' });
  });
  obj.pause = () => {
    obj.is_playing = false;
    audioCommands(obj).push({ id: state.nextAudioCommandId++, action: 'pause' });
  };
  obj.resume = contextFunction((file: string, line: number) => {
    renderIfNeeded(obj, 'Melody.resume()', file, line);
    obj.is_playing = true;
    audioCommands(obj).push({ id: state.nextAudioCommandId++, action: 'resume' });
  });
  obj.stop = () => {
    obj.is_playing = false;
    audioCommands(obj).push({ id: state.nextAudioCommandId++, action: 'stop' });
  };

  obj.export_to_file = contextFunction((targetPath: unknown, file: string, line: number) => {
    const requestedPath = stringArgument(targetPath, 'Melody.export_to_file() path', file, line);
    if (!/\.wav$/iu.test(requestedPath)) {
      throw new IdylliumRuntimeError(file, line, `Melody.export_to_file() writes WAV — name the file with .wav, got '${requestedPath}'`);
    }
    const bytes = renderIfNeeded(obj, 'Melody.export_to_file()', file, line);
    if (!state.fileSystem.writeBytes) {
      throw new IdylliumRuntimeError(file, line, 'Melody.export_to_file() requires binary file support in this runtime');
    }
    const resolvedPath = state.fileSystem.resolvePath(requestedPath, file);
    try {
      state.fileSystem.writeBytes(resolvedPath, bytes, String(obj.resource_uri));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IdylliumRuntimeError(file, line, `Melody.export_to_file() cannot write '${requestedPath}': ${state.fileSystem.humanizePaths?.(message) ?? message}`);
    }
  });

  state.audio.push(obj);
}
