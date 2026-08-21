# Idyllium Contrast Reference — Part 4: The Canvas Year

This file catalogs the **quiet errors and broken logic that 2D game frameworks
inflict on beginners**, topic by topic, and states **what Idyllium does
instead**. It is the fourth part of a series that follows the course ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| 2 | Widgets: windows, buttons, inputs, frames, images, styling, widget arrays, event senders, timers, modals | Lazarus/LCL, Qt Widgets, tkinter, DOM + JavaScript |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| **4 (this file)** | **Canvas and 2D games: primitives, the frame loop, keyboard, mouse, text, images, origin, sound, hit tests, collisions** | **SFML (C++), PyGame (Python), HTML Canvas (JavaScript)** |
| 5 | JSON and saves: text saves, JSON files, serializing objects | nlohmann/json, `json` module, native JS |
| 6 | Databases: SQLite, queries, relations | sqlite3 bindings in C++/Python/JS |

The save-file and JSON half of the games course (text saves → JSON files →
serializing game objects) belongs to part 5, not here.

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-contrast-console-ai-reference.md` (part 1, where the guiding axiom is
stated in full), `idyllium-contrast-gui-ai-reference.md` (part 2).

Every Idyllium message and value quoted
below is verbatim output of that compiler and runtime, captured from a probe
program. Framework behavior is described for SFML 2.x, PyGame 2.x and browser
HTML Canvas (2D context).

---

## 0. What changes when the canvas year starts

The console year has one time — "top to bottom". The widget year adds a second
— "asleep until the user does something". The canvas year adds a third, and it
is the strangest one yet: **the frame**. The program now runs sixty times a
second, wiping the world and drawing it again, and every question the student
asks ("why does my character teleport?", "why is there a smear?", "why does the
score grow by sixty per touch?") comes from that rhythm.

Three structural facts shape every comparison below.

**Fact 1: who writes the loop.** SFML and PyGame make the student write it by
hand — `while (window.isOpen())`, then events, then clear, then draw, then
display. Verbose, but the rhythm is visible in the student's own code. HTML
Canvas hides it inside a function that re-orders itself through
`requestAnimationFrame(loop)` — the same self-reordering shape as tkinter's
`after`, with the same failure ("it ran once and then silence"). Idyllium takes
a third route: the loop belongs to the runtime, the *body* of the frame is a
callback the student writes (`on_update`), and nothing re-orders itself.

**Fact 2: who remembers what was drawn.** HTML Canvas is pure immediate mode —
after `fillRect` there is no rectangle, only pixels; if you want to move it,
you must store its coordinates yourself. SFML is object-based: a shape is a
thing with setters. PyGame sits between (surfaces and `Rect`s). Idyllium is
object-based like SFML: `drawable.Circle` is a variable you keep, move and
rotate, and `canvas.draw(ball)` stamps its current state into the frame.

**Fact 3: this half-year is also the OOP half-year.** Immediate-mode Canvas
*forces* classes on the student (no object survives the frame, so state must
live somewhere) while giving the least help. Idyllium reaches the same
destination from the other side: drawables are already objects, so classes look
like the natural way to group them, and the OOP lessons and the game lessons
reinforce each other instead of competing for the same brain.

Legend used in the tables: **QUIET** — wrong or surprising with no diagnostic;
**LOUD** — refuses or errors with a message; **CRYPTIC** — errors, but the
message is undecodable for a beginner; **OK** — behaves as expected.

---

## 1. Primitives: rectangle, circle, line

| Framework | Behavior | Detail |
|---|---|---|
| PyGame | OK | One template for everything: `pygame.draw.rect(screen, RED, (x, y, w, h))`, `pygame.draw.circle(screen, RED, (x, y), r)`, `pygame.draw.line(...)` — "draw.what(where, colour, geometry)". A circle is centre plus radius, exactly as in geometry class. |
| SFML | OK / trap | Shapes are objects with setters — a direct continuation of the OOP semester. Two thorns: a circle is positioned by the **top-left corner of its bounding square**, not its centre, so "I put the circle where the user clicked and it landed down-right" happens in the first lesson; and lines with thickness do not exist — you rotate a thin rectangle instead. |
| HTML Canvas | CRYPTIC | `ctx.fillRect(x, y, w, h)` is fine, but a circle is a ritual: `beginPath()`, `arc(x, y, r, 0, Math.PI * 2)`, `fill()` — three calls and **radians**, for children who will meet radians in school a year later. Worse, colour is not an argument but **state**: `ctx.fillStyle = 'red'` tints everything drawn afterwards until changed — a hidden state machine, and the source of "why is my whole game red?". |

**Idyllium's answer** — every primitive is an object whose colour is its own
property:

```idyllium
use drawable;
use colors;

drawable.Rectangle r;
r.x = 10; r.y = 10; r.width = 100; r.height = 40;
r.fill_color = colors.RED;
r.border_width = 2;
r.border_color = colors.BLACK;

drawable.Circle c;
c.x = 200; c.y = 100; c.radius = 30;      // radius, not radians
c.fill_color = colors.BLUE;

drawable.Line l;
l.x1 = 0; l.y1 = 0; l.x2 = 300; l.y2 = 200;
l.color = colors.GREEN;
l.thickness = 3;                           // a real line with real thickness
```

- **No state machine.** Verified: drawing a red circle and then a circle whose
  `fill_color` was never assigned leaves the second one transparent — colour
  cannot leak between objects, so "everything is red" is impossible.
- **No radians** in the primitives topic; the circle is described the way a
  geometry lesson describes it.
- **A line is a first-class object** with thickness, `contains()` and
  collisions — the one thing SFML makes you fake with a rotated rectangle and
  Canvas leaves as raw pixels.

---

## 2. The frame loop and dynamics

| Framework | Behavior | Detail |
|---|---|---|
| SFML | OK | The loop is written by hand and visible whole: `while (window.isOpen())` → poll events → `clear()` → `draw()` → `display()`. Motion is a family of same-shaped setters (`setPosition`, `setRotation(45)`, `setScale`), so rotation is one line. |
| PyGame | OK / trap | Equally honest loop, and `clock.tick(60)` makes the frame budget visible. Two thorns: without `pygame.event.get()` the window freezes as "not responding" — an incantation required from the first program; and rotation **creates a new image of a different size**, so repeated rotation blurs the sprite and the student must learn "keep the original, always rotate that". |
| HTML Canvas | **QUIET / CRYPTIC** | The loop is a function that re-orders itself: `requestAnimationFrame(loop)`. Forget the re-order and it runs once, silently. And rotation is a matrix dance — `save() → translate() → rotate() → draw at minus-half-width → restore()` — five lines of incantation with negative coordinates, explainable only through coordinate systems. |

**Idyllium's answer** — the runtime owns the loop, the student owns the frame:

```idyllium
void function update(gui.Canvas canvas, float delta_time) {
    ball.x = ball.x + 2;
    ball.rotate(3);                 // one line, adds to the current rotation

    canvas.clear();
    canvas.fill(colors.WHITE);
    canvas.draw(ball);
}

main() {
    gui.Canvas canvas;
    canvas.framerate_limit = 60;
    canvas.on_update = update;
    ...
}
```

- **Nothing re-orders itself.** `on_update` is the same callback-property
  mechanism as `on_click` from the widget year; the "ran once and then silence"
  failure has nothing to attach to.
- **No mandatory event pump.** There is no `event.get()` whose absence freezes
  the window.
- **Rotation is one line**: `rotate(45)` adds to the current angle, `rotation`
  assigns it, and it rotates around the object's origin (§7) — no matrix, no
  image regeneration, no blur accumulation.
- `delta_time` (seconds since the previous frame) is handed to every update,
  and `framerate_limit` caps the rhythm.

---

## 3. Keyboard

The concept that decides this topic: **a key event is not a key state.** A shot
is fired on the event ("pressed just now"); walking is driven by the state
("still held"). A framework should give the student both.

| Framework | Behavior | Detail |
|---|---|---|
| SFML | OK | Both tools, both readable: `sf::Keyboard::isKeyPressed(sf::Keyboard::Left)` polls the state, `KeyPressed`/`KeyReleased` are events. Smooth movement comes out right by default. |
| PyGame | OK | The same two worlds (`KEYDOWN`/`KEYUP` events and `key.get_pressed()` polling); constants translate. Beginners struggle to pick the right tool, but the tools exist. |
| HTML Canvas | **QUIET** | `keydown` suffers **auto-repeat**: hold a key and events arrive with the OS typing delay, so movement stutters visibly. The cure is a hand-made "set of held keys" that nobody tells you to build. And a key can be identified three ways (`e.key`, `e.code`, the deprecated `e.keyCode` that still lives in every old tutorial). |

**Idyllium's answer** — one identification scheme, events only, and the
"set of held keys" pattern promoted to the documented standard:

```idyllium
dyn_array<string> pressed_keys;

void function on_key_pressed(gui.Canvas canvas, gui.KeyboardEvent evt) {
    if (not(pressed_keys.contains(evt.key))) { pressed_keys.add(evt.key); }
}

void function on_key_released(gui.Canvas canvas, gui.KeyboardEvent evt) {
    if (pressed_keys.contains(evt.key)) { pressed_keys.remove_at(pressed_keys.find(evt.key)); }
}

void function on_update(gui.Canvas canvas, float delta_time) {
    if (pressed_keys.contains("W")) { player.y = player.y - 2; }
    if (pressed_keys.contains("A")) { player.x = player.x - 2; }
}
```

`evt.key` is the only scheme: single characters arrive uppercased (`"W"`, `"Д"`,
`"7"`), special keys use readable names (`"ArrowLeft"`, `"Enter"`, `"Escape"`,
`" "` for space). Auto-repeat becomes harmless, because a repeated `keydown`
for a key already in the set changes nothing. The honest part: Idyllium has **no
state-polling call** — the set is the way, and it is in the reference so that
every student writes the same one (§12).

---

## 4. Mouse

| Framework | Behavior | Detail |
|---|---|---|
| PyGame | OK | `pygame.mouse.get_pos()` returns coordinates already in the window's system. Buttons and wheel are ordinary events. |
| SFML | OK / trap | `sf::Mouse::getPosition(window)` — forget the `window` argument and you get **screen** coordinates, a small silent trap. |
| HTML Canvas | **QUIET — legendary** | `e.clientX` is the coordinate **inside the browser tab**, not inside the canvas. While the canvas hugs the top-left corner everything "works"; add a heading above it and every click lands somewhere else. The cure is `canvas.getBoundingClientRect()` with subtraction — mandatory, and unexplainable without a lesson on page layout. |

**Idyllium's answer** — the incantation exists, but it is the runtime's job:

```idyllium
void function mouse_down(gui.Canvas canvas, gui.MouseEvent evt) {
    if (ball.contains(to_float(evt.x), to_float(evt.y))) { ... }
}
```

`evt.x`/`evt.y` are canvas-local. The renderer performs the
`getBoundingClientRect()` subtraction — and additionally rescales when the
canvas is displayed at a different CSS size — once, inside the language, so the
student's first click program is correct on the first try and stays correct
after the layout changes. `evt.mouse_button` is `"LEFT"`, `"RIGHT"` or
`"MIDDLE"`; scrolling gives `delta` of `1` (up) or `-1` (down).

---

## 5. Text on the canvas

| Framework | Behavior | Detail |
|---|---|---|
| HTML Canvas | OK / **QUIET** | `ctx.fillText('Счёт: 10', x, y)` is one line and Cyrillic is free. The thorn: `y` is the **baseline**, not the top, so text placed near the upper edge silently draws off-screen — invisible, with no error. |
| PyGame | OK / verbose | Three steps: make a font → `font.render()` turns text into an **image** → blit it. Wordy, but conceptually honest, and Cyrillic works. |
| SFML | **QUIET / CRYPTIC** | There are **no system fonts**: ship a `.ttf` next to the project and load it, and if the load fails the text simply **does not draw** — no error. Add separate setters for font, size and position, plus the Windows-encoding adventure with `L"wide strings"` for Cyrillic. |

**Idyllium's answer** — text is a drawable like any other, with the layout box
starting at `y`:

```idyllium
drawable.Text score;
score.text = "Счёт: 10";
score.font_size = 24;
score.text_color = colors.BLACK;
score.x = 10; score.y = 10;

float w = score.get_width();      // 115.2 for this string
float h = score.get_height();     // 24
bool hovered = score.contains(mouse_x, mouse_y);
```

- **`y` is the top of the text**, verified: with `y = 10` and `font_size = 24`,
  `contains(12, 9)` is false and `contains(12, 11)` is true. The baseline trap
  is closed.
- **A font file is optional** — the bundled Source Code Pro renders Cyrillic
  out of the box (`"Привет, ёжик!"` measures correctly). A custom
  `fonts.Font` is loaded only when the design wants one, and the same font
  object works for GUI widgets and canvas text.
- **Text has geometry**: `get_width()`, `get_height()`, `contains()` and
  `collides_with()` — so a text label can be a button, a target or an obstacle.
  None of the three frameworks offers hit-testing on text without measuring by
  hand.

---

## 6. Images and sprites

| Framework | Behavior | Detail |
|---|---|---|
| PyGame | OK | `pygame.image.load('cat.png')` then `screen.blit(img, (x, y))` — synchronous, simple, any format. |
| SFML | **QUIET — the white square** | The `Texture` + `Sprite` pair is conceptually neat (data apart from display), but if the texture was a local variable and died, the sprite **silently draws a white rectangle**. Sibling of tkinter's garbage-collected image: mass-produced, silent, unexplainable at this level. |
| HTML Canvas | **QUIET** | Images load **asynchronously**: draw before the load finishes and nothing appears, with no error. Inside a game loop the picture "pops in" a few frames later on its own; in the first no-loop program ("show a picture") the student draws into the void. The canonical fix is another callback, `img.onload`. |

**Idyllium's answer** — the image is a resource object, the sprite points at it,
and every failure is loud:

```idyllium
use image;

image.Static cat;
cat.load_from_file("cat.png");     // synchronous: ready when the call returns

drawable.Sprite hero;
hero.set_image(cat);
hero.set_scale(2.0, 2.0);
hero.x = 50; hero.y = 50;
```

```text
runtime error: Static.load_from_file() cannot load 'нет-такой-картинки.png': file does not exist
runtime error: Sprite.contains() cannot inspect Sprite geometry before an image is loaded
```

- **No white square**: a sprite without an image says so, in words, instead of
  drawing a blank rectangle.
- **No async surprise**: after `load_from_file()` returns, the resource is
  ready for both the canvas and GUI widgets. The reference explicitly forbids
  generating `sleep`-and-retry code to "wait for" an image.
- **The format is detected from the file contents**, not trusted from the
  extension.
- **Animations are first-class.** A GIF/APNG is an `image.Animation` with
  `frame_count`, `frame_duration`, `get_frame(i)` and per-frame durations —
  verified on a two-frame GIF: `frame_count 2`, `frame_duration 0.1`,
  `has_uniform_frame_duration true`, and an out-of-range frame gives
  `Animation.get_frame() frame index 99 out of bounds (frame count 2, valid
  indices 0-1)`. In all three competing frameworks an animation means cutting a
  sprite sheet by hand and driving the frame index yourself.

---

## 7. The origin point

| Framework | Behavior | Detail |
|---|---|---|
| SFML | OK | The only framework where origin is an explicit concept: `setOrigin(r, r)` puts the circle's centre on its position and makes rotation spin around a chosen point. This topic probably exists in curricula *because* SFML made it visible. |
| PyGame | OK / limited | No origin, but a lovely vocabulary of `Rect` anchors — `rect.center`, `rect.midbottom`, `rect.topleft` — that reads like English and solves placement. The **rotation** centre, however, cannot be chosen at all. |
| HTML Canvas | CRYPTIC | No origin: only the matrix dance from topic 2, taught in the genre "here is the incantation". |

**Idyllium's answer** — SFML's model, with the same first-lesson surprise and
the same one-line cure:

```idyllium
drawable.Circle ball;
ball.radius = 30;
ball.set_origin(30, 30);      // now x/y is the centre
ball.x = 100; ball.y = 100;
ball.rotate(45);              // rotates around the origin
```

Verified: without `set_origin`, a circle with `radius = 30` at `(100, 100)`
reports `contains(100, 100) == false` and `contains(130, 130) == true` — its
`x/y` is the corner of the bounding square, exactly as in SFML. With
`set_origin(30, 30)` the results swap. This is a real trap (§12), softened by
three things: the origin is an explicit, documented property (`origin_x`,
`origin_y`); the fix is one line the reference spells out; and `contains()`
makes the surprise visible in the first test instead of hiding it in a
rendering offset.

---

## 8. Sound and music

| Framework | Behavior | Detail |
|---|---|---|
| PyGame | OK | `pygame.mixer.Sound('boom.wav').play()` for effects, `mixer.music` for the soundtrack. One line per shot. |
| HTML Canvas / JS | **QUIET** | `new Audio('boom.mp3').play()` is shorter still — but the browser's **autoplay policy** blocks sound until the user has interacted with the page, so the classic demo "music starts when the page loads" silently does nothing (the warning goes to the hidden console). Games usually start sound after a click, so the topic survives; the first demonstration does not. |
| SFML | **QUIET / limited** | The `SoundBuffer` + `Sound` pair repeats the texture convention (good), and repeats its lifetime trap: a dead buffer means silence, with no error. Plus **MP3 is not supported** — WAV/OGG/FLAC only — and children bring MP3. |

**Idyllium's answer** — two roles, two types, no lifetime trap, and MP3 among
the guaranteed formats:

```idyllium
use audio;

audio.Sound click;
click.load_from_file("click.wav");
click.volume = 0.6;
click.play();                       // effects may overlap

audio.Music theme;
theme.load_from_file("theme.mp3");
theme.loop = true;
theme.on_finished = next_track;     // fires on natural end when loop is false
theme.play();
```

```text
runtime error: Sound.load_from_file() cannot load 'нет-такого.wav': file does not exist
```

`Sound` and `Music` split by *role*, like SFML's buffers and streams, but a
resource cannot silently die: it is an ordinary object held by the student's
variable. WAV and MP3 are the guaranteed teaching formats. `Music` adds
`position` (seek in seconds), `loop`, and `on_finished` — the pieces a menu
soundtrack needs. The browser's autoplay rule still belongs to the host: sound
started from a click works everywhere; sound started before any interaction may
be postponed by the browser (§12).

---

## 9. Is the point inside the shape?

| Framework | Behavior | Detail |
|---|---|---|
| PyGame | OK | `rect.collidepoint(pos)` — done. A circle is still done by hand through distance, which is a fair excuse to show `math.hypot`. |
| SFML | OK | `shape.getGlobalBounds().contains(x, y)` — a two-call chain, but it works for any shape. |
| HTML Canvas | verbose | No objects at all: four inequalities for a rectangle, Pythagoras for a circle. Mathematically valuable — this is exactly the maths the topic should install — but there is no way to skip it when time is short. |

**Idyllium's answer** — `contains()` on every drawable, boundary included:

```idyllium
bool on_ball   = ball.contains(to_float(evt.x), to_float(evt.y));
bool on_button = label.contains(to_float(evt.x), to_float(evt.y));   // works on Text too
bool on_wire   = line.contains(50.0, 50.0);                       // and on Line
```

Verified: a rectangle reports `contains(50, 25) == true` exactly on its edge; a
line with `thickness = 4` reports `true` on the line and `false` beside it. The
manual maths remains available as a *task* (the course still teaches distance
and Pythagoras), but it is no longer a tax on every click handler.

---

## 10. Collisions

| Framework | Behavior | Detail |
|---|---|---|
| PyGame | OK | `rect.colliderect(other)` — the whole topic in one translatable call, and the game can start immediately. |
| SFML | OK | `getGlobalBounds().intersects(other.getGlobalBounds())` — wordier, still one operation. |
| HTML Canvas | **QUIET** | The AABB formula by hand: four inequalities with **crossed** signs (`a.x < b.x + b.w && a.x + a.w > b.x && ...`) whose directions confuse adults. The classic result is "the collision fires near the object but not on it" — a wrong game that keeps running. |

**Idyllium's answer** — one method that dispatches on the real types:

```idyllium
if (player.collides_with(coin)) { score = score + 1; }
```

Verified: rectangle × rectangle (overlapping `true`, distant `false`),
rectangle × circle `true`, circle × rectangle `true` (symmetric), line × circle
`true`; touching counts as an intersection. The student writes the sentence
they mean, and the crossed-inequality festival becomes an optional maths lesson
rather than the price of admission.

---

## 11. A bonus the trio does not have: frame snapshots

Idyllium's canvas can hand its own picture back:

```idyllium
canvas.save_svg("frame.svg");                     // works everywhere, including console runs
image.Static shot = canvas.to_static();           // needs the Web IDE rasterizer
canvas.export_to_file("frame.png");               // same, format from the extension
```

Verified in a console run: `save_svg` writes a real SVG of the current display
list, while `export_to_file` refuses with a readable, actionable message —

```text
runtime error: Canvas.export_to_file() is not available in the console host — use Canvas.save_svg() or run the program in the Web IDE
```

This makes "the program draws its own illustration and saves it" a normal
classroom task: chart generators, turtle-style art, autosaved frames of a long
simulation. In SFML it means `renderTexture` plumbing, in PyGame
`pygame.image.save`, and in the browser a `toDataURL` download dance that the
sandbox may block.

---

## 12. Summary: the quiet-error inventory of the canvas year

Legend: **yes** — the failure is quiet in that framework; `—` — it refuses or
behaves as expected; a note in parentheses — it complains, with a caveat.

| # | Quiet failure | SFML | PyGame | HTML Canvas | Idyllium |
|---|---|---|---|---|---|
| 1 | Colour set once tints everything drawn later | — | — | **yes** (`fillStyle`) | — colour is a property of each object |
| 2 | The frame loop runs once and stops | — | — | **yes** (forgotten `requestAnimationFrame`) | — the runtime owns the loop |
| 3 | Window freezes without an event pump | — | **yes** (`event.get()`) | — | — |
| 4 | Held key produces stuttering auto-repeat | — | — | **yes** | — with the documented held-keys set |
| 5 | Mouse coordinates are not canvas coordinates | (window argument) | — | **yes** (`clientX`) | — the runtime subtracts the canvas rect |
| 6 | Text near the top edge draws off-screen | — | — | **yes** (baseline `y`) | — `y` is the top of the layout box |
| 7 | Font fails to load, text silently missing | **yes** | — | — | — a bundled font is always available |
| 8 | Image drawn before it finished loading | — | — | **yes** (async) | — `load_from_file` is synchronous |
| 9 | Dead texture/buffer draws a white square or plays silence | **yes** | — | — | — resources are objects; missing file is loud |
| 10 | Sprite geometry used before an image exists | (undefined) | — | — | loud runtime error |
| 11 | Rotation degrades the image with each turn | — | **yes** (`transform.rotate`) | — | — rotation is a property, not a new image |
| 12 | Rotation centre cannot be chosen | — | **yes** | (matrix only) | — `set_origin` |
| 13 | Circle positioned by its bounding corner, not its centre | **yes** | — | — (centre) | **yes** by default — see §13 |
| 14 | MP3 not supported | **yes** | — | — | — WAV and MP3 guaranteed |
| 15 | Sound blocked before the first user interaction | — | — | **yes** (autoplay policy) | host rule, see §13 |
| 16 | Collision by hand-written crossed inequalities | — | — | **yes** | — `collides_with()` |
| 17 | Hit test on text requires manual measuring | **yes** | **yes** | **yes** | — `Text.contains()` |
| 18 | Frame not cleared leaves a smear | **yes** | **yes** | **yes** | **yes** — see §13 |
| 19 | Out-of-range animation frame | (manual sheets) | (manual sheets) | (manual sheets) | loud error naming the valid range |

The pattern of the year: the failures cluster where a framework replaces an
**object** with **pixels** (immediate mode), a **resource** with a **lifetime
you must protect** (textures, buffers, images), or a **coordinate system** with
**one you have to convert yourself** (client coordinates, baselines, bounding
corners). Idyllium's answer is the same in every case: the thing is an object
with named properties, the resource is owned by a variable, the conversion is
the runtime's job, and anything that cannot be done is said out loud.

---

## 13. Honest residue: what Idyllium's canvas still does not catch

1. **A circle's default origin is the corner of its bounding square** (§7),
   exactly like SFML. `circle.x = 100; circle.y = 100;` places the *corner*,
   not the centre, so the first click-to-place program lands the ball down and
   to the right. The cure is one documented line — `set_origin(radius,
   radius)` right after the radius — and teaching examples should always show
   it. Nothing warns you.
2. **There is no key-state polling.** Only `on_key_pressed`/`on_key_released`
   events exist; continuous movement requires the held-keys set from §3. The
   pattern is canonical and printed in the reference, but a student who invents
   their own scheme (moving directly inside `on_key_pressed`) gets
   auto-repeat-shaped stuttering with no diagnostic.
3. **A frame that is never cleared accumulates.** Verified: five `draw()` calls
   without `clear()` put five circles in one frame, and the display list keeps
   growing frame after frame. Every framework in this comparison behaves the
   same way, and the smear announces itself visually rather than silently — the
   course even uses it deliberately for trails — but an AI writing an example
   must put `canvas.clear()` at the top of every `on_update`.
4. **Sprite collision geometry is the whole image rectangle**, transparent
   pixels included — the same approximation as PyGame's `Rect` and SFML's
   bounds. Pixel-perfect collision is not provided.
5. **`delta_time` is offered but rarely used.** The reference's own movement
   example moves by fixed steps per frame (`player.y - 2`), which ties speed to
   the frame rate. That is a deliberate simplification for the first lessons;
   when writing material for stronger groups, prefer
   `player.y - speed * delta_time` and say why.
6. **The same object drawn several times in one frame stamps several copies.**
   Verified — useful (one drawable can tile a floor) and surprising if
   unintended, since the object still has a single position.
7. **Raster snapshots need the Web IDE host.** `to_static()` and
   `export_to_file()` raise a readable error in console runs; `save_svg()`
   works everywhere. Custom fonts inside an SVG snapshot fall back to
   sans-serif.
8. **Browser rules remain browser rules.** Autoplay before the first user
   interaction may be postponed by the host; a canvas displayed at a different
   CSS size is handled by the runtime, but a browser zoom is still a browser
   zoom.
9. **Semantic frame errors are untouched, as everywhere.** "+1 point per frame
   while touching" instead of "+1 per touch", a bullet moved before the
   collision check instead of after, a timer decremented in two places — no
   compiler sees these. The course answers them with the imperfective-aspect
   speech protocol and with the detective genre; see
   `idyllium-course-ai-reference.md`.

---

## 14. Rules for an AI using this file

1. **Always `canvas.clear()` at the top of `on_update`**, and always
   `set_origin(radius, radius)` right after a circle's radius when the
   position is meant to be its centre.
2. **Use the documented held-keys set** for movement; never move a character
   directly inside `on_key_pressed`.
3. **Do not import framework idioms.** No `requestAnimationFrame`, no
   `beginPath`/`arc`, no `fillStyle` state, no `blit`, no `getBoundingClientRect`
   maths, no manual AABB inequalities where `collides_with()` exists.
4. **Trust the loudness.** Missing images, sprites without images, out-of-range
   frames and bad audio paths all raise readable errors — do not wrap them in
   defensive checks that hide the message from the student.
5. **Keep the geometry in objects.** A drawable is a variable with `x`, `y`,
   `rotation` and an origin; storing coordinates in parallel variables and
   re-creating shapes every frame is HTML-Canvas thinking and should not be
   generated.
6. **When a student arrives from another framework, name the specific trap**
   from §12 that their habit came from — "in SFML a dead texture drew a white
   square; here the sprite says it has no image" teaches far more than "Idyllium
   is safer".
7. **Do not promise catches from §13**, and remember that this half-year runs
   alongside the OOP half-year: examples should look like the class-based code
   the student is learning in parallel, not like a pile of global drawables.

---

## 15. Provenance

The catalog of framework behavior comes from classroom observation across SFML,
PyGame and HTML Canvas courses for 10–15-year-olds, accumulated before Idyllium
existed, and organized around the same five criteria as parts 1 and 2. The
Idyllium column is not opinion: every message and every value quoted was
produced by running a probe program through the current compiler and runtime,
including the geometry results (`contains`, `collides_with`, text metrics),
the GIF animation figures and the console-host snapshot behavior. When the
language changes, this file must be re-verified the same way.
