const { run, get } = require("./db");

// Aktuelle Tagesaktivität (runtime state, alle 20 s in die DB persistiert)
const currentDay = {
  date: new Date().toLocaleDateString(),
  voiceSeconds: 0,
  messages: 0,
};

// Voice-Tracking (runtime only): reine Channel-Belegungszeit
const channelHumanCount = new Map(); // channelId -> Anzahl Menschen
const channelOccupiedSince = new Map(); // channelId -> Belegt-seit

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
  const states = client.guilds.cache.flatMap((guild) => [...guild.voiceStates.cache.values()]);
  for (const { channel, member } of states) {
    if (!channel || !member || member.user.bot) continue;
    startOccupancy(channel.id);
  }
}

function startOccupancy(channelId) {
  const count = (channelHumanCount.get(channelId) ?? 0) + 1;
  channelHumanCount.set(channelId, count);
  if (count === 1) channelOccupiedSince.set(channelId, Date.now());
}

function endOccupancy(channelId) {
  const count = (channelHumanCount.get(channelId) ?? 1) - 1;
  if (count > 0) return channelHumanCount.set(channelId, count);

  channelHumanCount.delete(channelId);
  const since = channelOccupiedSince.get(channelId);
  if (since === undefined) return;

  currentDay.voiceSeconds += Math.floor((Date.now() - since) / 1000);
  channelOccupiedSince.delete(channelId);
}

function persistStats() {
  run(
    `INSERT INTO daily_stats (date, messages, voice_seconds) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET messages = excluded.messages, voice_seconds = excluded.voice_seconds`,
    [currentDay.date, currentDay.messages, currentDay.voiceSeconds],
  );
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

// Regelmäßig speichern (alle 20 Sekunden, um Datenverlust zu vermeiden)
function startTracking() {
  init();
  setInterval(() => {
    checkDayChange();
    persistStats();
  }, 20 * 1000);
}

module.exports = { currentDay, startOccupancy, endOccupancy, seedVoiceTracking, checkDayChange, startTracking };
