---
name: add-content
description: Add a new 3D prop, wall sign, or surface texture to the game — find a CC0 asset, drop it under public/, register it, place it so it actually appears, and credit it in NOTICE.md. Use when someone wants a new object, furniture, sign, poster, wallpaper, or floor/wall material in the Backrooms.
---

# Add content (prop, sign, or texture)

The game is procedural — no art files — with three documented exceptions, each a
registry of real assets. Pick the right one, then follow that lane. The rule that
governs all three: **CC0 / public-domain assets only** (`context/decisions.md`).

| Want | Registry | Lives in |
| --- | --- | --- |
| A 3D object (chair, barrel, TV) | `OBJECT_REGISTRY` in `src/objects.js` | `public/models/gltf/` or `public/models/stl/` |
| A flat sign on a wall | `SVG_REGISTRY` in `src/svgprops.js` | `public/models/svg/` |
| A wall/floor/ceiling surface | `SKIN_REGISTRY` in `src/textures.js` | `public/textures/` |

## The trap — read this first

Registering a model is **not** enough to make it show up. A model appears in the
world only if one of these is true:

- it has `category: "research"` — which opts it into `randomObject()`'s random
  clutter pool, **or**
- something in `src/rooms.js` asks for it by id — a theme function, or the pool
  in `addExtraFurniture` (~line 749).

Miss both and the model loads silently and is never placed. Nothing errors. Always
decide which of the two you're doing, and say which one in the PR.

## Steps — a 3D model

1. **Find a CC0 asset.** Poly Haven is the established source. Its API lists the
   files for an asset: `https://api.polyhaven.com/files/<AssetName>`. Take the
   `gltf.1k.gltf` entry **and every file it lists under `include`** — the `.bin`
   and all of `textures/`. Miss one and the model loads untextured or not at all.
   See `public/models/gltf/NOTICE.md` for the exact recipe.
2. **Drop it in** `public/models/gltf/<name>/`, keeping the `.gltf` + `.bin` +
   `textures/` layout intact.
3. **Register it** by appending to `OBJECT_REGISTRY` (`src/objects.js`):
   ```js
   { id: "trash-can", file: "/models/gltf/metal_trash_can/metal_trash_can_1k.gltf",
     format: "gltf", label: "metal trash can", targetSize: 0.95 }
   ```
   `targetSize` is **metres** — the longest bounding-box dimension is scaled to it.
   Guess from the real object (a bin is ~0.95, a sofa ~2). The full field list
   (`roundFootprint` for round objects, `wallMount` for hanging decor, `category`,
   STL-only `color`/`metalness`/`roughness`) is documented in the comment block
   directly above the registry — read it, it explains *why* each exists.
4. **Make it appear** — see the trap above. Either add `category: "research"`, or
   call it by id from `src/rooms.js`.
5. **Credit it** in the table in `public/models/gltf/NOTICE.md`. Every asset PR has
   done this; nothing enforces it.
6. **Look at it.** Run the game (`run-game`), press `` ` ``, type `proproom` — the
   Prop Room builds one of every registered model automatically. Check the scale
   against the room and the other props.

## Steps — an SVG wall sign

Filled shapes only — **no `<text>`**, the SVG loader can't rasterise fonts (convert
text to paths first). Drop it in `public/models/svg/`, add
`{ id, file, label, widthMeters }` to `SVG_REGISTRY`, credit it in that folder's
`NOTICE.md`. Placement is automatic — `rooms.js` hangs a random sign in roughly half
of rooms. Verify in the Prop Room, which shows every sign on its far wall.

## Steps — a surface texture

A **seamless** diffuse jpg into `public/textures/`, then
`{ id, file, label, wallRepeat: [x,y], floorRepeat: [x,y], roughness }` in
`SKIN_REGISTRY` (`floorRepeat` is usually denser than `wallRepeat`), plus the
`NOTICE.md` row. Used automatically by ~40% of rooms. Note there's **no dev view for
skins** — the Prop Room doesn't show them — so verify by rolling seeds (`` ` `` →
`seed new`, then `room`) until a skinned room comes up.

## Keep the vibe

Sickly-yellow liminal, fluorescent buzz, VHS found-footage. Props should look
*left behind* — mundane, worn, slightly wrong. Not bright, not cartoonish.

Then ship it with `contribute`, and log it with `close-out`.
