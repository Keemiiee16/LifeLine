import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

export async function testSupabaseConnection() {
  const { error } = await supabase
    .from("npc_guild_settings")
    .select("guild_id")
    .limit(1);

  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}`);
  }

  return true;
}

export async function ensureGuildSettings(guildId) {
  const { error: insertError } = await supabase
    .from("npc_guild_settings")
    .upsert(
      { guild_id: guildId },
      {
        onConflict: "guild_id",
        ignoreDuplicates: true,
      }
    );

  if (insertError) {
    throw new Error(
      `Could not initialize guild settings: ${insertError.message}`
    );
  }

  const { data, error } = await supabase
    .from("npc_guild_settings")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error) {
    throw new Error(`Could not load guild settings: ${error.message}`);
  }

  return data;
}

export async function getActiveNpcCount(guildId) {
  const { count, error } = await supabase
    .from("npc_presence")
    .select("npc_id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .in("state", ["pending_active", "active", "leaving"]);

  if (error) {
    throw new Error(`Could not count active NPCs: ${error.message}`);
  }

  return count ?? 0;
}
