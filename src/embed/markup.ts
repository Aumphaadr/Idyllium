// ─── Embed-юнит: выдача HTML для вставки ───────────────────────────────────
// Две формы одного юнита (спека 02 §2.1):
//  • полная — <script> загрузчика + <idyllium-unit>: умеет звать функции
//    страницы-хозяина и хранит черновик кода у хозяина;
//  • только iframe — для платформ, которые вырезают <script>: весь юнит
//    упакован в адрес после «#», наружу — только postMessage.
// Заготовка кода кладётся в <script type="text/idyllium">: тип браузеру
// неизвестен, поэтому содержимое не исполняется и не требует экранирования
// «<» и «&» — кроме последовательности «</script», которую разбиваем.
import { UnitConfig, encodeUnitForHash, publicUnitConfig } from './unit-model';

export const EMBED_SITE = 'https://aumphaadr.github.io/Idyllium/';

function attribute(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
}

function scriptBody(text: string): string {
  return text.replace(/<\/(script)/giu, '<\\/$1');
}

/** Примерная высота кадра в пикселях — до первого сообщения об автовысоте. */
export function estimateUnitHeight(config: UnitConfig): number {
  const line = Math.round(config.editor.fontSize * 1.4);
  const statement = config.statement.trim() === '' ? 0 : 28 + Math.ceil(config.statement.length / 70) * 22;
  return statement + config.editor.rows * line + config.editor.consoleRows * line + 150;
}

export function renderUnitMarkup(config: UnitConfig, site = EMBED_SITE): string {
  const shared = publicUnitConfig(config);
  const { starter, solution, hooks, ...rest } = shared;
  const lines: string[] = [
    `<script src="${site}embed/idyllium-unit.js" async></script>`,
    '',
  ];
  const hookAttributes = [
    hooks.solved ? ` on-solved="${attribute(hooks.solved)}"` : '',
    hooks.failed ? ` on-failed="${attribute(hooks.failed)}"` : '',
    hooks.check ? ` on-check="${attribute(hooks.check)}"` : '',
  ].join('');
  lines.push(`<idyllium-unit id="${attribute(config.id)}"${hookAttributes}>`);
  lines.push('<script type="text/idyllium">');
  lines.push(scriptBody(starter.replace(/\n$/u, '')));
  lines.push('</script>');
  if (solution.trim() !== '') {
    lines.push('<script type="text/idyllium" data-role="solution">');
    lines.push(scriptBody(solution.replace(/\n$/u, '')));
    lines.push('</script>');
  }
  lines.push('<script type="application/json">');
  lines.push(scriptBody(JSON.stringify(rest, null, 2)));
  lines.push('</script>');
  lines.push('</idyllium-unit>');
  return `${lines.join('\n')}\n`;
}

export function renderUnitIframe(config: UnitConfig, site = EMBED_SITE): string {
  const height = estimateUnitHeight(config);
  const title = attribute(config.title || 'Idyllium');
  return `<iframe src="${site}embed/frame.html#unit=${encodeUnitForHash(config)}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" `
    + `title="${title}" loading="lazy" style="width: 100%; max-width: 900px; height: ${height}px; border: 0; color-scheme: normal;"></iframe>\n`;
}
