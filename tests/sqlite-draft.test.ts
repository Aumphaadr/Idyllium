import {
  compileIdyllium,
  createMemoryRuntimeFileSystem,
  runIdyllium,
} from '../src';

const fs: any = require('fs');
const path: any = require('path');

interface ErrorCase {
  readonly file: string;
  readonly includes: string;
}

const ROOT = 'spec/some_sqlite/05_recommended_api';
const ERROR_CASES: readonly ErrorCase[] = [
  {
    file: `${ROOT}/11_errors/01_unbound_parameter.idyl`,
    includes: "runtime error: sqlite statement has unbound parameter ':level'",
  },
  {
    file: `${ROOT}/11_errors/02_wrong_getter.idyl`,
    includes: "runtime error: sqlite column 'name' is text, expected int",
  },
  {
    file: `${ROOT}/11_errors/03_missing_column.idyl`,
    includes: "runtime error: sqlite result has no column 'score'",
  },
];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function collectIdylliumFiles(directory: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...collectIdylliumFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith('.idyl')) result.push(absolute);
  }
  return result.sort();
}

async function runWithMemoryFiles(
  source: string,
  input: readonly string[] = [],
  extraFiles: Readonly<Record<string, string>> = {},
) {
  const fileSystem = createMemoryRuntimeFileSystem({
    '/workspace/main.idyl': source,
    ...extraFiles,
  });
  const result = await runIdyllium(source, { fileSystem, input }, { file: '/workspace/main.idyl' });
  return { result, fileSystem };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const specRoot = path.join(root, ROOT);
  const files = collectIdylliumFiles(specRoot);
  const errors = new Set(ERROR_CASES.map((item) => path.join(root, item.file)));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    const compilation = compileIdyllium(source, { file: relative });
    assert(compilation.success, `expected ${relative} to compile, got:\n${compilation.diagnosticsText}`);
  }

  let validExamples = 0;
  for (const file of files) {
    if (errors.has(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const input = file.includes('03_named_bind_insert') ? ["O'Neil", '9'] : [];
    const extraFiles: Record<string, string> = file.includes('09_execute_script')
      ? { '/workspace/setup.sql': fs.readFileSync(path.join(specRoot, '09_execute_script/setup.sql'), 'utf8') }
      : {};
    const { result, fileSystem } = await runWithMemoryFiles(source, input, extraFiles);
    assert(result.success, `${path.relative(root, file)} failed:\n${result.runtimeError ?? result.compilation.diagnosticsText}`);
    const databaseFiles = Object.entries(fileSystem.writtenFilesSnapshot?.() ?? {})
      .filter(([name]) => name.endsWith('.db'));
    assert(databaseFiles.length > 0, `${path.relative(root, file)} did not create a database file`);
    assert(
      databaseFiles.every(([, value]) => (value.bytes?.length ?? 0) > 0),
      `${path.relative(root, file)} created an empty database file`,
    );
    validExamples += 1;
  }

  for (const errorCase of ERROR_CASES) {
    const source = fs.readFileSync(path.join(root, errorCase.file), 'utf8');
    const { result } = await runWithMemoryFiles(source);
    assert(!result.success, `expected ${errorCase.file} to fail at runtime`);
    assert(result.runtimeError !== null, `expected ${errorCase.file} to report a runtime error`);
    assert(
      result.runtimeError.includes(errorCase.includes),
      `expected ${errorCase.file} error to include ${JSON.stringify(errorCase.includes)}, got:\n${result.runtimeError}`,
    );
  }

  const rollback = await runWithMemoryFiles(`
    use console;
    use sqlite;

    main() {
        sqlite.Database db = sqlite.open("rollback_on_close.db");
        db.execute("CREATE TABLE value_holder (value INTEGER NOT NULL)");
        db.execute("INSERT INTO value_holder VALUES (1)");
        db.begin_transaction();
        db.execute("UPDATE value_holder SET value = 99");
        db.close();

        sqlite.Database reopened = sqlite.open("rollback_on_close.db");
        sqlite.Result rows = reopened.execute("SELECT value FROM value_holder");
        rows.next();
        console.writeln(rows.get_int("value"));
        reopened.close();
    }
  `);
  assert(rollback.result.success, rollback.result.runtimeError ?? rollback.result.compilation.diagnosticsText);
  assert(rollback.result.output === '1\n', `unexpected rollback output: ${JSON.stringify(rollback.result.output)}`);

  const int64 = await runWithMemoryFiles(`
    use console;
    use sqlite;
    use types;

    main() {
        sqlite.Database db = sqlite.open("int64.db");
        db.execute("CREATE TABLE numbers (value INTEGER NOT NULL)");
        sqlite.Statement insert = db.prepare("INSERT INTO numbers VALUES (:value)");
        types.int64 maximum = 9223372036854775807;
        insert.bind_int64("value", maximum);
        insert.execute();

        sqlite.Statement direct = db.prepare(
            "SELECT typeof(:value) AS value_type, :value AS value"
        );
        direct.bind_int64("value", maximum);
        sqlite.Result direct_row = direct.execute();
        direct_row.next();
        console.writeln(direct_row.get_string("value_type"));
        console.writeln(direct_row.get_int64("value"));

        sqlite.Result rows = db.execute("SELECT value FROM numbers");
        rows.next();
        console.writeln(rows.get_int64("value"));
        db.close();
    }
  `);
  assert(int64.result.success, int64.result.runtimeError ?? int64.result.compilation.diagnosticsText);
  assert(
    int64.result.output === 'integer\n9223372036854775807\n9223372036854775807\n',
    `unexpected int64 output: ${JSON.stringify(int64.result.output)}`,
  );

  const genericBindings = await runWithMemoryFiles(`
    use console;
    use sqlite;

    main() {
        sqlite.Database db = sqlite.open("generic_bind.db");
        sqlite.Statement values = db.prepare(
            "SELECT " +
            "typeof(:integer_value) AS integer_type, " +
            "typeof(:real_value) AS real_type, " +
            "typeof(:string_value) AS string_type, " +
            "typeof(:bool_value) AS bool_type, " +
            "typeof(:null_value) AS null_type"
        );
        values.bind("integer_value", 42);
        values.bind("real_value", 2.5);
        values.bind("string_value", "hello");
        values.bind("bool_value", true);
        values.bind("null_value", null);

        sqlite.Result row = values.execute();
        row.next();
        console.writeln(row.get_string("integer_type"));
        console.writeln(row.get_string("real_type"));
        console.writeln(row.get_string("string_type"));
        console.writeln(row.get_string("bool_type"));
        console.writeln(row.get_string("null_type"));

        sqlite.Value saved_value = row.get("integer_type");
        sqlite.Statement preserved = db.prepare(
            "SELECT typeof(:value) AS value_type, :value AS value"
        );
        preserved.bind("value", saved_value);
        sqlite.Result preserved_row = preserved.execute();
        preserved_row.next();
        console.writeln(preserved_row.get_string("value_type"));
        console.writeln(preserved_row.get_string("value"));

        float whole_number = 2.0;
        sqlite.Statement exact_float = db.prepare(
            "SELECT typeof(:value) AS value_type"
        );
        exact_float.bind_float("value", whole_number);
        sqlite.Result float_row = exact_float.execute();
        float_row.next();
        console.writeln(float_row.get_string("value_type"));

        float_row.close();
        exact_float.close();
        preserved_row.close();
        preserved.close();
        row.close();
        values.close();
        db.close();
    }
  `);
  assert(
    genericBindings.result.success,
    genericBindings.result.runtimeError ?? genericBindings.result.compilation.diagnosticsText,
  );
  assert(
    genericBindings.result.output === 'integer\nreal\ntext\ninteger\nnull\ntext\ninteger\nreal\n',
    `unexpected generic bind output: ${JSON.stringify(genericBindings.result.output)}`,
  );

  console.log(
    `sqlite draft spec: ${files.length} programs compile, ${validExamples} valid examples run, `
    + `${ERROR_CASES.length} runtime errors checked`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
