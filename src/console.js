// A Quake-style developer console, toggled with the tilde/backquote key. Replaces
// the old numbered dev menu with a typed command line — every dev action is a
// command, and new ones are one `register()` call.
//
// Input while open is captured in the CAPTURE phase and stopped there
// (stopImmediatePropagation), so keystrokes never reach the player controller or
// the rest of the game — typing a command can't also move you or toggle mute.
// main.js pauses the player on open so movement/look freeze cleanly.
//
// Commands are game-agnostic here: main.js registers them with closures over the
// world/player/entities it owns. A command is `run(args, con)` where `con` can
// `con.print(...)`; anything it returns is printed too.

export class DevConsole {
  constructor({ onOpen, onClose } = {}) {
    this.commands = new Map();
    this.history = [];
    this.histIndex = -1;
    this.line = "";
    this.isOpen = false;
    this._onOpen = onOpen;
    this._onClose = onClose;
    this._buildDom();

    this.register("help", "list commands (or `help <cmd>`)", (args) => {
      if (args[0]) {
        const c = this.commands.get(args[0]);
        return c ? `${args[0]} — ${c.help}` : `no such command: ${args[0]}`;
      }
      const names = [...this.commands.keys()].sort();
      this.print("commands:");
      for (const n of names) this.print(`  ${n.padEnd(12)} ${this.commands.get(n).help}`);
    });
    this.register("clear", "clear the console", () => {
      this.logEl.innerHTML = "";
    });

    // Capture-phase so nothing else in the game sees keys while we're open.
    window.addEventListener("keydown", (e) => this._onKeyDown(e), true);
  }

  register(name, help, run) {
    this.commands.set(name, { help, run });
    return this;
  }

  _buildDom() {
    const el = document.createElement("div");
    el.id = "dev-console";
    el.className = "hidden";
    el.innerHTML = `<div class="con-log"></div><div class="con-line"><span class="con-prompt">&gt;</span> <span class="con-text"></span><span class="con-cursor">▏</span></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.logEl = el.querySelector(".con-log");
    this.textEl = el.querySelector(".con-text");
  }

  _onKeyDown(e) {
    if (e.code === "Backquote") {
      // Tilde always toggles — and is swallowed so it never types a `~`.
      e.preventDefault();
      e.stopImmediatePropagation();
      this.toggle();
      return;
    }
    if (!this.isOpen) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // the game must not see this key

    if (e.code === "Escape") return this.close();
    if (e.code === "Enter") return this._submit();
    if (e.code === "Backspace") {
      this.line = this.line.slice(0, -1);
    } else if (e.code === "ArrowUp") {
      this._recall(1);
    } else if (e.code === "ArrowDown") {
      this._recall(-1);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.line += e.key;
    }
    this._render();
  }

  _recall(dir) {
    if (!this.history.length) return;
    this.histIndex = Math.max(-1, Math.min(this.history.length - 1, this.histIndex + dir));
    this.line = this.histIndex < 0 ? "" : this.history[this.history.length - 1 - this.histIndex];
  }

  _submit() {
    const line = this.line.trim();
    this.line = "";
    this.histIndex = -1;
    this._render();
    if (!line) return;
    this.history.push(line);
    this.print(`> ${line}`);
    this.run(line);
  }

  run(line) {
    const [name, ...args] = line.split(/\s+/);
    const cmd = this.commands.get(name);
    if (!cmd) return this.print(`unknown command: ${name} (try 'help')`);
    try {
      const out = cmd.run(args, this);
      if (out !== undefined && out !== null) this.print(String(out));
    } catch (err) {
      this.print(`error: ${err.message}`);
    }
  }

  print(text = "") {
    for (const l of String(text).split("\n")) {
      const div = document.createElement("div");
      div.textContent = l;
      this.logEl.appendChild(div);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  _render() {
    this.textEl.textContent = this.line;
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.el.classList.remove("hidden");
    this._render();
    this._onOpen?.();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add("hidden");
    this.line = "";
    this.histIndex = -1;
    this._onClose?.();
  }
}
