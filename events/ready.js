const { Events } = require("discord.js");
const { seedVoiceTracking } = require("../activityState");
const { startBirthdayRoleCheck } = require("../birthdayState");
const { startDashboard } = require("../dashboard/server");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    seedVoiceTracking(client);
    startBirthdayRoleCheck(client);
    startDashboard(client);
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
