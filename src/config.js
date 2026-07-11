// Central tuning knobs for Feature 01 — The Empty Yellow.
// Kept in one place so the base world is easy to retune before later
// systems (leak, proximity) start reading from it.

export const CONFIG = {
  // Deterministic layout. A fixed seed means the "fresh corner" a player
  // spawns in is reproducible — cheap insurance for the later shared-world
  // and fresh-corner logic (goal.md §5.2–§5.5).
  seed: 0x8a17c3,

  // Geometry (metres).
  cellSize: 4.2, // footprint of one grid cell
  wallHeight: 3.0, // floor-to-ceiling
  pillarSize: 1.3, // square pillar side length

  // Chunk streaming. A chunk is chunkCells × chunkCells cells.
  chunkCells: 6,
  loadRadius: 3, // chunks kept loaded around the player (Chebyshev distance)

  // Layout density (probabilities per cell, evaluated with the seeded RNG).
  pillarChance: 0.16,
  wallSegmentChance: 0.06,

  // Player.
  eyeHeight: 1.7,
  playerRadius: 0.35,
  walkSpeed: 4.4, // m/s
  runSpeed: 7.0, // m/s (hold shift)
  accel: 12.0, // approach speed (1/s)

  // Fog — hides the streaming boundary and sells the oppressive endlessness.
  fogNear: 3.0,
  fogFar: 26.0,

  // Palette.
  colors: {
    wallpaper: 0xb8a12e,
    carpet: 0x5a4f1c,
    ceiling: 0x8f7f2a,
    lightPanel: 0xfff6cf,
    fog: 0x151206,
  },
};
