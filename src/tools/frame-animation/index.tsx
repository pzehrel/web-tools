import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
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
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CHECKER_PALETTES, checkerBackground } from '@/lib/checker'
import { useStagePan, useStageZoom } from '@/lib/stage'
import { cn } from '@/lib/utils'
import { createDemoFrames } from '../demos/frame-animation'

/** 一帧：图片的 objectURL */
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

/** alpha 阈值默认值：低于此值视为透明，避免抗锯齿边缘的半透明噪点撑大包围盒 */
const DEFAULT_ALPHA_THRESHOLD = 10

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

/** 读取图片像素数据；取不到 2d 上下文返回 null */
function readImageData(img: HTMLImageElement): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx)
    return null
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** 扫描像素的非透明包围盒（alpha 大于 threshold 视为非透明）；全透明返回 null */
function scanOpaqueBox({ data, width, height }: ImageData, threshold: number): OpaqueBox | null {
  const colHasOpaque = (x: number) => {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > threshold)
        return true
    }
    return false
  }
  const rowHasOpaque = (y: number) => {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold)
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

/** 由缓存像素按阈值计算所有帧的并集包围盒；全部全透明返回 null */
function computeUnionBox(scan: ImageData[], threshold: number): OpaqueBox | null {
  let union: OpaqueBox | null = null
  for (const d of scan) {
    const box = scanOpaqueBox(d, threshold)
    if (!box)
      continue
    union = union
      ? {
          left: Math.min(union.left, box.left),
          top: Math.min(union.top, box.top),
          right: Math.max(union.right, box.right),
          bottom: Math.max(union.bottom, box.bottom),
        }
      : box
  }
  return union
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

const SPRITE_URL = 'YOUR-IMAGE-PATH.EXT'

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

/** 语言差异适配：变量引用 / 变量声明 / 注释 / 「帧数 × 单元宽 px」表达式 / keyframes 能否嵌进选择器 */
interface LangSpec {
  v: (name: string) => string
  decl: (name: string, value: string) => string
  comment: (text: string) => string
  framesTimesPx: (cellW: number) => string
  /** SCSS / Less 支持 @keyframes 嵌套在选择器内（编译时冒泡到顶层）；原生 CSS 必须平铺 */
  nestedKeyframes: boolean
}

const LANG: Record<ExportFormat, LangSpec> = {
  css: {
    v: n => `var(--${n})`,
    decl: (n, val) => `  --${n}: ${val};`,
    comment: t => `/* ${t} */`,
    framesTimesPx: w => `calc(var(--frames) * -${w}px)`,
    nestedKeyframes: false,
  },
  less: {
    v: n => `@${n}`,
    decl: (n, val) => `  @${n}: ${val};`,
    comment: t => `// ${t}`,
    framesTimesPx: w => `(@frames * -${w}px)`,
    nestedKeyframes: true,
  },
  scss: {
    v: n => `$${n}`,
    decl: (n, val) => `  $${n}: ${val};`,
    comment: t => `// ${t}`,
    framesTimesPx: w => `($frames * -${w}px)`,
    nestedKeyframes: true,
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
    ? [`  ${lang.comment('宽高交给容器：宽度撑满，按单帧宽高比推导高度')}`, '  width: 100%;', `  aspect-ratio: ${p.cellW} / ${p.cellH};`]
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

  // keyframes：SCSS / Less 嵌进 .frame-anim 内（编译时冒泡），CSS 平铺在顶层
  const keyframesBlock = [
    ...(keyframesComment ? [lang.nestedKeyframes ? `  ${keyframesComment}` : keyframesComment] : []),
    lang.nestedKeyframes ? '  @keyframes frame-anim-play {' : '@keyframes frame-anim-play {',
    ...keyframeLines.map(line => lang.nestedKeyframes ? `  ${line}` : line),
    lang.nestedKeyframes ? '  }' : '}',
  ]

  return [
    '.frame-anim {',
    ...varLines,
    ...sizeLines,
    `  background-image: url("${SPRITE_URL}");`,
    '  background-repeat: no-repeat;',
    ...(bgSizeLine ? [bgSizeLine] : []),
    ...(p.pixelated ? ['  image-rendering: pixelated;'] : []),
    `  animation: frame-anim-play ${duration} ${timing} ${p.iteration} ${p.direction};`,
    // SCSS / Less：keyframes 嵌进选择器内（编译时冒泡到顶层），CSS：平铺在外
    ...(lang.nestedKeyframes ? ['', ...keyframesBlock] : []),
    '}',
    ...(lang.nestedKeyframes ? [] : ['', ...keyframesBlock]),
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

/* ---------- 舞台颜色 ---------- */

/** 订阅 <html> 的 dark class 变化（主题切换由 ThemeToggle 驱动） */
function subscribeDarkClass(onChange: () => void): () => void {
  const ob = new MutationObserver(onChange)
  ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => ob.disconnect()
}

function readIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

/** 是否处于暗色主题：跟随主题切换实时更新 */
function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribeDarkClass, readIsDark, () => false)
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
  /** 棋盘配色：固定 4 套（每套含亮/暗两版），默认浅灰 */
  const [checkerIndex, setCheckerIndex] = useState(0)
  const isDark = useIsDarkTheme()
  const checkerColors = isDark ? CHECKER_PALETTES[checkerIndex].dark : CHECKER_PALETTES[checkerIndex].light
  /** 纯色背景：同一组 6 套配色（取格 A 色），跟随主题 */
  const [solidIndex, setSolidIndex] = useState(0)
  const solidColor = isDark ? CHECKER_PALETTES[solidIndex].dark.a : CHECKER_PALETTES[solidIndex].light.a
  /** 舞台视图缩放（1 = 100%）：滚轮或双指调整，不影响导出 */
  const [zoom, setZoom] = useState(0.75)
  const [pixelated, setPixelated] = useState(false)
  /** 显示帧边界：给当前帧画出单张精灵图格子的描边 */
  const [showBounds, setShowBounds] = useState(true)
  const stageRef = useRef<HTMLDivElement>(null)
  useStageZoom(stageRef, zoom, setZoom)
  const stagePan = useStagePan(stageRef, () => false)
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
  /** 透明阈值：alpha 低于此值视为透明（弹窗内可调，实时重算并集） */
  const [alphaThreshold, setAlphaThreshold] = useState(DEFAULT_ALPHA_THRESHOLD)
  /** 弹窗打开期间缓存的帧像素：调阈值时无需重新解码图片 */
  const cropScanRef = useRef<ImageData[] | null>(null)
  /** 裁剪确认弹窗：叠放预览图 + 并集裁剪矩形 */
  const [cropPreview, setCropPreview] = useState<{
    url: string
    /** 当前阈值下的并集保留区域；null = 该阈值下全部透明 */
    union: OpaqueBox | null
    fullW: number
    fullH: number
    /** 帧宽 / 高不一致：弹窗内给出提示 */
    mixedSize: boolean
  } | null>(null)
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

  /** 载入内置示例帧（canvas 只有客户端可用，用户点「试试示例」时现场生成） */
  const loadDemo = useCallback(async () => {
    const files = await createDemoFrames()
    if (files)
      await addFiles(files)
  }, [addFiles])

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
      // 解码并缓存像素：弹窗内调阈值时直接重扫，不用重新解码
      const scan: ImageData[] = []
      for (const f of frames) {
        const img = await loadImage(f.url)
        const data = readImageData(img)
        if (!data)
          throw new Error('unreadable')
        scan.push(data)
      }
      const union = computeUnionBox(scan, alphaThreshold)
      if (!union) {
        setCropResult('所有帧都是全透明图片，没有可保留的内容')
        return
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
      cropScanRef.current = scan
      const { width: w0, height: h0 } = frames[0]
      setCropPreview((prev) => {
        if (prev)
          URL.revokeObjectURL(prev.url)
        return {
          url,
          union,
          fullW: Math.max(...frames.map(f => f.width)),
          fullH: Math.max(...frames.map(f => f.height)),
          mixedSize: frames.some(f => f.width !== w0 || f.height !== h0),
        }
      })
    }
    catch {
      setCropResult('裁剪失败：有图片无法解码')
    }
    finally {
      setCropping(false)
    }
  }, [frames, cropping, alphaThreshold])

  /** 弹窗内调整阈值：用缓存像素实时重算并集（null = 该阈值下全部透明） */
  useEffect(() => {
    const scan = cropScanRef.current
    if (!scan)
      return
    setCropPreview((prev) => {
      if (!prev)
        return prev
      return { ...prev, union: computeUnionBox(scan, alphaThreshold) }
    })
  }, [alphaThreshold])

  const closeCropPreview = useCallback(() => {
    cropScanRef.current = null
    setCropPreview((prev) => {
      if (prev)
        URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  /** 清除全部帧：回收所有 objectURL，回到空状态（精灵图预览随 spriteKey 变空自动清理） */
  const clearAll = useCallback(() => {
    setPlaying(false)
    setCurrent(0)
    playRef.current = { index: 0, dir: 1, cycles: 0 }
    finishedRef.current = false
    setFrames((prev) => {
      prev.forEach(f => URL.revokeObjectURL(f.url))
      return []
    })
    setSelected(new Set())
    setRangeRaw(null)
    closeCropPreview()
    setCropResult(null)
    setImportError(null)
  }, [closeCropPreview])

  /** 确认裁剪：按预览的并集矩形裁掉所有帧 */
  const applyCrop = useCallback(async () => {
    if (!cropPreview || !cropPreview.union || cropping)
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

  /** 丢弃当前精灵图预览并回收 objectURL */
  const disposeSprite = useCallback(() => {
    spriteRef.current = null
    setSprite((prev) => {
      if (prev)
        URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  useEffect(() => {
    if (!spriteKey) {
      // 无入选帧（含清除全部）：丢弃旧预览并回收 objectURL
      disposeSprite()
      return
    }
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
  }, [spriteKey, spriteCols, spriteRows, disposeSprite])

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
  /** 单帧宽高：仅当入选帧尺寸全部一致时展示，否则省略（单元格取最大值，单帧尺寸不唯一） */
  const uniformFrameSize = exportFrames.length > 0
    && exportFrames.every(f => f.width === exportFrames[0].width && f.height === exportFrames[0].height)
    ? { w: exportFrames[0].width, h: exportFrames[0].height }
    : null
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
        description="导入多张图片逐帧预览动画效果，可调帧率、播放方向、循环次数、缩放与背景。"
        path="/tools/frame-animation"
      />
      {/* 顶栏 */}
      <header className="flex h-24 items-center gap-3">
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
          <p className="text-sm text-muted-foreground">导入多张图片逐帧播放，帧率 / 方向 / 循环 / 缩放可调</p>
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
            {/* 舞台：本身就是拖放区；滚轮 / 双指缩放，按住拖动平移（与点九图工具同一套手势） */}
            {/* 相对定位容器：舞台绝对定位脱离文档流（高度由卡片剩余空间决定），悬浮按钮不随内容滚动 */}
            <div className="relative min-h-64 flex-1">
              <div
                ref={stageRef}
                {...stagePan.panHandlers}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  'absolute inset-0 flex touch-none overflow-hidden rounded-md border-2 p-4 transition-colors select-none',
                  frame && (stagePan.panning ? 'cursor-grabbing' : 'cursor-grab'),
                  frameCount === 0 && 'border-dashed',
                  dragOver ? 'border-primary' : 'border-border',
                )}
                style={{
                  background: stageBg === 'checker'
                    ? checkerBackground(checkerColors.a, checkerColors.b)
                    : solidColor,
                }}
              >
                {frame
                  ? (
                      <img
                        src={frame.url}
                        alt={frame.name}
                        draggable={false}
                        className={cn(
                          'm-auto shrink-0',
                          // 帧边界：勾出单张精灵图格子的范围
                          showBounds && 'outline-2 outline-dashed outline-primary -outline-offset-2',
                        )}
                        style={{
                          width: frame.width * zoom,
                          transform: `translate(${stagePan.offset.x}px, ${stagePan.offset.y}px)`,
                          imageRendering: pixelated ? 'pixelated' : 'auto',
                        }}
                      />
                    )
                  : (
                      frameCount > 0
                        // 有上传但全部未勾选
                        ? (
                            <div className="m-auto flex flex-col items-center gap-2 px-6 text-center text-muted-foreground/60">
                              <Images className="size-8" />
                              <p className="text-sm">没有入选的帧：在下方帧序列里勾选后参与预览</p>
                            </div>
                          )
                        : (
                            <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
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
                                <Button type="button" variant="outline" onClick={() => void loadDemo()}>
                                  <Sparkles />
                                  试试示例
                                </Button>
                              </div>
                            </div>
                          )
                    )}
              </div>
              {/* 有帧时：添加按钮悬浮在舞台右上角；平移后出现「回到居中」 */}
              {frame && (
                <div className="absolute top-2 right-2 flex gap-1.5">
                  {(stagePan.offset.x !== 0 || stagePan.offset.y !== 0 || zoom !== 0.75) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title="重置视图（居中并恢复默认缩放）"
                      aria-label="重置视图"
                      onClick={() => {
                        stagePan.resetPan()
                        setZoom(0.75)
                      }}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="清除全部帧"
                    aria-label="清除全部帧"
                    onClick={clearAll}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
            {/* 精灵图预览跟随右侧布局选项，放在舞台下方 */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                精灵图预览（
                {exportFrames.length}
                {' 帧'}
                {uniformFrameSize && ` · 单张 ${uniformFrameSize.w} × ${uniformFrameSize.h}`}
                {' · '}
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
                style={{ background: stageBg === 'checker' ? checkerBackground(checkerColors.a, checkerColors.b) : solidColor }}
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
            {/* 播放控制：左侧三个按钮 + 帧信息，右侧下载精灵图 */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
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
                <label htmlFor="fps" className="text-xs font-bold text-muted-foreground">帧率</label>
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
                <span className="text-xs font-bold text-muted-foreground">帧范围</span>
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
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">方向</p>
              <OptionGroup<Direction>
                label="播放方向"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'forward', label: '正序' },
                  { value: 'reverse', label: '倒序' },
                  { value: 'pingpong', label: '往返' },
                ]}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">循环</p>
              <div className="flex items-center gap-2">
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
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">排列</p>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
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
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">背景</p>
              <OptionGroup<StageBg>
                label="舞台背景"
                value={stageBg}
                onChange={setStageBg}
                options={[
                  { value: 'checker', label: '棋盘格' },
                  { value: 'solid', label: '纯色' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* 同一批 DOM 在棋盘格 / 纯色间复用（只换内联样式与选中态），避免卸载重挂造成的闪烁 */}
              <div
                className="grid w-full grid-cols-6 items-center gap-2"
                role="radiogroup"
                aria-label={stageBg === 'checker' ? '棋盘配色' : '纯色配色'}
              >
                {CHECKER_PALETTES.map((palette, index) => {
                  const colors = isDark ? palette.dark : palette.light
                  const active = stageBg === 'checker' ? checkerIndex : solidIndex
                  return (
                    <button
                      key={palette.name}
                      type="button"
                      role="radio"
                      aria-checked={active === index}
                      title={palette.name}
                      aria-label={palette.name}
                      onClick={() => {
                        if (stageBg === 'checker')
                          setCheckerIndex(index)
                        else
                          setSolidIndex(index)
                      }}
                      className={cn(
                        'aspect-square w-full rounded-md border-2 shadow-hard-xs transition-[transform,box-shadow]',
                        active === index
                          ? 'border-primary ring-[3px] ring-ring/50'
                          : 'border-border hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
                      )}
                      style={{ background: stageBg === 'checker' ? checkerBackground(colors.a, colors.b) : colors.a }}
                    />
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 样式代码 + 帧序列：与上方「预览 + 参数」同列对齐（帧序列 300px 与动画参数一致） */}
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 样式导出（常驻；无入选帧时按钮禁用、代码区占位）；高度基准：两个板块等高对齐 */}
        <Card className="min-w-0 lg:h-[35rem]">
          <CardHeader>
            <CardTitle>样式代码</CardTitle>
            <CardAction>
              <Button type="button" variant="outline" size="icon-sm" disabled={!exportText} title="复制" aria-label="复制" onClick={() => copyCss(exportText)}>
                {copiedCss ? <Check /> : <Copy />}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <OptionGroup<ExportFormat>
                label="导出格式"
                className="w-fit"
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
              className="max-h-96 min-w-0 flex-1 overflow-auto rounded-md border-2 border-border bg-background px-4 py-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {exportText
                ? exportText.split(/(url\("[^"]*"\))/g).map(part => (
                    part.startsWith('url(')
                      ? (
                          <mark
                            key={part}
                            title="下载精灵图后，把这里换成项目里的实际路径"
                            className="rounded-sm bg-chart-3/40 px-0.5 font-bold text-foreground"
                          >
                            {part}
                          </mark>
                        )
                      : part
                  ))
                : '// 导入帧后生成样式代码'}
            </pre>
          </CardContent>
        </Card>

        {/* 帧列表（常驻）：列表一行一帧；勾选 = 入选预览，不提供删除（防误操作）；高度跟随样式代码板块 */}
        <Card className="flex min-w-0 flex-col lg:h-[35rem]">
          <CardHeader>
            <CardTitle>
              帧序列（
              {frameCount}
              ）
            </CardTitle>
            {/* 窄卡片：按钮组换行到标题下方；裁剪独占一行，全选 / 排序同一行 */}
            <CardAction className="col-start-1 row-start-3 flex w-full flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={cropping}
                onClick={() => void prepareCrop()}
              >
                {cropping ? <LoaderCircle className="animate-spin" /> : <Crop />}
                裁透明边
              </Button>
              <div className="flex w-full gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={toggleSelectAll}>
                  <Check />
                  {selected.size >= frameCount ? '全不选' : '全选'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={sortByName}>
                  <ArrowDownAZ />
                  排序
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pb-6">
            {cropResult && (
              <p className="mb-3 rounded-md border-2 border-border bg-secondary px-3 py-2 text-sm font-bold">
                {cropResult}
              </p>
            )}
            <ul className="flex flex-col gap-2">
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
                      // 列表布局：按指针在行的上 / 下半部分决定插入到目标之前还是之后
                      const rect = e.currentTarget.getBoundingClientRect()
                      const after = e.clientY > rect.top + rect.height / 2
                      setDropTarget({ index: i, after })
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const from = dragIndexRef.current
                      if (from !== null) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        moveFrameTo(from, i, e.clientY > rect.top + rect.height / 2)
                      }
                      dragIndexRef.current = null
                      setDropTarget(null)
                    }}
                    onDragEnd={() => {
                      dragIndexRef.current = null
                      setDropTarget(null)
                    }}
                    className={cn(
                      'flex items-center gap-1.5 overflow-hidden rounded-md border-2 px-2 py-1.5 transition-colors',
                      isActive ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-40',
                      'border-border/40 hover:border-border',
                      // 插入指示线：横向内阴影，颜色走令牌
                      dropTarget?.index === i && (dropTarget.after
                        ? 'shadow-[inset_0_-3px_0_0_var(--color-primary)]'
                        : 'shadow-[inset_0_3px_0_0_var(--color-primary)]'),
                    )}
                    onClick={() => {
                      if (!isActive)
                        return
                      setPlaying(false)
                      jumpTo(activeIdx)
                    }}
                  >
                    {/* 缩略图 */}
                    {/* 勾选 = 入选预览（最左） */}
                    <span
                      className="shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <BrutalCheckbox
                        checked={isActive}
                        onChange={() => toggleSelect(f.id)}
                        title={isActive ? `移出预览：${f.name}` : `加入预览：${f.name}`}
                      />
                    </span>
                    <img
                      src={f.url}
                      alt={f.name}
                      draggable={false}
                      className="h-10 w-10 shrink-0 rounded-sm object-contain"
                      style={{ background: stageBg === 'checker' ? checkerBackground(checkerColors.a, checkerColors.b) : solidColor }}
                    />
                    {/* 文件名（去扩展名）+ 尺寸/体积（两行） */}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-bold">
                        {f.name.replace(/\.[^.]+$/, '')}
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {`${f.width}×${f.height} · ${formatSize(f.size)}`}
                      </span>
                    </span>
                    {/* 上传序号：最右，重排不变 */}
                    <span className="shrink-0 rounded-sm border-2 border-border bg-background px-1 font-mono text-[10px] leading-4 font-bold">
                      #
                      {f.seq}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

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
            {cropPreview.mixedSize && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md border-2 border-border bg-secondary px-2 py-1.5 text-xs text-muted-foreground">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <span>
                  图片宽高不一致：框线以最大画布
                  {cropPreview.fullW}
                  {' × '}
                  {cropPreview.fullH}
                  为基准，小图按左上角对齐，超出部分自动忽略。
                </span>
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {cropPreview.union
                ? (
                    <>
                      实线框为原图尺寸，虚线框内为保留区域：
                      {cropPreview.fullW}
                      {' × '}
                      {cropPreview.fullH}
                      {' → '}
                      {cropPreview.union.right - cropPreview.union.left}
                      {' × '}
                      {cropPreview.union.bottom - cropPreview.union.top}
                    </>
                  )
                : '当前阈值下所有帧均为透明，无法裁剪'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="alpha-threshold" className="shrink-0 text-sm font-bold">透明阈值</label>
              <input
                id="alpha-threshold"
                type="range"
                min={0}
                max={128}
                value={alphaThreshold}
                onChange={e => setAlphaThreshold(Number(e.target.value))}
                className="min-w-0 flex-1 accent-primary"
              />
              <input
                type="number"
                min={0}
                max={254}
                value={alphaThreshold}
                aria-label="透明阈值"
                title="alpha 低于此值视为透明"
                onChange={e => setAlphaThreshold(Math.min(254, Math.max(0, Number(e.target.value) || 0)))}
                className={NUM_INPUT_CLASS}
              />
            </div>
            <div className="mt-4 flex justify-center">
              <div
                className="rounded-md border-2 border-border p-2"
                style={{ background: checkerBackground(checkerColors.a, checkerColors.b) }}
              >
                <div className="relative w-fit">
                  <img
                    src={cropPreview.url}
                    alt="所有帧叠放预览"
                    draggable={false}
                    className="block max-h-80 max-w-full"
                  />
                  {/* 原图尺寸描边（实线） */}
                  <div className="pointer-events-none absolute inset-0 border border-border" />
                  {/* 裁剪保留区域（虚线）：百分比定位，随预览图缩放 */}
                  {cropPreview.union && (
                    <div
                      className="pointer-events-none absolute border border-dashed border-primary bg-primary/10"
                      style={{
                        left: `${(cropPreview.union.left / cropPreview.fullW) * 100}%`,
                        top: `${(cropPreview.union.top / cropPreview.fullH) * 100}%`,
                        width: `${((cropPreview.union.right - cropPreview.union.left) / cropPreview.fullW) * 100}%`,
                        height: `${((cropPreview.union.bottom - cropPreview.union.top) / cropPreview.fullH) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCropPreview}>
                取消
              </Button>
              <Button type="button" disabled={cropping || !cropPreview.union} onClick={() => void applyCrop()}>
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
