/* Idyllium 1.6.2 — собрано tools/build-embed.js из packages/embed/; править источники. */
"use strict";
(() => {
  // packages/embed/src/authors.js
  var api = window.Idyllium;
  var embed = api.embed;
  var DRAFT_KEY = "idyllium-authors-draft";
  var $ = (id) => document.getElementById(id);
  var EXAMPLE = {
    title: "\u041F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A",
    statement: "\u0421\u0447\u0438\u0442\u0430\u0439\u0442\u0435 \u0441 \u043A\u043E\u043D\u0441\u043E\u043B\u0438 \u0448\u0438\u0440\u0438\u043D\u0443 \u0438 \u0432\u044B\u0441\u043E\u0442\u0443 \u043F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430. \u0412\u044B\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043C\u0435\u0442\u0440, \u0437\u0430\u0442\u0435\u043C \u043F\u043B\u043E\u0449\u0430\u0434\u044C \u2014 \u043A\u0430\u0436\u0434\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0441 \u043D\u043E\u0432\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0438.",
    starter: `use console;

main() {
    console.write("Hello, World!", '\\n');
}
`,
    tests: [{ in: "3 5" }, { in: "10 2" }, { random: 2, range: [1, 100], times: 3 }],
    check: { kind: "formula", rules: [{ when: "", expr: "{out1} == ({in1} + {in2}) * 2 and {out2} == {in1} * {in2} and {outs} == 2" }], tolerance: 1e-6 },
    solution: "use console;\n\nmain() {\n    int w = console.get_int();\n    int h = console.get_int();\n    console.writeln((w + h) * 2);\n    console.writeln(w * h);\n}\n"
  };
  var state = embed.normalizeUnitConfig(EXAMPLE).config;
  var idTouched = false;
  var outputKind = "full";
  var previewUnit = null;
  var inputKinds = [];
  var lastFocusedFormula = null;
  var selfCheckTimer = 0;
  var selfCheckRun = 0;
  var solutionAnswers = [];
  function starterKind(starter) {
    if (starter === "") return "empty";
    if (starter === embed.STARTER_MINIMAL) return "minimal";
    return "custom";
  }
  function writeForm() {
    $("title").value = state.title;
    $("unit-id").value = state.id;
    $("statement").value = state.statement;
    document.querySelectorAll('input[name="starter-kind"]').forEach((radio) => {
      radio.checked = radio.value === starterKind(state.starter);
    });
    $("starter").value = state.starter;
    $("starter").disabled = starterKind(state.starter) !== "custom";
    $("rows").value = state.editor.rows;
    $("console-rows").value = state.editor.consoleRows;
    $("font-size").value = state.editor.fontSize;
    $("theme").value = state.editor.theme;
    $("editor-mode").value = state.editor.mode;
    $("autocomplete").checked = state.editor.autocomplete;
    $("format-button").checked = state.editor.format;
    $("open-in-ide").checked = state.editor.openInIde;
    $("lang").value = state.lang;
    $("branding").checked = state.feedback.branding;
    $("soft-hint").checked = state.feedback.softRunHint;
    $("reveal").checked = state.feedback.reveal;
    $("share-code").checked = state.feedback.shareCode;
    document.querySelectorAll('input[name="inputs"]').forEach((radio) => {
      radio.checked = radio.value === state.inputs;
    });
    $("tests-block").hidden = state.inputs === "none";
    $("expect").value = state.check.kind === "expect" ? state.check.output : $("expect").value;
    $("tolerance").value = String("tolerance" in state.check ? state.check.tolerance : 1e-6);
    $("require").value = state.code.require.join(" ");
    $("forbid").value = state.code.forbid.join(" ");
    $("max-calls").value = Object.entries(state.code.maxCalls).map(([name, limit]) => `${name}:${limit}`).join(" ");
    $("solution").value = state.solution;
    $("hook-solved").value = state.hooks.solved;
    $("hook-failed").value = state.hooks.failed;
    $("hook-check").value = state.hooks.check;
    renderLibs();
    renderTests();
    renderRules();
    renderCheckTabs();
  }
  function renderLibs() {
    const host = $("libs");
    host.innerHTML = "";
    for (const name of embed.UNIT_LIBRARIES) {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = state.libs.includes(name);
      box.disabled = name === "console";
      box.addEventListener("change", () => {
        const libs = new Set(state.libs);
        if (box.checked) libs.add(name);
        else libs.delete(name);
        update({ libs: embed.UNIT_LIBRARIES.filter((item) => libs.has(item)) });
      });
      label.append(box, document.createTextNode(name));
      host.append(label);
    }
  }
  function renderTests() {
    const host = $("tests");
    host.innerHTML = "";
    state.tests.forEach((test, index) => {
      const row = document.createElement("div");
      row.className = "test-row";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn remove";
      remove.textContent = "\xD7";
      remove.title = "\u0423\u0431\u0440\u0430\u0442\u044C \u0442\u0435\u0441\u0442";
      remove.addEventListener("click", () => update({ tests: state.tests.filter((_, position) => position !== index) }, true));
      const replace = (next) => update({ tests: state.tests.map((item, position) => position === index ? next : item) });
      if ("random" in test) {
        const mini = (text) => {
          const span = document.createElement("span");
          span.className = "label-mini";
          span.textContent = text;
          return span;
        };
        const field = (value, onInput) => {
          const input = document.createElement("input");
          input.type = "number";
          input.className = "small";
          input.value = value;
          if (test.kind === "float") input.step = "any";
          input.addEventListener("input", () => onInput(Number(input.value)));
          return input;
        };
        row.append(
          mini("\u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0445 \u0447\u0438\u0441\u0435\u043B"),
          field(test.random, (value) => replace({ ...test, random: value })),
          mini("\u043E\u0442"),
          field(test.range[0], (value) => replace({ ...test, range: [value, test.range[1]] })),
          mini("\u0434\u043E"),
          field(test.range[1], (value) => replace({ ...test, range: [test.range[0], value] })),
          mini("\u0440\u0430\u0437"),
          field(test.times, (value) => replace({ ...test, times: value }))
        );
        const kind = document.createElement("select");
        kind.className = "kind";
        kind.title = "\u041A\u0430\u043A\u0438\u0435 \u0447\u0438\u0441\u043B\u0430 \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u0442\u044C";
        for (const [value, text] of [["int", "\u0446\u0435\u043B\u044B\u0435"], ["float", "\u0434\u0440\u043E\u0431\u043D\u044B\u0435"]]) kind.append(new Option(text, value));
        kind.value = test.kind === "float" ? "float" : "int";
        kind.addEventListener("input", () => {
          const { kind: _kind, digits: _digits, ...plain } = test;
          const next = kind.value === "float" ? { ...plain, kind: "float", digits: 1 } : { ...plain, range: [Math.ceil(test.range[0]), Math.floor(test.range[1])] };
          update({ tests: state.tests.map((item, position) => position === index ? next : item) }, true);
        });
        row.append(kind, remove);
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "\u0432\u0432\u043E\u0434 \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u043E\u0431\u0435\u043B: 3 5";
        input.value = Array.isArray(test.in) ? test.in.join(" ") : test.in;
        input.addEventListener("input", () => replace({ in: input.value }));
        row.append(input);
        const known = solutionAnswers.find((item) => item.input === embed.inputLines(test.in).join(" "));
        if (known) {
          const answer = document.createElement("span");
          answer.className = "answer";
          answer.title = "\u041E\u0442\u0432\u0435\u0442 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u0430\u0432\u0442\u043E\u0440\u0430 \u043D\u0430 \u044D\u0442\u043E\u0442 \u0442\u0435\u0441\u0442";
          answer.textContent = `\u2192 ${known.answer.replace(/\n/gu, " \u23CE ")}`;
          row.append(answer);
        }
        row.append(remove);
      }
      host.append(row);
    });
  }
  function renderRules() {
    const host = $("rules");
    host.innerHTML = "";
    const rules = state.check.kind === "formula" ? ruleDrafts : [];
    rules.forEach((rule, index) => {
      const row = document.createElement("div");
      row.className = "rule-row";
      const when = document.createElement("input");
      when.className = "when";
      when.placeholder = "\u043A\u043E\u0433\u0434\u0430 (\u043F\u0443\u0441\u0442\u043E \u2014 \u0432\u0441\u0435\u0433\u0434\u0430)";
      when.value = rule.when;
      const expr = document.createElement("input");
      expr.placeholder = "\u0443\u0441\u043B\u043E\u0432\u0438\u0435: {out1} == {in1} * 2";
      expr.value = rule.expr;
      const commit = () => setRules(currentRules().map((item, position) => position === index ? { when: when.value, expr: expr.value } : item));
      for (const input of [when, expr]) {
        input.addEventListener("input", commit);
        input.addEventListener("focus", () => {
          lastFocusedFormula = input;
        });
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn remove";
      remove.textContent = "\xD7";
      remove.addEventListener("click", () => setRules(currentRules().filter((_, position) => position !== index), true));
      row.append(when, expr, remove);
      host.append(row);
    });
  }
  var ruleDrafts = [];
  function currentRules() {
    return ruleDrafts;
  }
  function setRules(rules, rerender = false) {
    ruleDrafts = rules;
    update({ check: { kind: "formula", rules, tolerance: Number($("tolerance").value) || 1e-6 } }, rerender);
  }
  function renderCheckTabs() {
    document.querySelectorAll("[data-check]").forEach((tab) => tab.classList.toggle("active", tab.dataset.check === state.check.kind));
    document.querySelectorAll("[data-body]").forEach((body) => {
      body.hidden = body.dataset.body !== state.check.kind;
    });
  }
  function update(patch, rerender = false) {
    const merged = { ...state, ...patch, idyllium: window.IdylliumUnit.version };
    const normalized = embed.normalizeUnitConfig(merged);
    state = normalized.config;
    if (rerender) {
      renderTests();
      renderRules();
      renderCheckTabs();
      $("tests-block").hidden = state.inputs === "none";
    }
    saveDraft();
    refreshMarkup();
    schedulePreview();
    scheduleSelfCheck(normalized.problems);
  }
  var previewTimer = 0;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const config = embed.publicUnitConfig(state);
      if (!config.editor || !config.editor.theme || config.editor.theme === "auto") {
        config.editor = { ...config.editor, theme: document.body.classList.contains("light-theme") ? "light" : "dark" };
      }
      if (!previewUnit) {
        previewUnit = window.IdylliumUnit.create($("preview"), { ...config, id: `${config.id}-preview` });
      } else {
        previewUnit.configure({ ...config, id: `${config.id}-preview` });
      }
    }, 400);
  }
  function refreshMarkup() {
    $("markup").value = outputKind === "iframe" ? embed.renderUnitIframe(state) : embed.renderUnitMarkup(state);
  }
  function issueLine(issue) {
    const item = document.createElement("div");
    item.className = `issue issue-${issue.severity}`;
    const body = document.createElement("div");
    body.textContent = embed.unitText("ru", issue.code, issue.params);
    if (issue.reason) {
      const small = document.createElement("small");
      small.textContent = embed.reasonText("ru", issue.reason);
      body.append(small);
    }
    if (issue.suggestTest) {
      const fix = document.createElement("button");
      fix.type = "button";
      fix.className = "btn btn-fix";
      fix.textContent = `+ \u0442\u0435\u0441\u0442 \xAB${issue.suggestTest.join(" ")}\xBB`;
      fix.title = "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u0442\u0435\u0441\u0442 \u0432 \u0441\u043F\u0438\u0441\u043E\u043A";
      fix.addEventListener("click", () => update({ tests: [...state.tests, { in: issue.suggestTest.join(" ") }] }, true));
      body.append(fix);
    }
    item.append(body);
    return item;
  }
  function scheduleSelfCheck(problems) {
    clearTimeout(selfCheckTimer);
    selfCheckTimer = setTimeout(async () => {
      selfCheckRun += 1;
      const run = selfCheckRun;
      const host = $("selfcheck");
      const report = await embed.selfCheckUnit(state, problems, api.createUnitRunner(), { timeoutMs: 1e4 });
      if (run !== selfCheckRun) return;
      host.innerHTML = "";
      if (report.issues.length === 0) {
        const calm = document.createElement("p");
        calm.className = "hint";
        calm.textContent = "\u0417\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0439 \u043D\u0435\u0442.";
        host.append(calm);
      }
      const order = { error: 0, warning: 1, ok: 2 };
      [...report.issues].sort((left, right) => order[left.severity] - order[right.severity]).forEach((issue) => host.append(issueLine(issue)));
      solutionAnswers = [...report.solutionAnswers];
      inputKinds = [...report.inputKinds];
      renderTestsKeepingFocus();
      $("copy").dataset.blocked = report.hasErrors ? "1" : "";
    }, 900);
  }
  function renderTestsKeepingFocus() {
    if ($("tests").contains(document.activeElement)) return;
    renderTests();
  }
  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, ruleDrafts, idTouched }));
    } catch (_error) {
    }
  }
  function loadUnit(raw, note) {
    const normalized = embed.normalizeUnitConfig({ ...raw, idyllium: window.IdylliumUnit.version });
    state = normalized.config;
    ruleDrafts = state.check.kind === "formula" ? state.check.rules.map((rule) => ({ ...rule })) : [];
    idTouched = true;
    solutionAnswers = [];
    writeForm();
    refreshMarkup();
    schedulePreview();
    scheduleSelfCheck(normalized.problems);
    saveDraft();
    $("file-note").textContent = note;
  }
  $("save-file").addEventListener("click", () => {
    const blob = new Blob([`${JSON.stringify(state, null, 2)}
`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${state.id || "unit"}.idyunit`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
    $("file-note").textContent = `\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E: ${link.download} (\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u0440\u0430 \u2014 \u0432\u043D\u0443\u0442\u0440\u0438 \u0444\u0430\u0439\u043B\u0430)`;
  });
  $("open-file").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", async () => {
    const file = $("file-input").files[0];
    if (!file) return;
    try {
      loadUnit(JSON.parse(await file.text()), `\u041E\u0442\u043A\u0440\u044B\u0442: ${file.name}`);
    } catch (error) {
      $("file-note").textContent = `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C ${file.name}: \u044D\u0442\u043E \u043D\u0435 \u0444\u0430\u0439\u043B \u044E\u043D\u0438\u0442\u0430 (${error.message})`;
    }
    $("file-input").value = "";
  });
  $("new-unit").addEventListener("click", () => loadUnit({ starter: embed.STARTER_MINIMAL, check: { kind: "none" } }, "\u041D\u043E\u0432\u044B\u0439 \u044E\u043D\u0438\u0442"));
  $("title").addEventListener("input", () => {
    const patch = { title: $("title").value };
    if (!idTouched) {
      patch.id = embed.slugifyUnitId($("title").value) || "unit";
      $("unit-id").value = patch.id;
    }
    update(patch);
  });
  $("unit-id").addEventListener("input", () => {
    idTouched = true;
    update({ id: $("unit-id").value });
  });
  $("unit-id").addEventListener("blur", () => {
    $("unit-id").value = state.id;
  });
  $("statement").addEventListener("input", () => update({ statement: $("statement").value }));
  document.querySelectorAll('input[name="starter-kind"]').forEach((radio) => radio.addEventListener("change", () => {
    const kind = radio.value;
    const starter = kind === "empty" ? "" : kind === "minimal" ? embed.STARTER_MINIMAL : $("starter").value || EXAMPLE.starter;
    $("starter").value = starter;
    $("starter").disabled = kind !== "custom";
    update({ starter });
  }));
  $("starter").addEventListener("input", () => update({ starter: $("starter").value }));
  var editorPatch = () => ({
    editor: {
      rows: Number($("rows").value),
      consoleRows: Number($("console-rows").value),
      fontSize: Number($("font-size").value),
      theme: $("theme").value,
      mode: $("editor-mode").value,
      autocomplete: $("autocomplete").checked,
      format: $("format-button").checked,
      openInIde: $("open-in-ide").checked
    }
  });
  for (const id of ["rows", "console-rows", "font-size", "theme", "editor-mode", "autocomplete", "format-button", "open-in-ide"]) $(id).addEventListener("input", () => update(editorPatch()));
  $("lang").addEventListener("input", () => update({ lang: $("lang").value }));
  var feedbackPatch = () => ({
    feedback: { branding: $("branding").checked, softRunHint: $("soft-hint").checked, reveal: $("reveal").checked, shareCode: $("share-code").checked }
  });
  for (const id of ["branding", "soft-hint", "reveal", "share-code"]) $(id).addEventListener("change", () => update(feedbackPatch()));
  document.querySelectorAll('input[name="inputs"]').forEach((radio) => radio.addEventListener("change", () => update({ inputs: radio.value }, true)));
  $("add-test").addEventListener("click", () => update({ tests: [...state.tests, { in: "" }] }, true));
  $("add-random").addEventListener("click", () => {
    const float = inputKinds.includes("float");
    const test = { random: inputKinds.length || 2, range: [1, 100], times: 3, ...float ? { kind: "float", digits: 1 } : {} };
    update({ tests: [...state.tests, test] }, true);
  });
  document.querySelectorAll("[data-check]").forEach((tab) => tab.addEventListener("click", () => {
    const kind = tab.dataset.check;
    const tolerance = Number($("tolerance").value) || 1e-6;
    if (kind === "formula") {
      if (ruleDrafts.length === 0) ruleDrafts = [{ when: "", expr: "" }];
      update({ check: { kind, rules: ruleDrafts, tolerance } }, true);
    } else if (kind === "expect") update({ check: { kind, output: $("expect").value } }, true);
    else if (kind === "reference") update({ check: { kind, tolerance } }, true);
    else update({ check: { kind: "none" } }, true);
  }));
  $("add-rule").addEventListener("click", () => setRules([...currentRules(), { when: "", expr: "" }], true));
  $("tolerance").addEventListener("input", () => {
    const tolerance = Number($("tolerance").value);
    if (!Number.isFinite(tolerance) || tolerance < 0) return;
    if (state.check.kind === "formula") update({ check: { ...state.check, rules: ruleDrafts, tolerance } });
    else if (state.check.kind === "reference") update({ check: { kind: "reference", tolerance } });
  });
  $("expect").addEventListener("input", () => update({ check: { kind: "expect", output: $("expect").value } }));
  $("expect-from-solution").addEventListener("click", async () => {
    if (state.solution.trim() === "") {
      $("file-note").textContent = "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u043F\u0438\u0448\u0438\u0442\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u0440\u0430 (\u0431\u043B\u043E\u043A 8).";
      return;
    }
    const inputs = embed.expandTests(state.tests, state.inputs)[0] || [];
    const run = await embed.runUnitProgram(api.createUnitRunner(), state.solution, inputs, state);
    if (run.failure) {
      $("file-note").textContent = embed.reasonText("ru", run.failure);
      return;
    }
    $("expect").value = run.answer.replace(/\s+$/u, "");
    update({ check: { kind: "expect", output: $("expect").value } });
  });
  $("tokens").addEventListener("click", (event) => {
    const token = event.target.closest("[data-token]");
    if (!token || !lastFocusedFormula || !document.body.contains(lastFocusedFormula)) return;
    const input = lastFocusedFormula;
    input.setRangeText(token.dataset.token, input.selectionStart, input.selectionEnd, "end");
    input.dispatchEvent(new Event("input"));
    input.focus();
  });
  var wordsOf = (value) => value.split(/[\s,]+/u).filter(Boolean);
  var codePatch = () => {
    const maxCalls = {};
    for (const pair of wordsOf($("max-calls").value)) {
      const [name, limit] = pair.split(":");
      if (name && /^\d+$/u.test(limit || "")) maxCalls[name] = Number(limit);
    }
    return { code: { require: wordsOf($("require").value), forbid: wordsOf($("forbid").value), maxCalls } };
  };
  for (const id of ["require", "forbid", "max-calls"]) $(id).addEventListener("input", () => update(codePatch()));
  $("solution").addEventListener("input", () => update({ solution: $("solution").value }));
  $("solution-from-preview").addEventListener("click", async () => {
    if (!previewUnit) return;
    $("solution").value = await previewUnit.getCode();
    update({ solution: $("solution").value });
  });
  $("preview-from-solution").addEventListener("click", () => {
    if (previewUnit) previewUnit.setCode(state.solution);
  });
  for (const [id, key] of [["hook-solved", "solved"], ["hook-failed", "failed"], ["hook-check", "check"]]) {
    $(id).addEventListener("input", () => update({ hooks: { ...state.hooks, [key]: $(id).value.trim() } }));
  }
  document.querySelectorAll("[data-out]").forEach((tab) => tab.addEventListener("click", () => {
    outputKind = tab.dataset.out;
    document.querySelectorAll("[data-out]").forEach((item) => item.classList.toggle("active", item === tab));
    refreshMarkup();
  }));
  $("copy").addEventListener("click", async () => {
    if ($("copy").dataset.blocked === "1" && $("copy").dataset.armed !== "1") {
      $("copy").dataset.armed = "1";
      $("copy-note").textContent = "\u0412 \u0441\u0430\u043C\u043E\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0435 \u0435\u0441\u0442\u044C \u043A\u0440\u0430\u0441\u043D\u043E\u0435. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437, \u0435\u0441\u043B\u0438 \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u0445\u043E\u0442\u0438\u0442\u0435 \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C.";
      return;
    }
    $("copy").dataset.armed = "";
    try {
      await navigator.clipboard.writeText($("markup").value);
      $("copy-note").textContent = "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E.";
    } catch (_error) {
      $("markup").select();
      $("copy-note").textContent = "\u0412\u044B\u0434\u0435\u043B\u0435\u043D\u043E \u2014 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 Ctrl+C.";
    }
  });
  document.addEventListener("click", (event) => {
    const tip = event.target.closest(".tip");
    document.querySelectorAll(".tip.open").forEach((item) => {
      if (item !== tip) item.classList.remove("open");
    });
    if (tip) {
      event.preventDefault();
      tip.classList.toggle("open");
    }
  });
  document.querySelectorAll(".tip").forEach((tip) => tip.setAttribute("tabindex", "0"));
  var THEME_KEY = "idyllium-docs-theme";
  function applyTheme(light) {
    document.body.classList.toggle("light-theme", light);
    const hint = light ? "\u0422\u0451\u043C\u043D\u0430\u044F \u0442\u0435\u043C\u0430" : "\u0421\u0432\u0435\u0442\u043B\u0430\u044F \u0442\u0435\u043C\u0430";
    $("theme-toggle").title = hint;
    $("theme-toggle").setAttribute("aria-label", hint);
  }
  try {
    applyTheme(window.localStorage.getItem(THEME_KEY) === "light");
  } catch (_error) {
    applyTheme(false);
  }
  $("theme-toggle").addEventListener("click", () => {
    const light = !document.body.classList.contains("light-theme");
    applyTheme(light);
    try {
      window.localStorage.setItem(THEME_KEY, light ? "light" : "dark");
    } catch (_error) {
    }
    if (previewUnit && state.editor.theme === "auto") previewUnit.setTheme(light ? "light" : "dark");
  });
  (function start() {
    let restored = null;
    try {
      restored = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
    } catch (_error) {
      restored = null;
    }
    if (restored && restored.state) {
      loadUnit(restored.state, "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430");
      ruleDrafts = Array.isArray(restored.ruleDrafts) && state.check.kind === "formula" ? restored.ruleDrafts : ruleDrafts;
      idTouched = Boolean(restored.idTouched);
      renderRules();
    } else {
      loadUnit(EXAMPLE, "\u041F\u0440\u0438\u043C\u0435\u0440: \u043C\u043E\u0436\u043D\u043E \u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0435\u0433\u043E \u0438\u043B\u0438 \u043D\u0430\u0447\u0430\u0442\u044C \xAB\u041D\u043E\u0432\u044B\u0439 \u044E\u043D\u0438\u0442\xBB");
      idTouched = false;
    }
  })();
})();
