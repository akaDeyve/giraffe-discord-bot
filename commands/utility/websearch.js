const { SlashCommandBuilder } = require("discord.js");
const { getAgent, runConversation, getOutputText, costOf, buildEmbed } = require("../../mistral");

const MODEL = () => process.env.WEBSEARCH_MODEL ?? "mistral-medium-latest";

const websearchAgent = () =>
  getAgent({
    name: "Giraffe Websearch Agent",
    description: "Beantwortet Fragen mit aktueller Information aus dem Web.",
    instructions: "Beantworte Fragen kurz und prägnant auf Deutsch. Nutze die Websuche für aktuelle Informationen.",
    tools: [{ type: "web_search" }],
    model: MODEL(),
    completionArgs: { tool_choice: "required" },
  });

// Quellen-URLs aus den Tool-Ausführungen der Outputs
function getSources(outputs) {
  const sources = [];
  for (const entry of outputs) {
    if (entry?.type !== "tool.execution" || !entry.info?.result) continue;
    try {
      const results = typeof entry.info.result === "string" ? JSON.parse(entry.info.result) : entry.info.result;
      sources.push(...Object.values(results ?? {}).map((result) => result?.url).filter(Boolean));
    } catch {}
  }
  return [...new Set(sources)];
}

module.exports = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("websearch")
    .setDescription("Stelle eine Frage - die KI sucht im Web und antwortet mit Quellen")
    .addStringOption((option) =>
      option.setName("frage").setDescription("Deine Frage").setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const question = interaction.options.getString("frage");

    let content = "Keine Antwort erhalten.";
    let sources = [];
    let totalCost = 0;

    try {
      const { outputs, usage } = await runConversation(await websearchAgent(), question);
      content = getOutputText(outputs) || content;
      sources = getSources(outputs).slice(0, 5);
      totalCost = costOf(usage);
    } catch (error) {
      console.error("Fehler bei der Web-Suche:", error);
      content = "Es gab einen Fehler bei der Web-Suche.";
    }

    await interaction.editReply({
      embeds: [buildEmbed(content, { model: MODEL(), totalCost, sources })],
    });
  },
};
