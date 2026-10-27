// 生成市场图标 media/icon.png：圆角深色底 + 三根渐变色柱，超采样抗锯齿。
// 用法：node scripts/make-icon.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 128
const SS = 4 // 每个像素 4x4 超采样

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

// 圆角矩形的有符号距离，用于抗锯齿边缘
function roundedRectSdf(x, y, cx, cy, halfW, halfH, r) {
  const dx = Math.abs(x - cx) - (halfW - r)
  const dy = Math.abs(y - cy) - (halfH - r)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r
}

const TOP = [32, 37, 56]
const BOTTOM = [16, 18, 28]
const BARS = [
  { x: 27, w: 17, h: 26, color: [77, 163, 255] },
  { x: 55.5, w: 17, h: 43, color: [111, 139, 255] },
  { x: 84, w: 17, h: 60, color: [155, 123, 255] },
]
const BASELINE = 99

const pixels = Buffer.alloc(SIZE * SIZE * 4)

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const px = x + (sx + 0.5) / SS
        const py = y + (sy + 0.5) / SS

        let color = null
        let alpha = 0

        const bg = roundedRectSdf(px, py, 63.5, 63.5, 63.5, 63.5, 27)
        if (bg < 0.5) {
          const t = Math.max(0, Math.min(1, py / SIZE))
          color = mix(TOP, BOTTOM, t)
          alpha = 1
          // 顶部微高光
          const glow = Math.max(0, 1 - Math.hypot(px - 100, py - 18) / 62)
          if (glow > 0) color = mix(color, [64, 92, 168], glow * 0.55)
        }

        for (const bar of BARS) {
          const sdf = roundedRectSdf(px, py, bar.x + bar.w / 2, BASELINE - bar.h / 2, bar.w / 2, bar.h / 2, 6)
          if (sdf < 0.5) {
            const edge = Math.max(0, Math.min(1, 0.5 - sdf))
            const t = Math.max(0, Math.min(1, (py - (BASELINE - bar.h)) / bar.h))
            color = mix(bar.color, mix(bar.color, [255, 255, 255], 0.28), t * 0.5)
            alpha = Math.max(alpha, 1) * Math.min(1, edge * 2 + 0.35)
            color = mix(color, [16, 18, 28], (1 - Math.min(1, edge * 2 + 0.35)) * 0.35)
            alpha = Math.max(alpha, 0.95)
          }
        }

        if (color) {
          r += color[0] * alpha
          g += color[1] * alpha
          b += color[2] * alpha
          a += alpha
        }
      }
    }
    const samples = SS * SS
    const idx = (y * SIZE + x) * 4
    pixels[idx] = a > 0 ? Math.round(r / a) : 0
    pixels[idx + 1] = a > 0 ? Math.round(g / a) : 0
    pixels[idx + 2] = a > 0 ? Math.round(b / a) : 0
    pixels[idx + 3] = Math.round((a / samples) * 255)
  }
}

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../media/icon.png')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, encodePng(SIZE, SIZE, pixels))
console.log(`[icon] ${target}`)
