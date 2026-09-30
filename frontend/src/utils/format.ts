const YI = 1e8
const WAN = 1e4

export function formatTokens(value: number): string {
  if (!value) return '0'
  if (value >= YI) return `${(value / YI).toFixed(2)} 亿`
  if (value >= WAN) return `${(value / WAN).toFixed(1)} 万`
  return value.toLocaleString('zh-CN')
}

export function formatNumber(value: number): string {
  return (value ?? 0).toLocaleString('zh-CN')
}

export function formatCredit(value: number): string {
  if (value >= WAN) return `${(value / WAN).toFixed(2)} 万`
  return value.toFixed(2)
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes} 分 ${seconds} 秒`
}

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
