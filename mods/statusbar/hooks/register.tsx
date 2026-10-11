import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Bar } from '../types'

const initial: Bar = { phase: 'idle', tools: 0, lastTool: '', seconds: 0, turns: 0 }
const bar = atom({ plugin: 'statusbar', key: 'bar' } as const, initial)

export const register: Register = on => {
  let startedAt = 0

  on('prompt.submit', async ($, e, next) => {
    startedAt = await $.clock.now()
    await update($, bar, b => ({ ...b, phase: 'working', tools: 0, lastTool: '' }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await update($, bar, b => ({ ...b, tools: b.tools + 1, lastTool: e.tool }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const seconds = Math.round(((await $.clock.now()) - startedAt) / 1000)
    await update($, bar, b => ({ ...b, phase: 'idle', seconds, turns: b.turns + 1 }))

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const b = await read($, bar)
    const { Box, Text } = $.ui.resolve(e)
    const isWorking = b.phase === 'working'

    return (
      <Box flexWrap="wrap">
        <Text color={isWorking ? 'yellow' : 'green'}>{isWorking ? '● working' : '○ idle'}</Text>
        <Text dimColor wrap="truncate-end">
          {' │ '}tools {b.tools}
          {b.lastTool ? ` (${b.lastTool})` : ''}
          {' │ '}last turn {b.seconds}s
          {' │ '}turns {b.turns}
        </Text>
      </Box>
    )
  })
}
