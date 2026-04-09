import { ConsoleIO } from '../runtime/runtime';
export declare class Terminal implements ConsoleIO {
    private container;
    private outputEl;
    private inputContainer;
    private inputField;
    private inputLabel;
    private currentColor;
    private currentBold;
    private currentItalic;
    private currentUnderline;
    private inputResolve;
    private inputReject;
    constructor(container: HTMLElement);
    print(text: string): void;
    readLine(): Promise<string>;
    clear(): void;
    printSystem(text: string, type?: 'info' | 'error' | 'success'): HTMLElement;
    cancelInput(): void;
    private printRaw;
    private parseAnsi;
    private scrollToBottom;
}
//# sourceMappingURL=terminal.d.ts.map