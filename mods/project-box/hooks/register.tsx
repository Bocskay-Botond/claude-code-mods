import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bump, Category, Layout } from '../types'

// Shown until ~/.claude/project-box.json exists (see project-box.example.json).
const DEMO: Category[] = [
  {
    id: 'ai', name: 'AI & Agents', color: 'magenta',
    projects: [
      { id: 'assistant', name: 'Home Assistant', dir: 'projects/assistant', note: 'Multi-agent assistant with a FastAPI dashboard' },
      { id: 'voice', name: 'Voice Wake-up', dir: 'projects/voice', note: 'Wake word -> STT -> LLM -> TTS' },
    ],
  },
  {
    id: 'web', name: 'Websites', color: 'green',
    projects: [
      { id: 'booking', name: 'Booking App', dir: 'projects/booking', note: 'Node/Express/SQLite appointment booking, live at example.com', live: true },
      { id: 'landing', name: 'Landing Page', dir: 'projects/landing', note: 'GSAP-animated landing page' },
    ],
  },
  {
    id: 'auto', name: 'Automation', color: 'yellow',
    projects: [
      { id: 'news', name: 'Daily News', dir: 'scripts', note: 'Scheduled morning news email', live: true },
      { id: 'mods', name: 'Claude mods', dir: 'claude-code-mods', note: 'This repo: buddy, tools, this box' },
    ],
  },
]

const WIDE = 46
// The closed card's width: room for the longest category name.
const narrowOf = (cats: Category[]) => Math.min(30, Math.max(24, ...cats.map(c => c.name.length + 8)))
// Below `narrow + STACK_GAP` columns (a half-screen window, a phone over SSH)
// the card no longer fits beside the status rows: it stacks above them instead.
const STACK_GAP = 42

const isHidden = atom({ plugin: 'project-box', key: 'isHidden' } as const, false)
const openCat = atom({ plugin: 'project-box', key: 'openCat' } as const, '')
const openProject = atom({ plugin: 'project-box', key: 'openProject' } as const, '')
const categories = atom({ plugin: 'project-box', key: 'categories' } as const, DEMO)
// published so neighbours (pixel-buddy) lay out around the card instead of guessing
const layout = atom({ plugin: 'project-box', key: 'layout' } as const, { narrow: narrowOf(DEMO), wide: WIDE, stack: narrowOf(DEMO) + STACK_GAP } as Layout)
// pixel-buddy's football now and then misses and hits this card (read only):
// it shakes, falls apart, then comes back row by row
const bump = atom({ plugin: 'pixel-buddy', key: 'bump' } as const, { phase: 'none', step: 0 } as Bump)

const isCategory = (c: unknown): c is Category => {
  const x = c as Category
  return typeof x?.id === 'string' && typeof x.name === 'string' && Array.isArray(x.projects)
    && x.projects.every(p => typeof p?.id === 'string' && typeof p.name === 'string')
}

const loadConfig = async ($: EngineInterface): Promise<Category[]> => {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  if (home === undefined) return DEMO
  const text = await $.fs.read(`${home}/.claude/project-box.json`).catch(() => undefined)
  if (text === undefined) return DEMO
  try {
    const list = (JSON.parse(text) as { categories?: unknown }).categories
    if (!Array.isArray(list) || !list.every(isCategory)) throw new Error('bad shape')
    return list.map(c => ({
      ...c,
      color: c.color ?? 'cyan',
      projects: c.projects.map(p => ({ ...p, dir: p.dir ?? '', note: p.note ?? '' })),
    }))
  } catch {
    $.ui.toast('project-box: ~/.claude/project-box.json is not valid, showing the demo list')
    return DEMO
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'projects', description: 'Show or hide the project box' })
    const list = await loadConfig($)
    await update($, categories, () => list)
    await update($, layout, () => ({ narrow: narrowOf(list), wide: WIDE, stack: narrowOf(list) + STACK_GAP }))

    return next(e)
  })

  on('command.run', { command: 'projects' }, async $ => {
    const hidden = await update($, isHidden, h => !h)

    return { text: hidden ? 'Project box hidden.' : 'Project box shown.' }
  })

  // The card sits inside the band, to the right of the status rows.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey || (await read($, isHidden))) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const [cats, cat, proj] = await Promise.all([read($, categories), read($, openCat), read($, openProject)])
    const total = cats.reduce((n, c) => n + c.projects.length, 0)
    const narrow = narrowOf(cats)
    const width = cat === '' ? narrow : Math.min(WIDE, Math.max(narrow, e.props.bodyColumns - 40))

    const toggleCat = async (id: string) => {
      await update($, openCat, cur => (cur === id ? '' : id))
      await update($, openProject, () => '')
    }
    const toggleProject = (id: string) => update($, openProject, cur => (cur === id ? '' : id))

    // Narrow: one wrapped row of category buttons above the band; an open
    // category drops its projects below it, full width, one line each.
    if (e.props.bodyColumns < narrow + STACK_GAP) {
      const open = cats.find(c => c.id === cat)
      return (
        <Box flexDirection="column">
          <Box flexWrap="wrap">
            <Text bold>◆ </Text>
            {cats.map((c, i) => (
              <Box marginRight={1}>
                <Text color={c.color}>{c.id === cat ? '▾' : '▸'}</Text>
                <Button key={`cat:${c.id}`} plain hotkey={i < 9 ? String(i + 1) : undefined} label={c.name.split(' ')[0]} onPress={() => toggleCat(c.id)} />
              </Box>
            ))}
          </Box>
          {open && (
            <Box flexDirection="column" borderStyle="round" borderColor={open.color} paddingX={1}>
              {open.projects.map(p => (
                <Box flexDirection="column">
                  <Box>
                    <Text color={p.live ? 'green' : 'gray'}>{p.live ? '● ' : '◇ '}</Text>
                    <Button key={`p:${p.id}`} plain label={p.name} onPress={() => toggleProject(p.id)} />
                  </Box>
                  {p.id === proj && (
                    <Box flexDirection="column" paddingLeft={2}>
                      <Text dimColor wrap="wrap">{p.note}</Text>
                      <Text dimColor wrap="truncate-middle">{p.dir === '' ? '~' : `~/${p.dir}`}</Text>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {below}
        </Box>
      )
    }

    const hit = await read($, bump)
    if (hit.phase !== 'none') {
      const shift = (i: number) => ' '.repeat((i * 7 + hit.step * 3) % 4)
      const strew = (text: string, i: number) =>
        text.split('').map((ch, k) => ((k + i + hit.step) % 3 === 0 ? ` ${ch}` : ch)).join('')
      const back = hit.phase === 'rebuild' ? Math.ceil((hit.step / 10) * cats.length) : 0
      const title = hit.phase === 'hit' ? '◆ Projects ✸' : hit.phase === 'scatter' ? strew('◆ Projects', 0) : '◆ Projects'
      return (
        <Box flexDirection="row" alignItems="flex-end">
          <Box flexDirection="column" flexGrow={1} flexShrink={1}>
            {below}
          </Box>
          <Box width={width} flexShrink={0} marginLeft={2} flexDirection="column" borderStyle="round" borderColor={hit.phase === 'hit' ? 'red' : hit.phase === 'scatter' ? 'yellow' : 'gray'} paddingX={1}>
            <Text bold wrap="truncate-end">{title}</Text>
            {cats.map((c, i) => {
              const row = c.name
              if (hit.phase === 'hit') {
                return <Text wrap="truncate-end"><Text color={c.color}>{shift(i)}▸ </Text>{row}</Text>
              }
              if (hit.phase === 'scatter') {
                return (i + hit.step) % 2 === 0
                  ? <Text dimColor wrap="truncate-end">{shift(i)}{strew(row, i)}</Text>
                  : <Text dimColor wrap="truncate-end">{shift(i + 1)} ·  ·</Text>
              }
              return i < back
                ? <Text wrap="truncate-end"><Text color={c.color}>▸ </Text>{row}</Text>
                : <Text dimColor wrap="truncate-end">  · · ·</Text>
            })}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="row" alignItems="flex-end">
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {below}
        </Box>
        <Box width={width} flexShrink={0} marginLeft={2} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Box justifyContent="space-between">
            <Text>
              <Text bold>◆ Projects</Text>
              <Text dimColor> {total}</Text>
            </Text>
            {cat !== '' && <Button key="close" plain dimColor label="✕" onPress={() => toggleCat(cat)} />}
          </Box>
          {cats.map((c, i) => {
            const isOpen = c.id === cat
            return (
              <Box flexDirection="column">
                <Box justifyContent="space-between">
                  <Box>
                    <Text color={c.color}>{isOpen ? '▾ ' : '▸ '}</Text>
                    <Button key={`cat:${c.id}`} plain hotkey={i < 9 ? String(i + 1) : undefined} label={c.name} onPress={() => toggleCat(c.id)} />
                  </Box>
                  <Text dimColor>{c.projects.length}</Text>
                </Box>
                {isOpen &&
                  c.projects.map((p, j) => {
                    const isLast = j === c.projects.length - 1
                    const isSel = p.id === proj
                    return (
                      <Box flexDirection="column">
                        <Box>
                          <Text dimColor>{isLast ? ' └ ' : ' ├ '}</Text>
                          <Text color={p.live ? 'green' : 'gray'}>{p.live ? '● ' : '◇ '}</Text>
                          <Button key={`p:${p.id}`} plain label={p.name} onPress={() => toggleProject(p.id)} />
                        </Box>
                        {isSel && (
                          <Box flexDirection="column" paddingLeft={5}>
                            <Text wrap="wrap">{p.note}</Text>
                            <Text dimColor wrap="truncate-middle">{p.dir === '' ? '~' : `~/${p.dir}`}</Text>
                          </Box>
                        )}
                      </Box>
                    )
                  })}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
