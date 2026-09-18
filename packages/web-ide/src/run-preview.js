// Запуск программ и GUI-превью: подготовка браузерной программы, насос
// снапшотов, цикл кадров, консольный ввод, репетиция web-сервера,
// файлы проекта для рантайма и связь с iframe предпросмотра.

import { WORKSPACE_ROOT, MAIN_FILE, normalizeWorkspacePath, shortFileName, formatThrownError, formatDiagnosticText } from './workspace-paths.js';
import { files } from './project-store.js';
import { viewerHost } from './viewer-host.js';
import { clamp } from './num-util.js';
import { assetBytes, bytesToDataUrl, detectAssetMimeType } from './binary-format.js';
import { consoleInput, consoleInputPanel, csvViewer, jsonViewer, guiFrame, output, runButton, stopButton } from './dom.js';
import { renderCsvTable, renderJsonTree, structuredViewModes, isCsvFile, isJsonFile } from './viewer-structured.js';
import { showAssetViewer, invalidateAssetPreview } from './viewer-assets.js';
import { setOutputText, appendOutput, appendRuntimeWarnings, appendExitLine, setStatus } from './console-output.js';

// Узкий шов «запуск → ядро»: редактор, дерево и автосохранение живут в
// оркестраторе; ядро регистрирует их при старте (жанр viewerHost).
export const runHost = {
  saveCurrentEditor: () => {},
  hideCompletions: () => {},
  getEditorValue: () => '',
  setEditorValue: (_value, _file) => {},
  isEditorReadOnly: () => false,
  updateEditorVisuals: () => {},
  editorReady: () => false,
  scheduleAutosave: () => {},
  renderFiles: () => {},
  addProjectFolder: (_path) => {},
  setProjectFile: (_path, _item) => {},
  removeProjectItem: (_path, _type) => {},
  fallbackFilePath: () => MAIN_FILE,
  resetToFallbackFile: () => {},
  applyPreviewTheme: () => {},
  folders: null,
};

export function registerRunHost(host) {
  Object.assign(runHost, host);
}

export let currentRuntime = null;

export let guiTimer = null;

export let lastTick = Date.now();

export let guiBusy = false;

export const pendingGuiEvents = [];

export let guiFrameReady = false;

export let pendingSnapshot = null;

export let runAbortController = null;

export let programRunning = false;

export let currentRuntimeFileSnapshot = null;

export let outputSyncTimer = null;

export let runSequence = 0;

export let previewGeneration = 0;

export let pendingConsoleInput = null;

export let consoleInputEchoes = [];

export let lastSnapshotJson = '';

export let lastRenderedRuntimeOutput = null;

// Превью — same-origin iframe: адресуем сообщения только своему origin
// ('null' остаётся для экзотических хостингов без origin).
export const previewTargetOrigin = window.location.origin && window.location.origin !== 'null'
  ? window.location.origin
  : '*';

// Хвосты холстов (1.6.2): рендерер хранит картинку между кадрами, поэтому рантайм
// отдаёт ему только новые команды. Учёт «что уже показано» — в общем ядре.
let canvasTails = null;
function canvasTailTracker() {
  if (!canvasTails) canvasTails = window.Idyllium.createCanvasTailTracker();
  return canvasTails;
}

/** Рендерер потерял картинку холста (или она ему ещё не знакома): следующий снимок — с полным списком. */
export function resyncCanvases(canvasIds) {
  if (canvasTails) canvasTails.forget(Array.isArray(canvasIds) ? canvasIds.map(Number) : undefined);
  lastSnapshotJson = '';
  if (currentRuntime) sendRuntimeSnapshot();
}

export function markGuiFrameReady() {
  guiFrameReady = true;
  lastSnapshotJson = '';
  runHost.applyPreviewTheme();
  // Кадр предпросмотра только что родился и не знает ни одного холста: отложенный снимок
  // мог быть хвостом — шлём свежий, с полными списками.
  if (canvasTails) canvasTails.forget();
  if (currentRuntime) sendRuntimeSnapshot();
  else if (pendingSnapshot) postSnapshot(pendingSnapshot);
}

export const rehearsalServers = new Map(); // порт → handler рантайма
export let rehearsalWorkerPromise = null;

export function ensureRehearsalWorker() {
  if (!rehearsalWorkerPromise) {
    rehearsalWorkerPromise = (async () => {
      if (!('serviceWorker' in navigator)) return null;
      // Версия в query — стандартное версионирование SW: смена версии сайта
      // гарантирует свежий воркер даже сквозь кэш GitHub Pages.
      const siteVersion = await fetch('version.json')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => (data && data.version ? String(data.version) : ''))
        .catch(() => '');
      const registration = await navigator.serviceWorker.register(siteVersion ? `sw-preview.js?v=${siteVersion}` : 'sw-preview.js');
      await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) return null;
      const ack = await new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), 3000);
        channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
        worker.postMessage({ type: 'idyllium-host-register' }, [channel.port2]);
      });
      return ack && ack.ok ? registration : null;
    })().catch(() => null);
  }
  return rehearsalWorkerPromise;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    const replyPort = event.ports[0];
    if (!replyPort) return;
    if (data.type === 'idyllium-host-query') {
      replyPort.postMessage({ host: rehearsalServers.size > 0 });
      return;
    }
    if (data.type === 'idyllium-preview-request') {
      const handler = rehearsalServers.get(data.port);
      if (!handler) {
        replyPort.postMessage({ error: 'no-server' });
        return;
      }
      Promise.resolve(handler(data.request)).then(
        (response) => replyPort.postMessage({ response }),
        (error) => replyPort.postMessage({
          response: {
            status: 500,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
            body: String((error && error.message) || error),
          },
        }),
      );
    }
  });
}

// отладочная форточка для приёмки (безвредна: только чтение портов)
window.__rehearsalPorts = () => [...rehearsalServers.keys()];

export async function browserNetworkListen(options, handler) {
  const registration = await ensureRehearsalWorker();
  if (!registration) {
    throw new Error('the rehearsal server needs a Service Worker, and this browser window does not allow it — run the program in VS Code or the console host');
  }
  let port = options.port;
  if (port === 0) {
    port = 8080;
    while (rehearsalServers.has(port)) port += 1;
  }
  if (rehearsalServers.has(port)) {
    const busy = new Error(`port ${port} is already in use`);
    busy.code = 'EADDRINUSE';
    throw busy;
  }
  rehearsalServers.set(port, handler);
  const scopePath = new URL(registration.scope).pathname;
  const address = `${location.origin}${scopePath}preview/${port}/`;
  return {
    port,
    announce: `Сервер-репетиция запущена: ${address} — сайт видит только этот браузер; настоящий сервер программа поднимет в VS Code или консоли`,
    close() {
      rehearsalServers.delete(port);
    },
  };
}

export async function runProgram() {
  // Запускается файл, открытый в редакторе (вердикт владельца 2026-08-29;
  // так же ведёт себя расширение VS Code). Для не-программ кнопка серая
  // (updateRunButton); этот отказ — страховка на обходные пути запуска,
  // работающую программу он не прерывает.
  if (!runnableFileIsOpen()) {
    setStatus(`«${shortFileName(viewerHost.currentFile())}» — не программа: запускается открытый файл .idyl`, true);
    return;
  }
  stopProgram(true);
  const runId = ++runSequence;
  previewGeneration++;
  if (canvasTails) canvasTails.forget();
  runHost.saveCurrentEditor();
  runHost.hideCompletions();
  output.textContent = '';
  consoleInputEchoes = [];
  lastRenderedRuntimeOutput = '';
  lastSnapshotJson = '';
  const controller = new AbortController();
  runAbortController = controller;
  setRunControls(true);
  setStatus('Запуск...');
  postEmptySnapshot();

  try {
    const prepared = await window.Idyllium.prepareIdylliumBrowserProgram({
      entryFile: viewerHost.currentFile(),
      files: browserFiles(),
      abortSignal: controller.signal,
      networkListen: browserNetworkListen,
      console: {
        clear() {
          consoleInputEchoes = [];
          output.replaceChildren();
          lastRenderedRuntimeOutput = '';
        },
        async readLine() {
          return requestConsoleInput(controller.signal);
        },
      },
    });
    if (runId !== runSequence) return;

    if (!prepared.compilation.success || !prepared.runtime) {
      setOutputText(formatDiagnosticText(prepared.compilation.diagnosticsText), 'output-error');
      setStatus('Ошибка компиляции', true);
      runAbortController = null;
      currentRuntimeFileSnapshot = null;
      setRunControls(false);
      return;
    }

    // Файл-модуль без main() раньше «успешно выполнялся» в тишину —
    // честнее сказать словами, с чего начинается программа.
    if (!prepared.compilation.ast?.main) {
      setOutputText(`В файле «${shortFileName(viewerHost.currentFile())}» нет функции main() — запускать нечего.`, 'output-error');
      setStatus('Нет main()', true);
      runAbortController = null;
      currentRuntimeFileSnapshot = null;
      setRunControls(false);
      return;
    }

    currentRuntime = prepared.runtime;
    currentRuntimeFileSnapshot = prepared.writtenFilesSnapshot;
    startOutputSync();
    // system.exit() — не авария: программа сама попросила закончить.
    let exitedEarly = false;
    await runRuntimeActionWithSnapshotPump(async () => {
      try {
        await prepared.run();
      } catch (error) {
        if (error?.kind !== 'exit') throw error;
        exitedEarly = true;
      }
    });
    if (runId !== runSequence) return;
    syncRuntimeFilesFromSnapshot();
    syncRuntimeOutput();
    sendRuntimeSnapshot();
    if (runtimeHasGui(currentRuntime) && !exitedEarly) {
      startGuiLoop();
      setRunControls(false, true);
    } else {
      stopOutputSync();
      postEmptySnapshot();
      if (!output.textContent) output.textContent = 'Программа Idyllium успешно завершилась.';
      appendRuntimeWarnings(currentRuntime);
      await appendExitLine(currentRuntime);
      runAbortController = null;
      setRunControls(false);
    }
    setStatus('Готово');
  } catch (error) {
    if (runId !== runSequence) return;
    syncRuntimeOutput();
    syncRuntimeFilesFromSnapshot();
    stopOutputSync();
    const wasStopped = controller.signal.aborted;
    appendOutput(formatThrownError(error), wasStopped ? 'output-soft-error' : 'output-error');
    setStatus(wasStopped ? 'Остановлено' : 'Ошибка запуска', !wasStopped);
    currentRuntime = null;
    currentRuntimeFileSnapshot = null;
    postEmptySnapshot();
  }
  if (!runtimeHasGui(currentRuntime)) {
    runAbortController = null;
    currentRuntimeFileSnapshot = null;
    setRunControls(false);
  }
}

export function stopProgram(silent = false) {
  const hadRuntime = Boolean(currentRuntime || runAbortController);
  if (hadRuntime) {
    runSequence++;
    previewGeneration++;
    lastSnapshotJson = '';
    if (canvasTails) canvasTails.forget();
  }
  if (runAbortController && !runAbortController.signal.aborted) runAbortController.abort();
  syncRuntimeFilesFromSnapshot();
  stopOutputSync();
  stopGuiLoop();
  pendingGuiEvents.length = 0;
  clearPendingConsoleInput();
  currentRuntime = null;
  currentRuntimeFileSnapshot = null;
  runAbortController = null;
  postEmptySnapshot();
  setRunControls(false);
  if (!silent && hadRuntime) {
    appendOutput('Приложение остановлено пользователем', 'output-soft-error');
    setStatus('Остановлено');
  }
}

// У «Запустить» два независимых выключателя: работающая программа и
// не-программа в редакторе (вердикт владельца 2026-08-29 — кнопка-пустышка
// хуже серой кнопки). «Остановить» живёт только от состояния запуска.
export function setRunControls(active, keepStopAvailable = false) {
  programRunning = active;
  stopButton.disabled = !(active || keepStopAvailable);
  updateRunButton();
}

export function runnableFileIsOpen() {
  const item = files.get(viewerHost.currentFile());
  return Boolean(item && item.kind === 'text' && viewerHost.currentFile().endsWith('.idyl'));
}

export function updateRunButton() {
  const runnable = runnableFileIsOpen();
  runButton.disabled = programRunning || !runnable;
  const title = runnable || programRunning
    ? 'Запустить: Ctrl+Enter'
    : 'Запускается открытый файл .idyl — откройте программу';
  runButton.title = title;
  runButton.setAttribute('aria-label', title);
}

export function startOutputSync() {
  stopOutputSync();
  syncRuntimeOutput();
  outputSyncTimer = window.setInterval(syncRuntimeOutput, 100);
}

export function stopOutputSync() {
  if (outputSyncTimer !== null) window.clearInterval(outputSyncTimer);
  outputSyncTimer = null;
}

export function syncRuntimeOutput() {
  if (!currentRuntime) return;
  const rendered = renderRuntimeOutput(currentRuntime.getOutput());
  if (rendered === lastRenderedRuntimeOutput) return;
  lastRenderedRuntimeOutput = rendered;
  setOutputText(rendered, '', { ansi: true });
}

export function syncRuntimeFilesFromSnapshot() {
  if (typeof currentRuntimeFileSnapshot !== 'function') return false;

  const snapshot = currentRuntimeFileSnapshot() || {};
  let changed = false;
  let currentFileChanged = false;
  let currentFileDeleted = false;

  for (const [rawPath, rawEntry] of Object.entries(snapshot)) {
    const path = normalizeWorkspacePath(rawPath);
    if (path === WORKSPACE_ROOT) continue;

    const entry = typeof rawEntry === 'string'
      ? { kind: 'file', content: rawEntry, resourceUri: '' }
      : rawEntry || {};

    if (entry.kind === 'deleted') {
      if (runHost.folders.has(path)) {
        if (viewerHost.currentFile() === path || viewerHost.currentFile().startsWith(path + '/')) currentFileDeleted = true;
        runHost.removeProjectItem(path, 'folder');
        changed = true;
      } else if (files.has(path)) {
        if (viewerHost.currentFile() === path) currentFileDeleted = true;
        runHost.removeProjectItem(path, 'file');
        changed = true;
      }
      continue;
    }

    if (entry.kind === 'directory') {
      if (!runHost.folders.has(path)) {
        runHost.addProjectFolder(path);
        changed = true;
      }
      continue;
    }

    if (entry.bytes instanceof Uint8Array) {
      const bytes = new Uint8Array(entry.bytes);
      const resourceUri = entry.resourceUri || bytesToDataUrl(path, bytes);
      const previous = files.get(path);
      const sameBytes = previous?.kind === 'asset' && equalBytes(previous.bytes, bytes);
      if (!sameBytes || previous.resourceUri !== resourceUri) {
        runHost.setProjectFile(path, { kind: 'asset', content: '', bytes, resourceUri });
        changed = true;
        if (path === viewerHost.currentFile()) currentFileChanged = true;
      }
      continue;
    }

    const content = typeof entry.content === 'string' ? entry.content : '';
    const previous = files.get(path);
    if (!previous || previous.kind !== 'text' || previous.content !== content) {
      runHost.setProjectFile(path, { kind: 'text', content });
      changed = true;
      if (path === viewerHost.currentFile()) currentFileChanged = true;
    }
  }

  if (!changed) return false;

  if (currentFileDeleted || !files.has(viewerHost.currentFile())) {
    if (files.size === 0) runHost.setProjectFile(MAIN_FILE, { kind: 'text', content: '' });
    runHost.resetToFallbackFile();
  } else if (currentFileChanged) {
    const item = files.get(viewerHost.currentFile());
    if (item && item.kind === 'text') {
      runHost.setEditorValue(item.content || '', viewerHost.currentFile());
      runHost.updateEditorVisuals();
      if (isCsvFile(viewerHost.currentFile()) && structuredViewModes.get(viewerHost.currentFile()) === 'table') {
        csvViewer.replaceChildren();
        renderCsvTable(viewerHost.currentFile(), item.content || '');
      } else if (isJsonFile(viewerHost.currentFile()) && structuredViewModes.get(viewerHost.currentFile()) === 'tree') {
        jsonViewer.replaceChildren();
        renderJsonTree(viewerHost.currentFile(), item.content || '');
      }
    } else if (item && item.kind === 'asset') {
      showAssetViewer(viewerHost.currentFile(), item);
    }
  }

  runHost.renderFiles();
  runHost.scheduleAutosave();
  return true;
}

export function equalBytes(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function renderRuntimeOutput(runtimeOutput) {
  if (consoleInputEchoes.length === 0) return runtimeOutput;
  let rendered = '';
  let cursor = 0;
  const echoes = [...consoleInputEchoes].sort((left, right) => (
    left.offset === right.offset ? left.order - right.order : left.offset - right.offset
  ));
  for (const echo of echoes) {
    const offset = clamp(echo.offset, cursor, runtimeOutput.length);
    rendered += runtimeOutput.slice(cursor, offset) + echo.text;
    cursor = offset;
  }
  return rendered + runtimeOutput.slice(cursor);
}

export function runtimeHasGui(runtime) {
  if (runtime && typeof runtime.hasGui === 'function') return runtime.hasGui();
  return Boolean(runtime && (
    runtime.getWindows().length > 0
    || runtime.getCanvases().length > 0
    || runtime.getModals().length > 0
    || runtimeHasActiveAudio(runtime)
  ));
}

export function runtimeHasActiveAudio(runtime) {
  if (!runtime || typeof runtime.getAudio !== 'function') return false;
  return runtime.getAudio().some((item) => item && item.properties && item.properties.is_playing === true);
}

export function requestConsoleInput(signal) {
  if (signal.aborted) return Promise.reject(new Error('program was stopped'));
  if (pendingConsoleInput) {
    pendingConsoleInput.reject(new Error('program was stopped'));
    clearPendingConsoleInput();
  }

  consoleInput.value = '';
  consoleInputPanel.hidden = false;
  window.setTimeout(() => consoleInput.focus(), 0);

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new Error('program was stopped'));
      clearPendingConsoleInput();
    };
    pendingConsoleInput = {
      resolve,
      reject,
      onAbort,
      signal,
      outputOffset: currentRuntime ? currentRuntime.getOutput().length : 0,
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function submitConsoleInput() {
  if (!pendingConsoleInput) return;
  const value = consoleInput.value;
  const pending = pendingConsoleInput;
  consoleInputEchoes.push({
    offset: pending.outputOffset,
    order: consoleInputEchoes.length,
    text: value + '\n',
  });
  clearPendingConsoleInput();
  syncRuntimeOutput();
  pending.resolve(value);
}

export function clearPendingConsoleInput() {
  if (pendingConsoleInput) {
    pendingConsoleInput.signal.removeEventListener('abort', pendingConsoleInput.onAbort);
  }
  pendingConsoleInput = null;
  consoleInput.value = '';
  consoleInputPanel.hidden = true;
}

export function formatCurrentFile() {
  if (!viewerHost.currentFile().endsWith('.idyl') || runHost.isEditorReadOnly()) {
    setStatus('Форматирование доступно только для .idyl', true);
    return;
  }
  const formatted = window.Idyllium.formatIdyllium(runHost.getEditorValue());
  runHost.setEditorValue(formatted, viewerHost.currentFile());
  runHost.saveCurrentEditor();
  runHost.updateEditorVisuals();
  setStatus('Код отформатирован');
}

export function browserFiles() {
  refreshBrowserAssetUrls();
  const result = {};
  for (const folder of runHost.folders) {
    result[folder] = { kind: 'directory' };
  }
  for (const [file, item] of files) {
    result[file] = item.kind === 'asset'
      ? {
          content: item.content || '',
          bytes: item.bytes instanceof Uint8Array ? new Uint8Array(item.bytes) : undefined,
          resourceUri: browserAssetResourceUri(file, item),
        }
      : item.content;
  }
  return result;
}

export function refreshBrowserAssetUrls() {
  for (const [path, cached] of browserAssetUrls) {
    if (files.get(path) === cached.item) continue;
    URL.revokeObjectURL(cached.url);
    browserAssetUrls.delete(path);
  }
}

export function browserAssetResourceUri(path, item) {
  const cached = browserAssetUrls.get(path);
  if (cached && cached.item === item) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);

  const bytes = assetBytes(item);
  if (bytes.length === 0) return item.resourceUri || '';
  const type = detectAssetMimeType(path, bytes);
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  browserAssetUrls.set(path, { item, url });
  return url;
}

export function revokeAllBrowserAssetUrls() {
  for (const cached of browserAssetUrls.values()) URL.revokeObjectURL(cached.url);
  browserAssetUrls.clear();
}

export function textSourceMap() {
  const result = new Map();
  for (const [file, item] of files) {
    if (item.kind === 'text' && file.endsWith('.idyl')) result.set(file, item.content);
  }
  return result;
}

export async function enqueueGuiEvent(message) {
  if (!message || message.type !== 'guiEvent') return;
  pendingGuiEvents.push(message);
  await drainGuiEvents();
}

/** Ошибка ученического обработчика события: вывод — в панель ДО текста
 *  ошибки (иначе терялся хвост без \n), программа продолжает жить —
 *  как при любой мягкой ошибке события. */
export function reportGuiEventFailure(error) {
  syncRuntimeOutput();
  syncRuntimeFilesFromSnapshot();
  appendOutput(formatThrownError(error), 'output-error');
  setStatus('Ошибка события GUI', true);
}

export async function drainGuiEvents() {
  if (!currentRuntime || guiBusy) return;
  guiBusy = true;
  try {
    while (currentRuntime && pendingGuiEvents.length > 0) {
      const message = pendingGuiEvents.shift();
      await runRuntimeActionWithSnapshotPump(async () => {
        await currentRuntime.dispatchGuiEvent(Number(message.objectId), String(message.eventName), message.payload || {});
      });
    }
  } finally {
    guiBusy = false;
  }
}

export function runRuntimeActionWithSnapshotPump(action) {
  // Механика насоса живёт в ядре (src/runtime/gui-pump.ts) — одна на
  // Web IDE и расширение VS Code; здесь только «перекачка кадра» IDE.
  return window.Idyllium.runActionWithSnapshotPump(action, () => {
    syncRuntimeOutput();
    syncRuntimeFilesFromSnapshot();
    sendRuntimeSnapshot();
  });
}

export function startGuiLoop() {
  if (!currentRuntime) return;
  lastTick = Date.now();
  const intervalMs = guiLoopIntervalMs(currentRuntime);
  guiTimer = window.setInterval(async () => {
    if (!currentRuntime || guiBusy) return;
    guiBusy = true;
    try {
      const now = Date.now();
      const delta = Math.max(0, (now - lastTick) / 1000);
      lastTick = now;
      const changed = await currentRuntime.stepGui(delta);
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      if (changed) sendRuntimeSnapshot();
      if (!runtimeHasGui(currentRuntime)) {
        finishCompletedRuntime();
      }
    } catch (error) {
      // Сначала — вывод, накопленный упавшим шагом: без синка терялась
      // незавершённая console.write-строка и весь вывод шага (находка
      // методистов, 2026-09-03).
      syncRuntimeOutput();
      syncRuntimeFilesFromSnapshot();
      stopOutputSync();
      appendOutput(formatThrownError(error), 'output-error');
      setStatus('Ошибка GUI-шага', true);
      stopGuiLoop();
      currentRuntime = null;
      runAbortController = null;
      setRunControls(false);
      postEmptySnapshot();
    } finally {
      guiBusy = false;
      // Ошибка хвостового события без catch улетала бы в консоль браузера
      // unhandled rejection — панель вывода молчала бы вовсе.
      if (pendingGuiEvents.length > 0) void drainGuiEvents().catch(reportGuiEventFailure);
    }
  }, intervalMs);
}

export function stopGuiLoop() {
  if (guiTimer !== null) window.clearInterval(guiTimer);
  guiTimer = null;
}

export function finishCompletedRuntime() {
  stopOutputSync();
  stopGuiLoop();
  const finishedRuntime = currentRuntime;
  currentRuntime = null;
  currentRuntimeFileSnapshot = null;
  runAbortController = null;
  setRunControls(false);
  if (!output.textContent) output.textContent = 'Программа Idyllium успешно завершилась.';
  // Для оконной программы «завершилась» наступает только сейчас, когда
  // закрылось последнее окно, — код завершения печатается здесь.
  appendRuntimeWarnings(finishedRuntime);
  void appendExitLine(finishedRuntime);
  setStatus('Готово');
  postEmptySnapshot();
}

export function sendRuntimeSnapshot() {
  if (!currentRuntime) {
    postEmptySnapshot();
    return;
  }
  const tails = canvasTailTracker();
  const windows = currentRuntime.getWindows(tails.options());
  const canvases = windows.length > 0 ? [] : currentRuntime.getCanvases(tails.options());
  const delivered = postSnapshot({
    audio: currentRuntime.getAudio ? currentRuntime.getAudio() : [],
    windows,
    canvases,
    modals: currentRuntime.getModals(),
    output: '',
  });
  // Считаем показанным только то, что действительно ушло рендереру: недоставленный хвост
  // обязан войти в следующий снимок.
  if (delivered) tails.sent(windows, canvases);
}

export function guiLoopIntervalMs(runtime) {
  return window.Idyllium.guiPreviewIntervalMs(runtime.getWindows(), runtime.getCanvases());
}

export function postEmptySnapshot() {
  postSnapshot({ audio: [], windows: [], canvases: [], modals: [], output: '' });
}

export function postSnapshot(snapshot) {
  const fullSnapshot = {
    ...snapshot,
    generation: previewGeneration,
  };
  pendingSnapshot = fullSnapshot;
  if (!guiFrameReady || !guiFrame.contentWindow) return false;
  const snapshotJson = JSON.stringify(fullSnapshot);
  // Тот же снимок, что уже у рендерера: «доставлен» — нового в нём нет.
  if (snapshotJson === lastSnapshotJson) return true;
  lastSnapshotJson = snapshotJson;
  guiFrame.contentWindow.postMessage({
    type: 'snapshot',
    generation: fullSnapshot.generation,
    audio: fullSnapshot.audio || [],
    windows: fullSnapshot.windows,
    canvases: fullSnapshot.canvases,
    modals: fullSnapshot.modals,
    output: fullSnapshot.output,
  }, previewTargetOrigin);
  return true;
}

export const browserAssetUrls = new Map();
