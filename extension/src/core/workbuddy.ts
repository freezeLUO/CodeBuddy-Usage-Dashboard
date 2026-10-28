/**
 * WorkBuddy 采集器：把 `~/.workbuddy/projects/<工作区>/<会话>.jsonl` 转成与 CodeBuddy
 * 完全相同的缓存结构，从而复用全部聚合查询与界面。
 *
 * 口径（对齐 workbuddy-usage-status 的说明）：
 * - 一次模型调用 = 一条 request，来源是带 `providerData.rawUsage` 的 jsonl 行；
 * - token 取 `rawUsage.prompt_tokens / completion_tokens / prompt_cache_hit_tokens`；
 * - 积分取 `rawUsage.credit`，按该次调用真正发生的时间归日；
 * - 思考 token 取 `rawUsage.completion_thinking_tokens`；
 * - 会话标题取 `aiTitle`，缺失时回退到首条用户提问；
 * - 项目路径取行内 `cwd`，没有 cwd 时归入「未打开工作区」。
 */
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import * as path from 'node:path'
import type {
  CacheFile,
  MessageStatRecord,
  RefreshResult,
  RequestRecord,
  ScanFileRecord,
  WorkspaceRecord,
} from './types'
import { CACHE_SCHEMA_VERSION, removeConversation } from './cache'
import { asRecord, toNumber, toStr } from './parser'
import { NO_WORKSPACE_HASH, NO_WORKSPACE_NAME, displayNameOf, hashForPath } from './resolver'
import { fingerprint } from './scanner'

const TITLE_MAX = 48
const SYSTEM_REMINDER_RE = /<system-reminder[\s\S]*?<\/system-reminder>/gi
const TAG_RE = /<[^>]+>/g

export interface SessionFileRef {
  sessionId: string
  file: string
  mtimeNs: string
  size: number
}

export interface WorkbuddySession {
  conversation: {
    conversation_id: string
    workspace_hash: string
    title: string | null
    started_at_ms: number | null
    ended_at_ms: number | null
    request_count: number
    message_count: number
  }
  workspace: WorkspaceRecord
  requests: RequestRecord[]
  stats: Record<string, MessageStatRecord>
}

async function listDir(target: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(target, { withFileTypes: true })
  } catch {
    return []
  }
}

/** 枚举 `projects/<工作区>/<会话>.jsonl`，键为文件的绝对路径。 */
export async function discoverWorkbuddy(root: string): Promise<Map<string, SessionFileRef>> {
  const found = new Map<string, SessionFileRef>()
  if (!root) return found

  for (const workspace of await listDir(path.join(root, 'projects'))) {
    if (!workspace.isDirectory()) continue
    const dir = path.join(root, 'projects', workspace.name)
    for (const entry of await listDir(dir)) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue
      const file = path.join(dir, entry.name)
      const fp = await fingerprint(file)
      if (!fp) continue
      found.set(file, {
        sessionId: entry.name.slice(0, -'.jsonl'.length),
        file,
        mtimeNs: fp.mtimeNs,
        size: fp.size,
      })
    }
  }
  return found
}

function textFromContent(content: unknown): string {
  const parts: string[] = []
  const walk = (node: unknown, depth = 0): void => {
    if (depth > 4 || node === null || node === undefined) return
    if (typeof node === 'string') {
      parts.push(node)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    const record = asRecord(node)
    if (!record) return
    if (typeof record.text === 'string') {
      parts.push(record.text)
      return
    }
    if (record.content !== undefined) walk(record.content, depth + 1)
  }
  walk(content)
  return parts.join('\n')
}

function cleanTitle(input: string): string | null {
  const text = input
    .replace(SYSTEM_REMINDER_RE, ' ')
    .replace(TAG_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text
}

/**
 * 解析单个会话文件。没有任何模型调用的文件会被跳过（纯工具调用 / 空会话）。
 * 文件损坏时返回 null，由调用方记 `status=error` 并在下一轮重试。
 */
export async function parseWorkbuddySession(ref: SessionFileRef): Promise<WorkbuddySession | null> {
  let raw: string
  try {
    raw = await fs.readFile(ref.file, 'utf8')
  } catch {
    return null
  }

  let sessionId = ref.sessionId
  let aiTitle: string | null = null
  let userTitle: string | null = null
  let cwd: string | null = null
  let messageCount = 0
  let startedAt: number | null = null
  let endedAt: number | null = null
  let sequence = 0

  const requests: RequestRecord[] = []
  const stats: Record<string, MessageStatRecord> = {}
  const seen = new Set<string>()

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let row: Record<string, unknown> | null = null
    try {
      row = asRecord(JSON.parse(trimmed))
    } catch {
      continue
    }
    if (!row) continue

    const rowSession = toStr(row.sessionId)
    if (rowSession) sessionId = rowSession
    const rowCwd = toStr(row.cwd)
    if (rowCwd && !cwd) cwd = rowCwd

    const title = toStr(row.aiTitle)
    if (title && title.trim()) aiTitle = title.trim()

    if (toStr(row.type) === 'message') {
      messageCount += 1
      if (!userTitle && toStr(row.role) === 'user') {
        userTitle = cleanTitle(textFromContent(row.content))
      }
    }

    const provider = asRecord(row.providerData)
    const usage = provider ? asRecord(provider.rawUsage) : null
    if (!provider || !usage) continue

    const startedAtMs = toNumber(row.timestamp)
    if (startedAtMs === null) continue

    sequence += 1
    const baseId = toStr(row.id) ?? `${sessionId}-${sequence}`
    let requestId = baseId
    if (seen.has(requestId)) requestId = `${baseId}-${sequence}`
    seen.add(requestId)

    const input = Math.trunc(toNumber(usage.prompt_tokens) ?? 0)
    const output = Math.trunc(toNumber(usage.completion_tokens) ?? 0)
    const total = Math.trunc(toNumber(usage.total_tokens) ?? input + output)
    const cacheTokens = Math.trunc(toNumber(usage.prompt_cache_hit_tokens) ?? 0)
    const cachedMiss = Math.trunc(toNumber(usage.prompt_cache_miss_tokens) ?? 0)
    const cachedWrite = Math.trunc(toNumber(usage.prompt_cache_write_tokens) ?? 0)
    const credit = toNumber(usage.credit) ?? 0
    const thinking = Math.trunc(toNumber(usage.completion_thinking_tokens) ?? 0)
    const modelId = toStr(provider.model) ?? toStr(provider.requestModelId)
    // `requestModelName` 为 "Auto" 时是路由策略而非模型名，回退到实际模型 id
    const rawName = toStr(provider.requestModelName)
    const modelName = rawName && rawName.toLowerCase() !== 'auto' ? rawName : modelId
    const messageId = toStr(provider.messageId) ?? requestId

    requests.push({
      request_id: requestId,
      conversation_id: sessionId,
      started_at_ms: Math.trunc(startedAtMs),
      model_id: modelId,
      model_name: modelName,
      input_tokens: input,
      output_tokens: output,
      total_tokens: total,
      cache_tokens: cacheTokens,
      cached_write_tokens: cachedWrite,
      cached_miss_tokens: cachedMiss,
      last_tokens: Math.trunc(toNumber(usage.prompt_cache_miss_tokens) ?? 0),
      credit,
    })
    stats[requestId] = {
      request_id: requestId,
      message_id: messageId,
      stat_input_tokens: input,
      stat_output_tokens: output,
      stat_cached_input_tokens: cacheTokens,
      thinking_tokens: thinking,
      elapsed_ms: null,
      last_output_tokens: null,
      agent_message_count: null,
      credit,
    }

    startedAt = startedAt === null ? startedAtMs : Math.min(startedAt, startedAtMs)
    endedAt = endedAt === null ? startedAtMs : Math.max(endedAt, startedAtMs)
  }

  if (!requests.length) return null

  for (const request of requests) request.conversation_id = sessionId

  const workspaceHash = cwd ? hashForPath(cwd) : NO_WORKSPACE_HASH
  const workspace: WorkspaceRecord = cwd
    ? { path: cwd, display_name: displayNameOf(cwd), source: 'storage' }
    : { path: '', display_name: NO_WORKSPACE_NAME, source: 'unknown' }

  return {
    conversation: {
      conversation_id: sessionId,
      workspace_hash: workspaceHash,
      title: aiTitle ?? userTitle,
      started_at_ms: startedAt,
      ended_at_ms: endedAt,
      request_count: requests.length,
      message_count: messageCount,
    },
    workspace,
    requests,
    stats,
  }
}

export interface WorkbuddyRefreshOptions {
  root: string
  onProgress?: (done: number, total: number) => void
}

export interface WorkbuddyRefreshOutcome {
  cache: CacheFile
  result: RefreshResult
}

/** 以会话文件为失效单元做增量刷新，指纹未变化时直接复用上一轮的解析结果。 */
export async function refreshWorkbuddyCache(
  prev: CacheFile,
  options: WorkbuddyRefreshOptions,
): Promise<WorkbuddyRefreshOutcome> {
  const started = Date.now()
  const found = await discoverWorkbuddy(options.root)

  const changed: SessionFileRef[] = []
  let added = 0
  let updated = 0
  for (const ref of found.values()) {
    const record = prev.scanFiles[ref.file]
    if (!record) {
      added += 1
      changed.push(ref)
      continue
    }
    if (record.status === 'error' || record.mtime_ns !== ref.mtimeNs || record.size !== ref.size) {
      updated += 1
      changed.push(ref)
    }
  }

  const gone = Object.entries(prev.scanFiles).filter(
    ([file, record]) => record.kind === 'workbuddy' && !found.has(file),
  )

  const next: CacheFile = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    meta: {
      lastRefreshMs: Date.now(),
      lastFullScanMs: prev.meta.lastFullScanMs ?? Date.now(),
    },
    workspaces: { ...prev.workspaces },
    conversations: { ...prev.conversations },
    requests: [...prev.requests],
    stats: { ...prev.stats },
    scanFiles: { ...prev.scanFiles },
  }

  for (const [file, record] of gone) {
    removeConversation(next, record.conversation_id)
    delete next.scanFiles[file]
  }

  let errors = 0
  let done = 0
  for (const ref of changed) {
    const parsed = await parseWorkbuddySession(ref)
    done += 1
    options.onProgress?.(done, changed.length)

    const record: ScanFileRecord = {
      kind: 'workbuddy',
      conversation_id: parsed?.conversation.conversation_id ?? ref.sessionId,
      mtime_ns: ref.mtimeNs,
      size: ref.size,
      parsed_at_ms: Date.now(),
      status: parsed ? 'ok' : 'error',
    }

    if (!parsed) {
      next.scanFiles[ref.file] = record
      errors += 1
      continue
    }

    // 先级联清掉旧数据（会连带删除本文件的账本），再写回账本与解析结果
    removeConversation(next, parsed.conversation.conversation_id)
    next.scanFiles[ref.file] = record
    next.conversations[parsed.conversation.conversation_id] = parsed.conversation
    for (const request of parsed.requests) next.requests.push(request)
    Object.assign(next.stats, parsed.stats)
    next.workspaces[parsed.conversation.workspace_hash] = parsed.workspace
  }

  const needed = new Set(Object.values(next.conversations).map((row) => row.workspace_hash))
  for (const hash of Object.keys(next.workspaces)) {
    if (!needed.has(hash)) delete next.workspaces[hash]
  }

  return {
    cache: next,
    result: {
      added,
      updated,
      deleted: gone.length,
      errors,
      scanned: found.size,
      duration_ms: Date.now() - started,
    },
  }
}
