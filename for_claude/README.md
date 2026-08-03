# for_claude — рабочая папка Claude

Здесь живут отчёты и планы, которые Claude готовит по проекту Idyllium.

## Структура

- `reports/` — аналитические отчёты:
  - [language-analysis.md](reports/language-analysis.md) — подробный анализ синтаксиса и семантики ядра языка Idyllium;
  - [stdlib-analysis.md](reports/stdlib-analysis.md) — анализ стандартной библиотеки (15 модулей);
  - [docs-overview.md](reports/docs-overview.md) — карта документации `docs/`: что где лежит, как собирается, статус миграции;
  - [inconsistencies.md](reports/inconsistencies.md) — найденные расхождения и пробелы между документами (ai-reference ↔ api.json ↔ учебник);
  - [task-design-criteria.md](reports/task-design-criteria.md) — критерии хороших/плохих заданий и цепочек заданий (выведены из PDF-образцов в `pdf_examples/`);
  - [conspect-tasks-alignment.md](reports/conspect-tasks-alignment.md) — сопоставление конспекта «Условный оператор» с заданиями: пять типов связей, метрика покрытия, критерии связности С1–С8;
  - [conspect-criteria.md](reports/conspect-criteria.md) — сравнение хорошего и плохого конспектов: жанр «урок vs справочник», критерии Т1–Т12 и АТ1–АТ10, дополнение связности С9–С10;
  - [console-lessons-review.md](reports/console-lessons-review.md) — ревью всех 32 уроков раздела «Консоль» по критериям Т/АТ: сводная таблица вердиктов, сквозные паттерны, приоритеты правок;
  - [console-lessons-cards.md](reports/console-lessons-cards.md) — приложение: полные карточки каждого из 32 уроков;
  - [console-lessons-edit-report.md](reports/console-lessons-edit-report.md) — отчёт о выполненной редактуре всех 32 уроков «Консоли» (2026-07-24): все примеры прогнаны через компилятор, исправленные фактические ошибки, найденный техдолг;
  - [widgets-lessons-review.md](reports/widgets-lessons-review.md) — ревью 21 урока раздела «Виджеты» (только проверка, без правок): вердикты, фантомный API Timer, неточные тексты ошибок, приоритеты;
  - [widgets-lessons-cards.md](reports/widgets-lessons-cards.md) — приложение: полные карточки виджет-уроков;
  - [lessons-format-and-migration.md](reports/lessons-format-and-migration.md) — формат хранения уроков (3 слоя, словарь разметки, конвейер сборки) и безопасность миграции в manual-content;
  - [oop-lessons-review.md](reports/oop-lessons-review.md) — ревью 13 уроков раздела «ООП» (без правок): вердикты, фактическая ошибка в arrays (ссылочная семантика), баги компилятора (печать объекта → [object Object], регресс диагностики деструкторов), ответы компилятора на старые вопросы;
  - [oop-lessons-cards.md](reports/oop-lessons-cards.md) — приложение: полные карточки ООП-уроков;
  - [canvas-lessons-review.md](reports/canvas-lessons-review.md) — ревью 19 уроков «Canvas»: молчаливый set_origin в hit-test-серии, мёртвый delta_time, приоритеты;
  - [json-sqlite-lessons-review.md](reports/json-sqlite-lessons-review.md) — ревью «JSON» (самый крепкий раздел), «SQLite» (точная фактология, недостроенный хвост) и пустого «Примеры задач»; каталог реальных sqlite-ошибок; вопрос про FOREIGN KEY.

  - [widgets-lessons-edit-report.md](reports/widgets-lessons-edit-report.md) — отчёт о выполненной редактуре всех 21 урока «Виджетов» (2026-07-24): реальные тексты ошибок, синхронизация демо, удалённый фантомный API Timer (формулировки сохранены для возврата);
  - [merge-verification-report.md](reports/merge-verification-report.md) — сверка слияния с веткой команды компиляции: 8 исправлений подтверждены, 239 блоков уроков сверены с новым рантаймом, 6 добивочных правок;
  - [oop-lessons-edit-report.md](reports/oop-lessons-edit-report.md) — отчёт о выполненной редактуре всех 13 уроков «ООП» (2026-07-24): ссылочная семантика починена честными экспериментами, parent()-философия, свежие тексты ошибок, открытие про прощение `;` после класса.

  - [canvas-lessons-edit-report.md](reports/canvas-lessons-edit-report.md) — отчёт о редактуре 19 уроков «Canvas» (экономный режим) + доработка чекера команды (skip GUI-событийных, многофайловые примеры по конвенции `// имя.idyl`).

**Статус учебника: ВСЕ 110 уроков проверены и отредактированы (Консоль 32, Виджеты 21, ООП 13, Canvas 19, JSON 10, SQLite 14; examples/calc — заглушка, урок не написан).** Валидация: check-lesson-outputs — 0 расхождений по всей manual-content. Редактура JSON/SQLite: см. заметку в plans/next-steps.md (компактный режим, отдельного отчёта нет — правки перечислены в истории сессии).
  - [cr1-tasks-review.md](reports/cr1-tasks-review.md) — ревью 14 PDF заданий курса CR1_PROD по критериям К/А/Ц/Н, карточки по каждому файлу;
  - [cr2-tasks-review.md](reports/cr2-tasks-review.md) — ревью 9 PDF курса CR2_PROD (Pascal-базис, ~2020), включая пару «теория+задания» по сортировке.
- `CR1_PROD/`, `CR2_PROD/` — PDF-курсы заданий от автора (материал для ревью и будущего переноса в Idyllium).
- `pdf_examples/` — образцы от автора проекта: «хорошие»/«плохие» задания и «хороший»/«плохой» конспекты по теме условного оператора.
  - [real-it-methodology-extract.md](reports/real-it-methodology-extract.md) — извлечение из методичек школы Real-IT: новые принципы (N1–N12), каркасы урока/практикума/теории, 7 приёмов стимуляции фантазии, критерии тестов, межъязыковые «крошки» (Idyllium-сторона проверена компилятором).
- `real-it/` — методички IT-школы Real-IT от владельца (~1.5 г. назад, C++/Python/Pascal) — источник методологии.
- `ladder/` — «лестница навыков» раздела «Консоль» от владельца проекта (закон зависимости, доктрина «хода конём», карточки 33 уроков) — фундамент генерации заданий.
- `tasks/` — новые задачники для Idyllium:
  - [input-zadachnik.md](tasks/input-zadachnik.md) — задачник «Ввод данных» (урок №4): 21 задание, спина — градиент строгости get_int→get_float→get_string, конвейеры на абстракцию данных, поломки-наблюдения (if ещё нет), межъязыковая крошка (Python input() всегда строка); только console.write (writeln — №6); все образцы прогнаны.
  - [if-zadachnik.md](tasks/if-zadachnik.md) — задачник «Условный оператор» (урок №9): 4 блока (простое условие → if/else → мат-выражение в сравнении → звёздочки), 22 задания, управляется вводом (random недоступен), деление на ноль как история-модификация, межъязыковые крошки; все образцы прогнаны; все образцы прогнаны компилятором.
  - [random-zadachnik.md](tasks/random-zadachnik.md) — задачник «Случайные числа» (урок №11): 20 обязательных + 5 «со звёздочкой»; спойлеры минимизированы (ошибки/сюрпризы ученик открывает сам), покрыты int/float/математика над случайностью/лексические таблицы число→слово/mulberry32 с межъязыковым сравнением; разговорный тон; все образцы прогнаны компилятором.
- `plans/` — планы дальнейшей работы:
  - [next-steps.md](plans/next-steps.md) — черновик возможных следующих шагов (к обсуждению).

## Источники анализа

Всё построено на содержимом `docs/` по состоянию на 2026-07-24 (язык IdylliumNext **1.1.3**):

| Источник | Роль |
| --- | --- |
| `docs/ai/idyllium-ai-reference.md` | главный нормативный справочник (EN) |
| `docs/reference/api.json` | машинные сигнатуры из standard library registry + русская языковая секция |
| `docs/language-contract.md` | базовый контракт синтаксиса |
| `docs/book/` (110 уроков, 7 разделов) | детский учебник — примеры, идиомы, тексты ошибок |
| `docs/architecture.md`, `docs/canvas-draft.md`, `docs/colors.md` | архитектура и черновики решений |
| `docs/documentation-migration.md`, `docs/migration/*` | процесс миграции старой документации |
