// Смоук: GUI и медиа — виджеты, окна, канва, IdySS, drawable/image/fonts/audio/turtle.
// Разнесено из smoke.test.ts 2026-08-29 (11,9 тыс. строк); тела тестов — дословно.
import {
  BufferRef,
  IDYLLIUM_SEMANTIC_TOKEN_MODIFIERS,
  IDYLLIUM_SEMANTIC_TOKEN_TYPES,
  IDYLLIUM_VERSION,
  IdylliumLanguageService,
  IdylliumProject,
  assert,
  assertCompiles,
  assertFails,
  assertRuntimeFails,
  compileIdyllium,
  compileProject,
  createDefaultStandardLibrary,
  createMemoryChannelBus,
  createMemoryNetworkService,
  createMemoryRuntimeFileSystem,
  createNodeImageService,
  createRuntime,
  explicitProperties,
  formatIdyllium,
  fs,
  os,
  parseIdylliumStyle,
  path,
  runIdyllium,
  runIdylliumInBrowser,
  runTests,
  runWithInspectableRuntime,
  runWithMemoryFiles,
  scaleRaster,
  test,
  tinyMp3Bytes,
  tinyTtfHeader,
  tinyWavBinary,
} from './smoke-harness';

test('gui themes, link labels, state styles and TabWidget work', async () => {
  const result = await runWithInspectableRuntime([
    'use console;',
    'use gui;',
    '',
    'void function tab_changed(gui.TabWidget sender) {',
    '    console.write(sender.selected_index, ":", sender.selected_title);',
    '}',
    '',
    'main() {',
    '    gui.Window win;',
    '    win.theme = "idyllium";',
    '',
    '    gui.Label link;',
    '    link.text = "Idyllium на GitHub";',
    '    link.href = "https://github.com/Aumphaadr/Idyllium";',
    '',
    '    gui.Button btn;',
    '    btn.text = "Наведи";',
    '    btn.style = "background-color: teal;";',
    '    btn.style_hover = "background-color: dark-blue;";',
    '    btn.style_active = "opacity: 0.5; backround-color: pink;"; // опечатка молчит',
    '',
    '    gui.Frame first;',
    '    gui.Frame second;',
    '',
    '    gui.TabWidget tabs;',
    '    tabs.add_tab("Обзор", first);',
    '    tabs.add_tab("Настройки", second);',
    '    tabs.on_change = tab_changed;',
    '',
    '    win.add_child(link);',
    '    win.add_child(btn);',
    '    win.add_child(tabs);',
    '    win.show();',
    '}',
  ].join('\n'));

  const win = result.runtime.getWindows()[0];
  assert(win.properties.theme === 'idyllium', `unexpected theme: ${JSON.stringify(win.properties.theme)}`);

  const [link, btn, tabs] = win.children;
  assert(link.properties.href === 'https://github.com/Aumphaadr/Idyllium', 'expected label href in snapshot');

  // hover/active едут провалидированными парами; опечатка отброшена
  assert(
    JSON.stringify(btn.properties.style_hover_declarations) === JSON.stringify([{ property: 'background-color', value: '#000080' }]),
    `unexpected hover declarations: ${JSON.stringify(btn.properties.style_hover_declarations)}`,
  );
  assert(
    JSON.stringify(btn.properties.style_active_declarations) === JSON.stringify([{ property: 'opacity', value: '0.5' }]),
    `unexpected active declarations: ${JSON.stringify(btn.properties.style_active_declarations)}`,
  );

  assert(tabs.type === 'gui.TabWidget', `unexpected widget type: ${tabs.type}`);
  assert(
    JSON.stringify(tabs.properties.tab_titles) === JSON.stringify(['Обзор', 'Настройки']),
    `unexpected tab titles: ${JSON.stringify(tabs.properties.tab_titles)}`,
  );
  assert(tabs.children.length === 2, 'expected two tab pages as children');
  assert(tabs.properties.tab_count === 2, 'expected tab_count to follow add_tab');

  await result.runtime.dispatchGuiEvent(tabs.id, 'change', { selected_index: 1 });
  assert(result.runtime.getOutput() === '1:Настройки', `unexpected tab change output: ${JSON.stringify(result.runtime.getOutput())}`);
});

test('IdySS style parser validates the dictionary and silently drops mistakes', () => {
  // Опечатка в имени и цвет вне палитры — молчаливый отброс, валидное — остаётся.
  assert(
    JSON.stringify(parseIdylliumStyle('color: red; backround-color: dark-blue; background-color: pink;'))
      === JSON.stringify([{ property: 'color', value: '#FF0000' }]),
    'expected typo and non-palette color to be dropped silently',
  );
  // Формы цвета: палитра colors (green = #00FF00), HEX, rgb/rgba с диапазонами.
  assert(
    JSON.stringify(parseIdylliumStyle('color: green; border-color: rgba(0, 0, 0, 0.5); background-color: #A3F'))
      === JSON.stringify([
        { property: 'color', value: '#00FF00' },
        { property: 'border-color', value: 'rgba(0, 0, 0, 0.5)' },
        { property: 'background-color', value: '#a3f' },
      ]),
    'expected all three color forms to normalize',
  );
  assert(parseIdylliumStyle('background-color: rgb(999, 0, 0)').length === 0, 'expected out-of-range channel to drop the declaration');
  // Пиксельные величины: px опционален, диапазоны жёсткие.
  assert(
    JSON.stringify(parseIdylliumStyle('border-radius: 12px; padding: 8; font-size: 200px; opacity: 1.5'))
      === JSON.stringify([
        { property: 'border-radius', value: '12px' },
        { property: 'padding', value: '8px' },
      ]),
    'expected px normalization and range enforcement',
  );
  // Регистр имён/значений не важен, мусор между парами молчит.
  assert(
    JSON.stringify(parseIdylliumStyle('COLOR: RED; ;; color red; Font-Weight: BOLD'))
      === JSON.stringify([
        { property: 'color', value: '#FF0000' },
        { property: 'font-weight', value: 'bold' },
      ]),
    'expected case-insensitive parsing and silent garbage skipping',
  );
  assert(parseIdylliumStyle('').length === 0 && parseIdylliumStyle('   ').length === 0, 'expected empty style to parse to nothing');
  // Градиенты: строгое подмножество CSS, каждая остановка — через словарь цветов.
  assert(
    JSON.stringify(parseIdylliumStyle('background: linear-gradient(to right, red, blue)'))
      === JSON.stringify([{ property: 'background', value: 'linear-gradient(to right, #FF0000, #0000FF)' }]),
    'expected linear gradient with direction to normalize',
  );
  assert(
    JSON.stringify(parseIdylliumStyle('background: linear-gradient(45deg, dark-blue, cyan 50%, white)'))
      === JSON.stringify([{ property: 'background', value: 'linear-gradient(45deg, #000080, #00FFFF 50%, #FFFFFF)' }]),
    'expected angle and percent stops to normalize',
  );
  assert(
    JSON.stringify(parseIdylliumStyle('background: radial-gradient(yellow, dark-red)'))
      === JSON.stringify([{ property: 'background', value: 'radial-gradient(#FFFF00, #800000)' }]),
    'expected radial gradient to normalize',
  );
  for (const rejected of [
    'background: linear-gradient(to right, red)',      // одна остановка
    'background: linear-gradient(400deg, red, blue)',  // угол вне диапазона
    'background: linear-gradient(to right, red, pink)',// цвет вне палитры
    'background: url(evil.png)',                       // не градиент
    'background: red',                                 // сплошной цвет — только background-color
  ]) {
    assert(parseIdylliumStyle(rejected).length === 0, `expected rejection: ${rejected}`);
  }
});

test('widget style property ships validated declarations in the snapshot', async () => {
  const result = await runWithInspectableRuntime([
    'use gui;',
    'use colors;',
    'use console;',
    '',
    'main() {',
    '    gui.Window win;',
    '    gui.Label title;',
    '    title.text = "x";',
    '    title.text_color = colors.RED;',
    '    title.style = "color: white; border-radius: 12px; backround-color: pink;";',
    '',
    '    gui.Button plain;',
    '    plain.text = "y";',
    '',
    '    win.add_child(title);',
    '    win.add_child(plain);',
    '    win.show();',
    '    console.write(title.style);',
    '}',
  ].join('\n'));

  const [title, plain] = result.runtime.getWindows()[0].children;
  // Строка читается ровно как присвоена (без нормализации)…
  assert(
    result.runtime.getOutput() === 'color: white; border-radius: 12px; backround-color: pink;',
    `unexpected style read-back: ${JSON.stringify(result.runtime.getOutput())}`,
  );
  // …а в снапшот уезжают только провалидированные пары (опечатка отброшена).
  assert(
    JSON.stringify(title.properties.style_declarations) === JSON.stringify([
      { property: 'color', value: '#FFFFFF' },
      { property: 'border-radius', value: '12px' },
    ]),
    `unexpected declarations: ${JSON.stringify(title.properties.style_declarations)}`,
  );
  // Пустая наклейка не тащит в снапшот ничего.
  assert(plain.properties.style === '', 'expected empty default style');
  assert(!('style_declarations' in plain.properties), 'expected no declarations for empty style');
});

test('browser runtime snapshots drawable asset resource uris', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use colors;',
        'use drawable;',
        'use fonts;',
        'use gui;',
        'use image;',
        '',
        'main() {',
        '    gui.Window win;',
        '    image.Static cat;',
        '    cat.load_from_file("cat.png");',
        '    gui.ImageBox picture;',
        '    picture.set_image(cat);',
        '    picture.resize_mode = "fill";',
        '    win.add_child(picture);',
        '    win.show();',
        '',
        '    fonts.Font font;',
        '    font.load_from_file("lobster.ttf");',
        '    win.font = font;',
        '',
        '    drawable.Text text;',
        '    text.font = font;',
        '    text.text = "123";',
        '    text.text_color = colors.WHITE;',
        '',
        '    gui.Canvas canvas;',
        '    canvas.draw(text);',
        '}',
      ].join('\n'),
      '/workspace/lobster.ttf': {
        content: '',
        bytes: tinyTtfHeader(),
        resourceUri: 'blob:idyllium-font',
      },
      '/workspace/cat.png': {
        content: '',
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/images/cat.png'))),
        resourceUri: 'blob:idyllium-cat',
      },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const draw = result.canvases[0]?.commands.find((command) => command.kind === 'draw');
  const font = draw?.object?.properties.font as { type?: string; properties?: Record<string, unknown> } | undefined;
  assert(font?.properties?.resource_uri === 'blob:idyllium-font', `expected font resource uri, got ${JSON.stringify(draw)}`);
  assert(font?.properties?.format === 'ttf', `expected detected TTF format, got ${JSON.stringify(font)}`);
  assert(font?.type === 'fonts.Font', `expected canonical fonts.Font snapshot, got ${JSON.stringify(font)}`);
  const windowFont = result.windows[0]?.properties.font as { type?: string; properties?: Record<string, unknown> } | undefined;
  assert(windowFont?.type === 'fonts.Font', `expected Window to use fonts.Font, got ${JSON.stringify(windowFont)}`);
  assert(explicitProperties(result.windows[0]?.properties ?? {}).includes('font'), 'expected Window font to be explicit');
  const imageBox = result.windows[0]?.children.find((widget) => widget.type === 'gui.ImageBox');
  const image = imageBox?.properties.image as { properties?: Record<string, unknown> } | undefined;
  assert(image?.properties?.resource_uri === 'blob:idyllium-cat', `expected image resource uri, got ${JSON.stringify(imageBox)}`);
  assert(imageBox?.properties.resize_mode === 'fill', `expected image resize mode, got ${JSON.stringify(imageBox)}`);
});

test('drawable.Font legacy alias is rejected', () => {
  assertFails(`
    use drawable;

    main() {
      drawable.Font old_font;
    }
  `, "unknown type 'drawable.Font'");
});

test('font resource metadata is read-only', () => {
  assertFails(`
    use fonts;

    main() {
      fonts.Font font;
      font.format = "ttf";
    }
  `, "property 'format' is read-only");
});

test('font loading detects all supported formats by contents', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use console;',
        'use fonts;',
        '',
        'main() {',
        '    fonts.Font ttf;',
        '    fonts.Font otf;',
        '    fonts.Font woff;',
        '    fonts.Font woff2;',
        '    ttf.load_from_file("first.bin");',
        '    otf.load_from_file("second.bin");',
        '    woff.load_from_file("third.bin");',
        '    woff2.load_from_file("fourth.bin");',
        '    console.writeln(ttf.format, ",", otf.format, ",", woff.format, ",", woff2.format);',
        '}',
      ].join('\n'),
      '/workspace/first.bin': { content: '', bytes: tinyTtfHeader() },
      '/workspace/second.bin': { content: '', bytes: new TextEncoder().encode('OTTOfont') },
      '/workspace/third.bin': { content: '', bytes: new TextEncoder().encode('wOFFfont') },
      '/workspace/fourth.bin': { content: '', bytes: new TextEncoder().encode('wOF2font') },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'ttf,otf,woff,woff2\n', `unexpected font formats: ${JSON.stringify(result.output)}`);
});

test('font loading rejects unsupported file contents', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use fonts;',
        '',
        'main() {',
        '    fonts.Font broken;',
        '    broken.load_from_file("broken.ttf");',
        '}',
      ].join('\n'),
      '/workspace/broken.ttf': {
        content: 'this is not a font',
        bytes: new TextEncoder().encode('this is not a font'),
        resourceUri: 'blob:idyllium-broken-font',
      },
    },
  });

  assert(!result.success, 'expected unsupported font to fail at runtime');
  assert(
    result.runtimeError?.includes('unsupported font format') === true,
    `unexpected font runtime error: ${result.runtimeError}`,
  );
});

test('image resources transform export and build animations', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': `
        use console;
        use image;

        main() {
          image.Static source;
          source.load_from_file("cat.png");

          image.Static mirrored = source.scale(-1, 1);
          image.Static rotated = source.rotate(90);
          image.Static cropped = source.crop(10, 10, 20, 30);
          mirrored.export_to_file("mirrored.png");

          dyn_array<image.Static> frames = [source, mirrored];
          image.Animation created;
          created.create_from_frames(frames, 0.1);
          created.export_to_file("created.gif");

          image.Animation loaded;
          loaded.load_from_file("created.gif");
          image.Static second = loaded.get_frame(1);

          console.write(
            mirrored.width, "x", mirrored.height, ":",
            rotated.width, "x", rotated.height, ":",
            cropped.width, "x", cropped.height, ":",
            loaded.frame_count, ":", loaded.frame_duration, ":",
            loaded.has_uniform_frame_duration, ":",
            second.width, "x", second.height
          );
        }
      `,
      '/workspace/cat.png': {
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/images/cat.png'))),
      },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '99x100:100x99:20x30:2:0.1:true:99x100', `unexpected image output: ${JSON.stringify(result.output)}`);
  const mirrored = result.writtenFiles['/workspace/mirrored.png'];
  const animation = result.writtenFiles['/workspace/created.gif'];
  assert(typeof mirrored !== 'string' && mirrored?.bytes instanceof Uint8Array && mirrored.bytes.length > 0, 'expected exported PNG bytes');
  assert(typeof animation !== 'string' && animation?.bytes instanceof Uint8Array && animation.bytes.length > 0, 'expected exported GIF bytes');
});

test('image Bitmap edits pixels snapshots Static values and exports', async () => {
  const result = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': `
        use colors;
        use console;
        use image;

        main() {
          image.Bitmap bitmap;
          bitmap.create(3, 2);
          bool transparent_after_create = bitmap.has_alpha;

          bitmap.fill(colors.WHITE);
          bool opaque_after_fill = not bitmap.has_alpha;
          bitmap.set_pixel(1, 0, colors.RED);
          bitmap.fill_rect(0, 1, 3, 1, colors.BLUE);

          colors.Color red = bitmap.get_pixel(1, 0);
          colors.Color blue = bitmap.get_pixel(2, 1);
          image.Static snapshot = bitmap.to_static();

          bitmap.set_pixel(1, 0, colors.GREEN);
          image.Bitmap snapshot_copy;
          snapshot_copy.create_from_image(snapshot);
          colors.Color preserved = snapshot_copy.get_pixel(1, 0);

          image.Bitmap loaded;
          loaded.load_from_file("cat.png");
          bitmap.export_to_file("pixels.png");

          console.write(
            bitmap.width, "x", bitmap.height, ":",
            bitmap.is_created, ":",
            transparent_after_create, ":",
            opaque_after_fill, ":",
            red == colors.RED, ":",
            blue == colors.BLUE, ":",
            preserved == colors.RED, ":",
            snapshot.width, "x", snapshot.height, ":",
            loaded.width, "x", loaded.height
          );
        }
      `,
      '/workspace/cat.png': {
        bytes: new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/images/cat.png'))),
      },
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '3x2:true:true:true:true:true:true:3x2:99x100',
    `unexpected Bitmap output: ${JSON.stringify(result.output)}`,
  );
  const exported = result.writtenFiles['/workspace/pixels.png'];
  assert(
    typeof exported !== 'string' && exported?.bytes instanceof Uint8Array && exported.bytes.length > 0,
    'expected exported Bitmap PNG bytes',
  );
});

test('image Bitmap reports initialization coordinates and rectangle errors', async () => {
  await assertRuntimeFails([
    'use image;',
    '',
    'main() {',
    '    image.Bitmap bitmap;',
    '    bitmap.get_pixel(0, 0);',
    '}',
  ].join('\n'), 'cannot be used before create(), load_from_file(), or create_from_image()');

  await assertRuntimeFails([
    'use colors;',
    'use image;',
    '',
    'main() {',
    '    image.Bitmap bitmap;',
    '    bitmap.create(2, 2);',
    '    bitmap.set_pixel(2, 0, colors.RED);',
    '}',
  ].join('\n'), 'coordinates (2, 0) are outside bitmap bounds 2x2');

  await assertRuntimeFails([
    'use colors;',
    'use image;',
    '',
    'main() {',
    '    image.Bitmap bitmap;',
    '    bitmap.create(2, 2);',
    '    bitmap.fill_rect(1, 1, 2, 1, colors.RED);',
    '}',
  ].join('\n'), 'rectangle (1, 1, 2, 1) is outside bitmap bounds 2x2');

  assertFails(`
    use gui;
    use image;

    main() {
      image.Bitmap bitmap;
      bitmap.create(2, 2);
      gui.ImageBox view;
      view.set_image(bitmap);
    }
  `, "expects 'image.Image', got 'image.Bitmap'");
});

test('node image service round-trips jpeg and webp images', async () => {
  const service = createNodeImageService();
  const source = {
    width: 2,
    height: 1,
    pixels: new Uint8Array([
      255, 20, 30, 255,
      10, 200, 40, 128,
    ]),
  };
  const webpBytes = await service.encodeStatic(source, 'webp');
  const webpImage = await service.decodeStatic(webpBytes, 'webp');
  const jpegBytes = await service.encodeStatic(source, 'jpeg');
  const jpegImage = await service.decodeStatic(jpegBytes, 'jpeg');

  assert(webpBytes.length > 0, 'expected encoded WebP bytes');
  assert(webpImage.format === 'webp', `expected WebP format, got ${webpImage.format}`);
  assert(webpImage.width === 2 && webpImage.height === 1, `unexpected WebP size ${webpImage.width}x${webpImage.height}`);
  assert(webpImage.pixels.length === 8, `unexpected WebP pixel count ${webpImage.pixels.length}`);

  assert(jpegBytes.length > 0, 'expected encoded JPEG bytes');
  assert(jpegImage.format === 'jpeg', `expected JPEG format, got ${jpegImage.format}`);
  assert(jpegImage.width === 2 && jpegImage.height === 1, `unexpected JPEG size ${jpegImage.width}x${jpegImage.height}`);
  assert(jpegImage.pixels.length === 8, `unexpected JPEG pixel count ${jpegImage.pixels.length}`);
});

test('negative image scale mirrors pixels on both axes', () => {
  const horizontal = scaleRaster({
    width: 2,
    height: 1,
    pixels: new Uint8Array([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]),
  }, -1, 1);
  assert(
    JSON.stringify([...horizontal.pixels]) === JSON.stringify([
      0, 0, 255, 255,
      255, 0, 0, 255,
    ]),
    `unexpected horizontal mirror: ${JSON.stringify([...horizontal.pixels])}`,
  );

  const vertical = scaleRaster({
    width: 1,
    height: 2,
    pixels: new Uint8Array([
      20, 40, 60, 255,
      100, 120, 140, 255,
    ]),
  }, 1, -1);
  assert(
    JSON.stringify([...vertical.pixels]) === JSON.stringify([
      100, 120, 140, 255,
      20, 40, 60, 255,
    ]),
    `unexpected vertical mirror: ${JSON.stringify([...vertical.pixels])}`,
  );
});

test('inline callback functions compile and run in headless gui runtime', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    main() {
      gui.Button btn;
      btn.text = "Start";
      int clicks = 0;

      btn.on_click = void function(gui.Button sender) {
        clicks += 1;
        sender.text = to_string(clicks);
      };

      console.write(btn.text);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Start', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('named functions can be assigned as gui and canvas callbacks', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    void function on_click(gui.Button sender) {
      sender.text = "Clicked";
    }

    void function on_update(gui.Canvas canvas, float delta_time) {
      canvas.clear();
    }

    main() {
      gui.Button btn;
      gui.Canvas canvas;

      btn.on_click = on_click;
      canvas.on_update = on_update;

      console.write("callbacks");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'callbacks', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('gui widget registry covers lesson widgets in headless runtime', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    main() {
      gui.Window win;
      gui.SpinBox spin;
      gui.FloatSpinBox fspin;
      gui.Slider slider;
      gui.CheckBox cb;
      gui.RadioButton rb;
      gui.ComboBox combo;
      gui.Frame frame;
      gui.ImageBox image_box;
      gui.Modal modal;

      image_box.resize_mode = "fit";

      spin.value = 5;
      spin.min = 0;
      spin.max = 10;
      spin.step = 1;
      spin.on_change = void function() {};

      fspin.value = 0.5;
      fspin.step = 0.1;

      slider.value = 50;
      slider.visible = true;

      cb.text = "Agree";
      cb.is_checked = true;
      rb.text = "Choice";
      rb.group = "A";
      rb.is_selected = true;

      combo.add_item("One");
      combo.add_item("Two");
      combo.selected_index = 1;
      combo.on_change = void function() {};

      frame.title = "Group";
      frame.add_child(spin);
      modal.title = "Hello";
      modal.message = "World";
      modal.confirm_text = "OK";
      modal.cancel_text = "Cancel";
      modal.on_confirm = void function(gui.Modal sender) {};
      modal.show_alert();

      win.add_child(frame);
      win.add_child(image_box);
      win.add_child(combo);
      console.write(spin.value, ":", fspin.value, ":", slider.value, ":", cb.is_checked, ":", rb.is_selected, ":", image_box.resize_mode, ":", modal.get_input_value());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '5:0.5:50:true:true:fit:', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('gui widgets have useful default sizes', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Label label;
      gui.Button button;
      gui.LineEdit line;
      gui.TextEdit text;
      gui.ProgressBar progress;
      gui.SpinBox spin;
      gui.FloatSpinBox float_spin;
      gui.Slider slider;
      gui.CheckBox checkbox;
      gui.RadioButton radio;
      gui.ComboBox combo;
      gui.Frame frame;
      gui.Canvas canvas;
      gui.ImageBox image_box;

      win.add_child(label);
      win.add_child(button);
      win.add_child(line);
      win.add_child(text);
      win.add_child(progress);
      win.add_child(spin);
      win.add_child(float_spin);
      win.add_child(slider);
      win.add_child(checkbox);
      win.add_child(radio);
      win.add_child(combo);
      win.add_child(frame);
      win.add_child(canvas);
      win.add_child(image_box);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  assert(window.properties.width === 640 && window.properties.height === 420, `unexpected default window size: ${JSON.stringify(window.properties)}`);

  const sizes = new Map(window.children.map((widget) => [
    widget.type,
    [widget.properties.width, widget.properties.height],
  ]));

  assert(JSON.stringify(sizes.get('gui.Label')) === JSON.stringify([120, 24]), 'expected default Label size');
  assert(JSON.stringify(sizes.get('gui.Button')) === JSON.stringify([120, 32]), 'expected default Button size');
  assert(JSON.stringify(sizes.get('gui.LineEdit')) === JSON.stringify([180, 28]), 'expected default LineEdit size');
  assert(JSON.stringify(sizes.get('gui.TextEdit')) === JSON.stringify([240, 120]), 'expected default TextEdit size');
  assert(JSON.stringify(sizes.get('gui.ProgressBar')) === JSON.stringify([200, 24]), 'expected default ProgressBar size');
  assert(JSON.stringify(sizes.get('gui.SpinBox')) === JSON.stringify([100, 28]), 'expected default SpinBox size');
  assert(JSON.stringify(sizes.get('gui.FloatSpinBox')) === JSON.stringify([120, 28]), 'expected default FloatSpinBox size');
  assert(JSON.stringify(sizes.get('gui.Slider')) === JSON.stringify([200, 28]), 'expected default Slider size');
  assert(JSON.stringify(sizes.get('gui.CheckBox')) === JSON.stringify([180, 24]), 'expected default CheckBox size');
  assert(JSON.stringify(sizes.get('gui.RadioButton')) === JSON.stringify([180, 24]), 'expected default RadioButton size');
  assert(JSON.stringify(sizes.get('gui.ComboBox')) === JSON.stringify([180, 30]), 'expected default ComboBox size');
  assert(JSON.stringify(sizes.get('gui.Frame')) === JSON.stringify([220, 140]), 'expected default Frame size');
  assert(JSON.stringify(sizes.get('gui.Canvas')) === JSON.stringify([300, 150]), 'expected default Canvas size');
  assert(JSON.stringify(sizes.get('gui.ImageBox')) === JSON.stringify([160, 120]), 'expected default ImageBox size');
});

test('progress bar exposes text background and foreground colors', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;
    use colors;

    main() {
      gui.Window win;
      gui.ProgressBar progress;
      progress.value = 65;
      progress.text_color = colors.RGB(102, 14, 28);
      progress.background_color = colors.RGB(255, 232, 236);
      progress.foreground_color = colors.RGB(248, 150, 165);
      win.add_child(progress);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  const progress = window.children.find((widget) => widget.type === 'gui.ProgressBar');

  assert(progress !== undefined, 'expected ProgressBar widget');
  assert(progress?.properties.text_color === '#660e1c', `unexpected ProgressBar text color: ${JSON.stringify(progress)}`);
  assert(progress?.properties.background_color === '#ffe8ec', `unexpected ProgressBar background color: ${JSON.stringify(progress)}`);
  assert(progress?.properties.foreground_color === '#f896a5', `unexpected ProgressBar foreground color: ${JSON.stringify(progress)}`);
  assert(explicitProperties(progress.properties).includes('text_color'), 'expected ProgressBar text_color to be explicit');
  assert(explicitProperties(progress.properties).includes('background_color'), 'expected ProgressBar background_color to be explicit');
  assert(explicitProperties(progress.properties).includes('foreground_color'), 'expected ProgressBar foreground_color to be explicit');
  assert(!('fill_color' in progress.properties), 'expected ProgressBar fill_color legacy property to be absent');
});

test('removed widget color legacy properties are rejected', () => {
  assertFails(`
    use colors;
    use gui;

    main() {
      gui.ProgressBar progress;
      progress.fill_color = colors.RED;
    }
  `, "has no property 'fill_color'");

  assertFails(`
    use gui;

    main() {
      gui.Label label;
      label.color = "#ff0000";
    }
  `, "has no property 'color'");
});

test('derived ComboBox selected_text is read-only', () => {
  assertFails(`
    use gui;

    main() {
      gui.ComboBox combo;
      combo.selected_text = "Blue";
    }
  `, "property 'selected_text' is read-only");
});

test('gui color inheritance metadata tracks explicit widget colors', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;
    use colors;

    main() {
      gui.Window win;
      win.text_color = colors.RED;

      gui.Label root_label;
      root_label.text = "red by inheritance";

      gui.Frame frame;
      frame.text_color = colors.GREEN;

      gui.Label inherited_label;
      inherited_label.text = "green by inheritance";

      gui.Label black_label;
      black_label.text = "black explicitly";
      black_label.text_color = colors.BLACK;

      frame.add_child(inherited_label);
      frame.add_child(black_label);
      win.add_child(root_label);
      win.add_child(frame);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  const rootLabel = window.children.find((widget) => widget.type === 'gui.Label');
  const frame = window.children.find((widget) => widget.type === 'gui.Frame');
  const inheritedLabel = frame?.children.find((widget) => widget.properties.text === 'green by inheritance');
  const blackLabel = frame?.children.find((widget) => widget.properties.text === 'black explicitly');

  assert(window.properties.text_color === '#ff0000', `unexpected window text color: ${JSON.stringify(window.properties)}`);
  assert(explicitProperties(window.properties).includes('text_color'), 'expected window text_color to be explicit');
  assert(rootLabel?.properties.text_color === '#000000', `unexpected root label default color: ${JSON.stringify(rootLabel)}`);
  assert(!explicitProperties(rootLabel.properties).includes('text_color'), 'expected root label text_color to be default, not explicit');
  assert(frame?.properties.text_color === '#00ff00', `unexpected frame text color: ${JSON.stringify(frame)}`);
  assert(explicitProperties(frame.properties).includes('text_color'), 'expected frame text_color to be explicit');
  assert(inheritedLabel?.properties.text_color === '#000000', `unexpected inherited label default color: ${JSON.stringify(inheritedLabel)}`);
  assert(!explicitProperties(inheritedLabel.properties).includes('text_color'), 'expected inherited label text_color to be default, not explicit');
  assert(blackLabel?.properties.text_color === '#000000', `unexpected explicit black label color: ${JSON.stringify(blackLabel)}`);
  assert(explicitProperties(blackLabel.properties).includes('text_color'), 'expected black label text_color to be explicit');
});

test('callback function body diagnostics are checked', () => {
  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.on_click = void function(gui.Button sender) {
        sender.unknown_property = "nope";
      };
    }
  `, "has no property 'unknown_property'");
});

test('callback signatures are checked', () => {
  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.on_click = void function(gui.Label sender) {
        sender.text = "wrong";
      };
    }
  `, "callback property 'on_click' expects 'void function()' or 'void function(gui.Button)'");
});

test('on_change checks its callback shape like on_click does', async () => {
  // Находка методистов 2026-09-03: on_change был свободным ANY-свойством и
  // молча принимал колбэк любой сигнатуры (и вовсе не-функцию), хотя
  // лестница №22 обещает отказ для всех callback-свойств. Теперь формы —
  // как у on_click: без параметров или с sender СВОЕГО виджета.
  assertFails(`
    use gui;

    main() {
      gui.SpinBox spin;
      spin.on_change = void function(gui.Button sender) { };
    }
  `, "callback property 'on_change' expects 'void function()' or 'void function(gui.SpinBox)', got 'void function(gui.Button)'");
  assertFails(`
    use gui;

    main() {
      gui.Slider slider;
      slider.on_change = 5;
    }
  `, "callback property 'on_change' expects a function, got 'int'");

  // Обе законные формы живут на каждом из девяти changeable-виджетов.
  const legal = await runIdyllium(`use console;
use gui;
main() {
    gui.LineEdit edit;
    gui.TextEdit textedit;
    gui.SpinBox spin;
    gui.FloatSpinBox fspin;
    gui.Slider slider;
    gui.CheckBox check;
    gui.RadioButton radio;
    gui.ComboBox combo;
    gui.TabWidget tabs;
    edit.on_change = void function(gui.LineEdit sender) { };
    textedit.on_change = void function(gui.TextEdit sender) { };
    spin.on_change = void function(gui.SpinBox sender) { };
    fspin.on_change = void function(gui.FloatSpinBox sender) { };
    slider.on_change = void function(gui.Slider sender) { };
    check.on_change = void function(gui.CheckBox sender) { };
    radio.on_change = void function(gui.RadioButton sender) { };
    combo.on_change = void function(gui.ComboBox sender) { };
    tabs.on_change = void function(gui.TabWidget sender) { };
    spin.on_change = void function() { };
    console.write("ок");
}
`, {}, { file: '/main.idyl' });
  assert(legal.success, legal.runtimeError ?? legal.compilation.diagnosticsText);
  assert(legal.output === 'ок', `legal on_change forms: ${legal.output}`);
});

test('gui widget polymorphism works for variables callbacks and add_child', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    void function move_left(gui.Widget widget) {
      widget.x = 12;
    }

    main() {
      gui.Window win;
      gui.Button btn;
      gui.Label label;

      btn.x = 7;
      btn.on_click = void function(gui.Widget sender) {
        sender.y = 34;
      };

      gui.Widget current = btn;
      move_left(label);
      win.add_child(btn);
      win.add_child(label);
      console.write(current.x, ":", label.x);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '7:12', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('add_child accepts widgets but rejects modal dialogs', () => {
  assertCompiles(`
    use gui;

    main() {
      gui.Window win;
      gui.Frame frame;
      gui.Button btn;

      frame.add_child(btn);
      win.add_child(frame);
    }
  `);

  assertFails(`
    use gui;

    main() {
      gui.Window win;
      gui.Modal modal;
      win.add_child(modal);
    }
  `, "'add_child' argument 1 expects gui widget, got 'gui.Modal'");
});

test('canvas draw accepts drawable objects only', () => {
  assertCompiles(`
    use gui;
    use drawable;

    main() {
      gui.Canvas canvas;
      drawable.Rectangle rect;
      drawable.Circle circle;
      drawable.Line line;
      drawable.Sprite sprite;
      drawable.Text text;

      canvas.draw(rect);
      canvas.draw(circle);
      canvas.draw(line);
      canvas.draw(sprite);
      canvas.draw(text);
    }
  `);

  assertFails(`
    use gui;
    use image;

    main() {
      gui.Canvas canvas;
      image.Static picture;
      canvas.draw(picture);
    }
  `, "'draw' argument 1 expects drawable object, got 'image.Static'");
});

test('headless canvas records drawable commands', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use console;
    use drawable;
    use gui;

    main() {
      gui.Canvas canvas;
      canvas.width = 320;
      canvas.height = 200;

      drawable.Rectangle rect;
      rect.x = 10;
      rect.y = 20;
      rect.width = 30;
      rect.height = 40;
      rect.fill_color = colors.RGB(34, 145, 188);
      rect.move(5, -5);
      rect.rotate(15);
      rect.rotate(5);

      drawable.Circle circle;
      circle.x = 50;
      circle.y = 60;
      circle.radius = 15;
      circle.border_color = colors.RED;
      circle.move(-10, 5);

      drawable.Line line;
      line.x1 = 1;
      line.y1 = 2;
      line.x2 = 90;
      line.y2 = 30;
      line.color = colors.GREEN;
      line.thickness = 4;
      line.move(3, 4);

      drawable.Sprite sprite;
      sprite.x = 100;
      sprite.y = 120;
      sprite.set_scale(0.5, 2.0);
      sprite.move(5, -10);

      drawable.Text text;
      text.text = "Score";
      text.x = 7;
      text.y = 8;
      text.text_color = colors.WHITE;
      text.move(2, 3);

      canvas.clear();
      canvas.fill(colors.RGBA(1, 2, 3, 0.5));   // полупрозрачная: прошлое не закрывает, список не обрезает
      canvas.draw(rect);
      canvas.draw(circle);
      canvas.draw(line);
      canvas.draw(sprite);
      canvas.draw(text);

      console.write(canvas);
    }
  `);

  assert(result.runtime.getOutput() === 'gui.Canvas(commands: 7)', `unexpected canvas output: ${JSON.stringify(result.runtime.getOutput())}`);
  const canvases = result.runtime.getCanvases();
  assert(canvases.length === 1, `expected one canvas, got ${canvases.length}`);
  const canvas = canvases[0];
  assert(canvas.properties.width === 320 && canvas.properties.height === 200, `unexpected canvas properties: ${JSON.stringify(canvas.properties)}`);
  assert(canvas.commands.length === 7, `expected 7 canvas commands, got ${canvas.commands.length}`);
  assert(canvas.commands[0].kind === 'clear' && canvas.commands[0].color === '#000000', 'expected black clear command');
  assert(canvas.commands[1].kind === 'fill' && canvas.commands[1].color === 'rgba(1, 2, 3, 0.5)', 'expected fill command color');
  assert(canvas.commands[2].object?.type === 'drawable.Rectangle', `unexpected first draw object: ${JSON.stringify(canvas.commands[2])}`);
  assert(canvas.commands[2].object?.properties.fill_color === '#2291bc', 'expected rectangle fill color snapshot');
  assert(canvas.commands[2].object?.properties.x === 15 && canvas.commands[2].object?.properties.y === 15, 'expected moved rectangle position');
  assert(canvas.commands[2].object?.properties.rotation === 20, 'expected rectangle rotation snapshot');
  assert(canvas.commands[3].object?.type === 'drawable.Circle', `unexpected second draw object: ${JSON.stringify(canvas.commands[3])}`);
  assert(canvas.commands[3].object?.properties.x === 40 && canvas.commands[3].object?.properties.y === 65, 'expected moved circle position');
  assert(canvas.commands[4].object?.type === 'drawable.Line', `unexpected third draw object: ${JSON.stringify(canvas.commands[4])}`);
  assert(canvas.commands[4].object?.properties.color === '#00ff00', 'expected line color snapshot');
  assert(canvas.commands[4].object?.properties.thickness === 4, 'expected line thickness snapshot');
  assert(canvas.commands[4].object?.properties.x1 === 4 && canvas.commands[4].object?.properties.y1 === 6, 'expected moved line start');
  assert(canvas.commands[4].object?.properties.x2 === 93 && canvas.commands[4].object?.properties.y2 === 34, 'expected moved line end');
  assert(canvas.commands[5].object?.properties.x === 105 && canvas.commands[5].object?.properties.y === 110, 'expected moved sprite position');
  assert(canvas.commands[5].object?.properties.scale_x === 0.5 && canvas.commands[5].object?.properties.scale_y === 2, 'expected sprite scale');
  assert(canvas.commands[6].object?.properties.text === 'Score', 'expected text snapshot');
  assert(canvas.commands[6].object?.properties.x === 9 && canvas.commands[6].object?.properties.y === 11, 'expected moved text position');
  const defaultTextFont = canvas.commands[6].object?.properties.font as {
    properties?: Record<string, unknown>;
  } | undefined;
  assert(defaultTextFont?.properties?.is_builtin === true, `expected bundled Text font, got ${JSON.stringify(defaultTextFont)}`);
  assert(defaultTextFont?.properties?.format === 'woff2', `expected bundled WOFF2 font, got ${JSON.stringify(defaultTextFont)}`);
});

test('gui window show initializes canvas callbacks and snapshots widget tree', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    void function init(gui.Canvas canvas) {
      canvas.fill(colors.RGB(10, 20, 30));
    }

    void function update(gui.Canvas canvas, float delta_time) {
      drawable.Rectangle rect;
      rect.x = 4;
      rect.y = 5;
      rect.width = 6;
      rect.height = 7;
      rect.fill_color = colors.GREEN;
      canvas.draw(rect);
    }

    main() {
      gui.Window win;
      win.width = 200;
      win.height = 120;
      win.title = "Canvas window";

      gui.Frame frame;
      frame.x = 10;
      frame.y = 20;

      gui.Canvas canvas;
      canvas.width = 100;
      canvas.height = 80;
      canvas.on_init = init;
      canvas.on_update = update;

      frame.add_child(canvas);
      win.add_child(frame);
      win.show();
    }
  `);

  const windows = result.runtime.getWindows();
  assert(windows.length === 1, `expected one window, got ${windows.length}`);
  assert(windows[0].properties.title === 'Canvas window', `unexpected window snapshot: ${JSON.stringify(windows[0])}`);
  assert(windows[0].children[0].type === 'gui.Frame', `expected frame child, got ${windows[0].children[0]?.type}`);
  const canvas = windows[0].children[0].children[0].canvas;
  assert(canvas !== undefined, 'expected canvas snapshot inside frame');
  assert(canvas.commands.length === 2, `expected init fill and first update draw, got ${canvas.commands.length}`);
  assert(canvas.commands[0].kind === 'fill' && canvas.commands[0].color === '#0a141e', 'expected init fill command');
  assert(canvas.commands[1].object?.type === 'drawable.Rectangle', `expected update rectangle draw, got ${JSON.stringify(canvas.commands[1])}`);
});

test('the canvas accumulates: only clear() and an opaque fill() start over', async () => {
  // Модель кадра 1.6.1 (вердикт владельца — «как в индустрии»): кадр сам ничего
  // не стирает. Список команд — полное описание экрана, поэтому копится он,
  // а непрозрачная заливка и clear() обрезают его до себя.
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    drawable.Circle ball;
    int mode = 0;

    void function init(gui.Canvas canvas) {
      canvas.fill(colors.BLUE);
    }

    void function update(gui.Canvas canvas, float delta_time) {
      if (mode == 1) {
        canvas.fill(colors.RGBA(0, 0, 0, 0.1));
      }
      if (mode == 2) {
        canvas.fill(colors.BLACK);
      }
      if (mode == 3) {
        canvas.clear();
      }
      ball.x = ball.x + 1;
      canvas.draw(ball);
    }

    void function on_key(gui.Canvas canvas, gui.KeyboardEvent evt) {
      mode = mode + 1;
    }

    main() {
      gui.Window win;
      gui.Canvas canvas;
      canvas.on_init = init;
      canvas.on_update = update;
      canvas.on_key_pressed = on_key;
      win.add_child(canvas);
      win.show();
    }
  `);
  const runtime = result.runtime;
  const snapshot = () => runtime.getWindows()[0].children[0].canvas!;
  const kinds = () => snapshot().commands.map((command) => command.kind).join(' ');
  const canvasId = snapshot().id;
  await runtime.stepGui(0.02);
  await runtime.stepGui(0.02);
  await runtime.stepGui(0.02);
  // Нарисованное в on_init живёт, пока его не закрасят; забытый fill — честный шлейф.
  // (show() сам делает первый кадр — on_init и on_update(0), — отсюда четвёртый круг.)
  assert(kinds() === 'fill draw draw draw draw', `no fill in update must leave a trail over the init fill: ${kinds()}`);
  const xs = snapshot().commands.slice(1).map((command) => command.object?.properties.x);
  assert(JSON.stringify(xs) === '[1,2,3,4]', `the trail keeps every past position: ${JSON.stringify(xs)}`);

  await runtime.dispatchGuiEvent(canvasId, 'key_pressed', { key: 'A' });   // mode 1: затухающий след
  await runtime.stepGui(0.02);
  await runtime.stepGui(0.02);
  assert(kinds() === 'fill draw draw draw draw fill draw fill draw', `a translucent fill covers nothing and keeps the past: ${kinds()}`);

  // Хосту-рендереру уходит не весь список, а хвост (1.6.2): он хранит картинку между кадрами.
  // Полупрозрачная заливка историю НЕ обрезает (вуаль заливкой и вуаль прямоугольником обязаны
  // вести себя одинаково) — список растёт, а снимок-хвост остаётся размером в один кадр.
  const full = snapshot();
  assert(full.commandsFrom === 0 && full.total === full.commands.length, 'without options the snapshot is the whole list');
  const known = { [full.id]: { epoch: full.epoch, count: full.total } };
  for (let frame = 0; frame < 200; frame += 1) await runtime.stepGui(0.02);
  const tail = runtime.getWindows({ knownCanvases: known })[0].children[0].canvas!;
  assert(tail.total === full.total + 400 && tail.commandsFrom === full.total && tail.commands.length === 400,
    `the host gets only what it has not seen: from ${tail.commandsFrom}, ${tail.commands.length} of ${tail.total}`);
  assert(tail.epoch === full.epoch, 'a translucent fill continues the same list');
  assert(snapshot().commands.length === tail.total, 'the full list is still there for save_svg and tests');

  await runtime.dispatchGuiEvent(canvasId, 'key_pressed', { key: 'A' });   // mode 2: непрозрачная заливка
  await runtime.stepGui(0.02);
  await runtime.stepGui(0.02);
  assert(kinds() === 'fill draw', `an opaque fill starts the picture over: ${kinds()}`);
  const restarted = runtime.getWindows({ knownCanvases: { [full.id]: { epoch: tail.epoch, count: tail.total } } })[0].children[0].canvas!;
  assert(restarted.epoch > tail.epoch && restarted.commandsFrom === 0 && restarted.commands.length === restarted.total,
    `an opaque fill opens a new epoch, and a host with an old tail gets the whole new list: ${JSON.stringify({ epoch: restarted.epoch, from: restarted.commandsFrom })}`);

  await runtime.dispatchGuiEvent(canvasId, 'key_pressed', { key: 'A' });   // mode 3: clear()
  await runtime.stepGui(0.02);
  assert(kinds() === 'clear draw', `clear() starts the picture over: ${kinds()}`);
});

test('gui step keeps static canvas commands when no update callback exists', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    main() {
      gui.Canvas canvas;
      drawable.Rectangle rect;
      rect.x = 10;
      rect.y = 20;
      rect.width = 30;
      rect.height = 40;
      rect.fill_color = colors.BLUE;
      canvas.draw(rect);
    }
  `);

  const changed = await result.runtime.stepGui(0.016);
  assert(changed === false, 'expected a static Canvas GUI step to stay unchanged');
  const canvas = result.runtime.getCanvases()[0];
  assert(canvas.commands.length === 1, `expected static draw command to remain, got ${canvas.commands.length}`);
  assert(canvas.commands[0].object?.properties.x === 10, `unexpected static canvas snapshot: ${JSON.stringify(canvas)}`);
});

test('gui canvas events update state and next frame snapshot', async () => {
  const result = await runWithInspectableRuntime(`
    use colors;
    use drawable;
    use gui;

    drawable.Rectangle player;

    void function init(gui.Canvas canvas) {
      player.x = 10;
      player.y = 20;
      player.width = 30;
      player.height = 40;
      player.fill_color = colors.WHITE;
    }

    void function on_key_pressed(gui.Canvas canvas, gui.KeyboardEvent evt) {
      if (evt.key == "D") {
        player.x += 5;
      }
    }

    void function on_mouse_scroll(gui.Canvas canvas, gui.MouseScrollEvent evt) {
      player.y += evt.delta;
    }

    void function update(gui.Canvas canvas, float delta_time) {
      canvas.clear();
      canvas.draw(player);
    }

    main() {
      gui.Window win;
      gui.Canvas canvas;
      canvas.on_init = init;
      canvas.on_key_pressed = on_key_pressed;
      canvas.on_mouse_scroll = on_mouse_scroll;
      canvas.on_update = update;
      win.add_child(canvas);
      win.show();
    }
  `);

  const canvasId = result.runtime.getCanvases()[0]?.id;
  assert(typeof canvasId === 'number', 'expected canvas id');

  let draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.x === 10 && draw.object.properties.y === 20, `unexpected initial draw snapshot: ${JSON.stringify(draw)}`);

  await result.runtime.dispatchGuiEvent(canvasId, 'key_pressed', { key: 'D' });
  assert(await result.runtime.stepGui(0.016), 'expected Canvas on_update to change the GUI snapshot');
  draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.x === 15, `expected key event to move player, got ${JSON.stringify(draw)}`);

  await result.runtime.dispatchGuiEvent(canvasId, 'mouse_scroll', { x: 3, y: 4, delta: -2 });
  assert(await result.runtime.stepGui(0.016), 'expected Canvas on_update after mouse scroll');
  draw = result.runtime.getCanvases()[0].commands.find((command) => command.kind === 'draw');
  assert(draw?.object?.properties.y === 18, `expected mouse scroll to move player, got ${JSON.stringify(draw)}`);
});

test('gui widget events update properties and callbacks', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;

      gui.Label status;
      status.text = "ready";

      gui.Button btn;
      btn.text = "press";
      btn.on_click = void function(gui.Button sender) {
        sender.text = "pressed";
        status.text = "button";
      };

      gui.LineEdit input;
      input.on_change = void function() {
        status.text = input.text;
      };

      gui.TextEdit notes;
      notes.on_change = void function() {
        status.text = "notes:" + notes.text;
      };

      gui.Slider slider;
      slider.min = 0;
      slider.max = 10;
      slider.value = 3;
      slider.on_change = void function() {
        status.text = "slider:" + to_string(slider.value);
      };

      gui.CheckBox cb;
      cb.text = "yes";
      cb.on_change = void function() {
        if (cb.is_checked) {
          status.text = "checked";
        } else {
          status.text = "unchecked";
        }
      };

      gui.RadioButton rb1;
      rb1.text = "A";
      rb1.is_selected = true;
      gui.RadioButton rb2;
      rb2.text = "B";
      rb2.on_change = void function() {
        status.text = "radio:" + rb2.text;
      };

      gui.ComboBox combo;
      combo.add_item("Red");
      combo.add_item("Green");
      combo.add_item("Blue");
      combo.on_change = void function() {
        status.text = "combo:" + combo.selected_text;
      };

      win.add_child(status);
      win.add_child(btn);
      win.add_child(input);
      win.add_child(notes);
      win.add_child(slider);
      win.add_child(cb);
      win.add_child(rb1);
      win.add_child(rb2);
      win.add_child(combo);
      win.show();
    }
  `);

  const widget = (type: string, text?: string) => {
    const found = result.runtime.getWindows()[0].children.find((item) => (
      item.type === type && (text === undefined || item.properties.text === text)
    ));
    assert(found !== undefined, `expected widget ${type} ${text ?? ''}`);
    return found;
  };
  const status = () => widget('gui.Label');

  await result.runtime.dispatchGuiEvent(widget('gui.Button').id, 'click', {});
  assert(widget('gui.Button').properties.text === 'pressed', 'expected button callback to mutate sender');
  assert(status().properties.text === 'button', `unexpected status after button: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.LineEdit').id, 'change', { text: 'Ada' });
  assert(widget('gui.LineEdit').properties.text === 'Ada', 'expected LineEdit text to update');
  assert(status().properties.text === 'Ada', `unexpected status after input: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.TextEdit').id, 'change', { text: 'Two\nlines' });
  assert(widget('gui.TextEdit').properties.text === 'Two\nlines', 'expected TextEdit text to update');
  assert(status().properties.text === 'notes:Two\nlines', `unexpected status after TextEdit: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.Slider').id, 'change', { value: 7 });
  assert(widget('gui.Slider').properties.value === 7, 'expected Slider value to update');
  assert(status().properties.text === 'slider:7', `unexpected status after slider: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.CheckBox').id, 'change', { is_checked: true });
  assert(widget('gui.CheckBox').properties.is_checked === true, 'expected CheckBox state to update');
  assert(status().properties.text === 'checked', `unexpected status after checkbox: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.RadioButton', 'B').id, 'change', { is_selected: true });
  assert(widget('gui.RadioButton', 'A').properties.is_selected === false, 'expected default radio group to unselect sibling');
  assert(widget('gui.RadioButton', 'B').properties.is_selected === true, 'expected selected radio button');
  assert(status().properties.text === 'radio:B', `unexpected status after radio: ${JSON.stringify(status())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.ComboBox').id, 'change', { selected_index: 2 });
  const combo = widget('gui.ComboBox');
  assert(combo.properties.selected_index === 2, 'expected ComboBox selected_index to update');
  assert(combo.properties.selected_text === 'Blue', `expected ComboBox selected_text, got ${combo.properties.selected_text}`);
  assert(combo.items?.join(',') === 'Red,Green,Blue', `expected ComboBox items snapshot, got ${JSON.stringify(combo.items)}`);
  assert(status().properties.text === 'combo:Blue', `unexpected status after combo: ${JSON.stringify(status())}`);
});

test('gui timers tick during gui steps', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Label label;
      label.text = "0";

      gui.Timer timer;
      timer.interval = 100;
      int ticks = 0;

      timer.on_tick = void function(gui.Timer sender) {
        ticks += 1;
        label.text = to_string(ticks);
        if (ticks == 3) {
          sender.stop();
        }
      };

      timer.start();
      win.add_child(label);
      win.show();
    }
  `);

  const label = () => result.runtime.getWindows()[0].children[0];
  assert(await result.runtime.stepGui(0.25), 'expected timer ticks to change GUI state');
  assert(label().properties.text === '2', `expected two timer ticks, got ${JSON.stringify(label())}`);
  assert(await result.runtime.stepGui(0.10), 'expected the final timer tick to change GUI state');
  assert(label().properties.text === '3', `expected third timer tick, got ${JSON.stringify(label())}`);
  assert(await result.runtime.stepGui(0.50) === false, 'expected a stopped timer GUI step to stay unchanged');
  assert(label().properties.text === '3', `expected stopped timer to stay at 3, got ${JSON.stringify(label())}`);
});

test('gui timer supports pause resume restart and the running flag', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Label label;
      label.text = "init";
      int ticks = 0;

      gui.Timer timer;
      timer.interval = 1000;

      gui.Button control;
      control.text = "control";
      control.on_click = void function() {
        if (timer.running) {
          timer.stop();
        } else {
          timer.start();
        }
        label.text = to_string(ticks) + ":" + to_string(timer.running);
      };

      gui.Button reset;
      reset.text = "reset";
      reset.on_click = void function() {
        timer.restart();
        label.text = to_string(ticks) + ":" + to_string(timer.running);
      };

      timer.on_tick = void function() {
        ticks += 1;
        label.text = to_string(ticks) + ":" + to_string(timer.running);
      };

      timer.start();
      win.add_child(label);
      win.add_child(control);
      win.add_child(reset);
      win.show();
    }
  `);

  const widget = (type: string, text?: string) => {
    const found = result.runtime.getWindows()[0].children.find((item) => (
      item.type === type && (text === undefined || item.properties.text === text)
    ));
    assert(found !== undefined, `expected widget ${type} ${text ?? ''}`);
    return found;
  };
  const label = () => result.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Label');

  await result.runtime.stepGui(0.4);
  assert(label()?.properties.text === 'init', 'expected no tick before the interval elapses');

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'control').id, 'click', {});
  assert(label()?.properties.text === '0:false', `expected stop to pause the timer, got ${JSON.stringify(label())}`);
  assert(await result.runtime.stepGui(0.5) === false, 'expected a paused timer to keep GUI state unchanged');

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'control').id, 'click', {});
  assert(label()?.properties.text === '0:true', `expected start to resume the timer, got ${JSON.stringify(label())}`);
  await result.runtime.stepGui(0.7);
  assert(label()?.properties.text === '1:true', `expected resume to keep the 0.4s of progress, got ${JSON.stringify(label())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'reset').id, 'click', {});
  await result.runtime.stepGui(0.9);
  assert(label()?.properties.text === '1:true', `expected restart to drop accumulated progress, got ${JSON.stringify(label())}`);
  await result.runtime.stepGui(0.2);
  assert(label()?.properties.text === '2:true', `expected the restarted timer to tick after a full interval, got ${JSON.stringify(label())}`);

  assertFails(`
    use gui;

    main() {
      gui.Timer timer;
      timer.running = true;
    }
  `, "property 'running' is read-only");
});

test('radio button deselection fires on_change for group siblings', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Label label;
      label.text = "";

      gui.RadioButton first;
      first.text = "first";
      first.group = "letters";
      first.is_selected = true;
      first.on_change = void function() {
        label.text = label.text + "first=" + to_string(first.is_selected) + ";";
      };

      gui.RadioButton second;
      second.text = "second";
      second.group = "letters";
      second.on_change = void function() {
        label.text = label.text + "second=" + to_string(second.is_selected) + ";";
      };

      win.add_child(label);
      win.add_child(first);
      win.add_child(second);
      win.show();
    }
  `);

  const widget = (type: string, text: string) => {
    const found = result.runtime.getWindows()[0].children.find((item) => (
      item.type === type && item.properties.text === text
    ));
    assert(found !== undefined, `expected widget ${type} ${text}`);
    return found;
  };
  const label = () => result.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Label');

  await result.runtime.dispatchGuiEvent(widget('gui.RadioButton', 'second').id, 'change', { is_selected: true });
  assert(
    label()?.properties.text === 'second=true;first=false;',
    `expected on_change for both the selected and deselected radio, got ${JSON.stringify(label())}`,
  );
  assert(widget('gui.RadioButton', 'first').properties.is_selected === false, 'expected first radio to be deselected');
});

test('gui modals snapshot close and run callbacks', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;

      gui.Label label;
      label.text = "ready";

      gui.Button confirm_btn;
      confirm_btn.text = "confirm";
      confirm_btn.on_click = void function() {
        gui.Modal modal;
        modal.title = "Question";
        modal.message = "Continue?";
        modal.confirm_text = "Yes";
        modal.cancel_text = "No";
        modal.on_confirm = void function(gui.Modal sender) {
          label.text = "confirmed";
        };
        modal.on_cancel = void function(gui.Modal sender) {
          label.text = "cancelled";
        };
        modal.show_confirm();
      };

      gui.Button input_btn;
      input_btn.text = "input";
      input_btn.on_click = void function() {
        gui.Modal modal;
        modal.title = "Name";
        modal.message = "Your name?";
        modal.confirm_text = "Save";
        modal.cancel_text = "Cancel";
        modal.on_confirm = void function(gui.Modal sender) {
          label.text = "Hello, " + sender.get_input_value();
        };
        modal.show_input();
      };

      win.add_child(label);
      win.add_child(confirm_btn);
      win.add_child(input_btn);
      win.show();
    }
  `);

  const widget = (type: string, text?: string) => {
    const found = result.runtime.getWindows()[0].children.find((item) => (
      item.type === type && (text === undefined || item.properties.text === text)
    ));
    assert(found !== undefined, `expected widget ${type} ${text ?? ''}`);
    return found;
  };
  const label = () => widget('gui.Label');

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'confirm').id, 'click', {});
  let modals = result.runtime.getModals();
  assert(modals.length === 1, `expected one confirm modal, got ${modals.length}`);
  assert(modals[0].mode === 'confirm' && modals[0].properties.title === 'Question', `unexpected confirm modal: ${JSON.stringify(modals[0])}`);

  await result.runtime.dispatchGuiEvent(modals[0].id, 'modal_cancel', {});
  assert(result.runtime.getModals().length === 0, 'expected confirm modal to close after cancel');
  assert(label().properties.text === 'cancelled', `expected cancel callback, got ${JSON.stringify(label())}`);

  await result.runtime.dispatchGuiEvent(widget('gui.Button', 'input').id, 'click', {});
  modals = result.runtime.getModals();
  assert(modals.length === 1 && modals[0].mode === 'input', `expected input modal, got ${JSON.stringify(modals)}`);

  await result.runtime.dispatchGuiEvent(modals[0].id, 'modal_confirm', { input_value: 'Ada' });
  assert(result.runtime.getModals().length === 0, 'expected input modal to close after confirm');
  assert(label().properties.text === 'Hello, Ada', `expected input callback to read value, got ${JSON.stringify(label())}`);
});

test('image asset loading reports readable runtime errors', async () => {
  await assertRuntimeFails([
    'use image;',
    '',
    'main() {',
    '    image.Static picture;',
    '    picture.load_from_file("missing-player.png");',
    '}',
  ].join('\n'), "main.idyl:5: runtime error: Static.load_from_file() cannot load 'missing-player.png': file does not exist");

  assertFails(`
    use gui;

    main() {
      gui.ImageBox picture;
      picture.load_from_file("cat.png");
    }
  `, "type 'gui.ImageBox' has no method 'load_from_file'");
});

test('button does not accept input-only placeholder', () => {
  assertFails(`
    use gui;

    main() {
      gui.Button btn;
      btn.placeholder = "Nope";
    }
  `, "has no property 'placeholder'");
});

test('text-bearing gui widgets expose font_size', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      win.font_size = 18;

      gui.Label label; label.font_size = 19;
      gui.Button button; button.font_size = 20;
      gui.Frame frame; frame.font_size = 21;
      gui.LineEdit line; line.font_size = 22;
      gui.TextEdit text; text.font_size = 23;
      gui.ProgressBar progress; progress.font_size = 24;
      gui.SpinBox spin; spin.font_size = 25;
      gui.FloatSpinBox float_spin; float_spin.font_size = 26;
      gui.CheckBox checkbox; checkbox.font_size = 27;
      gui.RadioButton radio; radio.font_size = 28;
      gui.ComboBox combo; combo.font_size = 29; combo.add_item("One");

      win.add_child(label);
      win.add_child(button);
      win.add_child(frame);
      win.add_child(line);
      win.add_child(text);
      win.add_child(progress);
      win.add_child(spin);
      win.add_child(float_spin);
      win.add_child(checkbox);
      win.add_child(radio);
      win.add_child(combo);
      win.show();
    }
  `);

  const window = result.runtime.getWindows()[0];
  assert(window.properties.font_size === 18, `unexpected Window font_size: ${JSON.stringify(window.properties)}`);
  assert(explicitProperties(window.properties).includes('font_size'), 'expected explicit Window font_size');

  const expected = new Map<string, number>([
    ['gui.Label', 19],
    ['gui.Button', 20],
    ['gui.Frame', 21],
    ['gui.LineEdit', 22],
    ['gui.TextEdit', 23],
    ['gui.ProgressBar', 24],
    ['gui.SpinBox', 25],
    ['gui.FloatSpinBox', 26],
    ['gui.CheckBox', 27],
    ['gui.RadioButton', 28],
    ['gui.ComboBox', 29],
  ]);
  for (const child of window.children) {
    const fontSize = expected.get(child.type);
    if (fontSize === undefined) continue;
    assert(child.properties.font_size === fontSize, `unexpected ${child.type} font_size: ${JSON.stringify(child.properties)}`);
    assert(explicitProperties(child.properties).includes('font_size'), `expected explicit ${child.type} font_size`);
    expected.delete(child.type);
  }
  assert(expected.size === 0, `missing font_size snapshots for: ${[...expected.keys()].join(', ')}`);
});

test('non-text gui widgets do not expose font_size', () => {
  assertFails(`
    use gui;

    main() {
      gui.Canvas canvas;
      canvas.font_size = 20;
    }
  `, "has no property 'font_size'");
});

test('audio module records sound and music commands', async () => {
  const result = await runWithMemoryFiles(`
    use audio;

    main() {
      audio.Sound click;
      click.load_from_file("click.wav");
      click.volume = 0.5;
      click.play();
      click.pause();
      click.resume();
      click.stop();

      audio.Music music;
      music.load_from_file("theme.wav");
      music.volume = 0.25;
      music.loop = true;
      music.position = 0.0;
      music.play();
    }
  `, {
    '/workspace/click.wav': tinyWavBinary(),
    '/workspace/theme.wav': tinyWavBinary(),
  });

  const audio = result.runtime.getAudio();
  assert(audio.length === 2, `expected two audio objects, got ${JSON.stringify(audio)}`);
  const sound = audio.find((item) => item.type === 'audio.Sound');
  const music = audio.find((item) => item.type === 'audio.Music');
  assert(sound !== undefined, 'expected audio.Sound snapshot');
  assert(music !== undefined, 'expected audio.Music snapshot');
  assert(sound.properties.src === 'click.wav', `unexpected sound src: ${JSON.stringify(sound.properties)}`);
  assert(sound.properties.volume === 0.5, `unexpected sound volume: ${JSON.stringify(sound.properties)}`);
  assert(sound.commands.map((command) => command.action).join(',') === 'play,pause,resume,stop', `unexpected sound commands: ${JSON.stringify(sound.commands)}`);
  assert(music.properties.loop === true, `unexpected music loop: ${JSON.stringify(music.properties)}`);
  assert(music.properties.volume === 0.25, `unexpected music volume: ${JSON.stringify(music.properties)}`);
  assert(music.commands.map((command) => command.action).join(',') === 'seek,play', `unexpected music commands: ${JSON.stringify(music.commands)}`);
});

test('audio music reads MP3 duration from binary project assets', async () => {
  const compilation = compileIdyllium(`
    use audio;

    main() {
      audio.Music music;
      music.load_from_file("theme.mp3");
      music.position = music.duration / 2.0;
      music.position = music.duration / 2.0;
    }
  `, { file: '/workspace/main.idyl' });
  assert(compilation.success && compilation.jsCode !== null, compilation.diagnosticsText);

  const runtime = createRuntime({
    fileSystem: createMemoryRuntimeFileSystem({
      '/workspace/theme.mp3': { bytes: tinyMp3Bytes() },
    }),
  });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  await program(runtime);

  const music = runtime.getAudio().find((item) => item.type === 'audio.Music');
  assert(music !== undefined, 'expected MP3 music snapshot');
  const expectedDuration = 10 * 1152 / 44100;
  assert(
    Math.abs(Number(music.properties.duration) - expectedDuration) < 0.000001,
    `unexpected MP3 duration: ${String(music.properties.duration)}`,
  );
  assert(
    Math.abs(Number(music.properties.position) - expectedDuration / 2) < 0.000001,
    `unexpected MP3 midpoint: ${String(music.properties.position)}`,
  );
  assert(
    music.commands.map((command) => command.action).join(',') === 'seek,seek',
    `expected repeated seek commands, got ${JSON.stringify(music.commands)}`,
  );
});

test('audio load and property errors are readable', async () => {
  await assertRuntimeFails(`
    use audio;

    main() {
      audio.Sound click;
      click.load_from_file("missing.wav");
    }
  `, "Sound.load_from_file() cannot load 'missing.wav': file does not exist");

  const compilation = compileIdyllium(`
    use audio;

    main() {
      audio.Sound click;
      click.load_from_file("click.wav");
      click.volume = 1.5;
    }
  `, { file: '/workspace/main.idyl' });
  assert(compilation.success && compilation.jsCode !== null, compilation.diagnosticsText);

  const runtime = createRuntime({
    fileSystem: createMemoryRuntimeFileSystem({ '/workspace/click.wav': tinyWavBinary() }),
  });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const factory = new AsyncFunction(compilation.jsCode);
  const program = await factory();
  try {
    await program(runtime);
    throw new Error('expected audio volume runtime error');
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    assert(text.includes('Sound.volume must be between 0 and 1'), `unexpected audio volume error: ${text}`);
  }
});

test('audio music finished event runs callback', async () => {
  const result = await runWithMemoryFiles(`
    use audio;
    use console;

    main() {
      audio.Music intro;
      intro.load_from_file("intro.wav");
      intro.on_finished = void function(audio.Music current) {
        console.writeln("finished: ", current.src);
      };
      intro.play();
    }
  `, {
    '/workspace/intro.wav': tinyWavBinary(),
  });

  const music = result.runtime.getAudio().find((item) => item.type === 'audio.Music');
  assert(music !== undefined, 'expected music snapshot');
  await result.runtime.dispatchGuiEvent(music.id, 'metadata', { duration: 12.5 });
  const withMetadata = result.runtime.getAudio().find((item) => item.id === music.id);
  assert(withMetadata?.properties.duration === 12.5, `unexpected metadata duration: ${JSON.stringify(withMetadata)}`);
  await result.runtime.dispatchGuiEvent(music.id, 'finished', {});
  assert(result.runtime.getOutput() === 'finished: intro.wav\n', `unexpected on_finished output: ${JSON.stringify(result.runtime.getOutput())}`);
  const updated = result.runtime.getAudio().find((item) => item.id === music.id);
  assert(updated?.properties.is_playing === false, `expected finished music to stop playing, got ${JSON.stringify(updated)}`);
});

test('TabWidget selected_title follows selected_index', async () => {
  const result = await runIdyllium(`
    use console;
    use gui;

    main() {
      gui.Frame first;
      gui.Frame second;

      gui.TabWidget tabs;
      tabs.add_tab("Первая", first);
      tabs.add_tab("Вторая", second);

      console.writeln(tabs.tab_count, " ", tabs.selected_title);
      tabs.selected_index = 1;
      console.writeln(tabs.selected_title);
      tabs.clear_tabs();
      console.writeln(tabs.tab_count, " [", tabs.selected_title, "]");
    }
  `, {}, { file: 'main.idyl' });

  assert(result.success, `expected success, got: ${result.runtimeError ?? result.output}`);
  assert(
    result.output === '2 Первая\nВторая\n0 []\n',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('gui window close removes it from the program', async () => {
  const { runtime } = await runWithInspectableRuntime([
    'use gui;',
    '',
    'main() {',
    '    gui.Window win;',
    '    gui.Button quit;',
    '    quit.text = "Выход";',
    '    quit.on_click = void function() { win.close(); };',
    '    win.add_child(quit);',
    '    win.show();',
    '}',
  ].join('\n'));

  assert(runtime.getWindows().length === 1, 'expected one window before the click');
  assert(runtime.hasGui(), 'expected the program to hold a GUI');

  const button = runtime.getWindows()[0].children[0];
  await runtime.dispatchGuiEvent(button.id, 'click', {});

  assert(runtime.getWindows().length === 0, 'expected the window to be gone after close()');
  assert(!runtime.hasGui(), 'expected the program to finish once the last window closed');
});

test('windows are draggable citizens: x/y explicitness, window_move and the close cross', async () => {
  const { runtime } = await runWithInspectableRuntime([
    'use gui;',
    '',
    'main() {',
    '    gui.Window win;',
    '    win.title = "Первое";',
    '    win.show();',
    '',
    '    gui.Window placed;',
    '    placed.title = "Второе";',
    '    placed.x = 500;',
    '    placed.y = 300;',
    '    placed.show();',
    '}',
  ].join('\n'));

  const [first, placed] = runtime.getWindows();
  // Явность координат: окно без x/y раскладывает превью, окно с x/y стоит
  // по координатам — рендерер различает их по __explicit_properties.
  const firstExplicit = (first.properties.__explicit_properties ?? []) as string[];
  const placedExplicit = (placed.properties.__explicit_properties ?? []) as string[];
  assert(!firstExplicit.includes('x') && !firstExplicit.includes('y'),
    `untouched window must not claim explicit x/y: ${JSON.stringify(firstExplicit)}`);
  assert(placedExplicit.includes('x') && placedExplicit.includes('y'),
    `window with assigned x/y must be explicit: ${JSON.stringify(placedExplicit)}`);
  assert(placed.properties.x === 500 && placed.properties.y === 300,
    `assigned coordinates ride the snapshot: ${placed.properties.x}, ${placed.properties.y}`);

  // Перетаскивание за шапку: превью шлёт window_move, программа читает свежие x/y.
  await runtime.dispatchGuiEvent(first.id, 'window_move', { x: 120, y: 40 });
  const moved = runtime.getWindows()[0];
  assert(moved.properties.x === 120 && moved.properties.y === 40,
    `window_move must update x/y: ${moved.properties.x}, ${moved.properties.y}`);
  const movedExplicit = (moved.properties.__explicit_properties ?? []) as string[];
  assert(movedExplicit.includes('x') && movedExplicit.includes('y'),
    'a dragged window settles at explicit coordinates');

  // Грязный payload (коэрция Number(null|true) давала 0/1) не трогает
  // координаты и НЕ помечает их явными — окно остаётся в автораскладке.
  await runtime.dispatchGuiEvent(first.id, 'window_move', { x: null, y: true });
  const untouched = runtime.getWindows()[0];
  assert(untouched.properties.x === 120 && untouched.properties.y === 40,
    `non-numeric window_move must be ignored: ${untouched.properties.x}, ${untouched.properties.y}`);

  // Крестик закрывает СВОЁ окно: второе живо, программа тоже; с последним
  // окном уходит и программа.
  await runtime.dispatchGuiEvent(first.id, 'window_close', {});
  assert(runtime.getWindows().length === 1, 'the cross closes only its own window');
  assert(runtime.hasGui(), 'the program lives while another window is shown');
  await runtime.dispatchGuiEvent(placed.id, 'window_close', {});
  assert(runtime.getWindows().length === 0 && !runtime.hasGui(),
    'closing the last window by its cross finishes the program');
});

test('Button.click() presses the button from code, as a person would', async () => {
  const { runtime } = await runWithInspectableRuntime([
    'use console;',
    'use gui;',
    '',
    'gui.Window win;',
    'gui.Button quit;',
    'gui.Button silent;',
    '',
    'void function on_quit(gui.Button sender) {',
    '    console.writeln("нажата: ", sender.text);',
    '    win.close();',
    '}',
    '',
    'void function from_cross() {',
    '    quit.click();',
    '}',
    '',
    'main() {',
    '    quit.text = "Выход";',
    '    quit.on_click = on_quit;',
    '    win.add_child(quit);',
    '    win.add_child(silent);',
    '    win.on_close = from_cross;',
    '    win.show();',
    '    silent.click();',
    '    quit.enabled = false;',
    '    quit.click();',
    '    console.writeln("выключенная молчит");',
    '    quit.enabled = true;',
    '}',
  ].join('\n'));
  assert(runtime.getOutput() === 'выключенная молчит\n', `a button without a handler and a disabled button stay silent: ${JSON.stringify(runtime.getOutput())}`);
  // Крестик окна и кнопка «Выход» делят один обработчик — ради этого метод и просили.
  await runtime.dispatchGuiEvent(runtime.getWindows()[0].id, 'window_close', {});
  assert(runtime.getOutput() === 'выключенная молчит\nнажата: Выход\n', `click() must run on_click with the button as sender: ${JSON.stringify(runtime.getOutput())}`);
  assert(!runtime.hasGui(), 'the shared handler closed the window');
});

test('on_close asks the program before the cross closes a window', async () => {
  // Вердикт 2.5б (1.6.1): крестик — просьба. bool-обработчик отвечает,
  // void-обработчик только делает своё; close() из кода никого не спрашивает.
  const { runtime } = await runWithInspectableRuntime([
    'use console;',
    'use gui;',
    '',
    'bool saved = false;',
    'gui.Window editor;',
    'gui.Window log_window;',
    '',
    'bool function ask() {',
    '    console.writeln("ask: saved=", saved);',
    '    return saved;',
    '}',
    '',
    'void function farewell(gui.Window sender) {',
    '    console.writeln("bye: ", sender.title);',
    '}',
    '',
    'void function save() {',
    '    saved = true;',
    '}',
    '',
    'main() {',
    '    editor.title = "Редактор";',
    '    editor.on_close = ask;',
    '    log_window.title = "Журнал";',
    '    log_window.on_close = farewell;',
    '    gui.Button button;',
    '    button.on_click = save;',
    '    editor.add_child(button);',
    '    editor.show();',
    '    log_window.show();',
    '}',
  ].join('\n'));
  const idOf = (title: string) => runtime.getWindows().find((w) => w.properties.title === title)!.id;
  const buttonId = runtime.getWindows()[0].children[0].id;
  await runtime.dispatchGuiEvent(idOf('Редактор'), 'window_close', {});
  assert(runtime.getWindows().length === 2, 'a handler that returns false keeps the window open');
  await runtime.dispatchGuiEvent(buttonId, 'click', {});
  await runtime.dispatchGuiEvent(idOf('Журнал'), 'window_close', {});
  assert(runtime.getWindows().length === 1, 'a handler without a result lets the window close');
  await runtime.dispatchGuiEvent(idOf('Редактор'), 'window_close', {});
  assert(runtime.getWindows().length === 0 && !runtime.hasGui(), 'a handler that returns true closes the window');
  assert(runtime.getOutput() === 'ask: saved=false\nbye: Журнал\nask: saved=true\n', `on_close order: ${JSON.stringify(runtime.getOutput())}`);

  // close() из кода — решение самой программы: обработчик молчит, даже если он против.
  const stubborn = await runWithInspectableRuntime([
    'use console;',
    'use gui;',
    '',
    'gui.Window win;',
    '',
    'bool function never() {',
    '    console.writeln("asked");',
    '    return false;',
    '}',
    '',
    'main() {',
    '    win.on_close = never;',
    '    win.show();',
    '    win.close();',
    '}',
  ].join('\n'));
  assert(!stubborn.runtime.hasGui() && stubborn.runtime.getOutput() === '', `close() does not ask on_close: ${JSON.stringify(stubborn.runtime.getOutput())}`);

  // Форма обработчика проверяется словами, как у on_click.
  const wrong = compileIdyllium([
    'use gui;',
    '',
    'int function odd() {',
    '    return 1;',
    '}',
    '',
    'main() {',
    '    gui.Window win;',
    '    win.on_close = odd;',
    '    win.show();',
    '}',
  ].join('\n'));
  assert(wrong.diagnostics.some((d) => d.message.includes("'on_close'") && d.message.includes('bool function()')),
    `wrong on_close shape: ${JSON.stringify(wrong.diagnostics.map((d) => d.message))}`);
});

test('a canvas lives and dies with its window', async () => {
  // Канвас в окне не должен держать программу после закрытия окна: иначе
  // крестик окна с игрой оставлял превью работать вечно с нулём окон
  // (улов ломателя 2026-08-28). Standalone-канвас — сам себе экран и живёт.
  const { runtime } = await runWithInspectableRuntime([
    'use gui;',
    '',
    'main() {',
    '    gui.Window win;',
    '    gui.Canvas paper;',
    '    win.add_child(paper);',
    '    win.show();',
    '}',
  ].join('\n'));
  assert(runtime.hasGui(), 'a shown window with a canvas keeps the program alive');
  await runtime.dispatchGuiEvent(runtime.getWindows()[0].id, 'window_close', {});
  assert(!runtime.hasGui(), 'a canvas inside a closed window must not keep the program alive');

  const standalone = await runWithInspectableRuntime([
    'use gui;',
    '',
    'main() {',
    '    gui.Canvas paper;',
    '    paper.width = 100;',
    '}',
  ].join('\n'));
  assert(standalone.runtime.hasGui(), 'a standalone canvas is its own screen and keeps the program alive');
});

test('disabled and hidden containers block events for their children', async () => {
  const { runtime } = await runWithInspectableRuntime([
    'use console;',
    'use gui;',
    '',
    'main() {',
    '    gui.Window win;',
    '',
    '    gui.Frame off_box;',
    '    off_box.enabled = false;',
    '    gui.Button in_off;',
    '    in_off.text = "в выключенной рамке";',
    '    in_off.on_click = void function() { console.writeln("клик в выключенной"); };',
    '    off_box.add_child(in_off);',
    '',
    '    gui.Frame ghost_box;',
    '    ghost_box.visible = false;',
    '    gui.Button in_ghost;',
    '    in_ghost.text = "в скрытой рамке";',
    '    in_ghost.on_click = void function() { console.writeln("клик в скрытой"); };',
    '    ghost_box.add_child(in_ghost);',
    '',
    '    gui.Button alive;',
    '    alive.text = "живая";',
    '    alive.on_click = void function() { console.writeln("клик в живую"); };',
    '',
    '    win.add_child(off_box);',
    '    win.add_child(ghost_box);',
    '    win.add_child(alive);',
    '    win.show();',
    '}',
  ].join('\n'));

  const win = runtime.getWindows()[0];
  const inOff = win.children[0].children[0];
  const inGhost = win.children[1].children[0];
  const alive = win.children[2];

  await runtime.dispatchGuiEvent(inOff.id, 'click', {});
  await runtime.dispatchGuiEvent(inGhost.id, 'click', {});
  await runtime.dispatchGuiEvent(alive.id, 'click', {});

  // Учебник и справочник обещают: выключенный/скрытый контейнер глушит
  // события всего содержимого; живой виджет работает как обычно.
  assert(
    runtime.getOutput() === 'клик в живую\n',
    `unexpected output: ${JSON.stringify(runtime.getOutput())}`,
  );
});

test('orientation and placeholder_color are wired through runtime and snapshot', async () => {
  const { runtime } = await runWithInspectableRuntime([
    'use colors;',
    'use console;',
    'use gui;',
    '',
    'main() {',
    '    gui.Window win;',
    '',
    '    gui.Slider s;',
    '    console.writeln(s.orientation);',
    '    s.orientation = "vertical";',
    '',
    '    gui.ProgressBar p;',
    '    p.orientation = "vertical";',
    '',
    '    gui.LineEdit named;',
    '    named.placeholder = "Имя";',
    '    named.placeholder_color = colors.RED;',
    '',
    '    gui.LineEdit plain;',
    '',
    '    win.add_child(s);',
    '    win.add_child(p);',
    '    win.add_child(named);',
    '    win.add_child(plain);',
    '    win.show();',
    '}',
  ].join('\n'));

  assert(runtime.getOutput() === 'horizontal\n', `expected default horizontal, got ${JSON.stringify(runtime.getOutput())}`);

  const [slider, bar, named, plain] = runtime.getWindows()[0].children as any[];
  assert(slider.properties.orientation === 'vertical', 'slider orientation must reach the snapshot');
  assert(bar.properties.orientation === 'vertical', 'progressbar orientation must reach the snapshot');
  // Правило тем: в inline уходит только явно заданный цвет подсказки.
  assert(
    (named.properties.__explicit_properties ?? []).includes('placeholder_color'),
    'explicit placeholder_color must be marked in the snapshot',
  );
  assert(
    !(plain.properties.__explicit_properties ?? []).includes('placeholder_color'),
    'untouched placeholder_color must stay non-explicit (theme owns it)',
  );
});

test('turtle graphics: display list, math coordinates, fills and guards', async () => {
  const runTurtle = async (source: string, platform = 'web', fileSystem?: ReturnType<typeof createMemoryRuntimeFileSystem>) => {
    const compilation = compileIdyllium(source, { file: '/workspace/main.idyl' });
    assert(compilation.success, compilation.diagnosticsText);
    const runtime = createRuntime({ platform: platform as 'web' | 'cli', fileSystem });
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const program = await (new AsyncFunction(compilation.jsCode!))();
    await program(runtime);
    return runtime;
  };
  const drawsOf = (runtime: ReturnType<typeof createRuntime>) => {
    const canvas = runtime.getWindows()[0]?.children?.[0]?.canvas;
    assert(canvas !== undefined, 'expected turtle field canvas');
    return canvas!.commands.filter((command) => command.kind === 'draw');
  };

  // Квадрат: окно поля, 4 линии, замыкание в центре, ось Y вверх.
  const square = await runTurtle(`
use turtle;

main() {
    turtle.Turtle t;
    t.speed = 0;
    int i = 0;
    while (i < 4) {
        t.forward(100);
        t.left(90);
        i += 1;
    }
}
`);
  const windows = square.getWindows();
  assert(windows.length === 1 && windows[0].properties.title === 'Черепашье поле', 'turtle field window must auto-create');
  const draws = drawsOf(square);
  const lines = draws.filter((command) => command.object?.type === 'drawable.Line');
  assert(lines.length === 4, `expected 4 square lines, got ${lines.length}`);
  const first = lines[0].object!.properties as Record<string, number>;
  assert(first.x1 === 300 && first.y1 === 300, 'turtle must start at field center');
  assert(first.x2 === 400 && first.y2 === 300, 'first leg must go screen-right (east)');
  const last = lines[3].object!.properties as Record<string, number>;
  assert(Math.abs(last.x2 - 300) < 0.001 && Math.abs(last.y2 - 300) < 0.001, 'square must close at start');
  assert(draws.some((command) => command.object?.type === 'turtle.Path'), 'turtle sprite must be drawn');
  // Фон поля — белая ЗАЛИВКА. В 1.6.1–1.6.2 поле стало чёрным: фон красился командой clear
  // с цветом, а clear с 1.6.1 цвет команды не читает (возвращает холст к его background_color).
  const fieldCommands = square.getWindows()[0].children[0].canvas!.commands;
  assert(fieldCommands[0].kind === 'fill' && fieldCommands[0].color === '#ffffff',
    `the turtle field must be painted white by a fill: ${JSON.stringify(fieldCommands[0])}`);
  assert(!fieldCommands.some((command) => command.kind === 'clear'), 'the turtle field must not rely on clear() for its colour');
  const painted = await runTurtle(`
use colors;
use turtle;

main() {
    turtle.bg_color(colors.RGB(10, 20, 30));
    turtle.Turtle t;
    t.speed = 0;
    t.forward(10);
}
`);
  const paintedFirst = painted.getWindows()[0].children[0].canvas!.commands[0];
  assert(paintedFirst.kind === 'fill' && paintedFirst.color === '#0a141e', `turtle.bg_color() must reach the field: ${JSON.stringify(paintedFirst)}`);

  // Поднятое перо не оставляет линий; dot и write попадают в список.
  const penUp = await runTurtle(`
use turtle;

main() {
    turtle.Turtle t;
    t.speed = 0;
    t.pen_up();
    t.forward(50);
    t.dot(10);
    t.write("тут");
}
`);
  const penUpDraws = drawsOf(penUp);
  assert(!penUpDraws.some((command) => command.object?.type === 'drawable.Line'), 'pen_up must not draw lines');
  assert(penUpDraws.some((command) => command.object?.type === 'drawable.Circle'), 'dot must draw a circle');
  assert(penUpDraws.some((command) => command.object?.type === 'drawable.Text'), 'write must draw text');

  // Заливка ложится под контур и красится fill_color.
  const filled = await runTurtle(`
use turtle;
use colors;

main() {
    turtle.Turtle t;
    t.speed = 0;
    t.fill_color = colors.RED;
    t.begin_fill();
    t.forward(100);
    t.left(120);
    t.forward(100);
    t.left(120);
    t.forward(100);
    t.end_fill();
}
`);
  const filledDraws = drawsOf(filled);
  const polyIndex = filledDraws.findIndex((command) => (
    command.object?.type === 'turtle.Path' && ((command.object.properties as { points?: number[] }).points ?? []).length === 8
  ));
  const lineIndex = filledDraws.findIndex((command) => command.object?.type === 'drawable.Line');
  assert(polyIndex !== -1, 'end_fill must produce a polygon');
  assert(polyIndex < lineIndex, 'fill polygon must lie under its outline');
  assert((filledDraws[polyIndex].object!.properties as { fill_color?: string }).fill_color === '#ff0000', 'fill must use fill_color');

  // Сторожа рантайма.
  for (const [snippet, expected] of [
    ['t.speed = 99;', 'Turtle.speed must be between 0 and 10, got 99'],
    ['t.end_fill();', 'end_fill() without begin_fill()'],
    ['t.pen_width = 0;', 'Turtle.pen_width must be between 1 and 100, got 0'],
  ] as const) {
    let message = '';
    try {
      await runTurtle(`\nuse turtle;\n\nmain() {\n    turtle.Turtle t;\n    ${snippet}\n}\n`);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert(message.includes(expected), `expected guard '${expected}', got '${message}'`);
  }

  // CLI: поле headless (окон нет, hasGui false), save_svg пишет честный SVG.
  const memoryFs = createMemoryRuntimeFileSystem({});
  const headless = await runTurtle(`
use turtle;

main() {
    turtle.Turtle t;
    int i = 0;
    while (i < 4) {
        t.forward(100);
        t.left(90);
        i += 1;
    }
    turtle.save_svg("узор.svg");
}
`, 'cli', memoryFs);
  assert(headless.getWindows().length === 0, 'cli turtle must be headless');
  assert(headless.hasGui() === false, 'cli turtle must not report gui');
  const written = memoryFs.writtenFilesSnapshot?.() ?? {};
  const svgEntry = Object.entries(written).find(([path]) => path.endsWith('узор.svg'));
  assert(svgEntry !== undefined, 'save_svg must write the file');
  const svg = String(svgEntry![1].content);
  assert((svg.match(/<line /g) ?? []).length === 4, 'svg must contain 4 lines');
  assert(svg.includes('width="600"') && svg.includes('<rect'), 'svg must carry field size and background');

  // set_heading — абсолютный угол независимо от прежних поворотов.
  const compass = await runTurtle(`
use turtle;
use console;

main() {
    turtle.Turtle t;
    t.speed = 0;
    t.left(37);
    t.right(240);
    t.set_heading(90);
    console.writeln("heading = ", t.heading);
    t.forward(80);
    console.writeln("x = ", t.x, ", y = ", t.y);
    t.set_heading(90);
    console.writeln("still = ", t.heading);
}
`);
  assert(
    compass.getOutput() === 'heading = 90\nx = 0, y = 80\nstill = 90\n',
    `set_heading must set an absolute angle, got ${JSON.stringify(compass.getOutput())}`,
  );

  // Анимация не дробит след: forward со скоростью по умолчанию — одна линия.
  const animated = await runTurtle(`
use turtle;

main() {
    turtle.Turtle t;
    t.forward(60);
}
`);
  const animatedLines = drawsOf(animated).filter((command) => command.object?.type === 'drawable.Line');
  assert(animatedLines.length === 1, `animated forward must keep one line entry, got ${animatedLines.length}`);
});

test('data widgets: table rows, select event, chart guards and scales', async () => {
  const runGui = async (source: string) => {
    const compilation = compileIdyllium(source, { file: 'main.idyl' });
    assert(compilation.success, compilation.diagnosticsText);
    const runtime = createRuntime({ platform: 'web' });
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const program = await (new AsyncFunction(compilation.jsCode!))();
    await program(runtime);
    return runtime;
  };

  // Таблица: снапшот несёт колонки и строки; row_count живёт.
  const table = await runGui(`
use gui;
use console;

main() {
    gui.Window win;
    gui.Table t;
    t.set_columns("Имя", "Уровень");
    t.add_row("Мира", "12");
    t.add_row("Кай", "9");
    t.set_cell(1, 1, "10");
    console.writeln(t.row_count);
    win.add_child(t);
    win.show();
}`);
  assert(table.getOutput() === '2\n', `row_count: ${JSON.stringify(table.getOutput())}`);
  const tableSnapshot = table.getWindows()[0].children[0];
  assert(JSON.stringify(tableSnapshot.columns) === '["Имя","Уровень"]', 'table snapshot must carry columns');
  assert(JSON.stringify(tableSnapshot.rows) === '[["Мира","12"],["Кай","10"]]', 'table snapshot must carry rows with set_cell applied');

  // Событие select: selected_row обновляется, on_select зовётся.
  const selectable = await runGui(`
use gui;
use console;

gui.Table t;

main() {
    gui.Window win;
    t.set_columns("Имя");
    t.add_row("Мира");
    t.add_row("Кай");
    t.on_select = void function(gui.Table sender) {
        console.writeln("строка: ", sender.selected_row);
    };
    win.add_child(t);
    win.show();
}`);
  await selectable.dispatchGuiEvent(selectable.getWindows()[0].children[0].id, 'select', { row: 1 });
  assert(selectable.getOutput() === 'строка: 1\n', `select event: ${JSON.stringify(selectable.getOutput())}`);

  // Сторожа — дословные.
  for (const [snippet, expected] of [
    ['gui.Table t;\n    t.add_row("x");', 'Table.add_row() before set_columns()'],
    ['gui.Table t;\n    t.set_columns("а", "б");\n    t.add_row("x");', 'Table.add_row() expects 2 values (one per column), got 1'],
    ['gui.BarChart b;\n    b.set_value("Хома", 1);', "BarChart has no bar 'Хома'"],
    ['gui.PieChart p;\n    p.add_slice("х", 0 - 3);', 'PieChart slice value must be >= 0, got -3'],
    ['gui.LineChart l;\n    l.max_points = 0 - 1;', 'LineChart.max_points must be between 0 and 100000, got -1'],
  ] as const) {
    let message = '';
    try {
      await runGui(`use gui;\n\nmain() {\n    ${snippet}\n}`);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert(message.includes(expected), `expected guard '${expected}', got '${message}'`);
  }

  // Лента LineChart подрезается, автомасштаб отражается в явных свойствах.
  const charts = await runGui(`
use gui;

main() {
    gui.Window win;
    gui.LineChart line;
    line.max_points = 3;
    line.add_value(1);
    line.add_value(2);
    line.add_value(3);
    line.add_value(4);

    gui.BarChart auto_scale;
    auto_scale.add_value("х", 5);
    gui.BarChart fixed;
    fixed.max_value = 100;
    fixed.add_value("х", 5);

    win.add_child(line);
    win.add_child(auto_scale);
    win.add_child(fixed);
    win.show();
}`);
  const [lineSnapshot, autoSnapshot, fixedSnapshot] = charts.getWindows()[0].children;
  assert(JSON.stringify(lineSnapshot.points) === '[2,3,4]', `line ring buffer: ${JSON.stringify(lineSnapshot.points)}`);
  const autoExplicit = (autoSnapshot.properties.__explicit_properties ?? []) as string[];
  const fixedExplicit = (fixedSnapshot.properties.__explicit_properties ?? []) as string[];
  assert(!autoExplicit.includes('max_value'), 'auto scale must keep max_value non-explicit');
  assert(fixedExplicit.includes('max_value'), 'fixed scale must mark max_value explicit');
});

test('image.Vector: svg passport, proportional rasterization, guards', async () => {
  const TURTLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">\n'
    + '<rect width="100%" height="100%" fill="#ffffff"/>\n'
    + '<line x1="300" y1="300" x2="400" y2="300" stroke="#000000" stroke-width="2" stroke-linecap="round"/>\n'
    + '</svg>';

  const makeMockService = (withRasterize: boolean) => {
    const calls: number[][] = [];
    const service: Record<string, unknown> = {
      calls,
      decodeStatic: async () => { throw new Error('unused'); },
      encodeStatic: async (raster: { width: number; height: number }) => (
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, raster.width & 255, raster.height & 255])
      ),
      decodeAnimation: async () => { throw new Error('unused'); },
      encodeAnimation: async () => { throw new Error('unused'); },
    };
    if (withRasterize) {
      service.rasterizeSvg = async (_text: string, width: number, height: number, sourceWidth: number, sourceHeight: number) => {
        calls.push([width, height, sourceWidth, sourceHeight]);
        return { width, height, pixels: new Uint8Array(width * height * 4) };
      };
    }
    return service;
  };

  const runVector = async (source: string, service: Record<string, unknown>, files: Record<string, string>) => {
    const compilation = compileIdyllium(source, { file: '/workspace/main.idyl' });
    assert(compilation.success, compilation.diagnosticsText);
    const fileSystem = createMemoryRuntimeFileSystem(files);
    const runtime = createRuntime({
      platform: 'cli',
      imageService: service as never,
      fileSystem,
    });
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const program = await (new AsyncFunction(compilation.jsCode!))();
    await program(runtime);
    return { runtime, fileSystem };
  };

  // Паспорт из viewBox, пропорции при опущенной высоте, contain, PNG-цепочка.
  const service = makeMockService(true);
  const { runtime, fileSystem } = await runVector(`
use image;
use console;

main() {
    image.Vector v;
    v.load_from_file("узор.svg");
    console.writeln(v.width, "x", v.height, " loaded=", v.is_loaded);
    image.Static a = v.to_static(64);
    image.Static b = v.to_static(300, 100);
    b.export_to_file("узор.png");
}`, service, { '/workspace/узор.svg': TURTLE_SVG });
  assert(runtime.getOutput() === '600x600 loaded=true\n', `vector passport: ${JSON.stringify(runtime.getOutput())}`);
  const calls = service.calls as number[][];
  assert(JSON.stringify(calls[0]) === '[64,64,600,600]', `proportional height: ${JSON.stringify(calls[0])}`);
  assert(JSON.stringify(calls[1]) === '[300,100,600,600]', `explicit size: ${JSON.stringify(calls[1])}`);
  const written = fileSystem.writtenFilesSnapshot?.() ?? {};
  assert(Object.keys(written).some((path) => path.endsWith('узор.png')), 'to_static().export_to_file() must write a PNG');

  // Сторожа — дословные.
  for (const [source, files, withRasterize, expected] of [
    ['use image;\n\nmain() {\n    image.Vector v;\n    v.load_from_file("нет.svg");\n}', {}, true,
      "Vector.load_from_file() cannot load 'нет.svg': file does not exist"],
    ['use image;\n\nmain() {\n    image.Vector v;\n    v.load_from_file("т.svg");\n}', { '/workspace/т.svg': 'просто текст' }, true,
      "cannot decode 'т.svg': not an SVG document (expected <svg...>)"],
    ['use image;\n\nmain() {\n    image.Vector v;\n    v.load_from_file("у.svg");\n    v.to_static(9000);\n}', { '/workspace/у.svg': TURTLE_SVG }, true,
      'Vector.to_static() size must be between 1 and 4096, got 9000'],
    ['use image;\n\nmain() {\n    image.Vector v;\n    v.to_static(64);\n}', {}, true,
      'Vector.to_static() before load_from_file()'],
    ['use image;\n\nmain() {\n    image.Vector v;\n    v.load_from_file("у.svg");\n    v.to_static(64);\n}', { '/workspace/у.svg': TURTLE_SVG }, false,
      'Vector.to_static() is not available in the console host'],
  ] as const) {
    let message = '';
    try {
      await runVector(source, makeMockService(withRasterize), files as Record<string, string>);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert(message.includes(expected), `expected vector guard '${expected}', got '${message}'`);
  }
});

test('canvas snapshots: save_svg everywhere, to_static needs a renderer host', async () => {
  const fsMemory = createMemoryRuntimeFileSystem();
  const result = await runIdyllium(`
use console;
use gui;
use drawable;
use colors;

main() {
    gui.Window win;
    gui.Canvas canvas;
    canvas.width = 300;
    canvas.height = 200;
    win.add_child(canvas);
    win.show();

    canvas.fill(colors.RGB(20, 30, 60));

    drawable.Rectangle box;
    box.x = 40;
    box.y = 50;
    box.width = 100;
    box.height = 60;
    box.fill_color = colors.RGB(255, 165, 0);
    canvas.draw(box);

    drawable.Text label;
    label.x = 40;
    label.y = 130;
    label.text = "Снимок";
    canvas.draw(label);

    canvas.save_svg("shot.svg");
    canvas.save_svg("region.svg", 150, 0, 150, 100);

    gui.Canvas paper;
    paper.width = 120;
    paper.height = 80;
    paper.background_color = colors.RGB(16, 32, 48);
    paper.fill(colors.RED);
    paper.clear();
    paper.save_svg("paper.svg");
    console.writeln("сохранено");
}
`, { platform: 'cli', fileSystem: fsMemory }, { file: '/workspace/main.idyl' });
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const files = fsMemory.snapshot?.() ?? {};
  const shot = String(files['/workspace/shot.svg']?.content ?? '');
  assert(shot.includes('viewBox="0 0 300 200"'), 'full canvas viewBox');
  assert(shot.includes('fill="#141e3c"'), 'fill command color');
  // Файл обязан совпадать с экраном: основа — background_color холста, clear() возвращает к ней же.
  const paper = String(files['/workspace/paper.svg']?.content ?? '');
  assert(paper.includes('fill="#102030"') && !paper.includes('fill="#000000"') && !paper.includes('fill="#ff0000"'),
    `save_svg must use the canvas background_color as the base and for clear(): ${paper.slice(0, 400)}`);
  assert(shot.includes('width="100" height="60" fill="#ffa500"'), 'rectangle');
  assert(shot.includes('>Снимок</text>'), 'text content');
  const region = String(files['/workspace/region.svg']?.content ?? '');
  assert(region.includes('viewBox="150 0 150 100"'), 'region crop via viewBox');

  const refusal = await runIdyllium(`
use gui;
use image;

main() {
    gui.Window win;
    gui.Canvas canvas;
    win.add_child(canvas);
    win.show();
    image.Static shot = canvas.to_static();
}
`, { platform: 'cli', fileSystem: createMemoryRuntimeFileSystem() }, { file: '/workspace/main.idyl' });
  assert(
    (refusal.runtimeError ?? '').includes('Canvas.to_static() is not available in the console host — use Canvas.save_svg()'),
    `to_static refusal: ${refusal.runtimeError}`,
  );

  const empty = await runIdyllium(`
use gui;

main() {
    gui.Window win;
    gui.Canvas canvas;
    canvas.width = 100;
    canvas.height = 100;
    win.add_child(canvas);
    win.show();
    canvas.save_svg("x.svg", 200, 0, 50, 50);
}
`, { platform: 'cli', fileSystem: createMemoryRuntimeFileSystem() }, { file: '/workspace/main.idyl' });
  assert(
    (empty.runtimeError ?? '').includes('Canvas.save_svg() region is empty (canvas is 100x100'),
    `empty region: ${empty.runtimeError}`,
  );
});

test('widget hint reaches the gui snapshot', async () => {
  const result = await runWithInspectableRuntime([
    'use gui;',
    '',
    'main() {',
    '    gui.Window win;',
    '    gui.Button switcher;',
    '    switcher.text = "🌙";',
    '    switcher.hint = "Тёмная тема";',
    '    win.add_child(switcher);',
    '    win.show();',
    '}',
  ].join('\n'));
  const button = result.runtime.getWindows()[0].children.find((child: { type: string }) => child.type === 'gui.Button') as
    { properties: Record<string, unknown> } | undefined;
  assert(button !== undefined, 'button missing from snapshot');
  assert(button.properties.hint === 'Тёмная тема', `hint in snapshot: ${JSON.stringify(button.properties.hint)}`);
});

test('radio group: programmatic is_selected deselects the neighbours', async () => {
  // Находка методистов (2026-08-21): клик снимал соседей, программная
  // запись — нет. Урок обещает «одна группа по умолчанию» — держим слово.
  const result = await runIdyllium(`use console;
use gui;
use system;

main() {
    gui.Window w;
    gui.RadioButton a;
    gui.RadioButton b;
    gui.RadioButton c;
    c.group = "other";
    w.add_child(a);
    w.add_child(b);
    w.add_child(c);
    a.is_selected = true;
    c.is_selected = true;
    b.is_selected = true;
    console.writeln(a.is_selected, " ", b.is_selected, " ", c.is_selected);
    b.is_selected = false;
    console.writeln(a.is_selected, " ", b.is_selected, " ", c.is_selected);
    system.exit(0);
}
`, {}, { file: 'main.idyl' });
  assert(
    result.output.startsWith('false true true\nfalse false true'),
    `radio group deselect is off: ${JSON.stringify(result.output)}`,
  );
});

// E17 (методисты, ООП-волна 2026-08-22): контрактный equals у потомка —
// компилятор отказывает сам, жанром '==', а не рантайм «has no method».

test('composed custom widget updates via a method used as callback', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    class LabeledSlider {
      gui.Slider slider;
      gui.Label readout;

      void function refresh() {
        this.readout.text = to_string(this.slider.value) + " / " + to_string(this.slider.max);
      }
    }

    LabeledSlider volume;

    main() {
      gui.Window win;
      volume.slider.max = 20;
      volume.slider.on_change = volume.refresh;
      volume.refresh();
      win.add_child(volume.slider);
      win.add_child(volume.readout);
      win.show();
    }
  `);
  const widget = (type: string) => result.runtime.getWindows()[0].children.find((item) => item.type === type);
  assert(widget('gui.Label')?.properties.text === '0 / 20', `initial readout: ${JSON.stringify(widget('gui.Label')?.properties)}`);
  await result.runtime.dispatchGuiEvent(widget('gui.Slider')!.id, 'change', { value: 7 });
  assert(widget('gui.Label')?.properties.text === '7 / 20', `readout after change: ${JSON.stringify(widget('gui.Label')?.properties)}`);
});

// Полная поддержка extends (вердикт владельца, 2026-08-22, spec/some_widget_heirs):
// наследник виджета — настоящая кнопка (__idylliumType базы, рендер невредим),
// но со своими полями/методами и своим именем в type_name (__idylliumClass).

test('widget heir keeps parent mechanics and carries its own state', async () => {
  // type_name говорит именем наследника, а не рантайм-типом базы.
  const named = await runIdyllium(`use gui;
use console;
class CounterButton extends gui.Button { int clicks = 0; }
main() {
    CounterButton counter;
    console.writeln(type_name(counter));
}
`, {}, { file: 'main.idyl' });
  assert(named.output === 'CounterButton\n', `type_name must say the heir class: ${JSON.stringify(named.output)} ${named.runtimeError ?? named.compilation.diagnosticsText}`);

  const result = await runWithInspectableRuntime(`
    use gui;

    class CounterButton extends gui.Button {
      int clicks = 0;

      void function press() {
        this.clicks = this.clicks + 1;
        this.text = "Нажато: " + to_string(this.clicks);
      }
    }

    CounterButton counter;

    main() {
      gui.Window win;
      counter.text = "Нажми меня";
      counter.on_click = counter.press;
      win.add_child(counter);
      win.show();
    }
  `);
  const button = result.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Button');
  assert(button?.properties.text === 'Нажми меня', `heir renders as a plain button: ${JSON.stringify(button?.properties)}`);
  await result.runtime.dispatchGuiEvent(button!.id, 'click', {});
  await result.runtime.dispatchGuiEvent(button!.id, 'click', {});
  const after = result.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Button');
  assert(after?.properties.text === 'Нажато: 2', `heir state must survive clicks: ${JSON.stringify(after?.properties)}`);
});

// Составной виджет-наследник рамки: конструктор с аргументами, this.add_child,
// метод класса колбэком — коробка И ЕСТЬ виджет, одна строка монтажа.

test('frame heir builds a compound widget in its constructor', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    class LabeledSlider extends gui.Frame {
      gui.Slider slider;
      gui.Label readout;

      constructor LabeledSlider(string box_title, int max_value) {
        this.title = box_title;
        this.slider.max = max_value;
        this.slider.on_change = this.refresh;
        this.add_child(this.slider);
        this.add_child(this.readout);
        this.refresh();
      }

      void function refresh() {
        this.readout.text = to_string(this.slider.value) + " / " + to_string(this.slider.max);
      }
    }

    main() {
      gui.Window win;
      LabeledSlider volume("Громкость", 20);
      win.add_child(volume);
      win.show();
    }
  `);
  const frame = () => result.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Frame');
  assert(frame()?.properties.title === 'Громкость', `frame heir must own frame properties: ${JSON.stringify(frame()?.properties)}`);
  const inside = (type: string) => frame()?.children?.find((item: { type: string }) => item.type === type);
  assert(inside('gui.Label')?.properties.text === '0 / 20', `initial readout: ${JSON.stringify(inside('gui.Label')?.properties)}`);
  await result.runtime.dispatchGuiEvent(inside('gui.Slider')!.id, 'change', { value: 7 });
  assert(inside('gui.Label')?.properties.text === '7 / 20', `readout after change: ${JSON.stringify(inside('gui.Label')?.properties)}`);
});

// Вторая половина дыры: базовый класс из ПОЛЬЗОВАТЕЛЬСКОГО модуля.

test('module class heir inherits fields, methods and parent()', async () => {
  const zooSource = `class Lion {
    string name = "лев";
    int roars = 0;

    constructor Lion(string ex_name) {
        this.name = ex_name;
    }

    string function roar() {
        this.roars = this.roars + 1;
        return this.name + ": Р-Р-Р №" + to_string(this.roars);
    }
}
`;
  const result = await runIdyllium(`use console;
use zoo;

class Cub extends zoo.Lion {
    bool sleepy = true;

    constructor Cub(string ex_name) {
        parent(ex_name);
        this.sleepy = false;
    }

    string function play() {
        return this.name + " играет";
    }
}

main() {
    Cub simba("Симба");
    console.writeln(simba.roar());
    console.writeln(simba.play());
    console.writeln(simba.sleepy, " ", type_name(simba));
}
`, {}, { file: 'main.idyl', sources: { 'zoo.idyl': zooSource } });
  assert(
    result.output === 'Симба: Р-Р-Р №1\nСимба играет\nfalse Cub\n',
    `module heir happy path: ${JSON.stringify(result.output)} ${result.runtimeError ?? result.compilation.diagnosticsText}`,
  );

  // Статики базы через потомка не ходят — как и у локальных классов.
  const statics = await runIdyllium(`use console;
use zoo2;
class Cub extends zoo2.Lion { int age = 1; }
main() {
    console.writeln(Cub.population);
}
`, {}, { file: 'main.idyl', sources: { 'zoo2.idyl': 'class Lion {\n    static int population = 0;\n    string name = "лев";\n}\n' } });
  assert(
    statics.compilation.diagnosticsText.includes("static field 'zoo2.Lion.population' is not inherited — write 'zoo2.Lion.population'"),
    `base statics must not travel to the heir: ${statics.compilation.diagnosticsText}`,
  );
});

// Периметр extends: белый список виджетов, читаемые отказы, никаких каскадов.

test('a widget cannot be put inside itself through any door', async () => {
  await assertRuntimeFails(`use gui;
main() {
    gui.Window win;
    gui.TabWidget tabs;
    tabs.add_tab("сама себе", tabs);
    win.add_child(tabs);
    win.show();
}
`, 'TabWidget.add_tab() cannot put a widget inside itself');
});

// Заготовка объекта-ответа обязана быть ПОЛНОЙ формой своего типа: раньше
// свойства у неё были, а метод падал «object has no method» (находка
// методистов 2026-08-23).

test('the grown IdySS dictionary accepts the new properties', async () => {
  for (const [probe, value] of [
    ['text-decoration: line-through', 'line-through'],
    ['text-transform: uppercase', 'uppercase'],
    ['letter-spacing: -2', '-2px'],
    ['letter-spacing: 4px', '4px'],
    ['line-height: 1.5', '1.5'],
    ['cursor: pointer', 'pointer'],
    ['border-bottom-width: 3px', '3px'],
    ['border-left-color: red', '#FF0000'],
    ['padding-left: 12', '12px'],
    ['outline-style: dashed', 'dashed'],
    ['transition-duration: 250ms', '250ms'],
    ['transition-duration: 0.4s', '0.4s'],
    ['rotate: -15', '-15deg'],
    ['scale: 1.2', '1.2'],
    ['box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)', '0px 4px 12px rgba(0, 0, 0, 0.3)'],
    ['text-shadow: 1px 1px 2px black', '1px 1px 2px #000000'],
  ] as ReadonlyArray<readonly [string, string]>) {
    const parsed = parseIdylliumStyle(probe);
    assert(parsed.length === 1, `«${probe}» must be accepted: ${JSON.stringify(parsed)}`);
    assert(parsed[0].value === value, `«${probe}» → ${JSON.stringify(parsed[0])}, expected ${value}`);
  }

  // font-family отдаёт готовый стек: произвольных имён шрифтов в CSS не уезжает.
  const mono = parseIdylliumStyle('font-family: mono');
  assert(mono.length === 1 && mono[0].value.includes('monospace'), `font-family: ${JSON.stringify(mono)}`);
  assert(parseIdylliumStyle('font-family: Comic Sans').length === 0, 'arbitrary font names must be ignored');

  // Границы значений и форма тени — молча отбрасываются, как весь IdySS.
  for (const probe of [
    'letter-spacing: 40',            // вне −5…20
    'line-height: 5',                // вне 0.8…3
    'scale: 9',                      // вне 0.1…5
    'rotate: 900',                   // вне −360…360
    'transition-duration: 10s',      // дольше двух секунд
    'cursor: zoom-in',               // не из списка курса
    'box-shadow: 0 4px 12px',        // три части вместо четырёх
    'box-shadow: 0 4px 12px red extra', // пять частей
    'box-shadow: 0 4px 999px red',   // размытие вне диапазона
    'box-shadow: inset 0 4px 12px red', // inset за бортом
  ]) {
    assert(parseIdylliumStyle(probe).length === 0, `«${probe}» must be ignored, got ${JSON.stringify(parseIdylliumStyle(probe))}`);
  }
});

// style_disabled: состояние, которое в языке было (enabled = false), а оформить
// его было нечем. Псевдокласса у нашего бокса нет — пары едут в снимок, и
// рендерер ставит их поверх обычной наклейки.

test('style_disabled travels to the snapshot of a disabled widget', async () => {
  const result = await runWithInspectableRuntime(`
    use gui;

    main() {
      gui.Window win;
      gui.Button off;
      off.text = "Недоступно";
      off.enabled = false;
      off.style = "background-color: #2673D9";
      off.style_disabled = "background-color: #DDDDDD; cursor: not-allowed";
      win.add_child(off);
      win.show();
    }
  `);
  const button = result.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Button');
  assert(button?.properties.enabled === false, `the widget must be disabled: ${JSON.stringify(button?.properties.enabled)}`);
  const disabled = button?.properties.style_disabled_declarations as ReadonlyArray<{ property: string; value: string }> | undefined;
  assert(Array.isArray(disabled) && disabled.length === 2, `disabled declarations: ${JSON.stringify(disabled)}`);
  assert(disabled[0].value === '#dddddd' && disabled[1].value === 'not-allowed', `disabled declarations: ${JSON.stringify(disabled)}`);
});

// IdySS молчит о незнакомых свойствах — но молчание не значит «пропустить».
// Имена из Object.prototype доставали из словаря свойств и из палитры цветов
// функции: 'constructor: red' протаскивал выдуманное объявление, а
// 'color: constructor' — объявление, у которого значение вообще не строка.

test('the IdySS dictionary and palette ignore prototype names', async () => {
  for (const probe of [
    'constructor: red',
    'toString: 5',
    '__proto__: x',
    'color: constructor',
    'background-color: toString',
    'border-color: valueOf',
  ]) {
    assert(
      parseIdylliumStyle(probe).length === 0,
      `IdySS must ignore «${probe}», got ${JSON.stringify(parseIdylliumStyle(probe))}`,
    );
  }

  // Законные пары целы, и значение всегда строка.
  for (const [probe, property, value] of [
    ['color: red', 'color', '#FF0000'],
    ['color: dark-blue', 'color', '#000080'],
    ['border-radius: 8px', 'border-radius', '8px'],
    ['user-select: none', 'user-select', 'none'],
  ] as ReadonlyArray<readonly [string, string, string]>) {
    const parsed = parseIdylliumStyle(probe);
    assert(parsed.length === 1, `«${probe}» must produce one declaration: ${JSON.stringify(parsed)}`);
    assert(parsed[0].property === property && parsed[0].value === value, `«${probe}» → ${JSON.stringify(parsed)}`);
    assert(typeof parsed[0].value === 'string', `a declaration value must be a string: ${JSON.stringify(parsed)}`);
  }
});

// D4 (методисты, 2026-08-23): три правила, которые не были записаны, но на
// которых стоит весь курс ООП. Смоук держит их, чтобы справочник не разъехался
// с языком.

test('window snapshot survives cycles between widget heirs', async () => {
  const mutual = await runWithInspectableRuntime(`
    use gui;

    class Key extends gui.Button {
      gui.Frame owner;
    }

    class Pad extends gui.Frame {
      Key key;

      constructor Pad() {
        this.title = "Пульт";
        this.key.text = "жми";
        this.key.owner = this;
        this.add_child(this.key);
      }
    }

    main() {
      gui.Window win;
      Pad pad();
      win.add_child(pad);
      win.show();
    }
  `);
  const frame = mutual.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Frame');
  assert(frame?.properties.title === 'Пульт', `cyclic heirs must still snapshot: ${JSON.stringify(frame?.properties)}`);
  assert(
    JSON.stringify(mutual.runtime.getWindows()).length > 0,
    'a window snapshot with cycles must be serializable',
  );

  // Виджет внутрь самого себя — честная idyllium-ошибка, а не RangeError.
  await assertRuntimeFails(`use gui;
class Panel extends gui.Frame {
    gui.Label caption;

    constructor Panel(string t) {
        this.title = t;
        this.add_child(this);
    }
}
main() {
    gui.Window win;
    Panel p("Настройки");
    win.add_child(p);
    win.show();
}
`, 'add_child() cannot put a widget inside itself');
});

// Имена из прототипа Object (toString, valueOf, hasOwnProperty) — обычные
// идентификаторы: раньше лексер выдавал их за «ключевые слова», и метод
// toString() ронял парсер в каскад с JS-нутром '[native code]'.

test('widget identity survives an inheritance chain', async () => {
  const chain = await runWithInspectableRuntime(`
    use gui;

    class Fancy extends gui.Button {
      int level = 1;
    }

    class SuperFancy extends Fancy {
      string mood = "весёлый";

      void function press() {
        this.level = this.level + 1;
        this.text = "уровень " + to_string(this.level) + ", " + this.mood;
      }
    }

    main() {
      gui.Window win;
      SuperFancy b;
      b.text = "внук кнопки";
      b.on_click = b.press;
      win.add_child(b);
      win.show();
    }
  `);
  const button = () => chain.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Button');
  assert(button() !== undefined, 'a grandchild of gui.Button must still render as a button');
  await chain.runtime.dispatchGuiEvent(button()!.id, 'click', {});
  assert(button()?.properties.text === 'уровень 2, весёлый', `chain heir state: ${JSON.stringify(button()?.properties)}`);

  // type_name говорит именем САМОГО класса, а не среднего звена.
  const named = await runIdyllium(`use gui;
use console;
class Fancy extends gui.Button { int level = 1; }
class SuperFancy extends Fancy { string mood = "весёлый"; }
main() {
    SuperFancy b;
    console.writeln(type_name(b));
}
`, {}, { file: 'main.idyl' });
  assert(named.output === 'SuperFancy\n', `chain type_name: ${JSON.stringify(named.output)} ${named.runtimeError ?? named.compilation.diagnosticsText}`);

  // Радиогруппа: внуки RadioButton остаются эксклюзивными.
  const radio = await runIdyllium(`use gui;
use console;
use system;
class MyRadio extends gui.RadioButton { int votes = 0; }
class SuperRadio extends MyRadio { string tag = "внук"; }
main() {
    gui.Window win;
    SuperRadio a;
    SuperRadio b;
    gui.RadioButton c;
    win.add_child(a);
    win.add_child(b);
    win.add_child(c);
    a.is_selected = true;
    b.is_selected = true;
    console.writeln(a.is_selected, " ", b.is_selected, " ", c.is_selected);
    c.is_selected = true;
    console.writeln(a.is_selected, " ", b.is_selected, " ", c.is_selected);
    system.exit(0);
}
`, {}, { file: 'main.idyl' });
  assert(radio.output.startsWith('false true false\nfalse false true'), `chain radio group: ${JSON.stringify(radio.output)}`);

  // Имя члена виджета занято на любой глубине и для событий тоже.
  assertFails(
    'use gui;\nclass A extends gui.Button { int level = 1; }\nclass B extends A { int text = 5; }\nmain() { }',
    "'text' is already a member of gui.Button — pick another name",
  );
  assertFails(
    'use gui;\nclass A extends gui.Button {\n    event on_click(int n);\n}\nmain() { }',
    "'on_click' is already a member of gui.Button — pick another name",
  );
});

// Наследство ВНУТРИ модуля видно снаружи: потомок выглядит одинаково с обеих
// сторон границы модуля — включая виджет-наследников.

test('widget string enums reject typos loudly', async () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['gui.Slider s;\n    s.orientation = "vertikal";', "Slider.orientation must be 'horizontal' or 'vertical', got 'vertikal'"],
    ['gui.ProgressBar p;\n    p.orientation = "боком";', "ProgressBar.orientation must be 'horizontal' or 'vertical', got 'боком'"],
    ['gui.ImageBox b;\n    b.resize_mode = "strech";', "ImageBox.resize_mode must be 'fit', 'fill', 'stretch' or 'original', got 'strech'"],
    ['win.theme = "неоновый";', "Window.theme must be 'default', 'idyllium', 'dracula', 'breeze' or 'oxygen', got 'неоновый'"],
  ];
  for (const [snippet, expected] of cases) {
    const result = await runIdyllium(`use gui;
main() {
    gui.Window win;
    ${snippet}
    win.show();
}
`, {}, { file: 'main.idyl' });
    assert((result.runtimeError ?? '').includes(expected), `enum typo must be loud: ${expected}, got ${result.runtimeError}`);
  }

  const legal = await runIdyllium(`use gui;
use system;
main() {
    gui.Window win;
    win.theme = "dracula";
    gui.Slider s;
    s.orientation = "vertical";
    gui.ProgressBar p;
    p.orientation = "vertical";
    gui.ImageBox b;
    b.resize_mode = "original";
    win.add_child(s);
    win.add_child(p);
    win.add_child(b);
    win.show();
    system.exit(0);
}
`, {}, { file: 'main.idyl' });
  assert(legal.success, `legal enum values must stay legal: ${legal.runtimeError}`);
});

// W18 (методисты): опечатка в echo_mode молча оставляла пароль на виду.

test('LineEdit echo_mode rejects unknown modes', async () => {
  const typo = await runIdyllium(`use gui;
main() {
    gui.Window win;
    gui.LineEdit secret;
    secret.echo_mode = "pasword";
    win.add_child(secret);
    win.show();
}
`, {}, { file: 'main.idyl' });
  assert(
    (typo.runtimeError ?? '').includes("LineEdit.echo_mode must be 'normal', 'password' or 'no_echo', got 'pasword'"),
    `echo_mode typo must be loud: ${typo.runtimeError}`,
  );
});

// Канон 2026-08-22: int точен на любом размере — включая разбор строки.

test('radio preselect in two frames survives (groups resolve at add_child)', async () => {
  // E15 (методисты, 2026-08-22): канон «создал → настроил → add_child»
  // схлопывал предвыборы двух рамок в одну «бездомную» группу — жил только
  // последний. Теперь бездомное радио никого не гасит, группа решается
  // при переезде в коробку (последний добавленный выигрывает).
  const result = await runIdyllium(`use console;
use gui;
use system;

main() {
    gui.Window w;
    gui.Frame drinks;
    gui.Frame snacks;

    gui.RadioButton tea;    tea.is_selected = true;
    gui.RadioButton mors;
    gui.RadioButton sweet;  sweet.is_selected = true;
    gui.RadioButton salty;

    drinks.add_child(tea);
    drinks.add_child(mors);
    snacks.add_child(sweet);
    snacks.add_child(salty);
    w.add_child(drinks);
    w.add_child(snacks);
    console.writeln(tea.is_selected, " ", mors.is_selected, " ", sweet.is_selected, " ", salty.is_selected);

    gui.RadioButton late;
    late.is_selected = true;
    drinks.add_child(late);
    console.writeln(tea.is_selected, " ", late.is_selected, " ", sweet.is_selected);
    system.exit(0);
}
`, {}, { file: 'main.idyl' });
  assert(
    result.output.startsWith('true false true false\nfalse true true'),
    `radio preselect across frames is off: ${JSON.stringify(result.output)}`,
  );
});

test('empty TabWidget answers selected_index -1 like an empty ComboBox', async () => {
  // E16 (методисты, 2026-08-22): у пустого шкафа не бывает тайной «нулевой»
  // вкладки — канон «-1 = ничего не выбрано» един с ComboBox (книга №16).
  const result = await runIdyllium(`use console;
use gui;
use system;

main() {
    gui.TabWidget tabs;
    console.writeln(tabs.selected_index, " ", tabs.tab_count, " [", tabs.selected_title, "]");
    gui.Label page;
    tabs.add_tab("Первая", page);
    console.writeln(tabs.selected_index, " ", tabs.tab_count, " [", tabs.selected_title, "]");
    tabs.clear_tabs();
    console.writeln(tabs.selected_index, " ", tabs.tab_count, " [", tabs.selected_title, "]");
    system.exit(0);
}
`, {}, { file: 'main.idyl' });
  assert(
    result.output.startsWith('-1 0 []\n0 1 [Первая]\n-1 0 []'),
    `empty TabWidget canon is off: ${JSON.stringify(result.output)}`,
  );
});

test('user-select joins the IdySS dictionary', async () => {
  // Вердикт владельца 2026-08-22: значения из CSS; кнопочным виджетам
  // рендерер выключает выделение по умолчанию (CSS рендерера).
  const { parseIdylliumStyle } = await import('../src/runtime/style.js');
  const ok = parseIdylliumStyle('user-select: none');
  assert(ok.length === 1 && ok[0].property === 'user-select' && ok[0].value === 'none',
    `user-select: none was not parsed: ${JSON.stringify(ok)}`);
  const all = parseIdylliumStyle('user-select: all');
  assert(all.length === 1 && all[0].value === 'all', 'user-select: all was not parsed');
  const junk = parseIdylliumStyle('user-select: bananas');
  assert(junk.length === 0, 'invalid user-select value slipped through');
});

test('output written before a handler crash survives in getOutput', async () => {
  // Находка методистов 2026-09-03: «при runtime-ошибке теряется
  // незавершённая console.write-строка». Ядро хвост ХРАНИТ — этот страж
  // фиксирует контракт, на который опираются хосты (Web IDE синкает вывод
  // в catch, расширение VS Code печатает result.output при аварии).
  const result = await runWithInspectableRuntime([
    'use console;',
    'use gui;',
    'main() {',
    '    gui.Window win;',
    '    win.title = "Окно";',
    '    gui.Button b;',
    '    b.text = "Жми";',
    '    win.add_child(b);',
    '    b.on_click = void function() {',
    '        console.write("Приглашение: ");',
    '        dyn_array<int> xs;',
    '        int boom = xs[5];',
    '    };',
    '    win.show();',
    '}',
  ].join('\n'), { file: 'g.idyl' });
  const window = result.runtime.getWindows()[0];
  const button = window.children.find((child) => child.type === 'gui.Button');
  assert(button !== undefined, 'expected the button in the window');
  let thrown = '';
  try {
    await result.runtime.dispatchGuiEvent(button.id, 'click', {});
    await result.runtime.stepGui(0.016);
  } catch (error) {
    thrown = String((error as Error).message ?? error);
  }
  assert(thrown.includes('array index 5 out of bounds'), `expected the handler crash, got: ${thrown}`);
  assert(
    result.runtime.getOutput() === 'Приглашение: ',
    `pre-crash output lost: ${JSON.stringify(result.runtime.getOutput())}`,
  );
});

void runTests();
