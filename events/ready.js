const { Events } = require("discord.js");
const { seedVoiceTracking } = require("../src/activity");
const { init: initBirthdays, startBirthdayScheduler } = require("../src/birthdays");
const { startDashboard } = require("../src/dashboard");

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
