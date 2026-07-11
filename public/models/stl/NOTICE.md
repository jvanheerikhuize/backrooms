Source & license for the STL files in this folder
===================================================

These are the example STL models shipped with the [three.js](https://github.com/mrdoob/three.js)
project (`examples/models/stl/`), used here to demonstrate the STLLoader-based
object registry (see `src/objects.js`). three.js — including its example
assets — is MIT licensed, the same license already covering the `three`
package this project depends on, so including these carries no new licensing
risk.

- `pr2_head_pan.stl` — three.js binary STL loader example
- `slotted_disk.stl` — three.js ASCII STL loader example

Both are CAD/robotics files authored Z-up (see `rotateXNeg90` in
`src/objects.js`) — a new file you add is likely also Z-up unless you know
otherwise; check its bounding box before assuming it's already Y-up.

Full license: https://github.com/mrdoob/three.js/blob/dev/LICENSE

Drop any additional `.stl` files in this folder and register them in
`src/objects.js` to add them to the game.
