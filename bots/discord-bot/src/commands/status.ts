import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

type CommissionStatus = "pending" | "in_progress" | "review" | "completed" | "cancelled";

interface Commission {
  userId: string;
  username: string;
  description: string;
  status: CommissionStatus;
  updatedAt: string;
  updatedBy: string;
  price?: string;
}

const STATUS_COLORS: Record<CommissionStatus, number> = {
  pending: 0xfee75c,
  in_progress: 0x5865f2,
  review: 0xeb459e,
  completed: 0x57f287,
  cancelled: 0xed4245,
};

const STATUS_EMOJI: Record<CommissionStatus, string> = {
  pending: "⏳",
  in_progress: "🔨",
  review: "👀",
  completed: "✅",
  cancelled: "❌",
};

const STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  review: "In Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

function getCommissions(): Commission[] {
  return readJSON<Commission[]>("commissions.json", []);
}

function saveCommissions(data: Commission[]) {
  writeJSON("commissions.json", data);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Commission status tracker")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set or update a commission status (staff only)")
        .addUserOption((opt) => opt.setName("client").setDescription("Client user").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Commission status")
            .setRequired(true)
            .addChoices(
              { name: "⏳ Pending", value: "pending" },
              { name: "🔨 In Progress", value: "in_progress" },
              { name: "👀 In Review", value: "review" },
              { name: "✅ Completed", value: "completed" },
              { name: "❌ Cancelled", value: "cancelled" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Commission description").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("price").setDescription("Commission price (e.g. 500 R$)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View a client's commission status")
        .addUserOption((opt) => opt.setName("client").setDescription("Client user (leave blank to see your own)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active commissions (staff only)")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }
      const client = interaction.options.getUser("client", true);
      const newStatus = interaction.options.getString("status", true) as CommissionStatus;
      const description = interaction.options.getString("description");
      const price = interaction.options.getString("price");

      const commissions = getCommissions();
      const existing = commissions.find((c) => c.userId === client.id);

      if (existing) {
        existing.status = newStatus;
        existing.updatedAt = new Date().toISOString();
        existing.updatedBy = interaction.user.tag;
        if (description) existing.description = description;
        if (price) existing.price = price;
      } else {
        commissions.push({
          userId: client.id,
          username: client.tag,
          description: description ?? "No description",
          status: newStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: interaction.user.tag,
          price: price ?? undefined,
        });
      }
      saveCommissions(commissions);

      const embed = new EmbedBuilder()
        .setTitle(`${STATUS_EMOJI[newStatus]} Commission Updated`)
        .setColor(STATUS_COLORS[newStatus])
        .addFields(
          { name: "Client", value: `${client}`, inline: true },
          { name: "Status", value: STATUS_LABELS[newStatus], inline: true },
          { name: "Updated by", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      // Notify the client
      try {
        const notifEmbed = new EmbedBuilder()
          .setTitle("📋 Commission Update")
          .setDescription(`Your commission status has been updated!`)
          .setColor(STATUS_COLORS[newStatus])
          .addFields({ name: "New Status", value: `${STATUS_EMOJI[newStatus]} ${STATUS_LABELS[newStatus]}` })
          .setFooter({ text: "Metro Designs" })
          .setTimestamp();
        await client.send({ embeds: [notifEmbed] });
      } catch {
        // DMs disabled
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "view") {
      const target = interaction.options.getUser("client") ?? interaction.user;
      const commissions = getCommissions();
      const commission = commissions.find((c) => c.userId === target.id);

      if (!commission) {
        await interaction.reply({ content: `❌ No commission found for ${target}.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 Commission Status")
        .setColor(STATUS_COLORS[commission.status])
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Client", value: `${target}`, inline: true },
          { name: "Status", value: `${STATUS_EMOJI[commission.status]} ${STATUS_LABELS[commission.status]}`, inline: true },
          { name: "Description", value: commission.description },
          { name: "Price", value: commission.price ?? "N/A", inline: true },
          { name: "Last Updated", value: `<t:${Math.floor(new Date(commission.updatedAt).getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "list") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }
      const commissions = getCommissions().filter(
        (c) => c.status !== "completed" && c.status !== "cancelled"
      );

      if (commissions.length === 0) {
        await interaction.reply({ content: "📭 No active commissions right now.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 Active Commissions")
        .setColor(0x5865f2)
        .setDescription(
          commissions
            .map(
              (c, i) =>
                `**${i + 1}.** <@${c.userId}> — ${STATUS_EMOJI[c.status]} ${STATUS_LABELS[c.status]}\n> ${c.description}`
            )
            .join("\n\n")
        )
        .setFooter({ text: `${commissions.length} active commission(s)` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
