const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
require("dotenv").config();
const { loadFolder } = require("./src/loaders");
const activity = require("./src/activity");
const birthdays = require("./src/birthdays");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages, // Für Nachrichtentracking
    GatewayIntentBits.MessageContent, // Falls du den Inhalt analysieren musst
    GatewayIntentBits.GuildVoiceStates, // Für Voice-Tracking
    GatewayIntentBits.GuildPresences, // Für das Tracken von Online-Status/Spielen
    GatewayIntentBits.GuildMembers, // Wichtig, damit Member gecached werden
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.VoiceState],
});

client.commands = new Collection();
client.cooldowns = new Collection();

for (const command of loadFolder("commands").values()) {
  client.commands.set(command.data.name, command);
}

// Events erhalten den Client als letzten Parameter
for (const event of loadFolder("events", { isEvent: true }).values()) {
  const handler = (...args) => event.execute(...args, client);
  event.once ? client.once(event.name, handler) : client.on(event.name, handler);
}

birthdays.init();
activity.startTracking();
client.login(process.env.TOKEN);
