<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TimePoint } from '../types'
import { formatCredit, formatTokens } from '../format'

const props = defineProps<{ items: TimePoint[] }>()

const WIDTH = 300
const HEIGHT = 82
const PAD = 5

const hover = ref<number | null>(null)

const geometry = computed(() => {
  const items = props.items
  if (!items.length) return null
  const maxTokens = Math.max(1, ...items.map((item) => item.total_tokens))
  const maxCredit = Math.max(1, ...items.map((item) => item.credit))
  const step = items.length > 1 ? (WIDTH - PAD * 2) / (items.length - 1) : 0
  const x = (index: number): number => PAD + index * step
  const yToken = (value: number): number => HEIGHT - PAD - (value / maxTokens) * (HEIGHT - PAD * 2)
  const yCredit = (value: number): number => HEIGHT - PAD - (value / maxCredit) * (HEIGHT - PAD * 2)

  const tokenPoints = items.map((item, index) => [x(index), yToken(item.total_tokens)] as const)
  const creditPoints = items.map((item, index) => [x(index), yCredit(item.credit)] as const)
  const toPath = (points: ReadonlyArray<readonly [number, number]>): string =>
    points.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ')
  const lastX = x(items.length - 1).toFixed(2)
  const firstX = x(0).toFixed(2)

  return {
    tokenPoints,
    creditPoints,
    tokenLine: toPath(tokenPoints),
    creditLine: toPath(creditPoints),
    tokenArea: `${toPath(tokenPoints)} L${lastX} ${HEIGHT - PAD} L${firstX} ${HEIGHT - PAD} Z`,
    step,
    x,
  }
})

const active = computed(() => (hover.value === null ? null : props.items[hover.value] ?? null))

const tooltipStyle = computed(() => {
  if (hover.value === null || !geometry.value) return {}
  const x = geometry.value.x(hover.value)
  return {
    left: `${(x / WIDTH) * 100}%`,
    transform: x > WIDTH * 0.72 ? 'translate(-100%, 0)' : x < WIDTH * 0.28 ? 'translate(0, 0)' : 'translate(-50%, 0)',
  }
})

function onMove(event: MouseEvent): void {
  const target = event.currentTarget as SVGElement
  const rect = target.getBoundingClientRect()
  if (!props.items.length || rect.width === 0) return
  const ratio = Math.min(0.999, Math.max(0, (event.clientX - rect.left) / rect.width))
  hover.value = Math.floor(ratio * props.items.length)
}

function onLeave(): void {
  hover.value = null
}
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      class="block h-[82px] w-full cursor-crosshair"
      role="img"
      aria-label="每日 Token 与积分趋势"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <defs>
        <linearGradient :id="'spark-token'" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--cb-token-in)" stop-opacity="0.34" />
          <stop offset="100%" stop-color="var(--cb-token-in)" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <template v-if="geometry">
        <line
          v-for="ratio in [0.5]"
          :key="ratio"
          :x1="0"
          :x2="WIDTH"
          :y1="HEIGHT * ratio"
          :y2="HEIGHT * ratio"
          stroke="var(--cb-border-soft)"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          stroke-dasharray="3 4"
        />
        <path :d="geometry.tokenArea" :fill="'url(#spark-token)'" />
        <path
          :d="geometry.tokenLine"
          fill="none"
          stroke="var(--cb-token-in)"
          stroke-width="1.6"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <path
          :d="geometry.creditLine"
          fill="none"
          stroke="var(--cb-credit)"
          stroke-width="1.3"
          stroke-dasharray="4 3"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <line
          v-if="hover !== null"
          :x1="geometry.x(hover)"
          :x2="geometry.x(hover)"
          :y1="0"
          :y2="HEIGHT"
          stroke="var(--cb-border)"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
        <circle
          v-if="hover !== null && geometry.tokenPoints[hover]"
          :cx="geometry.tokenPoints[hover][0]"
          :cy="geometry.tokenPoints[hover][1]"
          r="2.4"
          fill="var(--cb-token-in)"
          vector-effect="non-scaling-stroke"
        />
        <circle
          v-if="hover !== null && geometry.creditPoints[hover]"
          :cx="geometry.creditPoints[hover][0]"
          :cy="geometry.creditPoints[hover][1]"
          r="2.2"
          fill="var(--cb-credit)"
          vector-effect="non-scaling-stroke"
        />
      </template>
      <text v-else x="8" y="44" font-size="10" fill="var(--cb-fg-soft)">暂无数据</text>
    </svg>

    <div
      v-if="active"
      class="pointer-events-none absolute top-0 z-10 min-w-[112px] rounded px-2 py-1.5 text-[10.5px] shadow-lg"
      :style="{
        ...tooltipStyle,
        background: 'var(--cb-bg-elevated)',
        border: '1px solid var(--cb-border)',
      }"
    >
      <p class="mb-1" :style="{ color: 'var(--cb-fg-soft)' }">{{ active.bucket }}</p>
      <p class="cb-num flex justify-between gap-3">
        <span>Token</span><span>{{ formatTokens(active.total_tokens) }}</span>
      </p>
      <p class="cb-num mt-0.5 flex justify-between gap-3">
        <span>积分</span><span :style="{ color: 'var(--cb-credit)' }">{{ formatCredit(active.credit) }}</span>
      </p>
    </div>

    <div
      v-if="items.length"
      class="mt-1 flex justify-between text-[10px]"
      :style="{ color: 'var(--cb-fg-soft)' }"
    >
      <span>{{ items[0]?.bucket }}</span>
      <span>{{ items[items.length - 1]?.bucket }}</span>
    </div>
  </div>
</template>
