<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConversationsStore } from '@/stores/conversations'
import { useFiltersStore } from '@/stores/filters'
import { useDashboardStore } from '@/stores/dashboard'
import { formatTokens, formatCredit, formatDateTime } from '@/utils/format'
import type { ConversationListItem } from '@/api/types'
import FilterBar from '@/components/FilterBar.vue'
import ConversationDrawer from '@/components/ConversationDrawer.vue'

const conversations = useConversationsStore()
const filters = useFiltersStore()
const dashboard = useDashboardStore()
const { items, total, page, size, loading } = storeToRefs(conversations)

const keyword = ref('')
const drawerVisible = ref(false)
let timer: number | undefined

onMounted(() => {
  dashboard.loadOptions()
  conversations.fetch()
})

watch(
  () => filters.params,
  () => {
    page.value = 1
    conversations.fetch()
  },
  { deep: true },
)

watch(page, () => conversations.fetch())

watch(keyword, (value) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    conversations.keyword = value.trim()
    page.value = 1
    conversations.fetch()
  }, 300)
})

const sortOptions = [
  { label: '结束时间', value: 'ended_at_ms' },
  { label: '开始时间', value: 'started_at_ms' },
  { label: 'Token 用量', value: 'total_tokens' },
  { label: '积分', value: 'credit' },
]

const currentSort = computed({
  get: () => conversations.sort,
  set: (value: string) => {
    conversations.sort = value
    conversations.fetch()
  },
})

function rowClass() {
  return 'clickable'
}

async function openDetail(row: ConversationListItem) {
  drawerVisible.value = true
  await conversations.openDetail(row.conversation_id)
}

function onDrawerClosed() {
  conversations.closeDetail()
}
</script>

<template>
  <div>
    <FilterBar />

    <div class="toolbar card">
      <el-input
        v-model="keyword"
        placeholder="搜索会话标题或会话 ID"
        clearable
        style="width: 320px"
      />
      <div class="spacer" />
      <span class="muted total">共 {{ total }} 个会话</span>
      <el-select v-model="currentSort" style="width: 140px">
        <el-option v-for="opt in sortOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
    </div>

    <div class="card table-card">
      <el-table
        v-loading="loading"
        :data="items"
        :row-class-name="rowClass"
        stripe
        height="calc(100vh - 330px)"
        @row-click="openDetail"
      >
        <el-table-column label="会话标题" min-width="360">
          <template #default="{ row }">
            <div class="title-cell">
              <span class="title">{{ row.title || `（无标题）${row.conversation_id.slice(0, 8)}` }}</span>
              <span class="cid mono muted">{{ row.conversation_id.slice(0, 8) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="项目" width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.path || row.display_name" placement="top">
              <span>{{ row.display_name }}</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="开始时间" width="150">
          <template #default="{ row }">
            <span class="mono">{{ formatDateTime(row.started_at_ms) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="请求" width="80" align="right">
          <template #default="{ row }">{{ row.request_count }}</template>
        </el-table-column>

        <el-table-column label="Token" width="140" align="right">
          <template #default="{ row }">
            <span class="mono">{{ formatTokens(row.total_tokens) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="积分" width="110" align="right">
          <template #default="{ row }">
            <span class="mono credit">{{ formatCredit(row.credit) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="模型" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="model in row.models"
              :key="model"
              size="small"
              type="info"
              effect="plain"
              class="tag"
            >
              {{ model }}
            </el-tag>
          </template>
        </el-table-column>

        <template #empty>
          <div class="muted" style="padding: 40px">没有匹配的会话</div>
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="size"
          :total="total"
          layout="prev, pager, next, jumper"
          background
        />
      </div>
    </div>

    <ConversationDrawer v-model="drawerVisible" @closed="onDrawerClosed" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  margin-bottom: 16px;
}

.spacer {
  flex: 1;
}

.total {
  font-size: 12px;
}

.table-card {
  padding: 6px 6px 0;
}

.title-cell {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cid {
  font-size: 11px;
  flex: none;
}

.credit {
  color: #d96a8a;
}

.tag {
  margin: 2px 4px 2px 0;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 10px;
}

:deep(.clickable) {
  cursor: pointer;
}
</style>
