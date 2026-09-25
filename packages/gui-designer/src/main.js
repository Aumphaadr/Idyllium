// Конструктор GUI Idyllium (1.6.3). Спека — Idyllium-backstage/tech/spec/some_gui_designer/01,
// вердикты владельца 2026-09-25: сцена — НАСТОЯЩИЙ прогон сгенерированной программы в кадре
// gui-preview.html (том же, что у Web IDE), поверх него прозрачный слой с рамками и ручками;
// имена латиницей (button1…); заготовки обработчиков — галочкой; сетка 5 px с выключателем.
// Модель хранит только явно выставленные свойства; код — идиома учебника (src/codegen.js).
import { WIDGETS, WIDGET_TYPES, WINDOW_PROPS, WINDOW_THEMES, PALETTE_GROUPS, PROPERTY_GROUPS, TAB_PAGE_TYPE, widgetDefinition, propertyOf, nameProblem, freeName } from './widgets.js';
import { MODEL_VERSION, generateCode, normalizeHex, stripModel, extractEmbeddedModel, stripEmbeddedModel, childrenOf } from './codegen.js';

const STORAGE_KEY = 'idyllium-gui-designer';
const THEME_KEY = 'idyllium-docs-theme';
const CLIPBOARD_MARK = 'idyllium-gui-designer-clipboard:';
const WINDOW_TITLE_HEIGHT = 28;
const MIN_SIZE = 8;

const api = window.Idyllium;
const $ = (id) => document.getElementById(id);
const els = {
  palette: $('palette-groups'), scene: $('scene'), preview: $('preview'), overlay: $('overlay'), inline: $('inline-editor'),
  tree: $('tree'), inspector: $('inspector'), inspectorTitle: $('inspector-title'), code: $('code'), status: $('status'),
  undo: $('undo'), redo: $('redo'), newDesign: $('new-design'), gridToggle: $('grid-toggle'), gridSize: $('grid-size'),
  windowTheme: $('window-theme'), handlersToggle: $('handlers-toggle'), embedToggle: $('embed-model-toggle'),
  openIde: $('open-ide'), copyCode: $('copy-code'), downloadCode: $('download-code'), saveModel: $('save-model'),
  openModel: $('open-model'), openModelInput: $('open-model-input'), contextMenu: $('context-menu'), stagePane: $('stage-pane'),
};

// ─── состояние ───────────────────────────────────────────────────────────────
let model = null;
let selectedId = null;          // id виджета или null (выбрано окно)
let history = [];
let future = [];
let ui = { grid: true, gridSize: 5, handlers: false, embedModel: false };
let previewTabs = {};           // id вкладок → индекс страницы, которую правят
let lastRects = new Map();      // id → {left, top, width, height} в координатах сцены
let contentRect = null;         // прямоугольник содержимого окна
let frameReady = false;
let runToken = 0;
let runTimer = null;
let memoryClipboard = null;
let dragging = null;            // { kind: 'move'|'resize'|'place', ... }

function newModel() {
  return {
    version: MODEL_VERSION,
    window: { name: 'win', props: { title: 'Окно', width: 640, height: 420 } },
    widgets: [],
  };
}

function widgetById(id) {
  return model.widgets.find((item) => item.id === id) || null;
}

function nextId() {
  return model.widgets.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function takenNames() {
  return [model.window.name, ...model.widgets.map((item) => item.name)];
}

function descendants(id) {
  const result = [];
  const walk = (parentId) => {
    for (const child of childrenOf(model, parentId)) {
      result.push(child);
      walk(child.id);
    }
  };
  walk(id);
  return result;
}

function isAncestor(maybeAncestorId, id) {
  let current = widgetById(id);
  while (current && current.parent !== null) {
    if (current.parent === maybeAncestorId) return true;
    current = widgetById(current.parent);
  }
  return false;
}

// ─── история ─────────────────────────────────────────────────────────────────
function snapshot() {
  return JSON.stringify(stripModel(model));
}

function applyChange(mutate, { silent = false } = {}) {
  const before = snapshot();
  mutate();
  const after = snapshot();
  if (after !== before) {
    history.push(before);
    if (history.length > 200) history.shift();
    future = [];
  }
  refresh({ silent });
}

function undo() {
  if (history.length === 0) return;
  future.push(snapshot());
  model = JSON.parse(history.pop());
  if (selectedId !== null && !widgetById(selectedId)) selectedId = null;
  refresh();
}

function redo() {
  if (future.length === 0) return;
  history.push(snapshot());
  model = JSON.parse(future.pop());
  if (selectedId !== null && !widgetById(selectedId)) selectedId = null;
  refresh();
}

// ─── хранение ────────────────────────────────────────────────────────────────
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: stripModel(model), ui, previewTabs }));
  } catch (error) { /* приватный режим — макет живёт до перезагрузки */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const loaded = validateModel(saved.model);
    if (!loaded) return false;
    model = loaded;
    ui = { ...ui, ...(saved.ui || {}) };
    previewTabs = saved.previewTabs || {};
    return true;
  } catch (error) {
    return false;
  }
}

/** Модель из файла/хранилища — с проверкой, чтобы чужой JSON не уронил конструктор. */
function validateModel(raw) {
  if (!raw || typeof raw !== 'object' || !raw.window || !Array.isArray(raw.widgets)) return null;
  const result = { version: MODEL_VERSION, window: { name: 'win', props: {} }, widgets: [] };
  if (typeof raw.window.name === 'string' && !nameProblem(raw.window.name, [])) result.window.name = raw.window.name;
  result.window.props = cleanProps('Window', raw.window.props);
  const ids = new Set();
  for (const item of raw.widgets) {
    if (!item || typeof item !== 'object' || !WIDGETS[item.type] || typeof item.id !== 'number' || ids.has(item.id)) continue;
    ids.add(item.id);
    const widget = {
      id: item.id,
      type: item.type,
      name: typeof item.name === 'string' && !nameProblem(item.name, []) ? item.name : `${WIDGETS[item.type].defaultName}${item.id}`,
      parent: typeof item.parent === 'number' ? item.parent : null,
      props: cleanProps(item.type, item.props),
    };
    if (typeof item.tabTitle === 'string') widget.tabTitle = item.tabTitle;
    result.widgets.push(widget);
  }
  for (const widget of result.widgets) {
    if (widget.parent !== null && !ids.has(widget.parent)) widget.parent = null;
  }
  const names = new Set();
  for (const widget of result.widgets) {
    if (names.has(widget.name) || widget.name === result.window.name) widget.name = freeName(WIDGETS[widget.type].defaultName, [...names, result.window.name]);
    names.add(widget.name);
  }
  return result;
}

function cleanProps(type, props) {
  const result = {};
  if (!props || typeof props !== 'object') return result;
  for (const [name, value] of Object.entries(props)) {
    const prop = propertyOf(type, name);
    if (!prop || value === null || value === undefined || value === '') continue;
    if ((prop.kind === 'int' || prop.kind === 'float') && !Number.isFinite(Number(value))) continue;
    if (prop.kind === 'enum' && !prop.values.includes(value)) continue;
    result[name] = prop.kind === 'bool' ? Boolean(value) : prop.kind === 'int' ? Math.round(Number(value)) : prop.kind === 'float' ? Number(value) : prop.kind === 'color' ? normalizeHex(value) : String(value);
  }
  return result;
}

// ─── тема страницы и кадра ───────────────────────────────────────────────────
function applyTheme(light) {
  document.body.classList.toggle('light-theme', light);
  const toggle = $('theme-toggle');
  if (toggle) {
    const hint = light ? 'Тёмная тема' : 'Светлая тема';
    toggle.title = hint;
    toggle.setAttribute('aria-label', hint);
  }
  postToPreview({ type: 'theme', theme: light ? 'light' : 'dark' });
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (error) { /* нет хранилища */ }
  applyTheme(saved === 'light');
  const toggle = $('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* нет хранилища */ }
      applyTheme(next === 'light');
    });
  }
}

// ─── кадр предпросмотра: прогон программы ────────────────────────────────────
function postToPreview(message) {
  if (!els.preview.contentWindow) return;
  els.preview.contentWindow.postMessage(message, '*');
}

function previewDocument() {
  try {
    return els.preview.contentDocument || null;
  } catch (error) {
    return null;
  }
}

function currentCode(forPreview) {
  return generateCode(model, forPreview
    ? { handlers: false, previewTabs }
    : { handlers: ui.handlers, embedModel: ui.embedModel });
}

function scheduleRun(delay = 60) {
  if (runTimer) clearTimeout(runTimer);
  runTimer = setTimeout(() => { runTimer = null; void runPreview(); }, delay);
}

async function runPreview() {
  if (!api || typeof api.runIdylliumInBrowser !== 'function') {
    setStatus('Ядро Idyllium не загрузилось — предпросмотр недоступен', true);
    return;
  }
  const token = ++runToken;
  const code = currentCode(true);
  let result;
  try {
    result = await api.runIdylliumInBrowser({ entryFile: 'main.idyl', files: { 'main.idyl': code } });
  } catch (error) {
    if (token !== runToken) return;
    setStatus(`Предпросмотр не удался: ${error instanceof Error ? error.message : String(error)}`, true);
    return;
  }
  if (token !== runToken) return;
  if (!result.compilation.success) {
    // Так быть не должно: генератор обязан выдавать компилируемый код. Говорим честно.
    setStatus(`Ошибка генератора кода — сообщите автору: ${String(result.compilation.diagnosticsText || '').split('\n')[0]}`, true);
    return;
  }
  if (result.runtimeError) {
    setStatus(`Программа макета упала: ${result.runtimeError}`, true);
    return;
  }
  postToPreview({
    type: 'snapshot',
    generation: 1,
    audio: [],
    windows: result.windows,
    canvases: [],
    modals: [],
    output: '',
  });
  const lineCount = code.split('\n').length - 1;
  setStatus(`Программа макета скомпилирована и запущена: ${lineCount} строк, виджетов: ${model.widgets.length}`);
  requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.classList.toggle('is-error', isError);
}

// ─── геометрия: прямоугольники виджетов из DOM кадра ─────────────────────────
function widgetElements(container) {
  // applyWidgetBox рендерера ставит left каждому виджету; подписи рамок и полосы вкладок — нет.
  // instanceof HTMLElement здесь не годится: элементы кадра — из другого окна (своя реализация классов).
  return Array.from(container.children).filter((el) => el.nodeType === 1 && el.style && el.style.left !== '');
}

function syncOverlay() {
  const doc = previewDocument();
  const rects = new Map();
  contentRect = null;
  if (doc) {
    const frameBox = els.preview.getBoundingClientRect();
    const sceneBox = els.scene.getBoundingClientRect();
    const toScene = (box) => ({
      left: box.left + frameBox.left - sceneBox.left,
      top: box.top + frameBox.top - sceneBox.top,
      width: box.width,
      height: box.height,
    });
    const content = doc.querySelector('.window > .content');
    if (content) {
      contentRect = toScene(content.getBoundingClientRect());
      const matchChildren = (container, parentId) => {
        const items = childrenOf(model, parentId);
        const elements = widgetElements(container);
        items.forEach((item, index) => {
          const el = elements[index];
          if (!el) return;
          rects.set(item.id, toScene(el.getBoundingClientRect()));
          const def = widgetDefinition(item.type);
          if (def.container === 'children') matchChildren(el, item.id);
          if (def.container === 'tabs') {
            // Рендерер показывает одну страницу — ту, что выбрана; остальные страницы без прямоугольника.
            const pages = childrenOf(model, item.id);
            const shown = Math.min(Math.max(previewTabs[item.id] || 0, 0), Math.max(pages.length - 1, 0));
            const pageHost = el.querySelector('.page');
            const pageElement = pageHost ? widgetElements(pageHost)[0] : null;
            const page = pages[shown];
            if (page && pageElement) {
              rects.set(page.id, toScene(pageElement.getBoundingClientRect()));
              matchChildren(pageElement, page.id);
            }
          }
        });
      };
      matchChildren(content, null);
    }
    // Кадр высотой со своё содержимое — прокручивается сцена, а не он.
    const wanted = Math.max(320, doc.documentElement.scrollHeight);
    if (Math.abs(els.preview.offsetHeight - wanted) > 2) {
      els.preview.style.height = `${wanted}px`;
      requestAnimationFrame(syncOverlay);
      return;
    }
  }
  lastRects = rects;
  renderOverlay();
}

function rectOf(id) {
  return lastRects.get(id) || null;
}

/** Контейнер под точкой сцены: самый глубокий Frame/страница вкладки, иначе окно (null). */
function containerAt(sceneX, sceneY, excludeId = null) {
  let best = null;
  for (const item of model.widgets) {
    const def = widgetDefinition(item.type);
    if (def.container !== 'children') continue;
    if (excludeId !== null && (item.id === excludeId || isAncestor(excludeId, item.id))) continue;
    const rect = rectOf(item.id);
    if (!rect || sceneX < rect.left || sceneY < rect.top || sceneX > rect.left + rect.width || sceneY > rect.top + rect.height) continue;
    if (!best || isAncestor(best.id, item.id)) best = item;
  }
  return best ? best.id : null;
}

function containerOrigin(containerId) {
  if (containerId === null) return contentRect ? { left: contentRect.left, top: contentRect.top } : { left: 0, top: WINDOW_TITLE_HEIGHT };
  const rect = rectOf(containerId);
  if (!rect) return { left: 0, top: 0 };
  const item = widgetById(containerId);
  // Дети Frame стоят внутри его рамки: смещение на толщину границы, которую рендерер рисует border-ом.
  const border = item && item.props.border_width !== undefined ? Number(item.props.border_width) : 1;
  return { left: rect.left + border, top: rect.top + border };
}

function snap(value) {
  if (!ui.grid) return Math.round(value);
  return Math.round(value / ui.gridSize) * ui.gridSize;
}

// ─── оверлей ─────────────────────────────────────────────────────────────────
function renderOverlay() {
  const overlay = els.overlay;
  overlay.replaceChildren();
  if (contentRect) {
    if (ui.grid) {
      const grid = document.createElement('div');
      grid.className = 'overlay-grid';
      const step = Math.max(ui.gridSize, 20);
      grid.style.left = `${contentRect.left}px`;
      grid.style.top = `${contentRect.top}px`;
      grid.style.width = `${contentRect.width}px`;
      grid.style.height = `${contentRect.height}px`;
      grid.style.backgroundSize = `${step}px ${step}px`;
      overlay.appendChild(grid);
    }
    const windowBox = document.createElement('div');
    windowBox.className = 'overlay-window';
    windowBox.dataset.container = 'window';
    windowBox.style.left = `${contentRect.left}px`;
    windowBox.style.top = `${contentRect.top}px`;
    windowBox.style.width = `${contentRect.width}px`;
    windowBox.style.height = `${contentRect.height}px`;
    overlay.appendChild(windowBox);
  }
  // Вложенные — позже родителей, чтобы попадать под курсор первыми.
  const ordered = [...model.widgets].sort((a, b) => depthOf(a) - depthOf(b));
  for (const item of ordered) {
    const rect = rectOf(item.id);
    if (!rect) continue;
    const box = document.createElement('div');
    box.className = 'overlay-widget';
    box.dataset.id = String(item.id);
    if (item.id === selectedId) box.classList.add('is-selected');
    if (item.props.visible === false) box.classList.add('is-hidden');
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.title = `${item.name}: gui.${item.type}`;
    overlay.appendChild(box);
    if (item.id === selectedId) {
      for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        const knob = document.createElement('div');
        knob.className = 'overlay-handle';
        knob.dataset.handle = handle;
        knob.dataset.id = String(item.id);
        const x = handle.includes('w') ? 0 : handle.includes('e') ? rect.width : rect.width / 2;
        const y = handle.includes('n') ? 0 : handle.includes('s') ? rect.height : rect.height / 2;
        knob.style.left = `${rect.left + x}px`;
        knob.style.top = `${rect.top + y}px`;
        overlay.appendChild(knob);
      }
      const label = document.createElement('div');
      label.className = 'overlay-label';
      label.textContent = `${item.name} · ${Math.round(item.props.x || 0)}, ${Math.round(item.props.y || 0)} · ${Math.round(rect.width)}×${Math.round(rect.height)}`;
      label.style.left = `${rect.left}px`;
      label.style.top = `${rect.top - 20}px`;
      overlay.appendChild(label);
    }
  }
}

function depthOf(item) {
  let depth = 0;
  let current = item;
  while (current && current.parent !== null) {
    depth++;
    current = widgetById(current.parent);
  }
  return depth;
}

function capturePointer(event) {
  try { els.overlay.setPointerCapture(event.pointerId); } catch (error) { /* синтетическое событие без pointerId */ }
}

function scenePoint(event) {
  const box = els.scene.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function sizeOf(item) {
  const def = widgetDefinition(item.type);
  return {
    width: item.props.width !== undefined ? Number(item.props.width) : def.size.width,
    height: item.props.height !== undefined ? Number(item.props.height) : def.size.height,
  };
}

els.overlay.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  hideContextMenu();
  finishInlineEdit(true);
  const target = event.target instanceof HTMLElement ? event.target : null;
  const point = scenePoint(event);
  if (target && target.classList.contains('overlay-handle')) {
    const id = Number(target.dataset.id);
    const item = widgetById(id);
    if (!item) return;
    const size = sizeOf(item);
    dragging = {
      kind: 'resize', id, handle: target.dataset.handle, start: point,
      origin: { x: Number(item.props.x || 0), y: Number(item.props.y || 0), width: size.width, height: size.height },
      before: snapshot(), moved: false,
    };
    capturePointer(event);
    event.preventDefault();
    return;
  }
  if (target && target.classList.contains('overlay-widget')) {
    const id = Number(target.dataset.id);
    const item = widgetById(id);
    if (!item) return;
    if (selectedId !== id) {
      selectedId = id;
      renderTree();
      renderInspector();
      renderOverlay();
    }
    dragging = {
      kind: 'move', id, start: point,
      origin: { x: Number(item.props.x || 0), y: Number(item.props.y || 0) },
      before: snapshot(), moved: false, rect: rectOf(id),
    };
    capturePointer(event);
    event.preventDefault();
    return;
  }
  // Щелчок по пустому месту — выбрано окно.
  if (selectedId !== null) {
    selectedId = null;
    renderTree();
    renderInspector();
    renderOverlay();
  }
  els.overlay.focus();
});

els.overlay.addEventListener('pointermove', (event) => {
  if (!dragging || dragging.kind === 'place') return;
  const point = scenePoint(event);
  const dx = point.x - dragging.start.x;
  const dy = point.y - dragging.start.y;
  if (!dragging.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
  dragging.moved = true;
  const item = widgetById(dragging.id);
  if (!item) return;
  if (dragging.kind === 'move') {
    let nx = dragging.origin.x + dx;
    let ny = dragging.origin.y + dy;
    if (event.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) ny = dragging.origin.y; else nx = dragging.origin.x;
    }
    item.props.x = Math.max(0, snap(nx));
    item.props.y = Math.max(0, snap(ny));
    // Подсветить контейнер, в который упадёт виджет.
    const target = containerAt(point.x, point.y, item.id);
    for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
    const targetBox = target === null
      ? els.overlay.querySelector('.overlay-window')
      : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
    if (targetBox && target !== item.parent) targetBox.classList.add('is-drop-target');
  } else {
    const o = dragging.origin;
    let { x, y, width, height } = o;
    const h = dragging.handle;
    if (h.includes('e')) width = Math.max(MIN_SIZE, snap(o.width + dx));
    if (h.includes('s')) height = Math.max(MIN_SIZE, snap(o.height + dy));
    if (h.includes('w')) {
      const nx = Math.min(snap(o.x + dx), o.x + o.width - MIN_SIZE);
      width = o.width + (o.x - nx);
      x = nx;
    }
    if (h.includes('n')) {
      const ny = Math.min(snap(o.y + dy), o.y + o.height - MIN_SIZE);
      height = o.height + (o.y - ny);
      y = ny;
    }
    item.props.x = Math.max(0, x);
    item.props.y = Math.max(0, y);
    item.props.width = width;
    item.props.height = height;
  }
  moveOverlayBox(item);
  renderCode();
  scheduleRun(60);
});

/** Во время перетаскивания рамка едет сразу, картинка кадра догоняет после прогона. */
function moveOverlayBox(item) {
  const rect = rectOf(item.id);
  const origin = containerOrigin(item.parent);
  const size = sizeOf(item);
  const next = { left: origin.left + Number(item.props.x || 0), top: origin.top + Number(item.props.y || 0), width: size.width, height: size.height };
  if (!rect) return;
  lastRects.set(item.id, next);
  // Дети едут вместе с родителем.
  for (const child of descendants(item.id)) {
    const childRect = rectOf(child.id);
    if (childRect) lastRects.set(child.id, { ...childRect, left: childRect.left + (next.left - rect.left), top: childRect.top + (next.top - rect.top) });
  }
  renderOverlay();
}

function finishDrag(event) {
  if (!dragging || dragging.kind === 'place') return;
  const drag = dragging;
  dragging = null;
  for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
  if (!drag.moved) return;
  const item = widgetById(drag.id);
  if (item && drag.kind === 'move') {
    const point = scenePoint(event);
    const target = containerAt(point.x, point.y, item.id);
    if (target !== item.parent && !(target !== null && widgetById(target).parent === item.id)) {
      // Перенос в другой контейнер: координаты пересчитываем от его угла.
      const rect = rectOf(item.id);
      const origin = containerOrigin(target);
      item.parent = target;
      item.props.x = Math.max(0, snap(rect.left - origin.left));
      item.props.y = Math.max(0, snap(rect.top - origin.top));
      // В конец списка нового родителя — порядок add_child.
      model.widgets = [...model.widgets.filter((other) => other.id !== item.id), item];
    }
  }
  const after = snapshot();
  if (after !== drag.before) {
    history.push(drag.before);
    future = [];
  }
  refresh();
}

els.overlay.addEventListener('pointerup', finishDrag);
els.overlay.addEventListener('pointercancel', finishDrag);

els.overlay.addEventListener('dblclick', (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest('.overlay-widget') : null;
  if (!target) return;
  const item = widgetById(Number(target.dataset.id));
  if (!item) return;
  const textProp = ['text', 'title'].find((name) => propertyOf(item.type, name));
  if (!textProp) return;
  startInlineEdit(item, textProp);
});

// ─── правка текста прямо на виджете ─────────────────────────────────────────
let inlineEdit = null;

function startInlineEdit(item, propName) {
  const rect = rectOf(item.id);
  if (!rect) return;
  inlineEdit = { id: item.id, prop: propName };
  const input = els.inline;
  input.hidden = false;
  input.value = item.props[propName] !== undefined ? String(item.props[propName]) : '';
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top}px`;
  input.style.width = `${Math.max(rect.width, 80)}px`;
  input.style.height = `${Math.max(rect.height, 24)}px`;
  input.focus();
  input.select();
}

function finishInlineEdit(commit) {
  if (!inlineEdit) return;
  const edit = inlineEdit;
  inlineEdit = null;
  els.inline.hidden = true;
  if (!commit) return;
  const value = els.inline.value;
  applyChange(() => {
    const item = widgetById(edit.id);
    if (!item) return;
    if (value === '') delete item.props[edit.prop]; else item.props[edit.prop] = value;
  });
}

els.inline.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); finishInlineEdit(true); els.overlay.focus(); }
  if (event.key === 'Escape') { event.preventDefault(); finishInlineEdit(false); els.overlay.focus(); }
});
els.inline.addEventListener('blur', () => finishInlineEdit(true));

// ─── палитра ─────────────────────────────────────────────────────────────────
function renderPalette() {
  els.palette.replaceChildren();
  for (const group of PALETTE_GROUPS) {
    const title = document.createElement('div');
    title.className = 'palette-group-title';
    title.textContent = group.title;
    els.palette.appendChild(title);
    for (const type of group.types) {
      const def = WIDGETS[type];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-item';
      button.dataset.type = type;
      button.title = def.hint ? `gui.${type} — ${def.hint}` : `gui.${type}`;
      const icon = document.createElement('span');
      icon.className = 'palette-icon';
      const label = document.createElement('span');
      label.textContent = def.label;
      const code = document.createElement('small');
      code.textContent = type;
      button.append(icon, label, code);
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        startPlacing(type, event);
      });
      els.palette.appendChild(button);
    }
  }
}

let ghost = null;

function startPlacing(type, event) {
  hideContextMenu();
  dragging = { kind: 'place', type, startX: event.clientX, startY: event.clientY, moved: false };
  const onMove = (move) => {
    if (!dragging || dragging.kind !== 'place') return;
    if (!dragging.moved && Math.hypot(move.clientX - dragging.startX, move.clientY - dragging.startY) < 4) return;
    dragging.moved = true;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'palette-ghost';
      ghost.textContent = WIDGETS[type].label;
      document.body.appendChild(ghost);
    }
    ghost.style.left = `${move.clientX + 12}px`;
    ghost.style.top = `${move.clientY + 12}px`;
    const point = scenePointFromClient(move.clientX, move.clientY);
    for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
    if (point) {
      const target = containerAt(point.x, point.y);
      const targetBox = target === null ? els.overlay.querySelector('.overlay-window') : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
      if (targetBox) targetBox.classList.add('is-drop-target');
    }
  };
  const onUp = (up) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (ghost) { ghost.remove(); ghost = null; }
    for (const box of els.overlay.querySelectorAll('.is-drop-target')) box.classList.remove('is-drop-target');
    const wasMoved = dragging && dragging.moved;
    dragging = null;
    const point = scenePointFromClient(up.clientX, up.clientY);
    if (wasMoved) {
      if (point && insideWindow(point)) addWidget(type, point);
      return;
    }
    addWidget(type, null); // щелчок — в свободное место
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function scenePointFromClient(clientX, clientY) {
  const box = els.scene.getBoundingClientRect();
  if (clientX < box.left || clientY < box.top || clientX > box.right || clientY > box.bottom) return null;
  return { x: clientX - box.left, y: clientY - box.top };
}

function insideWindow(point) {
  return contentRect && point.x >= contentRect.left && point.y >= contentRect.top && point.x <= contentRect.left + contentRect.width && point.y <= contentRect.top + contentRect.height;
}

function addWidget(type, point) {
  const def = widgetDefinition(type);
  applyChange(() => {
    const id = nextId();
    const name = freeName(def.defaultName, takenNames());
    const item = { id, type, name, parent: null, props: {} };
    let parent = null;
    let x;
    let y;
    if (point) {
      parent = containerAt(point.x, point.y);
      const origin = containerOrigin(parent);
      x = snap(point.x - origin.left - def.size.width / 2);
      y = snap(point.y - origin.top - def.size.height / 2);
    } else {
      // Свободное место каскадом: ниже последнего виджета верхнего уровня.
      const top = childrenOf(model, null);
      const last = top[top.length - 1];
      x = 20;
      y = last ? snap(Number(last.props.y || 0) + sizeOf(last).height + 12) : 20;
    }
    item.parent = parent;
    item.props.x = Math.max(0, x);
    item.props.y = Math.max(0, y);
    for (const prop of def.props) {
      if (prop.initial !== undefined) item.props[prop.name] = prop.initial;
    }
    model.widgets.push(item);
    if (def.container === 'tabs') {
      addTabPage(item, 'Вкладка 1');
      addTabPage(item, 'Вкладка 2');
      previewTabs[item.id] = 0;
    }
    selectedId = id;
  });
}

function addTabPage(tabs, title) {
  const id = nextId();
  const size = sizeOf(tabs);
  const page = {
    id,
    type: TAB_PAGE_TYPE,
    name: freeName('page', takenNames()),
    parent: tabs.id,
    props: { x: 8, y: 8, width: Math.max(MIN_SIZE, size.width - 16), height: Math.max(MIN_SIZE, size.height - 50) },
    tabTitle: title,
  };
  model.widgets.push(page);
  return page;
}

// ─── дерево ──────────────────────────────────────────────────────────────────
function renderTree() {
  els.tree.replaceChildren();
  const windowRow = treeRow({ label: `${model.window.name}: gui.Window`, name: model.window.name, type: 'Window', id: null, depth: 0 });
  els.tree.appendChild(windowRow);
  const walk = (parentId, depth) => {
    for (const item of childrenOf(model, parentId)) {
      const row = treeRow({ item, depth });
      els.tree.appendChild(row);
      walk(item.id, depth + 1);
    }
  };
  walk(null, 1);
}

function treeRow({ item, depth, id, name, type }) {
  const row = document.createElement('div');
  row.className = 'tree-row';
  row.setAttribute('role', 'treeitem');
  const widgetId = item ? item.id : id;
  row.dataset.id = widgetId === null ? '' : String(widgetId);
  row.style.paddingLeft = `${8 + depth * 16}px`;
  if (widgetId === selectedId) row.classList.add('is-selected');
  if (item && item.props.visible === false) row.classList.add('is-hidden');
  const nameEl = document.createElement('span');
  nameEl.className = 'tree-name';
  nameEl.textContent = item ? item.name : name;
  const typeEl = document.createElement('span');
  typeEl.className = 'tree-type';
  typeEl.textContent = item ? (item.tabTitle !== undefined ? `вкладка «${item.tabTitle}»` : `gui.${item.type}`) : `gui.${type}`;
  row.append(nameEl, typeEl);
  row.addEventListener('click', () => {
    selectedId = widgetId;
    if (item && item.tabTitle !== undefined) {
      // Щелчок по странице вкладки — показать её в предпросмотре.
      const pages = childrenOf(model, item.parent);
      previewTabs[item.parent] = pages.indexOf(item);
      persist();
      scheduleRun(0);
    }
    renderTree();
    renderInspector();
    renderOverlay();
  });
  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    selectedId = widgetId;
    renderTree();
    renderInspector();
    renderOverlay();
    if (item) showContextMenu(event.clientX, event.clientY, item);
  });
  return row;
}

// ─── контекстное меню ────────────────────────────────────────────────────────
function showContextMenu(x, y, item) {
  const menu = els.contextMenu;
  menu.replaceChildren();
  const add = (label, action, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', () => { hideContextMenu(); action(); });
    menu.appendChild(button);
  };
  const separator = () => {
    const line = document.createElement('div');
    line.className = 'context-separator';
    menu.appendChild(line);
  };
  const isPage = item.tabTitle !== undefined;
  add('Переименовать', () => focusNameField());
  if (!isPage) add('Дублировать (Ctrl+D)', () => duplicateWidget(item.id));
  if (widgetDefinition(item.type).container === 'tabs') add('Добавить вкладку', () => applyChange(() => { addTabPage(item, `Вкладка ${childrenOf(model, item.id).length + 1}`); }));
  separator();
  const siblings = childrenOf(model, item.parent);
  const index = siblings.indexOf(item);
  add(isPage ? 'Вкладку левее' : 'Раньше в порядке добавления (ниже по слою)', () => reorder(item.id, -1), index <= 0);
  add(isPage ? 'Вкладку правее' : 'Позже в порядке добавления (выше по слою)', () => reorder(item.id, 1), index >= siblings.length - 1);
  separator();
  add('Удалить (Delete)', () => deleteWidget(item.id));
  menu.hidden = false;
  const margin = 8;
  menu.style.left = `${Math.min(x, window.innerWidth - menu.offsetWidth - margin)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - margin)}px`;
}

function hideContextMenu() {
  els.contextMenu.hidden = true;
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('#context-menu')) hideContextMenu();
});

els.overlay.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = event.target instanceof HTMLElement ? event.target.closest('.overlay-widget') : null;
  if (!target) return;
  const item = widgetById(Number(target.dataset.id));
  if (!item) return;
  selectedId = item.id;
  renderTree();
  renderInspector();
  renderOverlay();
  showContextMenu(event.clientX, event.clientY, item);
});

function reorder(id, direction) {
  applyChange(() => {
    const item = widgetById(id);
    if (!item) return;
    const siblings = childrenOf(model, item.parent);
    const index = siblings.indexOf(item);
    const other = siblings[index + direction];
    if (!other) return;
    const a = model.widgets.indexOf(item);
    const b = model.widgets.indexOf(other);
    model.widgets[a] = other;
    model.widgets[b] = item;
    if (item.tabTitle !== undefined) previewTabs[item.parent] = index + direction;
  });
}

function deleteWidget(id) {
  applyChange(() => {
    const item = widgetById(id);
    if (!item) return;
    if (item.tabTitle !== undefined) {
      const pages = childrenOf(model, item.parent);
      if (pages.length <= 1) { setStatus('У вкладок должна остаться хотя бы одна страница', true); return; }
      previewTabs[item.parent] = 0;
    }
    const doomed = new Set([id, ...descendants(id).map((child) => child.id)]);
    model.widgets = model.widgets.filter((other) => !doomed.has(other.id));
    if (selectedId !== null && doomed.has(selectedId)) selectedId = item.parent;
  });
}

function duplicateWidget(id) {
  const item = widgetById(id);
  if (!item || item.tabTitle !== undefined) return;
  const payload = copyPayload(item);
  pastePayload(payload, { offset: 10 });
}

// ─── копирование ─────────────────────────────────────────────────────────────
function copyPayload(item) {
  return { root: item.id, widgets: [item, ...descendants(item.id)].map((widget) => JSON.parse(JSON.stringify(widget))) };
}

function pastePayload(payload, { offset = 10 } = {}) {
  if (!payload || !Array.isArray(payload.widgets) || payload.widgets.length === 0) return;
  applyChange(() => {
    const idMap = new Map();
    const taken = takenNames();
    const rootSource = payload.widgets.find((widget) => widget.id === payload.root) || payload.widgets[0];
    // Вставляем туда же, где оригинал, если родитель ещё есть; иначе — в окно.
    const rootParent = rootSource.parent !== null && widgetById(rootSource.parent) ? rootSource.parent : null;
    for (const source of payload.widgets) {
      if (!WIDGETS[source.type]) continue;
      const id = nextId() + idMap.size;
      idMap.set(source.id, id);
    }
    for (const source of payload.widgets) {
      if (!idMap.has(source.id)) continue;
      const copy = {
        id: idMap.get(source.id),
        type: source.type,
        name: freeName(WIDGETS[source.type].defaultName, taken),
        parent: source.id === rootSource.id ? rootParent : (idMap.get(source.parent) ?? rootParent),
        props: cleanProps(source.type, source.props),
      };
      if (source.tabTitle !== undefined) copy.tabTitle = String(source.tabTitle);
      if (source.id === rootSource.id) {
        copy.props.x = Number(copy.props.x || 0) + offset;
        copy.props.y = Number(copy.props.y || 0) + offset;
      }
      taken.push(copy.name);
      model.widgets.push(copy);
      if (source.id === rootSource.id) selectedId = copy.id;
    }
  });
}

async function copySelection() {
  const item = selectedId !== null ? widgetById(selectedId) : null;
  if (!item || item.tabTitle !== undefined) return;
  memoryClipboard = copyPayload(item);
  try {
    await navigator.clipboard.writeText(CLIPBOARD_MARK + JSON.stringify(memoryClipboard));
  } catch (error) { /* без системного буфера — вставка из памяти страницы */ }
  setStatus(`Скопировано: ${item.name}`);
}

document.addEventListener('paste', (event) => {
  if (isTextField(document.activeElement)) return;
  const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
  if (text.startsWith(CLIPBOARD_MARK)) {
    try {
      pastePayload(JSON.parse(text.slice(CLIPBOARD_MARK.length)));
      event.preventDefault();
      return;
    } catch (error) { /* не наш JSON */ }
  }
  if (memoryClipboard) {
    pastePayload(memoryClipboard);
    event.preventDefault();
  }
});

function isTextField(element) {
  return element instanceof Element && element.matches('input, textarea, select, [contenteditable="true"]');
}

// ─── инспектор ───────────────────────────────────────────────────────────────
function renderInspector() {
  const container = els.inspector;
  container.replaceChildren();
  const item = selectedId !== null ? widgetById(selectedId) : null;
  const type = item ? item.type : 'Window';
  const props = item ? item.props : model.window.props;
  const def = item ? widgetDefinition(item.type) : null;
  els.inspectorTitle.textContent = item ? `${item.name}: gui.${item.type}` : `${model.window.name}: gui.Window`;

  // Имя.
  const nameGroup = groupBox('Имя');
  const nameField = document.createElement('div');
  nameField.className = 'field is-explicit';
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'имя в коде';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'name-field';
  nameInput.value = item ? item.name : model.window.name;
  nameInput.spellcheck = false;
  const nameNote = document.createElement('div');
  nameNote.className = 'field-note';
  nameNote.hidden = true;
  nameInput.addEventListener('input', () => {
    const others = takenNames().filter((name) => name !== (item ? item.name : model.window.name));
    const problem = nameProblem(nameInput.value.trim(), others);
    nameInput.classList.toggle('is-invalid', Boolean(problem));
    nameNote.hidden = !problem;
    nameNote.textContent = problem || '';
  });
  const commitName = () => {
    const value = nameInput.value.trim();
    const others = takenNames().filter((name) => name !== (item ? item.name : model.window.name));
    if (nameProblem(value, others)) return;
    applyChange(() => {
      if (item) widgetById(item.id).name = value; else model.window.name = value;
    });
  };
  nameInput.addEventListener('change', commitName);
  nameInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } });
  nameField.append(nameLabel, nameInput, document.createElement('span'));
  nameGroup.append(nameField, nameNote);
  container.appendChild(nameGroup);

  if (item && item.tabTitle !== undefined) {
    const tabGroup = groupBox('Вкладка');
    tabGroup.appendChild(textField('заголовок вкладки', item.tabTitle, (value) => applyChange(() => { widgetById(item.id).tabTitle = value; })));
    container.appendChild(tabGroup);
  }

  if (def && def.container === 'tabs') container.appendChild(tabsEditor(item));

  const catalogue = item ? def.props : WINDOW_PROPS;
  for (const [groupId, groupTitle] of PROPERTY_GROUPS) {
    const groupProps = catalogue.filter((prop) => prop.group === groupId);
    if (groupProps.length === 0) continue;
    const box = groupBox(groupTitle);
    for (const prop of groupProps) box.appendChild(propertyField(prop, props, (value) => setProperty(item, prop, value)));
    container.appendChild(box);
  }
  if (def && def.hint) {
    const note = document.createElement('p');
    note.className = 'inspector-empty';
    note.textContent = def.hint;
    container.appendChild(note);
  }
  if (def && def.events.length > 0) {
    const note = document.createElement('p');
    note.className = 'inspector-empty';
    note.textContent = `События: ${def.events.map((event) => event.name).join(', ')} — пишутся в коде (галочка «Заготовки обработчиков» добавит пустые функции).`;
    container.appendChild(note);
  }
}

function groupBox(title) {
  const box = document.createElement('div');
  box.className = 'inspector-group';
  const head = document.createElement('div');
  head.className = 'inspector-group-title';
  head.textContent = title;
  box.appendChild(head);
  return box;
}

function textField(label, value, onCommit) {
  const field = document.createElement('div');
  field.className = 'field is-explicit';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.addEventListener('change', () => onCommit(input.value));
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); onCommit(input.value); } });
  field.append(labelEl, input, document.createElement('span'));
  return field;
}

function propertyField(prop, props, onChange) {
  const field = document.createElement('div');
  field.className = 'field';
  const explicit = props[prop.name] !== undefined && props[prop.name] !== null && props[prop.name] !== '';
  if (explicit) field.classList.add('is-explicit');
  const label = document.createElement('label');
  label.title = prop.name;
  label.innerHTML = `${escapeHtml(prop.label)} <code>${escapeHtml(prop.name)}</code>`;
  let control;
  const placeholder = prop.default !== undefined ? `по умолчанию ${prop.default}` : 'по умолчанию';
  if (prop.kind === 'bool') {
    const wrap = document.createElement('div');
    wrap.className = 'field-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = explicit ? Boolean(props[prop.name]) : Boolean(prop.default);
    input.addEventListener('change', () => onChange(input.checked));
    const hint = document.createElement('span');
    hint.className = 'tree-type';
    hint.textContent = explicit ? '' : placeholder;
    wrap.append(input, hint);
    control = wrap;
  } else if (prop.kind === 'enum') {
    const select = document.createElement('select');
    const none = document.createElement('option');
    none.value = '';
    none.textContent = placeholder;
    select.appendChild(none);
    for (const value of prop.values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = explicit ? String(props[prop.name]) : '';
    select.addEventListener('change', () => onChange(select.value === '' ? null : select.value));
    control = select;
  } else if (prop.kind === 'color') {
    const wrap = document.createElement('div');
    wrap.className = 'field-color';
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = explicit ? normalizeHex(props[prop.name]) : '#808080';
    picker.title = explicit ? 'Выбрать цвет' : 'Задать цвет';
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.placeholder = placeholder;
    hex.value = explicit ? normalizeHex(props[prop.name]) : '';
    hex.spellcheck = false;
    picker.addEventListener('input', () => { hex.value = picker.value; });
    picker.addEventListener('change', () => onChange(picker.value));
    const commitHex = () => {
      const value = hex.value.trim();
      if (value === '') { onChange(null); return; }
      if (!/^#?[0-9a-fA-F]{6}$/u.test(value)) { hex.classList.add('is-invalid'); return; }
      onChange(normalizeHex(value));
    };
    hex.addEventListener('change', commitHex);
    hex.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commitHex(); } });
    wrap.append(picker, hex);
    control = wrap;
  } else {
    const input = document.createElement('input');
    input.type = prop.kind === 'int' || prop.kind === 'float' ? 'number' : 'text';
    if (prop.kind === 'int') input.step = '1';
    if (prop.kind === 'float') input.step = 'any';
    if (prop.min !== undefined) input.min = String(prop.min);
    if (prop.max !== undefined) input.max = String(prop.max);
    input.placeholder = placeholder;
    input.value = explicit ? String(props[prop.name]) : '';
    input.spellcheck = false;
    const commit = () => {
      const raw = input.value;
      if (raw.trim() === '') { onChange(null); return; }
      if (prop.kind === 'int' || prop.kind === 'float') {
        const number = Number(raw);
        if (!Number.isFinite(number)) { input.classList.add('is-invalid'); return; }
        let value = prop.kind === 'int' ? Math.round(number) : number;
        if (prop.min !== undefined) value = Math.max(prop.min, value);
        if (prop.max !== undefined) value = Math.min(prop.max, value);
        onChange(value);
        return;
      }
      onChange(raw);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    control = input;
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'field-reset';
  reset.title = 'Вернуть значение по умолчанию (строка уйдёт из кода)';
  reset.textContent = '×';
  reset.addEventListener('click', () => onChange(null));
  field.append(label, control, reset);
  return field;
}

function setProperty(item, prop, value) {
  applyChange(() => {
    const target = item ? widgetById(item.id) : model.window;
    if (!target) return;
    if (value === null || value === undefined || value === '') {
      delete target.props[prop.name];
      return;
    }
    if (prop.kind === 'int') value = Math.round(Number(value));
    if (prop.kind === 'float') value = Number(value);
    if (prop.kind === 'bool') value = Boolean(value);
    if (prop.kind === 'color') value = normalizeHex(value);
    target.props[prop.name] = value;
  });
}

function tabsEditor(tabs) {
  const box = groupBox('Вкладки');
  const list = document.createElement('div');
  list.className = 'tabs-editor';
  const pages = childrenOf(model, tabs.id);
  const shown = Math.min(Math.max(previewTabs[tabs.id] || 0, 0), Math.max(pages.length - 1, 0));
  pages.forEach((page, index) => {
    const row = document.createElement('div');
    row.className = 'tabs-row';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'shown-tab';
    radio.checked = index === shown;
    radio.title = 'Показать эту вкладку на сцене';
    radio.addEventListener('change', () => { previewTabs[tabs.id] = index; persist(); scheduleRun(0); renderTree(); });
    const title = document.createElement('input');
    title.type = 'text';
    title.value = page.tabTitle || '';
    title.placeholder = 'заголовок вкладки';
    const commit = () => applyChange(() => { const target = widgetById(page.id); if (target) target.tabTitle = title.value; });
    title.addEventListener('change', commit);
    title.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tabs-remove';
    remove.textContent = '×';
    remove.title = 'Удалить вкладку вместе с содержимым';
    remove.disabled = pages.length <= 1;
    remove.addEventListener('click', () => deleteWidget(page.id));
    row.append(radio, title, remove);
    list.appendChild(row);
  });
  box.appendChild(list);
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'tabs-add';
  add.textContent = '+ Добавить вкладку';
  add.addEventListener('click', () => applyChange(() => {
    const target = widgetById(tabs.id);
    if (!target) return;
    addTabPage(target, `Вкладка ${childrenOf(model, tabs.id).length + 1}`);
    previewTabs[tabs.id] = childrenOf(model, tabs.id).length - 1;
  }));
  box.appendChild(add);
  return box;
}

function focusNameField() {
  const input = $('name-field');
  if (input) { input.focus(); input.select(); }
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── код ─────────────────────────────────────────────────────────────────────
function renderCode() {
  const code = currentCode(false);
  els.code.innerHTML = highlight(code);
}

function highlight(code) {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(\/\/[^\n]*)/gu, '<span class="cm">$1</span>')
    .replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;)/gu, '<span class="str">$1</span>')
    .replace(/\b(use|main|void|function)\b/gu, '<span class="kw">$1</span>')
    .replace(/\b(gui|colors)\.([A-Z][A-Za-z]*)\b/gu, '$1.<span class="ty">$2</span>')
    .replace(/\.(add_child|add_tab|show|HEX)\(/gu, '.<span class="fn">$1</span>(')
    .replace(/\b(\d+(?:\.\d+)?)\b(?![^<]*>)/gu, '<span class="num">$1</span>');
}

async function copyCode() {
  const code = currentCode(false);
  try {
    await navigator.clipboard.writeText(code);
    flash(els.copyCode, 'Скопировано ✓');
  } catch (error) {
    flash(els.copyCode, 'Не удалось — выделите код и Ctrl+C');
    els.code.focus();
    const range = document.createRange();
    range.selectNodeContents(els.code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function flash(button, text) {
  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.textContent = text;
  setTimeout(() => { button.textContent = original; }, 1800);
}

function downloadCode() {
  const code = currentCode(false);
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'main.idyl';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  flash(els.downloadCode, 'Скачано ✓');
}

function openInIde() {
  const share = api && api.share;
  if (!share || typeof share.encodeProjectLink !== 'function') {
    setStatus('Ядро Idyllium не загрузилось — скопируйте код и вставьте в Web IDE вручную', true);
    return;
  }
  const code = currentCode(false);
  const title = String(model.window.props.title || 'Макет окна');
  let fragment;
  try {
    fragment = share.encodeProjectLink({
      name: `Конструктор GUI: ${title}`,
      from: '',
      idyllium: api.IDYLLIUM_VERSION || '',
      current: 'main.idyl',
      files: [{ path: 'main.idyl', text: code }],
      assets: [],
    });
  } catch (error) {
    setStatus(`Не удалось собрать ссылку: ${error instanceof Error ? error.message : String(error)}`, true);
    return;
  }
  const url = `${new URL('../', window.location.href).href}#${fragment}`;
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) {
    setStatus('Браузер не открыл вкладку — разрешите всплывающие окна для этого сайта', true);
  }
}

function saveModelFile() {
  const text = `${JSON.stringify(stripModel(model), null, 2)}\n`;
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'gui-design.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  flash(els.saveModel, 'Сохранено ✓');
}

async function openModelFile(file) {
  const text = await file.text();
  let loaded = null;
  let note = '';
  if (file.name.toLowerCase().endsWith('.json')) {
    try { loaded = validateModel(JSON.parse(text)); } catch (error) { loaded = null; }
    if (!loaded) { setStatus(`«${file.name}» — не макет конструктора`, true); return; }
  } else {
    let embedded = null;
    try { embedded = extractEmbeddedModel(text); } catch (error) { embedded = null; }
    if (!embedded) {
      setStatus(`В «${file.name}» нет строки макета (// gui-designer: …) — открыть можно только файл, сохранённый конструктором с этой галочкой`, true);
      return;
    }
    loaded = validateModel(embedded);
    if (!loaded) { setStatus(`Строка макета в «${file.name}» повреждена`, true); return; }
    // Честность: если код правили руками после конструктора, макет отстал от кода.
    const regenerated = generateCode(loaded, { handlers: false });
    const regeneratedWithHandlers = generateCode(loaded, { handlers: true });
    const fileCode = stripEmbeddedModel(text);
    if (fileCode !== regenerated && fileCode !== regeneratedWithHandlers) {
      note = ' Внимание: код в файле отличается от макета (его правили вручную) — правки кода в макет не попали.';
    }
  }
  applyChange(() => {
    model = loaded;
    selectedId = null;
    previewTabs = {};
  });
  setStatus(`Открыт макет из «${file.name}»: виджетов ${model.widgets.length}.${note}`, note !== '');
}

// ─── обновление всего ────────────────────────────────────────────────────────
function refresh({ silent = false } = {}) {
  els.undo.disabled = history.length === 0;
  els.redo.disabled = future.length === 0;
  renderTree();
  renderInspector();
  renderCode();
  renderOverlay();
  persist();
  if (!silent) scheduleRun(0);
}

// ─── клавиатура ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', (event) => {
  if (isTextField(document.activeElement) && document.activeElement !== els.overlay) {
    return;
  }
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); return; }
  if (ctrl && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) { event.preventDefault(); redo(); return; }
  if (ctrl && event.key.toLowerCase() === 'c') { void copySelection(); return; }
  if (ctrl && event.key.toLowerCase() === 'd') { event.preventDefault(); if (selectedId !== null) duplicateWidget(selectedId); return; }
  if (event.key === 'Escape') { selectedId = null; hideContextMenu(); renderTree(); renderInspector(); renderOverlay(); return; }
  if (selectedId === null) return;
  const item = widgetById(selectedId);
  if (!item) return;
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteWidget(selectedId); return; }
  const step = event.shiftKey ? 10 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[event.key]) {
    event.preventDefault();
    const [dx, dy] = moves[event.key];
    applyChange(() => {
      const target = widgetById(selectedId);
      target.props.x = Math.max(0, Number(target.props.x || 0) + dx);
      target.props.y = Math.max(0, Number(target.props.y || 0) + dy);
    });
  }
});

// ─── запуск ──────────────────────────────────────────────────────────────────
function initControls() {
  els.undo.addEventListener('click', undo);
  els.redo.addEventListener('click', redo);
  els.newDesign.addEventListener('click', () => {
    if (model.widgets.length > 0 && !window.confirm('Начать новый макет? Текущий останется только в отменах (Ctrl+Z).')) return;
    applyChange(() => { model = newModel(); selectedId = null; previewTabs = {}; });
  });
  els.gridToggle.checked = ui.grid;
  els.gridSize.textContent = String(ui.gridSize);
  els.gridToggle.addEventListener('change', () => { ui.grid = els.gridToggle.checked; persist(); renderOverlay(); });
  for (const theme of WINDOW_THEMES) {
    const option = document.createElement('option');
    option.value = theme;
    option.textContent = theme;
    els.windowTheme.appendChild(option);
  }
  els.windowTheme.addEventListener('change', () => applyChange(() => {
    if (els.windowTheme.value === 'default') delete model.window.props.theme; else model.window.props.theme = els.windowTheme.value;
  }));
  els.handlersToggle.checked = ui.handlers;
  els.handlersToggle.addEventListener('change', () => { ui.handlers = els.handlersToggle.checked; persist(); renderCode(); });
  els.embedToggle.checked = ui.embedModel;
  els.embedToggle.addEventListener('change', () => { ui.embedModel = els.embedToggle.checked; persist(); renderCode(); });
  els.openIde.addEventListener('click', openInIde);
  els.copyCode.addEventListener('click', () => { void copyCode(); });
  els.downloadCode.addEventListener('click', downloadCode);
  els.saveModel.addEventListener('click', saveModelFile);
  els.openModel.addEventListener('click', () => els.openModelInput.click());
  els.openModelInput.addEventListener('change', () => {
    const file = els.openModelInput.files && els.openModelInput.files[0];
    els.openModelInput.value = '';
    if (file) void openModelFile(file);
  });
  const codePane = $('code-pane');
  const collapse = $('code-collapse');
  const applyCollapsed = () => {
    codePane.classList.toggle('is-collapsed', Boolean(ui.codeCollapsed));
    collapse.textContent = ui.codeCollapsed ? 'Развернуть' : 'Свернуть';
    requestAnimationFrame(syncOverlay);
  };
  collapse.addEventListener('click', () => { ui.codeCollapsed = !ui.codeCollapsed; persist(); applyCollapsed(); });
  applyCollapsed();
  window.addEventListener('resize', () => syncOverlay());
  els.stagePane.addEventListener('scroll', () => renderOverlay());
}

function watchPreviewFrame() {
  const attach = () => {
    const doc = previewDocument();
    if (!doc || !doc.getElementById('stage')) return false;
    const toolbar = doc.querySelector('.toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const observer = new MutationObserver(() => requestAnimationFrame(syncOverlay));
    observer.observe(doc.getElementById('stage'), { childList: true, subtree: true, attributes: true });
    frameReady = true;
    applyTheme(document.body.classList.contains('light-theme'));
    scheduleRun(0);
    return true;
  };
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'idylliumGuiEvent' && data.message && data.message.type === 'rendererReady') {
      if (!frameReady) attach();
    }
  });
  els.preview.addEventListener('load', () => { if (!frameReady) attach(); });
  if (!frameReady) attach();
}

function main() {
  if (!restore()) model = newModel();
  els.windowTheme.value = model.window.props.theme || 'default';
  initTheme();
  renderPalette();
  initControls();
  watchPreviewFrame();
  refresh({ silent: true });
  setStatus('Загрузка предпросмотра…');
}

main();
