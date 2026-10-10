const OpenAI = require("openai");
const { EmbedBuilder } = require("discord.js");

const API = "https://api.mistral.ai/v1";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
});

// OpenAI-kompatibler Client fuer Chat-Completions
function chat() {
  return new OpenAI({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.MISTRAL_API_KEY,
  });
}

// Antworttext aus content extrahieren (String oder Chunk-Liste, thinking wird ignoriert)
function contentToText(content) {
  const parts = typeof content === "string" ? [content] : content ?? [];
  return parts
    .filter((part) => typeof part === "string" || part?.type === "text")
    .map((part) => (typeof part === "string" ? part : part.text ?? ""))
    .join("");
}

// Agent per Name suchen, sonst anlegen - verhindert Agent-Duplikate
async function getOrCreateAgent({ name, description, instructions, tools, model, completionArgs }) {
  const listRes = await fetch(`${API}/agents`, { headers: headers() });
  if (listRes.ok) {
    const existing = (await listRes.json()).find((agent) => agent.name === name);
    if (existing) return existing.id;
  }

  const res = await fetch(`${API}/agents`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      description,
      instructions,
      tools,
      model,
      ...(completionArgs && { completion_args: completionArgs }),
    }),
  });
  if (!res.ok) throw new Error(`Agent-Erstellung fehlgeschlagen: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

// Agent-ID pro Namen cachen (ein API-Lookup pro Bot-Lauf)
const agentIds = new Map();

async function getAgent(config) {
  if (!agentIds.has(config.name)) {
    agentIds.set(config.name, await getOrCreateAgent(config));
  }
  return agentIds.get(config.name);
}

// Konversation starten, Outputs und Token-Nutzung zurueckgeben
async function runConversation(agentId, inputs) {
  const res = await fetch(`${API}/conversations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ agent_id: agentId, inputs }),
  });
  if (!res.ok) throw new Error(`Konversation fehlgeschlagen: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return { outputs: body.outputs ?? [], usage: body.usage };
}

// Antworttext aus den Outputs einer Konversation
function getOutputText(outputs) {
  return outputs
    .filter((entry) => entry?.type === "message.output")
    .map((entry) => contentToText(entry.content))
    .join("\n");
}

// Kosten aus der Token-Nutzung berechnen (Preise pro Mio. Tokens aus der env)
function costOf(usage) {
  const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = usage ?? {};
  return (
    (promptTokens / 1000000) * (process.env.PRICE_PER_MIO_INPUT_TOKENS ?? 0) +
    (completionTokens / 1000000) * (process.env.PRICE_PER_MIO_OUTPUT_TOKENS ?? 0)
  );
}

// Einheitliches Antwort-Embed mit Quellen, Kosten und Datenschutz-Link
function buildEmbed(content, { model, totalCost, sources = [] }) {
  const sourcesBlock = sources.length
    ? `\n\n**Quellen:**\n${sources.map((url, i) => `[${i + 1}] ${url}`).join("\n")}`
    : "";

  const description =
    `**${(content || "Keine Antwort erhalten.").slice(0, 3500)}**${sourcesBlock}`.slice(0, 4000) +
    `\n\n[Datenschutzrichtlinie](${process.env.PROVIDER_PRIVACY})`;

  const footerText = totalCost > 0
    ? `Modell: ${model} • Kosten: $${totalCost.toFixed(5)} \n${process.env.PROVIDER}`
    : `Modell: ${model} • Provided by ${process.env.PROVIDER}`;

  return new EmbedBuilder().setColor(0x5865f2).setDescription(description).setFooter({ text: footerText });
}

module.exports = { chat, contentToText, costOf, buildEmbed, getAgent, runConversation, getOutputText };
