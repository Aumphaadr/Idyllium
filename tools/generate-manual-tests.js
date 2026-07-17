const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const suiteRoot = path.join(repoRoot, 'spec', 'some_tests');
const entries = [];

function ensureDirectory(target) {
  fs.mkdirSync(target, { recursive: true });
}

function write(relativePath, content) {
  const target = path.join(suiteRoot, relativePath);
  ensureDirectory(path.dirname(target));
  fs.writeFileSync(target, `${content.trim()}\n`, 'utf8');
}

function header(title, checks, actions = []) {
  const lines = [
    `// РУЧНОЙ ТЕСТ: ${title}`,
    ...actions.map((item) => `// ДЕЙСТВИЕ: ${item}`),
    ...checks.map((item) => `// ОЖИДАЕТСЯ: ${item}`),
    '',
  ];
  return lines.join('\n');
}

function addStandalone(category, number, slug, title, kind, source, checks, options = {}) {
  const filename = `${String(number).padStart(3, '0')}_${slug}.idyl`;
  const entry = path.posix.join(category, filename);
  write(entry, `${header(title, checks, options.actions)}${source}`);
  entries.push({
    id: `${category.slice(0, 2)}-${String(number).padStart(3, '0')}`,
    category,
    title,
    kind,
    entry,
    projectRoot: category,
    sourceFiles: [filename],
    checks,
    actions: options.actions ?? [],
    input: options.input ?? [],
  });
}

function addProject(category, number, slug, title, kind, files, checks, options = {}) {
  const folder = `${String(number).padStart(3, '0')}_${slug}`;
  const projectRoot = path.posix.join(category, folder);
  for (const [name, source] of Object.entries(files)) {
    const isEntry = name === (options.entry ?? 'main.idyl');
    write(path.posix.join(projectRoot, name), isEntry ? `${header(title, checks, options.actions)}${source}` : source);
  }
  entries.push({
    id: `${category.slice(0, 2)}-${String(number).padStart(3, '0')}`,
    category,
    title,
    kind,
    entry: path.posix.join(projectRoot, options.entry ?? 'main.idyl'),
    projectRoot,
    sourceFiles: Object.keys(files).filter((name) => name.endsWith('.idyl')),
    checks,
    actions: options.actions ?? [],
    input: options.input ?? [],
  });
}

function copyAsset(source, destination) {
  const target = path.join(suiteRoot, destination);
  ensureDirectory(path.dirname(target));
  fs.copyFileSync(path.join(repoRoot, source), target);
}

function consoleProgram(body, uses = ['console'], globals = '') {
  const imports = uses.map((name) => `use ${name};`).join('\n');
  return `${imports}\n\n${globals ? `${globals.trim()}\n\n` : ''}main() {\n${body.trimEnd()}\n}`;
}

function canvasProgram(options) {
  const uses = ['colors', 'drawable', 'gui', ...(options.uses ?? [])];
  const imports = [...new Set(uses)].map((name) => `use ${name};`).join('\n');
  const bindings = Object.entries(options.bindings ?? { on_init: 'init' })
    .map(([event, callback]) => `    canvas.${event} = ${callback};`)
    .join('\n');
  return `${imports}\n\n${(options.globals ?? '').trim()}\n\n${options.functions.trim()}\n\nmain() {\n    gui.Window win;\n    win.width = ${options.windowWidth ?? 700};\n    win.height = ${options.windowHeight ?? 520};\n    win.title = "${options.title}";\n\n    gui.Canvas canvas;\n    canvas.x = 20;\n    canvas.y = 20;\n    canvas.width = ${options.canvasWidth ?? 640};\n    canvas.height = ${options.canvasHeight ?? 420};\n    canvas.framerate_limit = ${options.framerate ?? 60};\n${bindings}\n${options.mainExtra ? `\n${options.mainExtra.trimEnd()}\n` : ''}\n    win.add_child(canvas);\n    win.show();\n}`;
}

// 01. Core language and console.
addStandalone('01_core', 1, 'hello_unicode', 'Unicode and basic output', 'console', consoleProgram(`
    console.writeln("Hello, Idyllium!");
    console.writeln("Привет, Идиллиум!");
    console.writeln('Я');
`), ['Three lines appear without mojibake.']);

addStandalone('01_core', 2, 'primitive_values', 'Primitive values', 'console', consoleProgram(`
    int age = 14;
    float temperature = 36.6;
    bool ready = true;
    char grade = 'A';
    string name = "Mira";
    console.writeln(age, " | ", temperature, " | ", ready, " | ", grade, " | ", name);
`), ['Output: 14 | 36.6 | true | A | Mira']);

addStandalone('01_core', 3, 'arithmetic', 'Arithmetic and precedence', 'console', consoleProgram(`
    int a = 20;
    int b = 6;
    console.writeln(a + b);
    console.writeln(a - b);
    console.writeln(a * b);
    console.writeln(a / b);
    console.writeln(mod(a, b));
    console.writeln(2 + 3 * 4);
    console.writeln((2 + 3) * 4);
`), ['Output lines: 26, 14, 120, 3.3333333333333335, 2, 14, 20.']);

addStandalone('01_core', 4, 'comparisons_logic', 'Comparisons and logic', 'console', consoleProgram(`
    int a = 7;
    int b = 10;
    console.writeln(a < b);
    console.writeln(a == 7 and b != 7);
    console.writeln(a > b or b == 10);
    console.writeln(not(false));
`), ['Four true values are printed.']);

addStandalone('01_core', 5, 'if_else', 'Conditional branches', 'console', consoleProgram(`
    int score = 73;
    if (score >= 90) {
        console.writeln("excellent");
    } else if (score >= 60) {
        console.writeln("passed");
    } else {
        console.writeln("try again");
    }
`), ['Output: passed']);

addStandalone('01_core', 6, 'while_loop', 'While loop', 'console', consoleProgram(`
    int value = 1;
    while (value <= 16) {
        console.write(value, " ");
        value *= 2;
    }
    console.writeln();
`), ['Output: 1 2 4 8 16']);

addStandalone('01_core', 7, 'do_while', 'Do-while executes once', 'console', consoleProgram(`
    int attempts = 0;
    do {
        console.writeln("attempt ", attempts);
        attempts += 1;
    } while (attempts < 1);
`), ['Exactly one line is printed: attempt 0.']);

addStandalone('01_core', 8, 'for_break_continue', 'For, break and continue', 'console', consoleProgram(`
    for (int i = 0; i < 10; i += 1) {
        if (i == 3) { continue; }
        if (i == 7) { break; }
        console.write(i, " ");
    }
    console.writeln();
`), ['Output: 0 1 2 4 5 6']);

addStandalone('01_core', 9, 'named_constants', 'Named constants', 'console', consoleProgram(`
    const int MAX_LEVEL = 12;
    const string GAME_NAME = "Orbit";
    console.writeln(GAME_NAME, ": ", MAX_LEVEL);
`), ['Output: Orbit: 12']);

addStandalone('01_core', 10, 'conversions', 'Explicit conversions', 'console', consoleProgram(`
    string source = "42";
    int number = to_int(source);
    float part = to_float("2.5");
    console.writeln(number + 8);
    console.writeln(part * 4);
    console.writeln(to_string(number) + " cats");
`), ['Output lines: 50, 10, 42 cats.']);

addStandalone('01_core', 11, 'math_rounding', 'Math rounding and defaults', 'console', consoleProgram(`
    console.writeln(math.floor(12.987));
    console.writeln(math.floor(12.987, 2));
    console.writeln(math.ceil(12.001));
    console.writeln(math.round(12.567, 1));
` , ['console', 'math']), ['Output lines: 12, 12.98, 13, 12.6.']);

addStandalone('01_core', 12, 'console_clear', 'Console clear', 'console', consoleProgram(`
    console.writeln("This line must disappear");
    console.clear();
    console.writeln("Only kittens remain");
`), ['Only the final line remains visible.']);

addStandalone('01_core', 13, 'recursion', 'Recursive factorial', 'console', consoleProgram(`
    console.writeln(factorial(6));
`, ['console'], `
int function factorial(int value) {
    if (value <= 1) { return 1; }
    return value * factorial(value - 1);
}
`), ['Output: 720']);

addStandalone('01_core', 14, 'default_named_args', 'Default and named arguments', 'console', consoleProgram(`
    console.writeln(subtract(50, 30));
    console.writeln(subtract(right=50, left=30));
    console.writeln(subtract(left=8));
`, ['console'], `
int function subtract(int left, int right = 2) {
    return left - right;
}
`), ['Output lines: 20, -20, 6.']);

addStandalone('01_core', 15, 'deterministic_random', 'Seeded random values', 'console', consoleProgram(`
    random.set_seed(12345);
    int first = random.create_int(1, 100);
    random.set_seed(12345);
    int second = random.create_int(1, 100);
    console.writeln(first == second);
    console.writeln(first);
`, ['console', 'random']), ['First line is true; repeated runs print the same number.']);

addStandalone('01_core', 16, 'console_input', 'Typed console input', 'console', consoleProgram(`
    console.write("Name: ");
    string name = console.get_string();
    console.write("Age: ");
    int age = console.get_int();
    console.writeln(name, " will be ", age + 1);
`), ['Entered values are echoed by WebIDE and the final age is incremented.'], {
  input: ['Mira', '14'],
  actions: ['Enter Mira, then 14.'],
});

// 02. Arrays and strings.
addStandalone('02_arrays_strings', 1, 'static_array', 'Static array indexing', 'console', consoleProgram(`
    array<int, 5> values = [10, 20, 30, 40, 50];
    values[2] = 99;
    console.writeln(values);
    console.writeln(values[0], " ", values[4], " length=", values.length());
`), ['Array is [10, 20, 99, 40, 50]; length is 5.']);

addStandalone('02_arrays_strings', 2, 'dynamic_methods', 'Dynamic array mutations', 'console', consoleProgram(`
    dyn_array<string> items = ["axe", "bow"];
    items.add("staff");
    items.insert(1, "shield");
    items.remove_at(0);
    string last = items.pop();
    console.writeln(items);
    console.writeln(last);
`), ['Output array is ["shield", "bow"]; popped value is staff.']);

addStandalone('02_arrays_strings', 3, 'resize_join', 'Resize and join', 'console', consoleProgram(`
    dyn_array<int> left = [1, 2, 3];
    dyn_array<int> right = [4, 5];
    left.join(right);
    left.resize(7);
    console.writeln(left);
    left.resize(4);
    console.writeln(left);
`), ['First array has seven cells; second is [1, 2, 3, 4].']);

addStandalone('02_arrays_strings', 4, 'sort_reverse', 'Sort and reverse', 'console', consoleProgram(`
    dyn_array<int> values = [7, 2, 9, 2, 1];
    values.sort();
    console.writeln(values);
    values.reverse();
    console.writeln(values);
`), ['Ascending then descending order is printed.']);

addStandalone('02_arrays_strings', 5, 'search_count', 'Array search and count', 'console', consoleProgram(`
    dyn_array<int> values = [4, 8, 4, 2, 4];
    console.writeln(values.contains(8));
    console.writeln(values.find(2));
    console.writeln(values.count(4));
`), ['Output lines: true, 3, 3.']);

addStandalone('02_arrays_strings', 6, 'aggregates', 'Array aggregate functions', 'console', consoleProgram(`
    dyn_array<int> values = [3, 9, 6, 2];
    console.writeln(min(values));
    console.writeln(max(values));
    console.writeln(sum(values));
    console.writeln(avg(values));
`), ['Output lines: 2, 9, 20, 5.']);

addStandalone('02_arrays_strings', 7, 'value_semantics', 'Array value semantics', 'console', consoleProgram(`
    array<int, 3> original = [1, 2, 3];
    array<int, 3> changed = increase(original);
    console.writeln(original);
    console.writeln(changed);
`, ['console'], `
array<int, 3> function increase(array<int, 3> values) {
    for (int i = 0; i < values.length(); i += 1) {
        values[i] += 10;
    }
    return values;
}
`), ['Original remains [1, 2, 3]; changed is [11, 12, 13].']);

addStandalone('02_arrays_strings', 8, 'fixed_dynamic_conversion', 'Fixed and dynamic array conversion', 'console', consoleProgram(`
    array<int, 3> fixed = [7, 8, 9];
    dyn_array<int> dynamic = fixed;
    dynamic.add(10);
    array<int, 4> fixed_again = dynamic;
    console.writeln(fixed);
    console.writeln(fixed_again);
`), ['Original fixed array is unchanged; converted result is [7, 8, 9, 10].']);

addStandalone('02_arrays_strings', 9, 'nested_arrays', 'Nested arrays', 'console', consoleProgram(`
    array<array<int, 3>, 2> matrix = [[1, 2, 3], [4, 5, 6]];
    matrix[1][0] = 40;
    console.writeln(matrix);
    console.writeln(matrix[0][2] + matrix[1][2]);
`), ['Nested structure is readable; final sum is 9.']);

addStandalone('02_arrays_strings', 10, 'string_methods', 'String methods', 'console', consoleProgram(`
    string source = "  Red cat, red hat  ";
    string clean = source.trim().to_lower();
    console.writeln(clean);
    console.writeln(clean.replace("red", "blue"));
    console.writeln(clean.substring(4, 3));
    console.writeln(clean.count("red"));
`), ['Trim/lowercase, replace, substring cat, and count 2 are visible.']);

addStandalone('02_arrays_strings', 11, 'unicode_string', 'Unicode string indexing', 'console', consoleProgram(`
    string word = "Котики";
    console.writeln(word.length());
    console.writeln(word[0]);
    console.writeln(word.substring(1, 3));
`), ['Length is 6; first character is К; substring is оти.']);

addStandalone('02_arrays_strings', 12, 'escaped_array_output', 'Escaped strings inside arrays', 'console', consoleProgram(`
    dyn_array<string> lines = ["first\\n", "quote: \\\"", "tab\\tend"];
    console.writeln(lines);
    console.writeln(lines[0]);
`), ['Array output uses quotes and visible escape sequences; standalone string prints its newline.']);

// 03. Functions, classes and modules.
addStandalone('03_functions_oop', 1, 'function_returns', 'Functions returning different types', 'console', consoleProgram(`
    console.writeln(square(7));
    console.writeln(greeting("Mira"));
    console.writeln(is_even(42));
`, ['console'], `
int function square(int value) { return value * value; }
string function greeting(string name) { return "Hello, " + name; }
bool function is_even(int value) { return mod(value, 2) == 0; }
`), ['Output lines: 49, Hello Mira, true.']);

addStandalone('03_functions_oop', 2, 'typed_main', 'Main returning a non-void type', 'console', `use console;\n\nstring function main() {\n    console.writeln("Typed main ran");\n    return "finished";\n}`, ['Console output appears and the program finishes successfully.']);

addStandalone('03_functions_oop', 3, 'fields_methods', 'Class fields and methods', 'console', consoleProgram(`
    Counter counter;
    counter.add(5);
    counter.add(3);
    console.writeln(counter.value);
`, ['console'], `
class Counter {
    int value = 0;

    void function add(int amount) {
        this.value += amount;
    }
}
`), ['Output: 8']);

addStandalone('03_functions_oop', 4, 'constructor', 'Constructor with defaults and named arguments', 'console', consoleProgram(`
    Player first("Mira");
    Player second(level=7, name="Liam");
    console.writeln(first.describe());
    console.writeln(second.describe());
`, ['console'], `
class Player {
    string name;
    int level;

    constructor Player(string name, int level = 1) {
        this.name = name;
        this.level = level;
    }

    string function describe() {
        return this.name + ": " + to_string(this.level);
    }
}
`), ['Output lines: Mira: 1 and Liam: 7.']);

addStandalone('03_functions_oop', 5, 'encapsulation', 'Public and private members', 'console', consoleProgram(`
    Wallet wallet(100);
    wallet.spend(35);
    console.writeln(wallet.get_balance());
`, ['console'], `
class Wallet {
private:
    int balance;

public:
    constructor Wallet(int balance) { this.balance = balance; }

    void function spend(int amount) {
        if (amount <= this.balance) { this.balance -= amount; }
    }

    int function get_balance() { return this.balance; }
}
`), ['Output: 65']);

addStandalone('03_functions_oop', 6, 'static_members', 'Static class methods', 'console', consoleProgram(`
    console.writeln(MathUtils.square(7));
    console.writeln(MathUtils.cube(3));
    console.writeln(MathUtils.is_even(42));
`, ['console'], `
class MathUtils {
    static int function square(int value) { return value * value; }
    static int function cube(int value) { return value * value * value; }
    static bool function is_even(int value) { return mod(value, 2) == 0; }
}
`), ['Output lines: 49, 27 and true.']);

addStandalone('03_functions_oop', 7, 'inheritance', 'Inheritance and runtime dispatch', 'console', consoleProgram(`
    Animal base("Creature");
    Dog dog("Rex");
    console.writeln(base.speak());
    console.writeln(dog.speak());
`, ['console'], `
class Animal {
    string name;
    constructor Animal(string name) { this.name = name; }
    string function speak() { return this.name + " makes a sound"; }
}

class Dog extends Animal {
    constructor Dog(string name) { parent(name); }
    string function speak() { return this.name + " says woof"; }
}
`), ['Output contains the base phrase and Rex says woof.']);

addStandalone('03_functions_oop', 8, 'polymorphic_parameter', 'Base-class parameter polymorphism', 'console', consoleProgram(`
    Cat cat("Misty");
    print_sound(cat);
`, ['console'], `
class Animal {
    string name;
    constructor Animal(string name) { this.name = name; }
    string function speak() { return "sound"; }
}

class Cat extends Animal {
    constructor Cat(string name) { parent(name); }
    string function speak() { return this.name + " says meow"; }
}

void function print_sound(Animal animal) {
    console.writeln(animal.speak());
}
`), ['Output: Misty says meow']);

addStandalone('03_functions_oop', 9, 'object_array', 'Array of class instances', 'console', consoleProgram(`
    Item first("sword", 120);
    Item second("potion", 25);
    dyn_array<Item> items = [first, second];
    for (int i = 0; i < items.length(); i += 1) {
        console.writeln(items[i].name, ": ", items[i].price);
    }
`, ['console'], `
class Item {
    string name;
    int price;
    constructor Item(string name, int price) {
        this.name = name;
        this.price = price;
    }
}
`), ['Two distinct objects are printed with correct prices.']);

addProject('03_functions_oop', 10, 'module_functions', 'Imported function and constant', 'console', {
  'main.idyl': `use calculations;\nuse console;\n\nmain() {\n    console.writeln(calculations.APP_NAME);\n    console.writeln(calculations.area(7, 4));\n}`,
  'calculations.idyl': `const string APP_NAME = "Geometry module";\n\nint function area(int width, int height) {\n    return width * height;\n}`,
}, ['Output lines: Geometry module and 28.']);

addProject('03_functions_oop', 11, 'module_class', 'Imported class', 'console', {
  'main.idyl': `use console;\nuse hero;\n\nmain() {\n    hero.Hero player("Mira", 3);\n    player.gain_level();\n    console.writeln(player.describe());\n}`,
  'hero.idyl': `class Hero {\n    string name;\n    int level;\n\n    constructor Hero(string name, int level = 1) {\n        this.name = name;\n        this.level = level;\n    }\n\n    void function gain_level() { this.level += 1; }\n    string function describe() { return this.name + " level " + to_string(this.level); }\n}`,
}, ['Output: Mira level 4.']);

addProject('03_functions_oop', 12, 'three_file_project', 'Three-file project', 'console', {
  'main.idyl': `use console;\nuse report;\n\nmain() {\n    console.writeln(report.make_report("Mira", 84));\n}`,
  'report.idyl': `use grading;\n\nstring function make_report(string name, int score) {\n    return name + ": " + grading.grade(score);\n}`,
  'grading.idyl': `string function grade(int score) {\n    if (score >= 90) { return "A"; }\n    if (score >= 75) { return "B"; }\n    return "C";\n}`,
}, ['Output: Mira: B']);

// 04. Low-level types, colors and encoding.
addStandalone('04_types_colors_encoding', 1, 'uint_wrap', 'Unsigned integer wraparound', 'console', consoleProgram(`
    types.uint8 near_end = 253;
    console.writeln(near_end);
    near_end += 1;
    console.writeln(near_end);
    near_end += 1;
    console.writeln(near_end);
    near_end += 1;
    console.writeln(near_end);
    types.uint8 from_negative = -11;
    types.uint8 too_large = 260;
    console.writeln(from_negative, " ", too_large);
`, ['console', 'types']), ['Output lines: 253, 254, 255, 0, then 245 4.']);

addStandalone('04_types_colors_encoding', 2, 'signed_wrap', 'Signed integer wraparound', 'console', consoleProgram(`
    types.int8 maximum = 127;
    types.int8 wrapped = maximum + 1;
    types.int8 minimum = -128;
    types.int8 wrapped_back = minimum - 1;
    console.writeln(wrapped);
    console.writeln(wrapped_back);
`, ['console', 'types']), ['Output lines: -128 and 127.']);

addStandalone('04_types_colors_encoding', 3, 'binary_hex', 'Binary and hexadecimal conversions', 'console', consoleProgram(`
    types.uint8 value = 171;
    console.writeln(value.to_bin());
    console.writeln(value.to_hex());
    console.writeln(types.from_bin("11111111", "uint8"));
    console.writeln(types.from_hex("80", "int8"));
`, ['console', 'types']), ['Output includes 10101011, AB, 255 and -128.']);

addStandalone('04_types_colors_encoding', 4, 'integer_shifts', 'Integer bit shifts', 'console', consoleProgram(`
    types.uint8 value = 43;
    console.writeln(value.shift_right(3));
    console.writeln(value.shift_left(3));
    console.writeln(value.shift_left(12));
    console.writeln(value.shift_left(-3));
    console.writeln(value.shift_right(-3));
`, ['console', 'types']), ['Output lines: 5, 88, 0, 5, 88.']);

addStandalone('04_types_colors_encoding', 5, 'float_shifts', 'IEEE-754 bit shifts', 'console', consoleProgram(`
    types.float32 source = 4.5;
    types.float32 strange = source.shift_left(3);
    types.float32 restored_direction = source.shift_right(-3);
    console.writeln(source.to_bin());
    console.writeln(strange.to_bin());
    console.writeln(strange == restored_direction);
`, ['console', 'types']), ['Two different 32-bit strings appear; final value is true.']);

addStandalone('04_types_colors_encoding', 6, 'int64_exact', 'Exact 64-bit integers', 'console', consoleProgram(`
    types.uint64 exact = 9007199254740993;
    types.uint64 maximum = 18446744073709551615;
    types.uint64 wrapped = maximum + 1;
    types.int64 signed_maximum = 9223372036854775807;
    types.int64 signed_minimum = signed_maximum + 1;
    console.writeln(exact);
    console.writeln(wrapped);
    console.writeln(signed_minimum);
`, ['console', 'types']), ['All digits of 9007199254740993 survive; wrap results are 0 and -9223372036854775808.']);

addStandalone('04_types_colors_encoding', 7, 'float_precision', 'Float32 and float64 precision', 'console', consoleProgram(`
    types.float32 small = 0.1;
    types.float64 precise = 0.1;
    types.float32 sum32 = small + small + small;
    types.float64 sum64 = precise + precise + precise;
    console.writeln(sum32);
    console.writeln(sum64);
    console.writeln(sum32.to_bin().length(), " ", sum64.to_bin().length());
`, ['console', 'types']), ['Both sums print; bit strings have lengths 32 and 64.']);

addStandalone('04_types_colors_encoding', 8, 'color_factories', 'Color factories and equality', 'console', consoleProgram(`
    colors.Color red_rgb = colors.RGB(255, 0, 0);
    colors.Color red_hex = colors.HEX("#ff0000");
    colors.Color half_blue = colors.RGBA(0, 0, 255, 0.5);
    colors.Color green_hsl = colors.HSL(120, 100, 50);
    console.writeln(red_rgb == red_hex);
    console.writeln(red_rgb);
    console.writeln(half_blue);
    console.writeln(green_hsl);
`, ['console', 'colors']), ['First line is true; remaining colors have readable structured output.']);

addStandalone('04_types_colors_encoding', 9, 'encoding_roundtrip', 'UTF-8 encoding roundtrip', 'console', consoleProgram(`
    string source = "кот";
    dyn_array<int> bytes = encoding.encode(source, "utf-8");
    string restored = encoding.decode(bytes, "utf-8");
    console.writeln(bytes);
    console.writeln(restored);
    console.writeln(encoding.char_to_int('A', "utf-8"));
    console.writeln(encoding.int_to_char(65, "utf-8"));
`, ['console', 'encoding']), ['Byte array appears; restored text is кот; then 65 and A.']);

addStandalone('04_types_colors_encoding', 10, 'invalid_color', 'Invalid RGB range', 'expected-error', consoleProgram(`
    colors.Color impossible = colors.RGB(999, -20, 300);
    console.writeln(impossible);
`, ['console', 'colors']), ['A readable runtime error reports an invalid RGB channel; no clamping occurs.']);

// 05. Files, JSON and SQLite.
addStandalone('05_files_json_sqlite', 1, 'file_write_read', 'Write and read a text file', 'console', consoleProgram(`
    string path = "manual_text.txt";
    if (file.exists(path)) { file.remove(path); }

    file.ostream fout = file.open(path, "write");
    fout.write_line("Mira");
    fout.write_line(12);
    console.writeln("open before close: ", fout.is_open);
    fout.close();
    console.writeln("open after close: ", fout.is_open);

    file.istream fin = file.open(path, "read");
    console.write(fin.read_all());
    fin.close();
`, ['console', 'file']), ['is_open changes true to false; file contains Mira and 12 on separate lines.']);

addProject('05_files_json_sqlite', 2, 'read_all_fixture', 'Read an existing text asset', 'console', {
  'main.idyl': `use console;\nuse file;\n\nmain() {\n    file.istream fin = file.open("story.txt", "read");\n    string text = fin.read_all();\n    fin.close();\n    console.write(text);\n}`,
  'story.txt': `first line\nsecond line\nthird line`,
}, ['All three lines are printed exactly once.']);

addStandalone('05_files_json_sqlite', 3, 'directory_lifecycle', 'Directory lifecycle', 'console', consoleProgram(`
    if (file.exists("manual_tree")) { file.remove("manual_tree", recursive=true); }
    file.create_directory("manual_tree/a/b", parents=true);

    file.ostream fout = file.open("manual_tree/a/b/data.txt", "write");
    fout.write_line("value");
    fout.close();

    console.writeln(file.is_directory("manual_tree/a"));
    console.writeln(file.is_file("manual_tree/a/b/data.txt"));
    console.writeln(file.list_directory("manual_tree/a/b"));

    file.copy("manual_tree", "manual_tree_copy");
    file.rename("manual_tree_copy", "manual_tree_archive");
    console.writeln(file.exists("manual_tree_archive/a/b/data.txt"));
    file.remove("manual_tree", recursive=true);
    file.remove("manual_tree_archive", recursive=true);
`, ['console', 'file']), ['Three true checks appear and listing contains data.txt; rerunning is safe.']);

addStandalone('05_files_json_sqlite', 4, 'nonempty_remove_error', 'Safe non-empty directory removal', 'expected-error', consoleProgram(`
    if (file.exists("manual_nonempty")) { file.remove("manual_nonempty", recursive=true); }
    file.create_directory("manual_nonempty");
    file.ostream fout = file.open("manual_nonempty/data.txt", "write");
    fout.write_line("keep me");
    fout.close();
    file.remove("manual_nonempty");
`, ['console', 'file']), ['Runtime error explains that recursive=true is required.']);

addStandalone('05_files_json_sqlite', 5, 'json_parse', 'Parse JSON values and null', 'console', consoleProgram(`
    string text = "{\\"name\\":\\"Mira\\",\\"level\\":7,\\"active\\":true,\\"nickname\\":null}";
    json.Object root = json.parse(text).to_object();
    console.writeln(root.get("name").to_string());
    console.writeln(root.get("level").to_int());
    console.writeln(root.get("active").to_bool());
    console.writeln(root.get("nickname") == null);
    console.writeln(root.get("nickname").is_null());
`, ['console', 'json']), ['Output lines: Mira, 7, true, true, true.']);

addStandalone('05_files_json_sqlite', 6, 'json_create_write', 'Create, format and save JSON', 'console', consoleProgram(`
    json.Object root;
    root.add("name", json.Value("Liam"));
    root.add("age", json.Value(12));
    root.add("admin", json.Value(false));
    root.add("middle_name", null);

    string compact = root.to_json();
    string pretty = root.to_pretty_json(2);
    console.writeln(compact);
    console.writeln(pretty);

    file.ostream fout = file.open("manual_player.json", "write");
    fout.write_line(pretty);
    fout.close();
`, ['console', 'file', 'json']), ['Compact JSON is one line; pretty JSON is indented; manual_player.json is created.']);

addStandalone('05_files_json_sqlite', 7, 'json_nested_arrays', 'Nested JSON objects and arrays', 'console', consoleProgram(`
    json.Array inventory;
    inventory.add(json.Value("pickaxe"));
    inventory.add(json.Value("torch"));

    json.Object position;
    position.add("x", json.Value(120));
    position.add("y", json.Value(75));

    json.Object root;
    root.add("inventory", json.Value(inventory));
    root.add("position", json.Value(position));

    json.Array read_inventory = root.get("inventory").to_array();
    json.Object read_position = root.get("position").to_object();
    console.writeln(read_inventory.at(1).to_string());
    console.writeln(read_position.get("x").to_int());
    console.writeln(root.to_pretty_json());
`, ['console', 'json']), ['Output begins with torch and 120, followed by valid nested JSON.']);

addStandalone('05_files_json_sqlite', 8, 'invalid_json', 'Invalid JSON text', 'expected-error', consoleProgram(`
    string broken = "{\\"name\\": \\"Mira\\", // comments are forbidden\\n}";
    console.writeln(json.parse(broken));
`, ['console', 'json']), ['One concise runtime error points to invalid JSON; no JavaScript stack trace.']);

addStandalone('05_files_json_sqlite', 9, 'sqlite_crud', 'SQLite create, insert and select', 'console', consoleProgram(`
    string path = "manual_crud.db";
    if (file.exists(path)) { file.remove(path); }
    sqlite.Database db = sqlite.open(path);
    db.execute("CREATE TABLE players (id INTEGER, name TEXT, level INTEGER)");
    db.execute("INSERT INTO players VALUES (1, 'Mira', 7)");
    db.execute("INSERT INTO players VALUES (2, 'Liam', 4)");
    sqlite.Result rows = db.execute("SELECT name, level FROM players ORDER BY id");
    while (rows.next()) {
        console.writeln(rows.get_string("name"), ": ", rows.get_int("level"));
    }
    db.close();
`, ['console', 'file', 'sqlite']), ['Output lines: Mira: 7 and Liam: 4.']);

addStandalone('05_files_json_sqlite', 10, 'sqlite_bind', 'SQLite named bind values', 'console', consoleProgram(`
    string path = "manual_bind.db";
    if (file.exists(path)) { file.remove(path); }
    sqlite.Database db = sqlite.open(path);
    db.execute("CREATE TABLE notes (id INTEGER, text TEXT, done INTEGER)");
    sqlite.Statement insert = db.prepare("INSERT INTO notes VALUES (:id, :text, :done)");
    insert.bind_int("id", 1);
    insert.bind_string("text", "O'Neil's note");
    insert.bind_bool("done", false);
    insert.execute();
    sqlite.Result rows = db.execute("SELECT text, done FROM notes");
    rows.next();
    console.writeln(rows.get_string("text"));
    console.writeln(rows.get_bool("done"));
    db.close();
`, ['console', 'file', 'sqlite']), ["Apostrophes survive safely; second line is false."]);

addStandalone('05_files_json_sqlite', 11, 'sqlite_rollback', 'SQLite transaction rollback', 'console', consoleProgram(`
    string path = "manual_rollback.db";
    if (file.exists(path)) { file.remove(path); }
    sqlite.Database db = sqlite.open(path);
    db.execute("CREATE TABLE values_table (value INTEGER)");
    db.begin_transaction();
    db.execute("INSERT INTO values_table VALUES (42)");
    db.rollback();
    sqlite.Result rows = db.execute("SELECT COUNT(*) AS total FROM values_table");
    rows.next();
    console.writeln(rows.get_int("total"));
    db.close();
`, ['console', 'file', 'sqlite']), ['Output: 0']);

addStandalone('05_files_json_sqlite', 12, 'sqlite_null_int64', 'SQLite null and int64', 'console', consoleProgram(`
    string path = "manual_types.db";
    if (file.exists(path)) { file.remove(path); }
    sqlite.Database db = sqlite.open(path);
    db.execute("CREATE TABLE samples (huge INTEGER, note TEXT)");
    sqlite.Statement insert = db.prepare("INSERT INTO samples VALUES (:huge, :note)");
    types.int64 maximum = 9223372036854775807;
    insert.bind_int64("huge", maximum);
    insert.bind_null("note");
    insert.execute();
    sqlite.Result rows = db.execute("SELECT huge, note FROM samples");
    rows.next();
    console.writeln(rows.get_int64("huge"));
    console.writeln(rows.get("note") == null);
    console.writeln(rows.get("note").is_null());
    db.close();
`, ['console', 'file', 'sqlite', 'types']), ['Exact maximum int64 prints, followed by true and true.']);

// 06. GUI widgets and interactions.
addStandalone('06_gui', 1, 'window_defaults', 'Окно и размеры виджетов по умолчанию', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 420;\n    win.height = 220;\n    win.title = "GUI defaults";\n\n    gui.Label label;\n    label.x = 24;\n    label.y = 24;\n    label.text = "Label";\n\n    gui.Button button;\n    button.x = 24;\n    button.y = 70;\n    button.text = "Button";\n\n    gui.LineEdit input;\n    input.x = 170;\n    input.y = 70;\n    input.placeholder = "LineEdit";\n\n    win.add_child(label);\n    win.add_child(button);\n    win.add_child(input);\n    win.show();\n}`, ['Все три виджета видны, имеют разумные размеры и не перекрываются.']);

addStandalone('06_gui', 2, 'label_colors', 'Цвета и граница Label', 'gui', `use colors;\nuse gui;\n\nmain() {\n    gui.Window win;\n    win.width = 440;\n    win.height = 200;\n    win.title = "Label colors";\n\n    gui.Label label;\n    label.x = 30;\n    label.y = 40;\n    label.width = 350;\n    label.height = 70;\n    label.text = "Контрастная надпись";\n    label.font_size = 24;\n    label.text_color = colors.RGB(255, 238, 160);\n    label.background_color = colors.RGB(48, 37, 76);\n    label.border_color = colors.RGB(166, 126, 255);\n\n    win.add_child(label);\n    win.show();\n}`, ['Текст, фон и рамка имеют три разных, хорошо различимых цвета.']);

addStandalone('06_gui', 3, 'button_click', 'Кнопка, sender и микроанимация', 'gui', `use console;\nuse gui;\n\nmain() {\n    gui.Window win;\n    win.width = 360;\n    win.height = 190;\n    win.title = "Button click";\n\n    gui.Button button;\n    button.x = 70;\n    button.y = 55;\n    button.width = 210;\n    button.height = 48;\n    button.text = "Нажми меня";\n    button.on_click = void function(gui.Button sender) {\n        sender.text = "Нажато";\n        console.writeln("button clicked");\n    };\n\n    win.add_child(button);\n    win.show();\n}`, ['Кнопка визуально реагирует на нажатие, меняет текст, в консоли появляется button clicked.'], { actions: ['Нажать кнопку несколько раз.'] });

addStandalone('06_gui', 4, 'lineedit', 'LineEdit: ввод, focus и on_change', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 430;\n    win.height = 210;\n    win.title = "LineEdit";\n\n    gui.LineEdit input;\n    input.x = 30;\n    input.y = 45;\n    input.width = 360;\n    input.height = 40;\n    input.placeholder = "Введите имя";\n\n    gui.Label mirror;\n    mirror.x = 30;\n    mirror.y = 115;\n    mirror.width = 360;\n    mirror.text = "Пока пусто";\n\n    input.on_change = void function() {\n        mirror.text = "Введено: " + input.text;\n    };\n\n    win.add_child(input);\n    win.add_child(mirror);\n    win.show();\n}`, ['При фокусе поле подсвечивается; текст меняется без потери символов и сразу дублируется ниже.'], { actions: ['Кликнуть по полю, ввести кириллицу и латиницу, исправить середину строки Backspace/Delete.'] });

addStandalone('06_gui', 5, 'textedit', 'Многострочный TextEdit', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 500;\n    win.height = 320;\n    win.title = "TextEdit";\n\n    gui.TextEdit editor;\n    editor.x = 24;\n    editor.y = 24;\n    editor.width = 440;\n    editor.height = 220;\n    editor.placeholder = "Несколько строк текста";\n    editor.text = "Первая строка\\nВторая строка";\n\n    win.add_child(editor);\n    win.show();\n}`, ['Видны две строки; Enter добавляет строки, курсор и прокрутка остаются корректными.'], { actions: ['Добавить несколько строк, выделить и удалить часть текста.'] });

addStandalone('06_gui', 6, 'checkbox', 'CheckBox и on_change', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 430;\n    win.height = 190;\n    win.title = "CheckBox";\n\n    gui.CheckBox box;\n    box.x = 28;\n    box.y = 35;\n    box.text = "Показывать подсказки";\n\n    gui.Label result;\n    result.x = 28;\n    result.y = 95;\n    result.text = "Подсказки выключены";\n\n    box.on_change = void function() {\n        if (box.is_checked) {\n            result.text = "Подсказки включены";\n        } else {\n            result.text = "Подсказки выключены";\n        }\n    };\n\n    win.add_child(box);\n    win.add_child(result);\n    win.show();\n}`, ['Флажок переключается каждым кликом, подпись соответствует его состоянию.'], { actions: ['Несколько раз переключить флажок.'] });

addStandalone('06_gui', 7, 'radiobutton', 'Группа RadioButton', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 430;\n    win.height = 250;\n    win.title = "RadioButton";\n\n    gui.RadioButton easy;\n    easy.x = 30;\n    easy.y = 30;\n    easy.text = "Легко";\n    easy.group = "difficulty";\n    easy.is_selected = true;\n\n    gui.RadioButton normal;\n    normal.x = 30;\n    normal.y = 75;\n    normal.text = "Нормально";\n    normal.group = "difficulty";\n\n    gui.RadioButton hard;\n    hard.x = 30;\n    hard.y = 120;\n    hard.text = "Сложно";\n    hard.group = "difficulty";\n\n    gui.Label result;\n    result.x = 210;\n    result.y = 75;\n    result.text = "Выбрано: легко";\n\n    easy.on_change = void function() { if (easy.is_selected) { result.text = "Выбрано: легко"; } };\n    normal.on_change = void function() { if (normal.is_selected) { result.text = "Выбрано: нормально"; } };\n    hard.on_change = void function() { if (hard.is_selected) { result.text = "Выбрано: сложно"; } };\n\n    win.add_child(easy);\n    win.add_child(normal);\n    win.add_child(hard);\n    win.add_child(result);\n    win.show();\n}`, ['В группе одновременно выбран ровно один пункт; подпись обновляется.'], { actions: ['По очереди выбрать все три варианта.'] });

addStandalone('06_gui', 8, 'combobox', 'ComboBox: список и выбор', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 430;\n    win.height = 200;\n    win.title = "ComboBox";\n\n    gui.ComboBox combo;\n    combo.x = 30;\n    combo.y = 40;\n    combo.width = 180;\n    combo.add_item("Красный");\n    combo.add_item("Зелёный");\n    combo.add_item("Синий");\n\n    gui.Label result;\n    result.x = 240;\n    result.y = 45;\n    result.text = "Выберите цвет";\n\n    combo.on_change = void function() {\n        result.text = to_string(combo.selected_index) + ": " + combo.selected_text;\n    };\n\n    win.add_child(combo);\n    win.add_child(result);\n    win.show();\n}`, ['Dropdown раскрывается; выбор меняет selected_index и selected_text в подписи.'], { actions: ['Выбрать каждый пункт списка.'] });

addStandalone('06_gui', 9, 'slider_drag', 'Slider: клик и непрерывный drag', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 520;\n    win.height = 210;\n    win.title = "Slider drag";\n\n    gui.Slider slider;\n    slider.x = 35;\n    slider.y = 60;\n    slider.width = 390;\n    slider.min = 0;\n    slider.max = 300;\n    slider.step = 50;\n    slider.value = 100;\n\n    gui.Label value_label;\n    value_label.x = 440;\n    value_label.y = 60;\n    value_label.text = "100";\n\n    slider.on_change = void function() { value_label.text = to_string(slider.value); };\n\n    win.add_child(slider);\n    win.add_child(value_label);\n    win.show();\n}`, ['Маркер можно тащить от края до края без обрыва; значения идут шагом 50.'], { actions: ['Зажать маркер и несколько раз провести мышь за его пределы, не отпуская кнопку.'] });

addStandalone('06_gui', 10, 'spinbox_wheel', 'SpinBox и колесо мыши', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 380;\n    win.height = 190;\n    win.title = "SpinBox wheel";\n\n    gui.SpinBox box;\n    box.x = 35;\n    box.y = 50;\n    box.width = 130;\n    box.min = -20;\n    box.max = 20;\n    box.step = 2;\n    box.value = 0;\n\n    gui.Label result;\n    result.x = 210;\n    result.y = 55;\n    result.text = "0";\n    box.on_change = void function() { result.text = to_string(box.value); };\n\n    win.add_child(box);\n    win.add_child(result);\n    win.show();\n}`, ['Стрелки и колесо меняют значение шагом 2; виджет не дребезжит и не теряет focus.'], { actions: ['Навести мышь на поле, крутить колесо в обе стороны, затем нажать стрелки.'] });

addStandalone('06_gui', 11, 'floatspinbox', 'FloatSpinBox', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 390;\n    win.height = 190;\n    win.title = "FloatSpinBox";\n\n    gui.FloatSpinBox box;\n    box.x = 35;\n    box.y = 50;\n    box.width = 150;\n    box.min = 0.0;\n    box.max = 2.0;\n    box.step = 0.25;\n    box.value = 1.0;\n\n    gui.Label result;\n    result.x = 220;\n    result.y = 55;\n    result.text = "1";\n    box.on_change = void function() { result.text = to_string(box.value); };\n\n    win.add_child(box);\n    win.add_child(result);\n    win.show();\n}`, ['Стрелки и колесо дают 0.25, 0.5, 0.75... и не выходят за 0..2.'], { actions: ['Изменить значение стрелками и колесом до обеих границ.'] });

addStandalone('06_gui', 12, 'progressbar', 'ProgressBar: проценты и три цвета', 'gui', `use colors;\nuse gui;\n\nmain() {\n    gui.Window win;\n    win.width = 500;\n    win.height = 210;\n    win.title = "ProgressBar";\n\n    gui.ProgressBar zero;\n    zero.x = 40;\n    zero.y = 35;\n    zero.width = 400;\n    zero.value = 0;\n    zero.background_color = colors.RGB(255, 230, 235);\n    zero.foreground_color = colors.RGB(230, 110, 130);\n    zero.text_color = colors.RGB(110, 15, 30);\n\n    gui.ProgressBar quarter;\n    quarter.x = 40;\n    quarter.y = 105;\n    quarter.width = 400;\n    quarter.min = 0;\n    quarter.max = 400;\n    quarter.value = 100;\n    quarter.background_color = colors.RGB(255, 230, 235);\n    quarter.foreground_color = colors.RGB(230, 110, 130);\n    quarter.text_color = colors.RGB(110, 15, 30);\n\n    win.add_child(zero);\n    win.add_child(quarter);\n    win.show();\n}`, ['Нулевая полоса видна; вторая заполнена на четверть и по центру показывает 25%.']);

addStandalone('06_gui', 13, 'frame_nested', 'Frame как контейнер', 'gui', `use colors;\nuse gui;\n\nmain() {\n    gui.Window win;\n    win.width = 520;\n    win.height = 300;\n    win.title = "Frame";\n\n    gui.Frame frame;\n    frame.x = 35;\n    frame.y = 30;\n    frame.width = 430;\n    frame.height = 190;\n    frame.title = "Профиль";\n    frame.background_color = colors.RGB(235, 244, 255);\n    frame.border_color = colors.RGB(80, 120, 170);\n    frame.border_width = 2;\n\n    gui.Label label;\n    label.x = 25;\n    label.y = 45;\n    label.text = "Имя:";\n\n    gui.LineEdit input;\n    input.x = 100;\n    input.y = 38;\n    input.width = 260;\n\n    gui.Button save;\n    save.x = 100;\n    save.y = 105;\n    save.text = "Сохранить";\n\n    frame.add_child(label);\n    frame.add_child(input);\n    frame.add_child(save);\n    win.add_child(frame);\n    win.show();\n}`, ['Рамка, заголовок и фон видны; дети расположены внутри Frame и реагируют на ввод/клик.'], { actions: ['Ввести текст и нажать кнопку.'] });

addStandalone('06_gui', 14, 'color_inheritance', 'Наследование цветов', 'gui', `use colors;\nuse gui;\n\nmain() {\n    gui.Window win;\n    win.width = 520;\n    win.height = 290;\n    win.title = "Color inheritance";\n    win.text_color = colors.RED;\n    win.background_color = colors.RGB(245, 245, 250);\n\n    gui.Label inherited;\n    inherited.x = 25;\n    inherited.y = 30;\n    inherited.text = "Красный от окна";\n\n    gui.Frame frame;\n    frame.x = 25;\n    frame.y = 80;\n    frame.width = 440;\n    frame.height = 120;\n    frame.title = "Зелёная ветка";\n    frame.text_color = colors.GREEN;\n\n    gui.Label green;\n    green.x = 20;\n    green.y = 35;\n    green.text = "Зелёный от Frame";\n\n    gui.Label blue;\n    blue.x = 220;\n    blue.y = 35;\n    blue.text = "Синий явно";\n    blue.text_color = colors.BLUE;\n\n    frame.add_child(green);\n    frame.add_child(blue);\n    win.add_child(inherited);\n    win.add_child(frame);\n    win.show();\n}`, ['Первая надпись красная, первая внутри Frame зелёная, последняя синяя.']);

addStandalone('06_gui', 15, 'visibility', 'Видимость виджета', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 420;\n    win.height = 220;\n    win.title = "Visibility";\n\n    gui.Label secret;\n    secret.x = 35;\n    secret.y = 45;\n    secret.text = "Секрет найден";\n    secret.visible = false;\n\n    gui.Button toggle;\n    toggle.x = 35;\n    toggle.y = 110;\n    toggle.width = 190;\n    toggle.text = "Показать / скрыть";\n    toggle.on_click = void function() { secret.visible = not(secret.visible); };\n\n    win.add_child(secret);\n    win.add_child(toggle);\n    win.show();\n}`, ['Каждый клик показывает или полностью скрывает Label без смещения соседей.'], { actions: ['Нажать кнопку четыре раза.'] });

addStandalone('06_gui', 16, 'timer', 'Timer: start и stop', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 390;\n    win.height = 230;\n    win.title = "Timer";\n\n    gui.Label counter;\n    counter.x = 165;\n    counter.y = 30;\n    counter.font_size = 36;\n    counter.text = "0";\n\n    gui.Button start;\n    start.x = 35;\n    start.y = 115;\n    start.text = "Старт";\n\n    gui.Button stop;\n    stop.x = 210;\n    stop.y = 115;\n    stop.text = "Стоп";\n\n    int value = 0;\n    gui.Timer timer;\n    timer.interval = 250;\n    timer.on_tick = void function() {\n        value += 1;\n        counter.text = to_string(value);\n    };\n    start.on_click = void function() { timer.start(); };\n    stop.on_click = void function() { timer.stop(); };\n\n    win.add_child(counter);\n    win.add_child(start);\n    win.add_child(stop);\n    win.show();\n}`, ['После старта счётчик меняется примерно 4 раза в секунду; после стопа полностью замирает.'], { actions: ['Запустить, подождать две секунды, остановить, снова запустить.'] });

addStandalone('06_gui', 17, 'modal_alert', 'Modal alert', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 340;\n    win.height = 180;\n    win.title = "Alert";\n\n    gui.Button button;\n    button.x = 65;\n    button.y = 55;\n    button.width = 200;\n    button.text = "Показать сообщение";\n    button.on_click = void function() {\n        gui.Modal modal;\n        modal.title = "Уведомление";\n        modal.message = "Это модальное окно Idyllium.";\n        modal.confirm_text = "Понятно";\n        modal.show_alert();\n    };\n\n    win.add_child(button);\n    win.show();\n}`, ['Открывается кастомная модалка в стиле GUI Preview, а не browser alert; кнопка закрывает её.'], { actions: ['Открыть и закрыть модалку дважды.'] });

addStandalone('06_gui', 18, 'modal_confirm', 'Modal confirm: Да и Нет', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 400;\n    win.height = 220;\n    win.title = "Confirm";\n\n    gui.Label result;\n    result.x = 45;\n    result.y = 40;\n    result.text = "Ответа пока нет";\n\n    gui.Button button;\n    button.x = 45;\n    button.y = 105;\n    button.width = 220;\n    button.text = "Задать вопрос";\n    button.on_click = void function() {\n        gui.Modal modal;\n        modal.title = "Подтверждение";\n        modal.message = "Сохранить изменения?";\n        modal.confirm_text = "Да";\n        modal.cancel_text = "Нет";\n        modal.on_confirm = void function(gui.Modal sender) { result.text = "Нажато: Да"; };\n        modal.on_cancel = void function(gui.Modal sender) { result.text = "Нажато: Нет"; };\n        modal.show_confirm();\n    };\n\n    win.add_child(result);\n    win.add_child(button);\n    win.show();\n}`, ['Да даёт Нажато: Да; Нет даёт Нажато: Нет.'], { actions: ['Открыть и проверить обе ветки по очереди.'] });

addStandalone('06_gui', 19, 'modal_input', 'Modal input', 'gui', `use gui;\n\nmain() {\n    gui.Window win;\n    win.width = 410;\n    win.height = 220;\n    win.title = "Input modal";\n\n    gui.Label result;\n    result.x = 35;\n    result.y = 40;\n    result.text = "Имя: ?";\n\n    gui.Button button;\n    button.x = 35;\n    button.y = 105;\n    button.width = 190;\n    button.text = "Ввести имя";\n    button.on_click = void function() {\n        gui.Modal modal;\n        modal.title = "Знакомство";\n        modal.message = "Как вас зовут?";\n        modal.confirm_text = "Готово";\n        modal.cancel_text = "Отмена";\n        modal.on_confirm = void function(gui.Modal sender) {\n            result.text = "Имя: " + sender.get_input_value();\n        };\n        modal.show_input();\n    };\n\n    win.add_child(result);\n    win.add_child(button);\n    win.show();\n}`, ['Кириллический ввод сохраняется целиком и появляется в Label после подтверждения.'], { actions: ['Ввести имя с кириллицей, исправить его в середине, подтвердить.'] });

addStandalone('06_gui', 20, 'widget_array', 'Массив виджетов', 'gui', `use colors;\nuse gui;\n\nmain() {\n    gui.Window win;\n    win.width = 470;\n    win.height = 330;\n    win.title = "Widget array";\n\n    dyn_array<gui.Button> buttons;\n    for (int i = 0; i < 5; i += 1) {\n        gui.Button item;\n        item.x = 45;\n        item.y = 30 + i * 48;\n        item.width = 330;\n        item.height = 36;\n        item.text = "Кнопка " + to_string(i + 1);\n        item.on_click = void function(gui.Button sender) {\n            sender.text = "Нажата";\n            sender.background_color = colors.RGB(120, 210, 150);\n        };\n        buttons.add(item);\n        win.add_child(item);\n    }\n    win.show();\n}`, ['Пять независимых кнопок расположены столбцом; нажатие меняет только выбранную.'], { actions: ['Нажать первую, третью и пятую кнопки.'] });

addStandalone('06_gui', 21, 'multiple_windows', 'Несколько окон', 'gui', `use gui;\n\nmain() {\n    gui.Window first;\n    first.x = 40;\n    first.y = 40;\n    first.width = 280;\n    first.height = 160;\n    first.title = "Первое окно";\n    gui.Label first_label;\n    first_label.x = 25;\n    first_label.y = 35;\n    first_label.text = "Окно номер один";\n    first.add_child(first_label);\n\n    gui.Window second;\n    second.x = 350;\n    second.y = 80;\n    second.width = 280;\n    second.height = 160;\n    second.title = "Второе окно";\n    gui.Label second_label;\n    second_label.x = 25;\n    second_label.y = 35;\n    second_label.text = "Окно номер два";\n    second.add_child(second_label);\n\n    first.show();\n    second.show();\n}`, ['Оба окна видны как отдельные окна и содержат собственную подпись.']);

addProject('06_gui', 22, 'font_inheritance', 'Пользовательский шрифт в GUI', 'gui', {
  'main.idyl': `use fonts;\nuse gui;\n\nmain() {\n    fonts.Font lobster;\n    lobster.load_from_file("Lobster-Regular.ttf");\n\n    gui.Window win;\n    win.width = 510;\n    win.height = 240;\n    win.title = "Font inheritance";\n    win.font = lobster;\n\n    gui.Label heading;\n    heading.x = 28;\n    heading.y = 30;\n    heading.width = 440;\n    heading.font_size = 30;\n    heading.text = "Inherited Lobster 123";\n\n    gui.Button button;\n    button.x = 28;\n    button.y = 110;\n    button.width = 260;\n    button.text = "Кнопка тем же шрифтом";\n\n    win.add_child(heading);\n    win.add_child(button);\n    win.show();\n}`,
}, ['И Label, и Button используют заметно немоноширинный Lobster; цифры также отличаются.']);
copyAsset('spec/some_fonts/Lobster-Regular.ttf', '06_gui/022_font_inheritance/Lobster-Regular.ttf');

addProject('06_gui', 23, 'imagebox_modes', 'ImageBox и режимы масштабирования', 'gui', {
  'main.idyl': `use gui;\nuse image;\n\nmain() {\n    image.Static cat;\n    cat.load_from_file("cat.png");\n\n    gui.Window win;\n    win.width = 720;\n    win.height = 440;\n    win.title = "ImageBox modes";\n\n    array<string, 4> modes = ["fit", "fill", "stretch", "original"];\n    for (int i = 0; i < modes.length(); i += 1) {\n        gui.Label caption;\n        caption.x = 30 + mod(i, 2) * 340;\n        caption.y = 18 + to_int(i / 2) * 190;\n        caption.text = modes[i];\n\n        gui.ImageBox view;\n        view.x = 30 + mod(i, 2) * 340;\n        view.y = 48 + to_int(i / 2) * 190;\n        view.width = 280;\n        view.height = 120;\n        view.resize_mode = modes[i];\n        view.set_image(cat);\n\n        win.add_child(caption);\n        win.add_child(view);\n    }\n    win.show();\n}`,
}, ['Четыре режима визуально различаются на широких контейнерах; картинки не получают лишний фон или рамку.']);
copyAsset('spec/some_images/cat.png', '06_gui/023_imagebox_modes/cat.png');

addProject('06_gui', 24, 'application_project', 'GUI Application из двух файлов', 'gui', {
  'main.idyl': `use app;\n\nmain() {\n    app.Application application;\n    application.run();\n}`,
  'app.idyl': `use colors;\nuse console;\nuse gui;\n\nclass Application {\nprivate:\n    gui.Window win;\n    gui.LineEdit input;\n    gui.ProgressBar progress;\n    gui.Button button;\n    gui.Label status;\n    int clicks = 0;\n\npublic:\n    constructor Application() {\n        this.win.width = 500;\n        this.win.height = 300;\n        this.win.title = "Application project";\n\n        this.input.x = 30;\n        this.input.y = 35;\n        this.input.width = 360;\n        this.input.placeholder = "Ваше имя";\n\n        this.progress.x = 30;\n        this.progress.y = 105;\n        this.progress.width = 360;\n        this.progress.max = 5;\n        this.progress.foreground_color = colors.RGB(85, 190, 125);\n\n        this.button.x = 30;\n        this.button.y = 165;\n        this.button.width = 190;\n        this.button.text = "Добавить шаг";\n\n        this.status.x = 245;\n        this.status.y = 173;\n        this.status.text = "Шагов: 0";\n\n        Application self_ref = this;\n        this.button.on_click = void function() { self_ref.advance(); };\n        this.win.add_child(this.input);\n        this.win.add_child(this.progress);\n        this.win.add_child(this.button);\n        this.win.add_child(this.status);\n    }\n\n    void function advance() {\n        this.clicks = mod(this.clicks + 1, 6);\n        this.progress.value = this.clicks;\n        this.status.text = this.input.text + ": " + to_string(this.clicks);\n        console.writeln(this.status.text);\n    }\n\n    void function run() { this.win.show(); }\n}`,
}, ['Проект импортирует Application; поле редактируется; кнопка двигает ProgressBar и пишет в консоль.'], { actions: ['Ввести имя и нажать кнопку не менее семи раз.'] });

// 07. Canvas rendering, input and geometry.
addStandalone('07_canvas', 1, 'basic_circle', 'Canvas и один Circle', 'canvas', canvasProgram({
  title: 'Basic Circle',
  globals: `drawable.Circle circle;`,
  functions: `void function init(gui.Canvas canvas) {\n    circle.radius = 55;\n    circle.set_origin(55, 55);\n    circle.x = 320;\n    circle.y = 205;\n    circle.fill_color = colors.RGB(255, 205, 75);\n    circle.border_width = 5;\n    circle.border_color = colors.RGB(120, 75, 20);\n    canvas.fill(colors.RGB(20, 24, 34));\n    canvas.draw(circle);\n}`,
}), ['В центре тёмного Canvas виден жёлтый круг с ровной коричневой обводкой.']);

addStandalone('07_canvas', 2, 'basic_drawables', 'Rectangle, Circle и Line', 'canvas', canvasProgram({
  title: 'Basic drawables',
  globals: `drawable.Rectangle rectangle;\ndrawable.Circle circle;\ndrawable.Line line;`,
  functions: `void function init(gui.Canvas canvas) {\n    rectangle.x = 70;\n    rectangle.y = 100;\n    rectangle.width = 180;\n    rectangle.height = 110;\n    rectangle.fill_color = colors.RGB(70, 150, 230);\n\n    circle.x = 420;\n    circle.y = 155;\n    circle.radius = 58;\n    circle.set_origin(58, 58);\n    circle.fill_color = colors.RGB(245, 120, 145);\n\n    line.x1 = 50;\n    line.y1 = 320;\n    line.x2 = 580;\n    line.y2 = 280;\n    line.color = colors.RGB(130, 230, 160);\n    line.thickness = 8;\n\n    canvas.fill(colors.RGB(19, 22, 30));\n    canvas.draw(rectangle);\n    canvas.draw(circle);\n    canvas.draw(line);\n}`,
}), ['Видны синий прямоугольник, розовый круг и толстая зелёная наклонная линия.']);

addStandalone('07_canvas', 3, 'draw_order', 'Порядок отрисовки', 'canvas', canvasProgram({
  title: 'Draw order',
  globals: `drawable.Rectangle back;\ndrawable.Circle middle;\ndrawable.Rectangle front;`,
  functions: `void function init(gui.Canvas canvas) {\n    back.x = 120; back.y = 80; back.width = 300; back.height = 220; back.fill_color = colors.BLUE;\n    middle.x = 300; middle.y = 210; middle.radius = 95; middle.set_origin(95, 95); middle.fill_color = colors.RED;\n    front.x = 270; front.y = 190; front.width = 260; front.height = 150; front.fill_color = colors.RGBA(50, 220, 130, 0.75);\n    canvas.fill(colors.RGB(18, 20, 27));\n    canvas.draw(back);\n    canvas.draw(middle);\n    canvas.draw(front);\n}`,
}), ['Синий объект сзади, красный посередине, полупрозрачный зелёный сверху; смешение цветов заметно.']);

addStandalone('07_canvas', 4, 'update_motion', 'on_update и движение по delta_time', 'canvas', canvasProgram({
  title: 'Delta motion',
  globals: `drawable.Rectangle runner;\nfloat direction = 1.0;`,
  functions: `void function init(gui.Canvas canvas) {\n    runner.x = 20; runner.y = 175; runner.width = 70; runner.height = 70;\n    runner.fill_color = colors.RGB(80, 205, 145);\n}\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    runner.move(220.0 * delta_time * direction, 0);\n    if (runner.x > 550) { direction = -1.0; }\n    if (runner.x < 20) { direction = 1.0; }\n    canvas.fill(colors.RGB(16, 20, 28));\n    canvas.draw(runner);\n}`,
  bindings: { on_init: 'init', on_update: 'update' },
}), ['Зелёный квадрат плавно ходит влево-вправо с одинаковой скоростью, без ускорения при наведении мыши.'], { actions: ['Подержать мышь внутри и снаружи Preview, сравнить скорость.'] });

addStandalone('07_canvas', 5, 'framerate_delta', 'framerate_limit и delta_time', 'canvas', canvasProgram({
  title: 'Framerate and delta',
  framerate: 20,
  globals: `drawable.Text info;\nint frames = 0;\nfloat elapsed = 0.0;`,
  functions: `void function init(gui.Canvas canvas) {\n    info.x = 35; info.y = 160; info.font_size = 25; info.text_color = colors.WHITE;\n}\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    frames += 1;\n    elapsed += delta_time;\n    if (elapsed >= 1.0) {\n        info.text = "Кадров за интервал: " + to_string(frames);\n        frames = 0;\n        elapsed = 0.0;\n    }\n    canvas.fill(colors.RGB(28, 32, 44));\n    canvas.draw(info);\n}`,
  bindings: { on_init: 'init', on_update: 'update' },
}), ['После первой секунды надпись показывает число около 20 и обновляется примерно раз в секунду.']);

addStandalone('07_canvas', 6, 'keyboard_events', 'Нажатие и отпускание клавиш', 'canvas', canvasProgram({
  title: 'Keyboard events',
  globals: `drawable.Rectangle player;\ndrawable.Text hint;`,
  functions: `void function redraw(gui.Canvas canvas) {\n    canvas.fill(colors.RGB(20, 24, 32));\n    canvas.draw(player);\n    canvas.draw(hint);\n}\n\nvoid function init(gui.Canvas canvas) {\n    player.x = 260; player.y = 150; player.width = 120; player.height = 90;\n    player.fill_color = colors.RGB(65, 75, 95);\n    player.border_width = 6; player.border_color = colors.TRANSPARENT;\n    hint.x = 150; hint.y = 300; hint.text = "R / G / B"; hint.font_size = 25; hint.text_color = colors.WHITE;\n    redraw(canvas);\n}\n\nvoid function key_down(gui.Canvas canvas, gui.KeyboardEvent e) {\n    if (e.key == "R") { player.border_color = colors.RED; }\n    if (e.key == "G") { player.border_color = colors.GREEN; }\n    if (e.key == "B") { player.border_color = colors.BLUE; }\n    redraw(canvas);\n}\n\nvoid function key_up(gui.Canvas canvas, gui.KeyboardEvent e) {\n    player.border_color = colors.TRANSPARENT;\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_key_pressed: 'key_down', on_key_released: 'key_up' },
}), ['При удержании R/G/B появляется соответствующая рамка; сразу после отпускания она исчезает.'], { actions: ['Кликнуть Canvas, затем по очереди удержать R, G и B.'] });

addStandalone('07_canvas', 7, 'mouse_buttons', 'Кнопки мыши и консоль', 'canvas', canvasProgram({
  title: 'Mouse buttons',
  uses: ['console'],
  globals: `drawable.Circle marker;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(marker); }\n\nvoid function init(gui.Canvas canvas) {\n    marker.radius = 24; marker.set_origin(24, 24); marker.x = 320; marker.y = 210; marker.fill_color = colors.WHITE;\n    redraw(canvas);\n}\n\nvoid function mouse_down(gui.Canvas canvas, gui.MouseEvent e) {\n    marker.x = e.x; marker.y = e.y;\n    if (e.mouse_button == "LEFT") { marker.fill_color = colors.RED; }\n    if (e.mouse_button == "RIGHT") { marker.fill_color = colors.GREEN; }\n    if (e.mouse_button == "MIDDLE") { marker.fill_color = colors.BLUE; }\n    console.writeln(e.mouse_button, " at ", e.x, ", ", e.y);\n    redraw(canvas);\n}\n\nvoid function mouse_up(gui.Canvas canvas, gui.MouseEvent e) {\n    marker.fill_color = colors.WHITE;\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_pressed: 'mouse_down', on_mouse_released: 'mouse_up' },
}), ['ЛКМ/ПКМ/СКМ дают красный/зелёный/синий маркер в точке клика; отпускание возвращает белый; консоль показывает кнопку и координаты.'], { actions: ['Проверить все три кнопки в разных точках Canvas.'] });

addStandalone('07_canvas', 8, 'mouse_move', 'Circle следует за курсором', 'canvas', canvasProgram({
  title: 'Mouse move',
  globals: `drawable.Circle cursor;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(17, 21, 29)); canvas.draw(cursor); }\n\nvoid function init(gui.Canvas canvas) {\n    cursor.radius = 20; cursor.set_origin(20, 20); cursor.x = 320; cursor.y = 210; cursor.fill_color = colors.RGB(255, 205, 85);\n    redraw(canvas);\n}\n\nvoid function mouse_move(gui.Canvas canvas, gui.MouseEvent e) {\n    cursor.x = e.x; cursor.y = e.y;\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'mouse_move' },
}), ['Круг плавно следует за курсором до самых краёв, без заметной задержки и высокой нагрузки CPU.'], { actions: ['Быстро поводить мышью, сделать несколько кругов по краям Canvas.'] });

addStandalone('07_canvas', 9, 'mouse_scroll', 'Колесо меняет размер Rectangle', 'canvas', canvasProgram({
  title: 'Mouse wheel',
  globals: `drawable.Rectangle box;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 23, 32)); canvas.draw(box); }\n\nvoid function init(gui.Canvas canvas) {\n    box.x = 250; box.y = 150; box.width = 140; box.height = 100; box.set_origin(70, 50);\n    box.fill_color = colors.RGB(90, 165, 235);\n    redraw(canvas);\n}\n\nvoid function scroll(gui.Canvas canvas, gui.MouseScrollEvent e) {\n    int next_width = box.width + e.delta * 10;\n    int next_height = box.height + e.delta * 6;\n    if (next_width >= 30 and next_width <= 400) {\n        box.width = next_width; box.height = next_height; box.set_origin(box.width / 2, box.height / 2);\n    }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_scroll: 'scroll' },
}), ['Колесо плавно увеличивает и уменьшает прямоугольник вокруг неподвижного центра; страница не прокручивается вместо Canvas.'], { actions: ['Навести на Canvas и активно прокрутить колесо в обе стороны.'] });

addProject('07_canvas', 10, 'sprite_image', 'Sprite с загруженной картинкой', 'canvas', {
  'main.idyl': canvasProgram({
    title: 'Sprite image',
    uses: ['image'],
    globals: `image.Static picture;\ndrawable.Sprite sprite;`,
    functions: `void function init(gui.Canvas canvas) {\n    picture.load_from_file("player.png");\n    sprite.set_image(picture);\n    sprite.x = 250; sprite.y = 120;\n    canvas.fill(colors.RGB(24, 28, 38));\n    canvas.draw(sprite);\n}`,
  }),
}, ['Картинка игрока появляется с первого кадра, а не заменяется пустым квадратом.']);
copyAsset('spec/some_images/player.png', '07_canvas/010_sprite_image/player.png');

addProject('07_canvas', 11, 'text_font', 'Text с пользовательским шрифтом', 'canvas', {
  'main.idyl': canvasProgram({
    title: 'Canvas font',
    uses: ['fonts'],
    globals: `fonts.Font lobster;\ndrawable.Text first;\ndrawable.Text second;`,
    functions: `void function init(gui.Canvas canvas) {\n    lobster.load_from_file("Lobster-Regular.ttf");\n    first.font = lobster; first.text = "Lobster 123"; first.x = 55; first.y = 80; first.font_size = 54; first.text_color = colors.RGB(255, 205, 110);\n    second.text = "Default 123"; second.x = 55; second.y = 210; second.font_size = 54; second.text_color = colors.RGB(120, 205, 255);\n    canvas.fill(colors.RGB(22, 25, 34));\n    canvas.draw(first); canvas.draw(second);\n}`,
  }),
}, ['Верхняя и нижняя надписи заметно различаются шрифтом, включая цифры; текст не исчезает при загрузке.']);
copyAsset('spec/some_fonts/Lobster-Regular.ttf', '07_canvas/011_text_font/Lobster-Regular.ttf');

addStandalone('07_canvas', 12, 'origin_rotation', 'Origin и вращение вокруг центра', 'canvas', canvasProgram({
  title: 'Origin rotation',
  globals: `drawable.Rectangle rectangle;\ndrawable.Circle origin_marker;`,
  functions: `void function init(gui.Canvas canvas) {\n    rectangle.width = 240; rectangle.height = 90; rectangle.set_origin(120, 45);\n    rectangle.x = 320; rectangle.y = 205; rectangle.fill_color = colors.RGB(85, 160, 235);\n    rectangle.border_width = 3; rectangle.border_color = colors.WHITE;\n    origin_marker.radius = 6; origin_marker.set_origin(6, 6); origin_marker.x = 320; origin_marker.y = 205; origin_marker.fill_color = colors.RED;\n}\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    rectangle.rotate(45.0 * delta_time);\n    canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(rectangle); canvas.draw(origin_marker);\n}`,
  bindings: { on_init: 'init', on_update: 'update' },
}), ['Прямоугольник вращается по часовой стрелке вокруг неподвижной красной точки в собственном центре.']);

addStandalone('07_canvas', 13, 'rectangle_contains', 'contains() у повёрнутого Rectangle', 'canvas', canvasProgram({
  title: 'Rectangle contains',
  globals: `drawable.Rectangle rectangle;\ndrawable.Circle pointer;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 31)); canvas.draw(rectangle); canvas.draw(pointer); }\n\nvoid function init(gui.Canvas canvas) {\n    rectangle.width = 260; rectangle.height = 110; rectangle.set_origin(130, 55); rectangle.x = 320; rectangle.y = 205; rectangle.rotation = 28;\n    rectangle.fill_color = colors.RGB(70, 95, 135); rectangle.border_width = 4; rectangle.border_color = colors.WHITE;\n    pointer.radius = 6; pointer.set_origin(6, 6); pointer.fill_color = colors.RGB(255, 220, 75);\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    pointer.x = e.x; pointer.y = e.y;\n    if (rectangle.contains(e.x, e.y)) { rectangle.fill_color = colors.GREEN; } else { rectangle.fill_color = colors.RGB(70, 95, 135); }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Rectangle зеленеет только внутри фактических косых рёбер; точки возле углов bounding box считаются внешними.'], { actions: ['Медленно провести курсором вдоль каждого косого ребра и возле всех углов.'] });

addStandalone('07_canvas', 14, 'circle_contains', 'contains() у Circle', 'canvas', canvasProgram({
  title: 'Circle contains',
  globals: `drawable.Circle target;\ndrawable.Circle pointer;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(target); canvas.draw(pointer); }\n\nvoid function init(gui.Canvas canvas) {\n    target.radius = 115; target.set_origin(115, 115); target.x = 320; target.y = 205;\n    target.fill_color = colors.RGB(65, 90, 130); target.border_width = 4; target.border_color = colors.WHITE;\n    pointer.radius = 6; pointer.set_origin(6, 6); pointer.fill_color = colors.RGB(255, 220, 75);\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    pointer.x = e.x; pointer.y = e.y;\n    if (target.contains(e.x, e.y)) { target.fill_color = colors.GREEN; } else { target.fill_color = colors.RGB(65, 90, 130); }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Круг зеленеет строго внутри окружности, а не внутри окружающего её квадрата.'], { actions: ['Провести курсором через центр, затем проверить четыре угла ограничивающего квадрата.'] });

addStandalone('07_canvas', 15, 'circle_intersection', 'intersects(): Circle и Circle', 'canvas', canvasProgram({
  title: 'Circle intersection',
  globals: `drawable.Circle fixed_circle;\ndrawable.Circle cursor_circle;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(17, 21, 29)); canvas.draw(fixed_circle); canvas.draw(cursor_circle); }\n\nvoid function init(gui.Canvas canvas) {\n    fixed_circle.radius = 90; fixed_circle.set_origin(90, 90); fixed_circle.x = 320; fixed_circle.y = 205; fixed_circle.fill_color = colors.RGB(65, 110, 170);\n    cursor_circle.radius = 45; cursor_circle.set_origin(45, 45); cursor_circle.fill_color = colors.GREEN;\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    cursor_circle.x = e.x; cursor_circle.y = e.y;\n    if (fixed_circle.intersects(cursor_circle)) { cursor_circle.fill_color = colors.RED; } else { cursor_circle.fill_color = colors.GREEN; }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Подвижный круг красный при касании/пересечении и зелёный вне большого круга; граница включена.'], { actions: ['Медленно подвести маленький круг к большому с разных сторон.'] });

addStandalone('07_canvas', 16, 'rotated_rect_intersection', 'intersects(): два повёрнутых Rectangle', 'canvas', canvasProgram({
  title: 'Rotated rectangles',
  globals: `drawable.Rectangle fixed_box;\ndrawable.Rectangle cursor_box;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(fixed_box); canvas.draw(cursor_box); }\n\nvoid function init(gui.Canvas canvas) {\n    fixed_box.width = 230; fixed_box.height = 80; fixed_box.set_origin(115, 40); fixed_box.x = 330; fixed_box.y = 205; fixed_box.rotation = 32; fixed_box.fill_color = colors.RGB(75, 105, 155);\n    cursor_box.width = 120; cursor_box.height = 55; cursor_box.set_origin(60, 27.5); cursor_box.rotation = -18; cursor_box.fill_color = colors.GREEN;\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    cursor_box.x = e.x; cursor_box.y = e.y;\n    if (fixed_box.intersects(cursor_box)) { cursor_box.fill_color = colors.RED; } else { cursor_box.fill_color = colors.GREEN; }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Столкновение считается по косым рёбрам, а не по axis-aligned bounding box; касание тоже красное.'], { actions: ['Провести маленький Rectangle возле углов и вдоль длинных косых рёбер.'] });

addStandalone('07_canvas', 17, 'rect_circle_intersection', 'intersects(): Rectangle и Circle', 'canvas', canvasProgram({
  title: 'Rectangle and circle',
  globals: `drawable.Rectangle rectangle;\ndrawable.Circle cursor_circle;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(rectangle); canvas.draw(cursor_circle); }\n\nvoid function init(gui.Canvas canvas) {\n    rectangle.width = 260; rectangle.height = 90; rectangle.set_origin(130, 45); rectangle.x = 320; rectangle.y = 205; rectangle.rotation = 38; rectangle.fill_color = colors.RGB(75, 105, 155);\n    cursor_circle.radius = 38; cursor_circle.set_origin(38, 38); cursor_circle.fill_color = colors.GREEN;\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    cursor_circle.x = e.x; cursor_circle.y = e.y;\n    if (rectangle.intersects(cursor_circle)) { cursor_circle.fill_color = colors.RED; } else { cursor_circle.fill_color = colors.GREEN; }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Круг меняет цвет при касании реального повёрнутого прямоугольника, включая углы.'], { actions: ['Проверить длинные стороны и оба типа углов Rectangle.'] });

addStandalone('07_canvas', 18, 'line_rect_intersection', 'intersects(): Line и Rectangle', 'canvas', canvasProgram({
  title: 'Line and rectangle',
  globals: `drawable.Rectangle rectangle;\ndrawable.Line cursor_line;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(rectangle); canvas.draw(cursor_line); }\n\nvoid function init(gui.Canvas canvas) {\n    rectangle.width = 230; rectangle.height = 100; rectangle.set_origin(115, 50); rectangle.x = 320; rectangle.y = 205; rectangle.rotation = 25; rectangle.fill_color = colors.RGB(70, 100, 145);\n    cursor_line.thickness = 7; cursor_line.color = colors.GREEN;\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    cursor_line.x1 = e.x - 90; cursor_line.y1 = e.y - 45; cursor_line.x2 = e.x + 90; cursor_line.y2 = e.y + 45;\n    if (cursor_line.intersects(rectangle)) { cursor_line.color = colors.RED; } else { cursor_line.color = colors.GREEN; }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Линия краснеет при пересечении любого ребра Rectangle и при нахождении внутри него.'], { actions: ['Пересечь линией каждую сторону и полностью поместить её внутрь Rectangle.'] });

addStandalone('07_canvas', 19, 'text_bounds', 'Text: размеры и contains()', 'canvas', canvasProgram({
  title: 'Text bounds',
  globals: `drawable.Text text_object;\ndrawable.Rectangle padding_box;`,
  functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(padding_box); canvas.draw(text_object); }\n\nvoid function init(gui.Canvas canvas) {\n    text_object.text = "Hello, текст 123"; text_object.font_size = 34; text_object.x = 90; text_object.y = 160; text_object.text_color = colors.WHITE;\n    padding_box.x = text_object.x - 10; padding_box.y = text_object.y - 10; padding_box.width = to_int(text_object.get_width()) + 20; padding_box.height = to_int(text_object.get_height()) + 20;\n    padding_box.fill_color = colors.RGB(50, 60, 80); padding_box.border_width = 3; padding_box.border_color = colors.RGB(100, 120, 155);\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    if (text_object.contains(e.x, e.y)) { padding_box.border_color = colors.GREEN; } else { padding_box.border_color = colors.RGB(100, 120, 155); }\n    redraw(canvas);\n}`,
  bindings: { on_init: 'init', on_mouse_move: 'move' },
}), ['Фон образует примерно 10 px padding; рамка зелёная только над фактической текстовой областью, не над padding.'], { actions: ['Провести курсором по буквам и по десятипиксельной рамке вокруг них.'] });

addProject('07_canvas', 20, 'sprite_bounds', 'Sprite: transformed bounds', 'canvas', {
  'main.idyl': canvasProgram({
    title: 'Sprite bounds',
    uses: ['image'],
    globals: `image.Static picture;\ndrawable.Sprite sprite;\ndrawable.Circle pointer;`,
    functions: `void function redraw(gui.Canvas canvas) { canvas.fill(colors.RGB(20, 24, 32)); canvas.draw(sprite); canvas.draw(pointer); }\n\nvoid function init(gui.Canvas canvas) {\n    picture.load_from_file("cat.png");\n    sprite.set_image(picture); sprite.set_origin(picture.width / 2, picture.height / 2); sprite.x = 320; sprite.y = 205; sprite.rotation = 24; sprite.set_scale(1.4, 0.8);\n    pointer.radius = 7; pointer.set_origin(7, 7); pointer.fill_color = colors.GREEN;\n    redraw(canvas);\n}\n\nvoid function move(gui.Canvas canvas, gui.MouseEvent e) {\n    pointer.x = e.x; pointer.y = e.y;\n    if (sprite.contains(e.x, e.y)) { pointer.fill_color = colors.RED; } else { pointer.fill_color = colors.GREEN; }\n    redraw(canvas);\n}`,
    bindings: { on_init: 'init', on_mouse_move: 'move' },
  }),
}, ['Курсорный маркер красный внутри повёрнутого и неравномерно масштабированного прямоугольника Sprite.'], { actions: ['Проверить все четыре угла картинки и область прозрачных пикселей.'] });
copyAsset('spec/some_images/cat.png', '07_canvas/020_sprite_bounds/cat.png');

addStandalone('07_canvas', 21, 'object_array', 'Массив drawable-объектов', 'canvas', canvasProgram({
  title: 'Drawable array',
  globals: `dyn_array<drawable.Rectangle> bars;`,
  functions: `void function init(gui.Canvas canvas) {\n    for (int i = 0; i < 7; i += 1) {\n        drawable.Rectangle bar;\n        bar.x = 170 + i * 45; bar.y = 80 + i * 35; bar.width = 190; bar.height = 22; bar.set_origin(95, 11);\n        bar.fill_color = colors.RGB(70 + i * 20, 180, 220 - i * 15);\n        bars.add(bar);\n    }\n}\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    canvas.fill(colors.RGB(17, 21, 29));\n    for (int i = 0; i < bars.length(); i += 1) {\n        bars[i].rotate((10 + i * 5) * delta_time);\n        canvas.draw(bars[i]);\n    }\n}`,
  bindings: { on_init: 'init', on_update: 'update' },
}), ['Семь отдельных полос вращаются с разной скоростью, массив не превращает их в один общий объект.']);

addStandalone('07_canvas', 22, 'temporary_circles', 'Временные объекты и динамический массив', 'canvas', canvasProgram({
  title: 'Temporary circles',
  globals: `dyn_array<drawable.Circle> circles;`,
  functions: `void function redraw(gui.Canvas canvas) {\n    canvas.fill(colors.RGB(17, 21, 29));\n    for (int i = 0; i < circles.length(); i += 1) { canvas.draw(circles[i]); }\n}\n\nvoid function init(gui.Canvas canvas) { redraw(canvas); }\n\nvoid function click(gui.Canvas canvas, gui.MouseEvent e) {\n    if (e.mouse_button == "LEFT") {\n        drawable.Circle temporary;\n        temporary.radius = 18; temporary.set_origin(18, 18); temporary.x = e.x; temporary.y = e.y;\n        temporary.fill_color = colors.RGB(80 + mod(circles.length() * 17, 160), 170, 235);\n        circles.add(temporary);\n        redraw(canvas);\n    }\n}`,
  bindings: { on_init: 'init', on_mouse_pressed: 'click' },
}), ['Каждый ЛКМ навсегда добавляет новый круг; старые круги не двигаются и не исчезают.'], { actions: ['Создать 20-30 кругов, в том числе быстро кликая.'] });

addStandalone('07_canvas', 23, 'smooth_wasd', 'Плавное движение и массив зажатых клавиш', 'canvas', canvasProgram({
  title: 'Smooth WASD',
  globals: `drawable.Rectangle player;\ndyn_array<string> pressed_keys;`,
  functions: `void function init(gui.Canvas canvas) {\n    player.x = 290; player.y = 180; player.width = 60; player.height = 60; player.fill_color = colors.RGB(85, 205, 135);\n}\n\nvoid function key_down(gui.Canvas canvas, gui.KeyboardEvent e) {\n    if (not(pressed_keys.contains(e.key))) { pressed_keys.add(e.key); }\n}\n\nvoid function key_up(gui.Canvas canvas, gui.KeyboardEvent e) {\n    if (pressed_keys.contains(e.key)) { pressed_keys.remove_at(pressed_keys.find(e.key)); }\n}\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    float speed = 180.0 * delta_time;\n    if (pressed_keys.contains("W")) { player.move(0, -speed); }\n    if (pressed_keys.contains("S")) { player.move(0, speed); }\n    if (pressed_keys.contains("A")) { player.move(-speed, 0); }\n    if (pressed_keys.contains("D")) { player.move(speed, 0); }\n    canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(player);\n}`,
  bindings: { on_init: 'init', on_key_pressed: 'key_down', on_key_released: 'key_up', on_update: 'update' },
}), ['Движение начинается без системной паузы, остаётся плавным, диагонали W+D/A+S работают одновременно, отпускание каждой клавиши учитывается отдельно.'], { actions: ['Кликнуть Canvas; подержать W, затем W+D, затем быстро менять противоположные направления.'] });

addStandalone('07_canvas', 24, 'unit_circle', 'Единичная окружность и тригонометрия', 'canvas', canvasProgram({
  title: 'Unit circle',
  uses: ['math'],
  globals: `drawable.Circle orbit;\ndrawable.Circle point;\ndrawable.Line axis_x;\ndrawable.Line axis_y;\ndrawable.Text angle_text;\nfloat angle = 0.0;`,
  functions: `void function init(gui.Canvas canvas) {\n    orbit.radius = 150; orbit.set_origin(150, 150); orbit.x = 320; orbit.y = 205; orbit.fill_color = colors.TRANSPARENT; orbit.border_width = 3; orbit.border_color = colors.WHITE;\n    axis_x.x1 = 120; axis_x.y1 = 205; axis_x.x2 = 520; axis_x.y2 = 205; axis_x.color = colors.RGB(90, 105, 130); axis_x.thickness = 2;\n    axis_y.x1 = 320; axis_y.y1 = 25; axis_y.x2 = 320; axis_y.y2 = 385; axis_y.color = colors.RGB(90, 105, 130); axis_y.thickness = 2;\n    point.radius = 11; point.set_origin(11, 11); point.fill_color = colors.RED;\n    angle_text.x = 20; angle_text.y = 15; angle_text.font_size = 18; angle_text.text_color = colors.WHITE;\n}\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    angle += 40.0 * delta_time;\n    if (angle >= 360.0) { angle -= 360.0; }\n    float radians = math.to_radians(angle);\n    point.x = 320.0 + 150.0 * math.cos(radians);\n    point.y = 205.0 + 150.0 * math.sin(radians);\n    angle_text.text = "angle=" + to_string(math.round(angle, 1));\n    canvas.fill(colors.RGB(17, 21, 29)); canvas.draw(axis_x); canvas.draw(axis_y); canvas.draw(orbit); canvas.draw(point); canvas.draw(angle_text);\n}`,
  bindings: { on_init: 'init', on_update: 'update' },
}), ['Красная точка идёт по часовой стрелке: 0 справа, 90 снизу, 180 слева, 270 сверху; движение согласуется с cos/sin без инверсии.']);

addProject('07_canvas', 25, 'negative_sprite_scale', 'Отрицательный scale у Sprite', 'canvas', {
  'main.idyl': canvasProgram({
    title: 'Negative sprite scale',
    uses: ['image'],
    globals: `image.Static cat;\ndrawable.Sprite normal;\ndrawable.Sprite upside_down;\ndrawable.Text left_label;\ndrawable.Text right_label;`,
    functions: `void function init(gui.Canvas canvas) {\n    cat.load_from_file("cat.png");\n    normal.set_image(cat); normal.x = 80; normal.y = 90;\n    upside_down.set_image(cat); upside_down.x = 390; upside_down.y = 90 + cat.height; upside_down.set_scale(1, -1);\n    left_label.text = "scale(1, 1)"; left_label.x = 80; left_label.y = 45; left_label.font_size = 20; left_label.text_color = colors.WHITE;\n    right_label.text = "scale(1, -1)"; right_label.x = 390; right_label.y = 45; right_label.font_size = 20; right_label.text_color = colors.WHITE;\n    canvas.fill(colors.RGB(20, 24, 32)); canvas.draw(normal); canvas.draw(upside_down); canvas.draw(left_label); canvas.draw(right_label);\n}`,
  }),
}, ['Слева обычный кот, справа тот же кот вверх ногами; картинка не исчезает и размеры сохраняются.']);
copyAsset('spec/some_images/cat.png', '07_canvas/025_negative_sprite_scale/cat.png');

addProject('07_canvas', 26, 'three_file_scene', 'Canvas-проект из трёх файлов', 'canvas', {
  'main.idyl': `use gui;\nuse scene;\nuse settings;\n\nmain() {\n    gui.Window win;\n    win.width = settings.WINDOW_WIDTH;\n    win.height = settings.WINDOW_HEIGHT;\n    win.title = settings.TITLE;\n\n    gui.Canvas canvas;\n    canvas.x = 20; canvas.y = 20; canvas.width = 640; canvas.height = 420; canvas.framerate_limit = 60;\n    canvas.on_init = scene.init;\n    canvas.on_update = scene.update;\n    canvas.on_mouse_move = scene.mouse_move;\n    win.add_child(canvas);\n    win.show();\n}`,
  'settings.idyl': `const int WINDOW_WIDTH = 700;\nconst int WINDOW_HEIGHT = 520;\nconst string TITLE = "Three-file Canvas";`,
  'scene.idyl': `use colors;\nuse drawable;\nuse gui;\n\ndrawable.Circle ball;\ndrawable.Rectangle target;\n\nvoid function init(gui.Canvas canvas) {\n    ball.radius = 24; ball.set_origin(24, 24); ball.x = 70; ball.y = 210; ball.fill_color = colors.RGB(255, 205, 75);\n    target.width = 100; target.height = 100; target.set_origin(50, 50); target.x = 500; target.y = 210; target.fill_color = colors.RGB(80, 130, 200);\n}\n\nvoid function mouse_move(gui.Canvas canvas, gui.MouseEvent e) { target.x = e.x; target.y = e.y; }\n\nvoid function update(gui.Canvas canvas, float delta_time) {\n    ball.move(150.0 * delta_time, 0);\n    if (ball.x > 650) { ball.x = -20; }\n    if (ball.intersects(target)) { ball.fill_color = colors.RED; } else { ball.fill_color = colors.RGB(255, 205, 75); }\n    canvas.fill(colors.RGB(18, 22, 30)); canvas.draw(target); canvas.draw(ball);\n}`,
}, ['main импортирует настройки и сцену; синий квадрат следует за мышью; движущийся круг краснеет при столкновении и зацикливается.'], { actions: ['Несколько раз перехватить круг подвижным квадратом.'] });

// 08. Images, animation, audio and fonts.
addProject('08_assets', 1, 'image_metadata', 'Метаданные image.Static и GUI Preview', 'asset', {
  'main.idyl': `use console;\nuse gui;\nuse image;\n\nmain() {\n    image.Static picture;\n    picture.load_from_file("cat.png");\n    console.writeln("src=", picture.src);\n    console.writeln("size=", picture.width, "x", picture.height);\n    console.writeln("format=", picture.format);\n    console.writeln("alpha=", picture.has_alpha);\n    console.writeln("loaded=", picture.is_loaded);\n\n    gui.Window win;\n    win.width = 470; win.height = 330; win.title = "Image metadata";\n    gui.ImageBox view;\n    view.x = 30; view.y = 30; view.width = 380; view.height = 230; view.resize_mode = "fit"; view.set_image(picture);\n    win.add_child(view);\n    win.show();\n}`,
}, ['Картинка отображается; консоль сообщает реальный формат, размеры, alpha и loaded=true.']);
copyAsset('spec/some_images/cat.png', '08_assets/001_image_metadata/cat.png');

addProject('08_assets', 2, 'image_transformations', 'Преобразования image.Static', 'asset', {
  'main.idyl': `use colors;\nuse gui;\nuse image;\n\nmain() {\n    image.Static source;\n    source.load_from_file("cat.png");\n    image.Static vertical = source.scale(1, -1);\n    image.Static rotated = source.rotate(90);\n    image.Static tinted = source.tint(colors.RED);\n    image.Static faded = source.with_opacity(0.3);\n    image.Static gray = source.desaturate();\n\n    array<string, 6> names = ["source", "scale(1,-1)", "rotate(90)", "tint(red)", "opacity 0.3", "gray"];\n    dyn_array<image.Static> pictures = [source, vertical, rotated, tinted, faded, gray];\n\n    gui.Window win;\n    win.width = 760; win.height = 590; win.title = "Static transformations";\n    for (int i = 0; i < pictures.length(); i += 1) {\n        int column = mod(i, 3);\n        int row = to_int(i / 3);\n        gui.Label label;\n        label.x = 25 + column * 245; label.y = 18 + row * 265; label.text = names[i];\n        gui.ImageBox view;\n        view.x = 25 + column * 245; view.y = 50 + row * 265; view.width = 210; view.height = 190; view.resize_mode = "fit"; view.set_image(pictures[i]);\n        win.add_child(label); win.add_child(view);\n    }\n    win.show();\n}`,
}, ['Шесть изображений различаются ожидаемо; исходник не изменился; прозрачность видна на фоне GUI.']);
copyAsset('spec/some_images/cat.png', '08_assets/002_image_transformations/cat.png');

addProject('08_assets', 3, 'animation', 'GIF-анимация в ImageBox', 'asset', {
  'main.idyl': `use console;\nuse gui;\nuse image;\n\nmain() {\n    image.Animation animation;\n    animation.load_from_file("walk.gif");\n    console.writeln("frames=", animation.frame_count);\n    console.writeln("uniform=", animation.has_uniform_frame_duration);\n    console.writeln("first delay=", animation.get_frame_duration(0));\n\n    gui.Window win;\n    win.width = 500; win.height = 390; win.title = "Animation";\n    gui.ImageBox view;\n    view.x = 40; view.y = 35; view.width = 400; view.height = 280; view.resize_mode = "fit"; view.set_image(animation);\n    win.add_child(view);\n    win.show();\n}`,
}, ['GIF движется плавно и циклически; консоль показывает больше одного кадра и разумную длительность.']);
copyAsset('spec/some_images/walk.gif', '08_assets/003_animation/walk.gif');

addProject('08_assets', 4, 'image_export', 'Экспорт преобразованной картинки', 'asset', {
  'main.idyl': `use console;\nuse gui;\nuse image;\n\nmain() {\n    image.Static source;\n    source.load_from_file("cat.png");\n    image.Static result = source.rotate(90).scale(0.6, 0.6);\n    result.export_to_file("manual_export.png");\n    console.writeln("exported: ", result.width, "x", result.height);\n\n    gui.Window win;\n    win.width = 430; win.height = 340; win.title = "Image export";\n    gui.ImageBox view;\n    view.x = 35; view.y = 30; view.width = 340; view.height = 240; view.resize_mode = "fit"; view.set_image(result);\n    win.add_child(view);\n    win.show();\n}`,
}, ['GUI показывает повёрнутую уменьшенную картинку; manual_export.png появляется в дереве проекта и открывается инспектором.'], { actions: ['После запуска открыть созданный manual_export.png в file-list.'] });
copyAsset('spec/some_images/cat.png', '08_assets/004_image_export/cat.png');

addProject('08_assets', 5, 'sound_controls', 'audio.Sound: play, pause, resume, stop', 'asset', {
  'main.idyl': `use audio;\nuse gui;\n\nmain() {\n    audio.Sound sound;\n    sound.load_from_file("click.wav");\n    sound.volume = 0.35;\n\n    gui.Window win;\n    win.width = 570; win.height = 220; win.title = "Sound controls";\n    array<string, 4> labels = ["Play x3", "Pause", "Resume", "Stop all"];\n    dyn_array<gui.Button> buttons;\n    for (int i = 0; i < labels.length(); i += 1) {\n        gui.Button button;\n        button.x = 25 + i * 135; button.y = 65; button.width = 120; button.text = labels[i];\n        buttons.add(button); win.add_child(button);\n    }\n    buttons[0].on_click = void function() { sound.play(); sound.play(); sound.play(); };\n    buttons[1].on_click = void function() { sound.pause(); };\n    buttons[2].on_click = void function() { sound.resume(); };\n    buttons[3].on_click = void function() { sound.stop(); };\n    win.show();\n}`,
}, ['Play x3 запускает три копии эффекта; громкость около 35%; pause/stop воздействуют на все активные копии.'], { actions: ['Несколько раз нажать Play x3, затем быстро проверить Pause, Resume и Stop all.'] });
copyAsset('spec/some_audio/click.wav', '08_assets/005_sound_controls/click.wav');

addProject('08_assets', 6, 'music_controls', 'audio.Music: position, volume и loop', 'asset', {
  'main.idyl': `use audio;\nuse gui;\n\nmain() {\n    audio.Music music;\n    music.load_from_file("theme.mp3");\n    music.volume = 0.2;\n    music.loop = true;\n\n    gui.Window win;\n    win.width = 650; win.height = 280; win.title = "Music controls";\n    gui.Label status;\n    status.x = 30; status.y = 30; status.width = 580; status.text = "duration=" + to_string(music.duration);\n    gui.Button play; play.x = 30; play.y = 95; play.text = "Play";\n    gui.Button pause; pause.x = 160; pause.y = 95; pause.text = "Pause";\n    gui.Button resume; resume.x = 290; resume.y = 95; resume.text = "Resume";\n    gui.Button stop; stop.x = 420; stop.y = 95; stop.text = "Stop";\n    gui.Button seek; seek.x = 30; seek.y = 165; seek.width = 220; seek.text = "На середину";\n    play.on_click = void function() { music.play(); status.text = "playing=" + to_string(music.is_playing); };\n    pause.on_click = void function() { music.pause(); status.text = "paused at " + to_string(music.position); };\n    resume.on_click = void function() { music.resume(); status.text = "resumed"; };\n    stop.on_click = void function() { music.stop(); status.text = "stopped at " + to_string(music.position); };\n    seek.on_click = void function() { music.position = music.duration / 2.0; status.text = "middle=" + to_string(music.position); };\n    win.add_child(status); win.add_child(play); win.add_child(pause); win.add_child(resume); win.add_child(stop); win.add_child(seek);\n    win.show();\n}`,
}, ['Музыка слышна примерно на 20%, а не на максимуме; pause/resume сохраняют позицию, seek переносит на середину, loop перезапускает.'], { actions: ['Play, Pause, Resume, На середину, подождать loop, Stop.'] });
copyAsset('spec/some_audio/theme.mp3', '08_assets/006_music_controls/theme.mp3');

addProject('08_assets', 7, 'music_finished', 'Событие audio.Music.on_finished', 'asset', {
  'main.idyl': `use audio;\nuse gui;\n\nmain() {\n    audio.Music music;\n    music.load_from_file("theme.mp3");\n    music.volume = 0.25;\n    music.loop = false;\n\n    audio.Sound done;\n    done.load_from_file("click.wav");\n    done.volume = 0.4;\n\n    gui.Window win;\n    win.width = 520; win.height = 230; win.title = "Music finished";\n    gui.Label status; status.x = 35; status.y = 40; status.width = 440; status.text = "Нажмите Play";\n    gui.Button play; play.x = 35; play.y = 110; play.width = 180; play.text = "Play from end";\n    music.on_finished = void function() { status.text = "on_finished сработал"; done.play(); };\n    play.on_click = void function() {\n        music.position = music.duration - 1.5;\n        status.text = "Осталось около 1.5 сек";\n        music.play();\n    };\n    win.add_child(status); win.add_child(play); win.show();\n}`,
}, ['Пример начинает близко к концу; примерно через 1.5 сек меняется Label и звучит click.wav ровно один раз.'], { actions: ['Нажать Play from end, дождаться события; повторить ещё раз.'] });
copyAsset('spec/some_audio/theme.mp3', '08_assets/007_music_finished/theme.mp3');
copyAsset('spec/some_audio/click.wav', '08_assets/007_music_finished/click.wav');

addProject('08_assets', 8, 'shared_font', 'Один fonts.Font для GUI и Canvas', 'asset', {
  'main.idyl': `use colors;\nuse drawable;\nuse fonts;\nuse gui;\n\nfonts.Font shared_font;\ndrawable.Text canvas_text;\n\nvoid function init(gui.Canvas canvas) {\n    canvas_text.font = shared_font; canvas_text.text = "Canvas 123"; canvas_text.x = 35; canvas_text.y = 50; canvas_text.font_size = 42; canvas_text.text_color = colors.WHITE;\n    canvas.fill(colors.RGB(25, 29, 39)); canvas.draw(canvas_text);\n}\n\nmain() {\n    shared_font.load_from_file("Lobster-Regular.ttf");\n    gui.Window win; win.width = 620; win.height = 400; win.title = "Shared font"; win.font = shared_font;\n    gui.Label gui_text; gui_text.x = 35; gui_text.y = 25; gui_text.width = 540; gui_text.font_size = 34; gui_text.text = "GUI 123 тем же шрифтом";\n    gui.Canvas canvas; canvas.x = 35; canvas.y = 105; canvas.width = 540; canvas.height = 210; canvas.on_init = init;\n    win.add_child(gui_text); win.add_child(canvas); win.show();\n}`,
}, ['GUI Label и drawable.Text используют один и тот же Lobster; обе надписи и цифры визуально совпадают по гарнитуре.']);
copyAsset('spec/some_fonts/Lobster-Regular.ttf', '08_assets/008_shared_font/Lobster-Regular.ttf');

if (entries.length !== 120) {
  throw new Error(`Expected 120 manual entries, generated ${entries.length}`);
}

const categoryTitles = {
  '01_core': 'Основы языка и консоль',
  '02_arrays_strings': 'Массивы и строки',
  '03_functions_oop': 'Функции, ООП и модули',
  '04_types_colors_encoding': 'types, colors и encoding',
  '05_files_json_sqlite': 'Файлы, JSON и SQLite',
  '06_gui': 'GUI',
  '07_canvas': 'Canvas и геометрия',
  '08_assets': 'Изображения, аудио и шрифты',
};

write('manifest.json', JSON.stringify({ version: 1, total: entries.length, entries }, null, 2));

const readme = [
  '# Ручная регрессионная батарея Idyllium',
  '',
  `В наборе **${entries.length} запускаемых сценариев**. Главная инструкция к каждому сценарию находится прямо в начале его запускаемого \`.idyl\`-файла: строки \`ДЕЙСТВИЕ\` и \`ОЖИДАЕТСЯ\`.`,
  '',
  '## Как проверять',
  '',
  '1. Откройте всю папку `spec/some_tests` в WebIDE как проект или загрузите нужную подпапку.',
  '2. Для одиночного файла запускайте сам файл. Для проекта запускайте указанный `main.idyl`.',
  '3. Сценарии `expected-error` обязаны завершаться короткой понятной ошибкой. Это успешный результат теста.',
  '4. GUI и Canvas проверяйте действиями из комментариев: один факт открытия Preview ничего не доказывает.',
  '5. После проверки отмечайте пункт ниже. `manifest.json` содержит ту же матрицу в машинном виде.',
  '',
  '## Чек-лист',
  '',
];

for (const [category, title] of Object.entries(categoryTitles)) {
  readme.push(`### ${title}`, '');
  for (const entry of entries.filter((item) => item.category === category)) {
    readme.push(`- [ ] **${entry.id}** \`${entry.entry}\` — ${entry.title} (${entry.kind})`);
  }
  readme.push('');
}

readme.push(
  '## Обслуживание набора',
  '',
  '- Пересоздать файлы: `npm run manual:generate`.',
  '- Проверить компиляцию всех точек входа: `npm run manual:check`.',
  '- Генератор не подменяет ручную проверку поведения и внешнего вида; он только сохраняет структуру батареи воспроизводимой.',
);

write('README.md', readme.join('\n'));

console.log(`Generated ${entries.length} manual test entries in ${path.relative(repoRoot, suiteRoot)}`);
