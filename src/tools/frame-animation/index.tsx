import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { unzipSync } from 'fflate'
import {
  ArrowDownAZ,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  FileImage,
  Film,
  FolderOpen,
  ImagePlus,
  Images,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** 一帧：本地图片的 objectURL，绝不离开浏览器 */
interface FrameItem {
  id: string
  /** 上传序号：导入时分配，重排 / 裁剪后保持不变 */
  seq: number
  name: string
  url: string
  width: number
  height: number
  /** 文件字节数 */
  size: number
}

type Direction = 'forward' | 'reverse' | 'pingpong'
type StageBg = 'checker' | 'solid'
type SpriteDimensionAxis = 'cols' | 'rows'
interface SpriteDims {
  cols: number
  rows: number
}
/** fit = 适应舞台；数字 = 按原始尺寸的百分比缩放 */
type Zoom = 'fit' | 50 | 100 | 200 | 400

/** 文件名自然排序（数字按数值比较，frame2 < frame10） */
const collator = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' })

function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 代码区内的全选只选择代码，避免快捷键扩散到整页。 */
function selectCodeOnShortcut(e: ReactKeyboardEvent<HTMLPreElement>): void {
  if (e.key.toLowerCase() !== 'a' || (!e.metaKey && !e.ctrlKey))
    return

  e.preventDefault()
  e.stopPropagation()
  const selection = window.getSelection()
  if (!selection)
    return

  const range = document.createRange()
  range.selectNodeContents(e.currentTarget)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 读取图片为一帧（seq 由调用方分配）；解码失败返回 null（调用方过滤） */
function loadFrame(name: string, blob: Blob): Promise<Omit<FrameItem, 'seq'> | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve({
      id: crypto.randomUUID(),
      name,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: blob.size,
    })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/* ---------- 压缩包导入 ---------- */

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

/** 按扩展名判断图片并给出 MIME；非图片返回 null */
function imageMimeOf(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_MIME_BY_EXT[ext] ?? null
}

interface IncomingImage {
  name: string
  blob: Blob
}

/** Uint8Array → Blob：切出精确的 ArrayBuffer 段（避免 TS 泛型与视图偏移问题） */
function bytesToBlob(data: Uint8Array, mime: string): Blob {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  return new Blob([buf], { type: mime })
}

/** 解 ZIP：取所有图片条目，忽略 macOS 元数据目录 */
async function extractZip(file: File): Promise<IncomingImage[]> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  return Object.entries(entries)
    .filter(([path]) => !path.startsWith('__MACOSX') && imageMimeOf(path) !== null)
    .map(([path, data]) => ({
      name: path.split('/').pop() || path,
      blob: bytesToBlob(data, imageMimeOf(path)!),
    }))
}

/** alpha 阈值：低于此值视为透明，避免抗锯齿边缘的半透明噪点撑大包围盒 */
const ALPHA_THRESHOLD = 10

interface OpaqueBox {
  left: number
  top: number
  /** 右 / 下边界（开区间） */
  right: number
  bottom: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** 扫描图片的非透明包围盒；全透明返回 null */
function scanOpaqueBox(img: HTMLImageElement): OpaqueBox | null {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx)
    return null
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  const colHasOpaque = (x: number) => {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD)
        return true
    }
    return false
  }
  const rowHasOpaque = (y: number) => {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD)
        return true
    }
    return false
  }

  let left = 0
  while (left < width && !colHasOpaque(left)) left++
  if (left === width)
    return null
  let right = width - 1
  while (!colHasOpaque(right)) right--
  let top = 0
  while (!rowHasOpaque(top)) top++
  let bottom = height - 1
  while (!rowHasOpaque(bottom)) bottom--
  return { left, top, right: right + 1, bottom: bottom + 1 }
}

/** 把图片按 rect 裁剪成 PNG，返回新的 objectURL 等信息 */
async function cropFrameImage(
  frame: FrameItem,
  rect: OpaqueBox,
): Promise<Pick<FrameItem, 'url' | 'width' | 'height' | 'size'> | null> {
  const img = await loadImage(frame.url)
  // 裁剪坐标与各帧自身尺寸取交集（帧尺寸可能不一致）
  const left = Math.min(rect.left, img.naturalWidth)
  const top = Math.min(rect.top, img.naturalHeight)
  const right = Math.min(rect.right, img.naturalWidth)
  const bottom = Math.min(rect.bottom, img.naturalHeight)
  const w = right - left
  const h = bottom - top
  if (w <= 0 || h <= 0)
    return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  ctx.drawImage(img, left, top, w, h, 0, 0, w, h)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob)
    return null
  return { url: URL.createObjectURL(blob), width: w, height: h, size: blob.size }
}

/** 把所有帧拼成精灵图：单元格取最大宽 / 高，帧在格内居中 */
async function buildSpriteSheet(frames: FrameItem[], dims: SpriteDims): Promise<Blob | null> {
  if (frames.length === 0)
    return null
  const cellW = Math.max(...frames.map(f => f.width))
  const cellH = Math.max(...frames.map(f => f.height))
  const { cols, rows } = dims
  const canvas = document.createElement('canvas')
  canvas.width = cellW * cols
  canvas.height = cellH * rows
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  for (let i = 0; i < frames.length; i++) {
    const img = await loadImage(frames[i].url)
    const col = i % cols
    const row = Math.floor(i / cols)
    ctx.drawImage(
      img,
      col * cellW + (cellW - img.naturalWidth) / 2,
      row * cellH + (cellH - img.naturalHeight) / 2,
    )
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/** 把所有帧叠放合成一张预览图（逆序绘制 = 最后一帧垫底，首帧在最上） */
async function buildStackPreview(frames: FrameItem[]): Promise<Blob | null> {
  if (frames.length === 0)
    return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(...frames.map(f => f.width))
  canvas.height = Math.max(...frames.map(f => f.height))
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  for (let i = frames.length - 1; i >= 0; i--) {
    const img = await loadImage(frames[i].url)
    ctx.drawImage(img, 0, 0)
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/* ---------- 样式导出 ---------- */

type ExportFormat = 'css' | 'less' | 'scss'
/** 精灵图布局：strip = 单行长条；grid = 接近方形的网格（规避超长图） */
type SpriteLayout = 'strip' | 'grid'

interface ExportParams {
  frames: number
  /** 一轮时长（秒，已格式化） */
  duration: string
  /** 'infinite' 或次数 */
  iteration: string
  /** CSS animation-direction 值 */
  direction: 'normal' | 'reverse' | 'alternate'
  pixelated: boolean
  /** 单帧（单元格）尺寸 */
  cellW: number
  cellH: number
  /** 变量：帧数 / 时长提取为变量，便于集中调整 */
  useVars: boolean
  /**
   * 容器：宽高交给容器（100% + aspect-ratio），帧切换走百分比定位；
   *  关闭则写死单帧 px 尺寸，background-position 用 px
   */
  useContainer: boolean
  layout: SpriteLayout
  cols: number
  rows: number
}

const SPRITE_URL = 'frame-anim-sprite.png'

/** 数字格式：两位小数截尾零 */
function num(v: number): number {
  return Number(v.toFixed(2))
}

/** 由最后编辑的列数或行数推导另一维；空白格只允许出现在末行 / 末列 */
function resolveSpriteDims(frameCount: number, axis: SpriteDimensionAxis, value: number): SpriteDims {
  const count = Math.max(1, frameCount)
  const primary = Math.min(count, Math.max(1, Math.floor(value)))
  return axis === 'cols'
    ? { cols: primary, rows: Math.ceil(count / primary) }
    : { cols: Math.ceil(count / primary), rows: primary }
}

/** 语言差异适配：变量引用 / 变量声明 / 注释 / 「帧数 × 单元宽 px」表达式 */
interface LangSpec {
  v: (name: string) => string
  decl: (name: string, value: string) => string
  comment: (text: string) => string
  framesTimesPx: (cellW: number) => string
}

const LANG: Record<ExportFormat, LangSpec> = {
  css: {
    v: n => `var(--${n})`,
    decl: (n, val) => `  --${n}: ${val};`,
    comment: t => `/* ${t} */`,
    framesTimesPx: w => `calc(var(--frames) * -${w}px)`,
  },
  less: {
    v: n => `@${n}`,
    decl: (n, val) => `  @${n}: ${val};`,
    comment: t => `// ${t}`,
    framesTimesPx: w => `(@frames * -${w}px)`,
  },
  scss: {
    v: n => `$${n}`,
    decl: (n, val) => `  $${n}: ${val};`,
    comment: t => `// ${t}`,
    framesTimesPx: w => `($frames * -${w}px)`,
  },
}

/** 网格模式的逐格 keyframes：第 k 帧 = 第 (k%cols, floor(k/cols)) 格 */
function gridKeyframeLines(p: ExportParams): string[] {
  const lines: string[] = []
  for (let k = 0; k < p.frames; k++) {
    const c = k % p.cols
    const r = Math.floor(k / p.cols)
    const x = p.useContainer
      ? `${num(p.cols > 1 ? (c / (p.cols - 1)) * 100 : 0)}%`
      : `${-c * p.cellW}px`
    const y = p.useContainer
      ? `${num(p.rows > 1 ? (r / (p.rows - 1)) * 100 : 0)}%`
      : `${-r * p.cellH}px`
    lines.push(`  ${num((k / p.frames) * 100)}% { background-position: ${x} ${y}; }`)
  }
  lines.push(`  100% { background-position: ${p.useContainer ? '0% 0%' : '0 0'}; }`)
  return lines
}

/**
 * 落位方式：
 * - 长条 + 容器：background-size 为 N×100%，0% → 100% 恰好扫过 N 帧，用 steps(N, jump-none)；
 * - 长条 + px：原始尺寸平铺，0 → -N×W px，steps(N)；
 * - 网格：逐格 keyframes + step-end（段内保持、段末瞬移），行列百分比分母是 列-1 / 行-1。
 */
function buildExport(p: ExportParams, lang: LangSpec): string {
  const frames = p.useVars ? lang.v('frames') : String(p.frames)
  const duration = p.useVars ? lang.v('duration') : `${p.duration}s`
  const isGrid = p.layout === 'grid'

  const varLines: string[] = []
  if (p.useVars) {
    varLines.push(lang.decl('frames', String(p.frames)), lang.decl('duration', `${p.duration}s`))
    if (isGrid)
      varLines.push(lang.decl('cols', String(p.cols)), lang.decl('rows', String(p.rows)))
    varLines.push('')
  }

  const sizeLines = p.useContainer
    ? [lang.comment('宽高交给容器：宽度撑满，按单帧宽高比推导高度'), '  width: 100%;', `  aspect-ratio: ${p.cellW} / ${p.cellH};`]
    : [`  width: ${p.cellW}px;`, `  height: ${p.cellH}px;`]

  let bgSizeLine: string | null = null
  if (p.useContainer) {
    const bgSize = isGrid
      ? (p.useVars
          ? `calc(${lang.v('cols')} * 100%) calc(${lang.v('rows')} * 100%)`
          : `${p.cols * 100}% ${p.rows * 100}%`)
      : (p.useVars ? `calc(${frames} * 100%) 100%` : `${p.frames * 100}% 100%`)
    bgSizeLine = `  background-size: ${bgSize};`
  }

  const timing = isGrid ? 'step-end' : (p.useContainer ? `steps(${frames}, jump-none)` : `steps(${frames})`)

  let keyframesComment: string | null = null
  let keyframeLines: string[]
  if (isGrid) {
    keyframesComment = lang.comment('逐格定位：step-end 段内保持、段末瞬移；末行不足留空即可')
    keyframeLines = gridKeyframeLines(p)
  }
  else {
    if (p.useContainer)
      keyframesComment = lang.comment('配合 steps(N, jump-none)，0% → 100% 每步正好一帧')
    const to = p.useContainer
      ? '100%'
      : (p.useVars ? lang.framesTimesPx(p.cellW) : `-${p.cellW * p.frames}px`)
    keyframeLines = [
      `  from { background-position: 0${p.useContainer ? '%' : ''} 0; }`,
      `  to { background-position: ${to} 0; }`,
    ]
  }

  return [
    '.frame-anim {',
    ...varLines,
    ...sizeLines,
    `  background-image: url("${SPRITE_URL}");`,
    '  background-repeat: no-repeat;',
    ...(bgSizeLine ? [bgSizeLine] : []),
    ...(p.pixelated ? ['  image-rendering: pixelated;'] : []),
    `  animation: frame-anim-play ${duration} ${timing} ${p.iteration} ${p.direction};`,
    '}',
    '',
    ...(keyframesComment ? [keyframesComment] : []),
    '@keyframes frame-anim-play {',
    ...keyframeLines,
    '}',
  ].join('\n')
}

const EXPORT_BUILDERS: Record<ExportFormat, (p: ExportParams) => string> = {
  css: p => buildExport(p, LANG.css),
  less: p => buildExport(p, LANG.less),
  scss: p => buildExport(p, LANG.scss),
}

/** 数字小输入框的统一样式 */
const NUM_INPUT_CLASS = 'w-14 shrink-0 rounded-md border-2 border-border bg-background px-1.5 py-1 text-center font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

/** 单选按钮组：描边分段控件，选中项用主色填充 */
function OptionGroup<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: { value: T, label: ReactNode, icon?: LucideIcon }[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div className={cn('flex overflow-hidden rounded-md border-2 border-border shadow-hard-xs', className)} role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const Icon = opt.icon
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 px-1 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
              value === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-secondary',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- 舞台颜色：单底色 + 算法派生 ---------- */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i)
  if (!m)
    return null
  const n = Number.parseInt(m[1], 16)
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** oklch(l c h) → hex（OKLab → LMS → 线性 sRGB → gamma）；解析失败返回 null */
function oklchToHex(color: string): string | null {
  const m = color.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!m)
    return null
  const L = m[2] === '%' ? Number(m[1]) / 100 : Number(m[1])
  const rad = (Number(m[4]) * Math.PI) / 180
  const a = Number(m[3]) * Math.cos(rad)
  const b = Number(m[3]) * Math.sin(rad)
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255
  return rgbToHex(
    gamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    gamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    gamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  )
}

/**
 * 由底色派生棋盘格第二色：逐通道反色（255 - c）+ 低透明度叠回底色。
 * 即 B = 底色 × (1 - α) + 反色 × α —— 白底配浅灰、黑底配深灰，
 * 彩色底则是朝反色方向轻轻偏移的同色系色，不会出现洗白 / 死黑。
 * 盲区兜底：中灰的反色≈自身（对比趋近于零），此时退化为按亮度叠黑 / 白。
 */
const CHECKER_ALPHA = 0.12

function checkerMate(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb)
    return '#cccccc'
  const a = CHECKER_ALPHA
  const inv = rgb.map(c => c * (1 - 2 * a) + 255 * a)
  // 反色对比不足（底色在近中灰区），改用亮度方向叠黑 / 白
  const dist = Math.abs(inv[0] - rgb[0]) + Math.abs(inv[1] - rgb[1]) + Math.abs(inv[2] - rgb[2])
  if (dist < 30) {
    const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
    const overlay = luminance >= 0.5 ? 0 : 255
    return rgbToHex(...rgb.map(c => c * (1 - a) + overlay * a) as [number, number, number])
  }
  return rgbToHex(...inv as [number, number, number])
}

/** 订阅 <html> 的 dark class 变化（主题切换由 ThemeToggle 驱动） */
function subscribeDarkClass(onChange: () => void): () => void {
  const ob = new MutationObserver(onChange)
  ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => ob.disconnect()
}

function readThemeCardHex(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--card').trim()
  return oklchToHex(raw) ?? '#ffffff'
}

/** 主题卡片色（hex）：跟随主题切换实时重算；SSG 快照为空串（首帧透明，挂载后即修正） */
function useThemeCardHex(): string {
  return useSyncExternalStore(subscribeDarkClass, readThemeCardHex, () => '')
}

/**
 * 双头滑块的共享样式：轨道透明且不响应指针（自定义轨道视觉），
 * 只有滑块可拖；两个 input 重叠放置，各管一个端点。
 */
const RANGE_INPUT_CLASS = cn(
  'pointer-events-none absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 appearance-none bg-transparent disabled:opacity-50',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-hard-xs [&::-webkit-slider-thumb]:cursor-grab',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-grab',
)

/** 新粗野主义勾选框：2px 描边 + 硬阴影 + 抬起/压实，选中填充主色 */
function BrutalCheckbox({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  title?: string
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border-2 border-border shadow-hard-xs transition-all',
          'hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
          'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
          checked ? 'bg-primary text-primary-foreground' : 'bg-background',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
      {label}
    </label>
  )
}

/** 颜色选择：色块按钮（隐藏原生取色器，点击色块唤起）+ 色值展示；传 checker 时色块画迷你棋盘格预览双色 */
function ColorField({
  label,
  value,
  onChange,
  checker,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** 棋盘格第二色：传入后色块以 2×2 迷你棋盘展示两个色 */
  checker?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <span className="relative block size-8 shrink-0 overflow-hidden rounded-md border-2 border-border shadow-hard-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
        <span
          className="absolute inset-0"
          style={{
            background: checker
              ? `conic-gradient(${checker} 25%, ${value} 0 50%, ${checker} 0 75%, ${value} 0) 0 0 / 10px 10px`
              : value,
          }}
        />
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
      <span className="font-mono text-xs">
        {label}
        {' '}
        {value}
      </span>
    </label>
  )
}

export default function FrameAnimationTool() {
  const [frames, setFrames] = useState<FrameItem[]>([])
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  /** 播放范围 [起, 止]（下标，含端点）；null = 全程。渲染时按帧数收敛，无需 effect */
  const [rangeRaw, setRangeRaw] = useState<[number, number] | null>(null)

  // 动画参数
  const [fps, setFps] = useState(12)
  const [direction, setDirection] = useState<Direction>('forward')
  const [loopInfinite, setLoopInfinite] = useState(true)
  const [loopCount, setLoopCount] = useState(3)
  const [stageBg, setStageBg] = useState<StageBg>('checker')
  /**
   * 舞台颜色：null = 跟随主题（--card 令牌），用户选色后覆盖。
   * 棋盘格第二色不单独存，由 checkerMate() 从底色派生。
   */
  const [checkerBase, setCheckerBase] = useState<string | null>(null)
  const [solidBase, setSolidBase] = useState<string | null>(null)
  const themeCardHex = useThemeCardHex()
  const resolvedCheckerA = checkerBase ?? themeCardHex
  const resolvedCheckerB = resolvedCheckerA ? checkerMate(resolvedCheckerA) : ''
  const resolvedSolid = solidBase ?? themeCardHex
  const [zoom, setZoom] = useState<Zoom>('fit')
  const [pixelated, setPixelated] = useState(false)
  /** 显示帧边界：给当前帧画出单张精灵图格子的描边 */
  const [showBounds, setShowBounds] = useState(false)
  /** 舞台平移：帧画面相对居中的偏移（px） */
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  /** 拖拽中的起点快照（指针 id + 起始坐标 + 起始偏移） */
  const panRef = useRef<{ pointerId: number, startX: number, startY: number, baseX: number, baseY: number } | null>(null)
  /** 入选的帧（按 id）：勾选 = 参与预览 / 播放 / 导出；不提供删除，防误操作 */
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  /** 播放游标：rAF 循环里读写，current 仅用于渲染 */
  const playRef = useRef({ index: 0, dir: 1 as 1 | -1, cycles: 0 })
  /** 有限循环播完后置位，再次播放时从头开始 */
  const finishedRef = useRef(false)
  /** 上传序号计数器：只增不减，清空后也不重置（序号 = 第几次上传） */
  const seqRef = useRef(1)
  /** 拖拽排序：被拖行的下标走 ref，悬停插入点走 state（需要渲染指示线） */
  const dragIndexRef = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ index: number, after: boolean } | null>(null)
  /** 批处理裁剪状态与结果反馈 */
  const [cropping, setCropping] = useState(false)
  const [cropResult, setCropResult] = useState<string | null>(null)
  /** 裁剪确认弹窗：叠放预览图 + 并集裁剪矩形 */
  const [cropPreview, setCropPreview] = useState<{ url: string, union: OpaqueBox, fullW: number, fullH: number } | null>(null)
  /** 样式导出：复制反馈与精灵图生成中状态 */
  const [copiedCss, setCopiedCss] = useState(false)
  const [spriting, setSpriting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('scss')
  /** 精灵图排列：记录最后编辑的是列还是行，另一维由帧数自动推导 */
  const [spriteDimension, setSpriteDimension] = useState<{ axis: SpriteDimensionAxis, value: number }>({ axis: 'rows', value: 1 })
  /** 导出开关：变量（参数提取为变量）/ 容器（宽高交给容器、百分比定位） */
  const [exportVars, setExportVars] = useState(true)
  const [exportContainer, setExportContainer] = useState(true)
  /** 压缩包解析失败等导入错误提示 */
  const [importError, setImportError] = useState<string | null>(null)

  const frameCount = frames.length
  /** 入选帧：勾选 = 参与预览 / 播放 / 导出；顺序跟随列表（可拖拽重排） */
  const activeFrames = frames.filter(f => selected.has(f.id))
  const activeCount = activeFrames.length
  /** 渲染用游标：勾选变化后 current 可能短暂越界，这里收敛 */
  const safeIndex = activeCount === 0 ? 0 : Math.min(current, activeCount - 1)
  const frame = activeFrames[safeIndex] ?? null
  /** 播放范围（收敛后）：在入选帧里截取；帧数变化时自动夹回有效区间 */
  const maxIdx = Math.max(0, activeCount - 1)
  const rangeStart = rangeRaw ? Math.min(rangeRaw[0], maxIdx) : 0
  const rangeEnd = rangeRaw ? Math.min(rangeRaw[1], maxIdx) : maxIdx
  const rangeLen = activeCount === 0 ? 0 : rangeEnd - rangeStart + 1
  /** 参与导出的帧：入选帧按播放范围截断 */
  const exportFrames = activeFrames.slice(rangeStart, rangeEnd + 1)
  const spriteDims = resolveSpriteDims(exportFrames.length, spriteDimension.axis, spriteDimension.value)
  const spriteCols = spriteDims.cols
  const spriteRows = spriteDims.rows
  /** 单行使用精简的长条样式；多行使用逐格网格样式 */
  const spriteLayout: SpriteLayout = spriteRows === 1 ? 'strip' : 'grid'

  /* ---------- 帧管理 ---------- */

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const inputs = [...list].filter(f => f.type.startsWith('image/') || /\.zip$/i.test(f.name))
    if (inputs.length === 0)
      return
    setImportError(null)
    // 图片直接收，压缩包先解出图片条目
    const incoming: IncomingImage[] = []
    const failed: string[] = []
    for (const f of inputs) {
      try {
        if (f.type.startsWith('image/'))
          incoming.push({ name: f.name, blob: f })
        else
          incoming.push(...await extractZip(f))
      }
      catch {
        failed.push(f.name)
      }
    }
    if (failed.length > 0)
      setImportError(`压缩包解析失败：${failed.join('、')}`)
    if (incoming.length === 0) {
      if (failed.length === 0)
        setImportError('没有找到可用的图片')
      return
    }
    const loaded = (await Promise.all(incoming.map(i => loadFrame(i.name, i.blob))))
      .filter((f): f is Omit<FrameItem, 'seq'> => f !== null)
    // 新追加的一批内部按文件名自然排序，不打乱已有帧的手动顺序
    loaded.sort((a, b) => collator.compare(a.name, b.name))
    // 分配上传序号：重排不改变它，便于对照原始文件顺序；新帧默认入选
    const withSeq = loaded.map(f => ({ ...f, seq: seqRef.current++ }))
    setFrames(prev => [...prev, ...withSeq])
    setSelected((prev) => {
      const next = new Set(prev)
      withSeq.forEach(f => next.add(f.id))
      return next
    })
  }, [])

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      void addFiles(e.target.files)
    // 允许再次选择同一批文件
    e.target.value = ''
  }, [addFiles])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void addFiles(e.dataTransfer.files)
  }, [addFiles])

  /* ---------- 舞台平移：pointer capture 拖拽帧画面 ---------- */

  const onPanStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // 只响应主键，且要有可拖的画面
    if (e.button !== 0)
      return
    panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
    setPanning(true)
  }, [offset])

  const onPanMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId)
      return
    setOffset({ x: pan.baseX + e.clientX - pan.startX, y: pan.baseY + e.clientY - pan.startY })
  }, [])

  const onPanEnd = useCallback(() => {
    panRef.current = null
    setPanning(false)
  }, [])

  const resetPan = useCallback(() => setOffset({ x: 0, y: 0 }), [])

  /** 跳到指定帧：同步 rAF 游标并打断往返方向 / 循环计数 */
  const jumpTo = useCallback((index: number) => {
    playRef.current = { index, dir: 1, cycles: 0 }
    finishedRef.current = false
    setCurrent(index)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id))
        next.delete(id)
      else
        next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected(prev => (prev.size >= frames.length ? new Set() : new Set(frames.map(f => f.id))))
  }, [frames])

  /** 拖拽排序：把 from 行移动到 to 行之前 / 之后 */
  const moveFrameTo = useCallback((from: number, to: number, after: boolean) => {
    setFrames((prev) => {
      if (from === to)
        return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      // 目标下标在移除后需要校正；after 表示插到目标行之后
      let insertAt = to + (after ? 1 : 0)
      if (from < insertAt)
        insertAt -= 1
      next.splice(insertAt, 0, moved)
      return next
    })
  }, [])

  /** 批处理：扫描所有帧的非透明包围盒，取并集 = 裁掉所有帧都透明的公共边缘 */
  const prepareCrop = useCallback(async () => {
    if (frames.length === 0 || cropping)
      return
    setCropping(true)
    setCropResult(null)
    try {
      const boxes: OpaqueBox[] = []
      for (const f of frames) {
        const img = await loadImage(f.url)
        const box = scanOpaqueBox(img)
        if (box)
          boxes.push(box)
      }
      if (boxes.length === 0) {
        setCropResult('所有帧都是全透明图片，没有可保留的内容')
        return
      }
      const union: OpaqueBox = {
        left: Math.min(...boxes.map(b => b.left)),
        top: Math.min(...boxes.map(b => b.top)),
        right: Math.max(...boxes.map(b => b.right)),
        bottom: Math.max(...boxes.map(b => b.bottom)),
      }
      // 并集已覆盖整张图 = 没有公共透明边可裁
      const coversAll = frames.every(
        f => union.left <= 0 && union.top <= 0 && union.right >= f.width && union.bottom >= f.height,
      )
      if (coversAll) {
        setCropResult('没有找到所有帧都透明的边缘，无需裁剪')
        return
      }
      // 生成叠放预览并弹出确认框
      const blob = await buildStackPreview(frames)
      if (!blob) {
        setCropResult('生成预览失败')
        return
      }
      const url = URL.createObjectURL(blob)
      setCropPreview((prev) => {
        if (prev)
          URL.revokeObjectURL(prev.url)
        return {
          url,
          union,
          fullW: Math.max(...frames.map(f => f.width)),
          fullH: Math.max(...frames.map(f => f.height)),
        }
      })
    }
    catch {
      setCropResult('裁剪失败：有图片无法解码')
    }
    finally {
      setCropping(false)
    }
  }, [frames, cropping])

  const closeCropPreview = useCallback(() => {
    setCropPreview((prev) => {
      if (prev)
        URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  /** 确认裁剪：按预览的并集矩形裁掉所有帧 */
  const applyCrop = useCallback(async () => {
    if (!cropPreview || cropping)
      return
    setCropping(true)
    const { union } = cropPreview
    try {
      // 单帧失败不拖垮整批：失败的帧保持原样
      const cropped = await Promise.all(frames.map(f => cropFrameImage(f, union).catch(() => null)))
      // 按 id 匹配回写：裁剪是异步的，期间用户可能重排或调整勾选
      const croppedById = new Map(frames.map((f, i) => [f.id, cropped[i]]))
      setFrames((prev) => {
        const alive = new Set(prev.map(f => f.id))
        // 裁剪期间被移除的帧：回收为其生成的新 objectURL
        for (const [id, c] of croppedById) {
          if (c && !alive.has(id))
            URL.revokeObjectURL(c.url)
        }
        return prev.map((f) => {
          const c = croppedById.get(f.id)
          if (!c)
            return f
          URL.revokeObjectURL(f.url)
          return { ...f, ...c }
        })
      })
      setCropResult(
        `已裁掉公共透明边：${cropPreview.fullW} × ${cropPreview.fullH} → ${union.right - union.left} × ${union.bottom - union.top}`,
      )
      closeCropPreview()
    }
    catch {
      setCropResult('裁剪失败：有图片无法解码')
    }
    finally {
      setCropping(false)
    }
  }, [cropPreview, frames, cropping, closeCropPreview])

  const sortByName = useCallback(() => {
    setFrames(prev => [...prev].sort((a, b) => collator.compare(a.name, b.name)))
  }, [])

  // 卸载时回收所有 objectURL
  const framesRef = useRef<FrameItem[]>([])
  framesRef.current = frames
  useEffect(() => () => framesRef.current.forEach(f => URL.revokeObjectURL(f.url)), [])

  /* ---------- 播放引擎：rAF + 时间累积，帧率可调 ---------- */

  useEffect(() => {
    if (!playing || activeCount === 0)
      return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const stepMs = 1000 / fps

    /** 推进一帧（限在播放范围内），返回是否因循环次数用尽而结束 */
    const advance = (): boolean => {
      const lo = rangeStart
      const hi = rangeEnd
      if (hi <= lo)
        return false
      const ps = playRef.current
      let { index, dir, cycles } = ps
      if (index < lo || index > hi) {
        // 范围外（刚调过范围或点过范围外的帧）：先归位，不计循环
        index = direction === 'reverse' ? hi : lo
        dir = 1
      }
      else if (direction === 'forward') {
        index += 1
        if (index > hi) {
          index = lo
          cycles += 1
        }
      }
      else if (direction === 'reverse') {
        index -= 1
        if (index < lo) {
          index = hi
          cycles += 1
        }
      }
      else {
        // 往返：lo..hi..lo+1 为一轮，回到前进方向时记一次循环
        index += dir
        if (index > hi) {
          index = hi - 1
          dir = -1
        }
        else if (index < lo) {
          index = lo + 1
          dir = 1
          cycles += 1
        }
      }
      playRef.current = { index, dir, cycles }
      setCurrent(index)
      return !loopInfinite && cycles >= loopCount
    }

    const tick = (now: number) => {
      acc += now - last
      last = now
      while (acc >= stepMs) {
        acc -= stepMs
        if (advance()) {
          finishedRef.current = true
          setPlaying(false)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, fps, direction, loopInfinite, loopCount, activeCount, rangeStart, rangeEnd])

  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      const next = !prev
      // 有限循环播完后再次播放：从范围起点开始
      if (next && finishedRef.current) {
        playRef.current = { index: direction === 'reverse' ? rangeEnd : rangeStart, dir: 1, cycles: 0 }
        setCurrent(playRef.current.index)
        finishedRef.current = false
      }
      return next
    })
  }, [direction, rangeStart, rangeEnd])

  const stepFrame = useCallback((delta: -1 | 1) => {
    if (activeCount === 0)
      return
    setPlaying(false)
    // 在播放范围内步进；当前帧在范围外时先夹回范围
    const cur = Math.min(Math.max(safeIndex, rangeStart), rangeEnd)
    const len = rangeEnd - rangeStart + 1
    jumpTo(rangeStart + (((cur - rangeStart + delta) % len) + len) % len)
  }, [safeIndex, activeCount, rangeStart, rangeEnd, jumpTo])

  // 键盘：弹窗打开时只响应 Esc；否则空格播放/暂停，← → 逐帧
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
        return
      if (cropPreview) {
        if (e.key === 'Escape')
          closeCropPreview()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      else if (e.key === 'ArrowLeft') {
        stepFrame(-1)
      }
      else if (e.key === 'ArrowRight') {
        stepFrame(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, stepFrame, cropPreview, closeCropPreview])

  /* ---------- 样式导出 ---------- */

  const copyCss = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedCss(true)
      setTimeout(setCopiedCss, 1200, false)
    })
  }, [])

  const downloadSprite = useCallback(async () => {
    if (exportFrames.length === 0 || spriting)
      return
    setSpriting(true)
    try {
      const blob = await buildSpriteSheet(exportFrames, { cols: spriteCols, rows: spriteRows })
      if (!blob)
        return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'frame-anim-sprite.png'
      a.click()
      // 延迟回收，确保下载已拿到引用
      setTimeout(URL.revokeObjectURL, 10_000, url)
    }
    finally {
      setSpriting(false)
    }
  }, [exportFrames, spriteCols, spriteRows, spriting])

  /* ---------- 精灵图预览：入选 + 范围变化后防抖重建 ---------- */

  /** 预览内容指纹：id + 尺寸（裁剪后同 id 但尺寸变，需重建） */
  const spriteKey = exportFrames.length > 0
    ? `${spriteCols}x${spriteRows}|${exportFrames.map(f => `${f.id}:${f.width}x${f.height}`).join('|')}`
    : ''
  /** 最新 exportFrames 走 ref，effect 只依赖 key，避免每 render 重建 */
  const exportFramesRef = useRef(exportFrames)
  exportFramesRef.current = exportFrames
  const [sprite, setSprite] = useState<{ key: string, url: string } | null>(null)
  const spriteRef = useRef<{ key: string, url: string } | null>(null)
  spriteRef.current = sprite

  useEffect(() => {
    if (!spriteKey)
      return
    let cancelled = false
    const timer = setTimeout(() => {
      void buildSpriteSheet(exportFramesRef.current, { cols: spriteCols, rows: spriteRows }).then((blob) => {
        if (cancelled || !blob)
          return
        const url = URL.createObjectURL(blob)
        setSprite((prev) => {
          if (prev)
            URL.revokeObjectURL(prev.url)
          return { key: spriteKey, url }
        })
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [spriteKey, spriteCols, spriteRows])

  // 卸载回收精灵图预览的 objectURL
  useEffect(() => () => {
    if (spriteRef.current)
      URL.revokeObjectURL(spriteRef.current.url)
  }, [])

  /* ---------- 渲染 ---------- */

  const duration = rangeLen > 0 ? (rangeLen / fps).toFixed(2) : '0'
  const frameMs = (1000 / fps).toFixed(0)

  // 导出代码：单元格 = 播放范围内各帧最大宽 / 高（与精灵图一致）；尺寸走容器 + 百分比
  const cellW = exportFrames.length > 0 ? Math.max(...exportFrames.map(f => f.width)) : 0
  const cellH = exportFrames.length > 0 ? Math.max(...exportFrames.map(f => f.height)) : 0
  const exportParams: ExportParams = {
    frames: exportFrames.length,
    duration,
    iteration: loopInfinite ? 'infinite' : String(loopCount),
    direction: direction === 'forward' ? 'normal' : direction === 'reverse' ? 'reverse' : 'alternate',
    pixelated,
    cellW,
    cellH,
    useVars: exportVars,
    useContainer: exportContainer,
    layout: spriteLayout,
    cols: spriteDims.cols,
    rows: spriteDims.rows,
  }
  const exportText = exportFrames.length > 0
    ? EXPORT_BUILDERS[exportFormat](exportParams)
    : ''
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Seo
        title="帧动画预览"
        description="导入多张图片逐帧预览动画效果，可调帧率、播放方向、循环次数、缩放与背景，全部在浏览器本地完成，图片不上传。"
        path="/tools/frame-animation"
      />
      {/* 顶栏 */}
      <header className="flex items-center gap-3 py-6">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="返回首页">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex size-10 items-center justify-center rounded-md border-2 border-border bg-chart-1 shadow-hard-xs">
          <Film className="size-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight">帧动画预览</h1>
          <p className="text-sm text-muted-foreground">导入多张图片逐帧播放，帧率 / 方向 / 循环 / 缩放可调，图片不出浏览器</p>
        </div>
      </header>

      {/* 预览 + 参数（导入已融入预览：舞台即拖放区，添加按钮在舞台里） */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>预览</CardTitle>
            {frameCount > 0 && (
              <CardDescription>
                {`入选 ${activeCount}/${frameCount} 帧 · 空格播放/暂停，← → 逐帧`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="min-w-0 flex flex-1 flex-col gap-4 pb-6">
            {/* 舞台：本身就是拖放区；画面层绝对定位脱离文档流，否则放大倍率会撑高容器 */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'relative min-h-64 flex-1 overflow-hidden rounded-md border-2 transition-colors',
                frameCount === 0 && 'border-dashed',
                dragOver ? 'border-primary' : 'border-border',
              )}
              style={{
                background: stageBg === 'checker'
                  // 棋盘格：conic-gradient 四象限拼格；格 B 由底色算法派生
                  ? (resolvedCheckerA
                      ? `conic-gradient(${resolvedCheckerB} 25%, ${resolvedCheckerA} 0 50%, ${resolvedCheckerB} 0 75%, ${resolvedCheckerA} 0) 0 0 / 16px 16px`
                      : 'transparent')
                  : (resolvedSolid || 'transparent'),
              }}
            >
              {/* 画面层：不参与舞台尺寸计算；有帧时可拖拽平移 */}
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center overflow-hidden',
                  frame && (panning ? 'cursor-grabbing' : 'cursor-grab'),
                )}
                onPointerDown={frame ? onPanStart : undefined}
                onPointerMove={frame ? onPanMove : undefined}
                onPointerUp={frame ? onPanEnd : undefined}
                onPointerCancel={frame ? onPanEnd : undefined}
              >
                {frame
                  ? (
                      <img
                        src={frame.url}
                        alt={frame.name}
                        draggable={false}
                        className={cn(
                          'select-none',
                          zoom === 'fit' && 'max-h-full max-w-full object-contain',
                          // 帧边界：勾出单张精灵图格子的范围
                          showBounds && 'outline-2 outline-dashed outline-primary -outline-offset-2',
                        )}
                        style={{
                          ...(zoom !== 'fit' ? { width: frame.width * (zoom / 100) } : {}),
                          transform: `translate(${offset.x}px, ${offset.y}px)`,
                          imageRendering: pixelated ? 'pixelated' : 'auto',
                        }}
                      />
                    )
                  : (
                      frameCount > 0
                        // 有上传但全部未勾选
                        ? (
                            <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground/60">
                              <Images className="size-8" />
                              <p className="text-sm">没有入选的帧：在下方帧序列里勾选后参与预览</p>
                            </div>
                          )
                        : (
                            <div className="flex flex-col items-center gap-3 px-6 text-center">
                              <div className="flex size-12 items-center justify-center rounded-md border-2 border-border bg-chart-1 shadow-hard-xs -rotate-2">
                                <Images className="size-6 text-foreground" />
                              </div>
                              <div>
                                <p className="font-bold">拖拽图片 / ZIP 到此处，或</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  可多选，按文件名自然排序
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button type="button" onClick={() => fileInputRef.current?.click()}>
                                  <ImagePlus />
                                  添加图片
                                </Button>
                                <Button type="button" variant="outline" onClick={() => dirInputRef.current?.click()}>
                                  <FolderOpen />
                                  添加文件夹
                                </Button>
                              </div>
                            </div>
                          )
                    )}
              </div>
              {/* 有帧时：添加按钮悬浮在舞台右上角；平移后出现居中重置按钮 */}
              {frame && (
                <div className="absolute top-2 right-2 flex gap-1.5">
                  {(offset.x !== 0 || offset.y !== 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title="回到居中"
                      aria-label="回到居中"
                      onClick={resetPan}
                    >
                      <RotateCcw />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="添加图片"
                    aria-label="添加图片"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="添加文件夹"
                    aria-label="添加文件夹"
                    onClick={() => dirInputRef.current?.click()}
                  >
                    <FolderOpen />
                  </Button>
                </div>
              )}
            </div>
            {/* 精灵图预览跟随右侧布局选项，放在舞台下方 */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                精灵图预览（
                {exportFrames.length}
                {' 帧 · '}
                {spriteDims.cols}
                {' 列 × '}
                {spriteDims.rows}
                {' 行'}
                {' · '}
                {cellW * spriteDims.cols}
                {' × '}
                {cellH * spriteDims.rows}
                ）
              </span>
              <div
                className="min-h-24 max-w-full overflow-hidden rounded-md border-2 border-border"
                style={{
                  background: resolvedCheckerA
                    ? `conic-gradient(${resolvedCheckerB} 25%, ${resolvedCheckerA} 0 50%, ${resolvedCheckerB} 0 75%, ${resolvedCheckerA} 0) 0 0 / 12px 12px`
                    : 'transparent',
                }}
              >
                {sprite && sprite.key === spriteKey && spriteKey !== ''
                  ? (
                      <div className="flex min-h-24 w-full items-center justify-center p-2">
                        <img
                          src={sprite.url}
                          alt="精灵图预览"
                          draggable={false}
                          className="block h-auto max-w-full"
                          style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
                        />
                      </div>
                    )
                  : (
                      <div className="flex min-h-24 items-center justify-center text-xs text-muted-foreground">
                        {exportFrames.length > 0 ? '生成中…' : '暂无帧'}
                      </div>
                    )}
              </div>
            </div>
            {importError && (
              <p className="text-sm font-bold text-destructive">{importError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.zip"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
            {/* 文件夹选择：webkitdirectory 非标准属性，React 类型里没有，绕一下 */}
            <input
              ref={dirInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFileChange}
              {...{ webkitdirectory: '' } as Record<string, string>}
            />
            {/* 播放控制 */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={activeCount === 0}
                onClick={() => stepFrame(-1)}
                aria-label="上一帧"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                type="button"
                size="icon-lg"
                disabled={activeCount === 0}
                onClick={togglePlay}
                aria-label={playing ? '暂停' : '播放'}
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={activeCount === 0}
                onClick={() => stepFrame(1)}
                aria-label="下一帧"
              >
                <ChevronRight className="size-5" />
              </Button>
              <div className="ml-2 min-w-0 text-sm text-muted-foreground">
                {frame
                  ? (
                      <>
                        <span className="font-mono font-bold text-foreground">{safeIndex + 1}</span>
                        {' / '}
                        {activeCount}
                        <span className="mx-2">·</span>
                        <span className="break-all">{frame.name}</span>
                        <span className="mx-2">·</span>
                        {'一轮约 '}
                        {duration}
                        {' 秒'}
                      </>
                    )
                  : '—'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 参数：统一「左标签 + 右控件」行式布局 */}
        <Card>
          <CardHeader>
            <CardTitle>动画参数</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pb-6">
            {/* 帧率 + 一轮时长（双向换算） */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="fps" className="text-sm font-bold">帧率</label>
                <span className="text-xs text-muted-foreground">
                  {Number(fps.toFixed(2))}
                  {' fps · 每帧 '}
                  {frameMs}
                  {' ms'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="fps"
                  type="range"
                  min={1}
                  max={60}
                  value={fps}
                  onChange={e => setFps(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-primary"
                />
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={Number(fps.toFixed(2))}
                  aria-label="帧率（fps）"
                  title="帧率（fps）"
                  onChange={e => setFps(Math.min(120, Math.max(1, Number(e.target.value) || 1)))}
                  className={NUM_INPUT_CLASS}
                />
                <span className="text-xs text-muted-foreground">fps</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.05}
                  disabled={activeCount === 0}
                  value={rangeLen > 0 ? Number((rangeLen / fps).toFixed(2)) : 0}
                  aria-label="所有帧总时长（秒），改了反推帧率"
                  title="所有帧总时长（秒），改了反推帧率"
                  onChange={(e) => {
                    const d = Number(e.target.value)
                    if (d > 0)
                      setFps(Math.min(120, Math.max(1, rangeLen / d)))
                  }}
                  className={NUM_INPUT_CLASS}
                />
                <span className="text-xs text-muted-foreground">秒</span>
              </div>
            </div>

            {/* 帧范围：双头滑块，播放与导出都按范围截断 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold">帧范围</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {activeCount > 0 ? `第 ${rangeStart + 1} → ${rangeEnd + 1} 帧` : '—'}
                  {rangeRaw !== null && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setRangeRaw(null)}
                    >
                      恢复全程
                    </Button>
                  )}
                </span>
              </div>
              <div className="relative h-4">
                {/* 轨道 + 选中段高亮（视觉层，不响应指针） */}
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                {activeCount > 1 && (
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
                    style={{
                      left: `${(rangeStart / maxIdx) * 100}%`,
                      right: `${(1 - rangeEnd / maxIdx) * 100}%`,
                    }}
                  />
                )}
                <input
                  type="range"
                  min={0}
                  max={maxIdx}
                  step={1}
                  value={rangeStart}
                  disabled={activeCount < 2}
                  aria-label="起始帧"
                  onChange={e => setRangeRaw([Math.min(Number(e.target.value), rangeEnd), rangeEnd])}
                  className={RANGE_INPUT_CLASS}
                />
                <input
                  type="range"
                  min={0}
                  max={maxIdx}
                  step={1}
                  value={rangeEnd}
                  disabled={activeCount < 2}
                  aria-label="结束帧"
                  onChange={e => setRangeRaw([rangeStart, Math.max(Number(e.target.value), rangeStart)])}
                  className={RANGE_INPUT_CLASS}
                />
              </div>
            </div>

            {/* 方向 / 循环 / 缩放：左标签单行 */}
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm font-bold">方向</span>
              <OptionGroup<Direction>
                label="播放方向"
                className="flex-1"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'forward', label: '正序' },
                  { value: 'reverse', label: '倒序' },
                  { value: 'pingpong', label: '往返' },
                ]}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm font-bold">循环</span>
              <OptionGroup<string>
                label="循环方式"
                className="flex-1"
                value={loopInfinite ? 'infinite' : 'count'}
                onChange={v => setLoopInfinite(v === 'infinite')}
                options={[
                  { value: 'infinite', label: '无限' },
                  { value: 'count', label: '次数' },
                ]}
              />
              {!loopInfinite && (
                <>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={loopCount}
                    aria-label="循环次数"
                    title="循环次数，播完停在最后一帧"
                    onChange={e => setLoopCount(Math.min(999, Math.max(1, Number(e.target.value) || 1)))}
                    className={NUM_INPUT_CLASS}
                  />
                  <span className="text-xs text-muted-foreground">次</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm font-bold">缩放</span>
              <OptionGroup<Zoom>
                label="缩放"
                className="flex-1"
                value={zoom}
                onChange={setZoom}
                options={[
                  { value: 'fit', label: '适应' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' },
                  { value: 200, label: '200%' },
                  { value: 400, label: '400%' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-sm font-bold">排列</span>
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, exportFrames.length)}
                    value={spriteDims.cols}
                    aria-label="精灵图列数"
                    title="修改列数，行数自动计算"
                    onChange={e => setSpriteDimension({ axis: 'cols', value: Math.max(1, Number(e.target.value) || 1) })}
                    className={cn(NUM_INPUT_CLASS, 'min-w-0 w-auto flex-1 shrink')}
                  />
                  列
                </label>
                <span className="text-xs text-muted-foreground">×</span>
                <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, exportFrames.length)}
                    value={spriteDims.rows}
                    aria-label="精灵图行数"
                    title="修改行数，列数自动计算"
                    onChange={e => setSpriteDimension({ axis: 'rows', value: Math.max(1, Number(e.target.value) || 1) })}
                    className={cn(NUM_INPUT_CLASS, 'min-w-0 w-auto flex-1 shrink')}
                  />
                  行
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <BrutalCheckbox
                checked={showBounds}
                onChange={setShowBounds}
                label="帧边界"
                title="勾出单张精灵图格子的描边"
              />
              <BrutalCheckbox
                checked={pixelated}
                onChange={setPixelated}
                label="像素风"
                title="放大时保持锐利，适合像素画"
              />
            </div>

            {/* 舞台背景 */}
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm font-bold">背景</span>
              <OptionGroup<StageBg>
                label="舞台背景"
                className="flex-1"
                value={stageBg}
                onChange={setStageBg}
                options={[
                  { value: 'checker', label: '棋盘格' },
                  { value: 'solid', label: '纯色' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {stageBg === 'checker'
                ? (
                    <>
                      <ColorField
                        label="棋盘"
                        value={resolvedCheckerA || '#ffffff'}
                        onChange={setCheckerBase}
                        checker={resolvedCheckerB || undefined}
                      />
                      {checkerBase !== null && (
                        <Button type="button" variant="ghost" size="icon-sm" title="恢复跟随主题" aria-label="恢复跟随主题" onClick={() => setCheckerBase(null)}>
                          <RotateCcw />
                        </Button>
                      )}
                    </>
                  )
                : (
                    <>
                      <ColorField label="背景" value={resolvedSolid || '#ffffff'} onChange={setSolidBase} />
                      {solidBase !== null && (
                        <Button type="button" variant="ghost" size="icon-sm" title="恢复跟随主题" aria-label="恢复跟随主题" onClick={() => setSolidBase(null)}>
                          <RotateCcw />
                        </Button>
                      )}
                    </>
                  )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 样式导出（常驻；无入选帧时按钮禁用、代码区占位） */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="col-span-full sm:col-span-1">样式导出</CardTitle>
          <CardDescription className="col-span-full sm:col-span-1">
            动画参数实时映射到样式代码；下载精灵图后把 url() 换成项目里的实际路径
          </CardDescription>
          <CardAction className="col-span-full col-start-1 row-span-1 row-start-3 mt-2 w-full justify-self-stretch sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:justify-self-end">
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!exportText} onClick={() => copyCss(exportText)}>
                {copiedCss ? <Check /> : <Copy />}
                {copiedCss ? '已复制' : '复制'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={spriting || exportFrames.length === 0}
                onClick={() => void downloadSprite()}
              >
                {spriting ? <LoaderCircle className="animate-spin" /> : <FileImage />}
                下载精灵图
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <OptionGroup<ExportFormat>
              label="导出格式"
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'scss', label: 'SCSS' },
                { value: 'less', label: 'Less' },
                { value: 'css', label: 'CSS' },
              ]}
            />
            <BrutalCheckbox
              checked={exportVars}
              onChange={setExportVars}
              label="变量"
              title="帧数 / 时长提取为变量，便于集中调整"
            />
            <BrutalCheckbox
              checked={exportContainer}
              onChange={setExportContainer}
              label="容器"
              title="宽高由容器控制（100% + aspect-ratio），帧切换走百分比定位；关闭则写死单帧 px 尺寸"
            />
          </div>
          <pre
            tabIndex={0}
            aria-label="导出样式代码"
            onKeyDown={selectCodeOnShortcut}
            className="overflow-x-auto rounded-md border-2 border-border bg-background px-4 py-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {exportText || '// 导入帧后生成样式代码'}
          </pre>
        </CardContent>
      </Card>

      {/* 帧列表（常驻）：大缩略图网格；勾选 = 入选预览，不提供删除（防误操作） */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="col-span-full sm:col-span-1">
            帧序列（
            {frameCount}
            ）
          </CardTitle>
          <CardDescription className="col-span-full sm:col-span-1">勾选参与预览；点击跳转；拖拽重排</CardDescription>
          <CardAction className="col-span-full col-start-1 row-span-1 row-start-3 mt-2 w-full justify-self-stretch sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:justify-self-end">
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={toggleSelectAll}>
                <Check />
                {selected.size >= frameCount ? '全不选' : '全选'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={cropping}
                onClick={() => void prepareCrop()}
              >
                {cropping ? <LoaderCircle className="animate-spin" /> : <Crop />}
                裁掉公共透明边
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={sortByName}>
                <ArrowDownAZ />
                按名称排序
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="pb-6">
          {cropResult && (
            <p className="mb-3 rounded-md border-2 border-border bg-secondary px-3 py-2 text-sm font-bold">
              {cropResult}
            </p>
          )}
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {frames.map((f, i) => {
              const isActive = selected.has(f.id)
              const activeIdx = isActive ? activeFrames.indexOf(f) : -1
              return (
                <li
                  key={f.id}
                  draggable
                  title={`${f.name} · ${f.width} × ${f.height} · ${formatSize(f.size)}`}
                  onDragStart={(e) => {
                    dragIndexRef.current = i
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (dragIndexRef.current === null)
                      return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    // 网格布局：按指针在格子的左 / 右半部分决定插入到目标之前还是之后
                    const rect = e.currentTarget.getBoundingClientRect()
                    const after = e.clientX > rect.left + rect.width / 2
                    setDropTarget({ index: i, after })
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = dragIndexRef.current
                    if (from !== null) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      moveFrameTo(from, i, e.clientX > rect.left + rect.width / 2)
                    }
                    dragIndexRef.current = null
                    setDropTarget(null)
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null
                    setDropTarget(null)
                  }}
                  className={cn(
                    'relative overflow-hidden rounded-md border-2 transition-colors',
                    isActive ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-40',
                    'border-border/40 hover:border-border',
                    // 插入指示线：竖向内阴影，颜色走令牌
                    dropTarget?.index === i && (dropTarget.after
                      ? 'shadow-[inset_-3px_0_0_0_var(--color-primary)]'
                      : 'shadow-[inset_3px_0_0_0_var(--color-primary)]'),
                  )}
                  onClick={() => {
                    if (!isActive)
                      return
                    setPlaying(false)
                    jumpTo(activeIdx)
                  }}
                >
                  <img
                    src={f.url}
                    alt={f.name}
                    draggable={false}
                    className="h-28 w-full object-contain"
                  />
                  {/* 上传序号：叠加在图左上角，重排不变 */}
                  <span className="absolute top-1 left-1 rounded-sm border-2 border-border bg-background px-1 font-mono text-[10px] leading-4 font-bold">
                    #
                    {f.seq}
                  </span>
                  {/* 勾选 = 入选预览 */}
                  <span
                    className="absolute top-1.5 right-1.5"
                    onClick={e => e.stopPropagation()}
                  >
                    <BrutalCheckbox
                      checked={isActive}
                      onChange={() => toggleSelect(f.id)}
                      title={isActive ? `移出预览：${f.name}` : `加入预览：${f.name}`}
                    />
                  </span>
                  {/* 文件名：叠加在图底部 */}
                  <span className="absolute inset-x-0 bottom-0 truncate border-t-2 border-border bg-background/90 px-1.5 py-0.5 text-[11px] font-bold">
                    {f.name}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {/* 裁剪确认弹窗：所有帧叠放预览（最后一帧垫底），虚线框出保留区域 */}
      {cropPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={closeCropPreview}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="裁剪公共透明边"
            className="w-full max-w-lg rounded-lg border-2 border-border bg-card p-6 shadow-hard-lg"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-black tracking-tight">裁剪公共透明边</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              虚线内为保留区域：
              {cropPreview.fullW}
              {' × '}
              {cropPreview.fullH}
              {' → '}
              {cropPreview.union.right - cropPreview.union.left}
              {' × '}
              {cropPreview.union.bottom - cropPreview.union.top}
            </p>
            <div className="mt-4 flex justify-center">
              <div
                className="relative inline-block overflow-hidden rounded-md border-2 border-border"
                style={{
                  background: resolvedCheckerA
                    ? `conic-gradient(${resolvedCheckerB} 25%, ${resolvedCheckerA} 0 50%, ${resolvedCheckerB} 0 75%, ${resolvedCheckerA} 0) 0 0 / 12px 12px`
                    : 'transparent',
                }}
              >
                <img
                  src={cropPreview.url}
                  alt="所有帧叠放预览"
                  draggable={false}
                  className="block max-h-80 max-w-full"
                />
                {/* 裁剪保留区域：百分比定位，随预览图缩放 */}
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/10"
                  style={{
                    left: `${(cropPreview.union.left / cropPreview.fullW) * 100}%`,
                    top: `${(cropPreview.union.top / cropPreview.fullH) * 100}%`,
                    width: `${((cropPreview.union.right - cropPreview.union.left) / cropPreview.fullW) * 100}%`,
                    height: `${((cropPreview.union.bottom - cropPreview.union.top) / cropPreview.fullH) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCropPreview}>
                取消
              </Button>
              <Button type="button" disabled={cropping} onClick={() => void applyCrop()}>
                {cropping ? <LoaderCircle className="animate-spin" /> : <Crop />}
                应用裁剪
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
