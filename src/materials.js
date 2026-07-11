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

// Build once and reuse across all chunks.
export function createMaterials() {
  const wallTex = wallpaperTexture();
  const carpetTex = carpetTexture();

  const wall = new THREE.MeshStandardMaterial({
    map: wallTex,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
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
    emissiveIntensity: 0.7,
    roughness: 0.6,
    transparent: true,
    opacity: 0.85,
  });

  return { wall, carpet, ceiling, lightPanel, marker, _textures: [wallTex, carpetTex] };
}
