<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ page: number; size: number; total: number }>()
const emit = defineEmits<{ change: [page: number] }>()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.size)))

function go(target: number): void {
  const next = Math.min(pages.value, Math.max(1, target))
  if (next !== props.page) emit('change', next)
}
</script>

<template>
  <div class="flex items-center justify-between gap-2 text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
    <span>共 {{ total.toLocaleString('zh-CN') }} 条 · 第 {{ page }} / {{ pages }} 页</span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="cb-btn h-[24px] px-2 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >
        <Icon name="chevron-left" :size="12" />
      </button>
      <button
        type="button"
        class="cb-btn h-[24px] px-2 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page >= pages"
        @click="go(page + 1)"
      >
        <Icon name="chevron-right" :size="12" />
      </button>
    </div>
  </div>
</template>
