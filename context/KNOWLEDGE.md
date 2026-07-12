# Knowledge graph

> Generated from `knowledge.json` by `npm run kg -- render` — do not hand-edit. 45 nodes · 65 edges · updated 2026-07-12.

Lightweight knowledge graph for the Backrooms game. Nodes are the things worth remembering (subsystems, concepts, decisions, conventions, mechanics, people, sources); edges are typed relations. Query it with `npm run kg -- <cmd>` (see context/kg.mjs) instead of reading the full prose docs. The graph indexes goal.md (design) and decisions.md (why) — drill into those via a node's `ref`.

## Relations

- `uses` — A depends on / consumes B
- `part_of` — A is a component of B
- `parallels` — A mirrors B's pattern
- `realizes` — A (subsystem/mechanic) makes concept B real
- `authored_by` — A was written mainly by person B
- `establishes` — decision A introduced B
- `constrains` — convention A governs B
- `sources_from` — asset subsystem A pulls content from source B

## persons

### Flynn `flynn`
Jerry's son (14); owns game direction and authors features. Commits under Jerry's git identity — credit him explicitly.

### Jerry `jerry`
Creator; sets high-level direction, reviews and merges PRs.


## conventions

### Feature-branch → PR `conv-branch-pr` — context/decisions.md
Every change on its own branch → PR; never commit to main.

authored_by → **Jerry**

### CC0-only assets `conv-cc0` — context/decisions.md
Bundled assets must be CC0 / public-domain; verify per file (print libraries mix licenses).

constrains → **Model registry** · constrains → **Texture-skin registry** · authored_by → **Jerry**

### Asset-only room props `conv-asset-only-props` — context/decisions.md
Room props come only from the model/SVG registries — no procedural box/cylinder stand-ins.

constrains → **Special rooms**

### Procedural base, no asset files `conv-procedural-base` — context/decisions.md
Base world (canvas textures, Web-Audio sound) is generated at runtime; the asset registries are documented exceptions.

constrains → **Base materials** · constrains → **Ambience**

### Single-player now; NPCs mock multiplayer `conv-single-player` — context/goal.md
No networking yet; presence mechanics built to swap NPC → networked player with no rework.

constrains → **Shared lobby**

### Docs before PR `conv-docs-before-pr` — context/decisions.md
Refresh README / decisions.md (and goal.md on direction shifts) before opening a PR.

authored_by → **Jerry**


## subsystems

### Entry / orchestrator `sub-main` — src/main.js
Scene, render loop, dev menu, teleports; preloads the asset registries before world generation.

uses → **Places** · uses → **Entity layer** · uses → **NPC presence** · uses → **World streaming** · uses → **Player controller** · uses → **Cut-scene layer** · uses → **Ambience** · uses → **Prop Room (dev)** · uses → **Stage 2 (dev)**

### World streaming `sub-world` — src/world.js
Infinite chunk-streamed maze; layout zones; wall arrows; sparse lights. Deterministic per seed.

uses → **Config** · uses → **Seeded RNG** · uses → **Base materials** · realizes → **Layout zones** · realizes → **Green Glow / Null Zones** · authored_by → **Flynn**

### Special rooms `sub-rooms` — src/rooms.js
'Someone was here' rooms (~1 per 250m²); themed model+sign placement; ~40% get a texture skin.

uses → **Model registry** · uses → **SVG prop registry** · uses → **Texture-skin registry** · uses → **Base materials** · part_of → **World streaming**

### Model registry `sub-objects` — src/objects.js
Loads/caches glTF + STL models to cloneable templates. randomObject (research clutter) / getObject (specific).

parallels → **SVG prop registry** · part_of → **Drop-a-file content pipeline** · sources_from → **Poly Haven** · sources_from → **three.js examples**

### SVG prop registry `sub-svgprops` — src/svgprops.js
Parses SVG files (SVGLoader) into flat unlit meshes — wall signs mounted facing into rooms.

parallels → **Texture-skin registry** · part_of → **Drop-a-file content pipeline**

### Texture-skin registry `sub-textures` — src/textures.js
Ingests image textures as alternate wall/floor/ceiling 'skins' for leaked rooms.

part_of → **Drop-a-file content pipeline** · realizes → **The Leak / alteration** · sources_from → **Poly Haven**

### Base materials `sub-materials` — src/materials.js
Procedural canvas textures for the base yellow walls/carpet/ceiling; intentionally swappable.

### Player controller `sub-player` — src/player.js
First-person movement, per-axis AABB collision, sprint + stamina.

authored_by → **Flynn**

### Cut-scene layer `sub-cutscene` — src/cutscene.js
Found-footage opening title + in-game reveal; takes over the camera.

uses → **Post-processing**

### Post-processing `sub-postfx` — src/postfx.js
VHS / grain / chromatic-aberration EffectComposer pass.

### Ambience `sub-audio` — src/audio.js
Procedural brown-noise room tone + fluorescent hum coupled to the light flicker.

### Prop Room (dev) `sub-proproom` — src/proproom.js
Dev test chamber laying out one of every registered prop; dev-menu key 5.

uses → **Model registry** · uses → **SVG prop registry** · parallels → **Stage 2 (dev)**

### Stage 2 (dev) `sub-stage2` — src/stage2.js
Separate dev room off the world grid (fixed far coordinate); dev-menu key 4.

authored_by → **Flynn**

### Config `sub-config` — src/config.js
Central tunables: zone profiles, lights, movement, special-room params.

### Seeded RNG `sub-rng` — src/rng.js
Deterministic mulberry32 + hashCell; per-feature salted streams keep layouts reproducible.

### Places `sub-place` — src/place.js
Where-you-are abstraction (world / Stage 2 / Prop Room): scene, spawn, collision, streaming. Replaced the inStage2/inPropRoom flags; the seam the entity loop plugs into.

uses → **World streaming**

### Entity layer `sub-entity` — src/entity.js
Tiny entity list + per-frame update + a nearest-presence proximity signal. The seam NPCs / items / an audio entity plug into. Feeds the future leak + dread systems.

### NPC presence `sub-npc` — src/npc.js
First wandering presence — a dark Still-Life figure leashed near the player, avoids walls, registers on the proximity signal, carries a signature for the future presence-driven leak.

uses → **Entity layer** · realizes → **Still Lifes** · realizes → **Shared lobby**


## concepts

### The Leak / alteration `concept-leak` — context/goal.md §5.6
Others' influence reinterprets the base yellow into an altered Backrooms — accurate in essence but never a copy.

part_of → **Shared lobby**

### Shared lobby `concept-shared-lobby` — context/goal.md §5.2
Persistent shared space where presences bleed in. Deferred; NPC-mocked for now.

### Green Glow / Null Zones `concept-null-zone` — context/goal.md §6.7
Green-glow unstable spots as landmarks/portals; realized as encounter-zone floor markers.

### Still Lifes `concept-still-life` — context/goal.md §6.4
Distorted human copies — future NPC/entity visuals.

part_of → **Shared lobby**

### Layout zones `concept-layout-zones` — src/config.js
Grid partitioned into open / rooms / corridor / encounter zones so space changes character as you walk.

authored_by → **Flynn**

### Drop-a-file content pipeline `concept-content-pipeline`
The three registries share one pattern: drop an asset into public/, add a registry entry. Extensible by non-coders.


## mechanics

### Sprint + stamina `mech-stamina`
Hold shift to run; stamina drains, regenerates, and locks out sprint while exhausted.

part_of → **Player controller** · authored_by → **Flynn**

### Dev menu `mech-dev-menu`
T opens it; 1 random room, 2 arrow, 3 reset seed, 4 Stage 2, 5 Prop Room.

part_of → **Entry / orchestrator**

### Found-footage aesthetic `mech-found-footage`
REC light / VHS tracking / datestamp camcorder framing; the opening plays as a cut-scene.

part_of → **Cut-scene layer** · uses → **Post-processing**


## sources

### Poly Haven `src-polyhaven`
CC0 models + seamless textures; pullable via api.polyhaven.com.

### three.js examples `src-threejs-examples`
MIT example STL models (servo housing, slotted disk).


## decisions

### Image-texture skins `dec-textures` — 2026-07-12 · context/decisions.md
Textures re-skin room surfaces; third content pipeline.

establishes → **Texture-skin registry**

### Asset-only props + Prop Room `dec-asset-only` — 2026-07-12 · context/decisions.md
Stripped procedural props; added the dev Prop Room.

establishes → **Asset-only room props** · establishes → **Prop Room (dev)**

### SVG 2D props `dec-svg` — 2026-07-12 · context/decisions.md
SVGLoader-based wall-sign registry.

establishes → **SVG prop registry**

### glTF in the object registry `dec-gltf` — 2026-07-12 · context/decisions.md
GLTFLoader path + CC0 Poly Haven props.

establishes → **Model registry**

### STL asset exception `dec-stl-exception` — 2026-07-11 · context/decisions.md
External model files as a deliberate exception to procedural-only.

establishes → **Model registry**

### Config-driven layout zones `dec-zones` — 2026-07-11 · context/decisions.md
Replaced the per-region corridor system with weighted zone profiles.

establishes → **Layout zones**

### Direction handed to Flynn `dec-flynn-direction` — 2026-07-11 · context/decisions.md
Feature roadmap cleared; goal lives in goal.md, shaped by Flynn.

establishes → **Single-player now; NPCs mock multiplayer**

### three.js over raw WebGL `dec-threejs` — 2026-07-11 · context/decisions.md
Shader/post-processing-heavy roadmap; three.js gives EffectComposer + instancing.

establishes → **Post-processing**
