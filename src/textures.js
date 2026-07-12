// Registry + loader/cache for image-based surface SKINS — alternate
// wall/floor/ceiling looks built from texture files, used to re-skin a room so
// it reads as a "leaked" reinterpretation of the base yellow Backrooms
// (goal.md's leak/alteration idea; materials.js notes the base textures are
// meant to be swappable per-section).
//
// This is the counterpart to objects.js (glTF/STL models) and svgprops.js (SVG
// 2D props): where those ingest geometry, this ingests flat image textures.
// Adding a skin is a two-step job: drop a seamless texture into
// public/textures/ and add an entry below.
//
// A skin turns ONE seamless texture into three shared MeshStandardMaterials
// (wall, floor, ceiling) — each a clone of the texture with its own tiling, so
// the surfaces don't all tile at the same density. Materials are SHARED across
// every room that adopts the skin, so — like the model/SVG caches — they must
// never be disposed per-room (World/room disposal only frees geometry flagged
// `userData.disposable`, which these never touch).

import * as THREE from "three";

// id           key rooms.js / the prop room reference
// file         seamless texture under /public, applied to all three surfaces
// label        human-readable, for comments/debugging
// wallRepeat   [x, y] tiling for the walls
// floorRepeat  [x, y] tiling for floor + ceiling (usually denser than walls)
// roughness    surface roughness for the material
// ceilingTint  optional multiplier colour for the ceiling (defaults a touch
//              darker than 1,1,1 so the ceiling doesn't read identically flat)
export const SKIN_REGISTRY = [
  {
    id: "concrete",
    file: "/textures/anti_slip_concrete_diff_1k.jpg",
    label: "raw concrete",
    wallRepeat: [1.6, 1.1],
    floorRepeat: [3, 3],
    roughness: 0.92,
  },
  {
    id: "blue-tiles",
    file: "/textures/blue_floor_tiles_01_diff_1k.jpg",
    label: "blue tiling",
    wallRepeat: [2.2, 1.6],
    floorRepeat: [4, 4],
    roughness: 0.6,
  },
  {
    id: "blue-plaster",
    file: "/textures/blue_plaster_wall_diff_1k.jpg",
    label: "blue plaster",
    wallRepeat: [1.5, 1.1],
    floorRepeat: [3, 3],
    roughness: 0.85,
  },
  {
    id: "beige-plaster",
    file: "/textures/beige_wall_001_diff_1k.jpg",
    label: "beige plaster",
    wallRepeat: [1.5, 1.1],
    floorRepeat: [3, 3],
    roughness: 0.85,
  },
];

const loader = new THREE.TextureLoader();
const imageCache = new Map(); // file -> base THREE.Texture (loaded once)
const cache = new Map(); // skin id -> { wall, floor, ceiling }

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (imageCache.has(file)) return resolve(imageCache.get(file));
    loader.load(
      file,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        imageCache.set(file, tex);
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

// A tiled MeshStandardMaterial from a base texture — clone so each surface can
// carry its own repeat without touching the shared source.
function surfaceMaterial(baseTex, repeat, roughness, tint) {
  const map = baseTex.clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat[0], repeat[1]);
  map.anisotropy = 4;
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map, roughness, color: tint ?? 0xffffff });
}

function loadOne(entry) {
  return loadImage(entry.file)
    .then((baseTex) => {
      cache.set(entry.id, {
        wall: surfaceMaterial(baseTex, entry.wallRepeat, entry.roughness),
        floor: surfaceMaterial(baseTex, entry.floorRepeat, entry.roughness),
        ceiling: surfaceMaterial(baseTex, entry.floorRepeat, entry.roughness, entry.ceilingTint ?? 0xcccccc),
      });
    })
    .catch((err) => {
      // A missing/broken texture must never break generation — just skip the
      // skin; randomSkin()/getSkin() only offer successfully-loaded ones.
      console.warn(`[textures] failed to load ${entry.file}:`, err);
    });
}

let preloaded = null;
// Load every registered skin once. Idempotent.
export function preloadSkins() {
  if (!preloaded) preloaded = Promise.all(SKIN_REGISTRY.map(loadOne));
  return preloaded;
}

// A random loaded skin's { wall, floor, ceiling } materials, or null if none
// are ready — callers treat that as "use the base look", not an error.
export function randomSkin(rng) {
  const ids = SKIN_REGISTRY.map((e) => e.id).filter((id) => cache.has(id));
  if (ids.length === 0) return null;
  return cache.get(ids[Math.floor(rng() * ids.length)]);
}

// A specific loaded skin by id (for the prop room's skin swatches), or
// undefined if it hasn't loaded.
export function getSkin(id) {
  return cache.get(id);
}
