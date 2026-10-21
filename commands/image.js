const { SlashCommandBuilder } = require("discord.js");
const { getAgent, runConversation, getOutputText, getToolResults, costOf, buildEmbed } = require("../src/ai");

const MODEL = () => process.env.IMAGE_MODEL ?? "mistral-medium-3-5";

// Bild-URL aus den Outputs: Tool-Ergebnis (JSON mit url) oder Markdown in der Antwort
function getImageUrl(outputs) {
  for (const result of getToolResults(outputs)) {
    if (result?.url) return result.url;
  }
  return getOutputText(outputs).match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/)?.[1] ?? null;
}

module.exports = {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("Erzeuge ein Bild aus einem Text-Prompt")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Was soll abgebildet werden?").setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");
    const model = MODEL();

    try {
      const agentId = await getAgent({
        name: "Giraffe Image Agent",
        description: "Erzeugt Bilder aus Text-Prompts.",
        instructions: "Use the image generation tool whenever the user wants an image.",
        tools: [{ type: "image_generation" }],
        model,
        completionArgs: { tool_choice: "required" },
      });

      const { outputs, usage } = await runConversation(agentId, prompt);
      const totalCost = costOf(usage);
      const imageUrl = getImageUrl(outputs);

      // Kein Bild erzeugt – Antwort des Agenten zeigen (dort steht der Grund)
      if (!imageUrl) {
        console.log("Kein Bild in Outputs:", JSON.stringify(outputs).slice(0, 2000));
        return interaction.editReply({
          embeds: [buildEmbed(getOutputText(outputs) || "Es konnte kein Bild erzeugt werden.", { model, totalCost })],
        });
      }

      const fileRes = await fetch(imageUrl);
      if (!fileRes.ok) throw new Error(`Download fehlgeschlagen: ${fileRes.status}`);

      await interaction.editReply({
        embeds: [buildEmbed(prompt, { model, totalCost }).setImage("attachment://image.png")],
        files: [{ attachment: Buffer.from(await fileRes.arrayBuffer()), name: "image.png" }],
      });
    } catch (error) {
      console.error("Fehler bei der Bildgenerierung:", error);
      await interaction.editReply({
        embeds: [buildEmbed("Es gab einen Fehler bei der Bildgenerierung.", { model, totalCost: 0 })],
      });
    }
  },
};
