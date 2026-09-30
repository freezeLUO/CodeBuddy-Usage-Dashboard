import { defineStore } from 'pinia'
import type { FilterParams } from '@/api/types'

function toISODate(value: Date | string | null): string | undefined {
  if (!value) return undefined
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const useFiltersStore = defineStore('filters', {
  state: () => ({
    range: [null, null] as [string | null, string | null],
    workspaces: [] as string[],
    models: [] as string[],
    granularity: 'day' as 'day' | 'week',
  }),
  getters: {
    active(state): boolean {
      return Boolean(state.range[0] || state.range[1] || state.workspaces.length || state.models.length)
    },
    params(state): FilterParams {
      const params: FilterParams = { granularity: state.granularity }
      const start = toISODate(state.range[0])
      const end = toISODate(state.range[1])
      if (start) params.start_date = start
      if (end) params.end_date = end
      if (state.workspaces.length) params.workspace = [...state.workspaces]
      if (state.models.length) params.model = [...state.models]
      return params
    },
  },
  actions: {
    reset() {
      this.range = [null, null]
      this.workspaces = []
      this.models = []
    },
  },
})
