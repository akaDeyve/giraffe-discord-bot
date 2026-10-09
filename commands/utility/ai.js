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
    await interaction.deferReply();

    const openai = new OpenAI({
      baseURL: process.env.BASE_URL,
      apiKey: process.env.MISTRAL_API_KEY,
    });

    let content = "Keine Antwort erhalten.";
    let totalCost = 0;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.AI_MODEL,
        messages: [
          { role: "system", content: process.env.AI_SYSTEM_PROMPT },
          { role: "user", content: interaction.options.getString("input") },
        ],
      });

      // Mistral liefert die Antwort teils als Text-Blöcke statt einem String
      const rawContent = response.choices[0]?.message?.content;
      const parts = typeof rawContent === "string" ? [rawContent] : rawContent ?? [];
      content = parts.map((part) => part?.text ?? part ?? "").join("") || "Keine Antwort erhalten.";

      // Token-Verbrauch auslesen und Kosten berechnen
      const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = response.usage ?? {};
      totalCost =
        (promptTokens / 1000000) * (process.env.PRICE_PER_MIO_INPUT_TOKENS ?? 0) +
        (completionTokens / 1000000) * (process.env.PRICE_PER_MIO_OUTPUT_TOKENS ?? 0);

      console.log(content);
    } catch (error) {
      console.error("Fehler bei der Anfrage:", error);
      content = "Es gab einen Fehler bei der Anfrage an die KI.";
    }

    const footerText = totalCost > 0
      ? `Modell: ${process.env.AI_MODEL} • Kosten: $${totalCost.toFixed(5)} \n${process.env.PROVIDER}`
      : `Modell: ${process.env.AI_MODEL} • Provided by ${process.env.PROVIDER}`;

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(`**${content}**\n\n[Datenschutzrichtlinie](${process.env.PROVIDER_PRIVACY})`)
          .setFooter({ text: footerText }),
      ],
    });
  },
};
