/** Webview 与宿主之间的唯一契约。 */
import type * as vscode from 'vscode'
import type { UsageStore } from '../core'
import { errorText } from '../core'
import { Filters } from '../core/filters'
import type { ConversationQuery, RefreshResult } from '../core/types'
import type { Logger } from './logger'
import type { ViewKind } from './webviewHtml'

export interface HostActions {
  refresh(): Promise<RefreshResult>
  refreshIfStale(): void
  waitReady(): Promise<void>
  openDashboard(options?: { conversationId?: string }): void
  openSettings(): void
  revealDataRoot(): void
  copyText(text: string): Promise<void>
  getStore(): UsageStore
}

export interface IncomingMessage {
  id?: number
  type?: string
  payload?: Record<string, unknown>
}

export type Post = (message: unknown) => void

export function postEvent(post: Post, event: string, data?: unknown): void {
  post({ type: 'event', event, data })
}

function asFilters(payload: Record<string, unknown> | undefined): Filters {
  const raw = payload?.filters
  if (!raw || typeof raw !== 'object') return new Filters()
  const input = raw as Record<string, unknown>
  const toList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return new Filters({
    startDate: typeof input.startDate === 'string' ? input.startDate : null,
    endDate: typeof input.endDate === 'string' ? input.endDate : null,
    workspaces: toList(input.workspaces),
    models: toList(input.models),
  })
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

async function runQuery(
  method: string,
  payload: Record<string, unknown>,
  store: UsageStore,
): Promise<unknown> {
  const filters = asFilters(payload)
  const granularity = payload.granularity === 'week' ? 'week' : 'day'

  switch (method) {
    case 'sidebar':
      return store.sidebar(filters)
    case 'dashboard':
      return store.dashboard(filters, granularity)
    case 'overview':
      return store.overview(filters)
    case 'timeseries':
      return { items: store.timeseries(filters, granularity) }
    case 'projects':
      return { items: store.projects(filters) }
    case 'models':
      return { items: store.models(filters) }
    case 'options':
      return store.options()
    case 'meta':
      return store.meta()
    case 'conversations': {
      const query: ConversationQuery = {
        page: asNumber(payload.page, 1),
        size: asNumber(payload.size, 20),
        q: asString(payload.q) ?? null,
        sort: (asString(payload.sort) as ConversationQuery['sort']) ?? 'ended_at_ms',
        order: payload.order === 'asc' ? 'asc' : 'desc',
      }
      return store.conversations(filters, query)
    }
    case 'conversationDetail': {
      const conversationId = asString(payload.conversationId)
      if (!conversationId) throw new Error('缺少会话 ID')
      const detail = store.conversationDetail(filters, conversationId)
      if (!detail) throw new Error('会话不存在或已被删除')
      return detail
    }
    default:
      throw new Error(`未知的查询方法：${method}`)
  }
}

export async function handleMessage(
  message: IncomingMessage,
  actions: HostActions,
  post: Post,
  logger: Logger,
  view: ViewKind,
): Promise<void> {
  const id = typeof message.id === 'number' ? message.id : undefined
  const type = typeof message.type === 'string' ? message.type : ''
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {}

  try {
    switch (type) {
      case 'ready': {
        await actions.waitReady()
        postEvent(post, 'ready', { view })
        return
      }
      case 'query': {
        await actions.waitReady()
        const method = asString(payload.method) ?? ''
        const data = await runQuery(method, payload, actions.getStore())
        post({ id, type: 'result', data })
        return
      }
      case 'refresh': {
        const result = await actions.refresh()
        post({ id, type: 'result', data: result })
        return
      }
      case 'openDashboard': {
        actions.openDashboard({ conversationId: asString(payload.conversationId) })
        post({ id, type: 'result', data: null })
        return
      }
      case 'openSettings': {
        actions.openSettings()
        post({ id, type: 'result', data: null })
        return
      }
      case 'revealDataRoot': {
        actions.revealDataRoot()
        post({ id, type: 'result', data: null })
        return
      }
      case 'copyText': {
        const text = asString(payload.text) ?? ''
        if (text) await actions.copyText(text)
        post({ id, type: 'result', data: null })
        return
      }
      default:
        throw new Error(`未知的请求类型：${type}`)
    }
  } catch (error) {
    const messageText = errorText(error)
    logger.warn(`[${view}] ${type} 失败：${messageText}`)
    post({ id, type: 'error', message: messageText })
  }
}
