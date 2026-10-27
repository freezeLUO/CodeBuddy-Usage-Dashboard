<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TimePoint } from '../../shared/types'
import { formatCredit, formatTokens } from '../../shared/format'
import { palette } from '../../shared/theme'
import './base'
import type { ChartOption } from './base'

const props = defineProps<{ items: TimePoint[] }>()

const option = computed<ChartOption>(() => {
  const colors = palette.value
  return {
    grid: { left: 6, right: 16, top: 42, bottom: 2, containLabel: true },
    tooltip: {
      ...colors.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(128,128,128,0.08)' } },
      formatter: (params: unknown) => {
        const rows = (Array.isArray(params) ? params : [params]) as Array<{
          axisValue?: string
          seriesName?: string
          value?: number
          marker?: string
        }>
        const bucket = rows[0]?.axisValue ?? ''
        const lines = rows.map((row) => {
          const value = row.seriesName === '积分' ? formatCredit(row.value ?? 0) : formatTokens(row.value ?? 0)
          return `${row.marker ?? ''}${row.seriesName}：<b>${value}</b>`
        })
        return `<div style="margin-bottom:4px">${bucket}</div>${lines.join('<br/>')}`
      },
    },
    legend: {
      top: 6,
      right: 4,
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: colors.textSoft, fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: props.items.map((item) => item.bucket),
      axisLabel: colors.axisLabel,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: colors.axisLine } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Token',
        nameTextStyle: { color: colors.textSoft, fontSize: 10 },
        axisLabel: { ...colors.axisLabel, formatter: (value: number) => formatTokens(value) },
        splitLine: { lineStyle: { color: colors.splitLine } },
      },
      {
        type: 'value',
        name: '积分',
        nameTextStyle: { color: colors.textSoft, fontSize: 10 },
        axisLabel: colors.axisLabel,
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '输入 Token',
        type: 'bar',
        stack: 'token',
        barMaxWidth: 20,
        itemStyle: { color: colors.input },
        data: props.items.map((item) => item.input_tokens),
      },
      {
        name: '输出 Token',
        type: 'bar',
        stack: 'token',
        barMaxWidth: 20,
        itemStyle: { color: colors.output, borderRadius: [2, 2, 0, 0] },
        data: props.items.map((item) => item.output_tokens),
      },
      {
        name: '积分',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: colors.credit, width: 2 },
        itemStyle: { color: colors.credit },
        data: props.items.map((item) => item.credit),
      },
    ],
  }
})
</script>

<template>
  <VChart class="h-[250px] w-full" :option="option" autoresize />
</template>
