// ─── csv: таблицы с разделителями — модуль рантайма ────────────────────────
// Библиотека 1.5.6 (карточка 3.4 спеки some_libraries, дизайн some_csv/01).
// Таблица — библиотечный ОБЪЕКТ (ссылка, как json.Object): заголовок и
// строки ячеек-СТРОК; числа ученик переводит сам (to_int/to_string), как
// у gui.Table. Разбор — RFC 4180 без хитрых штучек: кавычки, «""» внутри
// кавычек, переносы строк внутри кавычек, любой конец строки, BOM Excel
// пропускается. Разделитель угадывается по заголовку (`;` — русский Excel,
// `,`, табуляция) и запоминается в таблице: to_string()/csv.write пишут
// тем же разделителем, чтобы файл ученика не менял диалект молча.
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, contextFunction, integerNumber, stringArgument } from './runtime-shared';
import { IdylliumArray } from './runtime-values';
import { runtimePropertySetters } from './runtime-state';

export type CsvRuntimeTable = RuntimeObject & {
  __idylliumType: 'csv.Table';
  __csvColumns: string[];
  __csvRows: string[][];
  __csvSeparator: string;
};

export function isCsvRuntimeTable(value: unknown): value is CsvRuntimeTable {
  return typeof value === 'object' && value !== null && (value as CsvRuntimeTable).__idylliumType === 'csv.Table';
}

const CSV_SEPARATOR_CANDIDATES: readonly string[] = [';', ',', '\t'];

/** Разделитель по первой строке: считаем кандидатов вне кавычек, побеждает
 *  самый частый; при равенстве и при полном отсутствии — `;` (русский Excel). */
export function detectCsvSeparator(text: string): string {
  const counts = new Map<string, number>(CSV_SEPARATOR_CANDIDATES.map((candidate) => [candidate, 0]));
  let quoted = false;
  for (const character of text) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) break;
    if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1);
  }
  let best = ';';
  let bestCount = 0;
  for (const candidate of CSV_SEPARATOR_CANDIDATES) {
    const count = counts.get(candidate)!;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function csvSeparatorArgument(value: unknown, argumentName: string, file: string, line: number): string {
  const separator = stringArgument(value, argumentName, file, line);
  if (Array.from(separator).length !== 1) {
    throw new IdylliumRuntimeError(file, line, `${argumentName} must be one character (like ";" or ","), got "${separator}"`);
  }
  if (separator === '"' || separator === '\n' || separator === '\r') {
    throw new IdylliumRuntimeError(file, line, `${argumentName} cannot be a quote or a line break`);
  }
  return separator;
}

interface CsvRecord {
  readonly cells: string[];
  /** Номер строки текста, с которой запись начинается (для ошибок). */
  readonly line: number;
}

interface CsvRecords {
  readonly records: CsvRecord[];
}

/** Разбор текста в записи. Пустые строки (ни одного символа) пропускаются —
 *  так файл с завершающим переводом строки не даёт фантомной пустой записи. */
function parseCsvRecords(text: string, separator: string, functionName: string, file: string, line: number): CsvRecords {
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let record: string[] = [];
  let recordLine = 1;
  let field = '';
  let index = 0;
  let lineNumber = 1;
  let fieldStartLine = 1;
  const length = source.length;

  const finishRecord = () => {
    record.push(field);
    field = '';
    // Пустая строка текста — ни ячеек, ни разделителей — не запись.
    if (!(record.length === 1 && record[0] === '')) records.push({ cells: record, line: recordLine });
    record = [];
    recordLine = lineNumber + 1;
  };

  while (index < length) {
    const character = source[index];
    if (character === '"' && field === '') {
      // Ячейка в кавычках: до закрывающей кавычки; "" — литеральная кавычка.
      fieldStartLine = lineNumber;
      index += 1;
      let closed = false;
      while (index < length) {
        const inner = source[index];
        if (inner === '"') {
          if (source[index + 1] === '"') {
            field += '"';
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        if (inner === '\n') lineNumber += 1;
        if (inner === '\r') {
          if (source[index + 1] !== '\n') lineNumber += 1;
        }
        field += inner;
        index += 1;
      }
      if (!closed) {
        throw new IdylliumRuntimeError(file, line, `${functionName} line ${fieldStartLine}: quote is never closed`);
      }
      // После закрывающей кавычки допустимы только разделитель или конец строки.
      const next = source[index];
      if (next !== undefined && next !== separator && next !== '\n' && next !== '\r') {
        throw new IdylliumRuntimeError(file, line, `${functionName} line ${lineNumber}: unexpected text after a closing quote`);
      }
      continue;
    }
    if (character === separator) {
      record.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (character === '\r') {
      finishRecord();
      index += source[index + 1] === '\n' ? 2 : 1;
      lineNumber += 1;
      continue;
    }
    if (character === '\n') {
      finishRecord();
      index += 1;
      lineNumber += 1;
      continue;
    }
    field += character;
    index += 1;
  }
  if (field !== '' || record.length > 0) finishRecord();
  return { records };
}

function csvQuoteField(value: string, separator: string): string {
  if (value === '') return value;
  if (value.includes(separator) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsvTable(table: CsvRuntimeTable): string {
  const separator = table.__csvSeparator;
  const lines: string[] = [];
  if (table.__csvColumns.length > 0) {
    lines.push(table.__csvColumns.map((column) => csvQuoteField(column, separator)).join(separator));
  }
  for (const row of table.__csvRows) {
    lines.push(row.map((cell) => csvQuoteField(cell, separator)).join(separator));
  }
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

/** Текст → таблица. Первая запись — заголовок; короткие строки дополняются
 *  пустыми ячейками (пропущенная ячейка — пустая, данных мы не выдумываем),
 *  длинные — ошибка: лишняя ячейка означает разъехавшийся разделитель. */
export function parseCsvTable(
  text: string,
  separator: string | null,
  functionName: string,
  file: string,
  line: number,
): CsvRuntimeTable {
  const chosen = separator ?? detectCsvSeparator(text.startsWith('\uFEFF') ? text.slice(1) : text);
  const { records } = parseCsvRecords(text, chosen, functionName, file, line);
  const table = createCsvTable(chosen);
  if (records.length === 0) return table;
  const header = records[0].cells;
  const seen = new Set<string>();
  for (const column of header) {
    if (seen.has(column)) {
      throw new IdylliumRuntimeError(file, line, `${functionName} header has duplicate column "${column}"`);
    }
    seen.add(column);
  }
  table.__csvColumns = [...header];
  for (let recordIndex = 1; recordIndex < records.length; recordIndex += 1) {
    const record = records[recordIndex].cells;
    if (record.length > header.length) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `${functionName} line ${records[recordIndex].line} has ${record.length} values, but the header has ${header.length} columns`,
      );
    }
    const row = [...record];
    while (row.length < header.length) row.push('');
    table.__csvRows.push(row);
  }
  return table;
}

function stringCells(values: readonly unknown[]): string[] {
  return values.map((value) => (typeof value === 'string' ? value : String(value)));
}

function columnIndex(table: CsvRuntimeTable, name: unknown, methodName: string, file: string, line: number): number {
  const column = stringArgument(name, `${methodName} column`, file, line);
  const index = table.__csvColumns.indexOf(column);
  if (index < 0) {
    throw new IdylliumRuntimeError(file, line, `csv table has no column "${column}"`);
  }
  return index;
}

function rowIndex(table: CsvRuntimeTable, value: unknown, methodName: string, file: string, line: number): number {
  const index = integerNumber(value, `${methodName} row`, file, line);
  if (index < 0 || index >= table.__csvRows.length) {
    if (table.__csvRows.length === 0) {
      throw new IdylliumRuntimeError(file, line, `${methodName} row ${index} is out of range — the table has no rows`);
    }
    throw new IdylliumRuntimeError(file, line, `${methodName} row ${index} is out of range 0..${table.__csvRows.length - 1}`);
  }
  return index;
}

function stringArray(values: readonly string[]): IdylliumArray {
  return IdylliumArray.from([...values], true, null, () => '');
}

// Методы и геттеры — на общем прототипе (как xml.Node): таблица несёт только
// три поля данных.
const CSV_TABLE_PROTOTYPE: Record<string, unknown> = {};
Object.defineProperty(CSV_TABLE_PROTOTYPE, '__idylliumType', { value: 'csv.Table', enumerable: false });
Object.defineProperty(CSV_TABLE_PROTOTYPE, 'row_count', {
  enumerable: true,
  get(this: CsvRuntimeTable) { return this.__csvRows.length; },
});
Object.defineProperty(CSV_TABLE_PROTOTYPE, 'column_count', {
  enumerable: true,
  get(this: CsvRuntimeTable) { return this.__csvColumns.length; },
});
Object.defineProperty(CSV_TABLE_PROTOTYPE, 'columns', {
  enumerable: true,
  get(this: CsvRuntimeTable) { return stringArray(this.__csvColumns); },
});
Object.defineProperty(CSV_TABLE_PROTOTYPE, 'separator', {
  enumerable: true,
  get(this: CsvRuntimeTable) { return this.__csvSeparator; },
  set(this: CsvRuntimeTable, value: unknown) {
    this.__csvSeparator = csvSeparatorArgument(value, 'csv.Table.separator', 'runtime', 0);
  },
});
CSV_TABLE_PROTOTYPE.set_columns = contextFunction(function (this: CsvRuntimeTable, ...callArgs: unknown[]) {
  callArgs.pop();
  callArgs.pop();
  const columns = stringCells(callArgs);
  this.__csvColumns = columns;
  this.__csvRows = [];
});
CSV_TABLE_PROTOTYPE.add_row = contextFunction(function (this: CsvRuntimeTable, ...callArgs: unknown[]) {
  const line = callArgs.pop() as number;
  const file = callArgs.pop() as string;
  if (this.__csvColumns.length === 0) {
    throw new IdylliumRuntimeError(file, line, 'csv.Table.add_row() before set_columns() — set the columns first');
  }
  if (callArgs.length !== this.__csvColumns.length) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `csv.Table.add_row() expects ${this.__csvColumns.length} values (one per column), got ${callArgs.length}`,
    );
  }
  this.__csvRows.push(stringCells(callArgs));
});
CSV_TABLE_PROTOTYPE.get = contextFunction(function (this: CsvRuntimeTable, row: unknown, column: unknown, file: string, line: number) {
  const index = columnIndex(this, column, 'csv.Table.get()', file, line);
  return this.__csvRows[rowIndex(this, row, 'csv.Table.get()', file, line)][index];
});
CSV_TABLE_PROTOTYPE.set = contextFunction(function (this: CsvRuntimeTable, row: unknown, column: unknown, text: unknown, file: string, line: number) {
  const index = columnIndex(this, column, 'csv.Table.set()', file, line);
  const value = stringArgument(text, 'csv.Table.set() text', file, line);
  this.__csvRows[rowIndex(this, row, 'csv.Table.set()', file, line)][index] = value;
});
CSV_TABLE_PROTOTYPE.row = contextFunction(function (this: CsvRuntimeTable, row: unknown, file: string, line: number) {
  return stringArray(this.__csvRows[rowIndex(this, row, 'csv.Table.row()', file, line)]);
});
CSV_TABLE_PROTOTYPE.column = contextFunction(function (this: CsvRuntimeTable, column: unknown, file: string, line: number) {
  const index = columnIndex(this, column, 'csv.Table.column()', file, line);
  return stringArray(this.__csvRows.map((cells) => cells[index]));
});
CSV_TABLE_PROTOTYPE.has_column = contextFunction(function (this: CsvRuntimeTable, column: unknown, file: string, line: number) {
  return this.__csvColumns.includes(stringArgument(column, 'csv.Table.has_column() column', file, line));
});
CSV_TABLE_PROTOTYPE.find = contextFunction(function (this: CsvRuntimeTable, column: unknown, text: unknown, file: string, line: number) {
  const index = columnIndex(this, column, 'csv.Table.find()', file, line);
  const wanted = stringArgument(text, 'csv.Table.find() text', file, line);
  return this.__csvRows.findIndex((cells) => cells[index] === wanted);
});
CSV_TABLE_PROTOTYPE.remove_row = contextFunction(function (this: CsvRuntimeTable, row: unknown, file: string, line: number) {
  this.__csvRows.splice(rowIndex(this, row, 'csv.Table.remove_row()', file, line), 1);
});
CSV_TABLE_PROTOTYPE.clear = contextFunction(function (this: CsvRuntimeTable) {
  this.__csvRows = [];
});
CSV_TABLE_PROTOTYPE.to_string = function (this: CsvRuntimeTable) { return serializeCsvTable(this); };
CSV_TABLE_PROTOTYPE.toString = function (this: CsvRuntimeTable) { return serializeCsvTable(this); };

export function createCsvTable(separator = ';'): CsvRuntimeTable {
  const table = Object.create(CSV_TABLE_PROTOTYPE) as CsvRuntimeTable;
  table.__csvColumns = [];
  table.__csvRows = [];
  table.__csvSeparator = separator;
  runtimePropertySetters(table).separator = (value: unknown, file: string, line: number) => {
    table.__csvSeparator = csvSeparatorArgument(value, 'csv.Table.separator', file, line);
  };
  return table;
}

export function csvParseSeparator(value: unknown, functionName: string, file: string, line: number): string | null {
  if (value === undefined) return null;
  const separator = stringArgument(value, `${functionName} separator`, file, line);
  if (separator === '') return null;
  return csvSeparatorArgument(separator, `${functionName} separator`, file, line);
}
