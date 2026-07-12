---
name: run-game
description: Run the Backrooms game locally to see it in action — start the Vite dev server, open it in the browser, and optionally screenshot or drive it. Use when someone wants to play, preview, test, or "see" the game or a change they just made.
---

# Run the game

The game is a browser app built with **three.js** and served by **Vite**. Running
it locally lets you (or the person you're helping) actually see a change.

## Steps

1. **Install dependencies if needed.** If `node_modules/` is missing:
   ```bash
   npm install
   ```
   (Requires Node.js 18+. On Windows this is the same command in their terminal.)

2. **Start the dev server** (run it in the background so it keeps serving):
   ```bash
   npm run dev
   ```
   It prints a local URL — usually **http://localhost:5173**.

3. **Open it.** Tell the person to open that URL in their browser and **click to
   enter** (the game locks the mouse pointer). Controls:

   | Key | Action |
   | --- | --- |
   | Click | Enter / lock pointer |
   | W A S D / arrows | Move |
   | Mouse | Look |
   | Shift | Run |
   | M | Mute / unmute |
   | C | Trigger a found-footage cut-scene |
   | V | Reduce camera motion |
   | Esc | Release the pointer |

4. **See it yourself with Playwright.** This project has `playwright`
   installed as a dev dependency specifically so Claude can visually verify
   changes instead of just asking the user to check. Browsers are installed
   once per machine via `npx playwright install chromium` (skip if already
   done — check `%LOCALAPPDATA%\ms-playwright` / `~/.cache/ms-playwright`).
   Then, from the project root:
   ```js
   // _check.mjs — must live inside the project (module resolution needs
   // its own node_modules); delete it when done, don't commit it.
   import { chromium } from "playwright";
   const browser = await chromium.launch();
   const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
   const errors = [];
   page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
   page.on("pageerror", (e) => errors.push(String(e)));
   await page.goto("http://localhost:5174/", { waitUntil: "networkidle" }); // match the dev server's actual port
   await page.waitForTimeout(1500); // let the opening cut-scene / WebGL settle
   await page.screenshot({ path: "_check.png" });
   console.log("errors:", errors.length ? errors : "none");
   await browser.close();
   ```
   Run with `node _check.mjs`, then read `_check.png` to see it. For
   gameplay (not just the title screen), click isn't available headlessly —
   drive it via `page.mouse.click()` on the canvas, `page.keyboard.down("KeyW")`
   etc., and pointer-lock movement won't fire `mousemove` deltas the same way
   a real user does, so treat this as good for visual/error checks and dev-menu
   testing (T, F, teleports), not precise movement verification.

5. **Stop the server** when done:
   ```bash
   pkill -f vite
   ```

## Notes

- Changes hot-reload — save a file and the browser updates automatically.
- To check a production build instead: `npm run build` then `npm run preview`.
