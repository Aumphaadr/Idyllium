#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'spec', 'some_sqlite', 'preview.sql');
const output = path.join(root, 'spec', 'some_sqlite', 'preview.db');

async function main() {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  try {
    database.run(fs.readFileSync(source, 'utf8'));
    fs.writeFileSync(output, Buffer.from(database.export()));
  } finally {
    database.close();
  }
  console.log(`SQLite preview fixture created at ${path.relative(root, output)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
