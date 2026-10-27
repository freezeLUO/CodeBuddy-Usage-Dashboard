<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from './Icon.vue'

export interface MultiSelectOption {
  value: string
  label: string
  hint?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: MultiSelectOption[]
    placeholder?: string
    width?: string
  }>(),
  { placeholder: '全部', width: '220px' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return props.options
  return props.options.filter(
    (option) =>
      option.label.toLowerCase().includes(keyword) || option.value.toLowerCase().includes(keyword),
  )
})

const summary = computed(() => {
  if (!props.modelValue.length) return props.placeholder
  if (props.modelValue.length === 1) {
    const match = props.options.find((option) => option.value === props.modelValue[0])
    return match?.label ?? props.modelValue[0]
  }
  return `已选 ${props.modelValue.length} 项`
})

function toggle(value: string): void {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter((item) => item !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

function clear(): void {
  emit('update:modelValue', [])
}

function onDocumentClick(event: MouseEvent): void {
  if (!root.value) return
  if (!root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <div ref="root" class="relative" :style="{ width }">
    <button
      type="button"
      class="flex h-[26px] w-full items-center justify-between gap-1 rounded border px-2 text-[11.5px] transition-colors"
      :style="{
        background: 'var(--cb-input-bg)',
        borderColor: 'var(--cb-input-border)',
        color: modelValue.length ? 'var(--cb-fg)' : 'var(--cb-fg-soft)',
      }"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="truncate">{{ summary }}</span>
      <Icon name="chevron-down" :size="12" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 top-[30px] z-30 w-full min-w-[220px] rounded-md p-1.5 shadow-lg"
      :style="{
        background: 'var(--cb-bg-elevated)',
        border: '1px solid var(--cb-border)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.32)',
      }"
    >
      <div
        class="mb-1 flex h-[24px] items-center gap-1 rounded px-1.5"
        :style="{ background: 'var(--cb-input-bg)' }"
      >
        <Icon name="search" :size="12" />
        <input
          v-model="query"
          type="text"
          placeholder="搜索"
          class="w-full bg-transparent text-[11.5px] outline-none"
          :style="{ color: 'var(--cb-fg)' }"
        />
      </div>

      <div class="max-h-[220px] overflow-y-auto">
        <button
          v-for="option in filtered"
          :key="option.value"
          type="button"
          class="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11.5px] hover:opacity-100"
          :style="{ background: modelValue.includes(option.value) ? 'var(--cb-card-hover)' : 'transparent' }"
          @click="toggle(option.value)"
        >
          <span
            class="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border"
            :style="{
              borderColor: modelValue.includes(option.value) ? 'var(--cb-accent)' : 'var(--cb-input-border)',
              background: modelValue.includes(option.value) ? 'var(--cb-accent)' : 'transparent',
              color: 'var(--cb-accent-fg)',
            }"
          >
            <Icon v-if="modelValue.includes(option.value)" name="check" :size="9" :stroke-width="3" />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span v-if="option.hint" class="max-w-[110px] truncate text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
            {{ option.hint }}
          </span>
        </button>
        <p v-if="!filtered.length" class="px-2 py-3 text-center text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
          没有匹配项
        </p>
      </div>

      <div v-if="modelValue.length" class="mt-1 flex justify-end border-t pt-1" :style="{ borderColor: 'var(--cb-border-soft)' }">
        <button type="button" class="text-[11px] hover:underline" :style="{ color: 'var(--cb-accent-soft)' }" @click="clear">
          清空
        </button>
      </div>
    </div>
  </div>
</template>
