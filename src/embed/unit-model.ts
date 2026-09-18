// ─── Embed-юнит: модель и разбор конфигурации ──────────────────────────────
// Спека Idyllium-backstage/tech/spec/some_embed_units/02 (вердикты владельца
// 2026-09-17). Один JSON на всё: он лежит в разметке `<idyllium-unit>`, в
// адресе кадра после `#unit=` и в файле `.idyunit`. `format` — номер схемы
// файла (единственная отдельная нумерация: сохранённый сегодня файл обязан
// открыться конструктором через год); версия Idyllium едина.

export const UNIT_FORMAT = 1;

/** Библиотеки, доступные юниту; по умолчанию — все эти, автор может сузить. */
export const UNIT_LIBRARIES: readonly string[] = [
  'console', 'math', 'random', 'time', 'types', 'encoding', 'hash', 'system',
];

export const UNIT_TEST_TIMEOUT_MS = 10000;
export const UNIT_OUTPUT_LIMIT = 65536;
export const UNIT_MAX_TESTS = 200;

export const STARTER_MINIMAL = 'use console;\n\nmain() {\n    \n}\n';

export type UnitTestSpec =
  | { readonly in: string | readonly string[] }
  | {
      readonly random: number;
      readonly range: readonly [number, number];
      readonly times: number;
      /** 'float' — случайные дробные с digits знаками после точки; без поля — целые. */
      readonly kind?: 'float';
      readonly digits?: number;
    };

export interface UnitRule {
  /** Условие применимости правила («когда»); пусто — всегда. */
  readonly when: string;
  readonly expr: string;
}

export type UnitCheck =
  | { readonly kind: 'none' }
  | { readonly kind: 'formula'; readonly rules: readonly UnitRule[]; readonly tolerance: number }
  | { readonly kind: 'expect'; readonly output: string }
  | { readonly kind: 'reference'; readonly tolerance: number };

export interface UnitCodeRules {
  readonly require: readonly string[];
  readonly forbid: readonly string[];
  readonly maxCalls: Readonly<Record<string, number>>;
}

export interface UnitConfig {
  readonly format: number;
  readonly idyllium: string;
  readonly id: string;
  readonly title: string;
  /** Условие задачи; пусто — юнит «немой», условие пишет страница-хозяин. */
  readonly statement: string;
  readonly starter: string;
  readonly editor: {
    readonly rows: number;
    readonly consoleRows: number;
    readonly fontSize: number;
    readonly theme: 'auto' | 'light' | 'dark';
    readonly mode: 'monaco' | 'light';
    /** Автодополнение в Monaco; false — ни после точки, ни по Ctrl+Пробел. */
    readonly autocomplete: boolean;
    /** Кнопка «Форматировать» (выравнивание отступов); false — кнопки нет. */
    readonly format: boolean;
  };
  readonly lang: 'ru' | 'en';
  readonly libs: readonly string[];
  /** 'none' — по условию ввода нет: попытка читать — провал теста. */
  readonly inputs: 'some' | 'none';
  readonly tests: readonly UnitTestSpec[];
  readonly check: UnitCheck;
  readonly code: UnitCodeRules;
  /** Решение автора: эталон в режиме reference и материал самопроверки. */
  readonly solution: string;
  readonly feedback: {
    /** Показывать ученику ожидаемый ответ проваленного теста. */
    readonly reveal: boolean;
    /** Мягкая подсказка после обычного запуска («этот запуск сходится с условием»). */
    readonly softRunHint: boolean;
    /** Отдавать странице-хозяину текст программы ученика. */
    readonly shareCode: boolean;
    /** Подпись-ссылка «Idyllium» в углу юнита. */
    readonly branding: boolean;
  };
  /** Имена функций страницы-хозяина (жанр onclick): зовёт загрузчик, без eval. */
  readonly hooks: { readonly solved: string; readonly failed: string; readonly check: string };
}

export interface UnitProblem {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly params: Readonly<Record<string, string | number>>;
}

export interface NormalizedUnit {
  readonly config: UnitConfig;
  readonly problems: readonly UnitProblem[];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function wordList(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[\s,]+/u).filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
  return [];
}

/** Идентификатор юнита: латиница, цифры, дефис — годится для id и ключей хранилища. */
export function slugifyUnitId(source: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const latin = Array.from(source.toLowerCase()).map((char) => map[char] ?? char).join('');
  return latin.replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 48);
}

/**
 * Приводит сырой объект к UnitConfig и говорит словами, что в нём не так.
 * Ничего не выбрасывает: юнит на чужой странице обязан показать ошибку
 * конфигурации текстом, а не умереть молча.
 */
export function normalizeUnitConfig(raw: unknown, idylliumVersion = ''): NormalizedUnit {
  const problems: UnitProblem[] = [];
  const source = record(raw);
  const problem = (severity: UnitProblem['severity'], code: string, params: UnitProblem['params'] = {}): void => {
    problems.push({ severity, code, params });
  };

  const format = typeof source.format === 'number' ? source.format : UNIT_FORMAT;
  if (format > UNIT_FORMAT) problem('error', 'config.format-newer', { format, supported: UNIT_FORMAT });

  const editorSource = record(source.editor);
  const themeRaw = text(editorSource.theme, 'auto');
  const theme = themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : 'auto';
  const modeRaw = text(editorSource.mode, 'monaco');

  const libsRaw = source.libs === undefined ? [...UNIT_LIBRARIES] : wordList(source.libs);
  const libs: string[] = [];
  for (const name of libsRaw) {
    if (!UNIT_LIBRARIES.includes(name)) {
      problem('warning', 'config.lib-unavailable', { name });
      continue;
    }
    if (!libs.includes(name)) libs.push(name);
  }
  if (!libs.includes('console')) libs.unshift('console');

  const tests: UnitTestSpec[] = [];
  const rawTests = Array.isArray(source.tests) ? source.tests : [];
  rawTests.forEach((item, index) => {
    const test = record(item);
    if (typeof test.random === 'number') {
      const range = Array.isArray(test.range) && test.range.length === 2 ? test.range : [1, 100];
      const low = Number(range[0]);
      const high = Number(range[1]);
      const float = test.kind === 'float';
      const sane = float ? Number.isFinite(low) && Number.isFinite(high) : Number.isInteger(low) && Number.isInteger(high);
      if (!sane || low > high) {
        problem('error', 'config.test-range', { index: index + 1 });
        return;
      }
      tests.push({
        random: clampInt(test.random, 1, 20, 1),
        range: [low, high],
        times: clampInt(test.times, 1, 50, 3),
        ...(float ? { kind: 'float' as const, digits: clampInt(test.digits, 1, 6, 1) } : {}),
      });
      return;
    }
    if (typeof test.in === 'string') {
      tests.push({ in: test.in });
      return;
    }
    if (Array.isArray(test.in)) {
      tests.push({ in: test.in.map((line) => String(line)) });
      return;
    }
    problem('error', 'config.test-shape', { index: index + 1 });
  });

  const checkSource = record(source.check);
  const kind = text(checkSource.kind, 'none');
  let check: UnitCheck = { kind: 'none' };
  const tolerance = typeof checkSource.tolerance === 'number' && checkSource.tolerance >= 0 ? checkSource.tolerance : 1e-6;
  if (kind === 'formula') {
    const rules = (Array.isArray(checkSource.rules) ? checkSource.rules : []).map((item) => {
      const rule = record(item);
      return { when: text(rule.when).trim(), expr: text(rule.expr).trim() };
    }).filter((rule) => rule.expr !== '');
    if (rules.length === 0) problem('error', 'config.formula-empty');
    check = { kind: 'formula', rules, tolerance };
  } else if (kind === 'expect') {
    check = { kind: 'expect', output: text(checkSource.output) };
  } else if (kind === 'reference') {
    check = { kind: 'reference', tolerance };
  } else if (kind !== 'none') {
    problem('error', 'config.check-kind', { kind });
  }

  const inputs = text(source.inputs, 'some') === 'none' ? 'none' : 'some';
  const solution = text(source.solution);
  if (check.kind === 'reference' && solution.trim() === '') problem('error', 'config.reference-missing');
  if (check.kind !== 'none' && check.kind !== 'expect' && inputs === 'some' && tests.length === 0) {
    problem('error', 'config.tests-missing');
  }
  if (inputs === 'none' && tests.some((test) => 'random' in test || (typeof test.in === 'string' ? test.in.trim() !== '' : test.in.length > 0))) {
    problem('warning', 'config.tests-ignored');
  }

  const codeSource = record(source.code);
  const maxCalls: Record<string, number> = {};
  for (const [name, limit] of Object.entries(record(codeSource.maxCalls))) {
    if (typeof limit === 'number' && Number.isInteger(limit) && limit >= 0) maxCalls[name] = limit;
  }

  const feedbackSource = record(source.feedback);
  const hooksSource = record(source.hooks);
  const hookName = (value: unknown, which: string): string => {
    const name = text(value).trim();
    if (name !== '' && !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/u.test(name)) {
      problem('error', 'config.hook-name', { which, name });
      return '';
    }
    return name;
  };

  const title = text(source.title).trim();
  const id = slugifyUnitId(text(source.id)) || slugifyUnitId(title) || 'unit';
  const starterRaw = text(source.starter, STARTER_MINIMAL);

  const config: UnitConfig = {
    format: UNIT_FORMAT,
    idyllium: text(source.idyllium, idylliumVersion),
    id,
    title,
    statement: text(source.statement),
    starter: starterRaw === 'minimal' ? STARTER_MINIMAL : starterRaw === 'empty' ? '' : starterRaw,
    editor: {
      rows: clampInt(editorSource.rows, 4, 40, 16),
      consoleRows: clampInt(editorSource.consoleRows, 3, 20, 6),
      fontSize: clampInt(editorSource.fontSize, 10, 28, 16),
      theme,
      mode: modeRaw === 'light' ? 'light' : 'monaco',
      autocomplete: editorSource.autocomplete !== false,
      format: editorSource.format !== false,
    },
    lang: text(source.lang, 'ru') === 'en' ? 'en' : 'ru',
    libs,
    inputs,
    tests: tests.slice(0, UNIT_MAX_TESTS),
    check,
    code: { require: wordList(codeSource.require), forbid: wordList(codeSource.forbid), maxCalls },
    solution,
    feedback: {
      reveal: bool(feedbackSource.reveal, false),
      softRunHint: bool(feedbackSource.softRunHint, true),
      shareCode: bool(feedbackSource.shareCode, false),
      branding: bool(feedbackSource.branding, true),
    },
    hooks: {
      solved: hookName(hooksSource.solved, 'solved'),
      failed: hookName(hooksSource.failed, 'failed'),
      check: hookName(hooksSource.check, 'check'),
    },
  };
  return { config, problems };
}

/** Конфиг для выдачи наружу: решение автора уезжает только в режиме эталона. */
export function publicUnitConfig(config: UnitConfig): UnitConfig {
  return config.check.kind === 'reference' ? config : { ...config, solution: '' };
}

// ─── упаковка в адрес кадра ────────────────────────────────────────────────

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function encodeUnitForHash(config: UnitConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(publicUnitConfig(config)));
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64URL[(triple >> 18) & 63] + BASE64URL[(triple >> 12) & 63];
    if (b !== undefined) out += BASE64URL[(triple >> 6) & 63];
    if (c !== undefined) out += BASE64URL[triple & 63];
  }
  return out;
}

export function decodeUnitFromHash(encoded: string): unknown {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of encoded) {
    const value = BASE64URL.indexOf(char);
    if (value < 0) throw new Error(`unexpected character '${char}' in the unit address`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes)));
}
