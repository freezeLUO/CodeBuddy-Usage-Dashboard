<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '../../shared/types'
import StatCard from '../../shared/components/StatCard.vue'
import { formatCredit, formatPercent, formatTokens } from '../../shared/format'

const props = defineProps<{ overview: Overview | null }>()

const cards = computed(() => {
  const overview = props.overview
  if (!overview) return []
  const avgContext = overview.request_count ? overview.total_input_tokens / overview.request_count : 0
  return [
    {
      label: '总 Token',
      value: formatTokens(overview.total_tokens),
      hint: `输入 ${formatTokens(overview.total_input_tokens)} · 输出 ${formatTokens(overview.total_output_tokens)}`,
      accent: 'var(--cb-token-in)',
    },
    {
      label: '总积分',
      value: formatCredit(overview.total_credit),
      hint: `缓存命中 ${formatPercent(overview.cache_hit_ratio)}`,
      accent: 'var(--cb-credit)',
    },
    {
      label: '请求数',
      value: overview.request_count.toLocaleString('zh-CN'),
      hint: `平均上下文 ${formatTokens(avgContext)}`,
      accent: 'var(--vscode-charts-green, #2ea8a0)',
    },
    {
      label: '会话数',
      value: overview.conversation_count.toLocaleString('zh-CN'),
      hint: `覆盖 ${overview.workspace_count} 个项目`,
      accent: 'var(--cb-token-out)',
    },
  ]
})
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <StatCard
      v-for="card in cards"
      :key="card.label"
      dense
      :label="card.label"
      :value="card.value"
      :hint="card.hint"
      :accent="card.accent"
    />
  </div>
</template>
