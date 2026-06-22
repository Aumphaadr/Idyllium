# Idyllium AI Reference

This file is a compact AI-friendly reference for the Idyllium programming
language. It is intended to be pasted into general-purpose AI chatbots so they
can generate, explain, review, and test Idyllium code.

Current language target: IdylliumNext 1.0.0.

Important rule for AI assistants: Idyllium is a child-friendly educational
language. Do not invent syntax. Do not replace Idyllium syntax with C++, C#,
JavaScript, Python, Java, Kotlin, or pseudo-code. If a requested feature is not
listed here, say that it is not specified yet and propose a discussion instead
of silently inventing a new construct.

## 1. Philosophy

Idyllium is designed for teaching programming to children and teenagers.
The language prefers predictable behavior and clear errors.

Core principles:

- `23 / 10` must behave like school arithmetic and produce a float-like result,
  not integer truncation.
- Text is text, not bytes; strings with Cyrillic characters should behave as
  strings of characters.
- GUI widgets are normal objects, not pointers.
- Most implicit conversions are forbidden. For example, `label.text = 42;`
  should be an error, not an implicit conversion to `"42"`.
- Runtime errors should be readable, copyable, and understandable after machine
  translation.
- `++` and `--` do not exist in Idyllium and must not be generated.

## 2. File And Program Shape

An Idyllium source file usually has:

1. `use` imports.
2. Global variables, functions, classes.
3. `main()`.

Example:

```idyllium
use console;

main() {
    console.writeln("Hello, World!");
}
```

Modules are imported by file/library name:

```idyllium
use console;
use math;
use gui;
```

User modules are ordinary `.idyl` files in the same project. If there is
`helper.idyl`, it can be imported with:

```idyllium
use helper;
```

Then public top-level functions/classes in that module are accessed as
`helper.name`.

## 3. Comments And Formatting

Line comments:

```idyllium
// comment
```

Block comments:

```idyllium
/* comment */
```

Use four spaces for indentation in examples.

## 4. Primitive Types

Primitive types:

- `int`
- `float`
- `string`
- `char`
- `bool`
- `void`

Boolean literals:

```idyllium
true
false
```

String literals use double quotes:

```idyllium
string text = "Привет";
```

Character literals use single quotes:

```idyllium
char letter = 'A';
char line_break = '\n';
```

Useful escapes include `\n`, `\t`, `\\`, `\"`, `\'`.

## 5. Variables And Assignment

Declaration:

```idyllium
int age = 12;
float temperature = 36.6;
string name = "Mira";
bool ok = true;
```

Assignment:

```idyllium
age = 13;
```

Compound assignment:

```idyllium
age += 1;
age -= 1;
temperature *= 2;
temperature /= 2;
```

Do not use:

```idyllium
age++;  // wrong: no ++ in Idyllium
age--;  // wrong: no -- in Idyllium
```

## 6. Type Conversion

Idyllium is strict about types.

Use explicit conversion functions:

```idyllium
int a = to_int("42");
float b = to_float("3.14");
string text = to_string(123);
```

Common rules:

- `int` can be used where a numeric `float` is expected.
- `float` cannot be assigned to `int` without `to_int()`.
- Numbers are not silently converted to strings.
- Strings are not silently converted to numbers.

## 7. Operators

Arithmetic:

```idyllium
a + b
a - b
a * b
a / b
```

`/` is normal division and returns a float-like numeric result.

Integer division and remainder:

```idyllium
int q = div(23, 10);  // 2
int r = mod(23, 10);  // 3
```

Comparisons:

```idyllium
a == b
a != b
a < b
a <= b
a > b
a >= b
```

Logic:

```idyllium
if (age >= 10 and age <= 18) {
    console.writeln("school age");
}

if (not(is_ready)) {
    console.writeln("not ready");
}
```

Use `and`, `or`, `not`, not `&&`, `||`, `!`.

## 8. Console

Import:

```idyllium
use console;
```

Output:

```idyllium
console.write("Name: ", name);
console.writeln("Age: ", age);
console.clear();
console.set_precision(3);
```

`console.write(...)` prints values without an automatic newline.
`console.writeln(...)` prints values and then a newline.

Input:

```idyllium
int age = console.get_int();
float height = console.get_float();
string name = console.get_string();
```

Invalid numeric input is a runtime error. Example:

```text
main.idyl:5: runtime error: cannot convert input to 'int' (expected integer, got "abc")
```

ANSI color escape sequences may be used in console output:

```idyllium
console.writeln("\e[31m", "Red text");
console.writeln("\e[0m", "Normal text");
```

## 9. Control Flow

`if`:

```idyllium
if (score >= 90) {
    console.writeln("excellent");
} else {
    console.writeln("try again");
}
```

`while`:

```idyllium
int i = 0;
while (i < 5) {
    console.writeln(i);
    i += 1;
}
```

`do while`:

```idyllium
int x = 0;
do {
    x += 1;
} while (x < 10);
```

`for`:

```idyllium
for (int i = 0; i < 10; i += 1) {
    console.writeln(i);
}
```

Loop control:

```idyllium
break;
continue;
```

## 10. Arrays

Fixed-size arrays:

```idyllium
array<int, 3> numbers = [10, 20, 30];
console.writeln(numbers[0]);
```

Dynamic arrays:

```idyllium
dyn_array<string> names;
names.add("Mira");
names.add("Leo");
```

Array indices are zero-based. Out-of-bounds access is a readable runtime error:

```text
main.idyl:5: runtime error: array index 5 out of bounds (size 3, valid indices 0-2)
```

Array methods:

```idyllium
values.length()
values.contains(value)
values.find(value)
values.count(value)
values.reverse()
values.sort()
```

Dynamic-array-only methods:

```idyllium
values.add(value)
values.remove_at(index)
values.resize(size)
values.insert(index, value)
values.join(other)
values.clear()
values.pop()
```

Global array helper functions exist in lessons and runtime, but prefer methods
when writing new educational code.

When a string is printed as an element inside an array, it is shown with quotes
and escaped control characters, for example:

```text
["Кирка\n", "Топор\n", "Меч"]
```

This is intentional and helps students see hidden newline characters.

## 11. Strings And Characters

Strings have methods:

```idyllium
text.length()
text.contains("abc")
text.find("abc")
text.count("a")
text.is_int()
text.is_float()
text.to_upper()
text.to_lower()
text.substring(start, length)
text.replace(old_text, new_text)
text.split(separator)
text.trim()
```

Character indexing:

```idyllium
string word = "кот";
char first = word[0];
```

String characters are read-only. Do not generate code that assigns to
`word[0]`.

## 12. Functions

Function declaration:

```idyllium
int function sum(int a, int b) {
    return a + b;
}
```

Void function:

```idyllium
void function say_hello(string name) {
    console.writeln("Hello, ", name);
}
```

Call:

```idyllium
int total = sum(10, 20);
say_hello("Mira");
```

Default arguments:

```idyllium
void function print_num(int num = 0) {
    console.writeln(num);
}

main() {
    print_num();
    print_num(50);
}
```

Parameters with default values must come after required parameters:

```idyllium
int function add(int a, int b = 0) {
    return a + b;
}
```

Named arguments:

```idyllium
int function sub(int left, int right) {
    return left - right;
}

main() {
    console.writeln(sub(50, 30));                   // 20
    console.writeln(sub(left=50, right=30));        // 20
    console.writeln(sub(right=50, left=30));        // -20
}
```

Rules:

- Positional arguments may come before named arguments.
- Positional arguments after named arguments are forbidden.
- Passing the same parameter twice is forbidden.
- Unknown argument names are forbidden.
- Named arguments are not supported for variadic functions such as
  `console.write(...)`.

Recursion is allowed:

```idyllium
int function factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}
```

## 13. `main`

Pedagogical short form:

```idyllium
main() {
    console.writeln("Start");
}
```

After functions are introduced, typed `main` is allowed:

```idyllium
int function main() {
    console.writeln("Done");
    return 0;
}
```

`main` may return any normal Idyllium type, but its returned value is currently
ignored by Web IDE/GUI preview. A program may contain only one `main`.
`main` must not take parameters.

## 14. Inline Callback Functions

Some GUI/Canvas/audio properties accept callbacks. You may assign an inline
function:

```idyllium
button.on_click = void function() {
    console.writeln("clicked");
};
```

Or assign a named function:

```idyllium
void function handle_click(gui.Button sender) {
    sender.text = "Clicked";
}

main() {
    gui.Button button;
    button.on_click = handle_click;
}
```

## 15. Classes And OOP

Class declaration:

```idyllium
class Hero {
    string name;
    int hp;

    constructor Hero(string ex_name, int ex_hp) {
        this.name = ex_name;
        this.hp = ex_hp;
    }

    void function hit(int damage) {
        this.hp -= damage;
        if (this.hp < 0) {
            this.hp = 0;
        }
    }

    int function get_hp() {
        return this.hp;
    }
}
```

Object creation:

```idyllium
Hero hero("Mira", 100);
hero.hit(30);
console.writeln(hero.get_hp());
```

Constructors are used in declarations, not as general expressions. Prefer:

```idyllium
Hero hero("Mira", 100);
```

Do not generate constructor calls as standalone expressions unless a current
spec example explicitly shows that pattern.

### Access Modifiers

`public:` and `private:` use a colon and apply until the next modifier or the
end of the class.

```idyllium
class Hero {
    private:
    int hp;

    public:
    string name;

    int function get_hp() {
        return this.hp;
    }
}
```

### Static Methods

```idyllium
class Cat {
    static void function meow() {
        console.writeln("Мяу");
    }
}

main() {
    Cat.meow();
}
```

### Inheritance And Polymorphism

Inheritance:

```idyllium
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
        console.writeln(this.name, ": woof");
    }
}
```

Polymorphism is supported for class relations. A function expecting a base
class may receive a subclass object:

```idyllium
void function make_sound(Animal animal) {
    animal.speak();
}

main() {
    Dog dog("Rex");
    make_sound(dog);
}
```

The same idea powers library APIs such as `gui.Window.add_child(gui.Widget)`
and `gui.Canvas.draw(drawable.Drawable)`.

## 16. User Modules

If project has `math_tools.idyl`:

```idyllium
int function square(int value) {
    return value * value;
}
```

Then `main.idyl` may use:

```idyllium
use console;
use math_tools;

main() {
    console.writeln(math_tools.square(7));
}
```

Qualified classes from user modules are declared as:

```idyllium
use geometry;

main() {
    geometry.Point p;
}
```

## 17. Library `math`

Import:

```idyllium
use math;
```

Constants:

```idyllium
math.pi
math.e
```

Functions:

```idyllium
math.abs(value)
math.sqrt(value)
math.round(value)
math.floor(value)
math.ceil(value)
math.pow(value, power)
math.clamp(min, value, max)
math.sin(radians)
math.cos(radians)
math.tan(radians)
math.asin(value)
math.acos(value)
math.log(value)
math.log10(value)
math.to_radians(degrees)
math.to_degrees(radians)
```

Angles for trigonometric functions are in radians.

## 18. Library `random`

```idyllium
use random;

int a = random.create_int(1, 10);
float b = random.create_float(0.0, 1.0);
random.set_seed(123);
```

Invalid ranges are runtime errors. Do not silently swap or clamp ranges.

## 19. Library `time`

```idyllium
use time;

time.sleep(1.5);
time.stamp now = time.now();
time.stamp past = time.from_unix(0);

console.writeln(now.year());
console.writeln(now.month());
console.writeln(now.day());
console.writeln(now.hour());
console.writeln(now.minute());
console.writeln(now.second());
console.writeln(now.week_day());
console.writeln(now.unix());
console.writeln(now.to_string());
```

## 20. Library `file`

```idyllium
use file;
```

Check existence:

```idyllium
if (file.exists("input.txt")) {
    console.writeln("exists");
}
```

Read:

```idyllium
file.istream fin = file.open("input.txt", "read");
string first = fin.read_line();
string rest = fin.read_all();
fin.close();
```

Write:

```idyllium
file.ostream fout = file.open("output.txt", "write");
fout.write_line("Hello");
fout.write_line(10, " ", 20);
fout.close();
```

Common modes:

- `"read"`
- `"write"`

Always close streams in examples.

## 21. Library `encoding`

```idyllium
use encoding;

dyn_array<string> names = encoding.list_encodings();
int code = encoding.char_to_int('A', "utf-8");
char ch = encoding.int_to_char(65, "utf-8");
dyn_array<int> bytes = encoding.encode("кот", "utf-8");
string text = encoding.decode(bytes, "utf-8");
```

## 22. Library `colors`

Import:

```idyllium
use colors;
```

Type:

```idyllium
colors.Color
```

Factories:

```idyllium
colors.RGB(red, green, blue)           // int channels 0..255
colors.RGBA(red, green, blue, alpha)   // alpha 0.0..1.0
colors.HEX("#2291bc")
colors.HSL(hue, saturation, lightness)
```

Constants:

```idyllium
colors.BLACK
colors.WHITE
colors.RED
colors.GREEN
colors.BLUE
colors.TRANSPARENT
```

Invalid channel values are runtime errors. Do not silently clamp
`colors.RGB(999, -20, 300)`.

Prefer `text_color`, `background_color`, `border_color`, `foreground_color`
over vague legacy `color`.

## 23. Library `types`

The `types` library intentionally demonstrates C-like numeric limits and
overflow. It is an exception to the usual Idyllium philosophy because it teaches
students about low-level numeric behavior.

Types:

```idyllium
types.int8
types.uint8
types.int16
types.uint16
types.int32
types.uint32
types.float32
types.float64
```

Integer overflow wraps without runtime errors:

```idyllium
use types;

main() {
    types.uint8 n = 253;
    n = n + 1;  // 254
    n = n + 1;  // 255
    n = n + 1;  // 0

    types.uint8 a = -11;  // 245
    types.uint8 b = 260;  // 4
}
```

Operations between integer-like `types` values and `int` first produce an
ordinary integer result, then assignment/call converts to the target type.

Float-to-integer-like assignment is forbidden without explicit `to_int()`.

Helpers:

```idyllium
value.to_bin()
value.to_hex()
types.from_bin("11111111", "uint8")
types.from_hex("FF", "uint8")
```

## 24. JSON

Import:

```idyllium
use json;
```

Types:

```idyllium
json.Value
json.Object
json.Array
```

Constants/functions:

```idyllium
json.NULL
json.is_valid(text)
json.parse(text)
json.Value()
json.Value(value)
```

`json.Value()` without arguments creates `null`.

Create JSON:

```idyllium
use console;
use json;

main() {
    json.Object root;

    root.add("name", json.Value("Mira"));
    root.add("age", json.Value(12));
    root.add("admin", json.Value(false));
    root.add("middle_name", json.NULL);

    json.Array scores;
    scores.add(json.Value(5));
    scores.add(json.Value(4));
    scores.add(json.Value(5));
    root.add("scores", json.Value(scores));

    console.writeln(root.to_pretty_json(4));
}
```

Read JSON from file:

```idyllium
use console;
use file;
use json;

main() {
    file.istream fin = file.open("player.json", "read");
    string text = fin.read_all();
    fin.close();

    json.Value value = json.parse(text);
    json.Object root = value.to_object();

    string name = root.get("name").to_string();
    int level = root.get("level").to_int();

    console.writeln(name, " ", level);
}
```

`json.Value` methods:

```idyllium
is_null()
is_string()
is_int()
is_float()
is_bool()
is_object()
is_array()
to_string()
to_int()
to_float()
to_bool()
to_object()
to_array()
set_null()
set_string(value)
set_int(value)
set_float(value)
set_bool(value)
set_object(value)
set_array(value)
to_json()
to_pretty_json()
to_pretty_json(indent)
```

`json.Object` methods:

```idyllium
length()
has(key)
get(key)
add(key, value)
set(key, value)
remove(key)
keys()
```

`add` requires a new key. `set` updates an existing key. Keys are strings and
must be unique inside one object.

`json.Array` methods:

```idyllium
length()
at(index)
set(index, value)
add(value)
insert(index, value)
pop()
remove(index)
clear()
```

Do not write comments inside JSON files. JSON text uses double-quoted keys,
curly braces for objects, square brackets for arrays, and `null` for missing
values.

## 25. GUI

Import:

```idyllium
use gui;
use colors;
```

Basic app:

```idyllium
use gui;

main() {
    gui.Window win;
    win.width = 400;
    win.height = 240;
    win.title = "App";

    gui.Label label;
    label.x = 20;
    label.y = 20;
    label.text = "Hello";

    win.add_child(label);
    win.show();
}
```

Base widget properties inherited by many widgets:

```idyllium
x: int
y: int
width: int
height: int
visible: bool
text_color: colors.Color
background_color: colors.Color
```

Common color properties:

```idyllium
text_color
background_color
border_color
foreground_color   // ProgressBar fill color role
```

`text_color` and `background_color` may be inherited by child widgets where the
runtime supports inheritance.

### GUI Types

`gui.Window`:

```idyllium
x, y, width, height, title, text_color, background_color
add_child(child)
show()
```

`gui.Label`:

```idyllium
x, y, width, height, visible
text, font_size
text_color, background_color, border_color
on_click
color  // legacy string text color shortcut; prefer text_color
```

`gui.Button`:

```idyllium
x, y, width, height, visible
text
text_color, background_color, border_color
on_click
```

`gui.Frame`:

```idyllium
x, y, width, height, visible
title
background_color, border_color, border_width
add_child(child)
```

`gui.Image`:

```idyllium
x, y, width, height, visible
resize_mode
load_from_file(path)
```

Known resize modes are documentation-level strings; use examples from the
current docs/spec when choosing a mode.

`gui.LineEdit`:

```idyllium
x, y, width, height, visible
text, placeholder, font_size, echo_mode
text_color, background_color, border_color
on_change
```

`gui.TextEdit`:

```idyllium
x, y, width, height, visible
text, placeholder
text_color, background_color, border_color
```

`gui.ProgressBar`:

```idyllium
x, y, width, height, visible
value, min, max
text_color, background_color, foreground_color, fill_color, border_color
```

Prefer `foreground_color` for the filled part.

`gui.SpinBox`:

```idyllium
x, y, width, height, visible
value, min, max, step
on_change
```

`gui.FloatSpinBox`:

```idyllium
x, y, width, height, visible
value, min, max, step
on_change
```

`gui.Slider`:

```idyllium
x, y, width, height, visible
value, min, max, step
on_change
```

`gui.CheckBox`:

```idyllium
x, y, width, height, visible
text, is_checked
on_change
```

`gui.RadioButton`:

```idyllium
x, y, width, height, visible
text, is_selected, group
on_change
```

`gui.ComboBox`:

```idyllium
x, y, width, height, visible
selected_index, selected_text
add_item(text)
clear_items()
on_change
```

`gui.Modal`:

```idyllium
title, message, confirm_text, cancel_text
on_confirm, on_cancel
show_alert()
show_confirm()
show_input()
get_input_value()
```

`gui.Timer`:

```idyllium
interval
on_tick
start()
stop()
```

Example button:

```idyllium
use console;
use gui;

void function clicked(gui.Button sender) {
    sender.text = "Clicked";
    console.writeln("button clicked");
}

main() {
    gui.Window win;
    win.width = 300;
    win.height = 160;

    gui.Button button;
    button.x = 40;
    button.y = 40;
    button.width = 180;
    button.height = 40;
    button.text = "Click";
    button.on_click = clicked;

    win.add_child(button);
    win.show();
}
```

## 26. Canvas And Drawable Objects

Canvas is a GUI widget:

```idyllium
use gui;

main() {
    gui.Window win;
    gui.Canvas canvas;

    canvas.x = 20;
    canvas.y = 20;
    canvas.width = 400;
    canvas.height = 240;

    win.add_child(canvas);
    win.show();
}
```

Usually import:

```idyllium
use colors;
use drawable;
use gui;
```

`gui.Canvas` properties:

```idyllium
x, y, width, height, visible
framerate_limit: int
on_init
on_key_pressed
on_key_released
on_mouse_pressed
on_mouse_released
on_mouse_move
on_mouse_scroll
on_update
```

`gui.Canvas` methods:

```idyllium
clear()
fill(color)
draw(object)
```

`draw(object)` accepts `drawable.Drawable` subclasses.

Events:

```idyllium
gui.KeyboardEvent.key: string

gui.MouseEvent.x: int
gui.MouseEvent.y: int
gui.MouseEvent.mouse_button: string  // "LEFT", "RIGHT", "MIDDLE"

gui.MouseScrollEvent.x: int
gui.MouseScrollEvent.y: int
gui.MouseScrollEvent.delta: int
```

Canvas callbacks:

```idyllium
void function init(gui.Canvas canvas) {}
void function update(gui.Canvas canvas, float delta_time) {}
void function key_down(gui.Canvas canvas, gui.KeyboardEvent e) {}
void function key_up(gui.Canvas canvas, gui.KeyboardEvent e) {}
void function mouse_down(gui.Canvas canvas, gui.MouseEvent e) {}
void function mouse_up(gui.Canvas canvas, gui.MouseEvent e) {}
void function mouse_move(gui.Canvas canvas, gui.MouseEvent e) {}
void function mouse_scroll(gui.Canvas canvas, gui.MouseScrollEvent e) {}
```

### Drawable Types

Base type:

```idyllium
drawable.Drawable
```

`drawable.Rectangle`:

```idyllium
x, y, width, height
rotation: float
fill_color: colors.Color
border_width: int
border_color: colors.Color
move(dx, dy)
rotate(angle)
```

`drawable.Circle`:

```idyllium
x, y, radius
rotation: float
fill_color: colors.Color
border_width: int
border_color: colors.Color
move(dx, dy)
rotate(angle)
```

`drawable.Line`:

```idyllium
x1, y1, x2, y2
color: colors.Color
thickness: int
move(dx, dy)
```

`drawable.Texture`:

```idyllium
load_from_file(path)
```

`drawable.Sprite`:

```idyllium
texture: drawable.Texture
x, y
set_scale(x, y)
move(dx, dy)
```

`drawable.Font`:

```idyllium
load_from_file(path)
```

`drawable.Text`:

```idyllium
font: drawable.Font
text: string
x, y
font_size: int
text_color: colors.Color
move(dx, dy)
```

Example:

```idyllium
use colors;
use drawable;
use gui;

drawable.Circle ball;

void function init(gui.Canvas canvas) {
    ball.x = 120;
    ball.y = 80;
    ball.radius = 30;
    ball.fill_color = colors.RGB(255, 210, 80);

    canvas.clear();
    canvas.draw(ball);
}

main() {
    gui.Window win;
    win.width = 360;
    win.height = 240;

    gui.Canvas canvas;
    canvas.x = 20;
    canvas.y = 20;
    canvas.width = 300;
    canvas.height = 160;
    canvas.on_init = init;

    win.add_child(canvas);
    win.show();
}
```

Smooth movement pattern:

```idyllium
use colors;
use drawable;
use gui;

drawable.Rectangle player;
dyn_array<string> pressed_keys;

void function init(gui.Canvas canvas) {
    player.x = 20;
    player.y = 20;
    player.width = 40;
    player.height = 40;
    player.fill_color = colors.GREEN;
}

void function on_key_pressed(gui.Canvas canvas, gui.KeyboardEvent e) {
    if (not(pressed_keys.contains(e.key))) {
        pressed_keys.add(e.key);
    }
}

void function on_key_released(gui.Canvas canvas, gui.KeyboardEvent e) {
    if (pressed_keys.contains(e.key)) {
        pressed_keys.remove_at(pressed_keys.find(e.key));
    }
}

void function on_update(gui.Canvas canvas, float delta_time) {
    if (pressed_keys.contains("W")) { player.y -= 2; }
    if (pressed_keys.contains("S")) { player.y += 2; }
    if (pressed_keys.contains("A")) { player.x -= 2; }
    if (pressed_keys.contains("D")) { player.x += 2; }

    canvas.clear();
    canvas.draw(player);
}
```

## 27. Audio

Import:

```idyllium
use audio;
```

`audio.Sound` is for short sound effects. Multiple `play()` calls may overlap.

Properties:

```idyllium
src: string          // read-only
duration: float     // read-only
volume: float       // 0.0..1.0
is_playing: bool    // read-only
```

Methods:

```idyllium
load_from_file(path)
play()
pause()
resume()
stop()
```

`pause()` and `stop()` affect all active copies of the same `Sound`.

`audio.Music` is for long music files.

Properties:

```idyllium
src: string          // read-only
duration: float      // read-only
position: float
volume: float        // 0.0..1.0
loop: bool
is_playing: bool     // read-only
on_finished
```

Methods:

```idyllium
load_from_file(path)
play()
pause()
resume()
stop()
```

Example:

```idyllium
use audio;
use gui;

audio.Sound click;

void function play_click() {
    click.play();
}

main() {
    click.load_from_file("click.wav");
    click.volume = 0.6;

    gui.Window win;
    win.width = 260;
    win.height = 140;

    gui.Button button;
    button.x = 40;
    button.y = 40;
    button.width = 160;
    button.height = 40;
    button.text = "Play sound";
    button.on_click = play_click;

    win.add_child(button);
    win.show();
}
```

## 28. Errors

Prefer examples that produce clear, precise errors. Good error style:

```text
main.idyl:5: runtime error: array index 5 out of bounds (size 3, valid indices 0-2)
main.idyl:7: runtime error: cannot convert input to 'int' (expected integer, got "abc")
main.idyl:10: error: cannot assign 'string' value to 'int' variable
```

When generating teaching materials, include both:

- correct code;
- intentionally wrong code with expected error text.

## 29. Do Not Generate These

Do not generate:

```idyllium
i++;
i--;
if (a && b) {}
if (!ok) {}
int x = 23 / 10;          // likely wrong: / returns float-like division
label.text = 42;          // wrong: no implicit int-to-string
button.onclick = ...;     // wrong spelling; use on_click
new Hero();               // wrong: no new keyword
Hero* hero;               // wrong: no pointers
std::cout << "hi";        // wrong: not C++
Console.WriteLine(...);   // wrong: not C#
print("hi")               // wrong: not Python
let x = 10;               // wrong: not JavaScript
```

Do not invent dictionaries/maps, async/await, lambdas with arrow syntax,
interfaces, generics for user classes, exceptions, namespaces, package imports,
or operator overloading unless the current project spec explicitly adds them.

## 30. Good AI Behavior For Idyllium Tasks

When asked to generate Idyllium code:

1. Use `use console;` for console I/O.
2. Use `main() { ... }` for beginner tasks unless the task is explicitly about
   functions/typed `main`.
3. Use four spaces for indentation.
4. Use explicit conversions with `to_int`, `to_float`, `to_string`.
5. Use `+= 1` instead of `++`.
6. Use `colors.Color` objects for GUI/Canvas colors.
7. For GUI/Canvas, create widgets/objects as normal variables, set properties,
   then call `add_child`, `draw`, or assign callbacks.
8. For modules, access imported user module symbols through `module.name`.
9. For educational explanations, prefer small steps and clear motivation.
10. If syntax is uncertain, say so and ask for the project spec instead of
    inventing syntax.

## 31. Compact Program Templates

Console:

```idyllium
use console;

main() {
    console.writeln("Hello");
}
```

Input:

```idyllium
use console;

main() {
    console.write("Введите число: ");
    int value = console.get_int();
    console.writeln("Ваше число: ", value);
}
```

Function:

```idyllium
use console;

int function square(int value) {
    return value * value;
}

main() {
    console.writeln(square(7));
}
```

GUI:

```idyllium
use gui;

main() {
    gui.Window win;
    win.width = 300;
    win.height = 160;

    gui.Button button;
    button.x = 40;
    button.y = 40;
    button.width = 180;
    button.height = 40;
    button.text = "OK";

    win.add_child(button);
    win.show();
}
```

Canvas:

```idyllium
use colors;
use drawable;
use gui;

drawable.Circle circle;

void function init(gui.Canvas canvas) {
    circle.x = 100;
    circle.y = 80;
    circle.radius = 30;
    circle.fill_color = colors.BLUE;
    canvas.draw(circle);
}

main() {
    gui.Window win;
    win.width = 300;
    win.height = 220;

    gui.Canvas canvas;
    canvas.x = 20;
    canvas.y = 20;
    canvas.width = 240;
    canvas.height = 150;
    canvas.on_init = init;

    win.add_child(canvas);
    win.show();
}
```

JSON:

```idyllium
use console;
use json;

main() {
    json.Object root;
    root.add("name", json.Value("Mira"));
    root.add("level", json.Value(5));
    console.writeln(root.to_pretty_json(4));
}
```

