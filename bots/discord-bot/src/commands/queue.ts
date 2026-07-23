import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface QueueEntry {
  userId: string;
  username: string;
  commission: string;
  addedAt: string;
  position: number;
}

function getQueue(): QueueEntry[] {
  return readJSON<QueueEntry[]>("queue.json", []);
}

function saveQueue(q: QueueEntry[]) {
  writeJSON("queue.json", q);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Commission queue")
    .addSubcommand((sub) => sub.setName("view").setDescription("View the current commission queue"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add someone to the queue (staff only)")
        .addUserOption((opt) => opt.setName("client").setDescription("Client to add").setRequired(true))
        .addStringOption((opt) => opt.setName("commission").setDescription("Commission details").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove someone from the queue (staff only)")
        .addUserOption((opt) => opt.setName("client").setDescription("Client to remove").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("next").setDescription("Mark the first queue entry as done and move everyone up (staff only)")
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Clear the entire queue (admin only)")
    )
    .addSubcommand((sub) =>
      sub.setName("check").setDescription("Check your position in the queue")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    let queue = getQueue();

    if (sub === "view") {
      const embed = new EmbedBuilder()
        .setTitle("📋 Commission Queue")
        .setColor(0x5865f2)
        .setFooter({ text: `${queue.length} commission(s) in queue` })
        .setTimestamp();

      if (queue.length === 0) {
        embed.setDescription("✅ The queue is empty! Open a ticket to get started.");
      } else {
        embed.setDescription(
          queue
            .map(
              (e, i) =>
                `**${i + 1}.** <@${e.userId}> — ${e.commission}\n> Added <t:${Math.floor(new Date(e.addedAt).getTime() / 1000)}:R>`
            )
            .join("\n\n")
        );
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "check") {
      const pos = queue.findIndex((e) => e.userId === interaction.user.id);
      if (pos === -1) {
        await interaction.reply({ content: "❌ You are not in the commission queue.", ephemeral: true });
        return;
      }
      const entry = queue[pos];
      const embed = new EmbedBuilder()
        .setTitle("📋 Your Queue Position")
        .setColor(0x5865f2)
        .addFields(
          { name: "Position", value: `#${pos + 1} out of ${queue.length}`, inline: true },
          { name: "Commission", value: entry.commission },
          { name: "Added", value: `<t:${Math.floor(new Date(entry.addedAt).getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      return;
    }

    if (sub === "add") {
      const client = interaction.options.getUser("client", true);
      const commission = interaction.options.getString("commission", true);

      if (queue.find((e) => e.userId === client.id)) {
        await interaction.reply({ content: `❌ ${client} is already in the queue.`, ephemeral: true });
        return;
      }

      queue.push({
        userId: client.id,
        username: client.tag,
        commission,
        addedAt: new Date().toISOString(),
        position: queue.length + 1,
      });
      saveQueue(queue);

      // Notify the client
      try {
        await client.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("📋 Added to Commission Queue")
              .setDescription(`You've been added to Metro Designs' commission queue!`)
              .setColor(0x5865f2)
              .addFields(
                { name: "Position", value: `#${queue.length}`, inline: true },
                { name: "Commission", value: commission }
              )
              .setFooter({ text: "Metro Designs" })
              .setTimestamp(),
          ],
        });
      } catch { /* DMs off */ }

      await interaction.reply({ content: `✅ Added ${client} to the queue at position #${queue.length}.` });
      return;
    }

    if (sub === "remove") {
      const client = interaction.options.getUser("client", true);
      const before = queue.length;
      queue = queue.filter((e) => e.userId !== client.id);
      if (queue.length === before) {
        await interaction.reply({ content: `❌ ${client} is not in the queue.`, ephemeral: true });
        return;
      }
      saveQueue(queue);
      await interaction.reply({ content: `✅ Removed ${client} from the queue.` });
      return;
    }

    if (sub === "next") {
      if (queue.length === 0) {
        await interaction.reply({ content: "📭 The queue is empty.", ephemeral: true });
        return;
      }
      const done = queue.shift()!;
      saveQueue(queue);

      // Notify the completed client
      try {
        const doneUser = await interaction.client.users.fetch(done.userId);
        await doneUser.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎉 Your Commission is Up!")
              .setDescription("You're next! A staff member will reach out to you shortly.")
              .setColor(0x57f287)
              .setFooter({ text: "Metro Designs" })
              .setTimestamp(),
          ],
        });
      } catch { /* DMs off */ }

      // Notify #1 in queue
      if (queue.length > 0) {
        try {
          const nextUser = await interaction.client.users.fetch(queue[0].userId);
          await nextUser.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("📋 Queue Update")
                .setDescription("You are now **#1** in the Metro Designs commission queue!")
                .setColor(0xfee75c)
                .setFooter({ text: "Metro Designs" })
                .setTimestamp(),
            ],
          });
        } catch { /* DMs off */ }
      }

      await interaction.reply({
        content: `✅ Removed **${done.username}** from the top of the queue. ${queue.length} remaining.`,
      });
      return;
    }

    if (sub === "clear") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
        return;
      }
      saveQueue([]);
      await interaction.reply({ content: "✅ Queue cleared." });
    }
  },
};

export default command;
