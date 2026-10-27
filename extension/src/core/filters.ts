/** 共享筛选参数：时间范围（本地时区闭区间）、项目、模型。 */
import type { ConversationRecord, RequestRecord } from './types'

export interface FilterInput {
  startDate?: string | null
  endDate?: string | null
  workspaces?: string[] | null
  models?: string[] | null
}

const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/

function parseLocalDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_RE.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export function dayStartMs(value: string): number | null {
  const parts = parseLocalDate(value)
  if (!parts) return null
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime()
}

export function dayEndMs(value: string): number | null {
  const parts = parseLocalDate(value)
  if (!parts) return null
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime()
}

function unique(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
}

export class Filters {
  readonly startMs: number | null
  readonly endMs: number | null
  readonly workspaces: string[]
  readonly models: string[]

  constructor(input: FilterInput = {}) {
    this.startMs = input.startDate ? dayStartMs(input.startDate) : null
    this.endMs = input.endDate ? dayEndMs(input.endDate) : null
    this.workspaces = unique(input.workspaces)
    this.models = unique(input.models)
  }

  get active(): boolean {
    return (
      this.startMs !== null ||
      this.endMs !== null ||
      this.workspaces.length > 0 ||
      this.models.length > 0
    )
  }

  matches(request: RequestRecord, conversation: ConversationRecord | undefined): boolean {
    if (this.startMs !== null && request.started_at_ms < this.startMs) return false
    if (this.endMs !== null && request.started_at_ms > this.endMs) return false
    if (this.models.length && (!request.model_id || !this.models.includes(request.model_id))) {
      return false
    }
    if (
      this.workspaces.length &&
      (!conversation || !this.workspaces.includes(conversation.workspace_hash))
    ) {
      return false
    }
    return true
  }
}

export const EMPTY_FILTERS = new Filters()
