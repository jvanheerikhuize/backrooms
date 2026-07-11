---
name: realtime-shared-world
description: Use when building the Node.js backend that makes the Backrooms a shared lobby — real-time player presence, syncing per-section alteration records, persistence, spawn assignment, and NPC presences.
---

# Realtime Shared World (Node.js backend)

Implement the shared-lobby backend from `context/goal.md` §2, §3, §5.2 using
Node.js.

## Responsibilities
- **Presence**: track connected players' positions; broadcast nearby players so
  clients can compute proximity (`first-person-navigation`).
- **Alteration sync**: receive a player's alteration records (`world-leak-system`),
  persist them per section, and push relevant sections to players entering range.
- **Spawn**: on join, assign a **fresh corner** — an un-leaked section far from
  altered space (`procedural-backrooms-generation` §5.5).
- **NPCs**: run server-side NPC presences that also own alteration records, so
  proximity to an NPC leaks their choices in (§5.4). Decide their behavior source
  (scripted, generated, or echoes of past players) per the open question in §7.

## Transport & data
- WebSockets for real-time presence + alteration deltas. Send only nearby
  sections/presences (interest management by section radius).
- Server is authoritative over which alterations exist and where players are.
- Persistence: store alteration records keyed by `sectionId` (start with a
  simple store — JSON/SQLite — behind an interface so it can swap later).
  Decide with §7 whether alterations persist indefinitely or decay/reset.

## Shared code
- Reuse the deterministic `generateSection` and the leak/distortion modules on
  the server so base geometry and distortion match clients exactly. Structure
  those as ES modules importable by both browser and Node.

## Rules
- Send compact alteration records, never full geometry (base is regenerated
  deterministically client-side).
- Node.js backend; specific libraries (ws, etc.) are open per spec §3.
