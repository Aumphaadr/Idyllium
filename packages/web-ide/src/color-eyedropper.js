// Пипетка палитры: подбор цвета с любого места превью и самой IDE,
// включая градиенты и картинки; чтение пикселей и разбор CSS-цветов.

// applyPickedColor(picked) — колбэк ядра: подобранный цвет уходит в палитру
// (пипетка про пиксели, состоянием пикера владеет ядро).
import { clamp } from './num-util.js';

export function setupColorEyedropper(applyPickedColor) {
  const button = document.getElementById('color-eyedropper-button');
  if (!button) return;
  let active = false;
  let hookedDocuments = [];
  let lens = null;

  button.addEventListener('click', () => {
    active ? deactivateEyedropper() : activateEyedropper();
  });

  function activateEyedropper() {
    active = true;
    button.classList.add('eyedropper-active');
    const documents = [document];
    for (const frame of document.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument) documents.push(frame.contentDocument);
      } catch (_error) {
        // чужеродный iframe — пипетке туда нельзя, пропускаем
      }
    }
    hookedDocuments = documents.map((doc) => {
      // курсор и pointer-events — инжектом стиля: у документа iframe наших
      // классов нет, а элементы с pointer-events:none (превью картинок!)
      // невидимы для elementsFromPoint — на время пипетки включаем всем
      const cursorStyle = doc.createElement('style');
      cursorStyle.textContent = '* { cursor: crosshair !important; pointer-events: auto !important; }\n'
        + '#eyedropper-lens, #eyedropper-lens * { pointer-events: none !important; }';
      (doc.head || doc.documentElement).appendChild(cursorStyle);
      doc.addEventListener('mousedown', onEyedropperPress, true);
      doc.addEventListener('click', onEyedropperPick, true);
      doc.addEventListener('contextmenu', onEyedropperCancel, true);
      doc.addEventListener('keydown', onEyedropperKey, true);
      doc.addEventListener('mousemove', onEyedropperMove, true);
      return { doc, cursorStyle };
    });
    lens = document.createElement('div');
    lens.id = 'eyedropper-lens';
    lens.hidden = true;
    const swatch = document.createElement('span');
    swatch.className = 'eyedropper-lens-swatch';
    const label = document.createElement('span');
    label.className = 'eyedropper-lens-label';
    lens.append(swatch, label);
    document.body.appendChild(lens);
  }

  function deactivateEyedropper() {
    active = false;
    button.classList.remove('eyedropper-active');
    for (const { doc, cursorStyle } of hookedDocuments) {
      try {
        cursorStyle.remove();
        doc.removeEventListener('mousedown', onEyedropperPress, true);
        doc.removeEventListener('click', onEyedropperPick, true);
        doc.removeEventListener('contextmenu', onEyedropperCancel, true);
        doc.removeEventListener('keydown', onEyedropperKey, true);
        doc.removeEventListener('mousemove', onEyedropperMove, true);
      } catch (_error) {
        // документ iframe мог быть выгружен — снимать уже нечего
      }
    }
    hookedDocuments = [];
    if (lens) {
      lens.remove();
      lens = null;
    }
  }

  // Лупа у курсора: живой цвет ДО клика — иначе в тонкий глиф или узкий
  // трек не прицелиться. Координаты события из iframe переводятся в систему
  // родительской страницы через рамку самого iframe.
  function onEyedropperMove(event) {
    if (!lens) return;
    const doc = (event.target && event.target.ownerDocument) || document;
    let pageX = event.clientX;
    let pageY = event.clientY;
    if (doc !== document) {
      try {
        const frame = doc.defaultView && doc.defaultView.frameElement;
        if (!frame) return;
        const rect = frame.getBoundingClientRect();
        pageX += rect.left + frame.clientLeft;
        pageY += rect.top + frame.clientTop;
      } catch (_error) {
        return;
      }
    }
    const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
    lens.hidden = false;
    const flipX = pageX > window.innerWidth - 150;
    const flipY = pageY > window.innerHeight - 60;
    lens.style.left = `${pageX + (flipX ? -18 : 18)}px`;
    lens.style.top = `${pageY + (flipY ? -46 : 22)}px`;
    lens.style.transform = `translate(${flipX ? '-100%' : '0'}, 0)`;
    const swatch = lens.firstElementChild;
    const label = lens.lastElementChild;
    if (picked) {
      swatch.style.background = `rgb(${picked.red}, ${picked.green}, ${picked.blue})`;
      label.textContent = `${picked.red}, ${picked.green}, ${picked.blue}`;
    } else {
      swatch.style.background = 'transparent';
      label.textContent = '—';
    }
  }

  // ВАЖНО: никаких instanceof — цель клика из iframe принадлежит ЧУЖОМУ
  // окну, и родительские Node/Element её «не признают» (cross-realm).
  function eyedropperTargetsButton(event) {
    const target = event.target;
    return Boolean(target && typeof target.closest === 'function' && target.closest('#color-eyedropper-button'));
  }

  function onEyedropperPress(event) {
    if (eyedropperTargetsButton(event)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onEyedropperPick(event) {
    // повторный клик по самой кнопке — выключение, им займётся её обработчик
    if (eyedropperTargetsButton(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const doc = (event.target && event.target.ownerDocument) || document;
    const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
    if (picked) {
      applyPickedColor(picked);
    }
    deactivateEyedropper();
  }

  function onEyedropperCancel(event) {
    event.preventDefault();
    event.stopPropagation();
    deactivateEyedropper();
  }

  function onEyedropperKey(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    deactivateEyedropper();
  }
}

// Цвет в точке — послойно, как рисует браузер: текст (по глиф-боксу),
// пиксели <img>/<canvas>, CSS-градиенты, фоновые цвета. Полупрозрачные
// слои складываются альфа-композитингом, пока не наберётся непрозрачность.
export function eyedropperColorAt(doc, x, y) {
  const layers = [];
  collectEyedropperLayers(doc, x, y, layers);
  if (layers.length === 0) return null;
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  for (const layer of layers) {
    const weight = layer.alpha * (1 - alpha);
    red += layer.red * weight;
    green += layer.green * weight;
    blue += layer.blue * weight;
    alpha += weight;
    if (alpha >= 0.999) break;
  }
  if (alpha <= 0) return null;
  return { red: Math.round(red / alpha), green: Math.round(green / alpha), blue: Math.round(blue / alpha), alpha };
}

export function collectEyedropperLayers(doc, x, y, layers) {
  const view = doc.defaultView || window;
  const textLayer = eyedropperTextAt(doc, x, y);
  if (textLayer) layers.push(textLayer);
  const stack = doc.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el.id === 'eyedropper-lens' || (typeof el.closest === 'function' && el.closest('#eyedropper-lens'))) continue;
    const tag = el.tagName;
    if (tag === 'IFRAME') {
      try {
        if (el.contentDocument) {
          const rect = el.getBoundingClientRect();
          collectEyedropperLayers(el.contentDocument, x - rect.left - el.clientLeft, y - rect.top - el.clientTop, layers);
        }
      } catch (_error) {
        // чужеродный iframe недоступен — падаем на фон под ним
      }
      continue;
    }
    if (tag === 'IMG' || tag === 'CANVAS') {
      const pixel = eyedropperPixelFrom(el, x, y);
      if (pixel && pixel.alpha > 0) {
        layers.push(pixel);
        if (pixel.alpha >= 1) return;
      }
      // мимо или сквозь пиксели (letterbox, прозрачность) — ниже лежит
      // CSS-фон самого элемента, проверяем и его
    }
    const style = view.getComputedStyle(el);
    // фоновые слои элемента: градиенты поверх background-color
    for (const gradient of parseCssGradients(style.backgroundImage)) {
      const rect = el.getBoundingClientRect();
      const layer = sampleLinearGradient(gradient, rect, x, y);
      if (layer && layer.alpha > 0) {
        layers.push(layer);
        if (layer.alpha >= 1) return;
      }
    }
    const background = parseCssColor(style.backgroundColor);
    if (background && background.alpha > 0) {
      layers.push(background);
      if (background.alpha >= 1) return;
    }
  }
}

// Попадание в текст: caret-API даёт ближайший символ; если точка лежит
// в его прямоугольнике — берём цвет текста. Бокс символа заметно крупнее
// самого глифа, поэтому по буквам стало можно попадать.
export function eyedropperTextAt(doc, x, y) {
  try {
    let node = null;
    let offset = 0;
    if (typeof doc.caretPositionFromPoint === 'function') {
      const position = doc.caretPositionFromPoint(x, y);
      if (position) { node = position.offsetNode; offset = position.offset; }
    } else if (typeof doc.caretRangeFromPoint === 'function') {
      const range = doc.caretRangeFromPoint(x, y);
      if (range) { node = range.startContainer; offset = range.startOffset; }
    }
    if (!node || node.nodeType !== 3 || !node.parentElement) return null;
    const text = node.textContent;
    if (!text) return null;
    // caret даёт позицию ВСТАВКИ (между символами): клик по правой половине
    // глифа указывает на следующий — проверяем обоих соседей позиции
    for (const from of [offset - 1, offset]) {
      if (from < 0 || from >= text.length) continue;
      if (!text.slice(from, from + 1).trim()) continue;
      const probe = doc.createRange();
      probe.setStart(node, from);
      probe.setEnd(node, from + 1);
      const rect = probe.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
      const view = doc.defaultView || window;
      const color = parseCssColor(view.getComputedStyle(node.parentElement).color);
      return color && color.alpha > 0 ? color : null;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

// Пиксель из <img>/<canvas>: клик в координатах вьюпорта переводится в
// собственные пиксели источника, источник рисуется 1:1 в канву-однушку.
// Для <img> учитывается object-fit (contain/cover/scale-down): клик по
// «полям» вокруг вписанной картинки прозрачен и проваливается ниже.
export function eyedropperPixelFrom(el, x, y) {
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const sourceWidth = el.tagName === 'IMG' ? el.naturalWidth : el.width;
    const sourceHeight = el.tagName === 'IMG' ? el.naturalHeight : el.height;
    if (!sourceWidth || !sourceHeight) return null;
    let box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    if (el.tagName === 'IMG') {
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
      const fit = view.getComputedStyle(el).objectFit;
      if (fit === 'contain' || fit === 'cover' || fit === 'scale-down') {
        const cover = fit === 'cover';
        let scale = cover
          ? Math.max(rect.width / sourceWidth, rect.height / sourceHeight)
          : Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
        if (fit === 'scale-down') scale = Math.min(scale, 1);
        const boxWidth = sourceWidth * scale;
        const boxHeight = sourceHeight * scale;
        box = {
          left: rect.left + (rect.width - boxWidth) / 2,
          top: rect.top + (rect.height - boxHeight) / 2,
          width: boxWidth,
          height: boxHeight,
        };
        if (x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height) return null;
      }
    }
    const px = clamp(Math.floor(((x - box.left) / box.width) * sourceWidth), 0, sourceWidth - 1);
    const py = clamp(Math.floor(((y - box.top) / box.height) * sourceHeight), 0, sourceHeight - 1);
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d', { willReadFrequently: true });
    context.drawImage(el, px, py, 1, 1, 0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    if (data[3] === 0) return null;
    return { red: data[0], green: data[1], blue: data[2], alpha: data[3] / 255 };
  } catch (_error) {
    // канва «испорчена» чужеродной картинкой или источник не читается —
    // честно отступаем к фоновому цвету под элементом
    return null;
  }
}

// Разбор computed background-image: только слои linear-gradient (в порядке
// отрисовки — верхний первым); url(...) и прочее пропускаются насквозь.
export function parseCssGradients(backgroundImage) {
  if (typeof backgroundImage !== 'string' || !backgroundImage.includes('linear-gradient(')) return [];
  const gradients = [];
  let index = 0;
  while ((index = backgroundImage.indexOf('linear-gradient(', index)) !== -1) {
    let depth = 0;
    let end = index + 'linear-gradient('.length - 1;
    for (let i = end; i < backgroundImage.length; i += 1) {
      if (backgroundImage[i] === '(') depth += 1;
      if (backgroundImage[i] === ')') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const body = backgroundImage.slice(index + 'linear-gradient('.length, end);
    const gradient = parseLinearGradientBody(body);
    if (gradient) gradients.push(gradient);
    index = end + 1;
  }
  return gradients;
}

export function parseLinearGradientBody(body) {
  // деление по запятым верхнего уровня (rgb(...) внутри не рвём)
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  if (parts.length === 0) return null;
  let direction = 'to bottom';
  if (/^to |^-?[\d.]+deg$/u.test(parts[0])) direction = parts.shift();
  if (parts.length < 2) return null;
  const stops = [];
  for (const part of parts) {
    const positionMatch = /^(.*?)\s+([\d.]+)%$/u.exec(part);
    const color = parseCssColor(positionMatch ? positionMatch[1] : part);
    if (!color) return null;
    stops.push({ color, position: positionMatch ? Number(positionMatch[2]) / 100 : null });
  }
  if (stops[0].position === null) stops[0].position = 0;
  if (stops[stops.length - 1].position === null) stops[stops.length - 1].position = 1;
  for (let i = 1; i < stops.length - 1; i += 1) {
    if (stops[i].position === null) {
      let next = i;
      while (stops[next].position === null) next += 1;
      const prev = stops[i - 1].position;
      stops[i].position = prev + (stops[next].position - prev) / (next - i + 1);
    }
  }
  return { direction, stops };
}

// Цвет градиента в точке: поддержаны оси to right/left/top/bottom и
// 0/90/180/270deg; диагонали приближаются ближайшей осью — для пипетки
// на ползунках и панелях этого достаточно.
export function sampleLinearGradient(gradient, rect, x, y) {
  if (rect.width === 0 || rect.height === 0) return null;
  let fraction;
  const d = gradient.direction;
  if (d === 'to right' || d === '90deg') fraction = (x - rect.left) / rect.width;
  else if (d === 'to left' || d === '270deg' || d === '-90deg') fraction = (rect.right - x) / rect.width;
  else if (d === 'to top' || d === '0deg') fraction = (rect.bottom - y) / rect.height;
  else if (d === 'to bottom' || d === '180deg') fraction = (y - rect.top) / rect.height;
  else {
    const degMatch = /^(-?[\d.]+)deg$/u.exec(d);
    if (!degMatch) return null;
    const deg = ((Number(degMatch[1]) % 360) + 360) % 360;
    if (deg < 45 || deg >= 315) fraction = (rect.bottom - y) / rect.height;
    else if (deg < 135) fraction = (x - rect.left) / rect.width;
    else if (deg < 225) fraction = (y - rect.top) / rect.height;
    else fraction = (rect.right - x) / rect.width;
  }
  fraction = clamp(fraction, 0, 1);
  const stops = gradient.stops;
  if (fraction <= stops[0].position) return { ...stops[0].color };
  if (fraction >= stops[stops.length - 1].position) return { ...stops[stops.length - 1].color };
  for (let i = 1; i < stops.length; i += 1) {
    if (fraction <= stops[i].position) {
      const span = stops[i].position - stops[i - 1].position;
      const t = span === 0 ? 0 : (fraction - stops[i - 1].position) / span;
      const a = stops[i - 1].color;
      const b = stops[i].color;
      return {
        red: Math.round(a.red + (b.red - a.red) * t),
        green: Math.round(a.green + (b.green - a.green) * t),
        blue: Math.round(a.blue + (b.blue - a.blue) * t),
        alpha: a.alpha + (b.alpha - a.alpha) * t,
      };
    }
  }
  return null;
}

export function parseCssColor(text) {
  if (typeof text !== 'string') return null;
  const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/u.exec(text.trim());
  if (!match) return null;
  return {
    red: clamp(Number(match[1]), 0, 255),
    green: clamp(Number(match[2]), 0, 255),
    blue: clamp(Number(match[3]), 0, 255),
    alpha: match[4] === undefined ? 1 : clamp(Number(match[4]), 0, 1),
  };
}
