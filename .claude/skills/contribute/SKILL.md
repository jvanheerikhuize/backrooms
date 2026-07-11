---
name: contribute
description: Ship a change to the Backrooms game as a pull request — create a branch, make the change, verify it builds, commit, push, and open a PR. Use whenever someone wants to save, submit, or contribute their work, "make a PR", or "send this to Dad". Written for a beginner (Flynn) with no git experience; never commit to main.
---

# Contribute a change (branch → PR)

Use this to take a change from "done in the working tree" to "submitted as a pull
request", safely. The person you're helping may have **no git experience** — do
the git work for them and explain each step in plain, friendly language.

## Rules

- **Never commit to `main`.** Always work on a new branch.
- Keep it small. One change = one branch = one PR. Small PRs are easy to review.
- Explain what you're doing in simple terms, and hand back the PR link to click.

## Steps

1. **Check where we are.** Run `git status` and `git branch --show-current`.
   - If on `main`, create a new branch before committing (next step).
   - If already on a sensible feature branch for this work, keep using it.

2. **Make sure the change is finished** and, if it touches game code, that it
   still builds and runs:
   - `npm run build` — must succeed.
   - Offer to show it running (see the `run-game` skill).

3. **Create a branch** with a short, descriptive, kebab-case name:
   - New feature/idea → `feature/<what>` (e.g. `feature/thicker-fog`).
   - Fixing something → `fix/<what>`.
   - Just docs/ideas → `docs/<what>`.
   ```bash
   git checkout -b feature/<what>
   ```

4. **Commit** with a clear message describing *what* changed and *why*. End the
   message with the repo's co-author trailer:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```

5. **Push** the branch:
   ```bash
   git push -u origin <branch-name>
   ```

6. **Open the pull request** against `main`:
   ```bash
   gh pr create --base main --title "<short title>" --body "<one or two lines on what and why>"
   ```
   - If `gh` isn't set up or the person isn't a collaborator yet, `git push`
     still prints a **"Create a pull request"** URL — give them that link
     instead, and remind them a collaborator invite may be needed
     (Settings → Collaborators).

7. **Hand it off.** Give the PR link and tell them, in plain words: open it,
   click the green **Create pull request** button (if not already created), and
   they're done — Dad will review it.

## Before you open the PR

If the change shifts what the game *is* or *does*, update the docs in the same
branch first (repo convention): the root **`README.md`** and, for direction
changes, **`context/goal.md`**.
