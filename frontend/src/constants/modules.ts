export const workspaceModules = [
  { id: 'conversation', label: '连续对话' },
  { id: 'presets', label: '预设管理' },
] as const

export type WorkspaceModuleId = typeof workspaceModules[number]['id']
