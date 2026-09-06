# NPC Life Simulator Bot — Starter

This is the first working foundation for the NPC bot.

It currently includes:

- Discord login
- automatic slash-command registration
- Supabase connection
- automatic per-server settings initialization
- `/npc status`
- Render-compatible health server
- starter service folders for the systems we are building next

## 1. Environment variables

Create these in Render:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

If your Supabase project still uses the older service-role key, you can use:

- `SUPABASE_SERVICE_ROLE_KEY`

Optional while building:

- `DEV_GUILD_ID`

If `DEV_GUILD_ID` is set, commands are registered only to that server and update almost instantly.

## 2. Render

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

## 3. First test

Once the logs show the bot is online, run:

```text
/npc status
```

You should see a status message showing Discord, Supabase, simulation state, timezone, and the active NPC cap.

## 4. Important Discord setting

Later, this bot will need to read player and Tupperbox messages.

In the Discord Developer Portal, enable:

- Message Content Intent

The code already includes the intent.

## 5. Supabase

Run the previously created `npc_supabase_foundation.sql` before starting this bot.

Never put your Discord token or Supabase secret/service-role key directly into these files.


## Flat `src` layout

All JavaScript files are directly inside `src/`.

```text
src/
  commands.js
  config.js
  db.js
  health.js
  index.js
  memoryService.js
  npc.js
  presenceService.js
  registerCommands.js
  schedulerService.js
  webhookService.js
  worldService.js
```

There are no `src/commands/` or `src/services/` subfolders.
