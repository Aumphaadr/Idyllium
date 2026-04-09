// src/runtime/gui/styles.ts

export const GUI_STYLES = `

.idyl-widget {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    box-sizing: border-box;
}

.idyl-window {
    background: #2a2a3e;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    min-width: 250px;
    min-height: 150px;
}

.idyl-window-titlebar {
    background: #1e1e2e;
    padding: 10px 16px;
    border-bottom: 1px solid #45475a;
    display: flex;
    align-items: center;
}

.idyl-window-title-text {
    color: #cdd6f4;
    font-size: 14px;
    font-weight: 600;
}

.idyl-window-content {
    position: relative;
    padding: 16px;
    min-height: 100px;
}

.idyl-button {
    padding: 8px 20px;
    background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.idyl-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #5aa0e9 0%, #4a8acd 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
}

.idyl-button:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.idyl-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.idyl-label {
    color: #cdd6f4;
    font-size: 14px;
    line-height: 1.4;
}

.idyl-spinbox-wrapper {
    display: inline-block;
}

.idyl-spinbox {
    padding: 8px 12px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 14px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
}

.idyl-spinbox:focus {
    outline: none;
    border-color: #89b4fa;
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.15);
}

.idyl-spinbox::-webkit-inner-spin-button,
.idyl-spinbox::-webkit-outer-spin-button {
    opacity: 1;
}

.idyl-lineedit-wrapper {
    display: inline-block;
}

.idyl-lineedit {
    padding: 8px 12px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
}

.idyl-lineedit:focus {
    outline: none;
    border-color: #89b4fa;
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.15);
}

.idyl-lineedit::placeholder {
    color: #6c7086;
}

.idyl-checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.idyl-checkbox {
    width: 18px;
    height: 18px;
    accent-color: #89b4fa;
    cursor: pointer;
}

.idyl-checkbox-label {
    color: #cdd6f4;
    font-size: 14px;
    cursor: pointer;
    user-select: none;
}

.idyl-progressbar {
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 6px;
    overflow: hidden;
    height: 24px;
    position: relative;
}

.idyl-progressbar-fill {
    height: 100%;
    background: linear-gradient(90deg, #89b4fa 0%, #74c7ec 100%);
    transition: width 0.3s ease;
    border-radius: 4px;
}

.idyl-progressbar-label {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #cdd6f4;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    pointer-events: none;
}

.idyl-radio-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.idyl-radio {
    width: 18px;
    height: 18px;
    accent-color: #89b4fa;
    cursor: pointer;
}

.idyl-radio-label {
    color: #cdd6f4;
    font-size: 14px;
    cursor: pointer;
    user-select: none;
}

.idyl-textedit-wrapper {
    display: inline-block;
}

.idyl-textedit {
    padding: 10px 12px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 14px;
    font-family: inherit;
    width: 100%;
    min-height: 80px;
    resize: vertical;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
}

.idyl-textedit:focus {
    outline: none;
    border-color: #89b4fa;
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.15);
}

.idyl-textedit::placeholder {
    color: #6c7086;
}

.idyl-combobox-wrapper {
    display: inline-block;
}

.idyl-combobox {
    padding: 8px 12px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
    cursor: pointer;
    transition: border-color 0.15s ease;
}

.idyl-combobox:focus {
    outline: none;
    border-color: #89b4fa;
}

.idyl-combobox option {
    background: #1e1e2e;
    color: #cdd6f4;
}

.idyl-slider-wrapper {
    display: inline-block;
    padding: 4px 0;
}

.idyl-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 4px;
    outline: none;
}

.idyl-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #89b4fa;
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.15s ease;
}

.idyl-slider::-webkit-slider-thumb:hover {
    background: #74c7ec;
}

.idyl-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #89b4fa;
    border: none;
    border-radius: 50%;
    cursor: pointer;
}

.idyl-frame {
    border: 1px solid #45475a;
    border-radius: 8px;
    padding: 16px;
    margin: 0;
}

.idyl-frame-title {
    color: #a6adc8;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 8px;
}

.idyl-frame-content {
    position: relative;
}

.idyl-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(2px);
}

.idyl-modal {
    background: #2a2a3e;
    border: 1px solid #45475a;
    border-radius: 12px;
    padding: 24px;
    min-width: 320px;
    max-width: 480px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: idyl-modal-appear 0.15s ease-out;
}

@keyframes idyl-modal-appear {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.idyl-modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #cdd6f4;
    margin-bottom: 12px;
}

.idyl-modal-message {
    font-size: 14px;
    color: #a6adc8;
    margin-bottom: 20px;
    line-height: 1.5;
}

.idyl-modal-input-wrapper {
    margin-bottom: 20px;
}

.idyl-modal-input {
    width: 100%;
    padding: 10px 14px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 8px;
    color: #cdd6f4;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    box-sizing: border-box;
}

.idyl-modal-input:focus {
    border-color: #89b4fa;
    box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.15);
}

.idyl-modal-input::placeholder {
    color: #6c7086;
}

.idyl-modal-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.idyl-modal-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
}

.idyl-modal-btn-cancel {
    background: #313244;
    color: #a6adc8;
}

.idyl-modal-btn-cancel:hover {
    background: #45475a;
    color: #cdd6f4;
}

.idyl-modal-btn-confirm {
    background: linear-gradient(135deg, #89b4fa 0%, #74c7ec 100%);
    color: #1e1e2e;
}

.idyl-modal-btn-confirm:hover {
    background: linear-gradient(135deg, #9fc5ff 0%, #89d4f5 100%);
    transform: translateY(-1px);
}

.idyl-modal-btn:focus {
    outline: 2px solid #89b4fa;
    outline-offset: 2px;
}

`;

export function injectGuiStyles(): void {
    if (document.getElementById('idyl-gui-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'idyl-gui-styles';
    style.textContent = GUI_STYLES;
    document.head.appendChild(style);
}