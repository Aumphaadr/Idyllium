// ZIP проекта: скачивание (stored — без сжатия, чтобы писать без библиотек)
// и импорт. Импорт понимает и обычные архивы со сжатием deflate — их
// распаковывает pako (он и так живёт в зависимостях ядра ради fontkit);
// с переездом сборки app.js на esbuild npm-импорт стал доступен (2026-08-29,
// находка владельца: «только свой ZIP» отвергал любой архив со сжатием).
import pako from 'pako';

import { CRC32_TABLE, zipHeader, dosTime, concatBytes, crc32, buildCrc32Table, zipBytes } from './zip-write.js';
export { CRC32_TABLE, zipHeader, dosTime, concatBytes, crc32, buildCrc32Table, zipBytes };

export function unzipEntries(bytes) {
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

    // Флаг data descriptor мешает только потоковым архивам с нулевыми
    // размерами в локальном заголовке — обычные архиваторы размеры пишут.
    if ((flags & 0x0008) !== 0 && compressedSize === 0 && uncompressedSize !== 0) {
      throw new Error('этот ZIP записан потоком (data descriptor) — пересохраните его обычным архиватором');
    }
    if (method !== 0 && method !== 8) {
      throw new Error(`способ сжатия ${method} в ZIP не поддерживается (понимаем обычный deflate и без сжатия)`);
    }
    if (dataEnd > bytes.length) throw new Error('ZIP-архив повреждён');

    const name = new TextDecoder('utf-8').decode(bytes.slice(nameStart, nameStart + nameLength));
    const raw = bytes.slice(dataStart, dataEnd);
    let data = raw;
    if (method === 8) {
      try {
        data = pako.inflateRaw(raw);
      } catch (error) {
        throw new Error(`Файл ${name} в ZIP не распаковался: ${error && error.message ? error.message : error}`);
      }
    }
    if (data.length !== uncompressedSize) throw new Error(`Файл ${name} в ZIP имеет неверный размер`);
    if (crc32(data) !== expectedCrc) throw new Error(`Файл ${name} в ZIP повреждён`);
    entries.push({ name, bytes: data, directory: name.endsWith('/') });

    offset = dataEnd;
  }
  return entries;
}
