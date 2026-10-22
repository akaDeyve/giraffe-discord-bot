const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

const db = new DatabaseSync(path.join(__dirname, "..", "database.db"));
db.exec("PRAGMA journal_mode = WAL;");

// node:sqlite bindet im Gegensatz zu better-sqlite3 weder booleans noch undefined.
function bind(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

// Synchroner Zugriff: prepare(sql).run/get/all mit Parameter-Array.
// run() liefert immer { changes, lastInsertRowid }, get() null statt undefined.
module.exports = {
  db,
  run: (sql, params = []) => db.prepare(sql).run(...params.map(bind)),
  get: (sql, params = []) => db.prepare(sql).get(...params.map(bind)) ?? null,
  all: (sql, params = []) => db.prepare(sql).all(...params.map(bind)),
};
