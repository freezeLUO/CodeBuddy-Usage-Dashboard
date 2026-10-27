const YI = 1e8
const WAN = 1e4
const pad = (value: number): string => String(value).padStart(2, '0')

export function formatTokens(value: number): string {
  if (!value) return '0'
  if (value >= YI) return `${(value / YI).toFixed(2)} 亿`
  if (value >= WAN) return `${(value / WAN).toFixed(1)} 万`
  return value.toLocaleString('zh-CN')
}

export function formatCredit(value: number): string {
  if (!value) return '0.00'
  if (value >= WAN) return `${(value / WAN).toFixed(2)} 万`
  return value.toFixed(2)
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.floor(ms / 60_000)} 分 ${Math.round((ms % 60_000) / 1000)} 秒`
}

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—'
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const date = new Date(ms)
  return `${formatDate(ms)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatClock(ms: number | null | undefined): string {
  if (!ms) return '尚未同步'
  const date = new Date(ms)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function relativeTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return formatDate(ms)
}

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
