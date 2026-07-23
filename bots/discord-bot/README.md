# Metro Designs Discord Bot

A full-featured Discord bot for the Metro Designs Roblox commissions server.

## Features

| Command | Description |
|---|---|
| `/tax charge <amount>` | Calculate what to charge to receive X Robux after 30% tax |
| `/tax receive <amount>` | See how much you'll receive after charging X Robux |
| `/ticket open` | Open a commission ticket (private channel) |
| `/ticket close` | Close the current ticket |
| `/ticket setup` | Configure ticket category, staff role, log channel |
| `/ticket add/remove` | Add/remove users from a ticket |
| `/dm <user> <message>` | DM a user from the bot (staff only) |
| `/status set` | Update a client's commission status |
| `/status view` | View commission status |
| `/status list` | List all active commissions |
| `/pricelist view` | Show the commission price list |
| `/pricelist add/remove` | Manage price list items (admin) |
| `/review leave` | Leave a star review |
| `/review list` | View recent reviews |
| `/queue view` | View the commission queue |
| `/queue add/remove/next` | Manage the queue (staff) |
| `/queue check` | Check your position in the queue |
| `/blacklist add/remove/check/list` | Manage blacklisted clients |
| `/announce` | Post an announcement embed to a channel |
| `/rules show` | Show server rules |
| `/rules add/remove/edit` | Manage rules (admin) |
| `/welcome setup/message/toggle/preview` | Configure the welcome system |
| `/partner add/remove/list/info` | Server partnership management |
| `/partner setup` | Set the partnership channel |

## Persistent Data

All bot data (tickets config, queue, blacklist, reviews, etc.) is stored in `data/*.json` files. This means **the ticket system config and all data survive bot restarts and updates** — you never need to redo setup.

## Setup

### 1. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to the **Bot** tab → click **Add Bot**
4. Copy the **Token** — this is your `DISCORD_TOKEN`
5. Under **Privileged Gateway Intents**, enable:
   - Server Members Intent
   - Message Content Intent
6. Copy the **Application ID** from the General Information tab — this is your `CLIENT_ID`

### 2. Invite the Bot to Your Server

Use this URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot+applications.commands
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Set `DISCORD_TOKEN` as a secret in Replit (Settings → Secrets).
Set `CLIENT_ID` and optionally `GUILD_ID` as environment variables.

### 4. Register Slash Commands

```bash
pnpm --filter @workspace/discord-bot run deploy
```

Use `GUILD_ID` for instant registration during dev. Remove it for global registration in production.

### 5. Start the Bot

```bash
pnpm --filter @workspace/discord-bot run dev
```

## First-Time Server Setup (run these after inviting the bot)

```
/ticket setup staff_role:@Staff category:#commission-tickets log_channel:#ticket-logs
/welcome setup channel:#welcome
/review setup channel:#reviews
/partner setup channel:#partnerships
```

## Data Files

All persistent data lives in `bots/discord-bot/data/`:

| File | Contents |
|---|---|
| `tickets.json` | Ticket system config + open tickets |
| `commissions.json` | Commission statuses |
| `queue.json` | Commission queue |
| `blacklist.json` | Blacklisted users |
| `reviews.json` | Reviews + channel config |
| `pricelist.json` | Your price list |
| `rules.json` | Server rules |
| `welcome.json` | Welcome message config |
| `partners.json` | Server partnerships |
