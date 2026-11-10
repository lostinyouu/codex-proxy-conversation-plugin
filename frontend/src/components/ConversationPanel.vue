<script setup lang="ts">
import type { ChatMessage, GenerationFacts } from '../types'
import { ZButton, ZTextarea } from '@codex-proxy/ui'
import { computed } from 'vue'
import { messageRoleLabels } from '../utils/conversation'

const props = defineProps<{
  messages: ChatMessage[]
  running: boolean
  status: string
  error: string
  facts: GenerationFacts | null
  canCompose: boolean
  hasConversation: boolean
  hasPreset: boolean
  identityChanged: boolean
}>()
const emit = defineEmits<{ send: [], stop: [], reset: [] }>()
const draft = defineModel<string>({ required: true })
const canSubmit = computed(() => props.canCompose && Boolean(draft.value.trim() || (!props.hasConversation && props.hasPreset)))
</script>

<template>
  <section class="grid min-w-0 content-start gap-4 bg-z-bg-layout p-4" aria-label="连续对话" :aria-busy="running">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="m-0 text-z-sm font-emphasis">
        对话
      </h2>
      <div class="flex items-center gap-2">
        <span role="status" class="text-z-xs text-z-text-secondary">{{ status }}</span>
        <ZButton variant="text" size="small" :disabled="running || (!messages.length && !hasPreset && !draft.trim())" @click="emit('reset')">
          新建对话
        </ZButton>
      </div>
    </div>
    <p v-if="!messages.length && !hasPreset" class="m-0 min-h-24 text-z-sm text-z-text-tertiary">
      输入消息开始对话，也可在预设管理中载入模板
    </p>
    <div v-for="(message, index) in messages" :key="index" class="grid min-w-0 gap-1.5 rounded-z bg-z-bg-container p-3">
      <span class="text-z-xs font-emphasis text-z-text-secondary">{{ messageRoleLabels[message.role] }}</span>
      <pre class="m-0 whitespace-pre-wrap break-words font-sans text-z-sm leading-relaxed">{{ message.content }}</pre>
    </div>
    <p v-if="error" role="alert" class="m-0 whitespace-pre-wrap break-words text-z-sm text-z-error-text">
      {{ error }}
    </p>
    <div v-if="facts" class="grid gap-1 text-z-xs text-z-text-secondary" aria-label="本轮用量">
      <span v-if="facts.model">{{ facts.model }}</span>
      <span>输入 {{ facts.inputTokens ?? '—' }} · 输出 {{ facts.outputTokens ?? '—' }} Token</span>
      <span>耗时 {{ (facts.elapsedMs / 1000).toFixed(2) }} 秒</span>
      <span v-if="facts.requestId" class="break-all">请求 ID · {{ facts.requestId }}</span>
    </div>
    <p v-if="identityChanged" class="m-0 text-z-sm text-z-warning-text">
      Key 或模型已更改，请开始新对话
    </p>
    <div class="grid gap-2">
      <ZTextarea v-model="draft" :rows="3" :disabled="running || !canCompose" aria-label="对话消息" :placeholder="hasConversation ? '继续提问，Ctrl + Enter 发送' : hasPreset ? '补充消息（可选），Ctrl + Enter 发送' : '输入消息，Ctrl + Enter 发送'" @keydown.ctrl.enter.prevent="canSubmit && !running && emit('send')" />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-z-xs text-z-text-tertiary">发送将使用所选 Key 的额度</span>
        <ZButton v-if="running" @click="emit('stop')">
          停止生成
        </ZButton>
        <ZButton v-else type="primary" variant="solid" :disabled="!canSubmit" @click="emit('send')">
          发送消息
        </ZButton>
      </div>
    </div>
  </section>
</template>
