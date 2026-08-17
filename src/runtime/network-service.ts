// ───────────────────────────────────────────────────────────────────────────
// Сетевой сервис рантайма (фаза 0 дорожной карты, 2026-08-15).
//
// Один интерфейс на все хосты: node и браузер используют глобальный fetch
// (Node ≥18, VS Code ^1.85 — есть везде), тесты — записанные ответы через
// createMemoryNetworkService. Живая сеть в тестах не используется никогда.
// ───────────────────────────────────────────────────────────────────────────

export interface RuntimeNetworkRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}

export interface RuntimeNetworkResponse {
  readonly status: number;
  /** Имена заголовков — в нижнем регистре. */
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
}

export type RuntimeNetworkErrorKind = 'timeout' | 'blocked' | 'unreachable';

/** Типизированная сетевая беда; рантайм переводит kind в детский текст. */
export class RuntimeNetworkError extends Error {
  constructor(message: string, readonly kind: RuntimeNetworkErrorKind) {
    super(message);
    this.name = 'RuntimeNetworkError';
  }
}

export interface RuntimeNetworkService {
  fetch(request: RuntimeNetworkRequest): Promise<RuntimeNetworkResponse>;
}

export interface FetchNetworkServiceOptions {
  /**
   * Браузерный fetch прячет причину отказа (TypeError без деталей), и чаще
   * всего это CORS. С включённой подсказкой сбой без ответа трактуется как
   * 'blocked' — Web IDE честно говорит про браузерную клетку.
   */
  readonly corsHints?: boolean;
}

export function createFetchNetworkService(
  options: FetchNetworkServiceOptions = {},
): RuntimeNetworkService | undefined {
  const globalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  if (typeof globalFetch !== 'function') return undefined;

  return {
    async fetch(request: RuntimeNetworkRequest): Promise<RuntimeNetworkResponse> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1, request.timeoutMs));
      try {
        const response = await globalFetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.method === 'POST' ? request.body ?? '' : undefined,
          signal: controller.signal,
          redirect: 'follow',
        });
        const text = await response.text();
        const headers: Record<string, string> = {};
        response.headers.forEach((value, name) => {
          headers[name.toLowerCase()] = value;
        });
        return { status: response.status, headers, text };
      } catch (error) {
        if (controller.signal.aborted) {
          throw new RuntimeNetworkError('request timed out', 'timeout');
        }
        if (options.corsHints === true) {
          // В браузере сетевой сбой и CORS-запрет неразличимы на уровне
          // fetch; для учебной среды подсказка про CORS полезнее молчания.
          throw new RuntimeNetworkError('blocked by the browser', 'blocked');
        }
        throw new RuntimeNetworkError(errorText(error), 'unreachable');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ─── Мок для тестов ────────────────────────────────────────────────────────

export interface MemoryNetworkRoute {
  readonly status?: number;
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Имитация беды вместо ответа. */
  readonly fail?: RuntimeNetworkErrorKind;
}

export interface MemoryNetworkService extends RuntimeNetworkService {
  /** Все запросы, дошедшие до сервиса, в порядке поступления. */
  readonly requests: RuntimeNetworkRequest[];
}

export function createMemoryNetworkService(
  routes: Readonly<Record<string, MemoryNetworkRoute>> = {},
): MemoryNetworkService {
  const requests: RuntimeNetworkRequest[] = [];
  return {
    requests,
    async fetch(request: RuntimeNetworkRequest): Promise<RuntimeNetworkResponse> {
      requests.push(request);
      const route = routes[request.url];
      if (!route) {
        throw new RuntimeNetworkError(`no recorded response for '${request.url}'`, 'unreachable');
      }
      if (route.fail === 'timeout') throw new RuntimeNetworkError('request timed out', 'timeout');
      if (route.fail === 'blocked') throw new RuntimeNetworkError('blocked by the browser', 'blocked');
      if (route.fail === 'unreachable') throw new RuntimeNetworkError('connection refused', 'unreachable');
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(route.headers ?? {})) {
        headers[name.toLowerCase()] = value;
      }
      return {
        status: route.status ?? 200,
        headers,
        text: route.body ?? '',
      };
    },
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    // node fetch заворачивает системную причину в cause.
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code) return humanizeNetworkCode(cause.code);
    if (cause?.message) return cause.message;
    return error.message;
  }
  return String(error);
}

function humanizeNetworkCode(code: string): string {
  switch (code) {
    case 'ECONNREFUSED': return 'connection refused';
    case 'ENOTFOUND': return 'host not found';
    case 'ECONNRESET': return 'connection reset';
    case 'ETIMEDOUT': return 'connection timed out';
    case 'EAI_AGAIN': return 'host not found (DNS is unavailable)';
    default: return code;
  }
}
