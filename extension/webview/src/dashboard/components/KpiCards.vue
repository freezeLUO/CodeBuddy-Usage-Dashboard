<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '../../shared/types'
import StatCard from '../../shared/components/StatCard.vue'
import { formatCredit, formatDuration, formatPercent, formatTokens } from '../../shared/format'

const props = defineProps<{ overview: Overview | null }>()

const cards = computed(() => {
  const overview = props.overview
  if (!overview) return []
  const avgContext = overview.request_count ? overview.total_input_tokens / overview.request_count : 0
  const avgCredit = overview.request_count ? overview.total_credit / overview.request_count : 0
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
      hint: `每次请求 ${formatCredit(avgCredit)} 积分`,
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
    {
      label: '缓存命中率',
      value: formatPercent(overview.cache_hit_ratio),
      hint: '命中缓存可省积分',
      accent: 'var(--vscode-charts-purple, #8b7bd6)',
    },
    {
      label: '思考 Token',
      value: formatTokens(overview.thinking_tokens),
      hint: `平均耗时 ${overview.avg_elapsed_ms ? formatDuration(overview.avg_elapsed_ms) : '未记录'}`,
      accent: 'var(--vscode-charts-blue, #4d8dff)',
    },
  ]
})
</script>

<template>
  <div
    class="grid gap-2.5"
    :style="{ gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))' }"
  >
    <StatCard
      v-for="card in cards"
      :key="card.label"
      :label="card.label"
      :value="card.value"
      :hint="card.hint"
      :accent="card.accent"
    />
  </div>
</template>
