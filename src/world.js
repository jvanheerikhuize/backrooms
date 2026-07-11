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
// LIGHTS are independent of zones: a sparse 1–3 fixtures per `lightRegion`²
// metres, each an emissive panel; the nearest few get a real point-light
// (managed in main.js) that pools bright light on the floor.
//
// Blockers publish axis-aligned bounding boxes (AABBs) for player collision.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { mulberry32, hashCell } from "./rng.js";

const { cellSize, wallHeight, pillarSize, wallThickness, chunkCells } = CONFIG;
const span = chunkCells * cellSize; // chunk width in metres
const ZC = CONFIG.zones.cells; // zone size in cells

// Distinct, well-separated RNG streams per feature type.
const SALT = { pillar: 0x0001, wallS: 0x1001, wallW: 0x2001, light: 0x3001, zone: 0x5001 };
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
const markerGeo = new THREE.PlaneGeometry(cellSize * 1.4, cellSize * 1.4);

function cellCenter(x, y) {
  return { wx: x * cellSize, wz: y * cellSize };
}
function isSpawnClear(x, y) {
  return Math.abs(x) <= 1 && Math.abs(y) <= 1;
}

// ---------------------------------------------------------------------------
// Zones & profiles.
// ---------------------------------------------------------------------------

const PROFILES = CONFIG.zones.profiles;
const PROFILE_BY_NAME = Object.fromEntries(PROFILES.map((p) => [p.name, p]));
const TOTAL_WEIGHT = PROFILES.reduce((s, p) => s + (p.weight ?? 1), 0);
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
  p = PROFILES[PROFILES.length - 1];
  for (const prof of PROFILES) {
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
// Lights — sparse, region-based (1–3 per lightRegion² metres).
// ---------------------------------------------------------------------------

function lightsForRegion(rx, ry) {
  const rng = rngFor(SALT.light, rx, ry);
  const { lightsPerRegionMin: lo, lightsPerRegionMax: hi, lightRegion: L } = CONFIG;
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const out = [];
  for (let i = 0; i < count; i++) out.push({ x: (rx + rng()) * L, z: (ry + rng()) * L });
  if (rx === 0 && ry === 0) out.push({ x: cellSize, z: cellSize }); // light the fresh corner
  return out;
}

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map(); // key "cx,cy" -> { group, colliders, lights }
    this.panelMeshes = []; // emissive ceiling panels, for flicker
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
    const L = CONFIG.lightRegion;
    const minX = cx * span - span / 2;
    const maxX = cx * span + span / 2;
    const minZ = cy * span - span / 2;
    const maxZ = cy * span + span / 2;
    const out = [];
    for (let ry = Math.floor(minZ / L); ry <= Math.floor(maxZ / L); ry++) {
      for (let rx = Math.floor(minX / L); rx <= Math.floor(maxX / L); rx++) {
        for (const p of lightsForRegion(rx, ry)) {
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
    const m = new THREE.Matrix4();

    for (let ly = 0; ly < chunkCells; ly++) {
      for (let lx = 0; lx < chunkCells; lx++) {
        const gx = cx * chunkCells + lx;
        const gy = cy * chunkCells + ly;
        const { wx, wz } = cellCenter(gx, gy);
        const { zx, zy } = zoneOf(gx, gy);
        const profile = profileFor(zx, zy);
        const corridor = profile.corridor ? corridorForZone(zx, zy) : null;

        // Pillar (never in a corridor).
        if (!corridor && pillarAt(gx, gy, profile)) {
          m.makeTranslation(wx, wallHeight / 2, wz);
          pillarMatrices.push(m.clone());
          const h = pillarSize / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - h, maxX: wx + h, minZ: wz - h, maxZ: wz + h });
        }

        // South edge wall (along X).
        if (edgeVerdict(corridor, corridorSouth, gx, gy, () => wallSouth(gx, gy, profile))) {
          const ez = wz - cellSize / 2;
          m.makeTranslation(wx, wallHeight / 2, ez);
          wallXMatrices.push(m.clone());
          const hl = cellSize / 2 + CONFIG.playerRadius;
          const ht = wallThickness / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - hl, maxX: wx + hl, minZ: ez - ht, maxZ: ez + ht });
        }

        // West edge wall (along Z).
        if (edgeVerdict(corridor, corridorWest, gx, gy, () => wallWest(gx, gy, profile))) {
          const ex = wx - cellSize / 2;
          m.makeTranslation(ex, wallHeight / 2, wz);
          wallZMatrices.push(m.clone());
          const hl = cellSize / 2 + CONFIG.playerRadius;
          const ht = wallThickness / 2 + CONFIG.playerRadius;
          colliders.push({ minX: ex - ht, maxX: ex + ht, minZ: wz - hl, maxZ: wz + hl });
        }

        // Encounter marker at the zone centre.
        if (profile.encounter && gx === zx * ZC + (ZC >> 1) && gy === zy * ZC + (ZC >> 1)) {
          m.makeRotationX(-Math.PI / 2);
          m.setPosition(wx, 0.02, wz);
          markerMatrices.push(m.clone());
        }
      }
    }

    const lights = this.lightsForChunk(cx, cy);
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
        o.dispose();
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
