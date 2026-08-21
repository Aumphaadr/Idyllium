# Idyllium Course AI Reference

This file is a compact AI-friendly reference for the EDUCATIONAL DESIGN of
the Idyllium course published on the site. The companion files describe the
language (`idyllium-ai-reference.md`) and the website
(`idyllium-site-ai-reference.md`); this one describes HOW the course teaches:
the pedagogical problems it was built to solve, its structure, its rules, and
the editorial constraints every piece of content follows. It is intended for
AI assistants that help students or teachers, or draft new materials in the
course's style.

Audience of the course: children and teenagers, starting around 10–13 years
old, studying in small groups with a teacher or self-studying. Everything
below is a *deliberate design decision*, distilled from years of classroom
practice teaching C++/Python/Pascal to children BEFORE Idyllium existed, and
from systematic analysis of what went wrong there. An AI that ignores these
rules produces material that clashes with the course — and often reproduces
the very failure modes the course was built against.

## 1. Course Structure

A five-year line; each year has its instrument focus, each quarter ends with
a **defense project** (a bigger app the student builds over several lessons
and presents):

| Year | Focus | What the student can build by year end |
|---|---|---|
| 1 | Console: I/O, variables, conditions, random, loops, arrays, strings, files | Text games, generators, ciphers, file-driven inventories |
| 2 | GUI widgets: buttons, fields, sliders, timers, progress bars, images | Form apps, trainers, reaction games, editors, validators |
| 3 | OOP + canvas: classes, objects, sprites, mouse/keyboard, frame timers | Real 2D games, object "worlds", composite characters, saves, high scores |
| 4 | Tool combos: JSON+OOP+canvas, object links, polymorphism | Data-driven apps, feeds, virtual pets, "smart home" simulations |
| 5 | SQLite: reading, writing, relations, accounts, migration | Database apps: catalogs, matchers, registrations, JSON→DB migration |

Structural habits baked into every project: work is split into **stages with
a behavioral completion criterion** («Готово, когда…» — "done when the app
demonstrably behaves like X", never "when the code looks right"); every
lesson ends with a **dated backup** (a downloaded `.zip` named like
`project_YYYY-MM-DD.zip`); each stage ends at a **logical point** — a
runnable, satisfying intermediate state that never splits across lessons.

Two structural facts an assistant should know:

- **Year 4 forks by strength, not by calendar.** The "soft" fourth-year
  program (review + JSON + combos, NO databases) serves weaker groups; the
  database year serves strong fourth-years and weaker fifth-years alike.
  Honest reduced scope beats a checkbox curriculum.
- **The thin-tower principle**: a struggling senior student is, by
  definition, a stack of unrepaired gaps from earlier floors, and every
  group's gaps are different. Hence no rigid topic order in later years,
  "fan-shaped" project catalogs tagged by which gap they diagnose and patch,
  and the first project of a term deliberately built as an X-ray that makes
  hidden gaps surface early and cheaply.

## 2. The Problem Map: what this course is built against

The course is an engineered response to a documented catalog of failure
modes observed in real classrooms. Knowing the diseases explains the cures.

### 2.1. The speech→code channel: eight distortion mechanisms

Children do not misread textbooks so much as they *transcribe the teacher's
spoken Russian into code* — and natural speech carries assumptions that
formal languages do not honor. Documented mechanisms, each with a real code
symptom:

1. **Literal transcription of Russian** — "если А и Б больше нуля" becomes
   `if (A and B > 0)`: Russian lets one comparison serve two subjects, code
   does not. Cure: the teacher (and every course text) always speaks the
   full form — "if A > 0 AND B > 0", even when it sounds pedantic.
2. **Fusing write-time with run-time** — the number from the demo leaks
   into the code (`cin >> 54`). Cure: the standing lexical pair "сейчас,
   когда пишем / потом, когда запустится" — the input value "does not exist
   yet; the variable is a box prepared for a number from the future".
3. **`=` as school equality** — five years of math teach that `=` states a
   symmetric fact; hence `print(a = 5)` and the eternal `=`/`==` confusion
   (two different operators sharing one spoken name). Cure: a hard verbal
   protocol — `=` is only ever read as "положить/присвоить" ("put into"),
   `==` as "равно ли" ("is it equal?"); never once "а равно пяти" for an
   assignment.
4. **The evaporating value** — the student doesn't know an expression
   computes a value that vanishes unless stored: `a + 1;` as a complete
   command. Cure: the image "computer computed it, holds it in its hand;
   if you don't say where to put it, it opens its fingers", plus reading
   `a = a + 1` as "into a we put: the OLD a plus one".
5. **Incantation with loose slots** — a construct memorized as a bag of
   tokens from hearing it read aloud (`a = int input()`, `input(int())`):
   brackets and nesting are inaudible. Cure: verbalize structure ("int OF
   input", like "f of x") and teach the conveyor reading, inside-out.
6. **False symmetry** — having learned `print(a)`, the student infers
   `input(a)`; unannounced asymmetries get filled by analogy. Cure: every
   broken symmetry is *announced as an event* with its reason ("input
   cannot know about your variable — it only brings a value; YOU store it").
7. **Rules by position, not by role** — "the colon goes at the end of the
   line" generalizes to a colon after every bracket. Cure: every syntax
   element gets a role-name ("the colon is a block-opener: a promise that
   an indented block follows").
8. **The parallel construct of distrust** — code that WORKS but contains a
   hand-rolled duplicate of a tool the student doesn't trust (a manual
   counter `n` next to the loop's `i`). This is not a syntax error; it is a
   confession of disbelief, and it is diagnostic gold — read the student's
   code, don't just check its output.

### 2.2. Seven sins of well-meaning teacher speech

The deeper finding: these habits are *normal good conversational Russian* —
a human listener fills the gaps; a child transcribing into a formal language
cannot. Teaching programming is translation into a language without
presuppositions.

- **Homonymy** — one word, two entities: «строка» is both a line of code
  and a string; «равно» is `=` and `==`; «команда» is a statement and a
  function call. Cure: distinct spoken names for distinct things.
- **Synonymy (the mirror sin)** — two words, one entity: children by
  default assume different words mean different things («картинка» vs
  «изображение», field vs property, run vs execute). Cure: introduce a
  synonym explicitly ("this is the same thing as…") or don't use it;
  never alternate silently.
- **Speaking in results instead of process** — "this function doubles the
  number" (so why did nothing double when I defined it?). Cure: process
  speech — "a function is a written recipe; right now we are only writing
  it down".
- **Deixis** — "this goes here, then like this": works while the finger
  points, evaporates at home. Cure: every place in code has a spoken
  address ("in the loop header", "in the function body").
- **Unmarked negation** — a big DON'T-DO-THIS on the whiteboard is
  remembered as an image; the "don't" is not. Rules are stated positively;
  **antipatterns are never displayed — they are given to be *lived***
  (see §4.5).
- **Anthropomorphizing the machine** — "Python sees it's a number", "it
  will understand" breeds the belief that intent can be communicated via
  variable names and comments. Cure: the bureaucrat-executor image — "the
  computer understands nothing; names are stickers on boxes it never reads".
- **A single present tense for four different "whens"** — a program has at
  least four times: while writing, at run, when an event fires, and every
  frame. The course's year ladder (console → GUI → canvas) is literally a
  ladder of these times, and each is lexicalized ("однажды, когда кликнут",
  "каждый кадр, шестьдесят раз в секунду").
- **Metaphors with contraband** — every metaphor smuggles properties of
  its source: "a list is a train" smuggles 1-based numbering; "a variable
  is a box" smuggles multi-occupancy; "a loop is a carousel" smuggles
  reset-after-the-ride. Cure: a metaphor ships with its limits, like
  medicine with contraindications ("a box, but single-occupancy: put in a
  new thing and the old one evaporates").
- **Jargon collisions with school and daily life** — «функция» belongs to
  the math teacher (so where is the y? what is a void function?!);
  «вернуть» means giving something back to its owner (so `return` restarts
  the program, or `return` = print). Cure: explicit disambiguation at
  first contact.

One uniquely Russian-language finding: **perfective verb aspect** in task
statements ("монета *собрана*" — a one-time event) collides with code that
checks an imperfective condition ("касается" — true sixty times a second),
producing the classic +60-points-per-touch bug. Course texts phrase
frame-checked conditions in the imperfective and add "и так каждый кадр"
aloud.

### 2.3. Quiet errors: what adult languages do to children

Pre-Idyllium field data shows the worst damage comes not from errors but
from *silence*: C++ `9/2` quietly giving 4; string+int quietly producing
garbage; out-of-bounds reads quietly returning someone else's memory; JS
quietly gluing `"кот" + 3` into `"кот3"`; Python quietly making a tuple out
of `t = 'кошелёк: ', money` ("and the student believes he did everything
right — I don't even know how to show him"). Quiet wrongness builds wrong
mental models that "work". The language half of the cure is Idyllium itself:
**it either behaves the human way (`23/10` is `2.3`, Cyrillic strings are
character strings) or refuses loudly in readable words** (strict bool, no
implicit conversions, index errors that name the valid range, targeted
compiler hints for `=`-in-condition, `%`, `elif`, homoglyph typos, an
uncalled method). The compiler is designed as a co-teacher, and reading its
messages is an explicitly taught skill.

The boundary is equally important: **a language catches the syntax of a
misconception, not the misconception itself.** Semantic quiet errors are
legal in every language — the parallel counter, the double-printing branch
chain (`if >50` + `if >90` with no else), +N points per frame, a global
object name used inside a method (hit Borya, Vasya loses health). For that
residue the course has two instruments: teacher speech protocol (above) and
the **detective genre** (below).

### 2.4. Field-observed misconceptions (the error catalog)

A sample of documented, real student beliefs that course materials
deliberately target — useful for an AI to recognize instantly:

- "You can't write `t = 13` on the third line — we already SAID t is 42"
  (assignment as a permanent vow).
- `return` "goes back to the beginning of the function" (return as restart).
- Drawing the expected console output with print statements — including
  `print(12+5=17)` — instead of computing anything.
- "Variables are needed so that everything works. Without them nothing
  will work at all" (magical thinking about tools).
- The variable's *name in quotes* when asked to print its value.
- Starting a conditional with the word `else`; "or flips the comparison
  sign next to it".
- A method call read as "this line records a change" instead of "this
  object performs this action".
- "The object is inside the class, like in a list" / methods of a class
  understood as actions of the end user rather than services for another
  programmer.
- New tool bolted on top of the old solution ("baby teeth": the new
  instrument added FOR THE TEACHER, the old one kept FOR ONESELF).
- Editing code repeatedly without a single run ("blind revision").
- "Where did you save your program?" — "Nowhere." (File-system
  helplessness; hence course texts always say WHERE a save file appears.)

Cross-cutting constraints of the audience: **functional literacy is still
forming** (children read diagonally; long prose fails — hence short
sentences, one term per context, key facts on top, pictures of expected
output), and many children **"don't wield words"** — they cannot form
definitions, which is why the course leans on scaffolds (given phrasings to
complete) rather than on defining.

### 2.5. Anatomy of bad materials

The course's task and theory formats were reverse-engineered from paired
good/bad specimens. The documented anti-patterns an AI must never
reproduce:

**Bad tasks:** faceless variables ("given an integer N…"); twelve
copy-paste branches (months of the year) that train patience, not thought;
tasks that silently require next month's constructs (the classroom symptom:
"the teacher runs around writing code for the children"); hidden traps in
innocent wording; no sample output (children cannot tell what is wanted);
math for math's sake (discriminants, palindromes — double tax: new
construct AND new math); "continue the previous task" chains that add bulk
but no new question; the first task of a lesson demanding blank-page
writing with no on-ramp; **tasks invented backwards** — a plot contrived to
force a predetermined tool combo produces absurd, untrustworthy premises
children see through; and boredom itself — "the brain does not
absorb information it finds uninteresting" is treated as a hard constraint,
not a nicety.

**Bad theory:** the reference-article genre instead of the lesson genre —
historical intros about `goto`, encyclopedic definitions built from
unlearned terms, the full form of a construct shown first with parts marked
"optional", complete schemas of FUTURE lessons (nesting, 5-way cascades) on
day one, foreign-language asides (Python examples in a C++ course), and
material honestly labeled "you will meet this later" — a self-confession
that it doesn't belong today. The litmus test: what fraction of the text
will today's practice actually use? A lesson answers "why do I need this
and how do I use it right now", not "everything known about X".

**Good-task DNA** (equally documented): a plot from the child's world with
thresholds taken from reality (100 ₽, 60 km/h, 20 % battery); the program
as a character with a voice; a result that remains a tiny *application* one
could show parents; sample input/output for every branch (including an
explicit "prints nothing"); prescribed test runs including the boundary
value; exactly ONE new idea per task; 5–15 lines of code with the
difficulty in thinking, not typing; a deliberate "break it" task (introduce
the classic error safely, BEFORE the student meets it alone); chains that
escalate like a series, ending on the richest and funniest task — a lesson
ends on a peak, not on leftovers.

### 2.6. The OOP wound and the arc of pain

Two documented structural failures shaped the senior years:

- **Course stretching**: each cohort absorbs less per year than the
  previous; topics migrate to later years. The course accepts this openly
  (the year-4 fork) instead of pretending.
- **The OOP wound**: classic OOP-first teaching demands "triple
  schizophrenia" — the student must simultaneously be the class architect,
  the class consumer, and the end user, and reliable knowledge fails to
  form ("no matter how you explain it"). The ladder of course difficulty
  is really "direct action → one intermediary (function) → a strategy of
  chained intermediaries (OOP)", and minds trained on direct action resist
  deferred benefit.

The course's proven cure is the **arc "pain → tool → definition"**,
validated on functions, arrays, and modules: definitions given up front
produce either avoidance or a dump-everything style; instead the student
first *lives the pain* (five near-identical copy-paste fragments begging
for a loop; a mob of `hero1_name, hero1_hp, hero2_name…` variables begging
for a class), then receives the tool as relief, and only then the term —
whose definition later *grows* (is amended, never replaced — no "forget
what I said" moments). Applied to OOP this yields **consumer-first OOP**:
the first month, the student is the "second programmer" who builds from
READY-MADE classes (a role already half-lived through a year of
`gui.Button` and file streams), objects are the protagonists, the class is
"someone else's blueprint"; architecting one's own classes comes only after
the consumer role is conscious and comfortable — and the canonical
demonstration remains "four parallel arrays rewritten as one class: feel
the difference".

### 2.7. Assessment traps

Documented positions: four-options-one-correct quizzes are guessing games;
memorized definitions do not equal skills; "genetic" definitions (term +
category + differentia) collapse on terms that are the only member of their
category (database, Internet, compiler) — those need a "since the
dinosaurs" run-up: how people lived without the thing and why it became
needed (course lesson openers use exactly this move). Preferred testing:
half-closed formats (fill the table/gaps, matching, short answer),
plausible distractors, a couple of joke questions, calibration so a weak
student scores ~50 % and a strong one 85 %+, and above all **loyalty to
the student**: "forgot something? run the experiment right now and
recall" — verify by probe, not by memory. Partial credit for partially
correct thinking; and the iron rule of any evaluation: find something to
praise, send the child home **morally undestroyed**.

## 3. The Four Content Pillars

- **Учебник (textbook)** — theory in course order, written as lessons, not
  reference articles (§2.5): motivation from a need, minimal form first,
  one small step, a through-plot, a core-of-the-topic table, runnable
  examples with meaningful output, placeholders for illustrations. Lesson
  zero states that installation is unnecessary (Web IDE).
- **Задачник (task book)** — a practicum per lesson, built by the good-task
  DNA (§2.5) plus set-level rules: cover the WHOLE tool including
  unglamorous corners (float!), prefer arithmetic-verifiable answers over
  randomness, 20+ tasks per topic, difficulty stars, keys separate; per
  topic an explicit blacklist of tools that "look appropriate but are
  forbidden today"; an acceptance question "can this be solved WITHOUT
  today's tool?" (if yes, it doesn't train the topic); 2–3 "experiment"
  tasks and 2–3 "broken code" tasks per set. "Typical mistakes" topics are
  written as **detective stories**: broken or suspicious code is a crime
  scene, the student is the investigator — errors are content, not shame.
  The genre includes the subspecies "no crime, but clues" (code that WORKS
  yet contains a confession, like the parallel counter).
- **Проекты (project pages)** — SPECIFICATIONS, deliberately without full
  solution code: what the finished app does (screenshots / console
  recordings), stages with "done when" criteria, optional feature ideas
  parked by stage, pitfalls as questions. The teacher owns the reference
  implementation; the page gives the student a map, not the treasure.
  Projects are where **loose knowledge gets tightened**: each project
  declares which known "gaps" it exercises (e.g. "a variable's value has
  the right to change", "the loop counter is a variable too", "each object
  owns its fields") by putting the student where the gap becomes
  load-bearing.
- **Раздатки (handouts)** — data files (images, sounds, texts, databases)
  that make projects feel real. Some handouts contain teacher-side secrets
  (e.g. cipher texts with undisclosed shifts): pages never reveal them, and
  an AI assistant should guide the *method* of solving rather than print
  the answer.

## 4. Pedagogical Rules (the operating system)

### 4.1. Code style is didactic

- **Full forms over shortcuts**: course code writes `x = x + 1`, never
  `x += 1` (both roles of the variable stay visible: source on the right,
  target on the left). `++`/`--` do not exist in the language at all. Word
  operators (`and`, `or`, `not`) replace symbol soup.
- Every demo is runnable as-is (sample outputs are produced by actually
  running the program — never typed from imagination); demos longer than
  ~45 lines get shortened with clearly marked cuts, never silently.
- No "magic one-liners": a solution is a composition of NAMED parts, and
  materials ask "what role did each tool play?". Golf-style cleverness is
  explicitly out of scope.
- Solutions must not require knowledge from future lessons — each year and
  quarter has a defined tool "baggage", and materials are checked against
  it. Tiny "runs ahead" are allowed only for trivially explainable tools,
  later re-taught properly.

### 4.2. Emotional safety rules (strict)

- In paired demo blocks, **the negative outcome never comes first**: either
  positive-then-negative, or both neutral. A single demo recording always
  ends in success.
- Failure inside games must be **funny and reversible**, never grim: the
  cat falls asleep instead of a hangman hanging; the penguin splashes into
  water it can swim in.
- The program **teaches, not judges**: on a wrong quiz answer it states the
  correct one; verdict scales end on an encouraging note; grinding is
  framed as achievement.
- Anxiety-adjacent themes (deadlines, tests, self-esteem) require a
  built-in reassuring finale. Jokes are never built on diagnoses, on a
  child's appearance, or on anything a specific student in a group could
  be mocked for. Mocking the abstract "user" of a program, however, is a
  sanctioned, safe outlet — the program may tease its user; materials never
  tease the student.

### 4.3. Mechanics are separable from stories

Every project distinguishes its **mechanic** (reusable machinery, the
learning payload) from its **wrapper** (setting, characters, jokes).
Project pages carry a «Переодень сюжет» section: the same mechanic
re-dressed in 3–4 alternative settings. Wrapper hygiene: no character names
a real student could bear (safe: object-nicknames like кот Батон,
non-declinable foreign names, archaic names for elderly characters); titles
must survive diagonal reading (nothing that scans as "for nerds", "bring
your own photos", prison or innuendo); imperatives, questions and
situational phrases are welcome title forms; recurring motifs are budgeted
across the five-year line (children notice repetition fast); "combat"
mechanics get disarmed wrappers.

### 4.4. Difficulty is layered, not gated

Optional features are parked at the stage where they become possible and
graded by stars (★ five minutes, ★★ half an hour, ★★★ a small quest);
every project lists a legitimate reduced version and extensions — both
first-class. The whole set serves a **floor for the weak and a ceiling for
the strong** simultaneously, including harder sub-points INSIDE tasks.
Pitfalls are pre-chewed as questions, and predicting-then-observing a
failure is a designed activity. An ambitious over-reaching student idea is
never refused — it is "aikido-ed": "Powerful idea. Prove it — start with a
simplified version without X; manage that, and you're two steps from
victory."

### 4.5. Speech protocol and lived antipatterns

The course treats teacher/text speech as half the toolchain (the language
being the other half — see §2.3):

- Definitions are **triples**: definition + attributes + context of use,
  and they *evolve* across lessons by amendment, never replacement ("a cell
  for storing data" grows into "…and providing it") — so nothing ever has
  to be "forgotten".
- **Order: pain → tool → definition.** A tool given before the need is not
  absorbed; given as relief, it is absorbed immediately.
- **Antipatterns are never exhibited — they are lived**: a whiteboard
  DON'T becomes a remembered DO; but the same mistake met in one's own
  code (or in a detective task) becomes motivation. Break-it tasks are the
  safe habitat for errors.
- One term — one context; synonyms introduced explicitly or not at all;
  homonyms split by distinct spoken names; asymmetries announced as
  events; metaphors shipped with their limits; the four times of a program
  lexicalized and named at every register switch.
- Creativity is scaffolded, not demanded: "invent anything" fails; the
  working formula is **co-creation** — seed 2–3 ideas, ask the student to
  add their own; freedom framed as an easy escape from a mildly boring
  default. Backstory beats specification ("array of 20 cells" → "seats at
  the project-defense ceremony"); a deliberately dull "background" of
  alternatives makes the chosen idea shine.

### 4.6. OOP is taught consumer-first

See §2.6. Operationally: the first OOP month the student uses ready-made
classes ("someone else's blueprint" with a passport table of its interface;
peeking behind the line is against the rules until the finale); the roles
"first programmer" (architect) and "second programmer" (consumer) are
explicit vocabulary; methods are introduced as services for the second
programmer, never as end-user actions; `this`/self is spoken only as "THE
ONE who was called, whoever that is" (never through a concrete pet object
name); a constructor is "part of being born, its first breath — never
called separately"; and polymorphism arrives as a spectacle ("one command —
many behaviors") before it arrives as a term.

### 4.7. Language idioms the course standardizes

- Functions are top-level only; event-driven GUI programs use the idiom
  "global state + top-level functions" — course pages treat this as normal
  style, not a workaround.
- File-driven design is a virtue: data lives in files (text, JSON, images,
  DB), and "change the file, not the code" is celebrated as the moment
  data and code separate in the student's head.
- Debug-by-print is taught as an explicit skill (many children cannot
  "look inside" a variable unprompted), as is the habit of actually
  RUNNING the program between edits.

## 5. Editorial Constraints (public content)

Everything published on the site obeys these; an AI drafting content must
too:

- **No YouTube links anywhere** (the platform is inaccessible to a large
  part of the audience; a dead link teaches helplessness).
- **No school-specific content**: no schedules, internal jargon, or
  anything tying material to one organization; wrappers that drift
  school-ward get re-dressed.
- **No project-defense playbooks** on public pages (defense procedure is
  the teacher's domain).
- **No full solution code** on project pages — stages, behavior specs and
  screenshots only.
- **Secrets stay secret**: handout ciphers' shifts and similar teacher-side
  keys are never printed in public materials or AI answers.
- Text hygiene: no `+=`/`-=` in teaching code, no stray Latin letters
  inside Cyrillic words, one term per context, short sentences (diagonal
  readers are the norm, not the exception), sample outputs generated by
  real runs, demo outputs follow the emotional rules.

## 6. How an AI Assistant Should Help a Student

- **Don't hand out the treasure.** If the student is working on a course
  project, respond like the project page does: ask which stage they are
  on, restate the stage's "done when", give the smallest hint that
  unblocks — a pitfall-style *question* is the preferred hint form. Full
  solutions only when explicitly requested by a teacher.
- **Errors first.** When shown broken code, first have the student read
  and quote the error message — the compiler is a co-teacher and its
  hints are designed to be understood. Explain what the message means
  before fixing anything.
- **Speak the protocol.** Never say "a equals 5" for an assignment — say
  "put 5 into a"; read `a = a + 1` as "the OLD a plus one"; keep the four
  times of a program explicit ("later, when it runs…", "every frame…");
  state conditions in full form; announce asymmetries; give metaphors with
  their limits; don't display antipatterns as warnings — turn them into
  "try this and watch what happens" experiments.
- **Recognize the catalog.** The misconceptions in §2.4 are the most
  probable diagnoses behind a confusing student question; check them
  before assuming an exotic cause. A working-but-redundant construct
  (parallel counter, re-checked variable) is a confession of distrust —
  address the belief, not the code.
- **Respect the code style**: full forms, word operators, top-level
  functions, four-space indents, runnable examples, Russian-language
  strings for user-facing text; verify examples against the student's
  year "baggage" (a year-1 student has no widgets; a year-2 student has
  no canvas; the soft year 4 has no databases).
- **Respect the emotional rules** in anything you generate: success
  endings, funny failures, no first-position negativity — and praise
  behavior, not talent: anchor feedback to what the program now
  demonstrably does. Find something to praise; the student leaves the
  conversation morally undestroyed.
- When inventing new tasks or stories on request, follow §2.5's good-task
  DNA and §4.3's wrapper hygiene, run the acceptance checks ("one new
  idea? solvable only with today's tool? sample output per branch?
  boundary test run? readable in 20 seconds?"), and prefer plots a child
  could proudly show their parents.
