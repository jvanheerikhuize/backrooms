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
import { preloadObjects, OBJECT_REGISTRY, getObject } from "./objects.js";
import { preloadSvgProps } from "./svgprops.js";
import { preloadSkins } from "./textures.js";
import { buildStage2Room, STAGE2_POS } from "./stage2.js";
import { buildPropRoom, PROPROOM_POS } from "./proproom.js";
import { WorldPlace, RoomPlace } from "./place.js";
import { EntitySet } from "./entity.js";
import { Npc } from "./npc.js";
import { DevConsole } from "./console.js";

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
const pointsFill = document.getElementById("points-fill");
const inventoryEl = document.getElementById("inventory");
const inventoryGrid = inventoryEl ? inventoryEl.querySelector(".inv-grid") : null;
const inventoryDetail = inventoryEl ? inventoryEl.querySelector(".inv-detail") : null;
const inventoryDetailCanvas = inventoryEl ? inventoryEl.querySelector(".inv-detail-canvas") : null;
const inventoryDetailName = inventoryEl ? inventoryEl.querySelector(".inv-detail-name") : null;
const inventoryDetailDesc = inventoryEl ? inventoryEl.querySelector(".inv-detail-desc") : null;
const hotbarEl = document.getElementById("hotbar");

// Renderer.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Filmic tone mapping, slightly under-exposed. The footage look depends on
// highlights rolling off the way a camcorder's sensor does — a fluorescent
// panel should bloom and clip toward white, not sit there as a flat bright
// rectangle. Linear tone mapping (three's default) can't do that.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

// Scene + fog (fog hides the streaming boundary and sells the endlessness).
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.fog);
scene.fog = new THREE.Fog(CONFIG.colors.fog, CONFIG.fogNear, CONFIG.fogFar);

// Camera.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

// Lighting. Kept deliberately LOW. The fixtures do the work: what sells the
// aesthetic is the contrast between the pool of light under a troffer and the
// gloom between them, and every unit of fill light flattens exactly that. The
// hemisphere and ambient exist only so the gloom is dim rather than pitch black
// (down-facing surfaces like the ceiling get nothing from the hemisphere's sky
// component, so a little flat ambient is layered on top to keep them readable).
const hemi = new THREE.HemisphereLight(CONFIG.colors.lightPanel, CONFIG.colors.carpet, 0.3);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
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
      l.position.set(p.x, CONFIG.wallHeight - 0.9, p.z);
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

// The entities living in the world — NPC presences, items, an audio entity
// (none yet; step 2 is just the plumbing). Updated each frame after the player,
// and the source of the `nearestPresence` proximity signal.
const entities = new EntitySet();

// The first NPC — a wandering presence that lurks near the player in the world.
// Spawned a few metres off the fresh-corner spawn so it's nearby on arrival.
const npc = new Npc(worldPlace, SPAWN_POS.wx + 6, SPAWN_POS.wz + 6);
scene.add(npc.object3D);
entities.add(npc);

// Debug hook: entity count + the current nearest-presence signal.
// Debug hook: is this world point blocked for the player, in the active place?
// Colliders are already padded by the player radius, so a point test IS the
// player test. This exists because a headless browser can't take pointer lock,
// which means a scripted check can't verify the maze by walking it — but it CAN
// flood-fill this, which is a far stronger check anyway: it proves every doorway
// is passable and no room is sealed, rather than sampling one route.
window.__dbgBlocked = (x, z) => {
  for (const c of activePlace.collidersNear(x, z)) {
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
  }
  return false;
};

window.__dbgEntities = () => {
  const near = entities.nearestPresence(camera.position.x, camera.position.z, activePlace);
  return {
    count: entities.list.length,
    nearest: near ? { dist: +near.dist.toFixed(2), x: +near.entity.object3D.position.x.toFixed(1), z: +near.entity.object3D.position.z.toFixed(1) } : null,
  };
};

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
  player.refillPoints();
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

// Which layout profile governs a world point (offices / maze / halls / encounter).
window.__dbgProfileAt = (x, z) => world.profileAt(x, z);

window.__dbgShowDetail = (id) => {
  const entry = OBJECT_REGISTRY.find((e) => e.id === id);
  if (!entry) return false;
  setInventoryOpen(true);
  showItemDetail(entry);
  return true;
};

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

// Points meter: always visible, ticks down over time (see player.js).
function updatePoints() {
  if (!pointsFill) return;
  pointsFill.style.width = (player.points / CONFIG.pointsMax) * 100 + "%";
}

// Debug hooks for verification tooling and for wiring up point-granting
// actions later.
window.__dbgPoints = () => +player.points.toFixed(2);
window.__dbgAddPoints = (amount) => player.addPoints(amount);

// Sanity effects. Full sanity (>= sanityFrayStart) is the normal game with no
// effect; from there down to sanityFrayEnd, film grain and the ambience's
// reactivity (see audio.js's setReactivity — already built for exactly this
// kind of "color the mix" hook) ramp up linearly. Purely cosmetic/aural —
// nothing here dims, fogs, or otherwise changes how well the player can see.
const BASE_GRAIN = 0.12;
function updateSanityEffects() {
  const { sanityFrayStart, sanityFrayEnd, sanityGrainMax, sanityReactivityMax } = CONFIG;
  const t = THREE.MathUtils.clamp((sanityFrayStart - player.points) / (sanityFrayStart - sanityFrayEnd), 0, 1);
  fx.setGrain(BASE_GRAIN + (sanityGrainMax - BASE_GRAIN) * t);
  ambience.setReactivity(sanityReactivityMax * t);
}

// Low sanity (sanityFrayEnd..sanityFlashEnd): every random 3-5 points lost,
// a low-opacity red/grey tint layer (see postfx.js's setTint()) pulses
// twice — a half-second fade in/out right at the start of a sanityFlashSpan
// window, then another half-second pulse right at the end of it, with a
// silent gap in between. Tracks point loss frame-to-frame rather than
// hooking every place points can drop, so it catches decay, damage, whatever
// else later — one seam instead of several. Resets its accumulator if sanity
// leaves the band so it doesn't fire on stale progress from a previous visit.
const RED_TINT = [0.55, 0, 0];
const GREY_TINT = [0.5, 0.5, 0.5];
let sanityFlashLastPoints = player.points;
let sanityFlashAccum = 0;
let sanityFlashNext = CONFIG.sanityFlashLossMin + Math.random() * (CONFIG.sanityFlashLossMax - CONFIG.sanityFlashLossMin);
let sanityFlashElapsed = Infinity; // >= sanityFlashSpan means no event active
let sanityFlashColor = RED_TINT;
function updateSanityFlash(dt) {
  const {
    sanityFrayEnd,
    sanityFlashEnd,
    sanityFlashLossMin,
    sanityFlashLossMax,
    sanityFlashSpan,
    sanityFlashPulseLen,
    sanityFlashMaxOpacity,
  } = CONFIG;
  const inBand = player.points < sanityFrayEnd && player.points >= sanityFlashEnd;
  const lost = sanityFlashLastPoints - player.points;
  sanityFlashLastPoints = player.points;

  if (inBand && lost > 0) {
    sanityFlashAccum += lost;
  } else if (!inBand) {
    sanityFlashAccum = 0;
  }
  // Only start a new event once the current one has fully played out, so
  // pulses never overlap.
  if (sanityFlashAccum >= sanityFlashNext && sanityFlashElapsed >= sanityFlashSpan) {
    sanityFlashAccum = 0;
    sanityFlashNext = sanityFlashLossMin + Math.random() * (sanityFlashLossMax - sanityFlashLossMin);
    sanityFlashColor = Math.random() < 0.5 ? RED_TINT : GREY_TINT;
    sanityFlashElapsed = 0;
  }

  if (sanityFlashElapsed < sanityFlashSpan) {
    sanityFlashElapsed += dt;
    // A smooth 0→1→0 bump across each pulse window (sin(pi*x) for x in 0..1).
    let amt = 0;
    if (sanityFlashElapsed < sanityFlashPulseLen) {
      amt = Math.sin(Math.PI * (sanityFlashElapsed / sanityFlashPulseLen));
    } else if (sanityFlashElapsed >= sanityFlashSpan - sanityFlashPulseLen) {
      const localT = (sanityFlashElapsed - (sanityFlashSpan - sanityFlashPulseLen)) / sanityFlashPulseLen;
      amt = Math.sin(Math.PI * localT);
    }
    fx.setTint(sanityFlashColor, Math.max(0, amt) * sanityFlashMaxOpacity);
  }
}
window.__dbgSanityFlash = () => ({
  elapsed: +sanityFlashElapsed.toFixed(2),
  color: sanityFlashColor === RED_TINT ? "red" : "grey",
  accum: +sanityFlashAccum.toFixed(2),
  next: +sanityFlashNext.toFixed(2),
  tint: fx.getTint(),
});

// Inventory (F) + hotbar. Both are grids of slots holding the SAME kind of
// item (an objects.js registry entry) backed by plain arrays — inventorySlots
// / hotbarSlots — with items freely draggable between (or within) either
// grid; see wireSlotDragDrop(). There's no full pickup system yet (nothing
// spawns new items in the world), but the slots, drag-and-drop, and
// click-to-inspect are all fully wired up for whenever that lands.
//
// Freezes the player via player.setPaused(); pointer lock is deliberately
// released too (see setInventoryOpen) so the cursor is free to drag things,
// without falling back to the title-overlay/paused state that a normal
// Esc-driven unlock triggers.
//
// The player starts with one Almond Water (goal.md §6.5 — Object 1, the
// canonical thing keeping wanderers alive), a random flavour of whichever
// three are registered (see objects.js's "almond-water" group), in the first
// inventory slot. A filled slot gets a static three.js preview (own
// scene/camera/renderer sharing the cached, already-loaded model) instead of
// a text label, and clicking it opens a bigger version + a description
// beside the inventory grid.
const INVENTORY_SLOTS = 12;
// Hotbar slot count is also baked into style.css's #points/#stamina
// positioning math (they sit above its left/right edges).
const HOTBAR_SLOTS = 5;
let inventoryOpen = false;

const inventorySlots = new Array(INVENTORY_SLOTS).fill(null); // registry entry, or null
const hotbarSlots = new Array(HOTBAR_SLOTS).fill(null);
const inventorySlotEls = [];
const hotbarSlotEls = [];
const inventorySlotRenderers = new Array(INVENTORY_SLOTS).fill(null); // this slot's own preview renderer, if any
const hotbarSlotRenderers = new Array(HOTBAR_SLOTS).fill(null);

// Renders one static (non-animated), front-on view of a cached model into
// `canvas` at `size` px — shared by the small slot icons and the bigger
// click-to-inspect detail view. Returns the renderer so the caller can
// dispose() it later if the canvas gets reused for a different item.
function renderItemPreview(canvas, cached, size, rotationY = -Math.PI / 3) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 5);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x33301a, 1.3));
  const dir = new THREE.DirectionalLight(0xfff6cf, 1.5);
  dir.position.set(1, 2, 1.5);
  scene.add(dir);
  const mesh = cached.object3D.clone();
  // A fixed slight turn (no auto-spin) — the model's default orientation
  // doesn't face its printed label straight at the camera, so a dead-on shot
  // reads as a blank curve. This is just enough to catch the artwork.
  mesh.rotation.y = rotationY;
  // normalize() centres the model's UNROTATED bounding box, but some models
  // (e.g. the almond water cans) aren't radially symmetric around their own
  // pivot — a raised label/seam sits at a different angle per model, so the
  // same fixed rotationY leaves the ROTATED box off-centre by a different
  // amount for each one. Re-centre on X/Z using the box as rotated, so every
  // item frames the same regardless of where its geometry's pivot really is.
  mesh.updateMatrixWorld(true);
  const rotatedBox = new THREE.Box3().setFromObject(mesh);
  mesh.position.x -= (rotatedBox.max.x + rotatedBox.min.x) / 2;
  mesh.position.z -= (rotatedBox.max.z + rotatedBox.min.z) / 2;
  scene.add(mesh);

  // The model is normalised to rest on Y=0 with a known height — frame it
  // from slightly above.
  const h = cached.height ?? 0.3;
  camera.position.set(0, h * 0.55, h * 1.7);
  camera.lookAt(0, h * 0.45, 0);

  renderer.render(scene, camera);
  return renderer;
}

// Click-to-inspect: a bigger static preview + description beside the grid.
// Clicking the same item's slot again toggles it closed. Works from either
// the inventory grid or the hotbar.
let detailRenderer = null;
let detailItemId = null;
function showItemDetail(entry) {
  if (!inventoryDetail) return;
  if (detailItemId === entry.id && inventoryDetail.classList.contains("open")) {
    inventoryDetail.classList.remove("open");
    detailItemId = null;
    return;
  }
  const cached = getObject(entry.id);
  if (!cached) return; // model not loaded yet — nothing to show
  if (detailRenderer) detailRenderer.dispose();
  detailRenderer = renderItemPreview(inventoryDetailCanvas, cached, 160);
  if (inventoryDetailName) inventoryDetailName.textContent = `Almond Water — ${entry.flavor}`;
  if (inventoryDetailDesc) {
    inventoryDetailDesc.textContent =
      "Tastes the same no matter what the label says. The one thing that's kept wanderers going down here longer than anything else.";
  }
  inventoryDetail.classList.add("open");
  detailItemId = entry.id;
}

// Updates one slot's backing array entry AND its visual content to match —
// the only place either should change, so they can never drift apart.
// Disposes that slot's previous preview renderer first (each slot gets its
// own WebGLRenderer/canvas; leaving old ones behind after every drag would
// leak GPU contexts, and browsers cap how many a page can have open).
function setSlot(kind, index, item) {
  const items = kind === "hotbar" ? hotbarSlots : inventorySlots;
  const els = kind === "hotbar" ? hotbarSlotEls : inventorySlotEls;
  const renderers = kind === "hotbar" ? hotbarSlotRenderers : inventorySlotRenderers;
  items[index] = item;

  if (renderers[index]) {
    renderers[index].dispose();
    renderers[index] = null;
  }
  const slotEl = els[index];
  slotEl.classList.toggle("filled", !!item);
  slotEl.draggable = !!item;
  slotEl.title = item ? item.label : "";
  slotEl.replaceChildren(); // drop any previous preview canvas (the hotkey numeral is a ::after, unaffected)
  if (!item) return;

  const canvas = document.createElement("canvas");
  canvas.className = "inv-item-canvas";
  slotEl.appendChild(canvas);
  preloadObjects().then(() => {
    const cached = getObject(item.id);
    if (!cached) return; // failed to load — slot just stays a plain highlighted box
    renderers[index] = renderItemPreview(canvas, cached, 48);
  });
}

// Drag-and-drop between (or within) the inventory grid and the hotbar — a
// full swap, so dragging onto an occupied slot trades places rather than
// overwriting/losing the item that was there. `dragSource` is simpler than
// threading state through DataTransfer for a same-page, same-tab drag.
let dragSource = null; // { kind, index } of the slot currently being dragged
function wireSlotDragDrop(slotEl, kind, index) {
  const items = () => (kind === "hotbar" ? hotbarSlots : inventorySlots);

  slotEl.addEventListener("dragstart", (e) => {
    if (!items()[index]) {
      e.preventDefault(); // nothing to pick up
      return;
    }
    dragSource = { kind, index };
    slotEl.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  slotEl.addEventListener("dragend", () => {
    slotEl.classList.remove("dragging");
    dragSource = null;
  });
  slotEl.addEventListener("dragover", (e) => {
    e.preventDefault(); // required for this element to be a valid drop target
    slotEl.classList.add("drag-over");
  });
  slotEl.addEventListener("dragleave", () => slotEl.classList.remove("drag-over"));
  slotEl.addEventListener("drop", (e) => {
    e.preventDefault();
    slotEl.classList.remove("drag-over");
    if (!dragSource) return;
    if (dragSource.kind === kind && dragSource.index === index) return; // dropped on itself
    const srcItems = dragSource.kind === "hotbar" ? hotbarSlots : inventorySlots;
    const srcItem = srcItems[dragSource.index];
    const dstItem = items()[index];
    setSlot(dragSource.kind, dragSource.index, dstItem); // swap — dstItem may be null, that's fine
    setSlot(kind, index, srcItem);
    dragSource = null;
  });
}

function buildSlotGrid(container, count, className, kind, slotEls) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const slot = document.createElement("div");
    slot.className = className;
    if (kind === "hotbar") slot.dataset.key = i + 1; // hotkey numeral, bottom-right (see style.css)
    container.appendChild(slot);
    slotEls.push(slot);
    wireSlotDragDrop(slot, kind, i);
    slot.addEventListener("click", () => {
      const item = (kind === "hotbar" ? hotbarSlots : inventorySlots)[i];
      if (item) showItemDetail(item);
    });
  }
}
buildSlotGrid(inventoryGrid, INVENTORY_SLOTS, "inv-slot", "inventory", inventorySlotEls);
buildSlotGrid(hotbarEl, HOTBAR_SLOTS, "hotbar-slot", "hotbar", hotbarSlotEls);

const almondFlavors = OBJECT_REGISTRY.filter((e) => e.group === "almond-water");
const startingItem = almondFlavors[Math.floor(Math.random() * almondFlavors.length)];
if (startingItem && inventorySlotEls.length) setSlot("inventory", 0, startingItem);

// Releasing/reacquiring pointer lock for the inventory panel would otherwise
// trip the same "unlock" handler that shows the title overlay on a real Esc
// (see below) — this flag tells that handler "this one's expected, skip the
// overlay/audio/auto-close side effects".
let selfInitiatedUnlock = false;
function setInventoryOpen(open) {
  inventoryOpen = open;
  player.setPaused(open);
  if (inventoryEl) inventoryEl.classList.toggle("open", open);
  // The hotbar is always visible but normally pointer-events:none (so it
  // never blocks world clicks under normal locked gameplay, where there's no
  // free cursor to interact with it anyway) — only make it a real drag/click
  // target while the inventory is open alongside it.
  if (hotbarEl) hotbarEl.classList.toggle("interactive", open);
  if (open) {
    // Always set the flag and call exitPointerLock unconditionally — gating
    // on document.pointerLockElement first is racy (it doesn't always
    // reflect the true lock state at this exact synchronous instant), and
    // exitPointerLock() is a harmless no-op if nothing is locked anyway.
    selfInitiatedUnlock = true;
    document.exitPointerLock();
  } else {
    selfInitiatedUnlock = false; // clear any stale flag from a lock that never actually released
    if (inventoryDetail) {
      inventoryDetail.classList.remove("open");
      detailItemId = null;
    }
  }
}
function toggleInventory() {
  const opening = !inventoryOpen;
  setInventoryOpen(opening);
  if (!opening) player.lock(); // closing via F resumes mouse-look immediately
}

// ── Developer console (~) ────────────────────────────────────────────────
// Replaces the old numbered dev menu: every dev action is a typed command.
// Opening it pauses the player (so typing can't move you) and the console
// captures all keys while open (see console.js).
let noclip = false;
const baseWalk = CONFIG.walkSpeed;
const baseRun = CONFIG.runSpeed;
let savedFog = null;
let fullbright = false;

const devConsole = new DevConsole({
  onOpen: () => player.setPaused(true),
  onClose: () => player.setPaused(false),
});

devConsole
  .register("pos", "print position / zone / counts", () => {
    const p = window.__dbgPos();
    return `x ${p.x}  z ${p.z}  zone ${p.zone}  chunks ${p.chunks}  lights ${p.litNow}/${p.lights}`;
  })
  .register("tp", "teleport to <x> <z>", (a) => {
    const x = parseFloat(a[0]);
    const z = parseFloat(a[1]);
    if (Number.isNaN(x) || Number.isNaN(z)) return "usage: tp <x> <z>";
    world.update(x, z);
    const spot = findClearSpot(x, z) ?? { x, z };
    camera.position.set(spot.x, CONFIG.eyeHeight, spot.z);
    world.update(spot.x, spot.z);
    return `→ ${spot.x.toFixed(1)}, ${spot.z.toFixed(1)}`;
  })
  .register("home", "teleport back to spawn", () => {
    camera.position.set(SPAWN_POS.wx, CONFIG.eyeHeight, SPAWN_POS.wz);
    world.update(SPAWN_POS.wx, SPAWN_POS.wz);
    return "→ spawn";
  })
  .register("room", "teleport to a random special room", () => {
    const r = teleportToRandomRoom();
    return r ? `→ ${r.theme}/${r.style} @ ${r.x}, ${r.z}` : "no room found";
  })
  .register("arrow", "teleport in front of a wall arrow", () => {
    const r = teleportToArrow();
    return r ? `→ ${r.x}, ${r.z}` : "no clear arrow found";
  })
  .register("seed", "print seed · `seed <n>` / `seed new` rebuilds", (a) => {
    if (!a.length) return `seed ${CONFIG.seed}`;
    const specific = a[0] !== "new";
    if (specific && Number.isNaN(parseInt(a[0], 10))) return "usage: seed [<n>|new]";
    world.regenerate(SPAWN_POS.wx, SPAWN_POS.wz, specific ? parseInt(a[0], 10) >>> 0 : undefined);
    camera.position.set(SPAWN_POS.wx, CONFIG.eyeHeight, SPAWN_POS.wz);
    player.yaw = 0;
    player.pitch = 0;
    camera.rotation.set(0, 0, 0);
    seedStartElapsed = clock.getElapsedTime();
    return `seed ${CONFIG.seed} — rebuilt`;
  })
  .register("stage2", "toggle Stage 2", () => `stage2 ${toggleStage2().inStage2 ? "on" : "off"}`)
  .register("proproom", "toggle the Prop Room", () => {
    const r = togglePropRoom();
    return `proproom ${r.inPropRoom ? `on (${r.props} props)` : "off"}`;
  })
  .register("spawn", "spawn <n> NPC presences near you (default 1)", (a) => {
    const n = Math.max(1, Math.min(20, parseInt(a[0], 10) || 1));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 6;
      const e = new Npc(worldPlace, camera.position.x + Math.cos(ang) * r, camera.position.z + Math.sin(ang) * r);
      scene.add(e.object3D);
      entities.add(e);
    }
    return `spawned ${n} (total ${entities.list.filter((e) => e instanceof Npc).length})`;
  })
  .register("ents", "entity count + nearest presence", () => {
    const e = window.__dbgEntities();
    return `entities ${e.count}  nearest ${e.nearest ? e.nearest.dist + "m" : "—"}`;
  })
  .register("clearnpc", "remove all NPCs", () => {
    const npcs = entities.list.filter((e) => e instanceof Npc);
    for (const e of npcs) {
      scene.remove(e.object3D);
      entities.remove(e);
    }
    return `removed ${npcs.length}`;
  })
  .register("noclip", "toggle walking through walls", () => {
    noclip = !noclip;
    return `noclip ${noclip ? "on" : "off"}`;
  })
  .register("speed", "movement speed multiplier (`speed` resets)", (a) => {
    const m = a.length ? parseFloat(a[0]) : 1;
    if (Number.isNaN(m) || m <= 0) return "usage: speed <multiplier>";
    CONFIG.walkSpeed = baseWalk * m;
    CONFIG.runSpeed = baseRun * m;
    return `speed x${m}`;
  })
  .register("fullbright", "toggle flat bright lighting", () => {
    fullbright = !fullbright;
    ambient.intensity = fullbright ? 2.6 : 0.2;
    return `fullbright ${fullbright ? "on" : "off"}`;
  })
  .register("fog", "toggle distance fog", () => {
    if (scene.fog) {
      savedFog = scene.fog;
      scene.fog = null;
      return "fog off";
    }
    scene.fog = savedFog;
    return "fog on";
  })
  .register("sanity", `set the sanity/points meter (0-${CONFIG.pointsMax})`, (a) => {
    const n = parseFloat(a[0]);
    if (Number.isNaN(n)) return `usage: sanity <0-${CONFIG.pointsMax}>`;
    player.points = THREE.MathUtils.clamp(n, 0, CONFIG.pointsMax);
    player._pointsTimer = 0;
    return `sanity ${player.points}`;
  });

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
  if (selfInitiatedUnlock) {
    // Opening the inventory (setInventoryOpen) released the lock on purpose —
    // stay in the paused-but-playing state, not the title-overlay one.
    selfInitiatedUnlock = false;
    return;
  }
  overlay.classList.remove("hidden");
  ambience.suspend();
  // Esc releases pointer lock — keep panel state in sync.
  if (inventoryOpen) setInventoryOpen(false);
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
  if (e.code === "KeyC" && player.isLocked && !cutscene.active && !inventoryOpen) {
    cutscene.startReveal();
  }

  // "Reduce camera motion" accessibility toggle (V) — applies to the opening
  // loop and in-game cut-scenes alike.
  if (e.code === "KeyV") {
    cutscene.setReduceMotion(!cutscene.reduceMotion);
  }

  // Inventory (F). Allowed to close even while unlocked — opening it releases
  // the pointer on purpose (see setInventoryOpen), so player.isLocked is
  // false the whole time it's open.
  if (e.code === "KeyF" && (player.isLocked || inventoryOpen) && !cutscene.active) {
    toggleInventory();
  }

  // (Dev actions live in the tilde console now — see DevConsole above.)

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
    const colliders = noclip ? [] : activePlace.collidersNear(camera.position.x, camera.position.z);
    player.update(dt, colliders);
    cutscene.update(dt, t); // eases the found-FX back to clean after a cut-scene
  }

  // Keep the active place streamed around the player — the world streams chunks;
  // the fixed dev rooms are a no-op here.
  activePlace.stream(camera.position.x, camera.position.z);

  // Update the entity layer (proximity signal + each entity). A no-op today —
  // there are no entities yet — but this is where NPCs/items/audio plug in.
  entities.update(dt, {
    dt,
    time: t,
    player,
    place: activePlace,
    focus: { x: camera.position.x, z: camera.position.z },
    entities,
  });

  // Flicker the fluorescents; the sparse fixtures nearest the player get a real
  // point-light, the emissive panels glow, all buzzing together.
  const f = flicker(t);
  materials.lightPanel.emissiveIntensity = f;
  hemi.intensity = 0.2 + f * 0.14;
  updateLights(camera.position.x, camera.position.z, f);

  updateStamina();
  updatePoints();
  updateSanityEffects();
  updateSanityFlash(dt);

  // Fluorescent hum tracks the same flicker so light and sound buzz together.
  ambience.setFlicker(f);

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
