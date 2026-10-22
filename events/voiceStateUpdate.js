// Voice-Tracking: zählt anonym nur, wie viele Menschen pro Channel im Voice sind (keine User-IDs)
const { Events } = require("discord.js");
const { channelHumans } = require("../src/activity");

module.exports = {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    if (oldChannel?.id === newChannel?.id) return; // Mute/Deafen zählt nicht

    if (oldChannel) {
      const count = (channelHumans.get(oldChannel.id) ?? 1) - 1;
      count > 0 ? channelHumans.set(oldChannel.id, count) : channelHumans.delete(oldChannel.id);
    }
    if (newChannel) channelHumans.set(newChannel.id, (channelHumans.get(newChannel.id) ?? 0) + 1);
  },
};
