// Prop Room — a dev-only test chamber reachable from the dev menu, holding one
// of EVERY registered prop so they can be inspected side by side. Like Stage 2
// (see stage2.js) it lives at a fixed coordinate far outside the procedural
// world and isn't part of chunk streaming.
//
// Built lazily on first teleport (see main.js) so the object/SVG caches are
// already warm — it clones each cached template, so it must run after
// preloadObjects()/preloadSvgProps() have resolved. All geometry/material is
// shared with the registry caches; nothing here is ever disposed.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { OBJECT_REGISTRY, getObject } from "./objects.js";
import { SVG_REGISTRY, getSvgProp } from "./svgprops.js";

// Far from Stage 2's corner and from anything the world generator uses.
export const PROPROOM_POS = { wx: -1_000_000, wz: 1_000_000 };

const SPACING = 2.6; // metres between grid cells
const MARGIN = 4; // clear floor between the outermost props and the walls

function addWalls(group, colliders, wx, wz, size) {
  const half = size / 2;
  const specs = [
    { cx: wx, cz: wz - half, w: size, d: CONFIG.wallThickness },
    { cx: wx, cz: wz + half, w: size, d: CONFIG.wallThickness },
    { cx: wx - half, cz: wz, w: CONFIG.wallThickness, d: size },
    { cx: wx + half, cz: wz, w: CONFIG.wallThickness, d: size },
  ];
  for (const s of specs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, CONFIG.wallHeight, s.d), materialsRef.wall);
    mesh.position.set(s.cx, CONFIG.wallHeight / 2, s.cz);
    group.add(mesh);
    const px = CONFIG.playerRadius;
    colliders.push({ minX: s.cx - s.w / 2 - px, maxX: s.cx + s.w / 2 + px, minZ: s.cz - s.d / 2 - px, maxZ: s.cz + s.d / 2 + px });
  }
}

let materialsRef = null;

// Bright, evenly-lit room (a grid of ceiling panels + point lights) so every
// prop reads clearly — brighter on purpose than the moody main game.
function addLights(group, wx, wz, size, cells) {
  const step = size / (cells + 1);
  for (let r = 1; r <= cells; r++) {
    for (let c = 1; c <= cells; c++) {
      const x = wx - size / 2 + step * c;
      const z = wz - size / 2 + step * r;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), materialsRef.lightPanel);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, CONFIG.wallHeight - 0.02, z);
      group.add(panel);
      const light = new THREE.PointLight(CONFIG.colors.lightPanel, CONFIG.lightIntensity * 0.8, size, CONFIG.lightDecay);
      light.position.set(x, CONFIG.wallHeight - 0.6, z);
      group.add(light);
    }
  }
}

// Builds the room once. Returns { group, colliders } — group is added to the
// scene directly (not via World), colliders replace world collision while here.
export function buildPropRoom(materials) {
  materialsRef = materials;
  const { wx, wz } = PROPROOM_POS;
  const group = new THREE.Group();
  const colliders = [];

  // Every registered model that actually loaded, laid out in a square grid.
  const models = OBJECT_REGISTRY.map((e) => getObject(e.id)).filter(Boolean);
  const cols = Math.max(1, Math.ceil(Math.sqrt(models.length)));
  const rows = Math.ceil(models.length / cols);
  const gridW = (cols - 1) * SPACING;
  const gridD = (rows - 1) * SPACING;
  const size = Math.max(gridW, gridD) + MARGIN * 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), materials.carpet);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(wx, 0, wz);
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), materials.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(wx, CONFIG.wallHeight, wz);
  group.add(ceil);

  addLights(group, wx, wz, size, Math.max(2, Math.round(size / 8)));
  addWalls(group, colliders, wx, wz, size);

  models.forEach((obj, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = wx - gridW / 2 + c * SPACING;
    const z = wz - gridD / 2 + r * SPACING;
    const mesh = obj.object3D.clone();
    mesh.position.set(x, 0, z);
    group.add(mesh);
    // No prop colliders — walk freely among them to inspect.
  });

  // Every SVG sign, mounted in a row along the north wall facing into the room.
  const signs = SVG_REGISTRY.map((e) => getSvgProp(e.id)).filter(Boolean);
  const signStep = size / (signs.length + 1);
  signs.forEach((tpl, i) => {
    const x = wx - size / 2 + signStep * (i + 1);
    const z = wz - size / 2 + CONFIG.wallThickness / 2 + 0.03; // north wall inner face
    const sign = tpl.object3D.clone();
    sign.position.set(x, 1.7, z); // template faces +Z, which is the north wall's inward normal
    group.add(sign);
  });

  return { group, colliders, size, count: models.length + signs.length };
}
