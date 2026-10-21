const { SlashCommandBuilder } = require("discord.js");
const { getAgent, runConversation, getOutputText, getToolResults, costOf, buildEmbed } = require("../src/ai");

const MODEL = () => process.env.WEBSEARCH_MODEL ?? "mistral-medium-3-5";

// Quellen-URLs aus den Tool-Ausführungen der Outputs
function getSources(outputs) {
  return [...new Set(getToolResults(outputs).map((result) => result?.url).filter(Boolean))];
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
    const model = MODEL();

    let content = "Keine Antwort erhalten.";
    let sources = [];
    let totalCost = 0;

    try {
      const agentId = await getAgent({
        name: "Giraffe Websearch Agent",
        description: "Beantwortet Fragen mit aktueller Information aus dem Web.",
        instructions: "Beantworte Fragen kurz und prägnant auf Deutsch. Nutze die Websuche für aktuelle Informationen.",
        tools: [{ type: "web_search" }],
        model,
        completionArgs: { tool_choice: "required" },
      });

      const { outputs, usage } = await runConversation(agentId, question);
      content = getOutputText(outputs) || content;
      sources = getSources(outputs).slice(0, 5);
      totalCost = costOf(usage);
    } catch (error) {
      console.error("Fehler bei der Web-Suche:", error);
      content = "Es gab einen Fehler bei der Web-Suche.";
    }

    await interaction.editReply({
      embeds: [buildEmbed(content, { model, totalCost, sources })],
    });
  },
};
