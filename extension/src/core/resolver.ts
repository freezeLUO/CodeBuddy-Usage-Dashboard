/**
 * workspaceHash -> 项目路径映射。
 *
 * hash = md5(utf8(path))，其中 path 把 "/" 换成 "\\"、盘符小写、去掉前导反斜杠；
 * 无工作区窗口（没有打开文件夹）时 hash = md5("\\")。
 */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { WorkspaceRecord } from './types'
import { asRecord, toStr } from './parser'

export const NO_WORKSPACE_NAME = '未打开工作区'

export function hashForPath(input: string): string {
  let value = (input || '').replace(/\//g, '\\')
  if (value.length > 1 && value[1] === ':') {
    value = value[0].toLowerCase() + value.slice(1)
  }
  if (value.startsWith('\\') && !(value.length > 1 && value[1] === ':')) {
    value = value.replace(/^\\+/, '') || '\\'
  }
  return createHash('md5').update(Buffer.from(value, 'utf8')).digest('hex')
}

export const NO_WORKSPACE_HASH = hashForPath('\\')

function basenameOf(target: string): string {
  if (!target) return ''
  const parts = target.split(/[\\/]+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

function parentOf(target: string): string {
  if (!target) return ''
  const normalized = target.replace(/[\\/]+/g, '/')
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '' : basenameOf(normalized.slice(0, index))
}

export function displayNameOf(target: string): string {
  if (!target) return NO_WORKSPACE_NAME
  return basenameOf(target) || target
}

/** 反向索引：读取 workspaceStorage/<hash>/workspace.json 的 folder URI。 */
export async function readWorkspaceStorage(root: string): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  if (!root) return found
  let entries: string[] = []
  try {
    entries = await fs.readdir(root)
  } catch {
    return found
  }

  for (const entry of entries) {
    const file = path.join(root, entry, 'workspace.json')
    try {
      const data = asRecord(JSON.parse(await fs.readFile(file, 'utf8')))
      const folder = toStr(data?.folder)
      if (!folder) continue
      const decoded = decodeURIComponent(folder.replace(/^file:\/\/\//, ''))
      found.set(hashForPath(decoded), decoded)
    } catch {
      // 单个 workspace.json 损坏不影响整体解析
    }
  }
  return found
}

/**
 * 为需要展示的 hash 解析项目路径与显示名。
 * display_name 冲突时追加父目录消歧（如 `re-web (D:)`），所有图表仍以 hash 为 key。
 */
export async function resolveWorkspaces(
  needed: Set<string>,
  storageRoot: string,
): Promise<Map<string, WorkspaceRecord>> {
  const paths = await readWorkspaceStorage(storageRoot)
  const result = new Map<string, WorkspaceRecord>()

  for (const hash of needed) {
    const known = paths.get(hash)
    if (known !== undefined) {
      result.set(hash, { path: known, display_name: displayNameOf(known), source: 'storage' })
      continue
    }
    if (hash === NO_WORKSPACE_HASH) {
      result.set(hash, { path: '', display_name: NO_WORKSPACE_NAME, source: 'unknown' })
      continue
    }
    result.set(hash, {
      path: `unknown/${hash}`,
      display_name: `未知项目 ${hash.slice(0, 8)}`,
      source: 'unknown',
    })
  }

  const counts = new Map<string, number>()
  for (const item of result.values()) {
    counts.set(item.display_name, (counts.get(item.display_name) ?? 0) + 1)
  }
  for (const [hash, item] of result) {
    if ((counts.get(item.display_name) ?? 0) > 1) {
      const parent = parentOf(item.path)
      if (parent) result.set(hash, { ...item, display_name: `${item.display_name} (${parent})` })
    }
  }

  return result
}
