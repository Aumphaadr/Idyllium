const fs: any = require('fs');
const path: any = require('path');
const nodeCrypto: any = require('crypto');

import { buildReferenceSite } from './docs-build-reference';
import { SITE_SECTIONS, injectSiteTopbar, siteNavAssetsHtml, siteTopbarHtml } from './site-nav';
import { iconSvg, isIconName } from '../src/icons';

/** Версия сайта — из package.json (единственный источник версии). Уходит в шапку каждой страницы. */
const SITE_VERSION = String(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version);
import { KEYWORDS } from '../src/core/tokens';
import { createDefaultStandardLibrary } from '../src/core/stdlib/registry';

interface OldLessonsJson {
  readonly sections: readonly OldSection[];
}

interface OldSection {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly lessons: readonly OldLessonRef[];
}

interface OldLessonRef {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly subtitle?: string;
}

interface SiteManifest {
  readonly version: 1;
  readonly generatedAt: string;
  readonly sourceRoot: string;
  readonly sections: SiteSection[];
}

interface SiteSection {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly status: 'ready' | 'planned';
  readonly lessons: SiteLesson[];
}

interface SiteLesson {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly file: string;
  readonly sourceFile: string;
  readonly status: 'ready' | 'needs-review' | 'planned' | 'missing-source';
  readonly reviewFlags: readonly string[];
  /** Есть ли для темы испечённый практикум в «Задачнике». */
  hasTasks?: boolean;
}

interface ManualLesson {
  readonly sectionId: string;
  readonly afterLessonId?: string;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sourceFile: string;
  readonly status: 'ready' | 'needs-review' | 'planned';
  readonly reviewFlags: readonly string[];
}

const DEFAULT_SOURCE_ROOT = path.resolve(process.cwd(), 'packages/docs');
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'docs');
const MANAGED_PATHS = [
  'index.html',
  'app.css',
  'app.js',
  'ai',
  'assets',
  'fonts',
  'monaco',
  'vendor',
  'gui-renderer',
  'gui-preview.html',
  'embed',
  'authors',
  'book',
  'tasks',
  'projects',
  'handouts',
  'about',
  'recipes',
  'why',
  'gui-designer',
  'reference',
  'ide',
  'docs',
  'content',
  'favicon.png',
  'lessons.json',
  'version.js',
  'version.json',
  '404.html',
  '.nojekyll',
];

const SECTION_RENAMES: Record<string, { readonly id: string; readonly title: string; readonly icon: string }> = {
  console: { id: 'console', title: 'Консоль', icon: 'section-console' },
  widgets: { id: 'widgets', title: 'Виджеты', icon: 'section-widgets' },
  oop: { id: 'oop', title: 'ООП', icon: 'section-oop' },
};

const SLUG_OVERRIDES: Record<string, string> = {
  'cli/007_math.html': 'math-basics',
  'cli/025_math.html': 'math-advanced',
};

// Turtle между GUI и ООП (владелец, 2026-08-07): передышка-геометрия после
// виджетов, а «каждая черепаха — объект» готовит почву для ООП.
const SECTION_ORDER = ['console', 'widgets', 'turtle', 'oop', 'canvas', 'json', 'sqlite', 'network'];

const MANUAL_LESSONS: readonly ManualLesson[] = [
  {
    sectionId: 'console',
    // После циклов и time: ученик уже успел «нахвататься шишек» со случайно
    // изменёнными переменными, а впереди массивы, где const-размеры сразу
    // пригодятся. Раньше стоял после variables и выглядел «урезанной
    // переменной без пользы». Урок time стоит сразу после циклов (владелец:
    // пусть дети наиграются с time.sleep() в циклах), константы — за ним.
    afterLessonId: 'time',
    id: 'constants',
    title: 'Именованные константы',
    subtitle: 'Значения, которым программа не даст случайно измениться',
    sourceFile: 'packages/docs/manual-content/console/constants.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    // Вторая половина бывшего урока types (пожелание владельца 2026-07-24):
    // первый урок — ограниченные типы, переполнение, bin/hex; второй — сдвиги
    // и битовые логические операции.
    afterLessonId: 'types',
    id: 'bit-operations',
    title: 'Битовые операции',
    subtitle: 'Сдвиги, маски и четыре логические операции над битами',
    sourceFile: 'packages/docs/manual-content/console/bit-operations.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    afterLessonId: 'matrix',
    id: 'recursion',
    title: 'Рекурсия',
    subtitle: 'Функция, которая вызывает саму себя и умеет вовремя остановиться',
    sourceFile: 'packages/docs/manual-content/console/recursion.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    afterLessonId: 'errors',
    id: 'try-catch',
    title: 'Обработка ошибок',
    subtitle: 'try, catch и finally: как встретить runtime error и продолжить работу',
    sourceFile: 'packages/docs/manual-content/console/try-catch.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    afterLessonId: 'files',
    id: 'directories',
    title: 'Файлы и папки проекта',
    subtitle: 'Создание, просмотр, копирование, переименование и безопасное удаление',
    sourceFile: 'packages/docs/manual-content/console/directories.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    // Вердикт владельца 2026-09-25: после семи уроков ручной сборки виджетов, перед Slider;
    // урок необязательный — учитель вправе оставить группу на ручном создании виджетов.
    sectionId: 'widgets',
    afterLessonId: 'spinbox',
    id: 'gui-designer',
    title: 'Конструктор GUI',
    subtitle: 'Окно собирается мышью, код пишется сам — а обработчики по-прежнему ваши',
    sourceFile: 'packages/docs/manual-content/widgets/gui-designer.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'progressbar',
    id: 'colors',
    title: 'Цвета виджетов',
    subtitle: 'text_color, background_color, border_color и библиотека colors без HEX-угадаек',
    sourceFile: 'packages/docs/manual-content/widgets/colors.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'colors',
    id: 'fonts',
    title: 'Шрифты в GUI',
    subtitle: 'fonts.Font, наследование от окна и один ресурс для нескольких виджетов',
    sourceFile: 'packages/docs/manual-content/widgets/fonts.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'lineedit',
    id: 'image',
    title: 'Картинки в GUI',
    subtitle: 'image.Static, image.Animation, ImageBox и преобразования картинок',
    sourceFile: 'packages/docs/manual-content/widgets/image.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    // IdySS-урок пораньше (владелец, 2026-07-24): после ImageBox и перед
    // CheckBox — впереди ещё половина раздела, где стили можно применять.
    afterLessonId: 'image',
    id: 'styles',
    title: 'Стили IdySS',
    subtitle: 'Idyllium Style Sheets: наклейка style, словарь свойств и градиенты',
    sourceFile: 'packages/docs/manual-content/widgets/styles.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    // Гиперссылки после стилей: ссылку сразу приятно приодеть через IdySS,
    // а url.open() даёт первый выход программы во внешний мир.
    afterLessonId: 'styles',
    id: 'links',
    title: 'Гиперссылки',
    subtitle: 'Надпись-ссылка, url.open() и разбор адреса на части',
    sourceFile: 'packages/docs/manual-content/widgets/links.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'visibility',
    id: 'audio',
    title: 'Работа со звуками',
    subtitle: 'audio.Sound, audio.Music и первые звуки в GUI-приложении',
    sourceFile: 'packages/docs/manual-content/widgets/audio.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    // Вкладки после звуков и перед массивами виджетов (владелец, 2026-07-30):
    // к этому моменту уже пройден gui.Frame, без которого класть во вкладку
    // нечего, а массивы виджетов идут следом и вкладок ещё не требуют.
    // Якорь 'audio' объявлен выше — иначе урок уехал бы в начало раздела.
    afterLessonId: 'audio',
    id: 'tabwidget',
    title: 'Вкладки',
    subtitle: 'gui.TabWidget: add_tab, selected_index и много виджетов на одном месте',
    sourceFile: 'packages/docs/manual-content/widgets/tabwidget.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    // Таймер пораньше (владелец, 2026-08-04): сразу после видимости и перед
    // звуками, а не в самом конце раздела. Запись обрабатывается ПОСЛЕ
    // audio/tabwidget, поэтому вставка «после visibility» встаёт перед audio.
    afterLessonId: 'visibility',
    id: 'timer',
    title: 'Объект Timer',
    subtitle: 'Выполнение кода через равные промежутки времени',
    sourceFile: 'packages/docs/manual-content/widgets/timer.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    // Факультатив (владелец, 2026-08-08): витрины применяются не каждой
    // группой — ставим предпоследним, после модальных окон и перед
    // «Типичными ошибками».
    afterLessonId: 'modal',
    id: 'data-widgets',
    title: 'Витрины данных',
    subtitle: 'Факультатив: gui.Table и графики — таблица, столбики, пирог и живая линия',
    sourceFile: 'packages/docs/manual-content/widgets/data-widgets.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'intro',
    title: 'Знакомство с черепахой',
    subtitle: 'turtle.Turtle, forward и left: первая фигура за пять строк',
    sourceFile: 'packages/docs/manual-content/turtle/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'pen',
    title: 'Перо и скорость',
    subtitle: 'pen_up/pen_down, цвет и толщина пера, speed, кляксы и команды поля',
    sourceFile: 'packages/docs/manual-content/turtle/pen.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'shapes',
    title: 'Углы и многоугольники',
    subtitle: 'Внешний угол, формула 360/n и звезда, которую рисует цикл',
    sourceFile: 'packages/docs/manual-content/turtle/shapes.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'coordinates',
    title: 'Координаты поля',
    subtitle: 'goto и home: центр (0, 0), ось Y вверх — как на уроке математики',
    sourceFile: 'packages/docs/manual-content/turtle/coordinates.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'fill',
    title: 'Заливка и узоры',
    subtitle: 'begin_fill/end_fill, функции-фигуры и розетка из 36 квадратов',
    sourceFile: 'packages/docs/manual-content/turtle/fill.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'turtles',
    title: 'Несколько черепах',
    subtitle: 'Каждая черепаха — объект: парное рисование и великие гонки',
    sourceFile: 'packages/docs/manual-content/turtle/turtles.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'turtle',
    id: 'svg',
    title: 'Векторная картинка SVG',
    subtitle: 'save_svg: рисунок уезжает в файл — даже из консольной программы',
    sourceFile: 'packages/docs/manual-content/turtle/svg.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'oop',
    // Контракты после this (владелец, 2026-08-21): equals требует «метода
    // с параметром и return» — этот урок и вводит их, разгружая модули;
    // наследование контрактов обсуждается позже, в уроке наследования.
    afterLessonId: 'this',
    id: 'contracts',
    title: 'Методы-контракты',
    subtitle: 'Методы с параметрами, договор equals для == и to_string для печати',
    sourceFile: 'packages/docs/manual-content/oop/contracts.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'oop',
    // «Сделай свою кнопку»: события в конце ООП, когда пройдены классы,
    // методы, конструкторы и наследование; перед каталогом ошибок.
    afterLessonId: 'static',
    id: 'events',
    title: 'Свои события',
    subtitle: 'event, подписка и запуск: механизм кнопок теперь в ваших классах',
    sourceFile: 'packages/docs/manual-content/oop/events.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'intro',
    title: 'Первый Canvas',
    subtitle: 'Холст как виджет и первый нарисованный круг',
    sourceFile: 'packages/docs/manual-content/canvas/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'drawable',
    title: 'Drawable-объекты',
    subtitle: 'Rectangle, Circle, Line и их основные свойства',
    sourceFile: 'packages/docs/manual-content/canvas/drawable.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'update',
    title: 'Однократные и повторяющиеся действия',
    subtitle: 'on_init, on_update и framerate_limit',
    sourceFile: 'packages/docs/manual-content/canvas/update.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'keyboard',
    title: 'События клавиатуры',
    subtitle: 'on_key_pressed и on_key_released на простом примере',
    sourceFile: 'packages/docs/manual-content/canvas/keyboard.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'pressed-keys',
    title: 'Плавное движение',
    subtitle: 'Массив зажатых клавиш и движение в on_update',
    sourceFile: 'packages/docs/manual-content/canvas/pressed-keys.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'mouse-buttons',
    title: 'Кнопки мыши',
    subtitle: 'on_mouse_pressed, on_mouse_released и координаты клика',
    sourceFile: 'packages/docs/manual-content/canvas/mouse-buttons.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'mouse-motion',
    title: 'Движение мыши и колесо',
    subtitle: 'on_mouse_move, on_mouse_scroll и простая реакция объектов',
    sourceFile: 'packages/docs/manual-content/canvas/mouse-motion.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'modules',
    title: 'Разделение проекта на файлы',
    subtitle: 'Canvas-код отдельно, главный файл отдельно',
    sourceFile: 'packages/docs/manual-content/canvas/modules.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'text',
    title: 'Шрифт и текст',
    subtitle: 'fonts.Font, drawable.Text и координаты курсора',
    sourceFile: 'packages/docs/manual-content/canvas/text.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'sprites',
    title: 'Картинки и спрайты',
    subtitle: 'image.Static, image.Animation, Sprite и управление по WASD',
    sourceFile: 'packages/docs/manual-content/canvas/sprites.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'object-arrays',
    title: 'Массивы объектов',
    subtitle: 'Несколько Rectangle-объектов и метод rotate()',
    sourceFile: 'packages/docs/manual-content/canvas/object-arrays.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'origin',
    title: 'Точка отсчёта и вращение',
    subtitle: 'Origin, движение по окружности, синус и косинус',
    sourceFile: 'packages/docs/manual-content/canvas/origin.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'temporary-objects',
    title: 'Временные объекты',
    subtitle: 'tmp, dyn_array и круги, появляющиеся по клику',
    sourceFile: 'packages/docs/manual-content/canvas/temporary-objects.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    afterLessonId: 'temporary-objects',
    id: 'audio',
    title: 'Звуки и музыка',
    subtitle: 'Sound, Music, loop, position и on_finished в Canvas-проектах',
    sourceFile: 'packages/docs/manual-content/canvas/audio.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'rectangle-hit-test',
    title: 'Точка в прямоугольной области',
    subtitle: 'Левый, правый, верхний и нижний край',
    sourceFile: 'packages/docs/manual-content/canvas/rectangle-hit-test.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'circle-hit-test',
    title: 'Точка в круглой области',
    subtitle: 'Расстояние до центра и теорема Пифагора',
    sourceFile: 'packages/docs/manual-content/canvas/circle-hit-test.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'circle-collisions',
    title: 'Круглые коллизии',
    subtitle: 'Когда два круга касаются друг друга',
    sourceFile: 'packages/docs/manual-content/canvas/circle-collisions.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'rectangle-collisions',
    title: 'Прямоугольные коллизии',
    subtitle: 'Алгоритм опровержения касания прямоугольников',
    sourceFile: 'packages/docs/manual-content/canvas/rectangle-collisions.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'geometry-methods',
    title: 'Готовые геометрические проверки',
    subtitle: 'contains(), collides_with(), повороты и разные типы объектов',
    sourceFile: 'packages/docs/manual-content/canvas/geometry-methods.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'intro',
    title: 'Работа с файлами: повторение',
    subtitle: 'Зачем вообще понадобился JSON, если у нас уже есть file',
    sourceFile: 'packages/docs/manual-content/json/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'first-object',
    title: 'Первый JSON-объект',
    subtitle: 'Ключи, значения, json.Object и json.Value',
    sourceFile: 'packages/docs/manual-content/json/first-object.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'reading',
    title: 'Чтение JSON-данных',
    subtitle: 'parse, get, to_int, to_string и проверка типов',
    sourceFile: 'packages/docs/manual-content/json/reading.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'arrays',
    title: 'JSON-массивы',
    subtitle: 'Списки значений внутри JSON',
    sourceFile: 'packages/docs/manual-content/json/arrays.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'nested-objects',
    title: 'Вложенные объекты',
    subtitle: 'Объект как значение другого объекта',
    sourceFile: 'packages/docs/manual-content/json/nested-objects.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'object-arrays',
    title: 'Массивы объектов',
    subtitle: 'Несколько игроков в одном JSON-файле',
    sourceFile: 'packages/docs/manual-content/json/object-arrays.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'array-methods',
    title: 'Методы массивов',
    subtitle: 'length, at, add, set, insert, pop, remove, clear',
    sourceFile: 'packages/docs/manual-content/json/array-methods.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'object-methods',
    title: 'Методы объектов',
    subtitle: 'length, has, get, add, set, remove, keys',
    sourceFile: 'packages/docs/manual-content/json/object-methods.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'oop',
    title: 'JSON и ООП',
    subtitle: 'Методы to_json и from_json у собственного класса',
    sourceFile: 'packages/docs/manual-content/json/oop.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'errors',
    title: 'Типичные ошибки',
    subtitle: 'Невалидный JSON, лишние запятые, комментарии и неверные типы',
    sourceFile: 'packages/docs/manual-content/json/errors.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'intro',
    title: 'Первая база данных',
    subtitle: 'Файл базы, таблица players и первое подключение через sqlite.open()',
    sourceFile: 'packages/docs/manual-content/sqlite/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'changes',
    title: 'Таблицы и первые записи',
    subtitle: 'INSERT, UPDATE, DELETE и количество изменённых строк',
    sourceFile: 'packages/docs/manual-content/sqlite/changes.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'select',
    title: 'Чтение строк',
    subtitle: 'SELECT, sqlite.Result, next() и типизированные методы чтения',
    sourceFile: 'packages/docs/manual-content/sqlite/select.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'parameters',
    title: 'Безопасные параметры',
    subtitle: 'prepare(), :name и bind() вместо склеивания SQL-строк',
    sourceFile: 'packages/docs/manual-content/sqlite/parameters.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'filters',
    title: 'Поиск и фильтрация',
    subtitle: 'WHERE, AND, ORDER BY, LIMIT и параметры в SELECT',
    sourceFile: 'packages/docs/manual-content/sqlite/filters.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'null',
    title: 'Неизвестные значения и null',
    subtitle: 'Пустое значение в таблице, sqlite.Value и безопасная проверка',
    sourceFile: 'packages/docs/manual-content/sqlite/null.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'reuse',
    title: 'Много записей одним запросом',
    subtitle: 'Повторное использование Statement внутри цикла',
    sourceFile: 'packages/docs/manual-content/sqlite/reuse.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'transactions',
    title: 'Всё или ничего',
    subtitle: 'Транзакции, commit(), rollback() и целостность данных',
    sourceFile: 'packages/docs/manual-content/sqlite/transactions.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'scripts',
    title: 'SQL в отдельном файле',
    subtitle: 'read_all(), exec_script() и проект из нескольких файлов',
    sourceFile: 'packages/docs/manual-content/sqlite/scripts.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'select-tools',
    title: 'Все строки и краткая статистика',
    subtitle: 'SELECT *, DISTINCT, агрегатные функции и GROUP BY',
    sourceFile: 'packages/docs/manual-content/sqlite/select-tools.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'defaults',
    title: 'Повторный запуск и значения по умолчанию',
    subtitle: 'IF NOT EXISTS, IF EXISTS и DEFAULT',
    sourceFile: 'packages/docs/manual-content/sqlite/defaults.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'keys',
    title: 'Ключи и уникальные значения',
    subtitle: 'PRIMARY KEY, AUTOINCREMENT и UNIQUE',
    sourceFile: 'packages/docs/manual-content/sqlite/keys.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    // Хеши — в поздний курс (решение владельца, 2026-07-26): к этому моменту
    // у ученика есть encoding, files, types и базы — можно рассказывать
    // всерьёз, с исторической вставкой про сломанные MD5/SHA-1.
    afterLessonId: 'keys',
    id: 'hashing',
    title: 'Хеширование',
    subtitle: 'Отпечатки данных, контрольные суммы и пароли, которых никто не знает',
    sourceFile: 'packages/docs/manual-content/sqlite/hashing.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'joins',
    title: 'Связи между таблицами',
    subtitle: 'FOREIGN KEY, JOIN, псевдонимы таблиц и LEFT JOIN',
    sourceFile: 'packages/docs/manual-content/sqlite/joins.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'errors',
    title: 'Типичные ошибки',
    subtitle: 'Непривязанные параметры, неверные методы чтения и отсутствующие колонки',
    sourceFile: 'packages/docs/manual-content/sqlite/errors.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'network',
    id: 'http-client',
    title: 'Сеть: программа ходит в интернет',
    subtitle: 'http.get, статусы ответа, JSON по сети и страховка try/catch',
    sourceFile: 'packages/docs/manual-content/network/http-client.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'network',
    afterLessonId: 'http-client',
    id: 'channel',
    title: 'Почтовый канал: две программы разговаривают',
    subtitle: 'channel.Post, письма между вкладками, протокол на JSON',
    sourceFile: 'packages/docs/manual-content/network/channel.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'network',
    afterLessonId: 'channel',
    id: 'web-server',
    title: 'Свой сервер',
    subtitle: 'web.Server: маршруты, query, JSON-API, статика и вечный run()',
    sourceFile: 'packages/docs/manual-content/network/web-server.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'network',
    afterLessonId: 'web-server',
    id: 'web-templates',
    title: 'Сайт из шаблонов',
    subtitle: 'send_template, {{дырки}} и {% for %}, параметры пути, формы и redirect',
    sourceFile: 'packages/docs/manual-content/network/web-templates.html',
    status: 'ready',
    reviewFlags: [],
  },
];

const LESSON_EXTRAS: Record<string, string> = {};

const LESSON_REPLACEMENTS: Record<string, string> = {
  'cli/000_setup.html': 'packages/docs/manual-content/console/setup.html',
  'cli/001_hello.html': 'packages/docs/manual-content/console/hello.html',
  'cli/002_variables.html': 'packages/docs/manual-content/console/variables.html',
  'cli/003_input.html': 'packages/docs/manual-content/console/input.html',
  'cli/004_arithmetics.html': 'packages/docs/manual-content/console/arithmetics.html',
  'cli/005_colors.html': 'packages/docs/manual-content/console/colors.html',
  'cli/006_transforms.html': 'packages/docs/manual-content/console/transforms.html',
  'cli/007_math.html': 'packages/docs/manual-content/console/math-basics.html',
  'cli/008_if.html': 'packages/docs/manual-content/console/if.html',
  'cli/009_increment.html': 'packages/docs/manual-content/console/increment.html',
  'cli/010_random.html': 'packages/docs/manual-content/console/random.html',
  'cli/011_bool.html': 'packages/docs/manual-content/console/bool.html',
  'cli/012_loops.html': 'packages/docs/manual-content/console/loops.html',
  'cli/013_array.html': 'packages/docs/manual-content/console/array.html',
  'cli/014_char.html': 'packages/docs/manual-content/console/char.html',
  'cli/015_dyn_array.html': 'packages/docs/manual-content/console/dyn-array.html',
  'cli/016_arr_functions.html': 'packages/docs/manual-content/console/arr-functions.html',
  'cli/017_arr_methods.html': 'packages/docs/manual-content/console/arr-methods.html',
  'cli/018_string_methods.html': 'packages/docs/manual-content/console/string-methods.html',
  'cli/019_time.html': 'packages/docs/manual-content/console/time.html',
  'cli/020_types.html': 'packages/docs/manual-content/console/types.html',
  'cli/021_encoding.html': 'packages/docs/manual-content/console/encoding.html',
  'cli/022_functions.html': 'packages/docs/manual-content/console/functions.html',
  'cli/023_libs.html': 'packages/docs/manual-content/console/libs.html',
  'cli/024_files.html': 'packages/docs/manual-content/console/files.html',
  'cli/025_math.html': 'packages/docs/manual-content/console/math-advanced.html',
  'cli/026_matrix.html': 'packages/docs/manual-content/console/matrix.html',
  'cli/027_errors.html': 'packages/docs/manual-content/console/errors.html',
  'widgets/000_window.html': 'packages/docs/manual-content/widgets/window.html',
  'widgets/001_button.html': 'packages/docs/manual-content/widgets/button.html',
  'widgets/002_label.html': 'packages/docs/manual-content/widgets/label.html',
  'widgets/003_progressbar.html': 'packages/docs/manual-content/widgets/progressbar.html',
  'widgets/004_spinbox.html': 'packages/docs/manual-content/widgets/spinbox.html',
  'widgets/005_slider.html': 'packages/docs/manual-content/widgets/slider.html',
  'widgets/006_lineedit.html': 'packages/docs/manual-content/widgets/lineedit.html',
  'widgets/007_checkbox.html': 'packages/docs/manual-content/widgets/checkbox.html',
  'widgets/008_radiobutton.html': 'packages/docs/manual-content/widgets/radiobutton.html',
  'widgets/009_frame.html': 'packages/docs/manual-content/widgets/frame.html',
  'widgets/010_combobox.html': 'packages/docs/manual-content/widgets/combobox.html',
  'widgets/011_visibility.html': 'packages/docs/manual-content/widgets/visibility.html',
  'widgets/012_arrays.html': 'packages/docs/manual-content/widgets/arrays.html',
  'widgets/013_sender.html': 'packages/docs/manual-content/widgets/sender.html',
  'widgets/014_timer.html': 'packages/docs/manual-content/widgets/timer.html',
  'widgets/015_modal.html': 'packages/docs/manual-content/widgets/modal.html',
  'widgets/016_errors.html': 'packages/docs/manual-content/widgets/errors.html',
  'oop/000_intro.html': 'packages/docs/manual-content/oop/intro.html',
  'oop/001_classes.html': 'packages/docs/manual-content/oop/classes.html',
  'oop/002_fields_methods.html': 'packages/docs/manual-content/oop/fields-methods.html',
  'oop/003_this.html': 'packages/docs/manual-content/oop/this.html',
  'oop/004_modules.html': 'packages/docs/manual-content/oop/modules.html',
  'oop/005_arrays.html': 'packages/docs/manual-content/oop/arrays.html',
  'oop/007_composition.html': 'packages/docs/manual-content/oop/composition.html',
  'oop/008_inheritance.html': 'packages/docs/manual-content/oop/inheritance.html',
  'oop/010_encapsulation.html': 'packages/docs/manual-content/oop/encapsulation.html',
  'oop/011_static.html': 'packages/docs/manual-content/oop/static.html',
  'oop/012_errors.html': 'packages/docs/manual-content/oop/errors.html',
  'oop/006_constructor.html': 'packages/docs/manual-content/oop/constructor.html',
  'oop/009_polymorphism.html': 'packages/docs/manual-content/oop/polymorphism.html',
};

/**
 * AI-справки — рукописный ВХОД в packages/docs/ai/ (с 2026-08-29 вход и
 * выход docs/ разведены); чисто механические перечни в главных файлах
 * освежаются из реестра стандартной библиотеки между якорями @generated
 * (первый — перечень имён модулей в Reserved Names: он тихо протухал —
 * web/http/channel/xml когда-то в него не попали). Источник правится НА
 * МЕСТЕ, затем весь каталог публикуется в docs/ai (managed). Полноту
 * рукописной части стережёт tests/ai-reference-guard.
 */
function refreshAiReferenceGeneratedBlocks(siteRoot: string): void {
  const aiSourceRoot = path.resolve(process.cwd(), 'packages', 'docs', 'ai');
  for (const relative of ['idyllium-ai-reference.md', 'ru/idyllium-ai-reference.md']) {
    refreshAiReferenceFile(path.join(aiSourceRoot, ...relative.split('/')));
  }
  fs.cpSync(aiSourceRoot, path.join(siteRoot, 'ai'), { recursive: true });
}

function refreshAiReferenceFile(referencePath: string): void {
  if (!fs.existsSync(referencePath)) {
    throw new Error(`AI reference does not exist: ${referencePath}`);
  }
  const { createDefaultStandardLibrary } = require('../src/index');
  const registry = createDefaultStandardLibrary();
  const moduleNames = registry.listModuleSpecs()
    .map((module: { name: string }) => module.name)
    .sort((left: string, right: string) => left.localeCompare(right));
  const wrapped: string[] = [];
  let line = '';
  for (const name of moduleNames) {
    if (line && (line + ' ' + name).length > 71) {
      wrapped.push(line);
      line = name;
    } else {
      line = line ? `${line} ${name}` : name;
    }
  }
  if (line) wrapped.push(line);

  const source = fs.readFileSync(referencePath, 'utf8');
  const begin = '<!-- @generated:stdlib-module-names -->';
  const end = '<!-- /@generated:stdlib-module-names -->';
  const beginIndex = source.indexOf(begin);
  const endIndex = source.indexOf(end);
  if (beginIndex < 0 || endIndex <= beginIndex) {
    throw new Error('AI reference lost the @generated:stdlib-module-names anchors');
  }
  const replacement = `${begin}\n\`\`\`text\n${wrapped.join('\n')}\n\`\`\`\n${end}`;
  const updated = source.slice(0, beginIndex) + replacement + source.slice(endIndex + end.length);
  if (updated !== source) fs.writeFileSync(referencePath, updated, 'utf8');
}

function main(): void {
  const sourceRoot = path.resolve(readArg('--source') ?? DEFAULT_SOURCE_ROOT);
  const siteRoot = path.resolve(readArg('--out') ?? DEFAULT_OUTPUT_ROOT);
  const bookRoot = path.join(siteRoot, 'book');
  const lessonsRoot = path.join(sourceRoot, 'lessons');
  const lessonsJsonPath = path.join(lessonsRoot, 'lessons.json');

  if (!fs.existsSync(lessonsJsonPath)) {
    throw new Error(`old lessons.json does not exist: ${lessonsJsonPath}`);
  }

  prepareOutput(siteRoot);
  copyWebIde(siteRoot);
  writeLegacyIdeRedirect(siteRoot);
  writeSite404(siteRoot);
  copyBookShell(bookRoot);
  copyAssets(sourceRoot, bookRoot);

  const oldLessons = JSON.parse(fs.readFileSync(lessonsJsonPath, 'utf8')) as OldLessonsJson;
  const convertedSections = oldLessons.sections.map((section) => convertSection(section, lessonsRoot, bookRoot));
  const manifest: SiteManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: normalizePath(path.relative(process.cwd(), sourceRoot)) || '.',
    sections: orderedSections(withManualLessons(convertedSections, bookRoot)),
  };

  // «Задачник» строится по той же карте, что и учебник: одинаковые разделы,
  // одинаковые перечни тем. Заодно проставляет hasTasks в манифест учебника —
  // по нему урок решает, вести ли кнопке «Открыть задачи» на живую страницу.
  const practicumCount = buildTasksSite(path.join(siteRoot, 'tasks'), manifest);
  const projectCount = buildProjectsSite(path.join(siteRoot, 'projects'));

  fs.writeFileSync(path.join(bookRoot, 'lessons.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const handoutCount = buildHandoutsPage(path.join(siteRoot, 'handouts'));

  buildAboutPage(path.join(siteRoot, 'about'), { manifest, practicumCount, projectCount, handoutCount });
  buildStubPages(siteRoot, SITE_VERSION);

  const bookShell = injectSiteTopbar(fs.readFileSync(path.resolve(process.cwd(), 'packages', 'docs-book', 'index.html'), 'utf8'), 'book', { prefix: '../', version: SITE_VERSION });
  const bookPages = bakeCleanUrlPages(bookShell, bookRoot, manifest, 'Учебник Idyllium');
  console.log(`book clean URLs: ${bookPages} pages`);

  buildReferenceSite(path.join(siteRoot, 'reference'));

  refreshAiReferenceGeneratedBlocks(siteRoot);

  const lessonCount = manifest.sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const needsReview = manifest.sections.flatMap((section) => section.lessons).filter((lesson) => lesson.status === 'needs-review').length;
  console.log(`book generated: ${manifest.sections.length} sections, ${lessonCount} lessons`);
  console.log(`needs review: ${needsReview}`);
  console.log(`site output: ${siteRoot}`);
}

const TASKS_SOURCE_ROOT = 'packages/docs/manual-content/tasks';

/**
 * Собирает «Задачник» — сайт-близнец учебника по адресу /tasks/.
 *
 * Оболочка не копируется, а ссылается на файлы учебника (../book/app.js и
 * компанию): разметка страницы у них одна и та же, и разъезжаться ей незачем.
 * Содержимое берётся из packages/docs/manual-content/tasks/<раздел>/<урок>.html —
 * обычных HTML-фрагментов, которые правятся руками так же, как уроки.
 */
function buildTasksSite(tasksRoot: string, manifest: SiteManifest): number {
  fs.mkdirSync(tasksRoot, { recursive: true });

  const sections: SiteSection[] = [];
  let ready = 0;

  for (const section of manifest.sections) {
    const lessons: SiteLesson[] = [];

    for (const lesson of section.lessons) {
      const sourceFile = `${TASKS_SOURCE_ROOT}/${section.id}/${lesson.id}.html`;
      const sourcePath = path.resolve(process.cwd(), sourceFile);
      const hasTasks = fs.existsSync(sourcePath);

      const outputFile = `content/${section.id}/${lesson.id}.html`;
      const outputPath = path.join(tasksRoot, outputFile);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, hasTasks
        ? fs.readFileSync(sourcePath, 'utf8')
        : pendingTasksFragment(section.id, lesson.id, lesson.title), 'utf8');

      (lesson as { hasTasks?: boolean }).hasTasks = hasTasks;
      if (hasTasks) ready++;

      lessons.push({
        id: lesson.id,
        title: lesson.title,
        subtitle: hasTasks ? `Практикум к уроку «${lesson.title}»` : 'Задания готовятся',
        file: outputFile,
        sourceFile: hasTasks ? sourceFile : '',
        status: hasTasks ? 'ready' : 'planned',
        reviewFlags: [],
        hasTasks,
      });
    }

    sections.push({ id: section.id, title: section.title, icon: section.icon, status: 'ready', lessons });
  }

  const tasksManifest: SiteManifest = {
    version: 1,
    generatedAt: manifest.generatedAt,
    sourceRoot: TASKS_SOURCE_ROOT,
    sections,
  };

  fs.writeFileSync(path.join(tasksRoot, 'lessons.json'), `${JSON.stringify(tasksManifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(tasksRoot, 'index.html'), tasksShell(), 'utf8');
  const tasksPages = bakeCleanUrlPages(tasksShell(), tasksRoot, tasksManifest, 'Задачник Idyllium');
  console.log(`tasks clean URLs: ${tasksPages} pages`);

  const total = sections.reduce((sum, section) => sum + section.lessons.length, 0);
  console.log(`tasks generated: ${ready} practicums out of ${total} topics`);
  return ready;
}

/**
 * Печёт настоящую страницу на каждый урок: <root>/<раздел>/<урок>.html.
 *
 * GitHub Pages отдаёт «file.html» и по адресу без расширения, поэтому
 * /book/console/setup — реальный файл, HTTP 200, без решётки и без слэша
 * на конце. Внутри страницы <base href="../"> — все относительные пути
 * оболочки (lessons.json, content/…, app.js) продолжают работать, а
 * заголовок и описание урока достаются поисковикам без исполнения JS.
 */
function bakeCleanUrlPages(
  shellHtml: string,
  siteDir: string,
  manifest: SiteManifest,
  titleSuffix: string,
): number {
  // Разделы делят каталог с файлами оболочки — имена не должны столкнуться.
  const reserved = new Set(['content', 'assets', 'fonts', 'monaco', 'vendor', 'index', 'app']);
  let count = 0;

  for (const section of manifest.sections) {
    if (reserved.has(section.id)) {
      throw new Error(`section id '${section.id}' clashes with a shell file — cannot bake clean URLs`);
    }
    for (const lesson of section.lessons) {
      const title = `${lesson.title} — ${titleSuffix}`;
      const description = lesson.subtitle ? `\n  <meta name="description" content="${escapeHtml(lesson.subtitle)}">` : '';
      if (!shellHtml.includes('<base href="./">')) {
        throw new Error('shell must carry <base href="./"> — baked pages retarget it to "../"');
      }
      const page = shellHtml
        .replace('<base href="./">', '<base href="../">')
        .replace(/<title>[^<]*<\/title>/u, `<title>${escapeHtml(title)}</title>${description}`);

      const outputPath = path.join(siteDir, section.id, `${lesson.id}.html`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, page, 'utf8');
      count++;
    }
  }

  return count;
}

/**
 * Раздатка: страница с ассетами для заданий и кнопками скачивания.
 *
 * Живёт по нарочно непубличному адресу /handouts/ — в навигацию площадок не
 * выводится (только скромные ссылки из сайдбаров задачника и учебника) и
 * закрыта от поисковиков noindex-ом. Файлы и опись лежат в
 * packages/docs/handouts; страница генерируется отсюда целиком.
 */
/**
 * Печёт страницу раздатки: вкладки по типам файлов, внутри — подзаголовки.
 *
 * Манифест (packages/docs/handouts/handouts.json) описывает вкладки и
 * подгруппы; пустые подгруппы просто не попадают в вёрстку, поэтому новый
 * тип файлов появляется на странице сразу, как только его туда положат.
 * Поиск и переключение вкладок — на инлайновом скрипте: страница обязана
 * работать сама по себе, без сборщиков и внешних зависимостей.
 */
/**
 * Переключатель темы для страниц без app.js учебника: ключ хранилища и класс те же, что
 * в packages/docs-book/app.js, поэтому выбор ученика переезжает между разделами сайта.
 */
const SITE_THEME_SCRIPT = `  <script>
    (function () {
      var KEY = 'idyllium-docs-theme';
      function apply(light) {
        document.body.classList.toggle('light-theme', light);
        var toggle = document.getElementById('theme-toggle');
        if (toggle) {
          var hint = light ? 'Тёмная тема' : 'Светлая тема';
          toggle.title = hint;
          toggle.setAttribute('aria-label', hint);
        }
      }
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (error) {}
      apply(saved === 'light');
      var toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('click', function onToggle() {
          var next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
          try { localStorage.setItem(KEY, next); } catch (error) {}
          apply(next === 'light');
        });
      }
    })();
  </script>`;

function buildHandoutsPage(outputRoot: string): number {
  const handoutsVersion = String(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version);
  const sourceRoot = path.resolve(process.cwd(), 'packages', 'docs', 'handouts');
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'handouts.json'), 'utf8')) as {
    readonly categories: readonly {
      readonly id: string;
      readonly title: string;
      readonly icon: string;
      readonly groups: readonly {
        readonly title: string;
        readonly items: readonly { readonly file: string; readonly note: string; readonly license?: string }[];
      }[];
    }[];
  };

  fs.mkdirSync(path.join(outputRoot, 'files'), { recursive: true });
  // Отпечатки раздатки — для «проекта в ссылке» (1.6.1): в ссылке едет только
  // опись нетекстовых файлов (имя, размер, начало SHA-256), а Web IDE получателя
  // по отпечатку находит файл здесь и скачивает его с нашего же сайта. Ученик
  // мог файл переименовать — отпечатку всё равно.
  const fingerprints: Record<string, { file: string; size: number }> = {};
  for (const entry of fs.readdirSync(sourceRoot).sort()) {
    if (entry === 'handouts.json') continue;
    fs.copyFileSync(path.join(sourceRoot, entry), path.join(outputRoot, 'files', entry));
    const bytes = fs.readFileSync(path.join(sourceRoot, entry));
    const sha = nodeCrypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    if (!fingerprints[sha]) fingerprints[sha] = { file: entry, size: bytes.length };
  }
  fs.writeFileSync(path.join(outputRoot, 'fingerprints.json'), `${JSON.stringify(fingerprints)}\n`, 'utf8');

  const sizeLabel = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${bytes} Б`;
  };

  // Значок вкладки: имя из набора (handouts.json) или, для чужих манифестов, текст как есть.
  const categoryIcon = (icon: string): string => (isIconName(icon) ? iconSvg(icon, { size: 18 }) : escapeHtml(icon));

  const thumbFor = (file: string, href: string): string => {
    if (/\.(png|gif|jpe?g|svg)$/iu.test(file)) return `<img class="thumb" src="${href}" alt="" loading="lazy">`;
    if (/\.(mp3|wav|ogg)$/iu.test(file)) {
      return `<button type="button" class="thumb thumb-icon thumb-audio" data-audio="${href}" data-name="${escapeHtml(file)}" title="Прослушать" aria-label="Прослушать ${escapeHtml(file)}">`
        + iconSvg('play', { size: 22, className: 'icon-play' })
        + iconSvg('pause', { size: 22, className: 'icon-pause' })
        + '</button>';
    }
    // Значок по типу файла — из единого набора сайта.
    const icon = /\.ttf$/iu.test(file) ? 'file-font'
      : /\.json$/iu.test(file) ? 'file-json'
        : /\.(db|sqlite3?|sql)$/iu.test(file) ? 'file-database'
          : /\.zip$/iu.test(file) ? 'file-archive'
            : 'file-text';
    return `<span class="thumb thumb-icon">${iconSvg(icon, { size: 28 })}</span>`;
  };

  let total = 0;
  const tabs: string[] = [];
  const panels: string[] = [];

  for (const category of manifest.categories) {
    const groups = category.groups.filter((group) => group.items.length > 0);
    if (groups.length === 0) continue;

    const count = groups.reduce((sum, group) => sum + group.items.length, 0);
    total += count;

    tabs.push(`      <button type="button" class="tab" data-tab="${escapeHtml(category.id)}" role="tab" aria-selected="false">`
      + `<span class="tab-icon">${categoryIcon(category.icon)}</span>${escapeHtml(category.title)}`
      + `<span class="tab-count">${count}</span></button>`);

    const groupsHtml = groups.map((group) => {
      const rows = group.items.map((item) => {
        const filePath = path.join(sourceRoot, item.file);
        if (!fs.existsSync(filePath)) throw new Error(`handout is missing: ${item.file}`);
        const size = sizeLabel(fs.statSync(filePath).size);
        const href = `files/${encodeURIComponent(item.file)}`;
        const license = item.license
          ? ` <a class="license" href="files/${encodeURIComponent(item.license)}" download>лицензия</a>`
          : '';
        const search = `${item.file} ${item.note}`.toLowerCase();
        return `        <li data-search="${escapeHtml(search)}">
          ${thumbFor(item.file, href)}
          <div class="meta">
            <div class="name">${escapeHtml(item.file)} <span class="size">${size}</span>${license}</div>
            <div class="note">${escapeHtml(item.note)}</div>
          </div>
          <a class="download" href="${href}" download>Скачать</a>
        </li>`;
      }).join('\n');
      const heading = group.title ? `      <h3>${escapeHtml(group.title)}</h3>\n` : '';
      return `${heading}      <ul>\n${rows}\n      </ul>`;
    }).join('\n');

    panels.push(`    <section class="panel" id="tab-${escapeHtml(category.id)}" role="tabpanel" hidden>
      <h2><span class="tab-icon">${categoryIcon(category.icon)}</span> ${escapeHtml(category.title)}</h2>
${groupsHtml}
    </section>`);
  }

  const page = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Файлы для заданий — Idyllium</title>
  <link rel="icon" type="image/png" href="../book/favicon.png">
  <link rel="stylesheet" href="../book/fonts/fonts.css">
  ${siteNavAssetsHtml('../')}
  <link rel="stylesheet" href="../book/app.css">
  <style>
    * { box-sizing: border-box; }
    /* Цвета, шапка, тема и полосы прокрутки — общие с учебником (../book/app.css): страница раньше
       жила со своей зашитой тёмной палитрой, без шапки и без светлой темы (находка владельца, 1.6.2). */
    body { margin: 0; background: var(--bg-root); color: var(--text-main);
      font: 17px/1.6 "Geologica", system-ui, sans-serif; }
    /* Раскладка (вердикт владельца 2026-09-25): разделы — в боковой колонке слева, вся середина — спискам. */
    main { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 34px; align-items: start;
      max-width: 1440px; margin: 0 auto; padding: 26px 24px 60px; }
    .handouts-side { position: sticky; top: calc(var(--topbar-height) + 16px); display: grid; gap: 12px; }
    .handouts-main { min-width: 0; }
    h1 { margin: 0 0 6px; font-size: 30px; }
    .lead { margin: 0 0 10px; color: var(--text-soft); font-size: 15px; }
    .search { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px;
      background: var(--bg-panel); color: var(--text-main); font: 15px "Geologica", system-ui, sans-serif; }
    .search::placeholder { color: var(--text-muted); }
    .search:focus { outline: none; border-color: var(--accent); }
    .tabs { display: grid; gap: 4px; }
    .tab { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px;
      border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--text-soft);
      font: 700 15px "Geologica", system-ui, sans-serif; text-align: left; cursor: pointer; }
    .tab:hover { border-color: var(--border); background: var(--bg-panel); color: var(--text-main); }
    .tab[aria-selected="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text-main); }
    .tab-icon { display: inline-flex; flex: 0 0 auto; color: var(--text-muted); }
    .tab[aria-selected="true"] .tab-icon { color: var(--accent); }
    .tab-icon svg { display: block; }
    .tab-count { margin-left: auto; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft);
      color: var(--accent); font-size: 13px; }
    @media (max-width: 960px) {
      main { grid-template-columns: 1fr; gap: 16px; }
      .handouts-side { position: static; }
      .tabs { display: flex; flex-wrap: wrap; }
      .tab { width: auto; }
    }
    h2 { margin: 0 0 12px; padding: 8px 16px; border-left: 4px solid var(--accent);
      border-radius: 10px; background: linear-gradient(90deg, var(--accent-soft), transparent 82%);
      font-size: 21px; }
    h3 { margin: 24px 0 10px; color: var(--accent); font-size: 16px; text-transform: uppercase;
      letter-spacing: 0.06em; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    li { display: flex; align-items: center; gap: 14px; padding: 10px 14px;
      border: 1px solid var(--border); border-radius: 12px; background: var(--bg-panel); }
    .thumb { width: 56px; height: 56px; flex: none; object-fit: contain;
      border-radius: 8px; background: var(--bg-code); }
    .thumb-icon { display: grid; place-items: center; color: var(--accent); font-size: 20px; font-weight: 700; }
    .meta { min-width: 0; flex: 1; }
    .name { font-weight: 700; overflow-wrap: anywhere; }
    .size { margin-left: 6px; color: var(--text-muted); font-size: 13px; font-weight: 400; }
    .license { margin-left: 8px; color: var(--text-muted); font-size: 13px; }
    .note { color: var(--text-soft); font-size: 15px; }
    .download { flex: none; padding: 8px 16px; border: 1px solid var(--accent); border-radius: 999px;
      color: var(--accent); font-weight: 800; font-size: 14px; text-decoration: none; }
    .download:hover { background: var(--accent); color: var(--bg-root); }
    .thumb-audio { border: 1px solid var(--border); cursor: pointer; color: var(--accent); padding: 0; }
    .thumb-audio:hover { border-color: var(--accent); background: var(--accent-soft); }
    .thumb-audio svg { width: 26px; height: 26px; fill: currentColor; }
    .thumb-audio .icon-pause { display: none; }
    .thumb-audio.playing .icon-play { display: none; }
    .thumb-audio.playing .icon-pause { display: block; }
    .audio-dock { position: fixed; right: 18px; bottom: 18px; z-index: 20; display: none;
      align-items: center; gap: 10px; max-width: min(94vw, 540px); padding: 10px 14px;
      border: 1px solid var(--border); border-radius: 14px; background: var(--bg-panel);
      box-shadow: var(--shadow); }
    .audio-dock.open { display: flex; }
    .dock-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: var(--text-main); font-size: 13px; font-weight: 700; }
    .dock-time { flex: none; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
    .audio-dock input[type="range"] { accent-color: var(--accent); }
    .dock-seek { width: 130px; }
    .dock-volume { width: 64px; }
    .dock-close { flex: none; border: none; background: none; color: var(--text-muted); font-size: 16px; cursor: pointer; }
    .dock-close:hover { color: var(--text-main); }
    .empty { display: none; margin: 30px 0; color: var(--text-muted); }
    body.searching .tab-count { opacity: 0.4; }
    .footnote { margin-top: 36px; color: var(--text-muted); font-size: 14px; }
    .footnote a { color: var(--accent); }
  </style>
</head>
<body>
${siteTopbarHtml('handouts', { prefix: '../', version: handoutsVersion })}
  <main>
    <aside class="handouts-side" aria-label="Разделы раздатки">
      <div>
        <h1>Файлы для заданий</h1>
        <p class="lead">Раздатка задачника: картинки, звуки, шрифты и данные, которые просят скачать задания. Кладите скачанный файл рядом с программой (в Web IDE — загрузите в проект).</p>
      </div>
      <input type="search" class="search" id="search" placeholder="Поиск: «гильдия», «.json»…" aria-label="Поиск файлов">
      <div class="tabs" role="tablist">
${tabs.join('\n')}
      </div>
    </aside>
    <div class="handouts-main">
    <p class="empty" id="empty">Ничего не нашлось. Попробуйте другое слово или выберите вкладку.</p>
${panels.join('\n')}
    <p class="footnote">Музыка — Kevin MacLeod (<a href="https://incompetech.com" rel="noopener">incompetech.com</a>), лицензия CC BY 4.0. Шрифты — SIL Open Font License (текст лицензии рядом с каждым шрифтом). Остальные материалы созданы командой Idyllium.</p>
  </div>
  </main>
  <div class="audio-dock" id="audio-dock" aria-label="Аудиоплеер">
    <span class="dock-name" id="dock-name"></span>
    <span class="dock-time" id="dock-time">0:00</span>
    <input type="range" class="dock-seek" id="dock-seek" min="0" max="100" step="0.1" value="0" aria-label="Перемотка">
    <span class="dock-time" id="dock-duration">0:00</span>
    <input type="range" class="dock-volume" id="dock-volume" min="0" max="1" step="0.01" value="1" aria-label="Громкость">
    <button type="button" class="dock-close" id="dock-close" title="Остановить и закрыть" aria-label="Остановить и закрыть">${iconSvg('close', { size: 16 })}</button>
  </div>
  <script>
    (function () {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
      var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
      var search = document.getElementById('search');
      var empty = document.getElementById('empty');

      function showTab(id) {
        var found = false;
        tabs.forEach(function (tab) {
          var active = tab.dataset.tab === id;
          if (active) found = true;
          tab.setAttribute('aria-selected', String(active));
        });
        panels.forEach(function (panel) { panel.hidden = panel.id !== 'tab-' + id; });
        return found;
      }

      function applySearch() {
        var query = search.value.trim().toLowerCase();
        document.body.classList.toggle('searching', query !== '');
        if (!query) {
          empty.style.display = 'none';
          var selected = tabs.filter(function (tab) { return tab.getAttribute('aria-selected') === 'true'; })[0];
          panels.forEach(function (panel) { panel.hidden = true; });
          Array.prototype.forEach.call(document.querySelectorAll('.panel li, .panel h3, .panel ul'), function (node) {
            node.style.display = '';
          });
          showTab(selected ? selected.dataset.tab : tabs[0].dataset.tab);
          return;
        }
        // Во время поиска показываем совпадения СРАЗУ ПО ВСЕМ вкладкам:
        // искать файл, помня, в какой он категории, — лишняя работа для глаз.
        var matches = 0;
        panels.forEach(function (panel) {
          var visibleInPanel = 0;
          Array.prototype.forEach.call(panel.querySelectorAll('li'), function (item) {
            var hit = (item.dataset.search || '').indexOf(query) !== -1;
            item.style.display = hit ? '' : 'none';
            if (hit) { visibleInPanel++; matches++; }
          });
          Array.prototype.forEach.call(panel.querySelectorAll('ul'), function (list) {
            var anyVisible = Array.prototype.some.call(list.querySelectorAll('li'), function (item) {
              return item.style.display !== 'none';
            });
            list.style.display = anyVisible ? '' : 'none';
            var heading = list.previousElementSibling;
            if (heading && heading.tagName === 'H3') heading.style.display = anyVisible ? '' : 'none';
          });
          panel.hidden = visibleInPanel === 0;
        });
        empty.style.display = matches === 0 ? 'block' : 'none';
      }

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          search.value = '';
          applySearch();
          showTab(tab.dataset.tab);
          // Ссылка вида /handouts#json ведёт прямо на нужную вкладку —
          // задания ссылаются на раздатку адресно.
          history.replaceState(null, '', '#' + tab.dataset.tab);
        });
      });
      search.addEventListener('input', applySearch);

      function openFromHash() {
        var id = (location.hash || '').replace('#', '');
        if (!id || !showTab(id)) showTab(tabs[0].dataset.tab);
      }

      // Смена одного лишь хеша документ не перезагружает: без этого переход
      // по ссылке /handouts#db с уже открытой страницы ничего бы не сделал.
      window.addEventListener('hashchange', function () {
        search.value = '';
        applySearch();
        openFromHash();
      });
      openFromHash();

      // Аудиоплеер: один общий Audio на страницу; кнопка строки — play/pause,
      // док в правом нижнем углу — перемотка и громкость.
      var player = new Audio();
      var dock = document.getElementById('audio-dock');
      var dockName = document.getElementById('dock-name');
      var dockTime = document.getElementById('dock-time');
      var dockDuration = document.getElementById('dock-duration');
      var dockSeek = document.getElementById('dock-seek');
      var dockVolume = document.getElementById('dock-volume');
      var currentButton = null;
      var seeking = false;

      function fmt(t) {
        if (!isFinite(t)) return '0:00';
        var m = Math.floor(t / 60);
        var s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
      }
      function markStopped() {
        if (currentButton) currentButton.classList.remove('playing');
      }
      Array.prototype.forEach.call(document.querySelectorAll('.thumb-audio'), function (button) {
        button.addEventListener('click', function () {
          if (currentButton === button && !player.paused) {
            player.pause();
            return;
          }
          if (currentButton !== button) {
            markStopped();
            currentButton = button;
            player.src = button.dataset.audio;
            dockName.textContent = button.dataset.name;
            dockSeek.value = '0';
            dockTime.textContent = '0:00';
            dockDuration.textContent = '0:00';
          }
          dock.classList.add('open');
          player.play();
        });
      });
      player.addEventListener('play', function () {
        if (currentButton) currentButton.classList.add('playing');
      });
      player.addEventListener('pause', markStopped);
      player.addEventListener('ended', markStopped);
      player.addEventListener('loadedmetadata', function () {
        dockDuration.textContent = fmt(player.duration);
      });
      player.addEventListener('timeupdate', function () {
        dockTime.textContent = fmt(player.currentTime);
        if (!seeking && isFinite(player.duration) && player.duration > 0) {
          dockSeek.value = String((player.currentTime / player.duration) * 100);
        }
      });
      dockSeek.addEventListener('input', function () { seeking = true; });
      dockSeek.addEventListener('change', function () {
        if (isFinite(player.duration)) {
          player.currentTime = (Number(dockSeek.value) / 100) * player.duration;
        }
        seeking = false;
      });
      dockVolume.addEventListener('input', function () { player.volume = Number(dockVolume.value); });
      document.getElementById('dock-close').addEventListener('click', function () {
        player.pause();
        player.removeAttribute('src');
        player.load();
        markStopped();
        currentButton = null;
        dock.classList.remove('open');
      });
    })();
  </script>
${SITE_THEME_SCRIPT}
</body>
</html>
`;
  fs.writeFileSync(path.join(outputRoot, 'index.html'), page, 'utf8');
  console.log(`handouts generated: ${total} files in ${manifest.categories.length} tabs`);
  return total;
}

// ─── Подсветка Idyllium-кода для запекаемых страниц ────────────────────────
// ПОРТ лексера из packages/docs-book/app.js (KEYWORDS/TYPES/QUALIFIED_TYPES,
// tokenize, highlightIdyllium). Уроки подсвечиваются им на клиенте; статические
// страницы («О проекте») — этой копией на сборке. При изменении правил
// подсветки обновлять ОБА места.
const HL_KEYWORDS = new Set([
  'use', 'if', 'else', 'while', 'do', 'for', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'const',
  'function', 'class', 'extends', 'this', 'constructor', 'event', 'contract',
  'public', 'private', 'static', 'parent', 'and', 'or', 'xor',
  'not', 'true', 'false', 'null',
]);

const HL_TYPES = new Set([
  'int', 'float', 'string', 'char', 'bool', 'void', 'array', 'dyn_array', 'set',
]);

const HL_QUALIFIED_TYPES = new Set([
  'Animation', 'Array', 'Color', 'Database', 'Drawable', 'Font', 'Image', 'Music', 'Object', 'Result',
  'Sound', 'Statement', 'Static', 'Value',
  'Circle', 'Line', 'Rectangle', 'Sprite', 'Text',
  'istream', 'ostream', 'stream', 'stamp',
  'Window', 'Widget', 'Button', 'Label', 'SpinBox', 'FloatSpinBox',
  'LineEdit', 'CheckBox', 'ProgressBar', 'TextEdit',
  'ComboBox', 'Slider', 'Frame', 'Timer', 'Modal', 'RadioButton', 'ImageBox',
  'Canvas', 'KeyboardEvent', 'MouseEvent', 'MouseScrollEvent',
  'int8', 'int16', 'int32', 'int64',
  'uint8', 'uint16', 'uint32', 'uint64',
  'float32', 'float64',
]);

interface HlToken { text: string; category: string }

function unescapeHtmlForBake(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function highlightIdylliumForBake(code: string): string {
  return tokenizeIdylliumForBake(code).map((token) => {
    const text = escapeHtml(token.text);
    return token.category === 'plain' ? text : `<span class="hl-${token.category}">${text}</span>`;
  }).join('');
}

function tokenizeIdylliumForBake(source: string): HlToken[] {
  const tokens: HlToken[] = [];
  let pos = 0;
  const len = source.length;
  const isWhitespace = (ch: string) => ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
  const isDigit = (ch: string) => ch >= '0' && ch <= '9';
  const isIdentStart = (ch: string) => /[a-zA-Z_Ѐ-ӿ]/.test(ch);
  const isIdentPart = (ch: string) => /[a-zA-Z0-9_Ѐ-ӿ]/.test(ch);
  const isPascalCase = (name: string) => name.length > 0 && name[0] >= 'A' && name[0] <= 'Z';
  const userClasses = new Set<string>();
  for (const match of source.matchAll(/\bclass\s+([A-Z][a-zA-Z0-9_]*)/g)) userClasses.add(match[1]);
  const importedModules = new Set<string>();
  for (const match of source.matchAll(/\buse\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/g)) importedModules.add(match[1]);

  function peekNonWhitespace(startPos: number): string {
    let p = startPos;
    while (p < len && isWhitespace(source[p])) p++;
    return p < len ? source[p] : '';
  }

  function lastSignificantToken(): HlToken | null {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].category !== 'plain') return tokens[i];
    }
    return null;
  }

  function significantToken(depth: number): HlToken | null {
    let remaining = depth;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].category === 'plain') continue;
      if (remaining === 0) return tokens[i];
      remaining--;
    }
    return null;
  }

  function isClassNamePosition(): boolean {
    if (/^\s+[a-zA-Z_Ѐ-ӿ][a-zA-Z0-9_Ѐ-ӿ]*\s*(?:[=;,)(\[]|$)/.test(source.slice(pos))) return true;
    if (peekNonWhitespace(pos) === '(') return true;
    const lastTok = lastSignificantToken();
    if (lastTok && (lastTok.text === 'extends' || lastTok.text === 'class')) return true;
    if (lastTok && lastTok.text === '<') {
      const beforeAngle = significantToken(1);
      if (beforeAngle && (beforeAngle.text === 'array' || beforeAngle.text === 'dyn_array')) return true;
    }
    return false;
  }

  function tokenBeforeDot(): HlToken | null {
    let dotFound = false;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].category === 'plain') continue;
      if (tokens[i].text === '.') {
        dotFound = true;
        continue;
      }
      if (dotFound) return tokens[i];
    }
    return null;
  }

  while (pos < len) {
    const ch = source[pos];

    if (isWhitespace(ch)) {
      let text = '';
      while (pos < len && isWhitespace(source[pos])) text += source[pos++];
      tokens.push({ text, category: 'plain' });
      continue;
    }

    if (ch === '/' && source[pos + 1] === '/') {
      let text = '';
      while (pos < len && source[pos] !== '\n') text += source[pos++];
      tokens.push({ text, category: 'comment' });
      continue;
    }

    if (ch === '/' && source[pos + 1] === '*') {
      let text = '/*';
      pos += 2;
      while (pos < len) {
        if (source[pos] === '*' && source[pos + 1] === '/') {
          text += '*/';
          pos += 2;
          break;
        }
        text += source[pos++];
      }
      tokens.push({ text, category: 'comment' });
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let text = quote;
      pos++;
      while (pos < len && source[pos] !== quote) {
        if (source[pos] === '\\' && pos + 1 < len) {
          text += source[pos] + source[pos + 1];
          pos += 2;
        } else if (source[pos] === '\n') {
          break;
        } else {
          text += source[pos++];
        }
      }
      if (pos < len && source[pos] === quote) {
        text += quote;
        pos++;
      }
      tokens.push({ text, category: 'string' });
      continue;
    }

    if (isDigit(ch)) {
      let text = '';
      while (pos < len && (isDigit(source[pos]) || source[pos] === '.')) text += source[pos++];
      tokens.push({ text, category: 'number' });
      continue;
    }

    if (isIdentStart(ch)) {
      let text = '';
      while (pos < len && isIdentPart(source[pos])) text += source[pos++];

      let category = 'object';
      const nextChar = peekNonWhitespace(pos);
      const lastTok = lastSignificantToken();
      const afterDot = lastTok !== null && lastTok.text === '.';

      if (afterDot) {
        const beforeDot = tokenBeforeDot();
        const isAfterModule = beforeDot !== null && importedModules.has(beforeDot.text);
        const isQualifiedTypePosition = /^\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(?:[=;,)\[]|$)/.test(source.slice(pos));
        if (HL_QUALIFIED_TYPES.has(text) || isQualifiedTypePosition) category = 'className';
        else if (isAfterModule && isPascalCase(text)) category = 'className';
        else if (nextChar === '(') category = 'function';
      } else if (HL_TYPES.has(text)) {
        category = 'typeName';
      } else if (HL_KEYWORDS.has(text)) {
        category = 'keyword';
      } else if (userClasses.has(text) || (isPascalCase(text) && isClassNamePosition())) {
        category = 'className';
      } else if (nextChar === '(') {
        category = 'function';
      }

      tokens.push({ text, category });
      continue;
    }

    const twoChar = source.substring(pos, pos + 2);
    if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%='].includes(twoChar)) {
      tokens.push({ text: twoChar, category: 'brackets' });
      pos += 2;
      continue;
    }

    if ('+-*/%<>=!{}[]();,.:~'.includes(ch)) {
      tokens.push({ text: ch, category: 'brackets' });
      pos++;
      continue;
    }

    tokens.push({ text: ch, category: 'plain' });
    pos++;
  }

  return tokens;
}

// ─── «О проекте» (заказ владельца, 2026-08-28): вики-статья об Idyllium ───
// Источник — рукописный HTML-фрагмент packages/docs/manual-content/about/*.html
// (конверсия методистского wiki-idyllium.md). Страница самодостаточна:
// общая шкура сайта (../book/app.css, топбар, тема), но без app.js —
// сайдбар и манифест статье не нужны. Раздел задуман расширяемым: новые
// статьи добавляются в ABOUT_PAGES парой «файл → заголовок».
const ABOUT_SOURCE_ROOT = 'packages/docs/manual-content/about';

const ABOUT_PAGES: ReadonlyArray<{ file: string; out: string; title: string }> = [
  { file: 'wiki-idyllium.html', out: 'index.html', title: 'Idyllium — О проекте' },
];

interface AboutBuildFacts {
  readonly manifest: SiteManifest;
  readonly practicumCount: number;
  readonly projectCount: number;
  readonly handoutCount: number;
}

/** «1 модуль, 2 модуля, 5 модулей» — формы: [один, два-четыре, много]. */
function russianPlural(count: number, forms: readonly [string, string, string]): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

// Ключевые слова — рядами по смыслу, как в статье; слово, которого нет ни в
// одном ряду (новое в языке), не теряется — уезжает в последний ряд.
const ABOUT_KEYWORD_ROWS: ReadonlyArray<readonly string[]> = [
  ['use', 'main', 'function', 'int', 'float', 'string', 'char', 'bool', 'void'],
  ['if', 'else', 'try', 'catch', 'finally', 'while', 'do', 'for', 'break', 'continue', 'return'],
  ['const', 'and', 'xor', 'or', 'not', 'true', 'false', 'null', 'div', 'mod'],
  ['array', 'dyn_array', 'map', 'class', 'constructor', 'this', 'static', 'extends', 'event', 'contract'],
  ['private', 'public'],
];

/**
 * Факты статьи «О проекте», которые устаревают сами собой (версия, счётчики),
 * подставляются сборкой по меткам {{about:имя}} — вердикт владельца 2026-09-18.
 * Текст статьи остаётся рукописным; неизвестная метка роняет сборку, а не
 * уезжает на сайт фигурными скобками.
 */
function aboutFacts(facts: AboutBuildFacts): ReadonlyMap<string, string> {
  const root = process.cwd();
  const version = String((JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf8')) as { version?: string }).version ?? '');
  // Дата версии — из заголовка CHANGELOG («## 1.6.0 — 17 сентября 2026»): его заполняют при релизе.
  const changelog: string = fs.readFileSync(path.resolve(root, 'CHANGELOG.md'), 'utf8');
  const heading = new RegExp(`^## ${version.replace(/\./gu, '\\.')} — (.+)$`, 'mu').exec(changelog);
  if (!heading) throw new Error(`about: CHANGELOG.md has no heading for version ${version}`);

  const keywords = Object.keys(KEYWORDS);
  const placed = new Set(ABOUT_KEYWORD_ROWS.flat());
  const rows = ABOUT_KEYWORD_ROWS.map((row) => row.filter((word) => keywords.includes(word)));
  const leftovers = keywords.filter((word) => !placed.has(word));
  if (leftovers.length > 0) rows[rows.length - 1] = [...rows[rows.length - 1], ...leftovers];

  const stdlib = createDefaultStandardLibrary();
  const modules = stdlib.listModuleSpecs().map((moduleSpec) => moduleSpec.name).sort();
  const globals = stdlib.listGlobalFunctions().map((fn) => fn.name).sort();
  let typeCount = 0;
  let positionCount = globals.length;
  for (const moduleSpec of stdlib.listModuleSpecs()) {
    positionCount += moduleSpec.functions.size + moduleSpec.constants.size;
    for (const type of moduleSpec.types.values()) {
      typeCount += 1;
      positionCount += 1 + type.properties.size + type.methods.size;
    }
  }

  // Тексты сообщений: места, где компилятор и среда выполнения говорят с человеком.
  const countIn = (directory: string, pattern: RegExp): number => {
    let total = 0;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) total += countIn(full, pattern);
      else if (entry.name.endsWith('.ts')) total += (String(fs.readFileSync(full, 'utf8')).match(pattern) ?? []).length;
    }
    return total;
  };
  const messageCount = countIn(path.resolve(root, 'src', 'core'), /diagnostics\.(?:error|warning)\(|this\.error\(/gu)
    + countIn(path.resolve(root, 'src', 'language'), /diagnostics\.(?:error|warning)\(|this\.error\(/gu)
    + countIn(path.resolve(root, 'src', 'runtime'), /new IdylliumRuntimeError\(/gu);

  const sections = facts.manifest.sections;
  const lessonCount = sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const lessonRows = sections.map((section) => (
    `    <tr><td>${escapeHtml(section.title)}</td><td>${section.lessons.length}</td><td>${section.lessons.filter((lesson) => lesson.hasTasks).length}</td></tr>`
  )).join('\n');
  const codeList = (names: readonly string[], separator: string): string => names.map((name) => `<code>${escapeHtml(name)}</code>`).join(separator);

  return new Map<string, string>([
    ['version', version],
    ['version-date', heading[1].trim()],
    ['keyword-count', `${keywords.length} ${russianPlural(keywords.length, ['ключевое слово', 'ключевых слова', 'ключевых слов'])}`],
    ['keyword-rows', rows.map((row) => row.join('  ')).join('\n')],
    ['module-count', `${modules.length} ${russianPlural(modules.length, ['модуль', 'модуля', 'модулей'])}`],
    ['module-list', codeList(modules, ' · ')],
    ['global-count', `${globals.length} ${russianPlural(globals.length, ['глобальная функция', 'глобальные функции', 'глобальных функций'])}`],
    ['global-list', codeList(globals, ', ')],
    ['type-count', `${typeCount} ${russianPlural(typeCount, ['тип', 'типа', 'типов'])}`],
    ['position-count', `${positionCount} ${russianPlural(positionCount, ['описанная позиция', 'описанные позиции', 'описанных позиций'])}`],
    ['message-count', String(Math.round(messageCount / 50) * 50)],
    ['lesson-count', `${lessonCount} ${russianPlural(lessonCount, ['урок', 'урока', 'уроков'])}`],
    ['section-count', `${sections.length} ${russianPlural(sections.length, ['разделе', 'разделах', 'разделах'])}`],
    ['practicum-count', String(facts.practicumCount)],
    ['lesson-rows', lessonRows],
    ['lesson-total', String(lessonCount)],
    ['project-count', String(facts.projectCount)],
    ['handout-count', String(facts.handoutCount)],
  ]);
}

/**
 * Заглушки новых страниц (1.6.3): «Рецепты», «Почему Idyllium» («Конструктор GUI»
 * с 2026-09-25 настоящий — его собирает tools/build-gui-designer.js в dist/web).
 * Вердикт владельца — создать страницы и ссылки в шапке уже сейчас, содержание
 * добавлять потом. Каждая честно говорит, что она в работе, и описывает, что здесь
 * будет; никакого «скоро» без деталей и никаких выдуманных возможностей.
 */
const STUB_PAGES: ReadonlyArray<{ readonly id: string; readonly title: string; readonly body: string }> = [
  {
    id: 'recipes',
    title: 'Рецепты',
    body: `
      <p class="stub-note">Страница в работе: рецептов на ней пока нет. Ниже — что здесь будет.</p>
      <p>Готовые программы для бытовых и рабочих задач — для тех, кто не собирается учиться программировать,
      а хочет получить результат: взять рецепт, поменять в нём несколько чисел и имён файлов, нажать «Запустить».
      Так уже бывало: художнице нужно было собрать GIF-анимацию из серии PNG-кадров — и Idyllium помог.</p>
      <p>Каждый рецепт будет карточкой: что он делает, какие строки менять под себя — и кнопка,
      открывающая программу прямо в Web IDE.</p>
      <h2>Что запланировано</h2>
      <ul>
        <li>серия PNG-кадров → GIF-анимация, и обратно — GIF на кадры;</li>
        <li>QR-код из текста или ссылки — картинкой; и чтение QR-кода с картинки;</li>
        <li>уменьшить или обрезать серию картинок разом;</li>
        <li>починить кодировку текстового файла (windows-1251 → UTF-8 и другие);</li>
        <li>грамоты и таблички по списку имён — из одного шаблона;</li>
        <li>отчёт по таблице CSV: суммы, средние, наибольшее;</li>
        <li>контрольная сумма файла — проверить, что скачалось целиком.</li>
      </ul>
      <p>А пока всё, из чего эти рецепты собираются, уже есть в языке: библиотеки <code>image</code>, <code>qr</code>,
      <code>encoding</code>, <code>csv</code> и <code>hash</code> описаны в <a href="../reference/">документации</a>.</p>`,
  },
  {
    id: 'why',
    title: 'Почему Idyllium',
    body: `
      <p class="stub-note">Страница в работе.</p>
      <p>Здесь будет разбор: какие привычки промышленных языков мешают учиться — тихие преобразования типов,
      <code>undefined</code> вместо ошибки, <code>%</code>, который читают как проценты, «магия» массивов и строк, —
      и как то же самое устроено в Idyllium. И честная обратная сторона: где Idyllium проигрывает — в скорости
      (он компилируется в JavaScript и заведомо медленнее C++), в библиотеках (NumPy, pandas и машинного обучения
      здесь нет и не будет), в размере сообщества.</p>
      <p>Пока: коротко о философии — на странице <a href="../about/">«О проекте»</a>. Подробные разборы по темам,
      с пробами на C++, Python и JavaScript, уже написаны — в справках, адресованных ИИ-помощникам, но читаемых
      и людьми: <a href="../ai/ru/idyllium-contrast-console-ai-reference.md">консоль</a>,
      <a href="../ai/ru/idyllium-contrast-gui-ai-reference.md">виджеты</a>,
      <a href="../ai/ru/idyllium-contrast-canvas-ai-reference.md">холст</a>,
      <a href="../ai/ru/idyllium-contrast-oop-ai-reference.md">классы</a>,
      <a href="../ai/ru/idyllium-contrast-json-ai-reference.md">JSON</a>,
      <a href="../ai/ru/idyllium-contrast-sqlite-ai-reference.md">SQLite</a>,
      <a href="../ai/ru/idyllium-contrast-http-ai-reference.md">сеть</a>,
      <a href="../ai/ru/idyllium-contrast-libraries-ai-reference.md">библиотеки</a>. В каждой есть раздел
      «честный остаток» — чего Idyllium не ловит.</p>`,
  },
];

function buildStubPages(siteRoot: string, version: string): void {
  for (const page of STUB_PAGES) {
    const section = SITE_SECTIONS.find((item) => item.id === page.id);
    if (!section || !section.stub) throw new Error(`stub page '${page.id}' must be a stub section in tools/site-nav.ts`);
    const outputRoot = path.join(siteRoot, page.id);
    fs.mkdirSync(outputRoot, { recursive: true });
    const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(page.title)} — Idyllium</title>
  <link rel="icon" type="image/png" href="../book/favicon.png">
  <link rel="stylesheet" href="../book/fonts/fonts.css">
  ${siteNavAssetsHtml('../')}
  <link rel="stylesheet" href="../book/app.css">
  <style>
    .stub-main { max-width: 860px; margin: 0 auto; padding: 30px 22px 90px; color: var(--text-main); line-height: 1.62; }
    .stub-main h1 { margin: 0 0 14px; font-size: 2.05rem; }
    .stub-main h2 { margin: 1.8em 0 0.5em; font-size: 1.3rem; }
    .stub-main p { margin: 0.6em 0; }
    .stub-main a { color: var(--accent); }
    .stub-main code { font-family: var(--font-mono); font-size: 0.92em; }
    .stub-main ul { padding-left: 24px; }
    .stub-main li { margin: 0.3em 0; }
    .stub-note { padding: 10px 14px; border-left: 3px solid var(--accent); border-radius: 0 10px 10px 0; background: var(--accent-soft); color: var(--text-soft); font-weight: 600; }
  </style>
</head>
<body>
${siteTopbarHtml(page.id, { prefix: '../', version })}
  <main class="stub-main">
    <h1>${escapeHtml(page.title)}</h1>${page.body}
  </main>
${SITE_THEME_SCRIPT}
</body>
</html>
`;
    fs.writeFileSync(path.join(outputRoot, 'index.html'), html, 'utf8');
  }
  console.log(`stub pages generated: ${STUB_PAGES.length}`);
}

function buildAboutPage(outputRoot: string, buildFacts: AboutBuildFacts): void {
  const sourceRoot = path.resolve(process.cwd(), ABOUT_SOURCE_ROOT);
  const factValues = aboutFacts(buildFacts);
  fs.mkdirSync(outputRoot, { recursive: true });

  // Версия подставляется сборкой, как в справочнике: version.js сюда не
  // годится — он ищет собственный URL приёмом «последний <script> страницы»,
  // а здесь последним стоит инлайн-скрипт темы, и бейдж показывал бы «v?.?.?».
  const packageVersion = String(
    (JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as { version?: string }).version ?? '',
  );

  for (const page of ABOUT_PAGES) {
    const rawFragment = String(fs.readFileSync(path.join(sourceRoot, page.file), 'utf8')).replace(
      /\{\{about:([a-z-]+)\}\}/gu,
      (_match: string, name: string) => {
        const value = factValues.get(name);
        if (value === undefined) throw new Error(`about: unknown fact {{about:${name}}} in ${page.file}`);
        return value;
      },
    );
    // Подсветка запекается на сборке тем же лексером, что подсвечивает уроки
    // на клиенте: app.js статье не подключён, а серые примеры на витрине
    // проекта выглядели бы бедно.
    const fragment = rawFragment.replace(
      /(<code class="idyl-code">)([\s\S]*?)(<\/code>)/g,
      (_match: string, open: string, body: string, close: string) => open + highlightIdylliumForBake(unescapeHtmlForBake(body)) + close,
    );
    const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="Idyllium — учебный язык программирования: философия, синтаксис, среда разработки, учебные материалы.">
  <link rel="icon" type="image/png" href="../book/favicon.png">
  <link rel="stylesheet" href="../book/fonts/fonts.css">
  ${siteNavAssetsHtml('../')}
  <link rel="stylesheet" href="../book/app.css">
  <style>
    .about-main { max-width: 1100px; margin: 0 auto; padding: 30px 22px 90px; }
    .wiki-article { color: var(--text-main); line-height: 1.62; }
    .wiki-article h1 { font-size: 2.05rem; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid var(--border); }
    .wiki-article h2 { font-size: 1.42rem; margin: 2.1em 0 0.6em; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    .wiki-article h3 { font-size: 1.12rem; margin: 1.6em 0 0.5em; }
    .wiki-article h4 { font-size: 1rem; margin: 1.4em 0 0.4em; }
    .wiki-article p { margin: 0.55em 0; }
    .wiki-article a { color: var(--accent); }
    .wiki-article code:not(.idyl-code):not(.plain-code) { font-family: var(--font-mono); font-size: 0.9em; background: var(--bg-code); border: 1px solid var(--border-soft); border-radius: 5px; padding: 1px 5px; }
    .wiki-article .idyl-pre { font-size: 15px; }
    .wiki-article .plain-code { font-family: inherit; font-size: inherit; }
    .wiki-article blockquote { margin: 16px 0; padding: 6px 20px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 10px 10px 0; color: var(--text-soft); }
    .wiki-article ul, .wiki-article ol { margin: 0.55em 0; padding-left: 26px; }
    .wiki-article li { margin: 0.3em 0; }
    .wiki-infobox { float: right; width: 380px; margin: 6px 0 18px 28px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px; font-size: 0.86rem; }
    .wiki-infobox-icon { display: block; width: 108px; height: 108px; margin: 4px auto 10px; }
    .wiki-infobox-title { text-align: center; font-weight: 650; font-size: 1.02rem; margin-bottom: 8px; }
    .wiki-infobox table { width: 100%; border-collapse: collapse; }
    .wiki-infobox th, .wiki-infobox td { text-align: left; vertical-align: top; padding: 5px 0; border-top: 1px solid var(--border-soft); }
    .wiki-infobox th { width: 40%; padding-right: 10px; color: var(--text-soft); font-weight: 550; }
    .wiki-toc { display: inline-block; min-width: 300px; margin: 16px 0 6px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px 20px 14px; }
    .wiki-toc-title { font-weight: 650; margin-bottom: 6px; }
    .wiki-toc ol { margin: 0; padding-left: 22px; }
    .wiki-toc a { color: var(--accent); text-decoration: none; }
    .wiki-toc a:hover { text-decoration: underline; }
    .wiki-table { border-collapse: collapse; margin: 12px 0; }
    .wiki-table th, .wiki-table td { border: 1px solid var(--border); padding: 7px 13px; text-align: left; }
    .wiki-table th { background: var(--bg-panel-2); }
    .wiki-modules { line-height: 2; }
    @media (max-width: 760px) {
      .wiki-infobox { float: none; width: 100%; margin: 14px 0; }
      .wiki-toc { display: block; }
      .about-main { padding: 20px 14px 70px; }
    }
  </style>
</head>
<body>
${siteTopbarHtml('about', { prefix: '../', version: packageVersion })}
  <main class="about-main">
${fragment}
  </main>
${SITE_THEME_SCRIPT}
</body>
</html>
`;
    fs.writeFileSync(path.join(outputRoot, page.out), html, 'utf8');
  }
  console.log(`about generated: ${ABOUT_PAGES.length} page(s)`);
}

function pendingTasksFragment(sectionId: string, lessonId: string, lessonTitle: string): string {
  return `<div class="docs-section docs-placeholder">
  <h2>Задания готовятся</h2>
  <p>Практикум по теме <strong>${escapeHtml(lessonTitle)}</strong> ещё не составлен.</p>
  <p>Пока его нет, вернитесь к <a href="../book/${escapeHtml(sectionId)}/${escapeHtml(lessonId)}">уроку</a>: примеры оттуда полезно повторить руками и переделать под себя.</p>
</div>
`;
}


// ─── Проекты (решение владельца, 2026-08-15): третий режим оболочки ────────
// Страницы-руководства проектной деятельности; источники фрагментов —
// packages/docs/manual-content/projects/<раздел>/<имя>.html (пекутся из методистских
// MD по регламенту projects_md/00-page-rules.md). Пока — только «Консоль».
const PROJECTS_SOURCE_ROOT = 'packages/docs/manual-content/projects';

const PROJECTS_SECTIONS: ReadonlyArray<{ id: string; title: string; icon: string; lessons: ReadonlyArray<{ id: string; title: string; subtitle: string }> }> = [
  {
    id: 'console',
    title: 'Консоль',
    icon: 'section-console',
    lessons: [
      { id: "reverse-excursion", title: "Экскурсия наоборот", subtitle: "Консольный проект · ★★" },
      { id: "cockroach-crumb-quest", title: "Ночной дожор", subtitle: "Консольный проект · ★★" },
      { id: "mission-babah", title: "Миссия: БАБАХ", subtitle: "Консольный проект · ★★" },
      { id: "ancient-curse-generator", title: "Генератор древних проклятий", subtitle: "Консольный проект · ★★" },
      { id: "rude-bot-tumbler", title: "bot.gently = false;", subtitle: "Консольный проект · ★" },
      { id: "dice-duel", title: "Кости против Железного Джо", subtitle: "Консольный проект · ★★" },
      { id: "pancake-toss-judge", title: "Судья соревнований по подбрасыванию блинов", subtitle: "Консольный проект · ★★" },
      { id: "part-time-genie", title: "Джинн на пенсии", subtitle: "Консольный проект · ★" },
      { id: "retroactive-prophecy", title: "Пророчество обратной силы", subtitle: "Консольный проект · ★" },
      { id: "cat-quiz", title: "Викторина для кота", subtitle: "Консольный проект · ★★" },
      { id: "ghost-castle-move", title: "Переезд призрака в новый замок", subtitle: "Консольный проект · ★★" },
      { id: "superhero-discount-shop", title: "Секонд-хенд для супергероя", subtitle: "Консольный проект · ★" },
      { id: "rocket-launch", title: "Запуск ракеты", subtitle: "Консольный проект · ★" },
      { id: "wish-shop", title: "Магазин ваших желаний", subtitle: "Консольный проект · ★★" },
      { id: "feed-sense-of-humor", title: "Покорми чувство юмора", subtitle: "Консольный проект · ★★" },
      { id: "feed-the-machine", title: "Feed the Machine", subtitle: "Консольный проект · ★★" },
      { id: "vacuum-rehab", title: "Бедный робот-пылесос", subtitle: "Консольный проект · ★★" },
      { id: "ask-the-dog", title: "Где копать? Спроси пса", subtitle: "Консольный проект · ★★" },
      { id: "good-mood-radio", title: "Радио хорошего настроения", subtitle: "Консольный проект · ★★" },
      { id: "lighthouse-watch", title: "Дежурный по маяку", subtitle: "Консольный проект · ★★" },
      { id: "night-hotel-desk", title: "Отель «Полночь»", subtitle: "Консольный проект · ★★" },
      { id: "fourth-wall-repair", title: "Ремонт четвёртой стены", subtitle: "Консольный проект · ★★" },
      { id: "cat-rescue", title: "Спасите кота Батона", subtitle: "Консольный проект · ★★" },
      { id: "programma-torguetsya", title: "Торг уместен", subtitle: "Консольный проект · ★" },
      { id: "simulyator-ocheredi", title: "Симулятор стояния в очереди", subtitle: "Консольный проект · ★" },
      { id: "mad-cafe-chef", title: "Шеф-повар безумного кафе", subtitle: "Консольный проект · ★★★" },
      { id: "excuse-generator", title: "Генератор отмазок 3000", subtitle: "Консольный проект · ★★" },
      { id: "strict-fridge", title: "Холодильник строгого режима", subtitle: "Консольный проект · ★★" },
      { id: "pentagon-news", title: "Что нового в Пентагоне?", subtitle: "Консольный проект · ★★★" },
      { id: "theatre-props-room", title: "За час до спектакля", subtitle: "Консольный проект · ★★" },
      { id: "unused-forecast-depot", title: "Склад несбывшихся прогнозов погоды", subtitle: "Консольный проект · ★★" },
      { id: "cat-on-keyboard", title: "Кот идёт по клавиатуре", subtitle: "Консольный проект · ★★★" },
      { id: "street-garland", title: "Гирлянда длиной в улицу", subtitle: "Консольный проект · ★★" },
      { id: "urban-legend-generator", title: "Генератор городских легенд", subtitle: "Консольный проект · ★★" },
      { id: "sports-commentator", title: "Спортивный комментатор для некомментируемого", subtitle: "Консольный проект · ★★" },
      { id: "baby-talk-translator", title: "Переводчик с младенческого", subtitle: "Консольный проект · ★★" },
      { id: "cat-excuse-generator", title: "Генератор оправданий для кота", subtitle: "Консольный проект · ★★" },
      { id: "encoding-telephone", title: "Испорченный телефон кодировок", subtitle: "Консольный проект · ★★" },
      { id: "cannonball-flight", title: "Полёт ядра", subtitle: "Консольный проект · ★★" }
    ],
  },
  {
    id: 'windows',
    title: 'Окна',
    icon: 'section-widgets',
    lessons: [
      { id: "elevator-sage", title: "Лифт-философ", subtitle: "Оконный проект · ★★" },
      { id: "overlord-reception", title: "Приёмная Тёмного Властелина", subtitle: "Оконный проект · ★★" },
      { id: "safe-box", title: "Сейф деда Митрофана", subtitle: "Оконный проект · ★" },
      { id: "shaurma-sim", title: "Симулятор шаурмиста", subtitle: "Оконный проект · ★★" },
      { id: "traffic-light", title: "Действительно умный светофор", subtitle: "Оконный проект · ★★" },
      { id: "ostrich-race", title: "Страусиные бега", subtitle: "Оконный проект · ★★" },
      { id: "catch-the-button", title: "Поймай кнопку", subtitle: "Оконный проект · ★★" },
      { id: "inyerface", title: "Инъерфейс", subtitle: "Оконный проект · ★★" },
      { id: "math-test", title: "Вредный математический тест", subtitle: "Оконный проект · ★★" },
      { id: "pump-meter-progressbar-stesnyaetsya", title: "Скромный прогрессбар", subtitle: "Оконный проект · ★★" },
      { id: "color-guess", title: "Цветовой снайпер", subtitle: "Оконный проект · ★★" },
      { id: "email-verifier", title: "email не пройдёт!", subtitle: "Оконный проект · ★★★" },
      { id: "breach-protocol", title: "Взлом протокола", subtitle: "Оконный проект · ★★★" }
    ],
  },
];

function projectsShell(): string {
  return tasksShell('projects')
    .replace('<title>Idyllium - Задачник</title>', '<title>Idyllium - Проекты</title>')
    .replace('<body data-docs-mode="tasks">', '<body data-docs-mode="projects">')
    .replace('Загрузка задачника...', 'Загрузка проектов...')
    .replace('placeholder="Найти тему"', 'placeholder="Найти проект"');
}

function buildProjectsSite(projectsRoot: string): number {
  fs.mkdirSync(projectsRoot, { recursive: true });

  const sections: SiteSection[] = [];
  let ready = 0;

  for (const section of PROJECTS_SECTIONS) {
    const lessons: SiteLesson[] = [];
    for (const project of section.lessons) {
      const sourceFile = `${PROJECTS_SOURCE_ROOT}/${section.id}/${project.id}.html`;
      const sourcePath = path.resolve(process.cwd(), sourceFile);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`project page is missing: ${sourceFile}`);
      }
      const outputFile = `content/${section.id}/${project.id}.html`;
      const outputPath = path.join(projectsRoot, outputFile);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, fs.readFileSync(sourcePath, 'utf8'), 'utf8');
      ready++;
      lessons.push({
        id: project.id,
        title: project.title,
        subtitle: project.subtitle,
        file: outputFile,
        sourceFile,
        status: 'ready',
        reviewFlags: [],
        hasTasks: false,
      });
    }
    sections.push({ id: section.id, title: section.title, icon: section.icon, status: 'ready', lessons });

    // Скриншоты страниц секции: manual-content/projects/<sec>/img/ →
    // content/<sec>/img/ (пути в фрагментах — content/<sec>/img/<файл>)
    const imagesDir = path.resolve(process.cwd(), PROJECTS_SOURCE_ROOT, section.id, 'img');
    if (fs.existsSync(imagesDir)) {
      const imagesOut = path.join(projectsRoot, 'content', section.id, 'img');
      fs.mkdirSync(imagesOut, { recursive: true });
      for (const entry of fs.readdirSync(imagesDir)) {
        fs.copyFileSync(path.join(imagesDir, entry), path.join(imagesOut, entry));
      }
    }
  }

  const projectsManifest: SiteManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: PROJECTS_SOURCE_ROOT,
    sections,
  };

  fs.writeFileSync(path.join(projectsRoot, 'lessons.json'), `${JSON.stringify(projectsManifest, null, 2)}
`, 'utf8');
  fs.writeFileSync(path.join(projectsRoot, 'index.html'), projectsShell(), 'utf8');
  const pages = bakeCleanUrlPages(projectsShell(), projectsRoot, projectsManifest, 'Проекты Idyllium');
  console.log(`projects generated: ${ready} pages (+${pages} clean URLs)`);
  return ready;
}

function tasksShell(sectionId: 'tasks' | 'projects' = 'tasks'): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <base href="./">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idyllium - Задачник</title>
  <link rel="icon" type="image/png" href="../book/favicon.png">
  <link rel="stylesheet" href="../book/fonts/fonts.css">
  ${siteNavAssetsHtml('../')}
  <link rel="stylesheet" href="../book/app.css">
  <script src="../gui-renderer/icons.js"></script>
  <script src="../book/version.js" defer></script>
  <script src="../book/app.js" defer></script>
</head>
<body data-docs-mode="tasks">
${siteTopbarHtml(sectionId, { prefix: '../', version: SITE_VERSION })}

  <div class="docs-shell">
    <aside class="docs-sidebar" id="docs-sidebar">
      <div class="sidebar-head">
        <label class="search-box">
          <span>Поиск</span>
          <input id="lesson-search" type="search" autocomplete="off" placeholder="Найти тему">
        </label>
      </div>
      <nav class="lesson-nav" id="lesson-nav" aria-label="Темы"></nav>
    </aside>

    <main class="docs-main" id="docs-main" tabindex="-1">
      <article class="lesson-view" id="lesson-view">
        <div class="loading-card">Загрузка задачника...</div>
      </article>
    </main>

    <aside class="docs-toc" id="docs-toc" aria-label="Разделы страницы"></aside>
  </div>
</body>
</html>
`;
}

function convertSection(
  oldSection: OldSection,
  lessonsRoot: string,
  outputRoot: string,
): SiteSection {
  const meta = SECTION_RENAMES[oldSection.id] ?? { id: oldSection.id, title: oldSection.title, icon: oldSection.icon ?? 'section' };
  const usedSlugs = new Set<string>();
  const lessons: SiteLesson[] = [];

  for (const lessonRef of oldSection.lessons) {
    const sourceFile = normalizePath(lessonRef.file);
    const slug = uniqueSlug(sourceFile, lessonRef.title, usedSlugs);
    const sourcePath = path.join(lessonsRoot, sourceFile);
    const outputFile = `content/${meta.id}/${slug}.html`;
    const outputPath = path.join(outputRoot, outputFile);
    const reviewFlags: string[] = [];
    const status = 'ready';
    const subtitle = lessonRef.subtitle ?? '';

    const replacement = LESSON_REPLACEMENTS[sourceFile];
    const hasSource = fs.existsSync(sourcePath)
      || (replacement !== undefined && fs.existsSync(path.resolve(process.cwd(), replacement)));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, hasSource
      ? lessonFragment(sourceFile, lessonSource(sourceFile, sourcePath))
      : missingLessonFragment(oldSection.title, lessonRef.title), 'utf8');

    lessons.push({
      id: slug,
      title: lessonRef.title,
      subtitle,
      file: outputFile,
      sourceFile,
      status,
      reviewFlags,
    });
  }

  return {
    id: meta.id,
    title: meta.title,
    icon: meta.icon,
    status: 'ready',
    lessons,
  };
}

function lessonSource(sourceFile: string, sourcePath: string): string {
  const replacement = LESSON_REPLACEMENTS[sourceFile];
  if (!replacement) return fs.readFileSync(sourcePath, 'utf8');

  const replacementPath = path.resolve(process.cwd(), replacement);
  if (!fs.existsSync(replacementPath)) return fs.readFileSync(sourcePath, 'utf8');
  return fs.readFileSync(replacementPath, 'utf8');
}

function plannedSection(outputRoot: string, id: string, title: string, icon: string, note: string): SiteSection {
  const file = `content/${id}/intro.html`;
  const outputPath = path.join(outputRoot, file);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, plannedLessonFragment(title, note), 'utf8');

  return {
    id,
    title,
    icon,
    status: 'ready',
    lessons: [{
      id: 'intro',
      title: `${title}: будущий раздел`,
      subtitle: note,
      file,
      sourceFile: '',
      status: 'ready',
      reviewFlags: ['planned-section'],
    }],
  };
}

function withManualLessons(sections: readonly SiteSection[], outputRoot: string): SiteSection[] {
  const byId = new Map<string, SiteSection>();
  for (const section of sections) byId.set(section.id, { ...section, lessons: [...section.lessons] });

  ensureSection(byId, outputRoot, 'turtle', 'Черепаха', 'turtle', 'Черепашья графика появится между GUI и ООП.');
  ensureSection(byId, outputRoot, 'canvas', 'Canvas', 'canvas', 'Canvas появится отдельным разделом после ООП.');
  ensureSection(byId, outputRoot, 'json', 'JSON', 'json', 'JSON появится после Canvas, когда мы согласуем синтаксис библиотеки.');
  ensureSection(
    byId,
    outputRoot,
    'sqlite',
    'SQLite',
    'database',
    'Библиотека sqlite уже работает, а последовательная линия уроков готовится после раздела JSON.',
  );
  ensureSection(
    byId,
    outputRoot,
    'network',
    'Сеть',
    'network',
    'Сетевые библиотеки: http-клиент уже в языке, дальше — канал и свой сервер.',
  );

  for (const manual of MANUAL_LESSONS) {
    const section = byId.get(manual.sectionId);
    if (!section) continue;

    const sourcePath = path.resolve(process.cwd(), manual.sourceFile);
    const outputFile = `content/${section.id}/${manual.id}.html`;
    const outputPath = path.join(outputRoot, outputFile);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, fs.existsSync(sourcePath)
      ? fs.readFileSync(sourcePath, 'utf8')
      : missingLessonFragment(section.title, manual.title), 'utf8');

    const lesson: SiteLesson = {
      id: manual.id,
      title: manual.title,
      subtitle: manual.subtitle,
      file: outputFile,
      sourceFile: manual.sourceFile,
      status: 'ready',
      reviewFlags: manual.reviewFlags,
    };

    const lessons = section.lessons.filter((item) => item.id !== manual.id && item.sourceFile !== manual.sourceFile);
    const afterIndex = manual.afterLessonId
      ? lessons.findIndex((item) => item.id === manual.afterLessonId)
      : -1;
    if (afterIndex === -1) {
      lessons.push(lesson);
    } else {
      lessons.splice(afterIndex + 1, 0, lesson);
    }

    byId.set(section.id, { ...section, status: 'ready', lessons });
  }

  // Секция, получившая настоящие уроки, избавляется от плановой заглушки.
  return [...byId.values()].map((section) =>
    section.lessons.length > 1
      ? { ...section, lessons: section.lessons.filter((lesson) => !lesson.reviewFlags.includes('planned-section')) }
      : section,
  );
}

function ensureSection(
  byId: Map<string, SiteSection>,
  outputRoot: string,
  id: string,
  title: string,
  icon: string,
  note: string,
): void {
  if (byId.has(id)) return;
  byId.set(id, plannedSection(outputRoot, id, title, icon, note));
}

function orderedSections(sections: readonly SiteSection[]): SiteSection[] {
  const byId = new Map<string, SiteSection>();
  for (const section of sections) byId.set(section.id, section);

  const ordered: SiteSection[] = [];
  for (const id of SECTION_ORDER) {
    const section = byId.get(id);
    if (!section) continue;
    ordered.push(section);
    byId.delete(id);
  }
  ordered.push(...byId.values());
  return ordered;
}

function lessonFragment(sourceFile: string, html: string): string {
  const normalized = html.replace(/\r\n/g, '\n');
  const styles = extractStyles(normalized)
    .map((style) => `<style data-lesson-style>\n${style}\n</style>`)
    .join('\n');
  const scripts = extractInlineScripts(normalized)
    .map((script) => `<script data-lesson-script type="text/plain">\n${escapeScriptText(script)}\n</script>`)
    .join('\n');
  const main = extractMain(normalized);
  // Стили переиздаются в шапке фрагмента; копии в теле удаляются, чтобы
  // пересборка уже собранного фрагмента оставалась идемпотентной.
  const withoutInlineStyles = main.replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/giu, '');
  const withoutHero = removeElementByClass(withoutInlineStyles, 'docs-hero');
  const withoutOldNav = removeElementByClass(withoutHero, 'docs-lesson-nav');
  const cleaned = withoutOldNav
    .replace(/<script\s+src=["'][^"']*version\.js["'][^>]*>\s*<\/script>/giu, '')
    .trim();
  const extra = readLessonExtra(sourceFile);

  return `${styles}${styles ? '\n\n' : ''}${cleaned}${extra ? `\n\n${extra}` : ''}${scripts ? `\n\n${scripts}` : ''}\n`;
}

function readLessonExtra(sourceFile: string): string {
  const extraPath = LESSON_EXTRAS[sourceFile];
  if (!extraPath) return '';
  const resolved = path.resolve(process.cwd(), extraPath);
  if (!fs.existsSync(resolved)) return '';
  return fs.readFileSync(resolved, 'utf8').trim();
}

function missingLessonFragment(sectionTitle: string, lessonTitle: string): string {
  return `<section class="docs-section docs-placeholder">
  <h2>Нужно восстановить вручную</h2>
  <p>Урок <strong>${escapeHtml(lessonTitle)}</strong> был указан в старой карте раздела <strong>${escapeHtml(sectionTitle)}</strong>, но HTML-файл в старой документации отсутствовал.</p>
  <p>Эта страница оставлена как честная заглушка, чтобы навигация не вела в пустоту.</p>
</section>
`;
}

function plannedLessonFragment(title: string, note: string): string {
  return `<section class="docs-section docs-placeholder">
  <h2>${escapeHtml(title)}</h2>
  <p>${escapeHtml(note)}</p>
  <p>Раздел появится после ручной редакции учебной линии и согласования синтаксиса.</p>
</section>
`;
}

function extractMain(html: string): string {
  const match = /<main\b[^>]*class=["'][^"']*\bdocs-main\b[^"']*["'][^>]*>([\s\S]*?)<\/main>/iu.exec(html);
  if (match) return match[1];
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/iu.exec(html);
  return body ? body[1] : html;
}

function extractStyles(html: string): string[] {
  const styles: string[] = [];
  const regex = /<style\b[^>]*>([\s\S]*?)<\/style>/giu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const style = match[1].trim();
    if (style) styles.push(style);
  }
  return styles;
}

function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/giu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    if (/\bsrc\s*=/iu.test(attrs)) continue;
    if (/\btype\s*=\s*["']text\/plain["']/iu.test(attrs)) continue;
    const script = match[2].trim();
    if (script) scripts.push(script);
  }
  return scripts;
}

function removeElementByClass(html: string, className: string): string {
  let result = html;
  while (true) {
    const classPattern = new RegExp(`<([a-z][a-z0-9-]*)\\b[^>]*class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>`, 'iu');
    const match = classPattern.exec(result);
    if (!match) return result;

    const tag = match[1].toLowerCase();
    const start = match.index;
    const firstTagEnd = start + match[0].length;
    const tagRegex = new RegExp(`</?${escapeRegExp(tag)}\\b[^>]*>`, 'giu');
    tagRegex.lastIndex = firstTagEnd;

    let depth = 1;
    let removed = false;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(result)) !== null) {
      if (tagMatch[0].startsWith('</')) {
        depth--;
        if (depth === 0) {
          result = `${result.slice(0, start)}${result.slice(tagRegex.lastIndex)}`;
          removed = true;
          break;
        }
        continue;
      }
      depth++;
    }

    if (!removed) return result;
  }
}

function copyAssets(sourceRoot: string, outputRoot: string): void {
  copyFileIfExists(path.join(sourceRoot, 'favicon.png'), path.join(outputRoot, 'favicon.png'));
  copyFileIfExists(path.join(sourceRoot, 'version.js'), path.join(outputRoot, 'version.js'));
  // version.json на входе нет: версия живёт только в package.json, файл пишется отсюда.
  writeCurrentVersion(path.join(outputRoot, 'version.json'));
  copyDirectory(path.join(sourceRoot, 'fonts'), path.join(outputRoot, 'fonts'));

  fs.mkdirSync(path.join(outputRoot, 'assets'), { recursive: true });
  const bookAssetsRoot = path.resolve(process.cwd(), 'packages', 'docs', 'book-assets');
  for (const asset of ['cat.png', 'walk.gif', 'click.wav', 'theme.mp3']) {
    copyFileIfExists(path.join(bookAssetsRoot, asset), path.join(outputRoot, 'assets', asset));
  }
}

function copyBookShell(outputRoot: string): void {
  const sourceRoot = path.resolve(process.cwd(), 'packages', 'docs-book');
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const file of ['app.css', 'app.js']) {
    copyFileIfExists(path.join(sourceRoot, file), path.join(outputRoot, file));
  }
  // Шапка учебника — из единого источника (маркеры в оболочке подставляет сборка).
  fs.writeFileSync(
    path.join(outputRoot, 'index.html'),
    injectSiteTopbar(fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8'), 'book', { prefix: '../', version: SITE_VERSION }),
    'utf8',
  );
}

function writeCurrentVersion(outputPath: string): void {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  const version = fs.existsSync(packagePath)
    ? String(JSON.parse(fs.readFileSync(packagePath, 'utf8')).version ?? '1.1.3')
    : '1.1.3';
  fs.writeFileSync(outputPath, `${JSON.stringify({ version }, null, 2)}\n`, 'utf8');
}

function copyWebIde(outputRoot: string): void {
  const sourceWebDir = path.resolve(process.cwd(), 'dist', 'web');
  if (!fs.existsSync(sourceWebDir)) {
    throw new Error(`web IDE build does not exist: ${sourceWebDir}`);
  }
  fs.cpSync(sourceWebDir, outputRoot, { recursive: true });
}

function writeLegacyIdeRedirect(outputRoot: string): void {
  const redirectDir = path.join(outputRoot, 'ide');
  fs.mkdirSync(redirectDir, { recursive: true });
  fs.writeFileSync(path.join(redirectDir, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=../">
  <title>Idyllium Web IDE</title>
</head>
<body>
  <p>Web IDE переместилась на <a href="../">главную страницу</a>.</p>
  <script>
    const target = new URL('../', location.href);
    target.search = location.search;
    target.hash = location.hash;
    location.replace(target.href);
  </script>
</body>
</html>
`, 'utf8');
}

function writeSite404(outputRoot: string): void {
  // Сайт печётся целиком здесь — Jekyll на GitHub Pages не нужен и ОПАСЕН:
  // Liquid в нём считает {{…}} и {% for %} своими тегами, а с 1.5.1 наши
  // доки шаблонизатора полны таких последовательностей (упавший деплой
  // 2026-08-22: «Liquid syntax error … in ai/idyllium-ai-reference.md»).
  fs.writeFileSync(path.join(outputRoot, '.nojekyll'), '', 'utf8');
  fs.writeFileSync(path.join(outputRoot, '404.html'), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idyllium - страница не найдена</title>
  <style>
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; background: #101012; color: #f1f1f3; font: 18px/1.5 system-ui, sans-serif; }
    main { width: min(100%, 560px); padding: 26px; border: 1px solid #34363d; border-radius: 8px; background: #18191d; }
    h1 { margin: 0 0 10px; font-size: 30px; }
    p { color: #c7c9cf; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
    a { padding: 8px 12px; border: 1px solid #34363d; border-radius: 6px; color: #f1f1f3; text-decoration: none; }
    a:hover { border-color: #76bff4; }
  </style>
</head>
<body>
  <main>
    <h1>Страница не найдена</h1>
    <p>Можно вернуться в IDE, открыть учебник, задачник или справочник.</p>
    <nav>
      <a data-site-path="">Открыть IDE</a>
      <a data-site-path="book/">Учебник</a>
      <a data-site-path="tasks/">Задачник</a>
      <a data-site-path="reference/">Документация</a>
    </nav>
  </main>
  <script>
    const parts = location.pathname.split('/').filter(Boolean);
    const base = location.hostname.endsWith('github.io') && parts.length > 0 ? '/' + parts[0] + '/' : '/';
    document.querySelectorAll('[data-site-path]').forEach((link) => {
      link.href = base + link.dataset.sitePath;
    });
  </script>
</body>
</html>
`, 'utf8');
}

function prepareOutput(outputRoot: string): void {
  const repoRoot = path.resolve(process.cwd());
  const resolvedOutput = path.resolve(outputRoot);
  if (!isInside(resolvedOutput, repoRoot)) {
    throw new Error(`refusing to write docs site outside repository: ${resolvedOutput}`);
  }

  fs.mkdirSync(resolvedOutput, { recursive: true });
  for (const managedPath of MANAGED_PATHS) {
    const target = path.join(resolvedOutput, managedPath);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
}

function uniqueSlug(sourceFile: string, title: string, usedSlugs: Set<string>): string {
  const override = SLUG_OVERRIDES[sourceFile];
  const base = override ?? slugFromFilename(sourceFile) ?? slugify(title) ?? 'lesson';
  let slug = base;
  let index = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${index}`;
    index++;
  }
  usedSlugs.add(slug);
  return slug;
}

function slugFromFilename(file: string): string {
  const base = path.basename(file, '.html').replace(/^\d+_?/u, '');
  return slugify(base);
}

function slugify(value: string): string {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const lower = value.toLowerCase();
  let out = '';
  for (const ch of lower) {
    out += translit[ch] ?? ch;
  }
  return out
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/gu, '-');
}

function copyDirectory(sourceDir: string, outputDir: string): void {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(outputDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, outputPath);
    } else if (entry.isFile()) {
      copyFileIfExists(sourcePath, outputPath);
    }
  }
}

function copyFileIfExists(sourcePath: string, outputPath: string): void {
  if (!fs.existsSync(sourcePath)) return;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function isInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeScriptText(value: string): string {
  return value.replace(/<\/script>/giu, '<\\/script>');
}

main();
