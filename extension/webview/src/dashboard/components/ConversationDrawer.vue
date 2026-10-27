<script setup lang="ts">
import type { ConversationDetail } from '../../shared/types'
import Drawer from '../../shared/components/Drawer.vue'
import { formatCredit, formatDateTime, formatDuration, formatPercent, formatTokens } from '../../shared/format'

defineProps<{ modelValue: boolean; detail: ConversationDetail | null; loading: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const cell = 'px-2 py-1 text-[11px]'
const cellNum = 'px-2 py-1 text-right text-[11px] cb-num'
</script>

<template>
  <Drawer
    :model-value="modelValue"
    :title="detail?.title || '会话详情'"
    :subtitle="detail ? `${detail.conversation_id} · ${detail.display_name}` : ''"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <div v-if="loading" class="py-10 text-center text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
      正在加载请求明细…
    </div>

    <template v-else-if="detail">
      <div
        class="mb-3 grid gap-3 rounded-md px-3 py-2.5"
        :style="{
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          background: 'var(--cb-card)',
          border: '1px solid var(--cb-border-soft)',
        }"
      >
        <div class="min-w-0">
          <p class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">项目</p>
          <p class="mt-0.5 truncate text-[12.5px] font-medium">{{ detail.display_name }}</p>
          <p class="mt-0.5 truncate text-[10px]" :title="detail.path" :style="{ color: 'var(--cb-fg-soft)' }">
            {{ detail.path || '—' }}
          </p>
        </div>
        <div>
          <p class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">时间</p>
          <p class="cb-mono mt-0.5 text-[12px]">{{ formatDateTime(detail.started_at_ms) }}</p>
          <p class="mt-0.5 text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
            至 {{ formatDateTime(detail.ended_at_ms) }}
          </p>
        </div>
        <div>
          <p class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">Token</p>
          <p class="cb-num mt-0.5 text-[14px] font-semibold">{{ formatTokens(detail.total_tokens) }}</p>
          <p class="mt-0.5 text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
            {{ detail.request_count }} 次请求 · {{ detail.message_count }} 条消息
          </p>
        </div>
        <div>
          <p class="text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">积分</p>
          <p class="cb-num mt-0.5 text-[14px] font-semibold" :style="{ color: 'var(--cb-credit)' }">
            {{ formatCredit(detail.credit) }}
          </p>
          <p class="mt-0.5 text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
            平均 {{ detail.request_count ? formatCredit(detail.credit / detail.request_count) : '0.00' }} / 次
          </p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] border-collapse">
          <thead>
            <tr
              class="text-left"
              :style="{ color: 'var(--cb-fg-soft)', borderBottom: '1px solid var(--cb-border-soft)' }"
            >
              <th :class="cell" class="font-medium">时间</th>
              <th :class="cell" class="font-medium">模型</th>
              <th :class="cellNum" class="font-medium">输入</th>
              <th :class="cellNum" class="font-medium">输出</th>
              <th :class="cellNum" class="font-medium">缓存命中</th>
              <th :class="cellNum" class="font-medium">峰值上下文</th>
              <th :class="cellNum" class="font-medium">思考</th>
              <th :class="cellNum" class="font-medium">耗时</th>
              <th :class="cellNum" class="font-medium">积分</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in detail.requests"
              :key="row.request_id"
              class="border-b"
              :style="{ borderColor: 'var(--cb-border-soft)' }"
            >
              <td :class="cell" class="cb-mono whitespace-nowrap">{{ formatDateTime(row.started_at_ms) }}</td>
              <td :class="cell" class="max-w-[170px] truncate" :title="row.model_name || row.model_id || ''">
                {{ row.model_name || row.model_id || '—' }}
              </td>
              <td :class="cellNum">{{ formatTokens(row.input_tokens) }}</td>
              <td :class="cellNum">{{ formatTokens(row.output_tokens) }}</td>
              <td :class="cellNum">{{ formatPercent(row.cache_hit_ratio) }}</td>
              <td :class="cellNum" :style="{ color: 'var(--cb-fg-soft)' }">{{ formatTokens(row.last_tokens) }}</td>
              <td :class="cellNum" :style="{ color: 'var(--cb-fg-soft)' }">
                {{ row.thinking_tokens ? formatTokens(row.thinking_tokens) : '—' }}
              </td>
              <td :class="cellNum" :style="{ color: 'var(--cb-fg-soft)' }">{{ formatDuration(row.elapsed_ms) }}</td>
              <td :class="cellNum" :style="{ color: 'var(--cb-credit)' }">{{ formatCredit(row.credit) }}</td>
            </tr>
            <tr v-if="!detail.requests.length">
              <td colspan="9" class="py-8 text-center text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
                当前筛选条件下没有请求明细
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Drawer>
</template>
