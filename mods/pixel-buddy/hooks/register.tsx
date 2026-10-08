import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// A 12x4 pixel critter drawn with quadrant blocks (one cell = 2x2 pixels, so
// a leg is one pixel: half a column), on a stage of `width` columns, 4 rows.
const isShown = atom({ plugin: 'pixel-buddy', key: 'isShown' } as const, true)

// The project box (project-box) beside the status bar: read (never written) so the
// critter can walk up to it and react when it opens, picks or hides.
const projCat = atom({ plugin: 'project-box', key: 'openCat' } as const, '')
const projPick = atom({ plugin: 'project-box', key: 'openProject' } as const, '')
const projHidden = atom({ plugin: 'project-box', key: 'isHidden' } as const, false)
// its card widths, as project-box lays them out (closed / open cap)
const PROJ_NARROW = 24
const PROJ_WIDE = 46
type ProjEvent = 'open' | 'close' | 'pick' | 'hide' | 'show'
const PROJ_LEN: Record<ProjEvent, number> = { open: 3800, close: 2500, pick: 5500, hide: 2500, show: 3200 }

const ORANGE = 0xd97757
const EYE = 0x1c1c1c
const GOLD = 0xf5c26b
const SLEEPY = 0x8ea4d2
const PINK = 0xe0607e
const GREEN = 0x2fd27a
const DIM = 0x8a8a8a
const LID = 0x5d6169
const KEYS = 0xa7adb5
const SCREEN = 0x6fa8dc
const SCREEN_LIT = 0xcfe8ff
const BALL = 0xf2f2f2
const ROPE = 0xd8d8d8
const PAGE = 0xf4efe6
const FOLD = 0xc9bfae
const WING_A = 0xf5c26b
const WING_B = 0xe0607e
const BUBBLE = 0x9fd3ff
const NONE = 0x01000000

const ROWS = 4
const PH = ROWS * 2
const SPRITE_W = 12
const SPRITE_H = 4
const TICK = 100 // animation cadence (blinks, beats, walking speeds are per tick)
const FRAME_MS = 40 // repaint rate: 25 fps
const PLAY_MS = 20_000 // quiet this long: start playing
const PLAY_LEN = 12_000 // each game lasts this long
const SLEEP_MS = 180_000 // quiet this long: fall asleep
const PLAYS = ['keepy', 'dance', 'rope', 'butterfly', 'read', 'bubbles', 'visit'] as const

type Eyes = 'center' | 'left' | 'right' | 'closed'
type Arms = 'down' | 'up' | 'waveL' | 'waveR' | 'tapL' | 'tapR'
type Pose = { eyes: Eyes; arms: Arms; legs: 0 | 1; squash: boolean }
type Label = { x: number; row: number; text: string; color: number }
type Dot = { x: number; y: number; color: number }

// ---- animation state (module-local: a reload just restarts the critter) ----
const s = {
  width: 32,
  requestId: '',
  x: 4,
  dir: 1 as 1 | -1,
  target: 4,
  isWorking: false,
  tools: 0,
  toolName: '',
  toolAt: 0,
  lastKey: 0,
  keys: 0,
  lastActive: 0,
  wokeAt: 0,
  doneAt: 0,
  petAt: 0,
  submitAt: 0,
  lastFrame: '',
  typeStart: 0,
  typed: [] as { ch: string; at: number; dx: number }[],
  now: 0,
  isProjSeen: false,
  projCat: '',
  projPick: '',
  projHidden: false,
  projEvent: 'open' as ProjEvent,
  projArg: '',
  projAt: -1e9,
  projUntil: 0,
  // the run to (or from) the project box: eased from `from` to `to`
  trip: { at: -1, from: 0, to: 0, start: 0, dur: 0 },
  prevNow: 0,
  seed: 0,
  helloAt: 0,
}

// ---- pixels ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const toBase64 = (bytes: Uint8Array) => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0, b = bytes[i + 1], c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63)
    out += b === undefined ? '=' : B64.charAt((n >> 6) & 63)
    out += c === undefined ? '=' : B64.charAt(n & 63)
  }
  return out
}

// quadrant glyph by mask: top-left 1, top-right 2, bottom-left 4, bottom-right 8
const QUAD = [0x20, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b, 0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588]

const putter = (px: Uint32Array, pw: number, ox: number, oy: number) => (x: number, y: number, color: number) => {
  const X = ox + x, Y = oy + y
  if (X >= 0 && X < pw && Y >= 0 && Y < PH) px[Y * pw + X] = color
}

// Laptop in side view to the critter's right: the keyboard deck on the ground,
// the lid hinged at its far end, `lid` pixels raised (0 = shut, 3 = open and
// tilted back), its screen glowing toward the critter.
const drawLaptop = (px: Uint32Array, pw: number, ox: number, oy: number, lid: number, isLit: boolean, isTapDown: boolean) => {
  const put = putter(px, pw, ox, oy)
  for (let x = 12; x <= 17; x++) put(x, 3, KEYS)
  for (let y = 4 - Math.min(lid, 3); y <= 3; y++) put(18, y, LID)
  if (lid >= 3) {
    put(19, 0, LID)
    put(17, 0, isLit ? SCREEN_LIT : SCREEN)
    put(17, 1, isLit ? SCREEN_LIT : SCREEN)
  }
  if (isTapDown) put(12, 2, ORANGE)
}

const drawCritter = (px: Uint32Array, pw: number, ox: number, oy: number, p: Pose) => {
  const put = putter(px, pw, ox, oy)
  const top = p.squash ? 1 : 0
  for (let y = top; y <= 2; y++) for (let x = 2; x <= 9; x++) put(x, y, ORANGE)
  const [left, right] = {
    down: [1, 1], up: [0, 0], waveL: [0, 1], waveR: [1, 0], tapL: [1, 2], tapR: [1, 1],
  }[p.arms] as [number, number]
  // a raised arm points up and out from the shoulder, its hand above the head,
  // so it never lines up with the top of the head
  const arm = (inner: number, outer: number, y: number) => {
    if (y === 0) {
      put(inner, top, ORANGE)
      put(outer, top - 1, ORANGE)
    } else {
      const ay = Math.min(2, y + top)
      put(inner, ay, ORANGE)
      put(outer, ay, ORANGE)
    }
  }
  arm(1, 0, left)
  arm(10, 11, right)
  if (p.eyes !== 'closed') {
    const [l, r] = p.eyes === 'left' ? [2, 7] : p.eyes === 'right' ? [4, 9] : [3, 8]
    put(l, 1, EYE)
    put(r, 1, EYE)
  }
  for (const lx of p.legs === 0 ? [2, 4, 7, 9] : [3, 5, 6, 8]) put(lx, 3, ORANGE)
}

const render = (w: number, px: Uint32Array, labels: Label[]) => {
  const pw = w * 2
  const words = new Uint32Array(w * ROWS * 3)
  for (let r = 0; r < ROWS; r++) {
    for (let cx = 0; cx < w; cx++) {
      const quad = [
        px[2 * r * pw + 2 * cx] ?? 0, px[2 * r * pw + 2 * cx + 1] ?? 0,
        px[(2 * r + 1) * pw + 2 * cx] ?? 0, px[(2 * r + 1) * pw + 2 * cx + 1] ?? 0,
      ]
      const counts = new Map<number, number>()
      for (const c of quad) if (c !== 0) counts.set(c, (counts.get(c) ?? 0) + 1)
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
      const fg = ranked[0]
      const i = (r * w + cx) * 3
      if (fg === undefined) {
        words.set([0x20, NONE, NONE], i)
        continue
      }
      // a cell holds two colors: the commonest is drawn, the next fills the rest
      const mask = quad.reduce((m, c, k) => (c === fg ? m | (1 << k) : m), 0)
      words.set([QUAD[mask] ?? 0x2588, fg, ranked[1] ?? NONE], i)
    }
  }
  for (const l of labels) {
    for (let k = 0; k < l.text.length; k++) {
      const x = l.x + k
      if (x < 0 || x >= w || l.row < 0 || l.row >= ROWS) continue
      const i = (l.row * w + x) * 3
      if (words[i] !== 0x20) continue
      words.set([l.text.charCodeAt(k), l.color, NONE], i)
    }
  }
  return toBase64(new Uint8Array(words.buffer))
}

// ---- behaviour ----
const modeAt = (now: number) => {
  if (now - s.doneAt < 2500) return 'done' as const
  if (s.isWorking) return s.tools === 0 ? ('think' as const) : ('work' as const)
  if (now - s.lastKey < 1900) return 'type' as const
  if (s.trip.at !== s.projAt ? now - s.projAt < 5000 : now < s.projUntil) return 'proj' as const
  if (now - s.lastActive > SLEEP_MS) return 'sleep' as const
  if (now - s.lastActive > PLAY_MS) return 'play' as const
  return 'idle' as const
}

const frame = (now: number) => {
  const w = s.width
  const pw = w * 2
  const px = new Uint32Array(pw * PH)
  const labels: Label[] = []
  const mode = modeAt(now)
  const tick = Math.floor(now / TICK)
  const maxX = Math.max(0, pw - SPRITE_W - 8)
  const pose: Pose = { eyes: 'center', arms: 'down', legs: 0, squash: false }
  let lift = 0
  let laptop = -1
  let isLit = false
  let isTapDown = false
  let shift = 0
  const dots: Dot[] = []
  const ox = Math.round(s.x)
  const cx = () => Math.round(s.x / 2)
  const right = () => cx() + SPRITE_W / 2

  // speeds are per tick; frames come every FRAME_MS, so move by elapsed time
  const step = Math.min(3, Math.max(0, now - s.prevNow) / TICK)
  s.prevNow = Math.max(s.prevNow, now)
  const dash = (min: number, ticks: number) => Math.min(4, Math.max(min, Math.abs(s.target - s.x) / ticks))
  const walk = (speed: number) => {
    if (Math.abs(s.target - s.x) <= speed * step) {
      s.x = s.target
      return false
    }
    s.dir = s.target > s.x ? 1 : -1
    s.x += s.dir * speed * step
    pose.legs = tick % 2 === 0 ? 0 : 1
    pose.eyes = s.dir > 0 ? 'right' : 'left'
    return true
  }

  if (mode === 'sleep') {
    pose.squash = true
    pose.eyes = 'closed'
    const phase = Math.floor(now / 600) % 4
    if (phase >= 1) labels.push({ x: right(), row: 2, text: 'z', color: SLEEPY })
    if (phase >= 2) labels.push({ x: right() + 1, row: 1, text: 'z', color: SLEEPY })
    if (phase >= 3) labels.push({ x: right() + 2, row: 0, text: 'Z', color: SLEEPY })
  } else if (mode === 'type') {
    // pull the laptop out, lift the lid, tap away; shut it after a pause
    const opening = Math.min(1, (now - s.typeStart) / 450)
    const closing = Math.max(0, Math.min(1, (now - s.lastKey - 1500) / 400))
    laptop = Math.round(3 * opening * (1 - closing))
    const isTyping = closing === 0 && opening === 1
    pose.eyes = 'right'
    pose.arms = isTyping ? (s.keys % 2 === 0 ? 'tapL' : 'tapR') : 'down'
    isTapDown = isTyping && s.keys % 2 === 0
    isLit = now - s.lastKey < 120
    for (const t of s.typed) {
      const age = now - t.at
      if (age > 900) continue
      labels.push({ x: cx() + 6 + (t.dx % 3), row: age < 450 ? 1 : 0, text: t.ch, color: age < 450 ? GOLD : DIM })
    }
  } else if (mode === 'think') {
    pose.arms = Math.floor(now / 700) % 2 === 0 ? 'down' : 'waveR'
    pose.eyes = Math.floor(now / 1400) % 2 === 0 ? 'right' : 'center'
    const dots = '.'.repeat(1 + (Math.floor(now / 400) % 3))
    labels.push({ x: right(), row: 1, text: dots, color: DIM })
    labels.push({ x: right() - 1, row: 0, text: '?', color: GOLD })
  } else if (mode === 'work') {
    const patrol = Math.min(maxX, 56)
    if (s.target === s.x || s.target > patrol) s.target = s.x < patrol / 2 ? patrol : 0
    walk(1)
    pose.arms = tick % 4 < 2 ? 'waveL' : 'waveR'
    lift = tick % 4 === 0 ? 1 : 0
    const back = s.dir > 0 ? cx() - 1 : right()
    if (tick % 3 === 0) labels.push({ x: back, row: 3, text: '✦', color: GOLD })
    else if (tick % 3 === 1) labels.push({ x: back, row: 3, text: '·', color: DIM })
    if (now - s.toolAt < 1500 && s.toolName !== '') {
      // top row: raised hands and hops reach row 1 and would cut the word
      labels.push({ x: Math.max(0, Math.min(w - s.toolName.length, cx())), row: 0, text: s.toolName, color: GOLD })
    }
  } else if (mode === 'done') {
    const t = (now - s.doneAt) / 1000
    lift = Math.max(0, Math.round(Math.sin(t * Math.PI * 2.4) * 3))
    pose.arms = 'up'
    labels.push({ x: right(), row: 1, text: '✓', color: GREEN })
    if (tick % 4 < 2) labels.push({ x: cx() - 1, row: 1, text: '✦', color: GOLD })
    else labels.push({ x: right() + 1, row: 0, text: '✦', color: GOLD })
  } else if (mode === 'play') {
    const k = now - s.lastActive - PLAY_MS
    const picked = PLAYS[(s.seed + Math.floor(k / PLAY_LEN)) % PLAYS.length] ?? 'dance'
    const play = picked === 'visit' && s.projHidden ? 'dance' : picked
    const t = k % PLAY_LEN
    if (play === 'keepy') {
      // keepy-uppy off the head, counting, until the ball gets away
      const n = Math.floor(t / 900)
      if (t < 9900) {
        const ph = (t % 900) / 900
        lift = ph < 0.12 ? 1 : 0
        pose.arms = n % 2 === 0 ? 'waveL' : 'waveR'
        const h = Math.round(12 * ph * (1 - ph))
        dots.push({ x: ox + 5 + (n % 2), y: Math.max(0, PH - SPRITE_H - 1 - lift - h), color: BALL })
        if (n >= 2) labels.push({ x: right() + 1, row: 0, text: String(n), color: DIM })
      } else {
        const d = Math.floor((t - 9900) / 120)
        dots.push({ x: ox + 12 + d, y: PH - 1, color: BALL })
        pose.eyes = 'right'
        pose.arms = 'up'
        if (t - 9900 < 900) labels.push({ x: right(), row: 1, text: '!', color: GOLD })
      }
    } else if (play === 'dance') {
      const beat = Math.floor(t / 300)
      shift = [0, 1, 0, -1][beat % 4] ?? 0
      pose.arms = beat % 2 === 0 ? 'waveL' : 'waveR'
      pose.legs = beat % 2 === 0 ? 0 : 1
      pose.eyes = beat % 4 < 2 ? 'left' : 'right'
      lift = beat % 2 === 0 ? 1 : 0
      labels.push(beat % 4 < 2
        ? { x: cx() - 1, row: beat % 2, text: '♪', color: GOLD }
        : { x: right() + 1, row: beat % 2, text: '♫', color: GOLD })
    } else if (play === 'rope') {
      // the rope swings over the head, then under the feet as it hops
      const ph = (t % 800) / 800
      lift = ph > 0.55 && ph < 0.95 ? 2 : 0
      const oy = PH - SPRITE_H - lift
      for (let dx = -1; dx <= 12; dx++) {
        if (ph < 0.5) {
          const u = (dx - 5.5) / 6.5
          dots.push({ x: ox + dx, y: Math.max(0, oy + 1 - Math.round(3 * (1 - u * u))), color: ROPE })
        } else {
          dots.push({ x: ox + dx, y: PH - 1, color: ROPE })
        }
      }
      if (t > 2400) labels.push({ x: right() + 1, row: 0, text: String(Math.floor(t / 800)), color: DIM })
    } else if (play === 'butterfly') {
      // a butterfly flits about; chase it and leap when it comes close
      const tt = t / 1000
      const bx = Math.round(Math.max(1, Math.min(pw - 2, pw / 2 + (pw / 2 - 4) * Math.sin(tt * 0.7))))
      const by = 1 + Math.round(1.2 * Math.sin(tt * 3.1))
      dots.push({ x: bx, y: by, color: tick % 2 === 0 ? WING_A : WING_B })
      s.target = Math.max(0, Math.min(maxX, bx - 6))
      walk(dash(0.6, 15))
      pose.eyes = bx > ox + 6 ? 'right' : 'left'
      if (Math.abs(bx - (ox + 6)) < 3 && t % 1600 < 400) {
        lift = 2
        pose.arms = 'up'
      }
    } else if (play === 'read') {
      // nose in a book, peeking over it now and then, turning pages
      // an open book held up: page corners raised, the fold shaded
      const oy = PH - SPRITE_H
      for (let x = 2; x <= 9; x++) dots.push({ x: ox + x, y: oy + 1, color: x >= 4 && x <= 7 ? FOLD : PAGE })
      dots.push({ x: ox + 2, y: oy, color: PAGE }, { x: ox + 9, y: oy, color: PAGE })
      pose.eyes = 'closed'
      if (t % 3000 < 700) dots.push({ x: ox + 3, y: oy, color: EYE }, { x: ox + 8, y: oy, color: EYE })
      if (t % 2500 > 2200) dots.push({ x: ox + 8, y: Math.max(0, oy - 1), color: PAGE })
    } else if (play === 'visit') {
      // stroll over to the project box, knock, then lean in and peek
      s.target = maxX
      const moving = walk(dash(0.5, 25))
      if (!moving) {
        pose.eyes = 'right'
        if (t % 4000 < 1600) {
          pose.arms = t % 400 < 200 ? 'waveR' : 'down'
          labels.push({ x: right(), row: t % 800 < 400 ? 1 : 2, text: 'tok', color: DIM })
        } else {
          shift = 1
          if (t % 4000 > 3400) labels.push({ x: right(), row: 1, text: '?', color: GOLD })
        }
      }
    } else {
      // bubbles: blow a few and watch them float away
      pose.arms = 'waveR'
      pose.eyes = 'right'
      const glyphs = ['°', 'o', 'O']
      for (let i = 0; i < 3; i++) {
        const phase = (t + i * 700) % 2100
        const step = Math.floor(phase / 700)
        labels.push({ x: right() + i + step, row: 2 - step, text: glyphs[step] ?? 'o', color: BUBBLE })
      }
    }
  } else if (mode === 'proj') {
    const ev = s.projEvent
    if (s.trip.at !== s.projAt) {
      // plan the run once per event: ~110 px/s, never longer than 2.4 s
      const to = ev === 'open' || ev === 'pick' || ev === 'show' ? maxX : ev === 'close' ? Math.round(maxX / 2) : s.x
      const start = s.projAt + (ev === 'close' ? 900 : 0)
      const dur = Math.min(2400, Math.abs(to - s.x) * 9)
      s.trip = { at: s.projAt, from: s.x, to, start, dur }
      s.projUntil = start + dur + PROJ_LEN[ev]
    }
    const tr = s.trip
    const k = tr.dur === 0 ? 1 : Math.min(1, Math.max(0, (now - tr.start) / tr.dur))
    const moving = now >= tr.start && k < 1
    if (now >= tr.start) s.x = tr.from + (tr.to - tr.from) * (0.5 - Math.cos(Math.PI * k) / 2)
    s.target = s.x
    const t = now - tr.start - tr.dur // since arrival; negative on the way
    if (moving) {
      // eased run: quick feet, a little hop, dust behind
      s.dir = tr.to > tr.from ? 1 : -1
      pose.eyes = s.dir > 0 ? 'right' : 'left'
      pose.legs = Math.floor(now / 70) % 2 === 0 ? 0 : 1
      pose.arms = Math.floor(now / 140) % 2 === 0 ? 'waveL' : 'waveR'
      lift = Math.floor(now / 140) % 2
      if (now - s.projAt < 500) labels.push({ x: right(), row: 1, text: '!', color: GOLD })
      if (Math.floor(now / 120) % 2 === 0) labels.push({ x: s.dir > 0 ? cx() - 1 : right(), row: 3, text: '·', color: DIM })
    } else if (ev === 'open') {
      // point at the folder that just opened
      pose.eyes = 'right'
      pose.arms = t % 600 < 300 ? 'waveR' : 'down'
      labels.push({ x: right() + (t % 600 < 300 ? 1 : 0), row: 2, text: '→', color: GOLD })
    } else if (ev === 'pick') {
      // open the project: laptop out, type the cd
      laptop = 3
      pose.eyes = 'right'
      pose.arms = tick % 2 === 0 ? 'tapL' : 'tapR'
      isTapDown = tick % 2 === 0
      isLit = tick % 3 === 0
      const cmd = `cd ${s.projArg}`.slice(0, Math.max(3, Math.floor(t / 120)))
      labels.push({ x: Math.max(0, cx() - 2), row: 0, text: cmd, color: GOLD })
    } else if (ev === 'close') {
      pose.arms = 'up'
      pose.eyes = 'left'
      labels.push({ x: right(), row: 1, text: 'ok', color: DIM })
    } else if (ev === 'hide') {
      pose.eyes = 'right'
      pose.arms = tick % 4 < 2 ? 'waveR' : 'down'
      labels.push({ x: right(), row: 1, text: 'bye!', color: GOLD })
    } else {
      pose.eyes = 'right'
      pose.arms = tick % 4 < 2 ? 'waveR' : 'up'
      lift = t % 600 < 150 ? 1 : 0
      labels.push({ x: right(), row: 1, text: 'hi!', color: GOLD })
    }
  } else {
    // idle: wander now and then, look around, blink
    const moving = walk(dash(0.5, 30))
    if (!moving) {
      const look = Math.floor(now / 2300) % 5
      pose.eyes = look === 1 ? 'left' : look === 3 ? 'right' : 'center'
      if (tick % 70 === 0 && (tick / 70) % 3 === 1) s.target = Math.round(Math.random() * maxX)
    }
    if (tick % 45 === 0 || tick % 45 === 2) pose.eyes = 'closed'
  }

  if (now - s.helloAt < 2500) {
    pose.arms = tick % 4 < 2 ? 'waveL' : 'waveR'
    labels.push({ x: right(), row: 1, text: 'hi!', color: GOLD })
  }
  if (now - s.wokeAt < 900) {
    labels.push({ x: right(), row: 1, text: '!', color: GOLD })
    lift = 1
    pose.eyes = 'center'
    pose.squash = false
  }
  if (now - s.petAt < 2200) {
    const k = Math.floor((now - s.petAt) / 300)
    labels.push({ x: cx() + 1 + (k % 3), row: Math.max(0, 1 - Math.floor(k / 3)), text: '♥', color: PINK })
    labels.push({ x: cx() + 4 - (k % 2), row: Math.max(0, 1 - Math.floor(k / 2)), text: '♥', color: PINK })
    pose.eyes = 'closed'
    pose.arms = 'up'
  }

  s.x = Math.max(0, Math.min(maxX, s.x))
  drawCritter(px, pw, Math.round(s.x) + shift, PH - SPRITE_H - lift, pose)
  for (const d of dots) if (d.x >= 0 && d.x < pw && d.y >= 0 && d.y < PH) px[d.y * pw + d.x] = d.color
  if (laptop >= 0) drawLaptop(px, pw, Math.round(s.x), PH - SPRITE_H, laptop, isLit, isTapDown)
  return { cells: render(w, px, labels), mode }
}

// Synchronous on purpose: prompt.edit runs on every key within a 50 ms budget,
// so activity is stamped with the tick's clock (at most one tick old).
const touch = () => {
  const now = s.now
  if (now - s.lastActive > PLAY_MS) s.wokeAt = now
  s.lastActive = now
  s.seed = Math.floor(Math.random() * PLAYS.length)
  return now
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'buddy', description: 'Show or hide the Claude buddy above the prompt' })
    await $.command.register({ name: 'pet', description: 'Pet the Claude buddy' })
    s.now = await $.clock.now()
    s.lastActive = s.now
    s.helloAt = s.now
    s.seed = Math.floor(Math.random() * PLAYS.length)

    $.clock.every(FRAME_MS, async () => {
      s.now = await $.clock.now()
      if (s.requestId === '' || !(await read($, isShown))) return
      const { cells } = frame(s.now)
      if (cells === s.lastFrame) return
      s.lastFrame = cells
      await $.ui.blit({ requestId: s.requestId, key: 'buddy', cells, columns: s.width, rows: ROWS })
    })
    return next(e)
  })

  on('command.run', { command: 'buddy' }, async $ => {
    const shown = await update($, isShown, v => !v)
    return { text: shown ? 'Claude buddy is back.' : 'Claude buddy hidden. /buddy brings it back.' }
  })
  on('command.run', { command: 'pet' }, async $ => {
    s.petAt = touch()
    return { text: '♥' }
  })

  on('prompt.edit', async ($, e, next) => {
    const prev = s.lastKey
    const now = touch()
    if (now - prev > 1900) s.typeStart = now
    s.lastKey = now
    s.keys += 1
    const ch = e.inputText.slice(-1)
    if (ch >= '!' && ch <= '~') {
      s.typed = [...s.typed.filter(t => now - t.at < 900), { ch, at: now, dx: (s.keys * 5) % 6 }].slice(-4)
    }
    return next(e)
  })
  on('prompt.submit', async ($, e, next) => {
    s.submitAt = touch()
    s.isWorking = true
    s.tools = 0
    return next(e)
  })
  on('tool.call', async ($, e, next) => {
    s.toolAt = touch()
    s.tools += 1
    s.toolName = e.tool.replace(/^mcp__[^_]+(_[^_]+)*__/, '').slice(0, 10)
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    s.doneAt = touch()
    s.isWorking = false
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey || !(await read($, isShown))) return next(e)
    const below = await next(e)
    const { Box, Raster } = $.ui.resolve(e)
    s.requestId = e.requestId
    // follow the project box: react to what changed since the last draw, and
    // stretch the stage up to the box's left edge so the critter can reach it
    const [cat, pick, hidden] = await Promise.all([read($, projCat), read($, projPick), read($, projHidden)])
    if (s.isProjSeen) {
      const happen = (ev: ProjEvent, arg = '') => {
        s.projEvent = ev
        s.projArg = arg
        s.projAt = s.now
      }
      if (hidden !== s.projHidden) happen(hidden ? 'hide' : 'show')
      else if (pick !== s.projPick && pick !== '') happen('pick', pick)
      else if (cat !== s.projCat) happen(cat === '' ? 'close' : 'open', cat)
    }
    Object.assign(s, { isProjSeen: true, projCat: cat, projPick: pick, projHidden: hidden })
    const cols = e.props.bodyColumns
    const box = hidden ? 0 : (cat === '' ? PROJ_NARROW : Math.min(PROJ_WIDE, Math.max(PROJ_NARROW, cols - 40))) + 2
    s.width = Math.max(SPRITE_W + 8, cols - box - 1)
    s.isWorking = s.isWorking || e.props.isWorking
    const { cells } = frame(s.now)
    s.lastFrame = cells
    // The critter floats bottom-left, just above the band's last row (the
    // status line), so a tall neighbour (a box beside the status bar) never
    // pushes it up and away, whichever plugin wraps whom. An empty strut keeps
    // the band tall enough for it; the engine's rows sit bottom-aligned beside.
    return (
      <Box flexDirection="row" alignItems="flex-end">
        <Box width={0} height={ROWS + 1} />
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          {below}
        </Box>
        <Box position="absolute" left={0} bottom={1}>
          <Raster key="buddy" columns={s.width} rows={ROWS} cells={cells} />
        </Box>
      </Box>
    )
  })
}
