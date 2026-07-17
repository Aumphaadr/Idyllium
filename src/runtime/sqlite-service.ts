export type RuntimeSqliteValue = number | bigint | string | Uint8Array | null;

export interface RuntimeSqliteTypedBinding {
  readonly storageClass: 'integer' | 'real';
  readonly value: number | bigint;
}

export type RuntimeSqliteBindable = RuntimeSqliteValue | boolean | RuntimeSqliteTypedBinding;

export interface RuntimeSqliteExecution {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly RuntimeSqliteValue[])[];
  readonly affectedRows: number;
  readonly lastInsertId: bigint | null;
}

export interface RuntimeSqliteDatabase {
  execute(
    sql: string,
    bindings?: Readonly<Record<string, RuntimeSqliteBindable>>,
  ): RuntimeSqliteExecution;
  executeScript(sql: string): void;
  export(): Uint8Array;
  close(): void;
}

export interface RuntimeSqliteService {
  open(bytes?: Uint8Array): Promise<RuntimeSqliteDatabase>;
}

interface SqlJsStatement {
  bind(values?: Record<string, unknown>): boolean;
  free(): boolean;
  get(params?: unknown, config?: { readonly useBigInt?: boolean }): unknown[];
  getColumnNames(): string[];
  step(): boolean;
}

interface SqlJsStatementIterator {
  next(): { readonly done: boolean; readonly value: SqlJsStatement };
}

interface SqlJsDatabase {
  close(): void;
  exec(sql: string): unknown;
  export(): Uint8Array;
  getRowsModified(): number;
  iterateStatements(sql: string): SqlJsStatementIterator;
  prepare(sql: string): SqlJsStatement;
  updateHook(callback: ((operation: string) => void) | null): void;
}

interface SqlJsStatic {
  readonly Database: new (bytes?: Uint8Array) => SqlJsDatabase;
}

type InitSqlJs = (config?: Readonly<Record<string, unknown>>) => Promise<SqlJsStatic>;

export function createSqlJsRuntimeService(
  initSqlJs: InitSqlJs,
  config?: Readonly<Record<string, unknown>>,
): RuntimeSqliteService {
  let sqlPromise: Promise<SqlJsStatic> | null = null;

  return {
    async open(bytes?: Uint8Array): Promise<RuntimeSqliteDatabase> {
      sqlPromise ??= initSqlJs(config);
      const SQL = await sqlPromise;
      const database = new SQL.Database(bytes);
      return createDatabaseAdapter(database);
    },
  };
}

function createDatabaseAdapter(database: SqlJsDatabase): RuntimeSqliteDatabase {
  let closed = false;

  return {
    execute(
      sql: string,
      bindings: Readonly<Record<string, RuntimeSqliteBindable>> = {},
    ): RuntimeSqliteExecution {
      assertOpen();
      const prepared = prepareTypedBindings(sql, bindings);
      const statement = singleStatement(database, prepared.sql);
      let sawChange = false;
      let sawInsert = false;
      database.updateHook((operation) => {
        sawChange = true;
        if (operation === 'insert') sawInsert = true;
      });

      try {
        if (Object.keys(prepared.bindings).length > 0) {
          statement.bind(prepared.bindings);
        }

        const columns = statement.getColumnNames();
        const rows: RuntimeSqliteValue[][] = [];
        while (statement.step()) {
          rows.push(statement.get(undefined, { useBigInt: true }).map(normalizeSqliteValue));
        }

        const affectedRows = sawChange || isDataChangingSql(sql)
          ? database.getRowsModified()
          : 0;
        const lastInsertId = sawInsert ? readLastInsertId(database) : null;
        return { columns, rows, affectedRows, lastInsertId };
      } finally {
        database.updateHook(null);
        statement.free();
      }
    },

    executeScript(sql: string): void {
      assertOpen();
      database.exec(sql);
    },

    export(): Uint8Array {
      assertOpen();
      return new Uint8Array(database.export());
    },

    close(): void {
      if (closed) return;
      database.close();
      closed = true;
    },
  };

  function assertOpen(): void {
    if (closed) throw new Error('SQLite database is already closed');
  }
}

function singleStatement(database: SqlJsDatabase, sql: string): SqlJsStatement {
  const iterator = database.iterateStatements(sql);
  let count = 0;
  let item = iterator.next();
  while (!item.done) {
    count += 1;
    item = iterator.next();
  }
  if (count === 0) {
    throw new Error('execute() expects exactly one SQL statement, got 0');
  }
  if (count > 1) {
    throw new Error('execute() expects exactly one SQL statement, got more than 1');
  }
  return database.prepare(sql);
}

function readLastInsertId(database: SqlJsDatabase): bigint {
  const statement = database.prepare('SELECT last_insert_rowid()');
  try {
    if (!statement.step()) return 0n;
    const value = statement.get(undefined, { useBigInt: true })[0];
    return typeof value === 'bigint' ? value : BigInt(String(value));
  } finally {
    statement.free();
  }
}

function normalizeSqliteValue(value: unknown): RuntimeSqliteValue {
  if (value === null || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) return new Uint8Array(value);
  throw new Error(`SQLite returned unsupported value '${String(value)}'`);
}

function prepareTypedBindings(
  sql: string,
  bindings: Readonly<Record<string, RuntimeSqliteBindable>>,
): { readonly sql: string; readonly bindings: Record<string, unknown> } {
  const castTypes = new Map<string, 'INTEGER' | 'REAL'>();
  const normalized: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(bindings)) {
    const parameterName = name.replace(/^:/u, '');
    if (isTypedBinding(value)) {
      castTypes.set(parameterName, value.storageClass === 'integer' ? 'INTEGER' : 'REAL');
      normalized[name] = typeof value.value === 'bigint' ? value.value.toString() : value.value;
      continue;
    }
    if (typeof value === 'bigint') {
      castTypes.set(parameterName, 'INTEGER');
      normalized[name] = value.toString();
      continue;
    }
    normalized[name] = value;
  }
  if (castTypes.size === 0) return { sql, bindings: normalized };

  let output = '';
  let mode: 'normal' | 'single' | 'double' | 'backtick' | 'bracket' | 'line-comment' | 'block-comment' = 'normal';
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1] ?? '';

    if (mode === 'line-comment') {
      output += char;
      if (char === '\n') mode = 'normal';
      continue;
    }
    if (mode === 'block-comment') {
      output += char;
      if (char === '*' && next === '/') {
        output += next;
        index += 1;
        mode = 'normal';
      }
      continue;
    }
    if (mode === 'single' || mode === 'double' || mode === 'backtick') {
      output += char;
      const closing = mode === 'single' ? "'" : mode === 'double' ? '"' : '`';
      if (char === closing) {
        if (next === closing) {
          output += next;
          index += 1;
        } else {
          mode = 'normal';
        }
      }
      continue;
    }
    if (mode === 'bracket') {
      output += char;
      if (char === ']') mode = 'normal';
      continue;
    }

    if (char === '-' && next === '-') {
      output += char + next;
      index += 1;
      mode = 'line-comment';
      continue;
    }
    if (char === '/' && next === '*') {
      output += char + next;
      index += 1;
      mode = 'block-comment';
      continue;
    }
    if (char === "'") mode = 'single';
    else if (char === '"') mode = 'double';
    else if (char === '`') mode = 'backtick';
    else if (char === '[') mode = 'bracket';

    if (char === ':' && /^[\p{L}_]$/u.test(next)) {
      let end = index + 2;
      while (end < sql.length && /^[\p{L}\p{N}_]$/u.test(sql[end])) end += 1;
      const name = sql.slice(index + 1, end);
      const castType = castTypes.get(name);
      if (castType) {
        output += `CAST(:${name} AS ${castType})`;
        index = end - 1;
        continue;
      }
    }
    output += char;
  }
  return { sql: output, bindings: normalized };
}

function isTypedBinding(value: RuntimeSqliteBindable): value is RuntimeSqliteTypedBinding {
  return typeof value === 'object'
    && value !== null
    && !(value instanceof Uint8Array)
    && (value.storageClass === 'integer' || value.storageClass === 'real')
    && (typeof value.value === 'number' || typeof value.value === 'bigint');
}

function isDataChangingSql(sql: string): boolean {
  const keyword = firstSqlKeyword(sql);
  return keyword === 'INSERT' || keyword === 'UPDATE' || keyword === 'DELETE' || keyword === 'REPLACE';
}

function firstSqlKeyword(sql: string): string {
  const withoutLeadingComments = sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/u, '');
  return /^[A-Za-z]+/u.exec(withoutLeadingComments)?.[0].toUpperCase() ?? '';
}
