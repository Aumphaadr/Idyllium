export interface WidgetProperty {
    name: string;
    type: 'int' | 'float' | 'string' | 'bool' | 'function';
    readonly?: boolean;
}
export interface WidgetMethod {
    name: string;
    params: {
        name: string;
        type: string;
    }[];
    returnType: string;
}
export interface WidgetDescriptor {
    properties: WidgetProperty[];
    methods: WidgetMethod[];
}
export declare const GUI_WIDGETS: Record<string, WidgetDescriptor>;
export declare function isGuiWidget(name: string): boolean;
export declare function getWidgetDescriptor(name: string): WidgetDescriptor | null;
export declare function findWidgetProperty(widgetName: string, propName: string): WidgetProperty | null;
export declare function findWidgetMethod(widgetName: string, methodName: string): WidgetMethod | null;
//# sourceMappingURL=gui.d.ts.map