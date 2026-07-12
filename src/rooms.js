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
import { randomSvgProp } from "./svgprops.js";
import { randomSkin } from "./textures.js";

const RS = CONFIG.specialRooms;
const SALT_SHAPE = 0x7001;
const SALT_PROPS = 0x8001;
const SALT_SKIN = 0x9001; // independent stream so re-skinning doesn't shift prop layouts

// Materials for the festival room's table-top cake slice (see addCake) —
// simple enough to build from primitives rather than pull in a real asset,
// so built once here and shared across every clone like the rest of this
// file's procedural shapes.
// DoubleSide guards against winding-order surprises on the hand-built wedge
// shape below — cheap for a prop this small.
const CAKE_MAT = new THREE.MeshStandardMaterial({ color: 0xe8607f, roughness: 0.75, side: THREE.DoubleSide }); // strawberry-pink sponge
const CREAM_MAT = new THREE.MeshStandardMaterial({ color: 0xfff5f0, roughness: 0.55, side: THREE.DoubleSide }); // cream layer on top
const PLATE_MAT = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.5 });
const CHERRY_MAT = new THREE.MeshStandardMaterial({ color: 0x8a0f1a, roughness: 0.3, metalness: 0.05 });

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
  if (!tableObj) return; // asset-only: no procedural table stand-in
  const mesh = tableObj.object3D.clone();
  mesh.position.set(tx, 0, tz);
  mesh.rotation.y = rotated ? Math.PI / 2 : 0;
  group.add(mesh);
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
  if (!spot || !chairObj) return; // asset-only: no procedural chair stand-in
  const rotY = rng() * Math.PI * 2;
  const mesh = chairObj.object3D.clone();
  mesh.position.set(spot.x, 0, spot.z);
  mesh.rotation.y = rotY;
  group.add(mesh);
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

// A table-top cake SLICE: a paper plate, a wedge of strawberry sponge with a
// cream layer on top, and a cherry — procedural primitives (like the rest of
// this file's shapes), not a real asset, since a cake slice is simple enough
// not to need one. Purely decorative — the table underneath already has the
// floor collider, so this needs none.
const SLICE_ANGLE = Math.PI / 3; // 60° wedge — reads clearly as a cut slice, not a whole cake
const SLICE_HALF = SLICE_ANGLE / 2;
// Exact centroid distance of a circular sector from its point, as a fraction
// of its radius: (2/3) * sin(half-angle)/half-angle.
const SLICE_CENTROID_FRAC = (2 / 3) * (Math.sin(SLICE_HALF) / SLICE_HALF);

// A pie-slice wedge, built from a 2D Shape and extruded — NOT a partial
// CylinderGeometry, which only builds the curved crust wall plus top/bottom
// caps and leaves the two flat "cut" faces open (three.js never closes those
// for a partial theta sweep). Extruding a Shape gets the cut faces for free
// as part of its side wall. Recentred so its centroid — not its point — sits
// at the mesh's local origin, since callers (including the cherry) want to
// position it like any other prop.
function wedgeGeometry(radius, height) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0, radius, -SLICE_HALF, SLICE_HALF, false);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 16 });
  geo.rotateX(-Math.PI / 2); // shape's XY plane -> world XZ; the extrusion (Z) becomes up (Y)
  geo.translate(-radius * SLICE_CENTROID_FRAC, -height / 2, 0); // centroid to local origin; centre the height too
  geo.userData.disposable = true; // per-room geometry, not shared — see World.disposeChunk
  return geo;
}

function addCake(group, tx, tz, tableH) {
  const plateGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.012, 24);
  plateGeo.userData.disposable = true;
  const plate = new THREE.Mesh(plateGeo, PLATE_MAT);
  plate.position.set(tx, tableH + 0.006, tz);
  group.add(plate);

  const radius = 0.135;
  const spongeH = 0.065;
  const creamH = 0.02;

  const sponge = new THREE.Mesh(wedgeGeometry(radius, spongeH), CAKE_MAT);
  sponge.position.set(tx, tableH + 0.012 + spongeH / 2, tz);
  group.add(sponge);

  const cream = new THREE.Mesh(wedgeGeometry(radius * 0.96, creamH), CREAM_MAT);
  cream.position.set(tx, tableH + 0.012 + spongeH + creamH / 2, tz);
  group.add(cream);

  const cherryGeo = new THREE.SphereGeometry(0.018, 12, 10);
  cherryGeo.userData.disposable = true;
  const cherry = new THREE.Mesh(cherryGeo, CHERRY_MAT);
  cherry.position.set(tx, tableH + 0.012 + spongeH + creamH + 0.014, tz);
  group.add(cherry);
}

// ── Festival: a table (with a cake on top), a couple of chairs, and worn
// decorations. ─────────────────────────────────────────────────────────────
function addFestivalTheme(group, colliders, rng, room) {
  const table = addTable(group, colliders, rng, room);
  addCake(group, table.tx, table.tz, table.tableH);

  const chairCount = 1 + Math.floor(rng() * 2); // 1-2 chairs
  for (let i = 0; i < chairCount; i++) {
    addChair(group, colliders, rng, room, table.tx, table.tz, Math.max(table.tableW, table.tableD) / 2 + 0.5);
  }

  if (rng() < 0.3) addResearchProp(group, colliders, rng, room);
}

// ── Toys: a scatter of toys, sometimes anchored by a toy chest. ───────────
function addToysTheme(group, colliders, rng, room) {
  if (rng() < 0.5) {
    // Toy chest — reuses the wooden-crate model, sized up a bit bigger than
    // the storage theme's crates so it reads as a chest, not just more junk.
    const chestObj = getObject("wooden-crate");
    const scale = 1.1 + rng() * 0.5;
    if (chestObj) {
      const clearance = Math.max(chestObj.halfX, chestObj.halfZ) * scale + 0.4;
      const spot = randomSpot(rng, room, clearance, colliders);
      if (spot) placeModel(group, colliders, "wooden-crate", spot.x, spot.z, rng() * Math.PI * 2, scale);
    }
  }

  if (rng() < 0.3) addResearchProp(group, colliders, rng, room);

  const count = 4 + Math.floor(rng() * 4); // 4-7 scattered toy models (duck / baseball)
  for (let i = 0; i < count; i++) {
    const id = rng() < 0.5 ? "toy-duck" : "toy-baseball";
    const obj = getObject(id);
    if (!obj) continue;
    const clearance = Math.max(obj.halfX, obj.halfZ) + 0.3;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (spot) placeModel(group, colliders, id, spot.x, spot.z, rng() * Math.PI * 2);
  }
}

// ── Camp: a bedroll, a backpack, a lantern, and scattered supplies. ───────
function addCampTheme(group, colliders, rng, room) {
  const lanternObj = getObject("lantern");
  if (lanternObj) {
    const lanternClearance = Math.max(lanternObj.halfX, lanternObj.halfZ) + 0.4;
    const lanternSpot = randomSpot(rng, room, lanternClearance, colliders);
    if (lanternSpot) placeModel(group, colliders, "lantern", lanternSpot.x, lanternSpot.z, rng() * Math.PI * 2);
  }

  if (rng() < 0.3) addResearchProp(group, colliders, rng, room);

  const supplyCount = 1 + Math.floor(rng() * 3); // 1-3 supply models (oil can / crate / box)
  for (let i = 0; i < supplyCount; i++) {
    const roll = rng();
    const id = roll < 0.4 ? "oil-can" : roll < 0.7 ? "wooden-crate" : "cardboard-box";
    const obj = getObject(id);
    if (!obj) continue;
    const scale = 0.7 + rng() * 0.4;
    const clearance = Math.max(obj.halfX, obj.halfZ) * scale + 0.3;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (spot) placeModel(group, colliders, id, spot.x, spot.z, rng() * Math.PI * 2, scale);
  }
}

// ── Storage: crates and barrels, some stacked, sometimes a standing shelf. ─
function addStorageTheme(group, colliders, rng, room, wallCount) {
  if (rng() < 0.45) addFloorShelf(group, colliders, rng, room, wallCount);
  if (rng() < 0.35) addResearchProp(group, colliders, rng, room);

  const crateCount = 3 + Math.floor(rng() * 4); // 3-6 crates
  for (let i = 0; i < crateCount; i++) {
    const id = rng() < 0.5 ? "wooden-crate" : "cardboard-box";
    const obj = getObject(id);
    const scale = 0.8 + rng() * 0.6; // size variety, standing in for the old randomized crate size
    if (!obj) continue;
    const clearance = Math.max(obj.halfX, obj.halfZ) * scale + 0.4;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (!spot) continue;
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
  }

  const barrelCount = 1 + Math.floor(rng() * 3); // 1-3 barrels
  for (let i = 0; i < barrelCount; i++) {
    const obj = getObject("barrel");
    if (!obj) continue;
    const scale = 0.9 + rng() * 0.3;
    const clearance = Math.max(obj.halfX, obj.halfZ) * scale + 0.4;
    const spot = randomSpot(rng, room, clearance, colliders);
    if (spot) placeModel(group, colliders, "barrel", spot.x, spot.z, rng() * Math.PI * 2, scale);
  }
}

// ── Standing shelf/rack: the registered Shelf_01 model. Always placed flush
// against one of the room's solid walls (never floating out in the open) —
// tries every solid wall (shuffled) and a few positions along each, same
// "skip rather than overlap" contract as the rest of this generator. Rotates
// the model's local Z (its depth axis, same wall-mount convention as
// mountModel below) onto the wall's outward normal, so it only ever turns in
// 90° steps — like the table, that keeps the footprint collider (which
// doesn't know about rotation) accurate.
//
// `wallCount` is how many entries at the front of `colliders` are the room's
// OWN walls (added by buildWalls before any prop runs) — sitting flush
// against a wall means the shelf's collider necessarily falls inside that
// wall collider's own player-radius padding, so the overlap check below
// only looks at colliders placed AFTER the walls (other props), not the
// walls themselves.
function addFloorShelf(group, colliders, rng, room, wallCount) {
  const obj = getObject("shelf");
  if (!obj) return;
  const otherProps = colliders.slice(wallCount);
  const sides = ["n", "s", "e", "w"].filter((s) => s !== room.openSide);
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  const alongHalf = obj.halfX; // width runs along the wall
  const outHalf = obj.halfZ; // depth sticks out from the wall
  const clearance = 0.3;

  for (const side of sides) {
    const wg = wallGeometry(room, side);
    const maxAlong = wg.length / 2 - alongHalf - clearance;
    if (maxAlong <= 0) continue;
    for (let attempt = 0; attempt < 6; attempt++) {
      const along = (rng() * 2 - 1) * maxAlong;
      const off = CONFIG.wallThickness / 2 + outHalf + 0.02;
      const x = wg.cx + wg.tx * along + wg.nx * off;
      const z = wg.cz + wg.tz * along + wg.nz * off;
      const clear = keepClearOfDoor(room, x, z, Math.max(alongHalf, outHalf));
      if (clear.x !== x || clear.z !== z) continue; // door-avoidance would shove it off the wall — try another spot instead
      const worldHalfX = wg.nx === 0 ? alongHalf : outHalf;
      const worldHalfZ = wg.nx === 0 ? outHalf : alongHalf;
      if (overlapsAny(x, z, worldHalfX, worldHalfZ, otherProps)) continue;

      const mesh = obj.object3D.clone();
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.atan2(wg.nx, wg.nz);
      group.add(mesh);
      const px = CONFIG.playerRadius;
      colliders.push({ minX: x - worldHalfX - px, maxX: x + worldHalfX + px, minZ: z - worldHalfZ - px, maxZ: z + worldHalfZ + px });
      return;
    }
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

  // Party seating around the table (school-chair model).
  const chairCount = 2 + Math.floor(rng() * 3); // 2-4 chairs
  for (let i = 0; i < chairCount; i++) {
    addChair(group, colliders, rng, room, tx, tz, Math.max(tableW, tableD) / 2 + 0.5);
  }
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

// Claim a spot for a cosmetic wall-mounted prop (picture frame, SVG sign) on
// a random solid wall, rejecting spots that overlap one already claimed —
// `placed` is a per-room ledger shared across every call so, e.g., the
// picture frame and a sign can't land on/through each other even though
// they're placed by separate, independently-rolled functions. Tries several
// sides (shuffled) and a few positions per side before giving up; returns
// null (skip placing this prop) rather than accept an overlapping spot.
function claimWallSpot(rng, room, placed, halfWidth) {
  const sides = ["n", "s", "e", "w"].filter((s) => s !== room.openSide);
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  for (const side of sides) {
    const length = wallGeometry(room, side).length;
    const maxAlong = length / 2 - halfWidth - 0.2;
    if (maxAlong <= 0) continue;
    for (let attempt = 0; attempt < 8; attempt++) {
      const along = (rng() * 2 - 1) * maxAlong;
      const overlaps = placed.some((p) => p.side === side && Math.abs(p.along - along) < p.halfWidth + halfWidth + 0.3);
      if (overlaps) continue;
      placed.push({ side, along, halfWidth });
      return { side, along };
    }
  }
  return null;
}

// Mount a wall-decor MODEL flush against a wall's inner face. The registered
// template must be `wallMount: true` (see objects.js) — already Y-centred
// rather than floor-resting, and authored with its thin/depth axis along local
// Z, so rotating around Y aligns that axis with the wall's outward normal (same
// as the SVG signs' facing math). Does nothing (returns false) if the model
// hasn't loaded — asset-only, so there's no procedural fallback.
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

function addWallDecor(group, rng, room, placed) {
  if (rng() >= 0.45) return; // just under half of rooms get one
  const obj = getObject("picture-frame");
  const halfWidth = obj ? obj.halfX : 0.4;
  const spot = claimWallSpot(rng, room, placed, halfWidth);
  if (!spot) return;
  // Asset-only: the wall-mounted picture-frame model — no procedural decor.
  mountModel(group, room, spot.side, "picture-frame", spot.along, 1.5 + rng() * 0.5);
}

// Build one room's geometry + colliders. `materials.wall` is reused for the
// walls so a special room still looks built from the same place, not a
// separate biome.
// Mount a flat SVG 2D prop (sign/arrow/warning) flush on a random solid wall,
// facing into the room. Purely decorative — no collider, like the other wall
// decor. Skips silently if the SVG cache isn't ready (never breaks generation).
function addWallSign(group, rng, room, placed) {
  if (rng() >= 0.5) return; // about half of rooms get a sign
  const tpl = randomSvgProp(rng);
  if (!tpl) return;
  const halfWidth = Math.max(tpl.halfW, 0.4);
  const spot = claimWallSpot(rng, room, placed, halfWidth);
  if (!spot) return;
  const wg = wallGeometry(room, spot.side);
  const y = 1.5 + rng() * 0.8;
  const off = CONFIG.wallThickness / 2 + 0.03;
  const sign = tpl.object3D.clone(); // shared geometry/material — never mark disposable
  sign.position.set(wg.cx + wg.tx * spot.along + wg.nx * off, y, wg.cz + wg.tz * spot.along + wg.nz * off);
  sign.rotation.y = Math.atan2(wg.nx, wg.nz); // face the wall's inward normal
  group.add(sign);
}

// Occasionally drop one larger left-behind furniture piece (sofa / boombox /
// ammo crate) as a floor prop. Placed by exact id (not the random research
// pool) so these read as a deliberate trace; skips if the model isn't cached
// or the room's too crowded.
function addExtraFurniture(group, colliders, rng, room) {
  if (rng() >= 0.35) return;
  const pool = ["sofa", "boombox", "ammo-box", "television", "fire-extinguisher", "trash-can", "potted-plant"];
  const id = pool[Math.floor(rng() * pool.length)];
  const obj = getObject(id);
  if (!obj) return;
  const spot = randomSpot(rng, room, Math.max(obj.halfX, obj.halfZ) + 0.3, colliders);
  if (!spot) return;
  const { x, z } = spot;
  const mesh = obj.object3D.clone(); // shared geometry/material — never mark disposable
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rng() * Math.PI * 2;
  group.add(mesh);
  const px = CONFIG.playerRadius;
  colliders.push({ minX: x - obj.halfX - px, maxX: x + obj.halfX + px, minZ: z - obj.halfZ - px, maxZ: z + obj.halfZ + px });
}

// An overlaid floor + ceiling plane across the room footprint, using a skin's
// materials. Sits just above/below the chunk's own base surfaces so a skinned
// room's ground and ceiling change too, not only its walls. Per-room geometry
// (disposable); the skin materials are shared and never disposed.
function addSkinnedSurfaces(group, room, skin) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), skin.floor);
  floor.geometry.userData.disposable = true;
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.x, 0.02, room.z);
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), skin.ceiling);
  ceil.geometry.userData.disposable = true;
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(room.x, CONFIG.wallHeight - 0.02, room.z);
  group.add(ceil);
}

export function buildRoomGroup(room, materials) {
  const group = new THREE.Group();
  const colliders = [];

  // Some rooms are "leaked" — re-skinned with an alternate wall/floor/ceiling
  // texture set (see textures.js). Independent RNG stream so this never shifts
  // the prop layout. Falls back to the base look if no skin loaded.
  const skinRng = rngForRegion(SALT_SKIN, room.rx, room.ry);
  const skin = skinRng() < 0.4 ? randomSkin(skinRng) : null;

  buildWalls(group, colliders, skin ? skin.wall : materials.wall, room);
  if (skin) addSkinnedSurfaces(group, room, skin);
  const wallCount = colliders.length; // floor props (below) are whatever's added past this point

  const propRng = rngForRegion(SALT_PROPS, room.rx, room.ry);
  if (room.theme === "festival") addFestivalTheme(group, colliders, propRng, room);
  else if (room.theme === "toys") addToysTheme(group, colliders, propRng, room);
  else if (room.theme === "camp") addCampTheme(group, colliders, propRng, room);
  else if (room.theme === "party") addPartyTheme(group, colliders, propRng, room);
  else addStorageTheme(group, colliders, propRng, room, wallCount);

  addExtraFurniture(group, colliders, propRng, room);

  // Top up sparse rolls with extra research clutter so every room reads as
  // lived-in rather than just whatever bare minimum its theme happened to
  // roll — a real floor, not a per-theme guess, since themes vary widely in
  // how many props they place on their own.
  let guard = 0;
  while (colliders.length - wallCount < RS.minProps && guard < RS.minProps * 4) {
    guard++;
    addResearchProp(group, colliders, propRng, room);
  }

  const wallProps = []; // shared ledger so the picture frame and a sign can't claim overlapping wall spans
  addWallDecor(group, propRng, room, wallProps);
  addWallSign(group, propRng, room, wallProps);

  return { group, colliders };
}
