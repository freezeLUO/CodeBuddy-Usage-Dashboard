import { toDateString } from './format'

export interface RangeOption {
  value: string
  label: string
  days: number | null
}

export const SIDEBAR_RANGES: RangeOption[] = [
  { value: 'today', label: '今天', days: 1 },
  { value: '7d', label: '7 天', days: 7 },
  { value: '30d', label: '30 天', days: 30 },
  { value: 'all', label: '全部', days: null },
]

export const DASHBOARD_RANGES: RangeOption[] = [
  { value: '3d', label: '近三天', days: 3 },
  { value: '1w', label: '一周', days: 7 },
  { value: '1m', label: '一月', days: 30 },
  { value: '1y', label: '一年', days: 365 },
  { value: 'all', label: '全部', days: null },
]

export interface DateRange {
  startDate: string | null
  endDate: string | null
}

export function rangeForPreset(preset: string, options: RangeOption[]): DateRange {
  const option = options.find((item) => item.value === preset)
  if (!option || option.days === null) return { startDate: null, endDate: null }
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (option.days - 1))
  return { startDate: toDateString(start), endDate: toDateString(end) }
}
