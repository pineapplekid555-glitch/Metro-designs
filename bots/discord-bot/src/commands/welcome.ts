import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { getWelcomeConfig, saveWelcomeConfig } from "../events/welcome";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the welcome message system")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set the welcome channel")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel to send welcome messages in").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription("Set the welcome message (use {user}, {server}, {username})")
        .addStringOption((opt) =>
          opt.setName("message").setDescription("Welcome message text").setRequired(true).setMaxLength(1500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable welcome messages")
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable welcome messages?").setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("preview").setDescription("Preview the current welcome message")),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const config = getWelcomeConfig();

    if (sub === "setup") {
      const channel = interaction.options.getChannel("channel", true);
      config.channelId = channel.id;
      saveWelcomeConfig(config);
      await interaction.reply({ content: `✅ Welcome channel set to <#${channel.id}>.`, ephemeral: true });
      return;
    }

    if (sub === "message") {
      const message = interaction.options.getString("message", true);
      config.message = message;
      saveWelcomeConfig(config);
      await interaction.reply({ content: "✅ Welcome message updated.\n**Variables:** `{user}` `{server}` `{username}`", ephemeral: true });
      return;
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config.enabled = enabled;
      saveWelcomeConfig(config);
      await interaction.reply({ content: `✅ Welcome messages ${enabled ? "enabled" : "disabled"}.`, ephemeral: true });
      return;
    }

    if (sub === "preview") {
      const msg = config.message
        .replace("{user}", `${interaction.user}`)
        .replace("{server}", interaction.guild?.name ?? "Metro Designs")
        .replace("{username}", interaction.user.username);

      const embed = new EmbedBuilder()
        .setTitle(`👋 Welcome to ${interaction.guild?.name ?? "Metro Designs"}!`)
        .setDescription(msg)
        .setColor(0x5865f2)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: `Preview — Channel: ${config.channelId ? `<#${config.channelId}>` : "Not set"} • ${config.enabled ? "Enabled" : "Disabled"}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
