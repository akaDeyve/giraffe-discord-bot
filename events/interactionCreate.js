const { Events, MessageFlags } = require("discord.js");

const DEFAULT_COOLDOWN_SECONDS = 3;

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    const { cooldowns } = interaction.client;
    const cooldownMs = (command.cooldown ?? DEFAULT_COOLDOWN_SECONDS) * 1000;
    const expiresAt = (cooldowns.get(interaction.user.id) ?? 0) + cooldownMs;

    if (Date.now() < expiresAt) {
      return interaction.reply({
        content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${Math.round(expiresAt / 1000)}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    cooldowns.set(interaction.user.id, Date.now());
    setTimeout(() => cooldowns.delete(interaction.user.id), cooldownMs);

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const payload = { content: "There was an error while executing this command!", flags: MessageFlags.Ephemeral };
      try {
        await (interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload));
      } catch (replyError) {
        // Interaction kann abgelaufen oder bereits beantwortet sein – nur loggen, nicht crashen
        console.error(`Fehlermeldung konnte nicht gesendet werden: ${replyError.message}`);
      }
    }
  },
};
