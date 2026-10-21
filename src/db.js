const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync("./database.db");

// Synchroner Zugriff: prepare(sql).run/get/all mit Parametern
module.exports = {
  run: (sql, params = []) => db.prepare(sql).run(...params),
  get: (sql, params = []) => db.prepare(sql).get(...params) ?? null,
  all: (sql, params = []) => db.prepare(sql).all(...params),
};
