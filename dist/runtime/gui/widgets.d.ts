export declare abstract class Widget {
    protected element: HTMLElement;
    constructor(tag: string, className: string);
    getElement(): HTMLElement;
    get x(): number;
    set x(v: number);
    get y(): number;
    set y(v: number);
    get width(): number;
    set width(v: number);
    get height(): number;
    set height(v: number);
    get visible(): boolean;
    set visible(v: boolean);
    set_x(v: number): void;
    get_x(): number;
    set_y(v: number): void;
    get_y(): number;
    set_width(v: number): void;
    get_width(): number;
    set_height(v: number): void;
    get_height(): number;
    set_visible(v: boolean): void;
    is_visible(): boolean;
    show(): void;
    hide(): void;
}
export declare class Window extends Widget {
    private titleBar;
    private titleText;
    private content;
    private _onShow;
    constructor();
    get title(): string;
    set title(v: string);
    set_title(v: string): void;
    get_title(): string;
    add_child(widget: Widget): void;
    set on_show(handler: (sender: Window) => void);
    show(): void;
}
export declare class Button extends Widget {
    private _onClick;
    constructor();
    get text(): string;
    set text(v: string);
    set_text(v: string): void;
    get_text(): string;
    get enabled(): boolean;
    set enabled(v: boolean);
    set_enabled(v: boolean): void;
    is_enabled(): boolean;
    set on_click(handler: (sender: Button) => Promise<void> | void);
}
export declare class Label extends Widget {
    constructor();
    get text(): string;
    set text(v: string);
    set_text(v: string): void;
    get_text(): string;
    get font_size(): number;
    set font_size(v: number);
    set_font_size(v: number): void;
    get_font_size(): number;
    get color(): string;
    set color(v: string);
}
export declare class SpinBox extends Widget {
    private input;
    private _onChange;
    constructor();
    get value(): number;
    set value(v: number);
    set_value(v: number): void;
    get_value(): number;
    get min(): number;
    set min(v: number);
    set_min(v: number): void;
    get_min(): number;
    get max(): number;
    set max(v: number);
    set_max(v: number): void;
    get_max(): number;
    get step(): number;
    set step(v: number);
    set_step(v: number): void;
    get_step(): number;
    set on_change(handler: (sender: SpinBox) => Promise<void> | void);
}
export declare class FloatSpinBox extends Widget {
    private input;
    private _onChange;
    constructor();
    get value(): number;
    set value(v: number);
    set_value(v: number): void;
    get_value(): number;
    get min(): number;
    set min(v: number);
    get max(): number;
    set max(v: number);
    get step(): number;
    set step(v: number);
    set on_change(handler: (sender: FloatSpinBox) => Promise<void> | void);
}
export declare class LineEdit extends Widget {
    private input;
    private _onChange;
    constructor();
    get text(): string;
    set text(v: string);
    set_text(v: string): void;
    get_text(): string;
    get placeholder(): string;
    set placeholder(v: string);
    set_placeholder(v: string): void;
    get_placeholder(): string;
    get echo_mode(): string;
    set echo_mode(v: string);
    set_echo_mode(v: string): void;
    get_echo_mode(): string;
    get font_size(): number;
    set font_size(v: number);
    set_font_size(v: number): void;
    get_font_size(): number;
    get enabled(): boolean;
    set enabled(v: boolean);
    set_enabled(v: boolean): void;
    is_enabled(): boolean;
    set on_change(handler: (sender: LineEdit) => Promise<void> | void);
}
export declare class CheckBox extends Widget {
    private input;
    private label;
    private _onChange;
    constructor();
    get is_checked(): boolean;
    set is_checked(v: boolean);
    set_checked(v: boolean): void;
    get_checked(): boolean;
    get text(): string;
    set text(v: string);
    set_text(v: string): void;
    get_text(): string;
    set on_change(handler: (sender: CheckBox) => Promise<void> | void);
}
export declare class ProgressBar extends Widget {
    private fill;
    private label;
    private _value;
    private _max;
    constructor();
    private updateFill;
    get value(): number;
    set value(v: number);
    set_value(v: number): void;
    get_value(): number;
    get max(): number;
    set max(v: number);
    set_max(v: number): void;
    get_max(): number;
}
export declare class TextEdit extends Widget {
    private textarea;
    private _onChange;
    constructor();
    get text(): string;
    set text(v: string);
    set_text(v: string): void;
    get_text(): string;
    get placeholder(): string;
    set placeholder(v: string);
    set on_change(handler: (sender: TextEdit) => Promise<void> | void);
}
export declare class ComboBox extends Widget {
    private select;
    private _onChange;
    constructor();
    add_item(text: string): void;
    clear_items(): void;
    get selected_index(): number;
    set selected_index(v: number);
    get selected_text(): string;
    set selected_text(v: string);
    set_selected_index(v: number): void;
    get_selected_index(): number;
    set on_change(handler: (sender: ComboBox) => Promise<void> | void);
}
export declare class Slider extends Widget {
    private input;
    private _onChange;
    constructor();
    get value(): number;
    set value(v: number);
    set_value(v: number): void;
    get_value(): number;
    get min(): number;
    set min(v: number);
    get max(): number;
    set max(v: number);
    get step(): number;
    set step(v: number);
    set on_change(handler: (sender: Slider) => Promise<void> | void);
}
export declare class Frame extends Widget {
    private titleEl;
    private content;
    constructor();
    get title(): string;
    set title(v: string);
    set_title(v: string): void;
    get_title(): string;
    add_child(widget: Widget): void;
}
export declare class RadioButton extends Widget {
    private input;
    private label;
    private _onChange;
    private static _groupCounter;
    private _group;
    constructor();
    get is_selected(): boolean;
    set is_selected(v: boolean);
    set_selected(v: boolean): void;
    get_selected(): boolean;
    get text(): string;
    set text(v: string);
    set_text(v: string): void;
    get_text(): string;
    get group(): string;
    set group(v: string);
    set_group(v: string): void;
    get_group(): string;
    static new_group(): void;
    set on_change(handler: (sender: RadioButton) => Promise<void> | void);
}
export declare class Timer {
    private _interval;
    private _running;
    private _timerId;
    private _onTick;
    constructor();
    get interval(): number;
    set interval(ms: number);
    get running(): boolean;
    set on_tick(handler: () => Promise<void> | void);
    get on_tick(): (() => Promise<void> | void) | null;
    start(): void;
    stop(): void;
    restart(): void;
    set_interval(ms: number): void;
    get_interval(): number;
    is_running(): boolean;
}
export declare class Modal {
    private _title;
    private _message;
    private _confirmText;
    private _cancelText;
    private _inputValue;
    private _onConfirm;
    private _onCancel;
    private _overlay;
    private _inputField;
    constructor();
    get title(): string;
    set title(v: string);
    get message(): string;
    set message(v: string);
    get confirm_text(): string;
    set confirm_text(v: string);
    get cancel_text(): string;
    set cancel_text(v: string);
    set on_confirm(handler: (sender: Modal) => Promise<void> | void);
    set on_cancel(handler: (sender: Modal) => Promise<void> | void);
    set_title(v: string): void;
    get_title(): string;
    set_message(v: string): void;
    get_message(): string;
    set_confirm_text(v: string): void;
    get_confirm_text(): string;
    set_cancel_text(v: string): void;
    get_cancel_text(): string;
    get_input_value(): string;
    show_alert(): void;
    show_confirm(): void;
    show_input(): void;
    close(): void;
    private showDialog;
    private handleConfirm;
    private handleCancel;
    show(): void;
    hide(): void;
    get visible(): boolean;
}
//# sourceMappingURL=widgets.d.ts.map