import { expect, test } from 'claude-code/testing'

test('/hello bumps the counter shown in the band', async ($, on) => {
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e as never) as { Text: (p: object) => unknown }
    return (<Text>{''}</Text>) as never
  })
  await $.command.run({ command: 'hello', args: '' } as never)
  await $.command.run({ command: 'hello', args: '' } as never)
  const props = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80 }
  const ui = await $.ui.mount({ plugin: 'hello-mod', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await ui.find({ type: 'Text', text: /pressed 2×/ })).toBeDefined()
  await ui.unmount()
})
