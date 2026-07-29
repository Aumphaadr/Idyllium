// Библиотека hash: базовые «отпечатки» данных. Все алгоритмы реализованы
// здесь целиком и одинаково работают в CLI, WebIDE и VS Code — WebCrypto
// сознательно не используется (crypto.subtle недоступен на insecure-origin,
// а результат обязан совпадать во всех трёх клиентах).

// CRC-32 (IEEE 802.3, полином 0xEDB88320) — тот же, что в ZIP и PNG.
const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? (value >>> 1) ^ 0xEDB88320 : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

export function hashCrc32(bytes: readonly number[]): number {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// FNV-1a (32 бита) — самый простой «честный» хеш; ученик пишет его руками
// на types.uint32 и сверяет с этой функцией.
export function hashFnv1a(bytes: readonly number[]): number {
  let hash = 0x811C9DC5;
  for (const byte of bytes) {
    hash = (hash ^ byte) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// Adler-32 (RFC 1950) — быстрая контрольная сумма из zlib.
export function hashAdler32(bytes: readonly number[]): number {
  let low = 1;
  let high = 0;
  for (const byte of bytes) {
    low = (low + byte) % 65521;
    high = (high + low) % 65521;
  }
  return ((high * 65536) + low) >>> 0;
}

const SHA256_K = new Uint32Array([
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
]);

function rotateRight(value: number, shift: number): number {
  return ((value >>> shift) | (value << (32 - shift))) >>> 0;
}

/** SHA-256 (FIPS 180-4) — возвращает 32 байта дайджеста. */
export function hashSha256Bytes(bytes: readonly number[]): number[] {
  const state = new Uint32Array([
    0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
    0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
  ]);

  // Паддинг: байт 0x80, нули, затем длина в битах (64 бита, big-endian).
  const bitLength = bytes.length * 8;
  const padded = [...bytes, 0x80];
  while (padded.length % 64 !== 56) padded.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded.push((high >>> 24) & 0xFF, (high >>> 16) & 0xFF, (high >>> 8) & 0xFF, high & 0xFF);
  padded.push((low >>> 24) & 0xFF, (low >>> 16) & 0xFF, (low >>> 8) & 0xFF, low & 0xFF);

  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const base = offset + index * 4;
      schedule[index] = (
        (padded[base] << 24) | (padded[base + 1] << 16) | (padded[base + 2] << 8) | padded[base + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index++) {
      const s0 = rotateRight(schedule[index - 15], 7) ^ rotateRight(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3);
      const s1 = rotateRight(schedule[index - 2], 17) ^ rotateRight(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10);
      schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const S1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + choose + SHA256_K[index] + schedule[index]) >>> 0;
      const S0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest: number[] = [];
  for (const word of state) {
    digest.push((word >>> 24) & 0xFF, (word >>> 16) & 0xFF, (word >>> 8) & 0xFF, word & 0xFF);
  }
  return digest;
}

/** Тот же SHA-256 в виде 64 hex-символов нижнего регистра (как sha256sum и git). */
export function hashSha256Hex(bytes: readonly number[]): string {
  return hashSha256Bytes(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
