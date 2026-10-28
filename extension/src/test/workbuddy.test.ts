/**
 * WorkBuddy 采集器：合成一份 `~/.workbuddy` 结构，校验口径、标题回退与增量幂等。
 * 本机存在真实 `~/.workbuddy` 时额外做一次恒等式自检（缺失自动跳过）。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { UsageStore } from '../core'
import { Filters } from '../core/filters'
import { isDirectory } from '../core/config'

const SESSION_A = 'a'.repeat(32)
const SESSION_B = 'b'.repeat(32)
const SESSION_C = 'c'.repeat(32)
const WS_ONE = 'c:\\Users\\demo\\WorkBuddy\\proj-one'
const WS_TWO = 'd:/work/proj-two'

const BASE = new Date(2026, 9, 1, 10, 0, 0).getTime()
const DAY = 86_400_000

interface CallSpec {
  id: string
  sessionId: string
  at: number
  model: string
  modelName: string
  input: number
  output: number
  cache: number
  credit: number
  thinking: number
  cwd?: string
}

function callLine(spec: CallSpec): string {
  return JSON.stringify({
    id: spec.id,
    sessionId: spec.sessionId,
    timestamp: spec.at,
    type: 'function_call',
    cwd: spec.cwd,
    providerData: {
      messageId: `msg-${spec.id}`,
      model: spec.model,
      requestModelId: spec.model,
      requestModelName: spec.modelName,
      traceId: spec.id,
      conversationRequestId: `conv-${spec.id}`,
      rawUsage: {
        prompt_tokens: spec.input,
        completion_tokens: spec.output,
        total_tokens: spec.input + spec.output,
        prompt_cache_hit_tokens: spec.cache,
        prompt_cache_miss_tokens: spec.input - spec.cache,
        prompt_cache_write_tokens: 0,
        completion_thinking_tokens: spec.thinking,
        credit: spec.credit,
      },
    },
  })
}

function messageLine(sessionId: string, at: number, text: string, cwd?: string): string {
  return JSON.stringify({
    id: `user-${sessionId}`,
    sessionId,
    timestamp: at,
    type: 'message',
    role: 'user',
    cwd,
    content: [{ type: 'input_text', text }],
  })
}

function titleLine(sessionId: string, at: number, title: string): string {
  return JSON.stringify({ sessionId, timestamp: at, type: 'aiTitle', aiTitle: title })
}

interface WorkbuddyFixture {
  root: string
  cacheFile: string
  cleanup: () => Promise<void>
  sessionFile: (workspace: string, sessionId: string) => string
}

async function createFixture(): Promise<WorkbuddyFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workbuddy-usage-fixture-'))
  const one = path.join(root, 'projects', 'c-Users-demo-WorkBuddy-proj-one')
  const two = path.join(root, 'projects', 'd-work-proj-two')
  await mkdir(one, { recursive: true })
  await mkdir(two, { recursive: true })

  await writeFile(
    path.join(one, `${SESSION_A}.jsonl`),
    [
      titleLine(SESSION_A, BASE, '分析股价走势'),
      messageLine(SESSION_A, BASE, '用户想分析「合肥长鑫」的股价走势。', WS_ONE),
      callLine({
        id: 'call-a1',
        sessionId: SESSION_A,
        at: BASE,
        model: 'deepseek-v4.1-flash',
        modelName: 'Deepseek-V4.1-Flash',
        input: 1000,
        output: 100,
        cache: 600,
        credit: 1.5,
        thinking: 40,
        cwd: WS_ONE,
      }),
      callLine({
        id: 'call-a2',
        sessionId: SESSION_A,
        at: BASE + DAY,
        model: 'deepseek-v4.1-flash',
        modelName: 'Deepseek-V4.1-Flash',
        input: 2000,
        output: 200,
        cache: 1000,
        credit: 2.5,
        thinking: 60,
        cwd: WS_ONE,
      }),
    ].join('\n'),
    'utf8',
  )

  await writeFile(
    path.join(one, `${SESSION_B}.jsonl`),
    [
      messageLine(
        SESSION_B,
        BASE,
        '<system-reminder data-role="user-context">上下文</system-reminder>推荐稳健的纯债基金',
        WS_ONE,
      ),
      callLine({
        id: 'call-b1',
        sessionId: SESSION_B,
        at: BASE + 2 * DAY,
        model: 'hy3',
        modelName: 'Hy3',
        input: 500,
        output: 50,
        cache: 0,
        credit: 0,
        thinking: 0,
        cwd: WS_ONE,
      }),
    ].join('\n'),
    'utf8',
  )

  await writeFile(
    path.join(two, `${SESSION_C}.jsonl`),
    [
      callLine({
        id: 'call-c1',
        sessionId: SESSION_C,
        at: BASE + 3 * DAY,
        model: 'glm-5.3',
        modelName: 'GLM-5.3',
        input: 100,
        output: 10,
        cache: 0,
        credit: 0.25,
        thinking: 0,
        cwd: WS_TWO,
      }),
    ].join('\n'),
    'utf8',
  )

  return {
    root,
    cacheFile: path.join(root, 'cache.json'),
    cleanup: () => rm(root, { recursive: true, force: true }),
    sessionFile: (workspace, sessionId) => path.join(root, 'projects', workspace, `${sessionId}.jsonl`),
  }
}

let fixture: WorkbuddyFixture
let store: UsageStore

beforeEach(async () => {
  fixture = await createFixture()
  store = new UsageStore({
    dataRoot: fixture.root,
    workspaceStorageRoot: path.join(fixture.root, 'nope'),
    cacheFile: fixture.cacheFile,
    provider: 'workbuddy',
  })
  await store.load()
  await store.refresh()
})

afterEach(async () => {
  await fixture.cleanup()
})

describe('WorkBuddy 采集', () => {
  it('按逐次模型调用统计 token 与积分', () => {
    const overview = store.overview(new Filters())
    expect(overview.request_count).toBe(4)
    expect(overview.conversation_count).toBe(3)
    expect(overview.workspace_count).toBe(2)
    expect(overview.total_input_tokens).toBe(3600)
    expect(overview.total_output_tokens).toBe(360)
    expect(overview.total_tokens).toBe(3960)
    expect(overview.total_credit).toBe(4.25)
    expect(overview.thinking_tokens).toBe(100)
    expect(overview.cache_hit_ratio).toBe(0.4444)
    expect(overview.date_min).toBe(BASE)
    expect(overview.date_max).toBe(BASE + 3 * DAY)
  })

  it('标题优先 aiTitle，缺失时回退到首条用户提问并清理系统上下文', () => {
    const list = store.conversations(new Filters(), { page: 1, size: 10 })
    const byId = new Map(list.items.map((item) => [item.conversation_id, item]))
    expect(byId.get(SESSION_A)?.title).toBe('分析股价走势')
    expect(byId.get(SESSION_B)?.title).toBe('推荐稳健的纯债基金')
    expect(byId.get(SESSION_C)?.title).toBeNull()
  })

  it('项目名取自 jsonl 的 cwd', () => {
    const projects = store.projects(new Filters()).map((item) => item.display_name)
    expect(projects).toEqual(['proj-one', 'proj-two'])
  })

  it('模型按调用聚合，免费模型 credit=0 保留', () => {
    const models = store.models(new Filters())
    const hy3 = models.find((item) => item.model_id === 'hy3')
    expect(hy3?.credit).toBe(0)
    expect(hy3?.total_tokens).toBe(550)
    expect(models[0]?.model_id).toBe('deepseek-v4.1-flash')
  })

  it('会话明细按请求时间升序', () => {
    const detail = store.conversationDetail(new Filters(), SESSION_A)
    expect(detail?.requests).toHaveLength(2)
    expect(detail?.requests[0]?.request_id).toBe('call-a1')
    expect(detail?.requests[0]?.thinking_tokens).toBe(40)
    expect(detail?.total_tokens).toBe(3300)
  })

  it('第二次刷新幂等，文件变化后只重解析该会话', async () => {
    const second = await store.refresh()
    expect(second).toMatchObject({ added: 0, updated: 0, deleted: 0, errors: 0, scanned: 3 })

    await appendFile(
      fixture.sessionFile('c-Users-demo-WorkBuddy-proj-one', SESSION_A),
      `\n${callLine({
        id: 'call-a3',
        sessionId: SESSION_A,
        at: BASE + 4 * DAY,
        model: 'deepseek-v4.1-flash',
        modelName: 'Deepseek-V4.1-Flash',
        input: 100,
        output: 10,
        cache: 0,
        credit: 0.5,
        thinking: 0,
        cwd: WS_ONE,
      })}`,
      'utf8',
    )

    const third = await store.refresh()
    expect(third.updated).toBe(1)
    expect(store.overview(new Filters()).request_count).toBe(5)
    expect(store.conversationDetail(new Filters(), SESSION_A)?.requests).toHaveLength(3)
  })

  it('缓存文件可复用，meta 反映当前数据源', async () => {
    const reopened = new UsageStore({
      dataRoot: fixture.root,
      workspaceStorageRoot: path.join(fixture.root, 'nope'),
      cacheFile: fixture.cacheFile,
      provider: 'workbuddy',
    })
    await reopened.load()
    expect(reopened.overview(new Filters()).total_credit).toBe(4.25)
    expect(reopened.meta().provider).toBe('workbuddy')
    expect(reopened.meta().data_root).toBe(path.normalize(fixture.root))
  })
})

describe('WorkBuddy 本机真实数据', () => {
  it('解析出的 token 恒等式成立', async () => {
    const root = process.env.WORKBUDDY_HOME || path.join(os.homedir(), '.workbuddy')
    if (!(await isDirectory(root))) {
      console.warn(`[跳过] 未找到 WorkBuddy 数据目录：${root}`)
      return
    }

    const cacheFile = path.join(os.tmpdir(), `workbuddy-usage-selfcheck-${process.pid}.json`)
    const real = new UsageStore({
      dataRoot: root,
      workspaceStorageRoot: path.join(root, 'nope'),
      cacheFile,
      provider: 'workbuddy',
    })
    await real.load()
    const first = await real.refresh()
    const overview = real.overview(new Filters())
    console.log(
      `[WorkBuddy] 扫描 ${first.scanned} / 新增 ${first.added} / 更新 ${first.updated} / 删除 ${first.deleted} / 错误 ${first.errors} / ${first.duration_ms}ms`,
    )
    console.log(
      `[WorkBuddy] input=${overview.total_input_tokens} output=${overview.total_output_tokens} ` +
        `credit=${overview.total_credit} requests=${overview.request_count} conversations=${overview.conversation_count}`,
    )
    expect(overview.total_tokens).toBe(overview.total_input_tokens + overview.total_output_tokens)
    expect(real.cache.requests.length).toBe(overview.request_count)

    const second = await real.refresh()
    expect(second.added).toBe(0)
    expect(second.updated).toBe(0)
    expect(second.deleted).toBe(0)
    await rm(cacheFile, { force: true })
  }, 120_000)
})
