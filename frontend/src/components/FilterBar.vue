<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { useFiltersStore } from '@/stores/filters'
import { useDashboardStore } from '@/stores/dashboard'

const filters = useFiltersStore()
const dashboard = useDashboardStore()
const { allProjects, allModels } = storeToRefs(dashboard)

const range = computed({
  get: () => {
    const [start, end] = filters.range
    return start && end ? [new Date(start), new Date(end)] as [Date, Date] : null
  },
  set: (value: [Date, Date] | null) => {
    filters.range = value
      ? [dayjs(value[0]).format('YYYY-MM-DD'), dayjs(value[1]).format('YYYY-MM-DD')]
      : [null, null]
  },
})

const hasFilter = computed(() => filters.active)
</script>

<template>
  <div class="filter-bar card">
    <div class="group">
      <label class="muted">时间范围</label>
      <el-date-picker
        v-model="range"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        :clearable="true"
        style="width: 260px"
      />
    </div>

    <div class="group">
      <label class="muted">项目</label>
      <el-select
        v-model="filters.workspaces"
        multiple
        collapse-tags
        collapse-tags-tooltip
        clearable
        placeholder="全部项目"
        style="width: 260px"
      >
        <el-option
          v-for="item in allProjects"
          :key="item.workspace_hash"
          :label="item.display_name"
          :value="item.workspace_hash"
        >
          <span>{{ item.display_name }}</span>
          <span class="opt-path">{{ item.path }}</span>
        </el-option>
      </el-select>
    </div>

    <div class="group">
      <label class="muted">模型</label>
      <el-select
        v-model="filters.models"
        multiple
        collapse-tags
        collapse-tags-tooltip
        clearable
        placeholder="全部模型"
        style="width: 240px"
      >
        <el-option
          v-for="item in allModels"
          :key="item.model_id"
          :label="item.model_name || item.model_id"
          :value="item.model_id"
        />
      </el-select>
    </div>

    <div class="group">
      <label class="muted">粒度</label>
      <el-radio-group v-model="filters.granularity" size="default">
        <el-radio-button value="day">按天</el-radio-button>
        <el-radio-button value="week">按周</el-radio-button>
      </el-radio-group>
    </div>

    <el-button v-if="hasFilter" text type="primary" @click="filters.reset()">
      清空筛选
    </el-button>

    <slot />
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  padding: 14px 20px;
  margin-bottom: 18px;
}

.group {
  display: flex;
  align-items: center;
  gap: 9px;
}

.group label {
  font-size: 12px;
  white-space: nowrap;
}

.opt-path {
  float: right;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 16px;
  color: var(--cb-text-soft);
  font-size: 11px;
}
</style>
