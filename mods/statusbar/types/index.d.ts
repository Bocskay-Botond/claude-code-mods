export type Bar = {
  phase: 'idle' | 'working'
  tools: number
  lastTool: string
  seconds: number
  turns: number
}

declare module 'claude-code' {
  interface PluginState {
    statusbar: { bar: Bar }
  }
}
