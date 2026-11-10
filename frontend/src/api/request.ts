import type { PluginHost } from '../types'

export function host(): PluginHost {
  const value = window.codexProxyPlugin
  if (!value || value.version !== 2)
    throw new Error('请从网关的插件页面打开')
  return value
}

export default async function request<T>(config: { url: string, method: 'GET' | 'POST', data?: unknown }): Promise<T> {
  const reply = await host().request({
    path: config.url,
    method: config.method,
    ...(config.data === undefined ? {} : { body: JSON.stringify(config.data), contentType: 'application/json' }),
  })
  if (reply.contentType.split(';')[0]?.trim() !== 'application/json')
    throw new Error('插件返回了不支持的内容类型')
  const value = JSON.parse(new TextDecoder().decode(reply.body))
  if (reply.status < 200 || reply.status >= 300)
    throw new Error(value?.error?.message ?? `请求失败（HTTP ${reply.status}）`)
  return value as T
}
