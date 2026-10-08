# 📦 Installation

There are three ways to run a mod, depending on whether you're **using** it or **building** it.

## 1. From GitHub (users)

The one-liner, which adds the marketplace and installs in a single step:

```
/plugin install pixel-buddy --marketplace Bocskay-Botond/claude-code-mods
```

Or the two-step version, handy when you want several mods:

```
/plugin marketplace add Bocskay-Botond/claude-code-mods
/plugin install pixel-buddy@claude-code-mods
```

What you'll see:

1. `Add marketplace?` showing `github:Bocskay-Botond/claude-code-mods`. Press `y`.
2. The plugin details and a scope picker. **User** (first) loads it in every session. Press **Enter**.
3. `Installed pixel-buddy. Plugin is now active.`

Updating later:

```bash
claude plugin update pixel-buddy@claude-code-mods
```

Then `/reload-plugins` in any open session.

> `/plugin install` is a terminal command. The desktop app's Code tab doesn't have it, but a mod installed from a terminal at user scope **does** load there too.

## 2. From a local clone (hacking on the mods)

```bash
git clone https://github.com/Bocskay-Botond/claude-code-mods.git
claude plugin marketplace add ./claude-code-mods
claude plugin install pixel-buddy@claude-code-mods
```

A marketplace added from a **folder** is read live from that folder. Edit a file, run `/reload-plugins`, and the change is in. You don't need a new version or a reinstall.

## 3. One session only (developing a new mod)

```bash
claude --plugin-dir ./examples/hello-mod
```

The folder is watched: save a file and the mod hot-reloads. Repeat `--plugin-dir` for several mods. If you can't pass a flag (desktop app, SDK), set `CLAUDE_CODE_PLUGIN_DIRS` to the folder path(s), either in your environment or in the `env` block of `~/.claude/settings.json`.

## Managing mods

| Task | Command |
|---|---|
| See what's installed | `/plugin` or `claude plugin list` |
| Disable without uninstalling | `/plugin` → select → disable |
| Uninstall | `claude plugin uninstall pixel-buddy@claude-code-mods` |
| Re-read after edits/updates | `/reload-plugins` |
| Check a mod before loading it | `claude plugin validate <folder>` |
| Run a mod's tests | `claude plugin test <folder>` |
