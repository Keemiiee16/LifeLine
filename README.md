# LifeLine NPC Bot — ROOT-FLAT / GLOBAL COMMANDS

This package is ROOT-FLAT.

Upload every file directly into the main GitHub repository.
There is NO `src` folder.

## GitHub layout

```text
package.json
index.js
config.js
db.js
health.js
commands.js
npc.js
registerCommands.js
memoryService.js
presenceService.js
schedulerService.js
webhookService.js
worldService.js
.env.example
.gitignore
README.md
```

## Render

Root Directory: leave blank

Build Command:

```text
npm install
```

Start Command:

```text
npm start
```

## Environment variables

Required:

- DISCORD_TOKEN
- CLIENT_ID
- SUPABASE_URL
- SUPABASE_SECRET_KEY
- OPENAI_API_KEY
- PORT=3000

If you use the older Supabase service-role key instead of a Secret key:

- SUPABASE_SERVICE_ROLE_KEY

Do NOT add DEV_GUILD_ID. This version registers `/npc` globally so
the command can be available in every server where LifeLine is installed.

## Current slash command

```text
/npc status
```

Render should log:

```text
Registering 1 global command(s)...
Successfully registered 1 global command(s).
NPC bot logged in as ...
Supabase connected.
```
