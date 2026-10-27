<script setup lang="ts">
import { computed } from 'vue'
import type { FiltersState, OptionsPayload } from '../../shared/types'
import { DASHBOARD_RANGES, rangeForPreset } from '../../shared/presets'
import SegmentedControl from '../../shared/components/SegmentedControl.vue'
import MultiSelect from '../../shared/components/MultiSelect.vue'
import DateRangeInput from '../../shared/components/DateRangeInput.vue'
import Icon from '../../shared/components/Icon.vue'

const props = defineProps<{ modelValue: FiltersState; options: OptionsPayload | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: FiltersState] }>()

const presets = DASHBOARD_RANGES.map((item) => ({ value: item.value, label: item.label }))
const granularities = [
  { value: 'day' as const, label: '按天' },
  { value: 'week' as const, label: '按周' },
]

const projectOptions = computed(() =>
  (props.options?.projects ?? []).map((item) => ({
    value: item.workspace_hash,
    label: item.display_name,
    hint: item.path,
  })),
)

const modelOptions = computed(() =>
  (props.options?.models ?? []).map((item) => ({
    value: item.model_id,
    label: item.model_name || item.model_id,
    hint: `${item.requests} 次`,
  })),
)

const hasFilter = computed(
  () =>
    Boolean(props.modelValue.startDate || props.modelValue.endDate) ||
    props.modelValue.workspaces.length > 0 ||
    props.modelValue.models.length > 0,
)

function patch(partial: Partial<FiltersState>): void {
  emit('update:modelValue', { ...props.modelValue, ...partial })
}

function changePreset(preset: string): void {
  patch({ preset, ...rangeForPreset(preset, DASHBOARD_RANGES) })
}

function changeRange(range: { startDate: string | null; endDate: string | null }): void {
  patch({ ...range, preset: '' })
}

function reset(): void {
  patch({
    startDate: null,
    endDate: null,
    workspaces: [],
    models: [],
    preset: 'all',
  })
}
</script>

<template>
  <div
    class="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5"
    :style="{
      background: 'var(--cb-bg)',
      borderBottom: '1px solid var(--cb-border-soft)',
      backdropFilter: 'blur(8px)',
    }"
  >
    <div class="flex items-center gap-2">
      <span class="text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">时间范围</span>
      <div class="w-[248px]">
        <SegmentedControl :model-value="modelValue.preset" :options="presets" @update:model-value="changePreset" />
      </div>
    </div>

    <DateRangeInput
      :model-value="{ startDate: modelValue.startDate, endDate: modelValue.endDate }"
      @update:model-value="changeRange"
    />

    <div class="flex items-center gap-2">
      <span class="text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">项目</span>
      <MultiSelect
        :model-value="modelValue.workspaces"
        :options="projectOptions"
        placeholder="全部项目"
        width="190px"
        @update:model-value="(value) => patch({ workspaces: value })"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">模型</span>
      <MultiSelect
        :model-value="modelValue.models"
        :options="modelOptions"
        placeholder="全部模型"
        width="170px"
        @update:model-value="(value) => patch({ models: value })"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">粒度</span>
      <div class="w-[104px]">
        <SegmentedControl
          :model-value="modelValue.granularity"
          :options="granularities"
          @update:model-value="(value) => patch({ granularity: value })"
        />
      </div>
    </div>

    <button
      v-if="hasFilter"
      type="button"
      class="ml-auto flex items-center gap-1 text-[11px] hover:underline"
      :style="{ color: 'var(--cb-accent-soft)' }"
      @click="reset"
    >
      <Icon name="close" :size="11" />
      清空筛选
    </button>
  </div>
</template>
