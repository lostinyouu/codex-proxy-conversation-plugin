<script setup lang="ts">
import type { WorkspaceModuleId } from './constants/modules'
import type { ChatMessage, PreparedPreset } from './types'
import { ZButton, ZCard, ZConfigProvider, ZSelect } from '@codex-proxy/ui'
import { zhHans } from '@codex-proxy/ui/locale'
import { computed, shallowRef, toRaw } from 'vue'
import ConversationPanel from './components/ConversationPanel.vue'
import MessagePreview from './components/MessagePreview.vue'
import PresetPanel from './components/PresetPanel.vue'
import WorkspaceNavigation from './components/WorkspaceNavigation.vue'
import { useCatalog } from './composables/useCatalog'
import { useGeneration } from './composables/useGeneration'
import { usePreferences } from './composables/usePreferences'
import { reasoningOptions } from './utils/preferences'

defineProps<{ preview: boolean }>()
const preferences = usePreferences()
const catalog = useCatalog(preferences.draft, preferences.ready)
const generation = useGeneration()
const activeModule = shallowRef<WorkspaceModuleId>('conversation')
const preparedPreset = shallowRef<PreparedPreset | null>(null)
const followup = shallowRef('')
const canSend = computed(() => Boolean(
  preferences.loaded.value && preferences.ready.value
  && preferences.draft.value.clientKeyId && preferences.draft.value.modelId
  && !catalog.modelsLoading.value && !preferences.loading.value,
))
const controlsDisabled = computed(() => generation.running.value || preferences.loading.value || preferences.saving.value)
const resourceError = computed(() => preferences.error.value || catalog.error.value)
const identityChanged = computed(() => generation.hasConversation.value && canSend.value && !generation.matchesIdentity(preferences.draft.value))
const canCompose = computed(() => canSend.value && !identityChanged.value)
const moduleStatuses = computed<Partial<Record<WorkspaceModuleId, string>>>(() => {
  if (generation.running.value)
    return { conversation: '生成中' }
  if (generation.error.value)
    return { conversation: '生成失败' }
  return {}
})

function prepareConversation(preset: PreparedPreset) {
  if (generation.running.value)
    return
  generation.reset()
  preparedPreset.value = structuredClone(preset)
  followup.value = ''
  activeModule.value = 'conversation'
}

async function sendMessage() {
  if (!canCompose.value || generation.running.value)
    return
  const input = followup.value
  const settings = structuredClone(toRaw(preferences.draft.value))
  let success: boolean
  if (generation.hasConversation.value) {
    success = await generation.continueWith(settings, input)
  }
  else {
    const messages: ChatMessage[] = structuredClone(preparedPreset.value?.messages ?? [])
    if (input.trim())
      messages.push({ role: 'user', content: input })
    if (!messages.length)
      return
    success = await generation.start(settings, messages)
  }
  if (success) {
    preparedPreset.value = null
    if (followup.value === input)
      followup.value = ''
  }
}

function newConversation() {
  generation.reset()
  preparedPreset.value = null
  followup.value = ''
}
</script>

<template>
  <ZConfigProvider :locale="zhHans">
    <main class="grid min-w-0 gap-4 font-sans text-z-text" style="min-height: inherit">
      <p v-if="preview" class="m-0 rounded-z bg-z-warning-container px-3 py-2 text-z-sm text-z-warning-on-container" role="note">
        模拟预览 · 不调用真实模型 · 保存内容仅在当前浏览器
      </p>
      <div class="grid min-w-0 items-start gap-4 md:grid-cols-[11rem_minmax(0,1fr)]">
        <WorkspaceNavigation v-model="activeModule" :statuses="moduleStatuses" />
        <div class="min-w-0">
          <section v-show="activeModule === 'conversation'" class="grid min-w-0 gap-4" aria-label="连续对话功能">
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
            <ZCard v-if="preparedPreset && !generation.messages.value.length" padding="compact">
              <section class="grid min-w-0 gap-3" aria-label="待发送预设">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h2 class="m-0 text-z-sm font-emphasis">
                    待发送预设 · {{ preparedPreset.name }}
                  </h2>
                  <ZButton variant="text" size="small" @click="preparedPreset = null">
                    移除预设
                  </ZButton>
                </div>
                <MessagePreview :messages="preparedPreset.messages" />
              </section>
            </ZCard>
            <ZCard padding="none">
              <ConversationPanel
                v-model="followup"
                :messages="generation.messages.value"
                :running="generation.running.value"
                :status="generation.status.value"
                :error="generation.error.value"
                :facts="generation.facts.value"
                :can-compose="canCompose"
                :has-conversation="generation.hasConversation.value"
                :has-preset="Boolean(preparedPreset)"
                :identity-changed="identityChanged"
                @send="sendMessage"
                @stop="generation.stop"
                @reset="newConversation"
              />
            </ZCard>
          </section>
          <ZCard v-show="activeModule === 'presets'" padding="none">
            <PresetPanel :conversation-running="generation.running.value" @apply="prepareConversation" />
          </ZCard>
        </div>
      </div>
    </main>
  </ZConfigProvider>
</template>
