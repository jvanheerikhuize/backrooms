Source & license for the textures in this folder
=================================================

All textures here are from [Poly Haven](https://polyhaven.com/), released under
**CC0 1.0 (Creative Commons Zero / public domain)** — no attribution required,
free to redistribute (see https://polyhaven.com/license) — so bundling them into
this repository carries no restriction. Attribution below is courtesy.

These are 1K seamless diffuse/albedo maps, loaded by `src/textures.js` (see
`preloadSkins`) and turned into alternate wall/floor/ceiling "skins" that some
rooms adopt (a "leaked" reinterpretation of the base yellow Backrooms).

| File (skin id)                          | Texture             | Author                        |
| --------------------------------------- | ------------------- | ----------------------------- |
| `anti_slip_concrete_diff_1k.jpg` (concrete)     | Anti-Slip Concrete | Charlotte Baglioni            |
| `blue_floor_tiles_01_diff_1k.jpg` (blue-tiles)  | Blue Floor Tiles 01 | Rob Tuytel                   |
| `blue_plaster_wall_diff_1k.jpg` (blue-plaster)  | Blue Plaster Wall   | Dimitrios Savva              |
| `beige_wall_001_diff_1k.jpg` (beige-plaster)    | Beige Wall 001      | Dimitrios Savva, Rico Cilliers |

To add more: download a CC0 seamless diffuse map (e.g. from the Poly Haven API,
`https://api.polyhaven.com/files/<TextureName>`, the `Diffuse.1k.jpg` entry) into
this folder, then register it in `src/textures.js` (`SKIN_REGISTRY`) with tiling
repeats and a roughness.
