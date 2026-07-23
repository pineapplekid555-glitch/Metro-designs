import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface RulesData {
  title: string;
  rules: string[];
  footer: string;
}

const DEFAULT: RulesData = {
  title: "📜 Metro Designs — Server Rules",
  footer: "Breaking these rules may result in a ban from our services.",
  rules: [
    "Be respectful to all members and staff.",
    "No spamming, advertising, or self-promotion without permission.",
    "All commissions must be paid upfront or agreed upon with staff.",
    "No chargebacks. All sales are final.",
    "Do not ping staff unnecessarily — open a ticket instead.",
    "No NSFW content of any kind.",
    "Scamming will result in an immediate ban and blacklist.",
    "Follow Discord's Terms of Service at all times.",
  ],
};

function getData(): RulesData {
  return readJSON<RulesData>("rules.json", DEFAULT);
}

function saveData(d: RulesData) {
  writeJSON("rules.json", d);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Server rules")
    .addSubcommand((sub) => sub.setName("show").setDescription("Display the server rules"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a rule (admin only)")
        .addStringOption((opt) => opt.setName("rule").setDescription("Rule text").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a rule by number (admin only)")
        .addIntegerOption((opt) =>
          opt.setName("number").setDescription("Rule number").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit title or footer (admin only)")
        .addStringOption((opt) => opt.setName("title").setDescription("New title").setRequired(false))
        .addStringOption((opt) => opt.setName("footer").setDescription("New footer").setRequired(false))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const data = getData();

    if (sub === "show") {
      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setColor(0x5865f2)
        .setDescription(
          data.rules.map((r, i) => `**${i + 1}.** ${r}`).join("\n\n")
        )
        .setFooter({ text: data.footer })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      return;
    }

    if (sub === "add") {
      const rule = interaction.options.getString("rule", true);
      data.rules.push(rule);
      saveData(data);
      await interaction.reply({ content: `✅ Rule ${data.rules.length} added.`, ephemeral: true });
      return;
    }

    if (sub === "remove") {
      const num = interaction.options.getInteger("number", true);
      if (num > data.rules.length) {
        await interaction.reply({ content: `❌ Rule #${num} doesn't exist.`, ephemeral: true });
        return;
      }
      data.rules.splice(num - 1, 1);
      saveData(data);
      await interaction.reply({ content: `✅ Rule #${num} removed.`, ephemeral: true });
      return;
    }

    if (sub === "edit") {
      const title = interaction.options.getString("title");
      const footer = interaction.options.getString("footer");
      if (title) data.title = title;
      if (footer) data.footer = footer;
      saveData(data);
      await interaction.reply({ content: "✅ Rules updated.", ephemeral: true });
    }
  },
};

export default command;
