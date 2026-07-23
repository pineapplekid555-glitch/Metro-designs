import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

type DiscountType = "percent" | "flat";

interface DiscountCode {
  code: string;
  type: DiscountType;
  value: number; // percent (0-100) or flat Robux amount
  maxUses: number | null; // null = unlimited
  uses: number;
  expiresAt: string | null; // ISO date string or null
  createdAt: string;
  createdBy: string;
  note: string;
  usedBy: string[]; // user IDs who have used this code
}

function getCodes(): DiscountCode[] {
  return readJSON<DiscountCode[]>("discounts.json", []);
}

function saveCodes(data: DiscountCode[]) {
  writeJSON("discounts.json", data);
}

function isExpired(code: DiscountCode): boolean {
  if (!code.expiresAt) return false;
  return new Date(code.expiresAt) < new Date();
}

function isMaxedOut(code: DiscountCode): boolean {
  if (code.maxUses === null) return false;
  return code.uses >= code.maxUses;
}

function applyDiscount(original: number, code: DiscountCode): number {
  if (code.type === "percent") {
    return Math.ceil(original * (1 - code.value / 100));
  }
  return Math.max(0, original - code.value);
}

/** How much the client should charge to receive `discounted` after 30% Roblox tax */
function withTax(amount: number): number {
  return Math.ceil(amount / 0.7);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("discount")
    .setDescription("Discount code system")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new discount code (admin only)")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("The code string (e.g. SUMMER20)")
            .setRequired(true)
            .setMaxLength(30)
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Discount type")
            .setRequired(true)
            .addChoices(
              { name: "% Percentage off", value: "percent" },
              { name: "R$ Flat Robux off", value: "flat" }
            )
        )
        .addNumberOption((opt) =>
          opt
            .setName("value")
            .setDescription("Discount value (e.g. 20 for 20% off, or 100 for 100 R$ off)")
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((opt) =>
          opt
            .setName("note")
            .setDescription("Internal note for this code (e.g. 'Summer sale 2025')")
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("max_uses")
            .setDescription("Max number of times this code can be used (leave blank for unlimited)")
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption((opt) =>
          opt
            .setName("expires")
            .setDescription("Expiry date in YYYY-MM-DD format (e.g. 2025-12-31)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("apply")
        .setDescription("Apply a discount code to a Robux price")
        .addStringOption((opt) =>
          opt.setName("code").setDescription("Your discount code").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("price")
            .setDescription("Original commission price in Robux (before tax)")
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("use")
        .setDescription("Mark a discount code as used by a client (staff only)")
        .addStringOption((opt) =>
          opt.setName("code").setDescription("Discount code").setRequired(true)
        )
        .addUserOption((opt) =>
          opt.setName("client").setDescription("Client who used the code").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Get info about a discount code (staff only)")
        .addStringOption((opt) =>
          opt.setName("code").setDescription("Discount code").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all discount codes (staff only)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a discount code (admin only)")
        .addStringOption((opt) =>
          opt.setName("code").setDescription("Discount code to delete").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Reset usage count on a code (admin only)")
        .addStringOption((opt) =>
          opt.setName("code").setDescription("Discount code to reset").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const codes = getCodes();

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (sub === "create") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
        return;
      }

      const rawCode = interaction.options.getString("code", true).toUpperCase().trim();
      const type = interaction.options.getString("type", true) as DiscountType;
      const value = interaction.options.getNumber("value", true);
      const note = interaction.options.getString("note") ?? "";
      const maxUses = interaction.options.getInteger("max_uses") ?? null;
      const expiresRaw = interaction.options.getString("expires");

      if (codes.find((c) => c.code === rawCode)) {
        await interaction.reply({
          content: `❌ A code named \`${rawCode}\` already exists. Delete it first or choose a different name.`,
          ephemeral: true,
        });
        return;
      }

      if (type === "percent" && value > 100) {
        await interaction.reply({ content: "❌ Percentage discount cannot exceed 100%.", ephemeral: true });
        return;
      }

      let expiresAt: string | null = null;
      if (expiresRaw) {
        const parsed = new Date(expiresRaw);
        if (isNaN(parsed.getTime())) {
          await interaction.reply({ content: "❌ Invalid date format. Use YYYY-MM-DD.", ephemeral: true });
          return;
        }
        parsed.setHours(23, 59, 59, 999);
        expiresAt = parsed.toISOString();
      }

      const newCode: DiscountCode = {
        code: rawCode,
        type,
        value,
        maxUses,
        uses: 0,
        expiresAt,
        createdAt: new Date().toISOString(),
        createdBy: interaction.user.tag,
        note,
        usedBy: [],
      };

      codes.push(newCode);
      saveCodes(codes);

      const discountLabel =
        type === "percent" ? `${value}% off` : `${value.toLocaleString()} R$ off`;

      const embed = new EmbedBuilder()
        .setTitle("🏷️ Discount Code Created")
        .setColor(0x57f287)
        .addFields(
          { name: "Code", value: `\`${rawCode}\``, inline: true },
          { name: "Discount", value: discountLabel, inline: true },
          { name: "Max Uses", value: maxUses !== null ? `${maxUses}` : "Unlimited", inline: true },
          {
            name: "Expires",
            value: expiresAt
              ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:D>`
              : "Never",
            inline: true,
          },
          { name: "Note", value: note || "—", inline: false }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ── APPLY ────────────────────────────────────────────────────────────────
    if (sub === "apply") {
      const rawCode = interaction.options.getString("code", true).toUpperCase().trim();
      const price = interaction.options.getInteger("price", true);

      const code = codes.find((c) => c.code === rawCode);

      if (!code) {
        await interaction.reply({ content: `❌ Code \`${rawCode}\` does not exist.`, ephemeral: true });
        return;
      }
      if (isExpired(code)) {
        await interaction.reply({ content: `❌ Code \`${rawCode}\` has expired.`, ephemeral: true });
        return;
      }
      if (isMaxedOut(code)) {
        await interaction.reply({
          content: `❌ Code \`${rawCode}\` has reached its maximum number of uses.`,
          ephemeral: true,
        });
        return;
      }

      const discounted = applyDiscount(price, code);
      const saved = price - discounted;
      const chargeWithTax = withTax(discounted);
      const originalChargeWithTax = withTax(price);

      const discountLabel =
        code.type === "percent" ? `${code.value}% off` : `${code.value.toLocaleString()} R$ off`;

      const embed = new EmbedBuilder()
        .setTitle("🏷️ Discount Applied!")
        .setColor(0x57f287)
        .setDescription(`Code \`${rawCode}\` — **${discountLabel}**`)
        .addFields(
          {
            name: "💰 Original Price",
            value: `${price.toLocaleString()} R$\n*(charge ${originalChargeWithTax.toLocaleString()} R$ with tax)*`,
            inline: true,
          },
          {
            name: "🎉 Discounted Price",
            value: `**${discounted.toLocaleString()} R$**\n*(charge **${chargeWithTax.toLocaleString()} R$** with tax)*`,
            inline: true,
          },
          {
            name: "💵 You Save",
            value: `${saved.toLocaleString()} R$`,
            inline: true,
          }
        )
        .setFooter({
          text:
            code.maxUses !== null
              ? `${code.uses}/${code.maxUses} uses • Ask staff to mark it used after paying`
              : `${code.uses} uses so far • Ask staff to mark it used after paying`,
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ── USE (staff marks it as used) ─────────────────────────────────────────
    if (sub === "use") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }

      const rawCode = interaction.options.getString("code", true).toUpperCase().trim();
      const client = interaction.options.getUser("client", true);

      const code = codes.find((c) => c.code === rawCode);
      if (!code) {
        await interaction.reply({ content: `❌ Code \`${rawCode}\` not found.`, ephemeral: true });
        return;
      }
      if (isExpired(code)) {
        await interaction.reply({ content: `⚠️ Code \`${rawCode}\` is expired, but marking it used anyway.`, ephemeral: true });
      }

      code.uses += 1;
      if (!code.usedBy.includes(client.id)) code.usedBy.push(client.id);
      saveCodes(codes);

      const remaining =
        code.maxUses !== null ? code.maxUses - code.uses : null;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Code Marked as Used")
            .setColor(0x5865f2)
            .addFields(
              { name: "Code", value: `\`${rawCode}\``, inline: true },
              { name: "Client", value: `${client}`, inline: true },
              { name: "Total Uses", value: `${code.uses}`, inline: true },
              {
                name: "Remaining",
                value: remaining !== null ? `${remaining}` : "Unlimited",
                inline: true,
              }
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── INFO ─────────────────────────────────────────────────────────────────
    if (sub === "info") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }

      const rawCode = interaction.options.getString("code", true).toUpperCase().trim();
      const code = codes.find((c) => c.code === rawCode);
      if (!code) {
        await interaction.reply({ content: `❌ Code \`${rawCode}\` not found.`, ephemeral: true });
        return;
      }

      const expired = isExpired(code);
      const maxedOut = isMaxedOut(code);
      const discountLabel =
        code.type === "percent" ? `${code.value}% off` : `${code.value.toLocaleString()} R$ off`;

      let statusText = "✅ Active";
      if (expired) statusText = "❌ Expired";
      else if (maxedOut) statusText = "❌ Max uses reached";

      const embed = new EmbedBuilder()
        .setTitle(`🏷️ Discount Code: \`${code.code}\``)
        .setColor(expired || maxedOut ? 0xed4245 : 0x57f287)
        .addFields(
          { name: "Status", value: statusText, inline: true },
          { name: "Discount", value: discountLabel, inline: true },
          { name: "Uses", value: code.maxUses !== null ? `${code.uses}/${code.maxUses}` : `${code.uses} (unlimited)`, inline: true },
          {
            name: "Expires",
            value: code.expiresAt
              ? `<t:${Math.floor(new Date(code.expiresAt).getTime() / 1000)}:D>`
              : "Never",
            inline: true,
          },
          { name: "Created by", value: code.createdBy, inline: true },
          {
            name: "Created",
            value: `<t:${Math.floor(new Date(code.createdAt).getTime() / 1000)}:D>`,
            inline: true,
          },
          { name: "Note", value: code.note || "—" },
          {
            name: `Used by (${code.usedBy.length})`,
            value:
              code.usedBy.length > 0
                ? code.usedBy.slice(0, 10).map((id) => `<@${id}>`).join(", ") +
                  (code.usedBy.length > 10 ? ` +${code.usedBy.length - 10} more` : "")
                : "Nobody yet",
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === "list") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return;
      }

      if (codes.length === 0) {
        await interaction.reply({ content: "📭 No discount codes yet. Use `/discount create` to add one.", ephemeral: true });
        return;
      }

      const lines = codes.map((c) => {
        const expired = isExpired(c);
        const maxedOut = isMaxedOut(c);
        const statusEmoji = expired || maxedOut ? "🔴" : "🟢";
        const discountLabel =
          c.type === "percent" ? `${c.value}%` : `${c.value.toLocaleString()} R$`;
        const usesLabel = c.maxUses !== null ? `${c.uses}/${c.maxUses}` : `${c.uses} uses`;
        return `${statusEmoji} \`${c.code}\` — **${discountLabel} off** • ${usesLabel}${c.note ? ` • *${c.note}*` : ""}`;
      });

      const active = codes.filter((c) => !isExpired(c) && !isMaxedOut(c)).length;

      const embed = new EmbedBuilder()
        .setTitle("🏷️ Discount Codes")
        .setColor(0x5865f2)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `${active} active / ${codes.length} total` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (sub === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
        return;
      }

      const rawCode = interaction.options.getString("code", true).toUpperCase().trim();
      const before = codes.length;
      const updated = codes.filter((c) => c.code !== rawCode);
      if (updated.length === before) {
        await interaction.reply({ content: `❌ Code \`${rawCode}\` not found.`, ephemeral: true });
        return;
      }
      saveCodes(updated);
      await interaction.reply({ content: `✅ Discount code \`${rawCode}\` deleted.`, ephemeral: true });
      return;
    }

    // ── RESET ─────────────────────────────────────────────────────────────────
    if (sub === "reset") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
        return;
      }

      const rawCode = interaction.options.getString("code", true).toUpperCase().trim();
      const code = codes.find((c) => c.code === rawCode);
      if (!code) {
        await interaction.reply({ content: `❌ Code \`${rawCode}\` not found.`, ephemeral: true });
        return;
      }
      code.uses = 0;
      code.usedBy = [];
      saveCodes(codes);
      await interaction.reply({ content: `✅ Usage for \`${rawCode}\` reset to 0.`, ephemeral: true });
    }
  },
};

export default command;
