import type { ChatMessage, ConversationIdentity, GenerationFacts, Preferences } from '../types'
import type { ConversationItem } from '../utils/conversation'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { host } from '../api/request'
import { conversationMessages } from '../utils/conversation'
import { consumeModelResponse } from '../utils/responses'

export function useGeneration() {
  const history = shallowRef<ConversationItem[]>([])
  const pending = shallowRef<ChatMessage[]>([])
  const text = shallowRef('')
  const running = shallowRef(false)
  const identity = shallowRef<ConversationIdentity | null>(null)
  const error = shallowRef('')
  const status = shallowRef('尚未发送')
  const facts = shallowRef<GenerationFacts | null>(null)
  let controller: AbortController | undefined
  onScopeDispose(() => controller?.abort())

  const messages = computed<ChatMessage[]>(() => [
    ...conversationMessages(history.value),
    ...pending.value,
    ...(text.value ? [{ role: 'assistant' as const, content: text.value }] : []),
  ])

  function reset() {
    if (running.value)
      return
    history.value = []
    pending.value = []
    text.value = ''
    identity.value = null
    error.value = ''
    status.value = '尚未发送'
    facts.value = null
  }

  async function execute(settings: Preferences, input: ChatMessage[]): Promise<boolean> {
    const request = new AbortController()
    controller = request
    pending.value = structuredClone(input)
    const requestInput: ConversationItem[] = [...history.value, ...pending.value.map(message => ({ ...message }))]
    running.value = true
    text.value = ''
    error.value = ''
    status.value = '正在生成'
    facts.value = null
    const started = performance.now()
    let requestId = ''
    try {
      const response = await host().models.responses({
        clientKeyId: settings.clientKeyId,
        body: {
          model: settings.modelId,
          input: requestInput,
          stream: true,
          store: false,
          ...(settings.reasoningEffort === 'default' ? {} : { reasoning: { effort: settings.reasoningEffort } }),
        },
        signal: request.signal,
      })
      requestId = response.headers.get('x-gateway-request-id') ?? response.headers.get('x-request-id') ?? ''
      const next = await consumeModelResponse(response, {
        onDelta: (delta) => {
          text.value += delta
        },
      })
      if (request.signal.aborted)
        throw new DOMException('Aborted', 'AbortError')
      // 仅提交成功轮次，保留完整原始输出项及其顺序供下一轮使用
      history.value = [...requestInput, ...next.output]
      pending.value = []
      text.value = ''
      facts.value = {
        model: next.model,
        inputTokens: next.inputTokens,
        outputTokens: next.outputTokens,
        elapsedMs: Math.round(performance.now() - started),
        requestId,
      }
      status.value = '已完成'
      return true
    }
    catch (cause) {
      if (request.signal.aborted) {
        status.value = '已停止'
      }
      else {
        status.value = '生成失败'
        error.value = cause instanceof Error ? cause.message : String(cause)
      }
      return false
    }
    finally {
      running.value = false
      controller = undefined
    }
  }

  async function start(settings: Preferences, input: ChatMessage[]): Promise<boolean> {
    if (running.value || !settings.clientKeyId || !settings.modelId)
      return false
    reset()
    identity.value = { clientKeyId: settings.clientKeyId, modelId: settings.modelId }
    return execute(settings, input)
  }

  function matchesIdentity(settings: ConversationIdentity): boolean {
    const current = identity.value
    return Boolean(current && current.clientKeyId === settings.clientKeyId && current.modelId === settings.modelId)
  }

  async function continueWith(settings: Preferences, content: string): Promise<boolean> {
    if (running.value || !history.value.length || !content.trim())
      return false
    if (!matchesIdentity(settings)) {
      error.value = 'Key 或模型已更改，请开始新对话'
      return false
    }
    return execute(settings, [{ role: 'user', content }])
  }

  return {
    messages,
    running,
    matchesIdentity,
    error,
    status,
    facts,
    hasConversation: computed(() => history.value.length > 0),
    start,
    continueWith,
    reset,
    stop: () => controller?.abort(),
  }
}
