const { Events } = require("discord.js");
const { seedVoiceTracking } = require("../activityState");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    seedVoiceTracking(client);
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};
