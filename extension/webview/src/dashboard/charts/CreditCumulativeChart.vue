<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TimePoint } from '../../shared/types'
import { formatCredit, formatTokens } from '../../shared/format'
import { palette, withAlpha } from '../../shared/theme'
import './base'
import type { ChartOption } from './base'

const props = defineProps<{ items: TimePoint[] }>()

const cumulative = computed(() => {
  let running = 0
  return props.items.map((item) => {
    running += item.credit
    return Number(running.toFixed(2))
  })
})

const option = computed<ChartOption>(() => {
  const colors = palette.value
  return {
    grid: { left: 6, right: 18, top: 34, bottom: 2, containLabel: true },
    tooltip: {
      ...colors.tooltip,
      trigger: 'axis',
      formatter: (params: unknown) => {
        const rows = (Array.isArray(params) ? params : [params]) as Array<{ dataIndex?: number }>
        const index = rows[0]?.dataIndex ?? 0
        const item = props.items[index]
        if (!item) return ''
        return [
          `<div style="margin-bottom:4px">${item.bucket}</div>`,
          `当日积分：<b>${formatCredit(item.credit)}</b>`,
          `累计积分：<b>${formatCredit(cumulative.value[index] ?? 0)}</b>`,
          `当日 Token：<b>${formatTokens(item.total_tokens)}</b>`,
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.items.map((item) => item.bucket),
      axisLabel: colors.axisLabel,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.axisLine } },
    },
    yAxis: {
      type: 'value',
      name: '累计积分',
      nameTextStyle: { color: colors.textSoft, fontSize: 10 },
      axisLabel: { ...colors.axisLabel, formatter: (value: number) => formatCredit(value) },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    series: [
      {
        name: '累计积分',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: colors.credit, width: 2.4 },
        itemStyle: { color: colors.credit },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(colors.credit, 0.3) },
              { offset: 1, color: withAlpha(colors.credit, 0.02) },
            ],
          },
        },
        data: cumulative.value,
      },
    ],
  }
})
</script>

<template>
  <VChart class="h-[250px] w-full" :option="option" autoresize />
</template>
