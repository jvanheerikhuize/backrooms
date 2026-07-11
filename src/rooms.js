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
  const themes = ["festival", "toys", "camp", "storage"];
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

// Capped at maxSpread regardless of room size so props in a big room stay
// clustered near its centre — readable as one scene from one vantage point,
// rather than scattered out toward walls you can barely see. Pushed clear of
// the doorway approach (deterministically — see keepClearOfDoor) so nothing
// ends up blocking, or sitting in, the only way in. `clearance` (the same
// wall-avoidance margin used for spread above) doubles as the door pad —
// every call site already sizes it to roughly the prop's own half-extent
// plus a buffer, so it's a good proxy for "how much room this thing needs".
function randomSpot(rng, room, clearance, maxSpread = 4.5) {
  const halfW = Math.min(room.w / 2 - clearance, maxSpread);
  const halfD = Math.min(room.d / 2 - clearance, maxSpread);
  const x = room.x + (rng() * 2 - 1) * Math.max(halfW, 0.2);
  const z = room.z + (rng() * 2 - 1) * Math.max(halfD, 0.2);
  return keepClearOfDoor(room, x, z, clearance);
}

function addTable(group, colliders, rng, room) {
  const tableW = 1.4 + rng() * 0.7;
  const tableD = 0.75 + rng() * 0.45;
  const tableH = 0.72;
  const maxOffX = Math.max(room.w / 2 - tableW / 2 - 0.6, 0);
  const maxOffZ = Math.max(room.d / 2 - tableD / 2 - 0.6, 0);
  const tx0 = room.x + (rng() * 2 - 1) * maxOffX * 0.5;
  const tz0 = room.z + (rng() * 2 - 1) * maxOffZ * 0.5;
  const { x: tx, z: tz } = keepClearOfDoor(room, tx0, tz0, Math.max(tableW, tableD) / 2 + 0.1);

  addDecor(group, new THREE.BoxGeometry(tableW, 0.07, tableD), woodMat, tx, tableH, tz);
  addBlocker(group, colliders, new THREE.BoxGeometry(0.12, tableH, 0.12), woodMat, tx, tableH / 2, tz, tableW / 2, tableD / 2);

  return { tx, tz, tableW, tableD, tableH };
}

function addChair(group, colliders, rng, room, anchorX, anchorZ, radius) {
  const size = 0.42;
  const angle = rng() * Math.PI * 2;
  const x0 = anchorX + Math.cos(angle) * radius;
  const z0 = anchorZ + Math.sin(angle) * radius;
  const { x, z } = keepClearOfDoor(room, x0, z0, size / 2 + 0.2);
  const rotY = rng() * Math.PI * 2;
  addBlocker(group, colliders, new THREE.BoxGeometry(size, 0.85, size), woodMat, x, 0.42, z, size / 2, size / 2, rotY);
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

  const droppedCount = 2 + Math.floor(rng() * 3); // 2-4 items dropped on the floor
  for (let i = 0; i < droppedCount; i++) {
    const mat = festiveMats[Math.floor(rng() * festiveMats.length)];
    const size = 0.13 + rng() * 0.1;
    const { x, z } = randomSpot(rng, room, 0.6);
    const geo = rng() < 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.CylinderGeometry(size / 2, size / 2, size, 8);
    addBlocker(group, colliders, geo, mat, x, size / 2, z, size / 2, size / 2, rng() * Math.PI * 2);
  }
}

// ── Toys: a scatter of toys, sometimes anchored by a toy chest. ───────────
function addToysTheme(group, colliders, rng, room) {
  if (rng() < 0.5) {
    const w = 0.7 + rng() * 0.3;
    const d = 0.5 + rng() * 0.2;
    const { x, z } = randomSpot(rng, room, Math.max(w, d) / 2 + 0.4);
    addBlocker(group, colliders, new THREE.BoxGeometry(w, 0.45, d), crateMat, x, 0.225, z, w / 2, d / 2, rng() * Math.PI * 2);
  }

  const count = 5 + Math.floor(rng() * 4); // 5-8 scattered toys
  for (let i = 0; i < count; i++) {
    const mat = toyMats[Math.floor(rng() * toyMats.length)];
    const size = 0.16 + rng() * 0.18;
    const { x, z } = randomSpot(rng, room, 0.4);
    const roll = rng();
    const geo =
      roll < 0.4
        ? new THREE.BoxGeometry(size, size, size)
        : roll < 0.75
          ? new THREE.SphereGeometry(size / 2, 10, 8)
          : new THREE.CylinderGeometry(size / 2, size / 2, size * 0.8, 10);
    addBlocker(group, colliders, geo, mat, x, size / 2, z, size / 2, size / 2, rng() * Math.PI * 2);
  }
}

// ── Camp: a bedroll, a backpack, a lantern, and scattered supplies. ───────
function addCampTheme(group, colliders, rng, room) {
  const bw = 1.7 + rng() * 0.4;
  const bd = 0.6 + rng() * 0.15;
  const { x: bx, z: bz } = randomSpot(rng, room, Math.max(bw, bd) / 2 + 0.5);
  addBlocker(group, colliders, new THREE.BoxGeometry(bw, 0.08, bd), fabricMat, bx, 0.04, bz, bw / 2, bd / 2, rng() * Math.PI * 2);

  const { x: pkx, z: pkz } = randomSpot(rng, room, 0.5);
  addBlocker(group, colliders, new THREE.BoxGeometry(0.34, 0.4, 0.22), fabricMat, pkx, 0.2, pkz, 0.17, 0.11, rng() * Math.PI * 2);

  const { x: lx, z: lz } = randomSpot(rng, room, 0.4);
  addBlocker(group, colliders, new THREE.CylinderGeometry(0.1, 0.12, 0.22, 10), lanternMat, lx, 0.11, lz, 0.12, 0.12);

  const supplyCount = 2 + Math.floor(rng() * 3); // 2-4 cans/boxes
  for (let i = 0; i < supplyCount; i++) {
    const mat = rng() < 0.5 ? metalMat : crateMat;
    const size = 0.14 + rng() * 0.12;
    const { x, z } = randomSpot(rng, room, 0.35);
    const geo = rng() < 0.5 ? new THREE.CylinderGeometry(size / 2, size / 2, size, 10) : new THREE.BoxGeometry(size, size, size);
    addBlocker(group, colliders, geo, mat, x, size / 2, z, size / 2, size / 2, rng() * Math.PI * 2);
  }
}

// ── Storage: crates and barrels, some stacked, sometimes a standing shelf. ─
function addStorageTheme(group, colliders, rng, room) {
  if (rng() < 0.45) addFloorShelf(group, colliders, rng, room);

  const crateCount = 4 + Math.floor(rng() * 4); // 4-7 crates
  for (let i = 0; i < crateCount; i++) {
    const size = 0.5 + rng() * 0.35;
    const { x, z } = randomSpot(rng, room, size / 2 + 0.4);
    const h = size * (0.8 + rng() * 0.3);
    const mesh = addBlocker(group, colliders, new THREE.BoxGeometry(size, h, size), crateMat, x, h / 2, z, size / 2, size / 2, rng() * Math.PI * 2);
    if (rng() < 0.4) {
      // Stack a smaller crate on top — cosmetic only, the base already blocks this spot.
      const topSize = size * (0.55 + rng() * 0.2);
      addDecor(group, new THREE.BoxGeometry(topSize, topSize, topSize), crateMat, x, h + topSize / 2, z, rng() * Math.PI * 2);
    }
  }

  const barrelCount = 1 + Math.floor(rng() * 3); // 1-3 barrels
  for (let i = 0; i < barrelCount; i++) {
    const r = 0.24 + rng() * 0.08;
    const h = 0.75 + rng() * 0.2;
    const { x, z } = randomSpot(rng, room, r + 0.4);
    addBlocker(group, colliders, new THREE.CylinderGeometry(r, r, h, 12), metalMat, x, h / 2, z, r, r);
  }
}

// ── Standing shelf/rack: a distinct silhouette (two posts + planks) rather
// than another box or cylinder — floor-standing, axis-aligned (no rotation,
// to keep its collider a simple accurate AABB). ──────────────────────────
function addFloorShelf(group, colliders, rng, room) {
  const w = 0.9 + rng() * 0.4;
  const h = 1.5 + rng() * 0.4;
  const depth = 0.32;
  const { x, z } = randomSpot(rng, room, Math.max(w, depth) / 2 + 0.5);

  addDecor(group, new THREE.BoxGeometry(0.05, h, depth), woodMat, x - w / 2 + 0.025, h / 2, z);
  addDecor(group, new THREE.BoxGeometry(0.05, h, depth), woodMat, x + w / 2 - 0.025, h / 2, z);

  const shelfCount = 3;
  for (let i = 0; i < shelfCount; i++) {
    const ly = 0.15 + (h - 0.3) * (i / (shelfCount - 1));
    addDecor(group, new THREE.BoxGeometry(w, 0.04, depth), woodMat, x, ly, z);
    if (i > 0 && rng() < 0.6) {
      const mat = rng() < 0.5 ? metalMat : crateMat;
      const size = 0.1 + rng() * 0.1;
      const ix = x + (rng() * 2 - 1) * (w / 2 - size);
      const geo = rng() < 0.5 ? new THREE.BoxGeometry(size, size, size) : new THREE.CylinderGeometry(size / 2, size / 2, size, 8);
      addDecor(group, geo, mat, ix, ly + 0.02 + size / 2, z);
    }
  }

  const px = CONFIG.playerRadius;
  colliders.push({ minX: x - w / 2 - px, maxX: x + w / 2 + px, minZ: z - depth / 2 - px, maxZ: z + depth / 2 + px });
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

function addWallDecor(group, rng, room) {
  if (rng() >= 0.55) return; // just over half of rooms get one
  const side = pickWallSide(rng, room);
  const wg = wallGeometry(room, side);
  const along = (rng() * 2 - 1) * Math.max(wg.length / 2 - 1.2, 0.2);

  if (room.theme === "festival") {
    // A picture frame — wood border + a smaller coloured "photo" layered in front.
    const w = 0.55 + rng() * 0.3;
    const h = 0.4 + rng() * 0.25;
    const y = 1.5 + rng() * 0.5;
    mountBox(group, room, side, w, h, 0.03, woodMat, y, along, 0);
    const mat = festiveMats[Math.floor(rng() * festiveMats.length)];
    mountBox(group, room, side, w * 0.7, h * 0.65, 0.015, mat, y, along, 0.02);
  } else if (room.theme === "toys") {
    // A creepy height-chart scrawl — small tick marks climbing the wall.
    const tickCount = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < tickCount; i++) {
      const y = 0.5 + i * (0.18 + rng() * 0.06);
      mountBox(group, room, side, 0.16 + rng() * 0.1, 0.02, 0.01, woodMat, y, along + (rng() * 0.2 - 0.1), 0);
    }
  } else if (room.theme === "camp") {
    // A pinned paper or map.
    const w = 0.35 + rng() * 0.2;
    const h = 0.45 + rng() * 0.2;
    const y = 1.4 + rng() * 0.5;
    mountBox(group, room, side, w, h, 0.008, fabricMat, y, along, 0);
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
  else addStorageTheme(group, colliders, propRng, room);

  addWallDecor(group, propRng, room);

  return { group, colliders };
}
