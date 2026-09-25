'use strict';

// Операции над моделью макета без DOM (третий заход, 1.6.3): порядок дерева и перенос
// поддерева (перетаскивание строк дерева), выравнивание и распределение по прямоугольникам
// сцены (множественное выделение), корни выделения. CommonJS: модуль делят страница и тесты.

const { widgetDefinition, TAB_PAGE_TYPE } = require('./widgets');
const { childrenOf } = require('./codegen');

function widgetById(model, id) {
  return model.widgets.find((item) => item.id === id) || null;
}

function isAncestor(model, maybeAncestorId, id) {
  let current = widgetById(model, id);
  while (current && current.parent !== null) {
    if (current.parent === maybeAncestorId) return true;
    current = widgetById(model, current.parent);
  }
  return false;
}

/** Дети по родителям в порядке массива. */
function childrenMap(model) {
  const map = new Map();
  for (const item of model.widgets) {
    if (!map.has(item.parent)) map.set(item.parent, []);
    map.get(item.parent).push(item);
  }
  return map;
}

/** Массив виджетов в порядке обхода дерева: родитель, его дети по порядку, и так вглубь. */
function flattenTree(model, byParent = childrenMap(model)) {
  const out = [];
  const seen = new Set();
  const visit = (parentId) => {
    for (const item of byParent.get(parentId) || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
      visit(item.id);
    }
  };
  visit(null);
  for (const item of model.widgets) if (!seen.has(item.id)) out.push(item); // сироты — в конец, ничего не теряем
  return out;
}

/**
 * Перенос поддерева id: parent — новый родитель (null = окно), before — id соседа, перед которым
 * встать (null = в конец). Меняет model.widgets на месте; возвращает { ok, reason }.
 * Правила: не в своё поддерево; во вкладки кладётся только Frame — он становится страницей;
 * страница, ушедшая из вкладок, становится обычной рамкой; последнюю страницу не увести.
 */
function moveSubtree(model, id, { parent, before = null }) {
  const item = widgetById(model, id);
  if (!item) return { ok: false, reason: 'нет такого виджета' };
  if (before === id) return { ok: true };
  if (parent === id || (parent !== null && isAncestor(model, id, parent))) return { ok: false, reason: 'нельзя положить виджет внутрь самого себя' };
  const target = parent === null ? null : widgetById(model, parent);
  if (parent !== null && !target) return { ok: false, reason: 'нет такого контейнера' };
  const targetDef = target ? widgetDefinition(target.type) : null;
  if (target && !targetDef.container) return { ok: false, reason: `${target.name} — не контейнер: внутрь ничего не положить` };
  const intoTabs = Boolean(targetDef && targetDef.container === 'tabs');
  if (intoTabs && item.type !== TAB_PAGE_TYPE) return { ok: false, reason: 'страницей вкладок может быть только рамка (Frame)' };
  const wasPage = item.tabTitle !== undefined;
  if (wasPage && item.parent !== parent && childrenOf(model, item.parent).length <= 1) {
    return { ok: false, reason: 'у вкладок должна остаться хотя бы одна страница' };
  }
  const byParent = childrenMap(model);
  const oldList = byParent.get(item.parent) || [];
  oldList.splice(oldList.indexOf(item), 1);
  item.parent = parent;
  if (intoTabs) {
    if (item.tabTitle === undefined) item.tabTitle = `Вкладка ${(byParent.get(parent) || []).length + 1}`;
  } else if (wasPage) {
    delete item.tabTitle;
  }
  if (!byParent.has(parent)) byParent.set(parent, []);
  const list = byParent.get(parent);
  const index = before === null ? -1 : list.findIndex((other) => other.id === before);
  list.splice(index === -1 ? list.length : index, 0, item);
  // Координаты относительные — остаются; отрицательных не бывает.
  item.props.x = Math.max(0, Number(item.props.x || 0));
  item.props.y = Math.max(0, Number(item.props.y || 0));
  model.widgets = flattenTree(model, byParent);
  return { ok: true };
}

/** Виджеты выделения без тех, чей предок тоже выделен: двигать и копировать — только корни. */
function selectionRoots(model, ids) {
  const list = [...ids];
  return list.filter((id) => !list.some((other) => other !== id && isAncestor(model, other, id)));
}

const ALIGN_MODES = {
  left: 'по левому краю', center: 'по центру (горизонталь)', right: 'по правому краю',
  top: 'по верхнему краю', middle: 'по середине (вертикаль)', bottom: 'по нижнему краю',
  'distribute-h': 'распределить по горизонтали', 'distribute-v': 'распределить по вертикали',
  'same-width': 'одна ширина', 'same-height': 'одна высота',
};

/**
 * Выравнивание: boxes — [{ id, left, top, width, height }] в координатах сцены, ПЕРВЫЙ — опора
 * (выделенный первым). Возвращает [{ id, dx, dy, width?, height? }] только для тех, кто меняется.
 * Распределение — равные промежутки между крайними (нужно ≥ 3).
 */
function alignBoxes(boxes, mode) {
  if (!Array.isArray(boxes) || boxes.length < 2) return [];
  const anchor = boxes[0];
  const rest = boxes.slice(1);
  const moves = [];
  const move = (box, patch) => moves.push({ id: box.id, dx: 0, dy: 0, ...patch });
  switch (mode) {
    case 'left': for (const box of rest) move(box, { dx: anchor.left - box.left }); break;
    case 'right': for (const box of rest) move(box, { dx: (anchor.left + anchor.width) - (box.left + box.width) }); break;
    case 'center': for (const box of rest) move(box, { dx: (anchor.left + anchor.width / 2) - (box.left + box.width / 2) }); break;
    case 'top': for (const box of rest) move(box, { dy: anchor.top - box.top }); break;
    case 'bottom': for (const box of rest) move(box, { dy: (anchor.top + anchor.height) - (box.top + box.height) }); break;
    case 'middle': for (const box of rest) move(box, { dy: (anchor.top + anchor.height / 2) - (box.top + box.height / 2) }); break;
    case 'same-width': for (const box of rest) move(box, { width: anchor.width }); break;
    case 'same-height': for (const box of rest) move(box, { height: anchor.height }); break;
    case 'distribute-h':
    case 'distribute-v': {
      if (boxes.length < 3) return [];
      const horizontal = mode === 'distribute-h';
      const start = (box) => (horizontal ? box.left : box.top);
      const size = (box) => (horizontal ? box.width : box.height);
      const sorted = [...boxes].sort((a, b) => start(a) - start(b));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const total = sorted.reduce((sum, box) => sum + size(box), 0);
      const gap = ((start(last) + size(last)) - start(first) - total) / (sorted.length - 1);
      let cursor = start(first) + size(first) + gap;
      for (const box of sorted.slice(1, -1)) {
        move(box, horizontal ? { dx: cursor - box.left } : { dy: cursor - box.top });
        cursor += size(box) + gap;
      }
      break;
    }
    default:
      throw new Error(`gui-designer: unknown align mode '${mode}'`);
  }
  return moves.filter((item) => Math.abs(item.dx) >= 0.5 || Math.abs(item.dy) >= 0.5 || item.width !== undefined || item.height !== undefined);
}

module.exports = { ALIGN_MODES, childrenMap, flattenTree, moveSubtree, selectionRoots, alignBoxes, isAncestor };
