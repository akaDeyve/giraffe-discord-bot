const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { ActivityType } = require("discord.js");
const { currentDay } = require("../activityState");

const PORT = Number(process.env.DASHBOARD_PORT) || 8080;
const HOST = process.env.DASHBOARD_HOST || "127.0.0.1";
const TOKEN = process.env.DASHBOARD_TOKEN || "";
const PUBLIC_PATH = path.join(__dirname, "public");
const startedAt = Date.now();

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
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
  if (!TOKEN) return true;
  const header = req.headers.authorization || "";
  return header === `Bearer ${TOKEN}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("./database.db", sqlite3.OPEN_READONLY, (err) =>
  err ? console.error(err.message) : null,
);

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/status") {
    const client = req.appClient;
    const presence = client.presence || null;
    json(res, 200, {
      bot: {
        tag: client.user?.tag ?? null,
        id: client.user?.id ?? null,
        avatar: client.user?.displayAvatarURL() ?? null,
        status: client.ws?.status ?? null,
        ping: client.ws?.ping ?? null,
        presence: presence
          ? {
              status: presence.status,
              activity: presence.activities?.[0]
                ? {
                    name: presence.activities[0].name,
                    type: Object.keys(ActivityType).find(
                      (key) => ActivityType[key] === presence.activities[0].type,
                    ),
                  }
                : null,
            }
          : null,
      },
      runtime: {
        uptimeProcess: formatDuration(process.uptime() * 1000),
        uptimeBot: client.readyAt ? formatDuration(Date.now() - client.readyAt.getTime()) : null,
        startedAt: new Date(startedAt).toISOString(),
        nodeVersion: process.version,
        memoryUsedMB: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
        guilds: client.guilds.cache.size,
        users: client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0),
        channels: client.channels.cache.size,
      },
      today: currentDay,
    });
    return;
  }

  if (url.pathname === "/api/stats") {
    const rows = await dbAll(
      "SELECT date, messages, voice_seconds FROM daily_stats ORDER BY date DESC LIMIT 60",
    );
    json(res, 200, rows);
    return;
  }

  if (url.pathname === "/api/birthdays") {
    const rows = await dbAll(
      "SELECT guild_id, user_id, day, month, year FROM birthdays ORDER BY month, day",
    );
    json(res, 200, rows);
    return;
  }

  if (url.pathname === "/api/guilds") {
    const client = req.appClient;
    json(
      res,
      200,
      client.guilds.cache.map((guild) => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
      })),
    );
    return;
  }

  if (url.pathname === "/api/send" && req.method === "POST") {
    const client = req.appClient;
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      json(res, 400, { error: "Ungültiges JSON" });
      return;
    }
    const { channelId, content, allowMentions } = payload;
    if (!channelId || !content) {
      json(res, 400, { error: "channelId und content sind erforderlich" });
      return;
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        json(res, 400, { error: "Kanal ist kein Textkanal" });
        return;
      }
      const message = await channel.send({
        content: String(content).slice(0, 2000),
        allowedMentions: { parse: allowMentions ? ["everyone", "users", "roles"] : ["users"] },
      });
      json(res, 200, { success: true, messageId: message.id, channelId });
    } catch (error) {
      json(res, 400, { error: error.message });
    }
    return;
  }

  json(res, 404, { error: "Nicht gefunden" });
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function startDashboard(client) {
  const server = http.createServer(async (req, res) => {
    req.appClient = client;
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      if (!isAuthorized(req)) {
        json(res, 401, { error: "Nicht autorisiert" });
        return;
      }
      try {
        await handleApi(req, res, url);
      } catch (error) {
        json(res, 500, { error: error.message });
      }
      return;
    }

    if (url.pathname === "/") {
      serveStatic(res, path.join(PUBLIC_PATH, "index.html"));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404");
  });

  server.listen(PORT, HOST, () => {
    console.log(`Dashboard: http://${HOST}:${PORT}`);
  });

  return server;
}

module.exports = { startDashboard };
