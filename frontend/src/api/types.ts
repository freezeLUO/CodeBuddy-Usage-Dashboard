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

export interface ProjectUsage {
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

export interface ModelUsage {
  model_id: string
  model_name: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  credit: number
  requests: number
  cache_hit_ratio: number
}

export interface ConversationListItem {
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
  items: ConversationListItem[]
}

export interface RequestItem {
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
  requests: RequestItem[]
}

export interface RefreshResult {
  added: number
  updated: number
  deleted: number
  errors: number
  scanned: number
  duration_ms: number
  db_path: string
}

export interface Meta {
  last_refresh_ms: number | null
  db_path: string
  workspace_count: number
  conversation_count: number
}

export interface FilterParams {
  start_date?: string
  end_date?: string
  workspace?: string[]
  model?: string[]
  granularity?: 'day' | 'week'
}
