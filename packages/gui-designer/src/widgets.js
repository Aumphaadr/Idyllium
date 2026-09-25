'use strict';

// Каталог виджетов «Конструктора GUI» (1.6.3). Истина о свойствах и событиях — реестр языка
// (src/core/stdlib/registry.ts): страж tests/gui-designer сверяет каждое свойство отсюда
// с реестром, требует, чтобы ВСЕ события реестра были в каталоге, и компилирует программу
// с каждым виджетом и каждой заготовкой обработчика. Умолчания размеров — из
// defaultGuiWidgetSize() рантайма (равные умолчанию свойства в код не пишутся).
// CommonJS нарочно: модуль читают и сборка страницы (esbuild), и тесты (node).

/** Ключевые слова языка — именем виджета быть не могут (src/core/tokens.ts). */
const KEYWORDS = new Set([
  'use', 'main', 'function', 'int', 'float', 'string', 'char', 'bool', 'void', 'if', 'else', 'try', 'catch',
  'finally', 'while', 'do', 'for', 'break', 'continue', 'return', 'const', 'and', 'xor', 'or', 'not', 'true',
  'false', 'null', 'div', 'mod', 'array', 'dyn_array', 'map', 'class', 'constructor', 'this', 'static',
  'extends', 'event', 'contract', 'private', 'public',
]);

/** Имена, которые заняты самой программой конструктора или библиотеками. */
const RESERVED_NAMES = new Set(['win', 'gui', 'colors', 'fonts', 'image', 'console', 'math', 'time', 'random']);

const WINDOW_THEMES = ['default', 'idyllium', 'dracula', 'breeze', 'oxygen'];

/** Имена единого набора иконок (сгенерировано tools/build-icons.js) — значения gui.Icon.icon. */
const ICON_NAMES = require('../../icons/icon-names.json');

/** Группы инспектора — в этом порядке они и показываются. Заготовки обработчиков — отдельной группой. */
const PROPERTY_GROUPS = [
  ['geometry', 'Положение и размер'],
  ['text', 'Текст'],
  ['values', 'Значения'],
  ['colors', 'Цвета'],
  ['behaviour', 'Поведение'],
  ['style', 'Стиль (IdySS)'],
];

/** label — русская подсказка при наведении; в инспекторе всегда видно имя свойства. */
const GEOMETRY = [
  { name: 'x', kind: 'int', group: 'geometry', label: 'отступ слева', default: 0 },
  { name: 'y', kind: 'int', group: 'geometry', label: 'отступ сверху', default: 0 },
  { name: 'width', kind: 'int', group: 'geometry', label: 'ширина', min: 1 },
  { name: 'height', kind: 'int', group: 'geometry', label: 'высота', min: 1 },
];

const STYLE_PROPS = [
  { name: 'style', kind: 'string', group: 'style', label: 'стиль IdySS: «свойство: значение; …»' },
  { name: 'style_hover', kind: 'string', group: 'style', label: 'стиль при наведении' },
  { name: 'style_active', kind: 'string', group: 'style', label: 'стиль при нажатии' },
  { name: 'style_disabled', kind: 'string', group: 'style', label: 'стиль выключенного' },
];

/** Шрифт из файла проекта: значение — имя переменной fonts.Font из model.fonts (третий заход). */
const FONT = { name: 'font', kind: 'font', group: 'text', label: 'шрифт из файла (fonts.Font)' };

const COMMON_TAIL = [
  FONT,
  { name: 'hint', kind: 'string', group: 'text', label: 'всплывающая подсказка' },
  { name: 'text_color', kind: 'color', group: 'colors', label: 'цвет текста' },
  { name: 'background_color', kind: 'color', group: 'colors', label: 'цвет фона' },
  { name: 'visible', kind: 'bool', group: 'behaviour', label: 'виден', default: true },
  { name: 'enabled', kind: 'bool', group: 'behaviour', label: 'включён', default: true },
  ...STYLE_PROPS,
];

const FONT_SIZE = { name: 'font_size', kind: 'int', group: 'text', label: 'размер шрифта', min: 1 };
const BORDER_COLOR = { name: 'border_color', kind: 'color', group: 'colors', label: 'цвет рамки' };

const ON_CLICK = { name: 'on_click', params: '', comment: 'что делать при щелчке' };
const ON_CHANGE = (what) => ({ name: 'on_change', params: '', comment: `что делать, когда ${what}` });

/** Данные виджета — то, что задаётся методами, а не свойствами: описание редактора и генерации. */
const DATA_KINDS = {
  // ComboBox: пункты — add_item("…") по одному.
  items: { title: 'Пункты списка', method: 'add_item', field: 'items', shape: 'strings', placeholder: 'пункт' },
  // Table: колонки — set_columns("a", "b"), строки — add_row("x", "y") ровно по числу колонок.
  table: { title: 'Колонки и строки', field: 'table', shape: 'table' },
  // BarChart / PieChart: подпись + число.
  entries: { title: 'Значения', field: 'entries', shape: 'entries' },
  // LineChart: числа по порядку.
  points: { title: 'Точки', method: 'add_value', field: 'points', shape: 'numbers' },
};

function widget(type, label, defaultName, group, size, own, options = {}) {
  return {
    type,
    label,
    defaultName,
    group,
    size,
    icon: options.icon || `widget-${type}`,
    props: [...GEOMETRY, ...own, ...COMMON_TAIL],
    events: options.events || [],
    container: options.container || null,
    data: options.data ? { ...DATA_KINDS[options.data], ...(options.dataOptions || {}) } : null,
    hint: options.hint || '',
  };
}

/** Порядок — порядок в палитре; group — подпись группы палитры. */
const WIDGET_TYPES = [
  widget('Label', 'Надпись', 'label', 'Надписи и кнопки', { width: 120, height: 24 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Надпись' },
    FONT_SIZE,
    { name: 'href', kind: 'string', group: 'text', label: 'ссылка: надпись станет гиперссылкой' },
    BORDER_COLOR,
  ], { events: [ON_CLICK] }),
  widget('Button', 'Кнопка', 'button', 'Надписи и кнопки', { width: 120, height: 32 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Кнопка' },
    FONT_SIZE,
    BORDER_COLOR,
  ], { events: [ON_CLICK] }),
  widget('LineEdit', 'Поле ввода', 'line_edit', 'Ввод', { width: 180, height: 28 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст' },
    { name: 'placeholder', kind: 'string', group: 'text', label: 'подсказка внутри пустого поля' },
    { name: 'echo_mode', kind: 'enum', group: 'values', label: 'показ ввода: обычный, точками, пусто', values: ['normal', 'password', 'no_echo'], default: 'normal' },
    FONT_SIZE,
    BORDER_COLOR,
    { name: 'placeholder_color', kind: 'color', group: 'colors', label: 'цвет подсказки' },
  ], { events: [ON_CHANGE('текст изменился')] }),
  widget('TextEdit', 'Многострочное поле', 'text_edit', 'Ввод', { width: 240, height: 120 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст' },
    { name: 'placeholder', kind: 'string', group: 'text', label: 'подсказка внутри пустого поля' },
    FONT_SIZE,
    BORDER_COLOR,
    { name: 'placeholder_color', kind: 'color', group: 'colors', label: 'цвет подсказки' },
  ], { events: [ON_CHANGE('текст изменился')] }),
  widget('SpinBox', 'Счётчик', 'spin_box', 'Ввод', { width: 100, height: 28 }, [
    { name: 'min', kind: 'int', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'int', group: 'values', label: 'максимум', default: 100 },
    { name: 'value', kind: 'int', group: 'values', label: 'значение', default: 0 },
    { name: 'step', kind: 'int', group: 'values', label: 'шаг', default: 1 },
    FONT_SIZE,
  ], { events: [ON_CHANGE('значение изменилось')] }),
  widget('FloatSpinBox', 'Дробный счётчик', 'float_spin_box', 'Ввод', { width: 120, height: 28 }, [
    { name: 'min', kind: 'float', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'float', group: 'values', label: 'максимум', default: 100 },
    { name: 'value', kind: 'float', group: 'values', label: 'значение', default: 0 },
    { name: 'step', kind: 'float', group: 'values', label: 'шаг', default: 1 },
    FONT_SIZE,
  ], { events: [ON_CHANGE('значение изменилось')] }),
  widget('Slider', 'Ползунок', 'slider', 'Ввод', { width: 200, height: 28 }, [
    { name: 'min', kind: 'int', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'int', group: 'values', label: 'максимум', default: 100 },
    { name: 'value', kind: 'int', group: 'values', label: 'значение', default: 0 },
    { name: 'step', kind: 'int', group: 'values', label: 'шаг', default: 1 },
    { name: 'orientation', kind: 'enum', group: 'values', label: 'ориентация', values: ['horizontal', 'vertical'], default: 'horizontal' },
  ], { events: [ON_CHANGE('ползунок сдвинули')] }),
  widget('CheckBox', 'Флажок', 'check_box', 'Выбор', { width: 180, height: 24 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Флажок' },
    { name: 'is_checked', kind: 'bool', group: 'values', label: 'отмечен', default: false },
    FONT_SIZE,
  ], { events: [ON_CHANGE('флажок переключили')] }),
  widget('RadioButton', 'Переключатель', 'radio_button', 'Выбор', { width: 180, height: 24 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Вариант' },
    { name: 'is_selected', kind: 'bool', group: 'values', label: 'выбран', default: false },
    { name: 'group', kind: 'string', group: 'values', label: 'группа: из одной группы выбран только один' },
    FONT_SIZE,
  ], { events: [ON_CHANGE('вариант выбрали')] }),
  widget('ComboBox', 'Список', 'combo_box', 'Выбор', { width: 180, height: 30 }, [
    { name: 'selected_index', kind: 'int', group: 'values', label: 'номер выбранного пункта (с нуля)', min: 0 },
    FONT_SIZE,
  ], { events: [ON_CHANGE('выбрали пункт')], data: 'items' }),
  widget('ProgressBar', 'Индикатор', 'progress_bar', 'Индикаторы', { width: 200, height: 24 }, [
    { name: 'min', kind: 'int', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'int', group: 'values', label: 'максимум', default: 100 },
    { name: 'value', kind: 'int', group: 'values', label: 'значение', default: 0 },
    { name: 'orientation', kind: 'enum', group: 'values', label: 'ориентация', values: ['horizontal', 'vertical'], default: 'horizontal' },
    FONT_SIZE,
    { name: 'foreground_color', kind: 'color', group: 'colors', label: 'цвет полосы' },
    BORDER_COLOR,
  ]),
  widget('ImageBox', 'Картинка', 'image_box', 'Индикаторы', { width: 160, height: 120 }, [
    { name: 'resize_mode', kind: 'enum', group: 'values', label: 'вписывание: целиком, с обрезкой, растянуть, как есть', values: ['fit', 'fill', 'stretch', 'original'], default: 'fit' },
  ], { hint: 'Картинка задаётся в коде: image_box1.set_image(…)' }),
  widget('Icon', 'Значок', 'icon', 'Индикаторы', { width: 24, height: 24 }, [
    { name: 'icon', kind: 'enum', group: 'values', label: 'имя значка из единого набора сайта', values: ICON_NAMES, default: 'star' },
  ], { icon: 'star', hint: 'Значок вписывается в квадрат по меньшей стороне; цвет — text_color' }),
  widget('Canvas', 'Холст', 'canvas', 'Индикаторы', { width: 300, height: 150 }, [
  ], {
    hint: 'Рисование — в коде: canvas1.draw(…), canvas1.fill(…)',
    events: [
      // Обработчики холста получают сам холст первым параметром — как в уроках раздела «Холст».
      { name: 'on_init', params: 'gui.Canvas canvas', comment: 'нарисовать первый кадр' },
      { name: 'on_update', params: 'gui.Canvas canvas, float delta_time', comment: 'что делать каждый кадр; delta_time — время кадра в секундах' },
      { name: 'on_key_pressed', params: 'gui.Canvas canvas, gui.KeyboardEvent evt', comment: 'клавишу нажали: evt.key' },
      { name: 'on_key_released', params: 'gui.Canvas canvas, gui.KeyboardEvent evt', comment: 'клавишу отпустили: evt.key' },
      { name: 'on_mouse_move', params: 'gui.Canvas canvas, gui.MouseEvent evt', comment: 'мышь двигается: evt.x, evt.y' },
      { name: 'on_mouse_pressed', params: 'gui.Canvas canvas, gui.MouseEvent evt', comment: 'кнопку мыши нажали: evt.x, evt.y' },
      { name: 'on_mouse_released', params: 'gui.Canvas canvas, gui.MouseEvent evt', comment: 'кнопку мыши отпустили: evt.x, evt.y' },
      { name: 'on_mouse_scroll', params: 'gui.Canvas canvas, gui.MouseScrollEvent evt', comment: 'крутят колесо: evt.delta' },
    ],
  }),
  widget('Frame', 'Рамка', 'frame', 'Контейнеры', { width: 220, height: 140 }, [
    { name: 'title', kind: 'string', group: 'text', label: 'заголовок' },
    FONT_SIZE,
    BORDER_COLOR,
    { name: 'border_width', kind: 'int', group: 'values', label: 'толщина рамки', min: 0 },
  ], { container: 'children' }),
  widget('TabWidget', 'Вкладки', 'tabs', 'Контейнеры', { width: 320, height: 200 }, [
    FONT_SIZE,
  ], { container: 'tabs', events: [ON_CHANGE('переключили вкладку')] }),
  widget('Table', 'Таблица', 'table', 'Витрины', { width: 320, height: 200 }, [
    FONT_SIZE,
  ], { events: [{ name: 'on_select', params: '', comment: 'что делать, когда выбрали строку' }], data: 'table' }),
  widget('BarChart', 'Столбцы', 'bar_chart', 'Витрины', { width: 320, height: 220 }, [
    { name: 'min_value', kind: 'float', group: 'values', label: 'низ шкалы' },
    { name: 'max_value', kind: 'float', group: 'values', label: 'верх шкалы' },
    { name: 'show_values', kind: 'bool', group: 'values', label: 'подписывать числа' },
    { name: 'bar_color', kind: 'color', group: 'colors', label: 'цвет столбцов' },
  ], { data: 'entries', dataOptions: { method: 'add_value' } }),
  widget('LineChart', 'График', 'line_chart', 'Витрины', { width: 320, height: 220 }, [
    { name: 'min_value', kind: 'float', group: 'values', label: 'низ шкалы' },
    { name: 'max_value', kind: 'float', group: 'values', label: 'верх шкалы' },
    { name: 'max_points', kind: 'int', group: 'values', label: 'сколько точек держать', min: 1 },
    { name: 'show_dots', kind: 'bool', group: 'values', label: 'рисовать точки' },
    { name: 'line_color', kind: 'color', group: 'colors', label: 'цвет линии' },
  ], { data: 'points' }),
  widget('PieChart', 'Круг', 'pie_chart', 'Витрины', { width: 320, height: 220 }, [
    { name: 'show_legend', kind: 'bool', group: 'values', label: 'показывать легенду' },
    { name: 'show_percents', kind: 'bool', group: 'values', label: 'подписывать проценты' },
  ], { data: 'entries', dataOptions: { method: 'add_slice' } }),
];

/** Страница вкладки — Frame, которого нет в палитре: его создают сами вкладки. */
const TAB_PAGE_TYPE = 'Frame';

const WINDOW_PROPS = [
  { name: 'title', kind: 'string', group: 'text', label: 'заголовок окна' },
  { name: 'width', kind: 'int', group: 'geometry', label: 'ширина', min: 100, default: 640 },
  { name: 'height', kind: 'int', group: 'geometry', label: 'высота', min: 60, default: 420 },
  { name: 'theme', kind: 'enum', group: 'values', label: 'тема оформления окна', values: WINDOW_THEMES, default: 'default' },
  { name: 'font_size', kind: 'int', group: 'text', label: 'размер шрифта (наследуют виджеты)', min: 1, default: 13 },
  FONT,
  { name: 'text_color', kind: 'color', group: 'colors', label: 'цвет текста' },
  { name: 'background_color', kind: 'color', group: 'colors', label: 'цвет фона' },
  ...STYLE_PROPS,
];

const WINDOW_EVENTS = [{ name: 'on_close', params: '', comment: 'что делать, когда окно закрывают' }];

const WIDGETS = Object.fromEntries(WIDGET_TYPES.map((def) => [def.type, def]));

const PALETTE_GROUPS = [...new Set(WIDGET_TYPES.map((def) => def.group))].map((group) => ({
  title: group,
  types: WIDGET_TYPES.filter((def) => def.group === group).map((def) => def.type),
}));

function widgetDefinition(type) {
  const def = WIDGETS[type];
  if (!def) throw new Error(`gui-designer: unknown widget type '${type}'`);
  return def;
}

function propertyOf(type, name) {
  const props = type === 'Window' ? WINDOW_PROPS : widgetDefinition(type).props;
  return props.find((prop) => prop.name === name) || null;
}

function eventsOf(type) {
  return type === 'Window' ? WINDOW_EVENTS : widgetDefinition(type).events;
}

const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_]*$/u;

/** Почему имя не годится — словами (null, если годится). */
function nameProblem(name, takenNames = []) {
  if (typeof name !== 'string' || name.trim() === '') return 'Имя не может быть пустым';
  if (!IDENTIFIER.test(name)) return 'Имя — буквы, цифры и подчёркивание; начинается с буквы';
  if (KEYWORDS.has(name)) return `«${name}» — ключевое слово языка`;
  if (RESERVED_NAMES.has(name)) return `«${name}» занято окном или библиотекой`;
  if (takenNames.includes(name)) return `Имя «${name}» уже есть в макете`;
  return null;
}

/** Свободное имя вида button1, button2… */
function freeName(base, takenNames) {
  let index = 1;
  while (takenNames.includes(`${base}${index}`)) index++;
  return `${base}${index}`;
}

module.exports = {
  FONT,
  ICON_NAMES,
  DATA_KINDS,
  KEYWORDS,
  RESERVED_NAMES,
  WINDOW_THEMES,
  PROPERTY_GROUPS,
  WIDGET_TYPES,
  WIDGETS,
  WINDOW_PROPS,
  WINDOW_EVENTS,
  PALETTE_GROUPS,
  TAB_PAGE_TYPE,
  widgetDefinition,
  propertyOf,
  eventsOf,
  nameProblem,
  freeName,
};
