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

  // packages/icons/icon-names.json
  var require_icon_names = __commonJS({
    "packages/icons/icon-names.json"(exports, module) {
      module.exports = [
        "anchor",
        "archive",
        "arrow-down",
        "arrow-left",
        "arrow-right",
        "arrow-up",
        "autocomplete",
        "bell",
        "brush",
        "bulb",
        "check",
        "check-circle",
        "chevron-down",
        "chevron-left",
        "chevron-right",
        "chevron-up",
        "clock",
        "close",
        "comment",
        "copy",
        "cross",
        "cut",
        "download",
        "duplicate",
        "external",
        "eye",
        "eye-off",
        "eyedropper",
        "file",
        "file-archive",
        "file-audio",
        "file-code",
        "file-database",
        "file-font",
        "file-image",
        "file-json",
        "file-new",
        "file-text",
        "find",
        "fit",
        "folder",
        "folder-new",
        "folder-open",
        "font-size",
        "format",
        "grip",
        "image-paste",
        "info",
        "link",
        "lock",
        "loop",
        "menu",
        "minus",
        "moon",
        "more",
        "note",
        "open-file",
        "palette",
        "paste",
        "pause",
        "play",
        "play-window",
        "plus",
        "properties",
        "qr",
        "question",
        "redo",
        "refresh",
        "rename",
        "replace",
        "reset",
        "save",
        "search",
        "section-authors",
        "section-canvas",
        "section-console",
        "section-designer",
        "section-handouts",
        "section-json",
        "section-network",
        "section-oop",
        "section-projects",
        "section-recipes",
        "section-reference",
        "section-sqlite",
        "section-tasks",
        "section-turtle",
        "section-why",
        "section-widgets",
        "settings",
        "share",
        "star",
        "star-outline",
        "stop",
        "sun",
        "trash",
        "uncomment",
        "undo",
        "upload",
        "warning",
        "widget-BarChart",
        "widget-Button",
        "widget-Canvas",
        "widget-CheckBox",
        "widget-ComboBox",
        "widget-FloatSpinBox",
        "widget-Frame",
        "widget-ImageBox",
        "widget-Label",
        "widget-LineChart",
        "widget-LineEdit",
        "widget-PieChart",
        "widget-ProgressBar",
        "widget-RadioButton",
        "widget-Slider",
        "widget-SpinBox",
        "widget-TabWidget",
        "widget-Table",
        "widget-TextEdit",
        "zoom-in",
        "zoom-out"
      ];
    }
  });

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
      var WINDOW_THEMES = ["default", "idyllium", "dracula", "breeze", "oxygen"];
      var ICON_NAMES2 = require_icon_names();
      var PROPERTY_GROUPS2 = [
        ["geometry", "\u041F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u0440\u0430\u0437\u043C\u0435\u0440"],
        ["text", "\u0422\u0435\u043A\u0441\u0442"],
        ["values", "\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u044F"],
        ["colors", "\u0426\u0432\u0435\u0442\u0430"],
        ["behaviour", "\u041F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435"],
        ["style", "\u0421\u0442\u0438\u043B\u044C (IdySS)"]
      ];
      var GEOMETRY = [
        { name: "x", kind: "int", group: "geometry", label: "\u043E\u0442\u0441\u0442\u0443\u043F \u0441\u043B\u0435\u0432\u0430", default: 0 },
        { name: "y", kind: "int", group: "geometry", label: "\u043E\u0442\u0441\u0442\u0443\u043F \u0441\u0432\u0435\u0440\u0445\u0443", default: 0 },
        { name: "width", kind: "int", group: "geometry", label: "\u0448\u0438\u0440\u0438\u043D\u0430", min: 1 },
        { name: "height", kind: "int", group: "geometry", label: "\u0432\u044B\u0441\u043E\u0442\u0430", min: 1 }
      ];
      var STYLE_PROPS = [
        { name: "style", kind: "string", group: "style", label: "\u0441\u0442\u0438\u043B\u044C IdySS: \xAB\u0441\u0432\u043E\u0439\u0441\u0442\u0432\u043E: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435; \u2026\xBB" },
        { name: "style_hover", kind: "string", group: "style", label: "\u0441\u0442\u0438\u043B\u044C \u043F\u0440\u0438 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0438" },
        { name: "style_active", kind: "string", group: "style", label: "\u0441\u0442\u0438\u043B\u044C \u043F\u0440\u0438 \u043D\u0430\u0436\u0430\u0442\u0438\u0438" },
        { name: "style_disabled", kind: "string", group: "style", label: "\u0441\u0442\u0438\u043B\u044C \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u043E\u0433\u043E" }
      ];
      var FONT = { name: "font", kind: "font", group: "text", label: "\u0448\u0440\u0438\u0444\u0442 \u0438\u0437 \u0444\u0430\u0439\u043B\u0430 (fonts.Font)" };
      var COMMON_TAIL = [
        FONT,
        { name: "hint", kind: "string", group: "text", label: "\u0432\u0441\u043F\u043B\u044B\u0432\u0430\u044E\u0449\u0430\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430" },
        { name: "text_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430" },
        { name: "background_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0444\u043E\u043D\u0430" },
        { name: "visible", kind: "bool", group: "behaviour", label: "\u0432\u0438\u0434\u0435\u043D", default: true },
        { name: "enabled", kind: "bool", group: "behaviour", label: "\u0432\u043A\u043B\u044E\u0447\u0451\u043D", default: true },
        ...STYLE_PROPS
      ];
      var FONT_SIZE = { name: "font_size", kind: "int", group: "text", label: "\u0440\u0430\u0437\u043C\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430", min: 1 };
      var BORDER_COLOR = { name: "border_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0440\u0430\u043C\u043A\u0438" };
      var ON_CLICK = { name: "on_click", params: "", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u043F\u0440\u0438 \u0449\u0435\u043B\u0447\u043A\u0435" };
      var ON_CHANGE = (what) => ({ name: "on_change", params: "", comment: `\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 ${what}` });
      var DATA_KINDS = {
        // ComboBox: пункты — add_item("…") по одному.
        items: { title: "\u041F\u0443\u043D\u043A\u0442\u044B \u0441\u043F\u0438\u0441\u043A\u0430", method: "add_item", field: "items", shape: "strings", placeholder: "\u043F\u0443\u043D\u043A\u0442" },
        // Table: колонки — set_columns("a", "b"), строки — add_row("x", "y") ровно по числу колонок.
        table: { title: "\u041A\u043E\u043B\u043E\u043D\u043A\u0438 \u0438 \u0441\u0442\u0440\u043E\u043A\u0438", field: "table", shape: "table" },
        // BarChart / PieChart: подпись + число.
        entries: { title: "\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u044F", field: "entries", shape: "entries" },
        // LineChart: числа по порядку.
        points: { title: "\u0422\u043E\u0447\u043A\u0438", method: "add_value", field: "points", shape: "numbers" }
      };
      function widget(type, label, defaultName, group, size, own, options = {}) {
        return {
          type,
          label,
          defaultName,
          group,
          size,
          icon: options.icon || `widget-${type}`,
          props: [...GEOMETRY, ...own, ...COMMON_TAIL],
          events: options.events || [],
          container: options.container || null,
          data: options.data ? { ...DATA_KINDS[options.data], ...options.dataOptions || {} } : null,
          hint: options.hint || ""
        };
      }
      var WIDGET_TYPES = [
        widget("Label", "\u041D\u0430\u0434\u043F\u0438\u0441\u044C", "label", "\u041D\u0430\u0434\u043F\u0438\u0441\u0438 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438", { width: 120, height: 24 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u041D\u0430\u0434\u043F\u0438\u0441\u044C" },
          FONT_SIZE,
          { name: "href", kind: "string", group: "text", label: "\u0441\u0441\u044B\u043B\u043A\u0430: \u043D\u0430\u0434\u043F\u0438\u0441\u044C \u0441\u0442\u0430\u043D\u0435\u0442 \u0433\u0438\u043F\u0435\u0440\u0441\u0441\u044B\u043B\u043A\u043E\u0439" },
          BORDER_COLOR
        ], { events: [ON_CLICK] }),
        widget("Button", "\u041A\u043D\u043E\u043F\u043A\u0430", "button", "\u041D\u0430\u0434\u043F\u0438\u0441\u0438 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438", { width: 120, height: 32 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u041A\u043D\u043E\u043F\u043A\u0430" },
          FONT_SIZE,
          BORDER_COLOR
        ], { events: [ON_CLICK] }),
        widget("LineEdit", "\u041F\u043E\u043B\u0435 \u0432\u0432\u043E\u0434\u0430", "line_edit", "\u0412\u0432\u043E\u0434", { width: 180, height: 28 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442" },
          { name: "placeholder", kind: "string", group: "text", label: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u0443\u0441\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044F" },
          { name: "echo_mode", kind: "enum", group: "values", label: "\u043F\u043E\u043A\u0430\u0437 \u0432\u0432\u043E\u0434\u0430: \u043E\u0431\u044B\u0447\u043D\u044B\u0439, \u0442\u043E\u0447\u043A\u0430\u043C\u0438, \u043F\u0443\u0441\u0442\u043E", values: ["normal", "password", "no_echo"], default: "normal" },
          FONT_SIZE,
          BORDER_COLOR,
          { name: "placeholder_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438" }
        ], { events: [ON_CHANGE("\u0442\u0435\u043A\u0441\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F")] }),
        widget("TextEdit", "\u041C\u043D\u043E\u0433\u043E\u0441\u0442\u0440\u043E\u0447\u043D\u043E\u0435 \u043F\u043E\u043B\u0435", "text_edit", "\u0412\u0432\u043E\u0434", { width: 240, height: 120 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442" },
          { name: "placeholder", kind: "string", group: "text", label: "\u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430 \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u0443\u0441\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044F" },
          FONT_SIZE,
          BORDER_COLOR,
          { name: "placeholder_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438" }
        ], { events: [ON_CHANGE("\u0442\u0435\u043A\u0441\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F")] }),
        widget("SpinBox", "\u0421\u0447\u0451\u0442\u0447\u0438\u043A", "spin_box", "\u0412\u0432\u043E\u0434", { width: 100, height: 28 }, [
          { name: "min", kind: "int", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "int", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "value", kind: "int", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "step", kind: "int", group: "values", label: "\u0448\u0430\u0433", default: 1 },
          FONT_SIZE
        ], { events: [ON_CHANGE("\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C")] }),
        widget("FloatSpinBox", "\u0414\u0440\u043E\u0431\u043D\u044B\u0439 \u0441\u0447\u0451\u0442\u0447\u0438\u043A", "float_spin_box", "\u0412\u0432\u043E\u0434", { width: 120, height: 28 }, [
          { name: "min", kind: "float", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "float", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "value", kind: "float", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "step", kind: "float", group: "values", label: "\u0448\u0430\u0433", default: 1 },
          FONT_SIZE
        ], { events: [ON_CHANGE("\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C")] }),
        widget("Slider", "\u041F\u043E\u043B\u0437\u0443\u043D\u043E\u043A", "slider", "\u0412\u0432\u043E\u0434", { width: 200, height: 28 }, [
          { name: "min", kind: "int", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "int", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "value", kind: "int", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "step", kind: "int", group: "values", label: "\u0448\u0430\u0433", default: 1 },
          { name: "orientation", kind: "enum", group: "values", label: "\u043E\u0440\u0438\u0435\u043D\u0442\u0430\u0446\u0438\u044F", values: ["horizontal", "vertical"], default: "horizontal" }
        ], { events: [ON_CHANGE("\u043F\u043E\u043B\u0437\u0443\u043D\u043E\u043A \u0441\u0434\u0432\u0438\u043D\u0443\u043B\u0438")] }),
        widget("CheckBox", "\u0424\u043B\u0430\u0436\u043E\u043A", "check_box", "\u0412\u044B\u0431\u043E\u0440", { width: 180, height: 24 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u0424\u043B\u0430\u0436\u043E\u043A" },
          { name: "is_checked", kind: "bool", group: "values", label: "\u043E\u0442\u043C\u0435\u0447\u0435\u043D", default: false },
          FONT_SIZE
        ], { events: [ON_CHANGE("\u0444\u043B\u0430\u0436\u043E\u043A \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u043B\u0438")] }),
        widget("RadioButton", "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0442\u0435\u043B\u044C", "radio_button", "\u0412\u044B\u0431\u043E\u0440", { width: 180, height: 24 }, [
          { name: "text", kind: "string", group: "text", label: "\u0442\u0435\u043A\u0441\u0442", initial: "\u0412\u0430\u0440\u0438\u0430\u043D\u0442" },
          { name: "is_selected", kind: "bool", group: "values", label: "\u0432\u044B\u0431\u0440\u0430\u043D", default: false },
          { name: "group", kind: "string", group: "values", label: "\u0433\u0440\u0443\u043F\u043F\u0430: \u0438\u0437 \u043E\u0434\u043D\u043E\u0439 \u0433\u0440\u0443\u043F\u043F\u044B \u0432\u044B\u0431\u0440\u0430\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u0438\u043D" },
          FONT_SIZE
        ], { events: [ON_CHANGE("\u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0432\u044B\u0431\u0440\u0430\u043B\u0438")] }),
        widget("ComboBox", "\u0421\u043F\u0438\u0441\u043E\u043A", "combo_box", "\u0412\u044B\u0431\u043E\u0440", { width: 180, height: 30 }, [
          { name: "selected_index", kind: "int", group: "values", label: "\u043D\u043E\u043C\u0435\u0440 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0443\u043D\u043A\u0442\u0430 (\u0441 \u043D\u0443\u043B\u044F)", min: 0 },
          FONT_SIZE
        ], { events: [ON_CHANGE("\u0432\u044B\u0431\u0440\u0430\u043B\u0438 \u043F\u0443\u043D\u043A\u0442")], data: "items" }),
        widget("ProgressBar", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440", "progress_bar", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 200, height: 24 }, [
          { name: "min", kind: "int", group: "values", label: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C", default: 0 },
          { name: "max", kind: "int", group: "values", label: "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C", default: 100 },
          { name: "value", kind: "int", group: "values", label: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", default: 0 },
          { name: "orientation", kind: "enum", group: "values", label: "\u043E\u0440\u0438\u0435\u043D\u0442\u0430\u0446\u0438\u044F", values: ["horizontal", "vertical"], default: "horizontal" },
          FONT_SIZE,
          { name: "foreground_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043F\u043E\u043B\u043E\u0441\u044B" },
          BORDER_COLOR
        ]),
        widget("ImageBox", "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430", "image_box", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 160, height: 120 }, [
          { name: "resize_mode", kind: "enum", group: "values", label: "\u0432\u043F\u0438\u0441\u044B\u0432\u0430\u043D\u0438\u0435: \u0446\u0435\u043B\u0438\u043A\u043E\u043C, \u0441 \u043E\u0431\u0440\u0435\u0437\u043A\u043E\u0439, \u0440\u0430\u0441\u0442\u044F\u043D\u0443\u0442\u044C, \u043A\u0430\u043A \u0435\u0441\u0442\u044C", values: ["fit", "fill", "stretch", "original"], default: "fit" }
        ], { hint: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u0437\u0430\u0434\u0430\u0451\u0442\u0441\u044F \u0432 \u043A\u043E\u0434\u0435: image_box1.set_image(\u2026)" }),
        widget("Icon", "\u0417\u043D\u0430\u0447\u043E\u043A", "icon", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 24, height: 24 }, [
          { name: "icon", kind: "enum", group: "values", label: "\u0438\u043C\u044F \u0437\u043D\u0430\u0447\u043A\u0430 \u0438\u0437 \u0435\u0434\u0438\u043D\u043E\u0433\u043E \u043D\u0430\u0431\u043E\u0440\u0430 \u0441\u0430\u0439\u0442\u0430", values: ICON_NAMES2, default: "star" }
        ], { icon: "star", hint: "\u0417\u043D\u0430\u0447\u043E\u043A \u0432\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0432 \u043A\u0432\u0430\u0434\u0440\u0430\u0442 \u043F\u043E \u043C\u0435\u043D\u044C\u0448\u0435\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u0435; \u0446\u0432\u0435\u0442 \u2014 text_color" }),
        widget("Canvas", "\u0425\u043E\u043B\u0441\u0442", "canvas", "\u0418\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u044B", { width: 300, height: 150 }, [], {
          hint: "\u0420\u0438\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u2014 \u0432 \u043A\u043E\u0434\u0435: canvas1.draw(\u2026), canvas1.fill(\u2026)",
          events: [
            // Обработчики холста получают сам холст первым параметром — как в уроках раздела «Холст».
            { name: "on_init", params: "gui.Canvas canvas", comment: "\u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u044B\u0439 \u043A\u0430\u0434\u0440" },
            { name: "on_update", params: "gui.Canvas canvas, float delta_time", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u043A\u0430\u0436\u0434\u044B\u0439 \u043A\u0430\u0434\u0440; delta_time \u2014 \u0432\u0440\u0435\u043C\u044F \u043A\u0430\u0434\u0440\u0430 \u0432 \u0441\u0435\u043A\u0443\u043D\u0434\u0430\u0445" },
            { name: "on_key_pressed", params: "gui.Canvas canvas, gui.KeyboardEvent evt", comment: "\u043A\u043B\u0430\u0432\u0438\u0448\u0443 \u043D\u0430\u0436\u0430\u043B\u0438: evt.key" },
            { name: "on_key_released", params: "gui.Canvas canvas, gui.KeyboardEvent evt", comment: "\u043A\u043B\u0430\u0432\u0438\u0448\u0443 \u043E\u0442\u043F\u0443\u0441\u0442\u0438\u043B\u0438: evt.key" },
            { name: "on_mouse_move", params: "gui.Canvas canvas, gui.MouseEvent evt", comment: "\u043C\u044B\u0448\u044C \u0434\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044F: evt.x, evt.y" },
            { name: "on_mouse_pressed", params: "gui.Canvas canvas, gui.MouseEvent evt", comment: "\u043A\u043D\u043E\u043F\u043A\u0443 \u043C\u044B\u0448\u0438 \u043D\u0430\u0436\u0430\u043B\u0438: evt.x, evt.y" },
            { name: "on_mouse_released", params: "gui.Canvas canvas, gui.MouseEvent evt", comment: "\u043A\u043D\u043E\u043F\u043A\u0443 \u043C\u044B\u0448\u0438 \u043E\u0442\u043F\u0443\u0441\u0442\u0438\u043B\u0438: evt.x, evt.y" },
            { name: "on_mouse_scroll", params: "gui.Canvas canvas, gui.MouseScrollEvent evt", comment: "\u043A\u0440\u0443\u0442\u044F\u0442 \u043A\u043E\u043B\u0435\u0441\u043E: evt.delta" }
          ]
        }),
        widget("Frame", "\u0420\u0430\u043C\u043A\u0430", "frame", "\u041A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u044B", { width: 220, height: 140 }, [
          { name: "title", kind: "string", group: "text", label: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A" },
          FONT_SIZE,
          BORDER_COLOR,
          { name: "border_width", kind: "int", group: "values", label: "\u0442\u043E\u043B\u0449\u0438\u043D\u0430 \u0440\u0430\u043C\u043A\u0438", min: 0 }
        ], { container: "children" }),
        widget("TabWidget", "\u0412\u043A\u043B\u0430\u0434\u043A\u0438", "tabs", "\u041A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u044B", { width: 320, height: 200 }, [
          FONT_SIZE
        ], { container: "tabs", events: [ON_CHANGE("\u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u043B\u0438 \u0432\u043A\u043B\u0430\u0434\u043A\u0443")] }),
        widget("Table", "\u0422\u0430\u0431\u043B\u0438\u0446\u0430", "table", "\u0412\u0438\u0442\u0440\u0438\u043D\u044B", { width: 320, height: 200 }, [
          FONT_SIZE
        ], { events: [{ name: "on_select", params: "", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u0432\u044B\u0431\u0440\u0430\u043B\u0438 \u0441\u0442\u0440\u043E\u043A\u0443" }], data: "table" }),
        widget("BarChart", "\u0421\u0442\u043E\u043B\u0431\u0446\u044B", "bar_chart", "\u0412\u0438\u0442\u0440\u0438\u043D\u044B", { width: 320, height: 220 }, [
          { name: "min_value", kind: "float", group: "values", label: "\u043D\u0438\u0437 \u0448\u043A\u0430\u043B\u044B" },
          { name: "max_value", kind: "float", group: "values", label: "\u0432\u0435\u0440\u0445 \u0448\u043A\u0430\u043B\u044B" },
          { name: "show_values", kind: "bool", group: "values", label: "\u043F\u043E\u0434\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u0447\u0438\u0441\u043B\u0430" },
          { name: "bar_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0441\u0442\u043E\u043B\u0431\u0446\u043E\u0432" }
        ], { data: "entries", dataOptions: { method: "add_value" } }),
        widget("LineChart", "\u0413\u0440\u0430\u0444\u0438\u043A", "line_chart", "\u0412\u0438\u0442\u0440\u0438\u043D\u044B", { width: 320, height: 220 }, [
          { name: "min_value", kind: "float", group: "values", label: "\u043D\u0438\u0437 \u0448\u043A\u0430\u043B\u044B" },
          { name: "max_value", kind: "float", group: "values", label: "\u0432\u0435\u0440\u0445 \u0448\u043A\u0430\u043B\u044B" },
          { name: "max_points", kind: "int", group: "values", label: "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u043E\u0447\u0435\u043A \u0434\u0435\u0440\u0436\u0430\u0442\u044C", min: 1 },
          { name: "show_dots", kind: "bool", group: "values", label: "\u0440\u0438\u0441\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u0447\u043A\u0438" },
          { name: "line_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u043B\u0438\u043D\u0438\u0438" }
        ], { data: "points" }),
        widget("PieChart", "\u041A\u0440\u0443\u0433", "pie_chart", "\u0412\u0438\u0442\u0440\u0438\u043D\u044B", { width: 320, height: 220 }, [
          { name: "show_legend", kind: "bool", group: "values", label: "\u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043B\u0435\u0433\u0435\u043D\u0434\u0443" },
          { name: "show_percents", kind: "bool", group: "values", label: "\u043F\u043E\u0434\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u044B" }
        ], { data: "entries", dataOptions: { method: "add_slice" } })
      ];
      var TAB_PAGE_TYPE2 = "Frame";
      var WINDOW_PROPS2 = [
        { name: "title", kind: "string", group: "text", label: "\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u043E\u043A\u043D\u0430" },
        { name: "width", kind: "int", group: "geometry", label: "\u0448\u0438\u0440\u0438\u043D\u0430", min: 100, default: 640 },
        { name: "height", kind: "int", group: "geometry", label: "\u0432\u044B\u0441\u043E\u0442\u0430", min: 60, default: 420 },
        { name: "theme", kind: "enum", group: "values", label: "\u0442\u0435\u043C\u0430 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u044F \u043E\u043A\u043D\u0430", values: WINDOW_THEMES, default: "default" },
        { name: "font_size", kind: "int", group: "text", label: "\u0440\u0430\u0437\u043C\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430 (\u043D\u0430\u0441\u043B\u0435\u0434\u0443\u044E\u0442 \u0432\u0438\u0434\u0436\u0435\u0442\u044B)", min: 1, default: 13 },
        FONT,
        { name: "text_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430" },
        { name: "background_color", kind: "color", group: "colors", label: "\u0446\u0432\u0435\u0442 \u0444\u043E\u043D\u0430" },
        ...STYLE_PROPS
      ];
      var WINDOW_EVENTS = [{ name: "on_close", params: "", comment: "\u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C, \u043A\u043E\u0433\u0434\u0430 \u043E\u043A\u043D\u043E \u0437\u0430\u043A\u0440\u044B\u0432\u0430\u044E\u0442" }];
      var WIDGETS2 = Object.fromEntries(WIDGET_TYPES.map((def) => [def.type, def]));
      var PALETTE_GROUPS2 = [...new Set(WIDGET_TYPES.map((def) => def.group))].map((group) => ({
        title: group,
        types: WIDGET_TYPES.filter((def) => def.group === group).map((def) => def.type)
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
      function eventsOf2(type) {
        return type === "Window" ? WINDOW_EVENTS : widgetDefinition2(type).events;
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
        FONT,
        ICON_NAMES: ICON_NAMES2,
        DATA_KINDS,
        KEYWORDS,
        RESERVED_NAMES,
        WINDOW_THEMES,
        PROPERTY_GROUPS: PROPERTY_GROUPS2,
        WIDGET_TYPES,
        WIDGETS: WIDGETS2,
        WINDOW_PROPS: WINDOW_PROPS2,
        WINDOW_EVENTS,
        PALETTE_GROUPS: PALETTE_GROUPS2,
        TAB_PAGE_TYPE: TAB_PAGE_TYPE2,
        widgetDefinition: widgetDefinition2,
        propertyOf: propertyOf2,
        eventsOf: eventsOf2,
        nameProblem: nameProblem2,
        freeName: freeName2
      };
    }
  });

  // packages/gui-designer/src/codegen.js
  var require_codegen = __commonJS({
    "packages/gui-designer/src/codegen.js"(exports, module) {
      "use strict";
      var { WINDOW_PROPS: WINDOW_PROPS2, widgetDefinition: widgetDefinition2, propertyOf: propertyOf2, eventsOf: eventsOf2 } = require_widgets();
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
          case "font":
            return String(value);
          // имя переменной fonts.Font
          case "enum":
          case "string":
          default:
            return `"${escapeString(value)}"`;
        }
      }
      function normalizeHex2(value) {
        const text = String(value || "").trim();
        const match = /^#?([0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/u.exec(text);
        return match ? `#${match[1].toLowerCase()}` : "#000000";
      }
      function hasValue(props, name) {
        return props && props[name] !== void 0 && props[name] !== null && props[name] !== "";
      }
      function childrenOf2(model2, parentId) {
        return model2.widgets.filter((item) => item.parent === parentId);
      }
      function fontsOf2(model2) {
        return Array.isArray(model2.fonts) ? model2.fonts.filter((font) => font && typeof font.name === "string" && typeof font.file === "string") : [];
      }
      function usesColors(model2) {
        const check = (type, props) => Object.keys(props || {}).some((name) => {
          const prop = propertyOf2(type, name);
          return prop && prop.kind === "color" && hasValue(props, name);
        });
        if (check("Window", model2.window.props)) return true;
        return model2.widgets.some((item) => check(item.type, item.props));
      }
      function dataLines(indent, ownerName, type, data) {
        const def = widgetDefinition2(type);
        if (!def.data || !data) return [];
        const lines = [];
        const text = (value) => `"${escapeString(value)}"`;
        const number = (value) => formatValue("float", value);
        if (def.data.shape === "strings") {
          for (const item of Array.isArray(data.items) ? data.items : []) lines.push(`${indent}${ownerName}.${def.data.method}(${text(item)});`);
        } else if (def.data.shape === "table") {
          const columns = Array.isArray(data.columns) ? data.columns.map(String) : [];
          if (columns.length > 0) {
            lines.push(`${indent}${ownerName}.set_columns(${columns.map(text).join(", ")});`);
            for (const row of Array.isArray(data.rows) ? data.rows : []) {
              const cells = columns.map((_, index) => Array.isArray(row) && row[index] !== void 0 ? String(row[index]) : "");
              lines.push(`${indent}${ownerName}.add_row(${cells.map(text).join(", ")});`);
            }
          }
        } else if (def.data.shape === "entries") {
          for (const entry of Array.isArray(data.entries) ? data.entries : []) {
            lines.push(`${indent}${ownerName}.${def.data.method}(${text(entry.label)}, ${number(entry.value)});`);
          }
        } else if (def.data.shape === "numbers") {
          for (const point of Array.isArray(data.points) ? data.points : []) lines.push(`${indent}${ownerName}.${def.data.method}(${number(point)});`);
        }
        return lines;
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
      function handlersFor(owner, type, options) {
        const events = eventsOf2(type);
        if (options.handlers === true) return events;
        const chosen = Array.isArray(owner.handlers) ? owner.handlers : [];
        return events.filter((event) => chosen.includes(event.name));
      }
      function handlerStub(indent, ownerName, event) {
        return ["", `${indent}${ownerName}.${event.name} = void function(${event.params || ""}) {`, `${indent}${indent}// ${event.comment}`, `${indent}};`];
      }
      function generateCode2(model2, options = {}) {
        const indent = "    ";
        const lines = ["use gui;"];
        if (usesColors(model2)) lines.push("use colors;");
        const fonts = fontsOf2(model2);
        if (fonts.length > 0) lines.push("use fonts;");
        lines.push("", "main() {");
        for (const font of fonts) {
          lines.push(`${indent}fonts.Font ${font.name};`);
          lines.push(`${indent}${font.name}.load_from_file("${escapeString(font.file)}");`);
        }
        if (fonts.length > 0) lines.push("");
        const win = model2.window;
        lines.push(`${indent}gui.Window ${win.name};`);
        lines.push(...propertyLines(indent, win.name, "Window", win.props));
        const handlerLines = [];
        const emitWidget = (item, parentName) => {
          const def = widgetDefinition2(item.type);
          lines.push("");
          lines.push(`${indent}gui.${item.type} ${item.name};`);
          lines.push(...propertyLines(indent, item.name, item.type, item.props));
          lines.push(...dataLines(indent, item.name, item.type, item.data));
          if (def.container === "tabs") {
            const previewIndex = options.previewTabs && options.previewTabs[item.id];
            if (previewIndex !== void 0 && previewIndex !== null) {
              lines.push(`${indent}${item.name}.selected_index = ${Math.round(Number(previewIndex))};`);
            }
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
          for (const event of handlersFor(item, item.type, options)) handlerLines.push(...handlerStub(indent, item.name, event));
        };
        for (const item of childrenOf2(model2, null)) emitWidget(item, win.name);
        for (const event of handlersFor(win, "Window", options)) handlerLines.push(...handlerStub(indent, win.name, event));
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
        const withHandlers = (target, copy) => {
          if (Array.isArray(target.handlers) && target.handlers.length > 0) copy.handlers = [...target.handlers];
          return copy;
        };
        const fonts = fontsOf2(model2).map((font) => ({ name: font.name, file: font.file }));
        return {
          version: MODEL_VERSION2,
          window: withHandlers(model2.window, { name: model2.window.name, props: { ...model2.window.props } }),
          ...fonts.length > 0 ? { fonts } : {},
          widgets: model2.widgets.map((item) => {
            const copy = { id: item.id, type: item.type, name: item.name, parent: item.parent, props: { ...item.props } };
            if (item.tabTitle !== void 0) copy.tabTitle = item.tabTitle;
            if (item.data && Object.keys(item.data).length > 0) copy.data = JSON.parse(JSON.stringify(item.data));
            return withHandlers(item, copy);
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
      function codeDifference2(fileCode, regeneratedCode) {
        const normalize = (line) => line.trim();
        const fileLines = String(fileCode).split("\n");
        const generatedCounts = /* @__PURE__ */ new Map();
        for (const line of String(regeneratedCode).split("\n")) {
          const key = normalize(line);
          if (key === "") continue;
          generatedCounts.set(key, (generatedCounts.get(key) || 0) + 1);
        }
        const extra = [];
        fileLines.forEach((line, index) => {
          const key = normalize(line);
          if (key === "") return;
          const left = generatedCounts.get(key) || 0;
          if (left > 0) generatedCounts.set(key, left - 1);
          else extra.push({ line: index + 1, text: line.trimEnd() });
        });
        const ranges = [];
        for (const item of extra) {
          const last = ranges[ranges.length - 1];
          if (last && item.line === last.to + 1) {
            last.to = item.line;
            last.count++;
          } else {
            ranges.push({ from: item.line, to: item.line, count: 1, first: item.text.trim() });
          }
        }
        const missing = [...generatedCounts.entries()].filter(([, count]) => count > 0).map(([text]) => text);
        return { extraRanges: ranges, extraLines: extra.length, missingLines: missing };
      }
      function withoutMissingFonts2(model2, hasFile) {
        const missing = fontsOf2(model2).filter((font) => !hasFile(font.file));
        if (missing.length === 0) return { model: model2, missing: [] };
        const gone = new Set(missing.map((font) => font.name));
        const strip = (props) => {
          const copy = { ...props };
          if (gone.has(copy.font)) delete copy.font;
          return copy;
        };
        return {
          model: {
            ...model2,
            fonts: fontsOf2(model2).filter((font) => !gone.has(font.name)),
            window: { ...model2.window, props: strip(model2.window.props) },
            widgets: model2.widgets.map((item) => ({ ...item, props: strip(item.props) }))
          },
          missing
        };
      }
      module.exports = {
        MODEL_VERSION: MODEL_VERSION2,
        fontsOf: fontsOf2,
        withoutMissingFonts: withoutMissingFonts2,
        MODEL_COMMENT_PREFIX,
        generateCode: generateCode2,
        formatValue,
        normalizeHex: normalizeHex2,
        stripModel: stripModel2,
        extractEmbeddedModel: extractEmbeddedModel2,
        stripEmbeddedModel: stripEmbeddedModel2,
        codeDifference: codeDifference2,
        childrenOf: childrenOf2
      };
    }
  });

  // packages/gui-designer/src/model-ops.js
  var require_model_ops = __commonJS({
    "packages/gui-designer/src/model-ops.js"(exports, module) {
      "use strict";
      var { widgetDefinition: widgetDefinition2, TAB_PAGE_TYPE: TAB_PAGE_TYPE2 } = require_widgets();
      var { childrenOf: childrenOf2 } = require_codegen();
      function widgetById2(model2, id) {
        return model2.widgets.find((item) => item.id === id) || null;
      }
      function isAncestor2(model2, maybeAncestorId, id) {
        let current = widgetById2(model2, id);
        while (current && current.parent !== null) {
          if (current.parent === maybeAncestorId) return true;
          current = widgetById2(model2, current.parent);
        }
        return false;
      }
      function childrenMap(model2) {
        const map = /* @__PURE__ */ new Map();
        for (const item of model2.widgets) {
          if (!map.has(item.parent)) map.set(item.parent, []);
          map.get(item.parent).push(item);
        }
        return map;
      }
      function flattenTree(model2, byParent = childrenMap(model2)) {
        const out = [];
        const seen = /* @__PURE__ */ new Set();
        const visit = (parentId) => {
          for (const item of byParent.get(parentId) || []) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            out.push(item);
            visit(item.id);
          }
        };
        visit(null);
        for (const item of model2.widgets) if (!seen.has(item.id)) out.push(item);
        return out;
      }
      function moveSubtree2(model2, id, { parent, before = null }) {
        const item = widgetById2(model2, id);
        if (!item) return { ok: false, reason: "\u043D\u0435\u0442 \u0442\u0430\u043A\u043E\u0433\u043E \u0432\u0438\u0434\u0436\u0435\u0442\u0430" };
        if (before === id) return { ok: true };
        if (parent === id || parent !== null && isAncestor2(model2, id, parent)) return { ok: false, reason: "\u043D\u0435\u043B\u044C\u0437\u044F \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u044C \u0432\u0438\u0434\u0436\u0435\u0442 \u0432\u043D\u0443\u0442\u0440\u044C \u0441\u0430\u043C\u043E\u0433\u043E \u0441\u0435\u0431\u044F" };
        const target = parent === null ? null : widgetById2(model2, parent);
        if (parent !== null && !target) return { ok: false, reason: "\u043D\u0435\u0442 \u0442\u0430\u043A\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440\u0430" };
        const targetDef = target ? widgetDefinition2(target.type) : null;
        if (target && !targetDef.container) return { ok: false, reason: `${target.name} \u2014 \u043D\u0435 \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440: \u0432\u043D\u0443\u0442\u0440\u044C \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u044C` };
        const intoTabs = Boolean(targetDef && targetDef.container === "tabs");
        if (intoTabs && item.type !== TAB_PAGE_TYPE2) return { ok: false, reason: "\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435\u0439 \u0432\u043A\u043B\u0430\u0434\u043E\u043A \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u043C\u043A\u0430 (Frame)" };
        const wasPage = item.tabTitle !== void 0;
        if (wasPage && item.parent !== parent && childrenOf2(model2, item.parent).length <= 1) {
          return { ok: false, reason: "\u0443 \u0432\u043A\u043B\u0430\u0434\u043E\u043A \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430" };
        }
        const byParent = childrenMap(model2);
        const oldList = byParent.get(item.parent) || [];
        oldList.splice(oldList.indexOf(item), 1);
        item.parent = parent;
        if (intoTabs) {
          if (item.tabTitle === void 0) item.tabTitle = `\u0412\u043A\u043B\u0430\u0434\u043A\u0430 ${(byParent.get(parent) || []).length + 1}`;
        } else if (wasPage) {
          delete item.tabTitle;
        }
        if (!byParent.has(parent)) byParent.set(parent, []);
        const list = byParent.get(parent);
        const index = before === null ? -1 : list.findIndex((other) => other.id === before);
        list.splice(index === -1 ? list.length : index, 0, item);
        item.props.x = Math.max(0, Number(item.props.x || 0));
        item.props.y = Math.max(0, Number(item.props.y || 0));
        model2.widgets = flattenTree(model2, byParent);
        return { ok: true };
      }
      function selectionRoots2(model2, ids) {
        const list = [...ids];
        return list.filter((id) => !list.some((other) => other !== id && isAncestor2(model2, other, id)));
      }
      var ALIGN_MODES2 = {
        left: "\u043F\u043E \u043B\u0435\u0432\u043E\u043C\u0443 \u043A\u0440\u0430\u044E",
        center: "\u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443 (\u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C)",
        right: "\u043F\u043E \u043F\u0440\u0430\u0432\u043E\u043C\u0443 \u043A\u0440\u0430\u044E",
        top: "\u043F\u043E \u0432\u0435\u0440\u0445\u043D\u0435\u043C\u0443 \u043A\u0440\u0430\u044E",
        middle: "\u043F\u043E \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0435 (\u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C)",
        bottom: "\u043F\u043E \u043D\u0438\u0436\u043D\u0435\u043C\u0443 \u043A\u0440\u0430\u044E",
        "distribute-h": "\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043F\u043E \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u0438",
        "distribute-v": "\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043F\u043E \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u0438",
        "same-width": "\u043E\u0434\u043D\u0430 \u0448\u0438\u0440\u0438\u043D\u0430",
        "same-height": "\u043E\u0434\u043D\u0430 \u0432\u044B\u0441\u043E\u0442\u0430"
      };
      function alignBoxes2(boxes, mode) {
        if (!Array.isArray(boxes) || boxes.length < 2) return [];
        const anchor = boxes[0];
        const rest = boxes.slice(1);
        const moves = [];
        const move = (box, patch) => moves.push({ id: box.id, dx: 0, dy: 0, ...patch });
        switch (mode) {
          case "left":
            for (const box of rest) move(box, { dx: anchor.left - box.left });
            break;
          case "right":
            for (const box of rest) move(box, { dx: anchor.left + anchor.width - (box.left + box.width) });
            break;
          case "center":
            for (const box of rest) move(box, { dx: anchor.left + anchor.width / 2 - (box.left + box.width / 2) });
            break;
          case "top":
            for (const box of rest) move(box, { dy: anchor.top - box.top });
            break;
          case "bottom":
            for (const box of rest) move(box, { dy: anchor.top + anchor.height - (box.top + box.height) });
            break;
          case "middle":
            for (const box of rest) move(box, { dy: anchor.top + anchor.height / 2 - (box.top + box.height / 2) });
            break;
          case "same-width":
            for (const box of rest) move(box, { width: anchor.width });
            break;
          case "same-height":
            for (const box of rest) move(box, { height: anchor.height });
            break;
          case "distribute-h":
          case "distribute-v": {
            if (boxes.length < 3) return [];
            const horizontal = mode === "distribute-h";
            const start = (box) => horizontal ? box.left : box.top;
            const size = (box) => horizontal ? box.width : box.height;
            const sorted = [...boxes].sort((a, b) => start(a) - start(b));
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const total = sorted.reduce((sum, box) => sum + size(box), 0);
            const gap = (start(last) + size(last) - start(first) - total) / (sorted.length - 1);
            let cursor = start(first) + size(first) + gap;
            for (const box of sorted.slice(1, -1)) {
              move(box, horizontal ? { dx: cursor - box.left } : { dy: cursor - box.top });
              cursor += size(box) + gap;
            }
            break;
          }
          default:
            throw new Error(`gui-designer: unknown align mode '${mode}'`);
        }
        return moves.filter((item) => Math.abs(item.dx) >= 0.5 || Math.abs(item.dy) >= 0.5 || item.width !== void 0 || item.height !== void 0);
      }
      module.exports = { ALIGN_MODES: ALIGN_MODES2, childrenMap, flattenTree, moveSubtree: moveSubtree2, selectionRoots: selectionRoots2, alignBoxes: alignBoxes2, isAncestor: isAncestor2 };
    }
  });

  // packages/gui-designer/src/import.js
  var require_import = __commonJS({
    "packages/gui-designer/src/import.js"(exports, module) {
      "use strict";
      var { WIDGETS: WIDGETS2, TAB_PAGE_TYPE: TAB_PAGE_TYPE2, widgetDefinition: widgetDefinition2, propertyOf: propertyOf2, eventsOf: eventsOf2, nameProblem: nameProblem2, freeName: freeName2 } = require_widgets();
      var { MODEL_VERSION: MODEL_VERSION2, normalizeHex: normalizeHex2 } = require_codegen();
      var { flattenTree } = require_model_ops();
      var KNOWN_MODULES = /* @__PURE__ */ new Set(["gui", "colors", "fonts"]);
      var ImportRefusal = class extends Error {
        constructor(message) {
          super(message);
          this.name = "ImportRefusal";
        }
      };
      function hex2(value) {
        return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
      }
      function buildColorTable(constants) {
        const table = /* @__PURE__ */ new Map();
        for (const entry of Array.isArray(constants) ? constants : []) {
          const [name, red, green, blue, alpha] = entry;
          if (typeof name !== "string") continue;
          table.set(name, `#${hex2(red)}${hex2(green)}${hex2(blue)}${alpha === void 0 ? "" : hex2(alpha * 255)}`);
        }
        return table;
      }
      function isIdentifier(node, name) {
        return Boolean(node) && node.kind === "IdentifierExpression" && (name === void 0 || node.name === name);
      }
      function memberOf(node) {
        if (!node || node.kind !== "MemberExpression" || !isIdentifier(node.object)) return null;
        return { object: node.object.name, name: node.name };
      }
      function numberOf(node) {
        if (!node) return null;
        if (node.kind === "LiteralExpression" && typeof node.value === "number") return node.value;
        if (node.kind === "UnaryExpression" && node.operator === "-") {
          const inner = numberOf(node.operand);
          return inner === null ? null : -inner;
        }
        return null;
      }
      function stringOf(node) {
        return node && node.kind === "LiteralExpression" && typeof node.value === "string" ? node.value : null;
      }
      function isInteger(node) {
        return numberOf(node) !== null && Number.isInteger(numberOf(node)) && !(node.kind === "LiteralExpression" && node.valueType === "float");
      }
      function importProgram2(program, options = {}) {
        if (!program || program.kind !== "Program") throw new ImportRefusal("\u044D\u0442\u043E \u043D\u0435 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 Idyllium");
        if (!program.main) throw new ImportRefusal("\u0432 \u0444\u0430\u0439\u043B\u0435 \u043D\u0435\u0442 main() \u2014 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443 \u0441 \u043E\u043A\u043D\u043E\u043C");
        const sourceLines = String(options.source || "").split("\n");
        const colors = buildColorTable(options.colorConstants);
        const foreign = [];
        const notes = [];
        const lineText = (range) => (sourceLines[range.start.line - 1] || "").trim();
        const reject = (node, why) => {
          const line = node.range.start.line;
          if (!foreign.some((item) => item.line === line)) foreign.push({ line, text: lineText(node.range), why });
        };
        for (const declaration of program.imports) {
          if (!KNOWN_MODULES.has(declaration.moduleName)) reject(declaration, `\u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430 ${declaration.moduleName} \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0443 \u043D\u0435 \u043D\u0443\u0436\u043D\u0430`);
        }
        for (const declaration of program.declarations) reject(declaration, "\u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0432\u043D\u0435 main() \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043D\u0435 \u0445\u0440\u0430\u043D\u0438\u0442");
        let windowName = null;
        const windowModel = { name: "win", props: {}, handlers: [] };
        const widgets = /* @__PURE__ */ new Map();
        const fonts = /* @__PURE__ */ new Map();
        const previewTabs2 = {};
        const childOrder = /* @__PURE__ */ new Map();
        let nextId2 = 1;
        const ownerOf = (name) => {
          if (name === windowName) return { kind: "window", type: "Window", target: windowModel };
          if (widgets.has(name)) return { kind: "widget", type: widgets.get(name).type, target: widgets.get(name) };
          if (fonts.has(name)) return { kind: "font", target: fonts.get(name) };
          return null;
        };
        const colorOf = (node) => {
          const member = memberOf(node);
          if (member && member.object === "colors" && colors.has(member.name)) return colors.get(member.name);
          if (node && node.kind === "CallExpression") {
            const callee = memberOf(node.callee);
            const args = node.args.map((argument) => argument.value);
            if (callee && callee.object === "colors") {
              if (callee.name === "HEX" && args.length === 1 && stringOf(args[0]) !== null && /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/u.test(stringOf(args[0]))) return normalizeHex2(stringOf(args[0]));
              if (callee.name === "RGB" && args.length === 3 && args.every((arg) => numberOf(arg) !== null)) return `#${args.map((arg) => hex2(numberOf(arg))).join("")}`;
              if (callee.name === "RGBA" && args.length === 4 && args.every((arg) => numberOf(arg) !== null)) {
                const alpha = numberOf(args[3]);
                return `#${args.slice(0, 3).map((arg) => hex2(numberOf(arg))).join("")}${hex2(Math.max(0, Math.min(1, alpha)) * 255)}`;
              }
            }
          }
          return null;
        };
        const valueOf = (prop, node) => {
          switch (prop.kind) {
            case "string":
              return stringOf(node);
            case "enum": {
              const text = stringOf(node);
              return text !== null && prop.values.includes(text) ? text : null;
            }
            case "int":
              return isInteger(node) ? numberOf(node) : null;
            case "float":
              return numberOf(node);
            case "bool":
              return node && node.kind === "LiteralExpression" && typeof node.value === "boolean" ? node.value : null;
            case "color":
              return colorOf(node);
            case "font":
              return isIdentifier(node) && fonts.has(node.name) ? node.name : null;
            default:
              return null;
          }
        };
        const addTo = (parentId, item) => {
          if (!childOrder.has(parentId)) childOrder.set(parentId, []);
          childOrder.get(parentId).push(item);
          item.parent = parentId;
          item.__added = true;
        };
        const handleDeclaration = (statement) => {
          const type = statement.declaredType;
          if (!type || type.kind !== "QualifiedTypeName" || statement.initializer || statement.constructorArgs) {
            reject(statement, "\u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F \u043D\u0435 \u0438\u0437 \u0438\u0434\u0438\u043E\u043C\u044B \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430");
            return;
          }
          if (type.moduleName === "gui" && type.name === "Window") {
            if (windowName !== null) {
              reject(statement, "\u0432\u0442\u043E\u0440\u043E\u0435 \u043E\u043A\u043D\u043E \u2014 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u043E\u0434\u043D\u043E");
              return;
            }
            windowName = statement.name;
            if (!nameProblem2(statement.name, [])) windowModel.name = statement.name;
            return;
          }
          if (type.moduleName === "gui" && WIDGETS2[type.name]) {
            widgets.set(statement.name, { id: nextId2++, type: type.name, name: statement.name, parent: null, props: {}, handlers: [], __added: false });
            return;
          }
          if (type.moduleName === "fonts" && type.name === "Font") {
            fonts.set(statement.name, { name: statement.name, file: null, node: statement });
            return;
          }
          reject(statement, `\u0442\u0438\u043F ${type.moduleName}.${type.name} \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043D\u0435 \u0437\u043D\u0430\u0435\u0442`);
        };
        const handleAssignment = (statement) => {
          const target = memberOf(statement.target);
          if (!target || statement.operator !== "=") {
            reject(statement, "\u043F\u0440\u0438\u0441\u0432\u0430\u0438\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u0438\u0437 \u0438\u0434\u0438\u043E\u043C\u044B \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430");
            return;
          }
          const owner = ownerOf(target.object);
          if (!owner) {
            reject(statement, `\u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F ${target.object} \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0443 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430`);
            return;
          }
          if (owner.kind === "font") {
            reject(statement, "\u0443 \u0448\u0440\u0438\u0444\u0442\u0430 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0441\u0432\u043E\u0439\u0441\u0442\u0432 \u043D\u0435 \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u0443\u0435\u0442");
            return;
          }
          const event = eventsOf2(owner.type).find((known) => known.name === target.name);
          if (event) {
            if (!statement.value || statement.value.kind !== "FunctionExpression") {
              reject(statement, "\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A \u043D\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0435\u0439-\u0437\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u043E\u0439");
              return;
            }
            if (!owner.target.handlers.includes(event.name)) owner.target.handlers.push(event.name);
            for (const inner of statement.value.body.statements) reject(inner, `\u0442\u0435\u043B\u043E \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u0430 ${target.object}.${target.name}: \u043A\u043E\u0434 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043D\u0435 \u0445\u0440\u0430\u043D\u0438\u0442, \u0442\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0443`);
            return;
          }
          if (owner.kind === "widget" && owner.type === "TabWidget" && target.name === "selected_index") {
            const index = numberOf(statement.value);
            if (index !== null && Number.isInteger(index) && index >= 0) {
              previewTabs2[owner.target.id] = index;
              return;
            }
            reject(statement, "selected_index \u043D\u0435 \u0447\u0438\u0441\u043B\u043E\u043C");
            return;
          }
          const prop = propertyOf2(owner.type, target.name);
          if (!prop) {
            reject(statement, `\u0441\u0432\u043E\u0439\u0441\u0442\u0432\u043E ${target.name} \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043D\u0435 \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u0443\u0435\u0442`);
            return;
          }
          const value = valueOf(prop, statement.value);
          if (value === null) {
            reject(statement, `${target.object}.${target.name}: \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043D\u0435 \u043A\u043E\u043D\u0441\u0442\u0430\u043D\u0442\u0430 (${prop.kind})`);
            return;
          }
          owner.target.props[prop.name] = value;
        };
        const handleCall = (statement) => {
          const call = statement.expression;
          const callee = call && call.kind === "CallExpression" ? memberOf(call.callee) : null;
          if (!callee) {
            reject(statement, "\u0432\u044B\u0437\u043E\u0432 \u043D\u0435 \u0438\u0437 \u0438\u0434\u0438\u043E\u043C\u044B \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430");
            return;
          }
          const args = call.args.map((argument) => argument.value);
          const owner = ownerOf(callee.object);
          if (!owner) {
            reject(statement, `\u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u0430\u044F ${callee.object} \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0443 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430`);
            return;
          }
          if (owner.kind === "font") {
            if (callee.name === "load_from_file" && args.length === 1 && stringOf(args[0]) !== null) {
              owner.target.file = stringOf(args[0]);
              return;
            }
            reject(statement, '\u0443 \u0448\u0440\u0438\u0444\u0442\u0430 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0437\u043D\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E load_from_file("\u0444\u0430\u0439\u043B")');
            return;
          }
          if (owner.kind === "window") {
            if (callee.name === "show" && args.length === 0) return;
            if (callee.name === "add_child" && args.length === 1 && isIdentifier(args[0]) && widgets.has(args[0].name)) {
              addTo(null, widgets.get(args[0].name));
              return;
            }
            reject(statement, `${callee.object}.${callee.name}: \u0443 \u043E\u043A\u043D\u0430 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0437\u043D\u0430\u0435\u0442 add_child \u0438 show`);
            return;
          }
          const item = owner.target;
          const def = widgetDefinition2(item.type);
          if (callee.name === "add_child" && def.container === "children" && args.length === 1 && isIdentifier(args[0]) && widgets.has(args[0].name)) {
            addTo(item.id, widgets.get(args[0].name));
            return;
          }
          if (callee.name === "add_tab" && def.container === "tabs" && args.length === 2 && stringOf(args[0]) !== null && isIdentifier(args[1]) && widgets.has(args[1].name)) {
            const page = widgets.get(args[1].name);
            if (page.type !== TAB_PAGE_TYPE2) {
              reject(statement, `\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0432\u043A\u043B\u0430\u0434\u043E\u043A ${page.name} \u2014 \u043D\u0435 \u0440\u0430\u043C\u043A\u0430 (Frame)`);
              return;
            }
            page.tabTitle = stringOf(args[0]);
            addTo(item.id, page);
            return;
          }
          if (def.data) {
            const shape = def.data.shape;
            const strings = args.map(stringOf);
            const numbers = args.map(numberOf);
            if (!item.data) item.data = shape === "strings" ? { items: [] } : shape === "table" ? { columns: [], rows: [] } : shape === "entries" ? { entries: [] } : { points: [] };
            if (shape === "strings" && callee.name === def.data.method && args.length === 1 && strings[0] !== null) {
              item.data.items.push(strings[0]);
              return;
            }
            if (shape === "table" && callee.name === "set_columns" && args.length > 0 && strings.every((text) => text !== null)) {
              item.data.columns = strings;
              return;
            }
            if (shape === "table" && callee.name === "add_row" && args.length > 0 && strings.every((text) => text !== null)) {
              item.data.rows.push(strings);
              return;
            }
            if (shape === "entries" && callee.name === def.data.method && args.length === 2 && strings[0] !== null && numbers[1] !== null) {
              item.data.entries.push({ label: strings[0], value: numbers[1] });
              return;
            }
            if (shape === "numbers" && callee.name === def.data.method && args.length === 1 && numbers[0] !== null) {
              item.data.points.push(numbers[0]);
              return;
            }
          }
          reject(statement, `${callee.object}.${callee.name}: \u043C\u0435\u0442\u043E\u0434 \u043D\u0435 \u0438\u0437 \u0438\u0434\u0438\u043E\u043C\u044B \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430`);
        };
        for (const statement of program.main.body.statements) {
          if (statement.kind === "VariableDeclaration") handleDeclaration(statement);
          else if (statement.kind === "AssignmentStatement") handleAssignment(statement);
          else if (statement.kind === "ExpressionStatement") handleCall(statement);
          else reject(statement, "\u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043D\u0435 \u0438\u0437 \u0438\u0434\u0438\u043E\u043C\u044B \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430");
        }
        if (windowName === null) throw new ImportRefusal("\u0432 main() \u043D\u0435\u0442 gui.Window \u2014 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u043E\u043A\u043D\u043E");
        const readyFonts = [];
        for (const font of fonts.values()) {
          if (font.file === null) {
            notes.push(`\u0448\u0440\u0438\u0444\u0442 ${font.name} \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D \u0431\u0435\u0437 load_from_file \u2014 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D`);
            reject(font.node, "\u0448\u0440\u0438\u0444\u0442 \u0431\u0435\u0437 \u0444\u0430\u0439\u043B\u0430");
            continue;
          }
          readyFonts.push({ name: font.name, file: font.file });
        }
        const readyNames = new Set(readyFonts.map((font) => font.name));
        const dropFont = (props) => {
          if (props.font !== void 0 && !readyNames.has(props.font)) delete props.font;
        };
        dropFont(windowModel.props);
        for (const item of widgets.values()) {
          dropFont(item.props);
          if (!item.__added) {
            notes.push(`${item.name} (gui.${item.type}) \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u043E\u043A\u043D\u043E \u0447\u0435\u0440\u0435\u0437 add_child \u2014 \u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u0432 \u043E\u043A\u043D\u043E`);
            addTo(null, item);
          }
        }
        const model2 = { version: MODEL_VERSION2, window: windowModel, widgets: [...widgets.values()] };
        if (readyFonts.length > 0) model2.fonts = readyFonts;
        const taken = [windowModel.name];
        for (const item of model2.widgets) {
          if (nameProblem2(item.name, taken)) {
            const fresh = freeName2(widgetDefinition2(item.type).defaultName, taken);
            notes.push(`\u0438\u043C\u044F ${item.name} \u0432 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0435 \u0437\u0430\u043D\u044F\u0442\u043E \u2014 \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D \u0432 ${fresh}`);
            item.name = fresh;
          }
          taken.push(item.name);
        }
        model2.widgets = flattenTree(model2, childOrder);
        for (const item of model2.widgets) delete item.__added;
        foreign.sort((a, b) => a.line - b.line);
        return { model: model2, previewTabs: previewTabs2, foreign, notes };
      }
      module.exports = { importProgram: importProgram2, ImportRefusal, buildColorTable };
    }
  });

  // packages/gui-designer/src/main.js
  var import_widgets = __toESM(require_widgets());
  var import_codegen = __toESM(require_codegen());
  var import_model_ops = __toESM(require_model_ops());
  var import_import = __toESM(require_import());

  // packages/web-ide/src/num-util.js
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // packages/web-ide/src/color-eyedropper.js
  function setupColorEyedropper(applyPickedColor) {
    const button = document.getElementById("color-eyedropper-button");
    if (!button) return;
    let active = false;
    let hookedDocuments = [];
    let lens = null;
    button.addEventListener("click", () => {
      active ? deactivateEyedropper() : activateEyedropper();
    });
    function activateEyedropper() {
      active = true;
      button.classList.add("eyedropper-active");
      const documents = [document];
      for (const frame of document.querySelectorAll("iframe")) {
        try {
          if (frame.contentDocument) documents.push(frame.contentDocument);
        } catch (_error) {
        }
      }
      hookedDocuments = documents.map((doc) => {
        const cursorStyle = doc.createElement("style");
        cursorStyle.textContent = "* { cursor: crosshair !important; pointer-events: auto !important; }\n#eyedropper-lens, #eyedropper-lens * { pointer-events: none !important; }";
        (doc.head || doc.documentElement).appendChild(cursorStyle);
        doc.addEventListener("mousedown", onEyedropperPick, true);
        doc.addEventListener("contextmenu", onEyedropperCancel, true);
        doc.addEventListener("keydown", onEyedropperKey, true);
        doc.addEventListener("mousemove", onEyedropperMove, true);
        return { doc, cursorStyle };
      });
      lens = document.createElement("div");
      lens.id = "eyedropper-lens";
      lens.hidden = true;
      const swatch = document.createElement("span");
      swatch.className = "eyedropper-lens-swatch";
      const label = document.createElement("span");
      label.className = "eyedropper-lens-label";
      lens.append(swatch, label);
      document.body.appendChild(lens);
    }
    function deactivateEyedropper() {
      active = false;
      button.classList.remove("eyedropper-active");
      for (const { doc, cursorStyle } of hookedDocuments) {
        try {
          cursorStyle.remove();
          doc.removeEventListener("mousedown", onEyedropperPick, true);
          doc.removeEventListener("contextmenu", onEyedropperCancel, true);
          doc.removeEventListener("keydown", onEyedropperKey, true);
          doc.removeEventListener("mousemove", onEyedropperMove, true);
        } catch (_error) {
        }
      }
      hookedDocuments = [];
      if (lens) {
        lens.remove();
        lens = null;
      }
    }
    function onEyedropperMove(event) {
      if (!lens) return;
      const doc = event.target && event.target.ownerDocument || document;
      let pageX = event.clientX;
      let pageY = event.clientY;
      if (doc !== document) {
        try {
          const frame = doc.defaultView && doc.defaultView.frameElement;
          if (!frame) return;
          const rect = frame.getBoundingClientRect();
          pageX += rect.left + frame.clientLeft;
          pageY += rect.top + frame.clientTop;
        } catch (_error) {
          return;
        }
      }
      const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
      lens.hidden = false;
      const flipX = pageX > window.innerWidth - 150;
      const flipY = pageY > window.innerHeight - 60;
      lens.style.left = `${pageX + (flipX ? -18 : 18)}px`;
      lens.style.top = `${pageY + (flipY ? -46 : 22)}px`;
      lens.style.transform = `translate(${flipX ? "-100%" : "0"}, 0)`;
      const swatch = lens.firstElementChild;
      const label = lens.lastElementChild;
      if (picked) {
        swatch.style.background = `rgb(${picked.red}, ${picked.green}, ${picked.blue})`;
        label.textContent = `${picked.red}, ${picked.green}, ${picked.blue}`;
      } else {
        swatch.style.background = "transparent";
        label.textContent = "\u2014";
      }
    }
    function eyedropperTargetsButton(event) {
      const target = event.target;
      return Boolean(target && typeof target.closest === "function" && target.closest("#color-eyedropper-button"));
    }
    function onEyedropperPick(event) {
      if (eyedropperTargetsButton(event)) return;
      if (event.button !== void 0 && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const doc = event.target && event.target.ownerDocument || document;
      const picked = eyedropperColorAt(doc, event.clientX, event.clientY);
      if (picked) {
        applyPickedColor(picked);
      }
      swallowNextClick(hookedDocuments.map((entry) => entry.doc));
      deactivateEyedropper();
    }
    function swallowNextClick(documents) {
      const swallow = (event) => {
        event.preventDefault();
        event.stopPropagation();
        release();
      };
      const release = () => {
        for (const doc of documents) {
          try {
            doc.removeEventListener("click", swallow, true);
          } catch (_error) {
          }
        }
      };
      for (const doc of documents) doc.addEventListener("click", swallow, true);
      window.setTimeout(release, 600);
    }
    function onEyedropperCancel(event) {
      event.preventDefault();
      event.stopPropagation();
      deactivateEyedropper();
    }
    function onEyedropperKey(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      deactivateEyedropper();
    }
  }
  function eyedropperColorAt(doc, x, y) {
    const layers = [];
    collectEyedropperLayers(doc, x, y, layers);
    if (layers.length === 0) return null;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    for (const layer of layers) {
      const weight = layer.alpha * (1 - alpha);
      red += layer.red * weight;
      green += layer.green * weight;
      blue += layer.blue * weight;
      alpha += weight;
      if (alpha >= 0.999) break;
    }
    if (alpha <= 0) return null;
    return { red: Math.round(red / alpha), green: Math.round(green / alpha), blue: Math.round(blue / alpha), alpha };
  }
  function collectEyedropperLayers(doc, x, y, layers) {
    const view = doc.defaultView || window;
    const textLayer = eyedropperTextAt(doc, x, y);
    if (textLayer) layers.push(textLayer);
    const stack = doc.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el.id === "eyedropper-lens" || typeof el.closest === "function" && el.closest("#eyedropper-lens")) continue;
      const tag = el.tagName;
      if (tag === "IFRAME") {
        try {
          if (el.contentDocument) {
            const rect2 = el.getBoundingClientRect();
            collectEyedropperLayers(el.contentDocument, x - rect2.left - el.clientLeft, y - rect2.top - el.clientTop, layers);
          }
        } catch (_error) {
        }
        continue;
      }
      if (tag === "IMG" || tag === "CANVAS") {
        const pixel = eyedropperPixelFrom(el, x, y);
        if (pixel && pixel.alpha > 0) {
          layers.push(pixel);
          if (pixel.alpha >= 1) return;
        }
      }
      const style = view.getComputedStyle(el);
      const border = eyedropperBorderAt(el, style, x, y);
      if (border && border.alpha > 0) {
        layers.push(border);
        if (border.alpha >= 1) return;
      }
      const rect = el.getBoundingClientRect();
      for (const background2 of parseCssBackgroundLayers(style)) {
        const layer = background2.kind === "gradient" ? sampleLinearGradient(background2.gradient, rect, x, y) : sampleBackgroundPicture(background2, el, style, x, y);
        if (layer && layer.alpha > 0) {
          layers.push(layer);
          if (layer.alpha >= 1) return;
        }
      }
      const background = parseCssColor(style.backgroundColor);
      if (background && background.alpha > 0) {
        layers.push(background);
        if (background.alpha >= 1) return;
      }
    }
  }
  function eyedropperTextAt(doc, x, y) {
    try {
      let node = null;
      let offset = 0;
      if (typeof doc.caretPositionFromPoint === "function") {
        const position = doc.caretPositionFromPoint(x, y);
        if (position) {
          node = position.offsetNode;
          offset = position.offset;
        }
      } else if (typeof doc.caretRangeFromPoint === "function") {
        const range = doc.caretRangeFromPoint(x, y);
        if (range) {
          node = range.startContainer;
          offset = range.startOffset;
        }
      }
      if (!node || node.nodeType !== 3 || !node.parentElement) return null;
      const text = node.textContent;
      if (!text) return null;
      for (const from of [offset - 1, offset]) {
        if (from < 0 || from >= text.length) continue;
        if (!text.slice(from, from + 1).trim()) continue;
        const probe = doc.createRange();
        probe.setStart(node, from);
        probe.setEnd(node, from + 1);
        const rect = probe.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        const view = doc.defaultView || window;
        const color = parseCssColor(view.getComputedStyle(node.parentElement).color);
        return color && color.alpha > 0 ? color : null;
      }
      return null;
    } catch (_error) {
      return null;
    }
  }
  function eyedropperPixelFrom(el, x, y) {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const sourceWidth = el.tagName === "IMG" ? el.naturalWidth : el.width;
      const sourceHeight = el.tagName === "IMG" ? el.naturalHeight : el.height;
      if (!sourceWidth || !sourceHeight) return null;
      let box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      if (el.tagName === "IMG") {
        const view = el.ownerDocument && el.ownerDocument.defaultView || window;
        const fit = view.getComputedStyle(el).objectFit;
        if (fit === "contain" || fit === "cover" || fit === "scale-down") {
          const cover = fit === "cover";
          let scale = cover ? Math.max(rect.width / sourceWidth, rect.height / sourceHeight) : Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
          if (fit === "scale-down") scale = Math.min(scale, 1);
          const boxWidth = sourceWidth * scale;
          const boxHeight = sourceHeight * scale;
          box = {
            left: rect.left + (rect.width - boxWidth) / 2,
            top: rect.top + (rect.height - boxHeight) / 2,
            width: boxWidth,
            height: boxHeight
          };
          if (x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height) return null;
        }
      }
      const px = clamp(Math.floor((x - box.left) / box.width * sourceWidth), 0, sourceWidth - 1);
      const py = clamp(Math.floor((y - box.top) / box.height * sourceHeight), 0, sourceHeight - 1);
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const context = probe.getContext("2d", { willReadFrequently: true });
      context.drawImage(el, px, py, 1, 1, 0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      if (data[3] === 0) return null;
      return { red: data[0], green: data[1], blue: data[2], alpha: data[3] / 255 };
    } catch (_error) {
      return null;
    }
  }
  function splitCssTopLevel(text) {
    const parts = [];
    let depth = 0;
    let start = 0;
    let quote = "";
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quote) {
        if (char === quote && text[i - 1] !== "\\") quote = "";
        continue;
      }
      if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      else if (char === "," && depth === 0) {
        parts.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(text.slice(start).trim());
    return parts.filter((part) => part !== "");
  }
  function parseCssBackgroundLayers(style) {
    const images = typeof style.backgroundImage === "string" && style.backgroundImage !== "none" ? splitCssTopLevel(style.backgroundImage) : [];
    if (images.length === 0) return [];
    const sizes = splitCssTopLevel(style.backgroundSize || "auto");
    const positions = splitCssTopLevel(style.backgroundPosition || "0% 0%");
    const repeats = splitCssTopLevel(style.backgroundRepeat || "repeat");
    const layers = [];
    images.forEach((image, index) => {
      if (image.startsWith("linear-gradient(")) {
        const gradient = parseLinearGradientBody(image.slice("linear-gradient(".length, -1));
        if (gradient) layers.push({ kind: "gradient", gradient });
        return;
      }
      const url = /^url\((['"]?)(.*?)\1\)$/u.exec(image);
      if (!url) return;
      layers.push({
        kind: "picture",
        url: url[2],
        size: sizes[index % sizes.length] || "auto",
        position: positions[index % positions.length] || "0% 0%",
        repeat: repeats[index % repeats.length] || "repeat"
      });
    });
    return layers;
  }
  var backgroundPictures = /* @__PURE__ */ new Map();
  function backgroundPicture(url) {
    let image = backgroundPictures.get(url);
    if (!image) {
      image = new Image();
      image.src = url;
      backgroundPictures.set(url, image);
    }
    return image.complete && image.naturalWidth > 0 ? image : null;
  }
  function cssLength(token, container, own) {
    if (token.endsWith("%")) return (container - own) * Number.parseFloat(token) / 100;
    return Number.parseFloat(token) || 0;
  }
  function sampleBackgroundPicture(layer, el, style, x, y) {
    const image = backgroundPicture(layer.url);
    if (!image) return null;
    const rect = el.getBoundingClientRect();
    const left = rect.left + (Number.parseFloat(style.borderLeftWidth) || 0);
    const top = rect.top + (Number.parseFloat(style.borderTopWidth) || 0);
    const width = rect.width - (Number.parseFloat(style.borderLeftWidth) || 0) - (Number.parseFloat(style.borderRightWidth) || 0);
    const height = rect.height - (Number.parseFloat(style.borderTopWidth) || 0) - (Number.parseFloat(style.borderBottomWidth) || 0);
    if (width <= 0 || height <= 0) return null;
    let drawnWidth = image.naturalWidth;
    let drawnHeight = image.naturalHeight;
    const size = layer.size.trim();
    if (size === "cover" || size === "contain") {
      const scale = size === "cover" ? Math.max(width / image.naturalWidth, height / image.naturalHeight) : Math.min(width / image.naturalWidth, height / image.naturalHeight);
      drawnWidth = image.naturalWidth * scale;
      drawnHeight = image.naturalHeight * scale;
    } else if (size !== "auto" && size !== "auto auto") {
      const [first, second = "auto"] = size.split(/\s+/u);
      const ratio = image.naturalHeight / image.naturalWidth;
      const explicitWidth = first === "auto" ? null : first.endsWith("%") ? width * Number.parseFloat(first) / 100 : Number.parseFloat(first);
      const explicitHeight = second === "auto" ? null : second.endsWith("%") ? height * Number.parseFloat(second) / 100 : Number.parseFloat(second);
      if (explicitWidth !== null && explicitHeight !== null) {
        drawnWidth = explicitWidth;
        drawnHeight = explicitHeight;
      } else if (explicitWidth !== null) {
        drawnWidth = explicitWidth;
        drawnHeight = explicitWidth * ratio;
      } else if (explicitHeight !== null) {
        drawnHeight = explicitHeight;
        drawnWidth = explicitHeight / ratio;
      }
    }
    if (!(drawnWidth > 0) || !(drawnHeight > 0)) return null;
    const [positionX = "0%", positionY = "0%"] = layer.position.trim().split(/\s+/u);
    let localX = x - left - cssLength(positionX, width, drawnWidth);
    let localY = y - top - cssLength(positionY, height, drawnHeight);
    const repeat = layer.repeat.trim();
    const repeatX = repeat === "repeat" || repeat === "repeat-x" || repeat.startsWith("repeat ");
    const repeatY = repeat === "repeat" || repeat === "repeat-y" || repeat.endsWith(" repeat");
    if (repeatX) localX = (localX % drawnWidth + drawnWidth) % drawnWidth;
    if (repeatY) localY = (localY % drawnHeight + drawnHeight) % drawnHeight;
    if (localX < 0 || localY < 0 || localX >= drawnWidth || localY >= drawnHeight) return null;
    try {
      const probe = document.createElement("canvas");
      probe.width = 1;
      probe.height = 1;
      const context = probe.getContext("2d", { willReadFrequently: true });
      const sourceX = clamp(Math.floor(localX / drawnWidth * image.naturalWidth), 0, image.naturalWidth - 1);
      const sourceY = clamp(Math.floor(localY / drawnHeight * image.naturalHeight), 0, image.naturalHeight - 1);
      context.drawImage(image, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      if (data[3] === 0) return null;
      return { red: data[0], green: data[1], blue: data[2], alpha: data[3] / 255 };
    } catch (_error) {
      return null;
    }
  }
  function eyedropperBorderAt(el, style, x, y) {
    const rect = el.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    const sides = [
      ["Top", y - rect.top],
      ["Bottom", rect.bottom - y],
      ["Left", x - rect.left],
      ["Right", rect.right - x]
    ];
    for (const [side, distance] of sides) {
      const width = Number.parseFloat(style[`border${side}Width`]) || 0;
      if (width <= 0 || distance > width) continue;
      const borderStyle = style[`border${side}Style`];
      if (borderStyle === "none" || borderStyle === "hidden") continue;
      return parseCssColor(style[`border${side}Color`]);
    }
    return null;
  }
  function parseLinearGradientBody(body) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const ch of body) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    if (parts.length === 0) return null;
    let direction = "to bottom";
    if (/^to |^-?[\d.]+deg$/u.test(parts[0])) direction = parts.shift();
    if (parts.length < 2) return null;
    const stops = [];
    for (const part of parts) {
      const positionMatch = /^(.*?)\s+([\d.]+)%$/u.exec(part);
      const color = parseCssColor(positionMatch ? positionMatch[1] : part);
      if (!color) return null;
      stops.push({ color, position: positionMatch ? Number(positionMatch[2]) / 100 : null });
    }
    if (stops[0].position === null) stops[0].position = 0;
    if (stops[stops.length - 1].position === null) stops[stops.length - 1].position = 1;
    for (let i = 1; i < stops.length - 1; i += 1) {
      if (stops[i].position === null) {
        let next = i;
        while (stops[next].position === null) next += 1;
        const prev = stops[i - 1].position;
        stops[i].position = prev + (stops[next].position - prev) / (next - i + 1);
      }
    }
    return { direction, stops };
  }
  function sampleLinearGradient(gradient, rect, x, y) {
    if (rect.width === 0 || rect.height === 0) return null;
    let fraction;
    const d = gradient.direction;
    if (d === "to right" || d === "90deg") fraction = (x - rect.left) / rect.width;
    else if (d === "to left" || d === "270deg" || d === "-90deg") fraction = (rect.right - x) / rect.width;
    else if (d === "to top" || d === "0deg") fraction = (rect.bottom - y) / rect.height;
    else if (d === "to bottom" || d === "180deg") fraction = (y - rect.top) / rect.height;
    else {
      const degMatch = /^(-?[\d.]+)deg$/u.exec(d);
      if (!degMatch) return null;
      const deg = (Number(degMatch[1]) % 360 + 360) % 360;
      if (deg < 45 || deg >= 315) fraction = (rect.bottom - y) / rect.height;
      else if (deg < 135) fraction = (x - rect.left) / rect.width;
      else if (deg < 225) fraction = (y - rect.top) / rect.height;
      else fraction = (rect.right - x) / rect.width;
    }
    fraction = clamp(fraction, 0, 1);
    const stops = gradient.stops;
    if (fraction <= stops[0].position) return { ...stops[0].color };
    if (fraction >= stops[stops.length - 1].position) return { ...stops[stops.length - 1].color };
    for (let i = 1; i < stops.length; i += 1) {
      if (fraction <= stops[i].position) {
        const span = stops[i].position - stops[i - 1].position;
        const t = span === 0 ? 0 : (fraction - stops[i - 1].position) / span;
        const a = stops[i - 1].color;
        const b = stops[i].color;
        return {
          red: Math.round(a.red + (b.red - a.red) * t),
          green: Math.round(a.green + (b.green - a.green) * t),
          blue: Math.round(a.blue + (b.blue - a.blue) * t),
          alpha: a.alpha + (b.alpha - a.alpha) * t
        };
      }
    }
    return null;
  }
  function parseCssColor(text) {
    if (typeof text !== "string") return null;
    const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/u.exec(text.trim());
    if (!match) return null;
    return {
      red: clamp(Number(match[1]), 0, 255),
      green: clamp(Number(match[2]), 0, 255),
      blue: clamp(Number(match[3]), 0, 255),
      alpha: match[4] === void 0 ? 1 : clamp(Number(match[4]), 0, 1)
    };
  }

  // packages/web-ide/src/color-picker.js
  var RGB_CHANNELS = [
    ["red", "R", "\u041A\u0440\u0430\u0441\u043D\u044B\u0439, 0\u2013255"],
    ["green", "G", "\u0417\u0435\u043B\u0451\u043D\u044B\u0439, 0\u2013255"],
    ["blue", "B", "\u0421\u0438\u043D\u0438\u0439, 0\u2013255"]
  ];
  var HSL_CHANNELS = [
    ["hue", "H", "\u0422\u043E\u043D, 0\u2013360\xB0", 360],
    ["saturation", "S", "\u041D\u0430\u0441\u044B\u0449\u0435\u043D\u043D\u043E\u0441\u0442\u044C, 0\u2013100 %", 100],
    ["lightness", "L", "\u0421\u0432\u0435\u0442\u043B\u043E\u0442\u0430, 0\u2013100 %", 100]
  ];
  function rgbToHsl(red, green, blue) {
    const r = clamp(red, 0, 255) / 255;
    const g = clamp(green, 0, 255) / 255;
    const b = clamp(blue, 0, 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;
    if (delta > 0) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (max === r) hue = (g - b) / delta % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    return { hue: Math.round(hue) % 360, saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
  }
  function hslToRgb(hue, saturation, lightness) {
    const h = (clamp(hue, 0, 360) % 360 + 360) % 360;
    const s = clamp(saturation, 0, 100) / 100;
    const l = clamp(lightness, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = l - c / 2;
    let [r, g, b] = [0, 0, 0];
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return { red: Math.round((r + m) * 255), green: Math.round((g + m) * 255), blue: Math.round((b + m) * 255) };
  }
  function byte(value) {
    return Math.round(clamp(Number(value) || 0, 0, 255));
  }
  function componentToHex(value) {
    return byte(value).toString(16).padStart(2, "0");
  }
  function formatAlpha(value) {
    const rounded = Math.round(clamp(Number(value), 0, 1) * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/u, "").replace(/\.$/u, "");
  }
  function colorHex({ red, green, blue, alpha = 1 }) {
    const base = `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
    return alpha >= 1 ? base : base + componentToHex(Math.round(alpha * 255));
  }
  function parseHex(text) {
    const match = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/u.exec(String(text || "").trim());
    if (!match) return null;
    const value = parseInt(match[1], 16);
    return {
      red: value >> 16 & 255,
      green: value >> 8 & 255,
      blue: value & 255,
      alpha: match[2] ? Math.round(parseInt(match[2], 16) / 255 * 100) / 100 : 1
    };
  }
  function readStorage(key) {
    try {
      const raw = key ? localStorage.getItem(key) : null;
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }
  function writeStorage(key, patch) {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify({ ...readStorage(key), ...patch }));
    } catch (error) {
    }
  }
  function channelRow({ channel, letter, title, max, step, sliderClass }) {
    const row = document.createElement("label");
    row.className = "color-channel-row";
    row.dataset.channel = channel;
    row.title = title;
    const label = document.createElement("span");
    label.textContent = letter;
    const slider = document.createElement("input");
    slider.id = `color-${channel}-slider`;
    slider.className = `color-slider ${sliderClass}`;
    slider.type = "range";
    slider.min = "0";
    slider.max = String(max);
    slider.step = String(step);
    const control = document.createElement("span");
    control.className = `color-number-control${channel === "alpha" ? " color-alpha-control" : ""}`;
    const minus = document.createElement("button");
    minus.className = "color-step-button";
    minus.type = "button";
    minus.dataset.colorChannel = channel;
    minus.dataset.colorStep = String(-step);
    minus.setAttribute("aria-label", `\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C ${letter}`);
    minus.textContent = "\u2212";
    const input = document.createElement("input");
    input.id = `color-${channel}-input`;
    input.type = "number";
    input.min = "0";
    input.max = String(max);
    input.step = String(step);
    input.setAttribute("aria-label", `\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435 ${letter}`);
    const plus = document.createElement("button");
    plus.className = "color-step-button";
    plus.type = "button";
    plus.dataset.colorChannel = channel;
    plus.dataset.colorStep = String(step);
    plus.setAttribute("aria-label", `\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C ${letter}`);
    plus.textContent = "+";
    control.append(minus, input, plus);
    row.append(label, slider, control);
    return { row, slider, input, minus, plus };
  }
  function createColorPicker(options) {
    const host = options.host;
    const withAlpha = options.alpha !== false;
    const withCodes = options.codes !== false;
    const floating = options.floating || null;
    const storageKey = floating && floating.storageKey ? floating.storageKey : "";
    const saved = readStorage(storageKey);
    let mode = saved.mode === "hsl" ? "hsl" : "rgb";
    let pinned = Boolean(saved.pinned);
    let state = { red: 34, green: 145, blue: 188, alpha: 1, ...options.initial || {} };
    let hsl = rgbToHsl(state.red, state.green, state.blue);
    host.replaceChildren();
    host.classList.add("color-picker-panel");
    if (floating) host.classList.add("is-floating");
    const head = document.createElement("div");
    head.className = "color-picker-head";
    const title = document.createElement("span");
    title.className = "color-picker-title";
    title.textContent = floating ? floating.title : "\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0446\u0432\u0435\u0442\u0430";
    const modes = document.createElement("div");
    modes.className = "color-mode-switch";
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "\u0420\u0435\u0436\u0438\u043C");
    const modeButtons = {};
    for (const [key, label, hint] of [["rgb", "RGB", "\u041A\u0440\u0430\u0441\u043D\u044B\u0439, \u0437\u0435\u043B\u0451\u043D\u044B\u0439, \u0441\u0438\u043D\u0438\u0439"], ["hsl", "HSL", "\u0422\u043E\u043D, \u043D\u0430\u0441\u044B\u0449\u0435\u043D\u043D\u043E\u0441\u0442\u044C, \u0441\u0432\u0435\u0442\u043B\u043E\u0442\u0430"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-mode-button";
      button.dataset.mode = key;
      button.textContent = label;
      button.title = hint;
      button.addEventListener("click", () => setMode(key));
      modes.appendChild(button);
      modeButtons[key] = button;
    }
    head.append(title, modes);
    let pinButton = null;
    if (floating) {
      pinButton = document.createElement("button");
      pinButton.type = "button";
      pinButton.className = "color-picker-pin";
      pinButton.title = "\u041F\u043E\u0432\u0435\u0440\u0445: \u043D\u0435 \u0437\u0430\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043E\u043A\u043D\u043E \u0449\u0435\u043B\u0447\u043A\u0430\u043C\u0438 \u043C\u0438\u043C\u043E";
      pinButton.setAttribute("aria-pressed", String(pinned));
      pinButton.textContent = "\u043F\u043E\u0432\u0435\u0440\u0445";
      pinButton.addEventListener("click", () => {
        pinned = !pinned;
        pinButton.setAttribute("aria-pressed", String(pinned));
        host.classList.toggle("is-pinned", pinned);
        writeStorage(storageKey, { pinned });
      });
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "color-picker-close";
      closeButton.title = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C";
      closeButton.setAttribute("aria-label", "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0446\u0432\u0435\u0442\u0430");
      const icons = typeof window !== "undefined" ? window.IdylliumIcons : null;
      if (icons && icons.has("close")) closeButton.appendChild(icons.element("close", { size: 14 }));
      else closeButton.textContent = "\xD7";
      closeButton.addEventListener("click", () => close());
      head.append(pinButton, closeButton);
      host.classList.toggle("is-pinned", pinned);
    }
    host.appendChild(head);
    const grid = document.createElement("div");
    grid.className = "color-picker-grid";
    const controls = document.createElement("div");
    controls.className = "color-picker-controls";
    const rows = {};
    const groups = { rgb: [], hsl: [] };
    for (const [channel, letter, hint] of RGB_CHANNELS) {
      const part = channelRow({ channel, letter, title: hint, max: 255, step: 1, sliderClass: `color-slider-${channel}` });
      rows[channel] = part;
      groups.rgb.push(part.row);
      controls.appendChild(part.row);
    }
    for (const [channel, letter, hint, max] of HSL_CHANNELS) {
      const part = channelRow({ channel, letter, title: hint, max, step: 1, sliderClass: `color-slider-${channel}` });
      rows[channel] = part;
      groups.hsl.push(part.row);
      controls.appendChild(part.row);
    }
    if (withAlpha) {
      const part = channelRow({ channel: "alpha", letter: "A", title: "\u041F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C, 0\u20131 (1 \u2014 \u043D\u0435\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439)", max: 1, step: 0.01, sliderClass: "color-slider-alpha" });
      rows.alpha = part;
      controls.appendChild(part.row);
    }
    grid.appendChild(controls);
    const previewWrap = document.createElement("div");
    previewWrap.className = "color-preview-wrap";
    const preview = document.createElement("div");
    preview.id = "color-preview";
    preview.className = "color-preview";
    preview.setAttribute("aria-label", "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0446\u0432\u0435\u0442");
    const eyedropper = document.createElement("button");
    eyedropper.id = "color-eyedropper-button";
    eyedropper.className = "color-eyedropper-button";
    eyedropper.type = "button";
    eyedropper.title = "\u041F\u0438\u043F\u0435\u0442\u043A\u0430: \u043A\u043B\u0438\u043A\u043D\u0438\u0442\u0435 \u043F\u043E \u043D\u0443\u0436\u043D\u043E\u043C\u0443 \u043F\u0438\u043A\u0441\u0435\u043B\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B (Esc \u2014 \u043E\u0442\u043C\u0435\u043D\u0430)";
    const iconsApi = typeof window !== "undefined" ? window.IdylliumIcons : null;
    if (iconsApi && iconsApi.has("eyedropper")) eyedropper.appendChild(iconsApi.element("eyedropper", { size: 16 }));
    const eyedropperLabel = document.createElement("span");
    eyedropperLabel.textContent = "\u041F\u0438\u043F\u0435\u0442\u043A\u0430";
    eyedropper.appendChild(eyedropperLabel);
    previewWrap.append(preview, eyedropper);
    grid.appendChild(previewWrap);
    host.appendChild(grid);
    const codes = {};
    const codeRows = {};
    if (withCodes) {
      const list = document.createElement("div");
      list.className = "color-code-list";
      for (const [key, label] of [["rgb", "RGB"], ["hex", "HEX"], ["hsl", "HSL"]]) {
        const row = document.createElement("div");
        row.className = "color-code-row";
        row.dataset.code = key;
        const name = document.createElement("span");
        name.textContent = label;
        const code = document.createElement("code");
        code.id = `color-${key}-code`;
        const copy = document.createElement("button");
        copy.id = `copy-${key}-button`;
        copy.type = "button";
        copy.textContent = "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C";
        copy.addEventListener("click", () => {
          if (options.onCopy) options.onCopy(code.textContent, copy);
        });
        row.append(name, code, copy);
        list.appendChild(row);
        codes[key] = code;
        codeRows[key] = row;
      }
      host.appendChild(list);
    }
    function normalized(next) {
      return {
        red: byte(next.red),
        green: byte(next.green),
        blue: byte(next.blue),
        alpha: withAlpha ? Math.round(clamp(Number(next.alpha), 0, 1) * 100) / 100 : 1
      };
    }
    function applyMode() {
      for (const row of groups.rgb) row.hidden = mode !== "rgb";
      for (const row of groups.hsl) row.hidden = mode !== "hsl";
      for (const [key, button] of Object.entries(modeButtons)) {
        button.classList.toggle("is-active", key === mode);
        button.setAttribute("aria-pressed", String(key === mode));
      }
      if (withCodes) {
        codeRows.rgb.hidden = mode !== "rgb";
        codeRows.hex.hidden = mode !== "rgb";
        codeRows.hsl.hidden = mode !== "hsl";
      }
    }
    function setMode(next) {
      mode = next === "hsl" ? "hsl" : "rgb";
      writeStorage(storageKey, { mode });
      applyMode();
    }
    function render() {
      for (const [channel] of RGB_CHANNELS) {
        rows[channel].slider.value = String(state[channel]);
        if (document.activeElement !== rows[channel].input) rows[channel].input.value = String(state[channel]);
      }
      for (const [channel] of HSL_CHANNELS) {
        rows[channel].slider.value = String(hsl[channel]);
        if (document.activeElement !== rows[channel].input) rows[channel].input.value = String(hsl[channel]);
      }
      if (withAlpha) {
        rows.alpha.slider.value = formatAlpha(state.alpha);
        if (document.activeElement !== rows.alpha.input) rows.alpha.input.value = formatAlpha(state.alpha);
      }
      const at = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;
      const midLight = hsl.lightness === 0 || hsl.lightness === 100 ? 50 : hsl.lightness;
      rows.hue.slider.style.background = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => at(h, Math.max(hsl.saturation, 30), midLight)).join(", ")})`;
      rows.saturation.slider.style.background = `linear-gradient(to right, ${at(hsl.hue, 0, midLight)}, ${at(hsl.hue, 100, midLight)})`;
      rows.lightness.slider.style.background = `linear-gradient(to right, ${at(hsl.hue, hsl.saturation, 0)}, ${at(hsl.hue, hsl.saturation, 50)}, ${at(hsl.hue, hsl.saturation, 100)})`;
      preview.style.setProperty("--preview-rgb", `rgb(${state.red}, ${state.green}, ${state.blue})`);
      preview.style.setProperty("--preview-rgba", `rgba(${state.red}, ${state.green}, ${state.blue}, ${formatAlpha(state.alpha)})`);
      if (withCodes) {
        codes.rgb.textContent = state.alpha >= 1 ? `colors.RGB(${state.red}, ${state.green}, ${state.blue})` : `colors.RGBA(${state.red}, ${state.green}, ${state.blue}, ${formatAlpha(state.alpha)})`;
        codes.hex.textContent = `colors.HEX("${colorHex(state)}")`;
        codes.hsl.textContent = `colors.HSL(${hsl.hue}, ${hsl.saturation}, ${hsl.lightness})`;
      }
    }
    let silent = false;
    function commit(next, { fromHsl = false } = {}) {
      state = normalized({ ...state, ...next });
      if (!fromHsl) hsl = rgbToHsl(state.red, state.green, state.blue);
      render();
      if (!silent && options.onChange) options.onChange({ ...state, hsl: { ...hsl }, hex: colorHex(state) });
    }
    function setRgbChannel(channel, raw) {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        render();
        return;
      }
      commit({ [channel]: value });
    }
    function setHslChannel(channel, raw) {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        render();
        return;
      }
      const max = channel === "hue" ? 360 : 100;
      hsl = { ...hsl, [channel]: Math.round(clamp(value, 0, max)) };
      commit(hslToRgb(hsl.hue, hsl.saturation, hsl.lightness), { fromHsl: true });
    }
    for (const [channel] of RGB_CHANNELS) {
      rows[channel].slider.addEventListener("input", () => setRgbChannel(channel, rows[channel].slider.value));
      rows[channel].input.addEventListener("change", () => setRgbChannel(channel, rows[channel].input.value));
      rows[channel].minus.addEventListener("click", () => setRgbChannel(channel, state[channel] - 1));
      rows[channel].plus.addEventListener("click", () => setRgbChannel(channel, state[channel] + 1));
    }
    for (const [channel] of HSL_CHANNELS) {
      rows[channel].slider.addEventListener("input", () => setHslChannel(channel, rows[channel].slider.value));
      rows[channel].input.addEventListener("change", () => setHslChannel(channel, rows[channel].input.value));
      rows[channel].minus.addEventListener("click", () => setHslChannel(channel, hsl[channel] - 1));
      rows[channel].plus.addEventListener("click", () => setHslChannel(channel, hsl[channel] + 1));
    }
    if (withAlpha) {
      rows.alpha.slider.addEventListener("input", () => setRgbChannel("alpha", rows.alpha.slider.value));
      rows.alpha.input.addEventListener("change", () => setRgbChannel("alpha", rows.alpha.input.value));
      rows.alpha.minus.addEventListener("click", () => setRgbChannel("alpha", state.alpha - 0.01));
      rows.alpha.plus.addEventListener("click", () => setRgbChannel("alpha", state.alpha + 0.01));
    }
    for (const part of Object.values(rows)) {
      part.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          part.input.dispatchEvent(new Event("change"));
          part.input.blur();
          event.preventDefault();
        }
      });
    }
    setupColorEyedropper((picked) => {
      if (!picked) return;
      commit({ red: picked.red, green: picked.green, blue: picked.blue });
    });
    function place(position) {
      if (!floating) return;
      const width = host.offsetWidth || 460;
      const height = host.offsetHeight || 320;
      const left = clamp(position.left, 4, Math.max(4, window.innerWidth - width - 4));
      const top = clamp(position.top, 4, Math.max(4, window.innerHeight - height - 4));
      host.style.left = `${Math.round(left)}px`;
      host.style.top = `${Math.round(top)}px`;
    }
    if (floating) {
      host.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest("input, button, select, textarea, code, .color-preview")) return;
        const rect = host.getBoundingClientRect();
        const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        host.classList.add("is-dragging");
        const move = (moveEvent) => place({ left: moveEvent.clientX - offset.x, top: moveEvent.clientY - offset.y });
        const up = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          host.classList.remove("is-dragging");
          writeStorage(storageKey, { left: parseFloat(host.style.left), top: parseFloat(host.style.top) });
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
        event.preventDefault();
      });
      window.addEventListener("resize", () => {
        if (!host.hidden) place({ left: parseFloat(host.style.left) || 0, top: parseFloat(host.style.top) || 0 });
      });
    }
    function open(anchorPosition) {
      host.hidden = false;
      if (floating) {
        const stored = readStorage(storageKey);
        if (Number.isFinite(stored.left) && Number.isFinite(stored.top)) place({ left: stored.left, top: stored.top });
        else if (anchorPosition) place(anchorPosition);
        else place({ left: window.innerWidth - (host.offsetWidth || 460) - 24, top: 80 });
      }
    }
    function close() {
      if (host.hidden) return;
      host.hidden = true;
      if (floating && floating.onClose) floating.onClose();
    }
    applyMode();
    render();
    return {
      element: host,
      getState: () => ({ ...state, hsl: { ...hsl }, hex: colorHex(state) }),
      setState: (next, { quiet = false } = {}) => {
        silent = quiet;
        try {
          commit(next);
        } finally {
          silent = false;
        }
      },
      getHex: () => colorHex(state),
      setHex: (text, { quiet = false } = {}) => {
        const parsed = parseHex(text);
        if (!parsed) return false;
        silent = quiet;
        try {
          commit(withAlpha ? parsed : { red: parsed.red, green: parsed.green, blue: parsed.blue });
        } finally {
          silent = false;
        }
        return true;
      },
      setTitle: (text) => {
        title.textContent = text;
      },
      getMode: () => mode,
      setMode,
      open,
      close,
      isOpen: () => !host.hidden,
      isPinned: () => pinned,
      isEyedropperActive: () => eyedropper.classList.contains("eyedropper-active")
    };
  }

  // packages/web-ide/src/zip-write.js
  var CRC32_TABLE = buildCrc32Table();
  function zipBytes(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const nameBytes = new TextEncoder().encode(entry.name);
      const data = entry.bytes;
      const crc = crc32(data);
      const localHeader = zipHeader(30);
      localHeader.setUint32(0, 67324752, true);
      localHeader.setUint16(4, 20, true);
      localHeader.setUint16(6, 2048, true);
      localHeader.setUint16(8, 0, true);
      localHeader.setUint16(10, dosTime().time, true);
      localHeader.setUint16(12, dosTime().date, true);
      localHeader.setUint32(14, crc, true);
      localHeader.setUint32(18, data.length, true);
      localHeader.setUint32(22, data.length, true);
      localHeader.setUint16(26, nameBytes.length, true);
      localHeader.setUint16(28, 0, true);
      chunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);
      const centralHeader = zipHeader(46);
      centralHeader.setUint32(0, 33639248, true);
      centralHeader.setUint16(4, 20, true);
      centralHeader.setUint16(6, 20, true);
      centralHeader.setUint16(8, 2048, true);
      centralHeader.setUint16(10, 0, true);
      centralHeader.setUint16(12, dosTime().time, true);
      centralHeader.setUint16(14, dosTime().date, true);
      centralHeader.setUint32(16, crc, true);
      centralHeader.setUint32(20, data.length, true);
      centralHeader.setUint32(24, data.length, true);
      centralHeader.setUint16(28, nameBytes.length, true);
      centralHeader.setUint16(30, 0, true);
      centralHeader.setUint16(32, 0, true);
      centralHeader.setUint16(34, 0, true);
      centralHeader.setUint16(36, 0, true);
      centralHeader.setUint32(38, 0, true);
      centralHeader.setUint32(42, offset, true);
      central.push(new Uint8Array(centralHeader.buffer), nameBytes);
      offset += localHeader.byteLength + nameBytes.length + data.length;
    }
    const centralOffset = offset;
    const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = zipHeader(22);
    end.setUint32(0, 101010256, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, centralOffset, true);
    end.setUint16(20, 0, true);
    return concatBytes([...chunks, ...central, new Uint8Array(end.buffer)]);
  }
  function zipHeader(size) {
    return new DataView(new ArrayBuffer(size));
  }
  function dosTime() {
    const now = /* @__PURE__ */ new Date();
    return {
      time: now.getHours() << 11 | now.getMinutes() << 5 | Math.floor(now.getSeconds() / 2),
      date: now.getFullYear() - 1980 << 9 | now.getMonth() + 1 << 5 | now.getDate()
    };
  }
  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  function crc32(bytes) {
    let crc = 4294967295;
    for (const byte2 of bytes) {
      crc = CRC32_TABLE[(crc ^ byte2) & 255] ^ crc >>> 8;
    }
    return (crc ^ 4294967295) >>> 0;
  }
  function buildCrc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  // packages/gui-designer/src/main.js
  var STORAGE_KEY = "idyllium-gui-designer";
  var FILES_DB_NAME = "idyllium-gui-designer-files";
  var FILES_DB_STORE = "files";
  var THEME_KEY = "idyllium-docs-theme";
  var CLIPBOARD_MARK = "idyllium-gui-designer-clipboard:";
  var WINDOW_TITLE_HEIGHT = 28;
  var MIN_SIZE = 8;
  var api = window.Idyllium;
  var $ = (id) => document.getElementById(id);
  var els = {
    designer: $("designer"),
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
    embedToggle: $("embed-model-toggle"),
    openIde: $("open-ide"),
    copyCode: $("copy-code"),
    downloadCode: $("download-code"),
    saveModel: $("save-model"),
    openModel: $("open-model"),
    openModelInput: $("open-model-input"),
    contextMenu: $("context-menu"),
    stagePane: $("stage-pane"),
    codePane: $("code-pane"),
    codeCollapse: $("code-collapse"),
    moreMenu: $("more-menu"),
    dialog: $("dialog"),
    dialogTitle: $("dialog-title"),
    dialogBody: $("dialog-body"),
    dialogOk: $("dialog-ok"),
    dialogCancel: $("dialog-cancel"),
    fontInput: $("font-file-input")
  };
  var model = null;
  var selectedId = null;
  var selection = /* @__PURE__ */ new Set();
  var treeDrag = null;
  var marquee = null;
  var fontFiles = /* @__PURE__ */ new Map();
  var pendingFontTarget = null;
  var history = [];
  var future = [];
  var ui = { grid: true, gridSize: 5, embedModel: false, codeCollapsed: false, layout: { palette: 236, side: 340, code: 232, tree: 34 } };
  var previewTabs = {};
  var lastRects = /* @__PURE__ */ new Map();
  var lastOrigins = /* @__PURE__ */ new Map();
  var tabOrigins = /* @__PURE__ */ new Map();
  var contentRect = null;
  var frameReady = false;
  var runToken = 0;
  var runTimer = null;
  var memoryClipboard = null;
  var dragging = null;
  var colorPanel = null;
  var colorBinding = null;
  function newModel() {
    return {
      version: import_codegen.MODEL_VERSION,
      window: { name: "win", props: { title: "\u041E\u043A\u043D\u043E", width: 640, height: 420 }, handlers: [] },
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
    return [model.window.name, ...model.widgets.map((item) => item.name), ...(0, import_codegen.fontsOf)(model).map((font) => font.name)];
  }
  function pruneSelection() {
    selection = new Set([...selection].filter((id) => widgetById(id)));
    if (selectedId !== null && !widgetById(selectedId)) selectedId = selection.size > 0 ? [...selection][selection.size - 1] : null;
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
    pruneSelection();
    refresh();
  }
  function redo() {
    if (future.length === 0) return;
    history.push(snapshot());
    model = JSON.parse(future.pop());
    pruneSelection();
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
      const savedUi = saved.ui || {};
      ui = { ...ui, ...savedUi, layout: { ...ui.layout, ...savedUi.layout || {} } };
      previewTabs = saved.previewTabs || {};
      return true;
    } catch (error) {
      return false;
    }
  }
  function validateModel(raw) {
    if (!raw || typeof raw !== "object" || !raw.window || !Array.isArray(raw.widgets)) return null;
    const result = { version: import_codegen.MODEL_VERSION, window: { name: "win", props: {}, handlers: [] }, widgets: [] };
    if (typeof raw.window.name === "string" && !(0, import_widgets.nameProblem)(raw.window.name, [])) result.window.name = raw.window.name;
    result.window.props = cleanProps("Window", raw.window.props);
    result.window.handlers = cleanHandlers("Window", raw.window.handlers);
    const ids = /* @__PURE__ */ new Set();
    for (const item of raw.widgets) {
      if (!item || typeof item !== "object" || !import_widgets.WIDGETS[item.type] || typeof item.id !== "number" || ids.has(item.id)) continue;
      ids.add(item.id);
      const widget = {
        id: item.id,
        type: item.type,
        name: typeof item.name === "string" && !(0, import_widgets.nameProblem)(item.name, []) ? item.name : `${import_widgets.WIDGETS[item.type].defaultName}${item.id}`,
        parent: typeof item.parent === "number" ? item.parent : null,
        props: cleanProps(item.type, item.props),
        handlers: cleanHandlers(item.type, item.handlers)
      };
      if (typeof item.tabTitle === "string") widget.tabTitle = item.tabTitle;
      const data = cleanData(item.type, item.data);
      if (data) widget.data = data;
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
    const fonts = [];
    for (const font of Array.isArray(raw.fonts) ? raw.fonts : []) {
      if (!font || typeof font.name !== "string" || typeof font.file !== "string" || font.file.trim() === "") continue;
      if ((0, import_widgets.nameProblem)(font.name, [result.window.name, ...names, ...fonts.map((known) => known.name)])) continue;
      fonts.push({ name: font.name, file: font.file });
    }
    if (fonts.length > 0) result.fonts = fonts;
    const fontNames = new Set(fonts.map((font) => font.name));
    const dropUnknownFont = (props) => {
      if (props.font !== void 0 && !fontNames.has(props.font)) delete props.font;
    };
    dropUnknownFont(result.window.props);
    for (const widget of result.widgets) dropUnknownFont(widget.props);
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
      if (prop.kind === "font" && typeof value !== "string") continue;
      result[name] = prop.kind === "bool" ? Boolean(value) : prop.kind === "int" ? Math.round(Number(value)) : prop.kind === "float" ? Number(value) : prop.kind === "color" ? (0, import_codegen.normalizeHex)(value) : String(value);
    }
    return result;
  }
  function cleanData(type, raw) {
    const def = import_widgets.WIDGETS[type];
    if (!def || !def.data || !raw || typeof raw !== "object") return null;
    const strings = (list) => Array.isArray(list) ? list.filter((item) => typeof item === "string" || typeof item === "number").map(String) : [];
    const numbers = (list) => Array.isArray(list) ? list.map(Number).filter((item) => Number.isFinite(item)) : [];
    switch (def.data.shape) {
      case "strings":
        return { items: strings(raw.items) };
      case "table":
        return { columns: strings(raw.columns), rows: (Array.isArray(raw.rows) ? raw.rows : []).map((row) => strings(row)) };
      case "entries":
        return { entries: (Array.isArray(raw.entries) ? raw.entries : []).filter((entry) => entry && typeof entry === "object").map((entry) => ({ label: String(entry.label ?? ""), value: Number.isFinite(Number(entry.value)) ? Number(entry.value) : 0 })) };
      case "numbers":
        return { points: numbers(raw.points) };
      default:
        return null;
    }
  }
  function sampleData(def) {
    switch (def.data && def.data.shape) {
      case "strings":
        return { items: ["\u041F\u0443\u043D\u043A\u0442 1", "\u041F\u0443\u043D\u043A\u0442 2", "\u041F\u0443\u043D\u043A\u0442 3"] };
      case "table":
        return { columns: ["\u0418\u043C\u044F", "\u0417\u043D\u0430\u0447\u0435\u043D\u0438\u0435"], rows: [["\u041C\u0438\u0440\u0430", "12"], ["\u041A\u0430\u0439", "9"]] };
      case "entries":
        return { entries: [{ label: "\u041C\u0438\u0440\u0430", value: 340 }, { label: "\u041A\u0430\u0439", value: 120 }, { label: "\u041D\u0438\u043A\u0430", value: 210 }] };
      case "numbers":
        return { points: [3, 5, 4, 8, 6] };
      default:
        return null;
    }
  }
  function cleanHandlers(type, handlers) {
    if (!Array.isArray(handlers)) return [];
    const known = (0, import_widgets.eventsOf)(type).map((event) => event.name);
    return handlers.filter((name) => known.includes(name));
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
  var dialogResolve = null;
  function showDialog({ title, body, ok = "\u0414\u0430", cancel = "\u041E\u0442\u043C\u0435\u043D\u0430" }) {
    els.dialogTitle.textContent = title;
    els.dialogBody.replaceChildren();
    if (typeof body === "string") {
      const paragraph = document.createElement("p");
      paragraph.textContent = body;
      els.dialogBody.appendChild(paragraph);
    } else {
      els.dialogBody.appendChild(body);
    }
    els.dialogOk.textContent = ok;
    els.dialogCancel.textContent = cancel;
    els.dialogCancel.hidden = cancel === null;
    els.dialog.hidden = false;
    els.dialogOk.focus();
    return new Promise((resolve) => {
      dialogResolve = resolve;
    });
  }
  function closeDialog(result) {
    if (!dialogResolve) return;
    const resolve = dialogResolve;
    dialogResolve = null;
    els.dialog.hidden = true;
    resolve(result);
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
    if (!forPreview) return (0, import_codegen.generateCode)(model, { embedModel: ui.embedModel });
    return (0, import_codegen.generateCode)((0, import_codegen.withoutMissingFonts)(model, (file) => fontFiles.has(file)).model, { previewTabs });
  }
  function previewFiles(code) {
    const files = { "main.idyl": code };
    for (const font of (0, import_codegen.fontsOf)(model)) {
      const bytes = fontFiles.get(font.file);
      if (bytes) files[font.file] = { bytes };
    }
    return files;
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
      result = await api.runIdylliumInBrowser({ entryFile: "main.idyl", files: previewFiles(code) });
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
    postToPreview({ type: "snapshot", generation: 1, audio: [], windows: result.windows, canvases: [], modals: [], output: "" });
    const lineCount = code.split("\n").length - 1;
    const missingFonts = (0, import_codegen.withoutMissingFonts)(model, (file) => fontFiles.has(file)).missing;
    const fontsNote = missingFonts.length > 0 ? ` \xB7 \u043D\u0435\u0442 \u0444\u0430\u0439\u043B\u0430 \u0448\u0440\u0438\u0444\u0442\u0430: ${missingFonts.map((font) => font.file).join(", ")} \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0435\u0433\u043E \u0437\u0430\u043D\u043E\u0432\u043E \u0432 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0435 font` : "";
    setStatus(`\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043C\u0430\u043A\u0435\u0442\u0430 \u0441\u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0438 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430: ${lineCount} \u0441\u0442\u0440\u043E\u043A, \u0432\u0438\u0434\u0436\u0435\u0442\u043E\u0432: ${model.widgets.length}${fontsNote}`, missingFonts.length > 0);
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
    const origins = /* @__PURE__ */ new Map();
    const tabs = /* @__PURE__ */ new Map();
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
          const remember = (widget, element) => {
            const box = toScene(element.getBoundingClientRect());
            rects.set(widget.id, box);
            origins.set(widget.id, { left: box.left - Number(widget.props.x || 0), top: box.top - Number(widget.props.y || 0) });
          };
          items.forEach((item, index) => {
            const el = elements[index];
            if (!el) return;
            remember(item, el);
            const def = (0, import_widgets.widgetDefinition)(item.type);
            if (def.container === "children") matchChildren(el, item.id);
            if (def.container === "tabs") {
              const pages = (0, import_codegen.childrenOf)(model, item.id);
              const shown = Math.min(Math.max(previewTabs[item.id] || 0, 0), Math.max(pages.length - 1, 0));
              const pageHost = el.querySelector(".tabpage");
              const pageElement = pageHost ? widgetElements(pageHost)[0] : null;
              const page = pages[shown];
              if (page && pageElement) {
                remember(page, pageElement);
                tabs.set(item.id, origins.get(page.id));
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
    lastOrigins = origins;
    tabOrigins = tabs;
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
    if (tabOrigins.has(containerId)) return tabOrigins.get(containerId);
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
    const ordered = [];
    const visit = (parentId) => {
      for (const child of (0, import_codegen.childrenOf)(model, parentId)) {
        ordered.push(child);
        visit(child.id);
      }
    };
    visit(null);
    for (const item of ordered) {
      const rect = rectOf(item.id);
      if (!rect) continue;
      const box = document.createElement("div");
      box.className = "overlay-widget";
      box.dataset.id = String(item.id);
      if (selection.has(item.id)) box.classList.add("is-selected");
      if (item.id === selectedId) box.classList.add("is-primary");
      if (item.props.visible === false) box.classList.add("is-hidden");
      if (item.tabTitle !== void 0) box.classList.add("is-page");
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.title = `${item.name}: gui.${item.type}`;
      overlay.appendChild(box);
      if (item.id === selectedId && selection.size <= 1) {
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
  function select(id, { toggle = false, add = false } = {}) {
    if (id === null) {
      selection = /* @__PURE__ */ new Set();
      selectedId = null;
    } else if (toggle) {
      if (selection.has(id)) {
        selection.delete(id);
        selectedId = selection.size > 0 ? [...selection][selection.size - 1] : null;
      } else {
        selection.add(id);
        selectedId = id;
      }
    } else if (add) {
      selection.add(id);
      selectedId = id;
    } else {
      selection = /* @__PURE__ */ new Set([id]);
      selectedId = id;
    }
    renderTree();
    renderInspector();
    renderOverlay();
  }
  function selectMany(ids) {
    selection = new Set(ids.filter((id) => widgetById(id)));
    selectedId = selection.size > 0 ? [...selection][selection.size - 1] : null;
    renderTree();
    renderInspector();
    renderOverlay();
  }
  function movableRoots() {
    return (0, import_model_ops.selectionRoots)(model, [...selection]).filter((id) => {
      const item = widgetById(id);
      return item && item.tabTitle === void 0;
    });
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
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        select(id, { toggle: true });
        els.overlay.focus();
        event.preventDefault();
        return;
      }
      if (!selection.has(id)) select(id);
      else if (selectedId !== id) {
        selectedId = id;
        renderTree();
        renderInspector();
        renderOverlay();
      }
      if (item.tabTitle !== void 0) {
        els.overlay.focus();
        return;
      }
      const ids = movableRoots().includes(id) ? movableRoots() : [id];
      dragging = {
        kind: "move",
        id,
        ids,
        start: point,
        origins: new Map(ids.map((rootId) => {
          const root = widgetById(rootId);
          return [rootId, { x: Number(root.props.x || 0), y: Number(root.props.y || 0) }];
        })),
        before: snapshot(),
        moved: false,
        rect: rectOf(id)
      };
      capturePointer(event);
      event.preventDefault();
      return;
    }
    if (selectedId !== null || selection.size > 0) select(null);
    dragging = { kind: "marquee", start: point, moved: false };
    capturePointer(event);
    els.overlay.focus();
  });
  function marqueeRect(point) {
    const left = Math.min(dragging.start.x, point.x);
    const top = Math.min(dragging.start.y, point.y);
    return { left, top, width: Math.abs(point.x - dragging.start.x), height: Math.abs(point.y - dragging.start.y) };
  }
  function updateMarquee(point) {
    const rect = marqueeRect(point);
    if (!marquee) {
      marquee = document.createElement("div");
      marquee.className = "overlay-marquee";
      els.scene.appendChild(marquee);
    }
    marquee.style.left = `${rect.left}px`;
    marquee.style.top = `${rect.top}px`;
    marquee.style.width = `${rect.width}px`;
    marquee.style.height = `${rect.height}px`;
    const hit = [];
    for (const item of model.widgets) {
      if (item.tabTitle !== void 0) continue;
      const box = rectOf(item.id);
      if (!box) continue;
      const overlaps = box.left < rect.left + rect.width && box.left + box.width > rect.left && box.top < rect.top + rect.height && box.top + box.height > rect.top;
      if (overlaps) hit.push(item.id);
    }
    const same = hit.length === selection.size && hit.every((id) => selection.has(id));
    if (!same) selectMany(hit);
  }
  function removeMarquee() {
    if (marquee) marquee.remove();
    marquee = null;
  }
  els.overlay.addEventListener("pointermove", (event) => {
    if (!dragging || dragging.kind === "place") return;
    const point = scenePoint(event);
    const dx = point.x - dragging.start.x;
    const dy = point.y - dragging.start.y;
    if (!dragging.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    dragging.moved = true;
    if (dragging.kind === "marquee") {
      updateMarquee(point);
      return;
    }
    const item = widgetById(dragging.id);
    if (!item) return;
    if (dragging.kind === "move") {
      const single = dragging.ids.length === 1;
      const origin = dragging.origins.get(item.id);
      let nx = origin.x + dx;
      let ny = origin.y + dy;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) ny = origin.y;
        else nx = origin.x;
      }
      const target = single ? containerAt(point.x, point.y, item.id) : item.parent;
      if (single && target !== item.parent) {
        const oldOrigin = containerOrigin(item.parent);
        const newOrigin = containerOrigin(target);
        dragging.origins.set(item.id, { x: origin.x + (oldOrigin.left - newOrigin.left), y: origin.y + (oldOrigin.top - newOrigin.top) });
        item.parent = target;
        model.widgets = [...model.widgets.filter((other) => other.id !== item.id), item];
        nx = dragging.origins.get(item.id).x + dx;
        ny = dragging.origins.get(item.id).y + dy;
        renderTree();
      }
      item.props.x = Math.max(0, snap(nx));
      item.props.y = Math.max(0, snap(ny));
      for (const rootId of dragging.ids) {
        if (rootId === item.id) continue;
        const root = widgetById(rootId);
        const rootOrigin = dragging.origins.get(rootId);
        if (!root || !rootOrigin) continue;
        root.props.x = Math.max(0, snap(rootOrigin.x + (event.shiftKey && Math.abs(dx) <= Math.abs(dy) ? 0 : dx)));
        root.props.y = Math.max(0, snap(rootOrigin.y + (event.shiftKey && Math.abs(dx) > Math.abs(dy) ? 0 : dy)));
        moveOverlayBox(root);
      }
      for (const box of els.overlay.querySelectorAll(".is-drop-target")) box.classList.remove("is-drop-target");
      if (single) {
        const targetBox = target === null ? els.overlay.querySelector(".overlay-window") : els.overlay.querySelector(`.overlay-widget[data-id="${target}"]`);
        if (targetBox) targetBox.classList.add("is-drop-target");
      }
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
    const origin = lastOrigins.get(item.id) || containerOrigin(item.parent);
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
    if (drag.kind === "marquee") {
      removeMarquee();
      return;
    }
    for (const box of els.overlay.querySelectorAll(".is-drop-target")) box.classList.remove("is-drop-target");
    if (!drag.moved) return;
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
        button.title = def.hint ? `${def.label} \u2014 ${def.hint}` : def.label;
        const icon = document.createElement("span");
        icon.className = "palette-icon";
        icon.dataset.icon = def.icon;
        if (window.IdylliumIcons && window.IdylliumIcons.has(def.icon)) {
          icon.appendChild(window.IdylliumIcons.element(def.icon, { size: 18 }));
          button.classList.add("has-icon");
        }
        const label = document.createElement("span");
        label.textContent = type;
        button.append(icon, label);
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
        ghost.textContent = `${import_widgets.WIDGETS[type].label} (${type})`;
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
      const item = { id, type, name, parent: null, props: {}, handlers: [] };
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
      const data = sampleData(def);
      if (data) item.data = data;
      model.widgets.push(item);
      if (def.container === "tabs") {
        addTabPage(item, "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 1");
        addTabPage(item, "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 2");
        previewTabs[item.id] = 0;
      }
      selectedId = id;
      selection = /* @__PURE__ */ new Set([id]);
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
      handlers: [],
      tabTitle: title
    };
    model.widgets.push(page);
    return page;
  }
  function renderTree() {
    els.tree.replaceChildren();
    els.tree.appendChild(treeRow({ name: model.window.name, type: "Window", id: null, depth: 0 }));
    const walk = (parentId, depth) => {
      for (const item of (0, import_codegen.childrenOf)(model, parentId)) {
        els.tree.appendChild(treeRow({ item, depth }));
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
    if (widgetId === selectedId || item && selection.has(item.id)) row.classList.add("is-selected");
    if (widgetId === selectedId) row.classList.add("is-primary");
    if (item && item.props.visible === false) row.classList.add("is-hidden");
    if (window.IdylliumIcons) {
      const iconName = item ? import_widgets.WIDGETS[item.type].icon : "section-designer";
      row.appendChild(window.IdylliumIcons.element(iconName, { size: 14, className: "tree-icon" }));
    }
    const nameEl = document.createElement("span");
    nameEl.className = "tree-name";
    nameEl.textContent = item ? item.name : name;
    const typeEl = document.createElement("span");
    typeEl.className = "tree-type";
    typeEl.textContent = item ? item.tabTitle !== void 0 ? `\u0432\u043A\u043B\u0430\u0434\u043A\u0430 \xAB${item.tabTitle}\xBB` : `gui.${item.type}` : `gui.${type}`;
    row.append(nameEl, typeEl);
    row.addEventListener("click", (event) => {
      if (treeDrag && treeDrag.moved) return;
      if (item && item.tabTitle !== void 0) {
        const pages = (0, import_codegen.childrenOf)(model, item.parent);
        previewTabs[item.parent] = pages.indexOf(item);
        persist();
        scheduleRun(0);
      }
      if (item && (event.ctrlKey || event.metaKey || event.shiftKey)) select(widgetId, { toggle: true });
      else select(widgetId);
    });
    if (item) row.addEventListener("pointerdown", (event) => startTreeDrag(event, item));
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      select(widgetId);
      if (item) showContextMenu(event.clientX, event.clientY, item);
    });
    return row;
  }
  function startTreeDrag(event, item) {
    if (event.button !== 0) return;
    treeDrag = { id: item.id, startX: event.clientX, startY: event.clientY, moved: false, target: null, ghost: null };
    const clearMarks = () => {
      for (const row of els.tree.querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-into, .is-drop-invalid")) {
        row.classList.remove("is-drop-before", "is-drop-after", "is-drop-into", "is-drop-invalid");
      }
    };
    const onMove = (move) => {
      if (!treeDrag) return;
      if (!treeDrag.moved && Math.hypot(move.clientX - treeDrag.startX, move.clientY - treeDrag.startY) < 4) return;
      if (!treeDrag.moved) {
        treeDrag.moved = true;
        hideContextMenu();
        treeDrag.ghost = document.createElement("div");
        treeDrag.ghost.className = "palette-ghost";
        treeDrag.ghost.textContent = `${item.name} (${item.type})`;
        document.body.appendChild(treeDrag.ghost);
        document.body.classList.add("is-tree-dragging");
      }
      treeDrag.ghost.style.left = `${move.clientX + 12}px`;
      treeDrag.ghost.style.top = `${move.clientY + 12}px`;
      clearMarks();
      treeDrag.target = null;
      const row = [...els.tree.querySelectorAll(".tree-row")].find((candidate) => {
        const box2 = candidate.getBoundingClientRect();
        return move.clientX >= box2.left && move.clientX <= box2.right && move.clientY >= box2.top && move.clientY <= box2.bottom;
      }) || null;
      if (!row) return;
      const overId = row.dataset.id === "" ? null : Number(row.dataset.id);
      const over = overId === null ? null : widgetById(overId);
      const box = row.getBoundingClientRect();
      const quarter = box.height / 4;
      let where;
      if (overId === null) where = "into";
      else if (move.clientY < box.top + quarter) where = "before";
      else if (move.clientY > box.bottom - quarter) where = "after";
      else where = over && (0, import_widgets.widgetDefinition)(over.type).container ? "into" : "after";
      let target;
      if (where === "into") target = { parent: overId, before: null };
      else {
        const siblings = (0, import_codegen.childrenOf)(model, over.parent);
        const index = siblings.indexOf(over);
        target = { parent: over.parent, before: where === "before" ? over.id : siblings[index + 1] ? siblings[index + 1].id : null };
      }
      const probe = JSON.parse(JSON.stringify((0, import_codegen.stripModel)(model)));
      const verdict = (0, import_model_ops.moveSubtree)(probe, item.id, target);
      if (!verdict.ok) {
        row.classList.add("is-drop-invalid");
        treeDrag.ghost.textContent = `${item.name}: ${verdict.reason}`;
        return;
      }
      treeDrag.ghost.textContent = `${item.name} (${item.type})`;
      row.classList.add(`is-drop-${where}`);
      treeDrag.target = target;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      clearMarks();
      const drag = treeDrag;
      if (drag && drag.ghost) drag.ghost.remove();
      document.body.classList.remove("is-tree-dragging");
      if (!drag || !drag.moved) {
        treeDrag = null;
        return;
      }
      if (drag.target) {
        applyChange(() => {
          const verdict = (0, import_model_ops.moveSubtree)(model, drag.id, drag.target);
          if (!verdict.ok) {
            setStatus(verdict.reason, true);
            return;
          }
          const moved = widgetById(drag.id);
          if (moved && moved.tabTitle !== void 0) previewTabs[moved.parent] = (0, import_codegen.childrenOf)(model, moved.parent).indexOf(moved);
          selection = /* @__PURE__ */ new Set([drag.id]);
          selectedId = drag.id;
        });
      }
      setTimeout(() => {
        treeDrag = null;
      }, 0);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
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
    if (!isPage) add("\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C (Ctrl+D)", () => {
      if (!selection.has(item.id)) select(item.id);
      duplicateSelection();
    });
    if ((0, import_widgets.widgetDefinition)(item.type).container === "tabs") add("\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u043A\u043B\u0430\u0434\u043A\u0443", () => applyChange(() => {
      addTabPage(item, `\u0412\u043A\u043B\u0430\u0434\u043A\u0430 ${(0, import_codegen.childrenOf)(model, item.id).length + 1}`);
    }));
    separator();
    const siblings = (0, import_codegen.childrenOf)(model, item.parent);
    const index = siblings.indexOf(item);
    add(isPage ? "\u0412\u043A\u043B\u0430\u0434\u043A\u0443 \u043B\u0435\u0432\u0435\u0435" : "\u0420\u0430\u043D\u044C\u0448\u0435 \u0432 \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F (\u043D\u0438\u0436\u0435 \u043F\u043E \u0441\u043B\u043E\u044E)", () => reorder(item.id, -1), index <= 0);
    add(isPage ? "\u0412\u043A\u043B\u0430\u0434\u043A\u0443 \u043F\u0440\u0430\u0432\u0435\u0435" : "\u041F\u043E\u0437\u0436\u0435 \u0432 \u043F\u043E\u0440\u044F\u0434\u043A\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F (\u0432\u044B\u0448\u0435 \u043F\u043E \u0441\u043B\u043E\u044E)", () => reorder(item.id, 1), index >= siblings.length - 1);
    separator();
    const doomed = selection.has(item.id) && selection.size > 1 ? [...selection] : [item.id];
    add(doomed.length > 1 ? `\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0435 (${doomed.length})` : "\u0423\u0434\u0430\u043B\u0438\u0442\u044C (Delete)", () => deleteWidgets(doomed));
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
    if (event.target instanceof Element && !event.target.closest("#more-menu")) els.moreMenu.open = false;
  });
  els.overlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const target = event.target instanceof HTMLElement ? event.target.closest(".overlay-widget") : null;
    if (!target) return;
    const item = widgetById(Number(target.dataset.id));
    if (!item) return;
    select(item.id);
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
  function deleteWidgets(ids) {
    applyChange(() => {
      const doomed = /* @__PURE__ */ new Set();
      let fallback = null;
      for (const id of ids) {
        const item = widgetById(id);
        if (!item) continue;
        if (item.tabTitle !== void 0) {
          const pages = (0, import_codegen.childrenOf)(model, item.parent).filter((page) => !doomed.has(page.id));
          if (pages.length <= 1) {
            setStatus("\u0423 \u0432\u043A\u043B\u0430\u0434\u043E\u043A \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0441\u0442\u0430\u0442\u044C\u0441\u044F \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430", true);
            continue;
          }
          previewTabs[item.parent] = 0;
        }
        doomed.add(id);
        for (const child of descendants(id)) doomed.add(child.id);
        if (fallback === null) fallback = item.parent;
      }
      if (doomed.size === 0) return;
      model.widgets = model.widgets.filter((other) => !doomed.has(other.id));
      selection = /* @__PURE__ */ new Set();
      selectedId = fallback !== null && widgetById(fallback) && !doomed.has(fallback) ? fallback : null;
      if (selectedId !== null) selection.add(selectedId);
    });
  }
  function deleteWidget(id) {
    deleteWidgets([id]);
  }
  function duplicateSelection() {
    const roots = movableRoots();
    if (roots.length === 0) return;
    pastePayload(copyPayload(roots), { offset: 10 });
  }
  function copyPayload(rootIds) {
    const ids = Array.isArray(rootIds) ? rootIds : [rootIds];
    const widgets = [];
    for (const id of ids) {
      const item = widgetById(id);
      if (!item) continue;
      for (const widget of [item, ...descendants(id)]) if (!widgets.some((known) => known.id === widget.id)) widgets.push(JSON.parse(JSON.stringify(widget)));
    }
    return { roots: ids.filter((id) => widgets.some((widget) => widget.id === id)), widgets };
  }
  function pastePayload(payload, { offset = 10 } = {}) {
    if (!payload || !Array.isArray(payload.widgets) || payload.widgets.length === 0) return;
    const rootIds = Array.isArray(payload.roots) ? payload.roots : [payload.root !== void 0 ? payload.root : payload.widgets[0].id];
    applyChange(() => {
      const idMap = /* @__PURE__ */ new Map();
      const taken = takenNames();
      const pastedRoots = [];
      for (const source of payload.widgets) {
        if (!import_widgets.WIDGETS[source.type]) continue;
        idMap.set(source.id, nextId() + idMap.size);
      }
      for (const source of payload.widgets) {
        if (!idMap.has(source.id)) continue;
        const isRoot = rootIds.includes(source.id);
        const rootParent = source.parent !== null && widgetById(source.parent) && !idMap.has(source.parent) ? source.parent : null;
        const copy = {
          id: idMap.get(source.id),
          type: source.type,
          name: (0, import_widgets.freeName)(import_widgets.WIDGETS[source.type].defaultName, taken),
          parent: isRoot ? rootParent : idMap.get(source.parent) ?? rootParent,
          props: cleanProps(source.type, source.props),
          handlers: cleanHandlers(source.type, source.handlers)
        };
        const copiedData = cleanData(source.type, source.data);
        if (copiedData) copy.data = copiedData;
        if (source.tabTitle !== void 0) copy.tabTitle = String(source.tabTitle);
        if (isRoot) {
          copy.props.x = Number(copy.props.x || 0) + offset;
          copy.props.y = Number(copy.props.y || 0) + offset;
          pastedRoots.push(copy.id);
        }
        taken.push(copy.name);
        model.widgets.push(copy);
      }
      selection = new Set(pastedRoots);
      selectedId = pastedRoots.length > 0 ? pastedRoots[pastedRoots.length - 1] : selectedId;
    });
  }
  async function copySelection() {
    const roots = movableRoots();
    if (roots.length === 0) return;
    memoryClipboard = copyPayload(roots);
    try {
      await navigator.clipboard.writeText(CLIPBOARD_MARK + JSON.stringify(memoryClipboard));
    } catch (error) {
    }
    setStatus(`\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E: ${roots.map((id) => widgetById(id).name).join(", ")}`);
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
    if (selection.size > 1) {
      renderGroupInspector(container);
      return;
    }
    const item = selectedId !== null ? widgetById(selectedId) : null;
    const props = item ? item.props : model.window.props;
    const def = item ? (0, import_widgets.widgetDefinition)(item.type) : null;
    const type = item ? item.type : "Window";
    els.inspectorTitle.textContent = item ? `${item.name}: gui.${item.type}` : `${model.window.name}: gui.Window`;
    const nameGroup = groupBox("\u0418\u043C\u044F");
    const nameField = document.createElement("div");
    nameField.className = "field is-explicit";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "name";
    nameLabel.title = "\u0418\u043C\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0432 \u043A\u043E\u0434\u0435";
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
      tabGroup.appendChild(textField("\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A", "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0432\u043A\u043B\u0430\u0434\u043A\u0438 \u2014 \u043F\u0435\u0440\u0432\u044B\u0439 \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442 add_tab", item.tabTitle, (value) => applyChange(() => {
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
      for (const prop of groupProps) box.appendChild(propertyField(prop, props, (value) => setProperty(item, prop, value), item));
      container.appendChild(box);
    }
    if (item && def.data) container.appendChild(dataEditor(item, def));
    if (!item) container.appendChild(fontsEditor());
    const events = (0, import_widgets.eventsOf)(type);
    if (events.length > 0) {
      const box = groupBox("\u0417\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u0432");
      const owner = item || model.window;
      for (const event of events) {
        const row = document.createElement("label");
        row.className = "event-row";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.dataset.event = event.name;
        check.checked = Array.isArray(owner.handlers) && owner.handlers.includes(event.name);
        check.addEventListener("change", () => applyChange(() => {
          const target = item ? widgetById(item.id) : model.window;
          const list = new Set(Array.isArray(target.handlers) ? target.handlers : []);
          if (check.checked) list.add(event.name);
          else list.delete(event.name);
          target.handlers = events.map((known) => known.name).filter((name) => list.has(name));
        }));
        const code = document.createElement("code");
        code.textContent = event.name + (event.params ? `(${event.params})` : "()");
        const hint = document.createElement("small");
        hint.textContent = event.comment;
        row.title = `\u0412 \u043A\u043E\u0434 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u0441\u044F \u043F\u0443\u0441\u0442\u0430\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u044F: ${event.comment}`;
        row.append(check, code, hint);
        box.appendChild(row);
      }
      container.appendChild(box);
    }
    if (def && def.hint) {
      const note = document.createElement("p");
      note.className = "inspector-empty";
      note.textContent = def.hint;
      container.appendChild(note);
    }
  }
  function renderGroupInspector(container) {
    const ids = [...selection].filter((id) => widgetById(id));
    const anchor = widgetById(ids[0]);
    els.inspectorTitle.textContent = `\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ${ids.length}`;
    const box = groupBox("\u0412\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435");
    const list = document.createElement("p");
    list.className = "inspector-empty";
    list.textContent = `${ids.map((id) => widgetById(id).name).join(", ")}. \u041E\u043F\u043E\u0440\u0430 \u0432\u044B\u0440\u0430\u0432\u043D\u0438\u0432\u0430\u043D\u0438\u044F \u2014 ${anchor.name} (\u0432\u044B\u0434\u0435\u043B\u0435\u043D \u043F\u0435\u0440\u0432\u044B\u043C); \u0434\u0432\u0438\u0433\u0430\u0442\u044C \u0432\u0441\u0435\u0445 \u2014 \u043C\u044B\u0448\u044C\u044E \u0438\u043B\u0438 \u0441\u0442\u0440\u0435\u043B\u043A\u0430\u043C\u0438.`;
    box.appendChild(list);
    const grid = document.createElement("div");
    grid.className = "align-grid";
    for (const [mode, label] of Object.entries(import_model_ops.ALIGN_MODES)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.align = mode;
      button.textContent = label;
      button.disabled = mode.startsWith("distribute") && ids.length < 3;
      button.title = button.disabled ? "\u0420\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u2014 \u043E\u0442 \u0442\u0440\u0451\u0445 \u0432\u0438\u0434\u0436\u0435\u0442\u043E\u0432" : `\u0412\u044B\u0440\u043E\u0432\u043D\u044F\u0442\u044C ${label}`;
      button.addEventListener("click", () => alignSelection(mode));
      grid.appendChild(button);
    }
    box.appendChild(grid);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "inspector-action";
    remove.textContent = `\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0435 (${ids.length})`;
    remove.addEventListener("click", () => deleteWidgets(ids));
    box.appendChild(remove);
    container.appendChild(box);
  }
  function alignSelection(mode) {
    const ids = [...selection].filter((id) => {
      const item = widgetById(id);
      return item && item.tabTitle === void 0 && rectOf(id);
    });
    const boxes = ids.map((id) => ({ id, ...rectOf(id) }));
    const moves = (0, import_model_ops.alignBoxes)(boxes, mode);
    if (moves.length === 0) return;
    applyChange(() => {
      for (const move of moves) {
        const item = widgetById(move.id);
        if (!item) continue;
        if (move.dx) item.props.x = Math.max(0, Math.round(Number(item.props.x || 0) + move.dx));
        if (move.dy) item.props.y = Math.max(0, Math.round(Number(item.props.y || 0) + move.dy));
        if (move.width !== void 0) item.props.width = Math.max(MIN_SIZE, Math.round(move.width));
        if (move.height !== void 0) item.props.height = Math.max(MIN_SIZE, Math.round(move.height));
      }
    });
  }
  function fontsEditor() {
    const box = groupBox("\u0428\u0440\u0438\u0444\u0442\u044B \u0438\u0437 \u0444\u0430\u0439\u043B\u043E\u0432");
    const fonts = (0, import_codegen.fontsOf)(model);
    if (fonts.length === 0) {
      const note = document.createElement("p");
      note.className = "inspector-empty";
      note.textContent = "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442. \u0424\u0430\u0439\u043B TTF, OTF, WOFF \u0438\u043B\u0438 WOFF2 \u0441\u0442\u0430\u043D\u0435\u0442 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 fonts.Font, \u0430 \u0432\u0438\u0434\u0436\u0435\u0442 \u043F\u043E\u043B\u0443\u0447\u0438\u0442 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u043E font.";
      box.appendChild(note);
    }
    for (const font of fonts) {
      const row = document.createElement("div");
      row.className = "font-row";
      const name = document.createElement("code");
      name.textContent = font.name;
      const file = document.createElement("span");
      file.className = "font-file";
      file.textContent = font.file + (fontFiles.has(font.file) ? "" : " \u2014 \u0444\u0430\u0439\u043B\u0430 \u043D\u0435\u0442, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0437\u0430\u043D\u043E\u0432\u043E");
      file.title = font.file;
      if (!fontFiles.has(font.file)) row.classList.add("is-missing");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "field-reset";
      remove.title = "\u0423\u0431\u0440\u0430\u0442\u044C \u0448\u0440\u0438\u0444\u0442 \u0438\u0437 \u043C\u0430\u043A\u0435\u0442\u0430 (\u0432\u0438\u0434\u0436\u0435\u0442\u044B \u0432\u0435\u0440\u043D\u0443\u0442\u0441\u044F \u043A \u0448\u0440\u0438\u0444\u0442\u0443 \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E)";
      if (window.IdylliumIcons) remove.appendChild(window.IdylliumIcons.element("close", { size: 12 }));
      else remove.textContent = "\xD7";
      remove.style.visibility = "visible";
      remove.addEventListener("click", () => removeFont(font.name));
      row.append(name, file, remove);
      box.appendChild(row);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "inspector-action";
    add.id = "add-font-button";
    add.textContent = "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0448\u0440\u0438\u0444\u0442 \u0438\u0437 \u0444\u0430\u0439\u043B\u0430\u2026";
    add.addEventListener("click", () => {
      pendingFontTarget = null;
      els.fontInput.click();
    });
    box.appendChild(add);
    return box;
  }
  function removeFont(fontName) {
    applyChange(() => {
      model.fonts = (0, import_codegen.fontsOf)(model).filter((font) => font.name !== fontName);
      if (model.window.props.font === fontName) delete model.window.props.font;
      for (const item of model.widgets) if (item.props.font === fontName) delete item.props.font;
    });
  }
  function openFilesDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D"));
        return;
      }
      const request = window.indexedDB.open(FILES_DB_NAME, 1);
      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILES_DB_STORE)) db.createObjectStore(FILES_DB_STORE);
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("IndexedDB open failed")));
    });
  }
  async function restoreFontFiles() {
    try {
      const db = await openFilesDb();
      const entries = await new Promise((resolve, reject) => {
        const store = db.transaction(FILES_DB_STORE, "readonly").objectStore(FILES_DB_STORE);
        const keys = store.getAllKeys();
        const values = store.getAll();
        values.addEventListener("success", () => resolve(keys.result.map((key, index) => [key, values.result[index]])));
        values.addEventListener("error", () => reject(values.error));
      });
      for (const [name, value] of entries) {
        if (typeof name === "string" && value && value.bytes) fontFiles.set(name, new Uint8Array(value.bytes));
      }
      db.close();
    } catch (error) {
    }
  }
  async function storeFontFile(name, bytes) {
    try {
      const db = await openFilesDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(FILES_DB_STORE, "readwrite");
        tx.objectStore(FILES_DB_STORE).put({ bytes }, name);
        tx.addEventListener("complete", resolve);
        tx.addEventListener("error", () => reject(tx.error));
      });
      db.close();
    } catch (error) {
    }
  }
  function fontFormatOf(bytes) {
    if (!bytes || bytes.length < 4) return null;
    const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (tag === "OTTO") return "otf";
    if (tag === "true" || bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) return "ttf";
    if (tag === "wOFF") return "woff";
    if (tag === "wOF2") return "woff2";
    return null;
  }
  async function addFontFile(file, target) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!fontFormatOf(bytes)) {
      setStatus(`\xAB${file.name}\xBB \u2014 \u043D\u0435 \u0448\u0440\u0438\u0444\u0442: \u043D\u0443\u0436\u0435\u043D TTF, OTF, WOFF \u0438\u043B\u0438 WOFF2`, true);
      return;
    }
    const fileName = file.name;
    fontFiles.set(fileName, bytes);
    void storeFontFile(fileName, bytes);
    applyChange(() => {
      let font = (0, import_codegen.fontsOf)(model).find((known) => known.file === fileName);
      if (!font) {
        font = { name: (0, import_widgets.freeName)("font", takenNames()), file: fileName };
        model.fonts = [...(0, import_codegen.fontsOf)(model), font];
      }
      if (target) {
        const owner = target.id === null ? model.window : widgetById(target.id);
        if (owner) owner.props[target.prop] = font.name;
      }
    });
    setStatus(`\u0428\u0440\u0438\u0444\u0442 \xAB${fileName}\xBB \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u043C\u0430\u043A\u0435\u0442 \u043A\u0430\u043A ${(0, import_codegen.fontsOf)(model).find((known) => known.file === fileName).name}`);
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
  function textField(label, title, value, onCommit) {
    const field = document.createElement("div");
    field.className = "field is-explicit";
    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    labelEl.title = title;
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
  function propertyField(prop, props, onChange, item) {
    const field = document.createElement("div");
    field.className = "field";
    field.dataset.prop = prop.name;
    const explicit = props[prop.name] !== void 0 && props[prop.name] !== null && props[prop.name] !== "";
    if (explicit) field.classList.add("is-explicit");
    const label = document.createElement("label");
    label.textContent = prop.name;
    const typeNames = { int: "int", float: "float", bool: "bool", string: "string", enum: "string", color: "colors.Color", font: "fonts.Font" };
    const typeNote = prop.kind === "enum" ? `${typeNames.enum}: ${prop.values.join(" | ")}` : typeNames[prop.kind] || prop.kind;
    label.title = `${prop.name} (${typeNote}) \u2014 ${prop.label}${prop.default !== void 0 ? `; \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E ${prop.default}` : ""}`;
    let control;
    if (prop.kind === "bool") {
      const wrap = document.createElement("div");
      wrap.className = "field-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = explicit ? Boolean(props[prop.name]) : Boolean(prop.default);
      input.title = prop.label;
      input.addEventListener("change", () => onChange(input.checked === Boolean(prop.default) ? null : input.checked));
      wrap.append(input);
      control = wrap;
    } else if (prop.kind === "enum" && prop.name === "icon") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-choice";
      const current = explicit ? String(props[prop.name]) : String(prop.default);
      if (window.IdylliumIcons && window.IdylliumIcons.has(current)) button.appendChild(window.IdylliumIcons.element(current, { size: 18 }));
      const name = document.createElement("span");
      name.textContent = current;
      button.appendChild(name);
      button.title = "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0437\u043D\u0430\u0447\u043E\u043A \u0438\u0437 \u043D\u0430\u0431\u043E\u0440\u0430";
      button.addEventListener("click", () => openIconPicker(button, current, (picked) => onChange(picked === prop.default ? null : picked)));
      control = button;
    } else if (prop.kind === "font") {
      const select2 = document.createElement("select");
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E";
      select2.appendChild(none);
      for (const font of (0, import_codegen.fontsOf)(model)) {
        const option = document.createElement("option");
        option.value = font.name;
        option.textContent = `${font.name} \u2014 ${font.file}`;
        select2.appendChild(option);
      }
      const add = document.createElement("option");
      add.value = "__add__";
      add.textContent = "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0448\u0440\u0438\u0444\u0442 \u0438\u0437 \u0444\u0430\u0439\u043B\u0430\u2026";
      select2.appendChild(add);
      select2.value = explicit ? String(props[prop.name]) : "";
      select2.addEventListener("change", () => {
        if (select2.value === "__add__") {
          pendingFontTarget = { id: item ? item.id : null, prop: prop.name };
          select2.value = explicit ? String(props[prop.name]) : "";
          els.fontInput.click();
          return;
        }
        onChange(select2.value === "" ? null : select2.value);
      });
      control = select2;
    } else if (prop.kind === "enum") {
      const select2 = document.createElement("select");
      for (const value of prop.values) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select2.appendChild(option);
      }
      select2.value = explicit ? String(props[prop.name]) : String(prop.default ?? prop.values[0]);
      select2.addEventListener("change", () => onChange(select2.value === prop.default ? null : select2.value));
      control = select2;
    } else if (prop.kind === "color") {
      const wrap = document.createElement("div");
      wrap.className = "field-color";
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      swatch.title = "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0446\u0432\u0435\u0442\u0430";
      if (explicit) {
        swatch.classList.add("is-set");
        swatch.style.background = (0, import_codegen.normalizeHex)(props[prop.name]);
      }
      const hex = document.createElement("input");
      hex.type = "text";
      hex.placeholder = "\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E";
      hex.value = explicit ? (0, import_codegen.normalizeHex)(props[prop.name]) : "";
      hex.spellcheck = false;
      swatch.addEventListener("click", () => openColorPanel({ item, prop, initial: explicit ? (0, import_codegen.normalizeHex)(props[prop.name]) : null }, swatch));
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
      wrap.append(swatch, hex);
      control = wrap;
    } else if (prop.kind === "int" || prop.kind === "float") {
      const wrap = document.createElement("div");
      wrap.className = "number-control";
      const minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "\u2212";
      minus.title = "\u041C\u0435\u043D\u044C\u0448\u0435";
      const input = document.createElement("input");
      input.type = "number";
      input.step = prop.kind === "int" ? "1" : "any";
      if (prop.min !== void 0) input.min = String(prop.min);
      if (prop.max !== void 0) input.max = String(prop.max);
      input.placeholder = prop.default !== void 0 ? String(prop.default) : "";
      input.value = explicit ? String(props[prop.name]) : "";
      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.title = "\u0411\u043E\u043B\u044C\u0448\u0435";
      const commit = (raw) => {
        if (String(raw).trim() === "") {
          onChange(null);
          return;
        }
        const number = Number(raw);
        if (!Number.isFinite(number)) {
          input.classList.add("is-invalid");
          return;
        }
        let value = prop.kind === "int" ? Math.round(number) : number;
        if (prop.min !== void 0) value = Math.max(prop.min, value);
        if (prop.max !== void 0) value = Math.min(prop.max, value);
        onChange(value);
      };
      const current = () => input.value.trim() === "" ? Number(effectiveDefault(prop, item)) : Number(input.value);
      minus.addEventListener("click", () => commit(current() - (prop.kind === "int" ? 1 : 0.1)));
      plus.addEventListener("click", () => commit(current() + (prop.kind === "int" ? 1 : 0.1)));
      input.addEventListener("change", () => commit(input.value));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(input.value);
        }
      });
      wrap.append(minus, input, plus);
      control = wrap;
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E";
      input.value = explicit ? String(props[prop.name]) : "";
      input.spellcheck = false;
      const commit = () => onChange(input.value.trim() === "" ? null : input.value);
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
    if (window.IdylliumIcons) reset.appendChild(window.IdylliumIcons.element("close", { size: 12 }));
    else reset.textContent = "\xD7";
    reset.addEventListener("click", () => onChange(null));
    field.append(label, control, reset);
    return field;
  }
  function effectiveDefault(prop, item) {
    if (item && (prop.name === "width" || prop.name === "height")) return sizeOf(item)[prop.name];
    if (!item && (prop.name === "width" || prop.name === "height")) return prop.default;
    return prop.default !== void 0 ? prop.default : 0;
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
  function ensureColorPanel() {
    if (colorPanel) return colorPanel;
    const host = document.createElement("div");
    host.id = "color-panel";
    host.hidden = true;
    document.body.appendChild(host);
    colorPanel = createColorPicker({
      host,
      alpha: true,
      codes: true,
      floating: { title: "\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0446\u0432\u0435\u0442\u0430", storageKey: "idyllium-color-picker-designer", onClose: () => finishColorBinding() },
      onChange: (state) => {
        if (!colorBinding) return;
        const owner = colorBinding.id === null ? model.window : widgetById(colorBinding.id);
        if (!owner) return;
        colorBinding.dirty = true;
        owner.props[colorBinding.prop] = state.hex;
        renderCode();
        scheduleRun(60);
        const field = document.querySelector(`#inspector .field[data-prop="${colorBinding.prop}"] .color-swatch`);
        if (field) {
          field.style.background = state.hex;
          field.classList.add("is-set");
        }
      },
      onCopy: async (text, button) => {
        try {
          await navigator.clipboard.writeText(text);
          flash(button, "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u2713");
        } catch (error) {
          flash(button, "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C");
        }
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!colorPanel.isOpen() || colorPanel.isPinned() || !(event.target instanceof Element)) return;
      if (host.contains(event.target) || event.target.closest('#color-picker-button, [data-role="color-picker-button"], .color-swatch')) return;
      if (colorPanel.isEyedropperActive()) return;
      colorPanel.close();
    });
    return colorPanel;
  }
  function openColorPanel(binding, anchor) {
    const panel = ensureColorPanel();
    if (colorBinding) finishColorBinding();
    if (binding) {
      const ownerName = binding.item ? binding.item.name : model.window.name;
      colorBinding = { id: binding.item ? binding.item.id : null, prop: binding.prop.name, before: snapshot(), dirty: false };
      panel.setTitle(`${ownerName}.${binding.prop.name}`);
      panel.setHex(binding.initial || "#808080", { quiet: true });
    } else {
      panel.setTitle("\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0446\u0432\u0435\u0442\u0430");
    }
    if (panel.isOpen()) return;
    const rect = anchor ? anchor.getBoundingClientRect() : null;
    panel.open(rect ? { left: rect.left - 470, top: rect.top - 8 } : void 0);
  }
  function finishColorBinding() {
    if (!colorBinding) return;
    const binding = colorBinding;
    colorBinding = null;
    if (colorPanel) colorPanel.setTitle("\u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0446\u0432\u0435\u0442\u0430");
    if (!binding.dirty) return;
    const after = snapshot();
    if (after !== binding.before) {
      history.push(binding.before);
      future = [];
    }
    refresh();
  }
  function dataEditor(item, def) {
    const box = groupBox(def.data.title);
    const shape = def.data.shape;
    const data = item.data || {};
    const commit = (next) => applyChange(() => {
      const target = widgetById(item.id);
      if (target) target.data = cleanData(item.type, next);
    });
    const stringList = (list, onCommit, placeholder) => {
      const wrap = document.createElement("div");
      wrap.className = "data-editor";
      list.forEach((value, index) => {
        const row = document.createElement("div");
        row.className = "data-row";
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.placeholder = placeholder;
        const save = () => {
          const next = [...list];
          next[index] = input.value;
          onCommit(next);
        };
        input.addEventListener("change", save);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "data-remove";
        remove.title = "\u0423\u0431\u0440\u0430\u0442\u044C";
        if (window.IdylliumIcons) remove.appendChild(window.IdylliumIcons.element("close", { size: 12 }));
        else remove.textContent = "\xD7";
        remove.addEventListener("click", () => onCommit(list.filter((_, other) => other !== index)));
        row.append(input, remove);
        wrap.appendChild(row);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "data-add";
      add.textContent = "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C";
      add.addEventListener("click", () => onCommit([...list, `${placeholder} ${list.length + 1}`]));
      wrap.appendChild(add);
      return wrap;
    };
    if (shape === "strings") {
      box.appendChild(stringList(data.items || [], (items) => commit({ items }), "\u041F\u0443\u043D\u043A\u0442"));
    } else if (shape === "table") {
      const columnsTitle = document.createElement("div");
      columnsTitle.className = "data-subtitle";
      columnsTitle.textContent = "\u041A\u043E\u043B\u043E\u043D\u043A\u0438";
      box.appendChild(columnsTitle);
      box.appendChild(stringList(data.columns || [], (columns) => commit({ ...data, columns }), "\u041A\u043E\u043B\u043E\u043D\u043A\u0430"));
      const rowsTitle = document.createElement("div");
      rowsTitle.className = "data-subtitle";
      rowsTitle.textContent = "\u0421\u0442\u0440\u043E\u043A\u0438: \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443, \u044F\u0447\u0435\u0439\u043A\u0438 \u0447\u0435\u0440\u0435\u0437 \xAB;\xBB";
      box.appendChild(rowsTitle);
      const textarea = document.createElement("textarea");
      textarea.className = "data-textarea";
      textarea.rows = 4;
      textarea.spellcheck = false;
      textarea.value = (data.rows || []).map((row) => row.join("; ")).join("\n");
      textarea.addEventListener("change", () => {
        const rows = textarea.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.split(";").map((cell) => cell.trim()));
        commit({ ...data, rows });
      });
      box.appendChild(textarea);
    } else if (shape === "entries") {
      const entries = data.entries || [];
      const wrap = document.createElement("div");
      wrap.className = "data-editor";
      entries.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "data-row data-row-entry";
        const label = document.createElement("input");
        label.type = "text";
        label.value = entry.label;
        label.placeholder = "\u043F\u043E\u0434\u043F\u0438\u0441\u044C";
        const value = document.createElement("input");
        value.type = "number";
        value.step = "any";
        value.value = String(entry.value);
        value.placeholder = "\u0447\u0438\u0441\u043B\u043E";
        const save = () => {
          const next = entries.map((other, i) => i === index ? { label: label.value, value: Number(value.value) || 0 } : other);
          commit({ entries: next });
        };
        for (const input of [label, value]) {
          input.addEventListener("change", save);
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          });
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "data-remove";
        remove.title = "\u0423\u0431\u0440\u0430\u0442\u044C";
        if (window.IdylliumIcons) remove.appendChild(window.IdylliumIcons.element("close", { size: 12 }));
        else remove.textContent = "\xD7";
        remove.addEventListener("click", () => commit({ entries: entries.filter((_, other) => other !== index) }));
        row.append(label, value, remove);
        wrap.appendChild(row);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "data-add";
      add.textContent = "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C";
      add.addEventListener("click", () => commit({ entries: [...entries, { label: `\u041F\u043E\u0434\u043F\u0438\u0441\u044C ${entries.length + 1}`, value: 1 }] }));
      wrap.appendChild(add);
      box.appendChild(wrap);
    } else if (shape === "numbers") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "data-numbers";
      input.spellcheck = false;
      input.placeholder = "\u0447\u0438\u0441\u043B\u0430 \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u043E\u0431\u0435\u043B: 3 5 4.5";
      input.value = (data.points || []).join(" ");
      const save = () => commit({ points: input.value.split(/[\s,;]+/u).map((part) => part.replace(",", ".")).map(Number).filter((n) => Number.isFinite(n)) });
      input.addEventListener("change", save);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }
      });
      box.appendChild(input);
    }
    const note = document.createElement("p");
    note.className = "inspector-empty";
    note.textContent = shape === "table" ? "\u0412 \u043A\u043E\u0434\u0435: set_columns(\u2026) \u0438 add_row(\u2026) \u2014 \u0441\u0442\u0440\u043E\u043A\u0430 \u043F\u043E\u0434\u0433\u043E\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0434 \u0447\u0438\u0441\u043B\u043E \u043A\u043E\u043B\u043E\u043D\u043E\u043A." : `\u0412 \u043A\u043E\u0434\u0435: ${def.data.method}(\u2026) \u043D\u0430 \u043A\u0430\u0436\u0434\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435.`;
    box.appendChild(note);
    return box;
  }
  var iconPicker = null;
  function openIconPicker(anchor, current, onPick) {
    if (!iconPicker) {
      const root2 = document.createElement("div");
      root2.className = "icon-picker";
      root2.hidden = true;
      root2.setAttribute("role", "dialog");
      root2.setAttribute("aria-label", "\u0412\u044B\u0431\u043E\u0440 \u0437\u043D\u0430\u0447\u043A\u0430");
      const search2 = document.createElement("input");
      search2.type = "text";
      search2.className = "icon-picker-search";
      search2.placeholder = "\u043F\u043E\u0438\u0441\u043A \u043F\u043E \u0438\u043C\u0435\u043D\u0438: play, file, arrow\u2026";
      search2.spellcheck = false;
      const grid = document.createElement("div");
      grid.className = "icon-picker-grid";
      root2.append(search2, grid);
      document.body.appendChild(root2);
      iconPicker = { root: root2, search: search2, grid, session: null };
      const close = () => {
        root2.hidden = true;
        iconPicker.session = null;
      };
      const renderGrid = () => {
        const query = search2.value.trim().toLowerCase();
        grid.replaceChildren();
        for (const name of import_widgets.ICON_NAMES) {
          if (query && !name.includes(query)) continue;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "icon-picker-item";
          if (iconPicker.session && name === iconPicker.session.current) button.classList.add("is-current");
          button.title = name;
          if (window.IdylliumIcons) button.appendChild(window.IdylliumIcons.element(name, { size: 20 }));
          const label = document.createElement("span");
          label.textContent = name;
          button.appendChild(label);
          button.addEventListener("click", () => {
            const session = iconPicker.session;
            close();
            if (session) session.onPick(name);
          });
          grid.appendChild(button);
        }
        if (grid.childElementCount === 0) {
          const empty = document.createElement("p");
          empty.className = "inspector-empty";
          empty.textContent = "\u0422\u0430\u043A\u043E\u0433\u043E \u0437\u043D\u0430\u0447\u043A\u0430 \u043D\u0435\u0442";
          grid.appendChild(empty);
        }
      };
      iconPicker.renderGrid = renderGrid;
      search2.addEventListener("input", renderGrid);
      search2.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      });
      document.addEventListener("pointerdown", (event) => {
        if (root2.hidden || !(event.target instanceof Node) || root2.contains(event.target)) return;
        if (iconPicker.session && iconPicker.session.anchor.contains(event.target)) return;
        close();
      });
      document.addEventListener("keydown", (event) => {
        if (!root2.hidden && event.key === "Escape") close();
      });
    }
    const { root, search } = iconPicker;
    iconPicker.session = { anchor, current, onPick };
    search.value = "";
    iconPicker.renderGrid();
    root.hidden = false;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + root.offsetWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - root.offsetWidth - 8);
    if (top + root.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - root.offsetHeight - 6);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    search.focus();
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
    els.code.innerHTML = highlight(currentCode(false));
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
      const selection2 = window.getSelection();
      selection2.removeAllRanges();
      selection2.addRange(range);
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
  function downloadText(name, text, type) {
    const blob = new Blob([text], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
  }
  function downloadCode() {
    const code = currentCode(false);
    const fonts = (0, import_codegen.fontsOf)(model).filter((font) => fontFiles.has(font.file));
    if (fonts.length === 0) {
      downloadText("main.idyl", code, "text/plain;charset=utf-8");
      flash(els.downloadCode, "\u0421\u043A\u0430\u0447\u0430\u043D\u043E \u2713");
      return;
    }
    const entries = [{ name: "main.idyl", bytes: new TextEncoder().encode(code) }, ...fonts.map((font) => ({ name: font.file, bytes: fontFiles.get(font.file) }))];
    const blob = new Blob([zipBytes(entries)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gui-project.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    flash(els.downloadCode, "\u0421\u043A\u0430\u0447\u0430\u043D\u043E \u2713");
  }
  async function fingerprint(bytes) {
    if (!window.crypto || !window.crypto.subtle) return "";
    const digest = new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes));
    return Array.from(digest.subarray(0, 8), (byte2) => byte2.toString(16).padStart(2, "0")).join("");
  }
  async function openInIde() {
    const share = api && api.share;
    if (!share || typeof share.encodeProjectLink !== "function") {
      setStatus("\u042F\u0434\u0440\u043E Idyllium \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u043E\u0441\u044C \u2014 \u0441\u043A\u043E\u043F\u0438\u0440\u0443\u0439\u0442\u0435 \u043A\u043E\u0434 \u0438 \u0432\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0432 Web IDE \u0432\u0440\u0443\u0447\u043D\u0443\u044E", true);
      return;
    }
    const code = currentCode(false);
    const title = String(model.window.props.title || "\u041C\u0430\u043A\u0435\u0442 \u043E\u043A\u043D\u0430");
    const assets = [];
    for (const font of (0, import_codegen.fontsOf)(model)) {
      const bytes = fontFiles.get(font.file);
      if (!bytes) continue;
      const sha = await fingerprint(bytes);
      if (sha) assets.push({ path: font.file, size: bytes.length, sha });
    }
    let fragment;
    try {
      fragment = share.encodeProjectLink({
        name: `\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 GUI: ${title}`,
        from: "",
        idyllium: api.IDYLLIUM_VERSION || "",
        current: "main.idyl",
        files: [{ path: "main.idyl", text: code }],
        assets
      });
    } catch (error) {
      setStatus(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443: ${error instanceof Error ? error.message : String(error)}`, true);
      return;
    }
    const url = `${new URL("../", window.location.href).href}#${fragment}`;
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) setStatus("\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u043B \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u2014 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0432\u0441\u043F\u043B\u044B\u0432\u0430\u044E\u0449\u0438\u0435 \u043E\u043A\u043D\u0430 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u0430\u0439\u0442\u0430", true);
    else if (assets.length > 0) setStatus(`Web IDE \u043E\u0442\u043A\u0440\u044B\u0442; \u0444\u0430\u0439\u043B\u044B \u0448\u0440\u0438\u0444\u0442\u043E\u0432 \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F \u2014 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0438\u0445 \u0432 \u043F\u0440\u043E\u0435\u043A\u0442 (\u0424\u0430\u0439\u043B\u044B \u2192 \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C): ${assets.map((asset) => asset.path).join(", ")}`);
  }
  function saveModelFile() {
    downloadText("gui-design.json", `${JSON.stringify((0, import_codegen.stripModel)(model), null, 2)}
`, "application/json;charset=utf-8");
    flash(els.saveModel, "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u2713");
  }
  async function openModelFile(file) {
    const text = await file.text();
    let loaded = null;
    let loadedTabs = {};
    let report = null;
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
      if (embedded) {
        loaded = validateModel(embedded);
        if (!loaded) {
          setStatus(`\u0421\u0442\u0440\u043E\u043A\u0430 \u043C\u0430\u043A\u0435\u0442\u0430 \u0432 \xAB${file.name}\xBB \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0430`, true);
          return;
        }
        const fileCode = (0, import_codegen.stripEmbeddedModel)(text);
        const difference = (0, import_codegen.codeDifference)(fileCode, (0, import_codegen.generateCode)(loaded, {}));
        if (difference.extraLines > 0 || difference.missingLines.length > 0) report = difference;
      } else {
        const imported = await importIdylFile(file.name, text);
        if (!imported) return;
        loaded = imported.model;
        loadedTabs = imported.previewTabs;
      }
    }
    if (report) {
      const body = document.createElement("div");
      const intro = document.createElement("p");
      intro.textContent = `\u041A\u043E\u0434 \u0432 \xAB${file.name}\xBB \u043F\u0440\u0430\u0432\u0438\u043B\u0438 \u0440\u0443\u043A\u0430\u043C\u0438 \u043F\u043E\u0441\u043B\u0435 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430. \u041C\u0430\u043A\u0435\u0442 \u043E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F, \u043D\u043E \u044D\u0442\u0438 \u043F\u0440\u0430\u0432\u043A\u0438 \u0432 \u043D\u0435\u0433\u043E \u043D\u0435 \u043F\u043E\u043F\u0430\u0434\u0443\u0442 \u2014 \u043F\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043F\u0435\u0440\u0435\u0441\u0431\u043E\u0440\u043A\u0435 \u0438\u0445 \u043D\u0435 \u0431\u0443\u0434\u0435\u0442:`;
      body.appendChild(intro);
      if (report.extraRanges.length > 0) {
        const list = document.createElement("ul");
        for (const range of report.extraRanges.slice(0, 12)) {
          const li = document.createElement("li");
          const where = range.from === range.to ? `\u0441\u0442\u0440\u043E\u043A\u0430 ${range.from}` : `\u0441\u0442\u0440\u043E\u043A\u0438 ${range.from}\u2013${range.to} (${range.count})`;
          li.innerHTML = `${escapeHtml(where)}: <code>${escapeHtml(range.first.slice(0, 70))}</code>${range.count > 1 ? " \u2026" : ""}`;
          list.appendChild(li);
        }
        if (report.extraRanges.length > 12) {
          const li = document.createElement("li");
          li.textContent = `\u2026\u0438 \u0435\u0449\u0451 ${report.extraRanges.length - 12} \u043C\u0435\u0441\u0442`;
          list.appendChild(li);
        }
        body.appendChild(list);
      }
      if (report.missingLines.length > 0) {
        const note = document.createElement("p");
        note.textContent = `\u041A\u0440\u043E\u043C\u0435 \u0442\u043E\u0433\u043E, \u0432 \u0444\u0430\u0439\u043B\u0435 \u043D\u0435\u0442 ${report.missingLines.length} \u0441\u0442\u0440\u043E\u043A \u043C\u0430\u043A\u0435\u0442\u0430 (\u0438\u0445 \u0443\u0434\u0430\u043B\u0438\u043B\u0438) \u2014 \u043C\u0430\u043A\u0435\u0442 \u0438\u0445 \u0432\u0435\u0440\u043D\u0451\u0442.`;
        body.appendChild(note);
      }
      const proceed = await showDialog({ title: "\u0424\u0430\u0439\u043B \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u043E\u0442 \u043C\u0430\u043A\u0435\u0442\u0430", body, ok: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u0430\u043A\u0435\u0442", cancel: "\u041E\u0442\u043C\u0435\u043D\u0430" });
      if (!proceed) return;
    }
    applyChange(() => {
      model = loaded;
      selectedId = null;
      selection = /* @__PURE__ */ new Set();
      previewTabs = loadedTabs || {};
    });
    const missingFonts = (0, import_codegen.withoutMissingFonts)(model, (name) => fontFiles.has(name)).missing;
    const fontsNote = missingFonts.length > 0 ? `; \u043D\u0435\u0442 \u0444\u0430\u0439\u043B\u043E\u0432 \u0448\u0440\u0438\u0444\u0442\u043E\u0432: ${missingFonts.map((font) => font.file).join(", ")} \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0445 \u0437\u0430\u043D\u043E\u0432\u043E` : "";
    setStatus(`\u041E\u0442\u043A\u0440\u044B\u0442 \u043C\u0430\u043A\u0435\u0442 \u0438\u0437 \xAB${file.name}\xBB: \u0432\u0438\u0434\u0436\u0435\u0442\u043E\u0432 ${model.widgets.length}${report ? " (\u0440\u0443\u0447\u043D\u044B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438 \u043A\u043E\u0434\u0430 \u0432 \u043C\u0430\u043A\u0435\u0442 \u043D\u0435 \u0432\u043E\u0448\u043B\u0438)" : ""}${fontsNote}`, Boolean(report) || missingFonts.length > 0);
  }
  async function importIdylFile(fileName, text) {
    if (!api || typeof api.compileIdyllium !== "function") {
      setStatus("\u042F\u0434\u0440\u043E Idyllium \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B\u043E\u0441\u044C \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u044C .idyl \u0431\u0435\u0437 \u0441\u0442\u0440\u043E\u043A\u0438 \u043C\u0430\u043A\u0435\u0442\u0430 \u043D\u0435\u043B\u044C\u0437\u044F", true);
      return null;
    }
    const compiled = api.compileIdyllium(text, { file: fileName });
    if (!compiled.success || !compiled.ast) {
      const first = String(compiled.diagnosticsText || "").split("\n").find((line) => line.includes("error")) || String(compiled.diagnosticsText || "").split("\n")[0];
      setStatus(`\xAB${fileName}\xBB \u043D\u0435 \u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u2014 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0431\u043E\u0447\u0443\u044E \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0443: ${first}`, true);
      return null;
    }
    let imported;
    try {
      imported = (0, import_import.importProgram)(compiled.ast, { source: text, colorConstants: api.COLOR_CONSTANTS || [] });
    } catch (error) {
      if (error && error.name === "ImportRefusal") {
        setStatus(`\xAB${fileName}\xBB: ${error.message}`, true);
        return null;
      }
      throw error;
    }
    const loaded = validateModel(imported.model);
    if (!loaded) {
      setStatus(`\xAB${fileName}\xBB: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u043A\u0435\u0442 \u0438\u0437 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B`, true);
      return null;
    }
    if (imported.foreign.length > 0 || imported.notes.length > 0) {
      const body = document.createElement("div");
      const intro = document.createElement("p");
      intro.textContent = imported.foreign.length > 0 ? `\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442 \u043E\u043A\u043D\u043E, \u0432\u0438\u0434\u0436\u0435\u0442\u044B, \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0430-\u043A\u043E\u043D\u0441\u0442\u0430\u043D\u0442\u044B, add_child \u0438 add_tab, \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043F\u0438\u0441\u043A\u043E\u0432 \u0438 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C, \u043F\u0443\u0441\u0442\u044B\u0435 \u0437\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A\u043E\u0432. \u0412 \xAB${fileName}\xBB \u0435\u0441\u0442\u044C \u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u2014 \u0432 \u043C\u0430\u043A\u0435\u0442 \u043E\u043D\u043E \u043D\u0435 \u043F\u043E\u043F\u0430\u0434\u0451\u0442, \u0430 \u043F\u0440\u0438 \u043F\u0435\u0440\u0435\u0441\u0431\u043E\u0440\u043A\u0435 \u043A\u043E\u0434\u0430 \u044D\u0442\u0438\u0445 \u0441\u0442\u0440\u043E\u043A \u043D\u0435 \u0431\u0443\u0434\u0435\u0442:` : `\u0412 \xAB${fileName}\xBB \u0435\u0441\u0442\u044C, \u0447\u0442\u043E \u043F\u043E\u043F\u0440\u0430\u0432\u0438\u0442\u044C:`;
      body.appendChild(intro);
      if (imported.foreign.length > 0) {
        const list = document.createElement("ul");
        for (const entry of imported.foreign.slice(0, 12)) {
          const li = document.createElement("li");
          li.innerHTML = `\u0441\u0442\u0440\u043E\u043A\u0430 ${entry.line}: <code>${escapeHtml(entry.text.slice(0, 70))}</code> \u2014 ${escapeHtml(entry.why)}`;
          list.appendChild(li);
        }
        if (imported.foreign.length > 12) {
          const li = document.createElement("li");
          li.textContent = `\u2026\u0438 \u0435\u0449\u0451 ${imported.foreign.length - 12} \u0441\u0442\u0440\u043E\u043A`;
          list.appendChild(li);
        }
        body.appendChild(list);
      }
      for (const note of imported.notes) {
        const p = document.createElement("p");
        p.textContent = note;
        body.appendChild(p);
      }
      const proceed = await showDialog({ title: "\u0424\u0430\u0439\u043B \u043D\u0435 \u0446\u0435\u043B\u0438\u043A\u043E\u043C \u0432 \u0438\u0434\u0438\u043E\u043C\u0435 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430", body, ok: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043C\u0430\u043A\u0435\u0442", cancel: "\u041E\u0442\u043C\u0435\u043D\u0430" });
      if (!proceed) return null;
    }
    return { model: loaded, previewTabs: imported.previewTabs || {} };
  }
  function applyLayout() {
    const layout = ui.layout;
    els.designer.style.setProperty("--palette-w", `${layout.palette}px`);
    els.designer.style.setProperty("--side-w", `${layout.side}px`);
    els.designer.style.setProperty("--code-h", `${layout.code}px`);
    els.designer.style.setProperty("--tree-h", `${layout.tree}%`);
    els.designer.classList.toggle("is-code-collapsed", Boolean(ui.codeCollapsed));
    els.codeCollapse.textContent = ui.codeCollapsed ? "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C";
  }
  function installSplitter(id, { horizontal, onMove }) {
    const splitter = $(id);
    splitter.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      splitter.classList.add("is-dragging");
      document.body.classList.add(horizontal ? "is-resizing-rows" : "is-resizing");
      const start = { x: event.clientX, y: event.clientY, layout: { ...ui.layout } };
      const move = (moveEvent) => onMove(start, moveEvent.clientX - start.x, moveEvent.clientY - start.y);
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        splitter.classList.remove("is-dragging");
        document.body.classList.remove("is-resizing", "is-resizing-rows");
        persist();
        requestAnimationFrame(syncOverlay);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  }
  function installSplitters() {
    const clamp2 = (value, min, max) => Math.max(min, Math.min(max, value));
    installSplitter("split-palette", { horizontal: false, onMove: (start, dx) => {
      ui.layout.palette = clamp2(start.layout.palette + dx, 150, 420);
      applyLayout();
    } });
    installSplitter("split-side", { horizontal: false, onMove: (start, dx) => {
      ui.layout.side = clamp2(start.layout.side - dx, 240, 560);
      applyLayout();
    } });
    installSplitter("split-code", { horizontal: true, onMove: (start, _dx, dy) => {
      ui.layout.code = clamp2(start.layout.code - dy, 44, window.innerHeight - 260);
      applyLayout();
    } });
    installSplitter("split-tree", {
      horizontal: true,
      onMove: (start, _dx, dy) => {
        const sideHeight = $("side").clientHeight || 1;
        ui.layout.tree = clamp2(start.layout.tree + dy / sideHeight * 100, 12, 80);
        applyLayout();
      }
    });
  }
  function refresh({ silent = false } = {}) {
    els.undo.disabled = history.length === 0;
    els.redo.disabled = future.length === 0;
    pruneSelection();
    const withFonts = (0, import_codegen.fontsOf)(model).some((font) => fontFiles.has(font.file));
    els.downloadCode.textContent = withFonts ? "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442 (.zip)" : "\u0421\u043A\u0430\u0447\u0430\u0442\u044C main.idyl";
    els.downloadCode.title = withFonts ? "main.idyl \u0438 \u0444\u0430\u0439\u043B\u044B \u0448\u0440\u0438\u0444\u0442\u043E\u0432 \u043E\u0434\u043D\u0438\u043C \u0430\u0440\u0445\u0438\u0432\u043E\u043C \u2014 Web IDE \u043E\u0442\u043A\u0440\u043E\u0435\u0442 \u0435\u0433\u043E \u0447\u0435\u0440\u0435\u0437 \xAB\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442\xBB" : "";
    renderTree();
    renderInspector();
    renderCode();
    renderOverlay();
    persist();
    if (!silent) scheduleRun(0);
  }
  document.addEventListener("keydown", (event) => {
    if (!els.dialog.hidden) {
      if (event.key === "Escape") closeDialog(false);
      return;
    }
    if (isTextField(document.activeElement) && document.activeElement !== els.overlay) return;
    if (iconPicker && !iconPicker.root.hidden) return;
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
      duplicateSelection();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectMany(model.widgets.filter((item) => item.tabTitle === void 0).map((item) => item.id));
      return;
    }
    if (event.key === "Escape") {
      hideContextMenu();
      select(null);
      return;
    }
    if (selection.size === 0) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteWidgets([...selection]);
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      const roots = movableRoots();
      if (roots.length === 0) return;
      applyChange(() => {
        for (const id of roots) {
          const target = widgetById(id);
          if (!target) continue;
          target.props.x = Math.max(0, Number(target.props.x || 0) + dx);
          target.props.y = Math.max(0, Number(target.props.y || 0) + dy);
        }
      });
    }
  });
  function initControls() {
    for (const button of document.querySelectorAll('#color-picker-button, [data-role="color-picker-button"]')) {
      button.addEventListener("click", () => openColorPanel(null, button));
    }
    els.undo.addEventListener("click", undo);
    els.redo.addEventListener("click", redo);
    els.newDesign.addEventListener("click", async () => {
      if (model.widgets.length > 0) {
        const ok = await showDialog({ title: "\u041D\u043E\u0432\u044B\u0439 \u043C\u0430\u043A\u0435\u0442", body: "\u041D\u0430\u0447\u0430\u0442\u044C \u043F\u0443\u0441\u0442\u043E\u0439 \u043C\u0430\u043A\u0435\u0442? \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043E\u0442\u043C\u0435\u043D\u0430\u0445 (Ctrl+Z).", ok: "\u041D\u0430\u0447\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439" });
        if (!ok) return;
      }
      applyChange(() => {
        model = newModel();
        selectedId = null;
        previewTabs = {};
      });
    });
    els.dialogOk.addEventListener("click", () => closeDialog(true));
    els.dialogCancel.addEventListener("click", () => closeDialog(false));
    els.dialog.addEventListener("click", (event) => {
      if (event.target === els.dialog) closeDialog(false);
    });
    els.gridToggle.checked = ui.grid;
    els.gridSize.textContent = String(ui.gridSize);
    els.gridToggle.addEventListener("change", () => {
      ui.grid = els.gridToggle.checked;
      persist();
      renderOverlay();
    });
    els.embedToggle.checked = ui.embedModel;
    els.embedToggle.addEventListener("change", () => {
      ui.embedModel = els.embedToggle.checked;
      persist();
      renderCode();
    });
    els.openIde.addEventListener("click", () => {
      void openInIde();
    });
    els.fontInput.addEventListener("change", () => {
      const file = els.fontInput.files && els.fontInput.files[0];
      els.fontInput.value = "";
      const target = pendingFontTarget;
      pendingFontTarget = null;
      if (file) void addFontFile(file, target);
    });
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
    els.codeCollapse.addEventListener("click", () => {
      ui.codeCollapsed = !ui.codeCollapsed;
      persist();
      applyLayout();
      requestAnimationFrame(syncOverlay);
    });
    applyLayout();
    installSplitters();
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
  async function main() {
    if (!restore()) model = newModel();
    if (window.IdylliumIcons) window.IdylliumIcons.mountAll(document);
    initTheme();
    renderPalette();
    initControls();
    await restoreFontFiles();
    watchPreviewFrame();
    refresh({ silent: true });
    setStatus("\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430\u2026");
  }
  void main();
})();
