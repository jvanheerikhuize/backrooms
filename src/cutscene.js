// Feature 04 — Found-Footage Camera (cut-scene layer).
//
// Gameplay runs a clean camera. When the game takes control for a *cut-scene*
// — the opening title loop, or a scripted in-game reveal — this module takes
// over the camera, ramps the found-footage post FX up, drives a handheld
// bob/sway rig, and shows the camcorder HUD (blinking REC + a frozen "found"
// timestamp). When the cut-scene ends, control and a clean view hand back.
//
// Two modes:
//   * "opening"  — a slow handheld drift down the corridor behind the title,
//                  loops until the player clicks to start.
//   * "reveal"   — a short scripted in-game beat; auto-stops after its duration
//                  and returns control to the player.

import * as THREE from "three";
import { CONFIG } from "./config.js";

// The camcorder HUD shows a frozen, uncanny "found tape" datestamp (see
// index.html #cutscene-hud) — decided over a live clock so the footage reads as
// old recovered material.

const REVEAL_DURATION = 5.5; // seconds a "reveal" cut-scene runs before ending

export class Cutscene {
  constructor(camera, fx, world, hudEl) {
    this.camera = camera;
    this.fx = fx;
    this.world = world;
    this.hud = hudEl;

    this.active = false;
    this.mode = null;
    this.elapsed = 0;

    // Found-FX master, eased toward a target so entering/leaving a cut-scene
    // fades rather than snaps.
    this.found = 0;
    this.foundTarget = 0;

    // Drift heading for the opening walk (radians; 0 looks down -Z).
    this.yaw = 0;
    this.driftPos = new THREE.Vector3();

    // Accessibility: capped bob by default, further damped when reduced.
    this.reduceMotion = false;

    this._dir = new THREE.Vector3();
    this._onEnd = null;
  }

  setReduceMotion(v) {
    this.reduceMotion = v;
  }

  // Start the looping opening cut-scene (title screen background).
  startOpening() {
    this._begin("opening");
    this.yaw = 0;
    this.driftPos.set(0, CONFIG.eyeHeight, 0);
  }

  // Start a short scripted in-game reveal. `onEnd` fires when it auto-stops.
  startReveal(onEnd) {
    this._begin("reveal");
    this._onEnd = onEnd || null;
    // Reveal keeps the player where they stand; drift rig anchors to the camera.
    this.driftPos.copy(this.camera.position);
    this.yaw = this.camera.rotation.y;
  }

  _begin(mode) {
    this.active = true;
    this.mode = mode;
    this.elapsed = 0;
    this.foundTarget = 1;
    if (this.hud) this.hud.classList.add("active");
  }

  stop() {
    this.active = false;
    this.mode = null;
    this.foundTarget = 0;
    this._onEnd = null;
    this.fx.setDropout(0);
    if (this.hud) this.hud.classList.remove("active");
  }

  // Advance the cut-scene. Safe to call every frame; when inactive it only
  // eases the found-FX back down so the hand-off to gameplay is smooth.
  update(dt, t) {
    // Ease the found-footage master toward its target either way.
    const k = Math.min(1, dt * 3.5);
    this.found += (this.foundTarget - this.found) * k;
    this.fx.setFound(this.found);

    if (!this.active) {
      if (this.found < 0.01) this.fx.setDropout(0);
      return;
    }

    this.elapsed += dt;

    // Distortion ramp: reveals build from calm to heavy across their run;
    // the opening holds at the moderate default.
    if (this.mode === "reveal") {
      const p = Math.min(1, this.elapsed / REVEAL_DURATION);
      this.fx.setDistortion(0.35 + p * 0.6);
    }

    // Random signal-dropout bursts, more likely as distortion rises.
    const heat = this.fx.getDistortion();
    if (Math.random() < 0.006 + heat * 0.01) {
      this._dropUntil = t + 0.05 + Math.random() * 0.12;
    }
    this.fx.setDropout(this._dropUntil && t < this._dropUntil ? 0.6 + heat * 0.3 : 0);

    if (this.mode === "opening") this._driveOpening(dt, t);
    else this._driveReveal(dt, t);

    // End a reveal on schedule and hand control back.
    if (this.mode === "reveal" && this.elapsed >= REVEAL_DURATION) {
      const cb = this._onEnd;
      this.stop();
      if (cb) cb();
    }
  }

  // Slow handheld walk down the corridor, turning away from walls, with the
  // camera bobbing/swaying as if held by someone filming.
  _driveOpening(dt, t) {
    const speed = 1.1; // m/s — an unhurried wander

    // Horizontal forward from the current heading.
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);

    const colliders = this.world.collidersNear(this.driftPos.x, this.driftPos.z);
    const nx = this.driftPos.x + fx * speed * dt;
    const nz = this.driftPos.z + fz * speed * dt;

    let walking = true;
    if (this._blocked(nx, nz, colliders)) {
      // Hit something — pan the camera toward a new heading instead of walking.
      this.yaw += 1.5 * dt; // gentle turn until the way ahead is clear
      walking = false;
    } else {
      this.driftPos.x = nx;
      this.driftPos.z = nz;
      // Occasionally drift the heading so the walk meanders rather than tracks
      // a perfect line.
      this.yaw += Math.sin(t * 0.3) * 0.15 * dt;
    }

    this._applyHandheld(t, walking ? 1 : 0.4);
  }

  // Reveal: camera stays put; a jittery, searching handheld look-around.
  _driveReveal(dt, t) {
    this._applyHandheld(t, 0.7);
  }

  // Write camera position/rotation from the drift rig plus a handheld
  // bob/sway offset. `gait` scales the bob (1 walking, less when paused).
  _applyHandheld(t, gait) {
    const cap = this.reduceMotion ? 0.22 : 1.0; // motion-sickness guard
    const bob = 0.045 * gait * cap;
    const sway = 0.03 * gait * cap;

    // Positional bob (a person's footfalls) + tiny lateral shift.
    const y = CONFIG.eyeHeight + Math.sin(t * 6.0) * bob;
    const lateral = Math.sin(t * 3.0) * sway;

    // Strafe offset perpendicular to heading for the lateral sway.
    const rx = -Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);

    this.camera.position.set(
      this.driftPos.x + rx * lateral,
      y,
      this.driftPos.z + rz * lateral,
    );

    // Rotational sway/drift — a slow searching look plus a fast micro-jitter.
    const yawSway = Math.sin(t * 0.7) * 0.08 * cap + Math.sin(t * 5.3) * 0.006 * cap;
    const pitchSway = Math.sin(t * 0.9 + 1.3) * 0.05 * cap;
    this.camera.rotation.set(pitchSway, this.yaw + yawSway, 0, "YXZ");
  }

  _blocked(x, z, colliders) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  }
}
