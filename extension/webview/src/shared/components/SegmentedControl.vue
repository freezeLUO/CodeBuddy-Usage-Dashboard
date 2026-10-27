<script setup lang="ts" generic="T extends string">
interface Option {
  value: T
  label: string
}

withDefaults(defineProps<{ modelValue: T | ''; options: Option[]; compact?: boolean }>(), {
  compact: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div
    role="tablist"
    class="flex items-center gap-0.5 rounded-md p-0.5"
    :style="{ background: 'var(--cb-input-bg)', border: '1px solid var(--cb-border-soft)' }"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      :aria-selected="option.value === modelValue"
      class="flex-1 rounded-[3px] transition-colors duration-150 whitespace-nowrap"
      :class="compact ? 'h-[20px] px-1.5 text-[11px]' : 'h-[24px] px-2.5 text-[11.5px]'"
      :style="
        option.value === modelValue
          ? {
              background: 'var(--vscode-list-activeSelectionBackground, rgba(0,122,204,0.24))',
              color: 'var(--vscode-list-activeSelectionForeground, var(--cb-fg))',
              fontWeight: 600,
            }
          : { color: 'var(--cb-fg-soft)' }
      "
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
