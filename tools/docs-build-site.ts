const fs: any = require('fs');
const path: any = require('path');

import { buildReferenceSite } from './docs-build-reference';

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
  'assets',
  'fonts',
  'monaco',
  'vendor',
  'gui-renderer',
  'gui-preview.html',
  'book',
  'tasks',
  'handouts',
  'reference',
  'ide',
  'docs',
  'content',
  'favicon.png',
  'lessons.json',
  'version.js',
  'version.json',
  '404.html',
];

const SECTION_RENAMES: Record<string, { readonly id: string; readonly title: string; readonly icon: string }> = {
  console: { id: 'console', title: 'Консоль', icon: 'terminal' },
  widgets: { id: 'widgets', title: 'Виджеты', icon: 'widgets' },
  oop: { id: 'oop', title: 'ООП', icon: 'classes' },
  examples: { id: 'examples', title: 'Примеры задач', icon: 'examples' },
};

const SLUG_OVERRIDES: Record<string, string> = {
  'cli/007_math.html': 'math-basics',
  'cli/025_math.html': 'math-advanced',
};

const SECTION_ORDER = ['console', 'widgets', 'oop', 'canvas', 'json', 'sqlite', 'examples'];

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
    sourceFile: 'docs/manual-content/console/constants.html',
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
    sourceFile: 'docs/manual-content/console/bit-operations.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    afterLessonId: 'matrix',
    id: 'recursion',
    title: 'Рекурсия',
    subtitle: 'Функция, которая вызывает саму себя и умеет вовремя остановиться',
    sourceFile: 'docs/manual-content/console/recursion.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    afterLessonId: 'errors',
    id: 'try-catch',
    title: 'Обработка ошибок',
    subtitle: 'try, catch и finally: как встретить runtime error и продолжить работу',
    sourceFile: 'docs/manual-content/console/try-catch.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'console',
    afterLessonId: 'files',
    id: 'directories',
    title: 'Файлы и папки проекта',
    subtitle: 'Создание, просмотр, копирование, переименование и безопасное удаление',
    sourceFile: 'docs/manual-content/console/directories.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'progressbar',
    id: 'colors',
    title: 'Цвета виджетов',
    subtitle: 'text_color, background_color, border_color и библиотека colors без HEX-угадаек',
    sourceFile: 'docs/manual-content/widgets/colors.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'colors',
    id: 'fonts',
    title: 'Шрифты в GUI',
    subtitle: 'fonts.Font, наследование от окна и один ресурс для нескольких виджетов',
    sourceFile: 'docs/manual-content/widgets/fonts.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'lineedit',
    id: 'image',
    title: 'Картинки в GUI',
    subtitle: 'image.Static, image.Animation, ImageBox и преобразования картинок',
    sourceFile: 'docs/manual-content/widgets/image.html',
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
    sourceFile: 'docs/manual-content/widgets/styles.html',
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
    sourceFile: 'docs/manual-content/widgets/links.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'widgets',
    afterLessonId: 'visibility',
    id: 'audio',
    title: 'Работа со звуками',
    subtitle: 'audio.Sound, audio.Music и первые звуки в GUI-приложении',
    sourceFile: 'docs/manual-content/widgets/audio.html',
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
    sourceFile: 'docs/manual-content/widgets/tabwidget.html',
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
    sourceFile: 'docs/manual-content/widgets/timer.html',
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
    sourceFile: 'docs/manual-content/oop/events.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'intro',
    title: 'Первый Canvas',
    subtitle: 'Холст как виджет и первый нарисованный круг',
    sourceFile: 'docs/manual-content/canvas/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'drawable',
    title: 'Drawable-объекты',
    subtitle: 'Rectangle, Circle, Line и их основные свойства',
    sourceFile: 'docs/manual-content/canvas/drawable.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'update',
    title: 'Однократные и повторяющиеся действия',
    subtitle: 'on_init, on_update и framerate_limit',
    sourceFile: 'docs/manual-content/canvas/update.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'keyboard',
    title: 'События клавиатуры',
    subtitle: 'on_key_pressed и on_key_released на простом примере',
    sourceFile: 'docs/manual-content/canvas/keyboard.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'pressed-keys',
    title: 'Плавное движение',
    subtitle: 'Массив зажатых клавиш и движение в on_update',
    sourceFile: 'docs/manual-content/canvas/pressed-keys.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'mouse-buttons',
    title: 'Кнопки мыши',
    subtitle: 'on_mouse_pressed, on_mouse_released и координаты клика',
    sourceFile: 'docs/manual-content/canvas/mouse-buttons.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'mouse-motion',
    title: 'Движение мыши и колесо',
    subtitle: 'on_mouse_move, on_mouse_scroll и простая реакция объектов',
    sourceFile: 'docs/manual-content/canvas/mouse-motion.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'modules',
    title: 'Разделение проекта на файлы',
    subtitle: 'Canvas-код отдельно, главный файл отдельно',
    sourceFile: 'docs/manual-content/canvas/modules.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'text',
    title: 'Шрифт и текст',
    subtitle: 'fonts.Font, drawable.Text и координаты курсора',
    sourceFile: 'docs/manual-content/canvas/text.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'sprites',
    title: 'Картинки и спрайты',
    subtitle: 'image.Static, image.Animation, Sprite и управление по WASD',
    sourceFile: 'docs/manual-content/canvas/sprites.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'object-arrays',
    title: 'Массивы объектов',
    subtitle: 'Несколько Rectangle-объектов и метод rotate()',
    sourceFile: 'docs/manual-content/canvas/object-arrays.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'origin',
    title: 'Точка отсчёта и вращение',
    subtitle: 'Origin, движение по окружности, синус и косинус',
    sourceFile: 'docs/manual-content/canvas/origin.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'temporary-objects',
    title: 'Временные объекты',
    subtitle: 'tmp, dyn_array и круги, появляющиеся по клику',
    sourceFile: 'docs/manual-content/canvas/temporary-objects.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    afterLessonId: 'temporary-objects',
    id: 'audio',
    title: 'Звуки и музыка',
    subtitle: 'Sound, Music, loop, position и on_finished в Canvas-проектах',
    sourceFile: 'docs/manual-content/canvas/audio.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'rectangle-hit-test',
    title: 'Точка в прямоугольной области',
    subtitle: 'Левый, правый, верхний и нижний край',
    sourceFile: 'docs/manual-content/canvas/rectangle-hit-test.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'circle-hit-test',
    title: 'Точка в круглой области',
    subtitle: 'Расстояние до центра и теорема Пифагора',
    sourceFile: 'docs/manual-content/canvas/circle-hit-test.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'circle-collisions',
    title: 'Круглые коллизии',
    subtitle: 'Когда два круга касаются друг друга',
    sourceFile: 'docs/manual-content/canvas/circle-collisions.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'rectangle-collisions',
    title: 'Прямоугольные коллизии',
    subtitle: 'Алгоритм опровержения касания прямоугольников',
    sourceFile: 'docs/manual-content/canvas/rectangle-collisions.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'geometry-methods',
    title: 'Готовые геометрические проверки',
    subtitle: 'contains(), collides_with(), повороты и разные типы объектов',
    sourceFile: 'docs/manual-content/canvas/geometry-methods.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'intro',
    title: 'Работа с файлами: повторение',
    subtitle: 'Зачем вообще понадобился JSON, если у нас уже есть file',
    sourceFile: 'docs/manual-content/json/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'first-object',
    title: 'Первый JSON-объект',
    subtitle: 'Ключи, значения, json.Object и json.Value',
    sourceFile: 'docs/manual-content/json/first-object.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'reading',
    title: 'Чтение JSON-данных',
    subtitle: 'parse, get, to_int, to_string и проверка типов',
    sourceFile: 'docs/manual-content/json/reading.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'arrays',
    title: 'JSON-массивы',
    subtitle: 'Списки значений внутри JSON',
    sourceFile: 'docs/manual-content/json/arrays.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'nested-objects',
    title: 'Вложенные объекты',
    subtitle: 'Объект как значение другого объекта',
    sourceFile: 'docs/manual-content/json/nested-objects.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'object-arrays',
    title: 'Массивы объектов',
    subtitle: 'Несколько игроков в одном JSON-файле',
    sourceFile: 'docs/manual-content/json/object-arrays.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'array-methods',
    title: 'Методы массивов',
    subtitle: 'length, at, add, set, insert, pop, remove, clear',
    sourceFile: 'docs/manual-content/json/array-methods.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'object-methods',
    title: 'Методы объектов',
    subtitle: 'length, has, get, add, set, remove, keys',
    sourceFile: 'docs/manual-content/json/object-methods.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'oop',
    title: 'JSON и ООП',
    subtitle: 'Методы to_json и from_json у собственного класса',
    sourceFile: 'docs/manual-content/json/oop.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'json',
    id: 'errors',
    title: 'Типичные ошибки',
    subtitle: 'Невалидный JSON, лишние запятые, комментарии и неверные типы',
    sourceFile: 'docs/manual-content/json/errors.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'intro',
    title: 'Первая база данных',
    subtitle: 'Файл базы, таблица players и первое подключение через sqlite.open()',
    sourceFile: 'docs/manual-content/sqlite/intro.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'changes',
    title: 'Таблицы и первые записи',
    subtitle: 'INSERT, UPDATE, DELETE и количество изменённых строк',
    sourceFile: 'docs/manual-content/sqlite/changes.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'select',
    title: 'Чтение строк',
    subtitle: 'SELECT, sqlite.Result, next() и типизированные методы чтения',
    sourceFile: 'docs/manual-content/sqlite/select.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'parameters',
    title: 'Безопасные параметры',
    subtitle: 'prepare(), :name и bind() вместо склеивания SQL-строк',
    sourceFile: 'docs/manual-content/sqlite/parameters.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'filters',
    title: 'Поиск и фильтрация',
    subtitle: 'WHERE, AND, ORDER BY, LIMIT и параметры в SELECT',
    sourceFile: 'docs/manual-content/sqlite/filters.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'null',
    title: 'Неизвестные значения и null',
    subtitle: 'Пустое значение в таблице, sqlite.Value и безопасная проверка',
    sourceFile: 'docs/manual-content/sqlite/null.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'reuse',
    title: 'Много записей одним запросом',
    subtitle: 'Повторное использование Statement внутри цикла',
    sourceFile: 'docs/manual-content/sqlite/reuse.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'transactions',
    title: 'Всё или ничего',
    subtitle: 'Транзакции, commit(), rollback() и целостность данных',
    sourceFile: 'docs/manual-content/sqlite/transactions.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'scripts',
    title: 'SQL в отдельном файле',
    subtitle: 'read_all(), exec_script() и проект из нескольких файлов',
    sourceFile: 'docs/manual-content/sqlite/scripts.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'select-tools',
    title: 'Все строки и краткая статистика',
    subtitle: 'SELECT *, DISTINCT, агрегатные функции и GROUP BY',
    sourceFile: 'docs/manual-content/sqlite/select-tools.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'defaults',
    title: 'Повторный запуск и значения по умолчанию',
    subtitle: 'IF NOT EXISTS, IF EXISTS и DEFAULT',
    sourceFile: 'docs/manual-content/sqlite/defaults.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'keys',
    title: 'Ключи и уникальные значения',
    subtitle: 'PRIMARY KEY, AUTOINCREMENT и UNIQUE',
    sourceFile: 'docs/manual-content/sqlite/keys.html',
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
    sourceFile: 'docs/manual-content/sqlite/hashing.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'joins',
    title: 'Связи между таблицами',
    subtitle: 'FOREIGN KEY, JOIN, псевдонимы таблиц и LEFT JOIN',
    sourceFile: 'docs/manual-content/sqlite/joins.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'sqlite',
    id: 'errors',
    title: 'Типичные ошибки',
    subtitle: 'Непривязанные параметры, неверные методы чтения и отсутствующие колонки',
    sourceFile: 'docs/manual-content/sqlite/errors.html',
    status: 'ready',
    reviewFlags: [],
  },
];

const LESSON_EXTRAS: Record<string, string> = {};

const LESSON_REPLACEMENTS: Record<string, string> = {
  'cli/000_setup.html': 'docs/manual-content/console/setup.html',
  'cli/001_hello.html': 'docs/manual-content/console/hello.html',
  'cli/002_variables.html': 'docs/manual-content/console/variables.html',
  'cli/003_input.html': 'docs/manual-content/console/input.html',
  'cli/004_arithmetics.html': 'docs/manual-content/console/arithmetics.html',
  'cli/005_colors.html': 'docs/manual-content/console/colors.html',
  'cli/006_transforms.html': 'docs/manual-content/console/transforms.html',
  'cli/007_math.html': 'docs/manual-content/console/math-basics.html',
  'cli/008_if.html': 'docs/manual-content/console/if.html',
  'cli/009_increment.html': 'docs/manual-content/console/increment.html',
  'cli/010_random.html': 'docs/manual-content/console/random.html',
  'cli/011_bool.html': 'docs/manual-content/console/bool.html',
  'cli/012_loops.html': 'docs/manual-content/console/loops.html',
  'cli/013_array.html': 'docs/manual-content/console/array.html',
  'cli/014_char.html': 'docs/manual-content/console/char.html',
  'cli/015_dyn_array.html': 'docs/manual-content/console/dyn-array.html',
  'cli/016_arr_functions.html': 'docs/manual-content/console/arr-functions.html',
  'cli/017_arr_methods.html': 'docs/manual-content/console/arr-methods.html',
  'cli/018_string_methods.html': 'docs/manual-content/console/string-methods.html',
  'cli/019_time.html': 'docs/manual-content/console/time.html',
  'cli/020_types.html': 'docs/manual-content/console/types.html',
  'cli/021_encoding.html': 'docs/manual-content/console/encoding.html',
  'cli/022_functions.html': 'docs/manual-content/console/functions.html',
  'cli/023_libs.html': 'docs/manual-content/console/libs.html',
  'cli/024_files.html': 'docs/manual-content/console/files.html',
  'cli/025_math.html': 'docs/manual-content/console/math-advanced.html',
  'cli/026_matrix.html': 'docs/manual-content/console/matrix.html',
  'cli/027_errors.html': 'docs/manual-content/console/errors.html',
  'widgets/000_window.html': 'docs/manual-content/widgets/window.html',
  'widgets/001_button.html': 'docs/manual-content/widgets/button.html',
  'widgets/002_label.html': 'docs/manual-content/widgets/label.html',
  'widgets/003_progressbar.html': 'docs/manual-content/widgets/progressbar.html',
  'widgets/004_spinbox.html': 'docs/manual-content/widgets/spinbox.html',
  'widgets/005_slider.html': 'docs/manual-content/widgets/slider.html',
  'widgets/006_lineedit.html': 'docs/manual-content/widgets/lineedit.html',
  'widgets/007_checkbox.html': 'docs/manual-content/widgets/checkbox.html',
  'widgets/008_radiobutton.html': 'docs/manual-content/widgets/radiobutton.html',
  'widgets/009_frame.html': 'docs/manual-content/widgets/frame.html',
  'widgets/010_combobox.html': 'docs/manual-content/widgets/combobox.html',
  'widgets/011_visibility.html': 'docs/manual-content/widgets/visibility.html',
  'widgets/012_arrays.html': 'docs/manual-content/widgets/arrays.html',
  'widgets/013_sender.html': 'docs/manual-content/widgets/sender.html',
  'widgets/014_timer.html': 'docs/manual-content/widgets/timer.html',
  'widgets/015_modal.html': 'docs/manual-content/widgets/modal.html',
  'widgets/016_errors.html': 'docs/manual-content/widgets/errors.html',
  'oop/000_intro.html': 'docs/manual-content/oop/intro.html',
  'oop/001_classes.html': 'docs/manual-content/oop/classes.html',
  'oop/002_fields_methods.html': 'docs/manual-content/oop/fields-methods.html',
  'oop/003_this.html': 'docs/manual-content/oop/this.html',
  'oop/004_modules.html': 'docs/manual-content/oop/modules.html',
  'oop/005_arrays.html': 'docs/manual-content/oop/arrays.html',
  'oop/007_composition.html': 'docs/manual-content/oop/composition.html',
  'oop/008_inheritance.html': 'docs/manual-content/oop/inheritance.html',
  'oop/010_encapsulation.html': 'docs/manual-content/oop/encapsulation.html',
  'oop/011_static.html': 'docs/manual-content/oop/static.html',
  'oop/012_errors.html': 'docs/manual-content/oop/errors.html',
  'oop/006_constructor.html': 'docs/manual-content/oop/constructor.html',
  'examples/000_calc.html': 'docs/manual-content/examples/calc.html',
  'oop/009_polymorphism.html': 'docs/manual-content/oop/polymorphism.html',
};

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
  buildTasksSite(path.join(siteRoot, 'tasks'), manifest);

  fs.writeFileSync(path.join(bookRoot, 'lessons.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  buildHandoutsPage(path.join(siteRoot, 'handouts'));

  const bookShell = fs.readFileSync(path.resolve(process.cwd(), 'packages', 'docs-book', 'index.html'), 'utf8');
  const bookPages = bakeCleanUrlPages(bookShell, bookRoot, manifest, 'Учебник Idyllium');
  console.log(`book clean URLs: ${bookPages} pages`);

  buildReferenceSite(path.join(siteRoot, 'reference'));

  const lessonCount = manifest.sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const needsReview = manifest.sections.flatMap((section) => section.lessons).filter((lesson) => lesson.status === 'needs-review').length;
  console.log(`book generated: ${manifest.sections.length} sections, ${lessonCount} lessons`);
  console.log(`needs review: ${needsReview}`);
  console.log(`site output: ${siteRoot}`);
}

const TASKS_SOURCE_ROOT = 'docs/manual-content/tasks';

/**
 * Собирает «Задачник» — сайт-близнец учебника по адресу /tasks/.
 *
 * Оболочка не копируется, а ссылается на файлы учебника (../book/app.js и
 * компанию): разметка страницы у них одна и та же, и разъезжаться ей незачем.
 * Содержимое берётся из docs/manual-content/tasks/<раздел>/<урок>.html —
 * обычных HTML-фрагментов, которые правятся руками так же, как уроки.
 */
function buildTasksSite(tasksRoot: string, manifest: SiteManifest): void {
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
function buildHandoutsPage(outputRoot: string): void {
  const sourceRoot = path.resolve(process.cwd(), 'packages', 'docs', 'handouts');
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'handouts.json'), 'utf8')) as {
    readonly groups: readonly {
      readonly title: string;
      readonly items: readonly { readonly file: string; readonly note: string; readonly license?: string }[];
    }[];
  };

  fs.mkdirSync(path.join(outputRoot, 'files'), { recursive: true });
  for (const entry of fs.readdirSync(sourceRoot)) {
    if (entry === 'handouts.json') continue;
    fs.copyFileSync(path.join(sourceRoot, entry), path.join(outputRoot, 'files', entry));
  }

  const sizeLabel = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${bytes} Б`;
  };

  const groupsHtml = manifest.groups.map((group) => {
    const rows = group.items.map((item) => {
      const filePath = path.join(sourceRoot, item.file);
      if (!fs.existsSync(filePath)) throw new Error(`handout is missing: ${item.file}`);
      const size = sizeLabel(fs.statSync(filePath).size);
      const href = `files/${encodeURIComponent(item.file)}`;
      const license = item.license
        ? ` <a class="license" href="files/${encodeURIComponent(item.license)}" download>лицензия</a>`
        : '';
      const preview = /\.(png|gif|jpe?g)$/iu.test(item.file)
        ? `<img class="thumb" src="${href}" alt="" loading="lazy">`
        : `<span class="thumb thumb-icon">${/\.(mp3|wav)$/iu.test(item.file) ? '♪' : /\.ttf$/iu.test(item.file) ? 'Aa' : '📄'}</span>`;
      return `      <li>
        ${preview}
        <div class="meta">
          <div class="name">${escapeHtml(item.file)} <span class="size">${size}</span>${license}</div>
          <div class="note">${escapeHtml(item.note)}</div>
        </div>
        <a class="download" href="${href}" download>Скачать</a>
      </li>`;
    }).join('\n');
    return `    <section>
      <h2>${escapeHtml(group.title)}</h2>
      <ul>
${rows}
      </ul>
    </section>`;
  }).join('\n');

  const page = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Файлы для заданий — Idyllium</title>
  <link rel="icon" type="image/png" href="../book/favicon.png">
  <link rel="stylesheet" href="../book/fonts/fonts.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 34px 20px 60px; background: #0c0515; color: #f2eaf7;
      font: 17px/1.6 "Geologica", system-ui, sans-serif; }
    main { max-width: 860px; margin: 0 auto; }
    h1 { margin: 0 0 6px; font-size: 34px; }
    .lead { margin: 0 0 30px; color: #c9bdd6; }
    h2 { margin: 34px 0 12px; padding: 8px 16px; border-left: 4px solid #87bfff;
      border-radius: 10px; background: linear-gradient(90deg, rgba(135, 191, 255, 0.12), transparent 82%);
      font-size: 21px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    li { display: flex; align-items: center; gap: 14px; padding: 10px 14px;
      border: 1px solid #342846; border-radius: 12px; background: #151020; }
    .thumb { width: 56px; height: 56px; flex: none; object-fit: contain;
      border-radius: 8px; background: #100b1a; }
    .thumb-icon { display: grid; place-items: center; color: #87bfff; font-size: 24px; font-weight: 700; }
    .meta { min-width: 0; flex: 1; }
    .name { font-weight: 700; overflow-wrap: anywhere; }
    .size { margin-left: 6px; color: #8e819d; font-size: 13px; font-weight: 400; }
    .license { margin-left: 8px; color: #8e819d; font-size: 13px; }
    .note { color: #c9bdd6; font-size: 15px; }
    .download { flex: none; padding: 8px 16px; border: 1px solid #87bfff; border-radius: 999px;
      color: #87bfff; font-weight: 800; font-size: 14px; text-decoration: none; }
    .download:hover { background: #87bfff; color: #0c0515; }
    .footnote { margin-top: 36px; color: #8e819d; font-size: 14px; }
    .footnote a { color: #87bfff; }
  </style>
</head>
<body>
  <main>
    <h1>Файлы для заданий</h1>
    <p class="lead">Раздатка задачника: картинки, звуки, шрифты и данные, которые просят скачать задания. Кладите скачанный файл рядом с программой (в Web IDE — загрузите в проект).</p>
${groupsHtml}
    <p class="footnote">Музыка — Kevin MacLeod (<a href="https://incompetech.com" rel="noopener">incompetech.com</a>), лицензия CC BY 4.0. Шрифты — SIL Open Font License (текст лицензии рядом с каждым шрифтом). Остальные материалы созданы командой Idyllium.</p>
  </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(outputRoot, 'index.html'), page, 'utf8');

  const total = manifest.groups.reduce((sum, group) => sum + group.items.length, 0);
  console.log(`handouts generated: ${total} files`);
}

function pendingTasksFragment(sectionId: string, lessonId: string, lessonTitle: string): string {
  return `<div class="docs-section docs-placeholder">
  <h2>Задания готовятся</h2>
  <p>Практикум по теме <strong>${escapeHtml(lessonTitle)}</strong> ещё не составлен.</p>
  <p>Пока его нет, вернитесь к <a href="../book/${escapeHtml(sectionId)}/${escapeHtml(lessonId)}">уроку</a>: примеры оттуда полезно повторить руками и переделать под себя.</p>
</div>
`;
}

function tasksShell(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <base href="./">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idyllium - Задачник</title>
  <link rel="icon" type="image/png" href="../book/favicon.png">
  <link rel="stylesheet" href="../book/fonts/fonts.css">
  <link rel="stylesheet" href="../book/app.css">
  <script src="../book/version.js" defer></script>
  <script src="../book/app.js" defer></script>
</head>
<body data-docs-mode="tasks">
  <header class="docs-topbar">
    <div class="topbar-left">
      <button class="icon-button menu-toggle" id="menu-toggle" type="button" title="Показать навигацию">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <a class="brand" href="../">
        <span class="brand-mark">I</span>
        <span class="brand-text">Idyllium</span>
        <span class="idyllium-version">v</span>
      </a>
      <span class="topbar-badge">Задачник</span>
    </div>
    <nav class="topbar-actions" aria-label="Основные действия">
      <a class="topbar-link" href="../">Открыть IDE</a>
      <a class="topbar-link" href="../book/">Учебник</a>
      <a class="topbar-link" href="../reference/">Документация</a>
      <button class="topbar-link" id="theme-toggle" type="button">Светлая тема</button>
    </nav>
  </header>

  <div class="docs-shell">
    <aside class="docs-sidebar" id="docs-sidebar">
      <div class="sidebar-head">
        <label class="search-box">
          <span>Поиск</span>
          <input id="lesson-search" type="search" autocomplete="off" placeholder="Найти тему">
        </label>
      </div>
      <nav class="lesson-nav" id="lesson-nav" aria-label="Темы"></nav>
      <a class="sidebar-handouts" href="../handouts/">📦 Файлы для заданий</a>
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

  return [...byId.values()];
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
  copyFileIfExists(path.join(sourceRoot, 'version.json'), path.join(outputRoot, 'version.json'));
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
  for (const file of ['index.html', 'app.css', 'app.js']) {
    copyFileIfExists(path.join(sourceRoot, file), path.join(outputRoot, file));
  }
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
