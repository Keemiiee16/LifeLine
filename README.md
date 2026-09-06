# LifeLine NPC Bot — Full Command Pack

ROOT-FLAT package. Upload every file directly to the GitHub repo root.

## Current slash-command tree

```text
/npc status
/npc create
/npc edit
/npc view
/npc search
/npc settings
/npc pause
/npc undo
/npc world setup
```

Discord still counts `/npc` as ONE global parent slash command.
The Render log in this version also prints how many NPC subcommands/actions
are inside it so it is easier to verify registration.

Expected log:

```text
Registering 1 global parent command(s) with 9 NPC action(s)...
Successfully registered 1 global parent command(s) with 9 NPC action(s).
LifeLine logged in as ...
Supabase connected.
```

## Already functional in this pack

- `/npc status`
- `/npc create` opens the first Basic Information pop-out
- `/npc edit` loads an NPC and opens an edit-section picker
- `/npc view`
- `/npc search`
- `/npc settings`
  - universal simulation ON/OFF
  - Life Updates channel picker
  - Admin Notifications channel picker
  - server timezone modal
- `/npc pause`
  - whole simulator
  - one NPC
  - one world location
- `/npc undo` checks the audit history
- `/npc world setup`
  - opens World Setup
  - Scan Server button
  - stores accessible Discord categories/channels in Supabase
  - attempts initial location classification
  - Review Locations button

## Next build step

Continue `/npc create` after Basic Information through:

1. Personality
2. Likes & Habits
3. Home & Neighborhood
4. School
5. Job
6. Transportation
7. Family
8. Existing Relationships
9. Life & Family Preferences
10. AI Personality
11. Autonomy
12. Review & Create
