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

4. **Optional — show it yourself.** If Claude-in-Chrome browser tools are
   available, open the URL, take a screenshot, and confirm the change looks
   right. Watch the console for errors.

5. **Stop the server** when done:
   ```bash
   pkill -f vite
   ```

## Notes

- Changes hot-reload — save a file and the browser updates automatically.
- To check a production build instead: `npm run build` then `npm run preview`.
