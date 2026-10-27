<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SidebarPayload } from '../shared/types'
import {
  getState,
  notifyReady,
  on,
  openDashboard,
  openSettings,
  request,
  requestRefresh,
  setState,
} from '../shared/rpc'
import { SIDEBAR_RANGES, rangeForPreset } from '../shared/presets'
import { formatClock, formatCredit } from '../shared/format'
import SegmentedControl from '../shared/components/SegmentedControl.vue'
import Sparkline from '../shared/components/Sparkline.vue'
import EmptyState from '../shared/components/EmptyState.vue'
import Icon from '../shared/components/Icon.vue'
import KpiGrid from './components/KpiGrid.vue'
import TopProjects from './components/TopProjects.vue'
import TopModels from './components/TopModels.vue'
import RecentConversations from './components/RecentConversations.vue'

const restored = getState<{ preset?: string }>()
const preset = ref(
  restored?.preset && SIDEBAR_RANGES.some((option) => option.value === restored.preset)
    ? restored.preset
    : '30d',
)
const data = ref<SidebarPayload | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const error = ref<string | null>(null)
const progress = ref({ done: 0, total: 0 })

const filters = computed(() => ({
  ...rangeForPreset(preset.value, SIDEBAR_RANGES),
  workspaces: [] as string[],
  models: [] as string[],
}))

const meta = computed(() => data.value?.meta ?? null)
const state = computed(() => {
  if (!data.value) return 'loading'
  if (!data.value.meta.data_root_exists) return 'no-root'
  if (!data.value.meta.request_count) return 'empty'
  return 'ready'
})

const progressPercent = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)

async function load(silent = false): Promise<void> {
  if (!silent) loading.value = true
  error.value = null
  try {
    data.value = await request<SidebarPayload>('sidebar', { filters: filters.value })
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
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    refreshing.value = false
    progress.value = { done: 0, total: 0 }
  }
}

const offHandlers: Array<() => void> = []

onMounted(async () => {
  notifyReady()
  offHandlers.push(
    on('refreshed', () => {
      progress.value = { done: 0, total: 0 }
      void load(true)
    }),
    on('visible', () => void load(true)),
    on('progress', (value) => {
      progress.value = (value as { done: number; total: number }) ?? { done: 0, total: 0 }
    }),
  )
  await load()
})

onBeforeUnmount(() => {
  for (const off of offHandlers) off()
})

watch(preset, (value) => {
  setState({ preset: value })
  void load()
})
</script>

<template>
  <div class="flex h-screen flex-col" :style="{ background: 'var(--cb-bg)' }">
    <div v-if="progress.total" class="h-[2px] w-full shrink-0" :style="{ background: 'var(--cb-border-soft)' }">
      <div
        class="h-full transition-all duration-200"
        :style="{ width: `${progressPercent}%`, background: 'var(--cb-accent-soft)' }"
      />
    </div>

    <header class="shrink-0 px-3 pb-2 pt-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h1 class="text-[13px] font-semibold tracking-tight">CodeBuddy 用量</h1>
          <p class="mt-0.5 flex items-center gap-1 text-[10.5px]" :style="{ color: 'var(--cb-fg-soft)' }">
            <Icon name="clock" :size="10" />
            上次同步 {{ formatClock(meta?.last_refresh_ms) }}
          </p>
        </div>
        <div class="flex items-center gap-0.5">
          <button
            type="button"
            class="cb-btn h-[24px] w-[24px] px-0"
            :title="refreshing ? '正在刷新…' : '刷新数据'"
            :disabled="refreshing"
            @click="refresh"
          >
            <Icon name="refresh" :size="13" :class="refreshing ? 'animate-spin' : ''" />
          </button>
          <button type="button" class="cb-btn h-[24px] w-[24px] px-0" title="设置数据目录" @click="openSettings()">
            <Icon name="settings" :size="13" />
          </button>
        </div>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
      <SegmentedControl v-model="preset" :options="SIDEBAR_RANGES" compact />

      <div
        v-if="error"
        class="flex items-start gap-2 rounded px-2.5 py-2 text-[11px]"
        :style="{ background: 'var(--cb-card)', border: '1px solid var(--cb-border)', color: 'var(--cb-error)' }"
      >
        <Icon name="alert" :size="12" class="mt-[1px]" />
        <span class="min-w-0 flex-1 break-words">{{ error }}</span>
        <button type="button" class="shrink-0 underline" @click="load()">重试</button>
      </div>

      <div v-if="state === 'loading'" class="flex flex-1 items-center justify-center py-10 text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
        正在读取本地用量数据…
      </div>

      <EmptyState
        v-else-if="state === 'no-root'"
        icon="folder"
        title="未找到 CodeBuddy 数据目录"
        :description="`默认路径：${meta?.data_root ?? ''}。可以手动指定数据目录后重新加载。`"
        tone="error"
      >
        <button type="button" class="cb-btn cb-btn--ghost" @click="openSettings()">打开设置</button>
        <button type="button" class="cb-btn cb-btn--primary" @click="refresh">重新检查</button>
      </EmptyState>

      <EmptyState
        v-else-if="state === 'empty'"
        icon="database"
        title="还没有解析到用量数据"
        description="请确认 CodeBuddy 已经产生过会话，然后点击刷新重新扫描本地磁盘。"
      >
        <button type="button" class="cb-btn cb-btn--primary" @click="refresh">立即刷新</button>
      </EmptyState>

      <template v-else-if="data">
        <KpiGrid :overview="data.overview" />

        <section class="cb-card px-2.5 py-2">
          <div class="mb-1 flex items-center justify-between">
            <span class="cb-title">每日趋势</span>
            <span class="flex items-center gap-2 text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
              <span class="flex items-center gap-1">
                <span class="inline-block h-[6px] w-[6px] rounded-full" :style="{ background: 'var(--cb-token-in)' }"></span>
                Token
              </span>
              <span class="flex items-center gap-1">
                <span class="h-[6px] w-[6px] rounded-full" style="background: var(--cb-credit)"></span> 积分
              </span>
            </span>
          </div>
          <Sparkline :items="data.timeseries" />
        </section>

        <section>
          <div class="mb-1.5 flex items-center justify-between">
            <span class="cb-title">项目消耗 Top 5</span>
            <span class="text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
              共 {{ data.overview.workspace_count }} 个项目
            </span>
          </div>
          <TopProjects :items="data.projects" />
        </section>

        <section>
          <div class="mb-1.5 flex items-center justify-between">
            <span class="cb-title">模型用量 Top 5</span>
            <span class="text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">按 Token 占比</span>
          </div>
          <TopModels :items="data.models" />
        </section>

        <section>
          <div class="mb-1 flex items-center justify-between">
            <span class="cb-title">最近会话</span>
            <span class="text-[10px]" :style="{ color: 'var(--cb-fg-soft)' }">
              {{ formatCredit(data.overview.total_credit) }} 积分
            </span>
          </div>
          <RecentConversations :items="data.recent" @open="(id) => openDashboard(id)" />
        </section>
      </template>
    </div>

    <footer class="shrink-0 px-3 py-2" :style="{ borderTop: '1px solid var(--cb-border-soft)' }">
      <button type="button" class="cb-btn cb-btn--primary w-full" @click="openDashboard()">
        <Icon name="chart" :size="13" />
        打开完整看板
      </button>
    </footer>
  </div>
</template>
