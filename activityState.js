const sqlite3 = require("sqlite3");

const db = new sqlite3.Database(
  "./database.db",
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) return console.error(err.message);
  },
);

// Tabelle einmalig anlegen
db.run(`CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  messages INTEGER NOT NULL DEFAULT 0,
  voice_seconds INTEGER NOT NULL DEFAULT 0
)`);

// Aktuelle Tagesaktivität
const currentDay = {
  date: new Date().toLocaleDateString(),
  voiceSeconds: 0,
  messages: 0,
};

// Voice-Channel-Belegungs-Tracker (runtime only)
const channelOccupiedSince = new Map();

// Vorherige Stats aus DB laden (falls Bot heute schon lief)
db.get("SELECT * FROM daily_stats WHERE date = ?", [currentDay.date], (err, row) => {
  if (err) return console.error(err.message);
  if (row) {
    currentDay.voiceSeconds = row.voice_seconds;
    currentDay.messages = row.messages;
  }
});

// Aktuelle Stats in DB persistieren (ohne Tageswechsel-Prüfung)
function persistStats() {
  db.run(
    `INSERT INTO daily_stats (date, messages, voice_seconds) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET messages = excluded.messages, voice_seconds = excluded.voice_seconds`,
    [currentDay.date, currentDay.messages, currentDay.voiceSeconds],
  );

  console.log(`Stats gespeichert: ${currentDay.date} – Nachrichten: ${currentDay.messages}, Voice-Sekunden: ${currentDay.voiceSeconds}`);
}

// Tageswechsel prüfen – wird vor Mutationen und im Speicher-Intervall aufgerufen
function checkDayChange() {
  const today = new Date().toLocaleDateString();
  if (currentDay.date === today) return;

  // Mitternacht des neuen Tages als Timestamp
  const midnight = new Date().setHours(0, 0, 0, 0);

  // Noch belegte Channels: Zeit bis Mitternacht zum alten Tag addieren,
  // danach Timestamp auf Mitternacht zurücksetzen (neuer Tag startet bei 0)
  for (const [channelId, since] of channelOccupiedSince) {
    currentDay.voiceSeconds += Math.floor((midnight - since) / 1000);
    channelOccupiedSince.set(channelId, midnight);
  }

  // Alten Tag final speichern, dann Zähler für den neuen Tag zurücksetzen
  persistStats();
  currentDay.date = today;
  currentDay.voiceSeconds = 0;
  currentDay.messages = 0;
  console.log("Neuer Tag – Stats zurückgesetzt.");
}

// Speichern + vorherigen Tageswechsel abfangen
function saveStats() {
  checkDayChange();
  persistStats();
}

// Regelmäßig speichern (alle 20 Sekunden, um Datenverlust zu vermeiden)
setInterval(saveStats, 20 * 1000);

module.exports = {
  currentDay,
  channelOccupiedSince,
  checkDayChange,
  saveStats,
};
