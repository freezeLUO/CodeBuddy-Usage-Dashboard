<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'
import { useFiltersStore } from '@/stores/filters'
import FilterBar from '@/components/FilterBar.vue'
import KpiCards from '@/components/KpiCards.vue'
import TokenTrendChart from '@/components/charts/TokenTrendChart.vue'
import CreditCumulativeChart from '@/components/charts/CreditCumulativeChart.vue'
import ProjectTreemap from '@/components/charts/ProjectTreemap.vue'
import ModelDonut from '@/components/charts/ModelDonut.vue'
import DailyHeatmap from '@/components/charts/DailyHeatmap.vue'

const dashboard = useDashboardStore()
const filters = useFiltersStore()
const { overview, timeseries, projects, models, loading } = storeToRefs(dashboard)

onMounted(() => {
  dashboard.loadOptions()
})

watch(
  () => filters.params,
  () => dashboard.loadAll(),
  { deep: true },
)
</script>

<template>
  <div v-loading="loading">
    <FilterBar />

    <KpiCards :overview="overview" />

    <div v-if="!timeseries.length && !loading" class="empty card">
      当前筛选条件下没有数据，试试放宽时间范围或清空筛选。
    </div>

    <template v-else>
      <div class="grid-2">
        <section class="card">
          <div class="card-title">
            <span>Token 与积分趋势</span>
            <span class="hint">堆叠柱为每日输入/输出 Token，折线为当日积分</span>
          </div>
          <TokenTrendChart :items="timeseries" />
        </section>

        <section class="card">
          <div class="card-title">
            <span>累计积分</span>
            <span class="hint">区间内积分累计走势</span>
          </div>
          <CreditCumulativeChart :items="timeseries" />
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-title">
            <span>项目消耗分布</span>
            <span class="hint">面积代表 Token 用量</span>
          </div>
          <ProjectTreemap :items="projects" />
        </section>

        <section class="card">
          <div class="card-title">
            <span>模型用量占比</span>
            <span class="hint">按 Token 排序，免费模型积分为 0</span>
          </div>
          <ModelDonut :items="models" />
        </section>
      </div>

      <section class="card">
        <div class="card-title">
          <span>每日积分热力</span>
          <span class="hint">颜色越深表示当日消耗积分越高</span>
        </div>
        <DailyHeatmap :items="timeseries" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(430px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.empty {
  padding: 60px;
  text-align: center;
  color: var(--cb-text-soft);
}
</style>
