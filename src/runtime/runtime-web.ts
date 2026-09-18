// ─── web.Server и шаблонизатор — модуль рантайма (этап Б, 2026-08-29) ──────
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, defineRuntimeGetter, errorMessage, intArgument, stringArgument } from './runtime-shared';
import { IdylliumArray, valueOps } from './runtime-values';
import { RuntimeObjectState, defineValidatedRuntimeProperty, publicRuntimeErrorFile } from './runtime-state';
import { JsonRuntimeValue, isJsonRuntimeValue, jsonEntries, jsonItems } from './runtime-json';
import { RuntimeHttpServerRequest, RuntimeHttpServerResponse } from './network-service';

const WEB_CONTENT_TYPES: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

export function webTextResponse(status: number, text: string): RuntimeHttpServerResponse {
  return { status, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: text };
}

// ─── Шаблонизатор страниц web-сервера ───────────────────────────────────────
// Язык: {{ключ}} и {{ключ.поле}} — подстановка, {% for x in список %}…{% endfor %}
// — цикл по json.Array, {% if флаг %}…{% else %}…{% endif %} — ветвление по bool.
// Ошибка шаблона НЕ роняет сервер: в страницу встаёт читаемый маркер [[ … ]] —
// вёрстка видна целиком, дырка названа по имени. Подстановки всегда
// экранируются: данные — текст, разметка живёт в шаблоне.

const WEB_TEMPLATE_NAME_PATTERN = /^[\p{L}_][\p{L}\p{N}_]*$/u;

function isWebTemplatePath(expression: string): boolean {
  const parts = expression.split('.');
  return parts.length > 0 && parts.every((part) => WEB_TEMPLATE_NAME_PATTERN.test(part));
}

function escapeWebTemplateValue(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type WebTemplateNode =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly expression: string }
  | { readonly kind: 'marker'; readonly text: string }
  | { readonly kind: 'for'; readonly item: string; readonly source: string; readonly body: readonly WebTemplateNode[] }
  | { readonly kind: 'if'; readonly source: string; readonly then: readonly WebTemplateNode[]; readonly otherwise: readonly WebTemplateNode[] };

// Глубже этого шаблон не вкладывается: предел держит и парсер, и рендер
// в безопасной глубине JS-стека (без него — сырое «Maximum call stack…»).

const WEB_TEMPLATE_MAX_DEPTH = 32;

function parseWebTemplate(template: string): WebTemplateNode[] {
  const tokens = template.split(/(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\})/u);
  let index = 0;
  // Текст маркера уходит в HTML как есть, поэтому кусок ЧУЖОГО текста
  // (токен шаблона) в нём экранируется — иначе '<' из опечатки съест маркер.
  const marker = (text: string): WebTemplateNode => ({ kind: 'marker', text });
  const shownToken = (token: string): string => escapeWebTemplateValue(token.trim());

  function parseNodes(closers: readonly string[], depth: number): { nodes: WebTemplateNode[]; closer: string | null } {
    const nodes: WebTemplateNode[] = [];
    while (index < tokens.length) {
      const token = tokens[index];
      index += 1;
      if (token === undefined || token === '') continue;
      if (token.startsWith('{{') && token.endsWith('}}')) {
        const expression = token.slice(2, -2).trim();
        nodes.push(isWebTemplatePath(expression)
          ? { kind: 'value', expression }
          : marker(`[[ непонятная подстановка '${shownToken(token)}' ]]`));
        continue;
      }
      if (token.startsWith('{%') && token.endsWith('%}')) {
        const command = token.slice(2, -2).trim();
        const commandWord = command.split(/\s+/u)[0];
        if (closers.includes(commandWord)) return { nodes, closer: commandWord };
        if (commandWord === 'endfor' || commandWord === 'endif' || commandWord === 'else') {
          nodes.push(marker(`[[ лишний '${shownToken(token)}' ]]`));
          continue;
        }
        if (commandWord === 'for') {
          const forMatch = /^for\s+(\S+)\s+in\s+(\S+)$/u.exec(command);
          if (!forMatch || !WEB_TEMPLATE_NAME_PATTERN.test(forMatch[1]) || !isWebTemplatePath(forMatch[2])) {
            nodes.push(marker(`[[ непонятный цикл '${shownToken(token)}' — нужно '{% for имя in список %}' ]]`));
            continue;
          }
          if (depth >= WEB_TEMPLATE_MAX_DEPTH) {
            nodes.push(marker(`[[ шаблон вложен глубже ${WEB_TEMPLATE_MAX_DEPTH} уровней — '${shownToken(token)}' пропущен ]]`));
            continue;
          }
          const body = parseNodes(['endfor'], depth + 1);
          if (body.closer === null) nodes.push(marker(`[[ '{% for %}' без '{% endfor %}' ]]`));
          nodes.push({ kind: 'for', item: forMatch[1], source: forMatch[2], body: body.nodes });
          continue;
        }
        if (commandWord === 'if') {
          const ifMatch = /^if\s+(\S+)$/u.exec(command);
          if (!ifMatch || !isWebTemplatePath(ifMatch[1])) {
            nodes.push(marker(`[[ непонятное условие '${shownToken(token)}' — нужно '{% if имя %}' ]]`));
            continue;
          }
          if (depth >= WEB_TEMPLATE_MAX_DEPTH) {
            nodes.push(marker(`[[ шаблон вложен глубже ${WEB_TEMPLATE_MAX_DEPTH} уровней — '${shownToken(token)}' пропущен ]]`));
            continue;
          }
          const thenPart = parseNodes(['else', 'endif'], depth + 1);
          let otherwise: readonly WebTemplateNode[] = [];
          if (thenPart.closer === 'else') {
            const elsePart = parseNodes(['endif'], depth + 1);
            otherwise = elsePart.nodes;
            if (elsePart.closer === null) nodes.push(marker(`[[ '{% if %}' без '{% endif %}' ]]`));
          } else if (thenPart.closer === null) {
            nodes.push(marker(`[[ '{% if %}' без '{% endif %}' ]]`));
          }
          nodes.push({ kind: 'if', source: ifMatch[1], then: thenPart.nodes, otherwise });
          continue;
        }
        nodes.push(marker(`[[ неизвестная команда '${shownToken(token)}' ]]`));
        continue;
      }
      nodes.push({ kind: 'text', text: token });
    }
    return { nodes, closer: null };
  }

  return parseNodes([], 0).nodes;
}

interface WebTemplateScope {
  readonly root: Map<string, JsonRuntimeValue>;
  readonly locals: Map<string, JsonRuntimeValue>[];
}

function resolveWebTemplatePath(
  expression: string,
  scope: WebTemplateScope,
): { value: JsonRuntimeValue } | { marker: string } {
  const parts = expression.split('.');
  const head = parts[0];
  let current: JsonRuntimeValue | undefined;
  for (let level = scope.locals.length - 1; level >= 0; level -= 1) {
    const local = scope.locals[level].get(head);
    if (local !== undefined) {
      current = local;
      break;
    }
  }
  current ??= scope.root.get(head);
  if (current === undefined) return { marker: `[[ нет значения '${head}' ]]` };
  let described = head;
  for (const part of parts.slice(1)) {
    if (current.__jsonKind !== 'object') return { marker: `[[ '${described}' — не объект ]]` };
    const next = jsonEntries(current).get(part);
    if (next === undefined) return { marker: `[[ у '${described}' нет поля '${part}' ]]` };
    current = next;
    described = `${described}.${part}`;
  }
  return { value: current };
}

function renderWebTemplateNodes(nodes: readonly WebTemplateNode[], scope: WebTemplateScope): string {
  let out = '';
  for (const node of nodes) {
    if (node.kind === 'text' || node.kind === 'marker') {
      out += node.text;
      continue;
    }
    const resolved = resolveWebTemplatePath(node.kind === 'value' ? node.expression : node.source, scope);
    if ('marker' in resolved) {
      out += resolved.marker;
      continue;
    }
    const value = resolved.value;
    if (node.kind === 'value') {
      switch (value.__jsonKind) {
        case 'string':
          out += escapeWebTemplateValue(value.__jsonValue as string);
          break;
        case 'int':
        case 'float':
          out += String(value.__jsonValue);
          break;
        case 'bool':
          out += value.__jsonValue === true ? 'true' : 'false';
          break;
        case 'null':
          out += `[[ '${node.expression}' — это null ]]`;
          break;
        case 'object':
          out += `[[ '${node.expression}' — объект: подставьте его поле через точку ]]`;
          break;
        case 'array':
          out += `[[ '${node.expression}' — список: нужен {% for %} ]]`;
          break;
      }
      continue;
    }
    if (node.kind === 'for') {
      if (value.__jsonKind !== 'array') {
        out += `[[ '${node.source}' — не список ]]`;
        continue;
      }
      for (const element of jsonItems(value)) {
        scope.locals.push(new Map([[node.item, element]]));
        out += renderWebTemplateNodes(node.body, scope);
        scope.locals.pop();
      }
      continue;
    }
    if (value.__jsonKind !== 'bool') {
      out += `[[ '${node.source}' — не bool ]]`;
      continue;
    }
    out += renderWebTemplateNodes(value.__jsonValue === true ? node.then : node.otherwise, scope);
  }
  return out;
}

export function renderWebTemplate(template: string, values: JsonRuntimeValue | null): string {
  const root = values === null ? new Map<string, JsonRuntimeValue>() : jsonEntries(values);
  return renderWebTemplateNodes(parseWebTemplate(template), { root, locals: [] });
}

// Тело браузерной формы (application/x-www-form-urlencoded): «процентный суп»
// вида author=%D0%9C%D0%B8%D1%80%D0%B0&text=… с плюсами вместо пробелов.

function decodeWebFormComponent(text: string): string {
  const spaced = text.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

function parseWebFormBody(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const pair of body.split('&')) {
    if (pair === '') continue;
    const separator = pair.indexOf('=');
    const rawName = separator < 0 ? pair : pair.slice(0, separator);
    const rawValue = separator < 0 ? '' : pair.slice(separator + 1);
    const name = decodeWebFormComponent(rawName);
    // Повтор имени — берётся первое значение (жанр query-параметров).
    if (!fields.has(name)) fields.set(name, decodeWebFormComponent(rawValue));
  }
  return fields;
}

function createWebRequestObject(
  request: RuntimeHttpServerRequest,
  state: RuntimeObjectState,
  pathParameters: Readonly<Record<string, string>> = {},
): RuntimeObject {
  const obj: RuntimeObject = {
    __idylliumObjectId: state.nextObjectId++,
    __idylliumType: 'web.Request',
    path: request.path,
    body: request.body,
  };
  obj.query = contextFunction((name: unknown, file: string, line: number) => {
    const parameter = stringArgument(name, 'web.Request.query() name', file, line);
    return request.query[parameter] ?? '';
  });
  obj.param = contextFunction((name: unknown, file: string, line: number) => {
    const parameter = stringArgument(name, 'web.Request.param() name', file, line);
    return pathParameters[parameter] ?? '';
  });
  let formFields: Map<string, string> | null = null;
  obj.form = contextFunction((name: unknown, file: string, line: number) => {
    const parameter = stringArgument(name, 'web.Request.form() name', file, line);
    formFields ??= parseWebFormBody(request.body);
    return formFields.get(parameter) ?? '';
  });
  obj.to_string = () => `web.Request(${request.method} ${request.path})`;
  return obj;
}

interface WebResponseInternals {
  readonly object: RuntimeObject;
  finish(): { readonly body: string; readonly contentType: string; readonly location: string | null };
}

function createWebResponseObject(state: RuntimeObjectState): WebResponseInternals {
  let body = '';
  let contentType = 'text/plain; charset=utf-8';
  let sent = false;
  let redirectLocation: string | null = null;

  const obj: RuntimeObject = {
    __idylliumObjectId: state.nextObjectId++,
    __idylliumType: 'web.Response',
  };
  defineValidatedRuntimeProperty(obj, 'status', 200, (value, file, line) => {
    if (redirectLocation !== null) {
      throw new IdylliumRuntimeError(file, line, 'web.Response.status cannot be changed after redirect() — redirect always answers 303');
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 100 || value > 599) {
      throw new IdylliumRuntimeError(file, line, `web.Response.status must be an integer from 100 to 599, got '${String(value)}'`);
    }
    return value;
  });
  obj.send = contextFunction((text: unknown, file: string, line: number) => {
    const payload = stringArgument(text, 'web.Response.send() text', file, line);
    if (sent) throw new IdylliumRuntimeError(file, line, 'web.Response.send() the response was already sent');
    sent = true;
    body = payload;
    contentType = 'text/html; charset=utf-8';
  });
  obj.send_json = contextFunction((text: unknown, file: string, line: number) => {
    const payload = stringArgument(text, 'web.Response.send_json() text', file, line);
    if (sent) throw new IdylliumRuntimeError(file, line, 'web.Response.send_json() the response was already sent');
    sent = true;
    body = payload;
    contentType = 'application/json; charset=utf-8';
  });
  obj.send_template = contextFunction((templatePath: unknown, valuesOrFile: unknown, fileOrLine: unknown, maybeLine?: number) => {
    // values — необязательный аргумент: контекст file/line приезжает следом
    // за фактическими аргументами (жанр math.floor с необязательным digits).
    const hasValues = typeof maybeLine === 'number';
    const values = hasValues ? valuesOrFile : null;
    const file = String(hasValues ? fileOrLine : valuesOrFile);
    const line = hasValues ? maybeLine : Number(fileOrLine);
    const requested = stringArgument(templatePath, 'web.Response.send_template() path', file, line);
    if (sent) throw new IdylliumRuntimeError(file, line, 'web.Response.send_template() the response was already sent');
    let templateValues: JsonRuntimeValue | null = null;
    if (values !== null && values !== undefined) {
      if (!isJsonRuntimeValue(values) || values.__jsonKind !== 'object') {
        throw new IdylliumRuntimeError(file, line, `web.Response.send_template() values must be a json.Object, got '${valueOps.typeName(values)}'`);
      }
      templateValues = values;
    }
    const humanize = (text: string) => state.fileSystem.humanizePaths?.(text) ?? text;
    const resolved = state.fileSystem.resolvePath(requested, file);
    const shownPath = humanize(resolved);
    let templateExists: boolean;
    try {
      templateExists = state.fileSystem.exists(resolved);
    } catch (error) {
      // страж песочницы (path is outside the project) — в детской обёртке
      throw new IdylliumRuntimeError(file, line, `web.Response.send_template() cannot read '${shownPath}': ${humanize(errorMessage(error))}`);
    }
    if (!templateExists) {
      throw new IdylliumRuntimeError(file, line, `web.Response.send_template() cannot read '${shownPath}': file does not exist`);
    }
    if (!state.fileSystem.isFile(resolved)) {
      throw new IdylliumRuntimeError(file, line, `web.Response.send_template() cannot read '${shownPath}': path is not a file`);
    }
    let template: string;
    try {
      template = state.fileSystem.readText(resolved);
    } catch (error) {
      throw new IdylliumRuntimeError(file, line, `web.Response.send_template() cannot read '${shownPath}': ${humanize(errorMessage(error))}`);
    }
    sent = true;
    body = renderWebTemplate(template, templateValues);
    contentType = 'text/html; charset=utf-8';
  });
  obj.redirect = contextFunction((target: unknown, file: string, line: number) => {
    const destination = stringArgument(target, 'web.Response.redirect() path', file, line);
    if (sent) throw new IdylliumRuntimeError(file, line, 'web.Response.redirect() the response was already sent');
    if (destination.trim() === '') {
      throw new IdylliumRuntimeError(file, line, 'web.Response.redirect() path must not be empty');
    }
    sent = true;
    // Жёсткое правило v1: redirect — всегда 303 See Other (канон PRG),
    // выбора кода не даём; статус после redirect закрыт валидатором,
    // поэтому 303 ставится ДО redirectLocation.
    obj.status = 303;
    // Location обязан быть ASCII: кириллица и управляющие символы
    // кодируются процентами (encodeURI не трогает уже закодированные %XX),
    // заодно умирает инъекция заголовков через перевод строки.
    try {
      redirectLocation = encodeURI(destination);
    } catch {
      sent = false;
      throw new IdylliumRuntimeError(file, line, `web.Response.redirect() cannot send '${destination}' as an address`);
    }
    body = '';
  });
  obj.to_string = () => 'web.Response';

  return {
    object: obj,
    finish: () => ({ body, contentType, location: redirectLocation }),
  };
}

function serveWebStatic(roots: readonly string[], requestPath: string, state: RuntimeObjectState): RuntimeHttpServerResponse | null {
  let relative = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';
  const segments = relative.split('/');
  // Path traversal закрыт с первого дня: наружу из папки не выйти.
  if (segments.some((segment) => segment === '..' || segment === '' || segment.includes('\\'))) return null;

  for (const root of roots) {
    const target = `${root}/${segments.join('/')}`;
    if (!state.fileSystem.exists(target) || !state.fileSystem.isFile(target)) continue;
    const extension = (segments[segments.length - 1].split('.').pop() ?? '').toLowerCase();
    const contentType = WEB_CONTENT_TYPES[extension] ?? 'application/octet-stream';
    const bytes = state.fileSystem.readBytes?.(target);
    return {
      status: 200,
      headers: { 'content-type': contentType },
      body: bytes ?? state.fileSystem.readText(target),
    };
  }
  return null;
}

export function initializeWebObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (typeName !== 'Server') return;

  // Порт проверяется В МОМЕНТ ПРИСВАИВАНИЯ, а не при run(): ошибку показываем
  // там, где её сделали (NET1, находка методистов 2026-08-23).
  defineValidatedRuntimeProperty(obj, 'port', 8080, (value, file, line) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 65535) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `web.Server.port must be an integer from 0 to 65535, got '${String(value)}'`,
      );
    }
    return value;
  });
  // Безопасность по умолчанию: слушаем только свой компьютер. Открыть класс —
  // явное решение программиста: app.host = "0.0.0.0" (вся локальная сеть).
  obj.host = '127.0.0.1';
  obj.debug = false;
  obj.is_running = false;
  const routes = new Map<string, unknown>();
  const routePaths = new Set<string>();
  const staticRoots: string[] = [];

  // Маршруты с параметрами пути: on_get("/post/<id>", …). Сегмент <имя>
  // ловит один сегмент адреса; точный путь всегда побеждает шаблонный.
  interface WebParameterRoute {
    readonly method: 'GET' | 'POST';
    readonly pattern: string;
    readonly segments: readonly (string | null)[];
    readonly parameterNames: readonly string[];
    readonly handler: unknown;
  }
  const parameterRoutes: WebParameterRoute[] = [];
  const parameterRouteShapes = new Map<string, string>();

  function routeSegmentsMatch(segments: readonly (string | null)[], pathSegments: readonly string[]): boolean {
    if (segments.length !== pathSegments.length) return false;
    return segments.every((segment, position) => (
      segment === null ? pathSegments[position] !== '' : segment === pathSegments[position]
    ));
  }

  function matchParameterRoute(method: string, requestPath: string): { handler: unknown; parameters: Record<string, string> } | null {
    const pathSegments = requestPath.slice(1).split('/');
    for (const route of parameterRoutes) {
      if (route.method !== method || !routeSegmentsMatch(route.segments, pathSegments)) continue;
      const parameters: Record<string, string> = {};
      let parameterIndex = 0;
      route.segments.forEach((segment, position) => {
        if (segment === null) {
          parameters[route.parameterNames[parameterIndex]] = pathSegments[position];
          parameterIndex += 1;
        }
      });
      return { handler: route.handler, parameters };
    }
    return null;
  }

  function pathIsKnownRoute(requestPath: string): boolean {
    if (routePaths.has(requestPath)) return true;
    const pathSegments = requestPath.slice(1).split('/');
    return parameterRoutes.some((route) => routeSegmentsMatch(route.segments, pathSegments));
  }

  function registerRoute(method: 'GET' | 'POST', methodName: string) {
    return contextFunction((routePath: unknown, handler: unknown, file: string, line: number) => {
      const pathValue = stringArgument(routePath, `web.Server.${methodName}() path`, file, line);
      if (!pathValue.startsWith('/')) {
        throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() path must start with '/', got '${pathValue}'`);
      }
      if (typeof handler !== 'function') {
        throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() handler must be a function like 'void function(web.Request req, web.Response res)'`);
      }
      if (pathValue.includes('<') || pathValue.includes('>')) {
        const segments: (string | null)[] = [];
        const parameterNames: string[] = [];
        for (const segment of pathValue.slice(1).split('/')) {
          const parameterMatch = /^<(.*)>$/u.exec(segment);
          if (parameterMatch) {
            const parameterName = parameterMatch[1];
            if (!WEB_TEMPLATE_NAME_PATTERN.test(parameterName)) {
              throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() path parameter '<${parameterName}>' must be a simple name, like '/post/<id>'`);
            }
            if (parameterNames.includes(parameterName)) {
              throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() path parameter '<${parameterName}>' is used twice in '${pathValue}'`);
            }
            parameterNames.push(parameterName);
            segments.push(null);
          } else if (segment.includes('<') || segment.includes('>')) {
            throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() path parameter must occupy a whole segment between '/', like '/post/<id>', got '${segment}' in '${pathValue}'`);
          } else {
            segments.push(segment);
          }
        }
        const shape = `${method} /${segments.map((segment) => (segment === null ? '<>' : segment)).join('/')}`;
        const registered = parameterRouteShapes.get(shape);
        if (registered !== undefined) {
          throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() route '${pathValue}' conflicts with already registered '${registered}'`);
        }
        parameterRouteShapes.set(shape, pathValue);
        parameterRoutes.push({ method, pattern: pathValue, segments, parameterNames, handler });
        return;
      }
      const key = `${method} ${pathValue}`;
      if (routes.has(key)) {
        throw new IdylliumRuntimeError(file, line, `web.Server.${methodName}() route '${pathValue}' is already registered`);
      }
      routes.set(key, handler);
      routePaths.add(pathValue);
    });
  }
  obj.on_get = registerRoute('GET', 'on_get');
  obj.on_post = registerRoute('POST', 'on_post');

  obj.serve_directory = contextFunction((directory: unknown, file: string, line: number) => {
    const requested = stringArgument(directory, 'web.Server.serve_directory() path', file, line);
    const resolved = state.fileSystem.resolvePath(requested, file);
    if (!state.fileSystem.exists(resolved) || !state.fileSystem.isDirectory(resolved)) {
      throw new IdylliumRuntimeError(file, line, `web.Server.serve_directory() cannot serve '${requested}': directory does not exist`);
    }
    staticRoots.push(resolved.replace(/[\\/]+$/u, ''));
  });

  obj.run = contextFunction(async (file: string, line: number) => {
    if (obj.is_running === true) {
      throw new IdylliumRuntimeError(file, line, 'web.Server.run() the server is already running');
    }
    const service = state.networkService;
    if (!service?.listen) {
      if (state.turtlePlatform === 'web') {
        throw new IdylliumRuntimeError(file, line, 'web.Server.run() is not available in the Web IDE — run the program in VS Code or the console host, where the computer can listen on a port');
      }
      throw new IdylliumRuntimeError(file, line, 'web.Server.run() is not supported by this runtime');
    }
    const port = obj.port;
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 0 || port > 65535) {
      throw new IdylliumRuntimeError(file, line, `web.Server.port must be an integer from 0 to 65535, got '${String(port)}'`);
    }
    const host = obj.host;
    if (typeof host !== 'string' || host.trim() === '') {
      throw new IdylliumRuntimeError(file, line, 'web.Server.host must be a non-empty string');
    }

    // Запросы обрабатываются по одному, в порядке прихода: обработчики не
    // перебивают друг друга на середине — важное для учебных программ свойство.
    let chain: Promise<void> = Promise.resolve();
    const dispatch = async (request: RuntimeHttpServerRequest): Promise<RuntimeHttpServerResponse> => {
      let handler = routes.get(`${request.method} ${request.path}`);
      let pathParameters: Record<string, string> = {};
      if (typeof handler !== 'function') {
        const parameterMatch = matchParameterRoute(request.method, request.path);
        if (parameterMatch) {
          handler = parameterMatch.handler;
          pathParameters = parameterMatch.parameters;
        }
      }
      if (typeof handler === 'function') {
        const requestObject = createWebRequestObject(request, state, pathParameters);
        const response = createWebResponseObject(state);
        try {
          await handler(requestObject, response.object);
        } catch (error) {
          // Сервер не падает от одного неудачного запроса: авария уходит
          // пятисоткой в браузер и строкой в консоль программы.
          const rawText = error instanceof IdylliumRuntimeError
            ? `${publicRuntimeErrorFile(error.file)}:${error.line}: runtime error: ${error.detail}`
            : String((error as Error | undefined)?.message ?? error);
          const text = state.fileSystem.humanizePaths?.(rawText) ?? rawText;
          state.consoleWrite?.(`[web] запрос ${request.method} ${request.path} упал: ${text}\n`);
          // Посетителю — нейтральный ответ: текст ошибки называет файлы, строки и таблицы
          // программы. Подробности — в консоли сервера; app.debug = true возвращает их в ответ.
          return webTextResponse(500, obj.debug === true
            ? text
            : '500 Internal Server Error — the handler failed; details are in the server console (app.debug = true shows them here)');
        }
        const finished = response.finish();
        const headers: Record<string, string> = { 'content-type': finished.contentType };
        if (finished.location !== null) headers.location = finished.location;
        return {
          status: Number(response.object.status ?? 200),
          headers,
          body: finished.body,
        };
      }
      if (request.method === 'GET' && staticRoots.length > 0) {
        const staticResponse = serveWebStatic(staticRoots, request.path, state);
        if (staticResponse) return staticResponse;
      }
      if (pathIsKnownRoute(request.path)) {
        return webTextResponse(405, `method ${request.method} is not allowed for '${request.path}'`);
      }
      return webTextResponse(404, `not found: '${request.path}'`);
    };
    const handleRequest = (request: RuntimeHttpServerRequest): Promise<RuntimeHttpServerResponse> =>
      new Promise((resolve) => {
        chain = chain.then(async () => resolve(await dispatch(request)));
      });

    let handle;
    try {
      handle = await service.listen({ host, port }, handleRequest);
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'EADDRINUSE') {
        throw new IdylliumRuntimeError(file, line, `web.Server.run() port ${port} is already in use — choose another port or stop the other program`);
      }
      if (code === 'EACCES') {
        throw new IdylliumRuntimeError(file, line, `web.Server.run() port ${port} requires administrator rights — choose a port above 1023`);
      }
      if (code === 'EADDRNOTAVAIL' || code === 'ENOTFOUND') {
        throw new IdylliumRuntimeError(file, line, `web.Server.run() cannot listen on host '${host}': address is not available`);
      }
      throw new IdylliumRuntimeError(file, line, `web.Server.run() cannot start: ${String((error as Error | undefined)?.message ?? error)}`);
    }

    obj.port = handle.port;
    obj.is_running = true;
    if (typeof handle.announce === 'string' && handle.announce !== '') {
      state.consoleWrite?.(`${handle.announce}\n`);
    } else if (host === '0.0.0.0') {
      state.consoleWrite?.(`Сервер слушает порт ${handle.port} на всех адресах компьютера — программа доступна всей локальной сети\n`);
    } else {
      state.consoleWrite?.(`Сервер слушает http://${host}:${handle.port}\n`);
    }

    // Вечный цикл в жанре gui-программ: run() не возвращается, пока
    // программу не остановят (Stop / Ctrl+C).
    await new Promise<never>((_resolve, reject) => {
      const stop = () => {
        obj.is_running = false;
        void handle.close();
        reject(new IdylliumRuntimeError(file || 'main.idyl', line || 1, 'program was stopped', 'cancelled'));
      };
      if (state.abortSignal?.aborted) {
        stop();
        return;
      }
      state.abortSignal?.addEventListener?.('abort', stop, { once: true });
    });
  });

  obj.to_string = () => (obj.is_running === true ? `web.Server(http://${obj.host}:${obj.port})` : 'web.Server(stopped)');
}

// ─── channel.Post: почтовое отделение программы ────────────────────────────
