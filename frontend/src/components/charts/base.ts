import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  HeatmapChart,
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  CalendarComponent,
  MarkLineComponent,
} from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import type {
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  TreemapSeriesOption,
  HeatmapSeriesOption,
} from 'echarts/charts'
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  VisualMapComponentOption,
  CalendarComponentOption,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  CalendarComponent,
  MarkLineComponent,
])

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | TreemapSeriesOption
  | HeatmapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | TitleComponentOption
  | VisualMapComponentOption
  | CalendarComponentOption
>

export const PALETTE = [
  '#5b5bd6',
  '#2ea8a0',
  '#e8a33d',
  '#d96a8a',
  '#7d8bd6',
  '#4a9d7f',
  '#b57bd6',
  '#c26b4a',
  '#8a94a6',
]

export const INPUT_COLOR = '#5b5bd6'
export const OUTPUT_COLOR = '#e8a33d'
export const CREDIT_COLOR = '#d96a8a'

export const AXIS_LABEL = { color: '#8a94a6', fontSize: 11 }

export const TOOLTIP_BASE = {
  backgroundColor: 'rgba(31, 36, 48, 0.94)',
  borderWidth: 0,
  textStyle: { color: '#fff', fontSize: 12 },
  padding: [8, 12],
}
