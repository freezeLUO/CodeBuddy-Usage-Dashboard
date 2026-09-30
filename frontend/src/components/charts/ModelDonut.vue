<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { ModelUsage } from '@/api/types'
import { formatTokens, formatCredit, formatPercent } from '@/utils/format'
import { PALETTE, TOOLTIP_BASE, type ChartOption } from './base'

const props = defineProps<{ items: ModelUsage[] }>()

// 免费模型积分为 0，按 token 排序可避免扇区面积消失
const sorted = computed(() => [...props.items].sort((a, b) => b.total_tokens - a.total_tokens))

const option = computed<ChartOption>(() => ({
  tooltip: {
    ...TOOLTIP_BASE,
    formatter: (info: any) => {
      const raw = info.data?.raw as ModelUsage | undefined
      if (!raw) return ''
      return [
        `<div style="margin-bottom:4px"><b>${raw.model_name || raw.model_id}</b></div>`,
        `Token：<b>${formatTokens(raw.total_tokens)}</b><br/>`,
        `积分：<b>${formatCredit(raw.credit)}</b><br/>`,
        `请求：<b>${raw.requests}</b> · 缓存命中：<b>${formatPercent(raw.cache_hit_ratio)}</b>`,
      ].join('')
    },
  },
  legend: {
    type: 'scroll',
    orient: 'vertical',
    right: 4,
    top: 'center',
    itemWidth: 9,
    itemHeight: 9,
    textStyle: { color: '#6b7280', fontSize: 11 },
    formatter: (name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name),
  },
  series: [
    {
      type: 'pie',
      radius: ['52%', '76%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      padAngle: 1.5,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1.5 },
      label: {
        show: true,
        position: 'center',
        formatter: () => `{sum|${formatTokens(props.items.reduce((acc, m) => acc + m.total_tokens, 0))}}\n{label|总 Token}`,
        rich: {
          sum: { fontSize: 18, fontWeight: 700, color: '#1f2430', lineHeight: 26 },
          label: { fontSize: 11, color: '#8a94a6', lineHeight: 16 },
        },
      },
      emphasis: { label: { show: true }, scale: false },
      labelLine: { show: false },
      data: sorted.value.map((item, index) => ({
        name: item.model_name || item.model_id,
        value: item.total_tokens,
        raw: item,
        itemStyle: { color: PALETTE[index % PALETTE.length] },
      })),
    },
  ],
}))
</script>

<template>
  <VChart class="chart tall" :option="option" autoresize />
</template>
