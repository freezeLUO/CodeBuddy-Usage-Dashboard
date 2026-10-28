/** 扩展侧服务：管理 UsageStore 生命周期、刷新调度与状态栏。 */
import * as path from 'node:path'
import * as vscode from 'vscode'
import { UsageStore, errorText } from '../core'
import { PROVIDER_LABELS, normalizeProvider, resolvePaths } from '../core/config'
import type { Provider, RefreshResult } from '../core/types'
import type { Logger } from './logger'

const CONFIG_ROOT = 'codebuddyUsage'

export interface ProgressPayload {
  done: number
  total: number
}

export class UsageService implements vscode.Disposable {
  private storeValue: UsageStore
  private readyPromise: Promise<void>
  private timer: NodeJS.Timeout | undefined
  private disposed = false
  private lastProgressAt = 0
  private storeSignature = ''
  private rebuildPromise: Promise<void> | null = null
  private readonly refreshEmitter = new vscode.EventEmitter<RefreshResult>()
  private readonly progressEmitter = new vscode.EventEmitter<ProgressPayload>()
  private readonly configListener: vscode.Disposable
  private readonly statusBar: vscode.StatusBarItem

  readonly onDidRefresh = this.refreshEmitter.event
  readonly onDidProgress = this.progressEmitter.event

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
    private readonly shouldAutoRefresh: () => boolean,
  ) {
    this.storeSignature = this.readSignature()
    this.storeValue = this.createStore()
    this.readyPromise = this.bootstrap()
    this.configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_ROOT)) void this.onConfigChange()
    })
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 88)
    this.statusBar.command = 'codebuddyUsage.openDashboard'
    this.updateStatusBar()
    this.schedule()
  }

  get store(): UsageStore {
    return this.storeValue
  }

  get whenReady(): Promise<void> {
    return this.readyPromise
  }

  private readProvider(): Provider {
    const settings = vscode.workspace.getConfiguration(CONFIG_ROOT)
    return normalizeProvider(settings.get<string>('provider', 'codebuddy'))
  }

  private readSignature(): string {
    const settings = vscode.workspace.getConfiguration(CONFIG_ROOT)
    return [
      normalizeProvider(settings.get<string>('provider', 'codebuddy')),
      settings.get<string>('dataRoot', ''),
      settings.get<string>('workbuddyRoot', ''),
      settings.get<string>('workspaceStorageRoot', ''),
    ].join('|')
  }

  private createStore(): UsageStore {
    const settings = vscode.workspace.getConfiguration(CONFIG_ROOT)
    const provider = normalizeProvider(settings.get<string>('provider', 'codebuddy'))
    const paths = resolvePaths({
      dataRoot: settings.get<string>('dataRoot', ''),
      workspaceStorageRoot: settings.get<string>('workspaceStorageRoot', ''),
      workbuddyRoot: settings.get<string>('workbuddyRoot', ''),
      provider,
    })
    return new UsageStore({
      dataRoot: paths.dataRoot,
      workspaceStorageRoot: paths.workspaceStorageRoot,
      provider,
      // 两个数据源结构完全不同，各留一份缓存，切换时互不覆盖
      cacheFile: path.join(
        this.context.globalStorageUri.fsPath,
        provider === 'workbuddy' ? 'usage-cache-workbuddy.json' : 'usage-cache.json',
      ),
      log: (message, level = 'info') => this.logger[level](message),
    })
  }

  /** 切换数据源：写入设置 → 重建 Store → 重新扫描。返回后即可查询新数据源。 */
  async setProvider(provider: Provider): Promise<void> {
    if (this.storeValue.provider === provider) return
    const settings = vscode.workspace.getConfiguration(CONFIG_ROOT)
    await settings.update('provider', provider, vscode.ConfigurationTarget.Global)
    await this.ensureRebuild()
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.storeValue.load()
      this.updateStatusBar()
      // 每次激活都做一次增量刷新：先渲染缓存，再在后台对齐磁盘最新数据
      await this.refresh(false)
    } catch (error) {
      this.logger.error(`初始化失败：${errorText(error)}`)
    }
  }

  async refresh(notifyError = true): Promise<RefreshResult> {
    if (this.disposed) throw new Error('扩展已停用')
    this.lastProgressAt = 0
    this.progressEmitter.fire({ done: 0, total: 0 })
    try {
      const result = await this.storeValue.refresh((done, total) => {
        const now = Date.now()
        if (done < total && now - this.lastProgressAt < 120) return
        this.lastProgressAt = now
        this.progressEmitter.fire({ done, total })
      })
      this.updateStatusBar()
      this.refreshEmitter.fire(result)
      // 复位进度，避免定时刷新后进度条停在 100%
      this.progressEmitter.fire({ done: 0, total: 0 })
      return result
    } catch (error) {
      this.updateStatusBar()
      if (notifyError) {
        const label = PROVIDER_LABELS[this.storeValue.provider]
        void vscode.window.showErrorMessage(`${label} 用量刷新失败：${errorText(error)}`)
      }
      throw error
    }
  }

  async refreshIfStale(): Promise<void> {
    const minutes = vscode.workspace.getConfiguration(CONFIG_ROOT).get<number>('staleMinutes', 2)
    if (!this.storeValue.isStale(minutes)) return
    try {
      await this.refresh(false)
    } catch {
      // 静默刷新失败时保留旧数据，UI 通过 last_refresh_ms 体现
    }
  }

  private async onConfigChange(): Promise<void> {
    if (this.readSignature() === this.storeSignature) return
    await this.ensureRebuild()
  }

  private ensureRebuild(): Promise<void> {
    if (!this.rebuildPromise) {
      this.rebuildPromise = this.rebuild().finally(() => {
        this.rebuildPromise = null
      })
    }
    return this.rebuildPromise
  }

  private async rebuild(): Promise<void> {
    const provider = this.readProvider()
    this.logger.info(`数据源切换为 ${PROVIDER_LABELS[provider]}，重建数据源`)
    this.storeSignature = this.readSignature()
    this.storeValue = this.createStore()
    this.readyPromise = (async () => {
      await this.storeValue.load()
      this.updateStatusBar()
      await this.refresh(false).catch(() => undefined)
    })()
    this.schedule()
    await this.readyPromise
  }

  private schedule(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    const minutes = vscode.workspace.getConfiguration(CONFIG_ROOT).get<number>('autoRefreshMinutes', 5)
    if (!minutes || minutes <= 0) return
    this.timer = setInterval(() => {
      if (this.disposed || !this.shouldAutoRefresh()) return
      void this.refresh(false).catch(() => undefined)
    }, Math.max(1, minutes) * 60_000)
  }

  private updateStatusBar(): void {
    const settings = vscode.workspace.getConfiguration(CONFIG_ROOT)
    if (!settings.get<boolean>('showStatusBar', true)) {
      this.statusBar.hide()
      return
    }
    const credit = this.storeValue.todayCredit()
    const last = this.storeValue.lastRefreshMs
    const label = PROVIDER_LABELS[this.storeValue.provider]
    this.statusBar.text = `$(graph) ${label} 今日 ${credit.toFixed(2)} 积分`
    const tooltip = new vscode.MarkdownString()
    tooltip.appendMarkdown(`**${label} 用量**\n\n`)
    tooltip.appendMarkdown(`今日积分：${credit.toFixed(2)}\n\n`)
    tooltip.appendMarkdown(`上次同步：${last ? new Date(last).toLocaleString('zh-CN') : '尚未同步'}\n\n`)
    tooltip.appendMarkdown('点击打开完整看板')
    this.statusBar.tooltip = tooltip
    this.statusBar.show()
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.configListener.dispose()
    this.statusBar.dispose()
    this.refreshEmitter.dispose()
    this.progressEmitter.dispose()
  }
}
