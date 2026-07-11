Source & license for the glTF models in this folder
====================================================

All models here are from [Poly Haven](https://polyhaven.com/), released under
**CC0 1.0 (Creative Commons Zero / public domain)**. Per Poly Haven's license:

> "You can use our assets for any purpose, including commercial work. You do not
> need to give credit or attribution when using them (although it is
> appreciated). You can redistribute them, share them around, include them when
> sharing your own work, or even in a product you sell."

License: https://polyhaven.com/license — so bundling these into this repository
carries no licensing restriction. Attribution below is courtesy, not required.

Each model is a self-contained glTF (`.gltf` + `.bin` + `textures/`) at 1K
resolution, loaded and normalised by `src/objects.js` (see `preloadObjects`).

| Folder / id                    | Model            | Author          |
| ------------------------------ | ---------------- | --------------- |
| `Barrel_01` (barrel)           | Barrel 01        | Jorge Camacho   |
| `SchoolChair_01` (school-chair)| School Chair 01  | Ethan Place     |
| `CheeseBox_01` (wooden-crate)  | Cheese Box 01    | Gabriel Radić   |
| `Shelf_01` (shelf)             | Shelf 01         | Gabriel Radić   |
| `cardboard_box_01` (cardboard-box) | Cardboard Box 01 | Rahul Chaudhary |

To add more: download a CC0 glTF (e.g. from the Poly Haven API,
`https://api.polyhaven.com/files/<AssetName>`, the `gltf.1k.gltf` entry plus its
`include` files) into a new subfolder here, then register it in
`src/objects.js` with `format: "gltf"` and a real-world `targetSize` in metres.
