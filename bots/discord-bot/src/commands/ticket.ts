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

export const TICKET_TYPES: Record<
  string,
  { label: string; emoji: string; description: string; color: number; fields: string }
> = {
  commission: {
    label: "Commission Request",
    emoji: "🎨",
    description: "Request a new commission from Metro Designs.",
    color: 0x5865f2,
    fields:
      "• Type of commission (GFX, UI, logo, etc.)\n• Budget (in Robux)\n• Deadline\n• Reference images / examples",
  },
  revision: {
    label: "Revision Request",
    emoji: "✏️",
    description: "Request changes to an existing commission.",
    color: 0xfee75c,
    fields:
      "• Your original ticket number\n• What needs to be changed\n• Any new references",
  },
  support: {
    label: "General Support",
    emoji: "💬",
    description: "Questions, payment issues, or general help.",
    color: 0x57f287,
    fields:
      "• What do you need help with?\n• Any relevant screenshots or context",
  },
  partnership: {
    label: "Partnership",
    emoji: "🤝",
    description: "Apply for a server partnership with Metro Designs.",
    color: 0xeb459e,
    fields:
      "• Server name & invite link\n• Member count\n• What you offer in return",
  },
  report: {
    label: "Report a User",
    emoji: "🚨",
    description: "Report a scammer, harasser, or rule-breaker.",
    color: 0xed4245,
    fields:
      "• User's Discord tag / ID\n• What happened\n• Evidence (screenshots, messages)",
  },
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
      sub
        .setName("panel")
        .setDescription("Post the ticket panel with all ticket types (admin only)")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to post the panel in (defaults to current channel)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("open")
        .setDescription("Open a commission ticket directly")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Type of ticket")
            .setRequired(false)
            .addChoices(
              { name: "🎨 Commission Request", value: "commission" },
              { name: "✏️ Revision Request", value: "revision" },
              { name: "💬 General Support", value: "support" },
              { name: "🤝 Partnership", value: "partnership" },
              { name: "🚨 Report a User", value: "report" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Brief description of your request")
            .setRequired(false)
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
          opt
            .setName("category")
            .setDescription("Category where tickets will be created")
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName("staff_role")
            .setDescription("Role that can see all tickets")
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("log_channel")
            .setDescription("Channel to log ticket activity")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a user to the current ticket")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to add").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the current ticket")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to remove").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    // ── PANEL ────────────────────────────────────────────────────────────────
    if (sub === "panel") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: "❌ You need Administrator permission to post a ticket panel.",
          ephemeral: true,
        });
        return;
      }

      const targetChannel =
        (interaction.options.getChannel("channel") as TextChannel | null) ??
        (interaction.channel as TextChannel);

      const embed = new EmbedBuilder()
        .setTitle("🎫 Metro Designs — Support & Commissions")
        .setDescription(
          "Welcome! Click the button below that best fits your request and a private ticket will be created just for you.\n\n" +
            Object.values(TICKET_TYPES)
              .map((t) => `${t.emoji} **${t.label}** — ${t.description}`)
              .join("\n")
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Metro Designs • One ticket per type at a time" })
        .setTimestamp();

      // Split buttons across rows (max 5 per row)
      const typeKeys = Object.keys(TICKET_TYPES);
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...typeKeys.slice(0, 3).map((key) => {
          const t = TICKET_TYPES[key];
          return new ButtonBuilder()
            .setCustomId(`ticket_open_${key}`)
            .setLabel(t.label)
            .setEmoji(t.emoji)
            .setStyle(ButtonStyle.Primary);
        })
      );
      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...typeKeys.slice(3).map((key) => {
          const t = TICKET_TYPES[key];
          return new ButtonBuilder()
            .setCustomId(`ticket_open_${key}`)
            .setLabel(t.label)
            .setEmoji(t.emoji)
            .setStyle(
              key === "report" ? ButtonStyle.Danger : ButtonStyle.Secondary
            );
        })
      );

      await targetChannel.send({ embeds: [embed], components: [row1, row2] });
      await interaction.reply({
        content: `✅ Ticket panel posted in ${targetChannel}.`,
        ephemeral: true,
      });
      return;
    }

    // ── SETUP ────────────────────────────────────────────────────────────────
    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: "❌ You need Administrator permission to set up tickets.",
          ephemeral: true,
        });
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
          {
            name: "Category",
            value: config.categoryId ? `<#${config.categoryId}>` : "Not set",
            inline: true,
          },
          {
            name: "Staff Role",
            value: config.staffRoleId ? `<@&${config.staffRoleId}>` : "Not set",
            inline: true,
          },
          {
            name: "Log Channel",
            value: config.logChannelId ? `<#${config.logChannelId}>` : "Not set",
            inline: true,
          }
        )
        .setFooter({ text: "Config is saved persistently — no need to redo on restart" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ── OPEN ─────────────────────────────────────────────────────────────────
    if (sub === "open") {
      const ticketType = interaction.options.getString("type") ?? "commission";
      const reason = interaction.options.getString("reason") ?? undefined;
      await interaction.deferReply({ ephemeral: true });
      const channel = await createTicket(
        interaction,
        interaction.member as GuildMember,
        ticketType,
        reason
      );
      if (channel) {
        await interaction.editReply({ content: `✅ Ticket opened: ${channel}` });
      }
      return;
    }

    // ── CLOSE ────────────────────────────────────────────────────────────────
    if (sub === "close") {
      const channel = interaction.channel as TextChannel;
      if (!isTicketChannel(channel.name)) {
        await interaction.reply({
          content: "❌ This command can only be used inside a ticket channel.",
          ephemeral: true,
        });
        return;
      }
      await closeTicket(interaction, channel);
      return;
    }

    // ── ADD ──────────────────────────────────────────────────────────────────
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

    // ── REMOVE ───────────────────────────────────────────────────────────────
    if (sub === "remove") {
      const channel = interaction.channel as TextChannel;
      const user = interaction.options.getUser("user", true);
      await channel.permissionOverwrites.delete(user);
      await interaction.reply({ content: `✅ Removed ${user} from this ticket.` });
      return;
    }
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTicketChannel(name: string): boolean {
  return Object.keys(TICKET_TYPES).some((key) => name.startsWith(`${key}-`)) || name.startsWith("ticket-");
}

async function createTicket(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  member: GuildMember,
  ticketType: string,
  reason?: string
): Promise<TextChannel | null> {
  const config = getConfig();
  const guild = interaction.guild!;
  const typeInfo = TICKET_TYPES[ticketType] ?? TICKET_TYPES["commission"];

  // Check for existing open ticket of this type
  const existingKey = `${member.id}_${ticketType}`;
  if (config.openTickets[existingKey]) {
    const existingChannel = guild.channels.cache.get(config.openTickets[existingKey]);
    if (existingChannel) {
      const msg = `❌ You already have an open **${typeInfo.label}** ticket: ${existingChannel}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
      return null;
    }
    delete config.openTickets[existingKey];
    saveConfig(config);
  }

  config.counter += 1;
  const ticketName = `${ticketType}-${config.counter.toString().padStart(4, "0")}`;

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
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
      ],
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
    topic: `${typeInfo.label} | ${member.user.tag} | ${reason ?? "No reason provided"}`,
  })) as TextChannel;

  config.openTickets[existingKey] = channel.id;
  saveConfig(config);

  const embed = new EmbedBuilder()
    .setTitle(`${typeInfo.emoji} ${typeInfo.label}`)
    .setDescription(
      `Welcome, ${member}! A staff member will be with you shortly.\n\n` +
        (reason ? `**Your request:** ${reason}\n\n` : "") +
        `**Please provide:**\n${typeInfo.fields}`
    )
    .setColor(typeInfo.color)
    .setFooter({ text: `Ticket #${config.counter.toString().padStart(4, "0")} • Metro Designs` })
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

  await channel.send({ content: `${member} | <@&${config.staffRoleId ?? guild.id}>`, embeds: [embed], components: [row] });

  // Log
  if (config.logChannelId) {
    const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket Opened — ${typeInfo.label}`)
        .setColor(typeInfo.color)
        .addFields(
          { name: "User", value: `${member} (${member.user.tag})`, inline: true },
          { name: "Channel", value: `${channel}`, inline: true },
          { name: "Type", value: `${typeInfo.emoji} ${typeInfo.label}`, inline: true },
          { name: "Reason", value: reason ?? "Not provided" }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  }

  return channel;
}

async function closeTicket(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  channel: TextChannel
) {
  const config = getConfig();
  const guild = channel.guild;

  // Remove from open tickets
  for (const [key, channelId] of Object.entries(config.openTickets)) {
    if (channelId === channel.id) {
      delete config.openTickets[key];
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
        .addFields(
          { name: "Channel", value: channel.name },
          { name: "Closed by", value: `${interaction.user}` }
        )
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

// ── Exported button handlers ──────────────────────────────────────────────────

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

export async function handleTicketOpen(interaction: ButtonInteraction, ticketType: string) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.member as GuildMember;
  const channel = await createTicket(interaction, member, ticketType);
  if (channel) {
    await interaction.editReply({ content: `✅ Your **${TICKET_TYPES[ticketType]?.label ?? ticketType}** ticket has been created: ${channel}` });
  }
}

export default command;
