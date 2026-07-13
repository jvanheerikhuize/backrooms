// First-person player: a custom pointer-lock mouse-look plus WASD movement with
// per-axis AABB collision resolution and a sprint stamina system.
//
// The mouse-look is hand-rolled (rather than three's PointerLockControls) so we
// can clamp each mouse movement: a fast flick can no longer spin the view 180°
// or snap it to the ceiling/floor. Pitch is also clamped short of vertical.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { SPAWN_POS } from "./world.js";

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(SPAWN_POS.wx, CONFIG.eyeHeight, SPAWN_POS.wz);

    this.yaw = 0;
    this.pitch = 0;
    this._locked = false;
    this.paused = false; // frozen (e.g. inventory open) without releasing pointer lock

    this.velocity = new THREE.Vector3();
    this.keys = new Set();

    // Stamina: 1 = full. Sprinting drains it; not sprinting regenerates it.
    this.stamina = 1;
    this.exhausted = false; // true once emptied, until it recovers past resume
    this.sprinting = false; // whether we're actually sprinting this frame (for UI)

    // Points: starts full, ticks down by pointsDecayAmount every
    // pointsDecayInterval seconds. Topped back up via addPoints().
    this.points = CONFIG.pointsMax;
    this._pointsTimer = 0;

    // A tiny EventTarget so main.js can listen for lock/unlock like before.
    this.controls = new EventTarget();

    // Reusable temporaries (avoid per-frame allocation).
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    document.addEventListener("mousemove", (e) => this.onMouseMove(e));
    document.addEventListener("pointerlockchange", () => this.onLockChange());
  }

  get object() {
    return this.camera;
  }

  get isLocked() {
    return this._locked;
  }

  lock() {
    this.dom.requestPointerLock();
  }

  onLockChange() {
    const locked = document.pointerLockElement === this.dom;
    if (locked === this._locked) return;
    this._locked = locked;
    if (locked) {
      // Seed yaw/pitch from wherever the camera is now (e.g. after a cut-scene)
      // so control resumes without a snap.
      this.yaw = this.camera.rotation.y;
      this.pitch = this.camera.rotation.x;
    } else {
      this.keys.clear();
    }
    this.controls.dispatchEvent(new Event(locked ? "lock" : "unlock"));
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.keys.clear();
  }

  onMouseMove(e) {
    if (!this._locked || this.paused) return;
    const s = CONFIG.mouseSensitivity;
    const cap = CONFIG.maxLookStep;
    // Clamp per-event turn so a fast flick can't whip the camera around.
    const dYaw = THREE.MathUtils.clamp(e.movementX * s, -cap, cap);
    const dPitch = THREE.MathUtils.clamp(e.movementY * s, -cap, cap);
    this.yaw -= dYaw;
    this.pitch -= dPitch;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -CONFIG.pitchLimit, CONFIG.pitchLimit);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  // Horizontal wish-direction from WASD, in world space.
  wishDir() {
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();
    this._right.crossVectors(this._forward, this.camera.up).normalize();

    this._wish.set(0, 0, 0);
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) this._wish.add(this._forward);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) this._wish.sub(this._forward);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) this._wish.add(this._right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) this._wish.sub(this._right);
    if (this._wish.lengthSq() > 0) this._wish.normalize();
    return this._wish;
  }

  // Add (or subtract) points, clamped to [0, pointsMax]. Called by whatever
  // in-game actions end up granting points (not wired up yet).
  addPoints(amount) {
    this.points = THREE.MathUtils.clamp(this.points + amount, 0, CONFIG.pointsMax);
  }

  // Refill to full and reset the decay clock — called on every place
  // transition (see main.js's goTo()) so arriving somewhere new always
  // starts with a full bar instead of carrying over a partly-drained one.
  refillPoints() {
    this.points = CONFIG.pointsMax;
    this._pointsTimer = 0;
  }

  update(dt, colliders) {
    if (!this._locked || this.paused) return;

    this._pointsTimer += dt;
    while (this._pointsTimer >= CONFIG.pointsDecayInterval) {
      this._pointsTimer -= CONFIG.pointsDecayInterval;
      this.points = Math.max(0, this.points - CONFIG.pointsDecayAmount);
    }

    const wish = this.wishDir();
    const moving = wish.lengthSq() > 0;
    const wantSprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");

    // Sprint only if we want to, are moving, have stamina, and aren't recovering
    // from a full drain.
    this.sprinting = wantSprint && moving && !this.exhausted && this.stamina > 0;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - CONFIG.staminaDrain * dt);
      if (this.stamina === 0) this.exhausted = true; // must recover before sprinting again
    } else {
      this.stamina = Math.min(1, this.stamina + CONFIG.staminaRegen * dt);
      if (this.exhausted && this.stamina >= CONFIG.staminaResume) this.exhausted = false;
    }

    const speed = this.sprinting ? CONFIG.runSpeed : CONFIG.walkSpeed;
    const target = this._forward.set(wish.x * speed, 0, wish.z * speed);
    const t = Math.min(1, CONFIG.accel * dt);
    this.velocity.x += (target.x - this.velocity.x) * t;
    this.velocity.z += (target.z - this.velocity.z) * t;

    const pos = this.camera.position;
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;

    // Per-axis resolution: try X, then Z. Colliders are pre-padded by the player
    // radius, so the player is treated as a point.
    if (!this.blocked(pos.x + dx, pos.z, colliders)) pos.x += dx;
    else this.velocity.x = 0;
    if (!this.blocked(pos.x, pos.z + dz, colliders)) pos.z += dz;
    else this.velocity.z = 0;

    pos.y = CONFIG.eyeHeight;
  }

  blocked(x, z, colliders) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  }
}
