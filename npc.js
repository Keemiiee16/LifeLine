import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";

import {
  ensureGuildSettings,
  getActiveNpcCount,
  supabase,
} from "./db.js";

const CREATE_FLOW_PREFIX = "npc_create";
const EDIT_FLOW_PREFIX = "npc_edit";
const SETTINGS_PREFIX = "npc_settings";
const WORLD_PREFIX = "npc_world";

export const npcCommand = {
  data: new SlashCommandBuilder()
    .setName("npc")
    .setDescription("LifeLine NPC simulator commands")

    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Check the NPC simulator status")
    )

    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new NPC with guided pop-out setup")
    )

    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing NPC")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("NPC name to edit")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View an NPC profile")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("NPC name")
            .setRequired(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("search")
        .setDescription("Search NPCs")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Name, neighborhood, job, school, life stage, etc.")
            .setRequired(false)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("settings")
        .setDescription("Open LifeLine server settings")
    )

    .addSubcommand((sub) =>
      sub
        .setName("pause")
        .setDescription("Pause the whole simulator, one NPC, or one location")
        .addStringOption((opt) =>
          opt
            .setName("scope")
            .setDescription("What should be paused?")
            .setRequired(true)
            .addChoices(
              { name: "Entire Simulator", value: "server" },
              { name: "One NPC", value: "npc" },
              { name: "One Neighborhood/Location", value: "location" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("target")
            .setDescription("NPC or location name when needed")
            .setRequired(false)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName("undo")
        .setDescription("Undo the most recent undoable major NPC event")
    )

    .addSubcommandGroup((group) =>
      group
        .setName("world")
        .setDescription("World/location setup")
        .addSubcommand((sub) =>
          sub
            .setName("setup")
            .setDescription("Scan and classify Discord channels/categories")
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used inside a Discord server.",
        ephemeral: true,
      });
    }

    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (group === "world" && subcommand === "setup") {
      return openWorldSetup(interaction);
    }

    if (subcommand === "status") return showStatus(interaction);
    if (subcommand === "create") return startCreate(interaction);
    if (subcommand === "edit") return startEdit(interaction);
    if (subcommand === "view") return viewNpc(interaction);
    if (subcommand === "search") return searchNpcs(interaction);
    if (subcommand === "settings") return openSettings(interaction);
    if (subcommand === "pause") return pauseSystem(interaction);
    if (subcommand === "undo") return undoLast(interaction);
  },
};

async function showStatus(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const settings = await ensureGuildSettings(interaction.guildId);
  const activeCount = await getActiveNpcCount(interaction.guildId);

  const embed = new EmbedBuilder()
    .setTitle("LifeLine NPC Simulator")
    .setDescription("The NPC simulation system is connected and ready.")
    .addFields(
      { name: "Discord", value: "✅ Connected", inline: true },
      { name: "Supabase", value: "✅ Connected", inline: true },
      {
        name: "Simulation",
        value: settings.simulation_paused ? "⏸️ Paused" : "▶️ Running",
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

  return interaction.editReply({ embeds: [embed] });
}

async function startCreate(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`${CREATE_FLOW_PREFIX}:basic`)
    .setTitle("Create NPC • Basic Information");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("NPC Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80);

  const age = new TextInputBuilder()
    .setCustomId("age")
    .setLabel("Actual Age")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3);

  const pronouns = new TextInputBuilder()
    .setCustomId("pronouns")
    .setLabel("Pronouns (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(40);

  const birthday = new TextInputBuilder()
    .setCustomId("birthday")
    .setLabel("Birthday (optional, MM/DD/YYYY or MM/DD)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(10);

  const description = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Short Description (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(age),
    new ActionRowBuilder().addComponents(pronouns),
    new ActionRowBuilder().addComponents(birthday),
    new ActionRowBuilder().addComponents(description)
  );

  return interaction.showModal(modal);
}

async function startEdit(interaction) {
  const npcName = interaction.options.getString("name", true);

  const { data, error } = await supabase
    .from("npc_profiles")
    .select("*")
    .eq("guild_id", interaction.guildId)
    .ilike("name", npcName)
    .limit(1)
    .maybeSingle();

  if (error) {
    return interaction.reply({
      content: `Could not load that NPC: ${error.message}`,
      ephemeral: true,
    });
  }

  if (!data) {
    return interaction.reply({
      content: `I couldn't find an NPC named **${npcName}**.`,
      ephemeral: true,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${EDIT_FLOW_PREFIX}:section:${data.id}`)
    .setPlaceholder("Choose what to edit")
    .addOptions(
      { label: "Basic Information", value: "basic" },
      { label: "Personality", value: "personality" },
      { label: "Likes & Habits", value: "likes" },
      { label: "Home & Neighborhood", value: "home" },
      { label: "School", value: "school" },
      { label: "Job", value: "job" },
      { label: "Transportation", value: "transport" },
      { label: "Family", value: "family" },
      { label: "Relationships", value: "relationships" },
      { label: "AI Personality", value: "ai" },
      { label: "Autonomy", value: "autonomy" },
      { label: "Life Settings", value: "life" }
    );

  return interaction.reply({
    content: `Editing **${data.name}**`,
    components: [new ActionRowBuilder().addComponents(menu)],
    ephemeral: true,
  });
}

async function viewNpc(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const npcName = interaction.options.getString("name", true);

  const { data, error } = await supabase
    .from("npc_profiles")
    .select(`
      *,
      npc_transportation(*),
      npc_finances(*)
    `)
    .eq("guild_id", interaction.guildId)
    .ilike("name", npcName)
    .limit(1)
    .maybeSingle();

  if (error) {
    return interaction.editReply(`Could not load NPC: ${error.message}`);
  }

  if (!data) {
    return interaction.editReply(`I couldn't find an NPC named **${npcName}**.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(data.name)
    .setDescription(data.short_description || "No description set.")
    .addFields(
      {
        name: "Age",
        value: `${data.display_age} • ${pretty(data.life_stage)}`,
        inline: true,
      },
      {
        name: "Importance",
        value: pretty(data.importance),
        inline: true,
      },
      {
        name: "Activity",
        value: pretty(data.activity_level),
        inline: true,
      },
      {
        name: "Status",
        value: pretty(data.status),
        inline: true,
      },
      {
        name: "Pronouns",
        value: data.pronouns || "Not set",
        inline: true,
      },
      {
        name: "Romance",
        value: data.romance_enabled ? "Enabled" : "Disabled",
        inline: true,
      }
    )
    .setTimestamp();

  if (data.avatar_url) embed.setThumbnail(data.avatar_url);

  return interaction.editReply({ embeds: [embed] });
}

async function searchNpcs(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const query = interaction.options.getString("query")?.trim();

  let request = supabase
    .from("npc_profiles")
    .select("id,name,display_age,life_stage,status,importance")
    .eq("guild_id", interaction.guildId)
    .order("name", { ascending: true })
    .limit(25);

  if (query) {
    request = request.or(
      `name.ilike.%${query}%,life_stage.ilike.%${query}%,status.ilike.%${query}%,importance.ilike.%${query}%`
    );
  }

  const { data, error } = await request;

  if (error) {
    return interaction.editReply(`Search failed: ${error.message}`);
  }

  if (!data?.length) {
    return interaction.editReply("No NPCs matched that search.");
  }

  const lines = data.map(
    (npc) =>
      `• **${npc.name}** — ${npc.display_age}, ${pretty(npc.life_stage)} • ${pretty(npc.status)}`
  );

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("NPC Search")
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Showing up to ${data.length} result(s)` }),
    ],
  });
}

async function openSettings(interaction) {
  const settings = await ensureGuildSettings(interaction.guildId);

  const toggleButton = new ButtonBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:toggle_simulation`)
    .setLabel(settings.simulation_paused ? "Turn Simulation ON" : "Turn Simulation OFF")
    .setStyle(
      settings.simulation_paused
        ? ButtonStyle.Success
        : ButtonStyle.Danger
    );

  const lifeChannel = new ButtonBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:life_channel`)
    .setLabel("Set Life Updates Channel")
    .setStyle(ButtonStyle.Primary);

  const adminChannel = new ButtonBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:admin_channel`)
    .setLabel("Set Admin Notifications")
    .setStyle(ButtonStyle.Secondary);

  const timezone = new ButtonBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:timezone`)
    .setLabel("Set Server Timezone")
    .setStyle(ButtonStyle.Secondary);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("LifeLine Settings")
        .setDescription(
          `Simulation: **${settings.simulation_paused ? "OFF" : "ON"}**\n` +
          `Timezone: **${settings.timezone}**\n` +
          `Maximum active NPCs: **${settings.max_active_npcs}/15**`
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(toggleButton),
      new ActionRowBuilder().addComponents(lifeChannel, adminChannel),
      new ActionRowBuilder().addComponents(timezone),
    ],
    ephemeral: true,
  });
}

async function openWorldSetup(interaction) {
  const scan = new ButtonBuilder()
    .setCustomId(`${WORLD_PREFIX}:scan`)
    .setLabel("Scan Server")
    .setStyle(ButtonStyle.Primary);

  const review = new ButtonBuilder()
    .setCustomId(`${WORLD_PREFIX}:review`)
    .setLabel("Review Locations")
    .setStyle(ButtonStyle.Secondary);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("World Setup")
        .setDescription(
          "LifeLine can scan the categories and channels it can access, " +
          "then build the NPC world location registry."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(scan, review),
    ],
    ephemeral: true,
  });
}

async function pauseSystem(interaction) {
  const scope = interaction.options.getString("scope", true);
  const target = interaction.options.getString("target");

  if (scope === "server") {
    const settings = await ensureGuildSettings(interaction.guildId);
    const newValue = !settings.simulation_paused;

    const { error } = await supabase
      .from("npc_guild_settings")
      .update({ simulation_paused: newValue })
      .eq("guild_id", interaction.guildId);

    if (error) {
      return interaction.reply({
        content: `Could not update simulator: ${error.message}`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: newValue
        ? "⏸️ The entire NPC simulator is now paused."
        : "▶️ The entire NPC simulator is running again.",
      ephemeral: true,
    });
  }

  if (!target) {
    return interaction.reply({
      content: "You need to provide a target name for that pause scope.",
      ephemeral: true,
    });
  }

  if (scope === "npc") {
    const { data, error } = await supabase
      .from("npc_profiles")
      .select("id,name,status")
      .eq("guild_id", interaction.guildId)
      .ilike("name", target)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return interaction.reply({
        content: error
          ? `Could not load NPC: ${error.message}`
          : `I couldn't find **${target}**.`,
        ephemeral: true,
      });
    }

    const nextStatus = data.status === "paused" ? "active" : "paused";

    const { error: updateError } = await supabase
      .from("npc_profiles")
      .update({ status: nextStatus })
      .eq("id", data.id);

    if (updateError) {
      return interaction.reply({
        content: `Could not update NPC: ${updateError.message}`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      content:
        nextStatus === "paused"
          ? `⏸️ **${data.name}** is now paused.`
          : `▶️ **${data.name}** is active again.`,
      ephemeral: true,
    });
  }

  if (scope === "location") {
    const { data, error } = await supabase
      .from("npc_world_locations")
      .select("id,name,paused")
      .eq("guild_id", interaction.guildId)
      .ilike("name", target)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return interaction.reply({
        content: error
          ? `Could not load location: ${error.message}`
          : `I couldn't find **${target}** in the world registry.`,
        ephemeral: true,
      });
    }

    const nextPaused = !data.paused;

    const { error: updateError } = await supabase
      .from("npc_world_locations")
      .update({ paused: nextPaused })
      .eq("id", data.id);

    if (updateError) {
      return interaction.reply({
        content: `Could not update location: ${updateError.message}`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: nextPaused
        ? `⏸️ **${data.name}** is now paused for autonomous NPC activity.`
        : `▶️ **${data.name}** is active again.`,
      ephemeral: true,
    });
  }
}

async function undoLast(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { data, error } = await supabase
    .from("npc_audit_log")
    .select("*")
    .eq("guild_id", interaction.guildId)
    .eq("undoable", true)
    .eq("undone", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return interaction.editReply(`Could not check undo history: ${error.message}`);
  }

  if (!data) {
    return interaction.editReply("There are no recent undoable NPC events.");
  }

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Undo Available")
        .setDescription(
          `**${data.description || data.action_type}**\n\n` +
          "The audit record is ready. Full automatic state restoration " +
          "will be connected when the life-event engine is added."
        ),
    ],
  });
}

export async function handleNpcComponent(interaction) {
  const id = interaction.customId;

  if (interaction.isModalSubmit() && id === `${CREATE_FLOW_PREFIX}:basic`) {
    return handleCreateBasic(interaction);
  }

  if (interaction.isStringSelectMenu() && id.startsWith(`${EDIT_FLOW_PREFIX}:section:`)) {
    return handleEditSectionChoice(interaction);
  }

  if (interaction.isButton() && id === `${SETTINGS_PREFIX}:toggle_simulation`) {
    return toggleSimulationButton(interaction);
  }

  if (interaction.isButton() && id === `${SETTINGS_PREFIX}:life_channel`) {
    return openChannelPicker(interaction, "life");
  }

  if (interaction.isButton() && id === `${SETTINGS_PREFIX}:admin_channel`) {
    return openChannelPicker(interaction, "admin");
  }

  if (interaction.isButton() && id === `${SETTINGS_PREFIX}:timezone`) {
    return openTimezoneModal(interaction);
  }

  if (interaction.isChannelSelectMenu() && id.startsWith(`${SETTINGS_PREFIX}:channel:`)) {
    return saveSettingsChannel(interaction);
  }

  if (interaction.isModalSubmit() && id === `${SETTINGS_PREFIX}:timezone_modal`) {
    return saveTimezone(interaction);
  }

  if (interaction.isButton() && id === `${WORLD_PREFIX}:scan`) {
    return scanWorld(interaction);
  }

  if (interaction.isButton() && id === `${WORLD_PREFIX}:review`) {
    return reviewWorld(interaction);
  }
}

async function handleCreateBasic(interaction) {
  const name = interaction.fields.getTextInputValue("name").trim();
  const ageRaw = interaction.fields.getTextInputValue("age").trim();
  const pronouns = interaction.fields.getTextInputValue("pronouns").trim();
  const birthday = interaction.fields.getTextInputValue("birthday").trim();
  const description = interaction.fields.getTextInputValue("description").trim();

  const age = Number.parseInt(ageRaw, 10);

  if (!Number.isInteger(age) || age < 0 || age > 130) {
    return interaction.reply({
      content: "Age must be a whole number between 0 and 130.",
      ephemeral: true,
    });
  }

  const lifeStage = lifeStageFromAge(age);

  // Temporary draft row. The rest of the guided setup will update it.
  const { data, error } = await supabase
    .from("npc_profiles")
    .insert({
      guild_id: interaction.guildId,
      name,
      display_age: age,
      life_stage: lifeStage,
      pronouns: pronouns || null,
      short_description: description || null,
      created_by_discord_user_id: interaction.user.id,
      profile_data: {
        setup_incomplete: true,
        birthday_raw: birthday || null,
      },
      status: "paused",
    })
    .select("id,name")
    .single();

  if (error) {
    return interaction.reply({
      content: `Could not start NPC setup: ${error.message}`,
      ephemeral: true,
    });
  }

  const continueButton = new ButtonBuilder()
    .setCustomId(`${CREATE_FLOW_PREFIX}:continue:${data.id}`)
    .setLabel("Continue to Personality")
    .setStyle(ButtonStyle.Primary);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`NPC Draft Created • ${data.name}`)
        .setDescription(
          `Basic information saved.\n\n` +
          `**Life Stage:** ${pretty(lifeStage)}\n` +
          `**Age:** ${age}\n\n` +
          "The next build step will continue this draft through Personality, " +
          "Home/Neighborhood, School, Job, Family, AI, and Autonomy pop-outs."
        ),
    ],
    components: [new ActionRowBuilder().addComponents(continueButton)],
    ephemeral: true,
  });
}

async function handleEditSectionChoice(interaction) {
  const npcId = interaction.customId.split(":").pop();
  const section = interaction.values[0];

  return interaction.update({
    content: `Selected **${pretty(section)}** for editing.`,
    embeds: [],
    components: [],
  });
}

async function toggleSimulationButton(interaction) {
  const settings = await ensureGuildSettings(interaction.guildId);
  const newValue = !settings.simulation_paused;

  const { error } = await supabase
    .from("npc_guild_settings")
    .update({ simulation_paused: newValue })
    .eq("guild_id", interaction.guildId);

  if (error) {
    return interaction.reply({
      content: `Could not update simulator: ${error.message}`,
      ephemeral: true,
    });
  }

  return interaction.update({
    content: newValue
      ? "⏸️ The NPC simulator is now OFF."
      : "▶️ The NPC simulator is now ON.",
    embeds: [],
    components: [],
  });
}

async function openChannelPicker(interaction, kind) {
  const picker = new ChannelSelectMenuBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:channel:${kind}`)
    .setPlaceholder(
      kind === "life"
        ? "Choose the Life Updates channel"
        : "Choose the Admin Notifications channel"
    )
    .setChannelTypes(
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement
    )
    .setMinValues(1)
    .setMaxValues(1);

  return interaction.reply({
    content:
      kind === "life"
        ? "Choose one channel for major NPC life updates."
        : "Choose one channel for admin-only NPC notifications.",
    components: [new ActionRowBuilder().addComponents(picker)],
    ephemeral: true,
  });
}

async function saveSettingsChannel(interaction) {
  const kind = interaction.customId.split(":").pop();
  const channelId = interaction.values[0];

  const field =
    kind === "life"
      ? "life_updates_channel_id"
      : "admin_notifications_channel_id";

  const { error } = await supabase
    .from("npc_guild_settings")
    .update({ [field]: channelId })
    .eq("guild_id", interaction.guildId);

  if (error) {
    return interaction.update({
      content: `Could not save channel: ${error.message}`,
      components: [],
    });
  }

  return interaction.update({
    content:
      kind === "life"
        ? `✅ Life Updates channel set to <#${channelId}>.`
        : `✅ Admin Notifications channel set to <#${channelId}>.`,
    components: [],
  });
}

async function openTimezoneModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:timezone_modal`)
    .setTitle("Set Server Timezone");

  const timezone = new TextInputBuilder()
    .setCustomId("timezone")
    .setLabel("Timezone")
    .setPlaceholder("America/Chicago")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80);

  modal.addComponents(new ActionRowBuilder().addComponents(timezone));

  return interaction.showModal(modal);
}

async function saveTimezone(interaction) {
  const timezone = interaction.fields.getTextInputValue("timezone").trim();

  const { error } = await supabase
    .from("npc_guild_settings")
    .update({ timezone })
    .eq("guild_id", interaction.guildId);

  if (error) {
    return interaction.reply({
      content: `Could not save timezone: ${error.message}`,
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: `✅ Server timezone set to **${timezone}**.`,
    ephemeral: true,
  });
}

async function scanWorld(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  await guild.channels.fetch();

  let saved = 0;

  for (const channel of guild.channels.cache.values()) {
    if (!channel) continue;

    const objectType =
      channel.type === ChannelType.GuildCategory
        ? "category"
        : channel.isThread?.()
        ? "thread"
        : channel.type === ChannelType.GuildForum
        ? "forum"
        : "channel";

    const guessedType = guessLocationType(channel);

    const row = {
      guild_id: interaction.guildId,
      discord_channel_id: channel.id,
      parent_discord_category_id: channel.parentId || null,
      name: channel.name,
      channel_name: channel.name,
      channel_topic: "topic" in channel ? channel.topic || null : null,
      location_type: guessedType,
      discord_object_type: objectType,
      auto_classified: true,
      admin_confirmed: false,
    };

    const { error } = await supabase
      .from("npc_world_locations")
      .upsert(row, {
        onConflict: "guild_id,discord_channel_id",
      });

    if (!error) saved += 1;
  }

  return interaction.editReply({
    content: `✅ World scan finished. Saved/updated **${saved}** Discord locations.`,
  });
}

async function reviewWorld(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { data, error } = await supabase
    .from("npc_world_locations")
    .select("name,location_type,discord_object_type,admin_confirmed")
    .eq("guild_id", interaction.guildId)
    .order("name", { ascending: true })
    .limit(30);

  if (error) {
    return interaction.editReply(`Could not load world registry: ${error.message}`);
  }

  if (!data?.length) {
    return interaction.editReply(
      "No world locations are saved yet. Run `/npc world setup` and press **Scan Server**."
    );
  }

  const lines = data.map(
    (loc) =>
      `• **${loc.name}** → ${pretty(loc.location_type)}${loc.admin_confirmed ? " ✅" : ""}`
  );

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("World Registry")
        .setDescription(lines.join("\n")),
    ],
  });
}

function guessLocationType(channel) {
  const text = `${channel.name || ""} ${"topic" in channel ? channel.topic || "" : ""}`
    .toLowerCase();

  if (channel.type === ChannelType.GuildCategory) {
    if (/(heights|neighborhood|district|village|estates|apartments|residential)/.test(text)) {
      return "neighborhood";
    }
    return "other";
  }

  if (/(school|academy|high-school|middle-school|elementary|university|college)/.test(text)) {
    return "school";
  }
  if (/(mall|shopping-center)/.test(text)) return "mall";
  if (/(park|playground)/.test(text)) return "park";
  if (/(hospital|clinic|medical|doctor)/.test(text)) return "hospital_clinic";
  if (/(gym|fitness)/.test(text)) return "gym";
  if (/(cafe|coffee|restaurant|diner|grill|bar-and-grill|bakery)/.test(text)) {
    return "restaurant_cafe";
  }
  if (/(store|shop|market|mart|boutique|target|walmart)/.test(text)) {
    return "store";
  }
  if (/(station|bus|train|transit|metro|airport)/.test(text)) return "transit";
  if (/(church|community-center|mosque|temple)/.test(text)) {
    return "religious_community";
  }
  if (/(theater|cinema|club|arcade|bowling|museum)/.test(text)) {
    return "entertainment";
  }
  if (/(house|home|apartment|apt-|residence|lane|street|avenue|drive)/.test(text)) {
    return "residence";
  }

  return "unknown";
}

function lifeStageFromAge(age) {
  if (age <= 1) return "baby";
  if (age <= 4) return "toddler";
  if (age <= 12) return "child";
  if (age <= 17) return "teen";
  if (age <= 25) return "young_adult";
  if (age <= 64) return "adult";
  return "elder";
}

function pretty(value) {
  if (!value) return "Not set";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
