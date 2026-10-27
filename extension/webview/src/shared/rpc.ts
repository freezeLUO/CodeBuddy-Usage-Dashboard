/** 与扩展宿主通信的唯一通道：Promise 化的 query + 事件订阅。 */
import type { RefreshResult } from './types'

const api = acquireVsCodeApi()

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: number
}

const pending = new Map<number, Pending>()
const handlers = new Map<string, Set<(data: unknown) => void>>()
let sequence = 0

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as
    | { id?: number; type?: string; data?: unknown; message?: string; event?: string }
    | undefined
  if (!message || typeof message !== 'object') return

  if (typeof message.id === 'number') {
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    window.clearTimeout(entry.timer)
    if (message.type === 'error') entry.reject(new Error(message.message || '请求失败'))
    else entry.resolve(message.data)
    return
  }

  if (message.type === 'event' && typeof message.event === 'string') {
    for (const handler of handlers.get(message.event) ?? []) handler(message.data)
  }
})

function send<T>(message: Record<string, unknown>, timeoutMs = 20_000): Promise<T> {
  const id = ++sequence
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('与扩展通信超时，请尝试重新加载窗口'))
    }, timeoutMs)
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
    api.postMessage({ ...message, id })
  })
}

export function request<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  return send<T>({ type: 'query', payload: { method, ...payload } })
}

export function requestRefresh(): Promise<RefreshResult> {
  return send<RefreshResult>({ type: 'refresh' }, 120_000)
}

export function openDashboard(conversationId?: string): Promise<void> {
  return send<void>({ type: 'openDashboard', payload: { conversationId } })
}

export function openSettings(): Promise<void> {
  return send<void>({ type: 'openSettings' })
}

export function revealDataRoot(): Promise<void> {
  return send<void>({ type: 'revealDataRoot' })
}

export function copyText(text: string): Promise<void> {
  return send<void>({ type: 'copyText', payload: { text } })
}

export function notifyReady(): void {
  api.postMessage({ type: 'ready' })
}

export function on(event: string, handler: (data: unknown) => void): () => void {
  const bucket = handlers.get(event) ?? new Set()
  bucket.add(handler)
  handlers.set(event, bucket)
  return () => {
    bucket.delete(handler)
  }
}

export function getState<T>(): T | undefined {
  return api.getState() as T | undefined
}

export function setState(state: unknown): void {
  api.setState(state)
}
