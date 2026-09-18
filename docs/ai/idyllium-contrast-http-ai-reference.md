# Idyllium Contrast Reference — Part 7: Networking

This file catalogs the **quiet errors and broken logic that mainstream
networking libraries inflict on beginners**, topic by topic, and states **what
Idyllium does instead**. It is the seventh part of a series that follows the
course ladder:

| Part | Scope | Compared against |
|---|---|---|
| 1 | Console year: I/O, variables, arithmetic, conditions, loops, random, arrays, strings, bool, functions, files | Pascal, C++, Python, JavaScript |
| 2 | GUI widgets: windows, buttons, fields, timers, events | Lazarus/Forms, Qt Widgets, tkinter, DOM+JS |
| 3 | OOP: classes, objects, `this`, composition, inheritance | Pascal, C++, Python, JavaScript |
| 4 | Canvas and 2D games: frame loop, sprites, input, collisions | SFML, PyGame, HTML Canvas |
| 5 | JSON: parsing, building, saves, objects ↔ text | nlohmann/json, Python `json`, native JS `JSON` |
| 6 | Databases: opening, statements, rows, parameters, transactions | QtSql, Python `sqlite3`, `node:sqlite` |
| **7 (this file)** | **Networking: HTTP client, HTTP server, templates, forms, channels between programs, addresses** | **QtNetwork + cpp-httplib (C++), `requests` + `http.server` (Python), `fetch` + `node:http` (JavaScript)** |
| 8 | time, math at the edges, fixed-width integers, encodings, hashes, colors, images as data, sound, `system` | C++ standard library, Python standard library + PIL, JavaScript/Node built-ins |

Companion files: `idyllium-ai-reference.md` (what the language *is*),
`idyllium-course-ai-reference.md` (how the course *teaches*),
`idyllium-site-ai-reference.md` (how the site is *built*),
`idyllium-contrast-console-ai-reference.md` (part 1, where the guiding axiom is
stated in full), `idyllium-contrast-json-ai-reference.md` (part 5 — a network
answer is usually JSON, and everything part 5 says about parsing applies the
moment `r.text` arrives).

Every Idyllium message quoted below is verbatim compiler or runtime output,
captured from a probe program. **All three comparison columns were verified the
same way** — Qt 5.15 `QtNetwork` and cpp-httplib built with g++ 13 `-std=c++17`,
CPython 3.12 with `requests` 2.31 and the standard `http.server`, Node 22 with
built-in `fetch`, `node:http` and `BroadcastChannel`. Every value marked
"probed" is captured output, in every column. Client probes ran against the same
local server in all four languages, so the columns describe reactions to
identical bytes.

**On column choice.** The comparison scores what a school course actually
teaches, not what ships in the standard library. A Python course that reaches
HTTP shows `requests` on the first slide; comparing against `urllib.request`
would be a straw man — so `requests` holds the column, and `urllib` appears only
where a student can fall into it by accident (§3). The C++ column is a mixture
by necessity: QtNetwork is the client a Qt-taught student meets, but **Qt 5 has
no HTTP server** (probed: the installed Qt 5.15 headers offer `QTcpServer` and
`QHttpMultiPart`, no `QHttpServer`; Qt 6 added one as a separate module), so the
server sections use cpp-httplib — the single-header library that C++ tutorials
reach for. Each section names its own column contents.

---

## 0. What changes when the network topic starts

Every earlier topic had one property in common: the program was alone. Its data
came from its own code, its own window or its own disk, and the only actor was
the student. Networking removes that, and four rules break at once.

1. **The answer takes time.** Every previous call returned before the next line
   ran. A request may take a second, or five, or never finish. This is the point
   where most languages hand the student their concurrency model — promises,
   callbacks, event loops — *before* the student has a reason to want one.
2. **The answer may be a refusal, and a refusal is still an answer.** HTTP has a
   status code for "no such page", and it is not a crash. Whether the language
   treats 404 as data or as an exception decides how the student's first program
   is shaped.
2. **The failure may be nobody's fault.** Wrong address, dead server, no
   network, wrong port — four causes, and a beginner needs to know *which*.
   Libraries that fold them into one message ("fetch failed") force guesswork.
3. **The program becomes a server.** Once the student writes `app.run()`, their
   code is called by someone else, at a moment they did not choose, with input
   they did not write. A crash is no longer "my program stopped": it is a
   question about what the *other side* sees.

Everything below is a variation on one question: **when the address, the answer,
the route or the handler is not what the code assumed, does the student find
out — and do they find out which of the four things went wrong?**

There is also a fifth change, and it is the one that hurts most in a classroom:
**a server keeps running after the mistake.** A stale process holding a port,
or a second server quietly sharing one (§10), produces the least debuggable
situation a twelve-year-old will meet all year: correct code, wrong output.

---

## 1. How to read the entries

Same shape as parts 1–6:

- **The child writes** — the plausible beginner code.
- **What other libraries do** — one row per ecosystem, with a behavior class:
  - **QUIET** — wrong or surprising result, no diagnostic. The dangerous class.
  - **LOUD** — refuses or errors out with a message.
  - **CRYPTIC** — errors, but with a message a beginner cannot decode.
  - **FATAL** — the whole program dies, taking the running server with it. New
    in this part: `node:http` needs it (§12).
  - **OK** — behaves as a human would expect.
- **Idyllium's answer** — with the verbatim message.

Fairness note, sharper here than in earlier parts: all four comparison libraries
are excellent adult tools, and several behaviors listed below as problems are
the correct engineering choice for a production service. `fetch` resolves on 404
because HTTP says 404 is a valid response. `node:http` dies on an unhandled
exception because a process in an unknown state should not keep serving. Both
are right. The question asked here stays narrow: *what does this do to a
twelve-year-old whose server has three routes?*

---

## 2. The first request

**The child writes** "fetch the page and print it", and expects the next line to
run when the text is there.

```idyllium
use console;
use http;

main() {
    http.Response r = http.get("http://127.0.0.1:8791/ok?name=Ann");
    console.writeln("status ", r.status, ", ok ", r.ok);
    console.writeln("body: ", r.text);
}
```

```text
status 200, ok true
body: hello, Ann
```

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtNetwork) | CRYPTIC | `manager.get(request)` returns a `QNetworkReply*` **before the answer exists**, and there is no synchronous variant — `QNetworkReply` has no `waitForFinished` (checked in the installed headers). The teaching recipe is an event loop plus a timer, and the minimal working program is 26 lines (probed, built, run). Five concepts — event loop, signals/slots, `deleteLater`, attributes, `QVariant` — stand between the student and the first byte. |
| Python (`requests`) | OK | `r = requests.get(url)` blocks and returns the answer. Same shape as Idyllium. |
| JavaScript (`fetch`) | CRYPTIC | Two awaits for one action: `const r = await fetch(url)` then `const t = await r.text()`. Forgetting the second is silent — see §8. |
| **Idyllium** | **OK** | `http.get()` returns the response. The line after it runs when the data is there. |

The synchronous call is a deliberate course decision, and it has a cost that
this file states plainly rather than hiding: **the program waits**. Probed
against a server that sleeps five seconds, the next statement ran 5.37 s later.
In a GUI program that means the window is held for the duration. The trade is
made knowingly: a student who can read a program top to bottom can debug it,
and the concurrency conversation is worth having later, on purpose, rather than
in week one as the toll for one line of data. See §21.

---

## 3. 404 is not an error

**The child writes** a request to a page that does not exist and asks the
program to say so.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtNetwork) | CRYPTIC | Probed: `reply->error()` is `ContentNotFoundError` and `errorString()` reads `"Error transferring http://… - server replied: Not Found"`. A server's honest answer and a dead cable arrive through the same channel. The status code is available, but only via `reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt()`. |
| Python (`requests`) | OK | Probed: `404 False "not found: '/nowhere'"`. No exception; `raise_for_status()` is opt-in. |
| Python (`urllib`) | LOUD, and inconsistent with the above | Probed: `urllib.request.urlopen` on the same URL raises `HTTPError: HTTP Error 404: Not Found`. Two clients in one language with opposite behavior on the most common case — and the exception object *is* the response, so `e.read()` returns the body. |
| JavaScript (`fetch`) | **QUIET** | Probed: `false 404` — and no throw. The most-written beginner bug in the whole ecosystem: `try { await fetch(url) } catch` does not catch 404, ever. |
| **Idyllium** | **OK** | `status` 404, `ok` false, `text` holds the body. No exception. |

Idyllium and `requests` agree, and `fetch` technically agrees too — the
difference is what the student is *taught to expect*. In Idyllium `ok` is a
property that exists to be checked, sits next to `status` in the same object,
and appears in the first lesson example. In JavaScript `ok` is a property most
tutorials skip, because the `try/catch` around the call looks like it is already
doing the job.

There is a second, quieter half to Qt's answer. On **success**, probed:

```text
status: 200 | error(): QNetworkReply::NoError | errorString(): "Unknown error"
```

`errorString()` says `"Unknown error"` when nothing is wrong. A student who
prints it unconditionally — the natural thing to do while debugging — reads that
their successful request failed for an unknown reason.

---

## 4. The address that cannot be reached

**The child writes** a URL with a typo, or points at a server that is not
running, and needs to know *which* of those it was.

Four different causes, probed in all four languages against identical inputs:

| Cause | C++ (QtNetwork) | Python (`requests`) | JavaScript (`fetch`) | **Idyllium** |
|---|---|---|---|---|
| Nothing listening | `ConnectionRefusedError` / `"Connection refused"` | `ConnectionError: HTTPConnectionPool(host='127.0.0.1', port=8123): Max retries exceeded with url: /x (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7d1e…>: Failed to establish a new connection: [Errno 111] Connection refused'))` | `TypeError: fetch failed` (cause `ECONNREFUSED`, hidden) | `runtime error: http.get() cannot reach 'http://127.0.0.1:8123/nothing': connection refused` |
| Host does not exist | `HostNotFoundError` / `"Host nosuchhost.invalid not found"` | `ConnectionError: … NameResolutionError(…)` | `TypeError: fetch failed` (cause `ENOTFOUND`, hidden) | `runtime error: http.get() cannot reach 'http://nosuchhost.invalid/x': host not found` |
| Wrong scheme (`ftp://`) | no error, no data — see below | `InvalidSchema: No connection adapters were found for 'ftp://example.org/x'` | `TypeError: fetch failed` (cause `unknown scheme`, hidden) | `runtime error: http.get() supports only http and https addresses, got 'ftp'` |
| Not a URL at all | `ProtocolUnknownError` / `Protocol "" is unknown` | `InvalidURL: Failed to parse: just text` | `TypeError: Failed to parse URL from just text` | `runtime error: http.get() got an address it cannot understand: "just text"` |

Three observations that matter more than the table.

**JavaScript folds three different problems into one sentence.** Probed: dead
port, missing host and bad scheme all produce the identical string
`TypeError: fetch failed`. The distinguishing information lives in `error.cause`
— a property a beginner does not know exists and no tutorial prints. This is
the single worst diagnostic in this part of the series, because the student can
see *that* it failed and has no path at all to *why*.

**Python is loud but buries the sentence.** The message is 220 characters of
connection-pool internals with `Connection refused` at the end. Everything
needed is there; a twelve-year-old reads the first line, sees
`HTTPConnectionPool`, and stops.

**Qt's `ftp://` result is the one to watch.** Probed with the standard
event-loop-and-timer recipe: `finished: false | status: 0 | error(): NoError |
errorString(): "Unknown error" | body: ""`. The reply never finished; the timer
fired; the code then read the attributes of an unfinished reply and got a clean
bill of health with no data. Unless the student tracks a `finished` flag
themselves — which the recipe does not do — **a timeout is indistinguishable
from a successful empty answer**. The same shape appears for a slow server
(probed identically). This is the quiet error the manual event loop buys.

Idyllium's messages are one line, name the cause in four words, and quote the
address back. That last part is not decoration: the most common cause of
`connection refused` in a classroom is a port typo, and seeing the port in the
message ends the search.

---

## 5. Timeouts

**The child writes** a request to a server that has stopped answering.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtNetwork) | **QUIET** | There is no timeout parameter. The teaching recipe adds a `QTimer` — and, as §4 shows, the timeout then presents as a successful empty reply. |
| Python (`requests`) | **QUIET by default**, LOUD when asked | With no `timeout=` argument the call can hang forever — the single most repeated warning in `requests`' own documentation. With it: `ReadTimeout: HTTPConnectionPool(host='127.0.0.1', port=8799): Read timed out. (read timeout=1)` (probed). |
| JavaScript (`fetch`) | **QUIET by default**, LOUD when asked | No timeout option. The modern spelling is `AbortSignal.timeout(1000)`, which produces `DOMException: The operation was aborted due to timeout` (probed) — accurate, but three concepts deep (signals, abort, DOMException) and absent from most tutorials. |
| **Idyllium** | **LOUD, and on by default** | `runtime error: http.get() timed out after 1 seconds for 'http://127.0.0.1:8799/slow'` |

Idyllium ships a 10-second default and `http.set_timeout(seconds)` to change it,
range 1–300, checked at the call:

```text
runtime error: http.set_timeout() expects seconds from 1 to 300, got 0
runtime error: http.set_timeout() expects seconds from 1 to 300, got 301
```

The default is the design point. In two of the three comparison ecosystems the
*correct* code requires an argument the student does not know to pass, and the
punishment for omitting it is a program that hangs — indistinguishable, to a
beginner, from a program that crashed silently.

---

## 6. Redirects

**The child writes** a request to an address that answers "the page moved".

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtNetwork) | **QUIET** | Probed against a 303: `status: 303 | error(): NoError | body: ""`. Qt 5 does not follow redirects unless `FollowRedirectsAttribute` is set. No error, no data, and a status code the student has never heard of. |
| Python (`requests`) | OK | Probed: final `404 False "not found: '/where'"` with `history: [<Response [303]>]` — followed, and the chain is inspectable. |
| JavaScript (`fetch`) | OK | Probed: `404 false true` — followed, with `r.redirected` true. |
| **Idyllium** | **OK** | Probed: follows, and the response is the final one — `status 404, body "not found: '/where'"`. |

This section is short because three of the four behave. It is here because of
what it does to the Qt student: the request "worked", nothing was reported, and
the body is empty. Empty-with-no-error is the shape of every hard bug in this
chapter.

---

## 7. The answer that is not JSON

**The child writes** `json.parse(r.text)` on a response that turned out to be an
error page.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtNetwork + a JSON library) | see part 5 | Depends on the JSON library; part 5 covers nlohmann/json. |
| Python (`requests`) | LOUD, CRYPTIC | Probed: `JSONDecodeError: Expecting value: line 1 column 1 (char 0)`. Accurate and unreadable: it describes a position, not the problem. |
| JavaScript (`fetch`) | LOUD | Probed: `SyntaxError: Unexpected token 'o', "not found: "... is not valid JSON` — Node 20+ quotes the offending text, which is a real improvement. |
| **Idyllium** | **LOUD** | The `json` library's message, quoted in part 5, with the position and the character. |

The important part is not the message but the ordering lesson the course
teaches: **check `ok` before parsing**. The 404 body is text, and the parse
failure the student sees is a *second* symptom of a problem that `ok` already
reported. Every language here permits the mistake; the Idyllium course structures
the first example so that `ok` is read first.

---

## 8. The forgotten `await`

**The child writes** what looks like the whole thing and prints the result.

This section exists for one ecosystem only, and it is the reason the course does
not teach networking through promises.

```js
const r = await fetch(url);
const t = r.text();          // forgot await
console.log(t);
```

```text
type: object | prints as: [object Promise]
```

Probed. No error, no warning, and the program continues. `[object Promise]` is
then written to a file, put on a label, or sent to another server. The same
mistake one level up — forgetting the `await` on `fetch` itself — is equally
silent.

| Ecosystem | Behavior |
|---|---|
| C++ (QtNetwork) | not applicable — the mistake takes a different shape: reading `readAll()` before `finished`, which returns empty (§4). |
| Python (`requests`) | not applicable — synchronous. |
| JavaScript (`fetch`) | **QUIET** |
| **Idyllium** | not applicable — `r.text` is a property holding text. There is no intermediate object to forget. |

There is no equivalent trap in Idyllium because there is no intermediate object:
`http.get` returns a `http.Response`, and `text`, `status` and `ok` are values on
it. The properties are also read-only, so the other half of the mistake is a
compile error rather than a confusing later symptom:

```text
compile error: property 'status' is read-only
```

---

## 9. Becoming a server: the port

**The child writes** `app.port = 8080; app.run()` twice — because the first run
is still going in another window.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | **QUIET — the worst case in this file** | Probed: cpp-httplib sets `SO_REUSEPORT` in its default socket options (confirmed in the header source), so a second server **binds the same port and starts successfully**. Ten requests to one address were answered 4 by the old process and 6 by the new one, at random. A student who forgot to stop the previous run sees roughly half their edits take effect. `listen()` never returns false; nothing is printed anywhere. |
| Python (`http.server`) | LOUD, CRYPTIC | Probed: `OSError: [Errno 98] Address already in use`, at the end of a nine-frame traceback through `socketserver`. |
| JavaScript (`node:http`) | LOUD, CRYPTIC | Probed: `Error: listen EADDRINUSE: address already in use 127.0.0.1:8801`, thrown from an `'error'` event with an eight-frame `node:net` stack. The address is in the message, which is the useful half. |
| **Idyllium** | **LOUD** | `runtime error: web.Server.run() port 8791 is already in use — choose another port or stop the other program` |

The Idyllium message names both remedies, because in a classroom both are used:
change the port, or find the window with the old run in it. That sentence is the
difference between a thirty-second fix and a lost lesson.

Two more port answers, probed:

```text
runtime error: web.Server.port must be an integer from 0 to 65535, got '70000'
```

That one fires at the **assignment**, not at `run()`, so the error points at the
line where the number was written.

And `app.port = 0` asks the operating system for a free port; after `run()`
the `port` property holds the real one, and the console announces the address it
actually got (probed: `Сервер слушает http://127.0.0.1:42179` — "the server is
listening on"; the host console speaks the course's language, while compiler and
runtime error messages are English). That is the escape hatch for a classroom
where twelve students share a machine.

---

## 10. Registering routes

**The child writes** two handlers for the same path — usually by copying the
first one and forgetting to change the string.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | **QUIET** | Probed: both registrations are accepted, the **first** wins, the second is dead code. No warning at registration or at run time. The student edits the second handler for as long as it takes them to give up. |
| Python (`http.server`) | not applicable | There are no routes. Dispatch is an `if` chain the student writes by hand inside `do_GET` — which means duplicate branches are visible in the code, the one honest advantage of having no router. |
| JavaScript (`node:http`) | not applicable | Same: an `if` chain on `req.url`. |
| **Idyllium** | **LOUD** | `runtime error: web.Server.on_get() route '/x' is already registered` |

Idyllium also catches the subtler version — two parameter routes of the same
shape, which no `if` chain would ever notice:

```text
runtime error: web.Server.on_get() route '/post/<slug>' conflicts with already registered '/post/<id>'
```

and the malformed path:

```text
runtime error: web.Server.on_get() path must start with '/', got 'x'
```

All three fire at registration — before the server starts listening, i.e. before
the student can be misled by a page that looks nearly right.

Note what having a router costs the other two columns. Writing dispatch by hand
means the student writes the 404 branch themselves, decides the status code
themselves, and — in practice — forgets the `405 Method Not Allowed` case
entirely, so a form posted to a GET-only path silently reaches the wrong branch.

---

## 11. The request that matches no route

**The child writes** a link with a typo in it, or a form that posts to a path
registered for GET.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | LOUD but empty | Probed: `HTTP/1.1 404 Not Found`, `Content-Length: 0`. Correct, and says nothing about what was asked for. |
| Python (`http.server`) | LOUD | Whatever the student's `else` branch does; `send_error(404)` produces a standard HTML error page. |
| JavaScript (`node:http`) | LOUD | Same — the student's `else` branch. |
| **Idyllium** | **LOUD, and names the path** | Body: `not found: '/nowhere'` — and for the method mismatch, `method GET is not allowed for '/mailbox'` with status 405. |

Both bodies are probed. The 405 case is the one worth defending: a beginner's
form posts to a path they registered with `on_get`, and every other column in
this table answers 404 — "no such page" — for a page that plainly exists. The
student then checks the spelling of a path that was never misspelled. Idyllium
says which of the two things is wrong.

---

## 12. When the handler crashes

**The child writes** a handler that reads past the end of an array — the most
common crash in the course — while a browser is waiting for the answer.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | LOUD but empty, and silent on the server side | Probed: the client gets `HTTP/1.1 500 Internal Server Error` with `Content-Length: 0`; the server process prints **nothing at all**. The exception text exists nowhere unless an exception handler was installed in advance. Server survives. |
| Python (`http.server`) | **QUIET to the client** | Probed: the client received `HTTP/1.0 200 OK` **with an empty body** — because the handler had already sent the status line before the crash. The traceback goes to the server's stderr, which a student running from an IDE may never look at. Server survives. |
| JavaScript (`node:http`) | **FATAL** | Probed: the uncaught exception kills the process. The waiting client gets an empty reply, and every subsequent request is refused because the server is gone. The traceback is printed as the process dies. |
| **Idyllium** | **LOUD for the author, neutral for the visitor** | Client gets status 500 with a neutral page that says where the details are; the full error text goes to the program console; `app.debug = true` (since 1.6.1) puts it into the response as well. The server keeps running. |

Probed, client side:

```text
status 500
body: 500 Internal Server Error — the handler failed; details are in the server console (app.debug = true shows them here)
```

With `app.debug = true;` the body is the error itself:

```text
status 500
body: srv.idyl:23: runtime error: array index 7 out of bounds (size 3, valid indices 0-2)
```

Probed, server console (`[web] запрос GET /boom упал:` — "request GET /boom
failed"):

```text
[web] запрос GET /boom упал: srv.idyl:23: runtime error: array index 7 out of bounds (size 3, valid indices 0-2)
```

Three things are deliberate here. The full message always reaches **the server
console** — file, line and cause. The browser gets a neutral page by default
(since 1.6.1; the industry standard — file names, SQL and table names of the
program are not shown to whoever opened the address), and that page tells the
student where to look and how to bring the text into the browser: `app.debug =
true`, a switch for the author while developing. And the
server **survives**, because a classroom server that dies on the first bad
request turns every debugging cycle into a restart.

The Node column deserves its own sentence, since it is the harshest result in
this file: one bad request from one student ends the server for everyone, and
the last thing the client saw was an empty page. It is the correct choice for
production and a disaster for a lesson.

---

## 13. Answering twice

**The child writes** two `send` calls in one handler — usually by adding a new
answer above the old one and forgetting to delete it.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | **QUIET** | Probed: the second `set_content` overwrites the first; the client gets `second`. No diagnostic. |
| Python (`http.server`) | **QUIET and corrupting** | Probed: the client received `first` followed by the raw text `HTTP/1.0 200 OK`, `Server: BaseHTTP/0.6 Python/3.12.3`, `Date: …` and `second` — the second response's status line and headers were written **into the body of the first**. Nothing is reported. |
| JavaScript (`node:http`) | **FATAL** | Probed: `Error [ERR_STREAM_WRITE_AFTER_END]: write after end` — thrown as an unhandled `'error'` event, killing the process. The client got `first`, then the server was gone. |
| **Idyllium** | **LOUD** | `runtime error: web.Response.send() the response was already sent` — logged on the server, delivered as a 500 (a neutral page; with that text when `app.debug = true`), server keeps running. |

The Python row is the most instructive failure in this whole part. The client
sees a page that begins correctly and then contains what looks like garbage; the
server reports success; and the actual rule — one response per request — is
nowhere in the evidence.

---

## 14. Templates: the escaping question

**The child writes** a page template with the visitor's name in it, and the
visitor is called `Ann & Co`.

Idyllium's `res.send_template(path, values)` renders an ordinary HTML file with
values from a `json.Object`. Everything substituted is **HTML-escaped, always**,
with no opt-out:

```text
<h1>&lt;b&gt;List&lt;/b&gt;</h1>
<p>guest: Ann &amp; Co</p>
```

Probed. The rule the course states is one sentence: *data is text; markup lives
in the template.*

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | not applicable | No template engine. Pages are built by string concatenation, which means no escaping at all unless the student writes it. |
| Python (Jinja2, via Flask) | **QUIET by default outside Flask** | Jinja2's autoescape defaults to **off**; Flask turns it on for `.html` files. A student who uses Jinja2 directly, or renders a `.txt`, gets raw substitution and no warning. |
| JavaScript (EJS) | mixed by syntax | `<%= %>` escapes, `<%- %>` does not. Two characters apart, opposite security properties, and tutorials use both. |
| **Idyllium** | **OK** | Always escaped. There is no unescaped form. |

The second half of the template story is what happens when the *template* is
wrong — a misspelled key, a list where a value was expected. In every mainstream
engine that is an exception, which in a server means a 500 and a blank page for
a typo in an HTML file. Idyllium puts a readable marker **into the page** and
renders everything else (all probed, verbatim):

```text
[[ нет значения 'ghost' ]]            no such value
[[ 'title' — не объект ]]             asked for a field of something that is not an object
[[ у 'guest' нет поля 'x' ]]          that object has no such field
[[ 'items' — список: нужен {% for %} ]]   printed a list as if it were a value
[[ 'title' — не список ]]             looped over something that is not a list
[[ неизвестная команда '{% wat %}' ]] unknown template command
```

The student sees the page they built, with a labelled hole where the mistake is.
Compare with the alternative: a stack trace in a terminal, and a blank browser.

A missing template file *is* an error, and it follows the file-library canon:

```text
runtime error: web.Response.send_template() cannot read 'templates/ghost.html': file does not exist
```

---

## 15. Forms, and the refresh that submits twice

**The child writes** a form, posts it, and then presses F5.

Idyllium's `req.form(name)` reads a field from an
`application/x-www-form-urlencoded` body, handling percent-decoding and
`+`-as-space, and returning an empty string for a field that is not there
(probed: `field: [Ann and Bob], missing: []`).

`res.redirect(path)` always answers **303 See Other** (probed:
`HTTP/1.1 303 See Other`, `location: /where`) — there is no status argument.
That single decision encodes the Post/Redirect/Get pattern into the API: after a
successful POST the handler redirects, and F5 re-runs a GET instead of
resubmitting the form.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (cpp-httplib) | manual | `req.get_param_value()` exists for query strings; form bodies are parsed by the library, redirect is `res.set_redirect(url, status)` with the status left to the student — the default is 302, which browsers may convert POST to GET on, inconsistently. |
| Python (`http.server`) | manual | The student reads `Content-Length`, reads the body, and calls `urllib.parse.parse_qs` — three concepts before the first form field. Redirect is a hand-written status line and `Location` header. |
| JavaScript (`node:http`) | manual | The body arrives as stream events (`req.on('data')`, `req.on('end')`) and must be concatenated before parsing. This is the point where a beginner's server code stops being readable. |
| **Idyllium** | **OK** | `req.form(name)` and `res.redirect(path)`. |

The comparison here is not about diagnostics — it is about how much unrelated
material a form costs. In the three other columns the first form is also the
first stream, or the first query-string parser, or the first argument about
302 vs 303. In Idyllium the first form is a form.

---

## 16. Static files

`app.serve_directory("public")` serves a folder for GET, mapping `/` to
`index.html`. Probed: `/hi.txt` returns the file, `/` returns the index, and both
`GET /../srv.idyl` and its percent-encoded twin `GET /%2e%2e/srv.idyl` return
`not found: '/../srv.idyl'` — the traversal is refused, not sanitized into
something that might work.

That last point is why this short section exists. Python's
`SimpleHTTPRequestHandler` blocks it too (probed: both spellings give
`HTTP/1.0 404 File not found`), and so does cpp-httplib's `set_mount_point`
(documented). But hand-rolled static serving — which is what a `node:http`
tutorial teaches, with `fs.readFile(__dirname + req.url)` — does not, and that
exact line is in circulation. A student who copies it publishes
their whole disk to the local network the moment they set `host = "0.0.0.0"`.

---

## 17. Talking to the program next door

**The child writes** two programs that should hear each other on one computer —
a chat between two windows, or a game with two players.

Idyllium's `channel` library is a named mailbox, not a network:

```idyllium
use channel;
use console;

void function on_letter(string text) {
    console.writeln("Received: ", text);
}

main() {
    channel.Post office;
    office.open("room-101");
    office.on_message = on_letter;
    office.send("Hello neighbours!");
}
```

Same name, same room. A message reaches every other participant; the sender
never receives its own.

| Ecosystem | Behavior | Detail |
|---|---|---|
| C++ (QtNetwork `QLocalServer`/`QLocalSocket`) | LOUD, heavy | A real answer to the real problem — a named local socket — with the full apparatus: one side is a server, the other a client, connection state is explicit, and the message is a byte stream the student must frame themselves. Roughly the same concept count as §2's client. |
| Python (`multiprocessing.connection`) | LOUD | Probed, and short — a 4-line listener and a 3-line sender. But it is point-to-point over a **port** with an `authkey`, one connection at a time, and the listener must be started first: sending with nobody listening raises `ConnectionRefusedError: [Errno 111] Connection refused` (probed). No broadcast; three participants means writing a hub. |
| JavaScript (`BroadcastChannel`) | **QUIET outside the browser** | In a browser it is exactly this idea, between tabs of one origin. In Node it exists, and probed: two `BroadcastChannel` objects **in one process** hear each other, and **two separate Node processes hear nothing at all** — no error, no warning, the message simply goes nowhere. |
| **Idyllium** | **OK where it works, LOUD where it cannot** | Web IDE: between browser tabs. VS Code: within the window. Console/CLI: refuses. |

The refusal is the point of this section:

```text
runtime error: Post.open() is not available in the console host — run the program in the Web IDE or VS Code, where running programs can hear each other
```

Probed. Compare with the Node row: the same impossible situation, and the
student is told nothing. A message that goes nowhere, silently, is the hardest
bug in this entire file to diagnose, because every line of the program is
correct.

The other channel diagnostic, for the ordering mistake every beginner makes
once:

```text
runtime error: Post.send() the post is not open — call open(name) first
```

Two limits stated honestly: messages are **not stored** — a participant that
opens the room after a send hears nothing — and delivery is not confirmed. Both
are BroadcastChannel semantics, both are documented, and both are things a
protocol built on top must handle. The course's advice is to send JSON text and
design the protocol before coding.

---

## 18. Reading an address apart

The `url` library parses; it does not fetch. Probed on
`https://www.example.org/watch?v=abc&t=43#top`:

```text
scheme: https      host: www.example.org      path: /watch
query: v=abc&t=43  fragment: top              port: 443
query_value("v"): abc      query_value("zz"): ""
```

Three design decisions visible in that output. **`port` reports the default**
(443 here, 80 for `http://`, probed) rather than 0 or an empty value, so
comparing ports never needs a special case. **A missing query parameter is an
empty string**, not an error and not a null — the same convention as `form()`
and `param()` on the server side. And **`path` on a bare host is `/`** (probed),
not an empty string.

Garbage is loud rather than empty:

```text
runtime error: url.scheme() got an address it cannot understand: "just text"
```

`url.is_valid()` is the way to ask without risking the error — probed:
`is_valid("just text")` is false. Note one honest wrinkle: `is_valid` answers
*is this a well-formed URL*, so `ftp://example.org` is **true**, while
`url.open` on it refuses (`url.open() supports only http and https addresses,
got 'file'` for the `file:` case, probed). Validity and openability are
different questions; the names could say so more clearly. See §21.

`url.open()` is restricted to `http` and `https` on every host: `file:`,
`javascript:` and `data:` are refused with the message above. For a language
whose programs run in a browser tab in one of its hosts, that restriction is not
politeness — it is the difference between a link and a script injection.

---

## 19. A complete program

Server and client, both in Idyllium, both probed:

```idyllium
use web;
use console;

void function ok(web.Request req, web.Response res) {
    res.send("hello, " + req.query("name"));
}

void function api(web.Request req, web.Response res) {
    res.send_json("{\"players\": 3}");
}

void function mailbox(web.Request req, web.Response res) {
    res.status = 201;
    res.send("got: " + req.body);
}

void function card(web.Request req, web.Response res) {
    res.send("card " + req.param("id"));
}

main() {
    web.Server app;
    app.on_get("/ok", ok);
    app.on_get("/api", api);
    app.on_post("/mailbox", mailbox);
    app.on_get("/post/<id>", card);
    app.port = 8791;
    app.run();
}
```

```idyllium
use console;
use http;

main() {
    http.Response r = http.get("http://127.0.0.1:8791/ok?name=Ann");
    console.writeln("status ", r.status, ", ok ", r.ok);
    console.writeln("body: ", r.text);
    console.writeln("type: [", r.header("content-type"), "]");
    console.writeln("no such header: [", r.header("x-nope"), "]");

    http.Response miss = http.get("http://127.0.0.1:8791/nowhere");
    console.writeln("404: ", miss.status, ", ok ", miss.ok, ", body: ", miss.text);

    http.Response wrong = http.get("http://127.0.0.1:8791/mailbox");
    console.writeln("405: ", wrong.status, ", body: ", wrong.text);

    http.Response par = http.get("http://127.0.0.1:8791/post/17");
    console.writeln("parameter: ", par.text);

    http.Response posted = http.post("http://127.0.0.1:8791/mailbox", "letter");
    console.writeln("post: ", posted.status, ", body: ", posted.text);

    http.Response blank;
    console.writeln("blank: ", blank.status, ", ok ", blank.ok, ", body [", blank.text, "]");
}
```

```text
status 200, ok true
body: hello, Ann
type: [text/html; charset=utf-8]
no such header: []
404: 404, ok false, body: not found: '/nowhere'
405: 405, body: method GET is not allowed for '/mailbox'
parameter: card 17
post: 201, body: got: letter
blank: 0, ok false, body []
```

Two details in that last output are load-bearing. `header()` for a header that
is not there returns an empty string rather than a null or an error — the same
convention as `query`, `param` and `form`, so the student learns one rule for
"asked for something that is not there" across the whole networking surface. And
a `http.Response` that has never been used reads as `status 0, ok false, text ""`
— a blank, not a crash, so the declaration-before-use pattern the course uses
everywhere else works here too.

---

## 20. Summary: the quiet-error inventory of the networking topic

| # | Situation | C++ | Python | JavaScript | **Idyllium** |
|---|---|---|---|---|---|
| 1 | First request | CRYPTIC (26 lines, event loop) | OK | CRYPTIC (two awaits) | **OK** |
| 2 | 404 | CRYPTIC (error, not data) | OK / LOUD (`urllib`) | **QUIET** | **OK** |
| 3 | `errorString()` on success | **QUIET** (`"Unknown error"`) | n/a | n/a | n/a |
| 4 | Unreachable address | LOUD | LOUD, buried | **QUIET** (`fetch failed` ×3 causes) | **LOUD, cause named** |
| 5 | Timeout | **QUIET** (looks like empty success) | QUIET by default | QUIET by default | **LOUD, on by default** |
| 6 | Redirect | **QUIET** (303, empty body) | OK | OK | **OK** |
| 7 | Forgotten `await` | n/a | n/a | **QUIET** (`[object Promise]`) | n/a |
| 8 | Port already in use | **QUIET** (two servers share it) | LOUD, CRYPTIC | LOUD, CRYPTIC | **LOUD, both remedies named** |
| 9 | Duplicate route | **QUIET** (first wins) | n/a (hand-written) | n/a (hand-written) | **LOUD at registration** |
| 10 | Wrong method on a real path | n/a | usually 404 | usually 404 | **405, path named** |
| 11 | Handler crash | LOUD, empty, unlogged | **QUIET** (200 + empty body) | **FATAL** (server dies) | **LOUD to client and log, server survives** |
| 12 | Answering twice | **QUIET** (last wins) | **QUIET, corrupts the body** | **FATAL** | **LOUD** |
| 13 | Template typo | n/a | 500, blank page | 500, blank page | **marker in the page, page renders** |
| 14 | Template escaping | none | off by default outside Flask | depends on `<%=` vs `<%-` | **always on** |
| 15 | Channel with nobody there | LOUD | LOUD | **QUIET** (Node: nothing happens) | **LOUD refusal with the reason** |

Fifteen rows; sixteen QUIET or FATAL cells across the comparison columns,
spread over eleven of the fifteen situations, and none in Idyllium's column. The pattern is the same one parts 1–6 found, with one new twist that
belongs to this topic alone: **the two most dangerous cells in the table
(§9 shared port, §12 handler crash) are not about wrong values at all.** They
are about a program that keeps running while being wrong, which is what a server
is.

---

## 21. Honest residue: what Idyllium's networking still does not catch

This section is the price of the file's credibility. Everything here was probed.

1. **There is no access log.** Probed: a successful request produces no line
   anywhere. Only crashes are logged. A student whose page is blank cannot tell
   whether the request reached the server at all — the one question the server is
   best placed to answer. A one-line `GET /ok 200` per request would end a whole
   class of confusion.
2. **`http.post` cannot set a content type.** The body always goes as
   `text/plain; charset=utf-8` (probed). This matches the ecosystem — probed:
   `requests` with a raw string body sends **no** `Content-Type` at all, and
   `fetch` sends `text/plain;charset=UTF-8` — so the default is not the problem;
   the absence of an override is. A real JSON API that requires
   `application/json` cannot be reached, and the failure will look like a server
   bug rather than a client one.
3. **The synchronous model has no escape hatch.** Probed: a five-second answer
   holds the program for 5.37 s, GUI included. The design is deliberate and this
   file defends it in §2, but the honest statement is that a program which needs
   to stay responsive during a request currently cannot.
4. **`url.is_valid` and `url.open` disagree by design.** `is_valid` asks whether
   the text is a well-formed URL, so `ftp://example.org` is true; `open` accepts
   only `http`/`https`. Both behaviors are right, and the pair of names invites a
   student to use the first as a guard for the second.
5. **A dead handler is invisible.** A route registered with a handler that never
   sends anything is legal; the client waits. Duplicate registration is caught
   (§10), the empty handler is not.
6. **Channel messages are unacknowledged and unstored.** Documented, and
   inherent to the BroadcastChannel model underneath, but it means the first
   student protocol that assumes delivery will fail intermittently — the worst
   failure mode to debug — and nothing in the library warns them.

Item 1 is a cheap fix. Item 2 is a real gap for any lesson that talks to a
public API. Item 3 is a course decision, not a defect, and is listed here so
that nobody reads §2 as a claim that synchronous is free.

One item that used to head this list is gone: `web.Server.port` was validated
only at `run()`, so an impossible port was reported a few lines away from where
it was written. It is now checked at the assignment — probed:
`app.port = 70000;` stops on its own line, while `0`, `8099` and `65535` are
accepted as before.

---

## 22. Rules for an AI using this file

1. **Do not translate an asynchronous shape into Idyllium.** `http.get` returns
   the response. There is no promise, no callback, no `await`, and no
   `.then()`. Code that awaits an Idyllium call does not compile.
2. **Check `ok` or `status` before using `text`.** A 404 is a normal return
   value with a body. Do not wrap `http.get` in error handling expecting it to
   throw on 404; it throws only when the request could not be made at all
   (§4, §5).
3. **Server handlers take exactly `(web.Request req, web.Response res)`** and
   send exactly one answer. A second `send` is a runtime error (§13).
4. **Ask for things that may be missing without guarding.** `header`, `query`,
   `param` and `form` all return an empty string when the thing is absent. Do
   not write null checks; there are no nulls here.
5. **Register routes before `run()`**, and remember `run()` never returns.
   Anything after it is dead code.
6. **Path parameters are always strings.** `req.param("id")` on `/post/17`
   returns `"17"`; convert with `to_int` yourself.
7. **Do not build HTML by concatenating user text.** Use
   `res.send_template(path, values)`; substitution is escaped and that is the
   point (§14).
8. **After a successful POST from a form, redirect.** `res.redirect(path)`
   answers 303; this is the pattern the library was shaped for (§15).
9. **`channel` is not networking.** It reaches other *running programs on this
   computer* in the Web IDE and VS Code, and refuses in a console run. Do not
   propose it as a way for two computers to talk.
10. **`url` never touches the network** — it parses, and `url.open` hands an
    address to the browser. It is not a client.
11. **When quoting a message from this file, quote it exactly.** The messages are
    part of the teaching surface; a paraphrase in a lesson is a message the
    student will never see on screen.
12. **Do not claim a behavior this file has not probed.** If a case is not
    listed, say it is untested rather than inferring it from another language's
    library of the same name.

---

## 23. Provenance

Idyllium behavior: probed on the CLI host, build 1.5.2 (re-verified after the
23 August fix that moved `web.Server.port` validation to the assignment),
against a local
Idyllium `web` server, a Python `http.server` used as a slow-and-echo endpoint,
and deliberately dead addresses. Every quoted Idyllium message is captured
output.

Comparison columns, all built and run on the same machine against the same
endpoints:

- **C++**: g++ 13.3, `-std=c++17`. Client — Qt 5.15.13 `QtNetwork`
  (`QNetworkAccessManager`, `QNetworkReply`, `QEventLoop`, `QTimer`), the
  standard synchronous-wait recipe, instrumented with a `finished` flag to
  distinguish a timeout from an empty success. Server — cpp-httplib (single
  header, current master), built and run; the shared-port result was verified by
  running two differently-answering binaries on one port and counting ten
  client requests.
- **Python**: CPython 3.12.3. Client — `requests` 2.31.0, with
  `urllib.request` probed alongside for the 404 comparison. Server —
  `http.server.BaseHTTPRequestHandler`. IPC — `multiprocessing.connection`.
- **JavaScript**: Node 22.18.0. Client — built-in `fetch` (with
  `AbortSignal.timeout` for the timeout row). Server — `node:http`. Channel —
  built-in `BroadcastChannel`, probed both within one process and across two.

Documentary, not probed, and marked as such in the text: the Jinja2 and EJS
escaping defaults (§14), the Qt `QLocalServer` shape (§17), and cpp-httplib's
`set_redirect` default status (§15).

Where a section says "probed", captured output exists for that claim. Where it
says "documented", the claim comes from the library's own reference. Nothing in
this file is inferred from a language's reputation.
