import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  ButtonInteraction,
  TextChannel,
  GuildMember,
  OverwriteType,
} from "discord.js";
import { BotCommand } from "../types";
import { readJSON, writeJSON } from "../data/store";

interface TicketConfig {
  categoryId: string | null;
  staffRoleId: string | null;
  logChannelId: string | null;
  counter: number;
  openTickets: Record<string, string>; // userId → channelId
}

const DEFAULT_CONFIG: TicketConfig = {
  categoryId: null,
  staffRoleId: null,
  logChannelId: null,
  counter: 0,
  openTickets: {},
};

function getConfig(): TicketConfig {
  return readJSON<TicketConfig>("tickets.json", DEFAULT_CONFIG);
}

function saveConfig(config: TicketConfig) {
  writeJSON("tickets.json", config);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Commission ticket system")
    .addSubcommand((sub) =>
      sub.setName("open").setDescription("Open a new commission ticket")
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("What commission are you requesting?").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("close").setDescription("Close the current ticket")
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure the ticket system (admin only)")
        .addChannelOption((opt) =>
          opt.setName("category").setDescription("Category where tickets will be created").setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName("staff_role").setDescription("Role that can see all tickets").setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName("log_channel").setDescription("Channel to log ticket activity").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("add").setDescription("Add a user to the current ticket")
        .addUserOption((opt) => opt.setName("user").setDescription("User to add").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("remove").setDescription("Remove a user from the current ticket")
        .addUserOption((opt) => opt.setName("user").setDescription("User to remove").setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ You need Administrator permission to set up tickets.", ephemeral: true });
        return;
      }
      const config = getConfig();
      const category = interaction.options.getChannel("category");
      const staffRole = interaction.options.getRole("staff_role");
      const logChannel = interaction.options.getChannel("log_channel");

      if (category) config.categoryId = category.id;
      if (staffRole) config.staffRoleId = staffRole.id;
      if (logChannel) config.logChannelId = logChannel.id;
      saveConfig(config);

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket System Configured")
        .setColor(0x57f287)
        .addFields(
          { name: "Category", value: config.categoryId ? `<#${config.categoryId}>` : "Not set", inline: true },
          { name: "Staff Role", value: config.staffRoleId ? `<@&${config.staffRoleId}>` : "Not set", inline: true },
          { name: "Log Channel", value: config.logChannelId ? `<#${config.logChannelId}>` : "Not set", inline: true }
        )
        .setFooter({ text: "Config is saved persistently — no need to redo on restart" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (sub === "open") {
      const config = getConfig();
      const guild = interaction.guild!;
      const member = interaction.member as GuildMember;
      const reason = interaction.options.getString("reason") ?? "No reason provided";

      // Check if user already has an open ticket
      if (config.openTickets[member.id]) {
        const existingChannel = guild.channels.cache.get(config.openTickets[member.id]);
        if (existingChannel) {
          await interaction.reply({
            content: `❌ You already have an open ticket: ${existingChannel}`,
            ephemeral: true,
          });
          return;
        }
        // Channel was deleted, clean up
        delete config.openTickets[member.id];
        saveConfig(config);
      }

      await interaction.deferReply({ ephemeral: true });

      config.counter += 1;
      const ticketName = `ticket-${config.counter.toString().padStart(4, "0")}`;

      const permissionOverwrites: {
        id: string;
        type: OverwriteType;
        allow?: bigint[];
        deny?: bigint[];
      }[] = [
        {
          id: guild.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          type: OverwriteType.Member,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
        },
      ];

      if (config.staffRoleId) {
        permissionOverwrites.push({
          id: config.staffRoleId,
          type: OverwriteType.Role,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
          ],
        });
      }

      const channel = (await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: config.categoryId ?? undefined,
        permissionOverwrites,
        topic: `Commission ticket for ${member.user.tag} | Reason: ${reason}`,
      })) as TextChannel;

      config.openTickets[member.id] = channel.id;
      saveConfig(config);

      const embed = new EmbedBuilder()
        .setTitle("🎫 Commission Ticket")
        .setDescription(`Welcome, ${member}! Please describe your commission in detail.\n\n**Reason:** ${reason}`)
        .setColor(0x5865f2)
        .addFields(
          { name: "📋 What to include", value: "• Type of commission\n• Budget (in Robux)\n• Deadline\n• Reference images" }
        )
        .setTimestamp();

      const closeBtn = new ButtonBuilder()
        .setCustomId(`ticket_close_${channel.id}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒");

      const claimBtn = new ButtonBuilder()
        .setCustomId(`ticket_claim_${channel.id}`)
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✋");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimBtn, closeBtn);

      await channel.send({ embeds: [embed], components: [row] });

      // Log if configured
      if (config.logChannelId) {
        const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle("🎫 Ticket Opened")
            .setColor(0x57f287)
            .addFields(
              { name: "User", value: `${member} (${member.user.tag})`, inline: true },
              { name: "Channel", value: `${channel}`, inline: true },
              { name: "Reason", value: reason }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      }

      await interaction.editReply({ content: `✅ Ticket opened: ${channel}` });
      return;
    }

    if (sub === "close") {
      const channel = interaction.channel as TextChannel;
      if (!channel.name.startsWith("ticket-")) {
        await interaction.reply({ content: "❌ This command can only be used inside a ticket channel.", ephemeral: true });
        return;
      }
      await closeTicket(interaction, channel);
      return;
    }

    if (sub === "add") {
      const channel = interaction.channel as TextChannel;
      const user = interaction.options.getUser("user", true);
      await channel.permissionOverwrites.create(user, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
      });
      await interaction.reply({ content: `✅ Added ${user} to this ticket.` });
      return;
    }

    if (sub === "remove") {
      const channel = interaction.channel as TextChannel;
      const user = interaction.options.getUser("user", true);
      await channel.permissionOverwrites.delete(user);
      await interaction.reply({ content: `✅ Removed ${user} from this ticket.` });
      return;
    }
  },
};

async function closeTicket(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  channel: TextChannel
) {
  const config = getConfig();
  const guild = channel.guild;

  // Remove from open tickets
  for (const [userId, channelId] of Object.entries(config.openTickets)) {
    if (channelId === channel.id) {
      delete config.openTickets[userId];
      break;
    }
  }
  saveConfig(config);

  // Log
  if (config.logChannelId) {
    const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Closed")
        .setColor(0xed4245)
        .addFields({ name: "Channel", value: channel.name }, { name: "Closed by", value: `${interaction.user}` })
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🔒 Ticket Closing")
    .setDescription("This ticket will be deleted in 5 seconds.")
    .setColor(0xed4245)
    .setTimestamp();

  if (interaction.replied || interaction.deferred) {
    await channel.send({ embeds: [embed] });
  } else {
    await interaction.reply({ embeds: [embed] });
  }

  setTimeout(() => channel.delete("Ticket closed").catch(() => {}), 5000);
}

export async function handleTicketClose(interaction: ButtonInteraction) {
  const channel = interaction.channel as TextChannel;
  await closeTicket(interaction as unknown as ChatInputCommandInteraction, channel);
}

export async function handleTicketClaim(interaction: ButtonInteraction) {
  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;

  await channel.permissionOverwrites.create(member, {
    ViewChannel: true,
    SendMessages: true,
    ManageMessages: true,
    AttachFiles: true,
  });

  await interaction.reply({ content: `✋ ${member} has claimed this ticket!` });
}

export default command;
