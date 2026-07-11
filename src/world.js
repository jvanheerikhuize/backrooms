// Procedural, endlessly-streaming base Backrooms.
//
// The world is an infinite grid of square cells. Cells are grouped into
// chunks; chunks within `loadRadius` of the player are built, the rest are
// disposed. Layout (pillars + wall segments) is derived from a per-cell seeded
// RNG, so it is deterministic and identical for every client on the same seed.
//
// Blockers publish axis-aligned bounding boxes (AABBs) that the player queries
// for collision.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { cellRng } from "./rng.js";

const { cellSize, wallHeight, pillarSize, chunkCells } = CONFIG;

// Shared geometry, built once.
const floorGeo = new THREE.PlaneGeometry(chunkCells * cellSize, chunkCells * cellSize);
const ceilGeo = new THREE.PlaneGeometry(chunkCells * cellSize, chunkCells * cellSize);
const pillarGeo = new THREE.BoxGeometry(pillarSize, wallHeight, pillarSize);
const wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, 0.3);
const panelGeo = new THREE.PlaneGeometry(cellSize * 0.42, cellSize * 0.42);

// Cell → world centre. Grid X maps to world X, grid Y maps to world Z.
function cellCenter(x, y) {
  return { wx: x * cellSize, wz: y * cellSize };
}

// True for cells kept clear so the player's spawn ("fresh corner") is walkable.
function isSpawnClear(x, y) {
  return Math.abs(x) <= 1 && Math.abs(y) <= 1;
}

// Decide what a cell contains. Returns { blocker, wallAxis } where blocker is
// "pillar" | "wall" | null and wallAxis is "x" | "z" for walls.
function cellContent(x, y) {
  if (isSpawnClear(x, y)) return { blocker: null };
  const rng = cellRng(CONFIG.seed, x, y);
  const r = rng();
  if (r < CONFIG.pillarChance) return { blocker: "pillar" };
  if (r < CONFIG.pillarChance + CONFIG.wallSegmentChance) {
    return { blocker: "wall", wallAxis: rng() < 0.5 ? "x" : "z" };
  }
  return { blocker: null };
}

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map(); // key "cx,cy" -> { group, colliders }
    this.panelMeshes = []; // instanced ceiling panels, for flicker
  }

  static chunkKey(cx, cy) {
    return cx + "," + cy;
  }

  // World position → chunk coord.
  chunkOf(wx, wz) {
    const span = chunkCells * cellSize;
    return {
      cx: Math.floor((wx + span / 2) / span),
      cy: Math.floor((wz + span / 2) / span),
    };
  }

  // Stream chunks around a world position; build new, dispose far ones.
  update(wx, wz) {
    const { cx, cy } = this.chunkOf(wx, wz);
    const R = CONFIG.loadRadius;

    // Build needed.
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const key = World.chunkKey(cx + dx, cy + dy);
        if (!this.chunks.has(key)) this.buildChunk(cx + dx, cy + dy);
      }
    }
    // Dispose far (Chebyshev distance > R).
    for (const key of [...this.chunks.keys()]) {
      const [kx, ky] = key.split(",").map(Number);
      if (Math.max(Math.abs(kx - cx), Math.abs(ky - cy)) > R) {
        this.disposeChunk(key);
      }
    }
  }

  buildChunk(cx, cy) {
    const group = new THREE.Group();
    const colliders = [];
    const span = chunkCells * cellSize;
    const originX = cx * span;
    const originZ = cy * span;

    // Floor.
    const floor = new THREE.Mesh(floorGeo, this.materials.carpet);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(originX, 0, originZ);
    if (this.materials.carpet.map) this.materials.carpet.map.repeat.set(chunkCells, chunkCells);
    group.add(floor);

    // Ceiling.
    const ceil = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(originX, wallHeight, originZ);
    group.add(ceil);

    // Gather per-cell blockers and light panels.
    const pillarMatrices = [];
    const wallMatrices = [];
    const panelMatrices = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const half = pillarSize / 2 + CONFIG.playerRadius;

    for (let ly = 0; ly < chunkCells; ly++) {
      for (let lx = 0; lx < chunkCells; lx++) {
        const gx = cx * chunkCells + lx;
        const gy = cy * chunkCells + ly;
        const { wx, wz } = cellCenter(gx, gy);

        // A fluorescent panel in every cell → the regular, disorienting grid.
        m.identity();
        m.makeRotationX(Math.PI / 2);
        m.setPosition(wx, wallHeight - 0.02, wz);
        panelMatrices.push(m.clone());

        const content = cellContent(gx, gy);
        if (content.blocker === "pillar") {
          m.makeTranslation(wx, wallHeight / 2, wz);
          pillarMatrices.push(m.clone());
          colliders.push({ minX: wx - half, maxX: wx + half, minZ: wz - half, maxZ: wz + half });
        } else if (content.blocker === "wall") {
          const axis = content.wallAxis;
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), axis === "z" ? Math.PI / 2 : 0);
          m.compose(new THREE.Vector3(wx, wallHeight / 2, wz), q, new THREE.Vector3(1, 1, 1));
          wallMatrices.push(m.clone());
          const halfLen = cellSize / 2 + CONFIG.playerRadius;
          const halfThk = 0.15 + CONFIG.playerRadius;
          if (axis === "x") {
            colliders.push({ minX: wx - halfLen, maxX: wx + halfLen, minZ: wz - halfThk, maxZ: wz + halfThk });
          } else {
            colliders.push({ minX: wx - halfThk, maxX: wx + halfThk, minZ: wz - halfLen, maxZ: wz + halfLen });
          }
        }
      }
    }

    this.addInstanced(group, panelGeo, this.materials.lightPanel, panelMatrices, true);
    this.addInstanced(group, pillarGeo, this.materials.wall, pillarMatrices, false);
    this.addInstanced(group, wallGeo, this.materials.wall, wallMatrices, false);

    this.scene.add(group);
    this.chunks.set(World.chunkKey(cx, cy), { group, colliders });
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

  // Collect AABB colliders near a world position (for the player's chunk and
  // its neighbours). Shared geometry/materials are never disposed.
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
}
