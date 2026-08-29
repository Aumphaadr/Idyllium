# Idyllium Contrast Reference — Part 6: Databases

This file catalogs the **quiet errors and broken logic that mainstream SQLite
bindings inflict on beginners**, topic by topic, and states **what Idyllium
does instead**. It is the sixth part of a series that follows the course
ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console year: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| 2 | GUI widgets: windows, buttons, fields, timers, events | Lazarus/Forms, Qt Widgets, tkinter, DOM+JS |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| 5 | JSON: parsing, building, saves, objects ↔ text | nlohmann/json, Python `json`, native JS `JSON` |
| **6 (this file)** | **Databases: opening, statements, rows, parameters, transactions** | **QtSql (C++), Python `sqlite3`, `node:sqlite` (JavaScript)** |
| 7 | Networking: HTTP client, HTTP server, templates, forms, channels between programs, addresses | QtNetwork + cpp-httplib, `requests` + `http.server`, `fetch` + `node:http` |
| 8 | time, math at the edges, fixed-width integers, encodings, hashes, colors, images as data, sound, `system` | C++ standard library, Python standard library + PIL, JavaScript/Node built-ins |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-site-ai-reference.md` (how the site is *built*),
`idyllium-contrast-console-ai-reference.md` (part 1, where the guiding axiom is
stated in full), `idyllium-contrast-json-ai-reference.md` (part 5, whose
`json.Value` shares its shape with `sqlite.Value`).

Every Idyllium message quoted below is verbatim runtime output, captured from a
probe program. **All three comparison columns were verified the same way** —
Qt 5 `QtSql` with the `QSQLITE` driver, CPython 3.12 with the standard
`sqlite3` module, Node 22 with `node:sqlite`. Every value marked "probed" is
captured output, in every column.

QtSql was chosen over the raw sqlite3 C API deliberately. A C++ school course
that reaches databases has almost always reached Qt first — part 2 of this
series compares the widget year against Qt Widgets — so `QSqlQuery` is what the
student actually meets. It is also the fairer comparison: the C API is a driver,
not a teaching interface, and criticizing it for being unforgiving proves
nothing. QtSql is a high-level binding built for application programmers, like
the other two, and it fails in more interesting ways.

---

## 0. What changes when the database topic starts

The JSON topic (part 5) already broke the comfortable rule that every value is
born inside the program: text arrived from outside and its shape was unknown
until run time. A database breaks three more rules at once.

1. **The data outlives the program.** A bug does not disappear when the process
   ends — it is now written into a file that the next run will read. A silent
   wrong write is not a wrong output; it is *durable damage*.
2. **The instructions are text.** SQL is a second language, embedded as string
   literals, and the host language cannot check a word of it. A misspelled
   column is not a compile error anywhere in this comparison.
3. **The result has no declared shape.** A `SELECT` returns rows whose columns
   are named by the query, not by any declaration. Asking for the wrong one is
   the topic's most common mistake.

Everything below is a variation on one question: **when the query, the row, the
column or the value is not what the code assumed, does the student find out?**

There is also a fourth change, easy to miss and the source of the single most
damaging beginner bug in this whole series: **some bindings do not save your
data unless you tell them to.** See §10.

---

## 1. How to read the entries

Same shape as parts 1–5:

- **The child writes** — the plausible beginner code.
- **What other bindings do** — one row per ecosystem, with a behavior class:
  - **QUIET** — wrong or surprising result, no diagnostic. The dangerous class.
  - **LOUD** — refuses or errors out with a message.
  - **CRYPTIC** — errors, but with a message a beginner cannot decode.
  - **WARNS** — prints a warning to stderr, then **returns a plausible value and
    continues**. QtSql needs this class: `qWarning` text lands in a stream a
    student running from an IDE may never see, while the program carries the
    zero or the empty string onward as if nothing happened.
  - **OK** — behaves as a human would expect.
- **Idyllium's answer** — with the verbatim message.

Fairness note: all three comparison bindings are competent adult tools, built to
move data in applications written by professionals. Several behaviors listed
below as problems are the defensible choice in that setting — Qt returns an
invalid `QVariant` rather than throwing because Qt as a whole avoids exceptions.
The question asked here stays narrow: *what does this do to a twelve-year-old
whose first table has four rows?*

---

## 2. Opening a database

**The child writes** `sqlite.open("players.db")` and expects either a database
or an explanation.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **QUIET** | Probed: `open()` on a path whose directory does not exist returns `false` and prints nothing; the text (`unable to open database file Error opening database`) exists only inside `lastError()`. A program that ignores the `bool` carries on, and the first query then prints `QSqlQuery::exec: database not open` on stderr and hands back `0`. Fair credit where it is due: a misspelled **driver** name is caught well — stderr gets `QSqlDatabase: QSQLTIE driver not loaded` followed by `QSqlDatabase: available drivers: QSQLITE` (probed). |
| Python | LOUD | `sqlite3.connect(path)` raises `OperationalError: unable to open database file` — accurate, though it does not say *why* (missing directory, permissions). |
| JavaScript | LOUD | `new DatabaseSync(path)` throws with the SQLite message. |
| **Idyllium** | **LOUD** | `runtime error: sqlite.open() cannot open 'нет/такой/папки/x.db': parent directory does not exist: нет/такой/папки` |

The Idyllium message names the specific cause. This matters more than it looks:
"unable to open database file" sends a student to check spelling and
permissions, when the actual problem is a folder that was never created.

Opening a file that does not exist **creates** it, in every ecosystem here.
That is SQLite's behavior, it is right, and it means a typo in the file name
produces a second, empty database rather than an error — see §15.

Note also what the Idyllium message does *not* require: no driver string, no
connection registry. `sqlite.open(path)` returns the database or stops the
program; there is no `bool` to forget and no second call to reach the text.

---

## 3. The statement that does not parse

**The child writes** `SELEKT` — or forgets a comma between columns.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **QUIET** | Probed: `q.exec("SELEKT 1")` returns `false` and prints nothing. The text is there for the asking — `lastError().text()` gives `near "SELEKT": syntax error Unable to execute statement` — but a program that does not ask simply continues, and a following `q.next()` then `q.value(0).toInt()` yields `0` (probed). |
| Python | LOUD | `OperationalError: near "SELEKT": syntax error` (probed) |
| JavaScript | LOUD | `Error: near "SELEKT": syntax error` (probed) |
| **Idyllium** | **LOUD** | `runtime error: sqlite execution failed: near "SELEKT": syntax error` |

All three high-level bindings pass SQLite's own message through, and SQLite's
messages are good. Idyllium prefixes it with the operation so the student can
tell a database complaint from a language complaint at a glance.

The same holds for a column that does not exist in the query:
`runtime error: sqlite execution failed: no such column: nmae`.

---

## 4. Getting values out of a row

**The child writes** a loop over `SELECT name, level FROM players` and reads the
two columns.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **QUIET** | `query.value(0)`, `query.value(1)` — **by index**, and this is the form every tutorial shows. Add a column to the front of the `SELECT` and every index shifts; the program keeps running and reads the wrong data. Access by name exists (`query.value("name")`), costs a lookup per call, and is the road less travelled. |
| Python | **QUIET** | Rows are tuples by default (probed: `('Мира', 7)`), so access is `row[0]`, `row[1]` — the same index-shift trap. Named access exists (`conn.row_factory = sqlite3.Row`) but must be opted into, and no tutorial reaches it before the student has written twenty positional reads. |
| JavaScript | OK | `node:sqlite` returns objects with named columns (probed: `{ name: 'Мира', level: 7 }`). Good default. |
| **Idyllium** | **OK** | Access is by column name only: `rows.get_string("name")`, `rows.get_int("level")` |

There is no positional getter in the Idyllium API at all. `column_name(index)`
and `column_count()` exist for programs that must inspect an unknown result,
but the ordinary path cannot be written positionally, so the index-shift bug
has nowhere to live. Adding a column to a `SELECT` cannot silently change what
an existing line reads.

---

## 5. The row that is not there

**The child writes** a lookup for a player who has not been created yet.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **WARNS** | Probed: reading before `next()` prints `QSqlQuery::value: not positioned on a valid record` on stderr and returns an **invalid `QVariant`**, whose `toString()` is `""` and whose `toInt()` is `0`. The program continues with those values. `isValid()` would tell the truth, and nothing requires asking. |
| Python | **QUIET** | `cur.fetchone()` returns `None` (probed). The program continues; the failure surfaces later as `TypeError: 'NoneType' object is not subscriptable`, at a line that is not the cause. |
| JavaScript | **QUIET** | `stmt.get()` returns `undefined` (probed). Same delayed, misdirected failure as `None`. |
| **Idyllium** | **LOUD** | `runtime error: sqlite result has no current row; call next() first` |

The Idyllium result begins *before* the first row and refuses every getter until
`next()` has been called and has returned `true`. The idiom is therefore the
same `while` loop the student already writes for files, and the empty case is
handled by the loop body simply not running:

```idyllium
    sqlite.Statement find = db.prepare("SELECT name, level FROM players WHERE level > :min");
    find.bind("min", 5);
    sqlite.Result rows = find.execute();
    while (rows.next()) {
        console.writeln(rows.get_string("name"), ": ", rows.get_int("level"));
    }
```

And when "did anything match" needs its own answer — an empty-list message, a
different branch — the result says so directly, without a sentinel and without
consuming anything:

```idyllium
    if (rows.has_rows) {
        while (rows.next()) { … }
    } else {
        console.writeln("никого нет");
    }
```

`has_rows` is `true` only when at least one row is there; an empty `SELECT`
reports `false`, and so do `INSERT`/`UPDATE`/`DELETE`, which answer through
`affected_rows` instead.

The other three have no equivalent on the streaming path, and two of them offer
a named property that looks like the answer and is not. Python's
`cursor.rowcount` is **`-1` for every `SELECT`**, empty or not (probed).
QtSql's `query.size()` is **`-1` for every SQLite query**, empty or not
(probed) — the SQLite driver does not report result sizes, and the method
documents that by returning the same number for "no rows" and "four rows".
What works in both is to materialize the whole result (`fetchall()` / `.all()`,
probed to give `[]` when nothing matched) or to loop and count, which is correct
but pulls every row through to answer a yes-or-no question.

So: no `None`, no `undefined`, no `-1`, no sentinel value that looks like data.

---

## 6. Reading a column that does not exist

**The child writes** `get_string("nmae")` — a typo in the *reading* code, not in
the SQL.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **WARNS** | Probed: `value("nmae")` prints `QSqlQuery::value: unknown field name 'nmae'` on stderr and returns an invalid `QVariant` — `""` and `0` downstream. An out-of-range **index** (`value(5)`) does the same. In both cases the program keeps its zero and carries on. |
| Python | LOUD | With tuples, `row[5]` raises `IndexError`; with `sqlite3.Row`, `row["nmae"]` raises `IndexError: No item with that key`. |
| JavaScript | **QUIET** | `row.nmae` is `undefined` (probed) — a plain object property miss, indistinguishable from a column that exists and is NULL. |
| **Idyllium** | **LOUD** | `runtime error: sqlite result has no column 'nmae'` |

Note the distinction Idyllium keeps and JavaScript loses: a **missing column**
and a **column containing NULL** are different situations with different
messages (`has no column 'nmae'` versus `column 'a' is null, expected int`).
In JS both are `undefined`.

---

## 7. The wrong type, and NULL

**The child writes** `get_int` on a column that holds text, or on a column that
holds NULL.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **QUIET** | Probed, and this is QtSql's flagship: `value(0).toInt()` on the text `"Mira"` returns **`0` with no warning at all** — not even the stderr line the previous two cases get. On NULL it also returns `0` (probed). Two different failures and one indistinguishable answer, exactly as in the raw C API underneath. |
| Python | **QUIET** | Values arrive as native types, so a text column simply *is* a `str` and NULL simply *is* `None` (both probed). The mismatch surfaces at the first operator that rejects it, far from the read. |
| JavaScript | **QUIET** | Same: the property is a string or `null`, and arithmetic on it does what JavaScript arithmetic does. |
| **Idyllium** | **LOUD, twice, differently** | `runtime error: sqlite column 'b' is text, expected int` · `runtime error: sqlite column 'a' is null, expected int` |

Both messages name the column, what is in it, and what was asked for. `get_bool`
carries its own precise refusal, because SQLite has no boolean type:
`runtime error: sqlite column 's' is text, expected bool (integer 0 or 1)`.

When a column genuinely may be absent, the check is explicit and reads as a
question — the same shape as `json.Object.has()` in part 5:

```idyllium
    if (rows.is_null("level")) { ... } else { int level = rows.get_int("level"); }
```

`sqlite.Value` (from `rows.get("column")`) is the nullable form, with
`is_null()`, `is_int()`, `is_float()`, `is_string()` and the matching `to_*`
converters, mirroring `json.Value` so the student learns one shape for both.

---

## 8. Parameters, and the question every course must answer

**The child writes** a search box and splices the text straight into the query.

This is the one topic where the difference between the ecosystems is not
diagnostics but **what the ordinary path looks like**.

| Ecosystem | Parameter forms | Notes |
|---|---|---|
| C++ (QtSql) | `?` and `:name` | Two schemes side by side: `addBindValue()` fills `?` in order, `bindValue(":name", …)` fills by name (both probed working). Mixing them in one query is a documented error, and which one a student uses depends on which tutorial they opened. |
| Python | `?` and `:name` | `?` is what the documentation shows first; parameters are supplied as a tuple whose order must match. |
| JavaScript | `?` and named | `?` is the common form in examples; supplied as positional arguments. |
| **Idyllium** | **`:name` only** | `?`, `@name` and `$name` are refused: `runtime error: unsupported SQLite parameter '?'; use named parameters such as ':name'` |

Every positional parameter scheme has the same failure mode as positional
column access (§4): edit the statement, forget to re-order the arguments, and
the values go into the wrong columns with nothing said. Idyllium removes the
scheme rather than warning about it — there is exactly one way to write a
parameter, and it carries its own name:

```idyllium
    sqlite.Statement find = db.prepare(
        "SELECT name, level FROM players WHERE level >= :min ORDER BY level"
    );
    find.bind("min", 5);
    sqlite.Result rows = find.execute();
```

A typo in the name is caught, and the message shows the parameter as SQL spells
it: `runtime error: sqlite statement has no parameter ':nmae'`.

On the security question the honest statement is short: **splicing user text
into SQL remains possible here, as in every ecosystem in this comparison** —
`db.execute("… WHERE name = '" + typed + "'")` is ordinary string
concatenation and no language can forbid it. What the API does is make the
correct path shorter than the wrong one and give it a single spelling, so that
"use `:name`" is a rule with no exceptions to memorize. The course teaches it
as a rule about *correctness first* — a name containing an apostrophe breaks a
concatenated query immediately, long before anyone mentions attackers.

---

## 9. The unbound parameter

**The child writes** an `INSERT` with two parameters and binds one — usually
after adding a column and forgetting the second `bind`.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **QUIET, and worse** | Probed: an unbound `:level` becomes NULL, `exec()` returns `true`, `lastError()` is **empty**, and the half-filled row is written. Worse still, a **typo in the placeholder name** — `bindValue(":nmae", …)` for a query declaring `:name` — is silently ignored, so the real parameter stays unbound and also becomes NULL, with `exec()` again returning `true` (probed). Only a `NOT NULL` column catches either. |
| Python | LOUD | `ProgrammingError: Incorrect number of bindings supplied. The current statement uses 2, and there are 1 supplied.` (probed) — counts them, does not name them. |
| JavaScript | **QUIET** | Probed: `run("X")` against two `?` placeholders **succeeded**, inserting `{ id: 1, name: 'X', level: null }`. Only a `NOT NULL` constraint catches it, and only if the schema author wrote one. |
| **Idyllium** | **LOUD, by name** | `runtime error: sqlite statement has unbound parameter ':level'` |

This is the entry where durable damage is easiest to produce: two of the three
comparison bindings will happily write a half-empty row into a file that
outlives the program, and the student discovers it a week later when the report
is wrong. Idyllium refuses before the write, and names the parameter that was
forgotten.

Bindings persist after `execute()` so a prepared statement can be reused in a
loop; `clear_bindings()` starts a fresh set on purpose.

---

## 10. Transactions and the forgotten `commit`

**The child writes** a program that inserts three rows and ends.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | OK | Autocommit is on; a bare `INSERT` is durable immediately. `transaction()`/`commit()`/`rollback()` return `bool`, and probed: `commit()` with nothing open returns `false` while leaving `lastError()` **empty** — a refusal with no words in it. |
| Python | **QUIET — the worst entry in this document** | The module opens an implicit transaction before DML and **rolls it back if the connection closes without `commit()`**. Probed: create a table, insert one row, `close()` — the file exists, the table exists, and the row is **gone**, with no message anywhere. The `CREATE TABLE` survived (DDL commits implicitly), so the program looks like it worked. |
| JavaScript | OK | `node:sqlite` runs in autocommit; a bare `INSERT` is durable. |
| **Idyllium** | **OK** | Autocommit; probed across two separate runs — rows written by the first program are read by the second, with no `commit()` anywhere |

Python's behavior deserves the space it gets here because of *what it teaches*.
The student's mental model — "the program did the thing, so the thing is done" —
is correct in every other part of the course and is silently false here. The
usual first encounter is a homework database that is empty on Monday, and the
usual conclusion the student draws is "databases are unreliable".

Explicit transactions exist in Idyllium and are checked at every step:

```idyllium
    db.begin_transaction();
    db.execute("UPDATE acc SET money = money - 100 WHERE name = 'Аня'");
    db.execute("UPDATE acc SET money = money + 100 WHERE name = 'Боря'");
    db.commit();                       // or db.rollback();
```

| Misuse | Message |
|---|---|
| `commit()` with no transaction open | `runtime error: sqlite database has no active transaction to commit` |
| `begin_transaction()` twice | `runtime error: sqlite database already has an active transaction` |

Python's `conn.commit()` with nothing open is a silent no-op (probed). Both
Idyllium messages are refusals, because both spellings mean the author has lost
track of the state — and losing track of transaction state is how money
disappears from one account without arriving in the other.

One caveat, stated in full in §15: a transaction that is **opened and never
finished** is rolled back when the program ends, silently. That is the correct
database behavior, and it is the one place where Idyllium can lose a write
without saying so — but it requires the student to have opened a transaction on
purpose, whereas in Python it is the default path.

---

## 11. Integers at the edge

SQLite's `INTEGER` is a signed 64-bit value. The host languages disagree about
what happens at that boundary.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **QUIET** | Probed: `9007199254740993` stored and read back with `toLongLong()` is exact — but `toInt()` on the same value returns **`1`**, the low 32 bits, with no warning. The correct method exists and is one letter longer; picking the wrong one costs the whole number. |
| Python | OK | Arbitrary-precision ints; `9223372036854775807` round-trips (probed). Beyond 64 bits the insert raises `OverflowError: Python int too large to convert to SQLite INTEGER` (probed). |
| JavaScript | LOUD | Probed: reading `9007199254740993` throws `RangeError: Value is too large to be represented as a JavaScript number`. Refusing beats corrupting — this is `node:sqlite` behaving better than `JSON.parse` does in part 5. |
| **Idyllium** | **OK, then LOUD at the real boundary** | `9007199254740993` round-trips exactly; a value beyond 64 bits is refused on the way in |

```text
runtime error: sqlite cannot store 123456789012345678901234567890: the value is
outside the INTEGER column range (types.int64)
```

The message is worth reading twice. Idyllium's own `int` is exact at any size
(part 5, §5), so this is not the language running out of room — it is the
language noticing that **the column** cannot hold what the program is offering,
and saying which limit was hit. `get_int64()` and `to_int64()` are available
where the full 64-bit range matters.

---

## 12. Lifetimes: after `close`

**The child writes** a cleanup line in the wrong order.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtSql) | **WARNS / QUIET** | `QSqlQuery` owns its resources and cleans up in its destructor, so the C API's dangling-pointer family is gone. What remains is quieter. Probed: after `finish()`, `value(0).toInt()` is `0` with the stderr line `QSqlQuery::value: not positioned on a valid record`. After `db.close()`, an already-fetched row still reads correctly (`7`, valid — Qt kept it), while a **new** `exec()` returns `false`, prints `QSqlQuery::exec: database not open` on stderr, and leaves `lastError()` **empty** — so the only trace is in a stream, not in the object you would query. |
| Python | LOUD | `ProgrammingError: Cannot operate on a closed database.` |
| JavaScript | LOUD | Throws on use after `close()`. |
| **Idyllium** | **LOUD, per object** | `sqlite database is already closed` · `sqlite statement is already closed` · `sqlite result is already closed` |

Three different sentences for three different objects, so the student learns
*which* thing they closed too early rather than only *that* something was
closed.

A deliberate design point verified by probe: **a result outlives the statement
that produced it.** Results are buffered snapshots, so this is legal and
useful —

```idyllium
    sqlite.Statement st = db.prepare("SELECT name FROM p ORDER BY id");
    sqlite.Result r = st.execute();
    st.close();                 // statement gone
    while (r.next()) { ... }    // result still works
```

— and, like `QSqlQuery`'s own resource handling, it removes the dangling-pointer
family of bugs entirely, at the cost of holding the rows in memory.

---

## 13. A complete program

Everything above, in the shape a student actually writes. Probed end to end:

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
    insert.bind("name", "Мира");
    insert.bind("level", 7);
    sqlite.Result added = insert.execute();
    console.writeln("добавлено строк: ", added.affected_rows,
                    ", id ", added.last_insert_id.to_int());
    insert.close();

    sqlite.Result rows = db.execute("SELECT name, level FROM players ORDER BY id");
    while (rows.next()) {
        console.writeln(rows.get_string("name"), ": ", rows.get_int("level"));
    }
    rows.close();
    db.close();
}
```

Nothing in it is binding ceremony. No driver name as a string, no connection
registry to name and later remove, no `bool` returns to compare against nothing
in particular, no cursor object separate from the connection, no `row_factory`
to configure before the columns have names. `affected_rows` and
`last_insert_id` are properties of the result of the statement that caused
them, rather than of the connection — so two inserts in a loop cannot report
each other's id.

What the same nine lines cost elsewhere, counted as *things that must be
learned before the first row appears*:

| Ecosystem | Before the first `SELECT` prints |
|---|---|
| C++ (QtSql) | `QSqlDatabase::addDatabase("QSQLITE")` — a driver name spelled as a string; connection names and their lifetime; `open()` returning `bool`; `QSqlQuery` bound to a connection; `QVariant` and which `to*()` to call; `lastError().text()` as the only way to see what went wrong |
| Python | `connect` → `cursor` → `execute` → `fetchone`, four objects for one question; rows as tuples until `row_factory` is discovered; and `commit()`, whose absence loses the data (§10) |
| JavaScript | `new DatabaseSync(path)`, `prepare`, then a choice between `run`/`get`/`all` that decides whether you get one row, all rows, or a summary |

---

## 14. Summary: the quiet-error inventory of the database topic

Legend: **yes** — the failure is quiet in that ecosystem; `—` — it refuses or
behaves as expected; a note in parentheses — it complains, with a caveat.

| # | Quiet failure | QtSql (C++) | Python `sqlite3` | `node:sqlite` | Idyllium |
|---|---|---|---|---|---|
| 1 | Open failure ignored, program continues | **yes** (`bool` nobody checks) | — | — | — names the cause |
| 2 | SQL syntax error passes unnoticed | **yes** (probed: `exec()` false, nothing printed) | — | — | — |
| 3 | Column read by position, shifts when the query changes | **yes** (`value(0)` is the taught form) | **yes** (tuples by default) | — (named) | — names only |
| 4 | Reading a row that does not exist | **warns**, returns `""`/`0` (probed) | **yes** (`None`) | **yes** (`undefined`) | — `no current row; call next() first` |
| 4a | "Did anything match?" has no honest cheap answer | **yes** (`size()` is `-1` for SQLite, probed) | **yes** (`rowcount` is `-1` for `SELECT`, probed) | (`.all()` works but materializes) | — `has_rows`, a named boolean, consumes nothing |
| 5 | Typo in a column name at read time | **warns**, returns `""`/`0` (probed) | — | **yes** (`undefined`) | — `result has no column 'nmae'` |
| 6 | Missing column and NULL column indistinguishable | **yes** (invalid `QVariant` for both) | (`None` for both paths) | **yes** | — two different messages |
| 7 | Text column read as a number → `0` | **yes** — silent, no warning (probed) | **yes** (str leaks onward) | **yes** | — `is text, expected int` |
| 8 | NULL read as a number → `0` | **yes** (probed) | **yes** (`None` leaks onward) | **yes** | — `is null, expected int` |
| 9 | Positional parameters, order edited but not re-ordered | **yes** (`?` and `:name` side by side) | **yes** | **yes** | — `:name` only, `?` refused |
| 10 | Unbound parameter silently becomes NULL | **yes** (probed: `exec()` true, `lastError()` empty) | (counts, does not name) | **yes** (probed) | — names the parameter |
| 10a | **Typo in a placeholder name silently ignored** | **yes** (probed) | — (raises) | n/a (positional) | — `statement has no parameter ':nmae'` |
| 11 | Data silently lost without `commit()` | — | **yes** (probed) | — | — autocommit |
| 12 | `commit()` with nothing open, silently ignored | (returns `false`, `lastError()` empty — probed) | **yes** | — | — refuses with a message |
| 13 | Large integer silently truncated | **yes** — `toInt()` on 2⁵³+1 gives `1` (probed) | — | — (throws) | — refuses at the column's limit |
| 14 | Use after close returns data-shaped nothing | **warns**, `lastError()` empty (probed) | — | — | — three distinct messages |
| 15 | String stored into an INTEGER column | **yes** (probed) | **yes** (probed) | **yes** (probed) | **yes** — see §15 |
| 16 | Typo in the database file name creates a second empty file | **yes** | **yes** | **yes** | **yes** — see §15 |

The pattern of the topic: the failures cluster where a binding **answers a
question it cannot answer** (zero for missing, `None` for absent, `undefined`
for both), where it **addresses data by position** (column indices, parameter
order), and where it **defers durability to a call the student does not know
about**. Idyllium's answer is the same in each case: nothing is addressed by
position, nothing absent is answered with a value, and nothing is deferred.

---

## 15. Honest residue: what Idyllium's SQLite still does not catch

1. **SQLite's type affinity is SQLite's.** Probed: binding the string
   `"не число"` into a column declared `INTEGER` stores it as text
   (`typeof` returns `text`), silently, exactly as in the other three
   ecosystems. Declared column types are advisory in SQLite; the API cannot
   change that. `CHECK` constraints in the schema are the answer, and belong in
   teaching material about schemas rather than about the binding.
2. **A transaction opened and never finished is rolled back at exit,
   silently.** Probed: an `INSERT` inside `begin_transaction()` with no
   `commit()` and no `close()` leaves the file unchanged. This is correct
   database behavior and the mirror image of Python's default (§10) — but it
   is a silent write loss, and material that teaches transactions must teach
   `commit()`/`rollback()` in the same breath.
3. **User text spliced into SQL is still SQL.** The API cannot forbid string
   concatenation. `:name` is short, single-spelling and enforced against
   alternatives, which is the strongest thing a binding can do; the rest is
   teaching.
4. **A typo in the file name creates a new empty database.** `sqlite.open` is
   create-or-open, like every SQLite tool. The first run of a misspelled path
   succeeds and returns zero rows for every query. Nothing warns.
5. **Nothing checks the schema.** A `SELECT` naming a column that exists but
   means something else, a `JOIN` on the wrong key, a `WHERE` that is always
   true — all valid SQL, all silent. This is the same semantic residue named in
   every part of this series.
6. **No BLOB type yet, no savepoints, no nested transactions.** Documented
   limits of the first API, not accidents.

---

## 16. Rules for an AI using this file

1. **Use `has_rows` when "nothing found" needs its own branch**, and the plain
   `while (rows.next())` loop when it does not. Do not generate counter-flag
   workarounds (`bool found = false; while (…) { found = true; … }`) — the
   result answers the question itself, and reading it consumes nothing.
2. **Always call `next()` before any getter**, and always read columns by name.
   There is no positional getter; do not invent one.
3. **Always use `:name` parameters** and `bind(...)` without the colon. Never
   generate `?`, `@name` or `$name` — they are refused — and never generate
   string concatenation of user input into SQL, even in examples labelled
   "simplified".
4. **Bind every declared parameter before `execute()`.** If generated code
   binds some of them, it is a bug: the runtime names the one that was missed.
5. **Do not generate `commit()` for ordinary inserts.** Idyllium is
   autocommit; a `commit()` with no open transaction is an error, not a
   harmless habit carried over from Python.
6. **Use transactions only where atomicity is the point** (transfers, batch
   imports), and always pair `begin_transaction()` with `commit()` or
   `rollback()` on every path out.
7. **Close what you opened, in order** — result, statement, database — but
   remember that a result legitimately outlives its statement (§12), so do not
   generate defensive re-execution.
8. **Prefer `get_int` / `get_string` / `get_float` when the column's type is
   known**, and `get(...)` returning `sqlite.Value` with `is_null()` when it is
   genuinely nullable. Do not wrap getters in defensive code that hides the
   type message from the student.
9. **When a student arrives from another binding, name the specific trap** from
   §14 that their habit came from. "In Python your rows were tuples, so adding a
   column moved everything; here you ask for the column by name" teaches more
   than "Idyllium is stricter" — and for the Qt arrivals, who are the majority
   of the C++ ones, the two worth naming first are `value(0).toInt()` returning
   `0` for text without a word (§7) and a mistyped `bindValue(":nmae", …)` being
   ignored outright (§9).
10. **Do not promise catches from §15**, especially the affinity and
    misspelled-file-name entries.

---

## 17. Provenance

The catalog of binding behavior comes from classroom observation across C++,
Python and JavaScript courses for 10–15-year-olds, organized around the same
five design criteria as parts 1–5. **All three comparison columns were verified
by execution** — Qt 5 `QtSql` over the `QSQLITE` driver, CPython 3.12
`sqlite3`, Node 22 `node:sqlite` — and every value marked "probed" is captured
output, including QtSql's silent `toInt()` overflow, its ignored placeholder
typo and its `size() == -1`; Python's silent data loss without `commit()`; and
the type-affinity results shared by all four. This is the first part of the
series whose comparison columns are all probe-derived rather than partly
documentary.

The Idyllium column is not opinion: every message, every value and every
round-trip quoted was produced by running a probe program through the current
compiler and runtime, including the two-run persistence check, the transaction
rollback, the integer boundary refusal, the closed-handle messages and the
`has_rows` semantics of §5. When the language changes, this file must be
re-verified the same way.
