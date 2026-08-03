# Расхождения и пробелы в документации Idyllium

Дата: 2026-07-24. Сравнивались: `docs/ai/idyllium-ai-reference.md` (далее **REF**), `docs/reference/api.json` (**API**, генерируется из registry, свежий — 2026-07-19), уроки `docs/book/content/**` (**BOOK**), `docs/migration/outdated-syntax-report.md` (**MIG**, реальный вывод компилятора на старых уроках).

Приоритет истины, который я предполагаю: registry/API ≈ REF > BOOK (учебник местами несёт следы старого языка). Всё ниже стоит проверить по `src/core` перед правками.

---

## A. REF ↔ API (нормативные источники противоречат друг другу)

| # | Что | REF | API | Комментарий |
| --- | --- | --- | --- | --- |
| A1 | `file.istream.has_next_line()` | не упомянут | есть (`has_next_line(): bool`) | BOOK активно использует в идиоме чтения файла; REF надо дополнить |
| A2 | глобальные `max/min/sum/avg` | описаны (агрегаты числовых массивов) | в `globals` только `div, mod, to_int, to_float, to_string` | пробел генератора api.json или registry |
| A3 | `sqlite.Statement.sql` | не упомянуто | есть (ro-свойство) | мелочь, но REF претендует на полноту |
| A4 | Иерархия типов (`extends`) | описана текстом (Widget как база; image.Image как база; Drawable как база) | поле `extends` пустое у всех типов | из-за этого у `image.Static` в API «нет» унаследованных свойств, у Label/Frame «нет» `font` — машинному потребителю API иерархия недоступна |
| A5 | `json.Value.to_pretty_json` | «to_pretty_json()» и «to_pretty_json(indent)» без дефолта | `indent: int = 2` | BOOK всюду использует 4; дефолт 2 нигде в человекочитаемых доках не назван |

## B. BOOK ↔ REF/API (уроки описывают то, чего нет в нормативных источниках, или наоборот)

| # | Что | BOOK | REF/API | Оценка |
| --- | --- | --- | --- | --- |
| B1 | `gui.Timer` | свойство `running` (ro), метод `restart()` | только `interval`, `on_tick`, `start()`, `stop()` | либо урок описывает нереализованный API, либо registry отстал. Проверить в src |
| B2 | `math.atan()` | есть (урок «Продвинутые инструменты math», с asin/acos) | отсутствует в обоих | вероятная дыра registry (asin/acos есть, atan нет) либо ошибка урока |
| B3 | `math.round/floor/ceil(value, digits)` | второй необязательный аргумент — число знаков | сигнатуры однопараметрические, возврат int | серьёзное расхождение: с digits возврат не может быть int |
| B4 | `random.create_float(min, max)` | «от min до max включительно» | min включён, max исключён | текст урока скопирован с create_int; REF точнее |
| B5 | Missing return в типизированной функции | **warning** `main.idyl: warning: 'int' function must return a value` (без номера строки!) | MIG показывает **error**: `error: function with return type 'int' must return a value` | урок устарел: сейчас это ошибка компиляции |
| B6 | Печать массива строк | dyn-array.html: без кавычек `[Верстак, Кирка, Меч]` | REF: с кавычками и экранированием `["Кирка\n", ...]`; другие уроки — с кавычками | dyn-array.html не переписан под новый рантайм |
| B7 | `int N = 10; N /= 4;` | increment.html: «то же самое, что N = N / 4» | `/` всегда float → для int это ошибка компиляции (`cannot assign 'float' value to 'int'`) | прямое противоречие ядру языка в уроке |
| B8 | Квалификация классов из модулей | oop/modules.html: `rect.Rect r1;`; oop/errors.html: «после `use cat;` заработает `Cat c;`» (без префикса) | REF: только `geometry.Point p;` (квалифицированно) | oop/errors.html противоречит и соседнему уроку, и REF |
| B9 | `;` после объявления класса | oop/errors.html: требуется, ошибка `expected ';' after class definition` | ни один пример (включая сам errors.html) `;` не ставит | реликт C++-синтаксиса в тексте ошибки |
| B10 | ProgressBar.value | «проценты 0–100» | у ProgressBar есть min/max | урок упрощает; с min/max value не обязан быть процентом |
| B11 | `types.float32/64.from_bin` | — | `from_bin/from_hex` общие, тип строкой | согласовано, но BOOK показывает вызовы только для целых; float-вариант не покрыт уроками |
| B12 | `not` | console-урок: «отрицание — только функция not(выражение)» | REF: `not` — оператор с высшим приоритетом (форма `not(x)` — просто скобки) | формулировка урока технически неверна, но конвенция записи совпадает |
| B13 | Дефолтные значения неинициализированных переменных | BOOK: int→0, float→0.0, bool→false, char→'\0', string→"" («мусора нет») | REF и API молчат | важное правило семантики отсутствует в нормативных доках |
| B14 | Строковые сравнения | BOOK/MIG: `==`/`!=` для строк валидны; `>` для строк — ошибка `comparison '>' requires numeric operands` | REF перечисляет операторы без ограничений по типам | REF стоит уточнить: порядковые сравнения — только числовые |
| B15 | `audio.Music` в уроке on_finished загружает `"click.wav"` | — | Music позиционируется для длинных треков | работает, но противоречит собственной классификации урока |
| B16 | `canvas.clear()` | появляется один раз без объяснения; «очистка» в уроках — `fill(color)` | REF: `clear()` есть, семантика цвета после clear не описана | пробел спецификации + непоследовательность уроков |

## C. Тексты диагностик: BOOK ↔ реальный компилятор (MIG)

Учебник массово цитирует **старые формулировки ошибок**. Актуальные тексты (правая колонка) взяты из `outdated-syntax-report.md` — это фактический вывод компилятора 2026-06.

| BOOK (устаревшее) | Компилятор сейчас |
| --- | --- |
| `condition must be 'bool', found 'int'` | `if condition must be 'bool', got 'int'` |
| `function 'add' expects 2 argument(s), got 3` | `'add' expects 2 arguments, got 3` |
| `array initialization has 3 elements, expected 5` | `array initializer has 3 elements, but 'array<int, 5>' requires 5` |
| `'.add' is only available on dynamic arrays (dyn_array)` | `method 'add' is only available on 'dyn_array'` |
| `cannot assign 'float' to 'int'` (label.html также `cannot assign 'int' to 'string'` без токена `error:`) | `cannot assign 'float' value to 'int' variable` |
| `'math' was not declared in this scope` | `'math' is not imported (use 'use math;')` |
| `'hp' is private in this context` (иногда даже без номера строки) | `member 'BankAccount.balance' is private and can only be used inside class 'BankAccount'` |
| `'meow' is not a static member of 'Cat'` | `instance method 'Cat.meow' must be called on an object` |
| `parameter type 'gui.Label' does not match event type 'gui.Button'` | `callback property 'on_click' expects function(): void or function(gui.Button): void, got function(gui.Label): void` |
| `cannot add 'gui.Modal' to window (Modal is not a widget)` | `'add_child' argument 1 expects gui widget, got 'gui.Modal'` |
| `'gui.Button' has no property 'placeholder'` | `type 'gui.Button' has no property 'placeholder'` (почти совпало) |
| `'void' function cannot return a value` | `void function cannot return a value` |

Отдельно: BOOK непоследователен в **формате** (`file:line:` иногда без токена `error:`; runtime error иногда без префикса file:line; MIG даёт и колонку: `file:line:col:`).

## D. Внутренние противоречия и дефекты уроков

1. **oop/errors.html** — секции 4–5 физически отсутствуют (комментарии прыгают с Section 3 на 6), при этом «Итог» ссылается на правило из удалённой секции (`parent()` первым).
2. **`Empty()`** в oop/constructor.html — класс нигде не определён; обрывок вырезанного примера.
3. **Шуточные warnings** (`warning: ⚠️ ... торговля людьми — уголовно наказуемое преступление`, про кирпичи) поданы как реальный вывод компилятора: русскоязычные, тогда как все ошибки англоязычные. Педагогически мило, но создаёт ложное представление о диагностике (и «этических предупреждений» в компиляторе, надо полагать, нет).
4. **Стили именования скачут**: snake_case почти везде, но oop/modules.html — `getArea/scaleX`, oop/composition.html — `colorR/redValue` (camelCase). REF требует snake_case для canvas-коллбэков; общего правила стиля нет нигде.
5. **Инкремент**: `i = i + 1` в большинстве уроков vs `+= 1` в timer/reuse (REF рекомендует `+= 1`).
6. **Синтаксически битые примеры-«ошибки»**: `if (money = 100) { // ОШИБКА! ... }` — закрывающая `}` проглочена комментарием.
7. **Комментарии с неверными индексами**: array.html «вывод второй ячейки» для `P[2]`, «нет шестой ячейки» для `K[6]`.
8. **frame.html**: Frame (350×220) вылезает за окно (350×200); поведение обрезки не оговорено.
9. **button.html**: текст урока не совпадает со строкой в коде (`"Нет, мой!"` vs «Нет, мой лейбл!»).
10. **sqlite-уроки не закрывают Result** у INSERT/UPDATE (`db.execute(...)` с игнорированием результата) — противоречит собственному правилу «после выполнения оба объекта следует закрыть».
11. **canvas: фрагменты со statement'ами на верхнем уровне** (вызовы методов вне функций) — в полных программах top-level содержит только объявления; фрагменты могут научить неверной структуре.
12. **sprites.html**: иллюстративный пример рисует в Canvas без окна/add_child/show — нерабочий код.
13. **trim()** описан как «удаляет управляющие символы из строки» — не уточнено, что с краёв (и так ли это); примеры показывают только снятие завершающего `\n`.
14. **examples/000_calc** («Калькулятор») — честная заглушка мигратора, урока нет. Плюс MIG помечает его `missing-html-file`.
15. **console/set_precision** используется в types-уроке, но нигде не введён в console-разделе.
16. **oop/this.html**: обещает метод, «который возвращает строковое представление», код же печатает и возвращает void.

## E. Пробелы спецификации (не описано нигде)

1. **Модель памяти объектов** — единственное упоминание ссылочной семантики классов: api.json (classes → «Объекты имеют ссылочную семантику»). В REF и BOOK правило явно не сформулировано; поведение `dyn_array<Object>.add` (копия массива при value-semantics массивов, но ссылки в ячейках) требует внятного описания.
2. **Список значений `KeyboardEvent.key`** для спецклавиш (стрелки, Space, Enter, Shift...) — нигде; уроки показывают только латинские буквы в верхнем регистре.
3. **`MouseScrollEvent.delta`** — знак, шаг, диапазон.
4. **Дефолты виджетов**: размеры по умолчанию, `echo_mode` по умолчанию, `selected_index` у пустого ComboBox, дефолты SpinBox min/max, дефолт `confirm_text`/`cancel_text` у Modal (урок называет «OK» только для confirm).
5. **`json.Object.set()` при отсутствующем ключе** и **`json.Array.insert()` за границей** — поведение не задано (по аналогии ошибки, но не написано).
6. **`json.Value(container)`** — копия или ссылка при упаковке Object/Array.
7. **Одновременные открытые `sqlite.Result`** и требования к порядку закрытия (Result → Statement → Database — только фактический стиль примеров).
8. **Область видимости и затенение (shadowing)** переменных в блоках — не описаны формально.
9. **Сравнение `char`** (`==`, порядковые) — не специфицировано.
10. **Точность/диапазон `int` и `float` ядра** (не `types`) — не зафиксированы (видимо, JS number/double и «безопасные» целые; REF намекает через «выше 2^53» в json, но правило ядра не сформулировано).
11. **`main` возвращаемое значение**: BOOK (console) говорит «Web IDE вычисляет, но не показывает», REF — «ignored by Web IDE/GUI preview»; поведение CLI не описано.
12. **`\e`** — нестандартный escape (в C-семействе это расширение); выбор объяснён только косвенно (ANSI-уроки).

## F. Каталог устаревших тем, уже отмеченных самим проектом

`documentation-migration.md` и MIG честно фиксируют: 42/221 программных блока старых уроков не компилируются; 45 уроков требуют ручного ревью; legacy-паттерны — `++/--`, строковый `widget.color = "#FF0000"`, `progress.fill_color`, `gui.Image`, `drawable.Texture`, `drawable.Font`, `json.NULL`. Новый учебник (docs/book) переписан, но пункты B5–B9, C и D показывают, что часть реликтов пережила миграцию.

---

## Рекомендации (по убыванию пользы)

1. **Синхронизировать тексты ошибок в BOOK с компилятором** (раздел C) — самый массовый класс расхождений; идеально — прогонять цитируемые ошибки тем же скриптом, что делает `npm run docs:inventory`, и сверять строки.
2. **Починить B7 (`N /= 4` для int)** и **B6 (печать массивов строк)** — это противоречия ядру языка в учебнике.
3. **Разобраться с B1–B3 (Timer.running/restart, math.atan, round(value, digits))** — сверить с registry в `src/core`; либо дописать registry, либо править уроки.
4. **Выразить `extends` в api.json (A4)** — иначе любой машинный потребитель (включая ИИ-ассистентов) видит неполные списки свойств.
5. **Дополнить REF**: has_next_line (A1), агрегаты в globals-раздел api.json (A2), дефолтные значения переменных (B13), правило «порядковые сравнения только числовые» (B14), ссылочная семантика объектов (E1).
6. **Задокументировать клавиши и delta (E2, E3)** — первое, обо что споткнётся ребёнок, делающий игру со стрелками.
7. Дочистить D-мелочи при следующем проходе по урокам (битые примеры, индексы, заглушка калькулятора).
