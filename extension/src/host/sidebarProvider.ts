import * as vscode from 'vscode'
import { handleMessage, postEvent, type HostActions } from './bus'
import type { Logger } from './logger'
import { loadAssets, renderHtml } from './webviewHtml'

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = 'codebuddyUsage.sidebar'

  private view: vscode.WebviewView | undefined

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly actions: HostActions,
    private readonly logger: Logger,
    private readonly onBecameVisible: () => void,
  ) {}

  get visible(): boolean {
    return this.view?.visible ?? false
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    }
    view.webview.html = renderHtml(view.webview, 'sidebar', await loadAssets(this.extensionUri, 'sidebar'))

    const post = (message: unknown): void => {
      void view.webview.postMessage(message)
    }
    const messageListener = view.webview.onDidReceiveMessage((message) => {
      void handleMessage(message, this.actions, post, this.logger, 'sidebar')
    })
    const visibilityListener = view.onDidChangeVisibility(() => {
      this.onBecameVisible()
      if (view.visible) postEvent(post, 'visible')
    })
    const disposeListener = view.onDidDispose(() => {
      messageListener.dispose()
      visibilityListener.dispose()
      disposeListener.dispose()
      if (this.view === view) this.view = undefined
    })
  }

  async reload(): Promise<void> {
    if (!this.view) return
    this.view.webview.html = renderHtml(
      this.view.webview,
      'sidebar',
      await loadAssets(this.extensionUri, 'sidebar'),
    )
  }

  postEvent(event: string, data?: unknown): void {
    if (!this.view) return
    postEvent((message) => void this.view?.webview.postMessage(message), event, data)
  }

  dispose(): void {
    this.view = undefined
  }
}
