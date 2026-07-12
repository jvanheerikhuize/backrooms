// Procedural materials for the base Backrooms. Textures are drawn to canvases
// at runtime so the game ships no external image assets and works offline.
// Everything here is intentionally simple and swappable — the leak system
// (later feature) will mutate these per-section.

import * as THREE from "three";
import { CONFIG } from "./config.js";

function makeCanvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return { c, ctx: c.getContext("2d") };
}

// Faint vertical-striped, blotchy wallpaper in sickly yellow.
function wallpaperTexture() {
  const { c, ctx } = makeCanvas(256);
  const base = "#" + CONFIG.colors.wallpaper.toString(16).padStart(6, "0");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle vertical stripes.
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)";
    ctx.fillRect(x, 0, 4, 256);
  }
  // Damp blotches / stains.
  for (let i = 0; i < 40; i++) {
    const r = 6 + Math.random() * 26;
    ctx.fillStyle = `rgba(40,30,0,${0.02 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Grainy, damp carpet.
function carpetTexture() {
  const { c, ctx } = makeCanvas(256);
  const base = "#" + CONFIG.colors.carpet.toString(16).padStart(6, "0");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.6;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
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
export function createMaterials() {
  const wallTex = wallpaperTexture();
  const carpetTex = carpetTexture();
  const arrowTex = arrowTexture();
  const concreteTex = concreteTexture();

  const wall = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: 0xffffff,
    roughness: 0.85,
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

  const ceiling = new THREE.MeshStandardMaterial({
    color: CONFIG.colors.ceiling,
    roughness: 0.9,
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

  return { wall, concrete, carpet, ceiling, lightPanel, marker, arrow, _textures: [wallTex, carpetTex, arrowTex, concreteTex] };
}
