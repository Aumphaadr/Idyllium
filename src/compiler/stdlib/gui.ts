// src/compiler/stdlib/gui.ts

export interface WidgetProperty {
    name: string;
    type: 'int' | 'float' | 'string' | 'bool' | 'function';
    readonly?: boolean;
}

export interface WidgetMethod {
    name: string;
    params: { name: string; type: string }[];
    returnType: string;
}

export interface WidgetDescriptor {
    properties: WidgetProperty[];
    methods: WidgetMethod[];
}

const COMMON_PROPERTIES: WidgetProperty[] = [
    { name: 'x',       type: 'int' },
    { name: 'y',       type: 'int' },
    { name: 'width',   type: 'int' },
    { name: 'height',  type: 'int' },
    { name: 'visible', type: 'bool' },
];

const COMMON_METHODS: WidgetMethod[] = [
    { name: 'show', params: [], returnType: 'void' },
    { name: 'hide', params: [], returnType: 'void' },
];

export const GUI_WIDGETS: Record<string, WidgetDescriptor> = {
    Window: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'title', type: 'string' },
            { name: 'on_show', type: 'function' },
        ],
        methods: [
            ...COMMON_METHODS,
            { name: 'add_child', params: [{ name: 'widget', type: 'Widget' }], returnType: 'void' },
        ],
    },

    Button: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'text',     type: 'string' },
            { name: 'enabled',  type: 'bool' },
            { name: 'on_click', type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    Label: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'text',      type: 'string' },
            { name: 'font_size', type: 'int' },
            { name: 'color',     type: 'string' },
        ],
        methods: [...COMMON_METHODS],
    },

    SpinBox: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'value',     type: 'int' },
            { name: 'min',       type: 'int' },
            { name: 'max',       type: 'int' },
            { name: 'step',      type: 'int' },
            { name: 'on_change', type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    FloatSpinBox: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'value',     type: 'float' },
            { name: 'min',       type: 'float' },
            { name: 'max',       type: 'float' },
            { name: 'step',      type: 'float' },
            { name: 'on_change', type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    LineEdit: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'text', type: 'string' },
            { name: 'placeholder', type: 'string' },
            { name: 'echo_mode', type: 'string' },
            { name: 'font_size', type: 'int' },
            { name: 'enabled', type: 'bool' },
            { name: 'on_change', type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    CheckBox: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'text',       type: 'string' },
            { name: 'is_checked', type: 'bool' },
            { name: 'on_change',  type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    RadioButton: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'text', type: 'string' },
            { name: 'is_selected', type: 'bool' },
            { name: 'group', type: 'string' },
            { name: 'on_change', type: 'function' },
        ],
        methods: [...COMMON_METHODS,
            { name: 'new_group', params: [], returnType: 'void' },
        ],
    },

    ProgressBar: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'value', type: 'int' },
            { name: 'max',   type: 'int' },
        ],
        methods: [...COMMON_METHODS],
    },

    TextEdit: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'text',        type: 'string' },
            { name: 'placeholder', type: 'string' },
            { name: 'on_change',   type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    ComboBox: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'selected_index', type: 'int' },
            { name: 'selected_text',  type: 'string' },
            { name: 'on_change',      type: 'function' },
        ],
        methods: [
            ...COMMON_METHODS,
            { name: 'add_item',    params: [{ name: 'text', type: 'string' }], returnType: 'void' },
            { name: 'clear_items', params: [],                                  returnType: 'void' },
        ],
    },

    Slider: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'value',     type: 'int' },
            { name: 'min',       type: 'int' },
            { name: 'max',       type: 'int' },
            { name: 'step',      type: 'int' },
            { name: 'on_change', type: 'function' },
        ],
        methods: [...COMMON_METHODS],
    },

    Frame: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'title', type: 'string' },
        ],
        methods: [
            ...COMMON_METHODS,
            { name: 'add_child', params: [{ name: 'widget', type: 'Widget' }], returnType: 'void' },
        ],
    },

    Timer: {
        properties: [
            { name: 'interval', type: 'int' },
            { name: 'running', type: 'bool', readonly: true },
            { name: 'on_tick', type: 'function' },
        ],
        methods: [
            { name: 'start', params: [], returnType: 'void' },
            { name: 'stop', params: [], returnType: 'void' },
            { name: 'restart', params: [], returnType: 'void' },
        ],
    },
    
    Modal: {
        properties: [
            ...COMMON_PROPERTIES,
            { name: 'title', type: 'string' },
            { name: 'message', type: 'string' },
            { name: 'confirm_text', type: 'string' },
            { name: 'cancel_text', type: 'string' },
            { name: 'on_confirm', type: 'function' },
            { name: 'on_cancel', type: 'function' },
        ],
        methods: [
            ...COMMON_METHODS,
            { name: 'show_confirm', params: [], returnType: 'void' },
            { name: 'show_input', params: [], returnType: 'void' },
            { name: 'show_alert', params: [], returnType: 'void' },
            { name: 'get_input_value', params: [], returnType: 'string' },
            { name: 'close', params: [], returnType: 'void' },
        ],
    },
};

export function isGuiWidget(name: string): boolean {
    return name in GUI_WIDGETS;
}

export function getWidgetDescriptor(name: string): WidgetDescriptor | null {
    return GUI_WIDGETS[name] ?? null;
}

export function findWidgetProperty(widgetName: string, propName: string): WidgetProperty | null {
    const desc = GUI_WIDGETS[widgetName];
    if (!desc) return null;
    return desc.properties.find(p => p.name === propName) ?? null;
}

export function findWidgetMethod(widgetName: string, methodName: string): WidgetMethod | null {
    const desc = GUI_WIDGETS[widgetName];
    if (!desc) return null;
    return desc.methods.find(m => m.name === methodName) ?? null;
}