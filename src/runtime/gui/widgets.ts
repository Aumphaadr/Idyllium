// src/runtime/gui/widgets.ts

export abstract class Widget {
    protected element: HTMLElement;
    
    constructor(tag: string, className: string) {
        this.element = document.createElement(tag);
        this.element.className = `idyl-widget ${className}`;
        this.element.style.position = 'absolute';
    }
    
    getElement(): HTMLElement {
        return this.element;
    }
    
    get x(): number {
        return parseInt(this.element.style.left) || 0;
    }
    set x(v: number) {
        this.element.style.left = v + 'px';
    }
    
    get y(): number {
        return parseInt(this.element.style.top) || 0;
    }
    set y(v: number) {
        this.element.style.top = v + 'px';
    }
    
    get width(): number {
        const style = parseInt(this.element.style.width);
        return isNaN(style) ? this.element.offsetWidth : style;
    }
    set width(v: number) {
        this.element.style.width = v + 'px';
    }
    
    get height(): number {
        const style = parseInt(this.element.style.height);
        return isNaN(style) ? this.element.offsetHeight : style;
    }
    set height(v: number) {
        this.element.style.height = v + 'px';
    }
    
    get visible(): boolean {
        return this.element.style.display !== 'none';
    }
    set visible(v: boolean) {
        this.element.style.display = v ? '' : 'none';
    }
    
    set_x(v: number): void { this.x = v; }
    get_x(): number { return this.x; }
    
    set_y(v: number): void { this.y = v; }
    get_y(): number { return this.y; }
    
    set_width(v: number): void { this.width = v; }
    get_width(): number { return this.width; }
    
    set_height(v: number): void { this.height = v; }
    get_height(): number { return this.height; }
    
    set_visible(v: boolean): void { this.visible = v; }
    is_visible(): boolean { return this.visible; }
    
    show(): void { this.visible = true; }
    hide(): void { this.visible = false; }
}

export class Window extends Widget {
    private titleBar: HTMLElement;
    private titleText: HTMLElement;
    private content: HTMLElement;
    private _onShow: ((sender: Window) => void) | null = null;
    
    constructor() {
        super('div', 'idyl-window');
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
    
    get title(): string {
        return this.titleText.textContent || '';
    }
    set title(v: string) {
        this.titleText.textContent = v;
    }
    
    set_title(v: string): void { this.title = v; }
    get_title(): string { return this.title; }
    
    add_child(widget: Widget): void {
        this.content.appendChild(widget.getElement());
    }
    
    set on_show(handler: (sender: Window) => void) {
        this._onShow = handler;
    }
    
    show(): void {
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

export class Button extends Widget {
    private _onClick: ((sender: Button) => Promise<void> | void) | null = null;
    
    constructor() {
        super('button', 'idyl-button');
        
        this.element.addEventListener('click', async () => {
            if (this._onClick) {
                await this._onClick(this);
            }
        });
    }
    
    get text(): string {
        return this.element.textContent || '';
    }
    set text(v: string) {
        this.element.textContent = v;
    }
    
    set_text(v: string): void { this.text = v; }
    get_text(): string { return this.text; }
    
    get enabled(): boolean {
        return !(this.element as HTMLButtonElement).disabled;
    }
    set enabled(v: boolean) {
        (this.element as HTMLButtonElement).disabled = !v;
    }
    
    set_enabled(v: boolean): void { this.enabled = v; }
    is_enabled(): boolean { return this.enabled; }
    
    set on_click(handler: (sender: Button) => Promise<void> | void) {
        this._onClick = handler;
    }
}

export class Label extends Widget {
    constructor() {
        super('span', 'idyl-label');
    }
    
    get text(): string {
        return this.element.textContent || '';
    }
    set text(v: string) {
        this.element.textContent = v;
    }
    
    set_text(v: string): void { this.text = v; }
    get_text(): string { return this.text; }
    
    get font_size(): number {
        return parseInt(this.element.style.fontSize) || 14;
    }
    set font_size(v: number) {
        this.element.style.fontSize = v + 'px';
    }
    
    set_font_size(v: number): void { this.font_size = v; }
    get_font_size(): number { return this.font_size; }
    
    get color(): string {
        return this.element.style.color || '';
    }
    set color(v: string) {
        this.element.style.color = v;
    }
}

export class SpinBox extends Widget {
    private input: HTMLInputElement;
    private _onChange: ((sender: SpinBox) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-spinbox-wrapper');
        
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
    
    get value(): number {
        return parseInt(this.input.value) || 0;
    }
    set value(v: number) {
        this.input.value = Math.floor(v).toString();
    }
    
    set_value(v: number): void { this.value = v; }
    get_value(): number { return this.value; }
    
    get min(): number {
        return parseInt(this.input.min) || -Infinity;
    }
    set min(v: number) {
        this.input.min = v.toString();
    }
    
    set_min(v: number): void { this.min = v; }
    get_min(): number { return this.min; }
    
    get max(): number {
        return parseInt(this.input.max) || Infinity;
    }
    set max(v: number) {
        this.input.max = v.toString();
    }
    
    set_max(v: number): void { this.max = v; }
    get_max(): number { return this.max; }
    
    get step(): number {
        return parseInt(this.input.step) || 1;
    }
    set step(v: number) {
        this.input.step = v.toString();
    }
    
    set_step(v: number): void { this.step = v; }
    get_step(): number { return this.step; }
    
    set on_change(handler: (sender: SpinBox) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class FloatSpinBox extends Widget {
    private input: HTMLInputElement;
    private _onChange: ((sender: FloatSpinBox) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-spinbox-wrapper');
        
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
    
    get value(): number {
        return parseFloat(this.input.value) || 0.0;
    }
    set value(v: number) {
        this.input.value = v.toString();
    }
    
    set_value(v: number): void { this.value = v; }
    get_value(): number { return this.value; }
    
    get min(): number {
        return parseFloat(this.input.min) || -Infinity;
    }
    set min(v: number) {
        this.input.min = v.toString();
    }
    
    get max(): number {
        return parseFloat(this.input.max) || Infinity;
    }
    set max(v: number) {
        this.input.max = v.toString();
    }
    
    get step(): number {
        return parseFloat(this.input.step) || 0.1;
    }
    set step(v: number) {
        this.input.step = v.toString();
    }
    
    set on_change(handler: (sender: FloatSpinBox) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class LineEdit extends Widget {
    private input: HTMLInputElement;
    private _onChange: ((sender: LineEdit) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-lineedit-wrapper');
        
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
    
    get text(): string {
        return this.input.value;
    }
    set text(v: string) {
        this.input.value = v;
    }
    
    set_text(v: string): void { this.text = v; }
    get_text(): string { return this.text; }
    
    get placeholder(): string {
        return this.input.placeholder;
    }
    set placeholder(v: string) {
        this.input.placeholder = v;
    }
    
    set on_change(handler: (sender: LineEdit) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class CheckBox extends Widget {
    private input: HTMLInputElement;
    private label: HTMLLabelElement;
    private _onChange: ((sender: CheckBox) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-checkbox-wrapper');
        
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
    
    get is_checked(): boolean {
        return this.input.checked;
    }
    set is_checked(v: boolean) {
        this.input.checked = v;
    }
    
    set_checked(v: boolean): void { this.is_checked = v; }
    get_checked(): boolean { return this.is_checked; }
    
    get text(): string {
        return this.label.textContent || '';
    }
    set text(v: string) {
        this.label.textContent = v;
    }
    
    set_text(v: string): void { this.text = v; }
    get_text(): string { return this.text; }
    
    set on_change(handler: (sender: CheckBox) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class ProgressBar extends Widget {
    private fill: HTMLElement;
    private _value: number = 0;
    private _max: number = 100;
    
    constructor() {
        super('div', 'idyl-progressbar');
        
        this.fill = document.createElement('div');
        this.fill.className = 'idyl-progressbar-fill';
        this.element.appendChild(this.fill);
        
        this.updateFill();
    }
    
    private updateFill(): void {
        const percent = this._max > 0 ? (this._value / this._max) * 100 : 0;
        this.fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    }
    
    get value(): number {
        return this._value;
    }
    set value(v: number) {
        this._value = v;
        this.updateFill();
    }
    
    set_value(v: number): void { this.value = v; }
    get_value(): number { return this.value; }
    
    get max(): number {
        return this._max;
    }
    set max(v: number) {
        this._max = v;
        this.updateFill();
    }
    
    set_max(v: number): void { this.max = v; }
    get_max(): number { return this.max; }
}

export class TextEdit extends Widget {
    private textarea: HTMLTextAreaElement;
    private _onChange: ((sender: TextEdit) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-textedit-wrapper');
        
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'idyl-textedit';
        this.element.appendChild(this.textarea);
        
        this.textarea.addEventListener('input', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    
    get text(): string {
        return this.textarea.value;
    }
    set text(v: string) {
        this.textarea.value = v;
    }
    
    set_text(v: string): void { this.text = v; }
    get_text(): string { return this.text; }
    
    get placeholder(): string {
        return this.textarea.placeholder;
    }
    set placeholder(v: string) {
        this.textarea.placeholder = v;
    }
    
    set on_change(handler: (sender: TextEdit) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class ComboBox extends Widget {
    private select: HTMLSelectElement;
    private _onChange: ((sender: ComboBox) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-combobox-wrapper');
        
        this.select = document.createElement('select');
        this.select.className = 'idyl-combobox';
        this.element.appendChild(this.select);
        
        this.select.addEventListener('change', async () => {
            if (this._onChange) {
                await this._onChange(this);
            }
        });
    }
    
    add_item(text: string): void {
        const option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        this.select.appendChild(option);
    }
    
    clear_items(): void {
        this.select.innerHTML = '';
    }
    
    get selected_index(): number {
        return this.select.selectedIndex;
    }
    set selected_index(v: number) {
        this.select.selectedIndex = v;
    }
    
    get selected_text(): string {
        return this.select.value;
    }
    set selected_text(v: string) {
        this.select.value = v;
    }
    
    set_selected_index(v: number): void { this.selected_index = v; }
    get_selected_index(): number { return this.selected_index; }
    
    set on_change(handler: (sender: ComboBox) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class Slider extends Widget {
    private input: HTMLInputElement;
    private _onChange: ((sender: Slider) => Promise<void> | void) | null = null;
    
    constructor() {
        super('div', 'idyl-slider-wrapper');
        
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
    
    get value(): number {
        return parseInt(this.input.value) || 0;
    }
    set value(v: number) {
        this.input.value = v.toString();
    }
    
    set_value(v: number): void { this.value = v; }
    get_value(): number { return this.value; }
    
    get min(): number {
        return parseInt(this.input.min) || 0;
    }
    set min(v: number) {
        this.input.min = v.toString();
    }
    
    get max(): number {
        return parseInt(this.input.max) || 100;
    }
    set max(v: number) {
        this.input.max = v.toString();
    }
    
    get step(): number {
        return parseInt(this.input.step) || 1;
    }
    set step(v: number) {
        this.input.step = v.toString();
    }
    
    set on_change(handler: (sender: Slider) => Promise<void> | void) {
        this._onChange = handler;
    }
}

export class Frame extends Widget {
    private titleEl: HTMLElement | null = null;
    private content: HTMLElement;
    
    constructor() {
        super('fieldset', 'idyl-frame');
        
        this.content = document.createElement('div');
        this.content.className = 'idyl-frame-content';
        this.element.appendChild(this.content);
    }
    
    get title(): string {
        return this.titleEl?.textContent || '';
    }
    set title(v: string) {
        if (!this.titleEl && v) {
            this.titleEl = document.createElement('legend');
            this.titleEl.className = 'idyl-frame-title';
            this.element.insertBefore(this.titleEl, this.content);
        }
        if (this.titleEl) {
            this.titleEl.textContent = v;
        }
    }
    
    set_title(v: string): void { this.title = v; }
    get_title(): string { return this.title; }
    
    add_child(widget: Widget): void {
        this.content.appendChild(widget.getElement());
    }
}