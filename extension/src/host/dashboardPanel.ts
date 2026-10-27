import * as vscode from 'vscode'
import { handleMessage, postEvent, type HostActions, type IncomingMessage } from './bus'
import type { Logger } from './logger'
import { loadAssets, renderHtml } from './webviewHtml'

export class DashboardPanel implements vscode.Disposable {
  static readonly viewType = 'codebuddyUsage.dashboard'

  private static current: DashboardPanel | undefined

  static get isVisible(): boolean {
    return DashboardPanel.current?.panel.visible ?? false
  }

  static broadcast(event: string, data?: unknown): void {
    DashboardPanel.current?.postEvent(event, data)
  }

  static show(
    extensionUri: vscode.Uri,
    actions: HostActions,
    logger: Logger,
    options: { conversationId?: string } = {},
  ): DashboardPanel {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(vscode.ViewColumn.Active, false)
      DashboardPanel.current.navigate(options.conversationId)
      return DashboardPanel.current
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      'CodeBuddy 用量看板',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
      },
    )
    DashboardPanel.current = new DashboardPanel(panel, extensionUri, actions, logger, options.conversationId)
    return DashboardPanel.current
  }

  private webviewReady = false
  private pendingConversationId: string | undefined

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly actions: HostActions,
    private readonly logger: Logger,
    conversationId?: string,
  ) {
    this.pendingConversationId = conversationId
    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'icon.png')
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
    }
    this.panel.onDidDispose(() => {
      DashboardPanel.current = undefined
    })
    this.panel.onDidChangeViewState(() => {
      if (this.panel.visible) this.actions.refreshIfStale?.()
    })
    void this.render()
  }

  private get post(): (message: unknown) => void {
    return (message) => {
      void this.panel.webview.postMessage(message)
    }
  }

  private async render(): Promise<void> {
    const assets = await loadAssets(this.extensionUri, 'dashboard')
    this.panel.webview.html = renderHtml(this.panel.webview, 'dashboard', assets)

    const messageListener = this.panel.webview.onDidReceiveMessage((message: IncomingMessage) => {
      if (message?.type === 'ready') {
        this.webviewReady = true
        this.flushNavigation()
      }
      void handleMessage(message, this.actions, this.post, this.logger, 'dashboard')
    })
    this.panel.onDidDispose(() => messageListener.dispose())
  }

  navigate(conversationId?: string): void {
    if (!conversationId) {
      this.panel.reveal(vscode.ViewColumn.Active, false)
      return
    }
    this.pendingConversationId = conversationId
    this.panel.reveal(vscode.ViewColumn.Active, false)
    this.flushNavigation()
  }

  private flushNavigation(): void {
    if (!this.webviewReady || !this.pendingConversationId) return
    postEvent(this.post, 'navigate', { conversationId: this.pendingConversationId })
    this.pendingConversationId = undefined
  }

  postEvent(event: string, data?: unknown): void {
    postEvent(this.post, event, data)
  }

  dispose(): void {
    this.panel.dispose()
    DashboardPanel.current = undefined
  }
}
