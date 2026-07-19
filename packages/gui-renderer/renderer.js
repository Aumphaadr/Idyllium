'use strict';

(function () {
  const host = window.IdylliumGuiHost
    || (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage() {} });
  let state = normalizeState(window.IdylliumGuiInitialState || {});
  let stateJson = JSON.stringify(state);
  let activeCanvasId = null;
  let activeControl = null;
  let deferredState = null;
  let draggingControlId = null;
  const audioEntries = new Map();
  let fontRefreshScheduled = false;
  let imageRefreshScheduled = false;
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
    const nextState = normalizeState(message);
    const nextStateJson = JSON.stringify(nextState);
    if (nextStateJson === stateJson) return;
    const generationChanged = nextState.generation !== state.generation;
    if (generationChanged) clearAudioEntries();
    if (!generationChanged && patchLabelTextOnly(nextState, nextStateJson)) return;
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
  host.postMessage({ type: 'rendererReady' });

  function normalizeState(value) {
    return {
      generation: Number.isFinite(Number(value && value.generation)) ? Number(value.generation) : 0,
      audio: value && Array.isArray(value.audio) ? value.audio : [],
      windows: value && Array.isArray(value.windows) ? value.windows : [],
      canvases: value && Array.isArray(value.canvases) ? value.canvases : [],
      modals: value && Array.isArray(value.modals) ? value.modals : [],
    };
  }

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
    syncAudio(state.audio || []);
  }

  function patchLabelTextOnly(nextState, nextStateJson) {
    if (labelInsensitiveStateJson(state) !== labelInsensitiveStateJson(nextState)) return false;

    const patches = [];
    const visit = (widget) => {
      if (widget.type === 'gui.Label') {
        const element = findWidgetElement(widget.id);
        if (!element) return false;
        patches.push([element, stringValue(widget.properties && widget.properties.text, '')]);
      }
      for (const child of widget.children || []) {
        if (!visit(child)) return false;
      }
      return true;
    };

    for (const win of nextState.windows || []) {
      if (!visit(win)) return false;
    }
    for (const [element, text] of patches) element.textContent = text;
    state = nextState;
    stateJson = nextStateJson;
    syncAudio(state.audio || []);
    return true;
  }

  function labelInsensitiveStateJson(snapshot) {
    const normalizeWidget = (widget) => ({
      ...widget,
      properties: widget.type === 'gui.Label'
        ? { ...(widget.properties || {}), text: null }
        : widget.properties,
      children: (widget.children || []).map(normalizeWidget),
    });
    return JSON.stringify({
      ...snapshot,
      windows: (snapshot.windows || []).map(normalizeWidget),
    });
  }

  function findWidgetElement(widgetId) {
    const expected = String(widgetId);
    const visit = (element) => {
      if (element && element.dataset && element.dataset.widgetId === expected) return element;
      for (const child of element && element.children ? element.children : []) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };
    return visit(stage);
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
    applyWidgetFont(root, win.properties, {});

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
    if (widget.type === 'gui.ImageBox') return renderImageBox(widget, inheritedColors);
    if (widget.type === 'gui.Label') return renderLabel(widget, inheritedColors);

    return renderPlaceholder(widget, inheritedColors);
  }

  function renderImageBox(widget, inheritedColors) {
    const props = widget.properties || {};
    const el = baseWidget('div', widget, 'image-widget', inheritedColors);
    const resource = props.image && props.image.properties ? props.image.properties : null;
    const uri = resource && (resource.webview_uri || resource.resource_uri);

    if (resource && resource.is_loaded === true && uri) {
      const image = document.createElement('img');
      image.alt = stringValue(resource.src, 'image');
      image.src = uri;
      image.draggable = false;
      applyImageResizeMode(image, stringValue(props.resize_mode, 'fit'));
      el.appendChild(image);
    } else {
      const placeholder = document.createElement('span');
      placeholder.textContent = resource ? stringValue(resource.src, 'image') : '';
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
    fill.style.backgroundColor = color(widget.properties.foreground_color, '#0066cc');
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
    applyWidgetFont(el, widget.properties, inheritedColors);
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
    const commands = widget.canvas.commands || [];
    drawCanvasCommands(canvas, commands);
    scheduleAnimatedCanvas(canvas, commands);
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
    const commands = canvasSnapshot.commands || [];
    drawCanvasCommands(canvas, commands);
    scheduleAnimatedCanvas(canvas, commands);
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

  function scheduleAnimatedCanvas(canvas, commands) {
    const hasAnimation = commands.some((command) => {
      const object = command && command.object;
      const resource = object && object.properties && object.properties.image;
      return resource && resource.type === 'image.Animation';
    });
    if (!hasAnimation || typeof requestAnimationFrame !== 'function') return;

    const redraw = () => {
      if (!canvas.isConnected) return;
      drawCanvasCommands(canvas, commands);
      requestAnimationFrame(redraw);
    };
    requestAnimationFrame(redraw);
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

  function syncAudio(audioSnapshots) {
    const activeIds = new Set();
    for (const snapshot of audioSnapshots || []) {
      if (!snapshot || typeof snapshot.id !== 'number') continue;
      activeIds.add(snapshot.id);
      const entry = ensureAudioEntry(snapshot);
      configureAudioEntry(entry, snapshot);
      for (const command of snapshot.commands || []) {
        if (!command || typeof command.id !== 'number' || entry.handledCommands.has(command.id)) continue;
        entry.handledCommands.add(command.id);
        runAudioCommand(entry, command.action);
      }
    }

    for (const [id, entry] of audioEntries) {
      if (activeIds.has(id)) continue;
      stopAudioEntry(entry);
      audioEntries.delete(id);
    }
  }

  function ensureAudioEntry(snapshot) {
    let entry = audioEntries.get(snapshot.id);
    if (entry) {
      entry.snapshot = snapshot;
      return entry;
    }

    entry = {
      id: snapshot.id,
      snapshot,
      type: snapshot.type,
      src: '',
      element: null,
      instances: new Set(),
      handledCommands: new Set(),
      lastPosition: null,
      pendingPosition: null,
      volume: 1,
    };
    audioEntries.set(snapshot.id, entry);
    return entry;
  }

  function configureAudioEntry(entry, snapshot) {
    const props = snapshot.properties || {};
    const uri = String(props.webview_uri || props.resource_uri || '');
    entry.type = snapshot.type;
    if (entry.type !== 'audio.Music') return;
    const element = ensureMusicElement(entry);
    if (uri && entry.src !== uri) {
      entry.src = uri;
      element.src = uri;
      element.load();
      entry.lastPosition = null;
    }
    element.loop = props.loop === true;
    entry.volume = normalizedVolume(props.volume);
    applyElementVolume(element, entry.volume);

    const position = Number(props.position);
    if (Number.isFinite(position) && position >= 0) entry.pendingPosition = position;
    applyPendingMusicPosition(entry);
  }

  function applyPendingMusicPosition(entry, force = false) {
    const element = entry.element;
    const position = Number(entry.pendingPosition);
    if (!element || element.readyState <= 0 || !Number.isFinite(position) || position < 0) return;
    if (!force && position === entry.lastPosition) return;
    try {
      element.currentTime = position;
      entry.lastPosition = position;
    } catch (_error) {
      // loadedmetadata will retry the pending position.
    }
  }

  function runAudioCommand(entry, action) {
    if (entry.type === 'audio.Music') {
      runMusicCommand(entry, action);
      return;
    }
    runSoundCommand(entry, action);
  }

  function runSoundCommand(entry, action) {
    if (action === 'play') {
      playSound(entry);
      return;
    }
    if (action === 'pause') {
      for (const item of entry.instances) item.pause();
      return;
    }
    if (action === 'resume') {
      if (entry.instances.size === 0) {
        playSound(entry);
        return;
      }
      for (const item of entry.instances) safePlay(item);
      return;
    }
    if (action === 'stop') {
      for (const item of entry.instances) {
        item.pause();
        try {
          item.currentTime = 0;
        } catch (_error) {
          // Detached audio can reject seeking; it is about to be forgotten.
        }
      }
      entry.instances.clear();
    }
  }

  function playSound(entry) {
    const props = entry.snapshot.properties || {};
    const uri = String(props.webview_uri || props.resource_uri || '');
    if (!uri || typeof Audio !== 'function') return;
    const element = new Audio(uri);
    const volume = normalizedVolume(props.volume);
    applyElementVolume(element, volume);
    installVolumeGuards(element, () => volume);
    entry.instances.add(element);
    element.addEventListener('ended', () => {
      entry.instances.delete(element);
      if (entry.instances.size === 0) postGuiEvent(entry.id, 'sound_finished', {});
    }, { once: true });
    safePlay(element);
  }

  function runMusicCommand(entry, action) {
    const element = ensureMusicElement(entry);
    if (!entry.src) return;
    if (action === 'seek') {
      applyPendingMusicPosition(entry, true);
      return;
    }
    if (action === 'play') {
      applyElementVolume(element, entry.volume);
      applyPendingMusicPosition(entry, true);
      safePlay(element);
      return;
    }
    if (action === 'pause') {
      element.pause();
      return;
    }
    if (action === 'resume') {
      applyElementVolume(element, entry.volume);
      safePlay(element);
      return;
    }
    if (action === 'stop') {
      element.pause();
      try {
        element.currentTime = 0;
        entry.lastPosition = 0;
        entry.pendingPosition = 0;
      } catch (_error) {
        // Metadata might not be ready yet.
      }
    }
  }

  function ensureMusicElement(entry) {
    if (entry.element) return entry.element;
    const element = new Audio();
    element.preload = 'auto';
    installVolumeGuards(element, () => entry.volume);
    element.addEventListener('loadedmetadata', () => {
      applyElementVolume(element, entry.volume);
      applyPendingMusicPosition(entry);
      const duration = Number(element.duration);
      if (Number.isFinite(duration) && duration >= 0) {
        postGuiEvent(entry.id, 'metadata', { duration });
      }
    });
    element.addEventListener('ended', () => {
      if (!element.loop) postGuiEvent(entry.id, 'finished', {});
    });
    entry.element = element;
    return element;
  }

  function stopAudioEntry(entry) {
    if (entry.element) {
      entry.element.pause();
      try {
        entry.element.currentTime = 0;
      } catch (_error) {
        // Ignore cleanup seek failures.
      }
    }
    for (const item of entry.instances) item.pause();
    entry.instances.clear();
  }

  function clearAudioEntries() {
    for (const entry of audioEntries.values()) stopAudioEntry(entry);
    audioEntries.clear();
  }

  function safePlay(element) {
    if (typeof element.__idylliumVolume === 'number') {
      applyElementVolume(element, element.__idylliumVolume);
    }
    const promise = element.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  function installVolumeGuards(element, volumeProvider) {
    const reapply = () => applyElementVolume(element, volumeProvider());
    for (const eventName of ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'volumechange']) {
      element.addEventListener(eventName, reapply);
    }
  }

  function applyElementVolume(element, value) {
    const volume = normalizedVolume(value);
    element.__idylliumVolume = volume;
    try {
      element.volume = volume;
    } catch (_error) {
      // Some browser environments make media volume read-only. In that case
      // the program still runs; the platform simply ignores software volume.
    }
  }

  function normalizedVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.min(1, Math.max(0, number));
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
      const width = positiveNumber(props.width);
      const height = positiveNumber(props.height);
      drawWithTransform(ctx, props, 1, 1, (originX, originY) => {
        ctx.fillStyle = color(props.fill_color, 'rgba(0, 0, 0, 0)');
        ctx.fillRect(-originX, -originY, width, height);
        drawBorderRectAt(ctx, props, -originX, -originY, width, height);
      });
    }
    if (object.type === 'drawable.Circle') {
      const radius = positiveNumber(props.radius);
      drawWithTransform(ctx, props, 1, 1, (originX, originY) => {
        ctx.beginPath();
        ctx.arc(radius - originX, radius - originY, radius, 0, Math.PI * 2);
        ctx.fillStyle = color(props.fill_color, 'rgba(0, 0, 0, 0)');
        ctx.fill();
        drawBorderCircleAt(ctx, props, radius - originX, radius - originY, radius);
      });
    }
    if (object.type === 'drawable.Line') {
      const thickness = numberValue(props.thickness, 1);
      if (thickness <= 0) return;
      ctx.beginPath();
      ctx.moveTo(numberValue(props.x1), numberValue(props.y1));
      ctx.lineTo(numberValue(props.x2), numberValue(props.y2));
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color(props.color, '#ffffff');
      ctx.stroke();
    }
    if (object.type === 'drawable.Text') {
      drawWithTransform(ctx, props, 1, 1, (originX, originY) => {
        ctx.fillStyle = color(props.text_color, '#ffffff');
        ctx.font = canvasTextFont(props);
        if ('fontKerning' in ctx) ctx.fontKerning = 'none';
        ctx.textBaseline = 'top';
        ctx.fillText(stringValue(props.text, ''), -originX, -originY);
      });
    }
    if (object.type === 'drawable.Sprite') {
      const resource = props.image && props.image.properties ? props.image.properties : null;
      const image = loadImage(resource && (resource.webview_uri || resource.resource_uri));
      drawWithTransform(
        ctx,
        props,
        numberValue(props.scale_x, 1),
        numberValue(props.scale_y, 1),
        (originX, originY) => {
          if (image && image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, -originX, -originY, image.naturalWidth, image.naturalHeight);
            return;
          }
          const width = positiveNumber(resource && resource.width, 64);
          const height = positiveNumber(resource && resource.height, 64);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.fillRect(-originX, -originY, width, height);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.strokeRect(-originX, -originY, width, height);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.font = '12px sans-serif';
          ctx.textBaseline = 'top';
          ctx.fillText(resource && resource.src ? resource.src : 'sprite', -originX + 6, -originY + 6);
        },
      );
    }
  }

  function drawWithTransform(ctx, props, scaleX, scaleY, draw) {
    ctx.save();
    ctx.translate(numberValue(props.x), numberValue(props.y));
    ctx.rotate((numberValue(props.rotation, 0) * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    draw(numberValue(props.origin_x), numberValue(props.origin_y));
    ctx.restore();
  }

  function loadImage(uri) {
    if (!uri) return null;
    const cached = imageCache.get(uri);
    if (cached) return cached;

    const image = new Image();
    image.addEventListener('load', scheduleImageRefresh, { once: true });
    image.src = uri;
    imageCache.set(uri, image);
    return image;
  }

  function scheduleImageRefresh() {
    if (imageRefreshScheduled) return;
    imageRefreshScheduled = true;
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    schedule(() => {
      imageRefreshScheduled = false;
      renderAll();
    });
  }

  function canvasTextFont(props) {
    const size = positiveNumber(props.font_size, 16);
    const font = props.font && props.font.properties ? props.font.properties : null;
    const family = canvasFontFamily(font);
    return family === 'sans-serif' ? size + 'px sans-serif' : size + 'px ' + family + ', sans-serif';
  }

  function canvasFontFamily(font) {
    if (font && font.is_builtin === true) {
      ensureDefaultCanvasFont();
      return 'IdylliumCanvasDefault';
    }
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

  function ensureDefaultCanvasFont() {
    const key = '__idyllium_canvas_default__';
    if (fontCache.has(key)) return;
    const cached = { family: 'IdylliumCanvasDefault', status: 'loading' };
    fontCache.set(key, cached);
    if (!document.fonts || typeof document.fonts.load !== 'function') {
      cached.status = 'unsupported';
      return;
    }
    document.fonts.load('16px IdylliumCanvasDefault').then(() => {
      cached.status = 'loaded';
      scheduleFontRefresh();
    }).catch(() => {
      cached.status = 'error';
      scheduleFontRefresh();
    });
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

  function drawBorderRectAt(ctx, props, x, y, widthValue, heightValue) {
    const width = positiveNumber(props.border_width, 0);
    if (width <= 0) return;
    ctx.lineWidth = width;
    ctx.strokeStyle = color(props.border_color, 'rgba(0, 0, 0, 0)');
    ctx.strokeRect(x, y, widthValue, heightValue);
  }

  function drawBorderCircleAt(ctx, props, x, y, radius) {
    const width = positiveNumber(props.border_width, 0);
    if (width <= 0) return;
    ctx.lineWidth = width;
    ctx.strokeStyle = color(props.border_color, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
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

    if (isExplicitProperty(props, 'font')) {
      if (props.font && props.font.properties) {
        next.font = props.font;
      } else {
        delete next.font;
      }
    }

    if (isExplicitProperty(props, 'font_size')) {
      const fontSize = positiveNumber(props.font_size, 0);
      if (fontSize > 0) {
        next.font_size = fontSize;
      } else {
        delete next.font_size;
      }
    }
    return next;
  }

  function applyWidgetFont(el, props, inheritedColors) {
    const explicitSize = isExplicitProperty(props, 'font_size');
    const ownSize = positiveNumber(props.font_size, 0);
    const inheritedSize = positiveNumber(inheritedColors.font_size, 0);
    const fontSize = explicitSize ? ownSize : inheritedSize || ownSize;
    if (fontSize > 0) el.style.fontSize = fontSize + 'px';

    const explicit = isExplicitProperty(props, 'font');
    const resource = explicit ? props.font : inheritedColors.font;
    if (!resource && !explicit) return;

    const font = resource && resource.properties ? resource.properties : null;
    const family = canvasFontFamily(font);
    el.style.fontFamily = family === 'sans-serif' ? 'sans-serif' : family + ', sans-serif';
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
