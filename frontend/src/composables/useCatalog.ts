import type { Ref } from 'vue'
import type { ClientKey, Preferences } from '../types'
import { computed, onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { listKeys, listModels } from '../api/modules/lab'

export function useCatalog(draft: Ref<Preferences>, ready: Readonly<Ref<boolean>>) {
  const keys = shallowRef<ClientKey[]>([])
  const models = shallowRef<string[]>([])
  const keysLoaded = shallowRef(false)
  const keysLoading = shallowRef(false)
  const modelsLoading = shallowRef(false)
  const keysError = shallowRef('')
  const modelsError = shallowRef('')
  const keyNotice = shallowRef('')
  const modelNotice = shallowRef('')
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
      if (active) {
        keys.value = result
        keysLoaded.value = true
      }
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

  watch([ready, keysLoaded, keys], ([isReady, loaded], [wasReady, wasLoaded]) => {
    if (!isReady || !loaded)
      return
    const selected = draft.value.clientKeyId
    if (selected && !keys.value.some(key => key.enabled && key.id === selected)) {
      draft.value.clientKeyId = ''
      draft.value.modelId = ''
      keyNotice.value = '已选 Key 不可用，请重新选择'
    }
    else if (!selected && (!wasReady || !wasLoaded)) {
      draft.value.clientKeyId = keys.value.find(key => key.enabled)?.id ?? ''
    }
  })

  watch([ready, keysLoaded, () => draft.value.clientKeyId, keys], async (_next, _previous, cleanup) => {
    let current = true
    cleanup(() => {
      current = false
    })
    modelsLoading.value = false
    if (!ready.value || !keysLoaded.value)
      return
    const id = draft.value.clientKeyId
    const desired = draft.value.modelId
    models.value = []
    draft.value.modelId = ''
    modelsError.value = ''
    modelNotice.value = ''
    if (!keys.value.some(key => key.enabled && key.id === id))
      return
    keyNotice.value = ''
    modelsLoading.value = true
    try {
      const result = await listModels(id)
      if (!current)
        return
      models.value = result
      if (desired && !result.includes(desired)) {
        modelNotice.value = '已选模型不可用，请重新选择'
      }
      else {
        draft.value.modelId = desired || result[0] || ''
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
    keysLoading,
    modelsLoading,
    refresh,
    error: computed(() => keysError.value || modelsError.value),
    notice: computed(() => keyNotice.value || (draft.value.modelId ? '' : modelNotice.value)),
    keyOptions: computed(() => keys.value.map(key => ({ label: key.name, value: key.id, disabled: !key.enabled }))),
    modelOptions: computed(() => models.value.map(model => ({ label: model, value: model }))),
  }
}
