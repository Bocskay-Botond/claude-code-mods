# 🤖 Mod Builder Prompt

Claude Code can build mods for you. It has a built-in skill for it, so a plain "make me a mod that…" already works. This prompt gets you a **much better first version**: it nails down the design before any code is written and makes Claude test its work.

## How to use it

1. Open Claude Code in a terminal.
2. Copy the prompt below, fill in the `[brackets]`, and send it.
3. When asked **"Enable hot reloading for this session?"**, choose **Enable for this session**. The mod appears live when Claude's turn ends.
4. Keep iterating in plain language: *"make it purple"*, *"add a hotkey"*, *"also show it in the desktop app"*.

## The prompt

```text
Build me a Claude Code mod (a plugin of function hooks).

WHAT IT DOES
[One or two sentences. Example: "A pomodoro timer above the prompt: /pomo starts 25 minutes,
shows a progress bar and the time left, and pops a toast + plays a sound when it ends."]

WHERE IT SHOWS UP
[Pick: a band above the prompt / a pane I open with a command / the status line / toasts only /
no UI, it just changes behaviour]

COMMANDS
[Example: /pomo start, /pomo stop. Or: "none"]

LOOK & FEEL
[Colors, symbols, how compact. Example: "one line, tomato red, uses ▰▱ for the bar"]

RULES
- Keep whatever other mods draw: in ui.render call `await next(e)` and include it in your tree.
- Step aside when `e.props.hasSurvey` is true.
- Declare every $.state value in types/index.d.ts.
- Give every Button a stable key.
- Write at least one *.test.tsx and make `claude plugin validate` and `claude plugin test` pass.
- Draw on both the terminal and desktop surfaces.

When it works, tell me how to share it as a GitHub marketplace.
```

## Ideas to get you started

- 🍅 Pomodoro timer above the prompt
- 💸 Live cost/token meter for the session
- 🔒 A guard that blocks `rm -rf` and `git push --force` unless you confirm
- 🔊 Play a sound when a long turn finishes
- 🌦️ Weather or calendar line in the status bar (`$.process.run` + any CLI)
- 🎲 A tiny game in a pane: Snake, Tetris, Wordle
- 📝 Auto-append "answer in Hungarian" (or any rule) to the system prompt with a toggle

Built something fun? Open a PR and add it to [`mods/`](../mods)! 🎉
