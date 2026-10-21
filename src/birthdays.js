const { PermissionFlagsBits } = require("discord.js");
const { run, get, all } = require("./db");

const BIRTHDAY_ROLE_ID = "881297542313287700";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function init() {
  run(`CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    day INTEGER NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER,
    PRIMARY KEY (guild_id, user_id)
  )`);
  run(`CREATE TABLE IF NOT EXISTS birthday_wishes (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, date)
  )`);
}

function setBirthday(guildId, userId, day, month, year) {
  run(
    `INSERT INTO birthdays (guild_id, user_id, day, month, year) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET day = excluded.day, month = excluded.month, year = excluded.year`,
    [guildId, userId, day, month, year ?? null],
  );
}

function deleteBirthday(guildId, userId) {
  return run("DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?", [guildId, userId]).changes > 0;
}

function getBirthday(guildId, userId) {
  return get("SELECT day, month, year FROM birthdays WHERE guild_id = ? AND user_id = ?", [guildId, userId]);
}

// System-Channel, oder der erste Textkanal, in dem der Bot schreiben darf
function findWishChannel(guild) {
  const me = guild.members.me;
  const canSend = (channel) =>
    channel.isTextBased() && channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages);
  return canSend(guild.systemChannel) ? guild.systemChannel : guild.channels.cache.find(canSend);
}

async function sendBirthdayWish(guild, member, age) {
  const channel = findWishChannel(guild);
  if (!channel) throw new Error(`Kein Kanal zum Wünschen gefunden (${guild.name})`);

  const ageText = age !== null ? ` Du wirst heute ${age}!` : "";
  await channel.send({
    content: `@everyone\nAlles Gute zum Geburtstag, <@${member.id}>!${ageText}`,
    allowedMentions: { parse: ["everyone", "users"] },
  });
}

// Rolle vergeben/entfernen und pro Geburtstagskind genau einen Wunsch pro Tag schicken
async function applyBirthdayRoles(client) {
  const now = new Date();
  const today = now.toLocaleDateString();
  const birthdays = all("SELECT * FROM birthdays");

  for (const guild of client.guilds.cache.values()) {
    const todays = birthdays.filter(
      (b) => b.guild_id === guild.id && b.day === now.getDate() && b.month === now.getMonth() + 1,
    );
    const todaysIds = new Set(todays.map((b) => b.user_id));

    try {
      await guild.members.fetch();
    } catch (err) {
      console.error(`Member laden fehlgeschlagen (${guild.name}): ${err.message}`);
    }

    const role = guild.roles.cache.get(BIRTHDAY_ROLE_ID);
    if (role) {
      for (const userId of todaysIds) {
        const member = guild.members.cache.get(userId);
        if (member && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, "Hat heute Geburtstag").catch(console.error);
        }
      }
      for (const member of role.members.values()) {
        if (!todaysIds.has(member.id)) {
          await member.roles.remove(role, "Geburtstag ist vorbei").catch(console.error);
        }
      }
    }

    for (const { user_id: userId, year } of todays) {
      const member = guild.members.cache.get(userId);
      if (!member) continue;

      // INSERT OR IGNORE verhindert doppelte Wünsche, auch nach Neustarts
      const { changes } = run("INSERT OR IGNORE INTO birthday_wishes VALUES (?, ?, ?)", [guild.id, userId, today]);
      if (!changes) continue;

      try {
        await sendBirthdayWish(guild, member, year ? now.getFullYear() - year : null);
      } catch (err) {
        run("DELETE FROM birthday_wishes WHERE guild_id = ? AND user_id = ? AND date = ?", [
          guild.id,
          userId,
          today,
        ]);
        console.error(`Geburtstagswunsch fehlgeschlagen (${member.user.tag}): ${err.message}`);
      }
    }
  }
}

function startBirthdayRoleCheck(client) {
  applyBirthdayRoles(client).catch(console.error);
  setInterval(() => applyBirthdayRoles(client).catch(console.error), CHECK_INTERVAL_MS);
}

module.exports = {
  init,
  setBirthday,
  deleteBirthday,
  getBirthday,
  startBirthdayRoleCheck,
};
