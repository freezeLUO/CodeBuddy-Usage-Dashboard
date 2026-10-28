/** 数据源展示常量。webview 运行在浏览器环境，不能引用 core/config（依赖 node:fs）。 */
import type { Provider } from './types'

export const PROVIDER_OPTIONS: Array<{ value: Provider; label: string }> = [
  { value: 'codebuddy', label: 'CodeBuddy' },
  { value: 'workbuddy', label: 'WorkBuddy' },
]

export const PROVIDER_LABELS: Record<Provider, string> = {
  codebuddy: 'CodeBuddy',
  workbuddy: 'WorkBuddy',
}

export function normalizeProvider(value: unknown): Provider {
  return value === 'workbuddy' ? 'workbuddy' : 'codebuddy'
}
