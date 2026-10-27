/** 增量刷新编排：以 conversation 为失效单元。 */
import type { CacheFile, MessageInfo, ParsedConversation, RefreshResult, ScanFileRecord } from './types'
import { discover, fingerprint, messagePath, type ConvRef } from './scanner'
import { buildConversation, messageReadPlan, readIndex, readMessage } from './parser'
import { resolveWorkspaces } from './resolver'
import { CACHE_SCHEMA_VERSION } from './cache'

const DEFAULT_CONCURRENCY = 6

export interface RefreshOptions {
  dataRoot: string
  workspaceStorageRoot: string
  concurrency?: number
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
}

export interface RefreshOutcome {
  cache: CacheFile
  result: RefreshResult
}

interface ParseOutcome {
  conv: ConvRef
  parsed: ParsedConversation | null
  scanFiles: Record<string, ScanFileRecord>
}

async function parseOne(conv: ConvRef): Promise<ParseOutcome> {
  const index = await readIndex(conv.indexPath)
  if (!index) return { conv, parsed: null, scanFiles: {} }

  const now = Date.now()
  const scanFiles: Record<string, ScanFileRecord> = {
    [conv.indexPath]: {
      kind: 'index',
      conversation_id: conv.conversationId,
      mtime_ns: conv.mtimeNs,
      size: conv.size,
      parsed_at_ms: now,
      status: 'ok',
    },
  }

  const loaded = new Map<string, MessageInfo>()
  for (const messageId of messageReadPlan(index.messages, index.requests).keys()) {
    const file = messagePath(conv, messageId)
    const fp = await fingerprint(file)
    if (!fp) continue
    const info = await readMessage(file)
    if (!info) {
      // 解析失败也记账（status=error），下一轮会被判定为需要重解析
      scanFiles[file] = {
        kind: 'message',
        conversation_id: conv.conversationId,
        mtime_ns: fp.mtimeNs,
        size: fp.size,
        parsed_at_ms: now,
        status: 'error',
      }
      continue
    }
    loaded.set(messageId, info)
    scanFiles[file] = {
      kind: 'message',
      conversation_id: conv.conversationId,
      mtime_ns: fp.mtimeNs,
      size: fp.size,
      parsed_at_ms: now,
      status: 'ok',
    }
  }

  return {
    conv,
    parsed: buildConversation(conv, index.messages, index.requests, loaded),
    scanFiles,
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  let done = 0
  const size = Math.max(1, Math.min(limit, items.length || 1))

  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index])
      done += 1
      onProgress?.(done, items.length)
    }
  })
  await Promise.all(runners)
  return results
}

function removeConversation(cache: CacheFile, conversationId: string): void {
  delete cache.conversations[conversationId]
  const removedRequests = new Set<string>()
  cache.requests = cache.requests.filter((request) => {
    if (request.conversation_id !== conversationId) return true
    removedRequests.add(request.request_id)
    return false
  })
  for (const requestId of removedRequests) delete cache.stats[requestId]
  for (const [file, record] of Object.entries(cache.scanFiles)) {
    if (record.conversation_id === conversationId) delete cache.scanFiles[file]
  }
}

export async function refreshCache(prev: CacheFile, options: RefreshOptions): Promise<RefreshOutcome> {
  const started = Date.now()
  const found = await discover(options.dataRoot)

  const messageRecordsByConversation = new Map<string, Array<[string, ScanFileRecord]>>()
  for (const [file, record] of Object.entries(prev.scanFiles)) {
    if (record.kind !== 'message') continue
    const bucket = messageRecordsByConversation.get(record.conversation_id)
    if (bucket) bucket.push([file, record])
    else messageRecordsByConversation.set(record.conversation_id, [[file, record]])
  }

  const toParse: ConvRef[] = []
  let added = 0
  let updated = 0

  for (const conv of found.values()) {
    const record = prev.scanFiles[conv.indexPath]
    if (!record) {
      added += 1
      toParse.push(conv)
      continue
    }
    if (record.status === 'error' || record.mtime_ns !== conv.mtimeNs || record.size !== conv.size) {
      updated += 1
      toParse.push(conv)
      continue
    }
    let changed = false
    for (const [file, messageRecord] of messageRecordsByConversation.get(conv.conversationId) ?? []) {
      if (messageRecord.status === 'error') {
        changed = true
        break
      }
      const fp = await fingerprint(file)
      if (!fp || fp.mtimeNs !== messageRecord.mtime_ns || fp.size !== messageRecord.size) {
        changed = true
        break
      }
    }
    if (changed) {
      updated += 1
      toParse.push(conv)
    }
  }

  const deletedIds = Object.keys(prev.conversations).filter((id) => !found.has(id))

  const outcomes = await mapLimit(
    toParse,
    options.concurrency ?? DEFAULT_CONCURRENCY,
    async (conv) => (options.signal?.aborted ? { conv, parsed: null, scanFiles: {} } : parseOne(conv)),
    options.onProgress,
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

  for (const conversationId of deletedIds) removeConversation(next, conversationId)

  let errors = 0
  for (const outcome of outcomes) {
    if (!outcome.parsed) {
      errors += 1
      continue
    }
    const parsed = outcome.parsed
    removeConversation(next, parsed.conversationId)
    next.conversations[parsed.conversationId] = {
      conversation_id: parsed.conversationId,
      workspace_hash: parsed.workspaceHash,
      title: parsed.title,
      started_at_ms: parsed.startedAtMs,
      ended_at_ms: parsed.endedAtMs,
      request_count: parsed.requests.length,
      message_count: parsed.messageCount,
    }
    for (const request of parsed.requests) {
      next.requests.push({
        request_id: request.requestId,
        conversation_id: parsed.conversationId,
        started_at_ms: request.startedAtMs,
        model_id: request.modelId,
        model_name: request.modelName,
        input_tokens: request.inputTokens,
        output_tokens: request.outputTokens,
        total_tokens: request.totalTokens,
        cache_tokens: request.cacheTokens,
        cached_write_tokens: request.cachedWriteTokens,
        cached_miss_tokens: request.cachedMissTokens,
        last_tokens: request.lastTokens,
        credit: request.credit,
      })
      if (request.stat) next.stats[request.requestId] = request.stat
    }
    Object.assign(next.scanFiles, outcome.scanFiles)
  }

  const needed = new Set([...found.values()].map((conv) => conv.workspaceHash))
  next.workspaces = Object.fromEntries(await resolveWorkspaces(needed, options.workspaceStorageRoot))

  return {
    cache: next,
    result: {
      added,
      updated,
      deleted: deletedIds.length,
      errors,
      scanned: found.size,
      duration_ms: Date.now() - started,
    },
  }
}
