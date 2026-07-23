import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { BotCommand } from "../types";

const TAX_RATE = 0.30;

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("tax")
    .setDescription("Roblox tax calculator — figure out what to charge so you get the right amount")
    .addSubcommand((sub) =>
      sub
        .setName("charge")
        .setDescription("How much should I charge so I receive X Robux after tax?")
        .addIntegerOption((opt) =>
          opt.setName("amount").setDescription("Amount you want to RECEIVE (after tax)").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("receive")
        .setDescription("How much will I receive if I charge X Robux?")
        .addIntegerOption((opt) =>
          opt.setName("amount").setDescription("Amount you plan to CHARGE (before tax)").setRequired(true).setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const amount = interaction.options.getInteger("amount", true);

    let chargeAmount: number;
    let receiveAmount: number;
    let title: string;
    let description: string;

    if (sub === "charge") {
      // User wants to receive X → charge X / (1 - 0.30) = X / 0.70
      receiveAmount = amount;
      chargeAmount = Math.ceil(amount / (1 - TAX_RATE));
      title = "💸 What to Charge";
      description = `To **receive ${receiveAmount.toLocaleString()} R$** after the 30% Roblox tax, you should charge:`;
    } else {
      // User charges X → receives X * 0.70
      chargeAmount = amount;
      receiveAmount = Math.floor(amount * (1 - TAX_RATE));
      title = "💰 What You'll Receive";
      description = `If you charge **${chargeAmount.toLocaleString()} R$**, after the 30% Roblox tax you will receive:`;
    }

    const taxTaken = chargeAmount - receiveAmount;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x00b4d8)
      .addFields(
        { name: "🏷️ Charge Client", value: `**${chargeAmount.toLocaleString()} R$**`, inline: true },
        { name: "✅ You Receive", value: `**${receiveAmount.toLocaleString()} R$**`, inline: true },
        { name: "🏦 Roblox Takes", value: `**${taxTaken.toLocaleString()} R$**`, inline: true }
      )
      .setFooter({ text: `Tax rate: ${(TAX_RATE * 100).toFixed(0)}% • Metro Designs` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
