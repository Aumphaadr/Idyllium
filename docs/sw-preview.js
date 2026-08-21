// SW-песочница Idyllium: «сервер-репетиция» для Web IDE.
//
// Перехватывает ТОЛЬКО адреса <scope>preview/<порт>/... и спрашивает ответ
// у вкладки IDE, где работает ученический web.Server. Всё остальное — мимо
// (passthrough), никакого кэша: обычный сайт этот воркер не трогает.
// Снаружи «сайт ученика» не виден никому — это репетиция, не сервер.

const SCOPE_PATH = new URL(self.registration.scope).pathname;
const PREVIEW_RE = new RegExp('^' + SCOPE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'preview/(\\d{1,5})(/.*)?$');

let hostClientId = null; // вкладка IDE с работающей программой

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'idyllium-host-register') {
    hostClientId = event.source && event.source.id;
    if (event.ports[0]) event.ports[0].postMessage({ ok: true });
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const match = PREVIEW_RE.exec(url.pathname);
  if (!match) return;
  event.respondWith(handlePreview(event, Number(match[1]), match[2] || '/', url));
});

async function handlePreview(event, port, path, url) {
  const host = await findHost();
  if (!host) {
    return offlinePage('Вкладка Web IDE с работающей программой не найдена — откройте IDE и запустите программу с web.Server.');
  }

  const query = {};
  url.searchParams.forEach((value, name) => { if (!(name in query)) query[name] = value; });
  const body = event.request.method === 'GET' || event.request.method === 'HEAD'
    ? '' : await event.request.text();

  const reply = await askClient(host, {
    type: 'idyllium-preview-request',
    port,
    request: { method: event.request.method, path: decodeURIComponent(path), query, body },
  }, 4000);
  if (!reply) return offlinePage('Программа не ответила — она остановлена или занята.');
  if (reply.error === 'no-server') {
    return offlinePage(`На порту ${port} сейчас ничего не работает — запустите программу с web.Server.`);
  }
  return new Response(reply.response.body, {
    status: reply.response.status,
    headers: reply.response.headers,
  });
}

// Хост помнится по id, но воркер живёт недолго и память теряет; тогда
// хост находится заново опросом всех вкладок «у кого работают серверы?»
async function findHost() {
  if (hostClientId) {
    const known = await self.clients.get(hostClientId);
    if (known) return known;
    hostClientId = null;
  }
  const windows = await self.clients.matchAll({ type: 'window' });
  for (const client of windows) {
    const answer = await askClient(client, { type: 'idyllium-host-query' }, 300);
    if (answer && answer.host === true) {
      hostClientId = client.id;
      return client;
    }
  }
  return null;
}

function askClient(client, message, timeoutMs) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
    client.postMessage(message, [channel.port2]);
  });
}

function offlinePage(text) {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<title>Сервер-репетиция</title>'
      + '<body style="font-family:system-ui,sans-serif;max-width:36em;margin:15vh auto;padding:0 1.5em;line-height:1.5">'
      + '<h2>Сервер-репетиция не отвечает</h2><p>' + text + '</p>'
      + '<p style="color:#777">Сервер-репетиция живёт внутри вкладки Web IDE и виден только этому браузеру. '
      + 'Настоящий сервер программа поднимает в VS Code или в консоли.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
