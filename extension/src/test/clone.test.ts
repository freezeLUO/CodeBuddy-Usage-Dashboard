/**
 * webview → 宿主的数据必须能被结构化克隆。
 * Vue 的 reactive 数组是 Proxy，直接 postMessage 会抛
 * `[object Array] could not be cloned`，所以所有请求体都先过 toPlain。
 */
import { describe, expect, it } from 'vitest'
import { toPlain } from '../../webview/src/shared/clone'

describe('webview 消息体', () => {
  it('reactive 代理经 toPlain 后可结构化克隆', () => {
    const reactiveLike = new Proxy(
      { workspaces: ['hash-a', 'hash-b'], models: [] as string[], startDate: null },
      {},
    )
    expect(() => structuredClone(reactiveLike)).toThrow()
    const plain = toPlain(reactiveLike)
    expect(() => structuredClone(plain)).not.toThrow()
    expect(plain).toEqual({ workspaces: ['hash-a', 'hash-b'], models: [], startDate: null })
  })

  it('缺省字段被丢弃但语义不变', () => {
    const payload = toPlain({ method: 'dashboard', filters: { workspaces: ['a'], models: [] }, granularity: undefined })
    expect(payload).toEqual({ method: 'dashboard', filters: { workspaces: ['a'], models: [] } })
    expect('granularity' in payload).toBe(false)
  })
})
