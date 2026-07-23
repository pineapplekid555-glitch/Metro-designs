import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface PriceItem {
  name: string;
  price: string;
  description?: string;
}

interface PriceList {
  title: string;
  footer: string;
  items: PriceItem[];
}

const DEFAULT_PRICELIST: PriceList = {
  title: "Metro Designs — Price List",
  footer: "Prices are in Robux (R$) • DM to commission",
  items: [
    { name: "Basic GFX", price: "150–300 R$", description: "Simple graphic design" },
    { name: "Advanced GFX", price: "500–1000 R$", description: "Complex, detailed artwork" },
    { name: "Logo Design", price: "200–500 R$", description: "Custom logo for your group/game" },
    { name: "Banner", price: "100–250 R$", description: "Server or game banner" },
    { name: "UI Design", price: "300–800 R$", description: "In-game UI elements" },
  ],
};

function getPriceList(): PriceList {
  return readJSON<PriceList>("pricelist.json", DEFAULT_PRICELIST);
}

function savePriceList(data: PriceList) {
  writeJSON("pricelist.json", data);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("pricelist")
    .setDescription("Commission price list")
    .addSubcommand((sub) => sub.setName("view").setDescription("View the current price list"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add an item to the price list (admin only)")
        .addStringOption((opt) => opt.setName("name").setDescription("Service name").setRequired(true))
        .addStringOption((opt) => opt.setName("price").setDescription("Price (e.g. 500 R$)").setRequired(true))
        .addStringOption((opt) => opt.setName("description").setDescription("Short description").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an item from the price list (admin only)")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Service name to remove").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit_title")
        .setDescription("Edit the price list title/footer (admin only)")
        .addStringOption((opt) => opt.setName("title").setDescription("New title").setRequired(false))
        .addStringOption((opt) => opt.setName("footer").setDescription("New footer").setRequired(false))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const priceList = getPriceList();

    if (sub === "view") {
      const embed = new EmbedBuilder()
        .setTitle(`💰 ${priceList.title}`)
        .setColor(0xfee75c)
        .setFooter({ text: priceList.footer })
        .setTimestamp();

      for (const item of priceList.items) {
        embed.addFields({
          name: `${item.name} — ${item.price}`,
          value: item.description ?? "\u200b",
        });
      }

      if (priceList.items.length === 0) {
        embed.setDescription("No prices set yet. An admin can add items with `/pricelist add`.");
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      return;
    }

    if (sub === "add") {
      const name = interaction.options.getString("name", true);
      const price = interaction.options.getString("price", true);
      const description = interaction.options.getString("description") ?? undefined;

      const existing = priceList.items.findIndex((i) => i.name.toLowerCase() === name.toLowerCase());
      if (existing !== -1) {
        priceList.items[existing] = { name, price, description };
      } else {
        priceList.items.push({ name, price, description });
      }
      savePriceList(priceList);
      await interaction.reply({ content: `✅ **${name}** added/updated in the price list.`, ephemeral: true });
      return;
    }

    if (sub === "remove") {
      const name = interaction.options.getString("name", true);
      const before = priceList.items.length;
      priceList.items = priceList.items.filter(
        (i) => i.name.toLowerCase() !== name.toLowerCase()
      );
      if (priceList.items.length === before) {
        await interaction.reply({ content: `❌ Item **${name}** not found.`, ephemeral: true });
        return;
      }
      savePriceList(priceList);
      await interaction.reply({ content: `✅ **${name}** removed from the price list.`, ephemeral: true });
      return;
    }

    if (sub === "edit_title") {
      const title = interaction.options.getString("title");
      const footer = interaction.options.getString("footer");
      if (title) priceList.title = title;
      if (footer) priceList.footer = footer;
      savePriceList(priceList);
      await interaction.reply({ content: "✅ Price list title/footer updated.", ephemeral: true });
    }
  },
};

export default command;
