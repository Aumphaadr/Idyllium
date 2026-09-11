// Смоук: стандартная библиотека — console/math/random/time/file/json/encoding/
// types/colors/sqlite/сеть/xml/system.
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

test('to_float converts strings and reports runtime errors', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      float value = to_float("1.6");
      console.write(value);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '1.6', `unexpected output: ${JSON.stringify(result.output)}`);

  const failed = await runIdyllium(`
    main() {
      float value = to_float("not a number");
    }
  `);

  assert(!failed.success, 'expected runtime failure');
  const runtimeError = failed.runtimeError;
  assert(runtimeError !== null, 'expected runtime error text');
  assert(runtimeError.includes("'to_float' cannot convert 'not a number' to float"), runtimeError);

  await assertRuntimeFails(`
    main() {
      int value = to_int("12abc");
    }
  `, "'to_int' cannot convert '12abc' to int");

  await assertRuntimeFails(`
    main() {
      float value = to_float("3.14abc");
    }
  `, "'to_float' cannot convert '3.14abc' to float");
});

test('math helpers and ansi escape run', async () => {
  const result = await runIdyllium(`
    use console;
    use math;

    main() {
      float x = 3.6789;
      int rounded = math.round(15.9);
      int volume = math.clamp(0, 115, 100);

      console.write(
        "\\e[31m", ":",
        rounded, ":",
        math.round(x, 2), ":",
        math.floor(x, 2), ":",
        math.ceil(x, 2), ":",
        volume, ":",
        math.round(math.sin(math.pi / 2), 4), ":",
        math.round(math.to_degrees(math.pi), 2)
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '\x1b[31m:16:3.68:3.67:3.68:100:1:180', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('console clear removes previous output', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      console.writeln("before");
      console.clear();
      console.write("after");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'after', `unexpected output after clear: ${JSON.stringify(result.output)}`);
});

test('stdlib runtime validation is readable', async () => {
  await assertRuntimeFails([
    'use math;',
    '',
    'main() {',
    '    float value = math.sqrt(-1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: math.sqrt() expects a non-negative number, got -1');

  await assertRuntimeFails([
    'use math;',
    '',
    'main() {',
    '    float value = math.log(0);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: math.log() expects a positive number, got 0');

  await assertRuntimeFails([
    'use random;',
    '',
    'main() {',
    '    int value = random.create_int(10, 1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: random.create_int() min must be less than or equal to max');

  await assertRuntimeFails([
    'use random;',
    '',
    'main() {',
    '    float value = random.create_float(5, 5);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: random.create_float() min must be less than max');

  await assertRuntimeFails([
    'use colors;',
    '',
    'main() {',
    '    colors.Color value = colors.RGB(999, -20, 300);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: colors.RGB() red must be between 0 and 255, got 999');

  await assertRuntimeFails([
    'use console;',
    '',
    'main() {',
    '    console.set_precision(-1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: console.set_precision() must be between 0 and 25, got -1');
});

test('random seed is deterministic', async () => {
  const result = await runIdyllium(`
    use console;
    use random;

    main() {
      random.set_seed(400);
      int first = random.create_int(0, 99);
      int second = random.create_int(0, 99);

      random.set_seed(400);
      console.write(first, ":", second, ":", random.create_int(0, 99), ":", random.create_int(0, 99));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  const parts = result.output.split(':');
  assert(parts.length === 4, `unexpected output: ${JSON.stringify(result.output)}`);
  assert(parts[0] === parts[2] && parts[1] === parts[3], `seeded random was not deterministic: ${result.output}`);
});

test('random choose_from preserves string array and class element types', async () => {
  const result = await runIdyllium(`
    use console;
    use random;

    class Hero {
      string name;

      constructor Hero(string name) {
        this.name = name;
      }
    }

    main() {
      string letters = "ABC";
      array<int, 3> numbers = [10, 20, 30];
      dyn_array<string> names = ["Liam", "Mira"];
      array<Hero, 2> heroes = [Hero("Kaspar"), Hero("Raven")];

      random.set_seed(42);
      char letter = random.choose_from(letters);
      int number = random.choose_from(numbers);
      string name = random.choose_from(names);
      Hero hero = random.choose_from(heroes);

      console.write(
        letters.contains(letter), ":",
        numbers.contains(number), ":",
        names.contains(name), ":",
        hero.name == "Kaspar" or hero.name == "Raven"
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:true:true:true', `unexpected choose_from output: ${JSON.stringify(result.output)}`);
});

test('random choose_from reports empty collections and wrong argument types', async () => {
  await assertRuntimeFails([
    'use random;',
    '',
    'main() {',
    '    char value = random.choose_from("");',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: random.choose_from() cannot choose from an empty string');

  await assertRuntimeFails([
    'use random;',
    '',
    'main() {',
    '    dyn_array<int> values;',
    '    int value = random.choose_from(values);',
    '}',
  ].join('\n'), 'main.idyl:5: runtime error: random.choose_from() cannot choose from an empty array');

  assertFails([
    'use random;',
    '',
    'main() {',
    '    int value = random.choose_from(42);',
    '}',
  ].join('\n'), "'choose_from' argument 1 expects string or array, got 'int'");
});

test('time and file modules run in headless runtime', async () => {
  const sleepResult = await runIdyllium([
    'use time;',
    '',
    'main() {',
    '    time.sleep(0);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(sleepResult.success, sleepResult.runtimeError ?? sleepResult.compilation.diagnosticsText);

  await assertRuntimeFails([
    'use time;',
    '',
    'main() {',
    '    time.sleep(-1);',
    '}',
  ].join('\n'), 'main.idyl:4: runtime error: time.sleep() seconds must be non-negative, got -1');

  const fileResult = await runIdyllium([
    'use console;',
    'use file;',
    '',
    'main() {',
    '    console.write(file.exists("001.idyl"), ":", file.exists("missing.idyl"));',
    '}',
  ].join('\n'), {}, { file: 'generated/lesson-spec/examples/console/hello/001.idyl' });

  assert(fileResult.success, fileResult.runtimeError ?? fileResult.compilation.diagnosticsText);
  assert(fileResult.output === 'true:false', `unexpected file.exists output: ${JSON.stringify(fileResult.output)}`);
});

test('time sleep can be stopped by abort signal', async () => {
  const controller = new AbortController();
  const resultPromise = runIdyllium(`
    use console;
    use time;

    main() {
      console.write("start");
      time.sleep(5);
      console.write("end");
    }
  `, { abortSignal: controller.signal }, { file: 'main.idyl' });

  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  const result = await resultPromise;
  assert(!result.success, 'expected stopped program to fail');
  assert(result.output === 'start', `expected only streamed output before sleep, got ${result.output}`);
  assert(result.runtimeError?.includes('program was stopped') === true, `expected stopped runtime error, got ${result.runtimeError}`);
});

test('math.abs preserves integer typing and bigint precision', async () => {
  const result = await runIdyllium([
    'use console;',
    'use math;',
    '',
    'main() {',
    '    int a = math.abs(-5);',
    '    float b = math.abs(-2.5);',
    '    int big = math.abs(-9007199254740993);',
    '    console.write(a, ":", b, ":", big, ":", math.abs(value = -7));',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '5:2.5:9007199254740993:7',
    `unexpected math.abs output: ${JSON.stringify(result.output)}`,
  );

  // Ненулевые числа, округляющиеся в 0 при дефолтной точности, печатаются
  // научной записью, а не теряются как "0".
  const tiny = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    float small = 1.5;',
    '    small = small / 1000000000000.0;',
    '    console.write(small, ":", 0.0);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });
  assert(tiny.success, tiny.runtimeError ?? tiny.compilation.diagnosticsText);
  assert(tiny.output === '1.5e-12:0', `unexpected tiny float output: ${JSON.stringify(tiny.output)}`);

  assertFails([
    'use console;',
    'use math;',
    '',
    'main() {',
    '    int broken = math.abs(-2.5);',
    '}',
  ].join('\n'), "cannot assign 'float' value to 'int' variable");
});

test('file errors show project-relative paths', async () => {
  await assertRuntimeFails([
    'use file;',
    '',
    'main() {',
    '    file.open("missing_input.txt", "read");',
    '}',
  ].join('\n'), "file.open() cannot open 'missing_input.txt' for reading: file does not exist");

  const browserResult = await runIdylliumInBrowser({
    entryFile: '/workspace/main.idyl',
    files: {
      '/workspace/main.idyl': [
        'use file;',
        '',
        'main() {',
        '    file.open("save.txt", "read");',
        '}',
      ].join('\n'),
    },
  });
  assert(!browserResult.success, 'expected missing browser file to fail');
  assert(
    browserResult.runtimeError?.includes("cannot open 'save.txt' for reading") === true,
    `expected relative path in browser file error, got ${browserResult.runtimeError}`,
  );
  assert(
    browserResult.runtimeError?.includes("'/workspace/save.txt'") !== true,
    `browser file error must not leak absolute paths, got ${browserResult.runtimeError}`,
  );
});

test('extended encodings round-trip and reproduce classic mojibake', async () => {
  const result = await runIdyllium([
    'use console;',
    'use encoding;',
    '',
    'main() {',
    '    // Классика жанра: 1251-байты, прочитанные другими кодировками',
    '    dyn_array<int> bytes = encoding.encode("Нормальный текст", "windows-1251");',
    '    console.writeln(encoding.decode(bytes, "windows-1252"));',
    '    console.writeln(encoding.decode(bytes, "cp866"));',
    '',
    '    // Round-trip всех новых кодировок',
    '    console.writeln(encoding.decode(encoding.encode("Привет, DOS!", "cp866"), "cp866"));',
    '    console.writeln(encoding.decode(encoding.encode("Iş günü", "windows-1254"), "windows-1254"));',
    '    console.writeln(encoding.decode(encoding.encode("café £5", "windows-1252"), "windows-1252"));',
    '',
    '    // CP437: псевдографика с точными DOS-байтами',
    '    dyn_array<int> box = encoding.encode("╔═╗", "cp437");',
    '    console.writeln(box);',
    '    console.writeln(encoding.decode(box, "ibm437")); // алиас',
    '',
    '    console.writeln(encoding.list_encodings().length);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'Íîðìàëüíûé òåêñò\n═юЁьры№э√щ ЄхъёЄ\nПривет, DOS!\nIş günü\ncafé £5\n[201, 205, 187]\n╔═╗\n41\n',
    `unexpected encoding output: ${JSON.stringify(result.output)}`,
  );

  // Кириллица в западной кодировке — честная ошибка, не молчаливый '?'
  await assertRuntimeFails(
    'use encoding;\nmain() {\n    encoding.encode("Ю", "windows-1252");\n}',
    "is not valid windows-1252",
  );
});

test('url library parses addresses and opens them through the host', async () => {
  const opened: string[] = [];
  const result = await runIdyllium([
    'use console;',
    'use url;',
    '',
    'string ADDRESS = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43";',
    '',
    'main() {',
    '    console.writeln(url.scheme(ADDRESS));',
    '    console.writeln(url.host(ADDRESS));',
    '    console.writeln(url.path(ADDRESS));',
    '    console.writeln(url.query(ADDRESS));',
    '    console.writeln(url.query_value(ADDRESS, "v"));',
    '    console.writeln(url.query_value(ADDRESS, "нет-такого"));',
    '    console.writeln(url.port(ADDRESS));            // порт не написан — стандартный для https',
    '    console.writeln(url.port("http://example.com:8080/"));',
    '    console.writeln(url.fragment("https://example.com/page#часть"));',
    '    console.writeln(url.encode("Идиллия"));',
    '    console.writeln(url.decode("%D0%98%D0%B4%D0%B8%D0%BB%D0%BB%D0%B8%D1%8F"));',
    '    console.writeln(url.is_valid(ADDRESS), ":", url.is_valid("просто текст"));',
    '',
    '    url.open(ADDRESS);',
    '}',
  ].join('\n'), { urlOpener: { open(address: string) { opened.push(address); } } }, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      'https',
      'www.youtube.com',
      '/watch',
      'v=dQw4w9WgXcQ&t=43',
      'dQw4w9WgXcQ',
      '',
      '443',
      '8080',
      'часть',
      '%D0%98%D0%B4%D0%B8%D0%BB%D0%BB%D0%B8%D1%8F',
      'Идиллия',
      'true:false',
      '',
    ].join('\n'),
    `unexpected url output: ${JSON.stringify(result.output)}`,
  );
  assert(
    opened.length === 1 && opened[0] === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43',
    `expected the host opener to receive the address, got ${JSON.stringify(opened)}`,
  );

  // Только http/https: локальные файлы и javascript: по клику недопустимы
  await assertRuntimeFails(
    'use url;\nmain() {\n    url.open("file:///etc/passwd");\n}',
    "url.open() supports only http and https addresses, got 'file'",
  );
  await assertRuntimeFails(
    'use url;\nmain() {\n    url.scheme("это не адрес");\n}',
    'url.scheme() got an address it cannot understand',
  );
});

test('hash library matches reference digests', async () => {
  const result = await runIdyllium([
    'use console;',
    'use encoding;',
    'use hash;',
    '',
    'main() {',
    '    console.writeln(hash.crc32("hello"));',
    '    console.writeln(hash.fnv1a("hello"));',
    '    console.writeln(hash.adler32("hello"));',
    '    console.writeln(hash.sha256("hello"));',
    '    console.writeln(hash.sha256("")); // пустой вход — известный дайджест',
    '    console.writeln(hash.crc32("Привет"));',
    '    console.writeln(hash.sha256("Привет")); // юникод хешируется как UTF-8',
    '',
    '    dyn_array<int> raw = [1, 2, 3];',
    '    console.writeln(hash.crc32(raw), ":", hash.adler32(raw));',
    '    console.writeln(hash.sha256_bytes("hello").length);',
    '    // строка и её UTF-8-байты дают одинаковый отпечаток',
    '    console.writeln(hash.crc32("hello") == hash.crc32(encoding.encode("hello", "utf-8")));',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '907060870',
      '1335831723',
      '103547413',
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      '2833953177',
      'dd679c0b9fd408a04148aa7d30c9df393f67b7227f65693fffe0ed6d0f0ade59',
      '1438416925:851975',
      '32',
      'true',
      '',
    ].join('\n'),
    `unexpected hash output: ${JSON.stringify(result.output)}`,
  );

  // Рукописный FNV-1a из будущего урока обязан совпадать с библиотечным
  const handmade = await runIdyllium([
    'use console;',
    'use encoding;',
    'use hash;',
    'use types;',
    '',
    'int function fnv1a_by_hand(string text) {',
    '    types.uint32 h = 2166136261;',
    '    dyn_array<int> bytes = encoding.encode(text, "utf-8");',
    '    for (int i = 0; i < bytes.length; i += 1) {',
    '        types.uint32 b = bytes[i];',
    '        h = h.bit_xor(b);',
    '        h = h * 16777619;',
    '    }',
    '    return h;',
    '}',
    '',
    'main() {',
    '    console.write(fnv1a_by_hand("Привет") == hash.fnv1a("Привет"));',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });
  assert(handmade.success, handmade.runtimeError ?? handmade.compilation.diagnosticsText);
  assert(handmade.output === 'true', `handmade FNV-1a must match the library: ${JSON.stringify(handmade.output)}`);

  await assertRuntimeFails(
    'use hash;\nmain() {\n    dyn_array<int> b = [300];\n    hash.crc32(b);\n}',
    'byte at index 0 must be between 0 and 255',
  );
  assertFails('use hash;\nmain() {\n    hash.crc32(42);\n}', "expects string or byte array, got 'int'");
});

test('module values, mulberry32 and types limit constants behave', async () => {
  // Голое имя модуля — не значение
  assertFails('use console;\nmain() {\n    console.writeln(console);\n}', "module 'console' cannot be used as a value");
  assertFails('use console;\nuse math;\nmain() {\n    int x = math;\n}', "module 'math' cannot be used as a value");

  const result = await runIdyllium([
    'use console;',
    'use random;',
    'use types;',
    '',
    'main() {',
    '    random.set_seed(42);',
    '    int first = random.mulberry32();',
    '    int second = random.mulberry32();',
    '    random.set_seed(42);',
    '    console.writeln(first == random.mulberry32()); // тот же сид — та же последовательность',
    '    console.writeln(first != second);',
    '    console.writeln(first >= 0 and first <= types.UINT32_MAX);',
    '',
    '    console.writeln(types.INT8_MIN, ":", types.INT8_MAX, ":", types.UINT8_MAX);',
    '    console.writeln(types.UINT32_MAX);',
    '    console.writeln(types.INT64_MIN);',
    '    console.writeln(types.UINT64_MAX);',
    '    console.writeln(types.INT64_MAX - 1); // 64-битная точность сохраняется',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'true\ntrue\ntrue\n-128:127:255\n4294967295\n-9223372036854775808\n18446744073709551615\n9223372036854775806\n',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('time.create builds stamps from calendar components', async () => {
  const result = await runIdyllium([
    'use console;',
    'use time;',
    '',
    'main() {',
    '    time.stamp meeting = time.create(2026, 9, 24, 18, 3);',
    '    console.writeln(meeting, ":", meeting.week_day, ":", meeting.unix);',
    '    console.writeln(time.create(2026, 9, 24)); // время по умолчанию — полночь',
    '    console.writeln(time.create(2026, 9, 24, hour=18, minute=3)); // именованные',
    '',
    '    // Компоненты трактуются в указанной зоне: Екатеринбург на 5 часов восточнее UTC',
    '    time.stamp ekb = time.create(2026, 9, 24, 18, 3, 0, 0, "Asia/Yekaterinburg");',
    '    console.writeln(meeting.unix - ekb.unix);',
    '',
    '    console.writeln(time.create(2024, 2, 29)); // високосный год — дата существует',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '2026-09-24 18:03:00:4:1790272980\n2026-09-24 00:00:00\n2026-09-24 18:03:00\n18000\n2024-02-29 00:00:00\n',
    `unexpected time.create output: ${JSON.stringify(result.output)}`,
  );

  await assertRuntimeFails('use time;\nmain() {\n    time.create(2026, 2, 30);\n}', 'date 2026-02-30 does not exist');
  await assertRuntimeFails('use time;\nmain() {\n    time.create(2026, 13, 1);\n}', 'month must be between 1 and 12, got 13');
  await assertRuntimeFails('use time;\nmain() {\n    time.create(2026, 1, 1, 24);\n}', 'hour must be between 0 and 23, got 24');
});

test('encoding safe=false replaces broken data instead of failing', async () => {
  const result = await runIdyllium([
    'use console;',
    'use encoding;',
    '',
    'main() {',
    '    // 1251-байты, прочитанные как UTF-8 с отключённой страховкой',
    '    dyn_array<int> bytes = encoding.encode("Нормальный текст", "windows-1251");',
    '    console.writeln(encoding.decode(bytes, "utf-8", safe=false));',
    '',
    '    // Кириллица в ASCII: классические вопросики',
    '    console.writeln(encoding.encode("Привет!", "ascii", safe=false));',
    '    console.writeln(encoding.decode(encoding.encode("Ямб и хорей", "windows-1252", safe=false), "windows-1252"));',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\n[63, 63, 63, 63, 63, 63, 33]\n??? ? ?????\n',
    `unexpected safe=false output: ${JSON.stringify(result.output)}`,
  );

  // Страховка по умолчанию включена: без safe=false — честная ошибка
  await assertRuntimeFails(
    'use encoding;\nmain() {\n    encoding.decode([208], "utf-8");\n}',
    'invalid UTF-8',
  );
});

test('time stamp read-only properties run in UTC by default', async () => {
  const result = await runIdyllium([
    'use console;',
    'use time;',
    '',
    'main() {',
    '    time.stamp birth = time.from_unix(946684800);',
    '    console.write(',
    '        birth, ":",',
    '        birth.year, ":", birth.month, ":", birth.day, ":",',
    '        birth.hour, ":", birth.minute, ":", birth.second, ":",',
    '        birth.week_day, ":", birth.unix, ":", birth.timezone',
    '    );',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '2000-01-01 00:00:00:2000:1:1:0:0:0:6:946684800:UTC',
    `unexpected time stamp output: ${JSON.stringify(result.output)}`,
  );
});

test('time stamps preserve their instant across IANA timezones and DST', async () => {
  const result = await runIdyllium(`
    use console;
    use time;

    main() {
      time.stamp utc = time.from_unix(0);
      time.stamp ekb = utc.in_timezone("Asia/Yekaterinburg");
      time.stamp ny = time.from_unix(0, timezone="America/New_York");
      time.stamp berlin_before = time.from_unix(1711845000, "Europe/Berlin");
      time.stamp berlin_after = time.from_unix(1711848600, "Europe/Berlin");

      console.writeln(utc, ":", utc.timezone, ":", utc.unix);
      console.writeln(ekb, ":", ekb.timezone, ":", ekb.unix);
      console.writeln(ny, ":", ny.timezone, ":", ny.unix);
      console.writeln(berlin_before, " -> ", berlin_after);
    }
  `, {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '1970-01-01 00:00:00:UTC:0',
      '1970-01-01 05:00:00:Asia/Yekaterinburg:0',
      '1969-12-31 19:00:00:America/New_York:0',
      '2024-03-31 01:30:00 -> 2024-03-31 03:30:00',
      '',
    ].join('\n'),
    `unexpected timezone output: ${JSON.stringify(result.output)}`,
  );
});

test('time stamp timezone and read-only property diagnostics are readable', async () => {
  await assertRuntimeFails(`
    use time;
    main() {
      time.now("Mars/Olympus");
    }
  `, 'time.stamp timezone is unknown, got "Mars/Olympus"');

  assertFails(`
    use console;
    use time;
    main() {
      time.stamp stamp = time.now();
      stamp.year = 2000;
    }
  `, "property 'year' is read-only");

  assertFails(`
    use console;
    use time;
    main() {
      time.stamp stamp = time.now();
      console.writeln(stamp.year());
    }
  `, "type 'time.stamp' has no method 'year'");
});

test('file streams read and write relative to source file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'Кирка\nМеч', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string first = fin.read_line();',
      '    string second = fin.read_line();',
      '    bool has_more = fin.has_next_line();',
      '    fin.close();',
      '',
      '    file.ostream fout = file.open("output.txt", "write");',
      '    fout.write(first);',
      '    fout.write_line(second);',
      '    fout.write("Готово");',
      '    fout.close();',
      '',
      '    console.write(first, second, ":", has_more, ":", file.exists("output.txt"));',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(result.output === 'Кирка\nМеч:false:true', `unexpected file stream output: ${JSON.stringify(result.output)}`);
    assert(fs.readFileSync(path.join(dir, 'output.txt'), 'utf8') === 'Кирка\nМеч\nГотово', 'unexpected written file content');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('file stream read counts Unicode characters and shares its cursor', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'A🙂Б\r\nкот', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string first = fin.read(2);',
      '    string line_end = fin.read_line();',
      '    string rest = fin.read();',
      '    string empty = fin.read(10);',
      '    fin.close();',
      '    console.write(first, "|", line_end, "|", rest, "|", empty);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(result.output === 'A🙂|Б\r\n|кот|', `unexpected character read output: ${JSON.stringify(result.output)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('file stream read_all reads remaining text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'one\ntwo\nthree', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string first = fin.read_line();',
      '    string rest = fin.read_all();',
      '    bool has_more = fin.has_next_line();',
      '    fin.close();',
      '    console.write(first, "|", rest, "|", has_more);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(result.output === 'one\n|two\nthree|false', `unexpected output: ${JSON.stringify(result.output)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('file read lines keep newline characters visible inside arrays', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'Кирка\nТопор\nМеч', 'utf8');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string line1 = fin.read_line();',
      '    string line2 = fin.read_line();',
      '    string line3 = fin.read_line();',
      '    fin.close();',
      '',
      '    array<string, 3> tools = [line1, line2, line3];',
      '    console.write(tools);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(
      result.output === '["Кирка\\n", "Топор\\n", "Меч"]',
      `unexpected inspected file lines: ${JSON.stringify(result.output)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json module parses validates and extracts values', async () => {
  const source = [
    'use console;',
    'use json;',
    '',
    'main() {',
    '    string text = "{\\"name\\":\\"Ada\\",\\"age\\":12,\\"active\\":true,\\"items\\":[1,\\"two\\",null],\\"address\\":{\\"city\\":\\"London\\"}}";',
    '    bool valid = json.is_valid(text);',
    '    json.Value root_value = json.parse(text);',
    '    json.Object root = root_value.to_object();',
    '    string name = root.get("name").to_string();',
    '    int age = root.get("age").to_int();',
    '    bool active = root.get("active").to_bool();',
    '    json.Array items = root.get("items").to_array();',
    '    string second = items.at(1).to_string();',
    '    bool third_is_null = items.at(2).is_null();',
    '    json.Object address = root.get("address").to_object();',
    '    console.write(valid, ":", name, ":", age, ":", active, ":", second, ":", third_is_null, ":", address.get("city").to_string());',
    '}',
  ].join('\n');

  const result = await runIdyllium(source);
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:Ada:12:true:two:true:London', `unexpected JSON output: ${JSON.stringify(result.output)}`);
});

test('json preserves exact 64-bit integers through parse and serialization', async () => {
  const result = await runIdyllium([
    'use console;',
    'use json;',
    'use types;',
    '',
    'main() {',
    '    string text = "{\\"signed\\":9223372036854775807,\\"unsigned\\":18446744073709551615,\\"precise\\":9007199254740993}";',
    '    console.write(json.is_valid(text), ":");',
    '',
    '    json.Object root = json.parse(text).to_object();',
    '    types.int64 signed = root.get("signed").to_int64();',
    '    types.uint64 unsigned = root.get("unsigned").to_uint64();',
    '    types.uint64 precise = root.get("precise").to_uint64();',
    '',
    '    json.Object created;',
    '    created.add("signed", json.Value(signed));',
    '    created.add("unsigned", json.Value(unsigned));',
    '    created.add("precise", json.Value(precise));',
    '    string serialized = created.to_json();',
    '    json.Object reparsed = json.parse(serialized).to_object();',
    '',
    '    console.write(signed, ":", unsigned, ":", precise, "\\n");',
    '    console.writeln(serialized);',
    '    console.write(reparsed.get("signed").to_int64(), ":");',
    '    console.write(reparsed.get("unsigned").to_uint64(), ":");',
    '    console.write(reparsed.get("precise").to_uint64());',
    '}',
  ].join('\n'));

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      'true:9223372036854775807:18446744073709551615:9007199254740993',
      '{"signed":9223372036854775807,"unsigned":18446744073709551615,"precise":9007199254740993}',
      '9223372036854775807:18446744073709551615:9007199254740993',
    ].join('\n'),
    `unexpected exact JSON integer output: ${JSON.stringify(result.output)}`,
  );
});

test('exact json parser keeps standard JSON syntax checks', async () => {
  const result = await runIdyllium([
    'use console;',
    'use json;',
    '',
    'main() {',
    '    string valid = " { \\"text\\" : \\"line\\\\nК\\", \\"fraction\\" : 1.5, \\"power\\" : 1e2 } ";',
    '    console.write(json.is_valid(valid), ":");',
    '    console.write(json.parse(valid).to_object().get("power").to_int(), ":");',
    '    console.write(json.is_valid("{\\"value\\":1,}"), ":");',
    '    console.write(json.is_valid("{\\"value\\":01}"), ":");',
    '    console.write(json.is_valid("[1 // comment]"));',
    '}',
  ].join('\n'));

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:100:false:false:false', `unexpected JSON syntax output: ${JSON.stringify(result.output)}`);
});

test('json module creates serializes and writes values', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-json-'));
  const sourceFile = path.join(dir, 'main.idyl');

  try {
    const result = await runIdyllium([
      'use console;',
      'use file;',
      'use json;',
      '',
      'main() {',
      '    json.Object root;',
      '    json.Value name("John Doe");',
      '    root.add("name", name);',
      '    root.add("wife", null);',
      '',
      '    if (root.has("wife")) {',
      '        root.set("wife", json.Value("Jane Doe"));',
      '    }',
      '',
      '    json.Array numbers;',
      '    numbers.add(json.Value(1));',
      '    numbers.add(json.Value("two"));',
      '    root.add("items", json.Value(numbers));',
      '',
      '    string compact = root.to_json();',
      '    string pretty = root.to_pretty_json();',
      '',
      '    file.ostream f = file.open("output.json", "write");',
      '    f.write(root.to_pretty_json(4));',
      '    f.close();',
      '',
      '    console.write(compact, "\\n", pretty);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
    assert(
      result.output === '{"name":"John Doe","wife":"Jane Doe","items":[1,"two"]}\n{\n  "name": "John Doe",\n  "wife": "Jane Doe",\n  "items": [\n    1,\n    "two"\n  ]\n}',
      `unexpected JSON serialization: ${JSON.stringify(result.output)}`,
    );
    assert(
      fs.readFileSync(path.join(dir, 'output.json'), 'utf8') === '{\n    "name": "John Doe",\n    "wife": "Jane Doe",\n    "items": [\n        1,\n        "two"\n    ]\n}',
      'unexpected JSON file content',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json module runtime errors are readable', async () => {
  await assertRuntimeFails([
    'use json;',
    '',
    'main() {',
    '    json.Value value = json.Value(42);',
    '    string text = value.to_string();',
    '}',
  ].join('\n'), 'main.idyl:5: runtime error: json value is number, expected string');

  await assertRuntimeFails([
    'use json;',
    '',
    'main() {',
    '    json.Array values;',
    '    values.add(json.Value(1));',
    '    values.at(3);',
    '}',
  ].join('\n'), 'main.idyl:6: runtime error: json array index 3 out of bounds (size 1, valid indices 0-0)');

  // С канона «int точен на любом размере» (2026-08-22) to_int() без потолка:
  // 64-битное JSON-целое приходит точным обычным int.
  const uncapped = await runIdyllium([
    'use console;',
    'use json;',
    '',
    'main() {',
    '    json.Value value = json.parse("18446744073709551615");',
    '    console.writeln(value.to_int() + 1);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });
  assert(
    uncapped.output === '18446744073709551616\n',
    `json to_int must be uncapped: ${JSON.stringify(uncapped.output)} ${uncapped.runtimeError}`,
  );

  await assertRuntimeFails([
    'use json;',
    'use types;',
    '',
    'main() {',
    '    json.Value value = json.parse("-1");',
    '    types.uint64 number = value.to_uint64();',
    '}',
  ].join('\n'), 'main.idyl:6: runtime error: json integer -1 is outside the types.uint64 range');
});

test('file stream runtime errors are readable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-files-'));
  const sourceFile = path.join(dir, 'main.idyl');
  fs.writeFileSync(path.join(dir, 'empty.txt'), '', 'utf8');
  fs.writeFileSync(path.join(dir, 'input.txt'), 'Line', 'utf8');

  try {
    const pastEnd = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("empty.txt", "read");',
      '    string line = fin.read_line();',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!pastEnd.success, 'expected runtime failure');
    assert(pastEnd.runtimeError !== null, 'expected runtime error text');
    assert(
      pastEnd.runtimeError.includes(`${sourceFile}:5: runtime error: istream.read_line() cannot read past end of file`),
      `unexpected file runtime error: ${JSON.stringify(pastEnd.runtimeError)}`,
    );

    const readAfterClose = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    fin.close();',
      '    string line = fin.read_line();',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!readAfterClose.success, 'expected runtime failure');
    assert(readAfterClose.runtimeError !== null, 'expected runtime error text');
    assert(
      readAfterClose.runtimeError.includes(`${sourceFile}:6: runtime error: istream.read_line() cannot be used after close()`),
      `unexpected read-after-close error: ${JSON.stringify(readAfterClose.runtimeError)}`,
    );

    const negativeRead = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "read");',
      '    string text = fin.read(-1);',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!negativeRead.success, 'expected negative read count to fail');
    assert(
      negativeRead.runtimeError?.includes(`${sourceFile}:5: runtime error: istream.read() count must be non-negative, got -1`) === true,
      `unexpected negative-read error: ${JSON.stringify(negativeRead.runtimeError)}`,
    );

    const writeAfterClose = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.ostream fout = file.open("output.txt", "write");',
      '    fout.close();',
      '    fout.write_line("Oops");',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!writeAfterClose.success, 'expected runtime failure');
    assert(writeAfterClose.runtimeError !== null, 'expected runtime error text');
    assert(
      writeAfterClose.runtimeError.includes(`${sourceFile}:6: runtime error: ostream.write_line() cannot be used after close()`),
      `unexpected write-after-close error: ${JSON.stringify(writeAfterClose.runtimeError)}`,
    );

    const badMode = await runIdyllium([
      'use file;',
      '',
      'main() {',
      '    file.istream fin = file.open("input.txt", "edit");',
      '}',
    ].join('\n'), {}, { file: sourceFile });

    assert(!badMode.success, 'expected runtime failure');
    assert(badMode.runtimeError !== null, 'expected runtime error text');
    assert(
      badMode.runtimeError.includes(`${sourceFile}:4: runtime error: file.open() mode must be 'read', 'write' or 'append', got 'edit'`),
      `unexpected bad mode error: ${JSON.stringify(badMode.runtimeError)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('is_int and is_float match to_int and to_float exactly', async () => {
  const result = await runIdyllium(`
    use console;

    void function probe(string s) {
      bool int_works = true;
      try { to_int(s); } catch { int_works = false; }
      bool float_works = true;
      try { to_float(s); } catch { float_works = false; }
      if (s.is_int() != int_works) { console.writeln("is_int lies about [", s, "]"); }
      if (s.is_float() != float_works) { console.writeln("is_float lies about [", s, "]"); }
    }

    main() {
      dyn_array<string> probes = [
        "50", "50.0", "-5", "+5", ".5", "5.", "-.5", "5e3",
        " 50 ", "50,5", "", "abc", "5.5.5", "0", "007"
      ];
      for (int i = 0; i < probes.length; i = i + 1) {
        probe(probes[i]);
      }
      console.writeln("50 is_float=", "50".is_float(), " 5e3 is_float=", "5e3".is_float());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '50 is_float=true 5e3 is_float=false\n',
    `guard contract broken: ${JSON.stringify(result.output)}`,
  );
});

test('console input works inside initializers', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      string name = console.get_string();
      console.write("Hello, ", name);
    }
  `, { input: ['Ada'] });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Hello, Ada', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('console numeric input errors are readable', async () => {
  const intResult = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    int age = console.get_int();',
    '}',
  ].join('\n'), { input: ['fgf'] }, { file: 'main.idyl' });

  assert(!intResult.success, 'expected int input runtime failure');
  assert(
    intResult.runtimeError === 'main.idyl:4: runtime error: cannot convert input to \'int\' (expected integer, got "fgf")',
    `unexpected runtime error: ${JSON.stringify(intResult.runtimeError)}`,
  );

  const floatResult = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    float temp = console.get_float();',
    '}',
  ].join('\n'), { input: ['erter'] }, { file: 'main.idyl' });

  assert(!floatResult.success, 'expected float input runtime failure');
  assert(
    floatResult.runtimeError === 'main.idyl:4: runtime error: cannot convert input to \'float\' (expected number, got "erter")',
    `unexpected runtime error: ${JSON.stringify(floatResult.runtimeError)}`,
  );
});

test('encoding helpers run and report readable errors', async () => {
  const result = await runIdyllium(`
    use console;
    use encoding;

    main() {
      dyn_array<int> ascii = encoding.encode("Hi", "ascii");
      dyn_array<int> win = encoding.encode("Ёж", "windows-1251");
      dyn_array<int> koi = encoding.encode("Ёж", "koi8-r");
      string text = encoding.decode([72, 101, 108, 108, 111], "ascii");
      string roundtrip = encoding.decode(encoding.encode("Привет", "windows-1251"), "windows-1251");

      console.write(
        encoding.char_to_codepoint('A'), ":",
        encoding.char_to_codepoint('Я'), ":",
        encoding.codepoint_to_char(1040), ":",
        ascii, ":", win, ":", koi, ":",
        text, ":", roundtrip
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '65:1071:А:[72, 105]:[168, 230]:[179, 214]:Hello:Привет',
    `unexpected encoding output: ${JSON.stringify(result.output)}`,
  );

  await assertRuntimeFails(`
    use encoding;

    main() {
      dyn_array<int> codes = encoding.encode("Ю", "ascii");
    }
  `, "character 'Ю' is not valid ASCII");

  await assertRuntimeFails(`
    use encoding;

    main() {
      dyn_array<int> codes = encoding.encode("A", "cp1337");
    }
  `, "unknown encoding 'cp1337'");
});

test('encoding is strict and round-trips complete single-byte tables', async () => {
  const result = await runIdyllium(`
    use console;
    use encoding;

    int function roundtrip_count(string name) {
      int count = 0;
      for (int byte = 0; byte < 256; byte += 1) {
        dyn_array<int> source = [byte];
        // 1.5.7: незанятые позиции (0x98 в windows-1251) — честный отказ,
        // а не управляющий символ; is_valid — проверка перед decode.
        if (not encoding.is_valid(source, name)) {
          continue;
        }
        string decoded = encoding.decode(source, name);
        dyn_array<int> encoded = encoding.encode(decoded, name);
        if (encoded.length == 1 and encoded[0] == byte) {
          count += 1;
        }
      }
      return count;
    }

    main() {
      console.write(
        roundtrip_count("windows-1251"), ":",
        roundtrip_count("koi8-r"), ":",
        encoding.char_to_codepoint('б'), ":",
        encoding.codepoint_to_char(1073)
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '255:256:1073:б', `unexpected strict encoding output: ${JSON.stringify(result.output)}`);

  await assertRuntimeFails(`
    use encoding;
    main() {
      string text = encoding.decode([208], "utf-8");
    }
  `, 'invalid UTF-8 at byte 0 (0xD0): incomplete sequence');

  await assertRuntimeFails(`
    use encoding;
    main() {
      string text = encoding.decode([224, 128, 128], "utf-8");
    }
  `, 'invalid UTF-8 at byte 1 (0x80): invalid continuation byte');

  await assertRuntimeFails(`
    use encoding;
    main() {
      dyn_array<int> bytes = encoding.encode("кот 漢", "windows-1251");
    }
  `, "character '漢' is not valid windows-1251 at position 4");

  await assertRuntimeFails(`
    use encoding;
    main() {
      char value = encoding.codepoint_to_char(55296);
    }
  `, 'codepoint must be a Unicode scalar value');

  assertFails(`
    use encoding;
    main() {
      int value = encoding.char_to_int('A', "ascii");
    }
  `, "'encoding' has no function 'char_to_int'");
});

test('types integer values wrap at typed boundaries', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    void function take(types.int8 arg) {
      console.write(arg);
    }

    types.uint8 function wrap_return(int value) {
      return value;
    }

    main() {
      types.uint8 n = 253;
      n = n + 1;
      n = n + 1;
      n = n + 1;

      types.uint8 k = -11;
      types.uint8 m = 260;

      types.uint8 a = 200;
      types.uint16 b = 65500;
      types.uint16 c = a + b;
      types.uint8 d = b - a;
      int plain = a + 10;

      dyn_array<types.uint8> values = [250];
      values.add(260);
      values[0] += 10;

      console.write(n, ":", k, ":", m, ":", c, ":", d, ":", plain, ":", values, ":", wrap_return(260), ":");
      int value = 130;
      take(value);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '0:245:4:164:20:210:[4, 4]:4:-126', `unexpected types output: ${JSON.stringify(result.output)}`);
});

test('types binary and hexadecimal helpers run', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 u = 221;
      types.int8 s = -35;
      types.uint8 from_bin_u = types.from_bin("10100011", "uint8");
      types.int8 from_bin_s = types.from_bin("10100011", "int8");
      types.uint8 from_hex_u = types.from_hex("A3", "uint8");
      types.int8 from_hex_s = types.from_hex("A3", "int8");

      console.write(
        u.to_bin(), ":", s.to_bin(), ":",
        u.to_hex(), ":", s.to_hex(), ":",
        from_bin_u, ":", from_bin_s, ":",
        from_hex_u, ":", from_hex_s
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '11011101:11011101:DD:DD:163:-93:163:-93', `unexpected types bits output: ${JSON.stringify(result.output)}`);
});

test('types bit shifts use fixed-width zero-filled cells', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 right_source = types.from_bin("00101011", "uint8");
      types.uint8 shifted_right = right_source.shift_right(bits=3);

      types.int8 left_source = types.from_bin("11000101", "int8");
      types.int8 shifted_left = left_source.shift_left(3);

      types.int8 negative = types.from_bin("10000000", "int8");
      types.int8 lost_sign = negative.shift_right(1);

      types.int8 positive = types.from_bin("01000000", "int8");
      types.int8 gained_sign = positive.shift_left(1);

      types.uint8 zero = right_source.shift_left(12);
      types.uint8 chained = right_source.shift_left(1).shift_right(1);

      console.write(
        shifted_right.to_bin(), ":", shifted_right, ":",
        shifted_left.to_bin(), ":", shifted_left, ":",
        lost_sign.to_bin(), ":", lost_sign, ":",
        gained_sign.to_bin(), ":", gained_sign, ":",
        zero.to_bin(), ":", zero, ":", chained.to_bin()
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '00000101:5:00101000:40:01000000:64:10000000:-128:00000000:0:00101011',
    `unexpected fixed-width shift output: ${JSON.stringify(result.output)}`,
  );
});

test('types float shifts reinterpret shifted IEEE bit cells', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.float32 f32 = 4.5;
      types.float32 f32_left = f32.shift_left(3);
      types.float32 f32_right = f32.shift_right(3);
      types.float32 f32_zero = f32.shift_right(100);
      types.float32 finite = 1.5;
      types.float32 infinity = finite.shift_left(1);

      types.float64 f64 = 4.5;
      types.float64 f64_left = f64.shift_left(3);
      types.float64 f64_zero = f64.shift_left(64);

      console.writeln(f32.to_bin());
      console.writeln(f32_left.to_bin());
      console.writeln(f32_right.to_bin());
      console.writeln(f32_zero.to_bin());
      console.writeln(infinity.to_bin());
      console.writeln(f64_left.to_bin());
      console.writeln(f64_zero.to_bin());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '01000000100100000000000000000000',
      '00000100100000000000000000000000',
      '00001000000100100000000000000000',
      '00000000000000000000000000000000',
      '01111111100000000000000000000000',
      '0000000010010000000000000000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000000000000000000000000000',
      '',
    ].join('\n'),
    `unexpected float shift output: ${JSON.stringify(result.output)}`,
  );
});

test('types negative bit counts reverse shift direction', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 value = types.from_bin("00101011", "uint8");
      types.uint8 left_negative = value.shift_left(-3);
      types.uint8 right_negative = value.shift_right(-3);
      types.uint8 erased = value.shift_right(-12);

      types.float32 number = 4.5;
      types.float32 float_left_negative = number.shift_left(-3);
      types.float32 float_right_negative = number.shift_right(-3);

      console.writeln(left_negative.to_bin());
      console.writeln(right_negative.to_bin());
      console.writeln(erased.to_bin());
      console.writeln(float_left_negative.to_bin());
      console.writeln(float_right_negative.to_bin());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '00000101',
      '01011000',
      '00000000',
      '00001000000100100000000000000000',
      '00000100100000000000000000000000',
      '',
    ].join('\n'),
    `unexpected negative shift output: ${JSON.stringify(result.output)}`,
  );
});

test('types bit masks operate on fixed-width integer cells', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 flags = 173;
      types.uint8 mask = 15;
      types.int8 signed = -128;
      types.uint8 lowest_bit = 1;
      types.uint16 packed = 43981;
      types.uint16 high_mask = 65280;

      console.writeln(flags.bit_and(mask).to_bin());
      console.writeln(flags.bit_or(mask).to_bin());
      console.writeln(flags.bit_xor(mask).to_bin());
      console.writeln(flags.bit_not().to_bin());
      console.writeln(signed.bit_or(lowest_bit));
      console.writeln(packed.bit_and(high_mask).shift_right(8));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '00001101',
      '10101111',
      '10100010',
      '01010010',
      '-127',
      '171',
      '',
    ].join('\n'),
    `unexpected bit mask output: ${JSON.stringify(result.output)}`,
  );
});

test('types float masks operate on raw IEEE cells', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.float32 negative32 = -4.5;
      types.uint32 magnitude32 = 2147483647;
      types.float64 negative64 = -4.5;
      types.uint64 magnitude64 = 9223372036854775807;

      console.writeln(negative32.bit_and(magnitude32).to_bin());
      console.writeln(negative64.bit_and(magnitude64).to_bin());
      console.writeln(negative32.bit_not().bit_not().to_bin());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '01000000100100000000000000000000',
      '0100000000010010000000000000000000000000000000000000000000000000',
      '11000000100100000000000000000000',
      '',
    ].join('\n'),
    `unexpected float mask output: ${JSON.stringify(result.output)}`,
  );
});

test('types bit masks require the unsigned type of the same width', () => {
  assertFails(`
    use types;

    main() {
      types.int8 value = 42;
      types.uint16 wrong_mask = 255;
      types.int8 result = value.bit_and(wrong_mask);
    }
  `, "'bit_and' argument 1 expects 'types.uint8', got 'types.uint16'");

  assertFails(`
    use types;

    main() {
      types.float64 value = 4.5;
      types.uint32 wrong_mask = 4294967295;
      types.float64 result = value.bit_xor(wrong_mask);
    }
  `, "'bit_xor' argument 1 expects 'types.uint64', got 'types.uint32'");
});

test('types int64 and uint64 preserve exact values and wrap', async () => {
  const result = await runIdyllium(`
    use console;
    use math;
    use types;

    main() {
      types.uint64 exact = 9007199254740993;
      types.uint64 added = exact + 10;
      types.uint64 maximum = 18446744073709551615;
      types.uint64 wrapped = maximum + 1;

      types.int64 signed_maximum = 9223372036854775807;
      types.int64 signed_minimum = signed_maximum + 1;
      types.int64 minus_one = types.from_hex("FFFFFFFFFFFFFFFF", "int64");
      types.uint64 parsed = types.from_bin(
        "1111111111111111111111111111111111111111111111111111111111111111",
        "uint64"
      );
      types.uint64 index = 1;
      array<string, 2> names = ["zero", "one"];

      console.write(
        exact, ":", added, ":", wrapped, ":",
        signed_minimum, ":", minus_one, ":", parsed, ":",
        exact < added, ":", maximum.to_hex(), ":",
        names[index], ":", math.sqrt(index + 80), ":", div(maximum, 3)
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '9007199254740993:9007199254741003:0:-9223372036854775808:-1:18446744073709551615:true:FFFFFFFFFFFFFFFF:one:9:6148914691236517205',
    `unexpected 64-bit types output: ${JSON.stringify(result.output)}`,
  );
});

test('types int64 values cross gui snapshot boundaries', async () => {
  const { runtime } = await runWithInspectableRuntime(`
    use gui;
    use types;

    main() {
      types.int64 left = 120;

      gui.Window win;
      win.x = left;
      win.show();
    }
  `);

  const snapshot = runtime.getWindows();
  assert(JSON.stringify(snapshot).includes('"x":120'), 'expected bigint-backed coordinate in serializable gui snapshot');
});

test('types float32 and float64 preserve different precision', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      console.set_precision(25);
      types.float32 a = 0.1 + 0.2;
      types.float64 b = 0.1 + 0.2;
      console.write(a, ":", b);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '0.30000001192092896:0.30000000000000004',
    `unexpected float types output: ${JSON.stringify(result.output)}`,
  );
});

test('types integer values reject implicit float assignment', () => {
  assertFails(`
    use types;

    main() {
      types.uint8 n = 1.5;
    }
  `, "cannot assign 'float' value to 'types.uint8' variable");
});

test('types integer values accept explicit to_int conversion from float', async () => {
  const result = await runIdyllium(`
    use console;
    use types;

    main() {
      types.uint8 n = to_int(260.9);
      console.write(n);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '4', `unexpected explicit to_int output: ${JSON.stringify(result.output)}`);
});

test('colors factories produce Color values', async () => {
  const result = await runIdyllium(`
    use console;
    use colors;

    main() {
      colors.Color first = colors.RGB(34, 145, 188);
      colors.Color second = colors.HEX("#2291bc");
      colors.Color transparent;

      console.write(first == second, '\\n');
      console.write(first == colors.RGBA(34, 145, 188, 0.5), '\\n');
      console.write(first, '\\n', second, '\\n', transparent);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'true\nfalse\n#2291bc\n#2291bc\nrgba(0, 0, 0, 0)',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('colors Color exposes read-only channels and immutable with methods', async () => {
  const result = await runIdyllium(`
    use colors;
    use console;

    main() {
      colors.Color base = colors.RGBA(40, 120, 220, 0.75);
      colors.Color warmer = base.with_red(220);
      colors.Color greener = base.with_green(200);
      colors.Color darker = base.with_blue(10);
      colors.Color faded = base.with_alpha(0.25);
      colors.Color rgb = base.with_rgb(1, 2, 3);
      colors.Color rgba = base.with_rgba(4, 5, 6, 0.5);

      console.write(
        base.red, ",", base.green, ",", base.blue, ",", base.alpha, ":",
        warmer.red, ":", greener.green, ":", darker.blue, ":", faded.alpha, ":",
        rgb.red, ",", rgb.green, ",", rgb.blue, ",", rgb.alpha, ":",
        rgba.red, ",", rgba.green, ",", rgba.blue, ",", rgba.alpha, ":",
        base == colors.RGBA(40, 120, 220, 0.75)
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '40,120,220,0.75:220:200:10:0.25:1,2,3,0.75:4,5,6,0.5:true',
    `unexpected immutable color output: ${JSON.stringify(result.output)}`,
  );

  assertFails(`
    use colors;

    main() {
      colors.Color color = colors.RED;
      color.red = 10;
    }
  `, "property 'red' is read-only");
});

test('colors Color with methods validate channel ranges', async () => {
  await assertRuntimeFails([
    'use colors;',
    '',
    'main() {',
    '    colors.Color invalid = colors.RED.with_blue(300);',
    '}',
  ].join('\n'), 'colors.Color.with_blue() value must be between 0 and 255, got 300');

  await assertRuntimeFails([
    'use colors;',
    '',
    'main() {',
    '    colors.Color invalid = colors.RED.with_alpha(-0.1);',
    '}',
  ].join('\n'), 'colors.Color.with_alpha() value must be between 0 and 1, got -0.1');
});

test('colors constants are Color values', async () => {
  const result = await runIdyllium(`
    use console;
    use colors;

    main() {
      console.writeln(colors.BLACK == colors.HEX("#000000"));
      console.writeln(colors.WHITE == colors.HEX("#ffffff"));
      console.writeln(colors.RED == colors.HEX("#ff0000"));
      console.writeln(colors.GREEN == colors.HEX("#00ff00"));
      console.writeln(colors.BLUE == colors.HEX("#0000ff"));
      console.writeln(colors.YELLOW == colors.HEX("#ffff00"));
      console.writeln(colors.CYAN == colors.HEX("#00ffff"));
      console.writeln(colors.MAGENTA == colors.HEX("#ff00ff"));
      console.writeln(colors.GRAY == colors.HEX("#808080"));
      console.writeln(colors.LIGHT_GRAY == colors.HEX("#c0c0c0"));
      console.writeln(colors.DARK_RED == colors.HEX("#800000"));
      console.writeln(colors.DARK_GREEN == colors.HEX("#008000"));
      console.writeln(colors.DARK_BLUE == colors.HEX("#000080"));
      console.writeln(colors.OLIVE == colors.HEX("#808000"));
      console.writeln(colors.TEAL == colors.HEX("#008080"));
      console.writeln(colors.PURPLE == colors.HEX("#800080"));
      console.writeln(colors.TRANSPARENT == colors.RGBA(0, 0, 0, 0.0));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === `${'true\n'.repeat(17)}`,
    `unexpected color constants output: ${JSON.stringify(result.output)}`,
  );
});

test('colors.Color is a strict value type', () => {
  assertFails(`
    use colors;

    main() {
      colors.Color c = "#2291bc";
    }
  `, "cannot assign 'string' value to 'colors.Color'");

  assertFails(`
    main() {
      colors.Color c = colors.RGB(34, 145, 188);
    }
  `, "is not imported");
});

test('time stamps carry milliseconds from fractional unix seconds', async () => {
  const result = await runIdyllium([
    'use console;',
    'use time;',
    '',
    'main() {',
    '    time.stamp t = time.from_unix(946684800.25);',
    '    console.write(t.second, ":", t.millisecond, ":", t.unix, ":", t.in_timezone("Europe/Moscow").millisecond);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '0:250:946684800:250', `unexpected millisecond output: ${JSON.stringify(result.output)}`);
});

test('IDYLLIUM_VERSION matches package.json', () => {
  // Рантайм собирается и в браузер, где package.json недоступен, поэтому
  // версия продублирована константой. Тест сторожит расхождение.
  const packagePath = path.resolve(process.cwd(), 'package.json');
  const declared = String(JSON.parse(fs.readFileSync(packagePath, 'utf8')).version);
  assert(
    IDYLLIUM_VERSION === declared,
    `IDYLLIUM_VERSION is ${IDYLLIUM_VERSION}, package.json says ${declared}`,
  );
});

test('system module reports platform, version and recursion limit', async () => {
  const result = await runIdyllium([
    'use console;',
    'use system;',
    '',
    'main() {',
    '    console.writeln(system.platform());',
    '    console.writeln(system.version());',
    '    console.writeln(system.recursion_depth());',
    '}',
  ].join('\n'), { platform: 'cli' }, { file: 'main.idyl' });

  assert(result.success, `expected success, got ${result.runtimeError}`);
  assert(
    result.output === `cli\n${IDYLLIUM_VERSION}\n20000\n`,
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('system.set_recursion_depth rejects values outside the allowed range', async () => {
  const result = await runIdyllium([
    'use system;',
    '',
    'main() {',
    '    system.set_recursion_depth(5);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(!result.success, 'expected a runtime error');
  assert(
    result.runtimeError?.includes('expects a value between 10 and 200000') === true,
    `unexpected error: ${result.runtimeError}`,
  );
});

test('system.exit ends the program and is not catchable', async () => {
  const result = await runIdyllium([
    'use console;',
    'use system;',
    '',
    'main() {',
    '    try {',
    '        console.writeln("before");',
    '        system.exit(3);',
    '        console.writeln("unreachable");',
    '    } catch (error) {',
    '        console.writeln("must not be caught");',
    '    }',
    '    console.writeln("also unreachable");',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, `system.exit is not a crash, got ${result.runtimeError}`);
  assert(result.output === 'before\n', `unexpected output: ${JSON.stringify(result.output)}`);
  assert(result.exitCode === 3, `expected exit code 3, got ${result.exitCode}`);
  assert(result.exitText === '3', `expected exit text "3", got ${result.exitText}`);
});

test('main return value becomes the exit value of any type', async () => {
  const voidMain = await runIdyllium('main() {}', {}, { file: 'main.idyl' });
  assert(voidMain.exitText === null, `void main must not report an exit value, got ${voidMain.exitText}`);
  assert(voidMain.exitCode === null, 'void main must not report an exit code');

  const intMain = await runIdyllium('int function main() { return 7; }', {}, { file: 'main.idyl' });
  assert(intMain.exitText === '7', `expected "7", got ${intMain.exitText}`);
  assert(intMain.exitCode === 7, `expected 7, got ${intMain.exitCode}`);

  // Строку берём в кавычки, иначе «завершилась с кодом готово» спотыкается.
  const stringMain = await runIdyllium('string function main() { return "готово"; }', {}, { file: 'main.idyl' });
  assert(stringMain.exitText === '"готово"', `expected quoted string, got ${stringMain.exitText}`);
  assert(stringMain.exitCode === null, 'a string result has no process exit code');
});

test('xml.parse and xml.parse_html read markup without tricks', async () => {
  // Матрица спеки spec/some_xml: RSS-жанр, вольный HTML, битые входы с
  // позициями, сущности, SVG собственной черепахи.
  const rss = await runIdyllium(`
use console;
use xml;

main() {
    string source = "<feed><item><title>Новости &amp; вести</title><link>https://a</link></item><item><title>Второй</title><link>https://b</link></item></feed>";
    xml.Node feed = xml.parse_xml(source);
    console.writeln(feed.tag, " ", feed.children.length);
    dyn_array<xml.Node> items = feed.find_all("item");
    for (int i = 0; i < items.length; i = i + 1) {
        console.writeln(items[i].first("title").text, " -> ", items[i].first("link").text);
    }
    console.writeln(feed.has("item"), " ", feed.has("video"));
}
`, {}, { file: 'main.idyl' });
  assert(rss.output === '#document 1\nНовости & вести -> https://a\nВторой -> https://b\ntrue false\n',
    `rss scenario: ${JSON.stringify(rss.output)} ${rss.runtimeError ?? ''}`);

  const html = await runIdyllium(`
use console;
use xml;

main() {
    string page = "<ul><li>Мира<li>Кай<li>Борис</ul><IMG SRC=hero.png class=hero><p>Раз<p>Два<script>if (a < b) { alert(1); }</script>";
    xml.Node doc = xml.parse_html(page);
    console.writeln(doc.find_all("li").length, " ", doc.find_all("LI").length);
    console.writeln(doc.first("img").attr("src"), " ", doc.first("img").attr("class"));
    console.writeln(doc.find_all("p").length);
    console.writeln(doc.first("script").text);
    console.writeln("'", doc.first("img").attr("alt"), "' ", doc.first("img").has_attr("alt"));
    console.writeln(xml.parse_html("<p>a < b &#1071;</p>").first("p").text);
}
`, {}, { file: 'main.idyl' });
  assert(html.output === "3 3\nhero.png hero\n2\nif (a < b) { alert(1); }\n'' false\na < b Я\n",
    `lenient html scenario: ${JSON.stringify(html.output)} ${html.runtimeError ?? ''}`);

  // Битые входы — тексты и позиции дословно из спеки.
  const broken: ReadonlyArray<readonly [string, string]> = [
    ['<a><b></a>', "xml.parse_xml() invalid XML at 1:11: closing tag '</a>' does not match open tag '<b>'"],
    ['<a>текст', "xml.parse_xml() invalid XML at 1:9: tag '<a>' is never closed"],
    ['<a href=x>текст</a>', "xml.parse_xml() invalid XML at 1:9: attribute 'href' value must be quoted"],
    ['<a', "xml.parse_xml() invalid XML at 1:3: tag '<a>' is never closed"],
  ];
  for (const [source, expected] of broken) {
    await assertRuntimeFails(`
use xml;

main() {
    xml.parse_xml("${source.replace(/"/g, '\\"')}");
}
`, expected);
  }

  // first без находки — честная ошибка жанра json.Object.get.
  await assertRuntimeFails(`
use xml;

main() {
    xml.parse_xml("<item><link>a</link></item>").first("item").first("title");
}
`, 'xml node <item> has no <title> inside');

  // CDATA — сырой текст; children отдаёт только элементы.
  const cdata = await runIdyllium(`
use console;
use xml;

main() {
    xml.Node doc = xml.parse_xml("<page>до <b>жирного</b> <![CDATA[a < b & c]]></page>");
    console.writeln(doc.first("page").children.length);
    console.writeln(doc.first("page").text);
}
`, {}, { file: 'main.idyl' });
  // Чисто пробельные куски между тегами отбрасываются (канон прототипа):
  // иначе отступы разметки замусоривали бы text.
  assert(cdata.output === '1\nдо жирногоa < b & c\n', `cdata scenario: ${JSON.stringify(cdata.output)}`);

  // Строгий режим держит well-formedness: мусор не принимается молча
  // (уловы ломателей 2026-08-28).
  await assertRuntimeFails(`
use xml;

main() {
    xml.parse_xml("privet, ya ne XML");
}
`, 'text outside the root element');
  await assertRuntimeFails(`
use xml;

main() {
    xml.parse_xml("<a/><b/>");
}
`, 'XML must have exactly one root element');
  await assertRuntimeFails(`
use xml;

main() {
    xml.parse_xml("");
}
`, 'expected a root element');
  await assertRuntimeFails(`
use xml;

main() {
    xml.parse_xml("<a x=\\"1\\" x=\\"2\\"/>");
}
`, "duplicate attribute 'x'");

  // Дефолтный узел — честный пустой документ, а не голый объект: раньше
  // 'xml.Node n;' печатал 'undefined' и падал на n.tag.length языком JS.
  const blank = await runIdyllium(`
use console;
use xml;

main() {
    xml.Node n;
    console.writeln(n.tag, " ", n.tag.length, " ", n.has("a"), " ", n.children.length);
}
`, {}, { file: 'main.idyl' });
  assert(blank.output === '#document 9 false 0\n', `default xml.Node: ${JSON.stringify(blank.output)} ${blank.runtimeError ?? ''}`);

  // Глубокое дерево: разбор итеративен, и обходы тоже — text/find_all не
  // валят стек JS с советом «почините рекурсию» про функции рантайма.
  const deep = await runIdyllium(`
use console;
use xml;

main() {
    string open = "";
    string close = "";
    for (int i = 0; i < 20000; i = i + 1) {
        open = open + "<a>";
        close = close + "</a>";
    }
    xml.Node doc = xml.parse_xml(open + "яблочко" + close);
    console.writeln(doc.find_all("a").length, " ", doc.text);
}
`, {}, { file: 'main.idyl' });
  assert(deep.output === '20000 яблочко\n', `deep tree survives: ${JSON.stringify(deep.output)} ${deep.runtimeError ?? ''}`);

  // Оборванная страница (недокачанный http-ответ) не роняет прощающий режим,
  // а невалидные числовые сущности остаются литералами, не битыми символами.
  const torn = await runIdyllium(`
use console;
use xml;

main() {
    console.writeln(xml.parse_html("<p>ok<a href=\\"x").first("p").text);
    console.writeln(xml.parse_xml("<a>&#65a; &#xD800;</a>").text);
}
`, {}, { file: 'main.idyl' });
  assert(torn.output === 'ok\n&#65a; &#xD800;\n', `torn html and bad entities: ${JSON.stringify(torn.output)} ${torn.runtimeError ?? ''}`);

  // Мост курса: черепаха пишет SVG — библиотека читает собственный рисунок.
  const memoryFs = createMemoryRuntimeFileSystem({});
  const svgCompilation = compileIdyllium(`
use turtle;
use colors;
use file;
use xml;
use console;

main() {
    turtle.Turtle t;
    t.forward(100);
    t.left(90);
    t.pen_color = colors.RGB(255, 0, 0);
    t.forward(50);
    t.left(90);
    t.pen_color = colors.RGB(0, 0, 0);
    t.forward(100);
    turtle.save_svg("рисунок.svg");

    file.istream picture = file.open("рисунок.svg", "read");
    xml.Node svg = xml.parse_xml(picture.read_all());
    picture.close();
    dyn_array<xml.Node> lines = svg.find_all("line");
    int red = 0;
    for (int i = 0; i < lines.length; i = i + 1) {
        if (lines[i].attr("stroke") == "#ff0000") {
            red = red + 1;
        }
    }
    console.writeln("линий в рисунке: ", lines.length, ", красных: ", red);
}
`, { file: '/workspace/main.idyl' });
  assert(svgCompilation.success, svgCompilation.diagnosticsText);
  const svgOutput: string[] = [];
  const svgRuntime = createRuntime({
    platform: 'cli',
    fileSystem: memoryFs,
    console: { write: (text: string) => { svgOutput.push(text); } },
  });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  const svgProgram = await (new AsyncFunction(svgCompilation.jsCode!))();
  await svgProgram(svgRuntime);
  assert(svgOutput.join('') === 'линий в рисунке: 3, красных: 1\n',
    `turtle svg roundtrip: ${JSON.stringify(svgOutput)}`);
});

test('file.open append mode keeps content and creates missing files', async () => {
  const result = await runIdyllium(`
use console;
use file;

main() {
    file.ostream first = file.open("log.txt", "write");
    first.write_line("alpha");
    first.close();

    file.ostream more = file.open("log.txt", "append");
    more.write_line("beta");
    more.close();

    file.ostream fresh = file.open("brand_new.txt", "append");
    fresh.write_line("gamma");
    fresh.close();

    file.istream fin = file.open("log.txt", "read");
    console.write(fin.read_all());
    file.istream fin2 = file.open("brand_new.txt", "read");
    console.write(fin2.read_all());
}
`, { platform: 'cli', fileSystem: createMemoryRuntimeFileSystem() }, { file: '/workspace/main.idyl' });
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'alpha\nbeta\ngamma\n', `append outputs: ${JSON.stringify(result.output)}`);

  const bad = await runIdyllium(`
use file;

main() {
    file.ostream f = file.open("x.txt", "add");
}
`, { platform: 'cli', fileSystem: createMemoryRuntimeFileSystem() }, { file: '/workspace/main.idyl' });
  assert(!bad.success || bad.runtimeError !== null, 'expected bad mode failure');
  assert(
    (bad.runtimeError ?? '').includes("file.open() mode must be 'read', 'write' or 'append', got 'add'"),
    `bad mode message: ${bad.runtimeError}`,
  );
});

test('http client works over the mock network service', async () => {
  const network = createMemoryNetworkService({
    'https://example.org/guild.json': {
      status: 200,
      body: '{"name":"Ночная стража","members":3}',
      headers: { 'Content-Type': 'application/json' },
    },
    'https://example.org/missing': { status: 404, body: 'not here' },
    'https://slow.example.org/': { fail: 'timeout' },
    'https://cors.example.org/': { fail: 'blocked' },
    'https://down.example.org/': { fail: 'unreachable' },
  });

  const ok = await runIdyllium(`
use console;
use http;
use json;

main() {
    http.Response r = http.get("https://example.org/guild.json");
    console.writeln(r.status, " ", r.ok, " ", r.header("content-type"));
    json.Object guild = json.parse(r.text).to_object();
    console.writeln(guild.get("name").to_string(), " ", guild.get("members").to_int());

    http.Response miss = http.get("https://example.org/missing");
    console.writeln(miss.status, " ", miss.ok, " [", miss.text, "]");

    http.set_timeout(30);
    http.Response posted = http.post("https://example.org/guild.json", "{\\"vote\\": 1}");
    console.writeln("post: ", posted.status);
}
`, { platform: 'cli', networkService: network }, { file: 'main.idyl' });
  assert(ok.success, ok.runtimeError ?? ok.compilation.diagnosticsText);
  assert(
    ok.output === '200 true application/json\nНочная стража 3\n404 false [not here]\npost: 200\n',
    `http outputs: ${JSON.stringify(ok.output)}`,
  );
  const posted = network.requests[network.requests.length - 1];
  assert(posted.method === 'POST' && posted.timeoutMs === 30000 && posted.body === '{"vote": 1}',
    `recorded post: ${JSON.stringify(posted)}`);

  const failing: Array<[string, string]> = [
    ['https://slow.example.org/', "http.get() timed out after 10 seconds for 'https://slow.example.org/'"],
    ['https://cors.example.org/', "http.get() was blocked by the browser for 'https://cors.example.org/': the site does not allow browser requests (CORS) — this address works in console runs"],
    ['https://down.example.org/', "http.get() cannot reach 'https://down.example.org/': connection refused"],
  ];
  for (const [address, expected] of failing) {
    const result = await runIdyllium(`
use http;

main() {
    http.Response r = http.get("${address}");
}
`, { platform: 'cli', networkService: network }, { file: 'main.idyl' });
    assert((result.runtimeError ?? '').includes(expected), `for ${address}: ${result.runtimeError}`);
  }

  const badScheme = await runIdyllium(`
use http;

main() {
    http.Response r = http.get("ftp://old.example.org/");
}
`, { platform: 'cli', networkService: network }, { file: 'main.idyl' });
  assert(
    (badScheme.runtimeError ?? '').includes("http.get() supports only http and https addresses, got 'ftp'"),
    `bad scheme: ${badScheme.runtimeError}`,
  );

  const badTimeout = await runIdyllium(`
use http;

main() {
    http.set_timeout(500);
}
`, { platform: 'cli', networkService: network }, { file: 'main.idyl' });
  assert(
    (badTimeout.runtimeError ?? '').includes('http.set_timeout() expects seconds from 1 to 300, got 500'),
    `bad timeout: ${badTimeout.runtimeError}`,
  );
});

test('channel posts talk over one bus and self-mail never arrives', async () => {
  const bus = createMemoryChannelBus();

  async function startProgram(source: string, write: (text: string) => void) {
    const compilation = compileIdyllium(source, { file: '/main.idyl' });
    assert(compilation.diagnostics.length === 0, compilation.diagnosticsText);
    const runtime = createRuntime({ channelService: bus.service(), console: { write } });
    const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
    const program = await (new AsyncFunction(compilation.jsCode))();
    await program(runtime);
    return runtime;
  }

  let outListener = '';
  const listener = await startProgram(`use channel;
use console;

void function on_letter(string text) {
    console.writeln("Пришло: ", text);
}

main() {
    channel.Post office;
    office.open("комната-101");
    office.on_message = on_letter;
}
`, (text) => { outListener += text; });

  let outSender = '';
  const sender = await startProgram(`use channel;
use console;

void function echo(string text) {
    console.writeln("СЕБЕ: ", text);
}

main() {
    channel.Post office;
    office.open("комната-101");
    office.on_message = echo;
    office.send("Привет из первой вкладки!");
    office.send("Второе письмо");
    office.close();
    console.writeln("готово, is_open=", office.is_open);
}
`, (text) => { outSender += text; });

  // Открытый канал держит программу живой; закрытый — отпускает.
  assert(listener.hasGui() === true, 'open channel must keep the listener alive');
  assert(listener.hasOpenChannels() === true, 'listener reports open channels');
  assert(sender.hasGui() === false, 'closed channel must release the sender');

  // Почта доставляется в GUI-такте — как клики и таймеры.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await listener.stepGui(0);
  await sender.stepGui(0);

  assert(
    outListener === 'Пришло: Привет из первой вкладки!\nПришло: Второе письмо\n',
    `listener mail: ${JSON.stringify(outListener)}`,
  );
  assert(outSender === 'готово, is_open=false\n', `self-mail must not arrive: ${JSON.stringify(outSender)}`);

  // Без сервиса (CLI) — честный отказ с подсказкой.
  const refusal = await runIdyllium(`use channel;

main() {
    channel.Post office;
    office.open("x");
}
`, {}, { file: '/main.idyl' });
  assert(refusal.success === false, 'CLI open must refuse');
  assert(
    (refusal.runtimeError ?? '').includes('Post.open() is not available in the console host — run the program in the Web IDE or VS Code'),
    `CLI refusal text: ${refusal.runtimeError}`,
  );

  // send до open — читаемая ошибка.
  const early = await runIdyllium(`use channel;

main() {
    channel.Post office;
    office.send("рано");
}
`, {}, { file: '/main.idyl' });
  assert(
    (early.runtimeError ?? '').includes("Post.send() the post is not open — call open(name) first"),
    `early send text: ${early.runtimeError}`,
  );
});

test('web server serves routes, statics and survives handler crashes', async () => {
  const nodeNet: any = require('net');
  const serverCode = `use web;
use console;

void function hello(web.Request req, web.Response res) {
    res.send("Привет, " + req.query("name") + "!");
}

void function api(web.Request req, web.Response res) {
    res.send_json("{\\"players\\": 3}");
}

void function echo(web.Request req, web.Response res) {
    res.status = 201;
    res.send("тело: " + req.body);
}

void function broken(web.Request req, web.Response res) {
    int zero = 0;
    res.send(to_string(1 / zero));
}

main() {
    web.Server app;
    app.on_get("/hello", hello);
    app.on_get("/api", api);
    app.on_post("/echo", echo);
    app.on_get("/broken", broken);
    app.serve_directory("public");
    app.port = 0;
    app.run();
}
`;
  const fileSystem = createMemoryRuntimeFileSystem({
    '/workspace/main.idyl': serverCode,
    '/workspace/public/index.html': '<h1>Гильдия онлайн</h1>',
    '/workspace/secret.txt': 'СЕКРЕТ',
  }, '/workspace');
  const controller = new AbortController();
  let output = '';
  const finished = runIdyllium(serverCode, {
    abortSignal: controller.signal,
    fileSystem,
    console: { write: (text) => { output += text; } },
  }, { file: '/workspace/main.idyl' });

  for (let i = 0; i < 200 && !/Сервер слушает/.test(output); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const portMatch = output.match(/:(\d+)/);
  assert(portMatch !== null, `server banner missing: ${JSON.stringify(output)}`);
  const port = Number(portMatch![1]);

  const base = `http://127.0.0.1:${port}`;
  const get = async (path: string) => {
    const reply = await fetch(base + path);
    return { status: reply.status, text: await reply.text(), type: reply.headers.get('content-type') ?? '' };
  };

  const hello = await get('/hello?name=%D0%9C%D0%B8%D1%80%D0%B0');
  assert(hello.status === 200 && hello.text === 'Привет, Мира!' && hello.type.includes('text/html'), `hello: ${hello.status} ${hello.text}`);

  const api = await get('/api');
  assert(api.type.includes('application/json') && api.text === '{"players": 3}', `api: ${api.text} ${api.type}`);

  const posted = await fetch(base + '/echo', { method: 'POST', body: 'привет' });
  assert(posted.status === 201 && (await posted.text()) === 'тело: привет', 'post echo with res.status');

  const missing = await get('/ghost');
  assert(missing.status === 404 && missing.text.includes("not found: '/ghost'"), `404: ${missing.text}`);

  const wrongMethod = await fetch(base + '/hello', { method: 'POST', body: 'x' });
  assert(wrongMethod.status === 405 && (await wrongMethod.text()).includes("method POST is not allowed for '/hello'"), '405 on GET route');

  const index = await get('/');
  assert(index.status === 200 && index.text.includes('Гильдия онлайн'), 'static index.html');

  // Path traversal: сырым сокетом, чтобы клиент не нормализовал путь.
  const rawRequest = (rawPath: string) => new Promise<string>((resolve) => {
    const socket = nodeNet.connect(port, '127.0.0.1', () => {
      socket.write(`GET ${rawPath} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.on('data', (chunk: unknown) => { data += String(chunk); });
    socket.on('close', () => resolve(data));
  });
  for (const rawPath of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2Fsecret.txt']) {
    const reply = await rawRequest(rawPath);
    assert(!reply.includes('СЕКРЕТ'), `path traversal leaked via ${rawPath}`);
  }

  // Авария обработчика — пятисотка без падения сервера.
  const crashed = await get('/broken');
  assert(crashed.status === 500 && crashed.text.includes('division by zero'), `crash: ${crashed.status} ${crashed.text}`);
  const alive = await get('/hello?name=X');
  assert(alive.text === 'Привет, X!', 'server must survive a handler crash');
  assert(output.includes('[web] запрос GET /broken упал'), 'crash must be logged to the console');

  // Занятый порт — читаемая ошибка второй программы.
  const busy = await runIdyllium(`use web;

void function noop(web.Request req, web.Response res) {
    res.send("x");
}

main() {
    web.Server app;
    app.on_get("/", noop);
    app.port = ${port};
    app.run();
}
`, {}, { file: '/main.idyl' });
  assert(
    (busy.runtimeError ?? '').includes(`web.Server.run() port ${port} is already in use — choose another port or stop the other program`),
    `busy port: ${busy.runtimeError}`,
  );

  // Stop гасит вечный run() и освобождает порт.
  controller.abort();
  const result = await finished;
  assert(result.success === false && (result.runtimeError ?? '').includes('program was stopped'), 'Stop must end run()');

  // Web IDE (сервис без listen) — честный отказ с подсказкой.
  const refusal = await runIdyllium(`use web;

main() {
    web.Server app;
    app.run();
}
`, { platform: 'web', networkService: createMemoryNetworkService() }, { file: '/main.idyl' });
  assert(
    (refusal.runtimeError ?? '').includes('web.Server.run() is not available in the Web IDE — run the program in VS Code'),
    `web refusal: ${refusal.runtimeError}`,
  );
});

// Flask-пакет 1.5.1: шаблоны + параметры пути + формы + redirect.

test('web templates, path parameters, forms and redirect work end to end', async () => {
  const serverCode = `use web;
use json;

void function page(web.Request req, web.Response res) {
    json.Object guest;
    guest.add("name", json.Value("Мира <b>жирная</b>"));

    json.Array items;
    json.Object one;
    one.add("label", json.Value("щит & плащ"));
    items.add(one);

    json.Object values;
    values.add("title", json.Value("Гильдия"));
    values.add("guest", guest);
    values.add("items", items);
    values.add("vip", json.Value(true));
    res.send_template("templates/page.html", values);
}

void function ghost(web.Request req, web.Response res) {
    res.send_template("templates/нет-такого.html");
}

void function card(web.Request req, web.Response res) {
    res.send("карточка " + req.param("id") + "|" + req.param("нет"));
}

void function fresh(web.Request req, web.Response res) {
    res.send("точный путь победил");
}

void function add(web.Request req, web.Response res) {
    res.send("author=[" + req.form("author") + "] text=[" + req.form("text") + "] нет=[" + req.form("нет") + "] сыр=[" + req.form("сыр") + "]");
}

void function done(web.Request req, web.Response res) {
    res.redirect("/");
}

void function cyr(web.Request req, web.Response res) {
    res.redirect("/привет");
}

void function status_after(web.Request req, web.Response res) {
    res.redirect("/next");
    res.status = 302;
}

void function deep(web.Request req, web.Response res) {
    json.Object values;
    values.add("flag", json.Value(true));
    res.send_template("templates/deep.html", values);
}

void function badtoken(web.Request req, web.Response res) {
    res.send_template("templates/badtoken.html");
}

main() {
    web.Server app;
    app.on_get("/", page);
    app.on_get("/ghost", ghost);
    app.on_get("/post/<id>", card);
    app.on_get("/post/new", fresh);
    app.on_post("/add", add);
    app.on_post("/done", done);
    app.on_get("/cyr", cyr);
    app.on_get("/status-after", status_after);
    app.on_get("/deep", deep);
    app.on_get("/badtoken", badtoken);
    app.port = 0;
    app.run();
}
`;
  const deepTemplate = `${'{% if flag %}'.repeat(40)}X${'{% endif %}'.repeat(40)}`;
  const fileSystem = createMemoryRuntimeFileSystem({
    '/workspace/main.idyl': serverCode,
    '/workspace/templates/page.html': [
      '<h1>{{title}}</h1>',
      '<p>{{guest.name}}</p>',
      '{% for item in items %}<li>{{item.label}}</li>{% endfor %}',
      '{% if vip %}VIP{% else %}гость{% endif %}',
      '{{дыра}}|{{title.name}}|{{guest}}|{{items}}|{% wat %}',
    ].join('\n'),
    '/workspace/templates/deep.html': deepTemplate,
    '/workspace/templates/badtoken.html': 'X{{a<b}}Y',
  }, '/workspace');
  const controller = new AbortController();
  let output = '';
  const finished = runIdyllium(serverCode, {
    abortSignal: controller.signal,
    fileSystem,
    console: { write: (text) => { output += text; } },
  }, { file: '/workspace/main.idyl' });

  for (let i = 0; i < 200 && !/Сервер слушает/.test(output); i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const portMatch = output.match(/:(\d+)/);
  assert(portMatch !== null, `server banner missing: ${JSON.stringify(output)}`);
  const base = `http://127.0.0.1:${Number(portMatch![1])}`;

  // Шаблон: подстановки экранируются, for/if живые, ошибки — маркерами в страницу.
  const page = await fetch(`${base}/`);
  const pageText = await page.text();
  assert((page.headers.get('content-type') ?? '').includes('text/html'), 'template page must be text/html');
  assert(pageText.includes('<h1>Гильдия</h1>'), `template heading: ${pageText}`);
  assert(pageText.includes('<p>Мира &lt;b&gt;жирная&lt;/b&gt;</p>'), `substitution must be escaped: ${pageText}`);
  assert(pageText.includes('<li>щит &amp; плащ</li>'), `loop with escaping: ${pageText}`);
  assert(pageText.includes('VIP') && !pageText.includes('гость'), `if branch: ${pageText}`);
  for (const marker of [
    "[[ нет значения 'дыра' ]]",
    "[[ 'title' — не объект ]]",
    "[[ 'guest' — объект: подставьте его поле через точку ]]",
    "[[ 'items' — список: нужен {% for %} ]]",
    "[[ неизвестная команда '{% wat %}' ]]",
  ]) {
    assert(pageText.includes(marker), `template marker missing: ${marker} in ${pageText}`);
  }

  // Пропавший файл шаблона — авария обработчика с канон-текстом, сервер жив.
  const ghost = await fetch(`${base}/ghost`);
  const ghostText = await ghost.text();
  assert(ghost.status === 500 && ghostText.includes("web.Response.send_template() cannot read 'templates/нет-такого.html': file does not exist"), `ghost template: ${ghostText}`);

  // Параметры пути: значение строкой, отсутствующее имя — пустая строка.
  const card = await fetch(`${base}/post/3`);
  assert((await card.text()) === 'карточка 3|', 'path parameter value');
  const cyrillic = await fetch(`${base}/post/%D0%9C%D0%B8%D1%80%D0%B0`);
  assert((await cyrillic.text()) === 'карточка Мира|', 'cyrillic path parameter');
  const exact = await fetch(`${base}/post/new`);
  assert((await exact.text()) === 'точный путь победил', 'exact path must beat the parameter route');
  const wrongMethod = await fetch(`${base}/post/3`, { method: 'POST', body: 'x' });
  assert(wrongMethod.status === 405, 'parameter route must participate in 405');

  // Формы: процентный суп и плюсы разобраны, нет поля — "", мусорные проценты не роняют.
  const form = await fetch(`${base}/add`, {
    method: 'POST',
    body: 'author=%D0%9C%D0%B8%D1%80%D0%B0&text=%D0%9F%D0%BE%D1%81%D0%BE%D1%85+%D0%BD%D0%B0%D1%88%D1%91%D0%BB%D1%81%D1%8F%21&%D1%81%D1%8B%D1%80=%ZZ',
  });
  assert((await form.text()) === 'author=[Мира] text=[Посох нашёлся!] нет=[] сыр=[%ZZ]', 'req.form parsing');

  // Redirect: жёсткое 303 + Location.
  const redirected = await fetch(`${base}/done`, { method: 'POST', body: '', redirect: 'manual' });
  assert(redirected.status === 303 && redirected.headers.get('location') === '/', `redirect: ${redirected.status} ${redirected.headers.get('location')}`);

  // Находки ломателей (2026-08-22): кириллица в Location кодируется, статус
  // после redirect закрыт, '//x' и битые проценты не дают сырых пятисоток.
  const cyrillicRedirect = await fetch(`${base}/cyr`, { redirect: 'manual' });
  assert(
    cyrillicRedirect.status === 303 && cyrillicRedirect.headers.get('location') === '/%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82',
    `cyrillic redirect: ${cyrillicRedirect.status} ${cyrillicRedirect.headers.get('location')}`,
  );
  const statusAfter = await fetch(`${base}/status-after`);
  assert(
    statusAfter.status === 500 && (await statusAfter.text()).includes('web.Response.status cannot be changed after redirect() — redirect always answers 303'),
    'status after redirect must be a readable error',
  );
  const doubleSlash = await fetch(`${base.replace(/\/$/, '')}//post/3`);
  const doubleSlashText = await doubleSlash.text();
  assert(doubleSlash.status === 404 && doubleSlashText.includes("not found: '//post/3'"), `//path must 404 literally: ${doubleSlash.status} ${doubleSlashText}`);
  const badPercent = await fetch(`${base}/nowhere/%zz`).catch(() => null);
  if (badPercent !== null) {
    assert(badPercent.status === 404 && !(await badPercent.text()).includes('internal server error'), 'broken percent must not 500');
  }

  // Глубокая вложенность шаблона — читаемый маркер, не сырой V8-текст.
  const deep = await fetch(`${base}/deep`);
  const deepText = await deep.text();
  assert(deep.status === 200 && deepText.includes('шаблон вложен глубже 32 уровней'), `deep nesting marker: ${deep.status} ${deepText.slice(0, 200)}`);
  assert(!deepText.includes('Maximum call stack'), 'raw V8 stack error leaked');
  // Маркер с '<' в токене экранирован — диагностика видна в браузере целиком.
  const badToken = await fetch(`${base}/badtoken`);
  const badTokenText = await badToken.text();
  assert(badTokenText.includes("[[ непонятная подстановка '{{a&lt;b}}' ]]"), `marker escaping: ${badTokenText}`);

  controller.abort();
  await finished;

  // Конфликт двух шаблонных маршрутов одной формы — читаемая ошибка.
  const conflict = await runIdyllium(`use web;

void function noop(web.Request req, web.Response res) {
    res.send("x");
}

main() {
    web.Server app;
    app.on_get("/x/<a>", noop);
    app.on_get("/x/<b>", noop);
    app.run();
}
`, {}, { file: '/main.idyl' });
  assert(
    (conflict.runtimeError ?? '').includes("web.Server.on_get() route '/x/<b>' conflicts with already registered '/x/<a>'"),
    `route conflict: ${conflict.runtimeError}`,
  );

  // Параметр обязан занимать сегмент целиком.
  const halfSegment = await runIdyllium(`use web;

void function noop(web.Request req, web.Response res) {
    res.send("x");
}

main() {
    web.Server app;
    app.on_get("/x/id<n>", noop);
    app.run();
}
`, {}, { file: '/main.idyl' });
  assert(
    (halfSegment.runtimeError ?? '').includes("path parameter must occupy a whole segment between '/', like '/post/<id>', got 'id<n>' in '/x/id<n>'"),
    `half segment: ${halfSegment.runtimeError}`,
  );
});

test('audio checks the file content, and the server port is checked when set', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-audio-'));
  fs.writeFileSync(path.join(dir, 'notaudio.txt'), 'это просто текст, а не звук', 'utf8');
  fs.copyFileSync(path.join(process.cwd(), 'packages/docs/book-assets/click.wav'), path.join(dir, 'click.wav'));
  // То же содержимое под именем .wav: формат решает содержимое, а не расширение.
  fs.writeFileSync(path.join(dir, 'fake.wav'), 'это просто текст, а не звук', 'utf8');

  for (const name of ['notaudio.txt', 'fake.wav']) {
    const refused = await runIdyllium(`use audio;
main() {
    audio.Sound s;
    s.load_from_file("${name}");
}
`, {}, { file: path.join(dir, 'main.idyl') });
    assert(
      (refused.runtimeError ?? '').includes(`cannot decode '${name}': unsupported audio format`),
      `a non-audio file must be refused: ${refused.runtimeError}`,
    );
  }

  const loaded = await runIdyllium(`use console;
use audio;
main() {
    audio.Sound s;
    s.load_from_file("click.wav");
    console.writeln(s.duration > 0);
}
`, {}, { file: path.join(dir, 'main.idyl') });
  assert(loaded.output === 'true\n', `a real wav must still load: ${JSON.stringify(loaded.output)} ${loaded.runtimeError}`);

  await assertRuntimeFails(`use web;
main() {
    web.Server app;
    app.port = 99999;
}
`, "web.Server.port must be an integer from 0 to 65535, got '99999'");

  const ports = await runIdyllium(`use console;
use web;
main() {
    web.Server app;
    console.writeln(app.port);
    app.port = 8099;
    console.writeln(app.port);
    app.port = 0;
    console.writeln(app.port);
}
`, {}, { file: 'main.idyl' });
  assert(ports.output === '8080\n8099\n0\n', `legal ports must stay legal: ${JSON.stringify(ports.output)} ${ports.runtimeError}`);
});

// Пополнение IdySS (вердикты владельца, spec/some_idyss_growth): словарь вырос
// с 14 свойств до 44. Держим и грамматику значений, и границы диапазонов.

test('blank sqlite objects tell blank from closed', async () => {
  const blank = await runIdyllium(`use console;
use sqlite;
main() {
    sqlite.Result r;
    console.writeln(r.has_rows, " ", r.affected_rows, " ", r.column_count(), " ", r.next());
}
`, {}, { file: 'main.idyl' });
  assert(blank.output === 'false 0 0 false\n', `a blank result is an empty one: ${JSON.stringify(blank.output)} ${blank.runtimeError ?? blank.compilation.diagnosticsText}`);

  await assertRuntimeFails(`use sqlite;
main() {
    sqlite.Database db;
    db.execute("SELECT 1");
}
`, 'this sqlite.Database is a blank one — open a file with sqlite.open("name.db") first');

  await assertRuntimeFails(`use sqlite;
main() {
    sqlite.Statement st;
    st.execute();
}
`, 'this sqlite.Statement is a blank one — get one from db.prepare("SQL") first');
});

// Предупреждения (вердикты владельца 2026-08-28): код, который делает НИЧЕГО,
// не наказывается — о нём предупреждают; ошибка — только нарушение конвенций.
// Метки симметричны: compile warning / runtime warning. Код возврата не меняют.

test('has_rows tells whether a row actually came back', async () => {
  // Своя папка на прогон: файл базы не должен переживать тест и мешать следующему.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-sqlite-'));
  const result = await runIdyllium(`use console;
use sqlite;

main() {
    sqlite.Database db = sqlite.open("probe.db");
    db.execute("CREATE TABLE heroes (name TEXT, level INTEGER)");

    sqlite.Statement st = db.prepare("INSERT INTO heroes (name, level) VALUES (:n, :l)");
    st.bind_string("n", "Мира");
    st.bind_int("l", 5);
    st.execute();
    st.close();

    sqlite.Result empty = db.execute("SELECT name FROM heroes WHERE level > 100");
    sqlite.Result some = db.execute("SELECT name FROM heroes");
    sqlite.Result upd = db.execute("DELETE FROM heroes WHERE level > 100");
    console.writeln(empty.has_rows, " ", some.has_rows, " ", upd.has_rows);

    if (empty.has_rows) {
        console.writeln("нашли");
    } else {
        console.writeln("никого нет");
    }

    // Чтение has_rows не сдвигает курсор: next() начинает с первой строки.
    while (some.next()) {
        console.writeln("строка: ", some.get_string("name"));
    }
    db.close();
}
`, {}, { file: path.join(dir, 'main.idyl') });
  assert(
    result.output === 'false true false\nникого нет\nстрока: Мира\n',
    `has_rows must answer its own question: ${JSON.stringify(result.output)} ${result.runtimeError ?? result.compilation.diagnosticsText}`,
  );
});

// O38 (методисты, 2026-08-23): поиск члена в типе из НЕПОДКЛЮЧЁННОГО модуля
// проваливался с «нет такого члена» — а член там есть. Ловушка коварна тем,
// что имя модуля в программе может не встречаться вовсе: тип приезжает по
// цепочке точек из чужого класса, и аккуратный ученик уберёт «лишний» use.

test('to_int and get_int keep precision beyond 64 bits', async () => {
  const result = await runIdyllium(`use console;

main() {
    int big = 1267650600228229401496703205376;
    console.writeln(to_int(to_string(big)) == big);
    console.writeln(to_int("123456789123456789123456789") + 1);
    console.writeln(to_int("+42"), " ", to_int("-17"), " ", to_int(" 5 "));
}
`, {}, { file: 'main.idyl' });
  assert(
    result.output === 'true\n123456789123456789123456790\n42 -17 5\n',
    `big int round-trip is off: ${JSON.stringify(result.output)}`,
  );
});

// Статические поля и класс-константы (вердикты владельца, 2026-08-22).

test('float overflow and library big-int boundaries are honest', async () => {
  const infinity = await runIdyllium(`use console;
main() {
    int astro = to_int("1${'0'.repeat(400)}");
    float share = astro / 3.0;
    console.writeln(share);
}
`, {}, { file: 'main.idyl' });
  assert(
    (infinity.runtimeError ?? '').includes("operator '/' result is outside the float range"),
    `Infinity must not leak: ${infinity.runtimeError} / ${JSON.stringify(infinity.output)}`,
  );

  const jsonBig = await runIdyllium(`use console;
use json;
main() {
    json.Value v = json.Value(1267650600228229401496703205376);
    json.Value back = json.parse(v.to_json());
    console.writeln(back.to_int() + 1);
}
`, {}, { file: 'main.idyl' });
  assert(jsonBig.output === '1267650600228229401496703205377\n', `json to_int uncapped: ${JSON.stringify(jsonBig.output)}`);

  const seed = await runIdyllium(`use random;
main() { random.set_seed(123456789012345678901234567890); }
`, {}, { file: 'main.idyl' });
  assert(
    (seed.runtimeError ?? '').includes('random.set_seed() seed must be between 0 and 9007199254740991, got 123456789012345678901234567890'),
    `seed wording: ${seed.runtimeError}`,
  );
});

test('float stays double: integer promotion is an int privilege', async () => {
  // Находка методистов 2026-08-29: float-значение, ставшее целым по величине,
  // утекало в точную BigInt-арифметику и печатало 401-значную «простыню»
  // вместо честного переполнения. Статический тип из кодогена держит float
  // в double на операциях и на всех границах записи (объявление, параметр).
  const overflow = await runIdyllium(`use console;
main() {
    float a = 1.0;
    for (int i = 1; i <= 400; i = i + 1) {
        a = a * 10.0;
    }
    console.writeln(a);
}
`, {}, { file: 'main.idyl' });
  assert(
    (overflow.runtimeError ?? '').includes("operator '*' result is outside the float range"),
    `float multiplication must overflow honestly: ${overflow.runtimeError} / ${JSON.stringify(overflow.output).slice(0, 80)}`,
  );

  const boundary = await runIdyllium(`use console;
float function half(float x) {
    return x / 2.0;
}
main() {
    int big = to_int("1${'0'.repeat(100)}");
    float f = big;
    console.writeln(f);
    console.writeln(f * 2.0);
    console.writeln(big * 10);
    int astro = to_int("1${'0'.repeat(400)}");
    console.writeln(half(astro));
}
`, {}, { file: 'main.idyl' });
  assert(
    boundary.output === `1e+100\n2e+100\n1${'0'.repeat(101)}\n`,
    `float boundary must round to double while int stays exact: ${JSON.stringify(boundary.output)}`,
  );
  assert(
    (boundary.runtimeError ?? '').includes("value is outside the 'float' range"),
    `oversized int must not squeeze into a float parameter: ${boundary.runtimeError}`,
  );

  // Ячейки types живут по машинным правилам: большой int — это число (а не
  // «got '10000000000000000'», как отказывал старый typeof-гард), значение за
  // разрядностью — честный IEEE-inf-паттерн, как и при сдвиге битов.
  const typesFloat = await runIdyllium(`use console;
use types;
main() {
    int big = to_int("1${'0'.repeat(16)}");
    types.float64 x = big;
    console.writeln(x);
    types.float32 y = 340000000000000000000000000000000000000.0;
    types.float32 z = y * 100.0;
    console.writeln(z.to_bin());
}
`, {}, { file: 'main.idyl' });
  assert(
    typesFloat.output === `10000000000000000\n0${'1'.repeat(8)}${'0'.repeat(23)}\n`,
    `types floats must accept big integers and overflow into the IEEE infinity pattern: ${JSON.stringify(typesFloat.output)} / ${typesFloat.runtimeError}`,
  );

  // Хвосты float-канона (2026-08-29): IEEE-значения из ячеек types печатаются
  // словами C-мира, арифметика языка отказывает им тоже словами, а агрегат
  // от float-гигантов возвращается в double вместо точной «простыни».
  const nonFiniteWords = await runIdyllium(`use console;
use types;
main() {
    types.float32 y = 340000000000000000000000000000000000000.0;
    types.float32 z = y * 100.0;
    console.writeln(z);
    console.writeln(to_string(0.0 - 1.0), " — минус живёт");
    console.writeln(types.from_bin("0${'1'.repeat(12)}${'0'.repeat(51)}", "float64"));
}
`, {}, { file: 'main.idyl' });
  assert(
    nonFiniteWords.output === 'inf\n-1 — минус живёт\nnan\n',
    `non-finite cells must print inf/nan words: ${JSON.stringify(nonFiniteWords.output)} / ${nonFiniteWords.runtimeError}`,
  );

  const infiniteOperand = await runIdyllium(`use console;
use types;
main() {
    types.float32 y = 340000000000000000000000000000000000000.0;
    types.float32 z = y * 100.0;
    console.writeln(1.0 + z);
}
`, {}, { file: 'main.idyl' });
  assert(
    (infiniteOperand.runtimeError ?? '').includes("must be a finite number, got 'inf'"),
    `infinite operand must be named with the printing word: ${infiniteOperand.runtimeError}`,
  );

  const aggregateGiant = await runIdyllium(`use console;
main() {
    dyn_array<float> xs;
    xs.add(1${'0'.repeat(300)}.0);
    console.writeln(sum(xs) + sum(xs));
}
`, {}, { file: 'main.idyl' });
  assert(
    aggregateGiant.output === '2e+300\n',
    `float aggregate must stay double instead of exact giants: ${JSON.stringify(aggregateGiant.output)} / ${aggregateGiant.runtimeError}`,
  );
});

test('set_seed scrambles the seed: neighbouring seeds land on different faces', async () => {
  // Находка методистов 2026-08-22: голый LCG делал первый бросок линейной
  // функцией сида — create_int(1,6) давал 2 для ВСЕХ сидов 0–250, а
  // set_seed(time.now().unix) почти не менял грань между запусками.
  const result = await runIdyllium(`use console;
use random;

main() {
    array<int, 6> counts = [0, 0, 0, 0, 0, 0];
    for (int seed = 0; seed <= 250; seed = seed + 1) {
        random.set_seed(seed);
        int roll = random.create_int(1, 6);
        counts[roll - 1] = counts[roll - 1] + 1;
    }
    int faces = 0;
    for (int i = 0; i < 6; i = i + 1) {
        if (counts[i] > 0) {
            faces = faces + 1;
        }
    }
    console.writeln(faces);
}
`, {}, { file: 'main.idyl' });
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    Number(result.output.trim()) === 6,
    `seeds 0..250 must cover all six faces, got faces=${result.output.trim()}`,
  );
});

void runTests();

test('sqlite enforces foreign keys from open and honors a manual OFF across writes', async () => {
  // Вердикт владельца 2026-08-29 (вопрос методистов): PRAGMA foreign_keys
  // включается на открытии; sql.js внутри export() пересоздаёт соединение,
  // поэтому адаптер восстанавливает ФАКТИЧЕСКОЕ значение прагмы — явный
  // OFF ученика переживает записи на диск.
  const memory = await runWithMemoryFiles(`use console;
use sqlite;

main() {
    sqlite.Database db = sqlite.open("fk.db");
    db.execute("CREATE TABLE guilds (id INTEGER PRIMARY KEY, title TEXT)");
    db.execute("CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT, guild_id INTEGER, FOREIGN KEY (guild_id) REFERENCES guilds(id))");
    sqlite.Result pr = db.execute("PRAGMA foreign_keys;");
    while (pr.next()) {
        console.writeln("pragma: ", pr.get_int("foreign_keys"));
    }
    try {
        db.execute("INSERT INTO players (name, guild_id) VALUES ('Фантом', 999)");
    } catch (e) {
        console.writeln("сирота: отказ");
    }
    db.execute("PRAGMA foreign_keys = OFF;");
    db.execute("INSERT INTO players (name, guild_id) VALUES ('Фантом-1', 999)");
    db.execute("INSERT INTO players (name, guild_id) VALUES ('Фантом-2', 999)");
    console.writeln("под OFF вошли двое");
    db.execute("PRAGMA foreign_keys = ON;");
    try {
        db.execute("INSERT INTO players (name, guild_id) VALUES ('Фантом-3', 999)");
    } catch (e) {
        console.writeln("после ON: снова отказ");
    }
}
`, {});
  const fkOutput = memory.runtime.getOutput();
  assert(
    fkOutput === 'pragma: 1\nсирота: отказ\nпод OFF вошли двое\nпосле ON: снова отказ\n',
    `foreign keys lifecycle is off: ${JSON.stringify(fkOutput)}`,
  );
});

test('random.shuffle returns a same-typed copy, follows the seed and warns when dropped', async () => {
  // Вердикты владельца 2026-08-29 (спека some_random_shuffle): вариант А —
  // одна функция-копия; имя shuffle; реестровый флажок resultMustBeUsed.
  const scene = await runIdyllium(`use console;
use random;

main() {
    random.set_seed(42);
    dyn_array<int> xs;
    xs.add(1); xs.add(2); xs.add(3); xs.add(4); xs.add(5);
    dyn_array<int> mixed = random.shuffle(xs);
    console.writeln(xs);
    console.writeln(mixed);
    array<string, 3> deck = ["туз", "король", "дама"];
    console.writeln(random.shuffle(deck));
    console.writeln(random.shuffle("привет"));
    console.writeln(random.shuffle("🙂аб").length);
    console.writeln(random.shuffle(""), "<пусто>");
    random.set_seed(42);
    console.writeln(random.shuffle(xs));
}
`, {}, { file: 'main.idyl' });
  const lines = scene.output.split('\n');
  assert(lines[0] === '[1, 2, 3, 4, 5]', `original must stay intact: ${lines[0]}`);
  assert(lines[1] === '[1, 5, 3, 2, 4]', `seeded order drifted: ${lines[1]}`);
  assert(lines[2] === '["дама", "король", "туз"]', `fixed array shuffle drifted: ${lines[2]}`);
  assert(lines[3] === 'иптевр', `string shuffle drifted: ${lines[3]}`);
  assert(lines[4] === '4', `surrogate pair must survive shuffling (length in UTF-16 units): ${lines[4]}`);
  assert(lines[5] === '<пусто>', `empty string must pass through: ${lines[5]}`);
  assert(lines[6] === lines[1], `same seed must reproduce the same order: ${lines[6]} vs ${lines[1]}`);

  // Соло-вызов — предупреждение (копия выброшена); библиотека в целом
  // результат ронять вправе — на db.execute голоса нет.
  const dropped = compileIdyllium([
    'use random;',
    '',
    'main() {',
    '    dyn_array<int> xs;',
    '    xs.add(1);',
    '    random.shuffle(xs);',
    '}',
  ].join('\n'));
  assert(dropped.success, dropped.diagnosticsText);
  assert(
    dropped.diagnosticsText.includes("the value returned by 'random.shuffle' is not used"),
    `dropped shuffle must warn: ${dropped.diagnosticsText}`,
  );

  // Тип результата равен типу аргумента — приписать не туда нельзя.
  assertFails(`
use random;

main() {
    dyn_array<int> xs;
    xs.add(1);
    int bad = random.shuffle(xs);
}
`, "cannot assign 'dyn_array<int>' value to 'int' variable");
});

test('math integer helpers are exact and refuse out-of-range arguments', async () => {
  // 1.5.6, карточка 3.1 спеки some_libraries: gcd/lcm/factorial/is_prime/
  // divisors/sign/hypot. Канон бесконечного int — 100! целиком, gcd гигантов.
  const scene = await runIdyllium(`use console;
use math;

main() {
    console.writeln(math.gcd(12, 18), " ", math.gcd(-12, 18), " ", math.gcd(0, 0), " ", math.gcd(0, 7));
    console.writeln(math.lcm(4, 6), " ", math.lcm(0, 5), " ", math.lcm(-3, 7));
    console.writeln(math.factorial(0), " ", math.factorial(5), " ", math.factorial(25));
    console.writeln(math.factorial(100));
    console.writeln(math.is_prime(2), " ", math.is_prime(1), " ", math.is_prime(0), " ", math.is_prime(-7), " ", math.is_prime(97), " ", math.is_prime(1000000007), " ", math.is_prime(1000000008));
    console.writeln(math.is_prime(2305843009213693951), " ", math.is_prime(2305843009213693953));
    console.writeln(math.divisors(12), " ", math.divisors(1), " ", math.divisors(97), " ", math.divisors(36));
    console.writeln(math.sign(-5), " ", math.sign(0), " ", math.sign(7), " ", math.sign(-2.5));
    console.writeln(type_name(math.sign(3)), " ", type_name(math.sign(3.0)));
    console.writeln(math.hypot(3, 4), " ", math.hypot(1, 1));
    console.writeln(math.gcd(123456789123456789123456789, 987654321987654321));
    int common = math.gcd(8, 12);
    bool prime = math.is_prime(13);
    dyn_array<int> parts = math.divisors(6);
    console.writeln(common, " ", prime, " ", parts.length);
}
`, {}, { file: 'main.idyl' });
  assert(scene.success, scene.runtimeError ?? scene.compilation.diagnosticsText);
  const expected = [
    '6 6 0 7',
    '12 0 21',
    '1 120 15511210043330985984000000',
    '93326215443944152681699238856266700490715968264381621468592963895217599993229915608941463976156518286253697920827223758251185210916864000000000000000000000000',
    'true false false false true true false',
    'true false', // 2^61 - 1 — простое Мерсенна; 2^61 + 1 делится на 3
    '[1, 2, 3, 4, 6, 12] [1] [1, 97] [1, 2, 3, 4, 6, 9, 12, 18, 36]',
    '-1 0 1 -1',
    'int float',
    '5 1.41421356',
    '9',
    '4 true 4',
    '',
  ].join('\n');
  assert(scene.output === expected, `math helpers drifted: ${JSON.stringify(scene.output)}`);

  await assertRuntimeFails('use math;\nmain() {\n    math.factorial(-1);\n}', 'math.factorial() n must be between 0 and 10000, got -1');
  await assertRuntimeFails('use math;\nmain() {\n    math.factorial(20000);\n}', 'math.factorial() n must be between 0 and 10000, got 20000');
  await assertRuntimeFails('use math;\nmain() {\n    math.divisors(0);\n}', 'math.divisors() n must be a positive number, got 0');
  await assertRuntimeFails(
    'use math;\nmain() {\n    math.is_prime(3317044064679887385961981);\n}',
    'math.is_prime() n must be at most 3317044064679887385961980, got 3317044064679887385961981',
  );
  // Целочисленные помощники принимают только int — дробь не усекается молча.
  assertFails('use math;\nmain() {\n    math.gcd(2.5, 3);\n}', "'gcd' argument 1 expects 'int', got 'float'");
  assertFails('use math;\nmain() {\n    int bad = math.hypot(3, 4);\n}', "cannot assign 'float' value to 'int' variable");
});

test('csv parses, edits, prints and round-trips tables', async () => {
  // 1.5.6, карточка 3.4 спеки some_libraries / дизайн some_csv/01: RFC-кавычки,
  // переносы внутри кавычек, автоопределение разделителя, BOM и CRLF Excel,
  // ячейки — строки, ошибки с номером строки.
  const parsed = await runIdyllium(`use console;
use csv;

main() {
    csv.Table t = csv.parse("name,comment,score\\nAlice,\\"Любит числа, запятые и таблицы\\",42\\nБорис,\\"Первая строка\\nвторая строка\\",17\\n\\"Лиам \\"\\"Молния\\"\\"\\",\\"Кавычки внутри значения\\",99\\n");
    console.writeln(t.row_count, " ", t.column_count, " ", t.columns, " [", t.separator, "]");
    console.writeln(t.get(0, "comment"));
    console.writeln(t.get(1, "comment"));
    console.writeln(t.get(2, "name"), " ", to_int(t.get(2, "score")) + 1);
    console.writeln(t.row(0));
    console.writeln(t.column("score"));
    console.writeln(t.find("name", "Борис"), " ", t.find("name", "Хома"), " ", t.has_column("score"), " ", t.has_column("x"));
    console.write(t);
    console.writeln(t.to_string() == to_string(t));
}
`, {}, { file: 'main.idyl' });
  assert(parsed.success, parsed.runtimeError ?? parsed.compilation.diagnosticsText);
  assert(parsed.output === [
    '3 3 ["name", "comment", "score"] [,]',
    'Любит числа, запятые и таблицы',
    'Первая строка',
    'вторая строка',
    'Лиам "Молния" 100',
    '["Alice", "Любит числа, запятые и таблицы", "42"]',
    '["42", "17", "99"]',
    '1 -1 true false',
    'name,comment,score',
    'Alice,"Любит числа, запятые и таблицы",42',
    'Борис,"Первая строка',
    'вторая строка",17',
    '"Лиам ""Молния""",Кавычки внутри значения,99',
    'true',
    '',
  ].join('\n'), `csv parse scenario drifted: ${JSON.stringify(parsed.output)}`);

  // Excel-жанр: BOM, CRLF, точка с запятой, короткая строка дополняется пустой
  // ячейкой; правки; смена разделителя меняет печать; таблица — ссылка.
  const excel = await runIdyllium(`use console;
use csv;

main() {
    csv.Table e = csv.parse("\uFEFFимя;класс;уровень\\r\\nМира;маг;12\\r\\nКай;воин\\r\\n");
    console.writeln(e.columns, " [", e.separator, "] ", e.row_count, " '", e.get(1, "уровень"), "'");
    e.set(1, "уровень", "9");
    e.add_row("Тася", "лучник", "15");
    e.remove_row(0);
    console.write(e);
    e.separator = ",";
    console.write(e);
    csv.Table same = e;
    same.set(0, "класс", "паладин");
    console.writeln(e.get(0, "класс"), " ", type_name(e));
    csv.Table tab = csv.parse("a\\tb\\n1\\t2\\n");
    console.writeln(tab.get(0, "b"), " ", tab.separator == "\\t");
    csv.Table forced = csv.parse("a;b,c\\n1;2,3\\n", ",");
    console.writeln(forced.columns);
    csv.Table empty = csv.parse("");
    console.writeln(empty.row_count, " ", empty.column_count, " '", empty, "'");
    e.clear();
    console.writeln(e.row_count, " ", e.column_count);
}
`, {}, { file: 'main.idyl' });
  assert(excel.success, excel.runtimeError ?? excel.compilation.diagnosticsText);
  assert(excel.output === [
    '["имя", "класс", "уровень"] [;] 2 \'\'',
    'имя;класс;уровень',
    'Кай;воин;9',
    'Тася;лучник;15',
    'имя,класс,уровень',
    'Кай,воин,9',
    'Тася,лучник,15',
    'паладин csv.Table',
    '2 true',
    '["a;b", "c"]',
    "0 0 ''",
    '0 3',
    '',
  ].join('\n'), `csv excel scenario drifted: ${JSON.stringify(excel.output)}`);

  // Пустая заготовка, кавычки при записи, файловый раунд-трип через read/write.
  const memory = await runWithMemoryFiles(`use console;
use csv;

main() {
    csv.Table fresh;
    console.writeln(fresh.row_count, " ", fresh.column_count, " [", fresh.separator, "] '", fresh, "'");
    fresh.set_columns("a", "b");
    fresh.add_row("x;y", "");
    fresh.add_row("", "q\\"r");
    csv.write("out.csv", fresh);
    csv.Table back = csv.read("out.csv");
    console.writeln(back.row_count, " ", back.get(0, "a"), " ", back.get(1, "b"), " [", back.separator, "]");
    csv.Table given = csv.read("heroes.csv");
    console.writeln(given.get(given.find("имя", "Кай"), "уровень"));
}
`, { 'heroes.csv': 'имя,уровень\nМира,12\nКай,9\n' });
  const memoryOutput = memory.runtime.getOutput();
  assert(
    memoryOutput === "0 0 [;] ''\n2 x;y q\"r [;]\n9\n",
    `csv file round-trip drifted: ${JSON.stringify(memoryOutput)}`,
  );

  // Ошибки — словами и с номером строки (спека some_csv/01).
  const broken: ReadonlyArray<readonly [string, string]> = [
    ['csv.parse("a,b\\n1,2,3\\n");', 'csv.parse() line 2 has 3 values, but the header has 2 columns'],
    ['csv.parse("a,b\\n1,2\\n\\"x\\ny\\",2,3\\n");', 'csv.parse() line 3 has 3 values, but the header has 2 columns'],
    ['csv.parse("a,a\\n1,2\\n");', 'csv.parse() header has duplicate column "a"'],
    ['csv.parse("a,b\\n\\"oops,2\\n");', 'csv.parse() line 2: quote is never closed'],
    ['csv.parse("a,b\\n\\"x\\"y,2\\n");', 'csv.parse() line 2: unexpected text after a closing quote'],
    ['csv.parse("a,b\\n1,2\\n").get(0, "c");', 'csv table has no column "c"'],
    ['csv.parse("a,b\\n1,2\\n").get(5, "a");', 'csv.Table.get() row 5 is out of range 0..0'],
    ['csv.Table t; t.add_row("1");', 'csv.Table.add_row() before set_columns() — set the columns first'],
    ['csv.Table t; t.set_columns("a", "b"); t.add_row("1");', 'csv.Table.add_row() expects 2 values (one per column), got 1'],
    ['csv.Table t; t.separator = ";;";', 'csv.Table.separator must be one character (like ";" or ","), got ";;"'],
    ['csv.parse("a,b\\n1,2\\n", "ab");', 'csv.parse() separator must be one character (like ";" or ","), got "ab"'],
    ['csv.read("missing.csv");', "csv.read() cannot read 'missing.csv': file does not exist"],
    ['csv.Table t; csv.write("nodir/x.csv", t);', "csv.write() cannot write 'nodir/x.csv': directory does not exist"],
  ];
  for (const [statement, expected] of broken) {
    await assertRuntimeFails(`use csv;\n\nmain() {\n    ${statement}\n}\n`, expected);
  }
  // Ячейка — строка: в int без to_int не ляжет.
  assertFails('use csv;\nmain() {\n    csv.Table t = csv.parse("a\\n1\\n");\n    int x = t.get(0, "a");\n}', "cannot assign 'string' value to 'int' variable");
});

test('audio.Melody composes notes, renders WAV and refuses nonsense in words', async () => {
  // Вердикты владельца 2026-09-10 по спеке some_music/01 (вариант А): синтез в
  // рантайме, клип жанра Sound с loop, экспорт в WAV работает и безголово.
  const { melodyNoteFrequency, renderMelodyWav } = require('../src/runtime/runtime-melody') as typeof import('../src/runtime/runtime-melody');
  const hz = (name: string) => Math.round((melodyNoteFrequency(name) ?? -1) * 100) / 100;
  assert(hz('ля') === 440 && hz('A4') === 440 && hz('a') === 440, 'ля4 must be 440 Hz');
  assert(hz('до') === 261.63 && hz('C4') === 261.63, 'до4 must be 261.63 Hz');
  assert(hz('до#') === 277.18 && hz('ре♭') === 277.18 && hz('сиb') === 466.16 && hz('Bb4') === 466.16, 'accidentals');
  assert(hz('фа#5') === 739.99 && hz('си') === 493.88, 'octaves');
  assert(melodyNoteFrequency('h') === null && melodyNoteFrequency('ля-1') === null && melodyNoteFrequency('дo') === null, 'unknown names are null');
  const wav = renderMelodyWav([{ frequency: 440, beats: 1 }, { frequency: 0, beats: 0.5 }], 120, 'sine');
  assert(wav.length === 44 + Math.round(0.75 * 22050) * 2, `wav size drifted: ${wav.length}`);
  assert(String.fromCharCode(...wav.subarray(0, 4)) === 'RIFF' && new DataView(wav.buffer).getUint32(24, true) === 22050, 'wav header');

  const memory = await runWithMemoryFiles(`use console;
use audio;

main() {
    audio.Melody tune;
    console.writeln(tune.instrument, " ", tune.tempo, " ", tune.volume, " ", tune.loop, " ", tune.is_playing, " ", tune.duration);
    tune.add_note("до", 1);
    tune.add_note("ре", 0.5);
    tune.add_rest(0.5);
    tune.add_note("ля5", 2);
    tune.add_frequency(440, 1);
    console.writeln(tune.duration);
    tune.add_notes("ми ми фа соль | соль фа ми ре | до:2 -:1");
    console.writeln(tune.duration);
    tune.tempo = 60;
    console.writeln(tune.duration);
    tune.instrument = "square";
    tune.volume = 0.6;
    tune.play();
    console.writeln(tune.is_playing);
    tune.stop();
    console.writeln(tune.is_playing);
    tune.export_to_file("tune.wav");
    audio.Sound check;
    check.load_from_file("tune.wav");
    console.writeln(check.duration, " ", check.src);
    tune.transpose(12);
    tune.clear();
    console.writeln(tune.duration);
    audio.Melody key;
    key.add_note("Фа#5", 0.5);
    key.add_note("C", 0.5);
    key.add_note("сиb3", 0.5);
    key.add_note("A", 0.25);
    console.writeln(key.duration);
    key.loop = true;
    key.play();
    key.pause();
    key.resume();
    console.writeln(key.is_playing);
    key.stop();
}
`, {});
  const output = memory.runtime.getOutput();
  assert(
    output === 'sine 120 1 false false 0\n2.5\n8\n16\ntrue\nfalse\n16 tune.wav\n0\n0.875\ntrue\n',
    `melody scenario drifted: ${JSON.stringify(output)}`,
  );

  const broken: ReadonlyArray<readonly [string, string]> = [
    ['m.add_note("дo", 1);', "Melody.add_note() unknown note 'дo' — write до, ре, ми, фа, соль, ля, си (or C…B), then an octave digit and # or b, like \"фа#5\""],
    ['m.add_note("до", 0);', 'Melody.add_note() beats must be positive, got 0'],
    ['m.add_frequency(5, 1);', 'Melody.add_frequency() frequency must be between 20 and 20000, got 5'],
    ['m.add_notes("до ре:x");', "Melody.add_notes() cannot read 'ре:x' — the length after ':' must be a positive number, like \"до:2\""],
    ['m.add_notes("до зю");', "Melody.add_notes() cannot read 'зю' — write до, ре, ми, фа, соль, ля, си (or C…B), then an octave digit and # or b, like \"фа#5\"; '-' is a rest"],
    ['m.play();', 'Melody.play() the melody is empty — add notes first'],
    ['m.add_note("до", 1); m.export_to_file("x.mp3");', "Melody.export_to_file() writes WAV — name the file with .wav, got 'x.mp3'"],
    ['m.instrument = "piano";', "Melody.instrument must be 'sine', 'square', 'triangle' or 'saw', got 'piano'"],
    ['m.tempo = 10;', 'Melody.tempo must be between 20 and 400, got 10'],
    ['m.add_note("до", 100);', 'Melody.add_note() the melody would be 50 seconds long — the limit is 30; split it into several melodies'],
    ['m.add_note("до", 50); m.tempo = 20;', 'Melody.tempo 20 would make the melody 150 seconds long — the limit is 30'],
    ['m.transpose(100);', 'Melody.transpose() semitones must be between -48 and 48, got 100'],
  ];
  for (const [statement, expected] of broken) {
    await assertRuntimeFails(`use audio;\n\nmain() {\n    audio.Melody m;\n    ${statement}\n}\n`, expected);
  }
  assertFails('use audio;\nmain() {\n    audio.Melody m;\n    m.duration = 5;\n}', "property 'duration' is read-only");
  assertFails('use audio;\nmain() {\n    audio.Melody m;\n    m.transpose(2.5);\n}', "'transpose' argument 1 expects 'int', got 'float'");
});

test('encoding 1.5.7: 41 encodings from own tables, Unicode forms, helpers and Base64', async () => {
  // Вердикты владельца 2026-09-11 (спека some_encoding_growth/01): список и
  // имена как у Charsets, таблицы-генерат, незанятые байты — ошибка (safe=false
  // — �), utf-16/utf-32 «с BOM», is_valid/convert/guess/char, Base64 функциями.
  const { ENCODING_UPPER_HALVES } = require('../src/runtime/encoding-tables') as typeof import('../src/runtime/encoding-tables');
  assert(ENCODING_UPPER_HALVES.length === 34, `expected 34 code pages, got ${ENCODING_UPPER_HALVES.length}`);
  for (const [id, high] of ENCODING_UPPER_HALVES) {
    assert(Array.from(high).length === 128, `${id}: upper half must hold 128 characters`);
  }
  // Страж хостовой честности: там, где TextDecoder этого Node знает страницу и
  // не подменяет её (не Windows C1, не ASCII/Latin-1), таблицы совпадают.
  const decoderLabels: ReadonlyArray<readonly [string, string]> = [
    ['cp866', 'ibm866'], ['koi8-r', 'koi8-r'], ['koi8-u', 'koi8-u'], ['iso-8859-2', 'iso-8859-2'],
    ['iso-8859-5', 'iso-8859-5'], ['iso-8859-15', 'iso-8859-15'], ['mac-roman', 'macintosh'], ['mac-cyrillic', 'x-mac-cyrillic'],
  ];
  for (const [id, label] of decoderLabels) {
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(label, { fatal: true });
    } catch {
      continue; // small-icu — нечего сверять
    }
    const high = Array.from(ENCODING_UPPER_HALVES.find(([name]) => name === id)![1]);
    for (let byte = 0x80; byte <= 0xff; byte += 1) {
      let expected = '￿';
      try {
        expected = decoder.decode(Uint8Array.of(byte));
      } catch {
        expected = '￿';
      }
      assert(high[byte - 0x80] === expected, `${id}: byte ${byte} differs from TextDecoder (${JSON.stringify(high[byte - 0x80])} vs ${JSON.stringify(expected)})`);
    }
  }
  // Генерат свеж: json → ts без ручных правок.
  const { execFileSync } = require('child_process') as typeof import('child_process');
  execFileSync(process.execPath, [path.join(process.cwd(), 'tools', 'build-encoding-tables.js'), '--check'], { stdio: 'pipe' });

  const scene = await runIdyllium(`use console;
use encoding;

main() {
    dyn_array<string> names = encoding.list_encodings();
    console.writeln(names.length, " ", names[0], " ", names[15], " ", names[34], " ", names[40]);
    console.writeln(encoding.encode("€“", "windows-1252"), " ", encoding.decode([128, 147], "windows-1252"), " ", encoding.decode([129], "windows-1252", safe=false));
    console.writeln(encoding.encode('Ю', "koi8-u"), " ", encoding.encode("Ґ", "koi8-u"), " ", encoding.decode([173], "koi8-u"));
    console.writeln(encoding.encode("Ğış", "iso-8859-9"), " ", encoding.decode([208], "latin5"), " ", encoding.decode([233], "latin1"), " ", encoding.decode([233], "ISO_8859-1"));
    console.writeln(encoding.decode(encoding.encode("Привет", "mac-cyrillic"), "windows-1251"), " ", encoding.decode(encoding.encode("Café", "MACINTOSH"), "mac-roman"));
    console.writeln(encoding.encode("A€", "utf-16le"), " ", encoding.encode("A", "utf-16be"), " ", encoding.encode("A", "utf-16"), " ", encoding.encode("🙂", "utf-16le"), " ", encoding.encode("A", "utf-32"), " ", encoding.encode("🙂", "utf-32be"));
    console.writeln(encoding.decode([255, 254, 65, 0], "utf-16"), encoding.decode([254, 255, 0, 65], "utf-16"), encoding.decode([61, 216, 66, 222], "utf-16le"), encoding.decode([0, 1, 246, 66], "utf-32be"), encoding.decode([255, 254, 0, 0, 65, 0, 0, 0], "utf-32"));
    console.writeln(encoding.is_valid([208, 159], "utf-8"), " ", encoding.is_valid([208], "utf-8"), " ", encoding.is_valid([129], "windows-1252"), " ", encoding.is_valid([65, 0, 66], "utf-16le"));
    console.writeln(encoding.convert(encoding.encode("Ёж", "koi8-r"), "koi8-r", "windows-1251"), " ", encoding.convert([200], "windows-1251", "windows-1252", safe=false));
    console.writeln(encoding.guess(encoding.encode("Нормальный текст, «кавычки» — тире.", "windows-1251")), " ", encoding.guess(encoding.encode("Нормальный текст", "koi8-r")), " ", encoding.guess(encoding.encode("Нормальный текст", "cp866")), " ", encoding.guess(encoding.encode("Нормальный текст", "mac-cyrillic")), " ", encoding.guess(encoding.encode("Нормальный текст", "iso-8859-5")));
    console.writeln(encoding.guess(encoding.encode("Привет", "utf-8")), " ", encoding.guess([72, 105]), " '", encoding.guess([]), "' '", encoding.guess([200, 129]), "' ", encoding.guess([255, 254, 65, 0]), " ", encoding.guess([239, 187, 191, 65]));
    console.writeln(encoding.to_base64(encoding.encode("Привет", "utf-8")), " ", encoding.to_base64([77]), " ", encoding.to_base64([77, 97]), " '", encoding.to_base64([]), "' ", encoding.decode(encoding.from_base64("0J/RgNC40LLQtdGC"), "utf-8"), " ", encoding.from_base64("TQ==\\n"));
    console.writeln(encoding.encode('Ж', "utf-8"), " ", encoding.decode([239, 187, 191, 65], "utf-8").length, " ", encoding.decode(encoding.encode("Нормальный", "windows-1251"), "utf-8", safe=false).length);
}
`, {}, { file: 'main.idyl' });
  assert(scene.success, scene.runtimeError ?? scene.compilation.diagnosticsText);
  assert(scene.output === [
    '41 cp437 ascii utf-8 utf-32be',
    '[128, 147] €“ �',
    '[224] [189] ґ',
    '[208, 253, 254] Ğ é é',
    'Џривет Café',
    '[65, 0, 172, 32] [0, 65] [255, 254, 65, 0] [61, 216, 66, 222] [255, 254, 0, 0, 65, 0, 0, 0] [0, 1, 246, 66]',
    'AA🙂🙂A',
    'true false false false',
    '[168, 230] [63]',
    'windows-1251 koi8-r cp866 mac-cyrillic iso-8859-5',
    "utf-8 ascii '' 'utf-8' utf-16 utf-8", // [200, 129] — валидный UTF-8 (U+0201), guess честно говорит utf-8
    "0J/RgNC40LLQtdGC TQ== TWE= '' Привет [77]",
    '[208, 150] 2 10',
    '',
  ].join('\n'), `encoding growth scene drifted: ${JSON.stringify(scene.output)}`);

  const broken: ReadonlyArray<readonly [string, string]> = [
    ['encoding.decode([129], "windows-1252");', 'byte 129 is not valid windows-1252 at index 0'],
    ['encoding.decode([255], "ascii");', 'byte 255 is not valid ASCII at index 0'],
    ['encoding.decode([65, 0], "utf-16");', 'encoding.decode() utf-16 needs a byte order mark — use utf-16le or utf-16be for bytes without one'],
    ['encoding.decode([65, 0, 66], "utf-16le");', 'encoding.decode() invalid utf-16le at byte 2: half of a code unit'],
    ['encoding.decode([0, 216, 65, 0], "utf-16le");', 'encoding.decode() invalid utf-16le at byte 0: lone surrogate'],
    ['encoding.decode([0, 0, 17, 0], "utf-32le");', 'encoding.decode() invalid utf-32le at byte 0: code point 1114112 is outside Unicode'],
    ['encoding.decode([65], "latin");', "unknown encoding 'latin' — did you mean 'iso-8859-1'?"],
    ['encoding.decode([65], "koi-8r");', "unknown encoding 'koi-8r' — did you mean 'koi8-r'?"],
    ['encoding.decode([65], "klingon");', "unknown encoding 'klingon' — see encoding.list_encodings()"],
    ['encoding.encode("€", "koi8-r");', "character '€' is not valid koi8-r at position 0"], // в windows-1251 евро есть (0x88)
    ['encoding.from_base64("TQ=x");', "encoding.from_base64() unexpected character 'x' after padding at position 3"],
    ['encoding.from_base64("T");', 'encoding.from_base64() text length must be a multiple of 4 (pad with = if needed)'],
    ['encoding.from_base64("T$==");', "encoding.from_base64() invalid Base64 character '$' at position 1"],
    ['encoding.convert([200], "windows-1251", "ascii");', "encoding.convert() character 'И' is not valid ASCII at position 0"],
  ];
  for (const [statement, expected] of broken) {
    await assertRuntimeFails(`use encoding;\n\nmain() {\n    ${statement}\n}\n`, expected);
  }
});

test('file.open and csv take an encoding, and reading is strict instead of silent mojibake', async () => {
  // Граница файлов (спека some_encoding_growth/01 §4.5): третий аргумент —
  // кодировка; без него UTF-8 строго, с подсказкой, на что похожи байты.
  const win1251 = 'Привет, мир!';
  const memory = await runWithMemoryFiles(`use console;
use encoding;
use file;
use csv;

main() {
    file.ostream fout = file.open("win.txt", "write", "windows-1251");
    fout.write_line("Привет, мир!");
    fout.write("Ёж");
    fout.close();
    file.ostream more = file.open("win.txt", "append", "cp1251");
    more.write_line("!");
    more.close();
    file.istream fin = file.open("win.txt", "read", "windows-1251");
    console.write(fin.read_all());
    fin.close();
    file.istream raw = file.open("win.txt", "read", "koi8-r");
    console.writeln(raw.read_line());
    raw.close();
    file.ostream bom = file.open("bom.txt", "write", "utf-16");
    bom.write("Ab");
    bom.close();
    file.istream bomin = file.open("bom.txt", "read", "utf-16");
    console.writeln(bomin.read_all());
    bomin.close();
    file.istream utf8bom = file.open("utf8bom.txt", "read");
    string first = utf8bom.read_all();
    utf8bom.close();
    console.writeln(first.length, " ", first);

    csv.Table t;
    t.set_columns("имя", "уровень");
    t.add_row("Мира", "12");
    csv.write("excel.csv", t, "windows-1251");
    csv.Table back = csv.read("excel.csv", encoding="windows-1251");
    console.writeln(back.get(0, "имя"), " ", back.separator);
    try {
        csv.Table bad = csv.read("excel.csv");
    } catch (error) {
        console.writeln(error.message);
    }
    try {
        file.istream wrong = file.open("old.txt", "read");
    } catch (error) {
        console.writeln(error.message);
    }
    try {
        file.istream wrong = file.open("bom.txt", "read");
    } catch (error) {
        console.writeln(error.message);
    }
    try {
        file.ostream narrow = file.open("narrow.txt", "write", "ascii");
        narrow.write_line("Привет");
        narrow.close();
    } catch (error) {
        console.writeln(error.message);
    }
}
`, {
    'old.txt': { kind: 'file', content: '', bytes: Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x2c, 0x20, 0xec, 0xe8, 0xf0, 0x21]) },
    'utf8bom.txt': { kind: 'file', content: '', bytes: Uint8Array.from([0xef, 0xbb, 0xbf, 0x41, 0x42]) },
  } as unknown as Record<string, string>);
  const output = memory.runtime.getOutput();
  assert(output === [
    `${win1251}`,
    'Ёж!',
    'оПХБЕР, ЛХП!',
    '',
    'Ab',
    '2 AB',
    'Мира ;',
    "csv.read() cannot read 'excel.csv' as utf-8: invalid UTF-8 at byte 1 (0xEC): invalid continuation byte — the file looks like windows-1251; open it with csv.read(path, encoding=\"windows-1251\")",
    "file.open() cannot read 'old.txt' as utf-8: invalid UTF-8 at byte 1 (0xF0): invalid continuation byte — the file looks like windows-1251; open it with file.open(path, \"read\", \"windows-1251\")",
    "file.open() cannot read 'bom.txt' as utf-8: invalid UTF-8 at byte 0 (0xFF): invalid leading byte — the file looks like utf-16; open it with file.open(path, \"read\", \"utf-16\")",
    "ostream.write_line() character 'П' is not valid ASCII at position 0",
    '',
  ].join('\n'), `file encoding scene drifted: ${JSON.stringify(output)}`);
  await assertRuntimeFails('use file;\nmain() {\n    file.open("x.txt", "read", "klingon");\n}', "unknown encoding 'klingon' — see encoding.list_encodings()");
});
