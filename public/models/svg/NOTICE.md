Source & license for the SVG 2D props in this folder
=====================================================

These SVG signs were authored from scratch for this project (original work,
effectively CC0 / public domain) — no third-party assets, no licensing risk.
They are simple filled-shape vectors (no `<text>`, since three.js's SVGLoader
rasterises paths, not fonts) parsed into flat wall-mounted meshes by
`src/svgprops.js` (see `preloadSvgProps`).

- `arrow.svg`      — directional arrow
- `exit.svg`       — emergency exit sign
- `hazard.svg`     — hazard warning triangle
- `radiation.svg`  — radiation trefoil (the Null-Zone green motif, goal.md §6.7)
- `no-entry.svg`   — no-entry sign

To add more: drop a filled-shape `.svg` here and register it in
`src/svgprops.js` (`SVG_REGISTRY`) with a `widthMeters`. Each source path's
`fill` colour is used as-is; overlapping fills paint in document order.
