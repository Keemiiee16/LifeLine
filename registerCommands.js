import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commands } from "./commands.js";

export async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  if (config.devGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(
        config.clientId,
        config.devGuildId
      ),
      { body }
    );

    console.log(
      `Registered ${body.length} guild command(s) in ${config.devGuildId}.`
    );
    return;
  }

  await rest.put(
    Routes.applicationCommands(config.clientId),
    { body }
  );

  console.log(`Registered ${body.length} global command(s).`);
}

if (process.argv[1]?.endsWith("registerCommands.js")) {
  registerCommands().catch((error) => {
    console.error("Command registration failed:", error);
    process.exit(1);
  });
}
