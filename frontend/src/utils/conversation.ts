import type { ChatMessage } from '../types'

export type ConversationItem = Record<string, unknown>

export const messageRoleLabels = { system: '系统', user: '用户', assistant: '助手' } as const

// 原始输出项留给协议续聊，界面只投影可显示的消息
export function conversationMessages(items: ConversationItem[]): ChatMessage[] {
  const result: ChatMessage[] = []
  for (const item of items) {
    const role = item.role
    if (role !== 'system' && role !== 'user' && role !== 'assistant')
      continue
    if (typeof item.content === 'string') {
      result.push({ role, content: item.content })
      continue
    }
    if (!Array.isArray(item.content))
      continue
    const content = item.content.map((part: unknown) => {
      if (!part || typeof part !== 'object')
        return ''
      const value = part as Record<string, unknown>
      if (typeof value.text === 'string')
        return value.text
      return typeof value.refusal === 'string' ? value.refusal : ''
    }).join('')
    if (content)
      result.push({ role, content })
  }
  return result
}
