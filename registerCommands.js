import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commands } from "./commands.js";

export async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(config.discordToken);
    const body = commands.map((command) => command.data.toJSON());

    console.log(`Registering ${body.length} global command(s)...`);

    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body }
    );

    console.log(
      `Successfully registered ${body.length} global command(s).`
    );
  } catch (error) {
    console.error("Global command registration failed:", error);
    throw error;
  }
}

if (process.argv[1]?.endsWith("registerCommands.js")) {
  registerCommands().catch((error) => {
    console.error("Command registration failed:", error);
    process.exit(1);
  });
}
