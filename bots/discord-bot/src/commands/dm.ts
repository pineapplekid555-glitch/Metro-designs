import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription("Send a DM to a server member (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to DM").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Message to send").setRequired(true).setMaxLength(2000)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user", true);
    const message = interaction.options.getString("message", true);

    if (target.bot) {
      await interaction.reply({ content: "❌ You cannot DM a bot.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📬 Message from Metro Designs Staff")
      .setDescription(message)
      .setColor(0x5865f2)
      .addFields({ name: "Sent by", value: interaction.user.tag, inline: true })
      .setFooter({ text: "Metro Designs Commission Server" })
      .setTimestamp();

    try {
      await target.send({ embeds: [embed] });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`✅ DM sent to **${target.tag}** successfully.`)
            .setColor(0x57f287),
        ],
        ephemeral: true,
      });
    } catch {
      await interaction.reply({
        content: `❌ Could not DM **${target.tag}**. They may have DMs disabled.`,
        ephemeral: true,
      });
    }
  },
};

export default command;
