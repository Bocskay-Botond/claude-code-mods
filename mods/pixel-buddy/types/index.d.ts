export type Shown = boolean
/** A shot into the project box: 'hit', 'scatter' (step = frame), 'rebuild' (step 0..10 = rows back). */
export type Bump = { phase: 'none' | 'hit' | 'scatter' | 'rebuild'; step: number }

declare module 'claude-code' {
  interface PluginState {
    'pixel-buddy': {
      isShown: Shown
      bump: Bump
    }
    // read only: the project box the critter walks up to (project-box)
    'project-box': {
      isHidden: boolean
      openCat: string
      openProject: string
      layout: { narrow: number; wide: number; stack: number }
    }
  }
}
