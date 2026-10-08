# ⚡ Quick Start: All Mods in 5 Minutes

## 1. Check your Claude Code version

```bash
claude --version
```

You need **2.1.294 or newer**. Update with `claude update` if needed.

## 2. Add the marketplace and install everything

In a Claude Code terminal session:

```
/plugin marketplace add Bocskay-Botond/claude-code-mods
/plugin install pixel-buddy@claude-code-mods
/plugin install tristens-tools@claude-code-mods
/plugin install project-box@claude-code-mods
```

Pick the **user** scope (the first option) for each so they load in every session. Mods are active right away, with no restart.

> 💡 `statusbar` is a simpler alternative to the status line in `tristens-tools`. Install one or the other, not both.

## 3. Take a tour (2 minutes)

| Try this | What happens |
|---|---|
| Start typing anything | 🐾 the critter pulls out a laptop and types along |
| Send a prompt | it thinks (`?`), then patrols with the name of each tool Claude runs |
| Wait 20 seconds | it starts playing: keepy-uppy, jump rope, dancing… |
| `/pet` | ♥ ♥ |
| `/tools` | 🛠️ opens the tools menu: pick model and effort, toggle Clean View |
| `/dock` | the Agent Dock: pick a team size, send a request, watch the helpers |
| `/roadtrip` | a racing game for long tasks: `a`/`d` to steer, `s` to start |
| Press `2` in the project box | opens the 2nd category. Click a project and the critter runs over to it |

## 4. Make project-box yours

```bash
# macOS / Linux
curl -o ~/.claude/project-box.json https://raw.githubusercontent.com/Bocskay-Botond/claude-code-mods/main/mods/project-box/project-box.example.json
```

```powershell
# Windows
Invoke-WebRequest https://raw.githubusercontent.com/Bocskay-Botond/claude-code-mods/main/mods/project-box/project-box.example.json -OutFile $HOME\.claude\project-box.json
```

Edit the file, then run `/reload-plugins`.

## 5. Turn things off

- `/buddy` hides or shows the critter
- `/projects` hides or shows the project box
- `/plugin` lets you disable or uninstall any mod

**Next:** build your own → [docs/writing-your-own-mod.md](../docs/writing-your-own-mod.md)
