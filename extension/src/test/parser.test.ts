import { describe, expect, it } from 'vitest'
import { hashForPath, NO_WORKSPACE_HASH, resolveWorkspaces } from '../core/resolver'
import {
  extractTitle,
  messageReadPlan,
  messageRoles,
  parseExtra,
  snapshotMessageId,
} from '../core/parser'
import { dayBucket, weekBucket } from '../core/queries'
import { createFixture, WS_A, WS_A_PATH, WS_B, WS_B_PATH } from './fixtures'

describe('workspaceHash 推导', () => {
  it('无工作区 hash 与文档一致', () => {
    expect(NO_WORKSPACE_HASH).toBe('28d397e87306b8631f3ed80d858d35f0')
    expect(hashForPath('\\')).toBe(NO_WORKSPACE_HASH)
  })

  it('盘符小写、分隔符归一后得到稳定 md5', () => {
    expect(hashForPath('d:/work/re-web')).toBe('ecc15790578f1ccbc7e28a4684ae52c6')
    expect(hashForPath('D:\\work\\re-web')).toBe(hashForPath('d:/work/re-web'))
    expect(hashForPath('/d:/work/re-web')).toBe(hashForPath('d:/work/re-web'))
  })

  it('重名项目追加父目录消歧', async () => {
    const fixture = await createFixture()
    try {
      const resolved = await resolveWorkspaces(
        new Set([WS_A, WS_B, NO_WORKSPACE_HASH]),
        fixture.workspaceStorageRoot,
      )
      expect(resolved.get(WS_A)?.path).toBe(WS_A_PATH)
      expect(resolved.get(WS_B)?.path).toBe(WS_B_PATH)
      expect(resolved.get(WS_A)?.display_name).toBe('re-web (work)')
      expect(resolved.get(WS_B)?.display_name).toBe('re-web (Desktop)')
      expect(resolved.get(NO_WORKSPACE_HASH)?.display_name).toBe('未打开工作区')
    } finally {
      await fixture.cleanup()
    }
  })
})

describe('消息解析', () => {
  it('从 <user_query> 抽取标题并压缩空白', () => {
    const message = JSON.stringify({
      role: 'user',
      content: [{ type: 'text', text: '<user_query>  修复\n 登录  问题 </user_query> 其他内容' }],
    })
    expect(extractTitle(message)).toBe('修复 登录 问题')
  })

  it('没有 user_query 时返回 null，交给 inputPhrase 兜底', () => {
    expect(extractTitle(JSON.stringify({ role: 'user', content: [{ text: '你好' }] }))).toBeNull()
    expect(extractTitle(undefined)).toBeNull()
  })

  it('extra 支持字符串与对象两种形态', () => {
    expect(parseExtra('{"modelId":"hy3"}')).toEqual({ modelId: 'hy3' })
    expect(parseExtra({ requestId: 'r1' })).toEqual({ requestId: 'r1' })
    expect(parseExtra('{bad json')).toEqual({})
    expect(parseExtra(null)).toEqual({})
  })

  it('最小读取集只取首个 user 与每个请求最后一个 assistant', () => {
    const messages = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 't1', role: 'tool' },
      { id: 'a2', role: 'assistant' },
    ]
    const requests = [
      { id: 'r1', state: 'complete', messages: ['u1', 'a1', 't1'], usage: { inputTokens: 1 } },
      { id: 'r2', state: 'running', messages: ['u1', 'a2'] },
    ]
    const plan = messageReadPlan(messages, requests)
    expect([...plan.entries()]).toEqual([
      ['u1', 'title'],
      ['a1', 'usage'],
    ])
    expect(snapshotMessageId(['u1', 'a1', 't1'], messageRoles(messages))).toBe('a1')
    expect(snapshotMessageId(['u1', 'a1', 't1', 'a2'], messageRoles(messages))).toBe('a2')
  })
})

describe('时间分桶', () => {
  it('按天使用本地时区', () => {
    const ms = new Date(2026, 0, 5, 23, 30).getTime()
    expect(dayBucket(ms)).toBe('2026-01-05')
  })

  it('按周对齐 strftime %W（周一为一周起点）', () => {
    expect(weekBucket(new Date(2026, 0, 1, 12).getTime())).toBe('2026-W00')
    expect(weekBucket(new Date(2026, 0, 5, 12).getTime())).toBe('2026-W01')
    expect(weekBucket(new Date(2026, 0, 12, 12).getTime())).toBe('2026-W02')
  })
})
