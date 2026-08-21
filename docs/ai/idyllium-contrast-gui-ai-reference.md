# Idyllium Contrast Reference — Part 2: The Widget Year

This file catalogs the **quiet errors and broken logic that mainstream GUI
toolkits inflict on beginners**, topic by topic, and states **what Idyllium
does instead**. It is the second part of a series that follows the course
ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| **2 (this file)** | **Widgets: windows, buttons, inputs, frames, images, styling, widget arrays, event senders, timers, modals** | **Lazarus/LCL, Qt Widgets, tkinter, DOM + JavaScript** |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| 5 | JSON: parsing, building, saves | nlohmann/json, `json` module, native JS |
| 6 | Databases: SQLite, queries, records | sqlite3 bindings in C++/Python/JS |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-contrast-console-ai-reference.md` (part 1, and the place where the
guiding axiom is stated in full).

Every Idyllium message quoted below is
verbatim output of the compiler, captured from a probe program. Toolkit
behavior is described for mainstream versions: Lazarus/LCL 2.x with the form
designer, Qt 5/6 Widgets (designer and code paths), the tkinter shipped with
CPython 3.x (including `ttk`), and browser DOM JavaScript (ES2015+).

---

## 0. What changes when the GUI year starts

The console year has one time — "while the program runs, top to bottom". The
widget year introduces a second one: **the program falls asleep and waits**.
Nothing runs until the user does something, and then a function the student
never called starts executing. Three structural facts shape every comparison
below.

**Fact 1: designer or no designer.** Lazarus and Qt Creator ship a visual form
designer; tkinter and browser JS do not. With a designer the student *sees*
the result before running and meets the concept "property" as a table of names
and values — excellent for forming the concept. The price is the mirror image
of the benefit: **the properties set with the mouse exist nowhere in the
program text**, and the student's mental model "everything my program does is
written in my program" quietly breaks. Idyllium has no designer: every widget,
coordinate and colour is a line of code, and the model stays intact. Both
choices are defensible; the course pays the designer's price knowingly and buys
back the loss with code that reads like a form description.

**Fact 2: who calls the handler.** The honest question a student asks in the
second lesson is "how does the button know about my function?". A framework
either answers it in code the student wrote (Qt's `connect`, JS's
`addEventListener`, Idyllium's `on_click = ...`) or hides the wiring in a file
the student must not open (Lazarus `.lfm`, Qt's `connectSlotsByName` magic).

**Fact 3: how much machinery leaks in.** The GUI year is where C++ hands
beginners `new`, raw pointers and `->`; where tkinter hands them `mainloop()`,
`IntVar` and the garbage collector; where the DOM hands them string event
names and `NodeList`. Every leaked concept is one the student cannot yet
defend on an exam, so it gets memorized as an incantation.

Legend used in the tables: **QUIET** — wrong or surprising with no diagnostic;
**LOUD** — refuses or errors with a message; **CRYPTIC** — errors, but the
message is undecodable for a beginner; **OK** — behaves as expected.

---

## 1. The first application: widgets and coordinates

**The child writes** their first window with a label and a button.

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | Drag from the palette, edit `Caption`, `Left`, `Top` in the Object Inspector. Zero lines of code, and the concept "property" lands perfectly. Two prices: the code is empty, so "where is my program?" has no good answer; and the naming split starts here — a label and a button carry `Caption`, a text field carries `Text`. |
| Qt | OK / CRYPTIC | Through the designer, as beautiful as Lazarus. Through code, the student meets `new`, raw pointers and `->` in the first lesson: `QPushButton *btn = new QPushButton("Привет", this);`. `new` without `delete` is correct here (the parent owns the child) — but that is a black box handed out as a rule. The project template is three files plus `ui->setupUi(this)`. |
| tkinter | CRYPTIC | Short and translatable (`Label`, `Button`, `place`), but: `mainloop()` is a black box in lesson one; every widget takes `root` as an invisible-in-meaning first argument; the window size is the **string** `'300x200'`; and there are three competing layout managers (`place`/`pack`/`grid`) that a single copied snippet will mix into a mess. |
| DOM + JS | OK | Unique advantage: the students already built the widgets in HTML/CSS, so "the designer" is a tool they know well. JS only animates what exists. |

**Idyllium's answer** — a widget is an ordinary object with ordinary
properties; there is no `new`, no pointer, no `->`, no layout manager, and no
hidden file:

```idyllium
use gui;

main() {
    gui.Window win;
    win.width = 400;
    win.height = 240;
    win.title = "Приложение";

    gui.Label label;
    label.x = 20;
    label.y = 20;
    label.text = "Привет";

    win.add_child(label);
    win.show();
}
```

- **One naming convention.** The text of a label, a button, a text field, a
  multi-line editor and a checkbox is `text` — every time. There is no
  `Caption`-versus-`Text` split to memorize.
- **Coordinates are numbers**, not a string with a letter in the middle.
- **`add_child` is the only parenthood mechanism**, and it is visible in the
  code — the same word for a window, a frame and a tab page.
- The window has no `mainloop()`: `show()` is the last line, and the program
  keeps living because a window is open. Closing the last window ends the
  program, which is how an "Выход" button is written (`win.close()`).

---

## 2. The button and the click — the parentheses trap

**The child writes** a handler and attaches it. This is the single most famous
quiet failure of beginner GUI programming.

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK / hidden | Double-clicking the button in the designer generates `procedure TForm1.Button1Click(Sender: TObject)`. A working reaction in one minute — but not one line of the program creates the link, so "how does the button know?" stays unanswered; deleting the procedure by hand breaks the project with an obscure error; and `Sender: TObject` hangs in the signature as dead weight until topic 12. |
| Qt | OK / CRYPTIC | Two paths. The designer path binds **by function name** (`connectSlotsByName`): rename the button and the handler **silently stops working** — no error, no warning. The code path is the honest one: `connect(ui->btn, &QPushButton::clicked, this, &MainWindow::onClick);` — who, on what event, calls what, all visible. The price is `&Class::method`, which must be handed out as a template. |
| tkinter | **QUIET — the legend** | `command=click` — **without parentheses**. Students trained for a year to always call functions with `()` write `command=click()`; the function then runs **once, while the button is being created**, and the click does nothing. No error, the program "works". Explaining it needs "a function is an object" — far above this level. |
| DOM + JS | **QUIET** | `btn.addEventListener('click', doStuff)` has the same parentheses trap, plus the event name is a **string**: `'clik'` is not a typo anyone checks — the button is simply dead. And there are three competing ways to bind (`addEventListener`, `onclick =`, `onclick="doStuff()"` in HTML — the last one *with* parentheses), so "are brackets needed?" has no stable answer. |

**Idyllium's answer** — one way to bind, a typed property instead of a string,
and the parentheses trap turned into a compile error:

```idyllium
void function clicked(gui.Button sender) {
    sender.text = "Нажата!";
}

main() {
    gui.Button b;
    b.text = "Жми";
    b.on_click = clicked;      // correct
    b.on_click = clicked();    // compile error, see below
}
```

```text
compile error: callback property 'on_click' expects a function, got 'void'
compile error: type 'gui.Button' has no property 'on_clik'
compile error: callback property 'on_click' expects function(): void or function(gui.Button): void, got function(int): void
```

Three separate classroom disasters closed at compile time: the missing
function, the misspelled event, and the wrong handler signature. And because
`on_click` is a property of the object, the wiring is written by the student,
in the student's file, in one line — Qt's honesty without Qt's `&Class::method`.

---

## 3. The progress bar — property, getter/setter, or dictionary?

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | `ProgressBar1.Position := ProgressBar1.Position + 10;` — one property, read and write, exactly like a variable. |
| Qt | OK | `ui->bar->setValue(ui->bar->value() + 10);` — two methods instead of one property. Slightly wordier, and beginners confuse `value()` with `setValue()` for a while, but the convention is **absolutely uniform across the whole framework** (`text`/`setText`, `checked`/`setChecked`), which is worth a lot. |
| tkinter | **QUIET / CRYPTIC** | Classic `tk` has no progress bar at all — welcome to the parallel `ttk` universe. And the property is read through **a string key**: `pb['value'] = pb['value'] + 10`, so a widget suddenly behaves like a dictionary, while other properties used `config(text=...)`. A typo in the key raises at runtime, not at edit time. |
| DOM + JS | OK | `<progress>` with `.value` — a normal property. |

**Idyllium's answer** — `value`, `min`, `max` are ordinary typed properties on
`ProgressBar`, `SpinBox`, `FloatSpinBox` and `Slider` alike:

```idyllium
gui.ProgressBar p;
p.min = 0;
p.max = 100;
p.value = p.value + 10;
```

One name for one idea across four widgets, and a misspelled property is a
compile error rather than a silently created dictionary key.

---

## 4. Number input — and the type that comes back

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK / trap | `TSpinEdit.Value` and `TTrackBar.Position` — two neighbouring widgets for one idea ("a number"), two different property names. Small, but this is exactly how memorization replaces logic. |
| Qt | OK | `value()`/`setValue()` on both, `valueChanged(int)` on both. And a showpiece: `connect(ui->slider, &QSlider::valueChanged, ui->bar, &QProgressBar::setValue);` wires a slider to a progress bar with no handler function at all. |
| tkinter | **QUIET** | `spin.get()` returns a **string** even though the widget only produces numbers — hello `int(spin.get())`, the matryoshka from the console year. `Scale.get()` returns a number. Two number-input widgets, two return types. |
| DOM + JS | **QUIET** | `<input type="number">` — and `inp.value` is still a **string**. `Number(inp.value)` on every read, or silent string concatenation later (`'5' + 1 === '51'`). |

**Idyllium's answer** — the value of a numeric widget is a number, and the type
system says so:

```idyllium
gui.SpinBox s;
s.value = 42;
int doubled = s.value * 2;      // fine, s.value is int
string wrong = s.value;         // compile error: cannot assign 'int' value to 'string' variable
```

`gui.FloatSpinBox` covers fractional input with `float`. No conversion ritual
exists at all, because nothing was turned into text on the way out.

---

## 5. Text input, single-line and multi-line

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | `TEdit.Text` is simple. The `Caption`/`Text` split from topic 1 fires here ("why is the label different?"). `TMemo.Lines.Add(...)` maps nicely onto the arrays already learned. |
| Qt | LOUD / black box | `QLineEdit` follows the convention (`text()`/`setText()`), but `QTextEdit` has **no** `text()` — it has `toPlainText()`/`setPlainText()`. The error is honest and loud, but the answer to "why is this one different?" is "because it holds rich text", which is a black box. |
| tkinter | **CRYPTIC** | The multi-line `Text` widget is addressed with **string indices**: `text.get('1.0', 'end')` means "line 1, character 0" — lines numbered from one, characters from zero, in a single string with a dot. `'end'` grabs one extra newline, so the canonical read is `text.get('1.0', 'end-1c')`. Nothing here resembles anything learned before. |
| DOM + JS | OK / trap | `input.value` and `textarea.value` are uniform. The trap is elsewhere: `textContent` vs `innerHTML` vs `innerText` for output, with search results recommending all three. |

**Idyllium's answer** — `gui.LineEdit` and `gui.TextEdit` share one property
set, and reading is not a formula:

```idyllium
gui.LineEdit e;
e.placeholder = "введите имя";
e.echo_mode = "password";
e.on_change = changed;
string typed = e.text;

gui.TextEdit t;
t.text = "первая строка\nвторая строка";
```

The multi-line editor is the single-line editor with a taller box: same `text`,
same `placeholder`, same `on_change`. There is no second addressing scheme to
learn, and no `-1c` incantation.

---

## 6. Boolean input — checkboxes and radio buttons

**The child writes** "if the box is ticked, then…".

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | `if CheckBox1.Checked then` — reads as an English sentence and connects straight to the boolean type from the console year. Radio buttons group **by parent**, which is visible in the designer and prepares the frames topic. |
| Qt | OK | `isChecked()`/`setChecked()`, grouping by parent. Uniform with everything else in the framework. |
| tkinter | **QUIET — the worst of the year** | A `Checkbutton` **cannot be asked for its state**. It needs a mediator variable: `v = tk.IntVar()`, `Checkbutton(root, text=..., variable=v)`, then `v.get()`. `IntVar`/`StringVar` are "variables that are not variables": no `=` assignment, `get()`/`set()` instead, synchronized behind the scenes. And the killer: **forget `variable=v` and the checkbox still ticks visually** while being unreadable from code — a silent failure that looks like success. Radio buttons group by *shared variable*, inverting the concept used by every other toolkit. |
| DOM + JS | OK / trap | `cb.checked` is an honest boolean property — a pleasant surprise. Radio buttons group by the `name` attribute, and finding the selected one needs either a loop or the string incantation `document.querySelector('input[name="grp"]:checked')`. |

**Idyllium's answer** — the state is a boolean property of the widget itself,
and the group is a named string on each button:

```idyllium
gui.CheckBox c;
c.text = "Согласен";
if (c.is_checked) { ... }

gui.RadioButton tea;    tea.text = "чай";    tea.group = "напиток";
gui.RadioButton coffee; coffee.text = "кофе"; coffee.group = "напиток";
```

No mediator object exists, so the "forgot the variable" failure has nothing to
attach to. `is_checked` and `is_selected` read as questions, matching the
boolean type from the console year. See §16 for a current defect in
programmatic group selection.

---

## 7. Frames and parenthood

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | Drop widgets inside a `TPanel` with the mouse; nesting is visible on screen; `Panel1.Visible := False;` hides the whole family. The concept "parent" forms without a word of theory. |
| Qt | OK | Same in the designer; in code the parent is a constructor argument, and `frame->hide()`/`show()` are short and translatable. |
| tkinter | OK / CRYPTIC | The pedantic `tk.Button(root, ...)` finally pays off: change `root` to `frame` and the student *understands* what that first argument was for. Then hiding ruins it: there is no `visible` — the method depends on the layout manager (`frame.place_forget()`), the name means "forget the placement", and on re-show the frame **does not remember its coordinates**, so they must be stored by hand. |
| DOM + JS | OK | Nesting is HTML the students already know; hiding is `el.style.display = 'none'` — a string value with its own vocabulary. |

**Idyllium's answer** — one parenthood verb and one visibility property:

```idyllium
gui.Frame f;
f.title = "Настройки";
f.add_child(check1);
f.add_child(check2);
win.add_child(f);

f.visible = false;    // the whole family disappears; coordinates are kept
```

`add_child` is the same method a window uses, `visible` is the same boolean a
button has, and re-showing needs no stored coordinates. `enabled = false` is
the neighbouring concept, also inherited by children — a dimmed group instead
of a hidden one.

---

## 8. Combo boxes

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK / trap | `Items` in the designer, `ItemIndex` for the selection (with `-1` for "nothing", a nice bridge to arrays). Trap: the default style is **editable**, so a student can type free text into what was meant to be a fixed list, until `csDropDownList` is set. |
| Qt | OK | `addItem`, `currentIndex`, `currentText`, `currentIndexChanged`. Non-editable by default. Nothing to complain about. |
| tkinter | **CRYPTIC** | Not in classic `tk` — `ttk.Combobox` again. Selection events bind through a string incantation in double angle brackets: `cb.bind('<<ComboboxSelected>>', on_select)`, and the handler must accept a mysterious `event` argument. This is the **third** event-binding style in one course, after `command=` and plain `bind`. |
| DOM + JS | OK | `sel.value` and `sel.selectedIndex`, options written in HTML. Direct. |

**Idyllium's answer:**

```idyllium
gui.ComboBox c;
c.add_item("чай");
c.add_item("кофе");
c.on_change = selection_changed;
int i = c.selected_index;
string label = c.selected_text;    // read-only, follows the index
```

```text
compile error: property 'selected_text' is read-only
```

The list is filled by a method, the selection is an index (arrays again), the
event is the same `on_change` property used by sliders, spin boxes and
checkboxes — **not** a fourth binding style with a string name.

---

## 9. Images

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | `TImage`, the picture is chosen in the designer and visible immediately; from code, `Image1.Picture.LoadFromFile('cat.png')`. Reads as English. |
| Qt | **QUIET** | The image lives in a `QLabel` via `setPixmap` — already odd. The mine is the path: Qt Creator builds into a **separate directory**, so `cat.png` sitting next to the sources is not found — and not found **silently**: no error, just an empty rectangle. The canonical fix is the `.qrc` resource system with `":/images/cat.png"` — a whole extra topic. |
| tkinter | **QUIET — famous** | `PhotoImage` handles PNG and GIF but not JPEG (that needs Pillow). And the internet-famous bug: an image created inside a function is a local variable, so Python's garbage collector destroys it on return and **the widget shows nothing, with no error**. The ritual cure is `lbl.image = img`, explainable only through the garbage collector. |
| DOM + JS | OK | `img.src = 'cat2.png';` — one line, any format, instant. The best of the four. |

**Idyllium's answer** — the image is a normal object owned by the student's
code, and a missing file is loud:

```idyllium
use image;

image.Static pic;
pic.load_from_file("cat.png");

gui.ImageBox box;
box.resize_mode = "fit";
box.set_image(pic);
```

```text
runtime error: Static.load_from_file() cannot load 'нет-такой-картинки.png': file does not exist
```

Both quiet failures of the topic are gone: the file is either loaded or the
program says which path failed, and an image built inside a function keeps
living because the widget holds a reference to a real object — there is no
garbage-collector ritual to memorize. The format is detected from the file
contents rather than trusted from the extension.

---

## 10. Styling

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK / limited | `Font` and `Color` in the Object Inspector — visible and codeless. But the number-one childhood request, "I want a red button", breaks on reality: a standard `TButton` ignores colour on most widgetsets. Rounded corners, gradients and hover effects are not on the menu. |
| Qt | OK | The ace of the topic: `setStyleSheet("background-color: #e74c3c; border-radius: 10px;")` is real CSS. Gradients, radii, hover states — children are delighted, and they get a free head start on web development. One flaw: the style is a **string**, so a typo inside it is invisible — an unknown property is silently ignored. |
| tkinter | OK / split | For classic widgets, `btn.config(bg='red', fg='white', font=('Arial', 16, 'bold'))` is instant and short. But the `tk`/`ttk` split strikes again: the progress bar and combo box from topics 3 and 8 are `ttk` widgets and **cannot be styled this way at all** — they need `ttk.Style` with themes, a second incompatible styling system inside one program. |
| DOM + JS | OK | The students already know CSS, so `el.style.backgroundColor = 'red'` needs only one new fact (camelCase), and `classList.add/remove` teaches separation of look from logic. |

**Idyllium's answer** — two layers, both of them ordinary properties:

```idyllium
btn.text_color = colors.WHITE;                      // typed colour property
btn.background_color = colors.RGB(231, 76, 60);

btn.style = "background-color: #e74c3c; color: white; border-radius: 10px; font-size: 16px;";
btn.style_hover = "background-color: #c0392b;";
```

- **Typed properties** (`text_color`, `background_color`, `border_color`,
  `font_size`) are checked at compile time and inherited by children, so the
  common cases never touch a string.
- **IdySS stickers** (`style`, `style_hover`, `style_active`) bring Qt's CSS
  superpower — gradients, radii, hover states — with the same associativity
  bonus, and every widget accepts them, so there is no `tk`/`ttk` split.
- **A red button is red.** Unlike LCL, the toolkit does not defer to a system
  theme that ignores the request.
- Window-wide `theme` (`"default"`, `"idyllium"`, `"dracula"`, `"breeze"`,
  `"oxygen"`) is the bottom layer; anything the student sets explicitly wins
  over it.

The one inherited weakness is Qt's: **typos inside a sticker string are silent**
(`backround-color`, `color: bananas` are dropped without a word), exactly like
real CSS. See §16.

---

## 11. Arrays of widgets

This is the topic where the designer-based toolkits pay for their convenience.

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | **QUIET / paradigm break** | The designer creates `Button1..Button10` by name and cannot make an array of them. Either write the tedious `B[1] := Button1; B[2] := Button2; ...`, or create widgets in code — which breaks the half-year habit "widgets come from the designer" and introduces `Create` and `Parent`, where a **forgotten `Parent` yields a silently invisible button**. |
| Qt | OK | If the course is already code-based, a loop with `new` is a direct continuation of the arrays topic; the parent in the constructor handles both ownership and display. The smoothest entry of the four. |
| tkinter | OK | The star hour of the dynamic lists from the console year: create in a loop, `buttons.append(b)`. Nothing new to learn — until the handlers are attached (topic 12, and it is a disaster). |
| DOM + JS | OK / trap | `createElement` + `appendChild` is translatable, and the two-step "create, then attach" even helps. But a **forgotten `appendChild` is a silently invisible button**, and `querySelectorAll` returns a `NodeList` that looks like an array and lacks half of its methods. |

**Idyllium's answer** — widgets are values, so an array of widgets is just an
array:

```idyllium
array<gui.Button, 10> buttons;

void function any_click(gui.Button sender) {
    sender.text = "нажата!";
}

main() {
    gui.Window win;
    for (int i = 0; i < 10; i = i + 1) {
        buttons[i].x = 20 + i * 60;
        buttons[i].y = 20;
        buttons[i].text = to_string(i);
        buttons[i].on_click = any_click;
        win.add_child(buttons[i]);
    }
    win.show();
}
```

No `new`, no pointers, no ownership rules, no paradigm break — the array type
is the same `array<T, N>` from the console year, and `dyn_array<gui.Button>`
works the same way when the count is dynamic. The one shared inheritance from
Lazarus and the DOM is that **a forgotten `add_child` is silent** (§16).

---

## 12. Which widget sent the event?

Ten buttons, one handler: how does the handler know who called it? This is the
question that decides whether the previous topic is usable.

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | The `Sender: TObject` parameter that hung uselessly in every handler since topic 2 finally fires: `(Sender as TButton).Caption := 'нажата!';`, with the numeric `Tag` property conveniently available for the index. Pedagogically the best-planted seed of the year — but it requires a cast (`as`) to be usable. |
| Qt | CRYPTIC | The standard path is `qobject_cast<QPushButton*>(sender())` — template angle brackets and a cast, formidable even to look at. The prettier path is a lambda capturing the index, which drags in `[=]`, capture semantics and arrow syntax. Either way, a serious conceptual surcharge. |
| tkinter | **QUIET — the legendary one** | `command=lambda: click(i)` inside a loop looks right, runs, and makes **all ten buttons call `click(9)`**: the lambda remembers the variable, not its value. Absolutely silent. The cure is `lambda i=i: click(i)` — "i equals i" — which cannot be explained without late binding in closures. |
| DOM + JS | OK | `event.target` is handed to every handler and translates instantly; no cast needed. And the closure-in-a-loop trap that JavaScript itself made famous **died with `var`**: a `let i` loop gives each iteration its own variable. The language that invented the trap is the one that fixed it. |

**Idyllium's answer** — the sender is an optional, **typed** parameter of the
handler:

```idyllium
void function any_click(gui.Button sender) {
    sender.text = "нажата!";
    sender.background_color = colors.GREEN;
}
```

```text
compile error: callback property 'on_click' expects function(): void or function(gui.Button): void, got function(gui.Label): void
```

Three things follow. There is **no cast**: `sender` is already a
`gui.Button`, so `sender.text` compiles — Lazarus's design without `as`, Qt's
capability without `qobject_cast`. There is **no closure trap**, because
nothing is captured: the handler is a plain named function and the identity
comes with the call. And the handler that expects the wrong widget type is
rejected at compile time, which the DOM's untyped `event.target` cannot do.

To carry an index rather than read the text, the course stores it in a parallel
array or a class field — the same technique the OOP year formalizes.

---

## 13. Timers

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | `TTimer` on the form, `Interval := 1000`, double-click for `OnTimer`, switch with `Enabled`. Three familiar actions, all words translatable. |
| Qt | OK | `QTimer` rides the already-learned `connect`: `connect(timer, &QTimer::timeout, this, &MainWindow::onTick); timer->start(1000);`. No new concepts at all. |
| tkinter | **QUIET** | There is no timer object. `root.after(1000, tick)` is a **one-shot** delayed call, so periodicity requires the function to re-order itself at the end of its own body — a function that (almost) calls itself, long before recursion is taught. Forget the inner `after` and it fires **once, then silence, with no error**. Stopping needs a saved id and `after_cancel`. And the parentheses trap returns: `after(1000, tick())` runs the function immediately and schedules `None`. |
| DOM + JS | OK / trap | `setInterval(tick, 1000)` is honest periodicity, `clearInterval(id)` stops it. The parentheses trap is still there (`setInterval(tick(), 1000)`), and stopping via an id is less obvious than a boolean. |

**Idyllium's answer** — a timer is an object with the same shape as every
other widget:

```idyllium
gui.Timer t;
t.interval = 1000;      // milliseconds
t.on_tick = tick;       // the same callback-property mechanism as on_click
t.start();
t.stop();               // keeps elapsed progress; restart() starts from zero
```

`running` is a read-only flag. Nothing re-orders itself, nothing is
one-shot-by-default, the handler is attached by the one binding mechanism the
student already knows, and `on_tick = tick()` is the same compile error as in
topic 2.

---

## 14. Modal windows and dialogs

| Toolkit | Behavior | Detail |
|---|---|---|
| Lazarus | OK | A second form is made the same way as the first, `Form2.ShowModal;` says what it does, and `ShowMessage`/`MessageDlg`/`InputBox` cover the quick cases in one line. |
| Qt | OK / heavy | `QMessageBox::information(...)` for one-liners; a custom `QDialog` with `exec()` and `accept()`/`reject()` is coherent but adds three files and a lesson on "what `exec` returns". |
| tkinter | **QUIET** | Ready-made `messagebox.showinfo(...)` is fine. A custom `Toplevel` window, however, is **not modal by default** — the main window keeps working — and modality is assembled from three incantations (`grab_set()`, `transient(root)`, `wait_window(win)`), the first of which has negative associativity. |
| DOM + JS | OK / trap | `alert`/`confirm`/`prompt` are one-liners, but they are the browser's own modal world (§part 1, topic 1), and `confirm` returns a boolean while `prompt` returns a string or **`null`** on cancel — which coerces to `0` in arithmetic. |

**Idyllium's answer** — one modal object with three ways to show it and honest
callbacks:

```idyllium
gui.Modal m;
m.title = "Вопрос";
m.message = "Точно выходим?";
m.confirm_text = "Да";
m.cancel_text = "Нет";
m.on_confirm = leave;
m.on_cancel = stay;
m.show_confirm();          // show_alert() — one button; show_input() — with a field
```

The answer arrives through the same callback-property mechanism as every other
event — there is no return value to interpret, no `null` to coerce, and no
three-incantation ritual to make the window modal.

---

## 15. Summary: the quiet-error inventory of the widget year

Legend: **yes** — the failure is quiet in that toolkit; `—` — it refuses or
behaves as expected; a note in parentheses — it complains, with a caveat.

| # | Quiet failure | Lazarus | Qt | tkinter | DOM+JS | Idyllium |
|---|---|---|---|---|---|---|
| 1 | Handler attached **with** `()` runs once and never again | — | — | **yes** | **yes** | compile error: `expects a function, got 'void'` |
| 2 | Event name misspelled in a string | n/a | n/a | **yes** (`'<<ComboboxSelected>>'`) | **yes** (`'clik'`) | compile error: no such property |
| 3 | Handler has the wrong signature | — | (compile error) | **yes** | **yes** | compile error naming both accepted forms |
| 4 | Renaming a widget breaks its designer-bound handler | — | **yes** | n/a | n/a | n/a — binding is written in code |
| 5 | Checkbox ticks but cannot be read (`variable=` forgotten) | — | — | **yes** | — | n/a — state is a property of the widget |
| 6 | Numeric input returns a string | — | — | **yes** | **yes** | `value` is `int`/`float` |
| 7 | Assigning a number to a text property | — | (compile error) | **yes** | **yes** | compile error |
| 8 | Image not found | — | **yes** (build dir) | (format limits) | — | runtime error naming the path |
| 9 | Image collected by GC inside a function | — | — | **yes** | — | n/a — the widget holds the object |
| 10 | Widget created but never attached to a parent | **yes** (`Parent`) | — | — | **yes** (`appendChild`) | **yes** (`add_child`) — see §16 |
| 11 | All loop-created buttons report the last index | — | — | **yes** | — (fixed by `let`) | n/a — typed `sender`, no capture |
| 12 | Cast required to use the sender | (`as`) | (`qobject_cast`) | n/a | — | none: `sender` is typed |
| 13 | Timer fires once and stops | — | — | **yes** | — | n/a — `Timer` is periodic |
| 14 | Custom window is not modal | — | — | **yes** | — | n/a — `show_confirm()` is modal |
| 15 | Style typo silently ignored | — | **yes** | (ttk split) | **yes** | **yes** inside `style` strings — see §16 |
| 16 | Widget hidden by a container forgets its position | — | — | **yes** (`place_forget`) | — | — |
| 17 | Two incompatible widget families in one program | — | — | **yes** (`tk`/`ttk`) | — | — |
| 18 | Property read through a string key | — | — | **yes** (`pb['value']`) | — | — |

The pattern is the same as in the console year: the failures cluster where a
toolkit replaces a **typed thing** with a **string** (event names, property
keys, style text, layout modes) or with a **hidden mechanism** (designer
bindings, mediator variables, garbage collection, closures). Idyllium's answer
is uniform — the widget is an object, its events and properties are typed
members of that object, and the wiring is one line the student writes.

---

## 16. Honest residue: what Idyllium's GUI still does not catch

1. **A forgotten `add_child` is silent.** The widget exists, has coordinates
   and text, and never appears. This is the same failure as Lazarus's forgotten
   `Parent` and the DOM's forgotten `appendChild`, and it is currently the most
   likely quiet error of the widget year. When writing teaching material, the
   `add_child` line goes into the very first example and into every checklist.
2. **String-typed enums accept anything.** `theme`, `orientation`,
   `resize_mode` and `echo_mode` store whatever string they are given and fall
   back to the default at render time — `s.orientation = "боком"` is stored and
   silently means "horizontal". This is deliberate CSS-like tolerance for
   `theme` and `orientation` (documented), but it is inconsistent with
   `file.open`, which validates its mode loudly.
3. **Typos inside `style` strings are silent** (`backround-color`,
   `color: bananas`) — inherited from the CSS model along with its power. The
   assignment itself is typed (`label.style = 42;` is a compile error), but the
   contents are not checked. Prefer typed properties (`text_color`,
   `background_color`, `font_size`) for anything a beginner sets, and reserve
   stickers for effects that have no property.
4. **The same widget can be given two parents.** Adding one button to both a
   frame and the window compiles and runs; the reference also warns that a
   widget passed to `add_tab()` must not also go to `add_child()`, or it is
   drawn twice.
5. **Radio group selection from code — **fixed**: assigning `is_selected = true` from code now deselects the rest of the group exactly like a click (named groups and the default one-window group alike). Toggling group members programmatically is safe.

---

## 17. Rules for an AI using this file

1. **One binding mechanism.** Attach handlers by assigning the callback
   property (`b.on_click = clicked;`). Never generate a string event name,
   never generate `addEventListener`-shaped code, never add `()` after the
   handler name.
2. **Prefer typed properties over `style` strings** for colours and sizes that
   a beginner sets: a typo in a property is a compile error, a typo in a
   sticker is silence.
3. **Always write `add_child`** in examples, immediately after the widget is
   configured, and mention it when a student reports "my widget is not
   visible" — it is the first thing to check.
4. **Use the typed `sender` parameter** for shared handlers instead of
   inventing per-widget closures or index captures; there is no cast and no
   capture semantics in this language.
5. **Do not import toolkit idioms.** No `IntVar`, no `pack`/`grid`, no
   `mainloop()`, no `new`, no `ui->`, no `.get()`/`.set()` pairs — widget state
   is read and written as properties.
6. **When a student arrives from another toolkit, name the specific trap**
   from §15 that their habit came from. "Idyllium checks this at compile time"
   is far less useful than "in tkinter `command=click()` silently ran once —
   here the same line is a compile error, which is why the parentheses are
   gone".
7. **Do not promise catches from §16.** If asked "will it warn me about a
   forgotten `add_child`?", the answer today is no.

---

## 18. Provenance

The catalog of toolkit behavior comes from classroom observation across
Lazarus/LCL, Qt Widgets, tkinter and browser-JavaScript courses for
10–15-year-olds, accumulated before Idyllium existed, and organized around the
same five criteria as part 1. The Idyllium column is not opinion: every message
quoted was produced by running a probe program through the current compiler.
When the language changes, this file must be re-verified the same way.
