// Раскраска ANSI-кодов консольного вывода в DOM-узлы панели вывода.

export const ANSI_FOREGROUND_CLASSES = new Map([
  [30, 'ansi-fg-black'],
  [31, 'ansi-fg-red'],
  [32, 'ansi-fg-green'],
  [33, 'ansi-fg-yellow'],
  [34, 'ansi-fg-blue'],
  [35, 'ansi-fg-magenta'],
  [36, 'ansi-fg-cyan'],
  [37, 'ansi-fg-white'],
  [90, 'ansi-fg-bright-black'],
  [91, 'ansi-fg-bright-red'],
  [92, 'ansi-fg-bright-green'],
  [93, 'ansi-fg-bright-yellow'],
  [94, 'ansi-fg-bright-blue'],
  [95, 'ansi-fg-bright-magenta'],
  [96, 'ansi-fg-bright-cyan'],
  [97, 'ansi-fg-bright-white'],
]);

export function appendAnsiText(parent, text) {
  for (const node of ansiTextNodes(String(text))) {
    parent.appendChild(node);
  }
}

export function ansiTextNodes(text) {
  let foregroundClass = '';
  let bold = false;
  let buffer = '';
  const nodes = [];

  const flush = () => {
    if (!buffer) return;
    if (!foregroundClass && !bold) {
      nodes.push(document.createTextNode(buffer));
    } else {
      const span = document.createElement('span');
      span.className = [foregroundClass, bold ? 'ansi-bold' : ''].filter(Boolean).join(' ');
      span.textContent = buffer;
      nodes.push(span);
    }
    buffer = '';
  };

  for (let index = 0; index < text.length;) {
    if (text.charCodeAt(index) !== 27 || text[index + 1] !== '[') {
      buffer += text[index];
      index += 1;
      continue;
    }

    const end = findAnsiEnd(text, index + 2);
    if (end === -1) {
      index += 1;
      continue;
    }

    flush();
    const command = text[end];
    const rawParams = text.slice(index + 2, end);
    const params = rawParams.length === 0 ? [0] : rawParams.split(';').map((part) => Number(part || 0));

    if (command === 'm') {
      for (const param of params) {
        if (param === 0) {
          foregroundClass = '';
          bold = false;
        } else if (param === 1) {
          bold = true;
        } else if (param === 22) {
          bold = false;
        } else if (param === 39) {
          foregroundClass = '';
        } else if (ANSI_FOREGROUND_CLASSES.has(param)) {
          foregroundClass = ANSI_FOREGROUND_CLASSES.get(param);
        }
      }
    } else if (command === 'J' && params.some((param) => param === 2 || param === 3)) {
      nodes.length = 0;
      buffer = '';
    }

    index = end + 1;
  }

  flush();
  return nodes;
}

export function findAnsiEnd(text, start) {
  for (let index = start; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) return index;
  }
  return -1;
}
