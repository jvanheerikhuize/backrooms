// Registry + loader/cache for external STL 3D models, used to dress special
// rooms with more detail than boxes/cylinders can give. This is a
// deliberate, documented exception to the project's "everything procedural,
// no external asset files" rule (see context/decisions.md) — the STL files
// themselves are MIT licensed (three.js's own example models, same license
// as the `three` dependency), so it carries no new licensing risk. See
// public/models/stl/NOTICE.md for source details.
//
// Every registered model is preloaded once — main.js awaits preloadObjects()
// before the world starts generating — and its BufferGeometry/material are
// cached and reused across every placement. That geometry is SHARED, so
// (unlike rooms.js's per-room primitive geometry) it must never be disposed
// per-chunk; see World.disposeChunk's disposable-geometry convention.

import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

// id            unique key rooms.js uses to reference a cached model
// file          path under /public, served as-is by Vite
// label         human-readable, for comments/debugging — not shown in-game
// targetSize    metres — the model's longest bounding-box dimension is
//               scaled to this, since STL files arrive in arbitrary units
// rotateXNeg90  these two are CAD/robotics files (PR2 uses ROS's Z-up
//               convention; slotted_disk is a classic Z-up CAD example) —
//               without this they render lying flat with a mis-axed
//               collider instead of standing up. Rotate -90° around X to
//               convert Z-up source data to our scene's Y-up.
// color/metalness/roughness  build a MeshStandardMaterial for this model
export const OBJECT_REGISTRY = [
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
    color: 0x7a7d78,
    metalness: 0.6,
    roughness: 0.4,
  },
];

const loader = new STLLoader();
const cache = new Map(); // id -> { geometry, material, halfX, halfZ, height }

function loadOne(entry) {
  return new Promise((resolve) => {
    loader.load(
      entry.file,
      (geometry) => {
        if (entry.rotateXNeg90) geometry.rotateX(-Math.PI / 2);
        geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        geometry.boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = entry.targetSize / maxDim;
        geometry.scale(scale, scale, scale);

        // Centre horizontally and rest on the floor (min Y at 0) — the STL's
        // own origin/orientation is whatever the source file happened to use.
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        geometry.translate(-(box.max.x + box.min.x) / 2, -box.min.y, -(box.max.z + box.min.z) / 2);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        const finalBox = geometry.boundingBox;
        const material = new THREE.MeshStandardMaterial({
          color: entry.color,
          metalness: entry.metalness ?? 0.3,
          roughness: entry.roughness ?? 0.6,
        });

        cache.set(entry.id, {
          geometry,
          material,
          halfX: (finalBox.max.x - finalBox.min.x) / 2,
          halfZ: (finalBox.max.z - finalBox.min.z) / 2,
          height: finalBox.max.y,
        });
        resolve();
      },
      undefined,
      (err) => {
        // A missing/broken model shouldn't be able to break world
        // generation — just skip it; randomObject() only offers up
        // successfully-cached entries.
        console.warn(`[objects] failed to load ${entry.file}:`, err);
        resolve();
      }
    );
  });
}

let preloaded = null;
// Load every registered model once. Idempotent — safe to call again (e.g.
// nothing re-calls it today, but it's cheap insurance); later calls just
// resolve immediately.
export function preloadObjects() {
  if (!preloaded) preloaded = Promise.all(OBJECT_REGISTRY.map(loadOne));
  return preloaded;
}

// A random successfully-loaded registered object's cached entry, or null if
// none are ready yet (e.g. every fetch failed) — callers should treat that
// as "skip this placement", not an error.
export function randomObject(rng) {
  const ids = OBJECT_REGISTRY.map((e) => e.id).filter((id) => cache.has(id));
  if (ids.length === 0) return null;
  return cache.get(ids[Math.floor(rng() * ids.length)]);
}
