// Ошибка выполнения Idyllium — фундамент рантайма, вынесена из runtime.ts
// при декомпозиции 2026-08-29 (бэклог: монолит на 10 тыс. строк).

export class IdylliumRuntimeError extends Error {
  constructor(
    readonly file: string,
    readonly line: number,
    readonly detail: string,
    readonly kind: 'program' | 'cancelled' | 'exit' = 'program',
  ) {
    super(`${file}:${line}: runtime error: ${detail}`);
    this.name = 'IdylliumRuntimeError';
  }
}

/**
 * Версия языка, видимая программе через system.version().
 * Должна совпадать с package.json — это закреплено тестом в smoke.test.ts,
 * потому что рантайм собирается и в браузер, где package.json недоступен.
 */
