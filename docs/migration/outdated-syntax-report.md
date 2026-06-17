# Documentation Migration Inventory

Generated from:

```text
/home/nathaniel/IdylliumProjects/Idyllium/docs/lessons
```

Generated at: 2026-06-14T17:29:20.812Z

## Target Study Line

1. Консоль
2. Виджеты
3. ООП
4. Canvas
5. JSON

## Summary

- Lessons referenced by old `lessons.json`: 59
- Code blocks: 352
- Output blocks: 127
- Program code blocks: 221
- Module code blocks: 10
- Snippet code blocks: 121
- Program compile failures: 42/221
- Lessons needing manual review: 45

## Old Sections

- 📟 Консольное программирование (`console`): 28
- 🖼️ Графические виджеты (`widgets`): 17
- 🏗️ Объектно-ориентированное программирование (`oop`): 13
- 💡 Примеры задач (`examples`): 1

## Lesson Review Flags

| Flag | Lessons |
| --- | --- |
| `code-needs-review` | 28 |
| `program-compile-failure` | 18 |
| `pre-canvas-widget-doc` | 17 |
| `teaching-errors` | 3 |
| `missing-html-file` | 1 |
| `review-console-colors-and-clear` | 1 |
| `review-progressbar-colors` | 1 |
| `rewrite-increment-lesson-no-plus-plus` | 1 |

## Code Review Flags

| Flag | Blocks |
| --- | --- |
| `standalone-without-use` | 32 |
| `teaching-error-or-error-handling` | 26 |
| `console-write-style` | 23 |
| `progressbar-example` | 6 |
| `legacy-widget-color-string` | 1 |
| `raw-hex-color-string` | 1 |
| `uses-plus-plus-or-minus-minus` | 1 |

## Program Compile Failures

- `cli/002_variables.html` block 3 line 127: cli/002_variables.html:7:13: error: cannot assign 'float' value to 'int' variable
- `cli/002_variables.html` block 8 line 243: cli/002_variables.html:5:32: error: 'diam' was not declared in this scope
- `cli/004_arithmetics.html` block 2 line 84: cli/004_arithmetics.html:10:13: error: cannot assign 'float' value to 'int' variable
- `cli/006_transforms.html` block 1 line 60: cli/006_transforms.html:4:16: error: cannot assign 'int' value to 'string' variable
- `cli/006_transforms.html` block 4 line 119: cli/006_transforms.html:4:13: error: cannot assign 'string' value to 'int' variable
- `cli/006_transforms.html` block 5 line 135: cli/006_transforms.html:4:15: error: cannot assign 'string' value to 'float' variable
- `cli/022_functions.html` block 2 line 81: cli/022_functions.html:6:12: error: 'выходные_данные' was not declared in this scope
- `cli/023_libs.html` block 2 line 94: cli/023_libs.html:4:1: error: module 'draw' was not found
- `cli/026_matrix.html` block 3 line 93: cli/026_matrix.html:5:34: error: array initializer has 0 elements, but 'array<array<int, 6>, 4>' requires 4
- `cli/027_errors.html` block 1 line 105: cli/027_errors.html:2:13: error: cannot assign 'string' value to 'int' variable
- `cli/027_errors.html` block 2 line 114: cli/027_errors.html:3:9: error: cannot assign 'float' value to 'int' variable
- `cli/027_errors.html` block 3 line 124: cli/027_errors.html:2:5: error: cannot declare variable of type 'void'
- `cli/027_errors.html` block 4 line 133: cli/027_errors.html:4:13: error: cannot assign 'float' value to 'int' variable
- `cli/027_errors.html` block 5 line 149: cli/027_errors.html:4:19: error: 'x' was not declared in this scope
- `cli/027_errors.html` block 6 line 160: cli/027_errors.html:2:13: error: 'math' is not imported (use 'use math;')
- `cli/027_errors.html` block 7 line 174: cli/027_errors.html:2:9: error: if condition must be 'bool', got 'int'
- `cli/027_errors.html` block 8 line 185: cli/027_errors.html:2:5: error: 'break' is only valid inside a loop
- `cli/027_errors.html` block 9 line 199: cli/027_errors.html:1:1: error: function with return type 'int' must return a value
- `cli/027_errors.html` block 10 line 210: cli/027_errors.html:2:12: error: void function cannot return a value
- `cli/027_errors.html` block 11 line 221: cli/027_errors.html:6:13: error: 'add' expects 2 arguments, got 3
- `cli/027_errors.html` block 12 line 239: cli/027_errors.html:2:26: error: array initializer has 3 elements, but 'array<int, 5>' requires 5
- `cli/027_errors.html` block 13 line 248: cli/027_errors.html:3:5: error: method 'add' is only available on 'dyn_array'
- `cli/027_errors.html` block 14 line 263: cli/027_errors.html:3:9: error: comparison '>' requires numeric operands
- `widgets/002_label.html` block 4 line 228: widgets/002_label.html:7:18: error: cannot assign 'int' value to 'string' variable
- `widgets/016_errors.html` block 3 line 124: widgets/016_errors.html:8:20: error: callback property 'on_click' expects function(): void or function(gui.Button): void, got function(gui.Label): void
- `widgets/016_errors.html` block 4 line 153: widgets/016_errors.html:6:18: error: cannot assign 'int' value to 'string' variable
- `widgets/016_errors.html` block 5 line 175: widgets/016_errors.html:6:5: error: 'btn' was not declared in this scope
- `widgets/016_errors.html` block 7 line 235: widgets/016_errors.html:6:19: error: 'add_child' argument 1 expects gui widget, got 'gui.Modal'
- `widgets/016_errors.html` block 9 line 290: widgets/016_errors.html:6:5: error: type 'gui.Button' has no property 'placeholder'
- `oop/000_intro.html` block 4 line 136: oop/000_intro.html:4:5: error: unknown class 'Cat'
- `oop/002_fields_methods.html` block 3 line 167: oop/002_fields_methods.html:7:5: error: instance method 'Cat.meow' must be called on an object
- `oop/004_modules.html` block 2 line 96: oop/004_modules.html:2:1: error: module 'rect' was not found
- `oop/005_arrays.html` block 3 line 115: oop/005_arrays.html:6:9: error: 'console' is not imported (use 'use console;')
- `oop/005_arrays.html` block 6 line 186: oop/005_arrays.html:25:9: error: 'console' is not imported (use 'use console;')
- `oop/006_constructor.html` block 4 line 167: oop/006_constructor.html:12:5: error: destructors are not supported yet
- `oop/009_polymorphism.html` block 2 line 122: oop/009_polymorphism.html:1:1: error: unknown base class 'Animal'
- `oop/009_polymorphism.html` block 3 line 144: oop/009_polymorphism.html:3:9: error: 'console' is not imported (use 'use console;')
- `oop/010_encapsulation.html` block 4 line 210: oop/010_encapsulation.html:2:5: error: unknown class 'Hero'
- `oop/011_static.html` block 1 line 60: oop/011_static.html:3:9: error: 'console' is not imported (use 'use console;')
- `oop/012_errors.html` block 3 line 104: oop/012_errors.html:8:5: error: member 'BankAccount.balance' is private and can only be used inside class 'BankAccount'
- `oop/012_errors.html` block 4 line 128: oop/012_errors.html:3:5: error: unknown class 'Cat'
- `oop/012_errors.html` block 6 line 167: oop/012_errors.html:9:13: error: static method 'MathUtils.square' must be called on class 'MathUtils'

## Manual Review Lessons

- `cli/001_hello.html` — Первая программа: `code-needs-review`
- `cli/002_variables.html` — Переменные и типы данных: `code-needs-review`, `program-compile-failure`
- `cli/003_input.html` — Ввод данных: `code-needs-review`
- `cli/004_arithmetics.html` — Арифметика: `code-needs-review`, `program-compile-failure`
- `cli/005_colors.html` — Улучшенный вывод текста: `code-needs-review`, `review-console-colors-and-clear`
- `cli/006_transforms.html` — Преобразования данных: `code-needs-review`, `program-compile-failure`
- `cli/008_if.html` — Условный оператор и тип bool: `code-needs-review`
- `cli/009_increment.html` — Инкремент и декремент: `code-needs-review`, `rewrite-increment-lesson-no-plus-plus`
- `cli/013_array.html` — Массивы: `code-needs-review`
- `cli/014_char.html` — Тип char как элемент строки: `code-needs-review`
- `cli/015_dyn_array.html` — Динамические массивы: `code-needs-review`
- `cli/016_arr_functions.html` — Функции для работы с массивами: `code-needs-review`
- `cli/021_encoding.html` — Библиотека encoding: `code-needs-review`
- `cli/022_functions.html` — Создание собственных функций: `program-compile-failure`
- `cli/023_libs.html` — Создание собственных библиотек: `program-compile-failure`
- `cli/026_matrix.html` — Двумерные массивы: `code-needs-review`, `program-compile-failure`
- `cli/027_errors.html` — Типичные ошибки: `code-needs-review`, `program-compile-failure`, `teaching-errors`
- `widgets/000_window.html` — Первое графическое приложение: `pre-canvas-widget-doc`
- `widgets/001_button.html` — Кнопки и события: `pre-canvas-widget-doc`
- `widgets/002_label.html` — Виджет Label: `code-needs-review`, `pre-canvas-widget-doc`, `program-compile-failure`
- `widgets/003_progressbar.html` — Виджет ProgressBar: `code-needs-review`, `pre-canvas-widget-doc`, `review-progressbar-colors`
- `widgets/004_spinbox.html` — Виджеты SpinBox и FloatSpinBox: `pre-canvas-widget-doc`
- `widgets/005_slider.html` — Виджет Slider: `pre-canvas-widget-doc`
- `widgets/006_lineedit.html` — Виджет LineEdit: `pre-canvas-widget-doc`
- `widgets/007_checkbox.html` — Виджет CheckBox: `pre-canvas-widget-doc`
- `widgets/008_radiobutton.html` — Виджет RadioButton: `pre-canvas-widget-doc`
- `widgets/009_frame.html` — Виджет Frame: `pre-canvas-widget-doc`
- `widgets/010_combobox.html` — Виджет ComboBox: `pre-canvas-widget-doc`
- `widgets/011_visibility.html` — Видимость виджетов: `code-needs-review`, `pre-canvas-widget-doc`
- `widgets/012_arrays.html` — Массивы виджетов: `code-needs-review`, `pre-canvas-widget-doc`
- `widgets/013_sender.html` — Отправители: `pre-canvas-widget-doc`
- `widgets/014_timer.html` — Объект Timer: `pre-canvas-widget-doc`
- `widgets/015_modal.html` — Модальные окна: `pre-canvas-widget-doc`
- `widgets/016_errors.html` — Типичные ошибки: `code-needs-review`, `pre-canvas-widget-doc`, `program-compile-failure`, `teaching-errors`
- `oop/000_intro.html` — Введение в ООП: `program-compile-failure`
- `oop/002_fields_methods.html` — Свойства и методы: `code-needs-review`, `program-compile-failure`
- `oop/004_modules.html` — Разбиение проекта по файлам: `program-compile-failure`
- `oop/005_arrays.html` — Массивы объектов: `code-needs-review`, `program-compile-failure`
- `oop/006_constructor.html` — Конструктор и деструктор: `code-needs-review`, `program-compile-failure`
- `oop/007_composition.html` — Композиция: `code-needs-review`
- `oop/009_polymorphism.html` — Полиморфизм: `code-needs-review`, `program-compile-failure`
- `oop/010_encapsulation.html` — Инкапсуляция: `code-needs-review`, `program-compile-failure`
- `oop/011_static.html` — Статические методы: `code-needs-review`, `program-compile-failure`
- `oop/012_errors.html` — Типичные ошибки: `code-needs-review`, `program-compile-failure`, `teaching-errors`
- `examples/000_calc.html` — Калькулятор: `missing-html-file`

## Orphan HTML Files

- `cli/cli_hub.html`
- `docs.html`
- `oop/oop_hub.html`
- `widgets/widgets_hub.html`

## Notes

- This is an inventory and review radar, not the final migrated documentation.
- The script intentionally does not rewrite lesson prose or code examples.
- Any syntax rewrite must preserve the original pedagogical voice.
