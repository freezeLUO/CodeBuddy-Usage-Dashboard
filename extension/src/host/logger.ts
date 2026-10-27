import * as vscode from 'vscode'

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  show(): void
  dispose(): void
}

export function createLogger(): Logger & vscode.Disposable {
  const channel = vscode.window.createOutputChannel('CodeBuddy 用量')

  const write = (level: string, message: string): void => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    channel.appendLine(`[${time}] [${level}] ${message}`)
  }

  return {
    info: (message) => write('INFO', message),
    warn: (message) => write('WARN', message),
    error: (message) => write('ERROR', message),
    show: () => channel.show(true),
    dispose: () => channel.dispose(),
  }
}
