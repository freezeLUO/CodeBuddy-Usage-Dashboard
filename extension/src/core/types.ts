/** 与 FastAPI 版响应形状保持一致的数据契约（snake_case 直接给 webview 用）。 */

/** 支持的数据源，可在看板与侧边栏顶部切换。 */
export type Provider = 'codebuddy' | 'workbuddy'

export interface Overview {
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_credit: number
  request_count: number
  conversation_count: number
  workspace_count: number
  cache_hit_ratio: number
  thinking_tokens: number
  avg_elapsed_ms: number
  date_min: number | null
  date_max: number | null
}

export interface TimePoint {
  bucket: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  credit: number
  requests: number
}

export interface ProjectRow {
  workspace_hash: string
  display_name: string
  path: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  credit: number
  requests: number
  conversations: number
}

export interface ModelRow {
  model_id: string
  model_name: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  credit: number
  requests: number
  cache_hit_ratio: number
}

export interface ConversationRow {
  conversation_id: string
  title: string | null
  workspace_hash: string
  display_name: string
  path: string
  started_at_ms: number | null
  ended_at_ms: number | null
  request_count: number
  message_count: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  credit: number
  models: string[]
}

export interface ConversationList {
  total: number
  page: number
  size: number
  items: ConversationRow[]
}

export interface RequestRow {
  request_id: string
  started_at_ms: number
  model_id: string | null
  model_name: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cache_tokens: number
  cached_miss_tokens: number
  last_tokens: number
  credit: number
  thinking_tokens: number
  elapsed_ms: number | null
  agent_message_count: number
  cache_hit_ratio: number
}

export interface ConversationDetail {
  conversation_id: string
  title: string | null
  workspace_hash: string
  display_name: string
  path: string
  started_at_ms: number | null
  ended_at_ms: number | null
  request_count: number
  message_count: number
  total_tokens: number
  credit: number
  requests: RequestRow[]
}

export interface Meta {
  last_refresh_ms: number | null
  cache_path: string
  data_root: string
  data_root_exists: boolean
  provider: Provider
  workspace_count: number
  conversation_count: number
  request_count: number
}

export interface RefreshResult {
  added: number
  updated: number
  deleted: number
  errors: number
  scanned: number
  duration_ms: number
}

export interface SidebarPayload {
  overview: Overview
  timeseries: TimePoint[]
  projects: ProjectRow[]
  models: ModelRow[]
  recent: ConversationRow[]
  meta: Meta
}

export interface DashboardPayload {
  overview: Overview
  timeseries: TimePoint[]
  projects: ProjectRow[]
  models: ModelRow[]
  meta: Meta
}

export interface OptionsPayload {
  projects: ProjectRow[]
  models: ModelRow[]
  date_min: number | null
  date_max: number | null
}

export interface ConversationQuery {
  page?: number
  size?: number
  q?: string | null
  sort?: 'ended_at_ms' | 'started_at_ms' | 'total_tokens' | 'credit' | 'request_count'
  order?: 'asc' | 'desc'
}

/* ------------------------------------------------------------------ */
/* 缓存结构：用一份 JSON 取代 Python 版的 6 张 SQLite 表                */
/* ------------------------------------------------------------------ */

export interface WorkspaceRecord {
  path: string
  display_name: string
  source: 'storage' | 'unknown'
}

export interface ConversationRecord {
  conversation_id: string
  workspace_hash: string
  title: string | null
  started_at_ms: number | null
  ended_at_ms: number | null
  request_count: number
  message_count: number
}

export interface RequestRecord {
  request_id: string
  conversation_id: string
  started_at_ms: number
  model_id: string | null
  model_name: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cache_tokens: number
  cached_write_tokens: number
  cached_miss_tokens: number
  last_tokens: number
  credit: number
}

export interface MessageStatRecord {
  request_id: string
  message_id: string
  stat_input_tokens: number | null
  stat_output_tokens: number | null
  stat_cached_input_tokens: number | null
  thinking_tokens: number | null
  elapsed_ms: number | null
  last_output_tokens: number | null
  agent_message_count: number | null
  credit: number | null
}

export interface ScanFileRecord {
  kind: 'index' | 'message' | 'workbuddy'
  conversation_id: string
  mtime_ns: string
  size: number
  parsed_at_ms: number
  status: 'ok' | 'error'
}

export interface CacheFile {
  schemaVersion: number
  meta: {
    lastRefreshMs: number | null
    lastFullScanMs: number | null
  }
  workspaces: Record<string, WorkspaceRecord>
  conversations: Record<string, ConversationRecord>
  requests: RequestRecord[]
  stats: Record<string, MessageStatRecord>
  scanFiles: Record<string, ScanFileRecord>
}

/** 解析层内部类型 */
export interface StatsSnapshot {
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  cacheWriteTokens?: number
  cacheMissTokens?: number
  thinkingTokens?: number
  elapsedMs?: number
  lastOutputTokens?: number
  credit?: number
}

export interface MessageInfo {
  messageId: string
  role: string | null
  createdAtMs: number | null
  requestId: string | null
  modelId: string | null
  modelName: string | null
  agentMessageCount: number | null
  snapshot: StatsSnapshot | null
  title: string | null
  inputPhrase: string | null
}

export interface ParsedRequest {
  requestId: string
  startedAtMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheTokens: number
  cachedWriteTokens: number
  cachedMissTokens: number
  lastTokens: number
  credit: number
  modelId: string | null
  modelName: string | null
  messageId: string | null
  stat: MessageStatRecord | null
}

export interface ParsedConversation {
  conversationId: string
  workspaceHash: string
  title: string | null
  startedAtMs: number | null
  endedAtMs: number | null
  messageCount: number
  requests: ParsedRequest[]
}
