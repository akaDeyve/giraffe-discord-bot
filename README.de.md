# 🦒 Giraffe – Discord AI Bot

**[English](README.md)** · Deutsch

Ein Discord-Bot mit KI-Integration, der auf **discord.js v14** basiert und über eine OpenAI-kompatible API (z. B. TensorX AI) mit LLMs kommuniziert.

## Funktionen

- **`/ai <frage>`** – Stelle Fragen an ein KI-Modell (mit Kostenanzeige)
- **`/ping`** – Einfacher Ping-Pong-Befehl
- Nachrichten- & Voice-Tracking (täglich in SQLite gespeichert)
- Cooldown-System für Commands

## Voraussetzungen

- [Node.js](https://nodejs.org/) (v18 oder neuer)
- Ein Discord-Bot und dessen Token ([Discord Developer Portal](https://discord.com/developers/applications))
- Ein API-Key eines OpenAI-kompatiblen Anbieters (z. B. [TensorX AI](https://tensorx.ai))

## Installation

```bash
# Repository klonen
git clone <repository-url>
cd Giraffe

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# → .env mit deinen Werten ausfüllen

# Slash-Commands registrieren
node deploy-commands.js

# Bot starten
node index.js
```

## Konfiguration (`.env`)

| Variable | Beschreibung |
|---|---|
| `TOKEN` | Discord Bot-Token |
| `OPENAI_API_KEY` | API-Key für den AI-Provider |
| `BASE_URL` | Base-URL der API (z. B. `https://api.tensorx.ai/v1`) |
| `AI_MODEL` | Modell-ID (z. B. `deepseek/deepseek-v4-flash`) |
| `AI_SYSTEM_PROMPT` | System-Prompt für den Bot |
| `PRICE_PER_MIO_INPUT_TOKENS` | Kosten pro Mio. Input-Tokens (USD) |
| `PRICE_PER_MIO_OUTPUT_TOKENS` | Kosten pro Mio. Output-Tokens (USD) |

## Projektstruktur

```
├── commands/
│   └── utility/          # Slash-Commands (ai.js, ping.js)
├── events/               # Discord-Events (ready, interactionCreate, msgTracker, vcTracker)
├── activityState.js      # Datenzentrale: currentDay + SQLite-Persistenz
├── deploy-commands.js    # Registriert Slash-Commands
├── index.js              # Bot-Einstiegspunkt
├── docs.md               # Doku der Tracking-Scripts
└── .env.example          # Vorlage für Umgebungsvariablen
```

## Lizenz

MIT
