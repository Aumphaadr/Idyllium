# Idyllium AI Reference

This file is a compact AI-friendly reference for the Idyllium programming
language. It is intended to be pasted into general-purpose AI chatbots so they
can generate, explain, review, and test Idyllium code.

Current language target: Idyllium 1.6.3.

This reference describes implemented behavior. Ideas from planning documents
and exploratory specs are not language features until they are implemented and
documented here.

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
Only values that explicitly support an absent state may receive or compare
equal to it: the library containers `json.Value` and `sqlite.Value`, and
class-typed fields declared with `= null` ("empty fields", see §15). Ordinary
variables, parameters, arrays, maps, sets, `json.Object` and `json.Array` are
not nullable — `string s = null;` is a compile error.

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
- `const` inside a class declares a class constant (`const int MAX = 6;`),
  accessed as `ClassName.MAX` (see §15); `const` is not a parameter modifier.
- Uppercase names such as `MAX_LEVEL` are a convention, not a parser rule.

Readable diagnostics include:

```text
main.idyl:2:15: compile error: constant 'answer' must have an initializer
main.idyl:3:5: compile error: cannot assign to constant 'answer'
```

A declaration without an initializer creates the value's default:

```idyllium
int count;        // 0
float ratio;      // 0
string name;      // ""
char letter;      // '\0'
bool ready;       // false
array<int, 3> a;  // [0, 0, 0] — N default elements
dyn_array<int> d; // []
map<string, int> m; // {}
set<int> s;       // {}
```

A class-typed declaration (`Hero h;`) creates an object with default field
values and NEVER runs a constructor — not even one callable without
arguments. Constructors run only on an explicit call: `Hero h = Hero(...)` or
`Hero h(...)` (see §15). The same rule covers array elements and fields of
class type.

### Reserved Names

Standard library module names are reserved for every declaration —
variables, parameters, functions and classes:

<!-- @generated:stdlib-module-names -->
```text
audio channel colors console csv drawable encoding file fonts gui hash
http image json math qr random sqlite system time turtle types url web
xml
```
<!-- /@generated:stdlib-module-names -->

```idyllium
int console = 5;   // compile error: variable 'console' conflicts with
                   // a standard library module
```

The reason is unavoidable ambiguity: `console.write(...)` is parsed as module
access, so the same word would mean two things at once.

Names starting with two underscores belong to the language itself — that is
where the runtime keeps object tags and the generated code keeps its own
variables. No declaration accepts such a name: `names starting with '__' are
reserved by the language — pick another name for variable '__x'`. This
covers variables, parameters, functions, fields, methods, events and classes.
Names that merely collide with JavaScript internals (`toString`, `valueOf`,
`hasOwnProperty`) are ordinary identifiers and work as members.

A set of words from the world under the hood is reserved for **bindings**
(variables, parameters, functions, classes) with `'X' is a reserved word and
cannot be used as a name`: `await`, `case`, `debugger`, `default`, `delete`,
`enum`, `export`, `import`, `in`, `instanceof`, `new`, `super`, `switch`,
`throw`, `typeof`, `var`, `with`, `let`, `yield`, `implements`, `interface`,
`package`, `protected`, `arguments`, `eval`, `undefined`. Fields and methods
may still use these words (accessed through an object, they stay harmless).
One member name is the exception: `then` is refused for methods and events
(`the name 'then' is reserved by the language — pick another name for method
'then'` — a `then` method would make the object a thenable and break calls
under the hood). A plain value field named `then` or `undefined` remains
legal. `contract` is a keyword since 1.6.0 (it marks contract methods, §15).
`map` is a keyword (like `array` and `dyn_array`), and `set` is
reserved for bindings (`'set' is reserved for the set type — pick another
name`) while staying a legal member name — `json.Object.set(...)` and your own
`set` methods keep working.

Function names are reserved for functions. Declaring your own function or
class with a built-in global function name (`to_int`, `to_float`, `to_string`,
`type_name`, `max`, `min`, `sum`, `avg`; `div` and `mod` are already
keywords) is a compile error:

```idyllium
int function to_string(int value) { return value; }
// compile error: function 'to_string' conflicts with a built-in function
```

Variables and parameters cannot take function names either — neither a
built-in one nor the name of a function declared in the current file.
Shadowing is rejected at the declaration, because a variable named `sum`
would make every call `sum(...)` in its scope impossible:

```idyllium
int sum = 100;
// compile error: variable 'sum' conflicts with the built-in function 'sum'
```

```idyllium
void function greet() { }

main() {
    int greet = 5;
    // compile error: variable 'greet' conflicts with the function 'greet'
}
```

Class fields and methods are free to use such names (they are always accessed
through an object, so calls stay unambiguous), and a variable may share a name
with a function from another module — those are called as `module.func()`
only:

```idyllium
class Robot {
    contract string function to_string() { ... }   // legal: called as r.to_string()
}
```

Two more corners of the same rule. The name of an imported **user module** is
reserved just like a standard library name (`use helper;` + `int helper = 5;`
→ `variable 'helper' conflicts with the module 'helper'`). And `parent` —
the base-class constructor call — cannot be taken by a file-level function
(`function 'parent' conflicts with the base class constructor call`) or by a
variable inside a child-class constructor; outside child constructors
`parent` is an ordinary identifier and stays a popular name in GUI code.

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

Since 1.6.1 `div` rounds DOWN and the remainder takes the sign of the DIVISOR
(the Python rule, not the C/JavaScript one): `div(-7, 2)` is `-4`, `mod(-7, 2)`
is `1`, `mod(-3, 360)` is `357`, `mod(7, -2)` is `-1`. With a positive divisor
the remainder is never negative, so `mod(n, 2) == 1` finds negative odd numbers
and `mod(i - 1, count)` wraps an index around. `a == div(a, b) * b + mod(a, b)`
always holds. The price: `mod(-123, 10)` is `7`, not `3` — take digits of
`math.abs(n)`. Before 1.6.1 both functions truncated toward zero.

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

Ordering comparisons `<`, `<=`, `>`, `>=` accept numeric operands,
`time.stamp` pairs (ordered by instant), and objects of a class that declares
the matching ordering contract (`less`/`greater`, see §7). Comparing strings
or chars with them
is a compile error that names both offending types (`comparison '<' requires
numeric operands, got 'string' and 'string'`). Strings and chars support only
`==` and `!=`. Special targeted hints: `score =+ 10` → `'=+' is not an
operator — did you mean '+='?` (while `lives =- 5` stays a legal assignment
of -5); a greedy `not` before a comparison (`not coins > 100`) adds `'not'
takes only what stands right after it — write 'not (coins > …)' to negate
the whole comparison`.

### Equality rules

`==`/`!=` compare CONTENT for every comparable type: numbers, strings, chars,
bools, arrays (recursively), maps and sets (by content, ignoring order), `colors.Color` (by channels), `time.stamp` (by
instant — timezone does not participate), `json.Value` (by value, deeply for
object/array payloads; comparing cyclic JSON values is a runtime error
`cannot compare cyclic JSON value`), `sqlite.Value` (by SQL storage class and
value; INTEGER and REAL compare numerically; unlike SQL itself, two SQL NULLs
are equal — `x == null` is the taught idiom).

**Objects of user classes have no built-in equality.** `a == b` on objects is
a compile error unless the class declares the equals contract (a method marked
with the `contract` keyword — all contracts and their shared rules are in §15,
«Contracts»):

```idyllium
contract bool function equals(Hero other) {
    return this.name == other.name and this.level == other.level;
}
```

With the contract, `a == b` and `a != b` dispatch to it; so do `contains`,
`find`, `count` on arrays of that class, and `==` on such arrays (structural,
per cell). Without it: `cannot compare objects of class 'Hero' with '==' —
declare 'contract bool function equals(Hero other)' in class 'Hero' and the comparison
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

**Ordering contracts (`less` and `greater`).** Objects of user classes have
no built-in ordering either; `<`/`>`/`<=`/`>=` on objects are compile errors
unless the class declares the matching ordering contract — same shape as
`equals`, same rules (static dispatch by the left operand's declared type,
NOT inherited, keep it pure):

```idyllium
contract bool function less(Hero other) {
    return this.level < other.level;
}
```

With `less` declared, `a < b` dispatches to it and `a >= b` is its negation
(`not a.less(b)`); `sort()` on arrays of that class also unlocks and sorts by
`less` (stable: elements the contract cannot tell apart keep their original
order). Without it: `cannot order objects of class 'Hero' with '<' — declare
'contract bool function less(Hero other)' in class 'Hero' and '<' will use it`
(`sort()` says `sort() cannot order 'Hero' objects — …`). The `greater`
contract works the same way and serves the other sign pair: `a > b` dispatches
to `greater`, `a <= b` is its negation. The contracts are independent — `less`
alone covers `<`, `>=` and `sort()`; `greater` alone covers `>` and `<=`;
nothing is derived from the other one, and nothing checks that a class
declaring both keeps them consistent.

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

The size must be known before the program runs. Write an integer literal, a
named integer constant (`const`, including a class constant), or a **sum,
difference or product** of those; plain variables are rejected at compile time:

```idyllium
const int SIZE = 5;
const int PAD = 2;
array<int, SIZE> cells;          // ok
array<int, SIZE * SIZE> board;   // ok — 25
array<int, SIZE + PAD> row;      // ok — 7
array<int, Board.W * Board.W> b; // ok — class constants too
// int n = 6; array<int, n> bad; // compile error: must be a 'const'
```

Division is not accepted, and neither is anything the compiler cannot fold:

```text
compile error: array size must be known before the program runs: write a number, a constant declared with 'const', or their sum, difference or product
compile error: array size 'n' must be an integer constant declared with 'const'
compile error: array size must be non-negative, got -1
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

`sort()` is honest about what has an order: numbers sort numerically, strings
and chars alphabetically, bools `false` before `true`, `time.stamp` values by
instant, and objects of a user class by its `less` contract (§7, stable).
Everything else is refused at compile time instead of being sorted by its
printed text: `sort() cannot order arrays of arrays — sort each inner array on
its own`, `sort() cannot order 'colors.Color' values — they have no order`
(same for `map`/`set` elements), `sort() cannot order 'Hero' objects — declare
'contract bool function less(Hero other)' …`. `contains`/`find`/`count` on arrays of
objects need the `equals` contract (§7); on arrays of arrays, maps or sets they
compare the nested collections by content.

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

Array sizes are capped: creating or resizing beyond 100000000 elements is a
readable runtime error (`array size 2000000000 is too large to create (maximum
100000000)`), a fixed size that large is a compile error.

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

### Maps: `map<K, V>`

A map is a dictionary — a value collection like arrays, with the same rules
(copy on assignment, on passing and on return; indexing edits the stored
element in place). Always two type parameters, read as "from K to V":

```idyllium
map<string, int> ages = {"Mira": 12, "Kai": 9};   // literal, type from context
map<int, string> ranks;                            // empty by default
map<string, dyn_array<int>> marks;                 // any value type, nesting allowed
ages["Tasya"] = 15;                                // insert or replace
ages["Mira"] = ages["Mira"] + 1;                   // read; a missing key is a runtime error
int c = ages.get_or("Homa", 0);                    // read with a fallback
count[word] = count.get_or(word, 0) + 1;           // the counting idiom
```

Keys: **`int`, `string`, `char` or `bool`** — types whose equality is exact and
built in. `float` keys are refused for good (`cannot use 'float' as a map key —
float numbers are almost never exactly equal; use int or string`), and so are
objects of user classes (`cannot use objects of class 'Hero' as map keys — use a
field with an int or string value`). `int` keys stay exact beyond 2^53. Reading
an absent key is a loud error: `map has no key "Homa"`; `remove` of an absent key
fails the same way. A duplicate key inside a literal is a compile error
(`duplicate key "Mira" in map literal`).

Members: `length` (read-only), `has(key)`, `get_or(key, fallback)`,
`remove(key)`, `keys()` → `dyn_array<K>`, `values()` → `dyn_array<V>` (both in
insertion order, both copies), `clear()`, `join(other)` (adds every pair of
`other`; on a shared key `other` wins). There is no `add`/`set` — brackets do
that — and no `sort()`: iteration order is insertion order, sort `keys()` when
you need order. `map` is a keyword.

Equality `==`/`!=` compares content **ignoring order** (`{"x": 1, "y": 2} ==
{"y": 2, "x": 1}` is true); values compare with their own equality — objects
through the `equals` contract, otherwise `cannot compare maps of 'Hero' values
with '=='…`. Printing gives `{"Mira": 12, "Kai": 9}` (int keys bare:
`{1: "gold"}`; empty: `{}`); object values need the `to_string` contract, as in
arrays. Ordering signs and `sort()` on arrays of maps are refused: maps have no
order.

### Sets: `set<T>`

A set keeps each element once, in insertion order. Same value rules as
arrays and maps (copy on assignment, on passing and on return), same element
border as map keys — `int`, `string`, `char` or `bool` (`cannot use 'float' as
a set element — …`, `cannot use objects of class 'Hero' as set elements — …`).
`set` is a contextual word: it names the type only as `set<T>`, so methods
called `set` (like `json.Object.set`) keep working; a variable, parameter,
function or class named `set` is refused (`'set' is reserved for the set type
— pick another name`).

```idyllium
set<int> seen = {3, 1, 2};      // literal; a duplicate inside a literal is a compile error
seen.add(2);                    // already there — nothing happens
seen.add(5);
console.writeln(seen);          // {3, 1, 2, 5}
console.writeln(seen.has(1));   // true
seen.remove(1);                 // an absent element is a runtime error: set has no element 9
dyn_array<int> sorted = seen.values();   // insertion order, a copy
sorted.sort();
```

Members: `length`, `add(value)`, `has(value)`, `remove(value)`, `clear()`,
`values()` → `dyn_array<T>`, and pure set algebra that returns a new set —
`union(other)`, `intersection(other)`, `difference(other)` — plus
`is_subset(other)`. There is no indexing (`sets have no index — use has() or
values()`), no `join` and no `sort()`. Equality ignores order (`{1, 2} == {2,
1}`); ordering signs and `sort()` on arrays of sets are refused.

Empty braces `{}` are an empty collection whose kind comes from the declared
type: `map<string, int> m = {};` and `set<int> s = {};` are both fine, while
`console.writeln({})` or `s == {}` is a compile error (`empty {} needs a
declared map or set type`).

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

A file without `main()` — a library module — cannot be run. Every host (Web
IDE, VS Code, CLI) refuses instead of "finishing" silently:
`В файле helper.idyl нет функции main() — запускать нечего.` Run the file that
imports it.

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

Every callback property checks the shape of the function it receives. A widget
callback accepts either `void function()` or `void function(<the widget's own
type>)` — the `sender` parameter must be the widget's class, not another
widget: `callback property 'on_click' expects 'void function()' or
'void function(gui.Button)', got 'void function(gui.Label)'`. The same check
guards `on_change` of every editable widget (`gui.LineEdit`, `gui.SpinBox`,
`gui.Slider`, `gui.CheckBox`, `gui.ComboBox`, …), the Canvas and Timer
callbacks and `on_message` of `channel.Post`; assigning a non-function is
refused too (`callback property 'on_change' expects a function, got 'int'`).

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
Hero ghost;                       // constructor NOT called: fields are "" and 0
Hero named = Hero("Mira", 100);   // constructor called explicitly
Hero short_form("Mira", 100);     // parenthesized declaration also calls it
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

### Contracts: Methods Called By A Sign (`contract`)

A **contract** is a class method that the language calls itself: a sign or
printing uses it, not only its name. Since 1.6.0 every contract is marked with
the keyword `contract` — the same idea as `event`: a member you declare, while
the language decides when it runs. The marking is MANDATORY.

| contract | shape | used by |
|---|---|---|
| `to_string` | `contract string function to_string()` | printing, `to_string(obj)`, arrays and maps of such objects |
| `equals` | `contract bool function equals(Hero other)` | `==`, `!=`, `contains`/`find`/`count`, `==` on arrays and maps of such objects |
| `less` | `contract bool function less(Hero other)` | `<`, `>=`, `sort()` |
| `greater` | `contract bool function greater(Hero other)` | `>`, `<=` |
| `plus` | `contract R function plus(T other)` | `+`, `+=` |
| `minus` | `contract R function minus(T other)` | binary `-`, `-=` |
| `multiply` | `contract R function multiply(T other)` | `*`, `*=` |
| `divide` | `contract R function divide(T other)` | `/`, `/=` |
| `opposite` | `contract R function opposite()` | unary `-` |

The name of a sign contract is the word the sign is read aloud with, without the
auxiliary preposition: `less` (not `less_than`), `multiply` (not
`multiplied_by`), `opposite` for «the opposite of a».

Rules shared by all contracts:

- Public, non-static, declared IN the class itself. Contracts are NOT
  inherited: an heir declares its own next to the base's — the only case where
  an "override" may change the signature. Dispatch is STATIC: the declared type
  of the left operand (the printed value, the receiver) picks the contract.
- Contract names are reserved in classes. A method named `equals`, `plus`, … 
  without the keyword is a compile error: `'equals' is a contract name — write
  'contract bool function equals(Hero other)' and '==' and '!=' will use it, or
  pick another name`. File-level functions are not affected.
- The shape is checked AT THE DECLARATION, once — the places where the sign is
  used stay silent about the same problem:
  `contract 'less' has a wrong shape: its parameter is 'A' instead of 'B', it
  returns 'int' instead of 'bool' — write 'contract bool function less(B
  other)'`; `contract 'greater' cannot be private — '>' and '<=' are written
  outside the class; move it to the public part`; `a contract cannot be static —
  it works on an object ('a == b', 'a + b')`; `'contract' marks a method — a
  field cannot be a contract`; `'contract' marks a method of a class — a
  function outside a class cannot be a contract`.
- The keyword on a foreign name: a habit from another language is answered
  with the right word — `'add' is not a contract — the contract for '+' is
  called 'plus'` (likewise `sub` → `minus`, `times`/`mul`/`product` →
  `multiply`, `divided_by` → `divide`, `negate` → `opposite`, `str` →
  `to_string`, `eq` → `equals`, `lt` → `less`, `gt` → `greater`); any other name
  gets the full list: `'show' is not a contract — contracts are: to_string,
  equals, less, greater, plus, minus, multiply, divide, opposite`.
- A contract may still be called by name: `a.less(b)`, `a.plus(b)`.
- Contracts answer, they do not mutate (see the warning below).

**Arithmetic contracts** (`plus`, `minus`, `multiply`, `divide`, `opposite`):

- One signature per sign per class (Idyllium has no overloading). The
  parameter type and the result type are FREE: `contract Vec function
  multiply(float k)` gives `v * 2.5` (and `v * 2` — the usual int→float
  promotion of an argument); a dot product may return `float`. The type of
  `a * b` is the result type of `multiply`. The shape only demands exactly one
  parameter (none for `opposite`) and a non-void result.
- The contract belongs to the LEFT operand, and no silent swap is made — for
  `-` and `/` a swap changes the meaning. `2 * v` → `operator '*' cannot be
  applied to 'int' and 'Vec' — a contract works for the LEFT operand, and 'int'
  has none ('Vec' declares 'multiply', but it stands on the right)`. Write
  `v * 2`.
- A wrong right operand: `operator '*' cannot be applied to 'Vec' and 'Vec' —
  'Vec.multiply' accepts a 'float', got 'Vec'`. No contract at all: `operator
  '+' cannot be applied to 'Money' and 'Money' — declare 'contract Money
  function plus(Money other)' in class 'Money' and '+' will use it`; unary:
  `unary '-' cannot be applied to 'Money' — declare 'contract Money function
  opposite()' in class 'Money' and unary '-' will use it`. With a habitual name
  in the class: `… — class 'Vec' has 'add', but the contract for '+' is called
  'plus': write 'contract Vec function plus(Vec other)'`. For an heir: `… —
  'Vec.multiply' is a contract, and contracts are not inherited: declare
  'contract Vec3 function multiply(float k)' in class 'Vec3'`.
- Compound assignment comes for free: `a += b` IS `a = a + b` through the same
  contract (the result must be assignable to `a`). It REBINDS the name to the
  new object; an alias taken before (`Vec c = a;`) keeps the old one — exactly
  as with numbers.
- Precedence and associativity never change: `a + b * 2 - -a` is
  `a.plus(b.multiply(2)).minus(a.opposite())`.
- `"text" + obj` stays a compile error (a string is glued only with strings) —
  use `to_string(obj)`.
- Objects are references, so a contract that writes to `this` (or to its
  parameter) would silently change `a` in `c = a - b`. The compiler warns:
  `contract 'minus' changes the object it was called on — after 'c = a - b' the
  value of 'a' must stay the same; build a new object and return it`
  (`… changes its operand 'other' …` for the parameter). Always build a NEW
  object in an arithmetic contract.
- `sum(xs)` of an array of objects whose class declares `plus` adds them with
  that contract, starting from the first element (`plus` must take and return
  the class itself; an empty array is a runtime error, as for numbers):
  `sum() cannot add 'Vec' objects — declare 'contract Vec function plus(Vec
  other)' in class 'Vec' and sum() will use it`. `avg`, `max` and `min` stay
  numeric-only for objects.
- There are no contracts for `div`, `mod`, a unary `+` (the language has none)
  or powers.

```idyllium
use console;

class Vec {
    float x;
    float y;

    constructor Vec(float ex_x, float ex_y) {
        this.x = ex_x;
        this.y = ex_y;
    }

    contract Vec function plus(Vec other) {
        return Vec(this.x + other.x, this.y + other.y);
    }

    contract Vec function multiply(float k) {
        return Vec(this.x * k, this.y * k);
    }

    contract Vec function opposite() {
        return Vec(-this.x, -this.y);
    }

    contract string function to_string() {
        return "(" + to_string(this.x) + "; " + to_string(this.y) + ")";
    }
}

main() {
    Vec a = Vec(1, 2);
    Vec b = Vec(3, 4);
    console.writeln(a + b * 2);   // (7; 10)
    console.writeln(-a);          // (-1; -2)
    a += b;
    console.writeln(a);           // (4; 6)
}
```

### Printing Objects: The `to_string()` Contract

Passing a class object to `console.write`/`console.writeln` is a compile error
(`cannot print object of class 'Cat' directly — declare 'contract string function
to_string()' in class 'Cat' and printing will use it`) unless the class
declares the contract `contract string function to_string()` (public, no
parameters; a wrong shape is refused at the declaration — see Contracts above).
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

    contract string function to_string() {
        return "(" + to_string(this.x) + ", " + to_string(this.y) + ")";
    }
}

main() {
    Point p;
    console.writeln(p); // (0, 0)
}
```

An array of objects nests freely: the contract is applied at any depth, so
`dyn_array<dyn_array<Point>>` prints as `[["(0, 0)"]]`. Without the contract
the refusal names the element class (`cannot print an array of 'A' objects
directly — declare 'contract string function to_string()' in class 'A' and printing
will use it`).

Functions are not printable either: `console.writeln(abs_value)`
— a forgotten-parentheses mistake — is a compile error (`cannot print function
'abs_value' — add '()' with its arguments to call it and print the result`);
the same guard covers `to_string(fn)`, file writes and `json.Value(fn)`.

### Access Modifiers

`public:` and `private:` use a colon and apply until the next modifier or the
end of the class. Members declared **before the first modifier are public** —
a class that never writes a modifier is fully open.

The lock sits on the CLASS, not on the object: a method may read and write the
private members of ANOTHER object of the same class. Without this rule
`equals`, comparisons and swaps could not be written at all:

```idyllium
class Thermostat {
private:
    int temperature;

public:
    constructor Thermostat(int ex_temperature) {
        this.temperature = ex_temperature;
    }

    bool function warmer_than(Thermostat other) {
        return this.temperature > other.temperature;   // legal: same class
    }
}
```

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
    array<int, Cat.MAX_KITTENS> basket;  // int class constants work as array sizes,
                                         // alone or in a sum/difference/product
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

Two things classes cannot do, each refused in one line (since 1.6.0):

- **No inheriting from a built-in type.** `class Money extends int` →
  `cannot inherit from built-in type 'int' — keep a value of this type inside
  the class as a field instead` (the same for `float`, `string`, `bool`,
  `char`, `array`, `dyn_array`, `map`, `set`). Composition plus contracts is
  the way to make a class behave like a number.
- **No method overloading.** A second method with the same name in one class →
  `method 'scale' is already declared in class 'Vec' — Idyllium has no
  overloading: one name, one method`.

The base class does not have to live in the same file. Both of these work:

```idyllium
use zoo;   // zoo.idyl defines class Lion
use gui;

class Cub extends zoo.Lion {        // base from a user module
    constructor Cub(string ex_name) {
        parent(ex_name);            // runs zoo.Lion's constructor
    }
}

class CounterButton extends gui.Button {   // base is a gui widget
    int clicks = 0;

    void function press() {
        this.clicks = this.clicks + 1;
        this.text = "Clicked: " + to_string(this.clicks);
    }
}
```

Module-class inheritance follows the ordinary rules: `parent(...)`, base
fields and methods are inherited, `private` members of the base stay
private, static members are NOT inherited (`zoo.Lion.population`, never
`Cub.population`).

Widget inheritance has its own contract:

- Only ordinary widgets can be extended: `gui.Button`, `gui.Label`,
  `gui.Frame`, `gui.CheckBox`, `gui.RadioButton`, `gui.LineEdit`,
  `gui.TextEdit`, `gui.ProgressBar`, `gui.Slider`, `gui.SpinBox`,
  `gui.ComboBox`, `gui.ImageBox`. `gui.Window`, `gui.Canvas`, `gui.Timer`,
  dialogs and non-gui library types (`json.Value`, `time.stamp`, …) are a
  compile error.
- The heir IS the widget: it has all widget properties/callbacks plus its
  own fields and methods, goes straight into `add_child(...)`, renders and
  fires events exactly like its base. `type_name()` reports the heir class
  name (`CounterButton`).
- Widgets have no constructor, so `parent()` in a widget heir is a compile
  error — configure properties instead. An heir constructor
  (`constructor CounterButton(...)`) is allowed and typically sets
  properties / builds children.
- A field or method may not reuse a base widget member name
  (`'text' is already a member of gui.Button — pick another name`).
- The canonical compound widget extends `gui.Frame`: child widgets as
  fields, assembly in the constructor via `this.add_child(...)`, methods
  attached as callbacks (`this.slider.on_change = this.refresh;`).

Chains and modules follow the same contract: a grandchild of `gui.Button`
is still a real button (renders, fires events, joins radio groups), and a
widget heir declared in a user module is a full widget for the importer.
Member names of the widget stay taken all the way down the chain, events
included (`event on_click` in an heir is a compile error).

An override must keep every promise the base class made:

- the same parameter types and the same result type (contracts are the single
  exception — an heir declares its own `equals(Heir other)` or
  `plus(Heir other)` next to the base's, see «Contracts» above);
- the base's parameter defaults — `greet(string who = "мир")` in the base
  and `greet(string who)` in the heir is a compile error, because
  `base.greet()` would then reach a body that has nothing to put in `who`.
  The heir may pick a DIFFERENT default, and that default wins even through a
  base-typed variable, because the value is filled by the method that actually
  runs: with `hi(int n, int extra = 0)` in `A` and `hi(int n, int extra = 5)`
  in `B`, `A a = b; a.hi(2)` prints `B 2 5`. C++ binds defaults statically and
  would print `B 2 0` — the difference matters when porting examples;
- the base's visibility — a public method may not become `private` in the
  heir (through a base-typed variable it would be callable anyway);
- a `private` method of the base cannot be overridden at all: an object has
  one slot per name, so the heir's body would silently replace the machinery
  the base calls on itself;
- a name taken by an `event` of the base cannot be reused by a method.

A class imported from a user module behaves exactly like the same class
written in one file: the override rules above hold across the module border
(`method 'Cub.roar' cannot be private — it overrides a public method of
class 'zoo.Lion'`), and contracts (`to_string`, `equals`, `less`, `greater`,
`plus`, `minus`, `multiply`, `divide`, `opposite`) still do not travel to heirs — the refusal is a compile error on both sides of
the module border.

`parent()` says what is wrong instead of "function not declared":
`parent() runs the constructor of the base class and can only be called in
the constructor of class 'Dog'`; `class 'Alone' has no base class —
parent() needs 'extends'`. A private base constructor stays private for
heirs too — inheritance is not a way around `private`.

Note on printing: objects of the library (`gui.*`, `fonts.Font`,
`drawable.*`, streams) have no text form and printing them is a compile
error — `cannot print an object of type 'gui.Button' directly — library
objects have no text form; print one of its properties instead`. Library
VALUES print as before: `types.*` cells, `colors.Color`, `time.stamp`,
`json.Value`/`json.Object`/`json.Array`/`sqlite.Value`, plus the library
objects that carry their own text form: `turtle.Turtle`, `gui.Canvas`,
`gui.Table`, `gui.BarChart`, `gui.LineChart`, `gui.PieChart`,
`image.Vector`, `channel.Post`, `web.Server`/`web.Request`/`web.Response`
and `http.Response`. An array of objects with a `to_string` contract prints
through that contract at any nesting depth.

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
| `map` / `set` | copy, like arrays (indexing a map edits the stored value in place; object values are shared) | by content, ignoring order |
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

Import:

```idyllium
use system;
```

```idyllium
system.set_recursion_depth(depth)   // void
system.recursion_depth()            // int
system.exit(code = 0)               // void, never returns
system.platform()                   // "cli" | "web" | "vscode"
system.version()                    // "1.6.3"
system.set_warnings(enabled)        // void; switches runtime warnings off/on
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
math.gcd(a, b)       // greatest common divisor; gcd(-12, 18) = 6, gcd(0, 0) = 0
math.lcm(a, b)       // least common multiple; 0 when either argument is 0
math.factorial(n)    // exact at any size: factorial(100) prints all 158 digits; n is 0..10000
math.is_prime(n)     // exact answer (no "probably prime") for n up to 3317044064679887385961980, larger n is a runtime error
math.divisors(n)     // dyn_array<int> ascending: divisors(12) = [1, 2, 3, 4, 6, 12]; n >= 1
math.sign(value)     // -1, 0 or 1; int for int, float for float (like abs)
math.hypot(a, b)     // sqrt(a² + b²) — distance between points without squaring by hand
```

Angles for trigonometric functions are in radians. The integer helpers (since
1.5.6) take `int` arguments only — `math.gcd(2.5, 3)` is a compile error
(`'gcd' argument 1 expects 'int', got 'float'`) — and follow the exact-int
rule: `math.gcd(123456789123456789123456789, 987654321987654321)` is exact.
Out-of-range arguments are readable runtime errors: `math.factorial() n must
be between 0 and 10000, got -1`, `math.divisors() n must be a positive number,
got 0`.

Result types: `math.abs` keeps the argument's numeric type (`int` stays `int`,
`float` stays `float`). `math.round`, `math.floor` and `math.ceil` return `int`
when called with one argument and `float` when the optional digits argument is
provided. `math.clamp` returns `int` when all three arguments are integers,
otherwise `float`. `math.sign` mirrors `math.abs`; `gcd`, `lcm`, `factorial`
return `int`, `is_prime` returns `bool`, `divisors` returns `dyn_array<int>`.
The remaining math functions return `float`.

### Complex Numbers: `math.Complex` (since 1.6.0)

```idyllium
use console;
use math;

main() {
    math.Complex z = math.Complex(3, 4);      // 3 + 4i;  math.Complex() is 0, math.Complex(3) is 3
    math.Complex w = math.polar(2, math.pi / 2);   // modulus and argument (radians): 2i
    math.Complex unit = math.I;               // the imaginary unit; math.I * math.I == -1

    console.writeln(z + w, "  ", z * w, "  ", z / w, "  ", -z);   // 3 + 6i  -8 + 6i  2 - 1.5i  -3 - 4i
    console.writeln(2 * z, "  ", z + 1, "  ", 1 / unit);            // 6 + 8i  4 + 4i  -i
    console.writeln(z.re, " ", z.im, " ", z.abs(), " ", z.arg());  // 3 4 5 0.92729522
    console.writeln(z.conjugate(), "  ", z.pow(2), "  ", z.sqrt()); // 3 - 4i  -7 + 24i  2 + i
    console.writeln(math.Complex(1).roots(4));                      // [1, i, -1, -i]
}
```

`math.Complex` is a VALUE, like a number: `re` and `im` are read-only, every
operation returns a new number, `math.Complex z;` without a call is zero.

- **Arithmetic by signs.** `+ - * /`, unary `-`, and `+= -= *= /=` work through
  the same contracts as user classes (`plus`, `minus`, `multiply`, `divide`,
  `opposite` — callable by name too). Division by zero is a runtime error
  (`division by zero`).
- **The numeric ladder `int → float → math.Complex`.** A real number takes part
  as a complex one with a zero imaginary part — exactly as `int` is promoted to
  `float`: `2 * z`, `z + 1`, `1 / math.I` and `math.Complex five = 5;` all work,
  in arguments and array cells too (`dyn_array<math.Complex> zs = [1, math.I];`).
  There is no way back: `float x = z;` → `cannot assign 'math.Complex' value to
  'float' variable` — take `z.re` or `z.abs()`. This promotion is a privilege
  of the library type; user classes keep the «left operand» rule of §15.
- **Parts and forms:** `re`, `im`, `abs()` (modulus), `arg()` (principal value,
  radians, in (−π; π]; `0` for zero), `conjugate()`, `to_string()` (`3 + 4i`,
  `-2.5i`, `i`, `0`), `to_polar_string()` (`5(cos 0.92729522 + i sin
  0.92729522)`). Printing rounds the parts like ordinary numbers and obeys
  `console.set_precision`; an array prints as `[1, i, -1, -i]`.
- **Powers and roots:** `pow(exponent)` — an integer exponent is computed by
  exact repeated multiplication (De Moivre without the cos/sin error:
  `math.I.pow(2)` is exactly `-1`), any other exponent gives the principal value
  `exp(w · ln z)` (`math.I.pow(math.I)` is `0.20787958`); `sqrt()` — the principal
  root (`math.Complex(-4).sqrt()` is `2i`); `roots(n)` — ALL n roots as a
  `dyn_array<math.Complex>`, starting from the principal one counter-clockwise.
- **Elementary functions** are methods: `exp()`, `ln()` (principal value; of
  zero — a runtime error), `sin()`, `cos()`, `tan()`, `sinh()`, `cosh()`. The
  functional form works too: `math.sqrt(z)`, `math.abs(z)` (a `float` — the
  modulus), `math.sin(z)`, `math.cos(z)`, `math.tan(z)`, `math.log(z)` (the
  principal `ln`) and `math.pow(z, w)` accept a complex argument and return
  `math.Complex` (`math.abs` returns `float`); with real arguments they stay
  real. `math.floor(z)` and the rest remain real-only.
- **Aggregates.** `sum(zs)` and `avg(zs)` of an array of complex numbers are
  complex (real cells are promoted); `max`/`min` are refused — no order.
  An empty array is a runtime error, as for numbers.
- **Comparison.** `==`/`!=` compare both parts exactly (a real number compares
  as `re` with `im == 0`) and warn the same way floats do: `complex numbers are
  compared with '==' — computed values are almost never exactly equal; use
  is_close()`. `z.is_close(w, epsilon = 0.000000001)` is the working tool:
  `math.Complex(0, math.pi).exp().is_close(-1)` is `true`. There is NO order on
  complex numbers, and the language says so: `complex numbers have no order, so
  '<' cannot compare them — compare abs(), re or im instead`; `sort()` refuses
  too.
- Readable runtime errors: `math.polar() modulus cannot be negative, got -1 — a
  negative sign belongs to the argument (add math.pi)`, `math.Complex.ln() of
  zero does not exist`, `math.Complex.roots() expects a positive integer degree,
  got 0`, `zero cannot be raised to a negative power`.
- Values built from a modulus and an argument (`polar`, `roots`, `exp`) drop the
  rounding noise of cos/sin below 10⁻¹⁵ of the modulus, so the fourth roots of
  one are exactly `1, i, -1, -i` and `e^(iπ)` prints as `-1`.

## 18. Library `random`

```idyllium
use random;

int a = random.create_int(1, 10);
float b = random.create_float(0.0, 1.0);
char symbol = random.choose_from("ABCDEF");

array<string, 3> names = ["Liam", "Mira", "Raven"];
string name = random.choose_from(names);

dyn_array<int> deck = random.shuffle(cards);   // since 1.5.5
string anagram = random.shuffle("secret");

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

`random.shuffle(x)` (since 1.5.5) takes a string or any array and returns a
SHUFFLED COPY of the same type — the original is untouched (arrays are values
in Idyllium; unlike Python's in-place `random.shuffle`). Write
`xs = random.shuffle(xs);` to shuffle "in place". A bare
`random.shuffle(xs);` statement drops the copy and triggers a compile
warning. Strings are shuffled by visible characters (surrogate pairs stay
whole); empty and one-element collections come back as is. The order obeys
`random.set_seed()`.

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

Modes:

- `"read"`
- `"write"`
- `"append"`

**Encoding (since 1.5.7).** `file.open(path, mode, encoding)` takes an optional
third argument — any name from `encoding.list_encodings()`; without it the
file is UTF-8. Reading is strict: a file in another encoding is not turned
into `�` silently but refused by name, with a guess attached — `file.open()
cannot read 'notes.txt' as utf-8: invalid UTF-8 at byte 1 (0xF0): invalid
continuation byte — the file looks like windows-1251; open it with
file.open(path, "read", "windows-1251")`. A UTF-8 BOM is skipped when
reading. Writing in a code page refuses unrepresentable characters
(`ostream.write_line() character 'П' is not valid ASCII at position 0`);
`"append"` works in any encoding.

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

dyn_array<string> names = encoding.list_encodings();   // 41 names, grouped by family
int codepoint = encoding.char_to_codepoint('б'); // 1073
char ch = encoding.codepoint_to_char(1073); // 'б'
dyn_array<int> bytes = encoding.encode("кот", "utf-8");   // a string or a char
string text = encoding.decode(bytes, "utf-8");
bool ok = encoding.is_valid(bytes, "windows-1251");        // can these bytes be decoded?
dyn_array<int> moved = encoding.convert(bytes, "utf-8", "koi8-r");   // decode + encode in one call
string guessed = encoding.guess(bytes);                    // "utf-8", "windows-1251", … or ""
string packed = encoding.to_base64(bytes);                 // Base64 text
dyn_array<int> unpacked = encoding.from_base64(packed);
```

Encodings (since 1.5.7) — the same 38 code pages and Unicode forms as the
companion site «Кодировки символов» (Charsets), plus `utf-16` / `utf-32`
"with byte order mark". `list_encodings()` returns them in family order:

- **DOS**: `cp437`, `cp850`, `cp852`, `cp855`, `cp857`, `cp866`;
- **Windows**: `windows-1250` … `windows-1258` (`windows-1251` Cyrillic,
  `windows-1252` Western, `windows-1254` Turkish, …);
- **ISO 8859 and ASCII**: `ascii`, `iso-8859-1` … `iso-8859-16` (numbers
  1–10, 13–16; `iso-8859-5` is Cyrillic);
- **KOI-8 and Macintosh**: `koi8-r`, `koi8-u`, `mac-roman`, `mac-cyrillic`;
- **Unicode forms**: `utf-8`, `utf-16`, `utf-16le`, `utf-16be`, `utf-32`,
  `utf-32le`, `utf-32be`.

Names are case-insensitive and accept the usual aliases (`cp1251`,
`win1251`, `ibm866`, `dos866`, `latin1`…`latin10`, `iso8859-5`, `koi8r`,
`macintosh`, `x-mac-cyrillic`, `utf8`, `utf16`). An unknown name is a runtime
error with a hint: `unknown encoding 'koi-8r' — did you mean 'koi8-r'?` or
`… — see encoding.list_encodings()`. The tables live inside Idyllium and are
identical on every host (CLI, Web IDE, VS Code).

A Unicode code point is independent of its encoded byte sequence:
`б` is code point `1073`, but its UTF-8 bytes are `[208, 177]`.
`char_to_codepoint()` accepts exactly one Unicode character;
`codepoint_to_char()` accepts Unicode scalar values `0..1114111`, excluding
the surrogate range `55296..57343`.

**Strictness.** `encode()` and `decode()` never invent data: an unrepresentable
character (`character 'Ю' is not valid ASCII at position 0`), malformed UTF-8
(`encoding.decode() invalid UTF-8 at byte 0 (0xD0): incomplete sequence`), an
unassigned byte of a code page (`byte 129 is not valid windows-1252 at index
0` — 0x81 has no character in cp1252), an odd UTF-16 tail (`invalid utf-16le
at byte 2: half of a code unit`) or a lone surrogate are runtime errors with
the position. The optional `safe` parameter (default `true`) turns losses
into marks instead: with `safe=false` unrepresentable characters encode to
`?` (byte 63) and undecodable bytes become `�` — one `�` per bad byte, so
Windows-1251 bytes read as UTF-8 give ten diamonds for ten letters:

```idyllium
string mojibake = encoding.decode(bytes, "utf-8", safe=false);
```

**Unicode forms and BOM.** `utf-16le`/`utf-16be`/`utf-32le`/`utf-32be` are
byte-order-fixed and have no mark. `utf-16` and `utf-32` are "with BOM":
`decode` reads the mark to pick the byte order and refuses bytes without one
(`utf-16 needs a byte order mark — use utf-16le or utf-16be for bytes without
one`); `encode` writes the mark plus little-endian (what Windows Notepad calls
"Unicode"). `decode(…, "utf-8")` is literal: a leading BOM stays in the string
as U+FEFF (`file.open` strips it when reading files, see §20).

**Helpers.** `is_valid(bytes, encoding)` is the check-before-decode in the
`json.is_valid` / `is_int()` genre. `convert(bytes, from, to, safe=true)`
re-encodes in one call. `guess(bytes)` returns `"ascii"` for pure ASCII,
`"utf-8"` for valid UTF-8 (or a UTF-8/16/32 BOM), one of the Cyrillic pages
(`windows-1251`, `koi8-r`, `cp866`, `mac-cyrillic`, `iso-8859-5`, `koi8-u`)
when the bytes read as ordinary Russian text with lowercase letters, and `""`
when it is not sure — it never pretends to know (a few bytes or ALL-CAPS
shouting are not enough). `to_base64(bytes)` / `from_base64(text)` are the
transport encoding of bytes (letters, digits, `+`, `/`, `=` padding);
`from_base64` skips whitespace and refuses foreign characters or a length not
divisible by 4. Base64 is not a character encoding and is not in
`list_encodings()`.

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
  wrong method → 405; handler crash → a NEUTRAL 500 page for the visitor, the error
  text goes only to the program console (the server keeps running); `app.debug =
  true;` (since 1.6.1) puts the error text into the response too — for the author
  while developing. Requests are
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

## 21f. Library `qr` (since 1.6.2)

A QR code as an array, as a picture and as text. Works the same in CLI, Web IDE
and the VS Code extension; not available in embed units.

```idyllium
use image;
use qr;

dyn_array<dyn_array<bool>> grid = qr.encode("Привет!");        // grid[row][column] == true — a dark cell
dyn_array<dyn_array<bool>> tough = qr.encode("Привет!", "H");  // error-correction level
image.Static picture = qr.to_static("Привет!");                // black on white, 8 px per cell, margins included
image.Static big = qr.to_static("Привет!", 12, "quartile");    // scale and level
bool ok = qr.fits("a long text…");                              // will it fit (checked before the refusal)
int limit = qr.capacity("M");                                   // BYTES the level can hold

bool found = qr.has_code(picture);                              // is there a readable code
string text = qr.decode(picture);                               // the text of the code
```

- `qr.encode(text, level = "M")` returns a SQUARE table without margins; its
  side is `grid.length` — 21 cells for a short text and up to 177 as the text
  grows (5 chars → 21, 50 → 33, 300 → 69 at level M). The table is
  deterministic: the same text and level always give the same cells, so a lesson
  may quote it. Whoever draws the code must add the light margin himself — at
  least 4 cells wide — or scanners will not find it; this is a deliberate
  teaching point, not an omission.
- The level is a string: `"L"`, `"M"`, `"Q"`, `"H"` or the words `"low"`,
  `"medium"`, `"quartile"`, `"high"` (exactly these spellings). A higher level
  survives more damage and makes a bigger code: a blot in the middle that kills
  a level-L code leaves a level-H code readable.
- `qr.to_static(text, scale = 8, level = "M")` returns an ordinary
  `image.Static` with the standard 4-cell margin: show it in `gui.ImageBox`,
  draw it as a `drawable.Sprite`, save it with `export_to_file("code.png")`.
  `scale` is 1–64 pixels per cell; the picture may not exceed 4096 px.
- Text is ALWAYS encoded as UTF-8, so Russian letters and emoji read correctly
  on a phone. That is why capacity is counted in BYTES: a Latin letter or digit
  is one byte, a Russian letter two, an emoji four. `qr.capacity(level)`:
  `"L"` 2953, `"M"` 2331, `"Q"` 1663, `"H"` 1273.
- `qr.decode(picture)` and `qr.has_code(picture)` accept `image.Static` and
  `image.Bitmap`. They read picture files and screenshots, including a light
  code on a dark background; a hand-held photo taken at an angle is NOT
  promised. There is no camera.
- Runtime refusals: `qr.encode() text is too long for level "M": 2400 bytes, the
  limit is 2331 — shorten the text or use a lower level`, `qr.encode() level must
  be "L", "M", "Q", "H" or "low", "medium", "quartile", "high", got "X"`,
  `qr.to_static() scale must be between 1 and 64, got 0`, `qr.decode() found no
  QR code in the picture — check qr.has_code() first`.

The console-year program — two nested loops (two characters per cell, because
a console character is twice as tall as it is wide). A small code printed this
way (21×21) IS scanned by a phone camera from the Web IDE console (verified by
the project owner). Do not promise more than that: a bigger code may not fit
the output pane, console cells are not exactly square and block glyphs have
gaps — our own `qr.decode` does not read a screenshot of such output. A code
that must scan reliably is drawn on a `gui.Canvas` — one `drawable.Rectangle`
per dark cell on a white `fill`, with a 4-cell margin — or taken from
`qr.to_static()`:

```idyllium
use console;
use qr;

main() {
    dyn_array<dyn_array<bool>> grid = qr.encode("Idyllium");
    for (int row = 0; row < grid.length; row = row + 1) {
        for (int column = 0; column < grid[row].length; column = column + 1) {
            if (grid[row][column]) {
                console.write("██");
            } else {
                console.write("  ");
            }
        }
        console.writeln();
    }
}
```

Not in the library on purpose: classes with the standard's internals (version,
mask), coloured codes and logos (draw them from the table yourself), numeric and
alphanumeric modes, Micro QR, SVG output (draw the cells on a `gui.Canvas` and
call `save_svg`).

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

`null` is a language literal, but it is assignable only where an absent value
is explicitly supported: `json.Value`, `sqlite.Value`, and class-typed fields
declared with `= null` (§15). Primitive types, ordinary object variables,
`json.Object`, and `json.Array` do not accept it.
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

A wrong-kind read is a runtime error in the words of the LANGUAGE (since 1.6.1),
and it gives the ADDRESS of the value — the path walked from the root through
`get(key)` and `at(index)` (since 1.6.2; 1.6.1 named only the last key): `json value "name" is string, expected int`, `json
value "hero.stats.level" is float, expected int` (a fractional number is never
truncated), `json value "hero.items[1]" is string, expected int`, `json value
"[1]" is …` for an element of a top-level array; a value that came straight
from `json.parse` has no address. `to_string()` is an UNPACKER of a JSON string,
not «the text form»: on a number it refuses and says where the text form is —
`json value is int, expected string — to_string() only unpacks a string; the
text of any value is to_string(value)`.
A key repeated inside one object is refused by `json.parse` — `json.parse()
invalid JSON: key "a" is repeated in one object at line 1, column 14` — instead
of the usual silent «last one wins»; `json.is_valid` returns `false` for it.

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

## 24a. Library `xml` (since 1.5.4)

Reading markup — strict XML and forgiving HTML — into a tree of nodes:

```idyllium
use xml;

main() {
    xml.Node feed = xml.parse_xml("<feed><item><title>Новости</title><link>https://a</link></item></feed>");
    dyn_array<xml.Node> items = feed.find_all("item");
    for (int i = 0; i < items.length; i = i + 1) {
        console.writeln(items[i].first("title").text, " → ", items[i].first("link").text);
    }
}
```

- `xml.parse_xml(text)` — strict XML. A markup mistake stops the program with the
  position inside the parsed text: `xml.parse_xml() invalid XML at 1:11: closing
  tag '</a>' does not match open tag '<b>'`; unquoted attribute values,
  never-closed tags, duplicate attributes, text outside the root and anything
  but exactly one root element are errors too. Tag names are case-sensitive, and
  the refusal says so (`'<B>' is open, and XML tag names are case-sensitive`).
  Since 1.6.1 a bare `&` is refused as well (`a bare '&' is not allowed in XML —
  write '&amp;'`), and so are unknown named entities (`&copy;` — XML knows only
  `&amp; &lt; &gt; &quot; &apos;` and numeric ones; `&nbsp;` alone is tolerated,
  real feeds are full of it) and broken numeric ones (`&#65a;`, `&#xD800;`). `parse_html` keeps all of these as literal text.
- `xml.parse_html(text)` — forgiving HTML for real-web pages: unclosed `<li>`
  and `<p>`, void `<img>` without a pair, unquoted attributes, any tag case
  (names are lowercased, and search arguments are lowercased to match),
  `<script>`/`<style>` bodies are kept as raw text, a bare `<` in text stays
  text, and a page torn mid-tag (an interrupted download) still parses.
- Both entries skip comments, `<!doctype>` and `<?xml?>`, turn CDATA into
  text, decode `&amp; &lt; &gt; &quot; &apos; &nbsp;` and numeric `&#…;`
  entities. The parse result's root node has `tag == "#document"`.

`xml.Node` (all read-only):

```idyllium
tag, text, children
attr(name)      // attribute value, "" when absent
has_attr(name)
find_all(tag)   // all descendants with this tag, any depth; empty list is fine
first(tag)      // first such descendant; runtime error when absent
has(tag)
```

`text` collects the text of the whole subtree with entities decoded;
whitespace-only chunks between tags are dropped. `children` holds element
nodes only. `first` on a missing tag is a loud error in the `json.Object.get`
genre — `xml node <item> has no <title> inside`; guard with `has()` when the
tag is optional. Deliberately out of scope: namespaces, XPath, CSS selectors,
DTD and serialization — the library is for reading.

## 24b. Library `csv` (since 1.5.6)

Tables with separators — files from Excel, Google Sheets and teaching
datasets. The first line is the header; cells are addressed by row number
(from 0, header not counted) and column NAME. Every cell is a `string`:
convert with `to_int()` when reading and `to_string()` when writing, exactly
as with `gui.Table`.

```idyllium
use console;
use csv;

main() {
    csv.Table heroes = csv.read("heroes.csv");          // or csv.parse(text)
    console.writeln(heroes.columns);                     // ["имя", "класс", "уровень"]
    for (int i = 0; i < heroes.row_count; i = i + 1) {
        console.writeln(heroes.get(i, "имя"), ": ", to_int(heroes.get(i, "уровень")) + 1);
    }
    int row = heroes.find("имя", "Кай");                // first row with that cell, -1 if none
    if (row >= 0) {
        heroes.set(row, "уровень", "10");
    }
    heroes.add_row("Тася", "лучник", "15");              // exactly one value per column
    csv.write("heroes.csv", heroes);
}
```

- `csv.parse(text)` / `csv.parse(text, separator)`, `csv.read(path)` /
  `csv.read(path, separator, encoding)` → `csv.Table`; `csv.write(path, table, encoding)`
  overwrites the project file (`\n` line ends, no BOM). The optional
  `encoding` (default `"utf-8"`) reads and writes files of Russian Excel:
  `csv.read("excel.csv", encoding="windows-1251")`, `csv.write("out.csv", t,
  "windows-1251")`. Reading is strict, like `file.open` (§20): a file in the
  wrong encoding is refused by name with a guess attached.
- **Separator** is detected from the header line (`;` of Russian Excel, `,`,
  tab — the most frequent wins, `;` when none) and stored in
  `table.separator` (a writable one-character string); `to_string()` and
  `csv.write()` use it, so a file does not silently change dialect. The
  optional second argument forces a separator.
- **Quotes** follow CSV rules: a quoted cell may contain the separator, line
  breaks and a doubled quote `""`. `\r\n`, `\n` and `\r` line ends are all
  accepted; a leading BOM (Excel) is skipped; empty lines are skipped.
- `csv.Table` (a library OBJECT — assignment shares, like `json.Object`):
  read-only `row_count`, `column_count`, `columns` (copy, `dyn_array<string>`);
  `separator`; methods `set_columns(...)` (variadic; clears rows),
  `add_row(...)` (variadic; exactly one value per column), `get(row, column)`,
  `set(row, column, text)`, `row(index)` and `column(name)` (copies),
  `has_column(name)`, `find(column, text)` → row index or -1,
  `remove_row(index)`, `clear()` (rows only, header stays), `to_string()`.
  Printing a table (`console.write(t)`) gives the same CSV text.
- A table declared without a call (`csv.Table t;`) is empty with separator
  `;`; `csv.parse("")` is an empty table too (no columns, no rows).
- Errors are loud and named: `csv.parse() line 3 has 4 values, but the header
  has 3 columns` (a short row is padded with empty cells instead — nothing is
  invented, but nothing is dropped either), `csv.parse() header has duplicate
  column "имя"`, `csv.parse() line 2: quote is never closed`, `csv.parse()
  line 2: unexpected text after a closing quote`, `csv table has no column
  "x"`, `csv.Table.get() row 5 is out of range 0..2`, `csv.Table.add_row()
  expects 3 values (one per column), got 2`, `csv.Table.add_row() before
  set_columns() — set the columns first`, `csv.Table.separator must be one
  character (like ";" or ","), got ";;"`, `csv.read() cannot read 'x.csv':
  file does not exist`, `csv.write() cannot write 'nodir/x.csv': directory
  does not exist`.
- Do not invent `csv.Row` objects, `for (row in table)`, `table[0]["имя"]`,
  numeric cells or `to_json()` — none of that exists.

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
- `style_hover`, `style_active` and `style_disabled` hold stickers that apply
  while the pointer is over the widget, while it is pressed, and while it is
  switched off (`enabled = false`). Same dictionary, same silence about typos;
  the state sticker is layered on top of `style` and lifts by itself when the
  state ends.

Supported properties — 44 of them, everything else is ignored. Pixel values
accept `12px` or plain `12`.

- **Colors and background:** `color`, `background-color`, `background`
  (gradients only, see below).
- **Borders:** `border-color`, `border-width` (0-20), `border-style`
  (`solid`/`dashed`/`dotted`/`none`), `border-radius` (0-100), and the same
  colour/width/style trio per side — `border-top-*`, `border-bottom-*`,
  `border-left-*`, `border-right-*`.
- **Outline** (a ring that does not move the content): `outline-color`,
  `outline-width` (0-20), `outline-style`.
- **Text:** `font-size` (6-96), `font-weight` (`normal`/`bold`), `font-style`
  (`normal`/`italic`), `font-family` (`sans`/`serif`/`mono` only — arbitrary
  font names are dropped), `text-align` (`left`/`center`/`right`),
  `text-decoration` (`none`/`underline`/`line-through`), `text-transform`
  (`none`/`uppercase`/`lowercase`/`capitalize`), `letter-spacing` (−5…20),
  `line-height` (0.8-3, unitless).
- **Spacing:** `padding` (0-40) and `padding-top`/`-bottom`/`-left`/`-right`.
- **Shadows:** `box-shadow` and `text-shadow` take EXACTLY four parts in this
  order — `<offset-x> <offset-y> <blur> <color>` (offsets −50…50, blur 0-50).
  `inset`, shadow lists and `spread` are not accepted.
- **Motion:** `transition-duration` (`0`…`2s`, or `0`…`2000ms`) makes
  `style_hover`/`style_active` fade instead of snapping; `rotate` (−360…360
  degrees) and `scale` (0.1-5). **`rotate` and `scale` change how the widget
  LOOKS, not where it is:** the clickable box stays the original rectangle, so
  a rotated button is still clicked by its unrotated outline.
- **Behaviour:** `opacity` (0.0-1.0), `cursor`
  (`default`/`pointer`/`text`/`wait`/`not-allowed`/`help`), `user-select`
  (`auto`/`none`/`text`/`all` — button-like widgets ship with `none` by
  default; set `user-select: text` to restore selection).

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
`salmon` are NOT supported. There is no geometry (`width`/`margin`/`position`
— place and size belong to the widget's own properties), no shorthand
`border: 2px solid red` (use the three separate border properties), no
`content`, no `animation`, no `calc()` and no `var()`.

### GUI Types

`gui.Window`:

```idyllium
x, y, width, height, title, theme, text_color, background_color, font, font_size
on_close
add_child(child)
show()
close()
```

`close()` removes the window from the program. When the last window closes the
program has no GUI left and the host finishes it — that is how an «Выход»
button is written. The close cross in the preview does the same for its own
window only: with several windows shown the program keeps running until the
last one is closed.

`on_close` (since 1.6.1) turns the cross into a QUESTION. A handler shaped
`bool function()` or `bool function(gui.Window sender)` answers it: `true` —
the window closes, `false` — it stays open («save the file first»). A handler
without a result (`void function()` / `void function(gui.Window sender)`) only does its
job (writes the file) and the window closes. `close()` called from code does
NOT ask `on_close` — the program has already decided; that is how «ask in a
`gui.Modal`, close from `on_confirm`» is written: return `false` from
`on_close`, show the modal, call `win.close()` in its `on_confirm`. The host's
Stop button does not call `on_close` either.

```idyllium
bool saved = false;

bool function ask_before_close() {
    return saved;          // false keeps the window open
}

main() {
    gui.Window win;
    win.on_close = ask_before_close;
    win.show();
}
```

`x` and `y` are the window's position on the preview "desktop". Until the
program assigns them, windows are laid out automatically — in a row, wrapping
when the row runs out. The user can also drag a window by its titlebar, like
in a real OS: after the drag `x`/`y` hold the new position, so the program
reads where the window actually is. Assigning `x`/`y` from code moves the
window there.

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
click()
```

`click()` (since 1.6.2) presses the button from code: its `on_click` runs exactly
as from a mouse click, with the same `sender`. Use it when one action is reached
both by the button and by something else — a key, a timer, the window cross
(`win.on_close`). A disabled or hidden button (or one inside such a container)
is not pressed, just as for a person; with no `on_click` nothing happens. If the
handler takes no parameters, calling the handler function directly is the same.

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
`max = 100`, `step = 1`. Since 1.6.1 assigning `value` outside `min..max` from
code IS a runtime error — `SpinBox.value must be between 1 and 10, got 99 — set
min and max first` — so set the bounds FIRST, then the value (`max = 300;` then
`value = 150;`). A bound that would leave an explicitly assigned value outside
is an error too (`SpinBox.max = 5 leaves the current value 7 outside the range
— change value first`); the untouched default value quietly follows the bounds
(`min = 10` alone moves the default `0` to `10`). Nothing is clamped silently.
USER input always respects the bounds:
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
- `gui.PieChart`: `add_slice(label, value)`, `set_slice(label, value)`, `clear()`;
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

**Frame model (since 1.6.1): the picture ACCUMULATES**, as in Processing, SFML
or an HTML canvas. A frame erases nothing by itself: whatever was drawn — in
`on_init`, in event handlers, in earlier `on_update` calls — stays until the
program covers it. `fill(color)` with an opaque color wipes everything (start
every ordinary frame with it), `clear()` returns the canvas to its
`background_color` (black when not set — the canvas also starts that way). A
forgotten `fill` leaves a trail behind moving shapes; a translucent
`fill(colors.RGBA(0, 0, 0, 0.1))` each frame gives a fading trail (a full-canvas
translucent rectangle drawn each frame behaves the same). As on any 8-bit
canvas, such a trail never fades to exactly nothing — a faint ghost stays.
Accumulation is cheap on screen (since 1.6.2): the preview keeps the picture
between frames and receives only the new commands, so a frame costs what was
drawn in that frame, not everything since the start. The full command list
still lives in the program (it is what `save_svg` and `to_static` read), so a
program that never uses an opaque `fill` or `clear()` slowly grows in memory —
an opaque `fill` at the start of a frame is still the normal way to draw. Before 1.6.1 every `on_update` started from
an empty black canvas.

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
coordinates are still `int` and are not affected by this rule. Since 1.6.1 a
negative `width`, `height`, `radius`, `border_width` or `thickness` is a runtime
error (`Circle.radius must be non-negative, got -5`); zero is legal.

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

WAV, MP3 and OGG are the accepted formats, and the format is detected from the
file's **signature**, not from its extension — renaming a file does not change
what it is. Anything else (AAC, M4A, or a file that is not audio at all) is
refused when it is loaded:

```text
runtime error: Sound.load_from_file() cannot decode 'fake.wav': unsupported audio format (WAV, MP3 and OGG are supported)
```

WAV and MP3 are the guaranteed teaching formats: OGG passes the signature gate
everywhere, but playback still needs a codec from the host. Idyllium does not
transcode audio files. The signature check is a gate, not a full decode — a
truncated but correctly-headed file loads and reports `duration` 0.

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

### Composed sound: `audio.Melody`

A sound that is not in any file: the program composes it from notes and the
runtime synthesizes the clip (four waveforms — an honest "game console" sound,
not a piano). Behaves like `Sound` (copies overlap) plus `loop`; works on
every host, and `export_to_file()` writes a real WAV even in console runs.

```idyllium
use audio;
use gui;

audio.Melody tune;

main() {
    tune.instrument = "square";          // "sine" (default) | "square" | "triangle" | "saw"
    tune.tempo = 120;                    // beats per minute; note lengths are in beats
    tune.add_note("до", 1);              // до ре ми фа соль ля си or C…B; octave digit after the name
    tune.add_note("фа#5", 0.5);          // # and b for semitones; no digit = 4th octave ("ля" = 440 Hz)
    tune.add_rest(0.5);
    tune.add_frequency(440, 1);          // raw hertz (20–20000) — physics of sound, game beeps
    tune.add_notes("ми ми фа соль | соль фа ми ре | до:2 -:1");   // text: note[:beats], "-" rest, "|" decoration
    tune.volume = 0.6;
    tune.loop = false;
    console.writeln(tune.duration);      // seconds, from tempo and beats
    tune.play();                         // like Sound: pause(), resume(), stop(), is_playing
    tune.export_to_file("tune.wav");     // project file; also in the CLI
    tune.transpose(12);                  // all notes an octave up (-48…48 semitones)
    tune.clear();
}
```

Rules: `duration` is read-only; `instrument` is a strict enumeration
(`Melody.instrument must be 'sine', 'square', 'triangle' or 'saw', got
'piano'`); `tempo` 20–400; limits 30 seconds and 2000 notes per melody
(`Melody.add_note() the melody would be 50 seconds long — the limit is 30;
split it into several melodies`); a wrong note name is a runtime error with
the recipe (`Melody.add_note() unknown note 'дo' — write до, ре, ми, фа,
соль, ля, си (or C…B), then an octave digit and # or b, like "фа#5"`);
`play()` on an empty melody refuses (`the melody is empty — add notes
first`); `export_to_file()` requires a `.wav` name. Changing notes, tempo or
instrument after `play()` does not affect copies already playing. Piano
idiom: seven one-note melodies created at startup, no files in the project.
Do not invent `add_chord`, drums, MIDI numbers or `Melody.load_from_file`.

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

`sqlite.open(path)` opens an existing SQLite file or creates a new one. There
are no in-memory databases: `sqlite.open(":memory:")` is refused in words (since
1.6.1; before that it silently created a FILE named `:memory:`). Relative
paths are resolved from the running `.idyl` file. The same API works in CLI,
VSIX, and Web IDE; Web IDE stores the binary `.db` file in the virtual project.

Foreign keys are ENFORCED from the moment a database opens (Idyllium runs
`PRAGMA foreign_keys = ON` for you — plain SQLite keeps it off for historical
reasons). Inserting a row whose FOREIGN KEY points at a missing parent fails
with `FOREIGN KEY constraint failed`. A student may switch the check off and
back with `PRAGMA foreign_keys = OFF;` / `= ON;` — the choice survives writes.

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
has_rows             // true only when at least one row came back
affected_rows
last_insert_id       // sqlite.Value; null when nothing was inserted
```

`has_rows` is `true` when the result holds **at least one row**, and `false`
for an empty `SELECT` as well as for statements that return no rows at all
(`INSERT`, `UPDATE`, `DELETE` — those report through `affected_rows`). It is
therefore the direct answer to "did anything match", and reading it does not
consume the result — rows are materialised when the statement runs, so `next()`
still starts from the first row:

```idyllium
    sqlite.Result rows = db.execute("SELECT name FROM players WHERE level >= :min");
    if (rows.has_rows) {
        while (rows.next()) {
            console.writeln(rows.get_string("name"));
        }
    } else {
        console.writeln("никого нет");
    }
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

Printing a `sqlite.Value` shows the value itself (since 1.6.1):
`console.writeln(rows.get("level"))` prints `7`, a REAL prints `2.5`, TEXT
prints its text, NULL prints `null` — also inside arrays and maps. The METHOD
`value.to_string()` stays strict (the hint below — since 1.6.2), exactly like `json.Value.to_string()`: it
unpacks TEXT and nothing else. On an INTEGER it refuses and points to the text
form: `sqlite value is integer, expected string — to_string() only unpacks
TEXT; the text of any value is to_string(value)` (the global function);
`rows.get_string("level")` says the same with the column name. NULL gets no
such hint — its text `null` is almost never what the author wanted; use
`is_null()`.

SQLite INTEGER values are read exactly. Use `get_int64()` / `to_int64()` for
values outside the safe ordinary `int` range. BLOB values do not yet have a
dedicated Idyllium type. Nested transactions and savepoints are not in the
first API.

## 28b. Warnings

Since 1.5.4, Idyllium has a THIRD kind of message besides
`compile error` and `runtime error`: warnings. The rule that draws the line
(owner's verdict): code that breaks a convention of the language is an
**error**; code that merely **does nothing** gets a **warning** and still
compiles and runs. Warnings never change the exit code.

Labels are symmetric with errors: `compile warning` and `runtime warning`.

Compile warnings (printed with `file:line:column`):

```text
compile warning: this line computes a value and does not use it        // a + 1;  "text";  a == 2;
compile warning: assigning a variable to itself changes nothing        // a = a;
compile warning: this line can never run — the function returns above  // code after return (also: break/continue variants)
compile warning: variable 'x' is never used
compile warning: two float numbers are compared with '==' — they are almost never exactly equal
compile warning: comparing a bool with 'true' changes nothing          // flag == true
compile warning: this condition is always true                          // if (true); while (false) says "always false"
compile warning: the value returned by 'damage' is not used            // user functions/methods only
```

Scope notes, so generated examples stay warning-free:

- `while (true)` with `break` is the canonical endless loop — no warning.
- Library calls may drop their result freely (`db.execute("INSERT …")`) —
  only USER functions and class methods warn when the result is dropped. The
  one library exception is `random.shuffle(xs);`: it returns a shuffled COPY,
  so dropping the result is always a mistake and warns.
- `variable is never used` fires only for primitive-typed variables whose
  initializer performs no call and no indexing: `file.ostream f = file.open(…)`
  or `int x = console.get_int();` never warn (the initializer already did real
  work), and neither do objects, widgets or arrays (creating them IS the work).
- When the file has compile ERRORS, warnings are suppressed entirely — fix the
  first error, then the warnings come back.

Runtime warnings are emitted when the program ends, without file:line:

```text
runtime warning: the program finished without showing a window
runtime warning: a widget ('gui.Button') was created but never added to a window
runtime warning: file 'notes.txt' was not closed
```

The file warning is about hygiene — the data itself IS on disk. Warnings can
be switched with `system.set_warnings(false)` / `system.set_warnings(true)`
(default: on); switching off silences
only runtime warnings (compile warnings are printed before the program runs).

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
main.idyl:10:13: compile error: cannot assign 'string' value to 'int' variable
```

The two shapes differ on purpose: a runtime error carries `file:line`, a
compile error also carries the column — `main.idyl:5: runtime error: …`
against `main.idyl:5:12: compile error: …`.

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

Do not invent async/await, lambdas with arrow syntax, interfaces, generics for
user classes, `throw`/user exceptions, namespaces, package imports, or operator
overloading beyond the contracts of §15 (there is no `operator+`, no
`__add__`, no free operator functions — a sign reaches a class only through a
`contract` method). Maps and sets DO exist (`map<K, V>`, `set<T>`, §10) — but do not
invent methods for them beyond the listed ones (no `items()`, no `for (k in m)`,
no `m[k] += 1` on a missing key, no `set` indexing).

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
12. This reference describes the shipped language. Anything not described
    here (a library, a method, a syntax form) should be treated as absent
    until the user shows it in a lesson or the reference site.

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
