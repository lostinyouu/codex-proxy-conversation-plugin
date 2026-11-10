import type { Preferences } from '../types'
import { computed, onMounted, onScopeDispose, ref, shallowRef, toRaw } from 'vue'
import { getPreferences, savePreferences } from '../api/modules/lab'

const defaults: Preferences = { clientKeyId: '', modelId: '', reasoningEffort: 'default' }

export function usePreferences() {
  const draft = ref<Preferences>({ ...defaults })
  const saved = shallowRef<Preferences | null>(null)
  const version = shallowRef<number | null>(null)
  const ready = shallowRef(false)
  const loaded = shallowRef(false)
  const loading = shallowRef(false)
  const saving = shallowRef(false)
  const error = shallowRef('')
  const notice = shallowRef('')
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(saved.value))
  let active = true
  onScopeDispose(() => {
    active = false
  })

  async function load() {
    if (loading.value || saving.value)
      return
    loading.value = true
    ready.value = false
    error.value = ''
    notice.value = ''
    try {
      const reply = await getPreferences()
      if (!active)
        return
      version.value = reply.version
      saved.value = reply.value
      draft.value = structuredClone(reply.value ?? defaults)
      loaded.value = true
    }
    catch (cause) {
      if (active)
        error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (active) {
        loading.value = false
        ready.value = true
      }
    }
  }

  async function save() {
    if (!loaded.value || loading.value || saving.value)
      return
    const value = structuredClone(toRaw(draft.value))
    saving.value = true
    error.value = ''
    notice.value = ''
    try {
      const reply = await savePreferences(value, version.value)
      if (!active)
        return
      version.value = reply.version
      saved.value = value
      notice.value = '默认设置已保存'
    }
    catch (cause) {
      if (active)
        error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (active)
        saving.value = false
    }
  }

  onMounted(load)
  return { draft, saved, ready, loaded, loading, saving, error, notice, dirty, load, save }
}
