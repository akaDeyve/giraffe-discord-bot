const { SlashCommandBuilder } = require("discord.js");
const { chat, contentToText, costOf, buildEmbed } = require("../../mistral");

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Stelle eine Frage an die KI")
    .addStringOption((option) =>
      option
        .setName("input")
        .setDescription("Gib deine Frage ein")
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    let content = "Keine Antwort erhalten.";
    let totalCost = 0;

    try {
      const request = {
        model: process.env.AI_MODEL,
        messages: [
          { role: "system", content: process.env.AI_SYSTEM_PROMPT },
          { role: "user", content: interaction.options.getString("input") },
        ],
      };
      // Effort nur mitschicken, wenn konfiguriert (none | high)
      if (process.env.AI_REASONING_EFFORT) request.reasoning_effort = process.env.AI_REASONING_EFFORT;

      const response = await chat().chat.completions.create(request);

      content = contentToText(response.choices[0]?.message?.content) || content;
      totalCost = costOf(response.usage);
    } catch (error) {
      console.error("Fehler bei der Anfrage:", error.status, error.message, error.error);
      content = "Es gab einen Fehler bei der Anfrage an die KI.";
    }

    await interaction.editReply({
      embeds: [buildEmbed(content, { model: process.env.AI_MODEL, totalCost })],
    });
  },
};
