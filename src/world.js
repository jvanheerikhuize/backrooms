// Procedural, endlessly-streaming base Backrooms.
//
// The world is an infinite grid of square cells grouped into chunks; chunks
// within `loadRadius` of the player are built, the rest disposed. Everything is
// derived from a per-feature seeded RNG, so layout is deterministic.
//
// WHAT GOES WHERE is not decided here — see layout.js, which computes a real
// floor plan per zone (corridor ring, rooms off hallway lanes, corridor mazes,
// open halls) and answers "is there a wall on this edge / a door / a pillar".
// This file is now purely the *builder*: it walks the cells of a chunk, asks
// layout.js what's there, and turns the answers into geometry and colliders.
//
// A DOORWAY is the one thing that isn't a simple box: an edge carrying a door
// becomes two short wall stubs, a lintel over the top, a frame, and (usually) a
// leaf standing open at a right angle. Right angles specifically — this game
// collides against axis-aligned boxes only, so a door ajar at 40 degrees would
// look right and collide wrong. Parked square, the leaf's AABB is exactly the
// leaf. Some doorways have no leaf at all (it's been taken off), and some walls
// carry a BLIND door: closed, framed, opening onto nothing.
//
// LIGHTS are independent of layout: at most one fixture per `lightCellSize`²
// metres (jittered with a margin — see config.js — so two never spawn
// overlapping or too close), each an emissive troffer panel; the nearest few get
// a real point-light (managed in main.js) that pools light on the floor.
//
// Blockers publish axis-aligned bounding boxes (AABBs) for player collision.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { mulberry32, hashCell } from "./rng.js";
import { roomsInBounds, roomsAffecting, buildRoomGroup, pointInsideAnyRoom } from "./rooms.js";
import { TEXTURE_SCALE } from "./materials.js";
import {
  zoneOf,
  profileFor,
  layoutForZone,
  clearLayoutCache,
  wallSouth,
  wallWest,
  doorSouth,
  doorWest,
  blindSouth,
  blindWest,
  pillarAt,
  isEncounterCentre,
} from "./layout.js";

const { cellSize, wallHeight, pillarSize, wallThickness, chunkCells } = CONFIG;
const { width: doorW, height: doorH, leafThickness: leafT, jamb: jambW } = CONFIG.doors;
const span = chunkCells * cellSize; // chunk width in metres
const ZC = CONFIG.zones.cells;

const SALT = { light: 0x3001, arrowS: 0x9001, arrowW: 0xa001 };
function rngFor(salt, a, b) {
  return mulberry32(hashCell(CONFIG.seed ^ salt, a, b));
}

// ── Shared geometry, built once ────────────────────────────────────────────
//
// Everything below is authored in "south wall" orientation — the wall runs along
// world X, its thickness along Z. A west wall is the same parts under a 90° Y
// rotation, which the door builder applies via the instance matrix, so there is
// exactly one set of door geometry rather than two mirrored ones.

const floorGeo = new THREE.PlaneGeometry(span, span);
const ceilGeo = new THREE.PlaneGeometry(span, span);
const pillarGeo = new THREE.BoxGeometry(pillarSize, wallHeight, pillarSize);
const wallGeoX = new THREE.BoxGeometry(cellSize, wallHeight, wallThickness);
const wallGeoZ = new THREE.BoxGeometry(wallThickness, wallHeight, cellSize);

// Skirting board — a thin proud strip at the foot of a wall. Sits slightly
// outside the wall's thickness so it reads on BOTH faces from one instance.
const baseH = 0.13;
const baseboardGeoX = new THREE.BoxGeometry(cellSize, baseH, wallThickness + 0.05);
const baseboardGeoZ = new THREE.BoxGeometry(wallThickness + 0.05, baseH, cellSize);

// Door parts, all in south orientation.
const stubW = (cellSize - doorW) / 2; // the wall either side of the opening
const doorStubGeo = new THREE.BoxGeometry(stubW, wallHeight, wallThickness);
const lintelGeo = new THREE.BoxGeometry(doorW, wallHeight - doorH, wallThickness);
const jambGeo = new THREE.BoxGeometry(jambW, doorH, wallThickness + 0.07);
const headerGeo = new THREE.BoxGeometry(doorW + 2 * jambW, jambW, wallThickness + 0.07);
const leafGeo = new THREE.BoxGeometry(doorW - 0.04, doorH - 0.03, leafT);

const troffGeo = new THREE.PlaneGeometry(CONFIG.troffer.length, CONFIG.troffer.width);
const markerGeo = new THREE.PlaneGeometry(cellSize * 1.0, cellSize * 1.0);
const arrowGeo = new THREE.PlaneGeometry(2.0, 1.0);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _box = new THREE.Box3();

// Compose a local offset (authored in south orientation) into world space, given
// the edge's base transform.
function partMatrix(base, x, y, z, rotY = 0) {
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const local = new THREE.Matrix4().compose(_v.set(x, y, z), _q, _one);
  return new THREE.Matrix4().multiplyMatrices(base, local);
}

// The world-space AABB of a part, derived by pushing its local box through the
// same matrix that positions it. Doing it this way (rather than by hand, per
// orientation) is why the 90°-rotated west doors can't drift out of sync with
// their colliders — the collider is literally derived from the mesh transform.
function partCollider(matrix, sx, sy, sz) {
  _box.set(new THREE.Vector3(-sx / 2, -sy / 2, -sz / 2), new THREE.Vector3(sx / 2, sy / 2, sz / 2));
  _box.applyMatrix4(matrix);
  const p = CONFIG.playerRadius;
  return { minX: _box.min.x - p, maxX: _box.max.x + p, minZ: _box.min.z - p, maxZ: _box.max.z + p };
}

function cellCenter(x, y) {
  return { wx: x * cellSize, wz: y * cellSize };
}

// The spawn zone (0,0) is forced to the "encounter" profile (see
// CONFIG.zones.spawnProfile), so its marker always lands on this cell — the
// player spawns standing on it (see player.js).
const SPAWN_CELL = ZC >> 1;
export const SPAWN_POS = cellCenter(SPAWN_CELL, SPAWN_CELL);

// ── Arrows ─────────────────────────────────────────────────────────────────
//
// A clear straight run of `steps` cells out from an arrow's wall, so an arrow
// never points at a wall two tiles away. Now that layout.js is deterministic per
// edge with no chunk-local randomness, this is a plain global query — the old
// version had to be handed the current chunk's wall sets, because the density
// top-up pass added walls that no per-cell function knew about. That pass is
// gone (the layout has real structure, so it can't roll an empty chunk), and
// this got to shrink accordingly.
function directionClear(axis, gx, gy, faceSign, dir, steps) {
  for (let i = 1; i <= steps; i++) {
    if (axis === "x") {
      const row = faceSign > 0 ? gy : gy - 1;
      const edgeX = dir > 0 ? gx + i : gx - i + 1;
      if (wallWest(edgeX, row) && !doorWest(edgeX, row)) return false;
    } else {
      const col = faceSign > 0 ? gx : gx - 1;
      const edgeZ = dir > 0 ? gy + i : gy - i + 1;
      if (wallSouth(col, edgeZ) && !doorSouth(col, edgeZ)) return false;
    }
  }
  return true;
}

function maybeAddArrow(world, group, materials, salt, gx, gy, axis, px, pz) {
  const key = axis + "," + gx + "," + gy;
  const rng = rngFor(salt, gx, gy);
  if (rng() >= CONFIG.arrowChance) return;

  const faceSign = rng() < 0.5 ? 1 : -1;

  // Point it toward wherever's actually walkable instead of a coin flip. If
  // NEITHER direction is walkable, don't paint an arrow here at all — one that
  // points at a wall is worse than no arrow. Deterministic per cell, so this
  // permanently skips that spot rather than flickering as chunks stream.
  const sight = 3;
  const posClear = directionClear(axis, gx, gy, faceSign, 1, sight);
  const negClear = directionClear(axis, gx, gy, faceSign, -1, sight);
  let mirror;
  if (posClear && negClear) mirror = rng() < 0.5;
  else if (posClear) mirror = axis !== "x";
  else if (negClear) mirror = axis === "x";
  else return;

  const h = 1.45 + (rng() - 0.5) * 0.7;
  const mesh = new THREE.Mesh(arrowGeo, materials.arrow);
  let x = px;
  let z = pz;
  if (axis === "x") {
    z = pz + faceSign * (wallThickness / 2 + 0.012);
  } else {
    mesh.rotation.y = Math.PI / 2;
    x = px + faceSign * (wallThickness / 2 + 0.012);
  }
  mesh.position.set(x, h, z);
  mesh.scale.x = mirror ? -1 : 1;
  group.add(mesh);

  const standOff = 1.4;
  const standX = axis === "x" ? x : px + faceSign * (wallThickness / 2 + standOff);
  const standZ = axis === "x" ? pz + faceSign * (wallThickness / 2 + standOff) : z;
  if (world._arrowKeys.has(key)) return; // the decal is rebuilt every stream-in; the list entry only once
  world._arrowKeys.add(key);
  const dx = x - standX;
  const dz = z - standZ;
  const len = Math.hypot(dx, dz) || 1;
  world.arrows.push({ x, z, standX, standZ, yaw: Math.atan2(-dx / len, -dz / len) });
}

// ── Lights ─────────────────────────────────────────────────────────────────

function lightsForCell(lcx, lcy) {
  // The spawn cell always gets exactly its one dedicated fixture and nothing
  // else, so it can't roll a second one too close to it.
  if (lcx === 0 && lcy === 0) return [{ x: SPAWN_POS.wx, z: SPAWN_POS.wz }];
  const rng = rngFor(SALT.light, lcx, lcy);
  if (rng() >= CONFIG.lightCellChance) return [];
  const { lightCellSize: L, lightCellMargin: M } = CONFIG;
  const usable = Math.max(L - 2 * M, 0);
  return [{ x: lcx * L + M + rng() * usable, z: lcy * L + M + rng() * usable, rot: rng() < 0.5 }];
}

export class World {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map();
    this.panelMeshes = [];
    this.arrows = [];
    this._arrowKeys = new Set();

    // materials.js authors each texture at a fixed metres-per-tile (see
    // TEXTURE_SCALE there), so the repeat has to be derived from the surface's
    // real size or the wallpaper stripes and ceiling grid come out the wrong
    // scale. Set once on the shared materials, since every wall is one cell wide
    // and every floor/ceiling is one chunk square.
    //
    // The wall's vertical repeat MUST stay 1: its texture is a single
    // full-wall-height slice (water bleeding up from the floor, staining down
    // from the ceiling line), so tiling it vertically would stack floor stains
    // at head height.
    materials.wall.map.repeat.set(cellSize / TEXTURE_SCALE.wall, 1);
    materials.carpet.map.repeat.set(span / TEXTURE_SCALE.carpet, span / TEXTURE_SCALE.carpet);
    materials.ceiling.map.repeat.set(span / TEXTURE_SCALE.ceiling, span / TEXTURE_SCALE.ceiling);
  }

  static chunkKey(cx, cy) {
    return cx + "," + cy;
  }

  chunkOf(wx, wz) {
    return { cx: Math.floor((wx + span / 2) / span), cy: Math.floor((wz + span / 2) / span) };
  }

  profileAt(wx, wz) {
    const gx = Math.round(wx / cellSize);
    const gy = Math.round(wz / cellSize);
    const { zx, zy } = zoneOf(gx, gy);
    return profileFor(zx, zy).name;
  }

  randomRoom(wx, wz, spread = 15) {
    const R = CONFIG.specialRooms.regionSize;
    const rx = Math.floor(wx / R) + Math.floor((Math.random() * 2 - 1) * spread);
    const ry = Math.floor(wz / R) + Math.floor((Math.random() * 2 - 1) * spread);
    return roomsInBounds(rx * R, rx * R + R, ry * R, ry * R + R)[0] ?? null;
  }

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

  regenerate(wx, wz, seed) {
    CONFIG.seed = seed !== undefined ? seed >>> 0 : (Math.random() * 0xffffffff) >>> 0;
    clearLayoutCache();
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

  // Build one edge that carries a doorway: stubs, lintel, frame, and usually a
  // leaf. `axis` is the wall's own axis ("x" = a south wall spanning world X).
  buildDoorway(parts, colliders, axis, px, pz, door) {
    const rot = axis === "x" ? 0 : Math.PI / 2;
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    const base = new THREE.Matrix4().compose(_v.set(px, 0, pz), _q, _one);

    const stubOff = doorW / 2 + stubW / 2;
    for (const s of [-1, 1]) {
      const mtx = partMatrix(base, s * stubOff, wallHeight / 2, 0);
      parts.stub.push(mtx);
      colliders.push(partCollider(mtx, stubW, wallHeight, wallThickness));
    }

    const lintel = partMatrix(base, 0, doorH + (wallHeight - doorH) / 2, 0);
    parts.lintel.push(lintel);
    // No collider — the player walks under it.

    for (const s of [-1, 1]) parts.jamb.push(partMatrix(base, s * (doorW / 2 + jambW / 2), doorH / 2, 0));
    parts.header.push(partMatrix(base, 0, doorH + jambW / 2, 0));

    if (!door.open) return; // the leaf is simply gone — the frame stands empty

    // Parked at a right angle to the frame, hinged on one jamb, swung to one
    // face. See the file header for why it's exactly 90° and not ajar.
    //
    // The hinge-side offset is doorW/2 + leafT/2 — flush against the STUB's
    // face, not inset into the doorway span. Player-radius padding inflates
    // every collider independently (see partCollider), so a leaf sitting
    // even slightly inside the opening had its padding stack with the stub's
    // and choke the passable centre down from 0.35m to ~0.28m — tight enough
    // that some doors read as blocked. Flush placement keeps the leaf's
    // padded footprint entirely inside the stub's already-blocked zone, so
    // an open door costs no extra clearance versus a doorless (open:false)
    // frame.
    const hinge = door.swing; // which jamb it hangs on
    const face = door.swing; // and which way it opens (into whatever's there)
    const leaf = partMatrix(base, hinge * (doorW / 2 + leafT / 2), doorH / 2, face * (doorW / 2), Math.PI / 2);
    parts.leaf.push(leaf);
    colliders.push(partCollider(leaf, doorW - 0.04, doorH - 0.03, leafT));
  }

  buildChunk(cx, cy) {
    const group = new THREE.Group();
    const colliders = [];
    const originX = cx * span;
    const originZ = cy * span;

    // `rooms`: the special rooms whose geometry this chunk owns (one chunk per
    // room, keyed on its centre). `exclusionRooms`: the wider set whose footprint
    // or escape corridor overlaps the cells this chunk generates — grid walls
    // must not grow through those. The windows differ on purpose: the generation
    // loop fills world space [originX, originX+span), a half-open range starting
    // AT originX, while the floor/ceiling meshes are centred on it. The south/west
    // edge is widened by another half cell because a south/west wall physically
    // sits half a cell BEFORE its own cell's centre.
    const rooms = roomsInBounds(originX - span / 2, originX + span / 2, originZ - span / 2, originZ + span / 2);
    const exclusionRooms = roomsAffecting(originX - cellSize / 2, originX + span, originZ - cellSize / 2, originZ + span);

    const floor = new THREE.Mesh(floorGeo, this.materials.carpet);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(originX, 0, originZ);
    group.add(floor);

    const ceil = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(originX, wallHeight, originZ);
    group.add(ceil);

    const pillars = [];
    const wallX = [];
    const wallZ = [];
    const baseX = [];
    const baseZ = [];
    const markers = [];
    const blindLeaves = [];
    const parts = { stub: [], lintel: [], jamb: [], header: [], leaf: [] };
    const arrowCandidates = [];

    for (let ly = 0; ly < chunkCells; ly++) {
      for (let lx = 0; lx < chunkCells; lx++) {
        const gx = cx * chunkCells + lx;
        const gy = cy * chunkCells + ly;
        const { wx, wz } = cellCenter(gx, gy);

        if (!pointInsideAnyRoom(exclusionRooms, wx, wz, cellSize) && pillarAt(gx, gy)) {
          pillars.push(new THREE.Matrix4().makeTranslation(wx, wallHeight / 2, wz));
          const h = pillarSize / 2 + CONFIG.playerRadius;
          colliders.push({ minX: wx - h, maxX: wx + h, minZ: wz - h, maxZ: wz + h });
        }

        // South edge (a wall running along X).
        const ez = wz - cellSize / 2;
        if (!pointInsideAnyRoom(exclusionRooms, wx, ez, cellSize)) {
          const door = doorSouth(gx, gy);
          if (door) {
            this.buildDoorway(parts, colliders, "x", wx, ez, door);
            baseX.push(new THREE.Matrix4().makeTranslation(wx, baseH / 2, ez));
          } else if (wallSouth(gx, gy)) {
            wallX.push(new THREE.Matrix4().makeTranslation(wx, wallHeight / 2, ez));
            baseX.push(new THREE.Matrix4().makeTranslation(wx, baseH / 2, ez));
            const hl = cellSize / 2 + CONFIG.playerRadius;
            const ht = wallThickness / 2 + CONFIG.playerRadius;
            colliders.push({ minX: wx - hl, maxX: wx + hl, minZ: ez - ht, maxZ: ez + ht });
            arrowCandidates.push({ salt: SALT.arrowS, gx, gy, axis: "x", px: wx, pz: ez });
            const b = blindSouth(gx, gy);
            if (b) blindLeaves.push(blindMatrix("x", wx, ez, b.face));
          }
        }

        // West edge (a wall running along Z).
        const ex = wx - cellSize / 2;
        if (!pointInsideAnyRoom(exclusionRooms, ex, wz, cellSize)) {
          const door = doorWest(gx, gy);
          if (door) {
            this.buildDoorway(parts, colliders, "z", ex, wz, door);
            baseZ.push(new THREE.Matrix4().makeTranslation(ex, baseH / 2, wz));
          } else if (wallWest(gx, gy)) {
            wallZ.push(new THREE.Matrix4().makeTranslation(ex, wallHeight / 2, wz));
            baseZ.push(new THREE.Matrix4().makeTranslation(ex, baseH / 2, wz));
            const hl = cellSize / 2 + CONFIG.playerRadius;
            const ht = wallThickness / 2 + CONFIG.playerRadius;
            colliders.push({ minX: ex - ht, maxX: ex + ht, minZ: wz - hl, maxZ: wz + hl });
            arrowCandidates.push({ salt: SALT.arrowW, gx, gy, axis: "z", px: ex, pz: wz });
            const b = blindWest(gx, gy);
            if (b) blindLeaves.push(blindMatrix("z", ex, wz, b.face));
          }
        }

        if (isEncounterCentre(gx, gy)) {
          const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
          m.setPosition(wx, 0.02, wz);
          markers.push(m);
        }
      }
    }

    for (const c of arrowCandidates) {
      maybeAddArrow(this, group, this.materials, c.salt, c.gx, c.gy, c.axis, c.px, c.pz);
    }

    // Every special room gets its own guaranteed ceiling light — without this a
    // room can land far from any grid light and read as pitch black despite being
    // fully furnished. Room lights live on an independent coordinate system
    // (region-based, not cell-based), so drop any grid light that would land too
    // close to one rather than let the two systems spawn on top of each other.
    const lightGap = CONFIG.lightCellMargin * 2;
    const nearbyRoomLights = roomsAffecting(
      originX - span / 2 - lightGap,
      originX + span / 2 + lightGap,
      originZ - span / 2 - lightGap,
      originZ + span / 2 + lightGap
    ).map((r) => ({ x: r.x, z: r.z }));
    const minGapSq = lightGap * lightGap;
    const gridLights = this.lightsForChunk(cx, cy).filter(
      (p) => !nearbyRoomLights.some((rl) => (p.x - rl.x) ** 2 + (p.z - rl.z) ** 2 < minGapSq)
    );
    const lights = gridLights.concat(rooms.map((r) => ({ x: r.x, z: r.z })));
    const troffers = lights.map((p) => {
      const m = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      if (p.rot) m.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      m.setPosition(p.x, wallHeight - 0.015, p.z);
      return m;
    });

    this.addInstanced(group, troffGeo, this.materials.lightPanel, troffers, true);
    this.addInstanced(group, markerGeo, this.materials.marker, markers, false);
    this.addInstanced(group, pillarGeo, this.materials.wall, pillars, false);
    this.addInstanced(group, wallGeoX, this.materials.wall, wallX, false);
    this.addInstanced(group, wallGeoZ, this.materials.wall, wallZ, false);
    // Baseboard trim disabled — it was rendering as a stark black line at the
    // wall/floor junction (too little light reaches a low, wall-hugging vertical
    // surface under the new lighting). baseX/baseZ are still computed above in
    // case this gets revisited; just re-add the two addInstanced calls below.
    // this.addInstanced(group, baseboardGeoX, this.materials.baseboard, baseX, false);
    // this.addInstanced(group, baseboardGeoZ, this.materials.baseboard, baseZ, false);
    this.addInstanced(group, doorStubGeo, this.materials.wall, parts.stub, false);
    this.addInstanced(group, lintelGeo, this.materials.wall, parts.lintel, false);
    this.addInstanced(group, jambGeo, this.materials.doorFrame, parts.jamb, false);
    this.addInstanced(group, headerGeo, this.materials.doorFrame, parts.header, false);
    this.addInstanced(group, leafGeo, this.materials.door, parts.leaf, false);
    this.addInstanced(group, leafGeo, this.materials.door, blindLeaves, false);

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
        o.dispose(); // frees instance buffers only — geometry/material are shared
      } else if (o.isMesh && o.geometry?.userData.disposable) {
        o.geometry.dispose(); // per-room geometry from rooms.js isn't shared
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

// A blind door: a closed leaf lying flat against one face of a solid wall. It
// needs no collider — the wall behind it already has one.
function blindMatrix(axis, px, pz, face) {
  const rot = axis === "x" ? 0 : Math.PI / 2;
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  const base = new THREE.Matrix4().compose(_v.set(px, 0, pz), _q, _one);
  return partMatrix(base, 0, doorH / 2, face * (wallThickness / 2 + leafT / 2 + 0.005));
}

// Re-export so main.js and the dev console keep their existing import surface.
export { layoutForZone, profileFor, zoneOf };
