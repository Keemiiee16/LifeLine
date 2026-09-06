# NPC Life Simulator Bot — ROOT-FLAT VERSION

IMPORTANT: There is NO `src` folder in this version.

Upload every file in this ZIP directly into the main/root of the GitHub repository.

Your GitHub repo should look like:

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

## Render settings

Root Directory: leave blank

Build Command:

```text
npm install
```

Start Command:

```text
npm start
```

`npm start` runs:

```text
node index.js
```

## Render environment variables

- DISCORD_TOKEN
- CLIENT_ID
- DEV_GUILD_ID
- SUPABASE_URL
- SUPABASE_SECRET_KEY
- OPENAI_API_KEY
- PORT=3000

If using the older Supabase key instead, use:
- SUPABASE_SERVICE_ROLE_KEY

Do not upload your real `.env` or any secret values to GitHub.
