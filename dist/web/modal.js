"use strict";
// src/web/modal.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.showInputModal = showInputModal;
exports.showConfirmModal = showConfirmModal;
function showInputModal(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'modal';
        const title = document.createElement('div');
        title.className = 'modal-title';
        title.textContent = options.title;
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'modal-input-wrapper';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'modal-input';
        input.placeholder = options.placeholder ?? '';
        input.value = options.defaultValue ?? '';
        const extensionHint = document.createElement('span');
        extensionHint.className = 'modal-extension-hint';
        extensionHint.textContent = '.idyl';
        inputWrapper.appendChild(input);
        if (options.showExtensionHint) {
            inputWrapper.appendChild(extensionHint);
        }
        const updateHint = () => {
            if (!options.showExtensionHint)
                return;
            const value = input.value;
            const hasExtension = /\.[a-zA-Z0-9]+$/.test(value);
            extensionHint.style.opacity = hasExtension ? '0' : '0.5';
        };
        input.addEventListener('input', updateHint);
        updateHint();
        const buttons = document.createElement('div');
        buttons.className = 'modal-buttons';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn modal-btn-cancel';
        cancelBtn.textContent = options.cancelText ?? 'Отмена';
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'modal-btn modal-btn-confirm';
        confirmBtn.textContent = options.confirmText ?? 'Создать';
        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);
        modal.appendChild(title);
        modal.appendChild(inputWrapper);
        modal.appendChild(buttons);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
        const close = (confirmed) => {
            let value = input.value.trim();
            if (confirmed && options.showExtensionHint) {
                const hasExtension = /\.[a-zA-Z0-9]+$/.test(value);
                if (!hasExtension && value.length > 0) {
                    value += '.idyl';
                }
            }
            overlay.remove();
            resolve({ confirmed, value });
        };
        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close(false);
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                close(true);
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                close(false);
            }
        });
    });
}
function showConfirmModal(title, message, confirmText = 'Удалить', cancelText = 'Отмена') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'modal';
        const titleEl = document.createElement('div');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        const messageEl = document.createElement('div');
        messageEl.className = 'modal-message';
        messageEl.textContent = message;
        const buttons = document.createElement('div');
        buttons.className = 'modal-buttons';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn modal-btn-cancel';
        cancelBtn.textContent = cancelText;
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'modal-btn modal-btn-danger';
        confirmBtn.textContent = confirmText;
        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);
        modal.appendChild(titleEl);
        modal.appendChild(messageEl);
        modal.appendChild(buttons);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const close = (confirmed) => {
            overlay.remove();
            resolve(confirmed);
        };
        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close(false);
            }
        });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                close(false);
                document.removeEventListener('keydown', handler);
            }
            if (e.key === 'Enter') {
                close(true);
                document.removeEventListener('keydown', handler);
            }
        });
    });
}
//# sourceMappingURL=modal.js.map