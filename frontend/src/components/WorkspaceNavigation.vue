<script setup lang="ts">
import type { WorkspaceModuleId } from '../constants/modules'
import { ZButton, ZCard } from '@codex-proxy/ui'
import { workspaceModules } from '../constants/modules'

defineProps<{ statuses: Partial<Record<WorkspaceModuleId, string>> }>()
const active = defineModel<WorkspaceModuleId>({ required: true })
</script>

<template>
  <aside class="min-w-0 self-start">
    <ZCard padding="compact">
      <nav class="grid grid-cols-2 gap-1 md:grid-cols-1" aria-label="功能导航">
        <ZButton
          v-for="item in workspaceModules"
          :key="item.id"
          :type="active === item.id ? 'primary' : 'default'"
          :variant="active === item.id ? 'solid' : 'text'"
          :aria-label="item.label"
          :aria-current="active === item.id ? 'page' : undefined"
          :aria-describedby="active !== item.id && statuses[item.id] ? `module-status-${item.id}` : undefined"
          class="w-full"
          @click="active = item.id"
        >
          <span class="flex w-full items-center justify-between gap-2">
            <span>{{ item.label }}</span>
            <span v-if="active !== item.id && statuses[item.id]" :id="`module-status-${item.id}`" role="status" class="text-z-xs">{{ statuses[item.id] }}</span>
          </span>
        </ZButton>
      </nav>
    </ZCard>
  </aside>
</template>
