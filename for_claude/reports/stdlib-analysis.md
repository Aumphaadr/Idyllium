# Idyllium: анализ стандартной библиотеки (15 модулей + глобальные функции)

Дата: 2026-07-24, язык 1.1.3. Сводка построена на трёх источниках: `docs/reference/api.json` (машинные сигнатуры из registry), `docs/ai/idyllium-ai-reference.md` (семантика), уроки `docs/book/content/**` (поведение, диапазоны, тексты ошибок). Расхождения между источниками помечены ⚠️ и продублированы в [inconsistencies.md](inconsistencies.md).

Модули: `console`, `math`, `random`, `time`, `file`, `encoding`, `json`, `audio`, `image`, `fonts`, `gui`, `drawable`, `colors`, `types`, `sqlite`.

---

## 0. Глобальные функции (без `use`)

| Функция | Сигнатура | Семантика |
| --- | --- | --- |
| `div` | `div(left: int, right: int): int` | целая часть частного; только целые; `div(10, 0)` → runtime error «division by zero» |
| `mod` | `mod(left: int, right: int): int` | остаток; только целые |
| `to_int` | `to_int(value): int` | из строки/float/int; строка не число → runtime error `'to_int' cannot convert "abc" to integer`; float усекается к нулю |
| `to_float` | `to_float(value): float` | из строки/числа |
| `to_string` | `to_string(value): string` | из любого значения |
| `max/min/sum` | `max(arr)` … | числовые массивы; int-массив → int-результат, float → float; пустой/нечисловой массив → runtime error |
| `avg` | `avg(arr): float` | всегда float (= `sum(arr) / arr.length`) |

⚠️ `max/min/sum/avg` описаны в ai-reference и уроках, но отсутствуют в `api.json.globals`.

---

## 1. `console`

```idyllium
console.write(...values)     // без \n и без разделителей между аргументами
console.writeln(...values)   // + \n
console.get_int(): int       // блокирует до Enter; не-число → runtime error
console.get_float(): float
console.get_string(): string
console.clear()              // очищает видимую область (не отменяет код)
console.set_precision(digits) // 0..25, формат вывода float
```

- `write`/`writeln` — вариадики, аргументы любых типов; **именованные аргументы к ним неприменимы**.
- Ошибка ввода: `runtime error: cannot convert input to 'int' (expected integer, got "abc")`.
- ANSI-цвета через escape `\e`: `"\e[30m".."\e[37m"` тёмные, `"\e[90m".."\e[97m"` светлые, `"\e[0m"` сброс. Цвет «заражает» весь дальнейший вывод до сброса. Идиома динамического кода: `"\e[" + to_string(30 + n) + "m"`.
- Float с целым значением печатается без дробной части (`4`, а не `4.0`); точность по умолчанию ~13–16 значащих цифр.
- Печать составных значений: массив — `[10, 20, 30]`; строки внутри массива — в кавычках с видимыми `\n` (`["Кирка\n", "Меч"]`); `bool` — `true`/`false`; объект класса печатать нельзя (`error: cannot print object of class 'Cat' directly`).

## 2. `math`

Константы-свойства: `math.pi`, `math.e`.

`abs`, `sqrt` (аргумент < 0 → `runtime error: math.sqrt argument must be >= 0 (got -4)`), `round`, `floor`, `ceil` (→ int), `pow(value, power)` (`pow(4, -1)` → 0.25), `clamp(min, value, max)` — **значение в середине**, `sin/cos/tan` (радианы), `asin/acos` (аргумент −1..1), `log` (натуральный, аргумент ≤ 0 → runtime error), `log10`, `to_radians(deg)`, `to_degrees(rad)`.

⚠️ Уроки дополнительно показывают: `math.atan()` и необязательный второй аргумент у `round/floor/ceil` (число знаков после запятой) — в registry (api.json) и ai-reference этого **нет**.

## 3. `random`

```idyllium
random.create_int(min, max)    // ОБА конца включительно; min == max допустим
random.create_float(min, max)  // min включён, max исключён; требует min < max
random.choose_from(x)          // строка → char; array/dyn_array → T; пустая коллекция → runtime error
random.set_seed(seed)          // неотрицательный int; воспроизводимость
```

Невалидный диапазон — runtime error; язык **не** меняет границы местами и не клампит. ⚠️ Урок утверждает, что `create_float` включает обе границы — противоречит референсу. ГПСЧ не криптостойкий.

## 4. `time`

```idyllium
time.sleep(seconds)                       // неотрицательные, может прервать IDE
time.now(timezone = "UTC"): time.stamp
time.from_unix(seconds, timezone = "UTC"): time.stamp
```

`time.stamp` — read-only свойства (не методы!): `year, month (1..12), day, hour, minute, second, week_day (0=вс..6=сб), unix, timezone`; методы `in_timezone(name)` (новый stamp того же момента, `unix` не меняется) и `to_string()` (формат `2025-11-29 18:55:36`). IANA-зоны (`"Asia/Yekaterinburg"`); невалидная зона — runtime error; историю переходов и DST даёт host `Intl`.

## 5. `file`

Открытие потоков — только фабрика: `file.open(path, mode)`, режимы `"read"` / `"write"` (append нет). Публичных конструкторов у потоков нет.

`file.istream`: `read(count?)` (count символов Unicode — не байтов; без аргумента = всё), `read_line()` (сохраняет завершающий `\n`, кроме последней строки; чтение за концом — runtime error), `read_all()`, `has_next_line(): bool`, `close()`, свойство `is_open` (ro). Позиция чтения общая у всех методов. `read()` на EOF → пустая строка. ⚠️ `has_next_line()` есть в api.json и уроках, но не упомянут в ai-reference.

`file.ostream`: `write(...values)` (точно как console.write — без разделителей), `write_line(...values)` (+`\n`; числа сериализуются), `close()`, `is_open` (ro). `"write"` создаёт/усекает файл; родительская папка обязана существовать.

Файловая система проекта:

```idyllium
file.exists(p); file.is_file(p); file.is_directory(p)
file.list_directory(p): dyn_array<string>       // отсортированы
file.create_directory(p, parents = false)
file.copy(src, dst); file.rename(src, dst)      // не перезаписывают занятый dst; rename = и перенос
file.remove(p, recursive = false)               // непустая папка требует recursive=true
```

Мутирующие операции ограничены корнем проекта (`../` не выводит наружу). Ошибки: `cannot open file "data.txt" for reading (file not found)`, `file.open() cannot open 'saves/player.txt' for writing: directory does not exist`.

## 6. `encoding`

Ровно 4 кодировки: `"ascii"`, `"utf-8"`, `"windows-1251"`, `"koi8-r"` (+ алиасы `utf8`, `cp1251`, `win1251`, `koi8r`). `list_encodings()`, `char_to_codepoint(c)` (`'б'`→1073), `codepoint_to_char(n)` (0..1114111 без суррогатов 55296..57343), `encode(text, enc): dyn_array<int>`, `decode(bytes, enc): string`.

Декодирование строгое — никакого `�`: `runtime error: encoding.decode() invalid UTF-8 at byte 0 (0xD0): incomplete sequence`, `runtime error: character 'Ю' is not valid ASCII at position 0`, `runtime error: unknown encoding 'cp866'`. Windows-1251/KOI8-R — полные 256-байтные таблицы.

## 7. `colors`

Тип-значение `colors.Color`; каналы read-only: `red, green, blue: int (0..255)`, `alpha: float (0.0..1.0)`.

Фабрики: `RGB(r,g,b)`, `RGBA(r,g,b,alpha)`, `HEX("#RRGGBB"|"RRGGBBAA")`, `HSL(hue 0..360, sat 0..100, light 0..100)`. Невалидные каналы — runtime error (не клампятся!).

17 констант (BLACK, WHITE, RED, GREEN `#00FF00` — именно яркий, BLUE, YELLOW, CYAN, MAGENTA, GRAY, LIGHT_GRAY, DARK_RED, DARK_GREEN, DARK_BLUE, OLIVE, TEAL, PURPLE, TRANSPARENT = RGBA(0,0,0,0.0)).

Иммутабельные модификаторы, каждый возвращает **новый** цвет: `with_red/green/blue(value)`, `with_alpha(value)`, `with_rgb(...)`, `with_rgba(...)`. Сравнение цветов — по каналам RGBA: `colors.RGB(255,0,0) == colors.HEX("#ff0000")` → true.

Конвенция API: свойства называют роль цвета (`text_color`, `background_color`, `border_color`, `foreground_color`); принимают только `colors.Color` — HEX-строка требует явного `colors.HEX()`.

## 8. `types` — машинные типы (сознательное исключение из философии)

`int8/uint8/int16/uint16/int32/uint32/int64/uint64` + `float32/float64` (IEEE-754 binary32/64). Точные диапазоны фиксированы в референсе; **переполнение молча заворачивается** (uint8: 255+1→0; `types.uint8 a = -11;` → 245). int64/uint64 держат полный 64-битный диапазон точно (выше 2^53).

- Смешанная арифметика `types`-значение × `int` → обычный int-результат, затем присваивание приводит к целевому типу. `/` по-прежнему float; `div/mod` — для целочисленного.
- float → integer-типы только через `to_int()`.
- Значения `types` принимаются обычными числовыми функциями (`math.sqrt`).
- Битовые хелперы значений: `to_bin()`, `to_hex()`, `shift_left(bits)`, `shift_right(bits)` (логический сдвиг в пределах ширины; знак не сохраняется; сдвиг ≥ ширины → нули; отрицательный аргумент меняет направление; float сдвигает сырое IEEE-представление), `bit_and/bit_or/bit_xor(mask)` (маска — **unsigned той же ширины**: int8/uint8→uint8 … int64/uint64/float64→uint64), `bit_not()`.
- Фабрики модуля: `types.from_bin("11011101", "uint8")`, `types.from_hex("FF", "uint8")` — целевой тип передаётся **строкой**.

## 9. `json`

Типы: `json.Value` (nullable-обёртка), `json.Object`, `json.Array`. Функции: `json.parse(text): json.Value` (в т.ч. голый скаляр: `json.parse("12")`), `json.is_valid(text): bool`, конструктор `json.Value(value = null)`.

`json.Value`: `is_null/is_string/is_int/is_float/is_bool/is_object/is_array`, `to_string/to_int/to_int64/to_uint64/to_float/to_bool/to_object/to_array`, `set_null/set_string/set_int/set_float/set_bool/set_object/set_array`, `to_json()`, `to_pretty_json(indent = 2)`. Нюансы:

- `is_int()` истинно только для целого; `is_float()` — для любого числа.
- JSON-целые парсятся точно, включая > 2^53: `to_int64()/to_uint64()`; `json.Value(types.int64)` сериализуется без потери цифр, без кавычек.
- Неверный тип конверсии → `runtime error: json value is string, expected int`.
- `value == null` и `value.is_null()` равнозначны.

`json.Object`: свойство `length`; `has(key)`, `get(key)` (нет ключа → `json object has no key 'level'`), `add(key, value)` (ключ должен быть новым → `json object already has key 'name'`), `set(key, value)` (обновляет существующий), `remove(key)`, `keys(): dyn_array<string>`. Порядок ключей — порядок вставки.

`json.Array`: `length`; `at(index)` (границы проверяются: `json array index 5 out of bounds (size 3, valid indices 0-2)`), `set`, `add`, `insert`, `pop`, `remove(index)`, `clear()`. Элементы — только `json.Value` (упаковка обязательна: `scores.add(json.Value(5))`).

Формат вывода: `to_json()` компактный (`{"name":"Liam","age":12}`), `to_pretty_json(4)` — переносы, отступ 4, пробел после `:`.

## 10. `sqlite`

`sqlite.open(path): sqlite.Database` — открывает/создаёт файл БД; относительные пути от исполняемого `.idyl`; одинаково работает в CLI/VSIX/Web IDE (Web IDE хранит бинарный `.db` в виртуальном проекте).

`Database` — props ro: `path`, `is_open`, `in_transaction`; методы: `execute(sql): Result` (ровно один SQL-оператор), `prepare(sql): Statement`, `exec_script(sql)` (много операторов, SELECT-строки отбрасываются, транзакцию сам не открывает), `begin_transaction()`, `commit()`, `rollback()`, `close()` (незавершённая транзакция при close → автоматический rollback). Вложенных транзакций/savepoints нет.

`Statement` — props ro: `is_open`, `sql`; параметры **только** формы `:name` (`?`, `@name`, `$name` сознательно не поддерживаются); `bind("name", value)` — имя без двоеточия, тип выводится (int/float/string/char/bool/null/`types`-целые/`sqlite.Value`); типизированные `bind_int/bind_int64/bind_float/bind_string/bind_bool/bind_null` — когда важен storage class (например `bind_float` для REAL при целом значении). Все параметры должны быть привязаны до `execute()` (`runtime error: sqlite statement has unbound parameter ':level'`); привязки **сохраняются** после execute (переиспользование), `clear_bindings()` очищает; `execute(): Result`; `close()`.

`Result` — props ro: `is_open`, `has_rows`, `affected_rows`, `last_insert_id: sqlite.Value` (null, если ничего не вставлено; идиома `saved.last_insert_id.to_int64()`); методы: `next(): bool` (курсор стартует **до** первой строки; getter до `next()` — ошибка), `get(column): sqlite.Value`, `is_null(column)`, `get_int/get_int64/get_float/get_string`, `get_bool` (только INTEGER 0/1), `column_count()`, `column_name(index)`, `close()`. Ошибки: `sqlite column 'name' is text, expected int`, `sqlite result has no column 'score'`. Результаты — буферизованные снимки, переживают закрытие Statement.

`sqlite.Value` — nullable: `is_null/is_int/is_float/is_string`, `to_int/to_int64/to_float/to_string/to_bool`; сравним с `null`.

BLOB-типа пока нет. Правило безопасности учебника: не конкатенировать пользовательский ввод в SQL — только параметры.

Преподаваемый SQL (уроки): CREATE TABLE [IF NOT EXISTS] / DROP TABLE IF EXISTS, PRIMARY KEY, AUTOINCREMENT, UNIQUE, NOT NULL, DEFAULT; INSERT (мультистрочный VALUES), SELECT [DISTINCT], WHERE (с параметрами), ORDER BY … DESC, LIMIT, вычисляемые колонки AS, UPDATE (арифметика в SET), DELETE, агрегаты COUNT/MIN/MAX/AVG, GROUP BY, FOREIGN KEY … REFERENCES, JOIN … ON, LEFT JOIN, алиасы таблиц. Не преподаются: UPSERT/ON CONFLICT, HAVING, ALTER TABLE, индексы, SQL-операторы BEGIN/COMMIT (только API-методы).

## 11. `gui`

### Базовая модель

- Виджет = обычная переменная (`gui.Button button;`), свойства присваиваются напрямую, потом `parent.add_child(widget)`, в конце `win.show()`. Добавлять виджеты можно и после `show()`.
- Виджет отображается только при выполненных `add_child` **и** `show()`; забытый `add_child` — молчаливая невидимость.
- Z-порядок = порядок `add_child` (последний сверху). API удаления потомка нет; «удаление» — `visible = false`.
- Наследование свойств: `text_color`, `background_color`, `font`, `font_size` передаются от Window/Frame к потомкам; собственное значение потомка важнее. `font_size` — свойство текстового виджета (не шрифта), дефолт 13.
- Коллбэки: `void function()` либо `void function(<ТочныйТипВиджета> sender)`; несовпадение типа sender — ошибка компиляции.

### Виджеты (сигнатуры registry + семантика уроков)

| Тип | Свойства | Методы/события |
| --- | --- | --- |
| `Window` | x, y, width, height, title, text_color, background_color, font, font_size | `add_child(child)`, `show()` |
| `Label` | x, y, width, height, visible, text, font_size, text_color, background_color, border_color | `on_click` |
| `Button` | как Label | `on_click` |
| `Frame` | x, y, width, height, visible, title, font_size, background_color, border_color, border_width | `add_child(child)` — координаты детей относительно рамки; вложение Frame в Frame допустимо; скрытие скрывает потомков |
| `LineEdit` | + text, placeholder, echo_mode (`"normal"`/`"password"`/`"no_echo"`), font_size, цвета | `on_change` (каждое изменение текста) |
| `TextEdit` | как LineEdit без echo_mode; многострочный (`\n` в text) | `on_change` |
| `SpinBox` | value, min, max, step: int | `on_change` |
| `FloatSpinBox` | value, min, max, step: float | `on_change` |
| `Slider` | value, min (дефолт 0), max (дефолт 100), step: int; без font_size | `on_change` |
| `CheckBox` | text, is_checked, font_size | `on_change` |
| `RadioButton` | text, is_selected, group: string, font_size | `on_change`; без group все кнопки контейнера — одна группа |
| `ComboBox` | selected_index, selected_text (ro, следует за index), font_size | `add_item(text)`, `clear_items()`, `on_change` |
| `ProgressBar` | value, min, max, font_size, text_color (проценты на полоске), background_color (незаполненная часть), foreground_color (заполненная), border_color | — |
| `ImageBox` | resize_mode: `"fit"`/`"fill"`/`"stretch"`/`"original"` | `set_image(image.Image)` — сам файлы не загружает |
| `Modal` | title, message, confirm_text, cancel_text | `show_alert()`, `show_confirm()`, `show_input()`, `get_input_value()`, `on_confirm`, `on_cancel` (сигнатура `void function(gui.Modal modal)`); НЕ виджет — `add_child(modal)` — ошибка компиляции; блокирует окно; каждый show_* создаёт новый диалог |
| `Timer` | interval (мс) | `start()`, `stop()`, `on_tick` (`void function()`); НЕ виджет, живёт без окон; без `start()` молчит |
| `Canvas` | x, y, width, height, visible, framerate_limit | `clear()`, `fill(color)`, `draw(drawable.Drawable)` + 8 коллбэков (ниже) |

⚠️ Уроки widgets описывают у Timer свойство `running` (ro) и метод `restart()` — их **нет** в api.json и ai-reference. Также уроки дают `font` у Label/Frame, которого нет в их списках api.json (наследование в registry не выражено).

### События Canvas

```idyllium
on_init:           void function(gui.Canvas canvas)
on_update:         void function(gui.Canvas canvas, float delta_time)   // delta_time в секундах (canvas-draft)
on_key_pressed:    void function(gui.Canvas canvas, gui.KeyboardEvent e)
on_key_released:   void function(gui.Canvas canvas, gui.KeyboardEvent e)
on_mouse_pressed:  void function(gui.Canvas canvas, gui.MouseEvent e)
on_mouse_released: void function(gui.Canvas canvas, gui.MouseEvent e)
on_mouse_move:     void function(gui.Canvas canvas, gui.MouseEvent e)
on_mouse_scroll:   void function(gui.Canvas canvas, gui.MouseScrollEvent e)
```

- `KeyboardEvent.key: string` — в уроках только заглавные буквы (`"W"`, `"A"`, `"S"`, `"D"`, `"R"`…); спецклавиши не документированы.
- `MouseEvent.x, y: int` (относительно Canvas), `mouse_button: string` — `"LEFT"` / `"RIGHT"` / `"MIDDLE"`.
- `MouseScrollEvent.x, y, delta: int` (знак/шаг delta не документированы).
- Идиома плавного движения: массив зажатых клавиш (`pressed_keys`) + шаги в `on_update` (обходит автоповтор ОС).

## 12. `drawable`

База `drawable.Drawable`: `contains(x, y): bool` (граница включается), `collides_with(other): bool` (касание = пересечение; алгоритм диспетчеризуется по фактическим типам, любые пары классов).

Общий transform-API у Rectangle/Circle/Sprite/Text: `origin_x/origin_y: float (ro)`, `rotation: float` (градусы, по часовой), `set_origin(x, y)` (локальные координаты, могут быть вне объекта), `rotate(angle)` (прибавляет), `move(dx, dy)`. `x/y` — мировая позиция origin; дефолтный origin (0,0).

Координаты drawable — `float`; размеры/радиус/толщина/шрифт — `int`. Ось Y вниз; формула точки на окружности — `x = cx + R*cos(rad); y = cy + R*sin(rad)` без инверсий.

| Тип | Свойства |
| --- | --- |
| `Rectangle` | x, y, width, height, fill_color, border_width, border_color |
| `Circle` | x, y (лев. верх. угол bbox! центр = x+radius, y+radius; идиома `set_origin(radius, radius)`), radius, fill_color, border_width, border_color |
| `Line` | x1, y1, x2, y2, color, thickness; `move(dx, dy)`; **без** origin/rotation |
| `Sprite` | x, y; `set_image(image.Image)`, `set_scale(x, y)` (только отображение); коллизия — прямоугольник всей картинки, прозрачные пиксели не исключаются; геометрия до загрузки картинки → runtime error |
| `Text` | x, y, text, font: fonts.Font, font_size, text_color; `get_width()/get_height(): float` — точные метрики той же одностand-строчной области, что у contains/collides_with; без шрифта — встроенный Source Code Pro; многострочный текст/отсутствующие глифы → runtime error |

Ручные формулы hit-test из уроков (все границы включаются): точка в прямоугольнике — четыре сравнения `>= <=`; точка в круге — `sqrt(dx²+dy²) <= radius` (при origin в центре); круг-круг — `distance <= r1 + r2`; AABB прямоугольников — метод опровержения из четырёх строгих `>`.

## 13. `image`

Иерархия: `image.Image` (база для потребителей: `ImageBox.set_image`, `Sprite.set_image`) ← `image.Static`, `image.Animation`; отдельно `image.Bitmap` (мутабельный растр, НЕ ресурс GUI/Canvas — сначала `to_static()`).

Общие ro-свойства: `src`, `width`, `height`, `format` (определяется по **содержимому** файла, не по расширению), `has_alpha`, `is_loaded`.

`image.Static`: `load_from_file(path)` — синхронный, после возврата ресурс готов (никаких sleep/поллинга); трансформации возвращают **новый** Static, источник не мутируют: `scale(x, y)` (не ноль; отрицательный — зеркалирование), `rotate(angle)` (только кратные 90), `tint(color)`, `with_opacity(0.0..1.0)`, `desaturate(amount = 1.0)`, `crop(x, y, w, h)` (в пределах источника), `export_to_file(path)`.

`image.Animation` (GIF/APNG): `frame_count`, `frame_duration` (точна при `has_uniform_frame_duration`), `get_frame(index): image.Static`, `get_frame_duration(index)`, `create_from_frames(frames, frame_duration)` (всегда uniform), `load_from_file`, `export_to_file`. Кадры в ImageBox/Sprite анимируются сами.

`image.Bitmap`: `is_created` (ro); `create(w, h, fill = colors.TRANSPARENT)`, `load_from_file`, `create_from_image(static)`, `get_pixel(x, y): colors.Color`, `set_pixel(x, y, color)`, `fill(color)`, `fill_rect(...)`, `to_static()` (независимый снимок), `export_to_file`. Координаты от (0,0) в левом верхнем; выход за растр — ошибка.

Удалённые API, которые нельзя генерировать: `gui.Image`, `drawable.Texture`.

## 14. `fonts`

Один тип `fonts.Font`: `load_from_file(path)`; ro-свойства `src`, `format` (`"ttf"|"otf"|"woff"|"woff2"`, по содержимому), `is_loaded`. Один объект шрифта можно раздать и GUI-виджетам, и `drawable.Text` (размер задаёт потребитель через `font_size`). Отсутствующий файл/не-шрифт → runtime error; отсутствующие глифы в GUI — фолбэк системным шрифтом, в `drawable.Text` — runtime error при геометрии.

## 15. `audio`

`audio.Sound` — короткие эффекты: ro `src`, `duration`, `is_playing`; `volume: float 0.0..1.0` (вне диапазона — runtime error, не клампится); `load_from_file`, `play()` (наложение копий допустимо), `pause()`, `resume()`, `stop()` (действуют на все активные копии; `resume()` запускает новую копию только если нет паузы). **Нет `loop`** — сознательно.

`audio.Music` — длинные треки: + `position: float` (сек, запись = seek каждый раз, диапазон 0.0..duration), `loop: bool`, `on_finished` (после естественного конца при `loop == false`; коллбэк без аргументов или `void function(audio.Music current)`). `play()` — с текущей позиции; `stop()` сбрасывает в 0.0.

Гарантированные форматы: WAV и MP3 (OGG/AAC/M4A зависят от кодеков платформы; транскодирования нет).

---

## Сквозные наблюдения

1. **Три уровня строгости данных**: язык (никаких неявных конверсий) → библиотеки (диапазоны валидируются, ошибки не маскируются: цвета не клампятся, decode не вставляет `�`, random не чинит диапазон) → `types` (единственная зона намеренной «дикости» — молчаливое переполнение, как урок о низком уровне).
2. **Свойства vs методы** — жёсткая конвенция: read-only состояние — всегда свойство (`db.path`, `fout.is_open`, `stamp.year`, `arr.length`), действия и запросы с аргументами — методы. Референс прямо запрещает выдумывать `db.get_path()` или `stamp.year()`.
3. **Ресурсная модель**: явные `load_from_file`/`open` + явные `close()/stop()`; синхронная готовность ресурсов после загрузки; форматы определяются по содержимому. GC есть, но освобождение внешних ресурсов — обязанность кода.
4. **Иммутабельность значений**: `colors.Color` и трансформации `image.Static` возвращают новые объекты; строки неизменяемы. Мутабельность сосредоточена в явно «живых» объектах (виджеты, Bitmap, потоки, БД).
5. **Единый полиморфизм языка и библиотек**: `add_child(gui.Widget)`, `draw(drawable.Drawable)`, `set_image(image.Image)` — тот же механизм подстановки подтипов, что и у пользовательских классов; иерархия, правда, не выражена в api.json (см. inconsistencies).
