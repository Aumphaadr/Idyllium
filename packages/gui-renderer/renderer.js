'use strict';

(function () {
  const host = window.IdylliumGuiHost
    || (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage() {} });
  let state = normalizeState(window.IdylliumGuiInitialState || {});
  let stateJson = JSON.stringify(state);
  let activeCanvasId = null;
  let activeControl = null;
  // Поле SpinBox, которое пользователь сейчас набирает с клавиатуры.
  // Пока набор не подтверждён (blur/Enter), его текст принадлежит
  // пользователю: перерисовки по снимкам не смеют его переписывать.
  let editingSpinBox = null;
  let deferredState = null;
  let draggingControlId = null;
  const audioEntries = new Map();
  let fontRefreshScheduled = false;
  let imageRefreshScheduled = false;
  const fontCache = new Map();
  const imageCache = new Map();
  const modalInputValues = new Map();
  const KNOWN_WINDOW_THEMES = ['default', 'idyllium', 'dracula', 'breeze', 'oxygen'];
  // Правила :hover/:active из IdySS-стилей — собираются при рендере и
  // выгружаются одним <style> в конце (объявлены здесь из-за TDZ).
  let idyssStateRules = [];
  let idyssStateCounter = 0;
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
    if (generationChanged) editingSpinBox = null;
    if (!generationChanged && patchWidgetTextOnly(nextState, nextStateJson)) return;
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
    flushStateStyleRules();
  }

  // Если между снапшотами изменились только тексты (подпись Label или
  // содержимое LineEdit/TextEdit), правим их на месте: полный перерендер
  // пересоздаёт DOM и заставляет фокус поля ввода моргать на каждом символе.
  const TEXT_PATCHABLE_TYPES = new Set(['gui.Label', 'gui.LineEdit', 'gui.TextEdit']);

  function patchWidgetTextOnly(nextState, nextStateJson) {
    if (textInsensitiveStateJson(state) !== textInsensitiveStateJson(nextState)) return false;

    const patches = [];
    const visit = (widget) => {
      if (TEXT_PATCHABLE_TYPES.has(widget.type)) {
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
    for (const [element, text] of patches) {
      const tag = element.tagName ? element.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') {
        // Эхо собственного ввода уже в DOM — не трогаем, чтобы не сбить курсор.
        if (element.value !== text) element.value = text;
      } else {
        element.textContent = text;
      }
    }
    state = nextState;
    stateJson = nextStateJson;
    syncAudio(state.audio || []);
    return true;
  }

  function textInsensitiveStateJson(snapshot) {
    const normalizeWidget = (widget) => ({
      ...widget,
      properties: TEXT_PATCHABLE_TYPES.has(widget.type)
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
    // Тема — самый нижний слой оформления: задаёт CSS-переменные, поверх
    // которых ложатся прямые свойства виджетов и IdySS-наклейки.
    const theme = stringValue(win.properties.theme, 'default').trim().toLowerCase();
    root.className = 'window theme-' + (KNOWN_WINDOW_THEMES.includes(theme) ? theme : 'default');
    root.style.width = width + 'px';
    root.style.height = (height + titleHeight) + 'px';
    const windowBackground = displayedWidgetColor(win.properties, 'background_color', {});
    if (windowBackground) root.style.background = windowBackground;
    const textColor = displayedWidgetColor(win.properties, 'text_color', {});
    if (textColor) root.style.color = textColor;
    applyWidgetFont(root, win.properties, {});
    applyStyleDeclarations(root, win.properties);

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

  function windowThemeClass() {
    const theme = stringValue(state.windows[0]?.properties?.theme, 'default').trim().toLowerCase();
    return 'theme-' + (KNOWN_WINDOW_THEMES.includes(theme) ? theme : 'default');
  }

  function renderModal(modal) {
    const props = modal.properties || {};
    const overlay = document.createElement('div');
    // Диалог живёт вне окна, но принадлежит той же программе — тема общая.
    overlay.className = 'modal-backdrop ' + windowThemeClass();

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
    const el = renderWidgetElement(widget, parentId, inheritedColors);
    applyEnabledState(el, widget.properties);
    return el;
  }

  // enabled == false: приглушённо-серый вид и pointer-events даёт CSS-класс
  // .disabled (его вешает applyWidgetBox), а здесь выключается клавиатура:
  // нативный disabled у форм-элементов — включая содержимое контейнеров,
  // у которых выключили их самих (к этому моменту дети уже в DOM-поддереве).
  function applyEnabledState(el, props) {
    if (!props || props.enabled !== false) return;
    if (typeof el.matches === 'function' && el.matches('button, input, textarea, select')) {
      el.disabled = true;
    }
    const controls = el.querySelectorAll ? el.querySelectorAll('button, input, textarea, select') : [];
    for (const control of controls) control.disabled = true;
    el.setAttribute('aria-disabled', 'true');
    if (el.tagName === 'A') el.tabIndex = -1;
  }

  // Цвет подсказки-плейсхолдера. В inline уходит только явно заданный цвет
  // (правило тем: дефолт — дело темы через var(--w-muted) в renderer.css).
  function applyPlaceholderColor(el, props) {
    if (!isExplicitProperty(props, 'placeholder_color')) return;
    el.style.setProperty('--w-placeholder-explicit', color(props.placeholder_color, ''));
  }

  function renderWidgetElement(widget, parentId = 0, inheritedColors = {}) {
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
    if (widget.type === 'gui.TabWidget') return renderTabWidget(widget, inheritedColors);
    if (widget.type === 'gui.Table') return renderTable(widget, inheritedColors);
    if (widget.type === 'gui.BarChart') return renderChart(widget, inheritedColors, paintBarChart);
    if (widget.type === 'gui.LineChart') return renderChart(widget, inheritedColors, paintLineChart);
    if (widget.type === 'gui.PieChart') return renderChart(widget, inheritedColors, paintPieChart);
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
    const href = stringValue(widget.properties.href, '').trim();
    // Непустой href превращает надпись в настоящую ссылку <a>: системный
    // курсор, поведение и открытие в новой вкладке. on_click тоже работает.
    const el = href
      ? baseWidget('a', widget, 'label label-link', inheritedColors)
      : baseWidget('div', widget, 'label', inheritedColors);
    if (href) {
      el.href = href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
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
    applyPlaceholderColor(el, widget.properties);
    if (mode === 'no_echo') el.classList.add('no-echo');
    installControlFocus(el, widget.id);
    el.addEventListener('input', () => postGuiEvent(widget.id, 'change', { text: el.value }));
    return el;
  }

  function renderTextEdit(widget, inheritedColors) {
    const el = baseWidget('textarea', widget, 'control', inheritedColors);
    el.value = stringValue(widget.properties.text, '');
    el.placeholder = stringValue(widget.properties.placeholder, '');
    applyPlaceholderColor(el, widget.properties);
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

    const floating = widget.type === 'gui.FloatSpinBox';
    // Поле, которое пользователь сейчас набирает, — его собственность: пока
    // печать не подтверждена, программа ничего не получает, а перерисовки по
    // снимкам сохраняют набранный текст (см. editingSpinBox выше). Иначе
    // промежуточная «3» при min = 20 зажималась бы до 20 прямо под пальцами,
    // и набрать «35» было бы физически невозможно.
    if (editingSpinBox && editingSpinBox.widgetId === widget.id) {
      el.value = editingSpinBox.text;
    }

    let committedValue = numberValue(widget.properties.value, 0);
    const emit = (value) => {
      committedValue = value;
      postGuiEvent(widget.id, 'change', { value });
    };

    el.addEventListener('input', () => {
      editingSpinBox = { widgetId: widget.id, text: el.value };
    });

    // Подтверждение (blur, Enter, шаг стрелками): набранное зажимается в
    // [min, max], дробь в целом SpinBox усекается, пустой или нечисловой
    // ввод откатывается к последнему подтверждённому значению — раньше он
    // молча превращался в 0. Только здесь значение уходит в программу.
    el.addEventListener('change', () => {
      editingSpinBox = null;
      const typed = spinBoxTypedValue(el.value, min, max, floating);
      const value = typed === null ? committedValue : typed;
      el.value = String(value);
      activeControl = controlState(el);
      emit(value);
    });

    // Blur без изменения значения не даёт события change — подчищаем сами.
    el.addEventListener('blur', () => {
      if (editingSpinBox && editingSpinBox.widgetId === widget.id) {
        editingSpinBox = null;
        el.value = String(committedValue);
      }
    });

    el.addEventListener('wheel', (event) => {
      editingSpinBox = null;
      const value = spinBoxWheelValue(el.value, min, max, step, event.deltaY < 0, floating);
      el.value = String(value);
      activeControl = controlState(el);
      emit(value);
      event.preventDefault();
    }, { passive: false });
    return el;
  }

  /** Число из набранного текста, зажатое в [min, max]; null — ввод не число. */
  function spinBoxTypedValue(rawValue, min, max, floating) {
    if (String(rawValue).trim() === '') return null;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return null;
    const clamped = clampNumber(parsed, min, max);
    return floating ? clamped : Math.trunc(clamped);
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
    // Вертикаль включается классом; незнакомое значение — как горизонталь.
    if (stringValue(widget.properties.orientation, 'horizontal') === 'vertical') {
      el.classList.add('vertical');
    }
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
    // on_change приходит на каждое движение маркера (input), а не только при
    // отпускании; повторная отправка того же значения гасится.
    let lastSentValue = null;
    const emitSliderChange = () => {
      const value = Number(el.value);
      if (value === lastSentValue) return;
      lastSentValue = value;
      postGuiEvent(widget.id, 'change', { value });
    };
    el.addEventListener('input', () => {
      activeControl = controlState(el);
      emitSliderChange();
    });
    el.addEventListener('change', () => {
      emitSliderChange();
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

  function renderTable(widget, inheritedColors) {
    const el = baseWidget('div', widget, 'datatable', inheritedColors);
    const columns = widget.columns || [];
    const rows = widget.rows || [];
    const selectedRow = numberValue(widget.properties.selected_row, -1);

    const table = document.createElement('table');
    table.className = 'datatable-grid';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const column of columns) {
      const th = document.createElement('th');
      th.textContent = column;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((cells, rowIndex) => {
      const tr = document.createElement('tr');
      tr.className = 'datatable-row' + (rowIndex === selectedRow ? ' selected' : '');
      for (const cell of cells) {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      }
      tr.addEventListener('click', () => postGuiEvent(widget.id, 'select', { row: rowIndex }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    el.appendChild(table);
    return el;
  }

  // Общий каркас чартов: канвас + отрисовка в два прохода. Первый — сразу,
  // с запасными цветами; второй — после прикрепления к DOM, когда доступны
  // переменные темы окна (getComputedStyle до вставки их не видит).
  function renderChart(widget, inheritedColors, paint) {
    const el = baseWidget('div', widget, 'datachart', inheritedColors);
    const canvas = document.createElement('canvas');
    const width = Math.max(40, positiveNumber(widget.properties.width, 320));
    const height = Math.max(40, positiveNumber(widget.properties.height, 220));
    canvas.width = width;
    canvas.height = height;
    el.appendChild(canvas);

    const draw = () => {
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      paint(ctx, width, height, widget, chartTheme(el, widget.properties));
    };
    draw();
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 0);
    schedule(draw);
    return el;
  }

  function chartTheme(el, props) {
    let resolve = () => '';
    if (typeof getComputedStyle === 'function') {
      try {
        const style = getComputedStyle(el);
        resolve = (name) => String(style.getPropertyValue(name) || '').trim();
      } catch (error) {
        resolve = () => '';
      }
    }
    const accent = resolve('--w-accent') || '#2673d9';
    return {
      accent,
      text: resolve('--w-control-text') || '#333333',
      muted: resolve('--w-muted') || '#888888',
      grid: resolve('--w-border') || '#cccccc',
      barColor: isExplicitProperty(props, 'bar_color') ? color(props.bar_color, accent) : accent,
      lineColor: isExplicitProperty(props, 'line_color') ? color(props.line_color, accent) : accent,
    };
  }

  // Диапазон шкалы: явные min/max уважаются, остальное считается по данным.
  function chartScale(props, values) {
    const top = values.length ? Math.max.apply(null, values) : 1;
    const min = isExplicitProperty(props, 'min_value') ? numberValue(props.min_value, 0) : 0;
    let max = isExplicitProperty(props, 'max_value') ? numberValue(props.max_value, top) : top;
    if (max <= min) max = min + 1;
    return { min, max };
  }

  function paintBarChart(ctx, width, height, widget, theme) {
    const entries = widget.entries || [];
    if (entries.length === 0) return;
    const props = widget.properties;
    const showValues = props.show_values !== false;
    const padTop = showValues ? 22 : 10;
    const padBottom = 22;
    const padSide = 12;
    const plotHeight = Math.max(10, height - padTop - padBottom);
    const scale = chartScale(props, entries.map((entry) => entry.value));
    const slot = (width - padSide * 2) / entries.length;
    const barWidth = Math.max(6, Math.min(64, slot * 0.7));

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padSide, height - padBottom + 0.5);
    ctx.lineTo(width - padSide, height - padBottom + 0.5);
    ctx.stroke();

    ctx.textAlign = 'center';
    entries.forEach((entry, index) => {
      const centerX = padSide + slot * index + slot / 2;
      const ratio = Math.max(0, Math.min(1, (entry.value - scale.min) / (scale.max - scale.min)));
      const barHeight = Math.round(plotHeight * ratio);
      ctx.fillStyle = theme.barColor;
      ctx.fillRect(Math.round(centerX - barWidth / 2), height - padBottom - barHeight, Math.round(barWidth), barHeight);

      ctx.fillStyle = theme.muted;
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(clipChartLabel(ctx, entry.label, slot - 4), centerX, height - padBottom + 5);
      if (showValues) {
        ctx.fillStyle = theme.text;
        ctx.textBaseline = 'bottom';
        ctx.fillText(chartNumber(entry.value), centerX, height - padBottom - barHeight - 3);
      }
    });
  }

  function paintLineChart(ctx, width, height, widget, theme) {
    const points = widget.points || [];
    const props = widget.properties;
    const pad = 12;
    const padBottom = 14;
    const plotWidth = width - pad * 2;
    const plotHeight = height - pad - padBottom;
    const scale = chartScale(props, points);

    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, pad + 0.5, plotWidth, plotHeight);
    if (points.length === 0) return;

    const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
    const pointX = (index) => pad + (points.length > 1 ? stepX * index : plotWidth / 2);
    const pointY = (value) => {
      const ratio = Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
      return pad + plotHeight - plotHeight * ratio;
    };

    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((value, index) => {
      if (index === 0) ctx.moveTo(pointX(index), pointY(value));
      else ctx.lineTo(pointX(index), pointY(value));
    });
    ctx.stroke();

    if (props.show_dots !== false && points.length <= 120) {
      ctx.fillStyle = theme.lineColor;
      points.forEach((value, index) => {
        ctx.beginPath();
        ctx.arc(pointX(index), pointY(value), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function paintPieChart(ctx, width, height, widget, theme) {
    const entries = (widget.entries || []).filter((entry) => entry.value > 0);
    if (entries.length === 0) return;
    const props = widget.properties;
    const showLegend = props.show_legend !== false;
    const showPercents = props.show_percents !== false;
    const legendWidth = showLegend ? Math.min(150, Math.floor(width * 0.42)) : 0;
    const radius = Math.max(20, Math.min((width - legendWidth) / 2, height / 2) - 12);
    const centerX = (width - legendWidth) / 2;
    const centerY = height / 2;
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);

    let angle = -Math.PI / 2;
    entries.forEach((entry, index) => {
      const share = entry.value / total;
      const next = angle + share * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, next);
      ctx.closePath();
      ctx.fillStyle = pieSliceColor(index, entries.length, theme.accent);
      ctx.fill();

      if (showPercents && share >= 0.06) {
        const middle = (angle + next) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(share * 100) + '%', centerX + Math.cos(middle) * radius * 0.62, centerY + Math.sin(middle) * radius * 0.62);
      }
      angle = next;
    });

    if (showLegend) {
      const lineHeight = 18;
      const startY = Math.max(10, centerY - (entries.length * lineHeight) / 2);
      entries.forEach((entry, index) => {
        const y = startY + index * lineHeight;
        if (y + lineHeight > height) return;
        ctx.fillStyle = pieSliceColor(index, entries.length, theme.accent);
        ctx.fillRect(width - legendWidth + 4, y + 3, 10, 10);
        ctx.fillStyle = theme.text;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(clipChartLabel(ctx, entry.label, legendWidth - 24), width - legendWidth + 20, y + 1);
      });
    }
  }

  // Палитра долек: ровные шаги оттенка от акцента темы.
  function pieSliceColor(index, count, accent) {
    const base = parseAccentHue(accent);
    const hue = (base + (360 / Math.max(1, count)) * index) % 360;
    return 'hsl(' + Math.round(hue) + ', 62%, 52%)';
  }

  function parseAccentHue(accent) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(accent).replace('#', ''));
    if (!match) return 215;
    const value = parseInt(match[1], 16);
    const r = ((value >> 16) & 255) / 255;
    const g = ((value >> 8) & 255) / 255;
    const b = (value & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 215;
    let hue;
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    return (hue * 60 + 360) % 360;
  }

  function chartNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }

  function clipChartLabel(ctx, text, maxWidth) {
    const label = String(text);
    if (!ctx.measureText || maxWidth <= 0) return label;
    if (ctx.measureText(label).width <= maxWidth) return label;
    let clipped = label;
    while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    return clipped + '…';
  }

  function renderProgressBar(widget, inheritedColors) {
    const el = baseWidget('div', widget, 'progressbar', inheritedColors);
    const min = numberValue(widget.properties.min, 0);
    const max = numberValue(widget.properties.max, 100);
    const value = numberValue(widget.properties.value, 0);
    const percent = max <= min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    const vertical = stringValue(widget.properties.orientation, 'horizontal') === 'vertical';
    if (vertical) el.classList.add('vertical');
    const fill = document.createElement('div');
    fill.className = 'progressbar-fill';
    // Горизонталь растёт слева направо, вертикаль — снизу вверх.
    if (vertical) fill.style.height = percent + '%';
    else fill.style.width = percent + '%';
    // Цвет заливки — только явный: иначе его задаёт акцент темы через CSS.
    if (isExplicitProperty(widget.properties, 'foreground_color')) {
      fill.style.backgroundColor = color(widget.properties.foreground_color, '');
    }
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

  function renderTabWidget(widget, inheritedColors) {
    const el = baseWidget('div', widget, 'tabwidget', inheritedColors);
    const childColors = childInheritedColors(widget.properties || {}, inheritedColors);
    const titles = Array.isArray(widget.properties.tab_titles) ? widget.properties.tab_titles : [];
    const children = widget.children || [];
    const selected = Math.min(Math.max(numberValue(widget.properties.selected_index, 0), 0), Math.max(children.length - 1, 0));

    const bar = document.createElement('div');
    bar.className = 'tabbar';
    titles.forEach((title, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab' + (index === selected ? ' tab-selected' : '');
      tab.textContent = String(title);
      tab.addEventListener('click', () => postGuiEvent(widget.id, 'change', { selected_index: index }));
      bar.appendChild(tab);
    });
    el.appendChild(bar);

    const page = document.createElement('div');
    page.className = 'tabpage';
    const content = children[selected];
    if (content) page.appendChild(renderWidget(content, widget.id, childColors));
    el.appendChild(page);
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
    applyStyleDeclarations(el, widget.properties);
    return el;
  }

  // IdySS-наклейка: применяется ПОСЛЕДНИМ слоем поверх прямых свойств
  // (каскад «наклейка сверху»). Пары уже провалидированы рантаймом —
  // рендерер не разбирает строк и не видит произвольного CSS.
  function applyStyleDeclarations(el, props) {
    const declarations = props && props.style_declarations;
    if (Array.isArray(declarations)) {
      for (const item of declarations) {
        if (!item || typeof item.property !== 'string' || typeof item.value !== 'string') continue;
        el.style.setProperty(item.property, item.value);
        if (item.property === 'text-align') {
          // Label и Button — flex-контейнеры: text-align сам по себе их
          // содержимое не двигает, зеркалим в justify-content.
          const justify = { left: 'flex-start', center: 'center', right: 'flex-end' }[item.value];
          if (justify) el.style.justifyContent = justify;
        }
      }
    }
    applyStateStyleDeclarations(el, props);
  }

  // style_hover / style_active: inline-стили не умеют :hover, поэтому из
  // провалидированных пар собираются настоящие CSS-правила в один <style>.
  // !important нужен, чтобы при наведении перебить inline-базу.
  function applyStateStyleDeclarations(el, props) {
    const hover = props && props.style_hover_declarations;
    const active = props && props.style_active_declarations;
    if (!Array.isArray(hover) && !Array.isArray(active)) return;

    idyssStateCounter += 1;
    const marker = 'idyss-state-' + idyssStateCounter;
    el.classList.add(marker);
    for (const [pseudo, declarations] of [[':hover', hover], [':active', active]]) {
      if (!Array.isArray(declarations) || declarations.length === 0) continue;
      const body = declarations
        .filter((item) => item && typeof item.property === 'string' && typeof item.value === 'string')
        .map((item) => item.property + ': ' + item.value + ' !important;')
        .join(' ');
      if (body) idyssStateRules.push('.' + marker + pseudo + ' { ' + body + ' }');
    }
  }

  function flushStateStyleRules() {
    // В облегчённой DOM тестов нет document.head — тогда правила просто
    // не выгружаются: снапшот и обработчики от этого не зависят.
    const head = document.head;
    if (!head || typeof head.appendChild !== 'function') {
      idyssStateRules = [];
      idyssStateCounter = 0;
      return;
    }
    let styleEl = document.getElementById('idyss-state-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'idyss-state-styles';
      head.appendChild(styleEl);
    }
    styleEl.textContent = idyssStateRules.join('\n');
    idyssStateRules = [];
    idyssStateCounter = 0;
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
    // Лёгкий DOM тестов не умеет querySelector — как и с document.head выше.
    if (typeof stage.querySelector !== 'function') return;
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
    if (object.type === 'turtle.Path') {
      // Черепашья графика: залитый многоугольник (заливки begin/end_fill и
      // спрайт-треугольник черепашки). Точки приходят плоским массивом
      // [x1, y1, x2, y2, ...] уже в экранных координатах.
      const points = Array.isArray(props.points) ? props.points : [];
      if (points.length >= 6) {
        ctx.beginPath();
        ctx.moveTo(numberValue(points[0]), numberValue(points[1]));
        for (let i = 2; i + 1 < points.length; i += 2) {
          ctx.lineTo(numberValue(points[i]), numberValue(points[i + 1]));
        }
        ctx.closePath();
        ctx.fillStyle = color(props.fill_color, 'rgba(0, 0, 0, 0)');
        ctx.fill();
        const borderWidth = numberValue(props.border_width, 0);
        if (borderWidth > 0) {
          ctx.lineWidth = borderWidth;
          ctx.strokeStyle = color(props.border_color, '#000000');
          ctx.stroke();
        }
      }
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
    if (props.enabled === false) el.classList.add('disabled');
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

    if (isExplicitProperty(props, 'border_color')) {
      el.style.borderColor = color(props.border_color, 'transparent');
    }
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

  // Цвет попадает в inline-стиль ТОЛЬКО если его задал ученик (или он
  // унаследован от родителя, которому его задали). Дефолтные значения
  // (чёрный текст, белый фон окна) инлайном не пишутся — их даёт тема через
  // CSS-переменные, иначе никакая тема не смогла бы их перебить.
  function displayedWidgetColor(props, name, inheritedColors) {
    const inherited = inheritedColors[name];
    if (isExplicitProperty(props, name)) return color(props[name], inherited || '');
    if (inherited) return inherited;
    return '';
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
