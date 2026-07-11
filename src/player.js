// First-person player: pointer-lock mouse-look (via three's PointerLockControls)
// plus WASD movement with per-axis AABB collision resolution.

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { CONFIG } from "./config.js";

export class Player {
  constructor(camera, domElement) {
    this.controls = new PointerLockControls(camera, domElement);
    this.camera = camera;
    this.camera.position.set(0, CONFIG.eyeHeight, 0);

    this.velocity = new THREE.Vector3();
    this.keys = new Set();

    // Reusable temporaries (avoid per-frame allocation).
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    // Dropping pointer lock (Esc) should also drop held keys.
    this.controls.addEventListener("unlock", () => this.keys.clear());
  }

  get object() {
    return this.controls.object;
  }

  lock() {
    this.controls.lock();
  }

  get isLocked() {
    return this.controls.isLocked;
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

  update(dt, colliders) {
    if (!this.isLocked) return;

    const running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = running ? CONFIG.runSpeed : CONFIG.walkSpeed;
    const wish = this.wishDir();

    // Smoothly approach target velocity (simple accel/decel).
    const target = this._forward.set(wish.x * speed, 0, wish.z * speed);
    const t = Math.min(1, CONFIG.accel * dt);
    this.velocity.x += (target.x - this.velocity.x) * t;
    this.velocity.z += (target.z - this.velocity.z) * t;

    const pos = this.camera.position;
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;

    // Per-axis resolution: try X, then Z. Colliders are pre-padded by the
    // player radius, so the player is treated as a point.
    if (!this.blocked(pos.x + dx, pos.z, colliders)) {
      pos.x += dx;
    } else {
      this.velocity.x = 0;
    }
    if (!this.blocked(pos.x, pos.z + dz, colliders)) {
      pos.z += dz;
    } else {
      this.velocity.z = 0;
    }

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
