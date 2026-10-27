/**
 * 在临时目录里合成一份 CodeBuddy 数据目录，覆盖以下边界：
 * running 请求、缺 usage 的请求、缺 elapsedMs、非法 JSON 的 message、
 * 非法目录名、无工作区会话、重名项目、免费模型 credit=0。
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { hashForPath, NO_WORKSPACE_HASH } from '../core/resolver'

export const WS_A_PATH = 'd:/work/re-web'
export const WS_B_PATH = 'c:/Desktop/re-web'
export const WS_A = hashForPath(WS_A_PATH)
export const WS_B = hashForPath(WS_B_PATH)

export const CONV_A = 'a'.repeat(32)
export const CONV_B = 'b'.repeat(32)
export const CONV_C = 'c'.repeat(32)
export const CONV_D = 'd'.repeat(32)

const BASE = new Date(2026, 0, 5, 10, 0, 0).getTime()
const DAY = 86_400_000

export function localMs(dayOffset: number, hour = 10): number {
  const date = new Date(BASE)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, 0, 0, 0)
  return date.getTime()
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

interface MessageSpec {
  id: string
  role: 'user' | 'assistant' | 'tool'
  createdAt: number
  modelId?: string
  modelName?: string
  requestId?: string
  snapshot?: Record<string, number>
  title?: string
  inputPhrase?: string
  broken?: boolean
}

interface RequestSpec {
  id: string
  state: 'complete' | 'running'
  startedAt?: number
  messageIds: string[]
  usage?: Record<string, number>
}

interface ConversationSpec {
  id: string
  workspaceHash: string
  account?: string
  variant?: string
  messages: MessageSpec[]
  requests: RequestSpec[]
}

function messageFile(spec: MessageSpec): string {
  if (spec.broken) return '{ this is not json'
  const extra: Record<string, unknown> = {
    requestId: spec.requestId ?? '',
    modelId: spec.modelId ?? 'deepseek-v4-flash',
    modelName: spec.modelName ?? 'DeepSeek-V4-Flash',
    isHelperMessage: false,
  }
  if (spec.snapshot) extra.statsSnapshot = spec.snapshot
  if (spec.inputPhrase) extra.inputPhrase = [{ type: 'normal', content: spec.inputPhrase }]

  const text = spec.title
    ? JSON.stringify({
        role: 'user',
        content: [{ type: 'text', text: `<user_query>${spec.title}</user_query>` }],
      })
    : JSON.stringify({ role: spec.role, content: [{ type: 'text', text: '普通消息' }] })

  return JSON.stringify({
    id: spec.id,
    role: spec.role,
    message: text,
    extra: JSON.stringify(extra),
    createdAt: iso(spec.createdAt),
  })
}

function indexFile(spec: ConversationSpec): string {
  return JSON.stringify({
    messages: spec.messages.map((message) => ({
      id: message.id,
      type: 'text',
      role: message.role,
      isComplete: true,
    })),
    requests: spec.requests.map((request) => ({
      id: request.id,
      type: 'craft',
      state: request.state,
      startedAt: request.startedAt,
      messages: request.messageIds,
      usage: request.usage,
    })),
    current: '',
  })
}

const USAGE = (input: number, output: number, cache: number, miss: number, last: number, credit: number) => ({
  inputTokens: input,
  outputTokens: output,
  totalTokens: input + output,
  cacheTokens: cache,
  cachedWriteTokens: 0,
  cachedMissTokens: miss,
  lastTokens: last,
  credit,
})

const CONVERSATIONS: ConversationSpec[] = [
  {
    id: CONV_A,
    workspaceHash: WS_A,
    messages: [
      { id: 'a1-user', role: 'user', createdAt: localMs(0, 9), title: '修复登录问题' },
      {
        id: 'a1-assistant',
        role: 'assistant',
        createdAt: localMs(0, 10),
        requestId: 'req-a1',
        modelId: 'deepseek-v4-flash',
        modelName: 'DeepSeek-V4-Flash',
        snapshot: { inputTokens: 1000, outputTokens: 100, cachedInputTokens: 600, thinkingTokens: 0, elapsedMs: 900 },
      },
      { id: 'a1-tool', role: 'tool', createdAt: localMs(0, 10), requestId: 'req-a1' },
      {
        id: 'a2-assistant',
        role: 'assistant',
        createdAt: localMs(1, 10),
        requestId: 'req-a2',
        modelId: 'deepseek-v4-flash',
        modelName: 'DeepSeek-V4-Flash',
        snapshot: { inputTokens: 2000, outputTokens: 200, cachedInputTokens: 1000, thinkingTokens: 50, elapsedMs: 1200 },
      },
      { id: 'a2-tool', role: 'tool', createdAt: localMs(1, 10), requestId: 'req-a2' },
      { id: 'a3-broken', role: 'tool', createdAt: localMs(1, 11), broken: true },
    ],
    requests: [
      { id: 'req-a1', state: 'complete', startedAt: localMs(0), messageIds: ['a1-user', 'a1-assistant', 'a1-tool'], usage: USAGE(1000, 100, 600, 400, 800, 1.5) },
      { id: 'req-a2', state: 'complete', startedAt: localMs(1), messageIds: ['a1-user', 'a2-assistant', 'a2-tool'], usage: USAGE(2000, 200, 1000, 1000, 1500, 2.5) },
    ],
  },
  {
    id: CONV_B,
    workspaceHash: WS_A,
    messages: [
      { id: 'b1-user', role: 'user', createdAt: localMs(2, 9), inputPhrase: '整理接口文档' },
      { id: 'b2-assistant', role: 'assistant', createdAt: localMs(2, 9), requestId: 'req-b1' },
    ],
    requests: [
      { id: 'req-b1', state: 'running', messageIds: ['b1-user', 'b2-assistant'] },
      { id: 'req-b2', state: 'complete', startedAt: localMs(2), messageIds: ['b1-user'], usage: {} },
    ],
  },
  {
    id: CONV_C,
    workspaceHash: WS_B,
    messages: [
      { id: 'c1-user', role: 'user', createdAt: localMs(7, 8), title: '批量重命名' },
      {
        id: 'c1-assistant',
        role: 'assistant',
        createdAt: localMs(7, 9),
        requestId: 'req-c1',
        modelId: 'hy3',
        modelName: 'Hy3',
        snapshot: { inputTokens: 500, outputTokens: 50, cachedInputTokens: 0, elapsedMs: 300 },
      },
    ],
    requests: [
      { id: 'req-c1', state: 'complete', startedAt: localMs(7, 9), messageIds: ['c1-user', 'c1-assistant'], usage: USAGE(500, 50, 0, 0, 500, 0) },
    ],
  },
  {
    id: CONV_D,
    workspaceHash: NO_WORKSPACE_HASH,
    account: 'default',
    variant: 'Lw==',
    messages: [
      { id: 'd1-user', role: 'user', createdAt: localMs(8, 8), title: '无工作区会话' },
      {
        id: 'd1-assistant',
        role: 'assistant',
        createdAt: localMs(8, 9),
        requestId: 'req-d1',
        modelId: 'glm-5.3',
        modelName: 'GLM-5.3',
        snapshot: { inputTokens: 100, outputTokens: 10, elapsedMs: 200 },
      },
    ],
    requests: [
      { id: 'req-d1', state: 'complete', startedAt: localMs(8, 9), messageIds: ['d1-user', 'd1-assistant'], usage: USAGE(100, 10, 0, 0, 100, 0.25) },
    ],
  },
]

export interface Fixture {
  root: string
  dataRoot: string
  workspaceStorageRoot: string
  cacheFile: string
  cleanup: () => Promise<void>
  readIndex: (conversationId: string) => Promise<Record<string, unknown>>
  writeIndex: (conversationId: string, value: unknown) => Promise<void>
  removeConversation: (conversationId: string) => Promise<void>
  dataDirFor: (conversationId: string) => string
}

function conversationDir(spec: ConversationSpec): string {
  return path.join(
    spec.account ?? 'acct-1',
    'VSCode',
    spec.variant ?? 'Lw==',
    'history',
    spec.workspaceHash,
    spec.id,
  )
}

export async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'codebuddy-usage-fixture-'))
  const dataRoot = path.join(root, 'Data')
  const workspaceStorageRoot = path.join(root, 'workspaceStorage')

  for (const spec of CONVERSATIONS) {
    const dir = path.join(dataRoot, conversationDir(spec))
    await mkdir(path.join(dir, 'messages'), { recursive: true })
    await writeFile(path.join(dir, 'index.json'), indexFile(spec), 'utf8')
    for (const message of spec.messages) {
      await writeFile(path.join(dir, 'messages', `${message.id}.json`), messageFile(message), 'utf8')
    }
  }

  // 非法目录名必须被忽略
  const invalidDir = path.join(dataRoot, 'acct-1', 'VSCode', 'Lw==', 'history', WS_A, 'not-a-hex')
  await mkdir(path.join(invalidDir, 'messages'), { recursive: true })
  await writeFile(path.join(invalidDir, 'index.json'), JSON.stringify({ messages: [], requests: [] }), 'utf8')

  // 项目路径反查：两个同名项目，用于验证父目录消歧
  await mkdir(path.join(workspaceStorageRoot, 'ws-a'), { recursive: true })
  await writeFile(
    path.join(workspaceStorageRoot, 'ws-a', 'workspace.json'),
    JSON.stringify({ folder: 'file:///d%3A/work/re-web' }),
    'utf8',
  )
  await mkdir(path.join(workspaceStorageRoot, 'ws-b'), { recursive: true })
  await writeFile(
    path.join(workspaceStorageRoot, 'ws-b', 'workspace.json'),
    JSON.stringify({ folder: 'file:///c%3A/Desktop/re-web' }),
    'utf8',
  )

  const dirFor = (conversationId: string): string => {
    const spec = CONVERSATIONS.find((item) => item.id === conversationId)
    if (!spec) throw new Error(`fixture 中不存在会话 ${conversationId}`)
    return path.join(dataRoot, conversationDir(spec))
  }

  return {
    root,
    dataRoot,
    workspaceStorageRoot,
    cacheFile: path.join(root, 'cache.json'),
    cleanup: () => rm(root, { recursive: true, force: true }),
    readIndex: async (conversationId) =>
      JSON.parse(await readFile(path.join(dirFor(conversationId), 'index.json'), 'utf8')),
    writeIndex: async (conversationId, value) => {
      await writeFile(path.join(dirFor(conversationId), 'index.json'), JSON.stringify(value), 'utf8')
    },
    removeConversation: (conversationId) => rm(dirFor(conversationId), { recursive: true, force: true }),
    dataDirFor: dirFor,
  }
}

export const EXPECTED = {
  requests: 4,
  conversations: 4,
  workspaces: 3,
  input: 3600,
  output: 360,
  total: 3960,
  credit: 4.25,
  thinking: 50,
}
