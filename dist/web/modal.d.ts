export interface ModalOptions {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    showExtensionHint?: boolean;
}
export interface ModalResult {
    confirmed: boolean;
    value: string;
}
export declare function showInputModal(options: ModalOptions): Promise<ModalResult>;
export declare function showConfirmModal(title: string, message: string, confirmText?: string, cancelText?: string): Promise<boolean>;
//# sourceMappingURL=modal.d.ts.map