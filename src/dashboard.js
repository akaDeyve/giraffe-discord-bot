const path = require("node:path");
const express = require("express");
const { ActivityType } = require("discord.js");
const { currentDay } = require("./activity");
const { all } = require("./db");

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
      today: currentDay,
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

  app.post("/api/send", async (req, res) => {
    const { channelId, content, allowMentions } = req.body ?? {};
    if (!channelId || !content) return res.status(400).json({ error: "channelId und content sind erforderlich" });

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) return res.status(400).json({ error: "Kanal ist kein Textkanal" });

      const message = await channel.send({
        content: String(content).slice(0, 2000),
        allowedMentions: { parse: allowMentions ? ["everyone", "users", "roles"] : ["users"] },
      });
      res.json({ success: true, messageId: message.id, channelId });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.use(express.static(path.join(__dirname, "public")));
  return app;
}

function startDashboard(client) {
  buildApp(client).listen(PORT, HOST, () => console.log(`Dashboard: http://${HOST}:${PORT}`));
}

module.exports = { startDashboard };
