<script setup lang="ts">
import Icon from './Icon.vue'

const props = defineProps<{ modelValue: { startDate: string | null; endDate: string | null } }>()
const emit = defineEmits<{
  'update:modelValue': [value: { startDate: string | null; endDate: string | null }]
}>()

const inputStyle = {
  background: 'var(--cb-input-bg)',
  borderColor: 'var(--cb-input-border)',
  color: 'var(--cb-fg)',
}

function update(which: 'startDate' | 'endDate', value: string): void {
  emit('update:modelValue', { ...props.modelValue, [which]: value || null })
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <input
      type="date"
      :value="modelValue.startDate ?? ''"
      class="h-[26px] rounded border px-1.5 text-[11.5px] outline-none"
      :style="inputStyle"
      aria-label="开始日期"
      @change="update('startDate', ($event.target as HTMLInputElement).value)"
    />
    <Icon name="arrow-right" :size="12" />
    <input
      type="date"
      :value="modelValue.endDate ?? ''"
      class="h-[26px] rounded border px-1.5 text-[11.5px] outline-none"
      :style="inputStyle"
      aria-label="结束日期"
      @change="update('endDate', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
