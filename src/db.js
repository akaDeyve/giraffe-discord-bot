const Database = require("better-sqlite3");

const db = new Database("./database.db");

// Synchroner Zugriff: prepare(sql).run/get/all mit Parametern
module.exports = {
  run: (sql, params = []) => db.prepare(sql).run(...params),
  get: (sql, params = []) => db.prepare(sql).get(...params) ?? null,
  all: (sql, params = []) => db.prepare(sql).all(...params),
};
