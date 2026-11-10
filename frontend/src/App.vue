<script setup lang="ts">
import type { ChatMessage } from './types'
import { ZButton, ZCard, ZConfigProvider, ZSelect } from '@codex-proxy/ui'
import { zhHans } from '@codex-proxy/ui/locale'
import { computed } from 'vue'
import PresetPanel from './components/PresetPanel.vue'
import { useCatalog } from './composables/useCatalog'
import { useGeneration } from './composables/useGeneration'

defineProps<{ preview: boolean }>()
const catalog = useCatalog()
const generation = useGeneration()
const canSend = computed(() => Boolean(catalog.clientKeyId.value && catalog.modelId.value && !catalog.modelsLoading.value))
const tokenLabel = computed(() => {
  const result = generation.result.value
  return result ? `输入 ${result.inputTokens ?? '—'} · 输出 ${result.outputTokens ?? '—'} Token` : ''
})
function send(messages: ChatMessage[]) {
  return generation.send(catalog.clientKeyId.value, catalog.modelId.value, messages)
}
</script>

<template>
  <ZConfigProvider :locale="zhHans">
    <main class="grid min-w-0 gap-4 font-sans text-z-text" style="min-height: inherit">
      <p v-if="preview" class="m-0 rounded-z bg-z-warning-container px-3 py-2 text-z-sm text-z-warning-on-container" role="note">
        模拟预览 · 不调用真实模型 · 预设仅保存在当前浏览器
      </p>
      <ZCard padding="compact">
        <div class="flex flex-wrap items-end gap-3">
          <div class="grid min-w-48 flex-1 gap-1.5">
            <span class="text-z-xs text-z-text-secondary">客户端 Key</span>
            <ZSelect v-model="catalog.clientKeyId.value" :options="catalog.keyOptions.value" :disabled="generation.running.value || catalog.keysLoading.value" placeholder="暂无可用 Key" aria-label="客户端 Key" />
          </div>
          <div class="grid min-w-48 flex-1 gap-1.5">
            <span class="text-z-xs text-z-text-secondary">模型</span>
            <ZSelect v-model="catalog.modelId.value" :options="catalog.modelOptions.value" :disabled="generation.running.value || catalog.modelsLoading.value" :placeholder="catalog.modelsLoading.value ? '正在读取模型' : '暂无可用模型'" aria-label="模型" />
          </div>
          <ZButton :loading="catalog.keysLoading.value" :disabled="generation.running.value" @click="catalog.refresh">
            刷新 Key
          </ZButton>
        </div>
        <p v-if="catalog.error.value" role="alert" class="mb-0 text-z-sm text-z-error-text">
          {{ catalog.error.value }}
        </p>
      </ZCard>
      <ZCard padding="none">
        <div class="grid min-w-0 lg:grid-cols-2">
          <PresetPanel :running="generation.running.value" :can-send="canSend" @send="send" @stop="generation.stop" />
          <section class="grid min-w-0 content-start gap-4 bg-z-bg-layout p-4" aria-label="模型回复" :aria-busy="generation.running.value">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="m-0 text-z-sm font-emphasis">
                模型回复
              </h2>
              <span role="status" class="text-z-xs text-z-text-secondary">{{ generation.status.value }}</span>
            </div>
            <p v-if="generation.error.value" role="alert" class="m-0 whitespace-pre-wrap break-words text-z-sm text-z-error-text">
              {{ generation.error.value }}
            </p>
            <pre v-if="generation.text.value" class="m-0 min-h-40 whitespace-pre-wrap break-words font-sans text-z-sm leading-relaxed">{{ generation.text.value }}</pre>
            <p v-else class="m-0 min-h-40 text-z-sm text-z-text-tertiary">
              {{ generation.running.value ? '等待模型回复' : '选择预设或编辑消息后发送' }}
            </p>
            <div v-if="generation.elapsed.value || generation.running.value" class="grid gap-1 text-z-xs text-z-text-secondary">
              <span v-if="generation.result.value?.model">{{ generation.result.value.model }}</span>
              <span v-if="tokenLabel">{{ tokenLabel }}</span>
              <span v-if="!generation.running.value">耗时 {{ (generation.elapsed.value / 1000).toFixed(2) }} 秒</span>
              <span v-if="generation.requestId.value" class="break-all">请求 ID · {{ generation.requestId.value }}</span>
            </div>
          </section>
        </div>
      </ZCard>
    </main>
  </ZConfigProvider>
</template>
