"use strict";
// src/web/fs/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_EXTENSIONS = void 0;
exports.getExtension = getExtension;
exports.isTextFile = isTextFile;
exports.normalizePath = normalizePath;
exports.getParentPath = getParentPath;
exports.getFileName = getFileName;
exports.joinPath = joinPath;
exports.ALLOWED_EXTENSIONS = new Set([
    '.idyl',
    '.txt',
    '.json',
    '.md',
    '.csv',
    '.xml',
    '.html',
    '.css',
    '.js',
]);
function getExtension(filename) {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.substring(dot) : '';
}
function isTextFile(filename) {
    const ext = getExtension(filename);
    return ext === '' || exports.ALLOWED_EXTENSIONS.has(ext);
}
function normalizePath(path) {
    let normalized = path.replace(/\/+/g, '/');
    if (!normalized.startsWith('/')) {
        normalized = '/' + normalized;
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}
function getParentPath(path) {
    const normalized = normalizePath(path);
    if (normalized === '/')
        return null;
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash === 0 ? '/' : normalized.substring(0, lastSlash);
}
function getFileName(path) {
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return normalized.substring(lastSlash + 1);
}
function joinPath(...parts) {
    return normalizePath(parts.join('/'));
}
//# sourceMappingURL=types.js.map