<script setup lang="ts">
import type { BarListItem } from '../types'

withDefaults(defineProps<{ items: BarListItem[]; emptyText?: string }>(), {
  emptyText: '暂无数据',
})
</script>

<template>
  <ul v-if="items.length" class="flex flex-col gap-2">
    <li v-for="item in items" :key="item.key" class="min-w-0">
      <div class="flex items-baseline justify-between gap-2">
        <span class="truncate text-[11.5px]" :title="item.label">{{ item.label }}</span>
        <span class="cb-num shrink-0 text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">{{ item.value }}</span>
      </div>
      <div class="mt-1 h-[3px] overflow-hidden rounded-full" :style="{ background: 'var(--cb-border-soft)' }">
        <div
          class="h-full rounded-full transition-all duration-300"
          :style="{
            width: `${Math.max(2, Math.min(100, item.meter * 100))}%`,
            background: item.accent ?? 'var(--cb-accent-soft)',
          }"
        />
      </div>
      <p v-if="item.hint" class="mt-0.5 truncate text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">
        {{ item.hint }}
      </p>
    </li>
  </ul>
  <p v-else class="py-3 text-center text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">{{ emptyText }}</p>
</template>
