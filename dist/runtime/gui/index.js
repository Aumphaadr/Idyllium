"use strict";
// src/runtime/gui/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioButton = exports.Modal = exports.Timer = exports.Frame = exports.Slider = exports.ComboBox = exports.TextEdit = exports.ProgressBar = exports.CheckBox = exports.LineEdit = exports.FloatSpinBox = exports.SpinBox = exports.Label = exports.Button = exports.Window = void 0;
exports.createGuiModule = createGuiModule;
const widgets_1 = require("./widgets");
Object.defineProperty(exports, "Window", { enumerable: true, get: function () { return widgets_1.Window; } });
Object.defineProperty(exports, "Button", { enumerable: true, get: function () { return widgets_1.Button; } });
Object.defineProperty(exports, "Label", { enumerable: true, get: function () { return widgets_1.Label; } });
Object.defineProperty(exports, "SpinBox", { enumerable: true, get: function () { return widgets_1.SpinBox; } });
Object.defineProperty(exports, "FloatSpinBox", { enumerable: true, get: function () { return widgets_1.FloatSpinBox; } });
Object.defineProperty(exports, "LineEdit", { enumerable: true, get: function () { return widgets_1.LineEdit; } });
Object.defineProperty(exports, "CheckBox", { enumerable: true, get: function () { return widgets_1.CheckBox; } });
Object.defineProperty(exports, "ProgressBar", { enumerable: true, get: function () { return widgets_1.ProgressBar; } });
Object.defineProperty(exports, "TextEdit", { enumerable: true, get: function () { return widgets_1.TextEdit; } });
Object.defineProperty(exports, "ComboBox", { enumerable: true, get: function () { return widgets_1.ComboBox; } });
Object.defineProperty(exports, "Slider", { enumerable: true, get: function () { return widgets_1.Slider; } });
Object.defineProperty(exports, "Frame", { enumerable: true, get: function () { return widgets_1.Frame; } });
Object.defineProperty(exports, "Timer", { enumerable: true, get: function () { return widgets_1.Timer; } });
Object.defineProperty(exports, "Modal", { enumerable: true, get: function () { return widgets_1.Modal; } });
Object.defineProperty(exports, "RadioButton", { enumerable: true, get: function () { return widgets_1.RadioButton; } });
const styles_1 = require("./styles");
function createGuiModule() {
    (0, styles_1.injectGuiStyles)();
    return {
        Window: widgets_1.Window, Button: widgets_1.Button, Label: widgets_1.Label, SpinBox: widgets_1.SpinBox, FloatSpinBox: widgets_1.FloatSpinBox,
        LineEdit: widgets_1.LineEdit, CheckBox: widgets_1.CheckBox, ProgressBar: widgets_1.ProgressBar, TextEdit: widgets_1.TextEdit,
        ComboBox: widgets_1.ComboBox, Slider: widgets_1.Slider, Frame: widgets_1.Frame, Timer: widgets_1.Timer, Modal: widgets_1.Modal,
        RadioButton: widgets_1.RadioButton,
    };
}
//# sourceMappingURL=index.js.map