import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// One value the band reads; update() redraws every reader.
const count = atom({ plugin: 'hello-mod', key: 'count' } as const, 0)

export const register: Register = on => {
  // 1. Register a slash command when the session starts.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hello', description: 'Say hello from your first mod' })
    return next(e)
  })

  // 2. Answer it: bump the counter and pop a toast.
  on('command.run', { command: 'hello' }, async $ => {
    const n = await update($, count, c => c + 1)
    $.ui.toast(`Hello #${n} from hello-mod 👋`)
    return { text: `Hello! You said hi ${n} time${n === 1 ? '' : 's'}.` }
  })

  // 3. Draw a one-line band above the prompt.
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
}
