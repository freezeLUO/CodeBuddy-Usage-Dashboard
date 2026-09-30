<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TimePoint } from '@/api/types'
import { formatTokens, formatCredit } from '@/utils/format'
import { TOOLTIP_BASE, type ChartOption } from './base'

const props = defineProps<{ items: TimePoint[] }>()

const option = computed<ChartOption>(() => {
  const data = props.items.map((item) => [item.bucket, item.credit])
  const max = Math.max(1, ...props.items.map((item) => item.credit))
  const range: [string, string] = props.items.length
    ? [props.items[0]!.bucket, props.items[props.items.length - 1]!.bucket]
    : ['2026-01-01', '2026-12-31']

  return {
    tooltip: {
      ...TOOLTIP_BASE,
      formatter: (info: any) => {
        const item = props.items.find((row) => row.bucket === info.data?.[0])
        if (!item) return `${info.data?.[0]}：<b>0</b> 积分`
        return [
          `<div style="margin-bottom:4px">${item.bucket}</div>`,
          `积分：<b>${formatCredit(item.credit)}</b><br/>`,
          `Token：<b>${formatTokens(item.total_tokens)}</b><br/>`,
          `请求：<b>${item.requests}</b>`,
        ].join('')
      },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 90,
      textStyle: { color: '#8a94a6', fontSize: 11 },
      inRange: { color: ['#eef0ff', '#b9baf0', '#8a8ae2', '#5b5bd6', '#3f3fa8'] },
    },
    calendar: {
      range,
      top: 24,
      left: 30,
      right: 20,
      bottom: 46,
      cellSize: ['auto', 18],
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      splitLine: { show: false },
      dayLabel: { color: '#8a94a6', fontSize: 10, nameMap: ['日', '一', '二', '三', '四', '五', '六'] },
      monthLabel: { color: '#6b7280', fontSize: 11 },
      yearLabel: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data,
      },
    ],
  }
})
</script>

<template>
  <VChart class="chart tall" :option="option" autoresize />
</template>
