import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import type { AgentRow, Game, Meter, Run, Seen, Step } from '../types'

const BRAND = "Tristen's Tools"
const ORANGE = '#e8714a'
const PURPLE = '#a06bd6'
const GREEN = '#2fd27a'

const isClean = atom({ plugin: 'tristens-tools', key: 'isClean' } as const, false)
const isUpgrade = atom({ plugin: 'tristens-tools', key: 'isUpgrade' } as const, false)
const model = atom({ plugin: 'tristens-tools', key: 'model' } as const, 'default')
const effort = atom({ plugin: 'tristens-tools', key: 'effort' } as const, 'default')
const helper = atom({ plugin: 'tristens-tools', key: 'helper' } as const, 'haiku')
const team = atom({ plugin: 'tristens-tools', key: 'team' } as const, '0')
const IDLE: Run = { phase: 'idle', prompt: '', startedAt: 0, tools: 0, lastTool: '', steps: [] }
const run = atom({ plugin: 'tristens-tools', key: 'run' } as const, IDLE)
const agents = atom({ plugin: 'tristens-tools', key: 'agents' } as const, [] as AgentRow[])
const meter = atom({ plugin: 'tristens-tools', key: 'meter' } as const, { ctx: 0, five: 0, now: 0 } as Meter)
const seen = atom({ plugin: 'tristens-tools', key: 'seen' } as const, { model: '', effort: '' } as Seen)
const FRESH: Game = { isRunning: false, isOver: false, x: 1, score: 0, best: 0, obstacles: [] }
const game = atom({ plugin: 'tristens-tools', key: 'game' } as const, FRESH)

const MODELS: Record<string, { id: string; label: string }> = {
  haiku: { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
  sonnet: { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  opus: { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  fable: { id: 'claude-fable-5-1', label: 'Fable 5.1' },
}
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
const EFFORT_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' }
const SIZES = ['1', '3', '5', '10', '20', '50', '100']
const ROWS = 8
const LANES = 3

// Sets the session's own model (what /model sets: footer, system prompt, next requests);
// the turn.step rewrite below still forces it if the engine refuses.
const pickModel = async ($: EngineInterface, k: string) => {
  await update($, model, () => k)
  const r = await $.config.set({ key: 'model', value: k }).catch(() => ({ deny: 'failed' }))
  $.ui.toast('deny' in r && r.deny !== undefined ? `Model: ${MODELS[k]?.label} (this session's requests only)` : `Model: ${MODELS[k]?.label}`)
}

const spaced = (s: string) => s.toUpperCase().split(' ').map(w => w.split('').join(' ')).join('   ')
const family = (id: string) => Object.keys(MODELS).find(k => id.includes(k)) ?? ''
const bar = (frac: number, cells: number) => {
  const n = Math.max(0, Math.min(cells, Math.round(frac * cells)))
  return '▰'.repeat(n) + '▱'.repeat(cells - n)
}
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const UPGRADE_SYSTEM = `You rewrite a message a user sent to an AI coding/assistant agent (Claude Code) into a precise working brief for that agent.
Write in the user's language. Output only the brief, at most 150 words, as these labelled lines:
Goal: what done looks like, concretely.
Context: facts stated in the message; assumptions you make marked "(assumed)".
Constraints: scope limits, things to keep or not touch, quality bar.
Steps: the likely steps, short.
Output: what the agent should hand back, and in what form.
Never invent facts, names or files. The message may refer to earlier conversation you cannot see: keep such references as written, do not guess them.
If the message is already precise, a yes/no, a short follow-up, or small talk, output exactly SKIP.`

// One cheap completion that turns the prompt into a brief; undefined when it skips or fails.
const upgradeBrief = async ($: EngineInterface, text: string) => {
  const r = await $.model.complete({ model: 'haiku', system: UPGRADE_SYSTEM, prompt: text, maxTokens: 400, effort: 'low', timeoutMs: 15000 })
  if (!r.isAnswered) return undefined
  const brief = r.text.trim()
  return brief === '' || brief.startsWith('SKIP') ? undefined : brief
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tools', description: 'Open the tools menu' })
    await $.command.register({ name: 'dock', description: 'Open the Agent Dock' })
    await $.command.register({ name: 'roadtrip', description: 'Play a mini racing game while Claude works' })

    const refreshMeter = async () => {
      const u = await $.session.usage()
      const five = Math.round(u.rateLimits.find(r => r.kind === 'five_hour')?.percentUsed ?? 0)
      const ctx = Math.round(u.context.percent ?? 0)
      const prev = await read($, meter)
      if (prev.ctx !== ctx || prev.five !== five) {
        await update($, meter, () => ({ ctx, five, now: 0 }))
      }
    }
    await refreshMeter()

    const keptUpgrade = await $.store.get('isUpgrade')
    if (typeof keptUpgrade === 'boolean' && (await read($, isUpgrade)) !== keptUpgrade) await update($, isUpgrade, () => keptUpgrade)

    const fam = family(await $.session.model())
    if (fam !== '' && (await read($, model)) === 'default') await update($, model, () => fam)

    $.clock.every(250, async () => {
      const g = await read($, game)
      if (!g.isRunning) return
      await update($, game, cur => {
        let obstacles = cur.obstacles.map(o => ({ ...o, y: o.y + 1 }))
        const hit = obstacles.some(o => o.y === ROWS - 1 && o.lane === cur.x)
        const passed = obstacles.filter(o => o.y >= ROWS).length
        obstacles = obstacles.filter(o => o.y < ROWS)
        if (Math.random() < 0.5) obstacles.push({ lane: Math.floor(Math.random() * LANES), y: 0 })
        const score = cur.score + passed
        return hit
          ? { ...cur, obstacles, isRunning: false, isOver: true, best: Math.max(cur.best, score), score }
          : { ...cur, obstacles, score }
      })
    })

    $.clock.every(1000, async () => {
      const now = await $.clock.now()
      const list = await $.agent.list()
      const prev = await read($, agents)
      const rows: AgentRow[] = list.map(a => ({
        id: a.id,
        label: a.description || a.type,
        status: a.status,
        startedAt: prev.find(p => p.id === a.id)?.startedAt ?? now,
      }))
      const r = await read($, run)
      if (JSON.stringify(prev) !== JSON.stringify(rows) || rows.some(x => x.status === 'running') || r.phase === 'working') {
        await update($, agents, () => rows)
      }
      await refreshMeter()
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const u = await $.session.usage()
    const five = Math.round(u.rateLimits.find(r => r.kind === 'five_hour')?.percentUsed ?? 0)
    await update($, meter, () => ({ ctx: Math.round(u.context.percent ?? 0), five, now: 0 }))
    return next(e)
  })

  on('command.run', { command: 'tools' }, async $ => {
    await $.ui.open({ id: 'tools', title: BRAND, focus: true })
    return { text: `${BRAND} opened.` }
  })
  on('command.run', { command: 'dock' }, async $ => {
    await $.ui.open({ id: 'dock', title: 'Agent Dock', focus: true })
    return { text: 'Agent Dock open.' }
  })
  on('command.run', { command: 'roadtrip' }, async $ => {
    await $.ui.open({ id: 'roadtrip', title: 'Roadtrip', focus: true })
    return { text: 'Roadtrip opened: a/d steer, s start.' }
  })

  // ---- run tracking (Clean View checklist) ----
  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    const steps: Step[] = [
      { text: 'Understand your request', status: 'active' },
      { text: 'Plan the steps', status: 'next' },
    ]
    await update($, run, () => ({ phase: 'working', prompt: e.text, startedAt: now, tools: 0, lastTool: '', steps }))

    const o = e.origin as PromptOrigin | undefined
    const isTyped = o === undefined || o.kind === 'composer' || o.kind === 'bridge' || (o.kind === 'plugin' && o.asUser === true)
    const text = e.text.trim()
    if (!isTyped || !(await read($, isUpgrade)) || text.startsWith('/') || text.length < 15) return next(e)
    $.ui.status('✦ Prompt Upgrade…')
    const brief = await upgradeBrief($, e.text).catch(() => undefined)
    $.ui.status(undefined)
    if (brief === undefined) return next(e)
    $.ui.log(`✦ Prompt Upgrade brief:
${brief}`)
    const block = `<prompt-upgrade-brief>
An upgraded brief of the user's message above, written by the Prompt Upgrade tool. Work from it; where it conflicts with the user's own words, the user's words win.

${brief}
</prompt-upgrade-brief>`
    return next({ ...e, context: [...(e.context ?? []), block] })
  })
  on('tool.call', async ($, e, next) => {
    const todos = 'todos' in e && Array.isArray(e.todos) ? (e.todos as { content?: string; status?: string }[]) : undefined
    await update($, run, (r): Run => {
      let steps: Step[] = r.steps
      if (todos !== undefined) {
        steps = todos.map(t => ({
          text: t.content ?? '',
          status: t.status === 'completed' ? ('done' as const) : t.status === 'in_progress' ? ('active' as const) : ('next' as const),
        }))
      } else if (r.tools === 0) {
        steps = [
          { text: 'Understand your request', status: 'done' },
          { text: 'Plan the steps', status: 'active' },
        ]
      }
      return { ...r, tools: r.tools + 1, lastTool: e.tool, steps }
    })
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    await update($, run, (r): Run => ({ ...r, phase: 'idle', steps: r.steps.map(s => ({ ...s, status: 'done' as const })) }))
    return next(e)
  })

  // ---- control panel: model / effort override, helper agents' model ----
  on('turn.step', async function* ($, e, next) {
    const [m, f, hp, s] = await Promise.all([read($, model), read($, effort), read($, helper), read($, seen)])
    const wanted = e.agentId !== undefined && hp === 'haiku' ? 'haiku' : m
    const changed = { ...e }
    if (MODELS[wanted] !== undefined) changed.model = MODELS[wanted].id
    if (e.agentId === undefined && (EFFORTS as readonly string[]).includes(f)) changed.effort = f as (typeof EFFORTS)[number]
    if (e.agentId === undefined) {
      const eff = String(changed.effort ?? '')
      if (s.model !== changed.model || s.effort !== eff) await update($, seen, () => ({ model: changed.model, effort: eff }))
    }
    return yield* next(changed)
  })

  // ---- Agent Dock + Prompt Upgrade: extra system prompt sections ----
  on('prompt.compose', async ($, e, next) => {
    const out = await next(e)
    const n = Number(await read($, team))
    const up = await read($, isUpgrade)
    const sections = [...out.sections]
    if (n > 0) {
      sections.push({
        id: 'tristens-tools:team',
        text: `Split each request across about ${n} parallel helper subagents (Agent tool), launching up to 10 at a time, then combine their results.`,
        scope: 'session' as const,
      })
    }
    if (up) {
      sections.push({
        id: 'tristens-tools:upgrade',
        text: "Prompt Upgrade is on. A user message may carry a <prompt-upgrade-brief> block: treat it as the working spec (goal, constraints, steps, output) and check your result against it before you finish; the user's own words override it. When a message has no brief, first restate the request to yourself as goal, constraints and expected output, then work from that.",
        scope: 'session' as const,
      })
    }
    return { sections }
  })

  // ---- Clean View: hide technical rows ----
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, isClean))) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{''}</Text>
  })
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, isClean))) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{''}</Text>
  })
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await read($, isClean))) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text>{''}</Text>
  })

  // ---- band above the prompt: checklist box, status line, tools button ----
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const [r, clean, ov, ef, m, s, a] = await Promise.all([
      read($, run), read($, isClean), read($, model), read($, effort), read($, meter), read($, seen), read($, agents),
    ])
    const now = await $.clock.now()
    const fam = ov !== 'default' ? ov : family(s.model)
    const modelLabel = MODELS[fam]?.label ?? 'Claude'
    const eff = ef !== 'default' ? ef : s.effort || 'medium'
    const running = a.filter(x => x.status === 'running').length
    const working = r.phase === 'working'
    const activeIdx = Math.max(0, r.steps.findIndex(x => x.status === 'active'))
    const doneN = r.steps.filter(x => x.status === 'done').length
    const pct = r.steps.length > 0 ? Math.round((doneN / r.steps.length) * 100) : 0
    // narrower terminals (a half-screen window, a phone over SSH) drop the
    // least useful pieces first, so the line never wraps into a mess
    const cols = e.props.bodyColumns
    const tier = cols >= 112 ? 'full' : cols >= 80 ? 'mid' : 'small'
    const shortModel = tier === 'small' ? modelLabel.split(' ')[0] : modelLabel
    const shortEff = tier === 'small' && eff === 'medium' ? 'med' : eff

    return (
      <Box flexDirection="column">
        {below}
        {clean && working ? (
          <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
            <Box justifyContent="space-between">
              <Text color="magenta" wrap="truncate-end">◆ {r.prompt.slice(0, Math.max(10, Math.min(48, cols - 14)))}{r.prompt.length > Math.min(48, cols - 14) ? '…' : ''}</Text>
              <Text dimColor>{Math.max(1, Math.round((now - r.startedAt) / 1000))}s</Text>
            </Box>
            <Box justifyContent="space-between">
              <Text dimColor>Step {Math.min(activeIdx + 1, r.steps.length)} of {r.steps.length}</Text>
              <Text color="magenta">{pct}%</Text>
            </Box>
            {r.steps.map(st => (
              <Box justifyContent="space-between">
                <Text wrap="truncate-end" bold={st.status === 'active'} dimColor={st.status === 'next'} color={st.status === 'done' ? 'green' : undefined}>
                  {st.status === 'done' ? '✓' : st.status === 'active' ? '▶' : ' '} {st.text}
                </Text>
                <Text color={st.status === 'active' ? 'magenta' : undefined} dimColor={st.status !== 'active'}>
                  {st.status === 'active' ? 'Working' : st.status === 'done' ? 'Done' : 'Next'}
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}
        {clean ? (
          <Box justifyContent="flex-end">
            <Text dimColor>── Clean View</Text>
          </Box>
        ) : null}
        <Box justifyContent="space-between" flexWrap="wrap">
          <Text wrap="truncate-end">
            {tier === 'full' ? (
              <Text>
                <Text color="green">◆ </Text>
                <Text>Subscription</Text>
                <Text dimColor> │ </Text>
              </Text>
            ) : null}
            <Text color="blue">◆ </Text>
            <Text bold>{shortModel}</Text>
            <Text dimColor>{tier === 'small' ? ' │ ' : ' │ effort '}</Text>
            <Text color="yellow" bold>{shortEff}</Text>
            <Text dimColor> │ ctx </Text>
            {tier !== 'small' ? <Text color="green">{bar(m.ctx / 100, tier === 'full' ? 10 : 5)} </Text> : null}
            <Text color="green" bold>{m.ctx}%</Text>
            <Text dimColor> │ 5h </Text>
            <Text color="green" bold>{m.five}%</Text>
            {tier === 'full' || running > 0 ? <Text dimColor> │ ◇ {running}{tier === 'small' ? '' : ' agents'}</Text> : null}
          </Text>
          <Button key="tools" variant="primary" label={tier === 'small' ? '◆ ▾' : `◆ ${BRAND} ▾`} onPress={() => $.ui.open({ id: 'tools', title: BRAND, focus: true })} />
        </Box>
      </Box>
    )
  })

  // ---- Tristen's Tools panel ----
  on('ui.render', { component: 'Pane', requestId: 'tools' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const [clean, up, ov, ef, hp, s] = await Promise.all([
      read($, isClean), read($, isUpgrade), read($, model), read($, effort), read($, helper), read($, seen),
    ])
    const isWide = e.props.bodyColumns >= 64
    const fam = ov !== 'default' ? ov : family(s.model)
    const eff = ef !== 'default' ? ef : s.effort || 'medium'
    const modelName = (k: string) => (isWide ? MODELS[k]?.label : MODELS[k]?.label.split(' ')[0]) ?? k
    const effortName = (k: string) => (isWide || k !== 'medium' ? EFFORT_LABEL[k] : 'Med') ?? k
    const toggle = (key: string, isOn: boolean, flip: () => unknown) => (
      <Button key={key} label={isOn ? '● On' : '○ Off'} variant={isOn ? 'primary' : 'secondary'} onPress={flip} />
    )
    const row = (dot: string, dotColor: string | undefined, name: string, hint: string, control: ReturnType<typeof toggle>) => (
      <Box justifyContent="space-between">
        <Text wrap="truncate-end">
          <Text color={dotColor} dimColor={dotColor === undefined}>{dot} </Text>
          {name}
          {isWide ? <Text dimColor>  {hint}</Text> : null}
        </Text>
        {control}
      </Box>
    )

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between" flexWrap="wrap">
          <Text bold color={ORANGE}>◆ {isWide ? spaced(BRAND) : BRAND.toUpperCase()}</Text>
          <Text dimColor>{MODELS[fam]?.label ?? 'Claude'} · {EFFORT_LABEL[eff] ?? eff}</Text>
        </Box>
        <Box flexWrap="wrap">
          <Text dimColor>{isWide ? 'MODEL   ' : 'MODEL  '}</Text>
          {Object.keys(MODELS).map(k =>
            k === fam ? (
              <Text key={`m-${k}`} backgroundColor={ORANGE} bold> {modelName(k)} </Text>
            ) : (
              <Button key={`m-${k}`} plain dimColor label={` ${modelName(k)} `} onPress={() => pickModel($, k)} />
            ),
          )}
        </Box>
        <Box flexWrap="wrap">
          <Text dimColor>{isWide ? 'EFFORT  ' : 'EFFORT '}</Text>
          {EFFORTS.map(k =>
            k === eff ? (
              <Text key={`e-${k}`} backgroundColor={PURPLE} bold> {effortName(k)} </Text>
            ) : (
              <Button key={`e-${k}`} plain dimColor label={` ${effortName(k)} `} onPress={async () => {
                  await update($, effort, () => k)
                  $.ui.toast(`Effort: ${EFFORT_LABEL[k]} (from the next request)`)
                }} />
            ),
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{spaced('Settings')}</Text>
        </Box>
        {row('●', clean ? GREEN : undefined, 'Clean View', 'simple checklist', toggle('clean', clean, () => update($, isClean, c => !c)))}
        {row('●', up ? GREEN : undefined, 'Prompt Upgrade', 'better prompts', toggle('upgrade', up, async () => {
          await update($, isUpgrade, c => !c)
          await $.store.set('isUpgrade', await read($, isUpgrade))
        }))}
        {row(
          '●',
          undefined,
          'Helper agents',
          'model they use',
          <Button key="helper" label={hp === 'haiku' ? 'Fast & Cheap' : 'Same model'} onPress={() => update($, helper, v => (v === 'haiku' ? 'same' : 'haiku'))} />,
        )}
        <Box marginTop={1}>
          <Text dimColor>{spaced('Launch')}</Text>
        </Box>
        <Box flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 4 : 0}>
          <Button key="create" plain label="✦ Create photo or video" onPress={() => $.prompt.fill({ text: 'Create a photo or video: ', mode: 'insert' })} />
          <Button key="dock" plain label="◆ Agent Dock" onPress={() => $.ui.open({ id: 'dock', title: 'Agent Dock', focus: true })} />
          <Button key="rt" plain label="▶ Roadtrip" onPress={() => $.ui.open({ id: 'roadtrip', title: 'Roadtrip', focus: true })} />
        </Box>
      </Box>
    )
  })

  // ---- Agent Dock ----
  on('ui.render', { component: 'Pane', requestId: 'dock' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const isWide = e.props.bodyColumns >= 64
    const [t, hp, list, r] = await Promise.all([read($, team), read($, helper), read($, agents), read($, run)])
    const now = await $.clock.now()
    const size = Number(t)
    const working = list.filter(x => x.status === 'running')
    const done = list.filter(x => x.status !== 'running')
    const queued = Math.max(0, size - list.length)
    const live = r.phase === 'working' && size > 0 && list.length > 0
    const colors = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']
    const dots = Math.min(Math.max(size, 1), 25)
    const total = Math.max(size, list.length, 1)
    const barCells = Math.max(8, Math.min(30, e.props.bodyColumns - 10))
    const dotRow = Math.max(5, Math.min(25, Math.floor((e.props.bodyColumns - 2) / 2)))

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color={ORANGE}>◆ {isWide ? spaced('Agent Dock') : 'AGENT DOCK'}</Text>
          <Text color={live ? 'blue' : undefined} dimColor={!live}>{live ? '● LIVE' : isWide ? spaced('Standing by') : 'STANDING BY'}</Text>
        </Box>
        <Box flexWrap="wrap">
          <Text dimColor>{isWide ? spaced('Team size') + '  ' : 'TEAM '}</Text>
          <Button key="s0" plain dimColor label=" Off " onPress={() => update($, team, () => '0')} />
          {SIZES.map(k =>
            k === t ? (
              <Text backgroundColor={ORANGE} bold> {k} </Text>
            ) : (
              <Button key={`s-${k}`} plain dimColor label={` ${k} `} onPress={() => update($, team, () => k)} />
            ),
          )}
        </Box>
        <Text dimColor>
          {size > 0 ? `Splits each request across ${size} helpers${isWide ? '   10 at a time' : ''}   ${hp === 'haiku' ? 'Fast & Cheap' : 'Same model'}` : 'Pick a team size; it applies to every request until set to Off.'}
        </Text>
        {size > 20 ? <Text color="yellow">Heads up: a big team burns through your plan limits much faster.</Text> : null}
        {!live ? (
          <Box flexDirection="column" alignItems="center" borderStyle="round" borderColor="green" paddingY={1} marginTop={1}>
            <Text wrap="wrap">
              {Array.from({ length: dots }, (_, i) => (
                <Text color={colors[i % colors.length]}>● </Text>
              ))}
            </Text>
            <Text bold>{size > 0 ? `Your team of ${size} is standing by` : 'No team selected'}</Text>
            <Text dimColor>{size > 0 ? `Send a request and it splits across ${size} helpers.` : 'Requests run on a single agent.'}</Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Box justifyContent="space-between">
              <Text dimColor wrap="truncate-end">{isWide ? spaced('Mission') : 'MISSION'}  <Text bold>{r.prompt.slice(0, 40)}</Text></Text>
              <Text dimColor>{clock(now - r.startedAt)}</Text>
            </Box>
            <Text color="green">{bar(done.length / total, barCells)} {Math.round((done.length / total) * 100)}%</Text>
            <Text>
              <Text color="blue">● {working.length}</Text><Text dimColor> working   ○ {queued} queued   </Text><Text color="green">✓ {done.length}</Text><Text dimColor> done</Text>
            </Text>
            <Text>
              {list.slice(0, dotRow).map(x => (
                <Text color={x.status === 'running' ? 'blue' : 'green'}>● </Text>
              ))}
              {Array.from({ length: Math.max(0, Math.min(queued, dotRow - list.length)) }, () => (
                <Text dimColor>· </Text>
              ))}
            </Text>
            <Text dimColor>{isWide ? spaced('Working now') : 'WORKING NOW'}</Text>
            {working.slice(0, 10).map(x => (
              <Text wrap="truncate-end">
                <Text color="blue">{bar(Math.min(0.95, (now - x.startedAt) / 60000), isWide ? 10 : 5)}</Text> {x.label.slice(0, 32)} <Text dimColor>{clock(now - x.startedAt)}</Text>
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })

  // ---- Roadtrip ----
  on('ui.render', { component: 'Pane', requestId: 'roadtrip' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const g = await read($, game)
    const lines: string[] = []
    for (let y = 0; y < ROWS; y++) {
      let row = '│'
      for (let l = 0; l < LANES; l++) {
        const car = y === ROWS - 1 && l === g.x
        const rock = g.obstacles.some(o => o.y === y && o.lane === l)
        row += car ? ' 🚗 ' : rock ? ' ▲▲ ' : '    '
      }
      lines.push(row + '│')
    }
    const steer = (d: number) => update($, game, c => (c.isRunning ? { ...c, x: Math.max(0, Math.min(LANES - 1, c.x + d)) } : c))
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color={ORANGE}>◆ {spaced('Roadtrip')}  <Text dimColor>score {g.score} · best {g.best}</Text></Text>
        {lines.map(l => <Text>{l}</Text>)}
        {g.isOver ? <Text color="red">Crash! Press start to retry.</Text> : null}
        <Box>
          <Button key="l" label="◀ a" hotkey="a" onPress={() => steer(-1)} />
          <Button key="r" label="d ▶" hotkey="d" onPress={() => steer(1)} />
          <Button key="s" label={g.isRunning ? 'Restart (s)' : 'Start (s)'} hotkey="s" variant="primary" onPress={() => update($, game, c => ({ ...FRESH, best: c.best, isRunning: true }))} />
        </Box>
      </Box>
    )
  })
}
