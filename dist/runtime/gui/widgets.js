"use strict";
// src/runtime/gui/widgets.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Modal = exports.Timer = exports.RadioButton = exports.Frame = exports.Slider = exports.ComboBox = exports.TextEdit = exports.ProgressBar = exports.CheckBox = exports.LineEdit = exports.FloatSpinBox = exports.SpinBox = exports.Label = exports.Button = exports.Window = exports.Widget = void 0;
class Widget {
    constructor(tag, className) {
        this.element = document.createElement(tag);
        this.element.className = `idyl-widget ${className}`;
        this.element.style.position = 'absolute';
    }
    getElement() {
        return this.element;
    }
    get x() {
        return parseInt(this.element.style.left) || 0;
    }
    set x(v) {
        this.element.style.left = v + 'px';
    }
    get y() {
        return parseInt(this.element.style.top) || 0;
    }
    set y(v) {
        this.element.style.top = v + 'px';
    }
    get width() {
        const style = parseInt(this.element.style.width);
        return isNaN(style) ? this.element.offsetWidth : style;
    }
    set width(v) {
        this.element.style.width = v + 'px';
    }
    get height() {
        const style = parseInt(this.element.style.height);
        return isNaN(style) ? this.element.offsetHeight : style;
    }
    set height(v) {
        this.element.style.height = v + 'px';
    }
    get visible() {
        return this.element.style.display !== 'none';
    }
    set visible(v) {
        this.element.style.display = v ? '' : 'none';
    }
    set_x(v) { this.x = v; }
    get_x() { return this.x; }
    set_y(v) { this.y = v; }
    get_y() { return this.y; }
    set_width(v) { this.width = v; }
    get_width() { return this.width; }
    set_height(v) { this.height = v; }
    get_height() { return this.height; }
    set_visible(v) { this.visible = v; }
    is_visible() { return this.visible; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
}
exports.Widget = Widget;
class Window extends Widget {
    constructor() {
        super('div', 'idyl-window');
        this._onShow = null;
        this.element.style.position = 'relative';
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'idyl-window-titlebar';
        this.titleText = document.createElement('span');
        this.titleText.className = 'idyl-window-title-text';
        this.titleText.textContent = 'Idyllium App';
        this.titleBar.appendChild(this.titleText);
        this.content = document.createElement('div');
        this.content.className = 'idyl-window-content';
        this.element.appendChild(this.titleBar);
        this.element.appendChild(this.content);
    }
    get title() {
        return this.titleText.textContent || '';
    }
    set title(v) {
        this.titleText.textContent = v;
    }
    set_title(v) { this.title = v; }
    get_title() { return this.title; }
    add_child(widget) {
        this.content.appendChild(widget.getElement());
    }
    set on_show(handler) {
        this._onShow = handler;
    }
    show() {
        const guiPanel = document.getElementById('gui-panel');
        const container = document.getElementById('gui-output');
        const guiResizer = document.getElementById('resizer-gui-terminal');
        if (guiPanel && container) {
            container.innerHTML = '';
            container.appendChild(this.element);
            guiPanel.style.display = 'flex';
            if (guiResizer) {
                guiResizer.style.display = 'block';
            }
        }
        if (this._onShow) {
            this._onShow(this);
        }
    }
}
exports.Window = Window;
class Button extends Widget {
    constructor() {
        super('button', 'idyl-button');
        this._onClick = null;
        this.element.addEventListener('click', async () => {
            if (this._onClick) {
                await this._onClick(this);
            }
        });
    }
    get text() {
        return this.element.textContent || '';
    }
    set text(v) {
        this.element.textContent = v;
    }
    set_text(v) { this.text = v; }
    get_text() { return this.text; }
    get enabled() {
        return !this.element.disabled;
    }
    set enabled(v) {
        this.element.disabled = !v;
    }
    set_enabled(v) { this.enabled = v; }
    is_enabled() { return this.enabled; }
    set on_click(handler) {
        this._onClick = handler;
    }
}
exports.Button = Button;
class Label extends Widget {
    constructor() {
        super('span', 'idyl-label');
    }
    get text() {
        return this.element.textContent || '';
    }
    set text(v) {
        this.element.textContent = v;
    }
    set_text(v) { this.text = v; }
    get_text() { return this.text; }
    get font_size() {
        return parseInt(this.element.style.fontSize) || 14;
    }
    set font_size(v) {
        this.element.style.fontSize = v + 'px';
    }
    set_font_size(v) { this.font_size = v; }
    get_font_size() { return this.font_size; }
    get color() {
        return this.element.style.color || '';
    }
    set color(v) {
        this.element.style.color = v;
    }
}
exports.Label = Label;
class SpinBox extends Widget {
    constructor() {
        super('div', 'idyl-spinbox-wrapper');
        this._onChange = null;
        this.input = document.createElement('input');
        this.input.type = 'number';
        this.input.className = 'idyl-spinbox';
        this.input.value = '0';
        this.element.appendChild(this.input);
        this.input.addEventListener('change', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get value() {
        return parseInt(this.input.value) || 0;
    }
    set value(v) {
        this.input.value = Math.floor(v).toString();
    }
    set_value(v) { this.value = v; }
    get_value() { return this.value; }
    get min() {
        return parseInt(this.input.min) || -Infinity;
    }
    set min(v) {
        this.input.min = v.toString();
    }
    set_min(v) { this.min = v; }
    get_min() { return this.min; }
    get max() {
        return parseInt(this.input.max) || Infinity;
    }
    set max(v) {
        this.input.max = v.toString();
    }
    set_max(v) { this.max = v; }
    get_max() { return this.max; }
    get step() {
        return parseInt(this.input.step) || 1;
    }
    set step(v) {
        this.input.step = v.toString();
    }
    set_step(v) { this.step = v; }
    get_step() { return this.step; }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.SpinBox = SpinBox;
class FloatSpinBox extends Widget {
    constructor() {
        super('div', 'idyl-spinbox-wrapper');
        this._onChange = null;
        this.input = document.createElement('input');
        this.input.type = 'number';
        this.input.className = 'idyl-spinbox';
        this.input.value = '0.0';
        this.input.step = '0.1';
        this.element.appendChild(this.input);
        this.input.addEventListener('change', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get value() {
        return parseFloat(this.input.value) || 0.0;
    }
    set value(v) {
        this.input.value = v.toString();
    }
    set_value(v) { this.value = v; }
    get_value() { return this.value; }
    get min() {
        return parseFloat(this.input.min) || -Infinity;
    }
    set min(v) {
        this.input.min = v.toString();
    }
    get max() {
        return parseFloat(this.input.max) || Infinity;
    }
    set max(v) {
        this.input.max = v.toString();
    }
    get step() {
        return parseFloat(this.input.step) || 0.1;
    }
    set step(v) {
        this.input.step = v.toString();
    }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.FloatSpinBox = FloatSpinBox;
class LineEdit extends Widget {
    constructor() {
        super('div', 'idyl-lineedit-wrapper');
        this._onChange = null;
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'idyl-lineedit';
        this.element.appendChild(this.input);
        this.input.addEventListener('input', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get text() {
        return this.input.value;
    }
    set text(v) {
        this.input.value = v;
    }
    set_text(v) { this.text = v; }
    get_text() { return this.text; }
    get placeholder() {
        return this.input.placeholder;
    }
    set placeholder(v) {
        this.input.placeholder = v;
    }
    set_placeholder(v) { this.placeholder = v; }
    get_placeholder() { return this.placeholder; }
    get echo_mode() {
        if (this.input.type === 'password')
            return 'password';
        if (this.input.style.color === 'transparent')
            return 'no_echo';
        return 'normal';
    }
    set echo_mode(v) {
        switch (v) {
            case 'password':
                this.input.type = 'password';
                this.input.style.color = '';
                break;
            case 'no_echo':
                this.input.type = 'text';
                this.input.style.color = 'transparent';
                break;
            case 'normal':
            default:
                this.input.type = 'text';
                this.input.style.color = '';
                break;
        }
    }
    set_echo_mode(v) { this.echo_mode = v; }
    get_echo_mode() { return this.echo_mode; }
    get font_size() {
        return parseInt(this.input.style.fontSize) || 14;
    }
    set font_size(v) {
        this.input.style.fontSize = v + 'px';
    }
    set_font_size(v) { this.font_size = v; }
    get_font_size() { return this.font_size; }
    get enabled() {
        return !this.input.disabled;
    }
    set enabled(v) {
        this.input.disabled = !v;
    }
    set_enabled(v) { this.enabled = v; }
    is_enabled() { return this.enabled; }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.LineEdit = LineEdit;
class CheckBox extends Widget {
    constructor() {
        super('div', 'idyl-checkbox-wrapper');
        this._onChange = null;
        const id = 'idyl-cb-' + Math.random().toString(36).substr(2, 9);
        this.input = document.createElement('input');
        this.input.type = 'checkbox';
        this.input.className = 'idyl-checkbox';
        this.input.id = id;
        this.label = document.createElement('label');
        this.label.className = 'idyl-checkbox-label';
        this.label.htmlFor = id;
        this.element.appendChild(this.input);
        this.element.appendChild(this.label);
        this.input.addEventListener('change', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get is_checked() {
        return this.input.checked;
    }
    set is_checked(v) {
        this.input.checked = v;
    }
    set_checked(v) { this.is_checked = v; }
    get_checked() { return this.is_checked; }
    get text() {
        return this.label.textContent || '';
    }
    set text(v) {
        this.label.textContent = v;
    }
    set_text(v) { this.text = v; }
    get_text() { return this.text; }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.CheckBox = CheckBox;
class ProgressBar extends Widget {
    constructor() {
        super('div', 'idyl-progressbar');
        this._value = 0;
        this._max = 100;
        this.fill = document.createElement('div');
        this.fill.className = 'idyl-progressbar-fill';
        this.element.appendChild(this.fill);
        this.label = document.createElement('span');
        this.label.className = 'idyl-progressbar-label';
        this.element.appendChild(this.label);
        this.updateFill();
    }
    updateFill() {
        const percent = this._max > 0 ? (this._value / this._max) * 100 : 0;
        const clampedPercent = Math.min(100, Math.max(0, percent));
        this.fill.style.width = clampedPercent + '%';
        this.label.textContent = Math.round(clampedPercent) + '%';
    }
    get value() {
        return this._value;
    }
    set value(v) {
        this._value = v;
        this.updateFill();
    }
    set_value(v) { this.value = v; }
    get_value() { return this.value; }
    get max() {
        return this._max;
    }
    set max(v) {
        this._max = v;
        this.updateFill();
    }
    set_max(v) { this.max = v; }
    get_max() { return this.max; }
}
exports.ProgressBar = ProgressBar;
class TextEdit extends Widget {
    constructor() {
        super('div', 'idyl-textedit-wrapper');
        this._onChange = null;
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'idyl-textedit';
        this.element.appendChild(this.textarea);
        this.textarea.addEventListener('input', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get text() {
        return this.textarea.value;
    }
    set text(v) {
        this.textarea.value = v;
    }
    set_text(v) { this.text = v; }
    get_text() { return this.text; }
    get placeholder() {
        return this.textarea.placeholder;
    }
    set placeholder(v) {
        this.textarea.placeholder = v;
    }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.TextEdit = TextEdit;
class ComboBox extends Widget {
    constructor() {
        super('div', 'idyl-combobox-wrapper');
        this._onChange = null;
        this.select = document.createElement('select');
        this.select.className = 'idyl-combobox';
        this.element.appendChild(this.select);
        this.select.addEventListener('change', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    add_item(text) {
        const option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        this.select.appendChild(option);
    }
    clear_items() {
        this.select.innerHTML = '';
    }
    get selected_index() {
        return this.select.selectedIndex;
    }
    set selected_index(v) {
        this.select.selectedIndex = v;
    }
    get selected_text() {
        return this.select.value;
    }
    set selected_text(v) {
        this.select.value = v;
    }
    set_selected_index(v) { this.selected_index = v; }
    get_selected_index() { return this.selected_index; }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.ComboBox = ComboBox;
class Slider extends Widget {
    constructor() {
        super('div', 'idyl-slider-wrapper');
        this._onChange = null;
        this.input = document.createElement('input');
        this.input.type = 'range';
        this.input.className = 'idyl-slider';
        this.input.value = '0';
        this.element.appendChild(this.input);
        this.input.addEventListener('input', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get value() {
        return parseInt(this.input.value) || 0;
    }
    set value(v) {
        this.input.value = v.toString();
    }
    set_value(v) { this.value = v; }
    get_value() { return this.value; }
    get min() {
        return parseInt(this.input.min) || 0;
    }
    set min(v) {
        this.input.min = v.toString();
    }
    get max() {
        return parseInt(this.input.max) || 100;
    }
    set max(v) {
        this.input.max = v.toString();
    }
    get step() {
        return parseInt(this.input.step) || 1;
    }
    set step(v) {
        this.input.step = v.toString();
    }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.Slider = Slider;
class Frame extends Widget {
    constructor() {
        super('fieldset', 'idyl-frame');
        this.titleEl = null;
        this.content = document.createElement('div');
        this.content.className = 'idyl-frame-content';
        this.element.appendChild(this.content);
    }
    get title() {
        return this.titleEl?.textContent || '';
    }
    set title(v) {
        if (!this.titleEl && v) {
            this.titleEl = document.createElement('legend');
            this.titleEl.className = 'idyl-frame-title';
            this.element.insertBefore(this.titleEl, this.content);
        }
        if (this.titleEl) {
            this.titleEl.textContent = v;
        }
    }
    set_title(v) { this.title = v; }
    get_title() { return this.title; }
    add_child(widget) {
        this.content.appendChild(widget.getElement());
    }
}
exports.Frame = Frame;
class RadioButton extends Widget {
    constructor() {
        super('div', 'idyl-radio-wrapper');
        this._onChange = null;
        const id = 'idyl-rb-' + Math.random().toString(36).substr(2, 9);
        this._group = 'idyl-radio-group-' + RadioButton._groupCounter;
        this.input = document.createElement('input');
        this.input.type = 'radio';
        this.input.className = 'idyl-radio';
        this.input.id = id;
        this.input.name = this._group;
        this.label = document.createElement('label');
        this.label.className = 'idyl-radio-label';
        this.label.htmlFor = id;
        this.element.appendChild(this.input);
        this.element.appendChild(this.label);
        this.input.addEventListener('change', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    get is_selected() {
        return this.input.checked;
    }
    set is_selected(v) {
        this.input.checked = v;
    }
    set_selected(v) { this.is_selected = v; }
    get_selected() { return this.is_selected; }
    get text() {
        return this.label.textContent || '';
    }
    set text(v) {
        this.label.textContent = v;
    }
    set_text(v) { this.text = v; }
    get_text() { return this.text; }
    get group() {
        return this._group;
    }
    set group(v) {
        this._group = v;
        this.input.name = v;
    }
    set_group(v) { this.group = v; }
    get_group() { return this.group; }
    static new_group() {
        RadioButton._groupCounter++;
    }
    set on_change(handler) {
        this._onChange = handler;
    }
}
exports.RadioButton = RadioButton;
RadioButton._groupCounter = 0;
class Timer {
    constructor() {
        this._interval = 1000;
        this._running = false;
        this._timerId = null;
        this._onTick = null;
    }
    get interval() {
        return this._interval;
    }
    set interval(ms) {
        this._interval = Math.max(1, Math.floor(ms));
        if (this._running) {
            this.restart();
        }
    }
    get running() {
        return this._running;
    }
    set on_tick(handler) {
        this._onTick = handler;
    }
    get on_tick() {
        return this._onTick;
    }
    start() {
        if (this._running)
            return;
        if (!this._onTick)
            return;
        this._running = true;
        this._timerId = window.setInterval(async () => {
            if (this._onTick) {
                try {
                    await this._onTick();
                }
                catch (e) {
                    console.error('Timer on_tick error:', e);
                }
            }
        }, this._interval);
    }
    stop() {
        if (!this._running)
            return;
        if (this._timerId !== null) {
            window.clearInterval(this._timerId);
            this._timerId = null;
        }
        this._running = false;
    }
    restart() {
        this.stop();
        this.start();
    }
    set_interval(ms) { this.interval = ms; }
    get_interval() { return this.interval; }
    is_running() { return this.running; }
}
exports.Timer = Timer;
class Modal {
    constructor() {
        this._title = 'Диалог';
        this._message = '';
        this._confirmText = 'OK';
        this._cancelText = 'Отмена';
        this._inputValue = '';
        this._onConfirm = null;
        this._onCancel = null;
        this._overlay = null;
        this._inputField = null;
    }
    get title() { return this._title; }
    set title(v) { this._title = v; }
    get message() { return this._message; }
    set message(v) { this._message = v; }
    get confirm_text() { return this._confirmText; }
    set confirm_text(v) { this._confirmText = v; }
    get cancel_text() { return this._cancelText; }
    set cancel_text(v) { this._cancelText = v; }
    set on_confirm(handler) {
        this._onConfirm = handler;
    }
    set on_cancel(handler) {
        this._onCancel = handler;
    }
    set_title(v) { this.title = v; }
    get_title() { return this.title; }
    set_message(v) { this.message = v; }
    get_message() { return this.message; }
    set_confirm_text(v) { this.confirm_text = v; }
    get_confirm_text() { return this.confirm_text; }
    set_cancel_text(v) { this.cancel_text = v; }
    get_cancel_text() { return this.cancel_text; }
    get_input_value() {
        return this._inputValue;
    }
    show_alert() {
        this.showDialog('alert');
    }
    show_confirm() {
        this.showDialog('confirm');
    }
    show_input() {
        this.showDialog('input');
    }
    close() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
            this._inputField = null;
        }
    }
    showDialog(type) {
        this.close();
        this._overlay = document.createElement('div');
        this._overlay.className = 'idyl-modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'idyl-modal';
        const titleEl = document.createElement('div');
        titleEl.className = 'idyl-modal-title';
        titleEl.textContent = this._title;
        modal.appendChild(titleEl);
        if (this._message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'idyl-modal-message';
            messageEl.textContent = this._message;
            modal.appendChild(messageEl);
        }
        if (type === 'input') {
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'idyl-modal-input-wrapper';
            this._inputField = document.createElement('input');
            this._inputField.type = 'text';
            this._inputField.className = 'idyl-modal-input';
            this._inputField.value = this._inputValue;
            inputWrapper.appendChild(this._inputField);
            modal.appendChild(inputWrapper);
            this._inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleConfirm();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.handleCancel();
                }
            });
        }
        const buttons = document.createElement('div');
        buttons.className = 'idyl-modal-buttons';
        if (type !== 'alert') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'idyl-modal-btn idyl-modal-btn-cancel';
            cancelBtn.textContent = this._cancelText;
            cancelBtn.addEventListener('click', () => this.handleCancel());
            buttons.appendChild(cancelBtn);
        }
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'idyl-modal-btn idyl-modal-btn-confirm';
        confirmBtn.textContent = this._confirmText;
        confirmBtn.addEventListener('click', () => this.handleConfirm());
        buttons.appendChild(confirmBtn);
        modal.appendChild(buttons);
        this._overlay.appendChild(modal);
        if (type !== 'alert') {
            this._overlay.addEventListener('click', (e) => {
                if (e.target === this._overlay) {
                    this.handleCancel();
                }
            });
        }
        document.body.appendChild(this._overlay);
        setTimeout(() => {
            if (this._inputField) {
                this._inputField.focus();
                this._inputField.select();
            }
            else {
                confirmBtn.focus();
            }
        }, 50);
    }
    async handleConfirm() {
        if (this._inputField) {
            this._inputValue = this._inputField.value;
        }
        this.close();
        if (this._onConfirm) {
            try {
                await this._onConfirm(this);
            }
            catch (e) {
                console.error('Modal on_confirm error:', e);
            }
        }
    }
    async handleCancel() {
        this.close();
        if (this._onCancel) {
            try {
                await this._onCancel(this);
            }
            catch (e) {
                console.error('Modal on_cancel error:', e);
            }
        }
    }
    show() { this.show_alert(); }
    hide() { this.close(); }
    get visible() { return this._overlay !== null; }
}
exports.Modal = Modal;
//# sourceMappingURL=widgets.js.map