/* Idyllium 1.6.0 — собрано tools/build-embed.js из packages/embed/; править источники. */
"use strict";
(() => {
  // packages/web-ide/src/idyllium-highlight.js
  var KEYWORDS = /* @__PURE__ */ new Set([
    "and",
    "break",
    "catch",
    "class",
    "const",
    "constructor",
    "continue",
    "contract",
    "do",
    "else",
    "event",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "not",
    "or",
    "parent",
    "private",
    "public",
    "return",
    "static",
    "this",
    "true",
    "null",
    "try",
    "use",
    "while",
    "xor"
  ]);
  var BUILTIN_TYPES = /* @__PURE__ */ new Set([
    "array",
    "bool",
    "char",
    "dyn_array",
    "float",
    "int",
    "map",
    "set",
    "string",
    "void"
  ]);
  var CLASS_NAMES = /* @__PURE__ */ new Set([
    "Array",
    "BarChart",
    "Button",
    "Canvas",
    "CheckBox",
    "Circle",
    "Color",
    "ComboBox",
    "Complex",
    "Drawable",
    "FloatSpinBox",
    "Font",
    "Frame",
    "Animation",
    "Bitmap",
    "Image",
    "ImageBox",
    "KeyboardEvent",
    "Label",
    "Line",
    "LineChart",
    "LineEdit",
    "Melody",
    "Modal",
    "MouseEvent",
    "MouseScrollEvent",
    "Music",
    "Database",
    "Node",
    "Object",
    "PieChart",
    "Post",
    "ProgressBar",
    "RadioButton",
    "Rectangle",
    "Request",
    "Response",
    "Result",
    "Server",
    "Slider",
    "Sound",
    "SpinBox",
    "Sprite",
    "Statement",
    "Static",
    "TabWidget",
    "Table",
    "Text",
    "TextEdit",
    "Timer",
    "Turtle",
    "Value",
    "Vector",
    "Widget",
    "Window"
  ]);
  var QUALIFIED_TYPES = /* @__PURE__ */ new Set([
    ...CLASS_NAMES,
    "float32",
    "float64",
    "int8",
    "int16",
    "int32",
    "int64",
    "istream",
    "ostream",
    "stamp",
    "stream",
    "uint8",
    "uint16",
    "uint32",
    "uint64"
  ]);
  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  // packages/web-ide/src/ansi.js
  var ANSI_FOREGROUND_CLASSES = /* @__PURE__ */ new Map([
    [30, "ansi-fg-black"],
    [31, "ansi-fg-red"],
    [32, "ansi-fg-green"],
    [33, "ansi-fg-yellow"],
    [34, "ansi-fg-blue"],
    [35, "ansi-fg-magenta"],
    [36, "ansi-fg-cyan"],
    [37, "ansi-fg-white"],
    [90, "ansi-fg-bright-black"],
    [91, "ansi-fg-bright-red"],
    [92, "ansi-fg-bright-green"],
    [93, "ansi-fg-bright-yellow"],
    [94, "ansi-fg-bright-blue"],
    [95, "ansi-fg-bright-magenta"],
    [96, "ansi-fg-bright-cyan"],
    [97, "ansi-fg-bright-white"]
  ]);
  function appendAnsiText(parent2, text) {
    for (const node of ansiTextNodes(String(text))) {
      parent2.appendChild(node);
    }
  }
  function ansiTextNodes(text) {
    let foregroundClass = "";
    let bold = false;
    let buffer = "";
    const nodes = [];
    const flush = () => {
      if (!buffer) return;
      if (!foregroundClass && !bold) {
        nodes.push(document.createTextNode(buffer));
      } else {
        const span = document.createElement("span");
        span.className = [foregroundClass, bold ? "ansi-bold" : ""].filter(Boolean).join(" ");
        span.textContent = buffer;
        nodes.push(span);
      }
      buffer = "";
    };
    for (let index = 0; index < text.length; ) {
      if (text.charCodeAt(index) !== 27 || text[index + 1] !== "[") {
        buffer += text[index];
        index += 1;
        continue;
      }
      const end = findAnsiEnd(text, index + 2);
      if (end === -1) {
        index += 1;
        continue;
      }
      flush();
      const command = text[end];
      const rawParams = text.slice(index + 2, end);
      const params = rawParams.length === 0 ? [0] : rawParams.split(";").map((part) => Number(part || 0));
      if (command === "m") {
        for (const param of params) {
          if (param === 0) {
            foregroundClass = "";
            bold = false;
          } else if (param === 1) {
            bold = true;
          } else if (param === 22) {
            bold = false;
          } else if (param === 39) {
            foregroundClass = "";
          } else if (ANSI_FOREGROUND_CLASSES.has(param)) {
            foregroundClass = ANSI_FOREGROUND_CLASSES.get(param);
          }
        }
      } else if (command === "J" && params.some((param) => param === 2 || param === 3)) {
        nodes.length = 0;
        buffer = "";
      }
      index = end + 1;
    }
    flush();
    return nodes;
  }
  function findAnsiEnd(text, start) {
    for (let index = start; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 64 && code <= 126) return index;
    }
    return -1;
  }

  // packages/web-ide/src/monaco-grammar.js
  var MONACO_LANGUAGE_ID = "idyllium";
  function registerIdylliumGrammar(monaco) {
    monaco.languages.register({
      id: MONACO_LANGUAGE_ID,
      extensions: [".idyl"],
      aliases: ["Idyllium", "idyllium"]
    });
    monaco.languages.setLanguageConfiguration(MONACO_LANGUAGE_ID, {
      comments: { lineComment: "//" },
      brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"', notIn: ["string"] },
        { open: "'", close: "'", notIn: ["string", "comment"] }
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      indentationRules: {
        increaseIndentPattern: /^.*\{\s*(?:\/\/.*)?$/u,
        decreaseIndentPattern: /^\s*\}/u
      },
      onEnterRules: [
        {
          beforeText: /^.*\{\s*$/u,
          afterText: /^\s*\}/u,
          action: { indentAction: monaco.languages.IndentAction.IndentOutdent }
        },
        {
          beforeText: /^.*\{\s*$/u,
          action: { indentAction: monaco.languages.IndentAction.Indent }
        }
      ],
      wordPattern: /[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u
    });
    monaco.languages.setMonarchTokensProvider(MONACO_LANGUAGE_ID, {
      keywords: [...KEYWORDS],
      builtinTypes: [...BUILTIN_TYPES],
      classNames: [...CLASS_NAMES],
      qualifiedTypes: [...QUALIFIED_TYPES],
      tokenizer: {
        root: [
          [/\/\/.*$/u, "comment"],
          [/\/\*/u, { token: "comment", next: "@blockComment" }],
          [/"(?:\\.|[^"\\])*"/u, "string"],
          [/'(?:\\.|[^'\\])*'/u, "string"],
          [/\b\d+(?:\.\d+)?\b/u, "number"],
          [/(class|extends)(\s+)([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)/u, [
            "keyword.idyllium",
            "",
            "className.idyllium"
          ]],
          [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*(?=\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$))/u, "className.idyllium"],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*(?=\s*\()/u, {
            cases: {
              "@keywords": "keyword.idyllium",
              "@builtinTypes": "typeName.idyllium",
              "@classNames": "className.idyllium",
              "@default": "function.idyllium"
            }
          }],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u, {
            cases: {
              "@keywords": "keyword.idyllium",
              "@builtinTypes": "typeName.idyllium",
              "@classNames": "className.idyllium",
              "@default": "object.idyllium"
            }
          }],
          [/\./u, { token: "brackets.idyllium", next: "@afterDot" }],
          [/==|!=|<=|>=|\+=|-=|\*=|\/=/u, "brackets.idyllium"],
          [/[+\-*/<>=!{}()[\];,.:~]/u, "brackets.idyllium"]
        ],
        afterDot: [
          [/\s+/u, ""],
          [/[A-ZА-ЯЁ][A-Za-z0-9_А-Яа-яЁё]*(?=\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$))/u, {
            token: "className.idyllium",
            next: "@pop"
          }],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*(?=\s*\()/u, {
            cases: {
              "@qualifiedTypes": { token: "className.idyllium", next: "@pop" },
              "@classNames": { token: "className.idyllium", next: "@pop" },
              "@default": { token: "function.idyllium", next: "@pop" }
            }
          }],
          [/[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u, {
            cases: {
              "@qualifiedTypes": { token: "className.idyllium", next: "@pop" },
              "@classNames": { token: "className.idyllium", next: "@pop" },
              "@default": { token: "object.idyllium", next: "@pop" }
            }
          }],
          [/./u, { token: "brackets.idyllium", next: "@pop" }]
        ],
        blockComment: [
          [/[^*/]+/u, "comment"],
          [/\*\//u, { token: "comment", next: "@pop" }],
          [/./u, "comment"]
        ]
      }
    });
  }
  function defineIdylliumThemes(monaco) {
    monaco.editor.defineTheme("idyllium-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword.idyllium", foreground: "b892ff" },
        { token: "typeName.idyllium", foreground: "63b3ff" },
        { token: "className.idyllium", foreground: "59d4b8" },
        { token: "function.idyllium", foreground: "e4d87e" },
        { token: "object.idyllium", foreground: "8bdfff" },
        { token: "namespace", foreground: "8bdfff" },
        { token: "class", foreground: "59d4b8" },
        { token: "function", foreground: "e4d87e" },
        { token: "method", foreground: "e4d87e" },
        { token: "property", foreground: "8bdfff" },
        { token: "variable", foreground: "f0ecf8" },
        { token: "parameter", foreground: "8bdfff" },
        { token: "variable.readonly", foreground: "8bdfff" },
        { token: "brackets.idyllium", foreground: "d0d6e6" },
        { token: "string.key.json", foreground: "8bdfff" },
        { token: "string.value.json", foreground: "d99a6c" },
        { token: "number.json", foreground: "c5d979" },
        { token: "keyword.json", foreground: "b892ff" },
        { token: "delimiter.bracket.json", foreground: "d0d6e6" },
        { token: "delimiter.array.json", foreground: "d0d6e6" },
        { token: "delimiter.colon.json", foreground: "d0d6e6" },
        { token: "delimiter.comma.json", foreground: "d0d6e6" },
        { token: "comment.line.json", foreground: "6ba36f", fontStyle: "italic" },
        { token: "comment.block.json", foreground: "6ba36f", fontStyle: "italic" },
        { token: "string", foreground: "d99a6c" },
        { token: "number", foreground: "c5d979" },
        { token: "comment", foreground: "6ba36f", fontStyle: "italic" }
      ],
      colors: {
        "focusBorder": "#00000000",
        "editor.background": "#120a1d",
        "editor.foreground": "#f0ecf8",
        "editorLineNumber.foreground": "#777088",
        "editorLineNumber.activeForeground": "#d0d6e6",
        "editorCursor.foreground": "#ffffff",
        "editor.selectionBackground": "#6aa4ff45",
        "editor.inactiveSelectionBackground": "#6aa4ff24",
        "editor.lineHighlightBackground": "#ffffff07",
        "editor.lineHighlightBorder": "#00000000",
        "editorBracketHighlight.foreground1": "#d0d6e6",
        "editorBracketHighlight.foreground2": "#d0d6e6",
        "editorBracketHighlight.foreground3": "#d0d6e6",
        "editorBracketHighlight.foreground4": "#d0d6e6",
        "editorBracketHighlight.foreground5": "#d0d6e6",
        "editorBracketHighlight.foreground6": "#d0d6e6",
        "editorBracketMatch.background": "#21182c",
        "editorBracketMatch.border": "#6aa4ff66",
        "editorIndentGuide.background1": "#2a2038",
        "editorIndentGuide.activeBackground1": "#4a405c",
        "editorGutter.background": "#120a1d",
        "editorSuggestWidget.background": "#1d1528",
        "editorSuggestWidget.border": "#342a43",
        "editorSuggestWidget.foreground": "#f0ecf8",
        "editorSuggestWidget.highlightForeground": "#8ec2ff",
        "editorSuggestWidget.selectedBackground": "#273956",
        "editorWidget.background": "#1d1528",
        "editorWidget.border": "#342a43"
      }
    });
    monaco.editor.defineTheme("idyllium-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword.idyllium", foreground: "8d3f75" },
        { token: "typeName.idyllium", foreground: "1d659a" },
        { token: "className.idyllium", foreground: "1b745c" },
        { token: "function.idyllium", foreground: "76620f" },
        { token: "object.idyllium", foreground: "0d667f" },
        { token: "namespace", foreground: "0d667f" },
        { token: "class", foreground: "1b745c" },
        { token: "function", foreground: "76620f" },
        { token: "method", foreground: "76620f" },
        { token: "property", foreground: "0d667f" },
        { token: "variable", foreground: "1d2230" },
        { token: "parameter", foreground: "0d667f" },
        { token: "variable.readonly", foreground: "0d667f" },
        { token: "brackets.idyllium", foreground: "445253" },
        { token: "string.key.json", foreground: "0d667f" },
        { token: "string.value.json", foreground: "87481f" },
        { token: "number.json", foreground: "5b7027" },
        { token: "keyword.json", foreground: "8d3f75" },
        { token: "delimiter.bracket.json", foreground: "445253" },
        { token: "delimiter.array.json", foreground: "445253" },
        { token: "delimiter.colon.json", foreground: "445253" },
        { token: "delimiter.comma.json", foreground: "445253" },
        { token: "comment.line.json", foreground: "477237", fontStyle: "italic" },
        { token: "comment.block.json", foreground: "477237", fontStyle: "italic" },
        { token: "string", foreground: "87481f" },
        { token: "number", foreground: "5b7027" },
        { token: "comment", foreground: "477237", fontStyle: "italic" }
      ],
      colors: {
        "focusBorder": "#00000000",
        "editor.background": "#d9d6df",
        "editor.foreground": "#252730",
        "editorLineNumber.foreground": "#77717f",
        "editorLineNumber.activeForeground": "#47424f",
        "editorCursor.foreground": "#23252c",
        "editor.selectionBackground": "#315f8c38",
        "editor.inactiveSelectionBackground": "#315f8c1c",
        "editor.lineHighlightBackground": "#275f9e0b",
        "editor.lineHighlightBorder": "#00000000",
        "editorBracketHighlight.foreground1": "#445253",
        "editorBracketHighlight.foreground2": "#445253",
        "editorBracketHighlight.foreground3": "#445253",
        "editorBracketHighlight.foreground4": "#445253",
        "editorBracketHighlight.foreground5": "#445253",
        "editorBracketHighlight.foreground6": "#445253",
        "editorBracketMatch.background": "#c6c2cd",
        "editorBracketMatch.border": "#827a8d",
        "editorIndentGuide.background1": "#c4c0ca",
        "editorIndentGuide.activeBackground1": "#9c95a4",
        "editorGutter.background": "#d9d6df",
        "editorSuggestWidget.background": "#e7e4ea",
        "editorSuggestWidget.border": "#aaa3b2",
        "editorSuggestWidget.foreground": "#252730",
        "editorSuggestWidget.highlightForeground": "#315f8c",
        "editorSuggestWidget.selectedBackground": "#c8d3df",
        "editorWidget.background": "#e7e4ea",
        "editorWidget.border": "#aaa3b2"
      }
    });
  }

  // packages/embed/src/frame.js
  var SOURCE = "idyllium-unit";
  var SITE = new URL("../", location.href).href;
  var UI = {
    ru: {
      run: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C",
      stop: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C",
      check: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C",
      reset: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C",
      format: "\u0424\u043E\u0440\u043C\u0430\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
      resetConfirm: "\u0422\u043E\u0447\u043D\u043E \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0437\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0443?",
      inputPlaceholder: "\u0412\u0432\u043E\u0434 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B\u2026",
      inputSend: "\u0412\u0432\u0435\u0441\u0442\u0438",
      idle: "\u0417\u0434\u0435\u0441\u044C \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0432\u044B\u0432\u043E\u0434 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B.",
      loadingCore: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F Idyllium\u2026",
      checking: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430: \u0442\u0435\u0441\u0442 {index} \u0438\u0437 {total}\u2026",
      finished: "\u041F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C.",
      powered: "\u0420\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043D\u0430 Idyllium",
      broken: "\u042E\u043D\u0438\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D \u0441 \u043E\u0448\u0438\u0431\u043A\u043E\u0439:",
      coreFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C Idyllium \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0438 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443."
    },
    en: {
      run: "Run",
      stop: "Stop",
      check: "Check",
      reset: "Reset",
      format: "Format",
      resetConfirm: "Really restore the starter?",
      inputPlaceholder: "Program input\u2026",
      inputSend: "Enter",
      idle: "Program output appears here.",
      loadingCore: "Loading Idyllium\u2026",
      checking: "Checking: test {index} of {total}\u2026",
      finished: "The program finished.",
      powered: "Powered by Idyllium",
      broken: "This unit is misconfigured:",
      coreFailed: "Could not load Idyllium \u2014 check the connection and reload the page."
    }
  };
  var el = (id) => document.getElementById(id);
  var dom = {
    unit: el("unit"),
    broken: el("broken"),
    statement: el("statement"),
    editorHost: el("editor"),
    run: el("run"),
    stop: el("stop"),
    check: el("check"),
    reset: el("reset"),
    format: el("format"),
    console: el("console"),
    output: el("output"),
    inputRow: el("input-row"),
    input: el("input"),
    inputSend: el("input-send"),
    verdict: el("verdict"),
    branding: el("branding")
  };
  var config = null;
  var rawConfig = null;
  var activeTheme = "auto";
  var lang = "ru";
  var editor = null;
  var state = "idle";
  var stopProgram = null;
  var pendingInput = null;
  var attempts = 0;
  var scriptPromise = null;
  var normalizedFor = null;
  var monacoReady = null;
  var monacoPromise = null;
  var setLabel = (button, text) => {
    button.querySelector(".label").textContent = text;
  };
  var t = (key, params = {}) => {
    let text = (UI[lang] || UI.ru)[key] ?? key;
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
    return text;
  };
  var lineHeightFor = (fontSize) => Math.round(fontSize * 25 / 16);
  function post(type, payload = {}) {
    parent.postMessage({ source: SOURCE, type, ...payload }, "*");
  }
  var BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function decodeHashConfig(encoded) {
    const bytes = [];
    let buffer = 0;
    let bits = 0;
    for (const char of encoded) {
      const value = BASE64URL.indexOf(char);
      if (value < 0) throw new Error(`unexpected character '${char}'`);
      buffer = buffer << 6 | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push(buffer >> bits & 255);
      }
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)));
  }
  function peek(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const editorSource = source.editor && typeof source.editor === "object" ? source.editor : {};
    const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : fallback));
    const starter = typeof source.starter === "string" ? source.starter : "use console;\n\nmain() {\n    \n}\n";
    return {
      id: typeof source.id === "string" ? source.id : "unit",
      title: typeof source.title === "string" ? source.title : "",
      statement: typeof source.statement === "string" ? source.statement : "",
      starter: starter === "minimal" ? "use console;\n\nmain() {\n    \n}\n" : starter === "empty" ? "" : starter,
      lang: source.lang === "en" ? "en" : "ru",
      editor: {
        rows: clamp(editorSource.rows, 4, 40, 16),
        consoleRows: clamp(editorSource.consoleRows, 3, 20, 6),
        fontSize: clamp(editorSource.fontSize, 10, 28, 16),
        theme: editorSource.theme === "light" || editorSource.theme === "dark" ? editorSource.theme : "auto",
        mode: editorSource.mode === "light" ? "light" : "monaco",
        autocomplete: editorSource.autocomplete !== false,
        format: editorSource.format !== false
      },
      hasCheck: Boolean(source.check && typeof source.check === "object" && source.check.kind && source.check.kind !== "none"),
      branding: !(source.feedback && source.feedback.branding === false),
      accent: typeof source.accent === "string" && /^#[0-9a-fA-F]{3,8}$/u.test(source.accent) ? source.accent : ""
    };
  }
  var IDENT = "[A-Za-z_\u0410-\u042F\u0430-\u044F\u0401\u0451][A-Za-z0-9_\u0410-\u042F\u0430-\u044F\u0401\u0451]*";
  var RE = {
    lineComment: /^\/\/[^\n]*/u,
    blockComment: /^\/\*[\s\S]*?(?:\*\/|$)/u,
    string: /^(?:"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/u,
    number: /^\d+(?:\.\d+)?\b/u,
    classDecl: new RegExp(`^(class|extends)(\\s+)(${IDENT})`, "u"),
    ident: new RegExp(`^${IDENT}`, "u"),
    typePosition: new RegExp(`^\\s+${IDENT}\\s*(?:[=;,)\\[]|$)`, "mu"),
    call: /^\s*\(/u,
    space: /^\s+/u
  };
  var tok = (kind, text) => `<span class="tok-${kind}">${escapeHtml(text)}</span>`;
  function highlightLikeMonaco(source) {
    let html = "";
    let index = 0;
    let afterDot = false;
    while (index < source.length) {
      const rest = source.slice(index);
      let match = RE.space.exec(rest);
      if (match) {
        html += escapeHtml(match[0]);
        index += match[0].length;
        continue;
      }
      match = RE.lineComment.exec(rest) || RE.blockComment.exec(rest);
      if (match) {
        html += tok("comment", match[0]);
        index += match[0].length;
        afterDot = false;
        continue;
      }
      match = RE.string.exec(rest);
      if (match) {
        html += tok("string", match[0]);
        index += match[0].length;
        afterDot = false;
        continue;
      }
      match = RE.number.exec(rest);
      if (match) {
        html += tok("number", match[0]);
        index += match[0].length;
        afterDot = false;
        continue;
      }
      match = afterDot ? null : RE.classDecl.exec(rest);
      if (match) {
        html += tok("keyword", match[1]) + escapeHtml(match[2]) + tok("class", match[3]);
        index += match[0].length;
        continue;
      }
      match = RE.ident.exec(rest);
      if (match) {
        const word = match[0];
        const tail = rest.slice(word.length);
        let kind;
        if (/^[A-ZА-ЯЁ]/u.test(word) && RE.typePosition.test(tail)) kind = "class";
        else if (afterDot) kind = QUALIFIED_TYPES.has(word) || CLASS_NAMES.has(word) ? "class" : RE.call.test(tail) ? "function" : "object";
        else if (KEYWORDS.has(word)) kind = "keyword";
        else if (BUILTIN_TYPES.has(word)) kind = "type";
        else if (CLASS_NAMES.has(word)) kind = "class";
        else kind = RE.call.test(tail) ? "function" : "object";
        html += tok(kind, word);
        index += word.length;
        afterDot = false;
        continue;
      }
      afterDot = source[index] === ".";
      html += tok("brackets", source[index]);
      index += 1;
    }
    return source.endsWith("\n") ? `${html} ` : html;
  }
  function createLightEditor(host, value, onChange, onFirstFocus) {
    host.innerHTML = "";
    const root = document.createElement("div");
    root.className = "light";
    const gutter = document.createElement("pre");
    gutter.className = "light-gutter";
    const body = document.createElement("div");
    body.className = "light-body";
    const code = document.createElement("pre");
    code.className = "light-code";
    const input = document.createElement("textarea");
    input.className = "light-input";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    body.append(code, input);
    root.append(gutter, body);
    host.append(root);
    const paint = () => {
      code.innerHTML = highlightLikeMonaco(input.value);
      const count = input.value.split("\n").length;
      gutter.textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join("\n");
    };
    const sync = () => {
      code.scrollTop = input.scrollTop;
      code.scrollLeft = input.scrollLeft;
      gutter.scrollTop = input.scrollTop;
    };
    const insert = (text, caretShift = text.length) => {
      const start = input.selectionStart;
      input.setRangeText(text, start, input.selectionEnd, "end");
      input.selectionStart = input.selectionEnd = start + caretShift;
      paint();
      onChange();
    };
    input.value = value;
    input.addEventListener("input", () => {
      paint();
      onChange();
    });
    input.addEventListener("scroll", sync);
    input.addEventListener("focus", () => onFirstFocus(), { once: true });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        insert("    ");
      } else if (event.key === "Enter") {
        event.preventDefault();
        const before = input.value.slice(0, input.selectionStart);
        const lineStart = before.lastIndexOf("\n") + 1;
        const indent = /^[ \t]*/u.exec(before.slice(lineStart))[0];
        const opens = /\{\s*$/u.test(before);
        const closes = input.value[input.selectionStart] === "}";
        if (opens && closes) insert(`
${indent}    
${indent}`, indent.length + 5);
        else insert(`
${indent}${opens ? "    " : ""}`);
      } else if (event.key === "}") {
        const before = input.value.slice(0, input.selectionStart);
        const lineStart = before.lastIndexOf("\n") + 1;
        if (/^ {4,}$/u.test(before.slice(lineStart))) {
          event.preventDefault();
          input.setRangeText("", input.selectionStart - 4, input.selectionStart, "end");
          insert("}");
        }
      }
    });
    paint();
    return {
      kind: "light",
      getValue: () => input.value,
      setValue: (text) => {
        input.value = text;
        paint();
        sync();
      },
      focus: () => input.focus(),
      hasFocus: () => document.activeElement === input,
      getCaret: () => input.selectionStart,
      // Замена всего текста (форматирование): курсор остаётся на своей строке.
      replaceText: (text) => {
        const place = caretPlace(input.value, input.selectionStart);
        input.value = text;
        const caret = caretOffset(text, place);
        input.setSelectionRange(caret, caret);
        paint();
        sync();
      },
      setMarkers: () => {
      },
      dispose: () => {
        host.innerHTML = "";
      }
    };
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", () => reject(new Error(`cannot load ${src}`)));
      document.head.append(script);
    });
  }
  function core() {
    if (!scriptPromise) scriptPromise = loadScript(`${SITE}assets/idyllium-web-core.js`).then(() => window.Idyllium);
    return scriptPromise.then((api) => {
      if (normalizedFor !== rawConfig) {
        const normalized = api.embed.normalizeUnitConfig(rawConfig);
        const errors = normalized.problems.filter((problem) => problem.severity === "error");
        if (errors.length > 0) {
          showBroken(errors.map((problem) => api.embed.unitText(lang, problem.code, problem.params)).join("\n"));
          throw new Error("unit configuration is broken");
        }
        config = normalized.config;
        normalizedFor = rawConfig;
      }
      return api;
    });
  }
  function restrictedProject(api, source) {
    return new api.IdylliumProject({
      entryFile: "main.idyl",
      files: { "main.idyl": source },
      stdlib: api.createDefaultStandardLibrary().restrictedTo(config.libs)
    });
  }
  function activateMonaco() {
    if (monacoPromise || peek(rawConfig).editor.mode !== "monaco") return;
    monacoPromise = (async () => {
      const api = await core();
      if (!monacoReady) monacoReady = prepareMonaco(api);
      const monaco = await monacoReady;
      swapInMonaco(api, monaco);
    })().catch((error) => {
      console.warn("[idyllium-unit] Monaco is unavailable, staying with the light editor:", error);
    });
  }
  async function prepareMonaco(api) {
    {
      window.MonacoEnvironment = {
        // Пустой origin песочницы не вправе создать воркер по чужому адресу —
        // воркер собирается из blob и подтягивает код Monaco через importScripts.
        getWorkerUrl() {
          const base = `${SITE}monaco/`;
          const source = `self.MonacoEnvironment = { baseUrl: ${JSON.stringify(base)} }; importScripts(${JSON.stringify(`${base}vs/base/worker/workerMain.js`)});`;
          return URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        }
      };
      await loadScript(`${SITE}monaco/vs/loader.js`);
      window.require.config({ paths: { vs: `${SITE}monaco/vs` } });
      await new Promise((resolve, reject) => window.require(["vs/editor/editor.main"], resolve, reject));
      const monaco = window.monaco;
      registerIdylliumGrammar(monaco);
      defineIdylliumThemes(monaco);
      const kinds = monaco.languages.CompletionItemKind;
      const kindOf = { module: kinds.Module, function: kinds.Function, constant: kinds.Constant, type: kinds.Class, property: kinds.Property, method: kinds.Method, parameter: kinds.Variable, variable: kinds.Variable };
      monaco.languages.registerCompletionItemProvider(MONACO_LANGUAGE_ID, {
        triggerCharacters: ["."],
        provideCompletionItems(model, position) {
          if (!peek(rawConfig).editor.autocomplete) return { suggestions: [] };
          try {
            const offset = model.getOffsetAt(position);
            const word = model.getWordUntilPosition(position);
            const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
            const items = restrictedProject(api, model.getValue()).completions({ file: "main.idyl", offset }).slice(0, 80);
            return { suggestions: items.map((item) => ({ label: item.name, kind: kindOf[item.kind] ?? kinds.Text, detail: item.detail, insertText: item.name, range })) };
          } catch (_error) {
            return { suggestions: [] };
          }
        }
      });
      return monaco;
    }
  }
  function swapInMonaco(api, monaco) {
    {
      const previous = editor;
      const hadFocus = previous.hasFocus();
      const caret = previous.getCaret();
      const value = previous.getValue();
      previous.dispose();
      const instance = monaco.editor.create(dom.editorHost, {
        value,
        language: MONACO_LANGUAGE_ID,
        theme: document.body.classList.contains("theme-light") ? "idyllium-light" : "idyllium-dark",
        fontSize: config.editor.fontSize,
        fontFamily: '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        lineHeight: lineHeightFor(config.editor.fontSize),
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 12,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        fixedOverflowWidgets: true,
        // Как в Web IDE: подсказки — после точки и по Ctrl+Пробел, слов из текста нет.
        quickSuggestions: false,
        suggestOnTriggerCharacters: peek(rawConfig).editor.autocomplete,
        suggest: { showWords: false },
        wordBasedSuggestions: "off",
        renderLineHighlight: "line",
        renderLineHighlightOnlyWhenFocus: true,
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        lineNumbersMinChars: 3,
        padding: { top: 6, bottom: 6 },
        scrollbar: { alwaysConsumeMouseWheel: false }
      });
      if (!peek(rawConfig).editor.autocomplete) instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      });
      const model = instance.getModel();
      let markerTimer = 0;
      const refreshMarkers = () => {
        clearTimeout(markerTimer);
        markerTimer = setTimeout(() => {
          try {
            const diagnostics = restrictedProject(api, model.getValue()).diagnostics("main.idyl");
            monaco.editor.setModelMarkers(model, "idyllium", diagnostics.map((item) => ({
              severity: item.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
              message: item.message,
              startLineNumber: item.range.start.line,
              startColumn: item.range.start.column,
              endLineNumber: item.range.end.line,
              endColumn: Math.max(item.range.end.column, item.range.start.column + 1)
            })));
          } catch (_error) {
            monaco.editor.setModelMarkers(model, "idyllium", []);
          }
        }, 350);
      };
      instance.onDidChangeModelContent(() => {
        onCodeChange();
        refreshMarkers();
      });
      refreshMarkers();
      editor = {
        kind: "monaco",
        getValue: () => instance.getValue(),
        setValue: (text) => instance.setValue(text),
        focus: () => instance.focus(),
        hasFocus: () => instance.hasTextFocus(),
        getCaret: () => model.getOffsetAt(instance.getPosition()),
        // Одна правка в истории редактора: Ctrl+Z возвращает текст до форматирования.
        replaceText: (text) => {
          const place = caretPlace(instance.getValue(), model.getOffsetAt(instance.getPosition()));
          instance.pushUndoStop();
          instance.executeEdits("idyllium-format", [{ range: model.getFullModelRange(), text }]);
          instance.pushUndoStop();
          instance.setPosition(model.getPositionAt(caretOffset(text, place)));
        },
        dispose: () => instance.dispose(),
        setTheme: (dark) => monaco.editor.setTheme(dark ? "idyllium-dark" : "idyllium-light")
      };
      if (hadFocus) {
        instance.focus();
        instance.setPosition(model.getPositionAt(caret));
      }
    }
  }
  function clearOutput() {
    dom.output.textContent = "";
  }
  function write(text, className = "") {
    if (className) {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = text;
      dom.output.append(span);
    } else {
      appendAnsiText(dom.output, text);
    }
    dom.output.scrollTop = dom.output.scrollHeight;
  }
  function askInput() {
    return new Promise((resolve, reject) => {
      pendingInput = { resolve, reject };
      dom.inputRow.hidden = false;
      dom.input.value = "";
      dom.input.focus();
      reportHeight();
    });
  }
  function closeInput() {
    pendingInput = null;
    dom.inputRow.hidden = true;
    reportHeight();
  }
  function submitInput() {
    if (!pendingInput) return;
    const value = dom.input.value;
    const { resolve } = pendingInput;
    closeInput();
    write(`${value}
`, "echo");
    resolve(value);
  }
  dom.inputSend.addEventListener("click", submitInput);
  dom.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitInput();
    }
  });
  function setState(next) {
    state = next;
    const busy = next !== "idle";
    dom.run.hidden = next === "running";
    dom.stop.hidden = next !== "running";
    dom.run.disabled = busy;
    dom.check.disabled = busy;
    dom.reset.disabled = busy;
    dom.format.disabled = busy;
  }
  function showVerdict(kind, text) {
    dom.verdict.hidden = false;
    dom.verdict.className = `verdict verdict-${kind}`;
    dom.verdict.textContent = text;
    reportHeight();
  }
  function hideVerdict() {
    dom.verdict.hidden = true;
    reportHeight();
  }
  function showBroken(text) {
    dom.unit.hidden = true;
    dom.broken.hidden = false;
    dom.broken.textContent = `${t("broken")}
${text}`;
    reportHeight();
  }
  async function withCore(action) {
    let api;
    try {
      if (!scriptPromise) write(`${t("loadingCore")}
`, "note");
      api = await core();
    } catch (error) {
      if (!dom.broken.hidden) return;
      clearOutput();
      write(`${t("coreFailed")}
`, "trouble");
      return;
    }
    await action(api);
  }
  async function runProgram() {
    if (state !== "idle") return;
    hideVerdict();
    clearOutput();
    await withCore(async (api) => {
      clearOutput();
      setState("running");
      const source = editor.getValue();
      const run = await api.embed.runUnitProgram(api.createUnitRunner(), source, [], config, {
        interactive: {
          readLine: askInput,
          write: (text) => write(text),
          clear: clearOutput,
          onStopReady: (stop) => {
            stopProgram = stop;
          }
        }
      });
      stopProgram = null;
      closeInput();
      setState("idle");
      if (run.failure) {
        write(`${dom.output.textContent.endsWith("\n") || dom.output.textContent === "" ? "" : "\n"}${api.embed.reasonText(lang, run.failure)}
`, "trouble");
      } else {
        write(`${dom.output.textContent.endsWith("\n") || dom.output.textContent === "" ? "" : "\n"}${t("finished")}
`, "note");
        if (config.feedback.softRunHint && config.check.kind !== "none") {
          const hint = await api.embed.judgeManualRun(config, run, api.createUnitRunner());
          if (hint === "matches") showVerdict("soft", api.embed.unitText(lang, "verdict.soft-matches"));
          else if (hint === "differs") showVerdict("soft", api.embed.unitText(lang, "verdict.soft-differs"));
        }
      }
      post("run", { unit: config.id, output: run.rawOutput, error: run.failure ? api.embed.reasonText(lang, run.failure) : null });
      reportHeight();
    });
  }
  function stopRunning() {
    if (pendingInput) {
      const { reject } = pendingInput;
      closeInput();
      reject(new Error("stopped"));
    }
    if (stopProgram) stopProgram();
  }
  async function checkSolution() {
    if (state !== "idle") return;
    await withCore(async (api) => {
      setState("checking");
      attempts += 1;
      const code = editor.getValue();
      const report = await api.embed.checkUnit(config, code, api.createUnitRunner(), {
        onProgress: (index, total) => showVerdict("soft", t("checking", { index, total }))
      });
      setState("idle");
      const text = api.embed.unitText;
      const lines = [];
      if (report.verdict === "solved") {
        lines.push(text(lang, "verdict.solved", { passed: report.passed, total: report.total }));
      } else if (report.blocker) {
        lines.push(api.embed.reasonText(lang, report.blocker));
      } else {
        const failure = report.firstFailure;
        lines.push(text(lang, "verdict.failed", { passed: report.passed, total: report.total }));
        const answer = failure.answer === "" ? text(lang, "verdict.empty-answer") : failure.answer;
        lines.push(failure.input === "" ? text(lang, "verdict.failed-noinput", { answer }) : text(lang, "verdict.failed-input", { input: failure.input, answer }));
        if (failure.reason) lines.push(api.embed.reasonText(lang, failure.reason));
        if (config.feedback.reveal && failure.expected !== null) lines.push(text(lang, "verdict.expected", { expected: failure.expected }));
      }
      showVerdict(report.verdict === "solved" ? "ok" : "fail", lines.join("\n"));
      const detail = {
        unit: config.id,
        verdict: report.verdict,
        passed: report.passed,
        total: report.total,
        attempt: attempts,
        firstFailure: report.firstFailure ? { input: report.firstFailure.input, answer: report.firstFailure.answer, reason: api.embed.reasonText(lang, report.firstFailure.reason) } : report.blocker ? { input: "", answer: "", reason: api.embed.reasonText(lang, report.blocker) } : null
      };
      if (config.feedback.shareCode) detail.code = code;
      post("check", { detail });
    });
  }
  function formatCode() {
    if (state !== "idle" || !editor) return;
    core().then((api) => {
      const before = editor.getValue();
      const after = api.formatIdyllium(before);
      if (after === before) return;
      editor.replaceText(after);
      onCodeChange();
    }).catch(() => {
    });
  }
  function caretPlace(text, offset) {
    const before = text.slice(0, offset);
    const line = before.split("\n").length - 1;
    const lineText = text.split("\n")[line] ?? "";
    const indent = lineText.length - lineText.trimStart().length;
    const column = before.length - (before.lastIndexOf("\n") + 1);
    return { line, fromIndent: Math.max(0, column - indent) };
  }
  function caretOffset(text, place) {
    const lines = text.split("\n");
    const line = Math.min(place.line, lines.length - 1);
    const lineText = lines[line];
    const indent = lineText.length - lineText.trimStart().length;
    const column = Math.min(lineText.length, indent + place.fromIndent);
    return lines.slice(0, line).reduce((sum, item) => sum + item.length + 1, 0) + column;
  }
  var resetArmed = 0;
  function resetCode(force = false) {
    if (state !== "idle") return;
    const starter = peek(rawConfig).starter;
    if (!force && editor.getValue() !== starter && !resetArmed) {
      setLabel(dom.reset, t("resetConfirm"));
      resetArmed = setTimeout(() => {
        resetArmed = 0;
        setLabel(dom.reset, t("reset"));
      }, 4e3);
      return;
    }
    clearTimeout(resetArmed);
    resetArmed = 0;
    setLabel(dom.reset, t("reset"));
    editor.setValue(starter);
    clearOutput();
    hideVerdict();
    onCodeChange();
  }
  var draftTimer = 0;
  function onCodeChange() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => post("draft", { unit: peek(rawConfig).id, code: editor.getValue() }), 500);
  }
  var lastHeight = 0;
  function reportHeight() {
    requestAnimationFrame(() => {
      const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (height !== lastHeight) {
        lastHeight = height;
        post("height", { height });
      }
    });
  }
  function applyTheme(theme) {
    activeTheme = theme;
    const dark = theme === "dark" || theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("theme-light", !dark);
    if (editor && editor.setTheme) editor.setTheme(dark);
  }
  function mount(raw, draft) {
    rawConfig = raw;
    const view = peek(raw);
    lang = view.lang;
    document.documentElement.lang = lang;
    document.documentElement.style.setProperty("--font-size", `${view.editor.fontSize}px`);
    if (view.accent) document.documentElement.style.setProperty("--accent", view.accent);
    applyTheme(view.editor.theme);
    const line = lineHeightFor(view.editor.fontSize);
    document.documentElement.style.setProperty("--line-height", `${line}px`);
    dom.editorHost.parentElement.style.height = `${view.editor.rows * line + 14}px`;
    dom.output.style.height = `${Math.round(view.editor.consoleRows * (view.editor.fontSize - 2) * 1.5) + 18}px`;
    dom.output.dataset.idle = t("idle");
    setLabel(dom.run, t("run"));
    setLabel(dom.stop, t("stop"));
    setLabel(dom.check, t("check"));
    setLabel(dom.reset, t("reset"));
    setLabel(dom.format, t("format"));
    dom.format.hidden = !view.editor.format;
    dom.input.placeholder = t("inputPlaceholder");
    setLabel(dom.inputSend, t("inputSend"));
    dom.check.hidden = !view.hasCheck;
    dom.branding.hidden = !view.branding;
    dom.branding.textContent = t("powered");
    if (view.statement.trim() !== "" || view.title.trim() !== "") {
      dom.statement.hidden = false;
      dom.statement.innerHTML = "";
      if (view.title.trim() !== "") {
        const title = document.createElement("div");
        title.className = "statement-title";
        title.textContent = view.title;
        dom.statement.append(title);
      }
      if (view.statement.trim() !== "") dom.statement.append(document.createTextNode(view.statement));
    } else {
      dom.statement.hidden = true;
    }
    if (editor) editor.dispose();
    monacoPromise = null;
    editor = createLightEditor(dom.editorHost, typeof draft === "string" ? draft : view.starter, onCodeChange, activateMonaco);
    clearOutput();
    hideVerdict();
    setState("idle");
    dom.broken.hidden = true;
    dom.unit.hidden = false;
    reportHeight();
  }
  dom.run.addEventListener("click", runProgram);
  dom.stop.addEventListener("click", stopRunning);
  dom.check.addEventListener("click", checkSolution);
  dom.reset.addEventListener("click", () => resetCode(false));
  dom.format.addEventListener("click", formatCode);
  new ResizeObserver(reportHeight).observe(document.body);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (rawConfig) applyTheme(activeTheme);
  });
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.source !== SOURCE || event.source !== parent) return;
    if (data.type === "config") {
      mount(data.config, data.draft);
    } else if (data.type === "command") {
      if (data.name === "check") checkSolution();
      else if (data.name === "run") runProgram();
      else if (data.name === "reset") resetCode(true);
      else if (data.name === "setTheme") applyTheme(data.theme);
      else if (data.name === "setCode" && editor) {
        editor.setValue(String(data.code ?? ""));
        onCodeChange();
      } else if (data.name === "getCode") post("code", { requestId: data.requestId, code: editor ? editor.getValue() : "" });
    }
  });
  var hashMatch = /[#&]unit=([A-Za-z0-9_-]+)/u.exec(location.hash);
  if (hashMatch) {
    try {
      mount(decodeHashConfig(hashMatch[1]));
    } catch (error) {
      showBroken(String(error && error.message ? error.message : error));
    }
  }
  post("ready", { hasConfig: Boolean(hashMatch) });
})();
