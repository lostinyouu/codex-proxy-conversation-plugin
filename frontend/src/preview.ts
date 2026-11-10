// @env browser
import type { PluginHost, Preferences, Presets } from './types'
import { applyTheme, createTheme } from '@codex-proxy/ui/theme'

export function installPreview() {
  const scheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light'
  applyTheme(document.documentElement, createTheme({ scheme }))
  let sequence = 0
  function json(value: unknown, status = 200) {
    return { status, contentType: 'application/json', body: new TextEncoder().encode(JSON.stringify(value)).buffer }
  }
  const host: PluginHost = {
    version: 2,
    async request(input) {
      const body = input.body ? JSON.parse(input.body) : {}
      if (input.path === 'api/keys') {
        return json({ keys: [
          { id: 'preview', name: '模拟 Key', enabled: true },
          { id: 'preview-secondary', name: '模拟备用 Key', enabled: true },
        ], next_cursor: null })
      }
      if (input.path === 'api/models')
        return json({ models: body.clientKeyId === 'preview-secondary' ? ['gpt-preview-alt', 'gpt-preview-secondary'] : ['gpt-preview', 'gpt-preview-alt'] })
      if (input.path !== 'api/presets' && input.path !== 'api/preferences')
        return json({ error: { message: '接口不存在' } }, 404)
      const storageKey = input.path === 'api/preferences' ? 'conversation-lab-preview-preferences' : 'conversation-lab-preview'
      const saved: { version: number, value: Presets | Preferences } | null = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (input.method === 'GET')
        return json(saved ?? { version: null, value: null })
      if (body.expectedVersion !== (saved?.version ?? null))
        return json({ error: { message: '保存内容已在其他页面更新，请重新载入后再保存' } }, 409)
      const version = (saved?.version ?? 0) + 1
      localStorage.setItem(storageKey, JSON.stringify({ version, value: body.value }))
      return json({ version })
    },
    models: {
      async responses(input) {
        const number = ++sequence
        const content = `第 ${number} 次模拟回复\n\n这是模拟预览，实际安装后由所选模型结合对话上下文生成回复`
        const chunks = content.match(/.{1,5}/gs) ?? []
        const output = [
          { id: `preview-reasoning-${number}`, type: 'reasoning', summary: [], encrypted_content: `preview-encrypted-${number}` },
          { id: `preview-message-${number}`, type: 'message', role: 'assistant', status: 'completed', phase: 'final_answer', content: [{ type: 'output_text', text: content, annotations: [] }] },
        ]
        const endEvents = [
          ...output.map((item, output_index) => ({ type: 'response.output_item.done', output_index, item })),
          { type: 'response.completed', response: { id: `preview-response-${number}`, status: 'completed', model: input.body.model, output, usage: { input_tokens: 24, output_tokens: 30, total_tokens: 54 } } },
        ]
        let index = 0
        let cancelled = false
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            await new Promise(resolve => setTimeout(resolve, 80))
            if (cancelled)
              return
            if (input.signal?.aborted) {
              controller.error(new DOMException('Aborted', 'AbortError'))
              return
            }
            const event = index < chunks.length
              ? { type: 'response.output_text.delta', delta: chunks[index] }
              : endEvents[index - chunks.length]!
            index++
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            if (event.type === 'response.completed')
              controller.close()
          },
          cancel() { cancelled = true },
        })
        return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'x-request-id': `preview-request-${number}` } })
      },
    },
  }
  Object.defineProperty(window, 'codexProxyPlugin', { value: host })
}
