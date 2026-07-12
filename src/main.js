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
import { preloadObjects } from "./objects.js";
import { preloadSvgProps } from "./svgprops.js";
import { preloadSkins } from "./textures.js";
import { buildStage2Room, STAGE2_POS } from "./stage2.js";
import { buildPropRoom, PROPROOM_POS } from "./proproom.js";
import { WorldPlace, RoomPlace } from "./place.js";

// Kick the STL model fetches off immediately so they load in parallel with
// the synchronous setup below; awaited just before the first world.update()
// call, which is the first point anything actually needs them ready.
const objectsReady = Promise.all([preloadObjects(), preloadSvgProps(), preloadSkins()]);

const canvas = document.getElementById("scene");
const overlay = document.getElementById("overlay");
const audioIndicator = document.getElementById("audio-indicator");
const cutsceneHud = document.getElementById("cutscene-hud");
const ccStamp = cutsceneHud ? cutsceneHud.querySelector(".cc-stamp") : null;
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
// Not parented to any scene: the camera has no children, so leaving it
// unparented lets the renderer auto-update its matrixWorld regardless of
// which scene (main/Stage 2/Prop Room) is actually being rendered this frame
// — parenting it to one scene would leave it stale while another renders.
const fx = createComposer(renderer, scene, camera);

// Stage 2 and the Prop Room each live in their OWN THREE.Scene — a genuinely
// separate "dimension", not just a room parked far away in the main scene's
// coordinate space (the old approach; see stage2.js/proproom.js). Reachable
// only via the dev menu, which swaps the renderer over to the relevant scene
// and swaps player collision to that scene's own fixed collider set.
const stage2Scene = new THREE.Scene();
// Neutral dark grey, not the main game's warm fog colour — keeps the tinting
// consistent with Stage 2's own neutral-white lighting (see stage2.js), so
// the concrete walls read as grey instead of washing back toward yellow.
stage2Scene.background = new THREE.Color(0x0e0e0e);
// No fog here (unlike the main game) — Stage 2 is meant to be fully lit
// across its whole area rather than fading to darkness at a distance.
const stage2 = buildStage2Room(materials);
stage2Scene.add(stage2.group);

// Prop Room — dev-only test chamber holding one of every registered prop.
// Built lazily on first entry (see its `build`) so the model/SVG caches are warm.
const propRoomScene = new THREE.Scene();
propRoomScene.background = new THREE.Color(CONFIG.colors.fog);
propRoomScene.fog = new THREE.Fog(CONFIG.colors.fog, CONFIG.fogNear, CONFIG.fogFar);

// The three places you can be in. `activePlace` replaces the old
// inStage2/inPropRoom flags; goTo() (below) switches between them.
const worldPlace = new WorldPlace({ id: "world", scene, spawn: SPAWN_POS, world });
const stage2Place = new RoomPlace({
  id: "stage2",
  scene: stage2Scene,
  spawn: STAGE2_POS,
  vignette: 0,
  mutesBed: true,
  colliders: stage2.colliders,
});
const propRoomPlace = new RoomPlace({
  id: "propRoom",
  scene: propRoomScene,
  spawn: PROPROOM_POS,
  build: () => buildPropRoom(materials),
  // Arrive at the south edge looking north, so the whole grid of props (and the
  // signs on the far wall) is laid out ahead of you.
  placeCamera: (cam, place) =>
    cam.position.set(PROPROOM_POS.wx, CONFIG.eyeHeight, PROPROOM_POS.wz + place.room.size / 2 - 1.3),
});
let activePlace = worldPlace;

// Switch to a place: render its scene, apply its vignette + audio bed, spawn the
// camera there, and stream it (the world streams; fixed rooms don't). One code
// path for every transition — replaces the scattered inStage2/inPropRoom logic.
function goTo(place) {
  place.ensureBuilt();
  activePlace = place;
  fx.setScene(place.scene);
  fx.setVignette(place.vignette);
  ambience[place.mutesBed ? "muteBed" : "unmuteBed"]();
  player.yaw = 0;
  player.pitch = 0;
  camera.rotation.set(0, 0, 0);
  place.placeCamera(camera);
  place.stream(camera.position.x, camera.position.z);
}

// Building chunks (world.update) is deferred until objectsReady resolves —
// see the bottom of this file — so no room's deterministic prop rng stream
// can desync between a chunk built while the STL fetch was still in flight
// and a later rebuild after it's warm.

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
// blocked. Returns null (instead of silently accepting a still-blocked
// point) if nothing clear turns up within the search radius — a sign the
// target is in a genuinely cramped/walled-in spot, which callers should
// treat as "try somewhere else", not "teleport there anyway".
function findClearSpot(x, z) {
  if (!pointBlocked(x, z)) return { x, z };
  const rings = [0.6, 1.2, 1.8, 2.4, 3.2, 4.0, 5.0, 6.0, 7.5, 9.0];
  for (const r of rings) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const px = x + Math.cos(ang) * r;
      const pz = z + Math.sin(ang) * r;
      if (!pointBlocked(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

// Teleport to a random special room (dev menu option 1 — T then 1). Hit it
// again for a different one. Rooms are guaranteed enterable and never
// sealed off (see rooms.js's escape corridor), so a clear landing spot
// should always exist within the search radius; the room's own centre is
// used as a last-resort fallback in the vanishingly rare case it doesn't.
function teleportToRandomRoom() {
  const room = world.randomRoom(camera.position.x, camera.position.z);
  if (!room) return null;
  world.update(room.x, room.z); // stream the chunk in first so colliders are known
  const spot = findClearSpot(room.x, room.z) ?? { x: room.x, z: room.z };
  camera.position.set(spot.x, CONFIG.eyeHeight, spot.z);
  world.update(spot.x, spot.z);
  return { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2), theme: room.theme, style: room.style };
}
window.__dbgTeleportRoom = teleportToRandomRoom;

// Teleport to stand in front of a black wall arrow (dev menu option 2).
// Unlike rooms, ordinary maze walls have no enclosure guarantee — an arrow
// can end up on the wall of a small pocket the surrounding maze happened to
// box in. Rather than trust the first randomly-picked arrow, this tries up
// to 8 distinct known arrows (shuffled) and picks the first whose landing
// spot is already clear or only needed a small nudge — a spot that needed a
// big search is exactly the "cramped/enclosed" case to avoid.
function teleportToArrow() {
  world.randomArrow(camera.position.x, camera.position.z); // make sure a pool of arrows is known
  const pool = [...world.arrows];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const arrow of pool.slice(0, 8)) {
    world.update(arrow.standX, arrow.standZ);
    const spot = findClearSpot(arrow.standX, arrow.standZ);
    if (!spot) continue; // nothing clear within the search radius at all — definitely skip
    const dist = Math.hypot(spot.x - arrow.standX, spot.z - arrow.standZ);
    if (dist > 2.5) continue; // needed a big nudge — likely a cramped pocket, try another arrow
    camera.position.set(spot.x, CONFIG.eyeHeight, spot.z);
    player.yaw = arrow.yaw;
    player.pitch = 0;
    camera.rotation.set(0, arrow.yaw, 0);
    world.update(spot.x, spot.z);
    return { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2) };
  }
  return null; // every sampled arrow was in a cramped spot — extremely rare
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
  seedStartElapsed = clock.getElapsedTime(); // the bottom-left stamp restarts from 00:00:00
  return { seed: CONFIG.seed };
}
window.__dbgResetSeed = resetSeed;

// Dev menu option 4 — jump to Stage 2, or back to Stage 1 if already there.
// Stage 2 lives in its own scene (see the stage2Scene setup above), so
// entering it swaps the renderer over to that scene, parks the camera at its
// local origin, switches player collision to its own small fixed collider
// set, and drops the ambient "static" bed (see stage2.js/audio.js); leaving
// reverses all of that and resumes normal world streaming from the spawn marker.
function toggleStage2() {
  goTo(activePlace === stage2Place ? worldPlace : stage2Place);
  return { inStage2: activePlace === stage2Place };
}
window.__dbgToggleStage2 = toggleStage2;

// Dev menu option 5 — jump to the Prop Room (every registered prop laid out for
// inspection), or back to spawn if already there. Built on first entry, into
// its own scene (see the propRoomScene setup above).
function togglePropRoom() {
  goTo(activePlace === propRoomPlace ? worldPlace : propRoomPlace);
  return { inPropRoom: activePlace === propRoomPlace, props: propRoomPlace.room?.count };
}
window.__dbgTogglePropRoom = togglePropRoom;

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
  // 3 reset the seed, 4 toggle Stage 2. T again (or Esc) closes it without
  // picking anything.
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
    } else if (e.code === "Digit4") {
      toggleStage2();
      setDevMenuOpen(false);
    } else if (e.code === "Digit5") {
      togglePropRoom();
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
let seedStartElapsed = 0; // clock.elapsedTime when the current seed started — the bottom-left stamp counts up from here
let lastStampSecond = -1; // avoid rewriting the DOM every frame — only when the displayed second actually changes

function formatStamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp on tab refocus
  const t = clock.elapsedTime;

  // Bottom-left camcorder stamp: a running "how long on this seed" clock,
  // 00:00:00 at seed start (initial load or a dev-menu reset).
  const playSeconds = Math.floor(t - seedStartElapsed);
  if (ccStamp && playSeconds !== lastStampSecond) {
    lastStampSecond = playSeconds;
    ccStamp.textContent = `▶ ${formatStamp(playSeconds)}`;
  }

  // During a cut-scene the camera is driven by the cut-scene rig, not the
  // player; otherwise normal first-person movement applies. In Stage 2,
  // collision comes from its own small fixed set instead of the procedural
  // world's streamed colliders.
  if (cutscene.active) {
    cutscene.update(dt, t);
  } else {
    const colliders = activePlace.collidersNear(camera.position.x, camera.position.z);
    player.update(dt, colliders);
    cutscene.update(dt, t); // eases the found-FX back to clean after a cut-scene
  }

  // Keep the active place streamed around the player — the world streams chunks;
  // the fixed dev rooms are a no-op here.
  activePlace.stream(camera.position.x, camera.position.z);

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

// Wait for the STL model cache before the first world.update() (initial or
// per-frame) — see the note near the top of the file for why this matters
// for room-prop determinism. These are tiny local files, so in practice
// this resolves within a frame or two; the opening cut-scene's own visuals
// don't start rendering until animate() begins either way.
objectsReady.then(() => {
  world.update(SPAWN_POS.wx, SPAWN_POS.wz);
  animate();
});
