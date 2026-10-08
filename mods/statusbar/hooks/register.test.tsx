import { expect, mock, test } from 'claude-code/testing'

test('the bar counts tool calls and shows the last tool', async ($, on) => {
  mock.clock(on)
  on('prompt.submit', async (_$, e) => ({ text: e.text }) as never)
  on('tool.call', async () => ({ result: { text: '' } }) as never)
  await $.prompt.submit({ text: 'hi' } as never)
  await $.tool.call({ tool: 'Read', file_path: 'README.md' } as never)
  const props = { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 80 }
  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await ui.find({ type: 'Text', text: /tools 1 \(Read\)/ })).toBeDefined()
  await ui.unmount()
})
