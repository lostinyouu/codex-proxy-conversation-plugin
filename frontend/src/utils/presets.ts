import type { ChatMessage, Preset } from '../types'

export const defaultPresets: Preset[] = [
  { id: 'fixed-greeting', name: '固定 · 简短问候', mode: 'fixed', messages: [{ role: 'user', content: '你好，请用一句话介绍你能帮助我做什么' }] },
  { id: 'fixed-context', name: '固定 · 上下文测试', mode: 'fixed', messages: [
    { role: 'user', content: '请记住我的代号是海星，幸运数字是 17' },
    { role: 'assistant', content: '好的，你的代号是海星，幸运数字是 17' },
    { role: 'user', content: '我的代号和幸运数字分别是什么？' },
  ] },
  { id: 'random-topic', name: '随机 · 话题问答', mode: 'random', messages: [
    { role: 'system', content: '请用{{choice:简洁|幽默|通俗}}的语言回答，控制在 150 字以内' },
    { role: 'user', content: '围绕「{{choice:太空旅行|深海探索|人工智能|城市骑行|咖啡文化}}」提出一个有趣的问题，并给出你的答案，附上数字 {{number}} 作为本次测试标记' },
  ] },
]

// getRandomValues 也可用于通过 HTTP 部署的管理页面
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0F) | 0x40
  bytes[8] = (bytes[8]! & 0x3F) | 0x80
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// 同名变量在一组消息中复用同一个值，保证多轮上下文一致
export function renderMessages(messages: ChatMessage[], random: boolean): ChatMessage[] {
  if (!random)
    return structuredClone(messages)
  const values = new Map<string, string>()
  return messages.map(message => ({
    role: message.role,
    content: message.content.replace(/\{\{([^{}]+)\}\}/g, (_token, name: string) => {
      if (values.has(name))
        return values.get(name)!
      let value: string
      if (name === 'number') {
        const bytes = crypto.getRandomValues(new Uint32Array(1))
        value = String(1 + bytes[0]! % 10000)
      }
      else if (name === 'uuid') {
        value = randomId()
      }
      else if (name.startsWith('choice:')) {
        const choices = name.slice(7).split('|').map(s => s.trim()).filter(Boolean)
        if (!choices.length)
          throw new Error('随机选项不能为空')
        const bytes = crypto.getRandomValues(new Uint32Array(1))
        value = choices[bytes[0]! % choices.length]!
      }
      else {
        throw new Error(`未知随机变量：${name}`)
      }
      values.set(name, value)
      return value
    }),
  }))
}
