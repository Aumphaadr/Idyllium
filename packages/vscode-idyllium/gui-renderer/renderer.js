'use strict';

(function () {
  const host = window.IdylliumGuiHost
    || (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage() {} });
  let state = window.IdylliumGuiInitialState || { windows: [], canvases: [], modals: [] };
  let stateJson = JSON.stringify(state);
  let activeCanvasId = null;
  let activeControl = null;
  let deferredState = null;
  let draggingControlId = null;
  let fontRefreshScheduled = false;
  const fontCache = new Map();
  const imageCache = new Map();
  const modalInputValues = new Map();
  const stage = document.getElementById('stage');
  const summary = document.getElementById('summary');
  stage.tabIndex = 0;

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message && message.type === 'theme') {
      applyTheme(message.theme);
      return;
    }
    if (!message || message.type !== 'snapshot') return;
    const nextState = {
      windows: message.windows || [],
      canvases: message.canvases || [],
      modals: message.modals || [],
    };
    const nextStateJson = JSON.stringify(nextState);
    if (nextStateJson === stateJson) return;
    if (draggingControlId !== null) {
      deferredState = nextState;
      return;
    }
    state = nextState;
    stateJson = nextStateJson;
    renderAll();
  });

  document.addEventListener('keydown', (event) => {
    if (isTextEditingTarget(event.target)) return;
    if (activeCanvasId === null) return;
    postGuiEvent(activeCanvasId, 'key_pressed', { key: normalizeKey(event.key) });
    event.preventDefault();
  });

  document.addEventListener('keyup', (event) => {
    if (isTextEditingTarget(event.target)) return;
    if (activeCanvasId === null) return;
    postGuiEvent(activeCanvasId, 'key_released', { key: normalizeKey(event.key) });
    event.preventDefault();
  });

  renderAll();

  function applyTheme(theme) {
    const light = theme === 'light';
    document.body.classList.toggle('theme-light', light);
    document.body.classList.toggle('theme-dark', !light);
  }

  function renderAll() {
    rememberActiveControl();
    ensureActiveCanvas();
    forgetClosedModalInputs();
    stage.replaceChildren();
    summary.textContent = state.windows.length > 0
      ? 'окон: ' + state.windows.length
      : 'холстов: ' + state.canvases.length;

    if (state.windows.length === 0 && state.canvases.length === 0 && state.modals.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Предварительный просмотр GUI появится здесь.';
      stage.appendChild(empty);
    }

    for (const win of state.windows) {
      stage.appendChild(renderWindow(win));
    }

    if (state.windows.length === 0) {
      for (const canvas of state.canvases) {
        stage.appendChild(renderStandaloneCanvas(canvas));
      }
    }

    for (const modal of state.modals || []) {
      stage.appendChild(renderModal(modal));
    }

    restoreActiveControl();
  }

  function renderWindow(win) {
    const width = positiveNumber(win.properties.width, 640);
    const height = positiveNumber(win.properties.height, 420);
    const inheritedColors = childInheritedColors(win.properties, {});
    const titleHeight = 28;
    const root = document.createElement('section');
    root.className = 'window';
    root.style.width = width + 'px';
    root.style.height = (height + titleHeight) + 'px';
    root.style.background = displayedWidgetColor(win.properties, 'background_color', {}) || '#ffffff';
    const textColor = displayedWidgetColor(win.properties, 'text_color', {});
    if (textColor) root.style.color = textColor;

    const title = document.createElement('div');
    title.className = 'titlebar';
    const titleText = document.createElement('span');
    titleText.className = 'titlebar-title';
    titleText.textContent = stringValue(win.properties.title, 'Idyllium Window');
    title.appendChild(titleText);
    const close = document.createElement('button');
    close.className = 'window-close-button';
    close.type = 'button';
    close.title = 'Закрыть';
    close.setAttribute('aria-label', 'закрыть приложение');
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      postCloseApp();
    });
    title.appendChild(close);
    root.appendChild(title);

    const content = document.createElement('div');
    content.className = 'content';
    content.style.width = width + 'px';
    content.style.height = height + 'px';
    root.appendChild(content);

    for (const child of win.children || []) {
      content.appendChild(renderWidget(child, win.id, inheritedColors));
    }

    return root;
  }

  function renderModal(modal) {
    const props = modal.properties || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop';

    const dialog = document.createElement('section');
    dialog.className = 'modal-dialog';
    overlay.appendChild(dialog);

    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = stringValue(props.title, 'Message');
    dialog.appendChild(title);

    const message = document.createElement('p');
    message.className = 'modal-message';
    message.textContent = stringValue(props.message, '');
    dialog.appendChild(message);

    let input = null;
    if (modal.mode === 'input') {
      input = document.createElement('input');
      input.className = 'modal-input';
      input.type = 'text';
      input.value = modalInputValues.get(modal.id) || '';
      input.dataset.focusWidgetId = 'modal-' + modal.id;
      input.addEventListener('focus', () => {
        activeControl = controlState(input);
        activeCanvasId = null;
      });
      input.addEventListener('input', () => {
        modalInputValues.set(modal.id, input.value);
        activeControl = controlState(input);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          modalInputValues.delete(modal.id);
          postGuiEvent(modal.id, 'modal_confirm', { input_value: input.value });
          event.preventDefault();
        }
        if (event.key === 'Escape') {
          modalInputValues.delete(modal.id);
          postGuiEvent(modal.id, 'modal_cancel', { input_value: input.value });
          event.preventDefault();
        }
      });
      dialog.appendChild(input);
      setTimeout(() => input.focus(), 0);
    }

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    if (modal.mode !== 'alert') {
      const cancel = document.createElement('button');
      cancel.className = 'modal-button';
      cancel.type = 'button';
      cancel.textContent = stringValue(props.cancel_text, 'Cancel');
      cancel.addEventListener('click', () => {
        modalInputValues.delete(modal.id);
        postGuiEvent(modal.id, 'modal_cancel', { input_value: input ? input.value : '' });
      });
      actions.appendChild(cancel);
    }

    const confirm = document.createElement('button');
    confirm.className = 'modal-button primary';
    confirm.type = 'button';
    confirm.textContent = stringValue(props.confirm_text, 'OK');
    confirm.addEventListener('click', () => {
      modalInputValues.delete(modal.id);
      postGuiEvent(modal.id, 'modal_confirm', { input_value: input ? input.value : '' });
    });
    actions.appendChild(confirm);

    dialog.appendChild(actions);
    return overlay;
  }

  function renderWidget(widget, parentId = 0, inheritedColors = {}) {
    if (widget.type === 'gui.Canvas' && widget.canvas) {
      return renderCanvasWidget(widget);
    }

    if (widget.type === 'gui.Button') return renderButton(widget, inheritedColors);
    if (widget.type === 'gui.LineEdit') return renderLineEdit(widget, inheritedColors);
    if (widget.type === 'gui.TextEdit') return renderTextEdit(widget, inheritedColors);
    if (widget.type === 'gui.SpinBox' || widget.type === 'gui.FloatSpinBox') return renderSpinBox(widget, inheritedColors);
    if (widget.type === 'gui.Slider') return renderSlider(widget, inheritedColors);
    if (widget.type === 'gui.CheckBox') return renderCheckBox(widget, inheritedColors);
    if (widget.type === 'gui.RadioButton') return renderRadioButton(widget, parentId, inheritedColors);
    if (widget.type === 'gui.ComboBox') return renderComboBox(widget, inheritedColors);
    if (widget.type === 'gui.ProgressBar') return renderProgressBar(widget, inheritedColors);
    if (widget.type === 'gui.Frame') return renderFrame(widget, inheritedColors);
    if (widget.type === 'gui.Image') return renderImage(widget, inheritedColors);
    if (widget.type === 'gui.Label') return renderLabel(widget, inheritedColors);

    return renderPlaceholder(widget, inheritedColors);
  }

  function renderImage(widget, inheritedColors) {
    const props = widget.properties || {};
    const el = baseWidget('div', widget, 'image-widget', inheritedColors);
    const uri = props.webview_uri || props.resource_uri;

    if (props.is_loaded === true && uri) {
      const image = document.createElement('img');
      image.alt = stringValue(props.path, 'image');
      image.src = uri;
      image.draggable = false;
      applyImageResizeMode(image, stringValue(props.resize_mode, 'fit'));
      el.appendChild(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.textContent = stringValue(props.path, 'image');
      el.classList.add('image-placeholder');
      el.appendChild(placeholder);
    }

    return el;
  }

  function applyImageResizeMode(image, resizeMode) {
    const mode = resizeMode === 'fill' || resizeMode === 'stretch' || resizeMode === 'original'
      ? resizeMode
      : 'fit';
    if (mode === 'fill') {
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'cover';
      return;
    }
    if (mode === 'stretch') {
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'fill';
      return;
    }
    if (mode === 'original') {
      image.style.width = 'auto';
      image.style.height = 'auto';
      image.style.maxWidth = 'none';
      image.style.maxHeight = 'none';
      image.style.objectFit = 'none';
      return;
    }

    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'contain';
  }

  function renderLabel(widget, inheritedColors) {
    const el = baseWidget('div', widget, 'label', inheritedColors);
    el.textContent = stringValue(widget.properties.text, '');
    el.addEventListener('click', () => postGuiEvent(widget.id, 'click', {}));
    return el;
  }

  function renderButton(widget, inheritedColors) {
    const el = baseWidget('button', widget, 'button control', inheritedColors);
    el.type = 'button';
    el.textContent = stringValue(widget.properties.text, '');
    el.addEventListener('click', () => postGuiEvent(widget.id, 'click', {}));
    return el;
  }

  function renderLineEdit(widget, inheritedColors) {
    const el = baseWidget('input', widget, 'control', inheritedColors);
    const mode = stringValue(widget.properties.echo_mode, 'normal');
    el.type = mode === 'password' ? 'password' : 'text';
    el.value = stringValue(widget.properties.text, '');
    el.placeholder = stringValue(widget.properties.placeholder, '');
    el.style.fontSize = positiveNumber(widget.properties.font_size, 13) + 'px';
    if (mode === 'no_echo') el.classList.add('no-echo');
    installControlFocus(el, widget.id);
    el.addEventListener('input', () => postGuiEvent(widget.id, 'change', { text: el.value }));
    return el;
  }

  function renderTextEdit(widget, inheritedColors) {
    const el = baseWidget('textarea', widget, 'control', inheritedColors);
    el.value = stringValue(widget.properties.text, '');
    el.placeholder = stringValue(widget.properties.placeholder, '');
    installControlFocus(el, widget.id);
    el.addEventListener('input', () => postGuiEvent(widget.id, 'change', { text: el.value }));
    return el;
  }

  function renderSpinBox(widget, inheritedColors) {
    const el = baseWidget('input', widget, 'control', inheritedColors);
    el.type = 'number';
    const min = numberValue(widget.properties.min, 0);
    const max = numberValue(widget.properties.max, 100);
    const step = numberValue(widget.properties.step, widget.type === 'gui.FloatSpinBox' ? 0.1 : 1);
    el.min = String(min);
    el.max = String(max);
    el.step = String(step);
    el.value = String(numberValue(widget.properties.value, 0));
    installControlFocus(el, widget.id);
    const emitChange = () => postGuiEvent(widget.id, 'change', { value: Number(el.value) });
    el.addEventListener('change', emitChange);
    el.addEventListener('input', emitChange);
    el.addEventListener('wheel', (event) => {
      const value = spinBoxWheelValue(el.value, min, max, step, event.deltaY < 0, widget.type === 'gui.FloatSpinBox');
      el.value = String(value);
      activeControl = controlState(el);
      emitChange();
      event.preventDefault();
    }, { passive: false });
    return el;
  }

  function spinBoxWheelValue(rawValue, min, max, step, increase, floating) {
    const current = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;
    const safeStep = step > 0 ? step : 1;
    const direction = increase ? 1 : -1;
    let next = clampNumber(current + direction * safeStep, min, max);
    if (!floating) return Math.trunc(next);
    const precision = Math.min(10, Math.max(decimalPlaces(safeStep), decimalPlaces(current), decimalPlaces(min), decimalPlaces(max)));
    next = Number(next.toFixed(precision));
    return next;
  }

  function clampNumber(value, min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.max(low, Math.min(high, value));
  }

  function decimalPlaces(value) {
    const text = String(value);
    if (!text.includes('.')) return 0;
    return text.split('.')[1].replace(/0+$/u, '').length;
  }

  function renderSlider(widget, inheritedColors) {
    const el = baseWidget('input', widget, 'control', inheritedColors);
    el.type = 'range';
    el.min = String(numberValue(widget.properties.min, 0));
    el.max = String(numberValue(widget.properties.max, 100));
    el.step = String(numberValue(widget.properties.step, 1));
    el.value = String(numberValue(widget.properties.value, 0));
    installControlFocus(el, widget.id);
    el.addEventListener('pointerdown', (event) => {
      draggingControlId = widget.id;
      activeControl = controlState(el);
      activeCanvasId = null;
      if (typeof el.setPointerCapture === 'function') {
        el.setPointerCapture(event.pointerId);
      }
    });
    el.addEventListener('input', () => {
      activeControl = controlState(el);
    });
    el.addEventListener('change', () => {
      postGuiEvent(widget.id, 'change', { value: Number(el.value) });
      releaseDragControl(widget.id);
    });
    el.addEventListener('pointerup', () => {
      releaseDragControl(widget.id);
    });
    el.addEventListener('pointercancel', () => releaseDragControl(widget.id));
    return el;
  }

  function renderCheckBox(widget, inheritedColors) {
    const el = baseWidget('label', widget, 'choice control', inheritedColors);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = widget.properties.is_checked === true;
    const text = document.createElement('span');
    text.textContent = stringValue(widget.properties.text, '');
    el.appendChild(input);
    el.appendChild(text);
    installControlFocus(input, widget.id);
    input.addEventListener('change', () => postGuiEvent(widget.id, 'change', { is_checked: input.checked }));
    return el;
  }

  function renderRadioButton(widget, parentId, inheritedColors) {
    const el = baseWidget('label', widget, 'choice control', inheritedColors);
    const input = document.createElement('input');
    input.type = 'radio';
    const group = stringValue(widget.properties.group, '');
    input.name = group ? 'idyllium-radio-group-' + group : 'idyllium-radio-parent-' + parentId;
    input.checked = widget.properties.is_selected === true;
    const text = document.createElement('span');
    text.textContent = stringValue(widget.properties.text, '');
    el.appendChild(input);
    el.appendChild(text);
    installControlFocus(input, widget.id);
    input.addEventListener('change', () => {
      if (input.checked) postGuiEvent(widget.id, 'change', { is_selected: true });
    });
    return el;
  }

  function renderComboBox(widget, inheritedColors) {
    const el = baseWidget('select', widget, 'control', inheritedColors);
    const items = widget.items || [];
    const selectedIndex = numberValue(widget.properties.selected_index, -1);
    for (let index = 0; index < items.length; index++) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = items[index];
      option.selected = index === selectedIndex;
      el.appendChild(option);
    }
    installControlFocus(el, widget.id);
    el.addEventListener('change', () => postGuiEvent(widget.id, 'change', { selected_index: Number(el.value) }));
    return el;
  }

  function renderProgressBar(widget, inheritedColors) {
    const el = baseWidget('div', widget, 'progressbar', inheritedColors);
    const min = numberValue(widget.properties.min, 0);
    const max = numberValue(widget.properties.max, 100);
    const value = numberValue(widget.properties.value, 0);
    const percent = max <= min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    const fill = document.createElement('div');
    fill.className = 'progressbar-fill';
    fill.style.width = percent + '%';
    const fillColor = isExplicitProperty(widget.properties, 'foreground_color')
      ? widget.properties.foreground_color
      : widget.properties.fill_color;
    fill.style.backgroundColor = color(fillColor, '#0066cc');
    el.appendChild(fill);

    const label = document.createElement('div');
    label.className = 'progressbar-label';
    label.textContent = Math.round(percent) + '%';
    el.appendChild(label);
    return el;
  }

  function renderFrame(widget, inheritedColors) {
    const el = baseWidget('fieldset', widget, 'frame', inheritedColors);
    const childColors = childInheritedColors(widget.properties || {}, inheritedColors);
    const title = stringValue(widget.properties.title, '');
    if (title) {
      const legend = document.createElement('legend');
      legend.textContent = title;
      el.appendChild(legend);
    }
    for (const child of widget.children || []) {
      el.appendChild(renderWidget(child, widget.id, childColors));
    }
    return el;
  }

  function renderPlaceholder(widget, inheritedColors) {
    const el = baseWidget('div', widget, 'placeholder', inheritedColors);
    el.textContent = widget.type.replace(/^gui\\./, '');
    return el;
  }

  function baseWidget(tagName, widget, className, inheritedColors = {}) {
    const el = document.createElement(tagName);
    el.className = 'widget ' + className;
    el.dataset.widgetId = String(widget.id);
    applyWidgetBox(el, widget.properties);
    applyWidgetColors(el, widget.properties, inheritedColors);
    return el;
  }

  function renderCanvasWidget(widget) {
    const canvas = document.createElement('canvas');
    canvas.className = 'widget canvas';
    applyWidgetBox(canvas, widget.properties);
    const width = positiveNumber(widget.properties.width, 300);
    const height = positiveNumber(widget.properties.height, 150);
    canvas.width = width;
    canvas.height = height;
    drawCanvasCommands(canvas, widget.canvas.commands || []);
    installCanvasEventHandlers(canvas, widget.canvas.id);
    return canvas;
  }

  function renderStandaloneCanvas(canvasSnapshot) {
    const canvas = document.createElement('canvas');
    canvas.className = 'canvas';
    const width = positiveNumber(canvasSnapshot.properties.width, 640);
    const height = positiveNumber(canvasSnapshot.properties.height, 420);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    drawCanvasCommands(canvas, canvasSnapshot.commands || []);
    installCanvasEventHandlers(canvas, canvasSnapshot.id);
    return canvas;
  }

  function installCanvasEventHandlers(canvas, canvasId) {
    canvas.tabIndex = 0;
    canvas.dataset.canvasId = String(canvasId);
    canvas.addEventListener('mousedown', (event) => {
      activeCanvasId = canvasId;
      stage.focus();
      postGuiEvent(canvasId, 'mouse_pressed', mousePayload(canvas, event));
      event.preventDefault();
    });
    canvas.addEventListener('mouseenter', () => {
      activeCanvasId = canvasId;
    });
    canvas.addEventListener('mouseup', (event) => {
      postGuiEvent(canvasId, 'mouse_released', mousePayload(canvas, event));
      event.preventDefault();
    });
    canvas.addEventListener('mousemove', (event) => {
      postGuiEvent(canvasId, 'mouse_move', mousePayload(canvas, event));
    });
    canvas.addEventListener('wheel', (event) => {
      const payload = mousePayload(canvas, event);
      payload.delta = event.deltaY < 0 ? 1 : -1;
      postGuiEvent(canvasId, 'mouse_scroll', payload);
      event.preventDefault();
    }, { passive: false });
  }

  function ensureActiveCanvas() {
    const ids = [];
    const visitCanvas = (canvas) => {
      if (canvas && typeof canvas.id === 'number') ids.push(canvas.id);
    };
    const visitWidget = (widget) => {
      if (!widget) return;
      if (widget.canvas) visitCanvas(widget.canvas);
      for (const child of widget.children || []) visitWidget(child);
    };
    for (const canvas of state.canvases || []) visitCanvas(canvas);
    for (const win of state.windows || []) visitWidget(win);
    if (!ids.includes(activeCanvasId)) activeCanvasId = ids.length > 0 ? ids[0] : null;
  }

  function forgetClosedModalInputs() {
    const openIds = new Set((state.modals || []).map((modal) => modal.id));
    for (const id of modalInputValues.keys()) {
      if (!openIds.has(id)) modalInputValues.delete(id);
    }
  }

  function releaseDragControl(widgetId) {
    if (draggingControlId !== widgetId) return;
    draggingControlId = null;
    if (deferredState) {
      state = deferredState;
      stateJson = JSON.stringify(state);
      deferredState = null;
      renderAll();
    }
  }

  function installControlFocus(el, widgetId) {
    el.dataset.widgetId = String(widgetId);
    el.dataset.focusWidgetId = String(widgetId);
    el.addEventListener('focus', () => {
      activeControl = controlState(el);
      activeCanvasId = null;
    });
    el.addEventListener('input', () => {
      activeControl = controlState(el);
    });
    el.addEventListener('click', () => {
      activeControl = controlState(el);
      activeCanvasId = null;
    });
  }

  function rememberActiveControl() {
    const active = document.activeElement;
    if (!active || !active.dataset || !active.dataset.widgetId) return;
    activeControl = controlState(active);
  }

  function restoreActiveControl() {
    if (!activeControl) return;
    const el = stage.querySelector('[data-focus-widget-id="' + activeControl.widgetId + '"]')
      || stage.querySelector('[data-widget-id="' + activeControl.widgetId + '"]');
    if (!el || typeof el.focus !== 'function') return;
    el.focus();
    if (
      typeof el.setSelectionRange === 'function'
      && typeof activeControl.selectionStart === 'number'
      && typeof activeControl.selectionEnd === 'number'
    ) {
      try {
        el.setSelectionRange(activeControl.selectionStart, activeControl.selectionEnd);
      } catch (_error) {
        // Some input types, such as range and number, do not support selection ranges.
      }
    }
  }

  function controlState(el) {
    return {
      widgetId: el.dataset.focusWidgetId || el.dataset.widgetId,
      selectionStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
      selectionEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
    };
  }

  function isTextEditingTarget(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function postGuiEvent(objectId, eventName, payload) {
    host.postMessage({ type: 'guiEvent', objectId, eventName, payload });
  }

  function postCloseApp() {
    host.postMessage({ type: 'closeApp' });
  }

  function mousePayload(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.trunc((event.clientX - rect.left) * canvas.width / Math.max(1, rect.width)),
      y: Math.trunc((event.clientY - rect.top) * canvas.height / Math.max(1, rect.height)),
      mouse_button: mouseButtonName(event.button),
    };
  }

  function mouseButtonName(button) {
    if (button === 0) return 'LEFT';
    if (button === 1) return 'MIDDLE';
    if (button === 2) return 'RIGHT';
    return 'UNKNOWN';
  }

  function normalizeKey(key) {
    return key.length === 1 ? key.toUpperCase() : key;
  }

  function drawCanvasCommands(canvas, commands) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const command of commands) {
      if (command.kind === 'clear') {
        ctx.fillStyle = color(command.color, '#000000');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (command.kind === 'fill') {
        ctx.fillStyle = color(command.color, '#000000');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (command.kind === 'draw' && command.object) {
        drawObject(ctx, command.object);
      }
    }
  }

  function drawObject(ctx, object) {
    const props = object.properties || {};
    if (object.type === 'drawable.Rectangle') {
      const x = numberValue(props.x);
      const y = numberValue(props.y);
      const width = positiveNumber(props.width);
      const height = positiveNumber(props.height);
      const rotation = numberValue(props.rotation, 0);
      if (rotation !== 0) {
        ctx.save();
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillStyle = color(props.fill_color, 'rgba(0, 0, 0, 0)');
        ctx.fillRect(-width / 2, -height / 2, width, height);
        drawBorderRectAt(ctx, props, -width / 2, -height / 2, width, height);
        ctx.restore();
        return;
      }
      ctx.fillStyle = color(props.fill_color, 'rgba(0, 0, 0, 0)');
      ctx.fillRect(x, y, width, height);
      drawBorderRect(ctx, props);
    }
    if (object.type === 'drawable.Circle') {
      ctx.beginPath();
      ctx.arc(numberValue(props.x), numberValue(props.y), positiveNumber(props.radius), 0, Math.PI * 2);
      ctx.fillStyle = color(props.fill_color, 'rgba(0, 0, 0, 0)');
      ctx.fill();
      drawBorderCircle(ctx, props);
    }
    if (object.type === 'drawable.Line') {
      const thickness = positiveNumber(props.thickness, 1);
      if (thickness <= 0) return;
      ctx.beginPath();
      ctx.moveTo(numberValue(props.x1), numberValue(props.y1));
      ctx.lineTo(numberValue(props.x2), numberValue(props.y2));
      ctx.lineWidth = thickness;
      ctx.strokeStyle = color(props.color, '#ffffff');
      ctx.stroke();
    }
    if (object.type === 'drawable.Text') {
      ctx.fillStyle = color(props.text_color, '#ffffff');
      ctx.font = canvasTextFont(props);
      ctx.textBaseline = 'top';
      ctx.fillText(stringValue(props.text, ''), numberValue(props.x), numberValue(props.y));
    }
    if (object.type === 'drawable.Sprite') {
      const x = numberValue(props.x);
      const y = numberValue(props.y);
      const texture = props.texture && props.texture.properties ? props.texture.properties : null;
      const image = loadImage(texture && (texture.webview_uri || texture.resource_uri));
      if (image && image.complete && image.naturalWidth > 0) {
        const w = image.naturalWidth * numberValue(props.scale_x, 1);
        const h = image.naturalHeight * numberValue(props.scale_y, 1);
        ctx.drawImage(image, x, y, w, h);
      } else {
        const w = 64 * numberValue(props.scale_x, 1);
        const h = 64 * numberValue(props.scale_y, 1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(texture && texture.path ? texture.path : 'sprite', x + 6, y + 6);
      }
    }
  }

  function loadImage(uri) {
    if (!uri) return null;
    const cached = imageCache.get(uri);
    if (cached) return cached;

    const image = new Image();
    image.src = uri;
    imageCache.set(uri, image);
    return image;
  }

  function canvasTextFont(props) {
    const size = positiveNumber(props.font_size, 16);
    const font = props.font && props.font.properties ? props.font.properties : null;
    const family = canvasFontFamily(font);
    return family === 'sans-serif' ? size + 'px sans-serif' : size + 'px ' + family + ', sans-serif';
  }

  function canvasFontFamily(font) {
    const uri = font && (font.webview_uri || font.resource_uri);
    if (!font || font.is_loaded !== true || !uri) return 'sans-serif';

    let cached = fontCache.get(uri);
    if (cached) return cached.family;

    const family = 'IdylliumFont' + (fontCache.size + 1);
    cached = { family, status: 'loading' };
    fontCache.set(uri, cached);

    if (typeof FontFace !== 'function' || !document.fonts || typeof document.fonts.add !== 'function') {
      cached.status = 'unsupported';
      return family;
    }

    const face = new FontFace(family, 'url("' + cssString(uri) + '")');
    cached.face = face;
    face.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
      cached.status = 'loaded';
      scheduleFontRefresh();
    }).catch(() => {
      cached.status = 'error';
      scheduleFontRefresh();
    });

    return family;
  }

  function scheduleFontRefresh() {
    if (fontRefreshScheduled) return;
    fontRefreshScheduled = true;
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    schedule(() => {
      fontRefreshScheduled = false;
      renderAll();
    });
  }

  function cssString(value) {
    return String(value).replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
  }

  function drawBorderRect(ctx, props) {
    drawBorderRectAt(ctx, props, numberValue(props.x), numberValue(props.y), positiveNumber(props.width), positiveNumber(props.height));
  }

  function drawBorderRectAt(ctx, props, x, y, widthValue, heightValue) {
    const width = positiveNumber(props.border_width, 0);
    if (width <= 0) return;
    ctx.lineWidth = width;
    ctx.strokeStyle = color(props.border_color, 'rgba(0, 0, 0, 0)');
    ctx.strokeRect(x, y, widthValue, heightValue);
  }

  function drawBorderCircle(ctx, props) {
    const width = positiveNumber(props.border_width, 0);
    if (width <= 0) return;
    ctx.lineWidth = width;
    ctx.strokeStyle = color(props.border_color, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(numberValue(props.x), numberValue(props.y), positiveNumber(props.radius), 0, Math.PI * 2);
    ctx.stroke();
  }

  function applyWidgetBox(el, props) {
    const width = positiveNumber(props.width, 120);
    const height = positiveNumber(props.height, 32);
    el.style.left = numberValue(props.x) + 'px';
    el.style.top = numberValue(props.y) + 'px';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    if (props.visible === false) el.style.display = 'none';
  }

  function applyWidgetColors(el, props, inheritedColors) {
    const textColor = displayedWidgetColor(props, 'text_color', inheritedColors);
    if (textColor) el.style.color = textColor;

    const backgroundColor = displayedWidgetColor(props, 'background_color', inheritedColors);
    if (
      backgroundColor
      && (
        isExplicitProperty(props, 'background_color')
        || inheritedColors.background_color
        || !isTransparentColor(backgroundColor)
      )
    ) {
      el.style.backgroundColor = backgroundColor;
    }

    if (props.border_color) el.style.borderColor = color(props.border_color, 'transparent');
    if (props.border_width !== undefined) el.style.borderWidth = positiveNumber(props.border_width, 0) + 'px';
  }

  function childInheritedColors(props, inheritedColors) {
    const next = { ...inheritedColors };
    for (const name of ['text_color', 'background_color']) {
      if (!isExplicitProperty(props, name)) continue;
      const value = color(props[name], '');
      if (value) {
        next[name] = value;
      } else {
        delete next[name];
      }
    }
    return next;
  }

  function displayedWidgetColor(props, name, inheritedColors) {
    const inherited = inheritedColors[name];
    if (isExplicitProperty(props, name)) return color(props[name], inherited || '');
    if (inherited) return inherited;
    return color(props[name], '');
  }

  function isExplicitProperty(props, name) {
    return Array.isArray(props.__explicit_properties) && props.__explicit_properties.includes(name);
  }

  function isTransparentColor(value) {
    return value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value === '#00000000';
  }

  function cssClassForWidget(type) {
    if (type === 'gui.Label') return 'label';
    if (type === 'gui.Button') return 'button';
    if (type === 'gui.Frame') return 'frame';
    return 'placeholder';
  }

  function color(value, fallback) {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  function positiveNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function stringValue(value, fallback) {
    return typeof value === 'string' ? value : fallback;
  }
}());
