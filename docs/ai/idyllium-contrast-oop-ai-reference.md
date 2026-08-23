# Idyllium Contrast Reference — Part 3: The OOP Year

This file catalogs the **quiet errors and broken logic that mainstream languages
inflict on beginners learning objects**, topic by topic, and states **what
Idyllium does instead**. It is the third part of a series that follows the
course ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console year: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| 2 | GUI widgets: windows, buttons, fields, timers, events | Lazarus/Forms, Qt Widgets, tkinter, DOM+JS |
| **3 (this file)** | **OOP: classes, `this`, constructors, references, inheritance, overriding, encapsulation, contracts, statics, own events** | **Pascal, C++, Python, JavaScript** |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| 5 | JSON: parsing, building, saves, objects ↔ text | nlohmann/json, Python `json`, native JS `JSON` |
| 6 | Databases: opening, statements, rows, parameters, transactions | QtSql, Python `sqlite3`, `node:sqlite` |
| 7 | Networking: HTTP client, HTTP server, templates, forms, channels between programs, addresses | QtNetwork + cpp-httplib, `requests` + `http.server`, `fetch` + `node:http` |
| 8 | time, math at the edges, fixed-width integers, encodings, hashes, colors, images as data, sound, `system` | C++ standard library, Python standard library + PIL, JavaScript/Node built-ins |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-site-ai-reference.md` (how the site is *built*),
`idyllium-contrast-console-ai-reference.md` (part 1, where the guiding axiom is
stated in full).

Every Idyllium message quoted below is verbatim compiler or runtime output,
captured from a probe program. **The C++, Python and JavaScript columns were
also verified by running them** — g++ 13 with `-std=c++17`, CPython 3.12,
Node 22 — and every value marked "probed" in those columns is captured output.
The Pascal column is documentary.

---

## 0. What changes when the OOP year starts

The first two years asked the student to describe *actions*: do this, then that,
and if the button is pressed, do the other. The OOP year asks them to describe
*things* — and every language in this comparison answers three questions about
things differently:

1. **Is the set of a thing's properties fixed?** If a typo can invent a new
   property, then "a class lists what an object has" — the definition from the
   lesson — is false in the language the student is typing into.
2. **Is a variable holding a thing the thing, or a note about where it is?**
   Every language answers "a note" (except C++, which answers "both, depending
   on how you wrote it") — and almost none of them say so out loud until the
   day a student changes one object and two change.
3. **When two things are related, what does the language do on its own?**
   Inheritance is where languages differ most: what is inherited, what is
   shadowed, what is dispatched dynamically, and what quietly is not.

This year is also the one where the student's own code becomes the thing that
must be *read* by someone else — which is why the loudness of a diagnostic
matters more here than anywhere. A silent wrong answer in the console year cost
one wrong number; here it costs a wrong mental model of what an object is, and
that model is carried into every language they meet afterwards.

---

## 1. How to read the entries

Same shape as the rest of the series:

- **The child writes** — the plausible beginner code.
- **What other languages do** — one row per language, with a behavior class:
  - **QUIET** — wrong or surprising result, no diagnostic. The dangerous class.
  - **LOUD** — refuses or errors out with a message.
  - **CRYPTIC** — errors, but with a message a beginner cannot decode.
  - **OK** — behaves as a human would expect.
- **Idyllium's answer** — with the verbatim message.

Fairness note: the four comparison languages carry decades of production use,
and most behaviors criticized here are deliberate. C++'s slicing is a
consequence of value semantics that the language needs; Python's dynamic
attributes are the feature that makes Python Python. The question asked here
stays narrow: *what does this do to a thirteen-year-old writing their fourth
class?*

There is also a section — §15 — for the places where **Idyllium is the quiet
one**. There are three, and one of them is a case where JavaScript does better.

---

## 2. Is the list of properties closed?

**The child writes** a field name with a typo — the single most common mistake
of the first OOP month.

```
c.age = 3;
c.aeg = 4;     // опечатка
```

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | Fields are declared in the type; an unknown one is a compile error. |
| C++ | **OK, and helpfully** | Probed: `error: 'struct Cat' has no member named 'aeg'; did you mean 'age'?` — the compiler even suggests the intended name. |
| Python | **QUIET** | Probed: `c.aeg = 4` creates a **second attribute**; the object now has three, and `c.age` still holds the old value. No diagnostic, ever. |
| JavaScript | **QUIET** | Probed: identical — the object silently grows a third property. |
| **Idyllium** | **LOUD** | `compile error: type 'Pet' has no field 'nmae'` |

This entry decides whether the definition taught in the lesson survives contact
with the keyboard. "A class lists what its objects have" is true in Pascal, C++
and Idyllium, and false in Python and JavaScript — where a class is a suggestion
and any object may grow a field at any moment.

---

## 3. `this`: one meaning or several

**The child writes** a method that uses the object's own data, and later hands
that method to something else — an event, a callback, a timer.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | `Self` is the instance, always. |
| C++ | OK | `this` is the instance, always; it is a pointer, which costs an arrow instead of a dot. |
| Python | OK | `self` is the instance, always — at the price of writing it in every signature, including methods that do not use it. |
| JavaScript | **QUIET, and this is the flagship** | Probed: a method detached from its object (`const f = btn.handler; f();`) sees `this` as `undefined` and reads `undefined` out of it — no throw, no message. The same happens to every handler passed to an event, a timer or `map`. The cures — `bind`, arrow functions, `self = this` — must be taught *before* the first class that reacts to a click. |
| **Idyllium** | **OK** | `this` is the object the method was called on, and nothing changes that |

Probed on the case that breaks JavaScript — a handler attached **inside the
constructor**:

```idyllium
        this.plus.on_click = void function() {
            this.value = this.value + 1;
            this.refresh();
        };
```

Each object's handler touches its own fields, though the handler is written
once. This is the pattern the whole widget year is built on, and in JavaScript
it is exactly the pattern that requires the `this` lecture first.

Forgetting `this` is loud, and gives **two** messages for one mistake:

```text
compile error: variable 'age' was not declared in this scope
compile error: 'age' was not declared in this scope
```

One for the write on the left of `=`, one for the read on the right.

---

## 4. The constructor, and the object that was never constructed

| Language | Behavior | Detail |
|---|---|---|
| Pascal | **CRYPTIC** | A declared object variable is `nil` until `Create`. Using it gives `Access violation` — a message that says nothing about constructors to a child. |
| C++ | OK | A stack object is constructed by declaration; there is no uninitialized state to fall into (raw pointers are another story, and out of scope here). |
| Python | **CRYPTIC-ish** | `__init__` is a name that cannot be explained on the day it is first written. Forgetting to set an attribute surfaces later as `AttributeError`. |
| JavaScript | **OK** | `constructor` is a real word, and **an object cannot exist without it**: `new` is mandatory, so there is no blank-object state at all. Better than Idyllium here. |
| **Idyllium** | OK, with a gap | `constructor Cat(...)`, named like the class, with defaults and named arguments — but `Cat blank;` is legal and yields an empty object |

```idyllium
    Cat barsik = Cat("Барсик", 3);
    Cat murka = Cat("Мурка");                        // default argument
    Cat hero = Cat(ex_name = "Аранфир", ex_age = 7); // by name
    Cat blank;                                       // no call — a blank
```

The blank is not a crash (Pascal) and not an error (JavaScript): it is an object
whose fields are empty, and it stays quiet until something reads them. The
course makes a whole lesson out of it — see §15.

Argument-count mistakes are loud: `compile error: 'Truck' expects 0 arguments, got 2`.

---

## 5. The object is a reference

**The child writes** `b = a` for two objects and expects two things.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | (visible) | Objects are references and the `nil` ritual makes that obvious early — for the wrong reason, but obvious. |
| C++ | **QUIET, both ways** | `Cat b = a;` **copies** (and the default copy is shallow — probed: two objects end up sharing one pointer). `Cat& b = a;` and `Cat* b = &a;` do not. One language, two models, and which one runs depends on a character the student may not have typed. |
| Python | **QUIET** | Pure reference semantics, with no diagnostic anywhere in the topic. `a is b` exists but is not the operator anyone reaches for. |
| JavaScript | **QUIET** | Same. |
| **Idyllium** | **QUIET too — but taught, not discovered** | One model, no exceptions; the course gives it a whole book before arrays and composition |

This is an entry where no language is loud, because there is nothing to be loud
about — `b = a` is legal everywhere. The difference is curricular: the trap is
either met by accident (four languages) or opened deliberately, before the
lessons that depend on it.

```idyllium
    Battery mine = Battery("Мой", 80);
    Battery same = mine;

    same.drain(30);        // mutation: both names see it
    same = Battery("Запасной", 100);   // substitution: one name moves
```

The consequence in arrays is the same rule one level up, and probed: a cell is
a name, `array<Runner,2> copy = team;` copies the **cells** and shares the
**objects**.

---

## 6. Printing an object

**The child writes** `print(cat)` on the first day, because that is how you see
whether anything worked.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | LOUD | No implicit conversion; you call your own `ToString`. |
| C++ | **LOUD** | Probed: `error: no match for 'operator<<' (operand types are 'std::ostream' and 'Cat')` — verbose, but it refuses. |
| Python | **QUIET** | Probed: `<__main__.Cat object at 0x76b537ab8860>` — a hexadecimal address presented as if it were an answer. |
| JavaScript | **QUIET** | Probed: `[object Object]`, both from `String(c)` and from a template literal. The most-mocked string in the language, and it is what a beginner's first `console.log` of an object produces. |
| **Idyllium** | **LOUD, with the fix in the message** | see below |

```text
compile error: cannot print object of class 'Pet' directly — declare 'string function
to_string()' in class 'Pet' and printing will use it
```

With the contract declared, printing works everywhere at once — including
inside arrays (probed: `["кот Барсик", "кот Барсик"]`).

---

## 7. Comparing two objects

**The child writes** `a == b` for two cats with the same name.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | (rare) | Operator overloading exists in FPC but is rarely used for classes; comparison is done by hand. |
| C++ | **LOUD** | Probed: `error: no match for 'operator==' (operand types are 'Cat' and 'Cat')`. |
| Python | **QUIET** | Probed: without `__eq__`, `a == b` is **`False`** for two identical cats — identity comparison wearing the clothes of value comparison. No diagnostic. |
| JavaScript | **QUIET, and permanently** | Probed: `a == b` and `a === b` are both `false`, and there is **no way to define comparison** — operator overloading does not exist in the language. |
| **Idyllium** | **LOUD, with the fix in the message** | see below |

```text
compile error: cannot compare objects of class 'Battery' with '==' — declare
'bool function equals(Battery other)' in class 'Battery' and the comparison will use it
```

One declaration serves `==`, `!=`, `contains()` and array search at once
(probed). And contracts are **not inherited** — a descendant must declare its
own, because an inherited `equals(Cat)` would compare kittens by their cat half
and silently ignore everything the descendant added:

```text
compile error: cannot compare objects of class 'Kitten' with '==' — declare
'bool function equals(Kitten other)' in class 'Kitten' and the comparison will use it
```

---

## 8. Inheritance: what the descendant gets, and what it shadows

**The child writes** a descendant with a field whose name the parent already
uses — usually by accident, while copying the parent's declaration.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | **QUIET** | The descendant's field shadows the parent's; both exist in the object. |
| C++ | **QUIET** | Same: two members with one name, reachable as `Base::x` and `x`. Half the program can write one and read the other. |
| Python | **QUIET** | There is only one namespace per instance, so the descendant's assignment simply overwrites — the parent's value disappears with no trace. |
| JavaScript | **QUIET** | Same as Python. |
| **Idyllium** | **LOUD** | `compile error: class 'Truck' already has member 'wheels'` |

This is one of the few places where Idyllium is stricter than all four, and the
reason is worth stating to a student: a class with two fields of one name is a
class where "the value of `wheels`" is not a well-formed question.

Everything else about inheritance is unremarkable and the same everywhere:
fields and methods pass down, `extends` reads as "is a", and the descendant
reaches inherited members through `this` like its own.

Constructors are **not** inherited: `compile error: 'Truck' expects 0 arguments, got 2`.

---

## 9. Calling the parent constructor

**The child writes** a descendant constructor and forgets the parent — or puts
the call in the wrong place.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK-ish | `inherited Create(...)`; forgetting it leaves the parent half unset, silently. |
| C++ | **OK** | The base constructor runs **whether you write it or not** — a default-constructible base is constructed automatically, and a base without a default constructor is a compile error. There is no "forgot" state. |
| Python | **QUIET** | Probed: a `Child.__init__` without `super().__init__()` produces an object with the descendant's attributes and none of the parent's; `ch.plate` raises `AttributeError` later, somewhere else. |
| JavaScript | **LOUD** | Probed: `ReferenceError: Must call super constructor in derived class before accessing 'this'…` — **JavaScript catches this and Idyllium does not.** |
| **Idyllium** | **QUIET, deliberately** | three silent outcomes, see below |

Probed, all three:

| what the student does | what happens |
|---|---|
| `parent()` omitted | the parent half stays blank — `: колёс 0` |
| `parent()` called twice | the second call wins |
| **`parent()` called last** | the descendant's own work is **silently overwritten** |

The third is the interesting one: the descendant sets `this.wheels = 10;`, then
calls `parent(plate, 6)`, and ends with six wheels. Nothing is said, because
`parent()` fills the same fields and ran later.

This is the language's deliberate position — the order of statements in a
constructor is the author's business, not the compiler's — and the course
answers it by making the student run all three experiments by hand rather than
read about them. But it is a genuine quiet zone, JavaScript does better on the
first of the three, and §15 says so.

---

## 10. Overriding: signature, dispatch, and slicing

**The child writes** a family of shapes with an `area()` each, puts them in one
array, and loops.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK-ish | `virtual`/`override` required; the compiler warns when `override` is missing. |
| C++ | **QUIET, twice, and catastrophically** | Probed both. **(1)** A method without `virtual` dispatches statically: `Shape* p = &rect; p->area()` returns the **parent's** `0`, not `12`. **(2) Slicing:** `Shape s = rect;` copies the parent half only — probed, `s.varea()` returns `0` while the fields copied fine. Half an object, no diagnostic. |
| Python | **QUIET** | Probed: a descendant may override with a **different number of parameters** and the class is accepted; the failure arrives at the call as `TypeError: B.hi() missing 1 required positional argument`. |
| JavaScript | **QUIET** | Probed: same override, and it does not even fail at the call — the missing argument is `undefined` and the method runs. |
| **Idyllium** | **LOUD on the signature, OK on dispatch, no slicing** | see below |

```text
compile error: method 'B.hi' must match inherited method signature
```

Dispatch is dynamic without a keyword — no `virtual`, no `override` — and
probed on everything the topic needs:

```idyllium
    array<Shape, 3> shapes;
    shapes[0] = Rect(3.0, 4.0);
    shapes[1] = Circle(2.0);
    for (int i = 0; i < shapes.length; i = i + 1) { shapes[i].show(); }
```

```text
прямоугольник: 12
круг: 12.56
```

The parent's `show()` calls the descendant's `area()` (template method), a
factory declared `Shape function make(int)` returns descendants, `dyn_array<Shape>`
works, and `type_name()` reports the real class.

**There is no slicing.** Probed: a `B` passed into `void function show(A x)`
prints `B / B`; stored into `array<A,1>` it is still a `B`. Objects are
references, so the C++ failure mode cannot occur.

Through a parent-typed name only the parent's members are visible, and that is
loud: `compile error: type 'Shape' has no method 'diagonal'`.

---

## 11. Encapsulation: what `private` actually closes

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK, with a footnote | `private` is real, but in FPC's default mode it is visible within the whole **unit**, not just the class; `strict private` is the one that means what the lesson says. |
| C++ | **OK** | `private` and `protected` are real and checked at compile time. The best of the four. |
| Python | **QUIET** | Probed: `self.__money` is not hidden, only renamed — `x._Acc__money` reads it back, and a single underscore is pure convention. There is no access control in the language. |
| JavaScript | OK, recently | Probed: `#money` is genuinely inaccessible (even referencing it outside is a `SyntaxError`), while `_soft` is a convention anyone can read. Real privacy exists, but only since ES2022. |
| **Idyllium** | **OK, one rule, no footnote** | see below |

```text
compile error: member 'Account.money' is private and can only be used inside class 'Account'
compile error: member 'Account.secret' is private and can only be used inside class 'Account'
```

Fields and methods are closed by the same rule and the same message. And the
question worth asking of any language — **does the lock hold against
descendants?** — has a probed answer here: yes. A `class Child extends Account`
whose method reads `this.money` does not compile, with the same message.
`private` means "inside this class", with no exception for family.

The cost is stated in §15: there is no `protected`.

---

## 12. Static members

**The child writes** a counter of created objects.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK | `class var` and `class function`; readable. |
| C++ | OK, with ceremony | `static` members need a separate definition outside the class (pre-C++17), which is one of the topic's classic stumbling blocks. |
| Python | **QUIET** | Probed: a class attribute read **through an instance** works and returns a number, so the habit forms — and then `a.population = 99` creates an *instance* attribute that shadows the class one. Probed: the class counter stays at 2 while `a` reads 99 and `b` reads 2. Nothing is said. Declaration is `@staticmethod`, a decorator that must be taken on faith. |
| JavaScript | **QUIET** | Probed: `static population` read through an **instance** is `undefined` — no error, just a hole where the number should be. |
| **Idyllium** | **LOUD, three different rules** | see below |

```text
compile error: static field 'Cat.population' must be accessed through class 'Cat'
compile error: 'this' cannot be used in a static method
compile error: static field 'Cat.population' is not inherited — write 'Cat.population'
```

The third message is the one to notice. In Python and JavaScript statics **are**
inherited (probed: `Kid.population` reads the parent's counter), and in C++ the
descendant's static is literally the same variable — probed, `&Base::population
== &Kid::population`, and writing through the descendant changes the parent's.
That sounds convenient until two classes share a counter neither of them owns.
Idyllium refuses and names the correct spelling in the same breath.

Class constants exist and are usable where a constant is required — probed,
`array<int, Cat.MAX_KITTENS>` gives a length of 6.

---

## 13. Events a class declares itself

**The child writes** a class that has to tell the outside world something
happened — the end of the "user → author" arc that the whole GUI year set up.

| Language | Behavior | Detail |
|---|---|---|
| Pascal | OK, verbose | `TNotifyEvent` properties in the Lazarus style: a procedure type, a field, a property — four lines per event. |
| C++ | (framework only) | Plain C++ has no events; `std::function` members are hand-rolled. Qt's signals and slots are excellent but need `Q_OBJECT`, the moc preprocessor and a `QObject` base. |
| Python | **absent** | There is no event mechanism and no such word in the language; the pattern is a hand-kept list of callbacks (`self._handlers.append(fn)`) or a third-party library. |
| JavaScript | OK, but split | `EventTarget`/`CustomEvent` in the browser, `EventEmitter` in Node — two different mechanisms, and code does not move between them. Custom events also share one namespace with DOM events. |
| **Idyllium** | **OK, one word** | see below |

```idyllium
class Door {
    event on_opened;
    event on_sound(string text);

    void function open() {
        this.is_open = true;
        this.on_opened();
        this.on_sound("скрип");
    }
}
```

Subscribing is the same assignment the student has been writing all year for
`on_click`. The declaration word is the same one they have been *reading* all
year. And firing from outside is refused:

```text
compile error: event 'on_opened' can only be fired inside class 'Door' (through 'this')
```

Anyone may listen; only the object may announce. Encapsulation of events comes
from the design, not from discipline.

---

## 14. Summary: the quiet-error inventory of the OOP year

Legend: **yes** — the failure is quiet in that language; `—` — it refuses or
behaves as expected; a note in parentheses — it complains, with a caveat.

| # | Quiet failure | Pascal | C++ | Python | JavaScript | Idyllium |
|---|---|---|---|---|---|---|
| 1 | Typo in a field name creates a second field | — | — (suggests the right name) | **yes** (probed) | **yes** (probed) | — `has no field 'nmae'` |
| 2 | `this` changes meaning when a method is passed on | — | — | — | **yes** (probed: `undefined`) | — |
| 3 | Object used before it was constructed | **yes** (`Access violation`) | — | (`AttributeError` later) | — (`new` is mandatory) | **yes** — a blank, see §15 |
| 4 | `b = a` copies or aliases depending on a character | — | **yes** | — | — | — |
| 5 | Default copy is shallow | — | **yes** (probed) | n/a | n/a | n/a |
| 6 | Printing an object yields an address or `[object Object]` | — | — | **yes** (probed) | **yes** (probed) | — message names the fix |
| 7 | `==` silently compares identity, not value | (by hand) | — | **yes** (probed: `False`) | **yes** — and cannot be defined | — message names the fix |
| 8 | Descendant field shadows the parent's | **yes** | **yes** | **yes** | **yes** | — `already has member` |
| 9 | Parent constructor never called | **yes** | — (automatic) | **yes** (probed) | — (probed: `ReferenceError`) | **yes** — see §15 |
| 10 | Parent constructor called last, overwriting the descendant | n/a | n/a | **yes** | **yes** | **yes** — see §15 |
| 11 | Override without `virtual` calls the parent's method | — (warns) | **yes** (probed) | n/a | n/a | n/a — dispatch is always dynamic |
| 12 | Object sliced when stored in a parent-typed variable | — | **yes** (probed) | — | — | — objects are references |
| 13 | Override with a different signature accepted | — | — | **yes** (probed, fails at call) | **yes** (probed, does not fail at all) | — `must match inherited method signature` |
| 14 | `private` is a convention, not a rule | (unit-wide) | — | **yes** (probed: `_Acc__money`) | — (`#` since ES2022) | — checked, and holds against descendants |
| 15 | Static member read through an instance | — | — | **yes** (probed) | **yes** (probed: `undefined`) | — names the correct spelling |
| 16 | Statics silently shared with descendants | — | **yes** (probed: same address) | **yes** (probed) | **yes** (probed) | — `is not inherited` |
| 17 | Forgotten override of an "abstract" method | (abstract) | — (`= 0`) | (`@abstractmethod`) | **yes** | **yes** — see §15 |

The pattern of the year: the failures cluster where a language lets a **name**
mean something it was not declared to mean (a typo becoming a field, a
descendant field shadowing a parent's, a static read through an instance), and
where **a relationship between two classes is resolved silently** (static
dispatch, slicing, an unmatched override, an uncalled base constructor).
Idyllium's answer is the same in most cases — the name is declared or it is an
error, and the relationship is checked at compile time — with three deliberate
exceptions, below.

---

## 15. Honest residue: what Idyllium's OOP does not catch

1. **The three `parent()` experiments are silent** (§9). Omitted, doubled, or
   placed last — the language says nothing, and the third case *overwrites the
   descendant's own work*. This is a deliberate position: the order of
   statements in a constructor belongs to the author. But it is the one topic
   in the year where a quiet wrongness was kept on purpose, and on the first of
   the three **JavaScript does better** — it refuses to let `this` be touched
   before `super()`. Teaching material must run all three experiments by hand;
   never present `parent()` first as a style rule without showing what the
   other two orders actually do.
2. **There is no abstract method.** A parent method that *must* be overridden is
   written as a stub returning a placeholder, and a forgotten override yields a
   silent zero rather than a refusal. C++ has `= 0`, Python has
   `@abstractmethod`, Pascal has `abstract`. This is the largest genuine hole in
   the year.
3. **An object can be declared without its constructor.** `Cat blank;` is legal
   and produces empty fields; the wrongness surfaces wherever those fields are
   read, which may be far away. JavaScript forbids this outright by requiring
   `new`. The course turns it into a lesson (the "blank" and the checklist line
   that follows from it) rather than pretending it cannot happen.
4. **`private` exists, `protected` does not.** The lock is simple and holds
   against descendants, which is the right default — but the idiom "open to the
   family, closed to strangers" cannot be expressed.
5. **`main()` in an imported file is silently skipped**, and running a module
   file with no `main()` prints nothing and reports nothing. Named in the
   course's file-splitting book; still a quiet zone.
6. **Semantic errors are untouched, as everywhere.** A class that models the
   wrong thing, an `extends` where composition was meant (`class Engine extends
   Car` compiles and runs), a method that updates one field and forgets its
   pair — no compiler sees these. The course answers with the "is-a / has-a"
   sentence test and with the detective genre; see
   `idyllium-course-ai-reference.md`.

---

## 16. Rules for an AI using this file

1. **Declare every field.** Never generate code that relies on a field springing
   into existence on assignment — it is a compile error here, and the habit
   comes from Python and JavaScript.
2. **Always `this.` for the object's own members** inside methods. There is no
   implicit lookup, and the diagnostic for forgetting it arrives twice.
3. **`parent()` first, always** (§9), and when explaining why, show the third
   experiment rather than asserting the rule.
4. **Do not generate `virtual`, `override`, `super`, `self`, `__init__`,
   `@staticmethod`, `#private` or `Q_OBJECT`.** Overriding is by matching name
   and signature; the parent constructor is `parent(...)`; statics are `static`;
   privacy is a `private:` section.
5. **Declare contracts when the type is printed or compared** — `to_string()`
   and `equals()` — and remember they are **not inherited**: a descendant that
   is printed or compared needs its own.
6. **Access statics through the class**, never through an instance, and do not
   expect a descendant to inherit them.
7. **Do not simulate abstract classes with comments.** If a parent method must
   be overridden, say so in prose and make the stub's placeholder obviously
   wrong (not a plausible zero) — the language will not enforce it (§15.2).
8. **Prefer composition and say why.** Run the sentence test out loud in the
   explanation: "a truck is a vehicle" works, "a car is an engine" does not.
   The compiler accepts both.
9. **When a student arrives from another language, name the specific trap** from
   §14 that their habit came from — "in Python your typo made a second field and
   nothing was said; here it is a compile error" teaches more than "Idyllium is
   stricter". For JavaScript arrivals the two to name first are `this` in a
   detached handler (§3) and `[object Object]` (§6); for C++ arrivals, slicing
   and the missing `virtual` (§10).
10. **Do not promise catches from §15.**

---

## 17. Provenance

The catalog of language behavior comes from classroom observation across
Pascal, C++, Python and JavaScript courses for 10–15-year-olds, accumulated
before Idyllium existed and organized around the same five design criteria as
the rest of the series. **Three of the four comparison columns were verified by
execution** — g++ 13 (`-std=c++17`), CPython 3.12, Node 22 — and every value
marked "probed" is captured output, including C++ slicing and static dispatch,
Python's renamed-not-hidden private and silent attribute creation, and
JavaScript's detached `this`, `[object Object]` and silently accepted override.
The Pascal column is documentary and should be re-verified against a Free Pascal
build before being quoted as fact.

The Idyllium column is not opinion: every message and every value quoted was
produced by running a probe program through the current compiler, including the
polymorphism suite (parent-typed arrays, template method, factory), the
encapsulation probes (fields, methods, descendants), the contract suite
(`to_string`, `equals`, arrays, `contains`), the static rules and the custom
event mechanism. When the language changes, this file must be re-verified the
same way.
