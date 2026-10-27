<script setup lang="ts">
import { computed } from 'vue'
import type { BarListItem, ProjectRow } from '../../shared/types'
import BarList from '../../shared/components/BarList.vue'
import { formatCredit, formatTokens } from '../../shared/format'

const props = defineProps<{ items: ProjectRow[] }>()

const rows = computed<BarListItem[]>(() => {
  const max = Math.max(1, ...props.items.map((item) => item.total_tokens))
  return props.items.map((item) => ({
    key: item.workspace_hash,
    label: item.display_name,
    value: `${formatCredit(item.credit)} 积分`,
    meter: item.total_tokens / max,
    hint: `${formatTokens(item.total_tokens)} Token · ${item.requests} 次请求`,
  }))
})
</script>

<template>
  <BarList :items="rows" empty-text="当前时间范围内没有项目消耗" />
</template>
