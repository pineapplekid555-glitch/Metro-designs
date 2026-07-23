import { GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { readJSON, writeJSON } from "../data/store";

interface WelcomeConfig {
  channelId: string | null;
  message: string;
  enabled: boolean;
}

const DEFAULT: WelcomeConfig = {
  channelId: null,
  message: "Welcome to **{server}**, {user}! 🎉\n\nWe're a Roblox GFX commissions server. Check out our price list with `/pricelist view` and open a ticket with `/ticket open` to get started!",
  enabled: true,
};

export function getWelcomeConfig(): WelcomeConfig {
  return readJSON<WelcomeConfig>("welcome.json", DEFAULT);
}

export function saveWelcomeConfig(d: WelcomeConfig) {
  writeJSON("welcome.json", d);
}

export async function sendWelcome(member: GuildMember) {
  const config = getWelcomeConfig();
  if (!config.enabled || !config.channelId) return;

  const channel = member.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel) return;

  const msg = config.message
    .replace("{user}", `${member}`)
    .replace("{server}", member.guild.name)
    .replace("{username}", member.user.username);

  const embed = new EmbedBuilder()
    .setTitle(`👋 Welcome to ${member.guild.name}!`)
    .setDescription(msg)
    .setColor(0x5865f2)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}
