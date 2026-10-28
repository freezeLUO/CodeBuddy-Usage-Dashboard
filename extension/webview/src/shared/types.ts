/** 复用 core 的数据契约，避免两份 interface 漂移。 */
export type {
  ConversationDetail,
  ConversationList,
  ConversationRow,
  DashboardPayload,
  Meta,
  ModelRow,
  OptionsPayload,
  Overview,
  ProjectRow,
  Provider,
  RefreshResult,
  RequestRow,
  SidebarPayload,
  TimePoint,
} from '../../../src/core/types'

export interface FiltersState {
  startDate: string | null
  endDate: string | null
  workspaces: string[]
  models: string[]
  granularity: 'day' | 'week'
  preset: string
}

export interface ProgressPayload {
  done: number
  total: number
}

export type DashboardTab = 'overview' | 'conversations'

export interface BarListItem {
  key: string
  label: string
  value: string
  meter: number
  hint?: string
  accent?: string
}
