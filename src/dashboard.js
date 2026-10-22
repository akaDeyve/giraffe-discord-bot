const path = require("node:path");
const express = require("express");
const { ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { all, get, run } = require("./db");

const isoDate = () => new Date().toISOString().slice(0, 10);

// Liefert die Stats des heutigen Tages; legt die Tabelle on-demand an,
// falls das Tracking noch nicht gelaufen ist (z. B. Dashboard vor erstem Track-Aufruf).
function todayStats() {
  const today = isoDate();
  const fallback = { date: today, messages: 0, voiceSeconds: 0 };
  try {
    return get("SELECT date, messages, voice_seconds AS voiceSeconds FROM daily_stats WHERE date = ?", [today]) ?? fallback;
  } catch {
    run(`CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      messages INTEGER NOT NULL DEFAULT 0,
      voice_seconds INTEGER NOT NULL DEFAULT 0
    )`);
    return fallback;
  }
}

const PORT = Number(process.env.DASHBOARD_PORT) || 8080;
const HOST = process.env.DASHBOARD_HOST || "127.0.0.1";
const TOKEN = process.env.DASHBOARD_TOKEN || "";

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const parts = [
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  const out = [];
  let rest = seconds;
  for (const [div, suffix] of parts) {
    if (rest >= div) {
      out.push(`${Math.floor(rest / div)}${suffix}`);
      rest %= div;
    }
  }
  out.push(`${rest}s`);
  return out.join(" ");
}

function statusRoute(client) {
  return (req, res) => {
    res.json({
      bot: {
        tag: client.user?.tag ?? null,
        id: client.user?.id ?? null,
        avatar: client.user?.displayAvatarURL() ?? null,
        status: client.ws?.status ?? null,
        ping: client.ws?.ping ?? null,
        presence: client.presence
          ? {
              status: client.presence.status,
              activity: client.presence.activities?.[0]
                ? {
                    name: client.presence.activities[0].name,
                    type: Object.keys(ActivityType).find(
                      (key) => ActivityType[key] === client.presence.activities[0].type,
                    ),
                  }
                : null,
            }
          : null,
      },
      runtime: {
        uptimeProcess: formatDuration(process.uptime() * 1000),
        uptimeBot: client.readyAt ? formatDuration(Date.now() - client.readyAt.getTime()) : null,
        nodeVersion: process.version,
        memoryUsedMB: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
        guilds: client.guilds.cache.size,
        users: client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0),
        channels: client.channels.cache.size,
      },
      today: todayStats(),
    });
  };
}

function buildApp(client) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  if (TOKEN) app.use("/api", (req, res, next) => (req.headers.authorization === `Bearer ${TOKEN}` ? next() : res.status(401).json({ error: "Nicht autorisiert" })));

  app.get("/api/status", statusRoute(client));
  app.get("/api/stats", (req, res) => res.json(all("SELECT date, messages, voice_seconds FROM daily_stats ORDER BY date DESC LIMIT 60")));
  app.get("/api/birthdays", (req, res) => res.json(all("SELECT guild_id, user_id, day, month, year FROM birthdays ORDER BY month, day")));
  app.get("/api/guilds", (req, res) =>
    res.json(client.guilds.cache.map((guild) => ({ id: guild.id, name: guild.name, memberCount: guild.memberCount }))),
  );

  // Alle Textkanäle, in die der Bot schreiben darf (für den Channel-Dropdown im Dashboard)
  app.get("/api/channels", async (req, res) => {
    const channels = [];
    for (const guild of client.guilds.cache.values()) {
      try {
        const fetched = await guild.channels.fetch();
        for (const channel of fetched.values()) {
          if (!channel.isTextBased() || channel.type === ChannelType.GuildDirectory) continue;
          if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) continue;
          channels.push({ id: channel.id, name: channel.name, guildId: guild.id, guildName: guild.name });
        }
      } catch (error) {
        console.error(`Kanäle laden fehlgeschlagen (${guild.name}): ${error.message}`);
      }
    }
    res.json(channels);
  });

  // Führt die Embed-Definition aus dem Dashboard in ein discord.js-Embed über
  function buildEmbedFromPayload(embedPayload) {
    const embed = new EmbedBuilder();
    if (embedPayload.title) embed.setTitle(String(embedPayload.title).slice(0, 256));
    if (embedPayload.description) embed.setDescription(String(embedPayload.description).slice(0, 4096));
    if (embedPayload.color) embed.setColor(parseColor(embedPayload.color));
    if (embedPayload.url) embed.setURL(embedPayload.url);
    if (embedPayload.footer?.text) embed.setFooter({
      text: String(embedPayload.footer.text).slice(0, 2048),
      ...(embedPayload.footer.iconUrl && { iconURL: embedPayload.footer.iconUrl }),
    });
    if (embedPayload.author?.name) embed.setAuthor({
      name: String(embedPayload.author.name).slice(0, 256),
      ...(embedPayload.author.iconUrl && { iconURL: embedPayload.author.iconUrl }),
      ...(embedPayload.author.url && { url: embedPayload.author.url }),
    });
    if (embedPayload.thumbnailUrl) embed.setThumbnail(embedPayload.thumbnailUrl);
    if (embedPayload.imageUrl) embed.setImage(embedPayload.imageUrl);
    if (embedPayload.timestamp) embed.setTimestamp(new Date(embedPayload.timestamp));
    for (const field of embedPayload.fields ?? []) {
      if (!field?.name || !field.value) continue;
      embed.addFields({
        name: String(field.name).slice(0, 256),
        value: String(field.value).slice(0, 1024),
        inline: Boolean(field.inline),
      });
    }
    return embed;
  }

  // Embed ohne sichtbaren Inhalt (kein Titel, Beschreibung, Felder, Bild, ...) von Discord abgelehnt
  function embedHasContent(embed) {
    return Boolean(
      embed.data.title ||
        embed.data.description ||
        embed.data.fields?.length ||
        embed.data.image ||
        embed.data.thumbnail ||
        embed.data.author ||
        embed.data.footer ||
        embed.data.timestamp,
    );
  }

  // Link-Buttons aus dem Dashboard: alle flach sammeln, dann in Reihen à max. 5,
  // max. 25 Buttons (Discord-Limit: 5 Reihen à 5 Buttons pro Message)
  function buildButtonsFromPayload(buttonsPayload) {
    const all = buttonsPayload
      .flatMap((row) => (Array.isArray(row) ? row : [row]))
      .filter((button) => button?.label && button?.url)
      .map((button) =>
        new ButtonBuilder()
          .setLabel(String(button.label).slice(0, 80))
          .setStyle(ButtonStyle.Link)
          .setURL(button.url),
      )
      .slice(0, 25);

    const rows = [];
    for (let i = 0; i < all.length; i += 5) {
      rows.push(new ActionRowBuilder().setComponents(all.slice(i, i + 5)));
    }
    return rows;
  }

  app.post("/api/send", async (req, res) => {
    const { channelId, content, embed: embedPayload, embeds, buttons, allowMentions } = req.body ?? {};
    const buttonList = Array.isArray(buttons) ? buttons : [];
    const embedList = Array.isArray(embeds) ? embeds : embedPayload ? [embedPayload] : [];

    if (!channelId) return res.status(400).json({ error: "channelId ist erforderlich" });
    if (!content && embedList.length === 0 && buttonList.length === 0)
      return res.status(400).json({ error: "content, embed oder buttons sind erforderlich" });

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) return res.status(400).json({ error: "Kanal ist kein Textkanal" });

      const payload = {
        allowedMentions: { parse: allowMentions ? ["everyone", "users", "roles"] : ["users"] },
      };
      if (content) payload.content = String(content).slice(0, 2000);

      const builtEmbeds = embedList
        .map((embedData) => {
          try {
            return buildEmbedFromPayload(embedData);
          } catch (error) {
            throw new Error(`Ungültiges Embed: ${error.message}`);
          }
        })
        .filter(embedHasContent)
        .slice(0, 10);

      const buttonRows = buildButtonsFromPayload(buttonList);

      if (!content && builtEmbeds.length === 0 && buttonRows.length === 0)
        return res.status(400).json({ error: "content, Embed mit Inhalt oder Buttons sind erforderlich" });
      if (builtEmbeds.length) payload.embeds = builtEmbeds;
      if (buttonRows.length) payload.components = buttonRows;

      const message = await channel.send(payload);
      res.json({ success: true, messageId: message.id, channelId });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.use(express.static(path.join(__dirname, "public")));
  return app;
}

// Akzeptiert Hex (#5865f2, 5865f2), 0x5865f2 und Namen wie "Orange"
function parseColor(color) {
  if (typeof color === "number") return color;
  const trimmed = String(color).trim();
  const hex = trimmed.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return parseInt(hex, 16);
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return parseInt(trimmed, 16);
  return trimmed; // Farbname wie "Orange" – discord.js validiert
}

function startDashboard(client) {
  buildApp(client).listen(PORT, HOST, () => console.log(`Dashboard: http://${HOST}:${PORT}`));
}

module.exports = { startDashboard };
