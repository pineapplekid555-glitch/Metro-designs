import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface BlacklistEntry {
  userId: string;
  username: string;
  reason: string;
  addedAt: string;
  addedBy: string;
}

function getBlacklist(): BlacklistEntry[] {
  return readJSON<BlacklistEntry[]>("blacklist.json", []);
}

function saveBlacklist(data: BlacklistEntry[]) {
  writeJSON("blacklist.json", data);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Manage the blacklisted clients")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a user to the blacklist")
        .addUserOption((opt) => opt.setName("user").setDescription("User to blacklist").setRequired(true))
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for blacklist").setRequired(true).setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the blacklist")
        .addUserOption((opt) => opt.setName("user").setDescription("User to remove").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Check if a user is blacklisted")
        .addUserOption((opt) => opt.setName("user").setDescription("User to check").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View the full blacklist")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const blacklist = getBlacklist();

    if (sub === "add") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);

      if (blacklist.find((e) => e.userId === user.id)) {
        await interaction.reply({ content: `⚠️ ${user} is already blacklisted.`, ephemeral: true });
        return;
      }

      blacklist.push({
        userId: user.id,
        username: user.tag,
        reason,
        addedAt: new Date().toISOString(),
        addedBy: interaction.user.tag,
      });
      saveBlacklist(blacklist);

      const embed = new EmbedBuilder()
        .setTitle("🔴 User Blacklisted")
        .setColor(0xed4245)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "User", value: `${user} (${user.tag})`, inline: true },
          { name: "Added by", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason }
        )
        .setTimestamp();

      // Notify the user
      try {
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🚫 You have been blacklisted")
              .setDescription("You have been blacklisted from Metro Designs commissions.")
              .setColor(0xed4245)
              .addFields({ name: "Reason", value: reason })
              .setFooter({ text: "Metro Designs" })
              .setTimestamp(),
          ],
        });
      } catch { /* DMs off */ }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "remove") {
      const user = interaction.options.getUser("user", true);
      const before = blacklist.length;
      const updated = blacklist.filter((e) => e.userId !== user.id);
      if (updated.length === before) {
        await interaction.reply({ content: `❌ ${user} is not blacklisted.`, ephemeral: true });
        return;
      }
      saveBlacklist(updated);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ User Removed from Blacklist")
            .setColor(0x57f287)
            .setDescription(`${user} (${user.tag}) has been removed from the blacklist.`)
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === "check") {
      const user = interaction.options.getUser("user", true);
      const entry = blacklist.find((e) => e.userId === user.id);

      if (!entry) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Not Blacklisted")
              .setColor(0x57f287)
              .setDescription(`${user} is **not** on the blacklist.`)
              .setTimestamp(),
          ],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🔴 User is Blacklisted")
        .setColor(0xed4245)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: "User", value: `${user} (${user.tag})`, inline: true },
          { name: "Added by", value: entry.addedBy, inline: true },
          { name: "Date", value: `<t:${Math.floor(new Date(entry.addedAt).getTime() / 1000)}:D>`, inline: true },
          { name: "Reason", value: entry.reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "list") {
      if (blacklist.length === 0) {
        await interaction.reply({ content: "✅ The blacklist is empty.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🔴 Metro Designs Blacklist")
        .setColor(0xed4245)
        .setDescription(
          blacklist
            .map((e, i) => `**${i + 1}.** <@${e.userId}> (${e.username})\n> ${e.reason}`)
            .join("\n\n")
        )
        .setFooter({ text: `${blacklist.length} blacklisted user(s)` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
