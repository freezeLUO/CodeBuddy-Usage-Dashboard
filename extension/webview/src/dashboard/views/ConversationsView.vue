<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ConversationDetail, ConversationList, FiltersState } from '../../shared/types'
import { request } from '../../shared/rpc'
import ConversationTable from '../components/ConversationTable.vue'
import ConversationDrawer from '../components/ConversationDrawer.vue'
import Pagination from '../../shared/components/Pagination.vue'
import Icon from '../../shared/components/Icon.vue'

const props = defineProps<{
  filters: FiltersState
  refreshToken: number
  focus: { id: string; nonce: number } | null
}>()

const page = ref(1)
const size = ref(20)
const keyword = ref('')
const appliedKeyword = ref('')
const list = ref<ConversationList>({ total: 0, page: 1, size: 20, items: [] })
const loading = ref(false)
const error = ref<string | null>(null)

const drawerOpen = ref(false)
const detail = ref<ConversationDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

let searchTimer: number | undefined

const payload = (): Record<string, unknown> => ({
  filters: {
    startDate: props.filters.startDate,
    endDate: props.filters.endDate,
    workspaces: props.filters.workspaces,
    models: props.filters.models,
  },
  page: page.value,
  size: size.value,
  q: appliedKeyword.value,
  sort: 'ended_at_ms',
  order: 'desc',
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    list.value = await request<ConversationList>('conversations', payload())
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    loading.value = false
  }
}

async function openDetail(conversationId: string): Promise<void> {
  drawerOpen.value = true
  detailLoading.value = true
  detailError.value = null
  detail.value = null
  try {
    detail.value = await request<ConversationDetail>('conversationDetail', {
      filters: payload().filters,
      conversationId,
    })
  } catch (failure) {
    detailError.value = (failure as Error).message
  } finally {
    detailLoading.value = false
  }
}

function onSearchInput(event: Event): void {
  keyword.value = (event.target as HTMLInputElement).value
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    appliedKeyword.value = keyword.value.trim()
    page.value = 1
  }, 260)
}

watch(
  () => props.filters,
  () => {
    page.value = 1
    void load()
  },
  { deep: true },
)

watch(page, () => void load())
watch(appliedKeyword, () => void load())
watch(
  () => props.refreshToken,
  () => void load(),
)
watch(
  () => props.focus?.nonce,
  () => {
    if (!props.focus) return
    page.value = 1
    void load()
    void openDetail(props.focus.id)
  },
)

onMounted(() => {
  void load()
  if (props.focus) void openDetail(props.focus.id)
})

onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
  <div class="flex flex-col gap-3 px-4 py-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <label
        class="flex h-[26px] w-[300px] items-center gap-1.5 rounded border px-2"
        :style="{ background: 'var(--cb-input-bg)', borderColor: 'var(--cb-input-border)' }"
      >
        <Icon name="search" :size="12" />
        <input
          :value="keyword"
          type="text"
          placeholder="搜索会话标题或会话 ID"
          class="w-full bg-transparent text-[11.5px] outline-none"
          @input="onSearchInput"
        />
        <button
          v-if="keyword"
          type="button"
          aria-label="清空搜索"
          @click="keyword = ''; appliedKeyword = ''; page = 1"
        >
          <Icon name="close" :size="11" />
        </button>
      </label>

      <p class="text-[11px]" :style="{ color: 'var(--cb-fg-soft)' }">
        {{ loading ? '加载中…' : `匹配 ${list.total.toLocaleString('zh-CN')} 个会话` }}
      </p>
    </div>

    <p v-if="error" class="text-[11px]" :style="{ color: 'var(--cb-error)' }">{{ error }}</p>

    <div class="cb-card overflow-hidden">
      <ConversationTable :items="list.items" @open="openDetail" />
      <div class="px-3 py-2" :style="{ borderTop: '1px solid var(--cb-border-soft)' }">
        <Pagination :page="list.page" :size="size" :total="list.total" @change="(value) => (page = value)" />
      </div>
    </div>

    <ConversationDrawer v-model="drawerOpen" :detail="detail" :loading="detailLoading" />

    <p v-if="detailError" class="text-[11px]" :style="{ color: 'var(--cb-error)' }">{{ detailError }}</p>
  </div>
</template>
