// ============================================================
// LifeLine NPC — Pet + Custom Location Update
// Merge these pieces into npc.js.
// ============================================================

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

async function showWorldLocationTypePicker(
  interaction,
  locationId,
  knownLocation = null
) {
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
      return interaction.reply({
        content: message,
        flags: MessageFlags.Ephemeral,
      });
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
      `Choosing **Other / Custom Type** lets you tell Life Line exactly what this location is.`,
    components: [new ActionRowBuilder().addComponents(typePicker)],
  };

  if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
    return interaction.deferred ? interaction.editReply(payload) : interaction.update(payload);
  }

  return interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  });
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
      `Life Line will use this classification for NPC world behavior.`,
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
    .setPlaceholder("Dance Studio, Arcade, Pet Spa, Recording Studio...")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(80);

  const description = new TextInputBuilder()
    .setCustomId("custom_type_description")
    .setLabel("Description (optional)")
    .setPlaceholder("Explain what NPCs normally do or find here.")
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
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const customTypeName = interaction.fields
    .getTextInputValue("custom_type_name")
    .trim();

  const customTypeDescription = interaction.fields
    .getTextInputValue("custom_type_description")
    .trim();

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
    return interaction.editReply({
      content: `Could not save custom location: ${error.message}`,
    });
  }

  let response =
    `✅ **${data.name}** is now classified as **${data.custom_type_name}**.\n\n` +
    `Life Line will recognize **${data.custom_type_name}** as the actual location type instead of simply treating it as Other.`;

  if (data.custom_type_description) {
    response += `\n\n**Description:** ${data.custom_type_description}`;
  }

  return interaction.editReply({ content: response });
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

// Add this inside handleNpcComponent after the npc_world:edit_type handler:
//
// if (
//   interaction.isModalSubmit() &&
//   id.startsWith(`${WORLD_PREFIX}:custom_type:`)
// ) {
//   const locationId = id.split(":").pop();
//   return saveCustomLocationType(interaction, locationId);
// }

function guessLocationType_UPDATED(channel) {
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
