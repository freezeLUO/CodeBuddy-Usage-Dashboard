import * as vscode from 'vscode'
import { PROVIDER_LABELS, isDirectory, normalizeProvider, resolvePaths } from './core/config'
import { errorText } from './core'
import { DashboardPanel } from './host/dashboardPanel'
import { createLogger } from './host/logger'
import { UsageService } from './host/service'
import { SidebarProvider } from './host/sidebarProvider'
import type { HostActions } from './host/bus'

let service: UsageService | undefined
let sidebar: SidebarProvider | undefined
let dashboard: DashboardPanel | undefined

export function activate(context: vscode.ExtensionContext): void {
  const logger = createLogger()
  context.subscriptions.push(logger)

  const usage = new UsageService(context, logger, () =>
    Boolean(sidebar?.visible || DashboardPanel.isVisible),
  )
  service = usage

  const actions: HostActions = {
    getStore: () => usage.store,
    waitReady: () => usage.whenReady,
    refresh: () => usage.refresh(),
    refreshIfStale: () => void usage.refreshIfStale(),
    setProvider: async (provider) => {
      try {
        await usage.setProvider(provider)
        DashboardPanel.setTitle(`${PROVIDER_LABELS[provider]} 用量看板`)
      } catch (error) {
        logger.error(`切换数据源失败：${errorText(error)}`)
        void vscode.window.showErrorMessage(`切换数据源失败：${errorText(error)}`)
      }
    },
    openDashboard: (options) => {
      dashboard = DashboardPanel.show(context.extensionUri, actions, logger, options)
    },
    openSettings: () => {
      void vscode.commands.executeCommand('workbench.action.openSettings', 'codebuddyUsage')
    },
    revealDataRoot: () => void revealDataRoot(logger),
    copyText: async (text) => {
      await vscode.env.clipboard.writeText(text)
      vscode.window.setStatusBarMessage('已复制到剪贴板', 2000)
    },
  }

  const provider = new SidebarProvider(context.extensionUri, actions, logger, () => {
    void usage.refreshIfStale()
  })
  sidebar = provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('codebuddyUsage.refresh', async () => {
      try {
        const result = await usage.refresh()
        void vscode.window.showInformationMessage(
          `用量已刷新：新增 ${result.added} / 更新 ${result.updated} / 删除 ${result.deleted}（${result.duration_ms}ms）`,
        )
      } catch (error) {
        logger.error(`手动刷新失败：${errorText(error)}`)
      }
    }),
    vscode.commands.registerCommand('codebuddyUsage.openDashboard', () => {
      dashboard = DashboardPanel.show(context.extensionUri, actions, logger)
    }),
    vscode.commands.registerCommand('codebuddyUsage.openSettings', () => {
      void vscode.commands.executeCommand('workbench.action.openSettings', 'codebuddyUsage')
    }),
    vscode.commands.registerCommand('codebuddyUsage.revealDataRoot', () => revealDataRoot(logger)),
  )

  context.subscriptions.push(
    usage.onDidRefresh((result) => {
      const payload = { ...result }
      sidebar?.postEvent('refreshed', payload)
      DashboardPanel.broadcast('refreshed', payload)
    }),
    usage.onDidProgress((progress) => {
      sidebar?.postEvent('progress', progress)
      DashboardPanel.broadcast('progress', progress)
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      sidebar?.postEvent('theme')
      DashboardPanel.broadcast('theme')
    }),
  )

  logger.info('CodeBuddy 用量看板已激活')
}

async function revealDataRoot(logger: ReturnType<typeof createLogger>): Promise<void> {
  const settings = vscode.workspace.getConfiguration('codebuddyUsage')
  const provider = normalizeProvider(settings.get<string>('provider', 'codebuddy'))
  const paths = resolvePaths({
    dataRoot: settings.get<string>('dataRoot', ''),
    workspaceStorageRoot: settings.get<string>('workspaceStorageRoot', ''),
    workbuddyRoot: settings.get<string>('workbuddyRoot', ''),
    provider,
  })
  const label = PROVIDER_LABELS[provider]
  if (!(await isDirectory(paths.dataRoot))) {
    logger.warn(`${label} 数据目录不存在：${paths.dataRoot}`)
    const choice = await vscode.window.showWarningMessage(
      `未找到 ${label} 数据目录：${paths.dataRoot}`,
      '打开设置',
    )
    if (choice === '打开设置') {
      const key = provider === 'workbuddy' ? 'codebuddyUsage.workbuddyRoot' : 'codebuddyUsage.dataRoot'
      await vscode.commands.executeCommand('workbench.action.openSettings', key)
    }
    return
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(paths.dataRoot))
}

export function deactivate(): void {
  dashboard?.dispose()
  dashboard = undefined
  sidebar?.dispose()
  sidebar = undefined
  service?.dispose()
  service = undefined
}
