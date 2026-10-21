const { Events } = require("discord.js");
const { checkDayChange, startOccupancy, endOccupancy } = require("../src/activity");

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    checkDayChange();

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Beitritt oder Channel-Wechsel: neuen Channel als belegt markieren
    if (newChannel && newChannel.id !== oldChannel?.id) startOccupancy(newChannel.id);

    // Verlassen oder Channel-Wechsel: alten Channel ggf. freigeben
    if (oldChannel && oldChannel.id !== newChannel?.id) endOccupancy(oldChannel.id);

    // Mute/Deafen ohne Channel-Wechsel ändern die Belegung nicht
  },
};
