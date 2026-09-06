import {
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

import {
  ensureGuildSettings,
  getActiveNpcCount,
} from "./db.js";

export const npcCommand = {
  data: new SlashCommandBuilder()
    .setName("npc")
    .setDescription("NPC simulator commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Check the NPC simulator status")
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used inside a Discord server.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      await interaction.deferReply({ ephemeral: true });

      const settings = await ensureGuildSettings(interaction.guildId);
      const activeCount = await getActiveNpcCount(interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle("NPC Simulator Status")
        .setDescription("The NPC bot foundation is connected and ready.")
        .addFields(
          {
            name: "Discord",
            value: "Connected",
            inline: true,
          },
          {
            name: "Supabase",
            value: "Connected",
            inline: true,
          },
          {
            name: "Simulation",
            value: settings.simulation_paused ? "Paused" : "Running",
            inline: true,
          },
          {
            name: "Timezone",
            value: settings.timezone || "America/Chicago",
            inline: true,
          },
          {
            name: "Active NPCs",
            value: `${activeCount} / ${settings.max_active_npcs ?? 15}`,
            inline: true,
          },
          {
            name: "Pregnancy Rule",
            value: `${settings.pregnancy_days ?? 21} days`,
            inline: true,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
