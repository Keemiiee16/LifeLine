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
  MessageFlags,
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

const LOCATION_TYPES_COMMON = [
  { label: "Residence / Home", value: "residence" },
  { label: "School", value: "school" },
  { label: "Workplace / Office", value: "workplace" },
  { label: "Store / Shop", value: "store" },
  { label: "Restaurant", value: "restaurant" },
  { label: "Café / Coffee Shop", value: "cafe" },
  { label: "Bar / Lounge", value: "bar" },
  { label: "Nightclub", value: "nightclub" },
  { label: "Mall", value: "mall" },
  { label: "Park / Playground", value: "park" },
  { label: "Hospital", value: "hospital" },
  { label: "Clinic / Doctor", value: "clinic" },
  { label: "Gym / Fitness", value: "gym" },
  { label: "Entertainment", value: "entertainment" },
];

const LOCATION_TYPES_MORE = [
  { label: "Library", value: "library" },
  { label: "Government / City Service", value: "government" },
  { label: "Police Station", value: "police" },
  { label: "Fire Station", value: "fire_station" },
  { label: "Transit Station", value: "transit" },
  { label: "Airport", value: "airport" },
  { label: "Religious Location", value: "religious" },
  { label: "Community Center", value: "community" },
  { label: "Salon / Barber", value: "salon" },
  { label: "Daycare / Childcare", value: "daycare" },
  { label: "Hotel", value: "hotel" },
  { label: "Event Venue", value: "venue" },
  { label: "Generic Public Place", value: "public" },
  { label: "Other", value: "other" },
];

const SUPPORTED_LOCATION_TYPES = new Set([
  ...LOCATION_TYPES_COMMON.map((item) => item.value),
  ...LOCATION_TYPES_MORE.map((item) => item.value),
]);

const SUPPORTED_LOCATION_USES = new Set([
  "workplace",
  "school",
  "shopping",
  "dining",
  "recreation",
]);

const WORLD_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
]);

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
        flags: MessageFlags.Ephemeral,
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const npcName = interaction.options.getString("name", true);

  const { data, error } = await supabase
    .from("npc_profiles")
    .select("*")
    .eq("guild_id", interaction.guildId)
    .ilike("name", npcName)
    .limit(1)
    .maybeSingle();

  if (error) {
    return interaction.editReply({
      content: `Could not load that NPC: ${error.message}`,
      });
  }

  if (!data) {
    return interaction.editReply({
      content: `I couldn't find an NPC named **${npcName}**.`,
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

  return interaction.editReply({
    content: `Editing **${data.name}**`,
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

async function viewNpc(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

  return interaction.editReply({
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
  });
}

async function openWorldSetup(interaction) {
  const scan = new ButtonBuilder()
    .setCustomId(`${WORLD_PREFIX}:scan`)
    .setLabel("Scan Tagged Locations")
    .setStyle(ButtonStyle.Primary);

  const review = new ButtonBuilder()
    .setCustomId(`${WORLD_PREFIX}:review`)
    .setLabel("Review Locations")
    .setStyle(ButtonStyle.Secondary);

  const edit = new ButtonBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit`)
    .setLabel("Edit Location")
    .setStyle(ButtonStyle.Success);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("World Setup")
        .setDescription(
          "LifeLine now identifies places from **channel topic tags** instead of guessing from channel names.\n\n" +
          "Example: `lifeline:type=cafe`\n" +
          "Optional secondary use: `lifeline:use=workplace`\n\n" +
          "**Scan Tagged Locations** reads every accessible tagged channel.\n" +
          "**Review Locations** shows what LifeLine currently knows.\n" +
          "**Edit Location** lets you click a Discord channel and manually override it.\n\n" +
          "Untagged or invalid locations can be sent to your **Admin Notifications** channel."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(scan, review, edit),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function pauseSystem(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
      return interaction.editReply({
        content: `Could not update simulator: ${error.message}`,
          });
    }

    return interaction.editReply({
      content: newValue
        ? "⏸️ The entire NPC simulator is now paused."
        : "▶️ The entire NPC simulator is running again.",
      });
  }

  if (!target) {
    return interaction.editReply({
      content: "You need to provide a target name for that pause scope.",
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
      return interaction.editReply({
        content: error
          ? `Could not load NPC: ${error.message}`
          : `I couldn't find **${target}**.`,
          });
    }

    const nextStatus = data.status === "paused" ? "active" : "paused";

    const { error: updateError } = await supabase
      .from("npc_profiles")
      .update({ status: nextStatus })
      .eq("id", data.id);

    if (updateError) {
      return interaction.editReply({
        content: `Could not update NPC: ${updateError.message}`,
          });
    }

    return interaction.editReply({
      content:
        nextStatus === "paused"
          ? `⏸️ **${data.name}** is now paused.`
          : `▶️ **${data.name}** is active again.`,
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
      return interaction.editReply({
        content: error
          ? `Could not load location: ${error.message}`
          : `I couldn't find **${target}** in the world registry.`,
          });
    }

    const nextPaused = !data.paused;

    const { error: updateError } = await supabase
      .from("npc_world_locations")
      .update({ paused: nextPaused })
      .eq("id", data.id);

    if (updateError) {
      return interaction.editReply({
        content: `Could not update location: ${updateError.message}`,
          });
    }

    return interaction.editReply({
      content: nextPaused
        ? `⏸️ **${data.name}** is now paused for autonomous NPC activity.`
        : `▶️ **${data.name}** is active again.`,
      });
  }
}

async function undoLast(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

  if (interaction.isButton() && id === `${WORLD_PREFIX}:edit`) {
    return openWorldLocationPicker(interaction);
  }

  if (interaction.isChannelSelectMenu() && id === `${WORLD_PREFIX}:edit_channel`) {
    return editWorldLocationFromDiscordChannel(interaction);
  }

  if (interaction.isStringSelectMenu() && id === `${WORLD_PREFIX}:edit_pick`) {
    return showWorldLocationTypePicker(interaction, interaction.values[0]);
  }

  if (interaction.isButton() && id.startsWith(`${WORLD_PREFIX}:unknown_classify:`)) {
    const locationId = id.split(":")[2];
    return openUnknownLocationClassifier(interaction, locationId);
  }

  if (interaction.isButton() && id.startsWith(`${WORLD_PREFIX}:unknown_ignore:`)) {
    const locationId = id.split(":")[2];
    return ignoreUnknownLocation(interaction, locationId);
  }

  if (interaction.isStringSelectMenu() && id.startsWith(`${WORLD_PREFIX}:edit_type:`)) {
    const parts = id.split(":");
    const locationId = parts[2];
    return saveWorldLocationType(interaction, locationId, interaction.values[0]);
  }
}

async function handleCreateBasic(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const name = interaction.fields.getTextInputValue("name").trim();
  const ageRaw = interaction.fields.getTextInputValue("age").trim();
  const pronouns = interaction.fields.getTextInputValue("pronouns").trim();
  const birthday = interaction.fields.getTextInputValue("birthday").trim();
  const description = interaction.fields.getTextInputValue("description").trim();

  const age = Number.parseInt(ageRaw, 10);

  if (!Number.isInteger(age) || age < 0 || age > 130) {
    return interaction.editReply({
      content: "Age must be a whole number between 0 and 130.",
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
    return interaction.editReply({
      content: `Could not start NPC setup: ${error.message}`,
      });
  }

  const continueButton = new ButtonBuilder()
    .setCustomId(`${CREATE_FLOW_PREFIX}:continue:${data.id}`)
    .setLabel("Continue to Personality")
    .setStyle(ButtonStyle.Primary);

  return interaction.editReply({
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
  await interaction.deferUpdate();
  const settings = await ensureGuildSettings(interaction.guildId);
  const newValue = !settings.simulation_paused;

  const { error } = await supabase
    .from("npc_guild_settings")
    .update({ simulation_paused: newValue })
    .eq("guild_id", interaction.guildId);

  if (error) {
    return interaction.reply({
      content: `Could not update simulator: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.editReply({
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
    flags: MessageFlags.Ephemeral,
  });
}

async function saveSettingsChannel(interaction) {
  await interaction.deferUpdate();

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
    return interaction.editReply({
      content: `Could not save channel: ${error.message}`,
      components: [],
    });
  }

  return interaction.editReply({
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const timezone = interaction.fields.getTextInputValue("timezone").trim();

  const { error } = await supabase
    .from("npc_guild_settings")
    .update({ timezone })
    .eq("guild_id", interaction.guildId);

  if (error) {
    return interaction.editReply({
      content: `Could not save timezone: ${error.message}`,
      });
  }

  return interaction.editReply({
    content: `✅ Server timezone set to **${timezone}**.`,
  });
}

async function openWorldLocationPicker(interaction) {
  const picker = new ChannelSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_channel`)
    .setPlaceholder("Choose a channel to edit")
    .setMinValues(1)
    .setMaxValues(1)
    .setChannelTypes(
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum
    );

  return interaction.reply({
    content:
      "Pick the **actual Discord channel** you want LifeLine to classify/edit.",
    components: [
      new ActionRowBuilder().addComponents(picker),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function editWorldLocationFromDiscordChannel(interaction) {
  await interaction.deferUpdate();

  const discordChannelId = interaction.values[0];
  const channel =
    interaction.guild.channels.cache.get(discordChannelId) ||
    await interaction.guild.channels.fetch(discordChannelId).catch(() => null);

  if (!channel) {
    return interaction.editReply({
      content: "I couldn't load that Discord channel.",
      components: [],
    });
  }

  const result = await syncWorldChannel(interaction.guild, channel, {
    notifyUnknown: false,
  });

  if (!result?.location) {
    return interaction.editReply({
      content: "That channel type is not used as a LifeLine world location.",
      components: [],
    });
  }

  return showWorldLocationTypePicker(
    interaction,
    result.location.id,
    result.location
  );
}

function buildLocationTypeRows(locationId) {
  const common = new StringSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_type:${locationId}:common`)
    .setPlaceholder("Common location types")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(LOCATION_TYPES_COMMON);

  const more = new StringSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_type:${locationId}:more`)
    .setPlaceholder("More location types")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(LOCATION_TYPES_MORE);

  return [
    new ActionRowBuilder().addComponents(common),
    new ActionRowBuilder().addComponents(more),
  ];
}

async function showWorldLocationTypePicker(
  interaction,
  locationId,
  knownLocation = null
) {
  let location = knownLocation;

  if (
    !location &&
    (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) &&
    !interaction.deferred &&
    !interaction.replied
  ) {
    await interaction.deferUpdate();
  }

  if (!location) {
    const { data, error } = await supabase
      .from("npc_world_locations")
      .select("id,name,location_type,discord_object_type,metadata")
      .eq("guild_id", interaction.guildId)
      .eq("id", locationId)
      .single();

    if (error) {
      const payload = {
        content: `Could not load that location: ${error.message}`,
        components: [],
      };

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    }

    location = data;
  }

  const payload = {
    content:
      `Editing **${location.name}**\n` +
      `Current type: **${pretty(location.location_type)}**\n\n` +
      "Choose the correct type. This becomes a manual override if the channel does not have a valid `lifeline:type=` topic tag.",
    components: buildLocationTypeRows(location.id),
  };

  if (
    interaction.isStringSelectMenu() ||
    interaction.isChannelSelectMenu()
  ) {
    return interaction.deferred
      ? interaction.editReply(payload)
      : interaction.update(payload);
  }

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }

  return interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  });
}

async function saveWorldLocationType(interaction, locationId, newType) {
  await interaction.deferUpdate();

  if (!SUPPORTED_LOCATION_TYPES.has(newType)) {
    return interaction.editReply({
      content: "That is not a supported LifeLine location type.",
      components: [],
    });
  }

  const { data: existing, error: loadError } = await supabase
    .from("npc_world_locations")
    .select("id,name,discord_channel_id,metadata")
    .eq("guild_id", interaction.guildId)
    .eq("id", locationId)
    .single();

  if (loadError) {
    return interaction.editReply({
      content: `Could not load location: ${loadError.message}`,
      components: [],
    });
  }

  const metadata = {
    ...(existing.metadata || {}),
    manual_override: true,
    tag_status: "manual_override",
    unknown_reason: null,
    unknown_alert_signature: null,
    ignored_unknown: false,
  };

  const { data, error } = await supabase
    .from("npc_world_locations")
    .update({
      location_type: newType,
      auto_classified: false,
      admin_confirmed: true,
      metadata,
    })
    .eq("guild_id", interaction.guildId)
    .eq("id", locationId)
    .select("id,name,location_type,metadata")
    .single();

  if (error) {
    return interaction.editReply({
      content: `Could not update location: ${error.message}`,
      components: [],
    });
  }

  await markUnknownNotificationResolved(
    interaction.guild,
    data,
    `✅ Classified as **${pretty(data.location_type)}**`
  );

  return interaction.editReply({
    content:
      `✅ **${data.name}** is now classified as **${pretty(data.location_type)}**.\n\n` +
      "Because this was selected manually, LifeLine will remember it even if the channel has no topic tag. A future valid `lifeline:type=` tag will take priority.",
    components: [],
  });
}

async function openUnknownLocationClassifier(interaction, locationId) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const { data, error } = await supabase
    .from("npc_world_locations")
    .select("id,name,location_type,discord_object_type,metadata")
    .eq("guild_id", interaction.guildId)
    .eq("id", locationId)
    .single();

  if (error || !data) {
    return interaction.editReply({
      content: error
        ? `Could not load that unknown location: ${error.message}`
        : "That unknown location no longer exists.",
    });
  }

  return showWorldLocationTypePicker(interaction, data.id, data);
}

async function ignoreUnknownLocation(interaction, locationId) {
  await interaction.deferUpdate();

  const { data, error } = await supabase
    .from("npc_world_locations")
    .select("id,name,metadata")
    .eq("guild_id", interaction.guildId)
    .eq("id", locationId)
    .single();

  if (error || !data) {
    return interaction.editReply({
      content: error
        ? `Could not load that location: ${error.message}`
        : "That location no longer exists.",
      components: [],
    });
  }

  const metadata = {
    ...(data.metadata || {}),
    ignored_unknown: true,
  };

  const { error: updateError } = await supabase
    .from("npc_world_locations")
    .update({ metadata })
    .eq("id", data.id);

  if (updateError) {
    return interaction.editReply({
      content: `Could not ignore that location: ${updateError.message}`,
      components: [],
    });
  }

  return interaction.editReply({
    content:
      `⏭️ **${data.name}** will stay unclassified and LifeLine will not keep sending unknown-location alerts for it.\n\n` +
      "You can still classify it later from `/npc world setup`.",
    embeds: [],
    components: [],
  });
}

function parseLifeLineTopic(channel) {
  const topic =
    typeof channel.topic === "string"
      ? channel.topic
      : "";

  const lower = topic.toLowerCase();

  const typeMatches = [
    ...lower.matchAll(/(?:^|\s)lifeline:type=([a-z0-9_]+)/g),
  ].map((match) => match[1]);

  const uniqueTypes = [...new Set(typeMatches)];

  const useMatches = [
    ...lower.matchAll(/(?:^|\s)lifeline:use=([a-z0-9_]+)/g),
  ].map((match) => match[1]);

  const uses = [
    ...new Set(
      useMatches.filter((value) =>
        SUPPORTED_LOCATION_USES.has(value)
      )
    ),
  ];

  const invalidUses = [
    ...new Set(
      useMatches.filter(
        (value) => !SUPPORTED_LOCATION_USES.has(value)
      )
    ),
  ];

  const mentionsTypeTag = lower.includes("lifeline:type");

  if (uniqueTypes.length === 0) {
    return {
      status: mentionsTypeTag ? "malformed" : "missing",
      type: null,
      uses,
      invalidUses,
      signature: `${mentionsTypeTag ? "malformed" : "missing"}:${topic}`,
    };
  }

  if (uniqueTypes.length > 1) {
    return {
      status: "conflict",
      type: null,
      uses,
      invalidUses,
      foundTypes: uniqueTypes,
      signature: `conflict:${uniqueTypes.join(",")}:${topic}`,
    };
  }

  const type = uniqueTypes[0];

  if (!SUPPORTED_LOCATION_TYPES.has(type)) {
    return {
      status: "unsupported",
      type,
      uses,
      invalidUses,
      signature: `unsupported:${type}:${topic}`,
    };
  }

  return {
    status:
      invalidUses.length > 0
        ? "valid_with_warning"
        : "valid",
    type,
    uses,
    invalidUses,
    signature: `valid:${type}:${uses.join(",")}:${invalidUses.join(",")}`,
  };
}

function isWorldChannelCandidate(channel) {
  return (
    channel &&
    channel.guild &&
    WORLD_CHANNEL_TYPES.has(channel.type) &&
    channel.viewable !== false
  );
}

function unknownReasonText(parsed) {
  if (parsed.status === "missing") {
    return "No `lifeline:type=` tag was found in the channel topic.";
  }

  if (parsed.status === "malformed") {
    return "A `lifeline:type` tag appears to be present, but it is malformed.";
  }

  if (parsed.status === "unsupported") {
    return `The topic uses unsupported type \`${parsed.type}\`.`;
  }

  if (parsed.status === "conflict") {
    return `The topic contains conflicting LifeLine types: ${parsed.foundTypes
      .map((value) => `\`${value}\``)
      .join(", ")}.`;
  }

  if (parsed.status === "valid_with_warning") {
    return `The location type is valid, but these \`lifeline:use=\` values are unsupported: ${parsed.invalidUses
      .map((value) => `\`${value}\``)
      .join(", ")}.`;
  }

  return "LifeLine could not classify this location.";
}

export async function syncWorldChannel(
  guild,
  channel,
  { notifyUnknown = true } = {}
) {
  if (!isWorldChannelCandidate(channel)) {
    return {
      status: "ignored_channel_type",
      location: null,
    };
  }

  const parsed = parseLifeLineTopic(channel);

  const { data: existing, error: existingError } =
    await supabase
      .from("npc_world_locations")
      .select("id,name,location_type,metadata")
      .eq("guild_id", guild.id)
      .eq("discord_channel_id", channel.id)
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const oldMetadata = existing?.metadata || {};
  const areaName = channel.parent?.name || null;

  if (
    (parsed.status === "valid" ||
      parsed.status === "valid_with_warning") &&
    parsed.type
  ) {
    const metadata = {
      ...oldMetadata,
      tag_status: parsed.status,
      lifeline_type: parsed.type,
      lifeline_uses: parsed.uses,
      invalid_lifeline_uses: parsed.invalidUses,
      area_name: areaName,
      manual_override: false,
      ignored_unknown: false,
      unknown_reason:
        parsed.status === "valid_with_warning"
          ? unknownReasonText(parsed)
          : null,
      unknown_alert_signature:
        parsed.status === "valid_with_warning"
          ? oldMetadata.unknown_alert_signature || null
          : null,
    };

    const row = {
      guild_id: guild.id,
      discord_channel_id: channel.id,
      parent_discord_category_id: channel.parentId || null,
      name: channel.name,
      channel_name: channel.name,
      channel_topic: channel.topic || null,
      location_type: parsed.type,
      discord_object_type:
        channel.type === ChannelType.GuildForum
          ? "forum"
          : "channel",
      auto_classified: false,
      admin_confirmed: true,
      metadata,
    };

    const { data: location, error } = await supabase
      .from("npc_world_locations")
      .upsert(row, {
        onConflict: "guild_id,discord_channel_id",
      })
      .select("id,name,location_type,metadata")
      .single();

    if (error) throw error;

    if (
      parsed.status === "valid_with_warning" &&
      notifyUnknown
    ) {
      await maybeSendUnknownLocationNotice(
        guild,
        channel,
        location,
        parsed
      );
    }

    return {
      status: parsed.status,
      location,
    };
  }

  // If an admin manually classified an untagged channel, preserve it.
  if (
    existing &&
    oldMetadata.manual_override === true &&
    parsed.status === "missing"
  ) {
    const metadata = {
      ...oldMetadata,
      area_name: areaName,
      tag_status: "manual_override",
    };

    const { data: location, error } = await supabase
      .from("npc_world_locations")
      .update({
        name: channel.name,
        channel_name: channel.name,
        channel_topic: channel.topic || null,
        parent_discord_category_id: channel.parentId || null,
        metadata,
      })
      .eq("id", existing.id)
      .select("id,name,location_type,metadata")
      .single();

    if (error) throw error;

    return {
      status: "manual_override",
      location,
    };
  }

  const reason = unknownReasonText(parsed);

  const metadata = {
    ...oldMetadata,
    tag_status: parsed.status,
    lifeline_type: parsed.type || null,
    lifeline_uses: parsed.uses,
    invalid_lifeline_uses: parsed.invalidUses,
    area_name: areaName,
    manual_override: false,
    unknown_reason: reason,
  };

  const row = {
    guild_id: guild.id,
    discord_channel_id: channel.id,
    parent_discord_category_id: channel.parentId || null,
    name: channel.name,
    channel_name: channel.name,
    channel_topic: channel.topic || null,
    location_type: "unknown",
    discord_object_type:
      channel.type === ChannelType.GuildForum
        ? "forum"
        : "channel",
    auto_classified: false,
    admin_confirmed: false,
    metadata,
  };

  const { data: location, error } = await supabase
    .from("npc_world_locations")
    .upsert(row, {
      onConflict: "guild_id,discord_channel_id",
    })
    .select("id,name,location_type,metadata")
    .single();

  if (error) throw error;

  if (
    notifyUnknown &&
    location.metadata?.ignored_unknown !== true
  ) {
    await maybeSendUnknownLocationNotice(
      guild,
      channel,
      location,
      parsed
    );
  }

  return {
    status: parsed.status,
    location,
  };
}

async function maybeSendUnknownLocationNotice(
  guild,
  channel,
  location,
  parsed
) {
  const signature = parsed.signature;

  if (
    location.metadata?.unknown_alert_signature ===
    signature
  ) {
    return;
  }

  const settings = await ensureGuildSettings(guild.id);

  if (!settings.admin_notifications_channel_id) {
    return;
  }

  const adminChannel =
    guild.channels.cache.get(
      settings.admin_notifications_channel_id
    ) ||
    await guild.channels
      .fetch(settings.admin_notifications_channel_id)
      .catch(() => null);

  if (!adminChannel?.isTextBased?.()) {
    return;
  }

  const classify = new ButtonBuilder()
    .setCustomId(
      `${WORLD_PREFIX}:unknown_classify:${location.id}`
    )
    .setLabel("Classify Location")
    .setStyle(ButtonStyle.Primary);

  const ignore = new ButtonBuilder()
    .setCustomId(
      `${WORLD_PREFIX}:unknown_ignore:${location.id}`
    )
    .setLabel("Ignore for Now")
    .setStyle(ButtonStyle.Secondary);

  const reason = unknownReasonText(parsed);

  const message = await adminChannel
    .send({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚠️ Unknown Location")
          .setDescription(
            `Channel: <#${channel.id}>\n` +
            `Category/Area: **${channel.parent?.name || "None"}**\n\n` +
            `${reason}\n\n` +
            "Add a topic tag such as `lifeline:type=store`, or classify it below."
          )
          .setFooter({
            text: "LifeLine Unknown Location Inbox",
          }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          classify,
          ignore
        ),
      ],
    })
    .catch(() => null);

  if (!message) return;

  const metadata = {
    ...(location.metadata || {}),
    unknown_alert_signature: signature,
    unknown_alerted_at: new Date().toISOString(),
    unknown_alert_message_id: message.id,
    unknown_alert_channel_id: adminChannel.id,
  };

  await supabase
    .from("npc_world_locations")
    .update({ metadata })
    .eq("id", location.id);
}

async function markUnknownNotificationResolved(
  guild,
  location,
  resolutionText
) {
  const metadata = location.metadata || {};
  const messageId = metadata.unknown_alert_message_id;
  const channelId = metadata.unknown_alert_channel_id;

  if (!messageId || !channelId) return;

  const channel =
    guild.channels.cache.get(channelId) ||
    await guild.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased?.()) return;

  const message = await channel.messages
    .fetch(messageId)
    .catch(() => null);

  if (!message) return;

  await message
    .edit({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Location Resolved")
          .setDescription(
            `**${location.name}**\n${resolutionText}`
          )
          .setFooter({
            text: "LifeLine Unknown Location Inbox",
          }),
      ],
      components: [],
    })
    .catch(() => null);
}

async function scanWorld(interaction) {
  const guild = interaction.guild;
  await guild.channels.fetch();

  let tagged = 0;
  let overrides = 0;
  let unknown = 0;
  let warnings = 0;
  let ignored = 0;
  let errors = 0;

  for (const channel of guild.channels.cache.values()) {
    if (!isWorldChannelCandidate(channel)) {
      ignored += 1;
      continue;
    }

    try {
      const result = await syncWorldChannel(
        guild,
        channel,
        { notifyUnknown: true }
      );

      if (result.status === "valid") tagged += 1;
      else if (result.status === "valid_with_warning")
        warnings += 1;
      else if (result.status === "manual_override")
        overrides += 1;
      else unknown += 1;
    } catch (error) {
      errors += 1;
      console.error(
        `World scan error for ${channel.name}:`,
        error
      );
    }
  }

  return interaction.editReply({
    content:
      `✅ **World scan finished.**\n\n` +
      `Tagged locations: **${tagged}**\n` +
      `Manual overrides: **${overrides}**\n` +
      `Tag warnings: **${warnings}**\n` +
      `Unknown/unclassified: **${unknown}**\n` +
      `Ignored non-location channel types: **${ignored}**\n` +
      `Errors: **${errors}**\n\n` +
      "Unknown locations are sent to the configured **Admin Notifications** channel when available.",
  });
}

async function reviewWorld(interaction) {
  const { data, error } = await supabase
    .from("npc_world_locations")
    .select("id,name,location_type,discord_object_type,admin_confirmed,metadata")
    .eq("guild_id", interaction.guildId)
    .order("name", { ascending: true })
    .limit(25);

  if (error) {
    return interaction.editReply(
      `Could not load world registry: ${error.message}`
    );
  }

  if (!data?.length) {
    return interaction.editReply(
      "No world locations are saved yet. Run `/npc world setup` and press **Scan Tagged Locations**."
    );
  }

  const lines = data.map((loc) => {
    const tagStatus =
      loc.metadata?.tag_status || "unknown";

    return (
      `• **${loc.name}** → ${pretty(loc.location_type)}` +
      ` • ${pretty(tagStatus)}`
    );
  });

  const picker = new StringSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_pick`)
    .setPlaceholder("Click a saved location to edit it")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      data.map((loc) => ({
        label: loc.name.slice(0, 100),
        description:
          `${pretty(loc.location_type)} • ${pretty(
            loc.metadata?.tag_status || "unknown"
          )}`.slice(0, 100),
        value: loc.id,
      }))
    );

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("World Registry")
        .setDescription(
          lines.join("\n") +
          "\n\n**Choose any saved location below to edit it.**"
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(picker),
    ],
  });
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
