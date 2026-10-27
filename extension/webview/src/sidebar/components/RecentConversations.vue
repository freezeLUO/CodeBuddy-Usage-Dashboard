<script setup lang="ts">
import type { ConversationRow } from '../../shared/types'
import { formatCredit, formatTokens, relativeTime } from '../../shared/format'
import Icon from '../../shared/components/Icon.vue'

defineProps<{ items: ConversationRow[] }>()
const emit = defineEmits<{ open: [conversationId: string] }>()
</script>

<template>
  <ul v-if="items.length" class="flex flex-col gap-0.5">
    <li v-for="item in items" :key="item.conversation_id">
      <button
        type="button"
        class="group flex w-full items-center gap-2 rounded px-1.5 py-[5px] text-left transition-colors"
        :style="{ color: 'var(--cb-fg)' }"
        :title="item.title || item.conversation_id"
        @click="emit('open', item.conversation_id)"
        @mouseenter="($event.currentTarget as HTMLElement).style.background = 'var(--cb-card-hover)'"
        @mouseleave="($event.currentTarget as HTMLElement).style.background = 'transparent'"
      >
        <Icon name="message" :size="12" class="mt-[1px] opacity-60" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[11.5px]">{{ item.title || item.conversation_id.slice(0, 8) }}</span>
          <span class="mt-0.5 block truncate text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
            {{ item.display_name }} · {{ relativeTime(item.ended_at_ms) }}
          </span>
        </span>
        <span class="cb-num shrink-0 text-right text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
          <span class="block">{{ formatTokens(item.total_tokens) }}</span>
          <span class="block" :style="{ color: 'var(--cb-credit)' }">{{ formatCredit(item.credit) }}</span>
        </span>
      </button>
    </li>
  </ul>
  <p v-else class="py-3 text-center text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">暂无会话</p>
</template>
