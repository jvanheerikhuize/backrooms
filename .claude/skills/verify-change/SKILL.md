---
name: verify-change
description: Prove a change actually works by driving the running game in a real browser — screenshot it, read the debug hooks, and check the console for errors. Use before opening any PR that touches src/, and whenever someone asks "does it work?" or "did that actually do anything?".
---

# Verify a change in the browser

There is **no test suite, no linter, and no CI** in this repo. This is the test
suite. Every commit in the log claims "Verified in-browser" — this is how that's
earned, and it means *you* look at the result instead of asking the person you're
helping to go check for you.

## Rules

- **`npm run build` passing is not verification.** It proves the code parses, not
  that anything appeared on screen.
- **Verify what you actually changed.** A new prop means *see the prop*. A new
  command means *run the command*. A movement tweak means read the position hook
  before and after.
- **The check script is a throwaway.** Delete it before you commit — never commit
  `_check.mjs` or `_check.png`.

## Steps

1. **Start the game** (see `run-game`): `npm run dev` in the background. Note the
   URL it prints — it's usually `http://localhost:5173`, but Vite silently moves to
   `5174` and up if the port is taken, so **read it, don't assume it**.
2. **Write `_check.mjs` in the project root** (it must live inside the project so
   Playwright resolves), and point it at the URL from step 1:
   ```js
   import { chromium } from "playwright";
   const browser = await chromium.launch();
   const page = await browser.newPage();
   const errors = [];
   page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
   page.on("pageerror", (e) => errors.push(String(e)));
   await page.goto("http://localhost:5173");
   await page.click("#overlay");            // click to enter (also unlocks audio)
   await page.waitForTimeout(2500);         // let chunks stream and models load
   console.log(await page.evaluate(() => window.__dbgPos()));
   await page.screenshot({ path: "_check.png" });
   console.log(errors.length ? errors : "no console errors");
   await browser.close();
   ```
   One-time setup if it complains: `npx playwright install chromium`.
3. **Run it, then _look at the PNG_.** Read `_check.png` with the image reader. An
   error-free run that renders a black screen is still a failure.
4. **Interrogate the game through the debug hooks** rather than guessing. They're
   exposed on `window` from `src/main.js` and are the fastest way to assert:

   | Hook | Tells you |
   | --- | --- |
   | `__dbgPos()` | position, zone, chunk + light counts |
   | `__dbgEntities()` | entity count and nearest presence |
   | `__dbgPlayer()` | movement / stamina state |
   | `__dbgAudio()` | ambience state |
   | `__dbgCutscene()` | cut-scene state |
   | `__dbgTeleport(x, z)`, `__dbgTeleportRoom()`, `__dbgTeleportArrow()` | jump somewhere worth photographing |
   | `__dbgResetSeed()`, `__dbgToggleStage2()`, `__dbgTogglePropRoom()` | rebuild / change place |

   To photograph a new prop, teleport to a room (`__dbgTeleportRoom()`) or open the
   Prop Room (`__dbgTogglePropRoom()`) before screenshotting.
5. **Clean up:** delete `_check.mjs` and `_check.png`, and `pkill -f vite`.

## The one thing you can't do

Pointer lock means synthetic `mousemove` deltas don't drive the camera — you cannot
verify precise look/movement headlessly. Use `__dbgTeleport(x, z)` to get where you
need to be, and screenshot from there. For anything genuinely about *feel*, say so
plainly and ask the person to walk it themselves.
