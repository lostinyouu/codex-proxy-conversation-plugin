<script setup lang="ts">
import type { ChatMessage } from '../types'
import { ZButton, ZSelect, ZTextarea } from '@codex-proxy/ui'

defineProps<{ disabled: boolean }>()
const messages = defineModel<ChatMessage[]>({ required: true })
const roles = [
  { label: '系统', value: 'system' },
  { label: '用户', value: 'user' },
  { label: '助手', value: 'assistant' },
]
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <div v-for="(message, index) in messages" :key="index" class="grid min-w-0 gap-2 rounded-z bg-z-bg-layout p-3">
      <div class="flex items-center gap-2">
        <span class="text-z-xs text-z-text-secondary">{{ index + 1 }}</span>
        <ZSelect v-model="message.role" :options="roles" :disabled="disabled" :aria-label="`第 ${index + 1} 条消息角色`" class="w-28" />
        <ZButton variant="text" size="small" :disabled="disabled || messages.length === 1" class="ml-auto" :aria-label="`删除第 ${index + 1} 条消息`" @click="messages.splice(index, 1)">
          删除
        </ZButton>
      </div>
      <ZTextarea v-model="message.content" :disabled="disabled" :rows="3" :aria-label="`第 ${index + 1} 条消息内容`" placeholder="输入对话内容" />
    </div>
    <ZButton variant="text" :disabled="disabled || messages.length >= 32" @click="messages.push({ role: 'user', content: '' })">
      添加消息
    </ZButton>
  </div>
</template>
