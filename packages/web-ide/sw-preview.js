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
  if (match) {
    event.respondWith(handlePreview(event, Number(match[1]), match[2] || '/', url));
    return;
  }

  // Абсолютные ссылки СО СТРАНИЦЫ репетиции: <link href="/style.css">,
  // <img src="/герб.png">, <a href="/post/3">, <form action="/add"> бьют в
  // корень сайта — мимо /preview/<порт>/. Реферер выдаёт, что запрос пришёл
  // из мира репетиции, и мы возвращаем его в песочницу программы:
  // навигации — редиректом (адресная строка остаётся в /preview/, метод и
  // тело POST сохраняет 307), субресурсы — напрямую из программы.
  if (!event.request.referrer) return;
  let refMatch = null;
  try {
    const referrer = new URL(event.request.referrer);
    if (referrer.origin === self.location.origin) refMatch = PREVIEW_RE.exec(referrer.pathname);
  } catch (e) {
    return;
  }
  if (!refMatch) return;
  const port = Number(refMatch[1]);
  if (event.request.mode === 'navigate') {
    event.respondWith(Response.redirect(
      SCOPE_PATH + 'preview/' + port + url.pathname + url.search,
      307,
    ));
    return;
  }
  event.respondWith(handlePreview(event, port, url.pathname, url));
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

  // Битая процентная последовательность в адресе не должна ронять запрос:
  // нераскодировавшийся путь уходит как есть и честно ловит 404 программы.
  let decodedPath = path;
  try { decodedPath = decodeURIComponent(path); } catch (e) { /* сырой путь */ }
  const reply = await askClient(host, {
    type: 'idyllium-preview-request',
    port,
    request: { method: event.request.method, path: decodedPath, query, body },
  }, 4000);
  if (!reply) return offlinePage('Программа не ответила — она остановлена или занята.');
  if (reply.error === 'no-server') {
    return offlinePage(`На порту ${port} сейчас ничего не работает — запустите программу с web.Server.`);
  }
  const headers = Object.assign({}, reply.response.headers);
  // res.redirect ученической программы шлёт Location вида '/', а репетиция
  // живёт под /preview/<порт>/ — переписываем адрес внутрь песочницы,
  // иначе браузер выпадет из репетиции на корень сайта.
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'location' && headers[name].startsWith('/')) {
      headers[name] = SCOPE_PATH + 'preview/' + port + headers[name];
    }
  }
  return new Response(reply.response.body, {
    status: reply.response.status,
    headers,
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
