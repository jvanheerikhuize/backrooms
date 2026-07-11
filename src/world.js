// Procedural, endlessly-streaming base Backrooms.
//
// The world is an infinite grid of square cells grouped into chunks; chunks
// within `loadRadius` of the player are built, the rest disposed. Everything is
// derived from a per-feature seeded RNG, so layout is deterministic.
//
// What a chunk contains:
//   * Floor + ceiling planes.
//   * Sparse LIGHT fixtures — a random 1–3 per `lightRegion`² metres. Each is an
//     emissive ceiling panel; the nearest few also get a real point-light
//     (managed in main.js) that pools bright light on the floor.
//   * WALLS on cell edges — common, forming longer runs and closed-off areas
//     that never clip through each other (edges meet at grid vertices).
//   * PILLARS at cell centres — rare.
//   * CORRIDORS — long walled hallways, at most one per `corridorRegion`² metres
//     and kept clear of other walls/pillars/corridors.
//
// Blockers publish axis-aligned bounding boxes (AABBs) for player collision.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { mulberry32, hashCell } from "./rng.js";

const {
  cellSize,
  wallHeight,
  pillarSize,
  wallThickness,
  chunkCells,
} = CONFIG;

const span = chunkCells * cellSize; // chunk width in metres

// Distinct, well-separated RNG streams per feature type.
const SALT = { pillar: 0x0001, wallS: 0x1001, wallW: 0x2001, light: 0x3001, corridor: 0x4001 };
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

// Grid cell → world centre. Grid X maps to world X, grid Y maps to world Z.
function cellCenter(x, y) {
  return { wx: x * cellSize, wz: y * cellSize };
}

// Cells kept clear so the player's spawn ("fresh corner") is walkable.
function isSpawnClear(x, y) {
  return Math.abs(x) <= 1 && Math.abs(y) <= 1;
}

// ---------------------------------------------------------------------------
// Lights — sparse, region-based (1–3 per lightRegion² metres).
// ---------------------------------------------------------------------------

function lightsForRegion(rx, ry) {
  const rng = rngFor(SALT.light, rx, ry);
  const { lightsPerRegionMin: lo, lightsPerRegionMax: hi, lightRegion: L } = CONFIG;
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: (rx + rng()) * L, z: (ry + rng()) * L });
  }
  // Guarantee the fresh corner is lit.
  if (rx === 0 && ry === 0) out.push({ x: cellSize, z: cellSize });
  return out;
}

// ---------------------------------------------------------------------------
// Corridors — at most one per corridorRegion² metres, worked in cell space.
// ---------------------------------------------------------------------------

const CORRIDOR_REGION_CELLS = Math.round(CONFIG.corridorRegion / cellSize);
const CORRIDOR_MARGIN = Math.ceil(50 / cellSize); // ≥50 m from region edge → ≥100 m apart

function corridorForRegion(Rx, Ry) {
  const rng = rngFor(SALT.corridor, Rx, Ry);
  if (rng() > CONFIG.corridorChance) return null;

  const axis = rng() < 0.5 ? "x" : "z";
  const len = CONFIG.corridorLenMin + Math.floor(rng() * (CONFIG.corridorLenMax - CONFIG.corridorLenMin + 1));
  const width = CONFIG.corridorWidth;
  const spanCols = axis === "x" ? len : width;
  const spanRows = axis === "x" ? width : len;

  const RC = CORRIDOR_REGION_CELLS;
  const freeX = RC - 2 * CORRIDOR_MARGIN - spanCols;
  const freeY = RC - 2 * CORRIDOR_MARGIN - spanRows;
  if (freeX < 0 || freeY < 0) return null;

  const minCol = Rx * RC + CORRIDOR_MARGIN + Math.floor(rng() * (freeX + 1));
  const minRow = Ry * RC + CORRIDOR_MARGIN + Math.floor(rng() * (freeY + 1));
  const maxCol = minCol + spanCols - 1;
  const maxRow = minRow + spanRows - 1;

  // Never carve a corridor through the spawn corner.
  if (minCol <= 2 && maxCol >= -2 && minRow <= 2 && maxRow >= -2) return null;

  return { axis, minCol, maxCol, minRow, maxRow };
}

// What a corridor dictates for a given cell edge / interior:
//   "wall"  → force a boundary wall here
//   "clear" → suppress any wall here (corridor interior / open end)
//   null    → corridor doesn't govern this edge
function corridorSouth(c, gx, gy) {
  if (c.axis === "x") {
    if (gx >= c.minCol && gx <= c.maxCol) {
      if (gy === c.minRow || gy === c.maxRow + 1) return "wall"; // long side walls
      if (gy > c.minRow && gy <= c.maxRow) return "clear"; // interior
    }
  } else {
    // open along Z → suppress horizontal edges through the corridor
    if (gx >= c.minCol && gx <= c.maxCol && gy >= c.minRow && gy <= c.maxRow + 1) return "clear";
  }
  return null;
}
function corridorWest(c, gx, gy) {
  if (c.axis === "z") {
    if (gy >= c.minRow && gy <= c.maxRow) {
      if (gx === c.minCol || gx === c.maxCol + 1) return "wall"; // long side walls
      if (gx > c.minCol && gx <= c.maxCol) return "clear"; // interior
    }
  } else {
    // open along X → suppress vertical edges through the corridor
    if (gy >= c.minRow && gy <= c.maxRow && gx >= c.minCol && gx <= c.maxCol + 1) return "clear";
  }
  return null;
}
function corridorInterior(c, gx, gy) {
  return gx >= c.minCol && gx <= c.maxCol && gy >= c.minRow && gy <= c.maxRow;
}

// ---------------------------------------------------------------------------
// Normal blockers.
// ---------------------------------------------------------------------------

function pillarAt(gx, gy) {
  if (isSpawnClear(gx, gy)) return false;
  return rngFor(SALT.pillar, gx, gy)() < CONFIG.pillarChance;
}

// Edge walls carry a continuation bonus: an edge is far more likely to be a
// wall if the colinear neighbour is one, so walls form longer runs.
function edgeWall(salt, gx, gy, px, py) {
  const base = rngFor(salt, gx, gy)();
  if (base < CONFIG.wallChance) return true;
  const prev = rngFor(salt, px, py)();
  return prev < CONFIG.wallChance && base < CONFIG.wallChance * CONFIG.wallContinuation;
}
// South edge runs along X; its colinear neighbour is one cell back in X.
function wallSouth(gx, gy) {
  if (isSpawnClear(gx, gy) || isSpawnClear(gx, gy - 1)) return false;
  return edgeWall(SALT.wallS, gx, gy, gx - 1, gy);
}
// West edge runs along Z; its colinear neighbour is one cell back in Z.
function wallWest(gx, gy) {
  if (isSpawnClear(gx, gy) || isSpawnClear(gx - 1, gy)) return false;
  return edgeWall(SALT.wallW, gx, gy, gx, gy - 1);
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
    return {
      cx: Math.floor((wx + span / 2) / span),
      cy: Math.floor((wz + span / 2) / span),
    };
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

  // Corridors that could touch this chunk (from the ≤4 regions it overlaps).
  corridorsForChunk(cx, cy) {
    const gx0 = cx * chunkCells;
    const gy0 = cy * chunkCells;
    const RC = CORRIDOR_REGION_CELLS;
    const RxMin = Math.floor(gx0 / RC);
    const RxMax = Math.floor((gx0 + chunkCells - 1) / RC);
    const RyMin = Math.floor(gy0 / RC);
    const RyMax = Math.floor((gy0 + chunkCells - 1) / RC);
    const out = [];
    for (let Ry = RyMin; Ry <= RyMax; Ry++) {
      for (let Rx = RxMin; Rx <= RxMax; Rx++) {
        const c = corridorForRegion(Rx, Ry);
        if (c) out.push(c);
      }
    }
    return out;
  }

  // Lights whose home chunk is (cx, cy), gathered from the light-regions the
  // chunk overlaps.
  lightsForChunk(cx, cy) {
    const L = CONFIG.lightRegion;
    const minM = cx * span - span / 2;
    const maxM = cx * span + span / 2;
    const minMz = cy * span - span / 2;
    const maxMz = cy * span + span / 2;
    const out = [];
    for (let ry = Math.floor(minMz / L); ry <= Math.floor(maxMz / L); ry++) {
      for (let rx = Math.floor(minM / L); rx <= Math.floor(maxM / L); rx++) {
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

    // Floor + ceiling.
    const floor = new THREE.Mesh(floorGeo, this.materials.carpet);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(originX, 0, originZ);
    if (this.materials.carpet.map) this.materials.carpet.map.repeat.set(chunkCells, chunkCells);
    group.add(floor);

    const ceil = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(originX, wallHeight, originZ);
    group.add(ceil);

    const corridors = this.corridorsForChunk(cx, cy);

    const pillarMatrices = [];
    const wallXMatrices = []; // south-edge walls (run along X)
    const wallZMatrices = []; // west-edge walls (run along Z)
    const m = new THREE.Matrix4();

    for (let ly = 0; ly < chunkCells; ly++) {
      for (let lx = 0; lx < chunkCells; lx++) {
        const gx = cx * chunkCells + lx;
        const gy = cy * chunkCells + ly;
        const { wx, wz } = cellCenter(gx, gy);

        // Pillar (rare) at the cell centre, unless a corridor clears it.
        const inCorridor = corridors.some((c) => corridorInterior(c, gx, gy));
        if (!inCorridor && pillarAt(gx, gy)) {
          m.makeTranslation(wx, wallHeight / 2, wz);
          pillarMatrices.push(m.clone());
          const h = pillarSize / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - h, maxX: wx + h, minZ: wz - h, maxZ: wz + h });
        }

        // South edge wall (along X), at z = wz - cellSize/2.
        const sVerdict = verdict(corridors, corridorSouth, gx, gy, () => wallSouth(gx, gy));
        if (sVerdict) {
          const ez = wz - cellSize / 2;
          m.makeTranslation(wx, wallHeight / 2, ez);
          wallXMatrices.push(m.clone());
          const hl = cellSize / 2 + CONFIG.playerRadius;
          const ht = wallThickness / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - hl, maxX: wx + hl, minZ: ez - ht, maxZ: ez + ht });
        }

        // West edge wall (along Z), at x = wx - cellSize/2.
        const wVerdict = verdict(corridors, corridorWest, gx, gy, () => wallWest(gx, gy));
        if (wVerdict) {
          const ex = wx - cellSize / 2;
          m.makeTranslation(ex, wallHeight / 2, wz);
          wallZMatrices.push(m.clone());
          const hl = cellSize / 2 + CONFIG.playerRadius;
          const ht = wallThickness / 2 + CONFIG.playerRadius;
          colliders.push({ minX: ex - ht, maxX: ex + ht, minZ: wz - hl, maxZ: wz + hl });
        }
      }
    }

    // Light fixtures for this chunk → emissive panels.
    const lights = this.lightsForChunk(cx, cy);
    const panelMatrices = lights.map((p) => {
      m.makeRotationX(Math.PI / 2);
      m.setPosition(p.x, wallHeight - 0.02, p.z);
      return m.clone();
    });

    this.addInstanced(group, panelGeo, this.materials.lightPanel, panelMatrices, true);
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

  // All light-fixture positions in loaded chunks (for the point-light pool).
  collectLights() {
    const out = [];
    for (const chunk of this.chunks.values()) out.push(...chunk.lights);
    return out;
  }
}

// Resolve a cell edge: corridor "wall"/"clear" wins over the normal draw.
function verdict(corridors, fn, gx, gy, normal) {
  let cleared = false;
  for (const c of corridors) {
    const v = fn(c, gx, gy);
    if (v === "wall") return true;
    if (v === "clear") cleared = true;
  }
  if (cleared) return false;
  return normal();
}
