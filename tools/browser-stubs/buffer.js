'use strict';
// Браузерный стаб node:buffer поверх Uint8Array (перенос из прежнего
// бандлера): подмножество, которого хватает ядру и fontkit — from/alloc,
// utf-8 toString и BE-доступ к float-полям таблиц шрифтов.

function enhanceBuffer(bytes) {
  bytes.toString = function toString(encoding) {
    if (!encoding || String(encoding).toLowerCase() === 'utf8' || String(encoding).toLowerCase() === 'utf-8') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    throw new Error('Unsupported browser buffer encoding: ' + encoding);
  };
  bytes.writeFloatBE = function writeFloatBE(value, offset) {
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat32(offset, value, false);
  };
  bytes.writeDoubleBE = function writeDoubleBE(value, offset) {
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat64(offset, value, false);
  };
  bytes.readFloatBE = function readFloatBE(offset) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(offset, false);
  };
  bytes.readDoubleBE = function readDoubleBE(offset) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(offset, false);
  };
  return bytes;
}

function BrowserBuffer(length) {
  return new Uint8Array(length);
}

BrowserBuffer.alloc = function alloc(length) {
  return enhanceBuffer(new Uint8Array(length));
};

BrowserBuffer.from = function from(value) {
  if (typeof value === 'string') {
    return enhanceBuffer(new TextEncoder().encode(value));
  }
  return enhanceBuffer(new Uint8Array(value));
};

module.exports = { Buffer: BrowserBuffer };
