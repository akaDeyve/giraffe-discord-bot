const sqlite3 = require("sqlite3");

const db = new sqlite3.Database(
  "./database.db",
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => err && console.error(err.message),
);

// Aktuelle Tagesaktivität
const currentDay = {
  date: new Date().toLocaleDateString(),
  voiceSeconds: 0,
  messages: 0,
};

// Voice-Tracking (runtime only): reine Channel-Belegungszeit
const channelHumanCount = new Map(); // channelId -> Anzahl Menschen
const channelOccupiedSince = new Map(); // channelId -> Belegt-seit

// Tabelle anlegen + heutige Stats laden (serialisiert: Tabelle existiert vor dem Lesen)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    messages INTEGER NOT NULL DEFAULT 0,
    voice_seconds INTEGER NOT NULL DEFAULT 0
  )`);

  db.get("SELECT * FROM daily_stats WHERE date = ?", [currentDay.date], (err, row) => {
    if (err) return console.error(err.message);
    if (!row) return;
    currentDay.voiceSeconds = row.voice_seconds;
    currentDay.messages = row.messages;
  });
});

// Nach einem Neustart belegte Channel erfassen (zählt ab Neustart)
function seedVoiceTracking(client) {
  const states = client.guilds.cache.flatMap((guild) => [...guild.voiceStates.cache.values()]);
  for (const { channel, member } of states) {
    if (!channel || !member || member.user.bot) continue;

    const count = (channelHumanCount.get(channel.id) ?? 0) + 1;
    channelHumanCount.set(channel.id, count);
    if (count === 1) channelOccupiedSince.set(channel.id, Date.now());
  }
}

// Aktuelle Stats in DB persistieren
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

  // Zeit bis Mitternacht dem alten Tag zuschlagen, Channel ab Mitternacht neu zählen
  const midnight = new Date().setHours(0, 0, 0, 0);
  for (const [channelId, since] of channelOccupiedSince) {
    currentDay.voiceSeconds += Math.floor((midnight - since) / 1000);
    channelOccupiedSince.set(channelId, midnight);
  }

  persistStats();
  currentDay.date = today;
  currentDay.voiceSeconds = 0;
  currentDay.messages = 0;
  console.log("Neuer Tag – Stats zurückgesetzt.");
}

const saveStats = () => {
  checkDayChange();
  persistStats();
};

// Regelmäßig speichern (alle 20 Sekunden, um Datenverlust zu vermeiden)
setInterval(saveStats, 20 * 1000);

module.exports = {
  currentDay,
  channelHumanCount,
  channelOccupiedSince,
  seedVoiceTracking,
  checkDayChange,
  saveStats,
};
