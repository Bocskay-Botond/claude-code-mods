export type Count = number

declare module 'claude-code' {
  interface PluginState {
    'hello-mod': { count: Count }
  }
}
