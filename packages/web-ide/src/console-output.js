// Панель вывода и статусная строка: печать текста и ANSI, служебные
// строки о предупреждениях и коде завершения.

import { output, status } from './dom.js';
import { appendAnsiText } from './ansi.js';

export function setOutputText(text, className = '', options = {}) {
  output.replaceChildren();
  if (!className) {
    if (options.ansi) {
      appendAnsiText(output, text);
    } else {
      output.textContent = text;
    }
    return;
  }
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  output.appendChild(span);
}

// Предупреждения конца программы — жёлтыми строками после вывода: та же
// роль, что stderr у CLI. Печатает их среда, не программа.
export function appendRuntimeWarnings(runtime) {
  if (!runtime || typeof runtime.collectProgramEndWarnings !== 'function') return;
  try {
    for (const warning of runtime.collectProgramEndWarnings()) {
      appendOutput(warning, 'output-warning');
    }
  } catch (_error) {
    // Предупреждения не смеют ломать завершение программы.
  }
}

// Служебная строка о коде завершения: печатает её среда, а не программа,
// поэтому в вывод программы она не попадает.
export async function appendExitLine(runtime) {
  if (!runtime || typeof runtime.getExitText !== 'function') return;
  const text = await runtime.getExitText();
  if (text === null) return;
  appendOutput(`[Программа завершилась с кодом ${text}]`, 'output-muted');
}

export function appendOutput(text, className = '', options = {}) {
  if (output.textContent) output.appendChild(document.createTextNode('\n'));
  if (!className) {
    if (options.ansi) {
      appendAnsiText(output, text);
    } else {
      output.appendChild(document.createTextNode(text));
    }
    return;
  }
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  output.appendChild(span);
}

export function setStatus(text, isError = false) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('error', isError);
}
