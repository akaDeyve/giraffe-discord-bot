const { Events } = require("discord.js");
const { currentDay, checkDayChange } = require("../src/activity");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    checkDayChange();
    currentDay.messages++;
  },
};
