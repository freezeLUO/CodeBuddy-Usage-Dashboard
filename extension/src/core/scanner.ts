/**
 * 枚举会话目录并做增量指纹判定。
 *
 * 只按 `Data/<account>/VSCode/<variant>/history/<workspaceHash>/<conversationId>/index.json`
 * 逐级展开，绝不递归 walk —— 同级 `file-tree/` 存在上千条超长路径，递归会触发 Windows MAX_PATH。
 */
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import * as path from 'node:path'

const HEX_ID = /^[0-9a-f]{32}$/

export interface ConvRef {
  conversationId: string
  workspaceHash: string
  indexPath: string
  dir: string
  mtimeNs: string
  size: number
}

export interface Fingerprint {
  mtimeNs: string
  size: number
}

export function isHexId(value: string): boolean {
  return HEX_ID.test(value)
}

export async function fingerprint(target: string): Promise<Fingerprint | null> {
  try {
    const stat = await fs.stat(target, { bigint: true })
    if (!stat.isFile()) return null
    return { mtimeNs: stat.mtimeNs.toString(), size: Number(stat.size) }
  } catch {
    return null
  }
}

async function listDir(target: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(target, { withFileTypes: true })
  } catch {
    return []
  }
}

function dirs(entries: Dirent[]): string[] {
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

/** 返回 { conversationId: ConvRef }，仅包含合法 32 位 hex 的目录。 */
export async function discover(dataRoot: string): Promise<Map<string, ConvRef>> {
  const found = new Map<string, ConvRef>()
  if (!dataRoot) return found

  for (const account of dirs(await listDir(dataRoot))) {
    const accountRoot = path.join(dataRoot, account)
    for (const variant of dirs(await listDir(path.join(accountRoot, 'VSCode')))) {
      const historyRoot = path.join(accountRoot, 'VSCode', variant, 'history')
      for (const workspaceHash of dirs(await listDir(historyRoot))) {
        if (!isHexId(workspaceHash)) continue
        const workspaceRoot = path.join(historyRoot, workspaceHash)
        for (const conversationId of dirs(await listDir(workspaceRoot))) {
          if (!isHexId(conversationId)) continue
          const dir = path.join(workspaceRoot, conversationId)
          const indexPath = path.join(dir, 'index.json')
          const fp = await fingerprint(indexPath)
          if (!fp) continue
          found.set(conversationId, {
            conversationId,
            workspaceHash,
            indexPath,
            dir,
            mtimeNs: fp.mtimeNs,
            size: fp.size,
          })
        }
      }
    }
  }
  return found
}

export function messagesDir(conv: ConvRef): string {
  return path.join(conv.dir, 'messages')
}

export function messagePath(conv: ConvRef, messageId: string): string {
  return path.join(messagesDir(conv), `${messageId}.json`)
}
