// Central tuning knobs for the base Backrooms.
// Kept in one place so the world is easy to retune before later systems
// (leak, proximity) start reading from it.
//
// Note on units: distances are in **metres**. One grid cell is `cellSize`
// metres. Area ranges below (light regions, corridor regions) are also metres.

export const CONFIG = {
  // Deterministic layout. A fixed seed means the "fresh corner" a player
  // spawns in is reproducible — cheap insurance for the later shared-world
  // and fresh-corner logic (goal.md §5.2–§5.5).
  seed: 0x8a17c3,

  // Geometry (metres).
  cellSize: 4.2, // footprint of one grid cell
  wallHeight: 3.0, // floor-to-ceiling
  pillarSize: 1.3, // square pillar side length
  wallThickness: 0.3, // thickness of wall segments

  // Chunk streaming. A chunk is chunkCells × chunkCells cells.
  chunkCells: 6,
  loadRadius: 3, // chunks kept loaded around the player (Chebyshev distance)

  // ── Map layout: ZONES ──────────────────────────────────────────────────
  // The world is split into square zones; each zone is assigned one of the
  // layout PROFILES below (weighted-random, deterministic per seed). Walking
  // takes you between zones of different character — open spaces, rooms,
  // corridors, encounter areas. **This is where you shape how the space
  // generates**: edit weights, retune a profile, or add your own.
  //
  // Profile fields (all optional; sensible defaults apply):
  //   weight            relative chance a zone gets this profile
  //   wallChance        per cell-edge wall probability (0 = open, ~0.34 = rooms)
  //   wallContinuation  >1 extends walls into longer runs / enclosures
  //   pillarChance      per-cell pillar probability (rare)
  //   corridor:true     the zone is one long walled hallway
  //   encounter:true    an open clearing with a marker (reserved for encounters)
  zones: {
    cells: 13, // zone size in grid cells (~55 m square)
    spawnProfile: "open", // the fresh corner always uses this
    profiles: [
      { name: "open", weight: 3, wallChance: 0.015, wallContinuation: 2.0, pillarChance: 0.05 },
      { name: "rooms", weight: 3, wallChance: 0.34, wallContinuation: 3.5, pillarChance: 0.01 },
      { name: "corridors", weight: 2, corridor: true },
      { name: "encounter", weight: 1, wallChance: 0.0, pillarChance: 0.0, encounter: true },
    ],
  },
  corridorWidth: 2, // interior width (cells) of corridor-zone hallways

  // Lights. Sparse: a random 1–3 lights per `lightRegion`×`lightRegion` metres,
  // each a bright fixture that pools light on the floor. `maxActiveLights` caps
  // how many real point-lights are lit near the player (perf); the rest still
  // glow as emissive panels.
  lightRegion: 100, // metres — area over which light count is decided
  lightsPerRegionMin: 1,
  lightsPerRegionMax: 3,
  lightRange: 34, // metres a light reaches — bigger = less dark
  lightIntensity: 55, // brightness of each fixture
  lightDecay: 1.5, // falloff; lower = reaches further
  maxActiveLights: 10, // real point-lights lit at once (nearest to player)

  // Player.
  eyeHeight: 1.7,
  playerRadius: 0.35,
  walkSpeed: 4.4, // m/s
  runSpeed: 7.0, // m/s (hold shift, costs stamina)
  accel: 12.0, // approach speed (1/s)

  // Mouse look. `maxLookStep` clamps how far a single mouse movement can turn
  // the view, so a fast flick can't spin the camera 180° or snap to the
  // ceiling/floor. `pitchLimit` stops the view from going fully vertical.
  mouseSensitivity: 0.0022,
  maxLookStep: 0.14, // radians per mouse event (fast-flick guard)
  pitchLimit: 1.45, // ~83° up/down

  // Stamina. Sprinting drains it; standing/walking regenerates it. Once empty
  // you can't sprint again until it recovers past `staminaResume`.
  staminaDrain: 0.34, // per second while sprinting
  staminaRegen: 0.22, // per second while not
  staminaResume: 0.25, // recover to this fraction before sprinting again

  // Fog — hides the streaming boundary and sells the oppressive endlessness.
  fogNear: 3.0,
  fogFar: 30.0,

  // Palette.
  colors: {
    wallpaper: 0xb8a12e,
    carpet: 0x5a4f1c,
    ceiling: 0x8f7f2a,
    lightPanel: 0xfff6cf,
    fog: 0x151206,
  },
};
