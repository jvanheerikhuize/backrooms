---
name: close-out
description: Update the repo's memory before committing — log the decision, refresh the knowledge graph, and update README/FLYNN/goal so the docs still describe the game. Use right before committing or opening a PR, and whenever a commit is rejected by the knowledge-graph pre-commit hook.
---

# Close out a change (docs + knowledge graph)

Do this **before** you commit, as the last step of the work. It is not optional
housekeeping: a pre-commit hook enforces part of it, and the parts it doesn't
enforce are exactly the ones that have gone stale in the past.

## The hook will reject your commit

`.githooks/pre-commit` (installed by `npm install`) runs `node context/kg.mjs check`
and then re-renders `context/KNOWLEDGE.md`. **If `KNOWLEDGE.md` was out of date, the
commit is blocked** — the hook regenerates the file for you and tells you to
`git add context/KNOWLEDGE.md` and commit again. Save yourself the round-trip: run
`npm run kg -- render` and stage the result *before* committing.

Note the hook only checks that the rendered file matches `knowledge.json`. Nothing
checks that `knowledge.json` matches *reality* — that's your job, and it's why three
graph summaries once still described a dev menu that had been deleted.

## Steps

1. **Log the decision** — `context/decisions.md`, append-only, **newest first**, one
   entry as `date · what · why`. Only for decisions that aren't obvious from the
   code: a new subsystem, a constraint, an approach you chose over an alternative.
   A prop or a colour tweak doesn't need one; a new place, entity, or convention
   does. Write the **why** — that's the whole point of the file.
2. **Update the knowledge graph** — `context/knowledge.json` (`nodes` + `edges`):
   - New subsystem (a new `src/*.js`)? Add a `subsystem` node: `{ id, type, name,
     file, summary }`, plus edges to what it uses/realizes.
   - Changed an existing one? **Fix its `summary`.** Watch for summaries that
     enumerate things — `sub-console`'s lists every console command by name, so a new
     command means editing it.
   - A node's `ref` should point back at `decisions.md` or `goal.md` for the detail.
     The graph indexes the prose; it doesn't replace it.
3. **Render and check:**
   ```bash
   npm run kg -- check     # dangling edges, orphans, unknown relations
   npm run kg -- render    # rewrites context/KNOWLEDGE.md
   ```
   Then `git add context/KNOWLEDGE.md`.
4. **Update the human docs** — only the ones the change actually touches:

   | File | Update it when |
   | --- | --- |
   | `README.md` | Controls, status, or how you add content changed |
   | `context/goal.md` | The change shifts *what the game is or is trying to be* |
   | `FLYNN.md` | Anything a player does with their hands changed (keys, how to try it) |
   | `CONTRIBUTORS.md` | A new person contributed |
   | `public/**/NOTICE.md` | You added an asset (see `add-content`) |

5. **Then commit and open the PR** with `contribute`.

## Notes

- `npm run kg -- map` / `find <term>` / `why <id>` is the cheap way to see what the
  graph already believes about a subsystem before you edit it.
- If you're unsure whether a change deserves a `decisions.md` entry, ask: *would the
  next person wonder why it was done this way?* If yes, write it.
