export type Obstacle = { lane: number; y: number }
export type Game = {
  isRunning: boolean
  isOver: boolean
  x: number
  score: number
  best: number
  obstacles: Obstacle[]
}
export type AgentRow = { id: string; label: string; status: string; startedAt: number }
export type Step = { text: string; status: 'done' | 'active' | 'next' }
export type Run = {
  phase: 'idle' | 'working'
  prompt: string
  startedAt: number
  tools: number
  lastTool: string
  steps: Step[]
}
export type Meter = { ctx: number; five: number; now: number }
export type Seen = { model: string; effort: string }

declare module 'claude-code' {
  interface PluginState {
    'tristens-tools': {
      isClean: boolean
      isUpgrade: boolean
      model: string
      effort: string
      helper: string
      team: string
      run: Run
      game: Game
      agents: AgentRow[]
      meter: Meter
      seen: Seen
    }
  }
}
