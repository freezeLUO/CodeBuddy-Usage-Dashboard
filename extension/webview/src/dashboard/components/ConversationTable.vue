<script setup lang="ts">
import type { ConversationRow } from '../../shared/types'
import { formatCredit, formatDateTime, formatTokens } from '../../shared/format'

defineProps<{ items: ConversationRow[] }>()
const emit = defineEmits<{ open: [conversationId: string] }>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[760px] border-collapse text-[11.5px]">
      <thead>
        <tr
          class="text-left"
          :style="{ color: 'var(--cb-fg-soft)', borderBottom: '1px solid var(--cb-border-soft)' }"
        >
          <th class="px-2 py-1.5 font-medium">会话</th>
          <th class="px-2 py-1.5 font-medium">项目</th>
          <th class="px-2 py-1.5 text-right font-medium">请求</th>
          <th class="px-2 py-1.5 text-right font-medium">Token</th>
          <th class="px-2 py-1.5 text-right font-medium">积分</th>
          <th class="px-2 py-1.5 font-medium">模型</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.conversation_id"
          class="cursor-pointer border-b transition-colors hover:bg-[var(--cb-card-hover)]"
          :style="{ borderColor: 'var(--cb-border-soft)' }"
          @click="emit('open', item.conversation_id)"
        >
          <td class="max-w-[420px] px-2 py-1.5">
            <p class="truncate" :title="item.title || item.conversation_id">
              {{ item.title || item.conversation_id.slice(0, 8) }}
            </p>
            <p class="mt-0.5 text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
              {{ formatDateTime(item.ended_at_ms) }}
            </p>
          </td>
          <td class="max-w-[160px] px-2 py-1.5">
            <span class="block truncate" :title="item.path || item.display_name">{{ item.display_name }}</span>
          </td>
          <td class="cb-num px-2 py-1.5 text-right">{{ item.request_count }}</td>
          <td class="cb-num px-2 py-1.5 text-right">{{ formatTokens(item.total_tokens) }}</td>
          <td class="cb-num px-2 py-1.5 text-right" :style="{ color: 'var(--cb-credit)' }">
            {{ formatCredit(item.credit) }}
          </td>
          <td class="px-2 py-1.5">
            <div class="flex flex-wrap gap-1">
              <span
                v-for="model in item.models.slice(0, 2)"
                :key="model"
                class="rounded px-1.5 py-[1px] text-[10px]"
                :style="{ background: 'var(--cb-badge)', color: 'var(--cb-badge-fg)' }"
              >
                {{ model }}
              </span>
              <span v-if="item.models.length > 2" class="text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
                +{{ item.models.length - 2 }}
              </span>
            </div>
          </td>
        </tr>
        <tr v-if="!items.length">
          <td colspan="6" class="px-2 py-10 text-center" :style="{ color: 'var(--cb-fg-soft)' }">
            当前筛选条件下没有会话
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
