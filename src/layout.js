// The layout pass — what the maze actually IS, decided per zone.
//
// The old generator rolled a coin per cell edge ("is there a wall here?"). That
// can't make a maze: walls landed wherever the dice said, so you got open space
// speckled with wall fragments, never a hallway you could follow or a room you
// could close a door on. Worse, it had no notion of connectivity — nothing
// stopped it sealing a region off, so a minimum-density "top-up" pass had to
// scatter extra walls in afterwards just to stop chunks reading as empty.
//
// This replaces that with a real layout, computed once per ZONE and cached.
// The trick that makes it work on an infinite, chunk-streamed world (where you
// can never run a global maze algorithm, because there's no global) is:
//
//   EVERY ZONE IS RINGED BY A CORRIDOR.
//
// The outermost ring of cells in every zone is always open floor, and edges that
// lie exactly ON a zone boundary never carry a wall. So each zone's ring opens
// straight into its neighbours' rings — two adjacent rings form one wide hallway
// running along the seam. Connectivity between zones is therefore guaranteed
// structurally, for free, forever, no matter what any zone does inside itself.
// That buys total freedom in the interior: each zone can lay out its 11x11
// interior however it likes and can never strand the player, because the ring is
// always there to walk back out to.
//
// Interiors, by profile (see CONFIG.zones.profiles):
//   offices  a 3x3 grid of rooms separated by hallway lanes; each room walled,
//            with a doorway (and sometimes a blind door that opens onto nothing)
//   maze     a recursive-backtracker corridor maze over the interior cells
//   halls    the classic Backrooms: open space, sparse walls, pillars — kept as
//            a minority so the world still breathes between the built-up zones
//   encounter fully open; the spawn zone
//
// Everything here is a pure function of (seed, zone coords), so it's identical
// on every rebuild and across every chunk that touches it.

import { CONFIG } from "./config.js";
import { mulberry32, hashCell } from "./rng.js";

const ZC = CONFIG.zones.cells; // zone size in cells
const IN0 = 1; // first interior cell (local)
const IN1 = ZC - 2; // last interior cell (local)

const SALT = {
  zone: 0x5001,
  layout: 0x7001,
  hallS: 0x1001,
  hallW: 0x2001,
  pillar: 0x0001,
  growS: 0x4001,
  growW: 0x4002,
};
function rngFor(salt, a, b) {
  return mulberry32(hashCell(CONFIG.seed ^ salt, a, b));
}

// ── Zone profiles ──────────────────────────────────────────────────────────

const PROFILES = CONFIG.zones.profiles;
const BY_NAME = Object.fromEntries(PROFILES.map((p) => [p.name, p]));
const RANDOM_PROFILES = PROFILES.filter((p) => !p.spawnOnly);
const TOTAL_WEIGHT = RANDOM_PROFILES.reduce((s, p) => s + (p.weight ?? 1), 0);
const SPAWN_PROFILE = BY_NAME[CONFIG.zones.spawnProfile] ?? PROFILES[0];

export function zoneOf(gx, gy) {
  return { zx: Math.floor(gx / ZC), zy: Math.floor(gy / ZC) };
}

const _profileCache = new Map();
export function profileFor(zx, zy) {
  if (zx === 0 && zy === 0) return SPAWN_PROFILE; // the fresh corner you wake up in
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

// ── Edge keys ──────────────────────────────────────────────────────────────
// A "south" edge S(gx,gy) is the cell boundary between (gx, gy-1) and (gx, gy).
// A "west"  edge W(gx,gy) is the boundary between (gx-1, gy) and (gx, gy).
// Both are named for the cell on their positive side, which is the convention
// world.js builds against.

const sKey = (gx, gy) => "S," + gx + "," + gy;
const wKey = (gx, gy) => "W," + gx + "," + gy;

// ── Per-zone layout ────────────────────────────────────────────────────────

const _layoutCache = new Map();

export function clearLayoutCache() {
  _profileCache.clear();
  _layoutCache.clear();
}

// walls  Set of edge keys carrying a solid wall
// doors  Map edge key -> { swing } for edges that are a walk-through doorway
//        (these are NOT in `walls` — world.js builds the jambs itself)
// blind  Map edge key -> { face } for a wall carrying a closed door that opens
//        onto nothing. Pure set-dressing; the wall is still in `walls`.
// pillars Set of "gx,gy"
export function layoutForZone(zx, zy) {
  const key = zx + "," + zy;
  let L = _layoutCache.get(key);
  if (L) return L;

  const profile = profileFor(zx, zy);
  const rng = rngFor(SALT.layout, zx, zy);
  L = { walls: new Set(), doors: new Map(), blind: new Map(), pillars: new Set(), profile };

  const base = { cx: zx * ZC, cy: zy * ZC };
  const g = (lx, ly) => ({ gx: base.cx + lx, gy: base.cy + ly });

  if (profile.offices) buildOffices(L, g, rng);
  else if (profile.maze) buildMaze(L, g, rng);
  else if (!profile.encounter) buildHalls(L, g, rng, profile, zx, zy);
  // encounter zones stay entirely open — no walls, no pillars.

  _layoutCache.set(key, L);
  return L;
}

// The wall separating the corridor ring from the interior. Every profile that
// builds an interior starts from this and punches its own openings through it.
function ringWall(L, g) {
  for (let l = IN0; l <= IN1; l++) {
    L.walls.add(sKey(g(l, IN0).gx, g(l, IN0).gy)); // south side of the interior
    L.walls.add(sKey(g(l, IN1 + 1).gx, g(l, IN1 + 1).gy)); // north side
    L.walls.add(wKey(g(IN0, l).gx, g(IN0, l).gy)); // west side
    L.walls.add(wKey(g(IN1 + 1, l).gx, g(IN1 + 1, l).gy)); // east side
  }
}

// ── offices: rooms off hallway lanes ───────────────────────────────────────
//
// Shrunk to a 2x2 grid of 3-cell room blocks separated by one 1-cell hallway
// lane: [1 2 3] 4 [5 6 7], out of the 11-cell-wide interior — smaller than the
// original 3x3/nine-room layout. The unused cells (8-11) are left as plain
// open floor inside the same ring, not a sealed-off area, so it just reads as
// a smaller office block with some open space around it.
const BLOCKS = [
  [1, 3],
  [5, 7],
];
const LANES = [4];

function buildOffices(L, g, rng) {
  ringWall(L, g);

  // Open the lanes where they meet the ring wall, so they're hallways and not
  // sealed slots. Four lanes, both ends each — eight ways into the block.
  for (const lane of LANES) {
    L.walls.delete(sKey(g(lane, IN0).gx, g(lane, IN0).gy));
    L.walls.delete(sKey(g(lane, IN1 + 1).gx, g(lane, IN1 + 1).gy));
    L.walls.delete(wKey(g(IN0, lane).gx, g(IN0, lane).gy));
    L.walls.delete(wKey(g(IN1 + 1, lane).gx, g(IN1 + 1, lane).gy));
  }

  for (const [x0, x1] of BLOCKS) {
    for (const [y0, y1] of BLOCKS) {
      // Some blocks are left un-walled — the lanes then open into a larger bare
      // space. Without this every zone reads as the same nine-room grid.
      if (rng() < 0.22) continue;
      walledRoom(L, g, rng, x0, x1, y0, y1);
    }
  }
}

// Wall a rectangular block of cells in, then cut a doorway (or two) through it.
function walledRoom(L, g, rng, x0, x1, y0, y1) {
  const sides = []; // every boundary edge, grouped by side, as door candidates
  const south = [];
  const north = [];
  const west = [];
  const east = [];
  for (let lx = x0; lx <= x1; lx++) {
    const s = sKey(g(lx, y0).gx, g(lx, y0).gy);
    const n = sKey(g(lx, y1 + 1).gx, g(lx, y1 + 1).gy);
    L.walls.add(s);
    L.walls.add(n);
    south.push(s);
    north.push(n);
  }
  for (let ly = y0; ly <= y1; ly++) {
    const w = wKey(g(x0, ly).gx, g(x0, ly).gy);
    const e = wKey(g(x1 + 1, ly).gx, g(x1 + 1, ly).gy);
    L.walls.add(w);
    L.walls.add(e);
    west.push(w);
    east.push(e);
  }
  sides.push(south, north, west, east);

  // At least one real doorway, occasionally a second on a different side — so a
  // room can be walked through rather than only into.
  const doorCount = rng() < 0.3 ? 2 : 1;
  const picked = [];
  for (let i = 0; i < doorCount; i++) {
    const side = sides[Math.floor(rng() * sides.length)];
    const edge = side[Math.floor(rng() * side.length)];
    if (picked.includes(edge)) continue;
    picked.push(edge);
    L.walls.delete(edge);
    // Which way the leaf swings open. Doors always park at a right angle to
    // their frame (see world.js) — that keeps the leaf axis-aligned, which is
    // the only thing this game's AABB colliders can actually represent.
    L.doors.set(edge, { swing: rng() < 0.5 ? 1 : -1, open: rng() > 0.18 });
  }

  // Blind doors: a closed door standing in a solid wall, opening onto nothing.
  // Costs nothing (the wall already collides) and is the most Backrooms detail
  // in the building — a door you can see and cannot use.
  const blindCount = rng() < 0.45 ? 1 : 0;
  for (let i = 0; i < blindCount; i++) {
    const side = sides[Math.floor(rng() * sides.length)];
    const edge = side[Math.floor(rng() * side.length)];
    if (picked.includes(edge) || L.blind.has(edge)) continue;
    L.blind.set(edge, { face: rng() < 0.5 ? 1 : -1 });
  }
}

// ── maze: a real corridor maze ─────────────────────────────────────────────
//
// Recursive backtracker over the interior cells. Bounded to one zone, so it
// terminates and stays deterministic — and the ring outside it means even a
// maze that carved itself into a horrible knot is still escapable.
function buildMaze(L, g, rng) {
  ringWall(L, g);

  const N = IN1 - IN0 + 1; // interior is N x N cells
  const idx = (x, y) => y * N + x;
  const visited = new Array(N * N).fill(false);
  // Start every interior edge walled, then knock walls down as we carve.
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const c = g(IN0 + x, IN0 + y);
      if (x > 0) L.walls.add(wKey(c.gx, c.gy));
      if (y > 0) L.walls.add(sKey(c.gx, c.gy));
    }
  }

  const stack = [{ x: Math.floor(rng() * N), y: Math.floor(rng() * N) }];
  visited[idx(stack[0].x, stack[0].y)] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const nbrs = [];
    if (cur.x > 0 && !visited[idx(cur.x - 1, cur.y)]) nbrs.push({ x: cur.x - 1, y: cur.y, dir: "w" });
    if (cur.x < N - 1 && !visited[idx(cur.x + 1, cur.y)]) nbrs.push({ x: cur.x + 1, y: cur.y, dir: "e" });
    if (cur.y > 0 && !visited[idx(cur.x, cur.y - 1)]) nbrs.push({ x: cur.x, y: cur.y - 1, dir: "s" });
    if (cur.y < N - 1 && !visited[idx(cur.x, cur.y + 1)]) nbrs.push({ x: cur.x, y: cur.y + 1, dir: "n" });
    if (!nbrs.length) {
      stack.pop();
      continue;
    }
    const nx = nbrs[Math.floor(rng() * nbrs.length)];
    const c = g(IN0 + cur.x, IN0 + cur.y);
    const t = g(IN0 + nx.x, IN0 + nx.y);
    if (nx.dir === "w") L.walls.delete(wKey(c.gx, c.gy));
    else if (nx.dir === "e") L.walls.delete(wKey(t.gx, t.gy));
    else if (nx.dir === "s") L.walls.delete(sKey(c.gx, c.gy));
    else L.walls.delete(sKey(t.gx, t.gy));
    visited[idx(nx.x, nx.y)] = true;
    stack.push({ x: nx.x, y: nx.y });
  }

  // Braid it a little: knock out a few extra walls so it isn't a perfect tree.
  // A perfect maze is all dead ends, which is tedious to walk; a braided one
  // has loops, which is what actually feels like a building you're lost in.
  const braid = Math.floor(N * 1.2);
  for (let i = 0; i < braid; i++) {
    const x = 1 + Math.floor(rng() * (N - 1));
    const y = 1 + Math.floor(rng() * (N - 1));
    const c = g(IN0 + x, IN0 + y);
    L.walls.delete(rng() < 0.5 ? wKey(c.gx, c.gy) : sKey(c.gx, c.gy));
  }

  // Cut a few ways in from the ring, or the maze would be a sealed box.
  const entrances = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < entrances; i++) {
    const l = IN0 + Math.floor(rng() * N);
    const side = Math.floor(rng() * 4);
    if (side === 0) L.walls.delete(sKey(g(l, IN0).gx, g(l, IN0).gy));
    else if (side === 1) L.walls.delete(sKey(g(l, IN1 + 1).gx, g(l, IN1 + 1).gy));
    else if (side === 2) L.walls.delete(wKey(g(IN0, l).gx, g(IN0, l).gy));
    else L.walls.delete(wKey(g(IN1 + 1, l).gx, g(IN1 + 1, l).gy));
  }
}

// ── halls: the classic open Backrooms ──────────────────────────────────────
//
// The original probabilistic generator, kept deliberately. Not every zone should
// be a floor plan — the mythos is *rooms*, and the contrast between a built-up
// office block and a vast pillared hall is what makes either one land. No ring
// wall: the hall opens straight onto the perimeter corridor.
function buildHalls(L, g, rng, profile, zx, zy) {
  const wc = profile.wallChance ?? 0;
  const cont = profile.wallContinuation ?? 1;
  const pc = profile.pillarChance ?? 0;

  const edgeWall = (salt, gx, gy, px, py) => {
    if (wc <= 0) return false;
    const b = rngFor(salt, gx, gy)();
    if (b < wc) return true;
    return rngFor(salt, px, py)() < wc && b < wc * cont;
  };

  for (let ly = IN0; ly <= IN1; ly++) {
    for (let lx = IN0; lx <= IN1; lx++) {
      const { gx, gy } = g(lx, ly);
      if (lx > IN0 && edgeWall(SALT.hallW, gx, gy, gx, gy - 1)) L.walls.add(wKey(gx, gy));
      if (ly > IN0 && edgeWall(SALT.hallS, gx, gy, gx - 1, gy)) L.walls.add(sKey(gx, gy));
      if (pc > 0 && rngFor(SALT.pillar, gx, gy)() < pc) L.pillars.add(gx + "," + gy);
    }
  }

  growSingularWalls(L, g);
}

// Some standalone single-cell wall segments ("singular" — nothing walled on
// either side of them along their own run) stretch out into a full wall,
// 25% chance each, so halls zones read a little less sparse/empty. Grows in
// one random direction, one cell at a time, stopping as soon as it either
// reaches the interior boundary or touches an existing colinear wall
// (merging into it rather than overlapping) — so it always terminates and
// never overlaps itself, though a long enough run can occasionally wall off
// a pocket the way real partition walls would. Uses a fixed snapshot of the
// original singles so growing one doesn't change whether another still
// counts as singular.
const GROW_CHANCE = 0.25;
function growSingularWalls(L, g) {
  const southSingles = [];
  const westSingles = [];
  for (let ly = IN0; ly <= IN1; ly++) {
    for (let lx = IN0; lx <= IN1; lx++) {
      const { gx, gy } = g(lx, ly);
      if (L.walls.has(sKey(gx, gy))) {
        const left = g(lx - 1, ly);
        const right = g(lx + 1, ly);
        const leftWalled = lx > IN0 && L.walls.has(sKey(left.gx, left.gy));
        const rightWalled = lx < IN1 && L.walls.has(sKey(right.gx, right.gy));
        if (!leftWalled && !rightWalled) southSingles.push({ lx, ly, gx, gy });
      }
      if (L.walls.has(wKey(gx, gy))) {
        const below = g(lx, ly - 1);
        const above = g(lx, ly + 1);
        const belowWalled = ly > IN0 && L.walls.has(wKey(below.gx, below.gy));
        const aboveWalled = ly < IN1 && L.walls.has(wKey(above.gx, above.gy));
        if (!belowWalled && !aboveWalled) westSingles.push({ lx, ly, gx, gy });
      }
    }
  }

  for (const s of southSingles) {
    if (rngFor(SALT.growS, s.gx, s.gy)() >= GROW_CHANCE) continue;
    const dir = rngFor(SALT.growS, s.gx - 1, s.gy)() < 0.5 ? 1 : -1;
    for (let nlx = s.lx + dir; nlx >= IN0 && nlx <= IN1; nlx += dir) {
      const c = g(nlx, s.ly);
      if (L.walls.has(sKey(c.gx, c.gy))) break; // touched another wall — stop
      L.walls.add(sKey(c.gx, c.gy));
    }
  }
  for (const s of westSingles) {
    if (rngFor(SALT.growW, s.gx, s.gy)() >= GROW_CHANCE) continue;
    const dir = rngFor(SALT.growW, s.gx, s.gy - 1)() < 0.5 ? 1 : -1;
    for (let nly = s.ly + dir; nly >= IN0 && nly <= IN1; nly += dir) {
      const c = g(s.lx, nly);
      if (L.walls.has(wKey(c.gx, c.gy))) break; // touched another wall — stop
      L.walls.add(wKey(c.gx, c.gy));
    }
  }
}

// ── Queries (what world.js actually calls) ─────────────────────────────────
//
// An edge lying exactly on a zone boundary is NEVER walled — that's the rule the
// whole connectivity guarantee rests on (see the header). Everything else is
// owned by the zone of the cell the edge is named for.

function edgeOwner(gx, gy, local) {
  if (local === 0) return null; // on the zone seam — always open
  return zoneOf(gx, gy);
}

export function wallSouth(gx, gy) {
  const ly = ((gy % ZC) + ZC) % ZC;
  const z = edgeOwner(gx, gy, ly);
  if (!z) return false;
  return layoutForZone(z.zx, z.zy).walls.has(sKey(gx, gy));
}

export function wallWest(gx, gy) {
  const lx = ((gx % ZC) + ZC) % ZC;
  const z = edgeOwner(gx, gy, lx);
  if (!z) return false;
  return layoutForZone(z.zx, z.zy).walls.has(wKey(gx, gy));
}

export function doorSouth(gx, gy) {
  const ly = ((gy % ZC) + ZC) % ZC;
  const z = edgeOwner(gx, gy, ly);
  if (!z) return null;
  return layoutForZone(z.zx, z.zy).doors.get(sKey(gx, gy)) ?? null;
}

export function doorWest(gx, gy) {
  const lx = ((gx % ZC) + ZC) % ZC;
  const z = edgeOwner(gx, gy, lx);
  if (!z) return null;
  return layoutForZone(z.zx, z.zy).doors.get(wKey(gx, gy)) ?? null;
}

export function blindSouth(gx, gy) {
  const ly = ((gy % ZC) + ZC) % ZC;
  const z = edgeOwner(gx, gy, ly);
  if (!z) return null;
  return layoutForZone(z.zx, z.zy).blind.get(sKey(gx, gy)) ?? null;
}

export function blindWest(gx, gy) {
  const lx = ((gx % ZC) + ZC) % ZC;
  const z = edgeOwner(gx, gy, lx);
  if (!z) return null;
  return layoutForZone(z.zx, z.zy).blind.get(wKey(gx, gy)) ?? null;
}

export function pillarAt(gx, gy) {
  const { zx, zy } = zoneOf(gx, gy);
  return layoutForZone(zx, zy).pillars.has(gx + "," + gy);
}

// True when this cell is the centre of an encounter zone (the spawn marker).
export function isEncounterCentre(gx, gy) {
  const { zx, zy } = zoneOf(gx, gy);
  if (!profileFor(zx, zy).encounter) return false;
  return gx === zx * ZC + (ZC >> 1) && gy === zy * ZC + (ZC >> 1);
}
