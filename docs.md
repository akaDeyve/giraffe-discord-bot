# 📖 Dokumentation: Tracking-Scripts

Die Bot-Scripts zur Aktivitätsmessung:

1. **`msgTracker.js`** — zählt Nachrichten pro Tag.
2. **`vcTracker.js`** — misst Voice-Sekunden pro Tag.

Beide nutzen **`activityState.js`** als gemeinsame Datenzentrale (RAM → SQLite).

---

## 🧠 Grundkonzept

Discord.js ist **ereignisgesteuert**: Der Bot reagiert auf Events wie `MessageCreate`, `VoiceStateUpdate` oder `ClientReady`. Jedes Event-Script exportiert ein Objekt mit `name` (Event-Name) und `execute` (Callback).

---

## 🗄️ `activityState.js` — die Datenzentrale

```
┌─────────────────────────────────────────────┐
│  Event-Scripts (msgTracker, vcTracker)      │
│  lesen/schreiben currentDay                 │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  activityState.js                           │
│  ┌──────────────────────────────────────┐   │
│  │  currentDay (Memory)                 │   │
│  │  channelOccupiedSince (Map)          │   │
│  ├──────────────────────────────────────┤   │
│  │  saveStats()  ← alle 5 Minuten       │   │
│  │  checkDayChange()  ← bei Bedarf      │   │
│  └──────────────────┬───────────────────┘   │
└─────────────────────┼───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│  SQLite-Datenbank (database.db)             │
│  daily_stats-Tabelle                        │
│  ┌──────────┬──────────┬────────────────┐   │
│  │ date     │ messages │ voice_seconds  │   │
│  ├──────────┼──────────┼────────────────┤   │
│  │ 08.07.*  │ 231      │ 5400           │   │
│  │ 09.07.*  │ 17       │ 120            │   │
│  └──────────┴──────────┴────────────────┘   │
└─────────────────────────────────────────────┘
```

### 1. SQLite & die `daily_stats`-Tabelle

SQLite ist eine dateibasierte Datenbank – kein Server nötig. Die Tabelle wird automatisch angelegt:

```sql
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  messages INTEGER NOT NULL DEFAULT 0,
  voice_seconds INTEGER NOT NULL DEFAULT 0
);
```

| Spalte | Typ | Bedeutung |
|--------|-----|-----------|
| `date` | `TEXT` | Datum als String (Primärschlüssel) |
| `messages` | `INTEGER` | Nachrichtenanzahl (Default 0) |
| `voice_seconds` | `INTEGER` | Voice-Sekunden (ganze Zahl, kein `REAL`) |

### 2. `currentDay` — der aktuelle Tag im RAM

```js
const currentDay = {
  date: new Date().toLocaleDateString(),
  voiceSeconds: 0,
  messages: 0,
};
```

Dieses Objekt lebt nur im Arbeitsspeicher – viel schneller als jedes Platten-I/O.

### 3. Laden aus der DB beim Start

```js
db.get("SELECT * FROM daily_stats WHERE date = ?", [currentDay.date], (err, row) => {
  if (row) {
    currentDay.voiceSeconds = row.voice_seconds;
    currentDay.messages = row.messages;
  }
});
```

Asynchron – der Bot kann schon Nachrichten verarbeiten, während die DB lädt.

### 4. `saveStats()` — Speichern per UPSERT

`saveStats()` ist der öffentliche Einstieg: Er prüft zuerst auf Tageswechsel (`checkDayChange()`) und persistiert danach die Werte mit `persistStats()`.

```js
function persistStats() {
  db.run(
    `INSERT INTO daily_stats (date, messages, voice_seconds) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       messages = excluded.messages,
       voice_seconds = excluded.voice_seconds`,
    [currentDay.date, currentDay.messages, currentDay.voiceSeconds],
  );
}

function saveStats() {
  checkDayChange();
  persistStats();
}
```

**UPSERT** = **UP**date + In**SERT**: Versucht einzufügen, bei Konflikt (Primärschlüssel `date`) wird aktualisiert. `excluded` referenziert die INSERT-Werte.

#### Speicher-Intervall: `setInterval`

```js
setInterval(saveStats, 20 * 1000);
```

Alle 20 Sekunden → max. 20 s Datenverlust bei Absturz. `saveStats()` prüft dabei auch den Tageswechsel, sodass der Wechsel auch ohne aktives Event spätestens nach 20 s erkannt wird.

### 5. `checkDayChange()` — Tageswechsel

```js
function checkDayChange() {
  const today = new Date().toLocaleDateString();
  if (currentDay.date === today) return;

  const midnight = new Date().setHours(0, 0, 0, 0);

  // Noch belegte Channels: Zeit bis Mitternacht zum alten Tag addieren,
  // danach Timestamp auf Mitternacht zurücksetzen
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
```

Bei Tageswechsel passiert Folgendes:

1. **Mitternacht berechnen** – `new Date().setHours(0, 0, 0, 0)` liefert den Timestamp des heutigen Tagesbeginns.
2. **Offene Voice-Sessions abschließen** – für jeden noch belegten Channel wird die Zeit vom `since`-Timestamp bis Mitternacht zum alten Tag addiert. Anschließend wird `since` auf Mitternacht gesetzt, sodass der neue Tag bei 0 Sekunden startet.
3. **Alten Tag speichern** – `persistStats()` schreibt die finalen Werte in die DB.
4. **Zähler zurücksetzen** – Datum, `voiceSeconds` und `messages` werden für den neuen Tag auf 0 gesetzt.

> ⚠️ Die Map wird **nicht** geleert – belegte Channels bleiben erhalten, nur ihre Start-Timestamps werden auf Mitternacht verschoben. So geht keine Zeit verloren, wenn jemand über Mitternacht im Call bleibt.

`checkDayChange()` wird an drei Stellen aufgerufen:
- In `msgTracker.js` und `vcTracker.js` vor jeder Zählung (so wird der Wechsel sofort beim nächsten Event erkannt).
- In `saveStats()` vor dem Persistieren (so wird er auch ohne aktives Event spätestens nach 20 s erkannt).

---

## 📝 `msgTracker.js` — Nachrichten zählen

```
Nachricht → Bot? → abbrechen
   ↓
Tageswechsel? → ggf. alten Tag speichern + reset
   ↓
currentDay.messages++
   ↓
console.log(currentDay)
```

```js
if (message.author.bot) return;
checkDayChange();
currentDay.messages++;
console.log("Aktueller Tag:", currentDay);
```

### Beispiel: Tageswechsel

| Uhrzeit | Aktion | `currentDay.messages` | DB (heute) | DB (gestern) |
|---------|--------|----------------------|------------|--------------|
| 23:50 | Nachricht | 5 | – | – |
| 23:55 | `saveStats()` | 5 | `5` | – |
| 00:05 | Tageswechsel | 1 (neu) | `5` (final) | `1` |
| 00:10 | Nachricht | 2 | `5` | `2` |

Um 00:05: `checkDayChange()` speichert Tag mit 5 Nachrichten final, setzt zurück, neue Nachricht zählt +1.

---

## 🎙️ `vcTracker.js` — Voice-Zeit messen

Anders als Nachrichten (1 Nachricht = +1) ist Voice komplizierter: Ein Channel kann mehrere Leute gleichzeitig haben, gezählt wird die **Channel-Belegungsdauer**, nicht pro Person.

### Lösung: Channel-Status mit `Map`

```js
const channelOccupiedSince = new Map(); // channelId → Startzeit (ms)
```

Wir merken uns pro Channel, ab wann er belegt ist. Die Logik prüft den Zustand **vorher/nachher**:

```js
const oldCount = oldState.channel ? 1 : 0;
const newCount = newState.channel ? 1 : 0;
```

| `old` | `new` | Bedeutung |
|:-----:|:-----:|-----------|
| 0 | 1 | Channel wird **belegt** → Startzeit merken |
| 1 | 1 | Nur Personenwechsel → ignorieren |
| 1 | 0 | Channel wird **leer** → Dauer berechnen |

```js
// Channel belegt
if (oldCount === 0 && newCount > 0 && newState.channel) {
  channelOccupiedSince.set(newState.channel.id, Date.now());
}
// Channel leer
else if (oldCount > 0 && newCount === 0 && oldState.channel) {
  const since = channelOccupiedSince.get(oldState.channel.id);
  if (since) {
    currentDay.voiceSeconds += Math.floor((Date.now() - since) / 1000);
    channelOccupiedSince.delete(oldState.channel.id);
  }
}
```

`Date.now()` liefert Millisekunden seit 1970 (Unixzeit). Die Differenz wird durch 1000 geteilt und mit `Math.floor()` abgerundet auf ganze Sekunden.

Vor der Zählung wird `checkDayChange()` aufgerufen (siehe `activityState.js`), damit ein übersehenen Tageswechsel erkannt wird, bevor die neue Voice-Aktion ausgewertet wird.

### Tageswechsel

Bei Tagwechsel werden offene Voice-Sessions **nicht verworfen**, sondern korrekt aufgeteilt (siehe `checkDayChange()` in `activityState.js`):

- Zeit vom Channel-Start bis **Mitternacht** → zum alten Tag addiert.
- `since`-Timestamp wird auf **Mitternacht** gesetzt → neuer Tag startet bei 0.
- Die Map bleibt erhalten, nur die Timestamps werden verschoben.

So geht keine Zeit verloren, wenn jemand über Mitternacht im Call bleibt.

### Beispiel

| Uhrzeit | Aktion | `voiceSeconds` | Map |
|---------|--------|:--------------:|-----|
| 20:00 | A betritt X | 0 | `{X: 20:00}` |
| 20:15 | B betritt X | 0 | `{X: 20:00}` |
| 20:30 | A verlässt X | 0 | `{X: 20:00}` |
| 20:45 | B verlässt X | 2700 | `{}` |

→ **45 Minuten** Channel-Zeit, obwohl zwei Personen drin waren. Genau das Ziel.

### Beispiel: über Mitternacht im Call

| Uhrzeit | Aktion | Tag | `voiceSeconds` | Map |
|---------|--------|-----|:--------------:|-----|
| 23:30 | A betritt X | alt | 0 | `{X: 23:30}` |
| 00:00 | Tageswechsel (`checkDayChange`) | alt→neu | 1800 (alt) | `{X: 00:00}` |
| 00:15 | A verlässt X | neu | 900 (neu) | `{}` |

- Alter Tag: 23:30→00:00 = **1800 s** (30 Min.)
- Neuer Tag: 00:00→00:15 = **900 s** (15 Min.)
- Gesamt: 45 Min., korrekt auf beide Tage aufgeteilt.

---

## 🔁 Vergleich

| Aspekt | `msgTracker.js` | `vcTracker.js` |
|--------|-----------------|----------------|
| Event | `Events.MessageCreate` | `Events.VoiceStateUpdate` |
| Metrik | Nachrichtenanzahl | Channel-Sekunden |
| Zähler | `currentDay.messages++` | `currentDay.voiceSeconds += …` |
| Zusatzstruktur | – | `channelOccupiedSince` (Map) |
| Bot-Filter | `message.author.bot` | `member.user.bot` |
| Tageswechsel | `checkDayChange()` vor Zählung | `checkDayChange()` vor Zählung |

---

## 🚀 Erweiterungsideen

1. **Pro-User-Statistik**: `currentDay.perUser[userId]` mit separater Tabelle.
2. **Slash-Command `/stats`**: `SELECT * FROM daily_stats ORDER BY date DESC LIMIT 7` als Discord-Embed.
3. **Reset**: `DELETE FROM daily_stats` für Testzwecke.

---

## 📚 Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **Event** | Discord-Ereignis, auf das der Bot reagiert |
| **Enum** | Sammlung fester Werte, z. B. `Events.MessageCreate` |
| **Map** | Key-Value-Struktur für dynamische Keys |
| **UPSERT** | UPDATE + INSERT in einem Befehl |
| **`excluded`** | SQLite-Referenz auf die INSERT-Werte bei Konflikten |

---

*Letzte Aktualisierung: 9. Juli 2026*
