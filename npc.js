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

const WORLD_LOCATION_TYPES = [
  { label: "Neighborhood", value: "neighborhood" },
  { label: "Residence", value: "residence" },
  { label: "School", value: "school" },
  { label: "Workplace", value: "workplace" },
  { label: "Store", value: "store" },
  { label: "Restaurant / Café", value: "restaurant_cafe" },
  { label: "Mall", value: "mall" },
  { label: "Park", value: "park" },
  { label: "Hospital / Clinic", value: "hospital_clinic" },
  { label: "Vet Clinic / Veterinary Hospital", value: "vet_clinic" },
  { label: "Pet Store", value: "pet_store" },
  { label: "Pet Park / Dog Park", value: "pet_park" },
  { label: "Pet Groomer", value: "pet_groomer" },
  { label: "Pet Daycare / Boarding", value: "pet_daycare" },
  { label: "Animal Shelter / Rescue", value: "animal_shelter" },
  { label: "Pet Café / Pet-Friendly Venue", value: "pet_cafe" },
  { label: "Government / Public Service", value: "government_public_service" },
  { label: "Entertainment", value: "entertainment" },
  { label: "Gym", value: "gym" },
  { label: "Transit", value: "transit" },
  { label: "Religious / Community", value: "religious_community" },
  { label: "Other / Custom Type", value: "other" },
  { label: "Unknown", value: "unknown" },
];

const SUPPORTED_LOCATION_TYPES = new Set(
  WORLD_LOCATION_TYPES.map((item) => item.value)
);

export const npcCommand = {
  data: new SlashCommandBuilder()
    .setName("npc")
    .setDescription("LifeLine NPC simulator commands")
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check the NPC simulator status")
    )
    .addSubcommand((sub) =>
      sub.setName("create").setDescription("Create a new NPC with guided pop-out setup")
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing NPC")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("NPC name to edit").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View an NPC profile")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("NPC name").setRequired(true)
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
      sub.setName("settings").setDescription("Open LifeLine server settings")
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
      sub.setName("undo").setDescription("Undo the most recent undoable major NPC event")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("world")
        .setDescription("World/location setup")
        .addSubcommand((sub) =>
          sub.setName("setup").setDescription("Scan and classify Discord channels/categories")
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

    if (group === "world" && subcommand === "setup") return openWorldSetup(interaction);
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
      { name: "Simulation", value: settings.simulation_paused ? "⏸️ Paused" : "▶️ Running", inline: true },
      { name: "Timezone", value: settings.timezone || "America/Chicago", inline: true },
      { name: "Active NPCs", value: `${activeCount} / ${settings.max_active_npcs ?? 15}`, inline: true },
      { name: "Pregnancy Rule", value: `${settings.pregnancy_days ?? 21} days`, inline: true }
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

  if (error) return interaction.editReply({ content: `Could not load that NPC: ${error.message}` });
  if (!data) return interaction.editReply({ content: `I couldn't find an NPC named **${npcName}**.` });

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
    .select(`*,npc_transportation(*),npc_finances(*)`)
    .eq("guild_id", interaction.guildId)
    .ilike("name", npcName)
    .limit(1)
    .maybeSingle();

  if (error) return interaction.editReply(`Could not load NPC: ${error.message}`);
  if (!data) return interaction.editReply(`I couldn't find an NPC named **${npcName}**.`);

  const embed = new EmbedBuilder()
    .setTitle(data.name)
    .setDescription(data.short_description || "No description set.")
    .addFields(
      { name: "Age", value: `${data.display_age} • ${pretty(data.life_stage)}`, inline: true },
      { name: "Importance", value: pretty(data.importance), inline: true },
      { name: "Activity", value: pretty(data.activity_level), inline: true },
      { name: "Status", value: pretty(data.status), inline: true },
      { name: "Pronouns", value: data.pronouns || "Not set", inline: true },
      { name: "Romance", value: data.romance_enabled ? "Enabled" : "Disabled", inline: true }
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
  if (error) return interaction.editReply(`Search failed: ${error.message}`);
  if (!data?.length) return interaction.editReply("No NPCs matched that search.");

  const lines = data.map(
    (npc) => `• **${npc.name}** — ${npc.display_age}, ${pretty(npc.life_stage)} • ${pretty(npc.status)}`
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
    .setStyle(settings.simulation_paused ? ButtonStyle.Success : ButtonStyle.Danger);

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
    .setLabel("Scan Server")
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
        .setTitle("World Setup v2 • Pet + Custom Types")
        .setDescription(
          "LifeLine can scan the categories and channels it can access, then build the NPC world location registry.\n\n" +
          "**Scan Server** finds channels/categories.\n" +
          "**Review Locations** shows current classifications.\n" +
          "**Edit Location** lets you click a Discord channel/category and correct its type."
        ),
    ],
    components: [new ActionRowBuilder().addComponents(scan, review, edit)],
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

    if (error) return interaction.editReply({ content: `Could not update simulator: ${error.message}` });

    return interaction.editReply({
      content: newValue
        ? "⏸️ The entire NPC simulator is now paused."
        : "▶️ The entire NPC simulator is running again.",
    });
  }

  if (!target) {
    return interaction.editReply({ content: "You need to provide a target name for that pause scope." });
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
        content: error ? `Could not load NPC: ${error.message}` : `I couldn't find **${target}**.`,
      });
    }

    const nextStatus = data.status === "paused" ? "active" : "paused";
    const { error: updateError } = await supabase
      .from("npc_profiles")
      .update({ status: nextStatus })
      .eq("id", data.id);

    if (updateError) return interaction.editReply({ content: `Could not update NPC: ${updateError.message}` });

    return interaction.editReply({
      content: nextStatus === "paused"
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

    if (updateError) return interaction.editReply({ content: `Could not update location: ${updateError.message}` });

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

  if (error) return interaction.editReply(`Could not check undo history: ${error.message}`);
  if (!data) return interaction.editReply("There are no recent undoable NPC events.");

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("Undo Available")
        .setDescription(
          `**${data.description || data.action_type}**\n\n` +
          "The audit record is ready. Full automatic state restoration will be connected when the life-event engine is added."
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

  if (interaction.isStringSelectMenu() && id.startsWith(`${WORLD_PREFIX}:edit_type:`)) {
    const locationId = id.split(":").pop();
    return saveWorldLocationType(interaction, locationId, interaction.values[0]);
  }

  if (interaction.isButton() && id.startsWith(`${WORLD_PREFIX}:custom_open:`)) {
    const locationId = id.split(":").pop();
    return openCustomLocationTypeModal(interaction, locationId);
  }

  if (interaction.isModalSubmit() && id.startsWith(`${WORLD_PREFIX}:custom_type:`)) {
    const locationId = id.split(":").pop();
    return saveCustomLocationType(interaction, locationId);
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
    return interaction.editReply({ content: "Age must be a whole number between 0 and 130." });
  }

  const lifeStage = lifeStageFromAge(age);

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

  if (error) return interaction.editReply({ content: `Could not start NPC setup: ${error.message}` });

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
          "The next build step will continue this draft through Personality, Home/Neighborhood, School, Job, Family, AI, and Autonomy pop-outs."
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
    return interaction.followUp({
      content: `Could not update simulator: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.editReply({
    content: newValue ? "⏸️ The NPC simulator is now OFF." : "▶️ The NPC simulator is now ON.",
    embeds: [],
    components: [],
  });
}

async function openChannelPicker(interaction, kind) {
  const picker = new ChannelSelectMenuBuilder()
    .setCustomId(`${SETTINGS_PREFIX}:channel:${kind}`)
    .setPlaceholder(
      kind === "life" ? "Choose the Life Updates channel" : "Choose the Admin Notifications channel"
    )
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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

  const field = kind === "life" ? "life_updates_channel_id" : "admin_notifications_channel_id";

  const { error } = await supabase
    .from("npc_guild_settings")
    .update({ [field]: channelId })
    .eq("guild_id", interaction.guildId);

  if (error) {
    return interaction.editReply({ content: `Could not save channel: ${error.message}`, components: [] });
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

  if (error) return interaction.editReply({ content: `Could not save timezone: ${error.message}` });
  return interaction.editReply({ content: `✅ Server timezone set to **${timezone}**.` });
}

async function openWorldLocationPicker(interaction) {
  const picker = new ChannelSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_channel`)
    .setPlaceholder("Choose a channel or category to edit")
    .setMinValues(1)
    .setMaxValues(1)
    .setChannelTypes(
      ChannelType.GuildCategory,
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildVoice,
      ChannelType.GuildStageVoice
    );

  return interaction.reply({
    content: "Pick the **actual Discord channel or category** you want LifeLine to classify/edit.",
    components: [new ActionRowBuilder().addComponents(picker)],
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
      content: "I couldn't load that Discord channel/category.",
      components: [],
    });
  }

  let { data: location, error } = await supabase
    .from("npc_world_locations")
    .select("id,name,location_type,discord_object_type,custom_type_name,custom_type_description,is_custom_type")
    .eq("guild_id", interaction.guildId)
    .eq("discord_channel_id", discordChannelId)
    .maybeSingle();

  if (error) {
    return interaction.editReply({
      content: `Could not load that location: ${error.message}`,
      components: [],
    });
  }

  if (!location) {
    const objectType =
      channel.type === ChannelType.GuildCategory
        ? "category"
        : channel.isThread?.()
        ? "thread"
        : channel.type === ChannelType.GuildForum
        ? "forum"
        : "channel";

    const row = {
      guild_id: interaction.guildId,
      discord_channel_id: channel.id,
      parent_discord_category_id: channel.parentId || null,
      name: channel.name,
      channel_name: channel.name,
      channel_topic: "topic" in channel ? channel.topic || null : null,
      location_type: guessLocationType(channel),
      discord_object_type: objectType,
      auto_classified: true,
      admin_confirmed: false,
      is_custom_type: false,
    };

    const insert = await supabase
      .from("npc_world_locations")
      .upsert(row, { onConflict: "guild_id,discord_channel_id" })
      .select("id,name,location_type,discord_object_type,custom_type_name,custom_type_description,is_custom_type")
      .single();

    if (insert.error) {
      return interaction.editReply({
        content: `Could not save that location: ${insert.error.message}`,
        components: [],
      });
    }

    location = insert.data;
  }

  return showWorldLocationTypePicker(interaction, location.id, location);
}

async function showWorldLocationTypePicker(interaction, locationId, knownLocation = null) {
  let location = knownLocation;

  if (!location && interaction.isStringSelectMenu() && !interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }

  if (!location) {
    const { data, error } = await supabase
      .from("npc_world_locations")
      .select("id,name,location_type,discord_object_type,custom_type_name,custom_type_description,is_custom_type")
      .eq("guild_id", interaction.guildId)
      .eq("id", locationId)
      .single();

    if (error) {
      const message = `Could not load that location: ${error.message}`;
      if (interaction.isStringSelectMenu()) {
        return interaction.editReply({ content: message, components: [] });
      }
      return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }

    location = data;
  }

  const currentType =
    location.is_custom_type && location.custom_type_name
      ? `${location.custom_type_name} (Custom)`
      : pretty(location.location_type);

  const typePicker = new StringSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_type:${location.id}`)
    .setPlaceholder(`Current: ${currentType}`.slice(0, 150))
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(WORLD_LOCATION_TYPES);

  const payload = {
    content:
      `Editing **${location.name}**\n` +
      `Discord type: **${pretty(location.discord_object_type)}**\n` +
      `Current location type: **${currentType}**\n\n` +
      `Choose the correct location type below.\n\n` +
      `Use the dropdown for a standard type, or press **✏️ Custom / Other Type** below to type your own.`,
    components: [
      new ActionRowBuilder().addComponents(typePicker),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${WORLD_PREFIX}:custom_open:${location.id}`)
          .setLabel("✏️ Custom / Other Type")
          .setStyle(ButtonStyle.Secondary)
      ),
    ],
  };

  if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
    return interaction.deferred ? interaction.editReply(payload) : interaction.update(payload);
  }

  return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

async function saveWorldLocationType(interaction, locationId, newType) {
  if (newType === "other") {
    return openCustomLocationTypeModal(interaction, locationId);
  }

  await interaction.deferUpdate();

  const { data, error } = await supabase
    .from("npc_world_locations")
    .update({
      location_type: newType,
      custom_type_key: null,
      custom_type_name: null,
      custom_type_description: null,
      is_custom_type: false,
      auto_classified: false,
      admin_confirmed: true,
    })
    .eq("guild_id", interaction.guildId)
    .eq("id", locationId)
    .select("name,location_type")
    .single();

  if (error) {
    return interaction.editReply({
      content: `Could not update location: ${error.message}`,
      components: [],
    });
  }

  return interaction.editReply({
    content:
      `✅ **${data.name}** is now classified as **${pretty(data.location_type)}**.\n` +
      `This admin correction will override LifeLine's automatic guess.`,
    components: [],
  });
}

async function openCustomLocationTypeModal(interaction, locationId) {
  const modal = new ModalBuilder()
    .setCustomId(`${WORLD_PREFIX}:custom_type:${locationId}`)
    .setTitle("Custom Location Type");

  const typeName = new TextInputBuilder()
    .setCustomId("custom_type_name")
    .setLabel("What kind of location is this?")
    .setPlaceholder("Dance Studio, Pet Spa, Arcade, Recording Studio...")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(80);

  const description = new TextInputBuilder()
    .setCustomId("custom_type_description")
    .setLabel("Description (optional)")
    .setPlaceholder("What do NPCs normally do or find here?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(typeName),
    new ActionRowBuilder().addComponents(description)
  );

  return interaction.showModal(modal);
}

async function saveCustomLocationType(interaction, locationId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const customTypeName = interaction.fields.getTextInputValue("custom_type_name").trim();
  const customTypeDescription = interaction.fields.getTextInputValue("custom_type_description").trim();

  if (!customTypeName) {
    return interaction.editReply({ content: "You need to enter a custom location type." });
  }

  const customTypeKey = normalizeCustomLocationType(customTypeName);

  const { data, error } = await supabase
    .from("npc_world_locations")
    .update({
      location_type: "other",
      custom_type_key: customTypeKey,
      custom_type_name: customTypeName,
      custom_type_description: customTypeDescription || null,
      is_custom_type: true,
      auto_classified: false,
      admin_confirmed: true,
    })
    .eq("guild_id", interaction.guildId)
    .eq("id", locationId)
    .select("id,name,location_type,custom_type_key,custom_type_name,custom_type_description")
    .single();

  if (error) {
    return interaction.editReply({ content: `Could not save custom location: ${error.message}` });
  }

  let response =
    `✅ **${data.name}** is now classified as **${data.custom_type_name}**.\n\n` +
    `Life Line will recognize **${data.custom_type_name}** as the actual location type instead of simply treating it as Other.`;

  if (data.custom_type_description) {
    response += `\n\n**Description:** ${data.custom_type_description}`;
  }

  return interaction.editReply({ content: response });
}

async function scanWorld(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      is_custom_type: false,
    };

    const { error } = await supabase
      .from("npc_world_locations")
      .upsert(row, { onConflict: "guild_id,discord_channel_id" });

    if (!error) saved += 1;
  }

  return interaction.editReply({
    content: `✅ World scan finished. Saved/updated **${saved}** Discord locations.`,
  });
}

async function reviewWorld(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data, error } = await supabase
    .from("npc_world_locations")
    .select("id,name,location_type,discord_object_type,admin_confirmed,custom_type_name,is_custom_type")
    .eq("guild_id", interaction.guildId)
    .order("name", { ascending: true })
    .limit(25);

  if (error) return interaction.editReply(`Could not load world registry: ${error.message}`);

  if (!data?.length) {
    return interaction.editReply(
      "No world locations are saved yet. Run `/npc world setup` and press **Scan Server**."
    );
  }

  const lines = data.map((loc) => {
    const displayType =
      loc.is_custom_type && loc.custom_type_name
        ? `${loc.custom_type_name} 🧩`
        : pretty(loc.location_type);

    return `• **${loc.name}** → ${displayType}${loc.admin_confirmed ? " ✅" : ""}`;
  });

  const picker = new StringSelectMenuBuilder()
    .setCustomId(`${WORLD_PREFIX}:edit_pick`)
    .setPlaceholder("Click a saved location to edit it")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      data.map((loc) => {
        const displayType =
          loc.is_custom_type && loc.custom_type_name
            ? loc.custom_type_name
            : pretty(loc.location_type);

        return {
          label: loc.name.slice(0, 100),
          description: `${pretty(loc.discord_object_type)} • ${displayType}`.slice(0, 100),
          value: loc.id,
        };
      })
    );

  return interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("World Registry")
        .setDescription(
          lines.join("\n") +
          "\n\n**Choose any location below to edit its classification.**"
        ),
    ],
    components: [new ActionRowBuilder().addComponents(picker)],
  });
}

function guessLocationType(channel) {
  const text = `${channel.name || ""} ${"topic" in channel ? channel.topic || "" : ""}`.toLowerCase();

  const explicitMatch = text.match(/lifeline:type=([a-z0-9_]+)/i);
  if (explicitMatch) {
    const explicitType = explicitMatch[1].toLowerCase();
    if (SUPPORTED_LOCATION_TYPES.has(explicitType)) return explicitType;
  }

  if (channel.type === ChannelType.GuildCategory) {
    if (/(heights|neighborhood|district|village|estates|apartments|residential)/.test(text)) {
      return "neighborhood";
    }
    return "other";
  }

  if (/(vet|veterinary|animal hospital|animal clinic)/.test(text)) return "vet_clinic";
  if (/(pet store|pet shop|pet supply|pet supplies)/.test(text)) return "pet_store";
  if (/(dog park|pet park|puppy park)/.test(text)) return "pet_park";
  if (/(pet groom|dog groom|grooming salon|animal groom)/.test(text)) return "pet_groomer";
  if (/(pet daycare|dog daycare|doggy daycare|pet boarding|kennel)/.test(text)) return "pet_daycare";
  if (/(animal shelter|pet shelter|animal rescue|pet rescue|humane society)/.test(text)) return "animal_shelter";
  if (/(pet cafe|pet café|cat cafe|cat café|dog cafe|dog café|pet-friendly cafe|pet-friendly café)/.test(text)) return "pet_cafe";

  if (/(school|academy|high-school|middle-school|elementary|university|college)/.test(text)) return "school";
  if (/(mall|shopping-center)/.test(text)) return "mall";
  if (/(park|playground)/.test(text)) return "park";
  if (/(hospital|clinic|medical|doctor)/.test(text)) return "hospital_clinic";
  if (/(gym|fitness)/.test(text)) return "gym";
  if (/(cafe|café|coffee|restaurant|diner|grill|bar-and-grill|bakery)/.test(text)) return "restaurant_cafe";
  if (/(store|shop|market|mart|boutique|target|walmart)/.test(text)) return "store";
  if (/(station|bus|train|transit|metro|airport)/.test(text)) return "transit";
  if (/(church|community-center|mosque|temple)/.test(text)) return "religious_community";
  if (/(theater|cinema|club|arcade|bowling|museum)/.test(text)) return "entertainment";
  if (/(house|home|apartment|apt-|residence|lane|street|avenue|drive)/.test(text)) return "residence";

  return "unknown";
}

function normalizeCustomLocationType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
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


export async function syncWorldChannel(channel) {
  if (!channel?.guild?.id || !channel?.id) return;

  const objectType =
    channel.type === ChannelType.GuildCategory
      ? "category"
      : channel.isThread?.()
      ? "thread"
      : channel.type === ChannelType.GuildForum
      ? "forum"
      : "channel";

  const channelTopic = "topic" in channel ? channel.topic || null : null;

  const { data: existing, error: lookupError } = await supabase
    .from("npc_world_locations")
    .select(
      "id,location_type,admin_confirmed,custom_type_key,custom_type_name,custom_type_description,is_custom_type"
    )
    .eq("guild_id", channel.guild.id)
    .eq("discord_channel_id", channel.id)
    .maybeSingle();

  if (lookupError) {
    console.error(
      `[LifeLine] Could not check world channel ${channel.name}:`,
      lookupError.message
    );
    return;
  }

  const baseUpdate = {
    guild_id: channel.guild.id,
    discord_channel_id: channel.id,
    parent_discord_category_id: channel.parentId || null,
    name: channel.name,
    channel_name: channel.name,
    channel_topic: channelTopic,
    discord_object_type: objectType,
  };

  // Admin-confirmed classifications always win over automatic re-scans.
  const row = existing?.admin_confirmed
    ? {
        ...baseUpdate,
        location_type: existing.location_type,
        admin_confirmed: true,
        auto_classified: false,
        custom_type_key: existing.custom_type_key || null,
        custom_type_name: existing.custom_type_name || null,
        custom_type_description: existing.custom_type_description || null,
        is_custom_type: Boolean(existing.is_custom_type),
      }
    : {
        ...baseUpdate,
        location_type: guessLocationType(channel),
        admin_confirmed: false,
        auto_classified: true,
        custom_type_key: null,
        custom_type_name: null,
        custom_type_description: null,
        is_custom_type: false,
      };

  const { error } = await supabase
    .from("npc_world_locations")
    .upsert(row, {
      onConflict: "guild_id,discord_channel_id",
    });

  if (error) {
    console.error(
      `[LifeLine] Could not sync world channel ${channel.name}:`,
      error.message
    );
  }
}
