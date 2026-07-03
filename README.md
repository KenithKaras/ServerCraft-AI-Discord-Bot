# ServerCraft AI

ServerCraft AI — an AI-powered Discord bot that automatically sets up entire server structures (roles, channels, permissions) from natural language instructions.

## Features

- **Natural Language Server Setup**: Use `/setup` to describe your ideal server and let the bot build it.
- **Pre-built Templates**: Instantly deploy popular structures using `/setup-template`.
- **Multi-AI Provider Support**: Seamlessly switch between OpenAI, Gemini, Claude, and OpenRouter.
- **Safety First**: Features a confirm/cancel flow before making any structural changes to your server.
- **Automatic Fallback**: If one AI model is unavailable, the bot can automatically fallback to another provider.

## Prerequisites

Before you begin, ensure you have met the following requirements:
- **Node.js** installed on your machine.
- A **Discord bot application** created via the Discord Developer Portal.
- An **AI provider API key** (at least one of OpenAI, Gemini, Claude, or OpenRouter).

## Setup Instructions

Follow these step-by-step instructions to get ServerCraft AI running:

1. **Clone/download the repo**:
   ```bash
   git clone <repository-url>
   cd ServerCraft-AI
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create a Discord application**:
   - Go to [discord.com/developers/applications](https://discord.com/developers/applications).
   - Create a new application and add a bot.
   - Copy the bot token and client ID.

4. **Configure environment variables**:
   - Copy the `.env.example` file to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Fill in your `DISCORD_TOKEN`, `CLIENT_ID`, `AI_PROVIDER`, and the relevant API key(s) in the `.env` file.

5. **Register slash commands**:
   ```bash
   node deploy-commands.js
   ```

6. **Start the bot**:
   ```bash
   npm start
   ```

7. **Invite the bot**:
   - Generate an OAuth2 URL in the Discord Developer Portal with the `bot` and `applications.commands` scopes.
   - Grant the `Administrator` permission so the bot can fully manage channels and roles.
   - Use the generated URL to invite the bot to your server.

## Usage

### `/setup`
Use natural language to describe the server structure you want. The bot will interpret your prompt and propose a setup.

**Example**:
`/setup prompt:"Create a community server for developers with channels for general chat, help, and showcase, plus roles for Admin, Mod, and Member."`

### `/setup-template`
Use pre-built templates for quick and standardized setups.

**Available Templates**:
- **RP Server**: Roleplay server with in-character and out-of-character zones.
- **Gaming Clan**: Structured for squads, announcements, and voice channels.
- **Study Group**: Focused on subjects, study voice rooms, and resource sharing.

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `DISCORD_TOKEN` | Your Discord bot token from the Developer Portal. |
| `CLIENT_ID` | Your Discord application's Client ID. |
| `AI_PROVIDER` | The active AI provider (e.g., `openai`, `gemini`, `claude`, `openrouter`). |
| `OPENAI_API_KEY` | Your OpenAI API key (if using OpenAI). |
| `GEMINI_API_KEY` | Your Google Gemini API key (if using Gemini). |
| `CLAUDE_API_KEY` | Your Anthropic Claude API key (if using Claude). |
| `OPENROUTER_API_KEY` | Your OpenRouter API key (if using OpenRouter). |

## Deployment

For 24/7 uptime, you can easily deploy ServerCraft AI to platforms like [Railway.app](https://railway.app/). 
When deploying, make sure to add all the required environment variables from your `.env` file directly into the Railway project dashboard.

## Troubleshooting

- **"AI could not generate a valid structure"**: This usually means the selected AI model is rate-limited or temporarily unavailable. Try your request again later or double-check that your API key is correct and active.
- **"Command not found in Discord"**: This means the slash commands weren't registered with Discord. Stop the bot, run `node deploy-commands.js`, and restart.

## Contributing

Contributions are always welcome! Feel free to open an issue or submit a pull request if you have ideas for new features or templates.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
