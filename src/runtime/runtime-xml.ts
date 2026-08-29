// ─── XML/HTML: чтение разметки — модуль рантайма ───────────────────────────
// Вынесено из runtime.ts при декомпозиции 2026-08-29; содержимое — как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { contextFunction, stringArgument } from './runtime-shared';
import { IdylliumArray } from './runtime-values';

// ─── XML/HTML: чтение разметки без хитрых штучек (spec/some_xml) ────────────
// Два входа над одним ядром: строгий xml.parse_xml (честные ошибки с позицией
// строки и столбца, well-formedness: один корень, текст только внутри него,
// без дубликатов атрибутов) и прощающий xml.parse_html (void-теги,
// автозакрытие списков и таблиц, атрибуты без кавычек, любой регистр,
// обрывы страницы перевариваются — частично скачанный http-ответ не роняет
// разбор). За бортом сознательно: namespaces, XPath, селекторы, DTD,
// сериализация — библиотека про чтение. Порт одобренного прототипа
// spec/some_xml/prototype/xml-parser.mjs, дожатый ломателями 2026-08-28:
// узлы на общем прототипе (иначе ~2,3 КБ кучи на узел и краш V8 на больших
// страницах), обходы итеративные (иначе глубокое дерево валило стек с
// советом «почините рекурсию» про функции, которых у ученика нет).

// nbsp — сознательно обычный пробел: неразрывный на глаз неотличим, а
// сравнение строк в детской программе обязано сходиться.
const XML_NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const XML_VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Кого закрывает открытие такого же (жанр списков и таблиц).
const XML_AUTOCLOSE: Readonly<Record<string, readonly string[]>> = {
  li: ['li'], p: ['p'], option: ['option'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'],
};
const XML_RAW_TEXT = new Set(['script', 'style']);
// Упрощённое XML-имя: буквы любого алфавита (дети пишут <герой>), цифры не
// первым символом. Полная продукция Name из стандарта — хитрая штучка.
const XML_STRICT_NAME = /^[\p{L}_:][\p{L}\p{N}_:.\-]*$/u;

export type XmlRuntimeNode = Record<string, unknown> & {
  __idylliumType: 'xml.Node';
  __xmlTag: string;
  __xmlHtml: boolean;
  __xmlAttributes: Map<string, string>;
  /** Элементы и текстовые куски в порядке документа. */
  __xmlParts: Array<XmlRuntimeNode | string>;
};

export function isXmlRuntimeNode(value: unknown): value is XmlRuntimeNode {
  return typeof value === 'object' && value !== null && (value as XmlRuntimeNode).__idylliumType === 'xml.Node';
}

function decodeXmlEntities(text: string): string {
  // Тело числовой сущности — строго цифры своей системы: «&#65a;» не сущность
  // и остаётся литералом (раньше parseInt молча съедал мусорный хвост).
  return text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      // Запрещённые в XML кодовые точки (NUL, суррогатные половины, за
      // пределами Unicode) не раскрываются — сущность остаётся литералом,
      // видимым в text, а не битым символом в строке ученика.
      if (!Number.isFinite(code) || code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return XML_NAMED_ENTITIES[body] ?? whole;
  });
}

function xmlInnerText(node: XmlRuntimeNode): string {
  // Обход явным стеком: глубина документа не ограничена стеком JS.
  const pieces: string[] = [];
  const work: Array<XmlRuntimeNode | string> = [node];
  while (work.length > 0) {
    const current = work.pop()!;
    if (typeof current === 'string') {
      pieces.push(current);
      continue;
    }
    for (let i = current.__xmlParts.length - 1; i >= 0; i -= 1) {
      work.push(current.__xmlParts[i]);
    }
  }
  return pieces.join('');
}

function xmlElementChildren(node: XmlRuntimeNode): XmlRuntimeNode[] {
  return node.__xmlParts.filter(isXmlRuntimeNode);
}

function xmlFindAll(node: XmlRuntimeNode, tag: string): XmlRuntimeNode[] {
  // Документный порядок обходом с явным стеком — глубина не ограничена.
  const found: XmlRuntimeNode[] = [];
  const work: XmlRuntimeNode[] = [...xmlElementChildren(node)].reverse();
  while (work.length > 0) {
    const current = work.pop()!;
    if (current.__xmlTag === tag) found.push(current);
    const children = xmlElementChildren(current);
    for (let i = children.length - 1; i >= 0; i -= 1) work.push(children[i]);
  }
  return found;
}

// Имя для поиска: в HTML теги и атрибуты нормализованы к нижнему регистру ещё
// при разборе — аргументы приводим так же, иначе find_all("IMG") молча не
// находил бы ничего.
function xmlSearchName(node: XmlRuntimeNode, raw: string): string {
  return node.__xmlHtml ? raw.toLowerCase() : raw;
}

// Методы и геттеры живут на ОБЩЕМ прототипе: узел несёт только четыре поля
// данных. Замыкания на каждый узел стоили ~2,3 КБ кучи, и 19-мегабайтная
// страница валила V8 без всякой метки runtime error (улов ломателя).
const XML_NODE_PROTOTYPE: Record<string, unknown> = {};
Object.defineProperty(XML_NODE_PROTOTYPE, '__idylliumType', { value: 'xml.Node', enumerable: false });
Object.defineProperty(XML_NODE_PROTOTYPE, 'tag', {
  enumerable: true,
  get(this: XmlRuntimeNode) { return this.__xmlTag; },
});
Object.defineProperty(XML_NODE_PROTOTYPE, 'text', {
  enumerable: true,
  get(this: XmlRuntimeNode) { return xmlInnerText(this); },
});
Object.defineProperty(XML_NODE_PROTOTYPE, 'children', {
  enumerable: true,
  get(this: XmlRuntimeNode) {
    const html = this.__xmlHtml;
    return IdylliumArray.from(xmlElementChildren(this), true, null, () => createXmlNode('#document', html));
  },
});
XML_NODE_PROTOTYPE.attr = contextFunction(function (this: XmlRuntimeNode, name: unknown, file: string, line: number) {
  return this.__xmlAttributes.get(xmlSearchName(this, stringArgument(name, 'xml.Node.attr() name', file, line))) ?? '';
});
XML_NODE_PROTOTYPE.has_attr = contextFunction(function (this: XmlRuntimeNode, name: unknown, file: string, line: number) {
  return this.__xmlAttributes.has(xmlSearchName(this, stringArgument(name, 'xml.Node.has_attr() name', file, line)));
});
XML_NODE_PROTOTYPE.find_all = contextFunction(function (this: XmlRuntimeNode, name: unknown, file: string, line: number) {
  const wanted = xmlSearchName(this, stringArgument(name, 'xml.Node.find_all() tag', file, line));
  const html = this.__xmlHtml;
  return IdylliumArray.from(xmlFindAll(this, wanted), true, null, () => createXmlNode('#document', html));
});
XML_NODE_PROTOTYPE.first = contextFunction(function (this: XmlRuntimeNode, name: unknown, file: string, line: number) {
  const wanted = xmlSearchName(this, stringArgument(name, 'xml.Node.first() tag', file, line));
  const found = xmlFindAll(this, wanted);
  if (found.length === 0) {
    throw new IdylliumRuntimeError(file, line, `xml node <${this.__xmlTag}> has no <${wanted}> inside`);
  }
  return found[0];
});
XML_NODE_PROTOTYPE.has = contextFunction(function (this: XmlRuntimeNode, name: unknown, file: string, line: number) {
  return xmlFindAll(this, xmlSearchName(this, stringArgument(name, 'xml.Node.has() tag', file, line))).length > 0;
});
XML_NODE_PROTOTYPE.toString = function (this: XmlRuntimeNode) { return `<${this.__xmlTag}>`; };

export function createXmlNode(tag: string, html: boolean): XmlRuntimeNode {
  const node = Object.create(XML_NODE_PROTOTYPE) as XmlRuntimeNode;
  node.__xmlTag = tag;
  node.__xmlHtml = html;
  node.__xmlAttributes = new Map<string, string>();
  node.__xmlParts = [];
  return node;
}

export function parseXmlDocument(source: string, html: boolean, file: string, line: number): XmlRuntimeNode {
  let index = 0;
  let atLine = 1;
  let atColumn = 1;
  const entry = html ? 'xml.parse_html()' : 'xml.parse_xml()';
  const language = html ? 'HTML' : 'XML';

  const fail = (message: string): never => {
    throw new IdylliumRuntimeError(file, line, `${entry} invalid ${language} at ${atLine}:${atColumn}: ${message}`);
  };
  const advance = (count: number): void => {
    for (let i = 0; i < count; i += 1) {
      if (source[index] === '\n') { atLine += 1; atColumn = 1; } else atColumn += 1;
      index += 1;
    }
  };
  const startsWith = (text: string) => source.startsWith(text, index);
  const skipUntil = (text: string, what: string): void => {
    const end = source.indexOf(text, index);
    if (end < 0) {
      if (html) { advance(source.length - index); return; }
      fail(`${what} is never closed`);
    }
    advance(end + text.length - index);
  };

  const root = createXmlNode('#document', html);
  const stack: XmlRuntimeNode[] = [root];
  const top = () => stack[stack.length - 1];
  const normalize = (name: string) => (html ? name.toLowerCase() : name);

  // Прощающий режим переваривает обрывы: частично скачанная страница из
  // http.get — быт настоящего веба, а не повод уронить программу.
  const readName = (): string | null => {
    const match = /^[^\s/>=]+/.exec(source.slice(index));
    if (!match) {
      if (html) return null;
      fail('expected a name');
    }
    if (!html && !XML_STRICT_NAME.test(match![0])) {
      fail(`'${match![0]}' is not a valid name`);
    }
    advance(match![0].length);
    return match![0];
  };

  const readAttributes = (node: XmlRuntimeNode): void => {
    for (;;) {
      while (/\s/.test(source[index] ?? '')) advance(1);
      if (index >= source.length || startsWith('>') || startsWith('/>')) return;
      if (html && startsWith('/')) { advance(1); continue; }
      const name = readName();
      if (name === null) { advance(1); continue; }
      const normalized = normalize(name);
      let value = '';
      while (/\s/.test(source[index] ?? '')) advance(1);
      if (startsWith('=')) {
        advance(1);
        while (/\s/.test(source[index] ?? '')) advance(1);
        const quote = source[index];
        if (quote === '"' || quote === "'") {
          advance(1);
          const end = source.indexOf(quote, index);
          if (end < 0) {
            if (!html) fail(`attribute '${normalized}' value is never closed`);
            value = decodeXmlEntities(source.slice(index));
            advance(source.length - index);
          } else {
            value = decodeXmlEntities(source.slice(index, end));
            advance(end + 1 - index);
          }
        } else if (html) {
          const match = /^[^\s>]*/.exec(source.slice(index));
          value = decodeXmlEntities(match![0]);
          advance(match![0].length);
        } else {
          fail(`attribute '${normalized}' value must be quoted`);
        }
      }
      if (node.__xmlAttributes.has(normalized)) {
        // Строгий XML не терпит двойных атрибутов; в HTML первый выигрывает.
        if (!html) fail(`duplicate attribute '${normalized}'`);
      } else {
        node.__xmlAttributes.set(normalized, value);
      }
    }
  };

  const pushText = (text: string): void => {
    if (text.trim() === '') return;
    // Well-formedness строгого XML: текст живёт только внутри корневого
    // элемента, «privet, ya ne XML» — не документ.
    if (!html && top() === root) fail('text outside the root element');
    top().__xmlParts.push(text);
  };

  const pushElement = (node: XmlRuntimeNode): void => {
    if (!html && top() === root && root.__xmlParts.some(isXmlRuntimeNode)) {
      fail('XML must have exactly one root element');
    }
    top().__xmlParts.push(node);
  };

  while (index < source.length) {
    if (startsWith('<!--')) { skipUntil('-->', 'comment'); continue; }
    if (startsWith('<![CDATA[')) {
      const end = source.indexOf(']]>', index);
      if (end < 0) {
        if (!html) fail('CDATA section is never closed');
        // Прощающий режим: оборванная CDATA — текст до конца, как комментарий.
        pushText(source.slice(index + 9));
        advance(source.length - index);
        continue;
      }
      pushText(source.slice(index + 9, end));
      advance(end + 3 - index);
      continue;
    }
    if (startsWith('<!')) { skipUntil('>', 'declaration'); continue; }
    if (startsWith('<?')) { skipUntil('?>', 'processing instruction'); continue; }
    if (startsWith('</')) {
      advance(2);
      const name = readName();
      if (name === null) { skipUntil('>', 'closing tag'); continue; }
      const normalized = normalize(name);
      while (/\s/.test(source[index] ?? '')) advance(1);
      if (!startsWith('>')) {
        if (!html) fail(`expected '>' after closing tag '${normalized}'`);
        skipUntil('>', 'closing tag');
      } else {
        advance(1);
      }
      let openIndex = -1;
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].__xmlTag === normalized) { openIndex = i; break; }
      }
      if (openIndex <= 0) {
        if (html) continue; // лишний закрывающий — прощаем
        fail(`closing tag '</${normalized}>' has no opening tag`);
      }
      if (!html && openIndex !== stack.length - 1) {
        fail(`closing tag '</${normalized}>' does not match open tag '<${top().__xmlTag}>'`);
      }
      stack.length = openIndex; // закрывает и всех незакрытых детей (html)
      continue;
    }
    if (startsWith('<')) {
      // В прощающем режиме голый '<', за которым не имя тега, — обычный
      // текст ("a < b" в абзаце), как в настоящем браузере.
      if (html && !/^<[a-zA-Z]/.test(source.slice(index, index + 2))) {
        pushText('<');
        advance(1);
        continue;
      }
      advance(1);
      const name = readName();
      if (name === null) { advance(source.length - index); continue; }
      const normalized = normalize(name);
      const node = createXmlNode(normalized, html);
      readAttributes(node);
      let selfClosed = false;
      if (startsWith('/>')) { advance(2); selfClosed = true; }
      else if (startsWith('>')) advance(1);
      else if (!html) fail(`tag '<${normalized}>' is never closed`);
      // html: страница оборвалась внутри тега — тег считается закрытым.

      if (html && XML_AUTOCLOSE[normalized]) {
        while (XML_AUTOCLOSE[normalized].includes(top().__xmlTag)) stack.length -= 1;
      }
      pushElement(node);
      if (selfClosed || (html && XML_VOID_ELEMENTS.has(normalized))) continue;
      if (html && XML_RAW_TEXT.has(normalized)) {
        const close = new RegExp(`</${normalized}\\s*>`, 'i').exec(source.slice(index));
        const end = close ? index + close.index : source.length;
        node.__xmlParts.push(source.slice(index, end));
        advance((close ? end + close[0].length : source.length) - index);
        continue;
      }
      stack.push(node);
      continue;
    }
    const nextTag = source.indexOf('<', index);
    const end = nextTag < 0 ? source.length : nextTag;
    pushText(decodeXmlEntities(source.slice(index, end)));
    advance(end - index);
  }

  if (stack.length > 1 && !html) fail(`tag '<${top().__xmlTag}>' is never closed`);
  if (!html && !root.__xmlParts.some(isXmlRuntimeNode)) {
    fail('expected a root element');
  }
  return root;
}
