# 🔨 Writing Your Own Mod

We'll go through [`examples/hello-mod`](../examples/hello-mod) line by line. By the end you'll understand how every mod in this repo works.

## Mods vs. everything else

| | Skill | Slash command (`.md`) | Shell hook (settings.json) | **Mod** |
|---|---|---|---|---|
| Written in | Markdown | Markdown | any script | **TypeScript / TSX** |
| Runs | inside the model's context | inside the model's context | as a separate process per event | **in-process, every event** |
| Can draw UI | ❌ | ❌ | ❌ | ✅ bands, panes, buttons, pixels |
| Can rewrite requests | ❌ | ❌ | partly (allow/deny) | ✅ model, effort, prompts, tool calls |
| Keeps live state | ❌ | ❌ | files only | ✅ atoms + store |

A mod is a **plugin of function hooks**: Claude Code loads your TypeScript module and calls your functions as things happen.

## The four files

```
hello-mod/
├── .claude-plugin/plugin.json
├── hooks/hooks.json
├── hooks/register.tsx
└── types/index.d.ts
```

**`plugin.json`** is the manifest. `types` points at the state contract:

```json
{ "name": "hello-mod", "version": "1.0.0", "description": "…", "types": "./types/index.d.ts" }
```

**`hooks.json`** names the one module to load:

```json
{ "modules": ["./register.tsx"] }
```

**`types/index.d.ts`** declares every value the mod keeps in `$.state`. `claude plugin validate` checks your code against it:

```ts
declare module 'claude-code' {
  interface PluginState {
    'hello-mod': { count: number }
  }
}
```

## The code

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const count = atom({ plugin: 'hello-mod', key: 'count' } as const, 0)
```

An **atom** is a named value in the session's state. `read($, atom)` while drawing subscribes the drawing to it, and `update($, atom, fn)` changes it and **redraws everything that read it**. That's the whole reactivity model.

```tsx
export const register: Register = on => {
```

`register` runs once per load (and again on every hot reload). `on(event, matcher?, hook)` adds a hook.

### Every hook is `($, e, next)`

- **`$`** is the engine. Everything outside your module goes through it: `$.ui`, `$.clock`, `$.session`, `$.fs`, `$.process`, …
- **`e`** is the event's input, a frozen plain object.
- **`next(e)`** passes the event on to the other plugins, then to Claude Code itself, and resolves to the result.

That means you can **watch** (`await next(e)` and look at the result), **rewrite** (`next({ ...e, text: 'new' })`) or **replace** (return without calling `next`). It's middleware, like Express or Koa.

### 1. A slash command

```tsx
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hello', description: 'Say hello from your first mod' })
    return next(e)
  })

  on('command.run', { command: 'hello' }, async $ => {
    const n = await update($, count, c => c + 1)
    $.ui.toast(`Hello #${n} from hello-mod 👋`)
    return { text: `Hello! You said hi ${n} time${n === 1 ? '' : 's'}.` }
  })
```

Register the command in `session.start`, then answer it in a `command.run` hook matched on its name.

### 2. A band above the prompt

```tsx
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const n = await read($, count)
    return (
      <Box flexDirection="column">
        {below}
        <Text>
          <Text color="magenta">◆ hello-mod</Text>
          <Text dimColor> │ /hello pressed {n}×</Text>
        </Text>
      </Box>
    )
  })
```

Three things to notice:

1. **`const below = await next(e)` and `{below}`**: this keeps whatever other mods drew there. Every mod in this repo does this, which is why pixel-buddy, project-box and tristens-tools can share the same band.
2. **Elements come from `$.ui.resolve(e)`**, not from an import. The same code draws in the terminal, the desktop app, VS Code and mobile.
3. **`e.props.hasSurvey`**: step aside when Claude Code needs the space.

## Run it

```bash
claude --plugin-dir ./examples/hello-mod
```

Type `/hello` a few times. 👋

## Test it

```tsx
import { expect, test } from 'claude-code/testing'

test('/hello bumps the counter shown in the band', async ($, on) => {
  await $.command.run({ command: 'hello', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'hello-mod', surface: 'terminal', component: 'AbovePrompt', props: { … } } as never)
  expect(await ui.find({ type: 'Text', text: /pressed 1×/ })).toBeDefined()
})
```

```bash
claude plugin validate ./examples/hello-mod
claude plugin test ./examples/hello-mod
```

In tests, **nothing sits beneath your hooks**. If your mod calls `next()` on an event, the test must answer it with its own `on(...)`. For the clock, use `mock.clock(on)`. See [`mods/statusbar/hooks/register.test.tsx`](../mods/statusbar/hooks/register.test.tsx).

## Where to go next

Each mod in this repo shows off one bigger technique:

| Read | To learn |
|---|---|
| [statusbar](../mods/statusbar/hooks/register.tsx) | reacting to `prompt.submit`, `tool.call` and `turn.complete` |
| [project-box](../mods/project-box/hooks/register.tsx) | Buttons with hotkeys, reading a config file with `$.fs`, sitting **beside** other bands |
| [tristens-tools](../mods/tristens-tools/hooks/register.tsx) | **Panes** (`$.ui.open`), rewriting the **model and effort** per request (`turn.step`), adding **system-prompt sections** (`prompt.compose`), hiding tool rows, a game loop on `$.clock.every` |
| [pixel-buddy](../mods/pixel-buddy/hooks/register.tsx) | **pixel graphics** with the `Raster` element and `$.ui.blit` at 25 fps, reading **another mod's state** |

And the [API cheatsheet](api-cheatsheet.md).

> 📖 The full API reference is written by Claude Code itself: once a mod has loaded, look in `<mod>/.claude-plugin/types/claude-code/index.d.ts` (about 14k lines, every event, noun and element with doc comments and examples).
