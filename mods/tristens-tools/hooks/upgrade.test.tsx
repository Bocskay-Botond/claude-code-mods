import { expect, test } from 'claude-code/testing'


const kv = new Map<string, unknown>()
const base = (on: any) => {
  kv.clear()
  const _unused = new Map<string, unknown>()
  on('store.get', (_$: unknown, e: { key: string }) => ({ value: kv.get(e.key) }))
  on('store.set', (_$: unknown, e: { key: string; value: unknown }) => { kv.set(e.key, e.value); return { value: undefined } })
  on('clock.now', () => ({ value: 0 }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
}

const F = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] }

test('Prompt Upgrade: brief attached as context, section added, toggle persisted', async ($, on) => {
  base(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' as const }] }))
  let asked = 0
  on('model.complete', () => { asked++; return { value: { isAnswered: true, text: 'Goal: build X. Output: a file', usage: {} } } as never })
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => { seen.push(e.context); return { text: e.text } })

  // off: nothing happens
  await $.prompt.submit({ text: 'csinálj egy weboldalt a borbélynak', asUser: true })
  expect(asked).toBe(0)
  expect((await $.prompt.compose(F)).sections.some(s => s.id === 'tristens-tools:upgrade')).toBe(false)

  const ui = await $.ui.mount({ plugin: 'tristens-tools', surface: 'terminal', component: 'Pane', requestId: 'tools', props: {} } as never)
  await ui.press({ key: 'upgrade' })
  expect(kv.get('isUpgrade')).toBe(true)

  await $.prompt.submit({ text: 'csinálj egy weboldalt a borbélynak', asUser: true })
  expect(asked).toBe(1)
  const ctx = seen[seen.length - 1] ?? []
  expect(ctx.some(c => c.includes('<prompt-upgrade-brief>') && c.includes('Goal: build X'))).toBe(true)
  expect((await $.prompt.compose(F)).sections.find(s => s.id === 'tristens-tools:upgrade')?.text).toMatch(/working spec/)

  // short follow-ups and slash commands are not upgraded
  await $.prompt.submit({ text: 'igen', asUser: true })
  await $.prompt.submit({ text: '/tools please open it now', asUser: true })
  expect(asked).toBe(1)

  await ui.unmount()
})

test('Prompt Upgrade: SKIP or a failed call passes the prompt through untouched', async ($, on) => {
  base(on)
  let reply: unknown = { isAnswered: true, text: 'SKIP', usage: {} }
  on('model.complete', () => ({ value: reply }) as never)
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => { seen.push(e.context); return { text: e.text } })
  const ui = await $.ui.mount({ plugin: 'tristens-tools', surface: 'terminal', component: 'Pane', requestId: 'tools', props: {} } as never)
  await ui.press({ key: 'upgrade' })
  await $.prompt.submit({ text: 'már elég pontos kérés ez itt', asUser: true })
  reply = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded' }
  await $.prompt.submit({ text: 'még egy hosszabb kérés jön ide', asUser: true })
  expect(seen.every(c => !(c ?? []).some(x => x.includes('prompt-upgrade-brief')))).toBe(true)
  expect(seen.length).toBe(2)
  await ui.unmount()
})
