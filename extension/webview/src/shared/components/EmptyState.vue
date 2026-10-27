<script setup lang="ts">
import Icon from './Icon.vue'
import type { IconName } from '../icons'

withDefaults(
  defineProps<{ icon?: IconName; title: string; description?: string; tone?: 'normal' | 'error' }>(),
  { icon: 'database', description: '', tone: 'normal' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
    <div
      class="flex h-9 w-9 items-center justify-center rounded-full"
      :style="{
        background: 'var(--cb-card-hover)',
        color: tone === 'error' ? 'var(--cb-error)' : 'var(--cb-fg-soft)',
      }"
    >
      <Icon :name="icon" :size="17" />
    </div>
    <p class="cb-title">{{ title }}</p>
    <p v-if="description" class="max-w-[320px] text-[11px] leading-relaxed" :style="{ color: 'var(--cb-fg-soft)' }">
      {{ description }}
    </p>
    <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
