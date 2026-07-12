// The first bit of life: a wandering "presence" — a dark, slightly-too-tall
// standing figure (a "Still Life", goal.md §6.4) that drifts around near the
// player. It's an Entity (see entity.js), so the loop updates it and the
// proximity system already reports it as `ctx.nearestPresence` — which the leak
// and audio-dread systems will read next.
//
// It stays leashed to the player: partly because that's the eerie behaviour we
// want (a thing that lurks near you), and partly practical — the world only
// streams chunks around the player, so a presence that wandered past that
// radius would have no colliders to avoid and could drift through walls.

import * as THREE from "three";
import { CONFIG } from "./config.js";
import { Entity } from "./entity.js";

const SPEED = CONFIG.walkSpeed * 0.35; // slow, unhurried lurking
const LEASH = 24; // metres — beyond this it heads back toward the player (stays in streamed world)
const RETARGET_MIN = 2.5; // seconds between random heading changes
const RETARGET_VAR = 3.5;

// A dark humanoid silhouette — a capsule body + a small head, elongated so it
// reads as a figure that's *slightly wrong*, not a person.
function makeFigure() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x16161b, roughness: 0.85, metalness: 0.0 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.25, 4, 12), mat);
  body.position.y = 0.2 + 1.25 / 2; // rest the capsule's bottom on the floor
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), mat);
  head.position.y = 0.2 + 1.25 + 0.13; // perched just above the body
  g.add(body, head);
  return g;
}

function blocked(place, x, z) {
  // Colliders are already padded by the player radius, so a point-in-AABB test
  // (same as the player's) keeps the figure roughly a body's width off walls.
  for (const c of place.collidersNear(x, z)) {
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
  }
  return false;
}

export class Npc extends Entity {
  constructor(place, x, z, signature = Math.floor(Math.random() * 0xffffffff)) {
    super();
    this.presence = true;
    this.place = place; // scoped to the world — pauses while you're in a dev room
    this.signature = signature >>> 0; // reserved for the future presence-driven leak
    this.object3D = makeFigure();
    this.object3D.position.set(x, 0, z);
    this.heading = Math.random() * Math.PI * 2;
    this._retarget = 0;
  }

  update(dt, ctx) {
    const p = this.object3D.position;
    const toX = ctx.focus.x - p.x;
    const toZ = ctx.focus.z - p.z;
    const distToPlayer = Math.hypot(toX, toZ);

    // Re-aim on a timer, or immediately when the leash is taut (head home).
    this._retarget -= dt;
    if (distToPlayer > LEASH) {
      this.heading = Math.atan2(toZ, toX);
    } else if (this._retarget <= 0) {
      this.heading = Math.random() * Math.PI * 2;
      this._retarget = RETARGET_MIN + Math.random() * RETARGET_VAR;
    }

    const step = SPEED * dt;
    const nx = p.x + Math.cos(this.heading) * step;
    const nz = p.z + Math.sin(this.heading) * step;
    if (blocked(this.place, nx, nz)) {
      // Walked into a wall — turn away and try again soon rather than clip through.
      this.heading += Math.PI * 0.5 + Math.random() * Math.PI;
      this._retarget = 0.3;
    } else {
      p.x = nx;
      p.z = nz;
      this.object3D.rotation.y = -this.heading; // roughly face travel direction
    }
  }
}
