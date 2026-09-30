<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TimePoint } from '@/api/types'
import { formatTokens, formatCredit } from '@/utils/format'
import {
  AXIS_LABEL,
  CREDIT_COLOR,
  INPUT_COLOR,
  OUTPUT_COLOR,
  TOOLTIP_BASE,
  type ChartOption,
} from './base'

const props = defineProps<{ items: TimePoint[] }>()

const option = computed<ChartOption>(() => ({
  grid: { left: 8, right: 8, top: 44, bottom: 4, containLabel: true },
  tooltip: {
    ...TOOLTIP_BASE,
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params: any) => {
      const rows = Array.isArray(params) ? params : [params]
      const bucket = rows[0]?.axisValue ?? ''
      const lines = rows.map((row: any) => {
        const value =
          row.seriesName === '积分'
            ? formatCredit(row.value)
            : formatTokens(row.value)
        return `${row.marker}${row.seriesName}：<b>${value}</b>`
      })
      return `<div style="margin-bottom:4px">${bucket}</div>${lines.join('<br/>')}`
    },
  },
  legend: {
    top: 8,
    right: 8,
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { color: '#6b7280', fontSize: 12 },
  },
  xAxis: {
    type: 'category',
    data: props.items.map((item) => item.bucket),
    axisLabel: AXIS_LABEL,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#e6e8ec' } },
  },
  yAxis: [
    {
      type: 'value',
      name: 'Token',
      nameTextStyle: { color: '#8a94a6', fontSize: 11 },
      axisLabel: { ...AXIS_LABEL, formatter: (value: number) => formatTokens(value) },
      splitLine: { lineStyle: { color: '#f0f1f4' } },
    },
    {
      type: 'value',
      name: '积分',
      nameTextStyle: { color: '#8a94a6', fontSize: 11 },
      axisLabel: AXIS_LABEL,
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: '输入 Token',
      type: 'bar',
      stack: 'token',
      barMaxWidth: 22,
      itemStyle: { color: INPUT_COLOR, borderRadius: [0, 0, 0, 0] },
      data: props.items.map((item) => item.input_tokens),
    },
    {
      name: '输出 Token',
      type: 'bar',
      stack: 'token',
      barMaxWidth: 22,
      itemStyle: { color: OUTPUT_COLOR, borderRadius: [3, 3, 0, 0] },
      data: props.items.map((item) => item.output_tokens),
    },
    {
      name: '积分',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { color: CREDIT_COLOR, width: 2 },
      itemStyle: { color: CREDIT_COLOR },
      data: props.items.map((item) => item.credit),
    },
  ],
}))
</script>

<template>
  <VChart class="chart tall" :option="option" autoresize />
</template>
