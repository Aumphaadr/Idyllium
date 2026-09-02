// Однопроходная подсветка Idyllium для легаси-редактора (без Monaco):
// словари токенов и превращение исходника в HTML со span-раскраской.

export const KEYWORDS = new Set([
  'and', 'break', 'catch', 'class', 'const', 'constructor', 'continue', 'do', 'else', 'event', 'extends',
  'false', 'finally', 'for', 'function', 'if', 'not', 'or', 'parent', 'private', 'public', 'return', 'static',
  'this', 'true', 'null', 'try', 'use', 'while', 'xor',
]);
export const BUILTIN_TYPES = new Set([
  'array', 'bool', 'char', 'dyn_array', 'float', 'int', 'set', 'string', 'void',
]);
export const CLASS_NAMES = new Set([
  'Array', 'BarChart', 'Button', 'Canvas', 'CheckBox', 'Circle', 'Color', 'ComboBox', 'Drawable', 'FloatSpinBox', 'Font', 'Frame',
  'Animation', 'Bitmap', 'Image', 'ImageBox', 'KeyboardEvent', 'Label', 'Line', 'LineChart', 'LineEdit', 'Modal', 'MouseEvent', 'MouseScrollEvent', 'Music',
  'Database', 'Node', 'Object', 'PieChart', 'Post', 'ProgressBar', 'RadioButton', 'Rectangle', 'Request', 'Response', 'Result', 'Server',
  'Slider', 'Sound', 'SpinBox', 'Sprite', 'Statement', 'Static', 'TabWidget', 'Table', 'Text', 'TextEdit', 'Timer', 'Turtle', 'Value', 'Vector', 'Widget', 'Window',
]);
export const QUALIFIED_TYPES = new Set([
  ...CLASS_NAMES,
  'float32', 'float64', 'int8', 'int16', 'int32', 'int64',
  'istream', 'ostream', 'stamp', 'stream', 'uint8', 'uint16', 'uint32', 'uint64',
]);

export function highlightIdyllium(source) {
  let html = '';
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const comment = /^\/\/[^\n]*/u.exec(rest);
    if (comment) {
      html += span('tok-comment', comment[0]);
      index += comment[0].length;
      continue;
    }

    const string = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/u.exec(rest);
    if (string) {
      html += span('tok-string', string[0]);
      index += string[0].length;
      continue;
    }

    const number = /^\b\d+(?:\.\d+)?\b/u.exec(rest);
    if (number) {
      html += span('tok-number', number[0]);
      index += number[0].length;
      continue;
    }

    const member = /^(\.)([A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*)/u.exec(rest);
    if (member) {
      html += escapeHtml(member[1]) + span('tok-property', member[2]);
      index += member[0].length;
      continue;
    }

    const identifier = /^[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*/u.exec(rest);
    if (identifier) {
      const word = identifier[0];
      const afterWord = source.slice(index + word.length);
      const beforeWord = source.slice(0, index);
      const isDeclaredClass = /\b(?:class|extends)\s*$/u.test(beforeWord);
      const isTypePosition = /^[A-ZА-ЯЁ]/u.test(word)
        && /^\s+[A-Za-z_А-Яа-яЁё][A-Za-z0-9_А-Яа-яЁё]*\s*(?:[=;,)\[]|$)/u.test(afterWord);
      if (KEYWORDS.has(word)) {
        html += span('tok-keyword', word);
      } else if (BUILTIN_TYPES.has(word) || CLASS_NAMES.has(word) || QUALIFIED_TYPES.has(word) || isDeclaredClass || isTypePosition) {
        html += span('tok-type', word);
      } else if (/^\s*\(/u.test(afterWord)) {
        html += span('tok-function', word);
      } else {
        html += escapeHtml(word);
      }
      index += word.length;
      continue;
    }

    html += escapeHtml(source[index]);
    index++;
  }
  return html.endsWith('\n') ? html + ' ' : html;
}

export function span(className, text) {
  return '<span class="' + className + '">' + escapeHtml(text) + '</span>';
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
