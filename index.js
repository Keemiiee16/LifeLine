import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import { config } from "./config.js";
import { testSupabaseConnection, ensureGuildSettings } from "./db.js";
import { commands } from "./commands.js";
import { registerCommands } from "./registerCommands.js";
import { startHealthServer } from "./health.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

client.commands = new Collection();

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`NPC bot logged in as ${readyClient.user.tag}.`);

  try {
    await testSupabaseConnection();
    console.log("Supabase connected.");

    for (const guild of readyClient.guilds.cache.values()) {
      await ensureGuildSettings(guild.id);
      console.log(`Guild settings ready: ${guild.name} (${guild.id})`);
    }
  } catch (error) {
    console.error(error);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    await ensureGuildSettings(guild.id);
    console.log(`Initialized settings for new guild: ${guild.name}`);
  } catch (error) {
    console.error("Could not initialize new guild:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Command error: /${interaction.commandName}`, error);

    const message =
      "Something went wrong while running that command. Check the Render logs for the exact error.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, embeds: [] }).catch(() => {});
    } else {
      await interaction.reply({
        content: message,
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

async function boot() {
  startHealthServer(config.port);

  await registerCommands();
  await client.login(config.discordToken);
}

boot().catch((error) => {
  console.error("NPC bot failed to start:", error);
  process.exit(1);
});
