const { SlashCommandBuilder } = require("discord.js");
const { getAgent, runConversation, getOutputText, costOf, buildEmbed } = require("../../mistral");

const MODEL = () => process.env.IMAGE_MODEL ?? "mistral-medium-latest";

const imageAgent = () =>
  getAgent({
    name: "Giraffe Image Agent",
    description: "Erzeugt Bilder aus Text-Prompts.",
    instructions: "Use the image generation tool whenever the user wants an image.",
    tools: [{ type: "image_generation" }],
    model: MODEL(),
    completionArgs: { tool_choice: "required" },
  });

// Bild-URL aus den Outputs: Tool-Ergebnis (JSON mit url) oder Markdown in der Antwort
function getImageUrl(outputs) {
  for (const entry of outputs) {
    if (entry?.type !== "tool.execution" || !entry.info?.result) continue;
    try {
      const result = typeof entry.info.result === "string" ? JSON.parse(entry.info.result) : entry.info.result;
      if (result?.url) return result.url;
    } catch {}
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

    try {
      const { outputs, usage } = await runConversation(await imageAgent(), prompt);
      const imageUrl = getImageUrl(outputs);
      const totalCost = costOf(usage);

      // Kein Bild erzeugt - Antwort des Agenten zeigen (dort steht der Grund)
      if (!imageUrl) {
        console.log("Kein Bild in Outputs:", JSON.stringify(outputs).slice(0, 2000));
        return interaction.editReply({
          embeds: [buildEmbed(getOutputText(outputs) || "Es konnte kein Bild erzeugt werden.", { model: MODEL(), totalCost })],
        });
      }

      const fileRes = await fetch(imageUrl);
      if (!fileRes.ok) throw new Error(`Download fehlgeschlagen: ${fileRes.status}`);
      const buffer = Buffer.from(await fileRes.arrayBuffer());

      await interaction.editReply({
        embeds: [buildEmbed(prompt, { model: MODEL(), totalCost }).setImage("attachment://image.png")],
        files: [{ attachment: buffer, name: "image.png" }],
      });
    } catch (error) {
      console.error("Fehler bei der Bildgenerierung:", error);
      await interaction.editReply({
        embeds: [buildEmbed("Es gab einen Fehler bei der Bildgenerierung.", { model: MODEL(), totalCost: 0 })],
      });
    }
  },
};
