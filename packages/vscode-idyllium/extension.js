'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const guiRenderer = loadGuiRenderer();

let outputChannel;
let diagnosticCollection;
let refreshTimer = null;
const activeRunKeys = new Set();
const activeRunSessions = new Map();
const semanticTokenTypes = ['namespace', 'class', 'function', 'method', 'property', 'variable', 'parameter'];
const semanticTokenModifiers = ['declaration', 'readonly', 'static', 'defaultLibrary'];
const semanticTokenLegend = new vscode.SemanticTokensLegend(semanticTokenTypes, semanticTokenModifiers);

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('Idyllium');
  diagnosticCollection = vscode.languages.createDiagnosticCollection('idyllium');

  const core = loadIdylliumCore(context);
  if (!core) {
    outputChannel.appendLine('Idyllium core was not found. Run npm run build:vscode in the repository root.');
  }

  context.subscriptions.push(outputChannel, diagnosticCollection);

  context.subscriptions.push(vscode.commands.registerCommand('idyllium.refreshDiagnostics', () => {
    scheduleDiagnosticsRefresh(core, 0);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('idyllium.runCurrentFile', async (target) => {
    await runCurrentFile(core, target);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('idyllium.runCurrentFileWithGui', async (target) => {
    await runCurrentFileWithGui(core, target, context);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('idyllium.stop', () => {
    stopActiveRuns();
  }));

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (isIdylliumDocument(document)) scheduleDiagnosticsRefresh(core);
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
    if (isIdylliumDocument(event.document)) scheduleDiagnosticsRefresh(core);
  }));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
    if (isIdylliumDocument(document)) scheduleDiagnosticsRefresh(core, 0);
  }));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
    if (isIdylliumDocument(document)) scheduleDiagnosticsRefresh(core, 0);
  }));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      async provideCompletionItems(document, position) {
        if (!core) return [];
        const project = await createProject(core, document.uri.fsPath);
        const completions = project.completions({
          file: normalizeFile(document.uri.fsPath),
          offset: document.offsetAt(position),
        });
        return completions.map(toVsCompletionItem);
      },
    },
    '.',
    ' ',
    '(',
    ','
  ));

  context.subscriptions.push(vscode.languages.registerHoverProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      async provideHover(document, position) {
        if (!core) return null;
        const project = await createProject(core, document.uri.fsPath);
        const hover = project.hover({
          file: normalizeFile(document.uri.fsPath),
          offset: document.offsetAt(position),
        });
        if (!hover) return null;
        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(hover.detail, 'idyllium');
        return new vscode.Hover(markdown, toVsRange(hover.range));
      },
    }
  ));

  context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      async provideSignatureHelp(document, position) {
        if (!core) return null;
        const project = await createProject(core, document.uri.fsPath);
        const help = project.signatureHelp({
          file: normalizeFile(document.uri.fsPath),
          offset: document.offsetAt(position),
        });
        return help ? toVsSignatureHelp(help) : null;
      },
    },
    '(',
    ','
  ));

  context.subscriptions.push(vscode.languages.registerDefinitionProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      async provideDefinition(document, position) {
        if (!core) return null;
        const project = await createProject(core, document.uri.fsPath);
        const definition = project.definition({
          file: normalizeFile(document.uri.fsPath),
          offset: document.offsetAt(position),
        });
        return definition ? new vscode.Location(vscode.Uri.file(definition.file), toVsRange(definition.range)) : null;
      },
    }
  ));

  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      provideDocumentFormattingEdits(document, options) {
        if (!core?.formatIdyllium) return [];
        const formatted = core.formatIdyllium(document.getText(), {
          indentSize: typeof options.tabSize === 'number' ? options.tabSize : 4,
          insertSpaces: options.insertSpaces !== false,
        });
        if (formatted === document.getText()) return [];
        return [vscode.TextEdit.replace(fullDocumentRange(document), formatted)];
      },
    }
  ));

  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      async provideDocumentSymbols(document) {
        if (!core) return [];
        const project = await createProject(core, document.uri.fsPath);
        return project.documentSymbols(normalizeFile(document.uri.fsPath)).map(toVsDocumentSymbol);
      },
    }
  ));

  context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      async provideDocumentSemanticTokens(document) {
        if (!core) return new vscode.SemanticTokensBuilder(semanticTokenLegend).build();
        const project = await createProject(core, document.uri.fsPath);
        const builder = new vscode.SemanticTokensBuilder(semanticTokenLegend);
        for (const token of project.semanticTokens(normalizeFile(document.uri.fsPath))) {
          builder.push(toVsRange(token.range), token.kind, [...token.modifiers]);
        }
        return builder.build();
      },
    },
    semanticTokenLegend,
  ));

  context.subscriptions.push(vscode.languages.registerCodeLensProvider(
    { language: 'idyllium', scheme: 'file' },
    {
      provideCodeLenses(document) {
        return mainRunCodeLenses(document);
      },
    }
  ));

  scheduleDiagnosticsRefresh(core, 0);
  updateRunContext();
}

function deactivate() {
  if (refreshTimer) clearTimeout(refreshTimer);
  for (const session of [...activeRunSessions.values()]) {
    session.stop();
  }
}

function loadGuiRenderer() {
  const candidates = [
    path.join(__dirname, 'gui-renderer'),
    path.resolve(__dirname, '..', 'gui-renderer'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    return require(candidate);
  }

  throw new Error('Idyllium GUI renderer was not found. Run npm run build:vscode in the repository root.');
}

function loadIdylliumCore(context) {
  const candidates = [
    path.join(context.extensionPath, 'server', 'dist', 'src', 'index.js'),
    path.join(context.extensionPath, 'dist', 'src', 'index.js'),
    path.resolve(context.extensionPath, '..', '..', 'dist', 'src', 'index.js'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      outputChannel.appendLine(`Loading Idyllium core from ${candidate}`);
      return require(candidate);
    } catch (error) {
      outputChannel.appendLine(`Failed to load ${candidate}: ${formatError(error)}`);
    }
  }

  return null;
}

function createIdylliumRunTerminal(name) {
  const writeEmitter = new vscode.EventEmitter();
  const closeEmitter = new vscode.EventEmitter();
  const pending = [];
  let opened = false;

  const pty = {
    onDidWrite: writeEmitter.event,
    onDidClose: closeEmitter.event,
    open() {
      opened = true;
      while (pending.length > 0) writeEmitter.fire(pending.shift());
    },
    close() {
      closeEmitter.fire();
    },
    handleInput() {
      // Idyllium currently asks for input through VS Code input boxes.
    },
  };

  const terminal = vscode.window.createTerminal({ name, pty });
  const write = (text) => {
    const value = normalizeTerminalText(text);
    if (opened) {
      writeEmitter.fire(value);
    } else {
      pending.push(value);
    }
  };

  return {
    terminal,
    write,
    clear() {
      write('\x1b[2J\x1b[H');
    },
  };
}

function normalizeTerminalText(text) {
  return String(text).replace(/\r?\n/g, '\r\n');
}

function createRunSession(runKey, label) {
  const controller = new AbortController();
  const session = {
    runKey,
    label,
    signal: controller.signal,
    onStop: null,
    abort() {
      if (!controller.signal.aborted) controller.abort();
    },
    stop() {
      this.abort();
      if (typeof this.onStop === 'function') this.onStop();
    },
  };

  activeRunKeys.add(runKey);
  activeRunSessions.set(runKey, session);
  updateRunContext();
  return session;
}

function finishRunSession(session) {
  if (activeRunSessions.get(session.runKey) === session) {
    activeRunSessions.delete(session.runKey);
  }
  activeRunKeys.delete(session.runKey);
  updateRunContext();
}

function updateRunContext() {
  vscode.commands.executeCommand('setContext', 'idyllium.hasActiveRun', activeRunSessions.size > 0);
}

function stopActiveRuns() {
  const sessions = [...activeRunSessions.values()];
  if (sessions.length === 0) {
    vscode.window.showInformationMessage('Нет запущенных программ Idyllium.');
    return;
  }

  for (const session of sessions) {
    session.stop();
  }
}

function isProgramStoppedError(value) {
  const text = value instanceof Error ? value.message : String(value || '');
  return text.includes('program was stopped');
}

async function runCurrentFile(core, target) {
  if (!core) {
    vscode.window.showErrorMessage('Idyllium core was not found. Run npm run build:vscode.');
    return;
  }

  const document = await resolveRunDocument(target);
  if (!document || !isIdylliumDocument(document)) {
    vscode.window.showWarningMessage('Open an Idyllium .idyl file before running.');
    return;
  }

  const runFile = document.uri.scheme === 'file'
    ? normalizeFile(document.uri.fsPath)
    : 'untitled.idyl';
  const runKey = `cli:${runFile}`;
  if (activeRunKeys.has(runKey)) {
    vscode.window.showInformationMessage('Idyllium is already running this file.');
    return;
  }
  const session = createRunSession(runKey, `CLI ${runFile}`);

  const files = collectOpenIdylliumDocuments();
  files.set(runFile, document.getText());

  const runTerminal = createIdylliumRunTerminal('Idyllium');
  runTerminal.terminal.show(true);
  runTerminal.clear();
  runTerminal.write(`Running ${runFile}\n\n`);

  let stopNoticeWritten = false;
  const writeStopNotice = () => {
    if (stopNoticeWritten) return;
    stopNoticeWritten = true;
    runTerminal.write('\nПриложение остановлено пользователем.\n');
  };
  session.onStop = writeStopNotice;

  try {
    const result = await executeIdylliumInExtension(core, runFile, files, document, {
      abortSignal: session.signal,
      console: {
        write(text) {
          runTerminal.write(String(text));
        },
        clear() {
          runTerminal.clear();
        },
        async readLine() {
          if (session.signal.aborted) throw new Error('program was stopped');
          const value = await vscode.window.showInputBox({ prompt: 'Idyllium console input' });
          if (session.signal.aborted) throw new Error('program was stopped');
          const line = value ?? '';
          runTerminal.write(`${line}\n`);
          return line;
        },
      },
    });

    if (!result.success) {
      if (session.signal.aborted || isProgramStoppedError(result.runtimeError)) {
        writeStopNotice();
        return;
      }
      const errorText = [result.diagnosticsText, result.runtimeError].filter(Boolean).join('\n');
      if (errorText) runTerminal.write(`${errorText}\n`);
      const appliedDiagnostics = applyCliDiagnostics(errorText, document);
      if (!appliedDiagnostics) scheduleDiagnosticsRefresh(core, 0);
      vscode.window.showErrorMessage('Idyllium program failed. See the Idyllium terminal.');
      return;
    }

    runTerminal.write('\nIdyllium program finished successfully.\n');
    scheduleDiagnosticsRefresh(core, 0);
  } finally {
    finishRunSession(session);
  }
}

async function runCurrentFileWithGui(core, target, context) {
  if (!core) {
    vscode.window.showErrorMessage('Idyllium core was not found. Run npm run build:vscode.');
    return;
  }

  const document = await resolveRunDocument(target);
  if (!document || !isIdylliumDocument(document)) {
    vscode.window.showWarningMessage('Open an Idyllium .idyl file before running with GUI.');
    return;
  }

  const runFile = document.uri.scheme === 'file'
    ? normalizeFile(document.uri.fsPath)
    : 'untitled.idyl';
  const runKey = `gui:${runFile}`;
  if (activeRunKeys.has(runKey)) {
    vscode.window.showInformationMessage('Idyllium GUI is already running this file.');
    return;
  }
  const session = createRunSession(runKey, `GUI ${runFile}`);

  const files = collectOpenIdylliumDocuments();
  files.set(runFile, document.getText());

  outputChannel.clear();
  outputChannel.appendLine(`Running GUI ${runFile}`);
  outputChannel.appendLine('');
  outputChannel.show(true);

  let keepSessionAlive = false;
  try {
    const result = await executeIdylliumInExtension(core, runFile, files, document, {
      abortSignal: session.signal,
    });
    if (!result.success) {
      if (session.signal.aborted || isProgramStoppedError(result.runtimeError)) {
        outputChannel.appendLine('Приложение остановлено пользователем.');
        return;
      }
      if (result.diagnosticsText) outputChannel.appendLine(result.diagnosticsText);
      if (result.runtimeError) outputChannel.appendLine(result.runtimeError);
      const appliedDiagnostics = applyCliDiagnostics([result.diagnosticsText, result.runtimeError].filter(Boolean).join('\n'), document);
      if (!appliedDiagnostics) scheduleDiagnosticsRefresh(core, 0);
      outputChannel.show(true);
      vscode.window.showErrorMessage('Idyllium GUI program failed. See the Idyllium output channel.');
      return;
    }

    if (result.output) {
      outputChannel.append(result.output);
      outputChannel.appendLine('');
    }
    outputChannel.appendLine('Idyllium GUI program finished successfully.');
    scheduleDiagnosticsRefresh(core, 0);

    const panel = vscode.window.createWebviewPanel(
      'idylliumGui',
      `Idyllium GUI: ${path.basename(runFile)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: guiLocalResourceRoots(document, context, result.windows, result.canvases, result.audio),
      }
    );

    panel.webview.html = guiWebviewHtml(panel.webview, result.windows, result.canvases, result.modals, result.output, result.audio);
    let stopNoticeWritten = false;
    session.onStop = () => {
      if (!stopNoticeWritten) {
        stopNoticeWritten = true;
        outputChannel.appendLine('Приложение остановлено пользователем.');
      }
      panel.dispose();
    };
    attachGuiSession(panel, result, outputChannel, session);
    keepSessionAlive = true;
  } finally {
    if (!keepSessionAlive) finishRunSession(session);
  }
}

function attachGuiSession(panel, result, channel, session) {
  const runtime = result.runtime;
  if (!runtime) return;

  let disposed = false;
  let busy = false;
  const pendingGuiEvents = [];
  let lastTick = Date.now();
  let lastSnapshotJson = '';
  let lastChannelOutput = runtime.getOutput ? runtime.getOutput() : (result.output || '');

  const syncChannelOutput = () => {
    if (!runtime.getOutput) return;
    const current = runtime.getOutput();
    if (current === lastChannelOutput) return;

    if (current.startsWith(lastChannelOutput)) {
      const delta = current.slice(lastChannelOutput.length);
      if (delta) channel.append(delta);
    } else {
      channel.appendLine('');
      channel.appendLine('[Idyllium console output changed]');
      if (current) channel.append(current);
    }

    lastChannelOutput = current;
  };

  const sendSnapshot = () => {
    if (disposed) return;
    syncChannelOutput();
    const state = guiWebviewState(
      panel.webview,
      runtime.getWindows ? runtime.getWindows() : [],
      runtime.getCanvases ? runtime.getCanvases() : [],
      runtime.getModals ? runtime.getModals() : [],
      '',
      runtime.getAudio ? runtime.getAudio() : []
    );
    const snapshotJson = JSON.stringify(state);
    if (snapshotJson === lastSnapshotJson) return;
    lastSnapshotJson = snapshotJson;
    panel.webview.postMessage({
      type: 'snapshot',
      audio: state.audio,
      windows: state.windows,
      canvases: state.canvases,
      modals: state.modals,
    });
  };

  const runRuntimeAction = async (action, pumpSnapshots = true) => {
    if (busy || disposed) return;
    busy = true;
    try {
      if (session?.signal.aborted) {
        panel.dispose();
        return;
      }
      if (pumpSnapshots) {
        await runActionWithSnapshotPump(action, sendSnapshot);
      } else {
        await action();
      }
    } catch (error) {
      if (session?.signal.aborted || isProgramStoppedError(error)) {
        panel.dispose();
        return;
      }
      channel.appendLine(error instanceof Error ? error.message : String(error));
      vscode.window.showErrorMessage('Idyllium GUI event failed. See the Idyllium output channel.');
    } finally {
      busy = false;
      if (pendingGuiEvents.length > 0) void drainGuiEvents();
    }
  };

  const enqueueGuiEvent = (message) => {
    pendingGuiEvents.push(message);
    void drainGuiEvents();
  };

  const drainGuiEvents = async () => {
    if (busy || disposed) return;
    const message = pendingGuiEvents.shift();
    if (!message) return;
    await runRuntimeAction(async () => {
      if (runtime.dispatchGuiEvent) {
        await runtime.dispatchGuiEvent(Number(message.objectId ?? message.canvasId), String(message.eventName), message.payload ?? {});
      }
    });
    void drainGuiEvents();
  };

  panel.webview.onDidReceiveMessage((message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'closeApp') {
      panel.dispose();
      return;
    }
    if (message.type === 'guiEvent') {
      enqueueGuiEvent(message);
    }
  });

  const intervalMs = guiPreviewIntervalMs(result.windows, result.canvases);
  const timer = setInterval(() => {
    if (session?.signal.aborted) {
      panel.dispose();
      return;
    }
    const now = Date.now();
    const delta = Math.max(0, (now - lastTick) / 1000);
    lastTick = now;
    runRuntimeAction(async () => {
      if (!runtime.stepGui) return;
      const changed = await runtime.stepGui(delta);
      if (changed !== false) sendSnapshot();
    }, false);
  }, intervalMs);

  panel.onDidDispose(() => {
    disposed = true;
    clearInterval(timer);
    if (session) {
      session.abort();
      finishRunSession(session);
    }
  });
}

function guiPreviewIntervalMs(windows, canvases) {
  return guiRenderer.guiPreviewIntervalMs(windows, canvases);
}

async function runActionWithSnapshotPump(action, sendSnapshot) {
  let finished = false;
  let failure = null;
  const actionPromise = Promise.resolve()
    .then(action)
    .catch((error) => {
      failure = error;
    })
    .finally(() => {
      finished = true;
    });

  while (!finished) {
    await Promise.race([actionPromise, waitForSnapshotPump()]);
    sendSnapshot();
  }

  if (failure) throw failure;
}

function waitForSnapshotPump() {
  return new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
}

function guiLocalResourceRoots(document, context, windows, canvases, audio = []) {
  const roots = [];
  const addRoot = (uri) => {
    if (!uri) return;
    const key = uri.toString();
    if (!roots.some((item) => item.toString() === key)) roots.push(uri);
  };

  addRoot(context.extensionUri);
  addRoot(vscode.Uri.file(guiRenderer.rendererRootDir));
  if (document.uri.scheme === 'file') {
    addRoot(vscode.Uri.file(path.dirname(document.uri.fsPath)));
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (folder) addRoot(folder.uri);
  }

  for (const filePath of guiAssetPaths(windows, canvases, audio)) {
    addRoot(vscode.Uri.file(path.dirname(filePath)));
  }

  return roots;
}

function guiAssetPaths(windows, canvases, audio = []) {
  return guiRenderer.collectGuiAssetPaths(windows, canvases, audio);
}

function guiWebviewState(webview, windows, canvases, modals, output, audio = []) {
  return guiRenderer.buildGuiState({
    toResourceUri(filePath) {
      return webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
    },
  }, windows, canvases, modals, output, audio);
}

async function executeIdylliumInExtension(core, runFile, files, document, options = {}) {
  const sources = {};
  for (const [file, source] of files) {
    sources[file] = source;
  }

  const source = files.get(runFile) ?? '';
  const compilation = core.compileIdyllium(source, {
    file: runFile,
    sources,
    resolveModule(moduleName, fromFile) {
      const candidate = normalizeFile(path.join(path.dirname(fromFile), `${moduleName}.idyl`));
      const moduleSource = files.get(candidate);
      if (moduleSource !== undefined) return { file: candidate, source: moduleSource };
      if (fs.existsSync(candidate)) return { file: candidate, source: fs.readFileSync(candidate, 'utf8') };
      return null;
    },
  });

  if (!compilation.success || !compilation.jsCode) {
    return {
      success: false,
      output: '',
      diagnosticsText: compilation.diagnosticsText,
      runtimeError: null,
      audio: [],
      windows: [],
      canvases: [],
      modals: [],
      runtime: null,
    };
  }

  let output = '';
  const runtime = core.createRuntime({
    projectRoot: path.dirname(runFile),
    abortSignal: options.abortSignal,
    console: options.console ?? {
      write(text) {
        output += String(text);
      },
      clear() {
        output = '';
      },
      async readLine() {
        if (options.abortSignal?.aborted) throw new Error('program was stopped');
        const value = await vscode.window.showInputBox({ prompt: 'Idyllium console input' });
        if (options.abortSignal?.aborted) throw new Error('program was stopped');
        const line = value ?? '';
        output += `${line}\n`;
        return line;
      },
    },
  });

  try {
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const factory = new AsyncFunction(compilation.jsCode);
    const program = await factory();
    await program(runtime);
    return {
      success: true,
      output: runtime.getOutput ? runtime.getOutput() : output,
      diagnosticsText: compilation.diagnosticsText,
      runtimeError: null,
      windows: runtime.getWindows ? runtime.getWindows() : [],
      canvases: runtime.getCanvases ? runtime.getCanvases() : [],
      audio: runtime.getAudio ? runtime.getAudio() : [],
      modals: runtime.getModals ? runtime.getModals() : [],
      runtime,
    };
  } catch (error) {
    return {
      success: false,
      output: runtime.getOutput ? runtime.getOutput() : output,
      diagnosticsText: compilation.diagnosticsText,
      runtimeError: error instanceof Error ? error.message : String(error),
      windows: runtime.getWindows ? runtime.getWindows() : [],
      canvases: runtime.getCanvases ? runtime.getCanvases() : [],
      audio: runtime.getAudio ? runtime.getAudio() : [],
      modals: runtime.getModals ? runtime.getModals() : [],
      runtime,
    };
  }
}

async function resolveRunDocument(target) {
  if (target && typeof target.fsPath === 'string') {
    const normalized = normalizeFile(target.fsPath);
    const openDocument = vscode.workspace.textDocuments.find((document) => (
      document.uri.scheme === 'file' && normalizeFile(document.uri.fsPath) === normalized
    ));
    if (openDocument) return openDocument;
    return vscode.workspace.openTextDocument(target);
  }

  return vscode.window.activeTextEditor?.document ?? null;
}

function mainRunCodeLenses(document) {
  const lenses = [];
  const mainPattern = /^[ \t]*main[ \t]*\([ \t]*\)[ \t]*(?:\{|$)/gmu;
  const source = document.getText();
  let match = mainPattern.exec(source);

  while (match) {
    const position = document.positionAt(match.index);
    const range = new vscode.Range(position, position);
    lenses.push(new vscode.CodeLens(range, {
      title: '$(play) Run Idyllium',
      command: 'idyllium.runCurrentFile',
      arguments: [document.uri],
    }));
    lenses.push(new vscode.CodeLens(range, {
      title: '$(preview) Run GUI',
      command: 'idyllium.runCurrentFileWithGui',
      arguments: [document.uri],
    }));
    match = mainPattern.exec(source);
  }

  return lenses;
}

function guiWebviewHtml(webview, windows, canvases, modals, output, audio = []) {
  const nonce = webviewNonce();
  return guiRenderer.renderGuiWebviewHtml({
    cspSource: webview.cspSource,
    cssUri: webview.asWebviewUri(vscode.Uri.file(guiRenderer.rendererAssetPaths().css)).toString(),
    nonce,
    scriptUri: webview.asWebviewUri(vscode.Uri.file(guiRenderer.rendererAssetPaths().script)).toString(),
    state: guiWebviewState(webview, windows, canvases, modals, output, audio),
  });
}
function webviewNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 32; i++) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

function fullDocumentRange(document) {
  const lastLine = Math.max(0, document.lineCount - 1);
  const lastCharacter = document.lineCount === 0 ? 0 : document.lineAt(lastLine).text.length;
  return new vscode.Range(0, 0, lastLine, lastCharacter);
}

function applyCliDiagnostics(text, document) {
  const byFile = parseCliDiagnostics(text, document);
  if (byFile.size === 0) return false;

  diagnosticCollection.clear();
  for (const [file, diagnostics] of byFile) {
    diagnosticCollection.set(vscode.Uri.file(file), diagnostics);
  }

  return true;
}

function parseCliDiagnostics(text, document) {
  const byFile = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;

    const compileMatch = /^(.+):(\d+):(\d+):\s+(error|warning|info)(?:\s+\S+)?:\s+(.+)$/u.exec(line);
    if (compileMatch) {
      const [, rawFile, rawLineNumber, rawColumn, severity, message] = compileMatch;
      addCliDiagnostic(byFile, document, rawFile, Number(rawLineNumber), Number(rawColumn), severity, message, 'Idyllium');
      continue;
    }

    const runtimeMatch = /^(.+):(\d+):\s+runtime error:\s+(.+)$/u.exec(line);
    if (runtimeMatch) {
      const [, rawFile, rawLineNumber, message] = runtimeMatch;
      addCliDiagnostic(byFile, document, rawFile, Number(rawLineNumber), null, 'error', `runtime error: ${message}`, 'Idyllium runtime');
    }
  }
  return byFile;
}

function addCliDiagnostic(byFile, document, rawFile, lineNumber, columnNumber, severity, message, source) {
  const file = normalizeCliDiagnosticFile(rawFile, document);
  const items = byFile.get(file) ?? [];
  const diagnostic = new vscode.Diagnostic(
    rangeForCliDiagnostic(file, lineNumber, columnNumber),
    message,
    toVsDiagnosticSeverity(severity)
  );
  diagnostic.source = source;
  items.push(diagnostic);
  byFile.set(file, items);
}

function normalizeCliDiagnosticFile(file, document) {
  const normalized = normalizeFile(file);
  if (path.isAbsolute(normalized)) return normalized;
  return normalizeFile(path.resolve(workspaceCwd(document), normalized));
}

function rangeForCliDiagnostic(file, lineNumber, columnNumber) {
  const line = Math.max(0, lineNumber - 1);
  const document = vscode.workspace.textDocuments.find((item) => (
    item.uri.scheme === 'file' && normalizeFile(item.uri.fsPath) === file
  ));

  if (columnNumber !== null) {
    const column = Math.max(0, columnNumber - 1);
    return new vscode.Range(line, column, line, column + 1);
  }

  const lineText = document && line < document.lineCount ? document.lineAt(line).text : '';
  return new vscode.Range(line, 0, line, Math.max(1, lineText.length));
}

function workspaceCwd(document) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (folder) return folder.uri.fsPath;
  if (document.uri.scheme === 'file') return path.dirname(document.uri.fsPath);
  return process.cwd();
}

function scheduleDiagnosticsRefresh(core, delay = 250) {
  if (!core) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshDiagnostics(core).catch((error) => {
      outputChannel.appendLine(`Diagnostic refresh failed: ${formatError(error)}`);
    });
  }, delay);
}

async function refreshDiagnostics(core) {
  const files = await collectProjectFiles();
  diagnosticCollection.clear();
  if (files.size === 0) return;

  const entryFiles = diagnosticEntryFiles(files);
  if (entryFiles.length === 0) return;

  const byFile = new Map();

  for (const entryFile of entryFiles) {
    const project = new core.IdylliumProject({ entryFile, files });
    for (const diagnostic of project.diagnostics()) {
      const file = normalizeFile(diagnostic.range.start.file);
      const items = byFile.get(file) ?? [];
      items.push(toVsDiagnostic(diagnostic));
      byFile.set(file, items);
    }
  }

  for (const [file, diagnostics] of byFile) {
    if (diagnostics.length > 0) {
      diagnosticCollection.set(vscode.Uri.file(file), diagnostics);
    }
  }
}

async function createProject(core, preferredEntryFile) {
  const files = await collectProjectFiles();
  const normalizedPreferred = normalizeFile(preferredEntryFile);
  const entryFile = pickEntryFile(files, normalizedPreferred) ?? normalizedPreferred;
  return new core.IdylliumProject({ entryFile, files });
}

async function collectProjectFiles() {
  const files = new Map();
  const uris = await vscode.workspace.findFiles('**/*.idyl', '**/{node_modules,dist,.git,out}/**');

  for (const uri of uris) {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      files.set(normalizeFile(uri.fsPath), Buffer.from(bytes).toString('utf8'));
    } catch (error) {
      outputChannel.appendLine(`Failed to read ${uri.fsPath}: ${formatError(error)}`);
    }
  }

  for (const document of vscode.workspace.textDocuments) {
    if (!isIdylliumDocument(document) || document.uri.scheme !== 'file') continue;
    files.set(normalizeFile(document.uri.fsPath), document.getText());
  }

  return files;
}

function collectOpenIdylliumDocuments() {
  const files = new Map();
  for (const document of vscode.workspace.textDocuments) {
    if (!isIdylliumDocument(document) || document.uri.scheme !== 'file') continue;
    files.set(normalizeFile(document.uri.fsPath), document.getText());
  }
  return files;
}

function diagnosticEntryFiles(files) {
  const entries = [];
  const activeDocument = vscode.window.activeTextEditor?.document ?? null;
  if (activeDocument && isIdylliumDocument(activeDocument) && activeDocument.uri.scheme === 'file') {
    const file = normalizeFile(activeDocument.uri.fsPath);
    if (files.has(file)) entries.push(file);
  }

  for (const document of vscode.workspace.textDocuments) {
    if (!isIdylliumDocument(document) || document.uri.scheme !== 'file') continue;
    const file = normalizeFile(document.uri.fsPath);
    if (files.has(file) && !entries.includes(file)) entries.push(file);
  }

  if (entries.length > 0) return entries;

  const fallback = pickEntryFile(files);
  return fallback ? [fallback] : [];
}

function pickEntryFile(files, preferredFile) {
  if (preferredFile && files.has(preferredFile)) return preferredFile;

  for (const file of files.keys()) {
    if (path.basename(file).toLowerCase() === 'main.idyl') return file;
  }

  return files.keys().next().value ?? null;
}

function toVsDiagnostic(diagnostic) {
  const startLine = Math.max(0, diagnostic.range.start.line - 1);
  const startColumn = Math.max(0, diagnostic.range.start.column - 1);
  const endLine = Math.max(startLine, diagnostic.range.end.line - 1);
  let endColumn = Math.max(0, diagnostic.range.end.column - 1);
  if (endLine === startLine && endColumn <= startColumn) {
    endColumn = startColumn + 1;
  }

  const item = new vscode.Diagnostic(
    new vscode.Range(startLine, startColumn, endLine, endColumn),
    diagnostic.message,
    toVsDiagnosticSeverity(diagnostic.severity)
  );
  item.source = 'Idyllium';
  if (diagnostic.code) item.code = diagnostic.code;
  return item;
}

function toVsDiagnosticSeverity(severity) {
  switch (severity) {
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Error;
  }
}

function toVsCompletionItem(item) {
  const completion = new vscode.CompletionItem(item.name, toVsCompletionKind(item.kind));
  completion.detail = item.detail;
  return completion;
}

function toVsCompletionKind(kind) {
  switch (kind) {
    case 'module':
      return vscode.CompletionItemKind.Module;
    case 'function':
      return vscode.CompletionItemKind.Function;
    case 'constant':
      return vscode.CompletionItemKind.Constant;
    case 'type':
      return vscode.CompletionItemKind.Class;
    case 'property':
      return vscode.CompletionItemKind.Property;
    case 'method':
      return vscode.CompletionItemKind.Method;
    case 'parameter':
      return vscode.CompletionItemKind.Variable;
    default:
      return vscode.CompletionItemKind.Text;
  }
}

function toVsSignatureHelp(help) {
  const result = new vscode.SignatureHelp();
  result.activeSignature = help.activeSignature;
  result.activeParameter = help.activeParameter;
  result.signatures = help.signatures.map((signature) => {
    const item = new vscode.SignatureInformation(signature.label, signature.documentation);
    item.parameters = signature.parameters.map((parameter) => (
      new vscode.ParameterInformation(parameter.label, parameter.documentation)
    ));
    return item;
  });
  return result;
}

function toVsDocumentSymbol(symbol) {
  return new vscode.DocumentSymbol(
    symbol.name,
    symbol.detail,
    toVsSymbolKind(symbol.kind),
    toVsRange(symbol.range),
    toVsRange(symbol.range)
  );
}

function toVsSymbolKind(kind) {
  switch (kind) {
    case 'class':
      return vscode.SymbolKind.Class;
    case 'constructor':
      return vscode.SymbolKind.Constructor;
    case 'field':
      return vscode.SymbolKind.Field;
    case 'function':
      return vscode.SymbolKind.Function;
    case 'method':
      return vscode.SymbolKind.Method;
    case 'variable':
      return vscode.SymbolKind.Variable;
    case 'constant':
      return vscode.SymbolKind.Constant;
    default:
      return vscode.SymbolKind.Object;
  }
}

function toVsRange(range) {
  const startLine = Math.max(0, range.start.line - 1);
  const startColumn = Math.max(0, range.start.column - 1);
  const endLine = Math.max(startLine, range.end.line - 1);
  const endColumn = Math.max(0, range.end.column - 1);
  return new vscode.Range(startLine, startColumn, endLine, endColumn);
}

function isIdylliumDocument(document) {
  return document.languageId === 'idyllium' || document.uri.fsPath.endsWith('.idyl');
}

function normalizeFile(file) {
  return path.normalize(file);
}

function formatError(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

module.exports = {
  activate,
  deactivate,
};
