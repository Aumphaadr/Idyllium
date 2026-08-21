# Idyllium Contrast Reference — Part 1: The Console Year

This file catalogs the **quiet errors and broken logic that mainstream
languages inflict on beginners**, topic by topic, and states **what Idyllium
does instead**. It is the first part of a planned series that follows the
course ladder:

| Part | Scope | Compared against |
|---|---|---|
| **1 (this file)** | **Console year: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files** | **Pascal, C++, Python, JavaScript** |
| 2 | GUI widgets: windows, buttons, fields, timers, events | Lazarus/Forms, Qt Widgets, tkinter, DOM+JS |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| 5 | JSON: parsing, building, saves | nlohmann/json, `json` module, native JS |
| 6 | Databases: SQLite, queries, records | sqlite3 bindings in C++/Python/JS |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-site-ai-reference.md` (how the site is *built*). This file explains
**why the language is shaped the way it is** — every strictness documented here
is an answer to a specific classroom injury.

Every Idyllium message quoted below is
verbatim output of the compiler, captured from a probe program. Behavior of
other languages is described as of their mainstream implementations
(FPC/Delphi-style Pascal, C++11 and later, CPython 3.x, ES2015+ browsers).

---

## 0. The axiom: silence is the enemy

The single organizing principle of this document:

> **An error that announces itself is a lesson. An error that stays silent is
> damage.** A beginner cannot distinguish "my program is correct" from "my
> program is wrong in a way this language chose not to mention". Every quiet
> wrongness teaches a mental model that *works* — and that model has to be
> unlearned later, at much higher cost.

A language aimed at beginners therefore has exactly two acceptable behaviors
for anything a child can plausibly write:

1. **Do the human-expected thing.** `23 / 10` is `2.3`; `"белый"` is five
   characters; `true` prints as `true`.
2. **Refuse loudly, in readable words, pointing at the line.** No silent
   truncation, no silent coercion, no `undefined`, no "value from someone
   else's memory", no `0` substituted for input the user never typed.

The third behavior — *do something surprising and say nothing* — is what this
document catalogs in other languages.

### The five design criteria behind the language

These predate Idyllium; they came out of years of teaching Pascal, C++ and
Python to 10–15-year-olds, and the language was built to satisfy them:

1. **One logic throughout.** A construct learned in month one keeps its meaning
   in month nine; the student is not asked to memorize dozens of contextual
   exceptions.
2. **No ambiguity.** No operator whose meaning depends on the types around it.
3. **High associativity.** Keywords map onto ordinary, guessable English words
   (`function`, `while`, `read`, `write`) — not `Rewrite`-means-open-for-write.
4. **No black boxes.** No construct that "just works" and can only be explained
   after years of experience (`while (getline(fin, S))`, `for line in f`).
5. **Concepts visible in the code.** If a student must define "variable",
   "type", "array", "function" on an exam, the code on screen must *show* the
   thing being defined — not hide it behind inference.

---

## 1. How to read the entries

Every topic below has the same shape:

- **The child writes** — the plausible beginner code that triggers the problem.
- **What other languages do** — a table with one row per language. The
  behavior class is marked:
  - **QUIET** — wrong or surprising result, no diagnostic. The dangerous class.
  - **LOUD** — refuses or errors out with a message. Acceptable, even when
    the message itself is poor.
  - **CRYPTIC** — errors, but with a message a beginner cannot decode
    (`invalid syntax`, `Runtime error 106`, `segmentation fault`).
  - **OK** — behaves as a human would expect; nothing to fix.
- **Idyllium's answer** — with the verbatim compiler or runtime message.

A note on fairness: this document is about *teaching beginners*. Several
behaviors listed as problems here are deliberate, defensible engineering
decisions in their languages — C's integer division is fast and predictable,
JavaScript's coercion keeps web pages alive. The criticism is strictly
"what does this do to a twelve-year-old forming their first mental model".

---

## 2. Program template — the first screen

**The child writes** their very first program and has to copy some amount of
ceremony before the one line that actually does something.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | `program name;` + `begin`/`end.` — three structural lines, all pronounceable. Oddity: the program ends with a period, not a semicolon; blocks end with `end;`. |
| C++ | CRYPTIC | Four lines of ceremony (`#include <iostream>`, `using namespace std;`, `int main()`, braces) before the first meaningful statement. `cout`, `endl`, `include`, `namespace` are not guessable words; `int` in front of `main` cannot be explained on day one. |
| Python | OK | An empty file and `print('Hello')`. The best possible first screen. |
| JavaScript | QUIET | `console.log('Hello')` prints into a console the student must first *find* (DevTools); until they do, output goes nowhere with no indication. `alert`/`prompt` are a second, modal output world. Semicolons are optional (ASI), so the language itself does not know whether it is strict. |

**Idyllium's answer:**

```idyllium
use console;

main() {
    console.writeln("Привет!");
}
```

- `use console;` is a *meaningful* line, not ceremony: "this program uses the
  console". It is the same word the student will later write for `file`,
  `random`, `gui`.
- `main()` carries no `int`, no `void`, no `return 0`. There is nothing on the
  first screen that cannot be explained on the first day.
- There is one output channel, and it is the one the student is looking at:
  no second modal world, no console hidden behind a browser shortcut.

---

## 3. Variables — declaration versus assignment

**The child writes:**

```
A = 20      // is this creating a variable or changing one?
A = 60
```

The exam question "what is a variable?" requires that the two operations
*look* different. Where they do not, students answer "a letter that equals a
number" for years.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK / QUIET | `var A: integer;` versus `A := 20;` — visibly different, type visible. But identifiers are **case-insensitive**: `A` and `a` are the same variable, silently. |
| C++ | OK | `int A;` versus `A = 20;`. Case-sensitive. Type visible. |
| Python | QUIET | Declaration does not exist; `A = 20` and `A = 60` are the same glyphs for two different concepts, and the type is never written anywhere. A **typo creates a brand-new variable** with no diagnostic: `summa = 0` then `sumaa = 5` — two variables, no error. |
| JavaScript | QUIET | `let A = 20;` versus `A = 60;` — the distinction exists and is visible (better than Python). But without `'use strict'`, a **missing `let` silently creates a global**, and a typo silently creates another one. Three declaration keywords (`var`, `let`, `const`) with different scoping appear mixed in any code found online. |

**Idyllium's answer** — declaration and assignment differ visually, the type is
always written, and neither typos nor case slips can pass:

```idyllium
int a = 20;   // declaration: type is part of the line
a = 60;       // assignment: no type, cannot be confused with a declaration
int a = 30;   // compile error: 'a' is already declared in this scope
b = 20;       // compile error: variable 'b' was not declared in this scope
Summa = 30;   // compile error: variable 'Summa' was not declared in this scope
```

And a diagnostic no other language in this comparison has — the **homoglyph
trap**, where a Cyrillic letter sits inside a Latin identifier (or vice versa),
producing two names that are pixel-identical on screen:

```text
compile error: variable 'сat' was not declared in this scope — but 'cat' is:
the two names mix Russian and English letters that look alike
```

In Python or JavaScript that same typo is not an error at all: it silently
creates a second variable that looks exactly like the first one.

---

## 4. Arithmetic and type conversion

This is the topic with the highest density of quiet damage in every language
except Pascal.

### 4.1. The division operator

**The child writes** `9 / 2` and expects `4.5`, because five years of school
mathematics say so.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | `/` is always real division. Integer division is a separate named operator `div`, remainder is `mod`. Assigning `A / B` into an `integer` is a compile error. |
| C++ | **QUIET** | `/` means two different things depending on operand types: `9 / 2` is `4`, `9.0 / 2` is `4.5`. The flagship ambiguity of the language for beginners: the same operator, the same-looking code, two behaviors. Recovering the expected result needs a cast: `float(A) / B`. |
| Python | OK / mild | `/` is always float, `//` is integer division. The logic is right; the *spelling* is unfortunate — `//` is the comment marker in every C-family language the student will meet next. |
| JavaScript | QUIET | All numbers are floats, so `9 / 2` is `4.5` — correct by accident. Integer division does not exist; it must be assembled as `Math.floor(a / b)`. |

**Idyllium's answer** — `/` has exactly one meaning, and integer operations are
named functions:

```idyllium
float d = 37 / 10;          // 3.7
int    r = 37 / 10;         // compile error: cannot assign 'float' value to 'int' variable
console.writeln(div(37, 10));   // 3
console.writeln(mod(37, 10));   // 7
console.writeln(9 / 2);         // 4.5
```

`div`/`mod` are consistent for negatives: `div(-7, 3)` is `-2`, `mod(-7, 3)`
is `-1`, and `-2 * 3 + (-1) = -7` checks out.

### 4.2. The remainder operator and the percent sign

**The child writes** `int F = 50 % 14;` and reads it as "50 percent of 14" —
a documented, repeated classroom misreading, because `%` has a strong prior
meaning from school.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | `mod` — a word, no false association. |
| C++ | mild | `%` — carries the percent association, and it refuses floats: `7.5 % 2` does not compile, the remainder of reals needs `fmod` from another header. One idea, two spellings. |
| Python | mild | `%` — same association, and the same symbol is additionally the legacy string-formatting operator (`"%d items" % n`), so one glyph carries two unrelated meanings. |
| JavaScript | mild | `%` — same association; works on floats, unlike C++. |

**Idyllium's answer** — `mod(a, b)` is the only spelling, and the percent sign
is intercepted with a targeted hint rather than a parse error:

```text
compile error: '%' is not an Idyllium operator — remainder is the function mod(a, b)
```

### 4.3. Float into int

**The child writes** `int A = 7.9;`.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | LOUD | Compile error. |
| C++ | **QUIET** | Assigns `7`. The fractional part disappears without a word. Combined with §4.1 this is how a beginner's arithmetic silently becomes integer arithmetic across an entire program. |
| Python | QUIET | The variable simply changes type. Nothing was violated because nothing was promised — which is exactly why the concept "type" cannot be taught from this code. |
| JavaScript | QUIET | No integer type exists to violate. |

**Idyllium's answer:**

```text
compile error: cannot assign 'float' value to 'int' variable
```

The widening direction is allowed (`float c = a;` where `a` is `int`), matching
mathematics: every integer is a real number, not vice versa.

### 4.4. Division by zero, roots of negatives, and the NaN family

| Language | Behavior | Detail |
|---|---|---|
| Pascal | LOUD/CRYPTIC | Runtime error (integer division), or an FP exception. |
| C++ | **QUIET/CRASH** | Integer division by zero is undefined behavior: usually a crash with no readable explanation; floating division yields `inf`. |
| Python | LOUD | `ZeroDivisionError` — clear, though wrapped in a traceback. |
| JavaScript | **QUIET** | `5 / 0` is `Infinity`, `0 / 0` is `NaN`, `Math.sqrt(-4)` is `NaN`. `NaN` then propagates through every subsequent computation and prints where a number was expected — and `NaN === NaN` is **false**, so even the check a student would invent does not work. |

**Idyllium's answer** — the console year has no `NaN` and no `Infinity` at all;
each of these is a runtime error naming the offense:

```text
runtime error: division by zero
runtime error: math.sqrt() expects a non-negative number, got -4
```

### 4.5. Integer overflow

| Language | Behavior | Detail |
|---|---|---|
| Pascal | QUIET | Fixed-width types wrap around (range checking off by default in many setups). |
| C++ | **QUIET** | Signed overflow is undefined behavior; in practice the value wraps and the program continues with a nonsense number. |
| Python | OK | Arbitrary-precision integers. |
| JavaScript | QUIET | Beyond 2^53 integers lose precision silently: `9007199254740993` prints as `9007199254740992`. |

**Idyllium's answer** — `int` is arbitrary-precision, verified:

```idyllium
int a = 4611686018427387904;
console.writeln(a * a);   // 21267647932558653966460912964485513216
```

### 4.6. Floating-point display

Every language in this comparison stores floats in binary, so `0.1 + 0.2` is
not exactly `0.3` anywhere. What differs is what the *child sees*.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | CRYPTIC | Default `writeln` of a real prints scientific notation (` 3.00000000000000E-001`) until the student learns formatting arguments. |
| C++ | OK | Default `cout` precision (6 significant digits) prints `0.3`. |
| Python | **QUIET** | `print(0.1 + 0.2)` prints `0.30000000000000004` — technically honest, pedagogically a grenade on lesson three. |
| JavaScript | **QUIET** | Same: `0.30000000000000004`. |

**Idyllium's answer** — display is human by default, honesty is preserved where
it matters:

```idyllium
console.writeln(0.1 + 0.2);            // 0.3
console.writeln((0.1 + 0.2) == 0.3);   // false
console.writeln((0.1 + 0.2) - 0.3);    // 5.551115123125783e-17
console.writeln(1.0 / 3.0);            // 0.33333333
```

Floats print with up to 8 fractional digits, trailing zeros trimmed. A non-zero
value too small for the current precision falls back to exponential form rather
than printing a misleading `0`. `console.set_precision(digits)` exposes the
knob when a lesson needs it. The binary-representation lesson is thus available
on demand (`==`, subtraction) instead of ambushing the student in lesson three.

---

## 5. Console input

**The child writes** the input line right after the output line and expects
symmetry with what they already know.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK / CRYPTIC | `readln(A)` mirrors `writeln(A)` perfectly, and the type of `A` decides the parsing. Bad input aborts with `Runtime error 106` — loud, but the number means nothing to a child. |
| C++ | **QUIET** | `cin >> A` mirrors `cout << A` beautifully — until the user types letters. Then `A` is set to `0`, the stream enters a failed state, **every later read is skipped**, and the program runs to completion printing nonsense. This is the single most damaging quiet error of the console year: the program does not crash, it lies. |
| Python | LOUD / clumsy | `A = int(input('...'))` — a function inside a function, brackets nested two deep, on a day when the student has not met functions. `input()` always returns a string, so the conversion is mandatory. Bad input raises `ValueError` with a traceback: loud, but the traceback is five lines of noise around one useful word. |
| JavaScript | **QUIET** | `prompt()` returns a string always; `Number(prompt())` yields `NaN` on garbage. Pressing *Cancel* returns `null`, and `Number(null)` is **`0`** — the program continues with a number the user never typed. |

**Idyllium's answer** — a named function per type, symmetric with output, no
nesting, and loud on bad input:

```idyllium
console.write("Введите число: ");
int a = console.get_int();
string name = console.get_string();
float h = console.get_float();
```

```text
runtime error: cannot convert input to 'int' (expected integer, got "сорок два")
runtime error: cannot convert input to 'int' (expected integer, got "")
compile error: 'get_int' expects 0 arguments, got 1
compile error: cannot assign 'int' value to 'string' variable
```

The error quotes *what the user actually typed* — including the empty string,
the case where a student pressed Enter twice and would otherwise have no idea
what happened.

---

## 6. Conditions and code blocks

### 6.1. Where the block begins and ends

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK / trap | `begin`/`end` are readable. But the semicolon rules shift under the student's feet: after the `end` of a one-branch `if` a semicolon is required; before `else` it is forbidden; the program's final `end` takes a period. Explainable to a professional ("`if` is a statement, not a construct"), unteachable to a beginner, who concludes the language is arbitrary. |
| C++ | OK | Braces delimit blocks; the presence or absence of `;` cleanly separates *statements* from *constructs*. This is the reference solution. |
| Python | **QUIET** | Indentation *is* the block. Mixing tabs and spaces produces either `TabError` or — worse, historically and in editors that convert on save — code that runs with a **different block structure than the one the student sees**. A forgotten colon reports `invalid syntax` with no clue which line-end is missing. |
| JavaScript | OK | Braces, like C++. |

### 6.2. The stray semicolon

**The child writes** `if (A > 10);` because "every line ends with a semicolon".

| Language | Behavior |
|---|---|
| Pascal | QUIET — `if (A > 10) then ;` is a valid empty statement; the block below always runs. |
| C++ | **QUIET** — the classic. The `if` governs an empty statement, the braces below become an unconditional block, and the program is silently wrong. |
| Python | n/a — the colon prevents this shape. |
| JavaScript | **QUIET** — same as C++. |

**Idyllium's answer** — an empty statement cannot follow a condition:

```text
compile error: expected expression, got ';'
```

### 6.3. Assignment inside a condition

**The child writes** `if (a = 5)` — the single most predictable beginner error
in any C-family language, because school mathematics has taught `=` as
"equals" for five years.

| Language | Behavior |
|---|---|
| Pascal | LOUD — `:=` and `=` are different symbols; the mistake is impossible to make. |
| C++ | **QUIET** — assigns 5, then tests `5` as truthy. Compiles. Most compilers offer a warning only if warnings are enabled and read. |
| Python | LOUD — a syntax error (and the walrus `:=` is opt-in). |
| JavaScript | **QUIET** — same as C++. |

**Idyllium's answer** — a targeted compile error with the fix in the message:

```text
compile error: assignment '=' is not allowed in a condition — did you mean '==' ?
```

### 6.4. Truthiness — numbers and strings used as conditions

**The child writes** `if (a)` meaning "if a exists / is set".

| Language | Behavior | Detail |
|---|---|---|
| Pascal | LOUD | Type mismatch. |
| C++ | **QUIET** | Any non-zero number is true, including `-1`; any non-null pointer is true. |
| Python | QUIET | Empty string, empty list, `0` and `None` are all false; the rule is teachable but has a long list of members. |
| JavaScript | **QUIET** | The largest such list of any language: `''`, `0`, `NaN`, `null`, `undefined` false; `'0'`, `'false'`, `[]` true. |

**Idyllium's answer** — conditions accept `bool` only, and say what they got:

```text
compile error: if condition must be 'bool', got 'int'
compile error: if condition must be 'bool', got 'string'
compile error: while condition must be 'bool', got 'int'
```

This closes the entire family of "it worked because the number was not zero"
accidents, including `while (items.length)`, which many adult codebases use and
no beginner can defend on an exam.

### 6.5. `else if` spelled the Python way

Students who arrive from Python write `elif`. Idyllium answers with a hint,
not a parse error:

```text
compile error: 'elif' is not an Idyllium keyword — write 'else if'
```

---

## 7. Compound conditions

### 7.1. "если A и B больше нуля"

**The child writes** `if (A and B > 0)` — a literal transcription of correct
Russian, in which one comparison legitimately serves two subjects.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | LOUD | `and` has higher precedence than comparison, so `A and B > 0` fails to compile or produces a type error — the mistake surfaces. |
| C++ | **QUIET** | `A && B > 0` evaluates `B > 0`, then tests `A` for non-zero. It compiles, it runs, and for most test data it *accidentally prints the right answer* — the worst possible outcome, because the student ships the misconception forward. |
| Python | QUIET | Same shape: `A and B > 0` is legal and means something other than intended. |
| JavaScript | **QUIET** | Same. |

**Idyllium's answer** — logical operators take `bool` operands, nothing else:

```text
compile error: operator 'and' requires bool operands
```

### 7.2. `not` without parentheses

**The child writes** `if (not A > 35)`.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | **QUIET** | `not` binds tighter than the comparison, so `not A` is evaluated first — on an integer operand that is a bitwise complement — and the comparison then tests a number nobody intended. Compiles, runs, wrong. |
| C++ | **QUIET** | Identical: `!A < 0` becomes `(!A) < 0`, i.e. `false < 0`, i.e. `0 < 0`. Explaining the chain to a beginner requires four separate concepts they do not have yet. |
| Python | OK | `not` has lower precedence than comparison; `not A > 35` means the intended thing. |
| JavaScript | **QUIET** | Like C++. |

**Idyllium's answer:**

```text
compile error: operator 'not' requires 'bool', got 'int'
```

### 7.3. Chained comparison

**The child writes** `if (0 < a < 100)` — again, correct mathematics.

| Language | Behavior |
|---|---|
| Pascal | LOUD — type error. |
| C++ | **QUIET** — `(0 < a)` yields a bool, which is then compared with 100; the condition is true for *every* `a`. |
| Python | OK — chained comparison is a real feature and means the mathematical thing. |
| JavaScript | **QUIET** — like C++. |

**Idyllium's answer:**

```text
compile error: comparison '<' requires numeric operands
```

### 7.4. The "curious student" scenario

The reason these three entries matter more than their frequency suggests: in
C++/JavaScript each of them **compiles, runs, and often produces the expected
output on the demo data**. A student who tries removing the parentheses,
observes that "it still works", and adopts the habit will meet the bug months
later in code that matters, with no memory of the day the habit was formed.
In Idyllium each of the three is refused before the program ever runs.

---

## 8. Loops

### 8.1. `while`

All four languages agree here, and so does Idyllium: `while` + condition +
block. The only difference is §6.4 — Idyllium requires the condition to be
`bool`, so `while (n)` and `while (items.length)` do not compile.

### 8.2. `for`

**The child needs** "repeat this 20 times" and meets a keyword that translates
as "for".

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK / limited | `for i := 0 to 19 do` — the counter is a variable the student declared themselves, and the bound is inclusive, matching speech. But the step is fixed at ±1 (`to`/`downto`); any other step needs a hand-built `while`. |
| C++ | OK | The three-part header is verbose but is a *construct kit*: start, condition, step — all three made of things already learned. Trap: `i++` is a new operator with two forms and a value. |
| Python | **QUIET/CRYPTIC** | `for i in range(20)`: (a) `i` does not look like a variable — it was never declared, and students routinely add a second counter next to it; (b) `range` takes one, two, or three arguments with different meanings; (c) the stop value is **excluded**, right after a lesson where `randint(0, 10)` **included** it. |
| JavaScript | OK / trap | C-style header; the historical `var` capture trap in closures still appears in copied code. |

**Idyllium's answer** — the C-style kit, with the counter visibly declared and
scoped, and with the `++` trap intercepted:

```idyllium
for (int i = 0; i < 20; i = i + 1) {
    console.writeln(i);
}
console.writeln(i);   // compile error: 'i' was not declared in this scope
```

```text
compile error: '++' is not an Idyllium operator — write 'i = i + 1'
```

Compound assignments (`+=`, `-=`) exist in the language, but course materials
deliberately use the full form `x = x + 1`, which keeps both roles of the
variable visible: source on the right, target on the left.

---

## 9. Random numbers

| Language | Behavior | Detail |
|---|---|---|
| Pascal | QUIET | `random(30)` returns 0..29 — the upper bound is *excluded* while speech says "up to 30". Worse: without `Randomize`, **every run produces the same sequence**, with no warning. A student's dice game is deterministic and they cannot see why. |
| C++ | CRYPTIC | `rand() % 50` requires modulo-periodicity reasoning on the day randomness is introduced; `srand(time(0))` requires seeds, epochs, and an unrelated header. Without it — same sequence every run, quietly. The upside: the topic *can* be taught in full depth, which is genuine educational value for strong groups. |
| Python | OK | `random.randint(24, 52)` — inclusive both ends, auto-seeded. The clearest of the four. Downside: pseudo-randomness never surfaces, so students believe the computer "just knows" random numbers. |
| JavaScript | CRYPTIC | `Math.floor(Math.random() * 50)` — two nested calls and an arithmetic transform for every single random number. No seed control at all, so the pseudo-random lesson is not merely skipped, it is impossible. |

**Idyllium's answer** — inclusive bounds, auto-seeded, with seed control
available when the lesson wants it, and an invalid range refused loudly:

```idyllium
use random;

int a = random.create_int(24, 52);     // both ends included
float b = random.create_float(1.0, 4.0);
random.set_seed(42);                    // reproducible runs when teaching PRNGs
```

```text
runtime error: random.create_int() min must be less than or equal to max (got min 100, max 1)
```

`create_int` names its own action ("create an integer"), and the two arguments
mean exactly what a child would guess. The pseudo-randomness lesson is
*available* (`set_seed`) instead of *mandatory* (C++) or *impossible*
(JavaScript).

---

## 10. Fixed-size arrays

Arrays are where a beginner's error rate spikes, because the payoff only
appears once several tools are combined. What the language does *at the moment
of the mistake* therefore matters more here than anywhere else.

### 10.1. Reading and writing outside the array

**The child writes** `A[10]` on an array of four.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | **QUIET** | With range checking off (the common default), the program reads or writes whatever memory happens to sit there. The habit of trusting indices forms with no resistance. |
| C++ | **QUIET** | Undefined behavior: reads garbage, writes corrupt neighbouring data. The program may crash minutes later, in unrelated code. This is the least debuggable failure mode in the entire console year. |
| Python | LOUD | `IndexError: list index out of range` — the one place where Python is the strictest of the three legacy languages. |
| JavaScript | **QUIET, both ways** | Reading `A[10]` returns `undefined`; **writing** `A[10] = 99` extends the array with holes. Even Python's single win is absent here. |

**Idyllium's answer** — loud on both read and write, and the message names the
valid range, which turns the error into a micro-lesson:

```text
runtime error: array index 10 out of bounds (size 4, valid indices 0-3)
```

### 10.2. Operating on the whole array by accident

**The child writes** `B = 240;` or `cout << B;` or `if (A > B)`.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | LOUD | Every whole-array operation errors; only cells are usable. Pedagogically clean. |
| C++ | **QUIET** | `cout << B` prints the array's **address**; `A > B` compares **addresses**. Both compile, both print something, both are meaningless to the student. |
| Python | **QUIET** | `F = 240` silently destroys the list and rebinds the name to a number; `A > G` compares lists element-wise (defensible, unteachable at this stage); `print(A)` prints the whole list, which teaches that "commands work on whole lists" — right up to the first command that does not. |
| JavaScript | QUIET | Similar, plus `A.length = 2` **truncates the array** by assignment to a property. |

**Idyllium's answer:**

```text
compile error: cannot assign 'int' value to 'array<int, 4>' variable
compile error: property 'length' is read-only
compile error: array element type 'string' does not match 'int'
```

Size is part of the type (`array<int, 4>`), so a fixed array cannot silently
become something else. The single deliberate exception: `console.writeln(a)`
prints the whole array (`[1, 2, 3, 4]`) because a debugging print is worth more
than dogma. Course texts state this explicitly — **printing is the only
operation that accepts a whole array** — precisely so that the Python
generalization ("if print can, everything can") never forms.

### 10.3. Numbering from zero or one

Pascal permits `array [1..50]`, which spares beginners the zero-based
translation but plants a habit that every other language will punish; and its
own dynamic arrays then start at 0, contradicting the static ones. Idyllium is
zero-based everywhere, with no exceptions to memorize, and the out-of-bounds
message spells the valid range on every mistake.

---

## 11. Dynamic arrays

| Language | Behavior | Detail |
|---|---|---|
| Pascal | CLUMSY | `setLength(K, length(K) + 1)` to append one cell; no method-style API; and the switch from 1-based static arrays to 0-based dynamic ones lands in the same lesson. |
| C++ | OK | `vector<int> K; K.push_back(x);` — sound, but three bracket families in one topic: angle for the type, round for the method, square for the cell. |
| Python | OK | `K.append(x)` — the model implementation. Its only defect is the one from §10: no separate static-array concept exists, so "the array has a fixed size" is never learned. |
| JavaScript | QUIET | `push` is fine, but §10.1 applies: holes and `undefined` are one typo away. |

**Idyllium's answer** — a distinct type keeps the static/dynamic boundary
visible, with a short verb and the same bracket habits as fixed arrays:

```idyllium
dyn_array<int> k;
k.add(24);
k.add(73);
console.writeln(k.length, " ", k[0]);   // 2 24
console.writeln(k);                      // [24, 73]
console.writeln(k[5]);
```

```text
runtime error: array index 5 out of bounds (size 2, valid indices 0-1)
compile error: type 'dyn_array<int>' has no method 'size'
```

`length` is a property on both array kinds (not `len(x)`, not `.size()`, not
`.Length`), so one habit covers strings, arrays and dynamic arrays.

---

## 12. Characters and strings

### 12.1. Non-Latin text — the "six letters became twelve" disaster

**The child writes** `S = 'белый'` and asks for its length.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | **QUIET** | `length('белый')` is **10**: the string is a byte array, and each Cyrillic letter occupies two bytes in UTF-8. `Q[1]` prints half a letter — a replacement glyph. Every string exercise written in Russian breaks, and the fix requires teaching encodings on the day strings are introduced. |
| C++ | **QUIET** | Identical: `Q.size()` is 10, `Q[0]` is half a letter. |
| Python | OK | `len('белый')` is 5, `B[0]` is `'б'`. Text is text. |
| JavaScript | OK (mostly) | UTF-16 code units: correct for Cyrillic, still wrong for emoji and rare scripts. |

**Idyllium's answer** — verified against the compiler:

```idyllium
console.writeln("белый".length);   // 5
console.writeln("белый"[0]);       // б
console.writeln("ёжик".length);    // 4
```

### 12.2. Arithmetic on characters and strings

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | `char` is its own type; `'a' + 1` is an error; `ord()`/`chr()` convert explicitly. |
| C++ | **QUIET, spectacularly** | `char` is a small integer: `'A' + 'j'` is `171`; `char B = B + 3` shifts a letter. And the crown jewel: `string B = "capability" + 3;` compiles and yields **`"ability"`** — pointer arithmetic on the string literal. Not one student in a hundred can be told why, and the ones who discover it lose trust in the language. |
| Python | LOUD | `'text' + 3` raises `TypeError` immediately. But `'ab' * 3` is legal string repetition — a pleasant trick that quietly teaches that `*` works on text. |
| JavaScript | **QUIET, catastrophically** | `'5' + 1` is `'51'` while `'5' - 1` is `4`. The same operand, four operators, two philosophies. For a student whose input arrives as a string from `prompt()`, this is a daily event. |

**Idyllium's answer** — concatenation is strings only; everything else is
refused:

```text
compile error: operator '+' cannot be applied to 'string' and 'int'
compile error: operator '*' cannot be applied to 'string' and 'int'
compile error: operator '+' cannot be applied to 'char' and 'int'
compile error: operator '+' cannot be applied to 'char' and 'char'
```

`string + char` **is** allowed (`"кот" + 'a'` gives `"кота"`), matching Pascal's
sane half of the rule. Numbers are joined to text with the named conversion
`to_string(x)`, or simply passed to `console.writeln(...)` as extra arguments,
which is the form course materials use first.

### 12.3. Comparing and mutating strings

| Language | Behavior | Detail |
|---|---|---|
| Pascal / C++ | QUIET | `R < S` compares byte by byte, which looks like alphabetical order until the first Cyrillic string or capital letter arrives. |
| Python | QUIET | Same code-point ordering, same illusion. |
| JavaScript | **QUIET** | `'5' == 5` is **true**; `S[0] = 'w'` **silently does nothing** (strings are immutable, and the assignment is not an error outside strict mode). |

**Idyllium's answer** — only equality is defined for strings, and mutation is
refused rather than ignored:

```text
compile error: comparison '<' requires numeric operands
compile error: cannot compare 'string' and 'int'
compile error: cannot compare 'string' and 'char'
compile error: string characters are read-only
```

Alphabetical ordering is a *task* (write the comparison you actually mean), not
a hidden byte-order accident.

---

## 13. The boolean type

**The child writes** `N = 24 + F;` where `F` is a flag, or `if (F == 1)`.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | A boolean is a boolean. Every arithmetic or comparison mix is a compile error. The reference behavior. |
| C++ | **QUIET** | `bool` is an integer in disguise: `F = 24` stores `true`; `F = "island"` stores `true`; `24 + F` is `25`; `F - 1` is `false`; and by default `cout << F` prints **`1`**, not `true`, so the student's first look at a boolean is a number. |
| Python | QUIET | `True` *is* `1`: `24 + True` is `25`, `True == 1` is true. |
| JavaScript | **QUIET** | Everything above plus a coercion table with entries like `[] == false` being true. |

**Idyllium's answer** — Pascal's strictness, plus honest printing:

```text
compile error: operator '+' cannot be applied to 'int' and 'bool'
compile error: comparison '<' requires numeric operands
```

```idyllium
bool f = true;
console.writeln(f);              // true
console.writeln(to_string(f));   // true
```

---

## 14. Functions

### 14.1. Declaring one

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK / trap | Clean split between `procedure` and `function`. Two traps: the return value is delivered by **assigning to the function's own name** (`stepen := R;`), which teaches "a function is a kind of variable" — a misconception heard verbatim at exams; and the return type sits *after* the parameter list, so a two-`integer` parameter list followed by `: integer` reads ambiguously. Also, calls may omit `()` when there are no arguments, erasing the visual line between things that *store* and things that *act*. |
| C++ | OK | Return type before the name, `return` for the result, parentheses always required. The reference behavior. `void` names the "no result" case explicitly. |
| Python | QUIET | `def` is a contraction students never meet again. No return type is written, so nothing distinguishes a "procedure" from a "function" but the presence of `return` — and forgetting it yields `None`, which then propagates. `global` re-opens side effects on request. |
| JavaScript | **QUIET, thoroughly** | The keyword `function` is the best of the four. Everything around it is unguarded: missing arguments become `undefined` (and arithmetic on them yields `NaN` five lines away), extra arguments are ignored, a missing `return` yields `undefined`, and arrow functions provide a third syntax for the same concept in every online example. |

**Idyllium's answer** — the full word `function`, the return type in front, and
every arity and type mismatch refused:

```idyllium
int function stepen(int num, int s) {
    int r = 1;
    for (int i = 0; i < s; i = i + 1) { r = r * num; }
    return r;
}
```

```text
compile error: function with return type 'int' must return a value
compile error: 'stepen' expects 2 arguments, got 1
compile error: 'stepen' expects 2 arguments, got 3
compile error: cannot return 'string' value from 'int' function
compile error: cannot assign 'void' value to 'int' variable
```

The `void` case is a real type, as in C++, so "returns nothing" is visible in
the signature rather than inferred from the absence of `return`.

### 14.2. Purity and globals

C++ gives beginners accidental discipline: because `main` is itself a function,
nothing a first-year student writes is global, so results must travel through
`return`. Pascal and Python both offer an easy escape (`global`, or plain
top-level variables), and JavaScript hands out globals for free on a typo.
Idyllium keeps top-level variables available — the course uses them sparingly
in year one and drops them in year three, where classes take over state —
but the compiler still refuses to invent a variable that was never declared,
so the JavaScript "typo becomes a global" failure cannot occur.

---

## 15. Text files

The final console-year topic, and the one where "forgot to close it" is
traditionally punished by an empty file and no explanation.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK / naming disaster | `writeln(F, ...)` and `readln(F, ...)` extend console habits perfectly — the single best parallel of the four. `eof(F)` reads as English. Opening a missing file crashes loudly, which is pedagogically honest. But the three open commands are incantations with *negative* associativity: `Rewrite` opens for **writing** (and erases the file — students read it as "edit an existing file"), `Reset` opens for **reading** (translated, it means "reset"), and only `Append` is honest. |
| C++ | OK / QUIET | `fout`/`fin` inherit `cout`/`cin` exactly — the language finally collects the harvest of its painful first lesson. Then: `while (getline(fin, S))` is an outright black box (a function used as a condition); `>>` and `getline` read differently and interact through a leftover newline in the buffer, cured by the unexplainable `fin.ignore()`; and **opening a missing file is silent** — the stream fails, the read loop never executes, the program ends with no output and no clue. |
| Python | OK / death by a thousand cuts | `open(path, mode)` is the best-named opening operation of the four. Then: writing uses `write`, not `print`, breaking the console parallel; `write` adds no newline; `write` accepts **only strings**, so numbers need `str()`; every line read comes back with a trailing `'\n'`, so comparisons silently fail until `.strip()` is applied; there are three reading methods differing by two letters (`read`, `readline`, `readlines`) and doing entirely different things; and the idiomatic `with open(...) as f:` is three unknown words on the day files are introduced. |
| JavaScript | ABSENT | Browser JavaScript has no file system. The topic is replaced by `localStorage` (string-only key-value storage, wiped when the user clears browsing data) — so the whole console-to-file conceptual bridge does not exist. |

**Idyllium's answer:**

```idyllium
use file;

file.ostream fout = file.open("data.txt", "write");
fout.write_line("Первая строка");
fout.write_line(25);          // numbers allowed, exactly like console.writeln
fout.close();

file.istream fin = file.open("data.txt", "read");
while (fin.has_next_line()) {
    string s = fin.read_line();
    console.writeln(s.trim());
}
fin.close();
```

- **One opening command with a mode**, as in Python — but the modes are whole
  words, not letters to memorize:

  ```text
  runtime error: file.open() mode must be 'read', 'write' or 'append', got 'r'
  ```

- **A missing file is loud**, in a sentence rather than an error number:

  ```text
  runtime error: file.open() cannot open 'нет-такого.txt' for reading: file does not exist
  ```

- **`write_line` mirrors `console.writeln`** — same shape, same permissiveness
  about argument types (`25`, `3.5`, `true` all write correctly), and it adds
  the newline itself. Python's `str()` matryoshka and its missing-newline trap
  are both closed.
- **`has_next_line()` reads as a question**, replacing both `eof` (an
  abbreviation) and `while (getline(...))` (a black box).
- **Forgetting `close()` does not destroy the work.** Verified: a program that
  writes 500 lines and exits without closing leaves all 500 lines on disk. The
  classic file-topic injury — "the program looks right and the file is empty" —
  cannot happen. Closing is still taught, because a stream held open is a real
  concept, but forgetting it is no longer a silent data loss.

**Documented behavior (owner's verdict):** `read_line()` returns the line
*including* its terminator — deliberately, by symmetry with `write_line()`,
which appends one: what one writes, the other reads back whole. The last line
of a file without a trailing newline comes back without one. Cleaning the line
is the reader's job, and `.trim()` is the canonical tool; teaching code calls
`.trim()` after `read_line()` as standard practice, not as a workaround.

---

## 16. Diagnostics that exist only here

Beyond refusing bad code, the Idyllium compiler intercepts specific *known
beginner intentions* and answers them in words. These are not generic type
errors; each one was added because the mistake was observed repeatedly:

| The student writes | The compiler answers |
|---|---|
| `if (a = 5)` | `assignment '=' is not allowed in a condition — did you mean '==' ?` |
| `i++` | `'++' is not an Idyllium operator — write 'i = i + 1'` |
| `50 % 14` | `'%' is not an Idyllium operator — remainder is the function mod(a, b)` |
| `elif (...)` | `'elif' is not an Idyllium keyword — write 'else if'` |
| `сat = 6;` (Cyrillic `с`, Latin `cat` declared) | `variable 'сat' was not declared in this scope — but 'cat' is: the two names mix Russian and English letters that look alike` |
| `a[10]` on a four-cell array | `array index 10 out of bounds (size 4, valid indices 0-3)` |
| `console.get_int("Введите:")` | `'get_int' expects 0 arguments, got 1` |
| `use consol;` | `module 'consol' was not found` |
| `a.size()` on an array | `type 'array<int, 3>' has no method 'size'` |

Reading compiler messages is an explicitly taught skill in the course; the
messages are written to survive machine translation, so a student who does not
read English can still act on them.

Idioms carried over from other languages (`print(...)`, `input()`, `len(s)`,
`str(42)`) currently produce the generic `function 'print' was not declared in
this scope`. That is loud and correct, but not yet a targeted hint — worth
knowing when helping a student who is translating Python habits.

---

## 17. Summary: the quiet-error inventory

Every entry below is a place where a beginner's wrong code produces **no
diagnostic at all** in the language named. This is the list the language was
built against.

Legend: **yes** — the failure is quiet in that language; `—` — the language
either refuses the code or behaves as a human would expect; a note in
parentheses — it does complain, but with a caveat worth knowing.

| # | Quiet failure | Pascal | C++ | Python | JavaScript | Idyllium |
|---|---|---|---|---|---|---|
| 1 | `9 / 2` silently becomes `4` | — | **yes** | — | — | `/` is always float; `div()` is integer division |
| 2 | `int A = 7.9` silently truncates | — | **yes** | rebinds type | n/a | compile error |
| 3 | Typo creates a second variable | — | — | **yes** | **yes** | undeclared → compile error; homoglyph hint |
| 4 | Case-only difference aliases a variable | **yes** | — | — | — | case-sensitive; undeclared → error |
| 5 | Bad console input leaves `0` and poisons the stream | — | **yes** | — | `NaN`/`0` from `null` | runtime error quoting the input |
| 6 | `if (a = 5)` compiles | — | **yes** | — | **yes** | targeted compile error |
| 7 | `if (cond);` empty statement | **yes** | **yes** | n/a | **yes** | compile error |
| 8 | Number/string used as a condition | — | **yes** | **yes** | **yes** | `must be 'bool', got 'int'` |
| 9 | `if (A and B > 0)` means something else | — | **yes** | **yes** | **yes** | `'and' requires bool operands` |
| 10 | `not A > 35` silently inverts a number | **yes** | **yes** | — | **yes** | `'not' requires 'bool', got 'int'` |
| 11 | `0 < a < 100` always true | — | **yes** | — (real feature) | **yes** | compile error |
| 12 | Same random sequence every run | **yes** (no `Randomize`) | **yes** (no `srand`) | — | — | auto-seeded; `set_seed()` optional |
| 13 | Reading past the end of an array | **yes** | **yes** | — | **yes** (`undefined`) | runtime error naming valid range |
| 14 | Writing past the end of an array | **yes** | **yes** | — | **yes** (holes) | runtime error naming valid range |
| 15 | Whole-array operations do something odd | — | **yes** (addresses) | **yes** (rebind/compare) | **yes** (`length =`) | compile errors; only printing is allowed |
| 16 | Cyrillic string reports double length | **yes** | **yes** | — | — | characters, not bytes |
| 17 | `'A' + 'j'` is `171`; `"cap" + 3` is `"ability"` | — | **yes** | — | — | operator errors on `char`/`string` mixes |
| 18 | `'5' + 1` is `'51'` but `'5' - 1` is `4` | — | — | — | **yes** | `'+' cannot be applied to 'string' and 'int'` |
| 19 | `s[0] = 'w'` does nothing | — | — | (loud) | **yes** | `string characters are read-only` |
| 20 | `bool` behaves as a number | — | **yes** | **yes** | **yes** | strict bool; prints `true`/`false` |
| 21 | Missing/extra function arguments | — | — | (loud) | **yes** | `expects 2 arguments, got 1` / `got 3` |
| 22 | Missing `return` yields a usable nothing | — | (warning) | **yes** (`None`) | **yes** (`undefined`) | `must return a value` |
| 23 | Opening a missing file does nothing | — | **yes** | — | n/a | runtime error naming the path |
| 24 | Forgotten `close()` empties the file | **yes** | **yes** | **yes** | n/a | data is written anyway |
| 25 | Integer overflow wraps around | **yes** | **yes** | — | **yes** (>2^53) | arbitrary precision |
| 26 | Division by zero yields `Infinity`/`NaN` | — | (crash) | (loud) | **yes** | runtime error |

Read the last column as the actual specification of the language's strictness:
Idyllium is not strict for the sake of rigor, it is strict in exactly the 26
places where a child's wrong program used to keep running.

---

## 18. Honest residue: what Idyllium still does not catch

A document that only listed victories would be useless for writing real
teaching material. These remain:

1. **Dangling expressions.** `a + 1;` and `a == 6;` compile and run silently.
   The computed value evaporates. This is the "evaporating value" misconception
   in its purest form, and the compiler currently does not flag it. (A warning
   channel exists in the toolchain but is not wired to this case.)
2. **Chained equality.** `a == b == false` type-checks, because `bool == bool`
   is legal; `0 < a < 100` is caught only because the second comparison mixes
   `bool` with a number.
3. **Shadowing in nested blocks.** Declaring `int a` inside an `if` when an `a`
   exists outside is allowed and silently creates a second variable — the same
   behavior as C++ and JavaScript `let`.
4. **Braceless single-statement `if`.** `if (a > 10) console.writeln("x");` is
   legal, so the classic "I added a second line and it stopped being inside the
   `if`" bug remains possible. Course materials always use braces.
5. **Whole-array printing** (§10.2) is deliberately allowed.
6. **`read_line()` keeps the newline** (§15) — a live defect, use `.trim()`.
7. **Printing a function value — **fixed**: `console.writeln(answer)` with a bare function name is now refused at compile time (`cannot print function 'answer' — add '()' with its arguments to call it and print the result`). Teaching examples may safely show the mistake: the compiler names the function and dictates the cure.

The boundary is the whole point: **a language can catch the syntax of a
misconception, not the misconception itself.**

---

## 19. Rules for an AI using this file

1. **Do not import idioms.** When a student's question is phrased in Python or
   JavaScript, answer in Idyllium: `console.writeln`, not `print`;
   `console.get_int()`, not `int(input())`; `k.length`, not `len(k)`;
   `x = x + 1`, not `x++`.
2. **When a student is transferring from another language, name the specific
   trap** from the tables above instead of saying "Idyllium is stricter". The
   student's habit came from a concrete behavior; the cure is the concrete
   contrast.
3. **Never present a compiler error as a failure.** Every message quoted here
   is a lesson the language is delivering; explain what it caught. In this
   course, "it compiled but printed something odd" is a *worse* outcome than
   "it refused to compile".
4. **Do not invent strictness that does not exist**, and do not promise
   catches from §18. If a student asks "will Idyllium tell me about `a + 1;`",
   the answer today is no.
5. **Keep the residue list in mind when writing examples**: braces always,
   `.trim()` after `read_line()`, never a bare function name in output.
6. **Do not reproduce this file's comparisons as criticism of other languages
   in student-facing material.** The audience for the contrast is adults
   designing curricula; for a child, the only useful frame is what Idyllium
   does and why it helps them.

---

## 20. Provenance

The catalog of other-language behavior comes from classroom observation across
Pascal, C++, Python and JavaScript courses for 10–15-year-olds, accumulated
before Idyllium existed, and organized around the five criteria in §0. The
Idyllium column is not opinion: every message quoted was produced by running a
probe program through the current compiler. When the language changes, this file
must be re-verified the same way — a claim about strictness that is not backed
by a current compiler message does not belong here.
