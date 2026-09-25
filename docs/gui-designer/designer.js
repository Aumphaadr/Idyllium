/* Idyllium 1.6.3 — Конструктор GUI; собрано tools/build-gui-designer.js из packages/gui-designer/; править источники. */
"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // packages/gui-designer/src/widgets.js
  var require_widgets = __commonJS({
    "packages/gui-designer/src/widgets.js"(exports, module) {
      "use strict";
      var KEYWORDS = /* @__PURE__ */ new Set([
        "use",
        "main",
        "function",
        "int",
        "float",
        "string",
        "char",
        "bool",
        "void",
        "if",
        "else",
        "try",
        "catch",
        "finally",
        "while",
        "do",
        "for",
        "break",
        "continue",
        "return",
        "const",
        "and",
        "xor",
        "or",
        "not",
        "true",
        "false",
        "null",
        "div",
        "mod",
        "array",
        "dyn_array",
        "map",
        "class",
        "constructor",
        "this",
        "static",
        "extends",
        "event",
        "contract",
        "private",
        "public"
      ]);
      var RESERVED_NAMES = /* @__PURE__ */ new Set(["win", "gui", "colors", "fonts", "image", "console", "math", "time", "random"]);
      var WINDOW_THEMES2 = ["default", "idyllium", "dracula", "breeze", "oxygen"];
      var PROPERTY_GROUPS2 = [
        ["geometry", "\u041F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u0440\u0430\u0437\u043C\u0435\u0440"],
        ["text", "\u0422\u0435\u043A\u0441\u0442"],
        ["values", "\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u044F"],
        ["colors", "\u0426\u0432\u0435\u0442\u0430"],
        ["behaviour", "\u041F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435"]
      ];
      var GEOMETRY = [
        { name: "x", kind: "int", group: "geometry", label: "x", default: 0 },
        { name: "y", kind: "int", group: "geometry", label: "y", default: 0 },
        { name: "width", kind: "int", group: "geometry", label: "\u0448\u0438\u0440\u0438\u043D\u0430", min: 1 },
        { name: "height", kind: "int", group: "geometry", label: "\u0432\u044B\u0441\u043E\u0442\u0430", min: 1 }
      ];
      var COMMON_TAIL = [
        { name: "hint", kind: "string", group: "text", label: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 (hint)" },
        { name: "text_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430" },
        { name: "background_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0444\u043E\u043D\u0430" },
        { name: "visible", kind: "bool", group: "behaviour", label: "\u0432\u0438\u0434\u0438\u043C (visible)", default: true },
        { name: "enabled", kind: "bool", group: "behaviour", label: "\u0432\u043A\u043B\u044E\u0447\u0451\u043D (enabled)", default: true }
      ];
      var FONT_SIZE = { name: "font_size", kind: "int", group: "text", label: "\u0440\u0430\u0437\u043C\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430", min: 1 };
      var BORDER_COLOR = { name: "border_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0440\u0430\u043C\u043A\u0438" };
      function widget(type, label, defaultName, group, size, own, options = {}) {
        return {
          type,
          label,
          defaultName,
          group,
          size,
          props: [...GEOMETRY, ...own, ...COMMON_TAIL],
          events: options.events || [],
          container: options.container || null,
          hint: options.hint || ""
        };
      }
      var WIDGET_TYPES2 = [
        widget("Label", "\u041D\u0430\u0434\u043F\u0438\u0441\u044C", "label", "\u041D\u0430\u0434\u043F\u0438\u0441\u0438 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438", { width: 120, height: 24 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u041D\u0430\u0434\u043F\u0438\u0441\u044C" },
          FONT_SIZE,
          { name: "href", kind: "string", group: "text", label: "\u0441\u0441\u044B\u043B\u043A\u0430 (href)" },
          BORDER_COLOR
        ], { events: [{ name: "on_click", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u043F\u0440\u0438 \u0449\u0435\u043B\u0447\u043A\u0435 \u043F\u043E \u043D\u0430\u0434\u043F\u0438\u0441\u0438" }] }),
        widget("Button", "\u041A\u043D\u043E\u043F\u043A\u0430", "button", "\u041D\u0430\u0434\u043F\u0438\u0441\u0438 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438", { width: 120, height: 32 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u041A\u043D\u043E\u043F\u043A\u0430" },
          FONT_SIZE,
          BORDER_COLOR
        ], { events: [{ name: "on_click", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u043F\u0440\u0438 \u043D\u0430\u0436\u0430\u0442\u0438\u0438" }] }),
        widget("LineEdit", "\u041F\u043E\u043B\u0435 \u0432\u0432\u043E\u0434\u0430", "line_edit", "\u0412\u0432\u043E\u0434", { width: 180, height: 28 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442" },
          { name: "placeholder", kind: "string", group: "text", label: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0432 \u043F\u043E\u043B\u0435" },
          { name: "echo_mode", kind: "enum", group: "values", label: "\u043F\u043E\u043A\u0430\u0437 \u0432\u0432\u043E\u0434\u0430", values: ["normal", "password", "no_echo"], default: "normal" },
          FONT_SIZE,
          BORDER_COLOR,
          { name: "placeholder_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438" }
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0442\u0435\u043A\u0441\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F" }] }),
        widget("TextEdit", "\u041C\u043D\u043E\u0433\u043E\u0441\u0442\u0440\u043E\u0447\u043D\u043E\u0435 \u043F\u043E\u043B\u0435", "text_edit", "\u0412\u0432\u043E\u0434", { width: 240, height: 120 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442" },
          { name: "placeholder", kind: "string", group: "text", label: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0432 \u043F\u043E\u043B\u0435" },
          FONT_SIZE,
          BORDER_COLOR,
          { name: "placeholder_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438" }
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0442\u0435\u043A\u0441\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F" }] }),
        widget("SpinBox", "\u0421\u0447\u0451\u0442\u0447\u0438\u043A", "spin_box", "\u0412\u0432\u043E\u0434", { width: 100, height: 28 }, [
          { name: "value", kind: "int", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "min", kind: "int", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "int", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "step", kind: "int", group: "values", label: "\u0448\u0430\u0433", default: 1 },
          FONT_SIZE
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C" }] }),
        widget("FloatSpinBox", "\u0414\u0440\u043E\u0431\u043D\u044B\u0439 \u0441\u0447\u0451\u0442\u0447\u0438\u043A", "float_spin_box", "\u0412\u0432\u043E\u0434", { width: 120, height: 28 }, [
          { name: "value", kind: "float", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "min", kind: "float", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "float", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "step", kind: "float", group: "values", label: "\u0448\u0430\u0433", default: 1 },
          FONT_SIZE
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C" }] }),
        widget("Slider", "\u041F\u043E\u043B\u0437\u0443\u043D\u043E\u043A", "slider", "\u0412\u0432\u043E\u0434", { width: 200, height: 28 }, [
          { name: "value", kind: "int", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "min", kind: "int", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "int", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "step", kind: "int", group: "values", label: "\u0448\u0430\u0433", default: 1 },
          { name: "orientation", kind: "enum", group: "values", label: "\u043E\u0440\u0438\u0435\u043D\u0442\u0430\u0446\u0438\u044F", values: ["horizontal", "vertical"], default: "horizontal" }
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u043F\u043E\u043B\u0437\u0443\u043D\u043E\u043A \u0441\u0434\u0432\u0438\u043D\u0443\u043B\u0438" }] }),
        widget("CheckBox", "\u0424\u043B\u0430\u0436\u043E\u043A", "check_box", "\u0412\u044B\u0431\u043E\u0440", { width: 180, height: 24 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u0424\u043B\u0430\u0436\u043E\u043A" },
          { name: "is_checked", kind: "bool", group: "values", label: "\u043E\u0442\u043C\u0435\u0447\u0435\u043D", default: false },
          FONT_SIZE
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0444\u043B\u0430\u0436\u043E\u043A \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u043B\u0438" }] }),
        widget("RadioButton", "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C", "radio_button", "\u0412\u044B\u0431\u043E\u0440", { width: 180, height: 24 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u0412\u0430\u0440\u0438\u0430\u043D\u0442" },
          { name: "is_selected", kind: "bool", group: "values", label: "\u0432\u044B\u0431\u0440\u0430\u043D", default: false },
          { name: "group", kind: "string", group: "values", label: "\u0433\u0440\u0443\u043F\u043F\u0430" },
          FONT_SIZE
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0432\u044B\u0431\u0440\u0430\u043B\u0438" }] }),
        widget("ComboBox", "\u0421\u043F\u0438\u0441\u043E\u043A", "combo_box", "\u0412\u044B\u0431\u043E\u0440", { width: 180, height: 30 }, [
          FONT_SIZE
        ], { events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0432\u044B\u0431\u0440\u0430\u043B\u0438 \u043F\u0443\u043D\u043A\u0442" }], hint: '\u041F\u0443\u043D\u043A\u0442\u044B \u0441\u043F\u0438\u0441\u043A\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432 \u043A\u043E\u0434\u0435: combo_box1.add_item("\u2026")' }),
        widget("ProgressBar", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440", "progress_bar", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 200, height: 24 }, [
          { name: "value", kind: "int", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "min", kind: "int", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "int", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "orientation", kind: "enum", group: "values", label: "\u043E\u0440\u0438\u0435\u043D\u0442\u0430\u0446\u0438\u044F", values: ["horizontal", "vertical"], default: "horizontal" },
          FONT_SIZE,
          { name: "foreground_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043F\u043E\u043B\u043E\u0441\u044B" },
          BORDER_COLOR
        ]),
        widget("ImageBox", "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430", "image_box", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 160, height: 120 }, [
          { name: "resize_mode", kind: "enum", group: "values", label: "\u0432\u043F\u0438\u0441\u044B\u0432\u0430\u043D\u0438\u0435", values: ["fit", "fill", "stretch", "original"], default: "fit" }
        ], { hint: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u0432 \u043A\u043E\u0434\u0435: image_box1.set_image(\u2026)" }),
        widget("Canvas", "\u0425\u043E\u043B\u0441\u0442", "canvas", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 300, height: 150 }, [], { hint: "\u0420\u0438\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u2014 \u0432 \u043A\u043E\u0434\u0435: canvas1.draw(\u2026), canvas1.fill(\u2026)" }),
        widget("Frame", "\u0420\u0430\u043C\u043A\u0430", "frame", "\u041A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u044B", { width: 220, height: 140 }, [
          { name: "title", kind: "string", group: "text", label: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A" },
          FONT_SIZE,
          BORDER_COLOR,
          { name: "border_width", kind: "int", group: "values", label: "\u0442\u043E\u043B\u0449\u0438\u043D\u0430 \u0440\u0430\u043C\u043A\u0438", min: 0 }
        ], { container: "children" }),
        widget("TabWidget", "\u0412\u043A\u043B\u0430\u0434\u043A\u0438", "tabs", "\u041A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u044B", { width: 320, height: 200 }, [
          FONT_SIZE
        ], { container: "tabs", events: [{ name: "on_change", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u043B\u0438 \u0432\u043A\u043B\u0430\u0434\u043A\u0443" }] })
      ];
      var TAB_PAGE_TYPE2 = "Frame";
      var WINDOW_PROPS2 = [
        { name: "title", kind: "string", group: "text", label: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A" },
        { name: "width", kind: "int", group: "geometry", label: "\u0448\u0438\u0440\u0438\u043D\u0430", min: 100, default: 640 },
        { name: "height", kind: "int", group: "geometry", label: "\u0432\u044B\u0441\u043E\u0442\u0430", min: 60, default: 420 },
        { name: "theme", kind: "enum", group: "values", label: "\u0442\u0435\u043C\u0430", values: WINDOW_THEMES2, default: "default" },
        { name: "font_size", kind: "int", group: "text", label: "\u0440\u0430\u0437\u043C\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430", min: 1 },
        { name: "text_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430" },
        { name: "background_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0444\u043E\u043D\u0430" }
      ];
      var WIDGETS2 = Object.fromEntries(WIDGET_TYPES2.map((def) => [def.type, def]));
      var PALETTE_GROUPS2 = [...new Set(WIDGET_TYPES2.map((def) => def.group))].map((group) => ({
        title: group,
        types: WIDGET_TYPES2.filter((def) => def.group === group).map((def) => def.type)
      }));
      function widgetDefinition2(type) {
        const def = WIDGETS2[type];
        if (!def) throw new Error(`gui-designer: unknown widget type '${type}'`);
        return def;
      }
      function propertyOf2(type, name) {
        const props = type === "Window" ? WINDOW_PROPS2 : widgetDefinition2(type).props;
        return props.find((prop) => prop.name === name) || null;
      }
      var IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_]*$/u;
      function nameProblem2(name, takenNames2 = []) {
        if (typeof name !== "string" || name.trim() === "") return "\u0418\u043C\u044F \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C";
        if (!IDENTIFIER.test(name)) return "\u0418\u043C\u044F \u2014 \u0431\u0443\u043A\u0432\u044B, \u0446\u0438\u0444\u0440\u044B \u0438 \u043F\u043E\u0434\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u043D\u0438\u0435; \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F \u0441 \u0431\u0443\u043A\u0432\u044B";
        if (KEYWORDS.has(name)) return `\xAB${name}\xBB \u2014 \u043A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0441\u043B\u043E\u0432\u043E \u044F\u0437\u044B\u043A\u0430`;
        if (RESERVED_NAMES.has(name)) return `\xAB${name}\xBB \u0437\u0430\u043D\u044F\u0442\u043E \u043E\u043A\u043D\u043E\u043C \u0438\u043B\u0438 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u043E\u0439`;
        if (takenNames2.includes(name)) return `\u0418\u043C\u044F \xAB${name}\xBB \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432 \u043C\u0430\u043A\u0435\u0442\u0435`;
        return null;
      }
      function freeName2(base, takenNames2) {
        let index = 1;
        while (takenNames2.includes(`${base}${index}`)) index++;
        return `${base}${index}`;
      }
      module.exports = {
        KEYWORDS,
        RESERVED_NAMES,
        WINDOW_THEMES: WINDOW_THEMES2,
        PROPERTY_GROUPS: PROPERTY_GROUPS2,
        WIDGET_TYPES: WIDGET_TYPES2,
        WIDGETS: WIDGETS2,
        WINDOW_PROPS: WINDOW_PROPS2,
        PALETTE_GROUPS: PALETTE_GROUPS2,
        TAB_PAGE_TYPE: TAB_PAGE_TYPE2,
        widgetDefinition: widgetDefinition2,
        propertyOf: propertyOf2,
        nameProblem: nameProblem2,
        freeName: freeName2
      };
    }
  });

  // packages/gui-designer/src/codegen.js
  var require_codegen = __commonJS({
    "packages/gui-designer/src/codegen.js"(exports, module) {
      "use strict";
      var { WINDOW_PROPS: WINDOW_PROPS2, widgetDefinition: widgetDefinition2, propertyOf: propertyOf2 } = require_widgets();
      var MODEL_VERSION2 = 1;
      var MODEL_COMMENT_PREFIX = "// gui-designer:";
      function escapeString(value) {
        return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "").replace(/\t/g, "\\t");
      }
      function formatValue(kind, value) {
        switch (kind) {
          case "int":
            return String(Math.round(Number(value)));
          case "float": {
            const number = Number(value);
            const text = String(number);
            return /[.eE]/u.test(text) ? text : `${text}.0`;
          }
          case "bool":
            return value ? "true" : "false";
          case "color":
            return `colors.HEX("${escapeString(normalizeHex2(value))}")`;
          case "enum":
          case "string":
          default:
            return `"${escapeString(value)}"`;
        }
      }
      function normalizeHex2(value) {
        const text = String(value || "").trim();
        const match = /^#?([0-9a-fA-F]{6})$/u.exec(text);
        return match ? `#${match[1].toLowerCase()}` : "#000000";
      }
      function hasValue(props, name) {
        return props && props[name] !== void 0 && props[name] !== null && props[name] !== "";
      }
      function childrenOf2(model2, parentId) {
        return model2.widgets.filter((item) => item.parent === parentId);
      }
      function usesColors(model2) {
        const check = (type, props) => Object.keys(props || {}).some((name) => {
          const prop = propertyOf2(type, name);
          return prop && prop.kind === "color" && hasValue(props, name);
        });
        if (check("Window", model2.window.props)) return true;
        return model2.widgets.some((item) => check(item.type, item.props));
      }
      function propertyLines(indent, ownerName, type, props, skip = []) {
        const lines = [];
        const catalogue = type === "Window" ? WINDOW_PROPS2 : widgetDefinition2(type).props;
        for (const prop of catalogue) {
          if (skip.includes(prop.name) || !hasValue(props, prop.name)) continue;
          lines.push(`${indent}${ownerName}.${prop.name} = ${formatValue(prop.kind, props[prop.name])};`);
        }
        return lines;
      }
      function generateCode2(model2, options = {}) {
        const indent = "    ";
        const lines = ["use gui;"];
        if (usesColors(model2)) lines.push("use colors;");
        lines.push("", "main() {");
        const win = model2.window;
        lines.push(`${indent}gui.Window ${win.name};`);
        lines.push(...propertyLines(indent, win.name, "Window", win.props));
        const handlerLines = [];
        const emitWidget = (item, parentName) => {
          const def = widgetDefinition2(item.type);
          lines.push("");
          lines.push(`${indent}gui.${item.type} ${item.name};`);
          const skip = [];
          const props = { ...item.props };
          if (def.container === "tabs") {
            const previewIndex = options.previewTabs && options.previewTabs[item.id];
            if (previewIndex !== void 0 && previewIndex !== null) props.selected_index = previewIndex;
          }
          lines.push(...propertyLines(indent, item.name, item.type, props, skip));
          if (def.container === "tabs" && props.selected_index !== void 0 && props.selected_index !== null && !hasValue(item.props, "selected_index")) {
            lines.push(`${indent}${item.name}.selected_index = ${Math.round(Number(props.selected_index))};`);
          }
          const children = childrenOf2(model2, item.id);
          if (def.container === "children") {
            for (const child of children) emitWidget(child, item.name);
          } else if (def.container === "tabs") {
            for (const page of children) {
              emitWidget(page, null);
              lines.push(`${indent}${item.name}.add_tab("${escapeString(page.tabTitle || "")}", ${page.name});`);
            }
          }
          if (parentName) lines.push(`${indent}${parentName}.add_child(${item.name});`);
          if (options.handlers) {
            for (const event of def.events) {
              handlerLines.push("", `${indent}${item.name}.${event.name} = void function() {`, `${indent}${indent}// ${event.comment}`, `${indent}};`);
            }
          }
        };
        for (const item of childrenOf2(model2, null)) emitWidget(item, win.name);
        lines.push(...handlerLines);
        lines.push("", `${indent}${win.name}.show();`, "}");
        let code = `${lines.join("\n")}
`;
        if (options.embedModel) code += `
${MODEL_COMMENT_PREFIX} ${JSON.stringify(stripModel2(model2))}
`;
        return code;
      }
      function stripModel2(model2) {
        return {
          version: MODEL_VERSION2,
          window: { name: model2.window.name, props: { ...model2.window.props } },
          widgets: model2.widgets.map((item) => {
            const copy = { id: item.id, type: item.type, name: item.name, parent: item.parent, props: { ...item.props } };
            if (item.tabTitle !== void 0) copy.tabTitle = item.tabTitle;
            return copy;
          })
        };
      }
      function extractEmbeddedModel2(text) {
        const line = String(text).split("\n").map((item) => item.trim()).find((item) => item.startsWith(MODEL_COMMENT_PREFIX));
        if (!line) return null;
        return JSON.parse(line.slice(MODEL_COMMENT_PREFIX.length).trim());
      }
      function stripEmbeddedModel2(text) {
        return String(text).split("\n").filter((item) => !item.trim().startsWith(MODEL_COMMENT_PREFIX)).join("\n").replace(/\n+$/u, "\n");
      }
      module.exports = {
        MODEL_VERSION: MODEL_VERSION2,
        MODEL_COMMENT_PREFIX,
        generateCode: generateCode2,
        formatValue,
        normalizeHex: normalizeHex2,
        stripModel: stripModel2,
        extractEmbeddedModel: extractEmbeddedModel2,
        stripEmbeddedModel: stripEmbeddedModel2,
        childrenOf: childrenOf2
      };
    }
  });

  // packages/gui-designer/src/main.js
  var import_widgets = __toESM(require_widgets());
  var import_codegen = __toESM(require_codegen());
  var STORAGE_KEY = "idyllium-gui-designer";
  var THEME_KEY = "idyllium-docs-theme";
  var CLIPBOARD_MARK = "idyllium-gui-designer-clipboard:";
  var WINDOW_TITLE_HEIGHT = 28;
  var MIN_SIZE = 8;
  var api = window.Idyllium;
  var $ = (id) => document.getElementById(id);
  var els = {
    palette: $("palette-groups"),
    scene: $("scene"),
    preview: $("preview"),
    overlay: $("overlay"),
    inline: $("inline-editor"),
    tree: $("tree"),
    inspector: $("inspector"),
    inspectorTitle: $("inspector-title"),
    code: $("code"),
    status: $("status"),
    undo: $("undo"),
    redo: $("redo"),
    newDesign: $("new-design"),
    gridToggle: $("grid-toggle"),
    gridSize: $("grid-size"),
    windowTheme: $("window-theme"),
    handlersToggle: $("handlers-toggle"),
    embedToggle: $("embed-model-toggle"),
    openIde: $("open-ide"),
    copyCode: $("copy-code"),
    downloadCode: $("download-code"),
    saveModel: $("save-model"),
    openModel: $("open-model"),
    openModelInput: $("open-model-input"),
    contextMenu: $("context-menu"),
    stagePane: $("stage-pane")
  };
  var model = null;
  var selectedId = null;
  var history = [];
  var future = [];
  var ui = { grid: true, gridSize: 5, handlers: false, embedModel: false };
  var previewTabs = {};
  var lastRects = /* @__PURE__ */ new Map();
  var contentRect = null;
  var frameReady = false;
  var runToken = 0;
  var runTimer = null;
  var memoryClipboard = null;
  var dragging = null;
  function newModel() {
    return {
      version: import_codegen.MODEL_VERSION,
      window: { name: "win", props: { title: "\u041E\u043A\u043D\u043E", width: 640, height: 420 } },
      widgets: []
    };
  }
  function widgetById(id) {
    return model.widgets.find((item) => item.id === id) || null;
  }
  function nextId() {
    return model.widgets.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  }
  function takenNames() {
    return [model.window.name, ...model.widgets.map((item) => item.name)];
  }
  function descendants(id) {
    const result = [];
    const walk = (parentId) => {
      for (const child of (0, import_codegen.childrenOf)(model, parentId)) {
        result.push(child);
        walk(child.id);
      }
    };
    walk(id);
    return result;
  }
  function isAncestor(maybeAncestorId, id) {
    let current = widgetById(id);
    while (current && current.parent !== null) {
      if (current.parent === maybeAncestorId) return true;
      current = widgetById(current.parent);
    }
    return false;
  }
  function snapshot() {
    return JSON.stringify((0, import_codegen.stripModel)(model));
  }
  function applyChange(mutate, { silent = false } = {}) {
    const before = snapshot();
    mutate();
    const after = snapshot();
    if (after !== before) {
      history.push(before);
      if (history.length > 200) history.shift();
      future = [];
    }
    refresh({ silent });
  }
  function undo() {
    if (history.length === 0) return;
    future.push(snapshot());
    model = JSON.parse(history.pop());
    if (selectedId !== null && !widgetById(selectedId)) selectedId = null;
    refresh();
  }
  function redo() {
    if (future.length === 0) return;
    history.push(snapshot());
    model = JSON.parse(future.pop());
    if (selectedId !== null && !widgetById(selectedId)) selectedId = null;
    refresh();
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: (0, import_codegen.stripModel)(model), ui, previewTabs }));
    } catch (error) {
    }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      const loaded = validateModel(saved.model);
      if (!loaded) return false;
      model = loaded;
      ui = { ...ui, ...saved.ui || {} };
      previewTabs = saved.previewTabs || {};
      return true;
    } catch (error) {
      return false;
    }
  }
  function validateModel(raw) {
    if (!raw || typeof raw !== "object" || !raw.window || !Array.isArray(raw.widgets)) return null;
    const result = { version: import_codegen.MODEL_VERSION, window: { name: "win", props: {} }, widgets: [] };
    if (typeof raw.window.name === "string" && !(0, import_widgets.nameProblem)(raw.window.name, [])) result.window.name = raw.window.name;
    result.window.props = cleanProps("Window", raw.window.props);
    const ids = /* @__PURE__ */ new Set();
    for (const item of raw.widgets) {
      if (!item || typeof item !== "object" || !import_widgets.WIDGETS[item.type] || typeof item.id !== "number" || ids.has(item.id)) continue;
      ids.add(item.id);
      const widget = {
        id: item.id,
        type: item.type,
        name: typeof item.name === "string" && !(0, import_widgets.nameProblem)(item.name, []) ? item.name : `${import_widgets.WIDGETS[item.type].defaultName}${item.id}`,
        parent: typeof item.parent === "number" ? item.parent : null,
        props: cleanProps(item.type, item.props)
      };
      if (typeof item.tabTitle === "string") widget.tabTitle = item.tabTitle;
      result.widgets.push(widget);
    }
    for (const widget of result.widgets) {
      if (widget.parent !== null && !ids.has(widget.parent)) widget.parent = null;
    }
    const names = /* @__PURE__ */ new Set();
    for (const widget of result.widgets) {
      if (names.has(widget.name) || widget.name === result.window.name) widget.name = (0, import_widgets.freeName)(import_widgets.WIDGETS[widget.type].defaultName, [...names, result.window.name]);
      names.add(widget.name);
    }
    return result;
  }
  function cleanProps(type, props) {
    const result = {};
    if (!props || typeof props !== "object") return result;
    for (const [name, value] of Object.entries(props)) {
      const prop = (0, import_widgets.propertyOf)(type, name);
      if (!prop || value === null || value === void 0 || value === "") continue;
      if ((prop.kind === "int" || prop.kind === "float") && !Number.isFinite(Number(value))) continue;
      if (prop.kind === "enum" && !prop.values.includes(value)) continue;
      result[name] = prop.kind === "bool" ? Boolean(value) : prop.kind === "int" ? Math.round(Number(value)) : prop.kind === "float" ? Number(value) : prop.kind === "color" ? (0, import_codegen.normalizeHex)(value) : String(value);
    }
    return result;
  }
  function applyTheme(light) {
    document.body.classList.toggle("light-theme", light);
    const toggle = $("theme-toggle");
    if (toggle) {
      const hint = light ? "\u0422\u0451\u043C\u043D\u0430\u044F \u0442\u0435\u043C\u0430" : "\u0421\u0432\u0435\u0442\u043B\u0430\u044F \u0442\u0435\u043C\u0430";
      toggle.title = hint;
      toggle.setAttribute("aria-label", hint);
    }
    postToPreview({ type: "theme", theme: light ? "light" : "dark" });
  }
  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (error) {
    }
    applyTheme(saved === "light");
    const toggle = $("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const next = document.body.classList.contains("light-theme") ? "dark" : "light";
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch (error) {
        }
        applyTheme(next === "light");
      });
    }
  }
  function postToPreview(message) {
    if (!els.preview.contentWindow) return;
    els.preview.contentWindow.postMessage(message, "*");
  }
  function previewDocument() {
    try {
      return els.preview.contentDocument || null;
    } catch (error) {
      return null;
    }
  }
  function currentCode(forPreview) {
    return (0, import_codegen.generateCode)(model, forPreview ? { handlers: false, previewTabs } : { handlers: ui.handlers, embedModel: ui.embedModel });
  }
  function scheduleRun(delay = 60) {
    if (runTimer) clearTimeout(runTimer);
    runTimer = setTimeout(() => {
      runTimer = null;
      void runPreview();
    }, delay);
  }
  async function runPreview() {
    if (!api || typeof api.runIdylliumInBrowser !== "function") {
      setStatus("\u042F\u0434\u0440\u043E Idyllium \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u043E\u0441\u044C \u2014 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D", true);
      return;
    }
    const token = ++runToken;
    const code = currentCode(true);
    let result;
    try {
      result = await api.runIdylliumInBrowser({ entryFile: "main.idyl", files: { "main.idyl": code } });
    } catch (error) {
      if (token !== runToken) return;
      setStatus(`\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043D\u0435 \u0443\u0434\u0430\u043B\u0441\u044F: ${error instanceof Error ? error.message : String(error)}`, true);
      return;
    }
    if (token !== runToken) return;
    if (!result.compilation.success) {
      setStatus(`\u041E\u0448\u0438\u0431\u043A\u0430 \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u043A\u043E\u0434\u0430 \u2014 \u0441\u043E\u043E\u0431\u0449\u0438\u0442\u0435 \u0430\u0432\u0442\u043E\u0440\u0443: ${String(result.compilation.diagnosticsText || "").split("\n")[0]}`, true);
      return;
    }
    if (result.runtimeError) {
      setStatus(`\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043C\u0430\u043A\u0435\u0442\u0430 \u0443\u043F\u0430\u043B\u0430: ${result.runtimeError}`, true);
      return;
    }
    postToPreview({
      type: "snapshot",
      generation: 1,
      audio: [],
      windows: result.windows,
      canvases: [],
      modals: [],
      output: ""
    });
    const lineCount = code.split("\n").length - 1;
    setStatus(`\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043C\u0430\u043A\u0435\u0442\u0430 \u0441\u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0438 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430: ${lineCount} \u0441\u0442\u0440\u043E\u043A, \u0432\u0438\u0434\u0436\u0435\u0442\u043E\u0432: ${model.widgets.length}`);
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  }
  function setStatus(text, isError = false) {
    els.status.textContent = text;
    els.status.classList.toggle("is-error", isError);
  }
  function widgetElements(container) {
    return Array.from(container.children).filter((el) => el.nodeType === 1 && el.style && el.style.left !== "");
  }
  function syncOverlay() {
    const doc = previewDocument();
    const rects = /* @__PURE__ */ new Map();
    contentRect = null;
    if (doc) {
      const frameBox = els.preview.getBoundingClientRect();
      const sceneBox = els.scene.getBoundingClientRect();
      const toScene = (box) => ({
        left: box.left + frameBox.left - sceneBox.left,
        top: box.top + frameBox.top - sceneBox.top,
        width: box.width,
        height: box.height
      });
      const content = doc.querySelector(".window > .content");
      if (content) {
        contentRect = toScene(content.getBoundingClientRect());
        const matchChildren = (container, parentId) => {
          const items = (0, import_codegen.childrenOf)(model, parentId);
          const elements = widgetElements(container);
          items.forEach((item, index) => {
            const el = elements[index];
            if (!el) return;
            rects.set(item.id, toScene(el.getBoundingClientRect()));
            const def = (0, import_widgets.widgetDefinition)(item.type);
            if (def.container === "children") matchChildren(el, item.id);
            if (def.container === "tabs") {
              const pages = (0, import_codegen.childrenOf)(model, item.id);
              const shown = Math.min(Math.max(previewTabs[item.id] || 0, 0), Math.max(pages.length - 1, 0));
              const pageHost = el.querySelector(".page");
              const pageElement = pageHost ? widgetElements(pageHost)[0] : null;
              const page = pages[shown];
              if (page && pageElement) {
                rects.set(page.id, toScene(pageElement.getBoundingClientRect()));
                matchChildren(pageElement, page.id);
              }
            }
          });
        };
        matchChildren(content, null);
      }
      const wanted = Math.max(320, doc.documentElement.scrollHeight);
      if (Math.abs(els.preview.offsetHeight - wanted) > 2) {
        els.preview.style.height = `${wanted}px`;
        requestAnimationFrame(syncOverlay);
        return;
      }
    }
    lastRects = rects;
    renderOverlay();
  }
  function rectOf(id) {
    return lastRects.get(id) || null;
  }
  function containerAt(sceneX, sceneY, excludeId = null) {
    let best = null;
    for (const item of model.widgets) {
      const def = (0, import_widgets.widgetDefinition)(item.type);
      if (def.container !== "children") continue;
      if (excludeId !== null && (item.id === excludeId || isAncestor(excludeId, item.id))) continue;
      const rect = rectOf(item.id);
      if (!rect || sceneX < rect.left || sceneY < rect.top || sceneX > rect.left + rect.width || sceneY > rect.top + rect.height) continue;
      if (!best || isAncestor(best.id, item.id)) best = item;
    }
    return best ? best.id : null;
  }
  function containerOrigin(containerId) {
    if (containerId === null) return contentRect ? { left: contentRect.left, top: contentRect.top } : { left: 0, top: WINDOW_TITLE_HEIGHT };
    const rect = rectOf(containerId);
    if (!rect) return { left: 0, top: 0 };
    const item = widgetById(containerId);
    const border = item && item.props.border_width !== void 0 ? Number(item.props.border_width) : 1;
    return { left: rect.left + border, top: rect.top + border };
  }
  function snap(value) {
    if (!ui.grid) return Math.round(value);
    return Math.round(value / ui.gridSize) * ui.gridSize;
  }
  function renderOverlay() {
    const overlay = els.overlay;
    overlay.replaceChildren();
    if (contentRect) {
      if (ui.grid) {
        const grid = document.createElement("div");
        grid.className = "overlay-grid";
        const step = Math.max(ui.gridSize, 20);
        grid.style.left = `${contentRect.left}px`;
        grid.style.top = `${contentRect.top}px`;
        grid.style.width = `${contentRect.width}px`;
        grid.style.height = `${contentRect.height}px`;
        grid.style.backgroundSize = `${step}px ${step}px`;
        overlay.appendChild(grid);
      }
      const windowBox = document.createElement("div");
      windowBox.className = "overlay-window";
      windowBox.dataset.container = "window";
      windowBox.style.left = `${contentRect.left}px`;
      windowBox.style.top = `${contentRect.top}px`;
      windowBox.style.width = `${contentRect.width}px`;
      windowBox.style.height = `${contentRect.height}px`;
      overlay.appendChild(windowBox);
    }
    const ordered = [...model.widgets].sort((a, b) => depthOf(a) - depthOf(b));
    for (const item of ordered) {
      const rect = rectOf(item.id);
      if (!rect) continue;
      const box = document.createElement("div");
      box.className = "overlay-widget";
      box.dataset.id = String(item.id);
      if (item.id === selectedId) box.classList.add("is-selected");
      if (item.props.visible === false) box.classList.add("is-hidden");
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.title = `${item.name}: gui.${item.type}`;
      overlay.appendChild(box);
      if (item.id === selectedId) {
        for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
          const knob = document.createElement("div");
          knob.className = "overlay-handle";
          knob.dataset.handle = handle;
          knob.dataset.id = String(item.id);
          const x = handle.includes("w") ? 0 : handle.includes("e") ? rect.width : rect.width / 2;
          const y = handle.includes("n") ? 0 : handle.includes("s") ? rect.height : rect.height / 2;
          knob.style.left = `${rect.left + x}px`;
          knob.style.top = `${rect.top + y}px`;
          overlay.appendChild(knob);
        }
        const label = document.createElement("div");
        label.className = "overlay-label";
        label.textContent = `${item.name} \xB7 ${Math.round(item.props.x || 0)}, ${Math.round(item.props.y || 0)} \xB7 ${Math.round(rect.width)}\xD7${Math.round(rect.height)}`;
        label.style.left = `${rect.left}px`;
        label.style.top = `${rect.top - 20}px`;
        overlay.appendChild(label);
      }
    }
  }
  function depthOf(item) {
    let depth = 0;
    let current = item;
    while (current && current.parent !== null) {
      depth++;
      current = widgetById(current.parent);
    }
    return depth;
  }
  function capturePointer(event) {
    try {
      els.overlay.setPointerCapture(event.pointerId);
    } catch (error) {
    }
  }
  function scenePoint(event) {
    const box = els.scene.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  function sizeOf(item) {
    const def = (0, import_widgets.widgetDefinition)(item.type);
    return {
      width: item.props.width !== void 0 ? Number(item.props.width) : def.size.width,
      height: item.props.height !== void 0 ? Number(item.props.height) : def.size.height
    };
  }
  els.overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    hideContextMenu();
    finishInlineEdit(true);
    const target = event.target instanceof HTMLElement ? event.target : null;
    const point = scenePoint(event);
    if (target && target.classList.contains("overlay-handle")) {
      const id = Number(target.dataset.id);
      const item = widgetById(id);
      if (!item) return;
      const size = sizeOf(item);
      dragging = {
        kind: "resize",
        id,
        handle: target.dataset.handle,
        start: point,
        origin: { x: Number(item.props.x || 0), y: Number(item.props.y || 0), width: size.width, height: size.height },
        before: snapshot(),
        moved: false
      };
      capturePointer(event);
      event.preventDefault();
      return;
    }
    if (target && target.classList.contains("overlay-widget")) {
      const id = Number(target.dataset.id);
      const item = widgetById(id);
      if (!item) return;
      if (selectedId !== id) {
        selectedId = id;
        renderTree();
        renderInspector();
        renderOverlay();
      }
      dragging = {
        kind: "move",
        id,
        start: point,
        origin: { x: Number(item.props.x || 0), y: Number(item.props.y || 0) },
        before: snapshot(),
        moved: false,
        rect: rectOf(id)
      };
      capturePointer(event);
      event.preventDefault();
      return;
    }
    if (selectedId !== null) {
      selectedId = null;
      renderTree();
      renderInspector();
      renderOverlay();
    }
    els.overlay.focus();
  });
  els.overlay.addEventListener("pointermove", (event) => {
    if (!dragging || dragging.kind === "place") return;
    const point = scenePoint(event);
    const dx = point.x - dragging.start.x;
    const dy = point.y - dragging.start.y;
    if (!dragging.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    dragging.moved = true;
    const item = widgetById(dragging.id);
    if (!item) return;
    if (dragging.kind === "move") {
      let nx = dragging.origin.x + dx;
      let ny = dragging.origin.y + dy;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) ny = dragging.origin.y;
        else nx = dragging.origin.x;
      }
      item.props.x = Math.max(0, snap(nx));
      item.props.y = Math.max(0, snap(ny));
      const target = containerAt(point.x, point.y, item.id);
      for (const box of els.overlay.querySelectorAll(".is-drop-target")) box.classList.remove("is-drop-target");
      const targetBox = target === null ? els.overlay.querySelector(".overlay-window") : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
      if (targetBox && target !== item.parent) targetBox.classList.add("is-drop-target");
    } else {
      const o = dragging.origin;
      let { x, y, width, height } = o;
      const h = dragging.handle;
      if (h.includes("e")) width = Math.max(MIN_SIZE, snap(o.width + dx));
      if (h.includes("s")) height = Math.max(MIN_SIZE, snap(o.height + dy));
      if (h.includes("w")) {
        const nx = Math.min(snap(o.x + dx), o.x + o.width - MIN_SIZE);
        width = o.width + (o.x - nx);
        x = nx;
      }
      if (h.includes("n")) {
        const ny = Math.min(snap(o.y + dy), o.y + o.height - MIN_SIZE);
        height = o.height + (o.y - ny);
        y = ny;
      }
      item.props.x = Math.max(0, x);
      item.props.y = Math.max(0, y);
      item.props.width = width;
      item.props.height = height;
    }
    moveOverlayBox(item);
    renderCode();
    scheduleRun(60);
  });
  function moveOverlayBox(item) {
    const rect = rectOf(item.id);
    const origin = containerOrigin(item.parent);
    const size = sizeOf(item);
    const next = { left: origin.left + Number(item.props.x || 0), top: origin.top + Number(item.props.y || 0), width: size.width, height: size.height };
    if (!rect) return;
    lastRects.set(item.id, next);
    for (const child of descendants(item.id)) {
      const childRect = rectOf(child.id);
      if (childRect) lastRects.set(child.id, { ...childRect, left: childRect.left + (next.left - rect.left), top: childRect.top + (next.top - rect.top) });
    }
    renderOverlay();
  }
  function finishDrag(event) {
    if (!dragging || dragging.kind === "place") return;
    const drag = dragging;
    dragging = null;
    for (const box of els.overlay.querySelectorAll(".is-drop-target")) box.classList.remove("is-drop-target");
    if (!drag.moved) return;
    const item = widgetById(drag.id);
    if (item && drag.kind === "move") {
      const point = scenePoint(event);
      const target = containerAt(point.x, point.y, item.id);
      if (target !== item.parent && !(target !== null && widgetById(target).parent === item.id)) {
        const rect = rectOf(item.id);
        const origin = containerOrigin(target);
        item.parent = target;
        item.props.x = Math.max(0, snap(rect.left - origin.left));
        item.props.y = Math.max(0, snap(rect.top - origin.top));
        model.widgets = [...model.widgets.filter((other) => other.id !== item.id), item];
      }
    }
    const after = snapshot();
    if (after !== drag.before) {
      history.push(drag.before);
      future = [];
    }
    refresh();
  }
  els.overlay.addEventListener("pointerup", finishDrag);
  els.overlay.addEventListener("pointercancel", finishDrag);
  els.overlay.addEventListener("dblclick", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".overlay-widget") : null;
    if (!target) return;
    const item = widgetById(Number(target.dataset.id));
    if (!item) return;
    const textProp = ["text", "title"].find((name) => (0, import_widgets.propertyOf)(item.type, name));
    if (!textProp) return;
    startInlineEdit(item, textProp);
  });
  var inlineEdit = null;
  function startInlineEdit(item, propName) {
    const rect = rectOf(item.id);
    if (!rect) return;
    inlineEdit = { id: item.id, prop: propName };
    const input = els.inline;
    input.hidden = false;
    input.value = item.props[propName] !== void 0 ? String(item.props[propName]) : "";
    input.style.left = `${rect.left}px`;
    input.style.top = `${rect.top}px`;
    input.style.width = `${Math.max(rect.width, 80)}px`;
    input.style.height = `${Math.max(rect.height, 24)}px`;
    input.focus();
    input.select();
  }
  function finishInlineEdit(commit) {
    if (!inlineEdit) return;
    const edit = inlineEdit;
    inlineEdit = null;
    els.inline.hidden = true;
    if (!commit) return;
    const value = els.inline.value;
    applyChange(() => {
      const item = widgetById(edit.id);
      if (!item) return;
      if (value === "") delete item.props[edit.prop];
      else item.props[edit.prop] = value;
    });
  }
  els.inline.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishInlineEdit(true);
      els.overlay.focus();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finishInlineEdit(false);
      els.overlay.focus();
    }
  });
  els.inline.addEventListener("blur", () => finishInlineEdit(true));
  function renderPalette() {
    els.palette.replaceChildren();
    for (const group of import_widgets.PALETTE_GROUPS) {
      const title = document.createElement("div");
      title.className = "palette-group-title";
      title.textContent = group.title;
      els.palette.appendChild(title);
      for (const type of group.types) {
        const def = import_widgets.WIDGETS[type];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "palette-item";
        button.dataset.type = type;
        button.title = def.hint ? `gui.${type} \u2014 ${def.hint}` : `gui.${type}`;
        const icon = document.createElement("span");
        icon.className = "palette-icon";
        const label = document.createElement("span");
        label.textContent = def.label;
        const code = document.createElement("small");
        code.textContent = type;
        button.append(icon, label, code);
        button.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          startPlacing(type, event);
        });
        els.palette.appendChild(button);
      }
    }
  }
  var ghost = null;
  function startPlacing(type, event) {
    hideContextMenu();
    dragging = { kind: "place", type, startX: event.clientX, startY: event.clientY, moved: false };
    const onMove = (move) => {
      if (!dragging || dragging.kind !== "place") return;
      if (!dragging.moved && Math.hypot(move.clientX - dragging.startX, move.clientY - dragging.startY) < 4) return;
      dragging.moved = true;
      if (!ghost) {
        ghost = document.createElement("div");
        ghost.className = "palette-ghost";
        ghost.textContent = import_widgets.WIDGETS[type].label;
        document.body.appendChild(ghost);
      }
      ghost.style.left = `${move.clientX + 12}px`;
      ghost.style.top = `${move.clientY + 12}px`;
      const point = scenePointFromClient(move.clientX, move.clientY);
      for (const box of els.overlay.querySelectorAll(".is-drop-target")) box.classList.remove("is-drop-target");
      if (point) {
        const target = containerAt(point.x, point.y);
        const targetBox = target === null ? els.overlay.querySelector(".overlay-window") : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
        if (targetBox) targetBox.classList.add("is-drop-target");
      }
    };
    const onUp = (up) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      for (const box of els.overlay.querySelectorAll(".is-drop-target")) box.classList.remove("is-drop-target");
      const wasMoved = dragging && dragging.moved;
      dragging = null;
      const point = scenePointFromClient(up.clientX, up.clientY);
      if (wasMoved) {
        if (point && insideWindow(point)) addWidget(type, point);
        return;
      }
      addWidget(type, null);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }
  function scenePointFromClient(clientX, clientY) {
    const box = els.scene.getBoundingClientRect();
    if (clientX < box.left || clientY < box.top || clientX > box.right || clientY > box.bottom) return null;
    return { x: clientX - box.left, y: clientY - box.top };
  }
  function insideWindow(point) {
    return contentRect && point.x >= contentRect.left && point.y >= contentRect.top && point.x <= contentRect.left + contentRect.width && point.y <= contentRect.top + contentRect.height;
  }
  function addWidget(type, point) {
    const def = (0, import_widgets.widgetDefinition)(type);
    applyChange(() => {
      const id = nextId();
      const name = (0, import_widgets.freeName)(def.defaultName, takenNames());
      const item = { id, type, name, parent: null, props: {} };
      let parent = null;
      let x;
      let y;
      if (point) {
        parent = containerAt(point.x, point.y);
        const origin = containerOrigin(parent);
        x = snap(point.x - origin.left - def.size.width / 2);
        y = snap(point.y - origin.top - def.size.height / 2);
      } else {
        const top = (0, import_codegen.childrenOf)(model, null);
        const last = top[top.length - 1];
        x = 20;
        y = last ? snap(Number(last.props.y || 0) + sizeOf(last).height + 12) : 20;
      }
      item.parent = parent;
      item.props.x = Math.max(0, x);
      item.props.y = Math.max(0, y);
      for (const prop of def.props) {
        if (prop.initial !== void 0) item.props[prop.name] = prop.initial;
      }
      model.widgets.push(item);
      if (def.container === "tabs") {
        addTabPage(item, "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 1");
        addTabPage(item, "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 2");
        previewTabs[item.id] = 0;
      }
      selectedId = id;
    });
  }
  function addTabPage(tabs, title) {
    const id = nextId();
    const size = sizeOf(tabs);
    const page = {
      id,
      type: import_widgets.TAB_PAGE_TYPE,
      name: (0, import_widgets.freeName)("page", takenNames()),
      parent: tabs.id,
      props: { x: 8, y: 8, width: Math.max(MIN_SIZE, size.width - 16), height: Math.max(MIN_SIZE, size.height - 50) },
      tabTitle: title
    };
    model.widgets.push(page);
    return page;
  }
  function renderTree() {
    els.tree.replaceChildren();
    const windowRow = treeRow({ label: `${model.window.name}: gui.Window`, name: model.window.name, type: "Window", id: null, depth: 0 });
    els.tree.appendChild(windowRow);
    const walk = (parentId, depth) => {
      for (const item of (0, import_codegen.childrenOf)(model, parentId)) {
        const row = treeRow({ item, depth });
        els.tree.appendChild(row);
        walk(item.id, depth + 1);
      }
    };
    walk(null, 1);
  }
  function treeRow({ item, depth, id, name, type }) {
    const row = document.createElement("div");
    row.className = "tree-row";
    row.setAttribute("role", "treeitem");
    const widgetId = item ? item.id : id;
    row.dataset.id = widgetId === null ? "" : String(widgetId);
    row.style.paddingLeft = `${8 + depth * 16}px`;
    if (widgetId === selectedId) row.classList.add("is-selected");
    if (item && item.props.visible === false) row.classList.add("is-hidden");
    const nameEl = document.createElement("span");
    nameEl.className = "tree-name";
    nameEl.textContent = item ? item.name : name;
    const typeEl = document.createElement("span");
    typeEl.className = "tree-type";
    typeEl.textContent = item ? item.tabTitle !== void 0 ? `\u0432\u043A\u043B\u0430\u0434\u043A\u0430 \xAB${item.tabTitle}\xBB` : `gui.${item.type}` : `gui.${type}`;
    row.append(nameEl, typeEl);
    row.addEventListener("click", () => {
      selectedId = widgetId;
      if (item && item.tabTitle !== void 0) {
        const pages = (0, import_codegen.childrenOf)(model, item.parent);
        previewTabs[item.parent] = pages.indexOf(item);
        persist();
        scheduleRun(0);
      }
      renderTree();
      renderInspector();
      renderOverlay();
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      selectedId = widgetId;
      renderTree();
      renderInspector();
      renderOverlay();
      if (item) showContextMenu(event.clientX, event.clientY, item);
    });
    return row;
  }
  function showContextMenu(x, y, item) {
    const menu = els.contextMenu;
    menu.replaceChildren();
    const add = (label, action, disabled = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", () => {
        hideContextMenu();
        action();
      });
      menu.appendChild(button);
    };
    const separator = () => {
      const line = document.createElement("div");
      line.className = "context-separator";
      menu.appendChild(line);
    };
    const isPage = item.tabTitle !== void 0;
    add("\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C", () => focusNameField());
    if (!isPage) add("\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C (Ctrl+D)", () => duplicateWidget(item.id));
    if ((0, import_widgets.widgetDefinition)(item.type).container === "tabs") add("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u043A\u043B\u0430\u0434\u043A\u0443", () => applyChange(() => {
      addTabPage(item, `\u0412\u043A\u043B\u0430\u0434\u043A\u0430 ${(0, import_codegen.childrenOf)(model, item.id).length + 1}`);
    }));
    separator();
    const siblings = (0, import_codegen.childrenOf)(model, item.parent);
    const index = siblings.indexOf(item);
    add(isPage ? "\u0412\u043A\u043B\u0430\u0434\u043A\u0443 \u043B\u0435\u0432\u0435\u0435" : "\u0420\u0430\u043D\u044C\u0448\u0435 \u0432 \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F (\u043D\u0438\u0436\u0435 \u043F\u043E \u0441\u043B\u043E\u044E)", () => reorder(item.id, -1), index <= 0);
    add(isPage ? "\u0412\u043A\u043B\u0430\u0434\u043A\u0443 \u043F\u0440\u0430\u0432\u0435\u0435" : "\u041F\u043E\u0437\u0436\u0435 \u0432 \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F (\u0432\u044B\u0448\u0435 \u043F\u043E \u0441\u043B\u043E\u044E)", () => reorder(item.id, 1), index >= siblings.length - 1);
    separator();
    add("\u0423\u0434\u0430\u043B\u0438\u0442\u044C (Delete)", () => deleteWidget(item.id));
    menu.hidden = false;
    const margin = 8;
    menu.style.left = `${Math.min(x, window.innerWidth - menu.offsetWidth - margin)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - margin)}px`;
  }
  function hideContextMenu() {
    els.contextMenu.hidden = true;
  }
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("#context-menu")) hideContextMenu();
  });
  els.overlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target.closest(".overlay-widget") : null;
    if (!target) return;
    const item = widgetById(Number(target.dataset.id));
    if (!item) return;
    selectedId = item.id;
    renderTree();
    renderInspector();
    renderOverlay();
    showContextMenu(event.clientX, event.clientY, item);
  });
  function reorder(id, direction) {
    applyChange(() => {
      const item = widgetById(id);
      if (!item) return;
      const siblings = (0, import_codegen.childrenOf)(model, item.parent);
      const index = siblings.indexOf(item);
      const other = siblings[index + direction];
      if (!other) return;
      const a = model.widgets.indexOf(item);
      const b = model.widgets.indexOf(other);
      model.widgets[a] = other;
      model.widgets[b] = item;
      if (item.tabTitle !== void 0) previewTabs[item.parent] = index + direction;
    });
  }
  function deleteWidget(id) {
    applyChange(() => {
      const item = widgetById(id);
      if (!item) return;
      if (item.tabTitle !== void 0) {
        const pages = (0, import_codegen.childrenOf)(model, item.parent);
        if (pages.length <= 1) {
          setStatus("\u0423 \u0432\u043A\u043B\u0430\u0434\u043E\u043A \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430", true);
          return;
        }
        previewTabs[item.parent] = 0;
      }
      const doomed = /* @__PURE__ */ new Set([id, ...descendants(id).map((child) => child.id)]);
      model.widgets = model.widgets.filter((other) => !doomed.has(other.id));
      if (selectedId !== null && doomed.has(selectedId)) selectedId = item.parent;
    });
  }
  function duplicateWidget(id) {
    const item = widgetById(id);
    if (!item || item.tabTitle !== void 0) return;
    const payload = copyPayload(item);
    pastePayload(payload, { offset: 10 });
  }
  function copyPayload(item) {
    return { root: item.id, widgets: [item, ...descendants(item.id)].map((widget) => JSON.parse(JSON.stringify(widget))) };
  }
  function pastePayload(payload, { offset = 10 } = {}) {
    if (!payload || !Array.isArray(payload.widgets) || payload.widgets.length === 0) return;
    applyChange(() => {
      const idMap = /* @__PURE__ */ new Map();
      const taken = takenNames();
      const rootSource = payload.widgets.find((widget) => widget.id === payload.root) || payload.widgets[0];
      const rootParent = rootSource.parent !== null && widgetById(rootSource.parent) ? rootSource.parent : null;
      for (const source of payload.widgets) {
        if (!import_widgets.WIDGETS[source.type]) continue;
        const id = nextId() + idMap.size;
        idMap.set(source.id, id);
      }
      for (const source of payload.widgets) {
        if (!idMap.has(source.id)) continue;
        const copy = {
          id: idMap.get(source.id),
          type: source.type,
          name: (0, import_widgets.freeName)(import_widgets.WIDGETS[source.type].defaultName, taken),
          parent: source.id === rootSource.id ? rootParent : idMap.get(source.parent) ?? rootParent,
          props: cleanProps(source.type, source.props)
        };
        if (source.tabTitle !== void 0) copy.tabTitle = String(source.tabTitle);
        if (source.id === rootSource.id) {
          copy.props.x = Number(copy.props.x || 0) + offset;
          copy.props.y = Number(copy.props.y || 0) + offset;
        }
        taken.push(copy.name);
        model.widgets.push(copy);
        if (source.id === rootSource.id) selectedId = copy.id;
      }
    });
  }
  async function copySelection() {
    const item = selectedId !== null ? widgetById(selectedId) : null;
    if (!item || item.tabTitle !== void 0) return;
    memoryClipboard = copyPayload(item);
    try {
      await navigator.clipboard.writeText(CLIPBOARD_MARK + JSON.stringify(memoryClipboard));
    } catch (error) {
    }
    setStatus(`\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E: ${item.name}`);
  }
  document.addEventListener("paste", (event) => {
    if (isTextField(document.activeElement)) return;
    const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    if (text.startsWith(CLIPBOARD_MARK)) {
      try {
        pastePayload(JSON.parse(text.slice(CLIPBOARD_MARK.length)));
        event.preventDefault();
        return;
      } catch (error) {
      }
    }
    if (memoryClipboard) {
      pastePayload(memoryClipboard);
      event.preventDefault();
    }
  });
  function isTextField(element) {
    return element instanceof Element && element.matches('input, textarea, select, [contenteditable="true"]');
  }
  function renderInspector() {
    const container = els.inspector;
    container.replaceChildren();
    const item = selectedId !== null ? widgetById(selectedId) : null;
    const type = item ? item.type : "Window";
    const props = item ? item.props : model.window.props;
    const def = item ? (0, import_widgets.widgetDefinition)(item.type) : null;
    els.inspectorTitle.textContent = item ? `${item.name}: gui.${item.type}` : `${model.window.name}: gui.Window`;
    const nameGroup = groupBox("\u0418\u043C\u044F");
    const nameField = document.createElement("div");
    nameField.className = "field is-explicit";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "\u0438\u043C\u044F \u0432 \u043A\u043E\u0434\u0435";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "name-field";
    nameInput.value = item ? item.name : model.window.name;
    nameInput.spellcheck = false;
    const nameNote = document.createElement("div");
    nameNote.className = "field-note";
    nameNote.hidden = true;
    nameInput.addEventListener("input", () => {
      const others = takenNames().filter((name) => name !== (item ? item.name : model.window.name));
      const problem = (0, import_widgets.nameProblem)(nameInput.value.trim(), others);
      nameInput.classList.toggle("is-invalid", Boolean(problem));
      nameNote.hidden = !problem;
      nameNote.textContent = problem || "";
    });
    const commitName = () => {
      const value = nameInput.value.trim();
      const others = takenNames().filter((name) => name !== (item ? item.name : model.window.name));
      if ((0, import_widgets.nameProblem)(value, others)) return;
      applyChange(() => {
        if (item) widgetById(item.id).name = value;
        else model.window.name = value;
      });
    };
    nameInput.addEventListener("change", commitName);
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitName();
      }
    });
    nameField.append(nameLabel, nameInput, document.createElement("span"));
    nameGroup.append(nameField, nameNote);
    container.appendChild(nameGroup);
    if (item && item.tabTitle !== void 0) {
      const tabGroup = groupBox("\u0412\u043A\u043B\u0430\u0434\u043A\u0430");
      tabGroup.appendChild(textField("\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0432\u043A\u043B\u0430\u0434\u043A\u0438", item.tabTitle, (value) => applyChange(() => {
        widgetById(item.id).tabTitle = value;
      })));
      container.appendChild(tabGroup);
    }
    if (def && def.container === "tabs") container.appendChild(tabsEditor(item));
    const catalogue = item ? def.props : import_widgets.WINDOW_PROPS;
    for (const [groupId, groupTitle] of import_widgets.PROPERTY_GROUPS) {
      const groupProps = catalogue.filter((prop) => prop.group === groupId);
      if (groupProps.length === 0) continue;
      const box = groupBox(groupTitle);
      for (const prop of groupProps) box.appendChild(propertyField(prop, props, (value) => setProperty(item, prop, value)));
      container.appendChild(box);
    }
    if (def && def.hint) {
      const note = document.createElement("p");
      note.className = "inspector-empty";
      note.textContent = def.hint;
      container.appendChild(note);
    }
    if (def && def.events.length > 0) {
      const note = document.createElement("p");
      note.className = "inspector-empty";
      note.textContent = `\u0421\u043E\u0431\u044B\u0442\u0438\u044F: ${def.events.map((event) => event.name).join(", ")} \u2014 \u043F\u0438\u0448\u0443\u0442\u0441\u044F \u0432 \u043A\u043E\u0434\u0435 (\u0433\u0430\u043B\u043E\u0447\u043A\u0430 \xAB\u0417\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u0432\xBB \u0434\u043E\u0431\u0430\u0432\u0438\u0442 \u043F\u0443\u0441\u0442\u044B\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438).`;
      container.appendChild(note);
    }
  }
  function groupBox(title) {
    const box = document.createElement("div");
    box.className = "inspector-group";
    const head = document.createElement("div");
    head.className = "inspector-group-title";
    head.textContent = title;
    box.appendChild(head);
    return box;
  }
  function textField(label, value, onCommit) {
    const field = document.createElement("div");
    field.className = "field is-explicit";
    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.addEventListener("change", () => onCommit(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onCommit(input.value);
      }
    });
    field.append(labelEl, input, document.createElement("span"));
    return field;
  }
  function propertyField(prop, props, onChange) {
    const field = document.createElement("div");
    field.className = "field";
    const explicit = props[prop.name] !== void 0 && props[prop.name] !== null && props[prop.name] !== "";
    if (explicit) field.classList.add("is-explicit");
    const label = document.createElement("label");
    label.title = prop.name;
    label.innerHTML = `${escapeHtml(prop.label)} <code>${escapeHtml(prop.name)}</code>`;
    let control;
    const placeholder = prop.default !== void 0 ? `\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E ${prop.default}` : "\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E";
    if (prop.kind === "bool") {
      const wrap = document.createElement("div");
      wrap.className = "field-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = explicit ? Boolean(props[prop.name]) : Boolean(prop.default);
      input.addEventListener("change", () => onChange(input.checked));
      const hint = document.createElement("span");
      hint.className = "tree-type";
      hint.textContent = explicit ? "" : placeholder;
      wrap.append(input, hint);
      control = wrap;
    } else if (prop.kind === "enum") {
      const select = document.createElement("select");
      const none = document.createElement("option");
      none.value = "";
      none.textContent = placeholder;
      select.appendChild(none);
      for (const value of prop.values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.value = explicit ? String(props[prop.name]) : "";
      select.addEventListener("change", () => onChange(select.value === "" ? null : select.value));
      control = select;
    } else if (prop.kind === "color") {
      const wrap = document.createElement("div");
      wrap.className = "field-color";
      const picker = document.createElement("input");
      picker.type = "color";
      picker.value = explicit ? (0, import_codegen.normalizeHex)(props[prop.name]) : "#808080";
      picker.title = explicit ? "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0446\u0432\u0435\u0442" : "\u0417\u0430\u0434\u0430\u0442\u044C \u0446\u0432\u0435\u0442";
      const hex = document.createElement("input");
      hex.type = "text";
      hex.placeholder = placeholder;
      hex.value = explicit ? (0, import_codegen.normalizeHex)(props[prop.name]) : "";
      hex.spellcheck = false;
      picker.addEventListener("input", () => {
        hex.value = picker.value;
      });
      picker.addEventListener("change", () => onChange(picker.value));
      const commitHex = () => {
        const value = hex.value.trim();
        if (value === "") {
          onChange(null);
          return;
        }
        if (!/^#?[0-9a-fA-F]{6}$/u.test(value)) {
          hex.classList.add("is-invalid");
          return;
        }
        onChange((0, import_codegen.normalizeHex)(value));
      };
      hex.addEventListener("change", commitHex);
      hex.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitHex();
        }
      });
      wrap.append(picker, hex);
      control = wrap;
    } else {
      const input = document.createElement("input");
      input.type = prop.kind === "int" || prop.kind === "float" ? "number" : "text";
      if (prop.kind === "int") input.step = "1";
      if (prop.kind === "float") input.step = "any";
      if (prop.min !== void 0) input.min = String(prop.min);
      if (prop.max !== void 0) input.max = String(prop.max);
      input.placeholder = placeholder;
      input.value = explicit ? String(props[prop.name]) : "";
      input.spellcheck = false;
      const commit = () => {
        const raw = input.value;
        if (raw.trim() === "") {
          onChange(null);
          return;
        }
        if (prop.kind === "int" || prop.kind === "float") {
          const number = Number(raw);
          if (!Number.isFinite(number)) {
            input.classList.add("is-invalid");
            return;
          }
          let value = prop.kind === "int" ? Math.round(number) : number;
          if (prop.min !== void 0) value = Math.max(prop.min, value);
          if (prop.max !== void 0) value = Math.min(prop.max, value);
          onChange(value);
          return;
        }
        onChange(raw);
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      });
      control = input;
    }
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "field-reset";
    reset.title = "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E (\u0441\u0442\u0440\u043E\u043A\u0430 \u0443\u0439\u0434\u0451\u0442 \u0438\u0437 \u043A\u043E\u0434\u0430)";
    reset.textContent = "\xD7";
    reset.addEventListener("click", () => onChange(null));
    field.append(label, control, reset);
    return field;
  }
  function setProperty(item, prop, value) {
    applyChange(() => {
      const target = item ? widgetById(item.id) : model.window;
      if (!target) return;
      if (value === null || value === void 0 || value === "") {
        delete target.props[prop.name];
        return;
      }
      if (prop.kind === "int") value = Math.round(Number(value));
      if (prop.kind === "float") value = Number(value);
      if (prop.kind === "bool") value = Boolean(value);
      if (prop.kind === "color") value = (0, import_codegen.normalizeHex)(value);
      target.props[prop.name] = value;
    });
  }
  function tabsEditor(tabs) {
    const box = groupBox("\u0412\u043A\u043B\u0430\u0434\u043A\u0438");
    const list = document.createElement("div");
    list.className = "tabs-editor";
    const pages = (0, import_codegen.childrenOf)(model, tabs.id);
    const shown = Math.min(Math.max(previewTabs[tabs.id] || 0, 0), Math.max(pages.length - 1, 0));
    pages.forEach((page, index) => {
      const row = document.createElement("div");
      row.className = "tabs-row";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "shown-tab";
      radio.checked = index === shown;
      radio.title = "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u044D\u0442\u0443 \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u043D\u0430 \u0441\u0446\u0435\u043D\u0435";
      radio.addEventListener("change", () => {
        previewTabs[tabs.id] = index;
        persist();
        scheduleRun(0);
        renderTree();
      });
      const title = document.createElement("input");
      title.type = "text";
      title.value = page.tabTitle || "";
      title.placeholder = "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0432\u043A\u043B\u0430\u0434\u043A\u0438";
      const commit = () => applyChange(() => {
        const target = widgetById(page.id);
        if (target) target.tabTitle = title.value;
      });
      title.addEventListener("change", commit);
      title.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tabs-remove";
      remove.textContent = "\xD7";
      remove.title = "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u044B\u043C";
      remove.disabled = pages.length <= 1;
      remove.addEventListener("click", () => deleteWidget(page.id));
      row.append(radio, title, remove);
      list.appendChild(row);
    });
    box.appendChild(list);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "tabs-add";
    add.textContent = "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u043A\u043B\u0430\u0434\u043A\u0443";
    add.addEventListener("click", () => applyChange(() => {
      const target = widgetById(tabs.id);
      if (!target) return;
      addTabPage(target, `\u0412\u043A\u043B\u0430\u0434\u043A\u0430 ${(0, import_codegen.childrenOf)(model, tabs.id).length + 1}`);
      previewTabs[tabs.id] = (0, import_codegen.childrenOf)(model, tabs.id).length - 1;
    }));
    box.appendChild(add);
    return box;
  }
  function focusNameField() {
    const input = $("name-field");
    if (input) {
      input.focus();
      input.select();
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderCode() {
    const code = currentCode(false);
    els.code.innerHTML = highlight(code);
  }
  function highlight(code) {
    const escaped = escapeHtml(code);
    return escaped.replace(/(\/\/[^\n]*)/gu, '<span class="cm">$1</span>').replace(/(&quot;(?:[^&]|&(?!quot;))*&quot;)/gu, '<span class="str">$1</span>').replace(/\b(use|main|void|function)\b/gu, '<span class="kw">$1</span>').replace(/\b(gui|colors)\.([A-Z][A-Za-z]*)\b/gu, '$1.<span class="ty">$2</span>').replace(/\.(add_child|add_tab|show|HEX)\(/gu, '.<span class="fn">$1</span>(').replace(/\b(\d+(?:\.\d+)?)\b(?![^<]*>)/gu, '<span class="num">$1</span>');
  }
  async function copyCode() {
    const code = currentCode(false);
    try {
      await navigator.clipboard.writeText(code);
      flash(els.copyCode, "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u2713");
    } catch (error) {
      flash(els.copyCode, "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u2014 \u0432\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u043A\u043E\u0434 \u0438 Ctrl+C");
      els.code.focus();
      const range = document.createRange();
      range.selectNodeContents(els.code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  function flash(button, text) {
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = text;
    setTimeout(() => {
      button.textContent = original;
    }, 1800);
  }
  function downloadCode() {
    const code = currentCode(false);
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "main.idyl";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
    flash(els.downloadCode, "\u0421\u043A\u0430\u0447\u0430\u043D\u043E \u2713");
  }
  function openInIde() {
    const share = api && api.share;
    if (!share || typeof share.encodeProjectLink !== "function") {
      setStatus("\u042F\u0434\u0440\u043E Idyllium \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u043E\u0441\u044C \u2014 \u0441\u043A\u043E\u043F\u0438\u0440\u0443\u0439\u0442\u0435 \u043A\u043E\u0434 \u0438 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0432 Web IDE \u0432\u0440\u0443\u0447\u043D\u0443\u044E", true);
      return;
    }
    const code = currentCode(false);
    const title = String(model.window.props.title || "\u041C\u0430\u043A\u0435\u0442 \u043E\u043A\u043D\u0430");
    let fragment;
    try {
      fragment = share.encodeProjectLink({
        name: `\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 GUI: ${title}`,
        from: "",
        idyllium: api.IDYLLIUM_VERSION || "",
        current: "main.idyl",
        files: [{ path: "main.idyl", text: code }],
        assets: []
      });
    } catch (error) {
      setStatus(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443: ${error instanceof Error ? error.message : String(error)}`, true);
      return;
    }
    const url = `${new URL("../", window.location.href).href}#${fragment}`;
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      setStatus("\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u043B \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u2014 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0432\u0441\u043F\u043B\u044B\u0432\u0430\u044E\u0449\u0438\u0435 \u043E\u043A\u043D\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u0430\u0439\u0442\u0430", true);
    }
  }
  function saveModelFile() {
    const text = `${JSON.stringify((0, import_codegen.stripModel)(model), null, 2)}
`;
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "gui-design.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
    flash(els.saveModel, "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u2713");
  }
  async function openModelFile(file) {
    const text = await file.text();
    let loaded = null;
    let note = "";
    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        loaded = validateModel(JSON.parse(text));
      } catch (error) {
        loaded = null;
      }
      if (!loaded) {
        setStatus(`\xAB${file.name}\xBB \u2014 \u043D\u0435 \u043C\u0430\u043A\u0435\u0442 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430`, true);
        return;
      }
    } else {
      let embedded = null;
      try {
        embedded = (0, import_codegen.extractEmbeddedModel)(text);
      } catch (error) {
        embedded = null;
      }
      if (!embedded) {
        setStatus(`\u0412 \xAB${file.name}\xBB \u043D\u0435\u0442 \u0441\u0442\u0440\u043E\u043A\u0438 \u043C\u0430\u043A\u0435\u0442\u0430 (// gui-designer: \u2026) \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0444\u0430\u0439\u043B, \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u043E\u043C \u0441 \u044D\u0442\u043E\u0439 \u0433\u0430\u043B\u043E\u0447\u043A\u043E\u0439`, true);
        return;
      }
      loaded = validateModel(embedded);
      if (!loaded) {
        setStatus(`\u0421\u0442\u0440\u043E\u043A\u0430 \u043C\u0430\u043A\u0435\u0442\u0430 \u0432 \xAB${file.name}\xBB \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0430`, true);
        return;
      }
      const regenerated = (0, import_codegen.generateCode)(loaded, { handlers: false });
      const regeneratedWithHandlers = (0, import_codegen.generateCode)(loaded, { handlers: true });
      const fileCode = (0, import_codegen.stripEmbeddedModel)(text);
      if (fileCode !== regenerated && fileCode !== regeneratedWithHandlers) {
        note = " \u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435: \u043A\u043E\u0434 \u0432 \u0444\u0430\u0439\u043B\u0435 \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u043E\u0442 \u043C\u0430\u043A\u0435\u0442\u0430 (\u0435\u0433\u043E \u043F\u0440\u0430\u0432\u0438\u043B\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E) \u2014 \u043F\u0440\u0430\u0432\u043A\u0438 \u043A\u043E\u0434\u0430 \u0432 \u043C\u0430\u043A\u0435\u0442 \u043D\u0435 \u043F\u043E\u043F\u0430\u043B\u0438.";
      }
    }
    applyChange(() => {
      model = loaded;
      selectedId = null;
      previewTabs = {};
    });
    setStatus(`\u041E\u0442\u043A\u0440\u044B\u0442 \u043C\u0430\u043A\u0435\u0442 \u0438\u0437 \xAB${file.name}\xBB: \u0432\u0438\u0434\u0436\u0435\u0442\u043E\u0432 ${model.widgets.length}.${note}`, note !== "");
  }
  function refresh({ silent = false } = {}) {
    els.undo.disabled = history.length === 0;
    els.redo.disabled = future.length === 0;
    renderTree();
    renderInspector();
    renderCode();
    renderOverlay();
    persist();
    if (!silent) scheduleRun(0);
  }
  document.addEventListener("keydown", (event) => {
    if (isTextField(document.activeElement) && document.activeElement !== els.overlay) {
      return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if (ctrl && (event.key.toLowerCase() === "y" || event.key.toLowerCase() === "z" && event.shiftKey)) {
      event.preventDefault();
      redo();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "c") {
      void copySelection();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "d") {
      event.preventDefault();
      if (selectedId !== null) duplicateWidget(selectedId);
      return;
    }
    if (event.key === "Escape") {
      selectedId = null;
      hideContextMenu();
      renderTree();
      renderInspector();
      renderOverlay();
      return;
    }
    if (selectedId === null) return;
    const item = widgetById(selectedId);
    if (!item) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteWidget(selectedId);
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      applyChange(() => {
        const target = widgetById(selectedId);
        target.props.x = Math.max(0, Number(target.props.x || 0) + dx);
        target.props.y = Math.max(0, Number(target.props.y || 0) + dy);
      });
    }
  });
  function initControls() {
    els.undo.addEventListener("click", undo);
    els.redo.addEventListener("click", redo);
    els.newDesign.addEventListener("click", () => {
      if (model.widgets.length > 0 && !window.confirm("\u041D\u0430\u0447\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043C\u0430\u043A\u0435\u0442? \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043E\u0442\u043C\u0435\u043D\u0430\u0445 (Ctrl+Z).")) return;
      applyChange(() => {
        model = newModel();
        selectedId = null;
        previewTabs = {};
      });
    });
    els.gridToggle.checked = ui.grid;
    els.gridSize.textContent = String(ui.gridSize);
    els.gridToggle.addEventListener("change", () => {
      ui.grid = els.gridToggle.checked;
      persist();
      renderOverlay();
    });
    for (const theme of import_widgets.WINDOW_THEMES) {
      const option = document.createElement("option");
      option.value = theme;
      option.textContent = theme;
      els.windowTheme.appendChild(option);
    }
    els.windowTheme.addEventListener("change", () => applyChange(() => {
      if (els.windowTheme.value === "default") delete model.window.props.theme;
      else model.window.props.theme = els.windowTheme.value;
    }));
    els.handlersToggle.checked = ui.handlers;
    els.handlersToggle.addEventListener("change", () => {
      ui.handlers = els.handlersToggle.checked;
      persist();
      renderCode();
    });
    els.embedToggle.checked = ui.embedModel;
    els.embedToggle.addEventListener("change", () => {
      ui.embedModel = els.embedToggle.checked;
      persist();
      renderCode();
    });
    els.openIde.addEventListener("click", openInIde);
    els.copyCode.addEventListener("click", () => {
      void copyCode();
    });
    els.downloadCode.addEventListener("click", downloadCode);
    els.saveModel.addEventListener("click", saveModelFile);
    els.openModel.addEventListener("click", () => els.openModelInput.click());
    els.openModelInput.addEventListener("change", () => {
      const file = els.openModelInput.files && els.openModelInput.files[0];
      els.openModelInput.value = "";
      if (file) void openModelFile(file);
    });
    const codePane = $("code-pane");
    const collapse = $("code-collapse");
    const applyCollapsed = () => {
      codePane.classList.toggle("is-collapsed", Boolean(ui.codeCollapsed));
      collapse.textContent = ui.codeCollapsed ? "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C";
      requestAnimationFrame(syncOverlay);
    };
    collapse.addEventListener("click", () => {
      ui.codeCollapsed = !ui.codeCollapsed;
      persist();
      applyCollapsed();
    });
    applyCollapsed();
    window.addEventListener("resize", () => syncOverlay());
    els.stagePane.addEventListener("scroll", () => renderOverlay());
  }
  function watchPreviewFrame() {
    const attach = () => {
      const doc = previewDocument();
      if (!doc || !doc.getElementById("stage")) return false;
      const toolbar = doc.querySelector(".toolbar");
      if (toolbar) toolbar.style.display = "none";
      const observer = new MutationObserver(() => requestAnimationFrame(syncOverlay));
      observer.observe(doc.getElementById("stage"), { childList: true, subtree: true, attributes: true });
      frameReady = true;
      applyTheme(document.body.classList.contains("light-theme"));
      scheduleRun(0);
      return true;
    };
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (data && data.type === "idylliumGuiEvent" && data.message && data.message.type === "rendererReady") {
        if (!frameReady) attach();
      }
    });
    els.preview.addEventListener("load", () => {
      if (!frameReady) attach();
    });
    if (!frameReady) attach();
  }
  function main() {
    if (!restore()) model = newModel();
    els.windowTheme.value = model.window.props.theme || "default";
    initTheme();
    renderPalette();
    initControls();
    watchPreviewFrame();
    refresh({ silent: true });
    setStatus("\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430\u2026");
  }
  main();
})();
