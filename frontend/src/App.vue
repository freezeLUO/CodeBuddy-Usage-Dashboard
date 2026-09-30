<script setup lang="ts">
import { onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import AppHeader from '@/components/AppHeader.vue'

const dashboard = useDashboardStore()

onMounted(() => {
  dashboard.loadAll()
})
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="page">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
}
</style>
