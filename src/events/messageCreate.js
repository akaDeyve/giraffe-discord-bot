const { Events } = require("discord.js");
const { incrementMessages } = require("../activity");

module.exports = {
  name: Events.MessageCreate,
  execute(message) {
    if (message.author.bot) return;
    incrementMessages();
  },
};
