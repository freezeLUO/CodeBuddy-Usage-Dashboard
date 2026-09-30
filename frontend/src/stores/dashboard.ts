import { defineStore } from 'pinia'
import { http } from '@/api/client'
import type {
  ConversationDetail,
  ConversationList,
  Meta,
  ModelUsage,
  Overview,
  ProjectUsage,
  RefreshResult,
  TimePoint,
} from '@/api/types'
import { useFiltersStore } from './filters'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    overview: null as Overview | null,
    timeseries: [] as TimePoint[],
    projects: [] as ProjectUsage[],
    models: [] as ModelUsage[],
    allProjects: [] as ProjectUsage[],
    allModels: [] as ModelUsage[],
    meta: null as Meta | null,
    optionsLoaded: false,
    loading: false,
    refreshing: false,
  }),
  actions: {
    async loadOptions() {
      if (this.optionsLoaded) return
      const [projects, models] = await Promise.all([
        http.get<{ items: ProjectUsage[] }>('/projects'),
        http.get<{ items: ModelUsage[] }>('/models'),
      ])
      this.allProjects = projects.data.items
      this.allModels = models.data.items
      this.optionsLoaded = true
    },
    async loadAll() {
      const filters = useFiltersStore()
      this.loading = true
      try {
        const [overview, series, projects, models, meta] = await Promise.all([
          http.get<Overview>('/overview', { params: filters.params }),
          http.get<{ items: TimePoint[] }>('/timeseries', { params: filters.params }),
          http.get<{ items: ProjectUsage[] }>('/projects', { params: filters.params }),
          http.get<{ items: ModelUsage[] }>('/models', { params: filters.params }),
          http.get<Meta>('/meta'),
        ])
        this.overview = overview.data
        this.timeseries = series.data.items
        this.projects = projects.data.items
        this.models = models.data.items
        this.meta = meta.data
      } finally {
        this.loading = false
      }
    },
    async refresh(): Promise<RefreshResult> {
      this.refreshing = true
      try {
        const { data } = await http.post<RefreshResult>('/refresh')
        await this.loadAll()
        return data
      } finally {
        this.refreshing = false
      }
    },
  },
})

export type { ConversationDetail, ConversationList }
