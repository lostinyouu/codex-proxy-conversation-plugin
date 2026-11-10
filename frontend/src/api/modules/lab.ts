import type { ClientKey, Presets, SavedPresets } from '../../types'
import request from '../request'

export async function listKeys(): Promise<ClientKey[]> {
  const keys: ClientKey[] = []
  let cursor: string | null = null
  do {
    const page: { keys: ClientKey[], next_cursor: string | null } = await request({
      url: 'api/keys',
      method: 'POST',
      data: { cursor },
    })
    keys.push(...page.keys)
    cursor = page.next_cursor
  } while (cursor)
  return keys
}

export async function listModels(clientKeyId: string): Promise<string[]> {
  const reply = await request<{ models: string[] }>({
    url: 'api/models',
    method: 'POST',
    data: { clientKeyId },
  })
  return reply.models
}

export function getPresets(): Promise<SavedPresets> {
  return request({
    url: 'api/presets',
    method: 'GET',
  })
}

export function savePresets(value: Presets, expectedVersion: number | null): Promise<{ version: number }> {
  return request({
    url: 'api/presets',
    method: 'POST',
    data: { value, expectedVersion },
  })
}
