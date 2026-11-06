/**
 * Smoke test: loads every command and event through the real loader, checks their shape and
 * that every slash command serialises for Discord. Uses an in-memory SQLite database
 * (DB_PATH=:memory:), so no database.db is created or touched and no Discord login happens.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

process.env.DB_PATH = ":memory:";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { loadFolder } = require(path.join(root, "src/loaders.js"));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
}

const commands = loadFolder("commands");
const events = loadFolder("events", { isEvent: true });

test("loads all commands", () => {
  assert.deepEqual([...commands.keys()].sort(), ["ai", "birthday", "image", "ping", "poll", "websearch"]);
});

for (const [file, command] of commands) {
  test(`command ${file}: serialises, name matches file, execute is a function`, () => {
    const json = command.data.toJSON();
    assert.equal(json.name, file);
    assert.ok(json.description, "description missing");
    assert.equal(typeof command.execute, "function");
  });
}

test("loads all events", () => {
  assert.deepEqual(
    [...events.keys()].sort(),
    ["guildMemberAdd", "interactionCreate", "messageCreate", "ready", "voiceStateUpdate"],
  );
});

for (const [file, event] of events) {
  test(`event ${file}: has a name and execute`, () => {
    assert.equal(typeof event.name, "string");
    assert.equal(typeof event.execute, "function");
  });
}

test("dashboard module loads", () => {
  assert.equal(typeof require(path.join(root, "src/dashboard.js")).startDashboard, "function");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
