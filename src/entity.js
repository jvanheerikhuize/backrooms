// The entity layer — the seam the game's *life* plugs into: NPC presences, an
// audio entity, pickup items. Deliberately tiny (no ECS): an entity is an object
// with an `update(dt, ctx)`, optionally a mesh and a home place.
//
// Step 2 of the entity-layer refactor adds only the plumbing — the set, the
// per-frame update, and the "nearest presence" proximity signal — with ZERO
// entities, so it's a no-op today. Step 3 drops in the first NPC; the leak and
// audio-dread systems then just read `ctx.nearestPresence`.

// Base entity. Subclass and override update(). Set `presence = true` to count
// toward the proximity signal; set `place` to scope it to one place (null =
// everywhere).
export class Entity {
  object3D = null; // optional mesh — spawner adds it to the place's scene
  presence = false; // does this register as a "presence" others react to?
  place = null; // the Place this lives in (null = active regardless of place)
  alive = true; // set false to have the set drop it next update

  update(dt, ctx) {} // ctx = { dt, time, player, place, focus, entities, nearestPresence }
}

// A flat collection of active entities plus the proximity query over them.
export class EntitySet {
  list = [];

  add(entity) {
    this.list.push(entity);
    return entity;
  }
  remove(entity) {
    const i = this.list.indexOf(entity);
    if (i >= 0) this.list.splice(i, 1);
  }

  // The nearest presence to (x,z) in the given place, and its distance — the
  // shared "who's near you" signal that will drive the leak and audio dread.
  // null when nothing qualifies (the case today, with no entities).
  nearestPresence(x, z, place) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.list) {
      if (!e.presence || !e.object3D) continue;
      if (e.place && e.place !== place) continue;
      const d = Math.hypot(e.object3D.position.x - x, e.object3D.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best ? { entity: best, dist: bestD } : null;
  }

  // Run one frame: compute the proximity signal, then update every entity that
  // belongs to the active place. Drops any that marked themselves not `alive`.
  update(dt, ctx) {
    ctx.nearestPresence = this.nearestPresence(ctx.focus.x, ctx.focus.z, ctx.place);
    for (const e of this.list) {
      if (!e.place || e.place === ctx.place) e.update(dt, ctx);
    }
    if (this.list.some((e) => !e.alive)) this.list = this.list.filter((e) => e.alive);
  }
}
