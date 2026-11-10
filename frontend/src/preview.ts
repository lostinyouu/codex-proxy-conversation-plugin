// @env browser
import type { PluginHost, Presets } from './types'
import { applyTheme, createTheme } from '@codex-proxy/ui/theme'

export function installPreview() {
  const scheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'
  applyTheme(document.documentElement, createTheme({ scheme }))
  const storageKey = 'conversation-lab-preview'
  function json(value: unknown, status = 200) {
    return { status, contentType: 'application/json', body: new TextEncoder().encode(JSON.stringify(value)).buffer }
  }
  const host: PluginHost = {
    version: 2,
    async request(input) {
      const body = input.body ? JSON.parse(input.body) : {}
      if (input.path === 'api/keys')
        return json({ keys: [{ id: 'preview', name: '模拟 Key', enabled: true }], next_cursor: null })
      if (input.path === 'api/models')
        return json({ models: ['gpt-preview'] })
      const saved: { version: number, value: Presets } | null = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (input.method === 'GET')
        return json(saved ?? { version: null, value: null })
      if (body.expectedVersion !== (saved?.version ?? null))
        return json({ error: { message: '预设已在其他页面更新，请重新载入后再保存' } }, 409)
      const version = (saved?.version ?? 0) + 1
      localStorage.setItem(storageKey, JSON.stringify({ version, value: body.value }))
      return json({ version })
    },
    models: {
      async responses(input) {
        const content = '这是模拟回复，用于验证发送、流式显示和取消操作\n\n实际安装后，回复由所选模型生成'
        const chunks = content.match(/.{1,5}/gs) ?? []
        let index = 0
        let cancelled = false
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (cancelled)
              return
            if (input.signal?.aborted) {
              controller.error(new DOMException('Aborted', 'AbortError'))
              return
            }
            const event = index < chunks.length
              ? { type: 'response.output_text.delta', delta: chunks[index++] }
              : { type: 'response.completed', response: { id: 'preview-response', status: 'completed', model: 'gpt-preview', output_text: content, usage: { input_tokens: 24, output_tokens: 30, total_tokens: 54 } } }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            if (event.type === 'response.completed')
              controller.close()
          },
          cancel() { cancelled = true },
        })
        return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'x-request-id': 'preview-request' } })
      },
    },
  }
  Object.defineProperty(window, 'codexProxyPlugin', { value: host })
}
