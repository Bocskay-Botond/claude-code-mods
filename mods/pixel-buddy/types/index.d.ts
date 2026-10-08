export type Shown = boolean

declare module 'claude-code' {
  interface PluginState {
    'pixel-buddy': {
      isShown: Shown
    }
    // read only: the project box the critter walks up to (project-box)
    'project-box': {
      isHidden: boolean
      openCat: string
      openProject: string
    }
  }
}
