<script setup lang="ts">
import type { ChatMessage } from './types'
import { ZButton, ZCard, ZConfigProvider, ZSelect } from '@codex-proxy/ui'
import { zhHans } from '@codex-proxy/ui/locale'
import { computed, shallowRef, toRaw } from 'vue'
import ConversationPanel from './components/ConversationPanel.vue'
import PresetPanel from './components/PresetPanel.vue'
import { useCatalog } from './composables/useCatalog'
import { useGeneration } from './composables/useGeneration'
import { usePreferences } from './composables/usePreferences'
import { reasoningOptions } from './utils/preferences'

defineProps<{ preview: boolean }>()
const preferences = usePreferences()
const catalog = useCatalog(preferences.draft, preferences.ready)
const generation = useGeneration()
const followup = shallowRef('')
const canSend = computed(() => Boolean(
  preferences.loaded.value && preferences.ready.value
  && preferences.draft.value.clientKeyId && preferences.draft.value.modelId
  && !catalog.modelsLoading.value && !preferences.loading.value,
))
const controlsDisabled = computed(() => generation.running.value || preferences.loading.value || preferences.saving.value)
const resourceError = computed(() => preferences.error.value || catalog.error.value)
const identityChanged = computed(() => generation.hasConversation.value && canSend.value && !generation.matchesIdentity(preferences.draft.value))
const canContinue = computed(() => generation.hasConversation.value && canSend.value && !identityChanged.value)

function send(messages: ChatMessage[]) {
  if (!canSend.value || generation.running.value)
    return
  followup.value = ''
  return generation.start(structuredClone(toRaw(preferences.draft.value)), messages)
}

async function continueConversation() {
  const input = followup.value
  const success = await generation.continueWith(structuredClone(toRaw(preferences.draft.value)), input)
  if (success && followup.value === input)
    followup.value = ''
}

function newConversation() {
  generation.reset()
  followup.value = ''
}
</script>

<template>
  <ZConfigProvider :locale="zhHans">
    <main class="grid min-w-0 gap-4 font-sans text-z-text" style="min-height: inherit">
      <p v-if="preview" class="m-0 rounded-z bg-z-warning-container px-3 py-2 text-z-sm text-z-warning-on-container" role="note">
        模拟预览 · 不调用真实模型 · 保存内容仅在当前浏览器
      </p>
      <ZCard padding="compact">
        <div class="flex flex-wrap items-end gap-3">
          <div class="grid min-w-48 flex-1 gap-1.5">
            <span class="text-z-xs text-z-text-secondary">客户端 Key</span>
            <ZSelect v-model="preferences.draft.value.clientKeyId" :options="catalog.keyOptions.value" :disabled="controlsDisabled || catalog.keysLoading.value" placeholder="请选择 Key" aria-label="客户端 Key" />
          </div>
          <div class="grid min-w-48 flex-1 gap-1.5">
            <span class="text-z-xs text-z-text-secondary">模型</span>
            <ZSelect v-model="preferences.draft.value.modelId" :options="catalog.modelOptions.value" :disabled="controlsDisabled || catalog.modelsLoading.value" :placeholder="catalog.modelsLoading.value ? '正在读取模型' : '请选择模型'" aria-label="模型" />
          </div>
          <div class="grid min-w-40 flex-1 gap-1.5">
            <span class="text-z-xs text-z-text-secondary">推理强度</span>
            <ZSelect v-model="preferences.draft.value.reasoningEffort" :options="reasoningOptions" :disabled="controlsDisabled" aria-label="推理强度" />
          </div>
          <div class="flex flex-wrap gap-2">
            <ZButton :loading="catalog.keysLoading.value" :disabled="controlsDisabled" @click="catalog.refresh">
              刷新 Key
            </ZButton>
            <ZButton :loading="preferences.loading.value" :disabled="generation.running.value || preferences.saving.value" @click="preferences.load">
              载入默认
            </ZButton>
            <ZButton :loading="preferences.saving.value" :disabled="controlsDisabled || !canSend || !preferences.dirty.value" @click="preferences.save">
              保存默认
            </ZButton>
          </div>
        </div>
        <p v-if="resourceError" role="alert" class="mb-0 text-z-sm text-z-error-text">
          {{ resourceError }}
        </p>
        <p v-else-if="catalog.notice.value" role="status" class="mb-0 text-z-sm text-z-warning-text">
          {{ catalog.notice.value }}
        </p>
        <p v-else-if="preferences.notice.value && !preferences.dirty.value" role="status" class="mb-0 text-z-sm text-z-success-text">
          {{ preferences.notice.value }}
        </p>
      </ZCard>
      <ZCard padding="none">
        <div class="grid min-w-0 lg:grid-cols-2">
          <PresetPanel :running="generation.running.value" :can-send="canSend" :has-conversation="generation.hasConversation.value" @send="send" />
          <ConversationPanel
            v-model="followup"
            :messages="generation.messages.value"
            :running="generation.running.value"
            :status="generation.status.value"
            :error="generation.error.value"
            :facts="generation.facts.value"
            :can-continue="canContinue"
            :has-conversation="generation.hasConversation.value"
            :identity-changed="identityChanged"
            @send="continueConversation"
            @stop="generation.stop"
            @reset="newConversation"
          />
        </div>
      </ZCard>
    </main>
  </ZConfigProvider>
</template>
