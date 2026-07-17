# Урок 17: Цвета виджетов

Draft-урок для новой спецификации IdylliumNext.

Он фиксирует современный стиль работы с цветами:

- цвет создаётся через `colors.Color`;
- основной способ создания цвета: `colors.RGB`, `colors.RGBA`, `colors.HEX`, `colors.HSL`;
- свойства виджетов должны явно говорить, что именно окрашивается:
  - `text_color`;
  - `background_color`;
  - `border_color`;
  - `foreground_color` для заполненной части `gui.ProgressBar`.
- цветовые свойства принимают только `colors.Color`; строковый HEX сначала
  преобразуется через `colors.HEX()`.
- `005_label_text_color.idyl` вручную проверяет явные цвета текста;
- `006_label_color_inheritance.idyl` показывает наследование `text_color` от
  окна и контейнера с локальным переопределением у отдельного лейбла.
