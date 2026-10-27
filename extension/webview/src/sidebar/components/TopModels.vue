<script setup lang="ts">
import { computed } from 'vue'
import type { BarListItem, ModelRow } from '../../shared/types'
import BarList from '../../shared/components/BarList.vue'
import { formatCredit, formatPercent, formatTokens } from '../../shared/format'

const props = defineProps<{ items: ModelRow[] }>()

const rows = computed<BarListItem[]>(() => {
  const max = Math.max(1, ...props.items.map((item) => item.total_tokens))
  return props.items.map((item) => ({
    key: item.model_id,
    label: item.model_name || item.model_id,
    value: formatTokens(item.total_tokens),
    meter: item.total_tokens / max,
    hint: `${formatCredit(item.credit)} 积分 · 缓存 ${formatPercent(item.cache_hit_ratio)}`,
    accent: 'var(--vscode-charts-purple, #8b7bd6)',
  }))
})
</script>

<template>
  <BarList :items="rows" empty-text="当前时间范围内没有模型用量" />
</template>
