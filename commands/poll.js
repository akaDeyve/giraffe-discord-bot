const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Erstelle eine Abstimmung")
    .addStringOption((option) =>
      option.setName("frage").setDescription("Die Frage der Abstimmung").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("optionen")
        .setDescription("Antworten, mit Komma getrennt (2-10)")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("mehrfachauswahl")
        .setDescription("Mehrere Antworten wahlbar? (Standard: nein)"),
    ),

  async execute(interaction) {
    const answers = interaction.options
      .getString("optionen")
      .split(",")
      .map((answer) => answer.trim())
      .filter(Boolean);

    if (answers.length < 2 || answers.length > 10)
      return interaction.reply({
        content: "Bitte gib zwischen 2 und 10 Antworten an (mit Komma getrennt).",
        flags: MessageFlags.Ephemeral,
      });

    await interaction.reply({
      poll: {
        question: { text: interaction.options.getString("frage") },
        answers: answers.map((text) => ({ text })),
        duration: 24,
        allowMultiselect: interaction.options.getBoolean("mehrfachauswahl") ?? false,
      },
    });
  },
};
