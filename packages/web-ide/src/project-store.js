// Файлы открытого проекта: путь → элемент ({kind, content} или ассет с
// байтами). Карта одна на всю IDE; ядро наполняет её при загрузке проекта,
// просмотрщики читают. Начальное содержимое — минимальный «Hello, World!».

import { MAIN_FILE } from './workspace-paths.js';

export const files = new Map([
  [MAIN_FILE, {
    kind: 'text',
    content: [
      'use console;',
      '',
      'main() {',
      '    console.write("Hello, World!", \'\\n\');',
      '}',
    ].join('\n'),
  }],
]);
