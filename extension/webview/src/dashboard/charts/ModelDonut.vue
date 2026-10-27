<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { ModelRow } from '../../shared/types'
import { formatCredit, formatPercent, formatTokens } from '../../shared/format'
import { palette } from '../../shared/theme'
import './base'
import type { ChartOption } from './base'

const props = defineProps<{ items: ModelRow[] }>()

const sorted = computed(() => [...props.items].sort((a, b) => b.total_tokens - a.total_tokens))
const totalCredit = computed(() => props.items.reduce((sum, item) => sum + item.credit, 0))

const option = computed<ChartOption>(() => {
  const colors = palette.value
  return {
    tooltip: {
      ...colors.tooltip,
      formatter: (info: unknown) => {
        const raw = (info as { data?: { raw?: ModelRow } }).data?.raw
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
      right: 2,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: colors.textSoft, fontSize: 11 },
      formatter: (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name),
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['36%', '50%'],
        avoidLabelOverlap: true,
        padAngle: 1.5,
        itemStyle: { borderRadius: 4, borderColor: colors.surface, borderWidth: 1.5 },
        label: {
          show: true,
          position: 'center',
          formatter: () => `{sum|${formatCredit(totalCredit.value)}}\n{label|总积分（面积=Token）}`,
          rich: {
            sum: { fontSize: 18, fontWeight: 700, color: colors.text, lineHeight: 24 },
            label: { fontSize: 10, color: colors.textSoft, lineHeight: 14 },
          },
        },
        emphasis: { label: { show: true }, scale: false },
        labelLine: { show: false },
        data: sorted.value.map((item, index) => ({
          name: item.model_name || item.model_id,
          value: item.total_tokens,
          raw: item,
          itemStyle: { color: colors.series[index % colors.series.length] },
        })),
      },
    ],
  }
})
</script>

<template>
  <VChart class="h-[250px] w-full" :option="option" autoresize />
</template>
