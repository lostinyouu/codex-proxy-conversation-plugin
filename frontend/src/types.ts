export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface Preset {
  id: string
  name: string
  mode: 'fixed' | 'random'
  messages: ChatMessage[]
}

export interface Presets { entries: Preset[] }
export interface ClientKey { id: string, name: string, enabled: boolean }
export interface SavedPresets { version: number | null, value: Presets | null }

export interface PluginHost {
  readonly version: 2
  request: (input: { method: 'GET' | 'POST', path: string, body?: string, contentType?: string }) => Promise<{
    status: number
    contentType: string
    body: ArrayBuffer
  }>
  models: { responses: (input: { clientKeyId: string, body: Record<string, unknown>, signal?: AbortSignal }) => Promise<Response> }
}

declare global {
  interface Window { readonly codexProxyPlugin?: PluginHost }
}
