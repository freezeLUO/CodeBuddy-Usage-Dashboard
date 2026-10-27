import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type { FilterParams } from '@/api/types'

/** 快捷时间范围：近三天 / 一周 / 一个月 / 一年 / 全部 */
export type RangePreset = '3d' | '1w' | '1m' | '1y' | 'all'

/** 往前推的天数（含今天），即区间长度 - 1 */
const PRESET_SPAN_DAYS: Record<Exclude<RangePreset, 'all'>, number> = {
  '3d': 2,
  '1w': 6,
  '1m': 29,
  '1y': 364,
}

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
    /** 当前命中的快捷范围，空串表示手动选择的日期 */
    preset: '' as RangePreset | '',
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
    applyPreset(value: RangePreset | '') {
      this.preset = value
      if (!value) return
      if (value === 'all') {
        this.range = [null, null]
        return
      }
      const today = dayjs()
      this.range = [
        today.subtract(PRESET_SPAN_DAYS[value], 'day').format('YYYY-MM-DD'),
        today.format('YYYY-MM-DD'),
      ]
    },
    reset() {
      this.range = [null, null]
      this.workspaces = []
      this.models = []
      this.preset = ''
    },
  },
})
