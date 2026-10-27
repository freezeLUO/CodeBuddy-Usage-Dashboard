<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ modelValue: boolean; title?: string; subtitle?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function close(): void {
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="cb-drawer">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0" :style="{ background: 'rgba(0,0,0,0.38)' }" @click="close" />
        <aside
          class="relative flex h-full w-full max-w-[920px] flex-col shadow-2xl"
          :style="{ background: 'var(--cb-bg)', borderLeft: '1px solid var(--cb-border)' }"
          role="dialog"
          aria-modal="true"
        >
          <header
            class="flex items-start justify-between gap-3 px-4 py-3"
            :style="{ borderBottom: '1px solid var(--cb-border-soft)' }"
          >
            <div class="min-w-0">
              <p class="cb-title truncate">{{ title || '详情' }}</p>
              <p v-if="subtitle" class="cb-mono mt-0.5 truncate text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">
                {{ subtitle }}
              </p>
            </div>
            <button type="button" class="cb-btn h-[24px] w-[24px] px-0" aria-label="关闭" @click="close">
              <Icon name="close" :size="13" />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <slot />
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cb-drawer-enter-active,
.cb-drawer-leave-active {
  transition: opacity 180ms ease;
}

.cb-drawer-enter-active aside,
.cb-drawer-leave-active aside {
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.cb-drawer-enter-from,
.cb-drawer-leave-to {
  opacity: 0;
}

.cb-drawer-enter-from aside,
.cb-drawer-leave-to aside {
  transform: translateX(24px);
}
</style>
