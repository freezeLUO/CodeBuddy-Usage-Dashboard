<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TimePoint } from '@/api/types'
import { formatCredit, formatTokens } from '@/utils/format'
import { AXIS_LABEL, CREDIT_COLOR, TOOLTIP_BASE, type ChartOption } from './base'

const props = defineProps<{ items: TimePoint[] }>()

const option = computed<ChartOption>(() => {
  let running = 0
  const cumulative = props.items.map((item) => {
    running += item.credit
    return Number(running.toFixed(2))
  })

  return {
    grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP_BASE,
      trigger: 'axis',
      formatter: (params: any) => {
        const rows = Array.isArray(params) ? params : [params]
        const index = rows[0]?.dataIndex ?? 0
        const item = props.items[index]
        if (!item) return ''
        return [
          `<div style="margin-bottom:4px">${item.bucket}</div>`,
          `当日积分：<b>${formatCredit(item.credit)}</b>`,
          `累计积分：<b>${formatCredit(cumulative[index] ?? 0)}</b>`,
          `当日 Token：<b>${formatTokens(item.total_tokens)}</b>`,
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.items.map((item) => item.bucket),
      axisLabel: AXIS_LABEL,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e6e8ec' } },
    },
    yAxis: {
      type: 'value',
      name: '累计积分',
      nameTextStyle: { color: '#8a94a6', fontSize: 11 },
      axisLabel: { ...AXIS_LABEL, formatter: (value: number) => formatCredit(value) },
      splitLine: { lineStyle: { color: '#f0f1f4' } },
    },
    series: [
      {
        name: '累计积分',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: CREDIT_COLOR, width: 2.5 },
        itemStyle: { color: CREDIT_COLOR },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(217, 106, 138, 0.28)' },
              { offset: 1, color: 'rgba(217, 106, 138, 0.02)' },
            ],
          },
        },
        data: cumulative,
      },
    ],
  }
})
</script>

<template>
  <VChart class="chart tall" :option="option" autoresize />
</template>
