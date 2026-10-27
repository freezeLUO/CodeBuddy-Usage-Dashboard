<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardPayload } from '../../shared/types'
import KpiCards from '../components/KpiCards.vue'
import EmptyState from '../../shared/components/EmptyState.vue'
import Icon from '../../shared/components/Icon.vue'
import { formatCredit } from '../../shared/format'
import TokenTrendChart from '../charts/TokenTrendChart.vue'
import CreditCumulativeChart from '../charts/CreditCumulativeChart.vue'
import ProjectTreemap from '../charts/ProjectTreemap.vue'
import ModelDonut from '../charts/ModelDonut.vue'
import DailyHeatmap from '../charts/DailyHeatmap.vue'

const props = defineProps<{ data: DashboardPayload | null; loading: boolean }>()
const emit = defineEmits<{ refresh: []; openSettings: [] }>()

const cardGrid = { gridTemplateColumns: 'repeat(auto-fit, minmax(430px, 1fr))' }

const heatStats = computed(() => {
  const items = props.data?.timeseries ?? []
  const active = items.filter((item) => item.credit > 0)
  const peak = items.reduce((max, item) => Math.max(max, item.credit), 0)
  const average = active.length ? active.reduce((sum, item) => sum + item.credit, 0) / active.length : 0
  return { peak, average, activeDays: active.length, days: items.length }
})
</script>

<template>
  <div class="flex flex-col gap-3 px-4 py-3">
    <KpiCards :overview="data?.overview ?? null" />

    <div
      v-if="data && !data.overview.request_count"
      class="cb-card"
    >
      <EmptyState
        icon="chart"
        title="当前筛选条件下没有数据"
        description="可以放宽时间范围、清空项目与模型筛选，或刷新一次本地数据。"
      >
        <button type="button" class="cb-btn cb-btn--ghost" @click="emit('openSettings')">
          <Icon name="settings" :size="12" />
          数据目录设置
        </button>
        <button type="button" class="cb-btn cb-btn--primary" @click="emit('refresh')">刷新数据</button>
      </EmptyState>
    </div>

    <template v-else>
      <div class="grid gap-3" :style="cardGrid">
        <section class="cb-card px-3 py-2.5">
          <header class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span class="cb-title">Token 与积分趋势</span>
            <span class="cb-hint">堆叠柱为每日输入/输出 Token，折线为当日积分</span>
          </header>
          <TokenTrendChart :items="data?.timeseries ?? []" />
        </section>

        <section class="cb-card px-3 py-2.5">
          <header class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span class="cb-title">累计积分</span>
            <span class="cb-hint">区间内积分累计走势</span>
          </header>
          <CreditCumulativeChart :items="data?.timeseries ?? []" />
        </section>
      </div>

      <div class="grid gap-3" :style="cardGrid">
        <section class="cb-card px-3 py-2.5">
          <header class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span class="cb-title">项目消耗分布</span>
            <span class="cb-hint">面积代表 Token 用量，悬停查看积分与路径</span>
          </header>
          <ProjectTreemap :items="data?.projects ?? []" />
        </section>

        <section class="cb-card px-3 py-2.5">
          <header class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span class="cb-title">模型用量占比</span>
            <span class="cb-hint">按 Token 排序，免费模型积分为 0</span>
          </header>
          <ModelDonut :items="data?.models ?? []" />
        </section>
      </div>

      <section class="cb-card px-3 py-2.5">
        <div class="mx-auto w-full max-w-[960px]">
          <header class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span class="cb-title">每日积分热力</span>
            <span class="cb-hint">颜色越深表示当日消耗积分越高</span>
          </header>
          <div class="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <div class="w-[300px] max-w-full">
              <DailyHeatmap :items="data?.timeseries ?? []" />
            </div>
            <dl class="flex shrink-0 gap-6">
              <div>
                <dt class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">峰值单日</dt>
                <dd class="cb-num mt-0.5 text-[15px] font-semibold" :style="{ color: 'var(--cb-credit)' }">
                  {{ formatCredit(heatStats.peak) }}
                </dd>
              </div>
              <div>
                <dt class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">日均（有消耗）</dt>
                <dd class="cb-num mt-0.5 text-[15px] font-semibold">{{ formatCredit(heatStats.average) }}</dd>
              </div>
              <div>
                <dt class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">有消耗天数</dt>
                <dd class="cb-num mt-0.5 text-[15px] font-semibold">
                  {{ heatStats.activeDays }}<span class="text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }"> / {{ heatStats.days }}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
