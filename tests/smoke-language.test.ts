import { IDYLLIUM_WARNING_CODES } from '../src';
// Смоук: язык — синтаксис, семантика, типы, ООП, модули, диагностика, варнинги.
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

test('hello world runs', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      console.write("Hello, World!", '\\n');
      console.write("русский");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Hello, World!\nрусский', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('variables and assignment run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      int money = 20000;
      console.write("У вас ", money, " денег\\n");
      money = 25000;
      console.write("У вас ", money, " денег\\n");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'У вас 20000 денег\nУ вас 25000 денег\n',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

test('local and global named constants run', async () => {
  const result = await runIdyllium(`
    use console;

    const int BASE_SCORE = 40;

    main() {
      const int BONUS = 2;
      console.writeln(BASE_SCORE + BONUS);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '42\n', `unexpected output: ${JSON.stringify(result.output)}`);
  assert(result.compilation.jsCode?.includes('const BASE_SCORE = 40') === true, 'expected global JavaScript const');
  assert(result.compilation.jsCode?.includes('const BONUS = 2') === true, 'expected local JavaScript const');
});

test('named constants require an initializer and reject reassignment', () => {
  assertFails(`
    main() {
      const int answer;
    }
  `, "constant 'answer' must have an initializer");

  assertFails(`
    main() {
      const int answer = 42;
      answer = 64;
    }
  `, "cannot assign to constant 'answer'");

  assertFails(`
    main() {
      const int answer = 42;
      answer += 1;
    }
  `, "cannot assign to constant 'answer'");

  // const в теле класса с 2026-08-22 ЗАКОНЕН (класс-константа Rules.LIMIT);
  // без инициализатора — тот же честный отказ, что и у обычных констант.
  assertFails(`
    class Rules {
      const int LIMIT;
    }
    main() { }
  `, "class constant 'LIMIT' must have an initializer");

  assertFails(`
    void function show(const int value) {}
  `, 'const parameters are not supported');
});

test('const arrays keep a readonly binding but mutable elements', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      const array<int, 2> values = [10, 20];
      values[0] = 42;
      console.writeln(values);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '[42, 20]\n', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(`
    main() {
      const array<int, 2> values = [10, 20];
      values = [30, 40];
    }
  `, "cannot assign to constant 'values'");
});

test('const objects keep a readonly binding but mutable fields', async () => {
  const result = await runIdyllium(`
    use console;

    class Box {
      int value;

      constructor Box(int initial) {
        this.value = initial;
      }
    }

    main() {
      const Box box(10);
      box.value = 42;
      console.writeln(box.value);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '42\n', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(`
    class Box {
      constructor Box() {}
    }

    main() {
      const Box first();
      Box second;
      first = second;
    }
  `, "cannot assign to constant 'first'");
});

test('division always has float type', () => {
  assertCompiles(`
    main() {
      int A = 37;
      int B = 10;
      float C = A / B;
    }
  `);

  assertFails(`
    main() {
      int A = 37;
      int B = 10;
      int C = A / B;
    }
  `, "cannot assign 'float'");
});

test('int rejects float initializer', () => {
  assertFails(`
    main() {
      int B = 1.7;
    }
  `, "cannot assign 'float'");
});

test('compound assignment operators run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      int count = 1;
      count += 4;
      count -= 2;
      count *= 3;

      float ratio = 9.0;
      ratio /= 2;

      string text = "Hi";
      text += '!';

      array<int, 2> nums = [10, 20];
      nums[0] += 5;

      int total = 0;
      for (int i = 0; i < 3; i += 1) {
        total += i;
      }

      console.write(count, ":", ratio, ":", text, ":", nums[0], ":", total);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '9:4.5:Hi!:15:3', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('compound assignment diagnostics are readable', () => {
  assertFails(`
    main() {
      int value = 9;
      value /= 2;
    }
  `, "cannot assign 'float' value to 'int' variable");

  assertFails(`
    main() {
      bool flag = true;
      flag += 1;
    }
  `, "operator '+=' cannot be applied");
});

test('compound division uses runtime division errors', async () => {
  const source = [
    'main() {',
    '    float value = 9.0;',
    '    value /= 0;',
    '}',
  ].join('\n');

  const result = await runIdyllium(source, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected runtime failure');
  assert(
    result.runtimeError === 'main.idyl:3: runtime error: division by zero',
    `unexpected runtime error: ${JSON.stringify(result.runtimeError)}`,
  );
});

test('div and mod run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      console.write(div(38, 10), ' ', mod(38, 10));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '3 8', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('logical xor is strict eager and has precedence between and and or', async () => {
  const result = await runIdyllium(`
    use console;

    int calls = 0;

    bool function checked(bool value) {
      calls += 1;
      return value;
    }

    main() {
      console.write(
        false xor false, ":",
        false xor true, ":",
        true xor false, ":",
        true xor true, ":",
        true xor true and false, ":",
        true or true xor true, ":",
        checked(true) xor checked(false), ":",
        calls
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'false:true:true:false:true:true:true:2', `unexpected xor output: ${JSON.stringify(result.output)}`);

  assertFails(`
    main() {
      bool value = 1 xor 0;
    }
  `, "operator 'xor' requires bool operands");
});

test('try catch cannot swallow a stopped program', async () => {
  const controller = new AbortController();
  const resultPromise = runIdyllium(`
    use console;
    use time;

    main() {
      try {
        console.write("start");
        time.sleep(5);
      } catch {
        console.write(":caught");
      } finally {
        console.write(":finally");
      }
    }
  `, { abortSignal: controller.signal }, { file: 'main.idyl' });

  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  const result = await resultPromise;
  assert(!result.success, 'expected stopped program to escape catch');
  assert(result.output === 'start:finally', `unexpected stopped output: ${JSON.stringify(result.output)}`);
  assert(result.runtimeError?.includes('program was stopped') === true, `expected stopped runtime error, got ${result.runtimeError}`);
});

test('tight compute loop can be stopped by abort signal', async () => {
  const controller = new AbortController();
  const resultPromise = runIdyllium(`
    main() {
      int i = 0;
      while (true) {
        i = i + 1;
      }
    }
  `, { abortSignal: controller.signal }, { file: 'main.idyl' });

  await new Promise((resolve) => setTimeout(resolve, 40));
  controller.abort();
  const result = await resultPromise;
  assert(!result.success, 'expected stopped tight loop to fail');
  assert(result.runtimeError?.includes('program was stopped') === true, `expected stopped runtime error, got ${result.runtimeError}`);
});

test('try catch cannot swallow a stopped loop and all loop kinds stay abortable', async () => {
  const controller = new AbortController();
  const resultPromise = runIdyllium(`
    use console;

    main() {
      int i = 0;
      try {
        do {
          for (int j = 0; j < 1000000000; j = j + 1) {
            i = i + 1;
          }
        } while (true);
      } catch (problem) {
        console.write("caught:", problem.message);
      }
    }
  `, { abortSignal: controller.signal }, { file: 'main.idyl' });

  await new Promise((resolve) => setTimeout(resolve, 40));
  controller.abort();
  const result = await resultPromise;
  assert(!result.success, 'expected stopped nested loops to escape catch');
  assert(!result.output.includes('caught'), `stop must not be catchable, got output ${JSON.stringify(result.output)}`);
  assert(result.runtimeError?.includes('program was stopped') === true, `expected stopped runtime error, got ${result.runtimeError}`);
});

test('loops with tick checkpoints keep exact semantics', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    int total = 0;',
    '    for (int i = 0; i < 5000; i = i + 1) {',
    '        total = total + i;',
    '    }',
    '    int steps = 0;',
    '    while (steps < 3000) {',
    '        steps = steps + 1;',
    '        if (steps == 2500) {',
    '            break;',
    '        }',
    '    }',
    '    do {',
    '        steps = steps - 1;',
    '    } while (steps > 2000);',
    '    console.write(total, ":", steps);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '12497500:2000', `unexpected loop semantics output: ${JSON.stringify(result.output)}`);
});

test('semantic node types drive fixed-width casts in codegen', async () => {
  const result = await runIdyllium([
    'use console;',
    'use types;',
    '',
    'types.uint8 function next_code(types.uint8 seed) {',
    '    return seed + 3;',
    '}',
    '',
    'class Counter {',
    '    types.uint8 value;',
    '',
    '    void function bump(int amount) {',
    '        this.value += amount;',
    '    }',
    '}',
    '',
    'main() {',
    '    Counter c;',
    '    c.value = 250;',
    '    c.bump(10);',
    '    console.write(c.value, ":");',
    '    console.write(next_code(253).to_bin(), ":");',
    '    array<types.uint8, 2> cells = [250, 5];',
    '    cells[0] += 10;',
    '    console.write(cells[0]);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '4:00000000:4', `unexpected fixed-width cast output: ${JSON.stringify(result.output)}`);
});

test('infinite recursion reports a readable idyllium error', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'int function boom(int n) {',
    '    return boom(n + 1);',
    '}',
    '',
    'main() {',
    '    console.write(boom(0));',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(!result.success, 'expected infinite recursion to fail');
  // Сообщение — обычная runtime error с номером строки, а не перевод RangeError.
  assert(
    result.runtimeError?.includes('main.idyl:3: runtime error: recursion depth limit of 20000 exceeded') === true,
    `expected idyllium-formatted recursion error, got ${result.runtimeError}`,
  );
  assert(
    result.runtimeError?.includes("'boom'") === true,
    `expected the recursive function name in the error, got ${result.runtimeError}`,
  );
});

test('recursion goes far past the physical JS stack', async () => {
  // Больше физического предела (~5200 кадров): счётчик глубины периодически
  // уступает управление, и цепочка вызовов разворачивается в кучу.
  const result = await runIdyllium([
    'use console;',
    '',
    'int function dive(int n) {',
    '    if (n <= 0) { return 0; }',
    '    return 1 + dive(n - 1);',
    '}',
    '',
    'main() {',
    '    console.write(dive(19000));',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, `expected deep recursion to succeed, got ${result.runtimeError}`);
  assert(result.output === '19000', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('recursion depth limit is catchable and adjustable', async () => {
  const caught = await runIdyllium([
    'use console;',
    'use system;',
    '',
    'int function boom(int n) {',
    '    return boom(n + 1);',
    '}',
    '',
    'main() {',
    '    system.set_recursion_depth(100);',
    '    try {',
    '        console.writeln(boom(0));',
    '    } catch (error) {',
    '        console.writeln("caught");',
    '    }',
    '    console.writeln(system.recursion_depth());',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(caught.success, `expected the program to survive, got ${caught.runtimeError}`);
  assert(caught.output === 'caught\n100\n', `unexpected output: ${JSON.stringify(caught.output)}`);
});

test('printing class objects requires a public to_string method', async () => {
  assertFails([
    'use console;',
    '',
    'class Cat {',
    '    string name;',
    '}',
    '',
    'main() {',
    '    Cat cat;',
    '    console.writeln(cat);',
    '}',
  ].join('\n'), "cannot print object of class 'Cat' directly");

  assertFails([
    'use console;',
    '',
    'class Cat {',
    '    string name;',
    '}',
    '',
    'main() {',
    '    dyn_array<Cat> cats = [];',
    '    console.writeln(cats);',
    '}',
  ].join('\n'), "cannot print an array of 'Cat' objects directly");

  assertFails([
    'use console;',
    '',
    'class Cat {',
    'private:',
    '    string function to_string() {',
    '        return "x";',
    '    }',
    '}',
    '',
    'main() {',
    '    Cat cat;',
    '    console.writeln(cat);',
    '}',
  ].join('\n'), "cannot print object of class 'Cat' directly");

  const result = await runIdyllium([
    'use console;',
    '',
    'class Cat {',
    '    string name;',
    '',
    '    string function to_string() {',
    '        return "Cat(" + this.name + ")";',
    '    }',
    '}',
    '',
    'main() {',
    '    Cat cat;',
    '    cat.name = "Барсик";',
    '    console.write(cat, ":", to_string(cat) + "!");',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Cat(Барсик):Cat(Барсик)!', `unexpected to_string output: ${JSON.stringify(result.output)}`);
});

test('class declarations accept an optional trailing semicolon', () => {
  assertCompiles([
    'class Point {',
    '    int x;',
    '};',
    '',
    'main() {',
    '    Point p;',
    '    p.x = 1;',
    '}',
  ].join('\n'));
});

test('destructors produce a single friendly diagnostic', () => {
  const compiled = compileIdyllium([
    'class Hero {',
    '    int hp;',
    '',
    '    destructor Hero() {',
    '        int x = 1;',
    '    }',
    '}',
    '',
    'main() {',
    '    Hero h;',
    '    h.hp = 5;',
    '}',
  ].join('\n'), { file: 'main.idyl' });

  assert(!compiled.success, 'expected destructor to be rejected');
  assert(
    compiled.diagnosticsText.includes('destructors are not supported yet'),
    `expected friendly destructor diagnostic, got:\n${compiled.diagnosticsText}`,
  );
  assert(
    !compiled.diagnosticsText.includes('unexpected token'),
    `expected no raw parser cascade, got:\n${compiled.diagnosticsText}`,
  );
});

test('bare class declarations keep default field values', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'class Animal {',
    '    string name;',
    '',
    '    constructor Animal(string ex_name) {',
    '        this.name = ex_name;',
    '    }',
    '}',
    '',
    'class Robot {',
    '    string label;',
    '',
    '    constructor Robot(string ex_label = "R2") {',
    '        this.label = ex_label;',
    '    }',
    '}',
    '',
    'class Greeter {',
    '    string text;',
    '',
    '    constructor Greeter() {',
    '        this.text = "hi";',
    '    }',
    '}',
    '',
    'main() {',
    '    Animal a;',
    '    Robot r;',
    '    Greeter g;',
    '    console.write("[", a.name, "]:", r.label, ":", g.text);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  // Правило 1.3.5: голое объявление НИКОГДА не вызывает конструктор — поля
  // всех трёх объектов остаются дефолтными; вызов только явный: T v = T().
  assert(result.output === '[]::', `unexpected bare declaration output: ${JSON.stringify(result.output)}`);
});

test('user class events fire handlers and stay silent without a subscriber', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'class Hero {',
    '    string name = "Босс";',
    '    int hp = 100;',
    '',
    '    event on_death(Hero victim);',
    '',
    '    void function hit(int damage) {',
    '        this.hp -= damage;',
    '        if (this.hp <= 0) {',
    '            this.on_death(this);',
    '        }',
    '    }',
    '}',
    '',
    'class Animal {',
    '    event on_sound(string text);',
    '}',
    '',
    'class Dog extends Animal {',
    '    void function bark() { this.on_sound("Гав"); }',
    '}',
    '',
    'void function mourn(Hero victim) {',
    '    console.writeln(victim.name, " пал: hp=", victim.hp);',
    '}',
    '',
    'main() {',
    '    Hero silent;',
    '    silent.hit(200); // подписчика нет — событие молчит',
    '',
    '    Hero boss;',
    '    boss.on_death = void function() { console.writeln("не я"); };',
    '    boss.on_death = mourn; // поздняя подписка заменяет раннюю',
    '    boss.hit(60);',
    '    boss.hit(60);',
    '',
    '    Dog dog; // наследник запускает событие базового класса',
    '    dog.on_sound = void function(string text) { console.writeln(text); };',
    '    dog.bark();',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === 'Босс пал: hp=-20\nГав\n',
    `unexpected event output: ${JSON.stringify(result.output)}`,
  );
});

test('method references keep their object when stored as event handlers', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'class Scoreboard {',
    '    int deaths;',
    '',
    '    void function count(Hero victim) {',
    '        this.deaths += 1;',
    '        console.writeln("смертей: ", this.deaths);',
    '    }',
    '}',
    '',
    'class Hero {',
    '    event on_death(Hero victim);',
    '    void function die() { this.on_death(this); }',
    '}',
    '',
    'main() {',
    '    Scoreboard board;',
    '    Hero first;',
    '    Hero second;',
    '    first.on_death = board.count;',
    '    second.on_death = board.count;',
    '    first.die();',
    '    second.die();',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  // Метод, сохранённый как значение, не теряет свой объект: оба героя
  // инкрементируют ОДНО табло (this.deaths привязан к board).
  assert(
    result.output === 'смертей: 1\nсмертей: 2\n',
    `unexpected scoreboard output: ${JSON.stringify(result.output)}`,
  );
});

test('integer arithmetic stays exact beyond the double limit', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'main() {',
    '    int a = 2166136261;',
    '    console.writeln(a * 16777619); // ~3.6e16: раньше double тихо врал на единицу',
    '',
    '    int big = 123456789;',
    '    console.writeln(big * big * big); // за пределами 64 бит — тоже точно',
    '',
    '    console.writeln(9007199254740993 - 1 + 1); // граница 2^53',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '36342608889142559\n1881676371789154860897069\n9007199254740993\n',
    `unexpected exact arithmetic output: ${JSON.stringify(result.output)}`,
  );
});

test('named constants work as fixed array sizes', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'const int ROWS = 3;',
    'const int COLS = 4;',
    'const int TOTAL = ROWS * COLS; // константа из констант',
    '',
    'array<int, TOTAL> flat;',
    '',
    'int function cell_count(array<int, TOTAL> data) {',
    '    return data.length;',
    '}',
    '',
    'class Board {',
    '    array<int, COLS> row;',
    '}',
    '',
    'main() {',
    '    const int L = 6;',
    '    array<int, L> K = [81, 45, 33, 27, 90, 64];',
    '',
    '    Board b;',
    '    array<array<int, COLS>, ROWS> grid;',
    '    console.write(K[0], ":", K[5], ":", cell_count(flat), ":", b.row.length, ":", grid.length);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '81:64:12:4:3', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(
    'main() {\n    int n = 6;\n    array<int, n> bad;\n}',
    "array size 'n' must be an integer constant declared with 'const'",
  );
  assertFails('main() {\n    array<int, MISSING> bad;\n}', "array size constant 'MISSING' was not declared");
  assertFails(
    'main() {\n    const int L = 6;\n    array<int, L> K = [1, 2, 3];\n}',
    "array initializer has 3 elements, but 'array<int, 6>' requires 6",
  );
});

test('class methods see file-level constants and globals', async () => {
  const result = await runIdyllium([
    'use console;',
    '',
    'const int W = 60;',
    'int visits = 0;',
    '',
    'class Dungeon {',
    '    dyn_array<int> cells;',
    '',
    '    constructor Dungeon() {',
    '        this.cells.resize(W); // константа в конструкторе',
    '    }',
    '',
    '    int function width() {',
    '        visits += 1;         // глобальная переменная в методе',
    '        return W;            // константа в методе',
    '    }',
    '}',
    '',
    'main() {',
    '    Dungeon d = Dungeon();',
    '    console.write(d.width(), ":", d.cells.length, ":", visits);',
    '}',
  ].join('\n'), {}, { file: 'main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '60:60:1', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('events of classes from user modules export and fire across files', async () => {
  const clockModule = [
    'use console;',
    '',
    'class Clock {',
    '    int hour;',
    '',
    '    event on_alarm(int hour);',
    '',
    '    void function advance() {',
    '        this.hour += 1;',
    '        if (this.hour == 7) {',
    '            this.on_alarm(this.hour);',
    '        }',
    '    }',
    '}',
  ].join('\n');

  const result = await runIdyllium([
    'use console;',
    'use clocks;',
    '',
    'main() {',
    '    clocks.Clock c;',
    '    c.on_alarm = void function(int hour) {',
    '        console.writeln("Подъём! Уже ", hour);',
    '    };',
    '    for (int i = 0; i < 8; i += 1) {',
    '        c.advance();',
    '    }',
    '}',
  ].join('\n'), {}, { file: 'main.idyl', sources: { 'clocks.idyl': clockModule } });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Подъём! Уже 7\n', `unexpected module event output: ${JSON.stringify(result.output)}`);

  const outside = compileIdyllium(
    'use clocks;\nmain() {\n    clocks.Clock c;\n    c.on_alarm(7);\n}',
    { file: 'main.idyl', sources: { 'clocks.idyl': clockModule } },
  );
  assert(!outside.success, 'expected firing a module event from outside to fail');
  assert(
    outside.diagnosticsText.includes("event 'on_alarm' can only be fired inside class 'clocks.Clock'"),
    `unexpected module event diagnostic:\n${outside.diagnosticsText}`,
  );
});

test('user event misuse produces readable diagnostics', () => {
  assertFails(
    'class H { event on_x; }\nmain() {\n    H h;\n    h.on_x();\n}',
    "event 'on_x' can only be fired inside class 'H'",
  );
  assertFails(
    'use console;\nclass H { event on_x; }\nmain() {\n    H h;\n    console.writeln(h.on_x);\n}',
    "event 'on_x' cannot be read as a value",
  );
  assertFails(
    'class H { event on_x(int a, int b); }\nvoid function bad(int only_one) {}\nmain() {\n    H h;\n    h.on_x = bad;\n}',
    "callback property 'on_x' expects function(): void or function(int, int): void",
  );
  assertFails(
    'class H { event on_x; }\nmain() {\n    H h;\n    h.on_x = 42;\n}',
    "callback property 'on_x' expects a function, got 'int'",
  );
  assertFails('class H { event on_x(int a = 5); }\nmain() {}', 'event parameters cannot have default values');
  assertFails('class H { static event on_x; }\nmain() {}', 'events cannot be static');
  assertFails('class H { int on_x; event on_x; }\nmain() {}', "class 'H' already has member 'on_x'");
});

test('language null works with explicitly nullable library types', async () => {
  const result = await runIdyllium([
    'use console;',
    'use json;',
    '',
    'json.Value function optional_value(bool empty) {',
    '    if (empty) {',
    '        return null;',
    '    }',
    '    return json.Value("ready");',
    '}',
    '',
    'void function print_null(json.Value value = null) {',
    '    console.write(value == null);',
    '}',
    '',
    'main() {',
    '    json.Value first = null;',
    '    json.Value second = optional_value(true);',
    '    dyn_array<json.Value> values = [null];',
    '    values.add(null);',
    '',
    '    json.Object root;',
    '    root.add("missing", null);',
    '',
    '    print_null();',
    '    console.write(":", first == null, ":", null == second);',
    '    console.write(":", values[0] == null, ":", values[1].is_null());',
    '    console.write(":", root.get("missing") == null);',
    '',
    '    first = json.Value("text");',
    '    console.write(":", first == null);',
    '}',
  ].join('\n'));

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:true:true:true:true:true:false', `unexpected null output: ${JSON.stringify(result.output)}`);
});

test('language null rejects non-nullable types', () => {
  assertFails(`
    main() {
      int number = null;
    }
  `, "cannot assign 'null' value to 'int' variable");

  assertFails(`
    use json;

    main() {
      json.Object object = null;
    }
  `, "cannot assign 'null' value to 'json.Object' variable");

  assertFails(`
    main() {
      bool same = 42 == null;
    }
  `, "cannot compare 'int' and 'null'");

  assertFails(`
    int function bad() {
      return null;
    }

    main() {}
  `, "cannot return 'null' value from 'int' function");
});

test('static and dynamic arrays run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<int, 3> nums = [10, 20, 30];
      nums[1] = 25;

      dyn_array<int> values = [1, 2];
      values.add(3);
      values.insert(1, 9);
      int removed = values.pop();
      values.remove_at(0);
      values.resize(4);

      console.write(nums[1], ":", nums.length, ":", values, ":", removed);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '25:3:[9, 2, 0, 0]:3', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('string array and JSON lengths are read-only properties', async () => {
  const result = await runIdyllium(`
    use console;
    use json;

    main() {
      string word = "Гусь";
      dyn_array<int> values = [10, 20, 30];

      json.Object player;
      player.add("name", json.Value("Mira"));

      json.Array inventory;
      inventory.add(json.Value("Кирка"));
      inventory.add(json.Value("Факел"));

      console.write(word.length, ":", values.length, ":", player.length, ":", inventory.length);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '4:3:1:2', `unexpected length property output: ${JSON.stringify(result.output)}`);

  assertFails(`
    main() {
      dyn_array<int> values = [1, 2];
      values.length = 10;
    }
  `, "property 'length' is read-only");

  assertFails(`
    main() {
      string text = "abc";
      text.length = 10;
    }
  `, "property 'length' is read-only");

  assertFails(`
    use json;

    main() {
      json.Array values;
      values.length = 10;
    }
  `, "property 'length' is read-only");
});

test('legacy collection length method calls are rejected', () => {
  assertFails(`
    main() {
      dyn_array<int> values = [1, 2];
      int count = values.length();
    }
  `, "has no method 'length'");

  assertFails(`
    main() {
      string text = "abc";
      int count = text.length();
    }
  `, "type 'string' has no method 'length'");

  assertFails(`
    use json;

    main() {
      json.Object value;
      int count = value.length();
    }
  `, "type 'json.Object' has no method 'length'");
});

test('arrays use value semantics for assignments parameters and returns', async () => {
  const result = await runIdyllium(`
    use console;

    array<int, 3> function changed(array<int, 3> values) {
      values[0] = 90;
      return values;
    }

    main() {
      array<int, 3> original = [1, 2, 3];
      array<int, 3> assigned = original;
      assigned[1] = 80;

      array<int, 3> returned = changed(original);
      console.write(original, ":", assigned, ":", returned);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '[1, 2, 3]:[1, 80, 3]:[90, 2, 3]',
    `unexpected array value output: ${JSON.stringify(result.output)}`,
  );
});

test('static and dynamic arrays convert by value in both directions', async () => {
  const result = await runIdyllium(`
    use console;

    array<int, 20> function repeat_to_20(dyn_array<int> arr) {
      dyn_array<int> tmp;
      while (tmp.length < 20) {
        tmp.join(arr);
      }
      tmp.resize(20);

      array<int, 20> result = tmp;
      return result;
    }

    main() {
      array<int, 3> source = [34, 59, 20];
      dyn_array<int> repeated = repeat_to_20(source);
      repeated.add(77);

      console.writeln(source);
      console.writeln(repeated);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '[34, 59, 20]',
      '[34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 20, 34, 59, 77]',
      '',
    ].join('\n'),
    `unexpected converted array output: ${JSON.stringify(result.output)}`,
  );
});

test('dynamic arrays can satisfy fixed array parameters after a size check', async () => {
  const result = await runIdyllium(`
    use console;

    array<int, 4> function changed(array<int, 4> values) {
      values[0] = 40;
      return values;
    }

    main() {
      dyn_array<int> source = [1, 2, 3, 4];
      array<int, 4> result = changed(source);
      console.write(source, ":", result);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '[1, 2, 3, 4]:[40, 2, 3, 4]', `unexpected fixed parameter output: ${JSON.stringify(result.output)}`);
});

test('nested static and dynamic arrays convert recursively', async () => {
  const result = await runIdyllium(`
    use console;

    dyn_array<dyn_array<int>> function touch(dyn_array<dyn_array<int>> matrix) {
      matrix[0][0] += 100;
      matrix[0].add(9);
      return matrix;
    }

    main() {
      dyn_array<array<int, 3>> first = [[1, 2, 3], [4, 5, 6]];
      array<dyn_array<int>, 2> second = [[10], [20, 30]];
      array<array<int, 2>, 2> third = [[40, 41], [50, 51]];

      dyn_array<dyn_array<int>> first_result = touch(first);
      dyn_array<dyn_array<int>> second_result = touch(second);
      dyn_array<dyn_array<int>> third_result = touch(third);

      console.writeln(first, ":", first_result);
      console.writeln(second, ":", second_result);
      console.writeln(third, ":", third_result);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      '[[1, 2, 3], [4, 5, 6]]:[[101, 2, 3, 9], [4, 5, 6]]',
      '[[10], [20, 30]]:[[110, 9], [20, 30]]',
      '[[40, 41], [50, 51]]:[[140, 41, 9], [50, 51]]',
      '',
    ].join('\n'),
    `unexpected nested conversion output: ${JSON.stringify(result.output)}`,
  );
});

test('array value comparisons are structural', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<array<int, 2>, 3> fixed = [[1, 2], [3, 4], [1, 2]];
      dyn_array<dyn_array<int>> dynamic = [[1, 2], [3, 4], [1, 2]];

      console.write(
        fixed == dynamic, ":",
        fixed.contains([1, 2]), ":",
        fixed.find([3, 4]), ":",
        fixed.count([1, 2])
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'true:true:1:2', `unexpected array comparison output: ${JSON.stringify(result.output)}`);
});

test('arrays quote and escape string values', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<string, 3> tools = ["Кирка\\n", "Топор\\n", "Меч"];
      console.write(tools, ":", "Кирка\\n");
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '["Кирка\\n", "Топор\\n", "Меч"]:Кирка\n',
    `unexpected escaped array output: ${JSON.stringify(result.output)}`,
  );
});

test('array aggregate functions run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      array<int, 4> nums = [10, 5, 8, 12];
      dyn_array<float> vals = [1.5, 2.0, 3.5];

      console.write(max(nums), " ", sum(nums), " ", avg(nums), " ", max(vals));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '12 35 8.75 3.5', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('array diagnostics are readable', () => {
  assertFails(`
    main() {
      dyn_array<int> arr = [1, 2, 3];
      int value = arr[1.5];
    }
  `, 'array index must be integer');

  assertFails(`
    main() {
      array<int, 2> arr = [1, 2];
      arr.add(3);
    }
  `, "only available on 'dyn_array'");

  assertFails(`
    main() {
      array<string, 2> words = ["кот", "собака"];
      string word = max(words);
    }
  `, "expects a numeric array");

  assertFails(`
    main() {
      array<int, 2> source = [1, 2];
      array<int, 3> target = source;
    }
  `, "cannot assign 'array<int, 2>' value to 'array<int, 3>' variable");

  assertFails(`
    main() {
      array<string, 2> source = ["1", "2"];
      dyn_array<int> target = source;
    }
  `, "cannot assign 'array<string, 2>' value to 'dyn_array<int>' variable");
});

test('dynamic to static array conversion errors are readable', async () => {
  await assertRuntimeFails(`
    main() {
      dyn_array<int> source = [1, 2, 3];
      array<int, 4> target = source;
    }
  `, "the value has 3 elements, but 'array<int, 4>' needs 4");

  await assertRuntimeFails(`
    main() {
      dyn_array<dyn_array<int>> source = [[1, 2], [3]];
      array<array<int, 2>, 2> target = source;
    }
  `, "the value has 1 element, but 'array<int, 2>' needs 2");

  await assertRuntimeFails(`
    void function expects_four(array<int, 4> values) {
    }

    main() {
      dyn_array<int> source = [1, 2];
      expects_four(source);
    }
  `, "the value has 2 elements, but 'array<int, 4>' needs 4");
});

test('array out of bounds runtime error is readable', async () => {
  const source = [
    'use console;',
    '',
    'main() {',
    '    dyn_array<int> arr = [44, 35, 122];',
    '    console.write(arr[5]);',
    '}',
  ].join('\n');

  const result = await runIdyllium(source, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected runtime failure');
  assert(
    result.runtimeError === 'main.idyl:5: runtime error: array index 5 out of bounds (size 3, valid indices 0-2)',
    `unexpected runtime error: ${JSON.stringify(result.runtimeError)}`,
  );
});

test('string methods and character indexing run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      string bird = "Гусь";
      string word = "Привет";
      string data = "яблоко,банан,апельсин";
      dyn_array<string> fruits = data.split(",");

      console.write(
        bird.length, ":", bird[2], ":",
        word.to_upper(), ":", word.to_lower(), ":",
        "Кот и кот и ещё кот".replace("кот", "пёс"), ":",
        "aBcDeFgHiJk".substring(1, 3), ":",
        "абракадабра".count("абра"), ":",
        "Кот и собака".find("собака"), ":",
        "Hello".contains('e'), ":",
        "123".is_int(), ":", "12.5".is_float(), ":",
        fruits
      );
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '4:с:ПРИВЕТ:привет:Кот и пёс и ещё пёс:BcD:2:6:true:true:true:["яблоко", "банан", "апельсин"]',
    `unexpected output: ${JSON.stringify(result.output)}`,
  );
});

// Контракт стражей (SM1, 2026-08-22): is_int/is_float истинны РОВНО там, где
// to_int/to_float сработают — "50".is_float() было false при живом to_float("50").

test('string indexing errors are readable', async () => {
  const source = [
    'use console;',
    '',
    'main() {',
    '    string p = "Гусь";',
    '    console.write(p[4]);',
    '}',
  ].join('\n');

  const result = await runIdyllium(source, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected runtime failure');
  assert(
    result.runtimeError === 'main.idyl:5: runtime error: string index 4 out of bounds (length 4, valid indices 0-3)',
    `unexpected runtime error: ${JSON.stringify(result.runtimeError)}`,
  );
});

test('string characters are read-only', () => {
  assertFails(`
    main() {
      string text = "abc";
      text[0] = 'x';
    }
  `, 'string characters are read-only');
});

test('try catch exposes a structured runtime error', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      try {
        console.writeln(10 / 0);
      } catch (error) {
        console.writeln(error.message);
        console.writeln(error.file);
        console.writeln(error.line);
        console.writeln(error.to_string());
      }
    }
  `, {}, { file: '/workspace/main.idyl' });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === [
      'division by zero',
      'main.idyl',
      '6',
      'main.idyl:6: runtime error: division by zero',
      '',
    ].join('\n'),
    `unexpected catch output: ${JSON.stringify(result.output)}`,
  );
});

test('catch without a binding handles runtime errors', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      try {
        int value = to_int("кот");
        console.writeln(value);
      } catch {
        console.writeln("fallback");
      }
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'fallback\n', `unexpected catch output: ${JSON.stringify(result.output)}`);
});

test('finally runs after success and after a caught error', async () => {
  const success = await runIdyllium(`
    use console;

    main() {
      try {
        console.write("try");
      } finally {
        console.write(":finally");
      }
    }
  `);
  assert(success.success, success.runtimeError ?? success.compilation.diagnosticsText);
  assert(success.output === 'try:finally', `unexpected successful finally output: ${JSON.stringify(success.output)}`);

  const caught = await runIdyllium(`
    use console;

    main() {
      try {
        console.write(1 / 0);
      } catch {
        console.write("caught");
      } finally {
        console.write(":finally");
      }
    }
  `);
  assert(caught.success, caught.runtimeError ?? caught.compilation.diagnosticsText);
  assert(caught.output === 'caught:finally', `unexpected caught finally output: ${JSON.stringify(caught.output)}`);
});

test('try finally preserves an unhandled runtime error', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      try {
        console.write(1 / 0);
      } finally {
        console.write("cleanup");
      }
    }
  `, {}, { file: 'main.idyl' });

  assert(!result.success, 'expected unhandled error to escape try/finally');
  assert(result.output === 'cleanup', `expected finally output, got ${JSON.stringify(result.output)}`);
  assert(result.runtimeError === 'main.idyl:6: runtime error: division by zero', `unexpected runtime error: ${result.runtimeError}`);
});

test('catch variables and fields are read-only and scoped', () => {
  assertFails(`
    main() {
      try {
        float value = 1 / 0;
      } catch (error) {
        error = error;
      }
    }
  `, "cannot assign to constant 'error'");

  assertFails(`
    main() {
      try {
        float value = 1 / 0;
      } catch (error) {
        error.message = "changed";
      }
    }
  `, "property 'message' is read-only");

  assertFails(`
    main() {
      try {
        float value = 1 / 0;
      } catch (error) {
      }
      string message = error.message;
    }
  `, "'error' was not declared in this scope");
});

test('try grammar diagnostics are readable', () => {
  assertFails(`
    main() {
      try {
        int value = 1;
      }
    }
  `, "'try' must be followed by 'catch' or 'finally'");

  assertFails(`
    main() {
      catch {
      }
    }
  `, "'catch' has no matching 'try'");
});

test('try catch satisfies return analysis when both paths return', async () => {
  const result = await runIdyllium(`
    use console;

    int function divide_or_zero(int divisor) {
      try {
        return to_int(10 / divisor);
      } catch {
        return 0;
      }
    }

    main() {
      console.write(divide_or_zero(2), ":", divide_or_zero(0));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '5:0', `unexpected try return output: ${JSON.stringify(result.output)}`);
});

test('while and do-while loops run', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      int count = 1;
      while (count <= 3) {
        console.write(count);
        count = count + 1;
      }

      int guess = 0;
      do {
        guess = guess + 1;
      } while (guess < 2);

      console.write(":", guess);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '123:2', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('for loop with break and continue runs', async () => {
  const result = await runIdyllium(`
    use console;

    main() {
      for (int i = 1; i <= 5; i = i + 1) {
        if (i == 2) {
          continue;
        }
        if (i == 5) {
          break;
        }
        console.write(i);
      }
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '134', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('functions return values', async () => {
  const result = await runIdyllium(`
    use console;

    int function modul_chisla(int chislo) {
      int res = chislo;
      if (chislo < 0) {
        res = -chislo;
      }
      return res;
    }

    main() {
      console.write(modul_chisla(-23), " ", modul_chisla(-40));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '23 40', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('typed main returns a value but program ignores it', async () => {
  const result = await runIdyllium(`
    use console;

    string function main() {
      console.write("typed main");
      return "ignored";
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'typed main', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('typed main can use any normal return type', () => {
  assertCompiles(`
    array<int, 2> function main() {
      array<int, 2> values = [10, 20];
      return values;
    }
  `);

  assertCompiles(`
    class Cat {
      public:
      string name;
    }

    Cat function main() {
      Cat cat;
      cat.name = "Мурка";
      return cat;
    }
  `);

  assertCompiles(`
    void function main() {
    }
  `);
});

test('typed main diagnostics are readable', () => {
  assertFails(`
    int function main() {
    }
  `, "function with return type 'int' must return a value");

  assertFails(`
    int function main(int exit_code) {
      return exit_code;
    }
  `, "entry point 'main' cannot have parameters");

  assertFails(`
    main() {
    }

    string function main() {
      return "again";
    }
  `, "entry point 'main' is already declared");
});

test('default arguments run for functions methods and constructors', async () => {
  const result = await runIdyllium(`
    use console;

    int function sub(int left, int right = 10) {
      return left - right;
    }

    int function add_twice(int first, int second = first) {
      return first + second;
    }

    class Counter {
      int value;

      constructor Counter(int start = 5) {
        this.value = start;
      }

      void function add(int amount = 1) {
        this.value += amount;
      }

      int function get() {
        return this.value;
      }
    }

    main() {
      Counter a();
      a.add();
      a.add(4);

      Counter b(10);
      b.add();

      console.write(sub(50), ":", sub(50, 30), ":", add_twice(7), ":", a.get(), ":", b.get());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '40:20:14:10:11', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('default argument diagnostics are readable', () => {
  assertFails(`
    void function greet(string name = "Мира", string suffix) {
    }

    main() {}
  `, "parameter 'suffix' without default value cannot follow a parameter with default value");

  assertFails(`
    void function print_num(int value = "сорок два") {
    }

    main() {}
  `, "default value for parameter 'value' expects 'int', got 'string'");

  assertFails(`
    int function sub(int left, int right = 10) {
      return left - right;
    }

    main() {
      int value = sub();
    }
  `, "'sub' expects 1 or 2 arguments, got 0");
});

test('named arguments run for functions stdlib methods and constructors', async () => {
  const result = await runIdyllium(`
    use colors;
    use console;
    use math;

    int function sub(int left, int right = 10) {
      return left - right;
    }

    class Counter {
      int value;

      constructor Counter(int start = 5) {
        this.value = start;
      }

      void function add(int amount = 1) {
        this.value += amount;
      }
    }

    main() {
      Counter counter(start=20);
      counter.add(amount=3);

      string text = "кот и пёс";
      string replaced = text.replace(new_text="дракон", old_text="пёс");
      colors.Color color = colors.RGB(blue=30, red=10, green=20);
      gui_dummy(color);

      console.write(
        sub(right=50, left=30), ":",
        sub(50, right=5), ":",
        math.clamp(max=10, min=0, value=25), ":",
        div(right=4, left=21), ":",
        replaced, ":",
        counter.value
      );
    }

    void function gui_dummy(colors.Color value) {
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '-20:45:10:5:кот и дракон:23', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('named arguments work across user modules', async () => {
  const result = await runIdyllium(`
    use console;
    use math_tools;

    main() {
      console.write(math_tools.sub(right=50, left=30), ":", math_tools.sub(30));
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function sub(int left, int right = 10) {
          return left - right;
        }
      `,
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '-20:20', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('named argument diagnostics are readable', () => {
  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(left=50, 30);
    }
  `, 'positional argument cannot follow named argument');

  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(50, left=30);
    }
  `, "'sub' argument 'left' was already provided");

  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(left=30);
    }
  `, "'sub' missing required argument 'right'");

  assertFails(`
    int function sub(int left, int right) {
      return left - right;
    }

    main() {
      int value = sub(start=30);
    }
  `, "'sub' has no argument named 'start'");

  assertFails(`
    use console;

    main() {
      console.write(value=42);
    }
  `, "'write' does not support named arguments");
});

test('recursive functions run', async () => {
  const result = await runIdyllium(`
    use console;

    int function factorial(int n) {
      if (n <= 1) {
        return 1;
      }
      return n * factorial(n - 1);
    }

    int function sum_to(int n) {
      if (n <= 1) {
        return n;
      }
      return n + sum_to(n - 1);
    }

    main() {
      console.write(factorial(5), ":", sum_to(5));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '120:15', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user classes fields methods this and constructors run', async () => {
  const result = await runIdyllium(`
    use console;

    class Cat {
      string name;

      constructor Cat(string ex_name) {
        this.name = ex_name;
      }

      void function meow() {
        console.writeln(this.name, " мяукнул!");
      }

      string function to_string() {
        return "Cat(" + this.name + ")";
      }
    }

    main() {
      Cat cat1("Барсик");
      Cat cat2("Мурка");
      cat1.meow();
      cat2.meow();
      console.writeln(cat1);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Барсик мяукнул!\nМурка мяукнул!\nCat(Барсик)\n', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user class diagnostics are readable', () => {
  assertFails(`
    class Cat {
      string name;
      void function meow() {}
    }

    main() {
      Cat.meow();
      string n = Cat.name;
    }
  `, "instance method 'Cat.meow' must be called on an object");

  assertFails(`
    class Animal {
      constructor Animal(string name) {}
    }

    main() {
      Animal animal(42);
    }
  `, "'Animal' argument 1 expects 'string', got 'int'");
});

test('inheritance parent constructors and polymorphic dispatch run', async () => {
  const result = await runIdyllium(`
    use console;

    class Animal {
      string name;

      constructor Animal(string ex_name) {
        this.name = ex_name;
      }

      void function speak() {
        console.writeln("...");
      }
    }

    class Dog extends Animal {
      constructor Dog(string ex_name) {
        parent(ex_name);
      }

      void function speak() {
        console.writeln(this.name, " гавкнул");
      }
    }

    main() {
      Dog dog("Рекс");
      Animal animal = dog;
      animal.speak();
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Рекс гавкнул\n', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('user function parameters accept subclass objects', async () => {
  const result = await runIdyllium(`
    use console;

    class Animal {
      string name;

      constructor Animal(string ex_name) {
        this.name = ex_name;
      }

      void function speak() {
        console.writeln("...");
      }
    }

    class Cat extends Animal {
      constructor Cat(string ex_name) {
        parent(ex_name);
      }

      void function speak() {
        console.writeln(this.name, " мяукнул");
      }
    }

    void function ask_to_speak(Animal animal) {
      animal.speak();
    }

    main() {
      Cat cat("Барсик");
      ask_to_speak(cat);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Барсик мяукнул\n', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('private class members are available only inside owner class', async () => {
  const result = await runIdyllium(`
    use console;

    class Hero {
      private:
      int hp;

      void function clamp_hp() {
        if (this.hp > 100) {
          this.hp = 100;
        }
      }

      public:
      string name;

      constructor Hero(string ex_name, int ex_hp) {
        this.name = ex_name;
        this.hp = ex_hp;
        this.clamp_hp();
      }

      void function heal(int amount) {
        this.hp += amount;
        this.clamp_hp();
      }

      int function get_hp() {
        return this.hp;
      }
    }

    main() {
      Hero hero("Воин", 40);
      hero.heal(75);
      console.write(hero.name, ":", hero.get_hp());
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === 'Воин:100', `unexpected output: ${JSON.stringify(result.output)}`);

  assertFails(`
    class BankAccount {
      private:
      int balance;
    }

    main() {
      BankAccount acc;
      acc.balance = 1000;
    }
  `, "member 'BankAccount.balance' is private and can only be used inside class 'BankAccount'");

  assertFails(`
    class Hero {
      private:
      void function secret() {}
    }

    main() {
      Hero hero;
      hero.secret();
    }
  `, "member 'Hero.secret' is private and can only be used inside class 'Hero'");

  assertFails(`
    class Animal {
      private:
      int age;
    }

    class Dog extends Animal {
      public:
      void function grow() {
        this.age += 1;
      }
    }
  `, "member 'Animal.age' is private and can only be used inside class 'Animal'");
});

test('static method diagnostics are readable', () => {
  assertFails(`
    use console;

    class Cat {
      string name;

      static void function meow() {
        console.writeln(this.name);
      }
    }
  `, "'this' cannot be used in a static method");

  assertFails(`
    class MathUtils {
      static int function square(int x) {
        return x * x;
      }
    }

    main() {
      MathUtils m;
      int y = m.square(5);
    }
  `, "static method 'MathUtils.square' must be called on class 'MathUtils'");
});

test('user modules expose functions and classes across files', async () => {
  const result = await runIdyllium(`
    use console;
    use math_tools;
    use rect;

    main() {
      rect.Rect r;
      r.width = 20;
      r.height = 30;
      console.write(math_tools.square(), ":", math_tools.square(5), ":", r.getArea());
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function square(int x = 4) {
          return x * x;
        }
      `,
      'rect.idyl': `
        class Rect {
          float width;
          float height;

          float function getArea() {
            return this.width * this.height;
          }
        }
      `,
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '16:25:600', `unexpected output: ${JSON.stringify(result.output)}`);
});

// Static-члены модульных классов (вердикт владельца, 2026-08-22): трёхзвенный
// доступ module.Class.member — раньше «class 'zoo.Lion' cannot be used as a value».

test('module class statics work through module.Class.member', async () => {
  const zooSource = `class Lion {
    const int MAX_AGE = 25;
    static int pride = 0;

    private:
    static int secret = 7;

    public:
    string name = "лев";

    constructor Lion() {
        Lion.pride = Lion.pride + 1;
    }

    static string function roar() {
        return "Р-Р-Р";
    }
}
`;
  const happy = await runIdyllium(`use console;
use zoo;
main() {
    console.writeln(zoo.Lion.roar(), " ", zoo.Lion.MAX_AGE);
    zoo.Lion a();
    zoo.Lion b();
    console.writeln(zoo.Lion.pride);
    zoo.Lion.pride += 8;
    console.writeln(zoo.Lion.pride);
}
`, {}, { file: 'main.idyl', sources: { 'zoo.idyl': zooSource } });
  assert(
    happy.output === 'Р-Р-Р 25\n2\n10\n',
    `module statics happy path: ${JSON.stringify(happy.output)} ${happy.runtimeError ?? happy.compilation.diagnosticsText}`,
  );

  const misuse = await runIdyllium(`use console;
use zoo;
main() {
    zoo.Lion.MAX_AGE = 30;
    console.writeln(zoo.Lion.secret);
    zoo.Lion cub();
    console.writeln(cub.pride);
    console.writeln(zoo.Lion.name);
}
`, {}, { file: 'main.idyl', sources: { 'zoo.idyl': zooSource } });
  const diagnostics = misuse.compilation.diagnosticsText;
  for (const expected of [
    "cannot assign to class constant 'zoo.Lion.MAX_AGE'",
    "member 'zoo.Lion.secret' is private and can only be used inside class 'zoo.Lion'",
    "static field 'zoo.Lion.pride' must be accessed through class 'zoo.Lion'",
    "instance field 'zoo.Lion.name' must be accessed through an object",
  ]) {
    assert(diagnostics.includes(expected), `module statics refusal missing «${expected}»: ${diagnostics}`);
  }
});

test('user modules expose readonly named constants', async () => {
  const mainSource = [
    'use console;',
    'use config;',
    '',
    'main() {',
    '    console.writeln(config.MAX_PLAYERS);',
    '}',
  ].join('\n');
  const configSource = 'const int MAX_PLAYERS = 8;\n';
  const result = await runIdyllium(mainSource, {}, {
    file: 'main.idyl',
    sources: { 'config.idyl': configSource },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '8\n', `unexpected module constant output: ${JSON.stringify(result.output)}`);

  const assignment = compileIdyllium(`
    use config;

    main() {
      config.MAX_PLAYERS = 10;
    }
  `, {
    file: 'main.idyl',
    sources: { 'config.idyl': configSource },
  });
  assert(!assignment.success, 'expected imported constant assignment failure');
  assert(
    assignment.diagnosticsText.includes("cannot assign to constant 'config.MAX_PLAYERS'"),
    `unexpected imported constant diagnostic:\n${assignment.diagnosticsText}`,
  );

  const project = new IdylliumProject({
    entryFile: 'main.idyl',
    files: { 'main.idyl': mainSource, 'config.idyl': configSource },
  });
  const completionOffset = mainSource.indexOf('config.MAX_PLAYERS') + 'config.'.length;
  const completions = project.completions({ file: 'main.idyl', offset: completionOffset });
  assert(
    completions.some((item) => item.name === 'MAX_PLAYERS' && item.kind === 'constant'),
    'expected imported constant completion',
  );
  const definition = project.definition({
    file: 'main.idyl',
    offset: mainSource.indexOf('MAX_PLAYERS') + 1,
  });
  assert(definition?.file === 'config.idyl', `expected config.idyl definition, got ${definition?.file}`);
  assert(definition?.range.start.line === 1, `expected constant definition on line 1, got ${definition?.range.start.line}`);
});

test('array fields on imported user classes keep value semantics', async () => {
  const result = await runIdyllium(`
    use console;
    use storage;

    main() {
      storage.Holder holder;
      array<int, 2> source = [1, 2];

      holder.values = source;
      source[0] = 9;
      holder.values.add(3);

      console.write(source, ":", holder.values);
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'storage.idyl': `
        class Holder {
          dyn_array<int> values;
        }
      `,
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '[9, 2]:[1, 2, 3]', `unexpected module array field output: ${JSON.stringify(result.output)}`);
});

test('user module diagnostics are checked across files', () => {
  const badArgument = compileIdyllium(`
    use math_tools;

    main() {
      int value = math_tools.square("5");
    }
  `, {
    file: 'main.idyl',
    sources: {
      'math_tools.idyl': `
        int function square(int x) {
          return x * x;
        }
      `,
    },
  });

  assert(!badArgument.success, 'expected module argument type failure');
  assert(
    badArgument.diagnosticsText.includes("'square' argument 1 expects 'int', got 'string'"),
    `unexpected diagnostics:\n${badArgument.diagnosticsText}`,
  );

  const cycle = compileIdyllium(`
    use a;

    main() {}
  `, {
    file: 'main.idyl',
    sources: {
      'a.idyl': 'use b;',
      'b.idyl': 'use a;',
    },
  });

  assert(!cycle.success, 'expected module cycle failure');
  assert(cycle.diagnosticsText.includes('module import cycle detected: a -> b -> a'), `unexpected diagnostics:\n${cycle.diagnosticsText}`);
});

test('constructor calls create independent values in arbitrary expressions', async () => {
  const result = await runIdyllium(`
    use console;

    int function initial_score() {
      return 7;
    }

    class Health {
      int value = initial_score();

      constructor Health(int bonus = 0) {
        this.value += bonus;
      }
    }

    class Animal {
      string name;

      constructor Animal(string ex_name) {
        this.name = ex_name;
      }

      string function describe() {
        return this.name;
      }
    }

    class Hero extends Animal {
      Health health = Health(3);

      constructor Hero(string ex_name, int hp = 100) {
        parent(ex_name);
        this.health.value = hp;
      }

      int function get_hp() {
        return this.health.value;
      }
    }

    class Empty {
      int value = 42;
    }

    class CalculatedField {
      int base = 9;
      int doubled = this.double_base();

      int function double_base() {
        return this.base * 2;
      }
    }

    Hero function create_hero() {
      return Hero("Aranthir", 1000);
    }

    string function animal_name(Animal animal) {
      return animal.describe();
    }

    main() {
      dyn_array<Hero> heroes;
      heroes.add(Hero("Kaspar", 500));
      heroes.add(Hero("Raven", 600));
      heroes.add(Hero(hp=750, ex_name="Ornella"));

      Hero copy = Hero("Kaspar", 500);
      copy.health.value = 1;

      dyn_array<Empty> empty_values;
      empty_values.resize(2);

      console.writeln(heroes[0].get_hp(), ":", copy.get_hp());
      console.writeln(create_hero().get_hp());
      console.writeln(Hero("Mira").get_hp());
      console.writeln(animal_name(Hero("Liam", 90)));
      console.writeln(Empty().value, ":", empty_values[0].value, ":", empty_values[1].value);
      console.writeln(CalculatedField().doubled);
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '500:1\n1000\n100\nLiam\n42:42:42\n18\n',
    `unexpected constructor-expression output: ${JSON.stringify(result.output)}`,
  );
});

test('constructor expressions work for classes imported from user modules', async () => {
  const result = await runIdyllium(`
    use console;
    use geometry;

    main() {
      dyn_array<geometry.Point> points;
      points.add(geometry.Point(10, 20));
      points.add(geometry.Point(y=7, x=5));
      console.writeln(points[0].sum(), ":", geometry.Point(3, 4).sum(), ":", points[1].sum());
    }
  `, {}, {
    file: 'main.idyl',
    sources: {
      'geometry.idyl': `
        class Point {
          int x;
          int y;

          constructor Point(int x, int y = 1) {
            this.x = x;
            this.y = y;
          }

          int function sum() {
            return this.x + this.y;
          }
        }
      `,
    },
  });

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '30:7:12\n', `unexpected module constructor output: ${JSON.stringify(result.output)}`);
});

test('constructor expression diagnostics cover arguments and private access', async () => {
  const privateFactory = await runIdyllium(`
    use console;

    class Hero {
      private:
      int hp;

      constructor Hero(int ex_hp) {
        this.hp = ex_hp;
      }

      public:
      static Hero function create(int hp) {
        return Hero(hp);
      }

      int function get_hp() {
        return this.hp;
      }
    }

    main() {
      Hero hero = Hero.create(77);
      console.writeln(hero.get_hp());
    }
  `);
  assert(privateFactory.success, privateFactory.runtimeError ?? privateFactory.compilation.diagnosticsText);
  assert(privateFactory.output === '77\n', `unexpected private factory output: ${JSON.stringify(privateFactory.output)}`);

  assertFails(`
    class Hero {
      private:
      constructor Hero(int hp) {}

      public:
      static Hero function create(int hp) {
        return Hero(hp);
      }
    }

    main() {
      Hero hero = Hero(100);
    }
  `, "constructor 'Hero' is private");

  assertFails(`
    class Empty {}

    main() {
      Empty value = Empty(1);
    }
  `, "'Empty' expects 0 arguments, got 1");

  assertFails(`
    class Hero {
      constructor Hero(string name, int hp) {}
    }

    main() {
      Hero value = Hero(name="Mira");
    }
  `, "'Hero' missing required argument 'hp'");
});

test('unicode identifiers are valid', async () => {
  const result = await runIdyllium(`
    use console;

    int function имя_функции(int входные_данные) {
      int выходные_данные = входные_данные + 1;
      return выходные_данные;
    }

    main() {
      console.write(имя_функции(41));
    }
  `);

  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(result.output === '42', `unexpected output: ${JSON.stringify(result.output)}`);
});

test('return and loop control diagnostics', () => {
  assertFails(`
    main() {
      break;
    }
  `, 'only valid inside a loop');

  assertFails(`
    int function bad() {
      return "nope";
    }

    main() {}
  `, "cannot return 'string'");

  assertFails(`
    int function missing_return(int value) {
      int doubled = value * 2;
    }

    main() {}
  `, "function with return type 'int' must return a value");
});

test('brace-less if branches run and orphan else diagnostics are readable', async () => {
  const valid = await runIdyllium(`
    use console;

    main() {
        int value = 214;

        if (value > 200)
            console.write("A");
        else
            console.write("B");

        if (value > 200)
            console.write("C");
        console.write("D");
    }
  `);

  assert(valid.success, valid.runtimeError ?? valid.compilation.diagnosticsText);
  assert(valid.output === 'ACD', `unexpected brace-less if output: ${JSON.stringify(valid.output)}`);

  const invalid = compileIdyllium(`
    use console;

    main() {
        int value = 214;

        if (value > 200)
            console.writeln(value);
        console.writeln("always");
        else
            console.writeln("other");
    }
  `, { file: 'main.idyl' });

  assert(!invalid.success, 'expected orphan else compilation failure');
  assert(
    invalid.diagnosticsText.includes("'else' has no matching 'if'; without braces an if branch contains only one statement"),
    `expected readable orphan else diagnostic, got:\n${invalid.diagnosticsText}`,
  );
  assert(!invalid.diagnosticsText.includes('expected expression'), `unexpected parser cascade:\n${invalid.diagnosticsText}`);
  assert(!invalid.diagnosticsText.includes("expected ';'"), `unexpected parser cascade:\n${invalid.diagnosticsText}`);
});

test('top-level executable statements produce one readable diagnostic each', () => {
  const result = compileIdyllium(`use console;

int A = 5;

console.writeln("Hello, World!");

main() {
    console.writeln("Hello, World!");
}

console.writeln("Hello, World!");
`, { file: 'main.idyl' });

  assert(!result.success, 'expected top-level statements to fail compilation');
  assert(result.diagnostics.length === 2, `expected two diagnostics, got:\n${result.diagnosticsText}`);
  assert(
    result.diagnostics.every(
      (diagnostic) => diagnostic.message === "executable statements must be inside 'main()' or another function, not at top level",
    ),
    `unexpected top-level statement diagnostic:\n${result.diagnosticsText}`,
  );
  assert(
    result.diagnostics.map((diagnostic) => diagnostic.range.start.line).join(',') === '5,11',
    `expected diagnostics on lines 5 and 11, got:\n${result.diagnosticsText}`,
  );
  assert(!result.diagnosticsText.includes('unexpected token'), `unexpected parser cascade:\n${result.diagnosticsText}`);

  assertCompiles(`use console;

int A = 5;

main() {
    console.writeln(A);
}
`);
});

test('console must be imported', () => {
  assertFails(`
    main() {
      console.write("Nope");
    }
  `, "is not imported");
});

test('library names are reserved, function names cannot be taken by variables', async () => {
  // Имя библиотеки занимать нельзя: иначе `console` значило бы сразу две вещи.
  assertFails(`
    use console;

    main() {
      int console = 5;
    }
  `, "variable 'console' conflicts with a standard library module");

  assertFails(`
    void function gui() {}

    main() {}
  `, "function 'gui' conflicts with a standard library module");

  // Своя функция не должна молча подменять встроенную.
  assertFails(`
    int function to_string(int value) { return value; }

    main() {}
  `, "function 'to_string' conflicts with a built-in function");

  // Переменным и параметрам имена функций тоже закрыты (вердикт владельца
  // 2026-08-28): раньше `int greet = 5; greet();` компилировался и падал в
  // рантайме голым JavaScript «greet is not a function», а вызов выше
  // объявления — «Cannot access 'greet' before initialization».
  assertFails(`
    use console;

    main() {
      int sum = 100;
      console.writeln(sum);
    }
  `, "variable 'sum' conflicts with the built-in function 'sum'");

  assertFails(`
    use console;

    void function greet() {
      console.writeln("привет");
    }

    main() {
      int greet = 5;
      console.writeln(greet);
    }
  `, "variable 'greet' conflicts with the function 'greet'");

  assertFails(`
    use console;

    void function greet() {
      console.writeln("привет");
    }

    main() {
      greet();
      int greet = 5;
    }
  `, "variable 'greet' conflicts with the function 'greet'");

  assertFails(`
    use console;

    int function double_it(int double_it) {
      return double_it * 2;
    }

    main() {
      console.writeln(double_it(21));
    }
  `, "parameter 'double_it' conflicts with the function 'double_it'");

  // Полям и методам классов имена функций разрешены: у них своё пространство
  // (обращение только через объект), голым вызовам они не мешают — и встроенная
  // to_string изнутри такого класса зовётся как ни в чём не бывало.
  const classy = await runIdyllium(`
    use console;

    class Robot {
      int charge;

      string function to_string() {
        return "заряд " + to_string(this.charge);
      }
    }

    main() {
      Robot r;
      r.charge = 80;
      console.writeln(r.to_string());
    }
  `, {}, { file: 'main.idyl' });
  assert(classy.output === 'заряд 80\n', `class method may be named to_string: ${JSON.stringify(classy.output)}`);

  // Переменная именем функции ЧУЖОГО модуля легальна: модульные функции
  // зовутся только как `модуль.функция()`, голое имя им не мешает.
  const moduleCase = compileIdyllium(`use console;
use mathmod;
main() {
    int calc = mathmod.calc(2);
    console.writeln(calc);
}
`, { file: 'main.idyl', sources: { 'mathmod.idyl': 'int function calc(int x) {\n    return x * 10;\n}\n' } });
  assert(moduleCase.success, `variable may share a name with another module's function: ${moduleCase.diagnosticsText}`);

  // А вот имя САМОГО подключённого модуля занимать нельзя (улов ломателя
  // 2026-08-28): `helper.boost(...)` уходил бы в модуль, `helper.base = 1` —
  // в объект, одно имя означало бы две вещи одновременно.
  const moduleName = compileIdyllium(`use console;
use mathmod;
main() {
    int mathmod = 777;
    console.writeln(mathmod);
}
`, { file: 'main.idyl', sources: { 'mathmod.idyl': 'int function calc(int x) {\n    return x * 10;\n}\n' } });
  assert(
    moduleName.diagnosticsText.includes("variable 'mathmod' conflicts with the module 'mathmod'"),
    `variable must not take an imported module's name: ${moduleName.diagnosticsText}`,
  );

  // 'parent' в конструкторе наследника — вызов конструктора базы: переменная
  // с этим именем там запрещена (раньше порядок «вызов выше объявления» падал
  // в рантайме голым JavaScript), файловая функция 'parent' запрещена всегда
  // (вызов из конструктора наследника уходил бы то в базу, то в функцию).
  // Вне конструкторов имя 'parent' свободно — это привычное имя в GUI-коде.
  assertFails(`
    use console;

    class Base {
      int value;
    }

    class Child extends Base {
      constructor Child() {
        parent();
        int parent = 5;
      }
    }

    main() {}
  `, "variable 'parent' conflicts with the function 'parent'");

  assertFails(`
    int function parent(int x) { return x * 10; }

    main() {}
  `, "function 'parent' conflicts with the base class constructor call");

  const parentElsewhere = await runIdyllium(`
    use console;

    class Base {
      int value;

      constructor Base(int v) {
        this.value = v;
      }
    }

    class Child extends Base {
      int extra;

      constructor Child() {
        parent(7);
        this.extra = 5;
      }
    }

    int function shifted(int parent) {
      return parent + 1;
    }

    main() {
      Child c();
      int parent = shifted(10);
      console.writeln(c.value, " ", c.extra, " ", parent);
    }
  `, {}, { file: 'main.idyl' });
  assert(parentElsewhere.output === '7 5 11\n', `'parent' stays legal outside child constructors: ${JSON.stringify(parentElsewhere.output)} ${parentElsewhere.compilation.diagnosticsText}`);
});

test('math.atan2 covers all quadrants and matches drawable rotation recipe', async () => {
  const result = await runIdyllium(`
use math;
use console;

main() {
    console.set_precision(4);
    console.writeln(math.to_degrees(math.atan2(0, 1)));      // восток
    console.writeln(math.to_degrees(math.atan2(1, 0)));      // экранный «вниз» — по часовой
    console.writeln(math.to_degrees(math.atan2(0, 0 - 1)));  // запад
    console.writeln(math.to_degrees(math.atan2(0 - 1, 0)));  // экранный «вверх»
    console.writeln(math.to_degrees(math.atan2(1, 1)));      // диагональ
    console.writeln(math.atan2(0, 0));                       // особая точка — 0, не ошибка
}
`, { platform: 'cli' }, { file: 'main.idyl' });
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '0\n90\n180\n-90\n45\n0\n',
    `atan2 quadrants: ${JSON.stringify(result.output)}`,
  );
});

test('beginner mistakes get targeted hints', () => {
  // '=' вместо '==' в условии — подсказка первой строкой, лавина остаётся.
  assertFails(`
    main() {
      int x = 5;
      if (x = 5) {}
    }
  `, "assignment '=' is not allowed in a condition — did you mean '=='");

  assertFails(`
    main() {
      int x = 0;
      while (x = 3) {}
    }
  `, "did you mean '=='");

  assertFails(`
    main() {
      for (int i = 0; i = 10; i += 1) {}
    }
  `, "did you mean '=='");

  // Беглецы из C/JS: &&, ||, ! — восстановление честными and/or/not
  // оставляет ровно одну ошибку.
  assertFails(`
    main() {
      int x = 5;
      if (x > 1 && x < 10) {}
    }
  `, "'&&' is not an Idyllium operator — use 'and'");

  assertFails(`
    main() {
      int x = 5;
      if (x < 1 || x > 10) {}
    }
  `, "'||' is not an Idyllium operator — use 'or'");

  assertFails(`
    main() {
      bool flag = true;
      if (!flag) {}
    }
  `, "'!' is not an Idyllium operator — use 'not'");

  assertFails(`
    main() {
      int x = 10 % 3;
    }
  `, "'%' is not an Idyllium operator — remainder is the function mod(a, b)");

  // Инкремент/декремент — подсказка с настоящим именем переменной.
  assertFails(`
    main() {
      int score = 5;
      score++;
    }
  `, "'++' is not an Idyllium operator — write 'score = score + 1'");

  assertFails(`
    main() {
      int score = 5;
      score--;
    }
  `, "'--' is not an Idyllium operator — write 'score = score - 1'");

  // Кавычка внутри строки: токен вплотную за строковым литералом.
  assertFails(`
    use console;

    main() {
      console.writeln("she said "hi" loudly");
    }
  `, 'to put a quote inside a string, write \\"');

  // Десятичная запятая — в подсказке настоящие цифры ученика.
  assertFails(`
    main() {
      float pi = 3,14;
    }
  `, 'decimal numbers use a dot, not a comma: write 3.14');

  // Беглец из Python: elif разбирается дальше как if.
  assertFails(`
    use console;

    main() {
      int x = 5;
      if (x > 10) {
        console.writeln("big");
      } elif (x > 3) {
        console.writeln("mid");
      }
    }
  `, "'elif' is not an Idyllium keyword — write 'else if'");

  // Перевёрнутые пары: '=>' и '=!' вплотную.
  assertFails(`
    main() {
      int x = 7;
      if (x => 5) {}
    }
  `, "'=>' is not an operator — did you mean '>='");

  assertFails(`
    main() {
      int x = 5;
      if (x =! 3) {}
    }
  `, "'=!' is not an operator — did you mean '!='");

  // Решётка-комментарий: остаток строки пропускается, лавины нет.
  assertFails(`
    use console;

    main() {
      # comment attempt
      console.writeln("hi");
    }
  `, "comments start with '//' in Idyllium, not '#'");

  // Ключевое слово в роли имени.
  assertFails(`
    main() {
      int class = 5;
    }
  `, "'class' is a keyword and cannot be used as a name");

  // Незакрытая кавычка до конца строки.
  assertFails(`
    use console;

    main() {
      console.writeln("hello);
    }
  `, "string is not closed — a '\"' is missing before the end of the line");
});

test('homoglyph twin is suggested for undeclared names', () => {
  assertFails(`
    use console;

    main() {
      int cоunt = 5;
      console.writeln(count);
    }
  `, 'the two names mix Russian and English letters that look alike');
});

test('hints do not fire on legal code', () => {
  assertCompiles(`
    use console;

    main() {
      int x = 5;
      int y = x - -3;
      int elif = mod(10, 3) + div(10, 3);
      bool f = y > 1 and y < 10 or not (y == 2);
      elif = elif + 1;
      string s = "a"+"b";
      console.writeln("she said \\"hi\\"", s, f, elif, mod(3,14));
    }
  `);
});

test('forgotten parentheses and class-as-value get honest diagnostics', () => {
  // Метод без скобок в позиции statement — раньше молча ничего не делал.
  assertFails(`
    use console;

    class Hero {
      string name;
      constructor Hero(string name) { this.name = name; }
      void function info() { console.writeln(this.name); }
    }

    main() {
      Hero v = Hero("Боря");
      v.info;
    }
  `, "'info' is not called — add '()' to call it");

  // Модульная функция без скобок — раньше РОНЯЛА рантайм голым JS-ликом.
  assertFails(`
    use console;

    main() {
      console.writeln;
    }
  `, "'writeln' is not called — add '()' to call it");

  // Тип stdlib-модуля как значение.
  assertFails(`
    use gui;
    use console;

    main() {
      console.writeln(gui.Window);
    }
  `, "type 'gui.Window' cannot be used as a value");

  // Класс пользовательского модуля как значение — раньше утекал '<error>'.
  const viaModule = compileProject({
    entryFile: 'main.idyl',
    files: {
      'main.idyl': 'use cat;\n\nmain() {\n    cat.Cat.info();\n}\n',
      'cat.idyl': 'use console;\n\nclass Cat {\n    string name;\n    constructor Cat(string name) { this.name = name; }\n    void function info() { console.writeln(this.name); }\n}\n',
    },
  });
  assert(!viaModule.success, 'expected failure for class-as-value via module');
  // Со статиками модульных классов (2026-08-22) диагностика стала точнее:
  // это не «класс как значение», а вызов инстанс-метода без объекта.
  assert(
    viaModule.diagnosticsText.includes("instance method 'cat.Cat.info' must be called on an object"),
    `expected instance-method diagnostic, got:\n${viaModule.diagnosticsText}`,
  );
  assert(
    !viaModule.diagnosticsText.includes("<error>"),
    `internal '<error>' leaked:\n${viaModule.diagnosticsText}`,
  );
});

test('bare declaration never calls the constructor (owner rule, 2026-08-14)', async () => {
  // Голое объявление — заготовка; конструктор зовётся только явно.
  const result = await runIdyllium(`
use console;

class Dice {
    int sides;

    constructor Dice(int sides = 6) {
        this.sides = sides;
        console.writeln("ctor");
    }
}

main() {
    Dice quiet;
    console.writeln(quiet.sides);
    Dice usual = Dice();
    console.writeln(usual.sides);
    Dice loaded(20);
    console.writeln(loaded.sides);
}
`, { platform: 'cli' }, { file: 'main.idyl' });
  assert(result.success, result.runtimeError ?? result.compilation.diagnosticsText);
  assert(
    result.output === '0\nctor\n6\nctor\n20\n',
    `ghost rule outputs: ${JSON.stringify(result.output)}`,
  );

  // Класс без конструктора: явный вызов с нулём аргументов легален,
  // с аргументами — честная ошибка.
  assertCompiles(`
    class Box { int n; }
    main() {
      Box a;
      Box b = Box();
      Box c();
    }
  `);
  assertFails(`
    class Box { int n; }
    main() {
      Box broken = Box(5);
    }
  `, "'Box' expects 0 arguments, got 1");

  // Обязательный параметр: явные вызовы без аргументов — ошибка, голое
  // объявление — легальная заготовка.
  assertFails(`
    class Hero {
      string name;
      constructor Hero(string name) { this.name = name; }
    }
    main() {
      Hero v = Hero();
    }
  `, "'Hero' expects 1 arguments, got 0");
});

test('equals contract: static dispatch, arrays, search and library values', async () => {
  // 1. Контракт работает: ==, !=, массивы, contains/find/count, явный вызов.
  const contract = await runIdyllium(`use console;

class Hero {
    string name;
    int level;

    constructor Hero(string ex_name, int ex_level) {
        this.name = ex_name;
        this.level = ex_level;
    }

    bool function equals(Hero other) {
        return this.name == other.name and this.level == other.level;
    }
}

main() {
    Hero a = Hero("Мира", 12);
    Hero b = Hero("Мира", 12);
    Hero c = Hero("Кай", 9);
    console.write(a == b, ":", a != c, ":", a == a, ":", a.equals(c), ":");

    dyn_array<Hero> guild;
    guild.add(a);
    guild.add(c);
    console.write(guild.contains(Hero("Кай", 9)), ":", guild.find(Hero("Кай", 9)), ":", guild.count(b), ":");

    array<Hero, 2> left = [Hero("Мира", 12), Hero("Кай", 9)];
    array<Hero, 2> right = [Hero("Мира", 12), Hero("Кай", 9)];
    console.write(left == right);
}
`, {}, { file: '/main.idyl' });
  assert(contract.success, contract.runtimeError ?? contract.compilation.diagnosticsText);
  assert(contract.output === 'true:true:true:false:true:1:1:true', `contract matrix: ${contract.output}`);

  // 2. Наследование: свои контракты сосуществуют, окно выбирает контракт.
  const family = await runIdyllium(`use console;

class Animal {
    string name;

    constructor Animal(string ex_name) {
        this.name = ex_name;
    }

    bool function equals(Animal other) {
        return this.name == other.name;
    }
}

class Cat extends Animal {
    int whiskers;

    constructor Cat(string ex_name, int ex_whiskers) {
        parent(ex_name);
        this.whiskers = ex_whiskers;
    }

    bool function equals(Cat other) {
        return this.name == other.name and this.whiskers == other.whiskers;
    }
}

main() {
    Cat a = Cat("Барсик", 12);
    Cat b = Cat("Барсик", 7);
    Animal wa = a;
    Animal wb = b;
    console.write(a == b, ":", wa == wb, ":", wa == b, ":", type_name(wa));
}
`, {}, { file: '/main.idyl' });
  assert(family.success, family.runtimeError ?? family.compilation.diagnosticsText);
  assert(family.output === 'false:true:true:Cat', `family matrix: ${family.output}`);

  // 3. Без контракта — обучающие ошибки компиляции (объект, массив, поиск, sort).
  const forbidden: Array<[string, string]> = [
    ['console.write(a == b);', "cannot compare objects of class 'Pet' with '==' — declare 'bool function equals(Pet other)' in class 'Pet'"],
    ['array<Pet, 1> x = [a];\n    array<Pet, 1> y = [b];\n    console.write(x == y);', "cannot compare arrays of 'Pet' objects with '=='"],
    ['dyn_array<Pet> zoo;\n    console.write(zoo.contains(a));', "contains() cannot search for 'Pet' objects"],
    ['dyn_array<Pet> zoo;\n    zoo.sort();', "sort() cannot order 'Pet' objects — declare 'bool function less(Pet other)' in class 'Pet' and sort() will use it"],
  ];
  for (const [body, expected] of forbidden) {
    const result = compileIdyllium(`class Pet { string name; }\nmain() {\n    Pet a;\n    Pet b;\n    ${body}\n}\n`, { file: '/main.idyl' });
    assert(result.diagnosticsText.includes(expected), `expected «${expected}», got:\n${result.diagnosticsText}`);
  }

  // 4. Несовпадение окна: контракт выбирает левый операнд.
  const window = compileIdyllium(`class Animal {
    string name;
    bool function equals(Animal other) { return this.name == other.name; }
}
class Cat extends Animal {
    bool function equals(Cat other) { return this.name == other.name; }
}
main() {
    Cat c;
    Animal a;
    bool same = c == a;
}
`, { file: '/main.idyl' });
  assert(
    window.diagnosticsText.includes("'Cat.equals' accepts a 'Cat', got 'Animal'"),
    `window mismatch: ${window.diagnosticsText}`,
  );

  // 5. Контракты не наследуются: to_string тоже требует собственного объявления.
  const inheritedPrint = compileIdyllium(`use console;

class Animal {
    string function to_string() { return "зверь"; }
}
class Cat extends Animal { }
main() {
    Cat c;
    console.writeln(c);
}
`, { file: '/main.idyl' });
  assert(
    inheritedPrint.diagnosticsText.includes("cannot print object of class 'Cat' directly"),
    `to_string non-inherit: ${inheritedPrint.diagnosticsText}`,
  );

  // 6. Библиотечные значения: содержимое, null-ветки, момент и порядок штампов.
  const library = await runIdyllium(`use console;
use json;
use time;

main() {
    console.write(json.Value(5) == json.Value(5), ":");
    console.write(json.Value("а") != json.Value("б"), ":");
    json.Object a = json.parse("{\\"hero\\": \\"Мира\\", \\"hp\\": 40}").to_object();
    json.Object b = json.parse("{\\"hp\\": 40, \\"hero\\": \\"Мира\\"}").to_object();
    console.write(a.get("hp") == b.get("hp"), ":");
    json.Object with_null = json.parse("{\\"bonus\\": null}").to_object();
    console.write(with_null.get("bonus") == null, ":");

    time.stamp utc = time.from_unix(1000000, "UTC");
    time.stamp ekb = time.from_unix(1000000, "Asia/Yekaterinburg");
    time.stamp later = time.from_unix(2000000, "UTC");
    console.write(utc == ekb, ":", utc < later, ":", later >= utc, ":", utc < utc);
}
`, {}, { file: '/main.idyl' });
  assert(library.success, library.runtimeError ?? library.compilation.diagnosticsText);
  assert(library.output === 'true:true:true:true:true:true:true:false', `library values: ${library.output}`);

  // 7. Цикл в json — честная ошибка на == (жанр to_json).
  const cyclic = await runIdyllium(`use json;

main() {
    json.Object o1;
    o1.add("self", json.Value(o1));
    json.Object o2;
    o2.add("self", json.Value(o2));
    bool same = o1.get("self") == o2.get("self");
}
`, {}, { file: '/main.idyl' });
  assert(
    (cyclic.runtimeError ?? '').includes('cannot compare cyclic JSON value'),
    `cyclic ==: ${cyclic.runtimeError}`,
  );

  // 8. json.Value(объект) — ошибка компиляции.
  const wrap = compileIdyllium(`use json;
class Pet { string name; }
main() {
    Pet p;
    json.Value v = json.Value(p);
}
`, { file: '/main.idyl' });
  assert(
    wrap.diagnosticsText.includes("json.Value() cannot wrap an object of class 'Pet' — build a json.Object from its fields instead"),
    `json.Value(class): ${wrap.diagnosticsText}`,
  );

  // 9. Само-ссылочные типы полей — ошибка компиляции; dyn_array — законен.
  const selfRef = compileIdyllium(`class Person {
    string name;
    Person friend;
}
main() { }
`, { file: '/main.idyl' });
  assert(
    selfRef.diagnosticsText.includes("field 'friend' of class 'Person' creates an endless chain of default objects"),
    `self-ref: ${selfRef.diagnosticsText}`,
  );
  const tree = compileIdyllium(`class Node {
    string label;
    dyn_array<Node> children;
}
main() { }
`, { file: '/main.idyl' });
  assert(tree.success, `dyn_array self-type must stay legal:\n${tree.diagnosticsText}`);
});

test('nullable fields: empty fields, boundaries and linked structures', async () => {
  // 1. Набросок владельца: пустое поле, заселение, доступ сквозь пустоту.
  const sketch = await runIdyllium(`use console;

class Guest {
    string name;
}

class Room {
    int number;
    Guest guest = null;
}

main() {
    Room r1;
    r1.number = 101;
    Guest g1;
    g1.name = "Дракон";
    r1.guest = g1;
    console.writeln("гость ", r1.guest.name);

    Room r2;
    r2.number = 102;
    console.writeln("гость ", r2.guest.name);
}
`, {}, { file: '/main.idyl' });
  assert(sketch.output.trim() === 'гость Дракон', `sketch output: ${sketch.output}`);
  assert(
    (sketch.runtimeError ?? '').includes("field 'guest' of class 'Room' is empty (null) — check it with '!= null' before using it"),
    `empty access: ${sketch.runtimeError}`,
  );

  // 2. Проверка/выселение/type_name + связный список (анти-6 пропускает nullable).
  const list = await runIdyllium(`use console;

class Person {
    string name;
    Person friend = null;
}

main() {
    Person a;
    a.name = "Мира";
    Person b;
    b.name = "Кай";
    a.friend = b;
    console.write(a.friend != null, ":", type_name(b.friend), ":");
    a.friend = null;
    console.write(a.friend == null, ":");

    Person head;
    head.name = "1";
    Person tail;
    tail.name = "2";
    head.friend = tail;
    Person current = head;
    console.write(current.name);
    while (current.friend != null) {
        current = current.friend;
        console.write("->", current.name);
    }
}
`, {}, { file: '/main.idyl' });
  assert(list.success, list.runtimeError ?? list.compilation.diagnosticsText);
  assert(list.output === 'true:null:true:1->2', `linked list: ${list.output}`);

  // 3. Границы: аргумент и печать пустоты падают именной ошибкой.
  for (const body of ['greet(r.guest);', 'console.writeln(r.guest);']) {
    const boundary = await runIdyllium(`use console;

class Guest {
    string name;

    string function to_string() { return this.name; }
}

class Room {
    Guest guest = null;
}

void function greet(Guest g) {
    console.writeln(g.name);
}

main() {
    Room r;
    ${body}
}
`, {}, { file: '/main.idyl' });
    assert(
      (boundary.runtimeError ?? '').includes("field 'guest' of class 'Room' is empty (null)"),
      `boundary [${body}]: ${boundary.runtimeError}`,
    );
  }

  // 3б. Наследование (находка адверсариальной проверки): охрана унаследованного
  // пустого поля работает через окно потомка — все манифестации.
  const inherited = await runIdyllium(`use console;

class Guest {
    string name;
}

class Room {
    Guest guest = null;
}

class Suite extends Room {
}

main() {
    Suite s;
    console.write(s.guest == null, ":");
    Guest g;
    g.name = "Мира";
    s.guest = g;
    console.write(s.guest.name, ":");
    s.guest = null;
    Guest leak = s.guest;
    console.write("не должно напечататься");
}
`, {}, { file: '/main.idyl' });
  assert(inherited.output === 'true:Мира:', `inherited surface: ${inherited.output}`);
  assert(
    (inherited.runtimeError ?? '').includes("field 'guest' of class 'Suite' is empty (null)"),
    `inherited guard: ${inherited.runtimeError}`,
  );

  // 3в. null == null — мёртвое выражение, ошибка компиляции.
  const deadNull = compileIdyllium('main() {\n    bool b = null == null;\n}\n', { file: '/main.idyl' });
  assert(deadNull.diagnosticsText.includes("cannot compare 'null' and 'null'"), `null==null: ${deadNull.diagnosticsText}`);

  // 4. Компильные ворота: обычное поле, локал, сравнение не-nullable.
  const gates: Array<[string, string]> = [
    ['class Room { Guest guest; }\nmain() {\n    Room r;\n    r.guest = null;\n}', "cannot assign 'null' value to 'Guest'"],
    ['main() {\n    Guest g = null;\n}', "cannot assign 'null' value to 'Guest'"],
    ['class Room { Guest guest; }\nmain() {\n    Room r;\n    bool b = r.guest == null;\n}', "cannot compare 'Guest' and 'null'"],
  ];
  for (const [body, expected] of gates) {
    const result = compileIdyllium(`class Guest { string name; }\n${body}\n`, { file: '/main.idyl' });
    assert(result.diagnosticsText.includes(expected), `gate: ожидалось «${expected}», получено:\n${result.diagnosticsText}`);
  }

  // 5. Пустота и контракт equals: пустота равна только пустоте.
  const equality = await runIdyllium(`use console;

class Guest {
    string name;

    bool function equals(Guest other) {
        return this.name == other.name;
    }
}

class Room {
    Guest guest = null;
}

main() {
    Room a;
    Room b;
    console.write(a.guest == b.guest, ":");
    Guest g;
    g.name = "Мира";
    b.guest = g;
    console.write(a.guest == b.guest, ":", a.guest != b.guest);
}
`, {}, { file: '/main.idyl' });
  assert(equality.success, equality.runtimeError ?? equality.compilation.diagnosticsText);
  assert(equality.output === 'true:false:true', `empty equality: ${equality.output}`);

  // 6. Модульные классы: пустое поле и контракт equals работают через границу модуля.
  const moduleFiles = {
    'main.idyl': `use console;
use hotel;

main() {
    hotel.Room r;
    console.write(r.guest == null, ":");
    hotel.Guest g;
    g.name = "Мира";
    r.guest = g;
    hotel.Guest g2;
    g2.name = "Мира";
    console.write(r.guest.name, ":", g == g2);
}
`,
    'hotel.idyl': `class Guest {
    string name;

    bool function equals(Guest other) {
        return this.name == other.name;
    }
}

class Room {
    Guest guest = null;
}
`,
  };
  const project = compileProject({ entryFile: 'main.idyl', files: moduleFiles });
  assert(project.success, project.diagnosticsText);
  let moduleOut = '';
  const moduleRuntime = createRuntime({ console: { write: (text) => { moduleOut += text; } } });
  const AsyncFunction = Object.getPrototypeOf(async function idle() {}).constructor;
  await (await (new AsyncFunction(project.jsCode))())(moduleRuntime);
  assert(moduleOut === 'true:Мира:true', `module nullable+equals: ${moduleOut}`);
});

test('printing a function is a compile error, not a source leak', async () => {
  const cases: Array<[string, string]> = [
    ['use console;\nint function twice(int x) { return x * 2; }\nmain() {\n    console.writeln(twice);\n}\n',
      "cannot print function 'twice' — add '()' with its arguments to call it and print the result"],
    ['use console;\nuse math;\nmain() {\n    console.writeln(math.sqrt);\n}\n',
      "cannot print function 'sqrt'"],
    ['use console;\nclass Pet {\n    void function meow() { console.writeln("мяу"); }\n}\nmain() {\n    Pet p;\n    console.writeln(p.meow);\n}\n',
      "cannot print function 'meow'"],
    ['use console;\nint function twice(int x) { return x * 2; }\nmain() {\n    console.writeln(to_string(twice));\n}\n',
      "cannot print function 'twice'"],
    ['use file;\nint function twice(int x) { return x * 2; }\nmain() {\n    file.ostream fout = file.open("out.txt", "write");\n    fout.write_line(twice);\n}\n',
      "cannot print function 'twice'"],
    ['use json;\nint function twice(int x) { return x * 2; }\nmain() {\n    json.Value v = json.Value(twice);\n}\n',
      "json.Value() cannot wrap a function — call it with '()' and wrap the result"],
  ];
  for (const [source, expected] of cases) {
    const result = compileIdyllium(source, { file: '/main.idyl' });
    assert(result.diagnosticsText.includes(expected), `ожидалось «${expected}», получено:\n${result.diagnosticsText}`);
    assert(!result.success, 'must not compile');
  }
  // Легитимные колбэки не задеты: присваивание обработчика и передача в on_get.
  const legit = compileIdyllium(`use console;
use gui;
use web;

void function clicked() { console.writeln("клик"); }

void function hello(web.Request req, web.Response res) { res.send("привет"); }

main() {
    gui.Button b;
    b.on_click = clicked;
    web.Server app;
    app.on_get("/hello", hello);
}
`, { file: '/main.idyl' });
  assert(legit.success, `legit callbacks broke:\n${legit.diagnosticsText}`);
});

test('inherited equals contract is refused at compile time', async () => {
  assertFails(`
    use console;
    class A {
      int n;
      bool function equals(A other) { return this.n == other.n; }
    }
    class B extends A { }
    main() {
      B x; B y;
      console.writeln(x.equals(y));
    }
  `, "'equals' is a contract and is not inherited — declare 'bool function equals(B other)' in class 'B' and the call will use it");

  // Через переменную родительского типа контракт работает — как обещал урок.
  const viaParent = await runIdyllium(`use console;
class A {
    int n;
    bool function equals(A other) { return this.n == other.n; }
}
class B extends A { }
main() {
    B x; B y;
    A r = x;
    A q = y;
    console.writeln(r.equals(q));
}
`, {}, { file: 'main.idyl' });
  assert(viaParent.output === 'true\n', `parent-typed contract call: ${JSON.stringify(viaParent.output)}`);
});

test('order contracts: less/greater pair, sign expansion, stable sort', async () => {
  // 1. Пара контрактов: четыре знака, явные вызовы, sort() со стабильностью
  // (Ника и Лиам равны по уровню — Ника добавлена раньше и остаётся раньше).
  const pair = await runIdyllium(`use console;

class Hero {
    string name;
    int level;

    constructor Hero(string ex_name, int ex_level) {
        this.name = ex_name;
        this.level = ex_level;
    }

    bool function less(Hero other) {
        return this.level < other.level;
    }

    bool function greater(Hero other) {
        return this.level > other.level;
    }

    string function to_string() {
        return this.name;
    }
}

main() {
    Hero a = Hero("Мира", 7);
    Hero b = Hero("Лиам", 9);
    console.write(a < b, ":", a > b, ":", a <= b, ":", a >= b, ":", a.less(b), ":", b.greater(a), ":");

    dyn_array<Hero> guild;
    guild.add(Hero("Ника", 9));
    guild.add(Hero("Мира", 3));
    guild.add(Hero("Лиам", 9));
    guild.sort();
    console.write(guild);
}
`, {}, { file: '/main.idyl' });
  assert(pair.success, pair.runtimeError ?? pair.compilation.diagnosticsText);
  assert(pair.output === 'true:false:true:false:true:true:["Мира", "Ника", "Лиам"]', `order matrix: ${pair.output}`);

  // 2. Контракты независимы: одного less хватает для '<', '>=' и sort(),
  // а '>' честно просит greater (и наоборот ничего не дорисовывается сам).
  const lessOnly = await runIdyllium(`use console;

class Card {
    int rank;
    constructor Card(int ex_rank) { this.rank = ex_rank; }
    bool function less(Card other) { return this.rank < other.rank; }
}

main() {
    Card a = Card(3);
    Card b = Card(5);
    console.write(a < b, ":", a >= b);
}
`, {}, { file: '/main.idyl' });
  assert(lessOnly.success, lessOnly.runtimeError ?? lessOnly.compilation.diagnosticsText);
  assert(lessOnly.output === 'true:false', `less-only matrix: ${lessOnly.output}`);

  // 3. Обучающие отказы: нет контракта, кривая форма, смешение типов, наследник.
  const refused: Array<[string, string]> = [
    ['class P { int v; }\nmain() {\n    P a; P b;\n    bool q = a < b;\n}',
      "cannot order objects of class 'P' with '<' — declare 'bool function less(P other)' in class 'P' and '<' will use it"],
    ['class P {\n    bool function less(P other) { return true; }\n}\nmain() {\n    P a; P b;\n    bool q = a > b;\n}',
      "cannot order objects of class 'P' with '>' — declare 'bool function greater(P other)' in class 'P' and '>' will use it"],
    ['class P {\n    bool function less(P other, int extra) { return true; }\n}\nmain() {\n    P a; P b;\n    bool q = a < b;\n}',
      "(class 'P' has 'less', but it must take exactly one parameter of type 'P')"],
    ['class P {\n    bool function less(P other) { return true; }\n}\nmain() {\n    P a;\n    bool q = a < 5;\n}',
      "cannot compare 'P' and 'int'"],
    ['class P {\n    bool function less(P other) { return true; }\n}\nclass Q extends P { }\nmain() {\n    Q a; Q b;\n    bool q = a < b;\n}',
      "cannot order objects of class 'Q' with '<' — declare 'bool function less(Q other)' in class 'Q' and '<' will use it"],
  ];
  for (const [source, expected] of refused) {
    const result = compileIdyllium(source, { file: '/main.idyl' });
    assert(result.diagnosticsText.includes(expected), `expected «${expected}», got:\n${result.diagnosticsText}`);
  }
});

// Жанр «свой виджет» композицией (исследование some_widget_heirs): класс-обёртка
// с рамкой/ползунком/табло, И метод класса, повешенный колбэком напрямую —
// this внутри метода обязан жить (тонкая механика замыкания, держим смоуком).

test('extends perimeter refuses outsiders readably', async () => {
  assertFails(
    'use gui;\nclass W extends gui.Window { int n = 0; }\nmain() { }',
    "'gui.Window' cannot be extended — only ordinary widgets can: gui.Button, gui.Label, gui.Frame",
  );
  assertFails(
    'use gui;\nclass T extends gui.Timer { int n = 0; }\nmain() { }',
    "'gui.Timer' cannot be extended — only ordinary widgets can",
  );
  assertFails(
    'use json;\nclass V extends json.Value { int n = 0; }\nmain() { }',
    "'json.Value' cannot be extended — only gui widgets and your own classes can be base classes",
  );
  // Забытый импорт называется забытым импортом — тем же текстом, что и
  // 'zoo.Lion l;' без use, а не «неизвестной базой».
  assertFails(
    'use gui;\nclass F extends zoo.Lion { int n = 0; }\nmain() { }',
    "'zoo' is not imported (use 'use zoo;')",
  );
  // Имя поля наследника не смеет затенять член виджета.
  assertFails(
    'use gui;\nclass F extends gui.Button { string text = "hi"; }\nmain() { }',
    "'text' is already a member of gui.Button — pick another name",
  );

  // parent() у виджет-наследника: ровно одно целевое сообщение, без каскада.
  const parentBan = compileIdyllium(
    'use gui;\nclass F extends gui.Button {\n    int n = 0;\n    constructor F() {\n        parent();\n    }\n}\nmain() { }',
    { file: 'main.idyl' },
  );
  const text = parentBan.diagnosticsText;
  assert(
    text.includes("gui.Button has no constructor — configure the widget's properties instead of calling parent()"),
    `parent ban must be targeted: ${text}`,
  );
  assert(!text.includes("'parent' was not declared"), `parent ban must not cascade: ${text}`);

  // Неизвестная база: одно сообщение, без фантома «'parent' expects 0 arguments».
  const unknownBase = compileIdyllium(
    'class Cub extends nowhere.Lion {\n    constructor Cub(string n) {\n        parent(n);\n    }\n}\nmain() { }',
    { file: 'main.idyl' },
  );
  assert(!unknownBase.diagnosticsText.includes("'parent' expects"), `unknown base must not cascade: ${unknownBase.diagnosticsText}`);

  // Виджетная база — обращение к модулю: без 'use gui;' отказ тот же, что у
  // 'gui.Button b;'.
  assertFails(
    'class Fancy extends gui.Button { int level = 1; }\nmain() { }',
    "'gui' is not imported (use 'use gui;')",
  );
});

// parent() вне конструктора и без базы: у каждого случая свои слова, а не
// общее «function 'parent' was not declared in this scope».

test('parent() explains itself outside a constructor', async () => {
  assertFails(
    'class Animal { string name = "зверь"; }\nclass Dog extends Animal {\n    void function speak() { parent(); }\n}\nmain() { }',
    "parent() runs the constructor of the base class and can only be called in the constructor of class 'Dog'",
  );
  assertFails(
    'class Alone {\n    int n = 0;\n    constructor Alone() { parent(); }\n}\nmain() { }',
    "class 'Alone' has no base class — parent() needs 'extends'",
  );
  // У наследника виджета parent() запрещён и в методе — тем же текстом.
  assertFails(
    'use gui;\nclass Fancy extends gui.Button {\n    int n = 0;\n    void function m() { parent(); }\n}\nmain() { }',
    "gui.Button has no constructor — configure the widget's properties instead of calling parent()",
  );
});

// Улов широкой волны (2026-08-23). Переопределение не смеет забирать то, что
// база обещала всем: ни умолчание параметра, ни публичность, ни имя события.

test('an override keeps the promises of its base class', async () => {
  assertFails(`use console;
class Base {
    string function greet(string who = "мир") { return "привет, " + who; }
}
class Derived extends Base {
    string function greet(string who) { return "ПРИВЕТ, " + who; }
}
main() {
    Derived d;
    Base b = d;
    console.writeln(b.greet());
}`, "must keep the default value it has in class 'Base'");

  // O39: страж умолчаний не смеет выходить за свой сценарий. Если потомок
  // ДОБАВИЛ параметр, речь не об умолчаниях — такого параметра в базе нет
  // вовсе, и подсказка «сохраните умолчание» уводила бы в тупик.
  for (const heir of [
    'string function greet(string who, int extra) { return who; }',   // добавил параметр
    'string function greet(string who, int extra = 0) { return who; }', // добавил с умолчанием
    'string function greet(int who) { return to_string(who); }',      // сменил тип параметра
    'int function greet(string who) { return 1; }',                   // сменил тип ответа
  ]) {
    assertFails(
      `use console;\nclass Base {\n    string function greet(string who) { return who; }\n}\nclass Derived extends Base {\n    ${heir}\n}\nmain() { }`,
      "method 'Derived.greet' must match inherited method signature",
    );
  }

  assertFails(`use console;
class Base {
public:
    string function helper() { return "база"; }
}
class Derived extends Base {
private:
    string function helper() { return "секрет"; }
}
main() { }`, "method 'Derived.helper' cannot be private — it overrides a public method of class 'Base'");

  assertFails(`use console;
class Base {
private:
    string function secret() { return "механика базы"; }
public:
    string function run() { return this.secret(); }
}
class Derived extends Base {
private:
    string function secret() { return "подмена"; }
}
main() { }`, "method 'secret' is private in class 'Base' and cannot be overridden");

  assertFails(`use console;
class Base {
    event on_tick(int n);
}
class Derived extends Base {
    void function on_tick(int n) { console.writeln(n); }
}
main() { }`, "method 'on_tick' conflicts with inherited event 'Base.on_tick'");

  // Законное переопределение (со своим умолчанием) живо и полиморфно.
  const legal = await runIdyllium(`use console;
class Animal {
    string name = "зверь";
    void function speak() { console.writeln("..."); }
    string function describe(string prefix = "это ") { return prefix + this.name; }
}
class Dog extends Animal {
    void function speak() { console.writeln(this.name, ": гав"); }
    string function describe(string prefix = "пёс ") { return prefix + this.name; }
}
main() {
    Dog d;
    Animal a = d;
    a.speak();
    console.writeln(a.describe(), " / ", d.describe("собака "));
}
`, {}, { file: 'main.idyl' });
  assert(legal.output === 'зверь: гав\nпёс зверь / собака зверь\n', `legal override must survive: ${JSON.stringify(legal.output)} ${legal.runtimeError ?? legal.compilation.diagnosticsText}`);
});

// Забытый тип результата: одно сообщение и на верхнем уровне, и в классе —
// раньше верхний уровень рассыпался каскадом из девяти.

test('a function without a result type says so once at every level', async () => {
  const top = compileIdyllium(
    'use console;\n\nfunction greet(string name) {\n    console.writeln("Привет, ", name, "!");\n}\n\nmain() {\n    greet("Мира");\n}\n',
    { file: 'main.idyl' },
  );
  assert(
    top.diagnosticsText.includes("function 'greet' needs a result type before 'function' — write 'void function greet()' if it returns nothing"),
    `top-level function must be named: ${top.diagnosticsText}`,
  );
  assert(!top.diagnosticsText.includes('unexpected token'), `top-level function must not cascade: ${top.diagnosticsText}`);
});

// Имена из Object.prototype — обычные члены; имена на '__' принадлежат языку.

test('prototype names work as members, double underscore is reserved', async () => {
  const proto = await runIdyllium(`use console;
class Box {
    string toString = "начало";
    int isPrototypeOf = 5;
    int hasOwnProperty = 1;
}
main() {
    Box b;
    b.toString = "записано";
    b.isPrototypeOf = 42;
    b.hasOwnProperty = 10;
    console.writeln(b.toString, " ", b.isPrototypeOf, " ", b.hasOwnProperty);
}
`, {}, { file: 'main.idyl' });
  assert(proto.output === 'записано 42 10\n', `prototype-named fields must store values: ${JSON.stringify(proto.output)} ${proto.runtimeError ?? proto.compilation.diagnosticsText}`);

  assertFails('use console;\nclass Box { int __proto__ = 1; }\nmain() { }', "names starting with '__' are reserved by the language");
  assertFails('use console;\nmain() {\n    int __x = 5;\n}', "names starting with '__' are reserved by the language");

  // Внутреннее имя экземпляра больше не сталкивается с переменной ученика.
  const selfVar = await runIdyllium(`use console;
class Hero {
    string name = "Иван";
    int hp = 100;

    void function report() {
        string self = "постороннее слово";
        console.writeln(this.name, " / ", this.hp, " / ", self);
    }
}
main() {
    Hero h;
    h.report();
}
`, {}, { file: 'main.idyl' });
  assert(selfVar.output === 'Иван / 100 / постороннее слово\n', `a variable named self must not break this: ${JSON.stringify(selfVar.output)} ${selfVar.runtimeError ?? selfVar.compilation.diagnosticsText}`);
});

// Пустые заготовки объектов-ответов честны, а не undefined; вложенные массивы
// объектов печатаются контрактом, а не JS-нутром.

test('empty result objects and nested arrays print honestly', async () => {
  const empties = await runIdyllium(`use console;
use http;
use time;
use web;
main() {
    http.Response r;
    time.stamp t;
    web.Request q;
    console.writeln(r.status, " / ", t, " / [", q.path, "]");
}
`, {}, { file: 'main.idyl' });
  assert(
    empties.output === '0 / 1970-01-01 00:00:00 / []\n',
    `empty result objects must be honestly empty: ${JSON.stringify(empties.output)} ${empties.runtimeError ?? empties.compilation.diagnosticsText}`,
  );

  const nested = await runIdyllium(`use console;
class Item {
    string name = "меч";
    string function to_string() { return "предмет " + this.name; }
}
main() {
    array<array<Item, 2>, 1> grid;
    console.writeln(grid);
}
`, {}, { file: 'main.idyl' });
  assert(
    nested.output === '[["предмет меч", "предмет меч"]]\n',
    `nested arrays must use the to_string contract: ${JSON.stringify(nested.output)} ${nested.runtimeError ?? nested.compilation.diagnosticsText}`,
  );
});

// Дерево виджетов без конца: и add_child, и add_tab отвечают словами.

test('a blank result object has the whole shape of its type', async () => {
  const result = await runIdyllium(`use console;
use http;
use web;

main() {
    http.Response blank;
    console.writeln(blank.status, " ", blank.ok, " [", blank.text, "] [", blank.header("Content-Type"), "]");

    web.Request q;
    console.writeln("[", q.path, "] [", q.query("x"), "] [", q.param("id"), "] [", q.form("name"), "]");

    web.Response r;
    console.writeln(r.status);
}
`, {}, { file: 'main.idyl' });
  assert(
    result.output === '0 false [] []\n[] [] [] []\n0\n',
    `a blank must answer with empty values, not crash: ${JSON.stringify(result.output)} ${result.runtimeError ?? result.compilation.diagnosticsText}`,
  );

  // Отвечать заготовке некому — и молчать об этом она не должна.
  await assertRuntimeFails(`use web;
main() {
    web.Response r;
    r.send("привет");
}
`, 'web.Response.send() has nothing to answer');
});

// Размер массива выражением (находка владельца, 2026-08-23): array<int, SIZE*SIZE>
// раньше давал каскад из пяти сообщений про '>' — при том, что фолдер констант
// умел считать такие выражения с самого начала.

test('an array size may be a constant expression', async () => {
  const result = await runIdyllium(`use console;

const int SIZE = 5;
const int PAD = 2;

class Board { const int W = 3; }

main() {
    const int LOCAL = 4;
    array<int, SIZE*SIZE> grid;
    array<int, SIZE + PAD> row;
    array<int, LOCAL * 2 - 1> odd;
    array<int, Board.W * Board.W> small;
    array<int, 10> plain;
    array<int, SIZE> named;
    console.writeln(grid.length, " ", row.length, " ", odd.length, " ", small.length, " ", plain.length, " ", named.length);
}
`, {}, { file: 'main.idyl' });
  assert(result.output === '25 7 7 9 10 5\n', `constant expressions must size arrays: ${JSON.stringify(result.output)} ${result.runtimeError ?? result.compilation.diagnosticsText}`);

  // Непосчитаемый размер и отрицательный — по одному честному сообщению,
  // без общего эха «must be a non-negative integer».
  for (const [source, expected] of [
    ['use console;\nmain() {\n    int n = 5;\n    array<int, n * 2> a;\n}', 'array size must be known before the program runs'],
    ['use console;\nconst int A = 3;\nmain() {\n    array<int, A - 10> a;\n}', 'array size must be non-negative, got -7'],
    ['use console;\nmain() {\n    int n = 5;\n    array<int, n> a;\n}', "array size 'n' must be an integer constant declared with 'const'"],
    ['use console;\nmain() {\n    array<int, NOPE> a;\n}', "array size constant 'NOPE' was not declared"],
  ] as ReadonlyArray<readonly [string, string]>) {
    const failure = compileIdyllium(source, { file: 'main.idyl' });
    assert(failure.diagnosticsText.includes(expected), `expected «${expected}», got: ${failure.diagnosticsText}`);
    assert(
      !failure.diagnosticsText.includes('array size must be a non-negative integer'),
      `the generic echo must stay silent: ${failure.diagnosticsText}`,
    );
  }
});

// AU1 и NET1 (методисты, 2026-08-23): звук брал ЛЮБОЙ файл молча (duration 0,
// is_playing true, звука нет), а порт сервера проверялся только при run().

test('privacy is class-wide, and an override picks its own default', async () => {
  // Замок на классе, а не на объекте: чужой объект СВОЕГО класса открыт.
  const lock = await runIdyllium(`use console;
class Thermostat {
private:
    int temperature;

public:
    constructor Thermostat(int ex_temperature) {
        this.temperature = ex_temperature;
    }

    bool function warmer_than(Thermostat other) {
        return this.temperature > other.temperature;
    }
}
main() {
    Thermostat a(20);
    Thermostat b(15);
    console.writeln(a.warmer_than(b));
}
`, {}, { file: 'main.idyl' });
  assert(lock.output === 'true\n', `a method must see private members of another object of its class: ${JSON.stringify(lock.output)} ${lock.runtimeError ?? lock.compilation.diagnosticsText}`);

  // До первой рубрики — открыто.
  const beforeLabel = await runIdyllium(`use console;
class Box {
    int hidden = 7;

private:
    int secret = 9;
}
main() {
    Box b;
    console.writeln(b.hidden);
}
`, {}, { file: 'main.idyl' });
  assert(beforeLabel.output === '7\n', `members before the first modifier are public: ${JSON.stringify(beforeLabel.output)} ${beforeLabel.runtimeError ?? beforeLabel.compilation.diagnosticsText}`);

  // Умолчание подставляет тот метод, который выполняется, — не тип переменной.
  const defaults = await runIdyllium(`use console;
class A { void function hi(int n, int extra = 0) { console.writeln("A ", n, " ", extra); } }
class B extends A { void function hi(int n, int extra = 5) { console.writeln("B ", n, " ", extra); } }
main() {
    B b;
    A a = b;
    a.hi(2);
    A plain;
    plain.hi(2);
}
`, {}, { file: 'main.idyl' });
  assert(defaults.output === 'B 2 5\nA 2 0\n', `the running method fills the default: ${JSON.stringify(defaults.output)} ${defaults.runtimeError ?? defaults.compilation.diagnosticsText}`);
});

// D5: заготовка sqlite.Result — ПУСТОЙ ответ, а не «уже закрытый»; база и
// запрос-заготовка отличают «никогда не открывали» от «закрыли».

test('warnings fire on do-nothing code and stay silent on real work', async () => {
  const warned = compileIdyllium(`use console;

int function damage() {
    return 5;
}

main() {
    int a = 1;
    a + 1;
    a = a;
    int unused = 42;
    float x = 0.1;
    float y = 0.2;
    if (x + y == 0.3) { console.writeln("равно"); }
    bool flag = true;
    if (flag == true) { console.writeln("да"); }
    if (true) { console.writeln("всегда"); }
    while (false) { console.writeln("никогда"); }
    damage();
    console.writeln(a);
}
`, { file: 'main.idyl' });
  assert(warned.success, `warnings must not fail the build: ${warned.diagnosticsText}`);
  for (const expected of [
    "compile warning: this line computes a value and does not use it",
    "compile warning: assigning a variable to itself changes nothing",
    "compile warning: variable 'unused' is never used",
    "compile warning: two float numbers are compared with '==' — they are almost never exactly equal",
    "compile warning: comparing a bool with 'true' changes nothing",
    "compile warning: this condition is always true",
    "compile warning: this condition is always false",
    "compile warning: the value returned by 'damage' is not used",
  ]) {
    assert(warned.diagnosticsText.includes(expected), `missing «${expected}»: ${warned.diagnosticsText}`);
  }

  // Улов ломателей: одного дробного операнда хватает — average == 4
  // сравнивает в float, и int-литерал не спасает.
  const floatInt = compileIdyllium(`use console;
main() {
    float average = 8.5;
    if (average == 4) { console.writeln("ровно"); }
}
`, { file: 'main.idyl' });
  assert(
    floatInt.diagnosticsText.includes("two float numbers are compared with '=='"),
    `float vs int literal must warn: ${floatInt.diagnosticsText}`,
  );

  // Функция пользовательского МОДУЛЯ — такая же своя.
  const moduleDrop = compileIdyllium(`use console;
use mathmod;
main() {
    mathmod.calc();
    console.writeln("готово");
}
`, { file: 'main.idyl', sources: { 'mathmod.idyl': 'int function calc() {\n    return 7;\n}\n' } });
  assert(
    moduleDrop.diagnosticsText.includes("the value returned by 'calc' is not used"),
    `module function drop must warn: ${moduleDrop.diagnosticsText}`,
  );

  // Недостижимый код — по одному предупреждению на блок.
  const unreachable = compileIdyllium(`use console;
int function f() {
    return 1;
    console.writeln("после return");
}
main() {
    console.writeln(f());
}
`, { file: 'main.idyl' });
  assert(
    unreachable.diagnosticsText.includes('compile warning: this line can never run — the function returns above'),
    `unreachable code must warn: ${unreachable.diagnosticsText}`,
  );

  // НЕГАТИВЫ: настоящая работа предупреждений не собирает.
  const clean = compileIdyllium(`use console;
class Hero {
    void function hello() { console.writeln("привет"); }
}
main() {
    while (true) {
        break;
    }
    array<int, 3> demo;
    Hero h;
    h.hello();
    int typed = console.get_int();
    console.writeln(demo.length + typed);
}
`, { file: 'main.idyl' });
  assert(
    !clean.diagnosticsText.includes('warning'),
    `clean code must stay clean: ${clean.diagnosticsText}`,
  );

  // При ОШИБКАХ предупреждения молчат: правило первой строки.
  const broken = compileIdyllium(`main() {
    int unused = 42;
    int x = "текст";
}
`, { file: 'main.idyl' });
  assert(!broken.success, 'the probe must fail');
  assert(
    !broken.diagnosticsText.includes('warning'),
    `warnings must stay silent next to errors: ${broken.diagnosticsText}`,
  );
});

// Рантайм-предупреждения конца программы — и их выключатель в system.

test('runtime warnings report silent failures and can be disabled', async () => {
  const silent = await runIdyllium(`use gui;
use console;
main() {
    gui.Window win;
    gui.Button lost;
    lost.text = "забыт";
    console.writeln("конец");
}
`, {}, { file: 'main.idyl' });
  const warnings = silent.runtimeWarnings ?? [];
  assert(
    warnings.some((w) => w.includes('runtime warning: the program finished without showing a window')),
    `unshown window must warn: ${JSON.stringify(warnings)}`,
  );
  assert(
    warnings.some((w) => w.includes("runtime warning: a widget ('gui.Button') was created but never added to a window")),
    `orphan widget must warn: ${JSON.stringify(warnings)}`,
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-warn-'));
  const openFile = await runIdyllium(`use file;
main() {
    file.ostream fout = file.open("w.txt", "write");
    fout.write_line("данные");
}
`, {}, { file: path.join(dir, 'main.idyl') });
  assert(
    (openFile.runtimeWarnings ?? []).some((w) => w.includes("runtime warning: file 'w.txt' was not closed")),
    `open stream must warn: ${JSON.stringify(openFile.runtimeWarnings)}`,
  );

  // close() снимает предупреждение; показанное окно — тоже.
  const tidy = await runIdyllium(`use gui;
use file;
main() {
    gui.Window win;
    win.show();
    file.ostream fout = file.open("t.txt", "write");
    fout.write_line("данные");
    fout.close();
}
`, {}, { file: path.join(dir, 'main.idyl') });
  assert((tidy.runtimeWarnings ?? []).length === 0, `tidy program must be quiet: ${JSON.stringify(tidy.runtimeWarnings)}`);

  // system.set_warnings(false) гасит рантайм-предупреждения этой программы,
  // system.set_warnings(true) возвращает их обратно.
  const disabled = await runIdyllium(`use gui;
use system;
main() {
    system.set_warnings(false);
    gui.Window win;
}
`, {}, { file: 'main.idyl' });
  assert((disabled.runtimeWarnings ?? []).length === 0, `set_warnings(false) must silence: ${JSON.stringify(disabled.runtimeWarnings)}`);

  const reEnabled = await runIdyllium(`use gui;
use system;
main() {
    system.set_warnings(false);
    system.set_warnings(true);
    gui.Window win;
}
`, {}, { file: 'main.idyl' });
  assert(
    (reEnabled.runtimeWarnings ?? []).some((w) => w.includes('without showing a window')),
    `set_warnings(true) must bring warnings back: ${JSON.stringify(reEnabled.runtimeWarnings)}`,
  );

  // Не-bool аргумент — честный отказ ещё на компиляции (реестр знает тип).
  assertFails(
    'use system;\nmain() {\n    system.set_warnings(1);\n}',
    "'set_warnings' argument 1 expects 'bool', got 'int'",
  );

  // Улов ломателей: показанное-и-закрытое окно — программа ПОКАЗЫВАЛА окно
  // (счётчики жизни, не снимок), а сироты при показанном окне молчат —
  // в живом хосте обработчик может добавить виджет позже.
  const shownClosed = await runIdyllium(`use gui;
main() {
    gui.Window shown;
    gui.Window forgotten;
    shown.show();
    shown.close();
}
`, {}, { file: 'main.idyl' });
  assert((shownClosed.runtimeWarnings ?? []).length === 0, `a shown-then-closed window counts as shown: ${JSON.stringify(shownClosed.runtimeWarnings)}`);

  const closedUnshown = await runIdyllium(`use gui;
main() {
    gui.Window win;
    win.close();
}
`, {}, { file: 'main.idyl' });
  assert(
    (closedUnshown.runtimeWarnings ?? []).some((w) => w.includes('without showing a window')),
    `closed-but-never-shown must warn: ${JSON.stringify(closedUnshown.runtimeWarnings)}`,
  );

  const lazy = await runIdyllium(`use gui;
main() {
    gui.Window win;
    gui.Button pending;
    pending.text = "добавят обработчиком";
    win.show();
}
`, {}, { file: 'main.idyl' });
  assert((lazy.runtimeWarnings ?? []).length === 0, `orphans stay silent when a window is shown: ${JSON.stringify(lazy.runtimeWarnings)}`);

  // Непоказанное окно НЕ держит программу живой — иначе Web IDE уходил в
  // вечную GUI-петлю с пустым экраном и варнинг не печатался (находка
  // владельца 2026-08-28). Показанное — держит; закрытое — отпускает.
  {
    const rt = createRuntime();
    const win = rt.createObject('gui', 'Window') as { show: () => Promise<void>; close: () => void };
    assert(rt.hasGui() === false, 'an unshown window must not keep the program alive');
    await win.show();
    assert(rt.hasGui() === true, 'a shown window keeps the program alive');
    win.close();
    assert(rt.hasGui() === false, 'a closed window releases the program');
  }
});

// SQ1 (методисты, 2026-08-23): has_rows значил «этот запрос возвращает строки»,
// поэтому у пустого SELECT был true — и запись «если ничего не нашлось» молча
// печатала «нашли». Свойство отвечает на вопрос своего имени.

test('a member of an unimported module names the forgotten import', async () => {
  const sources = {
    'engine.idyl': 'use console;\n\nclass Engine {\n    string model;\n    int power;\n\n    constructor Engine(string ex_model, int ex_power) {\n        this.model = ex_model;\n        this.power = ex_power;\n    }\n\n    void function report() {\n        console.writeln("двигатель ", this.model, ", ", this.power, " л.с.");\n    }\n}\n',
    'car.idyl': 'use console;\nuse engine;\n\nclass Car {\n    string plate;\n    engine.Engine engine = engine.Engine("М-90", 90);\n\n    constructor Car(string ex_plate) {\n        this.plate = ex_plate;\n    }\n}\n',
  };

  for (const line of ['console.writeln(mine.engine.power);', 'mine.engine.report();']) {
    const result = compileIdyllium(
      `use console;\nuse car;\n\nmain() {\n    car.Car mine = car.Car("А123ВС");\n    ${line}\n}\n`,
      { file: 'main.idyl', sources },
    );
    assert(
      result.diagnosticsText.includes("'engine' is not imported (use 'use engine;')"),
      `a chained member must name the forgotten import: ${result.diagnosticsText}`,
    );
    assert(
      !result.diagnosticsText.includes('has no member') && !result.diagnosticsText.includes('has no method'),
      `the compiler must not claim the member is missing: ${result.diagnosticsText}`,
    );
  }

  // С подключением цепочка работает целиком.
  const fixed = await runIdyllium(
    'use console;\nuse car;\nuse engine;\n\nmain() {\n    car.Car mine = car.Car("А123ВС");\n    console.writeln(mine.engine.power);\n    mine.engine.report();\n}\n',
    {}, { file: 'main.idyl', sources },
  );
  assert(
    fixed.output === '90\nдвигатель М-90, 90 л.с.\n',
    `the chain must work once imported: ${JSON.stringify(fixed.output)} ${fixed.runtimeError ?? fixed.compilation.diagnosticsText}`,
  );

  // Настоящая опечатка в имени члена по-прежнему называется своими словами.
  const typo = compileIdyllium(
    'use console;\nuse car;\nuse engine;\n\nmain() {\n    car.Car mine = car.Car("А123ВС");\n    console.writeln(mine.engine.powr);\n}\n',
    { file: 'main.idyl', sources },
  );
  assert(
    typo.diagnosticsText.includes("type 'engine.Engine' has no member 'powr'"),
    `a real typo must still be named: ${typo.diagnosticsText}`,
  );
});

// Модуль, который не собрался, называет свою беду ровно один раз: «нет такого
// типа» после цикла импорта было бы враньём — тип там есть.

test('a broken module does not echo a second, false reason', async () => {
  const cycle = compileIdyllium('use console;\nuse driver;\n\nmain() {\n    driver.Driver d = driver.Driver("Мира");\n}\n', {
    file: 'main.idyl',
    sources: {
      'driver.idyl': 'use console;\nuse car;\n\nclass Driver {\n    string name;\n    car.Car car;\n\n    constructor Driver(string ex_name) {\n        this.name = ex_name;\n    }\n}\n',
      'car.idyl': 'use console;\nuse driver;\n\nclass Car {\n    string plate;\n    driver.Driver owner;\n}\n',
    },
  });
  assert(cycle.diagnosticsText.includes('module import cycle detected: driver -> car -> driver'), `the cycle route must be shown: ${cycle.diagnosticsText}`);
  assert(!cycle.diagnosticsText.includes('has no type'), `a broken module must not echo 'has no type': ${cycle.diagnosticsText}`);

  // А настоящая опечатка в имени типа модуля называется по-прежнему.
  const typo = compileIdyllium('use shapes;\nmain() {\n    shapes.Circle c;\n}\n', {
    file: 'main.idyl',
    sources: { 'shapes.idyl': 'class Rect {\n    int width;\n}\n' },
  });
  assert(
    typo.diagnosticsText.includes("module 'shapes' has no type 'Circle'"),
    `a real type typo must still be named: ${typo.diagnosticsText}`,
  );
});

// Страж от расхождения: компилятор запрещает печатать библиотечный объект
// только тогда, когда у него ДЕЙСТВИТЕЛЬНО нет текстового вида. Правду
// спрашиваем у самого рантайма, а не у списка в компиляторе — иначе новый тип
// с to_string молча потеряет печать (улов широкой волны: так потерялись
// turtle.Turtle, gui.Table и ещё восемь).

test('printable library types match the runtime', async () => {
  const api = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'reference', 'api.json'), 'utf8')) as {
    modules?: ReadonlyArray<{ name: string; types?: ReadonlyArray<{ name: string }> }>;
  };
  const runtime = createRuntime();
  const mismatches: string[] = [];

  for (const module of api.modules ?? []) {
    for (const type of module.types ?? []) {
      let instance: Record<string, unknown> | null = null;
      try {
        instance = runtime.createObject(module.name, type.name);
      } catch {
        continue; // тип строится не фабрикой (значения, потоки) — его печать проверена отдельно
      }
      if (!instance || typeof instance.to_string !== 'function') continue;

      const qualified = `${module.name}.${type.name}`;
      const compiled = compileIdyllium(
        `use console;\nuse ${module.name};\nmain() {\n    ${qualified} probe;\n    console.writeln(probe);\n}\n`,
        { file: 'main.idyl' },
      );
      if (compiled.diagnosticsText.includes('library objects have no text form')) {
        mismatches.push(qualified);
      }
    }
  }

  assert(
    mismatches.length === 0,
    `these types have a text form in the runtime but the compiler refuses to print them: ${mismatches.join(', ')}`,
  );
});

// Улов второй волны ломателей: класс из модуля обязан вести себя ровно так же,
// как тот же класс одним файлом — зеркало не смеет перекрывать СВОИ члены
// потомка членами базы.

test('module mirror keeps the heir own members, not the base ones', async () => {
  // Переопределение с другой сигнатурой: снаружи модуля действует своя.
  const signature = compileIdyllium(`use console;
use zoo;
main() {
    zoo.Derived d;
    console.writeln(d.greet());
}
`, {
    file: 'main.idyl',
    sources: {
      'zoo.idyl': 'class Base {\npublic:\n  string function greet(string who = "мир") { return "привет, " + who + "!"; }\n}\n\nclass Derived extends Base {\npublic:\n  string function greet(string who) { return "ПРИВЕТ, " + who + "!"; }\n}\n',
    },
  });
  assert(
    signature.diagnosticsText.includes("'greet' expects 1 arguments, got 0"),
    `heir signature must win outside the module: ${signature.diagnosticsText}`,
  );

  // Приватное переопределение публичного метода базы закрыто снаружи…
  const hidden = compileIdyllium(`use console;
use zoo;
main() {
    zoo.Derived d;
    console.writeln(d.helper());
}
`, {
    file: 'main.idyl',
    sources: {
      'zoo.idyl': 'class Base {\npublic:\n  string function helper() { return "base-helper"; }\n}\n\nclass Derived extends Base {\nprivate:\n  string function helper() { return "derived-secret"; }\n}\n',
    },
  });
  assert(
    hidden.diagnosticsText.includes("member 'zoo.Derived.helper' is private"),
    `private override must stay private: ${hidden.diagnosticsText}`,
  );

  // …а приватный метод базы не переопределяется вовсе: на объекте один слот
  // имени, и подмена молча меняла бы механику базы под ней самой.
  const opened = compileIdyllium(`use console;
use zoo;
main() {
    zoo.Derived d;
    console.writeln(d.helper());
}
`, {
    file: 'main.idyl',
    sources: {
      'zoo.idyl': 'class Base {\nprivate:\n  string function helper() { return "base-helper"; }\npublic:\n  string function run() { return this.helper(); }\n}\n\nclass Derived extends Base {\npublic:\n  string function helper() { return "derived-public"; }\n}\n',
    },
  });
  assert(
    opened.diagnosticsText.includes("method 'helper' is private in class 'Base' and cannot be overridden"),
    `private base method must not be overridden: ${opened.diagnosticsText}`,
  );

  // Контракт equals не наследуется и через границу модуля — отказ на компиляции,
  // а не рантайм-«object has no method 'equals'».
  const contract = compileIdyllium(`use console;
use zoo;
main() {
    zoo.Cub a;
    zoo.Cub b;
    console.writeln(a.equals(b));
}
`, {
    file: 'main.idyl',
    sources: {
      'zoo.idyl': 'class Lion {\n    int age = 3;\n    bool function equals(Lion other) { return this.age == other.age; }\n}\n\nclass Cub extends Lion {\n    bool sleepy = true;\n}\n',
    },
  });
  assert(
    contract.diagnosticsText.includes("'equals' is a contract and is not inherited — declare 'bool function equals(zoo.Cub other)'"),
    `contract must not travel across the module border: ${contract.diagnosticsText}`,
  );

  // Несуществующая база внутри модуля роняла компилятор в бесконечную рекурсию.
  const brokenBase = compileIdyllium(`use console;
use zoo;
main() {
    zoo.Lion l;
    console.writeln(to_string(l.n));
}
`, { file: 'main.idyl', sources: { 'zoo.idyl': 'class Lion extends Animal {\n  int n = 1;\n}\n' } });
  assert(
    brokenBase.diagnosticsText.includes("unknown base class 'Animal'"),
    `unknown base inside a module must be named: ${brokenBase.diagnosticsText}`,
  );
});

// Виджет-наследник впервые вешает пользовательские поля прямо на виджет —
// цикл ссылок ронял снимок окна голым JS-стеком (бил бы и по Web IDE).

test('Object.prototype names are ordinary identifiers', async () => {
  const result = await runIdyllium(`use gui;
use console;
class MyButton extends gui.Button {
  int clicks;
  string function toString() { return "MyButton(" + to_string(this.clicks) + ")"; }
}
main() {
  MyButton b;
  b.clicks = 3;
  console.writeln(b.toString());
}
`, {}, { file: 'main.idyl' });
  assert(result.output === 'MyButton(3)\n', `toString must be an ordinary method: ${JSON.stringify(result.output)} ${result.runtimeError ?? result.compilation.diagnosticsText}`);

  const fields = await runIdyllium(`use console;
class Box {
    int valueOf = 1;
    string function hasOwnProperty() { return "своё"; }
}
main() {
    Box b;
    console.writeln(b.valueOf, " ", b.hasOwnProperty());
}
`, {}, { file: 'main.idyl' });
  assert(fields.output === '1 своё\n', `prototype names as members: ${JSON.stringify(fields.output)} ${fields.runtimeError ?? fields.compilation.diagnosticsText}`);
});

// Внутренний плейсхолдер '<error>' наружу не выходит: про испорченный операнд
// уже сказано настоящей ошибкой.

test('the internal error placeholder never reaches the reader', async () => {
  const result = compileIdyllium(`use gui;
use console;
class Card extends gui.Frame {
    gui.Label caption_label;
}
main() {
    Card c;
    console.writeln(c.caption.text + "!");
}
`, { file: 'main.idyl' });
  assert(result.diagnosticsText.includes("type 'Card' has no member 'caption'"), `real error must be named: ${result.diagnosticsText}`);
  assert(!result.diagnosticsText.includes('<error>'), `placeholder must not leak: ${result.diagnosticsText}`);

  // Настоящая ошибка операторов цела.
  assertFails(
    'use console;\nmain() {\n    string s = "a";\n    bool b = true;\n    console.writeln(s + b);\n}',
    "operator '+' cannot be applied to 'string' and 'bool'",
  );
});

// Метод без типа результата давал каскад «unexpected token» на каждую скобку.

test('a method without a result type says so once', async () => {
  const result = compileIdyllium(
    'class Hero {\n    int hp = 10;\n    function hit() { this.hp = this.hp - 1; }\n}\nmain() { }',
    { file: 'main.idyl' },
  );
  assert(
    result.diagnosticsText.includes("method 'hit' needs a result type before 'function' — write 'void function hit()' if it returns nothing"),
    `missing result type must be named: ${result.diagnosticsText}`,
  );
  assert(
    !result.diagnosticsText.includes('unexpected token'),
    `missing result type must not cascade: ${result.diagnosticsText}`,
  );
});

// Улов ломателей по свежему extends (2026-08-22): цепочка наследования не
// смеет терять виджетную идентичность, а имена членов виджета заняты на всю
// глубину — включая события.

test('module classes carry inherited members across the module border', async () => {
  const zooSource = `class Lion {
    string name = "лев";
    string function roar() { return this.name + ": Р-Р-Р"; }
}

class Cub extends Lion {
    bool sleepy = true;
    string function play() { return this.name + " играет"; }
}
`;
  const inherited = await runIdyllium(`use console;
use zoo;
main() {
    zoo.Cub c;
    console.writeln(c.play(), " / ", c.name, " / ", c.roar(), " / ", c.sleepy);
}
`, {}, { file: 'main.idyl', sources: { 'zoo.idyl': zooSource } });
  assert(
    inherited.output === 'лев играет / лев / лев: Р-Р-Р / true\n',
    `inherited module members outside: ${JSON.stringify(inherited.output)} ${inherited.runtimeError ?? inherited.compilation.diagnosticsText}`,
  );

  // Виджет-наследник, объявленный в модуле, снаружи — настоящий виджет.
  const widgets = await runWithInspectableRuntime(`
    use gui;
    use widgets;

    main() {
      gui.Window win;
      widgets.Fancy b;
      b.text = "из модуля";
      win.add_child(b);
      win.show();
    }
  `, { file: 'main.idyl', sources: { 'widgets.idyl': 'use gui;\n\nclass Fancy extends gui.Button {\n    int level = 1;\n}\n' } });
  const fancy = widgets.runtime.getWindows()[0].children.find((item) => item.type === 'gui.Button');
  assert(fancy?.properties.text === 'из модуля', `module widget heir must render: ${JSON.stringify(fancy?.properties)}`);

  // Приватный конструктор базы закрыт и для потомка — наследование не лазейка.
  const privateCtor = compileIdyllium(`use zoo;
class Cub extends zoo.Lion {
    constructor Cub(string n) {
        parent(n);
    }
}
main() { }
`, { file: 'main.idyl', sources: { 'zoo.idyl': 'class Lion {\n    string name = "лев";\n\n    private:\n    constructor Lion(string ex_name) {\n        this.name = ex_name;\n    }\n}\n' } });
  assert(
    privateCtor.diagnosticsText.includes("constructor 'zoo.Lion' is private and can only be used inside class 'zoo.Lion'"),
    `private base constructor must stay private: ${privateCtor.diagnosticsText}`,
  );
});

// Печать библиотечного ОБЪЕКТА: раньше в консоль уезжало JS-нутро
// '[object Object]'. Значения библиотеки печатаются как печатались.

test('library objects refuse to print, library values still print', async () => {
  for (const [snippet, type] of [
    ['gui.Button b;\n    console.writeln(b);', 'gui.Button'],
    ['fonts.Font f;\n    console.writeln(f);', 'fonts.Font'],
    ['drawable.Circle c;\n    console.writeln(to_string(c));', 'drawable.Circle'],
  ] as ReadonlyArray<readonly [string, string]>) {
    assertFails(
      `use console;\nuse gui;\nuse fonts;\nuse drawable;\nmain() {\n    ${snippet}\n}`,
      `cannot print an object of type '${type}' directly — library objects have no text form`,
    );
  }

  const values = await runIdyllium(`use console;
use colors;
use json;
use types;
main() {
    types.uint8 cell = 200;
    console.writeln(colors.RGB(1, 2, 3), " ", json.parse("[1,2]"), " ", cell);
}
`, {}, { file: 'main.idyl' });
  assert(values.output === '#010203 [1,2] 200\n', `library values must stay printable: ${JSON.stringify(values.output)} ${values.runtimeError ?? values.compilation.diagnosticsText}`);
});

// Зачистка строковых перечислений (заказ владельца, 2026-08-22): все четыре
// тихих виджет-свойства стали строгими; легальные значения не задеты.

test('static fields and class constants live on the class', async () => {
  const result = await runIdyllium(`use console;

class Hero {
    const int MAX_LEVEL = 100;
    static int population = 0;

    string name = "безымянный";

    constructor Hero(string hero_name) {
        this.name = hero_name;
        Hero.population = Hero.population + 1;
    }

    static int function room_left() {
        return Hero.MAX_LEVEL - Hero.population;
    }
}

main() {
    console.writeln(Hero.MAX_LEVEL, " ", Hero.population);
    Hero a("Мира");
    Hero b("Кай");
    console.writeln(Hero.population, " ", Hero.room_left());
    Hero.population = 50;
    array<int, Hero.MAX_LEVEL> levels;
    console.writeln(Hero.population, " ", levels.length);
}
`, {}, { file: 'main.idyl' });
  assert(
    result.output === '100 0\n2 98\n50 100\n',
    `static field story is off: ${JSON.stringify(result.output)}`,
  );
});

// Находки ломателей (2026-08-22): порядок инициализации статиков, тени,
// гигантские размеры, Infinity — всё ловится читаемо, ничего не течёт сырым JS.

test('static initializer order, class-name shadowing and giant sizes are guarded', async () => {
  // Учительский паттерн «константа наверху — класс ниже» обязан работать.
  const teacher = await runIdyllium(`use console;
const int GLOBAL_BONUS = 5;
class Hero { static int bonus = GLOBAL_BONUS * 2; }
main() { console.writeln(Hero.bonus); }
`, {}, { file: 'main.idyl' });
  assert(teacher.output === '10\n', `file const above class: ${JSON.stringify(teacher.output)}`);

  // Вычислимая класс-константа работает размером массива.
  const computed = await runIdyllium(`use console;
class Hero {
    const int BASE = 10;
    const int TOTAL = Hero.BASE + 5;
}
main() {
    array<int, Hero.TOTAL> arr;
    console.writeln(arr.length);
}
`, {}, { file: 'main.idyl' });
  assert(computed.output === '15\n', `computed class const as size: ${JSON.stringify(computed.output)}`);

  assertFails(`
    class Alpha { static int a = Beta.b + 1; }
    class Beta { static int b = 10; }
    main() { }
  `, "class 'Beta' is declared later in the file — move it above 'Alpha' to use 'Beta.b' here");

  assertFails(`
    class Hero {
      static int a = Hero.b;
      static int b = 5;
    }
    main() { }
  `, "static field 'Hero.b' is used before its declaration — declare it above 'Hero.a'");

  assertFails(`
    class Hero { static int population = 42; }
    main() { int Hero = 5; }
  `, "name 'Hero' is already used by a class");

  assertFails(`
    class Hero { static int population = 4; }
    main() { array<int, Hero.population> arr; }
  `, "array size 'Hero.population' is not a constant — only a class constant (const) works as a size");

  assertFails(`
    main() { array<int, 123456789> giant; }
  `, 'array size 123456789 is too large (maximum 100000000)');
});

test('static field and class constant misuse gets readable refusals', () => {
  assertFails(`
    class Hero { const int MAX = 100; }
    main() { Hero.MAX = 5; }
  `, "cannot assign to class constant 'Hero.MAX'");

  assertFails(`
    use console;
    class Hero { static int population = 0; }
    main() {
      Hero h;
      console.writeln(h.population);
    }
  `, "static field 'Hero.population' must be accessed through class 'Hero'");

  assertFails(`
    class Hero { static const int MAX = 100; }
    main() { }
  `, "class constants are written without 'static' — 'const' alone already means one per class");

  assertFails(`
    class Hero { const int MAX; }
    main() { }
  `, "class constant 'MAX' must have an initializer");

  assertFails(`
    use console;
    class Safe {
      private:
      static int code = 42;
    }
    main() { console.writeln(Safe.code); }
  `, "member 'Safe.code' is private and can only be used inside class 'Safe'");

  // static не наследуется — компилятор говорит об этом сам, а не рантайм
  // (раньше Cat.kingdom() компилировался и падал «object has no method»).
  assertFails(`
    use console;
    class Animal { static string function kingdom() { return "звери"; } }
    class Cat extends Animal { }
    main() { console.writeln(Cat.kingdom()); }
  `, "static method 'Animal.kingdom' is not inherited — call 'Animal.kingdom()'");

  assertFails(`
    use console;
    class Animal { static int population = 0; }
    class Cat extends Animal { }
    main() { console.writeln(Cat.population); }
  `, "static field 'Animal.population' is not inherited — write 'Animal.population'");
});

// Прицельные диагностики из GUI-реестра методистов (E5/E8/E9/E13, 2026-08-22):
// на каждом из этих отказов построено задание книг.

test('targeted diagnostics: =+, greedy not, comparison types, initializer rows', async () => {
  assertFails(`
    main() {
      int score = 0;
      score =+ 10;
    }
  `, "'=+' is not an operator — did you mean '+='?");

  // '=-' остаётся законным присваиванием отрицательного числа.
  const minus = compileIdyllium(`
main() {
    int lives = 9;
    lives =- 5;
}
`, { file: 'main.idyl' });
  assert(minus.success, `'=-' must stay legal: ${minus.diagnosticsText}`);

  assertFails(`
    main() {
      int coins = 50;
      if (not coins > 100) { }
    }
  `, "'not' takes only what stands right after it — write 'not (coins > …)' to negate the whole comparison");

  assertFails(`
    main() {
      array<int, 5> P = [78, 91, 63, 50, 24];
      if (P > 50) { }
    }
  `, "comparison '>' requires numeric operands, got 'array<int, 5>' and 'int'");

  assertFails(`
    main() {
      array<array<int, 3>, 2> mx = [[1, 2, 3], [4, 5]];
    }
  `, "row 2 of the initializer has 2 values, but 'array<int, 3>' needs 3");
});

test('printing an array of objects goes through the to_string contract', async () => {
  // Вердикт владельца 2026-08-22: контракт to_string элемента открывает
  // печать массива (симметрия со сравнением массивов через equals).
  const ok = await runIdyllium(`use console;

class Hero {
    string name;
    string function to_string() { return "Герой " + this.name; }
}

main() {
    dyn_array<Hero> guild;
    Hero a;
    a.name = "Мира";
    guild.add(a);
    Hero b;
    b.name = "Кай";
    guild.add(b);
    console.writeln(guild);
    console.writeln(to_string(guild));
}
`, {}, { file: 'main.idyl' });
  assert(ok.success, ok.runtimeError ?? ok.compilation.diagnosticsText);
  assert(
    ok.output === '["Герой Мира", "Герой Кай"]\n["Герой Мира", "Герой Кай"]\n',
    `array printing via contract is off: ${JSON.stringify(ok.output)}`,
  );

  // без контракта — отказ с обучающим хвостом; кривая форма — с уточнением
  const refuse = compileIdyllium(`use console;
class Kot { string name; }
main() { dyn_array<Kot> koty; console.writeln(koty); }
`, { file: '/main.idyl' });
  assert(!refuse.success, 'array of contractless objects unexpectedly printed');
  assert(
    refuse.diagnosticsText.includes("cannot print an array of 'Kot' objects directly — declare 'string function to_string()' in class 'Kot' and printing will use it"),
    `array refusal hint is off:\n${refuse.diagnosticsText}`,
  );

  const crooked = compileIdyllium(`use console;
class H {
    int lvl;
private:
    bool function equals(H other) { return this.lvl == other.lvl; }
}
main() { H a; H b; console.writeln(a == b); }
`, { file: '/main.idyl' });
  assert(!crooked.success, 'private equals unexpectedly acted as a contract');
  assert(
    crooked.diagnosticsText.includes("(class 'H' has 'equals', but it is private)"),
    `shape diagnostics tail is off:\n${crooked.diagnosticsText}`,
  );
});


test('every compiler warning carries a registered machine code, texts stay code-free', () => {
  // Diagnostic.code (бэклог, начат 2026-08-29): slug-коды — для инструментов
  // (документация правил, будущее адресное подавление); в человеческий текст
  // не печатаются — показывать ли, отдельный вердикт владельца.
  const knownCodes: readonly string[] = IDYLLIUM_WARNING_CODES;
  assert(new Set(knownCodes).size === knownCodes.length, 'warning codes must be unique');

  const source = `use console;

void function helper() {
    console.writeln("привет");
}

int function score() {
    return 7;
}

main() {
    int unused_thing;
    int a = 1;
    a = a;
    a + 1;
    score();
    float b = 0.5;
    if (b == 0.5) {
        console.writeln("равно");
    }
    bool flag = true;
    if (flag == true) {
        console.writeln("флаг");
    }
    if (true) {
        console.writeln("всегда");
    }
    while (false) {
        console.writeln("никогда");
    }
    return;
    helper();
}
`;
  const result = compileIdyllium(source, { file: 'main.idyl' });
  const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  assert(warnings.length >= 8, `expected the full warning bouquet, got ${warnings.length}:\n${result.diagnosticsText}`);
  const seen = new Set<string>();
  for (const warning of warnings) {
    assert(typeof warning.code === 'string' && warning.code.length > 0,
      `warning without a code: ${warning.message}`);
    assert(knownCodes.includes(warning.code!),
      `warning code '${warning.code}' is not in IDYLLIUM_WARNING_CODES (${warning.message})`);
    seen.add(warning.code!);
  }
  for (const code of knownCodes) {
    assert(seen.has(code), `no warning fired for registered code '${code}'`);
  }
  // Текст диагностик остаётся прежним — без машинных кодов.
  assert(!/compile warning [a-z-]+:/.test(result.diagnosticsText),
    `codes must not leak into human texts:\n${result.diagnosticsText}`);
});


test('integer literal comparisons in conditions warn with a computed verdict', async () => {
  // Хотелка владельца 2026-08-29: `if (1 > 0)` решён до запуска — то же
  // правило condition-always-same, вердикт вычисляется честно.
  const result = compileIdyllium(`use console;

main() {
    int x = 5;
    if (1 > 0) { console.writeln("раз"); }
    while (2 < 1) { console.writeln("никогда"); }
    if (10 == 10) { console.writeln("десять"); }
    if (x > 0) { console.writeln("живое"); }
    bool precomputed = 1 > 0;
    console.writeln(precomputed);
}
`, { file: 'main.idyl' });
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
  const texts = warnings.map((d) => `${d.range.start.line}: ${d.message}`);
  assert(warnings.length === 3, `expected exactly three verdicts, got:\n${texts.join('\n')}`);
  assert(texts[0].includes('always true') && texts[1].includes('always false') && texts[2].includes('always true'),
    `verdicts must be computed: ${texts.join(' | ')}`);
  assert(warnings.every((d) => d.code === 'condition-always-same'), 'same rule, same code');

  // Дробные литералы — территория float-equality, дубля вердикта нет.
  const floats = compileIdyllium(`use console;

main() {
    if (0.1 == 0.1) { console.writeln("дробь"); }
}
`, { file: 'main.idyl' });
  const floatWarnings = floats.diagnostics.filter((d) => d.severity === 'warning');
  assert(floatWarnings.length === 1 && floatWarnings[0].code === 'float-equality',
    `float literals belong to float-equality alone: ${floatWarnings.map((d) => d.code).join(', ')}`);
});

void runTests();

test('bare words in an argument suggest quotes instead of callback jargon', () => {
  // Улов child_programs (2026-08-29): детская строка без кавычек получала
  // «expected 'function' after callback return type» и каскад восстановления.
  const words = compileIdyllium([
    'use console;',
    '',
    'main() {',
    '    console.writeln(введите радиус круга);',
    '}',
  ].join('\n'));
  assert(!words.success, 'bare words must not compile');
  assert(
    words.diagnosticsText.includes('text needs quotes — did you mean "введите радиус круга"?'),
    `quotes hint wording: ${words.diagnosticsText}`,
  );
  assert(
    words.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length === 1,
    `the word chain must be swallowed without a recovery cascade: ${words.diagnosticsText}`,
  );

  // Одинокое слово — прежний путь: честное «не объявлено» от семантики.
  assertFails(`
use console;

main() {
    console.writeln(привет);
}
`, "'привет' was not declared in this scope");

  // Примитивный тип перед именем — подсказка «тип здесь не нужен».
  assertFails(`
use console;

main() {
    console.writeln(int привет);
}
`, "a type is not needed here — did you mean just 'привет'?");
});

test('ritual declarations get honest words instead of parser jargon', () => {
  // Улов методистов по историям tkinter-ловушек (2026-08-29): ритуальные
  // конструкции из других языков получали жаргон и каскад восстановления.
  const typeInCondition = compileIdyllium([
    'use console;',
    '',
    'main() {',
    '    int a = 5;',
    '    if (int a > 0) {',
    '        console.writeln(a);',
    '    }',
    '}',
  ].join('\n'));
  assert(!typeInCondition.success, 'ritual type in a condition must not compile');
  assert(
    typeInCondition.diagnosticsText.includes("a type is not needed here — did you mean just 'a'?"),
    `type-in-condition wording: ${typeInCondition.diagnosticsText}`,
  );
  assert(
    typeInCondition.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length === 1,
    `type-in-condition must not cascade: ${typeInCondition.diagnosticsText}`,
  );

  const classInside = compileIdyllium([
    'main() {',
    '    class Hero {',
    '        int hp;',
    '    }',
    '}',
  ].join('\n'));
  assert(!classInside.success, 'class inside a function must not compile');
  assert(
    classInside.diagnosticsText.includes("class 'Hero' must be declared outside of functions"),
    `class-inside wording: ${classInside.diagnosticsText}`,
  );
  assert(
    classInside.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length === 1,
    `class-inside must not cascade: ${classInside.diagnosticsText}`,
  );

  const nestedFunction = compileIdyllium([
    'use console;',
    '',
    'main() {',
    '    int function helper(int x) {',
    '        return x;',
    '    }',
    '    console.writeln(1);',
    '}',
  ].join('\n'));
  assert(!nestedFunction.success, 'nested function must not compile');
  assert(
    nestedFunction.diagnosticsText.includes('a function must be declared outside of other functions'),
    `nested-function wording: ${nestedFunction.diagnosticsText}`,
  );
  assert(
    nestedFunction.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length === 1,
    `nested-function must not cascade: ${nestedFunction.diagnosticsText}`,
  );
});
