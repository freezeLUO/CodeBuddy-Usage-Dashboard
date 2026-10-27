<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DashboardPayload, DashboardTab, FiltersState, OptionsPayload } from '../shared/types'
import {
  getState,
  notifyReady,
  on,
  openSettings,
  request,
  requestRefresh,
  setState,
} from '../shared/rpc'
import { formatClock, formatDate } from '../shared/format'
import Icon from '../shared/components/Icon.vue'
import FilterBar from './components/FilterBar.vue'
import OverviewView from './views/OverviewView.vue'
import ConversationsView from './views/ConversationsView.vue'

interface PersistedState {
  filters: FiltersState
  tab: DashboardTab
}

const DEFAULT_FILTERS: FiltersState = {
  startDate: null,
  endDate: null,
  workspaces: [],
  models: [],
  granularity: 'day',
  preset: 'all',
}

const restored = getState<PersistedState>()
const filters = ref<FiltersState>({ ...DEFAULT_FILTERS, ...(restored?.filters ?? {}) })
const tab = ref<DashboardTab>(restored?.tab === 'conversations' ? 'conversations' : 'overview')
const data = ref<DashboardPayload | null>(null)
const options = ref<OptionsPayload | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const error = ref<string | null>(null)
const progress = ref({ done: 0, total: 0 })
const refreshToken = ref(0)
const focus = ref<{ id: string; nonce: number } | null>(null)

const queryFilters = computed(() => ({
  startDate: filters.value.startDate,
  endDate: filters.value.endDate,
  workspaces: filters.value.workspaces,
  models: filters.value.models,
}))

const meta = computed(() => data.value?.meta ?? null)
const progressPercent = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)
const dataRange = computed(() => {
  const overview = data.value?.overview
  if (!overview?.date_min || !overview.date_max) return '暂无数据'
  return `${formatDate(overview.date_min)} → ${formatDate(overview.date_max)}`
})

async function loadOptions(): Promise<void> {
  try {
    options.value = await request<OptionsPayload>('options')
  } catch (failure) {
    error.value = (failure as Error).message
  }
}

async function loadData(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = null
  try {
    data.value = await request<DashboardPayload>('dashboard', {
      filters: queryFilters.value,
      granularity: filters.value.granularity,
    })
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  error.value = null
  try {
    await requestRefresh()
    await Promise.all([loadData(true), loadOptions()])
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    refreshing.value = false
    progress.value = { done: 0, total: 0 }
  }
}

let filterTimer: number | undefined
watch(
  filters,
  () => {
    setState({ filters: filters.value, tab: tab.value })
    window.clearTimeout(filterTimer)
    filterTimer = window.setTimeout(() => void loadData(), 120)
  },
  { deep: true },
)

watch(tab, () => setState({ filters: filters.value, tab: tab.value }))

const offHandlers: Array<() => void> = []

onMounted(async () => {
  notifyReady()
  offHandlers.push(
    on('refreshed', () => {
      progress.value = { done: 0, total: 0 }
      refreshToken.value += 1
      void loadData(true)
      void loadOptions()
    }),
    on('progress', (value) => {
      progress.value = (value as { done: number; total: number }) ?? { done: 0, total: 0 }
    }),
    on('navigate', (value) => {
      const conversationId = (value as { conversationId?: string } | undefined)?.conversationId
      if (!conversationId) return
      tab.value = 'conversations'
      focus.value = { id: conversationId, nonce: Date.now() }
    }),
  )
  await Promise.all([loadData(), loadOptions()])
})

onBeforeUnmount(() => {
  for (const off of offHandlers) off()
  window.clearTimeout(filterTimer)
})
</script>

<template>
  <div class="flex min-h-screen flex-col" :style="{ background: 'var(--cb-bg)' }">
    <div class="h-[2px] w-full shrink-0" :style="{ background: progress.total ? 'var(--cb-border-soft)' : 'transparent' }">
      <div
        class="h-full transition-all duration-200"
        :style="{ width: `${progressPercent}%`, background: 'var(--cb-accent-soft)' }"
      />
    </div>

    <header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <h1 class="text-[15px] font-semibold tracking-tight">CodeBuddy 用量看板</h1>
        <p class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
          <span>数据区间 {{ dataRange }}</span>
          <span class="flex items-center gap-1">
            <Icon name="clock" :size="10" />
            上次同步 {{ formatClock(meta?.last_refresh_ms) }}
          </span>
          <span v-if="meta" class="flex items-center gap-1">
            <Icon name="database" :size="10" />
            {{ meta.request_count }} 次请求 · {{ meta.conversation_count }} 个会话
          </span>
        </p>
      </div>

      <div class="flex items-center gap-1.5">
        <button type="button" class="cb-btn cb-btn--ghost" @click="openSettings()">
          <Icon name="settings" :size="12" />
          数据目录
        </button>
        <button type="button" class="cb-btn cb-btn--primary" :disabled="refreshing" @click="refresh">
          <Icon name="refresh" :size="12" :class="refreshing ? 'animate-spin' : ''" />
          {{ refreshing ? '刷新中…' : '刷新数据' }}
        </button>
      </div>
    </header>

    <nav class="flex items-center gap-4 px-4" :style="{ borderBottom: '1px solid var(--cb-border-soft)' }">
      <button
        v-for="item in [{ value: 'overview', label: '总览' }, { value: 'conversations', label: '会话明细' }]"
        :key="item.value"
        type="button"
        class="-mb-px border-b-2 pb-1.5 pt-1 text-[12px] transition-colors"
        :style="
          tab === item.value
            ? { borderColor: 'var(--cb-accent-soft)', color: 'var(--cb-fg)', fontWeight: 600 }
            : { borderColor: 'transparent', color: 'var(--cb-fg-soft)' }
        "
        @click="tab = item.value as DashboardTab"
      >
        {{ item.label }}
      </button>
      <span class="ml-auto pb-1.5 text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">
        本地解析 · 不联网 · 不上传
      </span>
    </nav>

    <FilterBar v-model="filters" :options="options" />

    <p
      v-if="error"
      class="mx-4 mt-3 flex items-start gap-2 rounded px-2.5 py-2 text-[11px]"
      :style="{ background: 'var(--cb-card)', border: '1px solid var(--cb-border)', color: 'var(--cb-error)' }"
    >
      <Icon name="alert" :size="12" class="mt-[1px]" />
      <span class="min-w-0 flex-1 break-words">{{ error }}</span>
      <button type="button" class="shrink-0 underline" @click="loadData()">重试</button>
    </p>

    <div class="min-h-0 flex-1">
      <div v-if="loading && !data" class="px-4 py-16 text-center text-[12px]" :style="{ color: 'var(--cb-fg-soft)' }">
        正在读取本地用量数据…
      </div>
      <OverviewView
        v-else-if="tab === 'overview'"
        :data="data"
        :loading="loading"
        @refresh="refresh"
        @open-settings="openSettings()"
      />
      <ConversationsView
        v-else
        :filters="filters"
        :refresh-token="refreshToken"
        :focus="focus"
      />
    </div>
  </div>
</template>
