# 🦒 Giraffe – Discord AI Bot

English · **[Deutsch](README.de.md)**

A Discord bot with AI integration built on **discord.js v14**, communicating with LLMs via **Mistral AI** (Mistral Large 4).

## Features

- **`/ai <prompt>`** – Ask an AI model a question (with cost display)
- **`/ping`** – Simple ping-pong command
- Message & voice activity tracking (stored daily in SQLite)
- Cooldown system for commands

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- A Discord bot and its token ([Discord Developer Portal](https://discord.com/developers/applications))
- An API key from [Mistral AI](https://console.mistral.ai)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd Giraffe

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# → fill in your values in .env

# Register slash commands
node deploy-commands.js

# Start the bot
node index.js
```

## Configuration (`.env`)

| Variable | Description |
|---|---|
| `TOKEN` | Discord bot token |
| `MISTRAL_API_KEY` | API key for Mistral AI |
| `BASE_URL` | API base URL (`https://api.mistral.ai/v1`) |
| `AI_MODEL` | Model ID (e.g. `mistral-large-latest`) |
| `AI_SYSTEM_PROMPT` | System prompt for the bot |
| `PRICE_PER_MIO_INPUT_TOKENS` | Cost per 1M input tokens (USD) |
| `PRICE_PER_MIO_OUTPUT_TOKENS` | Cost per 1M output tokens (USD) |

## Project structure

```
├── commands/
│   └── utility/          # Slash commands (ai.js, ping.js)
├── events/               # Discord events (ready, interactionCreate, msgTracker, vcTracker)
├── activityState.js      # Data hub: currentDay + SQLite persistence
├── deploy-commands.js    # Registers slash commands
├── index.js              # Bot entry point
├── docs.md               # Tracking scripts documentation
└── .env.example          # Environment variables template
```

## License

MIT
