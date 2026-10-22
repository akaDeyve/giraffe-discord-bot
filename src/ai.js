const { EmbedBuilder } = require("discord.js");

const API = "https://api.mistral.ai/v1";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
});

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} fehlgeschlagen: ${res.status} ${await res.text()}`);
  return res.json();
}

// Antworttext aus content extrahieren (String oder Chunk-Liste, thinking wird ignoriert)
function contentToText(content) {
  const parts = typeof content === "string" ? [content] : content ?? [];
  return parts
    .filter((part) => typeof part === "string" || part?.type === "text")
    .map((part) => (typeof part === "string" ? part : part.text ?? ""))
    .join("");
}

// Agent-ID pro Namen cachen – Agent per Name suchen, sonst anlegen (verhindert Duplikate)
const agentIds = new Map();

async function getAgent({ name, description, instructions, tools, model, completionArgs }) {
  if (!agentIds.has(name)) {
    const listRes = await fetch(`${API}/agents`, { headers: headers() });
    const existing = listRes.ok ? (await listRes.json()).find((agent) => agent.name === name) : null;
    agentIds.set(
      name,
      existing?.id ??
        (
          await api("/agents", {
            name,
            description,
            instructions,
            tools,
            model,
            ...(completionArgs && { completion_args: completionArgs }),
          })
        ).id,
    );
  }
  return agentIds.get(name);
}

// Konversation starten, Outputs und Token-Nutzung zurückgeben
async function runConversation(agentId, inputs) {
  const body = await api("/conversations", { agent_id: agentId, inputs });
  return { outputs: body.outputs ?? [], usage: body.usage };
}

// Antworttext aus den Outputs einer Konversation
function getOutputText(outputs) {
  return outputs
    .filter((entry) => entry?.type === "message.output")
    .map((entry) => contentToText(entry.content))
    .join("\n");
}

// Tool-Ergebnisse aus den Outputs parsen (als JSON-Array zurückgeben)
function getToolResults(outputs) {
  const results = [];
  for (const entry of outputs) {
    if (entry?.type !== "tool.execution" || !entry.info?.result) continue;
    try {
      results.push(...[].concat(typeof entry.info.result === "string" ? JSON.parse(entry.info.result) : entry.info.result));
    } catch {}
  }
  return results;
}

// Kosten aus der Token-Nutzung berechnen (Preise pro Mio. Tokens aus der env)
function costOf(usage) {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const inputPrice = Number(process.env.PRICE_PER_MIO_INPUT_TOKENS) || 0;
  const outputPrice = Number(process.env.PRICE_PER_MIO_OUTPUT_TOKENS) || 0;
  return (promptTokens / 1000000) * inputPrice + (completionTokens / 1000000) * outputPrice;
}

// Einheitliches Antwort-Embed mit Quellen, Kosten und Datenschutz-Link
function buildEmbed(content, { model, totalCost, sources = [] }) {
  const sourcesBlock = sources.length
    ? `\n\n**Quellen:**\n${sources.map((url, i) => `[${i + 1}] ${url}`).join("\n")}`
    : "";

  const privacyBlock = process.env.PROVIDER_PRIVACY
    ? `\n\n[Datenschutzrichtlinie](${process.env.PROVIDER_PRIVACY})`
    : "";

  const description =
    (`**${(content || "Keine Antwort erhalten.").slice(0, 3500)}**${sourcesBlock}`).slice(0, 4000) + privacyBlock;

  const footerText = totalCost > 0
    ? `Modell: ${model} • Kosten: $${totalCost.toFixed(5)}${process.env.PROVIDER ? ` \n${process.env.PROVIDER}` : ""}`
    : `Modell: ${model}${process.env.PROVIDER ? ` • Provided by ${process.env.PROVIDER}` : ""}`;

  return new EmbedBuilder().setColor(0x5865f2).setDescription(description).setFooter({ text: footerText });
}

module.exports = { contentToText, costOf, buildEmbed, getAgent, runConversation, getOutputText, getToolResults };
