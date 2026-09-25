/* Idyllium 1.6.3 — собрано tools/build-embed.js из packages/embed/; править источники. */
"use strict";
(() => {
  // packages/embed/src/loader.js
  var SOURCE = "idyllium-unit";
  var SELF = document.currentScript || Array.from(document.scripts).reverse().find((script) => /idyllium-unit\.js(?:[?#]|$)/u.test(script.src));
  var BASE = new URL("./", SELF && SELF.src ? SELF.src : location.href).href;
  var VERSION = "1.6.3";
  function readConfig(element) {
    const config = {};
    const problems = [];
    for (const script of element.querySelectorAll(':scope > script[type="application/json"]')) {
      try {
        Object.assign(config, JSON.parse(script.textContent || "{}"));
      } catch (error) {
        problems.push(`JSON: ${error.message}`);
      }
    }
    for (const script of element.querySelectorAll(':scope > script[type="text/idyllium"]')) {
      const code = (script.textContent || "").replace(/^\s*\n/u, "").replace(/\s+$/u, "\n").replace(/<\\\/(script)/giu, "</$1");
      if (script.dataset.role === "solution") config.solution = code;
      else config.starter = code;
    }
    if (element.id && !config.id) config.id = element.id;
    const editor = { ...config.editor || {} };
    const number = (name) => element.hasAttribute(name) ? Number(element.getAttribute(name)) : void 0;
    if (number("rows") !== void 0) editor.rows = number("rows");
    if (number("console-rows") !== void 0) editor.consoleRows = number("console-rows");
    if (number("font-size") !== void 0) editor.fontSize = number("font-size");
    if (element.hasAttribute("theme")) editor.theme = element.getAttribute("theme");
    if (element.hasAttribute("editor")) editor.mode = element.getAttribute("editor");
    if (element.hasAttribute("autocomplete")) editor.autocomplete = element.getAttribute("autocomplete") !== "off";
    if (element.hasAttribute("format")) editor.format = element.getAttribute("format") !== "off";
    if (element.hasAttribute("open-in-ide")) editor.openInIde = element.getAttribute("open-in-ide") !== "off";
    config.editor = editor;
    if (element.hasAttribute("lang")) config.lang = element.getAttribute("lang");
    if (element.hasAttribute("starter")) config.starter = element.getAttribute("starter");
    if (element.hasAttribute("accent")) config.accent = element.getAttribute("accent");
    const hooks = { ...config.hooks || {} };
    for (const [attribute, key] of [["on-solved", "solved"], ["on-failed", "failed"], ["on-check", "check"]]) {
      if (element.hasAttribute(attribute)) hooks[key] = element.getAttribute(attribute);
    }
    config.hooks = hooks;
    return { config, problems };
  }
  function resolveHostFunction(name) {
    if (typeof name !== "string" || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/u.test(name)) return null;
    let owner = window;
    let value = window;
    for (const part of name.split(".")) {
      owner = value;
      value = owner == null ? void 0 : owner[part];
    }
    return typeof value === "function" ? value.bind(owner) : null;
  }
  var IdylliumUnit = class extends HTMLElement {
    constructor() {
      super();
      this.frame = null;
      this.config = null;
      this.pendingCode = /* @__PURE__ */ new Map();
      this.requestCounter = 0;
      this.onMessage = this.onMessage.bind(this);
    }
    connectedCallback() {
      if (this.frame) return;
      const { config, problems } = readConfig(this);
      this.config = config;
      if (problems.length > 0) console.warn(`[idyllium-unit] ${this.id || "(no id)"}: ${problems.join("; ")}`);
      this.style.display = "block";
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
      frame.setAttribute("title", config.title || "Idyllium");
      frame.setAttribute("loading", "lazy");
      frame.style.cssText = "display:block;width:100%;border:0;height:520px;color-scheme:normal;background:transparent;";
      frame.src = `${BASE}frame.html`;
      window.addEventListener("message", this.onMessage);
      this.append(frame);
      this.frame = frame;
    }
    disconnectedCallback() {
      window.removeEventListener("message", this.onMessage);
      if (this.frame) this.frame.remove();
      this.frame = null;
    }
    get storageKey() {
      return `idyllium-unit:${location.pathname}:${this.config?.id || this.id || "unit"}`;
    }
    readDraft() {
      try {
        return window.localStorage.getItem(this.storageKey);
      } catch (_error) {
        return null;
      }
    }
    writeDraft(code) {
      try {
        if (code === this.config.starter) window.localStorage.removeItem(this.storageKey);
        else window.localStorage.setItem(this.storageKey, code);
      } catch (_error) {
      }
    }
    send(message) {
      this.frame?.contentWindow?.postMessage({ source: SOURCE, ...message }, "*");
    }
    onMessage(event) {
      const data = event.data;
      if (!this.frame || event.source !== this.frame.contentWindow || !data || data.source !== SOURCE) return;
      if (data.type === "ready") {
        this.send({ type: "config", config: this.config, draft: this.readDraft() });
        this.dispatch("idyllium-ready", { unit: this.config.id || this.id });
      } else if (data.type === "height") {
        this.frame.style.height = `${Math.max(120, Number(data.height) || 0)}px`;
      } else if (data.type === "draft") {
        this.writeDraft(String(data.code ?? ""));
      } else if (data.type === "run") {
        this.dispatch("idyllium-run", { unit: data.unit, output: data.output, error: data.error });
      } else if (data.type === "check") {
        const detail = data.detail;
        this.dispatch("idyllium-check", detail);
        this.dispatch(detail.verdict === "solved" ? "idyllium-solved" : "idyllium-failed", detail);
        const hooks = this.config.hooks || {};
        this.callHost(hooks.check, detail);
        this.callHost(detail.verdict === "solved" ? hooks.solved : hooks.failed, detail);
      } else if (data.type === "code") {
        const resolve = this.pendingCode.get(data.requestId);
        this.pendingCode.delete(data.requestId);
        if (resolve) resolve(String(data.code ?? ""));
      }
    }
    dispatch(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    }
    callHost(name, detail) {
      if (!name) return;
      const fn = resolveHostFunction(name);
      if (!fn) {
        console.warn(`[idyllium-unit] \u0444\u0443\u043D\u043A\u0446\u0438\u0438 ${name} \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043D\u0435\u0442 \u2014 \u044E\u043D\u0438\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0434\u0430\u043B\u044C\u0448\u0435 \u0431\u0435\u0437 \u043D\u0435\u0451`);
        return;
      }
      try {
        fn(detail);
      } catch (error) {
        console.error(`[idyllium-unit] \u0444\u0443\u043D\u043A\u0446\u0438\u044F ${name} \u0443\u043F\u0430\u043B\u0430:`, error);
      }
    }
    /** Текст программы ученика (асинхронно: он живёт в песочнице). */
    getCode() {
      return new Promise((resolve) => {
        this.requestCounter += 1;
        const requestId = this.requestCounter;
        this.pendingCode.set(requestId, resolve);
        this.send({ type: "command", name: "getCode", requestId });
      });
    }
    setCode(code) {
      this.send({ type: "command", name: "setCode", code: String(code) });
    }
    reset() {
      this.send({ type: "command", name: "reset" });
    }
    run() {
      this.send({ type: "command", name: "run" });
    }
    check() {
      this.send({ type: "command", name: "check" });
    }
    /** Сменить тему на лету ('light' | 'dark' | 'auto') — для сайтов со своим переключателем темы. */
    setTheme(theme) {
      this.send({ type: "command", name: "setTheme", theme: String(theme) });
    }
    /** Новая конфигурация в живой юнит (конструктор: предпросмотр). */
    configure(config, { keepDraft = false } = {}) {
      this.config = config;
      this.send({ type: "config", config, draft: keepDraft ? this.readDraft() : null });
    }
  };
  if (!customElements.get("idyllium-unit")) customElements.define("idyllium-unit", IdylliumUnit);
  window.IdylliumUnit = {
    version: VERSION,
    /** Юнит из кода: IdylliumUnit.create(container, { starter, tests, check, … }). */
    create(container, config) {
      const element = document.createElement("idyllium-unit");
      if (config && config.id) element.id = config.id;
      const json = document.createElement("script");
      json.type = "application/json";
      json.textContent = JSON.stringify(config || {});
      element.append(json);
      container.append(element);
      return element;
    }
  };
})();
