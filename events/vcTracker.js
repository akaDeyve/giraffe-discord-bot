const { Events } = require("discord.js");
const { currentDay, channelHumanCount, channelOccupiedSince, checkDayChange } = require("../activityState");

// Belegung starten, wenn der erste Mensch den Channel betritt
const startOccupancy = (channelId) => {
  const count = (channelHumanCount.get(channelId) ?? 0) + 1;
  channelHumanCount.set(channelId, count);
  if (count === 1) channelOccupiedSince.set(channelId, Date.now());
};

// Belegung beenden, wenn der letzte Mensch den Channel verlässt
const endOccupancy = (channelId) => {
  const count = (channelHumanCount.get(channelId) ?? 1) - 1;
  if (count > 0) return channelHumanCount.set(channelId, count);

  channelHumanCount.delete(channelId);
  const since = channelOccupiedSince.get(channelId);
  if (since === undefined) return;

  currentDay.voiceSeconds += Math.floor((Date.now() - since) / 1000);
  channelOccupiedSince.delete(channelId);
};

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
