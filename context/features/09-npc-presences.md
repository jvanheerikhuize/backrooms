# Feature 09 — NPC Presences (mock multiplayer)

> Status: **proposed / not started**
> Derives from: [`../goal.md`](../goal.md) §5.2 (shared world), §5.4 (proximity
> reflection), §6.4 (Still Lifes), §7 (NPCs).
> Depends on: Feature 02 (leak/influence) — NPCs drive the same influence system.
> This is a living feature doc; scope may shift as [`../goal.md`](../goal.md) evolves.

## 1. Purpose

Deliver the "other presences" experience **without networking**. While the game
is single-player (see `goal.md` "Current scope"), NPCs stand in for other
players: locally-simulated presences that each carry a **signature**, wander the
Backrooms, leak into the world around them, and trigger **proximity reflection**
when you get close. This is what makes a solo world feel shared and haunted —
and it is deliberately built so that a networked player can later replace an NPC
with no change to the leak/proximity systems.

## 2. Why NPCs now

- They provide the shared-lobby *feel* (§5.2) with zero backend risk.
- They exercise the exact same machinery multiplayer will use: a presence with a
  signature that writes influence and asserts proximity. Networking later just
  swaps the *source* of a presence from "local AI" to "remote player."
- They unlock §5.4 (proximity reflection), which is otherwise unobservable
  single-player, and set up §6.4 Still Lifes (an NPC as a warped human echo).

## 3. Scope (in)

- A **Presence** abstraction shared by the player and NPCs: position + signature
  + influence writing. (Feature 02 should already model this; this feature adds
  NPC-controlled presences.)
- **NPC wandering** — a handful of NPCs roam the world with simple behaviour
  (drift, pause, meander), each seeded with a distinct signature.
- **NPC leak** — an NPC continuously leaks its signature into its surrounding
  section, exactly like the player (§5.3, §5.6), so you find zones altered by
  "someone" who isn't you.
- **Proximity reflection (§5.4)** — when you are near an NPC, its signature
  becomes dominant in your view; the transition blends in/out as you approach
  and leave.
- **A visible form for the NPC** — at minimum a distorted humanoid silhouette /
  "Still Life" (§6.4): present, uncanny, wrong — not a clean character model.

## 4. Scope (out — deferred)

- All networking / real multiplayer — this feature is the *mock*; the backend
  feature later swaps NPC-driven presences for networked ones.
- NPC pathfinding / navigation meshes — simple steering is enough in an open,
  pillar-sparse world.
- Entity threat behaviour / the Lifeform hunting, audio mimicry combat — later.
- Dialogue, quests, or any goal-directed AI — presences are ambient, not agents
  you interact with.

## 5. Acceptance criteria

1. One or more NPCs exist in the world, each with a distinct signature, moving
   under their own behaviour.
2. A section an NPC lingers in is visibly leaked toward *that NPC's* signature,
   distinct from the player's own leak.
3. Approaching an NPC makes its influence dominant in the surrounding view, and
   the effect fades as you leave (proximity reflection).
4. The NPC has an uncanny visible form.
5. Presences are driven through a shared interface, so an NPC and a (future)
   networked player are interchangeable to the leak/proximity systems.

## 6. Open questions

- How many NPCs at once, and do they persist/despawn as you roam?
- Do NPCs react to *your* leak, or only emit their own?
- Blending rule when the player, an NPC, and a leaked zone overlap (§7 proximity
  mechanics) — whose signature wins, and how is it mixed?
- Should some NPCs be "echoes" that retrace a recorded path (a seed for §6.4
  Still Lifes and, later, echoes of past real players)?
