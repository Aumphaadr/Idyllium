#!/usr/bin/env node

import { compileIdyllium, runIdyllium } from './runtime/run';

const fs: any = require('fs');
const path: any = require('path');
const readline: any = require('readline');

export interface CliIO {
  cwd(): string;
  readFile(file: string): string;
  stdout(text: string): void;
  stderr(text: string): void;
  readLine(): Promise<string>;
  clear?(): void;
  close?(): void;
}

export async function runCli(argv: readonly string[] = process.argv.slice(2), io: CliIO = createNodeCliIO()): Promise<number> {
  try {
    const command = argv[0];
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      io.stdout(helpText());
      return 0;
    }

    if (command === '--version' || command === '-v') {
      io.stdout(`${version()}\n`);
      return 0;
    }

    if (command === 'check') return checkCommand(argv.slice(1), io);
    if (command === 'run') return runCommand(argv.slice(1), io);

    io.stderr(`unknown command '${command}'\n\n${helpText()}`);
    return 2;
  } catch (error) {
    io.stderr(`${formatThrownError(error)}\n`);
    return 1;
  } finally {
    io.close?.();
  }
}

async function checkCommand(args: readonly string[], io: CliIO): Promise<number> {
  const file = singleFileArgument('check', args, io);
  if (!file) return 2;

  const source = readSource(file, io);
  const result = compileIdyllium(source, compileOptions(file, io));
  if (!result.success) {
    io.stderr(`${result.diagnosticsText}\n`);
    return 1;
  }

  if (result.diagnosticsText) io.stderr(`${result.diagnosticsText}\n`);
  io.stdout(`${file}: ok\n`);
  return 0;
}

async function runCommand(args: readonly string[], io: CliIO): Promise<number> {
  const file = singleFileArgument('run', args, io);
  if (!file) return 2;

  const source = readSource(file, io);
  const result = await runIdyllium(
    source,
    {
      projectRoot: path.dirname(resolveFilePath(file, io.cwd())),
      console: {
        write(text) {
          io.stdout(String(text));
        },
        clear() {
          io.clear?.();
        },
        readLine() {
          return io.readLine();
        },
      },
    },
    compileOptions(file, io),
  );

  if (!result.success) {
    if (result.compilation.diagnosticsText) io.stderr(`${result.compilation.diagnosticsText}\n`);
    if (result.runtimeError) io.stderr(`${result.runtimeError}\n`);
    return 1;
  }

  // Код завершения принадлежит среде, а не программе: он идёт в stderr, чтобы
  // `idyllium run prog.idyl > out.txt` не подмешивал служебную строку в файл.
  // Серый — тот же «светлый чёрный» \e[90m, о котором рассказывает урок 06.
  if (result.exitText !== null) {
    const processCode = exitCodeForProcess(result.exitCode);
    const suffix = result.exitCode !== null && result.exitCode !== processCode
      ? ` (процесс вернул ${processCode})`
      : '';
    io.stderr(`\u001b[90m[Программа завершилась с кодом ${result.exitText}${suffix}]\u001b[0m\n`);
    return processCode;
  }

  return 0;
}

/** POSIX хранит код возврата в одном байте; всё, что не влезло, честно называется в сообщении. */
function exitCodeForProcess(code: number | null): number {
  if (code === null) return 0;
  return ((Math.trunc(code) % 256) + 256) % 256;
}

function singleFileArgument(command: string, args: readonly string[], io: CliIO): string | null {
  if (args.length === 1 && !args[0].startsWith('-')) return path.normalize(args[0]);
  io.stderr(`usage: idyllium ${command} <file.idyl>\n`);
  return null;
}

function readSource(file: string, io: CliIO): string {
  try {
    return io.readFile(resolveFilePath(file, io.cwd()));
  } catch (_error) {
    // сырой ENOENT из readFileSync — не для учеников
    throw new Error(`cannot open '${file}': file does not exist`);
  }
}

function compileOptions(file: string, io: CliIO) {
  return {
    file,
    resolveModule(moduleName: string, fromFile: string) {
      const candidate = path.normalize(path.join(path.dirname(fromFile), `${moduleName}.idyl`));
      try {
        return {
          file: candidate,
          source: io.readFile(resolveFilePath(candidate, io.cwd())),
        };
      } catch {
        return null;
      }
    },
  };
}

function resolveFilePath(file: string, cwd: string): string {
  return path.isAbsolute(file) ? path.normalize(file) : path.resolve(cwd, file);
}

function createNodeCliIO(): CliIO {
  // Строки складываются в очередь по событию 'line': readline.question() терял
  // ввод, пришедший одним куском (echo "1\n2" | idyllium run ...), — строки,
  // эмитированные между вопросами, пропадали без слушателя.
  let input: any = null;
  const bufferedLines: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  let inputClosed = false;

  const ensureInput = () => {
    if (input) return;
    input = readline.createInterface({ input: process.stdin });
    input.on('line', (line: string) => {
      const waiter = waiters.shift();
      if (waiter) waiter(line);
      else bufferedLines.push(line);
    });
    input.on('close', () => {
      inputClosed = true;
      while (waiters.length > 0) waiters.shift()?.('');
    });
  };

  return {
    cwd() {
      return process.cwd();
    },
    readFile(file: string) {
      return fs.readFileSync(file, 'utf8');
    },
    stdout(text: string) {
      process.stdout.write(text);
    },
    stderr(text: string) {
      process.stderr.write(text);
    },
    clear() {
      process.stdout.write('\x1b[2J\x1b[H');
    },
    readLine() {
      ensureInput();
      const buffered = bufferedLines.shift();
      if (buffered !== undefined) return Promise.resolve(buffered);
      if (inputClosed) return Promise.resolve('');
      return new Promise<string>((resolve) => {
        waiters.push(resolve);
      });
    },
    close() {
      input?.close();
    },
  };
}

function helpText(): string {
  return [
    'Idyllium command line tools',
    '',
    'Usage:',
    '  idyllium run <file.idyl>    Compile and run an Idyllium program',
    '  idyllium check <file.idyl>  Check an Idyllium program without running it',
    '  idyllium --version          Print version',
    '  idyllium --help             Print this help',
    '',
  ].join('\n');
}

function version(): string {
  for (const candidate of ['../../package.json', '../../../package.json']) {
    try {
      return String(require(candidate).version);
    } catch {
      // Try the next package location. The VSIX stores the core one level deeper.
    }
  }
  return '0.0.0';
}

function formatThrownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (require.main === module) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`${formatThrownError(error)}\n`);
    process.exitCode = 1;
  });
}
