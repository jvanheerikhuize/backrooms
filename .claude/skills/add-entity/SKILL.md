---
name: add-entity
description: Add a new living thing to the game — a creature, monster, NPC presence, or any entity that moves and updates each frame. Use when someone wants a new creature, a thing that chases or follows you, another wanderer, or anything alive in the Backrooms.
---

# Add an entity (creature or presence)

The entity layer is `src/entity.js` — deliberately tiny, no ECS. An entity is an
object with an `update(dt, ctx)`, optionally a mesh (`object3D`) and a home `place`.
`src/npc.js` is the only one so far (a wandering "Still Life" figure) and is the
model to copy.

## Steps

1. **Create `src/<creature>.js`** with a class extending `Entity`:
   ```js
   export class Crawler extends Entity {
     constructor(place, x, z) {
       super();
       this.place = place;        // scopes it to one place (null = everywhere)
       this.presence = true;      // counts toward the "who's near you" signal
       this.object3D = makeFigure();
       this.object3D.position.set(x, 0, z);
     }
     update(dt, ctx) { /* ... */ }
   }
   ```
   `ctx` is `{ dt, time, player, place, focus, entities, nearestPresence }`.
   Set `alive = false` and the set drops it on the next frame.
2. **Build its mesh procedurally**, from three.js primitives — that's the house
   style for creatures (see `makeFigure()` in `npc.js`: a capsule body and a small
   head, elongated so it reads as *slightly wrong*, not as a person). Real models are
   for props, not life; if you truly want a model, that's `add-content`.
3. **Keep it leashed to the player.** The world only streams chunks around the
   player, so anything that wanders beyond that radius has **no colliders to collide
   with** and will drift through walls. `npc.js` uses a 24 m leash — respect that
   limit or handle it deliberately.
4. **Collide like the NPC does.** `place.collidersNear(x, z)` returns boxes already
   padded by the player radius, so a plain point-in-box test keeps your creature a
   body's width off the walls.
5. **Spawn it in `src/main.js`** — three lines, and forgetting the middle one is the
   classic bug (the entity updates invisibly, forever):
   ```js
   const e = new Crawler(worldPlace, x, z);
   scene.add(e.object3D);   // easy to forget — no mesh in the scene, no creature
   entities.add(e);
   ```
6. **Give it console commands** (see `dev-command`) so it can be spawned and cleared
   on demand. **Watch out:** the existing `spawn` and `clearnpc` commands filter with
   `instanceof Npc`, so they will **silently ignore your new type**. Either add
   commands for it, or generalise those filters.
7. **Verify it.** `run-game`, then `` ` `` → your spawn command, and `ents` to confirm
   the count and nearest-presence distance. `verify-change` can script this via
   `window.__dbgEntities()`.

## Keep the vibe

Backrooms things are *wrong*, not gory. Too tall, too still, moving when you aren't
looking. Slow and unhurried beats fast and aggressive — the horror is being
*accompanied*, not attacked. See `context/goal.md` §6.

Then `contribute` to ship it, and `close-out` to log it.
