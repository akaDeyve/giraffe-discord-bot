const { Events } = require("discord.js");
const {
  currentDay,
  channelOccupiedSince,
  checkDayChange,
} = require("../activityState");


module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member) return;
    if (member.user.bot) return;

    checkDayChange();

    const oldCount = oldState.channel ? 1 : 0;
    const newCount = newState.channel ? 1 : 0;

    // Channel wurde belegt (0 -> >=1)
    if (oldCount === 0 && newCount > 0 && newState.channel) {
      channelOccupiedSince.set(newState.channel.id, Date.now());
    }
    // Channel wurde verlassen (>=1 -> 0)
    else if (oldCount > 0 && newCount === 0 && oldState.channel) {
      const since = channelOccupiedSince.get(oldState.channel.id);
      if (since) {
        currentDay.voiceSeconds += Math.floor((Date.now() - since) / 1000);
        channelOccupiedSince.delete(oldState.channel.id);
      }
    }

    console.log("Update", currentDay);
  },
};
