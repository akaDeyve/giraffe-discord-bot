require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const OpenAI = require("openai");

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
    // Discord sagen, dass wir etwas Zeit brauchen
    await interaction.deferReply();

    const input = interaction.options.getString("input");

    const openai = new OpenAI({
      baseURL: process.env.BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Variablen außerhalb definieren, damit sie überall im Code lesbar sind
    let content = "Keine Antwort erhalten.";
    let totalCost = 0;
    let costText = "";

    try {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL,
        messages: [
          {
            role: "system",
            content: process.env.AI_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `${input}`,
          },
        ],
      });

      // 1. Text auslesen
      content =
        response.choices[0]?.message?.content || "Keine Antwort erhalten.";

      // 2. Token-Verbrauch auslesen und Kosten berechnen
      const usage = response.usage;
      if (usage) {
        const promptTokens = usage.prompt_tokens;
        const completionTokens = usage.completion_tokens;

        // Preise definieren
        const PRICE_PER_MIO_INPUT = process.env.PRICE_PER_MIO_INPUT_TOKENS || 0;
        const PRICE_PER_MIO_OUTPUT =
          process.env.PRICE_PER_MIO_OUTPUT_TOKENS || 0;

        // Kosten berechnen (Wert wird in die obere Variable geschrieben)
        const costInput = (promptTokens / 1000000) * PRICE_PER_MIO_INPUT;
        const costOutput = (completionTokens / 1000000) * PRICE_PER_MIO_OUTPUT;
        totalCost = costInput + costOutput;
      }

      // Wenn ein Fehler auftrat, hängen wir keine (oder eine leere) Kostenrechnung an

      if (totalCost > 0) {
        costText = `\n\n\n*(Kosten für diese Anfrage mit ${process.env.AI_MODEL}: $${totalCost.toFixed(5)})*`;
      } else {
        costText = `\n\n\n*(Kosten Konnten nicht ermittelt werden.)*`;
      }

      console.log(content);
    } catch (error) {
      console.error("Fehler bei der Anfrage:", error);
      content = "Es gab einen Fehler bei der Anfrage an die KI.";
    }

    // Erstellen des Embeds
    const responseEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription(
        `**${content}**\n\n[Datenschutzrichtlinie](https://tensorx.ai/privacy-policy)`,
      )

    // KORREKTUR: Reiner, sauberer Text für den Footer ohne HTML-Tags
    if (totalCost > 0) {
      responseEmbed.setFooter({
        text: `Modell: ${process.env.AI_MODEL} • Kosten: $${totalCost.toFixed(5)} \nProvided by TensorX AI`,
      });
    } else {
      responseEmbed.setFooter({
        text: `Modell: ${process.env.AI_MODEL} • Provided by TensorX AI`,
      });
    }

    // Das Embed absenden
    await interaction.editReply({
      embeds: [responseEmbed],
    });
  },
};
