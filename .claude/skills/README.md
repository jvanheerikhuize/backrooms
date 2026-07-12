# Claude Code skills

These are **skills** for [Claude Code](https://claude.com/claude-code) — packaged
instructions that Claude follows for common tasks in this repo. When you're
working in your terminal with Claude, it can use these automatically, or you can
ask for one by name (e.g. *"use the contribute skill"*).

**Start here**

| Skill | What it does |
| --- | --- |
| **game-idea** | Turn an idea (a level, creature, color, effect) into a real change that fits the game. |
| **run-game** | Start the game locally and open it in your browser to see your change. |
| **contribute** | Save and submit your change as a pull request (branch → commit → push → PR). No git knowledge needed. |

**Building a specific thing**

| Skill | What it does |
| --- | --- |
| **add-content** | Add a 3D prop, a wall sign, or a wall/floor texture — and make sure it actually shows up in the game. |
| **add-entity** | Add a creature: something alive that wanders the rooms near you. |
| **add-place** | Add a new level or stage — somewhere you travel to that isn't the endless yellow maze. |
| **dev-command** | Add a command to the in-game developer console (press `` ` `` and type `help`). |

**Before you commit**

| Skill | What it does |
| --- | --- |
| **verify-change** | Prove the change works by driving the real game in a browser and looking at it. This repo has no tests — this is the test. |
| **close-out** | Update the docs and the knowledge graph. Skip it and the pre-commit hook will reject your commit. |

Each skill lives in its own folder as a `SKILL.md` file. New to this? Start with
**[../../FLYNN.md](../../FLYNN.md)**.
