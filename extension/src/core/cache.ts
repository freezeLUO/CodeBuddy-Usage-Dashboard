/** JSON 缓存：等价于 Python 版的 6 张 SQLite 表，写入用 tmp + rename 保证原子性。 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type {
  CacheFile,
  ConversationRecord,
  MessageStatRecord,
  RequestRecord,
  ScanFileRecord,
  WorkspaceRecord,
} from './types'

export const CACHE_SCHEMA_VERSION = 1

export function emptyCache(): CacheFile {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    meta: { lastRefreshMs: null, lastFullScanMs: null },
    workspaces: {},
    conversations: {},
    requests: [],
    stats: {},
    scanFiles: {},
  }
}

function recordOf<T>(value: unknown): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, T>
}

function normalize(raw: unknown): CacheFile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  if (data.schemaVersion !== CACHE_SCHEMA_VERSION) return null

  const meta = (data.meta ?? {}) as Record<string, unknown>
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    meta: {
      lastRefreshMs: typeof meta.lastRefreshMs === 'number' ? meta.lastRefreshMs : null,
      lastFullScanMs: typeof meta.lastFullScanMs === 'number' ? meta.lastFullScanMs : null,
    },
    workspaces: recordOf<WorkspaceRecord>(data.workspaces),
    conversations: recordOf<ConversationRecord>(data.conversations),
    requests: Array.isArray(data.requests)
      ? (data.requests as unknown[]).filter((item): item is RequestRecord => {
          if (!item || typeof item !== 'object') return false
          const row = item as Record<string, unknown>
          return typeof row.request_id === 'string' && typeof row.conversation_id === 'string'
        })
      : [],
    stats: recordOf<MessageStatRecord>(data.stats),
    scanFiles: recordOf<ScanFileRecord>(data.scanFiles),
  }
}

export async function loadCache(file: string): Promise<CacheFile | null> {
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as unknown
    return normalize(raw)
  } catch {
    return null
  }
}

export async function saveCache(file: string, cache: CacheFile): Promise<void> {
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`)
  const payload = JSON.stringify(cache)
  await fs.writeFile(tmp, payload, 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch {
    // Windows 下目标被占用时 rename 可能失败，退化为覆盖写并清理临时文件
    await fs.copyFile(tmp, file)
    await fs.unlink(tmp).catch(() => undefined)
  }
}
