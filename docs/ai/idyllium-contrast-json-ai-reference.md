# Idyllium Contrast Reference — Part 5: JSON, Saves and Structured Data

This file catalogs the **quiet errors and broken logic that mainstream JSON
tooling inflicts on beginners**, topic by topic, and states **what Idyllium
does instead**. It is the fifth part of a series that follows the course
ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console year: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| 2 | GUI widgets: windows, buttons, fields, timers, events | Lazarus/Forms, Qt Widgets, tkinter, DOM+JS |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| **5 (this file)** | **JSON: parsing, building, saves, objects ↔ text** | **nlohmann/json (C++), Python `json`, native JavaScript `JSON`** |
| 6 | Databases: SQLite, queries, records | sqlite3 bindings in C++/Python/JS |
| 7 | Networking: HTTP client, HTTP server, templates, forms, channels between programs, addresses | QtNetwork + cpp-httplib, `requests` + `http.server`, `fetch` + `node:http` |
| 8 | time, math at the edges, fixed-width integers, encodings, hashes, colors, images as data, sound, `system` | C++ standard library, Python standard library + PIL, JavaScript/Node built-ins |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-site-ai-reference.md` (how the site is *built*),
`idyllium-contrast-console-ai-reference.md` (part 1, where the guiding axiom is
stated in full), `idyllium-contrast-gui-ai-reference.md` (part 2),
`idyllium-contrast-canvas-ai-reference.md` (part 4).

Plain-text saves — writing and re-reading a file line by line, before JSON
enters — belong to the file section of part 1; this file starts where the save
stops being lines and becomes a *structure*.

Every Idyllium message quoted below is verbatim runtime or compiler output,
captured from a probe program. **The Python and JavaScript columns were also
verified by running them** (CPython 3, Node/V8); the C++ column describes
nlohmann/json's documented behavior and is marked where it is not probe-derived.

---

## 0. What changes when the JSON year starts

Up to this point every value the student handled was **born inside the
program**: a variable was declared with a type, an array had a length, a class
listed its fields. The compiler could see everything.

JSON breaks that. The text arrives from a file the student edited by hand, from
a classmate, from a web response — and its shape is *not known when the program
is compiled*. For the first time the student writes code whose correctness
depends on data that does not exist yet.

That single change is what makes this topic dangerous. Every construct here has
to answer the same question: **what happens when the data is not what the code
assumed?** There are exactly three possible answers, and only two of them are
acceptable:

1. **Say so, at the moment of the mismatch**, naming the key or index and the
   expected type.
2. **Refuse before starting** — a validity check the student runs on purpose.
3. Hand back something plausible-looking and stay silent.

The third answer is the subject of this document. It is also, in two of the
three comparison ecosystems, the *default*.

A second change matters for a Russian-language classroom: **the save file is
read by the child**. Not by a server, not by a library — by a twelve-year-old
who opens it in a text editor to see whether the program did what they meant.
A format that writes `{"\u0438\u043c\u044f": "\u0410\u043d\u044f"}` where the
child wrote `имя` has failed at its job regardless of standards compliance.

---

## 1. How to read the entries

Same shape as parts 1–4:

- **The child writes** — the plausible beginner code.
- **What other tooling does** — one row per ecosystem, with a behavior class:
  - **QUIET** — wrong or surprising result, no diagnostic. The dangerous class.
  - **LOUD** — refuses or errors out with a message.
  - **CRYPTIC** — errors, but with a message a beginner cannot decode.
  - **OK** — behaves as a human would expect.
- **Idyllium's answer** — with the verbatim message.

Fairness note: nlohmann/json, `json` and `JSON` are excellent at what they were
built for — moving data between programs written by professionals. Almost every
behavior criticized below is a deliberate, defensible choice in that context.
The question asked here is narrower: *what does this do to a twelve-year-old
whose save file has one wrong line?*

---

## 2. Parsing text that is not valid JSON

**The child writes** a save file by hand and leaves a trailing comma, or a
comment, or forgets a comma between two lines.

```json
{
  "name": "Аня",
  "age": 12
  "city": "Тюмень"
}
```

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | LOUD | Throws `json::parse_error`, whose text names the line and column and what the parser expected. Good message — but an *exception*, which means the student must already know `try`/`catch` to see it at all; an uncaught one reaches the console as `terminate called after throwing an instance of …`. |
| Python | LOUD | `json.JSONDecodeError: Expecting ',' delimiter: line 4 column 3 (char 30)` — accurate and positioned. |
| JavaScript | LOUD | Modern V8: `SyntaxError: Expected ',' or '}' after property value in JSON at position 13 (line 3 column 3)`. Also good. Older engines reported byte position only. |
| **Idyllium** | **LOUD** | `runtime error: json.parse() invalid JSON: expected ',' or '}' after object value at line 4, column 3` |

This is the one topic where all four are in the same class, and it is worth
saying so plainly: JSON parsers are, as a family, well behaved on malformed
input. The divergence starts *after* the text parses.

Two Idyllium specifics worth teaching:

```idyllium
json.is_valid(text)     // true/false — ask before parsing, no exception needed
json.parse(text)        // parses, or stops the program with the message above
```

`is_valid` exists so that a first-year-of-JSON program can check a file the
child edited without meeting exceptions first. The strictness is the real JSON
standard, verified by probe:

```idyllium
json.is_valid("{\"a\":1}")     // true
json.is_valid("{\"a\":1,}")    // false — trailing comma
json.is_valid("{'a':1}")       // false — single quotes
json.is_valid("{\"a\": +5}")   // false — leading plus
json.is_valid("{\"a\": 01}")   // false — leading zero
json.is_valid("{\"a\": .5}")   // false — bare fraction
json.is_valid("{\"a\": NaN}")  // false — NaN is not JSON
json.is_valid("{\"a\":1} tail")// false — trailing garbage
json.is_valid("")              // false
json.is_valid("  {\"a\":1}  ") // true — surrounding whitespace is fine
```

Note the last two rows against Python: `json.loads` *accepts* `NaN` and
`Infinity` on input, because it also emits them (§6). Idyllium refuses both
directions, so a file written by an Idyllium program is always readable by
every other JSON tool in the world.

---

## 3. The missing key — the flagship divergence

**The child writes** a reader for a save file, and the file is one version old:
it has `name` but not yet `level`.

```idyllium
    int level = root.get("level").to_int();
```

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | **QUIET** | `j["level"]` on a non-const object **silently inserts a null member** and returns it — the read *modifies the document*, and `get<int>()` on the fresh null then throws somewhere else. The safe form `j.at("level")` throws `json::out_of_range` naming the key, but `operator[]` is what every tutorial shows first. |
| Python | LOUD | `d["level"]` raises `KeyError: 'level'`. But `d.get("level")` returns `None` with no diagnostic, and `.get` is widely taught as the "safe" form — after which `None` travels until it meets an operator that rejects it. |
| JavaScript | **QUIET** | `obj.level` is `undefined`. Nothing is reported. The program continues; the error surfaces later and elsewhere: `TypeError: Cannot read properties of undefined (reading 'name')` — pointing at innocent code far from the missing key. |
| **Idyllium** | **LOUD** | `runtime error: json object has no key 'level'` — at the line that asked for it. |

This entry is the reason the JSON topic is in this document at all. In JS the
report arrives with the wrong address; in C++ the read silently *changes the
document you were reading*; in Python the loud form is right there but the
"safe" alternative is quietly wrong. Idyllium has one behavior, and the message
names the key.

The intended way to handle a genuinely optional field is to ask first — the
same shape a student already knows from arrays:

```idyllium
    int level = 1;
    if (root.has("level")) {
        level = root.get("level").to_int();
    }
```

`has()` is a question with a yes/no answer, not a lookup that returns a
mysterious absent value. There is no `undefined` and no `None` in the language
to leak into arithmetic later.

---

## 4. The wrong type

**The child writes** `to_int()` on a field the file spells as a string —
`"age": "12"` instead of `"age": 12`, which is exactly what happens when the
data came from a form or a spreadsheet export.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | LOUD / **QUIET** | `get<int>()` on a string throws `json::type_error` naming both the required and the actual type. But `get<int>()` on the number `3.5` **truncates to 3 silently** — numeric conversions inside `get` are permitted. |
| Python | **QUIET** | Values come back as native Python types, so `d["age"]` is the string `"12"`. `int("12")` succeeds silently — string and number become interchangeable, which is precisely the confusion the console year spent months dismantling. `int(3.5)` truncates to `3` silently. The failure only surfaces if the string is not numeric, and then as a `ValueError` far away. |
| JavaScript | **QUIET** | `obj.age + 1` on `"12"` produces `"121"`. The most-quoted JS wart, reached here through completely ordinary data. The bitwise idiom `3.5 \| 0` truncates to `3` silently. |
| **Idyllium** | **LOUD** | `runtime error: json value is string, expected int` — and for a fractional number, `runtime error: json value is number, expected int` |

Both messages name **what is there** and **what was asked for**. Neither
converts. Note in particular the second: asking `to_int()` of `3.5` is refused
rather than truncated, which is the same rule the language applies everywhere
else — `int r = 37 / 10;` is a compile error, `div(37, 10)` is the named
operation that means "throw the remainder away on purpose".

The type predicates make the check explicit when the data really is uncertain:

```idyllium
    json.Value v = root.get("age");
    if (v.is_int()) { ... } else if (v.is_string()) { ... }
```

Probed semantics, worth knowing exactly: JSON has a single number type, so
`is_int()` answers *"is this number integral?"* — true for `5` and for `5.0`,
false for `3.5` — while `is_float()` answers *"is this a number at all?"*,
true for all three. `is_string()`, `is_bool()`, `is_null()`, `is_object()` and
`is_array()` are exact.

---

## 5. Numbers: what survives the round trip

**The child writes** a program that stores an id — a long number from a real
system, a phone number, a bank-style account code.

```json
{"id": 12345678901234567890}
```

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | OK / QUIET | Integer tokens are kept as `int64`/`uint64` and survive exactly inside that range. Beyond it the value silently becomes a `double` and loses digits. |
| Python | OK | Arbitrary-precision integers; `12345678901234567890` round-trips exactly (probed). |
| JavaScript | **QUIET** | All numbers are IEEE doubles. Probed: `12345678901234567890` becomes `12345678901234567000`, and `9007199254740993` becomes `9007199254740992`. No warning of any kind. Half the digits of an id can change between reading a file and writing it back. |
| **Idyllium** | **OK** | Integer tokens are parsed exactly and re-serialized exactly, with no upper limit. |

Probed, end to end:

```idyllium
    json.Object o;
    o.add("id", json.Value(123456789012345678901234567890));
    console.writeln(o.to_json());
    // {"id":123456789012345678901234567890}
    console.writeln(json.parse(o.to_json()).to_object().get("id").to_int());
    // 123456789012345678901234567890
```

This is not a JSON feature — it falls out of the language's `int` being exact
at any size. `to_int64()` and `to_uint64()` exist for programs that must
interoperate with fixed-width systems and want the range enforced.

The reverse hazard — **non-finite numbers escaping into a JSON file** — is
closed at the root:

| Ecosystem | `NaN` / `Infinity` on output | Consequence |
|---|---|---|
| C++ (nlohmann) | written as `null` | the number becomes an absence, silently |
| Python | written as `NaN` / `Infinity` (probed: `{"x": NaN, "y": Infinity}`) | **produces text that is not JSON**; every strict parser elsewhere rejects the file |
| JavaScript | written as `null` (probed) | same silent absence as C++ |
| **Idyllium** | cannot arise | `1.0 / 0.0` is `runtime error: division by zero`; the value never exists to be written |

---

## 6. Creating a key versus updating a key

This is the entry with no counterpart in the other three ecosystems.

**The child writes** a builder for a save file and, editing later, adds the same
key twice — or means to update a value and mistypes the key.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | QUIET | `j["hp"] = 100;` creates or overwrites; the two operations are the same glyphs. A typo in the key silently creates a second member, and the original keeps its old value. |
| Python | QUIET | `d["hp"] = 100` — identical situation. `d["hpp"] = 100` adds a second key, no diagnostic. |
| JavaScript | QUIET | `obj.hp = 100` — same, plus the typo variant `obj.hpp = 100` which also silently succeeds. |
| **Idyllium** | **LOUD both ways** | `add` requires the key to be **new**; `set` requires it to **exist** |

```idyllium
    json.Object hero;
    hero.add("hp", json.Value(1000));
    hero.add("hp", json.Value(500));
    // runtime error: json object already has key 'hp'

    hero.set("hpp", json.Value(500));
    // runtime error: json object has no key 'hpp'

    hero.remove("nope");
    // runtime error: json object has no key 'nope'
```

The design is a direct continuation of the console year's first big
distinction — `int a = 20;` declares, `a = 60;` assigns, and mixing them up is
an error rather than a silent second variable. A JSON object is the same idea
one level up: **creating a key and changing a key are different acts, and the
code says which one you meant.** A mistyped key cannot quietly become a new
field, which is the single most common way a save file grows garbage.

---

## 7. Duplicate keys in incoming text

**The child receives** a file where a key appears twice — usually because they
edited it by hand and copy-pasted a line.

```json
{"a": 1, "a": 2}
```

| Ecosystem | Behavior |
|---|---|
| C++ (nlohmann) | QUIET — last wins |
| Python | QUIET — last wins (probed: `{'a': 2}`) |
| JavaScript | QUIET — last wins (probed: `{"a":2}`) |
| **Idyllium** | **QUIET — last wins** (probed: `{"a":2}`, `length` is 1) |

Reported honestly: on *input*, Idyllium behaves exactly like the others, and a
duplicated key in a hand-edited file disappears without a word. See §14 for why
this one was not closed and what the course does about it.

The asymmetry is deliberate, though, and worth naming for a student: **the
language will not let your program create a duplicate key (§6), but it cannot
undo one that arrived in the text.** Reading is lenient because the standard
says the text is valid; writing is strict because that is where you still have
a choice.

---

## 8. Arrays and indices

**The child writes** a loop over a list of scores and goes one past the end.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | **QUIET / UB** | `j[5]` on an array of 3 **resizes the array to 6** with nulls and returns the new element. `j.at(5)` throws `json::out_of_range` naming the index. Same `operator[]`-versus-`at()` split as objects, with the more dangerous member being the shorter one. |
| Python | LOUD | `IndexError: list index out of range`. |
| JavaScript | **QUIET** | `arr[5]` is `undefined`; the error arrives later, elsewhere, in different words. |
| **Idyllium** | **LOUD** | `runtime error: json array index 5 out of bounds (size 3, valid indices 0-2)` |

The message names the size *and* the valid range, matching the language's own
array message from the console year, so the student reads a sentence they have
already met.

`json.Array` methods, all probed: `at`, `set`, `add`, `insert`, `pop`,
`remove`, `clear`, plus the read-only `length`. `set` and `insert` carry the
same range check as `at`.

---

## 9. Building JSON: what can be wrapped

**The child writes** a save routine and hands the whole game object to the
serializer.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | LOUD | A custom type without a `to_json` hook fails to compile — a template error, typically dozens of lines, mentioning types the student has never heard of. Loud, but CRYPTIC in shape. |
| Python | LOUD | `TypeError: Object of type Player is not JSON serializable` (probed) — clear. The usual workaround found online is `json.dumps(obj.__dict__)`, which **silently exports every attribute**, including ones meant to be internal (probed: `_secret` came out). |
| JavaScript | **QUIET** | `JSON.stringify(player)` succeeds and exports every own enumerable property — probed: `{"name":"Мира","level":7,"_secret":"токен"}`. Methods vanish. `JSON.parse` returns a **plain object, not an instance**: probed, `back instanceof Player` is `false` and `back.greet()` raises `TypeError: back.greet is not a function`. Nothing along that path says a word. |
| **Idyllium** | **LOUD, at compile time** | `compile error: json.Value() cannot wrap an object of class 'Hero' — build a json.Object from its fields instead` |

The Idyllium message is refused *before the program runs* and, unusually for a
refusal, it says what to do instead. The course teaches the explicit pair:

```idyllium
class Player {
public:
    string name;
    int level;

    json.Object function to_json() {
        json.Object obj;
        obj.add("name", json.Value(this.name));
        obj.add("level", json.Value(this.level));
        return obj;
    }

    void function from_json(json.Object obj) {
        this.name = obj.get("name").to_string();
        this.level = obj.get("level").to_int();
    }
}
```

Two lines per field, written by hand — and that is the point. The student sees
that the file format is a **decision**, not an automatic shadow of the class:
rename a field and the save files of last week still load, because the mapping
is visible and editable. The JS path teaches the opposite lesson, and teaches
it invisibly: the class disappears in transit, and the object that comes back
only *looks* like the one that left.

---

## 10. Serializing: what disappears on the way out

**The child writes** an object with a value that has no JSON counterpart.

| Case | C++ (nlohmann) | Python | JavaScript | Idyllium |
|---|---|---|---|---|
| `undefined` / absent value in an object | n/a | n/a | **silently dropped** (probed: `{a:1, b:undefined}` → `{"a":1}`) | no such value exists |
| `undefined` / function inside an array | n/a | n/a | **silently becomes `null`** (probed: `[undefined, fn]` → `[null,null]`) | no such value exists |
| function / method | compile error | `TypeError` | **silently dropped** | no such value exists |
| `NaN` / `Infinity` | `null` | `NaN` / `Infinity` — invalid JSON | `null` | cannot arise (§5) |
| non-string key | n/a (keys are strings) | **silently stringified**; probed: `{1: "a", "1": "b"}` → `{"1": "a", "1": "b"}` — a **duplicate key in the output** | n/a (keys are strings) | keys are strings by type |
| date/time value | manual | `TypeError` | **silently becomes a string** (probed: `"1970-01-01T00:00:00.000Z"`), and stays a string after `JSON.parse` | manual, by design |
| non-ASCII text | as written | **escaped by default** (probed: `{"имя": "Аня"}` → `{"\u0438\u043c\u044f": "\u0410\u043d\u044f"}`) | as written | as written (probed: `{"name":"Аранфир"}`) |

The last row is small in engineering terms and large in a classroom. A save
file the child cannot read is a black box; a save file they can open, find
their own name in, edit and reload is a *teaching instrument*. Idyllium writes
UTF-8 text as text, in both `to_json()` and `to_pretty_json()`.

Escaping of the characters that genuinely need it is exact and round-trips
(probed): `"он сказал \"привет\""`, `"C:\\путь\\файл"`, `"две\nстроки"`,
`"а\tб"` all come back byte-identical, and `\u041f\u0440\u0438\u0432\u0435\u0442`
in an incoming file decodes to `Привет`.

---

## 11. Two documents that look the same

**The child writes** a check: did the save file change since last time?

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (nlohmann) | OK | `operator==` compares by content; key order does not matter. |
| Python | OK | `dict == dict` compares by content (probed: `{"x":1,"y":2} == {"y":2,"x":1}` is `True`). |
| JavaScript | **QUIET** | `JSON.parse(a) === JSON.parse(b)` is **always `false`** — reference comparison (probed). The usual workaround, `JSON.stringify(a) === JSON.stringify(b)`, is also `false` when the keys are in a different order (probed). Both answers look like data comparisons and are not. |
| **Idyllium** | **OK** | `==` on `json.Value` compares by content; key order does not matter (probed: two documents with the same pairs in different order are equal) |

`value == null` and `value.is_null()` are both valid checks; teaching material
prefers `is_null()` because it reads as a question.

---

## 12. Containers are references — and that is consistent

Probed behavior, stated because it is the one place a student can be surprised
*without* a diagnostic:

```idyllium
    json.Array arr;
    arr.add(json.Value(1));

    json.Object o;
    o.add("list", json.Value(arr));

    arr.add(json.Value(2));              // changing arr AFTER nesting it
    console.writeln(o.to_json());        // {"list":[1,2]}  — the document changed too

    json.Value got = o.get("list");
    json.Array inner = got.to_array();
    inner.add(json.Value(3));
    console.writeln(o.to_json());        // {"list":[1,2,3]} — pulling out does not copy
```

`json.Object` and `json.Array` are reference types, like every other library
object in the language and like the student's own class objects. Wrapping does
not copy; extracting does not copy; a second name is a second name.

Python and JavaScript behave identically here (`dict`/`list` and objects/arrays
are references). nlohmann/json is the odd one out: `json` is a **value type**,
so `auto inner = j["list"];` takes a copy and edits to it never reach the
document — the mirror-image surprise, equally silent, which is why C++ code
uses `auto&` and beginners forget the ampersand.

Idyllium's answer is not "references are better" but "**one rule everywhere**":
the student learned it for class objects in the OOP year and it did not change
when the type came from a library.

---

## 13. The save file, end to end

The whole topic exists to serve one program shape, and it is worth showing what
that shape costs in each ecosystem. Idyllium, probed:

```idyllium
use console;
use file;
use json;

main() {
    json.Object save;
    save.add("player", json.Value("Аня"));
    save.add("level", json.Value(7));

    file.ostream fout = file.open("save.json", "write");
    fout.write(save.to_pretty_json());
    fout.close();

    file.istream fin = file.open("save.json", "read");
    string text = fin.read_all();
    fin.close();

    json.Object back = json.parse(text).to_object();
    console.writeln(back.get("player").to_string(), " уровень ", back.get("level").to_int());
}
```

The file on disk, verified:

```json
{
  "player": "Аня",
  "level": 7
}
```

Nothing in that program is JSON-specific ceremony: `file.open` with a
pronounceable mode, `read_all`, `to_pretty_json` with a default indent of 2
(`to_pretty_json(4)` and `to_pretty_json(0)` both probed; `0` yields the
compact form). No `with` block, no stream flags, no `ensure_ascii=False`, no
`std::setw`, no `fs.readFileSync(path, 'utf8')` where forgetting the second
argument silently yields a `Buffer`.

What the same program needs elsewhere, and what the student must learn *first*
in order to write it:

| Ecosystem | Ceremony before the first save works |
|---|---|
| C++ (nlohmann) | header-only dependency to install, `std::ofstream`, `<<` with `std::setw(2)`, exceptions for the read path |
| Python | `with open(..., encoding="utf-8") as f`, `json.dump(..., ensure_ascii=False, indent=2)` — two keyword arguments the student cannot guess and will not be told about until their file is unreadable |
| JavaScript | `fs.writeFileSync(path, JSON.stringify(obj, null, 2))` — the `null` middle argument (the replacer) is unexplainable on day one; the read path needs the `'utf8'` argument or returns bytes |

---

## 14. Summary: the quiet-error inventory of the JSON topic

Legend: **yes** — the failure is quiet in that ecosystem; `—` — it refuses or
behaves as expected; a note in parentheses — it complains, with a caveat.

| # | Quiet failure | nlohmann/json | Python `json` | JS `JSON` | Idyllium |
|---|---|---|---|---|---|
| 1 | Malformed text parses anyway | — | — | — | — |
| 2 | Missing key returns a plausible value | **yes** (`operator[]`, and it *inserts*) | (`.get` returns `None`) | **yes** (`undefined`) | — `json object has no key 'x'` |
| 3 | Missing-key error surfaces far from the cause | **yes** | (via `None`) | **yes** | — |
| 4 | String read as a number | — | **yes** (`int("12")`) | **yes** (`"12" + 1`) | — `json value is string, expected int` |
| 5 | Fractional number silently truncated to int | **yes** (`get<int>()`) | **yes** (`int(3.5)`) | **yes** (bitwise or-zero) | — `json value is number, expected int` |
| 6 | Large integer loses digits | **yes** (beyond 64-bit) | — | **yes** (beyond 2^53) | — exact at any size |
| 7 | `NaN`/`Infinity` written into the file | (as `null`) | **yes** (invalid JSON emitted) | (as `null`) | — cannot arise |
| 8 | Typo in a key creates a second key | **yes** | **yes** | **yes** | — `add`/`set` split |
| 9 | Adding an existing key silently overwrites | **yes** | **yes** | **yes** | — `json object already has key 'x'` |
| 10 | Duplicate key in incoming text | **yes** | **yes** | **yes** | **yes** — see §15 |
| 11 | Array index past the end | **yes** (`operator[]` resizes) | — | **yes** (`undefined`) | — names size and valid range |
| 12 | Class object serialized wholesale, private state included | — (compile error) | (via `__dict__`) | **yes** | — compile error naming the fix |
| 13 | Class lost on the way back; methods gone | n/a | n/a | **yes** (plain object) | — mapping is written by hand |
| 14 | Values silently dropped or turned into `null` on output | — | — | **yes** (`undefined`, functions) | — no such values |
| 15 | Non-string key silently stringified, may collide | n/a | **yes** (duplicate key emitted) | n/a | — keys are strings |
| 16 | Save file unreadable to its author (escaped non-ASCII) | — | **yes** (default `ensure_ascii`) | — | — |
| 17 | Two identical documents compare unequal | — | — | **yes** (reference; and key order) | — content comparison |
| 18 | Nested container copied when you meant a reference, or the reverse | **yes** (value semantics, missing `&`) | — | — | — one rule, same as class objects |

The pattern of the topic: the failures cluster where a tool **substitutes a
value for an answer** (`undefined`, `None`, an inserted null), where it
**converts without being asked** (string↔number, float→int, big int→double),
and where it **decides for you what the file should contain** (dropped keys,
escaped letters, `NaN` written as `null`). Idyllium's answer is the same in
every case: the question gets an answer or an error, never a substitute; no
conversion happens unless it is named; and what is written is what was built.

---

## 15. Honest residue: what Idyllium's JSON still does not catch

1. **Duplicate keys in incoming text are silently collapsed** (§7). Probed:
   `{"a": 1, "a": 2}` parses to a one-key object with `a = 2`, exactly like the
   other three. The JSON standard permits it, and rejecting it would make
   Idyllium unable to read files other tools produce. The course covers it
   explicitly in the errors lesson rather than pretending it cannot happen, and
   pairs it with the loud `add` refusal so the student sees both sides.
2. **A schema is not checked.** Nothing verifies that a save file has the keys
   your program expects until the moment each key is read. A file missing three
   fields reports the first one and stops. The `has()` + default pattern (§3)
   is the answer taught, and it is the student's responsibility to apply it.
3. **`is_int()` cannot tell `5` from `5.0`.** JSON has one number type, so this
   is a property of the format rather than of the library — but a student
   comparing "how it was written in the file" with "what the predicate says"
   will find them differing, and the material should say so before they trip.
4. **Numbers in exponent form parse and re-serialize as plain numbers.**
   Probed: `1e3` reads as `1000`. Correct, standard, and surprising to a child
   who wrote the file by hand and expects it back verbatim.
5. **Key order is preserved but not guaranteed to mean anything.** Probed: the
   order of `keys()` and of `to_json()` output matches insertion order. Do not
   teach it as a rule other tools will respect — many sort keys, and content
   comparison (§11) deliberately ignores order.
6. **Deep documents are not depth-limited.** Probed to 200 levels of nesting
   without complaint. A pathological file could exhaust the stack; nothing in a
   classroom will produce one, and no guard is offered.
7. **Semantic errors are untouched, as everywhere.** A save file with `"hp":
   -5`, a level number that does not match the map, a field spelled correctly
   but meaning something else — no parser sees these. This is the same residue
   named in every part of this series, and the course answers it with the
   detective genre rather than with tooling.

---

## 16. Rules for an AI using this file

1. **Never generate `.get(key)` for an optional field.** Use `has(key)` and a
   default, or let the loud error stand. Do not wrap JSON reads in defensive
   code that hides the message from the student.
2. **Use `add` for new keys and `set` for existing ones, deliberately.** If
   generated code calls `add` twice on the same key, it is a bug, not a style
   choice — the runtime will say so.
3. **Do not import idioms from the other three.** No `operator[]`-style
   creation on read, no `None`/`undefined` defaults, no `JSON.stringify(obj)`
   on a class instance, no reflection over fields. Objects convert through
   hand-written `to_json()` / `from_json()` methods (§9).
4. **Wrap values explicitly**: `json.Value(x)` for scalars, `json.Value(arr)`
   and `json.Value(obj)` for containers. `json.Value()` with no argument is
   JSON null, and `null` is assignable to `json.Value`.
5. **Write files with `to_pretty_json()`** when a human will open them —
   which, in this course, is nearly always. Reserve `to_json()` for network
   payloads and machine-to-machine text.
6. **Quote messages verbatim** when explaining an error to a student, and name
   the *specific* trap from §14 that their habit came from — "in JavaScript the
   missing key gave you `undefined` and the error appeared three functions
   later; here the line that asked for the key is the line that stops" teaches
   more than "Idyllium is stricter".
7. **Do not promise catches from §15.** Duplicate keys in an incoming file, a
   missing schema and semantic nonsense are the student's problem, and material
   should say so plainly.
8. **This topic sits after the OOP year.** Examples should look like the
   class-based code the student is writing in parallel — a `Player` with
   `to_json()`/`from_json()`, not a pile of loose `json.Object` variables in
   `main()`.

---

## 17. Provenance

The catalog of ecosystem behavior comes from classroom observation across C++,
Python and JavaScript courses for 10–15-year-olds, organized around the same
five design criteria as parts 1–4. Unlike earlier parts, the Python and
JavaScript columns here were additionally **verified by execution** (CPython 3
and Node/V8) rather than from documentation — every value marked "probed" in
those columns is captured output. The nlohmann/json column is documentary and
should be re-verified against a build before being quoted as fact.

The Idyllium column is not opinion: every message, every value and every
round-trip quoted was produced by running a probe program through the current
compiler and runtime, including the arbitrary-precision integer round trip, the
escaping table, the reference-semantics sequence, the validity table and the
file save-and-reload. When the language changes, this file must be re-verified
the same way.
