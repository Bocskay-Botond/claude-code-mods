# 🐛 Troubleshooting

## Installing

**`/plugin` says the command isn't available**
You're in the desktop app's Code tab. Install from a terminal (`claude` in any shell). Mods installed at user scope load in the desktop app too.

**`Marketplace file not found at …`**
The repo name is wrong, or you pointed at a fork without `.claude-plugin/marketplace.json`. Use `Bocskay-Botond/claude-code-mods`.

**`Plugin "xyz" not found in marketplace "claude-code-mods"`**
Typo in the mod name. Valid names: `pixel-buddy`, `tristens-tools`, `project-box`, `statusbar`, `hello-mod`.

## Running

**I installed it but nothing shows**
1. `/reload-plugins`
2. `claude plugin list`: is it enabled?
3. Restart with `claude --debug` and look for lines starting with the mod's name. A hook that throws is **skipped, not fatal**, and the reason is logged.

**The critter / project box disappeared**
You (or a stray keystroke) toggled it: `/buddy` or `/projects` brings it back. The band also steps aside while Claude Code shows a survey.

**project-box still shows the demo list**
- The file must be at `~/.claude/project-box.json` (on Windows: `%USERPROFILE%\.claude\project-box.json`).
- It's read at session start: run `/reload-plugins` after editing.
- If the JSON is invalid you'll get a toast saying so. Check it with any JSON validator. Every category needs `id`, `name` and `projects`, and every project needs `id` and `name`.

**Model picker in `/tools` says "this session's requests only"**
The setting couldn't be saved (for example, it's managed by your organization). The override still applies to every request in this session.

**Agent Dock burns through my limits**
That's what 50 parallel agents do. 🙂 Keep the team small, set **Helper agents → Fast & Cheap** (Haiku), and turn the team **Off** when you're done: it applies to *every* request until you do.

**Everything is laggy**
pixel-buddy repaints at 25 fps but only sends changed frames. If your terminal still struggles, hide it with `/buddy`.

## Developing

**`claude plugin validate` complains about state keys**
Every `atom({ plugin, key })` you use must be declared in `types/index.d.ts` under `interface PluginState`.

**My test fails with `no implementation for <event>`**
In tests nothing sits beneath your hooks. Answer the event yourself:

```ts
on('prompt.submit', async (_$, e) => ({ text: e.text }) as never)
on('tool.call', async () => ({ result: { text: '' } }) as never)
mock.clock(on) // for $.clock.now / every
```

**`import()` / `require` doesn't work**
Mods are ES modules with no Node and no DOM. Use static `import` for your own files, and `$` for everything outside the module.

**The API changed after an update**
Mods are early access. Regenerate the types (they're rewritten on every load), run `claude plugin validate`, and fix what it reports. PRs updating the mods here are very welcome.
