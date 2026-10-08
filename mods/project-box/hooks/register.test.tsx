import { test, expect } from 'claude-code/testing'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 30,
  bodyColumns: 160,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

test('a category and a project open and close', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }) as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'project-box', surface, component: 'AbovePrompt', props: BAND as never,
      viewport: { columns: 200, rows: 60, isFullscreen: true },
    })
    expect(await ui.find({ key: 'p:booking' })).toBeUndefined()
    await ui.press({ key: 'cat:web' })
    expect(await ui.find({ key: 'p:booking' })).toBeDefined()
    await ui.press({ key: 'p:booking' })
    expect(await ui.find({ type: 'Text', text: /example\.com/ })).toBeDefined()
    await ui.press({ key: 'close' })
    expect(await ui.find({ key: 'p:booking' })).toBeUndefined()
    await ui.unmount()
  }
})
