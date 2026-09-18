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
      doc.addEventListener('mousedown', onEyedropperPick, true);
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
        doc.removeEventListener('mousedown', onEyedropperPick, true);
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

  // Цвет берётся по НАЖАТИЮ кнопки мыши, а не по click. У работающей программы предпросмотр
  // пересобирает свои элементы десятки раз в секунду: между нажатием и отпусканием холст под
  // курсором успевает смениться, и браузер click вообще не присылает — пипетка «не брала» цвет
  // с активного холста и оставалась включённой (находка владельца, 1.6.2).
  function onEyedropperPick(event) {
    // повторный клик по самой кнопке — выключение, им займётся её обработчик
    if (eyedropperTargetsButton(event)) return;
    if (event.button !== undefined && event.button !== 0) return; // правая кнопка — отмена, у неё свой обработчик
    event.preventDefault();
    event.stopPropagation();
    const doc = (event.target && event.target.ownerDocument) || document;
    const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
    if (picked) {
      applyPickedColor(picked);
    }
    swallowNextClick(hookedDocuments.map((entry) => entry.doc));
    deactivateEyedropper();
  }

  // Нажатие мы уже съели, но отпускание породит click — он не должен нажать кнопку или ссылку,
  // оказавшуюся под пипеткой. Глотаем один ближайший click (и страхуемся таймером).
  function swallowNextClick(documents) {
    const swallow = (event) => {
      event.preventDefault();
      event.stopPropagation();
      release();
    };
    const release = () => {
      for (const doc of documents) {
        try { doc.removeEventListener('click', swallow, true); } catch (_error) { /* документ выгружен */ }
      }
    };
    for (const doc of documents) doc.addEventListener('click', swallow, true);
    window.setTimeout(release, 600);
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
    // рамка рисуется поверх фона: попали в неё — берём её цвет
    const border = eyedropperBorderAt(el, style, x, y);
    if (border && border.alpha > 0) {
      layers.push(border);
      if (border.alpha >= 1) return;
    }
    // фоновые слои элемента в порядке отрисовки (верхний первым): градиенты и картинки url(...)
    // поверх background-color. Образец цвета в «Генераторе» — как раз цвет поверх картинки.
    const rect = el.getBoundingClientRect();
    for (const background of parseCssBackgroundLayers(style)) {
      const layer = background.kind === 'gradient'
        ? sampleLinearGradient(background.gradient, rect, x, y)
        : sampleBackgroundPicture(background, el, style, x, y);
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

// Деление по запятым верхнего уровня: rgb(...), url(...) и градиенты внутри не рвём.
export function splitCssTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part !== '');
}

// Слои background-image вместе со своими размером, положением и повтором. У CSS списки
// background-size/position/repeat короче списка картинок повторяются по кругу.
export function parseCssBackgroundLayers(style) {
  const images = typeof style.backgroundImage === 'string' && style.backgroundImage !== 'none'
    ? splitCssTopLevel(style.backgroundImage)
    : [];
  if (images.length === 0) return [];
  const sizes = splitCssTopLevel(style.backgroundSize || 'auto');
  const positions = splitCssTopLevel(style.backgroundPosition || '0% 0%');
  const repeats = splitCssTopLevel(style.backgroundRepeat || 'repeat');
  const layers = [];
  images.forEach((image, index) => {
    if (image.startsWith('linear-gradient(')) {
      const gradient = parseLinearGradientBody(image.slice('linear-gradient('.length, -1));
      if (gradient) layers.push({ kind: 'gradient', gradient });
      return;
    }
    const url = /^url\((['"]?)(.*?)\1\)$/u.exec(image);
    if (!url) return; // radial-gradient и прочее — насквозь, как раньше
    layers.push({
      kind: 'picture',
      url: url[2],
      size: sizes[index % sizes.length] || 'auto',
      position: positions[index % positions.length] || '0% 0%',
      repeat: repeats[index % repeats.length] || 'repeat',
    });
  });
  return layers;
}

const backgroundPictures = new Map();

function backgroundPicture(url) {
  let image = backgroundPictures.get(url);
  if (!image) {
    image = new Image();
    image.src = url;
    backgroundPictures.set(url, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function cssLength(token, container, own) {
  if (token.endsWith('%')) return ((container - own) * Number.parseFloat(token)) / 100;
  return Number.parseFloat(token) || 0;
}

// Пиксель фоновой картинки под точкой. Картинка грузится из кэша браузера; пока не догрузилась —
// слой пропускается, следующее движение мыши его уже увидит.
export function sampleBackgroundPicture(layer, el, style, x, y) {
  const image = backgroundPicture(layer.url);
  if (!image) return null;
  const rect = el.getBoundingClientRect();
  // область фона по умолчанию — padding-box
  const left = rect.left + (Number.parseFloat(style.borderLeftWidth) || 0);
  const top = rect.top + (Number.parseFloat(style.borderTopWidth) || 0);
  const width = rect.width - (Number.parseFloat(style.borderLeftWidth) || 0) - (Number.parseFloat(style.borderRightWidth) || 0);
  const height = rect.height - (Number.parseFloat(style.borderTopWidth) || 0) - (Number.parseFloat(style.borderBottomWidth) || 0);
  if (width <= 0 || height <= 0) return null;

  let drawnWidth = image.naturalWidth;
  let drawnHeight = image.naturalHeight;
  const size = layer.size.trim();
  if (size === 'cover' || size === 'contain') {
    const scale = size === 'cover'
      ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
      : Math.min(width / image.naturalWidth, height / image.naturalHeight);
    drawnWidth = image.naturalWidth * scale;
    drawnHeight = image.naturalHeight * scale;
  } else if (size !== 'auto' && size !== 'auto auto') {
    const [first, second = 'auto'] = size.split(/\s+/u);
    const ratio = image.naturalHeight / image.naturalWidth;
    const explicitWidth = first === 'auto' ? null : (first.endsWith('%') ? (width * Number.parseFloat(first)) / 100 : Number.parseFloat(first));
    const explicitHeight = second === 'auto' ? null : (second.endsWith('%') ? (height * Number.parseFloat(second)) / 100 : Number.parseFloat(second));
    if (explicitWidth !== null && explicitHeight !== null) { drawnWidth = explicitWidth; drawnHeight = explicitHeight; }
    else if (explicitWidth !== null) { drawnWidth = explicitWidth; drawnHeight = explicitWidth * ratio; }
    else if (explicitHeight !== null) { drawnHeight = explicitHeight; drawnWidth = explicitHeight / ratio; }
  }
  if (!(drawnWidth > 0) || !(drawnHeight > 0)) return null;

  const [positionX = '0%', positionY = '0%'] = layer.position.trim().split(/\s+/u);
  let localX = x - left - cssLength(positionX, width, drawnWidth);
  let localY = y - top - cssLength(positionY, height, drawnHeight);
  const repeat = layer.repeat.trim();
  const repeatX = repeat === 'repeat' || repeat === 'repeat-x' || repeat.startsWith('repeat ');
  const repeatY = repeat === 'repeat' || repeat === 'repeat-y' || repeat.endsWith(' repeat');
  if (repeatX) localX = ((localX % drawnWidth) + drawnWidth) % drawnWidth;
  if (repeatY) localY = ((localY % drawnHeight) + drawnHeight) % drawnHeight;
  if (localX < 0 || localY < 0 || localX >= drawnWidth || localY >= drawnHeight) return null;

  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d', { willReadFrequently: true });
    const sourceX = clamp(Math.floor((localX / drawnWidth) * image.naturalWidth), 0, image.naturalWidth - 1);
    const sourceY = clamp(Math.floor((localY / drawnHeight) * image.naturalHeight), 0, image.naturalHeight - 1);
    context.drawImage(image, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    if (data[3] === 0) return null;
    return { red: data[0], green: data[1], blue: data[2], alpha: data[3] / 255 };
  } catch (_error) {
    return null; // картинка с чужого адреса «портит» холст — отступаем к тому, что ниже
  }
}

// Рамка элемента: точка внутри прямоугольника, но снаружи padding-box — цвет этой стороны рамки.
export function eyedropperBorderAt(el, style, x, y) {
  const rect = el.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const sides = [
    ['Top', y - rect.top], ['Bottom', rect.bottom - y], ['Left', x - rect.left], ['Right', rect.right - x],
  ];
  for (const [side, distance] of sides) {
    const width = Number.parseFloat(style[`border${side}Width`]) || 0;
    if (width <= 0 || distance > width) continue;
    const borderStyle = style[`border${side}Style`];
    if (borderStyle === 'none' || borderStyle === 'hidden') continue;
    return parseCssColor(style[`border${side}Color`]);
  }
  return null;
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
