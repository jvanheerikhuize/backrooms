// Stage 2 — a second, separate area reachable only from the dev menu, not by
// walking there. Lives in its own THREE.Scene (see main.js), entirely
// decoupled from the infinite procedural World — a true separate "dimension"
// rather than just a room parked far away in the same world coordinates (the
// old approach also caused visible float-precision jitter at that distance).
// A single small enclosed room, built once. Grey concrete walls and no
// ambient "static" bed distinguish it from the main game's yellow Backrooms.
// Kept plain on purpose — a placeholder for whatever this stage becomes later.

import * as THREE from "three";
import { CONFIG } from "./config.js";

// Local to Stage 2's own scene — no need to be far from anything, since
// nothing else is ever rendered or collided against in that scene.
export const STAGE2_POS = { wx: 0, wz: 0 };

const SIZE = 250; // metres, square room — test-size placeholder ahead of procedural generation
const HALF = SIZE / 2;
const LIGHT_PANEL_SIZE = 5.6; // fixed footprint, independent of room SIZE

// Neutral white light, not the main game's warm-yellow fluorescent colour
// (CONFIG.colors.lightPanel) — otherwise that cast would wash the concrete
// walls back toward yellow instead of reading as grey.
const LIGHT_COLOR = 0xf2f2f2;
const lightPanelMat = new THREE.MeshStandardMaterial({
  color: 0x1c1c1c,
  emissive: LIGHT_COLOR,
  emissiveIntensity: 1.0,
  roughness: 0.4,
});

// Plain light-grey floor/ceiling, distinct from the main game's yellow
// carpet and ceiling (materials.carpet/materials.ceiling are shared with
// the main game and Prop Room, so Stage 2 gets its own instead).
const floorMat = new THREE.MeshStandardMaterial({ color: 0xb5b5b0, roughness: 0.9, metalness: 0.0 });
const ceilMat = new THREE.MeshStandardMaterial({ color: 0xc7c7c2, roughness: 0.9, metalness: 0.0 });

// Builds the room once. Returns { group, colliders } — group is the root of
// Stage 2's own scene (see main.js), colliders are used in place of
// world.collidersNear() while the player is here.
export function buildStage2Room(materials) {
  const { wx, wz } = STAGE2_POS;
  const group = new THREE.Group();
  const colliders = [];

  // This scene has no shared hemisphere/ambient light the way the main game
  // scene does (see main.js) — it needs its own baseline lighting, neutral
  // rather than the main game's warm cast (see LIGHT_COLOR above). Set high
  // enough to light the whole room evenly on its own (no fog here either —
  // see main.js) rather than relying on the single point light's falloff,
  // since the room is much bigger than that light's range.
  const hemi = new THREE.HemisphereLight(LIGHT_COLOR, 0x5a5a5a, 2.5);
  group.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 2.5);
  group.add(ambient);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(wx, 0, wz);
  group.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(wx, CONFIG.wallHeight, wz);
  group.add(ceil);

  const light = new THREE.Mesh(new THREE.PlaneGeometry(LIGHT_PANEL_SIZE, LIGHT_PANEL_SIZE), lightPanelMat);
  light.rotation.x = Math.PI / 2;
  light.position.set(wx, CONFIG.wallHeight - 0.02, wz);
  group.add(light);

  const point = new THREE.PointLight(LIGHT_COLOR, CONFIG.lightIntensity * 0.65, CONFIG.lightRange, CONFIG.lightDecay);
  point.position.set(wx, CONFIG.wallHeight - 0.6, wz);
  group.add(point);

  // Brick texture is baked at a fixed real-world scale calibrated for a 14m
  // room (see materials.js); repeat it so bricks stay the same physical size
  // as the room grows instead of stretching into giant slabs.
  if (materials.concrete.map) materials.concrete.map.repeat.set(SIZE / 14, 1);

  const walls = [
    { cx: wx, cz: wz - HALF, w: SIZE, d: CONFIG.wallThickness }, // north
    { cx: wx, cz: wz + HALF, w: SIZE, d: CONFIG.wallThickness }, // south
    { cx: wx - HALF, cz: wz, w: CONFIG.wallThickness, d: SIZE }, // west
    { cx: wx + HALF, cz: wz, w: CONFIG.wallThickness, d: SIZE }, // east
  ];
  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, CONFIG.wallHeight, w.d), materials.concrete);
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
