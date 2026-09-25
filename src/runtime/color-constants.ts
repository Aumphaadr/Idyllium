// Именованные цвета библиотеки colors — одна таблица на рантайм, справочник и
// Конструктор GUI (импорт `colors.RED` из чужого файла). Альфа только у TRANSPARENT.
export type ColorConstant = readonly [name: string, red: number, green: number, blue: number, alpha?: number];

export const COLOR_CONSTANTS: readonly ColorConstant[] = [
  ['BLACK', 0, 0, 0],
  ['WHITE', 255, 255, 255],
  ['RED', 255, 0, 0],
  ['GREEN', 0, 255, 0],
  ['BLUE', 0, 0, 255],
  ['YELLOW', 255, 255, 0],
  ['CYAN', 0, 255, 255],
  ['MAGENTA', 255, 0, 255],
  ['GRAY', 128, 128, 128],
  ['LIGHT_GRAY', 192, 192, 192],
  ['DARK_RED', 128, 0, 0],
  ['DARK_GREEN', 0, 128, 0],
  ['DARK_BLUE', 0, 0, 128],
  ['OLIVE', 128, 128, 0],
  ['TEAL', 0, 128, 128],
  ['PURPLE', 128, 0, 128],
  ['TRANSPARENT', 0, 0, 0, 0],
];
