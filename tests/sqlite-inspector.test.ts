import {
  inspectSqliteDatabase,
  previewSqliteObject,
} from '../src/runtime/sqlite-inspector';
import { createNodeSqliteService } from '../src/runtime/node-sqlite-service';

const fs: any = require('fs');
const path: any = require('path');

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const service = createNodeSqliteService();
  const database = await service.open();
  database.executeScript(`
    PRAGMA user_version = 7;
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      nickname TEXT
    );
    INSERT INTO players (name, level, nickname) VALUES
      ('Mira', 12, 'North Star'),
      ('Liam', 4, NULL),
      ('Ava', 8, 'Comet');
    CREATE TABLE inventory (
      player_id INTEGER NOT NULL,
      item TEXT NOT NULL
    );
    CREATE VIEW experienced_players AS
      SELECT name, level FROM players WHERE level >= 8;
  `);
  const bytes = database.export();
  database.close();

  const description = await inspectSqliteDatabase(service, bytes);
  assert(description.userVersion === 7, `unexpected user_version: ${description.userVersion}`);
  assert(description.objectCount === 3, `unexpected object count: ${description.objectCount}`);
  assert(description.hiddenSystemObjectCount === 1, 'expected sqlite_sequence to be hidden');
  assert(
    description.objects.map((object) => `${object.kind}:${object.name}`).join(',')
      === 'table:inventory,table:players,view:experienced_players',
    `unexpected objects: ${JSON.stringify(description.objects)}`,
  );
  const players = description.objects.find((object) => object.name === 'players');
  assert(players?.columns.length === 4, `unexpected players columns: ${JSON.stringify(players)}`);
  assert(players.columns[0].primaryKeyPosition === 1, 'expected players.id primary key');
  assert(players.columns[1].notNull, 'expected players.name NOT NULL');
  assert(players.columns[2].defaultValue === '1', `unexpected default value: ${players.columns[2].defaultValue}`);

  const preview = await previewSqliteObject(service, bytes, 'players', 2);
  assert(preview.totalRows === '3', `unexpected row count: ${preview.totalRows}`);
  assert(preview.rows.length === 2 && preview.truncatedRows, 'expected a truncated two-row preview');
  assert(preview.columns.join(',') === 'id,name,level,nickname', `unexpected columns: ${preview.columns.join(',')}`);
  assert(preview.rows[1][3] === null, `expected nullable nickname, got ${String(preview.rows[1][3])}`);

  const view = await previewSqliteObject(service, bytes, 'experienced_players');
  assert(view.kind === 'view', `unexpected object kind: ${view.kind}`);
  assert(view.totalRows === '2', `unexpected view row count: ${view.totalRows}`);

  let missingError = '';
  try {
    await previewSqliteObject(service, bytes, 'missing_table');
  } catch (error) {
    missingError = error instanceof Error ? error.message : String(error);
  }
  assert(missingError.includes("has no table or view named 'missing_table'"), `unexpected missing-table error: ${missingError}`);

  const fixtureBytes = new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'spec/some_sqlite/preview.db')));
  const fixture = await inspectSqliteDatabase(service, fixtureBytes);
  assert(fixture.objectCount === 4, `unexpected preview.db object count: ${fixture.objectCount}`);
  assert(
    fixture.objects.some((object) => object.kind === 'view' && object.name === 'experienced_players'),
    'expected preview.db to contain experienced_players view',
  );
  const fixturePlayers = await previewSqliteObject(service, fixtureBytes, 'players');
  assert(fixturePlayers.rows[1][3] === null, 'expected preview.db to contain a null nickname');

  const quotedDatabase = await service.open();
  quotedDatabase.executeScript('CREATE TABLE "odd""table" ("odd""column" TEXT); INSERT INTO "odd""table" VALUES (\'ok\');');
  const quotedBytes = quotedDatabase.export();
  quotedDatabase.close();
  const quotedPreview = await previewSqliteObject(service, quotedBytes, 'odd"table');
  assert(quotedPreview.columns[0] === 'odd"column', `unexpected quoted column: ${quotedPreview.columns[0]}`);
  assert(quotedPreview.rows[0][0] === 'ok', `unexpected quoted-table value: ${String(quotedPreview.rows[0][0])}`);

  console.log('sqlite inspector: schema, row preview, null and views pass');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
