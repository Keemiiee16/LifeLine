// Presence / 15-active system placeholder.
//
// Priority:
// 1 = required/scheduled
// 2 = planned/social
// 3 = casual/random
//
// Hard max is 15 active NPCs server-wide.
// Higher-priority scheduled NPCs may displace a casual NPC,
// who must naturally narrate leaving before the slot is freed.

export async function requestActiveSlot() {
  throw new Error("Active-slot arbitration has not been implemented yet.");
}
