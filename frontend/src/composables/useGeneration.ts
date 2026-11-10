import type { ChatMessage } from '../types'
import type { ModelResult } from '../utils/responses'
import { onScopeDispose, shallowRef } from 'vue'
import { host } from '../api/request'
import { consumeModelResponse } from '../utils/responses'

export function useGeneration() {
  const running = shallowRef(false)
  const text = shallowRef('')
  const error = shallowRef('')
  const status = shallowRef('尚未发送')
  const result = shallowRef<ModelResult>()
  const requestId = shallowRef('')
  const elapsed = shallowRef(0)
  let controller: AbortController | undefined
  onScopeDispose(() => controller?.abort())

  async function send(clientKeyId: string, model: string, messages: ChatMessage[]) {
    if (running.value || !clientKeyId || !model)
      return
    const request = new AbortController()
    controller = request
    running.value = true
    text.value = ''
    error.value = ''
    result.value = undefined
    requestId.value = ''
    status.value = '正在生成'
    const started = performance.now()
    try {
      const response = await host().models.responses({
        clientKeyId,
        body: { model, input: structuredClone(messages), stream: true, store: false },
        signal: request.signal,
      })
      requestId.value = response.headers.get('x-gateway-request-id') ?? response.headers.get('x-request-id') ?? ''
      const next = await consumeModelResponse(response, {
        onDelta: (delta) => {
          text.value += delta
        },
      })
      if (request.signal.aborted)
        throw new DOMException('Aborted', 'AbortError')
      result.value = next
      status.value = '已完成'
    }
    catch (cause) {
      if (request.signal.aborted) {
        status.value = '已停止'
      }
      else {
        status.value = '生成失败'
        error.value = cause instanceof Error ? cause.message : String(cause)
      }
    }
    finally {
      elapsed.value = Math.round(performance.now() - started)
      running.value = false
      controller = undefined
    }
  }

  return { running, text, error, status, result, requestId, elapsed, send, stop: () => controller?.abort() }
}
