// ───────────────────────────────────────────────────────────────────────────
// Node-реализация web.Server (фаза 3). Файл загружается ТОЛЬКО через
// eval('require') из defaultRuntimeNetworkService — браузерный бандл его не
// видит, как и node-sqlite-service.
// ───────────────────────────────────────────────────────────────────────────
import * as nodeHttp from 'http';
import {
  RuntimeHttpServerHandle,
  RuntimeHttpServerListenOptions,
  RuntimeHttpServerRequest,
  RuntimeHttpServerResponse,
} from './network-service';

export function createNodeHttpListen() {
  return function listen(
    options: RuntimeHttpServerListenOptions,
    handler: (request: RuntimeHttpServerRequest) => Promise<RuntimeHttpServerResponse>,
  ): Promise<RuntimeHttpServerHandle> {
    return new Promise<RuntimeHttpServerHandle>((resolve, reject) => {
      const server = nodeHttp.createServer((incoming, outgoing) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('end', () => {
          void (async () => {
            try {
              const url = new URL(incoming.url ?? '/', 'http://localhost');
              const query: Record<string, string> = {};
              url.searchParams.forEach((value, name) => {
                if (!(name in query)) query[name] = value;
              });
              const response = await handler({
                method: incoming.method ?? 'GET',
                path: decodeURIComponent(url.pathname),
                query,
                body: Buffer.concat(chunks).toString('utf8'),
              });
              outgoing.writeHead(response.status, { ...response.headers });
              outgoing.end(response.body);
            } catch {
              // Обработчик обязан отвечать сам; сюда попадают только аварии
              // самого транспорта — отвечаем честной пятисоткой.
              outgoing.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
              outgoing.end('internal server error');
            }
          })();
        });
      });

      server.on('error', (error) => reject(error));
      server.listen(options.port, options.host, () => {
        const address = server.address();
        const port = address && typeof address === 'object' ? address.port : options.port;
        resolve({
          port,
          close(): Promise<void> {
            return new Promise((done) => {
              server.close(() => done());
              // Живые keep-alive соединения не должны держать порт после Stop.
              server.closeAllConnections?.();
            });
          },
        });
      });
    });
  };
}
