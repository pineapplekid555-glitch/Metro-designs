import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface Review {
  id: string;
  userId: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewData {
  reviews: Review[];
  channelId: string | null;
}

const DEFAULT: ReviewData = { reviews: [], channelId: null };

function getData(): ReviewData {
  return readJSON<ReviewData>("reviews.json", DEFAULT);
}

function saveData(d: ReviewData) {
  writeJSON("reviews.json", d);
}

const STARS: Record<number, string> = {
  1: "⭐",
  2: "⭐⭐",
  3: "⭐⭐⭐",
  4: "⭐⭐⭐⭐",
  5: "⭐⭐⭐⭐⭐",
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("review")
    .setDescription("Leave or view reviews for Metro Designs")
    .addSubcommand((sub) =>
      sub
        .setName("leave")
        .setDescription("Leave a review for your commission")
        .addIntegerOption((opt) =>
          opt
            .setName("rating")
            .setDescription("Rating from 1 to 5 stars")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addStringOption((opt) =>
          opt.setName("comment").setDescription("Your review comment").setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View recent reviews")
        .addIntegerOption((opt) =>
          opt.setName("count").setDescription("How many to show (default 5)").setRequired(false).setMinValue(1).setMaxValue(20)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set the channel where reviews are posted (admin only)")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Review channel").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a review by ID (admin only)")
        .addStringOption((opt) => opt.setName("id").setDescription("Review ID").setRequired(true))
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
      await interaction.reply({ content: `✅ Reviews will be posted to <#${channel.id}>.`, ephemeral: true });
      return;
    }

    if (sub === "leave") {
      const rating = interaction.options.getInteger("rating", true);
      const comment = interaction.options.getString("comment", true);

      const id = Date.now().toString(36).toUpperCase();
      const review: Review = {
        id,
        userId: interaction.user.id,
        username: interaction.user.tag,
        rating,
        comment,
        createdAt: new Date().toISOString(),
      };
      data.reviews.push(review);
      saveData(data);

      const embed = new EmbedBuilder()
        .setTitle(`${STARS[rating]} New Review`)
        .setDescription(`> ${comment}`)
        .setColor(rating >= 4 ? 0x57f287 : rating === 3 ? 0xfee75c : 0xed4245)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .addFields({ name: "Rating", value: STARS[rating], inline: true }, { name: "Review ID", value: id, inline: true })
        .setTimestamp();

      // Post to reviews channel
      if (data.channelId && interaction.guild) {
        const reviewChannel = interaction.guild.channels.cache.get(data.channelId) as TextChannel | undefined;
        if (reviewChannel) {
          await reviewChannel.send({ embeds: [embed] });
        }
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "list") {
      const count = interaction.options.getInteger("count") ?? 5;
      const recent = [...data.reviews].reverse().slice(0, count);

      if (recent.length === 0) {
        await interaction.reply({ content: "📭 No reviews yet.", ephemeral: true });
        return;
      }

      const avg = data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length;

      const embed = new EmbedBuilder()
        .setTitle("⭐ Metro Designs — Reviews")
        .setColor(0xfee75c)
        .setDescription(
          recent
            .map((r) => `${STARS[r.rating]} **${r.username}**\n> ${r.comment.slice(0, 120)}`)
            .join("\n\n")
        )
        .setFooter({ text: `Average: ${avg.toFixed(1)}/5 ⭐ from ${data.reviews.length} review(s)` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
        return;
      }
      const id = interaction.options.getString("id", true);
      const before = data.reviews.length;
      data.reviews = data.reviews.filter((r) => r.id !== id);
      if (data.reviews.length === before) {
        await interaction.reply({ content: `❌ Review ID \`${id}\` not found.`, ephemeral: true });
        return;
      }
      saveData(data);
      await interaction.reply({ content: `✅ Review \`${id}\` deleted.`, ephemeral: true });
    }
  },
};

export default command;
