/**
 * 会话解析：index.json + 最小读取集的 message 文件。
 *
 * 口径要点（与 Python 版一致，不可“优化”）：
 * - `usage.inputTokens` 是各 step 累计上下文之和，就是真实计费量；
 * - `credit === 0` 是免费模型的真实值，不能过滤；
 * - 模型名只存在于 message 文件，join 键为 `extra.requestId === requests[].id`；
 * - `extra` 与 `message` 都可能需要二次 JSON.parse。
 */
import { promises as fs } from 'node:fs'
import type { MessageInfo, ParsedConversation, ParsedRequest, StatsSnapshot } from './types'
import type { ConvRef } from './scanner'

const TITLE_RE = /<user_query>([\s\S]*?)<\/user_query>/

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 容错读取：VSCode 运行中会原地重写文件，失败就本轮跳过、下轮重试。 */
export async function readJson(file: string, retries = 2): Promise<unknown | null> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const raw = await fs.readFile(file, 'utf8')
      return JSON.parse(raw) as unknown
    } catch {
      if (attempt === retries) return null
      await sleep(50)
    }
  }
  return null
}

export function isoToMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function toInt(value: unknown): number {
  const num = toNumber(value)
  return num === null ? 0 : Math.trunc(num)
}

export function toStr(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** `extra` 永远是 JSON 字符串，需要二次 parse。 */
export function parseExtra(raw: unknown): Record<string, unknown> {
  const direct = asRecord(raw)
  if (direct) return direct
  if (typeof raw !== 'string') return {}
  try {
    return asRecord(JSON.parse(raw)) ?? {}
  } catch {
    return {}
  }
}

function collectText(node: unknown, out: string[], depth = 0): void {
  if (depth > 8) return
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, out, depth + 1)
    return
  }
  const record = asRecord(node)
  if (!record) return
  for (const key of ['text', 'content', 'value']) {
    if (key in record) collectText(record[key], out, depth + 1)
  }
}

export function extractTitle(messageRaw: unknown): string | null {
  const parts: string[] = []
  if (typeof messageRaw === 'string') {
    let parsed: unknown = messageRaw
    try {
      parsed = JSON.parse(messageRaw)
    } catch {
      parsed = messageRaw
    }
    collectText(parsed, parts)
  } else {
    collectText(messageRaw, parts)
  }

  const match = TITLE_RE.exec(parts.join('\n'))
  if (!match) return null
  const title = match[1].replace(/\s+/g, ' ').trim()
  return title ? title.slice(0, 200) : null
}

function normalPhrase(extra: Record<string, unknown>): string | null {
  const phrases = extra.inputPhrase
  if (!Array.isArray(phrases)) return null
  for (const item of phrases) {
    const record = asRecord(item)
    if (!record || record.type !== 'normal') continue
    const text = record.content ?? record.text
    if (typeof text === 'string' && text.trim()) {
      return text.replace(/\s+/g, ' ').trim().slice(0, 200)
    }
  }
  return null
}

/** 读取单个 message 文件，返回模型/用量/标题所需的最小信息。 */
export async function readMessage(file: string): Promise<MessageInfo | null> {
  const data = asRecord(await readJson(file))
  if (!data) return null
  const extra = parseExtra(data.extra)
  const rawSnapshot = asRecord(extra.statsSnapshot)
  const snapshot: StatsSnapshot | null = rawSnapshot
    ? {
        inputTokens: toNumber(rawSnapshot.inputTokens) ?? undefined,
        outputTokens: toNumber(rawSnapshot.outputTokens) ?? undefined,
        cachedInputTokens: toNumber(rawSnapshot.cachedInputTokens) ?? undefined,
        cacheWriteTokens: toNumber(rawSnapshot.cacheWriteTokens) ?? undefined,
        cacheMissTokens: toNumber(rawSnapshot.cacheMissTokens) ?? undefined,
        thinkingTokens: toNumber(rawSnapshot.thinkingTokens) ?? undefined,
        elapsedMs: toNumber(rawSnapshot.elapsedMs) ?? undefined,
        lastOutputTokens: toNumber(rawSnapshot.lastOutputTokens) ?? undefined,
        credit: toNumber(rawSnapshot.credit) ?? undefined,
      }
    : null

  return {
    messageId: toStr(data.id) ?? file.replace(/^.*[\\/]/, '').replace(/\.json$/, ''),
    role: toStr(data.role),
    createdAtMs: isoToMs(data.createdAt),
    requestId: toStr(extra.requestId),
    modelId: toStr(extra.modelId),
    modelName: toStr(extra.modelName),
    agentMessageCount: toNumber(extra.agentMessageCount),
    snapshot,
    title: extractTitle(data.message),
    inputPhrase: normalPhrase(extra),
  }
}

export interface RawIndex {
  messages: unknown[]
  requests: unknown[]
}

export async function readIndex(file: string): Promise<RawIndex | null> {
  const data = asRecord(await readJson(file))
  if (!data) return null
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    requests: Array.isArray(data.requests) ? data.requests : [],
  }
}

export function messageRoles(messages: unknown[]): Map<string, string> {
  const roles = new Map<string, string>()
  for (const item of messages) {
    const record = asRecord(item)
    const id = toStr(record?.id)
    if (!record || !id) continue
    roles.set(id, toStr(record.role) ?? '')
  }
  return roles
}

function requestMessageIds(request: Record<string, unknown>): string[] {
  const raw = request.messages
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

/** statsSnapshot 挂在请求内最后一个 assistant 消息上（末位常是 tool 结果）。 */
export function snapshotMessageId(ids: string[], roles: Map<string, string>): string | null {
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    const id = ids[index]
    if (roles.get(id) === 'assistant') return id
  }
  return ids.length ? ids[ids.length - 1] : null
}

export function isCompleteRequest(request: Record<string, unknown>): boolean {
  if (request.state !== 'complete') return false
  const usage = asRecord(request.usage)
  return !!usage && Object.keys(usage).length > 0
}

/** 最小读取集：{ messageId: 'title' | 'usage' } */
export function messageReadPlan(messages: unknown[], requests: unknown[]): Map<string, 'title' | 'usage'> {
  const plan = new Map<string, 'title' | 'usage'>()

  for (const item of messages) {
    const record = asRecord(item)
    const id = toStr(record?.id)
    if (!record || !id || record.role !== 'user') continue
    plan.set(id, 'title')
    break
  }

  const roles = messageRoles(messages)
  for (const item of requests) {
    const request = asRecord(item)
    if (!request || !isCompleteRequest(request)) continue
    const target = snapshotMessageId(requestMessageIds(request), roles)
    if (target) plan.set(target, 'usage')
  }
  return plan
}

function buildStat(
  info: MessageInfo,
  requestId: string,
  fallbackId: string | null,
): ParsedRequest['stat'] {
  const snapshot = info.snapshot
  if (!snapshot) return null
  return {
    request_id: requestId,
    message_id: info.messageId || fallbackId || '',
    stat_input_tokens: toNumber(snapshot.inputTokens),
    stat_output_tokens: toNumber(snapshot.outputTokens),
    stat_cached_input_tokens: toNumber(snapshot.cachedInputTokens),
    thinking_tokens: toNumber(snapshot.thinkingTokens),
    elapsed_ms: toNumber(snapshot.elapsedMs),
    last_output_tokens: toNumber(snapshot.lastOutputTokens),
    agent_message_count: info.agentMessageCount,
    credit: toNumber(snapshot.credit),
  }
}

export function buildConversation(
  conv: ConvRef,
  messages: unknown[],
  requests: unknown[],
  loaded: Map<string, MessageInfo>,
): ParsedConversation {
  const parsed: ParsedConversation = {
    conversationId: conv.conversationId,
    workspaceHash: conv.workspaceHash,
    title: null,
    startedAtMs: null,
    endedAtMs: null,
    messageCount: messages.length,
    requests: [],
  }

  const titleCandidates: Array<{ at: number; text: string }> = []
  const createdTimes: number[] = []
  for (const info of loaded.values()) {
    const at = info.createdAtMs ?? 0
    if (info.title) titleCandidates.push({ at, text: info.title })
    else if (info.inputPhrase) titleCandidates.push({ at, text: info.inputPhrase })
    if (info.createdAtMs) createdTimes.push(info.createdAtMs)
  }
  if (titleCandidates.length) {
    let best = titleCandidates[0]
    for (const candidate of titleCandidates) {
      if (candidate.at < best.at) best = candidate
    }
    parsed.title = best.text
  }

  const roles = messageRoles(messages)
  for (const item of requests) {
    const request = asRecord(item)
    if (!request || !isCompleteRequest(request)) continue
    const usage = asRecord(request.usage)
    if (!usage) continue
    const startedAt = toNumber(request.startedAt)
    if (startedAt === null) continue

    const requestId = String(request.id ?? '')
    const ids = requestMessageIds(request)
    const lastId = snapshotMessageId(ids, roles)
    const info = lastId ? loaded.get(lastId) : undefined
    const stat = info ? buildStat(info, requestId, lastId) : null

    if (info?.createdAtMs) createdTimes.push(info.createdAtMs)

    parsed.requests.push({
      requestId,
      startedAtMs: Math.trunc(startedAt),
      inputTokens: toInt(usage.inputTokens),
      outputTokens: toInt(usage.outputTokens),
      totalTokens: toInt(usage.totalTokens),
      cacheTokens: toInt(usage.cacheTokens),
      cachedWriteTokens: toInt(usage.cachedWriteTokens),
      cachedMissTokens: toInt(usage.cachedMissTokens),
      lastTokens: toInt(usage.lastTokens),
      credit: toNumber(usage.credit) ?? 0,
      modelId: info?.modelId ?? null,
      modelName: info?.modelName ?? null,
      messageId: lastId,
      stat,
    })
  }

  const starts = parsed.requests.map((request) => request.startedAtMs)
  const ends = parsed.requests.map((request) => request.startedAtMs)
  if (createdTimes.length) {
    starts.push(Math.min(...createdTimes))
    ends.push(Math.max(...createdTimes))
  }
  parsed.startedAtMs = starts.length ? Math.min(...starts) : null
  parsed.endedAtMs = ends.length ? Math.max(...ends) : null
  return parsed
}
