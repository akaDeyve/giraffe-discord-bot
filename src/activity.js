const { run, get } = require("./db");

// Aktuelle Tagesaktivität (runtime state, alle 20 s in die DB persistiert)
const currentDay = {
  date: new Date().toLocaleDateString(),
  voiceSeconds: 0,
  messages: 0,
};

// Anonymisiertes Voice-Tracking: nur channelId -> Anzahl Menschen (keine User-IDs)
const channelHumans = new Map();
const humansInVoice = () => [...channelHumans.values()].reduce((sum, count) => sum + count, 0);

function init() {
  run(`CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    messages INTEGER NOT NULL DEFAULT 0,
    voice_seconds INTEGER NOT NULL DEFAULT 0
  )`);
  const row = get("SELECT * FROM daily_stats WHERE date = ?", [currentDay.date]);
  if (row) {
    currentDay.voiceSeconds = row.voice_seconds;
    currentDay.messages = row.messages;
  }
}

// Nach einem Neustart belegte Channel erfassen (zählt ab Neustart)
function seedVoiceTracking(client) {
  for (const state of client.guilds.cache.flatMap((guild) => [...guild.voiceStates.cache.values()])) {
    if (!state.channel || state.member?.user.bot) continue;
    channelHumans.set(state.channel.id, (channelHumans.get(state.channel.id) ?? 0) + 1);
  }
}

// Tageswechsel prüfen – wird vor Mutationen und im Speicher-Intervall aufgerufen
function checkDayChange() {
  const today = new Date().toLocaleDateString();
  if (currentDay.date === today) return;

  persistStats();
  currentDay.date = today;
  currentDay.voiceSeconds = 0;
  currentDay.messages = 0;
  console.log("Neuer Tag – Stats zurückgesetzt.");
}

function persistStats() {
  run(
    `INSERT INTO daily_stats (date, messages, voice_seconds) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET messages = excluded.messages, voice_seconds = excluded.voice_seconds`,
    [currentDay.date, currentDay.messages, currentDay.voiceSeconds],
  );
}

// Alle 20 Sekunden: Personen im Voice * 20 s zu heute addieren und persistieren
function startTracking() {
  init();
  setInterval(() => {
    currentDay.voiceSeconds += humansInVoice() * 20;
    checkDayChange();
    persistStats();
  }, 20 * 1000);
}

module.exports = {
  currentDay,
  channelHumans,
  seedVoiceTracking,
  checkDayChange,
  incrementMessages: () => currentDay.messages++,
  startTracking,
};
