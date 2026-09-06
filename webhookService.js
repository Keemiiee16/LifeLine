// NPC webhook identity placeholder.
//
// Future behavior:
// - NPCs speak using their own name/avatar
// - movement narration uses NPC identity
// - channel webhook can override username/avatar per message
// - player/Tupper interruptions can be handled naturally

export async function sendAsNpc() {
  throw new Error("NPC webhook sending has not been implemented yet.");
}
