# Metro Designs Discord Bot

A full-featured Discord commissions bot for the Metro Designs Roblox GFX server.

## Run & Operate

- `pnpm --filter @workspace/discord-bot run dev` — run the bot in dev mode (with auto-restart)
- `pnpm --filter @workspace/discord-bot run deploy` — register slash commands with Discord
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DISCORD_TOKEN` — Discord bot token (set as a Replit Secret)
- Required env: `CLIENT_ID` — Discord application/client ID
- Optional env: `GUILD_ID` — Guild ID for instant command registration (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Discord: discord.js v14
- Persistence: JSON file storage in `bots/discord-bot/data/`
- API: Express 5 (shared api-server, not used by bot)

## Where things live

- `bots/discord-bot/src/commands/` — all slash commands
- `bots/discord-bot/src/events/` — event handlers (welcome, etc.)
- `bots/discord-bot/src/data/store.ts` — JSON read/write helpers
- `bots/discord-bot/data/` — persistent JSON data files (gitignored)

## Bot Features

| Command | Purpose |
|---|---|
| `/tax charge/receive` | Roblox 30% tax calculator |
| `/ticket open/close/setup/add/remove` | Commission ticket system |
| `/dm` | DM a user as the bot |
| `/status set/view/list` | Commission status tracker |
| `/pricelist view/add/remove` | Commission price list |
| `/review leave/list` | Review system |
| `/queue view/add/remove/next/check` | Commission queue |
| `/blacklist add/remove/check/list` | Blacklist system |
| `/announce` | Post announcements |
| `/rules show/add/remove` | Server rules |
| `/welcome setup/message/toggle/preview` | Welcome system |
| `/partner add/remove/list/info/setup` | Server partnerships |

## Architecture decisions

- All persistent data stored in JSON files under `bots/discord-bot/data/` — survives bot restarts and code updates without a database.
- Ticket system config is persisted so `/ticket setup` only needs to be run once.
- Bot uses discord.js v14 slash commands (interaction-based, no prefix commands).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `/ticket setup` and `/welcome setup` after first invite.
- Run `pnpm --filter @workspace/discord-bot run deploy` after adding new commands.
- `GUILD_ID` env var enables instant (guild-scoped) command registration — useful in dev. Remove for production global registration.
- Data files in `data/*.json` are gitignored to keep server data private.
