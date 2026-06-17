const fs: any = require('fs');
const path: any = require('path');

export {};

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
}

interface InventoryLesson {
  readonly lessonPath: string;
  readonly subtitle: string;
  readonly reviewFlags: readonly string[];
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

const DEFAULT_SOURCE_ROOT = '/home/nathaniel/IdylliumProjects/Idyllium/docs';
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'docs');
const MANAGED_PATHS = [
  'assets',
  'content',
  'fonts',
  'ide',
  'favicon.png',
  'lessons.json',
  'version.js',
  'version.json',
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

const SECTION_ORDER = ['console', 'widgets', 'oop', 'canvas', 'json', 'examples'];

const MANUAL_LESSONS: readonly ManualLesson[] = [
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
    afterLessonId: 'lineedit',
    id: 'image',
    title: 'Виджет Image',
    subtitle: 'Как показать картинку в интерфейсе и не путать виджет с файлом',
    sourceFile: 'docs/manual-content/widgets/image.html',
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
    subtitle: 'drawable.Font, drawable.Text и координаты курсора',
    sourceFile: 'docs/manual-content/canvas/text.html',
    status: 'ready',
    reviewFlags: [],
  },
  {
    sectionId: 'canvas',
    id: 'sprites',
    title: 'Текстуры и спрайты',
    subtitle: 'Texture, Sprite и управление по WASD',
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
    id: 'temporary-objects',
    title: 'Временные объекты',
    subtitle: 'tmp, dyn_array и круги, появляющиеся по клику',
    sourceFile: 'docs/manual-content/canvas/temporary-objects.html',
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
];

const LESSON_EXTRAS: Record<string, string> = {
  'cli/005_colors.html': 'docs/manual-content/patches/console-colors-extra.html',
  'cli/009_increment.html': 'docs/manual-content/patches/console-increment-extra.html',
  'cli/024_files.html': 'docs/manual-content/patches/console-files-read-all.html',
};

const LESSON_REPLACEMENTS: Record<string, string> = {
  'cli/000_setup.html': 'docs/manual-content/console/setup.html',
  'oop/009_polymorphism.html': 'docs/manual-content/oop/polymorphism.html',
};

function main(): void {
  const sourceRoot = path.resolve(readArg('--source') ?? DEFAULT_SOURCE_ROOT);
  const outputRoot = path.resolve(readArg('--out') ?? DEFAULT_OUTPUT_ROOT);
  const lessonsRoot = path.join(sourceRoot, 'lessons');
  const lessonsJsonPath = path.join(lessonsRoot, 'lessons.json');

  if (!fs.existsSync(lessonsJsonPath)) {
    throw new Error(`old lessons.json does not exist: ${lessonsJsonPath}`);
  }

  prepareOutput(outputRoot);
  copyAssets(sourceRoot, outputRoot);
  copyWebIde(outputRoot);

  const oldLessons = JSON.parse(fs.readFileSync(lessonsJsonPath, 'utf8')) as OldLessonsJson;
  const inventory = readInventory();
  const convertedSections = oldLessons.sections.map((section) => convertSection(section, lessonsRoot, outputRoot, inventory));
  const manifest: SiteManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot,
    sections: orderedSections(withManualLessons(convertedSections, outputRoot)),
  };

  fs.writeFileSync(path.join(outputRoot, 'lessons.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const lessonCount = manifest.sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const needsReview = manifest.sections.flatMap((section) => section.lessons).filter((lesson) => lesson.status === 'needs-review').length;
  console.log(`docs site generated: ${manifest.sections.length} sections, ${lessonCount} lessons`);
  console.log(`needs review: ${needsReview}`);
  console.log(`output: ${outputRoot}`);
}

function convertSection(
  oldSection: OldSection,
  lessonsRoot: string,
  outputRoot: string,
  inventory: Map<string, InventoryLesson>,
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
    const lessonInventory = inventory.get(sourceFile);
    const reviewFlags = lessonInventory?.reviewFlags ?? [];
    const status = 'ready';
    const subtitle = lessonInventory?.subtitle ?? '';

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, fs.existsSync(sourcePath)
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
    .map((script) => transformLessonScript(sourceFile, script))
    .map((script) => `<script data-lesson-script type="text/plain">\n${escapeScriptText(script)}\n</script>`)
    .join('\n');
  const main = extractMain(normalized);
  const withoutHero = removeElementByClass(main, 'docs-hero');
  const withoutOldNav = removeElementByClass(withoutHero, 'docs-lesson-nav');
  const cleaned = withoutOldNav
    .replace(/<script\s+src=["'][^"']*version\.js["'][^>]*>\s*<\/script>/giu, '')
    .trim();
  const transformed = transformLesson(sourceFile, cleaned);
  const extra = readLessonExtra(sourceFile);

  return `${styles}${styles ? '\n\n' : ''}${transformed}${extra ? `\n\n${extra}` : ''}${scripts ? `\n\n${scripts}` : ''}\n`;
}

function transformLesson(sourceFile: string, html: string): string {
  if (sourceFile === 'widgets/002_label.html') {
    return html
      .replace(
        /gui\.Window win;\n    win\.width = 400;\n    win\.height = 200;\n\n    gui\.Label label;\n    label\.x = 20;\n    label\.y = 20;\n    label\.text = "Широкая электрификация южных губерний";\n\n    gui\.Button btn;\n    btn\.x = 50;\n    btn\.y = 20;\n    btn\.text = "Нажми меня";/u,
        `gui.Window win;
    win.width = 430;
    win.height = 180;
    win.title = "Перекрытие";

    gui.Label label;
    label.x = 24;
    label.y = 34;
    label.text = "Длинный текст лейбла тянется вправо";

    gui.Button btn;
    btn.x = 205;
    btn.y = 28;
    btn.width = 150;
    btn.height = 36;
    btn.text = "Кнопка";`,
      )
      .replace(
        /<div class="overlap-demo">\s*<div style="position: absolute; left: 20px; top: 20px; color: #cdd6f4; background: rgba\(0,0,0,0\.3\);">\s*Широкая электрификация южных губерний\s*<\/div>\s*<button style="position: absolute; left: 50px; top: 20px; padding: 8px 20px; background: linear-gradient\(135deg, #4a90d9 0%, #357abd 100%\); color: white; border: none; border-radius: 6px; cursor: pointer;">\s*Нажми меня\s*<\/button>\s*<div style="position: relative; min-height: 100px;"><\/div>\s*<\/div>/u,
        `<div class="overlap-demo">
        <div class="overlap-label">Длинный текст лейбла тянется вправо</div>
        <button class="overlap-button">Кнопка</button>
      </div>`,
      )
      .replace(
        /В этом примере кнопка оказалась <strong>поверх<\/strong> лейбла, потому что была добавлена позже\./u,
        'В этом примере кнопка частично закрывает лейбл, потому что была добавлена позже.',
      );
  }

  if (sourceFile === 'widgets/005_slider.html') {
    return html
      .replace(/slider\.max = 200;/gu, 'slider.max = 300;')
      .replace(/slider\.value = 100;/gu, 'slider.value = 150;')
      .replace(/slider\.step = 20;/gu, 'slider.step = 50;')
      .replace(/value="100" min="0" max="200" step="20"/gu, 'value="150" min="0" max="300" step="50"')
      .replace(/Диапазон 0–200, шаг 20/gu, 'Диапазон 0–300, шаг 50')
      .replace(/\[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200\]/gu, '[0, 50, 100, 150, 200, 250, 300]');
  }

  if (sourceFile === 'widgets/006_lineedit.html') {
    return html
      .replace(/input\.font_size = 16;/gu, 'input.font_size = 20;')
      .replace(/font-size: 16px;/gu, 'font-size: 20px;')
      .replace(/Шрифт увеличен до 16 пикселей/gu, 'Шрифт увеличен до 20 пикселей');
  }

  if (sourceFile === 'widgets/009_frame.html') {
    return html.replace(
      /<div class="demo-content" style="min-height: 200px; position: relative;">\s*<fieldset class="idyl-frame" style="position: absolute; left: 20px; top: 20px; width: 350px; height: 220px;">/u,
      '<div class="demo-content" style="min-height: 280px; position: relative;">\n            <fieldset class="idyl-frame" style="position: absolute; left: 20px; top: 20px; width: 350px; height: 220px;">',
    );
  }

  return html;
}

function transformLessonScript(sourceFile: string, script: string): string {
  if (sourceFile !== 'widgets/015_modal.html') return script;

  return `document.addEventListener('DOMContentLoaded', () => {
  const docsModal = window.idylliumDocs;

  const alertDemoBtn = document.getElementById('alertDemoBtn');
  if (alertDemoBtn && docsModal) {
    alertDemoBtn.addEventListener('click', () => {
      void docsModal.alert('Уведомление\\n\\nЭто простое информационное сообщение.');
    });
  }

  const confirmDemoBtn = document.getElementById('confirmDemoBtn');
  const confirmResult = document.getElementById('confirmResult');
  if (confirmDemoBtn && confirmResult && docsModal) {
    confirmDemoBtn.addEventListener('click', async () => {
      const result = await docsModal.confirm('Вы уверены, что хотите продолжить?');
      confirmResult.textContent = 'Результат: ' + (result ? 'Да' : 'Нет');
    });
  }

  const inputDemoBtn = document.getElementById('inputDemoBtn');
  const inputResult = document.getElementById('inputResult');
  if (inputDemoBtn && inputResult && docsModal) {
    inputDemoBtn.addEventListener('click', async () => {
      const name = await docsModal.prompt('Как вас зовут?', 'Idyllium');
      if (name === null || name === '') {
        inputResult.textContent = 'Вы не ввели имя!';
      } else {
        inputResult.textContent = 'Привет, ' + name + '!';
      }
    });
  }

  const fullAlertBtn = document.getElementById('fullAlertBtn');
  const fullConfirmBtn = document.getElementById('fullConfirmBtn');
  const fullInputBtn = document.getElementById('fullInputBtn');
  const fullResultLabel = document.getElementById('fullResultLabel');

  if (fullAlertBtn && docsModal) {
    fullAlertBtn.addEventListener('click', () => {
      void docsModal.alert('Уведомление\\n\\nЭто простое информационное сообщение.');
    });
  }

  if (fullConfirmBtn && fullResultLabel && docsModal) {
    fullConfirmBtn.addEventListener('click', async () => {
      const result = await docsModal.confirm('Вы уверены, что хотите продолжить?');
      fullResultLabel.textContent = 'Вы нажали: ' + (result ? 'Да' : 'Нет');
    });
  }

  if (fullInputBtn && fullResultLabel && docsModal) {
    fullInputBtn.addEventListener('click', async () => {
      const name = await docsModal.prompt('Как вас зовут?', 'Idyllium');
      fullResultLabel.textContent = name === null ? 'Привет, !' : 'Привет, ' + name + '!';
    });
  }
});`;
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
  copyFileIfExists(
    path.join(sourceRoot, 'lessons', 'widgets', 'gui.css'),
    path.join(outputRoot, 'assets', 'gui.css'),
  );
  copyFileIfExists(
    path.resolve(process.cwd(), 'my_images', 'cat.png'),
    path.join(outputRoot, 'assets', 'cat.png'),
  );
}

function writeCurrentVersion(outputPath: string): void {
  const packagePath = path.resolve(process.cwd(), 'package.json');
  const version = fs.existsSync(packagePath)
    ? String(JSON.parse(fs.readFileSync(packagePath, 'utf8')).version ?? '1.0.0')
    : '1.0.0';
  fs.writeFileSync(outputPath, `${JSON.stringify({ version }, null, 2)}\n`, 'utf8');
}

function copyWebIde(outputRoot: string): void {
  const sourceWebDir = path.resolve(process.cwd(), 'dist', 'web');
  const outputIdeDir = path.join(outputRoot, 'ide');
  if (!fs.existsSync(sourceWebDir)) {
    throw new Error(`web IDE build does not exist: ${sourceWebDir}`);
  }
  fs.cpSync(sourceWebDir, outputIdeDir, { recursive: true });
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

function readInventory(): Map<string, InventoryLesson> {
  const inventoryPath = path.resolve(process.cwd(), 'docs/migration/lesson-inventory.json');
  const result = new Map<string, InventoryLesson>();
  if (!fs.existsSync(inventoryPath)) return result;

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  for (const lesson of inventory.lessons ?? []) {
    result.set(normalizePath(lesson.lessonPath), lesson);
  }
  return result;
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
