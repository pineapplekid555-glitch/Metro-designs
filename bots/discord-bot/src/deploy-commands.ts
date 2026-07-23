import "dotenv/config";
import { REST, Routes } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { BotCommand } from "./types";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // optional: deploy to a specific guild (instant); omit for global (1 hr delay)

if (!token || !clientId) {
  console.error("❌ DISCORD_TOKEN and CLIENT_ID must be set.");
  process.exit(1);
}

const commands: object[] = [];

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((f) => f.endsWith(".js") || f.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const command: BotCommand = require(filePath).default ?? require(filePath);
  if ("data" in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`✅ Registered to guild ${guildId} (instant)`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("✅ Registered globally (may take up to 1 hour to appear)");
    }
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();
