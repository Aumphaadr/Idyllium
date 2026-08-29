'use strict';
// Браузерный стаб node:path для esbuild-бандла ядра (перенос из прежнего
// самодельного бандлера): ровно то подмножество, которым пользуются ядро
// и fontkit; пути в браузере — только виртуальные /workspace-пути.

function normalize(value) {
  const raw = String(value).replace(/\\/g, '/');
  const absolute = raw.charAt(0) === '/';
  const parts = raw.split('/');
  const result = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') result.pop();
    else result.push(part);
  }
  return (absolute ? '/' : '') + result.join('/');
}

function basename(value, ext) {
  const name = normalize(value).split('/').pop() || '';
  return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
}

function dirname(value) {
  const normalized = normalize(value);
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return normalized.charAt(0) === '/' ? '/' : '.';
  return normalized.slice(0, index);
}

function isAbsolute(value) {
  return String(value).charAt(0) === '/';
}

function join() {
  return normalize(Array.prototype.join.call(arguments, '/'));
}

function resolve() {
  let value = '';
  for (let i = 0; i < arguments.length; i++) {
    const part = String(arguments[i]);
    value = part.charAt(0) === '/' ? part : value + '/' + part;
  }
  return normalize(value || '/');
}

module.exports = { basename, dirname, isAbsolute, join, normalize, resolve };
