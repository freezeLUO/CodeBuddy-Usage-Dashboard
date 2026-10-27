<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore, type RangePreset } from '@/stores/filters'
import { useDashboardStore } from '@/stores/dashboard'

const filters = useFiltersStore()
const dashboard = useDashboardStore()
const { allProjects, allModels } = storeToRefs(dashboard)

// value-format 为 YYYY-MM-DD，所以模型值直接用字符串，快捷范围写入后才能回显
const range = computed<[string, string] | null>({
  get: () => {
    const [start, end] = filters.range
    return start && end ? ([start, end] as [string, string]) : null
  },
  set: (value) => {
    filters.range = value && value[0] && value[1] ? [value[0], value[1]] : [null, null]
    // 用户手动改日期后，快捷范围回到未选中态
    filters.preset = ''
  },
})

const preset = computed<RangePreset | ''>({
  get: () => filters.preset,
  set: (value) => filters.applyPreset(value ?? ''),
})

const hasFilter = computed(() => filters.active)
</script>

<template>
  <div class="filter-bar card">
    <div class="group group--stacked">
      <label class="muted">时间范围</label>
      <div class="controls">
        <el-select
          v-model="preset"
          placeholder="快捷选择"
          clearable
          value-on-clear=""
          style="width: 116px"
        >
          <el-option label="近三天" value="3d" />
          <el-option label="一周" value="1w" />
          <el-option label="一个月" value="1m" />
          <el-option label="一年" value="1y" />
          <el-option label="全部" value="all" />
        </el-select>
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

.group--stacked {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.group--stacked .controls {
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
