const { Events } = require("discord.js");
const { checkDayChange, incrementMessages } = require("../src/activity");

module.exports = {
  name: Events.MessageCreate,
  execute(message) {
    if (message.author.bot) return;
    checkDayChange();
    incrementMessages();
  },
};
