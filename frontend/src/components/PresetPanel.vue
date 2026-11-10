<script setup lang="ts">
import type { ChatMessage, PreparedPreset, Preset } from '../types'
import { ZButton, ZInput, ZSelect } from '@codex-proxy/ui'
import { computed, onMounted, onScopeDispose, ref, shallowRef, toRaw, watch } from 'vue'
import { getPresets, savePresets } from '../api/modules/lab'
import { defaultPresets, randomId, renderMessages } from '../utils/presets'
import MessageEditor from './MessageEditor.vue'
import MessagePreview from './MessagePreview.vue'

const props = defineProps<{ conversationRunning: boolean }>()
const emit = defineEmits<{ apply: [preset: PreparedPreset] }>()
const entries = shallowRef<Preset[]>([])
const draft = ref<Preset>(structuredClone(defaultPresets[0]!))
const selectedId = shallowRef('')
const rendered = shallowRef<ChatMessage[] | null>(null)
const version = shallowRef<number | null>(null)
const loading = shallowRef(false)
const saving = shallowRef(false)
const loaded = shallowRef(false)
const error = shallowRef('')
const notice = shallowRef('')
let active = true
onScopeDispose(() => {
  active = false
})

const options = computed(() => entries.value.map(p => ({ label: p.name, value: p.id })))
const modes = [{ label: '固定对话', value: 'fixed' }, { label: '随机模板', value: 'random' }]
const disabled = computed(() => saving.value || loading.value || !loaded.value)
const valid = computed(() => draft.value.name.trim() && draft.value.messages.length && draft.value.messages.every(m => m.content.trim()))
const payload = computed(() => draft.value.mode === 'fixed' ? draft.value.messages : rendered.value)
const saved = computed(() => entries.value.some(p => p.id === draft.value.id))

watch(selectedId, (id) => {
  const preset = entries.value.find(p => p.id === id)
  if (preset)
    draft.value = structuredClone(preset)
})
watch(draft, () => {
  rendered.value = null
  notice.value = ''
}, { deep: true, flush: 'sync' })

function newPreset() {
  selectedId.value = ''
  draft.value = { id: randomId(), name: '新预设', mode: 'fixed', messages: [{ role: 'user', content: '' }] }
  error.value = ''
}

async function load() {
  if (loading.value || saving.value)
    return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const reply = await getPresets()
    if (!active)
      return
    version.value = reply.version
    entries.value = reply.value?.entries ?? structuredClone(defaultPresets)
    loaded.value = true
    const first = entries.value[0]
    selectedId.value = first?.id ?? ''
    if (first)
      draft.value = structuredClone(first)
    else
      newPreset()
  }
  catch (cause) {
    if (active)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    if (active)
      loading.value = false
  }
}

async function persist(remove: boolean) {
  if (disabled.value || (!remove && !valid.value))
    return
  error.value = ''
  notice.value = ''
  const current = structuredClone(toRaw(draft.value))
  const next = entries.value.filter(p => p.id !== current.id)
  if (!remove)
    next.push(current)
  saving.value = true
  try {
    const reply = await savePresets({ entries: next }, version.value)
    if (!active)
      return
    version.value = reply.version
    entries.value = next
    if (remove) {
      selectedId.value = next[0]?.id ?? ''
      if (!next.length)
        newPreset()
    }
    else {
      selectedId.value = current.id
    }
    notice.value = remove ? '预设已删除' : '预设已保存'
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

function preview() {
  error.value = ''
  try {
    rendered.value = renderMessages(toRaw(draft.value.messages), true)
  }
  catch (cause) {
    rendered.value = null
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}

function apply() {
  if (disabled.value || props.conversationRunning || !valid.value || !payload.value)
    return
  emit('apply', { name: draft.value.name, messages: structuredClone(toRaw(payload.value)) })
}
onMounted(load)
</script>

<template>
  <section class="grid min-w-0 content-start gap-4 p-4" aria-label="预设管理" :aria-busy="loading">
    <div class="flex flex-wrap items-end gap-2">
      <div class="grid min-w-40 flex-1 gap-1.5">
        <span class="text-z-xs text-z-text-secondary">预设</span>
        <ZSelect v-model="selectedId" :options="options" :disabled="disabled" placeholder="选择预设" aria-label="预设" />
      </div>
      <ZButton :disabled="disabled" @click="newPreset">
        新建
      </ZButton>
      <ZButton :disabled="saving" :loading="loading" @click="load">
        重新载入
      </ZButton>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="grid gap-1.5">
        <span class="text-z-xs text-z-text-secondary">预设名称</span>
        <ZInput v-model="draft.name" :disabled="disabled" aria-label="预设名称" />
      </div>
      <div class="grid gap-1.5">
        <span class="text-z-xs text-z-text-secondary">内容方式</span>
        <ZSelect v-model="draft.mode" :options="modes" :disabled="disabled" aria-label="内容方式" />
      </div>
    </div>
    <p v-if="draft.mode === 'random'" class="m-0 text-z-xs leading-relaxed text-z-text-secondary">
      <span v-pre>支持 {{choice:选项一|选项二}}、{{number}}、{{uuid}}，同名变量在本组消息中使用相同值</span>
    </p>
    <MessageEditor v-model="draft.messages" :disabled="disabled" />
    <div class="flex flex-wrap gap-2">
      <ZButton :loading="saving" :disabled="disabled || !valid" @click="persist(false)">
        保存预设
      </ZButton>
      <ZButton :disabled="disabled || !saved" @click="persist(true)">
        删除预设
      </ZButton>
      <ZButton v-if="draft.mode === 'random'" :disabled="disabled || !valid" @click="preview">
        {{ rendered ? '换一组' : '生成预览' }}
      </ZButton>
    </div>
    <div v-if="draft.mode === 'random' && rendered" class="grid gap-3 rounded-z bg-z-bg-layout p-3" aria-label="实际发送内容">
      <h3 class="m-0 text-z-sm font-emphasis">
        实际发送内容
      </h3>
      <MessagePreview :messages="rendered" />
    </div>
    <p v-if="error" role="alert" class="m-0 text-z-sm text-z-error-text">
      {{ error }}
    </p>
    <p v-if="notice" role="status" class="m-0 text-z-sm text-z-success-text">
      {{ notice }}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-z-xs text-z-text-tertiary">{{ conversationRunning ? '对话生成中，完成后可载入预设' : '载入后在对话页确认发送' }}</span>
      <ZButton type="primary" variant="solid" :disabled="disabled || conversationRunning || !valid || !payload" @click="apply">
        用于新对话
      </ZButton>
    </div>
  </section>
</template>
