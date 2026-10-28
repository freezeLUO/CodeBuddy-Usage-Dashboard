/** 跨平台默认路径与路径规整。仅 Windows 路径经过实测，其余为惯例推断。 */
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Provider } from './types'

/** 支持的数据源。两个产品的本地落盘结构完全不同，由各自的采集器分别解析。 */
export type { Provider }

export const PROVIDERS: Provider[] = ['codebuddy', 'workbuddy']

export const PROVIDER_LABELS: Record<Provider, string> = {
  codebuddy: 'CodeBuddy',
  workbuddy: 'WorkBuddy',
}

export function normalizeProvider(value: unknown): Provider {
  return value === 'workbuddy' ? 'workbuddy' : 'codebuddy'
}

export interface PathEnv {
  [key: string]: string | undefined
}

export interface PathOverrides {
  dataRoot?: string
  workspaceStorageRoot?: string
  workbuddyRoot?: string
  provider?: Provider
}

export function expandHome(input: string, home = os.homedir()): string {
  const value = (input || '').trim()
  if (!value) return ''
  if (value === '~') return home
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(home, value.slice(2))
  }
  return value
}

export function defaultDataRoot(
  platform: string = process.platform,
  env: PathEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    return path.join(base, 'CodeBuddyExtension', 'Data')
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'CodeBuddyExtension', 'Data')
  }
  const base = env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(base, 'CodeBuddyExtension', 'Data')
}

/**
 * WorkBuddy 的数据根目录：默认 `~/.workbuddy`，可用 `WORKBUDDY_HOME` 覆盖。
 * 目录内包含 `projects/<工作区>/<会话>.jsonl`（逐次模型调用）与 `traces/`（30 天轨迹）。
 */
export function defaultWorkbuddyRoot(
  _platform: string = process.platform,
  env: PathEnv = process.env,
  home: string = os.homedir(),
): string {
  const override = expandHome(env.WORKBUDDY_HOME || '', home)
  if (override) return path.normalize(override)
  return path.join(home, '.workbuddy')
}

export function defaultWorkspaceStorageRoot(
  platform: string = process.platform,
  env: PathEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === 'win32') {
    const base = env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return path.join(base, 'Code', 'User', 'workspaceStorage')
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage')
  }
  const base = env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(base, 'Code', 'User', 'workspaceStorage')
}

export function resolvePaths(
  overrides: PathOverrides = {},
  platform: string = process.platform,
  env: PathEnv = process.env,
  home: string = os.homedir(),
): { dataRoot: string; workspaceStorageRoot: string } {
  const provider = overrides.provider ?? 'codebuddy'
  const configured =
    provider === 'workbuddy'
      ? expandHome(overrides.workbuddyRoot || '', home) || defaultWorkbuddyRoot(platform, env, home)
      : expandHome(overrides.dataRoot || '', home) || defaultDataRoot(platform, env, home)
  const workspaceStorageRoot =
    expandHome(overrides.workspaceStorageRoot || '', home) ||
    defaultWorkspaceStorageRoot(platform, env, home)
  return {
    dataRoot: path.normalize(configured),
    workspaceStorageRoot: path.normalize(workspaceStorageRoot),
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target)
    return stat.isDirectory()
  } catch {
    return false
  }
}
