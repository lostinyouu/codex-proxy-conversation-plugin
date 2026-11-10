import type { ClientKey } from '../types'
import { computed, onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { listKeys, listModels } from '../api/modules/lab'

export function useCatalog() {
  const keys = shallowRef<ClientKey[]>([])
  const models = shallowRef<string[]>([])
  const clientKeyId = shallowRef('')
  const modelId = shallowRef('')
  const keysLoading = shallowRef(false)
  const modelsLoading = shallowRef(false)
  const keysError = shallowRef('')
  const modelsError = shallowRef('')
  let active = true
  onScopeDispose(() => {
    active = false
  })

  async function refresh() {
    if (keysLoading.value)
      return
    keysLoading.value = true
    keysError.value = ''
    try {
      const result = await listKeys()
      if (!active)
        return
      keys.value = result
      if (!result.some(key => key.enabled && key.id === clientKeyId.value))
        clientKeyId.value = result.find(key => key.enabled)?.id ?? ''
    }
    catch (cause) {
      if (active)
        keysError.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (active)
        keysLoading.value = false
    }
  }

  watch(clientKeyId, async (id, _old, cleanup) => {
    let current = true
    cleanup(() => {
      current = false
    })
    const previous = modelId.value
    models.value = []
    modelId.value = ''
    modelsError.value = ''
    modelsLoading.value = Boolean(id)
    if (!id)
      return
    try {
      const result = await listModels(id)
      if (current) {
        models.value = result
        modelId.value = result.includes(previous) ? previous : result[0] ?? ''
      }
    }
    catch (cause) {
      if (current)
        modelsError.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (current)
        modelsLoading.value = false
    }
  })
  onMounted(refresh)
  return {
    clientKeyId,
    modelId,
    keysLoading,
    modelsLoading,
    refresh,
    error: computed(() => keysError.value || modelsError.value),
    keyOptions: computed(() => keys.value.map(key => ({ label: key.name, value: key.id, disabled: !key.enabled }))),
    modelOptions: computed(() => models.value.map(model => ({ label: model, value: model }))),
  }
}
