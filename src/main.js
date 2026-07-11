// Entry point — wires renderer, scene, world streaming, player, lighting,
// fluorescent flicker and VHS post-processing into a single render loop.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { createMaterials } from "./materials.js";
import { World, SPAWN_POS } from "./world.js";
import { Player } from "./player.js";
import { createComposer } from "./postfx.js";
import { Ambience } from "./audio.js";
import { Cutscene } from "./cutscene.js";

const canvas = document.getElementById("scene");
const overlay = document.getElementById("overlay");
const audioIndicator = document.getElementById("audio-indicator");
const cutsceneHud = document.getElementById("cutscene-hud");
const staminaEl = document.getElementById("stamina");
const staminaFill = document.getElementById("stamina-fill");
const inventoryEl = document.getElementById("inventory");
const inventoryGrid = inventoryEl ? inventoryEl.querySelector(".inv-grid") : null;
const devMenuEl = document.getElementById("dev-menu");

// Renderer.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// Scene + fog (fog hides the streaming boundary and sells the endlessness).
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.fog);
scene.fog = new THREE.Fog(CONFIG.colors.fog, CONFIG.fogNear, CONFIG.fogFar);

// Camera.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

// Lighting. A modest hemisphere gives base visibility so the gaps between the
// (now sparse) fixtures aren't pitch black. Down-facing surfaces (the ceiling)
// only pick up the hemisphere's "ground" component, so a flat ambient light is
// layered on top — otherwise the ceiling reads as near-black regardless of how
// bright the fixtures are.
const hemi = new THREE.HemisphereLight(CONFIG.colors.lightPanel, CONFIG.colors.carpet, 0.8);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

// A pool of real point-lights, reassigned each frame to the fixtures nearest the
// player. Sitting a little below the ceiling, they pool bright light on the
// floor without washing out the ceiling directly overhead. Sparse fixtures mean
// the pool is rarely full, so this stays cheap.
const lightPool = [];
for (let i = 0; i < CONFIG.maxActiveLights; i++) {
  const l = new THREE.PointLight(CONFIG.colors.lightPanel, 0, CONFIG.lightRange, CONFIG.lightDecay);
  l.visible = false;
  scene.add(l);
  lightPool.push(l);
}

// Assign the nearest fixtures to the pool and light them at the given intensity.
function updateLights(px, pz, intensity) {
  const lights = world.collectLights();
  for (let i = 0; i < lights.length; i++) {
    const p = lights[i];
    p._d = (p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz);
  }
  lights.sort((a, b) => a._d - b._d);
  const n = Math.min(lightPool.length, lights.length);
  for (let i = 0; i < lightPool.length; i++) {
    const l = lightPool[i];
    if (i < n) {
      const p = lights[i];
      l.position.set(p.x, CONFIG.wallHeight - 0.6, p.z);
      l.intensity = CONFIG.lightIntensity * intensity;
      l.visible = true;
    } else {
      l.visible = false;
    }
  }
}

// Materials, world, player, post-processing.
const materials = createMaterials();
const world = new World(scene, materials);
const player = new Player(camera, canvas);
scene.add(player.object);
const fx = createComposer(renderer, scene, camera);

// Build the initial chunks around the spawn ("fresh corner").
world.update(SPAWN_POS.wx, SPAWN_POS.wz);

// Found-footage cut-scene layer (Feature 04). The opening screen plays as a
// looping cut-scene behind the title; gameplay runs the clean view.
const cutscene = new Cutscene(camera, fx, world, cutsceneHud);
cutscene.startOpening();

// Debug hook for verification tooling.
window.__dbgCutscene = () => ({
  active: cutscene.active,
  mode: cutscene.mode,
  found: +cutscene.found.toFixed(2),
  distortion: +fx.getDistortion().toFixed(2),
  reduceMotion: cutscene.reduceMotion,
});

// Lightweight debug hook (position readout) for verification tooling.
window.__dbgPos = () => ({
  x: +camera.position.x.toFixed(2),
  z: +camera.position.z.toFixed(2),
  zone: world.profileAt(camera.position.x, camera.position.z),
  chunks: world.chunks.size,
  lights: world.collectLights().length,
  litNow: lightPool.filter((l) => l.visible).length,
});

// Dev teleport for exploring the different layout zones during testing.
window.__dbgTeleport = (x, z) => {
  camera.position.set(x, CONFIG.eyeHeight, z);
  world.update(x, z);
  return world.profileAt(x, z);
};

// True if (x,z) sits inside any nearby collider — same point-in-AABB test
// player.js uses for movement, reused here to validate teleport landing
// spots before committing to them.
function pointBlocked(x, z) {
  const colliders = world.collidersNear(x, z);
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
  }
  return false;
}

// A teleport target can land inside furniture/walls (e.g. a room prop placed
// right at its center). Requires the destination chunk to already be
// streamed in (colliders known) — callers run world.update() first. Walks
// an outward ring search for the nearest clear point if the exact spot is
// blocked.
function findClearSpot(x, z) {
  if (!pointBlocked(x, z)) return { x, z };
  const rings = [0.6, 1.2, 1.8, 2.4, 3.2, 4.0, 5.0, 6.0];
  for (const r of rings) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const px = x + Math.cos(ang) * r;
      const pz = z + Math.sin(ang) * r;
      if (!pointBlocked(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z }; // give up (very rare) — still better than refusing to move
}

// Teleport to a random special room (dev menu option 1 — T then 1). Hit it
// again for a different one.
function teleportToRandomRoom() {
  const room = world.randomRoom(camera.position.x, camera.position.z);
  if (!room) return null;
  world.update(room.x, room.z); // stream the chunk in first so colliders are known
  const spot = findClearSpot(room.x, room.z);
  camera.position.set(spot.x, CONFIG.eyeHeight, spot.z);
  world.update(spot.x, spot.z);
  return { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2), theme: room.theme, style: room.style };
}
window.__dbgTeleportRoom = teleportToRandomRoom;

// Teleport to stand in front of a black wall arrow (dev menu option 2).
function teleportToArrow() {
  const arrow = world.findArrow(camera.position.x, camera.position.z);
  if (!arrow) return null;
  world.update(arrow.standX, arrow.standZ);
  const spot = findClearSpot(arrow.standX, arrow.standZ);
  camera.position.set(spot.x, CONFIG.eyeHeight, spot.z);
  player.yaw = arrow.yaw;
  player.pitch = 0;
  camera.rotation.set(0, arrow.yaw, 0);
  world.update(spot.x, spot.z);
  return { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) };
}
window.__dbgTeleportArrow = teleportToArrow;

// Re-roll the world seed and rebuild the map from scratch (dev menu option
// 3), returning the player to the spawn marker since the old position may
// no longer be valid under the new layout.
function resetSeed() {
  world.regenerate(SPAWN_POS.wx, SPAWN_POS.wz);
  camera.position.set(SPAWN_POS.wx, CONFIG.eyeHeight, SPAWN_POS.wz);
  player.yaw = 0;
  player.pitch = 0;
  camera.rotation.set(0, 0, 0);
  return { seed: CONFIG.seed };
}
window.__dbgResetSeed = resetSeed;

// Player/stamina debug hook for verification tooling.
window.__dbgPlayer = () => ({
  locked: player.isLocked,
  stamina: +player.stamina.toFixed(2),
  sprinting: player.sprinting,
  exhausted: player.exhausted,
  yaw: +player.yaw.toFixed(3),
  pitch: +player.pitch.toFixed(3),
});

// Ambient audio. Started on the click gesture (autoplay policy), suspended
// when the player leaves and when the tab is hidden.
const ambience = new Ambience();

// Debug hook for verification tooling.
window.__dbgAudio = () => ({
  state: ambience.ctx ? ambience.ctx.state : "none",
  muted: ambience.muted,
  rms: +ambience.level().toFixed(5),
  lowBandRatio: +ambience.lowBandRatio().toFixed(3),
});

function updateAudioIndicator(flash) {
  if (!audioIndicator) return;
  audioIndicator.textContent = ambience.muted ? "🔇 muted" : "🔊 audio";
  audioIndicator.classList.toggle("muted", ambience.muted);
  if (flash) {
    audioIndicator.classList.add("flash");
    clearTimeout(updateAudioIndicator._t);
    updateAudioIndicator._t = setTimeout(
      () => audioIndicator.classList.remove("flash"),
      1200,
    );
  }
}
updateAudioIndicator(false);

// Stamina bar: fades in while draining/recovering, hidden when full and rested.
function updateStamina() {
  if (!staminaEl || !staminaFill) return;
  staminaFill.style.width = (player.stamina * 100).toFixed(1) + "%";
  const show = player.isLocked && (player.stamina < 0.999 || player.sprinting);
  staminaEl.classList.toggle("visible", show);
  staminaEl.classList.toggle("exhausted", player.exhausted);
}

// Inventory (F). A fixed grid of empty slots for now — there's no item
// pickup system yet, but the panel and its toggle are fully wired up so
// items just need to fill `slots` later. Freezes the player via
// player.setPaused() instead of releasing pointer lock, so it doesn't
// re-trigger the title overlay.
const INVENTORY_SLOTS = 12;
let inventoryOpen = false;
if (inventoryGrid) {
  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const slot = document.createElement("div");
    slot.className = "inv-slot";
    inventoryGrid.appendChild(slot);
  }
}
function setInventoryOpen(open) {
  inventoryOpen = open;
  player.setPaused(open);
  if (inventoryEl) inventoryEl.classList.toggle("open", open);
}
function toggleInventory() {
  setInventoryOpen(!inventoryOpen);
}

// Dev menu (T). Keyboard-driven (1/2/3) rather than clickable — the mouse
// stays pointer-locked (invisible, pinned to centre) while playing, so
// there's nothing for a real cursor to click anyway.
let devMenuOpen = false;
function setDevMenuOpen(open) {
  devMenuOpen = open;
  player.setPaused(open);
  if (devMenuEl) devMenuEl.classList.toggle("open", open);
}
function toggleDevMenu() {
  setDevMenuOpen(!devMenuOpen);
}

// Overlay / pointer-lock wiring. Clicking ends the opening cut-scene and hands
// off to the clean gameplay view.
overlay.addEventListener("click", () => {
  ambience.start(); // must run inside the user gesture
  cutscene.stop();
  player.lock();
});
player.controls.addEventListener("lock", () => {
  overlay.classList.add("hidden");
  ambience.resume();
});
player.controls.addEventListener("unlock", () => {
  overlay.classList.remove("hidden");
  ambience.suspend();
  // Esc releases pointer lock — keep panel state in sync.
  if (inventoryOpen) setInventoryOpen(false);
  if (devMenuOpen) setDevMenuOpen(false);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) ambience.suspend();
  else if (player.isLocked) ambience.resume();
});

// Mute toggle (M) + Feature 04 cut-scene controls.
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") {
    ambience.toggleMute();
    updateAudioIndicator(true);
  }

  // Trigger a scripted in-game reveal cut-scene (C) while playing. It takes
  // over the camera, auto-stops, and returns control to the player.
  if (e.code === "KeyC" && player.isLocked && !cutscene.active && !inventoryOpen && !devMenuOpen) {
    cutscene.startReveal();
  }

  // "Reduce camera motion" accessibility toggle (V) — applies to the opening
  // loop and in-game cut-scenes alike.
  if (e.code === "KeyV") {
    cutscene.setReduceMotion(!cutscene.reduceMotion);
  }

  // Inventory (F).
  if (e.code === "KeyF" && player.isLocked && !cutscene.active && !devMenuOpen) {
    toggleInventory();
  }

  // Dev menu (T): 1 teleport to a random room, 2 teleport to an arrow,
  // 3 reset the seed. T again (or Esc) closes it without picking anything.
  if (e.code === "KeyT" && player.isLocked && !inventoryOpen) {
    toggleDevMenu();
  }
  if (devMenuOpen) {
    if (e.code === "Digit1") {
      teleportToRandomRoom();
      setDevMenuOpen(false);
    } else if (e.code === "Digit2") {
      teleportToArrow();
      setDevMenuOpen(false);
    } else if (e.code === "Digit3") {
      resetSeed();
      setDevMenuOpen(false);
    }
  }

  // Test control: ramp cut-scene distortion calm↔heavy with [ and ].
  if (e.code === "BracketRight") fx.setDistortion(fx.getDistortion() + 0.15);
  if (e.code === "BracketLeft") fx.setDistortion(fx.getDistortion() - 0.15);
});

// Resize.
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fx.setSize(window.innerWidth, window.innerHeight);
});

// Fluorescent flicker: a mostly-steady level with occasional dips/buzz.
function flicker(t) {
  const buzz = 0.97 + Math.sin(t * 90) * 0.015;
  const drop = Math.sin(t * 2.3) * Math.sin(t * 7.7); // slow wander
  const glitch = Math.random() < 0.012 ? 0.55 + Math.random() * 0.25 : 1.0;
  return Math.max(0.35, Math.min(1.1, buzz + drop * 0.05) * glitch);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp on tab refocus
  const t = clock.elapsedTime;

  // During a cut-scene the camera is driven by the cut-scene rig, not the
  // player; otherwise normal first-person movement applies.
  if (cutscene.active) {
    cutscene.update(dt, t);
  } else {
    player.update(dt, world.collidersNear(camera.position.x, camera.position.z));
    cutscene.update(dt, t); // eases the found-FX back to clean after a cut-scene
  }

  // Keep the world streamed around the player.
  world.update(camera.position.x, camera.position.z);

  // Flicker the fluorescents; the sparse fixtures nearest the player get a real
  // point-light, the emissive panels glow, all buzzing together.
  const f = flicker(t);
  materials.lightPanel.emissiveIntensity = f;
  hemi.intensity = 0.4 + f * 0.3;
  updateLights(camera.position.x, camera.position.z, f);

  // Fluorescent hum tracks the same flicker so light and sound buzz together.
  ambience.setFlicker(f);

  updateStamina();

  // Persistent camera framing (REC light + datestamp) while actively playing;
  // a real cut-scene's "active" state takes over the full camcorder HUD.
  if (cutsceneHud) cutsceneHud.classList.toggle("playing", player.isLocked && !cutscene.active);

  fx.setTime(t);
  fx.composer.render();
}

animate();
