# Feature Backlog

The full design lives in [`../goal.md`](../goal.md); each feature below has its
own spec. **Numbers are stable IDs, not a fixed build order** — priority can
change as insights change. The suggested order and dependencies are noted per row.

## Folder layout

Feature specs reflect their status through *where they live*:

- **`./` (this folder)** — proposed / designed / in-progress features.
- **[`./completed/`](./completed/)** — shipped features (spec kept as the design
  record).

When a feature ships, its spec moves into `completed/` as part of that feature's
final commit — see the workflow note at the bottom.

> **Scope: single-player.** The game is single-player for now (no backend). The
> shared-lobby vision is delivered by **NPCs** that mock networked players.
> Multiplayer is deferred — see [`../goal.md`](../goal.md) "Current scope".

| ID | Feature | Status | Aesthetic / lore root | Depends on |
| --- | --- | --- | --- | --- |
| [01](./completed/01-empty-yellow.md) | The Empty Yellow — walkable base | ✅ **Done** | §4 base look, §5.1 | — |
| [02](./02-player-influence-leak.md) | Player Influence & The Leak | Designed | §5.3, §5.6, §6.2 | 01 |
| [03](./completed/03-audio-ambience.md) | Audio & Ambience (brown-noise bed) | ✅ **Done** | §4 ambient audio, §6.5 | 01 |
| [04](./04-found-footage-camera.md) | Found-Footage Camera (Cut-Scene Layer) | 🔨 Built (review) | §4 VHS, §6.9 | 01 |
| [05](./05-fluorescent-flicker.md) | Fluorescent Lighting Overhaul | Proposed | §4 fluorescent buzz | 01 (03 for audio sync) |
| [06](./06-liminal-detail-pass.md) | Liminal Environmental Detail Pass | Proposed | §4 damp/liminal | 01 |
| [07](./07-green-glow-null-zones.md) | The Green Glow & Null Zones | Proposed | §6.7, §6.1 | 01 |
| [08](./08-the-growth.md) | The Growth (corruption state) | Proposed | §6.6, §6.3 | 02 |
| [09](./09-npc-presences.md) | NPC Presences (mock multiplayer) | Proposed | §5.2, §5.4, §6.4 | 02 |

## Themes

**Aesthetic / atmosphere** (independent, buildable now on top of 01): 04
found-footage camera, 05 fluorescent overhaul, 06 liminal detail, 07 green
glow. These deepen the look & feel and can ship in any order. (03 audio — done.)

**Core mechanic**: 02 the leak — the signature system every later mechanic
builds on. 09 NPC presences then mock "other players" so proximity reflection
works single-player; 08 the Growth extends the leak into a corruption state.

**Deferred until multiplayer**: the shared-world backend + real-time sync, and
proximity reflection of *networked* players (NPCs cover this single-player).

**Not yet specced** (from `goal.md`, later): Still Lifes / entities, and noclip
threshold traversal between zones.

## Workflow

- A new feature is built on its own branch (`feature/NN-slug`) and delivered via
  a PR; small tweaks to an already-shipped feature can go straight to `main`.
- Before opening a feature's PR, update the docs in the same branch: flip the
  spec's Status to *implemented*, update this backlog row, refresh the root
  README, and **move the spec into [`./completed/`](./completed/)** (fixing its
  relative links — it drops one directory deeper).
