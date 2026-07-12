// Procedural materials for the base Backrooms. Textures are drawn to canvases
// at runtime so the game ships no external image assets and works offline.
//
// The look we are matching is Kane Pixels' "The Backrooms (Found Footage)"
// Level 0: *grounded and photographic*, not saturated cartoon yellow. Three
// rules drive everything below:
//
//   1. Low saturation. The dread comes from the LIGHT, not the hue. The walls
//      are a muted, slightly greenish ochre — damp aged wallpaper, not
//      highlighter yellow.
//   2. The ceiling is LIGHTER than the walls. It is an off-white suspended
//      acoustic-tile ceiling on a metal T-bar grid. This single detail is what
//      makes a corridor read as "1990s office building" instead of "yellow
//      cube", and it is the thing most Backrooms clones get wrong.
//   3. Everything is dirty and uneven. Seams, water stains, mildew, scuffs.
//      Nothing is a flat fill.
//
// Everything here is intentionally simple and swappable — the leak system
// (later feature) will mutate these per-section.

import * as THREE from "three";
import { CONFIG } from "./config.js";

function makeCanvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return { c, ctx: c.getContext("2d") };
}

// Non-square canvas (used by the door leaf and the arrow).
function makeCanvasWH(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
}

// CONFIG.colors stores ints (0xrrggbb); canvas wants "#rrggbb".
function hex(n) {
  return "#" + n.toString(16).padStart(6, "0");
}

// Sprinkle per-pixel noise over the whole canvas. `amt` is the peak +/- swing
// applied to R and G; B gets `blueBias` of it, so a positive bias keeps the
// grain neutral and a negative one makes it lean warm/yellow.
function addGrain(ctx, size, amt, blueBias = 1.0) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * blueBias;
  }
  ctx.putImageData(img, 0, 0);
}

// ── UV scale contract ───────────────────────────────────────────────────────
// Each texture is authored to cover a fixed real-world size, so world.js can
// compute `.repeat` from a surface's dimensions in metres. See TEXTURE_SCALE
// and the comment at the top of createMaterials().

/**
 * How many METRES one full tile of each texture covers.
 * world.js should set `map.repeat.set(widthMetres / scale, heightMetres / scale)`
 * (or the anisotropic variant noted per-entry).
 */
export const TEXTURE_SCALE = {
  // Horizontal only. Authored as ONE full wall-height slice: the bottom of the
  // canvas is the floor line (water bleeding UP from the carpet) and the top is
  // the ceiling line (staining bleeding DOWN). So it must NOT tile vertically.
  //   repeat.x = wallLengthMetres / 2.1
  //   repeat.y = 1                       (always — one slice per wall height)
  wall: 2.1,
  wallHeight: CONFIG.wallHeight, // the height that one vertical unit represents
  // Square, tiles freely in both axes.
  carpet: 2.1,
  // Square. One tile of this texture = a 2x2 block of 0.6 m acoustic tiles,
  // i.e. 1.2 m of real ceiling per unit, so the T-bar grid lands on a
  // believable 600 mm module.
  ceiling: 1.2,
  // Square. The brick courses in the Stage 2 concrete texture.
  concrete: 2.0,
  // The door texture is authored for a single leaf; repeat should stay 1,1.
  door: null,
};

// ── Wallpaper ───────────────────────────────────────────────────────────────
// Damp, aged commercial wallpaper in a muted ochre/mustard-tan — desaturated,
// leaning slightly greenish-grey. Built up in layers, dirtiest last:
//   base fill → vertical stripe weave → strip seams every ~0.52 m →
//   mildew mottling → water bleed from the floor line → staining along the
//   ceiling line → fine grain.
// Authored as one full wall-height slice (canvas bottom = floor).
function wallpaperTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S);
  ctx.fillStyle = hex(CONFIG.colors.wallpaper);
  ctx.fillRect(0, 0, S, S);

  // Subtle vertical stripe pattern — a shallow tone-on-tone weave, barely
  // there. Real hotel/office wallpaper, not a candy stripe.
  for (let x = 0; x < S; x += 12) {
    ctx.fillStyle = "rgba(0,0,0,0.028)";
    ctx.fillRect(x, 0, 5, S);
    ctx.fillStyle = "rgba(255,255,255,0.018)";
    ctx.fillRect(x + 6, 0, 2, S);
  }

  // Strip seams. The tile spans 2.1 m and rolls are ~0.52 m wide, so seams land
  // at every quarter of the canvas — including x=0/512, which wrap into one
  // continuous seam when the texture repeats.
  const seamXs = [0, S * 0.25, S * 0.5, S * 0.75, S];
  for (const sx of seamXs) {
    // Slight lift on one side of the joint, a dark hairline in the crack, and
    // a soft dirt gradient where grime collects along the edge.
    const g = ctx.createLinearGradient(sx - 6, 0, sx + 6, 0);
    g.addColorStop(0, "rgba(255,255,255,0.00)");
    g.addColorStop(0.42, "rgba(255,255,255,0.05)");
    g.addColorStop(0.5, "rgba(40,36,22,0.16)");
    g.addColorStop(0.58, "rgba(0,0,0,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - 6, 0, 12, S);
    ctx.fillStyle = "rgba(30,28,18,0.22)";
    ctx.fillRect(sx - 0.5, 0, 1, S);
  }

  // Faint mildew mottling — cool, greenish-grey clouds. Kept very low alpha;
  // it should desaturate the ochre in patches rather than read as green paint.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 10 + Math.random() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(96,102,80,${0.05 + Math.random() * 0.06})`);
    g.addColorStop(1, "rgba(96,102,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Water bleed rising from the floor line (canvas BOTTOM). Uneven tide marks:
  // a soft wash, then a slightly darker, harder edge where the water stopped.
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * S;
    const w = 30 + Math.random() * 120;
    const h = 30 + Math.random() * 110;
    const g = ctx.createLinearGradient(0, S, 0, S - h);
    g.addColorStop(0, "rgba(58,48,26,0.34)");
    g.addColorStop(0.55, "rgba(72,62,36,0.14)");
    g.addColorStop(1, "rgba(72,62,36,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, S, w, h, 0, Math.PI, 0);
    ctx.fill();
    // Tide mark.
    ctx.strokeStyle = "rgba(52,44,24,0.13)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, S, w * 0.82, h * 0.82, 0, Math.PI, 0);
    ctx.stroke();
  }

  // Staining bleeding DOWN from the ceiling line (canvas TOP) — the classic
  // leaking-roof-deck runs. Fewer, narrower, more vertical than the floor ones.
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * S;
    const w = 12 + Math.random() * 60;
    const h = 40 + Math.random() * 150;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(64,54,30,0.30)");
    g.addColorStop(0.4, "rgba(78,68,40,0.13)");
    g.addColorStop(1, "rgba(78,68,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, 0, w, h, 0, 0, Math.PI);
    ctx.fill();
    // A thin run trailing out of the bottom of the stain.
    if (Math.random() < 0.6) {
      const g2 = ctx.createLinearGradient(0, h * 0.5, 0, h * 1.5);
      g2.addColorStop(0, "rgba(60,50,28,0.16)");
      g2.addColorStop(1, "rgba(60,50,28,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(x - 3 - Math.random() * 4, h * 0.5, 4 + Math.random() * 7, h);
    }
  }

  // General grime — scattered darkening so no two square metres look alike.
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 8 + Math.random() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(46,40,20,${0.02 + Math.random() * 0.05})`);
    g.addColorStop(1, "rgba(46,40,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Paper tooth. Slightly warm grain (blue swings less than red/green).
  addGrain(ctx, S, 14, 0.65);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ── Carpet ──────────────────────────────────────────────────────────────────
// Damp, dirty mustard-brown short commercial loop pile. Darker and a little
// more saturated than the walls, which is what makes the walls read as "lit"
// and the floor as "the ground". Mottled and blotchy, with darker moisture
// patches, over a fine directional fibre noise.
function carpetTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S);
  ctx.fillStyle = hex(CONFIG.colors.carpet);
  ctx.fillRect(0, 0, S, S);

  // Broad blotches — worn/soiled areas and damp patches. Two passes: light
  // (traffic-worn, bleached) then dark (moisture).
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,132,80,${0.03 + Math.random() * 0.05})`);
    g.addColorStop(1, "rgba(150,132,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 14 + Math.random() * 80;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(26,20,8,${0.05 + Math.random() * 0.12})`);
    g.addColorStop(1, "rgba(26,20,8,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Loop pile: thousands of tiny 1-2px arcs. Individually invisible, together
  // they give the surface a woven "tooth" instead of smooth mush.
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const dark = Math.random() < 0.5;
    ctx.fillStyle = dark
      ? `rgba(20,16,6,${0.10 + Math.random() * 0.16})`
      : `rgba(168,150,92,${0.06 + Math.random() * 0.12})`;
    ctx.fillRect(x, y, 1 + (Math.random() < 0.25 ? 1 : 0), 1);
  }

  // Fine grain to break up any remaining banding in the gradients.
  addGrain(ctx, S, 22, 0.55);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ── Ceiling ─────────────────────────────────────────────────────────────────
// THE detail that sells Kane Pixels: a suspended mineral-fibre acoustic tile
// ceiling on an exposed metal T-bar grid. Off-white / pale grey and clearly
// LIGHTER than the walls.
//
// One canvas = a 2x2 block of 600 mm tiles (1.2 m of real ceiling), so the grid
// module is right. Grid lines are drawn centred on the canvas edges and the
// midlines, so half a T-bar on each edge joins up with its neighbour when the
// texture repeats — no double-thick seams.
function ceilingTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S);
  const base = CONFIG.colors.ceiling;

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, S, S);

  const half = S / 2;
  // The four tiles, each drawn independently so they can differ in tone.
  const tiles = [
    { x: 0, y: 0 },
    { x: half, y: 0 },
    { x: 0, y: half },
    { x: half, y: half },
  ];

  for (const t of tiles) {
    // Per-tile brightness: real ceilings are a patchwork — replacements are
    // brighter, old ones have yellowed. A few are noticeably darker.
    const dark = Math.random() < 0.35;
    const shade = dark ? -12 - Math.random() * 20 : -4 + Math.random() * 8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x, t.y, half, half);
    ctx.clip();

    ctx.fillStyle =
      shade < 0
        ? `rgba(20,20,18,${Math.min(0.16, -shade / 130)})`
        : `rgba(255,255,255,${shade / 90})`;
    ctx.fillRect(t.x, t.y, half, half);

    // Pinholes + fissures — the characteristic mineral-fibre face. Pinholes are
    // dense, tiny, random; fissures are short irregular scratches.
    for (let i = 0; i < 2600; i++) {
      const px = t.x + Math.random() * half;
      const py = t.y + Math.random() * half;
      ctx.fillStyle = `rgba(90,88,80,${0.10 + Math.random() * 0.28})`;
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.strokeStyle = "rgba(96,94,86,0.20)";
    for (let i = 0; i < 120; i++) {
      const px = t.x + Math.random() * half;
      const py = t.y + Math.random() * half;
      const len = 4 + Math.random() * 16;
      const ang = Math.random() * Math.PI * 2;
      ctx.lineWidth = 0.7 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Water staining: a warm brown ring bleeding out of a corner or an edge on
    // roughly a third of tiles. Concentric, darkest at the rim, like a real
    // ceiling leak that dried in stages.
    if (Math.random() < 0.32) {
      const cx = t.x + (Math.random() < 0.5 ? 0 : half) + (Math.random() - 0.5) * 40;
      const cy = t.y + (Math.random() < 0.5 ? 0 : half) + (Math.random() - 0.5) * 40;
      const r = 40 + Math.random() * 110;
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, "rgba(126,102,58,0.30)");
      g.addColorStop(0.6, "rgba(140,116,70,0.16)");
      g.addColorStop(0.88, "rgba(112,90,50,0.22)");
      g.addColorStop(1, "rgba(112,90,50,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Sag/soiling in the corners of the tile where dust settles against the bar.
    const gg = ctx.createLinearGradient(t.x, t.y, t.x + half, t.y + half);
    gg.addColorStop(0, "rgba(0,0,0,0.05)");
    gg.addColorStop(0.5, "rgba(0,0,0,0)");
    gg.addColorStop(1, "rgba(0,0,0,0.05)");
    ctx.fillStyle = gg;
    ctx.fillRect(t.x, t.y, half, half);

    ctx.restore();
  }

  // The T-bar grid. Each bar is: a dark shadow gap either side (the reveal
  // between tile and bar), then the flat painted metal face, with a thin bright
  // specular line down its centre.
  const barW = 9; // ~2 cm of real bar at 1.2 m per 512 px
  function bar(x, y, w, h) {
    // Shadow reveal under the tile edges.
    ctx.fillStyle = "rgba(28,28,26,0.42)";
    ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    // Painted metal face — a touch lighter than the tiles, slightly cooler.
    ctx.fillStyle = "rgba(216,215,209,0.95)";
    ctx.fillRect(x, y, w, h);
    // Specular highlight along the crown.
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    if (w > h) ctx.fillRect(x, y + h * 0.35, w, Math.max(1, h * 0.22));
    else ctx.fillRect(x + w * 0.35, y, Math.max(1, w * 0.22), h);
  }
  // Verticals at x = 0, S/2, S (edge bars are clipped to half — they rejoin
  // across the repeat seam).
  for (const x of [0, half, S]) bar(x - barW / 2, -2, barW, S + 4);
  // Horizontals at y = 0, S/2, S.
  for (const y of [0, half, S]) bar(-2, y - barW / 2, S + 4, barW);

  // Grime along the bars — nothing in this building has been cleaned.
  for (let i = 0; i < 200; i++) {
    const onVertical = Math.random() < 0.5;
    const line = [0, half, S][Math.floor(Math.random() * 3)];
    const t = Math.random() * S;
    const x = onVertical ? line + (Math.random() - 0.5) * barW : t;
    const y = onVertical ? t : line + (Math.random() - 0.5) * barW;
    ctx.fillStyle = `rgba(70,66,56,${0.05 + Math.random() * 0.18})`;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ── Door leaf ───────────────────────────────────────────────────────────────
// Muted institutional beige-grey painted wood. Portrait canvas (a door is ~2x
// as tall as it is wide) with faint vertical grain showing through the paint,
// a roller-stipple, and a couple of scuffs near the bottom where trolleys and
// shoes have hit it.
function doorTexture() {
  const W = 256;
  const H = 512;
  const { c, ctx } = makeCanvasWH(W, H);
  ctx.fillStyle = hex(CONFIG.colors.door);
  ctx.fillRect(0, 0, W, H);

  // Faint vertical wood grain under the paint — long, low-contrast streaks.
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * W;
    const w = 1 + Math.random() * 5;
    ctx.fillStyle =
      Math.random() < 0.5
        ? `rgba(90,86,74,${0.02 + Math.random() * 0.05})`
        : `rgba(226,222,208,${0.02 + Math.random() * 0.05})`;
    ctx.fillRect(x, 0, w, H);
  }

  // Roller stipple — paint applied badly, decades ago.
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  // Grime settling low on the leaf, plus a dirty halo where hands go.
  const g = ctx.createLinearGradient(0, H, 0, H * 0.6);
  g.addColorStop(0, "rgba(40,36,28,0.22)");
  g.addColorStop(1, "rgba(40,36,28,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  const hx = W * 0.82;
  const hy = H * 0.52;
  const hg = ctx.createRadialGradient(hx, hy, 2, hx, hy, 48);
  hg.addColorStop(0, "rgba(50,44,32,0.16)");
  hg.addColorStop(1, "rgba(50,44,32,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(hx - 48, hy - 48, 96, 96);

  // A scuff or two: pale gouges where the paint has been knocked off.
  for (let i = 0; i < 3; i++) {
    const sx = 20 + Math.random() * (W - 40);
    const sy = H * (0.7 + Math.random() * 0.25);
    ctx.strokeStyle = `rgba(228,224,212,${0.25 + Math.random() * 0.3})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  // Authored for exactly one leaf — do not repeat.
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

// A wide, roughly-scrawled pitch-black arrow — like someone marked it on the
// wall in a hurry with a finger dipped in ink, not a printed sign. Drawn on
// a transparent canvas so it reads as a marking rather than a solid tile.
// Points right by default; left-pointing instances just mirror the mesh
// (see world.js). Wobbly multi-pass strokes + drips give it a hand-drawn,
// slightly unsettling look rather than a clean vector glyph. The tip is two
// diagonal scrawled lines meeting at a point, not a filled triangle.
function arrowTexture() {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const jitter = (n) => (Math.random() - 0.5) * n;

  // A wobbly hand-drawn line: many short jittered segments instead of one
  // clean stroke, redrawn a few times at slightly different offsets/widths
  // so it looks scratched rather than plotted. Endpoints wobble much less
  // than the middle of the stroke, so separate scrawl() calls that are
  // meant to share a point (e.g. the shaft and the arrowhead barbs) actually
  // meet there instead of leaving a gap.
  function scrawl(x1, y1, x2, y2, width, passes = 4) {
    for (let p = 0; p < passes; p++) {
      ctx.lineWidth = width * (0.7 + Math.random() * 0.6);
      ctx.beginPath();
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const endpoint = i === 0 || i === segs;
        const x = x1 + (x2 - x1) * t + jitter(endpoint ? 3 : 14);
        const y = y1 + (y2 - y1) * t + jitter(endpoint ? 2 : 10);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const midY = h * 0.5;
  const tipX = w * 0.9;

  // Shaft runs all the way to the tip — no gap between it and the head.
  scrawl(w * 0.06, midY, tipX, midY, 22, 4);

  // Tip: two diagonal scrawled lines starting AT the same tip point and
  // splaying back-and-out, not a filled triangle.
  const spread = h * 0.24;
  const barpX = w * 0.68;
  scrawl(tipX, midY, barpX, midY - spread, 20, 3);
  scrawl(tipX, midY, barpX, midY + spread, 20, 3);

  // Ink drips trailing down off the shaft and tip — the horror-ish detail.
  const dripSources = [
    ...Array.from({ length: 10 }, () => ({
      x: w * 0.06 + (tipX - w * 0.06) * Math.random(),
      y: midY,
    })),
    ...Array.from({ length: 6 }, () => {
      const t = Math.random();
      const upper = Math.random() < 0.5;
      const sy = upper ? midY - spread : midY + spread;
      return { x: tipX + (barpX - tipX) * t, y: midY + (sy - midY) * t };
    }),
  ];
  for (const src of dripSources) {
    const bx = src.x + jitter(10);
    const by = src.y + jitter(6);
    const dripLen = 10 + Math.random() * 70;
    const dripW = 3 + Math.random() * 6;
    ctx.beginPath();
    ctx.moveTo(bx - dripW / 2, by);
    ctx.lineTo(bx + dripW / 2, by);
    ctx.lineTo(bx + dripW / 3, by + dripLen);
    ctx.lineTo(bx - dripW / 3, by + dripLen);
    ctx.closePath();
    ctx.fill();
    if (Math.random() < 0.55) {
      ctx.beginPath();
      ctx.arc(bx + jitter(4), by + dripLen, dripW * 0.5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Scattered spatter flecks around the mark.
  for (let i = 0; i < 30; i++) {
    ctx.globalAlpha = 0.4 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.arc(w * 0.4 + jitter(340), midY + jitter(140), Math.random() * 3.5 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// Whitewashed brick — Stage 2's wall material, distinct from the main
// game's sickly-yellow wallpaper. A running-bond grid of thin black grout
// lines over an off-white base, with faint noise so it doesn't read flat.
function concreteTexture() {
  const { c, ctx } = makeCanvas(256);
  ctx.fillStyle = "#e9e8e2"; // off-white base
  ctx.fillRect(0, 0, 256, 256);

  // Fine speckle for a painted-plaster feel, not a flat fill.
  const img = ctx.getImageData(0, 0, 256, 256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // Brick grid: running-bond courses of black grout lines.
  const brickW = 10;
  const brickH = 12;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  for (let row = 0, y = 0; y <= 256; row++, y += brickH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();

    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let x = offset; x < 256; x += brickW) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(y + brickH, 256));
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Build once and reuse across all chunks.
//
// ── UV REPEAT CONTRACT (read this before setting .repeat in world.js) ───────
// Every tiling texture below is authored to cover a fixed number of METRES.
// Clone the material's `map` per surface if you need a different repeat, then:
//
//   wall      1 tile ≈ 2.1 m HORIZONTALLY, and 1 tile = the FULL wall height
//             (CONFIG.wallHeight, 3.0 m) VERTICALLY. It is a single wall-height
//             slice — water bleeds up from the bottom edge (floor) and down from
//             the top edge (ceiling), so tiling it in Y would stack floor stains
//             at head height and look wrong.
//               repeat.set(wallLengthMetres / 2.1, 1)
//
//   carpet    1 tile ≈ 2.1 m square, tiles freely in both axes.
//               repeat.set(widthMetres / 2.1, depthMetres / 2.1)
//
//   ceiling   1 tile = 1.2 m square = a 2x2 block of 600 mm acoustic tiles.
//             Keep the repeat on the 1.2 m module or the T-bar grid will not
//             line up with itself across chunk boundaries.
//               repeat.set(widthMetres / 1.2, depthMetres / 1.2)
//             (CONFIG.cellSize is 4.2 m = 3.5 tiles — round to whole tiles if
//              you want a perfectly continuous grid across cells.)
//
//   concrete  1 tile ≈ 2.0 m square (Stage 2 brick). Unchanged.
//
//   door      Authored for exactly ONE leaf (portrait). Leave repeat at 1,1.
//
//   baseboard / doorFrame  Untextured flat colours — no repeat to set.
//
// These numbers also live in the exported TEXTURE_SCALE object above so you can
// compute repeats without hard-coding magic numbers.
export function createMaterials() {
  const wallTex = wallpaperTexture();
  const carpetTex = carpetTexture();
  const ceilingTex = ceilingTexture();
  const doorTex = doorTexture();
  const arrowTex = arrowTexture();
  const concreteTex = concreteTexture();

  const wall = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: 0xffffff,
    roughness: 0.92, // aged paper drinks light; almost no sheen
    metalness: 0.0,
  });

  const concrete = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.05,
  });

  const carpet = new THREE.MeshStandardMaterial({
    map: carpetTex,
    roughness: 1.0,
    metalness: 0.0,
  });

  // Suspended acoustic tile ceiling. Deliberately LIGHTER than the walls — it
  // catches the fluorescent light and is the main reason the space reads as an
  // office building rather than a yellow box.
  const ceiling = new THREE.MeshStandardMaterial({
    map: ceilingTex,
    color: 0xffffff,
    roughness: 0.95, // mineral fibre is dead matte
    metalness: 0.0,
  });

  // Dark scuffed vinyl skirting at the wall/floor junction. Cheap to draw and
  // it does an enormous amount of work: it grounds the walls, hides the seam
  // where wallpaper meets carpet, and is present in every Kane Pixels shot.
  const baseboard = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.baseboard,
    roughness: 0.8,
    metalness: 0.0,
  });

  // Painted timber door frame / jamb — off-white cream, gone a little grubby.
  // Slightly glossier than the wallpaper because it's gloss-painted trim.
  const doorFrame = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.doorFrame,
    roughness: 0.7,
    metalness: 0.0,
  });

  // Door leaf: muted institutional beige-grey painted wood.
  const door = new THREE.MeshStandardMaterial({
    map: doorTex,
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0.0,
  });

  // Emissive fluorescent panel. Emissive intensity is animated for flicker.
  const lightPanel = new THREE.MeshStandardMaterial({
    color: 0x222018,
    emissive: CONFIG.colors.lightPanel,
    emissiveIntensity: 1.0,
    roughness: 0.4,
  });

  // Encounter-zone floor marker — a faint green glow reserved for future
  // random-encounter / null-zone content (goal.md §6.7).
  const marker = new THREE.MeshStandardMaterial({
    color: 0x0a1a0d,
    emissive: 0x2bff6a,
    emissiveIntensity: 1.4,
    roughness: 0.6,
    transparent: true,
    opacity: 0.85,
  });

  // Painted-on wall arrow. MeshBasicMaterial so it reads clearly regardless
  // of local lighting, like a marking rather than a lit object.
  const arrow = new THREE.MeshBasicMaterial({
    map: arrowTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    wall,
    concrete,
    carpet,
    ceiling,
    baseboard,
    doorFrame,
    door,
    lightPanel,
    marker,
    arrow,
    _textures: [wallTex, carpetTex, ceilingTex, doorTex, arrowTex, concreteTex],
  };
}
