import { defineStore } from 'pinia'
import { http } from '@/api/client'
import type {
  ConversationDetail,
  ConversationList,
  Meta,
  ModelUsage,
  Overview,
  ProjectUsage,
  Provider,
  ProviderSwitchResult,
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
    /** 数据源切换计数：所有依赖会话列表的视图靠它重新拉取 */
    dataVersion: 0,
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
    /** 切换数据源：后端切换缓存库并立即扫描，返回后重新拉取全部数据。 */
    async switchProvider(provider: Provider): Promise<void> {
      if (this.meta?.provider === provider) return
      const filters = useFiltersStore()
      this.refreshing = true
      try {
        await http.post<ProviderSwitchResult>('/provider', { provider })
        // 上一个数据源的项目 hash 与模型 id 在新数据源里没有意义
        filters.workspaces = []
        filters.models = []
        this.optionsLoaded = false
        await Promise.all([this.loadAll(), this.loadOptions()])
        this.dataVersion += 1
      } finally {
        this.refreshing = false
      }
    },
  },
})

export type { ConversationDetail, ConversationList }
