// A "place" you can be in — which THREE.Scene renders, where you spawn, how the
// place collides, and whether it streams like the procedural world. This
// replaces main.js's `inStage2` / `inPropRoom` booleans and the per-frame
// branching they fanned out into (collision, streaming, and — since each dev
// room got its own scene — render). main.js now keeps a single `activePlace`
// and calls `goTo()` to switch; that one function applies scene, vignette,
// audio bed, and spawn uniformly, so there's one place to reason about a
// transition instead of three scattered ternaries.
//
// This is the seam the future entity/systems loop plugs into: entities belong
// to the active place, and everything that used to ask "which room am I in?"
// asks the place instead.

import { CONFIG } from "./config.js";

// Base: a fixed, self-contained place (its collider set never changes and it
// doesn't stream). Stage 2 and the Prop Room are these.
export class Place {
  // opts: { id, scene, spawn:{wx,wz}, vignette?, mutesBed? }
  constructor(opts) {
    this.id = opts.id;
    this.scene = opts.scene;
    this.spawn = opts.spawn;
    this.vignette = opts.vignette ?? 1.15; // the base game's default post-fx vignette
    this.mutesBed = opts.mutesBed ?? false; // drop the ambient "static" bed while here
  }

  ensureBuilt() {} // lazy-build hook (see RoomPlace)
  collidersNear() {
    return [];
  }
  stream() {} // no-op; only WorldPlace streams chunks

  // Park the camera at the spawn, facing forward. Overridable for places that
  // want a different arrival framing.
  placeCamera(camera) {
    camera.position.set(this.spawn.wx, CONFIG.eyeHeight, this.spawn.wz);
  }
}

// The procedural, infinite Backrooms — streams chunks and reads collision from
// the live World around the player.
export class WorldPlace extends Place {
  constructor({ id, scene, spawn, world }) {
    super({ id, scene, spawn, vignette: 1.15, mutesBed: false });
    this.world = world;
  }
  collidersNear(x, z) {
    return this.world.collidersNear(x, z);
  }
  stream(x, z) {
    this.world.update(x, z);
  }
}

// A fixed dev room living in its own scene. Optionally built lazily on first
// entry (the Prop Room needs the asset caches warm) and given a custom arrival
// framing (the Prop Room drops you at its south edge looking across the grid).
export class RoomPlace extends Place {
  // opts also accepts: { colliders?, build?:()=>({group,colliders,...}), placeCamera? }
  constructor(opts) {
    super(opts);
    this._colliders = opts.colliders ?? [];
    this._build = opts.build ?? null;
    this._placeCamera = opts.placeCamera ?? null;
    this.built = !this._build;
    this.room = null; // the build result (exposes extras like size/count)
  }

  ensureBuilt() {
    if (this.built) return;
    this.room = this._build();
    this.scene.add(this.room.group);
    this._colliders = this.room.colliders;
    this.built = true;
  }
  collidersNear() {
    return this._colliders;
  }
  placeCamera(camera) {
    if (this._placeCamera) this._placeCamera(camera, this);
    else super.placeCamera(camera);
  }
}
