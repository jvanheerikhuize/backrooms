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

  // Blockers. Pillars are now rare; walls are common and sit on cell edges so
  // they form longer runs and closed-off areas without ever clipping through
  // each other.
  pillarChance: 0.02, // per interior cell — rare
  wallChance: 0.16, // per cell edge — common
  wallContinuation: 3.0, // multiplier that extends walls into longer runs

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

  // Corridors. Long walled hallways: at most one per `corridorRegion` metres,
  // kept well clear of neighbours and of normal walls/pillars.
  corridorRegion: 500, // metres — one corridor per region
  corridorChance: 0.65, // chance a given region actually has one
  corridorLenMin: 8, // cells long
  corridorLenMax: 16,
  corridorWidth: 2, // cells wide (interior)

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
