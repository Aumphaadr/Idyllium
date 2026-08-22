# Idyllium AI Reference

This file is a compact AI-friendly reference for the Idyllium programming
language. It is intended to be pasted into general-purpose AI chatbots so they
can generate, explain, review, and test Idyllium code.

Current language target: Idyllium 1.5.0.

This reference describes implemented behavior. Ideas from `BACKLOG.md` and
exploratory files under `spec/some_*` are not language features until they are
implemented and documented here.

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
- Compound assignments (`+=`, `-=`, `*=`, `/=`) exist, but course materials
  deliberately prefer the full form `x = x + 1` — it keeps both roles of the
  variable visible (source on the right, target on the left). When generating
  teaching code, prefer the full form; reserve `+=` for string style appending
  (`sign.style += "color: green;";`) where the course itself uses it.
- Since 1.3.5 the compiler emits targeted hints for common beginner mistakes:
  `=` in a condition, `&&`/`||`/`!` (suggests `and`/`or`/`not`), `%` (suggests
  `mod(a, b)`), `++`/`--` (suggests `x = x + 1`), `elif`, a decimal comma in
  numbers, an unescaped quote inside a string, a keyword used as a name, and
  Cyrillic/Latin homoglyph mixups in identifiers. A method or function named
  without parentheses in statement position is a compile error
  (`'info' is not called — add '()' to call it`).

## 2. File And Program Shape

An Idyllium source file usually has:

1. `use` imports.
2. Global variables, functions, classes.
3. `main()`.

Example:

```idyllium
use console;

main() {
    console.write("Hello, World!", '\n');
}
```

This matches the Web IDE starter program and the first lesson of the course
(`console.write` with an explicit `'\n'` is taught before `writeln`).

Modules are imported by file/library name:

```idyllium
use console;
use math;
use gui;
use fonts;
```

User modules are ordinary `.idyl` files in the same project. If there is
`helper.idyl`, it can be imported with:

```idyllium
use helper;
```

Then top-level variables, constants, functions, and classes from that module are
accessed as `helper.name`.

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

Supported escapes are `\n`, `\t`, `\r`, `\e` (ESC), `\0`, `\\`, `\"`, and
`\'`. Unknown escape sequences are compile errors.

`null` is a language literal, but it is not a general-purpose primitive type.
Only library value containers that explicitly support an absent value may
receive or compare equal to it. Currently these are `json.Value` and
`sqlite.Value`; ordinary variables, arrays, user-class objects, `json.Object`,
and `json.Array` are not nullable.

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
age += 1;          // works, but course style prefers: age = age + 1;
age -= 1;
temperature *= 2;
temperature /= 2;
```

Do not use:

```idyllium
age++;  // wrong: no ++ in Idyllium
age--;  // wrong: no -- in Idyllium
```

Named constants use `const` before the type:

```idyllium
use console;

const int MAX_LEVEL = 100;

main() {
    const string GAME_TITLE = "Idyllium Quest";
    console.writeln(GAME_TITLE, ": ", MAX_LEVEL);
}
```

Rules for named constants:

- `const` is supported for local and top-level variable declarations.
- An initializer is mandatory.
- Direct assignment and compound assignment to the name are compile errors.
- A top-level constant in `config.idyl` is available as `config.NAME` after
  `use config;`.
- For arrays and objects, `const` protects the binding, not the complete object
  graph. `items[0] = value` and mutating methods remain valid, while
  `items = other_items` is forbidden.
- `const` is not currently a class-field or parameter modifier.
- Uppercase names such as `MAX_LEVEL` are a convention, not a parser rule.

Readable diagnostics include:

```text
main.idyl:2: compile error: constant 'answer' must have an initializer
main.idyl:3: compile error: cannot assign to constant 'answer'
```

A declaration without an initializer creates the value's default:

```idyllium
int count;        // 0
float ratio;      // 0
string name;      // ""
char letter;      // '\0'
bool ready;       // false
array<int, 3> a;  // [0, 0, 0] — N default elements
```

A class-typed declaration (`Hero h;`) creates an object with default field
values. If the class has a constructor callable without arguments (no
parameters, or every parameter has a default), that constructor runs;
a constructor with required parameters is NOT run by a bare declaration —
the fields simply keep their type defaults.

### Reserved Names

Standard library module names are reserved for every declaration —
variables, parameters, functions and classes:

```text
audio colors console drawable encoding file fonts gui hash image json
math random sqlite system time turtle types url
```

```idyllium
int console = 5;   // compile error: variable 'console' conflicts with
                   // a standard library module
```

The reason is unavoidable ambiguity: `console.write(...)` is parsed as module
access, so the same word would mean two things at once.

Built-in global function names (`to_int`, `to_float`, `to_string`,
`type_name`, `max`, `min`, `sum`, `avg`; `div` and `mod` are already
keywords) are reserved for
**functions and classes only**:

```idyllium
int function to_string(int value) { return value; }
// compile error: function 'to_string' conflicts with a built-in function
```

A variable may take such a name — `int sum = a + b;` is legal and common in
teaching code. But once the name is taken in that scope, calling the built-in
through it is a compile error rather than a silent fallback:

```idyllium
int sum = 100;
console.writeln(sum(nums));
// compile error: variable 'sum' hides the built-in function 'sum'
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
- `to_int(float_value)` truncates toward zero.

`type_name(value)` returns the type as a string, written the
same way compiler messages write types: values report their static type
(`type_name(5)` → `"int"`, `type_name(a)` → `"array<int, 3>"`), objects
report their ACTUAL class even when viewed through a base-typed variable
(`Animal x = Cat(...); type_name(x)` → `"Cat"`; module classes are qualified:
`"zoo.Lion"`; library objects: `"gui.Button"`, `"json.Value"`,
`"time.stamp"`). Main use: type checks inside the `equals` contract (§7).

Ordinary `int` arithmetic is exact ON ANY SIZE: `+ - *`, `div`, `mod`,
comparisons, literals of any length, printing, `to_string`/`to_int`
round-trips, and `console.get_int` input never lose integer precision —
including values above JavaScript's 2^53 limit and beyond 64 bits
(`123456789 * 123456789 * 123456789` prints all 25 digits;
`to_int("123456789123456789123456789")` returns it exactly). This is the
language rule: int never overflows and never lies; fixed-width overflow
wrap-around exists only in the `types` library cells. Precision honestly
ends where the float domain begins: `/` always returns `float`, and
`math.*` functions work in floats.

## 7. Operators

Arithmetic:

```idyllium
a + b
a - b
a * b
a / b
```

`/` is normal division and always returns `float`, even for `10 / 5`. The
general rule: when an operation could theoretically produce a fraction, its
result type is `float`; as soon as one operand is `float`, the result is
`float` (`2.5 * 4` is `10` of type `float`).

Integer division and remainder are global functions (there is no `%` operator
and no `?:` ternary operator in Idyllium):

```idyllium
int q = div(23, 10);  // 2
int r = mod(23, 10);  // 3
```

String concatenation uses `+`: `string + string`, `string + char`, and
`char + string` all produce a new string. `char + char` is a compile error
(convert one side with `to_string()`), and `"ab" * 3` string repetition does
not exist.

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

bool only_one = left_pressed xor right_pressed;

if (not(is_ready)) {
    console.writeln("not ready");
}
```

Use `and`, `or`, `xor`, `not`, not `&&`, `||`, `^`, `!`.

Ordering comparisons `<`, `<=`, `>`, `>=` accept numeric operands and
`time.stamp` pairs (ordered by instant). Comparing strings or chars with them
is a compile error that names both offending types (`comparison '<' requires
numeric operands, got 'string' and 'string'`). Strings and chars support only
`==` and `!=`. Special targeted hints: `score =+ 10` → `'=+' is not an
operator — did you mean '+='?` (while `lives =- 5` stays a legal assignment
of -5); a greedy `not` before a comparison (`not coins > 100`) adds `'not'
takes only what stands right after it — write 'not (coins > …)' to negate
the whole comparison`.

### Equality rules

`==`/`!=` compare CONTENT for every comparable type: numbers, strings, chars,
bools, arrays (recursively), `colors.Color` (by channels), `time.stamp` (by
instant — timezone does not participate), `json.Value` (by value, deeply for
object/array payloads; comparing cyclic JSON values is a runtime error
`cannot compare cyclic JSON value`), `sqlite.Value` (by SQL storage class and
value; INTEGER and REAL compare numerically; unlike SQL itself, two SQL NULLs
are equal — `x == null` is the taught idiom).

**Objects of user classes have no built-in equality.** `a == b` on objects is
a compile error unless the class declares the equals contract:

```idyllium
bool function equals(Hero other) {
    return this.name == other.name and this.level == other.level;
}
```

With the contract, `a == b` and `a != b` dispatch to it; so do `contains`,
`find`, `count` on arrays of that class, and `==` on such arrays (structural,
per cell). Without it: `cannot compare objects of class 'Hero' with '==' —
declare 'bool function equals(Hero other)' in class 'Hero' and the comparison
will use it` (searches say `contains() cannot search for 'Hero' objects — …`).

Contract rules:
- The parameter type is the class itself; dispatch is STATIC — the left
  operand's declared type picks the contract. Comparing a `Cat` variable with
  an `Animal` variable is a compile error (`'Cat.equals' accepts a 'Cat', got
  'Animal'`); compare both through the same class window instead.
- Contracts are NOT inherited: a class must declare its own `equals` (a
  derived class may declare `equals(Derived)` alongside the base's
  `equals(Base)` — the only case where an override may change the signature).
  Viewing two derived objects through base-typed variables compares them with
  the BASE contract («equals works for the class you look through»).
- `equals` should answer, not mutate — nothing enforces purity, write it pure.
- Inside `equals`, `type_name(this) != type_name(other)` distinguishes
  namesakes of different classes (see `type_name` in §6).
- `sort()` on arrays of objects is a compile error (`sort() cannot order
  'Hero' objects — objects have no built-in ordering`): there is no ordering
  contract yet.

All logical operands must have type `bool`; Idyllium has no truthy/falsy
conversion. Precedence from higher to lower is `not`, comparisons, `and`,
`xor`, `or`. `and` and `or` short-circuit. `xor` evaluates both operands from
left to right exactly once and is true only when exactly one operand is true.

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
`console.set_precision(digits)` controls float formatting and accepts an integer
from `0` through `25`. By default floats print with up to 8 fractional digits and
trailing zeros are trimmed: `10 / 3` prints `3.33333333`, `0.1 + 0.2` prints `0.3`,
`1.5` prints `1.5`. A non-zero value that would round to `0` at the current
precision falls back to exponential form instead: `3.009e-36`, never a
misleading `0`.

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

Every `if`, `while`, `do-while`, and `for` condition must already have type
`bool`. Idyllium has no Python/JavaScript-style truthy or falsy conversion:

```idyllium
// if (1) {}               // compile error: got int
// if (name) {}            // compile error: got string
// while (items.length) {} // compile error: got int

if (name != "" and items.length > 0) {
    console.writeln("data exists");
}
```

Braces may be omitted when a branch contains exactly one statement:

```idyllium
if (score >= 90)
    console.writeln("excellent");
else
    console.writeln("try again");
```

Indentation does not change the grammar. Without braces, only the immediately
following statement belongs to the branch:

```idyllium
if (ready)
    console.writeln("start");
console.writeln("always"); // outside the if
```

An `else` belongs to the nearest unfinished `if`. If another statement has
already completed that `if`, the compiler reports that `else` has no matching
`if` and recommends wrapping a multi-statement branch in `{ ... }`.

`else if` chains parse naturally (an `else` whose statement is another `if`)
and are valid:

```idyllium
if (score >= 90) {
    console.writeln("excellent");
} else if (score >= 60) {
    console.writeln("good");
} else {
    console.writeln("try again");
}
```

There is no `switch` statement and no `for (x in collection)` loop. Iterate
collections by index: `for (int i = 0; i < items.length; i = i + 1)`.

`while`:

```idyllium
int i = 0;
while (i < 5) {
    console.writeln(i);
    i = i + 1;
}
```

`do while`:

```idyllium
int x = 0;
do {
    x = x + 1;
} while (x < 10);
```

`for`:

```idyllium
for (int i = 0; i < 10; i = i + 1) {
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

The size is an integer literal or a named integer constant (including a
constant computed from other constants); plain variables are rejected at
compile time:

```idyllium
const int SIZE = 6;
array<int, SIZE> cells;          // ok
// int n = 6; array<int, n> bad; // compile error: must be a 'const'
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

Array read-only property:

```idyllium
values.length
```

Do not call it as `length()` and do not assign to it. Array methods:

```idyllium
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

Arrays have value semantics. Assignment, a function argument, and a function return
create an independent array copy. Nested array containers are copied recursively;
class and library objects stored in cells retain their object identity.

Array `==` and `!=` comparisons are structural: lengths and corresponding cells
are compared recursively. Library/class objects inside cells still follow their
own equality semantics.

Fixed and dynamic arrays are mutually convertible when their element types are
compatible. The target type determines whether the copy is fixed or dynamic:

```idyllium
array<int, 3> fixed = [10, 20, 30];
dyn_array<int> dynamic = fixed;
```

Converting `dyn_array<T>` to `array<T, N>` performs a runtime size check. A size
mismatch is a readable runtime error; it never truncates or pads the array implicitly.
Known mismatched sizes between two fixed arrays are compile-time errors.

Numeric arrays also support global aggregate functions:

```idyllium
max(values)
min(values)
sum(values)
avg(values)
```

`max`, `min`, and `sum` return an integer-like result for integer arrays and a
float result for float arrays. `avg` always returns `float`. Empty arrays and
non-numeric arrays are runtime errors. These are global functions, not array
methods.

When a string is printed as an element inside an array, it is shown with quotes
and escaped control characters, for example:

```text
["Кирка\n", "Топор\n", "Меч"]
```

This is intentional and helps students see hidden newline characters.

## 11. Strings And Characters

String read-only property:

```idyllium
text.length
```

Do not call it as `length()`. String methods:

```idyllium
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

`is_int()`/`is_float()` are guards with an exact contract: `is_int()` is true
precisely for the strings `to_int()` accepts, `is_float()` precisely for the
strings `to_float()` accepts. Integer text is valid float text, so
`"50".is_float()` is `true` (and `to_float("50")` returns 50); `is_int()` is
therefore a subset of `is_float()`. Neither accepts exponent notation ("5e3"),
commas, or non-numeric text. Both ignore surrounding whitespace.

Character indexing:

```idyllium
string word = "кот";
char first = word[0];
```

String characters are read-only. Do not generate code that assigns to
`word[0]`. Create a new string and assign the complete result instead.

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
use console;

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

A default expression may refer to an earlier parameter. Default arguments work
for functions, methods, and constructors:

```idyllium
int function add_twice(int first, int second = first) {
    return first + second;
}

class Counter {
    int value;

    constructor Counter(int start = 5) {
        this.value = start;
    }

    void function add(int amount = 1) {
        this.value = this.value + amount;
    }
}
```

Named arguments:

```idyllium
use console;

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
- Named arguments work for user functions, methods, constructors, and
  non-variadic library calls.
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
use console;

main() {
    console.writeln("Start");
}
```

After functions are introduced, typed `main` is allowed:

```idyllium
use console;

int function main() {
    console.writeln("Done");
    return 0;
}
```

`main` may return any normal Idyllium type. A program may contain only one
`main`, and `main` must not take parameters.

The returned value is the program's **exit value**. It is printed by the host
after the program finishes — never by the program itself, so it does not appear
in the console output, in redirected files, or in lesson output blocks:

```text
[Программа завершилась с кодом 0]
```

- A `void` `main` prints nothing.
- The value is rendered by the same rules as `console.write()`, so a class with
  a public `to_string()` prints through it. Strings are quoted:
  `[Программа завершилась с кодом "готово"]`.
- In the CLI an `int` result also becomes the process exit code, wrapped into
  `[0, 255]`; when wrapping changes the number, the message names both:
  `[Программа завершилась с кодом 1000 (процесс вернул 232)]`. Other types leave
  the process code at 0.
- For a GUI program the message appears when the last window closes, not when
  `main` returns.

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
use gui;

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
        this.hp = this.hp - damage;
        if (this.hp < 0) {
            this.hp = 0;
        }
    }

    int function get_hp() {
        return this.hp;
    }
}
```

Inside an instance method or constructor, class fields and instance methods
must be accessed through `this.`. A bare field name is treated as an ordinary
local/global name and is therefore an error when no such name exists:

```idyllium
this.hp = this.hp - damage;   // correct: class field
this.get_hp();          // correct: instance method
hp = hp - damage;             // wrong: 'hp' is not a local variable
```

Object creation:

```idyllium
Hero hero("Mira", 100);
hero.hit(30);
console.writeln(hero.get_hp());
```

The pedagogical declaration form remains available:

```idyllium
Hero hero("Mira", 100);
```

Calling a user class creates and returns a fresh object, so constructors may be
used anywhere an expression of that class is accepted:

```idyllium
dyn_array<Hero> heroes;
heroes.add(Hero("Kaspar", 500));

Hero raven = Hero("Raven", 600);

Hero function create_boss() {
    return Hero("Aranthir", 1000);
}

bool strong = Hero("Ornella", 750).get_hp() > 700;
```

Declaring an object variable without parentheses NEVER runs the constructor
(the ghost rule). The object is created with default field values (numbers 0,
strings empty). To run the constructor, call it explicitly:

```idyllium
Hero ghost;                  // constructor NOT called: fields are "" and 0
Hero named = Hero("Mira");   // constructor called explicitly
Hero short_form("Mira");     // parenthesized declaration also calls it
```

The same rule applies to arrays of objects (`array<Hero, 3> team;` creates
three default-valued objects) and to object fields inside classes — both are
"blank slots" that the program fills explicitly. A zero-argument explicit call
`Hero()` is valid when the constructor has no required parameters (or the
class has no constructor at all).

Named and default arguments work in constructor expressions. A class imported
from a user module is created with `geometry.Point(10, 20)`. Each call returns
an independent object, and a subclass expression may be used where its base
class is expected. A class without an explicit constructor may be called with
zero arguments, such as `Empty()`, but not with arguments. Constructor
expressions are also valid in class field initializers.

There is no `new` expression. Declaring a destructor is a friendly compile
error (`destructors are not supported yet`). A field whose type is (directly
or transitively) the class itself is a compile error (`field 'friend' of
class 'Person' creates an endless chain of default objects — …`): default
construction would recurse forever. `dyn_array<Person>` fields are legal
(their default is an empty list) — use them for trees and lists. A trailing semicolon after the
class body (`};`) is accepted and ignored, so C++ habits do not break code.

### Printing Objects: The `to_string()` Contract

Passing a class object to `console.write`/`console.writeln` is a compile error
(`cannot print object of class 'Cat' directly — declare 'string function
to_string()' in class 'Cat' and printing will use it`) unless the class
declares a public zero-argument method `string function to_string()`. When a
method named `equals`/`to_string` exists but has the wrong shape (private,
static, wrong parameter or return type), the error appends the exact reason,
e.g. `(class 'Cat' has 'to_string', but it returns 'int' instead of 'string')`.
Contracts are not inherited: the method must be declared in the
class itself — a derived class without its own `to_string` is not printable
even when the base has one. With the method, the object prints through it.
An **array of objects** whose element class owns the contract also prints:
element representations are collected via `to_string()` and rendered like an
array of strings (`["Герой Мира", "Герой Кай"]`).
Without the contract the array refuses with the same teaching hint. String
concatenation with an object stays forbidden (like `string + int`) — use the
global `to_string(obj)`, which honours the contract:

```idyllium
use console;

class Point {
    int x;
    int y;

    string function to_string() {
        return "(" + to_string(this.x) + ", " + to_string(this.y) + ")";
    }
}

main() {
    Point p;
    console.writeln(p); // (0, 0)
}
```

Arrays of class objects are never printable directly — print elements in a
loop instead.

Functions are not printable either: `console.writeln(abs_value)`
— a forgotten-parentheses mistake — is a compile error (`cannot print function
'abs_value' — add '()' with its arguments to call it and print the result`);
the same guard covers `to_string(fn)`, file writes and `json.Value(fn)`.

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

### Static Methods, Static Fields, Class Constants

```idyllium
use console;

class Cat {
    const int MAX_KITTENS = 6;      // class constant: Cat.MAX_KITTENS
    static int population = 0;      // one per class, not per object

    static void function meow() {
        console.writeln("Мяу");
    }

    constructor Cat() {
        Cat.population = Cat.population + 1;
    }
}

main() {
    Cat.meow();
    console.writeln(Cat.population, " ", Cat.MAX_KITTENS);
    Cat.population = 3;                  // static fields are writable
    array<int, Cat.MAX_KITTENS> basket;  // int class constants work as array sizes
}
```

Rules: access is ALWAYS through the class name (`Cat.population`; through an
object — compile error `static field 'Cat.population' must be accessed
through class 'Cat'`; same for static methods). A class constant is written
`const` WITHOUT `static` (`static const` → compile error suggesting plain
`const`), must have an initializer, and cannot be assigned
(`cannot assign to class constant 'Cat.MAX_KITTENS'`). Statics are NOT
inherited: `Kitten.population` via a subclass → compile error
`static field 'Cat.population' is not inherited — write 'Cat.population'`
(same genre for static methods). `this` does not exist in static context.
`const` parameters do not exist in the language. Statics of classes from
USER MODULES work through the full chain: `use zoo; zoo.Lion.population`,
`zoo.Lion.MAX_AGE`, `zoo.Lion.roar()` — same rules, same refusals.

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

`parent(arguments)` inside a subclass constructor runs the base-class
constructor. Rules:

- Calling `parent()` is optional; without it, inherited fields keep their type
  defaults (or the base field initializers).
- The compiler does not force `parent()` to be the first statement; calling it
  first is a style recommendation, because a later `parent()` call overwrites
  fields assigned before it.

### User Events

A class may declare events with the `event` keyword and fire them from its
own methods. Outside code subscribes by assignment, exactly like widget
callbacks:

```idyllium
use console;

class Hero {
    int hp = 100;

    event on_death(Hero victim);

    void function hit(int damage) {
        this.hp = this.hp - damage;
        if (this.hp <= 0) {
            this.on_death(this);
        }
    }
}

void function mourn(Hero victim) {
    console.writeln("Hero died with hp ", victim.hp);
}

main() {
    Hero boss;
    boss.on_death = mourn;
    boss.hit(150);
}
```

Rules:

- `event name(params);` declares an event member; `event name;` means no
  parameters. Events have no return type and no parameter defaults.
- Firing is a plain call through `this.` and is allowed only inside the
  declaring class (or its subclasses). Firing from outside is a compile error.
- Without a subscriber, firing is a silent no-op — same as unassigned
  `on_click` on a widget.
- A handler takes either no parameters or the full event signature. Handlers
  can be named functions, inline functions, or object methods
  (`hero.on_death = scoreboard.count;` keeps `this` of the scoreboard).
- One subscriber per event: a new assignment replaces the previous handler.
  Reading an event as a value is a compile error.
- `static event` does not exist. Events work for classes imported from user
  modules too: subscribe with `clocks.Clock`-typed objects the same way.

Method references in general keep their object: `board.count` used as a
callback value still updates `board` when invoked.

Polymorphism is supported for class relations. A function expecting a base
class may receive a subclass object:

```idyllium
use console;

// Animal and Dog are the classes from the inheritance example above.
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

### Value And Reference Semantics (Memory Model)

Verified behavior of assignment and parameter passing — the value/reference
table (single source of truth):

| Family | Assignment/argument | `==` |
|---|---|---|
| primitives (`int`, `float`, `string`, `char`, `bool`) | copy | by content |
| `array` / `dyn_array` | copy (fresh cells; OBJECT cells still share the objects — «своя коробка, общие жители») | structural per cell |
| `colors.Color`, `time.stamp`, `json.Value`, `sqlite.Value` | value-like library types | by content (stamp — by instant; JSON — deep) |
| objects of user classes | reference (`Hero b = a;` — same object) | only via the `equals` contract (§7) |
| `json.Object`, `json.Array` and every other library OBJECT (`gui.*`, `image.*`, `sqlite.Database`…) | reference | `json.Object`/`json.Array` wrapped as `json.Value` compare by content; other library objects are not meaningfully comparable |

Details worth quoting:

- **Class objects are references.** `Hero b = a;` makes `b` and `a` the same
  object: `b.hp = 5;` changes `a.hp` too. Passing an object to a function
  passes the same object. There is no built-in object copy: write your own
  `copy()` method (shallow or deep — the class author decides).
- **Empty fields**: a class-typed FIELD declared with an explicit
  `= null` initializer may be empty — `class Room { Guest guest = null; }`.
  This is the ONLY place `null` is allowed for user classes: locals,
  parameters, returns and array cells never accept it. Rules: assign an object
  or `null` back to such a field; test it with `room.guest == null` /
  `!= null` (a compile error for any other object expression); ANY use of the
  field while empty — reading through it, printing it, passing it anywhere —
  is a runtime error naming the field (`field 'guest' of class 'Room' is
  empty (null) — check it with '!= null' before using it`). With the equals
  contract, empty equals only empty. `type_name(empty field)` → `"null"`.
  Self-referencing fields become legal when nullable
  (`class Person { Person friend = null; }`) — linked lists and trees are
  built this way; without `= null` such a field is a compile error (endless
  chain of default objects).
- **Arrays are values.** `dyn_array<int> b = a;` creates a copy: `b[0] = 99;`
  does not change `a[0]`. Passing an array to a function also copies it.
  A copy of an ARRAY OF OBJECTS is a fresh array whose cells point to the
  SAME objects: replacing a cell in the copy is invisible to the original,
  mutating a field through a cell is visible.
- Two `dyn_array`s of different lengths compare as `false` (lengths are a
  runtime property); two fixed arrays of different declared sizes do not even
  compile (`cannot compare 'array<int, 3>' and 'array<int, 2>'` — size is part
  of the type).
- **`colors.Color` and `time.stamp` are immutable values** — their `with_*`
  and `in_timezone` methods return new values; both compare by content
  (stamps by instant, so two stamps of the same moment in different timezones
  are equal — and order with `<`/`>` by instant too).

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

## 16a. Library `system`

```idyllium
system.set_recursion_depth(depth)   // void
system.recursion_depth()            // int
system.exit(code = 0)               // void, never returns
system.platform()                   // "cli" | "web" | "vscode"
system.version()                    // "1.5.0"
```

**Recursion depth.** Idyllium counts call depth itself instead of relying on the
JavaScript stack, so the limit is the same in every host. The default is 20000
nested calls; `set_recursion_depth()` accepts 10…200000 and raises a runtime
error outside that range. Exceeding the limit is an ordinary runtime error with
`file:line`, catchable by `try/catch`:

```text
main.idyl:3: runtime error: recursion depth limit of 20000 exceeded in function 'boom'
```

The upper bound is about memory, not stack: a suspended call frame costs roughly
a kilobyte, so 200000 frames is around 190 MB.

**`system.exit(code)`** stops the program immediately from anywhere, running
`finally` blocks on the way out, and supplies the same exit value as a `return`
from `main`. It is deliberately **not** catchable by `try/catch` — ending the
program is the program's own decision, not an error to recover from.

**`system.platform()`** matters because hosts differ: the Web IDE has a virtual
file system, `url.open()` opens a tab there, and audio needs a user gesture.

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
math.atan(value)
math.atan2(y, x)     // y FIRST; full-quadrant angle in radians, safe at x = 0.
                     // Canvas recipe: rotation = math.to_degrees(math.atan2(ty - y, tx - x))
                     // (screen Y points down, so the angle is clockwise — same as drawable rotation)
math.log(value)
math.log10(value)
math.to_radians(degrees)
math.to_degrees(radians)
```

Angles for trigonometric functions are in radians.

Result types: `math.abs` keeps the argument's numeric type (`int` stays `int`,
`float` stays `float`). `math.round`, `math.floor` and `math.ceil` return `int`
when called with one argument and `float` when the optional digits argument is
provided. `math.clamp` returns `int` when all three arguments are integers,
otherwise `float`. The remaining math functions return `float`.

## 18. Library `random`

```idyllium
use random;

int a = random.create_int(1, 10);
float b = random.create_float(0.0, 1.0);
char symbol = random.choose_from("ABCDEF");

array<string, 3> names = ["Liam", "Mira", "Raven"];
string name = random.choose_from(names);

random.set_seed(123);
```

`create_int(min, max)` includes both bounds, so `create_int(1, 10)` may return
either `1` or `10`. `create_float(min, max)` also includes both bounds (like
Python's `random.uniform`), though hitting `max` exactly is vanishingly rare.
Integer ranges allow `min == max`; float ranges require `min < max`.
`set_seed()` requires a non-negative integer and makes later results
reproducible (it also seeds `random.mulberry32()`, a classic raw generator
that takes no arguments and returns an integer from `0` to `4294967295`). Invalid ranges are runtime errors. Do not silently swap or clamp
ranges. `choose_from()` accepts a non-empty string, `array<T, N>`, or
`dyn_array<T>`. It returns `char` for a string and `T` for an array. Choosing
from an empty collection is a runtime error.

## 19. Library `time`

```idyllium
use time;

time.sleep(1.5);
time.stamp now = time.now();
time.stamp past = time.from_unix(0, "Asia/Yekaterinburg");
time.stamp meeting = time.create(2026, 9, 24, 18, 3);

console.writeln(now.year);
console.writeln(now.month);
console.writeln(now.day);
console.writeln(now.hour);
console.writeln(now.minute);
console.writeln(now.second);
console.writeln(now.millisecond);
console.writeln(now.week_day);
console.writeln(now.unix);
console.writeln(now.timezone);
console.writeln(now.to_string());
```

`time.now()` and `time.from_unix(seconds)` use `"UTC"` by default. Both accept
an optional IANA timezone such as `"Asia/Yekaterinburg"`, `"Europe/Berlin"`, or
`"America/New_York"`; named form `timezone="..."` is valid. Invalid timezone
names are runtime errors. The host `Intl` implementation applies historical
and daylight-saving transitions.

The components `year`, `month`, `day`, `hour`, `minute`, `second`,
`millisecond`, `week_day`, `unix`, and `timezone` are read-only properties, not
getter methods. `unix` is whole seconds; `millisecond` is `0..999`.
`time.from_unix` accepts fractional seconds — the fraction becomes
milliseconds (`time.from_unix(946684800.25)` gives `millisecond == 250`). Do not
generate `stamp.year()` or `stamp.unix()`. `month` returns `1..12`, and
`week_day` follows `0..6` with Sunday as `0`.

`stamp.in_timezone(name)` returns a new stamp for the same instant. It changes
the displayed calendar components but never changes `unix`:

```idyllium
time.stamp utc = time.from_unix(0);
time.stamp ekb = utc.in_timezone("Asia/Yekaterinburg");

console.writeln(utc); // 1970-01-01 00:00:00
console.writeln(ekb); // 1970-01-01 05:00:00
console.writeln(utc.unix == ekb.unix); // true
```

`time.create(year, month, day, hour = 0, minute = 0, second = 0,
millisecond = 0, timezone = "UTC")` builds a stamp from calendar components
interpreted in the given IANA timezone. Ranges are strict (month 1-12, hour
0-23, ...) and non-existent dates are runtime errors
(`time.create() date 2026-02-30 does not exist`); leap years are handled.
Named arguments read well: `time.create(2026, 9, 24, hour=18, minute=3)`.

`time.sleep()` accepts a non-negative number of seconds and may be stopped by
the IDE.

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
string prefix = fin.read(5);
string line = fin.read_line();
bool more = fin.has_next_line();
string rest = fin.read_all();
fin.close();
```

`has_next_line()` reports whether another `read_line()` call would succeed —
the canonical loop is `while (fin.has_next_line()) { ... fin.read_line() ... }`.
`read_line()` preserves the terminating `\n` or `\r\n` when one exists.
`read(count)` reads at most `count` Unicode characters from the current stream
position. The count must be a non-negative integer. `read()` without an
argument and `read_all()` both read all remaining content. All read methods
share one stream position. `read()` returns an empty string at end of file;
`read_line()` past the final line and every operation on a closed stream are
runtime errors.

Write:

```idyllium
file.ostream fout = file.open("output.txt", "write");
fout.write("Score: ");
fout.write_line(42);
fout.write_line("Done");
fout.close();
```

Append:

```idyllium
file.ostream fout = file.open("log.txt", "append");
fout.write_line("New entry");
fout.close();
```

`"append"` keeps the existing content and writes at the end; a missing file is
created empty. `"write"` always starts from an empty file. Any other mode is a
runtime error: `file.open() mode must be 'read', 'write' or 'append', got
'...'`. Teaching note: the first-year console course intentionally does not
mention `"append"` — there, school tasks solve appending by reading the whole
file and rewriting it, which is a deliberate exercise; do not suggest
`"append"` for first-year course tasks. The mode is introduced in the
third-year JSON course and is fine everywhere else.

`write(...)` writes exactly the supplied values. `write_line(...)` writes the
supplied values and then appends `\n`, like `console.writeln(...)`.
Opening in `"write"` mode creates or truncates the file. Its parent directory
must already exist; use `file.create_directory(..., parents=true)` when needed.

Common modes:

- `"read"`
- `"write"`

Always close streams in examples.

Streams expose a read-only `bool` property `is_open`:

```idyllium
file.ostream fout = file.open("output.txt", "write");
console.writeln(fout.is_open); // true
fout.close();
console.writeln(fout.is_open); // false
```

Streams are opened through `file.open(path, mode)`. They do not have a public
constructor such as `file.ostream("output.txt")`.

Project file-system operations:

```idyllium
file.create_directory("saves");
file.create_directory("game/saves/players", parents=true);

bool any_entry = file.exists("saves");
bool regular_file = file.is_file("saves/player.txt");
bool directory = file.is_directory("saves");
dyn_array<string> names = file.list_directory("saves");

file.copy("saves", "saves_backup");
file.rename("saves_backup", "archive");
file.remove("archive", recursive=true);
```

Rules:

- `create_directory(path)` requires the parent directory to exist;
- `parents=true` creates missing parent directories;
- `copy()` handles files and directory trees;
- `rename()` also moves entries when the destination has another parent;
- `copy()` and `rename()` never overwrite an existing destination;
- `remove()` removes files and empty directories;
- deleting a non-empty directory requires explicit `recursive=true`;
- mutating operations are restricted to the current project root.

## 21. Library `encoding`

```idyllium
use encoding;

dyn_array<string> names = encoding.list_encodings();
int codepoint = encoding.char_to_codepoint('б'); // 1073
char ch = encoding.codepoint_to_char(1073); // 'б'
dyn_array<int> bytes = encoding.encode("кот", "utf-8");
string text = encoding.decode(bytes, "utf-8");
```

Canonical encoding names returned by `encoding.list_encodings()`:

- `"ascii"`
- `"utf-8"`
- `"windows-1251"`
- `"koi8-r"`
- `"cp866"` (DOS Cyrillic with box-drawing characters)
- `"cp437"` (original IBM PC: Latin, box drawing, math symbols)
- `"windows-1252"` (Western European)
- `"windows-1254"` (Turkish)

Input also accepts the aliases `"utf8"`, `"cp1251"`, `"win1251"`, `"koi8r"`,
`"ibm866"`, `"dos866"`, `"ibm437"`, `"dos437"`, `"cp1252"`, `"win1252"`,
`"cp1254"`, and `"win1254"`. A Unicode code point is independent of its encoded byte sequence:
`б` is code point `1073`, but its UTF-8 bytes are `[208, 177]`.

`char_to_codepoint()` accepts exactly one Unicode character.
`codepoint_to_char()` accepts Unicode scalar values `0..1114111`, excluding
the surrogate range `55296..57343`. An unknown encoding name, an integer
outside byte range `0..255`, an unrepresentable character, or malformed UTF-8
is a runtime error. All single-byte encodings use complete 256-byte tables.

`encode()` and `decode()` take an optional `safe` parameter (default `true`).
By default conversion is strict and never silently inserts the Unicode
replacement character `�`. With `safe=false` the student explicitly opts out
of the safety net: undecodable bytes become `�` and unrepresentable
characters encode to `?` (byte 63) instead of raising a runtime error:

```idyllium
string mojibake = encoding.decode(bytes, "utf-8", safe=false);
```

## 21a. Library `url`

```idyllium
use url;

string address = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43";

url.open(address);                      // opens the system browser
url.scheme(address);                    // "https"
url.host(address);                      // "www.youtube.com"
url.path(address);                      // "/watch"
url.query(address);                     // "v=dQw4w9WgXcQ&t=43"
url.fragment("https://a.io/p#top");     // "top"
url.port(address);                      // 443 (default port when omitted)
url.query_value(address, "v");          // "dQw4w9WgXcQ"
url.encode("идиллия");                  // percent-encoded text
url.decode("%D0%B8...");                // back to readable text
url.is_valid("просто текст");           // false
```

`url.open()` works the same in all three hosts: a new tab in Web IDE, the
system browser from the VS Code extension, and the OS opener (`xdg-open`,
`open`, `start`) in the CLI. Only `http` and `https` are accepted — `file:`,
`javascript:` and `data:` raise a runtime error, and so does a failure to
launch a browser (for example on a headless server). `path()` and `fragment()`
return human-readable text (percent-escapes decoded); `query()` stays raw
because it is a compound string — use `query_value()` for a single parameter.
There are no network requests in this library: it only parses and opens.

## 21c. Library `http` (since 1.4.0)

HTTP client. Works on every host; in the Web IDE requests succeed only for
CORS-friendly sites (the Idyllium site itself serves handouts with
`Access-Control-Allow-Origin: *`, so handout JSON files double as a teaching
API). Only `http`/`https` addresses.

```idyllium
use http;
use json;

main() {
    http.Response r = http.get("https://aumphaadr.github.io/Idyllium/handouts/files/guild.json");
    console.writeln(r.status);            // 200
    console.writeln(r.ok);                // true for 200-299
    console.writeln(r.header("content-type"));
    json.Array members = json.parse(r.text).to_array();

    http.Response posted = http.post("https://example.org/api", "{\"vote\": 1}");

    http.set_timeout(30);                 // seconds, 1-300, default 10
}
```

`http.Response`: read-only `status` (int), `ok` (bool), `text` (string);
method `header(name)` returns the response header (case-insensitive) or an
empty string. A non-2xx status is NOT an error — check `ok` or `status`.
Runtime errors are readable and typed by cause: timeout (`timed out after N
seconds`), browser CORS block (`was blocked by the browser … works in console
runs`), network failure (`cannot reach '…': connection refused` / `host not
found`). `http.post` sends the body as `text/plain; charset=utf-8`. There is
no built-in rate limiting (matching Python/C#/C++ standard clients); default
timeouts only.

## 21d. Library `channel` (since 1.4.1)

Mail channel between RUNNING programs on the same computer — not a network.
Web IDE: browser tabs (BroadcastChannel); VS Code: runs inside one window
(shared extension host). Console/CLI runs refuse with a readable error:
`Post.open() is not available in the console host — run the program in the
Web IDE or VS Code, where running programs can hear each other`.

```idyllium
use channel;
use console;

void function on_letter(string text) {
    console.writeln("Received: ", text);
}

main() {
    channel.Post office;
    office.open("room-101");        // same name = same room, for every participant
    office.on_message = on_letter;  // callback genre, like on_click
    office.send("Hello neighbours!");
}
```

`channel.Post`: `open(name)` (non-empty name; reopening an open post is a
runtime error), `send(text)` (post must be open first), `close()`
(idempotent), read-only `is_open`, callback property `on_message` taking
either no parameters or one string. Semantics: a message is delivered to ALL
other participants of the same channel name — the sender never receives its
own message (BroadcastChannel semantics). Messages are not stored: whoever
opens the channel after a send receives nothing. An open post keeps the
program alive after main (window genre); `close()` releases it, Stop closes
all posts. For structured messages (games, protocols) send JSON text and
parse with `json.parse` — design the protocol before coding.

## 21e. Library `web` (since 1.5.0; templates, path parameters, forms and redirect — 1.5.1)

HTTP server (Flask genre). Works in console runs and VS Code with a real
port. In the Web IDE the same program starts a **rehearsal server**: a
Service Worker intercepts `<site>/preview/<port>/...` and routes requests to
the student's handlers, so the console prints a rehearsal address instead of
`http://127.0.0.1:8080` and the site opens in a neighbouring tab of the SAME
browser only (nobody else can reach it — the lesson frames it as a rehearsal
before the real performance in VS Code/console). Student code is identical
on all hosts. Outside the Web IDE page (plain `runIdylliumInBrowser` embeds,
tests) there is no listen transport and `web.Server.run()` still refuses
honestly (`web.Server.run() is not available in the Web IDE — run the
program in VS Code or the console host, where the computer can listen on a
port`).

```idyllium
use web;
use json;

void function hello(web.Request req, web.Response res) {
    res.send("Hello, " + req.query("name") + "!");     // text/html
}

void function api(web.Request req, web.Response res) {
    res.send_json("{\"players\": 3}");                 // application/json
}

void function receive(web.Request req, web.Response res) {
    res.status = 201;                                  // read when the reply is sent
    res.send("got: " + req.body);
}

main() {
    web.Server app;
    app.on_get("/hello", hello);
    app.on_post("/mailbox", receive);
    app.on_get("/api", api);
    app.serve_directory("public");   // static files, GET only, "/" -> index.html
    app.port = 8080;                 // 0-65535; 0 = ask the OS for a free port
    app.run();                       // never returns; Stop / Ctrl+C ends it
}
```

- `web.Server`: `on_get(path, handler)` / `on_post(path, handler)` (path
  starts with '/'; duplicate registration is a runtime error),
  `serve_directory(path)`, `run()`, properties `port` (int; holds the actual
  port after run), `host` (default `"127.0.0.1"` — this computer only;
  `"0.0.0.0"` exposes the program to the whole local network, on purpose
  only), read-only `is_running`.
- **Path parameters**: a route segment in angle brackets is a
  parameter — `app.on_get("/post/<id>", card)` matches `/post/3`, and
  `req.param("id")` returns `"3"`. Values are ALWAYS strings (convert with
  `to_int` yourself); missing name → empty string. An exact path beats a
  parameter route (`/post/new` wins over `/post/<id>`). A parameter must
  occupy a whole segment; two routes of the same shape conflict (runtime
  error at registration).
- `web.Request`: read-only `path` and `body`; `query(name)` — query
  parameter or empty string; `param(name)` — path parameter or empty string;
  `form(name)` — a field of an HTML form POST body
  (application/x-www-form-urlencoded: percent-decoding and `+`-as-space are
  handled), empty string when the field is absent.
- `web.Response`: `send(text)` (text/html), `send_json(text)`
  (application/json), `send_template(path, values)` and `redirect(path)` —
  one reply per request, a second send is a runtime
  error; `status` property (100–599, default 200).
- **Templates**: `res.send_template("templates/list.html",
  values)` reads an HTML file (a plain project path — no magic folders, same
  file system as the `file` library, sandboxed to the project) and renders
  it with values from a `json.Object` (optional second argument). Template
  language: `{{key}}` and `{{key.field}}` substitute values — substituted
  text is ALWAYS HTML-escaped (data is text; markup lives in the template);
  `{% for x in list %}…{% endfor %}` loops over a `json.Array` (nesting
  works); `{% if flag %}…{% else %}…{% endif %}` branches on a json bool
  (prefer branching in code; the `if` door exists mainly for Jinja
  migrants). Template mistakes never crash the server — a readable marker
  goes INTO the page instead: `[[ нет значения 'ghost' ]]`,
  `[[ 'title' — не объект ]]`, `[[ у 'guest' нет поля 'x' ]]`,
  `[[ 'items' — список: нужен {% for %} ]]`, `[[ 'posts' — не список ]]`,
  `[[ неизвестная команда '{% wat %}' ]]`. A missing template file is a
  handler error with the file-library canon (`web.Response.send_template()
  cannot read 'x.html': file does not exist` / `path is outside the
  project`).
- `redirect(path)` always answers **303 See Other** with a `Location`
  header (no status choice). Canonical PRG: after a successful POST form
  handler call `res.redirect("/")` so refreshing the page does not resubmit
  the form. The Web IDE rehearsal rewrites `Location` into the
  `/preview/<port>/` sandbox automatically.
- Built-in behavior: unknown path → 404; known path (exact or parameter),
  wrong method → 405; handler crash → 500 with the error text (the server
  keeps running and logs the crash to the program console). Requests are
  handled one at a time in arrival order. Static serving never leaves the
  served directory (path traversal is blocked). Busy port: `web.Server.run()
  port 8080 is already in use — choose another port or stop the other
  program`.
- The natural test client is the `http` library from the same language:
  `http.get("http://127.0.0.1:8080/api")`.

## 21b. Library `hash`

```idyllium
use hash;

int checksum = hash.crc32("Idyllium");        // 0..4294967295
int fast = hash.fnv1a("Idyllium");
int adler = hash.adler32("Idyllium");
string digest = hash.sha256("Idyllium");      // 64 lowercase hex chars
dyn_array<int> raw = hash.sha256_bytes("Idyllium"); // 32 bytes
```

Every function accepts a `string` (hashed as its UTF-8 bytes) or a byte array
(`array<int, N>` / `dyn_array<int>`, values `0..255`); other argument types are
compile errors and out-of-range bytes are runtime errors. Results are stable
across CLI, Web IDE, and the VS Code extension — the algorithms are implemented
inside Idyllium, not delegated to WebCrypto.

`crc32` is the IEEE/ZIP/PNG checksum, `adler32` is the zlib checksum, `fnv1a`
is FNV-1a 32-bit, and `sha256` is FIPS 180-4 SHA-256. There is intentionally no
`md5` or `sha1` (both are broken) and no password-hashing primitive: teaching
material should say plainly that a fast hash alone is not enough for storing
passwords (salt + slow KDFs like bcrypt/Argon2 are the real answer).

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
colors.HEX("#2291bc")                  // RRGGBB or RRGGBBAA
colors.HSL(hue, saturation, lightness) // 0..360, 0..100, 0..100
```

Constants:

```idyllium
colors.BLACK
colors.WHITE
colors.RED
colors.GREEN
colors.BLUE
colors.YELLOW
colors.CYAN
colors.MAGENTA
colors.GRAY
colors.LIGHT_GRAY
colors.DARK_RED
colors.DARK_GREEN
colors.DARK_BLUE
colors.OLIVE
colors.TEAL
colors.PURPLE
colors.TRANSPARENT
```

Exact palette values:

| Constant | Value | Constant | Value |
| --- | --- | --- | --- |
| `BLACK` | `#000000` | `WHITE` | `#FFFFFF` |
| `RED` | `#FF0000` | `DARK_RED` | `#800000` |
| `GREEN` | `#00FF00` | `DARK_GREEN` | `#008000` |
| `BLUE` | `#0000FF` | `DARK_BLUE` | `#000080` |
| `YELLOW` | `#FFFF00` | `OLIVE` | `#808000` |
| `CYAN` | `#00FFFF` | `TEAL` | `#008080` |
| `MAGENTA` | `#FF00FF` | `PURPLE` | `#800080` |
| `GRAY` | `#808080` | `LIGHT_GRAY` | `#C0C0C0` |

`TRANSPARENT` is `RGBA(0, 0, 0, 0.0)`. Preserve the established bright
meaning of `GREEN`: it is `#00FF00`, not the CSS legacy color named `green`.

Invalid channel values are runtime errors. Do not silently clamp
`colors.RGB(999, -20, 300)`.

`colors.HEX()` accepts six or eight hexadecimal digits, with an optional `#`.
Colors compare by RGBA channel values, not object identity:

```idyllium
colors.RGB(255, 0, 0) == colors.HEX("#ff0000")  // true
```

`colors.Color` exposes immutable channels:

```idyllium
red: int       // read-only, 0..255
green: int     // read-only, 0..255
blue: int      // read-only, 0..255
alpha: float   // read-only, 0.0..1.0

with_red(value) -> colors.Color
with_green(value) -> colors.Color
with_blue(value) -> colors.Color
with_alpha(value) -> colors.Color
with_rgb(red, green, blue) -> colors.Color
with_rgba(red, green, blue, alpha) -> colors.Color
```

Every `with_*()` method returns a new color. It never changes the source color
or widgets and drawable objects that already received the source value.

Use the property that names its role explicitly: `text_color`,
`background_color`, `border_color`, or `foreground_color`. Color properties
accept `colors.Color`; convert a HEX string explicitly with `colors.HEX()`.

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
types.int64
types.uint64
types.float32
types.float64
```

Exact integer ranges:

| Type | Minimum | Maximum |
|---|---:|---:|
| `types.int8` | -128 | 127 |
| `types.uint8` | 0 | 255 |
| `types.int16` | -32768 | 32767 |
| `types.uint16` | 0 | 65535 |
| `types.int32` | -2147483648 | 2147483647 |
| `types.uint32` | 0 | 4294967295 |
| `types.int64` | -9223372036854775808 | 9223372036854775807 |
| `types.uint64` | 0 | 18446744073709551615 |

`types.float32` uses IEEE-754 binary32; `types.float64` uses binary64.

The exact type limits are available as module constants: `types.INT8_MIN`,
`types.INT8_MIN`/`types.INT8_MAX`, `types.UINT8_MAX`, `types.INT16_MIN`/`types.INT16_MAX`,
`types.UINT16_MAX`, `types.INT32_MIN`/`types.INT32_MAX`, `types.UINT32_MAX`,
`types.INT64_MIN`/`types.INT64_MAX`, `types.UINT64_MAX` (18446744073709551615,
preserved exactly).

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

Operators (`+`, `-`, `*`, …) over `types` values compute in ordinary exact
Idyllium numbers; the CONSUMER truncates — the wrap happens when the result is
written into a `types` variable, not inside the operator. Methods
(`.shift_left()`, `.bit_and()`, …) compute inside the cell and return the
receiver's type:

```idyllium
types.uint8 a = 200;
types.uint8 b = 100;
console.writeln(a + b);   // 300 — not yet written into a uint8
types.uint8 c = a + b;    // 44 — truncated by the write
console.writeln(a.shift_left(1));  // 144, not 400 — methods stay in-type
```

`int64` and `uint64` preserve their complete 64-bit ranges exactly, including
values above 2^53. They use the same silent wraparound at typed boundaries.

Float-to-integer-like assignment is forbidden without explicit `to_int()`.
Values from `types` are accepted by ordinary numeric functions such as
`math.sqrt()`. Arithmetic `/` still follows ordinary Idyllium rules and returns
`float`; use global `div()` and `mod()` when integer division or remainder is
required.

Helpers:

```idyllium
value.to_bin()
value.to_hex()
value.shift_left(bits)
value.shift_right(bits)
value.bit_and(mask)
value.bit_or(mask)
value.bit_xor(mask)
value.bit_not()
types.from_bin("11111111", "uint8")
types.from_hex("FF", "uint8")
```

Both shift methods operate on the fixed-width bit cell of the receiver, and
they are available on integer and floating `types` values. Bits leaving either
edge are silently discarded; vacated positions are always filled with zero.
Right shift is logical even for signed types and does not preserve the sign.
A shift magnitude greater than or equal to the type width produces an all-zero
cell. A negative count reverses direction: `shift_left(-N)` is equivalent to
`shift_right(N)`, and `shift_right(-N)` is equivalent to `shift_left(N)`.
Floating values shift their IEEE-754 representation and then reinterpret the
resulting bits as the same float type. The result keeps the receiver's exact
`types.*` type.

The three binary bit methods require an unsigned mask of exactly the same bit
width. The return type is always the receiver type:

| Receiver | Required mask |
|---|---|
| `int8`, `uint8` | `uint8` |
| `int16`, `uint16` | `uint16` |
| `int32`, `uint32`, `float32` | `uint32` |
| `int64`, `uint64`, `float64` | `uint64` |

For floating receivers these methods edit the raw IEEE-754 cell. They may
therefore produce infinity, NaN, or a seemingly unrelated finite number.

Examples with observable results:

```idyllium
types.uint8 value = 221;
value.to_bin();                       // "11011101"
value.to_hex();                       // "DD"

types.uint8 bits = types.from_bin("00101011", "uint8");
bits.shift_right(3).to_bin();         // "00000101"
bits.shift_left(3).to_bin();          // "01011000"
bits.shift_left(12).to_bin();         // "00000000"
bits.shift_right(-3).to_bin();        // "01011000"

types.uint8 flags = 173;              // 10101101
types.uint8 mask = 15;                // 00001111
flags.bit_and(mask).to_bin();         // "00001101"
flags.bit_xor(mask).to_bin();         // "10100010"
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

Literal/functions:

```idyllium
null
json.is_valid(text)
json.parse(text)
json.Value()
json.Value(value)
```

`null` is a language literal, but it is assignable only to library types that
explicitly support an absent value. Currently `json.Value` and `sqlite.Value`
support it; primitive types, user classes, `json.Object`, and `json.Array` do not.
`json.Value()` without arguments also creates JSON null.
Both `value == null` and `value.is_null()` are valid checks for a nullable
`json.Value`; keeping `is_null()` is often clearer in teaching material.

Create JSON:

```idyllium
use console;
use json;

main() {
    json.Object root;

    root.add("name", json.Value("Mira"));
    root.add("age", json.Value(12));
    root.add("admin", json.Value(false));
    root.add("middle_name", null);

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
to_int64()
to_uint64()
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

For JSON numbers, `is_int()` is true only for an integral value, while
`is_float()` is true for either an integer or a non-integral number because both
can be converted safely with `to_float()`.

JSON integer tokens are parsed exactly, including values above JavaScript's
safe-integer limit (`2^53 - 1`). Use `to_int()` for ordinary safe integers,
`to_int64()` for the signed 64-bit range, and `to_uint64()` for the unsigned
64-bit range. Passing `types.int64` or `types.uint64` to `json.Value(...)` and
serializing it writes an unquoted JSON number without losing digits.

`json.Object` read-only property:

```idyllium
object.length
```

`json.Object` methods:

```idyllium
has(key)
get(key)
add(key, value)
set(key, value)
remove(key)
keys()
```

`add` requires a new key. `set` updates an existing key. Keys are strings and
must be unique inside one object.

`json.Array` read-only property:

```idyllium
array.length
```

`json.Array` methods:

```idyllium
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
enabled: bool
hint: string
text_color: colors.Color
background_color: colors.Color
font: fonts.Font
```

`hint` is a tooltip: the string pops up next to the cursor when
it rests over the widget; empty string (the default) means no tooltip. Unlike
`placeholder` (text inside an empty input field), `hint` works on every widget
— use it for small icon-only buttons.

`visible = false` hides the widget (it stays in memory, receives no events).
`enabled = false` keeps the widget on screen but disables it: it is rendered
dimmed/grayed by the current window theme, ignores mouse and keyboard, and its
callbacks do not fire. Both default to `true`. Disabling or hiding a container
(`Frame`, `TabWidget`) applies to all of its children. Neither state is an
error: "disabled and never re-enabled" is silent, like "hidden and never
re-shown".

Common color properties:

```idyllium
text_color
background_color
border_color
foreground_color   // ProgressBar fill color role
```

`text_color`, `background_color`, `font`, and `font_size` are inherited by child
widgets. An explicit child value overrides its parent. `font_size` belongs to a
text-bearing widget, not to the font resource. Its default value is `13`.

### The `style` Property (IdySS)

Every visual widget and `gui.Window` has a `style: string` property — a
CSS-like "sticker" applied on top of direct properties:

```idyllium
title.style = "color: white; background-color: dark-blue; border-radius: 12px;";
```

Rules of the sticker:

- **Typos are silent.** An unknown property (`backround-color`) or an invalid
  value (`opacity: 1.5`, `color: bananas`) is dropped without any error — like
  real CSS. Idyllium's own type checks still apply to the assignment itself
  (`label.style = 42;` is a compile error).
- **The sticker always wins** over direct properties while it lists that role:
  with `style = "color: blue;"` the widget shows blue text even if
  `text_color` was set. Assigning `""` removes the sticker and direct
  properties show again. Later declarations in one string beat earlier ones.
- The sticker is **not inherited** by child widgets; reading `style` returns
  exactly the assigned string.
- `style_hover` and `style_active` hold stickers that apply while the pointer
  is over the widget or while it is pressed. Same dictionary, same silence
  about typos.

Supported properties (everything else is ignored): `color`,
`background-color`, `border-color`, `border-width` (0-20), `border-radius`
(0-100), `border-style` (`solid`/`dashed`/`dotted`/`none`), `font-size`
(6-96), `font-weight` (`normal`/`bold`), `font-style` (`normal`/`italic`),
`text-align` (`left`/`center`/`right`), `opacity` (0.0-1.0), `user-select`
(`auto`/`none`/`text`/`all` — button-like widgets ship with `none` by default;
set `user-select: text` to restore selection), `padding`
(0-40). Pixel values accept `12px` or plain `12`.

`background` accepts ONLY gradients (solid colors go through
`background-color`): `linear-gradient([to right | 45deg,] color[, color...])`
with 2-8 stops and `radial-gradient(color, color[, ...])`. Stops use the same
color forms, optionally followed by a percent position
(`yellow 20%`). Angles are `0..360deg`; directions are `to top/bottom/left/
right` and corners like `to top right`. `url(...)` and any other `background`
value are silently dropped.

Color values: the 17 palette names of the `colors` library in kebab-case
(`red`, `dark-blue`, `light-gray`, `transparent`; `green` is `#00FF00`),
HEX (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), and `rgb(r, g, b)` /
`rgba(r, g, b, a)` with strict ranges. CSS-only names such as `pink` or
`salmon` are NOT supported. There is no `font-family`, no geometry
(`width`/`margin`/`position`), no shorthand `border: 2px solid red` — use the
three separate border properties.

### GUI Types

`gui.Window`:

```idyllium
x, y, width, height, title, theme, text_color, background_color, font, font_size
add_child(child)
show()
close()
```

`close()` removes the window from the program. When the last window closes the
program has no GUI left and the host finishes it — that is how an «Выход»
button is written.

`theme` is a string: `"default"` (plain light look), `"idyllium"` and
`"dracula"` (dark), `"breeze"` and `"oxygen"` (light KDE-flavoured). The theme
covers the whole window — titlebar, frames, buttons, inputs, checkboxes,
sliders, progress bars, tabs and modal dialogs. It is the lowest styling layer:
a colour the student assigns (`text_color`, `background_color`,
`border_color`, `foreground_color`) and IdySS stickers always win over it,
while untouched colours follow the theme. An unknown theme name is a runtime
error listing all five (`Window.theme must be 'default', 'idyllium',
'dracula', 'breeze' or 'oxygen', got '...'`).

`gui.Label`:

```idyllium
x, y, width, height, visible, enabled
text, href, font_size
text_color, background_color, border_color
on_click
```

A non-empty `href` turns the label into a real hyperlink (underlined, opens in
a new tab). There is no separate LinkLabel widget.

`gui.Button`:

```idyllium
x, y, width, height, visible, enabled
text, font_size
text_color, background_color, border_color
on_click
```

`gui.Frame`:

```idyllium
x, y, width, height, visible, enabled
title, font_size
background_color, border_color, border_width
add_child(child)
```

`gui.ImageBox`:

```idyllium
x, y, width, height, visible, enabled
resize_mode
set_image(image: image.Image)
```

Resize modes are `"fit"`, `"fill"`, `"stretch"`, and `"original"`; any other
value is a runtime error naming all four. String-enum widget properties are
STRICT across the board (echo_mode, orientation, resize_mode, theme) — only
IdySS `style` stickers stay silent by design.
`ImageBox` does not load files itself. Load an `image.Static` or
`image.Animation`, then pass it to `set_image()`.

`gui.LineEdit`:

```idyllium
x, y, width, height, visible, enabled
text, placeholder, placeholder_color, font_size, echo_mode
text_color, background_color, border_color
on_change
```

`gui.TextEdit`:

```idyllium
x, y, width, height, visible, enabled
text, placeholder, placeholder_color, font_size
text_color, background_color, border_color
on_change
```

`gui.ProgressBar`:

```idyllium
x, y, width, height, visible, enabled
value, min, max, orientation, font_size
text_color, background_color, foreground_color, border_color
```

`background_color` is visible in the unfilled part and `foreground_color` in the
filled part. The old `fill_color` alias has been removed.

`gui.SpinBox`:

```idyllium
x, y, width, height, visible, enabled
value, min, max, step, font_size
on_change
```

`gui.FloatSpinBox`:

```idyllium
x, y, width, height, visible, enabled
value, min, max, step, font_size
on_change
```

`gui.Slider`:

```idyllium
x, y, width, height, visible, enabled
value, min, max, step, orientation
on_change
```

`orientation` is `"horizontal"` (default) or `"vertical"`; a vertical slider
grows bottom-to-top (minimum at the bottom). Any other value is a runtime
error (`Slider.orientation must be 'horizontal' or 'vertical', got '...'`).
`gui.ProgressBar` has the same property with the same rules — a vertical bar
fills bottom-to-top.

SpinBox, FloatSpinBox and Slider share the defaults `value = 0`, `min = 0`,
`max = 100`, `step = 1`. Assigning `value` outside `min..max` from code is NOT
an error and is not clamped: the property keeps the assigned number, while the
on-screen control shows the nearest bound (Slider) or the raw number (SpinBox) —
deliberate, because the property setup order is free (`value = 150` followed by
`max = 300` is legal). USER input, in contrast, always respects the bounds:
arrows and the mouse wheel stop at the edges, and a number typed into a
SpinBox is clamped into `min..max` when committed (blur or Enter); empty or
non-numeric text reverts to the last committed value instead of becoming 0.
While the user is still typing, the program receives nothing — `on_change`
fires with the clamped value only on commit (arrows and the wheel commit
immediately).

`placeholder_color` (a `colors.Color`) tints the placeholder hint of
`gui.LineEdit`/`gui.TextEdit`. Like every widget colour, only an explicitly
assigned value is applied — otherwise the window theme picks the shade.

Slider `on_change` fires on every marker movement while dragging, not only
when the marker is released.

`gui.CheckBox`:

```idyllium
x, y, width, height, visible, enabled
text, is_checked, font_size
on_change
```

`gui.RadioButton`:

```idyllium
x, y, width, height, visible, enabled
text, is_selected, group, font_size
on_change
```

Selecting a radio button deselects the other buttons of the same `group`, and
`on_change` fires for every affected button: the newly selected one (with
`is_selected == true`) and each deselected sibling (with `is_selected == false`).

`gui.ComboBox`:

```idyllium
x, y, width, height, visible, enabled
selected_index, selected_text, font_size
add_item(text)
clear_items()
on_change
```

`selected_text` is read-only and follows `selected_index`. Change the selected
item through `selected_index`; do not assign to `selected_text`.

`gui.TabWidget`:

```idyllium
x, y, width, height, visible, enabled
selected_index, selected_title, tab_count, font_size
add_tab(title, content)
clear_tabs()
on_change
```

`add_tab(title, content)` takes a title and one widget as the page (usually a
`gui.Frame` filled with children). `selected_title` and `tab_count` are
read-only; switch pages through `selected_index`, and `selected_title` follows
it — it is derived from the index, not stored separately. `on_change` fires
when the user clicks another tab. Coordinates of the page content are measured
from the tab page, not from the window. A widget given to `add_tab()` must NOT
also be passed to `add_child()`: it would then be drawn twice.

`gui.Modal`:

```idyllium
title, message, confirm_text, cancel_text
on_confirm, on_cancel
show_alert()
show_confirm()
show_input()
get_input_value()
```

`show_alert()` shows one OK button, `show_confirm()` adds a cancel button, and
`show_input()` adds a text field whose value is read later with
`get_input_value()`.

`gui.Timer`:

```idyllium
interval
running
on_tick
start()
stop()
restart()
```

`interval` is in milliseconds (`timer.interval = 1000;` ticks once per second).
`running` is a read-only flag. `stop()` pauses the timer and keeps the elapsed
progress; `start()` resumes from that point; `restart()` starts over from zero.

### Widget Callback Signatures

Widget event callbacks (`on_click`, `on_change`, `on_tick`, `on_confirm`,
`on_cancel`) accept either a zero-argument function or a function with one
parameter — the widget itself (the sender). Read the new state from the
sender's properties:

```idyllium
use console;
use gui;

void function volume_changed(gui.Slider sender) {
    console.writeln("Volume: ", sender.value);
}

void function ticked() {
    console.writeln("tick");
}

main() {
    gui.Slider slider;
    slider.on_change = volume_changed;

    gui.Timer timer;
    timer.interval = 500;
    timer.on_tick = ticked;
    timer.start();
}
```

The callback does not receive the new value as a separate argument; there is
no `(sender, value)` form for widgets. Only `gui.Canvas` callbacks receive an
extra event or `delta_time` argument (see the Canvas section).

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

## 25a. Data View Widgets (Table And Charts)

Four widgets for showing data (Idyllium 1.3.2+). All follow normal widget
rules: x/y/width/height, visible/enabled, IdySS `style`, add_child.

```idyllium
gui.Table table;
table.set_columns("Имя", "Класс", "Уровень");   // variadic strings
table.add_row("Мира", "маг", to_string(12));    // one value per column
```

- `gui.Table`: `set_columns(...)` (variadic, resets rows), `add_row(...)`
  (variadic; count must match columns or runtime error), `set_cell(row,
  column, text)`, `remove_row(row)`, `clear()`; read-only `row_count`,
  `selected_row` (−1 when nothing selected); `on_select` callback
  (`void function()` or `void function(gui.Table sender)`) fires on row click.
  Cells are STRINGS — convert numbers with `to_string()`.
- `gui.BarChart`: `add_value(label, value)`, `set_value(label, value)`,
  `clear()`; `bar_color` (one color for all bars; theme accent by default),
  `show_values` (default true), `min_value`/`max_value` (auto-scale unless
  set). Values must be >= 0.
- `gui.LineChart`: `add_value(value)` appends points left-to-right; `clear()`;
  `line_color`, `show_dots` (default true), `min_value`/`max_value` (fix the
  scale for instruments), `max_points` (ring buffer for live charts; 0 = keep
  all). Pair with `gui.Timer` for live dashboards.
- `gui.PieChart`: `add_slice(label, value)`, `set_slice`, `clear()`;
  `show_legend`, `show_percents` (both default true). Percentages and slice
  colors are automatic.

Guards are literal: `Table.add_row() expects 3 values (one per column), got 2`;
`BarChart has no bar 'Хома'`; `PieChart slice value must be >= 0, got -3`;
`LineChart.max_points must be between 0 and 100000, got -1`.

Do NOT invent `load_from_result()` / `load_from_json()` — feed widgets with an
explicit loop over your data.

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
x, y, width, height, visible, enabled
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

`KeyboardEvent.key` values: single characters arrive uppercased (`"W"`,
`"Д"`, `"7"`); special keys use browser names such as `"ArrowLeft"`,
`"ArrowRight"`, `"ArrowUp"`, `"ArrowDown"`, `"Enter"`, `"Escape"`, and `" "`
for the space bar. Compare with uppercase letters: `pressed_keys.contains("W")`,
not `"w"`. `MouseScrollEvent.delta` is `1` for scrolling up and `-1` for
scrolling down.

Canvas callbacks:

```idyllium
void function init(gui.Canvas canvas) {}
void function update(gui.Canvas canvas, float delta_time) {}
void function key_down(gui.Canvas canvas, gui.KeyboardEvent evt) {}
void function key_up(gui.Canvas canvas, gui.KeyboardEvent evt) {}
void function mouse_down(gui.Canvas canvas, gui.MouseEvent evt) {}
void function mouse_up(gui.Canvas canvas, gui.MouseEvent evt) {}
void function mouse_move(gui.Canvas canvas, gui.MouseEvent evt) {}
void function mouse_scroll(gui.Canvas canvas, gui.MouseScrollEvent evt) {}
```

### Drawable Types

Base type:

```idyllium
drawable.Drawable
contains(float x, float y) -> bool
collides_with(drawable.Drawable other) -> bool
```

`contains()` includes the boundary. `collides_with()` treats touching objects as
an intersection and dispatches by the concrete runtime types.

Rectangle, Circle, Sprite, and Text share this transform API:

```idyllium
origin_x: float  // read-only
origin_y: float  // read-only
rotation: float
set_origin(float x, float y)
rotate(float angle)
move(float dx, float dy)
```

`x/y` is the world position of the local origin. The default origin is
`(0, 0)`. Positive angles rotate clockwise. `rotate(angle)` adds to the current
rotation instead of replacing it.

Drawable positions are floating-point values. Rectangle, Circle, Sprite, and
Text use `x: float` and `y: float`; Line uses `x1/y1/x2/y2: float`. Dimensions,
radius, border width, line thickness, and font size remain `int`. GUI widget
coordinates are still `int` and are not affected by this rule.

For a local point at offset `(radius, 0)` from the origin, Canvas coordinates
follow the same clockwise/Y-down convention as the renderer:

```idyllium
float radians = math.to_radians(angle);
point.x = center_x + radius * math.cos(radians);
point.y = center_y + radius * math.sin(radians);
```

Do not negate `sin`, shift the angle, or convert the result to `int`.

`drawable.Rectangle`:

```idyllium
x: float
y: float
width: int
height: int
fill_color: colors.Color
border_width: int
border_color: colors.Color
```

`drawable.Circle`:

```idyllium
x: float
y: float
radius: int
fill_color: colors.Color
border_width: int
border_color: colors.Color
```

Circle local bounds are `(0, 0)..(2 * radius, 2 * radius)`, so with the default
origin its `x/y` denotes the top-left corner of that square. To make `x/y` the
circle center, call `set_origin(radius, radius)` after assigning the radius.

`drawable.Line`:

```idyllium
x1, y1, x2, y2: float
color: colors.Color
thickness: int
move(dx, dy)
```

### Image Resources

Import:

```idyllium
use image;
```

`image.Image` is the common base type accepted by GUI and Canvas consumers.
Its concrete descendants are:

```idyllium
image.Static picture;
image.Animation animation;
```

`image.Bitmap` is a separate mutable raster type. Convert it through
`to_static()` before passing its result to GUI or Canvas.

Common read-only properties:

```idyllium
src: string
width: int
height: int
format: string
has_alpha: bool
is_loaded: bool
```

`format` is detected from file contents, not trusted from the extension.

`image.Static`:

```idyllium
load_from_file(path)
scale(x, y) -> image.Static
rotate(angle) -> image.Static
tint(color) -> image.Static
with_opacity(opacity) -> image.Static
desaturate(amount = 1.0) -> image.Static
crop(x, y, width, height) -> image.Static
export_to_file(path)
```

Transformations return a new image and do not mutate the source. Scale factors
may be positive or negative but not zero. Negative X mirrors horizontally;
negative Y mirrors vertically. Rotation angles must be divisible by 90.
Opacity and desaturation use `0.0..1.0`. A crop rectangle must fit fully inside
the source.

`image.Vector` (SVG, Idyllium 1.3.3+):

```idyllium
load_from_file(path)                    // SVG only; e.g. files from turtle.save_svg()
to_static(width, height = 0) -> image.Static
src: string        // read-only
width: int         // read-only: native size from viewBox / width+height attrs
height: int        // read-only
is_loaded: bool    // read-only
```

`to_static` rasterizes the vector: omit `height` to keep proportions; give
both sizes and the drawing is FITTED without distortion (transparent margins,
like ImageBox contain). Sizes are 1..4096. The result is a normal
`image.Static`, so PNG export is a chain: `v.to_static(512, 512)
.export_to_file("логотип.png")` — do NOT invent `save_png()`. Rasterization
works in the Web IDE and VS Code hosts; in the console host `to_static`
raises `Vector.to_static() is not available in the console host`. Guards:
`cannot decode '...': not an SVG document (expected <svg...>)`,
`Vector.to_static() size must be between 1 and 4096, got 9000`.

`image.Animation`:

```idyllium
frame_count: int
frame_duration: float
has_uniform_frame_duration: bool
load_from_file(path)
get_frame(index) -> image.Static
get_frame_duration(index) -> float
create_from_frames(frames, frame_duration)
export_to_file(path)
```

GIF and APNG files may contain different delays per frame. Use
`get_frame_duration(index)` for arbitrary imported animations.
`frame_duration` is exact when `has_uniform_frame_duration` is true. Animations
created with `create_from_frames()` always have uniform timing, so their total
duration is `frame_count * frame_duration`.

`image.Bitmap` is a mutable RGBA raster for pixel algorithms and generated
images:

```idyllium
is_created: bool // read-only

create(width, height, fill = colors.TRANSPARENT)
load_from_file(path)
create_from_image(source: image.Static)
get_pixel(x, y) -> colors.Color
set_pixel(x, y, color)
fill(color)
fill_rect(x, y, width, height, color)
to_static() -> image.Static
export_to_file(path)
```

Coordinates start at the top-left pixel `(0, 0)`. Dimensions must be positive,
and all pixel and rectangle coordinates must remain inside the raster. A
`Bitmap` loaded or created from `Static` owns an independent pixel copy.
`to_static()` also creates an independent immutable snapshot. Pass that
snapshot to `ImageBox` or `Sprite`; mutable `Bitmap` is intentionally not a
direct GUI or Canvas resource.

Example shared by GUI and Canvas:

```idyllium
use drawable;
use gui;
use image;

image.Static cat;
cat.load_from_file("cat.png");

gui.ImageBox preview;
preview.set_image(cat);
preview.resize_mode = "fit";

drawable.Sprite hero;
hero.set_image(cat);
```

After `load_from_file()` returns, the resource is ready for both consumers.
Never generate `time.sleep()` calls or repeated drawing merely to wait for an
image to decode. GUI Preview redraws itself when its browser-side image becomes
available.

Do not generate the removed APIs `gui.Image` or `drawable.Texture`.

`drawable.Sprite`:

```idyllium
x, y
set_image(image: image.Image)
set_scale(x, y)
```

Sprite collision geometry is the transformed rectangle of the whole image;
transparent pixels are not excluded. Geometry methods report a readable
runtime error before an image is loaded.

`fonts.Font` is the canonical reusable font resource:

```idyllium
use fonts;

src: string       // read-only
format: string    // read-only: "ttf", "otf", "woff", or "woff2"
is_loaded: bool   // read-only
load_from_file(path)
```

The runtime detects the format from file contents rather than its extension.
The same loaded object can be assigned to a GUI widget and to
`drawable.Text`. Font resources are declared only as `fonts.Font`.

`drawable.Text`:

```idyllium
font: fonts.Font
text: string
x, y: float
font_size: int
text_color: colors.Color
get_width() -> float
get_height() -> float
```

Text rendering and collision geometry support origin and rotation. Before
calling `Text.contains()` or `Text.collides_with()`, a custom font is optional:
without one, Idyllium uses its bundled Source Code Pro. User-loaded TTF, OTF,
WOFF and WOFF2 files are all supported. The runtime uses exact advance metrics
and the single-line layout rectangle, not individual glyph outlines. Missing
glyphs and multiline strings produce readable runtime errors instead of
guessed bounds.

`get_width()` and `get_height()` return the same single-line layout dimensions
used by `contains()` and `collides_with()`. They are useful for backgrounds,
alignment, and padding around text.

```idyllium
fonts.Font heading_font;
heading_font.load_from_file("Lobster-Regular.ttf");

drawable.Text heading;
heading.font = heading_font;
heading.text = "New game";
heading.font_size = 48;

bool hovered = heading.contains(mouse_x, mouse_y);
bool touched = heading.collides_with(cursor_circle);
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
    ball.set_origin(30, 30);
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

void function on_key_pressed(gui.Canvas canvas, gui.KeyboardEvent evt) {
    if (not(pressed_keys.contains(evt.key))) {
        pressed_keys.add(evt.key);
    }
}

void function on_key_released(gui.Canvas canvas, gui.KeyboardEvent evt) {
    if (pressed_keys.contains(evt.key)) {
        pressed_keys.remove_at(pressed_keys.find(evt.key));
    }
}

void function on_update(gui.Canvas canvas, float delta_time) {
    if (pressed_keys.contains("W")) { player.y = player.y - 2; }
    if (pressed_keys.contains("S")) { player.y = player.y + 2; }
    if (pressed_keys.contains("A")) { player.x = player.x - 2; }
    if (pressed_keys.contains("D")) { player.x = player.x + 2; }

    canvas.clear();
    canvas.draw(player);
}
```

### Canvas Snapshots

The canvas can hand its current picture back:

```idyllium
image.Static shot = canvas.to_static();               // whole canvas
image.Static part = canvas.to_static(140, 60, 200, 150); // region x, y, w, h
canvas.export_to_file("frame.png");                   // shortcut, format by extension
canvas.save_svg("frame.svg");                         // works everywhere, including console runs
```

Region rules: zeros for width/height mean "to the edge"; an empty region is a
runtime error. The snapshot captures what has been drawn up to that line.
`to_static()` and `export_to_file()` need the host rasterizer (Web IDE);
in console runs they raise a readable error that suggests `save_svg()`.
`save_svg()` serializes the display list and works on every platform — the
right tool for long headless simulations that autosave frames. Limitation:
custom fonts inside SVG snapshots fall back to sans-serif.

## 27. Audio

Import:

```idyllium
use audio;
```

`audio.Sound` is for short sound effects. Multiple `play()` calls may overlap.

WAV and MP3 are the guaranteed teaching formats. OGG, AAC, and M4A may work
when the browser or VSIX Chromium runtime provides the required codec, but
portable Idyllium projects must not rely on them. Idyllium does not transcode
audio files.

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

`pause()`, `resume()`, and `stop()` affect all active copies of the same
`Sound`. `resume()` starts a new copy only when there is no paused copy to
continue. `Sound` intentionally has no `loop` property.

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

`Music.position` is a seek position in seconds and must stay in
`0.0..duration`. Assigning it issues a seek every time, even if the same value
is assigned repeatedly. `play()` starts at the current position, `pause()`
keeps it, `resume()` continues playback, and `stop()` resets it to `0.0`.

`on_finished` runs after natural completion when `loop` is false. It accepts
either a zero-argument callback or a callback receiving the current music:

```idyllium
void function next_track(audio.Music current) {
    console.writeln("Finished: ", current.src);
}

music.on_finished = next_track;
```

When `loop` is true, playback restarts and `on_finished` is not emitted for
each loop. Assigning a volume or position outside its valid range is a runtime
error.

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

## 27a. Turtle Graphics

Import:

```idyllium
use turtle;
```

`turtle.Turtle` draws Logo/Python-style turtle graphics. Declaring a turtle
auto-creates a shared 600×600 window ("Черепашье поле") — do NOT create
`gui.Window` yourself. Coordinates are mathematical: (0,0) is the field
center, Y grows UP, heading 0 points east, `left()` turns counter-clockwise.

```idyllium
use turtle;

main() {
    turtle.Turtle t;
    int i = 0;
    while (i < 4) {
        t.forward(120);
        t.left(90);
        i = i + 1;
    }
}
```

Methods: `forward(px)`, `back(px)`, `left(deg)`, `right(deg)`,
`set_heading(deg)` (turn to an ABSOLUTE angle via the shortest arc),
`goto(x, y)`, `home()`, `pen_up()`, `pen_down()`, `dot(size = 8)`,
`write(text)`, `begin_fill()`, `end_fill()`.

Properties: `pen_color` / `fill_color` (`colors.Color`), `pen_width`
(int 1..100, default 2), `speed` (int 0..10; 0 = instant, default 6 —
movement is animated), `visible` (bool). Read-only: `x`, `y` (float),
`heading` (float degrees), `is_down` (bool).

Module functions (shared field): `turtle.setup(width, height)`,
`turtle.title(text)`, `turtle.bg_color(color)`, `turtle.clear()`,
`turtle.save_svg(path)`.

Notes:

- Multiple turtles share one field (great for races).
- In the CLI host the field is headless: no window appears, but drawing and
  `turtle.save_svg("картинка.svg")` work — turtle programs can run in the
  console course.
- Runtime guards: `Turtle.speed must be between 0 and 10, got 99`;
  `end_fill() without begin_fill()`.

## 28. SQLite

Import:

```idyllium
use sqlite;
```

`sqlite.open(path)` opens an existing SQLite file or creates a new one. Relative
paths are resolved from the running `.idyl` file. The same API works in CLI,
VSIX, and Web IDE; Web IDE stores the binary `.db` file in the virtual project.

Complete example:

```idyllium
use console;
use sqlite;

main() {
    sqlite.Database db = sqlite.open("players.db");
    db.execute(
        "CREATE TABLE IF NOT EXISTS players (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "name TEXT NOT NULL, level INTEGER NOT NULL)"
    );

    sqlite.Statement insert = db.prepare(
        "INSERT INTO players (name, level) VALUES (:name, :level)"
    );
    insert.bind("name", "Mira");
    insert.bind("level", 7);
    insert.execute();
    insert.close();

    sqlite.Result rows = db.execute(
        "SELECT name, level FROM players ORDER BY id"
    );
    while (rows.next()) {
        console.writeln(
            rows.get_string("name"), ": ", rows.get_int("level")
        );
    }

    rows.close();
    db.close();
}
```

`sqlite.Database` read-only properties:

```idyllium
path
is_open
in_transaction
```

Read-only state remains property syntax: use `db.path`, `db.is_open`, and
`db.in_transaction`. Do not invent `db.get_path()` or `db.is_open()` methods.

Methods:

```idyllium
execute(sql)              // exactly one SQL statement -> sqlite.Result
prepare(sql)              // -> sqlite.Statement
exec_script(sql)          // multiple statements, returned rows discarded
begin_transaction()
commit()
rollback()
close()
```

Do not concatenate user input into SQL. Use native SQLite parameters `:name`.
The bind method receives the name without the colon:

```idyllium
stmt.bind("name", value)       // usual form: infer the SQLite storage class
stmt.bind_int("name", value)
stmt.bind_int64("name", value)
stmt.bind_float("name", value)
stmt.bind_string("name", value)
stmt.bind_bool("name", value)
stmt.bind_null("name")
stmt.execute()
stmt.clear_bindings()
stmt.close()
```

Prefer `bind()` for ordinary `int`, `float`, `string`, `char`, `bool`, `null`,
`types` integers, and `sqlite.Value`. Typed methods remain available when the
exact SQLite storage class matters. At runtime `2` and `2.0` are the same
Idyllium numeric value, so use `bind_float("name", 2.0)` when SQLite must store
it as REAL rather than INTEGER.

All declared parameters must be bound before `execute()`. Bindings remain after
execution so a statement can be reused; call `clear_bindings()` before filling
an independent new set. Forms `?`, `@name`, and `$name` are intentionally not
supported by Idyllium's first SQLite API.

`sqlite.Result` read-only metadata:

```idyllium
is_open
has_rows
affected_rows
last_insert_id       // sqlite.Value; null when nothing was inserted
```

Row and column methods:

```idyllium
next()
get(column)          // sqlite.Value
is_null(column)
get_int(column)
get_int64(column)
get_float(column)
get_string(column)
get_bool(column)     // only SQLite INTEGER 0 or 1
column_count()
column_name(index)
close()
```

A result starts before its first row. Call `next()` before any getter. Results
are buffered snapshots and can outlive the statement that produced them.

`sqlite.Value` is nullable and has:

```idyllium
is_null()
is_int()
is_float()
is_string()
to_int()
to_int64()
to_float()
to_string()
to_bool()
```

SQLite INTEGER values are read exactly. Use `get_int64()` / `to_int64()` for
values outside the safe ordinary `int` range. BLOB values do not yet have a
dedicated Idyllium type. Nested transactions and savepoints are not in the
first API.

## 29. Errors

### Runtime Error Handling With `try`

Idyllium handles expected runtime errors with statement-level
`try/catch/finally`. Braces are mandatory. Valid forms are `try/catch`,
`try/finally`, and `try/catch/finally`:

```idyllium
try {
    int age = console.get_int();
    console.writeln("Age: ", age);
} catch {
    console.writeln("Enter an integer");
}
```

Bind a structured read-only error when its details are needed:

```idyllium
try {
    float answer = 10 / 0;
} catch (error) {
    console.writeln(error.message);    // reason only
    console.writeln(error.file);       // project-relative file
    console.writeln(error.line);       // source line
    console.writeln(error.to_string()); // complete diagnostic
} finally {
    console.writeln("Attempt finished");
}
```

The catch variable exists only inside its `catch` block. Its inferred type is
not written in source. The binding and the properties `message`, `file`, and
`line` are read-only; `to_string()` returns a normalized line such as
`main.idyl:7: runtime error: division by zero`.

Only normal Idyllium runtime errors are catchable. That includes the recursion
depth limit (see the `system` library). A compile error prevents the program
from starting, internal JavaScript faults are implementation defects,
`system.exit()` deliberately passes through `catch` (ending the program is the
program's own decision, not an error), and IDE cancellation must pass through
`catch` as well. JavaScript still enters
`finally` while cancellation unwinds the stack, but arbitrary Idyllium runtime
calls are not guaranteed after the host has stopped the program.

`try` is lexical. A block around `win.show()` does not catch an error raised by
a future GUI or Canvas event; put a local `try` inside that callback. There is
currently no user-facing `throw` statement and no typed/multiple catch clauses.

### Read-Only Library Properties

Library objects may expose observable state as read-only properties. Read them
with ordinary property syntax, but never assign to them:

```idyllium
console.writeln(fout.is_open);
console.writeln(db.path);
console.writeln(picture.width, "x", picture.height);

fout.is_open = true;  // wrong: read-only property
db.path = "other.db"; // wrong: read-only property
```

The API uses methods for actions and queries that need arguments, and
properties for simple object state even when that state is read-only.

Prefer examples that produce clear, precise errors. Good error style:

```text
main.idyl:5: runtime error: array index 5 out of bounds (size 3, valid indices 0-2)
main.idyl:7: runtime error: cannot convert input to 'int' (expected integer, got "abc")
main.idyl:10: compile error: cannot assign 'string' value to 'int' variable
```

When generating teaching materials, include both:

- correct code;
- intentionally wrong code with expected error text.

## 30. Do Not Generate These

Do not generate:

```idyllium
i++;
i--;
if (a && b) {}
if (!ok) {}
int r = n % 2;            // wrong: no % operator; use mod(n, 2)
int m = a > b ? a : b;    // wrong: no ternary operator; use if/else
switch (x) { ... }        // wrong: no switch; use if / else if
for (item in items) {}    // wrong: no for-in; iterate by index
string s = "ab" * 3;      // wrong: no string repetition
char c = 'a' + 'b';       // wrong: char + char is an error
string t = "x=" + 5;      // wrong: no implicit number-to-string; use to_string(5)
console.writeln(`x=${x}`); // wrong: no template literals
int x = 23 / 10;          // wrong: / always returns float
label.text = 42;          // wrong: no implicit int-to-string
button.onclick = ...;     // wrong spelling; use on_click
int console = 5;          // wrong: library names are reserved for the library
new Hero();               // wrong: no new keyword; use Hero()
Hero* hero;               // wrong: no pointers
json.NULL                 // removed: use the language literal null
progress.fill_color = colors.RED; // removed: use foreground_color
drawable.Font font;       // removed: use fonts.Font
gui.Image picture;        // removed: use gui.ImageBox + image.Image
drawable.Texture texture; // removed: use image.Image with Sprite.set_image()
label.text_color = "#ff0000"; // wrong: use colors.HEX("#ff0000")
file.ostream out("x.txt");     // wrong: use file.open("x.txt", "write")
out.is_open = true;            // wrong: is_open is read-only
db.get_path();                 // wrong: read the db.path property
std::cout << "hi";        // wrong: not C++
Console.WriteLine(...);   // wrong: not C#
print("hi")               // wrong: not Python
let x = 10;               // wrong: not JavaScript
```

Do not invent dictionaries/maps, async/await, lambdas with arrow syntax,
interfaces, generics for user classes, `throw`/user exceptions, namespaces,
package imports, or operator overloading unless the current project spec
explicitly adds them.

## 31. Good AI Behavior For Idyllium Tasks

When asked to generate Idyllium code:

1. Use `use console;` for console I/O.
2. Use `main() { ... }` for beginner tasks unless the task is explicitly about
   functions/typed `main`.
3. Use four spaces for indentation.
4. Use explicit conversions with `to_int`, `to_float`, `to_string`.
5. Use `x = x + 1` instead of `++` (course style; `+= 1` also compiles).
6. Use `colors.Color` objects for GUI/Canvas colors.
7. For GUI/Canvas, create widgets/objects as normal variables, set properties,
   then call `add_child`, `draw`, or assign callbacks.
8. For modules, access imported user module symbols through `module.name`.
9. Never reuse a standard library module name (`console`, `math`, `gui`, …)
   for a variable, function, or class — the compiler rejects it. Built-in
   function names (`to_string`, `sum`, …) are additionally rejected for
   functions and classes; see Reserved Names.
10. For educational explanations, prefer small steps and clear motivation.
11. If syntax is uncertain, say so and ask for the project spec instead of
    inventing syntax.
12. Treat `BACKLOG.md` and `spec/some_*` as design discussions, not implemented
    syntax, unless the user explicitly asks to discuss those proposals.

## 32. Compact Program Templates

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
    circle.set_origin(30, 30);
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
