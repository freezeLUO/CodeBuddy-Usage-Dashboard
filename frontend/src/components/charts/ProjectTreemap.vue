<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { ProjectUsage } from '@/api/types'
import { formatTokens, formatCredit } from '@/utils/format'
import { PALETTE, TOOLTIP_BASE, type ChartOption } from './base'

const props = defineProps<{ items: ProjectUsage[] }>()

const option = computed<ChartOption>(() => ({
  tooltip: {
    ...TOOLTIP_BASE,
    formatter: (info: any) => {
      const data = info.data ?? {}
      const raw = data.raw as ProjectUsage | undefined
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
      top: 6,
      left: 6,
      right: 6,
      bottom: 6,
      itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
      label: {
        show: true,
        formatter: (params: any) => {
          const raw = params.data?.raw as ProjectUsage | undefined
          if (!raw) return params.name
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
        itemStyle: { color: PALETTE[index % PALETTE.length] },
      })),
    },
  ],
}))
</script>

<template>
  <VChart class="chart tall" :option="option" autoresize />
</template>
