// Единый источник шапки сайта (1.6.3). Спека —
// Idyllium-backstage/tech/spec/some_site_navigation/01 (вердикты владельца 2026-09-25).
//
// Раньше шапка жила в пяти местах и пяти редакциях: раздатка была достижима из
// четырёх разделов из семи, «О проекте» — из четырёх, у справочника было три
// ссылки. Теперь разделы описаны ОДНИМ списком ниже, а разметку шапки для всех
// страниц собирает один генератор; сборщики подставляют её на место маркеров
// `<!-- @site-topbar -->` (документы) или `<!-- @site-brand -->` + `<!-- @site-nav -->`
// (Web IDE со своими кнопками Файл/Правка/Внешний вид); JS-сборщики берут его из
// dist/tools/site-nav.js после tsc. Страж —
// tests/smoke-tooling: из каждого раздела достижим каждый.
//
// Грамматика шапки: слева лого (ведёт в Web IDE) + версия + бейдж раздела;
// в центре — уникальные кнопки раздела (есть только у IDE) и три общих
// дропдауна; справа — главное действие («Открыть IDE» в документах, «Запустить»
// в IDE) и переключатель темы. На узком экране три дропдауна схлопываются в один
// «Разделы» с тем же деревом внутри.
import { iconSvg } from '../src/icons';
import type { IconName } from '../src/icons';

interface SiteSection {
  readonly id: string;
  readonly badge: string;
  /** Значок пункта меню — имя из единого набора (packages/icons). */
  readonly icon?: IconName;
  readonly path: string;
  readonly title: string;
  readonly group?: 'materials' | 'tools' | 'about';
  readonly sidebar?: boolean;
  readonly leading?: boolean;
  readonly stub?: boolean;
  readonly hint?: string;
}

interface ExternalItem {
  readonly title: string;
  readonly href: string;
  readonly hint?: string;
  readonly icon?: IconName;
}

interface NavGroup {
  readonly id: 'materials' | 'tools' | 'about';
  readonly title: string;
}

export interface SiteNavOptions {
  /** Путь до корня сайта с этой страницы: '' у IDE, '../' у разделов. */
  readonly prefix: string;
  readonly version?: string;
  readonly host?: 'ide' | 'docs';
  /** 'button' — «Генератор цвета» открывается на этой же странице (IDE, конструктор); иначе — ссылка в IDE. */
  readonly colorTool?: 'button' | 'link';
}

/** Разделы сайта. `path` — от корня сайта; `group` — дропдаун; `sidebar` — у страницы есть боковая колонка (кнопка-гамбургер). */
export const SITE_SECTIONS: readonly SiteSection[] = [
  { id: 'ide', badge: 'Web IDE', path: '', title: 'Web IDE' },
  { id: 'reference', icon: 'properties', badge: 'Документация', path: 'reference/', title: 'Документация', group: 'materials', sidebar: true, leading: true },
  { id: 'book', icon: 'section-reference', badge: 'Учебник', path: 'book/', title: 'Учебник', group: 'materials', sidebar: true },
  { id: 'tasks', icon: 'section-tasks', badge: 'Задачник', path: 'tasks/', title: 'Задачник', group: 'materials', sidebar: true },
  { id: 'projects', icon: 'section-projects', badge: 'Проекты', path: 'projects/', title: 'Проекты', group: 'materials', sidebar: true },
  { id: 'handouts', icon: 'section-handouts', badge: 'Раздатка', path: 'handouts/', title: 'Файлы для заданий', group: 'materials' },
  { id: 'gui-designer', icon: 'section-designer', badge: 'Конструктор GUI', path: 'gui-designer/', title: 'Конструктор GUI', group: 'tools', hint: 'Собрать окно мышью — получить .idyl' },
  { id: 'recipes', icon: 'section-recipes', badge: 'Рецепты', path: 'recipes/', title: 'Рецепты', group: 'tools', stub: true },
  { id: 'authors', icon: 'section-authors', badge: 'Авторам', path: 'authors/', title: 'Генератор юнитов', hint: 'Встраиваемые задачи для вашего сайта', group: 'tools' },
  { id: 'about', icon: 'info', badge: 'О проекте', path: 'about/', title: 'О проекте', group: 'about' },
  { id: 'why', icon: 'section-why', badge: 'Почему Idyllium', path: 'why/', title: 'Почему Idyllium', group: 'about', stub: true },
];

/** Соседние сайты владельца — в «Инструментах», под своей подписью (вердикт: «они по сути инструменты»). Только опубликованные. */
export const NEIGHBOUR_SITES: readonly ExternalItem[] = [
  { title: 'Кодировки', hint: 'Charsets: починить битый текст, разобраться в таблицах символов', href: 'https://aumphaadr.github.io/Charsets/', icon: 'link' },
  { title: 'Пантограф', hint: 'растровую картинку — в SVG или шрифт', href: 'https://aumphaadr.github.io/Pantograph/', icon: 'link' },
  { title: 'WebGuide', hint: 'интерактивный гайд по CSS', href: 'https://aumphaadr.github.io/WebGuide/', icon: 'link' },
  { title: 'ООМ', hint: 'объектно-ориентированная математика, 3–11 классы', href: 'https://aumphaadr.github.io/OOM/', icon: 'link' },
];

export const GITHUB_URL = 'https://github.com/Aumphaadr/Idyllium';

export const GROUPS: readonly NavGroup[] = [
  { id: 'materials', title: 'Материалы' },
  { id: 'tools', title: 'Инструменты' },
  { id: 'about', title: 'О проекте' },
];

const THEME_TOGGLE_HTML = '<button class="site-theme-toggle" id="theme-toggle" type="button" title="Светлая тема" aria-label="Светлая тема">'
  + iconSvg('sun', { size: 17, className: 'icon-sun' }) + iconSvg('moon', { size: 17, className: 'icon-moon' }) + '</button>';

function escapeHtml(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sectionById(id: string): SiteSection {
  const section = SITE_SECTIONS.find((item) => item.id === id);
  if (!section) throw new Error(`site-nav: unknown section '${id}'`);
  return section;
}

/** Ссылка на раздел с данной страницы: `prefix` — путь до корня сайта ('' у IDE, '../' у разделов). */
function sectionHref(section: SiteSection, prefix: string): string {
  return `${prefix}${section.path}`;
}

/** Слева: лого (в документах — ссылка в IDE; в самой IDE — не ссылка: перезагрузка потеряла бы гостя и остановила программу), версия, бейдж. */
export function siteBrandHtml(sectionId: string, options: SiteNavOptions): string {
  const section = sectionById(sectionId);
  const prefix = options.prefix;
  const version = escapeHtml(options.version || '');
  const inner = `<img class="brand-mark" src="${prefix}assets/idyllium.svg" alt="" width="28" height="28">`
    + '<span class="brand-text">Idyllium</span>'
    + `<span class="idyllium-version" id="version">v${version}</span>`;
  const brand = sectionId === 'ide'
    ? `<span class="brand" title="Вы в Web IDE">${inner}</span>`
    : `<a class="brand" href="${prefix}" title="Открыть Web IDE">${inner}</a>`;
  const hamburger = section.sidebar
    ? `<button class="icon-button menu-toggle" id="menu-toggle" type="button" title="Показать навигацию" aria-label="Показать навигацию">${iconSvg('menu', { size: 18 })}</button>`
    : '';
  return `<div class="topbar-left">${hamburger}${brand}<span class="topbar-badge">${escapeHtml(section.badge)}</span></div>`;
}

/** Значок пункта + текст (подпись и подсказка) — одна разметка у всех пунктов меню. */
function itemBody(icon: IconName | undefined, label: string, hint?: string, trailing = ''): string {
  const iconHtml = icon ? `<span class="site-nav-icon">${iconSvg(icon, { size: 16 })}</span>` : '<span class="site-nav-icon"></span>';
  const hintHtml = hint ? `<small>${escapeHtml(hint)}</small>` : '';
  return `${iconHtml}<span class="site-nav-text"><span class="site-nav-label">${label}${trailing}</span>${hintHtml}</span>`;
}

function menuItem(section: SiteSection, currentId: string, prefix: string, host: 'ide' | 'docs' = 'docs'): string {
  const soon = section.stub ? ' <span class="site-nav-soon" title="Страница в работе">скоро</span>' : '';
  if (section.id === currentId) {
    const check = `<span class="site-nav-current-mark" title="Вы здесь">${iconSvg('check', { size: 14 })}</span>`;
    return `<span class="site-nav-item is-current" role="menuitem" aria-current="page">${itemBody(section.icon, escapeHtml(section.title), section.hint, soon + check)}</span>`;
  }
  // Из Web IDE разделы открываются в новой вкладке — открытый проект остаётся на месте (вердикт владельца 2026-09-26).
  const blank = host === 'ide' ? ' target="_blank" rel="noopener"' : '';
  return `<a class="site-nav-item" role="menuitem" href="${sectionHref(section, prefix)}"${blank}>${itemBody(section.icon, escapeHtml(section.title), section.hint, soon)}</a>`;
}

function externalItem(item: ExternalItem): string {
  const arrow = `<span class="site-nav-ext" aria-hidden="true">${iconSvg('external', { size: 12 })}</span>`;
  return `<a class="site-nav-item is-external" role="menuitem" href="${escapeHtml(item.href)}" target="_blank" rel="noopener">`
    + `${itemBody(item.icon, escapeHtml(item.title), item.hint, ` ${arrow}`)}</a>`;
}

/** «Генератор цвета» — в IDE это панель (открывает её кнопка с прежним id), из документов — ссылка в IDE с открытой панелью. */
function colorToolItem(host: 'ide' | 'docs', prefix: string, colorTool: 'button' | 'link'): string {
  const label = itemBody('palette', 'Генератор цвета', 'RGB, HEX, HSL и пипетка');
  if (colorTool === 'button') {
    return `<button type="button" class="site-nav-item" role="menuitem" id="color-picker-button" aria-haspopup="dialog" aria-expanded="false">${label}</button>`;
  }
  return `<a class="site-nav-item" role="menuitem" href="${prefix}#tool=color">${label}</a>`;
}

const SEPARATOR = '<div class="site-nav-separator" role="separator"></div>';

function groupItems(group: NavGroup, currentId: string, prefix: string, host: 'ide' | 'docs', colorTool: 'button' | 'link'): string {
  const items: string[] = [];
  if (group.id === 'materials') {
    const leading = SITE_SECTIONS.filter((section) => section.group === 'materials' && section.leading);
    const rest = SITE_SECTIONS.filter((section) => section.group === 'materials' && !section.leading);
    items.push(...leading.map((section) => menuItem(section, currentId, prefix, host)));
    items.push(SEPARATOR);
    items.push(...rest.map((section) => menuItem(section, currentId, prefix, host)));
  } else if (group.id === 'tools') {
    items.push(colorToolItem(host, prefix, colorTool));
    items.push(...SITE_SECTIONS.filter((section) => section.group === 'tools').map((section) => menuItem(section, currentId, prefix, host)));
    items.push(SEPARATOR);
    items.push('<div class="site-nav-caption">Соседние сайты</div>');
    items.push(...NEIGHBOUR_SITES.map(externalItem));
  } else {
    items.push(...SITE_SECTIONS.filter((section) => section.group === 'about').map((section) => menuItem(section, currentId, prefix, host)));
    items.push(SEPARATOR);
    items.push(externalItem({ title: 'Исходники на GitHub', href: GITHUB_URL, icon: 'file-code' }));
  }
  return items.join('');
}

/** Три дропдауна + их схлопнутая форма «Разделы» для узкого экрана. `host` — 'ide' | 'docs'. */
export function siteNavHtml(sectionId: string, options: SiteNavOptions): string {
  const current = sectionById(sectionId);
  const prefix = options.prefix;
  const host: 'ide' | 'docs' = options.host || (sectionId === 'ide' ? 'ide' : 'docs');
  const colorTool: 'button' | 'link' = options.colorTool || (host === 'ide' ? 'button' : 'link');
  const groups = GROUPS.map((group) => {
    const here = current.group === group.id ? ' is-here' : '';
    return `<div class="site-nav-group${here}" data-group="${group.id}">`
      + `<button type="button" class="site-nav-button" aria-haspopup="menu" aria-expanded="false">${group.title}</button>`
      + `<div class="site-nav-menu" role="menu" aria-label="${group.title}">${groupItems(group, sectionId, prefix, host, colorTool)}</div>`
      + '</div>';
  }).join('');
  // Схлопнутая форма — то же дерево одним списком: подпись группы, потом её пункты.
  const collapsed = GROUPS.map((group) => `<div class="site-nav-caption">${group.title}</div>${groupItems(group, sectionId, prefix, host, colorTool).replace(/id="color-picker-button"/g, 'data-role="color-picker-button"').replace(/id="/g, 'data-id="')}`).join(SEPARATOR);
  return `<nav class="site-nav" data-host="${host}" aria-label="Разделы сайта">${groups}`
    + '<div class="site-nav-group site-nav-collapsed" data-group="all">'
    + '<button type="button" class="site-nav-button" aria-haspopup="menu" aria-expanded="false">Разделы</button>'
    + `<div class="site-nav-menu" role="menu" aria-label="Разделы сайта">${collapsed}</div>`
    + '</div></nav>';
}

/** Справа у документов: главное действие «Открыть IDE» и переключатель темы. */
export function siteTopbarRightHtml(options: SiteNavOptions): string {
  // На телефоне (≤480 px) подпись укорачивается до «IDE» — иначе шапка не влезает в 360 px.
  return `<div class="topbar-right"><a class="site-action" href="${options.prefix}" title="Открыть Web IDE">`
    + '<span class="site-action-full">Открыть IDE</span><span class="site-action-short">IDE</span></a>'
    + `${THEME_TOGGLE_HTML}</div>`;
}

/** Целая шапка страницы-документа. */
export function siteTopbarHtml(sectionId: string, options: SiteNavOptions): string {
  return `<header class="site-topbar" data-section="${sectionById(sectionId).id}">`
    + siteBrandHtml(sectionId, options)
    + siteNavHtml(sectionId, { prefix: options.prefix, host: 'docs', colorTool: options.colorTool })
    + siteTopbarRightHtml(options)
    + '</header>';
}

/** Ссылки на общие стили и скрипт шапки — в <head> каждой страницы. */
export function siteNavAssetsHtml(prefix: string): string {
  return `<link rel="stylesheet" href="${prefix}assets/site-nav.css">\n  <script src="${prefix}assets/site-nav.js" defer></script>`;
}

/**
 * Подставляет шапку на место маркеров. Документы: `<!-- @site-topbar -->`.
 * IDE: `<!-- @site-brand -->` и `<!-- @site-nav -->` внутри её собственной шапки.
 * Все маркеры документа обязаны быть заменены — иначе страница уехала бы без шапки.
 */
export function injectSiteTopbar(html: string, sectionId: string, options: SiteNavOptions): string {
  let result = html;
  let replaced = 0;
  const swap = (marker: string, replacement: string): void => {
    if (!result.includes(marker)) return;
    result = result.split(marker).join(replacement);
    replaced += 1;
  };
  swap('<!-- @site-topbar -->', siteTopbarHtml(sectionId, options));
  swap('<!-- @site-brand -->', siteBrandHtml(sectionId, options));
  swap('<!-- @site-nav -->', siteNavHtml(sectionId, { prefix: options.prefix, host: options.host }));
  swap('<!-- @site-nav-assets -->', siteNavAssetsHtml(options.prefix));
  if (replaced === 0) throw new Error(`site-nav: no header marker found for section '${sectionId}'`);
  return result;
}
