import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { UsageStore } from '../core'
import { Filters } from '../core/filters'
import {
  CONV_A,
  CONV_B,
  CONV_C,
  CONV_D,
  EXPECTED,
  createFixture,
  localMs,
  type Fixture,
} from './fixtures'

let fixture: Fixture
let store: UsageStore

beforeEach(async () => {
  fixture = await createFixture()
  store = new UsageStore({
    dataRoot: fixture.dataRoot,
    workspaceStorageRoot: fixture.workspaceStorageRoot,
    cacheFile: fixture.cacheFile,
  })
  await store.load()
  await store.refresh()
})

afterEach(async () => {
  await fixture.cleanup()
})

describe('总览', () => {
  it('只统计 complete 且有 usage 的请求', () => {
    const overview = store.overview(new Filters())
    expect(overview.request_count).toBe(EXPECTED.requests)
    expect(overview.conversation_count).toBe(EXPECTED.conversations)
    expect(overview.workspace_count).toBe(EXPECTED.workspaces)
    expect(overview.total_input_tokens).toBe(EXPECTED.input)
    expect(overview.total_output_tokens).toBe(EXPECTED.output)
    expect(overview.total_tokens).toBe(EXPECTED.total)
    expect(overview.total_credit).toBe(EXPECTED.credit)
    expect(overview.thinking_tokens).toBe(EXPECTED.thinking)
    expect(overview.avg_elapsed_ms).toBe(650)
    expect(overview.cache_hit_ratio).toBe(0.4444)
    expect(overview.date_min).toBe(localMs(0))
    expect(overview.date_max).toBe(localMs(8, 9))
  })

  it('无请求的会话仍计入会话数', () => {
    const list = store.conversations(new Filters(), { page: 1, size: 10 })
    const empty = list.items.find((item) => item.conversation_id === CONV_B)
    expect(empty?.request_count).toBe(0)
    expect(list.total).toBe(EXPECTED.conversations)
  })
})

describe('分布聚合', () => {
  it('项目按 token 排序且重名消歧', () => {
    const projects = store.projects(new Filters())
    expect(projects.map((item) => item.display_name)).toEqual([
      're-web (work)',
      're-web (Desktop)',
      '未打开工作区',
    ])
    expect(projects[0]?.requests).toBe(2)
    expect(projects[0]?.credit).toBe(4)
  })

  it('模型包含免费模型（credit=0 是真实值）', () => {
    const models = store.models(new Filters())
    const free = models.find((item) => item.model_id === 'hy3')
    expect(free?.credit).toBe(0)
    expect(free?.total_tokens).toBe(550)
    expect(models[0]?.model_id).toBe('deepseek-v4-flash')
    expect(models[0]?.cache_hit_ratio).toBe(0.5333)
  })

  it('时间序列按天/按周分桶', () => {
    const days = store.timeseries(new Filters(), 'day')
    expect(days.map((item) => item.bucket)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-12',
      '2026-01-13',
    ])
    expect(days[1]?.total_tokens).toBe(2200)
    const weeks = store.timeseries(new Filters(), 'week')
    expect(weeks.map((item) => item.bucket)).toEqual(['2026-W01', '2026-W02'])
    expect(weeks[0]?.requests).toBe(2)
    expect(weeks[1]?.total_tokens).toBe(660)
  })
})

describe('筛选', () => {
  it('按日期闭区间过滤', () => {
    const overview = store.overview(new Filters({ startDate: '2026-01-06', endDate: '2026-01-06' }))
    expect(overview.request_count).toBe(1)
    expect(overview.total_tokens).toBe(2200)
    expect(overview.conversation_count).toBe(1)
  })

  it('按项目与模型过滤', () => {
    expect(store.overview(new Filters({ workspaces: ['d:/none'] })).request_count).toBe(0)
    expect(store.overview(new Filters({ models: ['hy3'] })).total_credit).toBe(0)
    expect(store.overview(new Filters({ models: ['glm-5.3'] })).request_count).toBe(1)
    const projects = store.projects(new Filters({ models: ['hy3'] }))
    expect(projects).toHaveLength(1)
    expect(projects[0]?.display_name).toBe('re-web (Desktop)')
  })
})

describe('会话列表与明细', () => {
  it('默认按结束时间倒序并支持标题搜索', () => {
    const list = store.conversations(new Filters(), { page: 1, size: 10 })
    expect(list.items.map((item) => item.conversation_id)).toEqual([CONV_D, CONV_C, CONV_B, CONV_A])
    expect(list.items.find((item) => item.conversation_id === CONV_A)?.title).toBe('修复登录问题')
    expect(list.items.find((item) => item.conversation_id === CONV_B)?.title).toBe('整理接口文档')

    const searched = store.conversations(new Filters(), { page: 1, size: 10, q: '重命名' })
    expect(searched.total).toBe(1)
    expect(searched.items[0]?.conversation_id).toBe(CONV_C)
  })

  it('分页与排序', () => {
    const page = store.conversations(new Filters(), { page: 2, size: 2, sort: 'total_tokens', order: 'desc' })
    expect(page.total).toBe(4)
    expect(page.items).toHaveLength(2)
    expect(page.items[0]?.total_tokens).toBe(110)
  })

  it('会话明细按请求时间升序并带缓存命中率', () => {
    const detail = store.conversationDetail(new Filters(), CONV_A)
    expect(detail?.requests).toHaveLength(2)
    expect(detail?.total_tokens).toBe(3300)
    expect(detail?.credit).toBe(4)
    expect(detail?.requests[0]?.cache_hit_ratio).toBe(0.6)
    expect(detail?.requests[1]?.thinking_tokens).toBe(50)
    expect(store.conversationDetail(new Filters(), 'f'.repeat(32))).toBeNull()
  })
})

describe('增量刷新', () => {
  it('第二次刷新完全幂等', async () => {
    const result = await store.refresh()
    expect(result).toMatchObject({ added: 0, updated: 0, deleted: 0, errors: 0, scanned: 4 })
  })

  it('index 变化触发重解析，删除目录触发级联删除', async () => {
    const index = (await fixture.readIndex(CONV_C)) as Record<string, unknown>
    const requests = index.requests as Array<Record<string, unknown>>
    requests.push({
      id: 'req-c2',
      type: 'craft',
      state: 'complete',
      startedAt: localMs(7, 10),
      messages: ['c1-user', 'c1-assistant'],
      usage: {
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        cacheTokens: 0,
        cachedWriteTokens: 0,
        cachedMissTokens: 100,
        lastTokens: 100,
        credit: 0.5,
      },
    })
    await fixture.writeIndex(CONV_C, index)

    const updated = await store.refresh()
    expect(updated.updated).toBe(1)
    expect(store.overview(new Filters()).request_count).toBe(EXPECTED.requests + 1)

    await fixture.removeConversation(CONV_D)
    const deleted = await store.refresh()
    expect(deleted.deleted).toBe(1)
    expect(store.overview(new Filters()).request_count).toBe(EXPECTED.requests)
    expect(store.conversationDetail(new Filters(), CONV_D)).toBeNull()
  })

  it('message 文件损坏时保留会话并下轮重试', async () => {
    await writeFile(
      path.join(fixture.dataDirFor(CONV_C), 'messages', 'c1-assistant.json'),
      '{ broken',
      'utf8',
    )
    const index = (await fixture.readIndex(CONV_C)) as Record<string, unknown>
    await fixture.writeIndex(CONV_C, { ...index, pad: 'x' })

    const first = await store.refresh()
    expect(first.errors).toBe(0)
    const detail = store.conversationDetail(new Filters(), CONV_C)
    expect(detail?.requests).toHaveLength(1)
    expect(detail?.requests[0]?.model_id).toBeNull()

    const second = await store.refresh()
    expect(second.updated).toBe(1)
  })

  it('缓存文件可复用，无需重新解析', async () => {
    const reopened = new UsageStore({
      dataRoot: fixture.dataRoot,
      workspaceStorageRoot: fixture.workspaceStorageRoot,
      cacheFile: fixture.cacheFile,
    })
    await reopened.load()
    const overview = reopened.overview(new Filters())
    expect(overview.total_tokens).toBe(EXPECTED.total)
    expect(overview.total_credit).toBe(EXPECTED.credit)
    expect(reopened.cache.requests).toHaveLength(EXPECTED.requests)
  })
})
