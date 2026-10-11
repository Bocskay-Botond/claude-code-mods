export type Flag = boolean
export type Id = string
export type Project = { id: string; name: string; dir: string; note: string; live?: boolean }
export type Category = { id: string; name: string; color: string; projects: Project[] }
/** The card's outer width: closed (narrow) and the cap when a category is open (wide); below `stack` columns it stacks above the band instead. */
export type Layout = { narrow: number; wide: number; stack: number }
/** pixel-buddy's football hitting the card: 'hit', 'scatter' (step = frame), 'rebuild' (step 0..10 = rows back). */
export type Bump = { phase: 'none' | 'hit' | 'scatter' | 'rebuild'; step: number }

declare module 'claude-code' {
  interface PluginState {
    'project-box': {
      isHidden: Flag
      openCat: Id
      openProject: Id
      categories: Category[]
      layout: Layout
    }
    // read only: pixel-buddy's shot into the card (mirrors its own contract)
    'pixel-buddy': {
      isShown: boolean
      bump: Bump
    }
  }
}
