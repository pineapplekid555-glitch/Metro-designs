import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { BotCommand } from "../types";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post an announcement to a channel (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("Channel to post to").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("title").setDescription("Announcement title").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Announcement message").setRequired(true).setMaxLength(2000)
    )
    .addStringOption((opt) =>
      opt
        .setName("color")
        .setDescription("Embed color")
        .setRequired(false)
        .addChoices(
          { name: "🔵 Blue (default)", value: "blue" },
          { name: "🟢 Green", value: "green" },
          { name: "🔴 Red", value: "red" },
          { name: "🟡 Yellow", value: "yellow" },
          { name: "🟣 Purple", value: "purple" }
        )
    )
    .addBooleanOption((opt) =>
      opt.setName("ping_everyone").setDescription("Ping @everyone?").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel("channel", true);
    const title = interaction.options.getString("title", true);
    const message = interaction.options.getString("message", true);
    const colorChoice = interaction.options.getString("color") ?? "blue";
    const pingEveryone = interaction.options.getBoolean("ping_everyone") ?? false;

    const colorMap: Record<string, number> = {
      blue: 0x5865f2,
      green: 0x57f287,
      red: 0xed4245,
      yellow: 0xfee75c,
      purple: 0x9b59b6,
    };

    const textChannel = interaction.guild?.channels.cache.get(channel.id) as TextChannel | undefined;
    if (!textChannel?.isTextBased()) {
      await interaction.reply({ content: "❌ That's not a valid text channel.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(colorMap[colorChoice] ?? 0x5865f2)
      .setAuthor({
        name: interaction.guild?.name ?? "Metro Designs",
        iconURL: interaction.guild?.iconURL() ?? undefined,
      })
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();

    await textChannel.send({
      content: pingEveryone ? "@everyone" : undefined,
      embeds: [embed],
    });

    await interaction.reply({ content: `✅ Announcement posted to ${textChannel}.`, ephemeral: true });
  },
};

export default command;
