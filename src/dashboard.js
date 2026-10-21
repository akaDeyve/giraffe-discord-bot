const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { ActivityType } = require("discord.js");
const { currentDay } = require("./activity");
const { all } = require("./db");

const PORT = Number(process.env.DASHBOARD_PORT) || 8080;
const HOST = process.env.DASHBOARD_HOST || "127.0.0.1";
const TOKEN = process.env.DASHBOARD_TOKEN || "";
const INDEX_PATH = path.join(__dirname, "public", "index.html");

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        reject(new Error("Body zu groß"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isAuthorized(req) {
  return !TOKEN || req.headers.authorization === `Bearer ${TOKEN}`;
}

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

const routes = {
  "GET /api/status": (client) => ({
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
  }),

  "GET /api/stats": () =>
    all("SELECT date, messages, voice_seconds FROM daily_stats ORDER BY date DESC LIMIT 60"),

  "GET /api/birthdays": () =>
    all("SELECT guild_id, user_id, day, month, year FROM birthdays ORDER BY month, day"),

  "GET /api/guilds": (client) =>
    client.guilds.cache.map((guild) => ({ id: guild.id, name: guild.name, memberCount: guild.memberCount })),
};

async function handleSend(client, req) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return [400, { error: "Ungültiges JSON" }];
  }
  const { channelId, content, allowMentions } = payload;
  if (!channelId || !content) return [400, { error: "channelId und content sind erforderlich" }];

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return [400, { error: "Kanal ist kein Textkanal" }];

    const message = await channel.send({
      content: String(content).slice(0, 2000),
      allowedMentions: { parse: allowMentions ? ["everyone", "users", "roles"] : ["users"] },
    });
    return [200, { success: true, messageId: message.id, channelId }];
  } catch (error) {
    return [400, { error: error.message }];
  }
}

function startDashboard(client) {
  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const key = `${req.method} ${url.pathname}`;

      if (url.pathname.startsWith("/api/")) {
        if (!isAuthorized(req)) return json(res, 401, { error: "Nicht autorisiert" });
        try {
          if (key === "POST /api/send") return json(res, ...(await handleSend(client, req)));
          const route = routes[key];
          if (!route) return json(res, 404, { error: "Nicht gefunden" });
          json(res, 200, await route(client));
        } catch (error) {
          json(res, 500, { error: error.message });
        }
        return;
      }

      if (url.pathname === "/") {
        fs.readFile(INDEX_PATH, (err, data) => {
          if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            return res.end("404");
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(data);
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404");
    })
    .listen(PORT, HOST, () => console.log(`Dashboard: http://${HOST}:${PORT}`));
}

module.exports = { startDashboard };
