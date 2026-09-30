<script setup lang="ts">
import { computed } from 'vue'
import type { Overview } from '@/api/types'
import { formatTokens, formatCredit, formatPercent, formatDuration } from '@/utils/format'

const props = defineProps<{ overview: Overview | null }>()

interface Kpi {
  label: string
  value: string
  hint: string
  accent: string
}

const cards = computed<Kpi[]>(() => {
  const o = props.overview
  if (!o) {
    return [
      { label: '总 Token', value: '—', hint: '', accent: '#5b5bd6' },
      { label: '总积分', value: '—', hint: '', accent: '#d96a8a' },
      { label: '请求数', value: '—', hint: '', accent: '#2ea8a0' },
      { label: '会话数', value: '—', hint: '', accent: '#e8a33d' },
      { label: '缓存命中率', value: '—', hint: '', accent: '#7d8bd6' },
      { label: '思考 Token', value: '—', hint: '', accent: '#4a9d7f' },
    ]
  }
  const avgContext = o.request_count ? o.total_input_tokens / o.request_count : 0
  return [
    {
      label: '总 Token',
      value: formatTokens(o.total_tokens),
      hint: `输入 ${formatTokens(o.total_input_tokens)} · 输出 ${formatTokens(o.total_output_tokens)}`,
      accent: '#5b5bd6',
    },
    {
      label: '总积分',
      value: formatCredit(o.total_credit),
      hint: `平均每次请求 ${o.request_count ? (o.total_credit / o.request_count).toFixed(2) : '0'} 积分`,
      accent: '#d96a8a',
    },
    {
      label: '请求数',
      value: o.request_count.toLocaleString('zh-CN'),
      hint: `平均上下文 ${formatTokens(avgContext)} / 次`,
      accent: '#2ea8a0',
    },
    {
      label: '会话数',
      value: o.conversation_count.toLocaleString('zh-CN'),
      hint: `覆盖 ${o.workspace_count} 个项目`,
      accent: '#e8a33d',
    },
    {
      label: '缓存命中率',
      value: formatPercent(o.cache_hit_ratio),
      hint: '命中缓存可显著降低积分消耗',
      accent: '#7d8bd6',
    },
    {
      label: '思考 Token',
      value: formatTokens(o.thinking_tokens),
      hint: `平均耗时 ${formatDuration(o.avg_elapsed_ms)}`,
      accent: '#4a9d7f',
    },
  ]
})
</script>

<template>
  <div class="kpi-grid">
    <div v-for="card in cards" :key="card.label" class="kpi card">
      <span class="bar" :style="{ background: card.accent }" />
      <div class="body">
        <div class="label muted">{{ card.label }}</div>
        <div class="value">{{ card.value }}</div>
        <div class="hint muted">{{ card.hint }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(208px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.kpi {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 16px 18px;
  overflow: hidden;
}

.bar {
  width: 3px;
  border-radius: 3px;
  flex: none;
}

.body {
  min-width: 0;
}

.label {
  font-size: 12px;
  margin-bottom: 6px;
  white-space: nowrap;
}

.value {
  font-size: 24px;
  font-weight: 680;
  line-height: 1.15;
  letter-spacing: -0.4px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hint {
  font-size: 11px;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
