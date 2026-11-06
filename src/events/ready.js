const { Events } = require("discord.js");
const { seedVoiceTracking } = require("../activity");
const { init: initBirthdays, startBirthdayScheduler } = require("../birthdays");
const { startDashboard } = require("../dashboard");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    initBirthdays();
    seedVoiceTracking(client);
    startBirthdayScheduler(client);
    startDashboard(client);
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
