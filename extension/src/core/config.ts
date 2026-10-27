/** 跨平台默认路径与路径规整。仅 Windows 路径经过实测，其余为惯例推断。 */
import * as os from 'node:os'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'

export interface PathEnv {
  [key: string]: string | undefined
}

export interface PathOverrides {
  dataRoot?: string
  workspaceStorageRoot?: string
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
  const dataRoot = expandHome(overrides.dataRoot || '', home) || defaultDataRoot(platform, env, home)
  const workspaceStorageRoot =
    expandHome(overrides.workspaceStorageRoot || '', home) ||
    defaultWorkspaceStorageRoot(platform, env, home)
  return {
    dataRoot: path.normalize(dataRoot),
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
