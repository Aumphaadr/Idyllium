import { runIdyllium } from '../src';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── E7-страж (просьба методистов, 2026-08-22; сделан 2026-08-29) ────────────
// Три задания книги про случайность печатают КОНКРЕТНЫЕ числа под фиксированным
// сидом. Смена генератора устарела бы книгу молча — а этот тест сверяет живой
// прогон с числами, ВЫРЕЗАННЫМИ ИЗ САМОЙ КНИГИ. Страж двусторонний: ловит и
// дрейф генератора, и правку чисел в книге без пересчёта.

const WORKBOOK = 'packages/docs/manual-content/tasks/console/random.html';

/** Первый <idyl-output-block> после заголовка задания. */
function expectedOutput(html: string, taskTitle: string): string {
  const at = html.indexOf(taskTitle);
  assert(at >= 0, `task "${taskTitle}" not found in ${WORKBOOK}`);
  const open = html.indexOf('<idyl-output-block>', at);
  assert(open >= 0, `no output block after "${taskTitle}"`);
  const close = html.indexOf('</idyl-output-block>', open);
  assert(close >= 0, `unterminated output block after "${taskTitle}"`);
  return html.slice(open + '<idyl-output-block>'.length, close);
}

interface SeedSample {
  readonly task: string;
  readonly program: string;
  /** Вывод программы, каким его печатает книга (без строк-приглашений ввода). */
  readonly bookOutput: (raw: string) => string;
}

const SAMPLES: readonly SeedSample[] = [
  {
    task: 'Задание 14. Заклинание повторяемости',
    // Программа приведена в книге дословно.
    program: `use console;
use random;

main() {
    random.set_seed(2026);
    console.writeln(random.create_int(1, 100));
    console.writeln(random.create_int(1, 100));
    console.writeln(random.create_int(1, 100));
}
`,
    bookOutput: (raw) => raw,
  },
  {
    task: 'Задание 15. Код мира',
    // Самостоятельное задание: книга даёт условие (сид 42; горы 80–250,
    // пещеры 10–60, деревни 0–5 — в этом порядке) и образец вывода.
    // Эталонная программа повторяет условие буквально.
    program: `use console;
use random;

main() {
    random.set_seed(42);
    console.writeln("Высота гор: ", random.create_int(80, 250), " м");
    console.writeln("Глубина пещер: ", random.create_int(10, 60), " м");
    console.writeln("Деревень на карте: ", random.create_int(0, 5));
}
`,
    // Первая строка образца — эхо ввода «Введите код мира: 42», программа
    // стража сид ставит напрямую; сверяются разыгранные строки.
    bookOutput: (raw) => raw.split('\n').slice(1).join('\n'),
  },
  {
    task: 'Задание 23 ⭐. Точность по заказу',
    program: `use console;
use random;
use math;

main() {
    random.set_seed(3);
    float raw = random.create_float(0.0, 100.0);
    console.writeln("сырое:  ", raw);
    console.writeln("0 знаков: ", math.floor(raw, 0));
    console.writeln("1 знак:   ", math.floor(raw, 1));
    console.writeln("2 знака:  ", math.floor(raw, 2));
}
`,
    bookOutput: (raw) => raw,
  },
];

async function main(): Promise<void> {
  const html = fs.readFileSync(path.join(process.cwd(), WORKBOOK), 'utf8');
  let passed = 0;

  for (const sample of SAMPLES) {
    const expected = sample.bookOutput(expectedOutput(html, sample.task));
    const result = await runIdyllium(sample.program, {}, { file: 'main.idyl' });
    assert(result.success, `${sample.task}: program failed: ${result.runtimeError ?? result.compilation.diagnosticsText}`);
    const actual = result.output.replace(/\n$/, '');
    assert(
      actual === expected,
      `${sample.task}: seeded output drifted from the book.\nbook:\n${expected}\nrun:\n${actual}\n`
      + 'Either the generator changed (the book must be reprinted) or the book was edited without rerunning the seeds.',
    );
    passed += 1;
    console.log(`ok - ${sample.task}`);
  }

  console.log(`\npassed: ${passed}`);
  console.log('failed: 0');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
