export type Flag = boolean
export type Id = string
export type Project = { id: string; name: string; dir: string; note: string; live?: boolean }
export type Category = { id: string; name: string; color: string; projects: Project[] }

declare module 'claude-code' {
  interface PluginState {
    'project-box': {
      isHidden: Flag
      openCat: Id
      openProject: Id
      categories: Category[]
    }
  }
}
