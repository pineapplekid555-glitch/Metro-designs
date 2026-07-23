import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  Interaction,
  GuildMember,
} from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { BotCommand } from "./types";
import { loadData } from "./data/store";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const commands = new Collection<string, BotCommand>();

// Load all commands from commands directory
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((f) => f.endsWith(".js") || f.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const command: BotCommand = require(filePath).default ?? require(filePath);
  if ("data" in command && "execute" in command) {
    commands.set(command.data.name, command);
  }
}

// Ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log(`📋 Loaded ${commands.size} commands`);
  loadData();
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing /${interaction.commandName}:`, err);
      const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  }

  if (interaction.isButton()) {
    const { handleTicketClose, handleTicketClaim, handleTicketOpen } = require("./commands/ticket");
    if (interaction.customId.startsWith("ticket_close_")) {
      await handleTicketClose(interaction);
    } else if (interaction.customId.startsWith("ticket_claim_")) {
      await handleTicketClaim(interaction);
    } else if (interaction.customId.startsWith("ticket_open_")) {
      const ticketType = interaction.customId.replace("ticket_open_", "");
      await handleTicketOpen(interaction, ticketType);
    }
  }
});

// Welcome new members
client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  const { sendWelcome } = require("./events/welcome");
  await sendWelcome(member);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ DISCORD_TOKEN is not set in environment variables.");
  process.exit(1);
}

client.login(token);
