// Procedural, endlessly-streaming base Backrooms.
//
// The world is an infinite grid of square cells grouped into chunks; chunks
// within `loadRadius` of the player are built, the rest disposed. Everything is
// derived from a per-feature seeded RNG, so layout is deterministic.
//
// LAYOUT ZONES: the grid is partitioned into square zones (`CONFIG.zones`), each
// assigned a layout PROFILE — open space, rooms, a corridor, or an encounter
// area. Generation reads the profile of the zone each cell belongs to, so the
// space changes character as you move. Profiles are fully config-driven (see
// config.js) — this is the knob a developer turns to shape the world.
//
// Within a zone:
//   * WALLS sit on cell edges — common in "rooms", rare in "open" — forming
//     longer runs and closed rooms that never clip through each other.
//   * PILLARS sit at cell centres — rare.
//   * CORRIDOR zones are one long walled hallway spanning the zone.
//   * ENCOUNTER zones are an open clearing with a green floor marker.
//
// LIGHTS are independent of zones: at most one fixture per `lightCellSize`²
// metres (jittered with a margin — see config.js — so two never spawn
// overlapping or too close), each an emissive panel; the nearest few get a
// real point-light
// (managed in main.js) that pools bright light on the floor.
//
// Blockers publish axis-aligned bounding boxes (AABBs) for player collision.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { mulberry32, hashCell } from "./rng.js";
import { roomsInBounds, roomsAffecting, buildRoomGroup, pointInsideAnyRoom } from "./rooms.js";

const { cellSize, wallHeight, pillarSize, wallThickness, chunkCells } = CONFIG;
const span = chunkCells * cellSize; // chunk width in metres
const ZC = CONFIG.zones.cells; // zone size in cells

// Distinct, well-separated RNG streams per feature type.
const SALT = {
  pillar: 0x0001,
  wallS: 0x1001,
  wallW: 0x2001,
  light: 0x3001,
  zone: 0x5001,
  topup: 0x6001,
  arrowS: 0x9001,
  arrowW: 0xa001,
};
function rngFor(salt, a, b) {
  return mulberry32(hashCell(CONFIG.seed ^ salt, a, b));
}

// Shared geometry, built once.
const floorGeo = new THREE.PlaneGeometry(span, span);
const ceilGeo = new THREE.PlaneGeometry(span, span);
const pillarGeo = new THREE.BoxGeometry(pillarSize, wallHeight, pillarSize);
const wallGeoX = new THREE.BoxGeometry(cellSize, wallHeight, wallThickness); // runs along X
const wallGeoZ = new THREE.BoxGeometry(wallThickness, wallHeight, cellSize); // runs along Z
const panelGeo = new THREE.PlaneGeometry(cellSize * 0.5, cellSize * 0.5);
const markerGeo = new THREE.PlaneGeometry(cellSize * 1.0, cellSize * 1.0);
const arrowGeo = new THREE.PlaneGeometry(2.6, 1.3); // wide — matches the scrawled-arrow texture's 2:1 aspect

// True if there's a clear (wall-free) straight run of `steps` cells from the
// arrow's wall, in direction `dir` (+1/-1) along the given axis, on
// whichever row/column the decorated face (faceSign) actually looks out
// onto. Depends on zoneOf/profileFor/corridorForZone/edgeVerdict/wallSouth/
// wallWest/corridorSouth/corridorWest, all defined later in this file as
// hoisted function declarations.
//
// `bounds` + `wallSouthCells`/`wallWestCells` let this see walls added by
// buildChunk's minimum-density "top-up" pass (see there) — those are placed
// by a per-chunk shuffled RNG, not the deterministic wallSouth()/wallWest()
// this function would otherwise fall back to, so a cell inside the current
// chunk could have a top-up wall that the deterministic check knows nothing
// about. For a cell within `bounds`, the (by-then-complete, both natural AND
// top-up) cell sets are authoritative and checked directly; outside it, this
// falls back to the deterministic per-cell check, which only misses a
// neighbouring chunk's OWN top-up walls — a narrower, harder-to-avoid gap
// (that chunk may not even be built yet) than getting confused by this
// chunk's own top-up walls, which is the failure mode this exists to fix.
function directionClear(axis, gx, gy, faceSign, dir, steps, bounds, wallSouthCells, wallWestCells) {
  const inBounds = (x, y) => x >= bounds.gx0 && x < bounds.gx1 && y >= bounds.gy0 && y < bounds.gy1;
  if (axis === "x") {
    const row = faceSign > 0 ? gy : gy - 1;
    for (let i = 1; i <= steps; i++) {
      const edgeX = dir > 0 ? gx + i : gx - i + 1; // wallWest(N,row) = wall between N-1 and N
      if (inBounds(edgeX, row)) {
        if (wallWestCells.has(edgeX + "," + row)) return false;
        continue;
      }
      const { zx, zy } = zoneOf(edgeX, row);
      const profile = profileFor(zx, zy);
      const corridor = profile.corridor ? corridorForZone(zx, zy) : null;
      if (edgeVerdict(corridor, corridorWest, edgeX, row, () => wallWest(edgeX, row, profile))) return false;
    }
  } else {
    const col = faceSign > 0 ? gx : gx - 1;
    for (let i = 1; i <= steps; i++) {
      const edgeZ = dir > 0 ? gy + i : gy - i + 1; // wallSouth(col,N) = wall between N-1 and N
      if (inBounds(col, edgeZ)) {
        if (wallSouthCells.has(col + "," + edgeZ)) return false;
        continue;
      }
      const { zx, zy } = zoneOf(col, edgeZ);
      const profile = profileFor(zx, zy);
      const corridor = profile.corridor ? corridorForZone(zx, zy) : null;
      if (edgeVerdict(corridor, corridorSouth, col, edgeZ, () => wallSouth(col, edgeZ, profile))) return false;
    }
  }
  return true;
}

// Very rare black directional arrow painted on a wall face. `axis` matches
// the wall's own axis ("x" = south wall, spans world X; "z" = west wall,
// spans world Z); (px,pz) is that wall's centre. Deterministic per cell so
// it doesn't flicker in/out as chunks stream. The decal mesh is recreated
// EVERY time this wall segment's chunk is (re)built — including after being
// streamed out and back in, since disposeChunk tears the whole chunk group
// down — otherwise a known arrow you teleport back to would show its bare
// wall with no decal. `world._arrowKeys` only guards the separate "come
// stand here and look at it" entry on `world.arrows` (the T-menu's teleport
// pool), so re-streaming the same cell can't pile up duplicate list entries.
function maybeAddArrow(world, group, materials, salt, gx, gy, axis, px, pz, bounds, wallSouthCells, wallWestCells) {
  const key = axis + "," + gx + "," + gy;
  const rng = rngFor(salt, gx, gy);
  if (rng() >= CONFIG.arrowChance) return;

  const faceSign = rng() < 0.5 ? 1 : -1;

  // Point it toward wherever's actually walkable instead of a coin flip:
  // check a few cells out both ways and mirror toward whichever is clear.
  // If NEITHER direction is actually walkable for `sightCells`, don't paint
  // an arrow here at all — one that points at a wall a couple of tiles out
  // is worse than no arrow, since it's telling the player to go somewhere
  // they can't. Deterministic per cell, so this cleanly and permanently
  // skips that spot rather than flickering in/out as chunks stream.
  const sightCells = 3;
  const posClear = directionClear(axis, gx, gy, faceSign, 1, sightCells, bounds, wallSouthCells, wallWestCells);
  const negClear = directionClear(axis, gx, gy, faceSign, -1, sightCells, bounds, wallSouthCells, wallWestCells);
  let mirror;
  if (posClear && negClear) mirror = rng() < 0.5; // either way genuinely works — pick freely
  else if (posClear) mirror = axis === "x" ? false : true;
  else if (negClear) mirror = axis === "x" ? true : false;
  else return; // neither direction is actually walkable — skip this arrow entirely

  const h = 1.5 + (rng() - 0.5) * 0.8; // roughly eye-height, some vertical jitter
  const mesh = new THREE.Mesh(arrowGeo, materials.arrow);
  let x = px,
    z = pz;
  if (axis === "x") {
    z = pz + faceSign * (wallThickness / 2 + 0.012);
    mesh.position.set(x, h, z);
  } else {
    mesh.rotation.y = Math.PI / 2;
    x = px + faceSign * (wallThickness / 2 + 0.012);
    mesh.position.set(x, h, z);
  }
  mesh.scale.x = mirror ? -1 : 1;
  group.add(mesh);

  // A spot 1.4m out from the same wall face, facing back at the arrow.
  const standOff = 1.4;
  const standX = axis === "x" ? x : px + faceSign * (wallThickness / 2 + standOff);
  const standZ = axis === "x" ? pz + faceSign * (wallThickness / 2 + standOff) : z;
  if (world._arrowKeys.has(key)) return; // decal mesh above is rebuilt every time; the list entry only once
  world._arrowKeys.add(key);
  const dx = x - standX;
  const dz = z - standZ;
  const len = Math.hypot(dx, dz) || 1;
  const yaw = Math.atan2(-dx / len, -dz / len);
  world.arrows.push({ x, z, standX, standZ, yaw });
}

function cellCenter(x, y) {
  return { wx: x * cellSize, wz: y * cellSize };
}

// The spawn zone (0,0) is forced to the "encounter" profile (see
// CONFIG.zones.spawnProfile), so its marker always lands on this cell —
// the player spawns standing on it (see player.js).
const SPAWN_CELL = ZC >> 1;
export const SPAWN_POS = cellCenter(SPAWN_CELL, SPAWN_CELL);
function isSpawnClear(x, y) {
  return Math.abs(x) <= 1 && Math.abs(y) <= 1;
}

// ---------------------------------------------------------------------------
// Zones & profiles.
// ---------------------------------------------------------------------------

const PROFILES = CONFIG.zones.profiles;
const PROFILE_BY_NAME = Object.fromEntries(PROFILES.map((p) => [p.name, p]));
// spawnOnly profiles (currently just "encounter") are never handed out to a
// randomly-rolled zone — they only ever appear via spawnProfile below, so
// there's exactly one green marker on the whole map (see config.js).
const RANDOM_PROFILES = PROFILES.filter((p) => !p.spawnOnly);
const TOTAL_WEIGHT = RANDOM_PROFILES.reduce((s, p) => s + (p.weight ?? 1), 0);
const SPAWN_PROFILE = PROFILE_BY_NAME[CONFIG.zones.spawnProfile] ?? PROFILES[0];

const _profileCache = new Map();
function zoneOf(gx, gy) {
  return { zx: Math.floor(gx / ZC), zy: Math.floor(gy / ZC) };
}
function profileFor(zx, zy) {
  if (zx === 0 && zy === 0) return SPAWN_PROFILE; // fresh corner
  const key = zx + "," + zy;
  let p = _profileCache.get(key);
  if (p) return p;
  let r = rngFor(SALT.zone, zx, zy)() * TOTAL_WEIGHT;
  p = RANDOM_PROFILES[RANDOM_PROFILES.length - 1];
  for (const prof of RANDOM_PROFILES) {
    r -= prof.weight ?? 1;
    if (r < 0) {
      p = prof;
      break;
    }
  }
  _profileCache.set(key, p);
  return p;
}

// A corridor zone holds one long hallway spanning the zone (margin one cell at
// each end so it opens into neighbours). Footprint is inclusive cell bounds.
const _corridorCache = new Map();
function corridorForZone(zx, zy) {
  const key = zx + "," + zy;
  let c = _corridorCache.get(key);
  if (c !== undefined) return c;
  const rng = rngFor(0x4001, zx, zy);
  const axis = rng() < 0.5 ? "x" : "z";
  const width = Math.min(CONFIG.corridorWidth, ZC - 2);
  const baseCol = zx * ZC;
  const baseRow = zy * ZC;
  if (axis === "x") {
    const cross = baseRow + Math.floor((ZC - width) / 2);
    c = { axis, minCol: baseCol + 1, maxCol: baseCol + ZC - 2, minRow: cross, maxRow: cross + width - 1 };
  } else {
    const cross = baseCol + Math.floor((ZC - width) / 2);
    c = { axis, minCol: cross, maxCol: cross + width - 1, minRow: baseRow + 1, maxRow: baseRow + ZC - 2 };
  }
  _corridorCache.set(key, c);
  return c;
}

// Corridor verdict for a cell edge: "wall" (boundary), "clear" (interior/open
// end), or null (not governed).
function corridorSouth(c, gx, gy) {
  if (c.axis === "x") {
    if (gx >= c.minCol && gx <= c.maxCol) {
      if (gy === c.minRow || gy === c.maxRow + 1) return "wall";
      if (gy > c.minRow && gy <= c.maxRow) return "clear";
    }
  } else if (gx >= c.minCol && gx <= c.maxCol && gy >= c.minRow && gy <= c.maxRow + 1) {
    return "clear";
  }
  return null;
}
function corridorWest(c, gx, gy) {
  if (c.axis === "z") {
    if (gy >= c.minRow && gy <= c.maxRow) {
      if (gx === c.minCol || gx === c.maxCol + 1) return "wall";
      if (gx > c.minCol && gx <= c.maxCol) return "clear";
    }
  } else if (gy >= c.minRow && gy <= c.maxRow && gx >= c.minCol && gx <= c.maxCol + 1) {
    return "clear";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normal (non-corridor) blockers, parameterised by the cell's zone profile.
// ---------------------------------------------------------------------------

function pillarAt(gx, gy, profile) {
  if (isSpawnClear(gx, gy)) return false;
  const pc = profile.pillarChance ?? 0;
  return pc > 0 && rngFor(SALT.pillar, gx, gy)() < pc;
}

// Edge walls carry a continuation bonus so they form longer runs / enclosures.
function edgeWall(salt, gx, gy, px, py, profile) {
  const wc = profile.wallChance ?? 0;
  if (wc <= 0) return false;
  const base = rngFor(salt, gx, gy)();
  if (base < wc) return true;
  const cont = profile.wallContinuation ?? 1;
  return rngFor(salt, px, py)() < wc && base < wc * cont;
}
function wallSouth(gx, gy, profile) {
  if (isSpawnClear(gx, gy) || isSpawnClear(gx, gy - 1)) return false;
  return edgeWall(SALT.wallS, gx, gy, gx - 1, gy, profile);
}
function wallWest(gx, gy, profile) {
  if (isSpawnClear(gx, gy) || isSpawnClear(gx - 1, gy)) return false;
  return edgeWall(SALT.wallW, gx, gy, gx, gy - 1, profile);
}

// ---------------------------------------------------------------------------
// Lights — one per lightCellSize² cell at most, jittered inside a margin
// that guarantees minimum spacing between fixtures (see the config.js
// comment on lightCellMargin for why this can't just be independent random
// points — that's what let lights spawn overlapping/too close before).
// ---------------------------------------------------------------------------

function lightsForCell(lcx, lcy) {
  // The spawn cell always gets exactly its one dedicated light and nothing
  // else, so it can't roll a second fixture too close to it.
  if (lcx === 0 && lcy === 0) return [{ x: SPAWN_POS.wx, z: SPAWN_POS.wz }];
  const rng = rngFor(SALT.light, lcx, lcy);
  if (rng() >= CONFIG.lightCellChance) return [];
  const { lightCellSize: L, lightCellMargin: M } = CONFIG;
  const usable = Math.max(L - 2 * M, 0);
  const x = lcx * L + M + rng() * usable;
  const z = lcy * L + M + rng() * usable;
  return [{ x, z }];
}

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map(); // key "cx,cy" -> { group, colliders, lights }
    this.panelMeshes = []; // emissive ceiling panels, for flicker
    this.arrows = []; // { x, z, standX, standZ, yaw } — every arrow found so far this session
    this._arrowKeys = new Set(); // "axis,gx,gy" already registered, so re-streaming a chunk can't duplicate it
  }

  static chunkKey(cx, cy) {
    return cx + "," + cy;
  }

  chunkOf(wx, wz) {
    return { cx: Math.floor((wx + span / 2) / span), cy: Math.floor((wz + span / 2) / span) };
  }

  // The layout profile at a world position (for debug/HUD).
  profileAt(wx, wz) {
    const gx = Math.round(wx / cellSize);
    const gy = Math.round(wz / cellSize);
    const { zx, zy } = zoneOf(gx, gy);
    return profileFor(zx, zy).name;
  }

  // A random special room somewhere out from a world position — every
  // 250x250m region has exactly one, so picking a random region within
  // `spread` regions of (wx,wz) and reading its room off always works.
  randomRoom(wx, wz, spread = 15) {
    const R = CONFIG.specialRooms.regionSize;
    const rx = Math.floor(wx / R) + Math.floor((Math.random() * 2 - 1) * spread);
    const ry = Math.floor(wz / R) + Math.floor((Math.random() * 2 - 1) * spread);
    const rooms = roomsInBounds(rx * R, rx * R + R, ry * R, ry * R + R);
    return rooms[0] ?? null;
  }

  // A RANDOM already-known arrow (see maybeAddArrow) — not the nearest one,
  // which would always hand back the same arrow you just teleported next to
  // (it's trivially the closest thing to itself). If too few are known yet
  // this session, force-builds outward rings of chunks first so there's
  // actually a pool to pick from — arrows are rare (~1 per 12 chunks) but
  // this reliably finds several well before the cap. Chunks built purely for
  // this search get cleaned up by the very next normal world.update() call,
  // since they're outside the player's loadRadius.
  randomArrow(wx, wz, wantKnown = 5, maxRing = 12) {
    if (this.arrows.length < wantKnown) {
      const { cx: pcx, cy: pcy } = this.chunkOf(wx, wz);
      for (let ring = 0; ring <= maxRing && this.arrows.length < wantKnown; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
          for (let dx = -ring; dx <= ring; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const key = World.chunkKey(pcx + dx, pcy + dy);
            if (!this.chunks.has(key)) this.buildChunk(pcx + dx, pcy + dy);
          }
        }
      }
    }
    if (this.arrows.length === 0) return null;
    return this.arrows[Math.floor(Math.random() * this.arrows.length)];
  }

  // Re-roll the world seed and rebuild everything from scratch around
  // (wx,wz). Clears the zone/corridor memoization caches too, since those
  // are keyed only by zone coords and would otherwise still answer with the
  // old seed's layout.
  regenerate(wx, wz) {
    CONFIG.seed = (Math.random() * 0xffffffff) >>> 0;
    _profileCache.clear();
    _corridorCache.clear();
    this.arrows = [];
    this._arrowKeys.clear();
    for (const key of [...this.chunks.keys()]) this.disposeChunk(key);
    this.update(wx, wz);
  }

  update(wx, wz) {
    const { cx, cy } = this.chunkOf(wx, wz);
    const R = CONFIG.loadRadius;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const key = World.chunkKey(cx + dx, cy + dy);
        if (!this.chunks.has(key)) this.buildChunk(cx + dx, cy + dy);
      }
    }
    for (const key of [...this.chunks.keys()]) {
      const [kx, ky] = key.split(",").map(Number);
      if (Math.max(Math.abs(kx - cx), Math.abs(ky - cy)) > R) this.disposeChunk(key);
    }
  }

  lightsForChunk(cx, cy) {
    const L = CONFIG.lightCellSize;
    const minX = cx * span - span / 2;
    const maxX = cx * span + span / 2;
    const minZ = cy * span - span / 2;
    const maxZ = cy * span + span / 2;
    const out = [];
    for (let ry = Math.floor(minZ / L); ry <= Math.floor(maxZ / L); ry++) {
      for (let rx = Math.floor(minX / L); rx <= Math.floor(maxX / L); rx++) {
        for (const p of lightsForCell(rx, ry)) {
          const co = this.chunkOf(p.x, p.z);
          if (co.cx === cx && co.cy === cy) out.push(p);
        }
      }
    }
    return out;
  }

  buildChunk(cx, cy) {
    const group = new THREE.Group();
    const colliders = [];
    const originX = cx * span;
    const originZ = cy * span;
    // `rooms`: rooms whose geometry this chunk actually builds (exactly one
    // chunk per room, since it's keyed on the room's centre). Uses the same
    // centred window as chunkOf()/streaming, so a room's "owning" chunk is
    // always the one that gets built when the player is near it.
    const rooms = roomsInBounds(originX - span / 2, originX + span / 2, originZ - span / 2, originZ + span / 2);
    // `exclusionRooms`: the wider set whose footprint OR escape corridor
    // overlaps the cells THIS chunk actually generates. Note this is NOT the
    // same window as `rooms` above — the generation loop below fills
    // gx/gy = cx*chunkCells..+chunkCells-1, i.e. world space [originX,
    // originX+span), a half-open range starting AT originX, not centred on
    // it (only the floor/ceiling meshes are centred on originX, which is
    // harmless for them since the carpet texture is uniform). Querying with
    // the centred window here would silently miss the back half of the
    // chunk's own cells, letting grid walls/pillars slip into a room's
    // escape corridor undetected.
    //
    // The south/west edge is widened by another half a cell beyond that: a
    // south/west wall's own position (ez/ex below) sits cellSize/2 BEFORE
    // its cell's centre (wx/wz), so the wall for this chunk's very first
    // column/row physically renders up to half a cell outside [originX,
    // originX+span) — outside the window this would otherwise query. Missing
    // that sliver let a room whose edge fell inside it go undetected, letting
    // that wall/pillar generate right through the room undetected.
    const exclusionRooms = roomsAffecting(originX - cellSize / 2, originX + span, originZ - cellSize / 2, originZ + span);

    const floor = new THREE.Mesh(floorGeo, this.materials.carpet);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(originX, 0, originZ);
    if (this.materials.carpet.map) this.materials.carpet.map.repeat.set(chunkCells, chunkCells);
    group.add(floor);

    const ceil = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(originX, wallHeight, originZ);
    group.add(ceil);

    const pillarMatrices = [];
    const wallXMatrices = [];
    const wallZMatrices = [];
    const markerMatrices = [];
    const pillarCells = new Set(); // "gx,gy" already holding a pillar, for top-up dedupe
    const wallSouthCells = new Set(); // "gx,gy" already holding a south wall, for top-up dedupe
    const wallWestCells = new Set(); // "gx,gy" already holding a west wall, for top-up dedupe
    // Every south/west wall built below is a candidate for an arrow decal,
    // but placing arrows here (as this used to) is too early — the
    // minimum-density top-up pass below adds more walls afterward, and an
    // arrow's "is this direction actually walkable" check needs to see ALL
    // of this chunk's walls, top-up included. So this just remembers where
    // the candidates are; the actual maybeAddArrow calls happen once both
    // passes are done and wallSouthCells/wallWestCells are complete.
    const arrowCandidates = [];
    const m = new THREE.Matrix4();

    for (let ly = 0; ly < chunkCells; ly++) {
      for (let lx = 0; lx < chunkCells; lx++) {
        const gx = cx * chunkCells + lx;
        const gy = cy * chunkCells + ly;
        const { wx, wz } = cellCenter(gx, gy);
        const { zx, zy } = zoneOf(gx, gy);
        const profile = profileFor(zx, zy);
        const corridor = profile.corridor ? corridorForZone(zx, zy) : null;

        // Pillar (never in a corridor, never poking into a special room).
        if (!corridor && !pointInsideAnyRoom(exclusionRooms, wx, wz, cellSize) && pillarAt(gx, gy, profile)) {
          m.makeTranslation(wx, wallHeight / 2, wz);
          pillarMatrices.push(m.clone());
          pillarCells.add(gx + "," + gy);
          const h = pillarSize / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - h, maxX: wx + h, minZ: wz - h, maxZ: wz + h });
        }

        // South edge wall (along X).
        const ez = wz - cellSize / 2;
        if (!pointInsideAnyRoom(exclusionRooms, wx, ez, cellSize) && edgeVerdict(corridor, corridorSouth, gx, gy, () => wallSouth(gx, gy, profile))) {
          m.makeTranslation(wx, wallHeight / 2, ez);
          wallXMatrices.push(m.clone());
          wallSouthCells.add(gx + "," + gy);
          const hl = cellSize / 2 + CONFIG.playerRadius;
          const ht = wallThickness / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - hl, maxX: wx + hl, minZ: ez - ht, maxZ: ez + ht });
          arrowCandidates.push({ salt: SALT.arrowS, gx, gy, axis: "x", px: wx, pz: ez });
        }

        // West edge wall (along Z).
        const ex = wx - cellSize / 2;
        if (!pointInsideAnyRoom(exclusionRooms, ex, wz, cellSize) && edgeVerdict(corridor, corridorWest, gx, gy, () => wallWest(gx, gy, profile))) {
          m.makeTranslation(ex, wallHeight / 2, wz);
          wallZMatrices.push(m.clone());
          wallWestCells.add(gx + "," + gy);
          const hl = cellSize / 2 + CONFIG.playerRadius;
          const ht = wallThickness / 2 + CONFIG.playerRadius;
          colliders.push({ minX: ex - ht, maxX: ex + ht, minZ: wz - hl, maxZ: wz + hl });
          arrowCandidates.push({ salt: SALT.arrowW, gx, gy, axis: "z", px: ex, pz: wz });
        }

        // Encounter marker at the zone centre.
        if (profile.encounter && gx === zx * ZC + (ZC >> 1) && gy === zy * ZC + (ZC >> 1)) {
          m.makeRotationX(-Math.PI / 2);
          m.setPosition(wx, 0.02, wz);
          markerMatrices.push(m.clone());
        }
      }
    }

    // Minimum-density top-up: if this chunk rolled too sparse, add structures
    // (deterministically, in a shuffled cell order) until it clears the floor.
    // Mostly walls, with a minority of pillars mixed in for variety.
    // Corridor/encounter cells are skipped — those are meant to stay open.
    const TOPUP_WALL_CHANCE = 0.75;
    let blockerCount = pillarMatrices.length + wallXMatrices.length + wallZMatrices.length;
    if (blockerCount < CONFIG.minBlockersPerChunk) {
      const topupRng = rngFor(SALT.topup, cx, cy);
      const candidates = [];
      for (let ly = 0; ly < chunkCells; ly++) {
        for (let lx = 0; lx < chunkCells; lx++) {
          candidates.push({ gx: cx * chunkCells + lx, gy: cy * chunkCells + ly });
        }
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(topupRng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      for (const { gx, gy } of candidates) {
        if (blockerCount >= CONFIG.minBlockersPerChunk) break;
        if (isSpawnClear(gx, gy)) continue;
        const { zx, zy } = zoneOf(gx, gy);
        const profile = profileFor(zx, zy);
        if (profile.corridor || profile.encounter) continue;
        const { wx, wz } = cellCenter(gx, gy);
        const key = gx + "," + gy;

        if (topupRng() < TOPUP_WALL_CHANCE) {
          const south = topupRng() < 0.5;
          if (south) {
            if (wallSouthCells.has(key)) continue;
            const ez = wz - cellSize / 2;
            // Excludes on the wall's OWN position (ez), not the cell centre —
            // a south wall sits half a cell away from wx,wz, so checking the
            // cell centre here could pass while the wall itself still lands
            // inside a nearby room (see pointInsideAnyRoom's cellSize pad,
            // sized to clear the wall's position, not an offset cell centre).
            if (pointInsideAnyRoom(exclusionRooms, wx, ez, cellSize)) continue;
            m.makeTranslation(wx, wallHeight / 2, ez);
            wallXMatrices.push(m.clone());
            wallSouthCells.add(key);
            const hl = cellSize / 2 + CONFIG.playerRadius;
            const ht = wallThickness / 2 + CONFIG.playerRadius;
            colliders.push({ minX: wx - hl, maxX: wx + hl, minZ: ez - ht, maxZ: ez + ht });
            arrowCandidates.push({ salt: SALT.arrowS, gx, gy, axis: "x", px: wx, pz: ez });
          } else {
            if (wallWestCells.has(key)) continue;
            const ex = wx - cellSize / 2;
            // Same fix as the south-wall branch above, for the west wall's
            // own (offset) position.
            if (pointInsideAnyRoom(exclusionRooms, ex, wz, cellSize)) continue;
            m.makeTranslation(ex, wallHeight / 2, wz);
            wallZMatrices.push(m.clone());
            wallWestCells.add(key);
            const hl = cellSize / 2 + CONFIG.playerRadius;
            const ht = wallThickness / 2 + CONFIG.playerRadius;
            colliders.push({ minX: ex - ht, maxX: ex + ht, minZ: wz - hl, maxZ: wz + hl });
            arrowCandidates.push({ salt: SALT.arrowW, gx, gy, axis: "z", px: ex, pz: wz });
          }
        } else {
          if (pillarCells.has(key)) continue;
          if (pointInsideAnyRoom(exclusionRooms, wx, wz, cellSize)) continue;
          m.makeTranslation(wx, wallHeight / 2, wz);
          pillarMatrices.push(m.clone());
          pillarCells.add(key);
          const h = pillarSize / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - h, maxX: wx + h, minZ: wz - h, maxZ: wz + h });
        }
        blockerCount++;
      }
    }

    // Now that both the main loop and the top-up pass are done, wallSouthCells
    // /wallWestCells hold every wall this chunk actually built — safe to
    // resolve each arrow candidate's "is this direction actually walkable"
    // check against the complete picture (see the arrowCandidates comment
    // above and directionClear's).
    const bounds = { gx0: cx * chunkCells, gx1: cx * chunkCells + chunkCells, gy0: cy * chunkCells, gy1: cy * chunkCells + chunkCells };
    for (const c of arrowCandidates) {
      maybeAddArrow(this, group, this.materials, c.salt, c.gx, c.gy, c.axis, c.px, c.pz, bounds, wallSouthCells, wallWestCells);
    }

    // Every special room gets its own guaranteed ceiling light — without
    // this a room can land far from any grid light and read as pitch black
    // despite being fully furnished. The grid-light cell system (see
    // lightsForCell) already guarantees spacing *within itself*, but a room
    // light sits on a completely independent coordinate system (region-based,
    // not cell-based) — so drop any grid light that would land too close to
    // one, rather than let the two systems spawn on top of each other.
    //
    // The room whose light might conflict isn't necessarily one THIS chunk
    // owns (`rooms`, above) — it can be in a neighbouring chunk, closer to
    // this chunk's grid lights than to its own. So this widens the search
    // the same way exclusionRooms does for wall exclusion: query rooms
    // within the suppression radius of this chunk's bounds, not just rooms
    // centred inside them.
    const lightGap = CONFIG.lightCellMargin * 2;
    const nearbyRoomLights = roomsAffecting(
      originX - span / 2 - lightGap,
      originX + span / 2 + lightGap,
      originZ - span / 2 - lightGap,
      originZ + span / 2 + lightGap
    ).map((r) => ({ x: r.x, z: r.z }));
    const minLightGapSq = lightGap * lightGap;
    const gridLights = this.lightsForChunk(cx, cy).filter(
      (p) => !nearbyRoomLights.some((rl) => (p.x - rl.x) ** 2 + (p.z - rl.z) ** 2 < minLightGapSq)
    );
    const lights = gridLights.concat(rooms.map((r) => ({ x: r.x, z: r.z })));
    const panelMatrices = lights.map((p) => {
      m.makeRotationX(Math.PI / 2);
      m.setPosition(p.x, wallHeight - 0.02, p.z);
      return m.clone();
    });

    this.addInstanced(group, panelGeo, this.materials.lightPanel, panelMatrices, true);
    this.addInstanced(group, markerGeo, this.materials.marker, markerMatrices, false);
    this.addInstanced(group, pillarGeo, this.materials.wall, pillarMatrices, false);
    this.addInstanced(group, wallGeoX, this.materials.wall, wallXMatrices, false);
    this.addInstanced(group, wallGeoZ, this.materials.wall, wallZMatrices, false);

    for (const room of rooms) {
      const built = buildRoomGroup(room, this.materials);
      group.add(built.group);
      colliders.push(...built.colliders);
    }

    this.scene.add(group);
    this.chunks.set(World.chunkKey(cx, cy), { group, colliders, lights });
  }

  addInstanced(group, geo, mat, matrices, isPanel) {
    if (matrices.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = true;
    group.add(mesh);
    if (isPanel) this.panelMeshes.push(mesh);
    return mesh;
  }

  disposeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    chunk.group.traverse((o) => {
      if (o.isInstancedMesh) {
        const idx = this.panelMeshes.indexOf(o);
        if (idx !== -1) this.panelMeshes.splice(idx, 1);
        o.dispose(); // frees instance buffers only — geometry/material are shared, untouched
      } else if (o.isMesh && o.geometry?.userData.disposable) {
        // Per-room geometry (walls/props from rooms.js) isn't shared across
        // chunks like the grid geometry is, so it must be freed here.
        o.geometry.dispose();
      }
    });
    this.scene.remove(chunk.group);
    this.chunks.delete(key);
  }

  collidersNear(wx, wz) {
    const { cx, cy } = this.chunkOf(wx, wz);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(World.chunkKey(cx + dx, cy + dy));
        if (chunk) out.push(...chunk.colliders);
      }
    }
    return out;
  }

  collectLights() {
    const out = [];
    for (const chunk of this.chunks.values()) out.push(...chunk.lights);
    return out;
  }
}

// Resolve a cell edge: a corridor "wall"/"clear" wins over the normal draw.
function edgeVerdict(corridor, fn, gx, gy, normal) {
  if (corridor) {
    const v = fn(corridor, gx, gy);
    if (v === "wall") return true;
    if (v === "clear") return false;
  }
  return normal();
}
