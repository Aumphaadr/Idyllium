'use strict';

// Каталог виджетов «Конструктора GUI» (1.6.3). Истина о свойствах — реестр языка
// (src/core/stdlib/registry.ts): страж tests/gui-designer сверяет каждое свойство
// отсюда с реестром и компилирует программу с каждым виджетом. Умолчания размеров —
// из defaultGuiWidgetSize() рантайма (равные умолчанию свойства в код не пишутся).
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

/** Группы инспектора — в этом порядке они и показываются. */
const PROPERTY_GROUPS = [
  ['geometry', 'Положение и размер'],
  ['text', 'Текст'],
  ['values', 'Значения'],
  ['colors', 'Цвета'],
  ['behaviour', 'Поведение'],
];

const GEOMETRY = [
  { name: 'x', kind: 'int', group: 'geometry', label: 'x', default: 0 },
  { name: 'y', kind: 'int', group: 'geometry', label: 'y', default: 0 },
  { name: 'width', kind: 'int', group: 'geometry', label: 'ширина', min: 1 },
  { name: 'height', kind: 'int', group: 'geometry', label: 'высота', min: 1 },
];

const COMMON_TAIL = [
  { name: 'hint', kind: 'string', group: 'text', label: 'подсказка (hint)' },
  { name: 'text_color', kind: 'color', group: 'colors', label: 'цвет текста' },
  { name: 'background_color', kind: 'color', group: 'colors', label: 'цвет фона' },
  { name: 'visible', kind: 'bool', group: 'behaviour', label: 'видим (visible)', default: true },
  { name: 'enabled', kind: 'bool', group: 'behaviour', label: 'включён (enabled)', default: true },
];

const FONT_SIZE = { name: 'font_size', kind: 'int', group: 'text', label: 'размер шрифта', min: 1 };
const BORDER_COLOR = { name: 'border_color', kind: 'color', group: 'colors', label: 'цвет рамки' };

function widget(type, label, defaultName, group, size, own, options = {}) {
  return {
    type,
    label,
    defaultName,
    group,
    size,
    props: [...GEOMETRY, ...own, ...COMMON_TAIL],
    events: options.events || [],
    container: options.container || null,
    hint: options.hint || '',
  };
}

/** Порядок — порядок в палитре; group — подпись группы палитры. */
const WIDGET_TYPES = [
  widget('Label', 'Надпись', 'label', 'Надписи и кнопки', { width: 120, height: 24 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Надпись' },
    FONT_SIZE,
    { name: 'href', kind: 'string', group: 'text', label: 'ссылка (href)' },
    BORDER_COLOR,
  ], { events: [{ name: 'on_click', comment: 'что делать при щелчке по надписи' }] }),
  widget('Button', 'Кнопка', 'button', 'Надписи и кнопки', { width: 120, height: 32 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Кнопка' },
    FONT_SIZE,
    BORDER_COLOR,
  ], { events: [{ name: 'on_click', comment: 'что делать при нажатии' }] }),
  widget('LineEdit', 'Поле ввода', 'line_edit', 'Ввод', { width: 180, height: 28 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст' },
    { name: 'placeholder', kind: 'string', group: 'text', label: 'подсказка в поле' },
    { name: 'echo_mode', kind: 'enum', group: 'values', label: 'показ ввода', values: ['normal', 'password', 'no_echo'], default: 'normal' },
    FONT_SIZE,
    BORDER_COLOR,
    { name: 'placeholder_color', kind: 'color', group: 'colors', label: 'цвет подсказки' },
  ], { events: [{ name: 'on_change', comment: 'что делать, когда текст изменился' }] }),
  widget('TextEdit', 'Многострочное поле', 'text_edit', 'Ввод', { width: 240, height: 120 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст' },
    { name: 'placeholder', kind: 'string', group: 'text', label: 'подсказка в поле' },
    FONT_SIZE,
    BORDER_COLOR,
    { name: 'placeholder_color', kind: 'color', group: 'colors', label: 'цвет подсказки' },
  ], { events: [{ name: 'on_change', comment: 'что делать, когда текст изменился' }] }),
  widget('SpinBox', 'Счётчик', 'spin_box', 'Ввод', { width: 100, height: 28 }, [
    { name: 'value', kind: 'int', group: 'values', label: 'значение', default: 0 },
    { name: 'min', kind: 'int', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'int', group: 'values', label: 'максимум', default: 100 },
    { name: 'step', kind: 'int', group: 'values', label: 'шаг', default: 1 },
    FONT_SIZE,
  ], { events: [{ name: 'on_change', comment: 'что делать, когда значение изменилось' }] }),
  widget('FloatSpinBox', 'Дробный счётчик', 'float_spin_box', 'Ввод', { width: 120, height: 28 }, [
    { name: 'value', kind: 'float', group: 'values', label: 'значение', default: 0 },
    { name: 'min', kind: 'float', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'float', group: 'values', label: 'максимум', default: 100 },
    { name: 'step', kind: 'float', group: 'values', label: 'шаг', default: 1 },
    FONT_SIZE,
  ], { events: [{ name: 'on_change', comment: 'что делать, когда значение изменилось' }] }),
  widget('Slider', 'Ползунок', 'slider', 'Ввод', { width: 200, height: 28 }, [
    { name: 'value', kind: 'int', group: 'values', label: 'значение', default: 0 },
    { name: 'min', kind: 'int', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'int', group: 'values', label: 'максимум', default: 100 },
    { name: 'step', kind: 'int', group: 'values', label: 'шаг', default: 1 },
    { name: 'orientation', kind: 'enum', group: 'values', label: 'ориентация', values: ['horizontal', 'vertical'], default: 'horizontal' },
  ], { events: [{ name: 'on_change', comment: 'что делать, когда ползунок сдвинули' }] }),
  widget('CheckBox', 'Флажок', 'check_box', 'Выбор', { width: 180, height: 24 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Флажок' },
    { name: 'is_checked', kind: 'bool', group: 'values', label: 'отмечен', default: false },
    FONT_SIZE,
  ], { events: [{ name: 'on_change', comment: 'что делать, когда флажок переключили' }] }),
  widget('RadioButton', 'Переключатель', 'radio_button', 'Выбор', { width: 180, height: 24 }, [
    { name: 'text', kind: 'string', group: 'text', label: 'текст', initial: 'Вариант' },
    { name: 'is_selected', kind: 'bool', group: 'values', label: 'выбран', default: false },
    { name: 'group', kind: 'string', group: 'values', label: 'группа' },
    FONT_SIZE,
  ], { events: [{ name: 'on_change', comment: 'что делать, когда вариант выбрали' }] }),
  widget('ComboBox', 'Список', 'combo_box', 'Выбор', { width: 180, height: 30 }, [
    FONT_SIZE,
  ], { events: [{ name: 'on_change', comment: 'что делать, когда выбрали пункт' }], hint: 'Пункты списка добавляются в коде: combo_box1.add_item("…")' }),
  widget('ProgressBar', 'Индикатор', 'progress_bar', 'Индикаторы', { width: 200, height: 24 }, [
    { name: 'value', kind: 'int', group: 'values', label: 'значение', default: 0 },
    { name: 'min', kind: 'int', group: 'values', label: 'минимум', default: 0 },
    { name: 'max', kind: 'int', group: 'values', label: 'максимум', default: 100 },
    { name: 'orientation', kind: 'enum', group: 'values', label: 'ориентация', values: ['horizontal', 'vertical'], default: 'horizontal' },
    FONT_SIZE,
    { name: 'foreground_color', kind: 'color', group: 'colors', label: 'цвет полосы' },
    BORDER_COLOR,
  ]),
  widget('ImageBox', 'Картинка', 'image_box', 'Индикаторы', { width: 160, height: 120 }, [
    { name: 'resize_mode', kind: 'enum', group: 'values', label: 'вписывание', values: ['fit', 'fill', 'stretch', 'original'], default: 'fit' },
  ], { hint: 'Картинка задаётся в коде: image_box1.set_image(…)' }),
  widget('Canvas', 'Холст', 'canvas', 'Индикаторы', { width: 300, height: 150 }, [
  ], { hint: 'Рисование — в коде: canvas1.draw(…), canvas1.fill(…)' }),
  widget('Frame', 'Рамка', 'frame', 'Контейнеры', { width: 220, height: 140 }, [
    { name: 'title', kind: 'string', group: 'text', label: 'заголовок' },
    FONT_SIZE,
    BORDER_COLOR,
    { name: 'border_width', kind: 'int', group: 'values', label: 'толщина рамки', min: 0 },
  ], { container: 'children' }),
  widget('TabWidget', 'Вкладки', 'tabs', 'Контейнеры', { width: 320, height: 200 }, [
    FONT_SIZE,
  ], { container: 'tabs', events: [{ name: 'on_change', comment: 'что делать, когда переключили вкладку' }] }),
];

/** Страница вкладки — Frame, которого нет в палитре: его создают сами вкладки. */
const TAB_PAGE_TYPE = 'Frame';

const WINDOW_PROPS = [
  { name: 'title', kind: 'string', group: 'text', label: 'заголовок' },
  { name: 'width', kind: 'int', group: 'geometry', label: 'ширина', min: 100, default: 640 },
  { name: 'height', kind: 'int', group: 'geometry', label: 'высота', min: 60, default: 420 },
  { name: 'theme', kind: 'enum', group: 'values', label: 'тема', values: WINDOW_THEMES, default: 'default' },
  { name: 'font_size', kind: 'int', group: 'text', label: 'размер шрифта', min: 1 },
  { name: 'text_color', kind: 'color', group: 'colors', label: 'цвет текста' },
  { name: 'background_color', kind: 'color', group: 'colors', label: 'цвет фона' },
];

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
  KEYWORDS,
  RESERVED_NAMES,
  WINDOW_THEMES,
  PROPERTY_GROUPS,
  WIDGET_TYPES,
  WIDGETS,
  WINDOW_PROPS,
  PALETTE_GROUPS,
  TAB_PAGE_TYPE,
  widgetDefinition,
  propertyOf,
  nameProblem,
  freeName,
};
