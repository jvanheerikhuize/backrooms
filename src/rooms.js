// "Someone was here" rooms — enclosed rooms scattered sparsely across the
// map, roughly one per 250x250m region, each holding a themed trace of a
// past occupant (festival leftovers, toys, a camp, or stored crates).
// Deterministic per region, same seeding approach as the rest of the
// generator (see world.js) so any client rebuilds the same layout for a
// given seed.
//
// Kept as a self-contained layer: rooms are generated independently of the
// cell/zone grid and just get excluded from normal wall/pillar placement
// where they overlap (see pointInsideAnyRoom, used from world.js).

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { mulberry32, hashCell } from "./rng.js";
import { randomObject, getObject } from "./objects.js";

const RS = CONFIG.specialRooms;
const SALT_SHAPE = 0x7001;
const SALT_PROPS = 0x8001;

function rngForRegion(salt, rx, ry) {
  return mulberry32(hashCell(CONFIG.seed ^ salt, rx, ry));
}

// The doorway's own clear approach — a strip in front of the entrance (full
// side width for "open", the gap width plus margin for "gap") reaching a
// little way into the room. Prop placement avoids this so nothing ever ends
// up sitting in — or blocking — the only way in.
function computeDoor(x, z, w, d, openSide, style) {
  const depth = 3.0;
  const gapHalf = style === "open" ? null : RS.entranceGap / 2 + 0.7;
  switch (openSide) {
    case "n":
      return { minX: gapHalf ? x - gapHalf : x - w / 2, maxX: gapHalf ? x + gapHalf : x + w / 2, minZ: z - d / 2, maxZ: z - d / 2 + depth };
    case "s":
      return { minX: gapHalf ? x - gapHalf : x - w / 2, maxX: gapHalf ? x + gapHalf : x + w / 2, minZ: z + d / 2 - depth, maxZ: z + d / 2 };
    case "w":
      return { minX: x - w / 2, maxX: x - w / 2 + depth, minZ: gapHalf ? z - gapHalf : z - d / 2, maxZ: gapHalf ? z + gapHalf : z + d / 2 };
    default:
      return { minX: x + w / 2 - depth, maxX: x + w / 2, minZ: gapHalf ? z - gapHalf : z - d / 2, maxZ: gapHalf ? z + gapHalf : z + d / 2 };
  }
}

// A clear approach OUTSIDE the room, reaching well past the room's own
// exclusion pad (see world.js's pointInsideAnyRoom) in the doorway's
// direction. Without this, the ordinary maze generator is free to wall off
// the area just beyond the room's immediate surroundings — its own doorway
// would be fine, but the pocket it opens into could still be fully sealed
// by the surrounding "rooms"-profile zone's dense, long wall runs. This
// guarantees at least one straight way out regardless of what the
// surrounding zone rolls.
const ESCAPE_DEPTH = 22; // metres — comfortably more than one zone's typical wall-run reach
const ESCAPE_HALF_WIDTH = 1.8; // metres — enough for a player to walk through
function computeEscapeCorridor(x, z, w, d, openSide) {
  switch (openSide) {
    case "n":
      return { minX: x - ESCAPE_HALF_WIDTH, maxX: x + ESCAPE_HALF_WIDTH, minZ: z - d / 2 - ESCAPE_DEPTH, maxZ: z - d / 2 };
    case "s":
      return { minX: x - ESCAPE_HALF_WIDTH, maxX: x + ESCAPE_HALF_WIDTH, minZ: z + d / 2, maxZ: z + d / 2 + ESCAPE_DEPTH };
    case "w":
      return { minX: x - w / 2 - ESCAPE_DEPTH, maxX: x - w / 2, minZ: z - ESCAPE_HALF_WIDTH, maxZ: z + ESCAPE_HALF_WIDTH };
    default:
      return { minX: x + w / 2, maxX: x + w / 2 + ESCAPE_DEPTH, minZ: z - ESCAPE_HALF_WIDTH, maxZ: z + ESCAPE_HALF_WIDTH };
  }
}

// Deterministically compute the one room that can exist in a given
// 250x250m region. Position is jittered inside an inner margin so two rooms
// in neighbouring regions can never end up closer than 2*margin apart.
function roomForRegion(rx, ry) {
  const rng = rngForRegion(SALT_SHAPE, rx, ry);
  const R = RS.regionSize;
  const usable = Math.max(R - RS.margin * 2 - RS.sizeMax, 0);
  const ox = rx * R + RS.margin + rng() * usable;
  const oz = ry * R + RS.margin + rng() * usable;
  const w = RS.sizeMin + rng() * (RS.sizeMax - RS.sizeMin);
  const d = RS.sizeMin + rng() * (RS.sizeMax - RS.sizeMin);
  const sides = ["n", "e", "s", "w"];
  const openSide = sides[Math.floor(rng() * 4)];
  const style = rng() < 0.5 ? "open" : "gap"; // 3 bare walls, or 4 walls + a doorway gap — always enterable
  const themes = ["festival", "toys", "camp", "storage", "party"];
  const theme = themes[Math.floor(rng() * themes.length)];
  const x = ox + w / 2;
  const z = oz + d / 2;
  const door = computeDoor(x, z, w, d, openSide, style);
  const escapeCorridor = computeEscapeCorridor(x, z, w, d, openSide);
  return { rx, ry, x, z, w, d, openSide, style, theme, door, escapeCorridor };
}

// If a point (padded by the prop's own half-extent) overlaps the room's
// doorway approach, push it just past the doorway's inner edge —
// deterministic, so (unlike rejection sampling) it can't fail to find a
// clear spot when the doorway strip covers a big chunk of the room (as it
// does for "open" style, which spans the full wall width). `pad` should be
// the prop's own geometric half-extent — every *collider* in this generator
// additionally grows by CONFIG.playerRadius (see addBlocker/addWall), so
// that's added here too rather than needing every call site to remember it.
function keepClearOfDoor(room, x, z, pad = 0) {
  const totalPad = pad + CONFIG.playerRadius;
  const dz = room.door;
  const inX = x >= dz.minX - totalPad && x <= dz.maxX + totalPad;
  const inZ = z >= dz.minZ - totalPad && z <= dz.maxZ + totalPad;
  if (!(inX && inZ)) return { x, z };
  switch (room.openSide) {
    case "n":
      return { x, z: dz.maxZ + totalPad + 0.05 };
    case "s":
      return { x, z: dz.minZ - totalPad - 0.05 };
    case "w":
      return { x: dz.maxX + totalPad + 0.05, z };
    default:
      return { x: dz.minX - totalPad - 0.05, z };
  }
}

// All rooms whose centre falls within the given world-space bounds. Mirrors
// world.js's region-based light lookup: a chunk is far smaller than a
// region, so this almost always returns 0 or 1 room. Used to decide which
// single chunk builds a given room's actual geometry.
export function roomsInBounds(minX, maxX, minZ, maxZ) {
  const R = RS.regionSize;
  const out = [];
  for (let ry = Math.floor(minZ / R); ry <= Math.floor(maxZ / R); ry++) {
    for (let rx = Math.floor(minX / R); rx <= Math.floor(maxX / R); rx++) {
      const room = roomForRegion(rx, ry);
      if (room.x >= minX && room.x < maxX && room.z >= minZ && room.z < maxZ) out.push(room);
    }
  }
  return out;
}

function boxesOverlap(a, minX, maxX, minZ, maxZ) {
  return !(a.maxX < minX || a.minX > maxX || a.maxZ < minZ || a.minZ > maxZ);
}

// All rooms whose footprint OR escape corridor overlaps the given bounds —
// unlike roomsInBounds, this isn't restricted to rooms centred inside the
// bounds, since a room's escape corridor (up to ESCAPE_DEPTH away) can reach
// into a chunk far from whichever chunk owns the room's own geometry. Used
// only for the grid generator's exclusion checks (pointInsideAnyRoom), never
// for deciding who builds a room's geometry.
export function roomsAffecting(minX, maxX, minZ, maxZ) {
  const R = RS.regionSize;
  const pad = ESCAPE_DEPTH + RS.sizeMax;
  const out = [];
  for (let ry = Math.floor((minZ - pad) / R); ry <= Math.floor((maxZ + pad) / R); ry++) {
    for (let rx = Math.floor((minX - pad) / R); rx <= Math.floor((maxX + pad) / R); rx++) {
      const room = roomForRegion(rx, ry);
      const footprint = { minX: room.x - room.w / 2, maxX: room.x + room.w / 2, minZ: room.z - room.d / 2, maxZ: room.z + room.d / 2 };
      if (boxesOverlap(footprint, minX, maxX, minZ, maxZ) || boxesOverlap(room.escapeCorridor, minX, maxX, minZ, maxZ)) {
        out.push(room);
      }
    }
  }
  return out;
}

// True if a world point falls inside (or just outside, for wall clearance)
// any room's footprint or escape corridor in the list — used to keep the
// ordinary grid generator from poking walls/pillars through a special room
// or sealing off its only way out.
export function pointInsideAnyRoom(rooms, wx, wz, pad = 0.4) {
  for (const r of rooms) {
    if (wx >= r.x - r.w / 2 - pad && wx <= r.x + r.w / 2 + pad && wz >= r.z - r.d / 2 - pad && wz <= r.z + r.d / 2 + pad) {
      return true;
    }
    const cz = r.escapeCorridor;
    if (wx >= cz.minX - pad && wx <= cz.maxX + pad && wz >= cz.minZ - pad && wz <= cz.maxZ + pad) {
      return true;
    }
  }
  return false;
}

function addWall(group, colliders, wallMat, cx, cz, length, axis) {
  if (length <= 0.15) return;
  const geo =
    axis === "x"
      ? new THREE.BoxGeometry(length, CONFIG.wallHeight, CONFIG.wallThickness)
      : new THREE.BoxGeometry(CONFIG.wallThickness, CONFIG.wallHeight, length);
  geo.userData.disposable = true; // per-room geometry, not shared — see World.disposeChunk
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(cx, CONFIG.wallHeight / 2, cz);
  group.add(mesh);
  const hl = length / 2 + CONFIG.playerRadius;
  const ht = CONFIG.wallThickness / 2 + CONFIG.playerRadius;
  if (axis === "x") colliders.push({ minX: cx - hl, maxX: cx + hl, minZ: cz - ht, maxZ: cz + ht });
  else colliders.push({ minX: cx - ht, maxX: cx + ht, minZ: cz - hl, maxZ: cz + hl });
}

function buildWalls(group, colliders, wallMat, room) {
  const { x, z, w, d, openSide, style } = room;
  const sidesSpec = {
    n: { axis: "x", cx: x, cz: z - d / 2, length: w },
    s: { axis: "x", cx: x, cz: z + d / 2, length: w },
    w: { axis: "z", cx: x - w / 2, cz: z, length: d },
    e: { axis: "z", cx: x + w / 2, cz: z, length: d },
  };
  for (const side of Object.keys(sidesSpec)) {
    const spec = sidesSpec[side];
    if (side === openSide) {
      if (style === "open") continue; // whole side left open as the entrance
      const gap = Math.min(RS.entranceGap, spec.length - 1);
      const segLen = (spec.length - gap) / 2;
      if (segLen <= 0.2) continue; // too small for two segments — leave it open
      const offset = gap / 2 + segLen / 2;
      if (spec.axis === "x") {
        addWall(group, colliders, wallMat, spec.cx - offset, spec.cz, segLen, "x");
        addWall(group, colliders, wallMat, spec.cx + offset, spec.cz, segLen, "x");
      } else {
        addWall(group, colliders, wallMat, spec.cx, spec.cz - offset, segLen, "z");
        addWall(group, colliders, wallMat, spec.cx, spec.cz + offset, segLen, "z");
      }
      continue;
    }
    addWall(group, colliders, wallMat, spec.cx, spec.cz, spec.length, spec.axis);
  }
}

// Simple, muted, worn-looking materials — built once and reused across all
// rooms. Deliberately desaturated so the decorations read as leftover/old,
// not a bright, freshly-thrown party.
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 });
const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a3a24, roughness: 0.95 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x555a5c, roughness: 0.6, metalness: 0.4 });
const fabricMat = new THREE.MeshStandardMaterial({ color: 0x3f4a3a, roughness: 0.95 });
const lanternMat = new THREE.MeshStandardMaterial({ color: 0xcfa24a, emissive: 0x8a5f1a, emissiveIntensity: 0.6, roughness: 0.5 });
const festiveMats = [0x7d4646, 0x46607d, 0x7d7046, 0x466b4f].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
);
const toyMats = [0x8f4a44, 0x44688f, 0x8a7a3f, 0x4a8a58].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })
);

// Add a mesh AND a matching floor collider (AABB, padded by player radius,
// same convention as the rest of the generator) in one go.
function addBlocker(group, colliders, geo, mat, x, y, z, halfX, halfZ, rotY = 0) {
  geo.userData.disposable = true; // per-room geometry, not shared — see World.disposeChunk
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (rotY) mesh.rotation.y = rotY;
  group.add(mesh);
  const px = CONFIG.playerRadius;
  colliders.push({ minX: x - halfX - px, maxX: x + halfX + px, minZ: z - halfZ - px, maxZ: z + halfZ + px });
  return mesh;
}

// Cosmetic-only mesh — no collider. Used for small tabletop trinkets that
// already sit inside the table's own footprint.
function addDecor(group, geo, mat, x, y, z, rotY = 0) {
  geo.userData.disposable = true;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (rotY) mesh.rotation.y = rotY;
  group.add(mesh);
  return mesh;
}

// True if a footprint centred at (x,z) with the given half-extents overlaps
// any already-placed collider — used to reroll a spot instead of stacking a
// new prop on top of one already placed earlier in the same room. Adds
// CONFIG.playerRadius the same way addBlocker/addWall do when building the
// *real* collider — every existing collider in `colliders` already includes
// that padding, so comparing against it with an un-padded half-extent here
// would silently accept positions that overlap once the real collider goes in.
function overlapsAny(x, z, halfX, halfZ, colliders) {
  const px = CONFIG.playerRadius;
  const hx = halfX + px;
  const hz = halfZ + px;
  for (const c of colliders) {
    if (x - hx < c.maxX && x + hx > c.minX && z - hz < c.maxZ && z + hz > c.minZ) return true;
  }
  return false;
}

// Capped at maxSpread regardless of room size so props in a big room stay
// clustered near its centre — readable as one scene from one vantage point,
// rather than scattered out toward walls you can barely see. Pushed clear of
// the doorway approach (deterministically — see keepClearOfDoor), then
// rerolled (rejection sampling — up to 20 tries) against every prop already
// placed in this room, so new props don't spawn stacked into earlier ones.
// `clearance` (the same wall-avoidance margin used for spread above) doubles
// as both the door pad and the overlap half-extent — every call site already
// sizes it to roughly the prop's own half-extent plus a buffer, so it's a
// good proxy for "how much room this thing needs" in both roles.
//
// Returns null if no clear spot turns up after every try (a genuinely
// crowded room) — callers must skip placing that prop rather than fall back
// to an overlapping position; silently accepting the last failed attempt is
// exactly what caused props to spawn stacked into each other before.
function randomSpot(rng, room, clearance, colliders, maxSpread = 4.5) {
  const halfW = Math.min(room.w / 2 - clearance, maxSpread);
  const halfD = Math.min(room.d / 2 - clearance, maxSpread);
  for (let i = 0; i < 20; i++) {
    const x0 = room.x + (rng() * 2 - 1) * Math.max(halfW, 0.2);
    const z0 = room.z + (rng() * 2 - 1) * Math.max(halfD, 0.2);
    const { x, z } = keepClearOfDoor(room, x0, z0, clearance);
    if (!overlapsAny(x, z, clearance, clearance, colliders)) return { x, z };
  }
  return null;
}

// Mesh + collider for a table at an already-decided position — the real
// WoodenTable_01 model if it's loaded, else a plain box (only possible if the
// fetch failed; keeps a broken/missing model from ever taking a room's table
// away entirely). `rotated` swaps width/depth for a model dropped sideways —
// the model isn't square, so unlike the small clutter props placed with
// arbitrary rotation, this only ever turns in 90° steps, keeping the
// footprint collider (which doesn't know about rotation) accurate.
function placeTableMesh(group, colliders, tx, tz, tableW, tableD, tableH, rotated, tableObj) {
  if (tableObj) {
    const mesh = tableObj.object3D.clone();
    mesh.position.set(tx, 0, tz);
    mesh.rotation.y = rotated ? Math.PI / 2 : 0;
    group.add(mesh);
  } else {
    addDecor(group, new THREE.BoxGeometry(tableW, 0.07, tableD), woodMat, tx, tableH, tz);
  }
  const px = CONFIG.playerRadius;
  colliders.push({ minX: tx - tableW / 2 - px, maxX: tx + tableW / 2 + px, minZ: tz - tableD / 2 - px, maxZ: tz + tableD / 2 + px });
}

// The table is always placed (it anchors the theme; only wall colliders
// exist to conflict with at this point, so 20 tries essentially never fails)
// — if every try still overlapped somehow, the last attempt is used rather
// than leaving the room without a table.
function addTable(group, colliders, rng, room) {
  const tableObj = getObject("table");
  const rotated = tableObj ? rng() < 0.5 : false;
  const tableW = tableObj ? (rotated ? tableObj.halfZ : tableObj.halfX) * 2 : 1.4 + rng() * 0.7;
  const tableD = tableObj ? (rotated ? tableObj.halfX : tableObj.halfZ) * 2 : 0.75 + rng() * 0.45;
  const tableH = tableObj ? tableObj.height : 0.72;
  const maxOffX = Math.max(room.w / 2 - tableW / 2 - 0.6, 0);
  const maxOffZ = Math.max(room.d / 2 - tableD / 2 - 0.6, 0);
  const halfExtent = Math.max(tableW, tableD) / 2;
  let tx, tz;
  for (let i = 0; i < 20; i++) {
    const tx0 = room.x + (rng() * 2 - 1) * maxOffX * 0.5;
    const tz0 = room.z + (rng() * 2 - 1) * maxOffZ * 0.5;
    ({ x: tx, z: tz } = keepClearOfDoor(room, tx0, tz0, halfExtent + 0.1));
    if (!overlapsAny(tx, tz, halfExtent, halfExtent, colliders)) break;
  }

  placeTableMesh(group, colliders, tx, tz, tableW, tableD, tableH, rotated, tableObj);

  return { tx, tz, tableW, tableD, tableH };
}

// Skips adding the chair entirely if no clear spot turns up (rare — happens
// when the table already fills most of a small room) rather than overlap it.
// Uses the school-chair model (roughly square footprint, so — unlike the
// table — it's fine to spin it to any angle: the square-ish collider stays a
// reasonable approximation at every rotation).
function addChair(group, colliders, rng, room, anchorX, anchorZ, radius) {
  const chairObj = getObject("school-chair");
  const half = chairObj ? Math.max(chairObj.halfX, chairObj.halfZ) : 0.21;
  let spot = null;
  for (let i = 0; i < 20; i++) {
    const angle = rng() * Math.PI * 2;
    const x0 = anchorX + Math.cos(angle) * radius;
    const z0 = anchorZ + Math.sin(angle) * radius;
    const { x, z } = keepClearOfDoor(room, x0, z0, half + 0.2);
    if (!overlapsAny(x, z, half, half, colliders)) {
      spot = { x, z };
      break;
    }
  }
  if (!spot) return;
  const rotY = rng() * Math.PI * 2;
  if (chairObj) {
    const mesh = chairObj.object3D.clone();
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  } else {
    addDecor(group, new THREE.BoxGeometry(half * 2, 0.85, half * 2), woodMat, spot.x, 0.42, spot.z, rotY);
  }
  const px = CONFIG.playerRadius;
  colliders.push({ minX: spot.x - half - px, maxX: spot.x + half + px, minZ: spot.z - half - px, maxZ: spot.z + half + px });
}

// Clone a specific registered model at (x,z) with rotation + an optional
// uniform scale (for size variety among otherwise-identical crates/barrels),
// plus its footprint collider. Returns null if that model hasn't loaded (or
// failed to) — callers need their own procedural fallback shape in that case.
function placeModel(group, colliders, id, x, z, rotY = 0, scale = 1) {
  const obj = getObject(id);
  if (!obj) return null;
  const mesh = obj.object3D.clone();
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotY;
  if (scale !== 1) mesh.scale.multiplyScalar(scale);
  group.add(mesh);
  const halfX = obj.halfX * scale;
  const halfZ = obj.halfZ * scale;
  const px = CONFIG.playerRadius;
  colliders.push({ minX: x - halfX - px, maxX: x + halfX + px, minZ: z - halfZ - px, maxZ: z + halfZ + px });
  return { halfX, halfZ, height: obj.height * scale };
}

// A piece of left-behind Async Research Institute equipment (goal.md §6.8) —
// real STL geometry from the registry (see objects.js) rather than another
// primitive. Returns false (does nothing) if the model cache isn't ready
// yet, every registered model failed to load, or the room's too crowded to
// fit it — a slow/broken fetch or a packed room can never break generation.
function addResearchProp(group, colliders, rng, room) {
  const obj = randomObject(rng);
  if (!obj) return false;
  const spot = randomSpot(rng, room, Math.max(obj.halfX, obj.halfZ) + 0.3, colliders);
  if (!spot) return false;
  const { x, z } = spot;
  const mesh = obj.object3D.clone(); // clone shares cached geometry/material — never mark disposable
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rng() * Math.PI * 2;
  group.add(mesh);
  const px = CONFIG.playerRadius;
  colliders.push({ minX: x - obj.halfX - px, maxX: x + obj.halfX + px, minZ: z - obj.halfZ - px, maxZ: z + obj.halfZ + px });
  return true;
}

// ── Festival: a table, a couple of chairs, and worn decorations. ──────────
function addFestivalTheme(group, colliders, rng, room) {
  const table = addTable(group, colliders, rng, room);

  const chairCount = 1 + Math.floor(rng() * 2); // 1-2 chairs
  for (let i = 0; i < chairCount; i++) {
    addChair(group, colliders, rng, room, table.tx, table.tz, Math.max(table.tableW, table.tableD) / 2 + 0.5);
  }

  const onTableCount = 3 + Math.floor(rng() * 3); // 3-5 tabletop trinkets
  for (let i = 0; i < onTableCount; i++) {
    const mat = festiveMats[Math.floor(rng() * festiveMats.length)];
    const size = 0.11 + rng() * 0.12;
    const px = table.tx + (rng() * 2 - 1) * Math.max(table.tableW / 2 - size, 0.05);
    const pz = table.tz + (rng() * 2 - 1) * Math.max(table.tableD / 2 - size, 0.05);
    const geo = rng() < 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.CylinderGeometry(size / 2, size / 2, size, 8);
    addDecor(group, geo, mat, px, table.tableH + size / 2 + 0.04, pz, rng() * Math.PI * 2);
  }

  if (rng() < 0.3) addResearchProp(group, colliders, rng, room);

  const droppedCount = 1 + Math.floor(rng() * 3); // 1-3 items dropped on the floor
  for (let i = 0; i < droppedCount; i++) {
    const spot = randomSpot(rng, room, 0.6, colliders);
    if (!spot) continue; // room's too crowded for this one — skip it, don't overlap
    const mat = festiveMats[Math.floor(rng() * festiveMats.length)];
    const size = 0.13 + rng() * 0.1;
    const geo = rng() < 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.CylinderGeometry(size / 2, size / 2, size, 8);
    addBlocker(group, colliders, geo, mat, spot.x, size / 2, spot.z, size / 2, size / 2, rng() * Math.PI * 2);
  }
}

// ── Toys: a scatter of toys, sometimes anchored by a toy chest. ───────────
function addToysTheme(group, colliders, rng, room) {
  if (rng() < 0.5) {
    // Toy chest — reuses the wooden-crate model, sized up a bit bigger than
    // the storage theme's crates so it reads as a chest, not just more junk.
    const chestObj = getObject("wooden-crate");
    const scale = 1.1 + rng() * 0.5;
    const clearance = chestObj ? Math.max(chestObj.halfX, chestObj.halfZ) * scale + 0.4 : 0.65;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (spot) {
      if (chestObj) {
        placeModel(group, colliders, "wooden-crate", spot.x, spot.z, rng() * Math.PI * 2, scale);
      } else {
        const w = 0.7 + rng() * 0.3;
        const d = 0.5 + rng() * 0.2;
        addBlocker(group, colliders, new THREE.BoxGeometry(w, 0.45, d), crateMat, spot.x, 0.225, spot.z, w / 2, d / 2, rng() * Math.PI * 2);
      }
    }
  }

  if (rng() < 0.3) addResearchProp(group, colliders, rng, room);

  const count = 4 + Math.floor(rng() * 4); // 4-7 scattered toys
  for (let i = 0; i < count; i++) {
    const roll = rng();
    // A third of the time, a real toy model (duck/baseball) instead of an
    // abstract block/ball/puck — keeps some variety without losing the
    // "pile of assorted toys" read the plain shapes give.
    if (roll < 0.33) {
      const id = rng() < 0.5 ? "toy-duck" : "toy-baseball";
      const obj = getObject(id);
      if (obj) {
        const clearance = Math.max(obj.halfX, obj.halfZ) + 0.3;
        const spot = randomSpot(rng, room, clearance, colliders);
        if (spot) placeModel(group, colliders, id, spot.x, spot.z, rng() * Math.PI * 2);
        continue;
      }
    }
    const spot = randomSpot(rng, room, 0.4, colliders);
    if (!spot) continue;
    const mat = toyMats[Math.floor(rng() * toyMats.length)];
    const size = 0.16 + rng() * 0.18;
    const shapeRoll = rng();
    const geo =
      shapeRoll < 0.4
        ? new THREE.BoxGeometry(size, size, size)
        : shapeRoll < 0.75
          ? new THREE.SphereGeometry(size / 2, 10, 8)
          : new THREE.CylinderGeometry(size / 2, size / 2, size * 0.8, 10);
    addBlocker(group, colliders, geo, mat, spot.x, size / 2, spot.z, size / 2, size / 2, rng() * Math.PI * 2);
  }
}

// ── Camp: a bedroll, a backpack, a lantern, and scattered supplies. ───────
function addCampTheme(group, colliders, rng, room) {
  const bw = 1.7 + rng() * 0.4;
  const bd = 0.6 + rng() * 0.15;
  const bedSpot = randomSpot(rng, room, Math.max(bw, bd) / 2 + 0.5, colliders);
  if (bedSpot) addBlocker(group, colliders, new THREE.BoxGeometry(bw, 0.08, bd), fabricMat, bedSpot.x, 0.04, bedSpot.z, bw / 2, bd / 2, rng() * Math.PI * 2);

  const packSpot = randomSpot(rng, room, 0.5, colliders);
  if (packSpot) addBlocker(group, colliders, new THREE.BoxGeometry(0.34, 0.4, 0.22), fabricMat, packSpot.x, 0.2, packSpot.z, 0.17, 0.11, rng() * Math.PI * 2);

  const lanternObj = getObject("lantern");
  const lanternClearance = lanternObj ? Math.max(lanternObj.halfX, lanternObj.halfZ) + 0.4 : 0.4;
  const lanternSpot = randomSpot(rng, room, lanternClearance, colliders);
  if (lanternSpot) {
    if (lanternObj) placeModel(group, colliders, "lantern", lanternSpot.x, lanternSpot.z, rng() * Math.PI * 2);
    else addBlocker(group, colliders, new THREE.CylinderGeometry(0.1, 0.12, 0.22, 10), lanternMat, lanternSpot.x, 0.11, lanternSpot.z, 0.12, 0.12);
  }

  if (rng() < 0.3) addResearchProp(group, colliders, rng, room);

  const supplyCount = 1 + Math.floor(rng() * 3); // 1-3 cans/boxes
  for (let i = 0; i < supplyCount; i++) {
    const roll = rng();
    const id = roll < 0.4 ? "oil-can" : roll < 0.7 ? "wooden-crate" : "cardboard-box";
    const obj = getObject(id);
    const scale = 0.7 + rng() * 0.4;
    const clearance = obj ? Math.max(obj.halfX, obj.halfZ) * scale + 0.3 : 0.5;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (!spot) continue;
    if (obj) {
      placeModel(group, colliders, id, spot.x, spot.z, rng() * Math.PI * 2, scale);
    } else {
      const mat = rng() < 0.5 ? metalMat : crateMat;
      const size = 0.14 + rng() * 0.12;
      const geo = rng() < 0.5 ? new THREE.CylinderGeometry(size / 2, size / 2, size, 10) : new THREE.BoxGeometry(size, size, size);
      addBlocker(group, colliders, geo, mat, spot.x, size / 2, spot.z, size / 2, size / 2, rng() * Math.PI * 2);
    }
  }
}

// ── Storage: crates and barrels, some stacked, sometimes a standing shelf. ─
function addStorageTheme(group, colliders, rng, room) {
  if (rng() < 0.45) addFloorShelf(group, colliders, rng, room);
  if (rng() < 0.35) addResearchProp(group, colliders, rng, room);

  const crateCount = 3 + Math.floor(rng() * 4); // 3-6 crates
  for (let i = 0; i < crateCount; i++) {
    const id = rng() < 0.5 ? "wooden-crate" : "cardboard-box";
    const obj = getObject(id);
    const scale = 0.8 + rng() * 0.6; // size variety, standing in for the old randomized crate size
    const clearance = obj ? Math.max(obj.halfX, obj.halfZ) * scale + 0.4 : 0.65;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (!spot) continue;
    if (obj) {
      const base = placeModel(group, colliders, id, spot.x, spot.z, rng() * Math.PI * 2, scale);
      if (rng() < 0.35) {
        // Stack a smaller crate/box on top — cosmetic only (no separate
        // collider, the base already blocks this spot).
        const topId = rng() < 0.5 ? "wooden-crate" : "cardboard-box";
        const topObj = getObject(topId);
        if (topObj) {
          const topScale = scale * (0.55 + rng() * 0.2);
          const mesh = topObj.object3D.clone();
          mesh.scale.multiplyScalar(topScale);
          mesh.position.set(spot.x, base.height, spot.z);
          mesh.rotation.y = rng() * Math.PI * 2;
          group.add(mesh);
        }
      }
    } else {
      const size = 0.5 + rng() * 0.35;
      const h = size * (0.8 + rng() * 0.3);
      addBlocker(group, colliders, new THREE.BoxGeometry(size, h, size), crateMat, spot.x, h / 2, spot.z, size / 2, size / 2, rng() * Math.PI * 2);
    }
  }

  const barrelCount = 1 + Math.floor(rng() * 3); // 1-3 barrels
  for (let i = 0; i < barrelCount; i++) {
    const obj = getObject("barrel");
    const scale = 0.9 + rng() * 0.3;
    const clearance = obj ? Math.max(obj.halfX, obj.halfZ) * scale + 0.4 : 0.65;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (!spot) continue;
    if (obj) {
      placeModel(group, colliders, "barrel", spot.x, spot.z, rng() * Math.PI * 2, scale);
    } else {
      const r = 0.24 + rng() * 0.08;
      const h = 0.75 + rng() * 0.2;
      addBlocker(group, colliders, new THREE.CylinderGeometry(r, r, h, 12), metalMat, spot.x, h / 2, spot.z, r, r);
    }
  }
}

// ── Standing shelf/rack: the registered Shelf_01 model. Only ever rotated in
// 90° steps (like the table) so the footprint collider — which doesn't know
// about rotation — stays accurate for its elongated shape. Does nothing if
// the model hasn't loaded or the room's too crowded for it, rather than
// falling back to a primitive or overlapping something already placed.
function addFloorShelf(group, colliders, rng, room) {
  const obj = getObject("shelf");
  if (!obj) return;
  const rotated = rng() < 0.5;
  const halfX = rotated ? obj.halfZ : obj.halfX;
  const halfZ = rotated ? obj.halfX : obj.halfZ;
  const spot = randomSpot(rng, room, Math.max(halfX, halfZ) + 0.5, colliders);
  if (!spot) return;
  const { x, z } = spot;

  const mesh = obj.object3D.clone();
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rotated ? Math.PI / 2 : 0;
  group.add(mesh);

  const px = CONFIG.playerRadius;
  colliders.push({ minX: x - halfX - px, maxX: x + halfX + px, minZ: z - halfZ - px, maxZ: z + halfZ + px });
}

// ── Party: a table at the room's centre with cake, confetti on the floor,
// and streamers sagging across the ceiling. ───────────────────────────────
const partyMats = [0xb84a4a, 0x4a7fb8, 0xd4b23a, 0x4aa662, 0xb84a94].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide })
);
const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.5 });
const cakeMat = new THREE.MeshStandardMaterial({ color: 0xe0b98a, roughness: 0.6 });
const frostingMat = new THREE.MeshStandardMaterial({ color: 0xd66fa0, roughness: 0.5 });
const cherryMat = new THREE.MeshStandardMaterial({ color: 0x9c1f2e, roughness: 0.35 });

// A paper plate sitting on the table, with one cake slice on it. The slice
// is a 3-sided prism (a triangular cross-section) rather than a box or
// cylinder — reads as a wedge shape — topped with a frosting layer and a
// cherry.
function addCakeOnPlate(group, rng, tableX, tableZ, tableTopY) {
  const plateR = 0.17;
  addDecor(group, new THREE.CylinderGeometry(plateR, plateR, 0.012, 16), plateMat, tableX, tableTopY + 0.006, tableZ);

  const sliceR = 0.1;
  const sliceH = 0.085;
  const rotY = rng() * Math.PI * 2;
  addDecor(group, new THREE.CylinderGeometry(sliceR, sliceR, sliceH, 3), cakeMat, tableX, tableTopY + 0.012 + sliceH / 2, tableZ, rotY);
  const frostingY = tableTopY + 0.012 + sliceH + 0.007;
  addDecor(group, new THREE.CylinderGeometry(sliceR * 0.85, sliceR * 0.85, 0.014, 3), frostingMat, tableX, frostingY, tableZ, rotY);

  const cherryR = 0.02;
  addDecor(group, new THREE.SphereGeometry(cherryR, 8, 6), cherryMat, tableX, frostingY + 0.007 + cherryR, tableZ);
}

// Small flat confetti pieces scattered on the floor — cosmetic only, like
// the tabletop trinkets elsewhere; real confetti wouldn't meaningfully
// block walking, and colliding with every piece would be absurd.
function addConfetti(group, rng, room) {
  const count = 25 + Math.floor(rng() * 15); // 25-39 pieces
  const halfW = Math.max(room.w / 2 - 0.4, 0.5);
  const halfD = Math.max(room.d / 2 - 0.4, 0.5);
  for (let i = 0; i < count; i++) {
    const mat = partyMats[Math.floor(rng() * partyMats.length)];
    const size = 0.03 + rng() * 0.025;
    const x = room.x + (rng() * 2 - 1) * halfW;
    const z = room.z + (rng() * 2 - 1) * halfD;
    const square = rng() < 0.5;
    const geo = square ? new THREE.BoxGeometry(size, 0.004, size) : new THREE.CircleGeometry(size / 2, 6);
    const rotX = square ? 0 : -Math.PI / 2; // circles are drawn facing +Z by default — lay them flat
    const mesh = new THREE.Mesh(geo, mat);
    geo.userData.disposable = true;
    mesh.position.set(x, 0.003, z);
    mesh.rotation.set(rotX, rng() * Math.PI * 2, 0);
    group.add(mesh);
  }
}

// Streamers across the ceiling were tried here and pulled back out — a
// procedurally-sagging strip built from boxes never quite reads right.
// Flynn's adding a real streamer model to objects.js later; re-add a call
// to place it here once that's registered.

function addPartyTheme(group, colliders, rng, room) {
  // Table stays at the room's true centre — always well outside the
  // doorway's 3m-deep approach (rooms are at least 9m across), so this
  // rarely if ever needs the door-avoidance nudge, but it's there just in case.
  const tableObj = getObject("table");
  const rotated = tableObj ? rng() < 0.5 : false;
  const tableW = tableObj ? (rotated ? tableObj.halfZ : tableObj.halfX) * 2 : 1.4 + rng() * 0.5;
  const tableD = tableObj ? (rotated ? tableObj.halfX : tableObj.halfZ) * 2 : 0.8 + rng() * 0.3;
  const tableH = tableObj ? tableObj.height : 0.72;
  const { x: tx, z: tz } = keepClearOfDoor(room, room.x, room.z, Math.max(tableW, tableD) / 2 + 0.1);
  placeTableMesh(group, colliders, tx, tz, tableW, tableD, tableH, rotated, tableObj);

  addCakeOnPlate(group, rng, tx, tz, tableH);
  addConfetti(group, rng, room);
}

// ── Wall-mounted decorations. Purely cosmetic (no collider) — this game's
// collision is 2D/floor-level, so something mounted at head height doesn't
// block walking underneath, the way a real shelf wouldn't either. ─────────

// Position + orientation info for one of a room's 4 walls: `cx,cz` is the
// wall's centre, `nx,nz` the inward-facing normal, `tx,tz` the tangent
// (direction along the wall's length), `length` the wall's span.
function wallGeometry(room, side) {
  switch (side) {
    case "n":
      return { cx: room.x, cz: room.z - room.d / 2, nx: 0, nz: 1, tx: 1, tz: 0, length: room.w };
    case "s":
      return { cx: room.x, cz: room.z + room.d / 2, nx: 0, nz: -1, tx: 1, tz: 0, length: room.w };
    case "w":
      return { cx: room.x - room.w / 2, cz: room.z, nx: 1, nz: 0, tx: 0, tz: 1, length: room.d };
    default:
      return { cx: room.x + room.w / 2, cz: room.z, nx: -1, nz: 0, tx: 0, tz: 1, length: room.d };
  }
}

// A random solid wall (never the doorway side).
function pickWallSide(rng, room) {
  const sides = ["n", "s", "e", "w"].filter((s) => s !== room.openSide);
  return sides[Math.floor(rng() * sides.length)];
}

// Mount a box flush against a wall's inner face, `along` the wall's length
// (offset from its centre) and `extraOffset` further out from the wall (for
// layering, e.g. a picture on top of its own frame).
function mountBox(group, room, side, decorW, decorH, thickness, mat, heightY, along, extraOffset = 0) {
  const wg = wallGeometry(room, side);
  const px = wg.cx + wg.tx * along;
  const pz = wg.cz + wg.tz * along;
  const off = CONFIG.wallThickness / 2 + thickness / 2 + 0.02 + extraOffset;
  const mx = px + wg.nx * off;
  const mz = pz + wg.nz * off;
  const sizeX = wg.tx !== 0 ? decorW : thickness;
  const sizeZ = wg.tz !== 0 ? decorW : thickness;
  addDecor(group, new THREE.BoxGeometry(sizeX, decorH, sizeZ), mat, mx, heightY, mz);
}

// Mount a wall-decor MODEL (as opposed to mountBox's plain box) flush
// against a wall's inner face. The registered template must be `wallMount:
// true` (see objects.js) — already Y-centred rather than floor-resting, and
// authored with its thin/depth axis along local Z, so rotating around Y
// aligns that axis with the wall's outward normal (same as the arrow
// decals' facing math). Returns false (does nothing) if the model hasn't
// loaded yet, so callers keep a procedural fallback for that rare case.
function mountModel(group, room, side, id, along, heightY) {
  const obj = getObject(id);
  if (!obj) return false;
  const wg = wallGeometry(room, side);
  const px = wg.cx + wg.tx * along;
  const pz = wg.cz + wg.tz * along;
  const off = CONFIG.wallThickness / 2 + obj.halfZ + 0.02;
  const mesh = obj.object3D.clone();
  mesh.position.set(px + wg.nx * off, heightY, pz + wg.nz * off);
  mesh.rotation.y = Math.atan2(wg.nx, wg.nz);
  group.add(mesh);
  return true;
}

function addWallDecor(group, rng, room) {
  if (rng() >= 0.55) return; // just over half of rooms get one
  const side = pickWallSide(rng, room);
  const wg = wallGeometry(room, side);
  const along = (rng() * 2 - 1) * Math.max(wg.length / 2 - 1.2, 0.2);

  if (room.theme === "festival") {
    // The registered picture-frame model if it's loaded; else the old
    // wood-border + coloured-"photo" box composite.
    const y = 1.5 + rng() * 0.5;
    if (!mountModel(group, room, side, "picture-frame", along, y)) {
      const w = 0.55 + rng() * 0.3;
      const h = 0.4 + rng() * 0.25;
      mountBox(group, room, side, w, h, 0.03, woodMat, y, along, 0);
      const mat = festiveMats[Math.floor(rng() * festiveMats.length)];
      mountBox(group, room, side, w * 0.7, h * 0.65, 0.015, mat, y, along, 0.02);
    }
  } else if (room.theme === "toys") {
    // A small shelf with a couple of toys on it — same shape as storage's
    // wall shelf below, just toy-coloured, so it reads clearly as "toys on
    // a shelf" rather than an ambiguous scatter of thin marks.
    const w = 0.5 + rng() * 0.3;
    const y = 1.2 + rng() * 0.5;
    mountBox(group, room, side, w, 0.04, 0.16, woodMat, y, along, 0);
    const px = wg.cx + wg.tx * along;
    const pz = wg.cz + wg.tz * along;
    const itemCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < itemCount; i++) {
      const mat = toyMats[Math.floor(rng() * toyMats.length)];
      const size = 0.08 + rng() * 0.06;
      const off = (rng() * 2 - 1) * (w / 2 - size);
      const ix = px + wg.tx * off + wg.nx * (CONFIG.wallThickness / 2 + 0.09);
      const iz = pz + wg.tz * off + wg.nz * (CONFIG.wallThickness / 2 + 0.09);
      const geo = rng() < 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.CylinderGeometry(size / 2, size / 2, size, 8);
      addDecor(group, geo, mat, ix, y + 0.02 + size / 2, iz);
    }
  } else if (room.theme === "camp") {
    // A pinned paper or map.
    const w = 0.35 + rng() * 0.2;
    const h = 0.45 + rng() * 0.2;
    const y = 1.4 + rng() * 0.5;
    mountBox(group, room, side, w, h, 0.008, fabricMat, y, along, 0);
  } else if (room.theme === "party") {
    // A row of small bunting flags.
    const flagCount = 5 + Math.floor(rng() * 4);
    const y = 2.0 + rng() * 0.3;
    const spacing = 0.22;
    for (let i = 0; i < flagCount; i++) {
      const mat = partyMats[Math.floor(rng() * partyMats.length)];
      const bob = i % 2 === 0 ? 0 : -0.04;
      mountBox(group, room, side, 0.14, 0.16, 0.01, mat, y + bob, along + (i - flagCount / 2) * spacing, 0);
    }
  } else {
    // Storage: a wall shelf with a couple of small items on it.
    const w = 0.8 + rng() * 0.4;
    const y = 1.6 + rng() * 0.4;
    mountBox(group, room, side, w, 0.05, 0.22, crateMat, y, along, 0);
    const px = wg.cx + wg.tx * along;
    const pz = wg.cz + wg.tz * along;
    const itemCount = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < itemCount; i++) {
      const mat = rng() < 0.5 ? metalMat : crateMat;
      const size = 0.1 + rng() * 0.1;
      const off = (rng() * 2 - 1) * (w / 2 - size);
      const ix = px + wg.tx * off + wg.nx * (CONFIG.wallThickness / 2 + 0.11);
      const iz = pz + wg.tz * off + wg.nz * (CONFIG.wallThickness / 2 + 0.11);
      const geo = rng() < 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.CylinderGeometry(size / 2, size / 2, size, 8);
      addDecor(group, geo, mat, ix, y + 0.03 + size / 2, iz);
    }
  }
}

// Build one room's geometry + colliders. `materials.wall` is reused for the
// walls so a special room still looks built from the same place, not a
// separate biome.
export function buildRoomGroup(room, materials) {
  const group = new THREE.Group();
  const colliders = [];
  buildWalls(group, colliders, materials.wall, room);

  const propRng = rngForRegion(SALT_PROPS, room.rx, room.ry);
  if (room.theme === "festival") addFestivalTheme(group, colliders, propRng, room);
  else if (room.theme === "toys") addToysTheme(group, colliders, propRng, room);
  else if (room.theme === "camp") addCampTheme(group, colliders, propRng, room);
  else if (room.theme === "party") addPartyTheme(group, colliders, propRng, room);
  else addStorageTheme(group, colliders, propRng, room);

  addWallDecor(group, propRng, room);

  return { group, colliders };
}
