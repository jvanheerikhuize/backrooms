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
| `WoodenTable_01` (table)       | Wooden Table 01  | Ethan Place     |
| `Lantern_01` (lantern)         | Lantern 01       | Rajil Jose Macatangay |
| `fancy_picture_frame_01` (picture-frame) | Fancy Picture Frame 01 | Rob Tuytel (scan/painting), Rico Cilliers (modeling) |
| `rubber_duck_toy` (toy-duck)   | Rubber Duck Toy  | Plat251         |
| `baseball_01` (toy-baseball)   | Baseball 01      | Rico Cilliers   |
| `small_oil_can_01` (oil-can)   | Small Oil Can 01 | Raven van de Werken |
| `Sofa_01` (sofa)               | Sofa 01          | Kirill Sannikov |
| `boombox` (boombox)            | Boombox          | Thomas Paul Mouilleron |
| `ammo_box` (ammo-box)          | Ammo Box         | DanKit          |
| `Television_01` (television)   | Television 01    | Gabriel Radić   |
| `korean_fire_extinguisher_01` (fire-extinguisher) | Korean Fire Extinguisher 01 | UM JOORIN |
| `metal_trash_can` (trash-can)  | Metal Trash Can  | GurJas Studios  |
| `anthurium_botany_01` (potted-plant) | Anthurium Botany 01 | Rob Tuytel, Rico Cilliers |
| `can_rusted` (rusted-can)      | Can Rusted       | Rahul Chaudhary |

To add more: download a CC0 glTF (e.g. from the Poly Haven API,
`https://api.polyhaven.com/files/<AssetName>`, the `gltf.1k.gltf` entry plus its
`include` files) into a new subfolder here, then register it in
`src/objects.js` with `format: "gltf"` and a real-world `targetSize` in metres.
