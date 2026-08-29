// ─── SQLite: значения, база, запросы, результаты — модуль рантайма ─────────
// Вынесено из runtime.ts при декомпозиции 2026-08-29; содержимое — как было.
import { IdylliumRuntimeError } from './runtime-errors';
import { RuntimeObject, booleanArgument, contextFunction, defineRuntimeGetter, errorMessage, expectOpen, intArgument, isPlainObject, integerNumber, stringArgument } from './runtime-shared';
import { IdylliumArray, IdylliumTimeStamp, valueOps } from './runtime-values';
import { JsonRuntimeValue, isJsonRuntimeValue } from './runtime-json';
import {
  RuntimeSqliteBindable,
  RuntimeSqliteDatabase,
  RuntimeSqliteExecution,
  RuntimeSqliteService,
  RuntimeSqliteTypedBinding,
  RuntimeSqliteValue,
} from './sqlite-service';
import { exactIntegerResult, finiteNumber, runtimeDirname, runtimeInteger, validRange } from './runtime-shared';
import { RuntimeFileSystem } from './runtime';

/**
 * Модулю не нужно всё состояние ядра — только файловая система (путь базы)
 * и sqlite-движок. Ядро передаёт себя целиком, структурная типизация
 * оставляет видимым ровно этот срез.
 */
export interface SqliteRuntimeHost {
  readonly fileSystem: RuntimeFileSystem;
  readonly sqliteService?: RuntimeSqliteService | null;
}

type SqliteRuntimeKind = 'null' | 'integer' | 'real' | 'text' | 'blob';

export type SqliteRuntimeValueObject = Record<string, unknown> & {
  __idylliumType: 'sqlite.Value';
  __sqliteKind: SqliteRuntimeKind;
  __sqliteValue: RuntimeSqliteValue;
};

export interface SqliteRuntimeDatabaseState {
  engine: RuntimeSqliteDatabase | null;
  path: string;
  resolvedPath: string;
  isOpen: boolean;
  inTransaction: boolean;
  readonly runtime: SqliteRuntimeHost;
  readonly statements: Set<SqliteRuntimeStatementState>;
}

interface SqliteRuntimeStatementState {
  readonly database: SqliteRuntimeDatabaseState | null;
  readonly sql: string;
  readonly parameterNames: ReadonlySet<string>;
  readonly bindings: Map<string, RuntimeSqliteBindable>;
  isOpen: boolean;
}

interface SqliteRuntimeResultState {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly RuntimeSqliteValue[])[];
  isOpen: boolean;
  cursor: number;
}

export function createSqliteValue(value: unknown = null, file = 'sqlite', line = 0): SqliteRuntimeValueObject {
  if (isSqliteRuntimeValue(value)) return value;

  let kind: SqliteRuntimeKind;
  let stored: RuntimeSqliteValue;
  if (value === null || valueOps.isNull(value)) {
    kind = 'null';
    stored = null;
  } else if (typeof value === 'bigint') {
    kind = 'integer';
    stored = value;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    kind = Number.isInteger(value) ? 'integer' : 'real';
    stored = value;
  } else if (typeof value === 'string') {
    kind = 'text';
    stored = value;
  } else if (typeof value === 'boolean') {
    kind = 'integer';
    stored = value ? 1n : 0n;
  } else if (value instanceof Uint8Array) {
    kind = 'blob';
    stored = new Uint8Array(value);
  } else {
    throw new IdylliumRuntimeError(file, line, `cannot convert '${valueOps.typeName(value)}' to sqlite.Value`);
  }

  const obj: SqliteRuntimeValueObject = {
    __idylliumType: 'sqlite.Value',
    __sqliteKind: kind,
    __sqliteValue: stored,
  };
  obj.is_null = () => obj.__sqliteKind === 'null';
  obj.is_int = () => obj.__sqliteKind === 'integer';
  obj.is_float = () => obj.__sqliteKind === 'real';
  obj.is_string = () => obj.__sqliteKind === 'text';
  obj.to_int = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToInt(obj, callFile, callLine));
  obj.to_int64 = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToInt64(obj, callFile, callLine));
  obj.to_float = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToFloat(obj, callFile, callLine));
  obj.to_string = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToString(obj, callFile, callLine));
  obj.to_bool = contextFunction((callFile = 'sqlite', callLine = 0) => sqliteValueToBool(obj, callFile, callLine));
  return obj;
}

export function isSqliteRuntimeValue(value: unknown): value is SqliteRuntimeValueObject {
  return isPlainObject(value)
    && value.__idylliumType === 'sqlite.Value'
    && typeof value.__sqliteKind === 'string';
}

function sqliteValueToInt(value: SqliteRuntimeValueObject, file: string, line: number): number | bigint {
  expectSqliteValueKind(value, 'integer', 'int', file, line);
  // int точен на любом размере (канон 2026-08-22) — потолка у to_int() нет;
  // границы остались только у ячейки to_int64().
  const integer = value.__sqliteValue;
  if (typeof integer === 'number') return integer;
  return exactIntegerResult(integer as bigint);
}

function sqliteValueToInt64(value: SqliteRuntimeValueObject, file: string, line: number): bigint {
  expectSqliteValueKind(value, 'integer', 'int64', file, line);
  return typeof value.__sqliteValue === 'bigint'
    ? value.__sqliteValue
    : BigInt(value.__sqliteValue as number);
}

function sqliteValueToFloat(value: SqliteRuntimeValueObject, file: string, line: number): number {
  if (value.__sqliteKind !== 'integer' && value.__sqliteKind !== 'real') {
    throwSqliteValueExpected(value, 'float', file, line);
  }
  return Number(value.__sqliteValue);
}

export function sqliteValueToString(value: SqliteRuntimeValueObject, file: string, line: number): string {
  expectSqliteValueKind(value, 'text', 'string', file, line);
  return value.__sqliteValue as string;
}

function sqliteValueToBool(value: SqliteRuntimeValueObject, file: string, line: number): boolean {
  expectSqliteValueKind(value, 'integer', 'bool (integer 0 or 1)', file, line);
  if (value.__sqliteValue === 0 || value.__sqliteValue === 0n) return false;
  if (value.__sqliteValue === 1 || value.__sqliteValue === 1n) return true;
  throw new IdylliumRuntimeError(
    file,
    line,
    `sqlite value is integer ${String(value.__sqliteValue)}, expected bool (integer 0 or 1)`,
  );
}

function expectSqliteValueKind(
  value: SqliteRuntimeValueObject,
  kind: SqliteRuntimeKind,
  expected: string,
  file: string,
  line: number,
): void {
  if (value.__sqliteKind === kind) return;
  throwSqliteValueExpected(value, expected, file, line);
}

function throwSqliteValueExpected(
  value: SqliteRuntimeValueObject,
  expected: string,
  file: string,
  line: number,
): never {
  throw new IdylliumRuntimeError(file, line, `sqlite value is ${value.__sqliteKind}, expected ${expected}`);
}

export async function openSqliteDatabase(
  pathValue: unknown,
  file: string,
  line: number,
  runtime: SqliteRuntimeHost,
): Promise<RuntimeObject> {
  const requestedPath = stringArgument(pathValue, 'sqlite.open() path', file, line);
  if (requestedPath.trim() === '') {
    throw new IdylliumRuntimeError(file, line, 'sqlite.open() path must not be empty');
  }
  if (!runtime.sqliteService) {
    throw new IdylliumRuntimeError(file, line, 'sqlite runtime is unavailable');
  }

  const resolvedPath = runtime.fileSystem.resolvePath(requestedPath, file);
  const parentPath = runtimeDirname(resolvedPath);
  try {
    if (runtime.fileSystem.exists(resolvedPath) && !runtime.fileSystem.isFile(resolvedPath)) {
      throw new Error('path is not a file');
    }
    if (!runtime.fileSystem.exists(parentPath) || !runtime.fileSystem.isDirectory(parentPath)) {
      throw new Error(`parent directory does not exist: ${runtime.fileSystem.humanizePaths?.(parentPath) ?? parentPath}`);
    }
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite.open() cannot open '${requestedPath}': ${errorMessage(error)}`);
  }

  const existed = runtime.fileSystem.exists(resolvedPath);
  let bytes: Uint8Array | undefined;
  if (existed) {
    try {
      bytes = runtime.fileSystem.readBytes
        ? runtime.fileSystem.readBytes(resolvedPath)
        : new TextEncoder().encode(runtime.fileSystem.readText(resolvedPath));
    } catch (error) {
      throw new IdylliumRuntimeError(file, line, `sqlite.open() cannot read '${requestedPath}': ${errorMessage(error)}`);
    }
  }

  let engine: RuntimeSqliteDatabase;
  try {
    engine = await runtime.sqliteService.open(bytes);
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite.open() cannot open '${requestedPath}': ${errorMessage(error)}`);
  }

  const obj = createClosedSqliteDatabase(runtime);
  const state = sqliteDatabaseState(obj);
  state.engine = engine;
  state.path = requestedPath;
  state.resolvedPath = resolvedPath;
  state.isOpen = true;

  if (!existed) persistSqliteDatabase(state, file, line);
  return obj;
}

export function createClosedSqliteDatabase(runtime: SqliteRuntimeHost): RuntimeObject {
  const state: SqliteRuntimeDatabaseState = {
    engine: null,
    path: '',
    resolvedPath: '',
    isOpen: false,
    inTransaction: false,
    runtime,
    statements: new Set(),
  };
  const obj: RuntimeObject = { __idylliumType: 'sqlite.Database' };
  Object.defineProperty(obj, '__sqliteDatabaseState', { value: state });
  defineRuntimeGetter(obj, 'path', () => state.path);
  defineRuntimeGetter(obj, 'is_open', () => state.isOpen);
  defineRuntimeGetter(obj, 'in_transaction', () => state.inTransaction);

  obj.execute = contextFunction((sql: unknown, file: string, line: number) => (
    executeSqliteDatabase(state, sql, new Map(), file, line)
  ));
  obj.prepare = contextFunction((sql: unknown, file: string, line: number) => (
    createSqliteStatement(state, sql, file, line)
  ));
  obj.exec_script = contextFunction((sql: unknown, file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    const source = stringArgument(sql, 'sqlite.Database.exec_script() sql', file, line);
    try {
      engine.executeScript(source);
      if (!state.inTransaction) persistSqliteDatabase(state, file, line);
    } catch (error) {
      if (error instanceof IdylliumRuntimeError) throw error;
      throw new IdylliumRuntimeError(file, line, `sqlite script execution failed: ${errorMessage(error)}`);
    }
  });
  obj.begin_transaction = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (state.inTransaction) {
      throw new IdylliumRuntimeError(file, line, 'sqlite database already has an active transaction');
    }
    executeSqliteTransaction(engine, 'BEGIN TRANSACTION', 'begin', file, line);
    state.inTransaction = true;
  });
  obj.commit = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (!state.inTransaction) {
      throw new IdylliumRuntimeError(file, line, 'sqlite database has no active transaction to commit');
    }
    executeSqliteTransaction(engine, 'COMMIT', 'commit', file, line);
    state.inTransaction = false;
    persistSqliteDatabase(state, file, line);
  });
  obj.rollback = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (!state.inTransaction) {
      throw new IdylliumRuntimeError(file, line, 'sqlite database has no active transaction to roll back');
    }
    executeSqliteTransaction(engine, 'ROLLBACK', 'rollback', file, line);
    state.inTransaction = false;
  });
  obj.close = contextFunction((file: string, line: number) => {
    const engine = assertSqliteDatabaseOpen(state, file, line);
    if (state.inTransaction) {
      executeSqliteTransaction(engine, 'ROLLBACK', 'rollback while closing', file, line);
      state.inTransaction = false;
    }
    for (const statement of state.statements) statement.isOpen = false;
    state.statements.clear();
    engine.close();
    state.engine = null;
    state.isOpen = false;
  });
  return obj;
}

export function sqliteDatabaseState(obj: RuntimeObject): SqliteRuntimeDatabaseState {
  return obj.__sqliteDatabaseState as SqliteRuntimeDatabaseState;
}

function assertSqliteDatabaseOpen(
  state: SqliteRuntimeDatabaseState,
  file: string,
  line: number,
): RuntimeSqliteDatabase {
  if (!state.isOpen || !state.engine) {
    throw new IdylliumRuntimeError(
      file,
      line,
      state.path === ''
        ? 'this sqlite.Database is a blank one — open a file with sqlite.open("name.db") first'
        : 'sqlite database is already closed',
    );
  }
  return state.engine;
}

export function persistSqliteDatabase(state: SqliteRuntimeDatabaseState, file: string, line: number): void {
  const engine = assertSqliteDatabaseOpen(state, file, line);
  if (!state.runtime.fileSystem.writeBytes) {
    throw new IdylliumRuntimeError(file, line, 'sqlite cannot save a database: binary file writing is unavailable');
  }
  try {
    state.runtime.fileSystem.writeBytes(state.resolvedPath, engine.export());
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite cannot save '${state.path}': ${errorMessage(error)}`);
  }
}

function executeSqliteTransaction(
  engine: RuntimeSqliteDatabase,
  sql: string,
  operation: string,
  file: string,
  line: number,
): void {
  try {
    engine.execute(sql);
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite ${operation} failed: ${errorMessage(error)}`);
  }
}

function createSqliteStatement(
  database: SqliteRuntimeDatabaseState,
  sqlValue: unknown,
  file: string,
  line: number,
): RuntimeObject {
  assertSqliteDatabaseOpen(database, file, line);
  const sql = stringArgument(sqlValue, 'sqlite.Database.prepare() sql', file, line);
  const parameterNames = scanSqliteParameters(sql, file, line);
  const state: SqliteRuntimeStatementState = {
    database,
    sql,
    parameterNames,
    bindings: new Map(),
    isOpen: true,
  };
  database.statements.add(state);
  return createSqliteStatementObject(state);
}

export function createClosedSqliteStatement(): RuntimeObject {
  return createSqliteStatementObject({
    database: null,
    sql: '',
    parameterNames: new Set(),
    bindings: new Map(),
    isOpen: false,
  });
}

function createSqliteStatementObject(state: SqliteRuntimeStatementState): RuntimeObject {
  const obj: RuntimeObject = { __idylliumType: 'sqlite.Statement' };
  defineRuntimeGetter(obj, 'sql', () => state.sql);
  defineRuntimeGetter(obj, 'is_open', () => state.isOpen);

  obj.bind = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(state, name, sqliteBindingFromValue(value, file, line), file, line);
  });
  obj.bind_int = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(
      state,
      name,
      sqliteTypedBinding('integer', runtimeInteger(value, 'sqlite.Statement.bind_int() value', file, line)),
      file,
      line,
    );
  });
  obj.bind_int64 = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(
      state,
      name,
      sqliteTypedBinding('integer', (() => {
        const integer = runtimeInteger(value, 'sqlite.Statement.bind_int64() value', file, line);
        assertSqliteInt64Range(integer, file, line);
        return integer;
      })()),
      file,
      line,
    );
  });
  obj.bind_float = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(
      state,
      name,
      sqliteTypedBinding('real', finiteNumber(value, 'sqlite.Statement.bind_float() value', file, line)),
      file,
      line,
    );
  });
  obj.bind_string = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    bindSqliteStatement(state, name, stringArgument(value, 'sqlite.Statement.bind_string() value', file, line), file, line);
  });
  obj.bind_bool = contextFunction((name: unknown, value: unknown, file: string, line: number) => {
    if (typeof value !== 'boolean') {
      throw new IdylliumRuntimeError(file, line, 'sqlite.Statement.bind_bool() value must be bool');
    }
    bindSqliteStatement(state, name, sqliteTypedBinding('integer', value ? 1 : 0), file, line);
  });
  obj.bind_null = contextFunction((name: unknown, file: string, line: number) => {
    bindSqliteStatement(state, name, null, file, line);
  });
  obj.execute = contextFunction((file: string, line: number) => {
    const database = assertSqliteStatementOpen(state, file, line);
    return executeSqliteDatabase(database, state.sql, state.bindings, file, line);
  });
  obj.clear_bindings = contextFunction((file: string, line: number) => {
    assertSqliteStatementOpen(state, file, line);
    state.bindings.clear();
  });
  obj.close = contextFunction((file: string, line: number) => {
    const database = assertSqliteStatementOpen(state, file, line);
    state.isOpen = false;
    database.statements.delete(state);
    state.bindings.clear();
  });
  return obj;
}

// INTEGER-колонка SQLite — ячейка int64: значение за её границей раньше
// МОЛЧА клампилось/оборачивалось драйвером (находка ломателей 2026-08-22).
function assertSqliteInt64Range(value: bigint, file: string, line: number): void {
  const minimum = -(1n << 63n);
  const maximum = (1n << 63n) - 1n;
  if (value < minimum || value > maximum) {
    throw new IdylliumRuntimeError(file, line, `sqlite cannot store ${value}: the value is outside the INTEGER column range (types.int64)`);
  }
}

function sqliteBindingFromValue(value: unknown, file: string, line: number): RuntimeSqliteBindable {
  if (value === null || valueOps.isNull(value)) return null;

  if (isSqliteRuntimeValue(value)) {
    if (value.__sqliteKind === 'null') return null;
    if (value.__sqliteKind === 'integer') {
      return sqliteTypedBinding('integer', value.__sqliteValue as number | bigint);
    }
    if (value.__sqliteKind === 'real') {
      return sqliteTypedBinding('real', value.__sqliteValue as number);
    }
    if (value.__sqliteKind === 'text') return value.__sqliteValue as string;
    if (value.__sqliteValue instanceof Uint8Array) return new Uint8Array(value.__sqliteValue);
  }

  if (typeof value === 'bigint') {
    assertSqliteInt64Range(value, file, line);
    return sqliteTypedBinding('integer', value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return sqliteTypedBinding(Number.isInteger(value) ? 'integer' : 'real', value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return sqliteTypedBinding('integer', value ? 1 : 0);
  if (value instanceof Uint8Array) return new Uint8Array(value);

  throw new IdylliumRuntimeError(
    file,
    line,
    `sqlite.Statement.bind() cannot bind '${valueOps.typeName(value)}'; expected int, float, string, bool, null, or sqlite.Value`,
  );
}

function sqliteTypedBinding(
  storageClass: RuntimeSqliteTypedBinding['storageClass'],
  value: number | bigint,
): RuntimeSqliteTypedBinding {
  return { storageClass, value };
}

function assertSqliteStatementOpen(
  state: SqliteRuntimeStatementState,
  file: string,
  line: number,
): SqliteRuntimeDatabaseState {
  if (!state.isOpen || !state.database) {
    throw new IdylliumRuntimeError(
      file,
      line,
      state.sql === '' && state.database === null
        ? 'this sqlite.Statement is a blank one — get one from db.prepare("SQL") first'
        : 'sqlite statement is already closed',
    );
  }
  assertSqliteDatabaseOpen(state.database, file, line);
  return state.database;
}

function bindSqliteStatement(
  state: SqliteRuntimeStatementState,
  nameValue: unknown,
  value: RuntimeSqliteBindable,
  file: string,
  line: number,
): void {
  assertSqliteStatementOpen(state, file, line);
  const name = stringArgument(nameValue, 'sqlite parameter name', file, line);
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) {
    throw new IdylliumRuntimeError(
      file,
      line,
      `sqlite parameter name must be written without ':' and contain only letters, digits, and '_', got '${name}'`,
    );
  }
  if (!state.parameterNames.has(name)) {
    throw new IdylliumRuntimeError(file, line, `sqlite statement has no parameter ':${name}'`);
  }
  state.bindings.set(name, value);
}

export function executeSqliteDatabase(
  state: SqliteRuntimeDatabaseState,
  sqlValue: unknown,
  bindings: ReadonlyMap<string, RuntimeSqliteBindable>,
  file: string,
  line: number,
): RuntimeObject {
  const engine = assertSqliteDatabaseOpen(state, file, line);
  const sql = stringArgument(sqlValue, 'sqlite execute() sql', file, line);
  const parameters = scanSqliteParameters(sql, file, line);
  for (const name of parameters) {
    if (!bindings.has(name)) {
      throw new IdylliumRuntimeError(file, line, `sqlite statement has unbound parameter ':${name}'`);
    }
  }
  const keyword = sqliteLeadingKeyword(sql);
  if (['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE'].includes(keyword)) {
    throw new IdylliumRuntimeError(
      file,
      line,
      'use begin_transaction(), commit(), or rollback() instead of transaction SQL in execute()',
    );
  }

  const sqliteBindings: Record<string, RuntimeSqliteBindable> = {};
  for (const [name, value] of bindings) sqliteBindings[`:${name}`] = value;

  let execution: RuntimeSqliteExecution;
  try {
    execution = engine.execute(sql, sqliteBindings);
  } catch (error) {
    throw new IdylliumRuntimeError(file, line, `sqlite execution failed: ${errorMessage(error)}`);
  }
  if (!state.inTransaction) persistSqliteDatabase(state, file, line);
  return createSqliteResult(execution);
}

export function createSqliteResult(execution: RuntimeSqliteExecution): RuntimeObject {
  const state: SqliteRuntimeResultState = {
    columns: [...execution.columns],
    rows: execution.rows.map((row) => [...row]),
    isOpen: true,
    cursor: -1,
  };
  const obj: RuntimeObject = { __idylliumType: 'sqlite.Result' };
  Object.defineProperty(obj, '__sqliteResultState', { value: state });
  defineRuntimeGetter(obj, 'is_open', () => state.isOpen);
  // has_rows отвечает ровно на вопрос своего имени: «есть ли хоть одна строка».
  // Раньше он значил «этот запрос ВОЗВРАЩАЕТ строки» и был true у пустого
  // SELECT — естественная запись «if (rows.has_rows) … else «никого нет»»
  // печатала «нашли» на пустом результате, молча и неверно (SQ1, находка
  // методистов 2026-08-23). Строки уже загружены целиком, спрашивать нечего.
  defineRuntimeGetter(obj, 'has_rows', () => state.rows.length > 0);
  defineRuntimeGetter(obj, 'affected_rows', () => execution.affectedRows);
  defineRuntimeGetter(obj, 'last_insert_id', () => createSqliteValue(execution.lastInsertId));

  obj.next = contextFunction((file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    const nextIndex = state.cursor + 1;
    if (nextIndex >= state.rows.length) {
      state.cursor = state.rows.length;
      return false;
    }
    state.cursor = nextIndex;
    return true;
  });
  obj.get = contextFunction((column: unknown, file: string, line: number) => (
    createSqliteValue(sqliteResultColumn(state, column, file, line))
  ));
  obj.is_null = contextFunction((column: unknown, file: string, line: number) => (
    sqliteResultColumn(state, column, file, line) === null
  ));
  obj.get_int = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToInt(value, file, line));
  });
  obj.get_int64 = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToInt64(value, file, line));
  });
  obj.get_float = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToFloat(value, file, line));
  });
  obj.get_string = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToString(value, file, line));
  });
  obj.get_bool = contextFunction((column: unknown, file: string, line: number) => {
    const name = stringArgument(column, 'sqlite result column', file, line);
    return sqliteColumnConversion(state, name, file, line, (value) => sqliteValueToBool(value, file, line));
  });
  obj.column_count = contextFunction((file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    return state.columns.length;
  });
  obj.column_name = contextFunction((index: unknown, file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    const columnIndex = integerNumber(index, 'sqlite.Result.column_name() index', file, line);
    if (columnIndex < 0 || columnIndex >= state.columns.length) {
      throw new IdylliumRuntimeError(
        file,
        line,
        `sqlite column index ${columnIndex} out of bounds (size ${state.columns.length}, valid indices ${validRange(state.columns.length)})`,
      );
    }
    return state.columns[columnIndex];
  });
  obj.close = contextFunction((file: string, line: number) => {
    assertSqliteResultOpen(state, file, line);
    state.isOpen = false;
    state.cursor = state.rows.length;
  });
  return obj;
}

// Заготовка 'sqlite.Result r;' — это ПУСТОЙ ответ, а не закрытый: строк в нём
// ноль, next() честно отвечает false, has_rows — false. Раньше она объявляла
// себя «уже закрытой», хотя её никто не открывал (D5, находка методистов).
export function createBlankSqliteResult(): RuntimeObject {
  return createSqliteResult({ columns: [], rows: [], affectedRows: 0, lastInsertId: null });
}

function assertSqliteResultOpen(state: SqliteRuntimeResultState, file: string, line: number): void {
  if (!state.isOpen) throw new IdylliumRuntimeError(file, line, 'sqlite result is already closed');
}

function sqliteResultColumn(
  state: SqliteRuntimeResultState,
  columnValue: unknown,
  file: string,
  line: number,
): RuntimeSqliteValue {
  assertSqliteResultOpen(state, file, line);
  if (state.cursor < 0 || state.cursor >= state.rows.length) {
    throw new IdylliumRuntimeError(file, line, 'sqlite result has no current row; call next() first');
  }
  const column = stringArgument(columnValue, 'sqlite result column', file, line);
  const matching = state.columns
    .map((name, index) => ({ name, index }))
    .filter((item) => item.name === column);
  if (matching.length === 0) {
    throw new IdylliumRuntimeError(file, line, `sqlite result has no column '${column}'`);
  }
  if (matching.length > 1) {
    throw new IdylliumRuntimeError(file, line, `sqlite result column '${column}' is ambiguous; use SQL aliases`);
  }
  return state.rows[state.cursor][matching[0].index];
}

function sqliteColumnConversion<T>(
  state: SqliteRuntimeResultState,
  column: string,
  file: string,
  line: number,
  convert: (value: SqliteRuntimeValueObject) => T,
): T {
  const value = createSqliteValue(sqliteResultColumn(state, column, file, line));
  try {
    return convert(value);
  } catch (error) {
    if (error instanceof IdylliumRuntimeError) {
      const detail = error.detail;
      throw new IdylliumRuntimeError(file, line, detail.replace(/^sqlite value/u, `sqlite column '${column}'`));
    }
    throw error;
  }
}


function scanSqliteParameters(sql: string, file: string, line: number): ReadonlySet<string> {
  const names = new Set<string>();
  let mode: 'normal' | 'single' | 'double' | 'backtick' | 'bracket' | 'line-comment' | 'block-comment' = 'normal';

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1] ?? '';

    if (mode === 'line-comment') {
      if (char === '\n') mode = 'normal';
      continue;
    }
    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = 'normal';
        index += 1;
      }
      continue;
    }
    if (mode === 'single' || mode === 'double' || mode === 'backtick') {
      const closing = mode === 'single' ? "'" : mode === 'double' ? '"' : '`';
      if (char === closing) {
        if (next === closing) index += 1;
        else mode = 'normal';
      }
      continue;
    }
    if (mode === 'bracket') {
      if (char === ']') mode = 'normal';
      continue;
    }

    if (char === '-' && next === '-') {
      mode = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      mode = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'") {
      mode = 'single';
      continue;
    }
    if (char === '"') {
      mode = 'double';
      continue;
    }
    if (char === '`') {
      mode = 'backtick';
      continue;
    }
    if (char === '[') {
      mode = 'bracket';
      continue;
    }
    if (char === ':' && /^[\p{L}_]$/u.test(next)) {
      let end = index + 2;
      while (end < sql.length && /^[\p{L}\p{N}_]$/u.test(sql[end])) end += 1;
      names.add(sql.slice(index + 1, end));
      index = end - 1;
      continue;
    }
    if (char === '?' || char === '@' || char === '$') {
      throw new IdylliumRuntimeError(
        file,
        line,
        `unsupported SQLite parameter '${char}'; use named parameters such as ':name'`,
      );
    }
  }
  return names;
}

function sqliteLeadingKeyword(sql: string): string {
  const withoutComments = sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/u, '');
  return /^[A-Za-z]+/u.exec(withoutComments)?.[0].toUpperCase() ?? '';
}
