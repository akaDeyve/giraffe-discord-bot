const { Events } = require("discord.js");
const { currentDay, checkDayChange } = require("../activityState");

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    checkDayChange();

    currentDay.messages++;

    console.log("Update", currentDay);
  },
};
