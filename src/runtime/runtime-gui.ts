// ─── gui: окна, виджеты, события — модуль рантайма (этап Б, 2026-08-29) ────
import { IdylliumRuntimeError } from './runtime-errors';
import { ICON_NAMES, isIconName } from '../icon-names';
import { RuntimeObject, contextFunction, finiteNumber, intArgument, isRuntimeObject, stringArgument } from './runtime-shared';
import { IdylliumArray, IdylliumColor, valueOps } from './runtime-values';
import { IdylliumCanvasCommand, RuntimeObjectState, canvasCommands, restartCanvasCommands, defineEnumRuntimeProperty, defineTrackedRuntimeProperty, defineValidatedRuntimeProperty, setTrackedRuntimePropertyDefault } from './runtime-state';
import { colorBlack, colorBlue, colorGray, colorLightGray, colorToCss, colorTransparent, colorVeryLightGray, colorWhite } from './runtime-values';
import { errorMessage, splitContextArgs } from './runtime-shared';
import { isDrawableObject } from './runtime-drawable';
import { createGeneratedStaticImage, imageRuntimeError, imageService, runtimeImageResource, writeRuntimeImageBytes } from './runtime-image';
import { imageFormatFromPath } from './image-service';
import { canvasCaptureRegion, canvasToSvg, drawableSnapshot } from './runtime-snapshots';

export function refuseWidgetCycle(container: RuntimeObject, child: RuntimeObject, what: string, file: string, line: number): void {
  if (child === container) {
    throw new IdylliumRuntimeError(file, line, `${what} cannot put a widget inside itself`);
  }
  for (let ancestor = container.__parent; isRuntimeObject(ancestor); ancestor = ancestor.__parent) {
    if (ancestor === child) {
      throw new IdylliumRuntimeError(file, line, `${what} cannot put a widget inside its own child — the tree would have no end`);
    }
  }
}

export function initializeGuiObject(obj: RuntimeObject, typeName: string, state: RuntimeObjectState): void {
  if (isGuiWidget(typeName)) {
    obj.x = 0;
    obj.y = 0;
    const size = defaultGuiWidgetSize(typeName);
    obj.width = size.width;
    obj.height = size.height;
    obj.visible = true;
    obj.enabled = true;
    obj.hint = ''; // всплывающая подсказка; пустая строка = подсказки нет
    obj.style = ''; // IdySS-наклейка; пустая строка = наклейки нет
    obj.style_hover = '';
    obj.style_active = '';
    // Состояние, которое у языка уже есть (enabled = false), но оформить его
    // было нечем: у всех программ выключенный виджет выглядел одинаково.
    obj.style_disabled = '';
    defineTrackedRuntimeProperty(obj, 'text_color', colorBlack());
    defineTrackedRuntimeProperty(obj, 'background_color', colorTransparent());
    defineTrackedRuntimeProperty(obj, 'font', null);
    if (guiObjectUsesFontSize(typeName)) {
      defineTrackedRuntimeProperty(obj, 'font_size', 13);
    }
  }

  if (typeName === 'Window' || typeName === 'Frame') {
    obj.__children = [];
    obj.add_child = contextFunction((child: unknown, file: string, line: number) => {
      if (!isRuntimeObject(child)) {
        throw new IdylliumRuntimeError(file, line, `add_child() expects gui widget, got '${String(child)}'`);
      }
      refuseWidgetCycle(obj, child, 'add_child()', file, line);
      child.__parent = obj;
      (obj.__children as RuntimeObject[]).push(child);
      // Радио с предвыбором решает свою группу в момент переезда в коробку:
      // до add_child группа неизвестна (E15), теперь родитель есть — гасим
      // соседей по новому дому (последний добавленный выигрывает).
      if (child.__idylliumType === 'gui.RadioButton' && child.is_selected === true) {
        selectRadioButton(child, state);
      }
    });
  }

  if (typeName === 'Window') {
    obj.title = '';
    // Координаты окна на «рабочем столе» превью — с учётом явности: окно,
    // которому программа (или перетаскивание мышью за шапку) задала x/y,
    // рендерер ставит по координатам, остальные раскладывает сам. Явность
    // различима только через tracked-свойство: обычное поле не отличает
    // «не задавали» от «задали 0».
    defineTrackedRuntimeProperty(obj, 'x', 0);
    defineTrackedRuntimeProperty(obj, 'y', 0);
    defineEnumRuntimeProperty(obj, 'theme', 'Window', 'default', ['default', 'idyllium', 'dracula', 'breeze', 'oxygen']);
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorWhite());
    obj.show = async () => {
      obj.__shown = true;
      state.anyWindowEverShown = true;
      for (const child of obj.__children as RuntimeObject[] ?? []) {
        await initializeGuiChild(child);
      }
    };
    // Закрытое окно исчезает из снимка. Когда закрылось последнее, у программы
    // не остаётся GUI — и хост завершает её так же, как консольную.
    obj.close = () => {
      obj.__shown = false;
      const index = state.windows.indexOf(obj);
      if (index !== -1) state.windows.splice(index, 1);
    };
    state.windows.push(obj);
    state.windowsCreated += 1;
  }

  if (typeName === 'Canvas') {
    obj.framerate_limit = 60;
    obj.__commands = [];
    // Модель кадра (1.6.1, вердикт владельца — «как в индустрии»): рисунок на
    // холсте КОПИТСЯ, кадр сам ничего не стирает; стирают только явные clear()
    // и fill(). Список команд — полное описание экрана (на нём живут снимки,
    // save_svg и тесты), поэтому копится именно он; непрозрачная заливка его
    // обрезает: всё, что под ней, уже не видно. Хосту при этом каждый кадр уходит
    // не весь список, а хвост (см. canvasSnapshot) — рендерер хранит картинку
    // между кадрами, так что цена кадра — сколько нарисовано ЗА кадр, а не за всё
    // время. Полупрозрачная заливка (затухающий след) ничего не обрезает — и не
    // должна: вуаль заливкой и вуаль прямоугольником обязаны вести себя одинаково.
    obj.clear = contextFunction((_file: string, _line: number) => {
      restartCanvasCommands(obj, { kind: 'clear', color: '#000000' });
    });
    obj.fill = contextFunction((color: unknown, file: string, line: number) => {
      const command: IdylliumCanvasCommand = { kind: 'fill', color: colorToCss(color, 'Canvas.fill() color', file, line) };
      if (color instanceof IdylliumColor && color.alpha < 1) canvasCommands(obj).push(command);
      else restartCanvasCommands(obj, command);
    });
    obj.draw = contextFunction((target: unknown, file: string, line: number) => {
      if (!isDrawableObject(target)) {
        throw new IdylliumRuntimeError(file, line, `Canvas.draw() expects drawable object, got '${valueOps.typeName(target)}'`);
      }
      canvasCommands(obj).push({ kind: 'draw', object: drawableSnapshot(target) });
    });
    obj.to_string = () => `gui.Canvas(commands: ${canvasCommands(obj).length})`;
    // Снимки холста (1.3.6): save_svg живёт везде (включая консольный
    // запуск), to_static/export_to_file требуют растеризатора хоста.
    obj.save_svg = contextFunction((...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const requestedPath = stringArgument(values[0], 'Canvas.save_svg() path', file, line);
      const region = canvasCaptureRegion(obj, values.slice(1), 'Canvas.save_svg()', file, line);
      const resolved = state.fileSystem.resolvePath(requestedPath, file);
      try {
        state.fileSystem.writeText(resolved, canvasToSvg(obj, region, state));
      } catch (error) {
        throw new IdylliumRuntimeError(file, line, `Canvas.save_svg() cannot write '${requestedPath}': ${errorMessage(error)}`);
      }
    });
    obj.to_static = contextFunction(async (...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const region = canvasCaptureRegion(obj, values, 'Canvas.to_static()', file, line);
      const service = imageService(state, file, line);
      if (typeof service.rasterizeSvg !== 'function') {
        throw new IdylliumRuntimeError(file, line, 'Canvas.to_static() is not available in the console host — use Canvas.save_svg() or run the program in the Web IDE');
      }
      const svgText = canvasToSvg(obj, region, state);
      try {
        const raster = await service.rasterizeSvg(svgText, region.width, region.height, region.width, region.height);
        return await createGeneratedStaticImage(raster, 'canvas', state, file, line);
      } catch (error) {
        if (error instanceof IdylliumRuntimeError) throw error;
        throw imageRuntimeError(file, line, 'Canvas.to_static() cannot rasterize the canvas', error);
      }
    });
    obj.export_to_file = contextFunction(async (...rawArgs: unknown[]) => {
      const { values, file, line } = splitContextArgs(rawArgs);
      const requestedPath = stringArgument(values[0], 'Canvas.export_to_file() path', file, line);
      const outputFormat = imageFormatFromPath(requestedPath);
      if (!['png', 'jpeg', 'webp', 'gif'].includes(outputFormat)) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Canvas.export_to_file() cannot determine a supported format from '${requestedPath}'`,
        );
      }
      const region = canvasCaptureRegion(obj, values.slice(1), 'Canvas.export_to_file()', file, line);
      const service = imageService(state, file, line);
      if (typeof service.rasterizeSvg !== 'function') {
        throw new IdylliumRuntimeError(file, line, 'Canvas.export_to_file() is not available in the console host — use Canvas.save_svg() or run the program in the Web IDE');
      }
      const svgText = canvasToSvg(obj, region, state);
      try {
        const raster = await service.rasterizeSvg(svgText, region.width, region.height, region.width, region.height);
        const bytes = await service.encodeStatic(raster, outputFormat);
        writeRuntimeImageBytes(requestedPath, bytes, outputFormat, state, file, line, 'Canvas.export_to_file()');
      } catch (error) {
        if (error instanceof IdylliumRuntimeError) throw error;
        throw imageRuntimeError(file, line, `Canvas.export_to_file() cannot write '${requestedPath}'`, error);
      }
    });
    state.canvases.push(obj);
  }

  if (typeName === 'Timer') {
    obj.interval = 1000;
    obj.running = false;
    obj.__running = false;
    obj.__elapsedMs = 0;
    // start()/stop() — пауза и снятие с паузы (накопленные миллисекунды
    // сохраняются), restart() — запуск заново с нуля.
    obj.start = () => {
      obj.__running = true;
      obj.running = true;
    };
    obj.stop = () => {
      obj.__running = false;
      obj.running = false;
    };
    obj.restart = () => {
      obj.__running = true;
      obj.running = true;
      obj.__elapsedMs = 0;
    };
    state.timers.push(obj);
  }

  if (typeName === 'Label') {
    obj.text = '';
    obj.href = '';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorTransparent());
    defineTrackedRuntimeProperty(obj, 'border_color', colorTransparent());
  }

  if (typeName === 'Button') {
    obj.text = '';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorLightGray());
    defineTrackedRuntimeProperty(obj, 'border_color', colorGray());
    // click() — нажатие из кода (1.6.1): зовёт on_click ровно так, как это сделал бы человек.
    // Выключенную или спрятанную кнопку (и кнопку в таком контейнере) человек нажать не может —
    // не нажимает её и программа.
    obj.click = async () => {
      if (widgetEventsBlocked(obj)) return;
      const handler = obj.on_click;
      if (typeof handler === 'function') await handler(obj);
    };
  }

  if (typeName === 'TabWidget') {
    obj.__children = [];
    obj.__tabTitles = [];
    // Пустой шкаф отвечает -1 — «ничего не выбрано», как пустой ComboBox
    // (E16): у вкладок нет тайной «нулевой», пока add_tab не принёс первую.
    obj.selected_index = -1;
    obj.tab_count = 0;
    // Заголовок всегда вычисляется из selected_index. Хранить его отдельным
    // полем нельзя: тогда присваивание selected_index из программы оставляло
    // бы selected_title от прежней вкладки.
    Object.defineProperty(obj, 'selected_title', {
      enumerable: true,
      configurable: true,
      get() {
        const titles = obj.__tabTitles as string[];
        const index = obj.selected_index;
        if (typeof index !== 'number' || !Number.isFinite(index)) return '';
        return titles[Math.trunc(index)] ?? '';
      },
      set(_value: unknown) {
        // Только чтение: заголовок задают add_tab() и selected_index.
      },
    });
    obj.add_tab = contextFunction((title: unknown, content: unknown, file: string, line: number) => {
      const tabTitle = stringArgument(title, 'TabWidget.add_tab() title', file, line);
      if (!isRuntimeObject(content)) {
        throw new IdylliumRuntimeError(file, line, `TabWidget.add_tab() expects gui widget as content, got '${valueOps.typeName(content)}'`);
      }
      refuseWidgetCycle(obj, content, 'TabWidget.add_tab()', file, line);
      content.__parent = obj;
      (obj.__children as RuntimeObject[]).push(content);
      (obj.__tabTitles as string[]).push(tabTitle);
      obj.tab_count = (obj.__tabTitles as string[]).length;
      // Первая вкладка становится выбранной: шкаф перестаёт быть пустым.
      if (obj.selected_index === -1) obj.selected_index = 0;
    });
    obj.clear_tabs = contextFunction(() => {
      obj.__children = [];
      obj.__tabTitles = [];
      obj.tab_count = 0;
      obj.selected_index = -1;
    });
  }

  if (typeName === 'Frame') {
    obj.title = '';
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorVeryLightGray());
    defineTrackedRuntimeProperty(obj, 'border_color', colorGray());
    obj.border_width = 1;
  }

  if (typeName === 'Icon') {
    // Значок из единого набора сайта; список имён — сгенерированный src/icon-names.ts.
    defineValidatedRuntimeProperty(obj, 'icon', 'star', (value, file, line) => {
      if (!isIconName(value)) {
        const shown = typeof value === 'string' ? value : String(value);
        const hints = typeof value === 'string' ? ICON_NAMES.filter((name) => name.includes(value.toLowerCase())).slice(0, 5) : [];
        const hint = hints.length > 0 ? ` — maybe ${hints.map((name) => `'${name}'`).join(', ')}` : '';
        throw new IdylliumRuntimeError(file, line, `Icon.icon must be a name from the Idyllium icon set (like 'play', 'star', 'folder'), got '${shown}'${hint}; the full list is in the reference for gui.Icon`);
      }
      return value;
    });
  }

  if (typeName === 'ImageBox') {
    obj.image = null;
    defineEnumRuntimeProperty(obj, 'resize_mode', 'ImageBox', 'fit', ['fit', 'fill', 'stretch', 'original']);
    obj.set_image = contextFunction((image: unknown, file: string, line: number) => {
      obj.image = runtimeImageResource(image, 'ImageBox.set_image()', file, line);
    });
  }

  if (typeName === 'LineEdit') {
    obj.text = '';
    obj.placeholder = '';
    defineTrackedRuntimeProperty(obj, 'placeholder_color', colorGray());
    // Опечатка в режиме молча оставляла пароль на виду (W18, методисты).
    defineEnumRuntimeProperty(obj, 'echo_mode', 'LineEdit', 'normal', ['normal', 'password', 'no_echo']);
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorWhite());
    defineTrackedRuntimeProperty(obj, 'border_color', colorGray());
  }

  if (typeName === 'TextEdit') {
    obj.text = '';
    obj.placeholder = '';
    defineTrackedRuntimeProperty(obj, 'placeholder_color', colorGray());
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorWhite());
    defineTrackedRuntimeProperty(obj, 'border_color', colorGray());
  }

  if (typeName === 'ProgressBar') {
    obj.value = 0;
    obj.min = 0;
    obj.max = 100;
    defineEnumRuntimeProperty(obj, 'orientation', 'ProgressBar', 'horizontal', ['horizontal', 'vertical']);
    setTrackedRuntimePropertyDefault(obj, 'text_color', colorBlack());
    setTrackedRuntimePropertyDefault(obj, 'background_color', colorVeryLightGray());
    setTrackedRuntimePropertyDefault(obj, 'foreground_color', colorBlue());
    defineTrackedRuntimeProperty(obj, 'border_color', colorGray());
  }

  if (typeName === 'SpinBox' || typeName === 'Slider') {
    defineBoundedValue(obj, typeName);
    obj.step = 1;
  }

  if (typeName === 'Slider') {
    defineEnumRuntimeProperty(obj, 'orientation', 'Slider', 'horizontal', ['horizontal', 'vertical']);
  }

  if (typeName === 'FloatSpinBox') {
    defineBoundedValue(obj, typeName);
    obj.step = 1;
  }

  if (typeName === 'CheckBox') {
    obj.text = '';
    obj.is_checked = false;
  }

  if (typeName === 'RadioButton') {
    obj.text = '';
    obj.group = '';
    obj.is_selected = false;
  }

  if (typeName === 'ComboBox') {
    const items: string[] = [];
    obj.__items = items;
    obj.__selected_index = -1;
    defineComboBoxProperties(obj, items);
    obj.add_item = (text: string) => {
      items.push(text);
      if (obj.selected_index === -1) {
        obj.selected_index = 0;
      }
    };
    obj.clear_items = () => {
      items.length = 0;
      obj.selected_index = -1;
    };
  }

  if (typeName === 'Table') {
    const columns: string[] = [];
    const rows: string[][] = [];
    obj.__columns = columns;
    obj.__rows = rows;
    obj.selected_row = -1;
    obj.row_count = 0;

    obj.set_columns = contextFunction((...callArgs: unknown[]) => {
      callArgs.pop();
      callArgs.pop();
      columns.length = 0;
      for (const value of callArgs) columns.push(String(value));
      rows.length = 0;
      obj.selected_row = -1;
      obj.row_count = 0;
    });
    obj.add_row = contextFunction((...callArgs: unknown[]) => {
      const line = callArgs.pop() as number;
      const file = callArgs.pop() as string;
      if (columns.length === 0) {
        throw new IdylliumRuntimeError(file, line, 'Table.add_row() before set_columns() — set the columns first');
      }
      if (callArgs.length !== columns.length) {
        throw new IdylliumRuntimeError(
          file,
          line,
          `Table.add_row() expects ${columns.length} values (one per column), got ${callArgs.length}`,
        );
      }
      rows.push(callArgs.map((value) => String(value)));
      obj.row_count = rows.length;
    });
    obj.set_cell = contextFunction((row: unknown, column: unknown, text: unknown, file: string, line: number) => {
      const rowIndex = Math.trunc(Number(row));
      const columnIndex = Math.trunc(Number(column));
      if (rowIndex < 0 || rowIndex >= rows.length) {
        throw new IdylliumRuntimeError(file, line, `Table.set_cell() row ${rowIndex} is out of range 0..${rows.length - 1}`);
      }
      if (columnIndex < 0 || columnIndex >= columns.length) {
        throw new IdylliumRuntimeError(file, line, `Table.set_cell() column ${columnIndex} is out of range 0..${columns.length - 1}`);
      }
      rows[rowIndex][columnIndex] = String(text);
    });
    obj.remove_row = contextFunction((row: unknown, file: string, line: number) => {
      const rowIndex = Math.trunc(Number(row));
      if (rowIndex < 0 || rowIndex >= rows.length) {
        throw new IdylliumRuntimeError(file, line, `Table.remove_row() row ${rowIndex} is out of range 0..${rows.length - 1}`);
      }
      rows.splice(rowIndex, 1);
      obj.row_count = rows.length;
      const selected = Number(obj.selected_row);
      if (selected === rowIndex) obj.selected_row = -1;
      else if (selected > rowIndex) obj.selected_row = selected - 1;
    });
    obj.clear = contextFunction((_file: string, _line: number) => {
      rows.length = 0;
      obj.row_count = 0;
      obj.selected_row = -1;
    });
    obj.to_string = () => `gui.Table(${columns.length} columns, ${rows.length} rows)`;
  }

  if (typeName === 'BarChart' || typeName === 'PieChart') {
    const entries: { label: string; value: number }[] = [];
    obj.__entries = entries;
    // «bar» против «slice» — сторожа говорят на языке своего виджета.
    const noun = typeName === 'BarChart' ? 'bar' : 'slice';
    const addEntry = (label: unknown, value: unknown, file: string, line: number): void => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new IdylliumRuntimeError(file, line, `${typeName} ${noun} value must be >= 0, got ${String(value)}`);
      }
      const name = String(label);
      if (entries.some((entry) => entry.label === name)) {
        throw new IdylliumRuntimeError(file, line, `${typeName} ${noun} '${name}' already exists — use set_${typeName === 'BarChart' ? 'value' : 'slice'}()`);
      }
      entries.push({ label: name, value: amount });
    };
    const setEntry = (label: unknown, value: unknown, file: string, line: number): void => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new IdylliumRuntimeError(file, line, `${typeName} ${noun} value must be >= 0, got ${String(value)}`);
      }
      const name = String(label);
      const entry = entries.find((item) => item.label === name);
      if (!entry) {
        throw new IdylliumRuntimeError(file, line, `${typeName} has no ${noun} '${name}'`);
      }
      entry.value = amount;
    };
    if (typeName === 'BarChart') {
      obj.add_value = contextFunction(addEntry);
      obj.set_value = contextFunction(setEntry);
      defineTrackedRuntimeProperty(obj, 'bar_color', colorTransparent());
      obj.show_values = true;
    } else {
      obj.add_slice = contextFunction(addEntry);
      obj.set_slice = contextFunction(setEntry);
      obj.show_legend = true;
      obj.show_percents = true;
    }
    obj.clear = contextFunction((_file: string, _line: number) => {
      entries.length = 0;
    });
    // Автомасштаб: пока min/max не заданы явно, рендерер считает шкалу сам —
    // явность отслеживается той же механикой, что явные цвета у тем.
    if (typeName === 'BarChart') {
      defineTrackedRuntimeProperty(obj, 'min_value', 0);
      defineTrackedRuntimeProperty(obj, 'max_value', 0);
    }
    obj.to_string = () => `gui.${typeName}(${entries.length} ${noun}s)`;
  }

  if (typeName === 'LineChart') {
    const points: number[] = [];
    obj.__points = points;
    obj.show_dots = true;
    defineTrackedRuntimeProperty(obj, 'line_color', colorTransparent());
    defineTrackedRuntimeProperty(obj, 'min_value', 0);
    defineTrackedRuntimeProperty(obj, 'max_value', 0);
    defineValidatedRuntimeProperty(obj, 'max_points', 0, (value, file, line) => {
      const limit = Math.trunc(Number(value));
      if (!Number.isFinite(limit) || limit < 0 || limit > 100000) {
        throw new IdylliumRuntimeError(file, line, `LineChart.max_points must be between 0 and 100000, got ${String(value)}`);
      }
      return limit;
    }, (value) => {
      const limit = Number(value);
      if (limit > 0) {
        while (points.length > limit) points.shift();
      }
    });
    obj.add_value = contextFunction((value: unknown, file: string, line: number) => {
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        throw new IdylliumRuntimeError(file, line, `LineChart.add_value() expects a number, got ${String(value)}`);
      }
      points.push(amount);
      const limit = Number(obj.max_points);
      if (limit > 0) {
        while (points.length > limit) points.shift();
      }
    });
    obj.clear = contextFunction((_file: string, _line: number) => {
      points.length = 0;
    });
    obj.to_string = () => `gui.LineChart(${points.length} points)`;
  }

  if (typeName === 'Modal') {
    obj.title = '';
    obj.message = '';
    obj.confirm_text = 'OK';
    obj.cancel_text = 'Cancel';
    obj.__input_value = '';
    obj.show_alert = () => showModal(obj, 'alert', state);
    obj.show_confirm = () => showModal(obj, 'confirm', state);
    obj.show_input = () => {
      obj.__input_value = '';
      showModal(obj, 'input', state);
    };
    obj.get_input_value = () => obj.__input_value;
  }
}

export function defaultGuiWidgetSize(typeName: string): { width: number; height: number } {
  switch (typeName) {
    case 'Window':
      return { width: 640, height: 420 };
    case 'Canvas':
      return { width: 300, height: 150 };
    case 'Label':
      return { width: 120, height: 24 };
    case 'Button':
      return { width: 120, height: 32 };
    case 'Frame':
      return { width: 220, height: 140 };
    case 'TabWidget':
      return { width: 320, height: 200 };
    case 'Table':
      return { width: 320, height: 200 };
    case 'BarChart':
    case 'LineChart':
    case 'PieChart':
      return { width: 320, height: 220 };
    case 'ImageBox':
      return { width: 160, height: 120 };
    case 'Icon':
      return { width: 24, height: 24 };
    case 'LineEdit':
      return { width: 180, height: 28 };
    case 'TextEdit':
      return { width: 240, height: 120 };
    case 'ProgressBar':
      return { width: 200, height: 24 };
    case 'SpinBox':
      return { width: 100, height: 28 };
    case 'FloatSpinBox':
      return { width: 120, height: 28 };
    case 'Slider':
      return { width: 200, height: 28 };
    case 'CheckBox':
    case 'RadioButton':
      return { width: 180, height: 24 };
    case 'ComboBox':
      return { width: 180, height: 30 };
    default:
      return { width: 120, height: 32 };
  }
}

export function showModal(obj: RuntimeObject, mode: 'alert' | 'confirm' | 'input', state: RuntimeObjectState): void {
  obj.__modalMode = mode;
  if (!state.modals.includes(obj)) {
    state.modals.push(obj);
  }
}

function defineComboBoxProperties(obj: RuntimeObject, items: string[]): void {
  Object.defineProperty(obj, 'selected_index', {
    enumerable: true,
    configurable: true,
    get() {
      return obj.__selected_index;
    },
    set(value: unknown) {
      obj.__selected_index = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : -1;
    },
  });

  Object.defineProperty(obj, 'selected_text', {
    enumerable: true,
    configurable: true,
    get() {
      const index = obj.__selected_index;
      return typeof index === 'number' && index >= 0 ? items[index] ?? '' : '';
    },
    set(_value: unknown) {
      // selected_text is derived from selected_index and ComboBox items.
    },
  });
}

export function isGuiWidget(typeName: string): boolean {
  return typeName === 'Window'
    || typeName === 'Widget'
    || typeName === 'Canvas'
    || typeName === 'Label'
    || typeName === 'Button'
    || typeName === 'Frame'
    || typeName === 'TabWidget'
    || typeName === 'ImageBox'
    || typeName === 'Icon'
    || typeName === 'LineEdit'
    || typeName === 'TextEdit'
    || typeName === 'ProgressBar'
    || typeName === 'SpinBox'
    || typeName === 'FloatSpinBox'
    || typeName === 'Slider'
    || typeName === 'CheckBox'
    || typeName === 'RadioButton'
    || typeName === 'ComboBox'
    || typeName === 'Table'
    || typeName === 'BarChart'
    || typeName === 'LineChart'
    || typeName === 'PieChart';
}

export function guiObjectUsesFontSize(typeName: string): boolean {
  return typeName === 'Window'
    || typeName === 'Label'
    || typeName === 'Button'
    || typeName === 'Frame'
    || typeName === 'TabWidget'
    || typeName === 'LineEdit'
    || typeName === 'TextEdit'
    || typeName === 'ProgressBar'
    || typeName === 'SpinBox'
    || typeName === 'FloatSpinBox'
    || typeName === 'CheckBox'
    || typeName === 'RadioButton'
    || typeName === 'ComboBox'
    || typeName === 'Table';
}

export function widgetEventsBlocked(target: RuntimeObject): boolean {
  let current: RuntimeObject | undefined = target;
  const seen = new Set<RuntimeObject>();
  while (current && !seen.has(current)) {
    if (current.enabled === false || current.visible === false) return true;
    seen.add(current);
    current = isRuntimeObject(current.__parent) ? current.__parent : undefined;
  }
  return false;
}

export function selectRadioButton(target: RuntimeObject, state: RuntimeObjectState): void {
  const group = typeof target.group === 'string' ? target.group : '';
  const parent = target.__parent;

  // «Бездомное» радио (до add_child) с безымянной группой не гасит никого:
  // группа по умолчанию — это родитель, а родителя ещё нет. Иначе канон
  // «создал → настроил → add_child» схлопывал бы предвыборы двух рамок
  // в одну бездомную группу (E15). Группа решится в add_child.
  if (group === '' && !isRuntimeObject(parent)) {
    target.is_selected = true;
    return;
  }

  for (const item of state.objects) {
    if (item === target || item.__idylliumType !== 'gui.RadioButton') continue;
    const itemGroup = typeof item.group === 'string' ? item.group : '';
    const sameNamedGroup = group !== '' && itemGroup === group;
    const sameParentDefaultGroup = group === '' && itemGroup === '' && item.__parent === parent;
    if (sameNamedGroup || sameParentDefaultGroup) {
      item.is_selected = false;
    }
  }

  target.is_selected = true;
}

export function closeModal(target: RuntimeObject, state: RuntimeObjectState): void {
  const index = state.modals.indexOf(target);
  if (index >= 0) {
    state.modals.splice(index, 1);
  }
  target.__modalMode = '';
}

export function guiCallbackName(target: RuntimeObject, eventName: string): string | null {
  if (eventName === 'click') return 'on_click';
  if (eventName === 'change') return 'on_change';
  if (target.__idylliumType === 'gui.Table' && eventName === 'select') return 'on_select';
  if (target.__idylliumType === 'gui.Modal' && eventName === 'modal_confirm') return 'on_confirm';
  if (target.__idylliumType === 'gui.Modal' && eventName === 'modal_cancel') return 'on_cancel';
  if (target.__idylliumType === 'audio.Music' && eventName === 'finished') return 'on_finished';

  if (target.__idylliumType !== 'gui.Canvas') return null;

  switch (eventName) {
    case 'key_pressed':
      return 'on_key_pressed';
    case 'key_released':
      return 'on_key_released';
    case 'mouse_pressed':
      return 'on_mouse_pressed';
    case 'mouse_released':
      return 'on_mouse_released';
    case 'mouse_move':
      return 'on_mouse_move';
    case 'mouse_scroll':
      return 'on_mouse_scroll';
    default:
      return null;
  }
}

export function guiEventObject(eventName: string, payload: Readonly<Record<string, unknown>>): RuntimeObject {
  if (eventName === 'key_pressed' || eventName === 'key_released') {
    return {
      __idylliumType: 'gui.KeyboardEvent',
      key: typeof payload.key === 'string' ? payload.key : '',
    };
  }

  if (eventName === 'mouse_scroll') {
    return {
      __idylliumType: 'gui.MouseScrollEvent',
      x: eventNumber(payload.x),
      y: eventNumber(payload.y),
      delta: eventNumber(payload.delta),
    };
  }

  return {
    __idylliumType: 'gui.MouseEvent',
    x: eventNumber(payload.x),
    y: eventNumber(payload.y),
    mouse_button: typeof payload.mouse_button === 'string' ? payload.mouse_button : '',
  };
}

export function eventNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

export function eventFloat(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function applyGuiEventPayload(
  target: RuntimeObject,
  eventName: string,
  payload: Readonly<Record<string, unknown>>,
  state: RuntimeObjectState,
): void {
  if (target.__idylliumType === 'audio.Music' && eventName === 'metadata') {
    const duration = Number(payload.duration);
    if (Number.isFinite(duration) && duration >= 0) {
      target.duration = duration;
      if (typeof target.position === 'number' && target.position > duration) target.position = duration;
    }
    return;
  }

  if (target.__idylliumType === 'audio.Music' && eventName === 'finished') {
    target.is_playing = false;
    return;
  }

  if ((target.__idylliumType === 'audio.Sound' || target.__idylliumType === 'audio.Melody') && eventName === 'sound_finished') {
    target.is_playing = false;
    return;
  }

  if (target.__idylliumType === 'gui.Table' && eventName === 'select') {
    const row = Math.trunc(Number(payload.row));
    const rows = Array.isArray(target.__rows) ? (target.__rows as string[][]).length : 0;
    target.selected_row = row >= 0 && row < rows ? row : -1;
    return;
  }

  if (eventName === 'modal_confirm' || eventName === 'modal_cancel') {
    if (typeof payload.input_value === 'string') {
      target.__input_value = payload.input_value;
    }
    closeModal(target, state);
    return;
  }

  if (target.__idylliumType === 'gui.Window' && eventName === 'window_move') {
    // Пользователь перетащил окно за шапку: превью сообщает финальную позицию,
    // и win.x / win.y обновляются тем же путём, что text у LineEdit при вводе, —
    // программа всегда читает место, где окно стоит на самом деле. Только
    // настоящие числа: коэрция Number(null|true|[]) давала 0/1 и вдобавок
    // помечала координату явной, выдёргивая окно из автораскладки (улов
    // ломателя 2026-08-28).
    if (typeof payload.x === 'number' && Number.isFinite(payload.x)) target.x = Math.trunc(payload.x);
    if (typeof payload.y === 'number' && Number.isFinite(payload.y)) target.y = Math.trunc(payload.y);
    return;
  }

  if (target.__idylliumType === 'gui.Window' && eventName === 'window_close') {
    // Крестик — это ПРОСЬБА закрыть окно: решает её dispatchGuiEvent, сначала
    // спросив on_close (1.6.1). Здесь состояние не меняется.
    return;
  }

  if (eventName !== 'change') return;

  switch (target.__idylliumType) {
    case 'gui.LineEdit':
    case 'gui.TextEdit':
      target.text = typeof payload.text === 'string' ? payload.text : '';
      return;
    case 'gui.SpinBox':
    case 'gui.Slider':
      target.value = eventNumber(payload.value);
      return;
    case 'gui.FloatSpinBox':
      target.value = eventFloat(payload.value);
      return;
    case 'gui.CheckBox':
      target.is_checked = payload.is_checked === true;
      return;
    case 'gui.RadioButton':
      if (payload.is_selected === true) {
        selectRadioButton(target, state);
      }
      return;
    case 'gui.ComboBox':
      target.selected_index = eventNumber(payload.selected_index);
      return;
    case 'gui.TabWidget':
      // selected_title — вычисляемое свойство, отдельно синхронизировать не надо.
      target.selected_index = eventNumber(payload.selected_index);
      return;
    default:
      return;
  }
}

/**
 * Событие не доходит до виджета, если выключен или скрыт он сам либо любой
 * из его контейнеров-предков. Modal и Window в цепочке безвредны: у них нет
 * enabled/visible, а undefined !== false.
 */
// Канвас держит программу живой, только пока ему есть где рисовать:
// standalone-канвас (без окна) — сам себе экран, канвас в окне живёт и
// умирает вместе с окном. Иначе крестик окна с канвасом оставлял бы превью
// работать вечно с нулём окон (улов ломателя 2026-08-28).

/**
 * value/min/max у SpinBox, FloatSpinBox и Slider: значение вне границ — ошибка словами
 * (раньше `s.value = 99` при max = 10 хранилось молча, и виджет показывал не то, что
 * лежит в программе). Значение «по умолчанию», которого программа не задавала, тихо
 * переезжает вслед за границей: `s.min = 1;` у нового виджета — не преступление.
 */
function defineBoundedValue(obj: RuntimeObject, owner: string): void {
  let valueIsDefault = true;
  const number = (value: unknown, name: string, file: string, line: number): number => finiteNumber(value, `${owner}.${name}`, file, line);
  defineValidatedRuntimeProperty(obj, 'value', 0, (raw, file, line) => {
    const value = number(raw, 'value', file, line);
    const min = Number(obj.min);
    const max = Number(obj.max);
    if (value < min || value > max) {
      throw new IdylliumRuntimeError(file, line, `${owner}.value must be between ${min} and ${max}, got ${value} — set min and max first`);
    }
    valueIsDefault = false;
    return value;
  });
  const bound = (name: 'min' | 'max', defaultValue: number): void => {
    defineValidatedRuntimeProperty(obj, name, defaultValue, (raw, file, line) => {
      const limit = number(raw, name, file, line);
      const current = Number(obj.value);
      const outside = name === 'min' ? current < limit : current > limit;
      if (outside && !valueIsDefault) {
        throw new IdylliumRuntimeError(file, line, `${owner}.${name} = ${limit} leaves the current value ${current} outside the range — change value first`);
      }
      return limit;
    }, (limit) => {
      const current = Number(obj.value);
      const outside = name === 'min' ? current < Number(limit) : current > Number(limit);
      if (outside && valueIsDefault) {
        obj.value = limit;
        valueIsDefault = true;
      }
    });
  };
  bound('min', 0);
  bound('max', 100);
}

export function canvasKeepsProgramAlive(canvas: RuntimeObject): boolean {
  let current: RuntimeObject | undefined = canvas;
  while (isRuntimeObject(current.__parent)) {
    current = current.__parent as RuntimeObject;
  }
  if (current === canvas) return true;
  if (current.__idylliumType === 'gui.Window') return current.__shown === true;
  return true;
}

export async function initializeGuiChild(child: RuntimeObject): Promise<void> {
  if (child.__idylliumType === 'gui.Canvas') {
    const onInit = child.on_init;
    if (typeof onInit === 'function') {
      await onInit(child);
    }

    const onUpdate = child.on_update;
    if (typeof onUpdate === 'function') {
      await onUpdate(child, 0);
    }
  }

  for (const nested of child.__children as RuntimeObject[] ?? []) {
    await initializeGuiChild(nested);
  }
}
