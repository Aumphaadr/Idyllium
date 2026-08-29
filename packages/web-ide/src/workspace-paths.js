// Пути рабочего пространства Web IDE (/workspace) и тексты для ученика:
// нормализация, короткие имена, срез служебного префикса из диагностик.

export const WORKSPACE_ROOT = '/workspace';
export const MAIN_FILE = WORKSPACE_ROOT + '/main.idyl';

export function itemName(path) {
  return normalizeWorkspacePath(path).split('/').pop() || '';
}

// Путь ученика — тот, что пишется в file.open(): относительно корня проекта.
export function studentPath(path) {
  const normalized = normalizeWorkspacePath(path);
  if (normalized === WORKSPACE_ROOT) return '';
  return normalized.startsWith(WORKSPACE_ROOT + '/') ? normalized.slice(WORKSPACE_ROOT.length + 1) : normalized;
}

export function normalizeWorkspacePath(path) {
  const input = String(path).replace(/\\/g, '/');
  const raw = input === WORKSPACE_ROOT
    ? ''
    : input.startsWith(WORKSPACE_ROOT + '/')
      ? input.slice((WORKSPACE_ROOT + '/').length)
    : input.replace(/^\/+/, '');
  const parts = raw.split('/');
  const normalized = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.length === 0 ? WORKSPACE_ROOT : WORKSPACE_ROOT + '/' + normalized.join('/');
}

export function shortFileName(file) {
  const path = normalizeWorkspacePath(file);
  return path === WORKSPACE_ROOT ? '' : path.slice((WORKSPACE_ROOT + '/').length);
}

export function basename(path) {
  const short = shortFileName(path);
  const parts = short.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'workspace';
}

export function parentPath(path) {
  path = normalizeWorkspacePath(path);
  if (path === WORKSPACE_ROOT) return WORKSPACE_ROOT;
  const short = shortFileName(path);
  const parts = short.split('/').filter(Boolean);
  parts.pop();
  return parts.length === 0 ? WORKSPACE_ROOT : normalizeWorkspacePath(parts.join('/'));
}

export function formatThrownError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return formatDiagnosticText(text);
}

export function formatDiagnosticText(text) {
  return String(text)
    .replaceAll(WORKSPACE_ROOT + '/', '')
    .replace(/(^|\n)([^:\n]+):(\d+):\d+:(?=\s)/gu, '$1$2:$3:');
}
