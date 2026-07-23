import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface PartnerEntry {
  id: string;
  serverId: string;
  serverName: string;
  invite: string;
  description: string;
  addedAt: string;
  addedBy: string;
  ownerId?: string;
}

interface PartnerData {
  channelId: string | null;
  partners: PartnerEntry[];
}

const DEFAULT: PartnerData = { channelId: null, partners: [] };

function getData(): PartnerData {
  return readJSON<PartnerData>("partners.json", DEFAULT);
}

function saveData(d: PartnerData) {
  writeJSON("partners.json", d);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("partner")
    .setDescription("Server partnership system")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set the partnerships channel (admin only)")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel for partnership posts").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new server partnership (staff only)")
        .addStringOption((opt) =>
          opt.setName("server_id").setDescription("The partner server's Discord ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("server_name").setDescription("Partner server name").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("invite").setDescription("Permanent invite link (discord.gg/...)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Short description of the server").setRequired(true).setMaxLength(500)
        )
        .addUserOption((opt) =>
          opt.setName("owner").setDescription("Server owner/contact (optional)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a partnership (staff only)")
        .addStringOption((opt) =>
          opt.setName("server_id").setDescription("The partner server's Discord ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all current partnerships")
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Get info about a specific partner")
        .addStringOption((opt) =>
          opt.setName("server_id").setDescription("Partner server ID").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const data = getData();

    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
        return;
      }
      const channel = interaction.options.getChannel("channel", true);
      data.channelId = channel.id;
      saveData(data);
      await interaction.reply({ content: `✅ Partnership channel set to <#${channel.id}>.`, ephemeral: true });
      return;
    }

    if (sub === "add") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }

      const serverId = interaction.options.getString("server_id", true);
      const serverName = interaction.options.getString("server_name", true);
      const invite = interaction.options.getString("invite", true);
      const description = interaction.options.getString("description", true);
      const owner = interaction.options.getUser("owner");

      if (data.partners.find((p) => p.serverId === serverId)) {
        await interaction.reply({ content: `⚠️ A partnership with server ID \`${serverId}\` already exists.`, ephemeral: true });
        return;
      }

      const entry: PartnerEntry = {
        id: Date.now().toString(36).toUpperCase(),
        serverId,
        serverName,
        invite,
        description,
        addedAt: new Date().toISOString(),
        addedBy: interaction.user.tag,
        ownerId: owner?.id,
      };
      data.partners.push(entry);
      saveData(data);

      const embed = new EmbedBuilder()
        .setTitle(`🤝 New Partner — ${serverName}`)
        .setDescription(description)
        .setColor(0x57f287)
        .addFields(
          { name: "📨 Invite", value: invite, inline: true },
          { name: "🆔 Server ID", value: serverId, inline: true },
          { name: "👤 Contact", value: owner ? `${owner}` : "N/A", inline: true }
        )
        .setFooter({ text: `Partnership ID: ${entry.id} • Added by ${interaction.user.tag}` })
        .setTimestamp();

      // Post to partnership channel
      if (data.channelId && interaction.guild) {
        const partnerChannel = interaction.guild.channels.cache.get(data.channelId) as TextChannel | undefined;
        if (partnerChannel) {
          await partnerChannel.send({ embeds: [embed] });
        }
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "remove") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }
      const serverId = interaction.options.getString("server_id", true);
      const before = data.partners.length;
      data.partners = data.partners.filter((p) => p.serverId !== serverId);
      if (data.partners.length === before) {
        await interaction.reply({ content: `❌ No partnership found with server ID \`${serverId}\`.`, ephemeral: true });
        return;
      }
      saveData(data);
      await interaction.reply({ content: `✅ Partnership with \`${serverId}\` removed.` });
      return;
    }

    if (sub === "list") {
      if (data.partners.length === 0) {
        await interaction.reply({ content: "📭 No partnerships yet.", ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("🤝 Metro Designs — Server Partnerships")
        .setColor(0x57f287)
        .setDescription(
          data.partners
            .map((p, i) => `**${i + 1}.** [${p.serverName}](${p.invite}) — ${p.description.slice(0, 80)}`)
            .join("\n\n")
        )
        .setFooter({ text: `${data.partners.length} partner(s)` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "info") {
      const serverId = interaction.options.getString("server_id", true);
      const partner = data.partners.find((p) => p.serverId === serverId);
      if (!partner) {
        await interaction.reply({ content: `❌ No partnership found with server ID \`${serverId}\`.`, ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`🤝 ${partner.serverName}`)
        .setDescription(partner.description)
        .setColor(0x57f287)
        .addFields(
          { name: "📨 Invite", value: partner.invite, inline: true },
          { name: "🆔 Server ID", value: partner.serverId, inline: true },
          { name: "👤 Contact", value: partner.ownerId ? `<@${partner.ownerId}>` : "N/A", inline: true },
          { name: "Added", value: `<t:${Math.floor(new Date(partner.addedAt).getTime() / 1000)}:D>`, inline: true },
          { name: "Added by", value: partner.addedBy, inline: true }
        )
        .setFooter({ text: `Partnership ID: ${partner.id}` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export default command;
