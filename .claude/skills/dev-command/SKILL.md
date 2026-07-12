---
name: dev-command
description: Add a new command to the in-game developer console (the tilde/backquote console) — register it in main.js, document it, and keep the knowledge graph in sync. Use when someone wants a new debug command, cheat, teleport, or toggle they can type in-game.
---

# Add a dev-console command

The console is `src/console.js` — a Quake-style command line toggled with `` ` ``
(tilde/backquote). It's game-agnostic: it owns the input, history, and DOM, and
knows nothing about the game. **All game commands are registered in `src/main.js`**,
in one fluent chain (search for `devConsole` followed by `.register(`), where they
can close over `world`, `player`, `camera`, and `entities`.

## Steps

1. **Add a `register()` call** to the chain in `src/main.js`. The signature is
   `register(name, help, run)`:
   ```js
   .register("fly", "toggle flying", () => {
     flying = !flying;
     return `flying ${flying ? "on" : "off"}`;
   })
   ```
   - `run(args, con)` — `args` are the whitespace-split strings after the command
     name (**always strings**; `parseFloat`/`parseInt` them yourself and return a
     `usage: ...` string when they're bad, as `tp` and `speed` do).
   - Anything you **return** is printed. For multi-line output call `con.print(...)`.
   - `help` shows up in `help` — keep it short and lowercase, like its neighbours.
2. **Don't add a keybinding.** The whole point of commit `81af172` was to replace
   the old numbered dev menu — every dev action is a command now, not a key.
3. **Verify it in-game.** Run the game (`run-game`), press `` ` ``, type `help` to
   confirm it's listed, then run it. Use `verify-change` if you want a scripted
   check.
4. **Document it**, in both places:
   - `README.md` — the dev-console bullet lists the commands.
   - `context/knowledge.json` — the `sub-console` node's `summary` **enumerates
     every command name**. Add yours, then `npm run kg -- render`.
5. **Regenerate the knowledge graph before committing**, or the pre-commit hook
   will bounce you. See `close-out` — this bites every time.

## Notes

- The console captures keys in the capture phase and stops them there, so typing a
  command can't also move the player or toggle mute. `main.js` also pauses the
  player while it's open. You get all of that for free.
- If your command needs something `main.js` doesn't already have in scope, define it
  above the chain rather than reaching into another module.
- Commands that change the world (`seed`, `tp`) generally call `world.update(x, z)`
  afterwards so chunks stream in around the new position — follow that pattern.
