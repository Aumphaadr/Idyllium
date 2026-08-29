// Самописный ZIP без сжатия: скачивание и импорт проекта одним файлом.
// Хранение stored-методом — чтобы обходиться без библиотек и Worker.

export const CRC32_TABLE = buildCrc32Table();

export function zipBytes(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const data = entry.bytes;
    const crc = crc32(data);
    const localHeader = zipHeader(30);
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0x0800, true);
    localHeader.setUint16(8, 0, true);
    localHeader.setUint16(10, dosTime().time, true);
    localHeader.setUint16(12, dosTime().date, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, data.length, true);
    localHeader.setUint32(22, data.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);

    chunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);

    const centralHeader = zipHeader(46);
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0x0800, true);
    centralHeader.setUint16(10, 0, true);
    centralHeader.setUint16(12, dosTime().time, true);
    centralHeader.setUint16(14, dosTime().date, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, data.length, true);
    centralHeader.setUint32(24, data.length, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);

    central.push(new Uint8Array(centralHeader.buffer), nameBytes);
    offset += localHeader.byteLength + nameBytes.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = zipHeader(22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralOffset, true);
  end.setUint16(20, 0, true);

  return concatBytes([...chunks, ...central, new Uint8Array(end.buffer)]);
}

export function unzipStoredEntries(bytes) {
  const entries = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) throw new Error('ZIP-архив имеет неподдерживаемый формат');
    if (offset + 30 > bytes.length) throw new Error('ZIP-архив повреждён');

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const expectedCrc = view.getUint32(offset + 14, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if ((flags & 0x0008) !== 0) throw new Error('ZIP-архив с data descriptor пока не поддерживается');
    if (method !== 0) throw new Error('Поддерживается только ZIP без сжатия. Скачанный из IDE проект можно импортировать обратно.');
    if (dataEnd > bytes.length) throw new Error('ZIP-архив повреждён');

    const name = new TextDecoder('utf-8').decode(bytes.slice(nameStart, nameStart + nameLength));
    const data = bytes.slice(dataStart, dataEnd);
    if (data.length !== uncompressedSize) throw new Error(`Файл ${name} в ZIP имеет неверный размер`);
    if (crc32(data) !== expectedCrc) throw new Error(`Файл ${name} в ZIP повреждён`);
    entries.push({ name, bytes: data, directory: name.endsWith('/') });

    offset = dataEnd;
  }
  return entries;
}

export function zipHeader(size) {
  return new DataView(new ArrayBuffer(size));
}

export function dosTime() {
  const now = new Date();
  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
    date: ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
  };
}

export function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}
