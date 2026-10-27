<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { TimePoint } from '../../shared/types'
import { formatCredit, formatTokens } from '../../shared/format'
import { isDark, palette } from '../../shared/theme'
import './base'
import type { ChartOption } from './base'

const props = defineProps<{ items: TimePoint[] }>()

const gradient = computed(() =>
  isDark.value
    ? ['#22262f', '#2c4a6b', '#2f6ea8', '#4d8dff', '#9cc4ff']
    : ['#eef2fb', '#c3d4f2', '#93b2e8', '#5b7fd6', '#344fa8'],
)

const option = computed<ChartOption>(() => {
  const colors = palette.value
  const data = props.items.map((item) => [item.bucket, item.credit])
  const max = Math.max(1, ...props.items.map((item) => item.credit))
  const range: [string, string] = props.items.length
    ? [props.items[0]!.bucket, props.items[props.items.length - 1]!.bucket]
    : ['2026-01-01', '2026-12-31']

  return {
    tooltip: {
      ...colors.tooltip,
      formatter: (info: unknown) => {
        const bucket = (info as { data?: [string, number] }).data?.[0]
        const item = props.items.find((row) => row.bucket === bucket)
        if (!item) return `${bucket ?? ''}：<b>0</b> 积分`
        return [
          `<div style="margin-bottom:4px">${item.bucket}</div>`,
          `积分：<b>${formatCredit(item.credit)}</b><br/>`,
          `Token：<b>${formatTokens(item.total_tokens)}</b><br/>`,
          `请求：<b>${item.requests}</b>`,
        ].join('')
      },
    },
    // 图例用 HTML 渲染，避免 visualMap 与日历网格重叠
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: { color: gradient.value },
    },
    calendar: {
      range,
      top: 30,
      left: 'center',
      cellSize: [30, 30],
      itemStyle: { borderColor: colors.surface, borderWidth: 2, borderRadius: 2 },
      splitLine: { show: false },
      dayLabel: { color: colors.textSoft, fontSize: 10, nameMap: ['日', '一', '二', '三', '四', '五', '六'] },
      monthLabel: { color: colors.textSoft, fontSize: 11 },
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
  <VChart class="h-[248px] w-full" :option="option" autoresize />
  <div class="mt-1 flex items-center justify-center gap-2 text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
    <span>低</span>
    <span
      class="h-[6px] w-[96px] rounded-full"
      :style="{ background: `linear-gradient(90deg, ${gradient.join(', ')})` }"
    />
    <span>高</span>
  </div>
</template>
