import "dotenv/config";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseKey) {
  throw new Error(
    "Missing Supabase backend key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY."
  );
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  devGuildId: process.env.DEV_GUILD_ID?.trim() || null,

  supabaseUrl: required("SUPABASE_URL"),
  supabaseKey,

  port: Number(process.env.PORT || 3000),
};
