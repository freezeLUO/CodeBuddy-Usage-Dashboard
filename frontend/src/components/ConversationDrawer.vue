<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useConversationsStore } from '@/stores/conversations'
import {
  formatTokens,
  formatCredit,
  formatPercent,
  formatDuration,
  formatDateTime,
} from '@/utils/format'

const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ closed: [] }>()

const conversations = useConversationsStore()
const { detail, detailLoading } = storeToRefs(conversations)

function onClosed() {
  emit('closed')
}
</script>

<template>
  <el-drawer
    v-model="visible"
    size="920px"
    direction="rtl"
    :destroy-on-close="true"
    @closed="onClosed"
  >
    <template #header>
      <div class="drawer-title">
        <span class="title">{{ detail?.title || '会话详情' }}</span>
        <span v-if="detail" class="mono muted">{{ detail.conversation_id }}</span>
      </div>
    </template>

    <div v-loading="detailLoading" class="drawer-body">
      <template v-if="detail">
        <div class="summary">
          <div class="cell">
            <div class="muted label">项目</div>
            <div class="strong">{{ detail.display_name }}</div>
            <div class="muted path">{{ detail.path || '—' }}</div>
          </div>
          <div class="cell">
            <div class="muted label">时间</div>
            <div class="strong mono">{{ formatDateTime(detail.started_at_ms) }}</div>
            <div class="muted path">至 {{ formatDateTime(detail.ended_at_ms) }}</div>
          </div>
          <div class="cell">
            <div class="muted label">Token</div>
            <div class="strong mono">{{ formatTokens(detail.total_tokens) }}</div>
            <div class="muted path">{{ detail.request_count }} 次请求 · {{ detail.message_count }} 条消息</div>
          </div>
          <div class="cell">
            <div class="muted label">积分</div>
            <div class="strong mono credit">{{ formatCredit(detail.credit) }}</div>
            <div class="muted path">
              平均 {{ detail.request_count ? (detail.credit / detail.request_count).toFixed(2) : '0' }} / 次
            </div>
          </div>
        </div>

        <div class="section-title">请求明细</div>

        <el-table :data="detail.requests" stripe size="small" max-height="calc(100vh - 340px)">
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              <span class="mono">{{ formatDateTime(row.started_at_ms) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="模型" width="170">
            <template #default="{ row }">
              <el-tag size="small" effect="plain" type="info">
                {{ row.model_name || row.model_id || '—' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="输入" width="110" align="right">
            <template #default="{ row }">
              <span class="mono">{{ formatTokens(row.input_tokens) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="输出" width="100" align="right">
            <template #default="{ row }">
              <span class="mono">{{ formatTokens(row.output_tokens) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="缓存命中" width="100" align="right">
            <template #default="{ row }">
              <span class="mono">{{ formatPercent(row.cache_hit_ratio) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="峰值上下文" width="120" align="right">
            <template #default="{ row }">
              <span class="mono muted">{{ formatTokens(row.last_tokens) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="思考" width="100" align="right">
            <template #default="{ row }">
              <span class="mono muted">{{ row.thinking_tokens ? formatTokens(row.thinking_tokens) : '—' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="耗时" width="110" align="right">
            <template #default="{ row }">
              <span class="mono muted">{{ formatDuration(row.elapsed_ms) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="积分" width="90" align="right">
            <template #default="{ row }">
              <span class="mono credit">{{ formatCredit(row.credit) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-title .title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.drawer-title .mono {
  font-size: 11px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding: 16px 18px;
  background: #fafbfc;
  border: 1px solid var(--cb-border);
  border-radius: 12px;
  margin-bottom: 18px;
}

.cell .label {
  font-size: 11px;
  margin-bottom: 6px;
}

.cell .strong {
  font-size: 15px;
  font-weight: 620;
}

.cell .path {
  font-size: 11px;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credit {
  color: #d96a8a;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}
</style>
