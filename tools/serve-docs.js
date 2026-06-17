#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.cwd(), readRootArg() || 'docs');
const requestedPort = Number(process.env.PORT || readArg('--port') || 4173);
const host = process.env.HOST || '127.0.0.1';

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ttf', 'font/ttf'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

if (!fs.existsSync(root)) {
  console.error(`Docs directory does not exist: ${root}`);
  console.error('Run: npm run docs:site');
  process.exit(1);
}

listen(requestedPort);

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

function readRootArg() {
  for (let index = 2; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (value === '--port') {
      index += 1;
      continue;
    }
    if (value.startsWith('--')) continue;
    return value;
  }
  return null;
}

function listen(port) {
  const server = http.createServer(handleRequest);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < requestedPort + 20) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, host, () => {
    console.log(`Idyllium docs: http://${host}:${port}/`);
    console.log(`Serving: ${root}`);
  });
}

function handleRequest(request, response) {
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const filePath = resolveRequestPath(request.url || '/');
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (!statError && stat.isDirectory()) {
      sendFile(path.join(filePath, 'index.html'), method, response, true);
      return;
    }

    if (!statError && stat.isFile()) {
      sendFile(filePath, method, response, false);
      return;
    }

    const fallback = path.join(root, 'index.html');
    sendFile(fallback, method, response, true);
  });
}

function resolveRequestPath(rawUrl) {
  let pathname = '/';
  try {
    pathname = new URL(rawUrl, 'http://localhost').pathname;
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.resolve(root, `.${normalized}`);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  return resolved;
}

function sendFile(filePath, method, response, fallback) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(fallback ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(fallback ? 'Not found' : String(error.message || error));
      return;
    }

    const type = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Length': data.length,
      'Content-Type': type,
    });
    if (method === 'HEAD') {
      response.end();
      return;
    }
    response.end(data);
  });
}
