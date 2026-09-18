// ─── Embed-юнит: тексты на двух языках ─────────────────────────────────────
// Проверяющий и модель говорят кодами причин; слова подставляются здесь.
// Русский — основной, английский — для нерусскоязычных платформ (`lang="en"`).
// Тон — по эмоциональным правилам курса: без «НЕВЕРНО» капсом, ошибка — повод
// посмотреть, что именно не сошлось.
import { Reason } from './checker';

export type UnitLang = 'ru' | 'en';

type Templates = Readonly<Record<string, readonly [string, string]>>;

// [русский, английский]; {имя} — подстановка параметра.
const TEMPLATES: Templates = {
  // вердикты
  'verdict.solved': ['Решено верно — проверок пройдено: {passed} из {total}.', 'Solved — checks passed: {passed} of {total}.'],
  'verdict.failed': ['Пока не сходится: пройдено {passed} из {total}.', 'Not there yet: {passed} of {total} checks passed.'],
  'verdict.failed-input': ['При вводе «{input}» программа ответила: {answer}', 'With input "{input}" the program answered: {answer}'],
  'verdict.failed-noinput': ['Программа ответила: {answer}', 'The program answered: {answer}'],
  'verdict.empty-answer': ['(ничего)', '(nothing)'],
  'verdict.expected': ['Ожидалось: {expected}', 'Expected: {expected}'],
  'verdict.soft-matches': ['Этот запуск сходится с условием. Нажмите «Проверить», чтобы проверить решение целиком.', 'This run matches the task. Press "Check" to test the whole solution.'],
  'verdict.soft-differs': ['В этом запуске ответ не сходится с условием — посмотрите на вывод ещё раз.', 'In this run the answer does not match the task — look at the output again.'],
  // причины прогона
  'run.compile': ['Программа не запустилась — в ней ошибка:\n{text}', 'The program did not start — it has an error:\n{text}'],
  'run.runtime': ['Программа остановилась с ошибкой:\n{text}', 'The program stopped with an error:\n{text}'],
  'run.input-type-int': ['Программа ждала целое число, а во вводе было «{got}». Если это значение бывает дробным, его читают через console.get_float().', 'The program expected an integer but the input was "{got}". If this value can be fractional, read it with console.get_float().'],
  'run.input-type-float': ['Программа ждала число, а во вводе было «{got}».', 'The program expected a number but the input was "{got}".'],
  'run.timeout': ['Программа работала дольше {seconds} секунд и была остановлена — нет ли в ней вечного цикла?', 'The program ran longer than {seconds} seconds and was stopped — is there an endless loop?'],
  'run.stopped': ['Программа остановлена.', 'The program was stopped.'],
  'run.output-limit': ['Программа вывела слишком много текста и была остановлена.', 'The program printed too much text and was stopped.'],
  'run.input-forbidden': ['Программа ждёт ввод, а по условию задачи ввода нет.', 'The program waits for input, but this task has none.'],
  'run.input-exhausted': ['Программа просит больше данных, чем даёт условие (в тесте было значений: {given}).', 'The program asks for more input than the task gives (values in the test: {given}).'],
  // причины проверки
  'check.rule': ['Не выполнено условие: {rule}', 'The condition does not hold: {rule}'],
  'check.count': ['В ответе значений: {got}, а должно быть {expected}.', 'The answer has {got} values, expected {expected}.'],
  'check.value': ['Значение №{index} в ответе не сходится (получено: {got}).', 'Value #{index} of the answer does not match (got: {got}).'],
  'check.line': ['Строка {line} вывода не сходится (получено: {got}).', 'Output line {line} does not match (got: {got}).'],
  'check.line-missing': ['В выводе не хватает строки {line}.', 'Output line {line} is missing.'],
  'check.line-extra': ['В выводе лишняя строка {line}: {got}', 'Extra output line {line}: {got}'],
  'check.none': ['У этого юнита нет проверки.', 'This unit has no check.'],
  'check.nothing-applied': ['Ни одно правило проверки не подошло ни к одному тесту.', 'No check rule applied to any test.'],
  'check.reference-broken': ['Эталонное решение автора не отработало — сообщите автору задачи.', 'The author\'s reference solution failed — please tell the task author.'],
  // требования к коду
  'code.require': ['В решении нужно использовать «{word}».', 'The solution must use "{word}".'],
  'code.forbid': ['В этой задаче нельзя использовать «{word}».', 'This task does not allow "{word}".'],
  'code.max-calls': ['Вызовов {name}() в решении: {got}, а разрешено не больше {limit}.', 'The solution calls {name}() {got} times; at most {limit} allowed.'],
  // формулы
  'formula.string-open': ['В формуле не закрыта кавычка (позиция {at}).', 'A quote is never closed in the formula (position {at}).'],
  'formula.slot-open': ['В формуле не закрыта фигурная скобка (позиция {at}).', 'A curly brace is never closed in the formula (position {at}).'],
  'formula.slot-name': ['Неизвестное значение {got} (позиция {at}) — бывают {in1}, {out1}, {line1}, {ins}, {outs}, {lines}, {output}.', 'Unknown value {got} (position {at}) — use {in1}, {out1}, {line1}, {ins}, {outs}, {lines}, {output}.'],
  'formula.use-word': ['В формуле «{got}» (позиция {at}) — в Idyllium это пишется «{use}».', 'The formula has "{got}" (position {at}) — in Idyllium it is written "{use}".'],
  'formula.unexpected-char': ['Непонятный символ «{got}» в формуле (позиция {at}).', 'Unexpected character "{got}" in the formula (position {at}).'],
  'formula.unexpected': ['Лишнее «{got}» в формуле (позиция {at}).', 'Unexpected "{got}" in the formula (position {at}).'],
  'formula.ended': ['Формула оборвана (позиция {at}).', 'The formula ends too early (position {at}).'],
  'formula.paren-open': ['В формуле не закрыта скобка (позиция {at}).', 'A parenthesis is never closed in the formula (position {at}).'],
  'formula.unknown-word': ['Неизвестное слово «{got}» в формуле (позиция {at}).', 'Unknown word "{got}" in the formula (position {at}).'],
  'formula.call-paren': ['После {name} нужны скобки с аргументами (позиция {at}).', '{name} needs parentheses with arguments (position {at}).'],
  'formula.arity': ['У {name}() не то число аргументов: {got} (позиция {at}).', '{name}() got a wrong number of arguments: {got} (position {at}).'],
  'formula.not-number': ['Формула ждала число, а получила «{got}».', 'The formula expected a number but got "{got}".'],
  'formula.not-bool': ['Формула ждала «да/нет», а получила «{got}».', 'The formula expected true/false but got "{got}".'],
  'formula.division-by-zero': ['В формуле деление на ноль.', 'Division by zero in the formula.'],
  'formula.slot-missing-out': ['В ответе нет значения {out{index}}: программа вывела значений — {have}.', 'The answer has no {out{index}}: the program printed {have} value(s).'],
  'formula.slot-missing-line': ['В ответе нет строки {line{index}}: программа вывела строк — {have}.', 'The answer has no {line{index}}: the program printed {have} line(s).'],
  'formula.slot-missing-in': ['Программа не прочитала значение {in{index}}: прочитано значений — {have}.', 'The program did not read {in{index}}: it read {have} value(s).'],
  'formula.crashed': ['Формула не вычислилась: {text}', 'The formula could not be evaluated: {text}'],
  // конфигурация
  'config.format-newer': ['Файл юнита новее этой версии Idyllium (формат {format}, поддерживается {supported}).', 'The unit file is newer than this Idyllium (format {format}, supported {supported}).'],
  'config.lib-unavailable': ['Библиотека «{name}» в юнитах недоступна и пропущена.', 'Library "{name}" is not available in units and was skipped.'],
  'config.test-range': ['Тест №{index}: диапазон случайных чисел задан неверно.', 'Test #{index}: the random range is wrong.'],
  'config.test-shape': ['Тест №{index}: нет ни ввода, ни описания случайных чисел.', 'Test #{index}: neither input nor a random description.'],
  'config.formula-empty': ['Выбрана проверка формулами, но ни одной формулы нет.', 'Formula check is selected but there are no formulas.'],
  'config.check-kind': ['Неизвестный способ проверки «{kind}».', 'Unknown check kind "{kind}".'],
  'config.reference-missing': ['Выбрана проверка по эталону, но эталонного решения нет.', 'Reference check is selected but there is no reference solution.'],
  'config.tests-missing': ['У задачи с вводом нет ни одного теста.', 'The task reads input but has no tests.'],
  'config.tests-ignored': ['Отмечено «ввода нет» — тесты с вводом не будут использованы.', '"No input" is selected — tests with input will not be used.'],
  'config.hook-name': ['Имя функции «{name}» ({which}) записано неверно: нужны имя или путь через точку, например lms.report.', 'Function name "{name}" ({which}) is malformed: use a name or a dotted path like lms.report.'],
  'config.unreadable': ['Настройки юнита не читаются: {text}', 'The unit settings cannot be read: {text}'],
  // самопроверка конструктора
  'self.formula': ['Формула не разбирается.', 'A formula cannot be parsed.'],
  'self.no-check': ['Проверка не выбрана — юнит будет песочницей без вердикта.', 'No check selected — the unit will be a sandbox without a verdict.'],
  'self.no-solution': ['Решение автора не задано — самопроверка невозможна: опечатку в проверке первым найдёт ученик.', 'No author solution — self-check is impossible: a typo in the check will be found by a student first.'],
  'self.solution-passes': ['Решение автора проходит все проверки ({total}).', 'The author solution passes all checks ({total}).'],
  'self.solution-fails': ['Решение автора НЕ проходит проверку: при вводе «{input}» ответ «{answer}».', 'The author solution does NOT pass: input "{input}", answer "{answer}".'],
  'self.solution-blocked': ['Решение автора не дошло до тестов.', 'The author solution did not reach the tests.'],
  'self.starter-passes': ['Заготовка уже проходит проверку — задача решена выданным кодом.', 'The starter code already passes — the task is solved by the given code.'],
  'self.starter-broken': ['Заготовка не компилируется. Если так задумано («допишите условие») — всё в порядке.', 'The starter code does not compile. Fine if intended ("fill in the condition").'],
  'self.tests-no-fraction': ['Решение читает дробное число (ввод №{index}), а в тестах на этом месте только целые. Ученик, прочитавший его через get_int или сравнивший с «не той» границей, пройдёт проверку. Добавьте дробные вводы или дробные случайные числа.', 'The solution reads a fractional number (input #{index}) but the tests only have integers there. A student reading it with get_int, or comparing with a slightly wrong bound, will pass. Add fractional inputs or fractional random numbers.'],
  'self.mutant-survives': ['Тесты не отличают ваше решение от варианта, где в строке {line} вместо «{was}» стоит «{now}». Их различает ввод «{input}» — добавьте такой тест.', 'The tests cannot tell your solution from a variant where line {line} has "{now}" instead of "{was}". Input "{input}" tells them apart — add such a test.'],
  'self.random-no-seed': ['В коде ({which}) есть random без random.set_seed(): ответы будут разными при каждом запуске. Задайте сид (и назовите его в условии) либо проверяйте попадание в границы.', 'The code ({which}) uses random without random.set_seed(): answers differ on every run. Set a seed (and name it in the task) or check that results fall within bounds.'],
  'self.time-now': ['В коде ({which}) есть time.now(): ответ зависит от часов, точным сравнением его не проверить.', 'The code ({which}) uses time.now(): the answer depends on the clock and cannot be checked exactly.'],
  'self.time-sleep': ['В коде ({which}) есть time.sleep(): в юните он спит по-настоящему. Держите сумму пауз в пределах 10 секунд — дольше тест не ждёт.', 'The code ({which}) uses time.sleep(): it really sleeps in a unit. Keep the total under 10 seconds — a test waits no longer.'],
};

export function unitText(lang: UnitLang, code: string, params: Readonly<Record<string, string | number>> = {}): string {
  const pair = TEMPLATES[code];
  if (!pair) return code;
  let text = pair[lang === 'en' ? 1 : 0];
  // Сначала вложенные подстановки вида {out{index}}, затем обычные.
  for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

export function reasonText(lang: UnitLang, reason: Reason | null | undefined): string {
  return reason ? unitText(lang, reason.code, reason.params) : '';
}

/** Все строки интерфейса разом — кадру удобнее один словарь. */
export function unitDictionary(lang: UnitLang): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [code, pair] of Object.entries(TEMPLATES)) result[code] = pair[lang === 'en' ? 1 : 0];
  return result;
}
