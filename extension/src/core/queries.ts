/** 聚合查询：1:1 复刻 Python 版 `api/queries.py` 的口径。 */
import { EMPTY_FILTERS, Filters } from './filters'
import type {
  CacheFile,
  ConversationDetail,
  ConversationList,
  ConversationQuery,
  ConversationRecord,
  ConversationRow,
  DashboardPayload,
  ModelRow,
  OptionsPayload,
  Overview,
  ProjectRow,
  RequestRecord,
  RequestRow,
  SidebarPayload,
  TimePoint,
  WorkspaceRecord,
} from './types'

const MAX_PAGE_SIZE = 200

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

export function dayBucket(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 对齐 SQLite `strftime('%Y-W%W')`：周一为一周起点，首个周一之前算第 00 周。
 */
export function weekBucket(ms: number): string {
  const date = new Date(ms)
  const year = date.getFullYear()
  const dayOfYear = Math.round(
    (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 1)) / 86_400_000,
  )
  const weekday = (date.getDay() + 6) % 7
  const week = Math.floor((dayOfYear + 7 - weekday) / 7)
  return `${year}-W${pad(week)}`
}

interface Aggregate {
  total_tokens: number
  input_tokens: number
  output_tokens: number
  credit: number
  requests: number
  models: Set<string>
}

function newAggregate(): Aggregate {
  return { total_tokens: 0, input_tokens: 0, output_tokens: 0, credit: 0, requests: 0, models: new Set() }
}

function addTo(aggregate: Aggregate, request: RequestRecord): void {
  aggregate.total_tokens += request.total_tokens
  aggregate.input_tokens += request.input_tokens
  aggregate.output_tokens += request.output_tokens
  aggregate.credit += request.credit
  aggregate.requests += 1
  aggregate.models.add(request.model_id ?? 'unknown')
}

export class UsageQueries {
  private readonly conversationMap = new Map<string, ConversationRecord>()
  private readonly requestsByConversation = new Map<string, RequestRecord[]>()
  private readonly allRequests: RequestRecord[]
  private readonly stats: CacheFile['stats']
  private readonly workspaces: Record<string, WorkspaceRecord>

  constructor(cache: CacheFile) {
    for (const conversation of Object.values(cache.conversations)) {
      this.conversationMap.set(conversation.conversation_id, conversation)
    }
    this.allRequests = cache.requests
    for (const request of cache.requests) {
      const bucket = this.requestsByConversation.get(request.conversation_id)
      if (bucket) bucket.push(request)
      else this.requestsByConversation.set(request.conversation_id, [request])
    }
    this.stats = cache.stats
    this.workspaces = cache.workspaces
  }

  get conversationCount(): number {
    return this.conversationMap.size
  }

  get requestCount(): number {
    return this.allRequests.length
  }

  /** 遍历满足筛选条件的请求。 */
  private each(filters: Filters, visit: (request: RequestRecord, conversation: ConversationRecord) => void): void {
    for (const request of this.allRequests) {
      const conversation = this.conversationMap.get(request.conversation_id)
      if (!conversation) continue
      if (!filters.matches(request, conversation)) continue
      visit(request, conversation)
    }
  }

  overview(filters: Filters): Overview {
    let inputTokens = 0
    let outputTokens = 0
    let totalTokens = 0
    let cacheTokens = 0
    let credit = 0
    let requestCount = 0
    let thinkingTokens = 0
    let elapsedSum = 0
    let elapsedCount = 0
    let dateMin: number | null = null
    let dateMax: number | null = null
    const conversationIds = new Set<string>()
    const workspaceHashes = new Set<string>()

    this.each(filters, (request, conversation) => {
      requestCount += 1
      inputTokens += request.input_tokens
      outputTokens += request.output_tokens
      totalTokens += request.total_tokens
      cacheTokens += request.cache_tokens
      credit += request.credit
      conversationIds.add(request.conversation_id)
      workspaceHashes.add(conversation.workspace_hash)
      dateMin = dateMin === null ? request.started_at_ms : Math.min(dateMin, request.started_at_ms)
      dateMax = dateMax === null ? request.started_at_ms : Math.max(dateMax, request.started_at_ms)
      const stat = this.stats[request.request_id]
      if (stat) {
        thinkingTokens += stat.thinking_tokens ?? 0
        if (typeof stat.elapsed_ms === 'number') {
          elapsedSum += stat.elapsed_ms
          elapsedCount += 1
        }
      }
    })

    let conversationCount = conversationIds.size
    let workspaceCount = workspaceHashes.size
    if (!filters.active) {
      conversationCount = this.conversationMap.size
      workspaceCount = new Set(
        [...this.conversationMap.values()].map((row) => row.workspace_hash),
      ).size
    }

    return {
      total_input_tokens: inputTokens,
      total_output_tokens: outputTokens,
      total_tokens: totalTokens,
      total_credit: round2(credit),
      request_count: requestCount,
      conversation_count: conversationCount,
      workspace_count: workspaceCount,
      cache_hit_ratio: inputTokens ? round4(cacheTokens / inputTokens) : 0,
      thinking_tokens: thinkingTokens,
      avg_elapsed_ms: elapsedCount ? Math.round((elapsedSum / elapsedCount) * 10) / 10 : 0,
      date_min: dateMin,
      date_max: dateMax,
    }
  }

  timeseries(filters: Filters, granularity: 'day' | 'week' = 'day'): TimePoint[] {
    const buckets = new Map<string, TimePoint>()
    this.each(filters, (request) => {
      const bucket = granularity === 'week' ? weekBucket(request.started_at_ms) : dayBucket(request.started_at_ms)
      const point = buckets.get(bucket) ?? {
        bucket,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        credit: 0,
        requests: 0,
      }
      point.input_tokens += request.input_tokens
      point.output_tokens += request.output_tokens
      point.total_tokens += request.total_tokens
      point.credit += request.credit
      point.requests += 1
      buckets.set(bucket, point)
    })

    return [...buckets.values()]
      .map((point) => ({ ...point, credit: round2(point.credit) }))
      .sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0))
  }

  projects(filters: Filters): ProjectRow[] {
    const rows = new Map<string, ProjectRow & { conversationIds: Set<string> }>()
    this.each(filters, (request, conversation) => {
      const hash = conversation.workspace_hash
      let row = rows.get(hash)
      if (!row) {
        const workspace = this.workspaces[hash]
        row = {
          workspace_hash: hash,
          display_name: workspace?.display_name ?? hash.slice(0, 8),
          path: workspace?.path ?? '',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          credit: 0,
          requests: 0,
          conversations: 0,
          conversationIds: new Set(),
        }
        rows.set(hash, row)
      }
      row.input_tokens += request.input_tokens
      row.output_tokens += request.output_tokens
      row.total_tokens += request.total_tokens
      row.credit += request.credit
      row.requests += 1
      row.conversationIds.add(conversation.conversation_id)
    })

    return [...rows.values()]
      .map((row) => ({
        workspace_hash: row.workspace_hash,
        display_name: row.display_name,
        path: row.path,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        total_tokens: row.total_tokens,
        credit: round2(row.credit),
        requests: row.requests,
        conversations: row.conversationIds.size,
      }))
      .sort((a, b) => b.total_tokens - a.total_tokens)
  }

  models(filters: Filters): ModelRow[] {
    const rows = new Map<string, ModelRow & { cache_tokens: number; names: Set<string> }>()
    this.each(filters, (request) => {
      const id = request.model_id ?? 'unknown'
      let row = rows.get(id)
      if (!row) {
        row = {
          model_id: id,
          model_name: id,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          credit: 0,
          requests: 0,
          cache_hit_ratio: 0,
          cache_tokens: 0,
          names: new Set<string>(),
        }
        rows.set(id, row)
      }
      row.input_tokens += request.input_tokens
      row.output_tokens += request.output_tokens
      row.total_tokens += request.total_tokens
      row.credit += request.credit
      row.requests += 1
      row.cache_tokens += request.cache_tokens
      row.names.add(request.model_name ?? request.model_id ?? 'unknown')
    })

    return [...rows.values()]
      .map((row) => {
        // Python 用 MAX(COALESCE(model_name, model_id)) 取名，保持一致的字符串取最大
        const modelName = [...row.names].sort().pop() ?? row.model_id
        return {
          model_id: row.model_id,
          model_name: modelName,
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
          total_tokens: row.total_tokens,
          credit: round2(row.credit),
          requests: row.requests,
          cache_hit_ratio: row.input_tokens ? round4(row.cache_tokens / row.input_tokens) : 0,
        }
      })
      .sort((a, b) => b.total_tokens - a.total_tokens)
  }

  conversations(filters: Filters, query: ConversationQuery = {}): ConversationList {
    const page = Math.max(1, Math.trunc(query.page ?? 1))
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query.size ?? 20)))
    const order: 'asc' | 'desc' = query.order === 'asc' ? 'asc' : 'desc'
    const sort = query.sort ?? 'ended_at_ms'
    const keyword = (query.q ?? '').trim().toLowerCase()

    const aggregates = new Map<string, Aggregate>()
    this.each(filters, (request) => {
      let aggregate = aggregates.get(request.conversation_id)
      if (!aggregate) {
        aggregate = newAggregate()
        aggregates.set(request.conversation_id, aggregate)
      }
      addTo(aggregate, request)
    })

    const candidates: ConversationRecord[] = filters.active
      ? [...aggregates.keys()]
          .map((id) => this.conversationMap.get(id))
          .filter((row): row is ConversationRecord => !!row)
      : [...this.conversationMap.values()]

    const rows: ConversationRow[] = []
    for (const conversation of candidates) {
      const title = conversation.title
      if (keyword) {
        const haystackTitle = (title ?? '').toLowerCase()
        if (!haystackTitle.includes(keyword) && !conversation.conversation_id.includes(keyword)) {
          continue
        }
      }
      const workspace = this.workspaces[conversation.workspace_hash]
      const aggregate = aggregates.get(conversation.conversation_id) ?? newAggregate()
      rows.push({
        conversation_id: conversation.conversation_id,
        title,
        workspace_hash: conversation.workspace_hash,
        display_name: workspace?.display_name ?? conversation.workspace_hash.slice(0, 8),
        path: workspace?.path ?? '',
        started_at_ms: conversation.started_at_ms,
        ended_at_ms: conversation.ended_at_ms,
        request_count: conversation.request_count,
        message_count: conversation.message_count,
        total_tokens: aggregate.total_tokens,
        input_tokens: aggregate.input_tokens,
        output_tokens: aggregate.output_tokens,
        credit: round2(aggregate.credit),
        models: [...aggregate.models].filter((id) => id !== 'unknown').sort(),
      })
    }

    const direction = order === 'asc' ? 1 : -1
    const valueOf = (row: ConversationRow): number => {
      switch (sort) {
        case 'started_at_ms':
          return row.started_at_ms ?? Number.NEGATIVE_INFINITY
        case 'total_tokens':
          return row.total_tokens
        case 'credit':
          return row.credit
        case 'request_count':
          return row.request_count
        case 'ended_at_ms':
        default:
          return row.ended_at_ms ?? Number.NEGATIVE_INFINITY
      }
    }
    rows.sort((a, b) => {
      const left = valueOf(a)
      const right = valueOf(b)
      if (left === right) return 0
      return left < right ? -direction : direction
    })

    const start = (page - 1) * size
    return {
      total: rows.length,
      page,
      size,
      items: rows.slice(start, start + size),
    }
  }

  conversationDetail(filters: Filters, conversationId: string): ConversationDetail | null {
    const conversation = this.conversationMap.get(conversationId)
    if (!conversation) return null
    const workspace = this.workspaces[conversation.workspace_hash]

    const requests: RequestRow[] = []
    let totalTokens = 0
    let credit = 0
    for (const request of this.requestsByConversation.get(conversationId) ?? []) {
      if (!filters.matches(request, conversation)) continue
      totalTokens += request.total_tokens
      credit += request.credit
      const stat = this.stats[request.request_id]
      requests.push({
        request_id: request.request_id,
        started_at_ms: request.started_at_ms,
        model_id: request.model_id,
        model_name: request.model_name,
        input_tokens: request.input_tokens,
        output_tokens: request.output_tokens,
        total_tokens: request.total_tokens,
        cache_tokens: request.cache_tokens,
        cached_miss_tokens: request.cached_miss_tokens,
        last_tokens: request.last_tokens,
        credit: round2(request.credit),
        thinking_tokens: stat?.thinking_tokens ?? 0,
        elapsed_ms: stat?.elapsed_ms ?? null,
        agent_message_count: stat?.agent_message_count ?? 0,
        cache_hit_ratio: request.input_tokens ? round4(request.cache_tokens / request.input_tokens) : 0,
      })
    }
    requests.sort((a, b) => a.started_at_ms - b.started_at_ms)

    return {
      conversation_id: conversation.conversation_id,
      title: conversation.title,
      workspace_hash: conversation.workspace_hash,
      display_name: workspace?.display_name ?? conversation.workspace_hash.slice(0, 8),
      path: workspace?.path ?? '',
      started_at_ms: conversation.started_at_ms,
      ended_at_ms: conversation.ended_at_ms,
      request_count: conversation.request_count,
      message_count: conversation.message_count,
      total_tokens: totalTokens,
      credit: round2(credit),
      requests,
    }
  }

  options(): OptionsPayload {
    const projects = this.projects(EMPTY_FILTERS)
    const models = this.models(EMPTY_FILTERS)
    let dateMin: number | null = null
    let dateMax: number | null = null
    for (const request of this.allRequests) {
      dateMin = dateMin === null ? request.started_at_ms : Math.min(dateMin, request.started_at_ms)
      dateMax = dateMax === null ? request.started_at_ms : Math.max(dateMax, request.started_at_ms)
    }
    return { projects, models, date_min: dateMin, date_max: dateMax }
  }

  sidebar(filters: Filters, meta: SidebarPayload['meta']): SidebarPayload {
    return {
      overview: this.overview(filters),
      timeseries: this.timeseries(filters, 'day'),
      projects: this.projects(filters).slice(0, 5),
      models: this.models(filters).slice(0, 5),
      recent: this.conversations(filters, { page: 1, size: 5, sort: 'ended_at_ms', order: 'desc' }).items,
      meta,
    }
  }

  dashboard(filters: Filters, granularity: 'day' | 'week', meta: DashboardPayload['meta']): DashboardPayload {
    return {
      overview: this.overview(filters),
      timeseries: this.timeseries(filters, granularity),
      projects: this.projects(filters),
      models: this.models(filters),
      meta,
    }
  }
}
