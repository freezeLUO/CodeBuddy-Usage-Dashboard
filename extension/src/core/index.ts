/** core 对外唯一入口：host 只依赖 UsageStore。 */
import { isDirectory } from './config'
import { emptyCache, loadCache, saveCache } from './cache'
import { Filters } from './filters'
import { UsageQueries } from './queries'
import { refreshCache } from './refresh'
import type {
  CacheFile,
  ConversationDetail,
  ConversationList,
  ConversationQuery,
  DashboardPayload,
  Meta,
  ModelRow,
  OptionsPayload,
  Overview,
  ProjectRow,
  RefreshResult,
  SidebarPayload,
  TimePoint,
} from './types'

export type LogLevel = 'info' | 'warn' | 'error'

export interface StoreOptions {
  dataRoot: string
  workspaceStorageRoot: string
  cacheFile: string
  log?: (message: string, level?: LogLevel) => void
}

export class UsageStore {
  private cacheData: CacheFile = emptyCache()
  private queries = new UsageQueries(this.cacheData)
  private inflight: Promise<RefreshResult> | null = null
  private lastErrorValue: string | null = null
  private dataRootExists = false
  private loadedOnce = false

  constructor(private readonly config: StoreOptions) {}

  get dataRoot(): string {
    return this.config.dataRoot
  }

  get workspaceStorageRoot(): string {
    return this.config.workspaceStorageRoot
  }

  get cacheFile(): string {
    return this.config.cacheFile
  }

  get cache(): CacheFile {
    return this.cacheData
  }

  get initialized(): boolean {
    return this.loadedOnce
  }

  get lastRefreshMs(): number | null {
    return this.cacheData.meta.lastRefreshMs
  }

  get lastError(): string | null {
    return this.lastErrorValue
  }

  get hasData(): boolean {
    return Object.keys(this.cacheData.conversations).length > 0 || this.cacheData.requests.length > 0
  }

  async load(): Promise<void> {
    const cached = await loadCache(this.config.cacheFile)
    if (cached) this.cacheData = cached
    else this.cacheData = emptyCache()
    this.dataRootExists = await isDirectory(this.config.dataRoot)
    this.rebuild()
    this.loadedOnce = true
  }

  /** 串行化刷新，避免并发写坏缓存。 */
  async refresh(onProgress?: (done: number, total: number) => void): Promise<RefreshResult> {
    if (this.inflight) return this.inflight
    this.inflight = this.runRefresh(onProgress).finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  private async runRefresh(onProgress?: (done: number, total: number) => void): Promise<RefreshResult> {
    try {
      const outcome = await refreshCache(this.cacheData, {
        dataRoot: this.config.dataRoot,
        workspaceStorageRoot: this.config.workspaceStorageRoot,
        onProgress,
      })
      this.cacheData = outcome.cache
      this.dataRootExists = await isDirectory(this.config.dataRoot)
      this.rebuild()
      this.lastErrorValue = null
      try {
        await saveCache(this.config.cacheFile, this.cacheData)
      } catch (error) {
        this.log(`写入缓存失败：${errorText(error)}`, 'warn')
      }
      const result = outcome.result
      this.log(
        `扫描 ${result.scanned} 个会话 / 新增 ${result.added} / 更新 ${result.updated} / 删除 ${result.deleted} / 错误 ${result.errors}，耗时 ${result.duration_ms}ms`,
      )
      return result
    } catch (error) {
      this.lastErrorValue = errorText(error)
      this.log(`刷新失败：${this.lastErrorValue}`, 'error')
      throw error
    }
  }

  isStale(minutes: number): boolean {
    if (this.lastRefreshMs === null) return true
    if (minutes <= 0) return false
    return Date.now() - this.lastRefreshMs >= minutes * 60_000
  }

  meta(): Meta {
    const overview = this.queries.overview(new Filters())
    return {
      last_refresh_ms: this.cacheData.meta.lastRefreshMs,
      cache_path: this.config.cacheFile,
      data_root: this.config.dataRoot,
      data_root_exists: this.dataRootExists,
      workspace_count: overview.workspace_count,
      conversation_count: Object.keys(this.cacheData.conversations).length,
      request_count: this.cacheData.requests.length,
    }
  }

  todayCredit(): number {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    let total = 0
    for (const request of this.cacheData.requests) {
      if (request.started_at_ms >= start) total += request.credit
    }
    return Math.round(total * 100) / 100
  }

  overview(filters: Filters): Overview {
    return this.queries.overview(filters)
  }

  timeseries(filters: Filters, granularity: 'day' | 'week'): TimePoint[] {
    return this.queries.timeseries(filters, granularity)
  }

  projects(filters: Filters): ProjectRow[] {
    return this.queries.projects(filters)
  }

  models(filters: Filters): ModelRow[] {
    return this.queries.models(filters)
  }

  conversations(filters: Filters, query: ConversationQuery = {}): ConversationList {
    return this.queries.conversations(filters, query)
  }

  conversationDetail(filters: Filters, conversationId: string): ConversationDetail | null {
    return this.queries.conversationDetail(filters, conversationId)
  }

  options(): OptionsPayload {
    return this.queries.options()
  }

  sidebar(filters: Filters): SidebarPayload {
    return this.queries.sidebar(filters, this.meta())
  }

  dashboard(filters: Filters, granularity: 'day' | 'week'): DashboardPayload {
    return this.queries.dashboard(filters, granularity, this.meta())
  }

  private rebuild(): void {
    this.queries = new UsageQueries(this.cacheData)
  }

  private log(message: string, level: LogLevel = 'info'): void {
    this.config.log?.(message, level)
  }
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export { Filters } from './filters'
export type { FilterInput } from './filters'
