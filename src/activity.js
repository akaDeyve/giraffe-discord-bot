const { run, get } = require("./db");

// YYYY-MM-DD – stabil (nicht locale-abhängig) und sortierbar
const isoDate = () => new Date().toISOString().slice(0, 10);

// Anonymisiertes Voice-Tracking: nur channelId -> Anzahl Menschen (keine User-IDs)
const channelHumans = new Map();
const humansInVoice = () => [...channelHumans.values()].reduce((sum, count) => sum + count, 0);

function init() {
  run(`CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    messages INTEGER NOT NULL DEFAULT 0,
    voice_seconds INTEGER NOT NULL DEFAULT 0
  )`);
}

// Zählt eine Nachricht für den heutigen Tag – direkt in der DB,
// dadurch ist der Tag automatisch der richtige, egal wann der Bot startet.
function incrementMessages() {
  run(
    `INSERT INTO daily_stats (date, messages, voice_seconds) VALUES (?, 1, 0)
     ON CONFLICT(date) DO UPDATE SET messages = messages + 1`,
    [isoDate()],
  );
}

// Alle 20 Sekunden: Menschen im Voice * 20 s dem heutigen Tag direkt zuschreiben.
// Kein Runtime-Merkstand nötig – jede Einheit landet sofort unter dem
// tatsächlichen Datum (Mitternachtswechsel inklusive), d. h. ist jemand
// von 23:00 bis 01:00 im Voice, zählen die Minuten anteilig zu beiden Tagen.
function trackVoiceInterval() {
  const humans = humansInVoice();
  if (humans === 0) return;
  run(
    `INSERT INTO daily_stats (date, messages, voice_seconds) VALUES (?, 0, ?)
     ON CONFLICT(date) DO UPDATE SET voice_seconds = voice_seconds + ?`,
    [isoDate(), humans * 20, humans * 20],
  );
}

function startTracking() {
  init();
  setInterval(trackVoiceInterval, 20 * 1000);
}

// Nach einem Neustart belegte Channel erfassen (zählt ab Neustart)
function seedVoiceTracking(client) {
  const states = [...client.guilds.cache.values()].flatMap((guild) => [...guild.voiceStates.cache.values()]);
  for (const state of states) {
    if (!state.channel || state.member?.user.bot) continue;
    channelHumans.set(state.channel.id, (channelHumans.get(state.channel.id) ?? 0) + 1);
  }
}

module.exports = {
  channelHumans,
  seedVoiceTracking,
  incrementMessages,
  startTracking,
};
