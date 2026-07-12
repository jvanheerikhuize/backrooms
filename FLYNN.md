# 👋 Hey Flynn — welcome to the Backrooms game!

Your dad built this game, and now **you can add your own ideas to it.** 🎉

You don't need to know how the code or the "git" stuff works.
👉 **You just tell Claude what you want, in normal words, and Claude does it for you.**

Follow the steps below. Take your time — you can't break anything. 💪

---

## 🛠️ Setup — do this once

1. **Install Git** (the tool that saves your work). Download it here:
   **https://git-scm.com/download/win** → open the file → click **Next** on every
   screen (the defaults are perfect).

2. **Ask your dad to let you in.** He needs to add you as a *collaborator*.
   > 📎 *Dad:* on GitHub go to **Settings → Collaborators → Add people** and add Flynn.

3. **Get the game onto your PC.** Open your terminal (the same place you run
   Claude), and start Claude by typing:
   ```
   claude
   ```
   Then type this to Claude, in plain English:
   > Clone https://github.com/jvanheerikhuize/backrooms and set it up so I can work on it.

   Claude will do the rest. If it ever asks *"is this okay?"*, say **yes**. ✅

---

## 🎮 Making a change — do this every time

1. Open your terminal, go into the game folder, and start Claude:
   ```
   cd backrooms
   claude
   ```

2. **Tell Claude what you want.** Just describe it! For example:
   > Make the fog thicker and spookier.
   > Add a new level idea to the storyline: endless staircases that loop.
   > Make the REC light blink faster.

3. **See it in action.** Ask Claude:
   > How do I run the game and see my change?

4. **When you're happy, say the magic sentence:** 🪄
   > Put this on a new branch, save it, push it, and give me the link to open a pull request.

5. Claude gives you a **link**. Open it in your browser, click the green
   **Create pull request** button, write one line about what you did, and submit. 🚀

That's it! Your dad gets a message and can add your change to the game.

---

## 📏 3 golden rules

- 🌿 **Never work on "main."** Always ask Claude to make a **new branch** first.
  (Claude already knows this — just remember to say it.)
- 🗣️ **Stuck? Ask Claude.** Typing *"I'm confused, what do I do next?"* always works.
- 🐣 **Start tiny.** Your first change could be fixing a spelling mistake. Small wins first!

---

## 💡 Easy first ideas

- ✍️ Add your name to **[CONTRIBUTORS.md](./CONTRIBUTORS.md)** — a perfect first pull request!
- 🧭 **Shape the game's goal.** Open **[context/goal.md](./context/goal.md)** and
  change what the game is about — add a level, invent a creature, or a whole new
  idea. Just tell Claude *"help me update the goal — I want …"*. It's yours now!
- 🎨 Change a color or the fog in the game and see what happens.
- 📦 **Add a prop.** The game's furniture, signs, and even wall/floor textures are
  just files you drop in and register — no coding. Tell Claude *"help me add a
  prop / a warning sign / a wall texture"* and it'll find a free one and wire it
  up. (See **Adding content** in the [README](./README.md).)
- 🕹️ **Explore with the dev console.** In-game, press the **`~`** key (top-left of
  your keyboard, above Tab) and type **`help`** to see every command. Try `room` to
  teleport to a random room, `seed new` to rebuild the whole maze, or `proproom` to
  visit a chamber showing every prop in the game at once — handy for seeing what
  you've added.

Have fun, Flynn. This is your game too now. 👾🟡
