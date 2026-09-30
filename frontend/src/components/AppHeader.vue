<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useDashboardStore } from '@/stores/dashboard'
import { formatDateTime } from '@/utils/format'

const dashboard = useDashboardStore()
const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

const lastRefresh = computed(() =>
  formatDateTime(dashboard.meta?.last_refresh_ms ?? null),
)

async function onRefresh() {
  const result = await dashboard.refresh()
  ElMessage.success(
    `已同步：更新 ${result.updated} 个会话，删除 ${result.deleted} 个，耗时 ${result.duration_ms} ms`,
  )
}
</script>

<template>
  <header class="header" :class="{ collapsed }">
    <div class="brand">
      <div class="logo">CB</div>
      <div class="titles">
        <h1>CodeBuddy 用量看板</h1>
        <span class="sub muted">
          {{ collapsed ? '' : '本地 CodeBuddy 会话与 Token 消耗统计' }}
        </span>
      </div>
    </div>

    <nav class="nav">
      <button
        class="nav-item"
        :class="{ active: route.name === 'dashboard' }"
        @click="router.push('/')"
      >
        用量看板
      </button>
      <button
        class="nav-item"
        :class="{ active: route.name === 'conversations' }"
        @click="router.push('/conversations')"
      >
        会话明细
      </button>
    </nav>

    <div class="actions">
      <span class="sync muted">上次同步：{{ lastRefresh }}</span>
      <el-button type="primary" :loading="dashboard.refreshing" @click="onRefresh">
        刷新数据
      </el-button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 28px;
  padding: 16px 28px;
  margin-bottom: 20px;
  background: var(--cb-card);
  border-bottom: 1px solid var(--cb-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.logo {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #6f6fe8, #4a4ab8);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  display: grid;
  place-items: center;
  letter-spacing: 0.5px;
}

.titles h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: 0.2px;
}

.titles .sub {
  font-size: 12px;
}

.nav {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.nav-item {
  border: 0;
  background: transparent;
  padding: 7px 14px;
  border-radius: 9px;
  font-size: 13px;
  color: var(--cb-text-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: #f2f3f6;
  color: var(--cb-text);
}

.nav-item.active {
  background: var(--cb-accent-soft);
  color: var(--cb-accent);
  font-weight: 600;
}

.actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sync {
  font-size: 12px;
}
</style>
