/** Webview HTML 生成：脚本与样式直接内联，CSP 只需要 nonce，避免模块 chunk 被拦截。 */
import { promises as fs } from 'node:fs'
import { randomBytes } from 'node:crypto'
import * as path from 'node:path'
import * as vscode from 'vscode'

export type ViewKind = 'sidebar' | 'dashboard'

export interface HtmlAssets {
  script: string
  style: string
}

export async function loadAssets(extensionUri: vscode.Uri, view: ViewKind): Promise<HtmlAssets | null> {
  const root = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', view).fsPath
  try {
    const entries = await fs.readdir(root)
    const scriptName = entries.find((name) => name === `${view}.js`) ?? entries.find((name) => name.endsWith('.js'))
    if (!scriptName) return null
    const styleName = entries.find((name) => name.endsWith('.css'))
    const script = await fs.readFile(path.join(root, scriptName), 'utf8')
    const style = styleName ? await fs.readFile(path.join(root, styleName), 'utf8') : ''
    return { script, style }
  } catch {
    return null
  }
}

function escapeScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
}

export function renderHtml(webview: vscode.Webview, view: ViewKind, assets: HtmlAssets | null): string {
  const nonce = randomBytes(18).toString('base64')
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `img-src ${webview.cspSource} data:`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ')

  const title = view === 'sidebar' ? '用量' : '用量看板'
  const body = assets
    ? `<div id="app" data-view="${view}"></div>
<script type="module" nonce="${nonce}">${escapeScript(assets.script)}</script>`
    : `<div class="missing">
  <h1>构建产物缺失</h1>
  <p>请先在 <code>extension</code> 目录执行 <code>pnpm run build</code>，然后重新加载窗口。</p>
</div>`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="color-scheme" content="light dark" />
<title>${title}</title>
<style nonce="${nonce}">
${assets?.style ?? ''}
.missing { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 24px; }
.missing h1 { font-size: 14px; margin: 0 0 8px; }
.missing p { font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.6; }
.missing code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
${body}
</body>
</html>`
}
