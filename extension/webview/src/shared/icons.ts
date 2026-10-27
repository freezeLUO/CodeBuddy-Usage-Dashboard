/** 内联 SVG 图标（线段风格，24x24），避免引入图标库增加 webview 体积。 */
export type IconName =
  | 'refresh'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'search'
  | 'arrow-right'
  | 'chart'
  | 'settings'
  | 'alert'
  | 'folder'
  | 'clock'
  | 'check'
  | 'copy'
  | 'coins'
  | 'message'
  | 'activity'
  | 'database'

export const ICON_PATHS: Record<IconName, string[]> = {
  refresh: ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm21 21-4.3-4.3'],
  'arrow-right': ['M5 12h14', 'm13 5 7 7-7 7'],
  chart: ['M4 20V11', 'M10 20V5', 'M16 20v-6', 'M22 20H2'],
  settings: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6',
  ],
  alert: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v5', 'M12 16.5h.01'],
  folder: ['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3.5 2'],
  check: ['M20 6 9 17l-5-5'],
  copy: [
    'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z',
    'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  ],
  coins: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    'M12 7v10',
    'M15 9.5A3 3 0 0 0 12 8c-1.7 0-3 .8-3 2.2 0 1.3 1.3 1.9 3 2.3 1.7.4 3 1 3 2.3 0 1.4-1.3 2.2-3 2.2a3 3 0 0 1-3-1.5',
  ],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  activity: ['M22 12h-4l-3 8L9 4l-3 8H2'],
  database: [
    'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z',
    'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6',
    'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  ],
}
