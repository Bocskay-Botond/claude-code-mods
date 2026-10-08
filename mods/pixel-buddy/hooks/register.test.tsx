import { expect, test } from 'claude-code/testing'

test('critter is drawn above the prompt and /buddy hides it', async ($, on) => {
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e as never) as { Text: (p: object) => unknown }
    return (<Text>{''}</Text>) as never
  })
  const props = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80 }
  const ui = await $.ui.mount({ plugin: 'pixel-buddy', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await ui.find({ key: 'buddy' })).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'buddy', args: '' } as never)
  const hidden = await $.ui.mount({ plugin: 'pixel-buddy', surface: 'terminal', component: 'AbovePrompt', props } as never)
  expect(await hidden.find({ key: 'buddy' })).toBeUndefined()
  await hidden.unmount()
})
