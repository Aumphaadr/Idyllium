# Idyllium Contrast Reference — Part 8: The Remaining Libraries

This file catalogs the **quiet errors and broken logic that mainstream standard
libraries inflict on beginners**, topic by topic, and states **what Idyllium
does instead**. It is the eighth and last part of a series that follows the
course ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console year: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| 2 | GUI widgets: windows, buttons, fields, timers, events | Lazarus/Forms, Qt Widgets, tkinter, DOM+JS |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| 5 | JSON: parsing, building, saves, objects ↔ text | nlohmann/json, Python `json`, native JS `JSON` |
| 6 | Databases: opening, statements, rows, parameters, transactions | QtSql, Python `sqlite3`, `node:sqlite` |
| 7 | Networking: HTTP client, HTTP server, templates, forms, channels between programs, addresses | QtNetwork + cpp-httplib, `requests` + `http.server`, `fetch` + `node:http` |
| **8 (this file)** | **time, math at the edges, fixed-width integers, encodings, hashes, colors, images as data, sound, `system`** | **C++ standard library (+PIL/ctypes where C++ has nothing), Python standard library + PIL, JavaScript/Node built-ins** |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-site-ai-reference.md` (how the site is *built*),
`idyllium-contrast-console-ai-reference.md` (part 1, where the guiding axiom is
stated in full and where files and random numbers are covered),
`idyllium-contrast-canvas-ai-reference.md` (part 4 — sprites and game sound are
there; §10 below only adds what the library itself does),
`idyllium-contrast-http-ai-reference.md` (part 7 — the `url` library is covered
there, in §18).

Every Idyllium message quoted below is verbatim compiler or runtime output,
captured from a probe program on build 1.5.2 (re-verified after the 23 August
fixes to the audio and array-size paths). **The comparison columns were
verified the same way** — g++ 13.3 with `-std=c++17`, CPython 3.12.3 with
`datetime`, `math`, `codecs`, `hashlib`, `zlib`, `colorsys`, `ctypes` and
Pillow 10.2, Node 22.18 with `Date`, `Math`, `TextDecoder`/`TextEncoder` and
`BigInt`. Every value marked "probed" is captured output, in every column.

**On column choice.** These are small libraries, and for several of them C++ and
JavaScript have *nothing* in the standard library — there is no color type in
C++, no image type in Node, no transcoding table anywhere in the C++ standard
since `<codecvt>` was deprecated. Saying "nothing" is a fair verdict rather than
a dodge: a school course that needs the feature must then choose, install and
teach a third-party dependency, and that cost belongs in the comparison. Where a
widely-taught third-party answer exists (Pillow for images), it holds the column
and is named.

---

## 0. What this part is about

Parts 1–7 followed the course through its big topics. What is left is the
supporting cast: the libraries a program reaches for once, in the middle of
doing something else. A game needs a clock. A save file needs a checksum. A
drawing needs a color. A text file from 1998 needs a code page.

Two properties make this collection worth its own file.

**First, these are the libraries where "it returned something" is most likely to
be wrong.** A malformed date, an out-of-range color channel, a byte sequence
that is not valid UTF-8 — every one of them has a plausible-looking wrong
answer available, and the mainstream libraries hand it over: February 30 becomes
March 2, a hue of 400° becomes some color, a broken byte becomes `�`. Nothing
crashes; the program keeps running with a value nobody chose.

**Second, they are used once and rarely re-read.** A student debugging a game
loop reads the game loop. They do not re-read the one line that built a
timestamp two weeks ago. A wrong value that entered the program through a
supporting library is therefore hunted for in entirely the wrong place.

The question below is the series' usual one, and the answers are unusually
lopsided: **when the argument is impossible, does the library refuse or does it
invent?**

---

## 1. How to read the entries

Same shape as parts 1–7:

- **The child writes** — the plausible beginner code.
- **What other libraries do** — one row per ecosystem, with a behavior class:
  - **QUIET** — wrong or surprising result, no diagnostic. The dangerous class.
  - **LOUD** — refuses or errors out with a message.
  - **CRYPTIC** — errors, but with a message a beginner cannot decode.
  - **NONE** — there is nothing in the standard library; the ecosystem's answer
    is a dependency, and the comparison names it.
  - **OK** — behaves as a human would expect.
- **Idyllium's answer** — with the verbatim message.

---

## 2. The calendar that lies

**The child writes** "the meeting is on the 24th of September 2026 at 18:03".

```idyllium
use time;
use console;

main() {
    time.stamp s = time.create(2026, 9, 24, 18, 3);
    console.writeln(s.to_string(), " | week_day ", s.week_day, " | unix ", s.unix);
}
```

```text
2026-09-24 18:03:00 | week_day 4 | unix 1790272980
```

Probed. Now the same request in the other three:

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (`std::tm` + `mktime`) | **QUIET** | Months are 0-based (`tm_mon = 8` for September) and years are offset from 1900 (`tm_year = 126`). Two conventions, both silent. |
| Python (`datetime`) | OK | `datetime.datetime(2026, 9, 24, 18, 3)` — human numbering, and out-of-range values raise. |
| JavaScript (`Date`) | **QUIET** | `new Date(2026, 9, 24, 18, 3)` is **24 October**, probed: `2026-10-24T13:03:00.000Z`. Months are 0-based, days are not. Nothing is reported. |
| **Idyllium** | **OK** | `time.create(2026, 9, 24, 18, 3)` — every component in human numbering, and `month` reads back `1..12`. |

The JavaScript row is the single most reproduced beginner bug in this file. The
API mixes conventions inside one call: the year is a year, the day is a day, and
the month is one less than the month. There is no diagnostic, because 9 is a
perfectly valid month index.

**Now the impossible date.** The child writes February 30 — usually by
generating a date arithmetically.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (`mktime`) | **QUIET** | Probed: `2026-02-30` becomes `2026-03-02`, and `mktime` returns a valid `time_t`. Month 13 becomes January 2027 (probed). Normalization is the documented behavior and it is exactly what a beginner does not want. |
| Python (`datetime`) | **LOUD** | Probed: `ValueError: day is out of range for month`. |
| JavaScript (`Date`) | **QUIET** | Probed: `new Date(2026, 1, 30)` is `Mon Mar 02 2026`, and even the string form `new Date("2026-02-30")` yields March 2 rather than `Invalid Date`. |
| **Idyllium** | **LOUD, and names the date** | `runtime error: time.create() date 2026-02-30 does not exist` |

Two more Idyllium refusals from the same family, probed:

```text
runtime error: time.create() month must be between 1 and 12, got 13
runtime error: time.create() hour must be between 0 and 23, got 25
```

Leap years are handled rather than approximated — probed:
`time.create(2024, 2, 29)` gives `2024-02-29 00:00:00`, while 2026-02-29 would
be refused by the message above.

---

## 3. Time zones, and the number that means "when"

**The child writes** a program that saves a timestamp and reads it back on
another computer.

Idyllium's `time.stamp` carries its zone, defaults to UTC everywhere, and keeps
`unix` invariant under zone changes — probed:

```text
2026-09-24 18:03:00 | tz UTC | unix 1790272980
2026-09-24 23:03:00 | (in_timezone "Asia/Yekaterinburg") | unix matches: true
```

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | NONE (before C++20) | `std::tm` has no zone field beyond `tm_isdst`; `mktime` interprets local time, `gmtime` produces UTC, and which one a program used is not recorded anywhere in the value. C++20 adds `std::chrono::zoned_time`; a school course using `-std=c++17` does not have it. |
| Python (`datetime`) | **QUIET by default** | A `datetime` is *naive* unless a `tzinfo` is attached, and a naive value silently means "local". Probed on a machine in UTC+5: `datetime(2026,9,24,18,3).timestamp()` is `1790254980`, while the same wall clock read as UTC is `1790272980` — an 18000-second difference, produced by an attribute the student never set. `datetime.utcnow()` is now deprecated precisely because it returned a naive value pretending to be UTC. |
| JavaScript (`Date`) | **QUIET, and inconsistent with itself** | Probed: `new Date("2026-09-24")` is parsed as **UTC** (`2026-09-24T00:00:00.000Z`), while `new Date("2026-09-24T18:03")` is parsed as **local** (`2026-09-24T13:03:00.000Z` on a UTC+5 machine). Adding a time to a date string changes which zone the date means. |
| **Idyllium** | **OK** | Zone is explicit, defaults to `"UTC"` on every host, travels with the value, and `in_timezone` never moves the instant. An unknown zone is refused: `runtime error: time.stamp timezone is unknown, got "Нарния"`. |

The invariant worth stating for a teaching language: **the same program produces
the same timestamp on every computer in the class.** In the Python and
JavaScript columns it does not, and the difference is a whole number of hours,
which is exactly the size of error that looks like a bug in the student's own
arithmetic.

---

## 4. Numbers at the edge

**The child writes** `sqrt` of a value that turned out negative — from a
distance formula, a discriminant, or a subtraction that went the wrong way.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (`<cmath>`) | **QUIET** | Probed: `sqrt(-1)` prints `-nan`, `log(0)` prints `-inf`, `log(-5)` is `-nan`, `asin(2)` is `nan`, `pow(0,-1)` is `inf`. The value then propagates: every comparison against a NaN is false, so the program takes the wrong branch quietly, forever. |
| Python (`math`) | LOUD, CRYPTIC | Probed: all five raise `ValueError: math domain error` — loud, and the message never names the function, the argument or the value. Five different mistakes, one sentence. |
| JavaScript (`Math`) | **QUIET** | Probed: `NaN`, `-Infinity`, `NaN`, `NaN`, `Infinity`. Same propagation problem as C++, plus `typeof NaN === "number"` and `NaN === NaN` is false (probed), so even the check is a trap. |
| **Idyllium** | **LOUD, and names all three** | `runtime error: math.sqrt() expects a non-negative number, got -1` |

The rest of the family, probed verbatim:

```text
runtime error: math.log() expects a positive number, got 0
runtime error: math.asin() value must be between -1 and 1, got 2
runtime error: math.pow() result is not a finite number
runtime error: math.clamp() min must be less than or equal to max (got min 10, max 0)
runtime error: math.round() digits must be between 0 and 25, got -1
runtime error: division by zero
```

The `clamp` row deserves attention. Probed: `std::clamp(15, 10, 0)` — that is, a
clamp whose minimum exceeds its maximum — returned `0`. The C++ standard calls
this undefined behavior; in practice it silently produces a number, and the
mistake (swapping the argument order, which differs between libraries) is one of
the most common in game code. Idyllium refuses.

`division by zero` is the same policy applied to the operator: both `1 / 0` and
`div(1, 0)` stop the program (probed) rather than producing `inf` (C++, JS) or,
in the integer case, crashing without a message (C++).

---

## 5. The integer museum: `types`

This is the one library in Idyllium that deliberately behaves *like* C. Its
purpose is to teach the machine's arithmetic, and it is an exception to the rest
of the language, which is why it is a library the student must import rather
than a property of ordinary numbers.

```idyllium
use types;

types.uint8 n = 253;
n = n + 1; n = n + 1; n = n + 1;   // 254, 255, 0
types.int8 s = 127;
s = s + 1;                          // -128
types.uint8 a = -11;                // 245
types.uint8 b = 260;                // 4
```

All probed. Wrapping is silent **on purpose**: the topic is what a fixed-width
cell does, and hiding it would defeat the lesson.

What is *not* borrowed from C is where the wrap happens:

```idyllium
types.uint8 x = 200;
types.uint8 y = 100;
console.writeln(x + y);      // 300 — the expression is an ordinary number
types.uint8 c = x + y;       // 44 — the write into the cell truncates
console.writeln(x.shift_left(1));  // 144, not 400 — methods stay in-type
```

Probed. The rule — *operators compute exactly, the consumer truncates; methods
compute inside the type* — makes the wrap visible at the assignment that causes
it, which is the line the student needs to look at.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | matching, plus UB | Probed: `unsigned char` 253+3 is 0, `int` overflow at `INT_MAX+1` gives `-2147483648`. But **signed** overflow is undefined behavior, not wrapping: the compiler may assume it never happens and delete the check the student wrote to detect it. The observed answer and the guaranteed answer are different things, and only one of them is teachable. |
| Python | NONE for the topic | Integers are arbitrary-precision (probed: `2**70` prints in full), so overflow cannot be demonstrated at all. `ctypes.c_uint8` reproduces it (probed: 253+3 = 0) at the price of a foreign-function-interface concept. |
| JavaScript | NONE, and quietly lossy | There are no integer types; numbers are doubles. Probed: `2**53 + 1` is `9007199254740992` — the increment silently vanishes. `BigInt.asUintN(8, 256n)` gives `0n` (probed), which is the wrap, in a separate numeric tower with its own literals. |
| **Idyllium** | **OK for teaching** | Exact ranges up to 64 bits (probed: `INT64_MAX` is `9223372036854775807`, `UINT64_MAX` is `18446744073709551615`, `2^53+1` in an `int64` stays `9007199254740993`), and `types.float32` really is binary32 — probed: `0.1 * 3` in a `float32` is `0.30000001`, while ordinary Idyllium floats print `0.3`. |

The last row is the point of the whole library. The student can *see* both
number systems side by side in one program: the honest school arithmetic the
language uses everywhere else, and the machine's, in a cell they declared on
purpose.

---

## 6. Encodings: strict unless told otherwise

**The child writes** a program that opens a text file a teacher sent — saved on
Windows in 1998, in `windows-1251`.

```idyllium
use encoding;
use console;

main() {
    dyn_array<int> w = encoding.encode("кот", "windows-1251");
    console.writeln(w.length, " bytes: ", w[0], " ", w[1], " ", w[2]);
    console.writeln("back: ", encoding.decode(w, "windows-1251"));
    console.writeln("wrong table: ", encoding.decode(w, "koi8-r"));
}
```

```text
3 bytes: 234 238 242
back: кот
wrong table: ЙНР
```

Probed. Decoding with the *wrong* table is a legal operation and produces
mojibake, because that is what really happens and the lesson is about
recognizing it. Decoding **invalid bytes** is a different thing, and it is
refused:

```text
runtime error: encoding.decode() invalid UTF-8 at byte 1 (0xEE): invalid continuation byte
```

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | NONE | There is no transcoding facility in the standard library. `<codecvt>` was deprecated in C++17 and removed in C++26; the practical answers are ICU or iconv, both dependencies larger than a school project. |
| Python (`codecs`) | OK | Probed: `b.decode('utf-8')` raises `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xea in position 0: invalid continuation byte` — strict by default, and the message is excellent. `errors='replace'` and `errors='ignore'` are opt-in; the second is the trap, probed: it returns `''`, an empty string, for text that failed to decode. |
| JavaScript (`TextDecoder`) | **QUIET by default** | Probed: `new TextDecoder('utf-8').decode(bad)` returns `"���"` with no error. The strict mode exists — `{fatal: true}` produces `TypeError: The encoded data was not valid for encoding utf-8` — and is off unless asked for. `TextEncoder` **only encodes UTF-8**: there is no way to write `windows-1251` at all. |
| **Idyllium** | **OK** | Strict by default in both directions; `safe=false` is the explicit opt-out, and then decoding yields `�` and unrepresentable characters encode to `?` (both probed). |

Two more Idyllium refusals, probed:

```text
runtime error: character 'к' is not valid ASCII at position 0
runtime error: unknown encoding 'cp-1251'
```

The first is the encode-side counterpart of the decode error: writing Cyrillic
into ASCII is refused rather than silently turned into `???`. The second is
worth noting because the name is *almost* right — the canonical spelling is
`windows-1251`, and `cp1251` is accepted as an alias. Both other ecosystems also
refuse unknown names (probed: `LookupError` in Python, `RangeError` in
JavaScript), which is a rare row where everyone behaves.

Eight encodings ship, including `cp866` and `cp437` with their box-drawing
characters — chosen for the course because the interesting historical text files
are in them.

---

## 7. Hashes

```idyllium
use hash;

hash.crc32("Idyllium");    // 190546014
hash.adler32("Idyllium");  // 239076170
hash.fnv1a("Idyllium");    // 3114801084
hash.sha256("Idyllium");   // 349ee7c92f67b13d599c0388a84931e2089941c43de526167116247bff9ee87a
```

All probed, and cross-checked against Python's `zlib` and `hashlib` on the same
input: `crc32`, `adler32` and `sha256` agree exactly (probed both sides).

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | NONE | No hash of this kind in the standard library. `std::hash` is for hash tables — unspecified, unstable across runs and implementations, and explicitly not a checksum. A student who reaches for it because the name matches gets a number that may differ next week. |
| Python | OK | `hashlib` and `zlib` cover everything here, with the same names. |
| JavaScript | NONE in the language, awkward in the host | Node has `node:crypto`; browsers have `crypto.subtle`, whose API is **asynchronous** — `await crypto.subtle.digest(...)` returns an `ArrayBuffer` the student must then convert to hex by hand. There is no CRC32 in either. |
| **Idyllium** | **OK** | Same four functions on every host, implemented in the language rather than delegated, so results are stable across CLI, Web IDE and VS Code. |

Two deliberate absences, and the course states both out loud: **there is no MD5
and no SHA-1** (both broken), and there is no password-hashing function, because
teaching `sha256(password)` as password storage would be teaching a real
vulnerability. The lesson says plainly that a fast hash is not enough and names
what is (salt plus a slow KDF).

Type discipline, probed:

```text
compile error: 'crc32' argument 1 expects string or byte array, got 'int'
runtime error: hash.crc32() byte at index 1 must be between 0 and 255, got 300
```

---

## 8. Colors: a type, not a string and not a tuple

**The child writes** a color and gets one letter wrong.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | NONE | No color type in the standard library. Graphics libraries each bring their own (`sf::Color`, `QColor`), so the answer depends on the framework, and channel validation varies with it. |
| Python | NONE for the type, QUIET for the math | Colors are tuples by convention; nothing checks them. The conversion helpers in `colorsys` accept anything: probed, `colorsys.hls_to_rgb(1.2, 5.0, -3.0)` returns `(12.2, 17.0, -7.0)` — three channels outside the legal range, no error. |
| JavaScript | **QUIET** | Colors are CSS strings. Assigning an unparseable value to `ctx.fillStyle` or a style property is **ignored** by specification: the previous color stays and nothing is reported. A typo (`"redd"`, `"#ff00"`) therefore paints the shape in whatever color was set last — documented, not probed here, as it requires a DOM. |
| **Idyllium** | **LOUD** | `runtime error: invalid HEX color '#gg0000'` |

Probed refusals, all of them cases the other columns accept or ignore:

```text
runtime error: invalid HEX color '#fff'
runtime error: colors.RGB() red must be between 0 and 255, got 999
runtime error: colors.RGBA() alpha must be between 0 and 1, got 1.5
runtime error: colors.HSL() hue must be between 0 and 360, got 400
```

And the type itself is enforced at compile time (probed):

```text
compile error: cannot assign 'string' value to 'colors.Color' variable
```

That last message is what makes the whole section work. In the JavaScript column
a color is a string, so a misspelled color is a valid string and the mistake
survives until someone looks at the screen. In Idyllium a color is a type; a
string is not one; the program does not start.

Two more properties worth knowing, both probed. Colors compare **by channel
value**, so `colors.RGB(255,0,0) == colors.HEX("#ff0000")` is `true` — an object
identity comparison here would be a trap for the same reason it is in part 3.
And every `with_*` method returns a new color: `r.with_alpha(0.5)` gives a
half-transparent copy while `r.alpha` stays `1` (probed), so a color handed to a
widget cannot be mutated behind that widget's back.

`colors.HSL(120, 100, 50)` is exactly `(0, 255, 0)` (probed), and the palette
constants are exact hex values listed in the language reference — `GREEN` is
`#00FF00`, the bright one, not the CSS legacy `green` that is half as bright.

---

## 9. Images as data

Part 4 covers images as *sprites* — loading a picture and drawing it. This
section is about the other half: an image as a grid of numbers the student
writes into.

```idyllium
use image;
use colors;

main() {
    image.Bitmap b;
    b.create(4, 4, colors.HEX("#102030"));
    b.set_pixel(0, 0, colors.RED);
    b.fill_rect(1, 1, 2, 2, colors.GREEN);
    b.export_to_file("out.png");
}
```

Probed, including reading it back: `image.Static` reports `4x4`, format `png`,
detected **from the file contents rather than the extension**.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | NONE | No image type, no PNG. The school answers are stb_image (a header, decode only unless you add stb_image_write) or Qt. |
| Python (Pillow) | OK, with one quiet hole | Probed: `getpixel((9,0))` on a 4×4 image raises `IndexError: image index out of range` — good. But `getpixel((-1, 0))` **returns a pixel** (probed: the background color from the far end of the row), because negative indices follow Python's list convention. An off-by-one that walks off the left edge of a loop reads the wrong side of the image instead of failing. Pillow is also lazy: `Image.open` returns before decoding (probed: pixel data not yet loaded), so a corrupt file fails later, at a line that does not mention the file. |
| JavaScript | NONE in Node | No image type; the ecosystem answer is the `canvas` package (a native dependency) or a browser `<canvas>` with `getImageData`, which returns a flat `Uint8ClampedArray` the student indexes by `(y * width + x) * 4`. Clamped means out-of-range channel values are silently clipped rather than refused. |
| **Idyllium** | **LOUD in both directions** | `runtime error: Bitmap.get_pixel() coordinates (9, 0) are outside bitmap bounds 4x4` |

Probed companions:

```text
runtime error: Bitmap.set_pixel() coordinates (-1, 0) are outside bitmap bounds 4x4
runtime error: Bitmap.create() result size 0x4 is invalid or too large
runtime error: Static.load_from_file() cannot load 'нет-такого.png': file does not exist
runtime error: Static.load_from_file() cannot decode 'i1.idyl': unsupported image format
```

The `(-1, 0)` row is the Pillow contrast made concrete: the same mistake, in one
library a refusal naming the bounds, in the other a pixel from somewhere else.

One more piece of type discipline, probed:

```text
compile error: 'set_image' argument 1 expects 'image.Image', got 'image.Bitmap'
```

A mutable `Bitmap` is deliberately not a GUI or canvas resource — `to_static()`
takes an independent snapshot first. This closes the aliasing question that
part 3 spends a whole book on: a widget can never be showing a picture that
another part of the program is still editing.

---

## 10. Sound

Part 4 compares game audio against PyGame, SFML and the browser, including the
autoplay rule and SFML's `SoundBuffer` lifetime trap. Only the library-level
facts belong here.

```idyllium
use audio;

audio.Sound s;
s.load_from_file("beep.wav");
s.volume = 0.5;
s.play();
```

Probed: `src` and `duration` (`0.2` for a 0.2-second WAV) read back, `volume`
is validated (`runtime error: Sound.volume must be between 0 and 1, got 2`),
playing before loading is refused (`runtime error: Sound.play() cannot play
audio before load_from_file()`), and a missing file is refused with the
file-library canon (`cannot load 'нет.wav': file does not exist`).

The format is read from the file's **signature**, not its extension — the same
rule the image library follows. Probed: a text file renamed to `fake.wav`,
`fake.mp3` or `fake.ogg` is refused identically, and an `.m4a` container is
refused too, since AAC is not among the accepted formats:

```text
runtime error: Sound.load_from_file() cannot decode 'fake.wav': unsupported audio format (WAV, MP3 and OGG are supported)
```

The check is a gate, not a decode: probed, a file that begins with `OggS` or an
ID3 tag but contains nothing else loads and reports `duration` 0. That is the
honest boundary of a signature test, and it is worth knowing before writing a
lesson that relies on `duration`.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (SFML) | LOUD, ignorable | `loadFromFile` returns `false` and writes a line to stderr; a student who does not check the `bool` gets silence (documentary). |
| Python (PyGame) | LOUD | `pygame.mixer.Sound` raises on an unrecognized file (documentary). |
| JavaScript (browser `Audio`) | **QUIET unless listened for** | The failure arrives as an `error` event or a rejected `play()` promise; ignoring both leaves silence with no console line (documentary). |
| **Idyllium** | **LOUD** | The message above, naming the file and the formats that would work. |

---

## 11. `system`: how deep, how to stop, and where am I

**The child writes** a recursive function with no base case. Every student does,
usually in the lesson that introduces recursion.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ | **the worst possible** | Probed: `Segmentation fault (core dumped)`, exit code 139. No message, no line number, no function name. The program that was working thirty seconds ago now says nothing at all. |
| Python | LOUD | Probed: `RecursionError: maximum recursion depth exceeded`. The default limit is 1000 (probed), which is low enough that legitimate recursion on a 2000-element structure also fails. |
| JavaScript | LOUD, but not reproducible | Probed: `RangeError: Maximum call stack size exceeded`, at depth **12530** in one probe — the limit depends on how much each frame holds, so the same program fails at a different depth after an edit. |
| **Idyllium** | **LOUD, named, and the same everywhere** | `runtime error: recursion depth limit of 20000 exceeded in function 'boom'` |

Idyllium counts call depth itself instead of relying on the host's stack, which
buys three things a beginner can use: the message **names the function** that
was looping; the limit is **identical on every host**, so a program that works
in the Web IDE works in VS Code; and it is a normal runtime error with
`file:line`, catchable by `try/catch` — so a recursive parser can defend itself
rather than dying.

The limit is adjustable within stated bounds, and the bounds are enforced
(probed):

```text
runtime error: system.set_recursion_depth() expects a value between 10 and 200000, got 5
```

Two smaller pieces of the same library, both probed. `system.platform()` returns
`"cli"`, `"web"` or `"vscode"` — the honest answer to "why does this behave
differently on the school computer", and the thing part 7's `channel` and this
part's `audio` both depend on. And `system.exit(3)` stops the program from
anywhere, **runs `finally` blocks on the way out** and is deliberately *not*
catchable by `try/catch` (probed: the `finally` ran, the `catch` did not, the
host reported exit code 3) — ending the program is a decision, not an error to
recover from.

---

## 12. Summary: the quiet-error inventory of the supporting libraries

| # | Situation | C++ | Python | JavaScript | **Idyllium** |
|---|---|---|---|---|---|
| 1 | Month numbering | **QUIET** (0-based, +1900 year) | OK | **QUIET** (0-based months only) | **OK** |
| 2 | February 30 | **QUIET** (→ March 2) | LOUD | **QUIET** (→ March 2) | **LOUD, names the date** |
| 3 | Time zone of a bare timestamp | none before C++20 | **QUIET** (naive = local) | **QUIET** (differs by string form) | **OK** (UTC, explicit, travels) |
| 4 | `sqrt(-1)`, `log(0)` | **QUIET** (`nan`, `-inf`) | LOUD, CRYPTIC (one message for five causes) | **QUIET** (`NaN`, `-Infinity`) | **LOUD, names function and value** |
| 5 | `clamp` with min > max | **QUIET** (UB; returned 0) | n/a | n/a | **LOUD** |
| 6 | Integer overflow | wraps (unsigned) / **UB** (signed) | impossible to show | **QUIET** (`2^53+1` loses 1) | **on purpose, in a named type** |
| 7 | Invalid UTF-8 bytes | no facility | LOUD (strict default) | **QUIET** (`�` by default) | **LOUD (strict default)** |
| 8 | Encoding to a table that cannot hold the text | no facility | LOUD | impossible (UTF-8 only) | **LOUD** |
| 9 | Checksum | none (`std::hash` is not one) | OK | none (+ async digest) | **OK, host-stable** |
| 10 | Misspelled color | framework-dependent | **QUIET** (tuples unchecked) | **QUIET** (assignment ignored) | **LOUD, and a compile error for the type** |
| 11 | Out-of-range color channel | framework-dependent | **QUIET** (`colorsys` returns 12.2) | **QUIET** (clamped) | **LOUD** |
| 12 | Pixel at a negative coordinate | n/a | **QUIET** (wraps to the far edge) | **QUIET** (clamped arrays) | **LOUD, names the bounds** |
| 13 | Infinite recursion | **QUIET** (segfault, no message) | LOUD | LOUD, non-reproducible depth | **LOUD, names the function** |

| 14 | A file that is not audio, named `.wav` | LOUD, ignorable (`bool`) | LOUD | **QUIET** (event nobody listens to) | **LOUD, names the formats** |

Fourteen rows; twenty cells in the comparison columns are QUIET or undefined
behavior, and none in Idyllium's.

---

## 13. Honest residue: what Idyllium's supporting libraries still do not catch

1. **`is_playing` is not a promise of sound.** Even with a valid file, the
   property reports that playback was started, not that anything is audible —
   the browser's autoplay rule (part 4, §8) can postpone it. The name suggests
   more than the value knows.
2. **`time.stamp` has no arithmetic.** There is no "add three days" and no
   difference between two stamps; the student computes on `unix` seconds and
   converts back. That is honest arithmetic and it teaches something, but the
   calendar cases it does *not* handle — month lengths, daylight-saving jumps —
   are exactly the ones where hand-rolled second arithmetic goes wrong quietly.
3. **`math.round` is round-half-up, not banker's rounding.** Probed:
   `round(2.5)` is `3` and `round(-2.5)` is `-2` — the school convention, chosen
   deliberately, and different from Python's `round(2.5) == 2`. A student
   comparing results across languages will see a difference that nothing
   explains on the page.
4. **`float32` prints its own precision, ordinary floats hide theirs.** Probed:
   `0.1 * 3` is `0.30000001` in a `types.float32` and `0.3` in an ordinary
   float. Both are correct — the second is the language's display convention,
   covered in part 1 — but seeing both in one program without an explanation is
   confusing, and the `types` lesson is where that explanation has to live.
5. **Encoding names accept aliases, error messages do not suggest them.**
   Probed: `unknown encoding 'cp-1251'` is correct and gives no hint that
   `cp1251` and `windows-1251` both work. A "did you mean" would cost one line.

All five are trade-offs rather than defects, listed so that a reader can weigh
them.

One item that used to head this list is gone, and it was the only QUIET cell
Idyllium held in §12: `audio.Sound.load_from_file()` used to accept **any**
file, report `duration` 0 and let `play()` claim it was playing. It now reads
the file's signature and refuses what is not WAV, MP3 or OGG — §10 has the
message. The fix arrived with a lesson attached: the first attempt tested
*duration* instead of the signature, and rejected a valid WAV whose data
chunk is empty. A format test has to look at what the file says it is, not at
what it happens to contain.

---

## 14. Rules for an AI using this file

1. **Human numbering in `time.create`.** Months are `1..12`, days are days.
   Never generate a 0-based month, and never expect an impossible date to be
   normalized — it is a runtime error.
2. **Timestamps are UTC unless a zone is named.** `time.now()` and
   `time.from_unix()` default to `"UTC"` on every host. Pass an IANA name for
   anything else; there is no "local time" default to rely on.
3. **`stamp` components are properties, not methods.** `s.year`, `s.unix`,
   `s.week_day` — never `s.year()`.
4. **Do not expect NaN or Infinity from `math`.** Every operation that would
   produce one is a runtime error instead. Code that checks `if (x != x)` for
   NaN is meaningless here.
5. **`types` is opt-in and is the only place overflow happens.** Do not use it
   for ordinary counters; do not expect ordinary `int` to wrap.
6. **`encode`/`decode` are strict by default.** Only pass `safe=false` when the
   task explicitly wants replacement characters.
7. **Colors are `colors.Color` values, never strings.** Convert a hex string
   with `colors.HEX()`; assigning a string to a color property is a compile
   error. `with_*` methods return new colors and never mutate.
8. **`image.Bitmap` is for pixels, `image.Static` is for showing.** Call
   `to_static()` before handing a raster to a widget or a sprite; passing the
   `Bitmap` directly is a compile error.
9. **Do not invent `save_png()`, `stamp.add_days()`, `colors.parse()`,
   `hash.md5()` or `audio.Sound.loop`.** None of them exist; the last two are
   absent on purpose.
10. **Recursion has a countable limit, not a stack.** It is catchable, it names
    the function, and it is the same on every host. Do not propose raising the
    host's stack size.
11. **Check `system.platform()` before claiming a host-specific behavior**, and
    remember that some libraries refuse honestly outside their host rather than
    doing nothing (part 7, §17).
12. **When quoting a message from this file, quote it exactly**, and do not
    claim a behavior this file has not probed.

---

## 15. Provenance

Idyllium behavior: probed on the CLI host, build 1.5.2, one probe program per
claim. Every quoted Idyllium message is captured output. The hash results were
cross-checked against Python's `zlib.crc32`, `zlib.adler32` and
`hashlib.sha256` on the same input, and agree exactly.

Comparison columns, all run on the same machine:

- **C++**: g++ 13.3, `-std=c++17`. `<cmath>` for the numeric edges, `<ctime>`
  (`std::tm` + `mktime` + `strftime`) for dates, `<algorithm>` for `std::clamp`,
  plain `unsigned char`/`int` for overflow, and a recursive function compiled
  at `-O0` for the stack result (`Segmentation fault`, exit 139).
- **Python**: CPython 3.12.3 — `datetime`, `math`, `codecs` (via `str.encode`/
  `bytes.decode`), `hashlib`, `zlib`, `colorsys`, `ctypes`, and Pillow 10.2 for
  the image column. The timezone results were produced on a machine in UTC+5;
  the *difference* they demonstrate is what matters, not the particular offset.
- **JavaScript**: Node 22.18.0 — `Date`, `Math`, `TextDecoder`/`TextEncoder`,
  `BigInt`, and a recursive function for the stack limit.

Documentary, not probed, and marked as such in the text: the CSS-string color
behavior in browsers (§8, requires a DOM), the browser autoplay rule (§10,
covered by part 4), and the `<codecvt>` deprecation status (§6).
