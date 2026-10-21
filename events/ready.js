const { Events } = require("discord.js");
const activity = require("../src/activity");
const birthdays = require("../src/birthdays");
const { startDashboard } = require("../src/dashboard");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(_client, client) {
    activity.seedVoiceTracking(client);
    birthdays.startBirthdayRoleCheck(client);
    startDashboard(client);
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
