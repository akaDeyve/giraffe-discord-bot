const { Events } = require("discord.js");
const { seedVoiceTracking } = require("../activityState");
const { startBirthdayRoleCheck } = require("../birthdayState");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    seedVoiceTracking(client);
    startBirthdayRoleCheck(client);
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
