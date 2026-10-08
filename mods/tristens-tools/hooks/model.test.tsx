import { expect, test } from 'claude-code/testing'

test('model and effort picked in the tools pane reach the request', async ($, on) => {
  const sent: { model: string; effort?: unknown }[] = []
  on('turn.step', async function* (_$, e) {
    sent.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  const ui = await $.ui.mount({ plugin: 'tristens-tools', surface: 'terminal', component: 'Pane', requestId: 'tools', props: {} } as never)
  await ui.press({ key: 'm-sonnet' })
  await ui.press({ key: 'e-high' })
  await ui.unmount()
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', effort: 'medium', messageCount: 1 })) void _
  expect(sent.at(-1)).toEqual({ model: 'claude-sonnet-5-5', effort: 'high' })
})
