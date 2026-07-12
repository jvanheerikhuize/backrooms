// Central tuning knobs for the base Backrooms.
// Kept in one place so the world is easy to retune before later systems
// (leak, proximity) start reading from it.
//
// Note on units: distances are in **metres**. One grid cell is `cellSize`
// metres. Area ranges below (light regions, corridor regions) are also metres.

export const CONFIG = {
  // Layout seed. Randomised per page load so the maze is different every time
  // you play; everything downstream (zones, walls, lights, rooms) is still
  // fully deterministic *within* a session — only reloading reshuffles it.
  seed: (Math.random() * 0xffffffff) >>> 0,

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
  //   spawnOnly:true    excluded from random zone assignment — only reachable
  //                     via `spawnProfile` below, so there's exactly one on
  //                     the whole map (the spawn marker).
  zones: {
    cells: 13, // zone size in grid cells (~55 m square)
    spawnProfile: "encounter", // the fresh corner always uses this — player spawns on its marker
    profiles: [
      { name: "open", weight: 3, wallChance: 0.045, wallContinuation: 4.0, pillarChance: 0.08 },
      { name: "rooms", weight: 3, wallChance: 0.34, wallContinuation: 5.0, pillarChance: 0.01 },
      { name: "corridors", weight: 2, corridor: true },
      { name: "encounter", weight: 1, wallChance: 0.0, pillarChance: 0.0, encounter: true, spawnOnly: true },
    ],
  },
  corridorWidth: 2, // interior width (cells) of corridor-zone hallways

  // "Someone was here" rooms — enclosed rooms, roughly one per 250x250m
  // region (deterministic, jittered within an inner margin so rooms in
  // neighbouring regions never end up closer than 2*margin apart). Each is
  // enclosed by either 3 bare walls (the 4th side fully open) or all 4 walls
  // with a doorway-sized gap — always enterable. Each holds a themed trace
  // of a past occupant — festival leftovers, toys, a camp, or stored crates.
  specialRooms: {
    regionSize: 250, // metres — at most one room per region
    margin: 24, // metres kept clear from the region edge on all sides
    sizeMin: 9, // metres — room footprint range
    sizeMax: 15,
    entranceGap: 1.8, // metres — doorway width for the "gap" enclosure style
    minProps: 7, // floor props (table/chairs/crates/etc, not walls) a room tops up to via extra research clutter
  },

  // Black directional wall arrows — a very rare bit of set-dressing. Rolled
  // once per generated wall segment.
  arrowChance: 0.004,

  // Minimum-density floor. Natural per-cell probabilities can still roll a
  // near-empty patch; if a chunk ends up with fewer than this many
  // walls+pillars combined, extra pillars are added deterministically until
  // the floor is met (corridor/encounter zones are exempt — they're meant to
  // stay open).
  minBlockersPerChunk: 20,

  // Lights. The map is divided into lightCellSize² cells; each has a
  // lightCellChance chance of holding one fixture, jittered inside a margin
  // that guarantees two lights (even in adjacent cells, the closest they can
  // ever land) are never closer than 2*lightCellMargin apart — this is what
  // stops fixtures from ever spawning inside each other or stacked too close
  // (same jittered-grid technique specialRooms uses for its min-distance
  // guarantee). Each a bright fixture that pools light on the floor.
  // `maxActiveLights` caps how many real point-lights are lit near the
  // player (perf); the rest still glow as emissive panels.
  lightCellSize: 35, // metres
  lightCellChance: 0.25, // ~= the old average of 1-3 lights per 100x100m
  lightCellMargin: 13, // metres — guarantees >=26m between any two fixtures
  lightRange: 42, // metres a light reaches — bigger = less dark
  lightIntensity: 80, // brightness of each fixture
  lightDecay: 1.3, // falloff; lower = reaches further
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
