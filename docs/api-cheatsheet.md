# 📋 Mod API Cheatsheet

The parts of the API the mods in this repo actually use. The authoritative reference is the `.d.ts` Claude Code writes into `<mod>/.claude-plugin/types/` when a mod loads. Grep it for any name below.

## Events (`on(name, matcher?, hook)`)

| Event | When | Typical use | Seen in |
|---|---|---|---|
| `session.start` | session starts / mod reloads | register commands, start timers, load config | all |
| `command.run` `{ command }` | user runs your slash command | return `{ text }` | all |
| `prompt.edit` | every keystroke in the prompt (50 ms budget!) | live reactions | pixel-buddy |
| `prompt.submit` | user sends a prompt | rewrite with `next({ ...e, text })` | statusbar, tristens-tools |
| `prompt.compose` | system prompt is assembled | add `{ id, text, scope: 'session' }` to `sections` | tristens-tools |
| `turn.step` *(stream)* | each model request in a turn | change `model` / `effort`, using `async function*` and `yield* next(e)` | tristens-tools |
| `tool.call` `{ tool? }` | Claude runs a tool | count, block (`{ deny }`), rewrite | statusbar, pixel-buddy |
| `turn.complete` | Claude's turn ends | "done!" reactions | statusbar, pixel-buddy |
| `session.measure` | usage/context changed | refresh meters | tristens-tools |
| `ui.render` `{ component }` | something is drawn | return your own tree | all |

Components you can draw over: `AbovePrompt` (the band above the input), `Pane` + `requestId` (your own panels), `ToolUse` / `ToolResult` / `ToolGroup` (transcript rows), and more (see `ui.render` in the types).

## The `$` nouns

| Call | Does |
|---|---|
| `$.command.register({ name, description })` | adds `/name` |
| `$.ui.toast(text)` | small popup |
| `$.ui.status(text)` | status line entry |
| `$.ui.open({ id, title, focus })` / `$.ui.close({ id })` | opens/closes a Pane drawn by `ui.render { component: 'Pane', requestId: id }` |
| `$.ui.resolve(e)` | the surface's elements: `Box`, `Text`, `Button`, `Raster`, … |
| `$.ui.blit({ requestId, key, cells, columns, rows })` | repaints a `Raster` without a full redraw |
| `$.clock.now()` / `$.clock.every(ms, fn)` | time and timers (dropped on reload) |
| `$.session.model()` / `$.session.usage()` | current model, context % and rate limits |
| `$.agent.list()` | running/finished subagents |
| `$.config.set({ key, value })` | change a setting, e.g. `model` |
| `$.prompt.fill({ text, mode })` | put text into the prompt box |
| `$.fs.read(path)` / `$.fs.write(path, text)` | files |
| `$.env.get('NAME')` | environment variables (string literal names only) |
| `$.process.run(argv, { timeoutMs })` | run a program, get `{ stdout }` |

## State

```ts
const x = atom({ plugin: 'my-mod', key: 'x' } as const, initialValue)
await read($, x)              // in ui.render: subscribes the drawing
await update($, x, v => v+1)  // anywhere: writes and redraws readers
```

Declare every key in `types/index.d.ts` under `interface PluginState`. `$.state` lives for the session; `$.store` persists across sessions. Module-level variables reset on every hot reload.

**Reading another mod's state** is allowed: declare its keys in your contract too (see how pixel-buddy reads project-box).

## Elements (Ink-style)

```tsx
<Box flexDirection="row|column" justifyContent="space-between" borderStyle="round" borderColor="gray" paddingX={1} width={24}>
<Text color="magenta" bold dimColor backgroundColor="#e8714a" wrap="truncate-end">
<Button key="id" label="Click" variant="primary|secondary" plain hotkey="a" onPress={() => …} />
<Raster key="id" columns={32} rows={4} cells={base64} />
```

Give every `Button` a stable `key`, which is how tests find and press it.

## Guard hooks

A hook that can **refuse** something (`tool.call`, `prompt.submit`, `command.run`, …) is skipped if it throws. To fail closed:

```ts
on('tool.call', { tool: 'Bash' }, hook)
  .catch(($, e, next) => next.called ? next(e) : { deny: 'guard failed' })
```
