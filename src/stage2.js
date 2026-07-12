// Stage 2 — a second, separate area reachable only from the dev menu, not by
// walking there. Deliberately not part of the infinite procedural World: a
// single small enclosed room, built once, sitting at a fixed coordinate far
// outside any range the normal maze or "someone was here" rooms ever use, so
// there's no chance of the two overlapping. Kept plain on purpose — a
// placeholder for whatever this stage becomes later.

import * as THREE from "three";
import { CONFIG } from "./config.js";

// Comfortably outside anything world.js's seeded generation or specialRooms
// regions would ever place something at.
export const STAGE2_POS = { wx: 1_000_000, wz: 1_000_000 };

const SIZE = 14; // metres, square room
const HALF = SIZE / 2;

// Builds the room once. Returns { group, colliders } — group gets added to
// the main scene directly (not through World's chunk streaming), colliders
// are used in place of world.collidersNear() while the player is here.
export function buildStage2Room(materials) {
  const { wx, wz } = STAGE2_POS;
  const group = new THREE.Group();
  const colliders = [];

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), materials.carpet);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(wx, 0, wz);
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), materials.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(wx, CONFIG.wallHeight, wz);
  group.add(ceil);

  const light = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 0.4, SIZE * 0.4), materials.lightPanel);
  light.rotation.x = Math.PI / 2;
  light.position.set(wx, CONFIG.wallHeight - 0.02, wz);
  group.add(light);

  const point = new THREE.PointLight(CONFIG.colors.lightPanel, CONFIG.lightIntensity, CONFIG.lightRange, CONFIG.lightDecay);
  point.position.set(wx, CONFIG.wallHeight - 0.6, wz);
  group.add(point);

  const walls = [
    { cx: wx, cz: wz - HALF, w: SIZE, d: CONFIG.wallThickness }, // north
    { cx: wx, cz: wz + HALF, w: SIZE, d: CONFIG.wallThickness }, // south
    { cx: wx - HALF, cz: wz, w: CONFIG.wallThickness, d: SIZE }, // west
    { cx: wx + HALF, cz: wz, w: CONFIG.wallThickness, d: SIZE }, // east
  ];
  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, CONFIG.wallHeight, w.d), materials.wall);
    mesh.position.set(w.cx, CONFIG.wallHeight / 2, w.cz);
    group.add(mesh);
    const px = CONFIG.playerRadius;
    colliders.push({
      minX: w.cx - w.w / 2 - px,
      maxX: w.cx + w.w / 2 + px,
      minZ: w.cz - w.d / 2 - px,
      maxZ: w.cz + w.d / 2 + px,
    });
  }

  return { group, colliders };
}
