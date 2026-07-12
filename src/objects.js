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
// category      "research" marks the STL "leftover equipment" props that
//               randomObject() picks from for the generic clutter placement
//               (addResearchProp in rooms.js). Furniture models (table,
//               chair, crate, shelf, barrel) are fetched by exact id via
//               getObject() instead, since rooms.js places those for a
//               specific purpose (the room's actual table, its crates), not
//               as a random "someone left this here" flourish.
// targetSize    metres — the model's longest bounding-box dimension is scaled
//               to this (models arrive in arbitrary / real-world units)
// rotateXNeg90  STL only — rotate Z-up source data into our Y-up scene
// roundFootprint  this game's colliders are all axis-aligned rectangles —
//               fine for boxy shapes, but a round object (like a disk or
//               barrel) gets a square collider that reaches past the mesh at
//               the corners, blocking the player on what looks like open
//               floor. Shrinks the collider to a square inscribed inside the
//               round footprint instead of one that circumscribes it, so
//               it never blocks more than the visible mesh (it can let you
//               stand a little closer at the true corners of the circle,
//               which reads far better than phantom blocking).
// wallMount     for decor meant to hang on a wall rather than sit on the
//               floor (a picture frame). normalize() centres these on Y
//               instead of resting them at Y=0, since "rest on the floor"
//               makes no sense for something that isn't floor-standing —
//               rooms.js positions the centred template at whatever mount
//               height it wants instead. No collider is ever built for
//               these (wall decor in this game is cosmetic-only, mounted
//               above where the floor-level collision plane cares).
// color/metalness/roughness  STL only — build its MeshStandardMaterial
export const OBJECT_REGISTRY = [
  // ── three.js MIT example STLs (Z-up CAD) ──────────────────────────────────
  {
    id: "servo-housing",
    file: "/models/stl/pr2_head_pan.stl",
    label: "research equipment — servo housing",
    category: "research",
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
    category: "research",
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
    roundFootprint: true,
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
  {
    id: "table",
    file: "/models/gltf/WoodenTable_01/WoodenTable_01_1k.gltf",
    format: "gltf",
    label: "wooden table",
    targetSize: 1.8,
  },
  {
    id: "lantern",
    file: "/models/gltf/Lantern_01/Lantern_01_1k.gltf",
    format: "gltf",
    label: "hurricane lantern",
    targetSize: 0.29,
  },
  {
    id: "picture-frame",
    file: "/models/gltf/fancy_picture_frame_01/fancy_picture_frame_01_1k.gltf",
    format: "gltf",
    label: "framed picture",
    targetSize: 0.65,
    wallMount: true,
  },
  {
    id: "toy-duck",
    file: "/models/gltf/rubber_duck_toy/rubber_duck_toy_1k.gltf",
    format: "gltf",
    label: "rubber duck toy",
    targetSize: 0.28,
  },
  {
    id: "toy-baseball",
    file: "/models/gltf/baseball_01/baseball_01_1k.gltf",
    format: "gltf",
    label: "baseball",
    targetSize: 0.076,
    roundFootprint: true,
  },
  {
    id: "oil-can",
    file: "/models/gltf/small_oil_can_01/small_oil_can_01_1k.gltf",
    format: "gltf",
    label: "small oil can",
    targetSize: 0.27,
    roundFootprint: true,
  },
  // Larger left-behind furniture — placed for effect via getObject() (see
  // rooms.js addExtraFurniture), not part of the random "research" clutter.
  {
    id: "sofa",
    file: "/models/gltf/Sofa_01/Sofa_01_1k.gltf",
    format: "gltf",
    label: "worn sofa",
    targetSize: 1.57,
  },
  {
    id: "boombox",
    file: "/models/gltf/boombox/boombox_1k.gltf",
    format: "gltf",
    label: "boombox",
    targetSize: 0.72,
  },
  {
    id: "ammo-box",
    file: "/models/gltf/ammo_box/ammo_box_1k.gltf",
    format: "gltf",
    label: "military ammo crate",
    targetSize: 0.26,
  },
];

const stlLoader = new STLLoader();
const gltfLoader = new GLTFLoader();
const cache = new Map(); // id -> { object3D, halfX, halfZ, height }

// Scale `object3D` so its longest dimension is targetSize, then shift it so
// it is centred on X/Z. Rests on the floor (min Y = 0) unless `wallMount`,
// which centres Y too — "rest on the floor" is meaningless for something
// that's meant to hang, and rooms.js positions the centred template at
// whatever height it wants to mount at. Returns collision dims (for
// wallMount entries, halfY substitutes for the unused `height`, since
// nothing needs a floor collider for wall decor).
function normalize(object3D, targetSize, wallMount = false) {
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
  object3D.position.y -= wallMount ? (scaled.max.y + scaled.min.y) / 2 : scaled.min.y;

  object3D.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(object3D);
  return {
    halfX: (finalBox.max.x - finalBox.min.x) / 2,
    halfZ: (finalBox.max.z - finalBox.min.z) / 2,
    height: wallMount ? (finalBox.max.y - finalBox.min.y) / 2 : finalBox.max.y,
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
      const dims = normalize(object3D, entry.targetSize, entry.wallMount);
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

// A random successfully-loaded "research equipment" prop's cached entry, or
// null if none are ready yet (e.g. every fetch failed) — callers should treat
// that as "skip this placement", not an error. Scoped to category "research"
// so furniture models (table, chair, crate, shelf, barrel) — placed for a
// specific purpose via getObject() — don't also turn up as random clutter.
export function randomObject(rng) {
  const ids = OBJECT_REGISTRY.filter((e) => e.category === "research" && cache.has(e.id)).map((e) => e.id);
  if (ids.length === 0) return null;
  return cache.get(ids[Math.floor(rng() * ids.length)]);
}

// A specific registered model's cached entry by id, or undefined if it
// hasn't finished loading yet (or failed to load) — callers that place a
// specific piece of furniture (a table, a shelf) should fall back to a
// simple procedural shape in that case, same as randomObject callers do.
export function getObject(id) {
  return cache.get(id);
}
