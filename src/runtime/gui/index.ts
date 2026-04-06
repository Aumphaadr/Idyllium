// src/runtime/gui/index.ts

import {
    Window,
    Button,
    Label,
    SpinBox,
    FloatSpinBox,
    LineEdit,
    CheckBox,
    ProgressBar,
    TextEdit,
    ComboBox,
    Slider,
    Frame,
} from './widgets';

import { injectGuiStyles } from './styles';

export function createGuiModule() {
    injectGuiStyles();
    
    return {
        Window,
        Button,
        Label,
        SpinBox,
        FloatSpinBox,
        LineEdit,
        CheckBox,
        ProgressBar,
        TextEdit,
        ComboBox,
        Slider,
        Frame,
    };
}

export {
    Window,
    Button,
    Label,
    SpinBox,
    FloatSpinBox,
    LineEdit,
    CheckBox,
    ProgressBar,
    TextEdit,
    ComboBox,
    Slider,
    Frame,
};