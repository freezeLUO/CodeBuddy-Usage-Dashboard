/**
 * 本地预览数据与 RPC 模拟（仅开发用，不参与扩展产物构建）。
 * 打开 webview/preview/*.html 即可在没有 VSCode 的情况下检查界面。
 */
import type {
  ConversationDetail,
  ConversationList,
  ConversationRow,
  DashboardPayload,
  ModelRow,
  OptionsPayload,
  Overview,
  ProjectRow,
  SidebarPayload,
  TimePoint,
} from '../shared/types'

const DAY = 86_400_000
const END = new Date()
END.setHours(18, 0, 0, 0)
const START = new Date(END.getTime() - 41 * DAY)

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const random = seeded(20261027)

const point = (offset: number): TimePoint => {
  const date = new Date(START.getTime() + offset * DAY)
  const bucket = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const base = weekend ? 0.45 : 1
  const input = Math.round((1_100_000 + random() * 900_000) * base)
  const output = Math.round((12_000 + random() * 9_000) * base)
  return {
    bucket,
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    credit: Number(((input / 460_000) * (0.9 + random() * 0.6)).toFixed(2)),
    requests: Math.max(1, Math.round((3 + random() * 4) * base)),
  }
}

const TIMESERIES: TimePoint[] = Array.from({ length: 42 }, (_, index) => point(index))

const PROJECTS: ProjectRow[] = [
  ['d7c1f0a2b3c4d5e6f708192a3b4c5d6e', 're-web (D:)', 'd:/REV2/re-web'],
  ['a1b2c3d4e5f60718293a4b5c6d7e8f90', 'AI汇报', 'c:/Users/demo/Desktop/AI汇报'],
  ['b2c3d4e5f60718293a4b5c6d7e8f9012', 're-backend', 'd:/REV2/re-backend'],
  ['c3d4e5f60718293a4b5c6d7e8f901234', 'integration-service', 'd:/jishang/integration-service'],
  ['d4e5f60718293a4b5c6d7e8f90123456', '需求组件项目开发AI使用情况', 'c:/Users/demo/Desktop/需求组件项目开发AI使用情况'],
  ['28d397e87306b8631f3ed80d858d35f0', '未打开工作区', ''],
].map(([hash, name, path], index) => {
  const total = 28_600_000 - index * 4_350_000
  return {
    workspace_hash: hash,
    display_name: name,
    path,
    input_tokens: Math.round(total * 0.983),
    output_tokens: Math.round(total * 0.017),
    total_tokens: total,
    credit: Number((68.4 - index * 11.2).toFixed(2)),
    requests: 62 - index * 9,
    conversations: 14 - index * 2,
  }
})

const MODELS: ModelRow[] = [
  ['deepseek-v4-flash', 'DeepSeek-V4-Flash', 24_800_000, 92, 146.2, 0.964],
  ['deepseek-v4.1-flash', 'DeepSeek-V4.1-Flash', 21_300_000, 78, 112.8, 0.918],
  ['glm-5.3-flash', 'GLM-5.3-Flash', 3_100_000, 24, 8.4, 0.876],
  ['hy3', 'Hy3', 2_450_000, 19, 0, 0.734],
  ['deepseek-v4-pro', 'DeepSeek-V4-Pro', 1_820_000, 13, 6.9, 0.812],
].map(([id, name, total, requests, credit, hit]) => ({
  model_id: id as string,
  model_name: name as string,
  input_tokens: Math.round((total as number) * 0.985),
  output_tokens: Math.round((total as number) * 0.015),
  total_tokens: total as number,
  credit: Number(credit),
  requests: requests as number,
  cache_hit_ratio: hit as number,
}))

const OVERVIEW: Overview = {
  total_input_tokens: 70_724_644,
  total_output_tokens: 850_057,
  total_tokens: 71_574_701,
  total_credit: 170.09,
  request_count: 168,
  conversation_count: 40,
  workspace_count: 6,
  cache_hit_ratio: 0.1886,
  thinking_tokens: 184_320,
  avg_elapsed_ms: 7420.5,
  date_min: START.getTime() + 3 * DAY,
  date_max: END.getTime(),
}

const TITLES = [
  '把用量看板做成 VSCode 侧边栏插件',
  '修复登录接口 500 问题',
  '整理接口文档并补充示例',
  '批量重命名组件目录',
  '排查构建产物过大的原因',
  '给会话列表加上搜索和分页',
  '分析缓存命中率下降的原因',
  '把 Python 解析逻辑迁移到 TypeScript',
]

const CONVERSATIONS: ConversationRow[] = Array.from({ length: 26 }, (_, index) => {
  const project = PROJECTS[index % PROJECTS.length]
  const ended = END.getTime() - index * 6 * 3_600_000
  const total = Math.round(2_400_000 / (index * 0.32 + 1))
  return {
    conversation_id: `${(index + 11).toString(16).padStart(2, '0')}${'ab3f9c2d4e5f60718293a4b5c6d7e8f9'.slice(0, 30)}`,
    title: TITLES[index % TITLES.length],
    workspace_hash: project.workspace_hash,
    display_name: project.display_name,
    path: project.path,
    started_at_ms: ended - 3 * 3_600_000,
    ended_at_ms: ended,
    request_count: 3 + (index % 6),
    message_count: 18 + (index % 12),
    total_tokens: total,
    input_tokens: Math.round(total * 0.98),
    output_tokens: Math.round(total * 0.02),
    credit: Number((total / 460_000).toFixed(2)),
    models: [MODELS[index % MODELS.length].model_id, MODELS[(index + 2) % MODELS.length].model_id],
  }
})

const CONVERSATION_LIST: ConversationList = {
  total: CONVERSATIONS.length,
  page: 1,
  size: 20,
  items: CONVERSATIONS.slice(0, 20),
}

const DETAIL: ConversationDetail = {
  conversation_id: CONVERSATIONS[0].conversation_id,
  title: CONVERSATIONS[0].title,
  workspace_hash: CONVERSATIONS[0].workspace_hash,
  display_name: CONVERSATIONS[0].display_name,
  path: CONVERSATIONS[0].path,
  started_at_ms: CONVERSATIONS[0].started_at_ms,
  ended_at_ms: CONVERSATIONS[0].ended_at_ms,
  request_count: 4,
  message_count: 24,
  total_tokens: 2_486_400,
  credit: 5.41,
  requests: Array.from({ length: 4 }, (_, index) => {
    const input = 580_000 + index * 132_000
    return {
      request_id: `req-${index}`,
      started_at_ms: (CONVERSATIONS[0].started_at_ms ?? 0) + index * 900_000,
      model_id: index % 2 ? 'deepseek-v4.1-flash' : 'deepseek-v4-flash',
      model_name: index % 2 ? 'DeepSeek-V4.1-Flash' : 'DeepSeek-V4-Flash',
      input_tokens: input,
      output_tokens: 8_400 + index * 1_200,
      total_tokens: input + 8_400 + index * 1_200,
      cache_tokens: Math.round(input * 0.93),
      cached_miss_tokens: Math.round(input * 0.07),
      last_tokens: 132_400 + index * 8_000,
      credit: Number((1.2 + index * 0.18).toFixed(2)),
      thinking_tokens: index === 1 ? 18_400 : 0,
      elapsed_ms: 5_400 + index * 900,
      agent_message_count: 6 + index,
      cache_hit_ratio: 0.93,
    }
  }),
}

const OPTIONS: OptionsPayload = {
  projects: PROJECTS,
  models: MODELS,
  date_min: OVERVIEW.date_min,
  date_max: OVERVIEW.date_max,
}

const SIDEBAR: SidebarPayload = {
  overview: OVERVIEW,
  timeseries: TIMESERIES,
  projects: PROJECTS.slice(0, 5),
  models: MODELS.slice(0, 5),
  recent: CONVERSATIONS.slice(0, 5),
  meta: {
    last_refresh_ms: END.getTime(),
    cache_path: 'C:/Users/demo/AppData/Roaming/Code/User/globalStorage/codebuddy-usage/usage-cache.json',
    data_root: 'C:/Users/demo/AppData/Local/CodeBuddyExtension/Data',
    data_root_exists: true,
    provider: 'codebuddy',
    workspace_count: 6,
    conversation_count: 40,
    request_count: 168,
  },
}

const DASHBOARD: DashboardPayload = {
  overview: OVERVIEW,
  timeseries: TIMESERIES,
  projects: PROJECTS,
  models: MODELS,
  meta: SIDEBAR.meta,
}

const RESULTS: Record<string, unknown> = {
  sidebar: SIDEBAR,
  dashboard: DASHBOARD,
  overview: OVERVIEW,
  timeseries: { items: TIMESERIES },
  projects: { items: PROJECTS },
  models: { items: MODELS },
  options: OPTIONS,
  meta: SIDEBAR.meta,
  conversations: CONVERSATION_LIST,
  conversationDetail: DETAIL,
}

export function installMockBridge(): void {
  const api = {
    postMessage(message: unknown): void {
      const data = message as {
        id?: number
        type?: string
        payload?: { method?: string; provider?: string }
      }
      if (data?.type === 'query') {
        const method = data.payload?.method ?? ''
        const result = RESULTS[method] ?? null
        window.setTimeout(() => {
          window.postMessage({ id: data.id, type: 'result', data: result }, '*')
        }, 20)
        return
      }
      if (data?.type === 'refresh') {
        window.setTimeout(() => {
          window.postMessage(
            { id: data.id, type: 'result', data: { added: 0, updated: 2, deleted: 0, errors: 0, scanned: 40, duration_ms: 268 } },
            '*',
          )
          window.postMessage(
            { type: 'event', event: 'refreshed', data: { added: 0, updated: 2, deleted: 0, errors: 0, scanned: 40, duration_ms: 268 } },
            '*',
          )
        }, 320)
        return
      }
      if (data?.type === 'setProvider') {
        const provider = data.payload?.provider === 'workbuddy' ? 'workbuddy' : 'codebuddy'
        window.setTimeout(() => {
          window.postMessage({ id: data.id, type: 'result', data: { provider } }, '*')
        }, 200)
        return
      }
      if (data?.type === 'openDashboard' || data?.type === 'openSettings' || data?.type === 'copyText') {
        window.setTimeout(() => window.postMessage({ id: data.id, type: 'result', data: null }, '*'), 10)
      }
    },
    getState: () => undefined,
    setState: () => undefined,
  }
  ;(globalThis as unknown as { acquireVsCodeApi: () => typeof api }).acquireVsCodeApi = () => api
}
