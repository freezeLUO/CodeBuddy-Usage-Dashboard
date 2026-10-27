<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { ProjectRow } from '../../shared/types'
import { formatCredit, formatTokens } from '../../shared/format'
import { palette } from '../../shared/theme'
import './base'
import type { ChartOption } from './base'

const props = defineProps<{ items: ProjectRow[] }>()

const option = computed<ChartOption>(() => {
  const colors = palette.value
  return {
    tooltip: {
      ...colors.tooltip,
      formatter: (info: unknown) => {
        const data = (info as { data?: { raw?: ProjectRow } }).data
        const raw = data?.raw
        if (!raw) return ''
        return [
          `<div style="margin-bottom:4px"><b>${raw.display_name}</b></div>`,
          `<div style="opacity:.65;font-size:11px;margin-bottom:6px">${raw.path || '—'}</div>`,
          `Token：<b>${formatTokens(raw.total_tokens)}</b><br/>`,
          `积分：<b>${formatCredit(raw.credit)}</b><br/>`,
          `请求：<b>${raw.requests}</b> · 会话：<b>${raw.conversations}</b>`,
        ].join('')
      },
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: '100%',
        height: '100%',
        top: 4,
        left: 4,
        right: 4,
        bottom: 4,
        itemStyle: { borderColor: colors.surface, borderWidth: 2, gapWidth: 2 },
        label: {
          show: true,
          formatter: (params: unknown) => {
            const raw = (params as { data?: { raw?: ProjectRow } }).data?.raw
            if (!raw) return (params as { name?: string }).name ?? ''
            return `{name|${raw.display_name}}\n{value|${formatTokens(raw.total_tokens)}}`
          },
          rich: {
            name: { fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 18 },
            value: { fontSize: 11, color: 'rgba(255,255,255,.82)', lineHeight: 16 },
          },
        },
        upperLabel: { show: false },
        data: props.items.map((item, index) => ({
          name: item.display_name,
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
