import { expect, test } from 'claude-code/testing'

test('tools pane toggles Clean View', async $ => {
  const ui = await $.ui.mount({
    plugin: 'tristens-tools',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'tools',
    props: {},
  } as never)
  expect(await ui.find({ key: 'clean' })).toBeDefined()
  await ui.press({ key: 'clean' })
  expect((await ui.find({ key: 'clean' }))?.text).toMatch(/On/)
  await ui.unmount()
})
