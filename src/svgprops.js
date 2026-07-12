// Registry + parser/cache for flat 2D props ingested from SVG files — signs,
// arrows, warnings, decals mounted on room walls. Complements the 3D object
// registry (objects.js): where that loads solid STL/glTF geometry, this turns
// vector paths into flat filled meshes.
//
// How the parse works (three.js SVGLoader):
//   * Each SVG <path>/<rect>/<polygon>/… becomes a ShapePath; SVGLoader turns
//     it into one or more THREE.Shape, which we fill with a ShapeGeometry.
//   * SVG's Y axis points DOWN, so we flip Y (scale.y = -1) to land right-way-up
//     in our Y-up scene.
//   * Each shape is coloured by its SVG `fill` (falling back to the registry's
//     `color`), drawn UNLIT (MeshBasicMaterial) so signs stay readable in the
//     dark, and nudged a hair forward per source path so overlapping fills
//     (e.g. a symbol on a backing plate) paint in SVG order without z-fighting.
//   * The whole thing is scaled so its width equals `widthMeters`, centred on
//     the origin, and left facing +Z — ready to clone, rotate to a wall's
//     inward normal, and mount flush (see rooms.js addWallSign).
//
// Like objects.js, every template's geometry/material is SHARED across clones,
// so it must never be disposed per-chunk (World.disposeChunk only frees
// geometry flagged `userData.disposable`, which these never set). Authoring:
// drop a filled-shape SVG (no <text> — SVGLoader can't rasterise fonts) into
// public/models/svg/ and register it below.

import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

// id           unique key rooms.js references
// file         path under /public
// label        human-readable, for comments/debugging
// widthMeters  the sign's rendered width; height follows the SVG's aspect ratio
// color        fallback fill for any path whose SVG `fill` is "none"/missing
export const SVG_REGISTRY = [
  { id: "arrow", file: "/models/svg/arrow.svg", label: "directional arrow", widthMeters: 0.8 },
  { id: "exit", file: "/models/svg/exit.svg", label: "emergency exit sign", widthMeters: 0.9 },
  { id: "hazard", file: "/models/svg/hazard.svg", label: "hazard warning", widthMeters: 0.6 },
  { id: "radiation", file: "/models/svg/radiation.svg", label: "radiation trefoil", widthMeters: 0.6 },
  { id: "no-entry", file: "/models/svg/no-entry.svg", label: "no-entry sign", widthMeters: 0.6 },
  { id: "lightning", file: "/models/svg/lightning.svg", label: "electrical hazard", widthMeters: 0.5 },
  { id: "first-aid", file: "/models/svg/first-aid.svg", label: "first-aid sign", widthMeters: 0.6 },
  { id: "skull", file: "/models/svg/skull.svg", label: "danger skull", widthMeters: 0.55 },
];

const loader = new SVGLoader();
const cache = new Map(); // id -> { object3D, halfW, halfH }
const LAYER_Z = 0.004; // metres nudged forward per source path (painter's order)

function buildTemplate(svgData, entry) {
  // One ShapeGeometry per shape, tagged with its source-path index (for z order)
  // and fill colour.
  const parts = [];
  svgData.paths.forEach((path, pathIndex) => {
    const fill = path.userData?.style?.fill;
    const color =
      fill && fill !== "none"
        ? new THREE.Color().setStyle(fill)
        : new THREE.Color(entry.color ?? 0x141414);
    for (const shape of SVGLoader.createShapes(path)) {
      const geo = new THREE.ShapeGeometry(shape);
      geo.computeBoundingBox();
      parts.push({ geo, color, pathIndex });
    }
  });

  // Combined bounds across every shape → uniform scale + centre offset.
  const box = new THREE.Box3();
  for (const p of parts) box.union(p.geo.boundingBox);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = entry.widthMeters / (size.x || 1);
  const cx = (box.max.x + box.min.x) / 2;
  const cy = (box.max.y + box.min.y) / 2;

  const center = new THREE.Matrix4().makeTranslation(-cx, -cy, 0);
  const flipScale = new THREE.Matrix4().makeScale(scale, -scale, scale); // -y flips SVG's y-down

  const group = new THREE.Group();
  for (const p of parts) {
    p.geo.applyMatrix4(center);
    p.geo.applyMatrix4(flipScale);
    const material = new THREE.MeshBasicMaterial({
      color: p.color,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(p.geo, material);
    mesh.position.z = p.pathIndex * LAYER_Z;
    group.add(mesh);
  }

  return { object3D: group, halfW: entry.widthMeters / 2, halfH: (size.y * scale) / 2 };
}

function loadOne(entry) {
  return new Promise((resolve) => {
    loader.load(
      entry.file,
      (data) => {
        try {
          cache.set(entry.id, buildTemplate(data, entry));
        } catch (err) {
          console.warn(`[svgprops] failed to build ${entry.file}:`, err);
        }
        resolve();
      },
      undefined,
      (err) => {
        // A missing/broken SVG must never break world generation — skip it;
        // randomSvgProp() only offers successfully-cached entries.
        console.warn(`[svgprops] failed to load ${entry.file}:`, err);
        resolve();
      }
    );
  });
}

let preloaded = null;
// Parse every registered SVG once. Idempotent.
export function preloadSvgProps() {
  if (!preloaded) preloaded = Promise.all(SVG_REGISTRY.map(loadOne));
  return preloaded;
}

// A random successfully-parsed 2D prop's cached template, or null if none are
// ready — callers treat that as "skip this placement", not an error.
export function randomSvgProp(rng) {
  const ids = SVG_REGISTRY.map((e) => e.id).filter((id) => cache.has(id));
  if (ids.length === 0) return null;
  return cache.get(ids[Math.floor(rng() * ids.length)]);
}

// A specific parsed 2D prop's cached template by id, or undefined if it hasn't
// loaded — used by the prop room to lay out one of every sign.
export function getSvgProp(id) {
  return cache.get(id);
}
