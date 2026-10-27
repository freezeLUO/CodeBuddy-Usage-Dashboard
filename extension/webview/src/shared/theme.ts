import { computed, ref } from 'vue'

export type ThemeKind = 'light' | 'dark' | 'contrast' | 'contrast-light'

function detect(): ThemeKind {
  const list = document.body.classList
  if (list.contains('vscode-high-contrast-light')) return 'contrast-light'
  if (list.contains('vscode-high-contrast')) return 'contrast'
  if (list.contains('vscode-light')) return 'light'
  return 'dark'
}

const kind = ref<ThemeKind>(detect())

new MutationObserver(() => {
  kind.value = detect()
}).observe(document.body, { attributes: true, attributeFilter: ['class'] })

export const themeKind = kind
export const isDark = computed(() => kind.value === 'dark' || kind.value === 'contrast')

export interface ChartPalette {
  input: string
  output: string
  credit: string
  series: string[]
  axisLabel: { color: string; fontSize: number }
  axisLine: string
  splitLine: string
  tooltip: {
    backgroundColor: string
    borderWidth: number
    borderColor?: string
    textStyle: { color: string; fontSize: number }
    padding: [number, number]
  }
  text: string
  textSoft: string
  surface: string
  border: string
}

const SERIES_DARK = ['#4d7fbf', '#3f8f86', '#c08a3e', '#b5637d', '#7a6cbf', '#4f8a70', '#9a6aa8', '#a56a4a']
const SERIES_LIGHT = ['#5b7fd6', '#2f8f88', '#c98a35', '#c25f7d', '#7d7fd6', '#4a8f70', '#9b6aa8', '#b06040']

const DARK: ChartPalette = {
  input: '#4d8dff',
  output: '#e8a33d',
  credit: '#e07a9c',
  series: SERIES_DARK,
  axisLabel: { color: '#9d9d9d', fontSize: 11 },
  axisLine: 'rgba(128,128,128,0.28)',
  splitLine: 'rgba(128,128,128,0.14)',
  tooltip: {
    backgroundColor: 'rgba(37,37,38,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.28)',
    textStyle: { color: '#f0f0f0', fontSize: 12 },
    padding: [8, 12],
  },
  text: '#e6e6e6',
  textSoft: '#9d9d9d',
  surface: '#252526',
  border: 'rgba(128,128,128,0.24)',
}

const LIGHT: ChartPalette = {
  input: '#4b6ef5',
  output: '#d18616',
  credit: '#c94070',
  series: SERIES_LIGHT,
  axisLabel: { color: '#6b6b6b', fontSize: 11 },
  axisLine: '#d9dce1',
  splitLine: '#eceef2',
  tooltip: {
    backgroundColor: 'rgba(31,36,48,0.94)',
    borderWidth: 0,
    textStyle: { color: '#ffffff', fontSize: 12 },
    padding: [8, 12],
  },
  text: '#333333',
  textSoft: '#6b6b6b',
  surface: '#ffffff',
  border: '#e3e5e9',
}

export const palette = computed<ChartPalette>(() => (isDark.value ? DARK : LIGHT))

export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
