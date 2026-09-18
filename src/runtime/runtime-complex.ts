// ─── math.Complex: комплексные числа ───────────────────────────────────────
// Значение, а не изменяемый объект: у числа нет сеттеров, каждая операция
// возвращает новое число. Арифметика — те же контракты, что у пользовательских
// классов (plus/minus/multiply/divide/opposite), поэтому `z1 + z2`, `2 * z`
// и `-z` работают знаками; вещественное число входит в операцию как комплексное
// с нулевой мнимой частью (ступень числовой лестницы int → float → Complex).
import { IdylliumRuntimeError } from './runtime-errors';
import { ContextualRuntimeFunction, splitContextArgs } from './runtime-shared';
import { IdylliumArray } from './runtime-values';

/** Всё, что меньше этой доли модуля, — шум округления cos/sin, а не значение. */
const POLAR_NOISE = 1e-15;

function finite(value: number, what: string, file: string, line: number): number {
  if (!Number.isFinite(value)) {
    throw new IdylliumRuntimeError(file, line, `${what} is outside the float range`);
  }
  return value;
}

export class IdylliumComplex {
  readonly __idylliumType = 'math.Complex';

  constructor(readonly re: number, readonly im: number) {}

  /** Число любого рода → комплексное; чужое значение — ошибка словами. */
  static from(value: unknown, what: string, file: string, line: number): IdylliumComplex {
    if (value instanceof IdylliumComplex) return value;
    if (typeof value === 'number') return new IdylliumComplex(finite(value, what, file, line), 0);
    if (typeof value === 'bigint') return new IdylliumComplex(finite(Number(value), what, file, line), 0);
    throw new IdylliumRuntimeError(file, line, `${what} expects a number or math.Complex, got '${String(value)}'`);
  }

  /** Тригонометрическая форма: шум округления (|часть| < модуль · 1e-15) — это ноль. */
  static polar(modulus: number, argument: number): IdylliumComplex {
    const re = modulus * Math.cos(argument);
    const im = modulus * Math.sin(argument);
    const noise = Math.abs(modulus) * POLAR_NOISE;
    return new IdylliumComplex(Math.abs(re) < noise ? 0 : re, Math.abs(im) < noise ? 0 : im);
  }

  abs(): number {
    return Math.hypot(this.re, this.im);
  }

  /** Главное значение аргумента, (−π; π]; у нуля — 0. */
  arg(): number {
    return this.re === 0 && this.im === 0 ? 0 : Math.atan2(this.im, this.re);
  }

  conjugate(): IdylliumComplex {
    return new IdylliumComplex(this.re, this.im === 0 ? 0 : -this.im);
  }

  // ── контракты арифметики ──

  plus(other: unknown, file: string, line: number): IdylliumComplex {
    const w = IdylliumComplex.from(other, "operator '+'", file, line);
    return new IdylliumComplex(finite(this.re + w.re, "operator '+' result", file, line), finite(this.im + w.im, "operator '+' result", file, line));
  }

  minus(other: unknown, file: string, line: number): IdylliumComplex {
    const w = IdylliumComplex.from(other, "operator '-'", file, line);
    return new IdylliumComplex(finite(this.re - w.re, "operator '-' result", file, line), finite(this.im - w.im, "operator '-' result", file, line));
  }

  multiply(other: unknown, file: string, line: number): IdylliumComplex {
    const w = IdylliumComplex.from(other, "operator '*'", file, line);
    return new IdylliumComplex(
      finite(this.re * w.re - this.im * w.im, "operator '*' result", file, line),
      finite(this.re * w.im + this.im * w.re, "operator '*' result", file, line),
    );
  }

  divide(other: unknown, file: string, line: number): IdylliumComplex {
    const w = IdylliumComplex.from(other, "operator '/'", file, line);
    if (w.re === 0 && w.im === 0) {
      throw new IdylliumRuntimeError(file, line, 'division by zero');
    }
    // Алгоритм Смита: без промежуточного переполнения на больших и малых частях.
    if (Math.abs(w.re) >= Math.abs(w.im)) {
      const ratio = w.im / w.re;
      const denominator = w.re + w.im * ratio;
      return new IdylliumComplex(
        finite((this.re + this.im * ratio) / denominator, "operator '/' result", file, line),
        finite((this.im - this.re * ratio) / denominator, "operator '/' result", file, line),
      );
    }
    const ratio = w.re / w.im;
    const denominator = w.re * ratio + w.im;
    return new IdylliumComplex(
      finite((this.re * ratio + this.im) / denominator, "operator '/' result", file, line),
      finite((this.im * ratio - this.re) / denominator, "operator '/' result", file, line),
    );
  }

  opposite(): IdylliumComplex {
    return new IdylliumComplex(this.re === 0 ? 0 : -this.re, this.im === 0 ? 0 : -this.im);
  }

  // ── степени и корни ──

  /**
   * Целый показатель — точным повторным умножением (2i в квадрате даёт ровно −4,
   * без хвостов cos/sin); прочие — главное значение exp(w · ln z).
   */
  pow(exponent: unknown, file: string, line: number): IdylliumComplex {
    const w = IdylliumComplex.from(exponent, 'math.Complex.pow() exponent', file, line);
    const isZero = this.re === 0 && this.im === 0;
    if (w.im === 0 && Number.isInteger(w.re) && Math.abs(w.re) <= 4096) {
      if (isZero && w.re < 0) throw new IdylliumRuntimeError(file, line, 'zero cannot be raised to a negative power');
      let result = new IdylliumComplex(1, 0);
      let base: IdylliumComplex = this;
      for (let power = Math.abs(w.re); power > 0; power = Math.floor(power / 2)) {
        if (power % 2 === 1) result = result.multiply(base, file, line);
        base = base.multiply(base, file, line);
      }
      return w.re < 0 ? new IdylliumComplex(1, 0).divide(result, file, line) : result;
    }
    if (isZero) {
      if (w.re > 0) return new IdylliumComplex(0, 0);
      throw new IdylliumRuntimeError(file, line, 'zero can be raised only to a power with a positive real part');
    }
    return w.multiply(this.ln(file, line), file, line).exp(file, line);
  }

  /** Главное значение корня: аргумент результата в (−π/2; π/2]. */
  sqrt(): IdylliumComplex {
    const modulus = this.abs();
    if (modulus === 0) return new IdylliumComplex(0, 0);
    // Устойчивая форма: без вычитания близких чисел.
    const re = Math.sqrt((modulus + Math.abs(this.re)) / 2);
    const im = Math.abs(this.im) / (2 * re);
    if (this.re >= 0) return new IdylliumComplex(re, this.im < 0 ? -im : im);
    return new IdylliumComplex(im, this.im < 0 ? -re : re);
  }

  /** Все n корней степени n (формула Муавра), от главного против часовой стрелки. */
  roots(count: unknown, file: string, line: number): IdylliumArray {
    const n = typeof count === 'bigint' ? Number(count) : count;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
      throw new IdylliumRuntimeError(file, line, `math.Complex.roots() expects a positive integer degree, got ${String(count)}`);
    }
    if (n > 10000) {
      throw new IdylliumRuntimeError(file, line, `math.Complex.roots() degree ${n} is too large (at most 10000)`);
    }
    const modulus = Math.pow(this.abs(), 1 / n);
    const argument = this.arg();
    const values: IdylliumComplex[] = [];
    for (let k = 0; k < n; k += 1) {
      values.push(IdylliumComplex.polar(modulus, (argument + 2 * Math.PI * k) / n));
    }
    return IdylliumArray.from(values, true, null, () => new IdylliumComplex(0, 0));
  }

  // ── элементарные функции ──

  exp(file: string, line: number): IdylliumComplex {
    const modulus = finite(Math.exp(this.re), 'math.Complex.exp() result', file, line);
    return IdylliumComplex.polar(modulus, this.im);
  }

  /** Главное значение логарифма: ln|z| + i·arg z. */
  ln(file: string, line: number): IdylliumComplex {
    if (this.re === 0 && this.im === 0) {
      throw new IdylliumRuntimeError(file, line, 'math.Complex.ln() of zero does not exist');
    }
    return new IdylliumComplex(Math.log(this.abs()), this.arg());
  }

  sin(file: string, line: number): IdylliumComplex {
    return new IdylliumComplex(
      finite(Math.sin(this.re) * Math.cosh(this.im), 'math.Complex.sin() result', file, line),
      finite(Math.cos(this.re) * Math.sinh(this.im), 'math.Complex.sin() result', file, line),
    );
  }

  cos(file: string, line: number): IdylliumComplex {
    const im = -Math.sin(this.re) * Math.sinh(this.im);
    return new IdylliumComplex(
      finite(Math.cos(this.re) * Math.cosh(this.im), 'math.Complex.cos() result', file, line),
      finite(im === 0 ? 0 : im, 'math.Complex.cos() result', file, line),
    );
  }

  tan(file: string, line: number): IdylliumComplex {
    const cosine = this.cos(file, line);
    if (cosine.re === 0 && cosine.im === 0) {
      throw new IdylliumRuntimeError(file, line, 'math.Complex.tan() does not exist where the cosine is zero');
    }
    return this.sin(file, line).divide(cosine, file, line);
  }

  sinh(file: string, line: number): IdylliumComplex {
    return new IdylliumComplex(
      finite(Math.sinh(this.re) * Math.cos(this.im), 'math.Complex.sinh() result', file, line),
      finite(Math.cosh(this.re) * Math.sin(this.im), 'math.Complex.sinh() result', file, line),
    );
  }

  cosh(file: string, line: number): IdylliumComplex {
    return new IdylliumComplex(
      finite(Math.cosh(this.re) * Math.cos(this.im), 'math.Complex.cosh() result', file, line),
      finite(Math.sinh(this.re) * Math.sin(this.im), 'math.Complex.cosh() result', file, line),
    );
  }

  // ── сравнение ──

  /** Точное равенство по частям — как у float; для вычисленных значений есть is_close. */
  equals(other: unknown): boolean {
    if (other instanceof IdylliumComplex) return this.re === other.re && this.im === other.im;
    if (typeof other === 'number') return this.im === 0 && this.re === other;
    if (typeof other === 'bigint') return this.im === 0 && this.re === Number(other);
    return false;
  }

  /** epsilon необязателен, поэтому контекст file/line приходит хвостом аргументов. */
  is_close(...rawArgs: unknown[]): boolean {
    const { values, file, line } = splitContextArgs(rawArgs);
    const [other, epsilon] = values;
    const w = IdylliumComplex.from(other, 'math.Complex.is_close()', file, line);
    const tolerance = epsilon === undefined ? 1e-9 : Number(epsilon);
    if (!Number.isFinite(tolerance) || tolerance < 0) {
      throw new IdylliumRuntimeError(file, line, `math.Complex.is_close() epsilon must be a non-negative number, got ${String(epsilon)}`);
    }
    return Math.hypot(this.re - w.re, this.im - w.im) <= tolerance;
  }

  // ── текст ──

  /** `3 + 4i`, `-2.5i`, `i`, `0`; части округляются как обычные числа при печати. */
  format(precision: number | null): string {
    const re = formatPart(this.re, precision);
    const im = formatPart(this.im, precision);
    const unit = (text: string): string => (text === '1' ? 'i' : text === '-1' ? '-i' : `${text}i`);
    if (im === '0') return re;
    if (re === '0') return unit(im);
    return im.startsWith('-') ? `${re} - ${unit(im.slice(1))}` : `${re} + ${unit(im)}`;
  }

  formatPolar(precision: number | null): string {
    const argument = formatPart(this.arg(), precision);
    return `${formatPart(this.abs(), precision)}(cos ${argument} + i sin ${argument})`;
  }

  to_string(): string {
    return this.format(8);
  }

  to_polar_string(): string {
    return this.formatPolar(8);
  }

  toString(): string {
    return this.to_string();
  }
}

/** Часть числа — теми же правилами, что float при печати: точность отбрасывает хвостовые нули, «−0» не бывает. */
function formatPart(value: number, precision: number | null): string {
  if (precision === null) return Object.is(value, -0) ? '0' : String(value);
  const rounded = Number(value.toFixed(precision));
  if (rounded === 0 && value !== 0) return String(value);
  return Object.is(rounded, -0) ? '0' : rounded.toString();
}

for (const name of ['plus', 'minus', 'multiply', 'divide', 'pow', 'roots', 'exp', 'ln', 'sin', 'cos', 'tan', 'sinh', 'cosh', 'is_close'] as const) {
  (IdylliumComplex.prototype[name] as unknown as ContextualRuntimeFunction).__idylliumPassContext = true;
}
