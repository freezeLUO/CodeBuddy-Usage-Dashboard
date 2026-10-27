<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    accent?: string
    dense?: boolean
  }>(),
  { hint: '', accent: 'var(--cb-accent-soft)', dense: false },
)
</script>

<template>
  <div
    class="cb-card relative flex min-w-0 gap-2.5 overflow-hidden"
    :class="dense ? 'px-2.5 py-2' : 'px-3.5 py-3'"
  >
    <span class="w-[2px] shrink-0 rounded-full" :style="{ background: accent }" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">{{ label }}</p>
      <p
        class="cb-num truncate font-semibold leading-tight tracking-tight"
        :class="dense ? 'mt-0.5 text-[16px]' : 'mt-1 text-[21px]'"
      >
        {{ value }}
      </p>
      <p v-if="hint" class="mt-1 truncate text-[10.5px]" :title="hint" :style="{ color: 'var(--cb-fg-soft)' }">
        {{ hint }}
      </p>
    </div>
  </div>
</template>
