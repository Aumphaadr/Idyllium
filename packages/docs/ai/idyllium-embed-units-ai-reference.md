# Idyllium Embed Units AI Reference

This file teaches a general-purpose AI assistant to **author Idyllium embed
units**: small self-checking programming exercises that any web page can embed.
Paste this file into a chat, describe the exercise you want, and the assistant
can produce a ready `.idyunit` file or ready HTML — without visiting the unit
builder at https://aumphaadr.github.io/Idyllium/authors/.

Current target: Idyllium 1.6.2, unit file `format` 1.

Companion files (same folder): `idyllium-ai-reference.md` — the LANGUAGE (you
need it to write the starter code and the author's solution correctly);
`idyllium-site-ai-reference.md` — the website. This file does not repeat them.

Rules for the assistant:

- Do not invent configuration fields, formula functions or libraries. Everything
  that exists is listed here; an unknown field is silently ignored by the unit,
  which means a silently weaker exercise.
- You cannot run Idyllium. Say so, and ALWAYS tell the user to open the result
  in the builder (`/authors/` → «Открыть файл…») — its self-check runs the
  author's solution against the tests and reports mistakes in words. A unit
  that never went through the self-check is a draft.
- Idyllium is not C++, Python or JavaScript. The most frequent generation
  mistakes: `%` (write `mod(a, b)`), `/` for integers (it is always float;
  write `div(a, b)`), `x++` and `x += 1` in teaching code (write `x = x + 1`),
  `&&`/`||`/`!` (write `and`/`or`/`not`), `int main()` (write `main()`),
  `console.read_line` (does not exist: `console.get_string()`,
  `console.get_int()`, `console.get_float()`), forgetting `use console;`.

## 1. What a unit is

A unit is a frame with: an optional task statement, a code editor with a starter
program, a console, and the buttons «Запустить» (Run), «Проверить» (Check),
«Форматировать» (Format), «В Web IDE» (continue in the full IDE), «Сбросить»
(Reset).

- **Run** is an ordinary interactive run with the student's own input. It gives
  no verdict (only a soft hint «this run agrees with the task»).
- **Check** runs the student's program on the author's SET of tests and applies
  the author's rules to every run. Verdict: solved / not solved, with the first
  failing input and the reason in words.
- Units are **console-only**. Available libraries: `console`, `math`, `random`,
  `time`, `types`, `encoding`, `hash`, `system`. No `gui`, files, network,
  `json`, `sqlite`: any other `use` is a compile error inside a unit.
- Limits: 10 seconds per test (`time.sleep` really sleeps), 65536 characters of
  output per test, at most 200 test entries.
- No server, no accounts, no statistics. Tests live in the page source and are
  not secret: a unit is a trainer, not an exam.

## 2. Three ways to deliver a unit

1. **`.idyunit` file — PREFERRED for an assistant.** It is the configuration
   JSON of section 3 saved as `name.idyunit`. The user opens it in the builder,
   sees the live preview and the self-check, fixes what the self-check found,
   and copies the final HTML there. Put the author's solution into `solution`
   (it stays in the file; see section 3 for when it reaches the page).
2. **Full HTML form** — a loader script plus the `<idyllium-unit>` element.
   Plain text, so an assistant can write it directly:

   ```html
   <script src="https://aumphaadr.github.io/Idyllium/embed/idyllium-unit.js" async></script>

   <idyllium-unit id="loop-10-15">
   <script type="text/idyllium">
   use console;

   main() {
       for (int i = ; i < ; i = i + 1) {
           console.writeln(i);
       }
   }
   </script>
   <script type="application/json">
   {
     "format": 1,
     "title": "Числа от 10 до 15",
     "statement": "Допишите цикл так, чтобы программа вывела числа от 10 до 15, каждое с новой строки.",
     "inputs": "none",
     "check": { "kind": "expect", "output": "10\n11\n12\n13\n14\n15\n" },
     "code": { "require": ["for"], "maxCalls": { "writeln": 1 } }
   }
   </script>
   </idyllium-unit>
   ```

   The starter code goes into `<script type="text/idyllium">` as is — no HTML
   escaping of `<` and `&`; only the sequence `</script` must be written
   `<\/script`. A second `<script type="text/idyllium" data-role="solution">`
   carries the reference solution (needed only for `check.kind = "reference"`).
   The loader script is included once per page, however many units follow.
   Omitted JSON fields take their defaults.
3. **iframe-only form** for platforms that strip `<script>`: the whole unit is
   packed into the address after `#unit=` as base64url of the JSON. **Do not
   produce it by hand** — an assistant cannot encode it reliably; the builder
   generates it with one click.

## 3. The configuration (format 1)

```json
{
  "format": 1,
  "id": "circle-area",
  "title": "Площадь круга",
  "statement": "Task text shown above the editor; empty = the host page states the task itself.",
  "lang": "ru",
  "starter": "use console;\n\nmain() {\n    \n}\n",
  "solution": "…the author's full program…",
  "libs": ["console", "math"],
  "inputs": "some",
  "tests": [
    { "in": "2" },
    { "in": ["3", "4"] },
    { "random": 1, "range": [-50, 50], "times": 4 },
    { "random": 1, "range": [-5, 5], "times": 4, "kind": "float", "digits": 1 }
  ],
  "check": { "kind": "formula", "tolerance": 0.001, "rules": [ { "when": "", "expr": "…" } ] },
  "code": { "require": ["if"], "forbid": ["while"], "maxCalls": { "writeln": 1 } },
  "editor": { "rows": 16, "consoleRows": 6, "fontSize": 16, "theme": "auto",
              "mode": "monaco", "autocomplete": true, "format": true, "openInIde": true },
  "feedback": { "reveal": false, "softRunHint": true, "shareCode": false, "branding": true },
  "hooks": { "solved": "", "failed": "", "check": "" }
}
```

Field by field:

| Field | Values and default | Meaning |
|---|---|---|
| `format` | `1` | Schema number of the file. Always write `1`. |
| `id` | latin letters, digits, hyphen; default — slug of `title` | Element id and the key of the student's saved draft. Unique per page. |
| `title` | string | Name of the unit (frame title, builder). |
| `statement` | string, default `""` | Task text. Plain text. |
| `lang` | `"ru"` (default) or `"en"` | Language of the unit's buttons and verdicts. |
| `starter` | code; `"minimal"` (default: `use console;` + empty `main`), `"empty"` | What the student sees first. It may deliberately not compile («fill in the condition») — the self-check then shows a harmless warning. It must NOT already pass the check. |
| `solution` | code | The author's solution. Used by the builder's self-check; in mode `reference` it is ALSO shipped to the page (visible in the page source). In other modes it never leaves the `.idyunit` file. |
| `libs` | subset of the eight libraries; default — all eight | Narrowing, e.g. `["console"]` to forbid `math`. `console` is always present. |
| `inputs` | `"some"` (default) / `"none"` | `"none"`: the task has no input; a program that tries to read fails the test. |
| `tests` | array, see section 4 | The inputs of the check runs. |
| `check` | see section 5 | How a run is judged. `{"kind": "none"}` (default) — a sandbox without a verdict. |
| `code` | see section 6 | Requirements to the program text. |
| `editor.rows` | 4–40, default 16 | Editor height in lines. |
| `editor.consoleRows` | 3–20, default 6 | Console height in lines. |
| `editor.fontSize` | 10–28, default 16 | |
| `editor.theme` | `"auto"` (default), `"light"`, `"dark"` | `auto` follows the visitor's system theme. |
| `editor.mode` | `"monaco"` (default) / `"light"` | `light` — a plain lightweight editor instead of Monaco. |
| `editor.autocomplete` | default `true` | `false` — no completions at all (the student types every name). |
| `editor.format` | default `true` | `false` removes the «Форматировать» button. |
| `editor.openInIde` | default `true` | The «В Web IDE» button: opens the student's code in the full Web IDE in a new tab (as a separate guest project, through a `#p1=` link). `false` — when the student must not leave the lesson page. |
| `feedback.reveal` | default `false` | Show the expected answer of the failed test (modes `expect` and `reference`). |
| `feedback.softRunHint` | default `true` | The soft hint after an ordinary Run. |
| `feedback.shareCode` | default `false` | Pass the student's program text to the host page's callbacks. |
| `feedback.branding` | default `true` | The small «Idyllium» link in the corner. |
| `hooks.*` | function names, default `""` | See section 8. |

## 4. Tests

One test = one run of the program with prepared input.

- `{ "in": "3 4" }` — a string is split by whitespace: two input lines, `3` and
  `4`. Each `console.get_*` call consumes one.
- `{ "in": ["Анна Мария", "12"] }` — an array gives the lines as they are; use
  it when a line contains spaces (for `console.get_string()`).
- `{ "random": N, "range": [low, high], "times": T }` — `T` runs with `N` random
  INTEGERS each (`N` 1–20, `T` 1–50). With `"kind": "float", "digits": D`
  (`D` 1–6) the numbers are fractional with `D` digits after the point. Random
  tests are regenerated on every Check, so they work only with rules that
  COMPUTE the answer (`formula`, `reference`), never with `expect`.
- A program that reads more than the test supplies fails that test
  («input ran out»); reading `2.5` with `get_int` fails it too, in words.
- With `"inputs": "none"` leave `tests` empty — there is exactly one run.

How to choose tests — this is the part assistants get wrong:

- **One test per branch, plus every boundary.** For `if (R >= 0)`: a positive,
  zero, a negative — AND values right next to the boundary.
- **If the input may be fractional, include fractional tests.** Otherwise a
  wrong `R > -1` passes all integer tests instead of the required `R >= 0`
  (the two differ only on inputs like `-0.5`), and so does a student who read
  the number with `get_int`. Rule of thumb for a boundary `c` on a float input:
  test `c`, `c - 0.5`, `c + 0.5`, `c - 1`, `c + 1`.
- **Never rely on one «lucky» input.** For the rectangle task the input `1 1`
  accepts `w * 4` as the perimeter and `w * w` as the area. Use unequal values
  and add random tests.
- Add 3–5 random tests when the answer is computed by a formula or a reference.
- The builder's self-check tests the tests: it mutates the author's solution a
  little (`>=` → `>`, `0` → `-1`, `>= 0` → `> -1`) and reports every mutant the
  tests cannot tell from the original, together with an input that does. Tell
  the user to press «+ тест» there.

## 5. Check kinds

### 5.1. `formula` — rules over the values of a run

```json
"check": { "kind": "formula", "tolerance": 0.001, "rules": [
  { "when": "{in1} >= 0", "expr": "{outs} == 1 and {out1} == 3.14 * {in1} * {in1}" },
  { "when": "{in1} < 0",  "expr": "{line1} == \"Ошибка\"" }
] }
```

A rule applies when its `when` is empty or true; every applicable rule must
give `true`. A run to which NO rule applied is not counted; if that happens to
all runs the check reports «nothing was checked» — so make the `when`
conditions cover every test.

Values in curly braces:

| Slot | Meaning |
|---|---|
| `{in1}`, `{in2}`, … | Input lines the program actually READ, in order. Numeric-looking text is a number. |
| `{out1}`, `{out2}`, … | The answer split by whitespace. Numeric-looking text is a number, the rest are strings. |
| `{line1}`, `{line2}`, … | Whole lines of the answer (always strings, trailing spaces removed). |
| `{ins}`, `{outs}`, `{lines}` | COUNTS of the above. |
| `{output}` | The whole answer as one string. |

**The answer excludes prompts**: text that hangs on the current line at the
moment the program reads input («Введите радиус: ») is not part of the answer.
So the starter may prompt freely. But a prompt printed with `writeln` (ending
the line) IS part of the answer — avoid it in starters and solutions.

The formula language is a subset of Idyllium expressions:

- `and`, `or`, `not`, `xor`; `==`, `!=`, `<`, `<=`, `>`, `>=`; `+ - * /`
  (`/` is float division; `+` concatenates when either side is a string);
  parentheses; numbers, `"strings"` (or `'strings'`), `true`, `false`.
- Functions — the complete list: `abs(x)`, `round(x)`, `round(x, digits)`,
  `floor(x)`, `ceil(x)`, `sqrt(x)`, `pow(x, y)`, `min(a, b)`, `max(a, b)`,
  `mod(a, b)`, `div(a, b)` (rounded down, remainder with the sign of the
  divisor — the same rule as the language since 1.6.1), `to_int(x)`,
  `to_float(x)`, `to_string(x)`, `length(s)`, `contains(s, part)`, `lower(s)`,
  `upper(s)`.
- Numbers are compared with `tolerance` (default `0.000001`): `==` means
  «differs by at most the tolerance»; `<=` and `>=` are widened by it. For money
  and areas use `0.001`–`0.01`; for integer answers use `0`.
- There are no variables, no `if`, no loops, no `%`, `&&`, `||`, `!` (each of
  these gives an error in words with a position).
- Always pin the amount of output (`{outs} == 2` or `{lines} == 2`) — otherwise
  a program that prints extra garbage passes. Referring to a missing slot
  (`{out2}` when one value was printed) fails the test with a clear reason.

### 5.2. `expect` — exact output

```json
"inputs": "none",
"check": { "kind": "expect", "output": "10\n11\n12\n13\n14\n15\n" }
```

Compared line by line; trailing spaces of a line and trailing empty lines are
ignored, everything else is exact. For tasks WITHOUT input (or with one fixed
input) and a fully determined output. Pair it with `code` rules, otherwise six
`writeln` calls pass a «write a loop» task.

### 5.3. `reference` — compare with the author's solution

```json
"check": { "kind": "reference", "tolerance": 0 }
```

On every test the author's `solution` is run too; the answers are compared
value by value (split by whitespace, numbers with `tolerance`). The simplest
choice when the answer is hard to express as a formula (sum of digits, loops,
string processing). Works with random tests. Costs: the solution is shipped in
the page source, and every test runs two programs.

### 5.4. `none`

No verdict: a sandbox for experiments («run this and change the number»).

## 6. Requirements to the code

```json
"code": { "require": ["for"], "forbid": ["while", "math"], "maxCalls": { "writeln": 1 } }
```

Checked on the program's TOKENS before the tests — a word inside a string or a
comment does not count. `require` — the word must occur; `forbid` — must not;
`maxCalls` — at most N occurrences of `name(` (for a method write its last
name: `writeln`, not `console.writeln`). A violation stops the check with a
reason in words. Use sparingly: require the construct the lesson is about.

## 7. Determinism

- `random` in a checked program: the task must say «call `random.set_seed(42)`
  first», otherwise answers differ on every run. Better: avoid `random` in
  checked units.
- `time.now()` cannot be checked by exact comparison.
- `time.sleep()` really sleeps; the sum of pauses must stay well under
  10 seconds per test.

## 8. The host page: callbacks, events, methods

Only the full HTML form has these.

- Attributes on `<idyllium-unit>`: `on-solved="showBunny"`,
  `on-failed="…"`, `on-check="lms.report"` — NAMES of global functions of the
  page (a dotted path is allowed), not code. Same as `hooks` in the JSON. The
  function receives one object:

  ```js
  {
    unit: "circle-area",        // id
    verdict: "solved",          // or "failed"
    passed: 10, total: 10,
    attempt: 3,                 // Check presses since the page was loaded
    firstFailure: null,         // or { input, answer, reason } — reason is text
    code: "…"                   // only with feedback.shareCode = true
  }
  ```

- DOM events on the element (they bubble): `idyllium-ready`, `idyllium-run`
  (`detail`: `{ unit, output, error }`), `idyllium-check`, `idyllium-solved`,
  `idyllium-failed` (`detail` — the object above).
- Methods of the element: `getCode()` (returns a Promise), `setCode(text)`,
  `reset()`, `run()`, `check()`, `setTheme('light' | 'dark' | 'auto')`.
- Quick attribute overrides without touching the JSON: `rows`, `console-rows`,
  `font-size`, `theme`, `editor="light"`, `autocomplete="off"`, `format="off"`,
  `open-in-ide="off"`,
  `lang`, `accent="#0a7"` (accent color of the unit's buttons).
- From code: `IdylliumUnit.create(container, config)`.
- The student's draft is kept in the host page's `localStorage` per page path
  and unit `id`; «Сбросить» returns the starter.

## 9. Three verified examples

All three passed the builder's self-check on Idyllium 1.6.1. Save any of them
as `name.idyunit` and open it at `/authors/`.

### 9.1. Branching, fractional input — `formula`

```json
{
  "format": 1,
  "id": "circle-area",
  "title": "Площадь круга",
  "lang": "ru",
  "statement": "Программа читает радиус круга R (может быть дробным). Если R не отрицателен, выведите площадь круга, считая π = 3.14. Иначе выведите слово «Ошибка».",
  "starter": "use console;\n\nmain() {\n    console.write(\"Введите радиус: \");\n    float R = console.get_float();\n    \n}\n",
  "solution": "use console;\n\nmain() {\n    console.write(\"Введите радиус: \");\n    float R = console.get_float();\n    if (R >= 0) {\n        console.writeln(3.14 * R * R);\n    }\n    else {\n        console.writeln(\"Ошибка\");\n    }\n}\n",
  "inputs": "some",
  "tests": [
    { "in": "2" }, { "in": "0" }, { "in": "0.5" },
    { "in": "-0.5" }, { "in": "-1" }, { "in": "-3" },
    { "random": 1, "range": [-20, 20], "times": 4, "kind": "float", "digits": 1 }
  ],
  "check": { "kind": "formula", "tolerance": 0.001, "rules": [
    { "when": "{in1} >= 0", "expr": "{outs} == 1 and {out1} == 3.14 * {in1} * {in1}" },
    { "when": "{in1} < 0", "expr": "{line1} == \"Ошибка\"" }
  ] },
  "code": { "require": ["if"], "forbid": [], "maxCalls": {} }
}
```

The solution's answers: `2` → `12.56`, `0` → `0`, `0.5` → `0.785`, `-0.5` →
`Ошибка`. The tests `-0.5` and `-1` are what catches `R > -1`.

### 9.2. No input, exact output, code rules — `expect`

```json
{
  "format": 1,
  "id": "loop-10-15",
  "title": "Числа от 10 до 15",
  "lang": "ru",
  "statement": "Допишите цикл так, чтобы программа вывела числа от 10 до 15, каждое с новой строки.",
  "starter": "use console;\n\nmain() {\n    for (int i = ; i < ; i = i + 1) {\n        console.writeln(i);\n    }\n}\n",
  "solution": "use console;\n\nmain() {\n    for (int i = 10; i < 16; i = i + 1) {\n        console.writeln(i);\n    }\n}\n",
  "inputs": "none",
  "tests": [],
  "check": { "kind": "expect", "output": "10\n11\n12\n13\n14\n15\n" },
  "code": { "require": ["for"], "forbid": [], "maxCalls": { "writeln": 1 } }
}
```

The starter deliberately does not compile; the self-check answers with the
warning «Заготовка не компилируется. Если так задумано… — всё в порядке».
`maxCalls` stops six `writeln` calls in a row.

### 9.3. Answer hard to write as a formula — `reference`

```json
{
  "format": 1,
  "id": "digit-sum",
  "title": "Сумма цифр",
  "lang": "ru",
  "statement": "Программа читает целое неотрицательное число и выводит сумму его цифр.",
  "starter": "minimal",
  "solution": "use console;\n\nmain() {\n    int n = console.get_int();\n    int total = 0;\n    while (n > 0) {\n        total = total + mod(n, 10);\n        n = div(n, 10);\n    }\n    console.writeln(total);\n}\n",
  "inputs": "some",
  "tests": [
    { "in": "0" }, { "in": "7" }, { "in": "10" }, { "in": "999" }, { "in": "1000000" },
    { "random": 1, "range": [0, 1000000], "times": 5 }
  ],
  "check": { "kind": "reference", "tolerance": 0 },
  "code": { "require": ["while"], "forbid": [], "maxCalls": {} }
}
```

The solution's answers: `0` → `0`, `7` → `7`, `10` → `1`, `999` → `27`.

## 10. Checklist before handing a unit to the user

1. The solution is a complete Idyllium program (`use console;`, `main()`), uses
   only the eight unit libraries, and prints nothing but the answer (prompts —
   only with `console.write`, without a line break).
2. The starter does not already solve the task.
3. Tests: every branch, every boundary and its neighbours, fractional values
   when the input is `float`, no «lucky» equal values, several random tests for
   `formula`/`reference`; no random tests with `expect`.
4. `formula`: the `when` conditions cover all tests; the amount of output is
   pinned; `tolerance` fits the numbers.
5. JSON is valid: code is a JSON string with `\n` and `\"`; no comments, no
   trailing commas.
6. Tell the user: «Open it at https://aumphaadr.github.io/Idyllium/authors/
   («Открыть файл…»), look at the self-check, and copy the HTML from there».
