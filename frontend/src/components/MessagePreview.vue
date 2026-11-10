<script setup lang="ts">
import type { ChatMessage } from '../types'
import { messageRoleLabels } from '../utils/conversation'

defineProps<{ messages: ChatMessage[] }>()
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <div v-for="(message, index) in messages" :key="index" class="grid min-w-0 gap-1">
      <span class="text-z-xs text-z-text-secondary">{{ messageRoleLabels[message.role] }}</span>
      <pre class="m-0 whitespace-pre-wrap break-words font-sans text-z-sm leading-relaxed">{{ message.content }}</pre>
    </div>
  </div>
</template>
