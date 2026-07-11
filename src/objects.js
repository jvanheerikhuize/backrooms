// Registry + loader/cache for external 3D models, used to dress special rooms
// with more detail than boxes/cylinders can give. This is a deliberate,
// documented exception to the project's "everything procedural, no external
// asset files" rule (see context/decisions.md) — every bundled model is CC0 /
// public-domain (three.js's MIT example STLs and Poly Haven's CC0 glTF props),
// so it carries no licensing risk. See public/models/**/NOTICE.md for sources.
//
// Two model formats are supported:
//   * STL  — geometry only; we apply a single MeshStandardMaterial override
//            (colour/metalness/roughness from the registry entry). Many STLs are
//            CAD/robotics files authored Z-up, hence `rotateXNeg90`.
//   * glTF — a full scene that carries its own PBR materials + textures; we keep
//            those and only normalise scale/position. glTF is Y-up by spec, so
//            no rotation is needed.
//
// Whichever the format, a model is normalised to a template Object3D that is:
//   * scaled so its longest bounding-box dimension equals `targetSize` metres,
//   * centred on X/Z and resting on the floor (min Y = 0),
// then cached. rooms.js clones that template per placement. The template's
// geometry/material are SHARED across clones, so — like the rest of the
// registry — they must never be disposed per-chunk (World.disposeChunk only
// frees geometry flagged `userData.disposable`, which these never set).
//
// Every registered model is preloaded once — main.js awaits preloadObjects()
// before the world starts generating.

import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// id            unique key rooms.js uses to reference a cached model
// file          path under /public, served as-is by Vite
// format        "stl" (default) or "gltf"
// label         human-readable, for comments/debugging — not shown in-game
// targetSize    metres — the model's longest bounding-box dimension is scaled
//               to this (models arrive in arbitrary / real-world units)
// rotateXNeg90  STL only — rotate Z-up source data into our Y-up scene
// roundFootprint  this game's colliders are all axis-aligned rectangles —
//               fine for boxy shapes, but a round object (like a disk) gets
//               a square collider that reaches past the mesh at the
//               corners, blocking the player on what looks like open floor.
//               Shrinks the collider to a square inscribed inside the
//               round footprint instead of one that circumscribes it, so
//               it never blocks more than the visible mesh (it can let you
//               stand a little closer at the true corners of the circle,
//               which reads far better than phantom blocking).
// color/metalness/roughness  STL only — build its MeshStandardMaterial
export const OBJECT_REGISTRY = [
  // ── three.js MIT example STLs (Z-up CAD) ──────────────────────────────────
  {
    id: "servo-housing",
    file: "/models/stl/pr2_head_pan.stl",
    label: "research equipment — servo housing",
    targetSize: 0.5,
    rotateXNeg90: true,
    color: 0x6b6f6a,
    metalness: 0.5,
    roughness: 0.5,
  },
  {
    id: "slotted-disk",
    file: "/models/stl/slotted_disk.stl",
    label: "research equipment — slotted disk",
    targetSize: 0.4,
    rotateXNeg90: true,
    roundFootprint: true,
    color: 0x7a7d78,
    metalness: 0.6,
    roughness: 0.4,
  },
  // ── Poly Haven CC0 glTF props (real-world sized, own PBR materials) ───────
  {
    id: "barrel",
    file: "/models/gltf/Barrel_01/Barrel_01_1k.gltf",
    format: "gltf",
    label: "industrial hazard drum",
    targetSize: 0.88,
  },
  {
    id: "school-chair",
    file: "/models/gltf/SchoolChair_01/SchoolChair_01_1k.gltf",
    format: "gltf",
    label: "school / office chair",
    targetSize: 1.01,
  },
  {
    id: "wooden-crate",
    file: "/models/gltf/CheeseBox_01/CheeseBox_01_1k.gltf",
    format: "gltf",
    label: "small wooden crate",
    targetSize: 0.24,
  },
  {
    id: "shelf",
    file: "/models/gltf/Shelf_01/Shelf_01_1k.gltf",
    format: "gltf",
    label: "metal shelving unit",
    targetSize: 2.08,
  },
  {
    id: "cardboard-box",
    file: "/models/gltf/cardboard_box_01/cardboard_box_01_1k.gltf",
    format: "gltf",
    label: "cardboard box",
    targetSize: 0.52,
  },
];

const stlLoader = new STLLoader();
const gltfLoader = new GLTFLoader();
const cache = new Map(); // id -> { object3D, halfX, halfZ, height }

// Scale `object3D` so its longest dimension is targetSize, then shift it so it
// is centred on X/Z and rests on the floor (min Y = 0). Returns collision dims.
function normalize(object3D, targetSize) {
  object3D.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  object3D.scale.multiplyScalar(targetSize / maxDim);

  object3D.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(object3D);
  object3D.position.x -= (scaled.max.x + scaled.min.x) / 2;
  object3D.position.z -= (scaled.max.z + scaled.min.z) / 2;
  object3D.position.y -= scaled.min.y;

  object3D.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(object3D);
  return {
    halfX: (finalBox.max.x - finalBox.min.x) / 2,
    halfZ: (finalBox.max.z - finalBox.min.z) / 2,
    height: finalBox.max.y,
  };
}

function loadStl(entry) {
  return new Promise((resolve, reject) => {
    stlLoader.load(
      entry.file,
      (geometry) => {
        if (entry.rotateXNeg90) geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({
          color: entry.color,
          metalness: entry.metalness ?? 0.3,
          roughness: entry.roughness ?? 0.6,
        });
        // Wrap in a pivot Group so normalize()'s centring offset survives the
        // per-placement clone (which overwrites the root's position).
        const pivot = new THREE.Group();
        pivot.add(new THREE.Mesh(geometry, material));
        resolve(pivot);
      },
      undefined,
      reject
    );
  });
}

function loadGltf(entry) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(entry.file, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function loadOne(entry) {
  const loader = entry.format === "gltf" ? loadGltf : loadStl;
  return loader(entry)
    .then((object3D) => {
      const dims = normalize(object3D, entry.targetSize);
      if (entry.roundFootprint) {
        // Inscribed square (÷√2 of the smaller side) instead of the full
        // bounding box — see the roundFootprint comment above.
        const inscribed = Math.min(dims.halfX, dims.halfZ) / Math.SQRT2;
        dims.halfX = inscribed;
        dims.halfZ = inscribed;
      }
      cache.set(entry.id, { object3D, ...dims });
    })
    .catch((err) => {
      // A missing/broken model must never break world generation — just skip
      // it; randomObject() only offers up successfully-cached entries.
      console.warn(`[objects] failed to load ${entry.file}:`, err);
    });
}

let preloaded = null;
// Load every registered model once. Idempotent — later calls resolve
// immediately.
export function preloadObjects() {
  if (!preloaded) preloaded = Promise.all(OBJECT_REGISTRY.map(loadOne));
  return preloaded;
}

// A random successfully-loaded registered object's cached entry, or null if
// none are ready yet (e.g. every fetch failed) — callers should treat that as
// "skip this placement", not an error.
export function randomObject(rng) {
  const ids = OBJECT_REGISTRY.map((e) => e.id).filter((id) => cache.has(id));
  if (ids.length === 0) return null;
  return cache.get(ids[Math.floor(rng() * ids.length)]);
}
