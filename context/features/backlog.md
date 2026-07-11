# Feature Backlog

The full design lives in [`../goal.md`](../goal.md); each feature below has its
own spec in this folder. **Numbers are stable IDs, not a fixed build order** —
priority can change as insights change. The suggested order and dependencies
are noted per row.

| ID | Feature | Status | Aesthetic / lore root | Depends on |
| --- | --- | --- | --- | --- |
| [01](./01-empty-yellow.md) | The Empty Yellow — walkable base | **Implemented** | §4 base look, §5.1 | — |
| [02](./02-player-influence-leak.md) | Player Influence & The Leak | Designed | §5.3, §5.6, §6.2 | 01 |
| [03](./03-audio-ambience.md) | Audio & Ambience (brown-noise bed) | **Implemented** | §4 ambient audio, §6.5 | 01 |
| [04](./04-found-footage-camera.md) | Found-Footage Camera Layer | Proposed | §4 VHS, §6.9 | 01 |
| [05](./05-fluorescent-flicker.md) | Fluorescent Lighting Overhaul | Proposed | §4 fluorescent buzz | 01 (03 for audio sync) |
| [06](./06-liminal-detail-pass.md) | Liminal Environmental Detail Pass | Proposed | §4 damp/liminal | 01 |
| [07](./07-green-glow-null-zones.md) | The Green Glow & Null Zones | Proposed | §6.7, §6.1 | 01 |
| [08](./08-the-growth.md) | The Growth (corruption state) | Proposed | §6.6, §6.3 | 02 |

## Themes

**Aesthetic / atmosphere** (independent, buildable now on top of 01): 03 audio,
04 found-footage camera, 05 fluorescent overhaul, 06 liminal detail, 07 green
glow. These deepen the look & feel and can ship in any order.

**Core mechanic**: 02 the leak — the signature system every later mechanic
builds on. 08 the Growth extends it into a corruption state.

**Not yet specced** (from `goal.md`, later): the shared-world backend + real-time
sync, proximity reflection of other players, NPCs / Still Lifes / entities, and
noclip threshold traversal between zones.
