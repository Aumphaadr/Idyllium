'use strict';

const path = require('path');

const rendererRootDir = __dirname;

function rendererAssetPaths() {
  return {
    css: path.join(rendererRootDir, 'renderer.css'),
    script: path.join(rendererRootDir, 'renderer.js'),
  };
}

function renderGuiWebviewHtml({
  cspSource,
  cssUri,
  hostBootstrap = 'window.IdylliumGuiHost = acquireVsCodeApi();',
  nonce,
  scriptUri,
  state,
}) {
  const serialized = JSON.stringify(state).replace(/</gu, '\\u003c');
  const csp = cspSource
    ? `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; media-src ${cspSource} data:; font-src ${cspSource} data:; style-src ${cspSource}; script-src 'nonce-${nonce}' ${cspSource};">\n`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${csp}  <title>Idyllium GUI</title>
  <link rel="stylesheet" href="${htmlAttribute(cssUri)}">
</head>
<body>
  <div class="toolbar">
    <strong>Idyllium GUI preview</strong>
    <span id="summary"></span>
  </div>
  <div id="stage" class="stage"></div>
  <script nonce="${htmlAttribute(nonce)}">
    window.IdylliumGuiInitialState = ${serialized};
    ${hostBootstrap}
  </script>
  <script nonce="${htmlAttribute(nonce)}" src="${htmlAttribute(scriptUri)}"></script>
</body>
</html>`;
}

function buildGuiState(adapter, windows, canvases, modals, _output, audio = []) {
  return addGuiResourceUris(adapter, { audio, windows, canvases, modals });
}

function addGuiResourceUris(adapter, value) {
  if (Array.isArray(value)) {
    return value.map((item) => addGuiResourceUris(adapter, item));
  }

  if (!value || typeof value !== 'object') return value;

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = addGuiResourceUris(adapter, item);
  }

  if (
    (
      result.type === 'image.Static'
      || result.type === 'image.Animation'
      || result.type === 'fonts.Font'
      || result.type === 'audio.Sound'
      || result.type === 'audio.Music'
    )
    && result.properties
    && typeof result.properties === 'object'
    && typeof result.properties.resolved_path === 'string'
    && path.isAbsolute(result.properties.resolved_path)
  ) {
    const resourceUri = adapter && typeof adapter.toResourceUri === 'function'
      ? adapter.toResourceUri(result.properties.resolved_path)
      : result.properties.resolved_path;
    result.properties = {
      ...result.properties,
      webview_uri: String(resourceUri),
    };
  }

  return result;
}

function collectGuiAssetPaths(windows, canvases, audio = []) {
  const result = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const type = value.type;
    const properties = value.properties;
    if (
      (
        type === 'image.Static'
        || type === 'image.Animation'
        || type === 'fonts.Font'
        || type === 'audio.Sound'
        || type === 'audio.Music'
      )
      && properties
      && typeof properties.resolved_path === 'string'
      && path.isAbsolute(properties.resolved_path)
    ) {
      result.push(properties.resolved_path);
    }

    for (const item of Object.values(value)) visit(item);
  };

  visit(windows);
  visit(canvases);
  visit(audio);
  return result;
}

function guiPreviewIntervalMs(windows, canvases) {
  const candidates = [];
  const collectCanvas = (canvas) => {
    const limit = Number(canvas && canvas.properties && canvas.properties.framerate_limit);
    if (Number.isFinite(limit) && limit > 0) candidates.push(limit);
  };
  for (const canvas of canvases) collectCanvas(canvas);
  const visitWidget = (widget) => {
    if (widget.canvas) collectCanvas(widget.canvas);
    for (const child of widget.children || []) visitWidget(child);
  };
  for (const win of windows) visitWidget(win);
  const fps = Math.max(1, Math.min(60, candidates.length > 0 ? Math.max(...candidates) : 30));
  return Math.max(16, Math.round(1000 / fps));
}

function htmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

module.exports = {
  buildGuiState,
  collectGuiAssetPaths,
  guiPreviewIntervalMs,
  rendererAssetPaths,
  rendererRootDir,
  renderGuiWebviewHtml,
};
