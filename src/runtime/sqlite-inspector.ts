import {
  RuntimeSqliteDatabase,
  RuntimeSqliteService,
  RuntimeSqliteValue,
} from './sqlite-service';

const SQLITE_OBJECT_LIMIT = 200;
const SQLITE_COLUMN_PREVIEW_LIMIT = 100;
const SQLITE_ROW_PREVIEW_LIMIT = 500;

export type SqliteInspectableObjectKind = 'table' | 'view';

export interface SqliteColumnDescription {
  readonly index: number;
  readonly name: string;
  readonly declaredType: string;
  readonly notNull: boolean;
  readonly defaultValue: string | null;
  readonly primaryKeyPosition: number;
}

export interface SqliteObjectDescription {
  readonly name: string;
  readonly kind: SqliteInspectableObjectKind;
  readonly sql: string;
  readonly columns: readonly SqliteColumnDescription[];
}

export interface SqliteDatabaseDescription {
  readonly objects: readonly SqliteObjectDescription[];
  readonly objectCount: number;
  readonly hiddenSystemObjectCount: number;
  readonly truncatedObjectCount: number;
  readonly userVersion: number;
  readonly pageSize: number;
  readonly pageCount: number;
}

export interface SqliteObjectPreview {
  readonly name: string;
  readonly kind: SqliteInspectableObjectKind;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly RuntimeSqliteValue[])[];
  readonly totalRows: string;
  readonly truncatedRows: boolean;
  readonly totalColumns: number;
  readonly truncatedColumns: boolean;
}

export async function inspectSqliteDatabase(
  service: RuntimeSqliteService,
  bytes?: Uint8Array,
): Promise<SqliteDatabaseDescription> {
  const database = await service.open(databaseBytes(bytes));
  try {
    const schema = database.execute(
      "SELECT name, type, sql FROM sqlite_schema "
      + "WHERE type IN ('table', 'view') "
      + "ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name COLLATE NOCASE",
    );
    const allObjects = schema.rows.map((row) => ({
      name: sqliteString(row[0]),
      kind: sqliteObjectKind(row[1]),
      sql: row[2] === null ? '' : sqliteString(row[2]),
    }));
    const hiddenSystemObjectCount = allObjects.filter((object) => object.name.startsWith('sqlite_')).length;
    const userObjects = allObjects.filter((object) => !object.name.startsWith('sqlite_'));
    const visibleObjects = userObjects.slice(0, SQLITE_OBJECT_LIMIT);
    const objects: SqliteObjectDescription[] = [];

    for (const object of visibleObjects) {
      objects.push({
        ...object,
        columns: describeColumns(database, object.name),
      });
    }

    return {
      objects,
      objectCount: userObjects.length,
      hiddenSystemObjectCount,
      truncatedObjectCount: Math.max(0, userObjects.length - objects.length),
      userVersion: pragmaInteger(database, 'user_version'),
      pageSize: pragmaInteger(database, 'page_size'),
      pageCount: pragmaInteger(database, 'page_count'),
    };
  } finally {
    database.close();
  }
}

export async function previewSqliteObject(
  service: RuntimeSqliteService,
  bytes: Uint8Array | undefined,
  name: string,
  requestedLimit = 200,
): Promise<SqliteObjectPreview> {
  const database = await service.open(databaseBytes(bytes));
  try {
    const object = database.execute(
      "SELECT type FROM sqlite_schema WHERE name = :name AND type IN ('table', 'view')",
      { ':name': name },
    );
    if (object.rows.length === 0) {
      throw new Error(`SQLite has no table or view named '${name}'`);
    }

    const kind = sqliteObjectKind(object.rows[0][0]);
    const describedColumns = describeColumns(database, name);
    const selectedColumns = describedColumns.slice(0, SQLITE_COLUMN_PREVIEW_LIMIT);
    const selectList = selectedColumns.length > 0
      ? selectedColumns.map((column) => quoteSqliteIdentifier(column.name)).join(', ')
      : '*';
    const quotedName = quoteSqliteIdentifier(name);
    const limit = Math.max(1, Math.min(SQLITE_ROW_PREVIEW_LIMIT, Math.trunc(requestedLimit) || 200));
    const totalRows = sqliteCount(database.execute(`SELECT COUNT(*) FROM ${quotedName}`).rows[0]?.[0]);
    const result = database.execute(`SELECT ${selectList} FROM ${quotedName} LIMIT ${limit + 1}`);
    const truncatedRows = result.rows.length > limit;

    return {
      name,
      kind,
      columns: result.columns,
      rows: result.rows.slice(0, limit),
      totalRows,
      truncatedRows,
      totalColumns: describedColumns.length,
      truncatedColumns: describedColumns.length > selectedColumns.length,
    };
  } finally {
    database.close();
  }
}

function describeColumns(database: RuntimeSqliteDatabase, objectName: string): SqliteColumnDescription[] {
  const result = database.execute(`PRAGMA table_info(${quoteSqliteIdentifier(objectName)})`);
  return result.rows.map((row) => ({
    index: sqliteNumber(row[0]),
    name: sqliteString(row[1]),
    declaredType: row[2] === null ? '' : sqliteString(row[2]),
    notNull: sqliteNumber(row[3]) !== 0,
    defaultValue: row[4] === null ? null : sqliteString(row[4]),
    primaryKeyPosition: sqliteNumber(row[5]),
  }));
}

function pragmaInteger(database: RuntimeSqliteDatabase, name: string): number {
  return sqliteNumber(database.execute(`PRAGMA ${name}`).rows[0]?.[0]);
}

function sqliteObjectKind(value: RuntimeSqliteValue | undefined): SqliteInspectableObjectKind {
  const kind = sqliteString(value);
  if (kind !== 'table' && kind !== 'view') throw new Error(`unsupported SQLite object type '${kind}'`);
  return kind;
}

function sqliteString(value: RuntimeSqliteValue | undefined): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  throw new Error(`expected SQLite text value, got '${String(value)}'`);
}

function sqliteNumber(value: RuntimeSqliteValue | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) return Number(value);
  throw new Error(`expected SQLite integer value, got '${String(value)}'`);
}

function sqliteCount(value: RuntimeSqliteValue | undefined): string {
  if (typeof value === 'bigint' || typeof value === 'number') return String(value);
  if (typeof value === 'string' && /^\d+$/u.test(value)) return value;
  throw new Error(`expected SQLite row count, got '${String(value)}'`);
}

function quoteSqliteIdentifier(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

function databaseBytes(bytes: Uint8Array | undefined): Uint8Array | undefined {
  return bytes && bytes.length > 0 ? new Uint8Array(bytes) : undefined;
}
