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

  // Geometry (metres). The cell is the width of a hallway, so it sets the scale
  // of everything: at 3 m a corridor feels like a real corridor you could touch
  // both walls of, and a 3-cell room is a believable 9 m office. The ceiling sits
  // low on purpose — Kane's Level 0 is oppressive because it's *short*, not tall.
  cellSize: 3.0, // footprint of one grid cell = the width of a hallway
  wallHeight: 2.7, // floor-to-ceiling
  pillarSize: 1.0, // square pillar side length
  wallThickness: 0.24, // thickness of wall segments

  // Doorways. `width` must stay comfortably under cellSize — the wall either
  // side of an opening is (cellSize - width) / 2, and that has to be a wall you
  // can actually see rather than a sliver.
  doors: {
    width: 1.05,
    height: 2.1,
    leafThickness: 0.045,
    jamb: 0.07, // frame/architrave thickness
  },

  // Chunk streaming. A chunk is chunkCells × chunkCells cells.
  chunkCells: 6,
  loadRadius: 3, // chunks kept loaded around the player (Chebyshev distance)

  // ── Map layout: ZONES ──────────────────────────────────────────────────
  // The world is split into square zones; each zone is assigned one of the
  // layout PROFILES below (weighted-random, deterministic per seed). Walking
  // takes you between zones of different character. **This is where you shape
  // how the space generates**: edit weights, retune a profile, or add your own.
  //
  // Every zone — whatever its profile — is ringed by a corridor, and that ring
  // opens into its neighbours' rings. That's what guarantees you can always get
  // out of anywhere, and it's why the interiors below are free to be as hostile
  // as they like. See the header of layout.js; it's the load-bearing idea.
  //
  // `cells` must stay at 13 for the office profile: its interior is 11 cells,
  // which is exactly three 3-cell rooms plus two 1-cell hallway lanes.
  //
  // Profile fields (all optional):
  //   weight            relative chance a zone gets this profile
  //   offices:true      a 3x3 grid of walled rooms off crossing hallway lanes
  //   maze:true         a braided recursive-backtracker corridor maze
  //   encounter:true    an open clearing with a marker (reserved for encounters)
  //   spawnOnly:true    excluded from random assignment — only reachable via
  //                     `spawnProfile`, so there's exactly one on the whole map
  //   wallChance        (open halls only) per cell-edge wall probability
  //   wallContinuation  (open halls only) >1 extends walls into longer runs
  //   pillarChance      (open halls only) per-cell pillar probability
  zones: {
    cells: 13, // zone size in grid cells (39 m square at cellSize 3)
    spawnProfile: "encounter", // the fresh corner always uses this — player spawns on its marker
    profiles: [
      // weight was 4, then 2 (of a 9-weight, then 7-weight pool) — now 1 (of
      // 6, ~17% of zones) to make the walled-office-bundles-with-doors zones
      // less common. Also shrunk to a 2x2 room grid — see BLOCKS/LANES in
      // layout.js's buildOffices — instead of the original 3x3.
      { name: "offices", weight: 1, offices: true },
      { name: "maze", weight: 2, maze: true },
      // The classic Backrooms: no floor plan, just open space and pillars. Kept
      // as a minority — a built-up floor only reads as oppressive if you
      // sometimes walk out of one into nothing at all.
      // pillarChance was 0.1 — halved to make pillars less common.
      { name: "halls", weight: 3, wallChance: 0.06, wallContinuation: 4.0, pillarChance: 0.05 },
      { name: "encounter", weight: 1, encounter: true, spawnOnly: true },
    ],
  },

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

  // Fluorescent troffer — the recessed rectangular fixture in the ceiling grid.
  // A 2x4-foot panel, the ubiquitous office light, and the single most
  // recognisable object in the whole aesthetic.
  troffer: {
    length: 1.25,
    width: 0.6,
  },

  // Lights. The map is divided into lightCellSize² cells; each has a
  // lightCellChance chance of holding one fixture, jittered inside a margin
  // that guarantees two lights (even in adjacent cells, the closest they can
  // ever land) are never closer than 2*lightCellMargin apart — this is what
  // stops fixtures from ever spawning inside each other or stacked too close
  // (same jittered-grid technique specialRooms uses for its min-distance
  // guarantee). `maxActiveLights` caps how many real point-lights are lit near
  // the player (perf); the rest still glow as emissive panels.
  //
  // Reverted to the pre-rewrite values (sparser, brighter, farther-reaching
  // fixtures). The denser/dimmer Kane Pixels tuning this replaced is saved
  // here in case it comes back later:
  //   lightCellSize: 11, lightCellChance: 0.8, lightCellMargin: 3.5,
  //   lightRange: 22, lightIntensity: 30, lightDecay: 1.5, maxActiveLights: 18
  lightCellSize: 35, // metres
  lightCellChance: 0.25, // ~= the old average of 1-3 lights per 100x100m
  lightCellMargin: 13, // metres — guarantees >=26m between any two fixtures
  lightRange: 42, // metres a light reaches — bigger = less dark
  lightIntensity: 62, // brightness of each fixture (was 80 — a little less bright)
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

  // Points meter. Starts full and slowly drains over time; in-game actions
  // (not yet wired up) will top it back up via player.addPoints().
  pointsMax: 100,
  pointsDecayAmount: 1, // lost per tick
  pointsDecayInterval: 20, // seconds between decay ticks

  // Sanity effects. Above sanityFrayStart, nothing changes (full sanity =
  // normal game). Between sanityFrayStart and sanityFrayEnd, film grain and
  // the ambience's reactivity ramp up linearly — a "things start fraying"
  // feel that's purely cosmetic/aural, not anything that dims or obscures
  // the scene (visibility stays the same).
  sanityFrayStart: 70,
  sanityFrayEnd: 40,
  sanityGrainMax: 0.34, // uGrain at/below sanityFrayEnd (normal is 0.12)
  sanityReactivityMax: 0.7, // ambience reactivity at/below sanityFrayEnd

  // Low sanity (sanityFrayEnd down to sanityFlashEnd): every random 3-5
  // points lost, a low-opacity red/grey tint pulses twice — once at the start
  // and once at the end of a sanityFlashSpan-second window — rather than one
  // continuous flash.
  sanityFlashEnd: 15,
  sanityFlashLossMin: 3,
  sanityFlashLossMax: 5,
  sanityFlashSpan: 2, // seconds, start-of-span pulse to end-of-span pulse
  sanityFlashPulseLen: 0.5, // seconds each pulse fades in and back out over
  sanityFlashMaxOpacity: 0.3, // tint layer's peak opacity (low, not a full flash)

  // Fog — hides the streaming boundary and sells the oppressive endlessness.
  // Pulled back from the old wall-of-black: in the footage you *can* see down a
  // corridor, and the dread is that it keeps going, not that it's hidden.
  fogNear: 4.5,
  fogFar: 34.0,

  // Palette. Stage 1's wall/carpet/ceiling are back to the original sickly-yellow
  // look (see wallpaperTexture/carpetTexture/ceilingTexture in materials.js) —
  // the Kane Pixels found-footage palette these replaced is saved below in case
  // that look comes back later:
  //   wallpaper: 0x9e9264, carpet: 0x6b5c33, ceiling: 0xcfccc2, lightPanel: 0xf6f2e2
  colors: {
    wallpaper: 0xb8a12e,
    carpet: 0x5a4f1c,
    ceiling: 0x8f7f2a,
    lightPanel: 0xfff6cf,
    fog: 0x14120c, // murky near-black; keeps distance grounded rather than yellow
    baseboard: 0x3a352d, // dark scuffed vinyl skirting at the wall/floor junction
    doorFrame: 0xd6d0c0, // painted trim — grubby cream
    door: 0xa7a294, // institutional beige-grey painted door leaf
  },
};
