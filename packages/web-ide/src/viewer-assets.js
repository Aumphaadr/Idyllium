// Просмотрщик ассетов: картинки, шрифты, SQLite-инспектор, детали файла.
// Держит своё состояние (поколение предпросмотра, живые FontFace/URL).

import { assetViewer, createIcon, csvViewer, jsonViewer, legacyEditor, markdownViewer, monacoHost } from './dom.js';
import { clamp } from './num-util.js';
import { viewerHost } from './viewer-host.js';
import { assetBytes, bytesToDataUrlWithMime, detectAssetMimeType, fontFormatName, formatBytes, formatDuration, imageAlphaInfo, mimeTypeForFile } from './binary-format.js';
import { shortFileName } from './workspace-paths.js';
import { formatRussianCount } from './viewer-structured.js';

export let assetViewerGeneration = 0;
export let assetFontCounter = 0;
export let activeAssetFontFace = null;
export let activeAssetImageCleanup = null;

// Ядро зовёт это при уходе с предпросмотра на любой другой экран: асинхронные
// дорисовки (шрифт, SQLite) сверяются с поколением и не оживляют мертвеца.
// Поколение — наша переменная: извне модуля её не нарастить (import жёсткий).
export function invalidateAssetPreview() {
  assetViewerGeneration += 1;
}

export function showAssetViewer(file, item) {
  if (monacoHost) monacoHost.hidden = true;
  if (legacyEditor) legacyEditor.hidden = true;
  if (csvViewer) {
    csvViewer.hidden = true;
    csvViewer.replaceChildren();
  }
  if (jsonViewer) {
    jsonViewer.hidden = true;
    jsonViewer.replaceChildren();
  }
  if (markdownViewer) {
    markdownViewer.hidden = true;
    markdownViewer.replaceChildren();
  }
  if (!assetViewer) return;

  assetViewer.hidden = false;
  assetViewer.replaceChildren();
  releaseAssetViewerResources();
  const generation = ++assetViewerGeneration;

  const bytes = item.bytes instanceof Uint8Array ? item.bytes : assetBytes(item);
  const detectedMime = detectAssetMimeType(file, bytes);
  const extensionMime = mimeTypeForFile(file);
  const isImage = detectedMime.startsWith('image/');
  const isAudio = detectedMime.startsWith('audio/');
  const isFont = detectedMime.startsWith('font/');
  const isSqlite = detectedMime === 'application/vnd.sqlite3';
  const alpha = isImage ? imageAlphaInfo(detectedMime, bytes) : 'нет';

  const preview = document.createElement('div');
  preview.className = 'asset-preview';
  assetViewer.appendChild(preview);

  const details = document.createElement('dl');
  details.className = 'asset-details';
  assetViewer.appendChild(details);

  addAssetDetail(details, 'Файл', shortFileName(file));
  addAssetDetail(details, 'Размер файла', formatBytes(bytes.length));
  addAssetDetail(details, 'Тип по расширению', extensionMime);
  addAssetDetail(details, 'Фактический тип', detectedMime);
  if (isSqlite) {
    addAssetDetail(details, 'Объекты', 'загрузка...');
    addAssetDetail(details, 'Версия схемы', 'загрузка...');
    addAssetDetail(details, 'Размер страницы', 'загрузка...');
    addAssetDetail(details, 'Страниц', 'загрузка...');
  } else if (isAudio) {
    addAssetDetail(details, 'Длительность', 'загрузка...');
  } else if (isFont) {
    addAssetDetail(details, 'Формат', fontFormatName(detectedMime));
    addAssetDetail(details, 'Состояние', 'загрузка...');
    addAssetDetail(details, 'Проверка символов', 'визуальная');
  } else {
    addAssetDetail(details, 'Ширина', isImage ? 'загрузка...' : 'нет');
    addAssetDetail(details, 'Высота', isImage ? 'загрузка...' : 'нет');
    addAssetDetail(details, 'Альфа-канал', alpha);
  }

  if (extensionMime !== detectedMime && detectedMime !== 'application/octet-stream') {
    addAssetDetail(details, 'Несовпадение типа', `${extensionMime} -> ${detectedMime}`, true);
  }

  if (isSqlite) {
    void renderSqliteAssetPreview(file, bytes, preview, details, generation);
    return;
  }

  if (isAudio) {
    const audio = document.createElement('audio');
    audio.className = 'asset-audio-player';
    audio.controls = true;
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      updateAssetDetail(details, 'Длительность', formatDuration(audio.duration));
    });
    audio.addEventListener('error', () => {
      updateAssetDetail(details, 'Длительность', 'ошибка');
    });
    audio.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
    preview.classList.add('asset-preview-audio');
    preview.appendChild(audio);
    return;
  }

  if (isFont) {
    void renderFontAssetPreview(file, item, bytes, preview, details, generation);
    return;
  }

  if (!isImage) {
    const empty = document.createElement('div');
    empty.className = 'asset-preview-empty';
    empty.textContent = 'Предпросмотр для этого типа файла пока недоступен';
    preview.appendChild(empty);
    return;
  }

  renderImageAssetPreview(file, item, bytes, detectedMime, preview, details, generation);
}

export async function renderSqliteAssetPreview(file, bytes, preview, details, generation) {
  preview.classList.add('asset-preview-sqlite');
  showSqliteViewerMessage(preview, 'Открываем базу данных...');

  if (typeof window.Idyllium?.inspectSqliteDatabaseInBrowser !== 'function'
    || typeof window.Idyllium?.previewSqliteObjectInBrowser !== 'function') {
    showSqliteViewerError(preview, 'Модуль просмотра SQLite не загрузился.');
    return;
  }

  try {
    const description = await window.Idyllium.inspectSqliteDatabaseInBrowser(bytes);
    if (!isCurrentAssetPreview(file, preview, generation)) return;

    updateAssetDetail(details, 'Объекты', String(description.objectCount));
    updateAssetDetail(details, 'Версия схемы', String(description.userVersion));
    updateAssetDetail(details, 'Размер страницы', formatBytes(description.pageSize));
    updateAssetDetail(details, 'Страниц', String(description.pageCount));
    preview.replaceChildren(createSqliteInspector(file, bytes, description, preview, generation));
  } catch (error) {
    if (!isCurrentAssetPreview(file, preview, generation)) return;
    updateAssetDetail(details, 'Объекты', 'ошибка');
    updateAssetDetail(details, 'Версия схемы', 'неизвестно');
    updateAssetDetail(details, 'Размер страницы', 'неизвестно');
    updateAssetDetail(details, 'Страниц', 'неизвестно');
    showSqliteViewerError(preview, sqliteInspectorError(error));
  }
}

export function createSqliteInspector(file, bytes, description, preview, generation) {
  const inspector = document.createElement('div');
  inspector.className = 'sqlite-inspector';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sqlite-sidebar';
  const sidebarHeader = document.createElement('div');
  sidebarHeader.className = 'sqlite-sidebar-header';
  const sidebarTitle = document.createElement('strong');
  sidebarTitle.textContent = 'Объекты';
  const sidebarCount = document.createElement('span');
  sidebarCount.textContent = String(description.objectCount);
  sidebarHeader.append(sidebarTitle, sidebarCount);
  sidebar.appendChild(sidebarHeader);

  const objectList = document.createElement('div');
  objectList.className = 'sqlite-object-list';
  sidebar.appendChild(objectList);

  const content = document.createElement('section');
  content.className = 'sqlite-object-view';
  inspector.append(sidebar, content);

  if (description.objects.length === 0) {
    const emptyList = document.createElement('p');
    emptyList.className = 'sqlite-sidebar-empty';
    emptyList.textContent = 'Таблиц и представлений нет';
    objectList.appendChild(emptyList);
    showSqliteViewerMessage(content, 'База данных открылась, но пользовательских таблиц и представлений в ней пока нет.');
    return inspector;
  }

  const buttons = new Map();
  let selectedObject = null;
  let selectedTab = 'data';
  let selectionSequence = 0;
  const previewCache = new Map();

  const selectObject = (object) => {
    selectedObject = object;
    selectedTab = 'data';
    selectionSequence++;
    for (const [name, button] of buttons) button.classList.toggle('active', name === object.name);
    renderSelectedObject();
  };

  for (const object of description.objects) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sqlite-object-button';
    button.title = object.name;

    const badge = document.createElement('span');
    badge.className = `sqlite-object-kind sqlite-object-kind-${object.kind}`;
    badge.textContent = object.kind === 'table' ? 'T' : 'V';
    badge.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'sqlite-object-name';
    name.textContent = object.name;
    button.append(badge, name);
    button.addEventListener('click', () => selectObject(object));
    objectList.appendChild(button);
    buttons.set(object.name, button);
  }

  if (description.truncatedObjectCount > 0) {
    const warning = document.createElement('p');
    warning.className = 'sqlite-sidebar-note';
    warning.textContent = `Скрыто объектов: ${description.truncatedObjectCount}`;
    sidebar.appendChild(warning);
  }
  if (description.hiddenSystemObjectCount > 0) {
    const note = document.createElement('p');
    note.className = 'sqlite-sidebar-note';
    note.textContent = `Системных таблиц скрыто: ${description.hiddenSystemObjectCount}`;
    sidebar.appendChild(note);
  }

  function renderSelectedObject() {
    if (!selectedObject) return;
    const object = selectedObject;
    const requestSequence = selectionSequence;
    content.replaceChildren();

    const header = document.createElement('header');
    header.className = 'sqlite-object-header';
    const identity = document.createElement('div');
    identity.className = 'sqlite-object-identity';
    const title = document.createElement('strong');
    title.textContent = object.name;
    const kind = document.createElement('span');
    kind.textContent = object.kind === 'table' ? 'Таблица' : 'Представление';
    identity.append(title, kind);

    const tabs = document.createElement('div');
    tabs.className = 'sqlite-object-tabs';
    tabs.setAttribute('role', 'tablist');
    const dataButton = createSqliteTabButton('Данные', 'data');
    const schemaButton = createSqliteTabButton('Схема', 'schema');
    tabs.append(dataButton, schemaButton);
    header.append(identity, tabs);
    content.appendChild(header);

    const body = document.createElement('div');
    body.className = 'sqlite-object-body';
    content.appendChild(body);

    function createSqliteTabButton(label, tab) {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.textContent = label;
      button.addEventListener('click', () => {
        selectedTab = tab;
        updateTabs();
        renderTab();
      });
      return button;
    }

    function updateTabs() {
      for (const [button, tab] of [[dataButton, 'data'], [schemaButton, 'schema']]) {
        const active = selectedTab === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      }
    }

    function renderTab() {
      body.replaceChildren();
      if (selectedTab === 'schema') {
        renderSqliteSchema(body, object);
        return;
      }

      const cached = previewCache.get(object.name);
      if (cached) {
        renderSqliteData(body, cached);
        return;
      }

      showSqliteViewerMessage(body, 'Читаем строки...');
      void window.Idyllium.previewSqliteObjectInBrowser(bytes, object.name, 200)
        .then((result) => {
          previewCache.set(object.name, result);
          if (!isCurrentAssetPreview(file, preview, generation)
            || selectedObject?.name !== object.name
            || selectionSequence !== requestSequence
            || selectedTab !== 'data') return;
          body.replaceChildren();
          renderSqliteData(body, result);
        })
        .catch((error) => {
          if (!isCurrentAssetPreview(file, preview, generation)
            || selectedObject?.name !== object.name
            || selectionSequence !== requestSequence
            || selectedTab !== 'data') return;
          showSqliteViewerError(body, sqliteInspectorError(error));
        });
    }

    updateTabs();
    renderTab();
  }

  selectObject(description.objects[0]);
  return inspector;
}

export function renderSqliteSchema(parent, object) {
  const scroll = document.createElement('div');
  scroll.className = 'sqlite-schema-scroll';

  const summary = document.createElement('p');
  summary.className = 'sqlite-schema-summary';
  summary.textContent = formatRussianCount(object.columns.length, ['столбец', 'столбца', 'столбцов']);
  scroll.appendChild(summary);

  if (object.sql) {
    const sqlLabel = document.createElement('div');
    sqlLabel.className = 'sqlite-schema-label';
    sqlLabel.textContent = 'SQL создания';
    const sql = document.createElement('pre');
    sql.className = 'sqlite-schema-sql';
    sql.textContent = object.sql;
    scroll.append(sqlLabel, sql);
  }

  if (object.columns.length > 0) {
    const tableScroll = document.createElement('div');
    tableScroll.className = 'sqlite-table-scroll sqlite-schema-table-scroll';
    const table = document.createElement('table');
    table.className = 'sqlite-table sqlite-schema-table';
    appendSqliteHeaderRow(table, ['#', 'Столбец', 'Тип', 'NOT NULL', 'DEFAULT', 'PK']);
    const body = document.createElement('tbody');
    for (const column of object.columns) {
      const row = document.createElement('tr');
      appendSqliteTextCell(row, String(column.index), 'th', 'sqlite-row-number');
      appendSqliteTextCell(row, column.name, 'td');
      appendSqliteTextCell(row, column.declaredType || 'не указан', 'td', column.declaredType ? '' : 'sqlite-muted-value');
      appendSqliteTextCell(row, column.notNull ? 'да' : 'нет', 'td');
      appendSqliteTextCell(row, column.defaultValue ?? 'нет', 'td', column.defaultValue === null ? 'sqlite-muted-value' : '');
      appendSqliteTextCell(row, column.primaryKeyPosition > 0 ? String(column.primaryKeyPosition) : 'нет', 'td', column.primaryKeyPosition > 0 ? '' : 'sqlite-muted-value');
      body.appendChild(row);
    }
    table.appendChild(body);
    tableScroll.appendChild(table);
    scroll.appendChild(tableScroll);
  }

  parent.appendChild(scroll);
}

export function renderSqliteData(parent, result) {
  const summary = document.createElement('div');
  summary.className = 'sqlite-data-summary';
  const shown = result.rows.length;
  summary.textContent = `Строк: ${result.totalRows} · показано: ${shown}`;
  parent.appendChild(summary);

  if (result.truncatedRows || result.truncatedColumns) {
    const warning = document.createElement('p');
    warning.className = 'sqlite-preview-warning';
    const parts = [];
    if (result.truncatedRows) parts.push('показаны первые 200 строк');
    if (result.truncatedColumns) parts.push(`показаны первые ${result.columns.length} столбцов из ${result.totalColumns}`);
    warning.textContent = parts.join(' · ');
    parent.appendChild(warning);
  }

  if (result.columns.length === 0) {
    showSqliteViewerMessage(parent, 'У объекта нет доступных столбцов.');
    return;
  }

  const scroll = document.createElement('div');
  scroll.className = 'sqlite-table-scroll';
  const table = document.createElement('table');
  table.className = 'sqlite-table sqlite-data-table';
  appendSqliteHeaderRow(table, ['#', ...result.columns]);
  const body = document.createElement('tbody');
  for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex++) {
    const row = document.createElement('tr');
    appendSqliteTextCell(row, String(rowIndex + 1), 'th', 'sqlite-row-number');
    for (const value of result.rows[rowIndex]) appendSqliteValueCell(row, value);
    body.appendChild(row);
  }
  table.appendChild(body);
  scroll.appendChild(table);
  parent.appendChild(scroll);

  if (result.rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sqlite-empty-table';
    empty.textContent = 'В таблице пока нет строк';
    scroll.appendChild(empty);
  }
}

export function appendSqliteHeaderRow(table, labels) {
  const head = document.createElement('thead');
  const row = document.createElement('tr');
  for (let index = 0; index < labels.length; index++) {
    appendSqliteTextCell(row, labels[index], 'th', index === 0 ? 'sqlite-row-number' : '');
  }
  head.appendChild(row);
  table.appendChild(head);
}

export function appendSqliteTextCell(row, value, tagName, className = '') {
  const cell = document.createElement(tagName);
  if (className) cell.className = className;
  cell.textContent = value;
  if (value.length > 120) cell.title = value.slice(0, 1000);
  row.appendChild(cell);
}

export function appendSqliteValueCell(row, value) {
  const cell = document.createElement('td');
  if (value === null) {
    cell.className = 'sqlite-value-null';
    cell.textContent = 'null';
  } else if (value instanceof Uint8Array) {
    cell.className = 'sqlite-value-blob';
    cell.textContent = `<BLOB ${formatBytes(value.length)}>`;
  } else {
    cell.textContent = String(value);
    if (typeof value === 'number' || typeof value === 'bigint') cell.className = 'sqlite-value-number';
  }
  if (cell.textContent.length > 120) cell.title = cell.textContent.slice(0, 1000);
  row.appendChild(cell);
}

export function showSqliteViewerMessage(parent, message) {
  parent.replaceChildren();
  const element = document.createElement('div');
  element.className = 'sqlite-viewer-message';
  element.textContent = message;
  parent.appendChild(element);
}

export function showSqliteViewerError(parent, message) {
  parent.replaceChildren();
  const error = document.createElement('div');
  error.className = 'sqlite-viewer-error';
  const title = document.createElement('strong');
  title.textContent = 'Базу данных не удалось открыть';
  const detail = document.createElement('p');
  detail.textContent = message;
  error.append(title, detail);
  parent.appendChild(error);
}

export function sqliteInspectorError(error) {
  const message = error instanceof Error ? error.message : String(error || 'неизвестная ошибка');
  if (/not a database|file is encrypted/iu.test(message)) {
    return 'Файл не является корректной SQLite-базой или повреждён.';
  }
  return message.replace(/^SQLite execution failed:\s*/iu, '');
}

export function renderImageAssetPreview(file, item, bytes, detectedMime, preview, details, generation) {
  preview.classList.add('asset-preview-image');

  const toolbar = document.createElement('div');
  toolbar.className = 'asset-image-toolbar';

  const zoomOut = createAssetImageButton('zoom-out', 'Уменьшить');
  const scaleValue = document.createElement('output');
  scaleValue.className = 'asset-image-scale';
  scaleValue.value = '100%';
  scaleValue.textContent = '100%';
  scaleValue.setAttribute('aria-live', 'polite');
  const zoomIn = createAssetImageButton('zoom-in', 'Увеличить');
  const actualSize = document.createElement('button');
  actualSize.type = 'button';
  actualSize.className = 'asset-image-button asset-image-actual-size';
  actualSize.textContent = '1:1';
  actualSize.title = 'Исходный размер';
  actualSize.setAttribute('aria-label', 'Показать в исходном размере');
  const fit = createAssetImageButton('fit', 'Вписать в область');
  toolbar.append(zoomOut, scaleValue, zoomIn, actualSize, fit);

  const viewport = document.createElement('div');
  viewport.className = 'asset-image-viewport';
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', `Предпросмотр изображения ${shortFileName(file)}`);

  const image = document.createElement('img');
  image.alt = shortFileName(file);
  image.draggable = false;
  viewport.appendChild(image);
  preview.append(toolbar, viewport);

  const state = {
    scale: 1,
    panX: 0,
    panY: 0,
    naturalWidth: 1,
    naturalHeight: 1,
    fitted: true,
    pointerId: null,
    pointerX: 0,
    pointerY: 0,
    startPanX: 0,
    startPanY: 0,
  };
  const minScale = 0.01;
  const maxScale = 16;

  const applyTransform = () => {
    const bounds = viewport.getBoundingClientRect();
    const width = state.naturalWidth * state.scale;
    const height = state.naturalHeight * state.scale;
    const maxPanX = Math.max(0, (width - bounds.width) / 2);
    const maxPanY = Math.max(0, (height - bounds.height) / 2);
    state.panX = clamp(state.panX, -maxPanX, maxPanX);
    state.panY = clamp(state.panY, -maxPanY, maxPanY);

    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    image.style.left = `calc(50% + ${state.panX}px)`;
    image.style.top = `calc(50% + ${state.panY}px)`;
    scaleValue.value = `${Math.round(state.scale * 100)}%`;
    scaleValue.textContent = scaleValue.value;
    zoomOut.disabled = state.scale <= minScale + 0.0001;
    zoomIn.disabled = state.scale >= maxScale - 0.0001;
    viewport.classList.toggle('can-pan', maxPanX > 0 || maxPanY > 0);
  };

  const setScale = (nextScale, anchor = null) => {
    const previousScale = state.scale;
    const scale = clamp(nextScale, minScale, maxScale);
    if (Math.abs(scale - previousScale) < 0.0001) return;

    if (anchor) {
      const bounds = viewport.getBoundingClientRect();
      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;
      const sourceX = (anchor.x - centerX - state.panX) / previousScale;
      const sourceY = (anchor.y - centerY - state.panY) / previousScale;
      state.panX = anchor.x - centerX - sourceX * scale;
      state.panY = anchor.y - centerY - sourceY * scale;
    }

    state.scale = scale;
    state.fitted = false;
    applyTransform();
  };

  const fitImage = () => {
    const bounds = viewport.getBoundingClientRect();
    const availableWidth = Math.max(1, bounds.width - 28);
    const availableHeight = Math.max(1, bounds.height - 28);
    state.scale = clamp(Math.min(
      availableWidth / state.naturalWidth,
      availableHeight / state.naturalHeight,
      1,
    ), minScale, maxScale);
    state.panX = 0;
    state.panY = 0;
    state.fitted = true;
    applyTransform();
  };

  zoomOut.addEventListener('click', () => setScale(state.scale / 1.25));
  zoomIn.addEventListener('click', () => setScale(state.scale * 1.25));
  actualSize.addEventListener('click', () => {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    state.fitted = false;
    applyTransform();
  });
  fit.addEventListener('click', fitImage);

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0015);
    setScale(state.scale * factor, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  }, { passive: false });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !viewport.classList.contains('can-pan')) return;
    event.preventDefault();
    state.pointerId = event.pointerId;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.startPanX = state.panX;
    state.startPanY = state.panY;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('dragging');
  });

  viewport.addEventListener('pointermove', (event) => {
    if (state.pointerId !== event.pointerId) return;
    state.panX = state.startPanX + event.clientX - state.pointerX;
    state.panY = state.startPanY + event.clientY - state.pointerY;
    state.fitted = false;
    applyTransform();
  });

  const finishDragging = (event) => {
    if (state.pointerId !== event.pointerId) return;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    state.pointerId = null;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', finishDragging);
  viewport.addEventListener('pointercancel', finishDragging);
  viewport.addEventListener('lostpointercapture', (event) => {
    if (state.pointerId !== event.pointerId) return;
    state.pointerId = null;
    viewport.classList.remove('dragging');
  });

  image.addEventListener('load', () => {
    if (!isCurrentAssetPreview(file, preview, generation)) return;
    state.naturalWidth = Math.max(1, image.naturalWidth);
    state.naturalHeight = Math.max(1, image.naturalHeight);
    updateAssetDetail(details, 'Ширина', `${image.naturalWidth}px`);
    updateAssetDetail(details, 'Высота', `${image.naturalHeight}px`);
    window.requestAnimationFrame(fitImage);

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (!isCurrentAssetPreview(file, preview, generation)) {
            resizeObserver.disconnect();
            return;
          }
          if (state.fitted) fitImage();
          else applyTransform();
        })
      : null;
    resizeObserver?.observe(viewport);
    activeAssetImageCleanup = () => resizeObserver?.disconnect();
  });

  image.addEventListener('error', () => {
    if (!isCurrentAssetPreview(file, preview, generation)) return;
    preview.classList.remove('asset-preview-image');
    preview.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'asset-preview-empty';
    empty.textContent = 'Не удалось прочитать изображение';
    preview.appendChild(empty);
    updateAssetDetail(details, 'Ширина', 'ошибка');
    updateAssetDetail(details, 'Высота', 'ошибка');
  });

  image.src = bytes.length > 0 ? bytesToDataUrlWithMime(detectedMime, bytes) : item.resourceUri;
}

export function createAssetImageButton(icon, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button asset-image-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.appendChild(createIcon(icon));
  return button;
}

export async function renderFontAssetPreview(file, item, bytes, preview, details, generation) {
  preview.classList.add('asset-preview-font');

  const loading = document.createElement('div');
  loading.className = 'asset-preview-empty';
  loading.textContent = 'Загружаем шрифт...';
  preview.appendChild(loading);

  if (typeof FontFace !== 'function' || !document.fonts || typeof document.fonts.add !== 'function') {
    loading.textContent = 'Этот браузер не поддерживает предпросмотр шрифтов';
    updateAssetDetail(details, 'Состояние', 'не поддерживается');
    return;
  }

  const family = `IdylliumAssetPreview${++assetFontCounter}`;
  const source = bytes.length > 0
    ? bytes.slice().buffer
    : `url(${JSON.stringify(item.resourceUri || '')})`;

  try {
    const face = await new FontFace(family, source).load();
    if (!isCurrentAssetPreview(file, preview, generation)) return;

    document.fonts.add(face);
    activeAssetFontFace = face;
    updateAssetDetail(details, 'Состояние', 'загружен');
    preview.replaceChildren(createFontPreviewContent(family));
  } catch (error) {
    if (!isCurrentAssetPreview(file, preview, generation)) return;
    loading.textContent = 'Не удалось прочитать шрифт';
    loading.title = error instanceof Error ? error.message : String(error);
    updateAssetDetail(details, 'Состояние', 'ошибка загрузки');
  }
}

export function createFontPreviewContent(family) {
  const content = document.createElement('div');
  content.className = 'asset-font-preview';
  content.style.setProperty('--asset-font-size', '36px');

  const toolbar = document.createElement('div');
  toolbar.className = 'asset-font-toolbar';

  const label = document.createElement('label');
  label.className = 'asset-font-size-label';

  const range = document.createElement('input');
  range.type = 'range';
  range.min = '12';
  range.max = '96';
  range.step = '1';
  range.value = '36';
  range.className = 'asset-font-size-range';
  range.setAttribute('aria-label', 'Размер текста предпросмотра');

  const value = document.createElement('output');
  value.className = 'asset-font-size-value';
  value.value = '36 px';
  value.textContent = '36 px';

  range.addEventListener('input', () => {
    const size = Number(range.value);
    content.style.setProperty('--asset-font-size', `${size}px`);
    value.value = `${size} px`;
    value.textContent = `${size} px`;
  });

  label.appendChild(range);
  label.appendChild(value);

  // Цвет образцов задаётся любой colors-фабрикой из курса: RGB/RGBA/HEX/HSL
  // или именованной константой (colors.RED). Пусто — цвет темы; мусор —
  // красная рамка, цвет не трогаем (просьба пользователей, 2026-08-22).
  const colorField = document.createElement('input');
  colorField.type = 'text';
  colorField.className = 'asset-font-color-input';
  colorField.placeholder = 'colors.RGB(120, 200, 255)';
  colorField.spellcheck = false;
  colorField.setAttribute('aria-label', 'Цвет текста предпросмотра — фабрика colors');
  colorField.addEventListener('input', () => {
    const text = colorField.value.trim();
    if (text === '') {
      content.style.removeProperty('--asset-font-color');
      colorField.classList.remove('invalid');
      return;
    }
    const parsed = parseColorsFactory(text);
    if (parsed) {
      content.style.setProperty('--asset-font-color', parsed);
      colorField.classList.remove('invalid');
    } else {
      colorField.classList.add('invalid');
    }
  });

  // Caps Lock: с галочкой смотрим на заглавные буквы шрифта, без неё — на
  // строчные. Регистр меняется через CSS, поэтому исходный текст панграмм
  // остаётся нетронутым.
  const caps = document.createElement('label');
  caps.className = 'asset-font-caps-label';

  const capsInput = document.createElement('input');
  capsInput.type = 'checkbox';
  capsInput.className = 'asset-font-caps-input';
  capsInput.setAttribute('aria-label', 'Показывать заглавные буквы');

  const capsText = document.createElement('span');
  capsText.textContent = 'Caps Lock';

  capsInput.addEventListener('change', () => {
    content.classList.toggle('caps-on', capsInput.checked);
  });

  caps.appendChild(capsInput);
  caps.appendChild(capsText);

  // «Ж» и «К» — отжимаемые кнопки начертания, как в текстовых редакторах.
  // Если в файле нет жирного/курсивного начертания, браузер честно
  // имитирует его сам — об этом предупреждает подпись под образцами.
  const makeStyleButton = (text, className, ariaLabel, toggleClass) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `asset-font-style-button ${className}`;
    button.textContent = text;
    button.title = ariaLabel;
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const active = !content.classList.contains(toggleClass);
      content.classList.toggle(toggleClass, active);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    return button;
  };
  const boldButton = makeStyleButton('Ж', 'asset-font-bold-button', 'Показать жирное начертание', 'bold-on');
  const italicButton = makeStyleButton('К', 'asset-font-italic-button', 'Показать курсивное начертание', 'italic-on');

  toolbar.appendChild(caps);
  toolbar.appendChild(boldButton);
  toolbar.appendChild(italicButton);
  toolbar.appendChild(colorField);
  toolbar.appendChild(label);
  content.appendChild(toolbar);

  const samples = document.createElement('div');
  samples.className = 'asset-font-samples';
  const fontFamily = `"${family}", sans-serif`;
  const pangrams = [
    ['Русская панграмма', 'Съешь же ещё этих мягких французских булок, да выпей чаю.'],
    ['Английская панграмма', 'The quick brown fox jumps over the lazy dog.'],
    ['Цифры и знаки', '0123456789  + - * / = < >  ( ) [ ] { }'],
  ];

  for (const [caption, text] of pangrams) {
    const sample = document.createElement('section');
    sample.className = 'asset-font-sample';

    const heading = document.createElement('div');
    heading.className = 'asset-font-sample-label';
    heading.textContent = caption;
    sample.appendChild(heading);

    const line = document.createElement('div');
    line.className = 'asset-font-sample-text';
    line.style.fontFamily = fontFamily;
    line.textContent = text;
    sample.appendChild(line);
    samples.appendChild(sample);
  }

  content.appendChild(samples);

  const note = document.createElement('p');
  note.className = 'asset-font-note';
  note.textContent = 'Если в файле нет нужного символа, браузер может незаметно подставить его из запасного шрифта. То же с начертаниями «Ж» и «К»: когда в файле нет жирного или курсива, браузер имитирует их сам.';
  content.appendChild(note);
  return content;
}

// Разбор строки-фабрики colors.* в CSS-цвет. Понимает RGB/RGBA/HEX/HSL
// и именованные константы модуля colors; регистр фабрик — как в курсе.
export const COLORS_CONSTANTS = {
  BLACK: 'rgb(0, 0, 0)', WHITE: 'rgb(255, 255, 255)', RED: 'rgb(255, 0, 0)',
  GREEN: 'rgb(0, 255, 0)', BLUE: 'rgb(0, 0, 255)', YELLOW: 'rgb(255, 255, 0)',
  CYAN: 'rgb(0, 255, 255)', MAGENTA: 'rgb(255, 0, 255)', GRAY: 'rgb(128, 128, 128)',
  LIGHT_GRAY: 'rgb(192, 192, 192)', DARK_RED: 'rgb(128, 0, 0)',
  DARK_GREEN: 'rgb(0, 128, 0)', DARK_BLUE: 'rgb(0, 0, 128)',
  OLIVE: 'rgb(128, 128, 0)', TEAL: 'rgb(0, 128, 128)', PURPLE: 'rgb(128, 0, 128)',
};

export function parseColorsFactory(text) {
  const source = text.trim().replace(/;$/, '');
  const constant = /^colors\.([A-Z_]+)$/.exec(source);
  if (constant) return COLORS_CONSTANTS[constant[1]] ?? null;
  const call = /^colors\.(RGB|RGBA|HEX|HSL)\s*\(([^)]*)\)$/.exec(source);
  if (!call) return null;
  const kind = call[1];
  const rawArgs = call[2].split(',').map((item) => item.trim());
  const byte = (item) => {
    if (!/^\d{1,3}$/.test(item)) return null;
    const n = Number(item);
    return n <= 255 ? n : null;
  };
  if (kind === 'RGB' && rawArgs.length === 3) {
    const [r, g, b] = rawArgs.map(byte);
    return r !== null && g !== null && b !== null ? `rgb(${r}, ${g}, ${b})` : null;
  }
  if (kind === 'RGBA' && rawArgs.length === 4) {
    const [r, g, b] = rawArgs.slice(0, 3).map(byte);
    const alpha = /^(0|1|0?\.\d+|1\.0+)$/.test(rawArgs[3]) ? Number(rawArgs[3]) : null;
    return r !== null && g !== null && b !== null && alpha !== null && alpha <= 1
      ? `rgba(${r}, ${g}, ${b}, ${alpha})` : null;
  }
  if (kind === 'HEX' && rawArgs.length === 1) {
    const m = /^"#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})"$/.exec(rawArgs[0]);
    return m ? `#${m[1]}` : null;
  }
  if (kind === 'HSL' && rawArgs.length === 3) {
    if (!rawArgs.every((item) => /^\d{1,3}$/.test(item))) return null;
    const [h, sPct, l] = rawArgs.map(Number);
    return h <= 360 && sPct <= 100 && l <= 100 ? `hsl(${h}, ${sPct}%, ${l}%)` : null;
  }
  return null;
}
// отладочная форточка для приёмки
window.__parseColorsFactory = parseColorsFactory;

export function isCurrentAssetPreview(file, preview, generation) {
  return generation === assetViewerGeneration
    && viewerHost.currentFile() === file
    && assetViewer
    && !assetViewer.hidden
    && assetViewer.contains(preview);
}

export function releaseAssetViewerFont() {
  if (!activeAssetFontFace) return;
  if (document.fonts && typeof document.fonts.delete === 'function') {
    document.fonts.delete(activeAssetFontFace);
  }
  activeAssetFontFace = null;
}

export function releaseAssetViewerResources() {
  releaseAssetViewerFont();
  activeAssetImageCleanup?.();
  activeAssetImageCleanup = null;
}

export function addAssetDetail(parent, label, value, warning = false) {
  const item = document.createElement('div');
  item.className = 'asset-detail' + (warning ? ' asset-detail-warning' : '');
  item.dataset.assetDetail = label;

  const term = document.createElement('dt');
  term.textContent = label;
  item.appendChild(term);

  const description = document.createElement('dd');
  description.textContent = value;
  item.appendChild(description);

  parent.appendChild(item);
}

export function updateAssetDetail(parent, label, value) {
  for (const item of parent.querySelectorAll('.asset-detail')) {
    if (item.dataset.assetDetail !== label) continue;
    const description = item.querySelector('dd');
    if (description) description.textContent = value;
    return;
  }
}
