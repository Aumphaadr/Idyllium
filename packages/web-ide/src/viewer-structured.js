// Рендеры структурированных текстовых файлов: таблица CSV (Papa Parse),
// дерево JSON, предпросмотр Markdown (marked + DOMPurify). Экранные
// обёртки show*/тумблер остаются в ядре — здесь только построение DOM.

import { csvViewer, jsonViewer, markdownViewer } from './dom.js';
import { files } from './project-store.js';
import { viewerHost } from './viewer-host.js';
import { assetBytes, bytesToDataUrl } from './binary-format.js';
import { normalizeWorkspacePath, parentPath, shortFileName } from './workspace-paths.js';

export const CSV_ROW_RENDER_LIMIT = 500;
export const CSV_COLUMN_RENDER_LIMIT = 100;
export const JSON_NODE_RENDER_LIMIT = 5000;
export const JSON_DEPTH_RENDER_LIMIT = 64;

export const csvHeaderModes = new Map();

export function renderCsvTable(file, source) {
  if (!csvViewer) return;
  if (!window.Papa || typeof window.Papa.parse !== 'function') {
    const unavailable = document.createElement('div');
    unavailable.className = 'csv-empty';
    unavailable.textContent = 'Не удалось загрузить модуль просмотра CSV';
    csvViewer.appendChild(unavailable);
    return;
  }

  const result = window.Papa.parse(source, {
    delimiter: '',
    newline: '',
    quoteChar: '"',
    escapeChar: '"',
    header: false,
    dynamicTyping: false,
    skipEmptyLines: false,
  });
  const rows = source.length === 0
    ? []
    : result.data.map((row) => (Array.isArray(row) ? row : [row]).map((value) => String(value ?? '')));

  if (/\r?\n$/u.test(source) && rows.length > 0 && rows.at(-1).every((value) => value === '')) {
    rows.pop();
  }

  let columnCount = 0;
  for (const row of rows) columnCount = Math.max(columnCount, row.length);
  const firstRowIsHeader = csvHeaderModes.get(file) ?? true;
  const dataRowCount = Math.max(0, rows.length - (firstRowIsHeader ? 1 : 0));
  const messages = csvMessages(result.errors || [], rows, columnCount);
  if (dataRowCount > CSV_ROW_RENDER_LIMIT) {
    messages.push({
      text: `Показаны первые ${CSV_ROW_RENDER_LIMIT} строк данных из ${dataRowCount}`,
      error: false,
    });
  }
  if (columnCount > CSV_COLUMN_RENDER_LIMIT) {
    messages.push({
      text: `Показаны первые ${CSV_COLUMN_RENDER_LIMIT} столбцов из ${columnCount}`,
      error: false,
    });
  }

  csvViewer.appendChild(createCsvToolbar(file, source, rows.length, columnCount, result.meta?.delimiter || '', firstRowIsHeader));
  if (messages.length > 0) csvViewer.appendChild(createCsvMessages(messages));

  if (rows.length === 0 || columnCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'csv-empty';
    empty.textContent = 'CSV-файл пуст';
    csvViewer.appendChild(empty);
    return;
  }

  csvViewer.appendChild(createCsvTable(rows, columnCount, firstRowIsHeader));
}

export function createCsvToolbar(file, source, rowCount, columnCount, delimiter, firstRowIsHeader) {
  const toolbar = document.createElement('div');
  toolbar.className = 'csv-toolbar';

  const summary = document.createElement('div');
  summary.className = 'csv-summary';
  summary.textContent = `Строк: ${rowCount} · столбцов: ${columnCount} · разделитель: ${formatCsvDelimiter(delimiter)}`;
  toolbar.appendChild(summary);

  const option = document.createElement('label');
  option.className = 'csv-header-option';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = firstRowIsHeader;
  checkbox.disabled = rowCount === 0;
  checkbox.addEventListener('change', () => {
    csvHeaderModes.set(file, checkbox.checked);
    csvViewer.replaceChildren();
    renderCsvTable(file, source);
  });
  option.appendChild(checkbox);
  option.append('Первая строка — заголовки');
  toolbar.appendChild(option);
  return toolbar;
}

export function createCsvMessages(messages) {
  const container = document.createElement('div');
  container.className = 'csv-messages';
  for (const message of messages.slice(0, 6)) {
    const item = document.createElement('p');
    item.className = 'csv-message' + (message.error ? ' csv-message-error' : '');
    item.textContent = message.text;
    container.appendChild(item);
  }
  if (messages.length > 6) {
    const rest = document.createElement('p');
    rest.className = 'csv-message';
    rest.textContent = `И ещё предупреждений: ${messages.length - 6}`;
    container.appendChild(rest);
  }
  return container;
}

export function csvMessages(errors, rows, columnCount) {
  const messages = [];
  for (const error of errors) {
    if (error.code === 'UndetectableDelimiter' && columnCount <= 1) continue;
    messages.push({ text: formatCsvError(error), error: error.type === 'Quotes' });
  }

  const irregularRows = [];
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].length !== columnCount) irregularRows.push(index + 1);
  }
  if (irregularRows.length > 0) {
    const shown = irregularRows.slice(0, 8).join(', ');
    const rest = irregularRows.length > 8 ? ` и ещё ${irregularRows.length - 8}` : '';
    messages.push({
      text: `В строках разное количество столбцов. Проверь строки: ${shown}${rest}`,
      error: false,
    });
  }
  return messages;
}

export function formatCsvError(error) {
  const row = Number.isInteger(error.row) ? `Строка ${error.row + 1}: ` : '';
  const descriptions = {
    MissingQuotes: 'не закрыта двойная кавычка',
    InvalidQuotes: 'кавычка расположена неправильно',
    TooFewFields: 'слишком мало значений',
    TooManyFields: 'слишком много значений',
    UndetectableDelimiter: 'не удалось уверенно определить разделитель',
  };
  return row + (descriptions[error.code] || `ошибка CSV (${error.code || error.type || 'неизвестная'})`);
}

export function formatCsvDelimiter(delimiter) {
  const names = {
    ',': 'запятая (,)',
    ';': 'точка с запятой (;)',
    '\t': 'табуляция',
    '|': 'вертикальная черта (|)',
  };
  return names[delimiter] || (delimiter ? `«${delimiter}»` : 'не определён');
}

export function createCsvTable(rows, columnCount, firstRowIsHeader) {
  const scroll = document.createElement('div');
  scroll.className = 'csv-table-scroll';
  const table = document.createElement('table');
  table.className = 'csv-table';
  const renderedColumnCount = Math.min(columnCount, CSV_COLUMN_RENDER_LIMIT);

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  appendCsvCell(headerRow, '#', 'th', 'csv-row-number');
  for (let column = 0; column < renderedColumnCount; column++) {
    const value = firstRowIsHeader ? rows[0]?.[column] || `Столбец ${column + 1}` : `Столбец ${column + 1}`;
    appendCsvCell(headerRow, value, 'th');
  }
  head.appendChild(headerRow);
  table.appendChild(head);

  const body = document.createElement('tbody');
  const firstDataIndex = firstRowIsHeader ? 1 : 0;
  const lastDataIndex = Math.min(rows.length, firstDataIndex + CSV_ROW_RENDER_LIMIT);
  for (let rowIndex = firstDataIndex; rowIndex < lastDataIndex; rowIndex++) {
    const rowElement = document.createElement('tr');
    appendCsvCell(rowElement, String(rowIndex - firstDataIndex + 1), 'th', 'csv-row-number');
    for (let column = 0; column < renderedColumnCount; column++) {
      appendCsvCell(rowElement, rows[rowIndex][column] || '', 'td');
    }
    body.appendChild(rowElement);
  }
  table.appendChild(body);
  scroll.appendChild(table);
  return scroll;
}

export function appendCsvCell(row, value, tagName, className = '') {
  const cell = document.createElement(tagName);
  if (className) cell.className = className;
  if (tagName === 'th') cell.scope = className === 'csv-row-number' ? 'row' : 'col';
  cell.textContent = value;
  if (value.length > 120) cell.title = value.slice(0, 1000);
  row.appendChild(cell);
}

export function renderJsonTree(file, source) {
  if (!jsonViewer) return;
  if (source.trim().length === 0) {
    const empty = document.createElement('div');
    empty.className = 'json-empty';
    empty.textContent = 'JSON-файл пуст';
    jsonViewer.appendChild(empty);
    return;
  }

  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    jsonViewer.appendChild(createJsonError(source, error));
    return;
  }

  const state = {
    count: 0,
    compositeCount: 0,
    truncated: false,
    limitMarkerCreated: false,
    depthTruncated: false,
  };
  const tree = document.createElement('div');
  tree.className = 'json-tree';
  tree.appendChild(createJsonNode(value, 'Корень', 'root', 0, state));

  jsonViewer.appendChild(createJsonToolbar(value, state));
  if (state.truncated || state.depthTruncated) {
    const warning = document.createElement('p');
    warning.className = 'json-render-warning';
    warning.textContent = state.truncated
      ? `Показаны первые ${JSON_NODE_RENDER_LIMIT} узлов. Полный JSON остаётся доступен в текстовом режиме.`
      : `Вложенность глубже ${JSON_DEPTH_RENDER_LIMIT} уровней скрыта. Полный JSON остаётся доступен в текстовом режиме.`;
    jsonViewer.appendChild(warning);
  }

  const scroll = document.createElement('div');
  scroll.className = 'json-tree-scroll';
  scroll.appendChild(tree);
  jsonViewer.appendChild(scroll);
}

export function renderMarkdownPreview(file, source) {
  if (!markdownViewer) return;
  if (!window.marked || typeof window.marked.parse !== 'function'
    || !window.DOMPurify || typeof window.DOMPurify.sanitize !== 'function') {
    appendMarkdownMessage('Не удалось загрузить модуль просмотра Markdown');
    return;
  }
  if (source.trim().length === 0) {
    appendMarkdownMessage('Markdown-файл пуст');
    return;
  }

  let rendered;
  try {
    rendered = window.marked.parse(source.replace(/^[\u200B-\u200F\uFEFF]/u, ''), {
      async: false,
      breaks: false,
      gfm: true,
    });
  } catch (error) {
    appendMarkdownMessage(`Markdown не удалось разобрать: ${error instanceof Error ? error.message : String(error)}`, true);
    return;
  }

  const documentElement = document.createElement('article');
  documentElement.className = 'markdown-document';
  documentElement.innerHTML = window.DOMPurify.sanitize(String(rendered), {
    FORBID_ATTR: ['style'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    SANITIZE_NAMED_PROPS: true,
    USE_PROFILES: { html: true },
  });
  prepareMarkdownLinks(documentElement, file);
  prepareMarkdownImages(documentElement, file);
  markdownViewer.appendChild(documentElement);
}

export function appendMarkdownMessage(message, error = false) {
  const element = document.createElement('div');
  element.className = `markdown-empty${error ? ' markdown-error' : ''}`;
  element.textContent = message;
  markdownViewer.appendChild(element);
}

export function prepareMarkdownLinks(documentElement, file) {
  for (const link of documentElement.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') || '';
    if (/^(?:https?:|mailto:)/iu.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      continue;
    }
    if (href.startsWith('#')) continue;
    const target = markdownWorkspaceTarget(file, href);
    if (!target || !files.has(target)) {
      link.addEventListener('click', (event) => event.preventDefault());
      link.title = 'Файл не найден в текущем проекте';
      continue;
    }
    link.addEventListener('click', (event) => {
      event.preventDefault();
      viewerHost.openFile(target);
    });
  }
}

export function prepareMarkdownImages(documentElement, file) {
  for (const image of documentElement.querySelectorAll('img[src]')) {
    const source = image.getAttribute('src') || '';
    if (/^(?:https?:|data:|blob:)/iu.test(source)) continue;
    const target = markdownWorkspaceTarget(file, source);
    const item = target ? files.get(target) : null;
    if (!item || item.kind !== 'asset') continue;
    const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
    image.src = bytes.length > 0 ? bytesToDataUrl(target, bytes) : item.resourceUri || source;
  }
}

export function markdownWorkspaceTarget(file, reference) {
  const pathOnly = String(reference).split(/[?#]/u, 1)[0];
  if (!pathOnly) return '';
  let decoded;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    decoded = pathOnly;
  }
  if (decoded.startsWith('/')) return normalizeWorkspacePath(decoded);
  const parent = shortFileName(parentPath(file));
  return normalizeWorkspacePath(parent ? `${parent}/${decoded}` : decoded);
}

export function createJsonToolbar(value, state) {
  const toolbar = document.createElement('div');
  toolbar.className = 'json-toolbar';

  const summary = document.createElement('div');
  summary.className = 'json-summary';
  summary.textContent = `${describeJsonRoot(value)} · показано узлов: ${state.count}`;
  toolbar.appendChild(summary);

  const actions = document.createElement('div');
  actions.className = 'json-toolbar-actions';
  const expand = createJsonToolbarButton('Развернуть всё', () => {
    for (const details of jsonViewer.querySelectorAll('details')) details.open = true;
  });
  const collapse = createJsonToolbarButton('Свернуть всё', () => {
    for (const details of jsonViewer.querySelectorAll('details')) details.open = false;
  });
  expand.disabled = state.compositeCount === 0;
  collapse.disabled = state.compositeCount === 0;
  actions.append(expand, collapse);
  toolbar.appendChild(actions);
  return toolbar;
}

export function createJsonToolbarButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'json-toolbar-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function createJsonNode(value, label, labelKind, depth, state) {
  state.count++;
  const node = document.createElement('div');
  node.className = 'json-node';
  const composite = value !== null && typeof value === 'object';

  if (!composite) {
    const line = document.createElement('div');
    line.className = 'json-node-line json-leaf';
    appendJsonLabel(line, label, labelKind);
    appendJsonPrimitive(line, value);
    node.appendChild(line);
    return node;
  }

  const keys = Array.isArray(value) ? value.map((_, index) => index) : Object.keys(value);
  const collectionKind = Array.isArray(value) ? 'array' : 'object';
  if (keys.length === 0 || depth >= JSON_DEPTH_RENDER_LIMIT) {
    const line = document.createElement('div');
    line.className = 'json-node-line json-leaf';
    appendJsonLabel(line, label, labelKind);
    appendJsonCollectionPreview(line, collectionKind, keys.length);
    if (depth >= JSON_DEPTH_RENDER_LIMIT && keys.length > 0) {
      state.depthTruncated = true;
      const hidden = document.createElement('span');
      hidden.className = 'json-meta';
      hidden.textContent = ' вложенность скрыта';
      line.appendChild(hidden);
    }
    node.appendChild(line);
    return node;
  }

  state.compositeCount++;
  const details = document.createElement('details');
  details.className = 'json-composite';
  details.open = depth === 0;
  const summary = document.createElement('summary');
  summary.className = 'json-node-line';
  appendJsonLabel(summary, label, labelKind);
  appendJsonCollectionPreview(summary, collectionKind, keys.length);
  details.appendChild(summary);

  const children = document.createElement('div');
  children.className = 'json-children';
  for (const key of keys) {
    if (state.count >= JSON_NODE_RENDER_LIMIT) {
      state.truncated = true;
      if (!state.limitMarkerCreated) {
        state.limitMarkerCreated = true;
        children.appendChild(createJsonLimitMarker());
      }
      break;
    }
    const child = Array.isArray(value)
      ? createJsonNode(value[key], `[${key}]`, 'index', depth + 1, state)
      : createJsonNode(value[key], key, 'key', depth + 1, state);
    children.appendChild(child);
  }
  details.appendChild(children);
  node.appendChild(details);
  return node;
}

export function appendJsonLabel(parent, label, kind) {
  const key = document.createElement('span');
  key.className = kind === 'root' ? 'json-root-label' : kind === 'index' ? 'json-index' : 'json-key';
  key.textContent = kind === 'key' ? JSON.stringify(label) : label;
  parent.appendChild(key);

  const separator = document.createElement('span');
  separator.className = 'json-punctuation';
  separator.textContent = ': ';
  parent.appendChild(separator);
}

export function appendJsonPrimitive(parent, value) {
  const type = value === null ? 'null' : typeof value;
  const rendered = type === 'string' ? JSON.stringify(value) : String(value);
  const token = document.createElement('span');
  token.className = `json-value json-value-${type}`;
  token.textContent = rendered;
  parent.appendChild(token);
}

export function appendJsonCollectionPreview(parent, kind, count) {
  const punctuation = document.createElement('span');
  punctuation.className = 'json-punctuation';
  punctuation.textContent = kind === 'array'
    ? count === 0 ? '[]' : '[…]'
    : count === 0 ? '{}' : '{…}';
  parent.appendChild(punctuation);

  const meta = document.createElement('span');
  meta.className = 'json-meta';
  meta.textContent = kind === 'array'
    ? ` ${formatRussianCount(count, ['элемент', 'элемента', 'элементов'])}`
    : ` ${formatRussianCount(count, ['поле', 'поля', 'полей'])}`;
  parent.appendChild(meta);
}

export function createJsonLimitMarker() {
  const marker = document.createElement('div');
  marker.className = 'json-node-line json-limit-marker';
  marker.textContent = 'Остальные узлы скрыты';
  return marker;
}

export function describeJsonRoot(value) {
  if (Array.isArray(value)) {
    return `Корень: массив · ${formatRussianCount(value.length, ['элемент', 'элемента', 'элементов'])}`;
  }
  if (value !== null && typeof value === 'object') {
    return `Корень: объект · ${formatRussianCount(Object.keys(value).length, ['поле', 'поля', 'полей'])}`;
  }
  const names = {
    string: 'строка',
    number: 'число',
    boolean: 'логическое значение',
    null: 'null',
  };
  const type = value === null ? 'null' : typeof value;
  return `Корень: ${names[type] || type}`;
}

export function formatRussianCount(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const form = mod10 === 1 && mod100 !== 11
    ? forms[0]
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? forms[1]
      : forms[2];
  return `${count} ${form}`;
}

export function createJsonError(source, error) {
  const location = jsonErrorLocation(source, error);
  const card = document.createElement('div');
  card.className = 'json-error';

  const title = document.createElement('strong');
  title.textContent = 'JSON не удалось разобрать';
  card.appendChild(title);

  const description = document.createElement('p');
  description.textContent = `${location.label}${describeJsonSyntaxError(error)}`;
  card.appendChild(description);

  if (location.lineText !== '') {
    const snippet = document.createElement('pre');
    snippet.className = 'json-error-snippet';
    snippet.textContent = `${location.lineText}\n${' '.repeat(Math.max(0, location.column - 1))}^`;
    card.appendChild(snippet);
  }

  const hint = document.createElement('p');
  hint.className = 'json-error-hint';
  hint.textContent = 'Вернитесь в режим «Текст», исправьте JSON и откройте дерево снова.';
  card.appendChild(hint);
  return card;
}

export function jsonErrorLocation(source, error) {
  const message = String(error?.message || '');
  const lineColumn = message.match(/line\s+(\d+)\s+column\s+(\d+)/iu);
  if (lineColumn) {
    const line = Number(lineColumn[1]);
    const column = Number(lineColumn[2]);
    return {
      line,
      column,
      lineText: source.split(/\r\n|\r|\n/u)[line - 1] || '',
      label: `Строка ${line}, столбец ${column}: `,
    };
  }

  const positionMatch = message.match(/position\s+(\d+)/iu);
  const position = positionMatch ? Number(positionMatch[1]) : source.length;
  const before = source.slice(0, position);
  const lines = before.split(/\r\n|\r|\n/u);
  const line = lines.length;
  const column = (lines.at(-1)?.length || 0) + 1;
  return {
    line,
    column,
    lineText: source.split(/\r\n|\r|\n/u)[line - 1] || '',
    label: `Строка ${line}, столбец ${column}: `,
  };
}

export function describeJsonSyntaxError(error) {
  const message = String(error?.message || '');
  if (/unterminated string/iu.test(message)) return 'не закрыта двойная кавычка.';
  if (/end of JSON|unexpected end/iu.test(message)) return 'JSON неожиданно закончился. Проверьте закрывающие скобки и значения.';
  if (/property name|double-quoted/iu.test(message)) return 'ключ объекта должен находиться в двойных кавычках.';
  if (/expected ['"]?,['"]?|after property value|after array element/iu.test(message)) return 'между соседними значениями, полями или элементами нужна запятая.';
  if (/non-whitespace character after JSON|after JSON data/iu.test(message)) return 'после завершённого JSON обнаружены лишние символы.';
  return 'нарушен синтаксис JSON. Проверьте кавычки, запятые и скобки.';
}
