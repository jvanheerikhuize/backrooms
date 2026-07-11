// Entry point — wires renderer, scene, world streaming, player, lighting,
// fluorescent flicker and VHS post-processing into a single render loop.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { createMaterials } from "./materials.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { createComposer } from "./postfx.js";
import { Ambience } from "./audio.js";

const canvas = document.getElementById("scene");
const overlay = document.getElementById("overlay");
const audioIndicator = document.getElementById("audio-indicator");

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

// Lighting. Emissive ceiling panels carry the look; these light the geometry.
const hemi = new THREE.HemisphereLight(CONFIG.colors.lightPanel, CONFIG.colors.carpet, 0.55);
scene.add(hemi);

// A point light rides with the player so nearby pillars/walls are lit while
// distance falls off into fog — constant light count regardless of world size.
const playerLight = new THREE.PointLight(CONFIG.colors.lightPanel, 14, CONFIG.fogFar, 1.4);
playerLight.position.set(0, CONFIG.wallHeight - 0.3, 0);
scene.add(playerLight);

// Materials, world, player, post-processing.
const materials = createMaterials();
const world = new World(scene, materials);
const player = new Player(camera, canvas);
scene.add(player.object);
const fx = createComposer(renderer, scene, camera);

// Build the initial chunks around the spawn ("fresh corner").
world.update(0, 0);

// Lightweight debug hook (position readout) for verification tooling.
window.__dbgPos = () => ({
  x: +camera.position.x.toFixed(2),
  z: +camera.position.z.toFixed(2),
  chunks: world.chunks.size,
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

// Overlay / pointer-lock wiring.
overlay.addEventListener("click", () => {
  ambience.start(); // must run inside the user gesture
  player.lock();
});
player.controls.addEventListener("lock", () => {
  overlay.classList.add("hidden");
  ambience.resume();
});
player.controls.addEventListener("unlock", () => {
  overlay.classList.remove("hidden");
  ambience.suspend();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) ambience.suspend();
  else if (player.isLocked) ambience.resume();
});

// Mute toggle (M).
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") {
    ambience.toggleMute();
    updateAudioIndicator(true);
  }
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

  player.update(dt, world.collidersNear(camera.position.x, camera.position.z));

  // Keep the world streamed around the player.
  world.update(camera.position.x, camera.position.z);

  // Player light follows.
  playerLight.position.x = camera.position.x;
  playerLight.position.z = camera.position.z;

  // Flicker the fluorescents (emissive panels + lights together).
  const f = flicker(t);
  materials.lightPanel.emissiveIntensity = f;
  playerLight.intensity = 10 + f * 6;
  hemi.intensity = 0.35 + f * 0.25;

  // Fluorescent hum tracks the same flicker so light and sound buzz together.
  ambience.setFlicker(f);

  fx.setTime(t);
  fx.composer.render();
}

animate();
