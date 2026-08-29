// Распознавание бинарных форматов по сигнатурам и человеческие подписи:
// MIME по имени и байтам, альфа-канал картинок, размеры и длительности.

export function bytesToDataUrl(fileName, bytes) {
  return bytesToDataUrlWithMime(mimeTypeForFile(fileName), bytes);
}

export function bytesToDataUrlWithMime(mime, bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function mimeTypeForFile(fileName) {
  const name = fileName.toLowerCase();
  if (name.endsWith('.idyl')) return 'text/x-idyllium';
  if (name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.csv')) return 'text/csv';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'text/markdown';
  if (name.endsWith('.xml')) return 'application/xml';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'text/html';
  if (name.endsWith('.css')) return 'text/css';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  if (name.endsWith('.ttf')) return 'font/ttf';
  if (name.endsWith('.otf')) return 'font/otf';
  if (name.endsWith('.woff')) return 'font/woff';
  if (name.endsWith('.woff2')) return 'font/woff2';
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.ogg')) return 'audio/ogg';
  if (name.endsWith('.aac')) return 'audio/aac';
  if (name.endsWith('.m4a')) return 'audio/mp4';
  if (isSqliteFile(name)) return 'application/vnd.sqlite3';
  return 'application/octet-stream';
}

export function detectAssetMimeType(fileName, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return mimeTypeForFile(fileName);
  if (asciiBytes(bytes, 0, 16) === 'SQLite format 3\0') return 'application/vnd.sqlite3';
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) return 'image/png';
  if (hasBytes(bytes, [0xff, 0xd8, 0xff], 0)) return 'image/jpeg';
  const header6 = asciiBytes(bytes, 0, 6);
  if (header6 === 'GIF87a' || header6 === 'GIF89a') return 'image/gif';
  if (asciiBytes(bytes, 0, 4) === 'RIFF' && asciiBytes(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (asciiBytes(bytes, 0, 4) === 'RIFF' && asciiBytes(bytes, 8, 4) === 'WAVE') return 'audio/wav';
  if (hasBytes(bytes, [0x49, 0x44, 0x33], 0) || mp3FrameHeader(bytes)) return 'audio/mpeg';
  if (asciiBytes(bytes, 0, 4) === 'OggS') return 'audio/ogg';
  if (aacHeader(bytes)) return 'audio/aac';
  if (asciiBytes(bytes, 4, 4) === 'ftyp') return 'audio/mp4';
  if (hasBytes(bytes, [0x00, 0x01, 0x00, 0x00], 0) || asciiBytes(bytes, 0, 4) === 'true') return 'font/ttf';
  if (asciiBytes(bytes, 0, 4) === 'OTTO') return 'font/otf';
  if (asciiBytes(bytes, 0, 4) === 'wOFF') return 'font/woff';
  if (asciiBytes(bytes, 0, 4) === 'wOF2') return 'font/woff2';
  if (looksLikeSvg(bytes)) return 'image/svg+xml';
  return mimeTypeForFile(fileName);
}

export function isSqliteFile(fileName) {
  return /\.(?:db|db3|sqlite|sqlite3)$/iu.test(fileName);
}

export function fontFormatName(mime) {
  if (mime === 'font/ttf') return 'TTF';
  if (mime === 'font/otf') return 'OTF';
  if (mime === 'font/woff') return 'WOFF';
  if (mime === 'font/woff2') return 'WOFF2';
  return 'неизвестно';
}

export function mp3FrameHeader(bytes) {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

export function aacHeader(bytes) {
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
}

export function imageAlphaInfo(mime, bytes) {
  if (mime === 'image/jpeg') return 'нет';
  if (mime === 'image/svg+xml') return 'возможно';
  if (mime === 'image/png') return pngAlphaInfo(bytes);
  if (mime === 'image/gif') return gifAlphaInfo(bytes);
  if (mime === 'image/webp') return webpAlphaInfo(bytes);
  if (mime.startsWith('image/')) return 'неизвестно';
  return 'нет';
}

export function pngAlphaInfo(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 33 || !hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) {
    return 'неизвестно';
  }
  const colorType = bytes[25];
  if (colorType === 4 || colorType === 6) return 'есть';
  return pngHasTransparencyChunk(bytes) ? 'есть' : 'нет';
}

export function pngHasTransparencyChunk(bytes) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = asciiBytes(bytes, offset + 4, 4);
    if (type === 'tRNS') return true;
    if (type === 'IEND') return false;
    offset += 12 + length;
  }
  return false;
}

export function gifAlphaInfo(bytes) {
  for (let index = 0; index + 5 < bytes.length; index++) {
    if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) {
      if ((bytes[index + 3] & 0x01) === 0x01) return 'есть';
    }
  }
  return 'нет';
}

export function webpAlphaInfo(bytes) {
  if (asciiBytes(bytes, 0, 4) !== 'RIFF' || asciiBytes(bytes, 8, 4) !== 'WEBP') return 'неизвестно';
  if (asciiBytes(bytes, 12, 4) === 'VP8X' && bytes.length > 20) {
    return (bytes[20] & 0x10) === 0x10 ? 'есть' : 'нет';
  }
  return 'неизвестно';
}

export function looksLikeSvg(bytes) {
  const sample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart().toLowerCase();
  return sample.startsWith('<svg') || sample.startsWith('<?xml') && sample.includes('<svg');
}

export function hasBytes(bytes, expected, offset) {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

export function asciiBytes(bytes, offset, length) {
  if (bytes.length < offset + length) return '';
  let text = '';
  for (let index = 0; index < length; index++) text += String.fromCharCode(bytes[offset + index]);
  return text;
}

export function readUint32(bytes, offset) {
  if (bytes.length < offset + 4) return 0;
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function formatBytes(size) {
  if (!Number.isFinite(size) || size < 0) return 'неизвестно';
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${trimFileSize(size / 1024)} КБ`;
  return `${trimFileSize(size / (1024 * 1024))} МБ`;
}

export function trimFileSize(value) {
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'неизвестно';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function dataUrlBytes(value) {
  const comma = value.indexOf(',');
  if (comma < 0) return new Uint8Array();
  const meta = value.slice(0, comma);
  const data = value.slice(comma + 1);
  if (meta.includes(';base64')) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(data));
}

// Байты элемента проекта: ассет отдаёт их прямо, текст кодируется UTF-8.
export function assetBytes(item) {
  if (item.bytes instanceof Uint8Array) return item.bytes;
  if (item.resourceUri && item.resourceUri.startsWith('data:')) return dataUrlBytes(item.resourceUri);
  return new TextEncoder().encode(item.content || '');
}
